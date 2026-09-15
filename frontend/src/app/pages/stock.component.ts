import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiService, applyBackendValidation } from '../core/api.service';

type MovementType = 'entry' | 'exit' | 'return' | 'transfer' | 'adjustment' | 'loss' | 'disposal';
type Direction = 'increase' | 'decrease';
type LotMode = 'new' | 'existing' | 'fefo';
type LocationSide = 'source' | 'destination' | 'both';
type ControlName =
  | 'type' | 'product_id' | 'quantity' | 'source_location_id' | 'destination_location_id'
  | 'direction' | 'stock_lot_id' | 'lot_mode' | 'lot_number' | 'supplier_id' | 'produced_at'
  | 'expires_at' | 'purchase_price' | 'performed_at' | 'reason' | 'notes';

interface Page<T> { data: T[]; }
interface Product {
  id: number;
  reference: string;
  name: string;
  track_lots: boolean;
  purchase_price?: string | number | null;
  supplier_id?: number | null;
}
interface Location { id: number; name: string; }
interface Supplier { id: number; name: string; }
interface StockLot {
  id: number;
  lot_number: string;
  expires_at?: string | null;
  produced_at?: string | null;
  purchase_price?: string | number | null;
  quantity?: string | number | null;
}
interface StockBalance {
  id: number;
  location_id: number;
  stock_lot_id: number | null;
  quantity: string | number;
  lot?: StockLot | null;
  location?: Location | null;
}
interface Movement {
  id: number;
  reference: string;
  operation_reference?: string | null;
  performed_at: string;
  product?: Product | null;
  lot?: StockLot | null;
  type: MovementType;
  direction?: Direction | null;
  quantity: string | number;
  source_location?: Location | null;
  destination_location?: Location | null;
  reason?: string | null;
}
interface MovementGroup {
  key: string;
  movement: Movement;
  count: number;
  lots: string;
  quantity: string | number;
}

@Component({
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  template: `
<section class="heading">
  <div>
    <h1>Mouvements de stock</h1>
    <p>Chaque opération est définitive, tracée et contrôlée par le serveur.</p>
  </div>
</section>

@if (formError()) { <p class="alert error" role="alert">{{ formError() }}</p> }

<mat-card class="form-card">
  <form [formGroup]="form" (ngSubmit)="save()">
    <div class="section">
      <h2>Opération</h2>
      <div class="grid">
        <mat-form-field>
          <mat-label>Type</mat-label>
          <mat-select formControlName="type">
            @for (type of types; track type) {
              <mat-option [value]="type">{{ labels[type] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field>
          <mat-label>Produit</mat-label>
          <mat-select formControlName="product_id">
            @for (product of products(); track product.id) {
              <mat-option [value]="product.id">{{ product.reference }} - {{ product.name }}</mat-option>
            }
          </mat-select>
          @if (errorFor('product_id')) { <mat-error>{{ errorFor('product_id') }}</mat-error> }
        </mat-form-field>

        <mat-form-field>
          <mat-label>Quantité</mat-label>
          <input matInput type="number" step="0.001" min="0.001" formControlName="quantity">
          @if (errorFor('quantity')) { <mat-error>{{ errorFor('quantity') }}</mat-error> }
        </mat-form-field>

        @if (form.controls.type.value === 'adjustment') {
          <mat-form-field>
            <mat-label>Sens de l'ajustement</mat-label>
            <mat-select formControlName="direction">
              <mat-option value="increase">Ajustement positif</mat-option>
              <mat-option value="decrease">Ajustement négatif</mat-option>
            </mat-select>
            @if (errorFor('direction')) { <mat-error>{{ errorFor('direction') }}</mat-error> }
          </mat-form-field>
        }
      </div>
      <p class="hint">{{ operationHint() }}</p>
    </div>

    <div class="section">
      <h2>Emplacements</h2>
      <div class="grid">
        @if (locationSide() === 'source' || locationSide() === 'both') {
          <mat-form-field>
            <mat-label>Source</mat-label>
            <mat-select formControlName="source_location_id">
              @for (location of locations(); track location.id) {
                <mat-option [value]="location.id">{{ location.name }}</mat-option>
              }
            </mat-select>
            @if (errorFor('source_location_id')) { <mat-error>{{ errorFor('source_location_id') }}</mat-error> }
          </mat-form-field>
        }

        @if (locationSide() === 'destination' || locationSide() === 'both') {
          <mat-form-field>
            <mat-label>Destination</mat-label>
            <mat-select formControlName="destination_location_id">
              @for (location of locations(); track location.id) {
                <mat-option [value]="location.id">{{ location.name }}</mat-option>
              }
            </mat-select>
            @if (errorFor('destination_location_id')) { <mat-error>{{ errorFor('destination_location_id') }}</mat-error> }
          </mat-form-field>
        }

        <mat-form-field>
          <mat-label>Date</mat-label>
          <input matInput type="datetime-local" formControlName="performed_at">
          @if (errorFor('performed_at')) { <mat-error>{{ errorFor('performed_at') }}</mat-error> }
        </mat-form-field>
      </div>
    </div>

    @if (selectedProduct()?.track_lots) {
      <div class="section">
        <h2>Lot</h2>
        @if (lotsLoading()) {
          <p class="hint">Chargement des lots...</p>
        } @else {
          <div class="grid">
            <mat-form-field>
              <mat-label>Mode de lot</mat-label>
              <mat-select formControlName="lot_mode">
                @for (mode of lotModes(); track mode) {
                  <mat-option [value]="mode">{{ lotModeLabels[mode] }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            @if (form.controls.lot_mode.value === 'existing') {
              <mat-form-field class="wide">
                <mat-label>Lot existant</mat-label>
                <mat-select formControlName="stock_lot_id">
                  @for (lot of lotOptions(); track lot.id) {
                    <mat-option [value]="lot.id">{{ lotLabel(lot) }}</mat-option>
                  }
                </mat-select>
                @if (errorFor('stock_lot_id')) { <mat-error>{{ errorFor('stock_lot_id') }}</mat-error> }
                @if (!lotOptions().length) { <mat-hint>Aucun lot disponible pour ce produit.</mat-hint> }
              </mat-form-field>
            }

            @if (form.controls.lot_mode.value === 'new') {
              <mat-form-field>
                <mat-label>Numéro de lot</mat-label>
                <input matInput formControlName="lot_number">
                @if (errorFor('lot_number')) { <mat-error>{{ errorFor('lot_number') }}</mat-error> }
              </mat-form-field>

              <mat-form-field>
                <mat-label>Production</mat-label>
                <input matInput type="date" formControlName="produced_at">
              </mat-form-field>

              <mat-form-field>
                <mat-label>Expiration</mat-label>
                <input matInput type="date" formControlName="expires_at">
                @if (errorFor('expires_at')) { <mat-error>{{ errorFor('expires_at') }}</mat-error> }
              </mat-form-field>

              <mat-form-field>
                <mat-label>Fournisseur</mat-label>
                <mat-select formControlName="supplier_id">
                  <mat-option [value]="null">Fournisseur du produit</mat-option>
                  @for (supplier of suppliers(); track supplier.id) {
                    <mat-option [value]="supplier.id">{{ supplier.name }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field>
                <mat-label>Prix d'achat</mat-label>
                <input matInput type="number" step="0.01" min="0" formControlName="purchase_price">
                @if (errorFor('purchase_price')) { <mat-error>{{ errorFor('purchase_price') }}</mat-error> }
              </mat-form-field>
            }
          </div>

          @if (form.controls.lot_mode.value === 'fefo') {
            <p class="hint">Sans lot explicite, le serveur répartit automatiquement par FEFO.</p>
          }
          @if (selectedLotExpired()) {
            <p class="alert warning">Lot expiré : autorisé seulement pour perte, mise au rebut ou ajustement.</p>
          }
        }
      </div>
    }

    <div class="section">
      <h2>Justification</h2>
      <div class="grid">
        @if (requiresReason()) {
          <mat-form-field>
            <mat-label>Motif</mat-label>
            <input matInput formControlName="reason">
            @if (errorFor('reason')) { <mat-error>{{ errorFor('reason') }}</mat-error> }
          </mat-form-field>
        }

        <mat-form-field class="wide">
          <mat-label>Notes</mat-label>
          <textarea matInput rows="2" formControlName="notes"></textarea>
          @if (errorFor('notes')) { <mat-error>{{ errorFor('notes') }}</mat-error> }
        </mat-form-field>
      </div>
    </div>

    <div class="actions">
      <button mat-flat-button type="submit" [disabled]="saving() || form.invalid">
        {{ saving() ? 'Enregistrement...' : 'Valider le mouvement' }}
      </button>
    </div>
  </form>
</mat-card>

<mat-card class="list">
  <h2>Historique</h2>
  <table>
    <thead>
      <tr>
        <th>Référence</th><th>Date</th><th>Produit</th><th>Lot</th><th>Type</th>
        <th>Quantité</th><th>Source</th><th>Destination</th><th>Motif</th>
      </tr>
    </thead>
    <tbody>
      @for (group of movementGroups(); track group.key) {
        <tr>
          <td>
            {{ group.movement.reference }}
            @if (group.count > 1) { <span class="badge">{{ group.count }} lots FEFO</span> }
          </td>
          <td>{{ group.movement.performed_at | date:'dd/MM/yyyy HH:mm' }}</td>
          <td>{{ group.movement.product?.name || '-' }}</td>
          <td>{{ group.lots || '-' }}</td>
          <td>{{ movementLabel(group.movement) }}</td>
          <td>{{ group.quantity }}</td>
          <td>{{ group.movement.source_location?.name || '-' }}</td>
          <td>{{ group.movement.destination_location?.name || '-' }}</td>
          <td>{{ group.movement.reason || '-' }}</td>
        </tr>
      } @empty {
        @if (movementsLoaded()) { <tr><td colspan="9" class="empty-state"><span role="status">Aucun mouvement n’a encore été enregistré.</span></td></tr> }
      }
    </tbody>
  </table>
</mat-card>
`,
  styles: `
.heading{margin-bottom:18px}h1{margin:0;font-size:28px}p{color:#687278}.form-card,.list{padding:18px;margin-bottom:18px}
h2{margin:0 0 12px;font-size:18px}.section{border-top:1px solid #eef0f1;padding-top:16px;margin-top:16px}.section:first-child{border-top:0;margin-top:0;padding-top:0}
.grid{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:10px;align-items:start}.wide{grid-column:span 2}
.hint{margin:4px 0 0;font-size:13px}.alert{padding:10px 12px;border-radius:6px;margin:0 0 12px}.error{background:#fdecec;color:#8a1f1f}.warning{background:#fff7df;color:#725110}
.actions{margin-top:16px}.actions button{background:#123a4a;color:#fff}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:11px 8px;border-bottom:1px solid #e6e8e9;vertical-align:top}.badge{display:inline-block;margin-left:6px;padding:2px 6px;border-radius:6px;background:#e9f2f5;color:#123a4a;font-size:12px}
@media(max-width:850px){.grid{grid-template-columns:1fr}.wide{grid-column:auto}.list{overflow-x:auto}}
`,
})
export class StockComponent {
  readonly api = inject(ApiService);
  private fb = inject(FormBuilder);

  readonly products = signal<Product[]>([]);
  readonly locations = signal<Location[]>([]);
  readonly suppliers = signal<Supplier[]>([]);
  readonly lots = signal<StockLot[]>([]);
  readonly balances = signal<StockBalance[]>([]);
  readonly movements = signal<Movement[]>([]);
  readonly movementsLoaded = signal(false);
  readonly lotsLoading = signal(false);
  readonly saving = signal(false);
  readonly formError = signal('');
  private loadedLotProductId: number | null = null;
  private suppliersLoaded = false;

  readonly types: MovementType[] = ['entry', 'exit', 'return', 'transfer', 'adjustment', 'loss', 'disposal'];
  readonly labels: Record<MovementType, string> = {
    entry: 'Entrée',
    exit: 'Sortie',
    return: 'Retour',
    transfer: 'Transfert',
    adjustment: 'Ajustement',
    loss: 'Perte',
    disposal: 'Mise au rebut',
  };
  readonly lotModeLabels: Record<LotMode, string> = {
    new: 'Nouveau lot',
    existing: 'Lot existant',
    fefo: 'FEFO automatique',
  };

  readonly form = this.fb.group({
    type: ['entry' as MovementType, Validators.required],
    product_id: [null as number | null, Validators.required],
    quantity: [null as number | string | null, [Validators.required, Validators.min(0.001), Validators.pattern(/^\d+(\.\d{1,3})?$/)]],
    source_location_id: [null as number | null],
    destination_location_id: [null as number | null],
    direction: [null as Direction | null],
    lot_mode: ['new' as LotMode],
    stock_lot_id: [null as number | null],
    lot_number: [''],
    supplier_id: [null as number | null],
    produced_at: [''],
    expires_at: [''],
    purchase_price: [null as number | string | null, [Validators.pattern(/^\d+(\.\d{1,2})?$/)]],
    performed_at: [this.nowForInput()],
    reason: [''],
    notes: [''],
  });

  selectedProduct() {
    const id = this.form.controls.product_id.value;
    return this.products().find(product => product.id === id) ?? null;
  }

  locationSide(): LocationSide {
    const type = this.form.controls.type.value;
    if (type === 'transfer') return 'both';
    if (type === 'adjustment') return this.form.controls.direction.value === 'decrease' ? 'source' : 'destination';
    return ['exit', 'loss', 'disposal'].includes(type ?? '') ? 'source' : 'destination';
  }

  lotModes(): LotMode[] {
    const type = this.form.controls.type.value;
    if (!this.selectedProduct()?.track_lots) return [];
    if (type === 'entry') return ['new', 'existing'];
    if (type === 'return') return ['existing'];
    if (type === 'adjustment' && this.form.controls.direction.value === 'increase') return ['existing'];
    return ['fefo', 'existing'];
  }

  lotOptions() {
    const source = this.form.controls.source_location_id.value;
    const side = this.locationSide();
    if (!source || side === 'destination') return this.lots();
    const availableIds = new Set(this.balances().filter(balance => balance.location_id === source && Number(balance.quantity) > 0).map(balance => balance.stock_lot_id));
    return this.lots().filter(lot => availableIds.has(lot.id));
  }

  selectedLotExpired() {
    const id = this.form.controls.stock_lot_id.value;
    const lot = this.lots().find(item => item.id === id);
    return !!lot?.expires_at && lot.expires_at < this.today();
  }

  readonly movementGroups = computed<MovementGroup[]>(() => {
    const grouped = new Map<string, Movement[]>();
    for (const movement of this.movements()) {
      const key = movement.operation_reference || `movement-${movement.id}`;
      grouped.set(key, [...(grouped.get(key) ?? []), movement]);
    }
    return [...grouped.entries()].map(([key, rows]) => ({
      key,
      movement: rows[0],
      count: rows.length,
      lots: rows.map(row => row.lot?.lot_number).filter(Boolean).join(', '),
      quantity: rows.length === 1 ? rows[0].quantity : rows.reduce((sum, row) => sum + Number(row.quantity), 0).toFixed(3),
    }));
  });

  constructor() {
    this.api.get<Page<Product>>('products', { per_page: 100 }).subscribe(response => this.products.set(response.data));
    this.api.get<Page<Location>>('settings/locations').subscribe(response => this.locations.set(response.data));
    this.form.controls.type.valueChanges.subscribe(() => this.onOperationChange());
    this.form.controls.direction.valueChanges.subscribe(() => this.onOperationChange());
    this.form.controls.product_id.valueChanges.subscribe(() => this.onProductChange());
    this.form.controls.lot_mode.valueChanges.subscribe(() => this.refreshValidation());
    this.form.controls.source_location_id.valueChanges.subscribe(() => this.refreshValidation());
    this.form.controls.destination_location_id.valueChanges.subscribe(() => this.refreshValidation());
    this.form.controls.stock_lot_id.valueChanges.subscribe(() => this.refreshValidation());
    this.form.controls.produced_at.valueChanges.subscribe(() => this.refreshValidation());
    this.form.controls.expires_at.valueChanges.subscribe(() => this.refreshValidation());
    this.load();
    this.refreshValidation();
  }

  load() {
    this.movementsLoaded.set(false);
    this.api.get<Page<Movement>>('stock/movements', { per_page: 50 }).pipe(finalize(() => this.movementsLoaded.set(true))).subscribe(response => this.movements.set(response.data));
  }

  save() {
    this.form.markAllAsTouched();
    this.refreshValidation();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    this.api.post('stock/movements', this.payload()).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.api.success('Mouvement enregistré.');
        this.form.patchValue({
          quantity: null,
          stock_lot_id: null,
          lot_number: '',
          produced_at: '',
          expires_at: '',
          purchase_price: null,
          reason: '',
          notes: '',
        });
        this.loadProductLots(true);
        this.load();
      },
      error: error => this.applyBackendErrors(error),
    });
  }

  operationHint() {
    const type = this.form.controls.type.value;
    const direction = this.form.controls.direction.value;
    if (type === 'entry') return 'Entrée : la quantité arrive dans la destination.';
    if (type === 'exit') return 'Sortie : la quantité quitte la source. Sans lot choisi, le serveur applique FEFO.';
    if (type === 'return') return 'Retour : la quantité revient dans la destination.';
    if (type === 'transfer') return 'Transfert : source et destination doivent être différentes.';
    if (type === 'adjustment') return direction === 'decrease' ? 'Ajustement négatif : correction à la baisse depuis une source.' : 'Ajustement positif : correction à la hausse vers une destination.';
    if (type === 'loss') return 'Perte : sortie justifiée depuis la source, lots expirés autorisés.';
    return 'Mise au rebut : sortie justifiée depuis la source, lots expirés autorisés.';
  }

  requiresReason() {
    return ['adjustment', 'loss', 'disposal'].includes(this.form.controls.type.value ?? '');
  }

  movementLabel(movement: Movement) {
    return movement.type === 'adjustment'
      ? `${this.labels.adjustment} ${movement.direction === 'decrease' ? 'négatif' : 'positif'}`
      : this.labels[movement.type];
  }

  lotLabel(lot: StockLot) {
    const balance = this.balances().filter(item => item.stock_lot_id === lot.id).reduce((sum, item) => sum + Number(item.quantity), 0);
    const state = lot.expires_at ? (lot.expires_at < this.today() ? 'expiré' : `exp. ${lot.expires_at}`) : 'sans expiration';
    return `${lot.lot_number} - ${balance.toFixed(3)} disponible - ${state}`;
  }

  errorFor(name: ControlName) {
    const control = this.form.controls[name];
    if (!control || !(control.touched || control.dirty) || !control.errors) return '';
    const errors = control.errors;
    if (errors['backend']) return String(errors['backend']);
    if (errors['required']) return 'Champ obligatoire.';
    if (errors['min']) return 'La valeur doit être positive.';
    if (errors['pattern']) return 'Format invalide.';
    if (errors['sameLocation']) return 'La source et la destination doivent être différentes.';
    if (errors['futureDate']) return 'La date ne peut pas être future.';
    if (errors['dateOrder']) return "L'expiration doit être après la production.";
    if (errors['expiredLot']) return 'Ce lot expiré n’est pas autorisé pour cette opération.';
    return 'Valeur invalide.';
  }

  private onOperationChange() {
    const modes = this.lotModes();
    this.form.patchValue({
      source_location_id: this.locationSide() === 'destination' ? null : this.form.controls.source_location_id.value,
      destination_location_id: this.locationSide() === 'source' ? null : this.form.controls.destination_location_id.value,
      lot_mode: modes[0] ?? 'new',
      stock_lot_id: null,
    }, { emitEvent: false });
    this.refreshValidation();
  }

  private onProductChange() {
    const product = this.selectedProduct();
    this.form.patchValue({
      lot_mode: product?.track_lots ? (this.form.controls.type.value === 'entry' ? 'new' : this.lotModes()[0] ?? 'existing') : 'new',
      stock_lot_id: null,
      lot_number: '',
      supplier_id: product?.supplier_id ?? null,
      purchase_price: product?.purchase_price ?? null,
    }, { emitEvent: false });
    if (!product?.track_lots) {
      this.lots.set([]);
      this.balances.set([]);
      this.loadedLotProductId = null;
      this.refreshValidation();
      return;
    }
    this.loadProductLots();
    if (!this.suppliersLoaded) {
      this.suppliersLoaded = true;
      this.api.get<Page<Supplier>>('settings/suppliers', { per_page: 100 }).subscribe(response => this.suppliers.set(response.data));
    }
  }

  private loadProductLots(force = false) {
    const product = this.selectedProduct();
    if (!product?.track_lots) return;
    if (!force && this.loadedLotProductId === product.id && this.lots().length) {
      this.refreshValidation();
      return;
    }
    this.loadedLotProductId = product.id;
    this.lotsLoading.set(true);
    this.api.get<Page<StockLot>>(`products/${product.id}/lots`).subscribe(response => {
      this.lots.set(response.data);
      this.api.get<Page<StockBalance>>(`products/${product.id}/balances`).pipe(finalize(() => {
        this.lotsLoading.set(false);
        this.refreshValidation();
      })).subscribe(balances => this.balances.set(balances.data));
    });
  }

  private validateForUx() {
    const value = this.form.getRawValue() as Record<ControlName, unknown>;
    const type = value['type'] as MovementType | null;
    const direction = value['direction'] as Direction | null;
    const product = this.products().find(item => item.id === value['product_id']);
    const source = value['source_location_id'];
    const destination = value['destination_location_id'];
    const errors: Record<string, boolean> = {};

    if (type === 'adjustment' && !direction) errors['directionRequired'] = true;
    const side = type === 'transfer' ? 'both' : type === 'adjustment' ? (direction === 'decrease' ? 'source' : 'destination') : ['exit', 'loss', 'disposal'].includes(type ?? '') ? 'source' : 'destination';
    if ((side === 'source' || side === 'both') && !source) errors['sourceRequired'] = true;
    if ((side === 'destination' || side === 'both') && !destination) errors['destinationRequired'] = true;
    if (type === 'transfer' && source && destination && source === destination) errors['sameLocation'] = true;
    if (this.requiresReason() && !value['reason']) errors['reasonRequired'] = true;
    if (value['performed_at'] && String(value['performed_at']) > this.nowForInput()) errors['futureDate'] = true;
    if (value['produced_at'] && value['expires_at'] && String(value['expires_at']) < String(value['produced_at'])) errors['dateOrder'] = true;

    if (product?.track_lots) {
      const mode = value['lot_mode'] as LotMode;
      if (mode === 'new' && type === 'entry' && !value['lot_number']) errors['lotNumberRequired'] = true;
      if (mode === 'new' && type === 'entry' && value['expires_at'] && String(value['expires_at']) < this.today()) errors['expiredLot'] = true;
      if (mode === 'existing' && !value['stock_lot_id']) errors['lotRequired'] = true;
      if ((type === 'return' || (type === 'adjustment' && direction === 'increase')) && !value['stock_lot_id']) errors['lotRequired'] = true;
      const allowExpired = ['loss', 'disposal', 'adjustment'].includes(type ?? '');
      const lot = this.lots().find(item => item.id === value['stock_lot_id']);
      if (lot?.expires_at && lot.expires_at < this.today() && !allowExpired) errors['expiredLot'] = true;
    }
    this.applyControlErrors(errors);
    return !Object.keys(errors).length;
  }

  private applyControlErrors(errors: Record<string, boolean>) {
    this.setCustomError('direction', 'required', !!errors['directionRequired']);
    this.setCustomError('source_location_id', 'required', !!errors['sourceRequired']);
    this.setCustomError('destination_location_id', 'required', !!errors['destinationRequired']);
    this.setCustomError('destination_location_id', 'sameLocation', !!errors['sameLocation']);
    this.setCustomError('reason', 'required', !!errors['reasonRequired']);
    this.setCustomError('performed_at', 'futureDate', !!errors['futureDate']);
    this.setCustomError('expires_at', 'dateOrder', !!errors['dateOrder']);
    this.setCustomError('expires_at', 'expiredLot', !!errors['expiredLot']);
    this.setCustomError('lot_number', 'required', !!errors['lotNumberRequired']);
    this.setCustomError('stock_lot_id', 'required', !!errors['lotRequired']);
  }

  private setCustomError(name: ControlName, key: string, active: boolean) {
    const control = this.form.controls[name];
    const errors = { ...(control.errors ?? {}) };
    if (active) errors[key] = true;
    else delete errors[key];
    control.setErrors(Object.keys(errors).length ? errors : null, { emitEvent: false });
  }

  private refreshValidation() {
    this.validateForUx();
  }

  private payload() {
    const raw = this.form.getRawValue();
    const body: Record<string, unknown> = {
      product_id: raw.product_id,
      type: raw.type,
      quantity: raw.quantity,
      performed_at: raw.performed_at ? new Date(raw.performed_at).toISOString() : null,
      notes: raw.notes || null,
    };
    if (this.locationSide() === 'source' || this.locationSide() === 'both') body['source_location_id'] = raw.source_location_id;
    if (this.locationSide() === 'destination' || this.locationSide() === 'both') body['destination_location_id'] = raw.destination_location_id;
    if (raw.type === 'adjustment') body['direction'] = raw.direction;
    if (this.requiresReason()) body['reason'] = raw.reason;
    if (this.selectedProduct()?.track_lots) {
      if (raw.lot_mode === 'existing') body['stock_lot_id'] = raw.stock_lot_id;
      if (raw.lot_mode === 'new' && raw.type === 'entry') {
        body['lot_number'] = raw.lot_number;
        body['supplier_id'] = raw.supplier_id;
        body['produced_at'] = raw.produced_at || null;
        body['expires_at'] = raw.expires_at || null;
        body['purchase_price'] = raw.purchase_price;
      }
    }
    return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== '' && value !== null && value !== undefined));
  }

  private applyBackendErrors(error: unknown) {
    const location = this.locationSide() === 'source' ? 'source_location_id' : 'destination_location_id';
    this.formError.set(applyBackendValidation(this.form, error, { location }));
  }

  private nowForInput() {
    return new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }

  private today() {
    return new Date().toISOString().slice(0, 10);
  }
}

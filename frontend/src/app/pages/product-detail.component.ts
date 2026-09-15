import { HttpErrorResponse } from '@angular/common/http';
import { DatePipe } from '@angular/common';
import { Component, ElementRef, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, forkJoin, of, switchMap } from 'rxjs';
import { ApiService, Page, apiErrorMessage, applyBackendValidation } from '../core/api.service';
import { ConfirmationService } from '../core/confirmation.service';

type ReferenceOption = { id: number; name: string; symbol?: string };
type ProductDetail = {
  id: number;
  reference: string;
  name: string;
  description: string | null;
  category_id: number | null;
  unit_id: number;
  supplier_id: number | null;
  minimum_stock: string;
  maximum_stock: string | null;
  purchase_price: string | null;
  barcode: string | null;
  track_lots: boolean;
  active: boolean;
  stock_quantity: string | null;
  has_movements: boolean;
  category?: { name: string; parent?: { name: string } | null } | null;
  unit?: { name: string; symbol: string } | null;
  supplier?: { name: string } | null;
};
type ProductBalance = { id: number; quantity: string; location?: { name: string } | null; lot?: { lot_number: string } | null };
type ProductLot = { id: number; lot_number: string; quantity: string | null; produced_at: string | null; received_at: string | null; expires_at: string | null };
type ProductPayload = Omit<ProductDetail, 'id' | 'stock_quantity' | 'has_movements' | 'category' | 'unit' | 'supplier'>;

const trimmedRequired: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  String(control.value ?? '').trim() ? null : { required: true };

const nonnegativeNumber: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return { number: true };
  return number < 0 ? { min: true } : null;
};

const maximumAtLeastMinimum: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const minimum = Number(control.get('minimum_stock')?.value);
  const maximumValue = String(control.get('maximum_stock')?.value ?? '').trim();
  if (!maximumValue || !Number.isFinite(minimum) || !Number.isFinite(Number(maximumValue))) return null;
  return Number(maximumValue) >= minimum ? null : { maximumBelowMinimum: true };
};

const nullableTrimmed = (value: string) => value.trim() || null;

function serverMessage(error: unknown) {
  const message = (error as HttpErrorResponse)?.error?.message;
  return typeof message === 'string' && message.trim() ? message : apiErrorMessage(error);
}

@Component({
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule],
  template: `
    <a class="back" routerLink="/produits">← Retour aux produits</a>
    <section class="heading">
      <div><h1>{{createMode?'Nouveau produit':product()?.name||'Produit'}}</h1>@if(product();as item){<p>{{item.reference}} · <span class="state-badge" [class.inactive]="!item.active">{{item.active?'Actif':'Inactif'}}</span></p>}</div>
      @if(product();as item){<div class="header-actions"><a mat-button routerLink="/mouvements">Mouvement de stock</a><button mat-flat-button (click)="startEdit()" [disabled]="editing()||busy()">Modifier</button><button mat-stroked-button class="danger" (click)="archive()" [disabled]="busy()">Archiver</button></div>}
    </section>

    @if(loading()){<p role="status" aria-live="polite">Chargement du produit…</p>}
    @if(actionError()){<p class="form-error" role="alert">{{actionError()}}</p>}

    @if(createMode||editing()){
      <mat-card class="form-card">
        <div class="section-title"><h2>{{createMode?'Créer le produit':'Modifier le produit'}}</h2>@if(optionsLoading()){<span role="status">Chargement des référentiels…</span>}</div>
        @if(formError()){<p class="form-error" role="alert">{{formError()}}</p>}
        <form [formGroup]="form" (ngSubmit)="save()">
          <mat-form-field><mat-label>Référence</mat-label><input matInput required maxlength="100" formControlName="reference">@if(errorFor('reference')){<mat-error>{{errorFor('reference')}}</mat-error>}</mat-form-field>
          <mat-form-field><mat-label>Désignation</mat-label><input matInput required maxlength="255" formControlName="name">@if(errorFor('name')){<mat-error>{{errorFor('name')}}</mat-error>}</mat-form-field>
          <mat-form-field><mat-label>Code-barres</mat-label><input matInput maxlength="255" formControlName="barcode">@if(errorFor('barcode')){<mat-error>{{errorFor('barcode')}}</mat-error>}</mat-form-field>
          <mat-form-field class="span-2"><mat-label>Description</mat-label><textarea matInput rows="3" formControlName="description"></textarea>@if(errorFor('description')){<mat-error>{{errorFor('description')}}</mat-error>}</mat-form-field>
          <mat-form-field><mat-label>Catégorie</mat-label><mat-select formControlName="category_id"><mat-option [value]="null">Aucune</mat-option>@for(item of categories();track item.id){<mat-option [value]="item.id">{{item.name}}</mat-option>}</mat-select>@if(errorFor('category_id')){<mat-error>{{errorFor('category_id')}}</mat-error>}</mat-form-field>
          <mat-form-field><mat-label>Unité</mat-label><mat-select required formControlName="unit_id">@for(item of units();track item.id){<mat-option [value]="item.id">{{item.name}} ({{item.symbol}})</mat-option>}</mat-select>@if(errorFor('unit_id')){<mat-error>{{errorFor('unit_id')}}</mat-error>}</mat-form-field>
          <mat-form-field><mat-label>Fournisseur</mat-label><mat-select formControlName="supplier_id"><mat-option [value]="null">Aucun</mat-option>@for(item of suppliers();track item.id){<mat-option [value]="item.id">{{item.name}}</mat-option>}</mat-select>@if(errorFor('supplier_id')){<mat-error>{{errorFor('supplier_id')}}</mat-error>}</mat-form-field>
          <mat-form-field><mat-label>Stock minimum</mat-label><input matInput type="number" min="0" required formControlName="minimum_stock">@if(errorFor('minimum_stock')){<mat-error>{{errorFor('minimum_stock')}}</mat-error>}</mat-form-field>
          <mat-form-field><mat-label>Stock maximum</mat-label><input matInput type="number" min="0" formControlName="maximum_stock">@if(errorFor('maximum_stock')){<mat-error>{{errorFor('maximum_stock')}}</mat-error>}</mat-form-field>
          <mat-form-field><mat-label>Prix d’achat (MAD)</mat-label><input matInput type="number" min="0" formControlName="purchase_price">@if(errorFor('purchase_price')){<mat-error>{{errorFor('purchase_price')}}</mat-error>}</mat-form-field>
          <div class="toggles"><mat-slide-toggle formControlName="track_lots">Gestion par lots</mat-slide-toggle><mat-slide-toggle formControlName="active">Produit actif</mat-slide-toggle></div>
          @if(product()?.has_movements){<p class="lock-note" role="note">L’unité et la gestion par lots sont verrouillées car ce produit possède déjà un historique de mouvements.</p>}
          <div class="form-actions"><button mat-flat-button type="submit" [disabled]="form.invalid||busy()||optionsLoading()">{{busy()==='save'?'Enregistrement…':createMode?'Créer':'Enregistrer'}}</button>@if(!createMode){<button mat-button type="button" (click)="cancelEdit()" [disabled]="busy()">Annuler</button>}</div>
        </form>
      </mat-card>
    }

    @if(!createMode&&product();as item){
      <div class="summary-grid">
        <mat-card><h2>Identité</h2><dl><div><dt>Référence</dt><dd>{{item.reference}}</dd></div><div><dt>Désignation</dt><dd>{{item.name}}</dd></div><div><dt>Catégorie</dt><dd>{{categoryLabel(item)}}</dd></div><div><dt>Unité</dt><dd>{{item.unit?.name||'—'}} ({{item.unit?.symbol||'—'}})</dd></div><div><dt>Fournisseur</dt><dd>{{item.supplier?.name||'—'}}</dd></div><div><dt>Code-barres</dt><dd>{{item.barcode||'—'}}</dd></div></dl>@if(item.description){<p class="description">{{item.description}}</p>}</mat-card>
        <mat-card><h2>Configuration du stock</h2><dl><div><dt>Minimum</dt><dd>{{item.minimum_stock}}</dd></div><div><dt>Maximum</dt><dd>{{item.maximum_stock||'—'}}</dd></div><div><dt>Prix d’achat</dt><dd>{{item.purchase_price?item.purchase_price+' MAD':'—'}}</dd></div><div><dt>Gestion par lots</dt><dd>{{item.track_lots?'Activée':'Désactivée'}}</dd></div></dl></mat-card>
        <mat-card class="stock-card"><h2>Stock actuel</h2><strong>{{item.stock_quantity||'0.000'}} {{item.unit?.symbol}}</strong><span class="stock-badge" [class.low]="stockState(item)==='low'" [class.out]="stockState(item)==='out'">{{stockLabel(item)}}</span></mat-card>
      </div>

      <mat-card class="data-card"><div class="section-title"><h2>Répartition par emplacement</h2><span>{{positiveBalances().length}} position{{positiveBalances().length>1?'s':''}}</span></div><div class="table-wrap"><table><thead><tr><th>Emplacement</th>@if(item.track_lots){<th>Lot</th>}<th>Quantité</th></tr></thead><tbody>
        @for(balance of positiveBalances();track balance.id){<tr><td>{{balance.location?.name||'—'}}</td>@if(item.track_lots){<td>{{balance.lot?.lot_number||'—'}}</td>}<td class="quantity">{{balance.quantity}} {{item.unit?.symbol}}</td></tr>}
        @empty{<tr><td [attr.colspan]="item.track_lots?3:2" class="empty-state"><span role="status">Aucun stock disponible pour ce produit.</span></td></tr>}
      </tbody></table></div></mat-card>

      @if(item.track_lots){<mat-card class="data-card"><div class="section-title"><h2>Lots</h2><span>{{lots().length}} lot{{lots().length>1?'s':''}}</span></div><div class="table-wrap"><table><thead><tr><th>Lot</th><th>Quantité</th><th>Production</th><th>Réception</th><th>Expiration</th><th>Statut</th></tr></thead><tbody>
        @for(lot of lots();track lot.id){<tr><td>{{lot.lot_number}}</td><td class="quantity">{{lot.quantity||'0.000'}} {{item.unit?.symbol}}</td><td>{{lot.produced_at?(lot.produced_at|date:'dd/MM/yyyy'):'—'}}</td><td>{{lot.received_at?(lot.received_at|date:'dd/MM/yyyy'):'—'}}</td><td>{{lot.expires_at?(lot.expires_at|date:'dd/MM/yyyy'):'—'}}</td><td><span class="state-badge" [class.inactive]="lotStatus(lot)==='Expiré'">{{lotStatus(lot)}}</span></td></tr>}
        @empty{<tr><td colspan="6" class="empty-state"><span role="status">Aucun lot enregistré pour ce produit.</span></td></tr>}
      </tbody></table></div></mat-card>}
    }
  `,
  styles: `.back{display:inline-block;margin-bottom:12px;color:#245c6b}.heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px}.header-actions{display:flex;gap:8px;flex-wrap:wrap}.header-actions button:nth-child(2),.form-actions button:first-child{background:#123a4a;color:white}.danger{color:#8a1f1f}h1{margin:0;font-size:28px;text-wrap:balance}h2{margin:0;font-size:18px}p{color:#687278;text-wrap:pretty}.form-card,.summary-grid mat-card,.data-card{padding:18px;margin-bottom:18px}.form-card form{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;align-items:center}.span-2{grid-column:span 2}.toggles,.form-actions{display:flex;gap:18px;align-items:center;grid-column:1/-1}.lock-note,.form-error{grid-column:1/-1}.lock-note{padding:10px 12px;background:#eef4f6;border-left:3px solid #2d7089}.form-error{color:#8a1f1f}.summary-grid{display:grid;grid-template-columns:2fr 1.3fr 1fr;gap:18px}.summary-grid mat-card{margin:0}.stock-card{display:flex;flex-direction:column;gap:10px}.stock-card strong{font-size:26px;font-variant-numeric:tabular-nums}.section-title{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:12px}.section-title span{color:#687278}dl{margin:12px 0 0}dl div{display:grid;grid-template-columns:130px 1fr;gap:10px;padding:7px 0;border-bottom:1px solid #e6e8e9}dt{color:#687278}dd{margin:0}.description{white-space:pre-wrap}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:11px 8px;border-bottom:1px solid #e6e8e9;white-space:nowrap}th{font-size:12px;color:#687278;text-transform:uppercase;letter-spacing:.03em}.quantity{font-variant-numeric:tabular-nums}.stock-badge,.state-badge{align-self:flex-start;display:inline-block;padding:3px 8px;border-radius:999px;background:#e8f3ee;color:#245c40;font-size:12px;font-weight:600}.stock-badge.low{background:#fff1cc;color:#765600}.stock-badge.out,.state-badge.inactive{background:#f6e3e3;color:#8a1f1f}a:focus-visible,button:focus-visible{outline:3px solid #2d7089;outline-offset:2px}@media(max-width:950px){.summary-grid{grid-template-columns:1fr 1fr}.stock-card{grid-column:1/-1}.form-card form{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.heading{align-items:flex-start;flex-direction:column}.summary-grid,.form-card form{grid-template-columns:1fr}.stock-card,.span-2{grid-column:auto}.toggles{align-items:flex-start;flex-direction:column}}`,
})
export class ProductDetailComponent {
  private api = inject(ApiService);
  private confirmation = inject(ConfirmationService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private fb = inject(FormBuilder);
  private host = inject(ElementRef<HTMLElement>);
  private readonly productId = this.route.snapshot.paramMap.get('id') === null ? null : Number(this.route.snapshot.paramMap.get('id'));
  private openEditOnLoad = this.route.snapshot.queryParamMap.get('edit') === 'true';
  readonly createMode = this.productId === null;
  readonly product = signal<ProductDetail | null>(null);
  readonly balances = signal<ProductBalance[]>([]);
  readonly lots = signal<ProductLot[]>([]);
  readonly categories = signal<ReferenceOption[]>([]);
  readonly units = signal<ReferenceOption[]>([]);
  readonly suppliers = signal<ReferenceOption[]>([]);
  readonly loading = signal(false);
  readonly optionsLoading = signal(false);
  readonly optionsLoaded = signal(false);
  readonly editing = signal(this.createMode);
  readonly busy = signal<'' | 'save' | 'archive'>('');
  readonly formError = signal('');
  readonly actionError = signal('');
  readonly form = this.fb.group({
    reference: this.fb.nonNullable.control('', [trimmedRequired, Validators.maxLength(100)]),
    name: this.fb.nonNullable.control('', [trimmedRequired, Validators.maxLength(255)]),
    description: this.fb.nonNullable.control(''),
    category_id: this.fb.control<number | null>(null),
    unit_id: this.fb.control<number | null>(null, Validators.required),
    supplier_id: this.fb.control<number | null>(null),
    minimum_stock: this.fb.nonNullable.control('0', [Validators.required, nonnegativeNumber]),
    maximum_stock: this.fb.nonNullable.control('', nonnegativeNumber),
    purchase_price: this.fb.nonNullable.control('', nonnegativeNumber),
    barcode: this.fb.nonNullable.control('', Validators.maxLength(255)),
    track_lots: this.fb.nonNullable.control(false),
    active: this.fb.nonNullable.control(true),
  }, { validators: maximumAtLeastMinimum });

  constructor() {
    if (this.createMode) this.loadOptions();
    else this.load();
  }

  load() {
    if (!this.productId) return;
    this.loading.set(true);
    this.actionError.set('');
    this.api.get<ProductDetail>(`products/${this.productId}`).pipe(
      switchMap(product => forkJoin({
        product: of(product),
        balances: this.api.get<Page<ProductBalance>>(`products/${product.id}/balances`),
        lots: product.track_lots ? this.api.get<Page<ProductLot>>(`products/${product.id}/lots`) : of({ data: [], total: 0, current_page: 1, last_page: 1 }),
      })),
      finalize(() => this.loading.set(false)),
    ).subscribe(({ product, balances, lots }) => {
      this.product.set(product);
      this.balances.set(balances.data);
      this.lots.set(lots.data);
      if (this.openEditOnLoad) { this.openEditOnLoad = false; this.startEdit(); }
    });
  }

  startEdit() {
    const product = this.product();
    if (!product) return;
    this.form.reset({
      reference: product.reference,
      name: product.name,
      description: product.description ?? '',
      category_id: product.category_id,
      unit_id: product.unit_id,
      supplier_id: product.supplier_id,
      minimum_stock: product.minimum_stock,
      maximum_stock: product.maximum_stock ?? '',
      purchase_price: product.purchase_price ?? '',
      barcode: product.barcode ?? '',
      track_lots: product.track_lots,
      active: product.active,
    });
    this.setImmutableFields(product.has_movements);
    this.formError.set('');
    this.editing.set(true);
    this.loadOptions();
  }

  cancelEdit() {
    this.editing.set(false);
    this.formError.set('');
  }

  save() {
    this.normalizeForm();
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) { this.focusFirstInvalid(); return; }
    this.busy.set('save');
    this.formError.set('');
    const request = this.createMode
      ? this.api.post<ProductDetail>('products', this.payload())
      : this.api.patch<ProductDetail>(`products/${this.productId}`, this.payload());
    request.pipe(finalize(() => this.busy.set(''))).subscribe({
      next: product => {
        this.api.success(this.createMode ? 'Produit créé.' : 'Produit mis à jour.');
        if (this.createMode) this.router.navigate(['/produits', product.id]);
        else { this.editing.set(false); this.load(); }
      },
      error: error => {
        this.api.error.set('');
        this.formError.set(applyBackendValidation(this.form, error) || serverMessage(error));
        this.focusFirstInvalid();
      },
    });
  }

  archive() {
    const product = this.product();
    if (!product || this.busy()) return;
    this.confirmation.confirm({
      title: 'Archiver ce produit ?',
      message: `« ${product.name} » ne sera plus disponible pour les opérations courantes. Son historique sera conservé.`,
      confirmLabel: 'Archiver',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.busy.set('archive');
      this.actionError.set('');
      this.api.delete(`products/${product.id}`).pipe(finalize(() => this.busy.set(''))).subscribe({
        next: () => { this.api.success('Produit archivé.'); this.router.navigate(['/produits']); },
        error: error => { this.api.error.set(''); this.actionError.set(serverMessage(error)); },
      });
    });
  }

  positiveBalances() { return this.balances().filter(balance => Number(balance.quantity) > 0); }

  categoryLabel(product: ProductDetail) {
    if (!product.category) return '—';
    return product.category.parent ? `${product.category.parent.name} / ${product.category.name}` : product.category.name;
  }

  stockState(product: ProductDetail) {
    const stock = Number(product.stock_quantity ?? 0);
    if (stock === 0) return 'out';
    return stock <= Number(product.minimum_stock) ? 'low' : 'available';
  }

  stockLabel(product: ProductDetail) {
    return ({ available: 'Stock normal', low: 'Stock faible', out: 'Rupture de stock' } as const)[this.stockState(product)];
  }

  lotStatus(lot: ProductLot) {
    if (!lot.expires_at) return 'Sans échéance';
    return lot.expires_at.slice(0, 10) < new Date().toISOString().slice(0, 10) ? 'Expiré' : 'Valide';
  }

  errorFor(name: keyof typeof this.form.controls) {
    const control = this.form.controls[name];
    if (!control.touched) return '';
    if (control.errors?.['backend']) return String(control.errors['backend']);
    if (name === 'maximum_stock' && this.form.hasError('maximumBelowMinimum')) return 'Le stock maximum doit être supérieur ou égal au minimum.';
    if (control.errors?.['required']) return 'Champ obligatoire.';
    if (control.errors?.['maxlength']) return `La longueur maximale est de ${control.errors['maxlength'].requiredLength} caractères.`;
    if (control.errors?.['min']) return 'La valeur ne peut pas être négative.';
    if (control.errors?.['number']) return 'Saisissez un nombre valide.';
    return control.errors ? 'Valeur invalide.' : '';
  }

  private loadOptions() {
    if (this.optionsLoaded() || this.optionsLoading()) return;
    this.optionsLoading.set(true);
    const params: Record<string, string | number | boolean> = this.createMode
      ? { per_page: 100, active: true }
      : { per_page: 100 };
    forkJoin({
      categories: this.api.get<Page<ReferenceOption>>('settings/categories', params),
      units: this.api.get<Page<ReferenceOption>>('settings/units', params),
      suppliers: this.api.get<Page<ReferenceOption>>('settings/suppliers', params),
    }).pipe(finalize(() => this.optionsLoading.set(false))).subscribe(({ categories, units, suppliers }) => {
      this.categories.set(categories.data);
      this.units.set(units.data);
      this.suppliers.set(suppliers.data);
      this.optionsLoaded.set(true);
    });
  }

  private setImmutableFields(locked: boolean) {
    if (locked) {
      this.form.controls.unit_id.disable({ emitEvent: false });
      this.form.controls.track_lots.disable({ emitEvent: false });
    } else {
      this.form.controls.unit_id.enable({ emitEvent: false });
      this.form.controls.track_lots.enable({ emitEvent: false });
    }
  }

  private payload(): ProductPayload {
    const value = this.form.getRawValue();
    return {
      reference: value.reference,
      name: value.name,
      description: nullableTrimmed(value.description),
      category_id: value.category_id,
      unit_id: value.unit_id!,
      supplier_id: value.supplier_id,
      minimum_stock: value.minimum_stock,
      maximum_stock: nullableTrimmed(value.maximum_stock),
      purchase_price: nullableTrimmed(value.purchase_price),
      barcode: nullableTrimmed(value.barcode),
      track_lots: value.track_lots,
      active: value.active,
    };
  }

  private normalizeForm() {
    for (const control of [this.form.controls.reference, this.form.controls.name, this.form.controls.description, this.form.controls.minimum_stock, this.form.controls.maximum_stock, this.form.controls.purchase_price, this.form.controls.barcode]) {
      control.setValue(control.value.trim(), { emitEvent: false });
    }
    this.form.updateValueAndValidity();
  }

  private focusFirstInvalid() {
    queueMicrotask(() => ((this.host.nativeElement as HTMLElement).querySelector('.ng-invalid[formControlName]') as HTMLElement | null)?.focus());
  }
}

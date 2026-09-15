import { Component, ElementRef, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { ApiService, Page, applyBackendValidation } from '../core/api.service';
import { ConfirmationService } from '../core/confirmation.service';

type LocationOption = { id: number; name: string };
type InventoryLine = { id: number; product?: { name: string }; location?: { name: string }; lot?: { lot_number: string }; theoretical_quantity: string; physical_quantity: string | null; variance: string | null; reason: string | null; comment: string | null };
type InventorySession = { id: number; name: string; status: string; lines?: InventoryLine[] };
type InventoryLineForm = FormGroup<{
  physical_quantity: FormControl<string>;
  reason: FormControl<string>;
  comment: FormControl<string>;
}>;

const quantityPattern = /^\d+(?:\.\d{1,3})?$/;
const scaledQuantity = (value: string) => {
  const [whole, decimals = ''] = value.split('.');
  return BigInt(whole) * 1000n + BigInt(decimals.padEnd(3, '0'));
};

const trimmedRequired: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  String(control.value ?? '').trim() ? null : { required: true };

function reasonForVariance(theoreticalQuantity: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const physical = control.get('physical_quantity');
    const reason = control.get('reason');
    if (!physical?.value || physical.invalid || String(reason?.value ?? '').trim()) return null;
    return scaledQuantity(String(physical.value)) === scaledQuantity(theoreticalQuantity) ? null : { reasonRequired: true };
  };
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <section class="heading"><div><h1>Inventaires physiques</h1><p>Le comptage génère des ajustements traçables à la validation.</p></div></section>
    <mat-card>
      @if(formError()){<p class="form-error" role="alert">{{formError()}}</p>}
      <form class="create" [formGroup]="sessionForm" (ngSubmit)="create()">
        <mat-form-field><mat-label>Nom de la session</mat-label><input matInput formControlName="name" required maxlength="255">@if(sessionErrorFor('name')){<mat-error>{{sessionErrorFor('name')}}</mat-error>}</mat-form-field>
        <mat-form-field><mat-label>Emplacement</mat-label><mat-select formControlName="location_id"><mat-option [value]="null">Tous les emplacements</mat-option>@for(location of locations();track location.id){<mat-option [value]="location.id">{{location.name}}</mat-option>}</mat-select>@if(sessionErrorFor('location_id')){<mat-error>{{sessionErrorFor('location_id')}}</mat-error>}</mat-form-field>
        <button mat-flat-button type="submit" [disabled]="sessionForm.invalid || busy() !== null">{{busy()==='create'?'Création…':'Créer l’inventaire'}}</button>
      </form>
    </mat-card>
    <div class="grid">
      <mat-card><h2>Sessions</h2><table><thead><tr><th>Session</th><th>Statut</th><th></th></tr></thead><tbody>
        @for(item of sessions();track item.id){<tr><td>{{item.name}}</td><td>{{statusLabels[item.status]||item.status}}</td><td><button mat-button (click)="open(item.id)">Ouvrir</button></td></tr>}
        @empty{@if(sessionsLoaded()){<tr><td colspan="3" class="empty-state"><span role="status">Aucun inventaire n’a encore été créé.</span></td></tr>}}
      </tbody></table></mat-card>
      @if(session(); as current){
        <mat-card><div class="detail-head"><h2>{{current.name}}</h2>@if(current.status==='in_progress'){<button mat-flat-button [disabled]="!canValidate() || busy() !== null" (click)="validate()">{{busy()==='validate'?'Validation…':'Valider'}}</button>}</div>
          <table><thead><tr><th>Produit</th><th>Emplacement</th><th>Lot</th><th>Théorique</th><th>Physique</th><th>Écart</th><th>Motif</th><th>Commentaire</th><th></th></tr></thead><tbody>
            @for(line of current.lines||[];track line.id){
              <tr [formGroup]="lineForm(line.id)" [attr.data-line-id]="line.id"><td>{{line.product?.name}}</td><td>{{line.location?.name||'—'}}</td><td>{{line.lot?.lot_number||'—'}}</td><td>{{line.theoretical_quantity}}</td>
                <td>@if(current.status==='in_progress'){<div class="cell-field"><input [id]="'physical-'+line.id" type="text" inputmode="decimal" required formControlName="physical_quantity" [attr.aria-label]="'Quantité physique pour ' + line.product?.name" [attr.aria-invalid]="!!lineErrorFor(line.id,'physical_quantity')" [attr.aria-describedby]="lineErrorFor(line.id,'physical_quantity')?'physical-error-'+line.id:null" (keydown.enter)="saveLine(line)">@if(lineErrorFor(line.id,'physical_quantity')){<span class="field-error" [id]="'physical-error-'+line.id" role="alert">{{lineErrorFor(line.id,'physical_quantity')}}</span>}</div>}@else { {{line.physical_quantity}} }</td>
                <td>{{previewVariance(line)}}</td>
                <td>@if(current.status==='in_progress'){<div class="cell-field"><input class="wide" [id]="'reason-'+line.id" maxlength="255" formControlName="reason" [attr.aria-label]="'Motif pour ' + line.product?.name" [attr.aria-invalid]="!!lineErrorFor(line.id,'reason')" [attr.aria-describedby]="lineErrorFor(line.id,'reason')?'reason-error-'+line.id:null" (keydown.enter)="saveLine(line)">@if(lineErrorFor(line.id,'reason')){<span class="field-error" [id]="'reason-error-'+line.id" role="alert">{{lineErrorFor(line.id,'reason')}}</span>}</div>}@else { {{line.reason||'—'}} }</td>
                <td>@if(current.status==='in_progress'){<div class="cell-field"><input class="wide" [id]="'comment-'+line.id" maxlength="5000" formControlName="comment" [attr.aria-label]="'Commentaire pour ' + line.product?.name" [attr.aria-invalid]="!!lineErrorFor(line.id,'comment')" [attr.aria-describedby]="lineErrorFor(line.id,'comment')?'comment-error-'+line.id:null" (keydown.enter)="saveLine(line)">@if(lineErrorFor(line.id,'comment')){<span class="field-error" [id]="'comment-error-'+line.id" role="alert">{{lineErrorFor(line.id,'comment')}}</span>}</div>}@else { {{line.comment||'—'}} }</td>
                <td>@if(current.status==='in_progress'){<button mat-button [disabled]="lineForm(line.id).invalid || busy() !== null" (click)="saveLine(line)">{{busy()===lineBusy(line)?'Enregistrement…':'Enregistrer'}}</button>}</td></tr>
            }
            @empty{@if(linesLoaded()){<tr><td colspan="9" class="empty-state"><span role="status">Cette session ne contient aucune ligne à compter.</span></td></tr>}}
          </tbody></table>
        </mat-card>
      }
    </div>
  `,
  styles: `.heading{margin-bottom:18px}h1{margin:0;font-size:28px}p{color:#687278}.create,mat-card{padding:18px}.create{display:flex;gap:10px;align-items:center;margin-bottom:18px;flex-wrap:wrap}.create button,.detail-head button{background:#123a4a;color:white}.form-error,.field-error{color:#8a1f1f}.form-error{margin:0 18px}.field-error{display:block;font-size:12px;white-space:normal}.grid{display:grid;grid-template-columns:1fr 2fr;gap:18px;margin-top:18px}h2{margin-top:0;font-size:18px}.detail-head{display:flex;justify-content:space-between;gap:12px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 7px;border-bottom:1px solid #e6e8e9;vertical-align:top}input{width:86px;padding:6px}.wide{width:150px}.cell-field{min-width:100px}@media(max-width:850px){.grid{grid-template-columns:1fr}table{display:block;overflow-x:auto;white-space:nowrap}}`,
})
export class InventoryComponent {
  private api = inject(ApiService);
  private confirmation = inject(ConfirmationService);
  private fb = inject(FormBuilder);
  private host = inject(ElementRef<HTMLElement>);
  private readonly lineForms = new Map<number, InventoryLineForm>();
  readonly sessions = signal<InventorySession[]>([]);
  readonly locations = signal<LocationOption[]>([]);
  readonly session = signal<InventorySession | null>(null);
  readonly sessionsLoaded = signal(false);
  readonly linesLoaded = signal(false);
  readonly busy = signal<string | null>(null);
  readonly formError = signal('');
  readonly statusLabels: Record<string, string> = { in_progress: 'En cours', validated: 'Validé', cancelled: 'Annulé' };
  readonly sessionForm = this.fb.group({
    name: this.fb.nonNullable.control('', [trimmedRequired, Validators.maxLength(255)]),
    location_id: this.fb.control<number | null>(null),
  });

  constructor() {
    this.load();
    this.api.get<Page<LocationOption>>('settings/locations').subscribe(response => this.locations.set(response.data));
  }

  load() {
    this.sessionsLoaded.set(false);
    this.api.get<Page<InventorySession>>('inventory-sessions').pipe(finalize(() => this.sessionsLoaded.set(true))).subscribe(response => this.sessions.set(response.data));
  }

  create() {
    this.sessionForm.controls.name.setValue(this.sessionForm.controls.name.value.trim());
    this.sessionForm.markAllAsTouched();
    if (this.sessionForm.invalid || this.busy()) { this.focusFirstInvalid(); return; }
    this.busy.set('create');
    this.formError.set('');
    const value = this.sessionForm.getRawValue();
    this.api.post<InventorySession>('inventory-sessions', { name: value.name.trim(), location_id: value.location_id }).pipe(finalize(() => this.busy.set(null))).subscribe({
      next: session => {
        this.sessionForm.reset({ name: '', location_id: null });
        this.api.success('Inventaire créé.');
        this.load();
        this.open(session.id);
      },
      error: error => this.applyFormError(this.sessionForm, error),
    });
  }

  open(id: number) {
    this.linesLoaded.set(false);
    this.formError.set('');
    this.api.get<InventorySession>('inventory-sessions/' + id).subscribe(session => {
      this.api.get<Page<InventoryLine>>(`inventory-sessions/${id}/lines`).pipe(finalize(() => this.linesLoaded.set(true))).subscribe(lines => {
        this.lineForms.clear();
        lines.data.forEach(line => this.lineForms.set(line.id, this.createLineForm(line)));
        this.session.set({ ...session, lines: lines.data });
      });
    });
  }

  saveLine(line: InventoryLine) {
    const current = this.session();
    const form = this.lineForm(line.id);
    form.patchValue({
      physical_quantity: form.controls.physical_quantity.value.trim(),
      reason: form.controls.reason.value.trim(),
      comment: form.controls.comment.value.trim(),
    });
    form.markAllAsTouched();
    if (!current || form.invalid || this.busy()) { this.focusFirstInvalid(line.id); return; }
    this.busy.set(this.lineBusy(line));
    this.formError.set('');
    const value = form.getRawValue();
    this.api.patch<InventoryLine>(`inventory-sessions/${current.id}/lines/${line.id}`, {
      physical_quantity: value.physical_quantity.trim(),
      reason: value.reason.trim() || null,
      comment: value.comment.trim() || null,
    }).pipe(finalize(() => this.busy.set(null))).subscribe({
      next: () => {
        this.api.success('Ligne d’inventaire enregistrée.');
        this.open(current.id);
      },
      error: error => this.applyFormError(form, error, line.id),
    });
  }

  validate() {
    const current = this.session();
    if (!current || !this.canValidate() || this.busy()) return;
    this.busy.set('confirm');
    this.confirmation.confirm({
      title: 'Valider l’inventaire ?',
      message: `La session « ${current.name} » sera clôturée et les écarts créeront des mouvements d’ajustement. Cette action est irréversible.`,
      confirmLabel: 'Valider l’inventaire',
    }).subscribe(confirmed => {
      if (!confirmed) { this.busy.set(null); return; }
      this.busy.set('validate');
      this.formError.set('');
      this.api.post<InventorySession>(`inventory-sessions/${current.id}/validate`, {}).pipe(finalize(() => this.busy.set(null))).subscribe({
        next: () => {
          this.api.success('Inventaire validé.');
          this.load();
          this.open(current.id);
        },
        error: error => this.applyFormError(this.firstUncountedForm() ?? this.sessionForm, error),
      });
    });
  }

  lineForm(id: number): InventoryLineForm { return this.lineForms.get(id)!; }
  lineBusy(line: InventoryLine) { return `line-${line.id}`; }

  canValidate() {
    return this.lineForms.size > 0 && [...this.lineForms.values()].every(form => form.valid && !!form.controls.physical_quantity.value);
  }

  previewVariance(line: InventoryLine): string {
    const value = this.lineForms.get(line.id)?.controls.physical_quantity.value;
    if (!value || !quantityPattern.test(value)) return line.variance || '—';
    return (Number(value) - Number(line.theoretical_quantity)).toFixed(3);
  }

  sessionErrorFor(name: keyof typeof this.sessionForm.controls) {
    const control = this.sessionForm.controls[name];
    if (!control.touched || !control.errors) return '';
    if (control.errors['backend']) return String(control.errors['backend']);
    if (control.errors['required']) return 'Champ obligatoire.';
    if (control.errors['maxlength']) return 'La longueur maximale est de 255 caractères.';
    return 'Valeur invalide.';
  }

  lineErrorFor(id: number, name: keyof InventoryLineForm['controls']) {
    const form = this.lineForm(id);
    const control = form.controls[name];
    if (!control.touched) return '';
    if (control.errors?.['backend']) return String(control.errors['backend']);
    if (name === 'reason' && form.hasError('reasonRequired')) return 'Un motif est obligatoire lorsque la quantité diffère.';
    if (control.errors?.['required']) return 'Champ obligatoire.';
    if (control.errors?.['min']) return 'La quantité ne peut pas être négative.';
    if (control.errors?.['pattern']) return 'Saisissez un nombre avec au maximum 3 décimales.';
    if (control.errors?.['max']) return 'La quantité dépasse la limite autorisée.';
    if (control.errors?.['maxlength']) return `La longueur maximale est de ${control.errors['maxlength'].requiredLength} caractères.`;
    return control.errors ? 'Valeur invalide.' : '';
  }

  private createLineForm(line: InventoryLine): InventoryLineForm {
    return this.fb.group({
      physical_quantity: this.fb.nonNullable.control(line.physical_quantity ?? '', [Validators.required, Validators.pattern(quantityPattern), Validators.min(0), Validators.max(99999999999.999)]),
      reason: this.fb.nonNullable.control(line.reason ?? '', Validators.maxLength(255)),
      comment: this.fb.nonNullable.control(line.comment ?? '', Validators.maxLength(5000)),
    }, { validators: reasonForVariance(line.theoretical_quantity) });
  }

  private firstUncountedForm() {
    return [...this.lineForms.values()].find(form => !form.controls.physical_quantity.value);
  }

  private applyFormError(form: FormGroup, error: unknown, lineId?: number) {
    this.api.error.set('');
    this.formError.set(applyBackendValidation(form, error));
    this.focusFirstInvalid(lineId);
  }

  private focusFirstInvalid(lineId?: number) {
    queueMicrotask(() => {
      const root = this.host.nativeElement as HTMLElement;
      const scope = lineId === undefined ? root : root.querySelector(`[data-line-id="${lineId}"]`);
      (scope?.querySelector('.ng-invalid[formControlName]') as HTMLElement | null)?.focus();
    });
  }
}

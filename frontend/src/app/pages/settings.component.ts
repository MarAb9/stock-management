import { Component, ElementRef, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs';
import { ApiService, Page, applyBackendValidation } from '../core/api.service';

type ReferenceType = 'categories' | 'units' | 'locations' | 'suppliers';
type ReferenceRow = { id: number; name: string; code?: string | null; symbol?: string | null; company?: string | null; active: boolean };
type ReferencePayload = {
  name: string;
  active: boolean;
  code?: string;
  symbol?: string;
  parent_id?: number | null;
  notes?: string | null;
  company?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  ice?: string | null;
};

const trimmedRequired: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  String(control.value ?? '').trim() ? null : { required: true };
const nullableTrimmed = (value: string) => value.trim() || null;

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule],
  template: `
    <section class="heading"><h1>Référentiels</h1><p>Catégories, unités, fournisseurs et emplacements.</p></section><mat-card>
      <div class="type-picker"><mat-form-field><mat-label>Type</mat-label><mat-select [value]="type" (selectionChange)="changeType($event.value)"><mat-option value="categories">Catégories</mat-option><mat-option value="units">Unités</mat-option><mat-option value="locations">Emplacements</mat-option><mat-option value="suppliers">Fournisseurs</mat-option></mat-select></mat-form-field></div>
      @if(formError()){<p class="form-error" role="alert">{{formError()}}</p>}
      <form class="bar" [formGroup]="form" (ngSubmit)="save()">
        <mat-form-field><mat-label>Nom</mat-label><input matInput formControlName="name" required [attr.maxlength]="nameMaxLength()">@if(errorFor('name')){<mat-error>{{errorFor('name')}}</mat-error>}</mat-form-field>
        @if(type==='units'){
          <mat-form-field><mat-label>Symbole</mat-label><input matInput formControlName="symbol" required maxlength="16">@if(errorFor('symbol')){<mat-error>{{errorFor('symbol')}}</mat-error>}</mat-form-field>
        } @else if(type!=='suppliers'){
          <mat-form-field><mat-label>Code</mat-label><input matInput formControlName="code" required maxlength="50">@if(errorFor('code')){<mat-error>{{errorFor('code')}}</mat-error>}</mat-form-field>
        }
        @if(hasParent()){<mat-form-field><mat-label>Parent</mat-label><mat-select formControlName="parent_id"><mat-option [value]="null">Aucun parent</mat-option>@for(item of rows();track item.id){<mat-option [value]="item.id">{{item.name}}</mat-option>}</mat-select>@if(errorFor('parent_id')){<mat-error>{{errorFor('parent_id')}}</mat-error>}</mat-form-field>}
        @if(type==='locations'){<mat-form-field class="wide"><mat-label>Notes</mat-label><textarea matInput rows="2" maxlength="5000" formControlName="notes"></textarea>@if(errorFor('notes')){<mat-error>{{errorFor('notes')}}</mat-error>}</mat-form-field>}
        @if(type==='suppliers'){
          <mat-form-field><mat-label>Société</mat-label><input matInput maxlength="255" formControlName="company">@if(errorFor('company')){<mat-error>{{errorFor('company')}}</mat-error>}</mat-form-field>
          <mat-form-field><mat-label>Contact</mat-label><input matInput maxlength="255" formControlName="contact_name">@if(errorFor('contact_name')){<mat-error>{{errorFor('contact_name')}}</mat-error>}</mat-form-field>
          <mat-form-field><mat-label>Téléphone</mat-label><input matInput maxlength="40" formControlName="phone">@if(errorFor('phone')){<mat-error>{{errorFor('phone')}}</mat-error>}</mat-form-field>
          <mat-form-field><mat-label>Email</mat-label><input matInput type="email" maxlength="255" formControlName="email">@if(errorFor('email')){<mat-error>{{errorFor('email')}}</mat-error>}</mat-form-field>
          <mat-form-field><mat-label>ICE</mat-label><input matInput maxlength="64" formControlName="ice">@if(errorFor('ice')){<mat-error>{{errorFor('ice')}}</mat-error>}</mat-form-field>
          <mat-form-field class="wide"><mat-label>Adresse</mat-label><textarea matInput rows="2" maxlength="2000" formControlName="address"></textarea>@if(errorFor('address')){<mat-error>{{errorFor('address')}}</mat-error>}</mat-form-field>
          <mat-form-field class="wide"><mat-label>Notes</mat-label><textarea matInput rows="2" maxlength="5000" formControlName="notes"></textarea>@if(errorFor('notes')){<mat-error>{{errorFor('notes')}}</mat-error>}</mat-form-field>
        }
        <mat-slide-toggle formControlName="active">Actif</mat-slide-toggle>
        <button mat-flat-button type="submit" [disabled]="form.invalid || saving()">{{saving()?'Ajout…':'Ajouter'}}</button>
      </form>
      <table><thead><tr><th>Nom</th><th>{{type==='units'?'Symbole':type==='suppliers'?'Société':'Code'}}</th><th>Actif</th></tr></thead><tbody>
        @for(item of rows();track item.id){<tr><td>{{item.name}}</td><td>{{item.symbol||item.code||item.company||'—'}}</td><td>{{item.active?'Oui':'Non'}}</td></tr>}
        @empty{@if(loaded()){<tr><td colspan="3" class="empty-state"><span role="status">{{emptyLabel()}}</span></td></tr>}}
      </tbody></table>
    </mat-card>
  `,
  styles: `h1{margin:0;font-size:28px}p{color:#687278}.heading{margin-bottom:18px}mat-card{padding:18px}.type-picker{margin-bottom:10px}.bar{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:10px;align-items:center}.wide{grid-column:span 2}.bar button{background:#123a4a;color:white;min-height:40px}.form-error{color:#8a1f1f}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{text-align:left;padding:11px 8px;border-bottom:1px solid #e6e8e9}@media(max-width:800px){.bar{grid-template-columns:1fr}.wide{grid-column:auto}}`,
})
export class SettingsComponent {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  private host = inject(ElementRef<HTMLElement>);
  readonly rows = signal<ReferenceRow[]>([]);
  readonly loaded = signal(false);
  readonly saving = signal(false);
  readonly formError = signal('');
  type: ReferenceType = 'categories';
  readonly form = this.fb.group({
    name: this.fb.nonNullable.control(''),
    code: this.fb.nonNullable.control(''),
    symbol: this.fb.nonNullable.control(''),
    parent_id: this.fb.control<number | null>(null),
    notes: this.fb.nonNullable.control(''),
    company: this.fb.nonNullable.control(''),
    contact_name: this.fb.nonNullable.control(''),
    phone: this.fb.nonNullable.control(''),
    email: this.fb.nonNullable.control(''),
    address: this.fb.nonNullable.control(''),
    ice: this.fb.nonNullable.control(''),
    active: this.fb.nonNullable.control(true),
  });

  constructor() { this.configureValidators(); this.load(); }
  hasParent() { return this.type === 'categories' || this.type === 'locations'; }

  changeType(type: ReferenceType) {
    this.type = type;
    this.resetForm();
    this.configureValidators();
    this.formError.set('');
    this.load();
  }

  load() {
    this.loaded.set(false);
    this.api.get<Page<ReferenceRow>>('settings/' + this.type).pipe(finalize(() => this.loaded.set(true))).subscribe(response => this.rows.set(response.data));
  }

  save() {
    this.normalizeForm();
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) { this.focusFirstInvalid(); return; }
    this.saving.set(true);
    this.formError.set('');
    this.api.post('settings/' + this.type, this.payload()).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.resetForm();
        this.configureValidators();
        this.api.success('Référentiel ajouté.');
        this.load();
      },
      error: error => {
        this.api.error.set('');
        this.formError.set(applyBackendValidation(this.form, error));
        this.focusFirstInvalid();
      },
    });
  }

  nameMaxLength() { return this.type === 'suppliers' ? 255 : 100; }

  errorFor(name: keyof typeof this.form.controls) {
    const control = this.form.controls[name];
    if (!control.touched || !control.errors) return '';
    if (control.errors['backend']) return String(control.errors['backend']);
    if (control.errors['required']) return 'Champ obligatoire.';
    if (control.errors['email']) return 'Saisissez une adresse email valide.';
    if (control.errors['maxlength']) return `La longueur maximale est de ${control.errors['maxlength'].requiredLength} caractères.`;
    return 'Valeur invalide.';
  }

  emptyLabel() {
    return ({ categories: 'Aucune catégorie enregistrée.', units: 'Aucune unité enregistrée.', locations: 'Aucun emplacement enregistré.', suppliers: 'Aucun fournisseur enregistré.' } as Record<ReferenceType, string>)[this.type];
  }

  private configureValidators() {
    Object.values(this.form.controls).forEach(control => control.clearValidators());
    this.form.controls.name.setValidators([trimmedRequired, Validators.maxLength(this.nameMaxLength())]);
    if (this.type === 'units') this.form.controls.symbol.setValidators([trimmedRequired, Validators.maxLength(16)]);
    if (this.type === 'categories' || this.type === 'locations') this.form.controls.code.setValidators([trimmedRequired, Validators.maxLength(50)]);
    if (this.type === 'locations') this.form.controls.notes.setValidators(Validators.maxLength(5000));
    if (this.type === 'suppliers') {
      this.form.controls.company.setValidators(Validators.maxLength(255));
      this.form.controls.contact_name.setValidators(Validators.maxLength(255));
      this.form.controls.phone.setValidators(Validators.maxLength(40));
      this.form.controls.email.setValidators([Validators.email, Validators.maxLength(255)]);
      this.form.controls.address.setValidators(Validators.maxLength(2000));
      this.form.controls.ice.setValidators(Validators.maxLength(64));
      this.form.controls.notes.setValidators(Validators.maxLength(5000));
    }
    Object.values(this.form.controls).forEach(control => control.updateValueAndValidity({ emitEvent: false }));
  }

  private payload(): ReferencePayload {
    const value = this.form.getRawValue();
    const payload: ReferencePayload = { name: value.name.trim(), active: value.active };
    if (this.type === 'units') payload.symbol = value.symbol.trim();
    if (this.type === 'categories') Object.assign(payload, { code: value.code.trim(), parent_id: value.parent_id });
    if (this.type === 'locations') Object.assign(payload, { code: value.code.trim(), parent_id: value.parent_id, notes: nullableTrimmed(value.notes) });
    if (this.type === 'suppliers') Object.assign(payload, {
      company: nullableTrimmed(value.company),
      contact_name: nullableTrimmed(value.contact_name),
      phone: nullableTrimmed(value.phone),
      email: nullableTrimmed(value.email),
      address: nullableTrimmed(value.address),
      ice: nullableTrimmed(value.ice),
      notes: nullableTrimmed(value.notes),
    });
    return payload;
  }

  private resetForm() {
    this.form.reset({ name: '', code: '', symbol: '', parent_id: null, notes: '', company: '', contact_name: '', phone: '', email: '', address: '', ice: '', active: true });
  }

  private normalizeForm() {
    Object.values(this.form.controls).forEach(control => {
      if (typeof control.value === 'string') control.setValue(control.value.trim(), { emitEvent: false });
    });
    this.form.updateValueAndValidity();
  }

  private focusFirstInvalid() {
    queueMicrotask(() => ((this.host.nativeElement as HTMLElement).querySelector('.ng-invalid[formControlName]') as HTMLElement | null)?.focus());
  }
}

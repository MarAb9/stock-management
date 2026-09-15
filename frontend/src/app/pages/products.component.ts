import { Component, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { finalize } from 'rxjs';
import { ApiService, applyBackendValidation } from '../core/api.service';

@Component({
  standalone: true,
  imports: [FormsModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatSlideToggleModule],
  template: `
    <section class="heading">
      <div><h1>Produits</h1><p>Fournitures, consommables et denrées.</p></div>
      <button mat-stroked-button (click)="formOpen.set(!formOpen())">{{ formOpen() ? 'Fermer' : 'Ajouter un produit' }}</button>
    </section>
    @if (formOpen()) {
      <mat-card class="form-card">
        @if (formError()) { <p class="form-error" role="alert">{{ formError() }}</p> }
        <form [formGroup]="form" (ngSubmit)="save()">
          <mat-form-field><mat-label>Référence</mat-label><input matInput formControlName="reference">@if(errorFor('reference')){<mat-error>{{errorFor('reference')}}</mat-error>}</mat-form-field>
          <mat-form-field><mat-label>Désignation</mat-label><input matInput formControlName="name">@if(errorFor('name')){<mat-error>{{errorFor('name')}}</mat-error>}</mat-form-field>
          <mat-form-field><mat-label>Unité</mat-label><mat-select formControlName="unit_id">@for(x of units();track x.id){<mat-option [value]="x.id">{{x.name}}</mat-option>}</mat-select>@if(errorFor('unit_id')){<mat-error>{{errorFor('unit_id')}}</mat-error>}</mat-form-field>
          <mat-form-field><mat-label>Catégorie</mat-label><mat-select formControlName="category_id"><mat-option [value]="null">Aucune</mat-option>@for(x of categories();track x.id){<mat-option [value]="x.id">{{x.name}}</mat-option>}</mat-select>@if(errorFor('category_id')){<mat-error>{{errorFor('category_id')}}</mat-error>}</mat-form-field>
          <mat-form-field><mat-label>Seuil minimum</mat-label><input matInput type="number" formControlName="minimum_stock">@if(errorFor('minimum_stock')){<mat-error>{{errorFor('minimum_stock')}}</mat-error>}</mat-form-field>
          <mat-form-field><mat-label>Prix d’achat (MAD)</mat-label><input matInput type="number" formControlName="purchase_price">@if(errorFor('purchase_price')){<mat-error>{{errorFor('purchase_price')}}</mat-error>}</mat-form-field>
          <mat-slide-toggle formControlName="track_lots">Gestion par lots</mat-slide-toggle>
          <button mat-flat-button type="submit" [disabled]="form.invalid || saving()">{{ saving() ? 'Enregistrement…' : 'Enregistrer' }}</button>
        </form>
      </mat-card>
    }
    <mat-card class="list">
      <div class="tools"><mat-form-field><mat-label>Rechercher</mat-label><input matInput [(ngModel)]="search" (keyup.enter)="load()"></mat-form-field><button mat-button (click)="load()">Rechercher</button></div>
      <table><thead><tr><th>Référence</th><th>Désignation</th><th>Catégorie</th><th>Stock</th><th>Seuil</th></tr></thead><tbody>
        @for (product of products(); track product.id) {
          <tr><td>{{product.reference}}</td><td>{{product.name}}</td><td>{{product.category?.name || '—'}}</td><td>{{product.stock_quantity || 0}} {{product.unit?.symbol}}</td><td>{{product.minimum_stock}}</td></tr>
        } @empty {
          @if (loaded()) {
            <tr><td colspan="5" class="empty-state"><span role="status">{{ appliedSearch() ? 'Aucun résultat ne correspond à votre recherche.' : 'Aucun produit n’a encore été enregistré.' }}</span>@if(appliedSearch()){<button mat-button (click)="clearSearch()">Effacer la recherche</button>}@else{<button mat-button (click)="formOpen.set(true)">Ajouter un produit</button>}</td></tr>
          }
        }
      </tbody></table>
    </mat-card>
  `,
  styles: `.heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}h1{margin:0;font-size:28px}p{color:#687278;margin:5px 0}.form-card,.list{padding:18px;margin-bottom:18px}form{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;align-items:center}.form-card button{background:#123a4a;color:white}.form-error{grid-column:1/-1;color:#8a1f1f}.tools{display:flex;align-items:center;gap:8px}.tools mat-form-field{width:280px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:11px 8px;border-bottom:1px solid #e6e8e9}@media(max-width:700px){form{grid-template-columns:1fr}.tools mat-form-field{width:100%}}`,
})
export class ProductsComponent {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  readonly products = signal<any[]>([]);
  readonly categories = signal<any[]>([]);
  readonly units = signal<any[]>([]);
  readonly formOpen = signal(false);
  readonly loaded = signal(false);
  readonly saving = signal(false);
  readonly appliedSearch = signal('');
  readonly formError = signal('');
  search = '';
  readonly form = this.fb.group({ reference: ['', Validators.required], name: ['', Validators.required], unit_id: [null, Validators.required], category_id: [null], minimum_stock: [0, Validators.min(0)], purchase_price: [null], track_lots: [false], active: [true] });

  constructor() {
    this.load();
    this.api.get<any>('settings/categories').subscribe(response => this.categories.set(response.data));
    this.api.get<any>('settings/units').subscribe(response => this.units.set(response.data));
  }

  load() {
    this.loaded.set(false);
    this.appliedSearch.set(this.search.trim());
    this.api.get<any>('products', { search: this.appliedSearch() }).pipe(finalize(() => this.loaded.set(true))).subscribe(response => this.products.set(response.data));
  }

  clearSearch() {
    this.search = '';
    this.load();
  }

  save() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.formError.set('');
    this.api.post('products', this.form.getRawValue()).pipe(finalize(() => this.saving.set(false))).subscribe({
      next: () => {
        this.form.reset({ minimum_stock: 0, track_lots: false, active: true });
        this.formOpen.set(false);
        this.api.success('Produit enregistré.');
        this.load();
      },
      error: error => this.formError.set(applyBackendValidation(this.form, error)),
    });
  }

  errorFor(name: keyof typeof this.form.controls) {
    const control = this.form.controls[name];
    if (!control.touched || !control.errors) return '';
    if (control.errors['backend']) return String(control.errors['backend']);
    if (control.errors['required']) return 'Champ obligatoire.';
    if (control.errors['min']) return 'La valeur ne peut pas être négative.';
    return 'Valeur invalide.';
  }
}

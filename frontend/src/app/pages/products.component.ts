import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { finalize, forkJoin } from 'rxjs';
import { ApiService, Page, apiErrorMessage } from '../core/api.service';
import { ConfirmationService } from '../core/confirmation.service';

type ReferenceOption = { id: number; name: string };
type ProductListItem = {
  id: number;
  reference: string;
  name: string;
  minimum_stock: string;
  stock_quantity: string;
  active: boolean;
  category?: { name: string; parent?: { name: string } | null } | null;
  unit?: { symbol: string } | null;
};
type StockFilter = '' | 'available' | 'low' | 'out';
type ActiveFilter = '' | 'true' | 'false';
type ProductFilters = { search: string; category_id: number | null; supplier_id: number | null; stock: StockFilter; active: ActiveFilter };

function serverMessage(error: unknown) {
  const message = (error as HttpErrorResponse)?.error?.message;
  return typeof message === 'string' && message.trim() ? message : apiErrorMessage(error);
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatMenuModule, MatSelectModule],
  template: `
    <section class="heading">
      <div><h1>Produits</h1><p>Catalogue, niveaux de stock et cycle de vie.</p></div>
      <a mat-flat-button routerLink="/produits/nouveau">Ajouter un produit</a>
    </section>

    <mat-card class="filters">
      <form [formGroup]="filters" (ngSubmit)="applyFilters()">
        <mat-form-field><mat-label>Rechercher</mat-label><input matInput formControlName="search" placeholder="Référence, désignation ou code-barres"></mat-form-field>
        <mat-form-field><mat-label>Catégorie</mat-label><mat-select formControlName="category_id"><mat-option [value]="null">Toutes</mat-option>@for(item of categories();track item.id){<mat-option [value]="item.id">{{item.name}}</mat-option>}</mat-select></mat-form-field>
        <mat-form-field><mat-label>Fournisseur</mat-label><mat-select formControlName="supplier_id"><mat-option [value]="null">Tous</mat-option>@for(item of suppliers();track item.id){<mat-option [value]="item.id">{{item.name}}</mat-option>}</mat-select></mat-form-field>
        <mat-form-field><mat-label>Stock</mat-label><mat-select formControlName="stock"><mat-option value="">Tous</mat-option><mat-option value="available">Disponible</mat-option><mat-option value="low">Stock faible</mat-option><mat-option value="out">Rupture</mat-option></mat-select></mat-form-field>
        <mat-form-field><mat-label>État</mat-label><mat-select formControlName="active"><mat-option value="">Tous</mat-option><mat-option value="true">Actifs</mat-option><mat-option value="false">Inactifs</mat-option></mat-select></mat-form-field>
        <div class="filter-actions"><button mat-flat-button type="submit" [disabled]="loading()">Filtrer</button>@if(hasAppliedFilters()){<button mat-button type="button" (click)="resetFilters()" [disabled]="loading()">Effacer les filtres</button>}</div>
      </form>
    </mat-card>

    @if(actionError()){<p class="form-error" role="alert">{{actionError()}}</p>}
    <mat-card class="list">
      <div class="list-head"><h2>Catalogue</h2><span>{{page().total}} produit{{page().total>1?'s':''}}</span></div>
      @if(loading()){<p role="status" aria-live="polite">Chargement des produits…</p>}
      <div class="table-wrap"><table><thead><tr><th>Référence</th><th>Désignation</th><th>Catégorie</th><th>Unité</th><th>Stock</th><th>Seuil min.</th><th>État</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>
        @for(product of page().data;track product.id){
          <tr><td class="reference">{{product.reference}}</td><td><a [routerLink]="['/produits',product.id]">{{product.name}}</a></td><td>{{categoryLabel(product)}}</td><td>{{product.unit?.symbol||'—'}}</td><td class="quantity"><span class="stock-badge" [class]="'stock-badge '+stockState(product)">{{stockLabel(product)}} · {{product.stock_quantity}}</span></td><td class="quantity">{{product.minimum_stock}}</td><td><span class="state-badge" [class.inactive]="!product.active">{{product.active?'Actif':'Inactif'}}</span></td><td>
            <button class="actions-trigger" mat-button [matMenuTriggerFor]="actions" [attr.aria-label]="'Actions pour '+product.name">Actions</button>
            <mat-menu #actions="matMenu"><a mat-menu-item [routerLink]="['/produits',product.id]">Consulter</a><a mat-menu-item [routerLink]="['/produits',product.id]" [queryParams]="{edit:'true'}">Modifier</a><button mat-menu-item (click)="archive(product)" [disabled]="archiving()===product.id">Archiver</button></mat-menu>
          </td></tr>
        } @empty {
          @if(loaded()&&!loading()){<tr><td colspan="8" class="empty-state"><span role="status">{{hasAppliedFilters()?'Aucun produit ne correspond aux filtres sélectionnés.':'Aucun produit n’a encore été enregistré.'}}</span>@if(hasAppliedFilters()){<button mat-button (click)="resetFilters()">Effacer les filtres</button>}@else{<a mat-button routerLink="/produits/nouveau">Ajouter un produit</a>}</td></tr>}
        }
      </tbody></table></div>
      @if(page().last_page>1){<nav class="pagination" aria-label="Pagination des produits"><button mat-button (click)="goToPage(page().current_page-1)" [disabled]="loading()||page().current_page===1">Précédent</button><span>Page {{page().current_page}} sur {{page().last_page}}</span><button mat-button (click)="goToPage(page().current_page+1)" [disabled]="loading()||page().current_page===page().last_page">Suivant</button></nav>}
    </mat-card>
  `,
  styles: `.heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:18px}.heading a,.filter-actions button:first-child{background:#123a4a;color:white}h1{margin:0;font-size:28px;text-wrap:balance}h2{margin:0;font-size:18px}p{color:#687278;margin:5px 0;text-wrap:pretty}.filters,.list{padding:18px;margin-bottom:18px}.filters form{display:grid;grid-template-columns:2fr repeat(4,minmax(145px,1fr));gap:10px;align-items:center}.filter-actions{display:flex;gap:8px;grid-column:1/-1}.form-error{color:#8a1f1f}.list-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}.list-head span{color:#687278}.table-wrap{overflow-x:auto}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:11px 8px;border-bottom:1px solid #e6e8e9;white-space:nowrap}th{font-size:12px;color:#687278;text-transform:uppercase;letter-spacing:.03em}.reference,.quantity{font-variant-numeric:tabular-nums}.stock-badge,.state-badge{display:inline-block;padding:3px 8px;border-radius:999px;background:#e8f3ee;color:#245c40;font-size:12px;font-weight:600}.stock-badge.low{background:#fff1cc;color:#765600}.stock-badge.out,.state-badge.inactive{background:#f6e3e3;color:#8a1f1f}.pagination{display:flex;justify-content:flex-end;align-items:center;gap:10px;padding-top:14px}.actions-trigger{min-width:44px}.actions-trigger:focus-visible,a:focus-visible,button:focus-visible{outline:3px solid #2d7089;outline-offset:2px}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}@media(max-width:1000px){.filters form{grid-template-columns:repeat(2,1fr)}}@media(max-width:650px){.heading{align-items:flex-start;flex-direction:column}.filters form{grid-template-columns:1fr}.filter-actions{grid-column:auto}}`,
})
export class ProductsComponent {
  private api = inject(ApiService);
  private confirmation = inject(ConfirmationService);
  private fb = inject(FormBuilder);
  readonly categories = signal<ReferenceOption[]>([]);
  readonly suppliers = signal<ReferenceOption[]>([]);
  readonly page = signal<Page<ProductListItem>>({ data: [], total: 0, current_page: 1, last_page: 1 });
  readonly loaded = signal(false);
  readonly loading = signal(false);
  readonly archiving = signal<number | null>(null);
  readonly actionError = signal('');
  readonly appliedFilters = signal<ProductFilters>({ search: '', category_id: null, supplier_id: null, stock: '', active: '' });
  readonly filters = this.fb.group({
    search: this.fb.nonNullable.control(''),
    category_id: this.fb.control<number | null>(null),
    supplier_id: this.fb.control<number | null>(null),
    stock: this.fb.nonNullable.control<StockFilter>(''),
    active: this.fb.nonNullable.control<ActiveFilter>(''),
  });

  constructor() {
    forkJoin({
      categories: this.api.get<Page<ReferenceOption>>('settings/categories', { per_page: 100 }),
      suppliers: this.api.get<Page<ReferenceOption>>('settings/suppliers', { per_page: 100 }),
    }).subscribe(({ categories, suppliers }) => { this.categories.set(categories.data); this.suppliers.set(suppliers.data); });
    this.load();
  }

  applyFilters() {
    const value = this.filters.getRawValue();
    this.appliedFilters.set({ ...value, search: value.search.trim() });
    this.load(1);
  }

  resetFilters() {
    this.filters.reset({ search: '', category_id: null, supplier_id: null, stock: '', active: '' });
    this.appliedFilters.set(this.filters.getRawValue());
    this.load(1);
  }

  load(page = 1) {
    this.loading.set(true);
    this.actionError.set('');
    this.api.get<Page<ProductListItem>>('products', this.filterParams(page)).pipe(finalize(() => { this.loading.set(false); this.loaded.set(true); })).subscribe(response => this.page.set(response));
  }

  goToPage(page: number) {
    if (page < 1 || page > this.page().last_page || this.loading()) return;
    this.load(page);
  }

  hasAppliedFilters() {
    const value = this.appliedFilters();
    return !!(value.search || value.category_id || value.supplier_id || value.stock || value.active);
  }

  categoryLabel(product: ProductListItem) {
    if (!product.category) return '—';
    return product.category.parent ? `${product.category.parent.name} / ${product.category.name}` : product.category.name;
  }

  stockState(product: ProductListItem) {
    const stock = Number(product.stock_quantity);
    if (stock === 0) return 'out';
    return stock <= Number(product.minimum_stock) ? 'low' : 'available';
  }

  stockLabel(product: ProductListItem) {
    return ({ available: 'Disponible', low: 'Faible', out: 'Rupture' } as const)[this.stockState(product)];
  }

  archive(product: ProductListItem) {
    if (this.archiving()) return;
    this.confirmation.confirm({
      title: 'Archiver ce produit ?',
      message: `« ${product.name} » ne sera plus disponible pour les opérations courantes. Son historique sera conservé.`,
      confirmLabel: 'Archiver',
    }).subscribe(confirmed => {
      if (!confirmed) return;
      this.archiving.set(product.id);
      this.actionError.set('');
      this.api.delete(`products/${product.id}`).pipe(finalize(() => this.archiving.set(null))).subscribe({
        next: () => {
          this.api.success('Produit archivé.');
          this.load(this.page().data.length === 1 && this.page().current_page > 1 ? this.page().current_page - 1 : this.page().current_page);
        },
        error: error => { this.api.error.set(''); this.actionError.set(serverMessage(error)); },
      });
    });
  }

  private filterParams(page: number) {
    const value = this.appliedFilters();
    const params: Record<string, string | number | boolean> = { page, per_page: 20 };
    if (value.search) params['search'] = value.search;
    if (value.category_id) params['category_id'] = value.category_id;
    if (value.supplier_id) params['supplier_id'] = value.supplier_id;
    if (value.stock) params['stock'] = value.stock;
    if (value.active) params['active'] = value.active === 'true';
    return params;
  }
}

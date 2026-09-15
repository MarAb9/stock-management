import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiService } from '../core/api.service';
import { ConfirmationService } from '../core/confirmation.service';
import { ProductsComponent } from './products.component';

const product = { id: 1, reference: 'P-001', name: 'Papier', minimum_stock: '2.000', stock_quantity: '5.000', active: true, unit: { symbol: 'pce' }, category: { name: 'Papeterie', parent: null } };

class ApiStub {
  readonly error = signal('Erreur globale.');
  readonly calls: { path: string; params?: Record<string, string | number | boolean> }[] = [];
  readonly deletes: string[] = [];
  readonly notices: string[] = [];
  productPage = { data: [product], total: 1, current_page: 1, last_page: 1 };
  deleteError: HttpErrorResponse | null = null;

  get(path: string, params?: Record<string, string | number | boolean>) {
    this.calls.push({ path, params });
    if (path === 'products') return of(this.productPage);
    return of({ data: [], total: 0, current_page: 1, last_page: 1 });
  }

  delete(path: string) {
    this.deletes.push(path);
    return this.deleteError ? throwError(() => this.deleteError) : of({});
  }

  success(message: string) { this.notices.push(message); }
}

class ConfirmationStub {
  confirmed = true;
  confirm() { return of(this.confirmed); }
}

async function setup(api = new ApiStub(), confirmation = new ConfirmationStub()) {
  await TestBed.configureTestingModule({
    imports: [ProductsComponent],
    providers: [provideNoopAnimations(), provideRouter([]), { provide: ApiService, useValue: api }, { provide: ConfirmationService, useValue: confirmation }],
  }).compileComponents();
  const fixture = TestBed.createComponent(ProductsComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, component: fixture.componentInstance, api, confirmation };
}

function text(fixture: ComponentFixture<ProductsComponent>) {
  fixture.detectChanges();
  return fixture.nativeElement.textContent as string;
}

describe('ProductsComponent', () => {
  it('sends the supported filters to the server', async () => {
    const { component, api } = await setup();
    component.filters.patchValue({ search: '  papier  ', category_id: 2, supplier_id: 3, stock: 'low', active: 'false' });

    component.applyFilters();

    expect(api.calls.filter(call => call.path === 'products').at(-1)).toEqual({
      path: 'products',
      params: { page: 1, per_page: 20, search: 'papier', category_id: 2, supplier_id: 3, stock: 'low', active: false },
    });
  });

  it('resets all filters and reloads the first page', async () => {
    const { component, api } = await setup();
    component.filters.patchValue({ search: 'papier', stock: 'out', active: 'true' });
    component.applyFilters();

    component.resetFilters();

    expect(component.filters.getRawValue()).toEqual({ search: '', category_id: null, supplier_id: null, stock: '', active: '' });
    expect(api.calls.filter(call => call.path === 'products').at(-1)?.params).toEqual({ page: 1, per_page: 20 });
  });

  it('loads the requested backend page', async () => {
    const api = new ApiStub();
    api.productPage = { data: [product], total: 45, current_page: 2, last_page: 3 };
    const { component } = await setup(api);

    component.goToPage(3);

    expect(api.calls.filter(call => call.path === 'products').at(-1)?.params?.['page']).toBe(3);
  });

  it('distinguishes an empty catalogue from empty filtered results', async () => {
    const api = new ApiStub();
    api.productPage = { data: [], total: 0, current_page: 1, last_page: 1 };
    const { fixture, component } = await setup(api);
    expect(text(fixture)).toContain('Aucun produit n’a encore été enregistré.');

    component.filters.controls.search.setValue('papier');
    component.applyFilters();
    expect(text(fixture)).toContain('Aucun produit ne correspond aux filtres sélectionnés.');
  });

  it('requires archive confirmation', async () => {
    const confirmation = new ConfirmationStub();
    confirmation.confirmed = false;
    const { component, api } = await setup(new ApiStub(), confirmation);

    component.archive(product);

    expect(api.deletes).toEqual([]);
  });

  it('shows the backend reason when positive stock blocks archival', async () => {
    const api = new ApiStub();
    api.deleteError = new HttpErrorResponse({ status: 422, error: { message: 'Épuisez ou ajustez le stock avant d’archiver le produit.' } });
    const { component } = await setup(api);

    component.archive(product);

    expect(component.actionError()).toBe('Épuisez ou ajustez le stock avant d’archiver le produit.');
    expect(api.error()).toBe('');
  });

  it('archives successfully and refreshes the current page', async () => {
    const { component, api } = await setup();
    const initialProductCalls = api.calls.filter(call => call.path === 'products').length;

    component.archive(product);

    expect(api.deletes).toEqual(['products/1']);
    expect(api.notices).toEqual(['Produit archivé.']);
    expect(api.calls.filter(call => call.path === 'products')).toHaveLength(initialProductCalls + 1);
  });
});

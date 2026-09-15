import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ApiService } from '../core/api.service';
import { ConfirmationService } from '../core/confirmation.service';
import { ProductDetailComponent } from './product-detail.component';

const product = {
  id: 1,
  reference: 'P-001',
  name: 'Papier A4',
  description: 'Papier blanc',
  category_id: 2,
  unit_id: 3,
  supplier_id: 4,
  minimum_stock: '2.000',
  maximum_stock: '20.000',
  purchase_price: '35.00',
  barcode: '123456',
  track_lots: true,
  active: true,
  stock_quantity: '5.000',
  has_movements: false,
  category: { name: 'Papier', parent: { name: 'Fournitures' } },
  unit: { name: 'Pièce', symbol: 'pce' },
  supplier: { name: 'Fournisseur A' },
};

class ApiStub {
  readonly error = signal('Erreur globale.');
  readonly calls: string[] = [];
  readonly posts: { path: string; body: unknown }[] = [];
  readonly patches: { path: string; body: unknown }[] = [];
  readonly deletes: string[] = [];
  readonly notices: string[] = [];
  product = { ...product };
  postError: HttpErrorResponse | null = null;
  patchError: HttpErrorResponse | null = null;

  get(path: string) {
    this.calls.push(path);
    if (path === 'products/1') return of(this.product);
    if (path === 'products/1/balances') return of({ data: [
      { id: 10, quantity: '5.000', location: { name: 'Magasin' }, lot: { lot_number: 'LOT-A' } },
      { id: 11, quantity: '0.000', location: { name: 'Bureau' }, lot: null },
    ], total: 2, current_page: 1, last_page: 1 });
    if (path === 'products/1/lots') return of({ data: [{ id: 20, lot_number: 'LOT-A', quantity: '5.000', produced_at: '2025-01-01', received_at: '2025-01-02', expires_at: '2025-12-31' }], total: 1, current_page: 1, last_page: 1 });
    if (path === 'settings/categories') return of({ data: [{ id: 2, name: 'Papier' }], total: 1, current_page: 1, last_page: 1 });
    if (path === 'settings/units') return of({ data: [{ id: 3, name: 'Pièce', symbol: 'pce' }], total: 1, current_page: 1, last_page: 1 });
    return of({ data: [{ id: 4, name: 'Fournisseur A' }], total: 1, current_page: 1, last_page: 1 });
  }

  post(path: string, body: unknown) {
    this.posts.push({ path, body });
    return this.postError ? throwError(() => this.postError) : of({ ...this.product, id: 2 });
  }

  patch(path: string, body: unknown) {
    this.patches.push({ path, body });
    return this.patchError ? throwError(() => this.patchError) : of(this.product);
  }

  delete(path: string) { this.deletes.push(path); return of({}); }
  success(message: string) { this.notices.push(message); }
}

class ConfirmationStub {
  confirm() { return of(true); }
}

class RouterStub {
  readonly navigations: unknown[][] = [];
  navigate(commands: unknown[]) { this.navigations.push(commands); return Promise.resolve(true); }
}

async function setup(options: { create?: boolean; edit?: boolean; api?: ApiStub } = {}) {
  const api = options.api ?? new ApiStub();
  const router = new RouterStub();
  await TestBed.configureTestingModule({
    imports: [ProductDetailComponent],
    providers: [
      provideNoopAnimations(),
      { provide: ApiService, useValue: api },
      { provide: ConfirmationService, useClass: ConfirmationStub },
      { provide: Router, useValue: router },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(options.create ? {} : { id: '1' }), queryParamMap: convertToParamMap(options.edit ? { edit: 'true' } : {}) } } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ProductDetailComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  return { fixture, component: fixture.componentInstance, api, router };
}

function text(fixture: ComponentFixture<ProductDetailComponent>) {
  fixture.detectChanges();
  return fixture.nativeElement.textContent as string;
}

describe('ProductDetailComponent', () => {
  it('renders product totals, positive balances and tracked lots', async () => {
    const { fixture, api } = await setup();
    const content = text(fixture);

    expect(content).toContain('Papier A4');
    expect(content).toContain('5.000 pce');
    expect(content).toContain('Magasin');
    expect(content).not.toContain('Bureau');
    expect(content).toContain('LOT-A');
    expect(api.calls).toContain('products/1/lots');
  });

  it('does not request or show lots for a product without lot tracking', async () => {
    const api = new ApiStub();
    api.product = { ...api.product, track_lots: false };
    const { fixture } = await setup({ api });
    const headings = Array.from(fixture.nativeElement.querySelectorAll('h2') as NodeListOf<HTMLElement>).map(item => item.textContent?.trim());

    expect(api.calls).not.toContain('products/1/lots');
    expect(headings).not.toContain('Lots');
  });

  it('builds the complete normalized create payload', async () => {
    const { component, api, router } = await setup({ create: true });
    component.form.patchValue({
      reference: ' P-002 ', name: ' Cahier ', description: ' ', category_id: 2, unit_id: 3, supplier_id: 4,
      minimum_stock: '1.000', maximum_stock: '10.000', purchase_price: '12.50', barcode: ' ABC ', track_lots: false, active: true,
    });

    component.save();

    expect(api.posts[0]).toEqual({ path: 'products', body: {
      reference: 'P-002', name: 'Cahier', description: null, category_id: 2, unit_id: 3, supplier_id: 4,
      minimum_stock: '1.000', maximum_stock: '10.000', purchase_price: '12.50', barcode: 'ABC', track_lots: false, active: true,
    } });
    expect(router.navigations).toContainEqual(['/produits', 2]);
  });

  it('builds the edit payload with nullable relationships', async () => {
    const { component, api } = await setup({ edit: true });
    component.form.patchValue({ name: 'Papier recyclé', category_id: null, supplier_id: null, maximum_stock: '' });

    component.save();

    expect(api.patches[0]).toEqual({ path: 'products/1', body: expect.objectContaining({ name: 'Papier recyclé', category_id: null, supplier_id: null, maximum_stock: null, unit_id: 3 }) });
    expect(api.notices).toContain('Produit mis à jour.');
    expect(component.editing()).toBe(false);
  });

  it('requires maximum stock to be at least the minimum', async () => {
    const { component, api } = await setup({ create: true });
    component.form.patchValue({ reference: 'P-002', name: 'Cahier', unit_id: 3, minimum_stock: '10', maximum_stock: '9' });

    component.save();

    expect(component.form.hasError('maximumBelowMinimum')).toBe(true);
    expect(api.posts).toEqual([]);
  });

  it('maps unique backend errors without clearing entered values', async () => {
    const api = new ApiStub();
    api.postError = new HttpErrorResponse({ status: 422, error: { errors: { reference: ['Cette référence est déjà utilisée.'], barcode: ['Ce code-barres est déjà utilisé.'] } } });
    const { component } = await setup({ create: true, api });
    component.form.patchValue({ reference: 'P-002', name: 'Cahier', unit_id: 3, minimum_stock: '0', barcode: 'ABC' });

    component.save();

    expect(component.form.controls.reference.errors?.['backend']).toBe('Cette référence est déjà utilisée.');
    expect(component.form.controls.barcode.errors?.['backend']).toBe('Ce code-barres est déjà utilisé.');
    expect(component.form.controls.reference.value).toBe('P-002');
    expect(api.error()).toBe('');
  });

  it('locks unit and lot configuration after movement history exists', async () => {
    const api = new ApiStub();
    api.product = { ...api.product, has_movements: true };
    const { fixture, component } = await setup({ api, edit: true });

    expect(component.form.controls.unit_id.disabled).toBe(true);
    expect(component.form.controls.track_lots.disabled).toBe(true);
    expect(text(fixture)).toContain('verrouillées');
  });
});

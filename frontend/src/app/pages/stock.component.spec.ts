import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { ApiService } from '../core/api.service';
import { StockComponent } from './stock.component';

class ApiStub {
  readonly error = signal('');
  readonly pending = signal(0);
  readonly calls: string[] = [];
  readonly posts: { path: string; body: unknown }[] = [];
  readonly notices: string[] = [];

  get(path: string) {
    this.calls.push(path);
    if (path === 'products') {
      return of({ data: [
        { id: 1, reference: 'P-001', name: 'Papier', track_lots: false },
        { id: 2, reference: 'P-002', name: 'Réactif', track_lots: true, supplier_id: 7, purchase_price: '12.50' },
      ] });
    }
    if (path === 'settings/locations') return of({ data: [{ id: 10, name: 'Magasin' }, { id: 11, name: 'Bureau' }] });
    if (path === 'settings/suppliers') return of({ data: [{ id: 7, name: 'Fournisseur A' }] });
    if (path === 'products/2/lots') return of({ data: [{ id: 20, lot_number: 'LOT-A', expires_at: '2099-01-01', quantity: '5.000' }] });
    if (path === 'products/2/balances') return of({ data: [{ id: 1, location_id: 10, stock_lot_id: 20, quantity: '5.000', lot: { id: 20, lot_number: 'LOT-A' }, location: { id: 10, name: 'Magasin' } }] });
    return of({ data: [] });
  }

  post(path: string, body: unknown) {
    this.posts.push({ path, body });
    return of({});
  }

  success(message: string) {
    this.notices.push(message);
  }
}

function labels(fixture: ComponentFixture<StockComponent>) {
  fixture.detectChanges();
  const elements = fixture.nativeElement.querySelectorAll('mat-label') as NodeListOf<Element>;
  return Array.from(elements)
    .map((label: Element) => label.textContent?.trim());
}

async function setup(api = new ApiStub()) {
  await TestBed.configureTestingModule({
    imports: [StockComponent],
    providers: [provideNoopAnimations(), { provide: ApiService, useValue: api }],
  }).compileComponents();
  const fixture = TestBed.createComponent(StockComponent);
  fixture.detectChanges();
  return { fixture, component: fixture.componentInstance, api };
}

describe('StockComponent', () => {
  it('shows entry fields with destination only', async () => {
    const { fixture } = await setup();

    expect(labels(fixture)).toContain('Destination');
    expect(labels(fixture)).not.toContain('Source');
  });

  it('shows transfer source and destination and blocks identical locations', async () => {
    const { fixture, component, api } = await setup();
    component.form.patchValue({ type: 'transfer', product_id: 1, quantity: 1, source_location_id: 10, destination_location_id: 10 });

    expect(labels(fixture)).toEqual(expect.arrayContaining(['Source', 'Destination']));

    component.save();

    expect(api.posts).toEqual([]);
    expect(component.form.controls.destination_location_id.hasError('sameLocation')).toBe(true);
  });

  it('switches adjustment decrease to source semantics', async () => {
    const { fixture, component } = await setup();
    component.form.patchValue({ type: 'adjustment', direction: 'decrease' });

    expect(labels(fixture)).toContain('Source');
    expect(labels(fixture)).not.toContain('Destination');
    expect(component.operationHint()).toContain('baisse');
  });

  it('loads lot data only for lot-managed products', async () => {
    const { component, api } = await setup();

    component.form.patchValue({ product_id: 1 });
    expect(api.calls).not.toContain('products/1/lots');

    component.form.patchValue({ product_id: 2 });

    expect(api.calls).toEqual(expect.arrayContaining(['products/2/lots', 'products/2/balances', 'settings/suppliers']));
    expect(component.lotOptions()[0].lot_number).toBe('LOT-A');
  });

  it('maps backend validation errors to matching controls', async () => {
    const api = new ApiStub();
    api.post = (path: string, body: unknown) => {
      api.posts.push({ path, body });
      return throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { quantity: ['Stock insuffisant.'] } } }));
    };
    const { component } = await setup(api);
    component.form.patchValue({ product_id: 1, type: 'exit', quantity: 4, source_location_id: 10 });

    component.save();

    expect(component.form.controls.quantity.errors?.['backend']).toBe('Stock insuffisant.');
  });

  it('publishes the shared success feedback after a stock movement', async () => {
    const { component, api } = await setup();
    component.form.patchValue({ product_id: 1, type: 'entry', quantity: 4, destination_location_id: 10 });

    component.save();

    expect(api.notices).toEqual(['Mouvement enregistré.']);
  });
});

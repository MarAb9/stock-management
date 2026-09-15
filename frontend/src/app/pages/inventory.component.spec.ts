import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { ApiService } from '../core/api.service';
import { ConfirmationService } from '../core/confirmation.service';
import { InventoryComponent } from './inventory.component';

const line = {
  id: 10,
  product: { name: 'Papier' },
  location: { name: 'Magasin' },
  theoretical_quantity: '5.000',
  physical_quantity: null,
  variance: null,
  reason: null,
  comment: null,
};

class ApiStub {
  readonly error = signal('Erreur globale.');
  readonly posts: { path: string; body: unknown }[] = [];
  readonly patches: { path: string; body: unknown }[] = [];
  readonly notices: string[] = [];
  postError: HttpErrorResponse | null = null;
  patchError: HttpErrorResponse | null = null;

  get(path: string) {
    if (path === 'inventory-sessions/1') return of({ id: 1, name: 'Septembre', status: 'in_progress' });
    if (path === 'inventory-sessions/1/lines') return of({ data: [{ ...line }] });
    return of({ data: [] });
  }

  post(path: string, body: unknown) {
    this.posts.push({ path, body });
    return this.postError ? throwError(() => this.postError) : of({ id: 2, name: 'Session', status: 'in_progress' });
  }

  patch(path: string, body: unknown) {
    this.patches.push({ path, body });
    return this.patchError ? throwError(() => this.patchError) : of({});
  }

  success(message: string) { this.notices.push(message); }
}

class ConfirmationStub {
  confirm() { return of(true); }
}

async function setup(api = new ApiStub()) {
  await TestBed.configureTestingModule({
    imports: [InventoryComponent],
    providers: [
      provideNoopAnimations(),
      { provide: ApiService, useValue: api },
      { provide: ConfirmationService, useClass: ConfirmationStub },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(InventoryComponent);
  fixture.detectChanges();
  return { component: fixture.componentInstance, api };
}

describe('InventoryComponent', () => {
  it('prevents invalid session creation', async () => {
    const { component, api } = await setup();
    component.sessionForm.controls.name.setValue('   ');

    component.create();

    expect(component.sessionForm.controls.name.hasError('required')).toBe(true);
    expect(api.posts).toEqual([]);
  });

  it('rejects negative quantities and more than three decimals', async () => {
    const { component } = await setup();
    component.open(1);
    const quantity = component.lineForm(10).controls.physical_quantity;

    quantity.setValue('-1');
    expect(quantity.invalid).toBe(true);
    quantity.setValue('1.2345');
    expect(quantity.hasError('pattern')).toBe(true);
  });

  it('requires a reason only when the counted quantity differs', async () => {
    const { component } = await setup();
    component.open(1);
    const form = component.lineForm(10);

    form.controls.physical_quantity.setValue('4.000');
    expect(form.hasError('reasonRequired')).toBe(true);
    form.controls.reason.setValue('Écart constaté');
    expect(form.valid).toBe(true);
    form.controls.physical_quantity.setValue('5.000');
    form.controls.reason.setValue('');
    expect(form.hasError('reasonRequired')).toBe(false);
  });

  it('maps Laravel validation errors to the edited line', async () => {
    const api = new ApiStub();
    api.patchError = new HttpErrorResponse({ status: 422, error: { errors: { physical_quantity: ['Quantité invalide.'], reason: ['Motif obligatoire.'] } } });
    const { component } = await setup(api);
    component.open(1);
    component.lineForm(10).patchValue({ physical_quantity: '4.000', reason: 'Motif' });

    component.saveLine(component.session()!.lines![0]);

    expect(component.lineForm(10).controls.physical_quantity.errors?.['backend']).toBe('Quantité invalide.');
    expect(component.lineForm(10).controls.reason.errors?.['backend']).toBe('Motif obligatoire.');
    expect(api.error()).toBe('');
  });

  it('maps session validation errors and preserves entered values', async () => {
    const api = new ApiStub();
    api.postError = new HttpErrorResponse({ status: 422, error: { errors: { name: ['Nom déjà utilisé.'], location_id: ['Emplacement invalide.'] } } });
    const { component } = await setup(api);
    component.sessionForm.patchValue({ name: 'Septembre', location_id: 99 });

    component.create();

    expect(component.sessionForm.controls.name.errors?.['backend']).toBe('Nom déjà utilisé.');
    expect(component.sessionForm.controls.location_id.errors?.['backend']).toBe('Emplacement invalide.');
    expect(component.sessionForm.getRawValue()).toEqual({ name: 'Septembre', location_id: 99 });
  });

  it('posts a normalized line payload and publishes success feedback', async () => {
    const { component, api } = await setup();
    component.open(1);
    component.lineForm(10).patchValue({ physical_quantity: '5.000', reason: '  Vérifié  ', comment: '   ' });

    component.saveLine(component.session()!.lines![0]);

    expect(api.patches).toEqual([{
      path: 'inventory-sessions/1/lines/10',
      body: { physical_quantity: '5.000', reason: 'Vérifié', comment: null },
    }]);
    expect(api.notices).toEqual(['Ligne d’inventaire enregistrée.']);
  });

  it('normalizes and resets a successfully created session', async () => {
    const { component, api } = await setup();
    component.sessionForm.patchValue({ name: '  Septembre  ', location_id: 3 });

    component.create();

    expect(api.posts[0]).toEqual({ path: 'inventory-sessions', body: { name: 'Septembre', location_id: 3 } });
    expect(component.sessionForm.getRawValue()).toEqual({ name: '', location_id: null });
    expect(api.notices).toContain('Inventaire créé.');
  });

  it('validates a fully counted session through confirmation', async () => {
    const { component, api } = await setup();
    component.open(1);
    component.lineForm(10).controls.physical_quantity.setValue('5.000');

    component.validate();

    expect(api.posts).toContainEqual({ path: 'inventory-sessions/1/validate', body: {} });
    expect(api.notices).toContain('Inventaire validé.');
  });
});

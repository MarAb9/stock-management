import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { ApiService } from '../core/api.service';
import { SettingsComponent } from './settings.component';

class ApiStub {
  readonly error = signal('Erreur globale.');
  readonly posts: { path: string; body: unknown }[] = [];
  readonly notices: string[] = [];
  postError: HttpErrorResponse | null = null;

  get() { return of({ data: [] }); }

  post(path: string, body: unknown) {
    this.posts.push({ path, body });
    return this.postError ? throwError(() => this.postError) : of({});
  }

  success(message: string) { this.notices.push(message); }
}

async function setup(api = new ApiStub()) {
  await TestBed.configureTestingModule({
    imports: [SettingsComponent],
    providers: [provideNoopAnimations(), { provide: ApiService, useValue: api }],
  }).compileComponents();
  const fixture = TestBed.createComponent(SettingsComponent);
  fixture.detectChanges();
  return { component: fixture.componentInstance, api };
}

describe('SettingsComponent', () => {
  it('enforces the category contract', async () => {
    const { component, api } = await setup();
    component.form.patchValue({ name: 'Papeterie', code: '' });

    component.save();

    expect(api.posts).toEqual([]);
    expect(component.form.controls.code.hasError('required')).toBe(true);
    component.form.controls.name.setValue('x'.repeat(101));
    expect(component.form.controls.name.hasError('maxlength')).toBe(true);
  });

  it('enforces the unit contract', async () => {
    const { component } = await setup();
    component.changeType('units');
    component.form.patchValue({ name: 'Kilogramme', symbol: '' });

    expect(component.form.invalid).toBe(true);
    component.form.controls.symbol.setValue('x'.repeat(17));
    expect(component.form.controls.symbol.hasError('maxlength')).toBe(true);
  });

  it('enforces the location contract', async () => {
    const { component } = await setup();
    component.changeType('locations');
    component.form.patchValue({ name: 'Magasin', code: 'MAG', notes: 'x'.repeat(5001) });

    expect(component.form.controls.notes.hasError('maxlength')).toBe(true);
  });

  it('validates supplier email without requiring optional fields', async () => {
    const { component } = await setup();
    component.changeType('suppliers');
    component.form.patchValue({ name: 'Fournisseur A', email: 'invalide' });

    expect(component.form.controls.email.hasError('email')).toBe(true);
    component.form.controls.email.setValue('contact@example.com');
    expect(component.form.valid).toBe(true);
  });

  it('switches validators with the reference type', async () => {
    const { component } = await setup();
    component.changeType('units');
    component.form.patchValue({ name: 'Unité', symbol: '' });
    expect(component.form.controls.symbol.hasError('required')).toBe(true);
    expect(component.form.controls.code.valid).toBe(true);

    component.changeType('suppliers');
    component.form.controls.name.setValue('Fournisseur');
    expect(component.form.controls.symbol.valid).toBe(true);
    expect(component.form.controls.code.valid).toBe(true);
  });

  it('maps duplicate backend errors and preserves entered values', async () => {
    const api = new ApiStub();
    api.postError = new HttpErrorResponse({ status: 422, error: { errors: { code: ['Ce code est déjà utilisé.'] } } });
    const { component } = await setup(api);
    component.form.patchValue({ name: 'Papeterie', code: 'PAP' });

    component.save();

    expect(component.form.controls.code.errors?.['backend']).toBe('Ce code est déjà utilisé.');
    expect(component.form.controls.code.value).toBe('PAP');
    expect(api.error()).toBe('');
  });

  it('builds exact payloads and publishes success feedback', async () => {
    const { component, api } = await setup();
    component.form.patchValue({ name: ' Papeterie ', code: ' PAP ', parent_id: 2 });
    component.save();
    component.changeType('units');
    component.form.patchValue({ name: ' Kilogramme ', symbol: ' kg ' });
    component.save();
    component.changeType('locations');
    component.form.patchValue({ name: ' Magasin ', code: ' MAG ', notes: ' Principal ', active: false });
    component.save();
    component.changeType('suppliers');
    component.form.patchValue({ name: ' Fournisseur A ', email: ' contact@example.com ', ice: ' 123 ' });
    component.save();

    expect(api.posts).toEqual([
      { path: 'settings/categories', body: { name: 'Papeterie', active: true, code: 'PAP', parent_id: 2 } },
      { path: 'settings/units', body: { name: 'Kilogramme', active: true, symbol: 'kg' } },
      { path: 'settings/locations', body: { name: 'Magasin', active: false, code: 'MAG', parent_id: null, notes: 'Principal' } },
      { path: 'settings/suppliers', body: { name: 'Fournisseur A', active: true, company: null, contact_name: null, phone: null, email: 'contact@example.com', address: null, ice: '123', notes: null } },
    ]);
    expect(api.notices).toEqual(['Référentiel ajouté.', 'Référentiel ajouté.', 'Référentiel ajouté.', 'Référentiel ajouté.']);
  });
});

import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { ApiService, apiErrorMessage, applyBackendValidation, authGuard, authInterceptor } from './api.service';

describe('API feedback', () => {
  it.each([
    [0, 'Serveur inaccessible. Vérifiez votre connexion puis réessayez.'],
    [401, 'Votre session a expiré. Veuillez vous reconnecter.'],
    [419, 'Votre session a expiré. Veuillez vous reconnecter.'],
    [422, 'Certains champs sont invalides. Vérifiez les informations saisies.'],
    [404, 'La ressource demandée est introuvable.'],
    [429, 'Trop de tentatives. Réessayez dans quelques instants.'],
    [500, 'Une erreur serveur est survenue. Réessayez ou contactez votre administrateur.'],
  ])('maps HTTP %s to safe French feedback', (status, expected) => {
    const error = new HttpErrorResponse({ status, error: { message: 'stack trace: secret' } });
    expect(apiErrorMessage(error)).toBe(expected);
    expect(apiErrorMessage(error)).not.toContain('stack trace');
  });

  it('maps Laravel field errors while preserving existing validation', () => {
    const quantity = new FormControl('', Validators.required);
    quantity.updateValueAndValidity();
    const source = new FormControl('');
    const form = new FormGroup({ quantity, source_location_id: source });
    const error = new HttpErrorResponse({ status: 422, error: { errors: { quantity: ['Stock insuffisant.'], location: ['Emplacement requis.'], unknown: ['Erreur générale.'] } } });

    const fallback = applyBackendValidation(form, error, { location: 'source_location_id' });

    expect(quantity.errors).toMatchObject({ required: true, backend: 'Stock insuffisant.' });
    expect(quantity.touched).toBe(true);
    expect(source.errors?.['backend']).toBe('Emplacement requis.');
    expect(fallback).toBe('Erreur générale.');
  });
});

describe('authInterceptor', () => {
  const router = {
    url: '/produits',
    navigate: vi.fn(),
    createUrlTree: vi.fn((_commands: string[], extras: { queryParams: { returnUrl: string } }) => ({
      toString: () => `/connexion?returnUrl=${encodeURIComponent(extras.queryParams.returnUrl)}`,
    })),
  };
  let api: ApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    router.url = '/produits';
    router.navigate.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Router, useValue: router },
      ],
    });
    api = TestBed.inject(ApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('tracks concurrent API activity through completion and failure', () => {
    api.get('products').subscribe();
    api.get('assets').subscribe({ error: () => {} });
    expect(api.pending()).toBe(2);

    http.expectOne('/api/products').flush({});
    expect(api.pending()).toBe(1);
    http.expectOne('/api/assets').flush({}, { status: 500, statusText: 'Server error' });
    expect(api.pending()).toBe(0);
  });

  it('expires an authenticated session and redirects only once with the return URL', () => {
    api.user.set({ id: 1, name: 'Admin', email: 'admin@example.test' });
    api.get('products').subscribe({ error: () => {} });
    api.get('assets').subscribe({ error: () => {} });

    http.expectOne('/api/products').flush({}, { status: 419, statusText: 'Expired' });
    http.expectOne('/api/assets').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(api.user()).toBeNull();
    expect(api.error()).toBe('Votre session a expiré. Veuillez vous reconnecter.');
    expect(router.navigate).toHaveBeenCalledTimes(1);
    expect(router.navigate).toHaveBeenCalledWith(['/connexion'], { queryParams: { returnUrl: '/produits' } });
  });

  it('lets the guard redirect an auth probe with its attempted URL', () => {
    let result: unknown;
    TestBed.runInInjectionContext(() => {
      (authGuard({} as never, { url: '/rapports' } as never) as any).subscribe((value: unknown) => result = value);
    });
    http.expectOne('/api/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(String(result)).toBe('/connexion?returnUrl=%2Frapports');
    expect(router.navigate).not.toHaveBeenCalled();
    expect(api.error()).toBe('');
  });
});

import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, finalize, map, of, switchMap, tap, throwError } from 'rxjs';

export interface User { id: number; name: string; email: string }
export interface Page<T> { data: T[]; total: number; current_page: number; last_page: number }

export function apiErrorMessage(error: unknown) {
  const response = error as HttpErrorResponse;
  if (response.status === 0) return 'Serveur inaccessible. Vérifiez votre connexion puis réessayez.';
  if (response.status === 401 || response.status === 419) return 'Votre session a expiré. Veuillez vous reconnecter.';
  if (response.status === 422) return 'Certains champs sont invalides. Vérifiez les informations saisies.';
  if (response.status === 404) return 'La ressource demandée est introuvable.';
  if (response.status === 429) return 'Trop de tentatives. Réessayez dans quelques instants.';
  if (response.status >= 500) return 'Une erreur serveur est survenue. Réessayez ou contactez votre administrateur.';
  return 'L’opération n’a pas pu aboutir. Réessayez.';
}

export function applyBackendValidation(
  form: FormGroup,
  error: unknown,
  aliases: Record<string, string> = {},
) {
  const fields = (error as HttpErrorResponse)?.error?.errors as Record<string, string[]> | undefined;
  if (!fields) return '';
  const fallback: string[] = [];
  for (const [field, messages] of Object.entries(fields)) {
    const control: AbstractControl | null = form.get(aliases[field] ?? field);
    const message = messages.join(' ');
    if (!control) {
      fallback.push(message);
      continue;
    }
    control.setErrors({ ...(control.errors ?? {}), backend: message });
    control.markAsTouched();
  }
  return fallback.join(' ');
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const api = inject(ApiService), router = inject(Router);
  if (!request.url.startsWith('/api/') && !request.url.startsWith('/sanctum/')) return next(request);
  api.pending.update(n => n + 1);
  return next(request.clone({ setHeaders: { Accept: 'application/json' } })).pipe(
    catchError((error: HttpErrorResponse) => {
      const loginAttempt = request.url.endsWith('/auth/login');
      const sessionProbe = request.url.endsWith('/auth/me');
      if (!loginAttempt && !sessionProbe) api.error.set(apiErrorMessage(error));
      if ([401, 419].includes(error.status) && !loginAttempt) {
        api.expireSession(router, !sessionProbe);
      }
      return throwError(() => error);
    }),
    finalize(() => api.pending.update(n => Math.max(0, n - 1))),
  );
};

export const authGuard: CanActivateFn = (_route, state) => {
  const api = inject(ApiService), router = inject(Router);
  return api.get<User>('auth/me').pipe(
    tap(user => api.user.set(user)),
    map(() => true),
    catchError(() => of(router.createUrlTree(['/connexion'], { queryParams: { returnUrl: state.url } }))),
  );
};

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private sessionRedirecting = false;
  readonly user = signal<User | null>(null);
  readonly error = signal('');
  readonly notice = signal('');
  readonly pending = signal(0);
  get<T>(path: string, params: Record<string, string | number | boolean> = {}) { return this.http.get<T>(`/api/${path}`, { params }); }
  post<T>(path: string, body: unknown) { this.error.set(''); return this.http.post<T>(`/api/${path}`, body); }
  patch<T>(path: string, body: unknown) { this.error.set(''); return this.http.patch<T>(`/api/${path}`, body); }
  delete(path: string) { this.error.set(''); return this.http.delete(`/api/${path}`); }
  download(path: string) { return this.http.get(`/api/${path}`, { responseType: 'blob' }); }
  saveFile(path: string, name: string) { return this.download(path).pipe(tap(blob => { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); })); }
  login(credentials: unknown) { return this.http.get('/sanctum/csrf-cookie').pipe(switchMap(() => this.post<{ user: User }>('auth/login', credentials))); }
  setSession(session: { user: User }) { this.sessionRedirecting = false; this.user.set(session.user); this.error.set(''); }
  clearSession() { this.user.set(null); }
  success(message: string) { this.error.set(''); this.notice.set(message); }
  expireSession(router: Router, redirect: boolean) {
    this.clearSession();
    if (!redirect || this.sessionRedirecting || router.url.startsWith('/connexion')) return;
    this.sessionRedirecting = true;
    const returnUrl = router.url.startsWith('/') && !router.url.startsWith('//') ? router.url : '/';
    router.navigate(['/connexion'], { queryParams: { returnUrl } });
  }
}

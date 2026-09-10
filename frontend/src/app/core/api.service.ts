import { HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, finalize, map, of, switchMap, tap, throwError } from 'rxjs';

export interface User { id: number; name: string; email: string }
export interface Page<T> { data: T[]; total: number; current_page: number; last_page: number }

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const api = inject(ApiService), router = inject(Router);
  if (!request.url.startsWith('/api/') && !request.url.startsWith('/sanctum/')) return next(request);
  api.pending.update(n => n + 1);
  return next(request.clone({ setHeaders: { Accept: 'application/json' } })).pipe(
    catchError((error: HttpErrorResponse) => {
      api.error.set(error.error?.errors ? Object.values(error.error.errors).flat().join(' ') : error.status === 0 ? 'Serveur inaccessible. Vérifiez la connexion puis réessayez.' : error.status >= 500 ? 'Une erreur serveur est survenue. Réessayez ou contactez votre administrateur.' : error.status === 419 ? 'Session expirée. Reconnectez-vous.' : error.error?.message || 'Opération refusée.');
      if ([401, 419].includes(error.status)) { api.clearSession(); router.navigate(['/connexion']); }
      return throwError(() => error);
    }), finalize(() => api.pending.update(n => n - 1)),
  );
};
export const authGuard: CanActivateFn = () => {
  const api = inject(ApiService), router = inject(Router);
  return api.get<User>('auth/me').pipe(tap(user => api.user.set(user)), map(() => true), catchError(() => of(router.createUrlTree(['/connexion']))));
};

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  readonly user = signal<User | null>(null);
  readonly error = signal('');
  readonly notice = signal('');
  readonly pending = signal(0);
  get<T>(path: string, params: Record<string, string | number | boolean> = {}) { return this.http.get<T>(`/api/${path}`, { params }); }
  post<T>(path: string, body: unknown) { this.error.set(''); return this.http.post<T>(`/api/${path}`, body); }
  patch<T>(path: string, body: unknown) { this.error.set(''); return this.http.patch<T>(`/api/${path}`, body); }
  delete(path: string) { this.error.set(''); return this.http.delete(`/api/${path}`); }
  download(path: string) { return this.http.get(`/api/${path}`, { responseType: 'blob' }); }
  saveFile(path: string, name: string) { this.download(path).subscribe({ next: blob => { const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }, error: () => {} }); }
  login(credentials: unknown) { return this.http.get('/sanctum/csrf-cookie').pipe(switchMap(() => this.post<{ user: User }>('auth/login', credentials))); }
  setSession(session: { user: User }) { this.user.set(session.user); this.error.set(''); }
  clearSession() { this.user.set(null); }
}

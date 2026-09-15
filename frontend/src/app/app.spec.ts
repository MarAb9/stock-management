import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBarHarness } from '@angular/material/snack-bar/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { App } from './app';
import { ApiService } from './core/api.service';

class ApiStub {
  readonly pending = signal(0);
  readonly error = signal('');
  readonly notice = signal('');
}

describe('App feedback host', () => {
  let api: ApiStub;

  beforeEach(async () => {
    api = new ApiStub();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideNoopAnimations(), { provide: ApiService, useValue: api }],
    }).compileComponents();
  });

  it('announces shared success feedback in one snackbar', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    api.notice.set('Produit enregistré.');
    await fixture.whenStable();
    const loader = TestbedHarnessEnvironment.documentRootLoader(fixture);
    const snackbar = await loader.getHarness(MatSnackBarHarness);

    expect(await snackbar.getMessage()).toBe('Produit enregistré.');
    expect(await snackbar.getActionDescription()).toBe('Fermer');
    expect(api.notice()).toBe('');
  });

  it('delays the global progress bar and removes it when requests finish', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    api.pending.set(1);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(179);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-progress-bar')).toBeNull();

    await vi.advanceTimersByTimeAsync(1);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-progress-bar')?.getAttribute('aria-label')).toBe('Chargement en cours');

    api.pending.set(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('mat-progress-bar')).toBeNull();
    vi.useRealTimers();
  });
});

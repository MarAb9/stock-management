import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ApiService } from '../core/api.service';
import { ReportsComponent } from './reports.component';

class ApiStub {
  saved: unknown;
  rows: unknown[][] = [[0]];

  get() {
    return of({ title: 'Rapport', columns: ['Valeur'], rows: { data: this.rows } });
  }

  saveFile(path: string, name: string) {
    this.saved = { path, name };
    return of(new Blob());
  }

  success() {}
}

describe('ReportsComponent', () => {
  it('keeps report filters when exporting', async () => {
    const api = new ApiStub();
    await TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [provideNoopAnimations(), { provide: ApiService, useValue: api }],
    }).compileComponents();

    const component = TestBed.createComponent(ReportsComponent).componentInstance;
    component.type = 'movements';
    component.filters = { from: '2026-09-01', to: '', stock: '', expiry: '', status: '', condition: '', movement_type: 'exit', variance: '', year: '' };

    component.export('csv');

    expect(api.saved).toEqual({
      path: 'reports/movements.csv?from=2026-09-01&movement_type=exit',
      name: 'movements.csv',
    });
  });

  it('shows the filtered empty-state copy when applied filters return no rows', async () => {
    const api = new ApiStub();
    api.rows = [];
    await TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [provideNoopAnimations(), { provide: ApiService, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.componentInstance.filters.stock = 'out';
    fixture.componentInstance.load();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('Aucun résultat ne correspond aux filtres sélectionnés.');
  });
});

import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ApiService } from '../core/api.service';
import { ReportsComponent } from './reports.component';

class ApiStub {
  saved: unknown;

  get() {
    return of({ title: 'Rapport', columns: ['Valeur'], rows: { data: [[0]] } });
  }

  saveFile(path: string, name: string) {
    this.saved = { path, name };
  }
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
});

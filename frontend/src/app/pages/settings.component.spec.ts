import { of } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ApiService } from '../core/api.service';
import { SettingsComponent } from './settings.component';

class ApiStub {
  readonly posts: unknown[] = [];

  get() {
    return of({ data: [] });
  }

  post(path: string, body: unknown) {
    this.posts.push({ path, body });
    return of({});
  }
}

describe('SettingsComponent', () => {
  it('posts the unit symbol expected by the API', async () => {
    const api = new ApiStub();
    await TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [provideNoopAnimations(), { provide: ApiService, useValue: api }],
    }).compileComponents();

    const component = TestBed.createComponent(SettingsComponent).componentInstance;
    component.changeType('units');
    component.form = { name: 'Kilogramme', code: 'kg' };

    component.save();

    expect(api.posts[0]).toEqual({
      path: 'settings/units',
      body: { name: 'Kilogramme', active: true, symbol: 'kg' },
    });
  });
});

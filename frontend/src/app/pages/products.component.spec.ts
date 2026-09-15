import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { ProductsComponent } from './products.component';

class ApiStub {
  get() { return of({ data: [] }); }
  post() { return of({}); }
  success() {}
}

describe('ProductsComponent empty states', () => {
  it('distinguishes an empty catalogue from an empty search result', async () => {
    await TestBed.configureTestingModule({
      imports: [ProductsComponent],
      providers: [provideNoopAnimations(), { provide: ApiService, useClass: ApiStub }],
    }).compileComponents();
    const fixture = TestBed.createComponent(ProductsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Aucun produit n’a encore été enregistré.');

    const component = fixture.componentInstance;
    component.search = 'papier';
    component.load();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Aucun résultat ne correspond à votre recherche.');

    component.clearSearch();
    expect(component.search).toBe('');
    expect(component.appliedSearch()).toBe('');
  });
});

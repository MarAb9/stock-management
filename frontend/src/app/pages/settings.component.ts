import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../core/api.service';

type ReferenceType = 'categories' | 'units' | 'locations' | 'suppliers';

@Component({
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `<section class="heading"><h1>Référentiels</h1><p>Catégories, unités, fournisseurs et emplacements.</p></section><mat-card><div class="bar"><mat-form-field><mat-label>Type</mat-label><mat-select [(ngModel)]="type" (selectionChange)="changeType($event.value)"><mat-option value="categories">Catégories</mat-option><mat-option value="units">Unités</mat-option><mat-option value="locations">Emplacements</mat-option><mat-option value="suppliers">Fournisseurs</mat-option></mat-select></mat-form-field><mat-form-field><mat-label>Nom</mat-label><input matInput [(ngModel)]="form.name"></mat-form-field>@if(type!=='suppliers'){<mat-form-field><mat-label>{{type==='units'?'Symbole':'Code'}}</mat-label><input matInput [(ngModel)]="form.code"></mat-form-field>}@if(hasParent()){<mat-form-field><mat-label>Parent</mat-label><mat-select [(ngModel)]="form.parent_id"><mat-option [value]="null">Aucun parent</mat-option>@for(x of rows();track x.id){<mat-option [value]="x.id">{{x.name}}</mat-option>}</mat-select></mat-form-field>}@if(type==='locations'){<mat-form-field class="wide"><mat-label>Notes</mat-label><input matInput [(ngModel)]="form.notes"></mat-form-field>}@if(type==='suppliers'){<mat-form-field><mat-label>Société</mat-label><input matInput [(ngModel)]="form.company"></mat-form-field><mat-form-field><mat-label>Contact</mat-label><input matInput [(ngModel)]="form.contact_name"></mat-form-field><mat-form-field><mat-label>Téléphone</mat-label><input matInput [(ngModel)]="form.phone"></mat-form-field><mat-form-field><mat-label>Email</mat-label><input matInput type="email" [(ngModel)]="form.email"></mat-form-field><mat-form-field><mat-label>ICE</mat-label><input matInput [(ngModel)]="form.ice"></mat-form-field><mat-form-field class="wide"><mat-label>Adresse</mat-label><input matInput [(ngModel)]="form.address"></mat-form-field><mat-form-field class="wide"><mat-label>Notes</mat-label><input matInput [(ngModel)]="form.notes"></mat-form-field>}<button mat-flat-button [disabled]="!canSave()" (click)="save()">Ajouter</button></div><table><thead><tr><th>Nom</th><th>{{type==='units'?'Symbole':type==='suppliers'?'Société':'Code'}}</th><th>Actif</th></tr></thead><tbody>@for(x of rows();track x.id){<tr><td>{{x.name}}</td><td>{{x.symbol||x.code||x.company||'—'}}</td><td>{{x.active?'Oui':'Non'}}</td></tr>}@empty{<tr><td colspan="3">Aucun élément.</td></tr>}</tbody></table></mat-card>`,
  styles: `h1{margin:0;font-size:28px}p{color:#687278}.heading{margin-bottom:18px}mat-card{padding:18px}.bar{display:grid;grid-template-columns:repeat(3,minmax(180px,1fr));gap:10px;align-items:center}.wide{grid-column:span 2}.bar button{background:#123a4a;color:white;min-height:40px}table{width:100%;border-collapse:collapse;margin-top:10px}th,td{text-align:left;padding:11px 8px;border-bottom:1px solid #e6e8e9}@media(max-width:800px){.bar{grid-template-columns:1fr}.wide{grid-column:auto}}`,
})
export class SettingsComponent {
  private api = inject(ApiService);
  readonly rows = signal<any[]>([]);
  type: ReferenceType = 'categories';
  form: any = {};

  constructor() {
    this.resetForm();
    this.load();
  }

  hasParent() {
    return this.type === 'categories' || this.type === 'locations';
  }

  changeType(type: ReferenceType) {
    this.type = type;
    this.resetForm();
    this.load();
  }

  load() {
    this.api.get<any>('settings/' + this.type).subscribe(x => this.rows.set(x.data));
  }

  canSave() {
    return !!this.form.name && (this.type === 'suppliers' || !!this.form.code);
  }

  save() {
    if (!this.canSave()) return;
    const body: any = { name: this.form.name, active: true };
    if (this.type === 'units') body.symbol = this.form.code;
    if (this.type === 'categories') Object.assign(body, { code: this.form.code, parent_id: this.form.parent_id });
    if (this.type === 'locations') Object.assign(body, { code: this.form.code, parent_id: this.form.parent_id, notes: this.form.notes });
    if (this.type === 'suppliers') Object.assign(body, { company: this.form.company, contact_name: this.form.contact_name, phone: this.form.phone, email: this.form.email, address: this.form.address, ice: this.form.ice, notes: this.form.notes });
    this.api.post('settings/' + this.type, body).subscribe(() => {
      this.resetForm();
      this.load();
    });
  }

  private resetForm() {
    this.form = { name: '', code: '', parent_id: null, company: '', contact_name: '', phone: '', email: '', address: '', ice: '', notes: '' };
  }
}

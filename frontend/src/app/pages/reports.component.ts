import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../core/api.service';

type ReportType = 'stock' | 'assets' | 'movements' | 'lots' | 'inventory' | 'consumption';
type ReportFilters = {
  from: string;
  to: string;
  stock: string;
  expiry: string;
  status: string;
  condition: string;
  movement_type: string;
  variance: string | boolean;
  year: string;
};

@Component({
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `<section><h1>Rapports</h1><p>États exportables issus des données courantes.</p><mat-card><div class="filters"><mat-form-field><mat-label>Rapport</mat-label><mat-select [(ngModel)]="type" (selectionChange)="changeType()">@for(x of types;track x.value){<mat-option [value]="x.value">{{x.label}}</mat-option>}</mat-select></mat-form-field>@if(hasDates()){<mat-form-field><mat-label>Du</mat-label><input matInput type="date" [(ngModel)]="filters.from"></mat-form-field><mat-form-field><mat-label>Au</mat-label><input matInput type="date" [(ngModel)]="filters.to"></mat-form-field>}@if(type==='stock'){<mat-form-field><mat-label>Stock</mat-label><mat-select [(ngModel)]="filters.stock"><mat-option value="">Tous</mat-option><mat-option value="low">Sous le seuil</mat-option><mat-option value="out">Rupture</mat-option></mat-select></mat-form-field>}@if(type==='lots'){<mat-form-field><mat-label>Péremption</mat-label><mat-select [(ngModel)]="filters.expiry"><mat-option value="">Tous</mat-option><mat-option value="soon">Expire bientôt</mat-option><mat-option value="expired">Expiré</mat-option></mat-select></mat-form-field>}@if(type==='assets'){<mat-form-field><mat-label>Statut</mat-label><mat-select [(ngModel)]="filters.status"><mat-option value="">Tous</mat-option>@for(x of assetStatuses;track x){<mat-option [value]="x">{{labels[x]}}</mat-option>}</mat-select></mat-form-field><mat-form-field><mat-label>État</mat-label><mat-select [(ngModel)]="filters.condition"><mat-option value="">Tous</mat-option>@for(x of conditions;track x){<mat-option [value]="x">{{labels[x]}}</mat-option>}</mat-select></mat-form-field><mat-form-field><mat-label>Année</mat-label><input matInput type="number" [(ngModel)]="filters.year"></mat-form-field>}@if(type==='movements'){<mat-form-field><mat-label>Type</mat-label><mat-select [(ngModel)]="filters.movement_type"><mat-option value="">Tous</mat-option>@for(x of movementTypes;track x){<mat-option [value]="x">{{labels[x]}}</mat-option>}</mat-select></mat-form-field>}@if(type==='inventory'){<mat-form-field><mat-label>Écarts</mat-label><mat-select [(ngModel)]="filters.variance"><mat-option value="">Tous</mat-option><mat-option [value]="true">Avec écart</mat-option></mat-select></mat-form-field>}<button mat-flat-button (click)="load()">Afficher</button></div><div class="actions"><button mat-flat-button (click)="export('pdf')">Télécharger PDF</button><button mat-stroked-button (click)="export('csv')">Exporter pour Excel</button></div><h2>{{title()}}</h2><table><thead><tr>@for(c of columns();track c){<th>{{c}}</th>}</tr></thead><tbody>@for(r of rows();track $index){<tr>@for(c of columns();track $index;let i=$index){<td>{{r[i] ?? '—'}}</td>}</tr>}@empty{<tr><td [attr.colspan]="columns().length || 1">Aucune donnée.</td></tr>}</tbody></table></mat-card></section>`,
  styles: `h1{margin:0;font-size:28px}p{color:#687278}mat-card{padding:20px;margin-top:20px;overflow-x:auto}.filters{display:grid;grid-template-columns:repeat(4,minmax(160px,1fr));gap:10px;align-items:center}.filters button,.actions button:first-child{background:#123a4a;color:#fff}.actions{display:flex;gap:10px;margin:6px 0 18px}h2{font-size:18px;margin:0 0 12px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:11px 8px;border-bottom:1px solid #e6e8e9;vertical-align:top}@media(max-width:900px){.filters{grid-template-columns:1fr}.actions{flex-wrap:wrap}}`,
})
export class ReportsComponent {
  private api = inject(ApiService);
  readonly types = [{ value: 'stock', label: 'État du stock' }, { value: 'assets', label: 'Équipements' }, { value: 'movements', label: 'Mouvements' }, { value: 'lots', label: 'Lots et péremptions' }, { value: 'inventory', label: 'Écarts d’inventaire' }, { value: 'consumption', label: 'Consommation' }];
  readonly assetStatuses = ['available', 'assigned', 'maintenance', 'out_of_service', 'retired'];
  readonly conditions = ['new', 'very_good', 'good', 'fair', 'repair', 'out_of_service', 'retired'];
  readonly movementTypes = ['entry', 'exit', 'return', 'transfer', 'adjustment', 'loss', 'disposal'];
  readonly labels: Record<string, string> = { available: 'Disponible', assigned: 'Affecté', maintenance: 'Maintenance', out_of_service: 'Hors service', retired: 'Réformé', new: 'Neuf', very_good: 'Très bon', good: 'Bon', fair: 'Moyen', repair: 'À réparer', entry: 'Entrée', exit: 'Sortie', return: 'Retour', transfer: 'Transfert', adjustment: 'Ajustement', loss: 'Perte', disposal: 'Mise au rebut' };
  readonly title = signal('État du stock');
  readonly columns = signal<string[]>([]);
  readonly rows = signal<any[][]>([]);
  type: ReportType = 'stock';
  filters: ReportFilters = this.emptyFilters();

  constructor() {
    this.resetFilters();
    this.load();
  }

  hasDates() {
    return this.type === 'movements' || this.type === 'consumption';
  }

  changeType() {
    this.resetFilters();
    this.load();
  }

  load() {
    this.api.get<any>('reports/' + this.type, this.params()).subscribe(x => {
      this.title.set(x.title);
      this.columns.set(x.columns);
      this.rows.set(x.rows.data);
    });
  }

  export(format: 'pdf' | 'csv') {
    this.api.saveFile(this.path(format), `${this.type}.${format}`);
  }

  private resetFilters() {
    this.filters = this.emptyFilters();
  }

  private params() {
    return Object.fromEntries(Object.entries(this.filters).filter(([, v]) => v !== '' && v !== null && v !== undefined)) as Record<string, string | number | boolean>;
  }

  private path(format: 'pdf' | 'csv') {
    const query = new URLSearchParams(Object.entries(this.params()).map(([k, v]) => [k, String(v)])).toString();
    return `reports/${this.type}.${format}${query ? '?' + query : ''}`;
  }

  private emptyFilters(): ReportFilters {
    return { from: '', to: '', stock: '', expiry: '', status: '', condition: '', movement_type: '', variance: '', year: '' };
  }
}

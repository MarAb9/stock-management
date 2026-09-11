import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../core/api.service';

type InventoryLine = {
  id: number;
  product?: { name: string };
  location?: { name: string };
  lot?: { lot_number: string };
  theoretical_quantity: string;
  physical_quantity: string | null;
  variance: string | null;
  reason: string | null;
  comment: string | null;
};

type InventorySession = {
  id: number;
  name: string;
  status: string;
  lines?: InventoryLine[];
};

@Component({
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
<section class="heading"><div><h1>Inventaires physiques</h1><p>Le comptage génère des ajustements traçables à la validation.</p></div></section>
<mat-card class="create"><mat-form-field><mat-label>Nom de la session</mat-label><input matInput [(ngModel)]="name"></mat-form-field><mat-form-field><mat-label>Emplacement</mat-label><mat-select [(ngModel)]="locationId"><mat-option [value]="null">Tous les emplacements</mat-option>@for (l of locations(); track l.id) {<mat-option [value]="l.id">{{l.name}}</mat-option>}</mat-select></mat-form-field><button mat-flat-button [disabled]="!name" (click)="create()">Créer l’inventaire</button></mat-card>
<div class="grid"><mat-card><h2>Sessions</h2><table><thead><tr><th>Session</th><th>Statut</th><th></th></tr></thead><tbody>@for (s of sessions(); track s.id) {<tr><td>{{s.name}}</td><td>{{statusLabels[s.status] || s.status}}</td><td><button mat-button (click)="open(s.id)">Ouvrir</button></td></tr>} @empty {<tr><td colspan="3">Aucune session.</td></tr>}</tbody></table></mat-card>
@if (session(); as s) {<mat-card><div class="detail-head"><h2>{{s.name}}</h2>@if (s.status === 'in_progress') {<button mat-flat-button (click)="validate()">Valider</button>}</div><table><thead><tr><th>Produit</th><th>Emplacement</th><th>Lot</th><th>Théorique</th><th>Physique</th><th>Écart</th><th>Motif</th><th>Commentaire</th><th></th></tr></thead><tbody>@for (line of s.lines || []; track line.id) {<tr><td>{{line.product?.name}}</td><td>{{line.location?.name || '—'}}</td><td>{{line.lot?.lot_number || '—'}}</td><td>{{line.theoretical_quantity}}</td><td>@if (s.status === 'in_progress') {<input type="number" min="0" step="0.001" [(ngModel)]="line.physical_quantity">} @else { {{line.physical_quantity}} }</td><td>{{previewVariance(line)}}</td><td>@if (s.status === 'in_progress') {<input class="wide" [(ngModel)]="line.reason">} @else { {{line.reason || '—'}} }</td><td>@if (s.status === 'in_progress') {<input class="wide" [(ngModel)]="line.comment">} @else { {{line.comment || '—'}} }</td><td>@if (s.status === 'in_progress') {<button mat-button (click)="saveLine(line)">Enregistrer</button>}</td></tr>} @empty {<tr><td colspan="9">Aucune ligne à compter.</td></tr>}</tbody></table></mat-card>}</div>`,
  styles: `.heading{margin-bottom:18px}h1{margin:0;font-size:28px}p{color:#687278}.create,mat-card{padding:18px}.create{display:flex;gap:10px;align-items:center;margin-bottom:18px;flex-wrap:wrap}.create button,.detail-head button{background:#123a4a;color:white}.grid{display:grid;grid-template-columns:1fr 2fr;gap:18px}h2{margin-top:0;font-size:18px}.detail-head{display:flex;justify-content:space-between;gap:12px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 7px;border-bottom:1px solid #e6e8e9;vertical-align:middle}input{width:86px;padding:6px}.wide{width:150px}@media(max-width:850px){.grid{grid-template-columns:1fr}table{display:block;overflow-x:auto;white-space:nowrap}}`,
})
export class InventoryComponent {
  private api = inject(ApiService);
  readonly sessions = signal<InventorySession[]>([]);
  readonly locations = signal<any[]>([]);
  readonly session = signal<InventorySession | null>(null);
  readonly statusLabels: Record<string, string> = { in_progress: 'En cours', validated: 'Validé', cancelled: 'Annulé' };
  name = '';
  locationId: number | null = null;

  constructor() {
    this.load();
    this.api.get<any>('settings/locations').subscribe(x => this.locations.set(x.data));
  }

  load() {
    this.api.get<any>('inventory-sessions').subscribe(x => this.sessions.set(x.data));
  }

  create() {
    if (!this.name) return;
    this.api.post<InventorySession>('inventory-sessions', { name: this.name, location_id: this.locationId }).subscribe(s => {
      this.name = '';
      this.load();
      this.open(s.id);
    });
  }

  open(id: number) {
    this.api.get<InventorySession>('inventory-sessions/' + id).subscribe(s => {
      this.api.get<any>(`inventory-sessions/${id}/lines`).subscribe(lines => this.session.set({ ...s, lines: lines.data }));
    });
  }

  saveLine(line: InventoryLine) {
    const current = this.session();
    if (!current) return;
    this.api.patch<InventoryLine>(`inventory-sessions/${current.id}/lines/${line.id}`, {
      physical_quantity: line.physical_quantity,
      reason: line.reason,
      comment: line.comment,
    }).subscribe(() => this.open(current.id));
  }

  validate() {
    const current = this.session();
    if (!current) return;
    this.api.post<InventorySession>(`inventory-sessions/${current.id}/validate`, {}).subscribe(() => {
      this.load();
      this.open(current.id);
    });
  }

  previewVariance(line: InventoryLine): string {
    if (line.physical_quantity === null || line.physical_quantity === '') return line.variance || '—';
    return (Number(line.physical_quantity) - Number(line.theoretical_quantity)).toFixed(3);
  }
}

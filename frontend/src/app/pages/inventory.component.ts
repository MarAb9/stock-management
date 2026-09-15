import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { ApiService } from '../core/api.service';
import { ConfirmationService } from '../core/confirmation.service';

type InventoryLine = { id: number; product?: { name: string }; location?: { name: string }; lot?: { lot_number: string }; theoretical_quantity: string; physical_quantity: string | null; variance: string | null; reason: string | null; comment: string | null };
type InventorySession = { id: number; name: string; status: string; lines?: InventoryLine[] };

@Component({
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <section class="heading"><div><h1>Inventaires physiques</h1><p>Le comptage génère des ajustements traçables à la validation.</p></div></section>
    <mat-card class="create">
      <mat-form-field><mat-label>Nom de la session</mat-label><input matInput [(ngModel)]="name"></mat-form-field>
      <mat-form-field><mat-label>Emplacement</mat-label><mat-select [(ngModel)]="locationId"><mat-option [value]="null">Tous les emplacements</mat-option>@for(location of locations();track location.id){<mat-option [value]="location.id">{{location.name}}</mat-option>}</mat-select></mat-form-field>
      <button mat-flat-button [disabled]="!name.trim() || busy() !== null" (click)="create()">{{busy()==='create'?'Création…':'Créer l’inventaire'}}</button>
    </mat-card>
    <div class="grid">
      <mat-card><h2>Sessions</h2><table><thead><tr><th>Session</th><th>Statut</th><th></th></tr></thead><tbody>
        @for(item of sessions();track item.id){<tr><td>{{item.name}}</td><td>{{statusLabels[item.status]||item.status}}</td><td><button mat-button (click)="open(item.id)">Ouvrir</button></td></tr>}
        @empty{@if(sessionsLoaded()){<tr><td colspan="3" class="empty-state"><span role="status">Aucun inventaire n’a encore été créé.</span></td></tr>}}
      </tbody></table></mat-card>
      @if(session(); as current){
        <mat-card><div class="detail-head"><h2>{{current.name}}</h2>@if(current.status==='in_progress'){<button mat-flat-button [disabled]="busy() !== null" (click)="validate()">{{busy()==='validate'?'Validation…':'Valider'}}</button>}</div>
          <table><thead><tr><th>Produit</th><th>Emplacement</th><th>Lot</th><th>Théorique</th><th>Physique</th><th>Écart</th><th>Motif</th><th>Commentaire</th><th></th></tr></thead><tbody>
            @for(line of current.lines||[];track line.id){<tr><td>{{line.product?.name}}</td><td>{{line.location?.name||'—'}}</td><td>{{line.lot?.lot_number||'—'}}</td><td>{{line.theoretical_quantity}}</td><td>@if(current.status==='in_progress'){<input type="number" min="0" step="0.001" [(ngModel)]="line.physical_quantity" [attr.aria-label]="'Quantité physique pour ' + line.product?.name">}@else { {{line.physical_quantity}} }</td><td>{{previewVariance(line)}}</td><td>@if(current.status==='in_progress'){<input class="wide" [(ngModel)]="line.reason" [attr.aria-label]="'Motif pour ' + line.product?.name">}@else { {{line.reason||'—'}} }</td><td>@if(current.status==='in_progress'){<input class="wide" [(ngModel)]="line.comment" [attr.aria-label]="'Commentaire pour ' + line.product?.name">}@else { {{line.comment||'—'}} }</td><td>@if(current.status==='in_progress'){<button mat-button [disabled]="busy() !== null" (click)="saveLine(line)">{{busy()===lineBusy(line)?'Enregistrement…':'Enregistrer'}}</button>}</td></tr>}
            @empty{@if(linesLoaded()){<tr><td colspan="9" class="empty-state"><span role="status">Cette session ne contient aucune ligne à compter.</span></td></tr>}}
          </tbody></table>
        </mat-card>
      }
    </div>
  `,
  styles: `.heading{margin-bottom:18px}h1{margin:0;font-size:28px}p{color:#687278}.create,mat-card{padding:18px}.create{display:flex;gap:10px;align-items:center;margin-bottom:18px;flex-wrap:wrap}.create button,.detail-head button{background:#123a4a;color:white}.grid{display:grid;grid-template-columns:1fr 2fr;gap:18px}h2{margin-top:0;font-size:18px}.detail-head{display:flex;justify-content:space-between;gap:12px}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 7px;border-bottom:1px solid #e6e8e9;vertical-align:middle}input{width:86px;padding:6px}.wide{width:150px}@media(max-width:850px){.grid{grid-template-columns:1fr}table{display:block;overflow-x:auto;white-space:nowrap}}`,
})
export class InventoryComponent {
  private api = inject(ApiService);
  private confirmation = inject(ConfirmationService);
  readonly sessions = signal<InventorySession[]>([]);
  readonly locations = signal<any[]>([]);
  readonly session = signal<InventorySession | null>(null);
  readonly sessionsLoaded = signal(false);
  readonly linesLoaded = signal(false);
  readonly busy = signal<string | null>(null);
  readonly statusLabels: Record<string, string> = { in_progress: 'En cours', validated: 'Validé', cancelled: 'Annulé' };
  name = '';
  locationId: number | null = null;

  constructor() {
    this.load();
    this.api.get<any>('settings/locations').subscribe(response => this.locations.set(response.data));
  }

  load() {
    this.sessionsLoaded.set(false);
    this.api.get<any>('inventory-sessions').pipe(finalize(() => this.sessionsLoaded.set(true))).subscribe(response => this.sessions.set(response.data));
  }

  create() {
    if (!this.name.trim() || this.busy()) return;
    this.busy.set('create');
    this.api.post<InventorySession>('inventory-sessions', { name: this.name.trim(), location_id: this.locationId }).pipe(finalize(() => this.busy.set(null))).subscribe(session => {
      this.name = '';
      this.api.success('Inventaire créé.');
      this.load();
      this.open(session.id);
    });
  }

  open(id: number) {
    this.linesLoaded.set(false);
    this.api.get<InventorySession>('inventory-sessions/' + id).subscribe(session => {
      this.api.get<any>(`inventory-sessions/${id}/lines`).pipe(finalize(() => this.linesLoaded.set(true))).subscribe(lines => this.session.set({ ...session, lines: lines.data }));
    });
  }

  saveLine(line: InventoryLine) {
    const current = this.session();
    if (!current || this.busy()) return;
    this.busy.set(this.lineBusy(line));
    this.api.patch<InventoryLine>(`inventory-sessions/${current.id}/lines/${line.id}`, { physical_quantity: line.physical_quantity, reason: line.reason, comment: line.comment }).pipe(finalize(() => this.busy.set(null))).subscribe(() => {
      this.api.success('Ligne d’inventaire enregistrée.');
      this.open(current.id);
    });
  }

  validate() {
    const current = this.session();
    if (!current || this.busy()) return;
    this.busy.set('confirm');
    this.confirmation.confirm({
      title: 'Valider l’inventaire ?',
      message: `La session « ${current.name} » sera clôturée et les écarts créeront des mouvements d’ajustement. Cette action est irréversible.`,
      confirmLabel: 'Valider l’inventaire',
    }).subscribe(confirmed => {
      if (!confirmed) { this.busy.set(null); return; }
      this.busy.set('validate');
      this.api.post<InventorySession>(`inventory-sessions/${current.id}/validate`, {}).pipe(finalize(() => this.busy.set(null))).subscribe(() => {
        this.api.success('Inventaire validé.');
        this.load();
        this.open(current.id);
      });
    });
  }

  lineBusy(line: InventoryLine) { return `line-${line.id}`; }

  previewVariance(line: InventoryLine): string {
    if (line.physical_quantity === null || line.physical_quantity === '') return line.variance || '—';
    return (Number(line.physical_quantity) - Number(line.theoretical_quantity)).toFixed(3);
  }
}

import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [DatePipe, MatCardModule, MatButtonModule, RouterLink],
  template: `
    <section class="heading"><div><h1>Tableau de bord</h1><p>Vue d’ensemble des stocks et équipements.</p></div><a mat-flat-button routerLink="/mouvements">Nouveau mouvement</a></section>
    @if(data(); as dashboard){
      <div class="cards"><mat-card><small>Produits</small><strong>{{dashboard.products}}</strong></mat-card><mat-card><small>Stock total</small><strong>{{dashboard.stock_quantity}}</strong></mat-card><mat-card class="alert"><small>Stock faible</small><strong>{{dashboard.low_stock}}</strong></mat-card><mat-card><small>Équipements</small><strong>{{dashboard.assets}}</strong></mat-card><mat-card class="alert"><small>Lots expirés</small><strong>{{dashboard.expired_lots}}</strong></mat-card><mat-card class="alert"><small>Hors service</small><strong>{{dashboard.assets_out_of_service}}</strong></mat-card></div>
      <div class="grid"><mat-card><h2>Derniers mouvements</h2><table><thead><tr><th>Référence</th><th>Produit</th><th>Type</th><th>Date</th></tr></thead><tbody>
        @for(movement of dashboard.recent_movements;track movement.id){<tr><td>{{movement.reference}}</td><td>{{movement.product?.name}}</td><td>{{movement.type}}</td><td>{{movement.performed_at|date:'dd/MM/yyyy HH:mm'}}</td></tr>}
        @empty{<tr><td colspan="4" class="empty-state"><span role="status">Aucun mouvement récent.</span></td></tr>}
      </tbody></table></mat-card><mat-card><h2>Alertes actives</h2><p>{{dashboard.low_stock}} produit(s) au seuil ou sous le seuil minimum.</p><p>{{dashboard.expiring_lots}} lot(s) expirent dans les 30 jours.</p><p>{{dashboard.assets_in_maintenance}} équipement(s) en maintenance.</p></mat-card></div>
    } @else if(loaded()){
      <mat-card class="load-error"><span role="status">Le tableau de bord n’a pas pu être chargé.</span><button mat-button (click)="load()">Réessayer</button></mat-card>
    }
  `,
  styles: `.heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px}.heading h1{margin:0;font-size:28px}.heading p{color:#687278;margin:5px 0}.heading a{background:#123a4a;color:#fff}.cards{display:grid;grid-template-columns:repeat(6,1fr);gap:14px}.cards mat-card{padding:16px;border-left:4px solid #2a7085}.cards .alert{border-color:#c99123}.cards small{display:block;color:#687278}.cards strong{display:block;font-size:30px;margin-top:8px}.grid{display:grid;grid-template-columns:2fr 1fr;gap:18px;margin-top:18px}.grid mat-card,.load-error{padding:18px}.load-error button{margin-left:8px}h2{font-size:17px;margin-top:0}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:10px 5px;border-bottom:1px solid #e6e8e9;font-size:13px}@media(max-width:1000px){.cards{grid-template-columns:repeat(3,1fr)}.grid{grid-template-columns:1fr}}@media(max-width:560px){.cards{grid-template-columns:repeat(2,1fr)}.heading{align-items:start;gap:10px;flex-direction:column}}`,
})
export class DashboardComponent {
  private api = inject(ApiService);
  readonly data = signal<any>(null);
  readonly loaded = signal(false);
  constructor() { this.load(); }
  load() { this.loaded.set(false); this.api.get<any>('dashboard').pipe(finalize(() => this.loaded.set(true))).subscribe(response => this.data.set(response)); }
}

import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ApiService } from '../core/api.service';

type Asset = {
  id: number;
  inventory_number: string;
  name: string;
  location?: { name: string };
  condition: string;
  status: string;
  assigned_to?: string | null;
};

@Component({
  standalone: true,
  imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
<section class="heading"><div><h1>Équipements</h1><p>Immobilisations, affectations et états.</p></div><button mat-stroked-button (click)="open.set(!open())">{{open()?'Fermer':'Ajouter un équipement'}}</button></section>
@if(open()){<mat-card class="form-card"><form [formGroup]="form" (ngSubmit)="save()"><mat-form-field><mat-label>N° inventaire</mat-label><input matInput formControlName="inventory_number"></mat-form-field><mat-form-field><mat-label>Désignation</mat-label><input matInput formControlName="name"></mat-form-field><mat-form-field><mat-label>Localisation</mat-label><mat-select formControlName="location_id"><mat-option [value]="null">Non définie</mat-option>@for(l of locations();track l.id){<mat-option [value]="l.id">{{l.name}}</mat-option>}</mat-select></mat-form-field><mat-form-field><mat-label>Marque</mat-label><input matInput formControlName="brand"></mat-form-field><mat-form-field><mat-label>Modèle</mat-label><input matInput formControlName="model"></mat-form-field><mat-form-field><mat-label>N° série</mat-label><input matInput formControlName="serial_number"></mat-form-field><mat-form-field><mat-label>État</mat-label><mat-select formControlName="condition">@for(x of conditions;track x){<mat-option [value]="x">{{labels[x]}}</mat-option>}</mat-select></mat-form-field><mat-form-field><mat-label>Statut</mat-label><mat-select formControlName="status">@for(x of statuses;track x){<mat-option [value]="x">{{labels[x]}}</mat-option>}</mat-select></mat-form-field><button mat-flat-button [disabled]="form.invalid">Enregistrer</button></form></mat-card>}
<div class="grid"><mat-card class="list"><table><thead><tr><th>N° inventaire</th><th>Désignation</th><th>Localisation</th><th>État</th><th>Statut</th><th></th></tr></thead><tbody>@for(a of assets();track a.id){<tr><td>{{a.inventory_number}}</td><td>{{a.name}}</td><td>{{a.location?.name||'—'}}</td><td>{{labels[a.condition]}}</td><td>{{labels[a.status]}}</td><td><button mat-button (click)="select(a)">Détails</button></td></tr>}@empty{<tr><td colspan="6">Aucun équipement.</td></tr>}</tbody></table></mat-card>
@if(selected(); as asset){<mat-card class="detail"><h2>{{asset.inventory_number}} — {{asset.name}}</h2><p class="muted">Statut : {{labels[asset.status]}} @if(asset.assigned_to){ · Affecté à {{asset.assigned_to}} }</p><h3>Opération</h3><form [formGroup]="operationForm" (ngSubmit)="operate()"><mat-form-field><mat-label>Type</mat-label><mat-select formControlName="type">@for(x of operationTypes;track x){<mat-option [value]="x">{{labels[x]}}</mat-option>}</mat-select></mat-form-field><mat-form-field><mat-label>Destination</mat-label><mat-select formControlName="destination_location_id">@for(l of locations();track l.id){<mat-option [value]="l.id">{{l.name}}</mat-option>}</mat-select></mat-form-field><mat-form-field><mat-label>Affecté à</mat-label><input matInput formControlName="assigned_to"></mat-form-field><mat-form-field><mat-label>Motif</mat-label><input matInput formControlName="reason"></mat-form-field><mat-form-field><mat-label>Notes</mat-label><input matInput formControlName="notes"></mat-form-field><button mat-flat-button [disabled]="operationForm.invalid">Enregistrer l’opération</button></form><h3>Maintenance</h3><form [formGroup]="maintenanceForm" (ngSubmit)="addMaintenance()"><mat-form-field><mat-label>Date</mat-label><input matInput type="date" formControlName="performed_at"></mat-form-field><mat-form-field><mat-label>Type</mat-label><input matInput formControlName="type"></mat-form-field><mat-form-field><mat-label>Statut</mat-label><mat-select formControlName="status">@for(x of maintenanceStatuses;track x){<mat-option [value]="x">{{labels[x]}}</mat-option>}</mat-select></mat-form-field><mat-form-field><mat-label>Prestataire</mat-label><input matInput formControlName="provider"></mat-form-field><mat-form-field><mat-label>Coût</mat-label><input matInput type="number" step="0.01" formControlName="cost"></mat-form-field><mat-form-field class="span"><mat-label>Description</mat-label><input matInput formControlName="description"></mat-form-field><button mat-flat-button [disabled]="maintenanceForm.invalid">Ajouter la maintenance</button></form><h3>Historique des opérations</h3><table><thead><tr><th>Référence</th><th>Type</th><th>Source</th><th>Destination</th><th>Responsable</th></tr></thead><tbody>@for(o of operations();track o.id){<tr><td>{{o.reference}}</td><td>{{labels[o.type]}}</td><td>{{o.source_location?.name||'—'}}</td><td>{{o.destination_location?.name||'—'}}</td><td>{{o.assigned_to||'—'}}</td></tr>}@empty{<tr><td colspan="5">Aucune opération.</td></tr>}</tbody></table><h3>Maintenances</h3><table><thead><tr><th>Date</th><th>Type</th><th>Statut</th><th>Prestataire</th><th>Coût</th></tr></thead><tbody>@for(m of maintenances();track m.id){<tr><td>{{m.performed_at}}</td><td>{{m.type}}</td><td><mat-select class="status-select" [value]="m.status" [disabled]="m.status === 'completed' || m.status === 'cancelled'" (selectionChange)="updateMaintenance(m, $event.value)">@for(x of maintenanceStatuses;track x){<mat-option [value]="x">{{labels[x]}}</mat-option>}</mat-select></td><td>{{m.provider||'—'}}</td><td>{{m.cost||'—'}}</td></tr>}@empty{<tr><td colspan="5">Aucune maintenance.</td></tr>}</tbody></table></mat-card>}</div>`,
  styles: `.heading{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;gap:12px}h1{margin:0;font-size:28px}p{color:#687278}.form-card,.list,.detail{padding:18px;margin-bottom:18px}form{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;align-items:center}.form-card button,.detail button{background:#123a4a;color:white}table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:11px 8px;border-bottom:1px solid #e6e8e9;vertical-align:middle}.grid{display:grid;grid-template-columns:1fr;gap:18px}h2{font-size:18px;margin:0 0 4px}h3{font-size:16px;margin:18px 0 10px}.muted{margin:0 0 12px;color:#687278}.span{grid-column:span 2}.status-select{width:150px}@media(max-width:800px){form{grid-template-columns:1fr}.span{grid-column:auto}.list,.detail{overflow-x:auto}}`,
})
export class AssetsComponent {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);
  readonly open = signal(false);
  readonly assets = signal<Asset[]>([]);
  readonly locations = signal<any[]>([]);
  readonly selected = signal<Asset | null>(null);
  readonly operations = signal<any[]>([]);
  readonly maintenances = signal<any[]>([]);
  readonly conditions = ['new', 'very_good', 'good', 'fair', 'repair', 'out_of_service', 'retired'];
  readonly statuses = ['available', 'assigned', 'maintenance', 'out_of_service', 'retired'];
  readonly operationTypes = ['assignment', 'transfer', 'return'];
  readonly maintenanceStatuses = ['scheduled', 'in_progress', 'completed', 'cancelled'];
  readonly labels: Record<string, string> = { new: 'Neuf', very_good: 'Très bon', good: 'Bon', fair: 'Moyen', repair: 'À réparer', out_of_service: 'Hors service', retired: 'Réformé', available: 'Disponible', assigned: 'Affecté', maintenance: 'Maintenance', assignment: 'Affectation', transfer: 'Transfert', return: 'Retour', scheduled: 'Planifiée', in_progress: 'En cours', completed: 'Terminée', cancelled: 'Annulée' };
  readonly form = this.fb.group({ inventory_number: ['', Validators.required], name: ['', Validators.required], location_id: [null], brand: [''], model: [''], serial_number: [''], condition: ['good', Validators.required], status: ['available', Validators.required] });
  readonly operationForm = this.fb.group({ type: ['assignment', Validators.required], destination_location_id: [null, Validators.required], assigned_to: [''], reason: ['', Validators.required], notes: [''] });
  readonly maintenanceForm = this.fb.group({ performed_at: [new Date().toISOString().slice(0, 10), Validators.required], type: ['', Validators.required], description: ['', Validators.required], provider: [''], cost: [null], status: ['scheduled', Validators.required], notes: [''] });

  constructor() {
    this.load();
    this.api.get<any>('settings/locations').subscribe(x => this.locations.set(x.data));
  }

  load() {
    this.api.get<any>('assets').subscribe(x => this.assets.set(x.data));
  }

  save() {
    if (this.form.invalid) return;
    this.api.post('assets', this.form.getRawValue()).subscribe(() => {
      this.form.reset({ condition: 'good', status: 'available' });
      this.open.set(false);
      this.load();
    });
  }

  select(asset: Asset) {
    this.selected.set(asset);
    this.api.get<any>(`assets/${asset.id}/operations`).subscribe(x => this.operations.set(x.data));
    this.api.get<any>(`assets/${asset.id}/maintenances`).subscribe(x => this.maintenances.set(x.data));
  }

  operate() {
    const asset = this.selected();
    if (!asset || this.operationForm.invalid) return;
    this.api.post(`assets/${asset.id}/operations`, this.operationForm.getRawValue()).subscribe(() => this.reloadSelected(asset.id));
  }

  addMaintenance() {
    const asset = this.selected();
    if (!asset || this.maintenanceForm.invalid) return;
    this.api.post(`assets/${asset.id}/maintenances`, this.maintenanceForm.getRawValue()).subscribe(() => this.reloadSelected(asset.id));
  }

  updateMaintenance(maintenance: any, status: string) {
    const asset = this.selected();
    if (!asset || maintenance.status === status) return;
    this.api.patch(`assets/${asset.id}/maintenances/${maintenance.id}`, { ...maintenance, status }).subscribe(() => this.reloadSelected(asset.id));
  }

  private reloadSelected(id: number) {
    this.load();
    this.api.get<Asset>(`assets/${id}`).subscribe(asset => this.select(asset));
  }
}

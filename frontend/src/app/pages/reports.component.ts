import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { ApiService } from '../core/api.service';

@Component({standalone:true,imports:[MatButtonModule,MatCardModule],template:`<section><h1>Rapports</h1><p>États exportables issus des données courantes.</p><mat-card><h2>État du stock</h2><p>Liste les quantités disponibles, les unités et les seuils minimums.</p><button mat-flat-button (click)="download('reports/stock.pdf','etat-stock.pdf')">Télécharger PDF</button><button mat-stroked-button (click)="download('reports/stock.csv','etat-stock.csv')">Exporter pour Excel</button></mat-card></section>`,styles:`h1{margin:0;font-size:28px}p{color:#687278}mat-card{padding:20px;max-width:650px;margin-top:20px}h2{margin-top:0}button:first-of-type{background:#123a4a;color:#fff;margin-right:10px}`})
export class ReportsComponent {private api=inject(ApiService);download(path:string,name:string){this.api.download(path).subscribe(blob=>{const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);});}}

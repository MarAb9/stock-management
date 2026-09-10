import { Component, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { ApiService } from '../core/api.service';

@Component({
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatButtonModule, MatIconModule, MatSidenavModule, MatToolbarModule],
  template: `
  <mat-sidenav-container class="shell"><mat-sidenav #drawer mode="side" opened class="nav">
    <div class="brand"><span>CSL</span><div>Conseil Scientifique<small>Berkane · Stock</small></div></div>
    @for (item of items; track item.path) { <a mat-button [routerLink]="item.path" routerLinkActive="active"><mat-icon>{{item.icon}}</mat-icon>{{item.label}}</a> }
  </mat-sidenav><mat-sidenav-content>
    <mat-toolbar class="topbar"><button mat-icon-button (click)="drawer.toggle()"><mat-icon>menu</mat-icon></button><span class="spacer"></span><span class="user">{{ api.user()?.name }}</span><button mat-button (click)="logout()">Déconnexion</button></mat-toolbar>
    <main><router-outlet /></main>
  </mat-sidenav-content></mat-sidenav-container>`,
  styles: `.shell{height:100vh}.nav{width:248px;border:0;background:#123a4a;color:#e8f0f2;padding:12px}.brand{display:flex;gap:10px;align-items:center;font-weight:600;padding:12px 8px 22px}.brand span{background:#e5b95c;color:#153845;padding:10px 7px;border-radius:8px}.brand small{display:block;font-size:11px;font-weight:400;margin-top:3px}.nav a{width:100%;justify-content:flex-start;color:#e8f0f2;margin:3px 0;gap:10px}.nav a.active{background:#2a5666}.topbar{background:#fff;border-bottom:1px solid #e4e7e8}.spacer{flex:1}.user{font-size:14px;margin-right:12px}main{padding:24px;max-width:1500px;margin:auto}@media(max-width:700px){main{padding:14px}.nav{width:220px}}`
})
export class ShellComponent {
  readonly api = inject(ApiService); private router = inject(Router);
  readonly items = [{path:'/',icon:'dashboard',label:'Tableau de bord'},{path:'/produits',icon:'inventory_2',label:'Produits'},{path:'/mouvements',icon:'swap_horiz',label:'Mouvements'},{path:'/equipements',icon:'desktop_windows',label:'Équipements'},{path:'/inventaires',icon:'fact_check',label:'Inventaires'},{path:'/rapports',icon:'summarize',label:'Rapports'},{path:'/parametres',icon:'settings',label:'Référentiels'}];
  logout() { this.api.post('auth/logout', {}).subscribe({ complete: () => this.finishLogout(), error: () => this.finishLogout() }); }
  private finishLogout() { this.api.clearSession(); this.router.navigateByUrl('/connexion'); }
}

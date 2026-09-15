import { Routes } from '@angular/router';
import { authGuard } from './core/api.service';

export const routes: Routes = [
  { path: 'connexion', loadComponent: () => import('./pages/login.component').then(m => m.LoginComponent) },
  { path: '', canActivate: [authGuard], loadComponent: () => import('./layout/shell.component').then(m => m.ShellComponent), children: [
    { path: '', pathMatch: 'full', loadComponent: () => import('./pages/dashboard.component').then(m => m.DashboardComponent) },
    { path: 'produits', title: 'Produits', loadComponent: () => import('./pages/products.component').then(m => m.ProductsComponent) },
    { path: 'produits/nouveau', title: 'Nouveau produit', loadComponent: () => import('./pages/product-detail.component').then(m => m.ProductDetailComponent) },
    { path: 'produits/:id', title: 'Détail du produit', loadComponent: () => import('./pages/product-detail.component').then(m => m.ProductDetailComponent) },
    { path: 'mouvements', loadComponent: () => import('./pages/stock.component').then(m => m.StockComponent) },
    { path: 'equipements', loadComponent: () => import('./pages/assets.component').then(m => m.AssetsComponent) },
    { path: 'inventaires', loadComponent: () => import('./pages/inventory.component').then(m => m.InventoryComponent) },
    { path: 'rapports', loadComponent: () => import('./pages/reports.component').then(m => m.ReportsComponent) },
    { path: 'parametres', loadComponent: () => import('./pages/settings.component').then(m => m.SettingsComponent) },
  ] },
  { path: '**', redirectTo: '' },
];

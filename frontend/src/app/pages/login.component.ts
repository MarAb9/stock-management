import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ApiService } from '../core/api.service';

@Component({ standalone: true, imports: [ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule], template: `
<section class="login"><mat-card><div class="seal">CSL</div><h1>Gestion de stock</h1><p>Conseil Scientifique Local de Berkane</p><form [formGroup]="form" (ngSubmit)="submit()"><mat-form-field><mat-label>Adresse e-mail</mat-label><input matInput type="email" formControlName="email"></mat-form-field><mat-form-field><mat-label>Mot de passe</mat-label><input matInput type="password" formControlName="password"></mat-form-field>@if (error()) { <div class="error">{{error()}}</div> }<button mat-flat-button [disabled]="form.invalid || loading()">{{loading() ? 'Connexion…' : 'Se connecter'}}</button></form></mat-card></section>`, styles: `.login{min-height:100vh;display:grid;place-items:center;background:#123a4a;padding:20px}.login mat-card{width:min(420px,100%);padding:32px}.seal{display:inline-block;padding:10px 8px;border-radius:8px;background:#e5b95c;color:#153845;font-weight:bold}h1{margin:18px 0 4px;font-size:28px}p{margin:0 0 22px;color:#687278}form{display:grid;gap:10px}mat-form-field{width:100%}button{height:46px;background:#123a4a!important;color:white!important}.error{color:#b42318;font-size:13px}` })
export class LoginComponent {
  private fb = inject(FormBuilder); private router = inject(Router); private api = inject(ApiService);
  readonly loading = signal(false); readonly error = signal(''); readonly form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]], password: ['', Validators.required] });
  submit() { if (this.form.invalid) return; this.loading.set(true); this.error.set(''); this.api.login(this.form.getRawValue()).subscribe({ next: s => { this.api.setSession(s); this.router.navigateByUrl('/'); }, error: () => { this.error.set('Connexion refusée. Vérifiez vos identifiants.'); this.loading.set(false); } }); }
}

import { Component, effect, inject, untracked } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { RouterOutlet } from '@angular/router';
import { map, of, switchMap, timer } from 'rxjs';
import { ApiService } from './core/api.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, MatProgressBarModule, MatSnackBarModule],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  readonly api = inject(ApiService);
  private snackBar = inject(MatSnackBar);
  readonly showProgress = toSignal(
    toObservable(this.api.pending).pipe(
      switchMap(pending => pending ? timer(180).pipe(map(() => true)) : of(false)),
    ),
    { initialValue: false },
  );

  constructor() {
    effect(() => {
      const message = this.api.error();
      if (!message) return;
      untracked(() => this.api.error.set(''));
      this.snackBar.open(message, 'Fermer', {
        announcementMessage: message,
        duration: 6500,
        panelClass: ['feedback-error'],
        politeness: 'assertive',
      });
    });
    effect(() => {
      const message = this.api.notice();
      if (!message) return;
      untracked(() => this.api.notice.set(''));
      this.snackBar.open(message, 'Fermer', {
        announcementMessage: message,
        duration: 3500,
        panelClass: ['feedback-success'],
        politeness: 'polite',
      });
    });
  }
}

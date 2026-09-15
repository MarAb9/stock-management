import { Component, inject, Injectable } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { map } from 'rxjs';

export interface ConfirmationData {
  title: string;
  message: string;
  confirmLabel: string;
}

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>{{ data.message }}</mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button cdkFocusInitial (click)="dialogRef.close(false)">Annuler</button>
      <button mat-flat-button color="warn" (click)="dialogRef.close(true)">{{ data.confirmLabel }}</button>
    </mat-dialog-actions>
  `,
})
export class ConfirmationDialogComponent {
  readonly data = inject<ConfirmationData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<ConfirmationDialogComponent>);
}

@Injectable({ providedIn: 'root' })
export class ConfirmationService {
  private dialog = inject(MatDialog);

  confirm(data: ConfirmationData) {
    return this.dialog.open(ConfirmationDialogComponent, {
      data,
      maxWidth: '440px',
      width: 'calc(100% - 32px)',
      restoreFocus: true,
    }).afterClosed().pipe(map(Boolean));
  }
}

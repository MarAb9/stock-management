import { Component, inject } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatDialogHarness } from '@angular/material/dialog/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { ConfirmationService } from './confirmation.service';

@Component({ standalone: true, template: '<button (click)="open()">Valider</button>' })
class ConfirmationHost {
  private confirmation = inject(ConfirmationService);
  result: boolean | undefined;
  open() {
    this.confirmation.confirm({ title: 'Valider l’inventaire ?', message: 'La session sera clôturée. Cette action est irréversible.', confirmLabel: 'Valider' }).subscribe(result => this.result = result);
  }
}

describe('ConfirmationService', () => {
  it('requires an explicit accessible dialog decision', async () => {
    await TestBed.configureTestingModule({ imports: [ConfirmationHost], providers: [provideNoopAnimations()] }).compileComponents();
    const fixture = TestBed.createComponent(ConfirmationHost);
    const host = fixture.componentInstance;
    const loader = TestbedHarnessEnvironment.documentRootLoader(fixture);

    host.open();
    let dialog = await loader.getHarness(MatDialogHarness);
    expect(await dialog.getTitleText()).toBe('Valider l’inventaire ?');
    expect(await dialog.getContentText()).toContain('irréversible');
    let buttons = await dialog.getAllHarnesses(MatButtonHarness);
    await buttons[0].click();
    expect(host.result).toBe(false);

    host.open();
    dialog = await loader.getHarness(MatDialogHarness);
    buttons = await dialog.getAllHarnesses(MatButtonHarness);
    await buttons[1].click();
    expect(host.result).toBe(true);
  });
});

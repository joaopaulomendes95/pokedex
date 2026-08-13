import { NgComponentOutlet } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DetailsDialogData, DialogAction } from '@shared/ui/dialog/dialog.interface';

/**
 * Slide-in "DetailDialog" host: identity header +
 * badges, an embedded content component via NgComponentOutlet, and a reactive
 * action footer. Opened through AppDialog.openDetails().
 */
@Component({
  selector: 'app-details-block',
  imports: [MatDialogModule, MatButtonModule, MatTooltipModule, NgComponentOutlet],
  templateUrl: './details-block.component.html',
  styleUrl: './details-block.component.scss',
})
export class DetailsDialog {
  readonly dialogRef = inject(MatDialogRef<DetailsDialog, boolean>);
  readonly dialogData = inject<DetailsDialogData>(MAT_DIALOG_DATA);

  readonly dialogActions = computed<DialogAction[]>(() => {
    const actions = this.dialogData.actions;
    return Array.isArray(actions) ? actions : (actions?.() ?? []);
  });

  cancel(): void {
    this.dialogRef.close(false);
  }

  handleAction(action: DialogAction): void {
    action.handler();
  }
}

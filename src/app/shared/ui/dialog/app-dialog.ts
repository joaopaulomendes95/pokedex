import { inject, Service } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import {
  ActionResult,
  DialogData,
  DetailsBadge,
  DetailsDialogData,
} from '@shared/ui/dialog/dialog.interface';
import { ConfirmationDialog } from '@shared/ui/dialog/confirmation-dialog/confirmation-dialog';
import { ResultDialog } from '@shared/ui/dialog/result-dialog/result-dialog';
import { DetailsDialog } from '@shared/ui/dialog/details-block/details-block';

export type DialogSize = 'small' | 'medium' | 'big';

@Service()
export class AppDialog {
  #dialog = inject(MatDialog);

  private getDialogSizeClass(size?: DialogSize): string {
    switch (size) {
      case 'small':
        return 'dialog-sm';
      case 'big':
        return 'dialog-lg';
      default:
        return 'dialog-md';
    }
  }

  private getDialogIcon(type: DialogData['type']): string {
    switch (type) {
      case 'confirm':
        return 'circle-check';
      case 'warn':
      case 'danger':
        return 'circle-exclamation';
      case 'delete':
        return 'circle-xmark';
      default:
        return 'circle';
    }
  }

  #commonOptions = { autoFocus: false };

  open(data: DialogData): MatDialogRef<ConfirmationDialog, boolean> {
    return this.#dialog.open<ConfirmationDialog, DialogData, boolean>(ConfirmationDialog, {
      ...this.#commonOptions,
      data: {
        ...data,
        faIcon: data.faIcon ?? this.getDialogIcon(data.type),
      },
      panelClass: ['app-dialog-container', this.getDialogSizeClass(data.size)],
    });
  }

  showResult(data: ActionResult): MatDialogRef<ResultDialog, boolean> {
    return this.#dialog.open<ResultDialog, ActionResult, boolean>(ResultDialog, {
      ...this.#commonOptions,
      data,
      panelClass: ['app-dialog-container', 'dialog-md'],
    });
  }

  /** Slide-in "DetailDialog" record viewer. */
  openDetails(data: DetailsDialogData): MatDialogRef<DetailsDialog, boolean> {
    return this.#dialog.open<DetailsDialog, DetailsDialogData, boolean>(DetailsDialog, {
      ...this.#commonOptions,
      data,
      panelClass: ['app-dialog-container', 'details-dialog', 'slideIn-fromRight'],
      maxWidth: '92vw',
    });
  }

  /** Open a DetailsDialog from raw identity + badge helpers. */
  openDetail(name: string, headline?: string, badges?: DetailsBadge[]): void {
    this.openDetails({ name, headline, badges });
  }
}

import { inject, Service } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import {
  ActionResult,
  DialogData,
  DetailsBadge,
  DetailsDialogData,
  FormDialogData,
  FormDialogResult,
} from '@core/models/dialog.interface';
import { ConfirmationDialogComponent } from '@shared/ui/dialog/confirmation-dialog/confirmation-dialog.component';
import { FormDialogComponent } from '@shared/ui/dialog/form-dialog/form-dialog.component';
import { ResultDialogComponent } from '@shared/ui/dialog/result-dialog/result-dialog.component';
import { DetailsBlockComponent } from '@shared/ui/dialog/details-block/details-block.component';

export type DialogSize = 'small' | 'medium' | 'big';

@Service()
export class AppDialogService {
  private readonly dialog = inject(MatDialog);

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

  private readonly commonOptions = { autoFocus: false };

  open(data: DialogData): MatDialogRef<ConfirmationDialogComponent, boolean> {
    return this.dialog.open<ConfirmationDialogComponent, DialogData, boolean>(
      ConfirmationDialogComponent,
      {
        ...this.commonOptions,
        data: {
          ...data,
          faIcon: data.faIcon ?? this.getDialogIcon(data.type),
        },
        panelClass: ['app-dialog-container', this.getDialogSizeClass(data.size)],
      },
    );
  }

  openForm(data: FormDialogData): MatDialogRef<FormDialogComponent, FormDialogResult[] | false> {
    return this.dialog.open<FormDialogComponent, FormDialogData, FormDialogResult[] | false>(
      FormDialogComponent,
      {
        ...this.commonOptions,
        data: {
          ...data,
          faIcon: data.faIcon ?? this.getDialogIcon(data.type),
        },
        panelClass: ['app-dialog-container', this.getDialogSizeClass(data.size)],
      },
    );
  }

  showResult(data: ActionResult): MatDialogRef<ResultDialogComponent, boolean> {
    return this.dialog.open<ResultDialogComponent, ActionResult, boolean>(ResultDialogComponent, {
      ...this.commonOptions,
      data,
      panelClass: ['app-dialog-container', 'dialog-md'],
    });
  }

  /** Slide-in "DetailDialog" record viewer. */
  openDetails(data: DetailsDialogData): MatDialogRef<DetailsBlockComponent, boolean> {
    return this.dialog.open<DetailsBlockComponent, DetailsDialogData, boolean>(
      DetailsBlockComponent,
      {
        ...this.commonOptions,
        data,
        panelClass: ['app-dialog-container', 'details-dialog', 'slideIn-fromRight'],
        maxWidth: '92vw',
      },
    );
  }

  /** Open a DetailsDialog from raw identity + badge helpers. */
  openDetail(name: string, headline?: string, badges?: DetailsBadge[]): void {
    this.openDetails({ name, headline, badges });
  }
}
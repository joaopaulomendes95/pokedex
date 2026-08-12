import { inject, Service } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { LoaderData } from '@core/models/loader.interface';
import { PopLoaderComponent } from '@layout/loaders/pop-loader.component/pop-loader.component';

/**
 * Blocking loading overlay:
 * opens a non-dismissible MatDialog spinner/bar while a long operation runs.
 */
@Service()
export class AppLoaderService {
  private readonly dialog = inject(MatDialog);
  private dialogRef?: MatDialogRef<PopLoaderComponent>;

  open(data: LoaderData): MatDialogRef<PopLoaderComponent> {
    this.dialogRef = this.dialog.open(PopLoaderComponent, {
      data,
      disableClose: true,
      autoFocus: false,
    });
    return this.dialogRef;
  }

  close(): void {
    if (this.dialogRef) {
      this.dialogRef.close();
      this.dialogRef = undefined;
    }
  }
}

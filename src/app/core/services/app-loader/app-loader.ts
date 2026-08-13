import { inject, Service } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { LoaderData } from '@core/models/loader.interface';
import { PopLoader } from '@layout/loaders/pop-loader.component/pop-loader';

/**
 * Blocking loading overlay:
 * opens a non-dismissible MatDialog spinner/bar while a long operation runs.
 */
@Service()
export class AppLoader {
  #dialog = inject(MatDialog);
  #dialogRef?: MatDialogRef<PopLoader>;

  open(data: LoaderData): MatDialogRef<PopLoader> {
    this.#dialogRef = this.#dialog.open(PopLoader, {
      data,
      disableClose: true,
      autoFocus: false,
    });
    return this.#dialogRef;
  }

  close(): void {
    if (this.#dialogRef) {
      this.#dialogRef.close();
      this.#dialogRef = undefined;
    }
  }
}

import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { DialogData } from '@shared/ui/dialog/dialog.interface';

@Component({
  selector: 'app-dialog',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './confirmation-dialog.component.html',
  styleUrl: './confirmation-dialog.component.scss',
})
export class ConfirmationDialog {
  readonly dialogData = inject<DialogData>(MAT_DIALOG_DATA);
  #dialogRef = inject(MatDialogRef<ConfirmationDialog, boolean>);

  cancel(): void {
    this.#dialogRef.close(false);
  }

  confirm(): void {
    this.#dialogRef.close(true);
  }
}

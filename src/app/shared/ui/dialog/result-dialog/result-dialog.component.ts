import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ActionResult } from '@core/models/dialog.interface';

@Component({
  selector: 'app-result-dialog',
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './result-dialog.component.html',
  styleUrl: './result-dialog.component.scss',
})
export class ResultDialogComponent {
  readonly dialogData = inject<ActionResult>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ResultDialogComponent, boolean>);

  readonly faIcon = this.dialogData.success ? 'circle-check' : 'circle-xmark';
  readonly title = this.dialogData.title ?? (this.dialogData.success ? 'Success' : 'Something went wrong');
  readonly message = this.dialogData.message ?? '';

  close(): void {
    this.dialogRef.close(true);
  }
}
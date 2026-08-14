import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { CustomSpinner } from '@shared/ui';
import { LoaderData } from '@core/models/loader.interface';

@Component({
  selector: 'app-pop-loader',
  imports: [CustomSpinner, MatProgressBarModule],
  templateUrl: './pop-loader.component.html',
  styleUrl: './pop-loader.component.scss',
})
export class PopLoader {
  readonly dialogRef = inject(MatDialogRef<PopLoader>);
  readonly loaderData = inject<LoaderData>(MAT_DIALOG_DATA);
}

import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LoaderData } from '@core/models/loader.interface';

@Component({
  selector: 'app-pop-loader',
  standalone: true,
  imports: [MatProgressSpinnerModule, MatProgressBarModule],
  templateUrl: './pop-loader.component.html',
  styleUrl: './pop-loader.component.scss',
})
export class PopLoaderComponent {
  readonly dialogRef = inject(MatDialogRef<PopLoaderComponent>);
  readonly loaderData = inject<LoaderData>(MAT_DIALOG_DATA);
}

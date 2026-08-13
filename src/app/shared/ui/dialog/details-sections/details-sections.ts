import { Component, inject, input } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { DetailsSection, SectionAction } from '@shared/ui/dialog/dialog.interface';
import { BlockDetailsDataPipe } from '@shared/ui/dialog/details-block/block-details-data-pipe';

/** Read-only field grid: sections → rows (cols-N) → label/value blocks. */
@Component({
  selector: 'app-details-sections',
  imports: [BlockDetailsDataPipe],
  templateUrl: './details-sections.component.html',
  styleUrl: './details-sections.component.scss',
})
export class DetailsSections {
  readonly sections = input<DetailsSection[]>([]);

  #dialogRef = inject<MatDialogRef<unknown, boolean> | null>(MatDialogRef, {
    optional: true,
  });

  headerAction(section: SectionAction): void {
    if (section.closeOnClick) this.#dialogRef?.close();
    section.handler();
  }
}

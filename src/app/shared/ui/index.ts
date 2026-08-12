export {
  CustomChipComponent,
  type CustomChipColor,
} from '@shared/ui/custom-chip/custom-chip.component';
export {
  KpiBlockComponent,
  type MetricData,
  type FluctuationChipData,
} from '@shared/ui/kpi-block/kpi-block.component';
export { ProgressGaugeComponent } from '@shared/ui/progress-gauge/progress-gauge.component';
export { ContainerMarkComponent } from '@shared/ui/container-mark/container-mark.component';
export { BasicViewComponent } from '@shared/ui/basic-view/basic-view.component';
export {
  ObjectContainerComponent,
  type ObjectContainerHeader,
  type ObjectContainerHeaderButton,
} from '@shared/ui/object-container/object-container.component';
export { GeneralTileList as GeneralTileListComponent } from '@shared/ui/general-tile-list/general-tile-list.component';
export {
  type ColumnDefinition,
  type RowAction,
} from '@shared/ui/general-tile-list/general-list.model';

// ---- Dialog system ----------------------------------------------------
export { AppDialogService } from '@shared/ui/dialog/app-dialog.service';
export { ConfirmationDialogComponent } from '@shared/ui/dialog/confirmation-dialog/confirmation-dialog.component';
export { FormDialogComponent } from '@shared/ui/dialog/form-dialog/form-dialog.component';
export { ResultDialogComponent } from '@shared/ui/dialog/result-dialog/result-dialog.component';
export { DetailsBlockComponent } from '@shared/ui/dialog/details-block/details-block.component';
export { DetailsSectionsComponent } from '@shared/ui/dialog/details-sections/details-sections.component';
export { BlockDetailsDataPipe } from '@shared/ui/dialog/details-block/block-details-data.pipe';
export {
  type DialogData,
  type DialogType,
  type FormDialogData,
  type FormDialogResult,
  type SelectList,
  type ActionResult,
  type DetailsDialogData,
  type DetailsBadge,
  type DialogAction,
  type DetailsSection,
  type DetailsBlockRow,
  type DetailsBlock,
  type SectionAction,
  type DetailsDialogDataTable,
  type DetailsDialogDataTableHeader,
} from '@core/models/dialog.interface';

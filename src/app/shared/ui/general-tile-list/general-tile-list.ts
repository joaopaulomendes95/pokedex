import { CommonModule } from '@angular/common';
import { Component, TemplateRef, computed, contentChild, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { GeneralListBase } from '@shared/ui/general-tile-list/general-list-base';

/**
 * GeneralTileList — a searchable/sortable/filterable, paginated CSS-grid
 * of tiles. Rows come from `dataProvider`, the per-tile look comes from a
 * projected `#tile` template (`{ $implicit: row, index: $index }`).
 */
@Component({
  selector: 'app-general-tile-list',
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './general-tile-list.component.html',
  styleUrl: './general-tile-list.component.scss',
})
export class GeneralTileList<T extends Record<string, unknown>> extends GeneralListBase<T> {
  tileMinWidth = input<number>(240);
  tileColumns = input<number>(0);
  /** Stable identity for `@for` tracking; falls back to the row index. */
  trackBy = input<(row: T) => unknown>((_row) => undefined);

  readonly tile = contentChild<TemplateRef<unknown>>('tile');

  /** Track key for a row — use a real id when rows can be reordered/filtered. */
  rowTrack(index: number, row: T): unknown {
    return this.trackBy()(row) ?? index;
  }

  sortableColumns = computed(() => this.columns().filter((column) => column.sortable));
  filterableColumns = computed(() => this.columns().filter((column) => column.filterable));
  gridTemplateColumns = computed(() =>
    this.tileColumns() > 0
      ? `repeat(${this.tileColumns()}, minmax(0, 1fr))`
      : `repeat(auto-fill, minmax(${this.tileMinWidth()}px, 1fr))`,
  );

  onSearchInput(event: Event): void {
    this.onSearch((event.target as HTMLInputElement).value);
  }

  toggleSortDirection(): void {
    const column = this.sortColumn();
    if (column) this.onSort(column);
  }
}

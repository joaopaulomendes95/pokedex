import {
  Directive,
  DestroyRef,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';
import { PageEvent } from '@angular/material/paginator';
import { ColumnDefinition } from '@shared/ui/general-tile-list/general-list.model';

interface AppliedFilters<T extends Record<string, unknown>> {
  key: keyof T;
  selectedOptions: string[];
}

/** Search/sort/filter/paging engine shared by the general list + tile list. */
@Directive()
export abstract class GeneralListBase<T extends Record<string, unknown>> {
  static readonly ALL_FILTER_VALUE = '';

  private readonly destroyRef = inject(DestroyRef);

  // Inputs
  dataProvider = input.required<T[]>();
  columns = input.required<ColumnDefinition<T>[]>();
  defaultSort = input<keyof T>();
  defaultSortDirection = input<'asc' | 'desc'>('asc');
  showSearchInput = input<boolean>(true);

  rowHighlight = input<(row: T) => boolean>(() => false);

  externalFilters = input<Partial<Record<keyof T, string[]>>>({});

  pageSizeOptions = input<number[]>([5, 10, 25, 100]);
  initialPageSize = input<number>(10);

  totalCount = input<number>(0);
  loadingMore = input<boolean>(false);

  // Outputs
  rowClick = output<T>();
  loadMore = output<void>();
  /** Emitted when the search box changes — lets hosts drive a remote/external search. */
  searchChanged = output<string>();

  onRefresh = input<(auto?: boolean) => void>();
  isLoading = input<boolean>(false);
  hasError = input<boolean>(false);
  refreshIntervalMs = input<number>(5 * 60 * 1000);

  lastSyncedAt = signal<Date | null>(null);

  private readonly refreshLabelTick = signal(0);

  lastSyncedMinutesAgo = computed<number | null>(() => {
    const syncedAt = this.lastSyncedAt();
    if (!syncedAt) return null;
    this.refreshLabelTick();
    return Math.max(0, Math.floor((Date.now() - syncedAt.getTime()) / 60_000));
  });

  // State Signals
  searchTerm = signal<string>('');
  selectedFilters = signal<AppliedFilters<T>[]>([]);
  sortColumn = signal<keyof T | ''>('');
  sortDirection = signal<'asc' | 'desc'>('asc');

  // Pagination Signals
  currentPageIndex = signal<number>(0);
  currentPageSize = linkedSignal(() => this.initialPageSize());

  private readonly hasActiveQuery = computed(
    () => this.selectedFilters().length > 0 || this.searchTerm().trim().length > 0,
  );

  paginatorLength = computed(() =>
    this.hasActiveQuery()
      ? this.filteredData().length
      : Math.max(this.totalCount(), this.filteredData().length),
  );

  constructor() {
    // Apply the default sort column/direction once, if provided.
    effect(() => {
      if (!this.sortColumn()) {
        const initial = this.defaultSort();
        if (initial) this.sortColumn.set(initial);
      }
    });

    effect(() => {
      const external = this.externalFilters();
      const active: AppliedFilters<T>[] = [];
      for (const key of Object.keys(external) as (keyof T)[]) {
        const values = external[key];
        if (values && values.length > 0) {
          active.push({ key, selectedOptions: values });
        }
      }
      this.selectedFilters.set(active);
      this.currentPageIndex.set(0);
    });

    effect(() => {
      const rowsNeeded = (this.currentPageIndex() + 1) * this.currentPageSize();
      const rowsLoaded = this.dataProvider().length;
      if (
        !this.hasActiveQuery() &&
        !this.loadingMore() &&
        rowsNeeded > rowsLoaded &&
        this.totalCount() > rowsLoaded
      ) {
        this.loadMore.emit();
      }
    });

    let wasLoading = false;
    effect(() => {
      const loading = this.isLoading();
      if (wasLoading && !loading && !this.hasError()) {
        this.lastSyncedAt.set(new Date());
      }
      wasLoading = loading;
    });

    effect((onCleanup) => {
      if (!this.onRefresh()) return;
      this.lastSyncedAt();
      const intervalMs = this.refreshIntervalMs();
      if (!intervalMs) return;

      const sub = interval(intervalMs)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.refreshNow(true));
      onCleanup(() => sub.unsubscribe());
    });

    effect((onCleanup) => {
      if (!this.onRefresh()) return;
      if (!this.lastSyncedAt()) return;
      const sub = interval(30_000)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.refreshLabelTick.update((n) => n + 1));
      onCleanup(() => sub.unsubscribe());
    });

    effect((onCleanup) => {
      if (!this.onRefresh()) return;
      if (this.refreshIntervalMs() === 0) return;
      const handler = (): void => this.refreshNow(true);
      document.addEventListener('visibilitychange', handler);
      onCleanup(() => document.removeEventListener('visibilitychange', handler));
    });
  }

  refreshNow(auto = false): void {
    if (document.hidden) return;
    this.onRefresh()?.(auto);
  }

  private getFilterTokens(value: unknown): string[] {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) {
      return value
        .filter((item) => item !== null && item !== undefined)
        .map((item) => item.toString());
    }
    return [value.toString()];
  }

  filterOptionsByColumn = computed(() => {
    const options = new Map<keyof T, string[]>();
    for (const column of this.columns()) {
      if (!column.filterable) continue;

      const values = new Set<string>();
      for (const row of this.dataProvider()) {
        this.getFilterTokens(row[column.key]).forEach((token) => values.add(token));
      }
      options.set(column.key, Array.from(values).sort());
    }
    return options;
  });

  filteredData = computed(() => {
    const data = this.dataProvider();
    let filtered = [...this.dataProvider()];

    const activeFilters = this.selectedFilters();
    if (activeFilters.length > 0) {
      filtered = filtered.filter((item) => {
        return activeFilters.every((filter) => {
          const tokens = this.getFilterTokens(item[filter.key]);
          return tokens.some((token) => filter.selectedOptions.includes(token));
        });
      });
    }

    const term = this.searchTerm().toLowerCase().trim();
    if (term) {
      filtered = data.filter((item) =>
        this.columns().some((column) => {
          const value = item[column.key];
          return (
            value !== null && value !== undefined && value.toString().toLowerCase().includes(term)
          );
        }),
      );
    }

    const sortCol = this.sortColumn();
    if (sortCol) {
      const direction = this.sortDirection();
      filtered.sort((a, b) => {
        const aValue = a[sortCol];
        const bValue = b[sortCol];

        const strA = aValue !== null && aValue !== undefined ? aValue.toString() : '';
        const strB = bValue !== null && bValue !== undefined ? bValue.toString() : '';

        if (strA < strB) return direction === 'asc' ? -1 : 1;
        if (strA > strB) return direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  });

  pagedData = computed(() => {
    const start = this.currentPageIndex() * this.currentPageSize();
    const end = start + this.currentPageSize();
    return this.filteredData().slice(start, end);
  });

  onSearch(term: string): void {
    this.searchTerm.set(term);
    this.currentPageIndex.set(0);
    this.searchChanged.emit(term);
  }

  getColumnFilterOptions(columnKey: keyof T): string[] {
    return this.filterOptionsByColumn().get(columnKey) ?? [];
  }

  formatValue(columnKey: keyof T, row: T): string {
    const column = this.columns().find((c) => c.key === columnKey);
    if (column?.formatter) {
      return column.formatter(row[columnKey], row);
    }
    const value = row[columnKey];
    return value !== null && value !== undefined ? String(value) : '';
  }

  getColumnFilterValue(columnKey: keyof T): string[] {
    const applied = this.selectedFilters().find(
      (filter) => filter.key === columnKey,
    )?.selectedOptions;
    return applied && applied.length > 0 ? applied : [GeneralListBase.ALL_FILTER_VALUE];
  }

  onColumnFilterChange(columnKey: keyof T, selected: string[]): void {
    const current = this.getColumnFilterValue(columnKey);
    let next: string[];

    if (current[0] === GeneralListBase.ALL_FILTER_VALUE) {
      next = selected.filter((value) => value !== GeneralListBase.ALL_FILTER_VALUE);
    } else if (selected.includes(GeneralListBase.ALL_FILTER_VALUE)) {
      next = [];
    } else {
      next = selected;
    }

    this.selectedFilters.update((filters) => {
      const others = filters.filter((filter) => filter.key !== columnKey);
      return next.length > 0 ? [...others, { key: columnKey, selectedOptions: next }] : others;
    });
    this.currentPageIndex.set(0);
  }

  resetFilters(): void {
    this.selectedFilters.set([]);
    this.searchTerm.set('');
    this.currentPageIndex.set(0);
    this.searchChanged.emit('');
  }

  onSort(columnKey: keyof T): void {
    if (this.sortColumn() === columnKey) {
      this.sortDirection.update((dir) => (dir === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortColumn.set(columnKey);
      this.sortDirection.set('asc');
    }
    this.currentPageIndex.set(0);
  }

  handlePageEvent(e: PageEvent): void {
    this.currentPageIndex.set(e.pageIndex);
    this.currentPageSize.set(e.pageSize);
  }

  onRowClick(row: T): void {
    this.rowClick.emit(row);
  }
}

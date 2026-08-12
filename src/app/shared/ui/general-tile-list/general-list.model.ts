export interface ColumnDefinition<T extends Record<string, unknown>> {
  key: keyof T;
  isId?: boolean;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  formatter?: (value: unknown, row?: T) => string;
}

export interface RowAction<T extends Record<string, unknown>> {
  label: string;
  icon?: string;
  class?: string;
  handler: (row: T) => void;
  visible?: (row: T) => boolean;
}

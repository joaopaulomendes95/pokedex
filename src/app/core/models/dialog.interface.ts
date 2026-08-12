import { Signal, Type } from '@angular/core';

export type DialogType = 'warn' | 'confirm' | 'info' | 'danger' | 'delete' | 'error' | 'dim';

export interface SelectList {
  label: string;
  value: string | number | boolean;
}

interface DialogFormData {
  label: string;
  inputType: 'text' | 'password' | 'textarea' | 'select' | 'radio' | 'checkbox';
  inputKey: string;
  inputRequired?: boolean;
  inputOptions?: SelectList[];
}

export interface FormDialogData {
  title: string;
  type: DialogType;
  faIcon?: string;
  message?: string;
  warning?: string;
  actionLabel?: string;
  size?: 'small' | 'medium' | 'big';
  form: DialogFormData[];
}

export interface FormDialogResult {
  label: string;
  value: unknown;
}

export interface DialogData {
  title: string;
  message?: string;
  warning?: string;
  actionLabel?: string;
  type: DialogType;
  size?: 'small' | 'medium' | 'big';
  ask?: string;
  select?: SelectList[];
  askHidden?: boolean;
  faIcon?: string;
  textBox?: 'normal' | 'area';
}

export interface AskDialogResult {
  confirm: boolean;
  response: unknown;
}

export interface ActionResult {
  success: boolean;
  title?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Details dialog (slide-in record viewer) — the APP "DetailDialog" pattern
// ---------------------------------------------------------------------------

export interface DetailsBadge {
  color?: string;
  label: string;
}

export interface DialogAction {
  label: string;
  variant?: 'primary' | 'delete';
  appearance?: 'filled' | 'tonal';
  icon?: string;
  handler: () => void;
  hidden?: boolean;
  disabled?: boolean;
}

export interface DetailsDialogData {
  /** Slide-in header identity. */
  name: string;
  headline?: string;
  description?: string;
  badges?: DetailsBadge[];
  /** Optional leading-mark (FA icon name) shown as the header avatar. */
  faIcon?: string;
  /** Footer action buttons (static array or reactive Signal). */
  actions?: DialogAction[] | Signal<DialogAction[]>;
  /** Embedded content component — receives `contentData` as its `data` input. */
  content?: Type<unknown>;
  contentData?: unknown;
}

// ---------------------------------------------------------------------------
// Read-only detail sections (DetailsSectionsComponent)
// ---------------------------------------------------------------------------

export interface DetailsBlock {
  label: string;
  data: unknown[];
  suffix?: string;
  faIcon?: string;
  copy?: boolean;
}

export interface DetailsBlockRow {
  cols?: number;
  items: DetailsBlock[];
}

export interface SectionAction {
  label: string;
  icon?: string;
  closeOnClick?: boolean;
  hidden?: boolean;
  handler: () => void;
}

export interface DetailsSection {
  name?: string;
  sectionActions?: SectionAction[];
  style?: 'outline' | 'filled';
  rows: DetailsBlockRow[];
}

export interface DetailsDialogDataTableHeader {
  key: string;
  label: string;
}

export interface DetailsDialogDataTable {
  tableTitle?: string;
  headers: DetailsDialogDataTableHeader[];
  rows: Record<string, string>[];
}
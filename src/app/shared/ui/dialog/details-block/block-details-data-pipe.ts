import { Pipe, PipeTransform } from '@angular/core';

const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function toDateString(value: string): string {
  if (DATE_PATTERN.test(value)) {
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }
  if (DATETIME_PATTERN.test(value)) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(
      2,
      '0',
    )}/${date.getFullYear()} ${String(date.getHours()).padStart(2, '0')}:${String(
      date.getMinutes(),
    ).padStart(2, '0')}`;
  }
  return value;
}

/** Renders empty values as "Not available" and formats ISO date strings. */
@Pipe({ name: 'blockDetailsDataPipe' })
export class BlockDetailsDataPipe implements PipeTransform {
  transform(value: unknown): string {
    if (value === null || value === undefined || value === '') return 'Not available';
    if (typeof value === 'string') return toDateString(value);
    return String(value);
  }
}

import { Component, input } from '@angular/core';

export type CustomChipColor =
  'red' | 'yellow' | 'orange' | 'green' | 'purple' | 'main' | 'main-light' | 'desat';

@Component({
  selector: 'app-custom-chip',
  templateUrl: './custom-chip.component.html',
  styleUrl: './custom-chip.component.scss',
})
export class CustomChip {
  color = input<CustomChipColor>('main');
  faIcon = input<string>('');
  label = input<string>('');
}

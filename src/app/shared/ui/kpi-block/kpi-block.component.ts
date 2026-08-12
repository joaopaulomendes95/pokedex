import { Component, computed, input } from '@angular/core';
import { CustomChipComponent, type CustomChipColor } from '@shared/ui/custom-chip/custom-chip.component';

export interface MetricData {
  name: string;
  current: string | number;
  fluctuation?: number;
  goal?: string | number;
  lastMonth?: boolean;
  faIcon?: string;
  color?: string;
}

export interface FluctuationChipData {
  color: CustomChipColor;
  label: string;
  faIcon: string;
}

@Component({
  selector: 'app-kpi-block',
  imports: [CustomChipComponent],
  templateUrl: './kpi-block.component.html',
  styleUrl: './kpi-block.component.scss',
  host: {
    class: 'flat-container',
  },
})
export class KpiBlockComponent {
  readonly metricData = input.required<MetricData>();

  readonly chipData = computed<FluctuationChipData>(() => {
    const fluctuation = this.metricData().fluctuation ?? 0;
    return {
      color: this.fluctuationColor(fluctuation),
      label: this.fluctuationLabel(fluctuation),
      faIcon: this.fluctuationIcon(fluctuation),
    };
  });

  private fluctuationColor(value: number): CustomChipColor {
    if (value > 0) return 'green';
    if (value < 0) return 'red';
    return 'desat';
  }

  private fluctuationLabel(value: number): string {
    if (value > 0) return `+${value}%`;
    if (value < 0) return `${value}%`;
    return '0%';
  }

  private fluctuationIcon(value: number): string {
    if (value > 0) return 'trending_up';
    if (value < 0) return 'trending_down';
    return 'remove';
  }
}

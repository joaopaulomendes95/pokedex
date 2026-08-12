import { Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-progress-gauge',
  imports: [],
  templateUrl: './progress-gauge.component.html',
  styleUrl: './progress-gauge.component.scss',
})
export class ProgressGaugeComponent {
  readonly actual = input.required<number>();
  readonly goal = input.required<number>();
  readonly suffix = input<string>('');
  readonly size = input<string>('20rem');

  readonly goalPercentage = computed<number>(() => {
    return Math.floor((this.actual() * 100) / this.goal());
  });

  readonly goalHue = computed<number>(() => {
    return Math.floor((this.actual() / this.goal()) * 110);
  });
}

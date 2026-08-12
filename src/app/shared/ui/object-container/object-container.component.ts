import { Component, computed, EventEmitter, input, Output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

type AppearanceType = 'main' | 'dim' | 'tonal';
type ButtonAppearance =
  | 'main'
  | 'warn'
  | 'danger'
  | 'error'
  | 'delete'
  | 'cancel'
  | 'confirm'
  | 'ask'
  | 'info'
  | 'faded'
  | 'dim'
  | 'transparent';

export interface ObjectContainerHeader {
  title?: string;
  desc?: string;
  faIcon?: string;
}

export interface ObjectContainerHeaderButton {
  handler: () => void;
  buttonIcon?: string;
  buttonHint?: string;
  buttonClass: ButtonAppearance;
}

@Component({
  selector: 'app-object-container',
  imports: [MatTooltipModule, MatButtonModule],
  templateUrl: './object-container.component.html',
  styleUrl: './object-container.component.scss',
})
export class ObjectContainerComponent {
  readonly headerData = input<ObjectContainerHeader>();
  readonly headerAction = input<ObjectContainerHeaderButton>();
  readonly appearance = input<AppearanceType>('dim');

  @Output() buttonAction = new EventEmitter<void>();

  emitActionClick(): void {
    this.buttonAction.emit();
  }

  readonly hasActionListener = computed<boolean>(() => this.buttonAction.observed);
  readonly hasHeaderData = computed<boolean>(
    () => !!(this.headerData()?.faIcon || this.headerData()?.title || this.headerData()?.desc),
  );
}

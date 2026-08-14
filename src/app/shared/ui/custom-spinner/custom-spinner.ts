import { Component } from '@angular/core';

/**
 * The "bouncer" loading spinner (ported from the work repo's custom-spinner):
 * three colored balls orbit a circle while squashing through the center,
 * cycling through main-palette hues. Sizing is fully CSS-variable driven:
 *
 * ```html
 * <app-custom-spinner
 *   style="--CUSTOM-SPINNER-SCALE: 0.6; --CUSTOM-SPINNER-ANIMATION-DURATION: 3s"
 * />
 * ```
 */
@Component({
  selector: 'app-custom-spinner',
  imports: [],
  template: `
    <div class="custom-spinner-wrapper">
      <div class="bouncer-wrapper bouncer-wrapper-1">
        <div class="bouncer"></div>
      </div>
      <div class="bouncer-wrapper bouncer-wrapper-2">
        <div class="bouncer"></div>
      </div>
      <div class="bouncer-wrapper bouncer-wrapper-3">
        <div class="bouncer"></div>
      </div>
    </div>
  `,
  styleUrl: './custom-spinner.component.scss',
})
export class CustomSpinner {}

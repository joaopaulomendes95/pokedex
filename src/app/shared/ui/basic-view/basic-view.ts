import { Component, input } from '@angular/core';

@Component({
  selector: 'app-basic-view',
  templateUrl: './basic-view.component.html',
  styleUrl: './basic-view.component.scss',
  host: {
    class: 'flat-container',
    '[class.margin-top]': 'marginTop()',
  },
})
export class BasicView {
  pageTitle = input.required<string>();
  headline = input.required<string>();
  faIcon = input.required<string>();
  divided = input<boolean>(false);
  marginTop = input<boolean>(true);
}

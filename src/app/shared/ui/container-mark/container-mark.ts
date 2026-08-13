import { Component, input } from '@angular/core';

type EdgeType = 'dim' | 'main';

@Component({
  selector: 'app-container-mark',
  imports: [],
  templateUrl: './container-mark.component.html',
  styleUrl: './container-mark.component.scss',
})
export class ContainerMark {
  headerLarge = input<boolean>(false);
  title = input<string>('');
  edge = input<EdgeType>('dim');
  inverted = input<boolean>(false);
}

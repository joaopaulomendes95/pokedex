import { Component, ElementRef, ChangeDetectorRef, inject } from '@angular/core';
import { NavbarComponent } from '@layout/navbar/navbar.component';
import { PokeHubComponent } from '@poke/features/poke-hub/poke-hub.component';
import { GameService } from '@poke/game.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [NavbarComponent, PokeHubComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private nudgeFlag = false;

  constructor(game: GameService) {
    // Per-second render + repaint guarantee, wired to the game ticker.
    // - detectChanges() forces a synchronous full-tree CD. It does NOT run the
    //   dev-mode checkNoChanges pass that ApplicationRef.tick() does, so it
    //   can't throw ExpressionChanged errors with a live game.
    // - The opacity toggle (0.9999 <-> 1) promotes/demotes the app-root to its
    //   own composited layer every second, which forces the browser to
    //   re-rasterize the whole app regardless of stale-paint bugs.
    game.registerTickHook(() => {
      this.cdr.detectChanges();
      this.paintNudge();
    });
  }

  private paintNudge() {
    const el = this.host.nativeElement;
    this.nudgeFlag = !this.nudgeFlag;
    el.style.opacity = this.nudgeFlag ? '0.9999' : '1';
    // Force a synchronous reflow so the style change can't be coalesced.
    void el.offsetHeight;
  }
}

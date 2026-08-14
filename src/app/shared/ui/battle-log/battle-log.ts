import { Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { BattleEvent } from '@poke/poke.model';

/** A battle-log row enriched for the template (no logic in the template). */
export interface BattleLogRow {
  text: string;
  damage: number;
  ko: boolean;
  /** Attacker side — drives the accent color of the timeline entry. */
  side: 'player' | 'rival' | 'neutral';
  /** Material icon for the timeline dot. */
  icon: string;
}

/**
 * Reusable battle narration timeline (inspired by the work repo's log-block):
 * each resolved `BattleEvent` becomes a timeline row with an icon dot, the
 * narrated text and a damage badge. Player hits get a green accent, rival
 * hits red, knockouts are highlighted.
 */
@Component({
  selector: 'app-battle-log',
  imports: [MatIconModule],
  template: `
    <div class="battle-log">
      @for (row of rows(); track $index) {
        <div
          class="log-entry"
          [style.--i]="$index"
          [class.ko]="row.ko"
          [class.player]="row.side === 'player'"
          [class.rival]="row.side === 'rival'"
        >
          <span class="log-icon" [class.ko]="row.ko">
            <mat-icon>{{ row.icon }}</mat-icon>
          </span>
          <span class="log-text">{{ row.text }}</span>
          @if (row.damage > 0) {
            <span class="damage">{{ row.damage }}</span>
          }
        </div>
      } @empty {
        <p class="log-empty">No battle events yet.</p>
      }
    </div>
  `,
  styleUrl: './battle-log.component.scss',
})
export class BattleLog {
  /** Narration moments from a resolved battle, in chronological order. */
  readonly events = input.required<BattleEvent[]>();

  readonly rows = computed<BattleLogRow[]>(() =>
    this.events().map((ev) => ({
      text: ev.text,
      damage: ev.damage,
      ko: ev.ko === true,
      side: ev.from === 'player' ? 'player' : ev.from === 'rival' ? 'rival' : 'neutral',
      icon: ev.ko ? 'skull' : ev.damage > 0 ? 'sports_martial_arts' : 'info',
    })),
  );
}

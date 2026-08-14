import { describe, expect, it } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { BattleLog } from '@shared/ui/battle-log/battle-log';
import { BattleEvent } from '@poke/poke.model';

describe('BattleLog', () => {
  let fixture: ComponentFixture<BattleLog>;

  const events: BattleEvent[] = [
    {
      text: 'Pikachu used a physical electric move — super effective!',
      damage: 42,
      from: 'player',
      to: 'rival',
      type: 'electric',
      effectiveness: 2,
    },
    {
      text: 'Geodude used a physical rock move — hit',
      damage: 18,
      from: 'rival',
      to: 'player',
      type: 'rock',
      effectiveness: 1,
    },
    { text: 'Geodude fainted!', damage: 0, from: '—', to: '—', ko: true },
  ];

  async function mount(): Promise<void> {
    await TestBed.configureTestingModule({
      imports: [BattleLog],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    fixture = TestBed.createComponent(BattleLog);
    fixture.componentRef.setInput('events', events);
    await fixture.whenStable();
  }

  it('renders one timeline row per battle event', async () => {
    await mount();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.log-entry').length).toBe(3);
  });

  it('derives side accents and icons from the events', async () => {
    await mount();
    const host = fixture.nativeElement as HTMLElement;
    const rows = host.querySelectorAll('.log-entry');

    // Player hit → green accent, fighting icon.
    expect(rows[0]?.classList.contains('player')).toBe(true);
    expect(rows[0]?.querySelector('.log-icon mat-icon')?.textContent).toBe('sports_martial_arts');

    // Rival hit → red accent, damage badge.
    expect(rows[1]?.classList.contains('rival')).toBe(true);
    expect(rows[1]?.querySelector('.damage')?.textContent).toBe('18');

    // KO event → skull icon + ko highlight.
    expect(rows[2]?.classList.contains('ko')).toBe(true);
    expect(rows[2]?.querySelector('.log-icon mat-icon')?.textContent).toBe('skull');
  });

  it('shows an empty state when there are no events', async () => {
    await TestBed.configureTestingModule({
      imports: [BattleLog],
      providers: [provideZonelessChangeDetection()],
    }).compileComponents();
    fixture = TestBed.createComponent(BattleLog);
    fixture.componentRef.setInput('events', []);
    await fixture.whenStable();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.log-empty')).not.toBeNull();
  });
});

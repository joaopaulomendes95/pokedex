import { Component, computed } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { GameService } from '@poke/game.service';
import { Mission, MissionsService } from '@poke/missions.service';
import { NotifyService } from '@poke/notify.service';
import { KpiBlockComponent, MetricData } from '@shared/ui/kpi-block/kpi-block.component';
import { ProgressGaugeComponent } from '@shared/ui/progress-gauge/progress-gauge.component';
import { ContainerMarkComponent } from '@shared/ui/container-mark/container-mark.component';
import { CustomChipComponent } from '@shared/ui/custom-chip/custom-chip.component';
import { AppDialogService } from '@shared/ui/dialog/app-dialog.service';

@Component({
  selector: 'app-poke-quests',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressBarModule,
    KpiBlockComponent,
    ProgressGaugeComponent,
    ContainerMarkComponent,
    CustomChipComponent,
  ],
  templateUrl: './quests.component.html',
  styleUrl: './quests.component.scss',
})
export class QuestsComponent {
  public game!: GameService;
  public missions!: MissionsService;
  private readonly notify!: NotifyService;
  private readonly dialog!: AppDialogService;

  constructor(
    game: GameService,
    missions: MissionsService,
    notify: NotifyService,
    dialog: AppDialogService,
  ) {
    this.game = game;
    this.missions = missions;
    this.notify = notify;
    this.dialog = dialog;
  }

  incomeMetric = computed<MetricData>(() => ({
    name: 'Income / sec',
    current: `${this.game.incomePerSec().toFixed(2)}¢`,
    fluctuation: this.game.prestige() * 25,
    faIcon: 'monetization_on',
    color: 'main',
  }));

  prestigeMetric = computed<MetricData>(() => ({
    name: 'Prestige bonus',
    current: `${this.game.prestige() * 25}%`,
    fluctuation: this.game.prestige(),
    faIcon: 'auto_awesome',
    color: 'purple',
  }));

  rosterMetric = computed<MetricData>(() => ({
    name: 'Roster',
    current: this.game.collection().size,
    fluctuation: this.game.collection().size,
    faIcon: 'catching_pokemon',
    color: 'green',
  }));

  missionsMetric = computed<MetricData>(() => ({
    name: 'Missions',
    current: `${this.doneCount()} / ${this.missions.missions().length}`,
    fluctuation: this.doneCount(),
    faIcon: 'task_alt',
    color: 'orange',
  }));

  prestigePct = computed(() => Math.min(100, Math.floor((this.game.tier() / 4) * 100)));

  tierProgress = computed(() => {
    const completed = this.missions.completedInTier();
    const total = this.missions.missions().length;
    return total > 0 ? Math.round((completed / total) * 100) : 0;
  });

  doneCount = computed(
    () => this.missions.missions().filter((m) => this.missions.isDone(m)).length,
  );
  claimedCount = computed(
    () => this.missions.missions().filter((m) => this.missions.claimed().has(m.id)).length,
  );

  claim(m: Mission) {
    if (this.missions.claim(m)) {
      this.notify.show(`Mission complete! +${m.reward}¢`);
    } else {
      this.notify.show('Mission not ready yet.');
    }
  }

  prestige() {
    if (!this.game.canPrestige()) {
      this.notify.show('Reach the Champion Cup tier to prestige.');
      return;
    }
    this.dialog
      .open({
        type: 'danger',
        title: 'Prestige now?',
        message: `Reset to the Novice tier for +${this.game.prestigeGain()} prestige shard${
          this.game.prestigeGain() === 1 ? '' : 's'
        }. You'll keep shards, but lose the current run's collection, coins and tier.`,
        actionLabel: 'Prestige',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        if (this.game.prestigeReset()) {
          this.notify.showSuccess('Prestige reset! Shard banked — income boosted.');
        }
      });
  }
}

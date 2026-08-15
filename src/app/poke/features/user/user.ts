import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Game, SAVE_KEY } from '@poke/game';
import { GenerationFilter } from '@poke/generation-filter';
import { Notify } from '@poke/notify';
import { AppDialog, BasicView } from '@shared/ui';
import { BrowserStorage } from '@core/services/storage';
import { SaveIo } from '@core/services/save-io/save-io';
import { DOCUMENT } from '@angular/common';

@Component({
  selector: 'app-poke-user',
  imports: [MatButtonModule, MatCardModule, MatIconModule, BasicView],
  templateUrl: './user.component.html',
  styleUrl: './user.component.scss',
})
export class User {
  stashKey = SAVE_KEY;

  public readonly game = inject(Game);
  public readonly genFilter = inject(GenerationFilter);
  #notify = inject(Notify);
  #dialog = inject(AppDialog);
  #storage = inject(BrowserStorage);
  #saveIo = inject(SaveIo);
  #document = inject(DOCUMENT);

  /** Generation the next save will fight into (chosen before the wipe). */
  newGen = signal(2);

  collectionSize = computed(() => this.game.collection().size);
  inventorySize = computed(() => {
    const inv = this.game.inventory();
    return Object.entries(inv).reduce((n, [, v]) => n + v, 0);
  });

  /** Size of the JSON save on disk, in kilobytes. */
  saveKB = computed(() => {
    const raw = this.#storage.get(this.stashKey);
    return raw ? (raw.length / 1024).toFixed(1) : '0.0';
  });

  constructor() {
    this.newGen.set(this.genFilter.maxGen());
  }

  /** Human-readable time of the last save. */
  readonly lastSaved = computed(() => new Date(this.game.lastSaved()).toLocaleTimeString());

  /** Restart the run: full reset back to the starters + 5 Pokéballs. */
  doReset() {
    this.#dialog
      .open({
        type: 'delete',
        title: 'Restart the game?',
        message: `Every Pokémon, coin, item, zone and win in this save will be wiped and a new Gen ${this.newGen()} run begins. This can't be undone.`,
        actionLabel: 'Wipe save',
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
        this.game.reset(this.newGen());
        this.#notify.show('Game restarted — fresh save written.');
      });
  }

  decGen() {
    this.newGen.update((g) => Math.max(1, g - 1));
  }

  incGen() {
    this.newGen.update((g) => Math.min(9, g + 1));
  }

  saveNow() {
    this.game.saveNow();
    this.#notify.show(`Saved at ${this.lastSaved()}.`);
  }

  /** Download the whole save (game + missions + elite) as a JSON file. */
  exportSave() {
    const payload = this.#saveIo.buildExport();
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = this.#document.createElement('a');
    a.href = url;
    a.download = `poke-liga-idle-save-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.#notify.show('Save exported — keep the file somewhere safe.');
  }

  /** Validate a picked import file and confirm before applying it. */
  onImportPicked(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? '');
      const error = this.#saveIo.validateImport(text);
      if (error) {
        this.#notify.showError(error);
        return;
      }
      this.#dialog
        .open({
          type: 'warn',
          title: 'Import this save?',
          message:
            'This replaces your CURRENT save (game, missions and Elite Series) with the file. The page will reload to load it.',
          actionLabel: 'Import & reload',
        })
        .afterClosed()
        .subscribe((confirmed) => {
          if (!confirmed) return;
          if (this.#saveIo.applyImport(text)) {
            this.#notify.show('Save imported — reloading…');
            this.#document.defaultView?.location.reload();
          } else {
            this.#notify.showError('Import failed — nothing was changed.');
          }
        });
    };
    reader.onerror = () => this.#notify.showError('Could not read that file.');
    reader.readAsText(file);
  }
}

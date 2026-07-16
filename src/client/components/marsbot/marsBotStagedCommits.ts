/*
 * STAGED visual commits — the bot-turn half of the presentation timeline.
 *
 * THE PROBLEM: after a pass, the server resolves SEVERAL bot turns inside one
 * response and ships one LATEST snapshot. Committing it immediately showed the
 * whole batch at once (tiles, delta-chips, parameters, even the next mandatory
 * prompt) while the per-turn notifications trailed behind — consequences
 * before explanations.
 *
 * THE MODEL: the client may KNOW the latest authoritative state, but the
 * player sees the PRESENTED state, which advances with the presentation
 * queue:
 *
 *   - a response carrying fresh bot turns is NOT committed; it is buffered
 *     here (`latest` + the caller's own commit closure);
 *   - the presented view's `waitingFor` is cleared (the player cannot act on
 *     a stale prompt while the sequence plays);
 *   - when the compact notification of turn N is DELIVERED (visible), turn
 *     N's visual footprint is applied to the presented view — the same
 *     in-place mutation pattern as the WGT/tile-placement previews
 *     (`applyTilePlacementPreview` / `applyGlobalParamPreview`): tiles (via
 *     the armed placement animation), global parameters, per-player
 *     resources/production/TR (absolute `after` values from the turn script,
 *     so re-application is idempotent);
 *   - the LAST pending turn's delivery performs the FULL authoritative
 *     commit instead — its own changes plus everything else (including a
 *     mandatory prompt, which the server can only have raised AFTER the last
 *     turn of the batch: a prompt stops the game loop, so no later bot turn
 *     can precede it);
 *   - after the drain the presented state EQUALS the latest authoritative
 *     state — intermediate mutations used absolute values and the final step
 *     is the real snapshot, so nothing is lost and nothing applies twice.
 *
 * Human actions never stage: a response with NO fresh bot turns commits
 * immediately (unless a staging window is already open — then it only
 * refreshes the buffered latest, keeping order). The server is never held:
 * this is purely the client presentation layer.
 */
import {reactive} from 'vue';
import {PlayerViewModel, PublicPlayerModel, ViewModel} from '@/common/models/PlayerModel';
import {MarsBotAttack, MarsBotImpact, MarsBotTurn} from '@/common/automa/MarsBotTurn';
import {HAZARD_TILES} from '@/common/TileType';
import {armPlacementAnimations} from '@/client/components/board/tilePlacementAnimation';
import {stageRemoteTileEvents} from '@/client/console/tilePlacement/consoleRemotePlacement';

type StagedBatch = {
  /** The view the player is LOOKING at (the committed object — mutated in place). */
  presented: ViewModel;
  /** Turn keys whose visuals are not presented yet, in turn order. */
  pendingKeys: Array<string>;
  turnsByKey: Map<string, MarsBotTurn>;
  /** The latest authoritative view (refreshed by later responses/polls). */
  latest: ViewModel;
  /** The receiving path's own commit closure for `latest`. */
  commitLatest: () => void;
};

let batch: StagedBatch | undefined;

/** Reactive mirror (for guards / debug displays). */
export const botStagingState = reactive({active: false, pendingCount: 0});

function syncState(): void {
  botStagingState.active = batch !== undefined;
  botStagingState.pendingCount = batch?.pendingKeys.length ?? 0;
}

export function isBotStagingActive(): boolean {
  return botStagingState.active;
}

// ── presented-view mutations (the per-turn visual commit) ────────────────────

const STOCK_FIELD: Readonly<Record<string, keyof PublicPlayerModel>> = {
  megacredits: 'megacredits', steel: 'steel', titanium: 'titanium',
  plants: 'plants', energy: 'energy', heat: 'heat',
};
const PROD_FIELD: Readonly<Record<string, keyof PublicPlayerModel>> = {
  megacredits: 'megacreditProduction', steel: 'steelProduction', titanium: 'titaniumProduction',
  plants: 'plantProduction', energy: 'energyProduction', heat: 'heatProduction',
};

/** Every model of the SAME participant (players[] entry + thisPlayer — they
 *  are distinct objects after JSON, both feed panels). */
function modelsOf(view: ViewModel, color: string): Array<PublicPlayerModel> {
  const out: Array<PublicPlayerModel> = view.players.filter((p) => p.color === color);
  const self = (view as PlayerViewModel).thisPlayer;
  if (self !== undefined && self.color === color && !out.includes(self)) {
    out.push(self);
  }
  return out;
}

function setValue(view: ViewModel, color: string, resource: string, scope: 'stock' | 'production', after: number): void {
  for (const model of modelsOf(view, color)) {
    if (resource === 'tr') {
      (model as {terraformRating: number}).terraformRating = after;
      continue;
    }
    const field = (scope === 'production' ? PROD_FIELD : STOCK_FIELD)[resource];
    if (field !== undefined) {
      (model as Record<string, unknown>)[field as string] = after;
    }
  }
}

function applyImpact(view: ViewModel, impact: MarsBotImpact): void {
  for (const change of impact.changes) {
    setValue(view, impact.target, change.resource, change.scope, change.after);
  }
}

function applyAttack(view: ViewModel, attack: MarsBotAttack): void {
  // Only a concrete stock loss carries numbers ('target-chooses' resolves later).
  if (attack.after !== undefined && attack.resource !== 'cube') {
    setValue(view, attack.target, attack.resource, 'stock', attack.after);
  }
}

/**
 * Apply ONE turn's visual footprint to the presented view: tiles (through the
 * armed placement animation), global parameters, per-player resources/TR.
 * Absolute `after` values → idempotent (a re-delivered card cannot double-apply).
 */
export function applyTurnVisual(view: ViewModel, turn: MarsBotTurn): void {
  const visual = turn.visual;
  if (visual !== undefined) {
    if (visual.tiles !== undefined && visual.tiles.length > 0) {
      // Console: the bot's fresh EMPTY → TILED tiles land with the premium
      // REMOTE flight — staged in this SAME synchronous block as the
      // mutation below, so they commit HIDDEN behind the reveal hold and
      // each becomes visible at its proxy's touchdown (a no-op on desktop /
      // reduced motion). Hazards and covered cells fall through to the
      // armed generic entrance unchanged.
      stageRemoteTileEvents(
        visual.tiles.flatMap((tile) => {
          const space = view.game.spaces.find((s) => s.id === tile.spaceId);
          return space !== undefined && space.tileType === undefined && !HAZARD_TILES.has(tile.tileType) ?
            [{spaceId: tile.spaceId, tileType: tile.tileType, color: tile.color}] : [];
        }),
        {
          aresExtension: view.game.gameOptions?.expansions?.ares === true,
          gamePhase: view.game.phase,
          viewerColor: (view as PlayerViewModel).thisPlayer?.color,
        },
      );
      // Arm BEFORE mutating — BoardSpaceTile's watcher fires synchronously
      // from Vue reactivity (same rule as the placement-preview holds).
      armPlacementAnimations();
      for (const tile of visual.tiles) {
        const space = view.game.spaces.find((s) => s.id === tile.spaceId);
        if (space !== undefined) {
          space.tileType = tile.tileType;
          if (tile.color !== undefined) {
            space.color = tile.color;
          }
        }
      }
    }
    if (visual.temperature !== undefined) {
      view.game.temperature = visual.temperature.after;
    }
    if (visual.oxygenLevel !== undefined) {
      view.game.oxygenLevel = visual.oxygenLevel.after;
    }
    if (visual.oceans !== undefined) {
      view.game.oceans = visual.oceans.after;
    }
    if (visual.venusScaleLevel !== undefined) {
      view.game.venusScaleLevel = visual.venusScaleLevel.after;
    }
  }
  for (const step of turn.steps) {
    if (step.kind === 'attack') {
      applyAttack(view, step.attack);
    } else if (step.kind === 'impact') {
      applyImpact(view, step.impact);
    }
  }
}

// ── the staging window ───────────────────────────────────────────────────────

/**
 * Open (or extend) the staging window: buffer `latest` instead of committing
 * it, register the batch's turns, and clear the presented prompt so the
 * player can't act on stale state while the sequence presents.
 */
export function beginBotStaging(
  presented: ViewModel,
  turns: ReadonlyArray<{key: string, turn: MarsBotTurn}>,
  latest: ViewModel,
  commitLatest: () => void,
): void {
  if (batch === undefined) {
    batch = {
      presented,
      pendingKeys: [],
      turnsByKey: new Map(),
      latest,
      commitLatest,
    };
    // The presented prompt belongs to the PRE-batch state — acting on it
    // would submit against a stale runId. Clearing it disables the inline
    // action UI and every dedicated button (they all walk waitingFor).
    (presented as PlayerViewModel).waitingFor = undefined;
  } else {
    batch.latest = latest;
    batch.commitLatest = commitLatest;
  }
  for (const {key, turn} of turns) {
    if (!batch.turnsByKey.has(key)) {
      batch.pendingKeys.push(key);
      batch.turnsByKey.set(key, turn);
    }
  }
  syncState();
}

/**
 * A response arrived WHILE a staging window is open (a poll re-fetch, or the
 * same state again): refresh the buffered latest — it must never be committed
 * under the presented sequence.
 */
export function updateBotStagingLatest(latest: ViewModel, commitLatest: () => void): boolean {
  if (batch === undefined) {
    return false;
  }
  batch.latest = latest;
  batch.commitLatest = commitLatest;
  return true;
}

/**
 * The compact notification of `key` is now VISIBLE — advance the presented
 * timeline to it:
 *  - the LAST pending turn → the FULL authoritative commit (its changes plus
 *    everything newer, incl. a mandatory prompt raised after the batch);
 *  - an earlier turn → apply its visual footprint (catching up any skipped
 *    predecessors first, so order can never invert).
 */
export function deliverBotTurnVisual(key: string): 'committed' | 'applied' | 'none' {
  if (batch === undefined) {
    return 'none';
  }
  const idx = batch.pendingKeys.indexOf(key);
  if (idx === -1) {
    return 'none'; // already presented (a re-delivery is a no-op)
  }
  if (idx === batch.pendingKeys.length - 1) {
    commitBotStagingNow();
    return 'committed';
  }
  while (batch.pendingKeys.length > 0) {
    const next = batch.pendingKeys[0];
    const turn = batch.turnsByKey.get(next);
    if (turn !== undefined) {
      applyTurnVisual(batch.presented, turn);
    }
    batch.pendingKeys.shift();
    batch.turnsByKey.delete(next);
    if (next === key) {
      break;
    }
  }
  syncState();
  return 'applied';
}

/**
 * Close the window NOW with the full authoritative commit (the normal end of
 * the sequence, and the self-heal when the cards can't present — e.g.
 * notifications disabled). Safe to call anytime; no-op without a window.
 */
export function commitBotStagingNow(): void {
  if (batch === undefined) {
    return;
  }
  const commit = batch.commitLatest;
  batch = undefined;
  syncState();
  commit();
}

/** Test / game-switch reset — drops the window WITHOUT committing. */
export function resetBotStaging(): void {
  batch = undefined;
  syncState();
}

/** The keys still waiting for their presentation (for liveness checks). */
export function botStagingPendingKeys(): ReadonlyArray<string> {
  return batch?.pendingKeys ?? [];
}

/*
 * THE FORECAST HOST — what EVERY surface that opens the R3 «Эффекты» layer
 * does the same way (docs/claude/console/effect-forecast.md § The surfaces).
 *
 * A composer's «Сработает» row and a stage's «⚡ сработает» group are the same
 * DOOR: the key rides it, R3 or a click arms the group's rect and opens the
 * layer, the layer owns the pad while it stands (B folds one level — the
 * explorer's dossier first — R3 closes it whole), a sub-step or the commit
 * boundary folds it instantly, the host's unmount closes it. The fleet-dock
 * stage (TR26, PL-060) and the colony stage (PL-066) read these; the two
 * composers still carry their own copies of the same phrase.
 */
import {gsap} from 'gsap';
import {Color} from '@/common/Color';
import {EffectForecast, forecastSourceIsCardless} from '@/common/models/EffectForecastModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {motionMs} from '@/client/components/motion/motionTokens';
import {
  EffectForecastHost, closeEffectForecastLayer, effectForecastOpen, openEffectForecastLayer,
} from '@/client/console/consoleEffectForecast';
import {armForecastInstantFold, armForecastRow} from '@/client/console/consoleForecastFocusMotion';
import {effectStatsFor, ensureEffectStats} from '@/client/console/effectStatsStore';
import {descendRectOf} from '@/client/console/surfaceMotion/workspaceDescend';
import {VersionedView} from '@/client/console/gameStateVersion';

/** What the layer component exposes to its host's input path. */
export type ForecastLayerHandle = {
  consumeBack: () => boolean,
  handleIntent: (intent: GamepadIntent) => void,
};

/** The one-shot COMMIT flare on the door (the composers' `con-forecast--descend`). */
export const FORECAST_DOOR_PULSE_MS = 320;

/** The seats whose CARDS react — the ones whose effect stats the layer's «За партию» block asks for (a party's or a
 *  resolution's fact has no seat to ask, a bot's seat is never asked). */
export function forecastOwnerColors(
  forecast: EffectForecast | undefined,
  players: ReadonlyArray<{color: string, isMarsBot?: boolean}>,
): ReadonlyArray<string> {
  if (forecast === undefined) {
    return [];
  }
  const bots = new Set(players.filter((p) => p.isMarsBot === true).map((p) => p.color));
  const colors = new Set<string>();
  for (const fact of [...forecast.facts, ...Object.values(forecast.byBranch ?? {}).flat()]) {
    if (!forecastSourceIsCardless(fact.source) && fact.source.kind !== 'automa-corporation' && !bots.has(fact.source.owner)) {
      colors.add(fact.source.owner);
    }
  }
  return [...colors];
}

/** The per-seat stats as the explorer takes them (`undefined` per seat = loading). */
export function forecastStatsByColor(colors: ReadonlyArray<string>): Partial<Record<string, ReadonlyArray<EffectOverlayStat> | undefined>> {
  const out: Partial<Record<string, ReadonlyArray<EffectOverlayStat> | undefined>> = {};
  for (const color of colors) {
    out[color] = effectStatsFor(color as Color);
  }
  return out;
}

/**
 * R3 / a click on the door — the WORKSPACE DESCEND into the layer: the door's
 * rect is armed SYNCHRONOUSLY (the unfold's origin), the reacting seats' stats
 * are asked, the layer opens for `host`. The caller decides whether the door
 * may open (its own `forecastCanOpen`).
 */
export function openForecastHost(
  host: EffectForecastHost,
  root: HTMLElement | undefined,
  colors: ReadonlyArray<string>,
  statsView: VersionedView | undefined,
): void {
  armForecastRow(descendRectOf(root?.querySelector<HTMLElement>('[data-forecast-row]')));
  if (statsView !== undefined) {
    for (const color of colors) {
      ensureEffectStats(statsView, color as Color);
    }
  }
  openEffectForecastLayer(host);
}

/**
 * The door's flare, on the animation clock (never a wall-clock timer — the
 * stage clocks' law, PL-003). Returns a PLAIN handle for the host's data (a
 * tween in reactive data is proxied). `previous` is killed first.
 */
export function pulseForecastDoor(set: (on: boolean) => void, previous: {kill: () => void} | undefined): {kill: () => void} {
  previous?.kill();
  set(true);
  const call = gsap.delayedCall(motionMs(FORECAST_DOOR_PULSE_MS) / 1000, () => set(false));
  return {kill: () => call.kill()};
}

/** The layer lives ONLY on the setup level — a sub-step, the commit boundary and a refusal fold it instantly. */
export function foldForecastHost(host: EffectForecastHost): void {
  if (effectForecastOpen(host)) {
    armForecastInstantFold();
    closeEffectForecastLayer(host);
  }
}

/**
 * Input while the layer is open: B folds one level (the explorer's dossier
 * first), R3 closes the whole layer, the rest is the explorer's.
 */
export function forecastHostIntent(host: EffectForecastHost, intent: GamepadIntent, layer: ForecastLayerHandle | undefined): void {
  if (intent.kind === 'press' && intent.button === 'stickR') {
    closeEffectForecastLayer(host);
    return;
  }
  if (intent.kind === 'press' && consoleActionOf(intent) === 'back') {
    if (layer?.consumeBack() !== true) {
      closeEffectForecastLayer(host);
    }
    return;
  }
  layer?.handleIntent(intent);
}

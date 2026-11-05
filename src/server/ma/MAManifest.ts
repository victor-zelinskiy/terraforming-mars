import {BoardName} from '../../common/boards/BoardName';
import {Expansion, EXPANSIONS} from '../../common/cards/GameModule';
import {GameOptions} from '../game/GameOptions';

type MAManifestSpec<V> = {
  /** Constructor that a new instance of this MA. */
  Factory: new () => V;
  /**
   * If set, the module this MA needs to function — or a LIST of modules, ANY ONE of which suffices (T. Politician
   * counts delegates PLACED, which both the classic Turmoil and the Turmoil Redux Parliament do).
   */
  compatibility?: Expansion | ReadonlyArray<Expansion>;
  /** When true, do not include in any new games when picking randomly. */
  deprecated?: true;
  /**
   * vize1215 fork — RETIRED FOR GOOD: the MA can never enter a NEW game by ANY road (no random pool, no board set, no
   * expansion set); the value is the reason. Stronger than `deprecated`, which only keeps an MA out of the RANDOM pools
   * (a deprecated clone may still stand on its official board — Forester on Amazonis, Irrigator on Vastitas Borealis).
   * The factory stays only so an OLD save still loads. `chooseMilestonesAndAwards` throws the moment a retired name
   * would reach a new game, and `tests/ma/RetiredMilestonesAwards.spec.ts` fails on any new source reference — so a
   * board, a card or a mode that starts leaning on one surfaces at once and a replacement gets decided.
   */
  retired?: string;
  random?: 'modular' | 'both';
}
type ExpansionsWithMAs = 'venus' | 'ares' | 'moon' | 'underworld';

export type MAManifest<K extends string, V> = {
  all: Record<K, MAManifestSpec<V>>,
  boards: Record<BoardName, ReadonlyArray<K>>,
  expansions: Record<ExpansionsWithMAs, ReadonlyArray<K>>;
  create(name: string): V | undefined;
  createOrThrow(name: string): V;
}

export function isCompatible<T extends string>(name: T, manifest: MAManifest<T, any>, gameOptions: GameOptions) {
  const needs = manifest.all[name].compatibility;
  if (needs === undefined) {
    return true;
  }
  const anyOf: ReadonlyArray<Expansion> = typeof needs === 'string' ? [needs] : needs;
  return anyOf.some((expansion) => EXPANSIONS.includes(expansion) && gameOptions.expansions[expansion] === true);
}

/**
 * The fork's reason a classic-Turmoil MA is gone: the Redux FAQ bars Lobbyist and Politician («Since the way that
 * delegates work is completely different now, that milestone and award no longer work as intended. You should use this
 * fan expansion's milestones and awards instead»), and the classic Turmoil is not supported by this fork — so nothing
 * is left that could host them.
 */
export const RETIRED_WITH_CLASSIC_TURMOIL = 'Counts delegates sitting in parties — barred by the Turmoil Redux FAQ, and the classic Turmoil is not supported';

/** Every retired name of a manifest (`retired` set) — the list the new-game check and the guard read. */
export function retiredNames<T extends string>(manifest: MAManifest<T, any>): Array<T> {
  return (Object.keys(manifest.all) as Array<T>).filter((name) => manifest.all[name].retired !== undefined);
}

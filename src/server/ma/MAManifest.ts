import {BoardName} from '../../common/boards/BoardName';
import {Expansion, EXPANSIONS} from '../../common/cards/GameModule';
import {GameOptions} from '../game/GameOptions';

type MAManifestSpec<V> = {
  /** Constructor that a new instance of this MA. */
  Factory: new () => V;
  /**
   * If set, the module this MA needs to function — or a LIST of modules, ANY ONE of which suffices (T. Politician
   * counts delegates PLACED, which both the classic Turmoil and the Turmoil Redux Parliament do; the Redux FAQ bars only
   * Lobbyist and Politician, whose delegates-in-parties no longer exist there).
   */
  compatibility?: Expansion | ReadonlyArray<Expansion>;
  /** When true, do not include in any new games when picking randomly. */
  deprecated?: true;
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

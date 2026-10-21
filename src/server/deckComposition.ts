import {GameCards} from './GameCards';
import {GameOptions} from './game/GameOptions';
import {ALL_MODULE_MANIFESTS} from './cards/AllManifests';
import {CardManifest} from './cards/ModuleManifest';
import {ICard} from './cards/ICard';
import {ColonyDealer} from './colonies/ColonyDealer';
import {REDUX_RESOLUTION_CATALOG} from './parliament/resolutions/ResolutionCatalog';
import {compatibleWith} from './parliament/Parliament';
import {CardName} from '../common/cards/CardName';
import {CardType} from '../common/cards/CardType';
import {Expansion, GameModule} from '../common/cards/GameModule';
import {ConstRandom} from '../common/utils/Random';
import {isTurmoilReduxAddition} from '../common/colonies/AllColonies';
import {automaModeFor} from '../common/automa/AutomaTypes';
import {
  DECK_COMPOSITION_EXPANSIONS, DeckComposition, DeckCompositionModel, DeckCount, ExpansionContribution,
} from '../common/models/DeckCompositionModel';

/**
 * THE PARTY'S DECKS, COUNTED BEFORE THE PARTY EXISTS (T04 «the deck is visible before
 * launch»). Read-only and pure over `GameOptions`: it builds the decks the way
 * `Game.newInstance` builds them — `GameCards` (banned, replaced, held back under Redux,
 * Automa-banned, the two-corporation variant's Merger, the guaranteed cards), the prelude
 * deck only with the Prelude expansion (the deal's own condition), the colony pool of
 * `ColonyDealer` and the Parliament's resolution deck — and counts them. No game, no
 * player, no RNG draw: nothing here can change a table.
 *
 * `contributions` is what every creator toggle PRINTS into these decks — its own module's
 * cards (and colony tiles, and resolutions), counted in the decks built WITH it on, so an
 * OFF tile honestly says what it would add with the rest of the set as it stands. By
 * ORIGIN, never «with it − without it» (`ExpansionContribution`).
 */

/**
 * The modules whose cards a creator toggle brings. Every toggle prints its own module; Turmoil
 * Redux also brings the classic Turmoil cards adapted to it (`turmoilReduxAdaptation.ts` —
 * on a creator table they are dealt only with Redux), so they count as its projects.
 */
const ORIGIN_MODULES: Readonly<Record<Expansion, ReadonlyArray<GameModule>>> = {
  corpera: ['corpera'], prelude: ['prelude'], prelude2: ['prelude2'], venus: ['venus'], colonies: ['colonies'],
  turmoil: ['turmoil'], community: ['community'], ares: ['ares'], moon: ['moon'], pathfinders: ['pathfinders'],
  ceo: ['ceo'], starwars: ['starwars'], underworld: ['underworld'], deltaProject: ['deltaProject'],
  promo: ['promo'], turmoilRedux: ['turmoilRedux', 'turmoil'],
};

/** Which module each dealable card comes from (a card's own class does not know). */
const MODULE_OF: ReadonlyMap<CardName, GameModule> = (() => {
  const out = new Map<CardName, GameModule>();
  for (const manifest of ALL_MODULE_MANIFESTS) {
    for (const deck of [manifest.projectCards, manifest.corporationCards, manifest.preludeCards] as ReadonlyArray<CardManifest<ICard>>) {
      for (const name of Object.keys(deck) as Array<CardName>) {
        if (!out.has(name)) {
          out.set(name, manifest.module);
        }
      }
    }
  }
  return out;
})();

/** The inputs a table's decks depend on, besides the options: how many seats sit (MarsBot included). */
export type DeckTable = {humans: number, bot: boolean};

/** Instrumentation for the memo's guard — how many times the decks were really built. */
export const deckCompositionStats = {builds: 0};

const MEMO_LIMIT = 64;
const memo = new Map<string, DeckComposition>();

/** Forget every memoized composition (specs). */
export function clearDeckCompositionMemo(): void {
  memo.clear();
  deckCompositionStats.builds = 0;
}

/**
 * The options exactly as the table would play them: the Automa MODE derived from the human
 * seats (the ban predicates read it), the board left out (no deck depends on the map — a
 * different map must not miss the memo).
 */
function normalized(options: GameOptions, table: DeckTable): GameOptions {
  return {
    ...options,
    automa: table.bot ? {...(options.automa ?? {difficulty: 'normal'}), mode: automaModeFor(table.humans)} : undefined,
  };
}

/** A canonical key: every option the decks can read, in a stable order, the board aside. */
function keyOf(options: GameOptions, table: DeckTable): string {
  const {boardName: _board, randomBoardOption: _random, randomFirstPlayer: _first, ...rest} = options;
  const sorted = (value: unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(sorted);
    }
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(Object.keys(value as object).sort().map((k) => [k, sorted((value as Record<string, unknown>)[k])]));
    }
    return value;
  };
  return JSON.stringify(sorted({rest, seats: table.humans + (table.bot ? 1 : 0)}));
}

function countOf(cards: ReadonlyArray<ICard>): DeckCount {
  const byModule: Partial<Record<GameModule, number>> = {};
  for (const card of cards) {
    const module = MODULE_OF.get(card.name);
    if (module !== undefined) {
      byModule[module] = (byModule[module] ?? 0) + 1;
    }
  }
  return {total: cards.length, byModule};
}

/**
 * The colony tiles the options deal from — the pool (the dealer's own, or the custom list), how
 * many stand on the table at the start (by seats, MarsBot's included), and the pool by the
 * expansion that prints each tile: a Turmoil Redux ADDITION is Redux's, every other tile the
 * Colonies' (a Redux REPLACEMENT swaps a tile the Colonies print — it adds none).
 */
function colonyTableOf(options: GameOptions, table: DeckTable): NonNullable<DeckComposition['extras']['colonies']> {
  const seats = table.humans + (table.bot ? 1 : 0);
  const names = options.customColoniesList.length > 0 ? options.customColoniesList : new ColonyDealer(new ConstRandom(0), options).poolNames;
  const redux = names.filter((name) => isTurmoilReduxAddition(name)).length;
  const byExpansion: Partial<Record<Expansion, number>> = {colonies: names.length - redux};
  if (redux > 0) {
    byExpansion.turmoilRedux = redux;
  }
  return {pool: names.length, inPlay: Math.min(ColonyDealer.colonyCountFor(seats), names.length), byExpansion};
}

function build(options: GameOptions, table: DeckTable): DeckComposition {
  deckCompositionStats.builds++;
  const cards = new GameCards(options);
  const projects = cards.getProjectCards();
  const corporations = cards.getCorporationCards();
  // `GameCards.getPreludeCards` fills an EMPTY prelude deck for Valley Trust; nobody is dealt
  // a prelude unless the Prelude expansion is on (`Game.newInstance`), so that pile is no deck.
  const preludes = options.preludeExtension ? cards.getPreludeCards() : [];
  const extras: DeckComposition['extras'] = {
    ...(options.coloniesExtension ? {colonies: colonyTableOf(options, table)} : {}),
    ...(options.turmoilReduxExpansion ? {resolutions: REDUX_RESOLUTION_CATALOG.dealtInstances(compatibleWith(options.expansions)).length} : {}),
  };
  return {
    projects: {
      ...countOf(projects),
      byType: {
        automated: projects.filter((c) => c.type === CardType.AUTOMATED).length,
        active: projects.filter((c) => c.type === CardType.ACTIVE).length,
        event: projects.filter((c) => c.type === CardType.EVENT).length,
      },
    },
    corporations: countOf(corporations),
    preludes: countOf(preludes),
    extras,
  };
}

function compositionOf(options: GameOptions, table: DeckTable): DeckComposition {
  const play = normalized(options, table);
  const key = keyOf(play, table);
  const hit = memo.get(key);
  if (hit !== undefined) {
    // Least recently used goes first: a hit moves to the end.
    memo.delete(key);
    memo.set(key, hit);
    return hit;
  }
  const composition = build(play, table);
  memo.set(key, composition);
  for (const oldest of memo.keys()) {
    if (memo.size <= MEMO_LIMIT) {
      break;
    }
    memo.delete(oldest);
  }
  return composition;
}

/** `options` with ONE creator expansion switched — the expansion flag and the option the engine reads. */
export type ExpansionToggle = (options: GameOptions, expansion: Expansion, on: boolean) => GameOptions;

/** What `expansion` prints into decks built WITH it on — its own modules' cards, tiles and resolutions. */
function originOf(expansion: Expansion, on: DeckComposition): ExpansionContribution {
  const modules = ORIGIN_MODULES[expansion];
  const own = (deck: DeckCount) => modules.reduce((sum, module) => sum + (deck.byModule[module] ?? 0), 0);
  return {
    projects: own(on.projects),
    corporations: own(on.corporations),
    preludes: own(on.preludes),
    colonies: on.extras.colonies?.byExpansion[expansion] ?? 0,
    resolutions: expansion === 'turmoilRedux' ? on.extras.resolutions ?? 0 : 0,
  };
}

/**
 * The decks of a table with these options, and what each creator expansion adds to them.
 * `toggle` re-derives the options with one expansion switched — the caller's own mapping
 * (the route maps a creator config through `gameOptionsFromNewGameConfig`, so a toggle is
 * the same function the launch runs).
 */
export function deckCompositionOf(options: GameOptions, table: DeckTable, toggle: ExpansionToggle): DeckCompositionModel {
  const composition = compositionOf(options, table);
  const contributions: DeckCompositionModel['contributions'] = {};
  for (const expansion of DECK_COMPOSITION_EXPANSIONS) {
    contributions[expansion] = originOf(expansion, compositionOf(toggle(options, expansion, true), table));
  }
  return {...composition, contributions};
}

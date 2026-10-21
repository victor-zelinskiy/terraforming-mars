import {CardName} from '../../../common/cards/CardName';

/**
 * THE CLASSIC TURMOIL CARDS THE REDUX SET REPLACES — a fact of the printed set,
 * never a worklist (rulebook p.1: «70 new Project cards (and 6 replacement
 * projects)», «8 new Corporation cards (and 1 replacement corporation)»; p.12:
 * «If you are playing with the official Turmoil expansion, remove the Septem
 * Tribus corporation card from it. It is not compatible with Turmoil Redux, and
 * is thus replaced in this expansion»).
 *
 * The classic card of every row is NEVER dealt into a Redux game. Today the
 * hold-back list (`cards/turmoil/turmoilReduxAdaptation.ts`) keeps it out; once
 * its replacement is authored, THIS manifest's `cardsToRemove` takes over —
 * upstream's own shape for a same-name reprint (Promo's `Deimos Down:promo`
 * over `Deimos Down`, Ares' `Capital:ares` over `Capital`): the replacement is
 * registered under a `:redux`-suffixed `CardName` (the client strips the suffix
 * for display — `name.split(':')[0]`), the plain name stays the classic card's
 * (guard: `TurmoilReduxCardManifest.spec` § reserved), and the classic name goes
 * into `cardsToRemove` in the same diff that removes it from the hold-back list
 * (guard: `tests/cards/turmoil/TurmoilCardsUnderRedux.spec.ts`).
 *
 * `scan` is relative to `…/TM Turmoil Redux/`; `changes` is what the scan prints
 * differently from the classic card (read 2026-10-21). The six project scans all
 * print the placeholder number «TR00» — the replacement contract picks the real
 * card-number key (the `TR01…TR70` namespace is full; the manifest guard pins
 * it, so the contract widens that guard deliberately, never by reusing a number).
 */
export type ClassicReplacement = {
  /** The classic card's name — the one the Redux deck must never hold. */
  classic: CardName;
  kind: 'project' | 'corporation';
  scan: string;
  changes: string;
};

export const TURMOIL_REDUX_CLASSIC_REPLACEMENTS: ReadonlyArray<ClassicReplacement> = [
  {
    classic: CardName.AERIAL_LENSES, kind: 'project', scan: 'Projects/Replacement - Aerial Lenses.png',
    changes: 'party Kelvinists → SCIENTISTS (not the Greens the general Kelvinists→Greens rule would give); cost 2 → 3; gains a Science tag; the −1 VP is gone. Same body: remove up to 2 plants from any player, +2 heat production.',
  },
  {
    classic: CardName.BANNED_DELEGATE, kind: 'project', scan: 'Projects/Replacement - Banned Delegate.png',
    changes: 'still cost 0, event, «requires you to be Chairman»; the target is «any delegate from a resolution or Popular Support area» — no NON-LEADER clause, and the Popular Support areas are in reach.',
  },
  {
    classic: CardName.POLITICAL_ALLIANCE, kind: 'project', scan: 'Projects/Replacement - Political Alliance.png',
    changes: 'cost 4 → 2; requirement «the highest number of delegates on 2 resolutions at once» (ties by who put a delegate in first, neutral delegates do not count — `PoliticalOps.partiesLedBy` is this reading); reward +1 TR → advance the Agenda marker 1 step. Invented lore already in `docs/claude/turmoil-redux-invented-lore.md`.',
  },
  {
    classic: CardName.RECRUITMENT, kind: 'project', scan: 'Projects/Replacement - Recruitment.png',
    changes: 'still cost 2, event; «exchange one NEUTRAL delegate on a resolution with one of your own from the reserve» — no NON-LEADER clause, resolutions only (never a Popular Support area).',
  },
  {
    classic: CardName.SPONSORED_MOHOLE, kind: 'project', scan: 'Projects/Replacement - Sponsored Mohole.png',
    changes: 'party Kelvinists → GREENS (printed, what the general rule gives anyway); still cost 5, Building tag, +2 heat production; gains 1 VP.',
  },
  {
    classic: CardName.VOTE_OF_NO_CONFIDENCE, kind: 'project', scan: 'Projects/Replacement - Vote of No Confidence.png',
    changes: 'still cost 5, event; requirement «a party leader + a NEUTRAL chairman» → «at least 1 influence»; removes the CURRENT chairman whoever holds the seat (a player\'s delegate too) and seats your own from the reserve; reward +1 TR → advance the Agenda marker 1 step.',
  },
  {
    classic: CardName.SEPTUM_TRIBUS, kind: 'corporation', scan: 'Corporations/Corporation - Septem Tribus.png',
    changes: '36 → 40 M€, Wild tag kept; the M€-per-party action is gone. First action: place 1 player cube on the BANNER of any party. Effect: when you win on a resolution, place your cube on its party\'s banner; you gain the effect of every party whose banner holds at least 1 of your cubes — in addition to the ruling party and the 2-delegate road (the `grantPartyEffect` reserve of `PoliticalOps`; the requirement reading never counts it — FAQ p.19).',
  },
];

/** The classic names of the rows above — the set a Redux deck must never contain. */
export const TURMOIL_REDUX_REPLACED_CLASSIC_NAMES: ReadonlySet<CardName> =
  new Set(TURMOIL_REDUX_CLASSIC_REPLACEMENTS.map((row) => row.classic));

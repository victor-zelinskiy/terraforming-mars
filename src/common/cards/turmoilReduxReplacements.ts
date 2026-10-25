import {CardName} from './CardName';

/**
 * THE CLASSIC TURMOIL CARDS THE REDUX SET REPLACES — a fact of the printed set,
 * never a worklist (rulebook p.1: «70 new Project cards (and 6 replacement
 * projects)», «8 new Corporation cards (and 1 replacement corporation)»; p.12:
 * «If you are playing with the official Turmoil expansion, remove the Septem
 * Tribus corporation card from it. It is not compatible with Turmoil Redux, and
 * is thus replaced in this expansion»).
 *
 * The classic card of every row is NEVER dealt into a Redux game. Until its
 * replacement is authored the hold-back list (`turmoilReduxAdaptation.ts`) keeps
 * it out; once it is, the Redux manifest's `cardsToRemove` takes over — upstream's
 * own shape for a same-name reprint (Promo's `Deimos Down:promo` over `Deimos
 * Down`, Ares' `Capital:ares` over `Capital`): the replacement is registered under
 * a `:redux`-suffixed `CardName` (`translateText` / `translateCardName` fall back
 * to the classic card's localized name; the journal chips cut the suffix), the
 * plain name stays the classic card's (guard: `TurmoilReduxCardManifest.spec` §
 * reserved), and the classic name goes into `cardsToRemove` in the same diff that
 * removes it from the hold-back list (guard: `tests/cards/turmoil/
 * TurmoilCardsUnderRedux.spec.ts`).
 *
 * The rows live in `common` because the PREMIUM SCOPE reads them on both sides
 * (`premiumScope.ts`): a replaced classic card never reaches a Redux table, so it
 * never enters the scope — not while held back, not after its row has left the
 * hold-back list. The server re-exports them from `cards/turmoilRedux/classicReplacements.ts`.
 *
 * CARD NUMBERS — the six project scans all print the placeholder «TR00». The
 * replacements take `TR71…TR76` IN THE ORDER OF THE PROJECT ROWS BELOW (Aerial
 * Lenses TR71 … Vote of No Confidence TR76; the manifest guard pins that a number
 * past TR70 belongs to exactly this row); the corporation (its scan prints no
 * number) takes TR77. Art and lore are the CLASSIC card's,
 * borrowed through `metadata.reimplements` (`cardArt.ts` `artKey`, `cardLore.ts`
 * `cardLoreSource`) — the illustration and the printed quote are the same; the
 * classic card number (`T01`…) keys both files.
 *
 * `scan` is relative to `…/TM Turmoil Redux/`; `changes` is what the scan prints
 * differently from the classic card (read 2026-10-21).
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
    // TR71 — AUTHORED 2026-10-24 (`turmoilRedux/AerialLensesRedux.ts`, `Aerial Lenses:redux`).
    classic: CardName.AERIAL_LENSES, kind: 'project', scan: 'Projects/Replacement - Aerial Lenses.png',
    changes: 'party Kelvinists → SCIENTISTS (not the Greens the general Kelvinists→Greens rule would give); cost 2 → 3; gains a Science tag; the −1 VP is gone. Same body: remove up to 2 plants from any player, +2 heat production.',
  },
  {
    // TR72 — AUTHORED 2026-10-24 (`turmoilRedux/BannedDelegateRedux.ts`, `Banned Delegate:redux`).
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
    // TR75 — AUTHORED 2026-10-25 (`turmoilRedux/SponsoredMoholeRedux.ts`, `Sponsored Mohole:redux`) — the third authored,
    // numbered by THIS row (TR73 / TR74 above are still to come).
    classic: CardName.SPONSORED_MOHOLE, kind: 'project', scan: 'Projects/Replacement - Sponsored Mohole.png',
    changes: 'party Kelvinists → GREENS (printed, what the general rule gives anyway); still cost 5, Building tag, +2 heat production; gains 1 VP.',
  },
  {
    classic: CardName.VOTE_OF_NO_CONFIDENCE, kind: 'project', scan: 'Projects/Replacement - Vote of No Confidence.png',
    changes: 'still cost 5, event; requirement «a party leader + a NEUTRAL chairman» → «at least 1 influence»; removes the CURRENT chairman whoever holds the seat (a player\'s delegate too) and seats your own from the reserve; reward +1 TR → advance the Agenda marker 1 step.',
  },
  {
    // TR77 — AUTHORED 2026-10-25 (`turmoilRedux/SeptemTribusRedux.ts`, `Septem Tribus:redux`) — the corporation row,
    // numbered past the six project rows.
    classic: CardName.SEPTUM_TRIBUS, kind: 'corporation', scan: 'Corporations/Corporation - Septem Tribus.png',
    changes: '36 → 40 M€, Wild tag kept; the M€-per-party action is gone. First action: place 1 player cube on the BANNER of any party. Effect: when you win on a resolution, place your cube on its party\'s banner; you gain the effect of every party whose banner holds at least 1 of your cubes — in addition to the ruling party and the 2-delegate road (the `grantPartyEffect` reserve of `PoliticalOps`; the requirement reading never counts it — FAQ p.19).',
  },
];

/** The classic names of the rows above — the set a Redux deck must never contain. */
export const TURMOIL_REDUX_REPLACED_CLASSIC_NAMES: ReadonlySet<CardName> =
  new Set(TURMOIL_REDUX_CLASSIC_REPLACEMENTS.map((row) => row.classic));

/** The first card number past the printed 70 — the replacement of the first PROJECT row. */
export const FIRST_REPLACEMENT_CARD_NUMBER = 71;

/**
 * The `TR##` number a replacement of `classic` carries: TR71 + its index among
 * the PROJECT rows (registry order), and the CORPORATION the first number past
 * them (TR77 — decided 2026-10-25: one prefix, one namespace). Undefined for a
 * card that is not replaced.
 */
export function replacementCardNumber(classic: CardName): string | undefined {
  const projects = TURMOIL_REDUX_CLASSIC_REPLACEMENTS.filter((row) => row.kind === 'project');
  const index = projects.findIndex((row) => row.classic === classic);
  if (index >= 0) {
    return `TR${FIRST_REPLACEMENT_CARD_NUMBER + index}`;
  }
  const corporations = TURMOIL_REDUX_CLASSIC_REPLACEMENTS.filter((row) => row.kind === 'corporation');
  const corp = corporations.findIndex((row) => row.classic === classic);
  return corp < 0 ? undefined : `TR${FIRST_REPLACEMENT_CARD_NUMBER + projects.length + corp}`;
}

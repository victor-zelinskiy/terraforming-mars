/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE PLAYED-CARD TARGET MODEL — the authoritative shape behind the embedded
 * «выбор разыгранной карты» step.
 *
 * WHAT THIS IS FOR. Several cards ask the player to point at a card that is
 * already ON THE TABLE — Industrial Robots copies a building's production,
 * Predators eats another card's animals, and a dozen more will follow. Until
 * now those picks fell through to a generic inline text list (candidates the
 * console owned no surface for), which told the player nothing about WHERE the
 * card is, WHOSE it is, or WHAT choosing it would do.
 *
 * WHAT THIS IS NOT — and this is the load-bearing decision. It is NOT a second
 * «Разыграно» tableau. The full tableau already exists twice (the board overlay
 * and the Information Workspace), both carrying real optimisation work for the
 * dozens of cards a late game holds. This model deliberately carries ONLY the
 * eligible candidates, so the cost of the step scales with the number of
 * CHOICES, never with the size of the table. A player with thirty played cards
 * and two legal targets builds a two-card model.
 *
 * ELIGIBILITY IS THE SERVER'S. The candidate set is `SelectCardModel.cards` —
 * the prompt the server raised. Nothing here re-derives what may be picked;
 * this module only GROUPS what already arrived, resolves each card's physical
 * owner from the live tableaux, and asks its caller for the contextual preview.
 *
 * THE PREVIEW IS INJECTED, NEVER COMPUTED HERE. `buildPlayedTargetModel` takes
 * a `preview(cardName)` callback: the composer builds sections from the server
 * preview's own data (a copy-production box, a resource delta), so this file —
 * and the component above it — contain zero card-specific game logic. That is
 * what makes the same surface serve Predators tomorrow without an edit.
 *
 * PURE: no DOM, no Vue, no i18n (labels are keys or already-resolved names).
 */
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {CardType} from '@/common/cards/CardType';
import {NavRect, pickDirectional, pickStrictGrid} from '@/client/gamepad/spatialNav';

/** The tableau sections a candidate can belong to — the same vocabulary the
 *  «Разыграно» surfaces use, so the origin reads the same everywhere. */
export type PlayedTargetCategory = 'corporation' | 'prelude' | 'ceo' | 'active' | 'automated' | 'event';

/** The category rail's order — the tableau's own reading order. */
export const PLAYED_TARGET_CATEGORY_ORDER: ReadonlyArray<PlayedTargetCategory> =
  ['corporation', 'prelude', 'ceo', 'active', 'automated', 'event'];

const CATEGORY_LABEL: Record<PlayedTargetCategory, string> = {
  corporation: 'Corporation',
  prelude: 'Preludes',
  ceo: 'CEO',
  active: 'Active',
  automated: 'Automated',
  event: 'Events',
};

export function playedTargetCategoryLabel(c: PlayedTargetCategory): string {
  return CATEGORY_LABEL[c];
}

export function playedTargetCategoryOf(type: CardType | undefined): PlayedTargetCategory {
  switch (type) {
  case CardType.CORPORATION: return 'corporation';
  case CardType.PRELUDE: return 'prelude';
  case CardType.CEO: return 'ceo';
  case CardType.ACTIVE: return 'active';
  case CardType.EVENT: return 'event';
  default: return 'automated';
  }
}

/**
 * ONE contextual fact about choosing a candidate. Either a `current →
 * resulting` reading (the honest form whenever a countable moves — the fork's
 * no-blind-target rule) or a plain amount chip when there is nothing to
 * compare against.
 */
export type PlayedTargetImpact = {
  /** i18n key, or an already-resolved proper name when `translate` is false. */
  label: string;
  translate?: boolean;
  /** Resource icon key (`optionIcons.iconClassFor` vocabulary). */
  icon?: string;
  from?: number;
  to?: number;
  /** A standalone delta when there is no before/after to show. */
  amount?: number;
  /**
   * The reading is TRUE but does not move — «эта карта даёт 1 ПО за каждые две
   * фишки, и там сейчас чётное число». It is shown, because silence would make
   * it look like a card whose points the resource never touches, and those are
   * opposite answers when you are choosing what to take. It is shown QUIETLY, so
   * the eye still lands on the candidates where something actually happens.
   */
  static?: boolean;
};

/**
 * A titled group of impacts, scoped to WHAT it changes. The entity matters:
 * the player must be able to tell «this happens to the card I am pointing at»
 * from «this happens to the card I am playing».
 */
export type PlayedTargetPreviewSection = {
  key: string;
  /** i18n key. */
  title: string;
  entity: 'target' | 'source' | 'player' | 'global';
  impacts: ReadonlyArray<PlayedTargetImpact>;
  /** A quiet clarifying line (i18n key), e.g. «источник не изменится». */
  note?: string;
};

/**
 * ONE contextual fact, flattened out of its section for the ONE-LINE readings
 * (the focus rail, the answered summary). The section TITLE and its clarifying
 * note are deliberately dropped here: a quick line that also says «БУДЕТ
 * СКОПИРОВАНО» and «источник не изменится» is three readings of one fact, which
 * is the exact noise this surface removed. `entity` survives because WHAT the
 * change happens to is data — the target's own numbers must never be confused
 * with the player's.
 */
export type PlayedTargetQuickImpact = PlayedTargetImpact & {
  key: string;
  entity: PlayedTargetPreviewSection['entity'];
};

/** The focus rail's line. Beyond this the line stops being glanceable. */
export const PLAYED_TARGET_RAIL_IMPACT_CAP = 3;
/** The answered summary's line — the Result already carries the full before→after. */
export const PLAYED_TARGET_SUMMARY_IMPACT_CAP = 2;

/**
 * THE ONE derivation behind every quick reading. The rail, the summary and (via
 * the host's own fold) the Result all descend from the same injected preview, so
 * the three can never state the same effect in three slightly different ways.
 */
export function playedTargetQuickImpacts(
  sections: ReadonlyArray<PlayedTargetPreviewSection>,
): ReadonlyArray<PlayedTargetQuickImpact> {
  const out: Array<PlayedTargetQuickImpact> = [];
  sections.forEach((sec, si) => {
    sec.impacts.forEach((imp, ii) => {
      out.push({...imp, key: `${si}:${ii}`, entity: sec.entity});
    });
  });
  return out;
}

/**
 * A resource overlay on a candidate face — EXPLICIT, never inferred.
 *
 * The first cut painted `model.resources` on every candidate, so Industrial
 * Robots' building cards each wore a gold «0»: a number that is true, has no
 * bearing on the choice, and reads as a cost. A card's resource belongs on this
 * surface only when the resource IS the choice (Predators eats animals) — which
 * is knowledge the HOST has and this component never will.
 */
export type PlayedTargetResourceContext = {
  /** Resource icon key (`optionIcons.iconClassFor` vocabulary). */
  icon: string;
  count: number;
  /**
   * Draw the badge at zero too. Off by default: a zero is normally noise, and
   * the one case where it matters (a legal target that happens to be empty)
   * has to be asked for deliberately.
   */
  showZero?: boolean;
};

/** Does this candidate's resource context earn a badge? */
export function playedTargetShowsResource(ctx: PlayedTargetResourceContext | undefined): boolean {
  return ctx !== undefined && (ctx.count > 0 || ctx.showZero === true);
}

/**
 * HOW a candidate relates to the card that raised the prompt.
 *
 * `source-card` is the card ITSELF being a legal target — «Обстрел кометами»
 * adds its asteroid to any card, and it is a card. Rendering that as a second
 * full-size face is the one thing this surface must never do: the source card
 * is already standing on the left, and two copies of one object is exactly the
 * physicality this fork spends its motion budget defending. It gets a HANDLE
 * that points at the real card instead.
 */
export type PlayedTargetRelation = 'external-card' | 'source-card';

export type PlayedTargetCandidate = {
  cardName: CardName;
  category: PlayedTargetCategory;
  /** External card, or the source card itself (see the type). */
  relation: PlayedTargetRelation;
  /** The owner's colour — the stable per-game identity the console keys on. */
  ownerId: string;
  /**
   * THE PHYSICAL ANCHOR. The card keeps lying in its owner's tableau; this is
   * the key that finds it there (`data-zoom-slot`). Carried so a future
   * iteration can animate a resource physically leaving the real card — the
   * selection result must never reduce to a bare name.
   */
  slotKey: string;
  /** Contextual preview, injected by the caller (never derived here). */
  preview: ReadonlyArray<PlayedTargetPreviewSection>;
  /** The resource badge THIS choice justifies, if any (see the type). */
  resourceContext?: PlayedTargetResourceContext;
  /** The live card model (resource counts etc.) for the face + badges. */
  model: CardModel;
};

export type PlayedTargetOwner = {
  /** Colour — the identity the console keys on. */
  id: string;
  name: string;
  color: string;
  /** The viewer's own tableau. */
  self: boolean;
  /**
   * The owner's FULL played-card count. Shown next to the eligible count so
   * «ДОСТУПНО 2» reads as a filtered view of a real, larger table rather than
   * as everything that player owns.
   */
  totalPlayed: number;
  candidates: ReadonlyArray<PlayedTargetCandidate>;
};

/**
 * HOW MANY cards this step asks for.
 *
 * `single` is «point at one card»: A chooses and the step closes — no
 * accumulation, no confirm.
 *
 * `multi` is the up-to-N ask the server merges into ONE response (Astra
 * Mechanica's «return up to 2 events»). It is deliberately NOT modelled as
 * several single steps: the server sends one merged prompt with one title and
 * one `min`, so splitting it into rows would invent a sequence the rules do
 * not have. Cards that genuinely ARE several asks (Cyberia's two copy steps)
 * already arrive as separate steps and get their own zone each — the shape
 * follows the server, never the other way round.
 */
export type PlayedTargetSelection =
  | {mode: 'single'}
  | {mode: 'multi', min: number, max: number, picked: ReadonlyArray<string>};

export type PlayedTargetContract = {
  /** The server's own ask, already resolved to the player's language. */
  ask: string;
  targetCount: number;
  ownerCount: number;
  /** At least one candidate belongs to the viewer. */
  selfAllowed: boolean;
  /** At least one candidate belongs to somebody else. */
  opponentsInvolved: boolean;
};

/** Toggle a candidate in a multi selection, respecting the cap. Returns the
 *  SAME list when the cap blocks the add — the caller can compare identity to
 *  tell «nothing happened» from «picked», and say so honestly. */
export function togglePlayedTargetPick(
  picked: ReadonlyArray<string>,
  cardName: string,
  max: number,
): ReadonlyArray<string> {
  if (picked.includes(cardName)) {
    return picked.filter((n) => n !== cardName);
  }
  if (picked.length >= max) {
    return picked;
  }
  return [...picked, cardName];
}

/** May a multi selection be submitted as it stands? */
export function playedTargetPicksValid(selection: PlayedTargetSelection): boolean {
  return selection.mode === 'single' ||
    (selection.picked.length >= selection.min && selection.picked.length <= selection.max);
}

/** Drop picks whose cards are no longer candidates (the realtime path). */
export function prunePlayedTargetPicks(
  picked: ReadonlyArray<string>,
  owners: ReadonlyArray<PlayedTargetOwner>,
): ReadonlyArray<string> {
  const live = new Set<string>(owners.flatMap((o) => o.candidates.map((c) => c.cardName as string)));
  return picked.filter((n) => live.has(n));
}

export type PlayedTargetModel = {
  contract: PlayedTargetContract;
  owners: ReadonlyArray<PlayedTargetOwner>;
};

/** The minimum a caller must know about a player to be grouped. */
export type PlayedTargetPlayerRef = {
  name: string;
  color: string;
  tableau: ReadonlyArray<{name: string}>;
};

export type BuildPlayedTargetInput = {
  /** The server's SELECTABLE candidates — eligibility, verbatim. */
  candidates: ReadonlyArray<CardModel>;
  /** Every player, for owner resolution + the honest total counts. */
  players: ReadonlyArray<PlayedTargetPlayerRef>;
  /** The viewer's colour. */
  viewerColor: string;
  /**
   * The card that RAISED this prompt, when it is also a legal target. It is
   * already standing on the left of the workspace, so the selector must point
   * AT it rather than draw a second full-size copy of the same object.
   */
  sourceCardName?: CardName;
  /** The prompt's ask, already translated by the caller. */
  ask: string;
  /** Card type resolver (`ClientCardManifest.getCard`), injected for purity. */
  typeOf: (name: CardName) => CardType | undefined;
  /** The contextual preview for one candidate — the caller's game knowledge. */
  preview: (name: CardName) => ReadonlyArray<PlayedTargetPreviewSection>;
  /**
   * The resource badge this choice justifies on a candidate, if any. Omitted by
   * default on purpose: no host gets a generic resource overlay for free.
   */
  resourceContext?: (name: CardName, model: CardModel) => PlayedTargetResourceContext | undefined;
};

/**
 * Build the model.
 *
 * Owners with NO eligible candidate are not emitted at all — not as an empty
 * group, not as a disabled tab. The component therefore never needs to know
 * that a MarsBot's tableau is usually off-limits: the rule lives in the
 * server's candidate set, and a future card that legitimately targets the bot
 * simply produces an owner here with no change anywhere else.
 *
 * OPPONENTS FIRST, the viewer last. Targeting your own card is a deliberate
 * act; putting your tableau at the end keeps it from being the accidental
 * default the cursor lands on.
 */
export function buildPlayedTargetModel(input: BuildPlayedTargetInput): PlayedTargetModel {
  const byColor = new Map<string, PlayedTargetOwner & {candidates: Array<PlayedTargetCandidate>}>();
  for (const model of input.candidates) {
    const owner = input.players.find((p) => p.tableau.some((c) => c.name === model.name));
    if (owner === undefined) {
      // A candidate nobody's tableau claims (a hosted / virtual card) has no
      // physical origin to show, and this surface is ABOUT physical origin.
      continue;
    }
    let group = byColor.get(owner.color);
    if (group === undefined) {
      group = {
        id: owner.color,
        name: owner.name,
        color: owner.color,
        self: owner.color === input.viewerColor,
        totalPlayed: owner.tableau.length,
        candidates: [],
      };
      byColor.set(owner.color, group);
    }
    group.candidates.push({
      cardName: model.name as CardName,
      category: playedTargetCategoryOf(input.typeOf(model.name as CardName)),
      relation: model.name === input.sourceCardName ? 'source-card' : 'external-card',
      ownerId: owner.color,
      slotKey: model.name,
      preview: input.preview(model.name as CardName),
      resourceContext: input.resourceContext?.(model.name as CardName, model),
      model,
    });
  }
  const owners = [...byColor.values()]
    .map((g) => ({...g, candidates: sortByCategory(g.candidates)}))
    .sort((a, b) => Number(a.self) - Number(b.self));
  const targetCount = owners.reduce((n, o) => n + o.candidates.length, 0);
  return {
    owners,
    contract: {
      ask: input.ask,
      targetCount,
      ownerCount: owners.length,
      selfAllowed: owners.some((o) => o.self),
      opponentsInvolved: owners.some((o) => !o.self),
    },
  };
}

function sortByCategory(candidates: ReadonlyArray<PlayedTargetCandidate>): Array<PlayedTargetCandidate> {
  return [...candidates].sort((a, b) =>
    PLAYED_TARGET_CATEGORY_ORDER.indexOf(a.category) - PLAYED_TARGET_CATEGORY_ORDER.indexOf(b.category));
}

/** One rendered category block inside an owner group. */
export type PlayedTargetSection = {
  category: PlayedTargetCategory;
  label: string;
  candidates: ReadonlyArray<PlayedTargetCandidate>;
};

/**
 * The owner's candidates split into category blocks — EMPTY CATEGORIES ARE
 * NEVER EMITTED. A zero-count rail would spend the surface's scarcest
 * dimension on describing what is not there, which is precisely the full-
 * tableau impression this step must not give.
 */
export function playedTargetSections(owner: PlayedTargetOwner): ReadonlyArray<PlayedTargetSection> {
  const out: Array<PlayedTargetSection> = [];
  for (const category of PLAYED_TARGET_CATEGORY_ORDER) {
    const candidates = owner.candidates.filter((c) => c.category === category);
    if (candidates.length > 0) {
      out.push({category, label: playedTargetCategoryLabel(category), candidates});
    }
  }
  return out;
}

/**
 * Does the category RAIL earn its line? With a single block the label repeats
 * what the contract line above already said and what the cards themselves
 * show — so it is suppressed and the vertical space goes to the cards.
 */
export function playedTargetShowsCategoryRails(sections: ReadonlyArray<PlayedTargetSection>): boolean {
  return sections.length > 1;
}

/**
 * Does the owner bar earn a SECOND number?
 *
 * With one owner the answer is no, and this is the whole duplication rule in one
 * place. «Доступных целей: 2» in the contract, «ДОСТУПНО 2» in the owner bar and
 * «АКТИВНЫЕ 1 · АВТОМАТИЧЕСКИЕ 1» in the rails were three statements of the same
 * count, each read as if it might mean something the others didn't. The owner
 * bar keeps «РАЗЫГРАНО N» — that one says something nothing else does: this is a
 * FILTERED view of a real, larger table.
 *
 * With several owners the per-owner count is no longer a repeat of the total, so
 * it comes back — it now answers «where are they».
 */
export function playedTargetShowsOwnerTargetCount(owners: ReadonlyArray<PlayedTargetOwner>): boolean {
  return owners.length > 1;
}

// ── owner presentation: SPLIT vs TABS ───────────────────────────────────────

export type PlayedTargetLayoutMode = 'split' | 'tabs';

export type PlayedTargetLayout = {
  mode: PlayedTargetLayoutMode;
  /** Cards per row a single owner column can hold at a comfortable size. */
  perRow: number;
};

export type PlayedTargetLayoutInput = {
  owners: ReadonlyArray<PlayedTargetOwner>;
  /** Content width available to the owner zone (px). */
  availW: number;
  /** `conUiScale()` — the profile's rem factor. */
  ui: number;
  /** The Deck. Always tabs: its band has no width to split. */
  handheld: boolean;
};

/** A candidate card's comfortable box at ui 1 — below this it stops being a
 *  card the player can read and starts being a swatch. */
const MIN_CARD_W = 132;
/** Room a single owner column needs beyond its cards (rail, gutters). */
const OWNER_CHROME_W = 44;
/** Gap between the two owner columns in split view. */
const SPLIT_GAP = 28;
/** Beyond this many candidates a side stops being a comparable group and
 *  starts being a grid — one owner at a time reads better. */
const SPLIT_MAX_CANDIDATES = 6;

/**
 * Decide the presentation. Deliberately NOT `owners.length === 2 ? split :
 * tabs`: two owners with seven candidates each on a 1080 band produce two
 * cramped grids, which is worse than one comfortable group. The decision reads
 * the real space budget and is DETERMINISTIC for a given model + viewport, so
 * it can be taken once, before the step is visible, and never re-taken while
 * the player is interacting with it.
 */
export function planPlayedTargetLayout(o: PlayedTargetLayoutInput): PlayedTargetLayout {
  const cardW = MIN_CARD_W * o.ui;
  const singleColumnPerRow = Math.max(1, Math.floor((o.availW - OWNER_CHROME_W * o.ui) / cardW));
  const tabs: PlayedTargetLayout = {mode: 'tabs', perRow: singleColumnPerRow};

  if (o.handheld || o.owners.length !== 2) {
    return tabs;
  }
  const busiest = Math.max(...o.owners.map((owner) => owner.candidates.length));
  if (busiest > SPLIT_MAX_CANDIDATES) {
    return tabs;
  }
  // Both columns must still hold their busiest owner's widest row at a
  // readable size — otherwise the split is bought with the cards' legibility.
  const columnW = (o.availW - SPLIT_GAP * o.ui) / 2 - OWNER_CHROME_W * o.ui;
  const perRow = Math.floor(columnW / cardW);
  if (perRow < 1 || perRow < Math.min(busiest, 2)) {
    return tabs;
  }
  return {mode: 'split', perRow};
}

// ── candidate SIZING: the surface is spent on the cards that exist ──────────

/** The premium face's unzoomed box (`--pcard-w` / `--pcard-h`). */
const SLOT_W = 320;
const SLOT_H = 460;

/**
 * A candidate never out-sizes the SOURCE card (`zoom: 1.24·ui` on TV). The
 * source is the subject of the whole screen; a target that matches it turns the
 * step into a comparison between two heroes.
 */
const MAX_CARD_ZOOM = 1.0;
const MAX_CARD_ZOOM_HANDHELD = 0.6;
/**
 * A LONE target may take more room — there is no second card to be fair to, and
 * one choice drawn at pair size reads as a list that happens to have one item.
 *
 * This is a CEILING, not a layout branch. Everything else about the single case
 * is the general path: same flow rules, same fit, same navigation. The ceiling
 * only ever moves UP with fewer candidates, so the monotonic invariant
 * (`size(1) ≥ size(2) ≥ size(3+)`) holds by construction rather than by luck —
 * and it stays clear of the source card's own `1.24·ui`.
 */
const SOLO_CARD_ZOOM = 1.12;
const SOLO_CARD_ZOOM_HANDHELD = 0.68;
/** Below this a card stops being readable and starts being a swatch. */
const MIN_CARD_ZOOM = 0.3;
const MIN_CARD_ZOOM_HANDHELD = 0.24;

/**
 * The focused candidate's emphasis. Deliberately tiny: at the sizes this step
 * now reaches, a 4–5 % growth is 30 px of movement and reads as the card jumping
 * rather than being selected. The cue's weight is the ring and the lift — both
 * `box-shadow`/`transform`, so both survive performance mode.
 *
 * Mirrored in LESS as `--con-ptsel-focus-scale`, and the layout RESERVES exactly
 * this much room in its gap, which is why the two are one exported constant.
 */
export const PLAYED_TARGET_FOCUS_SCALE = 1.02;
/** Ring + glow headroom around a focused card, rem-equivalent px at ui 1. */
const FOCUS_GLOW_PX = 7;

/** Chrome the sizing has to live around, in rem-equivalent px at ui 1.
 *  These MIRROR the LESS block — a card gap of `.55rem` is 11 px at the 20 px
 *  rem base — so the fit that was solved is the fit that gets rendered. */
const CARD_GAP = 11;
const SECTION_GAP = 18;
const SECTION_RAIL_H = 20;
const OWNER_BAR_H = 28;
/** The cards row's own vertical padding — where the focus lift happens. */
const ZONE_PAD_Y = 12;
// (A per-category column cap and a descending zoom scan used to live here.
//  Both belonged to the old «space to categories first» model: the cap bounded
//  how many independent columns could exist, and the scan searched for a size
//  that fit inside them. The solver derives both from the cards instead.)

export type PlayedTargetSectionFlow = 'columns' | 'rows';

export type PlayedTargetSizing = {
  /** The candidate slot's `zoom` (published as `--con-ptsel-zoom`). */
  cardZoom: number;
  /** The focus-safe gap between candidate cards, px (`--con-ptsel-gap`). */
  gapPx: number;
  /** Category blocks side by side, or stacked. */
  sectionFlow: PlayedTargetSectionFlow;
  /** Category columns actually laid out side by side (1 = stacked). */
  sectionColumns: number;
  /**
   * ROWS the grid uses. Every category lays its own cards across the SAME
   * number of rows, so a category spans `ceil(n / rows)` columns — which is
   * how a two-card category gets twice the width of a one-card one instead of
   * an equal half it then has to stack inside.
   */
  rows: number;
  /** The widest section's cards-per-row at this size (nav fallback + CSS hint). */
  perRow: number;
  /** Nothing fits even at the floor — the zone must scroll for real. */
  overflows: boolean;
};

export type PlayedTargetSizingInput = {
  owners: ReadonlyArray<PlayedTargetOwner>;
  /** `split` fits BOTH groups; `tabs` fits the busiest one (tabs must not resize). */
  mode: PlayedTargetLayoutMode;
  /** The candidate zone's content box, measured. */
  availW: number;
  availH: number;
  ui: number;
  handheld: boolean;
};

/** The card's aspect as width-per-height — the solver turns a height budget
 *  into a width with it. */
const ASPECT_W_OVER_H = SLOT_W / SLOT_H;

/** Rows considered. Past this a selection stops being a surface to read and
 *  becomes a catalogue — which is exactly when scrolling is the honest answer. */
const MAX_GRID_ROWS = 4;

/** One candidate arrangement of the whole visible set. */
type GridShape = {
  rows: number;
  /** The widest owner's total column count (the grid's real width in tracks). */
  columns: number;
  /** The uniform card width this shape affords, before clamping. */
  cardW: number;
};

/**
 * How many COLUMNS a category needs at a given row count — its span.
 *
 * This is the whole replacement for the old model. Width used to be handed out
 * per CATEGORY (an equal half, later a share by count) and each category then
 * packed inside its own allowance; a two-card category that came up 51 px short
 * of holding its pair stacked them vertically while the one-card category
 * beside it sat on a third of the band doing nothing. Now the CARDS are the
 * layout unit: every category lays its cards across the same rows, and its
 * width follows from how many columns that takes.
 */
function sectionColumnsAt(sections: ReadonlyArray<PlayedTargetSection>, rows: number): Array<number> {
  return sections.map((sec) => Math.max(1, Math.ceil(sec.candidates.length / rows)));
}

/**
 * THE LAYOUT SOLVER.
 *
 * Enumerates the honest arrangements — one row, two rows, … — and for each
 * derives the biggest uniform card the box can hold, from BOTH directions at
 * once:
 *
 *     width:  (ownerW − gaps) / columns
 *     height: ((ownerH − rail − rowGaps) / rows) × aspect
 *
 * The smaller wins, because a card has to fit both. Then the arrangement with
 * the LARGEST card wins overall, fewer rows breaking a tie — which makes the
 * required priority order fall out of the arithmetic instead of being a rule
 * someone has to remember to apply: a single wide row is preferred exactly
 * while it yields the biggest card, and multi-row packing takes over precisely
 * when it does not.
 *
 * Scrolling is deliberately NOT one of the options. It is what is left when
 * every arrangement lands under the readable floor — reported, never chosen.
 */
function solveGrid(
  groups: ReadonlyArray<ReadonlyArray<PlayedTargetSection>>,
  ownerW: number,
  ownerH: number,
  gap: number,
  sectionGap: number,
  railH: number,
): ReadonlyArray<GridShape> {
  const maxCards = Math.max(1, ...groups.map((secs) => secs.reduce((n, sec) => n + sec.candidates.length, 0)));
  const shapes: Array<GridShape> = [];
  for (let rows = 1; rows <= Math.min(MAX_GRID_ROWS, maxCards); rows++) {
    let cardW = Infinity;
    let columns = 1;
    for (const sections of groups) {
      const cols = sectionColumnsAt(sections, rows);
      const c = cols.reduce((a, b) => a + b, 0);
      const gaps = (c - 1) * gap + (sections.length - 1) * sectionGap;
      const byWidth = (ownerW - gaps) / c;
      const byHeight = ((ownerH - railH - (rows - 1) * gap) / rows) * ASPECT_W_OVER_H;
      cardW = Math.min(cardW, byWidth, byHeight);
      columns = Math.max(columns, c);
    }
    if (cardW > 0 && Number.isFinite(cardW)) {
      shapes.push({rows, columns, cardW});
    }
  }
  return shapes;
}

/**
 * THE CANDIDATE SIZE AND SHAPE — solved together, against the real box.
 *
 * Two models failed here before, both the same way: they allocated SPACE TO
 * CATEGORIES first and packed cards into whatever each one got. Equal halves
 * came first; a share-by-count came second and still left a two-card category
 * short of holding its pair, so it stacked them and overflowed a band with a
 * third of its width unused.
 *
 * The cards are the layout unit now.
 */
export function planPlayedTargetSizing(o: PlayedTargetSizingInput): PlayedTargetSizing {
  const solo = o.owners.reduce((n, owner) => n + owner.candidates.length, 0) === 1;
  const ceiling = o.handheld ?
    (solo ? SOLO_CARD_ZOOM_HANDHELD : MAX_CARD_ZOOM_HANDHELD) :
    (solo ? SOLO_CARD_ZOOM : MAX_CARD_ZOOM);
  const maxCardW = ceiling * o.ui * SLOT_W;
  const minCardW = (o.handheld ? MIN_CARD_ZOOM_HANDHELD : MIN_CARD_ZOOM) * o.ui * SLOT_W;
  const sectionGap = SECTION_GAP * o.ui;
  const ownerGap = SPLIT_GAP * o.ui;
  // Solved for the LARGEST card any shape could produce, so a shape can never
  // be accepted on a gap smaller than the one it will be drawn with.
  const gap = Math.max(CARD_GAP * o.ui, maxCardW * (PLAYED_TARGET_FOCUS_SCALE - 1) / 2 + FOCUS_GLOW_PX * o.ui);

  const groups = o.owners.map((owner) => playedTargetSections(owner));
  if (groups.length === 0) {
    return {
      cardZoom: minCardW / SLOT_W, gapPx: gap, sectionFlow: 'rows',
      sectionColumns: 1, rows: 1, perRow: 1, overflows: false,
    };
  }
  const ownerCols = o.mode === 'split' ? Math.max(1, o.owners.length) : 1;
  const ownerW = (o.availW - (ownerCols - 1) * ownerGap) / ownerCols;
  const ownerH = o.availH - OWNER_BAR_H * o.ui - ZONE_PAD_Y * o.ui;
  const railH = groups.some((secs) => playedTargetShowsCategoryRails(secs)) ? SECTION_RAIL_H * o.ui : 0;

  const shapes = solveGrid(groups, ownerW, ownerH, gap, sectionGap, railH);
  const sections = Math.max(...groups.map((g) => g.length));
  const perRowOf = (rows: number): number =>
    Math.max(...groups.map((g) => Math.max(...sectionColumnsAt(g, rows))));

  let best: GridShape | undefined;
  for (const shape of shapes) {
    const w = Math.min(shape.cardW, maxCardW);
    if (w < minCardW) {
      continue;
    }
    if (best === undefined || w > Math.min(best.cardW, maxCardW)) {
      best = shape;
    }
  }
  if (best !== undefined) {
    return {
      cardZoom: Math.min(best.cardW, maxCardW) / SLOT_W,
      gapPx: gap,
      sectionFlow: sections > 1 ? 'columns' : 'rows',
      sectionColumns: sections,
      rows: best.rows,
      perRow: perRowOf(best.rows),
      overflows: false,
    };
  }

  // NOTHING fits at a readable size. The cards stay readable and the viewport
  // scrolls — the one thing this surface may never trade away is being able to
  // read the candidates. The shape taken is the flattest one considered, at the
  // floor, so the scroll is as short as the floor allows.
  const fallback = shapes[shapes.length - 1] ?? {rows: 1, columns: 1, cardW: minCardW};
  return {
    cardZoom: minCardW / SLOT_W,
    gapPx: gap,
    sectionFlow: sections > 1 ? 'columns' : 'rows',
    sectionColumns: sections,
    rows: fallback.rows,
    perRow: perRowOf(fallback.rows),
    overflows: true,
  };
}

// ── focus navigation (pure) ─────────────────────────────────────────────────

/** Where the cursor stands: an owner and an index into their candidates. */
export type PlayedTargetFocus = {ownerId: string, index: number};

export type PlayedTargetNavDir = 'left' | 'right' | 'up' | 'down';

/**
 * Step the cursor. In SPLIT mode the owner groups are neighbours in space, so
 * running off the right edge of the left group enters the right one at a
 * comparable row rather than jumping to an arbitrary index — index-based
 * teleports between groups are exactly what makes a two-column picker feel
 * random. In TABS mode the horizontal edges simply hold (LB/RB own the owner
 * axis there, and a silent owner change under a directional press would be
 * the same teleport by another name).
 */
export function stepPlayedTargetFocus(
  focus: PlayedTargetFocus,
  dir: PlayedTargetNavDir,
  owners: ReadonlyArray<PlayedTargetOwner>,
  layout: PlayedTargetLayout,
): PlayedTargetFocus {
  const ownerAt = owners.findIndex((o) => o.id === focus.ownerId);
  if (ownerAt < 0) {
    return owners.length > 0 ? {ownerId: owners[0].id, index: 0} : focus;
  }
  const owner = owners[ownerAt];
  const perRow = Math.max(1, layout.perRow);
  const count = owner.candidates.length;
  const col = focus.index % perRow;
  const row = Math.floor(focus.index / perRow);

  if (dir === 'up' || dir === 'down') {
    const nextRow = row + (dir === 'down' ? 1 : -1);
    const next = nextRow * perRow + col;
    return next >= 0 && next < count ? {...focus, index: next} : focus;
  }
  const nextIndex = focus.index + (dir === 'right' ? 1 : -1);
  const leavingRight = dir === 'right' && (col === perRow - 1 || nextIndex >= count);
  const leavingLeft = dir === 'left' && col === 0;
  if (!leavingRight && !leavingLeft && nextIndex >= 0 && nextIndex < count) {
    return {...focus, index: nextIndex};
  }
  if (layout.mode !== 'split') {
    return focus;
  }
  const neighbour = owners[ownerAt + (dir === 'right' ? 1 : -1)];
  if (neighbour === undefined || neighbour.candidates.length === 0) {
    return focus;
  }
  // Enter the neighbour at the SAME ROW where possible — the eye crosses the
  // gap horizontally, so the cursor must too.
  const entryCol = dir === 'right' ? 0 : perRow - 1;
  const entry = Math.min(neighbour.candidates.length - 1, Math.max(0, row * perRow + entryCol));
  return {ownerId: neighbour.id, index: entry};
}

/**
 * A candidate's MEASURED box, tagged with what it is. The component publishes
 * these from the live DOM; nothing here touches a DOM node.
 */
export type PlayedTargetCell = NavRect & {ownerId: string, index: number};

/**
 * THE REAL NAVIGATION — by where the cards ARE.
 *
 * `stepPlayedTargetFocus` walks an index with a `perRow` guess, and that guess
 * was wrong the moment category blocks stopped being one uniform grid: two
 * candidates in two categories sit one ABOVE the other, but a flat list of two
 * with `perRow: 3` says they are side by side, so Down did nothing and Right
 * moved between cards the player sees stacked. Index arithmetic cannot describe
 * a layout it does not own.
 *
 * So direction is resolved against the measured boxes, with the engine the hex
 * board already uses: `pickStrictGrid` first (a strict row/column traversal —
 * the predictable case, and the one that keeps a column walk from drifting
 * sideways), then `pickDirectional`'s scored cone for everything a grid cannot
 * describe: crossing a category column, crossing the gap into the other owner's
 * group, a ragged last row. Primary distance dominates, cross-axis offset is
 * penalised, near-perpendicular candidates are rejected outright.
 *
 * Returns `undefined` when nothing lies that way — an edge HOLDS. In tabs mode
 * only one owner is on screen, so the cell list contains one group and the
 * horizontal edges hold by construction: LB/RB stay the only owner axis, with
 * no second silent way to change tab.
 */
export function stepPlayedTargetFocusAt(
  focus: PlayedTargetFocus,
  dir: PlayedTargetNavDir,
  cells: ReadonlyArray<PlayedTargetCell>,
): PlayedTargetFocus | undefined {
  const at = cells.findIndex((c) => c.ownerId === focus.ownerId && c.index === focus.index);
  if (at < 0) {
    return undefined;
  }
  const from = cells[at];
  const others = cells.filter((_c, i) => i !== at);
  if (others.length === 0) {
    return undefined;
  }
  const hit = pickStrictGrid(from, others, dir) ?? pickDirectional(from, others, dir);
  if (hit === undefined) {
    return undefined;
  }
  return {ownerId: others[hit].ownerId, index: others[hit].index};
}

/** The owners LB/RB cycles through in tabbed mode (only those with targets —
 *  which, by construction, is all of them). */
export function stepPlayedTargetOwner(
  ownerId: string,
  delta: number,
  owners: ReadonlyArray<PlayedTargetOwner>,
): string {
  if (owners.length === 0) {
    return ownerId;
  }
  const at = Math.max(0, owners.findIndex((o) => o.id === ownerId));
  const next = (at + delta + owners.length) % owners.length;
  return owners[next].id;
}

/**
 * Re-seat a focus against a FRESH model — the realtime-update path. A target
 * that is gone (an opponent played over it, a resource ran out) must not
 * survive as a cursor pointing at nothing, and must never be confirmable: the
 * cursor lands on the nearest surviving candidate instead, and the caller sees
 * that its remembered selection no longer resolves.
 */
export function reseatPlayedTargetFocus(
  focus: PlayedTargetFocus | undefined,
  owners: ReadonlyArray<PlayedTargetOwner>,
): PlayedTargetFocus | undefined {
  if (owners.length === 0) {
    return undefined;
  }
  const owner = owners.find((o) => o.id === focus?.ownerId) ?? owners[0];
  const index = Math.min(Math.max(0, focus?.index ?? 0), owner.candidates.length - 1);
  return {ownerId: owner.id, index: Math.max(0, index)};
}

/** Find a card in the model — the «restore my previous target» read. */
export function findPlayedTargetFocus(
  cardName: string | undefined,
  owners: ReadonlyArray<PlayedTargetOwner>,
): PlayedTargetFocus | undefined {
  if (cardName === undefined) {
    return undefined;
  }
  for (const owner of owners) {
    const index = owner.candidates.findIndex((c) => c.cardName === cardName);
    if (index >= 0) {
      return {ownerId: owner.id, index};
    }
  }
  return undefined;
}

/** The candidate under a focus, or undefined. */
export function playedTargetAt(
  focus: PlayedTargetFocus | undefined,
  owners: ReadonlyArray<PlayedTargetOwner>,
): PlayedTargetCandidate | undefined {
  if (focus === undefined) {
    return undefined;
  }
  return owners.find((o) => o.id === focus.ownerId)?.candidates[focus.index];
}

/**
 * THE SELECTION RESULT — deliberately more than a card name.
 *
 * Carrying the owner, the category, the physical slot key and the preview
 * snapshot is what lets a later iteration animate the effect on the REAL card
 * in the REAL tableau (a resource leaving Animal Farm and arriving on
 * Predators), re-open the selector on the right owner, and re-render the
 * summary without recomputing anything. The game-state version makes a stale
 * result detectable instead of silently confirmable.
 */
export type PlayedTargetResult = {
  cardName: CardName;
  ownerId: string;
  ownerName: string;
  ownerColor: string;
  self: boolean;
  category: PlayedTargetCategory;
  /** External card, or the source card itself — the summary suppresses its
   *  thumbnail for `source-card`, because that card is still on screen. */
  relation: PlayedTargetRelation;
  slotKey: string;
  preview: ReadonlyArray<PlayedTargetPreviewSection>;
  version: string;
};

export function playedTargetResultOf(
  candidate: PlayedTargetCandidate,
  owners: ReadonlyArray<PlayedTargetOwner>,
  version: string,
): PlayedTargetResult {
  const owner = owners.find((o) => o.id === candidate.ownerId);
  return {
    cardName: candidate.cardName,
    ownerId: candidate.ownerId,
    ownerName: owner?.name ?? '',
    ownerColor: owner?.color ?? candidate.ownerId,
    self: owner?.self === true,
    category: candidate.category,
    relation: candidate.relation,
    slotKey: candidate.slotKey,
    preview: candidate.preview,
    version,
  };
}

/** Is a remembered result still a legal, present target? */
export function playedTargetResultLive(
  result: PlayedTargetResult | undefined,
  owners: ReadonlyArray<PlayedTargetOwner>,
  version: string,
): boolean {
  if (result === undefined || result.version !== version) {
    return false;
  }
  return findPlayedTargetFocus(result.cardName, owners) !== undefined;
}

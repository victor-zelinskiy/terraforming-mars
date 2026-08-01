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

export type PlayedTargetCandidate = {
  cardName: CardName;
  category: PlayedTargetCategory;
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
  /** The prompt's ask, already translated by the caller. */
  ask: string;
  /** Card type resolver (`ClientCardManifest.getCard`), injected for purity. */
  typeOf: (name: CardName) => CardType | undefined;
  /** The contextual preview for one candidate — the caller's game knowledge. */
  preview: (name: CardName) => ReadonlyArray<PlayedTargetPreviewSection>;
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
      ownerId: owner.color,
      slotKey: model.name,
      preview: input.preview(model.name as CardName),
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

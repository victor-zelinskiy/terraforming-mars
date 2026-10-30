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
import {Tag} from '@/common/cards/Tag';
import {NavRect, pickDirectional, pickStrictGrid} from '@/client/gamepad/spatialNav';
import {ItemType} from '@/common/cards/render/Types';
import {TableTargetStand} from '@/client/console/played/tableTargetZone';

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
  /** The label's `${n}` params (numbers — never words that would need declension). */
  params?: ReadonlyArray<string>;
  /** A second phrase after the label, its own i18n key — a payment's «where» (PL-075's value line). */
  tail?: string;
  /** The tail's own `${n}` params («card with the ${0} tag»). Rendered with the tail by `readingText` — never by hand (PL-160). */
  tailParams?: ReadonlyArray<string>;
  /** Resource icon key (`optionIcons.iconClassFor` vocabulary). */
  icon?: string;
  /**
   * A CHOICE of goods at one price (PL-484 — TR57's steel OR titanium production): EVERY good's icon, in the printed
   * order, drawn joined by «/» instead of `icon` (which stays the first, for a reader that names one). Absent otherwise.
   */
  icons?: ReadonlyArray<string>;
  /** A SET of goods at one press (TR60): `icons` are joined by «+» instead of the choice's «/». */
  join?: 'and';
  /** The plate of EACH icon when the goods do not share one (TR60: the production step's box, the stock bare). */
  plates?: ReadonlyArray<'production' | undefined>;
  from?: number;
  to?: number;
  /** A standalone delta when there is no before/after to show. */
  amount?: number;
  /**
   * The RATE when the amount does not exist yet — a reward the cell decides
   * after this pick (Arboretum: «+1 for each adjacent city»). An i18n key; the
   * reading is the candidate's live count (`from`) followed by this rate,
   * never a guessed «→».
   */
  per?: string;
  /**
   * The reading is TRUE but does not move — «эта карта даёт 1 ПО за каждые две
   * фишки, и там сейчас чётное число». It is shown, because silence would make
   * it look like a card whose points the resource never touches, and those are
   * opposite answers when you are choosing what to take. It is shown QUIETLY, so
   * the eye still lands on the candidates where something actually happens.
   */
  static?: boolean;
  /**
   * A VALUE reading (PL-075) — what ONE unit is worth on this holder («a delegate on a resolution per unit», «pays
   * 5 M€ per unit for a Space card»). It moves nothing and is still the comparison the one-line rail exists for:
   * two candidates with the same counter differ by exactly this. Quiet voice, on the rail — never dropped like a
   * static «0 → 0».
   */
  value?: boolean;
  /** The icon rides the PRODUCTION PLATE (PL-135 — an action good that is a production step). */
  plate?: 'production';
  /**
   * WHAT THIS GAIN DOES on the candidate (К-T1, TR48 — `holderRoles.holderGainOutcome`): `gain` — tender or a look
   * that simply grows; `opens` — the gain brings a priced good within reach (the loud one: it is the answer to «where
   * do the N go»); `short` — still short of it after the gain; `already` — it was within reach before (quiet).
   * …and WHAT THIS LOSS COSTS (PL-267, TR52 — `holderRoles.holderLossOutcome`): `lost` — a priced good the holder had
   * within reach is gone (the loud one of an attack's pick); `kept` — still within reach after the loss (quiet);
   * `further` — it was short and is now further; `loss` — tender's money / a look's count falling.
   */
  outcome?: 'gain' | 'opens' | 'short' | 'already' | 'lost' | 'kept' | 'further' | 'loss';
  /**
   * THE TAG UNDER THE CARD ALREADY PRINTS THIS NUMBER (TR56 «КУДА ЛЯЖЕТ», П4) — the count's `from → to` and the
   * VP the gain moves. The one-line readings (the rail under the cursor, the answered row) leave it out: the same
   * digits twice on one screen, one of them under the very card the rail names, is a repeat, not a reading. The
   * FULL sections keep it (a host that lists every impact — the live task host — still reads it).
   */
  inTag?: boolean;
  /**
   * A reading whose NUMBERS the tag prints in full — a tender's money («Оплата: +18 M€ …» beside «[M€] +18 [V]»), a
   * look's count, an «also draws a card» tail. The rail keeps its words (they say WHY); the answered composer row,
   * which reads the tag beside the miniature, leaves it out. A threshold's sentence («Хватит на делегата: 3 / 3»)
   * is not one: under the tag it is a glyph and a ✓, and the row keeps the words.
   */
  tagSays?: boolean;
};

/**
 * WHAT A GAIN STEP CARRIES — the payload «N [resource]» that lands on the chosen card (TR56 «КУДА ЛЯЖЕТ», П3).
 * The step's contract line names it («КУДА: 3 [мех]») instead of the generic «choose a card»: the player chose WHAT
 * one level up, this level asks WHERE. `printed` — the card's own printed graphic of the chosen branch (the very
 * nodes the variant tile showed as its hero), when the host has it; else `amount` + `icon` speak it.
 */
export type PlayedTargetPayload = {
  amount: number;
  /** The card resource's icon key (`iconClassFor` vocabulary); '' when several kinds land (the print speaks). */
  icon: string;
  /**
   * ONE unit of one of SEVERAL kinds (TRP8 Aerospace Company: «1 mech OR fighter») — every kind's icon, drawn joined by
   * «/» after the amount; the unit's kind is the chosen card's. Absent for one kind or a print.
   */
  icons?: ReadonlyArray<string>;
  printed?: ReadonlyArray<ItemType>;
};

/**
 * The payload of a GAIN pick, from the step the host walks (its `amount` / `cardResource`) or the server's marker on
 * the live model (`resourceGainPrompt`) — a removal and a pick with no number have none (the contract keeps its
 * generic ask); a pick of several kinds without a print speaks the server's own list of kinds (`cardResources`).
 */
export function playedTargetPayloadOf(
  step: {amount?: number, cardResource?: string} | undefined,
  marker: {amount?: number, cardResource?: string, cardResources?: ReadonlyArray<string>} | undefined,
  printed?: ReadonlyArray<ItemType>,
): PlayedTargetPayload | undefined {
  const amount = step?.amount ?? marker?.amount;
  if (amount === undefined || amount <= 0) {
    return undefined;
  }
  const icon = step?.cardResource ?? marker?.cardResource ?? '';
  const kinds = icon === '' && marker?.cardResources !== undefined && marker.cardResources.length > 1 ? marker.cardResources : undefined;
  if (icon === '' && kinds === undefined && (printed === undefined || printed.length === 0)) {
    return undefined;
  }
  return {amount, icon, ...(kinds !== undefined ? {icons: kinds} : {}), ...(printed !== undefined && printed.length > 0 ? {printed} : {})};
}

/**
 * THE OUTCOME TAG under a candidate (PL-219, the owner's decision 2026-10-12 — the TR50 walk). The rail reads the
 * candidate UNDER THE CURSOR in full; this is the same answer, one line under EVERY candidate, so «where do the N go»
 * is answered by looking, not by walking the cursor over seven cards. Built by the preview from the same
 * `HolderGainOutcome` the rail's reading is (one source, two densities) and made of glyphs and digits only — a
 * word is an i18n key (`word`), never a sentence: «[M€] +5 [Космос]», «[делегат] 2/3», «[карта] 1/1 ✓», «ПО 3 → 4».
 */
export type PlayedTargetTag = {
  /** Icon key (`optionIcons.iconClassFor` vocabulary). */
  icon?: string;
  /** A CHOICE of goods at one price (PL-484): every good's icon, drawn joined by «/» instead of `icon`. */
  icons?: ReadonlyArray<string>;
  /** A SET of goods at one press (TR60): `icons` are joined by «+» instead of the choice's «/». */
  join?: 'and';
  /** The plate of EACH icon when the goods do not share one (TR60). */
  plates?: ReadonlyArray<'production' | undefined>;
  /** The icon rides the production plate (an action good that is a production step). */
  plate?: 'production';
  /** A short word before the numbers — an i18n key («VP»). */
  word?: string;
  /** The numbers — a signed delta, a fraction, `a → b`; empty for a bare ✓. */
  text: string;
  /** The tag a tender pays for — its glyph closes the tag («+5 [Космос]»). */
  payTag?: Tag;
  /** ✓ — the good is within reach after the gain (`opens`) or already was (`already`). */
  reached?: boolean;
  /** `opens` — the loud one; `gain` — plain; `short` / `already` / `static` — the quiet voice. */
  tone: 'opens' | 'gain' | 'short' | 'already' | 'static';
  /**
   * WHAT ELSE choosing this candidate gives (the server's `resourceGainPrompt.extraByCard` — TR53: a draw when the
   * card's resource is not science): one glyph-and-digit tail after the tag («· [карта] +1»), or the same glyph
   * STRUCK when the server names a zero («· [карта] ✕» — science draws nothing). Never a sentence: the rail says it.
   */
  extra?: ReadonlyArray<{icon: string, text: string, none?: true}>;
  /**
   * THE COUNT LEADS (TR56, П4) — the resource's own `from → to` when the tag's answer is something ELSE (a role's
   * money, a priced good, VP that move): «[мех] 0 → 3 · [M€] +15 [Стр.]». The decision is «where do these N go», and
   * it is answered by the count first, its consequence after; a plain storage tag IS the count and has no lead.
   */
  lead?: {icon?: string, text: string};
};

/**
 * A tag that says TWO things — the count it leads with AND its consequence — reads on TWO lines under a candidate (the
 * count, the consequence under it): on one line it outgrew the card it stands under (seven mech holders at 4K cut
 * «[мех] 2 → 3 · [M€] +5 [Космос]» to «2 → 3 · [M€] +:»). A tag that IS the count stays one line.
 */
export function playedTargetTagStacked(tag: PlayedTargetTag | undefined): boolean {
  return tag?.lead !== undefined &&
    (tag.icon !== undefined || tag.word !== undefined || tag.text !== '' || tag.payTag !== undefined || tag.reached === true || (tag.extra?.length ?? 0) > 0);
}

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
  /** The candidate's one-line outcome (PL-219) — set by the TARGET section of a gain; drawn under the card. */
  tag?: PlayedTargetTag;
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
/** A candidate's outcome tag (PL-219) — the first section that carries one. */
export function playedTargetTagOfPreview(sections: ReadonlyArray<PlayedTargetPreviewSection>): PlayedTargetTag | undefined {
  return sections.find((s) => s.tag !== undefined)?.tag;
}

export function playedTargetQuickImpacts(
  sections: ReadonlyArray<PlayedTargetPreviewSection>,
): ReadonlyArray<PlayedTargetQuickImpact> {
  const out: Array<PlayedTargetQuickImpact> = [];
  sections.forEach((sec, si) => {
    sec.impacts.forEach((imp, ii) => {
      if (!playedTargetImpactMoves(imp)) {
        return;
      }
      out.push({...imp, key: `${si}:${ii}`, entity: sec.entity});
    });
  });
  return out;
}

/**
 * THE ONE-LINE READINGS beside a TAG (TR56 «КУДА ЛЯЖЕТ», П4) — the rail under the cursor and the answered composer row:
 * the quick impacts minus the digits the outcome tag under the card already prints (the count it leads with, the VP
 * it answers with). The same number twice on one screen — once under the card, once on the line naming that card —
 * is a repeat, not a reading; what stays is what only words can say (a role's sentence, an outcome's reason).
 */
export function playedTargetReadingImpacts(
  sections: ReadonlyArray<PlayedTargetPreviewSection>,
): ReadonlyArray<PlayedTargetQuickImpact> {
  const tagged = new Set(sections.map((sec, si) => (sec.tag !== undefined ? si : -1)).filter((si) => si >= 0));
  return playedTargetQuickImpacts(sections).filter((imp) => {
    const si = Number(imp.key.split(':')[0]);
    return !(tagged.has(si) && imp.inTag === true);
  });
}

/**
 * Does this reading actually CHANGE something?
 *
 * A `static` impact («эта карта даёт 1 ПО за каждые две фишки, и там сейчас
 * чётное число») earns its place in the FULL sections, where the player is
 * comparing candidates and silence would read as «points this never touches».
 * It earns nothing on the one-line readings: the focus rail summarises the card
 * under the cursor and the answered summary states a decision already made —
 * neither is a comparison, and «ПО 0 → 0» beside a real «0 → 1» is a second
 * chip that says nothing while taking the eye off the one that does.
 */
export function playedTargetImpactMoves(imp: PlayedTargetImpact): boolean {
  if (imp.value === true) {
    return true;
  }
  if (imp.static === true) {
    return false;
  }
  if (imp.from !== undefined && imp.to !== undefined && imp.from === imp.to) {
    return (imp.amount ?? 0) !== 0;
  }
  return true;
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
  /**
   * SHOWN, NEVER CHOSEN (TR52 — «a card with 1 data is not a target: shown unavailable with its reason, never
   * hidden»): a holder of the resource that falls SHORT of what the step takes (the server's `disabledCards`, its
   * own reason). It stands among the candidates so the player sees whose card is out of reach and why; A on it is
   * refused, the rail reads the reason, its tag reads «have / need ✕». Undefined — an ordinary candidate.
   */
  blocked?: {reason: string, have: number, need: number};
  /**
   * A PLAYER'S STAND-IN («ЦЕЛЬ НА СТОЛЕ — ОДНА ЗОНА», `tableTargetZone.ts`): a target that is a player's unit, not a card
   * (the bot's animals, a player's plants — Virus) is a TILE on a slot's chassis — never a card face (a face would lie
   * that there is a card). Its `cardName` is its stand key; its reading is the server's own. Undefined — a real card.
   */
  stand?: TableTargetStand;
};

export type PlayedTargetOwner = {
  /** Colour — the identity the console keys on. */
  id: string;
  name: string;
  color: string;
  /** The viewer's own tableau. */
  self: boolean;
  /**
   * Choosing from THIS group costs the viewer something they own, AND an
   * opponent's card was available instead.
   *
   * Both halves are load-bearing. Without the first, every «add to a card» pick
   * would warn about the player's own tableau — the normal target. Without the
   * second, a card whose cost IS its own resource (Air Raid spends your floater;
   * every candidate is yours) would warn on every row about a cost the player
   * already agreed to by activating it. A warning is only a warning where a
   * different, harmless choice existed.
   */
  selfHarm: boolean;
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

/**
 * WHICH WAY the resource moves. It is the axis that decides whether this
 * screen is a gift or a loss, and every host of the selector must be able to
 * state it: `add` puts something ON the chosen card (the ordinary play /
 * blue-action target), `remove` TAKES something off it (Predators eating an
 * animal, and every hostile MarsBot effect).
 *
 * It exists as its own field rather than as a sign on an amount because the
 * DIRECTION is what the presentation keys on — the accent of the focus ring,
 * whether targeting your own tableau is a warning, and whether the pre-commit
 * state reads as «сюда ляжет» or «это исчезнет». A number can be absent (a
 * copy-production pick has no delta at all) while the direction still matters.
 */
export type PlayedTargetDirection = 'add' | 'remove';

export type PlayedTargetContract = {
  /** The server's own ask, already resolved to the player's language. */
  ask: string;
  /** Which way the resource moves — `add` unless the host says otherwise. */
  direction: PlayedTargetDirection;
  targetCount: number;
  ownerCount: number;
  /** At least one candidate belongs to the viewer. */
  selfAllowed: boolean;
  /** At least one candidate belongs to somebody else. */
  opponentsInvolved: boolean;
  /** WHAT lands on the chosen card (TR56, П3) — the contract line's «КУДА: [печать]»; absent → the generic ask. */
  payload?: PlayedTargetPayload;
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
  /**
   * Holders SHOWN but not selectable — the near misses the caller chose from the server's `disabledCards` (see
   * `playedTargetShortfalls`), each with the server's reason. Default: none — the step shows only what it can take.
   */
  blocked?: ReadonlyArray<{model: CardModel, reason: string, have: number, need: number}>;
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
  /**
   * This step TAKES from the chosen card (Predators eats an animal) rather than
   * giving to it.
   *
   * It is what turns «your own card» from the ordinary case into a WARNING.
   * Adding a resource to your own card is the normal, good move — marking it
   * would train the player to ignore the marker long before they ever meet a
   * removal, and a warning nobody reads is worse than none.
   *
   * @deprecated The boolean shorthand for `direction: 'remove'`. Kept because
   * both existing hosts derive it straight from the sign of a step's amount;
   * `direction` wins when both are given.
   */
  takesFromTarget?: boolean;
  /** Which way the resource moves — see {@link PlayedTargetDirection}. Falls
   *  back to `takesFromTarget`, and to `add` when neither is given. */
  direction?: PlayedTargetDirection;
  /** Card type resolver (`ClientCardManifest.getCard`), injected for purity. */
  typeOf: (name: CardName) => CardType | undefined;
  /** The contextual preview for one candidate — the caller's game knowledge. */
  preview: (name: CardName) => ReadonlyArray<PlayedTargetPreviewSection>;
  /**
   * The resource badge this choice justifies on a candidate, if any. Omitted by
   * default on purpose: no host gets a generic resource overlay for free.
   */
  resourceContext?: (name: CardName, model: CardModel) => PlayedTargetResourceContext | undefined;
  /** What lands on the chosen card (`playedTargetPayloadOf`) — a GAIN pick only; the contract line names it. */
  payload?: PlayedTargetPayload;
  /**
   * PLAYERS AS TARGETS beside the cards (`tableTargetZone.ts`): the bot's unit of a marked removal, every player's plants
   * of Virus — each a stand-in tile in its OWNER'S group (a group of its own when the player has no card here).
   */
  stands?: ReadonlyArray<{stand: TableTargetStand, ownerName: string}>;
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
 *
 * ⚠️ ONE exception outranks that: a group carrying the SOURCE-CARD candidate
 * comes FIRST. The source card stands in the hero column on the left, and its
 * «ЭТА КАРТА» proxy must be the spatially NEAREST target — the two are one
 * physical pair, and any card standing between them reads as the pair being
 * broken (the proxy then points across a stranger). The promotion exists only
 * while a self-target exists, so the ordinary no-self prompt keeps the
 * opponents-first order untouched.
 */
export function buildPlayedTargetModel(input: BuildPlayedTargetInput): PlayedTargetModel {
  // `selfHarm` is deliberately absent here: it depends on whether an OPPONENT
  // group also exists, which is only known once every candidate is grouped. The
  // Omit says so in the type rather than seeding a placeholder that a later edit
  // could forget to overwrite.
  type Grouping = Omit<PlayedTargetOwner, 'selfHarm'> & {candidates: Array<PlayedTargetCandidate>};
  const byColor = new Map<string, Grouping>();
  const blockedOf = new Map((input.blocked ?? []).map((b) => [b.model.name, b]));
  for (const model of [...input.candidates, ...(input.blocked ?? []).map((b) => b.model)]) {
    const owner = input.players.find((p) => p.tableau.some((c) => c.name === model.name)) ??
      // THE CARD BEING PLAYED owns no tableau row YET, and for an on-play effect
      // that legally targets itself (Titan Floating Launch-pad puts its own two
      // floaters on any Jovian card — it IS a Jovian card) it is a real, often
      // the ONLY, candidate. Dropping it as «nobody's tableau claims this» left
      // the player with an empty picker for a choice the rules plainly allow.
      // It belongs to the viewer: they are the one playing it.
      (model.name === input.sourceCardName ?
        input.players.find((p) => p.color === input.viewerColor) :
        undefined);
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
    const shortfall = blockedOf.get(model.name);
    group.candidates.push({
      cardName: model.name as CardName,
      category: playedTargetCategoryOf(input.typeOf(model.name as CardName)),
      relation: model.name === input.sourceCardName ? 'source-card' : 'external-card',
      ownerId: owner.color,
      slotKey: model.name,
      // A near miss reads its refusal, never a preview of a move it cannot make.
      preview: shortfall === undefined ? input.preview(model.name as CardName) : [],
      resourceContext: input.resourceContext?.(model.name as CardName, model),
      model,
      ...(shortfall === undefined ? {} : {blocked: {reason: shortfall.reason, have: shortfall.have, need: shortfall.need}}),
    });
  }
  // PLAYERS AS TARGETS — each stand-in tile in its owner's group (a group of its own for a player with no card here:
  // the bot); an opponent like any other (it sorts with them). A refused stand is SHOWN, never chosen.
  for (const {stand, ownerName} of input.stands ?? []) {
    let group = byColor.get(stand.color);
    if (group === undefined) {
      const player = input.players.find((p) => p.color === stand.color);
      group = {
        id: stand.color, name: ownerName, color: stand.color, self: stand.color === input.viewerColor,
        totalPlayed: player?.tableau.length ?? 0, candidates: [],
      };
      byColor.set(stand.color, group);
    }
    group.candidates.push({
      cardName: stand.key,
      category: 'corporation',
      relation: 'external-card',
      ownerId: stand.color,
      slotKey: stand.key,
      preview: [],
      model: {name: stand.key, ...(stand.current !== undefined ? {resources: stand.current} : {})},
      stand,
      // A refused stand is a near miss: shown, never counted, never chosen — its reason is the stand's own (translated by the step).
      ...(stand.refused !== undefined ? {blocked: {reason: '', have: stand.current ?? 0, need: stand.amount}} : {}),
    });
  }
  const grouped = [...byColor.values()];
  const opponentsInvolved = grouped.some((g) => !g.self);
  const direction: PlayedTargetDirection =
    input.direction ?? (input.takesFromTarget === true ? 'remove' : 'add');
  const carriesSource = (g: {candidates: ReadonlyArray<PlayedTargetCandidate>}) =>
    g.candidates.some((c) => c.relation === 'source-card');
  const hasOpen = (g: {candidates: ReadonlyArray<PlayedTargetCandidate>}) => g.candidates.some((c) => c.blocked === undefined);
  const owners = grouped
    .map((g) => ({
      ...g,
      candidates: sortByCategory(g.candidates),
      selfHarm: g.self && direction === 'remove' && opponentsInvolved,
    }))
    .sort((a, b) => {
      // The source+«ЭТА КАРТА» pair wins the front (see the builder's doc).
      const pair = Number(carriesSource(b)) - Number(carriesSource(a));
      if (pair !== 0) {
        return pair;
      }
      // A group with NOTHING to choose (only shown near misses) stands after every group that has a target — the
      // cursor's first stop is a card it can take.
      const open = Number(hasOpen(b)) - Number(hasOpen(a));
      return open !== 0 ? open : Number(a.self) - Number(b.self);
    });
  const targetCount = owners.reduce((n, o) => n + o.candidates.filter((c) => c.blocked === undefined).length, 0);
  return {
    owners,
    contract: {
      ask: input.ask,
      direction,
      targetCount,
      ownerCount: owners.length,
      selfAllowed: owners.some((o) => o.self),
      opponentsInvolved: owners.some((o) => !o.self),
      ...(input.payload !== undefined && direction === 'add' ? {payload: input.payload} : {}),
    },
  };
}

function sortByCategory(candidates: ReadonlyArray<PlayedTargetCandidate>): Array<PlayedTargetCandidate> {
  return [...candidates].sort((a, b) => {
    // «ЭТА КАРТА» is pinned to the very FRONT of its owner's candidates: the
    // source card stands in the hero column to the LEFT, so the first cell of
    // the row is the spatially nearest target — the two must read as one pair,
    // and a stranger standing between them is the reported bug. The sort is
    // stable, so the OTHER candidates keep exactly the order they had.
    const self = Number(b.relation === 'source-card') - Number(a.relation === 'source-card');
    if (self !== 0) {
      return self;
    }
    // A player's stand-in tiles close the group (their section is the last one — `playedTargetSections`).
    const stand = Number(a.stand !== undefined) - Number(b.stand !== undefined);
    if (stand !== 0) {
      return stand;
    }
    const category = PLAYED_TARGET_CATEGORY_ORDER.indexOf(a.category) - PLAYED_TARGET_CATEGORY_ORDER.indexOf(b.category);
    // A shown near miss closes its category block — the takeable cards lead it.
    return category !== 0 ? category : Number(a.blocked !== undefined) - Number(b.blocked !== undefined);
  });
}

/** One rendered category block inside an owner group. */
export type PlayedTargetSection = {
  /** The render key: the category, or `'self'` for the source-card block. */
  key: string;
  category: PlayedTargetCategory;
  label: string;
  /** The leading block that holds ONLY the «ЭТА КАРТА» proxy — it is a
   *  navigation handle, not a member of a card-type family, so it draws no
   *  category rail and does not count toward the rails' earn rule. */
  self?: boolean;
  /** The owner's STAND-IN tiles (a player's units — no card family, no rail): the group's trailing block. */
  stand?: boolean;
  candidates: ReadonlyArray<PlayedTargetCandidate>;
};

/**
 * The owner's candidates split into category blocks — EMPTY CATEGORIES ARE
 * NEVER EMITTED. A zero-count rail would spend the surface's scarcest
 * dimension on describing what is not there, which is precisely the full-
 * tableau impression this step must not give.
 *
 * THE SOURCE-CARD PROXY IS HOISTED into its own LEADING block. Left inside its
 * real category it sorted wherever that category fell (an ACTIVE source stood
 * behind a CORPORATION target), and «first among the targets, nearest the
 * source» must hold whatever families the other candidates belong to. The
 * hoist moves ONLY the proxy — every other candidate keeps today's category
 * order, untouched.
 */
export function playedTargetSections(owner: PlayedTargetOwner): ReadonlyArray<PlayedTargetSection> {
  const out: Array<PlayedTargetSection> = [];
  const self = owner.candidates.find((c) => c.relation === 'source-card');
  if (self !== undefined) {
    out.push({key: 'self', category: self.category, label: '', self: true, candidates: [self]});
  }
  for (const category of PLAYED_TARGET_CATEGORY_ORDER) {
    const candidates = owner.candidates.filter((c) => c.category === category && c.relation !== 'source-card' && c.stand === undefined);
    if (candidates.length > 0) {
      out.push({key: category, category, label: playedTargetCategoryLabel(category), candidates});
    }
  }
  // The player's own units — the stand-in tiles — close the group, one rail-less block.
  const stands = owner.candidates.filter((c) => c.stand !== undefined);
  if (stands.length > 0) {
    out.push({key: 'stand', category: 'corporation', label: '', stand: true, candidates: stands});
  }
  return out;
}

/**
 * Does the category RAIL earn its line? With a single block the label repeats
 * what the contract line above already said and what the cards themselves
 * show — so it is suppressed and the vertical space goes to the cards.
 *
 * The self block never counts: it is a handle, not a category, and hoisting it
 * must not conjure rails over an otherwise single-family row.
 */
export function playedTargetShowsCategoryRails(sections: ReadonlyArray<PlayedTargetSection>): boolean {
  return sections.filter((s) => s.self !== true && s.stand !== true).length > 1;
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

/**
 * `split` — two narrow groups side by side; `tabs` — ONE group on screen, LB/RB between them (the handheld fallback
 * only); `board` — «ЦЕЛЬ НА СТОЛЕ — ОДНА ЗОНА» (the owner, 2026-10-28): EVERY group on screen at once, as BANDS one
 * under another, a grid of cards inside each; LB/RB jump between the bands.
 */
export type PlayedTargetLayoutMode = 'split' | 'tabs' | 'board';

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

  if (o.handheld || o.owners.length < 2) {
    return tabs;
  }
  // EVERY group on screen (the owner's «одна зона»): `split` stays the narrow two-group case, everything else bands.
  const board: PlayedTargetLayout = {mode: 'board', perRow: singleColumnPerRow};
  if (o.owners.length !== 2) {
    return board;
  }
  const busiest = Math.max(...o.owners.map((owner) => owner.candidates.length));
  if (busiest > SPLIT_MAX_CANDIDATES) {
    return board;
  }
  // Both columns must still hold their busiest owner's widest row at a
  // readable size — otherwise the split is bought with the cards' legibility.
  const columnW = (o.availW - SPLIT_GAP * o.ui) / 2 - OWNER_CHROME_W * o.ui;
  const perRow = Math.floor(columnW / cardW);
  if (perRow < 1 || perRow < Math.min(busiest, 2)) {
    return board;
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
/**
 * The SELF-TARGET PROXY's compact cap, in rem-equivalent px at ui 1.
 *
 * The proxy occupies a candidate CELL, so its width is `min(solved cell, this)`
 * — narrower than a cell never wraps the row, wider is the reflow bug. The cap
 * exists because a lone self-target solves a cell of `SOLO_CARD_ZOOM × 320`,
 * and a pill that wide reads as a stretched card rather than a handle.
 *
 * It lives HERE, beside the other layout constants, and is published to CSS as
 * `--con-ptsel-self-max`: a number the stylesheet owned alone would be a bound
 * the solver has never seen. Mirrored by `playedTargetLayoutContract.spec.ts`.
 */
export const PLAYED_TARGET_SELF_MAX_W = 300;

/**
 * THE PROXY'S OWN BOX — a TARGET SLOT, never its content.
 *
 * `W` is the layout's standard candidate column (94 % of the 320 px card face,
 * so it reads as one of the columns without pretending to be a card). `H` is a
 * fifth of a card: this is a REFERENCE to a card standing two columns away, and
 * a full-height empty panel would read as a second copy of it.
 *
 * ⚠️ The width is deliberately NOT the solved card width. That fit is
 * HEIGHT-bound — one short proxy in a short band solves a small card — so
 * binding to it shrank a lone proxy to a text-sized pill while the row had
 * hundreds of px of free space. It follows the solved cell only when a
 * PHYSICAL card is beside it and that cell is narrower: there the column IS
 * the shared grid, and matching it is what keeps the row on one line.
 */
export const PLAYED_TARGET_SELF_W = 300;
export const PLAYED_TARGET_SELF_H = 100;
/** Compact floor — below this the label, the name and the chip stop fitting. */
export const PLAYED_TARGET_SELF_H_MIN = 62;

/**
 * The proxy's box, in the layout's own px. Pure — the ONE derivation both the
 * stylesheet tokens and the guards read.
 */
export function playedTargetSelfBox(
  o: {cardWidthPx: number, hasCardCandidates: boolean, ui: number},
): {w: number, h: number} {
  const standard = PLAYED_TARGET_SELF_W * o.ui;
  const w = o.hasCardCandidates ? Math.min(o.cardWidthPx, standard) : standard;
  // The height rides the width so a compact row stays proportionate instead of
  // keeping a normal-height bar over half-width cards.
  const h = Math.max(PLAYED_TARGET_SELF_H_MIN * o.ui, PLAYED_TARGET_SELF_H * o.ui * (w / standard));
  return {w, h};
}

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
/**
 * How far the focused card's cue climbs above its cell, rem-equivalent px at
 * ui 1, BESIDES its scale: the lift (`translateY(-.22rem)`, 4.4) + the ring
 * (`.16rem`, 3.2). Both are DE-ZOOMED in the stylesheet — HUD lengths, never
 * card lengths. Riding the slot's zoom they were a card length scaled AGAIN by
 * the rem: at 4K the zoom already carries `--con-ui-scale`, so the solo card's
 * lift and ring came out 4× the 1080 ones and the ring stood on the owner's
 * name above it (PL-170, `screenshots/ichtiology-grant/tv4k-a-02-target`).
 */
const FOCUS_RISE_PX = 8;
/** `.con-ptsel__cards` padding-top in the stylesheet's own shorthand. */
const CARDS_PAD_TOP = 6;

/** Chrome the sizing has to live around, in rem-equivalent px at ui 1.
 *  These MIRROR the LESS block — a card gap of `.55rem` is 11 px at the 20 px
 *  rem base — so the fit that was solved is the fit that gets rendered. */
const CARD_GAP = 11;
const SECTION_GAP = 18;
const SECTION_RAIL_H = 20;
const OWNER_BAR_H = 28;
/** `.con-ptsel__zone` `padding: .2rem .1rem` — top + bottom. */
const ZONE_PAD_Y = 8;
/** `.con-ptsel__owner` `padding: .1rem .1rem .35rem` — top + bottom. */
const OWNER_PAD_Y = 9;
/** `.con-ptsel__owner` `gap: .4rem` — the owner bar to its sections. */
const OWNER_GAP = 8;
/** `.con-ptsel__cards` `padding: .3rem 0` — where the focus lift happens. */
const CARDS_PAD_Y = 12;

/**
 * EVERYTHING INSIDE THE CANDIDATE VIEWPORT THAT IS NOT A CARD, in rem-equivalent
 * px at ui 1 — the sum the cards must be sized around.
 *
 * It used to reserve only the owner bar and one padding (40 px) against a real
 * 65 px of chrome, so the solver believed in 25 px of room that does not exist.
 * With two candidates and `overflows: false` the viewport still had ~14 px of
 * travel and drew a scroll rail — a surface reporting «this does not fit» about
 * a fit it had itself mis-measured.
 *
 * Exported so `playedTargetLayoutContract.spec.ts` can pin every term against
 * the stylesheet: this is the seam where an innocent `padding` edit silently
 * re-introduces a scrollbar.
 */
/**
 * THE OUTCOME TAG'S ROW under every candidate (PL-219), rem-equivalent px at ui 1: `.con-ptsel__tag` is
 * `height: 1.2rem; margin-top: .3rem` (24 + 6). RESERVED per row by the solver before a card is sized — a tag
 * that took its height from the cards would shrink the row it explains.
 */
export const PLAYED_TARGET_TAG_ROW_H = 30;
/** The same row when a tag reads on two lines (`playedTargetTagStacked`): `height: 2.4rem; margin-top: .3rem` (48 + 6). */
export const PLAYED_TARGET_TAG_ROW_H2 = 54;

export const PLAYED_TARGET_VIEWPORT_CHROME_H =
  OWNER_BAR_H + ZONE_PAD_Y + OWNER_PAD_Y + OWNER_GAP + CARDS_PAD_Y;
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
  /**
   * The focus-safe room ABOVE the first row, px (`--con-ptsel-headroom`, the
   * cards row's padding-top). The gap made the sides safe and nothing made the
   * top safe: a constant `.3rem` stood between the owner bar and a card whose
   * focus growth is a fraction of its OWN height — so the bigger the card (a
   * solo candidate, a 4K band), the further its ring climbed into the name.
   */
  headroomPx: number;
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
  /** A candidate wears an outcome tag (PL-219) — every row reserves `PLAYED_TARGET_TAG_ROW_H` under its cards. */
  tags?: boolean;
  /** Some tag reads on two lines (`playedTargetTagStacked`) — the row reserved is `PLAYED_TARGET_TAG_ROW_H2`. */
  tagLines?: 1 | 2;
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
  tagRow = 0,
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
      const byHeight = ((ownerH - railH - (rows - 1) * gap - rows * tagRow) / rows) * ASPECT_W_OVER_H;
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
  // The same bound UPWARD: half the card height's growth plus the de-zoomed lift
  // and ring. The owner gap above it stays the breath between the ring and the
  // name's ink. Solved for the largest card ANY set can draw (the solo ceiling),
  // never for this set's: a headroom that grew with the solo ceiling took height
  // from exactly the one card the ceiling exists to enlarge — one candidate drew
  // SMALLER than two (`never draws FEWER candidates SMALLER`).
  const riseCardH = (o.handheld ? SOLO_CARD_ZOOM_HANDHELD : SOLO_CARD_ZOOM) * o.ui * SLOT_H;
  const headroom = Math.max(CARDS_PAD_TOP * o.ui, riseCardH * (PLAYED_TARGET_FOCUS_SCALE - 1) / 2 + FOCUS_RISE_PX * o.ui);

  const groups = o.owners.map((owner) => playedTargetSections(owner));
  if (groups.length === 0) {
    return {
      cardZoom: minCardW / SLOT_W, gapPx: gap, headroomPx: headroom, sectionFlow: 'rows',
      sectionColumns: 1, rows: 1, perRow: 1, overflows: false,
    };
  }
  const ownerCols = o.mode === 'split' ? Math.max(1, o.owners.length) : 1;
  const ownerW = (o.availW - (ownerCols - 1) * ownerGap) / ownerCols;
  // The chrome counts the stylesheet's `.3rem` top; the headroom beyond it is
  // room the cards do not get.
  const bandChrome = PLAYED_TARGET_VIEWPORT_CHROME_H * o.ui + (headroom - CARDS_PAD_TOP * o.ui);
  const railH = groups.some((secs) => playedTargetShowsCategoryRails(secs)) ? SECTION_RAIL_H * o.ui : 0;
  const tagRow = o.tags === true ? (o.tagLines === 2 ? PLAYED_TARGET_TAG_ROW_H2 : PLAYED_TARGET_TAG_ROW_H) * o.ui : 0;
  const solve = (g: ReadonlyArray<ReadonlyArray<PlayedTargetSection>>, w: number, h: number, secGap: number): PlayedTargetSizing =>
    solveSizing(g, solveGrid(g, w, h, gap, secGap, railH, tagRow), gap, headroom, minCardW, maxCardW);
  if (o.mode !== 'board') {
    return solve(groups, ownerW, o.availH - bandChrome, sectionGap);
  }
  // `board` — EVERY group on screen as BANDS one under another (the owner's decision B2, 2026-10-29: always bands —
  // a wide, short host reads the bands at a smaller card or scrolls honestly, never a row of groups): the height is
  // shared, each band carries its own bar and headroom.
  const n = Math.max(1, o.owners.length);
  return solve(groups, o.availW, (o.availH - n * bandChrome) / n, sectionGap);
}

/** The best readable shape of the solved candidates — or the floor and an honest scroll. */
function solveSizing(
  groups: ReadonlyArray<ReadonlyArray<PlayedTargetSection>>,
  shapes: ReadonlyArray<GridShape>,
  gap: number,
  headroom: number,
  minCardW: number,
  maxCardW: number,
): PlayedTargetSizing {
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
      headroomPx: headroom,
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
    headroomPx: headroom,
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
/**
 * THE NEAR MISSES A TAKING STEP SHOWS (TR52 — the prompt's rule 3): the server's `disabledCards` that HOLD the
 * resource but fewer than the step takes (`requireFullCount` — «2 data off ONE card»), each with the server's reason.
 * A holder with none, or a protected one, stays out exactly as before — those are every Predators / Ants step's
 * whole table, and listing them would bury the targets. Only a step that takes MORE than one unit has a near miss.
 */
export function playedTargetShortfalls(
  disabled: ReadonlyArray<CardModel> | undefined,
  amount: number | undefined,
  reasonOf: (card: CardModel) => string,
  /**
   * An ADDING step's FLOOR (`resourceGainPrompt.holdsAtLeast` — TR53 «a card that ALREADY has a resource»): every
   * holder the server lists below it is a near miss — shown, disabled, «✕ 0 / 1», never hidden.
   */
  holdsAtLeast?: number,
): Array<{model: CardModel, reason: string, have: number, need: number}> {
  if (amount !== undefined && amount > 0) {
    if (holdsAtLeast === undefined || holdsAtLeast <= 0) {
      return [];
    }
    return (disabled ?? [])
      .filter((c) => (c.resources ?? 0) < holdsAtLeast)
      .map((c) => ({model: c, reason: reasonOf(c), have: c.resources ?? 0, need: holdsAtLeast}));
  }
  const need = amount === undefined ? 0 : -amount;
  if (need <= 1) {
    return [];
  }
  return (disabled ?? [])
    .filter((c) => (c.resources ?? 0) > 0 && (c.resources ?? 0) < need)
    .map((c) => ({model: c, reason: reasonOf(c), have: c.resources ?? 0, need}));
}

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

/**
 * The card that RAISED the prompt, when it is also one of its own targets —
 * `''` otherwise.
 *
 * Both hosts need it for the same reason (the proxy that stands for it is not
 * an origin the fullscreen viewer may lift from), and neither may re-derive it
 * from a card name or a host-local flag: `relation` is what the model already
 * decided, so this is a read of that decision, not a second one.
 */
export function playedTargetSourceCardName(owners: ReadonlyArray<PlayedTargetOwner>): string {
  for (const owner of owners) {
    const self = owner.candidates.find((c) => c.relation === 'source-card');
    if (self !== undefined) {
      return self.cardName;
    }
  }
  return '';
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

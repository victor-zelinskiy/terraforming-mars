/*
 * @console-shared LIVE — console native stands on this file.
 *
 * WHAT A DECK CHECK SAYS — before the reveal (the composer) and after it (the
 * verdict), read from the SERVER's own descriptor / result. Pure: no DOM, no
 * reactive reads, no translation — the SFCs render keys, this decides which.
 *
 * Three deck checks share it (Search For Life, Asteroid Deflection System,
 * Turmoil Redux TR13 Political Think Tank) and the third is why it exists: it
 * is the first check that is not a TAG (a party requirement, drawn as its own
 * glyph), the first whose reward is a STOCK resource, and the first that KEEPS
 * the revealed card. Every one of those facts is structural in the model
 * (`check.icon`, the reward chip, `destination` / `keepsCard`) — nothing here
 * knows a card by name.
 *
 * ONE SYMBOL, ONE CONCEPT: the check's glyph is the same object on the card
 * face, in the composer's check row and in the verdict (`RevealCheckGlyph`).
 */
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {Message} from '@/common/logs/Message';
import {ActionEffect, ActionRevealDescriptor} from '@/common/models/ActionPreviewModel';
import {RevealCheckIcon, RevealDestination, RevealResultModel, revealDestination} from '@/common/models/RevealResultModel';
import {tagIconUrl} from '@/client/components/premiumCard/premiumCardIcons';
import {partyNameKey} from '@/client/console/parliament/partyNames';

/** How a check is drawn: the tag's icon, the party-requirement plate, or nothing. */
export type RevealCheckGlyph =
  | {kind: 'tag', url: string}
  | {kind: 'party-requirement'}
  | {kind: 'none'};

export function revealCheckGlyph(check: {tag?: Tag, icon?: RevealCheckIcon} | undefined): RevealCheckGlyph {
  if (check?.icon === 'party-requirement') {
    return {kind: 'party-requirement'};
  }
  if (check?.tag !== undefined) {
    return {kind: 'tag', url: tagIconUrl(check.tag)};
  }
  return {kind: 'none'};
}

/**
 * THE KEPT CARD as a gain chip — display only. It is deliberately never a
 * `cards` gain in the branch's effects (an outcome claim reads that chip as
 * «this action draws a batch»); the descriptor's `keepsCard` / the result's
 * `destination` are what say it, and this is how they are drawn.
 */
export function keptCardChip(note?: string): ActionEffect {
  return note === undefined ?
    {direction: 'gain', icon: 'cards', amount: 1} :
    {direction: 'gain', icon: 'cards', amount: 1, note};
}

// ── BEFORE the reveal: the composer's honest «до» ───────────────────────────

export type RevealPreviewReading = {
  check: {glyph: RevealCheckGlyph, label: string | Message},
  /**
   * What a MATCH gains, in reading order: the kept card first («в руку» — the
   * card is the object of the action), then the printed reward.
   */
  gains: ReadonlyArray<ActionEffect>,
  /**
   * The COMPOSITION behind the odds — open information (never the hidden
   * deck's count, never a probability). `empty` = the check cannot succeed in
   * this game at all; the action stays available (revealing and discarding the
   * top card is a legal move), the surface warns.
   */
  pool?: {count: number, empty: boolean, key: string},
};

/** The pool line's key, by the check it counts for (only a party requirement declares a pool today). */
const POOL_KEYS: Partial<Record<RevealCheckIcon, string>> = {
  'party-requirement': 'Cards with a party requirement in this game: ${0}',
};

/** The zero-pool warning — the check is unwinnable in this game, right now. */
export const REVEAL_POOL_EMPTY_WARNING = 'The check cannot succeed now: this game has no such cards';

export function revealPreviewReading(reveal: ActionRevealDescriptor): RevealPreviewReading {
  const gains: Array<ActionEffect> = [];
  if (reveal.keepsCard === true) {
    gains.push(keptCardChip('to hand'));
  }
  gains.push(reveal.reward);
  const key = reveal.check.icon !== undefined ? POOL_KEYS[reveal.check.icon] : undefined;
  return {
    check: {glyph: revealCheckGlyph(reveal.check), label: reveal.check.label},
    gains,
    pool: reveal.pool !== undefined && key !== undefined ?
      {count: reveal.pool.count, empty: reveal.pool.count <= 0, key} : undefined,
  };
}

// ── AFTER the reveal: the verdict ───────────────────────────────────────────

/** The fate row's value key, by destination. */
const FATE_KEYS: Record<RevealDestination, string> = {
  hand: 'to hand',
  discard: 'to the discard pile',
};

export type RevealVerdictReading = {
  met: boolean,
  /** What was checked, and what was FOUND — the party a requirement names, else found / not found. */
  check?: {
    glyph: RevealCheckGlyph,
    label: string,
    /** The found pill: a translation KEY (a party's name key, «found», «not found»). */
    found: {key: string, tone: 'yes' | 'no'},
  },
  /** The reward chips on a match (the kept card first) — empty on a miss («не получена»). */
  reward: ReadonlyArray<ActionEffect>,
  /** Where the revealed card WENT — the row the «OK» then makes physical. */
  fate: {card: CardName, destination: RevealDestination, key: string},
  /** VP the SOURCE card gained (never a «+0» row). */
  vpGain: number,
};

export function revealVerdictReading(reveal: RevealResultModel): RevealVerdictReading {
  const destination = revealDestination(reveal);
  const check = reveal.check;
  const reward: Array<ActionEffect> = [];
  if (reveal.conditionMet) {
    if (destination === 'hand') {
      // The fate row names the place; the chip only counts the card.
      reward.push(keptCardChip());
    }
    if (reveal.reward !== undefined) {
      reward.push(reveal.reward);
    }
  }
  const vp = reveal.vp;
  return {
    met: reveal.conditionMet,
    check: check === undefined ? undefined : {
      glyph: revealCheckGlyph(check),
      label: check.label,
      found: !reveal.conditionMet ?
        {key: 'not found', tone: 'no'} :
        check.party !== undefined ? {key: partyNameKey(check.party), tone: 'yes'} : {key: 'found', tone: 'yes'},
    },
    reward,
    fate: {card: reveal.revealed.name, destination, key: FATE_KEYS[destination]},
    vpGain: vp !== undefined ? Math.max(0, vp.to - vp.from) : 0,
  };
}

// ── the verdict's REWARD as a flight (TR13: a stock gain) ───────────────────

/** The standard resources a verdict's reward can pay into the rail's stock. */
const STOCK_ICONS: ReadonlySet<string> = new Set(['megacredits', 'steel', 'titanium', 'plants', 'energy', 'heat']);

/**
 * The verdict's reward as a RAIL TRANSFER — present only for a stock gain (TR13
 * «+5 M€»). A card-resource reward (Search For Life's science, «on this card»)
 * has its own beat on the source card and is never a rail chip.
 */
export function revealRewardStock(reveal: RevealResultModel): {resource: string, amount: number} | undefined {
  const r = reveal.reward;
  if (!reveal.conditionMet || r === undefined || r.direction !== 'gain' || r.note !== undefined ||
      !STOCK_ICONS.has(r.icon) || r.amount <= 0) {
    return undefined;
  }
  return {resource: r.icon, amount: r.amount};
}

/** One verdict's identity — the same key the shell's «acknowledged» marker uses. */
export function revealKey(reveal: Pick<RevealResultModel, 'action' | 'revealed'>): string {
  return `${reveal.action}|${reveal.revealed.name}`;
}

/**
 * THE KEPT CARD THE DOCK MUST WITHHOLD — the server puts a TR13 match straight
 * into `cardsInHand`, but until the player presses «OK» the card stands in the
 * verdict's slot: the dock must not show it (nor count it) before it lands.
 * The «OK» hands the hold over to the hand intake's in-flight ledger in the
 * same synchronous block, so there is no frame in which neither holds it.
 */
export function revealKeptCardHeld(reveal: RevealResultModel | undefined, acknowledgedKey: string): CardName | undefined {
  if (reveal === undefined || !reveal.conditionMet || revealDestination(reveal) !== 'hand') {
    return undefined;
  }
  return revealKey(reveal) === acknowledgedKey ? undefined : reveal.revealed.name;
}

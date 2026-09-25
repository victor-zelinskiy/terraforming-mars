/*
 * THE LEDGER OF OUTCOMES — the vote panel's row of chips (Turmoil Redux).
 *
 * The panel above it answers «what do I get if this is enacted» in ONE
 * number. This row answers the OTHER question the vote asks — «who does this
 * card favour» — with one chip per participating seat: a cube and that seat's
 * own estimate at its own influence. Without it a player reads their own «+2»
 * and votes for the law that hands the leader twelve (Plant Ban cuts a seat
 * with 12 plants by 7 while the seat with 3 reads «nothing to lose»; a
 * counted term pays a rival double at the same influence).
 *
 * IT IS NUMBERS, NEVER A SECOND READING (the panel's law: one panel, one
 * reading). No kicker, no captions, no «if you win» — the forecast is a
 * scenario and belongs to the full reading. The only word on the whole row is
 * «вы» on the viewer's own chip, which stands FIRST; every other seat follows
 * in the model's order (the table is never re-sorted by advantage — the order
 * of the delegates zone and of the results panel is the order here).
 *
 * NOTHING IS COMPUTED HERE. Every number is the very function the viewer's
 * own reading stands on, called with another seat's colour — `voteYieldsOf`,
 * `voteLevyOf`, `tileGrantReadingOf`, `noRecipientCompactNoteOf` — because the
 * server's model already carries every input of every formula for EVERY seat
 * (`ParliamentModel.players`, gated by the CATALOG, not by the table). Pure:
 * no Vue, no DOM, no i18n; `ConsoleVoteLedger.vue` renders it.
 */
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {InfluenceScaledEffect, InfluenceYield} from '@/common/parliament/influenceScaling';
import {noRecipientCompactNoteOf, oneNumberYieldsOf, voteLevyOf, voteYieldsOf, YieldIcon, yieldIconOf, yieldIsMultiplier} from './influenceYieldModel';
import {tileGrantReadingOf} from './tileGrantModel';

/**
 * WHAT a part of a chip says about its number:
 *   `gain`   — it arrives;
 *   `loss`   — it LEAVES (a cut that takes, a levy the payout does not cover);
 *   `lost`   — it is computed and would NOT land (no card of this seat can
 *              hold it) — «✕ 3», the row's own «nothing silently» (invariant 4);
 *   `quiet`  — a real zero (a seat at the limit of a cut, a formula that pays
 *              it nothing): printed, never hidden;
 *   `winner` — the part goes to the WINNER of the vote alone.
 */
export type LedgerTone = 'gain' | 'loss' | 'lost' | 'quiet' | 'winner';

/**
 * WHAT the number IS: a plain amount, a MULTIPLIER over the seat's colony
 * ledger («×2» — Colonial Affairs: what is paid is every tile's own printed
 * bonus, so the number is not a count of anything), or a TILE granted by
 * threshold (Skyscrapers), which is no number at all.
 */
export type LedgerPartKind = 'amount' | 'multiplier' | 'tile';

export type LedgerPart = {
  /** The effect's id — `levy` for a budget's take that nets against nothing, `tile` for a granted tile. */
  key: string;
  kind: LedgerPartKind;
  /** The MAGNITUDE (the tone says which way it goes); undefined for a tile — a tile is not a number. */
  amount?: number;
  /** The unit's icon, in the readings' own families; undefined for a tile (its glyph is the tile's own). */
  icon?: YieldIcon;
  tone: LedgerTone;
};

/** One seat's outcome of the selected card, as the row prints it. */
export type LedgerChipVm = {
  color: Color;
  /** The viewer's own chip — the row's first, and the only one that carries a word. */
  you: boolean;
  parts: ReadonlyArray<LedgerPart>;
};

/** The key of a levy part with no payout of its own currency to net against («−10 M€» alone). */
export const LEDGER_LEVY_KEY = 'levy';
/** …and of a tile granted by threshold. */
export const LEDGER_TILE_KEY = 'tile';

export type VoteLedgerInput = {
  resolution: IClientResolution | undefined;
  model: ParliamentModel | undefined;
  /** The viewer's colour (undefined / unseated: no «вы» chip — the row is still honest about the table). */
  viewer: Color | undefined;
  /**
   * Every seat's PUBLIC tableau, by colour — the holder law («no card can hold
   * animals») is read per seat, exactly as it is for the viewer. A colour the
   * caller does not carry reads as an empty tableau: the row then says the
   * payout would not land, which is the honest reading of «we do not know of a
   * holder», never a promise that it would.
   */
  players: ReadonlyArray<{color: Color, tableau: ReadonlyArray<{name: CardName}>}>;
};

/** The tone of an ordinary part — the first true thing about it, in the order the player cares. */
function toneOf(effect: InfluenceScaledEffect, amount: number, nowhereToLand: boolean): LedgerTone {
  // It would be computed and forfeited — the loudest truth about the number (invariant 4).
  if (nowhereToLand && amount > 0) {
    return 'lost';
  }
  // A LEVEL term that goes DOWN takes (Plant Ban): the magnitude leaves this seat.
  if (effect.level?.direction === 'down' && amount > 0) {
    return 'loss';
  }
  // A real zero is printed quietly — never «+0» in the tone of a gain, never hidden.
  if (amount === 0) {
    return 'quiet';
  }
  return effect.recipient === 'winner' ? 'winner' : 'gain';
}

function partsOf(
  resolution: IClientResolution,
  model: ParliamentModel,
  color: Color,
  tableau: ReadonlyArray<{name: CardName}>,
): Array<LedgerPart> {
  const parts: Array<LedgerPart> = [];
  const yields: ReadonlyArray<InfluenceYield> = oneNumberYieldsOf(voteYieldsOf(resolution, model, color)).filter((y) => y.context !== 'reference');
  // THE LEVY (a budget takes «10 M€» first): the chip prints the seat's NET in that currency — the
  // panel's own law «−10 → +7 = −3», one number instead of two the player has to add up.
  const levy = voteLevyOf(resolution, model, color);
  let levyNetted = false;
  for (const y of yields) {
    const effect = y.effect;
    const icon = yieldIconOf(effect);
    const nowhereToLand = noRecipientCompactNoteOf(effect, tableau) !== undefined;
    if (levy !== undefined && levy.net !== undefined && levy.payout?.effectId === effect.id) {
      levyNetted = true;
      parts.push({
        key: effect.id, kind: 'amount', amount: Math.abs(levy.net), icon,
        tone: levy.net < 0 ? 'loss' : levy.net === 0 ? 'quiet' : 'gain',
      });
      continue;
    }
    const amount = y.amount ?? 0;
    parts.push({
      key: effect.id,
      kind: yieldIsMultiplier(effect) ? 'multiplier' : 'amount',
      amount, icon,
      tone: toneOf(effect, amount, nowhereToLand),
    });
  }
  // A levy with nothing of its own currency to net against stands FIRST and alone — the printed order.
  if (levy !== undefined && !levyNetted) {
    parts.unshift({key: LEDGER_LEVY_KEY, kind: 'amount', amount: levy.paid, icon: {family: 'resource', resource: levy.resource, production: false}, tone: 'loss'});
  }
  // A TILE GRANTED BY THRESHOLD (Skyscrapers) — the seats that pass on INFLUENCE alone get it whoever
  // wins, and that is what the row compares. The winner's own claim is a scenario, not a standing.
  const grant = tileGrantReadingOf(resolution, model, color);
  if (grant !== undefined && grant.context !== 'reference' && grant.eligibility === 'influence') {
    // …and a seat that qualifies with no city to build on is told so (`✕`), never given a silent tile.
    parts.push({key: LEDGER_TILE_KEY, kind: 'tile', tone: grant.cities === 0 ? 'lost' : 'gain'});
  }
  return parts;
}

/**
 * THE ROW for the selected card: one chip per PARTICIPATING seat, the viewer
 * first. MarsBot (`participates === false`) never appears — not even as a zero:
 * it takes no part in the parliament, and a zero would say it lost a contest
 * it was never in. A card that pays NOBODY anything (a passive, an action)
 * yields no row at all: there is nothing to compare, and an row of empty cubes
 * would be furniture.
 */
export function voteLedgerOf(input: VoteLedgerInput): ReadonlyArray<LedgerChipVm> {
  const {resolution, model, viewer} = input;
  if (resolution === undefined || model === undefined) {
    return [];
  }
  const seats = model.players.filter((p) => p.participates);
  const mine = viewer === undefined ? undefined : seats.find((p) => p.color === viewer);
  const ordered = [...(mine === undefined ? [] : [mine]), ...seats.filter((p) => p !== mine)];
  const chips = ordered.map((seat) => ({
    color: seat.color,
    you: seat === mine,
    parts: partsOf(resolution, model, seat.color, input.players.find((p) => p.color === seat.color)?.tableau ?? []),
  }));
  return chips.some((chip) => chip.parts.length > 0) ? chips : [];
}

/**
 * THE CHIP'S NUMBER as the player reads it — the one place the sign is
 * decided, so the row and its guard can never disagree: «+12», «−7» for what
 * leaves, «✕ 3» for what is computed and forfeited, «×2» for a multiplier,
 * a bare «0» for a real zero. A tile has no number (just the mark, when it
 * has nowhere to land).
 */
export function ledgerPartText(part: LedgerPart): string {
  if (part.kind === 'tile') {
    // A tile is drawn, not counted — unless it would not land, and THAT is said with the same mark.
    return part.tone === 'lost' ? '✕' : '';
  }
  if (part.amount === undefined) {
    return '';
  }
  const amount = part.amount;
  if (part.tone === 'lost') {
    return '✕ ' + amount;
  }
  if (part.kind === 'multiplier') {
    return '×' + amount;
  }
  if (amount === 0) {
    return '0';
  }
  return (part.tone === 'loss' ? '−' : '+') + amount;
}

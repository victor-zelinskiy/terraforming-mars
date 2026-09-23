/*
 * THE READING BLOCKS of a parliament subject in the fullscreen inspector
 * (Turmoil Redux), in the `CardAnnotation` shape the card rules panel renders.
 *
 * THE INSPECTOR'S LANGUAGE is the project card's: the GRAPHIC is on the card,
 * the blocks beside it explain that graphic in words — a block never draws
 * the formula again. A resolution reads as one scene:
 *   · the RIGHT column is the resolution's own rules (`resolutionAnnotations`)
 *     — its own effect, part by part, labelled by WHEN it applies (the way a
 *     project card's «При розыгрыше» / «Эффект» / «Действие» are), then the
 *     chairman quest's CONDITION;
 *   · the LEFT column is its party (`resolutionPartyAnnotations`) — the one
 *     exception to «no graphics»: the party plaque draws the party's formula,
 *     which the resolution card does not print; these blocks say the
 *     sentences under it;
 *   · the FOOTER states where the card stands, the viewer's access and the
 *     vote verb (`resolutionInspectModel.ts`) — nothing here repeats it.
 *
 * RULES ARE NOT STATE. A block is the printed mechanic — what happens, what
 * the player chooses, how much, under which conditions. «Available», «used
 * this generation» belong to the place made for state (the plaque's action
 * badge, the party inspector's «for you» block), and the ordinary limit of an
 * action («once per generation») is the action language itself, never a line.
 *
 * A PARTY opened on its own (`partyAnnotations`) keeps its fuller reading:
 * the same mechanic blocks, then «for you» (the live bases AND the action's
 * live state) and the one reference line.
 *
 * Everything the panel prints is an English i18n key; a name that reaches a
 * row as a PARAM is a display string and is translated HERE.
 */
import {CardAnnotation, CardAnnotationKind} from '@/client/components/cardAnnotations/annotationModel';
import {ReduxParty, ResolutionId} from '@/common/parliament/ParliamentTypes';
import {IClientPartyEffect} from '@/common/parliament/IClientResolution';
import {getPartyEffect, getResolution} from '@/client/parliament/ClientParliamentManifest';
import {Color} from '@/common/Color';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {accessReasonRows} from './consoleParliamentModel';
import {InfluenceYield} from '@/common/parliament/influenceScaling';
import {ParliamentEnactOutcomeModel, ParliamentModel} from '@/common/models/ParliamentModel';
import {WorldMoveTable, worldMoveReadingOf, worldMoveSentenceOf} from './worldMoveModel';
import {countedCellNames, countedContributions, yieldCountPresentation} from './influenceYieldModel';
import {WinnerRewardReading, winnerRewardRuleKey, winnerRewardSentenceOf} from './winnerRewardModel';

export type RowText = {text: string, params?: ReadonlyArray<string>};

/** The rule a «colony bonuses» effect stands on — the one sentence the inspector prints under it (an English key). */
export const COLONY_BONUS_RULE_KEY = 'A colony bonus is the tile\'s printed bonus a cube\'s owner receives when somebody else trades there — never the trade income and never the building bonus. Pluto\'s draw-then-discard is paid one pair at a time.';

/**
 * A block's place in the panel: the SUBJECT's own rules first, then what
 * surrounds it — a reading order, never the card panel's kind order.
 */
function block(id: string, kind: CardAnnotationKind, labelKey: string, rows: ReadonlyArray<string | RowText>, order: number): CardAnnotation {
  return {
    id,
    kind,
    labelKey,
    rows: rows.map((row, i) => {
      const text = typeof row === 'string' ? row : row.text;
      const params = typeof row === 'string' ? undefined : row.params;
      return {id: `${id}:${i}`, text, params: params === undefined ? undefined : [...params], special: false, anyPlayer: false};
    }),
    special: false,
    anyPlayer: false,
    order,
  };
}

/** The labels a mechanic block wears — plain beside the party plaque, qualified in the party's own inspector. */
type MechanicLabels = {effect: string, action: string};

/* ONE name per mechanic wherever it is read (docs/claude/parliament-glossary.md §3): the resolution's
   party column once said «ДЕЙСТВИЕ» / «ЭФФЕКТ» where the party's own inspector said «ДЕЙСТВИЕ ПАРТИИ» /
   «ЭФФЕКТ ПАРТИИ». */
const ASIDE_LABELS: MechanicLabels = {effect: 'Party effect', action: 'Party action'};
const PARTY_INSPECTOR_LABELS: MechanicLabels = {effect: 'Party effect', action: 'Party action'};

/**
 * The party's MECHANICS as reading blocks — the standing effect, then the
 * action, each ONE printed sentence. One derivation for the party's own
 * inspector and for the party column beside a resolution, so the two can
 * never word the same mechanic differently.
 */
function partyMechanicBlocks(effect: IClientPartyEffect, labels: MechanicLabels): Array<CardAnnotation> {
  const out: Array<CardAnnotation> = [];
  if (effect.text.passive !== undefined) {
    out.push(block('group:effect', 'effect', labels.effect, [effect.text.passive], 0));
  }
  if (effect.text.action !== undefined) {
    out.push(block('group:action', 'action', labels.action, [effect.text.action], 1));
  }
  if (effect.text.passive === undefined && effect.text.action === undefined) {
    out.push(block('group:effect', 'effect', labels.effect, [effect.text.rule], 0));
  }
  return out;
}

/**
 * The action's LIVE state for the viewer — a STATE row for the party
 * inspector's «for you» block. Three facts told apart, as the rules tell them
 * apart: used this generation (the access and the passive effect stand), a
 * real reason the server names, available (and whether right now — the
 * viewer's own action window is an execution gate, never a reason). Nothing
 * without access: «for you» already says the effect is not held.
 */
function partyActionStateRow(party: ReduxParty, model: ParliamentModel, viewer: Color, canActNow: boolean | undefined): string | RowText | undefined {
  const me = model.players.find((p) => p.color === viewer);
  const action = model.viewer?.partyActions.find((a) => a.party === party);
  if (action === undefined || !action.hasAccess) {
    return undefined;
  }
  if ((me?.partyActionUses[party] ?? 0) > 0) {
    return 'Action used this generation';
  }
  if (!action.available && action.reason !== '') {
    return {text: 'Action unavailable: ${0}', params: [typeof action.reason === 'string' ? translateText(action.reason) : action.reason.message]};
  }
  return canActNow === false ? 'Action available on your turn' : 'Action available this generation';
}

/**
 * THE RESOLUTION'S OWN READING — the right column. Its own effect leads, part
 * by part, each labelled by WHEN it applies (the text never repeats the
 * label); then the chairman quest's condition. The quest reward is the same
 * for every resolution and lives in the government block; the card's
 * standing and the viewer's access live in the footer — neither is here.
 */
export function resolutionAnnotations(
  id: ResolutionId,
  yields?: ReadonlyArray<InfluenceYield>,
  /** The viewer's reading of the resolution's WINNER tile, when there is a table to read it over. */
  winner?: {reading: WinnerRewardReading | undefined, viewer: Color | undefined, nameOf: (color: Color) => string},
  /** The table the WORLD's part is read against (and, once it happened, the server's own records). */
  world?: {table: WorldMoveTable | undefined, enacted?: boolean, outcomes?: ReadonlyArray<ParliamentEnactOutcomeModel>},
): ReadonlyArray<CardAnnotation> {
  const resolution = getResolution(id);
  if (resolution === undefined) {
    return [];
  }
  const out: Array<CardAnnotation> = [];
  const text = resolution.text;
  if (text.effect !== undefined) {
    // A COUNTED term's qualification is the detailed reading of the face's
    // card glyph (which cards count, and which do not) — one sentence
    // under the effect, never a rules primer.
    const rows: Array<string | RowText> = [text.effect];
    for (const effect of resolution.scaled ?? []) {
      if (effect.count !== undefined) {
        rows.push(yieldCountPresentation(effect.count.id).ruleKey);
      }
      // THE COLONY LEDGER's qualification — what a colony bonus IS (the detailed reading of «all your colony
      // bonuses»), one sentence under the effect; the ledger itself reads in the footer.
      if (effect.unit.kind === 'colonyBonuses') {
        rows.push(COLONY_BONUS_RULE_KEY);
      }
    }
    out.push(block('group:immediate', 'immediate', 'When enacted', rows, 0));
  }
  // THE WORLD'S PART — its own block, between everyone's effect and the
  // winner's: what the law does to the PLANET belongs to no seat, so it can
  // neither be a clause of «when enacted» nor a line of «for you». Its rows
  // carry the live reading when there is a table to read against (Gas Export:
  // «Кислород: 5 % → 4 %», «Венера: 10 % → 14 %, РТ никому»).
  if (text.world !== undefined) {
    const rows: Array<string | RowText> = [text.world];
    const moves = worldMoveReadingOf(resolution, world?.table, {enacted: world?.enacted === true, outcomes: world?.outcomes});
    // WHO IS CREDITED is said ONCE — the law's own sentence above these rows
    // already says it. A row carries it only when the moves DISAGREE (a future
    // card that terraforms for its winner and vents for nobody).
    const credit = new Set(moves.map((m) => m.unrewarded)).size > 1;
    for (const reading of moves) {
      if (reading.context === 'reference') {
        continue;
      }
      const sentence = worldMoveSentenceOf(reading, {text: translateText, params: translateTextWithParams}, {credit});
      rows.push({text: '${0}: ${1}', params: [sentence.caption, sentence.detail]});
    }
    out.push(block('group:world', 'immediate', 'What it does to the planet', rows, 0.5));
  }
  if (text.winner !== undefined) {
    // A winner TILE's qualification — the detailed reading of the face's
    // symbol (the Redux greenery's TR rule) — one sentence under it.
    const rows: Array<string | RowText> = [text.winner];
    const rule = resolution.winnerReward === undefined ? undefined : winnerRewardRuleKey(resolution.winnerReward);
    if (rule !== undefined) {
      rows.push(rule);
    }
    out.push(block('group:winner', 'immediate', 'For the winner of the vote', rows, 1));
  }
  if (text.passive !== undefined) {
    out.push(block('group:effect', 'effect', 'Resolution effect', [text.passive], 2));
  }
  if (text.action !== undefined) {
    out.push(block('group:action', 'action', 'Resolution action', [text.action], 3));
  }
  // FOR YOU — WHERE THE VIEWER'S NUMBER COMES FROM: the counted cards behind
  // their reading (the footer shows «2 + 2 → +4»; this names the 2). The
  // cards of the enactment once it is recorded (frozen), today's cards while
  // the card is up for the vote — each labelled by which one it is.
  const forYou: Array<RowText> = [];
  const counted = (yields ?? []).find((y) => (y.counted !== undefined || y.countedSpaces !== undefined) && (y.context === 'estimate' || y.context === 'applied'));
  if (counted?.countedSpaces !== undefined) {
    // A BOARD count (space cities): the CELLS, by the names the board's own
    // information layer gives the reserved areas. A cell that layer does not
    // name is never christened here — the row prints the NUMBER instead and
    // the rule sentence above says what was counted.
    const applied = counted.context === 'applied';
    const cells = countedCellNames(counted, (key) => translateText(key));
    const named = cells.filter((cell): cell is string => cell !== undefined);
    if (cells.length > 0 && named.length === cells.length) {
      forYou.push({text: applied ? 'Counted at the enactment: ${0}' : 'Counted right now: ${0}', params: [named.join(' · ')]});
    } else if (cells.length > 0 && counted.effect.count !== undefined) {
      const plural = translateTextWithParams(yieldCountPresentation(counted.effect.count.id).pluralKey, [String(cells.length)]);
      forYou.push({text: applied ? 'Counted at the enactment: ${0}' : 'Counted right now: ${0}', params: [plural]});
    } else if ((counted.count ?? 0) === 0) {
      forYou.push({text: applied ? 'No tile was counted at the enactment' : 'No tile counts right now'});
    }
  } else if (counted?.counted !== undefined) {
    // Each card with what IT contributed («Fusion Power ×2») — a TAG count can
    // owe several units to one card, and a list of bare names would leave the
    // number unexplained. A card count is worth 1 apiece and reads as a list.
    const names = countedContributions(counted, (name) => translateText(name));
    const applied = counted.context === 'applied';
    if (names.length > 0) {
      forYou.push({text: applied ? 'Counted at the enactment: ${0}' : 'Counted right now: ${0}', params: [names.join(' · ')]});
    } else if ((counted.count ?? 0) === 0) {
      // Nothing counted — said plainly. A count standing on something that is
      // not a card at all (a permanent modifier) is never called «no card».
      forYou.push({text: applied ? 'No card was counted at the enactment' : 'No card counts right now'});
    }
  }
  // …AND WHAT THE WINNER'S TILE DOES for the viewer at this moment, in words —
  // the footer's chip read out (where the footer has no room for the chip, this
  // row IS the reading): «if you win: oxygen 5 → 6 %; TR +2 (tile +1, oxygen +1)».
  const reading = winner?.reading;
  if (winner !== undefined && reading !== undefined && reading.context !== 'reference') {
    const sentence = winnerRewardSentenceOf(reading, winner.viewer, winner.nameOf,
      {text: translateText, params: translateTextWithParams});
    if (sentence !== undefined) {
      forYou.push(sentence.detail === '' ?
        {text: '${0}', params: [sentence.caption]} :
        {text: '${0}: ${1}', params: [sentence.caption, sentence.detail]});
    }
  }
  if (forYou.length > 0) {
    out.push(block('group:you', 'note', 'For you', forYou, 3.5));
  }
  // THE CHAIRMAN QUEST — the printed condition, in words (the card draws it).
  out.push(block('group:quest', 'note', 'Chairman quest', [text.quest], 4));
  return out;
}

/**
 * THE PARTY COLUMN beside a resolution: the party's mechanics as sentences
 * (the plaque above draws the graphic). No state, no «for you», no reference
 * — the plaque's badge, the footer and the party's own inspector carry those.
 *
 * The viewer's VOTE is never a block here (registry R-10): the columns are
 * rules, and a vote's state — the leader, the winning state, the party
 * effect's edge — is the footer's, in the vote panel's own fact rows
 * (`ConsoleZoomVoteFacts`, `ConsoleResolutionStatus`), never prose.
 */
export function resolutionPartyAnnotations(party: ReduxParty): ReadonlyArray<CardAnnotation> {
  const effect = getPartyEffect(party);
  return effect === undefined ? [] : partyMechanicBlocks(effect, ASIDE_LABELS);
}

export function partyAnnotations(party: ReduxParty, model: ParliamentModel | undefined, viewer: Color | undefined, canActNow?: boolean): ReadonlyArray<CardAnnotation> {
  const effect = getPartyEffect(party);
  if (effect === undefined) {
    return [];
  }
  // 1–2. THE EFFECT and THE ACTION — the shared mechanic blocks.
  const out: Array<CardAnnotation> = partyMechanicBlocks(effect, PARTY_INSPECTOR_LABELS);
  // 3. FOR YOU — the viewer's STATE: the live bases of the effect (held / not
  //    held) and the action's live state, never the rule restated.
  if (model !== undefined && viewer !== undefined) {
    const me = model.players.find((p) => p.color === viewer);
    const access = me?.access.find((a) => a.party === party);
    if (access !== undefined) {
      const enactedName = model.enacted === undefined ? undefined : translateText(getResolution(model.enacted.resolution)?.text.name ?? model.enacted.resolution);
      const rows: Array<string | RowText> = accessReasonRows(access, {
        party,
        enactedEmpty: model.enacted === undefined,
        enactedName,
        inArea: model.slots.some((slot) => slot.party === party),
      })
        // The card-requirement note earns its line only where it SURPRISES —
        // a granted effect that does not count. «Met» is the ordinary case of
        // holding the effect, and the panel must fit the Deck's viewer.
        .filter((row) => row.key !== 'Card requirement of this party: met')
        .map((row): RowText => ({text: row.key, params: row.params}));
      const actionState = partyActionStateRow(party, model, viewer, canActNow);
      if (actionState !== undefined) {
        rows.push(actionState);
      }
      out.push(block('group:you', 'note', 'For you', rows, 2));
    }
  }
  // 4. THE REFERENCE — how a party effect is held: the whole rule, once.
  out.push(block('group:access', 'note', 'Access', [
    'The ruling party\'s effect belongs to every player; a party with two of your delegates on its resolution gives its effect to you as well',
  ], 3));
  return out;
}

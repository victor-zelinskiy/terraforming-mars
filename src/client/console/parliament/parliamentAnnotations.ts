/*
 * THE READING BLOCKS of a parliament subject in the fullscreen inspector
 * (Turmoil Redux), in the `CardAnnotation` shape the card rules panel renders.
 *
 * THE INSPECTOR'S LANGUAGE is the project card's: the GRAPHIC is on the card,
 * the blocks beside it explain that graphic in words — a block never draws
 * the formula again, and (the owner's direction 2026-10-23) it never explains
 * an edge case either: a resolution's dossier is its PRINTED TEXTS in the
 * project card's dose, so a player who opens the card sees its idea at once.
 * A resolution reads as one scene:
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
 * the player chooses, how much, under which conditions. The viewer's own
 * number, the cards it was counted from, the winner's tile for them and the
 * levy from their supply are the VOTE PANEL's («ДЛЯ ВАС ПРИ ПРИНЯТИИ») and the
 * sitting's — a resolution's dossier carries no «for you» block at all.
 * «Available», «used this generation» belong to the place made for state
 * (the plaque's action badge, the party inspector's «for you» block), and the
 * ordinary limit of an action («once per generation») is the action language
 * itself, never a line.
 *
 * A PARTY opened on its own (`partyAnnotations`) keeps its fuller reading:
 * the same mechanic blocks, then «for you» (the live bases AND the action's
 * live state) and the one reference line.
 *
 * Everything the panel prints is an English i18n key; a name that reaches a
 * row as a PARAM is a display string and is translated HERE.
 */
import {actionUsesRule} from './actionUsesReading';
import {CardAnnotation, CardAnnotationKind} from '@/client/components/cardAnnotations/annotationModel';
import {ReduxParty, ResolutionId} from '@/common/parliament/ParliamentTypes';
import {IClientPartyEffect} from '@/common/parliament/IClientResolution';
import {getPartyEffect, getResolution} from '@/client/parliament/ClientParliamentManifest';
import {Color} from '@/common/Color';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {accessReasonRows} from './consoleParliamentModel';
import {ParliamentEnactOutcomeModel, ParliamentModel} from '@/common/models/ParliamentModel';
import {WorldMoveTable, worldMoveReadingOf, worldMoveSentenceOf} from './worldMoveModel';
import type {EffectForecast, EffectForecastFact} from '@/common/models/EffectForecastModel';
import {tileRemovalReadingOf, tileRemovalSentenceOf} from './tileRemovalModel';
import {colonyTrackReadingOf, colonyTrackTileSentenceOf} from './colonyTrackModel';
import {ColonyModel} from '@/common/models/ColonyModel';
import {SUPPORT_KICKER, SupportReadingVm} from './voteInfoModel';

export type RowText = {text: string, params?: ReadonlyArray<string>};

/** The short names of the pools a world move's answer can touch (existing i18n keys). */
const ANSWER_LABEL_KEY: Record<string, string> = {
  megacredits: 'M€', steel: 'Steel', titanium: 'Titanium', plants: 'Plants', energy: 'Energy', heat: 'Heat', cards: 'Cards', tr: 'TR',
};

/**
 * The world move's ANSWER as inspector rows (PL-052): one row per fact —
 * the reacting source (a card name key, resolved by the catalog), its owner
 * by name when the seats are known, and the bare deltas; an unknown reactor
 * carries its reason instead of a number.
 */
export function worldForecastRows(forecast: EffectForecast | undefined, nameOf?: (color: Color) => string): Array<RowText> {
  const rows: Array<RowText> = [];
  const label = (fact: EffectForecastFact): string => {
    const owner = nameOf === undefined ? '' : ` (${nameOf(fact.source.owner)})`;
    return `${translateText(fact.source.name)}${owner}`;
  };
  for (const fact of forecast?.facts ?? []) {
    if (fact.certainty === 'unknown') {
      const reason = typeof fact.reason === 'string' ? translateText(fact.reason) : '';
      rows.push({text: '${0}: ${1}', params: [translateText('Will trigger'), `${label(fact)} — ${reason}`]});
      continue;
    }
    if ((fact.certainty !== 'exact' && fact.certainty !== 'deferred') || fact.effects.length === 0) {
      continue;
    }
    const deltas = fact.effects.map((e) => `${e.direction === 'cost' ? '−' : '+'}${e.amount} ${translateText(ANSWER_LABEL_KEY[e.icon] ?? e.icon)}`).join(' · ');
    rows.push({text: '${0}: ${1}', params: [translateText('Will trigger'), `${label(fact)} ${deltas}`]});
  }
  return rows;
}

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
 * THE RESOLUTION'S OWN READING — the right column, in the PROJECT CARD's
 * dose (the owner's direction 2026-10-23): the printed texts alone, part by
 * part, each labelled by WHEN it applies, then the chairman quest's
 * condition. Nothing is added under a text — no sentence on which cards
 * count, what a stack scores or when the hand is read: a player who opens
 * the card must see its idea at once, and the one nuance worth a sentence is
 * written INTO `text.*` by the card itself. No «for you» block either: the
 * viewer's number, the counted cards and the winner's tile are the VOTE
 * PANEL's and the sitting's, never the dossier's. The quest reward is the
 * same for every resolution and lives in the government block; the card's
 * standing and the viewer's access live in the footer — neither is here.
 */
export function resolutionAnnotations(
  id: ResolutionId,
  /**
   * The table the WORLD's part is read against (and, once it happened, the server's own records) — the
   * planet's globals, and the COLONY TABLE for a law that advances its tracks (Unity Budget). The world's
   * rows are NUMBERS («Кислород: 5 % → 4 %»), never prose: the one live reading the dossier keeps, because
   * the planet is nobody's and no panel of the viewer's carries it.
   */
  world?: {
    table: WorldMoveTable | undefined, enacted?: boolean, outcomes?: ReadonlyArray<ParliamentEnactOutcomeModel>, colonies?: ReadonlyArray<ColonyModel>,
    /** The BOARD for a law that takes a tile off it (Water Export): the ocean count and how many are plain — `tileRemovalTableOf`. */
    removal?: {oceans: number, removableOceans?: number},
    /** …and the seats' names, so the record can say who chose the cell. */
    nameOf?: (color: Color) => string,
    /** WHAT THE TABLE ANSWERS to the world move, for the viewer (`ParliamentSlotModel.worldForecast`, PL-052). */
    forecast?: EffectForecast,
  },
): ReadonlyArray<CardAnnotation> {
  const resolution = getResolution(id);
  if (resolution === undefined) {
    return [];
  }
  const out: Array<CardAnnotation> = [];
  const text = resolution.text;
  if (text.effect !== undefined) {
    out.push(block('group:immediate', 'immediate', 'When enacted', [text.effect], 0));
  }
  // THE WORLD'S PART — its own block, between everyone's effect and the
  // winner's: what the law does to the PLANET belongs to no seat, so it can
  // neither be a clause of «when enacted» nor a line of «for you». Its rows
  // carry the live reading when there is a table to read against (Gas Export:
  // «Кислород: 5 % → 4 %», «Венера: 10 % → 14 %, РТ никому»).
  if (text.world !== undefined) {
    const rows: Array<string | RowText> = [text.world];
    // THE COLONY TABLE's part (Unity Budget): the same block, headed by what it moves — every tile with its
    // marker «3 → 5», a tile at the end of its track NAMED («трек на максимуме»); the declaration alone
    // where there is no table to read against.
    const tracks = colonyTrackReadingOf(resolution, world?.colonies, {enacted: world?.enacted === true, outcomes: world?.outcomes});
    if (tracks !== undefined) {
      if (tracks.skipped !== undefined) {
        rows.push(tracks.skipped);
      }
      for (const tile of tracks.tiles) {
        const sentence = colonyTrackTileSentenceOf(tile, {text: translateText, params: translateTextWithParams});
        rows.push({text: '${0}: ${1}', params: [sentence.caption, sentence.detail]});
      }
    }
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
    // A TILE TAKEN OFF THE BOARD (Water Export): the same block, the ocean count as it stands («Океаны: 3 → 2»),
    // the named edge («на максимуме», «нет океана»), or the record — the cell it left and who chose; the
    // declaration alone where there is no board to read against.
    const removal = tileRemovalReadingOf(resolution, world?.removal, {enacted: world?.enacted === true, outcomes: world?.outcomes});
    if (removal !== undefined && removal.context !== 'reference') {
      const sentence = tileRemovalSentenceOf(removal, {text: translateText, params: translateTextWithParams}, world?.nameOf);
      rows.push({text: '${0}: ${1}', params: [sentence.caption, sentence.detail]});
    }
    // WHAT THE TABLE ANSWERS to the move (PL-052): «Сработает: Aphrodite (player2) +4 M€» — the server's own
    // facts for the viewer; a reactor the engine cannot describe is named with its reason, never dropped.
    rows.push(...worldForecastRows(world?.forecast, world?.nameOf));
    const heading = moves.length === 0 && tracks !== undefined ? 'What it does to the colony table' : 'What it does to the planet';
    out.push(block('group:world', 'immediate', heading, rows, 0.5));
  }
  if (text.winner !== undefined) {
    out.push(block('group:winner', 'immediate', 'For the winner of the vote', [text.winner], 1));
  }
  if (text.passive !== undefined) {
    out.push(block('group:effect', 'effect', 'Resolution effect', [text.passive], 2));
  }
  if (text.action !== undefined) {
    // HOW MANY TIMES (Manufacturing Run RX37): the declared count with its threshold, under the sentence — the ONE
    // reading of the manifest's `actionUses` (a law taken once a generation adds nothing here).
    const uses = actionUsesRule(resolution.actionUses);
    out.push(block('group:action', 'action', 'Resolution action',
      uses === undefined ? [text.action] : [text.action, {text: uses.label, params: uses.params ?? []}], 3));
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
 * effect's edge — is the VOTE PANEL's (Парламент v8, the owner's point 9: the
 * dossier is the rules), never prose.
 */
export function resolutionPartyAnnotations(party: ReduxParty, support?: SupportReadingVm): ReadonlyArray<CardAnnotation> {
  const effect = getPartyEffect(party);
  const out = effect === undefined ? [] : partyMechanicBlocks(effect, ASIDE_LABELS);
  // THE PARTY'S SUPPORT under a door that also pays it (TR03 Political Donation): the vote panel's own
  // numbers — `current → resulting` out of the area's three, with what cut the printed amount — and, ONLY
  // here, the RULE in words: the neutral delegates wait in the area for the party's NEXT resolution and do
  // not vote on the one the delegate is sent to. The panel itself carries no sentence.
  if (support !== undefined) {
    const rows: Array<string | RowText> = [
      {text: SUPPORT_NUMBERS_KEY, params: [String(support.current), String(support.resulting), String(support.places.total)]},
    ];
    if (support.tail !== undefined) {
      rows.push(support.gained === 0 ? support.tail.key : {text: support.tail.key, params: support.tail.params});
    }
    rows.push(SUPPORT_RULE_KEY);
    out.push(block('group:support', 'note', SUPPORT_KICKER, rows, 2));
  }
  return out;
}

/** «0 → 3 из 3» — the area's stock before and after the press, out of its ceiling. */
export const SUPPORT_NUMBERS_KEY = '${0} → ${1} of ${2}';
/** The rule of Popular Support a delegate grant's forecast stands on — the one sentence, printed by the inspector only. */
export const SUPPORT_RULE_KEY = 'Neutral delegates in a party\'s Popular Support become votes on that party\'s next resolution. They do not vote on this one.';

export function partyAnnotations(party: ReduxParty, model: ParliamentModel | undefined, viewer: Color | undefined, canActNow?: boolean, accessShown = false): ReadonlyArray<CardAnnotation> {
  const effect = getPartyEffect(party);
  if (effect === undefined) {
    return [];
  }
  // 1–2. THE EFFECT and THE ACTION — the shared mechanic blocks.
  const out: Array<CardAnnotation> = partyMechanicBlocks(effect, PARTY_INSPECTOR_LABELS);
  // 3. FOR YOU — the viewer's STATE: the live bases of the effect (held / not
  //    held) and the action's live state, never the rule restated.
  let forYou = false;
  if (model !== undefined && viewer !== undefined) {
    const me = model.players.find((p) => p.color === viewer);
    const access = me?.access.find((a) => a.party === party);
    if (access !== undefined) {
      const enactedName = model.enacted === undefined ? undefined : translateText(getResolution(model.enacted.resolution)?.text.name ?? model.enacted.resolution);
      // Парламент v8 (§ 7): where the dossier stands the «ДОСТУП» OBJECT above the rules (`ConsolePartyAccessPanel`), the
      // access rows are ITS reading — «ДЛЯ ВАС» keeps only what the object does not say (the action's live state).
      const rows: Array<string | RowText> = accessShown ? [] : accessReasonRows(access, {
        party,
        enactedEmpty: model.enacted === undefined,
        enactedName,
        inArea: model.slots.some((slot) => slot.party === party),
        waiver: me?.partyRequirementWaiver,
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
      if (rows.length > 0) {
        out.push(block('group:you', 'note', 'For you', rows, 2));
      }
      forYou = true;
    }
  }
  // 4. THE REFERENCE — how a party effect is held: the whole rule, once — ONLY for a reader with no «for you» block
  //    (a spectator, the bot's screen, a zoom outside a live game). Beside «for you» it re-told what the state rows had
  //    just said, and on the TV it pushed the panel past its fold (PL-042, the owner's decision 2026-10-09 in the TR36
  //    batch) — and under a card that lowered the law (TR36) its printed «two of your delegates» stated a rule the
  //    viewer's table no longer follows. The state rows name the viewer's own law, so the reference is not needed there.
  if (!forYou) {
    out.push(block('group:access', 'note', 'Access', [
      'The ruling party\'s effect is everyone\'s. A party with two of your delegates on its resolution gives you its effect too.',
    ], 3));
  }
  return out;
}

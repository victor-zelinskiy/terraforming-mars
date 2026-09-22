/*
 * INFLUENCE → RESULT, the CLIENT reading (Turmoil Redux).
 *
 * The one place a console surface turns a resolution's influence-scaled
 * declaration (`IClientResolution.scaled`, the very object the server pays
 * by) into what the player sees: the formula («1 animal per point of
 * influence») and, when there is a player, THEIR number for the context the
 * surface is in — the current estimate on the vote surface, the «if you win»
 * forecast (the Agenda step of the phase counts first), the live payout in
 * the picker's header, the recorded amount in the results scene. Pure: no
 * Vue, no DOM, no i18n — English keys and numbers; `ConsoleInfluenceYield.vue`
 * renders it. Nothing here re-derives the arithmetic (`scaledAmount` does).
 */
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {Resource} from '@/common/Resource';
import {getCard} from '@/client/cards/ClientCardManifest';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {ParliamentModel, ParliamentPlayerModel, ParliamentEnactOutcomeModel} from '@/common/models/ParliamentModel';
import {
  fixedSequelYield, fixedYield, InfluenceScaledEffect, InfluenceSequelTerm, InfluenceYield, influenceYield, InfluenceYieldContext,
  referenceYield, scaledAmount, sequelYield, winnerForecastYield, yieldAtCap,
} from '@/common/parliament/influenceScaling';
import {AGENDA_TRACK, influenceAtAgenda} from '@/common/parliament/ParliamentTypes';
import {countOf, ResolutionCountId} from '@/common/parliament/resolutionCounts';
import {Tag} from '@/common/cards/Tag';
import {CountedObjectGlyph} from '@/client/components/premiumCard/premiumCardIcons';
import {getSpecialCellInfo} from '@/client/components/board/specialCellInfo';

/** The icon of the yield's unit — the same CSS families the chips use. */
export type YieldIcon =
  | {family: 'card-resource', resource: CardResource}
  | {family: 'resource', resource: Resource, production: boolean}
  | {family: 'cards'}
  /** The COLONY tile — the unit of a «gain all your colony bonuses k times» effect is the multiplier over the ledger. */
  | {family: 'colony'};

export function yieldIconOf(effect: InfluenceScaledEffect): YieldIcon {
  switch (effect.unit.kind) {
  case 'cardResource': return {family: 'card-resource', resource: effect.unit.resource};
  case 'stock': return {family: 'resource', resource: effect.unit.resource, production: false};
  case 'production': return {family: 'resource', resource: effect.unit.resource, production: true};
  case 'cards': return {family: 'cards'};
  case 'colonyBonuses': return {family: 'colony'};
  }
}

/** The effect's amount is a MULTIPLIER over the player's colony ledger (Colonial Affairs), not a count of a resource. */
export function yieldIsMultiplier(effect: InfluenceScaledEffect): boolean {
  return effect.unit.kind === 'colonyBonuses';
}

/**
 * HOW A COUNTED TERM IS DRAWN AND NAMED — one entry per count id: the glyph of
 * the counted object (the same render item the card face prints, so the
 * yield block and the card can never draw two different things) and the i18n
 * key of its counted name («2 building cards with a VP icon»).
 *
 * THE GLYPH FOLLOWS WHAT IS COUNTED. A card count draws the CARD (cover, tag
 * bubble, VP plate); a tag count draws the printed TAG medallion alone —
 * drawing a card for «each power tag you have» would state a different rule,
 * and the energy RESOURCE cube would state a third one.
 */
export type YieldCountGlyph = CountedObjectGlyph;

export type YieldCountPresentation = {
  glyph: YieldCountGlyph;
  /** English i18n key `${0} …` with a plural group, resolved against the count. */
  pluralKey: string;
  /** English i18n key of the qualification rule (the detailed inspection's sentence). */
  ruleKey: string;
  /** English i18n key of the SERVER's own skip reason when the whole formula comes to nothing. */
  skipReasonKey: string;
};

export function yieldCountPresentation(id: ResolutionCountId): YieldCountPresentation {
  switch (id) {
  case 'buildingCardsWithNonNegativeVp':
    return {
      glyph: {kind: 'vp-card', tag: Tag.BUILDING},
      pluralKey: '${0} building card(s) with a VP icon',
      ruleKey: 'A variable VP icon counts even at 0 VP; a card without a VP icon does not count.',
      skipReasonKey: 'No qualifying cards and no influence',
    };
  case 'powerTags':
    return {
      glyph: {kind: 'tag', tag: Tag.POWER},
      pluralKey: '${0} power tag(s)',
      ruleKey: 'Every power tag counts, whatever the card scores: one card with two of them counts twice. A wild tag is not a power tag at an enactment, and energy production is not a tag.',
      skipReasonKey: 'No power tags and no influence',
    };
  case 'venusJovianTags':
    // ONE term over TWO tags: the glyph is both medallions joined by «+», as the face prints them.
    return {
      glyph: {kind: 'tags', tags: [Tag.VENUS, Tag.JOVIAN]},
      pluralKey: '${0} Venus and Jovian tag(s)',
      ruleKey: 'Every Venus tag and every Jovian tag counts, one unit each: a card that prints both counts twice. A wild tag is neither at an enactment.',
      skipReasonKey: 'No Venus or Jovian tags and no influence',
    };
  case 'spaceCities':
    // A count over the BOARD: the glyph is the city tile with the footnote spark — the face's own «space city».
    return {
      glyph: {kind: 'tile', tile: 'spaceCity'},
      pluralKey: '${0} space city(-ies)',
      ruleKey: 'A city tile on a reserved area off Mars counts — Ganymede Colony, Phobos Space Haven, Stanford Torus and the like. A city on Mars and the Moon\'s tiles do not count.',
      skipReasonKey: 'No space cities and no influence',
    };
  }
}

/**
 * The counted cards of a reading, each with what IT contributed («Fusion
 * Power ×2») — the detailed inspection's list. Names arrive translated; the
 * «×n» is added only where a card is worth more than one, so a card count
 * reads as a plain list.
 */
export function countedContributions(y: InfluenceYield, nameOf: (card: CardName) => string): Array<string> {
  const counted = y.counted ?? [];
  return counted.map((card, i) => {
    const units = y.countedUnits?.[i] ?? 1;
    return units > 1 ? `${nameOf(card)} ×${units}` : nameOf(card);
  });
}

/**
 * The counted CELLS of a BOARD count (Colonization Funding's space cities), each
 * by the name THE BOARD INFORMATION LAYER already gives it — the reserved
 * areas' own titles («Ganymede Colony», «Phobos Space Haven», «Stanford
 * Torus», the Venus areas), the same words the placement hints print. A cell
 * that layer does not name is `undefined`: nothing here christens a cell —
 * the reader then prints the number and lets the rule speak.
 */
export function countedCellNames(y: Pick<InfluenceYield, 'countedSpaces'>, nameOf: (key: string) => string): Array<string | undefined> {
  return (y.countedSpaces ?? []).map((id) => {
    const cell = getSpecialCellInfo(id);
    return cell === undefined ? undefined : nameOf(cell.title);
  });
}

/** The caption under a reading — WHICH question the number answers (English keys; `params` for the step). */
export function yieldCaptionOf(y: InfluenceYield): {key: string, params?: ReadonlyArray<string>} | undefined {
  switch (y.context) {
  // An effect that COUNTS the tableau — or DIVIDES a total that can still move
  // before the enactment — is a preliminary reading: it says so, conditionally.
  case 'estimate': return y.effect.count !== undefined || y.effect.sequel !== undefined ?
    {key: 'If enacted now'} : {key: 'By your current influence'};
  case 'forecast': return y.agendaStep === undefined ? {key: 'If you win the vote'} : {key: 'If you win — Agenda step ${0}', params: [String(y.agendaStep)]};
  case 'resolving': return y.skipped !== undefined ? {key: y.skipped} : {key: 'This payout'};
  case 'applied': return y.skipped !== undefined ? {key: y.skipped} : {key: 'Received'};
  case 'reference': return undefined;
  }
}

/**
 * THE SEQUENTIAL TERM'S PRESENTATION — how «1 card for every 3 steps of heat
 * production» is drawn and named. The unit of the TOTAL is an ordinary
 * resource icon in its production frame, so the block can never draw the heat
 * CUBE where the rule means production.
 */
export function sequelTotalIcon(term: InfluenceSequelTerm): YieldIcon {
  switch (term.total.kind) {
  case 'cardResource': return {family: 'card-resource', resource: term.total.resource};
  case 'stock': return {family: 'resource', resource: term.total.resource, production: false};
  case 'production': return {family: 'resource', resource: term.total.resource, production: true};
  case 'cards': return {family: 'cards'};
  case 'colonyBonuses': return {family: 'colony'};
  }
}

/**
 * HOW A SEQUENTIAL TERM IS NAMED — one entry per declared term, exactly as
 * `yieldCountPresentation` names a counted one: the i18n key of the SERVER's
 * own skip reason when the total is below the divisor. A surface that explains
 * the zero reads the sentence the game would record, never one of its own.
 */
export function sequelPresentation(term: InfluenceSequelTerm): {skipReasonKey: string} {
  if (term.total.kind === 'production' && term.total.resource === Resource.HEAT && term.per === 3) {
    return {skipReasonKey: 'Heat production below 3 — no cards'};
  }
  return {skipReasonKey: 'Nothing is owed'};
}

/** The effect a sequel term points BACK at, inside the same resolution. */
export function sequelSourceOf(resolution: IClientResolution | undefined, effect: InfluenceScaledEffect): InfluenceScaledEffect | undefined {
  const after = effect.sequel?.after;
  return after === undefined ? undefined : resolution?.scaled?.find((e) => e.id === after);
}

/**
 * The seat's CURRENT total for a sequel term — the server's own reading
 * (`ParliamentPlayerModel.production`), never a number found elsewhere.
 * Undefined when the model does not carry it: the surface then falls back to
 * the formula rather than inventing a zero.
 */
export function sequelTotalOf(seat: ParliamentPlayerModel | undefined, term: InfluenceSequelTerm): number | undefined {
  if (seat === undefined || term.total.kind !== 'production') {
    return undefined;
  }
  return seat.production?.[term.total.resource];
}

/** The seat of `viewer` on the table, if it takes part. */
function seatOf(model: ParliamentModel | undefined, viewer: Color | undefined): ParliamentPlayerModel | undefined {
  if (model === undefined || viewer === undefined) {
    return undefined;
  }
  const seat = model.players.find((p) => p.color === viewer);
  return seat !== undefined && seat.participates ? seat : undefined;
}

/**
 * The viewer's readings of a resolution UP FOR THE VOTE: the estimate by the
 * current influence and — apart from it, named — the «if you win» forecast,
 * because the winner's Agenda step of the phase raises the influence the
 * effect is paid at. A forecast equal to the estimate is dropped (the
 * marker stands on a TR / card step next, or at the end of the track): one
 * number, never the same number twice. No seat → the reference alone.
 */
export function voteYieldsOf(resolution: IClientResolution, model: ParliamentModel | undefined, viewer: Color | undefined): Array<InfluenceYield> {
  const out: Array<InfluenceYield> = [];
  const seat = seatOf(model, viewer);
  for (const effect of resolution.scaled ?? []) {
    if (seat === undefined) {
      out.push(referenceYield(effect));
      continue;
    }
    // A SEQUENTIAL part reads the total an EARLIER part of the same resolution
    // will move — the personal answer to «how many cards, then?». Both the
    // estimate and the «if you win» forecast project the earlier part first,
    // so influence is counted exactly once, inside the total.
    const term = effect.sequel;
    if (term !== undefined) {
      const before = sequelTotalOf(seat, term);
      const source = sequelSourceOf(resolution, effect);
      if (before === undefined || source === undefined) {
        out.push(referenceYield(effect));
        continue;
      }
      const estimate = sequelYield(effect, 'estimate', before, scaledAmount(source, seat.influence), {influence: seat.influence});
      out.push(estimate);
      const step = Math.min(AGENDA_TRACK.length, Math.max(0, seat.agenda) + 1);
      const winnerInfluence = influenceAtAgenda(step) + Math.max(0, seat.influence - influenceAtAgenda(seat.agenda));
      const forecast = sequelYield(effect, 'forecast', before, scaledAmount(source, winnerInfluence), {influence: winnerInfluence, agendaStep: step});
      if (forecast.amount !== estimate.amount) {
        out.push(forecast);
      }
      continue;
    }
    // A counted term is the SERVER's count for this seat (number + cards). A
    // model that does not carry it gives no personal number — never an
    // invented zero.
    const count = effect.count === undefined ? undefined : countOf(seat.counts, effect.count.id);
    if (effect.count !== undefined && count === undefined) {
      out.push(referenceYield(effect));
      continue;
    }
    // …with its per-tag breakdown, where the count is over several tags (Venus + Jovian): the reading names each.
    // …and its CELLS, where the count is over the board (Colonization Funding's space cities): the reading names each.
    const counted = count === undefined ? undefined : {count: count.count, cards: count.cards, units: count.units, byTag: count.byTag, spaces: count.spaces};
    const estimate = influenceYield(effect, 'estimate', seat.influence, counted);
    out.push(estimate);
    if (effect.recipient === 'each' || effect.recipient === 'winner') {
      // Every influence beyond the track (cards, colonies) rides along unchanged.
      const bonus = seat.influence - influenceAtAgenda(seat.agenda);
      const forecast = winnerForecastYield(effect, seat.agenda, bonus, counted);
      if (forecast.amount !== estimate.amount) {
        out.push(forecast);
      }
    }
  }
  return out;
}

/**
 * The reading of an ENACTED resolution for the viewer: what was recorded for
 * them, else the reference. A SKIPPED record is not a receipt — it carries its
 * reason (`skipped`), so no surface can print «received +3» for three animals
 * that were forfeited.
 */
export function enactedYieldsOf(
  resolution: IClientResolution,
  model: ParliamentModel | undefined,
  viewer: Color | undefined,
  opts?: {
    /**
     * The chain is STILL RESOLVING (the political phase is on screen): the
     * same recorded numbers, read as «this payout» rather than «received».
     * A finished enactment reads `applied` — history is never re-labelled.
     */
    live?: boolean,
  },
): Array<InfluenceYield> {
  const out: Array<InfluenceYield> = [];
  const context: 'resolving' | 'applied' = opts?.live === true ? 'resolving' : 'applied';
  const outcomes = model?.phase?.outcomes ?? model?.lastPhase?.outcomes ?? [];
  for (const effect of resolution.scaled ?? []) {
    const applied = viewer === undefined ? undefined : outcomes.find((o) => o.player === viewer && o.effect === effect.id);
    // A SEQUENTIAL part's record carries the TOTAL it was divided from, as the
    // server read it before and after the earlier part. It is never recomputed
    // from today's production — and never from «before + influence».
    if (effect.sequel !== undefined && applied?.total !== undefined) {
      const reading = fixedSequelYield(effect, context, applied.amount ?? 0, applied.total, {
        influence: applied.influence,
        delivered: applied.drawn,
      });
      out.push(applied.kind === 'skipped' ? {...reading, skipped: applied.reason ?? 'Skipped'} : reading);
      continue;
    }
    // The RECORDED inputs travel as recorded (B, the counted cards, the sum
    // before the cap) — the past is never recomputed from today's tableau.
    const recorded = applied === undefined ? undefined :
      {
        count: applied.count, counted: applied.counted, countedUnits: applied.countedUnits, countedByTag: applied.countedByTag,
        countedSpaces: applied.countedSpaces, uncapped: applied.uncapped,
      };
    // A MULTIPLIER effect (the colony ledger): every record of the plan pays its own unit and carries the
    // multiplier beside it — the reading is the multiplier, never the first row's amount.
    const paid = applied === undefined ? undefined : (yieldIsMultiplier(effect) ? (applied.multiplier ?? applied.amount) : applied.amount);
    if (applied !== undefined && applied.kind === 'skipped' && (!yieldIsMultiplier(effect) || applied.colony === undefined)) {
      out.push({...fixedYield(effect, context, paid ?? 0, applied.influence, recorded), skipped: applied.reason ?? 'Skipped'});
    } else if (applied !== undefined && paid !== undefined) {
      out.push(fixedYield(effect, context, paid, applied.influence, recorded));
    } else {
      out.push(referenceYield(effect));
    }
  }
  return out;
}

/**
 * The reading of a LIVE payout — the picker's header: the server's own
 * amount (the prompt's `resourceGainPrompt.amount`), the influence it was
 * computed from when the table can say it.
 */
export function resolvingYieldOf(effect: InfluenceScaledEffect, amount: number, model: ParliamentModel | undefined, viewer: Color | undefined): InfluenceYield {
  const seat = seatOf(model, viewer);
  return fixedYield(effect, 'resolving', amount, seat?.influence);
}

/**
 * THE READING OF THIS PAYOUT before it is recorded — the sitting's reward
 * page at the assembly gate (docs/TURMOIL_REDUX_PARLIAMENT_SITTING.md
 * § «Передача в Э5», seam 5): the enactment has happened, the winner's Agenda
 * step is taken, so the seat's influence, its counts and its totals are the
 * ones the effects will pay by — the same declaration, the same
 * `scaledAmount`, read as «this payout» rather than «by your current
 * influence» / «if enacted now». No forecast (there is no vote left to win).
 * A skipped estimate keeps its own reason; a seat outside the table reads
 * the reference alone.
 */
export function resolvingYieldsOf(resolution: IClientResolution, model: ParliamentModel | undefined, viewer: Color | undefined): Array<InfluenceYield> {
  return voteYieldsOf(resolution, model, viewer)
    .filter((y) => y.context !== 'forecast')
    .map((y) => (y.context === 'estimate' ? {...y, context: 'resolving'} : y));
}

/** The short name of a standard resource's production in a results line («M€ production +4»). */
export function productionResourceLabelKey(resource: Resource | undefined): string {
  switch (resource) {
  case Resource.MEGACREDITS: return 'M€';
  case Resource.STEEL: return 'Steel';
  case Resource.TITANIUM: return 'Titanium';
  case Resource.PLANTS: return 'Plants';
  case Resource.ENERGY: return 'Energy';
  case Resource.HEAT: return 'Heat';
  default: return resource === undefined ? '' : String(resource);
  }
}

/** The recorded outcome of `effect` for `player` in a summary, if any. */
export function outcomeOf(outcomes: ReadonlyArray<ParliamentEnactOutcomeModel> | undefined, player: Color, effectId: string): ParliamentEnactOutcomeModel | undefined {
  return outcomes?.find((o) => o.player === player && o.effect === effectId);
}

/** A resolution's scaled effect by id (the picker looks its own up). */
export function scaledEffectOf(resolution: IClientResolution | undefined, effectId: string): InfluenceScaledEffect | undefined {
  return resolution?.scaled?.find((e) => e.id === effectId);
}

/** The first scaled effect whose unit is the card resource the prompt adds — how a picker finds its rule. */
export function scaledEffectForCardResource(resolution: IClientResolution | undefined, resourceIcon: string | undefined): InfluenceScaledEffect | undefined {
  if (resolution?.scaled === undefined || resourceIcon === undefined) {
    return undefined;
  }
  return resolution.scaled.find((e) => e.unit.kind === 'cardResource' && String(e.unit.resource).toLowerCase().replace(/\s+/g, '-') === resourceIcon);
}

export const YIELD_CONTEXTS: ReadonlyArray<InfluenceYieldContext> = ['reference', 'estimate', 'forecast', 'resolving', 'applied'];

/**
 * THE «+N IF YOU WIN» SUFFIX — the vote panel's ONE-NUMBER law. The panel
 * shows the viewer ONE reading per effect (the estimate by the current
 * influence); what the WIN would add is not a second reading but a suffix
 * of the same one («+1 if you win · step 3»). It is read off the pair of
 * readings `voteYieldsOf` already computed — the forecast minus the estimate
 * of the same effect — so nothing is recomputed here and the panel, the
 * inspector and the playground can never disagree about the difference. A
 * sequel chain gets one suffix per link. Where the win raises nothing (an
 * effect at its maximum, a marker whose next step is a TR / card step, the
 * end of the track) `voteYieldsOf` emits no forecast, and there is no suffix.
 */
export type WinSuffix = {
  effectId: string;
  /** What the win adds to the shown number (forecast − estimate, > 0). */
  delta: number;
  /** The Agenda step the forecast's influence is read at (undefined for a forecast without a step). */
  agendaStep: number | undefined;
  /** The influence the number is read at after the win. */
  influence: number | undefined;
  /** The forecast stands AT the effect's maximum — the win takes the number to the cap. */
  atCap: boolean;
};

export function winSuffixesOf(yields: ReadonlyArray<InfluenceYield>): Array<WinSuffix> {
  const out: Array<WinSuffix> = [];
  for (const forecast of yields) {
    if (forecast.context !== 'forecast' || forecast.amount === undefined) {
      continue;
    }
    const estimate = yields.find((y) => y.effect.id === forecast.effect.id && y.context === 'estimate');
    if (estimate?.amount === undefined) {
      continue;
    }
    const delta = forecast.amount - estimate.amount;
    if (delta <= 0) {
      continue;
    }
    out.push({effectId: forecast.effect.id, delta, agendaStep: forecast.agendaStep, influence: forecast.influence, atCap: yieldAtCap(forecast)});
  }
  return out;
}

/** The one-number readings: every reading but the forecasts (those fold into `winSuffixesOf`). */
export function oneNumberYieldsOf(yields: ReadonlyArray<InfluenceYield>): Array<InfluenceYield> {
  return yields.filter((y) => y.context !== 'forecast');
}

/**
 * The i18n key of a card resource's COUNTED name («3 animal(s)») — the RU
 * value carries its plural groups, resolved against the number to its left
 * by `translateTextWithParams`. Unknown resources fall back to their raw name.
 */
export function cardResourcePluralKey(resource: CardResource | undefined): string {
  switch (resource) {
  case CardResource.ANIMAL: return 'animal resource(s)';
  case CardResource.MICROBE: return 'microbe resource(s)';
  case CardResource.FLOATER: return 'floater resource(s)';
  case CardResource.DATA: return 'data resource(s)';
  case CardResource.SCIENCE: return 'science resource(s)';
  case CardResource.FIGHTER: return 'fighter(s)';
  case CardResource.ASTEROID: return 'asteroid(s)';
  default: return resource === undefined ? 'resource(s)' : String(resource);
  }
}

/**
 * THE HONEST NOTE beside a computed number the viewer could not receive: a
 * card-resource yield needs a card of the viewer's that can HOLD it (the
 * card's own storage rule — `resourceType` — never a tag), and without one
 * the formula still says «3 animals» while nothing would land. English key,
 * undefined when a recipient exists or the yield is not a card resource.
 */
export function noRecipientNoteOf(effect: InfluenceScaledEffect, tableau: ReadonlyArray<{name: CardName}>): string | undefined {
  if (effect.unit.kind !== 'cardResource') {
    return undefined;
  }
  const resource = effect.unit.resource;
  const holder = tableau.some((card) => {
    const type = getCard(card.name)?.resourceType;
    return type === resource || type === CardResource.WARE;
  });
  return holder ? undefined : noRecipientForecastKey(resource);
}

/**
 * The same honesty in the panel's COMPACT register: the server's own skip
 * reason for the case («No card can hold animals») — the sentence the game
 * would record, never a second wording. Undefined when a recipient exists.
 */
export function noRecipientCompactNoteOf(effect: InfluenceScaledEffect, tableau: ReadonlyArray<{name: CardName}>): string | undefined {
  if (effect.unit.kind !== 'cardResource' || noRecipientNoteOf(effect, tableau) === undefined) {
    return undefined;
  }
  return noRecipientReasonKey(effect.unit.resource);
}

/** The forecast note for a card resource with no holder («…would be forfeited»), named by resource where the copy exists. */
export function noRecipientForecastKey(resource: CardResource): string {
  switch (resource) {
  case CardResource.ANIMAL: return 'no eligible card — the animals would be forfeited';
  case CardResource.FLOATER: return 'no eligible card — the floaters would be forfeited';
  default: return 'no eligible card — the payout would be forfeited';
  }
}

/** The SKIP reason for a card resource with no holder — the key the server's outcome record carries for the same case. */
export function noRecipientReasonKey(resource: CardResource): string {
  switch (resource) {
  case CardResource.ANIMAL: return 'No card can hold animals';
  case CardResource.FLOATER: return 'No card can hold floaters';
  case CardResource.MICROBE: return 'No card can hold microbes';
  case CardResource.DATA: return 'No card can hold data';
  default: return 'No card can hold this resource';
  }
}

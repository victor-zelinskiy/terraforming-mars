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
  fixedLevelYield, fixedSequelYield, fixedYield, InfluenceLevelTerm, InfluenceScaledEffect, InfluenceSequelTerm, InfluenceYield, influenceYield,
  InfluenceYieldContext, InfluenceYieldUnit, levelYield, referenceYield, scaledAmount, sequelYield, winnerForecastYield, yieldAtCap, YieldCount,
} from '@/common/parliament/influenceScaling';
import {AGENDA_TRACK, influenceAtAgenda} from '@/common/parliament/ParliamentTypes';
import {
  countMetricToward, countOf, INDUSTRIAL_PRODUCTION_RESOURCES, ResolutionCountByResource, ResolutionCountId, ResolutionCountMetric,
  ResolutionCountMetricModel,
} from '@/common/parliament/resolutionCounts';
import {LEVY_STEP_KEY, levyEstimate, levyNetEffectOf, levyRecorded, LevyReading, ResolutionLevy} from '@/common/parliament/resolutionLevy';
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
 * A FLAT part — the same for every participant, influence does not touch it
 * (Industrialist Budget's «+4 M€ production»): a rate of 0 per influence, no
 * count, no sequel, a base. Its reading prints the base alone — an inputs
 * cluster («[influence] 3 → +4») would claim the influence bought it.
 */
export function yieldIsFlat(effect: InfluenceScaledEffect): boolean {
  return effect.perInfluence === 0 && effect.count === undefined && effect.sequel === undefined && (effect.base ?? 0) > 0;
}

/**
 * THE HORIZON of a production part paid at the sitting: the sitting runs AFTER
 * the generation's production phase, so a production step raised there first
 * PAYS in the NEXT generation. Printed under a production reading wherever the
 * same card also moves the seat's SUPPLY today (a budget: «−10 → +7 = −3»
 * beside «+4 M€ production») — today's pocket and next generation's income
 * are two horizons, never one sum.
 */
export const PRODUCTION_HORIZON_KEY = 'pays from the next generation';

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
      ruleKey: 'A card with a variable VP icon counts even at 0 VP. A card with a negative VP icon or no VP icon does not.',
      skipReasonKey: 'No qualifying cards and no influence',
    };
  case 'powerTags':
    return {
      glyph: {kind: 'tag', tag: Tag.POWER},
      pluralKey: '${0} power tag(s)',
      ruleKey: 'Each power tag counts: a card with two power tags counts twice. Wild tags and energy production do not count.',
      skipReasonKey: 'No power tags and no influence',
    };
  case 'venusJovianTags':
    // ONE term over TWO tags: the glyph is both medallions joined by «+», as the face prints them.
    return {
      glyph: {kind: 'tags', tags: [Tag.VENUS, Tag.JOVIAN]},
      pluralKey: '${0} Venus and Jovian tag(s)',
      ruleKey: 'Each Venus and Jovian tag counts: a card with both counts twice. Wild tags do not count.',
      skipReasonKey: 'No Venus or Jovian tags and no influence',
    };
  case 'spaceCities':
    // A count over the BOARD: the glyph is the city tile with the footnote spark — the face's own «space city».
    return {
      glyph: {kind: 'tile', tile: 'spaceCity'},
      pluralKey: '${0} space city(-ies)',
      ruleKey: 'A city on a reserved area off Mars counts: Ganymede Colony, Phobos Space Haven, Stanford Torus and the like. Cities on Mars and on the Moon do not.',
      skipReasonKey: 'No space cities and no influence',
    };
  case 'terraformRatingSets':
    // A count over ONE player METRIC: the glyph is the rating badge the face prints — the threshold and the step are words.
    return {
      glyph: {kind: 'metric', metric: 'terraformRating'},
      pluralKey: '${0} complete set(s) of 5 TR over 15',
      ruleKey: 'Each full 5 TR above 15 is one set: TR 20 is 1 set, TR 24 still 1, TR 25 is 2. The remainder pays nothing.',
      skipReasonKey: 'No TR sets and no influence',
    };
  case 'steelTitaniumEnergyProduction':
    // A count over PRODUCTION STEPS: the glyph is the production box the face prints — the three resources joined by «+»,
    // in their brown frame (bare cubes would count the supply, a card would state another rule).
    return {
      glyph: {kind: 'production', resources: INDUSTRIAL_PRODUCTION_RESOURCES},
      pluralKey: '${0} step(s) of steel, titanium and energy production',
      ruleKey: 'Each step of steel, titanium and energy production counts, added up. Resources in your supply do not count.',
      skipReasonKey: 'No steel, titanium or energy production and no influence',
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

/**
 * THE BREAKDOWN of a THRESHOLD count (Generous Funding's sets of 5 TR over
 * 15), in words — the reading that stands where a list of cards or cells
 * would: «TR 24 · threshold 15 · 1 complete set · 1 to the next set». English
 * keys with their params; the consumer translates and joins them. The
 * metric's own label is one word per metric (`metricLabelKeyOf`).
 */
export function countedMetricParts(metric: ResolutionCountMetricModel): Array<{key: string, params: ReadonlyArray<string>}> {
  return [
    {key: metricLabelKeyOf(metric.metric), params: [String(metric.value)]},
    {key: 'threshold ${0}', params: [String(metric.over)]},
    {key: '${0} complete set(s)', params: [String(metric.sets)]},
    {key: '${0} to the next set', params: [String(metric.toNext)]},
  ];
}

/** The i18n key naming a counted metric's VALUE («TR ${0}»). */
export function metricLabelKeyOf(metric: ResolutionCountMetric): string {
  switch (metric) {
  case 'terraformRating': return 'TR ${0}';
  }
}

/** The i18n key naming ONE term of a PRODUCTION count («steel production ${0}») — one key per standard resource. */
export function productionCountLabelKeyOf(resource: Resource): string {
  switch (resource) {
  case Resource.MEGACREDITS: return 'M€ production ${0}';
  case Resource.STEEL: return 'steel production ${0}';
  case Resource.TITANIUM: return 'titanium production ${0}';
  case Resource.PLANTS: return 'plant production ${0}';
  case Resource.ENERGY: return 'energy production ${0}';
  case Resource.HEAT: return 'heat production ${0}';
  }
}

/**
 * THE BREAKDOWN of a PRODUCTION count (Industrialist Budget's steel + titanium
 * + energy steps), in words — the twin of the multi-tag breakdown, one term
 * per listed resource with its steps, a zero included («steel production 2 ·
 * titanium production 1 · energy production 3»). English keys with their
 * params; the consumer translates and joins them.
 */
export function countedProductionParts(byResource: ReadonlyArray<ResolutionCountByResource>): Array<{key: string, params: ReadonlyArray<string>}> {
  return byResource.map((entry) => ({key: productionCountLabelKeyOf(entry.resource), params: [String(entry.count)]}));
}

/** The i18n key of the SETS a threshold count came to («1 set»), with its plural groups — the reading's word beside the count. */
export const METRIC_SETS_PLURAL_KEY = '${0} set(s)';

/**
 * THE COUNT THE «IF YOU WIN» FORECAST STANDS ON. The winner's marker takes ONE
 * Agenda step before the effect resolves (rulebook p.10) — and when the step
 * reached is a TR step, the rating rises by one BEFORE a threshold count over
 * the rating is read (`ChairmanSeat.advanceAgenda` raises it inside the
 * phase). A forecast that ignored it would promise +8 and pay +10. Every other
 * count rides along unchanged: the phase moves no tableau and no tile.
 */
export function winnerForecastCount(effect: InfluenceScaledEffect, count: YieldCount | undefined, agendaPosition: number): YieldCount | undefined {
  const metric = count?.metric;
  if (effect.count === undefined || count === undefined || metric === undefined || metric.metric !== 'terraformRating') {
    return count;
  }
  const step = Math.min(AGENDA_TRACK.length, Math.max(0, agendaPosition) + 1);
  if (AGENDA_TRACK[step - 1]?.kind !== 'tr') {
    return count;
  }
  const raised = countMetricToward(effect.count.id, metric.value + 1);
  return {...count, count: raised.count, metric: raised.metric};
}

/** The caption under a reading — WHICH question the number answers (English keys; `params` for the step). */
export function yieldCaptionOf(y: InfluenceYield): {key: string, params?: ReadonlyArray<string>} | undefined {
  switch (y.context) {
  // An effect that COUNTS the tableau — or DIVIDES a total that can still move
  // before the enactment — is a preliminary reading: it says so, conditionally.
  // A FLAT part is nobody's number in particular: it says so too.
  // …and so is a LEVEL part: the hand it is read against moves with every play and sale before the sitting.
  case 'estimate': return yieldIsFlat(y.effect) ? {key: 'The same for every player'} :
    y.effect.count !== undefined || y.effect.sequel !== undefined || y.effect.upTo !== undefined ? {key: 'If enacted now'} : {key: 'By your current influence'};
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
  return totalIconOf(term.total);
}

/** The icon of a player TOTAL a term reads (a sequel's divisor, a level's current value) — the same families as the unit. */
function totalIconOf(total: InfluenceYieldUnit): YieldIcon {
  switch (total.kind) {
  case 'cardResource': return {family: 'card-resource', resource: total.resource};
  case 'stock': return {family: 'resource', resource: total.resource, production: false};
  case 'production': return {family: 'resource', resource: total.resource, production: true};
  case 'cards': return {family: 'cards'};
  case 'colonyBonuses': return {family: 'colony'};
  }
}

// ── A LEVEL PART (Joint Research: «draw until you have 6 + influence in hand») ──

/** The word before the target («up to 9 [cards]»). */
export const LEVEL_UP_TO_KEY = 'up to';
/** The seat's current level of the hand («5 in hand»), with its number. */
export const LEVEL_IN_HAND_KEY = '${0} in hand';
/** The result of a level part that pays nothing — the rule working, said calmly in the result's own slot. */
export const LEVEL_NONE_KEY = 'no draw needed';

/**
 * HOW A LEVEL TERM IS NAMED — one entry per level unit, exactly as
 * `sequelPresentation` names a sequel: the SERVER's own reason for the zero
 * (a hand already at the target — the rule working, never a want of
 * influence), the sentence that explains what the level is, and the words the
 * reading prints beside the number. A surface that explains the zero reads
 * the sentence the game would record, never one of its own.
 */
export function levelPresentation(term: InfluenceLevelTerm): {skipReasonKey: string, ruleKey: string, noneKey: string} {
  if (term.total.kind === 'cards') {
    return {
      skipReasonKey: 'Already at the target hand size',
      ruleKey: 'The hand is counted at the sitting, after the production phase. A hand already at the target draws nothing; the rest comes from the project deck.',
      noneKey: LEVEL_NONE_KEY,
    };
  }
  return {skipReasonKey: 'Nothing is owed', ruleKey: 'The current value is read at the sitting; only the difference to the target is paid.', noneKey: LEVEL_NONE_KEY};
}

/** The icon of the LEVEL a level part reads (the hand's cards). */
export function levelTotalIcon(term: InfluenceLevelTerm): YieldIcon {
  return totalIconOf(term.total);
}

/**
 * The seat's CURRENT level for a level term — the server's own reading
 * (`ParliamentPlayerModel.hand` for the hand, its production / supply for
 * the other units), never a number found elsewhere. Undefined when the model
 * does not carry it: the surface then falls back to the formula rather than
 * inventing a zero.
 */
export function levelTotalOf(seat: ParliamentPlayerModel | undefined, term: InfluenceLevelTerm): number | undefined {
  if (seat === undefined) {
    return undefined;
  }
  switch (term.total.kind) {
  case 'cards': return seat.hand;
  case 'production': return seat.production?.[term.total.resource];
  case 'stock': return seat.stock?.[term.total.resource];
  default: return undefined;
  }
}

/** A level reading whose top-up is ZERO — the rule working, marked with the level term's own reason. */
function withLevelReason(y: InfluenceYield): InfluenceYield {
  const term = y.effect.upTo;
  return term !== undefined && (y.amount ?? 0) === 0 ? {...y, skipped: levelPresentation(term).skipReasonKey} : y;
}

/** The reading of a level part pays NOTHING — the seat is at or above the target (never a forfeited payout: that keeps its size). */
export function levelYieldIsNone(y: InfluenceYield): boolean {
  return y.effect.upTo !== undefined && y.target !== undefined && (y.amount ?? 0) === 0;
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
    // A LEVEL part reads the seat's CURRENT level (the hand the server model
    // carries) against the target the formula yields at the influence: the
    // estimate now, and the «if you win» forecast at the raised target. A
    // seat at or above the target reads its zero as the rule working.
    const level = effect.upTo;
    if (level !== undefined) {
      const before = levelTotalOf(seat, level);
      if (before === undefined) {
        out.push(referenceYield(effect));
        continue;
      }
      const estimate = withLevelReason(levelYield(effect, 'estimate', seat.influence, before));
      out.push(estimate);
      const step = Math.min(AGENDA_TRACK.length, Math.max(0, seat.agenda) + 1);
      const winnerInfluence = influenceAtAgenda(step) + Math.max(0, seat.influence - influenceAtAgenda(seat.agenda));
      const forecast = withLevelReason(levelYield(effect, 'forecast', winnerInfluence, before, {agendaStep: step}));
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
    // …and the BREAKDOWN of its metric, where the count is a threshold over one (Generous Funding's sets of TR).
    // …and its per-resource STEPS, where the count is over the production track (Industrialist Budget).
    const counted: YieldCount | undefined = count === undefined ? undefined :
      {count: count.count, cards: count.cards, units: count.units, byTag: count.byTag, spaces: count.spaces, metric: count.metric, byResource: count.byResource};
    const estimate = influenceYield(effect, 'estimate', seat.influence, counted);
    out.push(estimate);
    if (effect.recipient === 'each' || effect.recipient === 'winner') {
      // Every influence beyond the track (cards, colonies) rides along unchanged; a threshold count over the
      // rating is read AFTER the TR step the win may take (`winnerForecastCount`).
      const bonus = seat.influence - influenceAtAgenda(seat.agenda);
      const forecast = winnerForecastYield(effect, seat.agenda, bonus, winnerForecastCount(effect, counted, seat.agenda));
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
    // A LEVEL part's record carries the TARGET it brought the seat up to and
    // the hand before and after — the server's own numbers; a record from
    // before the target travelled reads the level reached as the target.
    if (effect.upTo !== undefined && applied?.total !== undefined) {
      const reading = fixedLevelYield(effect, context, applied.amount ?? 0, applied.target ?? applied.total.after, applied.total, {
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
        countedSpaces: applied.countedSpaces, countedMetric: applied.countedMetric, countedByResource: applied.countedByResource, uncapped: applied.uncapped,
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

// ── THE LEVY (the Budgets: «lose 10 M€» first) ────────────────────────────────

/**
 * THE PAYOUT THE NET STANDS ON, read off a list of readings: the reading of
 * the levy's net effect (`levyNetEffectOf`) in `context`, else any paying
 * reading of it — a skipped reading pays 0. Undefined when the card pays
 * nothing in the levy's currency, or when no reading of it has a number yet
 * (a reference alone): the caller then reads the levy without a net rather
 * than netting against an invented zero.
 */
function levyPayoutOf(levy: ResolutionLevy, resolution: IClientResolution, yields: ReadonlyArray<InfluenceYield>, context: InfluenceYieldContext): {effectId: string, amount: number} | undefined {
  const effect = levyNetEffectOf(levy, resolution.scaled);
  if (effect === undefined) {
    return undefined;
  }
  const reading = yields.find((y) => y.effect.id === effect.id && y.context === context) ??
    yields.find((y) => y.effect.id === effect.id && y.context !== 'reference' && y.context !== 'forecast');
  if (reading === undefined) {
    return undefined;
  }
  return {effectId: effect.id, amount: reading.skipped !== undefined ? 0 : (reading.amount ?? 0)};
}

/**
 * The viewer's LEVY UP FOR THE VOTE: what the levy would take from the supply
 * the seat holds NOW (the server model's `stock` — the same number the levy
 * step will read), netted against the estimate of the payout in the same
 * currency («−10 → +7 = −3»). A short seat reads its shortfall here, while it
 * can still set money aside (the income of the production phase arrives
 * BEFORE the sitting). No seat → no levy reading (the formula alone).
 */
export function voteLevyOf(resolution: IClientResolution, model: ParliamentModel | undefined, viewer: Color | undefined): LevyReading | undefined {
  const levy = resolution.levy;
  const seat = seatOf(model, viewer);
  if (levy === undefined || seat === undefined) {
    return undefined;
  }
  // A model without the supply (an older server) reads the levy as affordable — never an invented shortfall.
  const held = seat.stock?.[levy.resource] ?? levy.amount;
  return levyEstimate(levy, held, levyPayoutOf(levy, resolution, voteYieldsOf(resolution, model, viewer), 'estimate'));
}

/** The same reading as «this payout» — the sitting's reward page before the seat's record is in. */
export function resolvingLevyOf(resolution: IClientResolution, model: ParliamentModel | undefined, viewer: Color | undefined): LevyReading | undefined {
  const estimate = voteLevyOf(resolution, model, viewer);
  return estimate === undefined ? undefined : {...estimate, context: 'resolving'};
}

/**
 * The viewer's LEVY of an ENACTED resolution: what the server RECORDED for
 * them (a `stock` record with the negative amount taken and `owed`, or the
 * levy's own skip), netted against the recorded payout in the same currency —
 * never recomputed from a later supply. Before the seat's record is in (the
 * sitting still on an earlier seat) the estimate reads as «this payout».
 */
export function enactedLevyOf(
  resolution: IClientResolution,
  model: ParliamentModel | undefined,
  viewer: Color | undefined,
  opts?: {live?: boolean},
): LevyReading | undefined {
  const levy = resolution.levy;
  if (levy === undefined || viewer === undefined) {
    return undefined;
  }
  const context: 'resolving' | 'applied' = opts?.live === true ? 'resolving' : 'applied';
  const outcomes = model?.phase?.outcomes ?? model?.lastPhase?.outcomes ?? [];
  const record = outcomes.find((o) => o.player === viewer && o.step === LEVY_STEP_KEY && o.kind !== 'reaction');
  if (record === undefined) {
    return resolvingLevyOf(resolution, model, viewer);
  }
  // The recorded payout when it is in; the estimate of it while the seat's own steps are still running.
  const payout = levyPayoutOf(levy, resolution, enactedYieldsOf(resolution, model, viewer, opts), context) ??
    levyPayoutOf(levy, resolution, resolvingYieldsOf(resolution, model, viewer), 'resolving');
  return levyRecorded(levy, record, context, payout);
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

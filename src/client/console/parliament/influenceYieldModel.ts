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
  fixedYield, InfluenceScaledEffect, InfluenceYield, influenceYield, InfluenceYieldContext, referenceYield, winnerForecastYield,
} from '@/common/parliament/influenceScaling';
import {influenceAtAgenda} from '@/common/parliament/ParliamentTypes';
import {countOf, ResolutionCountId} from '@/common/parliament/resolutionCounts';
import {Tag} from '@/common/cards/Tag';
import {CountedObjectGlyph} from '@/client/components/premiumCard/premiumCardIcons';

/** The icon of the yield's unit — the same CSS families the chips use. */
export type YieldIcon =
  | {family: 'card-resource', resource: CardResource}
  | {family: 'resource', resource: Resource, production: boolean}
  | {family: 'cards'};

export function yieldIconOf(effect: InfluenceScaledEffect): YieldIcon {
  switch (effect.unit.kind) {
  case 'cardResource': return {family: 'card-resource', resource: effect.unit.resource};
  case 'stock': return {family: 'resource', resource: effect.unit.resource, production: false};
  case 'production': return {family: 'resource', resource: effect.unit.resource, production: true};
  case 'cards': return {family: 'cards'};
  }
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

/** The caption under a reading — WHICH question the number answers (English keys; `params` for the step). */
export function yieldCaptionOf(y: InfluenceYield): {key: string, params?: ReadonlyArray<string>} | undefined {
  switch (y.context) {
  // An effect that COUNTS the tableau is a preliminary reading of two things
  // that can still change before the enactment: it says so, conditionally.
  case 'estimate': return y.effect.count !== undefined ? {key: 'If enacted now'} : {key: 'By your current influence'};
  case 'forecast': return y.agendaStep === undefined ? {key: 'If you win the vote'} : {key: 'If you win — Agenda step ${0}', params: [String(y.agendaStep)]};
  case 'resolving': return y.skipped !== undefined ? {key: y.skipped} : {key: 'This payout'};
  case 'applied': return y.skipped !== undefined ? {key: y.skipped} : {key: 'Received'};
  case 'reference': return undefined;
  }
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
    // A counted term is the SERVER's count for this seat (number + cards). A
    // model that does not carry it gives no personal number — never an
    // invented zero.
    const count = effect.count === undefined ? undefined : countOf(seat.counts, effect.count.id);
    if (effect.count !== undefined && count === undefined) {
      out.push(referenceYield(effect));
      continue;
    }
    const counted = count === undefined ? undefined : {count: count.count, cards: count.cards, units: count.units};
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
export function enactedYieldsOf(resolution: IClientResolution, model: ParliamentModel | undefined, viewer: Color | undefined): Array<InfluenceYield> {
  const out: Array<InfluenceYield> = [];
  const outcomes = model?.phase?.outcomes ?? model?.lastPhase?.outcomes ?? [];
  for (const effect of resolution.scaled ?? []) {
    const applied = viewer === undefined ? undefined : outcomes.find((o) => o.player === viewer && o.effect === effect.id);
    // The RECORDED inputs travel as recorded (B, the counted cards, the sum
    // before the cap) — the past is never recomputed from today's tableau.
    const recorded = applied === undefined ? undefined :
      {count: applied.count, counted: applied.counted, countedUnits: applied.countedUnits, uncapped: applied.uncapped};
    if (applied !== undefined && applied.kind === 'skipped') {
      out.push({...fixedYield(effect, 'applied', applied.amount ?? 0, applied.influence, recorded), skipped: applied.reason ?? 'Skipped'});
    } else if (applied !== undefined && applied.amount !== undefined) {
      out.push(fixedYield(effect, 'applied', applied.amount, applied.influence, recorded));
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

/** The forecast note for a card resource with no holder («…would be forfeited»), named by resource where the copy exists. */
export function noRecipientForecastKey(resource: CardResource): string {
  return resource === CardResource.ANIMAL ? 'no eligible card — the animals would be forfeited' : 'no eligible card — the payout would be forfeited';
}

/** The SKIP reason for a card resource with no holder — the key the server's outcome record carries for the same case. */
export function noRecipientReasonKey(resource: CardResource): string {
  return resource === CardResource.ANIMAL ? 'No card can hold animals' : 'No card can hold this resource';
}

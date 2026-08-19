import {CardResource} from '@/common/CardResource';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {ClientCard} from '@/common/cards/ClientCard';
import {ICardRenderRoot} from '@/common/cards/render/Types';
import {Size} from '@/common/cards/render/Size';
import {Resource} from '@/common/Resource';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '@/common/automa/MarsBotCorpData';
import {CardModel} from '@/common/models/CardModel';
import {CardRenderer} from '@/server/cards/render/CardRenderer';
import {buildPremiumCardViewModel, PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {standardResourceIconUrl} from '@/client/components/premiumCard/premiumCardIcons';

/**
 * The MarsBot corporation's PREMIUM face view-model — the bot corp rendered
 * ONE-TO-ONE through the ordinary `.pcard` corporation template. What differs
 * from a human corporation is exactly what the printed cards differ in:
 *
 *  · the SHORT SYMBOLIC rules below the art are the BOT's boxes (authored
 *    here with the same `CardRenderer` DSL every card uses — the mechanics
 *    panel walk, icons and framing are byte-identical);
 *  · the expansion medallion is the MarsBot stamp ('automa' — a stylized
 *    «A», deliberately distinct from Ares);
 *  · the resource capsule (`.pcard__res`, the same bottom socket player
 *    cards use) counts the corp-card resource — Spire's science through the
 *    ordinary card-resource icon, Ecoline's PLANT through the standard
 *    plants icon (an `iconUrl` override — plants are not a card resource).
 *
 * Identity (title wordmark/art/lore) rides the ORIGINAL corporation's
 * CardName exactly as everywhere else. No human rule can leak: the render
 * data below is authored from the official bot cards (C01/C02/C03/C04/C45), never
 * read from the human manifest card.
 *
 * PURE (no Vue/DOM/i18n) — unit-tested under the server runner. The
 * `CardRenderer` import is the shared data-DSL (common types only).
 */

/** The symbolic rule rows of each official bot card (C01 / C02 / C03 / C04 / C45). */
function renderDataOf(id: MarsBotCorpId): ICardRenderRoot {
  switch (id) {
  case MarsBotCorpId.C01_CREDICOR:
    // EFFECT: when resolving a card costing 20+ M€, MarsBot gains 4 M€ —
    // the same visual shape the human CrediCor prints for its own ≥20 rule.
    return CardRenderer.builder((b) => {
      b.effect(undefined, (eb) => {
        eb.megacredits(20).asterix().startEffect.megacredits(4);
      });
    });
  case MarsBotCorpId.C02_ECOLINE:
    // BEFORE ACTION PHASE: Rapid Sprouting joins the action deck — the
    // named plate flowing into a card, the deck-join symbol.
    return CardRenderer.builder((b) => {
      b.action(undefined, (eb) => {
        eb.plate('Rapid Sprouting').startAction.cards(1);
      });
    });
  case MarsBotCorpId.C03_HELION:
    // SETUP: cubes on the tracks (the mat is where they live — the face
    // states the count); EFFECT: white cube → a card instead of the
    // temperature; black cube → +1 temperature.
    return CardRenderer.builder((b) => {
      b.effect(undefined, (eb) => {
        eb.text('◻', Size.SMALL, true).startEffect.cards(1);
      });
      b.effect(undefined, (eb) => {
        eb.text('◼', Size.SMALL, true).startEffect.temperature(1);
      });
    });
  case MarsBotCorpId.C04_INTERPLANETARY_CINEMATICS:
    // EFFECT: every advance of the building or event TRACK pays 2 M€ — drawn
    // with the tags that name those tracks, the shape a human card uses for
    // a per-tag payout.
    return CardRenderer.builder((b) => {
      b.effect(undefined, (eb) => {
        eb.tag(Tag.BUILDING).slash().tag(Tag.EVENT).startEffect.megacredits(2);
      });
    });
  case MarsBotCorpId.C45_SPIRE:
    return CardRenderer.builder((b) => {
      // EFFECT: a card with 2+ tags adds a science resource here — the
      // human Spire's own printed shape for the same rule.
      b.effect(undefined, (eb) => {
        eb.emptyTag(2).asterix().startEffect.resource(CardResource.SCIENCE);
      });
      // BEFORE ACTION PHASE: 10 science convert into a city + 1 TR.
      b.action(undefined, (eb) => {
        eb.resource(CardResource.SCIENCE, 10).startAction.city().tr(1);
      });
    });
  }
}

/** The corp-card resource socket type ('plant' is not a CardResource — the
 *  capsule shows the standard plants icon through the iconUrl override). */
function resourceTypeOf(id: MarsBotCorpId): CardResource | undefined {
  const resource = marsBotCorpInfo(id).resource;
  if (resource === undefined) {
    return undefined;
  }
  return resource === 'science' ? CardResource.SCIENCE : CardResource.RESOURCE_CUBE;
}

/** The ClientCard-shaped printed face of the BOT corporation (never the
 *  human manifest card — that one carries the human rules). */
function botClientCard(id: MarsBotCorpId): ClientCard {
  const info = marsBotCorpInfo(id);
  return {
    name: info.original,
    // The medallion is overridden to the 'automa' stamp after the build; the
    // module here only seeds the build (never rendered on the face).
    module: 'corpera',
    tags: info.startingTags,
    type: CardType.CORPORATION,
    metadata: {
      cardNumber: info.cardNumber,
      renderData: renderDataOf(id),
    },
    resourceType: resourceTypeOf(id),
    compatibility: [],
    hasAction: false,
  };
}

const vmCache = new Map<string, PremiumCardVM>();

/**
 * Build (and cache) the bot corporation's premium view-model. `resources` is
 * the live count ON the corporation card (Ecoline plant / Spire science).
 */
export function buildMarsBotCorpPremiumVm(id: MarsBotCorpId, resources: number): PremiumCardVM {
  const key = `${id}:${resources}`;
  const cached = vmCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const info = marsBotCorpInfo(id);
  const model: CardModel = {name: info.original, resources} as CardModel;
  const vm = buildPremiumCardViewModel(botClientCard(id), model);
  const result: PremiumCardVM = {
    ...vm,
    expansion: 'automa',
    resource: vm.resource === undefined ? undefined : {
      ...vm.resource,
      ...(info.resource === 'plant' ? {iconUrl: standardResourceIconUrl(Resource.PLANTS)} : {}),
    },
  };
  vmCache.set(key, result);
  return result;
}

/** The live CardModel the face host passes beside the vm (resource socket). */
export function marsBotCorpCardModel(id: MarsBotCorpId, resources: number): CardModel {
  return {name: marsBotCorpInfo(id).original, resources} as CardModel;
}

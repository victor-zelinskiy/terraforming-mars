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
import {all} from '@/server/cards/Options';
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
 * data below is authored from the official bot cards (C01–C21/C45), never
 * read from the human manifest card.
 *
 * PURE (no Vue/DOM/i18n) — unit-tested under the server runner. The
 * `CardRenderer` import is the shared data-DSL (common types only).
 */

/** The symbolic rule rows of each official bot card (C01–C21 / C45). */
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
  case MarsBotCorpId.C05_INVENTRIX:
    return CardRenderer.builder((b) => {
      // EFFECT: resolving a card that PRINTS A REQUIREMENT pays 2 M€ — the
      // card icon plus the asterisk that sends the reader to the rules row
      // (the same shape Credicor's cost condition uses).
      b.effect(undefined, (eb) => {
        eb.cards(1).asterix().startEffect.megacredits(2);
      });
      // BEFORE ACTION PHASE: Do It Right joins the action deck, forever.
      b.action(undefined, (eb) => {
        eb.plate('Do It Right').startAction.cards(1);
      });
    });
  case MarsBotCorpId.C06_MINING_GUILD:
    return CardRenderer.builder((b) => {
      // EFFECT, in one line: every full stack of M€ the bot earns through
      // this card advances the BUILDING track. The bank itself is the
      // resource capsule below; the asterisk sends the reader to the rules.
      b.effect(undefined, (eb) => {
        eb.megacredits(10).asterix().startEffect.tag(Tag.BUILDING);
      });
    });
  case MarsBotCorpId.C07_PHOBOLOG:
    return CardRenderer.builder((b) => {
      // EFFECT: a white cube on the space track draws a card from the bonus
      // deck — the deck this corporation seeded with space-tagged projects.
      b.effect(undefined, (eb) => {
        eb.text('◻', Size.SMALL, true).startEffect.cards(1).asterix();
      });
    });
  case MarsBotCorpId.C08_SATURN_SYSTEMS:
    return CardRenderer.builder((b) => {
      // EFFECT: any Jovian tag on the table (either seat, the asterisk says
      // so) pushes the EVENT track — drawn with the tag that names it.
      b.effect(undefined, (eb) => {
        eb.tag(Tag.JOVIAN, {all}).asterix().startEffect.tag(Tag.EVENT);
      });
    });
  case MarsBotCorpId.C09_TERACTOR:
    return CardRenderer.builder((b) => {
      // EFFECT: every advance of the EARTH track pays 2 M€ — the same shape
      // C04 uses for its two tracks, with the tag that names this one.
      b.effect(undefined, (eb) => {
        eb.tag(Tag.EARTH).startEffect.megacredits(2);
      });
    });
  case MarsBotCorpId.C10_THARSIS_REPUBLIC:
    return CardRenderer.builder((b) => {
      // EFFECT, both halves: a city ANY player founds pays 2 M€ (the human's
      // half), and the bot's own city pushes the event track.
      b.effect(undefined, (eb) => {
        eb.city({size: Size.SMALL, all}).startEffect.megacredits(2);
      });
      b.effect(undefined, (eb) => {
        eb.city({size: Size.SMALL}).startEffect.tag(Tag.EVENT);
      });
    });
  case MarsBotCorpId.C11_THORGATE:
    return CardRenderer.builder((b) => {
      // EFFECT: a white cube flips a card (its FIRST tag only — the asterisk
      // sends the reader to the rules) and then warms Mars a step.
      b.effect(undefined, (eb) => {
        eb.text('◻', Size.SMALL, true).startEffect.cards(1).asterix().temperature(1);
      });
    });
  case MarsBotCorpId.C12_UNMI:
    return CardRenderer.builder((b) => {
      // BEFORE ACTION PHASE: one EXTRA bonus card joins the action deck every
      // generation from the second on — a card flowing into a card.
      b.action(undefined, (eb) => {
        eb.cards(1).startAction.cards(2);
      });
      // Its own bonus card is a TR step.
      b.effect(undefined, (eb) => {
        eb.plate('Government Subsidy').startEffect.tr(1);
      });
    });
  case MarsBotCorpId.C13_CHEUNG_SHING_MARS:
    return CardRenderer.builder((b) => {
      // EFFECT: the silver cube the bot steps on becomes M€ at its own value.
      b.effect(undefined, (eb) => {
        eb.text('◼', Size.SMALL, true).startEffect.megacredits(5);
      });
    });
  case MarsBotCorpId.C14_POINT_LUNA:
    return CardRenderer.builder((b) => {
      // EFFECT: the white cube pushes whichever track is furthest behind (the
      // wild tag's own symbol), the black one pushes space.
      b.effect(undefined, (eb) => {
        eb.text('◻', Size.SMALL, true).startEffect.wild(1);
      });
      b.effect(undefined, (eb) => {
        eb.text('◼', Size.SMALL, true).startEffect.tag(Tag.SPACE);
      });
    });
  case MarsBotCorpId.C15_ROBINSON_INDUSTRIES:
    return CardRenderer.builder((b) => {
      // BEFORE ACTION PHASE: Diversification joins the action deck, forever —
      // the named plate flowing into a card, the deck-join symbol.
      b.action(undefined, (eb) => {
        eb.plate('Diversification').startAction.cards(1);
      });
      // What it does when it comes up: push whichever track lags furthest
      // behind (the wild tag's own symbol) and pay for the privilege.
      b.effect(undefined, (eb) => {
        eb.plate('Diversification').startEffect.wild(1).megacredits(-4);
      });
    });
  case MarsBotCorpId.C16_VALLEY_TRUST:
    return CardRenderer.builder((b) => {
      // EFFECT: a white cube on the science track flips a free project — the
      // whole card is science, and the research pays in cards.
      b.effect(undefined, (eb) => {
        eb.text('◻', Size.SMALL, true).startEffect.cards(1);
      });
    });
  case MarsBotCorpId.C17_VITOR:
    return CardRenderer.builder((b) => {
      // EFFECT: every project that SCORES pays 3 M€. Drawn with the
      // card-plus-asterisk shape C01/C05 use for a conditional toll, NOT with
      // `vpIcon()`: the premium renderer degrades a VP item to a bare '?'
      // glyph (`premiumCardIcons.mechItemIcon`), which is the wild tag's own
      // symbol — the row would read as «any tag», and the exact condition is
      // one asterisk away in the «§ ПРАВИЛА» panel.
      b.effect(undefined, (eb) => {
        eb.cards(1).asterix().startEffect.megacredits(3);
      });
      // BEFORE ACTION PHASE: Overachievement joins the action deck, generation
      // after generation, until it finally claims something.
      b.action(undefined, (eb) => {
        eb.plate('Overachievement').startAction.cards(1);
      });
    });
  case MarsBotCorpId.C18_ARCADIAN_COMMUNITIES:
    return CardRenderer.builder((b) => {
      // EFFECT: building on an area its OWN marker reserved pays 3 M€ — the
      // very shape the human card prints, because it is the very same rule.
      b.effect(undefined, (eb) => {
        eb.emptyTile().startEffect.megacredits(3);
      });
      // BEFORE ACTION PHASE: Settlers joins the deck and claims another area —
      // the community cube the board itself paints for a claim.
      b.action(undefined, (eb) => {
        eb.plate('Settlers').startAction.community();
      });
    });
  case MarsBotCorpId.C19_ASTRO_DRILL:
    return CardRenderer.builder((b) => {
      // The same two rows C14 draws for the same printed effect: the white
      // cube pushes whatever lags furthest behind (the wild tag's own
      // symbol), the black one drives space — its own track.
      b.effect(undefined, (eb) => {
        eb.text('◻', Size.SMALL, true).startEffect.wild(1);
      });
      b.effect(undefined, (eb) => {
        eb.text('◼', Size.SMALL, true).startEffect.tag(Tag.SPACE);
      });
    });
  case MarsBotCorpId.C20_FACTORUM:
    return CardRenderer.builder((b) => {
      // EFFECT: every advance of the BUILDING track puts 1 M€ on this card —
      // the asterisk says «on the card», and the capsule below counts it.
      b.effect(undefined, (eb) => {
        eb.tag(Tag.BUILDING).startEffect.megacredits(1).asterix();
      });
      // BEFORE ACTION PHASE: Supply and Demand cashes the card out.
      b.action(undefined, (eb) => {
        eb.plate('Supply and Demand').startAction.megacredits(3);
      });
    });
  case MarsBotCorpId.C21_PHARMACY_UNION:
    return CardRenderer.builder((b) => {
      // EFFECT, both halves — the card points both ways: any microbe tag the
      // OPPONENT plays taxes the bot, its own science pays it in TR.
      b.effect(undefined, (eb) => {
        eb.tag(Tag.MICROBE, {all}).startEffect.megacredits(-4);
      });
      b.effect(undefined, (eb) => {
        eb.tag(Tag.SCIENCE).startEffect.tr(1);
      });
    });
  case MarsBotCorpId.C22_PHILARES:
    return CardRenderer.builder((b) => {
      // EFFECT, first half — the HUMAN Philares' own printed shape for the
      // identical sentence (two small tiles, one theirs, one not), with the
      // bot's science on the card where the human takes a wild resource.
      b.effect(undefined, (eb) => {
        eb.emptyTile('normal', {size: Size.SMALL, all}).nbsp;
        eb.emptyTile('normal', {size: Size.SMALL}).startEffect.resource(CardResource.SCIENCE);
      });
      // EFFECT, second half: 4 of that science buys ONE track advance — the
      // wild tag is this face's established «a track» symbol (C14/C15/C19),
      // and the asterisk says «not just any one»: the exact target (the
      // most-advanced unfinished track) is one panel away in «§ ПРАВИЛА».
      b.effect(undefined, (eb) => {
        eb.resource(CardResource.SCIENCE, 4).startEffect.wild(1).asterix();
      });
      // What its OWN bonus card does when it comes up: a city planted against
      // the opponent's greenery, paid for — a border, bought.
      b.effect(undefined, (eb) => {
        eb.plate('Build Build Build').startEffect.city().megacredits(-5);
      });
    });
  case MarsBotCorpId.C23_RECYCLON:
    return CardRenderer.builder((b) => {
      // EFFECT: one row, because the card is one rule — the white cube its
      // building track reaches pushes the PLANT track. The same cube → named
      // track shape C14/C19 draw for their black cubes.
      b.effect(undefined, (eb) => {
        eb.text('◻', Size.SMALL, true).startEffect.tag(Tag.PLANT);
      });
    });
  case MarsBotCorpId.C24_SPLICE:
    return CardRenderer.builder((b) => {
      // EFFECT, first half — the HUMAN Splice's own printed shape for the
      // identical sentence: an opponent's microbe tag pays the bot, and the
      // opponent takes M€ or a microbe on the card they just played.
      b.effect(undefined, (eb) => {
        eb.tag(Tag.MICROBE, {all}).startEffect.megacredits(2);
        eb.nbsp.megacredits(2, {all}).or().resource(CardResource.MICROBE, {all}).asterix();
      });
      // EFFECT, second half: the bot's OWN microbe tag pays it double.
      b.effect(undefined, (eb) => {
        eb.tag(Tag.MICROBE).startEffect.megacredits(4);
      });
    });
  case MarsBotCorpId.C25_VIRON:
    return CardRenderer.builder((b) => {
      // EFFECT: a blue card with a red arrow — drawn the way the game draws
      // that very thing (the ACTIVE card's own arrow) — pays a floater, and
      // the same card is worth a point at the end.
      b.effect(undefined, (eb) => {
        eb.cards(1).asterix().startEffect.resource(CardResource.FLOATER);
      });
      b.effect(undefined, (eb) => {
        eb.cards(1).asterix().startEffect.text('VP', Size.SMALL, true);
      });
    });
  case MarsBotCorpId.C26_CELESTIC:
    return CardRenderer.builder((b) => {
      // EFFECT: a Failed Action — the bot's own stuck turn, drawn as the
      // consolation M€ it always pays — now also hands it a floater.
      b.effect(undefined, (eb) => {
        eb.megacredits(5).asterix().startEffect.resource(CardResource.FLOATER);
      });
      // ROUND START: one more, every generation, whatever happened.
      b.action(undefined, (eb) => {
        eb.text('↻', Size.SMALL, true).startAction.resource(CardResource.FLOATER);
      });
    });
  case MarsBotCorpId.C27_MORNING_STAR:
    return CardRenderer.builder((b) => {
      // EFFECT: C13's row for C13's sentence — the silver cube the bot steps
      // on becomes M€ at its own value.
      b.effect(undefined, (eb) => {
        eb.text('◼', Size.SMALL, true).startEffect.megacredits(5);
      });
      // What its OWN bonus card does when it comes up: Venus, then Mars.
      b.effect(undefined, (eb) => {
        eb.plate('Venusian Lobby').startEffect.venus(1).asterix();
      });
    });
  case MarsBotCorpId.C28_APHRODITE:
    return CardRenderer.builder((b) => {
      // EFFECT: the HUMAN Aphrodite's own printed row for the identical rule
      // — a Venus step raised by ANYONE pays 2 M€.
      b.effect(undefined, (eb) => {
        eb.venus(1, {all}).startEffect.megacredits(2);
      });
    });
  case MarsBotCorpId.C29_MANUTECH:
    return CardRenderer.builder((b) => {
      // EFFECT: a track reaching a cube-marked column takes ONE MORE space.
      // The black cube is this face's established «the reminder on the mat»
      // symbol (C03/C13/C14/C19) and the wild tag its established «a track»
      // symbol (C14/C15/C19/C22); the asterisk says «not just anywhere» —
      // WHICH columns is one panel away in «§ ПРАВИЛА».
      b.effect(undefined, (eb) => {
        eb.text('◼', Size.SMALL, true).startEffect.wild(1).asterix();
      });
    });
  case MarsBotCorpId.C30_ARIDOR:
    return CardRenderer.builder((b) => {
      // SETUP: one more colony tile joins the game — the human Aridor's own
      // printed symbol for the very same sentence, in the same bare row it
      // draws it in. Not an effect row: nothing triggers it.
      b.colonyTile();
      // EFFECT: EITHER cube pays the same track — ONE row with both swatches,
      // in the cube → named track shape C14/C19/C23 draw. Two rows here would
      // state a difference the card does not print.
      b.effect(undefined, (eb) => {
        eb.text('◻', Size.SMALL, true).slash().text('◼', Size.SMALL, true)
          .startEffect.tag(Tag.EVENT);
      });
    });
  case MarsBotCorpId.C31_ARKLIGHT:
    return CardRenderer.builder((b) => {
      // EFFECT: the two tags that pay, in C04's own tag/tag → M€ shape. The
      // third tag of that same mat row is the one the card excludes, and the
      // exclusion lives in «§ ПРАВИЛА» — a crossed-out microbe here would read
      // as «lose something» in this icon language.
      b.effect(undefined, (eb) => {
        eb.tag(Tag.ANIMAL).slash().tag(Tag.PLANT).startEffect.megacredits(2);
      });
    });
  case MarsBotCorpId.C32_POLYPHEMOS:
    return CardRenderer.builder((b) => {
      // SETUP: the opening gift, in the bare row C09 Teractor's own 25 M€
      // would draw — nothing triggers it.
      b.megacredits(25);
      // BEFORE ACTION PHASE: one card leaves the deck every generation. The
      // asterisk is the condition — WHICH card is one panel away in «§ ПРАВИЛА».
      b.action(undefined, (eb) => {
        eb.text('↻', Size.SMALL, true).startAction.minus().cards(1).asterix();
      });
    });
  case MarsBotCorpId.C33_POSEIDON:
    return CardRenderer.builder((b) => {
      // SETUP: it opens by founding one, in the bare row the human Aridor
      // uses for its own colony tile — nothing triggers it.
      b.colonies(1);
      // EFFECT: a colony built by ANYONE (the red «all» border) moves a track.
      // The wild tag is this face's established «a track» symbol (C14/C15/
      // C19/C22); the asterisk says «not just any one» — WHICH track is one
      // panel away in «§ ПРАВИЛА».
      b.effect(undefined, (eb) => {
        eb.colonies(1, {all}).startEffect.wild(1).asterix();
      });
    });
  case MarsBotCorpId.C34_STORMCRAFT:
    return CardRenderer.builder((b) => {
      // EFFECT: the floaters it spends come back as heat — the card's whole
      // loop in one row, in the resource → parameter shape a human card uses.
      b.effect(undefined, (eb) => {
        eb.resource(CardResource.FLOATER, 5).startEffect.temperature(1);
      });
      // ROUND START: one more floater, every generation, whatever happened —
      // the same recurring plate C26 draws for the same printed sentence.
      b.action(undefined, (eb) => {
        eb.text('↻', Size.SMALL, true).startAction.resource(CardResource.FLOATER);
      });
    });
  case MarsBotCorpId.C35_LAKEFRONT_RESORTS:
    return CardRenderer.builder((b) => {
      // EFFECT, the flip — two rows, because the card really is two outcomes
      // and which one happens is the state of the cube. An ocean by ANYONE
      // (`all`) either arms the card…
      b.effect(undefined, (eb) => {
        eb.oceans(1, {size: Size.SMALL, all}).startEffect.resource(CardResource.RESOURCE_CUBE);
      });
      // …or spends that cube for a building-track step.
      b.effect(undefined, (eb) => {
        eb.resource(CardResource.RESOURCE_CUBE).startEffect.tag(Tag.BUILDING);
      });
      // The standing rate, in the HUMAN Lakefront Resorts' own printed shape
      // for the identical sentence: a tile beside an ocean pays 3 M€.
      b.effect(undefined, (eb) => {
        eb.emptyTile('normal', {size: Size.SMALL}).oceans(1, {size: Size.SMALL}).startEffect.megacredits(3);
      });
    });
  case MarsBotCorpId.C46_TYCHO_MAGNETICS:
    return CardRenderer.builder((b) => {
      // The whole corporation is ONE card waiting at the bottom of the bonus
      // deck — the named plate flowing into cards, the deck-join symbol this
      // face uses for every corp-owned card (C02/C15/C17).
      b.action(undefined, (eb) => {
        eb.plate('Interface Hyperlink').startAction.cards(2).asterix();
      });
      // What it does when it finally comes up: the power track's own space
      // number is the draw, and two of them are played.
      b.effect(undefined, (eb) => {
        eb.tag(Tag.POWER).startEffect.cards(1).asterix();
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
      ...(info.resource === 'megacredits' ? {iconUrl: standardResourceIconUrl(Resource.MEGACREDITS)} : {}),
    },
  };
  vmCache.set(key, result);
  return result;
}

/** The live CardModel the face host passes beside the vm (resource socket). */
export function marsBotCorpCardModel(id: MarsBotCorpId, resources: number): CardModel {
  return {name: marsBotCorpInfo(id).original, resources} as CardModel;
}

import {expect} from 'chai';
import {BackroomDeal, DISCOUNT, VICTORY_POINTS} from '../../../src/server/cards/turmoilRedux/BackroomDeal';
import {ICard} from '../../../src/server/cards/ICard';
import {CuttingEdgeDesign} from '../../../src/server/cards/turmoilRedux/CuttingEdgeDesign';
import {MartianCensus} from '../../../src/server/cards/turmoilRedux/MartianCensus';
import {TheDeimosGroup} from '../../../src/server/cards/turmoilRedux/TheDeimosGroup';
import {PartySanctions} from '../../../src/server/cards/turmoilRedux/PartySanctions';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {GlobalParameter} from '../../../src/common/GlobalParameter';
import {RequirementType} from '../../../src/common/cards/RequirementType';
import {CardRenderItemType} from '../../../src/common/cards/render/CardRenderItemType';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {armedPlayEffectsOf} from '../../../src/server/cards/armedPlayEffects';
import {requirementEasingOf} from '../../../src/server/models/requirementEasing';
import {armedPlayForecastOf} from '../../../src/server/models/armedPlayForecast';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {Server} from '../../../src/server/models/ServerModel';
import {quietResolutionOf, seatEnacted} from '../../parliament/parliamentArrange';
import {runAllActions, setTemperature} from '../../TestingUtils';
import {LakeMarineris} from '../../../src/server/cards/base/LakeMarineris';
import {GeneRepair} from '../../../src/server/cards/base/GeneRepair';
import {Comet} from '../../../src/server/cards/base/Comet';
import {MediaGroup} from '../../../src/server/cards/base/MediaGroup';
import {PowerPlantStandardProject} from '../../../src/server/cards/base/standardProjects/PowerPlantStandardProject';
import {buildEventChildren} from '../../../src/client/components/journal/journalEventChild';

/**
 * TR70 — BACKROOM DEAL: the one-play class's first card arming TWO effects
 * (the PARTY-requirement waiver — the class's fourth kind — and a 10 M€
 * discount) for the price of 1 VP. Every rule reading of the card file's
 * header is pinned here on the real card: the price in VP (the rating never
 * touched), both arms, what the party waiver lifts and what
 * it never touches (a global requirement, a tag, the chairman, the party's
 * EFFECT), the discount's floor, the spend by any next card, the standard
 * project that spends nothing, the pass, the replacement either way against
 * TR49, the public model, the journal's party line, save / load.
 */
const ID = CardName.BACKROOM_DEAL;
const M = PartyName.MARS;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: BackroomDeal};

/** A two-seat Redux table in the action phase, the REDS ruling by an enacted card, the card in hand, 60 M€. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const parliament = game.parliament!;
  seatEnacted(parliament, quietResolutionOf(PartyName.REDS));
  const card = new BackroomDeal();
  player.cardsInHand.push(card);
  player.megaCredits = 60;
  return {game, player, opponent, parliament, card};
}

/** Play the card from hand (the arming play). */
function arm(t: Table): void {
  t.player.playCard(t.card, Payment.of({megacredits: 2}));
  runAllActions(t.game);
}

/** The next card with a PARTY requirement (Martian Census — Mars First's plate), in hand. */
function census(t: Table): MartianCensus {
  const card = new MartianCensus();
  t.player.cardsInHand.push(card);
  return card;
}

describe('BackroomDeal', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a red EVENT for 2, no tag, no requirement, −1 VP, TR70 — three declarations, in the Redux manifest without compatibility', () => {
      const c = t.card;
      expect(c.name).eq(ID);
      expect(c.type).eq(CardType.EVENT);
      expect(c.cost).eq(2);
      expect(c.tags).deep.eq([]);
      expect(c.requirements).deep.eq([]);
      expect(c.victoryPoints, 'the Mars disc «−1» is the VP badge').eq(VICTORY_POINTS);
      expect(VICTORY_POINTS).eq(-1);
      expect(c.metadata.cardNumber).eq('TR70');
      expect(c.behavior, 'the play itself moves nothing').is.undefined;
      expect(c.partyRequirementWaiver, 'the party family\'s waiver').deep.eq({nextCardOnly: true});
      expect(c.cardDiscount, 'Indentured Workers\' own declaration').deep.eq({amount: DISCOUNT, nextCardOnly: true});
      expect(c.globalParameterRequirementBonus, 'never the global kind').is.undefined;
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[ID];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility).is.undefined;
    });

    it('the face reads the scan: «NEXT CARD : [party plate ×] [−10 M€]» — the −1 is the VP badge, not a row item', () => {
      type Node = {is?: string, type?: string, amount?: number, cancelled?: true};
      const rows = (t.card.metadata.renderData as unknown as {rows: Array<Array<Node | string>>}).rows;
      expect(rows, 'one printed row').has.length(1);
      const items = rows[0].filter((n): n is Node => typeof n === 'object' && n.is === 'item');
      expect(items.map((n) => n.type), 'no TR item — the rating is never touched').deep.eq([CardRenderItemType.TEXT, CardRenderItemType.PARTY_REQUIREMENT, CardRenderItemType.MEGACREDITS]);
      expect(items[1].cancelled, 'the party plate is STRUCK — the one-play class\'s red diagonal').eq(true);
      expect(items[2].amount).eq(-DISCOUNT);
    });

    it('the structured text: the waiver, the discount — one block each, in the printed order; no rating line', () => {
      const info = buildCardInformation(t.card, 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks.map((b) => b.text)) ?? [];
      // A flat VP is the badge's own (no block — Indentured Workers / Bribed Committee alike).
      expect(blocks).deep.eq([
        'Ignore any party requirements on the next card you play this generation.',
        'The next card you play this generation costs 10 M€ less.',
      ]);
    });
  });

  describe('rule 1 — no requirement; an event', () => {
    it('playable with nothing to meet; into the events pile; Media Group pays the event', () => {
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
      t.player.playedCards.push(new MediaGroup());
      const mc = t.player.megaCredits;
      arm(t);
      expect(t.player.playedCards.has(ID), 'into the events pile').is.true;
      expect(t.player.megaCredits, 'the price, then the 3 of Media Group').eq(mc - 2 + 3);
    });
  });

  describe('rule 3 — the price is −1 VP, the rating untouched', () => {
    it('the play changes no rating and writes no rating line; the Reds have nothing to tax', () => {
      const tr = t.player.terraformRating;
      const mc = t.player.megaCredits;
      arm(t);
      expect(t.player.terraformRating, 'the Mars disc is a VP badge, never a rating').eq(tr);
      expect(t.player.megaCredits, 'the price alone').eq(mc - 2);
      expect(t.game.gameLog.some((m) => m.message === '${0} lost ${1} TR'), 'no rating loss').is.false;
      expect(t.game.events.events.some((e) => e.type === 'tr-changed' && e.player === t.player.color), 'no rating delta').is.false;
    });

    it('−1 VP at the end of the game — the card\'s own row of the breakdown', () => {
      arm(t);
      expect(t.card.getVictoryPoints(t.player)).eq(VICTORY_POINTS);
      const row = t.player.getVictoryPoints().detailsCards.find((d) => d.cardName === ID);
      expect(row?.victoryPoint).eq(VICTORY_POINTS);
    });

    it('no gate: at 0 TR the card is playable and the rating stays where it was', () => {
      t.player.setTerraformRating(0);
      expect(t.player.canPlay(t.card)).is.true;
      arm(t);
      expect(t.player.terraformRating).eq(0);
    });
  });

  describe('rule 4 — the play ARMS two effects at once, in the printed order', () => {
    it('lastCardPlayed names the card; the public reading holds the party waiver, then the discount', () => {
      arm(t);
      expect(t.player.lastCardPlayed).eq(ID);
      expect(armedPlayEffectsOf(t.player)).deep.eq([
        {source: ID, sourceType: CardType.EVENT, effect: {kind: 'partyWaiver'}, expires: 'next-play'},
        {source: ID, sourceType: CardType.EVENT, effect: {kind: 'discount', amount: DISCOUNT}, expires: 'next-play'},
      ]);
      expect(t.player.partyRequirementWaiver()).deep.eq({kind: 'card', card: ID, owner: t.player.color});
      expect(t.player.globalRequirementWaiver(GlobalParameter.TEMPERATURE), 'never the global kind').is.undefined;
    });
  });

  describe('rule 6 — the PARTY waiver lifts a party requirement, and nothing else', () => {
    it('Martian Census with Mars First out of power and 0 delegates: refused before, playable while armed — decisive', () => {
      const card = census(t);
      expect(t.player.canPlay(card)).is.false;
      expect(unplayableReasons(t.player, card)[0]).deep.include({type: 'party', message: PARTY_REQUIREMENT_REASON, party: M, current: 0});
      expect(requirementEasingOf(t.player, card), 'nothing to say before the arm').deep.eq([]);
      arm(t);
      expect(t.player.canPlay(card)).is.true;
      expect(unplayableReasons(t.player, card)).deep.eq([]);
      const [easing] = requirementEasingOf(t.player, card);
      expect(easing).deep.include({type: RequirementType.PARTY, party: M, effective: 'waived', printed: 2, current: 0, met: true, decisive: true, max: false});
      expect(easing.parameter).is.undefined;
      expect(easing.sources).deep.eq([{source: {kind: 'card', card: ID, owner: t.player.color}, kind: 'waive', oneShot: true}]);
    });

    it('the OWN hand carries the reading; the play\'s forecast says the waiver is USED', () => {
      const card = census(t);
      arm(t);
      const hand = Server.getPlayerModel(t.player).cardsInHand.find((c) => c.name === CardName.MARTIAN_CENSUS)!;
      expect(hand.requirementEasing?.[0]).deep.include({party: M, effective: 'waived', decisive: true});
      const forecast = armedPlayForecastOf(t.player, card)!;
      expect(forecast.consumes.map((c) => [c.armed.effect.kind, c.used])).deep.eq([['partyWaiver', true], ['discount', true]]);
    });

    it('met ANYWAY (Mars First ruling) is not decisive, and the waiver is still spent', () => {
      seatEnacted(t.parliament, quietResolutionOf(M));
      const card = census(t);
      arm(t);
      const [easing] = requirementEasingOf(t.player, card);
      expect(easing.decisive).is.false;
      expect(easing.met).is.true;
    });

    it('NOT lifted: a global requirement (Lake Marineris at −30 °C), a tag (Gene Repair), the chairman (Party Sanctions)', () => {
      setTemperature(t.game, -30);
      arm(t);
      expect(t.player.canPlay(new LakeMarineris())).is.false;
      expect(unplayableReasons(t.player, new LakeMarineris()).some((r) => r.type === 'globalParameter' || r.requirement === true)).is.true;
      expect(requirementEasingOf(t.player, new LakeMarineris()), 'no easing of the global kind').deep.eq([]);
      expect(t.player.canPlay(new GeneRepair())).is.false;
      expect(unplayableReasons(t.player, new GeneRepair()).some((r) => r.type === 'tag')).is.true;
      expect(t.player.canPlay(new PartySanctions()), 'the chairman is not a party').is.false;
    });

    it('the party\'s EFFECT is not granted by the waiver (TR36\'s law in the mirror)', () => {
      arm(t);
      expect(t.parliament.access(t.player, M).hasEffect).is.false;
      expect(t.parliament.satisfiesPartyRequirement(t.player, M), 'the Parliament\'s own reading stays unmet').is.false;
    });
  });

  describe('rule 6b — beside a STANDING waiver (TR83 The Deimos Group) the standing one is named', () => {
    it('Deimos on the table + this card armed: the lift is the corporation’s, oneShot false; the charge is spent all the same', () => {
      t.player.playCorporationCard(new TheDeimosGroup());
      arm(t);
      const card = census(t);
      expect(t.player.partyRequirementWaiver()).deep.eq({kind: 'corporation', card: CardName.THE_DEIMOS_GROUP, owner: t.player.color});
      expect(requirementEasingOf(t.player, card)[0].sources).deep.eq([
        {source: {kind: 'corporation', card: CardName.THE_DEIMOS_GROUP, owner: t.player.color}, kind: 'waive', oneShot: false},
      ]);
      expect(armedPlayEffectsOf(t.player).map((a) => a.effect.kind), 'the charge of this card is still armed — the truth about it').deep.eq(['partyWaiver', 'discount']);
    });
  });

  describe('rule 5 — the discount', () => {
    it('10 off the next card, the source named; a card cheaper than 10 spends all of it (floor 0)', () => {
      arm(t);
      const comet = new Comet();
      expect(t.player.getCardCost(comet)).eq(comet.cost - DISCOUNT);
      expect(t.player.getCardCostBreakdown(comet).discounts).deep.eq([{source: {kind: 'card', card: ID, owner: t.player.color}, amount: DISCOUNT}]);
      const cheap = new MartianCensus();
      expect(cheap.cost).is.lessThan(DISCOUNT);
      expect(t.player.getCardCost(cheap)).eq(0);
    });
  });

  describe('rule 4b — SPENT by the next card played, needed or not; a standard project spends nothing; the pass loses both', () => {
    it('the next card with a party requirement goes through and spends BOTH; the journal names the party line and the saving', () => {
      const card = census(t);
      arm(t);
      t.player.playCard(card, Payment.of({megacredits: 0}));
      runAllActions(t.game);
      expect(armedPlayEffectsOf(t.player)).deep.eq([]);
      expect(t.player.partyRequirementWaiver()).is.undefined;
      expect(t.game.gameLog.some((m) => m.message === '${0} ignored the party requirement of ${1} thanks to ${2}')).is.true;
      expect(t.game.gameLog.some((m) => m.message === '${0} saved ${1} M€ playing with ${2}')).is.true;
      const event = t.game.events.events.find((e) => e.type === 'requirement-eased');
      expect(event?.source).deep.eq({kind: 'card', card: ID, owner: t.player.color});
      expect(event?.target).deep.eq({card: CardName.MARTIAN_CENSUS});
      expect(event?.impact.requirementEased).deep.eq({kind: 'waive', oneShot: true, requirements: [{type: RequirementType.PARTY, party: M, max: false, printed: 2, effective: 'waived'}]});
      // The journal's own row under the play names the party, not a scale.
      const root = event!.correlationId!;
      const rows = buildEventChildren(t.game.events.events.filter((e) => e.correlationId === root), root, t.player.color);
      const eased = rows.find((r) => r.eased !== undefined)?.eased;
      expect(eased?.requirements[0]).deep.eq({party: M, printed: 2, effective: 'waived', max: false});
    });

    it('a card that needs neither (Comet) spends both all the same', () => {
      arm(t);
      t.player.playCard(new Comet(), Payment.of({megacredits: 11}));
      runAllActions(t.game);
      expect(armedPlayEffectsOf(t.player)).deep.eq([]);
      expect(t.game.events.events.some((e) => e.type === 'requirement-eased'), 'nothing was lifted — no record').is.false;
    });

    it('a STANDARD PROJECT is no card play: both stand', () => {
      arm(t);
      new PowerPlantStandardProject().payAndExecute(t.player, Payment.of({megacredits: 11}));
      runAllActions(t.game);
      expect(t.player.lastCardPlayed).eq(ID);
      expect(armedPlayEffectsOf(t.player)).has.length(2);
    });

    it('the PASS loses both — they never cross into the next generation', () => {
      arm(t);
      t.player.pass();
      expect(armedPlayEffectsOf(t.player)).deep.eq([]);
      expect(t.player.partyRequirementWaiver()).is.undefined;
    });
  });

  describe('rule 4c — one armed card at a time, never a SUM of two sources', () => {
    it('this card after Cutting-Edge Design: the global waiver is spent on THIS play, the party waiver + discount armed', () => {
      seatEnacted(t.parliament, quietResolutionOf(PartyName.SCIENTISTS));
      const ced = new CuttingEdgeDesign();
      t.player.cardsInHand.push(ced);
      t.player.playCard(ced, Payment.of({megacredits: 2}));
      runAllActions(t.game);
      expect(armedPlayEffectsOf(t.player).map((e) => e.effect.kind)).deep.eq(['requirementWaiver']);
      arm(t);
      expect(armedPlayEffectsOf(t.player).map((e) => e.effect.kind)).deep.eq(['partyWaiver', 'discount']);
      expect(t.player.globalRequirementWaiver(GlobalParameter.OXYGEN)).is.undefined;
    });

    it('Cutting-Edge Design after this card: its own plate is lifted by the party waiver, both are spent, the global waiver armed', () => {
      arm(t);
      const ced = new CuttingEdgeDesign();
      t.player.cardsInHand.push(ced);
      expect(t.player.canPlay(ced), 'the Scientists do not rule — playable only thanks to the party waiver').is.true;
      expect(t.player.getCardCost(ced), 'the discount floors the price').eq(0);
      t.player.playCard(ced, Payment.of({megacredits: 0}));
      runAllActions(t.game);
      expect(armedPlayEffectsOf(t.player).map((e) => e.effect.kind)).deep.eq(['requirementWaiver']);
      expect(t.player.partyRequirementWaiver()).is.undefined;
    });
  });

  describe('rule 7 — the rival sees both armed effects on the seat\'s public model', () => {
    it('PublicPlayerModel.armedPlayEffects — both effects, on both seats\' views', () => {
      arm(t);
      const own = Server.getPlayerModel(t.player).players.find((p) => p.color === t.player.color)!;
      const seen = Server.getPlayerModel(t.opponent).players.find((p) => p.color === t.player.color)!;
      expect(own.armedPlayEffects).deep.eq(seen.armedPlayEffects);
      expect(seen.armedPlayEffects?.map((e) => e.effect.kind)).deep.eq(['partyWaiver', 'discount']);
    });
  });

  describe('rule 9 — never futile; save / load keeps both', () => {
    it('the preview is pure and the play is never futile', () => {
      const before = JSON.stringify(t.game.serialize());
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview).is.not.undefined;
      expect(JSON.stringify(t.game.serialize()), 'the preview mutates nothing').eq(before);
      expect((t.card as ICard).actionFutility, 'an EVENT has no action to be futile — the discount serves any next card').is.undefined;
    });

    it('both armed effects survive a reload', () => {
      arm(t);
      const loaded = Game.deserialize(structuredClone(t.game.serialize()));
      const player = loaded.getPlayerById(t.player.id);
      expect(armedPlayEffectsOf(player).map((e) => e.effect.kind)).deep.eq(['partyWaiver', 'discount']);
      expect(player.partyRequirementWaiver()).is.not.undefined;
      expect(player.canPlay(new MartianCensus())).is.true;
    });
  });
});

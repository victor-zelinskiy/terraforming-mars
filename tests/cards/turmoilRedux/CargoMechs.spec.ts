import {expect} from 'chai';
import {
  CARGO_MECHS_ADD_TITLE, CARGO_MECHS_NO_CANDIDATE, CARGO_MECHS_REPEAT_TITLE, CargoMechs, ENERGY_PER_MECH, MECHS_PER_REPEAT,
} from '../../../src/server/cards/turmoilRedux/CargoMechs';
import {ForestryMechs} from '../../../src/server/cards/turmoilRedux/ForestryMechs';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {ConstructionMechs} from '../../../src/server/cards/turmoilRedux/ConstructionMechs';
import {RestrictedArea} from '../../../src/server/cards/base/RestrictedArea';
import {Viron} from '../../../src/server/cards/venusNext/Viron';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {actionFutility} from '../../../src/server/models/actionFutility';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {holderActionGoodOf} from '../../../src/server/cards/holderActionGood';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {repeatableActionCards} from '../../../src/server/cards/repeatableActions';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {ICard} from '../../../src/server/cards/ICard';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {formatMessage, runAllActions} from '../../TestingUtils';

/**
 * TR61 — CARGO MECHS: the Industrialists' plate, the ninth mech holder, and
 * the FIFTH CONSUMER of the repeat-action mechanism. Every rule reading of the
 * card file's header is pinned here: the plate's two roads, the empty play,
 * A onto ANY holder (this card included, asked always), B as Viron's mechanism
 * word for word (the module's candidates, the structural marker, the mech as
 * the branch's price, the copied-action scope), the self-exclusion, the LOOP
 * GUARD driven in both directions on one table with Viron, the preview that
 * mirrors the action, the declared holder good, the payment lane, save / load.
 */
const I = PartyName.INDUSTRIALISTS;
const COST = 7;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: CargoMechs};

/** A two-seat Redux table in the action phase (generation 1: the Greens rule by the starting rule). */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
  game.phase = Phase.ACTION;
  const card = new CargoMechs();
  return {game, player, opponent, parliament: game.parliament!, card};
}

/** The Industrialists rule by an enacted card. */
function industrialistsRule(t: Table): Table {
  seatEnacted(t.parliament, quietResolutionOf(I));
  expect(t.parliament.rulingParty()).eq(I);
  return t;
}

/** `n` of `player`'s own cubes on the Industrialists' quiet resolution in slot 0. */
function industrialistCubes(t: Table, player: TestPlayer, n: number): void {
  let slot = t.parliament.slotOf(I);
  if (slot === undefined) {
    seatResolution(t.parliament, 0, quietResolutionOf(I));
    slot = t.parliament.slotOf(I)!;
  }
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

/** The card on the player's table with `mechs` here and the player at `energy`. */
function owned(t: Table, mechs: number, energy: number): Table {
  t.player.playedCards.push(t.card);
  t.card.resourceCount = mechs;
  t.player.energy = energy;
  return t;
}

/** A USED action of the player's that can act again now: Restricted Area (2 M€ → a card). */
function usedRestrictedArea(t: Table): RestrictedArea {
  const area = new RestrictedArea();
  t.player.playedCards.push(area);
  t.player.actionsThisGeneration.add(area.name);
  t.player.megaCredits = 10;
  return area;
}

describe('CargoMechs', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a blue card for 7, Building, a mech holder, no VP, no play block, the INDUSTRIALISTS\' plate, TR61 — in the Redux manifest without compatibility', () => {
      const card = t.card;
      expect(card.name).eq(CardName.CARGO_MECHS);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(COST);
      expect(card.tags).deep.eq([Tag.BUILDING]);
      expect(card.resourceType).eq(CardResource.MECH);
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(card.behavior, 'the play does nothing — an empty holder').is.undefined;
      expect(requiredPartyOf(card), 'the MIN plate holds the Industrialists\' emblem — a requirement, not a tag').eq(I);
      expect(card.requirements).has.length(1);
      expect(card.metadata.cardNumber).eq('TR61');
      expect(card.metadata.description).eq('Requires the Industrialists to be ruling or that you have 2 delegates there.');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[CardName.CARGO_MECHS];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left: the module is the gate').is.undefined;
      expect(ENERGY_PER_MECH).eq(1);
      expect(MECHS_PER_REPEAT).eq(1);
      expect(CARGO_MECHS_REPEAT_TITLE, 'B speaks Viron\'s key').eq('Perform again an action from a played card');
      expect(CARGO_MECHS_NO_CANDIDATE, 'B\'s reason is Viron\'s key').eq('No other action card to copy');
      expect((card as ICard).resourceRole, 'no delegate / trade role').is.undefined;
      expect((card as ICard).onCardPlayed, 'no trigger').is.undefined;
    });

    it('rule 9 — the holder\'s ACTION good: 1 mech → a REPEAT, declared once in the card file and read by the one helper', () => {
      expect(t.card.holderActionGood).deep.eq({spend: MECHS_PER_REPEAT, good: {kind: 'repeat'}});
      expect(holderActionGoodOf(t.card)).deep.eq({spend: 1, good: {kind: 'repeat'}});
    });

    it('the structured text prints the requirement and the two action rows, B with its short', () => {
      const info = buildCardInformation(t.card, 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks) ?? [];
      expect(blocks.map((b) => b.text)).deep.eq([
        'Requires Industrialists to be ruling or that you have 2 delegates on its resolution.',
        'Action: Pay 1 energy to add a mech resource to ANY card.',
        'Action: Spend 1 mech from here to use an action on one of your cards a second time this generation.',
      ]);
      expect(blocks.map((b) => [b.kind, b.short])).to.deep.include.members([
        ['action', 'Spend 1 mech to repeat a used action'],
      ]);
    });
  });

  describe('rule 1 — the requirement: the Industrialists rule, or 2 of your delegates on their resolution', () => {
    beforeEach(() => {
      t.player.cardsInHand.push(t.card);
      t.player.megaCredits = 20;
    });

    it('generation 1, nothing enacted (the Greens rule): «0 of 2» with the named reason; one cube: «1 of 2»; two: playable', () => {
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [I, '2'], party: I, current: 0, requirement: true, requirementKey: 'req:party',
      });
      industrialistCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: I, current: 1});
      industrialistCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.true;
    });

    it('the Industrialists ruling: playable with no delegate anywhere', () => {
      industrialistsRule(t);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never a REQUIREMENT\'s', () => {
      t.player.playedCards.push(new CouncilSeat());
      industrialistCubes(t, t.player, 1);
      expect(t.parliament.hasPartyEffect(t.player, I), 'the effect is the player\'s by the Seat').is.true;
      expect(t.player.canPlay(t.card), 'the requirement is still two').is.false;
    });

    it('checked at the PLAY only: on the table, the action works whoever rules', () => {
      owned(t, 0, 1);
      expect(t.parliament.rulingParty()).not.eq(I);
      expect(t.card.canAct(t.player)).is.true;
    });
  });

  describe('rule 2 — the play puts NOTHING on the card', () => {
    it('the cost is paid, the card enters with 0 mechs, nothing is asked', () => {
      industrialistsRule(t);
      t.player.cardsInHand.push(t.card);
      t.player.megaCredits = 20;
      t.player.playCard(t.card, Payment.of({megacredits: COST}));
      runAllActions(t.game);
      expect(t.player.megaCredits).eq(20 - COST);
      expect(t.player.playedCards.get(CardName.CARGO_MECHS)).eq(t.card);
      expect(t.card.resourceCount).eq(0);
      expect(t.player.getWaitingFor()).is.undefined;
    });

    it('the play preview promises no chip of its own', () => {
      industrialistsRule(t);
      t.player.cardsInHand.push(t.card);
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.branches[0].effects.find((e) => e.icon === 'mech')).is.undefined;
    });

    it('rule 10 — the Building tag opens the `constructionMechs` lane; the `mechs` lane (EVA, Space) stays shut', () => {
      t.player.cardsInHand.push(t.card);
      const options = t.player.paymentOptionsForCard(t.card);
      expect(options.constructionMechs).is.true;
      expect(options.mechs).is.false;
      const construction = new ConstructionMechs();
      construction.resourceCount = 2;
      t.player.playedCards.push(construction);
      expect(t.player.canAfford({cost: COST, constructionMechs: true}), 'two mechs are 10 M€ on a Building card').is.true;
    });
  });

  describe('rule 3 — A: 1 energy → a mech onto ANY own holder, this card included, asked ALWAYS', () => {
    it('this card the only holder: still a picker (one candidate), in the spend\'s own words — the energy leaves first, the mech lands after', () => {
      owned(t, 0, 1);
      expect(t.card.canAct(t.player)).is.true;
      // A alone is the whole action: no OrOptions, the pick is deferred.
      expect(t.card.action(t.player)).is.undefined;
      expect(t.player.energy, 'the price left at the press').eq(0);
      runAllActions(t.game);
      const pick = cast(t.player.popWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).deep.eq([CardName.CARGO_MECHS]);
      expect(pick.choiceContext?.source).deep.eq({kind: 'card', card: CardName.CARGO_MECHS});
      pick.cb([t.card]);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(1);
    });

    it('another mech holder of the player\'s (Forestry Mechs) is offered beside this card, and may take the mech', () => {
      owned(t, 0, 1);
      const forestry = new ForestryMechs();
      t.player.playedCards.push(forestry);
      t.card.action(t.player);
      runAllActions(t.game);
      const pick = cast(t.player.popWaitingFor(), SelectCard);
      expect(pick.cards.map((c) => c.name)).to.have.members([CardName.CARGO_MECHS, CardName.FORESTRY_MECHS]);
      pick.cb([forestry]);
      runAllActions(t.game);
      expect(forestry.resourceCount).eq(1);
      expect(t.card.resourceCount).eq(0);
    });

    it('no energy and no mech: unavailable, and the reason is the ENERGY (the declared order — A\'s first)', () => {
      owned(t, 0, 0);
      expect(t.card.canAct(t.player)).is.false;
      expect(t.card.actionUnavailableReason(t.player)).deep.include({type: 'resource', message: 'Not enough energy'});
      expect(actionUnavailableReasons(t.player, t.card)[0]).deep.include({message: 'Not enough energy'});
    });

    it('no energy, a mech here, nothing used this generation: both dead — still the energy first', () => {
      owned(t, 1, 0);
      expect(t.card.canAct(t.player)).is.false;
      expect(t.card.actionUnavailableReason(t.player)).deep.include({message: 'Not enough energy'});
    });
  });

  describe('rule 4 — B: 1 mech from here → repeat a used action, VIRON\'S MECHANISM word for word', () => {
    it('a mech here and a used action: B alone is the whole action — Viron\'s SelectCard, structurally marked, the candidates the module\'s', () => {
      owned(t, 1, 0);
      const area = usedRestrictedArea(t);
      expect(t.card.canAct(t.player)).is.true;
      const pick = cast(t.card.action(t.player), SelectCard);
      expect(pick.title).eq(CARGO_MECHS_REPEAT_TITLE);
      expect(pick.buttonLabel).eq('Take action');
      expect(pick.repeatActionPrompt, 'the structural repeat marker (never the title)').is.true;
      expect(pick.cards).deep.eq([area]);
      expect(pick.cards).deep.eq(repeatableActionCards(t.player, t.card));
    });

    it('the answer: the mech leaves FIRST as the branch\'s price (its own line), then the copy runs under the copied-action scope with Viron\'s log', () => {
      owned(t, 1, 0);
      const area = usedRestrictedArea(t);
      const hand = t.player.cardsInHand.length;
      const pick = cast(t.card.action(t.player), SelectCard);
      pick.cb([area]);
      runAllActions(t.game);
      expect(t.card.resourceCount, 'the mech paid').eq(0);
      expect(t.player.megaCredits, 'Restricted Area\'s own price').eq(8);
      expect(t.player.cardsInHand.length, 'Restricted Area\'s own card').eq(hand + 1);
      const logs = t.game.gameLog.map((m) => formatMessage(m));
      const priceAt = logs.findIndex((l) => l.includes('removed 1 resource(s)') && l.includes(CardName.CARGO_MECHS));
      const usedAt = logs.findIndex((l) => l.includes(`used ${CardName.RESTRICTED_AREA} action with ${CardName.CARGO_MECHS}`));
      expect(priceAt, 'the price line').is.greaterThan(-1);
      expect(usedAt, 'Viron\'s «used X action with Y» line').is.greaterThan(priceAt);
      const copied = t.game.events.events.find((e) => e.type === 'copied-action');
      expect(copied, 'the copied-action marker').is.not.undefined;
      expect(copied!.source).deep.eq({kind: 'card', card: CardName.CARGO_MECHS, owner: t.player.color});
      expect(copied!.target).deep.eq({card: CardName.RESTRICTED_AREA});
      expect(copied!.category).eq('copied-action');
      // Rule 7 — what the copy produced is attributed to THIS card's chain.
      const draw = t.game.events.events.find((e) => e.type === 'cards-drawn');
      expect(draw, 'the copied draw').is.not.undefined;
      expect(draw!.correlationId).eq(copied!.correlationId);
      expect(t.game.gameLog.find((m) => m.category === 'copied-action'), 'the group\'s head').is.not.undefined;
    });

    it('a mech gone between the ask and the answer: no copy and no charge', () => {
      owned(t, 1, 0);
      const area = usedRestrictedArea(t);
      const pick = cast(t.card.action(t.player), SelectCard);
      t.card.resourceCount = 0;
      expect(pick.cb([area])).is.undefined;
      runAllActions(t.game);
      expect(t.player.megaCredits, 'Restricted Area did not run').eq(10);
    });

    it('no mech here, a used action, energy for A: B is refused with «0 of 1 mech on this card» (PL-197), A stays live', () => {
      owned(t, 0, 1);
      usedRestrictedArea(t);
      expect(t.card.canAct(t.player)).is.true;
      const preview = actionPreview(t.player, t.card);
      expect(preview.branches[1].available).is.false;
      expect(preview.branches[1].unavailableReason).eq('${0} of ${1} {mech|mechs} on this card');
      expect(preview.branches[1].unavailableReasonParams).deep.eq(['0', '1']);
      expect(preview.branches[0].available).is.true;
      expect(preview.branches[0].index, 'the lone live branch auto-resolves').eq(-1);
    });

    it('a mech here, nothing used this generation, energy for A: B is refused with Viron\'s «No other action card to copy»', () => {
      owned(t, 1, 1);
      const preview = actionPreview(t.player, t.card);
      expect(preview.branches[1].available).is.false;
      expect(preview.branches[1].unavailableReason).eq(CARGO_MECHS_NO_CANDIDATE);
      // A used action that CANNOT act now (Restricted Area without the 2 M€) is no candidate either (the module's fourth condition).
      const area = usedRestrictedArea(t);
      t.player.megaCredits = 1;
      expect(repeatableActionCards(t.player, t.card)).deep.eq([]);
      t.player.megaCredits = 2;
      expect(repeatableActionCards(t.player, t.card)).deep.eq([area]);
    });

    it('both live: an OrOptions in the printed order (A, then B), marked as this card\'s effect choice; the preview\'s two branches index it', () => {
      owned(t, 1, 1);
      usedRestrictedArea(t);
      const or = cast(t.card.action(t.player), OrOptions);
      expect(or.options.map((o) => o.title)).deep.eq([CARGO_MECHS_ADD_TITLE, CARGO_MECHS_REPEAT_TITLE]);
      expect(or.choiceContext?.source).deep.eq({kind: 'card', card: CardName.CARGO_MECHS});
      expect(or.choiceContext?.mode).eq('effect-choice');
      const preview = actionPreview(t.player, t.card);
      expect(preview.kind).eq('bespoke');
      expect(preview.branches.map((b) => b.index)).deep.eq([0, 1]);
      expect(preview.branches.map((b) => b.available)).deep.eq([true, true]);
    });

    it('rule 5 — the card never repeats ITSELF: used, it is not among its own candidates', () => {
      owned(t, 1, 1);
      const area = usedRestrictedArea(t);
      t.player.actionsThisGeneration.add(t.card.name);
      expect(repeatableActionCards(t.player, t.card)).deep.eq([area]);
    });

    it('once used it leaves the playable actions until the next generation', () => {
      owned(t, 1, 1);
      usedRestrictedArea(t);
      t.player.actionsThisGeneration.add(t.card.name);
      expect(t.player.getPlayableActionCards().map((c) => c.name)).not.to.include(CardName.CARGO_MECHS);
    });
  });

  describe('rule 6 — the LOOP GUARD: Viron and Cargo Mechs on one table, both used', () => {
    function vironTable(): {viron: Viron, area: RestrictedArea} {
      const viron = new Viron();
      t.player.playedCards.push(viron);
      owned(t, 1, 0);
      const area = usedRestrictedArea(t);
      t.player.actionsThisGeneration.add(viron.name);
      t.player.actionsThisGeneration.add(t.card.name);
      return {viron, area};
    }

    it('`canAct` of BOTH terminates (the counter around every candidate read), and the lists are honest', () => {
      const {viron, area} = vironTable();
      expect(t.card.getCheckLoops(), 'transient, zero at rest').eq(0);
      expect(viron.canAct(t.player), 'Viron is used — never acts twice').is.false;
      expect(t.card.canAct(t.player), 'this card is used too (and has no energy for A), but B\'s road is still open').is.true;
      expect(t.card.getCheckLoops(), 'balanced after every read').eq(0);
      // Viron is used and cannot act → not a candidate of this card; Restricted Area is.
      expect(repeatableActionCards(t.player, t.card)).deep.eq([area]);
      // This card is used and CAN act → a candidate of Viron's (the module's reading, terminated by this card's counter).
      expect(repeatableActionCards(t.player, viron)).to.include(t.card);
    });

    it('the whole table\'s playable-action sweep terminates with both on it', () => {
      vironTable();
      t.player.actionsThisGeneration.delete(t.card.name);
      t.player.energy = 1;
      const names = t.player.getPlayableActionCards().map((c) => c.name);
      expect(names).to.include(CardName.CARGO_MECHS);
      expect(names).not.to.include(CardName.VIRON);
    });
  });

  describe('rule 8 — the preview mirrors the action', () => {
    it('A: the energy\'s stock cost, the mech\'s gain and the target step over the same candidates the action asks', () => {
      owned(t, 1, 1);
      const forestry = new ForestryMechs();
      t.player.playedCards.push(forestry);
      usedRestrictedArea(t);
      const preview = actionPreview(t.player, t.card);
      const a = preview.branches[0];
      expect(a.title).eq(CARGO_MECHS_ADD_TITLE);
      expect(a.effects[0]).deep.include({direction: 'cost', icon: 'energy', amount: 1, current: 1, resulting: 0});
      expect(a.effects[1]).deep.include({direction: 'gain', icon: 'mech', amount: 1});
      expect(a.steps).has.lengthOf(1);
      const step = a.steps[0];
      expect(step.kind).eq('input');
      if (step.kind !== 'input') {
        throw new Error('expected an input step');
      }
      expect(step.input.type).eq('card');
      const input = step.input as {cards: ReadonlyArray<{name: string}>};
      expect(input.cards.map((c) => c.name)).to.have.members([CardName.CARGO_MECHS, CardName.FORESTRY_MECHS]);
    });

    it('B: the mech\'s price off this card and Viron\'s repeat step (the console\'s door into the repeat pick)', () => {
      owned(t, 1, 1);
      const area = usedRestrictedArea(t);
      const preview = actionPreview(t.player, t.card);
      const b = preview.branches[1];
      expect(b.title).eq(CARGO_MECHS_REPEAT_TITLE);
      expect(b.effects[0]).deep.include({direction: 'cost', icon: 'mech', amount: 1, current: 1, resulting: 0});
      expect(b.steps).has.lengthOf(1);
      const step = b.steps[0];
      expect(step.kind).eq('input');
      if (step.kind !== 'input') {
        throw new Error('expected an input step');
      }
      expect(step.input.type).eq('card');
      expect(step.repeatAction, 'drives the repeat pick bridge').is.true;
      const input = step.input as {cards: ReadonlyArray<{name: string}>};
      expect(input.cards.map((c) => c.name)).deep.eq([area.name]);
    });

    it('neither variant is futile: the action is never «no effect»', () => {
      owned(t, 1, 1);
      usedRestrictedArea(t);
      expect(actionFutility(t.player, t.card)).is.undefined;
    });
  });

  describe('rule 11 — save / load', () => {
    it('the mech count and the used-action flag survive; the loop counter is not serialized', () => {
      owned(t, 1, 1);
      usedRestrictedArea(t);
      t.player.actionsThisGeneration.add(t.card.name);
      const copy = Game.deserialize(JSON.parse(JSON.stringify(t.game.serialize())));
      const player = copy.getPlayerById(t.player.id);
      const card = player.playedCards.get(CardName.CARGO_MECHS) as CargoMechs;
      expect(card.resourceCount).eq(1);
      expect(player.actionsThisGeneration.has(CardName.CARGO_MECHS)).is.true;
      expect(card.getCheckLoops()).eq(0);
      expect(card.canAct(player), 'the reloaded card still answers').is.true;
    });
  });
});

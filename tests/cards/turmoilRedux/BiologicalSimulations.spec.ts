import {expect} from 'chai';
import {BIO_TAGS, BiologicalSimulations, DATA_ON_PLAY, DATA_PER_ACTION, DATA_PER_TAG} from '../../../src/server/cards/turmoilRedux/BiologicalSimulations';
import {DATA_PER_SCIENCE_TAG, VectorComputations} from '../../../src/server/cards/turmoilRedux/VectorComputations';
import {CouncilSeat} from '../../../src/server/cards/turmoilRedux/CouncilSeat';
import {Decomposers} from '../../../src/server/cards/base/Decomposers';
import {Tardigrades} from '../../../src/server/cards/base/Tardigrades';
import {Pets} from '../../../src/server/cards/base/Pets';
import {PLUTO_REDUX_NO_DATA_HOLDER_REASON, PlutoRedux} from '../../../src/server/colonies/PlutoRedux';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {ParliamentHandler} from '../../../src/server/parliament/ParliamentHandler';
import {AutomaResolver} from '../../../src/server/automa/AutomaResolver';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {Resource} from '../../../src/common/Resource';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {Payment} from '../../../src/common/inputs/Payment';
import {CARD_FOR_SPENDABLE_RESOURCE, SPENDABLE_CARD_RESOURCES} from '../../../src/common/inputs/Spendable';
import {ALL_MODULE_MANIFESTS} from '../../../src/server/cards/AllManifests';
import {actionPreview} from '../../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../../src/server/models/actionUnavailableReasons';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForAction, effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {buildCardInformation} from '../../../src/server/tools/cardInfo/buildCardInformation';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {ICard} from '../../../src/server/cards/ICard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {cast} from '../../../src/common/utils/utils';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';
import {fakeCard, formatMessage, runAllActions} from '../../TestingUtils';

/**
 * TR38 — BIOLOGICAL SIMULATIONS: the set's FIRST plate of the Greens, a data
 * holder with a TWO-TAG trigger (the TR05 / Decomposers class) and the set's
 * first action that buys PRODUCTION with a stored resource — the step the
 * Greens' own passive answers. Every rule reading of the card file's header
 * is pinned here: what counts as a microbe or animal tag (each printed one,
 * an event's, a card with both — never a wild one, never an opponent's play,
 * never the card's own Science / Plant), the requirement's two roads (the
 * STARTING RULE included; TR36 does not help), the action with and without
 * the Greens' effect at the moment of the press, and the data as ordinary
 * data every other data-giver lands on.
 */
const G = PartyName.GREENS;
const COST = 7;

type Table = {game: IGame, player: TestPlayer, opponent: TestPlayer, parliament: Parliament, card: BiologicalSimulations};

/** A two-seat Redux table in the action phase: generation 1, nothing enacted — the Greens rule by the STARTING RULE. */
function table(): Table {
  const [game, player, opponent] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const card = new BiologicalSimulations();
  return {game, player, opponent, parliament: game.parliament!, card};
}

/** The Reds rule by an enacted card — the Greens' effect is nobody's by the ruling road. */
function redsRule(t: Table): Table {
  seatEnacted(t.parliament, quietResolutionOf(PartyName.REDS));
  expect(t.parliament.rulingParty()).eq(PartyName.REDS);
  return t;
}

/** `n` of `player`'s own cubes on the Greens' quiet resolution in slot 0 (the lobby's free one first, the rest from the reserve). */
function greensCubes(t: Table, player: TestPlayer, n: number): void {
  let slot = t.parliament.slotOf(G);
  if (slot === undefined) {
    seatResolution(t.parliament, 0, quietResolutionOf(G));
    slot = t.parliament.slotOf(G)!;
  }
  for (let i = 0; i < n; i++) {
    t.parliament.placeVote(player, slot, t.parliament.lobby.has(player.id) ? 'lobby' : 'reserve');
  }
}

function played(tags: Array<Tag>, type: CardType = CardType.AUTOMATED): IProjectCard {
  return fakeCard({tags, type});
}

function act(t: Table): void {
  const door = cast(t.player.playActionCard(), SelectCard);
  expect(door.cards.map((c) => c.name)).to.include(CardName.BIOLOGICAL_SIMULATIONS);
  door.cb([t.card]);
  runAllActions(t.game);
}

describe('BiologicalSimulations', () => {
  let t: Table;

  beforeEach(() => {
    t = table();
  });

  describe('the card as printed', () => {
    it('is a blue card for 7, Science + Plant, a data holder, no VP, the GREENS\' plate (the set\'s first), TR38 — in the Redux manifest without compatibility', () => {
      const card = t.card;
      expect(card.name).eq(CardName.BIOLOGICAL_SIMULATIONS);
      expect(card.type).eq(CardType.ACTIVE);
      expect(card.cost).eq(COST);
      expect(card.tags).deep.eq([Tag.SCIENCE, Tag.PLANT]);
      expect(card.resourceType).eq(CardResource.DATA);
      expect(card.victoryPoints, 'no VP badge').is.undefined;
      expect(requiredPartyOf(card), 'the MIN plate holds the Greens\' emblem — a requirement, not a tag').eq(G);
      expect(card.requirements).has.length(1);
      expect(card.metadata.cardNumber).eq('TR38');
      expect(card.metadata.description).eq('Requires the Greens to be ruling or that you have 2 delegates there. Add 2 data resources to this card.');
      const manifest = ALL_MODULE_MANIFESTS.find((m) => m.module === 'turmoilRedux')!;
      const entry = (manifest.projectCards as Record<string, {compatibility?: unknown}>)[CardName.BIOLOGICAL_SIMULATIONS];
      expect(entry, 'registered in the Redux manifest').is.not.undefined;
      expect(entry.compatibility, 'only the module\'s icon at the bottom left: the module is the gate').is.undefined;
      expect(DATA_ON_PLAY).eq(2);
      expect(DATA_PER_TAG).eq(1);
      expect(DATA_PER_ACTION).eq(2);
      expect(BIO_TAGS).deep.eq([Tag.MICROBE, Tag.ANIMAL]);
      // The live hook carries its forecast twin (the coverage guard's pair); no non-card hook (rule 4); plain storage (decision 4).
      expect(typeof card.onCardPlayed).eq('function');
      expect(typeof card.cardPlayedForecast).eq('function');
      expect((card as ICard).onNonCardTagAdded, 'no microbe / animal tag ever arrives without a card').is.undefined;
      expect((card as ICard).resourceRole, 'a plain data store — no claiming role').is.undefined;
    });

    it('the structured text prints the rule itself — the requirement line, the play, the effect, the action with their shorts', () => {
      const info = buildCardInformation(t.card, 'turmoilRedux');
      const blocks = info?.groups.flatMap((g) => g.blocks) ?? [];
      // The generator's order: the requirement, the action, the effect, the play's own line.
      expect(blocks.map((b) => b.text)).deep.eq([
        'Requires Greens to be ruling or that you have 2 delegates on its resolution.',
        'Action: Spend 2 data from here to increase your plant production 1 step.',
        'Effect: After you play a microbe or animal tag, add 1 data resource to this card.',
        'Add 2 data to this card.',
      ]);
      expect(blocks.map((b) => [b.kind, b.short])).to.deep.include.members([
        ['effect', 'Microbe or animal tag: +1 data here'],
        ['action', 'Spend 2 data for 1 plant production'],
      ]);
    });
  });

  describe('rule 1 — the requirement: the Greens rule (the starting rule counts), or 2 of your delegates on their resolution', () => {
    beforeEach(() => {
      t.player.cardsInHand.push(t.card);
      t.player.megaCredits = 20;
    });

    it('generation 1, nothing enacted: the Greens rule by the STARTING RULE — playable with no delegate anywhere', () => {
      expect(t.parliament.rulingParty()).eq(G);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('the Reds ruling: «0 of 2» with the named reason; one cube: «1 of 2»; two: playable', () => {
      redsRule(t);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [G, '2'], party: G, current: 0, requirement: true, requirementKey: 'req:party',
      });
      greensCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: G, current: 1});
      greensCubes(t, t.player, 1);
      expect(t.player.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.player, t.card)).deep.eq([]);
    });

    it('TR36 Council Seat lowers the EFFECT\'s threshold, never a REQUIREMENT\'s (FAQ p.19): with one cube the card still reads «1 of 2»', () => {
      redsRule(t);
      t.player.playedCards.push(new CouncilSeat());
      greensCubes(t, t.player, 1);
      expect(t.parliament.hasPartyEffect(t.player, G), 'the Greens\' EFFECT is the player\'s by the Seat').is.true;
      expect(t.player.canPlay(t.card), 'the requirement is still two').is.false;
      expect(unplayableReasons(t.player, t.card)[0]).deep.include({party: G, current: 1, params: [G, '2']});
    });
  });

  describe('rule 2 — the play: +2 data on THIS card and nothing else', () => {
    it('the cost is paid, the card is in the tableau with 2 data, nothing is asked; its own Science and Plant tags add nothing through the effect', () => {
      t.player.cardsInHand.push(t.card);
      t.player.megaCredits = 20;
      t.player.playCard(t.card, Payment.of({megacredits: COST}));
      runAllActions(t.game);
      expect(t.player.megaCredits).eq(20 - COST);
      expect(t.player.playedCards.get(CardName.BIOLOGICAL_SIMULATIONS)).eq(t.card);
      expect(t.card.resourceCount).eq(DATA_ON_PLAY);
      expect(t.player.getWaitingFor()).is.undefined;
    });

    it('the composer promises the two data as the card\'s own chip; the forecast names NO reaction of this card to its own play', () => {
      t.player.cardsInHand.push(t.card);
      const preview = cardPlayPreview(t.player, t.card);
      expect(preview.branches[0].effects.find((e) => e.icon === 'data')).deep.include({direction: 'gain', amount: DATA_ON_PLAY});
      const own = effectForecastForPlay(t.player, t.card, preview).facts.filter((f) => f.source.name === CardName.BIOLOGICAL_SIMULATIONS);
      expect(own).deep.eq([]);
    });
  });

  describe('rule 3 — the trigger: 1 data per microbe or animal tag YOU play', () => {
    beforeEach(() => {
      t.player.playedCards.push(t.card);
    });

    it('a microbe tag (Tardigrades) → 1; an animal tag (Pets) → 1', () => {
      t.player.playCard(new Tardigrades());
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(DATA_PER_TAG);
      t.player.playCard(new Pets());
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(2 * DATA_PER_TAG);
    });

    it('BY TAG: a card with a microbe AND an animal tag → 2; two microbe tags → 2', () => {
      t.player.playCard(played([Tag.MICROBE, Tag.ANIMAL]));
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(2);
      t.player.playCard(played([Tag.MICROBE, Tag.MICROBE]));
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(4);
    });

    it('a played EVENT\'s printed microbe tag counts — a play is a play', () => {
      t.player.playCard(played([Tag.MICROBE], CardType.EVENT));
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(DATA_PER_TAG);
    });

    it('never: a WILD tag, a Science / Plant / Building card, an OPPONENT\'s animal tag', () => {
      t.player.playCard(played([Tag.WILD]));
      t.player.playCard(played([Tag.SCIENCE, Tag.PLANT]));
      t.player.playCard(played([Tag.BUILDING]));
      t.opponent.playCard(played([Tag.ANIMAL, Tag.MICROBE]));
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(0);
    });

    it('rule 5 — the Scientists\' wild tag is a tag you HAVE, not one you play: the trigger never sees it', () => {
      t.parliament.grantPartyEffect(t.player, PartyName.SCIENTISTS, 'test');
      expect(t.player.tags.count(Tag.MICROBE), 'the wild tag answers a microbe count').eq(1);
      t.player.playCard(played([Tag.BUILDING]));
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(0);
    });

    it('rule 12 — the collection is LOGGED and RECORDED under the card\'s own effect scope, at once, nothing asked', () => {
      t.player.playCard(played([Tag.ANIMAL]));
      expect(t.card.resourceCount, 'at once — no deferred step').eq(DATA_PER_TAG);
      runAllActions(t.game);
      expect(t.player.getWaitingFor()).is.undefined;
      const lines = t.game.gameLog.map((m) => formatMessage(m));
      expect(lines.some((l) => /added 1 .*Biological Simulations/i.test(l)), lines.slice(-10).join('\n')).is.true;
      const events = t.game.events.events;
      const gains = events.filter((e) => e.type === 'card-resource-changed' && e.source?.kind === 'card' && e.source.card === CardName.BIOLOGICAL_SIMULATIONS);
      expect(gains.map((e) => e.impact.cardResources?.[0]?.amount)).deep.eq([DATA_PER_TAG]);
      expect(gains[0].impact.cardResources?.[0]?.cardResource).eq(CardResource.DATA);
      const triggers = events.filter((e) => e.type === 'effect-triggered' && e.source?.kind === 'card' && e.source.card === CardName.BIOLOGICAL_SIMULATIONS);
      expect(triggers.map((e) => e.trigger)).deep.eq(['card-played']);
    });
  });

  describe('the forecast twin — what the play preview promises', () => {
    function forecastOf(target: ICard) {
      return effectForecastForPlay(t.player, target, cardPlayPreview(t.player, target))
        .facts.filter((f) => f.source.name === CardName.BIOLOGICAL_SIMULATIONS);
    }

    beforeEach(() => {
      t.player.playedCards.push(t.card);
    });

    it('Tardigrades: ONE exact fact, «+1 data here (0 → 1)», the combined reason with the MICROBE as its tag', () => {
      const trigger = new Tardigrades();
      t.player.cardsInHand.push(trigger);
      const facts = forecastOf(trigger);
      expect(facts).has.length(1);
      expect(facts[0]).deep.include({certainty: 'exact', timing: 'immediate', recipient: {kind: 'you'}, reasonTag: Tag.MICROBE});
      expect(facts[0].reason).eq('You play a card with a microbe or animal tag');
      expect(facts[0].source).deep.include({kind: 'card', channel: 'card-played', owner: t.player.color});
      expect(facts[0].effects).has.length(1);
      expect(facts[0].effects[0]).deep.include({direction: 'gain', icon: 'data', amount: 1, current: 0, resulting: 1});
    });

    it('an animal card names the ANIMAL as its tag', () => {
      const trigger = new Pets();
      t.player.cardsInHand.push(trigger);
      expect(forecastOf(trigger)[0]).deep.include({reasonTag: Tag.ANIMAL});
    });

    it('a microbe AND an animal on 3 stored: «+2 (3 → 5)» — the SAME current the live hook adds to', () => {
      t.card.resourceCount = 3;
      const trigger = played([Tag.MICROBE, Tag.ANIMAL]);
      t.player.cardsInHand.push(trigger);
      const facts = forecastOf(trigger);
      expect(facts).has.length(1);
      expect(facts[0].effects[0]).deep.include({icon: 'data', amount: 2, current: 3, resulting: 5});
      t.player.playCard(trigger);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(5);
    });

    it('no microbe or animal tag, or a wild one: no fact', () => {
      for (const tags of [[Tag.BUILDING], [Tag.WILD], [Tag.SCIENCE, Tag.PLANT]]) {
        const trigger = played(tags);
        t.player.cardsInHand.push(trigger);
        expect(forecastOf(trigger), tags.join()).deep.eq([]);
      }
    });
  });

  describe('rules 6–7 — the action: 2 data from here → +1 plant production; the Greens answer it only if the effect is yours at the press', () => {
    beforeEach(() => {
      t.player.playedCards.push(t.card);
    });

    it('below 2 data the automatic reason names the resources on this card', () => {
      t.card.resourceCount = 1;
      expect(t.card.canAct(t.player)).is.false;
      expect(actionUnavailableReasons(t.player, t.card)).deep.eq([{type: 'count', message: 'Not enough resources on this card', current: 1}]);
    });

    it('the Greens ruling (the starting rule): 2 → 0 data, +1 plant production, +1 M€ production from the Greens; the use is spent for the generation; the journal reads spend · step · answer', () => {
      t.card.resourceCount = 3;
      const at = t.game.gameLog.length;
      expect(t.parliament.hasPartyEffect(t.player, G)).is.true;
      expect(t.card.canAct(t.player)).is.true;
      act(t);
      expect(t.card.resourceCount).eq(1);
      expect(t.player.production.plants).eq(1);
      expect(t.player.production.megacredits).eq(1);
      expect(t.player.actionsThisGeneration.has(CardName.BIOLOGICAL_SIMULATIONS), 'once per generation').is.true;
      expect(t.player.getWaitingFor(), 'nothing is asked').is.undefined;
      const lines = t.game.gameLog.slice(at).map((m) => formatMessage(m));
      const spend = lines.findIndex((l) => /removed 2 .*Biological Simulations|2 data.*Biological Simulations/i.test(l));
      const step = lines.findIndex((l) => /plant.*production|production.*plant/i.test(l));
      const greens = lines.findIndex((l) => /Greens/.test(l) && /production/i.test(l));
      expect(spend, lines.join('\n')).is.gte(0);
      expect(step, lines.join('\n')).is.gt(spend);
      expect(greens, lines.join('\n')).is.gt(step);
    });

    it('the Greens NOT ruling: two own cubes on their resolution open the effect — +1 M€ production; one cube does not; one cube WITH TR36 does', () => {
      for (const [cubes, seat, answer] of [[2, false, 1], [1, false, 0], [1, true, 1]] as const) {
        const u = redsRule(table());
        u.player.playedCards.push(u.card);
        u.card.resourceCount = 2;
        if (seat) {
          u.player.playedCards.push(new CouncilSeat());
        }
        greensCubes(u, u.player, cubes);
        expect(u.parliament.hasPartyEffect(u.player, G), `${cubes} cube(s), seat ${seat}`).eq(answer === 1);
        act(u);
        expect(u.card.resourceCount).eq(0);
        expect(u.player.production.plants, `${cubes} cube(s), seat ${seat}`).eq(1);
        expect(u.player.production.megacredits, `${cubes} cube(s), seat ${seat}`).eq(answer);
      }
    });

    it('the preview is DECLARATIVE: a «2 → 0 on this card» cost chip and a plant-production chip', () => {
      t.card.resourceCount = 2;
      const preview = actionPreview(t.player, t.card);
      expect(preview.kind).eq('declarative');
      if (preview.kind !== 'declarative') {
        return;
      }
      const effects = preview.branches[0].effects;
      expect(effects.find((e) => e.direction === 'cost')).deep.include({icon: 'data', amount: 2, current: 2, resulting: 0, note: 'on this card'});
      expect(effects.find((e) => e.direction === 'gain')).deep.include({icon: Resource.PLANTS, amount: 1, current: 0, resulting: 1, note: 'production'});
    });

    it('the forecast of the press names the Greens\' «+1 M€ production» while the effect is yours — and nothing when it is not', () => {
      t.card.resourceCount = 2;
      const facts = effectForecastForAction(t.player, t.card, actionPreview(t.player, t.card)).facts;
      // The fact's id is namespaced by its source («blue-Greens-greens-production»): read the tail.
      const greens = facts.find((f) => f.id?.endsWith('greens-production'));
      expect(greens, JSON.stringify(facts.map((f) => f.id))).is.not.undefined;
      expect(greens).deep.include({certainty: 'exact'});
      expect(greens?.source).deep.include({kind: 'party', name: G, channel: 'production-gain'});
      expect(greens?.effects[0]).deep.include({direction: 'gain', icon: Resource.MEGACREDITS, amount: 1, current: 0, resulting: 1, note: 'production'});

      const u = redsRule(table());
      u.player.playedCards.push(u.card);
      u.card.resourceCount = 2;
      const silent = effectForecastForAction(u.player, u.card, actionPreview(u.player, u.card)).facts;
      expect(silent.find((f) => f.id?.endsWith('greens-production'))).is.undefined;
    });
  });

  describe('rule 8 — the card\'s OWN tags wake its neighbours', () => {
    it('Science: TR05 takes 2 data; Plant: Decomposers takes a microbe — and this card takes nothing from itself', () => {
      const vector = new VectorComputations();
      const decomposers = new Decomposers();
      t.player.playedCards.push(vector, decomposers);
      t.player.cardsInHand.push(t.card);
      t.player.playCard(t.card);
      runAllActions(t.game);
      expect(vector.resourceCount).eq(DATA_PER_SCIENCE_TAG);
      expect(decomposers.resourceCount).eq(1);
      expect(t.card.resourceCount).eq(DATA_ON_PLAY);
    });
  });

  describe('rule 9 — a HOLDER of ordinary data', () => {
    it('the Scientists\' action offers this card and puts 2 data on it', () => {
      t.player.playedCards.push(t.card);
      t.parliament.grantPartyEffect(t.player, PartyName.SCIENTISTS, 'test');
      const action = ParliamentHandler.partyActionOptions(t.player).find((o) => (o as {partyActionPrompt?: {party: PartyName}}).partyActionPrompt?.party === PartyName.SCIENTISTS);
      const options = cast(action, OrOptions);
      const dataPick = cast(options.options[0], SelectCard);
      expect(dataPick.cards.map((c) => c.name)).deep.eq([CardName.BIOLOGICAL_SIMULATIONS]);
      options.process({type: 'or', index: 0, response: {type: 'card', cards: [t.card.name]}}, t.player);
      expect(t.card.resourceCount).eq(2);
    });

    it('the Pluto Redux trade: its data positions refuse a seat with no holder — and open with this card on the table', () => {
      const pluto = new PlutoRedux();
      expect(pluto.tradeIncomeBlockedReason(t.player, 0)).eq(PLUTO_REDUX_NO_DATA_HOLDER_REASON);
      t.player.playedCards.push(t.card);
      expect(pluto.tradeIncomeBlockedReason(t.player, 0)).is.undefined;
    });

    it('data are never a payment unit: no spendable names this card', () => {
      expect(SPENDABLE_CARD_RESOURCES as ReadonlyArray<string>).to.not.include('data');
      expect(Object.values(CARD_FOR_SPENDABLE_RESOURCE)).to.not.include(CardName.BIOLOGICAL_SIMULATIONS);
    });
  });

  describe('rule 11 — MarsBot', () => {
    it('the bot\'s own microbe tag is not a play of the owner: the human\'s card takes nothing', () => {
      const [game, human] = testAutomaGame({coloniesExtension: true, turmoilReduxExpansion: true});
      game.phase = Phase.ACTION;
      const card = new BiologicalSimulations();
      human.playedCards.push(card);
      AutomaResolver.resolveTag(game, Tag.MICROBE);
      runAllActions(game);
      expect(card.resourceCount).eq(0);
    });
  });

  describe('save / reload', () => {
    it('the stored data and the spent action survive serialization', () => {
      t.player.playedCards.push(t.card);
      t.card.resourceCount = 5;
      t.player.actionsThisGeneration.add(CardName.BIOLOGICAL_SIMULATIONS);
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const again = reloaded.getPlayerById(t.player.id);
      const card = again.playedCards.get(CardName.BIOLOGICAL_SIMULATIONS) as IProjectCard | undefined;
      expect(card?.resourceCount).eq(5);
      expect(again.actionsThisGeneration.has(CardName.BIOLOGICAL_SIMULATIONS)).is.true;
    });
  });
});

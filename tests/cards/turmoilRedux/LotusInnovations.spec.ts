import {expect} from 'chai';
import {GameCards} from '../../../src/server/GameCards';
import {
  LOTUS_DATA_PER_VP, LOTUS_FIRST_ACTION_TR, LOTUS_REASON, LotusInnovations,
} from '../../../src/server/cards/turmoilRedux/LotusInnovations';
import {ReleaseOfInertGases} from '../../../src/server/cards/base/ReleaseOfInertGases';
import {NitrogenRichAsteroid} from '../../../src/server/cards/base/NitrogenRichAsteroid';
import {IceAsteroid} from '../../../src/server/cards/base/IceAsteroid';
import {Research} from '../../../src/server/cards/base/Research';
import {SpinInducingAsteroid} from '../../../src/server/cards/venusNext/SpinInducingAsteroid';
import {AsteroidStandardProject} from '../../../src/server/cards/base/standardProjects/AsteroidStandardProject';
import {Arklight} from '../../../src/server/cards/colonies/Arklight';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {CardResource} from '../../../src/common/CardResource';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {TURMOIL_REDUX_NEW_CORPORATIONS, newCorporationCardNumber} from '../../../src/common/cards/turmoilReduxCorporations';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {SelectSpace} from '../../../src/server/inputs/SelectSpace';
import {ChairmanSeat} from '../../../src/server/parliament/quests/ChairmanSeat';
import {ReduxParty} from '../../../src/common/parliament/ParliamentTypes';
import {resolutionInstanceId} from '../../../src/common/parliament/ParliamentTypes';
import {UNMI_VETO_ID} from '../../../src/server/parliament/resolutions/reds/UnmiVeto';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {effectForecastForPlay} from '../../../src/server/models/effectForecast';
import {corpFirstActionPreview} from '../../../src/server/models/corpFirstActionPreview';
import {EffectForecastFact} from '../../../src/common/models/EffectForecastModel';
import {ICard} from '../../../src/server/cards/ICard';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {addOcean, runAllActions, setOxygenLevel, setVenusScaleLevel} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';
import {Payment} from '../../../src/common/inputs/Payment';

/**
 * TR81 — LOTUS INNOVATIONS: 46 M€, a Science tag; «as your first action, increase your TR 2 steps»; «after each time
 * you increase your TR by 1, including from this, add 1 data resource to this card»; «1 VP per 4 data resources here».
 * Every rule reading of the card file's header is pinned here.
 */
type Table = {game: IGame, player: TestPlayer, rival: TestPlayer, card: LotusInnovations};

function table(): Table {
  const [game, player, rival] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true, venusNextExtension: true});
  game.phase = Phase.ACTION;
  const card = new LotusInnovations();
  player.playedCards.push(card);
  player.megaCredits = 100;
  rival.megaCredits = 100;
  return {game, player, rival, card};
}

/** The fresh reaction records of `card` since `from` (the ring's `seq`). */
function recordsOf(game: IGame, from: number, card: CardName = CardName.LOTUS_INNOVATIONS) {
  return game.cardReactions.filter((r) => r.seq > from && r.card === card);
}

function lastSeq(game: IGame): number {
  return game.cardReactions.reduce((max, r) => Math.max(max, r.seq), 0);
}

function lotusFacts(player: TestPlayer, trigger: IProjectCard): Array<EffectForecastFact> {
  player.cardsInHand.push(trigger);
  const forecast = effectForecastForPlay(player, trigger, cardPlayPreview(player, trigger));
  return forecast.facts.filter((f) => f.source.name === CardName.LOTUS_INNOVATIONS);
}

describe('LotusInnovations', () => {
  describe('rule 0 — the card as printed', () => {
    it('a corporation for 46 M€, a Science tag, a data holder, 1 VP per 4 data, a first action — TR81, the fourth new corporation', () => {
      const card = new LotusInnovations();
      expect(card.type).eq(CardType.CORPORATION);
      expect(card.startingMegaCredits).eq(46);
      expect(card.tags).deep.eq([Tag.SCIENCE]);
      expect(card.resourceType).eq(CardResource.DATA);
      expect(card.victoryPoints).deep.eq({resourcesHere: {}, per: LOTUS_DATA_PER_VP});
      expect(card.initialActionText).eq('Increase your TR 2 steps');
      expect(card.firstAction).deep.eq({text: 'Increase your TR 2 steps', tr: LOTUS_FIRST_ACTION_TR});
      expect(card.metadata.cardNumber).eq('TR81');
      expect(card.metadata.reimplements).is.undefined;
      expect(newCorporationCardNumber(CardName.LOTUS_INNOVATIONS)).eq('TR81');
      expect(TURMOIL_REDUX_NEW_CORPORATIONS[3]).deep.include({name: 'Lotus Innovations', authored: CardName.LOTUS_INNOVATIONS});
      expect(Object.keys(TURMOIL_REDUX_CARD_MANIFEST.corporationCards)).to.include(CardName.LOTUS_INNOVATIONS);
    });

    it('the play: 46 M€, no production, the first action owed', () => {
      const [, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      const card = new LotusInnovations();
      player.playCorporationCard(card);
      expect(player.megaCredits).eq(46);
      expect([player.production.megacredits, player.production.steel, player.production.titanium, player.production.plants, player.production.energy, player.production.heat]).deep.eq([0, 0, 0, 0, 0, 0]);
      expect(player.pendingInitialActions.map((c) => c.name)).deep.eq([CardName.LOTUS_INNOVATIONS]);
    });
  });

  describe('rules 1 + 3 — the first action: +2 TR, «including from this» → 2 data', () => {
    it('taken through the marked prompt: one rating call of two steps, two data on the corporation, ONE record under the corporation\'s own action', () => {
      const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      const card = new LotusInnovations();
      player.playCorporationCard(card);
      game.phase = Phase.ACTION;
      const tr = player.terraformRating;
      const from = lastSeq(game);
      player.takeAction();
      const prompt = cast(player.getWaitingFor(), OrOptions);
      expect(prompt.startGamePrompt?.kind).eq('corporationInitialAction');
      player.process({type: 'or', index: 0, response: {type: 'option'}});
      runAllActions(game);
      expect(player.terraformRating).eq(tr + 2);
      expect(card.resourceCount).eq(2);
      const records = recordsOf(game, from);
      expect(records).to.have.lengthOf(1);
      expect(records[0]).deep.include({owner: player.color, kind: 'corporation', channel: 'tr-increase'});
      expect(records[0].impacts).deep.eq([{kind: 'card-resource', resource: CardResource.DATA, amount: 2, target: CardName.LOTUS_INNOVATIONS, to: player.color}]);
      expect(records[0].root.category, 'the first action\'s own scope').eq('corporation-action');
    });

    it('the first action\'s preview: the «+2 TR» chip and the corporation\'s own answer «+2 data» (declarative — never the fallback)', () => {
      const [, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      const card = new LotusInnovations();
      player.playCorporationCard(card);
      const preview = corpFirstActionPreview(player, card);
      expect(preview.kind).eq('declarative');
      expect(preview.branches[0].effects.map((e) => [e.icon, e.amount])).deep.eq([['tr', 2]]);
      const facts = preview.forecast?.facts.filter((f) => f.source.name === CardName.LOTUS_INNOVATIONS) ?? [];
      expect(facts).to.have.lengthOf(1);
      expect(facts[0].certainty).eq('exact');
      expect(facts[0].source).deep.eq({kind: 'corporation', name: CardName.LOTUS_INNOVATIONS, owner: player.color, channel: 'tr-increase', printedEffect: 0});
      expect(facts[0].effects.map((e) => [e.icon, e.amount, e.host])).deep.eq([['data', 2, CardName.LOTUS_INNOVATIONS]]);
    });
  });

  describe('rule 2 — every step of the OWNER\'s rating, whatever raised it', () => {
    it('a card\'s printed TR (+2 in one call): two data, one record', () => {
      const t = table();
      const from = lastSeq(t.game);
      t.player.playCard(new ReleaseOfInertGases());
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(2);
      expect(recordsOf(t.game, from)).to.have.lengthOf(1);
    });

    it('a scale step: temperature 1, an ocean 1, oxygen 1 (+1 more when it crosses 8 % — the temperature bonus), Venus 1 (+1 more crossing 16 %)', () => {
      const t = table();
      t.game.increaseTemperature(t.player, 1);
      expect(t.card.resourceCount, 'temperature').eq(1);
      addOcean(t.player);
      expect(t.card.resourceCount, 'ocean').eq(2);
      t.game.increaseOxygenLevel(t.player, 1);
      expect(t.card.resourceCount, 'oxygen').eq(3);
      setOxygenLevel(t.game, 7);
      t.game.increaseOxygenLevel(t.player, 1);
      runAllActions(t.game);
      expect(t.card.resourceCount, 'oxygen 8 % + its temperature bonus').eq(5);
      setVenusScaleLevel(t.game, 14);
      t.game.increaseVenusScaleLevel(t.player, 1);
      runAllActions(t.game);
      expect(t.card.resourceCount, 'Venus 16 % + its rating bonus').eq(7);
    });

    it('a standard project (the asteroid): its temperature step is a rating step', () => {
      const t = table();
      const tr = t.player.terraformRating;
      const project = new AsteroidStandardProject();
      project.payAndExecute(t.player, Payment.of({megacredits: project.cost}));
      runAllActions(t.game);
      expect(t.player.terraformRating).eq(tr + 1);
      expect(t.card.resourceCount).eq(1);
    });

    it('a step of the Career with its printed TR bonus', () => {
      const t = table();
      const parliament = t.game.parliament!;
      parliament.agenda.set(t.player.id, 1);
      const tr = t.player.terraformRating;
      ChairmanSeat.walkAgenda(t.player, parliament, 1, {reason: 'card', card: CardName.SUPERCOMPUTER});
      runAllActions(t.game);
      expect(t.player.terraformRating).eq(tr + 1);
      expect(t.card.resourceCount).eq(1);
    });

    it('a RIVAL\'s rating is nobody\'s here — no data, no record', () => {
      const t = table();
      const from = lastSeq(t.game);
      t.rival.increaseTerraformRating(3);
      t.game.increaseTemperature(t.rival, 1);
      runAllActions(t.game);
      expect(t.card.resourceCount).eq(0);
      expect(recordsOf(t.game, from)).deep.eq([]);
    });

    it('the UNMI veto (RX42): a seat first by rating gains no rating — the hook never runs, no data, no record', () => {
      const t = table();
      t.game.parliament!.enacted = resolutionInstanceId(UNMI_VETO_ID, 0);
      t.player.terraformRating = 30;
      t.rival.terraformRating = 20;
      const from = lastSeq(t.game);
      t.player.increaseTerraformRating(2);
      t.game.increaseTemperature(t.player, 1);
      runAllActions(t.game);
      expect(t.player.terraformRating).eq(30);
      expect(t.card.resourceCount).eq(0);
      expect(recordsOf(t.game, from)).deep.eq([]);
    });

    it('Preservation Program eats the first step of the generation: the rest of the call is counted', () => {
      const t = table();
      t.player.preservationProgram = true;
      t.player.increaseTerraformRating(2);
      expect(t.card.resourceCount).eq(1);
    });

    it('the final greenery (Redux): the tile\'s own rating pays one data per step the engine pays', () => {
      const t = table();
      t.game.phase = Phase.PRODUCTION;
      t.player.plants = 8;
      const tr = t.player.terraformRating;
      t.player.takeActionForFinalGreenery();
      const ask = cast(t.player.getWaitingFor(), OrOptions);
      const place = cast(ask.options[0], SelectSpace);
      t.player.process({type: 'or', index: 0, response: {type: 'space', spaceId: place.spaces[0].id}});
      runAllActions(t.game);
      const gained = t.player.terraformRating - tr;
      expect(gained).to.be.greaterThan(0);
      expect(t.card.resourceCount).eq(gained);
    });

    it('the journal and the marker: the corporation\'s effect on the tr-increase channel', () => {
      const t = table();
      const before = t.game.events.events.length;
      t.player.increaseTerraformRating(1, {log: true});
      const markers = t.game.events.events.slice(before).filter((e) => e.type === 'effect-triggered' && e.source?.kind === 'corporation' && e.source.card === CardName.LOTUS_INNOVATIONS);
      expect(markers.map((e) => [e.trigger, e.player])).deep.eq([['tr-increase', t.player.color]]);
    });

    it('two corporations on one table (multicorp): Lotus answers beside the other', () => {
      const t = table();
      t.player.playedCards.push(new Arklight());
      t.player.increaseTerraformRating(1);
      expect(t.card.resourceCount).eq(1);
    });
  });

  describe('rule 4 — the forecast twin on the RATING PASS', () => {
    it('a card with a printed TR: ONE exact fact, block #0, «+2 data» on this card', () => {
      const t = table();
      const facts = lotusFacts(t.player, new ReleaseOfInertGases());
      expect(facts).to.have.lengthOf(1);
      const fact = facts[0];
      expect(fact.certainty).eq('exact');
      expect(fact.source).deep.eq({kind: 'corporation', name: CardName.LOTUS_INNOVATIONS, owner: t.player.color, channel: 'tr-increase', printedEffect: 0});
      expect(fact.recipient).deep.eq({kind: 'you'});
      expect(fact.reason).eq(LOTUS_REASON);
      expect(fact.effects.map((e) => [e.direction, e.icon, e.amount, e.host])).deep.eq([['gain', 'data', 2, CardName.LOTUS_INNOVATIONS]]);
    });

    it('a scale step is a rating step: Nitrogen-Rich Asteroid (a degree + 2 TR) → 3, Spin-Inducing Asteroid (Venus ×2) → 2', () => {
      expect(lotusFacts(table().player, new NitrogenRichAsteroid()).map((f) => f.effects[0].amount)).deep.eq([3]);
      expect(lotusFacts(table().player, new SpinInducingAsteroid()).map((f) => f.effects[0].amount)).deep.eq([2]);
    });

    it('a tile the play places: deferred, after the placement (Ice Asteroid — two oceans)', () => {
      const facts = lotusFacts(table().player, new IceAsteroid());
      expect(facts.map((f) => [f.certainty, f.timing, f.effects[0].amount])).deep.eq([['deferred', 'after-placement', 2]]);
    });

    it('a card that raises no rating forecasts NOTHING — not a «no» fact', () => {
      expect(lotusFacts(table().player, new Research())).deep.eq([]);
    });

    it('the veto: nothing of the corporation (the TR chip carries the veto)', () => {
      const t = table();
      t.game.parliament!.enacted = resolutionInstanceId(UNMI_VETO_ID, 0);
      t.player.terraformRating = 30;
      t.rival.terraformRating = 20;
      expect(lotusFacts(t.player, new ReleaseOfInertGases())).deep.eq([]);
    });

    it('a rival\'s Lotus does not answer the actor\'s rating', () => {
      const t = table();
      const theirs = new LotusInnovations();
      t.player.playedCards.remove(t.card);
      t.rival.playedCards.push(theirs);
      expect(lotusFacts(t.player, new ReleaseOfInertGases())).deep.eq([]);
    });

    it('the Greens and Lotus on one raise: both facts, ONE sum (2 M€ per step = 1 data per step)', () => {
      const t = table();
      t.game.parliament!.grantPartyEffect(t.player, PartyName.GREENS as ReduxParty, 'test');
      const trigger = new NitrogenRichAsteroid();
      t.player.cardsInHand.push(trigger);
      const forecast = effectForecastForPlay(t.player, trigger, cardPlayPreview(t.player, trigger));
      const greens = forecast.facts.find((f) => f.id.endsWith('greens-tr'));
      const lotus = forecast.facts.find((f) => f.source.name === CardName.LOTUS_INNOVATIONS);
      expect(greens?.effects[0].amount).eq(2 * (lotus?.effects[0].amount ?? 0));
      expect(lotus?.effects[0].amount).eq(3);
    });
  });

  describe('rule 5 — the reaction record', () => {
    it('two raises of one play (the degree, then the printed TR — the Executor\'s order) are two records of ONE root', () => {
      const t = table();
      const from = lastSeq(t.game);
      t.player.playCard(new NitrogenRichAsteroid());
      runAllActions(t.game);
      const records = recordsOf(t.game, from);
      expect(records.map((r) => r.impacts.map((i) => i.amount))).deep.eq([[1], [2]]);
      expect(new Set(records.map((r) => r.root.actionId)).size, 'one root').eq(1);
      expect(t.card.resourceCount).eq(3);
    });
  });

  describe('rule 6 — the points, the deal and the save', () => {
    it('1 VP per 4 data: 0…3 → 0, 4 → 1, 7 → 1, 8 → 2', () => {
      const t = table();
      for (const [data, vp] of [[0, 0], [3, 0], [4, 1], [7, 1], [8, 2]]) {
        t.card.resourceCount = data;
        expect(t.card.getVictoryPoints(t.player), `${data} data`).eq(vp);
      }
    });

    it('a Redux table deals the corporation; a classic Turmoil table does not', () => {
      // The POOL, not the shuffled draw pile (a dealt hand takes the card out of it — every new corporation reshuffles).
      const [redux] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
      expect(new GameCards(redux.gameOptions).getCorporationCards().map((c) => c.name)).to.include(CardName.LOTUS_INNOVATIONS);
      const [classic] = testGame(2, {turmoilExtension: true});
      expect(new GameCards(classic.gameOptions).getCorporationCards().map((c) => c.name)).to.not.include(CardName.LOTUS_INNOVATIONS);
    });

    it('save / load keeps the data, and the hook answers after the load', () => {
      const t = table();
      t.player.increaseTerraformRating(3);
      const copy = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = copy.getPlayerById(t.player.id);
      const card = owner.playedCards.get(CardName.LOTUS_INNOVATIONS) as ICard;
      expect(card.resourceCount).eq(3);
      owner.increaseTerraformRating(1);
      expect(card.resourceCount).eq(4);
    });
  });
});

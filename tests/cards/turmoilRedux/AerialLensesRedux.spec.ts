import {expect} from 'chai';
import {AerialLensesRedux, HEAT_PRODUCTION, PLANTS_REMOVED} from '../../../src/server/cards/turmoilRedux/AerialLensesRedux';
import {AerialLenses} from '../../../src/server/cards/turmoil/AerialLenses';
import {TURMOIL_REDUX_CARD_MANIFEST} from '../../../src/server/cards/turmoilRedux/TurmoilReduxCardManifest';
import {BackroomDeal} from '../../../src/server/cards/turmoilRedux/BackroomDeal';
import {IGame} from '../../../src/server/IGame';
import {Game} from '../../../src/server/Game';
import {GameCards} from '../../../src/server/GameCards';
import {newCard} from '../../../src/server/createCard';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {Parliament} from '../../../src/server/parliament/Parliament';
import {Payment} from '../../../src/common/inputs/Payment';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {PARTY_REQUIREMENT_REASON, unplayableReasons} from '../../../src/server/models/unplayableReasons';
import {requiredPartyOf} from '../../../src/server/cards/requirements/partyRequirementCards';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {inPremiumScope} from '../../../src/common/cards/premiumScope';
import {cast, toName} from '../../../src/common/utils/utils';
import {TestPlayer} from '../../TestPlayer';
import {runAllActions, testGame} from '../../TestingUtils';
import {testAutomaGame} from '../../automa/AutomaTestGame';
import {quietResolutionOf, seatEnacted, seatResolution} from '../../parliament/parliamentArrange';

/**
 * TR71 — AERIAL LENSES (Redux replacement of the classic T01). The card file
 * declares everything; every rule reading of its header is pinned here on the
 * real card: the printed card (Scientists — NOT the normalized Greens — 3 M€,
 * Science, no VP), the requirement's roads and named reasons, the play (heat
 * production + the plant attack with its target pick, its decline and its
 * named skip, MarsBot as a target), the deal (the replacement on a Redux
 * table, the classic card on a classic one, never both), save / load.
 */
const S = PartyName.SCIENTISTS;

type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, parliament: Parliament, card: AerialLensesRedux};

/** A two-seat Redux table (Colonies on, as the set is played) in the action phase, the card in hand, 20 M€. */
function table(): Table {
  const [game, p1, p2] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});
  game.phase = Phase.ACTION;
  const card = new AerialLensesRedux();
  p1.cardsInHand.push(card);
  p1.megaCredits = 20;
  return {game, p1, p2, parliament: game.parliament!, card};
}

/** The same table with three QUIET real resolutions up for the vote (the Scientists · Mars First · the Greens). */
function parliamentTable(): Table {
  const t = table();
  ([S, PartyName.MARS, PartyName.GREENS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
  return t;
}

/** The Scientists rule: their quiet resolution stands enacted. */
function scientistsRuling(): Table {
  const t = parliamentTable();
  seatEnacted(t.parliament, quietResolutionOf(S));
  expect(t.parliament.rulingParty()).eq(S);
  return t;
}

function options(overrides: Partial<GameOptions>): GameOptions {
  return {...DEFAULT_GAME_OPTIONS, ...overrides};
}

describe('AerialLensesRedux', () => {
  it('rule 1 — the printed card: green, 3, a Science tag, no VP, the Scientists\' plate; TR71, reimplementing T01', () => {
    const c = new AerialLensesRedux();
    expect(c.name).eq(CardName.AERIAL_LENSES_REDUX);
    expect(c.name, 'the classic name with the `:redux` suffix').eq('Aerial Lenses:redux');
    expect(c.type).eq(CardType.AUTOMATED);
    expect(c.cost).eq(3);
    expect(c.tags).deep.eq([Tag.SCIENCE]);
    expect(c.victoryPoints, 'the classic −1 VP is gone').is.undefined;
    expect(requiredPartyOf(c), 'the PRINTED Scientists — never the Kelvinists → Greens normalization').eq(S);
    expect(c.behavior).deep.eq({production: {heat: HEAT_PRODUCTION}, removeAnyPlants: PLANTS_REMOVED});
    expect(c.metadata.cardNumber).eq('TR71');
    expect(c.metadata.reimplements, 'the art and the lore are the classic T01\'s').eq(CardName.AERIAL_LENSES);
    expect(new AerialLenses().metadata.cardNumber).eq('T01');
    expect(TURMOIL_REDUX_CARD_MANIFEST.projectCards[CardName.AERIAL_LENSES_REDUX]?.compatibility).is.undefined;
    expect(newCard(CardName.AERIAL_LENSES_REDUX)).to.be.instanceOf(AerialLensesRedux);
    expect(newCard(CardName.AERIAL_LENSES), 'the plain name stays the classic card').to.be.instanceOf(AerialLenses);
  });

  describe('rule 1 — the requirement: the Scientists rule, or 2 of your delegates on their resolution', () => {
    it('neither road: unplayable with the NAMED reason «0 of 2»', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([{
        type: 'party', message: PARTY_REQUIREMENT_REASON, params: [S, '2'], party: S, current: 0,
        requirement: true, requirementKey: 'req:party',
      }]);
    });

    it('one delegate on their resolution: still unplayable, «1 of 2»', () => {
      const t = parliamentTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: S, current: 1});
    });

    it('the Scientists\' resolution is not up for the vote: the road is CLOSED (`partyOffVote`), not «0 of 2»', () => {
      const t = table();
      ([PartyName.MARS, PartyName.GREENS, PartyName.REDS] as const).forEach((party, i) => seatResolution(t.parliament, i, quietResolutionOf(party)));
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: S, partyOffVote: true});
    });

    it('two delegates on their resolution: playable', () => {
      const t = parliamentTable();
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'reserve');
      t.parliament.placeVote(t.p1, t.parliament.slots[0], 'lobby');
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('the Scientists rule: playable', () => {
      const t = scientistsRuling();
      expect(t.p1.canPlay(t.card)).is.true;
      expect(unplayableReasons(t.p1, t.card)).deep.eq([]);
    });

    it('the GREENS ruling is not a road — the plate is the Scientists\' (the classic card\'s normalized party does not apply)', () => {
      const t = parliamentTable();
      seatEnacted(t.parliament, quietResolutionOf(PartyName.GREENS));
      expect(t.parliament.rulingParty()).eq(PartyName.GREENS);
      expect(t.p1.canPlay(t.card)).is.false;
      expect(unplayableReasons(t.p1, t.card)[0]).deep.include({party: S});
    });

    it('a card-granted Scientists EFFECT is not a road (FAQ p.19 — the effect reading is not the requirement reading)', () => {
      const t = parliamentTable();
      t.parliament.grantPartyEffect(t.p1, S, CardName.REDS_NEWS_OUTLET);
      expect(t.game.politics!.hasPartyEffect(t.p1, S)).is.true;
      expect(t.p1.canPlay(t.card)).is.false;
    });

    it('TR70 Backroom Deal waives it for the next card', () => {
      const t = parliamentTable();
      expect(t.p1.canPlay(t.card)).is.false;
      const deal = new BackroomDeal();
      t.p1.cardsInHand.push(deal);
      t.p1.playCard(deal, Payment.of({megacredits: 2}));
      runAllActions(t.game);
      expect(t.p1.canPlay(t.card)).is.true;
    });
  });

  describe('rules 2–3 — +2 heat production; UP TO 2 plants off any player', () => {
    it('an opponent with plants: the target pick (an OrOptions); the pick removes 2; the production lands either way', () => {
      const t = scientistsRuling();
      t.p2.plants = 5;
      t.p1.playCard(t.card);
      expect(t.p1.production.heat).eq(HEAT_PRODUCTION);
      expect(t.p1.heat, 'production, never stock').eq(0);
      runAllActions(t.game);
      const pick = cast(t.p1.popWaitingFor(), OrOptions);
      pick.options[0].cb(undefined);
      expect(t.p2.plants).eq(3);
      expect(t.p1.production.heat).eq(HEAT_PRODUCTION);
    });

    it('«up to»: a target with 1 plant loses 1', () => {
      const t = scientistsRuling();
      t.p2.plants = 1;
      t.p1.playCard(t.card);
      runAllActions(t.game);
      const pick = cast(t.p1.popWaitingFor(), OrOptions);
      pick.options[0].cb(undefined);
      expect(t.p2.plants).eq(0);
    });

    it('the attacker may decline INSIDE the pick — the opponent keeps every plant', () => {
      const t = scientistsRuling();
      t.p2.plants = 5;
      t.p1.playCard(t.card);
      runAllActions(t.game);
      const pick = cast(t.p1.popWaitingFor(), OrOptions);
      const skip = pick.options.find((o) => o.title === 'Skip removing plants');
      expect(skip, 'a decline option in the pick').is.not.undefined;
      skip!.cb(undefined);
      expect(t.p2.plants).eq(5);
      expect(t.p1.production.heat).eq(HEAT_PRODUCTION);
    });

    it('nobody has plants: no prompt, and the attack is a NAMED skip (Mining Expedition\'s rule), never a bare nothing', () => {
      const t = scientistsRuling();
      t.p1.playCard(t.card);
      runAllActions(t.game);
      expect(t.p1.popWaitingFor()).is.undefined;
      expect(t.p1.production.heat).eq(HEAT_PRODUCTION);
      const skipped = t.game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped?.effect?.icon);
      expect(skipped).deep.eq(['plants']);
    });

    it('rule 5 — the play preview states the production and pre-collects the plant target, read-only', () => {
      const t = scientistsRuling();
      t.p2.plants = 5;
      const preview = cardPlayPreview(t.p1, t.card);
      expect(preview.kind, 'a declaration — no hook').eq('declarative');
      const effects = preview.branches.flatMap((b) => b.effects);
      expect(effects.some((e) => e.direction === 'gain' && e.icon === 'heat'), JSON.stringify(effects)).is.true;
      const steps = preview.branches.flatMap((b) => b.steps);
      expect(steps.some((s) => s.kind === 'input' && s.input.type === 'or'), 'the target pick is pre-collected').is.true;
      expect(t.p2.plants, 'the preview never mutates').eq(5);
      expect(t.p1.production.heat).eq(0);
    });

    it('MarsBot is a target: its plants come off through `AutomaTargeting` (the M€-supply proxy)', () => {
      const [game, human, bot] = testAutomaGame({turmoilReduxExpansion: true, coloniesExtension: true, botParliamentMode: 'politics'});
      game.phase = Phase.ACTION;
      const parliament = game.parliament!;
      ([S, PartyName.MARS, PartyName.GREENS] as const).forEach((party, i) => seatResolution(parliament, i, quietResolutionOf(party)));
      seatEnacted(parliament, quietResolutionOf(S));
      bot.megaCredits = 7;
      const c = new AerialLensesRedux();
      human.cardsInHand.push(c);
      human.megaCredits = 20;
      expect(human.canPlay(c)).is.true;
      human.playCard(c);
      runAllActions(game);
      const pick = cast(human.popWaitingFor(), OrOptions);
      pick.options[0].cb(undefined);
      expect(bot.megaCredits).eq(5);
      expect(human.production.heat).eq(HEAT_PRODUCTION);
    });
  });

  describe('rule 4 — the deal: the replacement on a Redux table, the classic card on a classic one, never both', () => {
    const REDUX = {turmoilReduxExpansion: true, turmoilExtension: false, coloniesExtension: true};
    const CLASSIC = {turmoilReduxExpansion: false, turmoilExtension: true, coloniesExtension: true};

    it('Redux: TR71 is dealt, the classic T01 is removed by the manifest\'s `cardsToRemove`', () => {
      const names = new GameCards(options(REDUX)).getProjectCards().map(toName);
      expect(names).to.contain(CardName.AERIAL_LENSES_REDUX);
      expect(names).to.not.contain(CardName.AERIAL_LENSES);
      expect(TURMOIL_REDUX_CARD_MANIFEST.cardsToRemove.has(CardName.AERIAL_LENSES)).is.true;
    });

    it('classic Turmoil: the classic card is dealt, the replacement is not', () => {
      const names = new GameCards(options(CLASSIC)).getProjectCards().map(toName);
      expect(names).to.contain(CardName.AERIAL_LENSES);
      expect(names).to.not.contain(CardName.AERIAL_LENSES_REDUX);
    });

    it('the premium scope covers the replacement and never the replaced classic card', () => {
      expect(inPremiumScope({module: 'turmoilRedux', name: CardName.AERIAL_LENSES_REDUX})).is.true;
      expect(inPremiumScope({module: 'turmoil', name: CardName.AERIAL_LENSES})).is.false;
    });
  });

  it('rule 7 — save / reload: the played card stays in the tableau, its production with it', () => {
    const t = scientistsRuling();
    t.p1.playCard(t.card);
    runAllActions(t.game);
    const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
    const owner = reloaded.getPlayerById(t.p1.id);
    const again = owner.playedCards.get(CardName.AERIAL_LENSES_REDUX);
    expect(again).to.be.instanceOf(AerialLensesRedux);
    expect(again!.getVictoryPoints(owner), 'no VP — the classic −1 is gone').eq(0);
    expect(owner.production.heat).eq(HEAT_PRODUCTION);
  });
});

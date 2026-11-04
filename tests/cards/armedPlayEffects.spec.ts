import {expect} from 'chai';
import {testGame} from '../TestGame';
import {fakeCard, setTemperature} from '../TestingUtils';
import {Game} from '../../src/server/Game';
import {CardName} from '../../src/common/cards/CardName';
import {GlobalParameter} from '../../src/common/GlobalParameter';
import {armedPlayEffectsOf, oneShotEffectsOf} from '../../src/server/cards/armedPlayEffects';
import {SpecialDesign} from '../../src/server/cards/base/SpecialDesign';
import {IndenturedWorkers} from '../../src/server/cards/base/IndenturedWorkers';
import {AdaptationTechnology} from '../../src/server/cards/base/AdaptationTechnology';
import {Algae} from '../../src/server/cards/base/Algae';
import {LakeMarineris} from '../../src/server/cards/base/LakeMarineris';
import {Conscription} from '../../src/server/cards/colonies/Conscription';
import {EcologyExperts} from '../../src/server/cards/prelude/EcologyExperts';
import {EccentricSponsor} from '../../src/server/cards/prelude/EccentricSponsor';
import {CardType} from '../../src/common/cards/CardType';
import {armedPlayForecastOf} from '../../src/server/models/armedPlayForecast';
import {Fish} from '../../src/server/cards/base/Fish';
import {Comet} from '../../src/server/cards/base/Comet';
import {BackroomDeal} from '../../src/server/cards/turmoilRedux/BackroomDeal';
import {EarthCatapult} from '../../src/server/cards/base/EarthCatapult';
import {Payment} from '../../src/common/inputs/Payment';

/**
 * THE ONE READER OF ARMED ONE-PLAY EFFECTS (TR49 class): what the next card
 * will spend, read off the card `lastCardPlayed` names — arm, replace, spend,
 * pass, reload.
 */
describe('armedPlayEffects', () => {
  it('nothing is armed before any play, and a card without a one-play effect arms nothing', () => {
    const [/* game */, player] = testGame(2);
    expect(armedPlayEffectsOf(player)).deep.eq([]);
    player.playCard(new Algae());
    expect(player.lastCardPlayed).eq(CardName.ALGAE);
    expect(armedPlayEffectsOf(player)).deep.eq([]);
  });

  it('ARM: playing Special Design arms ±2 on the global requirements', () => {
    const [/* game */, player] = testGame(2);
    player.playCard(new SpecialDesign());
    expect(armedPlayEffectsOf(player)).deep.eq([
      {source: CardName.SPECIAL_DESIGN, sourceType: CardType.EVENT, effect: {kind: 'requirementShift', steps: 2}, expires: 'next-play'},
    ]);
  });

  it('ARM: the one-play discounts (Indentured Workers −8, Conscription −16) read off their declarations', () => {
    const [/* game */, player] = testGame(2);
    player.playCard(new IndenturedWorkers());
    expect(armedPlayEffectsOf(player).map((e) => e.effect)).deep.eq([{kind: 'discount', amount: 8}]);
    player.playCard(new Conscription());
    expect(armedPlayEffectsOf(player).map((e) => e.effect)).deep.eq([{kind: 'discount', amount: 16}]);
  });

  it('ARM: Backroom Deal (TR70) arms TWO effects at once — the PARTY waiver (the fourth kind), then the −10', () => {
    const [/* game */, player] = testGame(2);
    player.playCard(new BackroomDeal());
    expect(armedPlayEffectsOf(player).map((e) => e.effect)).deep.eq([{kind: 'partyWaiver'}, {kind: 'discount', amount: 10}]);
    expect(player.partyRequirementWaiver()).deep.eq({kind: 'card', card: CardName.BACKROOM_DEAL, owner: player.color});
    // The party family never touches the global one.
    expect(player.globalRequirementWaiver(GlobalParameter.TEMPERATURE)).is.undefined;
    player.playCard(new Algae());
    expect(armedPlayEffectsOf(player)).deep.eq([]);
    expect(player.partyRequirementWaiver()).is.undefined;
  });

  it('REPLACE: one field, one armed card — a new play replaces what was armed', () => {
    const [/* game */, player] = testGame(2);
    player.playCard(new SpecialDesign());
    player.playCard(new IndenturedWorkers());
    expect(armedPlayEffectsOf(player).map((e) => e.source)).deep.eq([CardName.INDENTURED_WORKERS]);
  });

  it('SPEND: the next card played spends it — whether or not it needed it', () => {
    const [game, player] = testGame(2);
    setTemperature(game, -30);
    player.playCard(new SpecialDesign());
    // Algae (no global requirement) does not need the shift — it spends it anyway.
    player.playCard(new Algae());
    expect(armedPlayEffectsOf(player)).deep.eq([]);
    expect(player.getGlobalParameterRequirementBonus(GlobalParameter.TEMPERATURE)).eq(0);
  });

  it('PASS: an effect not spent by the pass is lost', () => {
    const [/* game */, player] = testGame(2);
    player.playCard(new SpecialDesign());
    player.pass();
    expect(armedPlayEffectsOf(player)).deep.eq([]);
  });

  it('the permanent modifiers are NOT one-play effects (Adaptation Technology arms nothing)', () => {
    const [/* game */, player] = testGame(2);
    player.playCard(new AdaptationTechnology());
    expect(armedPlayEffectsOf(player)).deep.eq([]);
    expect(oneShotEffectsOf(new AdaptationTechnology())).deep.eq([]);
  });

  it('the preludes that host their own next play arm by their declarations (waiver, −25)', () => {
    expect(oneShotEffectsOf(new EcologyExperts())).deep.eq([{kind: 'requirementWaiver'}]);
    expect(oneShotEffectsOf(new EccentricSponsor())).deep.eq([{kind: 'discount', amount: 25}]);
    expect(oneShotEffectsOf(new LakeMarineris())).deep.eq([]);
  });

  it('RELOAD: lastCardPlayed is serialized, so the armed effect survives a save / load', () => {
    const [game, player] = testGame(2);
    player.playCard(new SpecialDesign());
    const loaded = Game.deserialize(structuredClone(game.serialize()));
    const reloaded = loaded.getPlayerById(player.id);
    expect(armedPlayEffectsOf(reloaded).map((e) => e.effect)).deep.eq([{kind: 'requirementShift', steps: 2}]);
    expect(reloaded.getGlobalParameterRequirementBonus(GlobalParameter.OXYGEN)).eq(2);
  });
});

describe('armedPlayForecastOf — what a play spends, and whether it uses it', () => {
  it('nothing armed, nothing bent → no reading', () => {
    const [/* game */, player] = testGame(2);
    expect(armedPlayForecastOf(player, new Algae())).is.undefined;
  });

  it('a card that needs the armed ±2 USES it; one that needs nothing spends it for NOTHING', () => {
    const [game, player] = testGame(2);
    setTemperature(game, -2);
    player.playCard(new SpecialDesign());
    expect(armedPlayForecastOf(player, new Fish())?.consumes.map((c) => c.used)).deep.eq([true]);
    const comet = armedPlayForecastOf(player, new Comet());
    expect(comet?.consumes.map((c) => [c.armed.source, c.used])).deep.eq([[CardName.SPECIAL_DESIGN, false]]);
    expect(comet?.easings).deep.eq([]);
  });

  it('a one-play discount is used by any card that costs something', () => {
    const [/* game */, player] = testGame(2);
    player.playCard(new IndenturedWorkers());
    expect(armedPlayForecastOf(player, new Comet())?.consumes[0].used).is.true;
    expect(armedPlayForecastOf(player, new IndenturedWorkers())?.consumes[0].used, 'a free card gains nothing from −8').is.false;
  });

  // P62 · GB — the one-play discount's share is what it adds BEYOND the standing ones: the 0-floor is spent on them first.
  describe('beside a STANDING discount (the 0-floor spent on the standing ones first)', () => {
    function armedBeside(cost: number) {
      const [game, player] = testGame(1);
      player.megaCredits = 50;
      player.playCard(new IndenturedWorkers()); // arms «next card −8»
      // The standing −2 stands AFTER the arming card on the table: the table's order must not decide who gets the floor.
      player.playedCards.push(new EarthCatapult());
      expect(player.lastCardPlayed).eq(CardName.INDENTURED_WORKERS);
      const card = fakeCard({cost, name: 'p62-probe' as CardName});
      return {game, player, card};
    }

    it('cost 2: Earth Catapult alone takes it to 0 — the −8 is spent for NOTHING, never credited', () => {
      const {player, card} = armedBeside(2);
      const breakdown = player.getCardCostBreakdown(card);
      expect(breakdown.final).eq(0);
      expect(breakdown.discounts.find((d) => d.source.kind === 'card' && d.source.card === CardName.EARTH_CATAPULT)?.saved, 'the standing −2 saved all 2').is.undefined;
      expect(breakdown.discounts.find((d) => d.source.kind === 'card' && d.source.card === CardName.INDENTURED_WORKERS)?.saved).eq(0);
      expect(armedPlayForecastOf(player, card)?.consumes[0].used, 'spent for nothing').is.false;
    });

    it('cost 6: the −8 adds 4 beyond the standing −2 — USED, its share 4 (the rest is lost)', () => {
      const {player, card} = armedBeside(6);
      const breakdown = player.getCardCostBreakdown(card);
      expect(breakdown.discounts.find((d) => d.source.kind === 'card' && d.source.card === CardName.EARTH_CATAPULT)?.saved).is.undefined;
      expect(breakdown.discounts.find((d) => d.source.kind === 'card' && d.source.card === CardName.INDENTURED_WORKERS)?.saved).eq(4);
      expect(armedPlayForecastOf(player, card)?.consumes[0].used).is.true;
    });

    it('the RULE is unchanged: the next play spends the −8 whatever it saved — and the record says what it saved', () => {
      const {game, player, card} = armedBeside(2);
      player.playCard(card, Payment.EMPTY);
      expect(armedPlayEffectsOf(player), 'spent by the play — nothing armed after it').deep.eq([]);
      const saved = (name: CardName) => game.events.events.filter((e) => e.type === 'discount-applied' && e.source?.kind === 'card' && e.source.card === name).map((e) => e.impact.megacreditsSaved);
      expect(saved(CardName.EARTH_CATAPULT), 'the standing −2 is credited with the 2 it took').deep.eq([2]);
      expect(saved(CardName.INDENTURED_WORKERS), 'the −8 took nothing — no saving recorded').deep.eq([]);
    });
  });

  it('a permanent modifier alone reads easings but spends nothing', () => {
    const [game, player] = testGame(2);
    setTemperature(game, -2);
    player.playedCards.push(new AdaptationTechnology());
    const reading = armedPlayForecastOf(player, new Fish());
    expect(reading?.consumes).deep.eq([]);
    expect(reading?.easings[0].decisive).is.true;
  });
});

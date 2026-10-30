import {expect} from 'chai';
import {CloudTourism} from '../../../src/server/cards/prelude2/CloudTourism';
import {testGame} from '../../TestGame';
import {runAllActions} from '../../TestingUtils';
import {EarthEmbassy} from '../../../src/server/cards/moon/EarthEmbassy';
import {cast} from '../../../src/common/utils/utils';
import {PartyName} from '../../../src/common/turmoil/PartyName';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {CardResource} from '../../../src/common/CardResource';
import {Phase} from '../../../src/common/Phase';
import {ActionEffect} from '../../../src/common/models/ActionPreviewModel';
import {PRELUDE2_CARD_MANIFEST} from '../../../src/server/cards/prelude2/Prelude2CardManifest';
import {PRELUDE2_CARDS_HELD_BACK} from '../../../src/common/cards/prelude2Adaptation';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {actionPreview, countedPlayEffects} from '../../../src/server/models/actionPreview';
import {GameCards} from '../../../src/server/GameCards';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {Game} from '../../../src/server/Game';
import {Dirigibles} from '../../../src/server/cards/venusNext/Dirigibles';
import {Cartel} from '../../../src/server/cards/base/Cartel';
import {SulphurEatingBacteria} from '../../../src/server/cards/venusNext/SulphurEatingBacteria';
import {ResearchCoordination} from '../../../src/server/cards/prelude/ResearchCoordination';
import {Teractor} from '../../../src/server/cards/corporation/Teractor';
import {Birds} from '../../../src/server/cards/base/Birds';
import {LocalShading} from '../../../src/server/cards/venusNext/LocalShading';
import {testAutomaGame} from '../../automa/AutomaTestGame';

describe('CloudTourism', () => {
  const playTests = [
    {earth: 0, venus: 0, wild: 0, expected: 0},
    {earth: 0, venus: 1, wild: 0, expected: 0},
    {earth: 1, venus: 0, wild: 0, expected: 1},
    {earth: 1, venus: 1, wild: 0, expected: 1},
    {earth: 2, venus: 1, wild: 0, expected: 2},
    {earth: 2, venus: 2, wild: 0, expected: 2},
    {earth: 2, venus: 1, wild: 1, expected: 2},
    {earth: 3, venus: 1, wild: 1, expected: 3},
    {earth: 3, venus: 1, wild: 2, expected: 3},
    {earth: 3, venus: 1, wild: 3, expected: 4},
    {earth: 3, venus: 1, wild: 4, expected: 4},
  ] as const;
  for (const run of playTests) {
    it('play ' + JSON.stringify(run), () => {
      const card = new CloudTourism();
      const [game, player] = testGame(1);

      player.tagsForTest = {earth: run.earth, venus: run.venus, wild: run.wild};
      cast(card.play(player), undefined);
      runAllActions(game);

      expect(player.production.megacredits).eq(run.expected);

      runAllActions(game);
      cast(player.popWaitingFor(), undefined);
    });
  }

  const earthEmbassyPlayTests = [
    {earth: 0, venus: 4, played: false, moon: 4, expected: 0},
    {earth: 0, venus: 4, played: true, moon: 4, expected: 4},
    {earth: 2, venus: 4, played: true, moon: 1, expected: 3},
    {earth: 2, venus: 4, played: true, moon: 2, expected: 4},
    {earth: 2, venus: 4, played: true, moon: 3, expected: 5},
  ] as const;
  for (const run of earthEmbassyPlayTests) {
    it('play, compatible with earth embassy ' + JSON.stringify(run), () => {
      const card = new CloudTourism();
      const [game, player] = testGame(1, {moonExpansion: true});

      if (run.played) {
        player.playedCards.push(new EarthEmbassy());
      }
      player.tagsForTest = {earth: run.earth, venus: run.venus, moon: run.moon};
      cast(card.play(player), undefined);
      runAllActions(game);

      expect(player.production.megacredits).eq(run.expected);

      runAllActions(game);
      cast(player.popWaitingFor(), undefined);
    });
  }

  it('play, the Turmoil Redux Scientists\' wild tag pairs like a printed one', () => {
    const card = new CloudTourism();
    const [game, player] = testGame(2, {turmoilReduxExpansion: true, coloniesExtension: true});

    player.tagsForTest = {earth: 2, venus: 0};
    game.parliament!.grantPartyEffect(player, PartyName.SCIENTISTS, 'test');
    cast(card.play(player), undefined);
    runAllActions(game);

    expect(player.production.megacredits, '2 Earth · this Venus + the wild tag as Venus').eq(2);
  });

  it('action', () => {
    const card = new CloudTourism();
    const [game, player] = testGame(1);

    expect(card.canAct(player)).is.true;
    cast(card.action(player), undefined);
    runAllActions(game);
    expect(card.resourceCount).eq(1);
  });
});

describe('CloudTourism — premium (P69)', () => {
  const productionOf = (effects: ReadonlyArray<ActionEffect>) => effects.find((e) => e.direction === 'gain' && e.icon === 'megacredits' && e.note === 'production');

  it('rule 1 — the printed card: blue, 11 M€, Jovian + Venus, 1 VP per 3 floaters, P69, Venus-compatible, no requirement, one play sentence', () => {
    const card = new CloudTourism();
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(11);
    expect(card.tags).deep.eq([Tag.JOVIAN, Tag.VENUS]);
    expect(card.victoryPoints).deep.eq({resourcesHere: {}, per: 3});
    expect(card.resourceType).eq(CardResource.FLOATER);
    expect(card.requirements).is.empty;
    expect(card.metadata.cardNumber).eq('P69');
    expect(card.metadata.description).eq('Increase your M€ production 1 step for each pair of Earth and Venus tags you have, this card included.');
    expect(PRELUDE2_CARD_MANIFEST.projectCards[CardName.CLOUD_TOURISM]?.compatibility).eq('venus');
  });

  it('rule 1 — paid in M€ (and floaters, a Venus tag); never steel, never titanium', () => {
    const [/* game */, player] = testGame(1, {venusNextExtension: true});
    const options = player.paymentOptionsForCard(new CloudTourism());
    expect(options.steel).is.false;
    expect(options.titanium).is.false;
    expect(options.floaters).is.true;
  });

  it('rule 1 — Dirigibles\' floaters pay for it', () => {
    const [/* game */, player] = testGame(1, {venusNextExtension: true});
    const dirigibles = new Dirigibles();
    player.playedCards.push(dirigibles);
    dirigibles.resourceCount = 3;
    player.megaCredits = 2;
    expect(player.canAfford({cost: 11, floaters: true})).is.true;
    player.megaCredits = 1;
    expect(player.canAfford({cost: 11, floaters: true})).is.false;
  });

  const vpTable = [[0, 0], [1, 0], [2, 0], [3, 1], [5, 1], [6, 2]] as const;
  for (const [floaters, vp] of vpTable) {
    it(`rule 3 — ${floaters} floaters here → ${vp} VP`, () => {
      const [/* game */, player] = testGame(1);
      const card = new CloudTourism();
      player.playedCards.push(card);
      card.resourceCount = floaters;
      expect(card.getVictoryPoints(player)).eq(vp);
    });
  }

  describe('rule 2 / 4 — the count of pairs: ONE function for the play, the forecast and the preview', () => {
    const table = [
      {earth: 0, venus: 0, wild: 0, sides: [{tag: Tag.EARTH, count: 0}, {tag: Tag.VENUS, count: 1, self: 1}]},
      {earth: 2, venus: 1, wild: 0, sides: [{tag: Tag.EARTH, count: 2}, {tag: Tag.VENUS, count: 2, self: 1}]},
      // The wild tag goes to the SMALLER side, Venus on a tie.
      {earth: 1, venus: 0, wild: 1, sides: [{tag: Tag.EARTH, count: 1}, {tag: Tag.VENUS, count: 2, wild: 1, self: 1}]},
      {earth: 0, venus: 0, wild: 1, sides: [{tag: Tag.EARTH, count: 1, wild: 1}, {tag: Tag.VENUS, count: 1, self: 1}]},
      {earth: 3, venus: 1, wild: 3, sides: [{tag: Tag.EARTH, count: 4, wild: 1}, {tag: Tag.VENUS, count: 4, wild: 2, self: 1}]},
      {earth: 3, venus: 1, wild: 2, sides: [{tag: Tag.EARTH, count: 3}, {tag: Tag.VENUS, count: 4, wild: 2, self: 1}]},
    ] as const;
    for (const run of table) {
      it('the forecast names each side, its wild tags and this card\'s own tag; the play pays its count ' + JSON.stringify({earth: run.earth, venus: run.venus, wild: run.wild}), () => {
        const card = new CloudTourism();
        const [game, player] = testGame(1);
        player.tagsForTest = {earth: run.earth, venus: run.venus, wild: run.wild};
        player.cardsInHand.push(card);
        const before = JSON.stringify(game.serialize());
        const chip = productionOf(countedPlayEffects(player, card));
        const preview = cardPlayPreview(player, card);
        expect(JSON.stringify(game.serialize()), 'read-only').eq(before);
        const pairs = Math.min(...run.sides.map((s) => s.count));
        expect(chip?.amount).eq(pairs);
        expect(chip?.basis).deep.eq([{
          count: pairs, label: 'Your tag sets', set: run.sides,
          ...(pairs === 0 ? {zero: 'No Earth tags'} : {}),
        }]);
        expect(preview.kind).eq('bespoke');
        expect(productionOf(preview.branches.flatMap((b) => b.effects)), 'the preview is the forecast').deep.eq(chip);
        player.cardsInHand.pop();
        cast(card.play(player), undefined);
        runAllActions(game);
        expect(player.production.megacredits, 'the play pays the forecast').eq(pairs);
      });
    }

    it('the chip is `current → resulting` on the M€ production', () => {
      const card = new CloudTourism();
      const [/* game */, player] = testGame(1);
      player.production.override({megacredits: 3});
      player.tagsForTest = {earth: 2, venus: 1};
      expect(productionOf(countedPlayEffects(player, card))).deep.include({amount: 2, current: 3, resulting: 5});
    });

    it('a real table (Teractor + Cartel = 2 Earth · Sulphur-Eating Bacteria + this = 2 Venus) → 2 pairs; the Scientists\' wild tag is dealt and NAMED', () => {
      const card = new CloudTourism();
      const [game, player] = testGame(2, {venusNextExtension: true, turmoilReduxExpansion: true, coloniesExtension: true});
      player.playCorporationCard(new Teractor());
      player.playedCards.push(new Cartel(), new SulphurEatingBacteria());
      game.parliament!.grantPartyEffect(player, PartyName.SCIENTISTS, 'test');
      const chip = productionOf(countedPlayEffects(player, card));
      expect(chip?.basis?.[0].set, 'the wild tag lands on Venus on a tie').deep.eq([{tag: Tag.EARTH, count: 2}, {tag: Tag.VENUS, count: 3, wild: 1, self: 1}]);
      expect(chip?.amount).eq(2);
    });

    it('a printed wild tag (Research Coordination) with no Venus on the table → 2 pairs, the wild tag on the Venus side', () => {
      const card = new CloudTourism();
      const [/* game */, player] = testGame(2, {venusNextExtension: true});
      player.playCorporationCard(new Teractor());
      player.playedCards.push(new Cartel(), new ResearchCoordination());
      const chip = productionOf(countedPlayEffects(player, card));
      expect(chip?.amount).eq(2);
      expect(chip?.basis?.[0].set).deep.eq([{tag: Tag.EARTH, count: 2}, {tag: Tag.VENUS, count: 2, wild: 1, self: 1}]);
    });

    it('no Earth tag: an honest zero — the chip «+0» and the empty side NAMED; the play changes nothing', () => {
      const card = new CloudTourism();
      const [game, player] = testGame(1);
      player.tagsForTest = {venus: 3};
      const chip = productionOf(countedPlayEffects(player, card));
      expect(chip).deep.include({amount: 0, current: 0, resulting: 0});
      expect(chip?.basis?.[0].zero).eq('No Earth tags');
      cast(card.play(player), undefined);
      runAllActions(game);
      expect(player.production.megacredits).eq(0);
    });
  });

  describe('rule 3 — the action: a floater onto this card', () => {
    it('the preview: «+1 floater on this card» and what it is worth here — short of the threshold, the neutral «2 more»', () => {
      const card = new CloudTourism();
      const [/* game */, player] = testGame(1);
      player.playedCards.push(card);
      const branch = actionPreview(player, card).branches[0];
      expect(branch.available).is.true;
      expect(branch.effects).has.length(2);
      expect(branch.effects[0]).deep.include({direction: 'gain', icon: 'floater', amount: 1, current: 0, resulting: 1, note: 'on this card'});
      expect(branch.effects[1]).deep.eq({direction: 'gain', icon: 'vp', amount: 0, current: 0, resulting: 0, note: 'No new VP yet · ${0} more for the next', noteParams: ['2']});
    });

    it('the preview on the third floater: «ПО 0 → 1» (ledger CV — a declared «add here» action reads its own points)', () => {
      const card = new CloudTourism();
      const [/* game */, player] = testGame(1);
      player.playedCards.push(card);
      card.resourceCount = 2;
      expect(actionPreview(player, card).branches[0].effects[1]).deep.eq({direction: 'gain', icon: 'vp', amount: 1, current: 0, resulting: 1});
    });

    it('the class: Birds\' «add an animal here» reads its point too; Local Shading (no VP) adds nothing', () => {
      const [/* game */, player] = testGame(1, {venusNextExtension: true});
      const birds = new Birds();
      const shading = new LocalShading();
      player.playedCards.push(birds, shading);
      expect(actionPreview(player, birds).branches[0].effects.map((e) => e.icon)).deep.eq(['animal', 'vp']);
      expect(actionPreview(player, birds).branches[0].effects[1]).deep.include({current: 0, resulting: 1});
      expect(actionPreview(player, shading).branches[0].effects.every((e) => e.icon !== 'vp')).is.true;
    });

    it('the third floater scores: 2 → 3 floaters, 0 → 1 VP', () => {
      const card = new CloudTourism();
      const [game, player] = testGame(1);
      player.playedCards.push(card);
      card.resourceCount = 2;
      expect(card.getVictoryPoints(player)).eq(0);
      cast(card.action(player), undefined);
      runAllActions(game);
      expect(card.resourceCount).eq(3);
      expect(card.getVictoryPoints(player)).eq(1);
    });

    it('available in the same generation it was played', () => {
      const card = new CloudTourism();
      const [game, player] = testGame(1);
      player.playCard(card);
      runAllActions(game);
      expect(card.canAct(player)).is.true;
    });
  });

  describe('rule 5 — the deal, save / reload, MarsBot', () => {
    function dealt(opts: Partial<GameOptions>): Array<CardName> {
      return new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
    }

    it('dealt with Prelude 2 + Venus; absent without Venus; off the hold-back list', () => {
      expect(dealt({prelude2Expansion: true, venusNextExtension: true})).include(CardName.CLOUD_TOURISM);
      expect(dealt({prelude2Expansion: true, venusNextExtension: false})).not.include(CardName.CLOUD_TOURISM);
      expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.CLOUD_TOURISM)).is.false;
    });

    it('save / reload: the card on the table with its floaters', () => {
      const card = new CloudTourism();
      const [game, player] = testGame(2, {venusNextExtension: true});
      player.playedCards.push(card);
      card.resourceCount = 2;
      const reloaded = Game.deserialize(structuredClone(game.serialize()));
      const owner = reloaded.getPlayerById(player.id);
      expect(owner.playedCards.get(CardName.CLOUD_TOURISM)?.resourceCount).eq(2);
    });

    it('MarsBot at the table (the card brought in by hand): the human counts their own tags only', () => {
      const [game, human] = testAutomaGame({venusNextExtension: true});
      game.phase = Phase.ACTION;
      const card = new CloudTourism();
      human.tagsForTest = {earth: 1, venus: 0};
      const production = human.production.megacredits;
      cast(card.play(human), undefined);
      runAllActions(game);
      expect(human.production.megacredits - production).eq(1);
    });
  });
});

import {expect} from 'chai';
import {cast} from '@/common/utils/utils';
import {toName} from '../../../src/common/utils/utils';
import {FloatingRefinery} from '../../../src/server/cards/prelude2/FloatingRefinery';
import {OrOptions} from '../../../src/server/inputs/OrOptions';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {TitanShuttles} from '../../../src/server/cards/colonies/TitanShuttles';
import {FloatingHabs} from '../../../src/server/cards/venusNext/FloatingHabs';
import {MartianCulture} from '../../../src/server/cards/pathfinders/MartianCulture';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {ICard} from '../../../src/server/cards/ICard';
import {runAllActions} from '../../TestingUtils';
import {IGame} from '../../../src/server/IGame';
import {FLOATING_REFINERY_ADD_TITLE, FLOATING_REFINERY_NO_SOURCE, FLOATING_REFINERY_REMOVE_TITLE} from '../../../src/server/cards/prelude2/FloatingRefinery';
import {CardName} from '../../../src/common/cards/CardName';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {CardResource} from '../../../src/common/CardResource';
import {Resource} from '../../../src/common/Resource';
import {SelectCardModel} from '../../../src/common/models/PlayerInputModel';
import {PRELUDE2_CARD_MANIFEST} from '../../../src/server/cards/prelude2/Prelude2CardManifest';
import {PRELUDE2_CARDS_HELD_BACK} from '../../../src/common/cards/prelude2Adaptation';
import {actionPreview, countedPlayEffects} from '../../../src/server/models/actionPreview';
import {holderActionGoodOf} from '../../../src/server/cards/holderActionGood';
import {GameCards} from '../../../src/server/GameCards';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {Game} from '../../../src/server/Game';
import {Dirigibles} from '../../../src/server/cards/venusNext/Dirigibles';
import {VenusGovernor} from '../../../src/server/cards/venusNext/VenusGovernor';
import {StormCraftIncorporated} from '../../../src/server/cards/colonies/StormCraftIncorporated';

describe('FloatingRefinery', () => {
  let card: FloatingRefinery;
  let player: TestPlayer;
  let game: IGame;

  let floater1: IProjectCard;
  let floater2: IProjectCard;
  let other: IProjectCard;

  beforeEach(() => {
    card = new FloatingRefinery();
    floater1 = new TitanShuttles();
    floater2 = new FloatingHabs();
    other = new MartianCulture();
    [game, player] = testGame(2, {preludeExtension: true});
    player.playedCards.push(floater1, floater2, other);
  });

  it('Play', () => {
    player.tagsForTest = {venus: 5};
    card.play(player);
    runAllActions(game);

    expect(card.resourceCount).to.eq(6);
  });

  it('Add resources', () => {
    player.playedCards.push(card);
    cast(card.action(player), undefined);
    expect(card.resourceCount).to.eq(1);
  });

  it('Remove resource - this card', () => {
    player.playedCards.push(card);
    card.resourceCount = 3;
    const orOptions = cast(card.action(player), OrOptions);
    cast(card.action(player), OrOptions);
    const selectCard = cast(orOptions.options[0].cb(), SelectCard<ICard>);
    expect(selectCard.cards.map(toName)).deep.eq([card.name]);
    selectCard.cb([card]);
    expect(player.stock.titanium).to.eq(1);
    expect(player.stock.megacredits).to.eq(2);
    expect(card.resourceCount).to.eq(1);
  });

  it('act - two cards with 2 floaters - select 1st', () => {
    card.resourceCount = 1;
    floater1.resourceCount = 2;
    floater2.resourceCount = 2;
    other.resourceCount = 1;

    const orOptions = cast(card.action(player), OrOptions);
    cast(card.action(player), OrOptions);
    const selectCard = cast(orOptions.options[0].cb(), SelectCard<ICard>);
    expect(selectCard.cards).has.length(2);
    selectCard.cb([selectCard.cards[0]]);
    expect(floater1.resourceCount).eq(0);
    expect(floater2.resourceCount).eq(2);
    expect(other.resourceCount).eq(1);
    expect(card.resourceCount).eq(1);
    expect(player.stock.titanium).to.eq(1);
    expect(player.stock.megacredits).to.eq(2);
  });

  it('act - two cards with 2 floaters - select 2nd', () => {
    card.resourceCount = 1;
    floater1.resourceCount = 2;
    floater2.resourceCount = 2;
    other.resourceCount = 1;

    const orOptions = cast(card.action(player), OrOptions);
    cast(card.action(player), OrOptions);
    const selectCard = cast(orOptions.options[0].cb(), SelectCard<ICard>);
    expect(selectCard.cards).has.length(2);
    selectCard.cb([selectCard.cards[1]]);
    expect(floater1.resourceCount).eq(2);
    expect(floater2.resourceCount).eq(0);
    expect(other.resourceCount).eq(1);
    expect(card.resourceCount).eq(1);
    expect(player.stock.titanium).to.eq(1);
    expect(player.stock.megacredits).to.eq(2);
  });
});

describe('FloatingRefinery — premium (P73)', () => {
  function table(): {game: IGame, player: TestPlayer, card: FloatingRefinery} {
    const card = new FloatingRefinery();
    const [game, player] = testGame(2, {venusNextExtension: true, prelude2Expansion: true});
    player.playedCards.push(card);
    return {game, player, card};
  }

  it('rule 1 — the printed card: blue, 7 M€, Venus, a floater holder, no VP, P73, Venus-compatible, no requirement', () => {
    const card = new FloatingRefinery();
    expect(card.type).eq(CardType.ACTIVE);
    expect(card.cost).eq(7);
    expect(card.tags).deep.eq([Tag.VENUS]);
    expect(card.resourceType).eq(CardResource.FLOATER);
    expect(card.victoryPoints).is.undefined;
    expect(card.requirements).is.empty;
    expect(card.metadata.cardNumber).eq('P73');
    expect(PRELUDE2_CARD_MANIFEST.projectCards[CardName.FLOATING_REFINERY]?.compatibility).eq('venus');
  });

  it('rule 2 — the play counts this card\'s own Venus tag: Venus Governor (2) + this = 3 floaters; the forecast says the same number', () => {
    const card = new FloatingRefinery();
    const [game, player] = testGame(2, {venusNextExtension: true});
    player.playedCards.push(new VenusGovernor());
    const chips = countedPlayEffects(player, card);
    expect(chips.map((e) => e.amount)).deep.eq([3]);
    player.playCard(card);
    runAllActions(game);
    expect(card.resourceCount).eq(3);
  });

  it('rule 3 — A always: no card of yours with 2 floaters → the action IS «+1 floater here», no question', () => {
    const {player, card} = table();
    const dirigibles = new Dirigibles();
    player.playedCards.push(dirigibles);
    dirigibles.resourceCount = 1;
    expect(card.canAct()).is.true;
    cast(card.action(player), undefined);
    expect(card.resourceCount).eq(1);
    expect(dirigibles.resourceCount).eq(1);
  });

  it('rule 4 — B: any card of YOURS with 2 floaters (the corporation included), asked even with one candidate; the near miss shown disabled', () => {
    const {game, player, card} = table();
    const stormcraft = new StormCraftIncorporated();
    const dirigibles = new Dirigibles();
    player.playedCards.push(stormcraft, dirigibles);
    stormcraft.resourceCount = 2;
    dirigibles.resourceCount = 1;
    // An opponent's floaters are never a source.
    const opponentHabs = new FloatingHabs();
    player.opponents[0].playedCards.push(opponentHabs);
    opponentHabs.resourceCount = 5;

    const or = cast(card.action(player), OrOptions);
    expect(or.choiceContext?.source).deep.eq({kind: 'card', card: CardName.FLOATING_REFINERY});
    expect(or.choiceContext?.mode).eq('effect-choice');
    const pick = cast(or.options[0].cb(), SelectCard<ICard>);
    expect(pick.cards.map(toName)).deep.eq([CardName.STORMCRAFT_INCORPORATED]);
    expect(pick.choiceContext?.source).deep.eq({kind: 'card', card: CardName.FLOATING_REFINERY});
    expect(JSON.stringify(pick.toModel(player))).contains(CardName.DIRIGIBLES);

    const titanium = player.stock.titanium;
    const megacredits = player.stock.megacredits;
    pick.cb([stormcraft]);
    expect(stormcraft.resourceCount).eq(0);
    expect(player.stock.titanium - titanium).eq(1);
    expect(player.stock.megacredits - megacredits).eq(2);
    expect(opponentHabs.resourceCount).eq(5);
    // The journal: the spend names its card, the gains go through the stock.
    expect(game.gameLog.map((l) => l.message)).include('${0} spent ${1} ${2} from ${3}');
  });

  describe('rule 5 — the preview mirrors the live order [B, A]', () => {
    it('two sources: B first (index 0) with its source step — the candidates the action asks, −2 each; A second (index 1)', () => {
      const {player, card} = table();
      const dirigibles = new Dirigibles();
      const habs = new FloatingHabs();
      player.playedCards.push(dirigibles, habs);
      dirigibles.resourceCount = 3;
      habs.resourceCount = 2;
      card.resourceCount = 1;

      const [b, a] = actionPreview(player, card).branches;
      expect(b.index).eq(0);
      expect(b.title).eq(FLOATING_REFINERY_REMOVE_TITLE);
      expect(b.available).is.true;
      expect(b.effects.map((e) => [e.direction, e.icon, e.amount])).deep.eq([
        ['cost', 'floater', 2],
        ['gain', 'titanium', 1],
        ['gain', 'megacredits', 2],
      ]);
      const step = b.steps[0];
      expect(step?.kind).eq('input');
      if (step?.kind === 'input') {
        expect(step.amount).eq(-2);
        expect((step.input as SelectCardModel).cards.map((c) => c.name)).deep.eq([CardName.DIRIGIBLES, CardName.FLOATING_HABS]);
        // Floating Habs scores 1 VP per 2 floaters: taking 2 costs it a point — the reading the pick needs.
        expect(step.vpBox?.[CardName.FLOATING_HABS]).deep.eq({from: 1, to: 0});
      }
      expect(a.index).eq(1);
      expect(a.title).eq(FLOATING_REFINERY_ADD_TITLE);
      expect(a.effects[0]).deep.include({direction: 'gain', amount: 1, current: 1, resulting: 2});

      // The live prompt answers the same indices: option 0 is the source pick over the same cards.
      const or = cast(card.action(player), OrOptions);
      const pick = cast(or.options[0].cb(), SelectCard<ICard>);
      expect(pick.cards.map(toName)).deep.eq([CardName.DIRIGIBLES, CardName.FLOATING_HABS]);
    });

    it('a sole source is still a step (the composer sows it and SHOWS it — T14)', () => {
      const {player, card} = table();
      card.resourceCount = 2;
      const [b] = actionPreview(player, card).branches;
      const step = b.steps[0];
      expect(step?.kind).eq('input');
      if (step?.kind === 'input') {
        expect((step.input as SelectCardModel).cards.map((c) => c.name)).deep.eq([CardName.FLOATING_REFINERY]);
      }
    });

    it('no source: B SHOWN unavailable with its reason, A the lone live variant (index −1 — the server asks nothing)', () => {
      const {player, card} = table();
      card.resourceCount = 1;
      const [b, a] = actionPreview(player, card).branches;
      expect(b.available).is.false;
      expect(b.unavailableReason).eq(FLOATING_REFINERY_NO_SOURCE);
      expect(b.steps).is.empty;
      expect(a.available).is.true;
      expect(a.index).eq(-1);
    });

    it('read-only: the preview moves no floater and no stock', () => {
      const {player, card} = table();
      const habs = new FloatingHabs();
      player.playedCards.push(habs);
      habs.resourceCount = 4;
      card.resourceCount = 2;
      const snapshot = () => JSON.stringify([card.resourceCount, habs.resourceCount, player.stock.titanium, player.stock.megacredits]);
      const before = snapshot();
      actionPreview(player, card);
      expect(snapshot()).eq(before);
    });
  });

  it('rule 6 — the holder\'s role: 2 floaters here buy the SET «+1 titanium AND +2 M€»', () => {
    expect(holderActionGoodOf(new FloatingRefinery())).deep.eq({
      spend: 2,
      good: {kind: 'stock', resource: Resource.TITANIUM, amount: 1},
      with: [{kind: 'stock', resource: Resource.MEGACREDITS, amount: 2}],
    });
  });

  it('the deal: dealt with Prelude 2 + Venus, absent without Venus, off the hold-back list', () => {
    const dealt = (opts: Partial<GameOptions>) => new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
    expect(dealt({prelude2Expansion: true, venusNextExtension: true})).include(CardName.FLOATING_REFINERY);
    expect(dealt({prelude2Expansion: true, venusNextExtension: false})).not.include(CardName.FLOATING_REFINERY);
    expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.FLOATING_REFINERY)).is.false;
  });

  it('save / reload: the card keeps its floaters', () => {
    const {game, player, card} = table();
    card.resourceCount = 3;
    const reloaded = Game.deserialize(structuredClone(game.serialize()));
    expect(reloaded.getPlayerById(player.id).playedCards.get(CardName.FLOATING_REFINERY)?.resourceCount).eq(3);
  });
});

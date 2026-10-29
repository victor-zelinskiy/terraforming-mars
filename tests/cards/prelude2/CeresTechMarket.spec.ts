import {expect} from 'chai';
import {CERES_TECH_MARKET_NO_CARDS_REASON, CeresTechMarket} from '@/server/cards/prelude2/CeresTechMarket';
import {Research} from '@/server/cards/base/Research';
import {Tardigrades} from '@/server/cards/base/Tardigrades';
import {Callisto} from '@/server/colonies/Callisto';
import {Ceres} from '@/server/colonies/Ceres';
import {Miranda} from '@/server/colonies/Miranda';
import {ICard} from '@/server/cards/ICard';
import {IGame} from '@/server/IGame';
import {SelectCard} from '@/server/inputs/SelectCard';
import {TestPlayer} from '../../TestPlayer';
import {testGame} from '../../TestGame';
import {cast} from '@/common/utils/utils';
import {Ants} from '@/server/cards/base/Ants';
import {IProjectCard} from '@/server/cards/IProjectCard';
import {runAllActions} from '../../TestingUtils';
import {Game} from '@/server/Game';
import {GameCards} from '@/server/GameCards';
import {PRELUDE2_CARD_MANIFEST} from '@/server/cards/prelude2/Prelude2CardManifest';
import {PRELUDE2_CARDS_HELD_BACK} from '@/common/cards/prelude2Adaptation';
import {cardPlayPreview} from '@/server/models/cardPlayPreview';
import {actionPreview, countedPlayEffects} from '@/server/models/actionPreview';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {Phase} from '@/common/Phase';
import {ActionEffect, ActionPreviewStep} from '@/common/models/ActionPreviewModel';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '@/server/game/GameOptions';
import {testAutomaGame} from '../../automa/AutomaTestGame';

describe('CeresTechMarket', () => {
  let card: CeresTechMarket;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new CeresTechMarket();
    [game, player] = testGame(2, {coloniesExtension: true});
    game.colonies = [new Callisto(), new Ceres(), new Miranda()];
  });

  for (const run of [
    {colonies: 0, expected: 0},
    {colonies: 1, expected: 2},
    {colonies: 2, expected: 4},
    {colonies: 3, expected: 6},
  ] as const) {
    it('play ' + JSON.stringify(run), () => {
      game.colonies[0].colonies = Array(run.colonies).fill(player.id);
      card.play(player);
      expect(player.megaCredits).to.eq(run.expected);
    });
  }

  it('canAct', () => {
    expect(card.canAct(player)).is.false;

    player.cardsInHand.push(new Research());
    expect(card.canAct(player)).is.true;
  });

  it('action allows discarding 0 cards', () => {
    const research = new Research();
    player.cardsInHand.push(research);

    const selectCard = cast(card.action(player), SelectCard<ICard>);
    selectCard.cb([]);

    expect(player.megaCredits).to.eq(0);
    expect(player.cardsInHand).deep.eq([research]);
  });

  it('action discards N cards for 2 M€ each', () => {
    const research = new Research();
    const tardigrades = new Tardigrades();
    player.cardsInHand.push(research, tardigrades);

    const selectCard = cast(card.action(player), SelectCard<ICard>);
    selectCard.cb([research, tardigrades]);

    expect(player.megaCredits).to.eq(4);
    expect(player.cardsInHand).has.lengthOf(0);
    expect(game.projectDeck.discardPile).deep.eq([research, tardigrades]);
  });
});

describe('CeresTechMarket — premium', () => {
  type Table = {game: IGame, p1: TestPlayer, p2: TestPlayer, card: CeresTechMarket};

  /** A two-seat Colonies + Prelude 2 table in the action phase, the card on p1's table (`onTable`) or not yet played. */
  function table(onTable = true): Table {
    const [game, p1, p2] = testGame(2, {coloniesExtension: true, prelude2Expansion: true});
    game.phase = Phase.ACTION;
    game.colonies = [new Callisto(), new Ceres(), new Miranda()];
    const card = new CeresTechMarket();
    if (onTable) {
      p1.playedCards.push(card);
    }
    return {game, p1, p2, card};
  }

  function deal(t: Table, ...cards: Array<IProjectCard>): Array<IProjectCard> {
    t.p1.cardsInHand.push(...cards);
    return cards;
  }

  /** The action under ITS scope (the engine's own `card-action` root); the test answers the live prompt. */
  function act(t: Table, answer: (input: SelectCard<IProjectCard>) => void): void {
    const events = t.game.events;
    events.beginAction(t.p1, {kind: 'card', card: CardName.CERES_TECH_MARKET, owner: t.p1.color}, {category: 'card-action'});
    try {
      answer(cast(t.card.action(t.p1), SelectCard<IProjectCard>));
      runAllActions(t.game);
    } finally {
      events.endScope();
    }
  }

  const gainOf = (effects: ReadonlyArray<ActionEffect>, icon: string) => effects.find((e) => e.direction === 'gain' && e.icon === icon);

  it('rule 1 — the printed card: blue, 12 M€, Science + Space, 1 VP, P68, Colonies-compatible, no requirement, not political', () => {
    const c = new CeresTechMarket();
    expect(c.type).eq(CardType.ACTIVE);
    expect(c.cost).eq(12);
    expect(c.tags).deep.eq([Tag.SCIENCE, Tag.SPACE]);
    expect(c.victoryPoints).eq(1);
    expect(c.requirements).is.empty;
    expect(c.metadata.cardNumber).eq('P68');
    expect(c.metadata.description).eq('Gain 2 M€ per colony you own.');
    const spec = PRELUDE2_CARD_MANIFEST.projectCards[CardName.CERES_TECH_MARKET];
    expect(spec?.compatibility).eq('colonies');
    expect(spec?.politics, 'not a political card').is.undefined;
  });

  it('rule 1 — paid in M€ and titanium (a Space tag), never steel', () => {
    const t = table();
    const c = new CeresTechMarket();
    const options = t.p1.paymentOptionsForCard(c);
    expect(options.titanium).is.true;
    expect(options.steel).is.false;
  });

  describe('rule 2 — the play: 2 M€ per OWN colony', () => {
    it('two own colonies → +4 through the stock; another seat\'s colonies count nothing', () => {
      const t = table(false);
      t.game.colonies[0].colonies.push(t.p1.id, t.p1.id);
      t.game.colonies[1].colonies.push(t.p2.id, t.p2.id, t.p2.id);
      const c = new CeresTechMarket();
      t.p1.cardsInHand.push(c);
      t.p1.megaCredits = 12;
      const from = t.game.events.events.length;
      t.p1.playCard(c);
      runAllActions(t.game);
      expect(t.p1.megaCredits).eq(12 + 4);
      const mine = t.game.events.events.slice(from).filter((e) => e.player === t.p1.color && e.type === 'resource-changed');
      expect(mine.some((e) => (e.impact?.stock?.megacredits ?? 0) === 4), JSON.stringify(mine.map((e) => e.impact))).is.true;
    });

    it('the forecast before the press: ONE counted term «Your colonies» with the server\'s count, the sum multiplied by the rate; read-only', () => {
      const t = table(false);
      t.game.colonies[0].colonies.push(t.p1.id);
      t.game.colonies[2].colonies.push(t.p1.id);
      const c = new CeresTechMarket();
      t.p1.cardsInHand.push(c);
      const before = JSON.stringify(t.game.serialize());
      const mc = gainOf(countedPlayEffects(t.p1, c), 'megacredits');
      expect(mc?.amount).eq(4);
      expect(mc?.basis).deep.eq([{count: 2, label: 'Your colonies'}]);
      const preview = cardPlayPreview(t.p1, c);
      expect(preview.kind, 'a declaration — no hook').eq('declarative');
      expect(gainOf(preview.branches.flatMap((b) => b.effects), 'megacredits')?.amount).eq(4);
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });

    it('no colony: an honest zero — no M€ event, the count says 0', () => {
      const t = table(false);
      const c = new CeresTechMarket();
      t.p1.cardsInHand.push(c);
      t.p1.megaCredits = 12;
      expect(gainOf(countedPlayEffects(t.p1, c), 'megacredits')?.basis).deep.eq([{count: 0, label: 'Your colonies'}]);
      const from = t.game.events.events.length;
      t.p1.playCard(c);
      runAllActions(t.game);
      expect(t.p1.megaCredits, 'the test play pays no price — nothing gained').eq(12);
      const mine = t.game.events.events.slice(from).filter((e) => e.player === t.p1.color);
      expect(mine.some((e) => e.type === 'resource-changed' && (e.impact?.stock?.megacredits ?? 0) > 0), 'no «+0» in the journal').is.false;
    });
  });

  describe('rule 3 — the action: available with a card in hand, NAMED otherwise', () => {
    it('an empty hand: `canAct` false, the reason «No cards in hand», and the preview\'s branch carries it', () => {
      const t = table();
      expect(t.card.canAct(t.p1)).is.false;
      expect(t.card.actionUnavailableReason(t.p1)).deep.eq({type: 'rule', message: CERES_TECH_MARKET_NO_CARDS_REASON});
      const branch = actionPreview(t.p1, t.card).branches[0];
      expect(branch.available).is.false;
      expect(branch.unavailableReason).eq('No cards in hand');
    });

    it('a card in hand: available, no reason', () => {
      const t = table();
      deal(t, new Research());
      expect(t.card.canAct(t.p1)).is.true;
      expect(t.card.actionUnavailableReason(t.p1)).is.undefined;
    });

    it('the live prompt: a SelectCard over the whole hand, min 1 (decision 3), max = the hand; the marker SERIALIZED with the same bounds and the rate', () => {
      const t = table();
      deal(t, new Research(), new Tardigrades(), new Ants());
      const input = cast(t.card.action(t.p1), SelectCard<IProjectCard>);
      expect(input.cards.map((c) => c.name)).deep.eq([CardName.RESEARCH, CardName.TARDIGRADES, CardName.ANTS]);
      expect(input.config.min).eq(1);
      expect(input.config.max).eq(3);
      const model = input.toModel(t.p1);
      expect(model.discardPrompt).deep.eq({
        min: 1,
        max: 3,
        source: {kind: 'card', card: CardName.CERES_TECH_MARKET},
        exchange: {icon: 'megacredits', amount: 2, perCard: true},
      });
      expect(model.min, 'the prompt\'s min and its marker\'s min are ONE number').eq(model.discardPrompt?.min);
    });

    it('an answer of zero cards is REFUSED (`min 1`) — nothing is discarded, nothing paid', () => {
      const t = table();
      const [research] = deal(t, new Research());
      const input = cast(t.card.action(t.p1), SelectCard<IProjectCard>);
      expect(() => input.process({type: 'card', cards: []})).to.throw(/Not enough cards selected/);
      expect(t.p1.cardsInHand).deep.eq([research]);
      expect(t.p1.megaCredits).eq(0);
    });
  });

  describe('rule 4 — the answer: the cards to the discard pile by name, +2 M€ each through the stock', () => {
    it('two of three: discarded in the order chosen, +4 M€ as a `resource-changed` of THIS card under the action\'s root, the third kept', () => {
      const t = table();
      const [research, tardigrades, ants] = deal(t, new Research(), new Tardigrades(), new Ants());
      const from = t.game.events.events.length;
      act(t, (input) => input.process({type: 'card', cards: [CardName.TARDIGRADES, CardName.RESEARCH]}));
      expect(t.p1.megaCredits).eq(4);
      expect(t.p1.cardsInHand).deep.eq([ants]);
      expect(t.game.projectDeck.discardPile.slice(-2)).deep.eq([tardigrades, research]);
      const mine = t.game.events.events.slice(from).filter((e) => e.player === t.p1.color);
      const paid = mine.find((e) => e.type === 'resource-changed' && (e.impact?.stock?.megacredits ?? 0) === 4);
      expect(paid, JSON.stringify(mine.map((e) => [e.type, e.impact]))).is.not.undefined;
      expect(paid?.source).deep.include({kind: 'card', card: CardName.CERES_TECH_MARKET});
      expect(paid?.parentId, 'recorded under the action\'s own scope').is.not.undefined;
    });

    it('the whole hand: the hand is empty and the action is blocked with its reason afterwards', () => {
      const t = table();
      deal(t, new Research(), new Tardigrades());
      act(t, (input) => input.process({type: 'card', cards: [CardName.RESEARCH, CardName.TARDIGRADES]}));
      expect(t.p1.cardsInHand).is.empty;
      expect(t.p1.megaCredits).eq(4);
      expect(t.card.canAct(t.p1)).is.false;
      expect(t.card.actionUnavailableReason(t.p1)?.message).eq(CERES_TECH_MARKET_NO_CARDS_REASON);
    });
  });

  describe('rule 5 — the preview: ONE discard step over the hand, the live prompt\'s own marker; no counted chip', () => {
    it('one branch, one step: the hand, min 1 / max N, «select all», the rate as `revealGain`, addressed to this card\'s discard; read-only', () => {
      const t = table();
      deal(t, new Research(), new Tardigrades());
      const before = JSON.stringify(t.game.serialize());
      const preview = actionPreview(t.p1, t.card);
      expect(preview.branches).has.length(1);
      const branch = preview.branches[0];
      expect(branch.available).is.true;
      expect(branch.effects, 'the sum is the player\'s, not the table\'s').is.empty;
      const steps = branch.steps.filter((s): s is Extract<ActionPreviewStep, {kind: 'input'}> => s.kind === 'input');
      expect(steps).has.length(1);
      const step = steps[0];
      const input = step.input;
      if (input.type !== 'card') {
        throw new Error('not a card step');
      }
      expect(input.cards.map((c) => c.name)).deep.eq([CardName.RESEARCH, CardName.TARDIGRADES]);
      expect(input.min).eq(1);
      expect(input.max).eq(2);
      expect(input.showSelectAll).is.true;
      expect(step.multiSelect?.revealGain).deep.eq({resource: 'megacredits', amount: 2});
      expect(step.for).deep.eq({role: 'discard', source: {kind: 'card', card: CardName.CERES_TECH_MARKET}});
      const live = cast(t.card.action(t.p1), SelectCard<IProjectCard>).toModel(t.p1);
      expect(input.discardPrompt, 'the live prompt\'s marker, word for word').deep.eq(live.discardPrompt);
      expect(JSON.stringify(t.game.serialize())).eq(before);
    });
  });

  describe('rule 6 — the deal, save / reload, MarsBot', () => {
    function dealt(opts: Partial<GameOptions>): Array<CardName> {
      return new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
    }

    it('dealt with Prelude 2 + Colonies; absent without Colonies, absent without Prelude 2', () => {
      expect(dealt({prelude2Expansion: true, coloniesExtension: true})).include(CardName.CERES_TECH_MARKET);
      expect(dealt({prelude2Expansion: true, coloniesExtension: false})).not.include(CardName.CERES_TECH_MARKET);
      expect(dealt({prelude2Expansion: false, coloniesExtension: true})).not.include(CardName.CERES_TECH_MARKET);
      expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.CERES_TECH_MARKET)).is.false;
    });

    it('save / reload: the card on the table, the hand and the M€ kept', () => {
      const t = table();
      deal(t, new Research(), new Tardigrades());
      act(t, (input) => input.process({type: 'card', cards: [CardName.RESEARCH]}));
      const reloaded = Game.deserialize(structuredClone(t.game.serialize()));
      const owner = reloaded.getPlayerById(t.p1.id);
      expect(owner.playedCards.get(CardName.CERES_TECH_MARKET)).is.not.undefined;
      expect(owner.cardsInHand.map((c) => c.name)).deep.eq([CardName.TARDIGRADES]);
      expect(owner.megaCredits).eq(2);
    });

    it('MarsBot at the table (the card brought in by hand): the human\'s action is the human\'s — the bot takes nothing', () => {
      const [game, human, bot] = testAutomaGame({coloniesExtension: true});
      game.phase = Phase.ACTION;
      const c = new CeresTechMarket();
      human.playedCards.push(c);
      human.cardsInHand.push(new Research(), new Tardigrades());
      const mc = human.megaCredits;
      const botState = () => JSON.stringify({mc: bot.megaCredits, hand: bot.cardsInHand.length});
      const botBefore = botState();
      cast(c.action(human), SelectCard<IProjectCard>).process({type: 'card', cards: [CardName.RESEARCH, CardName.TARDIGRADES]});
      runAllActions(game);
      expect(human.megaCredits - mc).eq(4);
      expect(botState()).eq(botBefore);
    });
  });
});

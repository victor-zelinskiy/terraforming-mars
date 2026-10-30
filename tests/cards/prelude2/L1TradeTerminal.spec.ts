import {expect} from 'chai';
import {L1_TRADE_TERMINAL_EMPTY_WARNING, L1_TRADE_TERMINAL_PROMPT, L1TradeTerminal} from '../../../src/server/cards/prelude2/L1TradeTerminal';
import {testGame} from '../../TestGame';
import {runAllActions} from '../../TestingUtils';
import {TestPlayer} from '../../TestPlayer';
import {SelectCard} from '../../../src/server/inputs/SelectCard';
import {CardName} from '../../../src/common/cards/CardName';
import {cardsFromJSON} from '../../../src/server/createCard';
import {SelfReplicatingRobots} from '../../../src/server/cards/promo/SelfReplicatingRobots';
import {toName, zip} from '../../../src/common/utils/utils';
import {IGame} from '../../../src/server/IGame';
import {cast} from '../../../src/common/utils/utils';
import {Game} from '../../../src/server/Game';
import {GameCards} from '../../../src/server/GameCards';
import {Luna} from '../../../src/server/colonies/Luna';
import {IColony} from '../../../src/server/colonies/IColony';
import {TradeEnvoys} from '../../../src/server/cards/colonies/TradeEnvoys';
import {trackTop} from '../../../src/common/colonies/ColonyMetadata';
import {cardPlayPreview} from '../../../src/server/models/cardPlayPreview';
import {SKIP_REASON, SKIPPED_LABEL} from '../../../src/server/cards/actionPreviews';
import {ActionPreviewStep} from '../../../src/common/models/ActionPreviewModel';
import {SelectCardModel} from '../../../src/common/models/PlayerInputModel';
import {PRELUDE2_CARDS_HELD_BACK} from '../../../src/common/cards/prelude2Adaptation';
import {DEFAULT_GAME_OPTIONS, GameOptions} from '../../../src/server/game/GameOptions';
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Phase} from '../../../src/common/Phase';
import {testAutomaGame} from '../../automa/AutomaTestGame';

describe('L1TradeTerminal', () => {
  let card: L1TradeTerminal;
  let player: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    card = new L1TradeTerminal();
    [game, player] = testGame(2, {coloniesExtension: true});
  });

  // FORK: upstream applied the resources SILENTLY when there were 3 or fewer candidates. The fork never applies a
  // target without showing it (docs/DELAYED_TARGET_AUDIT.md § prelude2 — «the fix is the always-shown SelectCard +
  // pre-collect»), so every run with a candidate now ASKS, and the run answers with every candidate.
  const playRuns = [
    {cards: [CardName.AERIAL_MAPPERS, CardName.ANTHOZOA, CardName.ANTS, CardName.TARDIGRADES], counts: [0, 0, 0, 0], expected: [0, 0, 0, 0]},
    {cards: [CardName.AERIAL_MAPPERS, CardName.ANTHOZOA, CardName.ANTS, CardName.TARDIGRADES], counts: [1, 1, 0, 0], expected: [2, 2, 0, 0]},
    {cards: [CardName.AERIAL_MAPPERS, CardName.ANTHOZOA, CardName.ANTS, CardName.TARDIGRADES], counts: [1, 1, 0, 1], expected: [2, 2, 0, 2]},
  ] as const;
  for (const run of playRuns) {
    it('play ' + JSON.stringify(run), () => {
      const cards = cardsFromJSON(run.cards);
      player.playedCards.push(...cards);
      zip(cards, run.counts).forEach(([card, count]) => card.resourceCount = count);

      const input = card.play(player);
      if (run.counts.some((c) => c > 0)) {
        const selectCard = cast(input, SelectCard);
        selectCard.cb(selectCard.cards);
      } else {
        cast(input, undefined);
      }

      expect(cards.map((card) => card.resourceCount)).deep.eq(run.expected);
    });
  }

  it('include Self-Replicating Robots', () => {
    const srr = new SelfReplicatingRobots();
    player.playedCards.push(srr);

    const cards = cardsFromJSON([CardName.AERIAL_MAPPERS, CardName.ANTHOZOA, CardName.ANTS, CardName.TARDIGRADES]);
    srr.targetCards.push(...cards);

    cards[2].resourceCount = 1;

    // FORK: one candidate is still a question (no auto-select).
    const selectCard = cast(card.play(player), SelectCard);
    expect(selectCard.cards.map(toName)).deep.eq([CardName.ANTS]);
    selectCard.cb(selectCard.cards);

    expect(cards[2].resourceCount).eq(2);
  });

  it('When in Self-Replicating Robots, do not count it', () => {
    const srr = new SelfReplicatingRobots();
    player.playedCards.push(srr);

    const cards = cardsFromJSON([CardName.AERIAL_MAPPERS, CardName.ANTHOZOA, CardName.ANTS, CardName.TARDIGRADES]);
    srr.targetCards.push(...cards, card);
    card.resourceCount = 4;
    cards.forEach((card) => card.resourceCount = 1);

    player.playCard(card);
    runAllActions(game);
    const selectCard = cast(player.popWaitingFor(), SelectCard);

    expect(selectCard.cards.map(toName)).to.have.members([
      CardName.AERIAL_MAPPERS,
      CardName.ANTHOZOA,
      CardName.ANTS,
      CardName.TARDIGRADES,
    ]);
    expect(card.resourceCount).eq(0);
  });

  it('more than 3 candidates', () => {
    const [aerialMappers, anthozoa, ants, tardigrades, appliedScience] = cardsFromJSON([CardName.AERIAL_MAPPERS, CardName.ANTHOZOA, CardName.ANTS, CardName.TARDIGRADES, CardName.APPLIED_SCIENCE]);
    player.playedCards.push(aerialMappers, anthozoa, ants, tardigrades, appliedScience);
    // Every card except Tardigrades has a resource.
    aerialMappers.resourceCount = 1;
    anthozoa.resourceCount = 1;
    ants.resourceCount = 1;
    tardigrades.resourceCount = 0;
    appliedScience.resourceCount = 1;

    const selectCard = cast(card.play(player), SelectCard);

    expect(selectCard.cards.map(toName)).deep.eq([CardName.AERIAL_MAPPERS, CardName.ANTHOZOA, CardName.ANTS, CardName.APPLIED_SCIENCE]);

    selectCard.cb([aerialMappers, ants, appliedScience]);

    expect(aerialMappers.resourceCount).eq(2);
    expect(anthozoa.resourceCount).eq(1);
    expect(ants.resourceCount).eq(2);
    expect(tardigrades.resourceCount).eq(0);
    expect(appliedScience.resourceCount).eq(2);
  });

  // FORK (rewritten — upstream: «automatically adds resources if there are 3 or fewer candidates»). The fork never
  // applies a target unseen (docs/DELAYED_TARGET_AUDIT.md): 1–3 candidates STILL ask; the console's composer
  // pre-selects them all (ledger CU), the server still asks.
  it('1–3 candidates: STILL asks — nothing applied before the answer', () => {
    const [aerialMappers, tardigrades, ants] = cardsFromJSON([CardName.AERIAL_MAPPERS, CardName.TARDIGRADES, CardName.ANTS]);
    player.playedCards.push(aerialMappers, tardigrades, ants);
    aerialMappers.resourceCount = 1;
    tardigrades.resourceCount = 1;
    ants.resourceCount = 1;

    const selectCard = cast(card.play(player), SelectCard);
    expect(selectCard.config.max).eq(3);
    expect(selectCard.config.min).eq(0);
    expect([aerialMappers, tardigrades, ants].map((c) => c.resourceCount)).deep.eq([1, 1, 1]);

    selectCard.cb(selectCard.cards);

    expect(aerialMappers.resourceCount).eq(2);
    expect(tardigrades.resourceCount).eq(2);
    expect(ants.resourceCount).eq(2);
  });

  // FORK (rewritten — upstream: «does not automatically add resources for vermin»): the same question as any other.
  it('vermin among 3: asks, nothing pre-applied', () => {
    const [aerialMappers, tardigrades, vermin] = cardsFromJSON([CardName.AERIAL_MAPPERS, CardName.TARDIGRADES, CardName.VERMIN]);
    player.playedCards.push(aerialMappers, tardigrades, vermin);
    aerialMappers.resourceCount = 1;
    tardigrades.resourceCount = 1;
    vermin.resourceCount = 1;

    const selectCard = cast(card.play(player), SelectCard);
    expect(selectCard.cards.map(toName)).deep.eq([CardName.AERIAL_MAPPERS, CardName.TARDIGRADES, CardName.VERMIN]);
    expect(aerialMappers.resourceCount).eq(1);
    expect(tardigrades.resourceCount).eq(1);
    expect(vermin.resourceCount).eq(1);
  });

  describe('premium (the fork)', () => {
    let luna: IColony;

    beforeEach(() => {
      luna = new Luna();
      game.colonies = [luna];
      game.phase = Phase.ACTION;
    });

    /** The preview's card steps (the slots of the one merged «up to 3»). */
    function slotsOf(): Array<ActionPreviewStep & {kind: 'input'}> {
      return cardPlayPreview(player, card).branches.flatMap((b) => b.steps)
        .filter((s): s is ActionPreviewStep & {kind: 'input'} => s.kind === 'input' && s.input.type === 'card');
    }

    describe('rule 1 — the printed card', () => {
      it('blue, 25, Space, 2 VP, no requirement, P78, Colonies; the description in place of prose', () => {
        expect(card.type).eq(CardType.ACTIVE);
        expect(card.cost).eq(25);
        expect(card.tags).deep.eq([Tag.SPACE]);
        expect(card.victoryPoints).eq(2);
        expect(card.requirements).deep.eq([]);
        expect(card.metadata.cardNumber).eq('P78');
        expect(card.metadata.description).eq('Add a resource to 3 different cards that already have resources.');
      });

      it('titanium pays for it (a Space tag)', () => {
        player.cardsInHand.push(card);
        player.megaCredits = 0;
        player.titanium = 9;
        expect(player.canPlay(card)).is.true;
      });
    });

    describe('rule 2 — the effect: +2 steps on every trade, the ONE plan', () => {
      it('the play adds a standing offset of 2', () => {
        expect(player.colonies.tradeOffset).eq(0);
        player.playCard(card);
        runAllActions(game);
        expect(player.colonies.tradeOffset).eq(2);
      });

      it('a trade from 4 lands on 6; from 5 the top cuts it at 6 — honestly', () => {
        player.playCard(card);
        runAllActions(game);
        luna.trackPosition = 4;
        expect(luna.tradeTrackPlan(player)).deep.include({current: 4, max: 6, steps: 2, ask: false});
        luna.trackPosition = 5;
        expect(luna.tradeTrackPlan(player)).deep.include({current: 5, max: trackTop(luna.metadata), steps: 1});
      });

      it('the income is the advanced cell\'s, and the steps are attributed to THIS card', () => {
        player.playCard(card);
        runAllActions(game);
        luna.trackPosition = 2;
        const before = player.megaCredits;
        luna.trade(player);
        runAllActions(game);
        // Luna pays [1, 2, 4, 7, 10, 13, 17]: from 2 + 2 = 4 → 10 M€.
        expect(player.megaCredits - before).eq(10);
        const bonus = game.events.events.filter((e) => e.impact.colonyTrackAdvanced !== undefined);
        expect(bonus.map((e) => [(e.source as {card?: string} | undefined)?.card, e.impact.colonyTrackAdvanced![0].steps, e.impact.colonyTrackAdvanced![0].extraReward]))
          .deep.eq([[CardName.L1_TRADE_TERMINAL, 2, 6]]);
      });

      it('beside Trade Envoys: +3, each card attributed its own slice', () => {
        player.playedCards.push(new TradeEnvoys());
        player.colonies.tradeOffset += 1;
        player.playCard(card);
        runAllActions(game);
        luna.trackPosition = 0;
        luna.trade(player);
        runAllActions(game);
        const bonus = game.events.events.filter((e) => e.impact.colonyTrackAdvanced !== undefined)
          .map((e) => [(e.source as {card?: string} | undefined)?.card, e.impact.colonyTrackAdvanced![0].steps]);
        expect(bonus).to.have.deep.members([[CardName.TRADE_ENVOYS, 1], [CardName.L1_TRADE_TERMINAL, 2]]);
      });

      it('the card leaving the table takes its steps with it', () => {
        player.playCard(card);
        runAllActions(game);
        player.playedCards.remove(card);
        card.onDiscard?.(player);
        expect(player.colonies.tradeOffset).eq(0);
      });
    });

    describe('rule 3 — the play ALWAYS asks; the answer feeds each chosen card once', () => {
      it('one candidate: the prompt, max 1', () => {
        const [birds] = cardsFromJSON([CardName.BIRDS]);
        player.playedCards.push(birds);
        birds.resourceCount = 1;
        player.playCard(card);
        runAllActions(game);
        const prompt = cast(player.popWaitingFor(), SelectCard);
        expect(prompt.config).deep.include({min: 0, max: 1});
        expect(birds.resourceCount).eq(1, 'nothing before the answer');
      });

      it('three answered → +1 each, three journal lines; zero answered → nothing, no skip recorded', () => {
        const holders = cardsFromJSON([CardName.ANTS, CardName.BIRDS, CardName.DIRIGIBLES]);
        player.playedCards.push(...holders);
        holders.forEach((c) => c.resourceCount = 1);
        const logBefore = game.gameLog.length;
        const prompt = cast(card.play(player), SelectCard);
        prompt.cb(holders);
        expect(holders.map((c) => c.resourceCount)).deep.eq([2, 2, 2]);
        const added = game.gameLog.slice(logBefore).filter((m) => holders.some((h) => m.data.some((d) => d.value === h.name)));
        expect(added).has.lengthOf(3);

        const again = cast(card.play(player), SelectCard);
        again.cb([]);
        expect(holders.map((c) => c.resourceCount)).deep.eq([2, 2, 2]);
        expect(game.events.events.filter((e) => e.type === 'effect-skipped')).has.lengthOf(0);
      });

      it('an empty table: no prompt, ONE named loss — «add 3 resources to a card», no eligible card', () => {
        player.playCard(card);
        runAllActions(game);
        expect(player.popWaitingFor()).is.undefined;
        const skips = game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);
        expect(skips).deep.eq([{label: SKIPPED_LABEL.addToCard, reason: SKIP_REASON.noHolder, effect: {direction: 'gain', icon: 'resources', amount: 3, note: 'to a card'}}]);
      });

      it('the cards of the other players are never candidates', () => {
        const other = game.players.find((p) => p.id !== player.id)!;
        const [birds] = cardsFromJSON([CardName.BIRDS]);
        other.playedCards.push(birds);
        birds.resourceCount = 3;
        expect(card.play(player)).is.undefined;
      });
    });

    describe('rule 4 — the preview: ONE «up to 3» question, every candidate its own reading; read-only', () => {
      it('three slots merged under the live prompt\'s title; each candidate reads N → N+1 of ITS kind and its VP', () => {
        const [ants, birds, dirigibles, vermin] = cardsFromJSON([CardName.ANTS, CardName.BIRDS, CardName.DIRIGIBLES, CardName.VERMIN]);
        player.playedCards.push(ants, birds, dirigibles, vermin);
        [ants, birds, dirigibles].forEach((c) => c.resourceCount = 1);
        vermin.resourceCount = 1;
        const before = JSON.stringify(game.serialize());
        const preview = cardPlayPreview(player, card);
        expect(JSON.stringify(game.serialize()), 'the preview never mutates').eq(before);

        const branch = preview.branches[0];
        expect(branch.mergeCardSteps).deep.eq({min: 0, title: L1_TRADE_TERMINAL_PROMPT, emptyWarning: L1_TRADE_TERMINAL_EMPTY_WARNING});
        const slots = slotsOf();
        expect(slots).has.lengthOf(3);
        expect(slots.map((s) => s.dedupeFromSteps)).deep.eq([undefined, [0], [0, 1]]);
        const model = slots[0].input as SelectCardModel;
        expect(model.title).deep.eq(L1_TRADE_TERMINAL_PROMPT);
        expect(slots[0].amount).eq(1);
        expect(model.resourceGainPrompt?.cardResourceByCard).deep.include({
          [CardName.ANTS]: 'microbe', [CardName.BIRDS]: 'animal', [CardName.DIRIGIBLES]: 'floater',
        });
        // Birds score per animal: 1 → 2. Vermin's penalty is a bespoke rule (−1 VP per city once 10 animals are
        // here) with no per-count reading — absent, never a fabricated number; its face carries the PENALTY sign
        // (`victoryPointsSign: 'negative'`), which is what keeps the composer from seeding it (ledger CU).
        expect(slots[0].vpBox?.[CardName.BIRDS]).deep.eq({from: 1, to: 2});
        expect(slots[0].vpBox?.[CardName.VERMIN]).is.undefined;
      });

      it('two candidates → two slots (no seat without a card)', () => {
        const [ants, birds] = cardsFromJSON([CardName.ANTS, CardName.BIRDS]);
        player.playedCards.push(ants, birds);
        ants.resourceCount = 1;
        birds.resourceCount = 1;
        expect(slotsOf()).has.lengthOf(2);
      });

      it('Self-Replicating Robots\' cards are candidates of the preview as of the prompt', () => {
        const srr = new SelfReplicatingRobots();
        player.playedCards.push(srr);
        const [ants] = cardsFromJSON([CardName.ANTS]);
        srr.targetCards.push(ants);
        ants.resourceCount = 1;
        expect((slotsOf()[0].input as SelectCardModel).cards.map((c) => c.name)).deep.eq([CardName.ANTS]);
        expect(cast(card.play(player), SelectCard).cards.map(toName)).deep.eq([CardName.ANTS]);
      });

      it('an empty table: the warning NAMES the loss — the same words the live record writes', () => {
        const steps = cardPlayPreview(player, card).branches.flatMap((b) => b.steps);
        expect(steps).has.lengthOf(1);
        expect(steps[0]).deep.include({kind: 'note', noteKind: 'warning'});
        expect((steps[0] as {skipped?: unknown}).skipped).deep.eq({label: SKIPPED_LABEL.addToCard, effect: {direction: 'gain', icon: 'resources', amount: 3, note: 'to a card'}});
      });
    });

    describe('rule 5 — the deal, save / reload, MarsBot', () => {
      function dealt(opts: Partial<GameOptions>): Array<CardName> {
        return new GameCards({...DEFAULT_GAME_OPTIONS, ...opts}).getProjectCards().map((c) => c.name);
      }

      it('dealt with Colonies + Prelude 2; absent without Colonies; off the hold-back list', () => {
        expect(dealt({coloniesExtension: true, prelude2Expansion: true})).include(CardName.L1_TRADE_TERMINAL);
        expect(dealt({coloniesExtension: false, prelude2Expansion: true})).not.include(CardName.L1_TRADE_TERMINAL);
        expect(PRELUDE2_CARDS_HELD_BACK.has(CardName.L1_TRADE_TERMINAL)).is.false;
      });

      it('save / reload keeps the offset', () => {
        player.playCard(card);
        runAllActions(game);
        const reloaded = Game.deserialize(structuredClone(game.serialize()));
        expect(reloaded.getPlayerById(player.id).colonies.tradeOffset).eq(2);
      });

      it('against MarsBot: the bot\'s cards are never targets', () => {
        const [, human, bot] = testAutomaGame({coloniesExtension: true});
        const [birds, ants] = cardsFromJSON([CardName.BIRDS, CardName.ANTS]);
        bot.playedCards.push(birds);
        birds.resourceCount = 2;
        human.playedCards.push(ants);
        ants.resourceCount = 1;
        const prompt = cast(new L1TradeTerminal().play(human), SelectCard);
        expect(prompt.cards.map(toName)).deep.eq([CardName.ANTS]);
      });
    });
  });
});

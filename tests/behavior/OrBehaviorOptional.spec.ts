import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Executor} from '../../src/server/behavior/Executor';
import {Behavior} from '../../src/server/behavior/Behavior';
import {CardResource} from '../../src/common/CardResource';
import {CardName} from '../../src/common/cards/CardName';
import {CardType} from '../../src/common/cards/CardType';
import {GameEvent} from '../../src/common/events/GameEvent';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {cast} from '../../src/common/utils/utils';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {actionPreview} from '../../src/server/models/actionPreview';
import {actionUnavailableReasons} from '../../src/server/models/actionUnavailableReasons';
import {SKIP_REASON, NO_HOLDER_WARNING} from '../../src/server/cards/actionPreviews';
import {Pets} from '../../src/server/cards/base/Pets';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {Vermin} from '../../src/server/cards/promo/Vermin';
import {LunarExports} from '../../src/server/cards/colonies/LunarExports';
import {AerialMappers} from '../../src/server/cards/venusNext/AerialMappers';
import {Thermophiles} from '../../src/server/cards/venusNext/Thermophiles';
import {fakeCard, runAllActions, formatMessage} from '../TestingUtils';
import {ICard, IActionCard} from '../../src/server/cards/ICard';

/**
 * `OrBehavior.optional` — THE CHOICE IS A BONUS BESIDE THE BEHAVIOR'S OTHER
 * KEYS (Turmoil Redux TR43 Ichtiology Grant: «increase your M€ production …
 * AND add 2 animals OR 4 microbes to ANY card»). The game rule: a card may be
 * played even when part of its effect cannot apply. With the knob, an `or`
 * whose branches can none of them run does not refuse the card: the other
 * keys execute and each branch is SKIPPED BY NAME (one `effect-skipped` record
 * per branch, the journal line, the rival's notification). Without the knob
 * nothing changes — the choice IS the card (Vermin, Lunar Exports), and the
 * regression rows below pin that.
 *
 * ONE knob, FOUR readers: `Executor.canExecute`, `Executor.execute`,
 * `collectActionBehaviorReasons` and the SHARED branch derivation of both
 * previews (`deriveOrBranches` — the play's and the action's), whose promise
 * is held to the live path word for word: the general branch's warnings ARE
 * the records the Executor writes.
 */
const ANIMALS = 'Add 2 animals to ANY card';
const MICROBES = 'Add 4 microbes to ANY card';

function bonusChoice(optional: boolean): Behavior {
  return {
    production: {megacredits: 1},
    or: {
      ...(optional ? {optional: true} : {}),
      autoSelect: true,
      behaviors: [
        {title: ANIMALS, addResourcesToAnyCard: {type: CardResource.ANIMAL, count: 2, mustHaveCard: true}},
        {title: MICROBES, addResourcesToAnyCard: {type: CardResource.MICROBE, count: 4, mustHaveCard: true}},
      ],
    },
  };
}

function skipsOf(game: IGame): Array<GameEvent> {
  return game.events.events.filter((e) => e.type === 'effect-skipped');
}

describe('OrBehavior.optional — the choice beside the other keys', () => {
  let game: IGame;
  let player: TestPlayer;
  let fake: IProjectCard;
  let executor: Executor;

  beforeEach(() => {
    [game, player] = testGame(2);
    fake = fakeCard({name: 'Fake Card' as CardName, type: CardType.AUTOMATED});
    executor = new Executor();
  });

  describe('canExecute', () => {
    it('no holder of either kind: an OPTIONAL choice does not refuse the card; a plain one does', () => {
      expect(executor.canExecute(bonusChoice(true), player, fake)).is.true;
      expect(executor.canExecute(bonusChoice(false), player, fake)).is.false;
    });

    it('with a holder both forms are executable, as before', () => {
      player.playedCards.push(new Pets());
      expect(executor.canExecute(bonusChoice(true), player, fake)).is.true;
      expect(executor.canExecute(bonusChoice(false), player, fake)).is.true;
    });

    it('the outer keys still gate: a production the player cannot lose refuses an optional choice too', () => {
      const behavior: Behavior = {...bonusChoice(true), production: {megacredits: -10}};
      expect(executor.canExecute(behavior, player, fake)).is.false;
    });
  });

  describe('execute', () => {
    it('no holder: the production stands, nothing is asked, each branch is skipped BY NAME — one record and one line per branch', () => {
      executor.execute(bonusChoice(true), player, fake);
      runAllActions(game);
      expect(player.production.megacredits).eq(1);
      expect(player.getWaitingFor()).is.undefined;
      const facts = skipsOf(game).map((e) => e.impact.skipped!);
      expect(facts).deep.eq([
        {label: ANIMALS, reason: SKIP_REASON.noHolder, effect: {direction: 'gain', icon: 'animal', amount: 2, note: 'to a card'}},
        {label: MICROBES, reason: SKIP_REASON.noHolder, effect: {direction: 'gain', icon: 'microbe', amount: 4, note: 'to a card'}},
      ]);
      const lines = game.gameLog.map((m) => formatMessage(m)).filter((l) => l.includes('effect skipped'));
      expect(lines).deep.eq([
        `${player.color} — effect skipped: ${ANIMALS} (${SKIP_REASON.noHolder})`,
        `${player.color} — effect skipped: ${MICROBES} (${SKIP_REASON.noHolder})`,
      ]);
    });

    it('one holder: the lone branch collapses to its bare target pick (autoSelect) and the animals land — never automatically', () => {
      const pets = new Pets();
      player.playedCards.push(pets);
      executor.execute(bonusChoice(true), player, fake);
      runAllActions(game);
      expect(player.production.megacredits).eq(1);
      const target = cast(player.popWaitingFor(), SelectCard);
      expect(target.cards.map((c) => c.name)).deep.eq([CardName.PETS]);
      expect(pets.resourceCount, 'no silent apply on a single candidate').eq(0);
      target.cb([pets]);
      expect(pets.resourceCount).eq(2);
      expect(skipsOf(game), 'nothing was skipped').is.empty;
    });

    it('holders of both kinds: the real OrOptions of two with the card as its source', () => {
      player.playedCards.push(new Pets(), new Tardigrades());
      executor.execute(bonusChoice(true), player, fake);
      runAllActions(game);
      const or = cast(player.popWaitingFor(), OrOptions);
      expect(or.options.map((o) => o.title)).deep.eq([ANIMALS, MICROBES]);
      expect(or.choiceContext?.source.card).eq(fake.name);
      expect(or.choiceContext?.mode).eq('effect-choice');
    });
  });

  describe('the previews — ONE derivation for the play and the action', () => {
    function playCard(behavior: Behavior): IProjectCard {
      return fakeCard({name: 'Fake Card' as CardName, type: CardType.AUTOMATED, behavior});
    }

    it('no holder: ONE general branch (available, untitled, the outer chips, a warning per skipped branch) and the two variants greyed with the holder reason', () => {
      const preview = cardPlayPreview(player, playCard(bonusChoice(true)));
      expect(preview.kind).eq('declarative');
      expect(preview.branches.map((b) => [b.index, b.title, b.available])).deep.eq([
        [-1, '', true],
        [-1, ANIMALS, false],
        [-1, MICROBES, false],
      ]);
      const general = preview.branches[0];
      expect(general.effects.map((e) => [e.icon, e.direction, e.amount, e.note])).deep.eq([['megacredits', 'gain', 1, 'production']]);
      expect(general.steps.map((s) => s.kind === 'note' ? [s.noteKind, s.text, s.resource, s.skipped] : s.kind)).deep.eq([
        ['warning', NO_HOLDER_WARNING, 'animal', {label: ANIMALS, effect: {direction: 'gain', icon: 'animal', amount: 2, note: 'to a card'}}],
        ['warning', NO_HOLDER_WARNING, 'microbe', {label: MICROBES, effect: {direction: 'gain', icon: 'microbe', amount: 4, note: 'to a card'}}],
      ]);
      for (const variant of preview.branches.slice(1)) {
        expect(variant.unavailableReason).eq('No card to add the resource to');
        expect(variant.steps).is.empty;
        // The variant still states the outer key it would have come with.
        expect(variant.effects.map((e) => e.icon)).deep.eq(['megacredits']);
      }
    });

    it('the general branch\'s warnings ARE the live records — one writer (parity, word for word)', () => {
      const preview = cardPlayPreview(player, playCard(bonusChoice(true)));
      const promised = preview.branches[0].steps.map((s) => s.kind === 'note' ? s.skipped : undefined);
      executor.execute(bonusChoice(true), player, fake);
      runAllActions(game);
      const recorded = skipsOf(game).map((e) => e.impact.skipped!);
      expect(recorded.map((f) => ({label: f.label, effect: f.effect}))).deep.eq(promised);
      expect(recorded.map((f) => f.reason)).deep.eq([SKIP_REASON.noHolder, SKIP_REASON.noHolder]);
    });

    it('one holder: the lone branch is index -1 with the outer chip BEFORE its own and the target step; the other greyed — no general branch', () => {
      player.playedCards.push(new Pets());
      const preview = cardPlayPreview(player, playCard(bonusChoice(true)));
      expect(preview.branches.map((b) => [b.index, b.title, b.available])).deep.eq([
        [-1, ANIMALS, true],
        [-1, MICROBES, false],
      ]);
      const animals = preview.branches[0];
      expect(animals.effects.map((e) => [e.icon, e.note])).deep.eq([['megacredits', 'production'], ['animal', 'to a card']]);
      expect(animals.steps.map((s) => s.kind)).deep.eq(['input']);
      const step = animals.steps[0];
      expect(step.kind === 'input' && step.input.type).eq('card');
      expect(step.kind === 'input' && step.amount).eq(2);
    });

    it('holders of both kinds: runtime indices 0 and 1, the outer chip on each', () => {
      player.playedCards.push(new Pets(), new Tardigrades());
      const preview = cardPlayPreview(player, playCard(bonusChoice(true)));
      expect(preview.branches.map((b) => [b.index, b.available])).deep.eq([[0, true], [1, true]]);
      for (const b of preview.branches) {
        expect(b.effects[0].icon).eq('megacredits');
        expect(b.steps.map((s) => s.kind)).deep.eq(['input']);
      }
    });

    it('the ACTION preview derives the same branches (the twin reader of the knob)', () => {
      const card = fakeCard({name: 'Fake Action' as CardName, type: CardType.ACTIVE}) as IProjectCard & IActionCard;
      (card as unknown as {actionBehavior?: Behavior}).actionBehavior = bonusChoice(true);
      card.canAct = () => true;
      card.action = () => undefined;
      const preview = actionPreview(player, card as ICard & IActionCard);
      expect(preview.branches.map((b) => [b.index, b.title, b.available])).deep.eq([
        [-1, '', true],
        [-1, ANIMALS, false],
        [-1, MICROBES, false],
      ]);
      expect(preview.branches[0].steps.filter((s) => s.kind === 'note').length).eq(2);
    });

    it('the reasons engine: an optional choice with no holder is not a blocker of the card; a plain one names the holder', () => {
      const optional = fakeCard({name: 'Fake Action' as CardName, type: CardType.ACTIVE}) as IProjectCard & IActionCard;
      (optional as unknown as {actionBehavior?: Behavior}).actionBehavior = bonusChoice(true);
      optional.canAct = () => false;
      const plain = fakeCard({name: 'Fake Action 2' as CardName, type: CardType.ACTIVE}) as IProjectCard & IActionCard;
      (plain as unknown as {actionBehavior?: Behavior}).actionBehavior = bonusChoice(false);
      plain.canAct = () => false;
      expect(actionUnavailableReasons(player, optional as ICard & IActionCard).map((r) => r.message)).to.not.include('No card to add the resource to');
      expect(actionUnavailableReasons(player, plain as ICard & IActionCard).map((r) => r.message)).to.include('No card to add the resource to');
    });
  });

  describe('regression — the plain `or` family is untouched', () => {
    function setupAction(card: ICard & IActionCard): void {
      player.playedCards.push(card);
      player.megaCredits = 50;
      if (card.resourceType !== undefined) {
        card.resourceCount = 3;
      }
    }

    it('Vermin: one holder of microbes → «add one animal here» and the microbe branch, indices 0 / 1; no holder → the animal branch alone collapses', () => {
      const vermin = new Vermin();
      setupAction(vermin);
      player.playedCards.push(new Tardigrades());
      let preview = actionPreview(player, vermin);
      expect(preview.branches.map((b) => [b.index, b.available])).deep.eq([[0, true], [1, true]]);
      expect(preview.branches[0].effects.map((e) => e.icon), 'no outer key — the branch\'s own chip only').deep.eq(['animal']);
      player.playedCards.remove(player.playedCards.get(CardName.TARDIGRADES)!);
      preview = actionPreview(player, vermin);
      expect(preview.branches.map((b) => [b.index, b.available])).deep.eq([[-1, true], [-1, false]]);
      expect(preview.branches.length, 'no general branch for a plain or').eq(2);
    });

    it('Aerial Mappers and Thermophiles keep their branch shapes', () => {
      const mappers = new AerialMappers();
      setupAction(mappers);
      const mappersPreview = actionPreview(player, mappers);
      expect(mappersPreview.branches.length).eq(2);
      expect(mappersPreview.branches.every((b) => b.title !== '')).is.true;
      const thermophiles = new Thermophiles();
      setupAction(thermophiles);
      const thermophilesPreview = actionPreview(player, thermophiles);
      expect(thermophilesPreview.branches.length).eq(2);
      expect(thermophilesPreview.branches.every((b) => b.title !== '')).is.true;
    });

    it('Lunar Exports (an on-play or that IS the card): two branches, indices 0 / 1, each with its own production chip only', () => {
      const exports = new LunarExports();
      player.cardsInHand.push(exports);
      player.megaCredits = 50;
      const preview = cardPlayPreview(player, exports);
      expect(preview.branches.map((b) => [b.index, b.available, b.effects.length])).deep.eq([[0, true, 1], [1, true, 1]]);
      // Without the knob a plain or with nothing executable still refuses the whole card.
      expect(executor.canExecute({or: {behaviors: [{title: 'x', addResourcesToAnyCard: {type: CardResource.ANIMAL, count: 1, mustHaveCard: true}}]}}, player, fake)).is.false;
    });
  });
});

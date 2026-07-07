import {expect} from 'chai';
import {Game} from '../../src/server/Game';
import {IGame} from '../../src/server/IGame';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {cast} from '../../src/common/utils/utils';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

/** Skip generation 1 (empty bot deck → everyone passes) → generation 2 opens with the draft. */
function reachDraft(game: IGame, human: TestPlayer) {
  game.playerIsFinishedWithResearchPhase(human);
  game.automa!.actionDeck = [];
  human.popWaitingFor();
  game.playerHasPassed(human);
  game.playerIsFinishedTakingActions();
  expect(game.generation).eq(2);
  expect(game.phase).eq('drafting');
}

function humanDraftPick(human: TestPlayer): void {
  const selectCard = cast(human.popWaitingFor(), SelectCard<IProjectCard>);
  selectCard.process({type: 'card', cards: [selectCard.cards[0].name]});
}

describe('AutomaDraft', () => {
  it('runs the official two-pile draft: the human prompts, MarsBot picks instantly at random', () => {
    const [game, human, bot] = testAutomaGame({draftVariant: true});
    reachDraft(game, human);

    // Round 1 dealt 4+4; the bot already picked its first card silently.
    const firstPrompt = cast(human.getWaitingFor(), SelectCard<IProjectCard>);
    expect(firstPrompt.cards).has.length(4);
    expect(bot.draftedCards).has.length(1);
    expect(bot.getWaitingFor()).is.undefined;

    // Three human picks drive the remaining rounds (the last card auto-passes).
    humanDraftPick(human); // → round 2 (3 cards)
    humanDraftPick(human); // → round 3 (2 cards)
    humanDraftPick(human); // → last card auto-drafted, draft ends

    const automa = game.automa!;
    // Bot drafted 4, shuffled, discarded 1 → 3 projects + 1 bonus card.
    expect(automa.actionDeck).has.length(4);
    expect(automa.actionDeck.filter((c) => c.kind === 'project')).has.length(3);
    expect(automa.actionDeck.filter((c) => c.kind === 'bonus')).has.length(1);
    expect(game.projectDeck.discardPile).has.length(1);
    expect(bot.draftedCards).is.empty;

    // The human proceeds to the ordinary buy step with their 4 drafted cards.
    expect(game.phase).eq('research');
    expect(human.getWaitingFor()).is.not.undefined;
  });

  it('Brutal keeps all 4 drafted cards — no discard', () => {
    const [game, human] = testAutomaGame({draftVariant: true, difficulty: 'brutal'});
    reachDraft(game, human);
    humanDraftPick(human);
    humanDraftPick(human);
    humanDraftPick(human);

    const automa = game.automa!;
    expect(automa.actionDeck.filter((c) => c.kind === 'project')).has.length(4);
    expect(game.projectDeck.discardPile).is.empty;
  });

  it('the floater spend keeps the 4th drafted card instead of discarding it', () => {
    const [game, human] = testAutomaGame({draftVariant: true, coloniesExtension: true});
    // Colonies without Venus: Hoverlord counts as unavailable (RB-C p.4).
    game.automa!.floaters = 5;
    reachDraft(game, human);
    humanDraftPick(human);
    humanDraftPick(human);
    humanDraftPick(human);

    const automa = game.automa!;
    expect(automa.floaters).eq(0);
    expect(automa.actionDeck.filter((c) => c.kind === 'project')).has.length(4);
    expect(game.projectDeck.discardPile).is.empty;
  });

  it('a mid-draft save/restore keeps the human prompt and never prompts the bot', () => {
    const [game, human] = testAutomaGame({draftVariant: true});
    reachDraft(game, human);
    humanDraftPick(human); // Enter round 2, prompt pending.

    const restored = Game.deserialize(structuredClone(game.serialize()));
    const restoredHuman = restored.players.find((p) => !p.isMarsBot)!;
    const restoredBot = restored.players.find((p) => p.isMarsBot)!;
    expect(restored.phase).eq('drafting');
    expect(cast(restoredHuman.getWaitingFor(), SelectCard<IProjectCard>).cards).has.length(3);
    expect(restoredBot.getWaitingFor()).is.undefined;
    expect(restoredBot.draftedCards).has.length(2);
  });
});

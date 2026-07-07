import {expect} from 'chai';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {IGame} from '../../src/server/IGame';
import {AutomaResearch} from '../../src/server/automa/AutomaResearch';
import {Hoverlord} from '../../src/server/milestones/Hoverlord';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

/** Play out generation 1 with an empty bot deck so generation 2's research runs. */
function reachGen2Research(game: IGame, human: TestPlayer) {
  game.playerIsFinishedWithResearchPhase(human);
  game.automa!.actionDeck = [];
  human.popWaitingFor();
  game.playerHasPassed(human);
  game.playerIsFinishedTakingActions();
  expect(game.generation).eq(2);
  expect(game.phase).eq('research');
}

describe('Automa research phase (non-draft)', () => {
  it('spends 5 floaters for an extra project card when Hoverlord is unavailable', () => {
    const [game, human] = testAutomaGame({coloniesExtension: true});
    game.automa!.floaters = 6;
    reachGen2Research(game, human);

    const automa = game.automa!;
    expect(automa.floaters).eq(1);
    // 3 + 1 floater-bought projects + 1 bonus + B19 (recurring from gen 2).
    expect(automa.actionDeck.filter((c) => c.kind === 'project')).has.length(4);
  });

  it('does NOT spend floaters while Hoverlord is still claimable', () => {
    const [game, human] = testAutomaGame({venusNextExtension: true});
    // Make Hoverlord definitively part of this game and unclaimed.
    if (!game.milestones.some((m) => m.name === 'Hoverlord')) {
      game.milestones.push(new Hoverlord());
    }
    game.automa!.floaters = 6;
    reachGen2Research(game, human);

    expect(game.automa!.floaters).eq(6);
    expect(game.automa!.actionDeck.filter((c) => c.kind === 'project')).has.length(3);
  });

  it('Brutal draws 4 project cards each research (5 with the floater spend)', () => {
    const [game, human] = testAutomaGame({coloniesExtension: true, difficulty: 'brutal'});
    game.automa!.floaters = 5;
    reachGen2Research(game, human);

    const automa = game.automa!;
    expect(automa.floaters).eq(0);
    expect(automa.actionDeck.filter((c) => c.kind === 'project')).has.length(5);
  });

  it('Colonies: Shipping Lines joins the recurring pool from generation 2 (never the first deck)', () => {
    const [game, human] = testAutomaGame({coloniesExtension: true});
    const automa = game.automa!;
    // Generation 1: B19/B20 are set aside, not in the action deck.
    expect(automa.setAsideBonusCards).contains(BonusCardId.B19_SHIPPING_LINES);
    expect(automa.actionDeck.some((c) => c.kind === 'bonus' && c.id === BonusCardId.B19_SHIPPING_LINES)).is.false;

    reachGen2Research(game, human);
    expect(automa.recurringBonusCards).contains(BonusCardId.B19_SHIPPING_LINES);
    expect(automa.setAsideBonusCards).deep.eq([BonusCardId.B20_EXTENDED_SHIPPING_LINES]);
    expect(automa.actionDeck.some((c) => c.kind === 'bonus' && c.id === BonusCardId.B19_SHIPPING_LINES)).is.true;
  });

  it('Extended Shipping Lines joins only after the 2nd trade fleet unlocks', () => {
    const [game, human] = testAutomaGame({coloniesExtension: true});
    game.automa!.secondFleetUnlocked = true;
    reachGen2Research(game, human);

    const automa = game.automa!;
    expect(automa.recurringBonusCards).contains(BonusCardId.B20_EXTENDED_SHIPPING_LINES);
    expect(automa.setAsideBonusCards).is.empty;
    expect(automa.actionDeck.filter((c) => c.kind === 'bonus')).has.length(3); // 1 bonus + B19 + B20.
  });

  it('an empty bonus deck reshuffles the discard — never the destroyed cards', () => {
    const [game] = testAutomaGame();
    const automa = game.automa!;
    automa.bonusDeck = [];
    automa.bonusDiscard = [BonusCardId.B03_RESEARCH_AND_DEVELOPMENT];
    automa.destroyedBonusCards = [BonusCardId.B01_METEOR_SHOWER];

    AutomaResearch.buildActionDeck(game);
    expect(automa.actionDeck.some((c) => c.kind === 'bonus' && c.id === BonusCardId.B03_RESEARCH_AND_DEVELOPMENT)).is.true;
    expect(automa.actionDeck.some((c) => c.kind === 'bonus' && c.id === BonusCardId.B01_METEOR_SHOWER)).is.false;
    expect(automa.bonusDiscard).is.empty;
    expect(automa.destroyedBonusCards).deep.eq([BonusCardId.B01_METEOR_SHOWER]);
  });
});

import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import {MarsBotTurnStep} from '../../src/common/automa/MarsBotTurn';
import {AutomaState} from '../../src/server/automa/AutomaState';
import {IGame} from '../../src/server/IGame';
import {Server} from '../../src/server/models/ServerModel';
import {TestPlayer} from '../TestPlayer';
import {testAutomaGame} from './AutomaTestGame';

const SCIENCE = 3;

function startActionPhase(game: IGame, human: TestPlayer) {
  game.playerIsFinishedWithResearchPhase(human);
}

/** The human ends the turn WITHOUT passing → the bot resolves exactly one card. */
function humanEndsTurn(game: IGame, human: TestPlayer) {
  human.popWaitingFor();
  game.playerIsFinishedTakingActions();
}

function kinds(steps: ReadonlyArray<MarsBotTurnStep>): Array<string> {
  return steps.map((s) => s.kind);
}

describe('AutomaTurnLog — the typed turn script', () => {
  it('records reveal → tag → advance for a project card, in order', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);
    // Gene Repair: a single science tag; science 0→1 lands on 'advance' → cascades to 2.
    automa.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
    humanEndsTurn(game, human);

    const turn = automa.lastTurn;
    expect(turn).is.not.undefined;
    expect(turn!.id).eq(1);
    expect(turn!.generation).eq(1);
    expect(kinds(turn!.steps)).deep.eq(['reveal', 'tag', 'advance', 'advance']);

    const [reveal, tag, first, cascade] = turn!.steps;
    expect(reveal).deep.include({kind: 'reveal'});
    if (reveal.kind === 'reveal') {
      expect(reveal.card).deep.eq({kind: 'project', name: CardName.GENE_REPAIR});
      // The reveal log line is attached to the step itself, not duplicated.
      expect(reveal.message?.message).eq('${0} revealed ${1}');
    }
    expect(tag).deep.eq({kind: 'tag', tag: Tag.SCIENCE, trackIndex: SCIENCE});
    expect(first).deep.eq({kind: 'advance', trackIndex: SCIENCE, from: 0, to: 1, action: 'advance'});
    expect(cascade).deep.eq({kind: 'advance', trackIndex: SCIENCE, from: 1, to: 2});
  });

  it('a tagless card records a failed step carrying its own log line', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);
    automa.actionDeck = [{kind: 'project', name: CardName.LAKE_MARINERIS}];
    humanEndsTurn(game, human);

    const steps = automa.lastTurn!.steps;
    expect(kinds(steps)).deep.eq(['reveal', 'failed']);
    const failed = steps[1];
    if (failed.kind === 'failed') {
      expect(failed.reason).eq('no-tags');
      expect(failed.mc).eq(5);
      expect(failed.message?.message).to.include('took a Failed Action');
    }
  });

  it('an empty action deck records a pass turn', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);
    automa.actionDeck = [];
    humanEndsTurn(game, human);

    const turn = automa.lastTurn!;
    expect(kinds(turn.steps)).deep.eq(['pass']);
    const pass = turn.steps[0];
    if (pass.kind === 'pass') {
      expect(pass.message?.message).eq('${0} passed');
    }
  });

  it('interleaves public log lines of the turn as log steps (bonus card)', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);
    human.plants = 5;
    automa.actionDeck = [{kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}];
    humanEndsTurn(game, human);

    const steps = automa.lastTurn!.steps;
    expect(steps[0].kind).eq('reveal');
    if (steps[0].kind === 'reveal') {
      expect(steps[0].card).deep.eq({kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER});
    }
    // Meteor Shower's resolution lines (plants removed, destroyed-card note)
    // ride along as ordered log steps.
    expect(steps.some((s) => s.kind === 'log')).is.true;
  });

  it('turn ids are monotonic across turns', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);
    automa.actionDeck = [
      {kind: 'project', name: CardName.GENE_REPAIR},
      {kind: 'project', name: CardName.GENE_REPAIR},
    ];
    humanEndsTurn(game, human);
    expect(automa.lastTurn!.id).eq(1);
    humanEndsTurn(game, human);
    expect(automa.lastTurn!.id).eq(2);
    expect(automa.turnCounter).eq(2);
  });

  it('private log lines never enter the script', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);
    automa.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
    // Force a private line mid-turn by hooking the reveal: simplest honest way
    // is to log one reserved line right before the bot's turn resolves.
    game.log('secret line', (b) => b.player(human), {reservedFor: human});
    humanEndsTurn(game, human);

    const steps = automa.lastTurn!.steps;
    for (const step of steps) {
      if (step.kind === 'log') {
        expect(step.message.message).to.not.eq('secret line');
      }
    }
  });

  it('the script serializes with the automa state and reaches the game model', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);
    automa.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
    humanEndsTurn(game, human);

    const roundTrip = AutomaState.deserialize(automa.serialize(), game.gameOptions);
    expect(roundTrip.turnCounter).eq(automa.turnCounter);
    expect(roundTrip.lastTurn).deep.eq(automa.lastTurn);

    const model = Server.getGameModel(game);
    expect(model.automa?.lastTurn?.id).eq(automa.lastTurn!.id);
    expect(model.automa?.lastTurn?.steps.length).eq(automa.lastTurn!.steps.length);
  });
});

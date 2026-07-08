import {expect} from 'chai';
import {CardName} from '../../src/common/cards/CardName';
import {Tag} from '../../src/common/cards/Tag';
import {TileType} from '../../src/common/TileType';
import {BonusCardId} from '../../src/common/automa/AutomaTypes';
import type {MarsBotTurnStep} from '../../src/common/automa/MarsBotTurn';
import {AutomaState} from '../../src/server/automa/AutomaState';
import {AutomaTurnLog} from '../../src/server/automa/AutomaTurnLog';
import {IGame} from '../../src/server/IGame';
import {Server} from '../../src/server/models/ServerModel';
import {Birds} from '../../src/server/cards/base/Birds';
import {ProtectedHabitats} from '../../src/server/cards/base/ProtectedHabitats';
import {TestPlayer} from '../TestPlayer';
import {addOcean, setTemperature} from '../TestingUtils';
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

  it('a tagless card records a failed step + the bot\'s own before → after impact', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);
    automa.actionDeck = [{kind: 'project', name: CardName.LAKE_MARINERIS}];
    humanEndsTurn(game, human);

    const steps = automa.lastTurn!.steps;
    expect(kinds(steps)).deep.eq(['reveal', 'failed', 'impact']);
    const failed = steps[1];
    if (failed.kind === 'failed') {
      expect(failed.reason).eq('no-tags');
      expect(failed.mc).eq(5);
      expect(failed.message?.message).to.include('took a Failed Action');
    }
    // The turn-results section: the Failed-Action money as explicit 0 → 5.
    const impact = steps[2];
    if (impact.kind === 'impact') {
      expect(impact.impact.targetIsBot).is.true;
      expect(impact.impact.changes).deep.eq([{resource: 'megacredits', scope: 'stock', before: 0, after: 5}]);
    }
  });

  it('an attack records WHO was hit + before → after AT THE ATTACK MOMENT, once', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);
    human.plants = 5;
    automa.actionDeck = [{kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}];
    humanEndsTurn(game, human);

    const steps = automa.lastTurn!.steps;
    const attacks = steps.filter((s): s is Extract<MarsBotTurnStep, {kind: 'attack'}> => s.kind === 'attack');
    expect(attacks, 'the attack step must be recorded').lengthOf(1);
    expect(attacks[0].attack).deep.eq({
      target: human.color, resource: 'plants', demanded: 5, removed: 5,
      before: 5, after: 0, outcome: 'hit',
    });
    // The deduct's own log line rides the step — never narrated twice.
    expect(attacks[0].message).is.not.undefined;
    // The results section must NOT repeat the exact same loss as a second row.
    const victimImpacts = steps
      .filter((s): s is Extract<MarsBotTurnStep, {kind: 'impact'}> => s.kind === 'impact')
      .filter((s) => !s.impact.targetIsBot);
    expect(victimImpacts, 'the attack already narrated this loss').lengthOf(0);
  });

  it('a zero-outcome attack is STILL recorded — the target + "nothing to lose"', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);
    human.plants = 0; // The start-of-game case: an attack with nothing to take.
    automa.actionDeck = [{kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}];
    humanEndsTurn(game, human);

    const steps = automa.lastTurn!.steps;
    const attack = steps.find((s): s is Extract<MarsBotTurnStep, {kind: 'attack'}> => s.kind === 'attack');
    expect(attack, 'a no-op attack must not vanish from the script').is.not.undefined;
    expect(attack!.attack).deep.eq({
      target: human.color, resource: 'plants', demanded: 5, removed: 0,
      before: 0, after: 0, outcome: 'nothing-to-lose',
    });
  });

  it('a protected target reads as PROTECTED, not as silence', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);
    human.plants = 7;
    human.playedCards.push(new ProtectedHabitats());
    automa.actionDeck = [{kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}];
    humanEndsTurn(game, human);

    const attack = automa.lastTurn!.steps
      .find((s): s is Extract<MarsBotTurnStep, {kind: 'attack'}> => s.kind === 'attack');
    expect(attack).is.not.undefined;
    expect(attack!.attack).deep.eq({
      target: human.color, resource: 'plants', demanded: 5, removed: 0,
      before: 7, after: 7, outcome: 'protected',
    });
    expect(attack!.message?.message).to.include('plants are protected');
  });

  it('a deferred cube attack announces the target with "target-chooses"', () => {
    const [game, human] = testAutomaGame();
    const automa = game.automa!;
    startActionPhase(game, human);
    const birds = new Birds();
    birds.resourceCount = 2;
    human.playedCards.push(birds);
    automa.actionDeck = [{kind: 'bonus', id: BonusCardId.B02_INVASIVE_SPECIES}];
    humanEndsTurn(game, human);

    const attack = automa.lastTurn!.steps
      .find((s): s is Extract<MarsBotTurnStep, {kind: 'attack'}> => s.kind === 'attack');
    expect(attack).is.not.undefined;
    expect(attack!.attack).deep.eq({
      target: human.color, resource: 'cube', demanded: 1, removed: 0, outcome: 'target-chooses',
    });
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

  // ── PRESENTATION FLOW: the journal ↔ notification ↔ theater shared key ──────
  describe('journal correlation + turn history', () => {
    it('stamps the journal correlationId onto the turn script and groups the turn logs', () => {
      const [game, human] = testAutomaGame();
      const automa = game.automa!;
      startActionPhase(game, human);
      automa.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
      humanEndsTurn(game, human);

      const turn = automa.lastTurn!;
      expect(turn.correlationId, 'the whole turn resolves inside one journal scope').is.not.undefined;

      // The scope's root event exists with the 'automa-turn' category.
      const root = game.events.events.find((e) => e.id === turn.correlationId);
      expect(root).is.not.undefined;
      expect(root!.type).eq('action');
      expect(root!.category).eq('automa-turn');

      // The turn's public log lines carry the SAME correlationId (the journal
      // groups them), and the first one is the root-action header.
      const turnLogs = game.gameLog.filter((m) => m.correlationId === turn.correlationId);
      expect(turnLogs.length, 'the reveal line must be grouped').greaterThan(0);
      expect(turnLogs[0].role).eq('root-action');
      expect(turnLogs[0].category).eq('automa-turn');
    });

    it('the events scope is CLOSED before the game advances (nothing later leaks into the group)', () => {
      const [game, human] = testAutomaGame();
      const automa = game.automa!;
      startActionPhase(game, human);
      automa.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
      humanEndsTurn(game, human);

      // After the turn resolves the recorder has no live scope: a fresh log
      // line is NOT stamped with the bot turn's correlation.
      game.log('after turn line', (b) => b.player(human));
      const line = game.gameLog[game.gameLog.length - 1];
      expect(line.message).eq('after turn line');
      expect(line.correlationId).is.undefined;
    });

    it('keeps a bounded turn HISTORY — consecutive turns are all addressable', () => {
      const [game, human] = testAutomaGame();
      const automa = game.automa!;
      startActionPhase(game, human);
      automa.actionDeck = [
        {kind: 'project', name: CardName.GENE_REPAIR},
        {kind: 'project', name: CardName.GENE_REPAIR},
      ];
      humanEndsTurn(game, human);
      humanEndsTurn(game, human);

      expect(automa.turnHistory.map((t) => t.id)).deep.eq([1, 2]);
      expect(automa.lastTurn!.id).eq(2);
      // Every archived turn carries its own correlationId — distinct groups.
      const [first, second] = automa.turnHistory;
      expect(first.correlationId).is.not.undefined;
      expect(second.correlationId).is.not.undefined;
      expect(first.correlationId).not.eq(second.correlationId);
    });

    it('turn history serializes, deserializes and reaches the game model (bounded tail)', () => {
      const [game, human] = testAutomaGame();
      const automa = game.automa!;
      startActionPhase(game, human);
      automa.actionDeck = [
        {kind: 'project', name: CardName.GENE_REPAIR},
        {kind: 'project', name: CardName.GENE_REPAIR},
      ];
      humanEndsTurn(game, human);
      humanEndsTurn(game, human);

      const roundTrip = AutomaState.deserialize(automa.serialize(), game.gameOptions);
      expect(roundTrip.turnHistory).deep.eq(automa.turnHistory);

      const model = Server.getGameModel(game);
      expect(model.automa?.turnHistory?.map((t) => t.id)).deep.eq([1, 2]);
    });

    it('STRICT: a nested action inside the automa-turn scope JOINS the turn\'s journal group', () => {
      const [game] = testAutomaGame();
      const bot = game.players.find((p) => p.isMarsBot)!;

      game.events.beginAction(bot, undefined, {category: 'automa-turn'});
      const turnCorrelation = game.events.captureContext()!.rootId;
      // A nested scope, exactly like the Delta advance / a milestone claim /
      // an award funding opened during the bot's resolution.
      game.events.beginAction(bot, {kind: 'milestone', name: 'Terraformer' as never}, {category: 'milestone'});
      game.log('nested claim line', (b) => b.player(bot));
      game.events.endScope();
      game.log('outer reveal line', (b) => b.player(bot));
      game.events.endScope();

      const nested = game.gameLog.find((m) => m.message === 'nested claim line')!;
      const outer = game.gameLog.find((m) => m.message === 'outer reveal line')!;
      // ONE journal group for the whole turn…
      expect(nested.correlationId).eq(turnCorrelation);
      expect(outer.correlationId).eq(turnCorrelation);
      // …with ONE header: the nested scope's lines are details, never a
      // second root that would split the entry.
      expect(nested.role).eq('detail');
      expect(outer.role).eq('root-action');
      expect(outer.category).eq('automa-turn');

      // The nested 'action' EVENT keeps its own category (analytics/facts
      // unchanged) but shares the turn's correlation.
      const nestedEvent = game.events.events.find((e) => e.type === 'action' && e.category === 'milestone');
      expect(nestedEvent).is.not.undefined;
      expect(nestedEvent!.correlationId).eq(turnCorrelation);

      // A HUMAN action outside the automa scope still roots its own group.
      const human = game.players.find((p) => p.isMarsBot !== true)!;
      game.events.beginAction(human, undefined, {category: 'standard-project'});
      game.log('human line', (b) => b.player(human));
      game.events.endScope();
      const humanLine = game.gameLog.find((m) => m.message === 'human line')!;
      expect(humanLine.role).eq('root-action');
      expect(humanLine.correlationId).not.eq(turnCorrelation);
    });

    it('records the turn\'s board-visible footprint (tiles + params) into turn.visual', () => {
      const [game, human] = testAutomaGame();
      const automa = game.automa!;
      startActionPhase(game, human);
      // Drive the recording directly: the footprint is a whole-turn snapshot
      // diff, so ANY mechanic that places a tile / moves a parameter between
      // begin() and finish() is covered without per-site instrumentation.
      AutomaTurnLog.begin(game);
      setTemperature(game, -26);
      addOcean(human, '32');
      AutomaTurnLog.note(game, {kind: 'pass'});
      AutomaTurnLog.finish(game);

      const visual = automa.lastTurn!.visual;
      expect(visual, 'a visible footprint must be recorded').is.not.undefined;
      expect(visual!.temperature).deep.eq({before: -30, after: -26});
      expect(visual!.oceans).deep.eq({before: 0, after: 1});
      expect(visual!.tiles).deep.eq([{spaceId: '32', tileType: TileType.OCEAN}]);
      // Oxygen / Venus did not move — no empty entries.
      expect(visual!.oxygenLevel).is.undefined;
      expect(visual!.venusScaleLevel).is.undefined;
    });

    it('a turn with no board-visible footprint carries NO visual (no empty objects)', () => {
      const [game, human] = testAutomaGame();
      const automa = game.automa!;
      startActionPhase(game, human);
      automa.actionDeck = [];
      humanEndsTurn(game, human); // an empty deck → a pass turn
      expect(automa.lastTurn!.visual).is.undefined;
    });

    it('old saves without turnHistory deserialize to an empty history', () => {
      const [game, human] = testAutomaGame();
      const automa = game.automa!;
      startActionPhase(game, human);
      automa.actionDeck = [{kind: 'project', name: CardName.GENE_REPAIR}];
      humanEndsTurn(game, human);

      const serialized = automa.serialize();
      delete serialized.turnHistory;
      const roundTrip = AutomaState.deserialize(serialized, game.gameOptions);
      expect(roundTrip.turnHistory).deep.eq([]);
    });
  });
});

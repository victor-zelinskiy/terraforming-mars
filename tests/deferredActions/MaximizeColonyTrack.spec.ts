import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';
import {CardName} from '../../src/common/cards/CardName';
import {SelectColony} from '../../src/server/inputs/SelectColony';
import {Luna} from '../../src/server/colonies/Luna';
import {Ceres} from '../../src/server/colonies/Ceres';
import {Titan} from '../../src/server/colonies/Titan';
import {Europa} from '../../src/server/colonies/Europa';
import {ColonyName} from '../../src/common/colonies/ColonyName';
import {trackTop} from '../../src/common/colonies/ColonyMetadata';
import {
  COLONY_NOT_ACTIVE_REASON,
  COLONY_TRACK_AT_TOP_REASON,
  COLONY_TRACK_LABEL,
  EVERY_COLONY_TRACK_AT_TOP_REASON,
  MAXIMIZE_COLONY_TRACK_TITLE,
  MaximizeColonyTrack,
} from '../../src/server/deferredActions/MaximizeColonyTrack';
import {Server} from '../../src/server/models/ServerModel';
import {SelectColonyModel} from '../../src/common/models/PlayerInputModel';
import {colonyPickStep} from '../../src/server/cards/actionPreviews';
import {fakeCard} from '../TestingUtils';

/**
 * «CHOOSE 1 COLONY TRACK. MOVE ITS MARKER TO THE HIGHEST (RIGHT-MOST)
 * POSITION.» — the shared step (Turmoil Redux TR07 Colony Sponsors).
 */
describe('MaximizeColonyTrack', () => {
  const SOURCE = 'A card that sets a colony track' as CardName;
  let game: IGame;
  let player: TestPlayer;
  let opponent: TestPlayer;
  let luna: Luna;
  let ceres: Ceres;
  let titan: Titan;
  let europa: Europa;

  beforeEach(() => {
    [game, player, opponent] = testGame(2, {coloniesExtension: true});
    luna = new Luna();
    ceres = new Ceres();
    titan = new Titan();
    europa = new Europa();
    game.colonies = [luna, ceres, titan, europa];
    luna.trackPosition = 2;
    ceres.trackPosition = trackTop(ceres.metadata);
    titan.isActive = false;
    europa.trackPosition = 1;
    // A rival's cube on Europa — the track is the TILE's, never a seat's.
    europa.colonies.push(opponent.id);
    player.megaCredits = 0;
  });

  function step(): MaximizeColonyTrack {
    return new MaximizeColonyTrack(player, {kind: 'card', card: SOURCE});
  }

  function ask(): SelectColony {
    game.defer(step());
    runAllActions(game);
    return cast(player.popWaitingFor(), SelectColony);
  }

  function skips() {
    return game.events.events.filter((e) => e.type === 'effect-skipped').map((e) => e.impact.skipped);
  }

  it('the top is the tile\'s last printed cell, not a constant', () => {
    expect(trackTop(luna.metadata)).eq(luna.metadata.trade.quantity.length - 1);
    expect(trackTop(luna.metadata)).eq(6);
  });

  it('candidates are the ACTIVE tiles below their top — anybody\'s, in the table\'s order', () => {
    const prompt = ask();
    expect(prompt.colonies.map((c) => c.name)).deep.eq([ColonyName.LUNA, ColonyName.EUROPA]);
  });

  it('the tile at its top and the inactive tile are SHOWN disabled, each with its ONE reason', () => {
    const prompt = ask();
    expect(prompt.disabledColonies.map((d) => [d.colony.name, d.reason])).deep.eq([
      [ColonyName.CERES, COLONY_TRACK_AT_TOP_REASON],
      [ColonyName.TITAN, COLONY_NOT_ACTIVE_REASON],
    ]);
  });

  it('the prompt carries its giver and the server\'s projection for every candidate', () => {
    const prompt = ask();
    expect(prompt.title).eq(MAXIMIZE_COLONY_TRACK_TITLE);
    expect(prompt.choiceContext?.source).deep.eq({kind: 'card', card: SOURCE});
    expect(prompt.trackMoves).deep.eq([
      {colony: ColonyName.LUNA, before: 2, after: 6},
      {colony: ColonyName.EUROPA, before: 1, after: 6},
    ]);
    const model = prompt.toModel(player);
    expect(model.trackMoves).deep.eq(prompt.trackMoves);
    expect(model.disabledColonies?.map((d) => d.name)).deep.eq([ColonyName.CERES, ColonyName.TITAN]);
  });

  it('the live model publishes the marker and the giver (what the console reads)', () => {
    game.defer(step());
    runAllActions(game);
    const model = Server.getPlayerModel(player).waitingFor as SelectColonyModel;
    expect(model.type).eq('colony');
    expect(model.trackMoves?.map((m) => m.colony)).deep.eq([ColonyName.LUNA, ColonyName.EUROPA]);
    expect(model.choiceContext?.source.card).eq(SOURCE);
  });

  it('the answer SETS the marker at the top — the steps are top − current, logged and recorded', () => {
    const prompt = ask();
    prompt.cb(luna);
    expect(luna.trackPosition).eq(6);
    const line = game.gameLog.find((m) => m.message === '${0} increased ${1} colony track ${2} step(s)');
    expect(line?.data.map((d) => d.value)).deep.eq([player.color, ColonyName.LUNA, '4']);
    const moved = game.events.events.filter((e) => e.type === 'colony-track-moved');
    expect(moved).has.lengthOf(1);
    expect(moved[0].player).eq(player.color);
    expect(moved[0].impact.colonyTrackMove).deep.eq({colony: ColonyName.LUNA, before: 2, after: 6});
    expect(moved[0].visibility).eq('journal');
    expect(skips()).deep.eq([]);
  });

  it('it is not a trade: no fleet moves and no visitor stands on the tile', () => {
    const fleets = player.colonies.getFleetSize() - player.colonies.usedTradeFleets;
    ask().cb(europa);
    expect(europa.visitor).is.undefined;
    expect(player.colonies.getFleetSize() - player.colonies.usedTradeFleets).eq(fleets);
    expect(europa.colonies, 'the cubes are the rival\'s, untouched').deep.eq([opponent.id]);
  });

  it('the world moved between the question and the answer (the tile reached its top) — a NAMED skip, never a fall', () => {
    const prompt = ask();
    luna.trackPosition = 6;
    prompt.cb(luna);
    expect(luna.trackPosition).eq(6);
    expect(skips()).deep.eq([{label: COLONY_TRACK_LABEL, reason: COLONY_TRACK_AT_TOP_REASON}]);
    expect(game.events.events.filter((e) => e.type === 'colony-track-moved')).deep.eq([]);
  });

  it('NO candidate at all — no prompt, a NAMED skip (the card is still played)', () => {
    luna.trackPosition = 6;
    europa.trackPosition = 6;
    game.defer(step());
    runAllActions(game);
    expect(player.getWaitingFor()).is.undefined;
    expect(skips()).deep.eq([{label: COLONY_TRACK_LABEL, reason: EVERY_COLONY_TRACK_AT_TOP_REASON}]);
    const line = game.gameLog.find((m) => m.message === '${0} — effect skipped: ${1} (${2})');
    expect(line).is.not.undefined;
  });

  describe('previewSelectColony — the read-only twin', () => {
    it('is the live prompt read twice: title, candidates, disabled tiles, marker, giver', () => {
      const preview = step().previewSelectColony()!;
      const live = Server.getPlayerModel(player);
      expect(live.waitingFor).is.undefined;
      game.defer(step());
      runAllActions(game);
      const asked = Server.getPlayerModel(player).waitingFor as SelectColonyModel;
      expect(preview.title).deep.eq(asked.title);
      expect(preview.buttonLabel).eq(asked.buttonLabel);
      expect(preview.coloniesModel.map((c) => c.name)).deep.eq(asked.coloniesModel.map((c) => c.name));
      expect(preview.disabledColonies).deep.eq(asked.disabledColonies);
      expect(preview.trackMoves).deep.eq(asked.trackMoves);
      expect(preview.choiceContext).deep.eq(asked.choiceContext);
    });

    it('is undefined exactly where the live step skips', () => {
      luna.trackPosition = 6;
      europa.trackPosition = 6;
      expect(step().previewSelectColony()).is.undefined;
    });

    it('mutates, logs and queues nothing', () => {
      const before = JSON.stringify(game.serialize());
      const events = game.events.events.length;
      step().previewSelectColony();
      expect(JSON.stringify(game.serialize())).eq(before);
      expect(game.events.events.length).eq(events);
      expect(game.deferredActions.length).eq(0);
    });
  });

  describe('colonyPickStep — the play preview\'s door', () => {
    const card = fakeCard({name: SOURCE});

    it('a door carrying the very prompt the commit will ask, addressed by the card', () => {
      const s = colonyPickStep(card, step());
      expect(s.kind).eq('colonyPick');
      if (s.kind !== 'colonyPick') {
        return;
      }
      expect(s.staged.sourceCard).eq(SOURCE);
      expect(s.staged.prompt).deep.eq(step().previewSelectColony());
    });

    it('no tile to move — no door, the named warning in the record\'s own words', () => {
      luna.trackPosition = 6;
      europa.trackPosition = 6;
      const s = colonyPickStep(card, step());
      expect(s).deep.include({kind: 'note', noteKind: 'warning', text: EVERY_COLONY_TRACK_AT_TOP_REASON});
      expect((s as {skipped?: unknown}).skipped).deep.eq({label: COLONY_TRACK_LABEL});
    });
  });
});

import {expect} from 'chai';
import {testGame} from '../../TestGame';
import {TestPlayer} from '../../TestPlayer';
import {EarlyColonization} from '../../../src/server/cards/prelude2/EarlyColonization';
import {assertBuildColony} from '../../colonies/coloniesAssertions';
import {Callisto} from '../../../src/server/colonies/Callisto';
import {Enceladus} from '../../../src/server/colonies/Enceladus';
import {Ganymede} from '../../../src/server/colonies/Ganymede';
import {Luna} from '../../../src/server/colonies/Luna';
import {IGame} from '../../../src/server/IGame';
import {formatMessage, runAllActions} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';
import {SelectColony} from '../../../src/server/inputs/SelectColony';
import {CardName} from '../../../src/common/cards/CardName';
import {ColonyName} from '../../../src/common/colonies/ColonyName';

describe('EarlyColonization', () => {
  let player: TestPlayer;
  let player2: TestPlayer;
  let game: IGame;
  let card: EarlyColonization;

  beforeEach(() => {
    [game, player, player2] = testGame(2, {coloniesExtension: true});
    card = new EarlyColonization();
  });

  it('play', () => {
    const [callisto, enceladus, ganymede, luna] = [new Callisto(), new Enceladus(), new Ganymede(), new Luna()];
    game.colonies = [callisto, enceladus, ganymede, luna];
    const colonies = game.colonies;

    ganymede.colonies.push(player.id);
    expect(enceladus.isActive).is.false;

    expect(colonies.map((c) => c.trackPosition)).deep.eq([1, 1, 1, 1]);

    card.play(player);

    expect(colonies.map((c) => c.trackPosition)).deep.eq([3, 1, 3, 3]);
    expect(player.energy).eq(3);
    assertBuildColony(player, game.deferredActions.pop()!.execute());

    enceladus.isActive = true;

    card.play(player);

    expect(colonies.map((c) => c.trackPosition)).deep.eq([5, 3, 5, 5]);
  });

  it('a track stops at its top, and the top is named', () => {
    const [callisto, luna] = [new Callisto(), new Luna()];
    game.colonies = [callisto, luna];
    callisto.trackPosition = 6;
    luna.trackPosition = 5;

    card.play(player);

    expect([callisto.trackPosition, luna.trackPosition]).deep.eq([6, 6]);
    const lines = game.gameLog.map((l) => formatMessage(l));
    expect(lines.some((l) => l.includes('Callisto colony track is already at its top'))).is.true;
    // Only the tile that MOVED is a recorded move.
    const moved = game.events.events.filter((e) => e.type === 'colony-track-moved').map((e) => e.impact.colonyTrackMove);
    expect(moved).deep.eq([{colony: ColonyName.LUNA, before: 5, after: 6}]);
  });

  it('raise FIRST, then place — the placement reads the raised track (Colony.placeCube)', () => {
    const luna = new Luna();
    game.colonies = [luna, new Callisto()];
    luna.colonies.push(player2.id);
    luna.trackPosition = 1;

    card.play(player);
    expect(luna.trackPosition).eq(3);
    runAllActions(game);
    const select = cast(player.popWaitingFor(), SelectColony);
    select.cb(luna);
    runAllActions(game);

    // place → raise would read 4 (the cube lifts the track to 2, then +2); the printed order reads 3.
    expect(luna.colonies).deep.eq([player2.id, player.id]);
    expect(luna.trackPosition).eq(3);
  });

  it('the placement prompt names its card and carries what the play raised', () => {
    const [callisto, enceladus, ganymede] = [new Callisto(), new Enceladus(), new Ganymede()];
    game.colonies = [callisto, enceladus, ganymede];
    ganymede.trackPosition = 5;

    card.play(player);
    runAllActions(game);
    const select = cast(player.popWaitingFor(), SelectColony);
    expect(select.choiceContext?.source).deep.eq({kind: 'card', card: CardName.EARLY_COLONIZATION});
    // Enceladus is inactive — absent; Ganymede hit its top — present with the move it made (5 → 6).
    expect(select.toModel(player).trackRaise).deep.eq([
      {colony: ColonyName.CALLISTO, before: 1, after: 3},
      {colony: ColonyName.GANYMEDE, before: 5, after: 6},
    ]);
  });

  it('records one move per tile and logs one line', () => {
    game.colonies = [new Callisto(), new Ganymede()];

    card.play(player);

    const moved = game.events.events.filter((e) => e.type === 'colony-track-moved').map((e) => e.impact.colonyTrackMove);
    expect(moved).deep.eq([
      {colony: ColonyName.CALLISTO, before: 1, after: 3},
      {colony: ColonyName.GANYMEDE, before: 1, after: 3},
    ]);
    const lines = game.gameLog.map((l) => formatMessage(l)).filter((l) => l.includes('raised every active colony track'));
    expect(lines).has.length(1);
  });

  it('the preview promises the raise before the press — names, before → after, the top and the inactive', () => {
    const [callisto, enceladus, ganymede] = [new Callisto(), new Enceladus(), new Ganymede()];
    game.colonies = [callisto, enceladus, ganymede];
    ganymede.trackPosition = 6;

    const preview = card.cardPlayPreview(player);
    const notes = preview.branches[0].steps
      .filter((s) => s.kind === 'note')
      .map((s) => s.kind === 'note' && s.text !== undefined ? (typeof s.text === 'string' ? s.text : formatMessage(s.text)) : '');
    expect(notes).deep.eq([
      'All active colony tracks rise 2 steps',
      'Callisto colony track: 2 → 4',
      'Enceladus colony track: not active, it does not rise',
      'Ganymede colony track: already at its top',
    ]);
    expect(preview.branches[0].steps.some((s) => s.kind === 'boardPlacement' && s.placementType === 'colony')).is.true;
    // Read-only: nothing moved.
    expect(game.colonies.map((c) => c.trackPosition)).deep.eq([1, 1, 6]);
  });
});

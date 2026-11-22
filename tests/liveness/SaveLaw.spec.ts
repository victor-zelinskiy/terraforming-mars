import {expect} from 'chai';
import {IGame} from '../../src/server/IGame';
import {GameLoader} from '../../src/server/database/GameLoader';
import {SimpleDeferredAction} from '../../src/server/deferredActions/DeferredAction';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {LakeMarineris} from '../../src/server/cards/base/LakeMarineris';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';
import {cast} from '../../src/common/utils/utils';
import {runAllActions} from '../TestingUtils';

/*
 * A SAVE NEVER HOLDS A QUESTION ONLY THE DEFERRED QUEUE CAN ASK (`Game.save` — FREEZE ZERO, stage 5).
 *
 * The queue is not serialized and a prompt is not either: a loaded game asks what its phase can re-derive. A question
 * the queue raised is the middle of a chain that lives in closures — saved under, it comes back gone, and what its
 * answer would have done with it. The engine fuzz's reload check named it in the Parliament (seeds 113 · 118 · 177:
 * a law's free colony on Europa, the build's ocean still asked, the sitting saved — and adjourned on the reload with
 * the ocean never placed).
 */
describe('the save law — no save while a question only the queue can ask stands', () => {
  let game: IGame;
  let player: TestPlayer;
  let other: TestPlayer;
  let saves: number;
  let unwatch: () => void;

  beforeEach(() => {
    [game, player, other] = testGame(2);
    for (const seat of [player, other]) {
      seat.popWaitingFor();
    }
    const loader = GameLoader.getInstance();
    const persist = loader.saveGame.bind(loader);
    saves = 0;
    loader.saveGame = (saved) => {
      saves += saved === game ? 1 : 0;
      return persist(saved);
    };
    unwatch = () => {
      loader.saveGame = persist;
    };
  });

  afterEach(() => unwatch());

  it('with nobody asked by the queue a save is a save', () => {
    game.save();
    expect(saves).eq(1);
  });

  it('a question the QUEUE raised holds every save — and the next one after its answer is taken', () => {
    let answered = 0;
    game.defer(new SimpleDeferredAction(player, () => new SelectOption('The queue asks').andThen(() => {
      answered++;
      return undefined;
    })));
    runAllActions(game);
    const asked = cast(player.getWaitingFor(), SelectOption);
    expect(game.deferredActions.asksAnyOf(game.players)).eq(true);

    game.save();
    game.save();
    expect(saves, 'no save is taken under it').eq(0);

    asked.cb(undefined);
    player.popWaitingFor();
    expect(answered).eq(1);
    expect(game.deferredActions.asksAnyOf(game.players)).eq(false);
    game.save();
    expect(saves).eq(1);
  });

  it('…whoever it is asked of: another seat\'s standing queue question holds this seat\'s save too', () => {
    game.defer(new SimpleDeferredAction(other, () => new SelectOption('The queue asks the other seat')));
    runAllActions(game);
    expect(other.getWaitingFor()).not.eq(undefined);
    game.save();
    expect(saves).eq(0);
  });

  it('a question a PHASE asks (re-derived on a load) holds nothing', () => {
    // (Set straight onto the seat — the way the action menu, a draft's pick, the research buy and a law's step are.)
    player.setWaitingFor(new SelectOption('The phase asks'));
    expect(game.deferredActions.asksAnyOf(game.players)).eq(false);
    game.save();
    expect(saves).eq(1);
  });

  it('a queue\'s question that no longer STANDS holds nothing (the set is of the inputs themselves — it cannot leak)', () => {
    game.defer(new SimpleDeferredAction(player, () => new SelectOption('The queue asks')));
    runAllActions(game);
    // The question is taken away without an answer (a reset, a replaced prompt).
    player.popWaitingFor();
    game.save();
    expect(saves).eq(1);
  });

  it('a real chain: a card\'s ocean asked by the queue — no save until the cell is chosen', () => {
    player.megaCredits = 30;
    new LakeMarineris().play(player);
    runAllActions(game);
    expect(player.getWaitingFor()?.type).eq('space');
    game.save();
    expect(saves, 'the first ocean is still asked').eq(0);
  });
});

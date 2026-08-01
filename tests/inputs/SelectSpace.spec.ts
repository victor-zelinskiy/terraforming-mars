import {expect} from 'chai';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {cancellablePlacement} from '../../src/server/inputs/placementContext';
import {Server} from '../../src/server/models/ServerModel';
import {OrOptionsModel, SelectSpaceModel} from '../../src/common/models/PlayerInputModel';
import {CardName} from '../../src/common/cards/CardName';
import {Space} from '../../src/server/boards/Space';
import {IGame} from '../../src/server/IGame';
import {TestPlayer} from '../TestPlayer';
import {testGame} from '../TestGame';

describe('SelectSpace', () => {
  let game: IGame;
  let player: TestPlayer;
  let selected: Space | undefined;

  const cb = (cards: Space) => {
    selected = cards;
    return undefined;
  };

  beforeEach(() => {
    [game, player] = testGame(1);
    selected = undefined;
  });

  it('Simple', () => {
    const selectSpace = new SelectSpace('', game.board.spaces).andThen(cb);
    selectSpace.process({type: 'space', spaceId: '05'});
    expect(selected!.id).eq('05');
  });

  it('Cannot select space not part of the set', () => {
    const selectSpace = new SelectSpace('', game.board.spaces).andThen(cb);
    expect(() => selectSpace.process({type: 'space', spaceId: '00'}))
      .to.throw(Error, /Space not available/);
  });

  /*
   * The placement marker must survive NESTING.
   *
   * `ServerModel.getWaitingFor` decorates the TOP-LEVEL prompt only, and a
   * placement is routinely nested: converting plants is one branch of the
   * action-menu `OrOptions`, and so is a task's own space option. Serialized
   * centrally, those branches reached the client stripped of their marker — the
   * board's context panel could not name what was placing the tile and had to
   * guess cancellability. The same trap `discardPrompt` already paid for.
   */
  it('the placement marker rides toModel, so it survives nesting', () => {
    const nested = new SelectSpace('Convert 8 plants into greenery', game.board.spaces)
      .markPlacementContext(cancellablePlacement({kind: 'standardProject', card: CardName.CONVERT_PLANTS}));
    const menu = new OrOptions(new SelectOption('Pass'), nested);

    // The model the client actually receives for the ACTION MENU…
    const model = Server.getWaitingFor(player, menu) as OrOptionsModel;
    // …carries the marker on the nested branch, not just on the top level.
    const branch = model.options[1] as SelectSpaceModel;
    expect(branch.placementContext?.cancellable).is.true;
    expect(branch.placementContext?.source?.card).to.eq(CardName.CONVERT_PLANTS);
  });

  it('an unmarked placement still has no context (backward-compatible)', () => {
    const model = new SelectSpace('', game.board.spaces).toModel();
    expect(model.placementContext).is.undefined;
  });
});

import {testAutomaGame} from '../../automa/AutomaTestGame';
import {Tag} from '../../../src/common/cards/Tag';
import {expect} from 'chai';
import {MediaArchives} from '../../../src/server/cards/base/MediaArchives';
import {Virus} from '../../../src/server/cards/base/Virus';
import {testGame} from '../../TestingUtils';
import {cast} from '../../../src/common/utils/utils';

describe('MediaArchives', () => {
  it('Should play', () => {
    const card = new MediaArchives();
    const [/* game */, player] = testGame(1);
    player.playedCards.push(card, new Virus());
    cast(card.play(player), undefined);
    expect(player.megaCredits).to.eq(1);
  });

  // Upstream 096553e950 — MarsBot has no played events: its event track counts instead.
  it('counts MarsBot\'s event track', () => {
    const card = new MediaArchives();
    const [game, player] = testAutomaGame({}, '-media');
    const automa = game.automa!;
    const track = automa.board.getTrackIndexForTag(Tag.EVENT)!;
    automa.board.tracks[track].position = 4;
    player.megaCredits = 0;

    card.play(player);

    expect(player.megaCredits).to.eq(4);
  });
});

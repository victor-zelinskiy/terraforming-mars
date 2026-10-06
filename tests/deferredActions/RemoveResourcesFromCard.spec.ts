import {expect} from 'chai';
import {testGame} from '../TestGame';
import {RemoveResourcesFromCard, Response} from '../../src/server/deferredActions/RemoveResourcesFromCard';
import {CardResource} from '../../src/common/CardResource';
import {AtmoCollectors} from '../../src/server/cards/colonies/AtmoCollectors';
import {cast} from '@/common/utils/utils';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {Message} from '../../src/common/logs/Message';
import {ICard} from '../../src/server/cards/ICard';

// This requires a lot more tests
describe('RemoveResourcesFromCard', () => {
  let response: Response;
  const andThen = (c: Response) => {
    response = c;
  };

  beforeEach(() => {
    response = undefined as unknown as Response;
  });

  it('simple', () => {
    const [/* game */, player] = testGame(3);
    const action = new RemoveResourcesFromCard(player, CardResource.FLOATER, 1, {source: 'self', blockable: false}).andThen(andThen);
    cast(action.execute(), undefined);

    expect(response).deep.eq({card: undefined, owner: undefined, proceed: false});
  });

  it('remove from self', () => {
    const [/* game */, player] = testGame(3);
    const atmoCollectors = new AtmoCollectors();
    player.playedCards.push(atmoCollectors);
    atmoCollectors.resourceCount = 2;
    const action = new RemoveResourcesFromCard(player, CardResource.FLOATER, 1, {source: 'self', blockable: false}).andThen(andThen);
    cast(action.execute(), undefined);

    expect(response).deep.eq({card: atmoCollectors, owner: player, proceed: true});
    expect(atmoCollectors.resourceCount).eq(1);
  });

  it('cannot block mandatory self-removals', () => {
    const [/* game */, player] = testGame(3, {underworldExpansion: true});
    const atmoCollectors = new AtmoCollectors();
    player.playedCards.push(atmoCollectors);
    player.underworldData.corruption = 1;
    atmoCollectors.resourceCount = 2;
    const action = new RemoveResourcesFromCard(player, CardResource.FLOATER, 1, {source: 'self', blockable: false}).andThen(andThen);
    cast(action.execute(), undefined);

    expect(response).deep.eq({card: atmoCollectors, owner: player, proceed: true});
    expect(atmoCollectors.resourceCount).eq(1);
  });

  /*
   * A removal from your OWN card is a COST you chose (Air Raid's floater, Stratospheric Birds', Export Convoy's
   * microbes, Spaceship Recycling's fighter) — never an attack on yourself: the picker and the journal say «spend».
   */
  describe('a spend from your own card speaks the spend', () => {
    function twoHolders() {
      const [game, player, other] = testGame(3);
      const first = new AtmoCollectors();
      const second = new AtmoCollectors();
      first.resourceCount = 2;
      second.resourceCount = 1;
      player.playedCards.push(first);
      return {game, player, other, first, second};
    }

    it('the picker: «Select card to spend N <resource> from» · «Spend resource(s)»', () => {
      const {player, first} = twoHolders();
      const action = new RemoveResourcesFromCard(player, CardResource.FLOATER, 1, {source: 'self', blockable: false, autoselect: false});
      const picker = cast(action.execute(), SelectCard<ICard>);
      expect((picker.title as Message).message).eq('Select card to spend ${0} ${1} from');
      expect(picker.buttonLabel).eq('Spend resource(s)');
      expect(picker.cards).deep.eq([first]);
      expect(action.previewSelectCard()?.buttonLabel, 'the preview twin reads the same verb').eq('Spend resource(s)');
    });

    it('the journal: «${0} spent ${1} ${2} from ${3}» — the resource and the card named, never «removed … from X\'s Y»', () => {
      const {game, player, first} = twoHolders();
      const from = game.gameLog.length;
      cast(new RemoveResourcesFromCard(player, CardResource.FLOATER, 1, {source: 'self', blockable: false}).execute(), undefined);
      const lines = game.gameLog.slice(from);
      expect(lines.map((m) => m.message)).deep.eq(['${0} spent ${1} ${2} from ${3}']);
      expect(lines[0].data.map((d) => d.value)).deep.eq([player.color, '1', CardResource.FLOATER, first.name]);
      expect(first.resourceCount).eq(1);
    });

    it('`log: false` — a caller with a more specific line writes it; the class writes none', () => {
      const {game, player} = twoHolders();
      const from = game.gameLog.length;
      cast(new RemoveResourcesFromCard(player, CardResource.FLOATER, 1, {source: 'self', blockable: false, log: false}).execute(), undefined);
      expect(game.gameLog.slice(from)).deep.eq([]);
    });

    it('an ATTACK keeps the attack\'s words', () => {
      const {player, other, second} = twoHolders();
      other.playedCards.push(second);
      const action = new RemoveResourcesFromCard(player, CardResource.FLOATER, 1, {source: 'opponents', autoselect: false});
      const picker = cast(action.execute(), SelectCard<ICard>);
      expect((picker.title as Message).message).eq('Select card to remove ${0} ${1}');
      expect(picker.buttonLabel).eq('Remove resource(s)');
    });
  });
});

import {expect} from 'chai';
import {cast} from '@/common/utils/utils';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {Pluto} from '../../src/server/colonies/Pluto';
import {IGame} from '../../src/server/IGame';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {TestPlayer} from '../TestPlayer';
import {runAllActions} from '../TestingUtils';
import {testGame} from '../TestGame';
import {GameEvent} from '../../src/common/events/GameEvent';
import {DrawCards} from '../../src/server/deferredActions/DrawCards';

/**
 * A DISCARD IS A FACT, and a draw the recipient is SHOWN tells itself (P53 · ledger FL — PL-186). The owner's frame:
 * a rival traded with Pluto, the viewer's colony bonus drew a card into an EMPTY hand and the rules threw it away at
 * once — the reveal said «Сброшена: другой карты в руке не было» while the feed's card said «ВЫ ПОЛУЧИЛИ КАРТЫ +2».
 * `impact.cardsDiscarded` existed and NOTHING wrote it, and the draw the reveal was telling rode the band a second time.
 */
describe('cards-discarded — the fact of a discard, and the draw the reveal tells (FL)', () => {
  let pluto: Pluto;
  let owner: TestPlayer;
  let rival: TestPlayer;
  let game: IGame;

  beforeEach(() => {
    pluto = new Pluto();
    [game, owner, rival] = testGame(2, {coloniesExtension: true});
    game.colonies.push(pluto);
  });

  function ownerEvents(from: number): Array<GameEvent> {
    return game.events.events.slice(from).filter((e) => e.player === owner.color);
  }

  it('an EMPTY hand: the bonus card is drawn and auto-discarded — both events tagged «revealed», the discard «auto-discard»', () => {
    pluto.colonies.push(owner.id);
    owner.cardsInHand.length = 0;
    const from = game.events.events.length;
    game.events.beginAction(rival, undefined);
    pluto.trade(rival);
    runAllActions(game);
    game.events.endScope();

    const mine = ownerEvents(from);
    const drawn = mine.find((e) => e.type === 'cards-drawn');
    const discarded = mine.find((e) => e.type === 'cards-discarded');
    expect(drawn?.impact.cardsDrawn, 'the bonus drew one').eq(1);
    expect(drawn?.tags, 'a kept-whole draw is shown in the reveal').to.include('revealed');
    expect(discarded?.impact.cardsDiscarded, 'the discard is a fact').eq(1);
    expect(discarded?.tags).to.include.members(['auto-discard', 'revealed']);
    // …and the reveal itself names the card gone (colony polish 1, К-5).
    expect(owner.cardDrawReveals.some((r) => (r.autoDiscarded ?? []).length === 1)).eq(true);
  });

  it('a hand with cards: the discard is ASKED — a fact, never «auto», never «revealed»', () => {
    pluto.colonies.push(owner.id);
    game.events.beginAction(rival, undefined);
    const from = game.events.events.length;
    owner.cardsInHand.push(game.projectDeck.drawOrThrow(game));
    pluto.trade(rival);
    runAllActions(game);
    const input = cast(owner.popWaitingFor(), SelectCard<IProjectCard>);
    input.cb([input.cards[0]]);
    runAllActions(game);
    game.events.endScope();

    const discarded = ownerEvents(from).find((e) => e.type === 'cards-discarded');
    expect(discarded?.impact.cardsDiscarded).eq(1);
    expect(discarded?.tags ?? []).not.to.include('auto-discard');
    expect(discarded?.tags ?? []).not.to.include('revealed');
  });

  it('every kept-whole draw (DrawCards.keepAll) is tagged «revealed» — the reveal is its presentation', () => {
    game.events.beginAction(owner, undefined);
    const from = game.events.events.length;
    game.defer(DrawCards.keepAll(owner, 2));
    runAllActions(game);
    game.events.endScope();
    const drawn = ownerEvents(from).find((e) => e.type === 'cards-drawn');
    expect(drawn?.impact.cardsDrawn).eq(2);
    expect(drawn?.tags).to.include('revealed');
  });
});

import {expect} from 'chai';
import {isCardSelectionWithin, isHandPick, isHandPickInput, orHandPickOption, orOptionDoor} from '../../src/client/console/handPickRouting';
import {PlayerInputModel, SelectCardModel} from '../../src/common/models/PlayerInputModel';
import {CardName} from '../../src/common/cards/CardName';

/**
 * THE HAND PICK (the owner's hard rule 2026-10-13): a card chosen FROM THE HAND is chosen in the hand album at every
 * depth — a composer's own card step, an `or` option (Mars University's «discard a card to draw one»), a table
 * question, a live effect decision. These are the ONE classification every surface asks.
 */
const card = (name: string) => ({name: name as CardName}) as never;

function select(cards: Array<string>, extra: Partial<SelectCardModel> = {}): SelectCardModel {
  return {type: 'card', title: 'Select a card to discard', buttonLabel: 'Discard', cards: cards.map(card), min: 1, max: 1, ...extra} as SelectCardModel;
}

const HAND = new Set(['Algae', 'Lichen', 'Mars University']);

describe('handPickRouting — one answer to «is this a pick from the hand?»', () => {
  it('every candidate in the hand → a hand pick; one table card among them → not', () => {
    expect(isHandPick(select(['Algae', 'Lichen']), HAND)).is.true;
    expect(isHandPick(select(['Algae', 'Tardigrades']), HAND)).is.false;
    expect(isCardSelectionWithin(select(['Algae']), HAND)).is.true;
  });

  it('the DISCARD marker says «hand» by itself — even over a candidate list the client does not hold yet', () => {
    const discard = select(['Card drawn by this very play'], {discardPrompt: {min: 1, max: 1} as never});
    expect(isHandPick(discard, HAND)).is.true;
  });

  it('nothing selectable is no pick at all (an empty hand resolves on the server)', () => {
    expect(isHandPick(select([]), HAND)).is.false;
  });

  it('the card being PLAYED, offered as a selectable candidate, is a TABLE pick (it lands there); listed disabled it changes nothing', () => {
    expect(isHandPick(select(['Mars University', 'Algae']), HAND, 'Mars University')).is.false;
    const disabledSelf = select(['Algae'], {disabledCards: [{name: 'Mars University' as CardName, disabledReason: 'This card is being played'}]} as never);
    expect(isHandPick(disabledSelf, HAND, 'Mars University')).is.true;
  });

  it('an `or` whose option is a hand pick names THAT option (Mars University: option 0 beside «do nothing»)', () => {
    const or = {
      type: 'or', title: 'You played a science tag.', buttonLabel: 'Confirm',
      options: [select(['Algae', 'Lichen']), {type: 'option', title: 'Do nothing', buttonLabel: 'Confirm'}],
    } as unknown as PlayerInputModel;
    const found = orHandPickOption(or, HAND);
    expect(found?.index).eq(0);
    expect(found?.select.cards.map((c) => c.name)).deep.eq(['Algae', 'Lichen']);
    expect(isHandPickInput(or, HAND), 'the `or` itself is not a card input').is.false;
  });

  it('the door of an `or` option: hand → the album, table → the target step, anything else → the list', () => {
    const TABLE = new Set(['Tardigrades', 'Birds']);
    expect(orOptionDoor(select(['Algae', 'Lichen']), HAND, TABLE)).eq('hand');
    expect(orOptionDoor(select(['Drawn later'], {discardPrompt: {min: 1, max: 1} as never}), HAND, TABLE), 'a discard is the hand').eq('hand');
    expect(orOptionDoor(select(['Tardigrades', 'Birds']), HAND, TABLE)).eq('table');
    expect(orOptionDoor(select(['Algae', 'Birds']), HAND, TABLE), 'a mixed pick has no shelf').eq('list');
    expect(orOptionDoor({type: 'player', title: 'x', buttonLabel: 'y', players: []} as unknown as PlayerInputModel, HAND, TABLE)).eq('list');
    expect(orOptionDoor(undefined, HAND, TABLE), 'a leaf option opens nothing').eq('list');
  });

  it('an `or` with no hand option (a table card pick, a player pick) names none', () => {
    const or = {
      type: 'or', title: 'x', buttonLabel: 'Confirm',
      options: [select(['Tardigrades']), {type: 'player', title: 'y', buttonLabel: 'Confirm', players: []}],
    } as unknown as PlayerInputModel;
    expect(orHandPickOption(or, HAND)).eq(undefined);
    expect(orHandPickOption(select(['Algae']), HAND), 'not an `or`').eq(undefined);
  });
});

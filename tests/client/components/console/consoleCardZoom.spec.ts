import {expect} from 'chai';
import {closeConsoleCardZoom, consoleCardZoom, navigateConsoleCardZoom, openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';

/**
 * P15: the console fullscreen viewer's module state — the select CONTEXT
 * is what lets A toggle a pick from fullscreen ONLY in selection contexts
 * (read-only openers pass none, so A can never fire a game action there),
 * and close() must clear it so a later read-only open can't inherit it.
 */

function card(name: CardName): CardModel {
  return {name} as CardModel;
}

describe('consoleCardZoom (P15)', () => {
  afterEach(() => closeConsoleCardZoom());

  it('open clamps the index and stores the list', () => {
    openConsoleCardZoom([card(CardName.ANTS), card(CardName.BIRDS)], 5);
    expect(consoleCardZoom.index).to.eq(1);
    expect(consoleCardZoom.card?.name).to.eq(CardName.BIRDS);
    expect(consoleCardZoom.select).to.eq(undefined); // read-only by default
  });

  it('open with an empty list is a no-op', () => {
    openConsoleCardZoom([], 0);
    expect(consoleCardZoom.card).to.eq(undefined);
  });

  it('a select context rides along and drives the toggle', () => {
    const picked: Array<CardName> = [];
    openConsoleCardZoom([card(CardName.ANTS)], 0, {
      isSelected: (name) => picked.includes(name),
      toggle: (name) => {
        const at = picked.indexOf(name);
        if (at === -1) {
          picked.push(name);
        } else {
          picked.splice(at, 1);
        }
      },
    });
    expect(consoleCardZoom.select).to.not.eq(undefined);
    consoleCardZoom.select?.toggle(CardName.ANTS);
    expect(consoleCardZoom.select?.isSelected(CardName.ANTS)).to.eq(true);
    consoleCardZoom.select?.toggle(CardName.ANTS);
    expect(consoleCardZoom.select?.isSelected(CardName.ANTS)).to.eq(false);
  });

  it('navigate re-points the mirror; close clears EVERYTHING incl. the context', () => {
    openConsoleCardZoom([card(CardName.ANTS), card(CardName.BIRDS)], 0, {
      isSelected: () => false,
      toggle: () => {},
    });
    navigateConsoleCardZoom(card(CardName.BIRDS), 1);
    expect(consoleCardZoom.index).to.eq(1);
    closeConsoleCardZoom();
    expect(consoleCardZoom.card).to.eq(undefined);
    expect(consoleCardZoom.cards.length).to.eq(0);
    expect(consoleCardZoom.select).to.eq(undefined);
  });
});

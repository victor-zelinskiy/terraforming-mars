import {expect} from 'chai';
import {railFocusKeysOf} from '@/client/console/consoleCardActions';
import {ActionEffect} from '@/common/models/ActionPreviewModel';

/**
 * THE RAIL RECEDES BEHIND A FORMULA (PL-139, the TR40 walk): while an action
 * composer stands, the player rail keeps lit only the rows the formula
 * touches — its cost and gain chips (a production step and a stock move are
 * the same row) and the table's own exact answers to the press — and lets
 * every other row go quiet. Pure, so the stand can be read as data: the
 * composer publishes the keys, the rail compares.
 */
const cost = (icon: string, note?: string): ActionEffect => ({direction: 'cost', icon, amount: 1, ...(note === undefined ? {} : {note})});
const gain = (icon: string, note?: string): ActionEffect => ({direction: 'gain', icon, amount: 1, ...(note === undefined ? {} : {note})});

describe('railFocusKeysOf — the rail rows a formula touches', () => {
  it('TR40 B: a mech off the card and a plant-production step, the Greens answering with M€ production → plants + M€', () => {
    const keys = railFocusKeysOf([cost('mech', 'on this card')], [gain('plants', 'production')],
      {facts: [{recipient: {kind: 'you'}, effects: [gain('megacredits', 'production')]}]});
    expect(keys).to.deep.eq(['plants', 'megacredits']);
  });

  it('TR40 A: energy off the rail, a mech onto the card → the energy row alone (a card resource is no rail row)', () => {
    expect(railFocusKeysOf([cost('energy')], [gain('mech', 'on this card')], undefined)).to.deep.eq(['energy']);
  });

  it('a stock move and a production step of one resource share the row; a repeated resource is one key', () => {
    expect(railFocusKeysOf([cost('megacredits')], [gain('megacredits', 'production'), gain('steel'), gain('steel', 'production')], undefined)).to.deep.eq(['megacredits', 'steel']);
  });

  it('another seat\'s answer lights nothing on OUR rail; a fact with no recipient is ours', () => {
    const keys = railFocusKeysOf([], [], {facts: [
      {recipient: {kind: 'other'}, effects: [gain('titanium')]},
      {effects: [gain('heat')]},
    ]});
    expect(keys).to.deep.eq(['heat']);
  });

  it('a formula touching no rail row publishes an EMPTY set — the rail then quiets every row, which is the honest reading of «nothing here moves»', () => {
    expect(railFocusKeysOf([cost('data', 'on this card')], [gain('cards')], undefined)).to.deep.eq([]);
  });
});

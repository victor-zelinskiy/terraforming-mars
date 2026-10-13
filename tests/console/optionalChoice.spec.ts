import {expect} from 'chai';
import {DISCARD_DECLINE_KEY, declineIsButton, declineResponse, isDeclineOption, optionalChoiceOf} from '../../src/client/console/optionalChoice';
import {PlayerInputModel} from '../../src/common/models/PlayerInputModel';

/**
 * AN OPTIONAL CHOICE IS ANSWERED ON ONE SURFACE, THE DECLINE A BUTTON (the owner's decisions 2026-10-13): the decline
 * is read off the server's skip marker, the one nested pick that is the whole offer opens directly, and a yes / no
 * keeps its two cards.
 */
const skip = (title = 'Do nothing') => ({type: 'option', title, buttonLabel: 'Confirm', metadata: {kind: 'skip'}});
const leaf = (title: string, metadata?: Record<string, unknown>) => ({type: 'option', title, buttonLabel: 'Confirm', metadata});
const or = (options: Array<unknown>, mode?: string) => ({
  type: 'or', title: 'x', buttonLabel: 'Confirm', options,
  ...(mode !== undefined ? {choiceContext: {source: {kind: 'card', card: 'Mars University'}, mode}} : {}),
}) as unknown as PlayerInputModel;
const discardPick = () => ({
  type: 'card', title: 'Select a card to discard', buttonLabel: 'Discard', cards: [{name: 'Algae'}], min: 1, max: 1,
  discardPrompt: {min: 1, max: 1, source: {kind: 'card', card: 'Mars University'}, exchange: {icon: 'cards', amount: 1}},
});

describe('optionalChoice — the decline is a button, never a row', () => {
  it('reads the decline by the SKIP MARKER, never by a title', () => {
    expect(isDeclineOption(skip() as never)).is.true;
    expect(isDeclineOption(leaf('Do nothing') as never), 'the same words without the marker are no decline').is.false;
    expect(optionalChoiceOf(or([leaf('A'), leaf('Do nothing')])), 'no marker, no optional choice').eq(undefined);
  });

  it('Mars University: the discard is the ONE pick — opened directly, the decline «Не сбрасывать» forgoing +1 card', () => {
    const c = optionalChoiceOf(or([discardPick(), skip()], 'optional-effect'))!;
    expect(c.pick).eq(0);
    expect(c.binary).is.false;
    expect(c.decline.index).eq(1);
    expect(c.decline.label).eq(DISCARD_DECLINE_KEY);
    expect(c.decline.forgone).deep.eq([{direction: 'gain', icon: 'cards', amount: 1}]);
    expect(declineIsButton(c)).is.true;
    expect(declineResponse(c)).deep.eq({type: 'or', index: 1, response: {type: 'option'}});
  });

  it('a target list (a steal): the answers stay, the decline goes to the button with the server\'s own words', () => {
    const c = optionalChoiceOf(or([
      leaf('Steal 2 M€ from red', {kind: 'steal', player: {color: 'red'}}),
      leaf('Steal 2 M€ from green', {kind: 'steal', player: {color: 'green'}}),
      skip('Do not steal'),
    ], 'attack'))!;
    expect(c.answers).deep.eq([0, 1]);
    expect(c.pick).eq(undefined);
    expect(c.binary).is.false;
    expect(c.decline.label).eq('Do not steal');
    expect(c.decline.forgone, 'several targets: the words say it').deep.eq([]);
    expect(declineIsButton(c)).is.true;
  });

  it('ONE target of an attack is still a target list (never a yes / no)', () => {
    const attack = optionalChoiceOf(or([leaf('Remove 3 M€ from red'), skip('Do not remove M€')], 'attack'))!;
    expect(attack.binary).is.false;
    const targeted = optionalChoiceOf(or([leaf('Remove 4 plants from red', {player: {color: 'red'}}), skip('Skip removing plants')]))!;
    expect(targeted.binary, 'a player target without a context').is.false;
  });

  it('a YES / NO (one effect offer, no target, no attack) keeps its two cards', () => {
    const c = optionalChoiceOf(or([leaf('Pay 2 M€ to draw a card'), skip('Do not buy a card')], 'optional-effect'))!;
    expect(c.binary).is.true;
    expect(declineIsButton(c)).is.false;
  });

  it('two declines or no answer are not read at all', () => {
    expect(optionalChoiceOf(or([skip(), skip()]))).eq(undefined);
    expect(optionalChoiceOf(or([skip()]))).eq(undefined);
    expect(optionalChoiceOf(discardPick() as never), 'not an `or`').eq(undefined);
  });
});

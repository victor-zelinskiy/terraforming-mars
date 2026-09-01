import {expect} from 'chai';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {resolveEntriesPluralGroups} from '@/client/components/journal/logLocalization';

const num = (v: string): LogMessageData => ({type: LogMessageDataType.RAW_STRING, value: v} as LogMessageData);
const player = (v: string): LogMessageData => ({type: LogMessageDataType.PLAYER, value: v} as LogMessageData);

describe('logLocalization (plural groups across token boundaries)', () => {
  it('a group agrees with the NUMBER TOKEN preceding it (ru three forms)', () => {
    // «…на <2> {деление|деления|делений}» — the number is its own token, the
    // group lives in the NEXT text fragment.
    const one = resolveEntriesPluralGroups([player('red'), ' поднял на ', num('1'), ' {деление|деления|делений}'], 'ru');
    expect(one[3]).to.eq(' деление');
    const few = resolveEntriesPluralGroups([player('red'), ' поднял на ', num('3'), ' {деление|деления|делений}'], 'ru');
    expect(few[3]).to.eq(' деления');
    const many = resolveEntriesPluralGroups([player('red'), ' поднял на ', num('11'), ' {деление|деления|делений}'], 'ru');
    expect(many[3]).to.eq(' делений');
  });

  it('an in-fragment number still wins over an earlier token (nearest-left rule)', () => {
    const out = resolveEntriesPluralGroups([num('7'), ' взял 2 {карту|карты|карт}'], 'ru');
    expect(out[1]).to.eq(' взял 2 карты');
  });

  it('English two-form groups resolve under the en rules (the key itself degrades gracefully)', () => {
    const one = resolveEntriesPluralGroups(['advanced ', num('1'), ' {row|rows} on the track'], 'en');
    expect(one[2]).to.eq(' row on the track');
    const many = resolveEntriesPluralGroups(['advanced ', num('4'), ' {row|rows} on the track'], 'en');
    expect(many[2]).to.eq(' rows on the track');
  });

  it('a non-numeric token (a card chip, a player) never becomes the agreement context', () => {
    const out = resolveEntriesPluralGroups([num('5'), ' — ', player('blue'), ' {деление|деления|делений}'], 'ru');
    // The nearest NUMBER is still 5 (the player token is transparent).
    expect(out[3]).to.eq(' делений');
  });

  it('entries without a single group pass through untouched (identity fast path)', () => {
    const entries = [player('red'), ' сыграл карту'];
    expect(resolveEntriesPluralGroups(entries, 'ru')).to.deep.eq(entries);
  });
});

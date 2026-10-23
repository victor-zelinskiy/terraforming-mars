import {expect} from 'chai';
import {readFileSync} from 'fs';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {influenceAtStep, influenceReadingAtStep, influenceReadingOf, NO_INFLUENCE} from '@/client/console/parliament/influenceReading';
import {BandFocus, parliamentBandLine} from '@/client/console/parliament/parliamentBand';

/*
 * THE ONE READING OF A SEAT'S INFLUENCE (T05 Event Analysts) — the final number is the server's, the track's level is
 * a cell's reward, the bonus is what stands beyond the Career. Pure; the client adds nothing up.
 */
const BLUE = 'blue' as Color;

describe('influenceReading', () => {
  it('a seat at step 3 (level 2) with Event Analysts reads 3 = 2 + 1, its giver named', () => {
    const reading = influenceReadingOf({influence: 3, agenda: 3, influenceSources: [{amount: 1, source: CardName.EVENT_ANALYSTS}]});
    expect(reading).deep.eq({total: 3, track: 2, bonus: 1, sources: [{amount: 1, source: CardName.EVENT_ANALYSTS}]});
  });

  it('a seat whose influence is the track\'s alone has no bonus and lists nothing', () => {
    expect(influenceReadingOf({influence: 2, agenda: 3})).deep.eq({total: 2, track: 2, bonus: 0, sources: []});
  });

  it('a seat the Parliament does not count (the server reads 0) shows no bonus — never a negative one', () => {
    expect(influenceReadingOf({influence: 0, agenda: 5})).deep.include({total: 0, bonus: 0});
    expect(influenceReadingOf(undefined)).deep.eq(NO_INFLUENCE);
  });

  it('a step reached keeps the bonus: step 5 (level 3) + 1 = 4', () => {
    const reading = influenceReadingOf({influence: 3, agenda: 3, influenceSources: [{amount: 1, source: CardName.EVENT_ANALYSTS}]});
    expect(influenceAtStep(reading, 5)).eq(4);
    expect(influenceReadingAtStep({influence: 3, agenda: 3, influenceSources: [{amount: 1}]}, 5)).deep.eq({total: 4, track: 3, bonus: 1, sources: [{amount: 1}]});
    expect(influenceReadingAtStep({influence: 2, agenda: 3}, 5), 'no bonus — the step\'s level says it once').is.undefined;
  });

  it('nothing here re-implements the sum: the module reads `influence`, never adds sources to the track', () => {
    const source = readFileSync('src/client/console/parliament/influenceReading.ts', 'utf8');
    expect(source).not.match(/sources\.reduce|amount\s*\+\s*influenceAtAgenda|influenceAtAgenda\([^)]*\)\s*\+\s*[a-z]+\.amount/);
  });
});

describe('the band speaks the final influence (T05)', () => {
  function agendaFocus(over: Partial<Extract<BandFocus, {kind: 'agenda'}>> = {}): BandFocus {
    return {kind: 'agenda', position: 3, influence: influenceReadingOf({influence: 3, agenda: 3, influenceSources: [{amount: 1, source: CardName.EVENT_ANALYSTS}]}), participates: true, ...over};
  }

  it('on the viewer\'s own stop: «step 3 · level 2» then «Influence 3 +1» — the level is the cell\'s, the count the final', () => {
    const line = parliamentBandLine({standing: {votes: 0, focus: agendaFocus({stop: {index: 3, kind: 'influence', influence: 2}})}});
    expect(line.chips[0]).deep.eq({kind: 'agenda', to: 3, level: 2});
    const count = line.chips.find((c) => c.kind === 'count');
    expect(count).deep.include({key: 'Influence', amount: 3});
    expect((count as {modifier?: {bonus: number}}).modifier?.bonus).eq(1);
  });

  it('the cursor-less line: the viewer\'s own stop names its LEVEL (never the total as a level), the next reward the next level', () => {
    const line = parliamentBandLine({standing: {votes: 0, focus: agendaFocus({next: {kind: 'tr'}})}});
    expect(line.chips[0], 'the cell\'s reward').deep.eq({kind: 'agenda', to: 3, level: 2});
    expect(line.chips[1]).deep.include({kind: 'count', amount: 3});
  });

  it('a seat with no bonus reads exactly as before: no modifier on the count', () => {
    const line = parliamentBandLine({standing: {votes: 0, focus: agendaFocus({influence: influenceReadingOf({influence: 2, agenda: 3})})}});
    const count = line.chips.find((c) => c.kind === 'count') as {modifier?: unknown};
    expect(count.modifier).is.undefined;
  });

  it('a walk\'s landed influence step carries the seat\'s final influence there («level 2 · influence 3 +1»)', () => {
    const influence = influenceReadingAtStep({influence: 2, agenda: 1, influenceSources: [{amount: 1, source: CardName.EVENT_ANALYSTS}]}, 3)!;
    const line = parliamentBandLine({standing: {votes: 0}, walk: {player: BLUE, landed: [{to: 3, level: 2, influence}]}});
    expect(line.chips[1]).deep.eq({kind: 'agenda', to: 3, level: 2, influence: {total: 3, track: 2, bonus: 1, sources: [{amount: 1, source: CardName.EVENT_ANALYSTS}]}});
  });
});

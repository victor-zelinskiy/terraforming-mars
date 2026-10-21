import {expect} from 'chai';
import {transferEndPointNow, unpaintedUnder} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {resolveGainIconEnds} from '@/client/console/consoleActionCommitMotion';
import {seatChipEnd} from '@/client/console/tilePlacement/cityDataPayoutBeat';
import {railAnswerTags} from '@/client/console/played/receivingStageModel';
import {Tag} from '@/common/cards/Tag';
import {EffectForecastFact} from '@/common/models/EffectForecastModel';
import {CardName} from '@/common/cards/CardName';

/*
 * «ОБА КОНЦА ПОЛЁТА — ЖИВЫЕ» (T06) — the DOM half. An end is an object measured NOW: where it is painted (a source) or
 * where it rests (a destination), through the ONE verdict of a visible end; gone means no point at all (the run then
 * does not fly — never a token out of / into the pose the object had). The sentinel names a bare point over nothing.
 */
describe('a flight end is an object — measured now', () => {
  let root: HTMLElement;
  const originalFromPoint = document.elementsFromPoint;

  const box = (el: Element, rect: {left: number, top: number, width: number, height: number}) => {
    (el as HTMLElement).getBoundingClientRect = () => ({
      ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height, x: rect.left, y: rect.top, toJSON: () => ({}),
    }) as DOMRect;
  };

  beforeEach(() => {
    root = document.createElement('div');
    root.className = 'con-root';
    document.body.appendChild(root);
    Object.defineProperty(window, 'innerWidth', {value: 1920, configurable: true});
    Object.defineProperty(window, 'innerHeight', {value: 1080, configurable: true});
  });

  afterEach(() => {
    root.remove();
    document.elementsFromPoint = originalFromPoint;
  });

  it('an object end answers the place on its CURRENT box — it follows the object that moved', () => {
    const icon = document.createElement('span');
    root.appendChild(icon);
    box(icon, {left: 100, top: 100, width: 20, height: 20});
    document.elementsFromPoint = () => [icon];
    const end = {el: icon, fx: 0.5, fy: 0.5};
    expect(transferEndPointNow(end, 'source')).deep.eq({x: 110, y: 110});
    box(icon, {left: 400, top: 60, width: 20, height: 20});
    expect(transferEndPointNow(end, 'source'), 'measured again, never cached').deep.eq({x: 410, y: 70});
  });

  it('a gone object is NO end — unmounted, hidden or covered by a foreign band surface', () => {
    const icon = document.createElement('span');
    root.appendChild(icon);
    box(icon, {left: 100, top: 100, width: 20, height: 20});
    const end = {el: icon, fx: 0.5, fy: 0.5};
    // Covered by a standing workspace that does not contain it.
    const glass = document.createElement('div');
    glass.className = 'con-ws con-cardactions';
    root.appendChild(glass);
    document.elementsFromPoint = () => [glass];
    expect(transferEndPointNow(end)).eq(undefined);
    // Hidden.
    document.elementsFromPoint = () => [icon];
    icon.style.visibility = 'hidden';
    expect(transferEndPointNow(end)).eq(undefined);
    icon.style.visibility = '';
    // Unmounted (the composer folded).
    icon.remove();
    expect(transferEndPointNow(end)).eq(undefined);
  });

  it('a bare point answers itself (it has no object to re-measure)', () => {
    expect(transferEndPointNow({x: 5, y: 6})).deep.eq({x: 5, y: 6});
  });

  it('the sentinel: nothing painted under a point is named — the page or the console\'s bare root; anything real is not', () => {
    document.elementsFromPoint = () => [root, document.body, document.documentElement];
    expect(unpaintedUnder({x: 10, y: 10})).to.match(/con-root/);
    const cell = document.createElement('div');
    cell.className = 'board-space';
    root.appendChild(cell);
    document.elementsFromPoint = () => [cell, root];
    expect(unpaintedUnder({x: 10, y: 10})).eq(undefined);
    expect(unpaintedUnder({x: -4, y: 10})).eq('off-screen');
  });

  it('the ACTION COMMIT\'s origins are the printed icon ELEMENTS (re-measured at the birth), never the points of the press', () => {
    const card = document.createElement('div');
    const icon = document.createElement('span');
    icon.className = 'pcard-ic';
    icon.style.backgroundImage = 'url(assets/resources/plant.png)';
    card.appendChild(icon);
    root.appendChild(card);
    box(icon, {left: 50, top: 50, width: 20, height: 20});
    const [end] = resolveGainIconEnds({cardEl: card, groupEl: undefined, resultEl: undefined, costEl: undefined},
      [{channel: 'stock', resource: 'plants', amount: 1}]);
    expect(end?.el).eq(icon);
    expect(end).to.include({fx: 0.5, fy: 0.5});
  });

  it('another seat\'s chip is the destination as an OBJECT — and no chip on screen is no destination (never the top of the screen)', () => {
    expect(seatChipEnd('red'), 'no strip').eq(undefined);
    const chip = document.createElement('span');
    chip.className = 'con-status__player';
    const dot = document.createElement('span');
    dot.className = 'con-status__dot player_bg_color_red';
    chip.appendChild(dot);
    root.appendChild(chip);
    box(dot, {left: 300, top: 20, width: 12, height: 12});
    expect(seatChipEnd('red')?.el).eq(dot);
    expect(seatChipEnd('blue')).eq(undefined);
  });
});

describe('the table\'s answer on the rail has a printed cause on the played card (T06 GMO Contract)', () => {
  const fact = (over: Partial<EffectForecastFact>): EffectForecastFact => ({
    source: {kind: 'card', name: CardName.GMO_CONTRACT, owner: 'blue', channel: 'card-played'},
    recipient: {kind: 'you'},
    certainty: 'exact',
    effects: [{icon: 'megacredits', amount: 2, direction: 'gain'}],
    reason: 'You play a card with an animal, plant or microbe tag',
    reasonTag: Tag.PLANT,
    ...over,
  } as EffectForecastFact);

  it('an exact card answer for you, woken by a tag: its rail row carries that tag and its share — one cause per printed tag', () => {
    expect(railAnswerTags([fact({})])).deep.eq({'stock:megacredits': [{tag: Tag.PLANT, amount: 2}]});
    expect(railAnswerTags([fact({}), fact({reasonTag: Tag.ANIMAL}), fact({reasonTag: Tag.MICROBE})])).deep.eq({'stock:megacredits': [
      {tag: Tag.PLANT, amount: 2}, {tag: Tag.ANIMAL, amount: 2}, {tag: Tag.MICROBE, amount: 2},
    ]});
  });

  it('a party\'s answer, a question, another seat\'s gain, an answer with no tag: nothing to be born on', () => {
    expect(railAnswerTags([fact({source: {kind: 'party', name: 'Greens', channel: 'card-played'} as unknown as EffectForecastFact['source']})])).deep.eq({});
    expect(railAnswerTags([fact({certainty: 'asks'})])).deep.eq({});
    expect(railAnswerTags([fact({recipient: {kind: 'player', color: 'red'} as unknown as EffectForecastFact['recipient']})])).deep.eq({});
    expect(railAnswerTags([fact({reasonTag: undefined})])).deep.eq({});
  });
});

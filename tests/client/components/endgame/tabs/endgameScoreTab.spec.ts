/*
 * EndgameScoreTab — the score, source by source: a column per player, a bar per scoring scale on ONE shared scale,
 * the colour legend, and the hover that ties one segment family across every column. A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md): it reads three props (`model`, `view`, `viewerColor`), emits nothing and
 * exposes nothing — so the spec is what it renders for them and what the pointer does to it. Mounted WITHOUT the
 * i18n plugin on purpose: the component imports `$t` and `v-i18n` itself, and a Vue warning (an unresolved
 * directive) fails the test.
 */
import {mount} from '@vue/test-utils';
import {expect} from 'chai';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {ViewModel} from '@/common/models/PlayerModel';
import EndgameScoreTab from '@/client/components/endgame/tabs/EndgameScoreTab.vue';
import {EndgameMode, EndgameModel, EndgamePlayerScore} from '@/client/components/endgame/endgameModel';
import {endgamePlayerHex} from '@/client/components/endgame/endgameColors';

function breakdown(p: Partial<VictoryPointsBreakdown>): VictoryPointsBreakdown {
  return {
    terraformRating: 14, terraformRatingBreakdown: {base: 14, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 0},
    milestones: 0, awards: 0, greenery: 0, city: 0, escapeVelocity: 0,
    moonHabitats: 0, moonMines: 0, moonRoads: 0, planetaryTracks: 0, deltaProject: 0, victoryPoints: 0, total: 14,
    detailsCards: [], detailsMilestones: [], detailsAwards: [], detailsPlanetaryTracks: [], negativeVP: 0,
    ...p,
  };
}

/** One score row — only what the tab reads. */
function score(color: Color, name: string, place: number, total: number, b: Partial<VictoryPointsBreakdown>): EndgamePlayerScore {
  return {color, name, place, total, isWinner: place === 1, breakdown: breakdown(b)} as unknown as EndgamePlayerScore;
}

function model(mode: EndgameMode, players: Array<EndgamePlayerScore>): EndgameModel {
  return {mode, players} as unknown as EndgameModel;
}

function view(moon = false): ViewModel {
  return {game: {moon: moon ? {} : undefined, pathfinders: undefined, gameOptions: {escapeVelocity: undefined}}} as unknown as ViewModel;
}

function tab(props: {model: EndgameModel, view: ViewModel, viewerColor?: Color}) {
  return mount(EndgameScoreTab, {props, global: {config: globalConfig.global.config}});
}

function width(el: Element): string {
  return (el as HTMLElement).style.width;
}

describe('EndgameScoreTab — the score, source by source', () => {
  // Victor: rating 14 + 6 (temperature), a city 5 and greenery 4, a milestone 5.
  const victor = () => score('red', 'Victor', 1, 34, {
    terraformRating: 20, terraformRatingBreakdown: {base: 14, temperature: 6, oxygen: 0, oceans: 0, venus: 0, cards: 0},
    city: 5, greenery: 4, milestones: 5,
  });
  // Nastya: rating 14 + 2 (oxygen), greenery 8, an award 5 — and a card that costs her 2.
  const nastya = () => score('blue', 'Nastya', 2, 27, {
    terraformRating: 16, terraformRatingBreakdown: {base: 14, temperature: 0, oxygen: 2, oceans: 0, venus: 0, cards: 0},
    greenery: 8, awards: 5, detailsCards: [{cardName: 'Bribed Committee', victoryPoint: -2, kind: 'penalty'}],
  });
  const duel = () => model('duel', [victor(), nastya()]);

  it('a column per player — place, name and total, the winner and the viewer marked, in the player\'s colour', () => {
    const w = tab({model: duel(), view: view(), viewerColor: 'red'});
    expect(w.classes()).to.include.members(['eg-tab', 'eg-score', 'eg-score--duel']);
    expect(w.find('.eg-score__grid').classes()).to.include('eg-score__grid--duel');
    expect(w.find('.eg-tab__hint').text())
      .to.eq($t('Each bar shares one scale across players — longer means more points from that source.'));

    const cols = w.findAll('.eg-score__col');
    expect(cols.map((c) => c.find('.eg-score__place').text())).to.deep.eq(['1', '2']);
    expect(cols.map((c) => c.find('.eg-score__name').text())).to.deep.eq(['Victor', 'Nastya']);
    expect(cols.map((c) => c.find('.eg-score__total').text())).to.deep.eq(['34' + $t('VP'), '27' + $t('VP')]);
    expect(cols.map((c) => c.classes().includes('eg-score__col--winner'))).to.deep.eq([true, false]);
    expect(cols.map((c) => c.classes().includes('eg-score__col--you'))).to.deep.eq([true, false]);
    expect(cols.map((c) => (c.element as HTMLElement).style.getPropertyValue('--eg-pc')))
      .to.deep.eq([endgamePlayerHex('red'), endgamePlayerHex('blue')]);
    expect(cols.map((c) => c.find('.eg-score__dot').classes().find((name) => name.startsWith('player_bg_color_'))))
      .to.deep.eq(['player_bg_color_red', 'player_bg_color_blue']);
  });

  it('a bar per scale on ONE shared scale — the same rows in every column, the leader marked, a loss in its own segment', () => {
    const w = tab({model: duel(), view: view()});
    const [mine, hers] = w.findAll('.eg-score__col').map((c) => c.findAll('.eg-score__scale'));
    const names = [$t('Terraform rating'), $t('Cards'), $t('Cities & greenery'), $t('Milestones & awards')];
    expect(mine.map((s) => s.find('.eg-score__scale-name').text()), 'no Moon row: the game has no Moon').to.deep.eq(names);
    expect(hers.map((s) => s.find('.eg-score__scale-name').text()), 'the columns stay aligned').to.deep.eq(names);
    expect(mine.map((s) => s.find('.eg-score__scale-val').text())).to.deep.eq(['+20', '0', '+9', '+5']);
    expect(hers.map((s) => s.find('.eg-score__scale-val').text())).to.deep.eq(['+16', '-2', '+8', '+5']);
    expect(mine.map((s) => s.classes().includes('eg-score__scale--zero'))).to.deep.eq([false, true, false, false]);
    expect(hers.map((s) => s.classes().includes('eg-score__scale--zero'))).to.deep.eq([false, false, false, false]);
    // The ▲ goes to the highest positive total of a scale — to both on a tie, to nobody where nobody scored.
    expect(mine.map((s) => s.find('.eg-score__lead').exists())).to.deep.eq([true, false, true, true]);
    expect(hers.map((s) => s.find('.eg-score__lead').exists())).to.deep.eq([false, false, false, true]);
    expect(mine[0].find('.eg-score__lead').attributes('aria-label')).to.eq($t('Category leader'));

    // Every bar is a share of the LONGEST scale of the table (Victor's rating, 20) — not of its own column.
    const rating = mine[0].findAll('.eg-score__seg');
    expect(rating.map((s) => width(s.element))).to.deep.eq(['70%', '30%']);
    expect(rating.map((s) => s.classes().find((name) => name.startsWith('vp-accent--'))))
      .to.deep.eq(['vp-accent--tr-base', 'vp-accent--temperature']);
    expect(hers[2].findAll('.eg-score__seg').map((s) => width(s.element)), 'her greenery against HIS rating').to.deep.eq(['40%']);
    const loss = hers[1].findAll('.eg-score__seg');
    expect(loss.map((s) => s.classes().includes('vp-scale__seg--penalty'))).to.deep.eq([true]);
    expect(loss.map((s) => width(s.element))).to.deep.eq(['10%']);
  });

  it('the legend names every segment family with each player\'s value — and a hover lights ONE family in every column', async () => {
    const w = tab({model: duel(), view: view()});
    const rows = w.findAll('.eg-score__legend-row');
    expect(rows.map((r) => r.find('.eg-score__legend-scale').text()))
      .to.deep.eq([$t('Terraform rating'), $t('Cards'), $t('Cities & greenery'), $t('Milestones & awards')]);
    const chips = rows[0].findAll('.eg-score__legend-chip');
    expect(chips.map((c) => c.find('.eg-score__legend-label').text()))
      .to.deep.eq([$t('Starting rating'), $t('Temperature'), $t('Oxygen')]);
    expect(chips.map((c) => c.findAll('.eg-score__legend-val').map((v) => v.text())), 'a seat without the segment reads 0')
      .to.deep.eq([['14', '14'], ['6', '0'], ['0', '2']]);
    expect(w.find('.eg-score__tip').exists()).to.eq(false);

    // The pointer on Victor's temperature segment: the tooltip above it, the family lit, everything else dimmed.
    const segs = () => w.findAll('.eg-score__seg');
    const hot = () => segs().map((s) => s.classes().includes('eg-score__seg--hot'));
    const dim = () => segs().map((s) => s.classes().includes('eg-score__seg--dim'));
    const temperature = segs()[1];
    (temperature.element as HTMLElement).getBoundingClientRect = (): DOMRect => ({
      x: 10, y: 300, left: 10, top: 300, width: 20, height: 10, right: 30, bottom: 310, toJSON: () => ({}),
    });
    await temperature.trigger('mouseenter');
    const tip = w.find('.eg-score__tip');
    expect(tip.find('.eg-score__tip-head').text()).to.eq($t('Temperature'));
    expect(tip.find('.eg-score__tip-head .eg-score__legend-dot').classes()).to.include('vp-accent--temperature');
    expect(tip.findAll('.eg-score__tip-name').map((n) => n.text())).to.deep.eq(['Victor', 'Nastya']);
    expect(tip.findAll('.eg-score__tip-val').map((v) => v.text())).to.deep.eq(['+6', '0']);
    expect(tip.findAll('.eg-score__tip-row').map((r) => r.classes().includes('eg-score__tip-row--hot')), 'the hovered column\'s seat')
      .to.deep.eq([true, false]);
    const style = (tip.element as HTMLElement).style;
    expect([style.left, style.top], 'above the segment, clamped to the viewport\'s edge').to.deep.eq(['8px', '288px']);
    expect(hot().filter((lit) => lit)).to.have.lengthOf(1);
    expect(hot()[1]).to.eq(true);
    expect(dim().filter((dimmed) => dimmed)).to.have.lengthOf(segs().length - 1);
    const chipClasses = () => w.findAll('.eg-score__legend-chip').map((c) => c.classes());
    expect(chipClasses().map((c) => c.includes('eg-score__legend-chip--hot'))[1]).to.eq(true);
    expect(chipClasses().filter((c) => c.includes('eg-score__legend-chip--dim'))).to.have.lengthOf(chipClasses().length - 1);

    await temperature.trigger('mouseleave');
    expect(w.find('.eg-score__tip').exists()).to.eq(false);
    expect([...hot(), ...dim()].some((on) => on)).to.eq(false);

    // …and the other way round: a legend chip (pointer or focus) lights its segments in BOTH columns, with no tooltip.
    const base = w.findAll('.eg-score__legend-chip')[0];
    await base.trigger('focus');
    expect(segs().filter((s) => s.classes().includes('eg-score__seg--hot')).map((s) => s.classes().includes('vp-accent--tr-base')))
      .to.deep.eq([true, true]);
    expect(w.find('.eg-score__tip').exists()).to.eq(false);
    await base.trigger('blur');
    expect(hot().some((on) => on)).to.eq(false);
  });

  it('follows its props — a table past a duel drops the inline values, a Moon game gains its row, the viewer mark moves', async () => {
    const w = tab({model: duel(), view: view(), viewerColor: 'red'});
    expect(w.find('.eg-score__legend-vals').exists()).to.eq(true);

    const oleg = score('green', 'Oleg', 3, 17, {moonHabitats: 2, moonRoads: 1});
    await w.setProps({model: model('standings', [victor(), nastya(), oleg]), viewerColor: 'green'});
    expect(w.classes()).to.include('eg-score--standings');
    expect(w.find('.eg-score__grid').classes()).to.not.include('eg-score__grid--duel');
    expect(w.findAll('.eg-score__col').map((c) => c.classes().includes('eg-score__col--you'))).to.deep.eq([false, false, true]);
    expect(w.find('.eg-score__legend-vals').exists(), 'three columns read their values in the tooltip').to.eq(false);
    expect(w.findAll('.eg-score__scale-name').map((n) => n.text()), 'Moon points in a game without the Moon are not a row')
      .to.not.include($t('Moon'));

    await w.setProps({view: view(true)});
    const scales = w.findAll('.eg-score__col')[2].findAll('.eg-score__scale');
    expect(scales.map((s) => s.find('.eg-score__scale-name').text())).to.include($t('Moon'));
    expect(scales[scales.length - 1].find('.eg-score__scale-val').text()).to.eq('+3');
    expect(w.findAll('.eg-score__col')[0].findAll('.eg-score__scale'), 'every column gains the row').to.have.lengthOf(scales.length);
  });
});

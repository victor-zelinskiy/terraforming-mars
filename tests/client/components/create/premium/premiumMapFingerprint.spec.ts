/*
 * PremiumMapFingerprint — the miniature of a Mars board («карточка поля»): a literal picture of the REAL layout
 * (`genfiles/boardLayouts.json` through the one shared grid mapping), or the layered ghost of a random pick. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): six props, no emits, nothing exposed — so the
 * spec is what it draws for them. The expected numbers are read off the same layout and geometry modules the
 * component stands on, never remembered.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';
import {clientBoardLayout} from '@/client/boards/clientBoardLayouts';
import {BoardName} from '@/common/boards/BoardName';
import {SpaceBonus} from '@/common/boards/SpaceBonus';
import {SpaceType} from '@/common/boards/SpaceType';
import {MINI_ROWS, miniLayoutBounds} from '@/common/boards/boardLayoutGeometry';

function fingerprint(props: Record<string, unknown>) {
  return mount(PremiumMapFingerprint, {props, global: {config: globalConfig.global.config}});
}

/** A custom property of an element's inline style. */
function styleVar(el: Element, name: string): string {
  return (el as HTMLElement).style.getPropertyValue(name);
}

describe('PremiumMapFingerprint — the miniature of a board', () => {
  const tharsis = clientBoardLayout(BoardName.THARSIS);

  it('a random pick: three ghost silhouettes of the standard grid under the shuffle glyph — no board, the accent on the root', () => {
    const w = fingerprint({random: true, mapId: BoardName.THARSIS, accent: '10,20,30'});
    expect(w.classes()).to.deep.eq(['map-fp', 'map-fp--card', 'map-fp--random']);
    expect(styleVar(w.element as Element, '--map-accent')).to.eq('10,20,30');
    expect(w.find('.map-fp__board').exists(), 'a random pick never draws a real board — even with a map named').to.eq(false);
    expect(w.find('.map-fp__legend').exists()).to.eq(false);

    const ghosts = w.findAll('.map-fp__stack > svg.map-fp__ghost');
    expect(ghosts).to.have.length(3);
    expect(ghosts.map((g) => styleVar(g.element, '--g')), 'the deepest layer first').to.deep.eq(['2', '1', '0']);
    const hexes = MINI_ROWS.reduce((sum, n) => sum + n, 0);
    expect(ghosts.map((g) => g.findAll('polygon.map-fp__ghost-hex').length)).to.deep.eq([hexes, hexes, hexes]);
    expect(ghosts[0].attributes('viewBox')?.split(' ')).to.have.length(4);
    expect(w.find('.map-fp__stack > .map-fp__shuffle > svg').exists()).to.eq(true);
  });

  it('a named map: one group per real cell inside the layout\'s own bounds — oceans, coves and printed bonuses where the board has them', () => {
    expect(tharsis.length, 'the generated layouts are in the bundle').to.be.greaterThan(0);
    const w = fingerprint({mapId: BoardName.THARSIS});
    expect(w.classes(), 'the default tier, the default accent').to.deep.eq(['map-fp', 'map-fp--card']);
    expect(styleVar(w.element as Element, '--map-accent')).to.eq('240,168,80');
    expect(w.find('.map-fp__stack').exists()).to.eq(false);

    const b = miniLayoutBounds(tharsis);
    const box = w.find('svg.map-fp__board').attributes('viewBox')?.split(' ').map(Number);
    expect(box).to.deep.eq([b.minX - 4, b.minY - 4, b.width + 8, b.height + 8].map((n) => Number(n.toFixed(1))));

    const cells = w.findAll('svg.map-fp__board > g');
    expect(cells).to.have.length(tharsis.length);
    expect(cells.every((cell) => /^translate\(-?[\d.]+ -?[\d.]+\)$/.test(cell.attributes('transform') ?? '')), 'the position is the OUTER group\'s attribute').to.eq(true);
    expect(cells.every((cell) => cell.find('g.map-fp__cell > polygon.map-fp__hex').exists())).to.eq(true);
    expect(w.findAll('.map-fp__hex--ocean')).to.have.length(tharsis.filter((s) => s.t === SpaceType.OCEAN).length);
    expect(w.findAll('.map-fp__hex-half'), 'Tharsis has no cove').to.have.length(0);
    // Every cell with something printed on it (or a volcano) carries its glyphs inside its own group.
    expect(w.findAll('.map-fp__cell > .map-fp__glyphs')).to.have.length(tharsis.filter((s) => s.b.length > 0 || s.v === true).length);
    const twoBonuses = tharsis.findIndex((s) => s.b.length === 2 && s.v !== true);
    expect(twoBonuses, 'Tharsis prints a pair somewhere').to.be.greaterThan(-1);
    expect(cells[twoBonuses].findAll('.map-fp__glyphs > g')).to.have.length(2);
    expect(w.find('.map-fp__legend').exists(), 'the legend is the hero tier\'s').to.eq(false);

    // A cove is two surfaces: its ocean half is a polygon of its own over the hex.
    const arabia = clientBoardLayout(BoardName.ARABIA_TERRA);
    const coves = arabia.filter((s) => s.t === SpaceType.COVE).length;
    expect(coves).to.be.greaterThan(0);
    const cove = fingerprint({mapId: BoardName.ARABIA_TERRA});
    expect(cove.findAll('.map-fp__hex--cove')).to.have.length(coves);
    expect(cove.findAll('.map-fp__hex-half')).to.have.length(coves);
  });

  it('the tier decides the detail: a thumb draws the surface only, the hero adds the legend of the board\'s commonest bonuses', async () => {
    const w = fingerprint({mapId: BoardName.THARSIS, variant: 'thumb'});
    expect(w.classes()).to.deep.eq(['map-fp', 'map-fp--thumb']);
    expect(w.findAll('svg.map-fp__board > g')).to.have.length(tharsis.length);
    expect(w.findAll('.map-fp__glyphs'), 'no glyph at thumb scale').to.have.length(0);
    expect(w.find('.map-fp__legend').exists()).to.eq(false);

    await w.setProps({variant: 'hero'});
    expect(w.classes()).to.deep.eq(['map-fp', 'map-fp--hero']);
    expect(w.findAll('.map-fp__glyphs').length).to.be.greaterThan(0);
    const printed = new Set(tharsis.flatMap((s) => s.b).filter((bonus) => bonus !== SpaceBonus.OCEAN));
    const chips = w.findAll('.map-fp__legend > .map-fp__legend-chip');
    expect(chips, 'at most four, and never the ocean bonus').to.have.length(Math.min(4, printed.size));
    expect(chips.every((chip) => chip.find('svg').exists()), 'each chip is the bonus\'s own glyph').to.eq(true);

    // No map at all (and not random): an empty surface, no legend — nothing throws.
    const empty = fingerprint({variant: 'hero'});
    expect(empty.findAll('svg.map-fp__board > g')).to.have.length(0);
    expect(empty.find('.map-fp__legend').exists()).to.eq(false);
  });

  it('the reveal: every cell gets its own delay — the wave from the surface\'s centre, after the card\'s stagger', async () => {
    const w = fingerprint({mapId: BoardName.THARSIS});
    const delays = () => w.findAll('g.map-fp__cell').map((cell) => styleVar(cell.element, '--d'));
    expect(w.classes('map-fp--reveal')).to.eq(false);
    expect(delays().every((d) => d === ''), 'no reveal — no delay').to.eq(true);

    await w.setProps({reveal: true, revealDelayMs: 300});
    expect(w.classes()).to.deep.eq(['map-fp', 'map-fp--card', 'map-fp--reveal']);
    const ms = delays().map((d) => Number(d.replace(/ms$/, '')));
    expect(delays().every((d) => /^\d+ms$/.test(d))).to.eq(true);
    expect(Math.min(...ms), 'nothing starts before the stagger').to.be.at.least(300);
    expect(Math.max(...ms), 'the whole wave is 420 ms long').to.be.at.most(720);
    expect(new Set(ms).size, 'a wave, not one beat').to.be.greaterThan(1);
  });
});

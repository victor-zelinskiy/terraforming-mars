/*
 * ConsoleAlbumSpine — the ONE place an album's page position renders («‹ 2 / 4 ›» in its well, a progress hairline
 * under it). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its three
 * props, the one event it emits (`page`, with the direction — a muted side swallows the click), and its one
 * micro-behaviour — an ACTUAL page change fires the side chip of its direction once and the flash ends by itself (a
 * wait of the flow kernel: the spec drives the kernel's clock). It exposes nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {motionMs} from '@/client/components/motion/motionTokens';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {AlbumSpinePosition} from '@/client/components/console/foundation/consoleAlbumSpineTypes';
import ConsoleAlbumSpine from '@/client/components/console/foundation/ConsoleAlbumSpine.vue';

// The bumper badge is the glyph system's own subject — this spec reads which CONTROL each side asks for.
// (A render function, not a template string: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: ['control'],
  render: () => h('i', {class: 'glyph-stub'}),
});

function at(page: number, pages: number): AlbumSpinePosition {
  return {page, pages, canPrev: page > 1, canNext: page < pages};
}

function spine(props: {album: AlbumSpinePosition, held?: boolean, variant?: 'dock' | 'foot'}) {
  return mount(ConsoleAlbumSpine, {props, global: {config: globalConfig.global.config, stubs: {GamepadGlyph: GlyphStub}}});
}

describe('ConsoleAlbumSpine — an album\'s page position', () => {
  let clock: ManualFlowClock;
  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
  });
  afterEach(() => {
    setFlowClock(undefined);
  });

  it('the position: the page and the total, a bumper on each side, a segment per page — the current one on, the earlier ones past', () => {
    const w = spine({album: at(2, 4)});
    expect((w.element as HTMLElement).tagName).to.eq('SPAN');
    expect(w.classes()).to.deep.eq(['con-handdock__pager', 'con-album-spine']);
    expect(w.attributes('data-album-spine')).to.eq('');
    expect(w.find('.con-handdock__pager-well').attributes('aria-hidden')).to.eq('true');

    expect(w.find('.con-handdock__pager-pos > .con-handdock__pager-now > b').text()).to.eq('2');
    expect(w.find('.con-handdock__pager-now').classes(), 'before any turn the number is set to enter as «next»')
      .to.deep.eq(['con-handdock__pager-now', 'con-handdock__pager-now--next']);
    expect(w.find('.con-handdock__pager-total').text()).to.eq('4');

    const sides = w.findAll('button.con-handdock__pager-side');
    expect(sides.map((side) => side.classes())).to.deep.eq([
      ['con-handdock__pager-side', 'con-handdock__pager-side--prev'],
      ['con-handdock__pager-side', 'con-handdock__pager-side--next'],
    ]);
    expect(sides.map((side) => side.attributes('tabindex'))).to.deep.eq(['-1', '-1']);
    expect(w.findAllComponents(GlyphStub).map((glyph) => glyph.props('control'))).to.deep.eq(['bumperL', 'bumperR']);

    const segments = w.findAll('.con-handdock__pager-track > .con-handdock__pager-seg');
    expect(segments.map((seg) => seg.classes().filter((name) => name !== 'con-handdock__pager-seg'))).to.deep.eq([
      ['con-handdock__pager-seg--past'], ['con-handdock__pager-seg--on'], [], [],
    ]);
    expect(w.find('.con-handdock__pager-bar').exists(), 'four pages are still segments').to.eq(false);
  });

  it('where it is seated and how it stands: the foot, a held spine, a one-page album (no track), a long album (one fill)', async () => {
    const w = spine({album: at(1, 1), variant: 'foot', held: true});
    expect(w.classes()).to.include.members(['con-album-spine--foot', 'con-handdock__pager--single', 'con-handdock__pager--held']);
    expect(w.find('.con-handdock__pager-track').exists(), 'one page has no progress to show').to.eq(false);
    // Muted IN PLACE — never hidden: both sides stand, both off.
    expect(w.findAll('.con-handdock__pager-side--off')).to.have.length(2);

    await w.setProps({album: at(3, 12), variant: 'dock', held: false});
    expect(w.classes()).to.not.include.members(['con-album-spine--foot', 'con-handdock__pager--single', 'con-handdock__pager--held']);
    expect(w.findAll('.con-handdock__pager-side--off')).to.have.length(0);
    expect(w.findAll('.con-handdock__pager-seg'), 'past eight pages the track is one continuous fill').to.have.length(0);
    expect(w.find('.con-handdock__pager-bar > .con-handdock__pager-bar-fill').attributes('style')).to.contain('width: 25%');
  });

  it('a side that can turn emits `page` with its direction — a muted side swallows the click', async () => {
    const w = spine({album: at(1, 3)});
    const [prev, next] = w.findAll('button.con-handdock__pager-side');
    expect(prev.classes()).to.include('con-handdock__pager-side--off');
    expect(next.classes()).to.not.include('con-handdock__pager-side--off');

    await prev.trigger('click');
    expect(w.emitted('page'), 'there is no page that way').to.eq(undefined);
    await next.trigger('click');
    expect(w.emitted('page')).to.deep.eq([[1]]);

    await w.setProps({album: at(3, 3)});
    await next.trigger('click');
    expect(w.emitted('page'), 'the last page: the edge is felt, nothing is asked').to.deep.eq([[1]]);
    await prev.trigger('click');
    expect(w.emitted('page')).to.deep.eq([[1], [-1]]);
  });

  it('an ACTUAL page change fires the chip of its direction once and re-seats the number; the flash ends by itself', async () => {
    const w = spine({album: at(2, 4)});
    await nextTick();
    expect(w.classes().filter((name) => name.includes('--fired-')), 'a mount is silent').to.deep.eq([]);
    const seated = w.find('.con-handdock__pager-now > b').element;

    await w.setProps({album: at(3, 4)});
    expect(w.classes()).to.include('con-handdock__pager--fired-next');
    expect(w.find('.con-handdock__pager-now').classes()).to.include('con-handdock__pager-now--next');
    expect(w.find('.con-handdock__pager-now > b').text()).to.eq('3');
    expect(w.find('.con-handdock__pager-now > b').element, 'the number is a NEW node — its entry plays again').to.not.eq(seated);

    // A second turn inside the flash takes the first one back and reads its own length whole.
    clock.advance(motionMs(200));
    await w.setProps({album: at(2, 4)});
    expect(w.classes()).to.include('con-handdock__pager--fired-prev');
    expect(w.classes()).to.not.include('con-handdock__pager--fired-next');
    expect(w.find('.con-handdock__pager-now').classes()).to.include('con-handdock__pager-now--prev');
    clock.advance(motionMs(200));
    await nextTick();
    expect(w.classes(), 'the first turn\'s timer was taken back').to.include('con-handdock__pager--fired-prev');

    clock.advance(motionMs(100));
    await nextTick();
    expect(w.classes().filter((name) => name.includes('--fired-')), 'a one-shot: it ends on its own').to.deep.eq([]);
    expect(w.find('.con-handdock__pager-now').classes(), 'the direction stays — it is the next entry\'s side').to.include('con-handdock__pager-now--prev');
    expect(clock.pending(), 'nothing of the flash is left on the clock').to.eq(0);

    // An availability re-derive with no page move fires nothing.
    await w.setProps({album: {...at(2, 4), canNext: false}});
    expect(w.classes().filter((name) => name.includes('--fired-'))).to.deep.eq([]);
    expect(clock.pending()).to.eq(0);
  });
});

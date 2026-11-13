/*
 * ConsoleLoadingScreen — the full-bleed curtain of every screen boundary. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): no props, nothing emitted, nothing exposed — it composes the scene-transition
 * director's state (`loadingScreenState`), so this spec moves THAT state and reads the frame; its two lifecycle
 * moments (the take-over from the static boot curtain, the «text is painted» word to the director) are probe ticks of
 * the flow kernel and are stepped on the kernel's manual clock.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {curtainKickerKey, curtainStatusKey, loadingScreenState} from '@/client/console/loadingScreenState';
import {PROBE_TICK_FALLBACK_MS} from '@/client/console/probeTick';
import {inputModeState} from '@/client/gamepad/inputModeState';
import ConsoleLoadingScreen from '@/client/components/console/ConsoleLoadingScreen.vue';

// The glyph is the gamepad family's own subject; this spec reads WHETHER the curtain draws it and for which control.
// (A render function, not a template string: the runtime compiler is not in this build.)
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
});

function curtain() {
  return mount(ConsoleLoadingScreen, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {GamepadGlyph: GlyphStub}},
  });
}

describe('ConsoleLoadingScreen — the scene transition\'s curtain', () => {
  const stateBefore = {...loadingScreenState};
  const modeBefore = inputModeState.mode;
  let clock: ManualFlowClock;

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
  });

  afterEach(() => {
    // A probe tick is a GUARANTEED wait of the session: the ones this test left standing run out on the manual clock,
    // so none is stranded on a clock nobody advances. Then the bundle-shared module state is put back — the
    // director's state, the input mode and the kernel's clock.
    clock.advance(2 * PROBE_TICK_FALLBACK_MS);
    Object.assign(loadingScreenState, stateBefore);
    inputModeState.mode = modeBefore;
    setFlowClock(undefined);
    document.getElementById('boot-curtain')?.remove();
    document.documentElement.classList.remove('tm-boot-cover');
  });

  it('composes the director\'s state: no text until the wait is real, then the status in the director\'s own words', async () => {
    const w = curtain();
    expect((w.element as HTMLElement).tagName, 'the template starts with its root').to.eq('DIV');
    expect(w.classes()).to.include('con-load');
    expect(w.attributes('role')).to.eq('status');
    expect(w.attributes('aria-label')).to.eq($t(curtainStatusKey(undefined, false)));
    const foot = w.find('.con-load__foot');
    expect(foot.classes(), 'a fast load never flashes copy').to.not.include('con-load__foot--shown');
    expect(w.find('.con-load__kicker').text()).to.eq($t(curtainKickerKey(undefined)));
    expect(w.find('.con-load__title-line').exists(), 'no mission — no title line').to.eq(false);
    expect(w.find('.con-load__btn').exists(), 'nothing actionable').to.eq(false);

    loadingScreenState.textShown = true;
    await nextTick();
    expect(foot.classes()).to.include('con-load__foot--shown');
    expect(w.find('.con-load__status').text()).to.eq($t(curtainStatusKey(undefined, false)));

    loadingScreenState.longWait = true;
    await nextTick();
    expect(w.find('.con-load__status').text(), 'a long wait changes the phrasing').to.eq($t(curtainStatusKey(undefined, true)));
    expect(w.attributes('aria-label')).to.eq($t(curtainStatusKey(undefined, true)));
  });

  it('a failed load is the error state: the reason and Retry, no status, no fullscreen prompt; the glyph only while a pad drives', async () => {
    loadingScreenState.error = 'Connection lost';
    loadingScreenState.fullscreenLost = true;
    const w = curtain();
    expect(w.find('.con-load__foot').classes(), 'an error is actionable — outside the text policy').to.include('con-load__foot--shown');
    expect(w.find('.con-load__error').text()).to.eq(`✕ ${$t('Connection lost')}`);
    expect(w.find('.con-load__status').exists()).to.eq(false);
    expect(w.find('.con-load__btn').text()).to.eq($t('Retry'));
    expect(w.find('.con-load__btn--fs').exists(), 'one action at a time').to.eq(false);
    expect(w.findAllComponents(GlyphStub), 'a pointer needs no button name').to.have.length(0);

    inputModeState.mode = 'gamepad';
    await nextTick();
    const glyphs = w.findAllComponents(GlyphStub);
    expect(glyphs).to.have.length(1);
    expect(glyphs[0].props('control')).to.eq('confirm');
  });

  it('a lost fullscreen offers the restore outside the text policy; the press clears the offer', async () => {
    loadingScreenState.fullscreenLost = true;
    const w = curtain();
    const restore = w.find('.con-load__btn--fs');
    expect(restore.text()).to.eq($t('Restore fullscreen'));
    expect(w.find('.con-load__foot').classes(), 'the prompt does not need the foot').to.not.include('con-load__foot--shown');

    await restore.trigger('click');
    expect(loadingScreenState.fullscreenLost).to.eq(false);
    expect(w.find('.con-load__btn--fs').exists()).to.eq(false);
  });

  it('takes over from the static boot curtain two settled ticks after it mounts, and arms a tick when its text turns on', async () => {
    const boot = document.createElement('div');
    boot.id = 'boot-curtain';
    document.body.appendChild(boot);
    document.documentElement.classList.add('tm-boot-cover');

    curtain();
    expect(document.getElementById('boot-curtain'), 'not before this surface has painted').to.not.eq(null);
    clock.advance(2 * PROBE_TICK_FALLBACK_MS);
    expect(document.getElementById('boot-curtain'), 'the hand-off is done').to.eq(null);
    expect(document.documentElement.classList.contains('tm-boot-cover')).to.eq(false);

    // The readable dwell counts from the PAINT of the status line: the patch that turns the foot on arms a tick…
    const standing = clock.pending();
    loadingScreenState.textShown = true;
    await nextTick();
    expect(clock.pending(), 'a probe tick stands after the foot turned on').to.be.greaterThan(standing);
    clock.advance(PROBE_TICK_FALLBACK_MS);
    expect(clock.pending()).to.eq(standing);

    // …and a change that leaves the foot standing asks for nothing more.
    loadingScreenState.longWait = true;
    await nextTick();
    expect(clock.pending()).to.eq(standing);
  });
});

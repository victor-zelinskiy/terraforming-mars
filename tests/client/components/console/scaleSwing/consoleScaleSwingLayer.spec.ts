/*
 * ConsoleScaleSwingLayer — the shell-level stage of a parameter swing («ОБРАТНЫЙ ХОД», TR47). A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md): no props, no emits, nothing exposed — it draws the director's
 * module state (`scaleSwingState`: the scene's state on its root for the probes, the tags) and lets the scene go when
 * it leaves. The director's own behaviour is `tests/client/console/scaleSwing.spec.ts`.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {resetScaleSwing, ScaleSwingTag, scaleSwingState} from '@/client/console/scaleSwing/scaleSwingDirector';
import ConsoleScaleSwingLayer from '@/client/components/console/scaleSwing/ConsoleScaleSwingLayer.vue';

const ROOT = '[data-scale-swing]';

function layer() {
  return mount(ConsoleScaleSwingLayer as any, {...globalConfig});
}

const fall: ScaleSwingTag = {id: 1, accent: 'temperature', kind: 'down', amount: 2, unit: '°C', x: 100.4, y: 50.6, anchor: 'marker'};
const limit: ScaleSwingTag = {id: 2, accent: 'oxygen', kind: 'max', amount: 0, unit: '%', x: 300, y: 80, anchor: 'marker'};
const floor: ScaleSwingTag = {id: 3, accent: 'oceans', kind: 'min', amount: 0, unit: '', x: 40, y: 12, anchor: 'hud'};

describe('ConsoleScaleSwingLayer — the stage of a parameter swing', () => {
  afterEach(() => {
    // Module state is shared by the whole bundle: the scene never outlives its spec.
    resetScaleSwing();
  });

  it('draws nothing while no swing is told', () => {
    const w = layer();
    expect(scaleSwingState.phase).to.eq('idle');
    expect(w.find(ROOT).exists()).to.eq(false);
    expect(w.find('.con-scaleswing').exists()).to.eq(false);
  });

  it('its root carries the scene\'s state for the probes — and follows the director', async () => {
    const w = layer();
    scaleSwingState.phase = 'waiting';
    scaleSwingState.seq = 7;
    await nextTick();
    const root = w.find(ROOT);
    expect(root.classes()).to.include.members(['con-scaleswing', 'con-flight-to-board']);
    expect(root.attributes('data-flight-lands')).to.eq('board');
    expect(root.attributes('aria-hidden')).to.eq('true');
    expect(root.attributes('data-scale-swing')).to.eq('waiting');
    expect(root.attributes('data-scale-swing-seq')).to.eq('7');
    expect(root.attributes('data-scale-swing-leg'), 'between legs').to.eq(undefined);
    expect(root.attributes('data-scale-swing-played')).to.eq('');
    expect(root.attributes('data-scale-swing-degraded')).to.eq(undefined);

    scaleSwingState.phase = 'playing';
    scaleSwingState.leg = 'down:temperature';
    scaleSwingState.played = ['up:temperature', 'down:temperature'];
    scaleSwingState.degraded = true;
    await nextTick();
    expect(root.attributes('data-scale-swing')).to.eq('playing');
    expect(root.attributes('data-scale-swing-leg')).to.eq('down:temperature');
    expect(root.attributes('data-scale-swing-played')).to.eq('up:temperature,down:temperature');
    expect(root.attributes('data-scale-swing-degraded')).to.eq('1');
  });

  it('a fall\'s tag reads its step and «the TR stays»; a limit is named in place — each where the director stood it', async () => {
    const w = layer();
    scaleSwingState.phase = 'playing';
    scaleSwingState.tags = [fall, limit, floor];
    await nextTick();
    const tags = w.findAll('.con-scaleswing__tag');
    expect(tags.map((t) => t.attributes('data-scale-swing-tag'))).to.deep.eq(['temperature', 'oxygen', 'oceans']);
    expect(tags.map((t) => t.attributes('data-scale-swing-kind'))).to.deep.eq(['down', 'max', 'min']);

    const [down, max, min] = tags;
    expect(down.classes()).to.include.members(['con-scaleswing__tag--down', 'con-scaleswing__tag--at-marker']);
    expect((down.element as HTMLElement).style.left, 'whole pixels').to.eq('100px');
    expect((down.element as HTMLElement).style.top).to.eq('51px');
    expect(down.find('.con-scaleswing__delta').text()).to.eq('−2°C');
    expect(down.find('.con-scaleswing__sep').text()).to.eq('·');
    expect(down.find('.con-scaleswing__note').text()).to.eq($t('the TR stays'));
    expect(down.find('.con-scaleswing__limit').exists()).to.eq(false);

    expect(max.classes()).to.include.members(['con-scaleswing__tag--max', 'con-scaleswing__tag--at-marker']);
    expect(max.find('.con-scaleswing__limit').text()).to.eq($t('MAX'));
    expect(max.find('.con-scaleswing__delta').exists(), 'nothing falls at a limit').to.eq(false);
    expect(min.classes()).to.include.members(['con-scaleswing__tag--min', 'con-scaleswing__tag--at-hud']);
    expect(min.find('.con-scaleswing__limit').text()).to.eq($t('MIN'));

    scaleSwingState.tags = [limit];
    await nextTick();
    expect(w.findAll('.con-scaleswing__tag').map((t) => t.attributes('data-scale-swing-tag'))).to.deep.eq(['oxygen']);
  });

  it('LEAVING mid-scene lets the scene go — the display returns to rest', async () => {
    const w = layer();
    scaleSwingState.phase = 'playing';
    scaleSwingState.seq = 3;
    scaleSwingState.leg = 'up:oxygen';
    scaleSwingState.tags = [limit];
    await nextTick();
    expect(w.find(ROOT).exists()).to.eq(true);

    w.unmount();
    expect(scaleSwingState.phase).to.eq('idle');
    expect(scaleSwingState.seq).to.eq(0);
    expect(scaleSwingState.leg).to.eq('');
    expect(scaleSwingState.tags).to.deep.eq([]);
  });
});

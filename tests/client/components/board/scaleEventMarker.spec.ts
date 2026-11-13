/*
 * ScaleEventMarker — a planetary-EVENT chip pinned to a global-parameter threshold. A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md). The chip's look is the shared ArcScaleMarkerChip's subject; this wrapper
 * owns what it HANDS that chip: the event's lifecycle (upcoming / resolved / claimed in a player's colour), the box it
 * stands in, and the diegetic tooltip. Ten props in, nothing out.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import ScaleEventMarker from '@/client/components/board/ScaleEventMarker.vue';
import {GlobalParameterThresholdMarker} from '@/client/components/board/oceanThresholdMarkers';
import {CLAIM_COLOR_HEX} from '@/client/components/board/scaleBonusZones';
import {ScaleTooltipContent} from '@/client/components/board/scaleTooltipState';

// The shared chip has its own surface; this spec reads what the wrapper HANDS it. The chip is the wrapper's ROOT, so
// the wrapper's own class / style / role land on the stub's element.
// (A render function, not a template string: the runtime compiler is not in this build.)
const ChipStub = defineComponent({
  name: 'ArcScaleMarkerChip',
  props: ['variant', 'surface', 'reached', 'state', 'claimColor', 'claimKey', 'point', 'pointerDist', 'pointerLen', 'icon', 'tooltip'],
  render: () => h('i', {class: 'chip-stub'}),
});

const HAZARD: GlobalParameterThresholdMarker = {
  id: 'spec-scale-event-hazard',
  parameter: 'oceans',
  value: 3,
  kind: 'hazard-event',
  icon: 'ocean-event-icon--hazard',
  title: 'Planetary event',
  description: 'Erosions appear on the surface when the 3rd ocean is placed.',
  reward: {recipient: 'none', deltas: []},
  enabled: true,
  visible: true,
};

const REWARDED: GlobalParameterThresholdMarker = {
  id: 'spec-scale-event-rewarded',
  parameter: 'temperature',
  value: -4,
  kind: 'planetary-event',
  icon: 'bonus-zone-icon--tr',
  title: 'Planetary event',
  description: 'Dust storms recede when the 6th ocean is placed.',
  reward: {recipient: 'triggering-player', deltas: [{resource: 'tr', amount: 1}]},
  rewardLabel: '+1 TR',
  enabled: true,
  visible: true,
};

function marker(given: Record<string, unknown>) {
  const props: Record<string, unknown> = {top: 40, left: 120, ...given};
  return mount(ScaleEventMarker, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {ArcScaleMarkerChip: ChipStub}},
  });
}

function tooltipOf(w: ReturnType<typeof marker>): ScaleTooltipContent {
  return w.findComponent(ChipStub).props('tooltip');
}

describe('ScaleEventMarker — a planetary event on a scale', () => {
  it('an UPCOMING hazard: the chip in its box, aimed at the band, with the forward-looking tooltip', () => {
    const w = marker({marker: HAZARD, size: 25, point: 30, pointerDist: 14, pointerLen: 7});
    expect(w.classes(), 'the template starts with its root — the chip itself').to.include.members(['chip-stub', 'scale-event', 'scale-event--upcoming']);
    expect(w.attributes('role')).to.eq('img');
    expect(w.attributes('aria-label')).to.eq('Planetary event');
    const style = (w.element as HTMLElement).style;
    expect(style.margin).to.eq('40px 0px 0px 120px');
    expect(style.width).to.eq('25px');
    expect(style.height).to.eq('25px');

    const chip = w.findComponent(ChipStub);
    expect(chip.props()).to.deep.include({
      variant: 'hazard-event',
      surface: 'oceans',
      reached: false,
      state: 'available',
      claimColor: '',
      claimKey: '',
      point: 30,
      pointerDist: 14,
      pointerLen: 7,
      icon: 'ocean-event-icon--hazard',
    });
    expect(tooltipOf(w)).to.deep.eq({
      accent: 'oceans',
      kicker: translateText('Planetary event'),
      rows: [
        {text: translateText('Erosions appear on the surface when the 3rd ocean is placed.'), tone: 'desc'},
        {text: translateText('No reward to players.'), tone: 'note'},
      ],
    });
  });

  it('its defaults: the oceans\' tint, a 20px box, the standard connector', () => {
    const w = marker({marker: HAZARD});
    const style = (w.element as HTMLElement).style;
    expect(style.width).to.eq('20px');
    expect(style.height).to.eq('20px');
    expect(w.findComponent(ChipStub).props()).to.deep.include({surface: 'oceans', point: 0, pointerDist: 16, pointerLen: 9});
  });

  it('a hazard that FIRED is resolved — nobody was paid, and the chip follows the prop', async () => {
    const w = marker({marker: HAZARD});
    await w.setProps({reached: true});
    expect(w.classes()).to.include('scale-event--resolved');
    expect(w.classes()).to.not.include('scale-event--upcoming');
    expect(w.findComponent(ChipStub).props()).to.deep.include({reached: true, state: 'resolved', claimColor: ''});
    expect(tooltipOf(w).rows[1]).to.deep.eq({text: translateText('Event resolved — no reward to players.'), tone: 'note'});
  });

  it('a REWARDED event names its reward — and, once claimed, the player who took it, in their colour', async () => {
    const players = [{color: 'red', name: 'Alice'}, {color: 'blue', name: 'Bob'}];
    const w = marker({marker: REWARDED, surface: 'temperature', players});
    expect(w.classes()).to.include('scale-event--upcoming');
    expect(tooltipOf(w)).to.deep.eq({
      accent: 'temperature',
      kicker: translateText('Planetary event'),
      rows: [
        {text: translateText('Dust storms recede when the 6th ocean is placed.'), tone: 'desc'},
        {text: translateText('Reward to the player reaching the threshold:'), tone: 'desc'},
        {text: translateText('+1 TR'), tone: 'reward'},
      ],
    });

    await w.setProps({marker: {...REWARDED, fired: true, claimedByColor: 'red'}});
    expect(w.classes()).to.include('scale-event--claimed');
    expect(w.findComponent(ChipStub).props()).to.deep.include({
      variant: 'planetary-event',
      surface: 'temperature',
      state: 'claimed',
      claimColor: CLAIM_COLOR_HEX.red,
      claimKey: 'spec-scale-event-rewarded',
    });
    expect(tooltipOf(w).rows).to.deep.eq([
      {text: translateText('Dust storms recede when the 6th ocean is placed.'), tone: 'desc'},
      {text: translateTextWithParams('Reward claimed by ${0}:', ['Alice']), tone: 'desc'},
      {text: translateText('+1 TR'), tone: 'reward'},
    ]);
    expect(tooltipOf(w).rows[1].text, 'the claimer is named').to.include('Alice');
  });
});

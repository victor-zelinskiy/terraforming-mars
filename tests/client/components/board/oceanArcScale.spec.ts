/*
 * OceanArcScale — the OCEAN global parameter under the planet. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md). The band, the digits and the indicator are the shared ArcScale's subject; this
 * wrapper owns two things: WHAT it hands that band (the oceans' theme, the band's config, the count) and WHICH
 * planetary-event chips stand on it (none in a normal game, the dev markers on demand, the live Ares ones instead).
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import OceanArcScale from '@/client/components/board/OceanArcScale.vue';
import {ARC_SCALE_THEMES} from '@/client/components/board/arcScaleTheme';
import {LARGE_ARCS, OCEAN_ARC} from '@/client/components/board/arcScaleConfigs';
import {GlobalParameterThresholdMarker} from '@/client/components/board/oceanThresholdMarkers';

// The band and the chip have their own surfaces; this spec reads what the wrapper HANDS them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const BandStub = defineComponent({
  name: 'ArcScale',
  props: ['theme', 'config', 'value', 'identityMiddle'],
  render: () => h('i', {class: 'band-stub'}),
});
const ChipStub = defineComponent({
  name: 'ScaleEventMarker',
  props: ['marker', 'surface', 'top', 'left', 'size', 'point', 'pointerDist', 'pointerLen', 'reached', 'players'],
  render: () => h('i', {class: 'chip-stub'}),
});

function scale(props: Record<string, unknown> = {}, attrs: Record<string, unknown> = {}) {
  return mount(OceanArcScale, {
    ...globalConfig,
    props,
    attrs,
    global: {...globalConfig.global, stubs: {ArcScale: BandStub, ScaleEventMarker: ChipStub}},
  });
}

/** A live Ares ocean threshold, as `aresThresholdMarkers` builds one. */
function aresMarker(id: string, value: number): GlobalParameterThresholdMarker {
  return {
    id,
    parameter: 'oceans',
    value,
    kind: 'hazard-event',
    icon: 'ocean-event-icon--hazard',
    title: 'Planetary event',
    enabled: true,
    visible: true,
  };
}

describe('OceanArcScale — the ocean band and its planetary-event chips', () => {
  it('hands the shared band the oceans\' theme, the classic ring and the count — and no chip in a normal game', () => {
    const w = scale({value: 4}, {'data-from-host': 'yes'});
    expect((w.element as HTMLElement).tagName, 'the template starts with its root').to.eq('DIV');
    expect(w.classes()).to.deep.eq(['global-numbers-oceans']);
    expect(w.attributes('aria-hidden')).to.eq('true');
    expect(w.attributes('data-from-host'), 'what the host lets fall through lands on the root').to.eq('yes');

    const band = w.findComponent(BandStub);
    expect(band.props('theme')).to.eq(ARC_SCALE_THEMES.oceans);
    expect(band.props('config')).to.eq(OCEAN_ARC);
    expect(band.props('value')).to.eq(4);
    expect(band.props('identityMiddle')).to.eq(false);
    expect(w.findAllComponents(ChipStub), 'the dev markers are hidden').to.have.length(0);
  });

  it('follows its props: another band, the count, the chips\' side', async () => {
    const w = scale();
    const band = w.findComponent(BandStub);
    expect(band.props('value'), 'no count given').to.eq(0);

    await w.setProps({value: 7, config: LARGE_ARCS.oceans, eventsOutside: true});
    expect(band.props('value')).to.eq(7);
    // (Deep, not identical: a value handed over by `setProps` arrives as test-utils' reactive view of it.)
    expect(band.props('config')).to.deep.eq(LARGE_ARCS.oceans);
    expect(band.props('config')).to.not.deep.eq(OCEAN_ARC);
    expect(band.props('identityMiddle'), 'the badge stands inside when the chips stand outside').to.eq(true);
  });

  it('the dev planetary events stand on steps 3 and 6 — lit once the count has reached them', async () => {
    const players = [{color: 'red', name: 'Alice'}];
    const w = scale({value: 4, planetaryEvents: true, players});
    const chips = () => w.findAllComponents(ChipStub);
    expect(chips().map((chip) => chip.props('marker').value)).to.deep.eq([3, 6]);
    expect(chips().map((chip) => chip.props('reached'))).to.deep.eq([true, false]);
    for (const chip of chips()) {
      expect(chip.props('surface')).to.eq('oceans');
      expect(chip.props('size')).to.eq(25);
      expect(chip.props('players')).to.deep.eq(players);
      expect(Number.isInteger(chip.props('top')), 'a whole pixel').to.eq(true);
      expect(Number.isInteger(chip.props('left')), 'a whole pixel').to.eq(true);
      expect(chip.props('pointerLen')).to.be.a('number');
      expect(chip.props('pointerDist')).to.be.a('number');
      expect(chip.props('point')).to.be.a('number');
    }
    const inside = chips().map((chip) => chip.props('top'));

    await w.setProps({value: 6});
    expect(chips().map((chip) => chip.props('reached'))).to.deep.eq([true, true]);

    // Under the band instead of toward the planet: the same thresholds, lower on the screen.
    await w.setProps({eventsOutside: true});
    const outside = chips().map((chip) => chip.props('top'));
    expect(outside[0]).to.be.greaterThan(inside[0]);
    expect(outside[1]).to.be.greaterThan(inside[1]);
  });

  it('the LIVE Ares markers replace the dev ones', async () => {
    const live = [aresMarker('spec-ocean-arc-a', 2), aresMarker('spec-ocean-arc-b', 5), aresMarker('spec-ocean-arc-c', 8)];
    const w = scale({value: 5, planetaryEvents: true, aresMarkers: live});
    const chips = () => w.findAllComponents(ChipStub);
    expect(chips().map((chip) => chip.props('marker'))).to.deep.eq(live);
    expect(chips().map((chip) => chip.props('reached'))).to.deep.eq([true, true, false]);

    await w.setProps({aresMarkers: []});
    expect(chips().map((chip) => chip.props('marker').id), 'an empty live list falls back to the dev markers')
      .to.deep.eq(['oceans-erosions-3', 'oceans-dust-storms-6']);
  });
});

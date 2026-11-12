/*
 * BonusZone — a scale's REWARD bonus: a thin wrapper over the shared `ArcScaleMarkerChip`. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md). It draws nothing itself: what it owns is the TOOLTIP it builds
 * (the reward, then who took it) and the claim props it forwards to the chip — which is also its ROOT, so what the
 * board lets fall through (the position) lands on the chip.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {translateText} from '@/client/directives/i18n';
import BonusZone from '@/client/components/board/BonusZone.vue';

// The chip is the shared chassis — its own subject; this spec reads what the wrapper HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const ChipStub = defineComponent({
  name: 'ArcScaleMarkerChip',
  props: ['variant', 'surface', 'tier', 'state', 'rot', 'point', 'pointerDist', 'pointerLen', 'icon', 'claimColor', 'claimKey', 'tooltip'],
  render: () => h('i', {class: 'chip-stub'}),
});

function zone(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  return mount(BonusZone, {
    ...globalConfig,
    props: {icon: 'bonus-zone-icon--card', ...props},
    attrs,
    global: {...globalConfig.global, stubs: {ArcScaleMarkerChip: ChipStub}},
  });
}

describe('BonusZone — a scale\'s reward bonus over the shared chip', () => {
  it('hands the chip a standard bonus with its own defaults — and no tooltip while it names no reward', () => {
    const chip = zone({}).findComponent(ChipStub);
    expect(chip.props()).to.deep.eq({
      variant: 'standard-bonus',
      surface: 'venus',
      tier: 'regular',
      state: 'available',
      rot: 0,
      point: 0,
      pointerDist: 16,
      pointerLen: 9,
      icon: 'bonus-zone-icon--card',
      claimColor: '',
      claimKey: '',
      tooltip: null,
    });
  });

  it('forwards the geometry and the claim it was given, untouched', () => {
    const chip = zone({
      surface: 'oxygen', tier: 'final', state: 'claimed', rot: 12, point: -30, pointerDist: 21, pointerLen: 14,
      claimColor: 'red', claimedBy: 'Ada', claimKey: 'oxygen-8', reward: 'Raise temperature 1 step',
    }).findComponent(ChipStub);
    expect(chip.props('surface')).to.eq('oxygen');
    expect(chip.props('tier')).to.eq('final');
    expect(chip.props('state')).to.eq('claimed');
    expect(chip.props('rot')).to.eq(12);
    expect(chip.props('point')).to.eq(-30);
    expect(chip.props('pointerDist')).to.eq(21);
    expect(chip.props('pointerLen')).to.eq(14);
    expect(chip.props('claimColor')).to.eq('red');
    expect(chip.props('claimKey')).to.eq('oxygen-8');
  });

  it('builds the tooltip: the reward — then who took it, by the claim\'s state', async () => {
    const w = zone({reward: 'Draw a card', surface: 'temperature'});
    const tooltip = () => w.findComponent(ChipStub).props('tooltip');
    expect(tooltip(), 'available: the reward alone').to.deep.eq({
      accent: 'temperature',
      kicker: translateText('Bonus'),
      rows: [{text: translateText('Draw a card'), tone: 'reward'}],
    });

    await w.setProps({state: 'claimed', claimedBy: 'Ada', claimColor: 'blue'});
    expect(tooltip().rows, 'claimed: the owner by name, with the dot of their colour').to.deep.eq([
      {text: translateText('Draw a card'), tone: 'reward'},
      {text: `${translateText('Taken by')} Ada`, tone: 'claim', dot: 'blue'},
    ]);

    await w.setProps({state: 'government', claimedBy: '', claimColor: ''});
    expect(tooltip().rows, 'the world government took the step').to.deep.eq([
      {text: translateText('Draw a card'), tone: 'reward'},
      {text: translateText('Taken via world government'), tone: 'claim'},
    ]);

    await w.setProps({reward: ''});
    expect(tooltip(), 'no reward — no tooltip').to.eq(null);
  });

  it('the template STARTS WITH ITS ROOT — the position the board lets fall through lands on the chip', () => {
    const w = zone({}, {'class': 'from-board', 'style': 'left: 12px;', 'data-from-board': 'yes'});
    expect((w.element as HTMLElement).tagName).to.eq('I');
    expect(w.classes()).to.include.members(['chip-stub', 'from-board']);
    expect((w.element as HTMLElement).style.left).to.eq('12px');
    expect(w.attributes('data-from-board')).to.eq('yes');
  });
});

import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleResourcePanel from '@/client/components/console/ConsoleResourcePanel.vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {setPrivateScore} from '@/client/components/overview/privateScoreState';

/**
 * The console rail's score cap (.con-score): TR + VP above the resource rows.
 * TR always shows; the own VP masks behind the shared eye-off when the local
 * «Приватный счёт» display pref is on — with NO AnimatedMetricValue mounted,
 * so no delta chip / pulse can leak a hidden change.
 */
function playerWith(overrides: Record<string, unknown> = {}): PublicPlayerModel {
  return {
    color: 'red',
    megacredits: 10, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0,
    megacreditProduction: 1, steelProduction: 0, titaniumProduction: 0,
    plantProduction: 0, energyProduction: 0, heatProduction: 0,
    terraformRating: 21,
    victoryPointsBreakdown: {total: 34},
    tags: {},
    tableau: [],
    ...overrides,
  } as unknown as PublicPlayerModel;
}

function mountWith(player: PublicPlayerModel, epoch = 'run-1') {
  return mount(ConsoleResourcePanel, {
    global: globalConfig.global,
    props: {player, epoch},
  });
}

describe('ConsoleResourcePanel score header', () => {
  // Module state is bundle-shared across specs — never leave the mask on.
  afterEach(() => setPrivateScore(false));

  it('renders TR and VP with their score delta-chip hosts', () => {
    const w = mountWith(playerWith());
    expect(w.find('.con-score__value--tr').text()).to.eq('21');
    expect(w.find('.con-score__cell--vp .con-score__value').text()).to.eq('34');
    expect(w.find('.con-score [data-metric-key="score.tr"]').exists()).to.be.true;
    expect(w.find('.con-score [data-metric-key="score.vp"]').exists()).to.be.true;
    expect(w.find('.con-score .vp-private').exists()).to.be.false;
  });

  it('masks the own VP behind the eye-off when «Приватный счёт» is on', () => {
    setPrivateScore(true);
    const w = mountWith(playerWith());
    // The cell keeps its slot: emblem + mask, but NO number and NO chip host
    // (nothing can announce a change of the hidden value).
    expect(w.find('.con-score .vp-private').exists()).to.be.true;
    expect(w.find('.con-score__cell--vp .con-score__value').exists()).to.be.false;
    expect(w.find('.con-score [data-metric-key="score.vp"]').exists()).to.be.false;
    // TR is public — stays fully live.
    expect(w.find('.con-score__value--tr').text()).to.eq('21');
    expect(w.find('.con-score [data-metric-key="score.tr"]').exists()).to.be.true;
  });

  it('steps 3-character values down inside the reserved slot (--wide)', () => {
    const w = mountWith(playerWith({
      terraformRating: 105,
      victoryPointsBreakdown: {total: 128},
    }), 'run-wide');
    expect(w.find('.con-score__value--tr').classes()).to.include('con-score__value--wide');
    expect(w.find('.con-score__cell--vp .con-score__value').classes()).to.include('con-score__value--wide');
  });

  it('mounts no chip hosts when the epoch is empty (chips disabled)', () => {
    const w = mountWith(playerWith(), '');
    expect(w.find('.con-score .metric-feedback-host').exists()).to.be.false;
  });
});

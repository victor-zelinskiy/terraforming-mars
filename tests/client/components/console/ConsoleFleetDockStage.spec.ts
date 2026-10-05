import {expect} from 'chai';
import {mount, VueWrapper} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {FleetDockPreviewModel} from '@/common/models/ColonyTradePreviewModel';
import {SelectOptionModel} from '@/common/models/PlayerInputModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import ConsoleFleetDockStage from '@/client/components/console/ConsoleFleetDockStage.vue';
import {EffectForecastFact} from '@/common/models/EffectForecastModel';
import {armedFleetDockScene, fleetDockRewardKey, resetFleetDockScene} from '@/client/console/colonyTrade/fleetDockScene';
import {railRewardState, resetRailRewards} from '@/client/console/resourceTransfer/railReward';

/*
 * THE FLEET-DOCK STAGE, BY THE REWARD'S CATEGORY (docs/TURMOIL_REDUX_WATER_HAULING.md §8–§9).
 *
 * What this spec owns: the stage reads HOW THE TRADE ENDS off the server's
 * preview alone (the two sisters differ by data, never by a name in the
 * client), the «after confirming» line exists exactly when the reward raises
 * something — and its absence moves no block of the stage — and the plan the
 * scene will play is PINNED at the commit boundary. The scene's frames are the
 * e2e probes' (`console-water-hauling`, `console-unmi-liner`).
 */
const energyPath = {type: 'option', title: 'Pay 3 energy', buttonLabel: 'Pay', metadata: {icon: 'energy', resource: {current: 6, resulting: 3}}} as unknown as SelectOptionModel;
const player = {color: 'blue', megacredits: 0, energy: 6, steel: 0, titanium: 0, heat: 0, plants: 0, terraformRating: 20, tableau: []} as unknown as PublicPlayerModel;

const HAULING: FleetDockPreviewModel = {
  card: CardName.WATER_HAULING,
  available: true,
  effects: [
    {direction: 'gain', icon: 'oceans', amount: 1, current: 3, resulting: 4},
    {direction: 'gain', icon: 'tr', amount: 1, current: 20, resulting: 21},
  ],
  followUps: [{kind: 'note', role: 'tradeReward', note: 'placeOcean'}],
};
const LINER: FleetDockPreviewModel = {
  card: CardName.UNMI_LINER,
  available: true,
  effects: [{direction: 'gain', icon: 'tr', amount: 1, current: 20, resulting: 21}],
  followUps: [],
};
const GREENS: EffectForecastFact = {
  id: 'greens-tr', source: {kind: 'party', name: 'Greens', owner: 'blue', channel: 'tr-increase'},
  certainty: 'exact', recipient: {kind: 'you'}, timing: 'immediate',
  effects: [{direction: 'gain', icon: 'megacredits', amount: 2, current: 0, resulting: 2}],
  reason: 'The Greens pay 2 M€ per TR step you gain',
} as unknown as EffectForecastFact;

function mountStage(preview: FleetDockPreviewModel | undefined, card: CardName = preview?.card ?? CardName.UNMI_LINER): VueWrapper<any> {
  return mount(ConsoleFleetDockStage, {
    global: {
      ...globalConfig.global,
      stubs: {ConsoleCardFaceLite: {template: '<div class="pcard-stub"></div>'}},
    },
    props: {
      card,
      model: {name: card},
      available: true,
      options: [energyPath],
      preview,
      offerEffects: preview?.effects ?? [],
      thisPlayer: player,
      freeFleets: 2,
    },
  });
}

describe('ConsoleFleetDockStage — the reward\'s category decides how the trade ends', () => {
  let originalTranslations: unknown;

  beforeEach(() => {
    originalTranslations = (window as any)._translations;
    (window as any)._translations = {};
  });

  afterEach(() => {
    (window as any)._translations = originalTranslations;
    resetFleetDockScene();
    resetRailRewards();
  });

  it('the category is the SERVER\'s: a follow-up ahead is `placement`, a plain gain is `rail` — the client names no card', () => {
    expect(mountStage(HAULING).find('.con-fleetdock').attributes('data-fleet-dock-category')).eq('placement');
    expect(mountStage(LINER).find('.con-fleetdock').attributes('data-fleet-dock-category')).eq('rail');
    // The same card under the other sister's data plays the other sister's scene: nothing is keyed on the name.
    expect(mountStage({...LINER, card: CardName.WATER_HAULING}).find('.con-fleetdock').attributes('data-fleet-dock-category')).eq('rail');
  });

  it('no preview yet (it is on the wire): the honest default, never a guess from the marker\'s chips', () => {
    expect(mountStage(undefined, CardName.UNMI_LINER).find('.con-fleetdock').attributes('data-fleet-dock-category')).eq('placement');
  });

  it('the «after confirming» line stands exactly when the reward raises something — through the ONE table of its words', () => {
    const hauling = mountStage(HAULING);
    expect(hauling.findAll('[data-fleet-dock-note]').map((n) => n.text())).deep.eq(['After confirming: place an ocean tile']);
    expect(mountStage(LINER).findAll('[data-fleet-dock-note]')).has.lengthOf(0);
  });

  it('…and a stage with no line keeps every other block where it stood: the line is the result\'s LAST child', () => {
    const blocks = (w: VueWrapper<any>) => Array.from(w.find('[data-fleet-dock-result]').element.children).map((el) => el.className.split(' ')[0]);
    const withNote = blocks(mountStage(HAULING));
    const without = blocks(mountStage(LINER));
    expect(withNote[withNote.length - 1], 'nothing is laid out after the line').eq('con-fleetdock__note');
    expect(without, 'the same blocks, in the same order, minus the line').deep.eq(withNote.slice(0, -1));
  });

  it('the result reads the server\'s chips and the fleet leaving the supply', () => {
    const chips = mountStage(LINER).find('[data-fleet-dock-result]').text().replace(/\s+/g, ' ');
    expect(chips, 'the rating').to.match(/20\s*→\s*21/);
    expect(chips, 'the fleet').to.match(/2\s*→\s*1/);
  });

  it('the COMMIT BOUNDARY pins the plan and arms the scene; a refused submit voids both', async () => {
    const stage = mountStage(LINER);
    stage.vm.holdPresentation();
    expect(armedFleetDockScene(CardName.UNMI_LINER)?.plan.category).eq('rail');
    // The answer re-prices the preview under the scene (the TR is spent, the dock is busy): the pinned plan stands.
    await stage.setProps({preview: {...HAULING, card: CardName.UNMI_LINER}, available: false});
    expect(stage.find('.con-fleetdock').attributes('data-fleet-dock-category'), 'the plan as priced at the press').eq('rail');
    stage.vm.releasePresentation();
    await stage.vm.$nextTick();
    expect(armedFleetDockScene(CardName.UNMI_LINER)).is.undefined;
    expect(stage.find('.con-fleetdock').attributes('data-fleet-dock-category'), 'the live preview again').eq('placement');
  });

  it('what the TABLE answers is named on the result BEFORE the press — the composers\' own «⚡ сработает» group, for either sister', () => {
    const quiet = mountStage(LINER);
    expect(quiet.findAll('[data-fleet-dock-result] [data-forecast-vfx]'), 'nothing reacts: no group, no gap').has.lengthOf(0);
    for (const preview of [{...LINER, reactions: [GREENS]}, {...HAULING, reactions: [GREENS]}]) {
      const stage = mountStage(preview);
      const group = stage.find('[data-fleet-dock-result] [data-forecast-vfx]');
      expect(group.exists(), preview.card).is.true;
      expect(group.text().replace(/\s+/g, ' '), 'a bare delta — the row\'s language').to.match(/\+\s*2/);
      expect(group.element.parentElement?.className, 'on the chips\' own line').to.contain('con-fleetdock__chips');
    }
  });

  it('the answer is PINNED with the receipt: the response re-prices the preview under the scene', async () => {
    const stage = mountStage({...LINER, reactions: [GREENS]});
    stage.vm.holdPresentation();
    await stage.setProps({preview: {...LINER, available: false, reactions: []}});
    expect(stage.find('[data-fleet-dock-result] [data-forecast-vfx]').exists(), 'the receipt keeps naming what the press was promised').is.true;
  });

  it('the COMMIT BOUNDARY arms the trade\'s other moves on the rail: the fee of the chosen path and the flat bonuses', () => {
    const stage = mountStage({...LINER, reactions: [GREENS], flatBonuses: [{card: CardName.VENUS_TRADE_HUB, resource: 'megacredits', amount: 3}]});
    stage.vm.holdPresentation();
    const armed = armedFleetDockScene(CardName.UNMI_LINER);
    expect(armed?.plan.specs).deep.eq([{channel: 'stock', resource: 'rating', amount: 1}]);
    expect(armed?.plan.reactions).deep.eq([{channel: 'stock', resource: 'megacredits', amount: 2}]);
    expect(armed?.known, 'the energy path\'s 3 and Venus Trade Hub\'s +3').deep.eq({'stock:energy': -3, 'stock:megacredits': 3});
  });

  it('a rail reward of THIS dock that was not shown as promised is NAMED on the stage; another owner\'s is not', async () => {
    const stage = mountStage(LINER);
    expect(stage.find('.con-fleetdock').attributes('data-fleet-dock-degraded')).is.undefined;
    railRewardState.degraded = {key: 'somebody-else', why: 'no-source'};
    await stage.vm.$nextTick();
    expect(stage.find('.con-fleetdock').attributes('data-fleet-dock-degraded')).is.undefined;
    railRewardState.degraded = {key: fleetDockRewardKey(CardName.UNMI_LINER), why: 'no-origin'};
    await stage.vm.$nextTick();
    expect(stage.find('.con-fleetdock').attributes('data-fleet-dock-degraded')).eq('no-origin');
  });

  it('a stage that leaves before its answer came voids the plan it armed', () => {
    const stage = mountStage(LINER);
    stage.vm.holdPresentation();
    stage.unmount();
    expect(armedFleetDockScene(CardName.UNMI_LINER)).is.undefined;
  });
});

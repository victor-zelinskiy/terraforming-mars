import {expect} from 'chai';
import {mount, VueWrapper} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {FleetDockPreviewModel} from '@/common/models/ColonyTradePreviewModel';
import {SelectCardModel, SelectOptionModel} from '@/common/models/PlayerInputModel';
import {CardResource} from '@/common/CardResource';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import ConsoleFleetDockStage from '@/client/components/console/ConsoleFleetDockStage.vue';
import {EffectForecast, EffectForecastFact} from '@/common/models/EffectForecastModel';
import {effectForecastOpen, resetEffectForecastUi} from '@/client/console/consoleEffectForecast';
import {armedFleetDockScene, fleetDockRewardKey, resetFleetDockScene} from '@/client/console/colonyTrade/fleetDockScene';
import {railRewardState, resetRailRewards} from '@/client/console/resourceTransfer/railReward';
import {fleetDockUi} from '@/client/console/consoleColoniesModel';

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
/** The server's forecast object for a dock (`rewardReactionForecast`): facts, no discount, no payment value. */
const forecastOf = (facts: ReadonlyArray<EffectForecastFact>): EffectForecast =>
  ({facts, discounts: {base: 0, final: 0, items: [], other: 0}, paymentValues: [], coverage: 'complete'});

function mountStage(preview: FleetDockPreviewModel | undefined, card: CardName = preview?.card ?? CardName.UNMI_LINER): VueWrapper<any> {
  return mount(ConsoleFleetDockStage, {
    global: {
      ...globalConfig.global,
      stubs: {
        ConsoleCardFaceLite: {template: '<div class="pcard-stub"></div>'},
        // The layer's explorer is the composers' (its own specs); here only its PLACE is the subject.
        ConsoleEffectsExplorer: {template: '<div class="con-efx con-efx--forecast con-efx-stub"></div>', methods: {consumeEffectsBack: () => false, handleIntent: () => undefined}},
      },
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
    expect(chips, 'the fleet — and the unit is NAMED (PL-008)').to.match(/2\s*→\s*1\s*Trade fleet/);
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

  // PL-018: past the press the shell's bar reads «Выполняется…» off this ONE mirror (never the stage's verbs gone inert).
  it('the bar\'s mirror says ANSWERED from the commit boundary until a refusal gives the stage back, or the stage leaves', async () => {
    const stage = mountStage(LINER);
    expect(fleetDockUi.answered, 'before the press').eq(false);
    stage.vm.holdPresentation();
    expect(fleetDockUi.answered, 'the shell accepted the confirm').eq(true);
    expect(fleetDockUi.sub, 'no substep stands past the press').eq('');
    stage.vm.releasePresentation();
    expect(fleetDockUi.answered, 'a refused submit: the stage is live again').eq(false);
    stage.vm.holdPresentation();
    stage.unmount();
    expect(fleetDockUi.answered, 'the stage left: nothing claims the bar').eq(false);
  });

  it('what the TABLE answers is named on the result BEFORE the press — the composers\' own «⚡ сработает» group, for either sister', () => {
    const quiet = mountStage(LINER);
    expect(quiet.findAll('[data-fleet-dock-result] [data-forecast-vfx]'), 'nothing reacts: no group, no gap').has.lengthOf(0);
    for (const preview of [{...LINER, forecast: forecastOf([GREENS])}, {...HAULING, forecast: forecastOf([GREENS])}]) {
      const stage = mountStage(preview);
      const group = stage.find('[data-fleet-dock-result] [data-forecast-vfx]');
      expect(group.exists(), preview.card).is.true;
      expect(group.text().replace(/\s+/g, ' '), 'a bare delta — the row\'s language').to.match(/\+\s*2/);
      expect(group.element.parentElement?.className, 'the group is the layer\'s DOOR').to.contain('con-fleetdock__vfxrow');
      expect(group.element.parentElement?.parentElement?.className, 'on the chips\' own line').to.contain('con-fleetdock__chips');
    }
  });

  it('the answer is PINNED with the receipt: the response re-prices the preview under the scene', async () => {
    const stage = mountStage({...LINER, forecast: forecastOf([GREENS])});
    stage.vm.holdPresentation();
    await stage.setProps({preview: {...LINER, available: false, forecast: undefined}});
    expect(stage.find('[data-fleet-dock-result] [data-forecast-vfx]').exists(), 'the receipt keeps naming what the press was promised').is.true;
  });

  it('the COMMIT BOUNDARY arms the trade\'s other moves on the rail: the fee of the chosen path and the flat bonuses', () => {
    const stage = mountStage({...LINER, forecast: forecastOf([GREENS]), flatBonuses: [{card: CardName.VENUS_TRADE_HUB, resource: 'megacredits', amount: 3}]});
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

/*
 * A REWARD THAT LANDS ON A CARD (TR27 Aurora Station): the stage names the card
 * BEFORE the press — a statement with one holder, a decision with several — and
 * the decision is a press that rides the trade's ONE POST. Past the commit the
 * receiving card stands on the stage, or the hero's own counter is frozen.
 */
/**
 * PL-060 (2026-10-06): the «⚡ сработает» group on the dock's stage was a dead end — the composers open their R3
 * «Эффекты» layer from the same group, the stage offered no door. The layer is a LEVEL INSIDE the stage: the work
 * column parks (never unmounts), the explorer stands in the stage's own box, the mirror tells the bar, a sub-step /
 * the commit boundary / the unmount fold it.
 */
describe('ConsoleFleetDockStage — the R3 «Эффекты» layer is a level INSIDE the stage (PL-060)', () => {
  afterEach(() => {
    resetEffectForecastUi();
    resetFleetDockScene();
    resetRailRewards();
  });

  it('R3 is a verb of the stage exactly when the table answers something; a quiet dock has no door and publishes none', () => {
    const quiet = mountStage(LINER);
    expect(fleetDockUi.forecastAvailable, 'nothing reacts — no R3').is.false;
    expect(quiet.find('[data-forecast-row]').exists(), 'no group, no door').is.false;
    quiet.unmount();
    const stage = mountStage({...LINER, forecast: forecastOf([GREENS])});
    expect(fleetDockUi.forecastAvailable, 'the Greens answer — R3 is published').is.true;
    expect(stage.find('[data-forecast-row] [data-forecast-vfx]').exists(), 'the «сработает» group is the door').is.true;
    expect(stage.find('[data-forecast-layer]').exists(), 'closed until the press').is.false;
  });

  it('R3 opens the layer INSIDE the stage — the work column PARKS (never unmounts), the mirror says OPEN; B folds it back', async () => {
    const stage = mountStage({...LINER, forecast: forecastOf([GREENS])});
    stage.vm.handleIntent({kind: 'press', button: 'stickR'});
    await stage.vm.$nextTick();
    expect(effectForecastOpen('dock'), 'the ONE fact everybody reads').is.true;
    expect(fleetDockUi.forecastOpen, 'the bar reads the explorer\'s commands off this').is.true;
    expect(stage.find('[data-forecast-host] [data-forecast-layer] [data-forecast-surface] .con-efx--forecast').exists(), 'the explorer in forecast mode, in the stage\'s box').is.true;
    expect(stage.find('[data-forecast-browse] [data-fleet-dock-result]').exists(), 'the rows are parked under it, not gone').is.true;
    stage.vm.handleIntent({kind: 'press', button: 'back'});
    await stage.vm.$nextTick();
    expect(effectForecastOpen('dock'), 'B folds the layer, never the stage').is.false;
    expect(stage.find('[data-forecast-layer]').exists()).is.false;
    expect(stage.emitted('cancel'), 'the stage did not take the B for itself').to.be.undefined;
    expect(fleetDockUi.forecastAvailable, 'R3 is offered again').is.true;
  });

  it('R3 while open CLOSES it; no door opens twice', async () => {
    const stage = mountStage({...LINER, forecast: forecastOf([GREENS])});
    stage.vm.handleIntent({kind: 'press', button: 'stickR'});
    await stage.vm.$nextTick();
    stage.vm.handleIntent({kind: 'press', button: 'stickR'});
    await stage.vm.$nextTick();
    expect(effectForecastOpen('dock')).is.false;
  });

  it('the COMMIT BOUNDARY folds the layer instantly and takes R3 away — past the press the bar is a status', async () => {
    const stage = mountStage({...LINER, forecast: forecastOf([GREENS])});
    stage.vm.handleIntent({kind: 'press', button: 'stickR'});
    await stage.vm.$nextTick();
    stage.vm.holdPresentation();
    await stage.vm.$nextTick();
    expect(effectForecastOpen('dock')).is.false;
    expect(fleetDockUi.forecastAvailable).is.false;
    expect(fleetDockUi.forecastOpen).is.false;
  });

  it('the layer dies with the stage', async () => {
    const stage = mountStage({...LINER, forecast: forecastOf([GREENS])});
    stage.vm.handleIntent({kind: 'press', button: 'stickR'});
    await stage.vm.$nextTick();
    stage.unmount();
    expect(effectForecastOpen('dock')).is.false;
    expect(fleetDockUi.forecastOpen).is.false;
  });
});

describe('ConsoleFleetDockStage — a reward that lands on a card (TR27)', () => {
  const AURORA = CardName.AURORA_STATION;
  const HABS = CardName.FLOATING_HABS;
  const effects = [
    {direction: 'gain' as const, icon: 'floater', amount: 2, note: 'to a card'},
    {direction: 'gain' as const, icon: 'megacredits', amount: 1, current: 0, resulting: 1, note: 'production'},
  ];
  const vpSteps = {[AURORA]: [{from: 0, to: 0}, {from: 0, to: 1}], [HABS]: [{from: 0, to: 1}, {from: 0, to: 1}]};
  const ONE: FleetDockPreviewModel = {
    card: AURORA, available: true, effects,
    followUps: [{kind: 'cardTarget', role: 'tradeReward', resource: CardResource.FLOATER, amount: 2, auto: AURORA, vpSteps, lost: false}],
  };
  const TWO: FleetDockPreviewModel = {
    card: AURORA, available: true, effects,
    followUps: [{
      kind: 'cardTarget', role: 'tradeReward', resource: CardResource.FLOATER, amount: 2, vpSteps, lost: false,
      pick: {type: 'card', title: 'Select a Venus card', buttonLabel: 'Add', cards: [{name: AURORA, resources: 0}, {name: HABS, resources: 1}]} as unknown as SelectCardModel,
    }],
  };
  const blue = {...player, tableau: [{name: AURORA, resources: 0}, {name: HABS, resources: 1}]} as unknown as PublicPlayerModel;

  function mountAurora(preview: FleetDockPreviewModel): VueWrapper<any> {
    return mount(ConsoleFleetDockStage, {
      global: {...globalConfig.global, stubs: {
        ConsoleCardFaceLite: {props: ['name', 'card'], template: '<div class="pcard-stub" :data-name="name" :data-res="card && card.resources"></div>'},
        ConsoleTradeTargetStep: {props: ['model', 'lockedCard'], template: '<div class="tts-stub"></div>', methods: {nav() {}, confirm() {}, inspect() {}, cycleOwner() {}, close(done: () => void) {
          done();
        }}},
      }},
      props: {
        card: AURORA, model: {name: AURORA, resources: 0}, available: true, options: [energyPath], preview,
        offerEffects: effects, thisPlayer: blue, freeFleets: 1, players: [blue], viewerColor: 'blue',
      },
    });
  }

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

  it('ONE holder: the row NAMES it with its «0 → 2» and is no cursor stop; the trade commits with nothing to ask', () => {
    const stage = mountAurora(ONE);
    expect(stage.find('.con-fleetdock').attributes('data-fleet-dock-category')).eq('card');
    const row = stage.find('[data-fleet-dock-target]');
    expect(row.attributes('data-fleet-dock-target-card')).eq(AURORA);
    expect(row.text()).to.contain('0 → 2');
    expect(stage.vm.focusables.map((f: {zone: string}) => f.zone), 'a statement, never a stop').deep.eq(['pay']);
    expect(stage.vm.canConfirm).is.true;
    // The chip names where the floaters land, and the point they bring the station on its second floater.
    const result = stage.find('[data-fleet-dock-result]').text().replace(/\s+/g, ' ');
    expect(result).to.match(/0\s*→\s*2/);
    expect(stage.find('[data-fleet-dock-target]').text(), 'the card is named once — by the «КУДА» row').to.contain(AURORA);
    expect(result, 'the station\'s points, 0 → 1').to.match(/VP\s*0\s*→\s*1/);
    stage.vm.emitConfirm();
    const payload = stage.emitted('confirm')![0][0] as {captures: Record<number, unknown>, asksCard: boolean};
    expect(payload.asksCard).is.true;
    expect(Object.values(payload.captures), 'nothing to answer').deep.eq([]);
  });

  it('TWO holders: a decision — nothing pre-chosen, the trade REFUSES until a card is named; the chip says «Choose a card»', () => {
    const stage = mountAurora(TWO);
    const row = stage.find('[data-fleet-dock-target]');
    expect(row.classes()).to.include('con-colfocus__steprow--missing');
    expect(row.attributes('data-fleet-dock-target-card')).eq('');
    expect(stage.vm.focusables.map((f: {zone: string}) => f.zone)).deep.eq(['pay', 'target']);
    expect(stage.vm.canConfirm, 'a choice is a press').is.false;
    expect(stage.find('[data-fleet-dock-result]').text()).to.contain('Choose a card');
  });

  it('…A on the row descends into the step; the answer is captured, the chip re-aims, and it rides the ONE POST', async () => {
    const stage = mountAurora(TWO);
    stage.vm.focusIdx = 1;
    stage.vm.onPrimary();
    await stage.vm.$nextTick();
    expect(stage.vm.sub).eq('targets');
    expect(stage.find('.tts-stub').exists()).is.true;
    stage.vm.targetPicked(HABS);
    await stage.vm.$nextTick();
    expect(stage.vm.sub).is.undefined;
    expect(stage.vm.canConfirm).is.true;
    const result = stage.find('[data-fleet-dock-result]').text().replace(/\s+/g, ' ');
    expect(result, 'Habs 1 → 3').to.match(/1\s*→\s*3/);
    expect(result, 'and its point').to.match(/VP\s*0\s*→\s*1/);
    stage.vm.focusIdx = 0;
    stage.vm.emitConfirm();
    const payload = stage.emitted('confirm')![0][0] as {steps: Array<{kind: string}>, captures: Record<number, unknown>};
    const at = payload.steps.findIndex((s) => s.kind === 'cardTarget');
    expect(payload.captures[at], 'the target is the batch\'s tail').eq(HABS);
  });

  it('past the commit: a card that is not the dock STANDS on the stage, frozen at its press-time count', async () => {
    const stage = mountAurora(TWO);
    stage.vm.targetPicked(HABS);
    stage.vm.holdPresentation();
    await stage.vm.$nextTick();
    expect(armedFleetDockScene(AURORA)?.plan.target).eq(HABS);
    const receiving = stage.find('[data-fleet-dock-receiving]');
    expect(receiving.exists()).is.true;
    expect(receiving.find(`[data-name="${HABS}"]`).attributes('data-res'), 'the «было» of the press').eq('1');
    expect(stage.find('.con-fleetdock').classes()).to.include('con-fleetdock--carding');
  });

  it('past the commit: the dock receiving on its OWN face keeps the hero\'s counter frozen until the tokens land', async () => {
    const stage = mountAurora(ONE);
    stage.vm.holdPresentation();
    // The answer applies: the live model already holds the two floaters.
    await stage.setProps({model: {name: AURORA, resources: 2}});
    expect(stage.find('[data-fleet-dock-receiving]').exists(), 'no second copy of the dock').is.false;
    expect(stage.find('[data-fleet-dock-hero] .pcard-stub').attributes('data-res'), 'the hero still reads 0').eq('0');
    expect(stage.find('[data-fleet-dock-hero]').attributes('data-played-key'), 'the destination ladder\'s anchor').eq(AURORA);
  });
});

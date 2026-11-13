/*
 * ConsoleParliamentBannerMode — «ЗНАМЯ» (Turmoil Redux Septem Tribus:redux): the reading of the party plaque under the
 * cursor, the pad's verbs over the ring, the commit and its answer on the same stage. A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md), so a parent's template ref of it is ONLY what it `defineExpose`s — and
 * `ConsoleParliamentSection` reaches it exactly so: `answerAfterSubmit()` and `handleIntent()` by name, `closeFinished()`
 * through the computed key of its `foldFinishedStage`. This spec is what it renders for the server's rows, what it
 * emits, and that contract.
 */
import {expect} from 'chai';
import {flushPromises, mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, shallowRef} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t, translateText} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {BannerPromptMeta, SelectPartyModel} from '@/common/models/PlayerInputModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {activeAnimationHoldLabels, expireAnimationHoldNow} from '@/client/components/presentation/animationHold';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {PROBE_TICK_FALLBACK_MS} from '@/client/console/probeTick';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {armBannerPickFlow, parliamentFlow, resetParliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {freezeParliamentFit, parliamentFitFrozen} from '@/client/console/parliament/parliamentCardFit';
import {resetBannerCubeScene} from '@/client/console/parliament/bannerCubeScene';
import {BANNER_CUBE_FAQ_KEY} from '@/client/console/parliament/bannerPickModel';
import {emptyParliamentView, ParliamentPartyVm, ParliamentPromptBridge, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import ConsoleParliamentBannerMode from '@/client/components/console/parliament/ConsoleParliamentBannerMode.vue';

// The cube, the formula renderer and the pad's badge are their own specs' subjects; this one reads what the mode HANDS
// them. (Render functions, not template strings: the runtime compiler is not in this build.)
const CubeStub = defineComponent({name: 'PlayerCube', props: {color: String, size: Number, glow: Boolean, shadow: Boolean}, render: () => h('i', {class: 'cube-stub'})});
const FormulaStub = defineComponent({name: 'ConsolePartyFormula', props: {party: String, renderRoot: Object, size: String}, render: () => h('i', {class: 'formula-stub'})});
const GlyphStub = defineComponent({name: 'GamepadGlyph', props: {control: String}, render: () => h('i', {class: 'glyph-stub'})});

const global = {...globalConfig.global, stubs: {PlayerCube: CubeStub, ConsolePartyFormula: FormulaStub, GamepadGlyph: GlyphStub}};

const BLUE: Color = 'blue';
const TAKEN = 'Your cube already stands on this banner';
/** The blocking hold the outcome plays under (the registry prints a hold as `label[scope]`). */
const HOLD = 'parliament-banner-cube';
const holding = (): boolean => activeAnimationHoldLabels().some((label) => label.startsWith(HOLD));

/** The server's rows: Mars First on offer, the Scientists refused (the cube stands there), the ruling Greens on offer. */
const META: BannerPromptMeta = {
  source: 'first-action',
  parties: [
    {party: PartyName.MARS, available: true, hasCube: false, hasEffect: false},
    {party: PartyName.SCIENTISTS, available: false, hasCube: true, hasEffect: true, reason: TAKEN},
    {party: PartyName.GREENS, available: true, hasCube: false, hasEffect: true},
  ],
};

/** The hall: two benches of the opposition and the ruler on the dais — the mode reads the parties' ORDER and nothing else of them. */
const VIEW: ParliamentViewVm = {
  ...emptyParliamentView(),
  rulingParty: PartyName.GREENS,
  parties: [{party: PartyName.MARS}, {party: PartyName.SCIENTISTS}, {party: PartyName.GREENS}] as unknown as ReadonlyArray<ParliamentPartyVm>,
};

function bridge(card?: CardName): ParliamentPromptBridge {
  return {
    vote: undefined, actions: {}, resolutionAction: undefined, seat: undefined, grant: undefined, supportPick: undefined, delegatePick: undefined,
    bannerPick: {model: {type: 'party', parties: [PartyName.MARS, PartyName.GREENS]} as unknown as SelectPartyModel, meta: META, ...(card === undefined ? {} : {card})},
  };
}

/** The table as the answer left it: the viewer's cube on `party`'s banner (a card grant drawn as a cube), or on none. */
function table(cubeOn?: PartyName): PlayerViewModel {
  const access = cubeOn === undefined ? [] : [{party: cubeOn, granted: [CardName.SEPTEM_TRIBUS_REDUX]}];
  return {game: {parliament: {players: [{color: BLUE, access}]}}} as unknown as PlayerViewModel;
}

function modeProps(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {view: VIEW, playerView: table(), viewerColor: BLUE, bridge: bridge(), ...over};
}

function mode(over: Record<string, unknown> = {}) {
  return mount(ConsoleParliamentBannerMode as any, {...globalConfig, props: modeProps(over), global});
}

type ModeRef = {answerAfterSubmit(): void, handleIntent(intent: GamepadIntent): void, closeFinished(): void};

/** The mode under a PARENT that holds a ref to it and hears its events — what that ref carries is what the section's `$refs.bannerMode` does. */
function underParent(over: Record<string, unknown> = {}) {
  const held = shallowRef<ModeRef | null>(null);
  const heard: Array<[string, unknown]> = [];
  const Parent = defineComponent({
    name: 'BannerModeParent',
    setup: () => () => h('div', {'data-parent': ''}, [h(ConsoleParliamentBannerMode as never, {
      ...modeProps(over),
      ref: held,
      onNotice: (text: string) => heard.push(['notice', text]),
      onInspect: (request: unknown) => heard.push(['inspect', request]),
      onInspectSource: (card: CardName) => heard.push(['inspect-source', card]),
      onSend: (payload: unknown) => heard.push(['send', payload]),
      onFlowComplete: (stage: string) => heard.push(['flow-complete', stage]),
    })]),
  });
  return {wrapper: mount(Parent, {...globalConfig, global}), held, heard};
}

/** Run `work` with the console's warnings collected instead of printed (the ceiling's recovery names itself there). */
function collectingWarnings(work: () => void): Array<string> {
  const warnings: Array<string> = [];
  const native = console.warn;
  console.warn = (...args: Array<unknown>) => {
    warnings.push(args.map(String).join(' '));
  };
  try {
    work();
  } finally {
    console.warn = native;
  }
  return warnings;
}

describe('ConsoleParliamentBannerMode — the banner under the cursor, its verbs, and what a parent reaches through its ref', () => {
  let clock: ManualFlowClock;

  // The flow, the holds, the fit's freeze and the cube scene are module state the whole bundle shares: every test
  // starts from, and leaves, the clean one. The probe's tick is a wait of the flow kernel — the spec drives its clock.
  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    resetParliamentFlow();
    resetParliamentHolds();
    resetBannerCubeScene();
    freezeParliamentFit(false);
    armBannerPickFlow({zone: 'parties', partyIndex: 0}, 'Banner', META);
  });
  afterEach(async () => {
    clock.advance(PROBE_TICK_FALLBACK_MS + 1);
    await flushPromises();
    setFlowClock(undefined);
    resetParliamentFlow();
    resetParliamentHolds();
    resetBannerCubeScene();
    freezeParliamentFit(false);
  });

  it('reads the plaque under the cursor: the party, the ghost of the cube in its socket, what the cube opens, the clauses, the FAQ — and follows the cursor', async () => {
    const w = mode();
    expect(w.classes()).to.deep.eq(['con-parl__support', 'con-parl__banner', 'con-parl__support--live']);
    expect(w.attributes('data-parl-banner-mode')).to.not.eq(undefined);
    expect(w.attributes('data-banner-beat')).to.eq(undefined);
    expect(w.attributes('style')).to.contain('--parl-accent');
    expect(w.attributes('style')).to.contain(partyAccent(PartyName.MARS));

    const reading = () => w.find('[data-parl-banner-reading]');
    expect(reading().attributes('data-banner-party')).to.eq(PartyName.MARS);
    expect(reading().attributes('data-banner-available')).to.eq('');
    expect(reading().find('.con-parl__support-emblem').attributes('src')).to.eq(partyEmblemUrl(PartyName.MARS));
    expect(reading().find('.con-parl__support-name').text()).to.eq($t(partyNameKey(PartyName.MARS)));
    const socket = w.find('[data-parl-banner-socket]');
    expect(socket.classes()).to.include('con-parl__banner-socket--ghost');
    expect(socket.classes()).to.not.include('con-parl__banner-socket--seated');
    expect(w.findComponent(CubeStub).props('color')).to.eq(BLUE);
    expect(w.find('[data-parl-banner-consequence]').text()).to.eq($t('You gain this party\'s effect'));
    expect(w.find('[data-parl-banner-reason]').exists()).to.eq(false);
    expect(w.find('[data-parl-banner-faq]').text()).to.eq($t(BANNER_CUBE_FAQ_KEY));

    // The party's clauses as the Charter prints them — each under its label, its graphic handed to the ONE renderer.
    const clauses = w.findAll('[data-banner-clause]');
    expect(clauses.length).to.be.greaterThan(0);
    expect(w.find('.con-parl__banner-clauses').attributes('data-banner-clauses')).to.eq(String(clauses.length));
    for (const clause of clauses) {
      const kind = clause.attributes('data-banner-clause');
      expect(['effect', 'action']).to.include(kind);
      expect(clause.find('.con-parl__banner-clause-label').text()).to.eq($t(kind === 'action' ? 'Action' : 'Effect'));
    }
    const formulas = w.findAllComponents(FormulaStub);
    expect(formulas.length).to.eq(w.findAll('[data-banner-clause-graphic]').length);
    expect(formulas.every((f) => f.props('party') === PartyName.MARS && f.props('size') === 'wide' && f.props('renderRoot') !== undefined)).to.eq(true);

    // «Поставить куб» while the pick is open and the banner is on offer.
    const cta = w.find('[data-parl-banner-cta]');
    expect(cta.classes()).to.include('con-parl__cta--ready');
    expect(w.findComponent(GlyphStub).props('control')).to.eq('confirm');
    expect(cta.find('.con-parl__cta-label').text()).to.eq(translateText('Place cube'));

    // The cursor walks to a REFUSED banner: its one reason instead of the consequence, the confirm blocked and saying why.
    parliamentFlow.partyIndex = 1;
    await nextTick();
    expect(reading().attributes('data-banner-party')).to.eq(PartyName.SCIENTISTS);
    expect(reading().attributes('data-banner-available')).to.eq(undefined);
    expect(w.find('[data-parl-banner-consequence]').exists()).to.eq(false);
    expect(w.find('[data-parl-banner-reason]').text()).to.eq($t(TAKEN));
    expect(cta.classes()).to.include('con-parl__cta--blocked');
    expect(cta.classes()).to.not.include('con-parl__cta--ready');
    expect(cta.find('.glyph-stub').exists()).to.eq(false);
    expect(cta.find('.con-parl__cta-label').text()).to.eq(translateText(TAKEN));

    // …and onto the dais: the ruler's banner — an effect the viewer already holds by another road.
    parliamentFlow.zone = 'ruler';
    await nextTick();
    expect(reading().attributes('data-banner-party')).to.eq(PartyName.GREENS);
    expect(w.find('[data-parl-banner-consequence]').text()).to.eq($t('Its effect is already yours — the cube keeps it for good'));
    expect(w.attributes('style')).to.contain(partyAccent(PartyName.GREENS));
  });

  it('the confirm: a refused banner names its reason and sends nothing; a banner on offer sends the party answer, latches the pick and freezes the fit', async () => {
    parliamentFlow.partyIndex = 1;
    const w = mode();
    const cta = w.find('[data-parl-banner-cta]');
    await cta.trigger('click');
    expect(w.emitted('notice')).to.deep.eq([[translateText(TAKEN)]]);
    expect(w.emitted('send')).to.eq(undefined);
    expect(parliamentFlow.bannerSnapshot).to.eq(undefined);
    expect(parliamentFitFrozen()).to.eq(false);

    parliamentFlow.partyIndex = 0;
    await nextTick();
    await cta.trigger('click');
    expect(w.emitted('send')).to.deep.eq([[{response: {type: 'party', partyName: PartyName.MARS}, from: 'banner'}]]);
    expect(w.emitted('notice')?.length).to.eq(1);
    expect(parliamentFlow.bannerSnapshot).to.deep.eq({party: PartyName.MARS});
    expect(parliamentFlow.bannerMeta).to.deep.eq(META);
    expect(parliamentFitFrozen()).to.eq(true);

    // A press that is already in is not a second press.
    parliamentFlow.bannerCommitted = true;
    await nextTick();
    await cta.trigger('click');
    expect(w.emitted('send')?.length).to.eq(1);
    expect(cta.classes()).to.include('con-parl__cta--busy');
    expect(cta.find('.con-parl__cta-label').text()).to.eq(translateText('Performing…'));
  });

  it('a PARENT\'s ref sees `answerAfterSubmit` · `handleIntent` · `closeFinished` and nothing else — the pad\'s verbs go through it', () => {
    const {held, heard} = underParent({bridge: bridge(CardName.SEPTEM_TRIBUS_REDUX)});
    expect(held.value, 'the parent\'s ref is set').to.not.eq(null);
    expect(Object.keys(held.value!), 'exactly what the mode exposes').to.deep.eq(['answerAfterSubmit', 'handleIntent', 'closeFinished']);
    const leaked = ['view', 'bridge', 'submit', 'moveTo', 'stopOutcome', 'finish', 'reading', 'landed', 'latchedCard']
      .filter((key) => (held.value as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);
    const pad = held.value!.handleIntent;

    // The d-pad walks the plaques as the hall lays them out: ▼ down the opposition's column, ▶ onto the dais, ◀ back
    // to the bench the cursor left.
    pad({kind: 'nav', dir: 'down', repeat: false});
    expect([parliamentFlow.zone, parliamentFlow.partyIndex]).to.deep.eq(['parties', 1]);
    pad({kind: 'nav', dir: 'right', repeat: false});
    expect(parliamentFlow.zone).to.eq('ruler');
    pad({kind: 'nav', dir: 'left', repeat: false});
    expect([parliamentFlow.zone, parliamentFlow.partyIndex]).to.deep.eq(['parties', 1]);

    // L3 — the corporation that gives the cube; X — the plaque under the cursor; A — the commit (refused here, by name).
    pad({kind: 'press', button: 'stickL'});
    pad({kind: 'press', button: 'secondary'});
    pad({kind: 'press', button: 'confirm'});
    expect(heard.map(([name]) => name)).to.deep.eq(['inspect-source', 'inspect', 'notice']);
    expect(heard[0][1]).to.eq(CardName.SEPTEM_TRIBUS_REDUX);
    expect(heard[1][1]).to.deep.include({kind: 'party', party: PartyName.SCIENTISTS});
    expect(heard[2][1]).to.eq(translateText(TAKEN));

    // A on a banner on offer sends; the answer that placed NOTHING stands the mode again in place, the cursor kept.
    pad({kind: 'nav', dir: 'up', repeat: false});
    pad({kind: 'press', button: 'confirm'});
    expect(heard[3]).to.deep.eq(['send', {response: {type: 'party', partyName: PartyName.MARS}, from: 'banner'}]);
    parliamentFlow.stage = 'submitting';
    parliamentFlow.bannerCommitted = true;
    pad({kind: 'nav', dir: 'down', repeat: false});
    expect(parliamentFlow.partyIndex, 'a committed mode takes no verb').to.eq(0);
    held.value!.answerAfterSubmit();
    expect(parliamentFlow.stage).to.eq('banner');
    expect(parliamentFlow.bannerCommitted).to.eq(false);
    expect(parliamentFlow.bannerSnapshot).to.eq(undefined);
    expect(parliamentFitFrozen(), 'the fit is thawed with the refusal').to.eq(false);
    expect(parliamentFlow.partyIndex).to.eq(0);
    expect(heard.some(([name]) => name === 'flow-complete')).to.eq(false);
  });

  it('the answer that LANDED the cube plays on this stage and ends by the mode\'s own hand; `closeFinished` folds only a finished mode', async () => {
    const {wrapper, held, heard} = underParent({playerView: table(PartyName.MARS)});
    const root = () => wrapper.find('[data-parl-banner-mode]');
    const cta = () => wrapper.find('[data-parl-banner-cta]');
    held.value!.handleIntent({kind: 'press', button: 'confirm'});
    expect(heard.map(([name]) => name)).to.deep.eq(['send']);

    held.value!.answerAfterSubmit();
    expect(parliamentFlow.bannerCommitted).to.eq(true);
    expect(parliamentFlow.bannerBeat).to.eq('flight');
    expect(holding()).to.eq(true);
    await nextTick();
    expect(root().classes()).to.include('con-parl__support--committed');
    expect(root().attributes('data-banner-beat')).to.eq('flight');
    expect(cta().classes()).to.include('con-parl__cta--busy');
    expect(cta().find('.con-parl__cta-label').text()).to.eq(translateText('Performing…'));

    // Nothing was held for a flight (the cube already stands): the probe's tick reads it and the mode goes on to its read.
    await flushPromises();
    clock.advance(PROBE_TICK_FALLBACK_MS + 1);
    await flushPromises();
    expect(parliamentFlow.bannerBeat).to.eq('read');
    expect(cta().find('.con-parl__cta-label').text()).to.eq(translateText('Cube placed'));

    // A mode still at work is never closed by the question door.
    held.value!.closeFinished();
    expect(parliamentFitFrozen()).to.eq(true);
    expect(holding()).to.eq(true);

    // THE CEILING ENDS THE PHRASE: the hold's recovery is the mode's own — the beat cut, the flow ended, the hold let go.
    const warnings = collectingWarnings(() => {
      expect(expireAnimationHoldNow(HOLD)).to.eq(true);
    });
    expect(warnings.some((line) => line.includes('banner cube: outlived its ceiling'))).to.eq(true);
    expect(parliamentFlow.bannerBeat).to.eq('done');
    expect(heard.filter(([name]) => name === 'flow-complete')).to.deep.eq([['flow-complete', 'banner']]);
    expect(holding()).to.eq(false);
    await nextTick();
    expect(cta().classes()).to.include('con-parl__cta--done');

    // …and now the door folds it: the fit thawed, the latch let go. A second end is not a second event.
    held.value!.closeFinished();
    expect(parliamentFitFrozen()).to.eq(false);
    wrapper.unmount();
    expect(held.value, 'the parent\'s ref is cleared').to.eq(null);
    expect(heard.filter(([name]) => name === 'flow-complete').length).to.eq(1);
  });
});

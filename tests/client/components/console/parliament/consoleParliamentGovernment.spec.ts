/*
 * ConsoleParliamentGovernment — the GOVERNMENT'S DAIS of the chamber plate: the ruler's slot (the ruling party's
 * medallion is teleported INTO it by the parties tier) and the enacted law as ONE card instance, carried onto the
 * sitting's stage while it pays. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): it emits and
 * exposes nothing — its contract is what it renders for its view, its props and the sitting's display holds, and the
 * ruling column it observes for the card fit.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {allResolutions} from '@/client/parliament/ClientParliamentManifest';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {partyAccent} from '@/client/components/premiumCard/partyEmblems';
import {partyTileKey} from '@/client/console/parliament/partyActionKey';
import {parliamentArtTier} from '@/client/console/parliament/parliamentArtTier';
import {agendaViewOf, emptyParliamentView, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import {parliamentFlow, resetParliamentFlow} from '@/client/console/parliament/consoleParliamentFlow';
import {parliamentHolds, resetParliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {careerGrantState} from '@/client/console/parliament/careerGrantBeat';
import ConsoleParliamentGovernment from '@/client/components/console/parliament/ConsoleParliamentGovernment.vue';

// The teleport and the premium face are their own specs' subjects; this one reads what the dais HANDS them. The face
// is one of the three async-on-purpose bindings — a stub of it answers to `VaporAsyncComponentWrapper` (RECIPES § 3).
// (Render functions, not template strings: the runtime compiler is not in this build.)
const TeleportStub = defineComponent({
  name: 'ConsoleTeleport',
  props: {to: {type: String, required: true}, disabled: {type: Boolean, default: false}, defer: {type: Boolean, default: false}},
  setup: (_props, {slots}) => () => h('div', {class: 'teleport-stub'}, slots.default?.()),
});
const FaceStub = defineComponent({
  name: 'VaporAsyncComponentWrapper',
  props: {
    vmOverride: {type: Object as PropType<PremiumCardVM>, default: undefined},
    lightweight: {type: Boolean, default: false},
    artTier: {type: String, default: undefined},
    inert: {type: Boolean, default: false},
  },
  render: () => h('i', {class: 'face-stub'}),
});

const RED: Color = 'red';

/** Two real laws of the catalogue (the face is built from the manifest): the one in power, and the one before it. */
const [LAW, OLD_LAW] = allResolutions();

function enacted(law: typeof LAW, instance: string): NonNullable<ParliamentViewVm['enacted']> {
  return {instance, resolutionId: law.id, resolution: law, party: law.party};
}

function view(over: Partial<ParliamentViewVm> = {}): ParliamentViewVm {
  return {...emptyParliamentView(), rulingParty: PartyName.SCIENTISTS, ...over};
}

function dais(props: Record<string, unknown> = {}) {
  const v = (props.view as ParliamentViewVm | undefined) ?? view();
  return mount(ConsoleParliamentGovernment as any, {
    ...globalConfig,
    props: {view: v, players: [], viewerColor: RED, agendaVm: agendaViewOf(v), ...props},
    global: {...globalConfig.global, stubs: {ConsoleTeleport: TeleportStub, VaporAsyncComponentWrapper: FaceStub}},
  });
}

/** A recording stand-in for the browser's observer (this environment has none — the component then observes nothing). */
class FakeResizeObserver {
  public static made: Array<FakeResizeObserver> = [];
  public observed: Array<Element> = [];
  public disconnected = 0;
  constructor(public readonly changed: () => void) {
    FakeResizeObserver.made.push(this);
  }
  public observe(el: Element): void {
    this.observed.push(el);
  }
  public unobserve(): void {}
  public disconnect(): void {
    this.disconnected++;
  }
}

describe('ConsoleParliamentGovernment — the government\'s dais', () => {
  beforeEach(() => {
    resetParliamentFlow();
    resetParliamentHolds();
    careerGrantState.current = undefined;
  });
  afterEach(() => {
    resetParliamentFlow();
    resetParliamentHolds();
    careerGrantState.current = undefined;
  });

  it('before any law: the ruler\'s slot keyed by the ruling party, an empty seat\'s outline, the basis «Starting rule»', () => {
    expect(LAW, 'the catalogue has laws (anti-vacuous)').to.not.eq(undefined);
    const w = dais();
    expect(w.classes()).to.deep.eq(['con-parl__gov']);
    expect(w.attributes('data-parl-gov')).to.not.eq(undefined);
    expect(w.attributes('data-parl-gov-basis')).to.eq('Starting rule');
    expect((w.element as HTMLElement).style.getPropertyValue('--parl-accent')).to.eq(partyAccent(PartyName.SCIENTISTS));

    const ruler = w.find('[data-parl-ruler]');
    expect(ruler.attributes('data-zoom-slot')).to.eq(partyTileKey(PartyName.SCIENTISTS));
    expect(ruler.classes()).to.not.include('con-parl__ruler--focus');
    expect(ruler.find('[data-parl-ruler-slot]').exists(), 'the place the parties tier teleports the medallion into').to.eq(true);

    expect(w.find('[data-parl-gov-empty]').exists()).to.eq(true);
    expect(w.find('.teleport-stub').exists(), 'no law — no card, no teleport').to.eq(false);
    expect(w.find('.face-stub').exists()).to.eq(false);
  });

  it('the focus is the flow\'s: the dais in its zone, the ruler in its own — in the browse layer only', async () => {
    const w = dais();
    const focus = () => [w.classes().includes('con-parl__gov--focus'), w.find('[data-parl-ruler]').classes().includes('con-parl__ruler--focus')];
    expect(focus()).to.deep.eq([false, false]);
    parliamentFlow.zone = 'government';
    await nextTick();
    expect(focus()).to.deep.eq([true, false]);
    parliamentFlow.zone = 'ruler';
    await nextTick();
    expect(focus()).to.deep.eq([false, true]);
    parliamentFlow.stage = 'vote';
    await nextTick();
    expect(focus(), 'past the browse layer nothing here is the cursor').to.deep.eq([false, false]);
  });

  it('an enacted law is ONE card — its premium face at home (light, inert), carried to the sitting\'s hero slot while the stage holds the field', async () => {
    const w = dais({view: view({enacted: enacted(LAW, 'law#1')})});
    expect(w.classes()).to.include('con-parl__gov--enacted');
    expect(w.attributes('data-parl-gov-basis')).to.eq('Enacted resolution');
    expect(w.find('[data-parl-gov-empty]').exists()).to.eq(false);

    const teleport = w.findComponent(TeleportStub);
    expect(teleport.props('to')).to.eq('[data-parl-sit-hero]');
    expect(teleport.props('defer')).to.eq(true);
    expect(teleport.props('disabled'), 'at home').to.eq(true);

    const card = w.find('.con-parl__gov-card');
    expect(card.attributes('data-zoom-slot')).to.eq('resolution:' + LAW.id);
    expect(card.attributes('data-reaction-home')).to.eq(LAW.id);
    expect(card.classes()).to.deep.eq(['con-parl__gov-card']);
    const face = w.findComponent(FaceStub);
    expect(face.props('vmOverride')).to.deep.eq(resolutionPremiumVmById(LAW.id));
    expect(face.props('lightweight')).to.eq(true);
    expect(face.props('inert')).to.eq(true);
    expect(face.props('artTier')).to.eq(parliamentArtTier());

    // The sitting's stage took the field for a hosted step: the same instance rides to the hero slot, at full weight.
    parliamentFlow.stage = 'sitting';
    parliamentFlow.sittingField = true;
    await w.setProps({sittingStage: 'reward'});
    expect(teleport.props('disabled')).to.eq(false);
    expect(face.props('lightweight')).to.eq(false);
    expect(w.classes(), 'the government in power, acting — the one lit zone').to.include('con-parl__gov--lit');
    // …never during the enactment itself, and never under a step that takes the stage whole.
    await w.setProps({sittingStage: 'enact'});
    expect(teleport.props('disabled')).to.eq(true);
    await w.setProps({sittingStage: 'reward'});
    parliamentFlow.sittingFullStep = true;
    await nextTick();
    expect(teleport.props('disabled')).to.eq(true);
  });

  it('DURING THE SITTING the dais shows the PREVIOUS government until the enactment has moved each piece — and says it is the outgoing one', async () => {
    expect(OLD_LAW, 'a second law exists (anti-vacuous)').to.not.eq(undefined);
    const before: ReduxParty = PartyName.GREENS;
    parliamentFlow.stage = 'sitting';
    parliamentHolds.govBefore = {enacted: enacted(OLD_LAW, 'old#1')};
    parliamentHolds.rulerBefore = before;
    const w = dais({view: view({enacted: enacted(LAW, 'law#1')}), sittingStage: 'reward'});

    expect(w.find('.con-parl__gov-card').attributes('data-reaction-home'), 'the old card still governs the picture').to.eq(OLD_LAW.id);
    expect(w.findComponent(FaceStub).props('vmOverride')).to.deep.eq(resolutionPremiumVmById(OLD_LAW.id));
    expect(w.find('[data-parl-ruler]').attributes('data-zoom-slot')).to.eq(partyTileKey(before));
    expect((w.element as HTMLElement).style.getPropertyValue('--parl-accent')).to.eq(partyAccent(before));
    expect(w.attributes('data-parl-gov-basis')).to.eq('Outgoing government');
    expect(w.classes(), 'a set in transit wears no seam').to.not.include('con-parl__gov--lit');

    // The new card is on its way: the block waits for it by MATERIAL.
    parliamentHolds.govBefore = undefined;
    parliamentHolds.rulerBefore = undefined;
    parliamentHolds.govAwaits = 'law#1';
    await nextTick();
    expect(w.find('.con-parl__gov-card').attributes('data-reaction-home')).to.eq(LAW.id);
    expect(w.find('.con-parl__gov-card').classes()).to.include('con-parl__gov-card--awaiting');
    expect(w.attributes('data-parl-gov-basis'), 'no law was discarded for it — the starting rule still stands').to.eq('Starting rule');

    // Landed: the government in power — lit, and the source of a Career step says so with a word.
    parliamentHolds.govAwaits = undefined;
    await nextTick();
    expect(w.attributes('data-parl-gov-basis')).to.eq('Enacted resolution');
    expect(w.classes()).to.include('con-parl__gov--lit');
    expect(w.find('[data-parl-gov-career]').exists()).to.eq(false);
    careerGrantState.current = {phase: 'walk'} as NonNullable<typeof careerGrantState.current>;
    await nextTick();
    expect(w.find('[data-parl-gov-career]').text()).to.eq($t('Agenda track'));
    expect(w.find('[data-parl-gov-carry]').classes()).to.include('con-parl__gov-carry--career');
    expect(w.find('.con-parl__gov-card').classes()).to.include('con-parl__gov-card--lit');
  });

  it('observes its RULING COLUMN while it is mounted (the room the card is solved into) and lets go on unmount', () => {
    const host = globalThis as unknown as {ResizeObserver?: unknown};
    const had = Object.prototype.hasOwnProperty.call(host, 'ResizeObserver');
    const original = host.ResizeObserver;
    FakeResizeObserver.made = [];
    host.ResizeObserver = FakeResizeObserver;
    try {
      const w = dais();
      expect(FakeResizeObserver.made.length).to.eq(1);
      const observer = FakeResizeObserver.made[0];
      expect(observer.observed).to.deep.eq([w.find('.con-parl__ruling').element]);
      expect(() => observer.changed(), 'a change of the room re-solves the fit (a no-op with no section on screen)').to.not.throw();
      expect(observer.disconnected).to.eq(0);
      w.unmount();
      expect(observer.disconnected).to.eq(1);
    } finally {
      if (had) {
        host.ResizeObserver = original;
      } else {
        delete host.ResizeObserver;
      }
    }
  });
});

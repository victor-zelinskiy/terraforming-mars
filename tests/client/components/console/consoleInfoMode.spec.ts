/*
 * ConsoleInfoMode — THE INFORMATION WORKSPACE (Y): the read-only participant dossier over `infoModeState` and the pure
 * models. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md). The shell stands it in the surface
 * registry (`surfaces.bind.infoMode`) and the pad router reaches NINE of its functions through that ref — so it is
 * mounted here the way the shell mounts it, under a host that holds a ref, and the spec reads what that ref carries.
 *
 * A 1 200-line surface is not covered by a unit spec (its e2e walks it — `console-info-*`). Under test is its WIRING:
 * it mounts on an honest base-game view without a warning, the crumb and the zones follow the inspected seat and the
 * route, the command contract is published and taken back, and a pad intent goes THROUGH the ref to the surface the
 * route hosts. Every hosted surface is its own subject and is stubbed by name; the workspace head is the real one
 * (the identity chips live in its trailing slot).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {VictoryPointsBreakdown} from '@/common/game/VictoryPointsBreakdown';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {infoModeState} from '@/client/console/infoModeState';
import {consolePanelUi} from '@/client/console/consolePanelUi';
import ConsoleInfoMode from '@/client/components/console/ConsoleInfoMode.vue';

/** What the pad router reads through the registry — the component's whole contract with the shell. */
type InfoModeReach = {
  consumeEffectsBack(): boolean,
  consumeScoreBack(): boolean,
  handleActionsIntent(intent: GamepadIntent): void,
  handleCampaignIntent(intent: GamepadIntent): boolean,
  handleEffectsIntent(intent: GamepadIntent): void,
  handleExtrasIntent(intent: GamepadIntent): void,
  handlePlayedIntent(intent: GamepadIntent): void,
  handleScoreIntent(intent: GamepadIntent): void,
  selectExtrasType(key: string, index: number): void,
};
const EXPOSED = [
  'consumeEffectsBack', 'consumeScoreBack', 'handleActionsIntent', 'handleCampaignIntent', 'handleEffectsIntent',
  'handleExtrasIntent', 'handlePlayedIntent', 'handleScoreIntent', 'selectExtrasType',
];

/** Every call a hosted surface received through ITS ref — `[surface, member, ...args]`. */
let calls: Array<ReadonlyArray<unknown>> = [];

/**
 * A hosted surface, stubbed by name. `reach` is what the stub exposes to the workspace's ref — a surface whose ref the
 * workspace calls records the call and answers `answer`.
 * (A render function, not a template string: the runtime compiler is not in this build.)
 */
function surface(name: string, reach: ReadonlyArray<string> = [], answer: unknown = undefined) {
  return defineComponent({
    name,
    inheritAttrs: false,
    emits: ['close'],
    setup(_props, {expose}) {
      const exposed: Record<string, (...args: Array<unknown>) => unknown> = {};
      for (const member of reach) {
        exposed[member] = (...args: Array<unknown>) => {
          calls.push([name, member, ...args]);
          return answer;
        };
      }
      expose(exposed);
      return () => h('i', {'data-stub': name});
    },
  });
}

const PlayedStub = surface('ConsolePlayedOverlay', ['handleIntent']);
const STUBS = {
  ConsoleDossierScore: surface('ConsoleDossierScore'),
  ConsoleDossierSealed: surface('ConsoleDossierSealed'),
  ConsoleDossierCards: surface('ConsoleDossierCards'),
  ConsoleDossierActions: surface('ConsoleDossierActions'),
  ConsoleDossierEffects: surface('ConsoleDossierEffects'),
  ConsoleDossierParliament: surface('ConsoleDossierParliament'),
  ConsoleDossierCampaign: surface('ConsoleDossierCampaign'),
  ConsolePlayedOverlay: PlayedStub,
  ConsoleScoreExplorer: surface('ConsoleScoreExplorer', ['handleIntent', 'consumeScoreBack'], true),
  ConsoleExtrasExplorer: surface('ConsoleExtrasExplorer', ['handleIntent', 'selectType']),
  ConsoleInfoParliament: surface('ConsoleInfoParliament'),
  ConsoleCampaignOverview: surface('ConsoleCampaignOverview', ['handleIntent'], true),
  ConsoleInfoActionGallery: surface('ConsoleInfoActionGallery', ['handleIntent']),
  ConsoleArmedEffectsSection: surface('ConsoleArmedEffectsSection'),
  ConsoleEffectsExplorer: surface('ConsoleEffectsExplorer', ['handleIntent', 'consumeEffectsBack'], true),
  ConsoleMarsBotSections: surface('ConsoleMarsBotSections'),
  GamepadGlyph: surface('GamepadGlyph'),
};

const BREAKDOWN: VictoryPointsBreakdown = {
  terraformRating: 20,
  terraformRatingBreakdown: {base: 20, temperature: 0, oxygen: 0, oceans: 0, venus: 0, cards: 0},
  milestones: 0,
  awards: 0,
  greenery: 0,
  city: 0,
  escapeVelocity: 0,
  moonHabitats: 0,
  moonMines: 0,
  moonRoads: 0,
  planetaryTracks: 0,
  deltaProject: 0,
  victoryPoints: 0,
  total: 20,
  detailsCards: [],
  detailsMilestones: [],
  detailsAwards: [],
  detailsPlanetaryTracks: [],
  negativeVP: 0,
};

/** A seat of a base game: a corporation, an action card and an effect card on the table — no resource holder. */
function seat(color: string, name: string): PublicPlayerModel {
  return {
    color, name,
    tableau: [CardName.CREDICOR, CardName.AI_CENTRAL, CardName.EARTH_OFFICE].map((card) => ({name: card} as CardModel)),
    victoryPointsBreakdown: BREAKDOWN,
    terraformRating: 20,
    megacredits: 30,
    actionsThisGeneration: [],
  } as unknown as PublicPlayerModel;
}
const ME = seat('blue', 'Ada');
const RIVAL = seat('red', 'Bruno');
/** A base game: no bot, no parliament, no campaign, the rivals' scores hidden. No `id` — the stats store asks nobody. */
const VIEW = {
  players: [ME, RIVAL],
  thisPlayer: ME,
  waitingFor: undefined,
  game: {
    gameAge: 3,
    undoCount: 0,
    automa: undefined,
    parliament: undefined,
    passedPlayers: ['red'],
    milestones: [],
    awards: [],
    gameOptions: {expansions: {}, showOtherPlayersVP: false, campaign: undefined},
  },
} as unknown as PlayerViewModel;

function mountUnderHost(props: {myTurn?: boolean} = {}) {
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleInfoMode, {ref: 'infoMode', playerView: VIEW, ...props})]),
  });
  const wrapper = mount(Host, {...globalConfig, global: {...globalConfig.global, stubs: STUBS}});
  return {
    wrapper,
    /** The shell's read: what the ref it stands on the workspace carries. */
    reach: (): InfoModeReach => {
      const view = (wrapper.vm.$refs.infoMode ?? undefined) as InfoModeReach | undefined;
      if (view === undefined) {
        throw new Error('the host holds no ref to the information workspace');
      }
      return view;
    },
    zones: () => wrapper.findAll('[data-dossier] [data-zone]').map((zone) => zone.attributes('data-zone')),
    hosted: () => wrapper.findAll('.con-info__frame [data-stub]').map((stub) => stub.attributes('data-stub')),
  };
}

const press: GamepadIntent = {kind: 'press', button: 'confirm'};

describe('ConsoleInfoMode — the information workspace', () => {
  let saved: {playerColor: typeof infoModeState.playerColor, route: typeof infoModeState.route, summaryFocus: typeof infoModeState.summaryFocus};

  beforeEach(() => {
    saved = {playerColor: infoModeState.playerColor, route: infoModeState.route, summaryFocus: infoModeState.summaryFocus};
    infoModeState.playerColor = 'blue';
    infoModeState.route = 'summary';
    infoModeState.summaryFocus = 'vp';
    calls = [];
  });

  afterEach(() => {
    infoModeState.playerColor = saved.playerColor;
    infoModeState.route = saved.route;
    infoModeState.summaryFocus = saved.summaryFocus;
  });

  it('the viewer\'s own summary: the dossier\'s zones in the tiers\' order, the head naming the seat, the bar published — and taken back', () => {
    const {wrapper, zones, hosted} = mountUnderHost({myTurn: true});
    const root = wrapper.find('.con-info');
    expect(root.attributes('data-motion-surface')).to.eq('info-mode');
    expect(root.attributes('role')).to.eq('dialog');

    // A base game, a human seat: the two heroes and the human's pair — no bot door, no parliament, no campaign.
    expect(zones()).to.deep.eq(['vp', 'played', 'actions', 'effects']);
    expect(hosted(), 'the open score — never the sealed cell — for the viewer\'s own seat')
      .to.deep.eq(['ConsoleDossierScore', 'ConsoleDossierCards', 'ConsoleDossierActions', 'ConsoleDossierEffects']);
    const focused = wrapper.findAll('.con-info__zone--focused').map((zone) => zone.attributes('data-zone'));
    expect(focused, 'the ring stands on the module\'s focus').to.deep.eq(['vp']);

    // The crumb: the root and the participant — the summary has no stage. The identity rides the trailing slot.
    expect(wrapper.find('.con-wshead__root').text()).to.eq($t('Information'));
    expect(wrapper.find('.con-wshead__subject').text()).to.eq('Ada');
    expect(wrapper.find('.con-wshead__step').exists()).to.eq(false);
    expect(wrapper.find('.con-info__chip--you').text()).to.eq($t('You'));
    expect(wrapper.find('.con-info__chip--turn').text()).to.eq($t('Your turn'));
    expect(wrapper.find('[data-info-readonly]').exists(), 'one\'s own seat is no read').to.eq(false);
    expect(wrapper.find('.con-info__corp').text(), 'the corporation off the tableau').to.eq($t(CardName.CREDICOR));

    // The command contract is the panel's while it stands (the immediate watcher) — and nobody's after it left.
    expect(consolePanelUi.owner).to.eq('infoMode');
    expect(consolePanelUi.commands.map((command) => [command.control, command.label])).to.deep.eq([
      ['bumperL', 'Players'], ['confirm', 'Open: ${0}'], ['inspect', 'Close'],
    ]);
    expect(consolePanelUi.commands[1].labelParams, 'A names the focused zone').to.deep.eq([$t('Victory Points')]);
    wrapper.unmount();
    expect(consolePanelUi.owner).to.eq(undefined);
    expect(consolePanelUi.commands).to.deep.eq([]);
  });

  it('follows the inspected seat: another seat is a READ, its hidden score a sealed cell — the route and the ring stay', async () => {
    const {wrapper, zones, hosted} = mountUnderHost();
    infoModeState.summaryFocus = 'played';
    infoModeState.playerColor = 'red';
    await nextTick();

    expect(wrapper.find('.con-wshead__subject').text()).to.eq('Bruno');
    expect(wrapper.find('.con-info__chip--you').exists()).to.eq(false);
    expect(wrapper.find('[data-info-readonly]').text()).to.eq($t('Opponent state is read-only'));
    expect(wrapper.find('.con-info__chip--passed').exists(), 'the seat has passed').to.eq(true);
    expect(zones()).to.deep.eq(['vp', 'played', 'actions', 'effects']);
    expect(hosted()[0], 'the game hides the rivals\' scores').to.eq('ConsoleDossierSealed');
    expect(wrapper.findAll('.con-info__zone--focused').map((zone) => zone.attributes('data-zone'))).to.deep.eq(['played']);
    expect(consolePanelUi.commands[1].labelParams).to.deep.eq([$t('Played cards')]);
  });

  it('a PARENT\'s ref sees the nine functions the pad router calls and nothing else; with no hosted surface each is a calm no', () => {
    const {reach} = mountUnderHost();
    const view = reach();
    expect(Object.keys(view).sort(), 'exactly what the workspace exposes').to.deep.eq(EXPOSED);
    const leaked = ['viewed', 'isSelf', 'footCommands', 'presentation', 'closePlayedRoute', 'detailZoneEnter', 'warmExtrasArt', 'titleLabel', 'flow', 'scoreView']
      .filter((key) => (view as unknown as Record<string, unknown>)[key] !== undefined);
    expect(leaked).to.deep.eq([]);

    // The summary hosts none of the six surfaces: an intent has nowhere to go, a «back» is not consumed.
    view.handlePlayedIntent(press);
    view.handleScoreIntent(press);
    view.handleExtrasIntent(press);
    view.handleActionsIntent(press);
    view.handleEffectsIntent(press);
    view.selectExtrasType('floaters', 1);
    expect([view.handleCampaignIntent(press), view.consumeScoreBack(), view.consumeEffectsBack()]).to.deep.eq([false, false, false]);
    expect(calls).to.deep.eq([]);
  });

  it('a route hosts ONE surface and the pad goes THROUGH THE REF to it; the played table\'s close folds back onto its zone', async () => {
    const {wrapper, reach, hosted} = mountUnderHost();

    infoModeState.route = 'effects';
    await nextTick();
    expect(wrapper.find('[data-info-zone="effects"]').exists()).to.eq(true);
    expect(hosted()).to.deep.eq(['ConsoleArmedEffectsSection', 'ConsoleEffectsExplorer']);
    reach().handleEffectsIntent(press);
    expect(reach().consumeEffectsBack(), 'the explorer consumed the B').to.eq(true);
    reach().handleScoreIntent(press);
    expect(reach().consumeScoreBack(), 'the score explorer is not up').to.eq(false);
    expect(calls).to.deep.eq([['ConsoleEffectsExplorer', 'handleIntent', press], ['ConsoleEffectsExplorer', 'consumeEffectsBack']]);

    calls = [];
    infoModeState.route = 'extras';
    await nextTick();
    expect(hosted()).to.deep.eq(['ConsoleExtrasExplorer']);
    reach().selectExtrasType('floaters', 2);
    reach().handleExtrasIntent(press);
    expect(calls).to.deep.eq([['ConsoleExtrasExplorer', 'selectType', 'floaters', 2], ['ConsoleExtrasExplorer', 'handleIntent', press]]);

    calls = [];
    infoModeState.route = 'vp';
    await nextTick();
    expect(hosted()).to.deep.eq(['ConsoleScoreExplorer']);
    expect(reach().consumeScoreBack()).to.eq(true);

    calls = [];
    infoModeState.route = 'played';
    await nextTick();
    expect(hosted()).to.deep.eq(['ConsolePlayedOverlay']);
    expect(wrapper.find('.con-wshead__step').text(), 'the route is the crumb\'s stage').to.eq($t('Played'));
    reach().handlePlayedIntent(press);
    expect(calls).to.deep.eq([['ConsolePlayedOverlay', 'handleIntent', press]]);
    wrapper.findComponent(PlayedStub).vm.$emit('close');
    await nextTick();
    expect([infoModeState.route, infoModeState.summaryFocus], 'B at table level: the summary, the ring on the zone it left').to.deep.eq(['summary', 'played']);
    expect(wrapper.find('[data-dossier]').exists()).to.eq(true);
  });

  it('a route the seat cannot serve keeps the route and says so — the capability fallback, never a reset', async () => {
    const {wrapper, hosted} = mountUnderHost();
    infoModeState.route = 'botScreen';
    await nextTick();
    expect(infoModeState.route).to.eq('botScreen');
    expect(wrapper.find('[data-dossier]').exists()).to.eq(false);
    expect(wrapper.find('.con-info__na-body').text()).to.eq($t('This section exists only for the bot'));
    expect(hosted(), 'only the bumpers\' glyphs').to.deep.eq(['GamepadGlyph', 'GamepadGlyph']);
    expect(wrapper.find('.con-wshead__step').text()).to.eq($t('MarsBot screen'));
  });
});

/*
 * ConsoleLaunchPanel — the creator's right column, the live LAUNCH BRIEFING: crew · map · expansions · rules, then the
 * readiness block (the blocking issues, or the «ready» plate). A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): a READOUT — no props, no emits, every reading a computed over the shared create
 * model. It exposes nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {BoardName} from '@/common/boards/BoardName';
import {createGameState, resetCreateGameState, setSessionMode} from '@/client/components/create/premium/createGameState';
import {PREMIUM_EXPANSIONS, expansionIcon} from '@/client/components/create/premium/createGameMeta';
import {consoleCreateUi, launchIssues, resetConsoleCreateUi} from '@/client/console/menu/consoleCreateModel';
import ConsoleLaunchPanel from '@/client/components/console/menu/ConsoleLaunchPanel.vue';

// The scroll primitive, the board miniature, the deck meter and the badge are their own subjects; here the scroll
// area is a box that holds its slot and the rest are marks that carry what the briefing asks of them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const ScrollStub = defineComponent({
  name: 'ConsoleScrollArea',
  props: {fill: Boolean, contentClass: String},
  setup(_props, {slots}) {
    return () => h('div', {class: 'scroll-stub'}, slots.default?.());
  },
});
const MapStub = defineComponent({
  name: 'PremiumMapFingerprint',
  props: {mapId: String, random: Boolean, accent: String, variant: String},
  render: () => h('i', {class: 'map-stub'}),
});
const MeterStub = defineComponent({
  name: 'ConsoleDeckMeter',
  props: {variant: String},
  render: () => h('i', {class: 'meter-stub'}),
});
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
});

function briefing() {
  return mount(ConsoleLaunchPanel, {
    ...globalConfig,
    global: {
      ...globalConfig.global,
      stubs: {ConsoleScrollArea: ScrollStub, PremiumMapFingerprint: MapStub, ConsoleDeckMeter: MeterStub, GamepadGlyph: GlyphStub},
    },
  });
}

/** Two seats on Tharsis, the second name as given; Prelude alone switched on; no rule on. */
function seatParty(secondName: string): void {
  const config = createGameState.config;
  config.players = [
    {slot: 0, name: 'Ada', color: 'red', trBoost: 0, isCreator: true},
    {slot: 1, name: secondName, color: 'blue', trBoost: 0, isCreator: false},
  ];
  config.mapMode = 'specific';
  config.mapId = BoardName.THARSIS;
  for (const expansion of PREMIUM_EXPANSIONS) {
    config.selectedExpansions[expansion.id] = expansion.id === 'prelude';
  }
  config.rules = {
    draftVariant: false, randomMilestonesAwards: false, randomBoardTiles: false, alternativeVenusBoard: false,
    fastMode: false, trBoostEnabled: false, showOtherPlayersVP: false, testMode: false,
  };
}

describe('ConsoleLaunchPanel — the creator\'s launch briefing', () => {
  beforeEach(() => {
    resetCreateGameState();
    resetConsoleCreateUi();
  });
  afterEach(() => {
    resetCreateGameState();
    resetConsoleCreateUi();
  });

  it('a party that is NOT ready: the crew with the unnamed seat said, the count, the map, the expansions — and the blocking issues by name', () => {
    seatParty('');
    const w = briefing();
    expect(w.classes()).to.include('cm-launch');
    expect(w.find('.cm-launch__title').text()).to.eq($t('Launch briefing'));
    const scroll = w.findComponent(ScrollStub);
    expect(scroll.classes()).to.include('cm-launch__scroll');
    expect(scroll.props('fill')).to.eq(true);
    expect(scroll.props('contentClass')).to.eq('cm-launch__body');

    expect(w.find('.cm-launch__count').text()).to.eq('2');
    const names = w.findAll('.cm-launch__chips > .cm-chip .cm-chip__name');
    expect(names.map((name) => name.text())).to.deep.eq(['Ada', $t('Name not set')]);
    expect(names.map((name) => name.classes().includes('cm-chip__name--missing'))).to.deep.eq([false, true]);

    const board = w.findComponent(MapStub);
    expect(board.props('mapId')).to.eq(BoardName.THARSIS);
    expect(board.props('random')).to.eq(false);
    expect(board.props('variant')).to.eq('card');
    expect(w.find('.cm-launch__map-name').text()).to.eq($t('Tharsis'));

    expect(w.findAll('.cm-launch__icons img').map((img) => img.attributes('src'))).to.deep.eq([expansionIcon('prelude')]);
    const meter = w.findComponent(MeterStub);
    expect(meter.props('variant')).to.eq('brief');
    expect(meter.classes()).to.include('cm-launch__decks');
    expect(w.find('.cm-launch__rules').exists(), 'no rule is on — the block says «None»').to.eq(false);

    const issues = launchIssues();
    expect(issues.map((issue) => issue.textKey)).to.deep.eq(['Fill in every player name']);
    expect(w.find('.cm-launch__status--blocked').text()).to.eq(`!${$t('Blocking issues')}: 1`);
    expect(w.findAll('.cm-issues > .cm-issues__row').map((row) => row.text())).to.deep.eq([$t('Fill in every player name')]);
    expect(w.find('.cm-launch__status--ready').exists()).to.eq(false);
  });

  it('a READY party reads the mint plate; and the briefing FOLLOWS the model — a seated bot, a rule, the restored chip, an error', async () => {
    seatParty('Bo');
    const w = briefing();
    expect(launchIssues()).to.have.length(0);
    expect(w.find('.cm-launch__status--ready').text()).to.eq($t('Ready to launch'));
    expect(w.find('.cm-issues').exists()).to.eq(false);
    expect(w.find('.cm-chip--bot').exists()).to.eq(false);
    expect(w.find('.cm-launch__restored').exists()).to.eq(false);
    expect(w.find('.cm-launch__error').exists()).to.eq(false);

    createGameState.config.seatMarsBot = true;
    createGameState.config.rules.draftVariant = true;
    consoleCreateUi.restored = true;
    createGameState.error = 'The server refused the party';
    await nextTick();
    expect(w.find('.cm-launch__count').text(), 'the bot is a participant').to.eq('3');
    expect(w.find('.cm-chip--bot .cm-chip__name').text()).to.eq(`${$t('MarsBot')} · ${$t('Normal')}`);
    expect(w.findAll('.cm-launch__rules > .cm-launch__rule').map((rule) => rule.text())).to.deep.eq([$t('Card draft')]);
    expect(w.find('.cm-launch__error').text()).to.eq($t('The server refused the party'));
    const restored = w.find('.cm-launch__restored');
    expect(restored.text()).to.eq($t('Restored your last settings') + $t('Reset'));
    expect(w.findAllComponents(GlyphStub).map((glyph) => glyph.props('control'))).to.deep.eq(['view']);
  });

  it('a CAMPAIGN briefs its route in the map\'s place — a random miniature, no board named; a random map does the same for a party', async () => {
    seatParty('Bo');
    createGameState.config.mapMode = 'random-all';
    const w = briefing();
    expect(w.findComponent(MapStub).props('mapId'), 'a random map names no board').to.eq(undefined);
    expect(w.findComponent(MapStub).props('random')).to.eq(true);
    expect(w.find('.cm-launch__map-name').text()).to.eq($t('Random All'));

    setSessionMode('campaign');
    await nextTick();
    const missions = String(createGameState.config.campaignMissionCount);
    expect(w.find('.cm-launch__title').text()).to.eq($t('Campaign briefing'));
    expect(w.find('.cm-launch__map-name').text()).to.eq(
      translateTextWithParams('Missions: ${0} · unique boards, generated at assembly', [missions]) + ' · ' + translateText('Titles'));
    expect(w.findComponent(MapStub).props('random')).to.eq(true);
    expect(w.find('.cm-launch__status--ready').text()).to.eq($t('Ready to assemble the campaign'));
  });
});

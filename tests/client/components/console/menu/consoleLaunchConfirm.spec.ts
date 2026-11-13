/*
 * ConsoleLaunchConfirm — the creator's final confirm overlay: the party at a glance (crew · map · expansions · decks),
 * then ONE context where A launches and B cancels. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md):
 * it takes no props — every reading is a computed over the shared create model and the deck composition state — and
 * a press goes UP as `confirm` / `cancel`. It exposes nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {BoardName} from '@/common/boards/BoardName';
import {DeckCompositionModel} from '@/common/models/DeckCompositionModel';
import {createGameState, resetCreateGameState, setSessionMode} from '@/client/components/create/premium/createGameState';
import {PREMIUM_EXPANSIONS, expansionIcon, mapMeta} from '@/client/components/create/premium/createGameMeta';
import {deckCompositionState, resetDeckCompositionState} from '@/client/console/menu/deckCompositionState';
import ConsoleLaunchConfirm from '@/client/components/console/menu/ConsoleLaunchConfirm.vue';

// The board miniature and the badge are their own subjects; here they are marks that carry what the plate asks of them.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const MapStub = defineComponent({
  name: 'PremiumMapFingerprint',
  props: {mapId: String, random: Boolean, accent: String, variant: String},
  render: () => h('i', {class: 'map-stub'}),
});
const GlyphStub = defineComponent({
  name: 'GamepadGlyph',
  props: {control: String},
  render: () => h('i', {class: 'glyph-stub'}),
});

const composition: DeckCompositionModel = {
  projects: {total: 208, byModule: {}, byType: {automated: 100, active: 60, event: 48}},
  corporations: {total: 12, byModule: {}},
  preludes: {total: 0, byModule: {}},
  extras: {},
  contributions: {},
};

function plate() {
  return mount(ConsoleLaunchConfirm, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {PremiumMapFingerprint: MapStub, GamepadGlyph: GlyphStub}},
  });
}

/** A party of two named seats on Hellas with Prelude and Venus Next — nothing else switched on. */
function seatParty(): void {
  const config = createGameState.config;
  config.players = [
    {slot: 0, name: '  Ada ', color: 'red', trBoost: 0, isCreator: true},
    {slot: 1, name: 'Bo', color: 'blue', trBoost: 0, isCreator: false},
  ];
  config.mapMode = 'specific';
  config.mapId = BoardName.HELLAS;
  for (const expansion of PREMIUM_EXPANSIONS) {
    config.selectedExpansions[expansion.id] = expansion.id === 'prelude' || expansion.id === 'venus';
  }
}

describe('ConsoleLaunchConfirm — the creator\'s final confirm overlay', () => {
  beforeEach(() => {
    resetCreateGameState();
    resetDeckCompositionState();
    seatParty();
  });
  afterEach(() => {
    resetCreateGameState();
    resetDeckCompositionState();
  });

  it('a single party: the dialog names the launch, the crew by trimmed name and colour, the map and the enabled expansions', () => {
    const w = plate();
    expect(w.classes()).to.include.members(['cm-overlay', 'cm-overlay--launch']);
    expect(w.attributes('role')).to.eq('dialog');
    expect(w.attributes('aria-label')).to.eq($t('Launch the party'));
    expect(w.find('.cm-launchc__title').text()).to.eq($t('Launch the party'));
    expect(w.find('.cm-launchc__note').exists(), 'the freeze note is the campaign\'s').to.eq(false);

    const chips = w.findAll('.cm-launch__chips > .cm-chip');
    expect(chips.map((chip) => chip.find('.cm-chip__name').text())).to.deep.eq(['Ada', 'Bo']);
    expect(chips.map((chip) => chip.find('.cm-chip__cube').classes().find((c) => c.startsWith('player_bg_color_')))).to.deep.eq(
      ['player_bg_color_red', 'player_bg_color_blue']);
    expect(w.find('.cm-chip--bot').exists(), 'no bot is seated').to.eq(false);

    const hellas = mapMeta(BoardName.HELLAS);
    expect(w.find('.cm-launch__map-name').text()).to.eq($t(hellas.labelKey));
    const board = w.findComponent(MapStub);
    expect(board.props('mapId')).to.eq(BoardName.HELLAS);
    expect(board.props('random')).to.eq(false);
    expect(board.props('accent')).to.eq(hellas.accent);
    expect(board.props('variant')).to.eq('card');

    expect(w.findAll('.cm-launch__icons img').map((img) => img.attributes('src'))).to.deep.eq([expansionIcon('prelude'), expansionIcon('venus')]);
    expect(w.find('.cm-launch__none').exists()).to.eq(false);
    expect(w.find('[data-launch-decks]').exists(), 'no composition yet — no deck line').to.eq(false);
    expect(w.find('.cm-launch__error').exists()).to.eq(false);
    expect(w.find('.cm-launchc__creating').exists()).to.eq(false);
  });

  it('a campaign: the same plate assembles — the freeze note, the route in the map\'s place, a random miniature; a seated bot is a chip', () => {
    setSessionMode('campaign');
    createGameState.config.seatMarsBot = true;
    const w = plate();
    const missions = String(createGameState.config.campaignMissionCount);
    expect(w.attributes('aria-label')).to.eq($t('Assemble the campaign'));
    expect(w.find('.cm-launchc__title').text()).to.eq($t('Assemble the campaign'));
    expect(w.find('.cm-launchc__note').text()).to.eq(translateTextWithParams(
      'The roster, rules and expansions freeze for the whole campaign (missions: ${0}); its route of unique boards is generated once.', [missions]));
    expect(w.find('.cm-launch__map-name').text()).to.eq(
      translateTextWithParams('Missions: ${0} · unique boards, generated at assembly', [missions]) + ' · ' + translateText('Titles'));
    const board = w.findComponent(MapStub);
    expect(board.props('mapId'), 'a campaign names no one board').to.eq(undefined);
    expect(board.props('random')).to.eq(true);
    expect(w.find('.cm-chip--bot .cm-chip__name').text()).to.eq(`${$t('MarsBot')} · ${$t('Normal')}`);
    expect(w.find('.cm-confirm__btn--launch').text()).to.eq($t('Assemble'));
  });

  it('it FOLLOWS the shared state: the deck line is the server\'s count (a zero deck left out), an error is said, creating swaps the pad for the spinner', async () => {
    const w = plate();
    deckCompositionState.composition = composition;
    createGameState.error = 'The server refused the party';
    await nextTick();
    const parts = w.findAll('[data-launch-decks] [data-launch-deck]');
    expect(parts.map((part) => part.attributes('data-launch-deck'))).to.deep.eq(['projects', 'corporations']);
    expect(parts.map((part) => part.text())).to.deep.eq([
      translateTextWithParams('${0} projects', ['208']),
      translateTextWithParams('${0} corporations', ['12']),
    ]);
    expect(w.find('.cm-launch__error').text()).to.eq($t('The server refused the party'));
    expect(w.find('.cm-confirm__pad').exists()).to.eq(true);

    createGameState.creating = true;
    await nextTick();
    expect(w.find('.cm-confirm__pad').exists(), 'the pad is the root\'s while creating').to.eq(false);
    expect(w.find('.cm-launchc__creating').text()).to.eq($t('Creating the game') + '…');
  });

  it('the pad names its two verbs by SEMANTIC control; a press goes UP as `confirm` / `cancel`', async () => {
    const w = plate();
    const buttons = w.findAll('.cm-confirm__pad > button.cm-confirm__btn');
    expect(buttons.map((button) => button.text())).to.deep.eq([$t('Launch'), $t('Cancel')]);
    expect(w.findAllComponents(GlyphStub).map((glyph) => glyph.props('control'))).to.deep.eq(['confirm', 'back']);
    await buttons[1].trigger('click');
    await buttons[0].trigger('click');
    await buttons[0].trigger('click');
    expect(w.emitted('cancel')).to.have.length(1);
    expect(w.emitted('confirm')).to.have.length(2);
  });
});

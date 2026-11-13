/*
 * ConsoleResolutionsPlayground — the «Витрина резолюций Redux» stand: the catalog as the client manifest ships it,
 * the face at the game's sizes, and one SCENARIO × CONTEXT × TEST PLAYER instrument every reading of a law is taken
 * from. A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): how it opens (the catalog, the tables
 * its template reads straight off the script, the opening scenario), what it EXPOSES — its two hosts (the app's
 * deep-linked stand, the playground hub) stand it under a ref and read exactly one member off it, `handleIntent`:
 * the stand's whole pad — what a scenario sets (the WHOLE instrument, field by field), where the real viewer's origin
 * looks for a slot (the stand's own root — R12), and one walk of the whole catalog under every context: the stand
 * is 87 computeds over the real manifest, and a law of another family must find its own ring. It emits nothing.
 *
 * Every child is stubbed (the faces and the reading blocks are their own specs' subjects) — this spec reads the
 * stand's own markup. The pixels are the e2e's (`console-resolutions-playground`, `console-resolution-face`).
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {allResolutions} from '@/client/parliament/ClientParliamentManifest';
import {familyOf} from '@/client/console/parliament/resolutionFamily';
import {closeConsoleCardZoom, consoleCardZoom} from '@/client/console/consoleCardZoom';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import ConsoleResolutionsPlayground from '@/client/components/console/parliament/ConsoleResolutionsPlayground.vue';

/** What a host reads through its ref — exactly the parents' own cast. */
type StandReach = {handleIntent?: (intent: GamepadIntent) => boolean};

const STUBS = {
  PremiumCard: true, GamepadGlyph: true, PlayerDelegate: true, ConsoleInfluenceYield: true, ConsoleColonyLedger: true, ConsoleResolutionStatus: true,
  ConsoleResolutionAside: true, ConsoleCardRulesPanel: true, ConsoleSourceDock: true, ConsolePlayedTargetStep: true, PremiumMechanicsPanel: true,
  PremiumCountGlyph: true, ConsoleWinnerReward: true, ConsoleTileGrant: true, ConsoleAgendaGrant: true, ConsolePartyReaction: true, ActionEffectChip: true,
};

/** The catalog the stand must show: the real resolutions by code, then the never-dealt development examples. */
const MANIFEST = allResolutions();
const CATALOG = [
  ...MANIFEST.filter((r) => r.code !== undefined).sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '')),
  ...MANIFEST.filter((r) => r.code === undefined),
];
/** Y cycles the contexts in this order (the labels are the i18n keys). */
const CONTEXTS = ['Reference', 'Proposal', 'Enactment', 'Applied'];

const press = (button: string): GamepadIntent => ({kind: 'press', button} as GamepadIntent);
const nav = (dir: 'left' | 'right' | 'up' | 'down'): GamepadIntent => ({kind: 'nav', dir, repeat: false});

function mountUnderHost() {
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleResolutionsPlayground, {ref: 'resolutionsPg', embedded: true})]),
  });
  const host = mount(Host, {global: {...globalConfig.global, stubs: STUBS}});
  const text = (selector: string): string | undefined => {
    const found = host.find(selector);
    return found.exists() ? found.text() : undefined;
  };
  return {
    host,
    /** Exactly the parents' read: `(this.$refs.resolutionsPg ?? undefined) as … | undefined`. */
    reach: () => (host.vm.$refs.resolutionsPg ?? undefined) as StandReach | undefined,
    cursorId: () => host.find('.con-rxpg__slot--cursor').attributes('data-rxpg-id'),
    /** The scenario ring: every chip's key, and which of them stand active. */
    ring: () => host.findAll('[data-rxpg-scenario]').map((chip) => ({key: chip.attributes('data-rxpg-scenario'), active: chip.classes().includes('con-rxpg__scenario--active')})),
    /** The instrument's reading — what a scenario sets and the pad moves. */
    reading: () => ({
      context: text('[data-rxpg-context]'),
      player: host.find('[data-rxpg-player]').attributes('data-rxpg-player'),
      winner: host.find('[data-rxpg-winner]').attributes('data-rxpg-winner'),
      influence: text('[data-rxpg-influence]'),
      noRecipient: text('[data-rxpg-norecipient]'),
      modified: host.find('[data-rxpg-modified]').exists(),
    }),
  };
}

describe('ConsoleResolutionsPlayground — the Redux resolutions stand', () => {
  afterEach(() => {
    // The viewer's state is a module the whole bundle shares.
    closeConsoleCardZoom();
  });

  it('the stand as it opens: the manifest\'s catalog (real laws by code, then the never-dealt), the cursor on the first, the script\'s own tables under the template, the opening scenario', async () => {
    const {host, cursorId, ring, reading} = mountUnderHost();
    const stand = host.find('[data-resolutions-playground]');
    expect(stand.classes()).to.deep.eq(['con-rxpg', 'con-rxpg--embedded']);
    expect(mount(ConsoleResolutionsPlayground, {global: {...globalConfig.global, stubs: STUBS}}).classes(), 'on its own page it wears no «embedded»').to.deep.eq(['con-rxpg']);

    expect(CATALOG.length, 'the manifest ships resolutions').to.be.greaterThan(0);
    const slots = host.findAll('[data-rxpg-catalog] > .con-rxpg__slot');
    expect(slots.map((s) => s.attributes('data-rxpg-id'))).to.deep.eq(CATALOG.map((r) => r.id));
    expect(slots.map((s) => s.attributes('data-rxpg-code'))).to.deep.eq(CATALOG.map((r) => r.code ?? ''));
    expect(cursorId()).to.eq(CATALOG[0].id);

    // The tables the template names are the script's own constants now (no member hands them over).
    expect(host.findAll('[data-rxpg-size]').map((s) => s.attributes('data-rxpg-size'))).to.deep.eq(['overview', 'vote', 'fullscreen']);
    expect(host.findAll('[data-rxpg-lab="peripheral"] [data-rxpg-lab-project]').length).to.eq(4);
    expect(host.findAll('[data-rxpg-lab="ladder"] [data-rxpg-lab-zoom]').map((c) => c.attributes('data-rxpg-lab-zoom'))).to.deep.eq(['0.2', '0.3', '0.45', '0.62', '0.8', '1.12']);

    const chips = ring();
    expect(chips.length, 'the first law\'s family has scenarios').to.be.greaterThan(1);
    expect(chips.filter((chip) => chip.active).length, 'one of them is the opening scenario').to.eq(1);
    expect(reading()).to.include({context: 'Enactment', player: 'blue', winner: 'red', modified: false});

    // A click on a slot is the template writing the cursor.
    await slots[2].trigger('click');
    expect(cursorId()).to.eq(CATALOG[2].id);
  });

  it('a PARENT\'s ref sees exactly `handleIntent` — the stand\'s own pad: the catalog cursor, the test player, the context, the winner, the influence', async () => {
    const {host, reach, cursorId, reading} = mountUnderHost();
    const stand = reach();
    expect(stand, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(stand ?? {}), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['handleIntent']);
    for (const inner of ['applyScenario', 'openFullscreen', 'bumpInfluence', 'startLive', 'cursor', 'scenario', 'seats', 'catalog']) {
      expect((stand as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }

    expect(stand?.handleIntent?.(nav('right'))).to.eq(true);
    await nextTick();
    expect(cursorId(), '▶ walks the catalog').to.eq(CATALOG[1].id);
    expect(stand?.handleIntent?.(nav('left'))).to.eq(true);
    await nextTick();
    expect(cursorId()).to.eq(CATALOG[0].id);
    expect(stand?.handleIntent?.(nav('down')), 'the host scrolls — ▲▼ are not the stand\'s').to.eq(false);
    expect(stand?.handleIntent?.({kind: 'release', button: 'confirm'}), 'a release is nobody\'s').to.eq(false);
    expect(stand?.handleIntent?.(press('back')), 'B is the host\'s').to.eq(false);

    // A: the test player's influence +1 (the opening scenario boots no live game).
    expect(host.find('[data-rxpg-live]').exists()).to.eq(false);
    const before = Number(reading().influence);
    expect(stand?.handleIntent?.(press('confirm'))).to.eq(true);
    await nextTick();
    expect(Number(reading().influence)).to.eq((before + 1) % 6);
    expect(reading().modified, 'the chip says the scenario was moved').to.eq(true);

    // Y: the next context, round the ring of four.
    const seen = [reading().context];
    while (seen.length <= CONTEXTS.length) {
      expect(stand?.handleIntent?.(press('inspect'))).to.eq(true);
      await nextTick();
      seen.push(reading().context);
    }
    expect(seen).to.deep.eq(['Enactment', 'Applied', 'Reference', 'Proposal', 'Enactment']);

    // L3: the winner of the vote — the other seat, nobody, the first seat.
    const winners = [];
    for (let n = 0; n < 3; n++) {
      expect(stand?.handleIntent?.(press('stickL'))).to.eq(true);
      await nextTick();
      winners.push(reading().winner);
    }
    expect(winners).to.deep.eq(['neutral', 'blue', 'red']);

    // View: the test player — the other seat, then a spectator (no seat: no influence of its own), then the first again.
    expect(stand?.handleIntent?.(press('view'))).to.eq(true);
    await nextTick();
    expect(reading().player).to.eq('red');
    expect(stand?.handleIntent?.(press('view'))).to.eq(true);
    await nextTick();
    expect(reading()).to.include({player: 'spectator', influence: undefined});
    expect(stand?.handleIntent?.(press('view'))).to.eq(true);
    await nextTick();
    expect(reading().player).to.eq('blue');
  });

  it('RT walks the scenario ring, and a scenario sets the WHOLE instrument again — whatever the pad had moved', async () => {
    const {reach, ring, reading} = mountUnderHost();
    const stand = reach();
    const opening = reading();
    const chips = ring();
    const start = chips.findIndex((chip) => chip.active);

    // Move every field the pad can reach: the player, the context, the winner.
    for (const button of ['view', 'inspect', 'stickL']) {
      expect(stand?.handleIntent?.(press(button))).to.eq(true);
    }
    await nextTick();
    expect(reading()).to.include({player: 'red', context: 'Applied', winner: 'neutral', modified: true});

    for (let n = 1; n <= chips.length; n++) {
      expect(stand?.handleIntent?.(press('triggerR'))).to.eq(true);
      await nextTick();
      expect(ring().map((chip) => chip.active), `RT № ${n}: the next scenario of the same ring, and only it`)
        .to.deep.eq(chips.map((_, i) => i === (start + n) % chips.length));
      expect(reading().modified, 'a scenario just applied is nobody\'s edit').to.eq(false);
    }
    expect(reading(), 'round the ring: the opening scenario reads exactly as it opened').to.deep.eq(opening);
  });

  it('X opens the REAL viewer over the catalog: its origin finds the slot under the stand\'s own root, a browse moves the stand\'s cursor, and a stand that is gone answers «no slot»', async () => {
    const {host, reach, cursorId} = mountUnderHost();
    expect(reach()?.handleIntent?.(press('secondary'))).to.eq(true);

    expect(consoleCardZoom.cards.map((entry) => entry.name)).to.deep.eq(CATALOG.map((r) => r.id));
    expect(consoleCardZoom.index).to.eq(0);
    expect(consoleCardZoom.card?.name).to.eq(CATALOG[0].id);
    expect(consoleCardZoom.counterInFooter, 'the position rides the footer').to.eq(true);
    expect(consoleCardZoom.parliament?.viewer(), 'the viewer reads this stand\'s test player').to.eq('blue');
    expect(consoleCardZoom.parliament?.nameOf?.('red')).to.eq('Test player B');

    const origin = consoleCardZoom.origin;
    expect(origin.kind).to.eq('physical');
    const slot = host.find(`[data-zoom-slot="resolution:${CATALOG[1].id}"]`);
    expect(slot.exists()).to.eq(true);
    expect(origin.resolve?.(1), 'the slot of the card on screen, found under the stand').to.eq(slot.element);

    origin.onBrowse?.(2);
    await nextTick();
    expect(cursorId(), 'the stand\'s cursor follows the viewer').to.eq(CATALOG[2].id);

    host.unmount();
    expect(origin.resolve?.(1), 'no root, no slot — never a throw').to.eq(null);
  });

  it('the whole catalog under every context: each law finds a ring of its own family with ONE scenario standing, and its action\'s tables are the script\'s', async () => {
    const {host, reach, cursorId, ring, reading} = mountUnderHost();
    const stand = reach();
    let hands = 0;
    let bills = 0;
    for (let i = 0; i < CATALOG.length; i++) {
      const law = CATALOG[i];
      if (i > 0) {
        expect(stand?.handleIntent?.(nav('right'))).to.eq(true);
        await nextTick();
      }
      const where = `${law.code ?? law.id} (${familyOf(law)})`;
      expect(cursorId(), where).to.eq(law.id);
      const chips = ring();
      expect(chips.length, `${where}: its family has scenarios`).to.be.greaterThan(0);
      expect(chips.filter((chip) => chip.active).length, `${where}: one scenario stands — paging to another family opens that family's own`).to.eq(1);

      // The four contexts, back to the one the scenario opened in (every reading block computes or the walk throws).
      const context = reading().context;
      const at = CONTEXTS.indexOf(context ?? '');
      expect(at, `${where}: a known context`).to.be.greaterThan(-1);
      for (let n = 1; n <= CONTEXTS.length; n++) {
        expect(stand?.handleIntent?.(press('inspect'))).to.eq(true);
        await nextTick();
        expect(reading().context, where).to.eq(CONTEXTS[(at + n) % CONTEXTS.length]);
      }

      // A per-card action's synthetic hands and a priced action's influences — the script's two tables.
      const perCard = law.hasAction && (law.actionPreview ?? []).some((effect) => effect.note === 'per card');
      expect(host.findAll('[data-rxpg-action-hand]').map((b) => b.attributes('data-rxpg-action-hand')), where).to.deep.eq(perCard ? ['0', '1', '4'] : []);
      if (perCard) {
        hands++;
        await host.find('[data-rxpg-action-hand="0"]').trigger('click');
        expect(host.find('[data-rxpg-action-none]').exists(), `${where}: an empty hand cannot take it`).to.eq(true);
      }
      const billed = law.hasAction && law.actionBill !== undefined;
      expect(host.findAll('[data-rxpg-bill-influence]').map((b) => b.attributes('data-rxpg-bill-influence')), where).to.deep.eq(billed ? ['0', '3', '6'] : []);
      bills += billed ? 1 : 0;
    }
    expect(hands, 'the catalog has a per-card action').to.be.greaterThan(0);
    expect(bills, 'the catalog has a priced action').to.be.greaterThan(0);
  }).timeout(30_000);
});

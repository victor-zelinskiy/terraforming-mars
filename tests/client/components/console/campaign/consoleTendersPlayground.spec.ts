/*
 * ConsoleTendersPlayground — the «Витрина тендеров» stand: the catalog as it ships, the document's sizes and states,
 * and a simulated deal the REAL bidding scene plays. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders (the catalog, the deal's controls, what it hands the scene), and what
 * it EXPOSES — its two hosts (the app's deep-linked stand, the playground hub) stand it under `ref="tendersPg"` and
 * read exactly one member off it, `handleIntent`: the stand's whole pad. It emits nothing.
 *
 * The certificate and the bidding scene are stubbed (their own specs' subjects) — this spec reads what the stand HANDS
 * them, and what it forwards to the scene while the table owns the pad.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {TENDER_IDS, biddingOfferSize, effectiveTenderOffer} from '@/common/campaign/tenders';
import {BiddingModel} from '@/common/campaign/CampaignModel';
import {CampaignSeat} from '@/common/campaign/CampaignTypes';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import ConsoleTendersPlayground from '@/client/components/console/campaign/ConsoleTendersPlayground.vue';

/** What a host reads through its ref — exactly the parents' own cast. */
type StandReach = {handleIntent?: (intent: GamepadIntent) => boolean};

/** Every intent the stand forwarded to the scene (the stub's `handleIntent`). */
let forwarded: Array<GamepadIntent> = [];

// (Render functions, not template strings: the runtime compiler is not in this build.)
const TenderCardStub = defineComponent({
  name: 'ConsoleTenderCard',
  props: {
    id: {type: String, required: true},
    size: {type: String, default: undefined},
    state: {type: String, default: undefined},
    owner: {type: Object, default: undefined},
    focused: Boolean,
  },
  render() {
    return h('i', {'class': 'tender-card-stub'});
  },
});
const SceneStub = defineComponent({
  name: 'ConsoleTenderBidding',
  props: {
    bidding: {type: Object, required: true},
    seats: {type: Array, required: true},
    youSeat: {type: Number, default: undefined},
    missionLabel: {type: String, required: true},
    root: {type: String, default: undefined},
    revealKey: {type: String, required: true},
    embedded: Boolean,
  },
  emits: ['bid'],
  methods: {
    handleIntent(intent: GamepadIntent): boolean {
      forwarded.push(intent);
      return true;
    },
  },
  render() {
    return h('i', {'class': 'scene-stub'});
  },
});

const STUBS = {ConsoleTenderCard: TenderCardStub, ConsoleTenderBidding: SceneStub, GamepadGlyph: true};

const press = (button: string): GamepadIntent => ({kind: 'press', button} as GamepadIntent);
const nav = (dir: 'left' | 'right' | 'up' | 'down'): GamepadIntent => ({kind: 'nav', dir, repeat: false});

function mountUnderHost() {
  const Host = defineComponent({
    render: () => h('div', [h(ConsoleTendersPlayground, {ref: 'tendersPg', embedded: true})]),
  });
  const host = mount(Host, {global: {...globalConfig.global, stubs: STUBS}});
  return {
    host,
    /** Exactly the parents' read: `(this.$refs.tendersPg ?? undefined) as … | undefined`. */
    reach: () => (host.vm.$refs.tendersPg ?? undefined) as StandReach | undefined,
    scene: () => host.findComponent(SceneStub),
    cursorId: () => host.find('.con-tdpg__slot--cursor').attributes('data-tdpg-id'),
  };
}

describe('ConsoleTendersPlayground — the tenders stand', () => {
  beforeEach(() => {
    forwarded = [];
  });

  it('the stand: the catalog as it ships with the cursor on its first kind, the selected document\'s sizes and states, and a table DEALT at once for the real scene', () => {
    const {host, scene, cursorId} = mountUnderHost();
    const stand = host.find('[data-tenders-playground]');
    expect(stand.classes()).to.deep.eq(['con-tdpg', 'con-tdpg--embedded']);

    expect(host.findAll('[data-tdpg-catalog] > .con-tdpg__slot').map((s) => s.attributes('data-tdpg-id'))).to.deep.eq([...TENDER_IDS]);
    expect(cursorId()).to.eq(TENDER_IDS[0]);
    expect(host.findAll('[data-tdpg-sizes] > [data-tdpg-size]').map((c) => c.attributes('data-tdpg-size'))).to.deep.eq(['table', 'reader', 'plaque']);
    expect(host.findAll('[data-tdpg-states] > [data-tdpg-state]').map((c) => c.attributes('data-tdpg-state')))
      .to.deep.eq(['open', 'focused', 'taken', 'withdrawn', 'executed', 'cashed']);

    expect(host.find('[data-tdpg-seats]').text()).to.eq('3');
    expect(host.find('[data-tdpg-seed]').text()).to.eq('1');
    expect(host.find('[data-tdpg-preludes]').text()).to.eq('✓');
    expect(host.find('[data-tdpg-offer]').attributes('data-tdpg-offer')).to.eq('minusOne');
    expect(host.find('[data-tdpg-table]').attributes('data-tdpg-table-focus'), 'the catalog owns the pad first').to.eq(undefined);

    expect(scene().exists(), 'the table is dealt as the stand is created').to.eq(true);
    expect(scene().props('youSeat')).to.eq(0);
    expect(scene().props('root')).to.eq('Playground');
    expect(scene().props('embedded')).to.eq(true);
    expect(scene().props('revealKey')).to.eq('playground:1');
    expect((scene().props('seats') as Array<CampaignSeat>).map((s) => s.seat)).to.deep.eq([0, 1, 2]);
    const table = scene().props('bidding') as BiddingModel;
    expect(table.offer.length, 'the campaign\'s offer rule for a table of three').to.eq(biddingOfferSize(3, effectiveTenderOffer('minusOne', 3)));
    expect([...table.order].sort()).to.deep.eq([0, 1, 2]);
  });

  it('a PARENT\'s ref sees exactly `handleIntent` — the stand\'s own pad: the catalog cursor, the redeal, the seats, the Prelude expansion, the offer rule', async () => {
    const {host, reach, scene, cursorId} = mountUnderHost();
    const stand = reach();
    expect(stand, 'the host\'s ref stands').to.not.eq(undefined);
    expect(Object.keys(stand ?? {}), 'the exposed list is the contract — nothing else of the script').to.deep.eq(['handleIntent']);
    for (const inner of ['deal', 'hostedScene', 'scene', 'cursor', 'bidding']) {
      expect((stand as unknown as Record<string, unknown>)[inner], `«${inner}» stays inside`).to.eq(undefined);
    }

    expect(stand?.handleIntent?.(nav('right'))).to.eq(true);
    await nextTick();
    expect(cursorId(), '▶ walks the catalog').to.eq(TENDER_IDS[1]);
    expect(stand?.handleIntent?.(nav('down')), 'the stand scrolls — ▲▼ are not its own').to.eq(false);

    expect(stand?.handleIntent?.(press('triggerR'))).to.eq(true);
    await nextTick();
    expect(host.find('[data-tdpg-seed]').text(), 'RT redeals with the next seed').to.eq('2');
    expect(scene().props('revealKey'), 'a new deal is a new scene').to.eq('playground:2');

    expect(stand?.handleIntent?.(press('inspect'))).to.eq(true);
    await nextTick();
    expect(host.find('[data-tdpg-seats]').text()).to.eq('4');
    expect((scene().props('seats') as Array<CampaignSeat>).length).to.eq(4);

    expect(stand?.handleIntent?.(press('stickL'))).to.eq(true);
    await nextTick();
    expect(host.find('[data-tdpg-preludes]').text()).to.eq('—');

    expect(stand?.handleIntent?.(press('view'))).to.eq(true);
    await nextTick();
    expect(host.find('[data-tdpg-offer]').attributes('data-tdpg-offer'), 'View steps the offer rule').to.not.eq('minusOne');
    expect(forwarded, 'none of it went to the table').to.deep.eq([]);
  });

  it('LT hands the pad to the TABLE: ◀ ▶ / A / X go to the scene the stand hosts, ▲▼ stay the stand\'s scroll, LT again takes the pad back', async () => {
    const {host, reach, cursorId} = mountUnderHost();
    const stand = reach();
    const tableFocus = () => host.find('[data-tdpg-table]').attributes('data-tdpg-table-focus');

    expect(stand?.handleIntent?.(press('triggerL'))).to.eq(true);
    await nextTick();
    expect(tableFocus()).to.eq('yes');
    expect(host.find('[data-tdpg-table]').classes()).to.include('con-tdpg__table--focus');
    expect(host.find('.con-tdpg__slot--cursor').exists(), 'the catalog\'s cursor rests while the table has the pad').to.eq(false);

    const toScene = [nav('right'), nav('left'), press('confirm'), press('secondary')];
    for (const intent of toScene) {
      expect(stand?.handleIntent?.(intent), 'the scene\'s own answer').to.eq(true);
    }
    expect(forwarded).to.deep.eq(toScene);
    expect(stand?.handleIntent?.(nav('up')), 'the stand scrolls').to.eq(false);
    expect(forwarded.length).to.eq(toScene.length);

    expect(stand?.handleIntent?.(press('triggerL'))).to.eq(true);
    await nextTick();
    expect(tableFocus()).to.eq(undefined);
    expect(stand?.handleIntent?.(nav('right'))).to.eq(true);
    await nextTick();
    expect(cursorId(), 'the catalog has the pad again').to.eq(TENDER_IDS[1]);
    expect(forwarded.length, 'and the scene hears nothing more').to.eq(toScene.length);
  });
});

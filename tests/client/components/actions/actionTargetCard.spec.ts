/*
 * ActionTargetCard — the premium CARD-TARGET picker of an action / play step («add 2 microbes to ANOTHER card»). A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its props (the candidates
 * grouped by owner, each with its `current → resulting` impact, a disabled one with its reason), what it emits
 * (`change` — on a pick, and by itself for a lone candidate) and the fullscreen viewer it reaches through its own
 * template ref. The card face, the viewer and the VP plate have their own surfaces — stubbed by the names the template
 * uses. The unit runner renders the English keys.
 */
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {expect} from 'chai';
import {globalConfig} from '../getLocalVue';
import {fakePlayerViewModel, fakePublicPlayerModel} from '../testHelpers';
import ActionTargetCard from '@/client/components/actions/ActionTargetCard.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';

// (Render functions, not template strings: the runtime compiler is not in this build.)
const CardStub = defineComponent({
  name: 'Card',
  props: ['card'],
  render: () => h('i', {class: 'card-stub'}),
});
let shown = 0;
const ZoomStub = defineComponent({
  name: 'CardZoomModal',
  props: ['card'],
  emits: ['close'],
  methods: {
    show(): void {
      shown++;
    },
  },
  render: () => h('i', {class: 'zoom-stub'}),
});
const VpStub = defineComponent({
  name: 'ActionVpProgress',
  props: ['cardName', 'resourceIcon', 'before', 'after', 'compact'],
  render: () => h('i', {class: 'vp-stub'}),
});

// Tardigrades scores VP from its microbes (1 per 4); GHG Producing Bacteria stores microbes and scores nothing.
const TARDIGRADES: CardModel = {name: CardName.TARDIGRADES, resources: 2};
const BACTERIA: CardModel = {name: CardName.GHG_PRODUCING_BACTERIA, resources: 1};
const ANTS: CardModel = {name: CardName.ANTS, resources: 0, disabledReason: 'No resources on this card'};

function prompt(cards: ReadonlyArray<CardModel>, disabledCards?: ReadonlyArray<CardModel>): SelectCardModel {
  return {
    type: 'card',
    title: 'Select card to add 2 microbes',
    buttonLabel: 'Save',
    cards,
    max: 1,
    min: 1,
    showOnlyInLearnerMode: false,
    selectBlueCardAction: false,
    showOwner: false,
    showSelectAll: false,
    ...(disabledCards !== undefined ? {disabledCards} : {}),
  };
}

/** The viewer (blue) holds `mine`; a rival (red) holds `theirs`. */
function table(mine: ReadonlyArray<CardModel>, theirs: ReadonlyArray<CardModel> = []): PlayerViewModel {
  const me = fakePublicPlayerModel({color: 'blue', name: 'Alice', tableau: [...mine]});
  const rival = fakePublicPlayerModel({color: 'red', name: 'Bob', tableau: [...theirs]});
  return fakePlayerViewModel({thisPlayer: me, players: [me, rival]});
}

function picker(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  return mount(ActionTargetCard, {
    ...globalConfig,
    props,
    attrs,
    global: {
      ...globalConfig.global,
      stubs: {Card: CardStub, CardZoomModal: ZoomStub, ActionVpProgress: VpStub, teleport: true},
    },
  });
}

describe('ActionTargetCard — the card-target picker of an action step', () => {
  beforeEach(() => {
    shown = 0;
  });

  it('one owner: the candidates stand flat, each with its face, its `current → resulting` and — for a scorer — the VP plate', async () => {
    const w = picker(
      {input: prompt([TARDIGRADES, BACTERIA]), playerView: table([TARDIGRADES, BACTERIA]), amount: 2},
      {'data-from-host': 'yes'},
    );
    await nextTick();
    expect((w.element as Element).tagName, 'the template starts with its root').to.eq('DIV');
    expect(w.classes()).to.deep.eq(['action-target-card']);
    expect(w.attributes('data-from-host'), 'what the host lets fall through lands on the root').to.eq('yes');
    expect(w.find('.action-target-card__prompt').text()).to.eq('Select card to add 2 microbes');

    const groups = w.findAll('.action-target-card__group');
    expect(groups).to.have.length(1);
    expect(groups[0].classes()).to.contain('action-target-card__group--flat');
    expect(w.find('.action-target-card__owner').exists(), 'no owner header for a single owner').to.be.false;

    expect(w.findAllComponents(CardStub).map((face) => face.props('card'))).to.deep.eq([TARDIGRADES, BACTERIA]);
    const scorer = w.find(`[data-test="action-target-${CardName.TARDIGRADES}"]`);
    expect(scorer.find('.action-target-card__impact-from').text()).to.eq('2');
    expect(scorer.find('.action-target-card__impact-to').text()).to.eq('4');
    const plain = w.find(`[data-test="action-target-${CardName.GHG_PRODUCING_BACTERIA}"]`);
    expect(plain.find('.action-target-card__impact-from').text()).to.eq('1');
    expect(plain.find('.action-target-card__impact-to').text()).to.eq('3');
    expect(plain.find('.action-target-card__vp').exists(), 'a card that scores nothing shows no VP plate').to.be.false;

    const plates = w.findAllComponents(VpStub);
    expect(plates).to.have.length(1);
    expect(plates[0].props()).to.deep.eq({cardName: CardName.TARDIGRADES, resourceIcon: 'microbe', before: 2, after: 4, compact: true});
    expect(w.emitted('change'), 'two candidates are a real choice').to.be.undefined;

    // Without a fixed amount the line reads the bare current count.
    await w.setProps({amount: undefined});
    expect(scorer.find('.action-target-card__impact-from').exists()).to.be.false;
    expect(scorer.find('.action-target-card__impact-to').text()).to.eq('2');
    expect(w.findAllComponents(VpStub)).to.have.length(0);
  });

  it('several owners: a group per owner, the viewer\'s own cards LAST and marked; a disabled candidate reads its reason', async () => {
    const w = picker({
      input: prompt([TARDIGRADES, BACTERIA], [ANTS]),
      playerView: table([TARDIGRADES, ANTS], [BACTERIA]),
      amount: 2,
    });
    await nextTick();
    const groups = w.findAll('.action-target-card__group');
    expect(groups.map((group) => group.find('.action-target-card__owner-name').text())).to.deep.eq(['Bob', 'Alice']);
    expect(groups[0].classes()).to.not.contain('action-target-card__group--self');
    expect(groups[0].find('.action-target-card__owner-warn').exists()).to.be.false;
    expect(groups[0].find('.action-target-card__owner-dot').classes()).to.contain('player_bg_color_red');
    expect(groups[1].classes()).to.contain('action-target-card__group--self');
    expect(groups[1].find('.action-target-card__owner-warn').text()).to.contain('your card');
    expect(groups[1].findAll('.action-target-card__tile').map((tile) => tile.attributes('data-test')))
      .to.deep.eq([`action-target-${CardName.TARDIGRADES}`, `action-target-${CardName.ANTS}`]);

    const blocked = w.find(`[data-test="action-target-${CardName.ANTS}"]`);
    expect(blocked.classes()).to.include.members(['action-target-card__tile--disabled', 'action-target-card__tile--self']);
    expect(blocked.find('.action-target-card__reason').text()).to.eq('No resources on this card');
    expect(blocked.find('.action-target-card__pick').exists(), 'a disabled candidate has no SELECT').to.be.false;
  });

  it('emits `change` on a pick — and by itself for a LONE candidate, unless told not to or already answered', async () => {
    const view = table([TARDIGRADES, BACTERIA]);
    const w = picker({input: prompt([TARDIGRADES, BACTERIA]), playerView: view, amount: 2});
    await nextTick();
    await w.find(`[data-test="action-target-${CardName.GHG_PRODUCING_BACTERIA}"] .action-target-card__pick`).trigger('click');
    expect(w.emitted('change')).to.deep.eq([[{type: 'card', cards: [CardName.GHG_PRODUCING_BACTERIA]}]]);

    // The parent owns the selection: the chosen tile wears the selected face.
    await w.setProps({selectedName: CardName.GHG_PRODUCING_BACTERIA});
    const chosen = w.find(`[data-test="action-target-${CardName.GHG_PRODUCING_BACTERIA}"]`);
    expect(chosen.classes()).to.contain('action-target-card__tile--selected');
    expect(chosen.find('.action-target-card__pick').attributes('aria-pressed')).to.eq('true');
    expect(chosen.find('.action-target-card__pick').text()).to.contain('Selected');
    expect(w.find(`[data-test="action-target-${CardName.TARDIGRADES}"] .action-target-card__pick`).text()).to.eq('Select');

    // The candidate set collapsing to one card pre-selects it (the watcher) — but never over an answer.
    await w.setProps({input: prompt([TARDIGRADES])});
    expect(w.emitted('change'), 'already answered').to.have.length(1);
    await w.setProps({selectedName: undefined, input: prompt([BACTERIA])});
    expect(w.emitted('change')?.[1]).to.deep.eq([{type: 'card', cards: [CardName.GHG_PRODUCING_BACTERIA]}]);

    // A lone candidate at the mount: chosen a tick after it.
    const lone = picker({input: prompt([TARDIGRADES]), playerView: view});
    await nextTick();
    expect(lone.emitted('change')).to.deep.eq([[{type: 'card', cards: [CardName.TARDIGRADES]}]]);
    const conscious = picker({input: prompt([TARDIGRADES]), playerView: view, autoSelect: false});
    await nextTick();
    expect(conscious.emitted('change'), 'one side of a larger choice is never pre-committed').to.be.undefined;
    const answered = picker({input: prompt([TARDIGRADES]), playerView: view, selectedName: CardName.TARDIGRADES});
    await nextTick();
    expect(answered.emitted('change')).to.be.undefined;
  });

  it('the card opens FULLSCREEN: the viewer mounts on that card, is shown through the picker\'s own ref, and leaves on `close`', async () => {
    const w = picker({input: prompt([TARDIGRADES, BACTERIA]), playerView: table([TARDIGRADES, BACTERIA])});
    await nextTick();
    expect(w.findComponent(ZoomStub).exists()).to.be.false;

    await w.find(`[data-test="action-target-${CardName.TARDIGRADES}"] .action-target-card__thumb`).trigger('click');
    await nextTick();
    const viewer = w.findComponent(ZoomStub);
    expect(viewer.exists()).to.be.true;
    expect(viewer.props('card')).to.deep.eq(TARDIGRADES);
    expect(shown, 'the mounted viewer was told to show').to.eq(1);
    expect(w.emitted('change'), 'the card zooms — it never selects').to.be.undefined;

    viewer.vm.$emit('close');
    await nextTick();
    expect(w.findComponent(ZoomStub).exists()).to.be.false;
  });
});

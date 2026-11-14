/*
 * CardZoomCard — the fullscreen viewer's card stage. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders for its `card` prop — every kind of entry on its own face, nothing
 * for a name the manifest does not know — and for `selected`. It emits nothing and exposes nothing.
 *
 * The faces are stubbed. `<premium-card-face>` is the LAZY binding the component imports from
 * `components/asyncComponents.ts`: it answers to the async wrapper's own name (RECIPES § 3), and to nothing else.
 *
 * The stage is FOUND (`.card-zoom-card`), never read off `w.classes()`: the template keeps a comment before each
 * later branch of its root `v-if` chain, and a development build renders such a branch as a fragment.
 */
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {BonusCardId, MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {BonusCardContext} from '@/common/automa/BonusCardData';
import {CardModel} from '@/common/models/CardModel';
import {ViewModel} from '@/common/models/PlayerModel';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {setLiveCardResources} from '@/client/components/card/liveCardResources';
import {bonusZoomEntry, marsBotCorpZoomEntry, resolutionZoomEntry, ZoomCard} from '@/client/components/card/cardZoomTypes';
import CardZoomCard from '@/client/components/card/CardZoomCard.vue';

/** RX36 Live Experiments — a resolution of the parliament catalog. */
const LAW = 'RDX_SCIENTISTS_LIVE_EXPERIMENTS';

const PremiumFaceStub = defineComponent({
  name: 'PremiumFaceStub',
  props: {
    card: {type: Object as PropType<CardModel>, default: undefined},
    vmOverride: {type: Object as PropType<PremiumCardVM>, default: undefined},
    tier: {type: String, default: ''},
    inert: {type: Boolean, default: false},
    selected: {type: Boolean, default: false},
  },
  render() {
    return h('i', {'class': 'premium-face-stub'});
  },
});

const BonusFaceStub = defineComponent({
  name: 'BonusCardFace',
  props: {
    id: {type: String as PropType<BonusCardId>, required: true},
    ctx: {type: Object as PropType<BonusCardContext>, required: true},
    large: {type: Boolean, default: false},
  },
  render() {
    return h('i', {'class': 'bonus-face-stub'});
  },
});

const CorpFaceStub = defineComponent({
  name: 'MarsBotCorpFace',
  props: {
    id: {type: String as PropType<MarsBotCorpId>, required: true},
    resources: {type: Number, default: 0},
    resource: {type: String, default: undefined},
    large: {type: Boolean, default: false},
  },
  render() {
    return h('i', {'class': 'corp-face-stub'});
  },
});

function stageOf(card: ZoomCard, selected = false) {
  return mount(CardZoomCard, {
    global: {
      ...globalConfig.global,
      stubs: {BonusCardFace: BonusFaceStub, MarsBotCorpFace: CorpFaceStub, ConsoleTenderCard: true, VaporAsyncComponentWrapper: PremiumFaceStub},
    },
    props: {card, selected},
  });
}

/** One player's tableau as the view the live-resource map is rebuilt from. */
function tableOf(...tableau: Array<CardModel>): ViewModel {
  return {players: [{tableau}]} as unknown as ViewModel;
}

describe('CardZoomCard — one entry of the fullscreen viewer on its own face', () => {
  afterEach(() => setLiveCardResources(undefined));

  it('a project card: the premium face — tier full, inert — with the model it was given; `selected` marks the stage and reaches the face', async () => {
    const w = stageOf({name: CardName.ANTS, resources: 3} as CardModel);
    expect(w.find('.card-zoom-card').classes()).to.include('card-zoom-card--premium');
    expect(w.find('.card-zoom-card').classes()).to.not.include('card-zoom-card--selected');
    const face = w.findComponent(PremiumFaceStub);
    expect(face.props('card')).to.deep.eq({name: CardName.ANTS, resources: 3});
    expect(face.props('vmOverride')).to.eq(undefined);
    expect(face.props('tier')).to.eq('full');
    expect(face.props('inert')).to.eq(true);
    expect(face.props('selected')).to.eq(false);

    await w.setProps({selected: true});
    expect(w.find('.card-zoom-card').classes()).to.include('card-zoom-card--selected');
    expect(w.findComponent(PremiumFaceStub).props('selected')).to.eq(true);
  });

  it('a card shown by name only takes its counter from the live table — 0 when it is not in play, its own value when it carries one', () => {
    expect(stageOf({name: CardName.ANTS} as CardModel).findComponent(PremiumFaceStub).props('card')?.resources, 'not in play').to.eq(0);

    setLiveCardResources(tableOf({name: CardName.ANTS, resources: 5} as CardModel));
    expect(stageOf({name: CardName.ANTS} as CardModel).findComponent(PremiumFaceStub).props('card')?.resources, 'the live count').to.eq(5);
    expect(stageOf({name: CardName.ANTS, resources: 0} as CardModel).findComponent(PremiumFaceStub).props('card')?.resources, 'a real 0 of its own').to.eq(0);
  });

  it('every other kind of entry stands on its own face: a bonus card, a bot corporation, a resolution', () => {
    const ctx: BonusCardContext = {venus: false, colonies: true};
    const bonus = stageOf(bonusZoomEntry(BonusCardId.B01_METEOR_SHOWER, ctx));
    expect(bonus.find('.card-zoom-card').classes()).to.include('card-zoom-card--bonus');
    expect(bonus.findComponent(BonusFaceStub).props()).to.deep.eq({id: BonusCardId.B01_METEOR_SHOWER, ctx, large: true});
    expect(bonus.findComponent(PremiumFaceStub).exists(), 'a bonus card is not a premium face').to.eq(false);

    const corp = stageOf(marsBotCorpZoomEntry(MarsBotCorpId.C02_ECOLINE, 4));
    expect(corp.find('.card-zoom-card').classes()).to.include('card-zoom-card--premium');
    expect(corp.findComponent(CorpFaceStub).props()).to.deep.eq({id: MarsBotCorpId.C02_ECOLINE, resources: 4, resource: undefined, large: true});

    const law = stageOf(resolutionZoomEntry(LAW));
    expect(law.find('.card-zoom-card').classes()).to.include('card-zoom-card--premium');
    const face = law.findComponent(PremiumFaceStub);
    expect(face.props('vmOverride'), 'the catalog\'s own view-model').to.deep.eq(resolutionPremiumVmById(LAW));
    expect(face.props('vmOverride')).to.not.eq(undefined);
    expect(face.props('card'), 'a resolution is never a manifest card').to.eq(undefined);
    expect(face.props('tier')).to.eq('full');
    expect(face.props('inert')).to.eq(true);
  });

  it('a name the manifest does not know renders nothing', () => {
    const w = stageOf({name: 'No Such Card' as CardName} as CardModel);
    expect(w.find('.card-zoom-card').exists()).to.eq(false);
    expect(w.findComponent(PremiumFaceStub).exists()).to.eq(false);
  });
});

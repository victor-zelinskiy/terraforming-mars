import {expect} from 'chai';
import {h} from 'vue';
import {mount, VueWrapper} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {ZoomCard, bonusZoomEntry} from '@/client/components/card/cardZoomTypes';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import CardLoreAside from '@/client/components/card/CardLoreAside.vue';
import ruLore from '../../../../src/locales/ru/lore_texts.json';

const RU_LORE: Readonly<Record<string, string>> = ruLore;

function card(name: CardName): CardModel {
  return {name};
}

const HACKERS = card(CardName.HACKERS);
const AI_CENTRAL = card(CardName.AI_CENTRAL);

/*
 * The card face + the desktop annotation layer are stubbed: this spec is about
 * the viewer's COMPOSITION (which gutter holds what, and whether the card keeps
 * the centre), not about rendering a premium face under JSDOM.
 */
function mountViewer(props: Record<string, unknown>, slots: Record<string, unknown> = {}): VueWrapper<any> {
  return mount(CardZoomModal, {
    props: {card: HACKERS, ...props},
    slots: slots as any,
    global: {
      ...globalConfig.global,
      stubs: {CardZoomCard: true, CardAnnotationsLayer: true},
    },
  });
}

/** A stand-in for the console rules / dossier panel the host passes as `side`. */
const sidePanel = () => h('div', {class: 'test-side'}, 'rules');
const dossierPanel = () => h('div', {class: 'test-dossier'}, [
  h('button', {class: 'tab-rules'}, 'Правила'),
  h('button', {class: 'tab-stats'}, 'Статистика'),
]);

describe('CardZoomModal — archive entry', () => {
  let originalTranslations: unknown;

  beforeEach(() => {
    originalTranslations = (window as any)._translations;
    PreferencesManager.resetForTest();
    PreferencesManager.INSTANCE.set('lang', 'ru');
    (window as any)._translations = {...RU_LORE, 'FROM THE ARCHIVES': 'ЗАПИСЬ ИЗ АРХИВА'};
  });

  afterEach(() => {
    (window as any)._translations = originalTranslations;
    PreferencesManager.resetForTest();
  });

  describe('fullscreen-only rendering', () => {
    it('is absent by default — a plain preview is not a fullscreen inspect', () => {
      const wrapper = mountViewer({});
      expect(wrapper.findComponent(CardLoreAside).exists()).to.eq(false);
      expect(wrapper.find('.card-zoom-lore').exists()).to.eq(false);
      expect(wrapper.find('.card-zoom-midrow').classes()).to.not.include('card-zoom-midrow--flank');
    });

    it('renders in the LEFT gutter when the host opts in', () => {
      const wrapper = mountViewer({lore: true});
      const aside = wrapper.findComponent(CardLoreAside);
      expect(aside.exists()).to.eq(true);
      expect(aside.props('cardName')).to.eq(CardName.HACKERS);
    });

    it('never renders for an Automa bonus entry (not a game card)', () => {
      const bonus = bonusZoomEntry('B01' as any, {} as any);
      const wrapper = mountViewer({lore: true, card: bonus as ZoomCard});
      expect(wrapper.findComponent(CardLoreAside).exists()).to.eq(false);
    });
  });

  describe('strict centring', () => {
    it('switches the row to the symmetric grid whenever a gutter is filled', () => {
      expect(mountViewer({lore: true}).find('.card-zoom-midrow').classes())
        .to.include('card-zoom-midrow--flank');
      expect(mountViewer({}, {side: sidePanel}).find('.card-zoom-midrow').classes())
        .to.include('card-zoom-midrow--flank');
    });

    it('puts the entry BEFORE the stage and the rules panel AFTER it', () => {
      const wrapper = mountViewer({lore: true}, {side: sidePanel});
      const row = wrapper.find('.card-zoom-midrow').element;
      const children = Array.from(row.children).map((el) => el.className);
      const lore = children.findIndex((c) => c.includes('card-zoom-lore'));
      const stage = children.findIndex((c) => c.includes('card-zoom-stage'));
      const side = children.findIndex((c) => c.includes('card-zoom-side'));
      expect(lore).to.be.greaterThan(-1);
      expect(side).to.be.greaterThan(-1);
      expect(lore).to.be.lessThan(stage);
      expect(stage).to.be.lessThan(side);
    });

    it('reserves BOTH gutters symmetrically so the card keeps the centre', () => {
      // The fit engine cannot let one flank overrun the card: with the grid
      // pinning the stage to the middle column, the reservation must mirror.
      const withLore = mountViewer({lore: true}).vm as any;
      const withSide = mountViewer({}, {side: sidePanel}).vm as any;
      const plain = mountViewer({}).vm as any;
      expect(plain.hasFlank).to.eq(false);
      expect(withLore.hasFlank).to.eq(true);
      expect(withSide.hasFlank).to.eq(true);
    });

    it('keeps the rules / statistics panel untouched beside the entry', () => {
      // The blue-card-actions dossier arrives through the `side` slot; adding
      // the entry on the left must not disturb it.
      const wrapper = mountViewer({lore: true}, {side: dossierPanel});
      expect(wrapper.find('.card-zoom-side .test-dossier').exists()).to.eq(true);
      expect(wrapper.find('.card-zoom-side .tab-rules').text()).to.eq('Правила');
      expect(wrapper.find('.card-zoom-side .tab-stats').text()).to.eq('Статистика');
      expect(wrapper.find('.card-zoom-lore').exists()).to.eq(true);
    });
  });

  describe('card browsing (LB / RB)', () => {
    it('re-points the entry to the card on screen', async () => {
      const wrapper = mountViewer({lore: true, cards: [HACKERS, AI_CENTRAL]});
      expect(wrapper.findComponent(CardLoreAside).props('cardName')).to.eq(CardName.HACKERS);

      (wrapper.vm as any).currentIndex = 1;
      await wrapper.vm.$nextTick();
      expect(wrapper.findComponent(CardLoreAside).props('cardName')).to.eq(CardName.AI_CENTRAL);
    });

    it('reveals only on the settle signal, so two entries never overlap', async () => {
      const wrapper = mountViewer({lore: true, cards: [HACKERS, AI_CENTRAL]});
      const aside = wrapper.findComponent(CardLoreAside);
      // The viewer holds the settle nonce at 0 until the card has landed.
      expect(aside.props('nonce')).to.eq(0);
      expect(aside.classes()).to.not.include('card-zoom-lore--in');
      // Whatever the nonce is, the entry always shows the card it is given.
      expect(aside.find('.card-zoom-lore__text').text()).to.include('Крайне неэтично');
    });

    it('hands the close signal down so the entry never lags the departing card', () => {
      const wrapper = mountViewer({lore: true, closing: true});
      expect(wrapper.findComponent(CardLoreAside).props('closing')).to.eq(true);
    });
  });
});

/*
 * CampaignSeatLegacy — «Наследие участника»: the campaign legacy of ONE seat in the frame of the context mission. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its props — the
 * corporations with their mission of origin, the projects carried from the previous mission, the start bonus with an
 * honest status, and the title ledger or (the «Тендеры» mode) the certificates — and where the host's ONE cursor ring
 * (`cursorIndex` over corps → carried → tenders) stands. It emits nothing and exposes nothing.
 *
 * The card face and the tender certificate are stubbed (their own specs' subjects) — this spec reads what each is
 * HANDED.
 */
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {SeatLegacyVm, tpStatusLabel} from '@/client/console/campaign/campaignOverviewModel';
import {TITLE_LABEL, titleArtUrl} from '@/client/console/campaign/titleArt';
import CampaignSeatLegacy from '@/client/components/console/campaign/CampaignSeatLegacy.vue';

const TENDER_NOTE = 'Tenders execute at the finale\'s start; an unexecuted one pays 3 M€';

// (Render functions, not template strings: the runtime compiler is not in this build.)
const CardStub = defineComponent({
  name: 'CardFace',
  props: {
    card: {type: Object as PropType<CardModel>, required: true},
    lightweight: {type: Boolean, default: false},
    inert: {type: Boolean, default: false},
  },
  render() {
    return h('i', {'class': 'card-stub'});
  },
});

const TenderCardStub = defineComponent({
  name: 'ConsoleTenderCard',
  props: {
    id: {type: String, required: true},
    size: {type: String, default: undefined},
    state: {type: String, default: undefined},
    focused: {type: Boolean, default: false},
  },
  render() {
    return h('i', {'class': 'tender-card-stub'});
  },
});

function legacy(over: Partial<SeatLegacyVm> = {}): SeatLegacyVm {
  return {
    seat: 0, name: 'Ada', color: 'red', kind: 'human', isYou: true,
    corps: [], carried: {known: true, count: 0}, titles: [], titlePoints: 0, tpStatus: 'accrues-final',
    rewardMode: 'titles', tenders: [],
    ...over,
  };
}

function seatLegacy(props: {legacy: SeatLegacyVm, carriedModels?: ReadonlyArray<CardModel>, cursorIndex?: number}) {
  return mount(CampaignSeatLegacy, {
    global: {...globalConfig.global, stubs: {Card: CardStub, ConsoleTenderCard: TenderCardStub}},
    props,
  });
}

/** Which slots of a zone wear the cursor. */
function cursors(w: ReturnType<typeof seatLegacy>, zone: string): Array<boolean> {
  return w.findAll(`.cleg__zone--${zone} .cleg__card`).map((c) => c.classes().includes('cleg__card--cursor'));
}

describe('CampaignSeatLegacy — the campaign legacy of one seat', () => {
  it('a titles campaign: corporations with their origin, the carried projects, the bonus and the title ledger — one cursor ring', async () => {
    const w = seatLegacy({
      legacy: legacy({
        corps: [{name: CardName.ECOLINE, missionSlot: undefined}, {name: CardName.HELION, missionSlot: 1}],
        carried: {known: true, count: 2, names: [CardName.ANTS, CardName.BIRDS]},
        bonus: {amount: 5, status: 'pending'},
        titles: [{title: 'governor', missionSlot: 0, titlePoints: 3}],
        titlePoints: 3,
      }),
      cursorIndex: 2,
    });
    expect(w.classes()).to.deep.eq(['cleg']);
    expect(w.findAll('.cleg__cap').map((c) => c.text()))
      .to.deep.eq([$t('Current corporations'), $t('Projects from the previous mission'), $t('Legacy')]);
    expect(w.find('[data-cleg-tenders]').exists(), 'a titles campaign has no certificates').to.eq(false);

    const corps = w.findAll('.cleg__zone--corps .cleg__card');
    expect(corps.map((c) => c.attributes('data-zoom-slot'))).to.deep.eq([`cleg:${CardName.ECOLINE}:0`, `cleg:${CardName.HELION}:1`]);
    expect(corps[0].find('.cleg__origin').exists(), 'an unknown origin wears no badge').to.eq(false);
    expect(corps[1].find('.cleg__origin').text()).to.eq(translateTextWithParams('Mission ${0}', ['2']));

    const carried = w.findAll('.cleg__zone--carried .cleg__card');
    expect(carried.map((c) => c.attributes('data-zoom-slot')), 'the ring goes on after the corporations')
      .to.deep.eq([`cleg:${CardName.ANTS}:2`, `cleg:${CardName.BIRDS}:3`]);
    expect(w.find('.cleg__zone--carried .cleg__note').text()).to.eq(`${$t('Carried from the previous mission')} · ${$t('View only')}`);

    const faces = w.findAllComponents(CardStub);
    expect(faces.map((f) => f.props('card'))).to.deep.eq([{name: CardName.ECOLINE}, {name: CardName.HELION}, {name: CardName.ANTS}, {name: CardName.BIRDS}]);
    expect(faces.every((f) => f.props('lightweight') === true && f.props('inert') === true), 'view-only faces').to.eq(true);

    expect(cursors(w, 'corps')).to.deep.eq([false, false]);
    expect(cursors(w, 'carried')).to.deep.eq([true, false]);
    await w.setProps({cursorIndex: 1});
    expect(cursors(w, 'corps')).to.deep.eq([false, true]);
    expect(cursors(w, 'carried')).to.deep.eq([false, false]);

    const facts = w.findAll('.cleg__zone--facts .cleg__fact');
    expect(facts.map((f) => f.find('.cleg__fact-label').text())).to.deep.eq([$t('Mission start bonus'), $t('Title Points')]);
    expect(facts[0].find('.cleg__fact-value').text()).to.eq('+5 M€');
    expect(facts[0].find('.cleg__fact-status').classes()).to.deep.eq(['cleg__fact-status', 'cleg__fact-status--pending']);
    expect(facts[0].find('.cleg__fact-status').text()).to.eq($t('Awaits the deployment press'));
    expect(facts[1].find('.cleg__fact-value').text()).to.eq(translateTextWithParams('${0} TP', ['3']));
    expect(facts[1].find('.cleg__fact-status').text()).to.eq($t(tpStatusLabel('accrues-final')));

    const title = w.find('.cleg__titles > .cleg__title');
    expect(title.find('img.cleg__title-art').attributes('src')).to.eq(titleArtUrl('governor'));
    expect(title.find('img.cleg__title-art').attributes('alt')).to.eq($t(TITLE_LABEL.governor));
    expect(title.find('.cleg__title-text').text()).to.eq(translateTextWithParams('Governor (mission ${0})', ['1']));
  });

  it('the host\'s live models win over bare names — and every empty zone says what it is empty of', async () => {
    const live = {name: CardName.PETS, resources: 2} as CardModel;
    const w = seatLegacy({legacy: legacy({carried: {known: true, count: 1, names: [CardName.ANTS]}}), carriedModels: [live]});
    expect(w.findAllComponents(CardStub).map((f) => f.props('card')), 'the richer model is the face').to.deep.eq([live]);
    expect(w.find('.cleg__zone--corps .cleg__muted').text()).to.eq($t('No corporations acquired yet'));
    expect(w.find('.cleg__zone--facts .cleg__muted').text()).to.eq($t('No titles earned'));
    expect(w.findAll('.cleg__zone--facts .cleg__fact').length, 'no bonus — no line for it').to.eq(1);

    await w.setProps({legacy: legacy({carried: {known: false, count: 0}}), carriedModels: undefined});
    expect(w.find('.cleg__zone--carried .cleg__muted').text()).to.eq($t('No record in this save'));
    expect(w.find('.cleg__zone--carried .cleg__note').exists()).to.eq(false);

    await w.setProps({legacy: legacy({carried: {known: true, count: 0}})});
    expect(w.find('.cleg__zone--carried .cleg__muted').text()).to.eq($t('Nothing was carried over'));

    await w.setProps({legacy: legacy({carried: {known: true, count: 3}})});
    expect(w.find('.cleg__zone--carried .cleg__muted').text(), 'another seat: the count is known, the names are private')
      .to.eq(translateTextWithParams('${0} cards · hidden', ['3']));

    await w.setProps({legacy: legacy({bonus: {amount: 4, status: 'settled'}})});
    expect(w.find('.cleg__fact-status--settled').text()).to.eq($t('Received'));
  });

  it('the «Тендеры» mode: the holdings as certificates — the ring\'s third stretch, counted after the cards', async () => {
    const tenders = legacy({
      rewardMode: 'tenders',
      corps: [{name: CardName.ECOLINE, missionSlot: 0}],
      carried: {known: true, count: 1, names: [CardName.ANTS]},
      tenders: [
        {instance: 't0-0', id: 'extendedLegacy', wonAtSlot: 0, place: 1, status: 'held'},
        {instance: 't1-0', id: 'openCall', wonAtSlot: 1, place: 2, status: 'executed'},
      ],
    });
    const w = seatLegacy({legacy: tenders, cursorIndex: 3});
    const zone = w.find('.cleg__zone--tenders[data-cleg-tenders]');
    expect(zone.find('.cleg__cap').text()).to.eq($t('Tenders'));
    const slots = zone.findAll('.cleg__tcards > .cleg__tcard');
    expect(slots.map((s) => s.attributes('data-cleg-tender'))).to.deep.eq(['t0-0', 't1-0']);
    expect(slots.map((s) => s.attributes('data-cleg-tender-status'))).to.deep.eq(['held', 'executed']);
    expect(slots.map((s) => s.attributes('data-zoom-slot'))).to.deep.eq(['cleg:tender:t0-0', 'cleg:tender:t1-0']);
    expect(slots.map((s) => s.attributes('data-cleg-tender-focused')), 'two cards stand before them: index 3 is the second').to.deep.eq([undefined, 'yes']);
    expect(slots.map((s) => s.find('.cleg__tline').text()))
      .to.deep.eq([translateTextWithParams('won at mission ${0}', ['1']), translateTextWithParams('won at mission ${0}', ['2'])]);
    expect(w.findAllComponents(TenderCardStub).map((c) => c.props())).to.deep.eq([
      {id: 'extendedLegacy', size: 'table', state: 'held', focused: false},
      {id: 'openCall', size: 'table', state: 'executed', focused: true},
    ]);
    expect(zone.find('.cleg__note').text()).to.eq($t(TENDER_NOTE));

    const facts = w.findAll('.cleg__zone--facts .cleg__fact');
    expect(facts.map((f) => f.find('.cleg__fact-label').text()), 'the ledger counts them — no title points in this mode').to.deep.eq([$t('Tenders')]);
    expect(facts[0].find('.cleg__fact-value').text()).to.eq('2');
    expect(w.find('.cleg__titles').exists()).to.eq(false);

    await w.setProps({legacy: legacy({rewardMode: 'tenders'})});
    expect(w.find('.cleg__zone--tenders .cleg__muted').text()).to.eq($t('No tenders yet'));
    expect(w.find('.cleg__zone--tenders .cleg__note').text(), 'the rule stands with or without a holding').to.eq($t(TENDER_NOTE));
  });
});

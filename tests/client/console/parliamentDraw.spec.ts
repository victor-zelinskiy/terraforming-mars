import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PartyName} from '@/common/turmoil/PartyName';
import {dismissEvent, reconcileDrawnCards} from '@/client/components/drawnCards/drawnCardsState';
import {
  isParliamentDrawSource, noteParliamentDrawPaneIn, noteParliamentDrawPaneOut, PARLIAMENT_DRAW_ZONE, parliamentDrawsSettled,
  parliamentDrawStanding, parliamentDrawState, parliamentDrawTaken, parliamentDrawZone, parliamentOwnsRevealBatch,
  refuseParliamentDraw, resetParliamentDraw, setParliamentDrawHost,
} from '@/client/console/parliament/parliamentDraw';
import {resetRulingChangeDraw, rulingChangeDrawState, rulingChangeParksReveal} from '@/client/console/parliament/rulingChangeDraw';
import ConsoleParliamentDrawStage from '@/client/components/console/parliament/ConsoleParliamentDrawStage.vue';
import {globalConfig} from '../components/getLocalVue';

/*
 * «ПРИЁМКА» (the owner, 2026-11-02): a card drawn in the Parliament is received IN the Parliament — the reveal
 * re-homed into the draw stage, the flow waiting for the take. The module's three facts are kept apart (ownership ·
 * readiness · the net), and the change-of-power park lets its batch go only once the enactment's tail hands it over.
 */
const ruling = {type: 'ruling-change' as const, cardName: CardName.THARSIS_ALLIANCE, party: PartyName.MARS};

function batch(id: number, source: Parameters<typeof isParliamentDrawSource>[0]) {
  return {id, source, segments: [{source, count: 1}], cards: [{name: CardName.FISH} as CardModel]};
}

describe('«ПРИЁМКА» — the Parliament receives its own draws (`parliamentDraw.ts`)', () => {
  afterEach(() => {
    reconcileDrawnCards([]);
    resetParliamentDraw();
    resetRulingChangeDraw();
  });

  it('the families are the Parliament\'s own — a Career step, a card\'s answer to a change of power', () => {
    expect(isParliamentDrawSource({type: 'agenda', step: 7})).is.true;
    expect(isParliamentDrawSource(ruling)).is.true;
    expect(isParliamentDrawSource({type: 'card', cardName: CardName.FISH}), 'a card\'s draw stays its workspace\'s').is.false;
    expect(isParliamentDrawSource({type: 'party', party: PartyName.REDS}), 'a party action is the action workspace\'s').is.false;
    expect(isParliamentDrawSource(undefined)).is.false;
  });

  it('OWNERSHIP needs a standing host, and a refused batch takes the ordinary road', () => {
    const b = batch(5, {type: 'agenda', step: 3});
    expect(parliamentOwnsRevealBatch(b), 'no Parliament on screen — nobody hosts it here').is.false;
    setParliamentDrawHost(1, true);
    setParliamentDrawHost(2, false);
    expect(parliamentOwnsRevealBatch(b), 'a second section saying «no» never erases the first one\'s «yes»').is.true;
    expect(parliamentOwnsRevealBatch(batch(6, {type: 'card', cardName: CardName.FISH}))).is.false;
    refuseParliamentDraw(5, 'spec');
    expect(parliamentOwnsRevealBatch(b), 'the net fired: the ordinary reveal presents it').is.false;
  });

  it('READINESS needs the stage to have entered AND its zone mounted — never a selector alone', async () => {
    expect(parliamentDrawZone()).eq('');
    noteParliamentDrawPaneIn();
    expect(parliamentDrawZone(), 'entered, but no zone in the document').eq('');
    const Host = defineComponent({render: () => h('div', {class: 'con-parl'}, [h(ConsoleParliamentDrawStage, {source: {type: 'agenda', step: 3}})])});
    const wrapper = mount(Host, {...globalConfig, attachTo: document.body});
    await nextTick();
    noteParliamentDrawPaneIn();
    expect(parliamentDrawZone(), 'the stage stands and its zone is mounted').eq(PARLIAMENT_DRAW_ZONE);
    expect(wrapper.find('[data-pdraw-hero]').exists(), 'a Career step has no hero — its cover rises off the step itself').is.false;
    wrapper.unmount();
    expect(parliamentDrawState.paneIn, 'the zone leaves with the stage').is.false;
    expect(parliamentDrawZone()).eq('');
    noteParliamentDrawPaneOut();
  });

  it('a card\'s answer to a change of power stands its card on the hero, with the party that came to power', async () => {
    const Host = defineComponent({render: () => h('div', {class: 'con-parl'}, [h(ConsoleParliamentDrawStage, {source: ruling})])});
    const wrapper = mount(Host, {...globalConfig, attachTo: document.body});
    await nextTick();
    expect(wrapper.find('[data-pdraw-hero]').exists()).is.true;
    expect(wrapper.find('[data-parl-draw]').attributes('data-pdraw-card')).eq(CardName.THARSIS_ALLIANCE);
    expect(wrapper.find('[data-pdraw-why]').exists()).is.true;
    wrapper.unmount();
  });

  it('the change-of-power PARK lets its batch go only once the tail hands it over', () => {
    rulingChangeDrawState.owedKey = '9:9';
    expect(rulingChangeParksReveal(ruling), 'the enactment is still owed').is.true;
    rulingChangeDrawState.owedKey = undefined;
    rulingChangeDrawState.delivering = true;
    expect(rulingChangeParksReveal(ruling), 'the tail plays the alliance\'s impulse first').is.true;
    rulingChangeDrawState.handedOver = true;
    expect(rulingChangeParksReveal(ruling), 'handed over — it presents in the draw stage').is.false;
  });

  it('a STANDING batch is one no park holds back — the flow waits for it, and only for it', () => {
    reconcileDrawnCards([batch(11, ruling)]);
    rulingChangeDrawState.owedKey = '9:9';
    expect(parliamentDrawStanding(), 'parked for the enactment — nothing stands for the player yet').is.false;
    rulingChangeDrawState.owedKey = undefined;
    expect(parliamentDrawStanding()).is.true;
  });

  it('the flow goes on from the TAKE — the batch leaving the queue resolves both waits', async () => {
    reconcileDrawnCards([batch(12, {type: 'agenda', step: 7})]);
    let settled = false;
    let taken = false;
    void parliamentDrawsSettled().then(() => {
      settled = true;
    });
    void parliamentDrawTaken(12).then(() => {
      taken = true;
    });
    await nextTick();
    expect(settled || taken, 'the card still stands for the player').is.false;
    dismissEvent(12);
    await Promise.resolve();
    await Promise.resolve();
    expect(settled, 'nothing of the Parliament\'s stands any more').is.true;
    expect(taken).is.true;
  });
});

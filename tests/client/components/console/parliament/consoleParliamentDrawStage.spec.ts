import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PartyName} from '@/common/turmoil/PartyName';
import {$t} from '@/client/directives/i18n';
import {embedZoneMounted} from '@/client/console/embedZoneRegistry';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {noteParliamentDrawPaneIn, parliamentDrawState, resetParliamentDraw} from '@/client/console/parliament/parliamentDraw';
import ConsoleParliamentDrawStage from '@/client/components/console/parliament/ConsoleParliamentDrawStage.vue';

// The hero's face is the premium card — its own specs' subject; this one reads what the stage HANDS it.
// (A render function, not a template string: the runtime compiler is not in this build.)
const CardStub = defineComponent({name: 'CardFace', props: ['card', 'lightweight', 'inert'], render: () => h('i', {class: 'card-stub'})});

/** The stage's own slot (the shell's zone selector also names the Parliament's root above it). */
const ZONE = '[data-embed-slot="parliament-draw"]';

const career = {type: 'agenda' as const, step: 3};
const ruling = {type: 'ruling-change' as const, cardName: CardName.THARSIS_ALLIANCE, party: PartyName.MARS};

function stage(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  return mount(ConsoleParliamentDrawStage as any, {
    ...globalConfig,
    props,
    attrs,
    attachTo: document.body,
    global: {...globalConfig.global, stubs: {Card: CardStub}},
  });
}

describe('ConsoleParliamentDrawStage — «ПРИЁМКА»: the Parliament\'s draw stage', () => {
  afterEach(() => {
    resetParliamentDraw();
  });

  it('a Career step needs no hero — the zone takes the stage', () => {
    const w = stage({source: career});
    expect(w.classes()).to.include.members(['con-pdraw', 'con-pdraw--solo']);
    expect(w.attributes('data-parl-draw')).to.not.eq(undefined);
    expect(w.attributes('data-pdraw-source')).to.eq('agenda');
    expect(w.attributes('data-pdraw-card'), 'no card drew').to.eq(undefined);
    expect(w.find('[data-pdraw-hero]').exists()).to.eq(false);
    expect(w.find('.card-stub').exists()).to.eq(false);
    expect(w.find('[data-pdraw-zone] .con-pdraw__embed' + ZONE).exists(), 'the zone the reveal is teleported into').to.eq(true);
  });

  it('stands with no source at all — an empty kind, the zone alone', () => {
    const w = stage({});
    expect(w.attributes('data-pdraw-source')).to.eq('');
    expect(w.classes()).to.contain('con-pdraw--solo');
    expect(w.find(ZONE).exists()).to.eq(true);
  });

  it('a card\'s answer to a change of power stands the card on the hero, with the party that came to power', () => {
    const w = stage({source: ruling});
    expect(w.classes()).to.not.contain('con-pdraw--solo');
    expect(w.attributes('data-pdraw-source')).to.eq('ruling-change');
    expect(w.attributes('data-pdraw-card')).to.eq(CardName.THARSIS_ALLIANCE);
    expect(w.find('[data-pdraw-hero] .con-pdraw__face').attributes('data-reaction-home')).to.eq(CardName.THARSIS_ALLIANCE);
    // With no live model the face is the card by its name alone — lightweight, inert.
    const face = w.findComponent(CardStub);
    expect(face.props('card')).to.deep.eq({name: CardName.THARSIS_ALLIANCE});
    expect(face.props('lightweight')).to.eq(true);
    expect(face.props('inert')).to.eq(true);
    const why = w.find('[data-pdraw-why]');
    expect(why.find('img.con-pdraw__emblem').attributes('src')).to.eq(partyEmblemUrl(PartyName.MARS));
    expect(why.find('.con-pdraw__party').text()).to.eq($t(partyNameKey(PartyName.MARS)));
    expect(why.find('.con-pdraw__rule').text()).to.eq($t('came to power'));
    expect(w.find(ZONE).exists(), 'the zone stands beside the hero').to.eq(true);
  });

  it('the hero wears the viewer\'s LIVE model when the host has one', () => {
    const live = {name: CardName.THARSIS_ALLIANCE, resources: 2} as CardModel;
    const w = stage({source: ruling, heroLive: live});
    expect(w.findComponent(CardStub).props('card')).to.deep.eq(live);
  });

  it('names no party the Redux table does not seat — the hero stands without its «why»', () => {
    const w = stage({source: {...ruling, party: PartyName.KELVINISTS}});
    expect(w.find('[data-pdraw-hero]').exists()).to.eq(true);
    expect(w.find('[data-pdraw-why]').exists()).to.eq(false);
  });

  it('follows its source — the same stage, a Career step and then a card\'s answer', async () => {
    const w = stage({source: career});
    expect(w.find('[data-pdraw-hero]').exists()).to.eq(false);
    await w.setProps({source: ruling});
    expect(w.find('[data-pdraw-hero]').exists()).to.eq(true);
    expect(w.attributes('data-pdraw-card')).to.eq(CardName.THARSIS_ALLIANCE);
    expect(w.classes()).to.not.contain('con-pdraw--solo');
  });

  it('the template STARTS WITH ITS ROOT — what a host lets fall through lands on the stage itself', () => {
    const w = stage({source: career}, {'class': 'from-host', 'data-from-host': 'yes'});
    expect((w.element as HTMLElement).tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['con-pdraw', 'from-host']);
    expect(w.attributes('data-from-host')).to.eq('yes');
  });

  it('its zone REGISTERS while the stage stands and UNREGISTERS with it — and the pane is out', () => {
    expect(embedZoneMounted(ZONE), 'no stage — no zone').to.eq(false);
    const w = stage({source: career});
    expect(embedZoneMounted(ZONE), 'the stage stands: its zone is a registered, connected node').to.eq(true);
    noteParliamentDrawPaneIn();
    expect(parliamentDrawState.paneIn).to.eq(true);
    w.unmount();
    expect(embedZoneMounted(ZONE), 'the zone leaves with the stage').to.eq(false);
    expect(parliamentDrawState.paneIn, 'the reveal may no longer be teleported here').to.eq(false);
  });
});

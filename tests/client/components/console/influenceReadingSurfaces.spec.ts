import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {Color} from '@/common/Color';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import ConsoleParliamentAgenda from '@/client/components/console/parliament/ConsoleParliamentAgenda.vue';
import ConsoleParliamentCareerDossier from '@/client/components/console/parliament/ConsoleParliamentCareerDossier.vue';
import ConsoleInfluenceMod from '@/client/components/console/parliament/ConsoleInfluenceMod.vue';
import {agendaViewOf, buildParliamentView} from '@/client/console/parliament/consoleParliamentModel';
import {influenceReadingOf} from '@/client/console/parliament/influenceReading';

/*
 * T05 Event Analysts — THE FINAL INFLUENCE IS PRINTED EVERYWHERE, the modifier «+N» beside it says what stands beyond
 * the Career, and «level N» stays the reward of a cell of the track. The surfaces read ONE reading
 * (`influenceReading.ts`) — a seat whose influence is the track's alone looks exactly as before.
 */
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

function seat(color: Color, agenda: number, influence: number, sources?: ParliamentPlayerModel['influenceSources']): ParliamentPlayerModel {
  return {
    color, participates: true, lobby: true, reserve: 6, onResolutions: 0, chairman: false, agenda, influence,
    access: [], partyActionUses: {}, resolutionActionUses: 0, ...(sources === undefined ? {} : {influenceSources: sources}),
  };
}

function model(players: ReadonlyArray<ParliamentPlayerModel>): ParliamentModel {
  return {
    slots: [], rulingParty: PartyName.SCIENTISTS, popularSupport: {}, deckSize: 9, discardSize: 0, neutralSupply: 14, botMode: 'none',
    players: [...players],
    viewer: {vote: {available: true, reason: '', source: 'lobby', cost: 0, projections: []}, partyActions: []},
  };
}

const EVENT_ANALYSTS = [{amount: 1, source: 'Event Analysts'}];

describe('the final influence on the Career track (T05)', () => {
  function mountAgenda(players: ReadonlyArray<ParliamentPlayerModel>) {
    const m = model(players);
    const vm = buildParliamentView(m, BLUE, [{color: BLUE, name: 'Blue'}, {color: RED, name: 'Red'}] as never);
    return mount(ConsoleParliamentAgenda, {...globalConfig, props: {view: vm, model: m, agendaVm: agendaViewOf(vm), viewerParticipates: true}});
  }

  it('the head reads «3 = [insignia] 2 +1»; every span and every coin of the scale prints the FINAL influence (level + 1), green, no tab', () => {
    const wrapper = mountAgenda([seat(BLUE, 3, 3, EVENT_ANALYSTS), seat(RED, 5, 3)]);
    expect(wrapper.find('[data-parl-influence]').text()).eq('3');
    expect(wrapper.find('[data-parl-influence-track]').text()).eq('2');
    const headMod = wrapper.find('[data-parl-influence-sum] [data-inf-mod]');
    expect(headMod.text()).eq('+1');
    expect(headMod.attributes('data-hint'), 'the hint names the giver').contains('Event Analysts');
    expect(headMod.attributes('title'), 'never the native title').is.undefined;
    const mine = wrapper.find('.con-parl__inf-band--mine');
    expect(mine.attributes('data-parl-inf-band'), 'the ring stays on the LEVEL\'s span').eq('2');
    expect(mine.find('[data-parl-inf-band-value]').text()).eq('3');
    expect(mine.find('[data-inf-mod]').exists(), 'the scale carries no «+N» tab — the head reads the sum').is.false;
    const others = wrapper.findAll('.con-parl__inf-band:not(.con-parl__inf-band--mine)');
    expect(others.length).greaterThan(3);
    for (const band of others) {
      expect(band.find('[data-parl-inf-band-value]').text(), 'another span prints its level + the bonus').eq(String(Number(band.attributes('data-parl-inf-band')) + 1));
      expect(band.find('[data-parl-inf-band-value]').attributes('data-parl-inf-band-buffed'), 'the lifted number is marked').eq('');
      expect(band.find('[data-inf-mod]').exists()).is.false;
    }
    const coins = wrapper.findAll('.con-parl__step-level');
    expect(coins.length).greaterThan(3);
    for (const coin of coins) {
      expect(coin.classes(), 'a coin under a bonus is green').to.include('con-parl__step-level--buffed');
      expect(coin.text()).eq(coin.attributes('data-parl-step-influence'));
    }
    expect(coins.map((c) => c.text())[0], 'the first ★ step (level 1) votes with 2').eq('2');
    wrapper.unmount();
  });

  it('a seat with no bonus: no sum, no modifier — the head and the span read as before', () => {
    const wrapper = mountAgenda([seat(BLUE, 3, 2)]);
    expect(wrapper.find('[data-parl-influence]').text()).eq('2');
    expect(wrapper.find('[data-parl-influence-sum]').exists()).is.false;
    expect(wrapper.find('[data-inf-mod]').exists()).is.false;
    expect(wrapper.find('.con-parl__inf-band--mine [data-parl-inf-band-value]').text()).eq('2');
    expect(wrapper.find('[data-parl-inf-band-buffed]').exists(), 'no bonus — no lifted number').is.false;
    expect(wrapper.find('.con-parl__step-level--buffed').exists()).is.false;
    expect(wrapper.findAll('.con-parl__step-level').map((c) => c.text())[0], 'the first ★ step reads its own level').eq('1');
    wrapper.unmount();
  });
});

describe('the Career dossier — every seat\'s final influence (T05)', () => {
  it('the seat with a bonus reads «3 +1», the rival without one reads its number alone', () => {
    const m = model([seat(BLUE, 3, 3, EVENT_ANALYSTS), seat(RED, 5, 3)]);
    const vm = buildParliamentView(m, BLUE, [{color: BLUE, name: 'Blue'}, {color: RED, name: 'Red'}] as never);
    const wrapper = mount(ConsoleParliamentCareerDossier, {...globalConfig, props: {view: vm, viewerColor: BLUE}});
    const blue = wrapper.find(`[data-parl-cd-seat="${BLUE}"]`);
    expect(blue.find('[data-parl-cd-influence]').text()).eq('3');
    expect(blue.find('[data-inf-mod]').text()).eq('+1');
    const red = wrapper.find(`[data-parl-cd-seat="${RED}"]`);
    expect(red.find('[data-parl-cd-influence]').text()).eq('3');
    expect(red.find('[data-inf-mod]').exists()).is.false;
    wrapper.unmount();
  });
});

describe('ConsoleInfluenceMod', () => {
  it('renders only for a bonus, names an unnamed giver as «other»', () => {
    const none = mount(ConsoleInfluenceMod, {...globalConfig, props: {reading: influenceReadingOf({influence: 2, agenda: 3})}});
    expect(none.find('[data-inf-mod]').exists()).is.false;
    none.unmount();
    const two = mount(ConsoleInfluenceMod, {...globalConfig, props: {reading: influenceReadingOf({influence: 4, agenda: 3, influenceSources: [{amount: 1, source: 'Event Analysts'}, {amount: 1}]})}});
    expect(two.find('[data-inf-mod]').text()).eq('+2');
    expect(two.find('[data-inf-mod]').attributes('data-inf-mod-amount')).eq('2');
    expect(two.find('[data-inf-mod]').attributes('data-hint')).match(/Event Analysts \+1 · .+ \+1/);
    two.unmount();
  });
});

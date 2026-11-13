/*
 * CampaignMissionResults — «Итоги миссии»: the committed facts of one finished mission. A `<script setup>` component
 * (step A of docs/claude/vapor/RECIPES.md): what it renders for its props — the place-ordered standings with the
 * historic corporations, a title's emblem and TP or a tender's chip, and the legacy the result formed for the NEXT
 * mission (start bonus, carried projects — with an honest word for «no record», «still being chosen» and «nothing»).
 * It emits nothing and exposes nothing.
 *
 * The card face is stubbed (the premium renderer is its own specs' subject) — this spec reads what each carried card
 * is HANDED; the tender chip renders for real.
 */
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {marsBotCorpInfo} from '@/common/automa/MarsBotCorpData';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {MissionDetailsRow, MissionDetailsVm, MissionOutgoingLegacy} from '@/client/console/campaign/campaignOverviewModel';
import {TITLE_LABEL, titleArtUrl} from '@/client/console/campaign/titleArt';
import CampaignMissionResults from '@/client/components/console/campaign/CampaignMissionResults.vue';

// (A render function, not a template string: the runtime compiler is not in this build.)
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

function details(over: Partial<MissionDetailsVm> = {}): MissionDetailsVm {
  return {slot: 0, board: BoardName.THARSIS, final: false, generations: 9, rows: [], championSeats: [], ...over};
}

function row(over: Partial<MissionDetailsRow>): MissionDetailsRow {
  return {seat: 0, place: 1, tied: false, color: 'red', name: 'Ada', isBot: false, score: 60, megaCredits: 0, corporations: [], ...over};
}

function outgoing(carried: MissionOutgoingLegacy['carried'], bonuses: MissionOutgoingLegacy['bonuses'] = []): MissionOutgoingLegacy {
  return {nextSlot: 1, bonuses, carried};
}

function results(props: {details: MissionDetailsVm, youSeat?: number, botCorporation?: MarsBotCorpId}) {
  return mount(CampaignMissionResults, {global: {...globalConfig.global, stubs: {Card: CardStub}}, props});
}

describe('CampaignMissionResults — the committed facts of one mission', () => {
  it('the standings: place, seat, the historic corporations, a title or a tender, the score — the viewer\'s row marked', () => {
    const w = results({
      details: details({rows: [
        row({seat: 1, place: 1, color: 'blue', name: 'Ada', score: 71, corporations: [CardName.ECOLINE, CardName.HELION], title: {title: 'governor', titlePoints: 3}}),
        row({
          seat: 0, place: 2, tied: true, color: 'red', name: 'raw-bot-save-name', isBot: true, score: 64,
          dividends: {holdings: [CardName.THORGATE], vp: 4}, tender: 'extendedLegacy',
        }),
      ]}),
      youSeat: 1,
      botCorporation: MarsBotCorpId.C01_CREDICOR,
    });
    expect(w.classes()).to.deep.eq(['cmres']);
    const rows = w.findAll('.cmres__rows > .cmres__row');
    expect(rows.map((r) => r.classes().includes('cmres__row--you'))).to.deep.eq([true, false]);
    expect(rows.map((r) => r.find('.cmres__place').text())).to.deep.eq(['1', '2']);
    expect(rows.map((r) => r.find('.cmres__cube').classes()[1])).to.deep.eq(['player_bg_color_blue', 'player_bg_color_red']);
    expect(rows.map((r) => r.find('.cmres__score').text())).to.deep.eq([`71 ${$t('VP')}`, `64 ${$t('VP')}`]);

    expect(rows[0].find('.cmres__name').text()).to.eq('Ada');
    expect(rows[0].find('.cmres__tied').exists()).to.eq(false);
    expect(rows[1].find('.cmres__name').text(), 'the bot never prints its raw save name').to.contain(participantDisplayName({name: 'raw-bot-save-name', isMarsBot: true}));
    expect(rows[1].find('.cmres__name').text()).to.not.contain('raw-bot-save-name');
    expect(rows[1].find('.cmres__tied').text()).to.eq($t('shared place'));

    expect(rows[0].findAll('.cmres__corp').map((c) => c.text()), 'a player\'s row never wears the bot\'s corporation')
      .to.deep.eq([$t(CardName.ECOLINE), $t(CardName.HELION)]);
    const botCorps = rows[1].findAll('.cmres__corp');
    expect(botCorps.map((c) => c.text())).to.deep.eq([$t(marsBotCorpInfo(MarsBotCorpId.C01_CREDICOR).original), $t(CardName.THORGATE)]);
    expect(botCorps.map((c) => c.attributes('data-bot-holding')), 'a holding is marked, the identity is not').to.deep.eq([undefined, 'true']);

    const emblem = rows[0].find('img.cmres__title');
    expect(emblem.attributes('src')).to.eq(titleArtUrl('governor'));
    expect(emblem.attributes('alt')).to.eq($t(TITLE_LABEL.governor));
    expect(rows[0].find('.cmres__tp').text()).to.eq(`+3 ${$t('TP')}`);
    expect(rows[0].find('.cmres__tender').exists()).to.eq(false);
    expect(rows[1].find('.cmres__tender').attributes('data-cmap-tender')).to.eq('extendedLegacy');
    expect(rows[1].find('.cmres__title').exists()).to.eq(false);

    expect(w.find('.cmres__gens').text()).to.eq(translateTextWithParams('Generations: ${0}', ['9']));
    expect(w.find('.cmres__legacy-head').exists(), 'no outgoing legacy — no block for it').to.eq(false);
  });

  it('the legacy it formed: the start bonus, who carried how many — and the viewer\'s own carried cards as faces', () => {
    const w = results({details: details({outgoing: outgoing(
      {
        known: true,
        pending: false,
        bySeat: [{seat: 0, color: 'red', name: 'Ada', count: 2}, {seat: 1, color: 'blue', name: 'Lin', count: 0}],
        yourCards: [CardName.ANTS, CardName.BIRDS],
      },
      [{seat: 0, color: 'red', name: 'Ada', megaCredits: 5}],
    )})});
    expect(w.find('.cmres__legacy-head').text()).to.eq(translateTextWithParams('Legacy for mission ${0}', ['2']));
    const lines = w.findAll('.cmres__legacy > .cmres__legacy-line');
    expect(lines.map((l) => l.find('.cmres__legacy-cap').text())).to.deep.eq([$t('Start bonus'), $t('Legacy projects')]);

    const bonuses = lines[0].findAll('.cmres__bonus');
    expect(bonuses.map((b) => b.text())).to.deep.eq(['+5 M€']);
    expect(bonuses[0].find('.cmres__cube').classes()).to.include.members(['cmres__cube--sm', 'player_bg_color_red']);

    const carried = lines[1].findAll('.cmres__carry');
    expect(carried.map((c) => c.text()), 'a seat that carried nothing is not a row').to.deep.eq([translateTextWithParams('cards: ${0}', ['2'])]);
    expect(lines[1].find('.cmres__muted').exists()).to.eq(false);

    expect(w.findAll('.cmres__cards > .cmres__card').map((c) => c.attributes('data-zoom-slot')))
      .to.deep.eq([`cmres:${CardName.ANTS}:0`, `cmres:${CardName.BIRDS}:1`]);
    const faces = w.findAllComponents(CardStub);
    expect(faces.map((f) => f.props('card'))).to.deep.eq([{name: CardName.ANTS}, {name: CardName.BIRDS}]);
    expect(faces.map((f) => [f.props('lightweight'), f.props('inert')])).to.deep.eq([[true, true], [true, true]]);
  });

  it('an honest word for each non-answer: no record, still being chosen, nothing carried', async () => {
    const w = results({details: details({outgoing: outgoing({known: false, pending: false, bySeat: []})})});
    expect(w.findAll('.cmres__legacy > .cmres__legacy-line').length, 'no bonus was assigned — no line for it').to.eq(1);
    expect(w.find('.cmres__muted').text()).to.eq($t('No record in this save'));
    expect(w.find('.cmres__cards').exists()).to.eq(false);

    await w.setProps({details: details({outgoing: outgoing({known: true, pending: true, bySeat: [{seat: 0, color: 'red', name: 'Ada', count: 2}]})})});
    expect(w.find('.cmres__muted').text()).to.eq($t('The carryover is still being chosen'));
    expect(w.find('.cmres__carry').exists(), 'never presented as a done transfer').to.eq(false);

    await w.setProps({details: details({outgoing: outgoing({known: true, pending: false, bySeat: [{seat: 0, color: 'red', name: 'Ada', count: 0}]})})});
    expect(w.find('.cmres__muted').text()).to.eq($t('Nothing was carried over'));
  });
});

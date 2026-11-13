/*
 * CampaignMissionInspect — «Осмотр миссии»: one body for inspecting ANY mission of the route. A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md): what it renders for its props — the enlarged board as the hero
 * with the rolled conditions named in full, and a detail half that follows the mission's STATE: what is known ahead,
 * the live facts of a mission in progress, the committed results. It emits nothing and exposes nothing.
 *
 * The board miniature, the modifier badge and the results body are stubbed (their own specs' subjects) — this spec
 * reads what the inspect HANDS them.
 */
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import {BoardName} from '@/common/boards/BoardName';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {mapLabelKey, mapMeta} from '@/client/components/create/premium/createGameMeta';
import {MissionDetailsVm, OverviewMissionCard} from '@/client/console/campaign/campaignOverviewModel';
import {MissionModifierMeta, missionModifierMetas} from '@/client/console/campaign/missionModifierMeta';
import CampaignMissionInspect from '@/client/components/console/campaign/CampaignMissionInspect.vue';

const AHEAD_NOTE = 'The board and its printed bonuses are known ahead — the outcome is not';
const SHUFFLED_NOTE = 'The board is known ahead — its bonuses are shuffled at the launch, the outcome is not';
const LIVE_NOTE = 'The mission is being played right now — its results will appear here';

const MapStub = defineComponent({
  name: 'PremiumMapFingerprint',
  props: {
    mapId: {type: String, default: undefined},
    variant: {type: String, default: undefined},
    accent: {type: String, default: undefined},
    reveal: {type: Boolean, default: false},
  },
  render() {
    return h('i', {'class': 'map-stub'});
  },
});

const BadgeStub = defineComponent({
  name: 'CampaignModifierBadge',
  props: {
    meta: {type: Object as PropType<MissionModifierMeta>, required: true},
    stamp: {type: Boolean, default: false},
  },
  render() {
    return h('i', {'class': 'badge-stub'});
  },
});

const ResultsStub = defineComponent({
  name: 'CampaignMissionResults',
  props: {
    details: {type: Object as PropType<MissionDetailsVm>, required: true},
    youSeat: {type: Number, default: undefined},
    botCorporation: {type: String, default: undefined},
  },
  render() {
    return h('i', {'class': 'results-stub'});
  },
});

function mission(over: Partial<OverviewMissionCard> = {}): OverviewMissionCard {
  return {slot: 1, board: BoardName.ELYSIUM, final: false, state: 'locked', isCurrent: false, modifiers: [], ...over};
}

type InspectProps = {
  mission: OverviewMissionCard,
  details?: MissionDetailsVm,
  youSeat?: number,
  botCorporation?: MarsBotCorpId,
  liveGeneration?: number,
  party?: ReadonlyArray<{color: string, name: string}>,
  missionCount?: number,
};

function inspect(props: InspectProps) {
  return mount(CampaignMissionInspect, {
    global: {
      ...globalConfig.global,
      stubs: {PremiumMapFingerprint: MapStub, CampaignModifierBadge: BadgeStub, CampaignMissionResults: ResultsStub},
    },
    props,
  });
}

describe('CampaignMissionInspect — one body for any mission of the route', () => {
  it('a mission ahead: the board as the hero, its place in the route, and only what is honestly known', async () => {
    const w = inspect({mission: mission()});
    expect(w.classes()).to.deep.eq(['cminsp', 'cminsp--locked']);
    expect(w.findComponent(MapStub).props()).to.deep.eq({
      mapId: BoardName.ELYSIUM, variant: 'hero', accent: mapMeta(BoardName.ELYSIUM).accent, reveal: false,
    });
    expect(w.find('.cminsp__board-name').text()).to.eq($t(mapLabelKey(BoardName.ELYSIUM)));
    expect(w.find('.cminsp__final').exists()).to.eq(false);
    expect(w.find('.cminsp__state').classes()).to.deep.eq(['cminsp__state', 'cminsp__state--locked']);
    expect(w.find('.cminsp__state').text()).to.eq($t('Ahead'));
    expect(w.find('.cminsp__mods').exists()).to.eq(false);

    const facts = w.findAll('.cminsp__detail .cminsp__fact');
    expect(facts.length).to.eq(1);
    expect(facts[0].find('.cminsp__fact-label').text()).to.eq($t('Mission'));
    expect(facts[0].find('.cminsp__fact-value').text(), 'slot 1 of the default four').to.eq(translateTextWithParams('Mission ${0} of ${1}', ['2', '4']));
    expect(w.find('.cminsp__note').text()).to.eq($t(AHEAD_NOTE));
    expect(w.find('.results-stub').exists()).to.eq(false);

    await w.setProps({mission: mission({slot: 2, final: true}), missionCount: 3});
    expect(w.find('.cminsp__final').text()).to.eq($t('Finale'));
    const finale = w.findAll('.cminsp__detail .cminsp__fact');
    expect(finale.length, 'the finale adds its own fact').to.eq(2);
    expect(finale[0].find('.cminsp__fact-value').text()).to.eq(translateTextWithParams('Mission ${0} of ${1}', ['3', '3']));
    expect(finale[1].find('.cminsp__fact-note').text()).to.eq($t('Titles and corporations count into this mission’s VP'));
  });

  it('the rolled conditions are named in full — and a shuffled board never promises its printed bonuses', () => {
    const w = inspect({mission: mission({modifiers: [{id: 'randomMA'}, {id: 'shuffleMap'}]})});
    const metas = missionModifierMetas([{id: 'randomMA'}, {id: 'shuffleMap'}]);
    const mods = w.findAll('.cminsp__mods > .cminsp__mod');
    expect(mods.length).to.eq(2);
    expect(w.findAllComponents(BadgeStub).map((b) => b.props('meta').id)).to.deep.eq(['randomMA', 'shuffleMap']);
    expect(w.findAllComponents(BadgeStub).map((b) => b.props('stamp')), 'no reveal replay inside the inspect').to.deep.eq([false, false]);
    expect(mods.map((m) => m.find('.cminsp__mod-name').text())).to.deep.eq(metas.map((m) => $t(m.labelKey)));
    expect(mods.map((m) => m.find('.cminsp__mod-desc').text())).to.deep.eq(metas.map((m) => $t(m.descKey)));
    expect(w.find('.cminsp__note').text()).to.eq($t(SHUFFLED_NOTE));
  });

  it('a mission in progress: the live facts — the generation and who is on the board — and no results yet', () => {
    const w = inspect({
      mission: mission({state: 'active', isCurrent: true}),
      liveGeneration: 6,
      party: [{color: 'red', name: 'Ada'}, {color: 'blue', name: 'MarsBot'}],
    });
    expect(w.classes()).to.deep.eq(['cminsp', 'cminsp--active']);
    expect(w.find('.cminsp__state').text()).to.eq($t('Mission in progress'));
    const facts = w.findAll('.cminsp__detail .cminsp__fact');
    expect(facts.map((f) => f.find('.cminsp__fact-label').text())).to.deep.eq([$t('Generation'), $t('Participants')]);
    expect(facts[0].find('.cminsp__fact-value').text()).to.eq('6');
    const chips = facts[1].findAll('.cminsp__party-chip');
    expect(chips.map((c) => c.text())).to.deep.eq(['Ada', 'MarsBot']);
    expect(chips.map((c) => c.find('.cminsp__party-cube').classes()[1])).to.deep.eq(['player_bg_color_red', 'player_bg_color_blue']);
    expect(w.find('.cminsp__note').text()).to.eq($t(LIVE_NOTE));
    expect(w.find('.results-stub').exists()).to.eq(false);
  });

  it('a committed mission hands its results to the shared body — and without them falls back to what is known', async () => {
    const details: MissionDetailsVm = {slot: 0, board: BoardName.THARSIS, final: false, generations: 9, rows: [], championSeats: []};
    const committed = mission({slot: 0, board: BoardName.THARSIS, state: 'committed'});
    const w = inspect({mission: committed, details, youSeat: 1, botCorporation: MarsBotCorpId.C01_CREDICOR});
    expect(w.classes()).to.deep.eq(['cminsp', 'cminsp--committed']);
    expect(w.find('.cminsp__state').text()).to.eq($t('Mission complete'));
    const results = w.findComponent(ResultsStub);
    expect(results.props('details')).to.deep.eq(details);
    expect(results.props('youSeat')).to.eq(1);
    expect(results.props('botCorporation')).to.eq(MarsBotCorpId.C01_CREDICOR);
    expect(w.find('.cminsp__detail .cminsp__fact').exists(), 'the results are the whole detail half').to.eq(false);
    expect(w.find('.cminsp__note').exists()).to.eq(false);

    await w.setProps({details: undefined});
    expect(w.find('.results-stub').exists(), 'an old save with no record').to.eq(false);
    expect(w.find('.cminsp__note').text()).to.eq($t(AHEAD_NOTE));
  });
});

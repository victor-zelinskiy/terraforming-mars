/*
 * CampaignMissionCard — ONE mission card of the campaign route (the Campaign Map and the in-game overview share it). A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its props — the board's
 * miniature and name, the state's word and dressing, the rolled conditions as badges sealed in turn by the route's
 * reveal, and a committed mission's podium strip. It emits nothing and exposes nothing.
 *
 * The board miniature and the modifier badge are stubbed (their own specs' subjects) — this spec reads what the card
 * HANDS them; the tender chip of a podium row renders for real.
 */
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../../getLocalVue';
import {BoardName} from '@/common/boards/BoardName';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {mapLabelKey, mapMeta} from '@/client/components/create/premium/createGameMeta';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {OverviewMissionCard} from '@/client/console/campaign/campaignOverviewModel';
import {MissionModifierMeta} from '@/client/console/campaign/missionModifierMeta';
import {TITLE_LABEL, titleArtUrl} from '@/client/console/campaign/titleArt';
import CampaignMissionCard from '@/client/components/console/campaign/CampaignMissionCard.vue';

const MapStub = defineComponent({
  name: 'PremiumMapFingerprint',
  props: {
    mapId: {type: String, default: undefined},
    variant: {type: String, default: undefined},
    accent: {type: String, default: undefined},
    reveal: {type: Boolean, default: false},
    revealDelayMs: {type: Number, default: 0},
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
    stampDelayMs: {type: Number, default: 0},
  },
  render() {
    return h('i', {'class': 'badge-stub'});
  },
});

function mission(over: Partial<OverviewMissionCard> = {}): OverviewMissionCard {
  return {slot: 1, board: BoardName.ELYSIUM, final: false, state: 'locked', isCurrent: false, modifiers: [], ...over};
}

function card(props: {mission: OverviewMissionCard, cursor?: boolean, reveal?: boolean, revealDelayMs?: number}) {
  return mount(CampaignMissionCard, {
    global: {...globalConfig.global, stubs: {PremiumMapFingerprint: MapStub, CampaignModifierBadge: BadgeStub}},
    props,
  });
}

describe('CampaignMissionCard — one mission of the campaign route', () => {
  it('a mission ahead: the board\'s miniature and name, the state\'s word — no banner, no badges, no results', () => {
    const w = card({mission: mission()});
    expect(w.classes()).to.deep.eq(['ccard', 'ccard--future']);
    expect(w.find('.ccard__final-banner').exists()).to.eq(false);
    expect(w.findComponent(MapStub).props()).to.deep.eq({
      mapId: BoardName.ELYSIUM, variant: 'card', accent: mapMeta(BoardName.ELYSIUM).accent, reveal: false, revealDelayMs: 0,
    });
    expect(w.find('.ccard__mods').exists(), 'no rolled condition — no layer for them').to.eq(false);
    expect(w.find('.ccard__board-name').text()).to.eq($t(mapLabelKey(BoardName.ELYSIUM)));
    expect(w.find('.ccard__state').classes()).to.deep.eq(['ccard__state', 'ccard__state--locked']);
    expect(w.find('.ccard__state').text()).to.eq($t('Ahead'));
    expect(w.find('.ccard__results').exists()).to.eq(false);
  });

  it('the state dresses the root and words the line: the next mission, the one in progress, the finale under the cursor', async () => {
    const w = card({mission: mission({state: 'ready', isCurrent: true})});
    expect(w.classes()).to.deep.eq(['ccard', 'ccard--current']);
    expect(w.find('.ccard__state').text()).to.eq($t('Next mission'));

    await w.setProps({mission: mission({state: 'ready'})});
    expect(w.classes(), 'ready, not the current one — still ahead, and not «future» either').to.deep.eq(['ccard']);
    expect(w.find('.ccard__state').text()).to.eq($t('Ahead'));

    await w.setProps({mission: mission({state: 'active', isCurrent: true, final: true}), cursor: true});
    expect(w.classes()).to.deep.eq(['ccard', 'ccard--cursor', 'ccard--current', 'ccard--final']);
    expect(w.find('.ccard__final-banner').text()).to.eq($t('Finale'));
    expect(w.find('.ccard__state').classes()).to.contain('ccard__state--active');
    expect(w.find('.ccard__state').text()).to.eq($t('Mission in progress'));
  });

  it('the rolled conditions are badges in the slot\'s order, sealed in turn after the board\'s own reveal', () => {
    const w = card({mission: mission({modifiers: [{id: 'randomMA'}, {id: 'shuffleMap'}]}), reveal: true, revealDelayMs: 200});
    expect(w.classes()).to.contain('ccard--modified');
    expect(w.findComponent(MapStub).props('reveal')).to.eq(true);
    expect(w.findComponent(MapStub).props('revealDelayMs')).to.eq(200);
    const badges = w.findAllComponents(BadgeStub);
    expect(badges.map((b) => b.props('meta').id)).to.deep.eq(['randomMA', 'shuffleMap']);
    expect(badges.map((b) => b.props('stamp'))).to.deep.eq([true, true]);
    expect(badges.map((b) => b.props('stampDelayMs')), 'the board first (+520), then a badge every 120').to.deep.eq([720, 840]);
    expect(w.findAll('.ccard__map > .ccard__mods > .badge-stub').length).to.eq(2);
  });

  it('a committed mission: the podium in place order — a title\'s emblem or a tender\'s chip, the bot by its visible name', () => {
    const w = card({mission: mission({
      slot: 0,
      state: 'committed',
      generations: 9,
      podium: [
        {seat: 1, place: 1, color: 'blue', name: 'Ada', isBot: false, score: 71, title: 'governor'},
        {seat: 0, place: 2, color: 'red', name: 'raw-bot-save-name', isBot: true, score: 64, tender: 'extendedLegacy'},
        {seat: 2, place: 3, color: 'green', name: 'Lin', isBot: false, score: 50},
      ],
    })});
    expect(w.classes()).to.deep.eq(['ccard', 'ccard--done']);
    expect(w.find('.ccard__state').text()).to.eq($t('Mission complete'));

    const rows = w.findAll('.ccard__results > .ccard__result-row');
    expect(rows.map((r) => r.find('.ccard__result-place').text())).to.deep.eq(['1', '2', '3']);
    expect(rows.map((r) => r.find('.ccard__result-cube').classes()[1])).to.deep.eq(['player_bg_color_blue', 'player_bg_color_red', 'player_bg_color_green']);
    expect(rows.map((r) => r.find('.ccard__result-name').text()))
      .to.deep.eq(['Ada', participantDisplayName({name: 'raw-bot-save-name', isMarsBot: true}), 'Lin']);
    expect(rows.map((r) => r.find('.ccard__result-score').text())).to.deep.eq([`71 ${$t('VP')}`, `64 ${$t('VP')}`, `50 ${$t('VP')}`]);

    const emblem = rows[0].find('img.ccard__result-title');
    expect(emblem.attributes('src')).to.eq(titleArtUrl('governor'));
    expect(emblem.attributes('alt')).to.eq($t(TITLE_LABEL.governor));
    expect(rows[0].find('.ccard__result-tender').exists()).to.eq(false);

    const chip = rows[1].find('.ccard__result-tender');
    expect(chip.attributes('data-cmap-tender'), 'the chip itself, wearing the row\'s class').to.eq('extendedLegacy');
    expect(rows[1].find('.ccard__result-title').exists()).to.eq(false);

    expect(rows[2].find('.ccard__result-title').exists() || rows[2].find('.ccard__result-tender').exists(), 'neither a title nor a tender').to.eq(false);
    expect(w.find('.ccard__gens').text()).to.eq(translateTextWithParams('Generations: ${0}', ['9']));
  });
});

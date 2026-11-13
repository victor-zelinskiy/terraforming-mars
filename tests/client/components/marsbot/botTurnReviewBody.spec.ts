/*
 * BotTurnReviewBody — the static body of «Разбор хода» (its host is `ConsoleBotTurnReview`). A `<script setup>`
 * component (step A of docs/claude/vapor/RECIPES.md): what it renders for its three props — the identity header, the
 * played card (a project with its tags, or a bonus card with its essence, branch, chain and fate), the service
 * reveals, a chain per cause with its lines, the quiet verdict of a turn with neither — and its one live verb:
 * `zoomBonus` hands a bonus card's id up to the host. It exposes nothing. The journal chip, the tag and the line's
 * content are stubbed by name: their own rendering is theirs. No mount below hands it a translator or a directive:
 * the body brings its own `$t` and `v-i18n`. The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import BotTurnReviewBody from '@/client/components/marsbot/BotTurnReviewBody.vue';
import {BotReviewLine, BotTurnReview} from '@/client/components/marsbot/botTurnReviewModel';
import {marsBotCorpDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {BonusCardId, MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {BonusCardContext, buildBonusCardView} from '@/common/automa/BonusCardData';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

const ChipStub = defineComponent({
  name: 'JournalCardChip',
  props: {name: {type: String as PropType<CardName>, required: true}},
  render() {
    return h('i', {'class': 'chip-stub', 'data-card': this.name});
  },
});

const TagStub = defineComponent({
  name: 'Tag',
  props: {
    tag: {type: String as PropType<Tag>, required: true},
    size: {type: String, required: true},
    type: {type: String, default: undefined},
  },
  render() {
    return h('i', {'class': 'tag-stub', 'data-tag': this.tag});
  },
});

const LineStub = defineComponent({
  name: 'BotReviewLineContent',
  props: {
    line: {type: Object as PropType<BotReviewLine>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
  },
  render() {
    return h('i', {'class': 'line-stub', 'data-kind': this.line.kind});
  },
});

const CTX: BonusCardContext = {venus: false, colonies: false};
const PLAYERS = [{color: 'red', name: 'Ada'}] as unknown as ReadonlyArray<PublicPlayerModel>;

/** A PASS: no card, no chain — every test adds what it is about. */
function reviewOf(overrides: Partial<BotTurnReview> = {}): BotTurnReview {
  return {
    generation: 4,
    difficulty: 'hard',
    botColor: 'blue',
    botName: 'Seat of the bot',
    ctx: CTX,
    verdict: {key: 'MarsBot passed this turn', params: []},
    headlineChips: [],
    chains: [],
    tiles: [],
    params: [],
    attacks: [],
    playerImpacts: [],
    cardNames: [],
    technicalReveals: [],
    quiet: true,
    ...overrides,
  };
}

function bodyOf(review: BotTurnReview, large = false) {
  return mount(BotTurnReviewBody, {
    props: {review, players: PLAYERS, large},
    global: {stubs: {JournalCardChip: ChipStub, Tag: TagStub, BotReviewLineContent: LineStub}},
  });
}

function note(depth: number, noteKey: string): BotReviewLine {
  return {kind: 'note', depth, noteKey, tone: 'info'};
}

describe('BotTurnReviewBody — the body of the bot turn review', () => {
  it('the identity header; a turn with no card and no chain is a quiet verdict panel, never a blank body', async () => {
    const wrapper = bodyOf(reviewOf(), true);
    expect(wrapper.classes()).to.deep.eq(['mbr', 'mbr--large']);
    expect(wrapper.find('.con-status__dot').classes()).to.include('player_bg_color_blue');
    // The seat's stored name is never shown — the participant's display name is.
    expect(wrapper.find('.mbr__botname').text()).to.eq('MarsBot');
    expect(wrapper.find('.mbr__diff').text()).to.eq('Hard');
    expect(wrapper.find('.mbr__gen').text()).to.eq('Generation 4');

    expect(wrapper.find('.mbr__card').exists()).to.eq(false);
    expect(wrapper.find('.mbr__chains').exists()).to.eq(false);
    expect(wrapper.find('.mbr__quiet-glyph').text()).to.eq('⏸');
    expect(wrapper.find('.mbr__quiet-text').text()).to.eq('MarsBot passed this turn');

    // Another quiet verdict: its own mark, its template with the params substituted.
    await wrapper.setProps({review: reviewOf({verdict: {key: 'MarsBot gained ${0} M€', params: ['3']}}), large: false});
    expect(wrapper.classes()).to.deep.eq(['mbr']);
    expect(wrapper.find('.mbr__quiet-glyph').text()).to.eq('◦');
    expect(wrapper.find('.mbr__quiet-text').text()).to.eq('MarsBot gained 3 M€');
  });

  it('a played PROJECT card: its journal chip, its tags (an ignored one marked), and the service reveals with their reason', () => {
    const wrapper = bodyOf(reviewOf({
      card: {kind: 'project', name: CardName.ANTS, tags: [{tag: Tag.MICROBE, ignored: false}, {tag: Tag.EARTH, ignored: true}]},
      technicalReveals: [{name: CardName.BIRDS, reason: 'tiebreak'}, {name: CardName.ALGAE, reason: 'pick'}],
    }));
    expect(wrapper.find('.mbr__quiet').exists(), 'a turn with a card is not quiet').to.eq(false);

    const played = wrapper.find('.mbr__card-chip');
    expect(played.classes(), 'the played card is the journal\'s chip').to.include('chip-stub');
    expect(played.attributes('data-card')).to.eq(CardName.ANTS);
    const kicker = wrapper.find('.mbr__card-kicker');
    expect(kicker.find('span[tm-has-i18n]').exists(), 'translated by the body\'s own v-i18n').to.eq(true);
    expect(kicker.text()).to.include('Project card');
    expect(kicker.find('.mbr__rule').text()).to.eq('Only the card tags are played');

    const tags = wrapper.findAll('.mbr__tag');
    expect(tags.map((t) => t.find('.tag-stub').attributes('data-tag'))).to.deep.eq([Tag.MICROBE, Tag.EARTH]);
    expect(tags.map((t) => t.classes().includes('mbr__tag--ignored'))).to.deep.eq([false, true]);
    expect(tags.map((t) => t.find('.mbr__tag-x').exists())).to.deep.eq([false, true]);
    expect(wrapper.find('.mbr__bonus-chip').exists(), 'no bonus card was played').to.eq(false);

    const reveals = wrapper.findAll('.mbr__tech');
    expect(wrapper.find('.mbr__tech-list .mbr__panel-label').text()).to.eq('Service reveal');
    expect(reveals.map((r) => r.find('.chip-stub').attributes('data-card'))).to.deep.eq([CardName.BIRDS, CardName.ALGAE]);
    expect(reveals.map((r) => r.find('.mbr__tech-reason').text())).to.deep.eq(['to break a tie', 'to pick a tile']);
  });

  it('a played BONUS card: name, essence, the resolved branch, the chained card and the fate — and its chips emit `zoomBonus` with the id', async () => {
    const view = buildBonusCardView(BonusCardId.B04_OVERACHIEVEMENT, CTX);
    const wrapper = bodyOf(reviewOf({
      card: {
        kind: 'bonus',
        id: BonusCardId.B04_OVERACHIEVEMENT,
        fate: 'destroyed',
        branch: {key: 'Claimed ${0}', params: ['Mayor']},
        secondaryCard: BonusCardId.B03_RESEARCH_AND_DEVELOPMENT,
      },
    }));
    const chip = wrapper.find('.mbr__bonus-chip');
    expect(chip.attributes('title')).to.eq('Full rules');
    expect(chip.find('.mbr__bonus-name').text()).to.eq(view.name);
    expect(wrapper.find('.mbr__card-kicker').text()).to.eq('Bonus card');
    expect(wrapper.find('.mbr__card-essence').text()).to.eq(view.lines[0].text);
    expect(wrapper.find('.mbr__branch-value').text()).to.eq('Claimed Mayor');

    const chained = wrapper.find('.mbr__branch--chain');
    expect(chained.find('.mbr__branch-label').text()).to.eq('Drew another card');
    expect(chained.find('.mbr__bonus-name').text()).to.eq(buildBonusCardView(BonusCardId.B03_RESEARCH_AND_DEVELOPMENT, CTX).name);

    const fate = wrapper.find('.mbr__fate');
    expect(fate.classes()).to.include('mbr__fate--destroyed');
    expect(fate.find('.mbr__fate-value').text()).to.eq('Destroyed this turn');

    await chip.trigger('click');
    expect(wrapper.emitted('zoomBonus')).to.deep.eq([[BonusCardId.B04_OVERACHIEVEMENT]]);
    await chained.find('.mbr__bonus-chip--sm').trigger('click');
    expect(wrapper.emitted('zoomBonus')).to.deep.eq([[BonusCardId.B04_OVERACHIEVEMENT], [BonusCardId.B03_RESEARCH_AND_DEVELOPMENT]]);
    expect(wrapper.emitted('peek'), 'nothing else is emitted').to.eq(undefined);

    // A bonus card with nothing more recorded: no branch, no chain, no fate row.
    await wrapper.setProps({review: reviewOf({card: {kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}})});
    expect(wrapper.find('.mbr__bonus-name').text()).to.eq(buildBonusCardView(BonusCardId.B01_METEOR_SHOWER, CTX).name);
    expect(wrapper.find('.mbr__branch').exists()).to.eq(false);
    expect(wrapper.find('.mbr__fate').exists()).to.eq(false);
  });

  it('a chain per cause — its kicker and title — and its lines through the line content; a secondary card nests its own', async () => {
    const wrapper = bodyOf(reviewOf({
      chains: [
        {cause: {kind: 'tag', tag: Tag.BUILDING}, lines: [note(1, 'first'), note(2, 'second'), note(5, 'deep')]},
        {
          cause: {kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER},
          lines: [{kind: 'secondary-card', depth: 2, id: BonusCardId.B03_RESEARCH_AND_DEVELOPMENT, lines: [note(1, 'nested')]}],
        },
        {cause: {kind: 'corporation', id: MarsBotCorpId.C45_SPIRE}, lines: []},
        {cause: {kind: 'failed', reason: 'no legal space'}, lines: []},
        {cause: {kind: 'effect'}, lines: []},
      ],
    }));
    expect(wrapper.find('.mbr__quiet').exists(), 'a turn with chains is not quiet').to.eq(false);

    const chains = wrapper.findAll('.mbr__chain');
    expect(chains.map((c) => c.classes().filter((k) => k.startsWith('mbr__chain--'))))
      .to.deep.eq([['mbr__chain--tag'], ['mbr__chain--bonus'], ['mbr__chain--corporation'], ['mbr__chain--failed'], ['mbr__chain--effect']]);
    expect(chains.map((c) => c.find('.mbr__chain-kicker').text()))
      .to.deep.eq(['Card tag', 'Bonus card', 'Corporation effect', 'Failed action', 'Consequences']);
    expect(chains[0].find('.mbr__chain-head .tag-stub').attributes('data-tag')).to.eq(Tag.BUILDING);
    expect(chains[1].find('.mbr__chain-title').text()).to.eq(buildBonusCardView(BonusCardId.B01_METEOR_SHOWER, CTX).name);
    expect(chains[2].find('.mbr__chain-title').text()).to.eq(marsBotCorpDisplayName(MarsBotCorpId.C45_SPIRE));
    expect(chains[3].find('.mbr__chain-kicker').classes()).to.include('mbr__chain-kicker--warn');

    // The lines: one row each, indented by depth (capped at 3), a ladder mark from the second level down.
    const rows = chains[0].findAll('.mbr__line');
    expect(rows.map((r) => r.classes().filter((k) => k.startsWith('mbr__line--'))))
      .to.deep.eq([['mbr__line--d1'], ['mbr__line--d2'], ['mbr__line--d3']]);
    expect(rows.map((r) => r.find('.mbr__ladder').exists())).to.deep.eq([false, true, true]);
    const lines = wrapper.findAllComponents(LineStub);
    expect(lines.slice(0, 3).map((l) => l.props('line')).map((l) => l.kind === 'note' ? l.noteKey : l.kind))
      .to.deep.eq(['first', 'second', 'deep']);
    expect(lines.every((l) => l.props('players') === wrapper.props('players')), 'the players are handed on').to.eq(true);

    // A chained fallback card is ONE nested block: its kicker, its chip, its own lines — and no ladder of its own.
    const secondary = chains[1].find('.mbr__secondary');
    expect(chains[1].find('.mbr__ladder').exists()).to.eq(false);
    expect(secondary.find('.mbr__secondary-kicker').text()).to.eq('Secondary card');
    expect(secondary.find('.mbr__bonus-name').text()).to.eq(buildBonusCardView(BonusCardId.B03_RESEARCH_AND_DEVELOPMENT, CTX).name);
    expect(secondary.findAll('.mbr__secondary-lines .line-stub').map((l) => l.attributes('data-kind'))).to.deep.eq(['note']);
    expect(lines, 'three lines of the first chain and the nested one').to.have.length(4);

    await secondary.find('.mbr__bonus-chip--sm').trigger('click');
    expect(wrapper.emitted('zoomBonus')).to.deep.eq([[BonusCardId.B03_RESEARCH_AND_DEVELOPMENT]]);
  });
});

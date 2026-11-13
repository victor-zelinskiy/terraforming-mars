/*
 * BotReviewLineContent — the CONTENT of one line of «Разбор хода» (its host is `BotTurnReviewBody`, for a chain's
 * lines and for a secondary card's nested ones). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md):
 * what it renders for its two props — a track movement, a log consequence, an attack or a note, by the line's kind. It
 * is a fragment (the host's row is the container), emits nothing and exposes nothing. The tag and the journal token
 * are stubbed by name: their own rendering is theirs. No mount below hands it a translator or a directive: the line
 * brings its own `$t` and `v-i18n`. The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import BotReviewLineContent from '@/client/components/marsbot/BotReviewLineContent.vue';
import {BotReviewLine} from '@/client/components/marsbot/botTurnReviewModel';
import {parseLocalizedLog} from '@/client/components/journal/logLocalization';
import {MarsBotAttack} from '@/common/automa/MarsBotTurn';
import {CardResource} from '@/common/CardResource';
import {Resource} from '@/common/Resource';
import {Tag} from '@/common/cards/Tag';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {LogMessageType} from '@/common/logs/LogMessageType';
import {PublicPlayerModel} from '@/common/models/PlayerModel';

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

const TokenStub = defineComponent({
  name: 'JournalTokenRenderer',
  props: {
    token: {type: [String, Object] as PropType<string | LogMessageData>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
  },
  render() {
    return h('i', {'class': 'token-stub'});
  },
});

// The bot's seat keeps its canonical server name; what a line shows is the participant's DISPLAY name.
const PLAYERS = [
  {color: 'red', name: 'Ada'},
  {color: 'blue', name: 'Seat of the bot', isMarsBot: true},
] as unknown as ReadonlyArray<PublicPlayerModel>;

function lineOf(line: BotReviewLine) {
  return mount(BotReviewLineContent, {
    props: {line, players: PLAYERS},
    global: {stubs: {Tag: TagStub, JournalTokenRenderer: TokenStub}},
  });
}

function attackLine(attack: MarsBotAttack): BotReviewLine {
  return {kind: 'attack', depth: 1, attack};
}

/** A cell's mark as the scale draws it: the sprite's classes, else the symbol, else the plain dot. */
function cellMarksOf(wrapper: ReturnType<typeof lineOf>): Array<string> {
  return wrapper.findAll('.mbr__cell').map((cell) => {
    const icon = cell.find('.mbr__cell-icon');
    if (icon.exists()) {
      return icon.classes().filter((c) => c !== 'mbr__cell-icon').join(' ');
    }
    const symbol = cell.find('.mbr__cell-sym');
    return symbol.exists() ? symbol.text() : (cell.find('.mbr__cell-dot').exists() ? 'dot' : '');
  });
}

describe('BotReviewLineContent — one line of the bot turn review', () => {
  it('a track movement: the capsule\'s tags, from → to, the mini-scale cell by cell, and the reached cell\'s action', () => {
    const wrapper = lineOf({
      kind: 'track', depth: 1, capsule: [Tag.BUILDING, Tag.SPACE], from: 2, to: 4, action: 'tr1',
      cells: [
        {index: 2, state: 'from'},
        {index: 3, state: 'mid', action: 'advance'},
        {index: 4, state: 'to', action: 'tr1'},
        {index: 5, state: 'future', action: 'greenery'},
      ],
    });
    expect(wrapper.find('.mbr__move').classes()).to.include('mbr__move--action');

    const tags = wrapper.findAllComponents(TagStub);
    expect(tags.map((t) => t.props('tag'))).to.deep.eq([Tag.BUILDING, Tag.SPACE]);
    expect(tags.map((t) => [t.props('size'), t.props('type')])).to.deep.eq([['med', 'secondary'], ['med', 'secondary']]);
    expect(wrapper.find('.mbr__capsule').attributes('title'), 'a composite capsule says so').to.eq('Composite track');
    expect(wrapper.find('.mbr__from-to').text()).to.eq('2→4');

    expect(wrapper.findAll('.mbr__cell').map((c) => c.classes().filter((k) => k.startsWith('mbr__cell--'))))
      .to.deep.eq([['mbr__cell--from'], ['mbr__cell--mid'], ['mbr__cell--to'], ['mbr__cell--future']]);
    expect(cellMarksOf(wrapper)).to.deep.eq(['dot', '↻', 'resource_icon resource_icon--rating', 'mb-ico mb-ico--greenery']);

    const bonus = wrapper.find('.mbr__cellbonus');
    expect(bonus.find('.mbr__cellbonus-cell').attributes('tm-has-i18n'), 'translated by the line\'s own v-i18n').to.eq('true');
    expect(bonus.find('.mbr__cellbonus-cell').text()).to.eq('Cell');
    expect(bonus.find('.mbr__cellbonus-idx').text()).to.eq('4');
    expect(bonus.find('.mbr__cell-icon').classes()).to.include('resource_icon--rating');
    expect(bonus.find('.mbr__act-name').text()).to.eq('Gain 1 TR');

    // A plain step of one track: no composite title, no scale, no reached-cell block.
    const plain = lineOf({kind: 'track', depth: 2, capsule: [Tag.EARTH], from: 0, to: 1, cells: []});
    expect(plain.find('.mbr__move').classes()).to.not.include('mbr__move--action');
    expect(plain.find('.mbr__capsule').attributes('title')).to.eq(undefined);
    expect(plain.find('.mbr__from-to').text()).to.eq('0→1');
    expect(plain.find('.mbr__scale').exists()).to.eq(false);
    expect(plain.find('.mbr__cellbonus').exists()).to.eq(false);
  });

  it('a log consequence: its optional label (a cost in its own tone) and the localized line, a journal token each', () => {
    const message = new LogMessage(LogMessageType.DEFAULT, '${0} paid ${1} M€', [
      {type: LogMessageDataType.PLAYER, value: 'blue'},
      {type: LogMessageDataType.RAW_STRING, value: '5'},
    ]);
    const wrapper = lineOf({kind: 'log', depth: 1, message, tone: 'cost', labelKey: 'Cost'});
    expect(wrapper.find('.mbr__move').exists(), 'not a track line').to.eq(false);

    const label = wrapper.find('.mbr__cost-label');
    expect(label.classes()).to.include('mbr__cost-label--cost');
    expect(label.text()).to.eq('Cost');

    const expected = [...parseLocalizedLog(message)];
    expect(expected.length).to.be.greaterThan(1);
    const tokens = wrapper.find('.mbr__tokens').findAll('.token-stub');
    expect(tokens).to.have.length(expected.length);
    const stubs = wrapper.findAllComponents(TokenStub);
    expect(stubs.map((s) => s.props('token'))).to.deep.eq(expected);
    expect(stubs.every((s) => s.props('players') === wrapper.props('players')), 'the players are handed on').to.eq(true);

    // No label key — no label; a gain keeps the calm tone.
    const bare = lineOf({kind: 'log', depth: 1, message, tone: 'gain'});
    expect(bare.find('.mbr__cost-label').exists()).to.eq(false);
    expect(bare.findAllComponents(TokenStub)).to.have.length(expected.length);
  });

  it('an attack: who was hit (by display name), what was demanded, the stock before → after, and why nothing left', () => {
    const hit = lineOf(attackLine({target: 'red', resource: Resource.PLANTS, demanded: 5, removed: 3, before: 5, after: 2, outcome: 'hit'}));
    expect(hit.find('.mbr__pdot').classes()).to.include('player_bg_color_red');
    expect(hit.find('.mbr__pname').text()).to.eq('Ada');
    expect(hit.find('.mbr__imp-chip').classes()).to.include('mbr__imp-chip--loss');
    expect(hit.findAll('.mbr__chip-icon').map((i) => i.classes().filter((c) => c !== 'mbr__chip-icon').join(' ')))
      .to.deep.eq(['resource_icon resource_icon--plants']);
    expect(hit.find('.mbr__vals').text()).to.eq('5→2');
    expect(hit.find('.mbr__note').exists(), 'a hit needs no note').to.eq(false);

    // The bot's own seat reads as the bot, never as its stored name; a colour nobody holds reads as the colour.
    const bot = lineOf(attackLine({target: 'blue', resource: Resource.HEAT, demanded: 2, removed: 0, outcome: 'protected'}));
    expect(bot.find('.mbr__pname').text()).to.eq('MarsBot');
    expect(bot.find('.mbr__imp-chip').classes()).to.include('mbr__imp-chip--calm');
    expect(bot.find('.mbr__vals').exists(), 'no stock was read').to.eq(false);
    expect(bot.find('.mbr__note').text()).to.eq('Resources are protected');
    expect(lineOf(attackLine({target: 'green', resource: Resource.HEAT, demanded: 2, removed: 2, before: 2, after: 0, outcome: 'hit'}))
      .find('.mbr__pname').text()).to.eq('green');

    // Nobody held it: the line names the demand, never a seat.
    const nobody = lineOf(attackLine({resource: Resource.PLANTS, demanded: 5, removed: 0, outcome: 'nothing-to-lose'}));
    expect(nobody.find('.mbr__pdot').exists()).to.eq(false);
    expect(nobody.find('.mbr__pname').text()).to.eq('Nobody');
    expect(nobody.find('.mbr__note').text()).to.eq('Nothing to lose');

    // The composite cube demand draws BOTH sprites until one is gone; a resolved cube draws the one that went.
    const pending = lineOf(attackLine({target: 'red', resource: 'cube', demanded: 1, removed: 0, outcome: 'target-chooses'}));
    expect(pending.findAll('.mbr__chip-icon').map((i) => i.classes().filter((c) => c.startsWith('card-resource-'))))
      .to.deep.eq([['card-resource-animal'], ['card-resource-microbe']]);
    expect(pending.find('.mbr__note').text()).to.eq('Chooses what to lose');
    const resolved = lineOf(attackLine({target: 'red', resource: 'cube', cardResource: CardResource.MICROBE, demanded: 1, removed: 1, before: 3, after: 2, outcome: 'hit'}));
    expect(resolved.findAll('.mbr__chip-icon').map((i) => i.classes().filter((c) => c.startsWith('card-resource-'))))
      .to.deep.eq([['card-resource-microbe']]);
  });

  it('a note: its mark by tone, its key on the hook, its text — a bare key or a template with its params', () => {
    const skipped = lineOf({kind: 'note', depth: 1, noteKey: 'No legal space', tone: 'skip'});
    expect(skipped.find('.mbr__notemark').text()).to.eq('⊘');
    expect(skipped.find('.mbr__notemark').classes()).to.not.include('mbr__notemark--info');
    expect(skipped.find('.mbr__notetext').text()).to.eq('No legal space');
    expect(skipped.find('.mbr__notetext').attributes('data-note-key')).to.eq('No legal space');

    const info = lineOf({kind: 'note', depth: 1, noteKey: '${0} more delegates needed', tone: 'info', noteParams: ['2']});
    expect(info.find('.mbr__notemark').text()).to.eq('›');
    expect(info.find('.mbr__notemark').classes()).to.include('mbr__notemark--info');
    expect(info.find('.mbr__notetext').text()).to.eq('2 more delegates needed');
    expect(info.find('.mbr__notetext').attributes('data-note-key'), 'the hook is the KEY, not the text').to.eq('${0} more delegates needed');
  });
});

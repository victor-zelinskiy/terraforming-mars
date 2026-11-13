/*
 * ConsoleBotTurnReview — the console's fullscreen «Разбор хода». A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md) over the module's own reactive state (`botTurnReviewState` — what is on screen is that
 * state, never a copy): what it renders while the review is closed, open and peeking, what it hands its body and its
 * own command bar for the turn on screen, and what the body's two events do. Its one prop is the table's players; it
 * emits nothing and exposes nothing.
 *
 * The body and the command bar are stubbed by name — the spec asserts what the surface HANDS them. The teleport is
 * stubbed so the surface stands in the wrapper. The edge notice is the real one (a Vapor leaf — nothing at rest).
 */
import {expect} from 'chai';
import {defineComponent, h, nextTick, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {TileType} from '@/common/TileType';
import {SpaceId} from '@/common/Types';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotTurn, MarsBotTurnStep} from '@/common/automa/MarsBotTurn';
import {MarsBotTrackModel} from '@/common/models/MarsBotModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {closeConsoleCardZoom, consoleCardZoom} from '@/client/console/consoleCardZoom';
import {BotTurnReview} from '@/client/components/marsbot/botTurnReviewModel';
import {botTurnReviewState, openBotTurnReview, resetBotTurnReview} from '@/client/components/marsbot/botTurnReviewState';
import ConsoleBotTurnReview from '@/client/components/console/ConsoleBotTurnReview.vue';

const BodyStub = defineComponent({
  name: 'BotTurnReviewBody',
  props: {
    review: {type: Object as PropType<BotTurnReview>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    large: {type: Boolean, default: false},
  },
  emits: ['peek', 'zoomBonus'],
  render() {
    return h('i', {'class': 'body-stub'});
  },
});

const BarStub = defineComponent({
  name: 'ConsoleCommandBar',
  props: {
    context: {type: String, required: true},
    commands: {type: Array as PropType<ReadonlyArray<ConsoleCommand>>, required: true},
  },
  render() {
    return h('i', {'class': 'bar-stub'});
  },
});

const TRACKS = [
  {tags: [Tag.BUILDING], position: 4, maxPosition: 18, layout: [undefined, 'advance', undefined, 'city', undefined, 'tr1'], regressed: []},
] as unknown as ReadonlyArray<MarsBotTrackModel>;

/** The table as the shell hands it — the stubbed body only passes it on, so two fields stand for a seat. */
const PLAYERS = [{color: 'blue', name: 'Ann'}, {color: 'red', name: 'MarsBot'}] as unknown as ReadonlyArray<PublicPlayerModel>;

/** Open the review of one archived turn — the product's own door (`openBotTurnReview` builds the review). */
function openTurn(steps: ReadonlyArray<MarsBotTurnStep>, visual?: MarsBotTurn['visual']): void {
  openBotTurnReview({
    botColor: 'red' as Color,
    botName: 'MarsBot',
    difficulty: 'normal',
    ctx: {venus: false, colonies: true},
    turn: {id: 1, generation: 3, steps, ...(visual !== undefined ? {visual} : {})},
    trackTags: [Tag.BUILDING],
    tracks: TRACKS,
  });
}

/** A project turn that put an ocean on the board: a card to inspect, a tile to show on the map. */
function openTileTurn(): void {
  openTurn([
    {kind: 'reveal', card: {kind: 'project', name: CardName.GENE_REPAIR}},
    {kind: 'tag', tag: Tag.BUILDING, trackIndex: 0},
    {kind: 'advance', trackIndex: 0, from: 3, to: 4, action: 'ocean'},
  ], {tiles: [{spaceId: '05', tileType: TileType.OCEAN}], oceans: {before: 3, after: 4}});
}

function surfaceOf() {
  return mount(ConsoleBotTurnReview, {
    global: {...globalConfig.global, stubs: {BotTurnReviewBody: BodyStub, ConsoleCommandBar: BarStub, teleport: true}},
    props: {players: PLAYERS},
  });
}

function barOf(wrapper: ReturnType<typeof surfaceOf>): Array<string> {
  const commands = wrapper.findComponent(BarStub).props('commands');
  return commands.map((c) => `${c.control}:${c.label}`);
}

describe('ConsoleBotTurnReview — the console\'s fullscreen turn review', () => {
  afterEach(() => {
    resetBotTurnReview(); // also stops the peek's board pulse
    closeConsoleCardZoom();
  });

  it('closed: nothing stands; open: the dialog, its title, the body with the review, the bar with the turn\'s verbs', async () => {
    const w = surfaceOf();
    expect(w.find('.con-bot-review').exists(), 'closed').to.eq(false);
    expect(w.findComponent(BodyStub).exists()).to.eq(false);

    openTileTurn();
    await nextTick();
    const root = w.find('.con-bot-review');
    expect(root.exists()).to.eq(true);
    expect(root.classes()).to.deep.eq(['con-bot-review']);
    expect(root.attributes('role')).to.eq('dialog');
    expect(root.attributes('aria-label')).to.eq('MarsBot turn review');
    expect(root.find('.con-bot-review__panel > .con-bot-review__head > .con-bot-review__title').text()).to.eq('Turn review');

    const body = w.findComponent(BodyStub);
    expect(root.find('.con-bot-review__scroll > .body-stub').exists()).to.eq(true);
    expect(body.props('review'), 'the module\'s own review, not a copy').to.eq(botTurnReviewState.review);
    expect(body.props('players')).to.deep.eq(PLAYERS);
    expect(body.props('large'), 'the TV-readable sizing').to.eq(true);

    expect(root.find('.con-bot-review__bar > .bar-stub').exists()).to.eq(true);
    expect(w.findComponent(BarStub).props('context')).to.eq('Turn review');
    expect(barOf(w)).to.deep.eq([
      'secondary:Inspect card', 'bumperL:Previous turn', 'bumperR:Next turn', 'stickL:Show on map', 'back:Close',
    ]);
  });

  it('the bar follows the turn on screen: nothing to inspect and no tile leave the turn navigation and Close', async () => {
    const w = surfaceOf();
    openTurn([{kind: 'pass'}]);
    await nextTick();
    expect(barOf(w)).to.deep.eq(['bumperL:Previous turn', 'bumperR:Next turn', 'back:Close']);

    // Another turn opened over it is a NEW node (the nonce keys the surface), read off the same state.
    const first = w.find('.con-bot-review').element;
    openTurn([{kind: 'reveal', card: {kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}}]);
    await nextTick();
    expect(w.find('.con-bot-review').element).to.not.eq(first);
    expect(barOf(w), 'a bonus card is inspectable').to.deep.eq([
      'secondary:Inspect card', 'bumperL:Previous turn', 'bumperR:Next turn', 'back:Close',
    ]);
  });

  it('the body\'s «peek» shows the cell on the map: the surface fades to its peek pose and the bar offers only Back', async () => {
    const w = surfaceOf();
    openTileTurn();
    await nextTick();

    const cell: SpaceId = '05';
    w.findComponent(BodyStub).vm.$emit('peek', cell);
    await nextTick();
    expect(botTurnReviewState.peek).to.eq(true);
    expect([...botTurnReviewState.peekSpaceIds]).to.deep.eq(['05']);
    expect(w.find('.con-bot-review').classes()).to.deep.eq(['con-bot-review', 'con-bot-review--peek']);
    expect(barOf(w)).to.deep.eq(['back:Back']);
  });

  it('the body\'s «zoomBonus» opens that bonus card in the console\'s ONE fullscreen viewer, as a textual origin', async () => {
    const w = surfaceOf();
    openTurn([{kind: 'reveal', card: {kind: 'bonus', id: BonusCardId.B01_METEOR_SHOWER}}]);
    await nextTick();
    expect(consoleCardZoom.card, 'no viewer yet').to.eq(undefined);

    w.findComponent(BodyStub).vm.$emit('zoomBonus', BonusCardId.B01_METEOR_SHOWER);
    expect(consoleCardZoom.cards).to.have.lengthOf(1);
    expect(consoleCardZoom.card).to.deep.eq({
      bonus: BonusCardId.B01_METEOR_SHOWER, ctx: {venus: false, colonies: true}, name: BonusCardId.B01_METEOR_SHOWER,
    });
    expect(consoleCardZoom.contextLabel).to.eq('MarsBot turn');
    expect(consoleCardZoom.origin).to.deep.eq({kind: 'textual'});
  });
});

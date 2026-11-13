/*
 * ConsoleMarsBotSections — «Экран бота» and its two nested routes in the console Information workspace. A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): what it renders for its props — ONE root per
 * `mode` (the hub's plates, the printed board beside the rules that read it, the open bonus piles) — and the hub's own
 * fit, measured on its template ref on mount and after every update (`data-botscr-fit`, attribute writes only). It
 * emits nothing and no parent stands a ref on it. The printed board, the corporation face and the bonus faces are
 * stubbed by name (each is its own component's subject). The unit runner renders the English keys.
 */
import {expect} from 'chai';
import {defineComponent, h, PropType} from 'vue';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {BotScreenEntry} from '@/client/console/infoRoute';
import {MarsBotGuideContext} from '@/client/components/marsbot/marsBotGuide';
import ConsoleMarsBotSections from '@/client/components/console/ConsoleMarsBotSections.vue';

const FaceStub = defineComponent({
  name: 'BonusCardFace',
  props: {
    id: {type: String as PropType<BonusCardId>, required: true},
    ctx: {type: Object as PropType<MarsBotGuideContext>, required: true},
    large: {type: Boolean, default: false},
    destroyed: {type: Boolean, default: false},
  },
  render() {
    return h('i', {'class': 'face-stub', 'data-id': this.id});
  },
});

const global = {
  ...globalConfig.global,
  stubs: {BonusCardFace: FaceStub, MarsBotTracks: true, MarsBotCorpFace: true},
};

const BASE: MarsBotGuideContext = {venus: false, colonies: false, deltaProject: false};

/** The bot's seat as the hub reads it: its colour and the live M€ → VP rate of its breakdown. */
const BOT = {color: 'blue', victoryPointsBreakdown: {automa: {mcPerVp: 6}}} as unknown as PublicPlayerModel;

function automa(over: Partial<MarsBotModel> = {}): MarsBotModel {
  return {
    difficulty: 'hard', tracks: [], actionDeckSize: 7, bonusDeckSize: 3,
    bonusDiscard: [], recurringBonusCards: [], destroyedBonusCards: [], playedPile: [], floaters: 0, ...over,
  };
}

function sections(mode: 'botScreen' | 'botBoard' | 'botBonus', over: {automa?: MarsBotModel, ctx?: MarsBotGuideContext, focus?: BotScreenEntry} = {}) {
  return mount(ConsoleMarsBotSections, {
    global,
    props: {mode, bot: BOT, automa: over.automa ?? automa(), ctx: over.ctx ?? BASE, ...(over.focus !== undefined ? {focus: over.focus} : {})},
  });
}

/** Give a plate a box whose content does (or does not) stand inside it. */
function box(plate: Element, content: number, height: number): void {
  Object.defineProperty(plate, 'scrollHeight', {configurable: true, value: content});
  Object.defineProperty(plate, 'clientHeight', {configurable: true, value: height});
}

describe('ConsoleMarsBotSections — the MarsBot internals of the Information workspace', () => {
  it('the hub: a plate per object — the difficulty in words, the decks and the piles by count, the M€ ladder — the cursor\'s door marked, and one more plate per module of THIS game', async () => {
    const w = sections('botScreen');
    // The template starts with its root: the wrapper IS the hub.
    expect(w.classes()).to.deep.eq(['con-botscr']);
    expect(w.attributes('data-botscr-extras')).to.eq('0');
    // A corpless bot: the first plate is the difficulty's own.
    const first = w.find('.con-botscr__plate--corp');
    expect([first.find('.con-botscr__kicker').text(), first.find('.con-botscr__difficulty').text()]).to.deep.eq(['Difficulty', 'Hard']);
    expect(first.findAll('.con-botscr__prose').length, 'the difficulty and the clock, each with its paragraphs').to.be.greaterThan(1);

    const count = (pile: string) => w.find(`[data-bot-pile="${pile}"] .con-botscr__count`).text();
    expect([count('action'), count('bonus'), count('discard'), count('destroyed')]).to.deep.eq(['7', '3', '0', '0']);
    expect(w.find('[data-bot-pile="recurring"]').exists(), 'no recurring card — no token').to.eq(false);
    expect(w.find('[data-bot-ladder] .con-botscr__count').text()).to.eq('6');
    expect(w.findAll('.con-botscr__plate--decks > .con-botscr__prose'), 'the deck\'s rule stands under its objects').to.have.length(2);

    // The two doors are the hub's focus ring: the cursor's is marked, by the prop.
    const focused = () => ['botBonus', 'botBoard'].map((entry) => w.find(`[data-bot-entry="${entry}"]`).classes().includes('con-botscr__entry--focused'));
    expect(focused()).to.deep.eq([false, true]);
    await w.setProps({focus: 'botBonus'});
    expect(focused()).to.deep.eq([true, false]);

    // Colonies and the Hydronetwork each add a plate, and the grid widens for them.
    const wide = sections('botScreen', {
      ctx: {venus: false, colonies: true, deltaProject: true},
      automa: automa({recurringBonusCards: [BonusCardId.B01_METEOR_SHOWER]}),
    });
    expect(wide.classes()).to.include('con-botscr--wide');
    expect(wide.attributes('data-botscr-extras')).to.eq('2');
    expect(wide.findAll('.con-botscr__plate--extra').map((p) => p.find('.con-botscr__kicker').text())).to.deep.eq(['Shipping storage', 'Hydronetwork']);
    expect(wide.find('[data-bot-pile="recurring"] .con-botscr__count').text()).to.eq('1');
  });

  it('the hub sits in its opening: the prose steps down until no plate overflows — measured on the hub\'s own ref at mount and after every update', async () => {
    const w = sections('botScreen');
    const fit = () => (w.element as HTMLElement).dataset.botscrFit;
    expect(fit(), 'every plate holds its content').to.eq('0');

    // A plate's content outgrows it: the next update walks the ladder to its floor.
    const plate = w.find('.con-botscr__plate--decks').element;
    box(plate, 500, 100);
    await w.setProps({focus: 'botBonus'});
    expect(fit()).to.eq('2');

    // …and back to the reading size once it stands inside again.
    box(plate, 100, 100);
    await w.setProps({focus: 'botBoard'});
    expect(fit()).to.eq('0');

    // A route with no hub measures nothing (its ref is null) and stands as its own root.
    await w.setProps({mode: 'botBoard'});
    expect(w.classes()).to.deep.eq(['con-botboard']);
    expect(w.attributes('data-botscr-fit')).to.eq(undefined);
  });

  it('the board route: the printed board beside the three rules that READ it — its turn, the trackers, the failed action', () => {
    const w = sections('botBoard', {ctx: {venus: false, colonies: true, deltaProject: true}});
    expect(w.classes()).to.deep.eq(['con-botboard']);
    expect(w.find('.con-botboard__stage > mars-bot-tracks-stub').exists(), 'the board stands on its stage').to.eq(true);
    const rules = w.findAll('.con-botboard__guide > .con-botboard__rule');
    expect(rules.map((r) => r.attributes('data-guide'))).to.deep.eq(['turn', 'tracks', 'failed']);
    expect(rules.map((r) => r.find('.con-botboard__ruletitle > span:last-child').text()))
      .to.deep.eq(['Its turn in one sentence', 'Trackers and regression', 'Failed actions']);
    expect(rules.every((r) => r.findAll('.con-botscr__prose').length > 0), 'each rule with its paragraphs').to.eq(true);
  });

  it('the bonus route: the piles in the order a card travels — the recurring one only when the corporation has any — an empty pile a composed void, a destroyed face marked', () => {
    const w = sections('botBonus', {automa: automa({bonusDiscard: [BonusCardId.B01_METEOR_SHOWER], destroyedBonusCards: [BonusCardId.B02_INVASIVE_SPECIES]})});
    expect(w.classes()).to.deep.eq(['con-botbonus']);
    expect(w.attributes('data-bonus-piles')).to.eq('2');
    const piles = w.findAll('.con-botbonus__pile');
    expect(piles.map((p) => [p.attributes('data-bonus-pile'), p.find('.con-botbonus__count').text()])).to.deep.eq([['discard', '1'], ['destroyed', '1']]);
    const faces = w.findAllComponents(FaceStub);
    expect(faces.map((f) => [f.props('id'), f.props('destroyed'), f.props('large')]))
      .to.deep.eq([[BonusCardId.B01_METEOR_SHOWER, false, true], [BonusCardId.B02_INVASIVE_SPECIES, true, true]]);
    expect(faces[0].props('ctx'), 'the faces resolve for THIS game').to.deep.eq(BASE);
    expect(w.find('.con-botbonus__void').exists()).to.eq(false);

    const recurring = sections('botBonus', {automa: automa({recurringBonusCards: [BonusCardId.B01_METEOR_SHOWER]})});
    expect(recurring.attributes('data-bonus-piles')).to.eq('3');
    expect(recurring.findAll('.con-botbonus__pile').map((p) => p.attributes('data-bonus-pile'))).to.deep.eq(['recurring', 'discard', 'destroyed']);
    const voids = recurring.findAll('.con-botbonus__pile').map((p) => p.find('.con-botbonus__void').exists());
    expect(voids, 'an empty pile is its outline and one word, never a bare line').to.deep.eq([false, true, true]);
    expect(recurring.find('[data-bonus-pile="discard"] .con-botbonus__voidline').text()).to.eq('Empty');
  });
});

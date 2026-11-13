/*
 * ConsoleParliamentTableAnswer — «ОТВЕТ СТОЛА»: ONE stage for a card of the table answering a walk of the Career. The
 * ASKER's face stands on the hero; the ZONE holds the answer — a RECEIPT (the recipients as a row of faces) or a
 * QUESTION (the slot the shell teleports the picker into, published only once the stage has ENTERED). A
 * `<script setup>` component (step A of docs/claude/vapor/RECIPES.md); host-agnostic — it emits and exposes nothing.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h, nextTick} from 'vue';
import {globalConfig} from '../../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {cardResourceLandings, resetCardResourceLandings} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {consoleParliamentUi} from '@/client/console/parliament/consoleParliamentFlow';
import {ReceiptCard} from '@/client/console/parliament/tableReceiptBeat';
import {resetTableAnswerBeat, TableAnswer, TableAnswerAsk, TableAnswerPhase, tableAnswerState} from '@/client/console/parliament/tableAnswerBeat';
import ConsoleParliamentTableAnswer from '@/client/components/console/parliament/ConsoleParliamentTableAnswer.vue';

// The hero's face is the premium card and the row is the sitting's receipt chassis — their own specs' subjects; this
// one reads what the stage HANDS them. (Render functions, not template strings: the runtime compiler is not in this build.)
const CardStub = defineComponent({name: 'CardFace', props: ['card', 'lightweight', 'inert'], render: () => h('i', {class: 'card-stub'})});
const ReceiptStub = defineComponent({name: 'ConsoleTableReceipt', props: ['receipt', 'phase'], render: () => h('i', {class: 'receipt-stub'})});

/** The stage's own slot (the shell's zone selector for a question's picker). */
const ZONE = '[data-embed-slot="parliament-answer"]';

const ASKER = CardName.SECURITY_FLEET;
const OTHER = CardName.PETS;

const share = (card: CardName, before: number, amount: number): ReceiptCard => ({card, resource: 'Fighter', iconKey: 'fighter', before, amount});

function answer(cards: ReadonlyArray<ReceiptCard>): TableAnswer {
  return {
    key: 'spec-answer', seq: 1, asker: ASKER, player: 'blue', cause: 'quest', walk: {from: 2, to: 3},
    resource: 'fighter', amount: cards.reduce((sum, c) => sum + c.amount, 0), cards, specs: [], generation: 4, host: 'quest',
  };
}

const asking: TableAnswerAsk = {asker: ASKER, cause: 'card', resource: 'fighter', amount: 2, host: 'walk'};

function stage(props: Record<string, unknown>, attrs: Record<string, unknown> = {}) {
  return mount(ConsoleParliamentTableAnswer as any, {
    ...globalConfig,
    props,
    attrs,
    global: {...globalConfig.global, stubs: {Card: CardStub, ConsoleTableReceipt: ReceiptStub}},
  });
}

describe('ConsoleParliamentTableAnswer — «ОТВЕТ СТОЛА»: the table\'s answer stage', () => {
  // The stage reads module state (the beat's phase / pane, the landing tally) and writes one flag — none may leak.
  const reset = () => {
    resetTableAnswerBeat();
    resetCardResourceLandings();
    consoleParliamentUi.answerZone = false;
  };
  beforeEach(reset);
  afterEach(reset);

  it('a RECEIPT: the asker on the hero with its own share, the WHY beside it, every other recipient handed to the receipt row', () => {
    const w = stage({answer: answer([share(ASKER, 1, 1), share(OTHER, 0, 2)])}, {'class': 'from-host', 'data-from-host': 'yes'});
    // The template STARTS WITH ITS ROOT: what a host lets fall through lands on the stage itself.
    expect((w.element as HTMLElement).tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['con-tans', 'from-host']);
    expect(w.classes()).to.not.include('con-tans--question');
    expect(w.classes()).to.not.include('con-tans--solo');
    expect(w.classes()).to.not.include('con-tans--embedded');
    expect(w.attributes('data-from-host')).to.eq('yes');
    expect(w.attributes('data-parl-answer')).to.not.eq(undefined);
    expect(w.attributes('data-tans-mode')).to.eq('receipt');
    expect(w.attributes('data-tans-asker')).to.eq(ASKER);
    expect(w.attributes('data-tans-cause')).to.eq('quest');
    expect(w.attributes('data-tans-phase'), 'no phase yet — no attribute').to.eq(undefined);

    // The hero: the framework's hook, the receiving mark, and the face as the viewer holds it (nothing has landed yet).
    const face = w.find('[data-tans-asker-face]');
    expect(face.attributes('data-reaction-home')).to.eq(ASKER);
    expect(face.attributes('data-tans-card'), 'the asker receives on this stage').to.eq(ASKER);
    const card = w.findComponent(CardStub);
    expect(card.props('card')).to.deep.eq({name: ASKER, resources: 1});
    expect(card.props('lightweight')).to.eq(true);
    expect(card.props('inert')).to.eq(true);

    const why = w.find('[data-tans-why]');
    expect(why.find('.con-tans__why-kicker').text()).to.eq($t('Agenda step'));
    expect(why.find('[data-tans-walk]').text()).to.eq('2→3');
    expect(why.find('[data-tans-gain] b').text()).to.eq('+3');
    expect(why.find('i.con-tans__unit').classes()).to.include.members(iconClassFor('fighter').split(' '));

    // The zone: no picker slot, the receipt chassis with every recipient BUT the asker, entering.
    expect(w.find('.con-tans__zone').classes()).to.include('con-tans__zone--on');
    expect(w.find('.con-tans__zone').attributes('data-tans-zone-open')).to.eq('');
    expect(w.find(ZONE).exists()).to.eq(false);
    expect(w.find('[data-tans-row] .receipt-stub').exists()).to.eq(true);
    const receipt = w.findComponent(ReceiptStub);
    expect(receipt.props('receipt')).to.deep.eq({
      key: 'spec-answer', player: 'blue', generation: 4,
      cards: [share(OTHER, 0, 2)],
      specs: [{channel: 'card-resource', resource: 'fighter', amount: 2, targetCard: OTHER}],
    });
    expect(receipt.props('phase')).to.eq('enter');
    expect(consoleParliamentUi.answerZone, 'a receipt publishes no zone').to.eq(false);
  });

  it('the face wears the viewer\'s LIVE model and ticks on the touchdown, the receipt\'s pose follows the stage\'s phase — and an asker alone is `solo`', async () => {
    const live = {name: ASKER, resources: 7, isDisabled: false} as CardModel;
    const w = stage({answer: answer([share(ASKER, 1, 1), share(OTHER, 0, 2)]), askerModel: live});
    expect(w.findComponent(CardStub).props('card'), 'the live model, its count the receipt\'s «before»').to.deep.eq({...live, resources: 1});
    cardResourceLandings.by = {[ASKER]: 5};
    await nextTick();
    expect(w.findComponent(CardStub).props('card'), '…plus what has touched down, never more than its share').to.deep.eq({...live, resources: 2});

    const poses: Array<[TableAnswerPhase, string]> = [['rise', 'present'], ['pay', 'pay'], ['read', 'read'], ['leave', 'leave'], ['enter', 'enter']];
    for (const [phase, pose] of poses) {
      tableAnswerState.phase = phase;
      await nextTick();
      expect(w.attributes('data-tans-phase')).to.eq(phase);
      expect(w.findComponent(ReceiptStub).props('phase'), `the stage's «${phase}»`).to.eq(pose);
    }

    await w.setProps({answer: answer([share(ASKER, 0, 1)])});
    expect(w.classes()).to.include('con-tans--solo');
    expect(w.find('[data-tans-row]').exists()).to.eq(false);
    expect(w.find('.con-tans__zone').classes()).to.not.include('con-tans__zone--on');
    expect(w.find('.con-tans__zone').attributes('data-tans-zone-open')).to.eq(undefined);
  });

  it('a QUESTION: the zone is the picker\'s slot — published only once the stage has ENTERED, retracted with the stage', async () => {
    const w = stage({asking, embedded: true});
    expect(w.classes()).to.include.members(['con-tans--question', 'con-tans--embedded']);
    expect(w.classes()).to.not.include('con-tans--solo');
    expect(w.attributes('data-tans-mode')).to.eq('question');
    expect(w.attributes('data-tans-asker')).to.eq(ASKER);
    expect(w.attributes('data-tans-cause')).to.eq('card');
    expect(w.find('[data-tans-asker-face]').attributes('data-tans-card'), 'in a question the chosen capsule is the picker\'s own').to.eq(undefined);
    expect(w.findComponent(CardStub).props('card')).to.deep.eq({name: ASKER});
    expect(w.find('[data-tans-walk]').text(), 'a question carries no walk').to.eq('0→0');
    expect(w.find('[data-tans-gain] b').text()).to.eq('+2');
    expect(w.find('.con-tans__zone').classes()).to.include('con-tans__zone--on');
    expect(w.find('.con-tans__embed' + ZONE).exists()).to.eq(true);
    expect(w.find('[data-tans-row]').exists()).to.eq(false);

    expect(consoleParliamentUi.answerZone, 'the stage has not entered — the picker renders nowhere').to.eq(false);
    tableAnswerState.paneIn = true;
    await nextTick();
    expect(consoleParliamentUi.answerZone, 'the unfold played: the zone is published').to.eq(true);
    w.unmount();
    expect(consoleParliamentUi.answerZone, 'the zone leaves with the stage').to.eq(false);

    // A stage mounted when the pane is already in publishes at once (the watcher is immediate) …
    const again = stage({asking});
    expect(consoleParliamentUi.answerZone).to.eq(true);
    // … and a question that is answered takes the zone back while the stage still stands.
    await again.setProps({asking: undefined, answer: answer([share(OTHER, 0, 2)])});
    expect(consoleParliamentUi.answerZone).to.eq(false);
    expect(again.find(ZONE).exists()).to.eq(false);
  });
});

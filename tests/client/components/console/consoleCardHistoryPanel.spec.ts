/*
 * ConsoleCardHistoryPanel — the «СТАТИСТИКА» tab of the inspect dossier. A `<script setup>` component (step A of
 * docs/claude/vapor/RECIPES.md): what it renders for the pre-built snapshot — the calm empty state, the card block,
 * the selected action's footprint. The snapshots are the real builder's (`buildActionInspectHistory`); the unit
 * runner renders the English keys.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {Units} from '@/common/Units';
import {$t} from '@/client/directives/i18n';
import {ActionInspectHistory, buildActionInspectHistory} from '@/client/components/actions/actionInspectHistory';
import {ActionBranchScope} from '@/client/components/actions/actionUsageSummary';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import ConsoleCardHistoryPanel from '@/client/components/console/ConsoleCardHistoryPanel.vue';

// The scroll primitive measures layout — its own specs' subject; here it is the box the body stands in.
// (A render function, not a template string: the runtime compiler is not in this build.)
const ScrollStub = defineComponent({
  name: 'ConsoleScrollArea',
  props: {axis: String},
  render() {
    return h('div', {'class': 'scroll-stub', 'data-axis': this.axis}, this.$slots.default?.());
  },
});

const noUnits = (): Units => ({megacredits: 0, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0});

function stat(over: Partial<EffectOverlayStat>): EffectOverlayStat {
  return {
    sourceKey: 'card:X',
    kind: 'card',
    card: 'X' as never,
    triggerCount: 0,
    megacreditsSaved: 0,
    cardsDrawn: 0,
    stock: noUnits(),
    production: noUnits(),
    cardResources: {},
    paymentResources: {},
    paymentValueBonus: {} as never,
    colonyTrack: {} as never,
    tradeDiscount: {} as never,
    greeneryDiscount: {} as never,
    tr: 0,
    globalParameterSteps: {},
    vp: 0,
    ...over,
  };
}

function panel(history: ActionInspectHistory) {
  return mount(ConsoleCardHistoryPanel, {
    ...globalConfig,
    props: {history},
    global: {...globalConfig.global, stubs: {ConsoleScrollArea: ScrollStub}},
  });
}

describe('ConsoleCardHistoryPanel — the inspect dossier\'s «СТАТИСТИКА»', () => {
  it('no history at all — one calm message inside the scroll body, never dead zeros', () => {
    const w = panel(buildActionInspectHistory(undefined, undefined, undefined, {index: 0, total: 1}));
    expect(w.classes()).to.deep.eq(['con-cardhist']);
    const scroll = w.find('.scroll-stub');
    expect(scroll.classes()).to.contain('con-cardhist__scroll');
    expect(scroll.attributes('data-axis')).to.eq('y');
    expect(scroll.find('.con-cardhist__body > .con-cardhist__empty').text()).to.contain($t('This card has no history in the current game yet.'));
    expect(w.find('.con-cardhist__group').exists()).to.eq(false);
    expect(w.find('.con-cardhist__row').exists()).to.eq(false);
  });

  it('a used branch of a multi-action card: the card\'s facts, the option, the branch\'s own lines, the card-level caption', () => {
    const scope: ActionBranchScope = {mineTokens: ['cardres:floaters'], siblingTokens: ['cards']};
    const history = buildActionInspectHistory(
      stat({triggerCount: 4, cardsDrawn: 2, cardResources: {Floater: 5} as never, lastTrigger: {generation: 6, impact: {} as never}}),
      scope,
      {icon: 'Floater', count: 5},
      {index: 0, total: 2},
    );
    const w = panel(history);
    expect(w.find('.con-cardhist__empty').exists()).to.eq(false);

    // A. the card as an object: what it holds, how often it fired, when it last did.
    const card = w.find('.con-cardhist__group--card');
    expect(card.find('.con-cardhist__kind').text()).to.eq($t('Card history'));
    const cardRows = card.findAll('.con-cardhist__row');
    expect(cardRows.map((r) => r.find('.con-cardhist__row-label').text())).to.deep.eq([$t('Resources on this card'), $t('Activations'), $t('Last used')]);
    expect(cardRows.map((r) => r.find('.con-cardhist__row-value').text())).to.deep.eq(['5', '4', `${$t('GEN.')} 6`]);
    // The raw icon key is normalized before it reaches the sprite table («Floater» → `floater`).
    expect(cardRows[0].find('i.con-cardhist__icon').classes()).to.include.members(iconClassFor('floater').split(' '));
    expect(card.find('.con-cardhist__note').exists(), 'the action fired — no «has not fired» note').to.eq(false);

    // B. the selected option's own footprint.
    const action = w.find('.con-cardhist__group--action');
    expect(action.find('.con-cardhist__kind').text()).to.contain($t('Selected action'));
    expect(action.find('.con-cardhist__variant').text().replace(/\s+/g, ' ')).to.eq(`${$t('Option')} 1 / 2`);
    const lines = action.findAll('.con-cardhist__row');
    expect(lines.length).to.eq(history.action.lines.length);
    expect(lines.map((r) => r.find('.con-cardhist__row-label').text())).to.deep.eq(history.action.lines.map((l) => $t(l.label)));
    expect(lines.map((r) => r.find('.con-cardhist__row-value').text())).to.deep.eq(history.action.lines.map((l) => l.value));
    expect(action.find('.con-cardhist__note').text()).to.eq($t('Activations are counted for the whole card.'));
    expect(action.find('.con-cardhist__note--empty').exists()).to.eq(false);
  });

  it('a card that holds a resource but never fired: the stored count, and a note instead of «0 activations»', () => {
    const w = panel(buildActionInspectHistory(undefined, undefined, {icon: 'microbes', count: 4}, {index: 0, total: 1}));
    const card = w.find('.con-cardhist__group--card');
    const rows = card.findAll('.con-cardhist__row');
    expect(rows.map((r) => r.find('.con-cardhist__row-label').text())).to.deep.eq([$t('Resources on this card')]);
    expect(rows[0].find('.con-cardhist__row-value').text()).to.eq('4');
    expect(card.find('.con-cardhist__note').text()).to.eq($t('This card\'s action has not fired this game.'));

    const action = w.find('.con-cardhist__group--action');
    expect(action.find('.con-cardhist__variant').exists(), 'a single-action card names no option').to.eq(false);
    expect(action.find('.con-cardhist__row').exists()).to.eq(false);
    expect(action.find('.con-cardhist__note--empty').text()).to.eq($t('This action has not fired this game.'));
  });

  it('follows its snapshot — the empty state gives way to the blocks', async () => {
    const w = panel(buildActionInspectHistory(undefined, undefined, undefined, {index: 0, total: 1}));
    expect(w.find('.con-cardhist__empty').exists()).to.eq(true);
    await w.setProps({history: buildActionInspectHistory(stat({triggerCount: 1, tr: 2}), undefined, undefined, {index: 0, total: 1})});
    expect(w.find('.con-cardhist__empty').exists()).to.eq(false);
    expect(w.find('.con-cardhist__group--card .con-cardhist__row-value').text()).to.eq('1');
    expect(w.findAll('.con-cardhist__group--action .con-cardhist__row').length).to.be.greaterThan(0);
  });
});

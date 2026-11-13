/*
 * ConsoleActionGroupView — ONE CARD'S ACTIONS: the card plate and its action slots, one markup for two hosts (the
 * acting «Действия карт» workspace drives the cursor / shake / descent through its props; a host that only READS
 * passes `readonly`). A `<script setup>` component (step A of docs/claude/vapor/RECIPES.md): it emits and exposes
 * nothing, and takes its two directives (`v-i18n`, `v-strip-action-prefix`) as imported bindings.
 */
import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {defineComponent, h} from 'vue';
import {globalConfig} from '../getLocalVue';
import {$t} from '@/client/directives/i18n';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {PartyName} from '@/common/turmoil/PartyName';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {ConsoleActionFlatTile, ConsoleActionGroup, ParliamentActionSource} from '@/client/console/consoleCardActions';
import {slotMeta, sourceUsesText, TILE_STATUS_LABEL} from '@/client/console/actionTileView';
import ConsoleActionGroupView from '@/client/components/console/ConsoleActionGroupView.vue';

// A party's printed formula is the Parliament's own component — this spec reads what the tile HANDS it.
// (Render functions, not template strings: the runtime compiler is not in this build.)
const FormulaStub = defineComponent({name: 'ConsolePartyFormula', props: ['party', 'renderRoot', 'size'], render: () => h('i', {class: 'formula-stub'})});

const CARD = CardName.REGOLITH_EATERS;

/** A TEXT-drawn slot (no printed graphic): the canvas is the action's own sentence. */
function tile(over: Record<string, unknown> = {}): ConsoleActionFlatTile {
  return {
    key: `${CARD}#0`, cardName: CARD, nodeIndex: 0, node: {key: `${CARD}#0`, actionNode: undefined, renderRoot: undefined, text: 'Action: spend 1 energy'},
    status: 'available', branch: undefined, costEffects: [], gainEffects: [], variableCost: [], variableGain: [], variableChoice: [],
    hasChoices: false, usedThisGen: false, choiceKinds: [], reason: undefined, blocker: undefined, variantTotal: 1,
    cardResource: undefined, isCorporation: false, rules: undefined, joinLeft: false,
    ...over,
  } as unknown as ConsoleActionFlatTile;
}

function group(tiles: ReadonlyArray<ConsoleActionFlatTile>, over: Record<string, unknown> = {}): ConsoleActionGroup {
  return {
    key: CARD, cardName: CARD, isCorporation: false, status: 'available', sortStatus: 'available', usedThisGen: false,
    cardResource: undefined, vp: undefined, tiles,
    ...over,
  } as unknown as ConsoleActionGroup;
}

function view(props: Record<string, unknown>) {
  return mount(ConsoleActionGroupView as any, {
    ...globalConfig,
    props,
    global: {...globalConfig.global, stubs: {ConsolePartyFormula: FormulaStub}},
  });
}

describe('ConsoleActionGroupView — one card\'s actions, for the host that acts and the host that reads', () => {
  it('a card\'s group: the plate names the source and what the whole card owns, the slot its own sentence', () => {
    const w = view({group: group([tile()], {cardResource: {type: CardResource.MICROBE, count: 3}, vp: {points: 1, toNext: 2}})});
    // The template STARTS WITH ITS ROOT.
    expect((w.element as Element).tagName).to.eq('DIV');
    expect(w.classes()).to.include.members(['con-cardactions__group', 'con-cardactions__group--available']);
    for (const state of ['wide', 'live', 'futile', 'readonly']) {
      expect(w.classes(), state).to.not.include('con-cardactions__group--' + state);
    }
    expect(w.attributes('data-action-group')).to.eq(CARD);
    expect(w.find('.con-cardactions__plate-name').text()).to.eq($t(CARD));
    expect(w.find('.con-cardactions__plate-kicker').exists(), 'a card wears no party kicker').to.eq(false);
    expect(w.find('.con-cardactions__plate-emblem').exists()).to.eq(false);
    const stored = w.find('.con-cardactions__res-icon');
    expect(stored.classes()).to.include.members(iconClassFor('microbe').split(' '));
    expect(stored.element.parentElement?.querySelector('b')?.textContent).to.eq('3');
    const vp = w.find('.con-cardactions__plate-chip--vp');
    expect(vp.find('b').text()).to.eq('1');
    expect(vp.find('.con-cardactions__plate-vp-unit').text()).to.eq($t('VP'));
    expect(vp.find('em').text()).to.eq('+1 · 2');

    const slot = w.find('.con-cardactions__tile');
    expect(slot.classes()).to.include('con-cardactions__tile--available');
    expect(slot.attributes('data-action-card')).to.eq(CARD);
    expect(slot.attributes('data-action-verdict')).to.eq('available');
    expect(slot.attributes('data-action-futile')).to.eq(undefined);
    expect(slot.find('.con-cardactions__tile-status').exists(), '«available» is the norm and says nothing').to.eq(false);
    // `v-strip-action-prefix` (the imported binding): the surface itself says «actions».
    expect(slot.find('.con-cardactions__graphic-text').text()).to.eq('Spend 1 energy');
    expect(slot.find('.con-cardactions__desc-slot').exists(), 'a text-drawn action has no second sentence').to.eq(false);
  });

  it('the ACTING host: its cursor, shake and descent mark the slot they name; a blocked slot says why, a live one what it asks next', async () => {
    const blocked = tile({key: `${CARD}#1`, nodeIndex: 1, variantTotal: 2, joinLeft: true, status: 'rules', reason: {message: 'Not enough energy', params: []}});
    const asking = tile({variantTotal: 2, choiceKinds: ['payment']});
    const w = view({group: group([asking, blocked]), focusKey: asking.key, shakeKey: blocked.key});
    expect(w.classes()).to.include.members(['con-cardactions__group--wide', 'con-cardactions__group--live']);
    expect(w.find('.con-cardactions__acts').classes()).to.include('con-cardactions__acts--pair');
    const slots = w.findAll('.con-cardactions__tile');
    expect(slots[0].classes()).to.include('con-cardactions__tile--focused');
    expect(slots[0].classes()).to.not.include('con-cardactions__tile--shake');
    expect(slots[1].classes()).to.include.members(['con-cardactions__tile--rules', 'con-cardactions__tile--shake']);
    expect(slots[1].classes()).to.not.include('con-cardactions__tile--focused');
    // The way-finder and the «или» joint of a two-variant card.
    expect(slots.map((s) => s.find('.con-cardactions__tile-variant').text())).to.deep.eq([`${$t('Option')} 1`, `${$t('Option')} 2`]);
    expect(slots[1].find('.con-cardactions__or--joint').text()).to.eq($t('or'));
    expect(slots[0].find('.con-cardactions__or--joint').exists()).to.eq(false);
    // The blocked slot: the verdict chip and the rules' reason; the live one: the step its graphic cannot draw.
    expect(slots[1].attributes('data-action-verdict')).to.eq('rules');
    expect(slots[1].find('.con-cardactions__tile-status').text()).to.eq($t(TILE_STATUS_LABEL.rules));
    const reason = slots[1].find('.con-cardactions__tile-reason');
    expect(reason.classes()).to.include('con-cardactions__tile-reason--danger');
    expect(reason.text()).to.contain(slotMeta(blocked).text);
    expect(slots[0].find('.con-cardactions__tile-choices').text()).to.contain(slotMeta(asking).text);

    await w.setProps({focusKey: '', shakeKey: '', descendKey: asking.key});
    expect(w.classes()).to.not.include('con-cardactions__group--live');
    expect(w.find('.con-cardactions__tile--focused').exists()).to.eq(false);
    expect(w.find('.con-cardactions__tile--shake').exists()).to.eq(false);
    expect(w.findAll('.con-cardactions__tile')[0].classes()).to.include('con-cardactions__tile--descend');
  });

  it('a host that only READS: no cursor, no verb — the turn gate reads as the rules allow it', () => {
    const gated = tile({status: 'soft', choiceKinds: ['card'], reason: {message: 'Not your turn', params: []}});
    const w = view({group: group([gated], {status: 'soft'}), readonly: true, focusKey: gated.key, shakeKey: gated.key, descendKey: gated.key});
    expect(w.classes()).to.include('con-cardactions__group--readonly');
    expect(w.classes()).to.not.include('con-cardactions__group--live');
    const slot = w.find('.con-cardactions__tile');
    expect(slot.classes()).to.include('con-cardactions__tile--available');
    for (const state of ['soft', 'focused', 'shake', 'descend']) {
      expect(slot.classes(), state).to.not.include('con-cardactions__tile--' + state);
    }
    expect(slot.attributes('data-action-verdict')).to.eq('available');
    expect(slot.find('.con-cardactions__tile-status').exists(), 'the turn gate is no news here').to.eq(false);
    expect(slot.find('.con-cardactions__tile-reason').exists()).to.eq(false);
    expect(slot.find('.con-cardactions__tile-choices').exists(), 'a next step nobody takes from a read-only host').to.eq(false);
  });

  it('a PARTY source: its seal, its kicker, the glossary\'s name, its uses this generation — and the party\'s own formula', () => {
    const party = PartyName.GREENS;
    const partyTile = tile({key: 'party:greens', party, node: {key: 'party:greens', actionNode: undefined, renderRoot: undefined, text: undefined}});
    const sources = [{party, actionId: 'greens-action', usesLeft: 1, usesPerGeneration: 2}] as unknown as ReadonlyArray<ParliamentActionSource>;
    const w = view({group: group([partyTile], {party, allyVia: PartyName.SCIENTISTS}), parliamentActionSources: sources});
    expect(w.find('.con-cardactions__plate').classes()).to.include('con-cardactions__plate--party');
    expect(w.find('.con-cardactions__plate-emblem').attributes('src')).to.eq(partyEmblemUrl(party));
    expect(w.find('.con-cardactions__plate-kicker').text()).to.eq($t('Party action'));
    expect(w.find('.con-cardactions__plate-name').text()).to.eq($t(partyNameKey(party)));
    expect(w.find('.con-cardactions__plate-ally').attributes('data-action-ally-via')).to.eq(PartyName.SCIENTISTS);
    expect(w.find('.con-cardactions__plate-chip--uses').text()).to.eq(sourceUsesText(partyTile, sources));
    const slot = w.find('.con-cardactions__tile');
    expect(slot.classes()).to.include('con-cardactions__tile--party');
    expect(slot.attributes('data-action-party')).to.eq(party);
    const formula = w.findComponent(FormulaStub);
    expect(formula.props('party')).to.eq(party);
    expect(formula.props('size')).to.eq('compact');
  });
});

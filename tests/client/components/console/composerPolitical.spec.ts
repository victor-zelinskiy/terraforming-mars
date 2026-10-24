import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import {expect} from 'chai';
import ConsoleActionComposer from '@/client/components/console/ConsoleActionComposer.vue';
import {PartyName} from '@/common/turmoil/PartyName';
import {getPartyEffect} from '@/client/parliament/ClientParliamentManifest';
import {actionNodeOf} from '@/client/console/parliament/actionRows';
import {PoliticalActionEntry} from '@/client/components/actions/actionModel';
import {PoliticalActionPreview} from '@/common/models/ActionPreviewModel';

/*
 * «ОДИН ФРЕЙМВОРК» (Turmoil Redux, 2026-10-24): a party's action is composed by THE card actions' composer — the
 * owner's own example, the Reds' «draw 2, then discard 2». The hero slot holds the party's PLAQUE (decision Р2), the
 * source is a TYPED key (never a stand-in card name), the commit is the composer's own — nothing of the party composer.
 */
const GlyphStub = {name: 'GamepadGlyph', props: ['control'], template: '<i class="glyph-stub" />'};

const PLAYER_VIEW: any = {
  id: 'p1',
  thisPlayer: {color: 'blue', name: 'Me', megacredits: 10, steel: 0, titanium: 0, plants: 0, energy: 0, heat: 0, tableau: []},
  players: [{color: 'blue', name: 'Me', tableau: []}],
  game: {generation: 2},
  cardsInHand: [],
};

function redsEntry(): PoliticalActionEntry {
  const root = getPartyEffect(PartyName.REDS)!.actionRenderData!;
  return {
    group: {key: 'PARTY_Reds', nodes: [{key: 'PARTY_Reds#0', actionNode: actionNodeOf(root), renderRoot: root, text: undefined}]},
    source: {kind: 'party', party: PartyName.REDS},
    key: 'PARTY_Reds',
    party: PartyName.REDS,
    isCorporation: false,
    state: {status: 'available', activatable: true, reasons: [], softReason: undefined},
  };
}

const REDS_PREVIEW: PoliticalActionPreview = {
  source: {kind: 'party', party: PartyName.REDS},
  answer: 'option',
  kind: 'bespoke',
  branches: [{
    index: -1, title: 'Draw 2 cards, then discard 2 cards (Reds)', available: true, renderKeys: [],
    effects: [{direction: 'gain', icon: 'cards', amount: 2}, {direction: 'cost', icon: 'cards', amount: 2, note: 'discard'}],
    steps: [],
  }],
};

function factory() {
  return mount(ConsoleActionComposer, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {'GamepadGlyph': GlyphStub}},
    props: {playerView: PLAYER_VIEW, entry: redsEntry(), preview: REDS_PREVIEW, nodeIndex: 0},
  });
}

describe('ConsoleActionComposer — a POLITICAL source (the Reds in the card composer)', () => {
  it('the hero slot holds the party\'s plaque, keyed by the party\'s zoom entry — no card face, no card model', () => {
    const w = factory();
    expect(w.find('.con-composer__actplaque').exists(), 'the plaque in the hero slot').is.true;
    expect(w.findComponent({name: 'ConsoleCardFaceLite'}).exists(), 'no card face for a party').is.false;
    const wrap = w.find('.con-composer__actcardwrap');
    expect(wrap.attributes('data-zoom-slot'), 'L3 / X lift the party\'s effect').to.eq('PARTY_Reds');
    expect(wrap.attributes('data-motion-anchor')).to.eq('card:PARTY_Reds');
    const vm = w.vm as any;
    expect(vm.sourceKey).to.eq('PARTY_Reds');
    expect(vm.heroCardName, 'a party holds no card').to.eq(undefined);
    expect(vm.heroCardModel).to.eq(undefined);
    expect(vm.storedResource, 'a party holds no resource').to.eq(undefined);
  });

  it('a bare commit is confirmable at once and its confirm carries no branch pick (the menu option is answered by the host)', () => {
    const w = factory();
    const vm = w.vm as any;
    expect(vm.canConfirm).to.eq(true);
    vm.submit();
    const emitted = w.emitted('confirm');
    expect(emitted, 'the confirm is emitted').to.have.length(1);
    expect((emitted![0][0] as any).branchIndex).to.eq(-1);
    expect((emitted![0][0] as any).stepResponses).to.deep.eq([]);
  });
});

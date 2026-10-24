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

function factory(entry: PoliticalActionEntry = redsEntry(), preview: PoliticalActionPreview = REDS_PREVIEW) {
  return mount(ConsoleActionComposer, {
    ...globalConfig,
    global: {...globalConfig.global, stubs: {'GamepadGlyph': GlyphStub}},
    props: {playerView: PLAYER_VIEW, entry, preview, nodeIndex: 0},
  });
}

function partyEntry(party: PartyName): PoliticalActionEntry {
  const root = getPartyEffect(party as never)!.actionRenderData!;
  return {
    group: {key: `PARTY_${party}`, nodes: [{key: `PARTY_${party}#0`, actionNode: actionNodeOf(root), renderRoot: root, text: undefined}]},
    source: {kind: 'party', party: party as never},
    key: `PARTY_${party}`,
    party: party as never,
    isCorporation: false,
    state: {status: 'available', activatable: true, reasons: [], softReason: undefined},
  };
}

const pick = (titles: Array<string>) => ({type: 'or', title: 'pick', options: titles.map((title) => ({type: 'option', title}))});

describe('ConsoleActionComposer — the Industrialists and Unity in the card composer (С3)', () => {
  it('the Industrialists\' two-part pick is two rows, and the commit waits for both', () => {
    const preview: PoliticalActionPreview = {
      source: {kind: 'party', party: PartyName.INDUSTRIALISTS as never},
      answer: 'direct',
      kind: 'bespoke',
      branches: [{
        index: -1, title: 'Shift', available: true, renderKeys: [], effects: [], steps: [],
        optionInput: {type: 'and', title: 'Shift', options: [pick(['Decrease steel production']), pick(['Increase megacredits production 2 steps', 'Increase energy production 2 steps'])]} as never,
      }],
    };
    const w = factory(partyEntry(PartyName.INDUSTRIALISTS), preview);
    const vm = w.vm as any;
    expect(vm.allChoices.map((c: any) => c.id)).to.deep.eq(['option#0', 'option#1']);
    expect(vm.canConfirm).to.eq(false);
    vm.captureFor(vm.allChoices[0], {type: 'or', index: 0, response: {type: 'option'}});
    expect(vm.canConfirm, 'one part answered is not an answer').to.eq(false);
    vm.captureFor(vm.allChoices[1], {type: 'or', index: 1, response: {type: 'option'}});
    expect(vm.capturedOption).to.deep.eq({type: 'and', responses: [{type: 'or', index: 0, response: {type: 'option'}}, {type: 'or', index: 1, response: {type: 'option'}}]});
  });

  it('the Industrialists\' parts are answered through their own pick lists (A on a tile), the rows read the answer', async () => {
    const preview: PoliticalActionPreview = {
      source: {kind: 'party', party: PartyName.INDUSTRIALISTS as never},
      answer: 'direct',
      kind: 'bespoke',
      branches: [{
        index: -1, title: 'Shift', available: true, renderKeys: [], effects: [], steps: [],
        optionInput: {type: 'and', title: 'Shift', options: [pick(['Decrease steel production']), pick(['Increase megacredits production 2 steps', 'Increase energy production 2 steps'])]} as never,
      }],
    };
    const w = factory(partyEntry(PartyName.INDUSTRIALISTS), preview);
    const vm = w.vm as any;
    for (const id of ['option#0', 'option#1']) {
      vm.sub = {kind: 'list', choiceId: id, index: 0};
      await w.vm.$nextTick();
      expect(vm.listItems.length, `${id} lists its options`).to.be.greaterThan(0);
      vm.pickListItem(0);
      await w.vm.$nextTick();
      expect(vm.sub, `${id} answered closes the list`).to.eq(undefined);
    }
    expect(vm.capturedOption).to.deep.eq({type: 'and', responses: [{type: 'or', index: 0, response: {type: 'option'}}, {type: 'or', index: 0, response: {type: 'option'}}]});
    expect(vm.canConfirm).to.eq(true);
  });

  it('Unity\'s branch is the trade\'s door, its payment path the PARTY\'s — the verb names the colony, nothing is composed here', () => {
    const preview: PoliticalActionPreview = {
      source: {kind: 'party', party: PartyName.UNITY as never},
      answer: 'option',
      kind: 'bespoke',
      branches: [{index: -1, title: '', available: true, renderKeys: [], effects: [], steps: [{kind: 'colonyTrade', party: PartyName.UNITY as never}]}],
    };
    const w = factory(partyEntry(PartyName.UNITY), preview);
    const vm = w.vm as any;
    expect(vm.tradeEntryStep).to.deep.eq({card: '', party: PartyName.UNITY});
    expect(vm.tradeEntryCard).to.eq(undefined);
    expect(vm.commitVerbKey).to.eq('Choose a colony');
  });
});

describe('ConsoleActionComposer — a POLITICAL source (the Reds in the card composer)', () => {
  it('the hero slot holds the party\'s plaque, keyed by the party\'s zoom entry — no card face, no card model', () => {
    const w = factory();
    expect(w.find('.con-composer__actparty .pcard.pcard--party-face').exists(), 'the party drawn as a CARD in the hero slot (Р2)').is.true;
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

describe('ConsoleActionComposer — the prepared draw stage reserves the BATCH, never the discard that follows it', () => {
  it('the Reds\' answer carries the batch AND the hand discard: the discard\'s candidates are no drawn card (П3)', () => {
    const hand = ['Trees', 'Lichen', 'Birds', 'Fish', 'Pets', 'Moss', 'Algae', 'Grass', 'Heather'].map((name) => ({name}));
    const view = {...PLAYER_VIEW, waitingFor: {type: 'card', title: 'discard', cards: hand, min: 2, max: 2, discardPrompt: {}}};
    const w = mount(ConsoleActionComposer, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {'GamepadGlyph': GlyphStub}},
      props: {playerView: view, entry: redsEntry(), preview: REDS_PREVIEW, nodeIndex: 0},
    });
    expect((w.vm as unknown as {beatRevealedNames: ReadonlyArray<string>}).beatRevealedNames, 'a hand discard is never the draw').to.deep.eq([]);
    // A card PICK of the drawn cards (a buy) still names them — the prompt's candidates ARE the batch.
    const buy = mount(ConsoleActionComposer, {
      ...globalConfig,
      global: {...globalConfig.global, stubs: {'GamepadGlyph': GlyphStub}},
      props: {playerView: {...PLAYER_VIEW, waitingFor: {type: 'card', title: 'buy', cards: hand.slice(0, 2), min: 0, max: 2}}, entry: redsEntry(), preview: REDS_PREVIEW, nodeIndex: 0},
    });
    expect((buy.vm as unknown as {beatRevealedNames: ReadonlyArray<string>}).beatRevealedNames).to.deep.eq(['Trees', 'Lichen']);
  });
});

import {expect} from 'chai';
import {mount} from '@vue/test-utils';
import {globalConfig} from '../getLocalVue';
import ConsoleEffectsExplorer from '@/client/components/console/ConsoleEffectsExplorer.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PartyName} from '@/common/turmoil/PartyName';
import {ParliamentModel, PartyAccessModel} from '@/common/models/ParliamentModel';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {politicalSources} from '@/client/console/parliament/politicalSources';
import {politicalEffectEntries} from '@/client/console/parliament/politicalEffects';
import {createEffectsExplorerUi, EffectsExplorerUi} from '@/client/console/consoleEffectsExplorer';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';

/*
 * «ОДИН ФРЕЙМВОРК» (Turmoil Redux, 2026-10-24): the Parliament's standing effects are GROUPS of the effects explorer's
 * own grid — never a strip over it. The focus reaches them (П1), A descends into the same detail layer with the
 * party's plaque in the hero's slot, the crumb names the party, «За партию» is honestly absent, X has a face to open.
 */
const BLUE = 'blue';
const FORESTRY_SUPPORT = 'RDX_GREENS_FORESTRY_SUPPORT';

function access(party: ReduxParty, over: Partial<PartyAccessModel> = {}): PartyAccessModel {
  return {party, ruling: false, delegates: 0, byDelegates: false, granted: [], hasEffect: false, satisfiesRequirement: false, ...over};
}

function model(): ParliamentModel {
  return {
    players: [{
      color: BLUE, participates: true, partyActionUses: {}, resolutionActionUses: 0, influence: 0,
      access: REDUX_PARTIES.map((p) => access(p, p === PartyName.GREENS ? {hasEffect: true, ruling: true} :
        p === PartyName.SCIENTISTS ? {hasEffect: true, byDelegates: true, delegates: 2} : {})),
    }],
    slots: [],
    enacted: {instance: `${FORESTRY_SUPPORT}#0`, resolution: FORESTRY_SUPPORT, party: PartyName.GREENS},
  } as unknown as ParliamentModel;
}

const PETS = {name: CardName.PETS, resources: 2} as CardModel;

function mountExplorer(ui: EffectsExplorerUi) {
  const parliament = model();
  return mount(ConsoleEffectsExplorer, {
    global: globalConfig.global,
    props: {
      cards: [PETS],
      color: BLUE,
      stats: [],
      explorerUi: ui,
      politicalEntries: politicalEffectEntries(politicalSources(parliament, BLUE), {parliament, viewerColor: BLUE}),
    },
  });
}

const nav = (dir: 'up' | 'down' | 'left' | 'right'): GamepadIntent => ({kind: 'nav', dir, repeat: false});

describe('ConsoleEffectsExplorer — the Parliament\'s effects are groups of the grid', () => {
  it('the law, then the ruling party, then the held party, then the cards — each a group with the badge plate', () => {
    const w = mountExplorer(createEffectsExplorerUi());
    const plates = w.findAll('.con-efx__plate--political');
    expect(plates.map((p) => p.attributes('data-efx-source'))).deep.eq([`law:${FORESTRY_SUPPORT}`, 'party:Greens', 'party:Scientists']);
    expect(plates[0].find('.con-efx__plate-kicker').text()).eq('Effect while enacted');
    expect(plates[1].find('.con-efx__plate-kicker').text()).eq('Party effect');
    expect(plates[1].find('.con-efx__plate-emblem').exists(), 'the party\'s emblem on the plate').is.true;
    // The card's group keeps its own plate.
    expect(w.findAll('.con-efx__plate').length).eq(plates.length + 1);
    // Every political tile wears the access reading instead of a statistic.
    expect(w.findAll('[data-efx-access]').length).greaterThan(0);
    expect(w.findAll('.con-efx__meta-line--stat').length, 'no political tile claims a statistic').eq(0);
  });

  it('П1 · the focus REACHES every political tile — the d-pad walks the same rows', async () => {
    const ui = createEffectsExplorerUi();
    const w = mountExplorer(ui);
    await w.vm.$nextTick();
    const keys = w.findAll('[data-effect-key]').map((t) => t.attributes('data-effect-key') ?? '');
    const visited = new Set<string>([ui.focusKey]);
    const explorer = w.vm as unknown as {handleIntent: (i: GamepadIntent) => void};
    for (let i = 0; i < keys.length * 3; i++) {
      explorer.handleIntent(nav(i % 2 === 0 ? 'down' : 'right'));
      await w.vm.$nextTick();
      visited.add(ui.focusKey);
    }
    expect(keys.filter((k) => k.startsWith('party:') || k.startsWith('law:')).every((k) => visited.has(k)), `visited ${[...visited].join(', ')}`).is.true;
  });

  it('A on a party\'s tile opens the SAME detail layer: the plaque in the hero\'s slot, its rule and access, no «За партию»', async () => {
    const ui = createEffectsExplorerUi();
    const w = mountExplorer(ui);
    await w.vm.$nextTick();
    ui.focusKey = 'party:Greens#0';
    await w.vm.$nextTick();
    (w.vm as unknown as {handleIntent: (i: GamepadIntent) => void}).handleIntent({kind: 'press', button: 'confirm'});
    await w.vm.$nextTick();
    expect(ui.detail).deep.include({cardName: '', effectKey: 'party:Greens#0', title: 'party name: Greens'});
    expect(w.find('.con-efx__hero-card--party .pcard--charter').exists(), 'the party\'s CHARTER stands in the hero\'s slot').is.true;
    expect(w.find('.con-efx__hero').attributes('data-zoom-slot'), 'X has a face to open').eq('PARTY_Greens');
    expect(w.find('.con-efx__rule-access').exists(), 'WHY the seat holds it').is.true;
    expect(w.find('.con-efx__summary').exists(), 'a political source keeps no statistic — no skeleton standing forever').is.false;
  });
});

import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {computeActionState} from '@/client/components/actions/actionPlayability';
import {
  buildActionEntries,
  filterActionEntries,
  buildAvailabilityChips,
  buildActivationChips,
  availableActionCount,
  ActionFilterState,
} from '@/client/components/actions/actionModel';

function card(name: CardName, actionReasons?: CardModel['actionReasons']): CardModel {
  return {name, actionReasons} as CardModel;
}

describe('actionPlayability.computeActionState', () => {
  const base = {used: false, isViewerSeat: true, availableNow: false, awaitingInput: false};

  it('activated when used this generation (highest priority)', () => {
    const s = computeActionState(card(CardName.AI_CENTRAL), {...base, used: true, availableNow: true});
    expect(s.status).to.eq('activated');
    expect(s.activatable).to.eq(false);
  });

  it('available when on own seat and in the server SelectCard', () => {
    const s = computeActionState(card(CardName.AI_CENTRAL), {...base, availableNow: true});
    expect(s.status).to.eq('available');
    expect(s.activatable).to.eq(true);
  });

  it('rules block when the server attached reasons', () => {
    const s = computeActionState(
      card(CardName.AI_CENTRAL, [{type: 'resource', message: 'Not enough energy', resource: 'energy'}]),
      {...base});
    expect(s.status).to.eq('rules');
    expect(s.activatable).to.eq(false);
    expect(s.reasons).to.have.length(1);
  });

  it('soft block (not your turn) when rules-fine but not the window', () => {
    const s = computeActionState(card(CardName.AI_CENTRAL), {...base});
    expect(s.status).to.eq('soft');
    expect(s.softReason?.type).to.eq('turn');
  });

  it('soft block (finish current action) when awaiting input', () => {
    const s = computeActionState(card(CardName.AI_CENTRAL), {...base, awaitingInput: true});
    expect(s.status).to.eq('soft');
    expect(s.softReason?.type).to.eq('phase');
  });

  it('opponent seat is read-only (never activatable)', () => {
    const s = computeActionState(card(CardName.AI_CENTRAL), {...base, isViewerSeat: false, availableNow: true});
    expect(s.status).to.eq('soft');
    expect(s.activatable).to.eq(false);
  });
});

describe('actionModel filters', () => {
  function player(tableau: ReadonlyArray<CardModel>, used: ReadonlyArray<CardName> = []): PublicPlayerModel {
    return {color: 'red', name: 'p', tableau, actionsThisGeneration: used} as unknown as PublicPlayerModel;
  }

  // AI Central (available), Dirigibles (unavailable: reasons), Stormcraft (activated),
  // United Nations Mars Initiative (soft — not your turn).
  const tableau = [
    card(CardName.AI_CENTRAL),
    card(CardName.DIRIGIBLES, [{type: 'target', message: 'No card to add the resource to'}]),
    card(CardName.STORMCRAFT_INCORPORATED),
    card(CardName.UNITED_NATIONS_MARS_INITIATIVE),
  ];
  const ctx = {
    availableNames: new Set<CardName>([CardName.AI_CENTRAL]),
    isViewerSeat: true,
    awaitingInput: false,
    usedNames: new Set<CardName>([CardName.STORMCRAFT_INCORPORATED]),
  };

  it('builds one entry per action source with the right status', () => {
    const entries = buildActionEntries(player(tableau), ctx);
    const byName = new Map(entries.map((e) => [e.cardName, e.state.status]));
    expect(byName.get(CardName.AI_CENTRAL)).to.eq('available');
    expect(byName.get(CardName.DIRIGIBLES)).to.eq('rules');
    expect(byName.get(CardName.STORMCRAFT_INCORPORATED)).to.eq('activated');
    expect(byName.get(CardName.UNITED_NATIONS_MARS_INITIATIVE)).to.eq('soft');
  });

  it('default filter (all + dormant) hides activated, shows the rest', () => {
    const entries = buildActionEntries(player(tableau), ctx);
    const filter: ActionFilterState = {availability: 'all', activation: 'dormant'};
    const shown = filterActionEntries(entries, filter).map((e) => e.cardName);
    expect(shown).to.include(CardName.AI_CENTRAL);
    expect(shown).to.include(CardName.DIRIGIBLES);
    expect(shown).to.include(CardName.UNITED_NATIONS_MARS_INITIATIVE);
    expect(shown).to.not.include(CardName.STORMCRAFT_INCORPORATED); // activated, hidden
  });

  it('availability=available keeps available + soft, drops rules', () => {
    const entries = buildActionEntries(player(tableau), ctx);
    const filter: ActionFilterState = {availability: 'available', activation: 'all'};
    const shown = filterActionEntries(entries, filter).map((e) => e.cardName);
    expect(shown).to.include(CardName.AI_CENTRAL);
    expect(shown).to.include(CardName.UNITED_NATIONS_MARS_INITIATIVE);
    expect(shown).to.not.include(CardName.DIRIGIBLES); // rules block
  });

  it('faceted chips count within the other dimension', () => {
    const entries = buildActionEntries(player(tableau), ctx);
    const filter: ActionFilterState = {availability: 'all', activation: 'dormant'};
    const avail = buildAvailabilityChips(entries, filter);
    // Within the 'dormant' slice: 3 dormant (AI Central, Dirigibles, UNMI).
    expect(avail.find((c) => c.value === 'all')?.count).to.eq(3);
    const activation = buildActivationChips(entries, filter);
    expect(activation.find((c) => c.value === 'activated')?.count).to.eq(1);
    expect(availableActionCount(entries)).to.eq(1); // only AI Central is activatable now
  });
});

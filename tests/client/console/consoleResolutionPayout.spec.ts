import {expect} from 'chai';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentEnactOutcomeModel, ParliamentModel} from '@/common/models/ParliamentModel';
import {detectResolutionPayout, payoutPickLandsInPlace, pickPayoutLandedOn, pickPayoutLanding} from '@/client/console/parliament/consoleResolutionPayout';

/**
 * THE RESOLUTION PAYOUT BEAT — the pure detection the transport gate runs
 * against the authoritative response. It flies ONLY when the view that stood
 * was the payout's own pick AND the response RECORDED the viewer's new
 * card-resource outcome on one of that pick's candidates; a refusal, another
 * seat's payout, a reload (no «before»), a non-resolution pick and an ocean
 * all stay silent.
 */
const AQUIFER = 'RDX_GREENS_AQUIFER_CONTEST';
const BLUE = 'blue' as Color;
const RED = 'red' as Color;

function parliament(phaseOutcomes: ReadonlyArray<ParliamentEnactOutcomeModel> | undefined, over: Partial<ParliamentModel> = {}): ParliamentModel {
  return {
    slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players: [], deckSize: 0, discardSize: 0, neutralSupply: 14, botMode: 'none',
    phase: phaseOutcomes === undefined ? undefined : {generation: 3, final: false, step: 'effects', outcomes: phaseOutcomes},
    ...over,
  };
}

function view(p: ParliamentModel, waitingFor?: unknown): PlayerViewModel {
  return {thisPlayer: {color: BLUE}, game: {parliament: p}, waitingFor} as unknown as PlayerViewModel;
}

const pick = {
  type: 'card', title: 'Add 2 animal(s) to one of your cards', buttonLabel: 'Add resources', min: 1, max: 1,
  cards: [{name: CardName.FISH}, {name: CardName.PETS}],
  resourceGainPrompt: {amount: 2, cardResource: 'animal'},
  choiceContext: {source: {kind: 'resolution', resolution: AQUIFER}, mode: 'reward'},
};

const paid = (player: Color, card: CardName, amount = 2): ParliamentEnactOutcomeModel =>
  ({player, step: 'animals', effect: 'animals', kind: 'cardResource', resource: CardResource.ANIMAL, amount, card, influence: 2});

describe('consoleResolutionPayout', () => {
  it('flies the viewer\'s own recorded payout onto the candidate they chose', () => {
    const before = view(parliament([]), pick);
    const after = view(parliament([paid(BLUE, CardName.PETS)]));
    expect(detectResolutionPayout(before, after)).deep.eq({card: CardName.PETS, resource: 'animal', amount: 2, resolution: AQUIFER});
  });

  it('reads the COMPLETED phase record when this very answer finished the phase', () => {
    const before = view(parliament([]), pick);
    const after = view(parliament(undefined, {
      lastPhase: {
        generation: 3, final: false, winner: {instance: `${AQUIFER}#0`, resolution: AQUIFER, party: PartyName.GREENS, votes: 1},
        support: [], enacted: {instance: `${AQUIFER}#0`, resolution: AQUIFER, party: PartyName.GREENS}, refreshed: [], lobbyRefilled: [],
        outcomes: [paid(BLUE, CardName.FISH, 3)],
      },
    }));
    expect(detectResolutionPayout(before, after)?.amount).eq(3);
    // …but never a previous generation's record.
    const stale = view(parliament(undefined, {
      lastPhase: {
        generation: 2, final: false, winner: {instance: `${AQUIFER}#0`, resolution: AQUIFER, party: PartyName.GREENS, votes: 1},
        support: [], enacted: {instance: `${AQUIFER}#0`, resolution: AQUIFER, party: PartyName.GREENS}, refreshed: [], lobbyRefilled: [],
        outcomes: [paid(BLUE, CardName.FISH, 3)],
      },
    }));
    expect(detectResolutionPayout(before, stale)).is.undefined;
  });

  it('stays silent for a refusal, another seat, a reload, a foreign pick or a card that was never a candidate', () => {
    const before = view(parliament([]), pick);
    expect(detectResolutionPayout(before, view(parliament([]), pick)), 'refused — nothing recorded').is.undefined;
    expect(detectResolutionPayout(before, view(parliament([paid(RED, CardName.FISH)]))), 'another seat').is.undefined;
    expect(detectResolutionPayout(undefined, view(parliament([paid(BLUE, CardName.FISH)]))), 'a reload').is.undefined;
    const foreign = {...pick, choiceContext: {source: {kind: 'card', card: CardName.BIRDS}, mode: 'reward'}};
    expect(detectResolutionPayout(view(parliament([]), foreign), view(parliament([paid(BLUE, CardName.FISH)]))), 'a card-sourced pick').is.undefined;
    expect(detectResolutionPayout(before, view(parliament([paid(BLUE, CardName.BIRDS)]))), 'not a candidate').is.undefined;
    // An outcome recorded BEFORE the pick stood is not this answer's.
    expect(detectResolutionPayout(view(parliament([paid(BLUE, CardName.FISH)]), pick), view(parliament([paid(BLUE, CardName.FISH)])))).is.undefined;
  });

  it('the picker\'s landing tick is scoped to the one candidate being flown into', () => {
    pickPayoutLanding.card = CardName.FISH;
    pickPayoutLanding.landed = 2;
    try {
      expect(pickPayoutLandedOn(CardName.FISH)).eq(2);
      expect(pickPayoutLandedOn(CardName.PETS)).eq(0);
    } finally {
      pickPayoutLanding.card = undefined;
      pickPayoutLanding.landed = 0;
    }
    expect(pickPayoutLandedOn(CardName.FISH)).eq(0);
  });

  it('the payout pick is committed IN PLACE only for a resolution\'s card-resource pick (the server\'s markers)', () => {
    expect(payoutPickLandsInPlace(pick)).is.true;
    expect(payoutPickLandsInPlace({...pick, choiceContext: {source: {kind: 'card'}}}), 'a card-sourced reward keeps its hero departure').is.false;
    expect(payoutPickLandsInPlace({...pick, resourceGainPrompt: undefined}), 'a plain card pick').is.false;
    expect(payoutPickLandsInPlace({type: 'or'}), 'not a card pick').is.false;
    expect(payoutPickLandsInPlace(undefined)).is.false;
  });
});

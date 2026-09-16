/*
 * THE RESOLUTION INSPECTOR'S STATUS (Turmoil Redux) — the pure model behind
 * the fullscreen viewer's FOOTER when the card on the stage is a resolution.
 *
 * It answers exactly TWO questions, kept apart because the player confuses
 * them otherwise:
 *   1. WHERE THE CARD STANDS — up for the vote, or enacted (its lifecycle);
 *   2. THE VIEWER'S ACCESS TO ITS PARTY'S EFFECT — held (and on what basis),
 *      or how many of their OWN delegates stand toward the threshold.
 *
 * Access is the SERVER's verdict (`PartyAccessModel` — the ruling party, two
 * delegates, a card grant), never a count re-derived here; the delegate
 * count is read from the card's own votes filtered to the VIEWER (neutral and
 * other players' delegates never fill the places). Two delegates grant the
 * party EFFECT — they never enact the resolution's OWN effect, which is why
 * the footer names «the party effect» and never a bare «effect».
 *
 * No parliament model (a viewer outside a live game) → no status at all: the
 * footer invents no votes and no personal standing.
 */
import {Color} from '@/common/Color';
import {ParliamentModel, ParliamentPlayerModel, PartyAccessModel} from '@/common/models/ParliamentModel';
import {PARTY_EFFECT_DELEGATES, ReduxParty, ResolutionId} from '@/common/parliament/ParliamentTypes';

export type ResolutionLifecycle = 'vote' | 'enacted';

/** WHY the viewer holds the party effect — the live basis the footer names. */
export type ResolutionAccessBasis = 'delegates' | 'ruling' | 'granted';

export type ResolutionAccessVm = {
  /**
   * `everyone` — the resolution is enacted: its party rules and every player
   *   holds the effect (no personal indicator — nobody's delegates are asked).
   * `held` — the viewer holds the party effect right now (see `basis`).
   * `progress` — not held: `mine` of `threshold` own delegates stand on it.
   */
  kind: 'everyone' | 'held' | 'progress';
  basis?: ResolutionAccessBasis;
  /** The viewer's OWN delegates on THIS card. */
  mine: number;
  threshold: number;
  /**
   * Draw the two threshold places. Shown while the count is what decides
   * (progress) or what granted (held by delegates); hidden for a resolution
   * enacted or an effect held on another basis — an empty pair beside
   * «available» would read as a failed requirement.
   */
  places: boolean;
};

export type ResolutionStatusVm = {
  lifecycle: ResolutionLifecycle;
  /** The card is the winning resolution right now (vote only). */
  winning: boolean;
  party: ReduxParty;
  /** Undefined = the viewer has no seat in the parliament (a spectator, a bot's screen). */
  access: ResolutionAccessVm | undefined;
};

function viewerSeat(model: ParliamentModel, viewer: Color | undefined): ParliamentPlayerModel | undefined {
  if (viewer === undefined) {
    return undefined;
  }
  const seat = model.players.find((p) => p.color === viewer);
  return seat !== undefined && seat.participates ? seat : undefined;
}

function basisOf(access: PartyAccessModel): ResolutionAccessBasis {
  // The basis THIS CARD contributes to outranks the others in the footer's
  // wording: two delegates on it are why the effect is held; the ruling
  // party and a card grant are the other two bases the rules know.
  if (access.byDelegates) {
    return 'delegates';
  }
  if (access.ruling) {
    return 'ruling';
  }
  return 'granted';
}

/**
 * The footer's reading for `id` — undefined when the card is not on the table
 * (neither in the voting area nor enacted) or there is no parliament at all.
 */
export function resolutionStatusOf(id: ResolutionId, model: ParliamentModel | undefined, viewer: Color | undefined): ResolutionStatusVm | undefined {
  if (model === undefined) {
    return undefined;
  }
  const threshold = PARTY_EFFECT_DELEGATES;
  const enacted = model.enacted?.resolution === id ? model.enacted : undefined;
  if (enacted !== undefined) {
    const seat = viewerSeat(model, viewer);
    return {
      lifecycle: 'enacted',
      winning: false,
      party: enacted.party,
      access: seat === undefined ? undefined : {kind: 'everyone', mine: 0, threshold, places: false},
    };
  }
  const slot = model.slots.find((s) => s.resolution === id);
  if (slot === undefined) {
    return undefined;
  }
  const seat = viewerSeat(model, viewer);
  if (seat === undefined) {
    return {lifecycle: 'vote', winning: slot.isWinning, party: slot.party, access: undefined};
  }
  // Only the VIEWER's delegates count toward their personal threshold.
  const mine = slot.votes.filter((vote) => vote.owner === viewer).length;
  const access = seat.access.find((a) => a.party === slot.party);
  if (access !== undefined && access.hasEffect) {
    const basis = basisOf(access);
    return {
      lifecycle: 'vote',
      winning: slot.isWinning,
      party: slot.party,
      access: {kind: 'held', basis, mine, threshold, places: basis === 'delegates'},
    };
  }
  return {
    lifecycle: 'vote',
    winning: slot.isWinning,
    party: slot.party,
    access: {kind: 'progress', mine, threshold, places: true},
  };
}

/**
 * The party aside's one CONTEXT line under the party's name: what the party
 * is for the card on the stage — the condition its vote decides while the
 * card is up, the plain fact once it is enacted. Never the access itself: the
 * footer says who holds the effect («доступен всем»), and one line may not
 * say it twice. Undefined without a model (the viewer outside a live game
 * states nothing about the table).
 */
export function resolutionPartyContextKey(status: ResolutionStatusVm | undefined): string | undefined {
  if (status === undefined) {
    return undefined;
  }
  return status.lifecycle === 'enacted' ? 'Ruling party' : 'If enacted — every player gets its effect';
}

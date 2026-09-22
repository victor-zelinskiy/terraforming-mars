import {reactive} from 'vue';
import {SupportStatus} from './supportScene';
import {Color} from '@/common/Color';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import type {ParliamentQuestVm, ParliamentSlotVm, ParliamentViewVm} from './consoleParliamentModel';

/*
 * THE DISPLAY HOLDS — what the tiers STILL SHOW until each object has
 * physically moved. Seeded in the SAME synchronous block as the view apply
 * (`parliamentSittingSeed.ts` — an own submit and a poll / WS frame alike),
 * so no frame ever paints the new state before its beat; the SITTING DIRECTOR
 * (`sittingDirector.ts`) consumes them touchdown by touchdown as its beats fly
 * the cubes, deal the cards, move the law and change the government.
 *
 * MODULE STATE ON PURPOSE (v2): the holds outlive the section. A sitting the
 * player collapsed («свернуть») or one that stepped aside for the winner's
 * tile keeps the table as it stood, and the walk resumes from the unplayed
 * page with the same holds when the section comes back. They are reset by
 * the seeder on a NEW sitting (another generation) and when the phase is
 * over, by the director's ceiling recovery, and never by a mount.
 */

/** The GOVERNMENT AS IT STOOD before the enactment — released piece by piece as the enactment beat moves each one. */
export type GovernmentBefore = {
  /** The old enacted card (undefined = the honest empty seat under the starting rule). */
  enacted: ParliamentViewVm['enacted'];
};

export type QuestBefore = {
  /** The old chairman quest (undefined = none) — shown CLOSED, with its outcome, until the new one unfolds. */
  quest: ParliamentQuestVm | undefined;
  chairman: Color | undefined;
};

/** The winner's Agenda move the marker has NOT made yet on screen (the marker stands on `from`). */
export type AgendaAwaits = {player: Color, from: number, to: number};

export type ParliamentDisplayHolds = {
  /** Delegates that left the enacted card and have not reached their reserve / the supply yet. */
  returns: Map<Color | 'neutral', number>;
  /** Popular-support cubes the plaques STILL SHOW though the model has moved them onto a fresh card (party → count; the renewal's beat consumes them). */
  support: Map<ReduxParty, number>;
  /** Popular-support cubes the model has GRANTED that have not reached their party's places yet (party → count; the enactment's support beat lands them). */
  supportIncoming: Map<ReduxParty, number>;
  /**
   * THE ROLL CALL of the support scene (v3 В3): party → the word its tile shows while the scene runs, in
   * its own reserved state row. A STATUS, never a highlight — the tile's colour and ring never move.
   */
  rollStatus: Map<ReduxParty, SupportStatus>;
  /** Neutral cubes on a fresh card that have not arrived yet (`instance#seq`). */
  hiddenCubes: Set<string>;
  /** Players whose free delegate has not reached the lobby yet. */
  lobby: Set<Color>;
  /** Fresh resolutions whose card has not been dealt from the deck yet (their faces stay hidden). */
  freshFaces: Set<string>;
  /**
   * THE TWO PILES AS SHOWN — the deck and the discard as they stood BEFORE the
   * response, moved card by card as each event LANDS (a loser onto the discard,
   * the old law onto the discard, the discard turning over into the deck, a
   * revealed card off the deck and onto the discard, a dealt card off the deck).
   * `undefined` = the live counts.
   */
  pile: {deck: number, discard: number} | undefined;
  /**
   * Delegates that left a LOSING card at the renewal and have not reached
   * their reserve / the supply yet (per owner). A record of its own — the
   * enactment's `returns` fly from the enacted card, these from each loser.
   */
  renewalReturns: Map<Color | 'neutral', number>;
  /** A held slot whose loser has LIFTED for the discard — an empty outline in its own place until the table is released. */
  departed: Set<string>;
  /** The renewal journal of this sitting has been seeded (idempotent over echo frames). */
  renewalSeeded: boolean;
  /** The ENACTED card whose government face waits until it has moved in from its voting slot (its instance). */
  govAwaits: string | undefined;
  /** The proxy (flight id) of a card parked over its former voting slot until the enactment beat (the resume path). */
  parked: string | undefined;
  /**
   * THE VOTING SLOTS AS THEY STOOD when the barrier opened — the winner in its
   * slot with its delegates, the losers with their ribbons and tallies — until
   * the enactment has moved the winner and the RESULTS' renewal has flown the
   * losers off from these very homes.
   */
  heldSlots: ReadonlyArray<ParliamentSlotVm> | undefined;
  /** A held slot whose card has LEFT for the government — drawn as an empty outline in its own place (never a re-ordered row). */
  vacated: Set<string>;
  /** A held slot whose card is IN THE AIR (a proxy stands in for it — the face waits). */
  liftedFaces: Set<string>;
  /** The winner's instance among the held slots — the card the enactment lifts out of the table. */
  winnerSlot: string | undefined;
  /** The winner's Agenda move not yet made on screen: the marker stands on `from`, the influence reads the old level. */
  agendaAwaits: AgendaAwaits | undefined;
  /**
   * THE CHAIRMAN'S SEAT HAS NOT CHANGED HANDS ON SCREEN YET («Председательство»):
   * the chair keeps showing `from` (undefined = the empty seat, which is also
   * what it reads the instant the outgoing delegate lifts off) until the new
   * cube has touched it. Seeded by `consoleChairmanQuest.seedChairmanQuestHolds`
   * in the same block as the view apply; released by the seat beat's own
   * touchdown.
   */
  chairAwaits: {from: Color | undefined, to: Color} | undefined;
  /** The government's old CARD, until the old law has left and the new one moved in. */
  govBefore: GovernmentBefore | undefined;
  /** The old RULING PARTY, until the plaques have changed places. */
  rulerBefore: ReduxParty | undefined;
  /**
   * …AND WHETHER THAT OLD RULER RULED BY AN ENACTED CARD. The one ruler that does not is generation 1's
   * starting-rule Greens (an empty ENACTED slot — rulebook p.8): a party the support step MAY pay as
   * «not present on any card» (p.11), and whose plaque therefore keeps its support sockets while it
   * stands in the government. The tile keeps the state of the place it LEFT until the swap has settled
   * (`rulerSettling`), so the fact travels with it; cleared with the settle. `undefined` outside a seeded
   * sitting (the live model answers then: the government holds a card, or it does not).
   */
  rulerBeforeByCard: boolean | undefined;
  /**
   * THE OLD RULING PARTY WHILE ITS PLAQUE IS STILL IN THE AIR. `rulerBefore` has to be released one frame
   * BEFORE the flight (the FLIP measures the tiles in their NEW places and inverts them back), so it
   * cannot say what a travelling tile should LOOK like. This can: until the swap has settled, each of the
   * two plaques still wears the state of the place it LEFT — the ruler's tile loses its support sockets in
   * the frame it ARRIVES in the government, not in the frame it takes off («подпись не опережает объект»).
   * Set beside the release in the enactment beat, cleared by the FLIP's own settle.
   */
  rulerSettling: ReduxParty | undefined;
  /** The old CHAIRMAN QUEST (closed, with its outcome), until the new one unfolds. */
  questBefore: QuestBefore | undefined;
};

export function emptyParliamentHolds(): ParliamentDisplayHolds {
  return {
    returns: new Map(), support: new Map(), supportIncoming: new Map(), rollStatus: new Map(), hiddenCubes: new Set(), lobby: new Set(), freshFaces: new Set(),
    pile: undefined, renewalReturns: new Map(), departed: new Set(), renewalSeeded: false,
    govAwaits: undefined, parked: undefined, heldSlots: undefined, vacated: new Set(), liftedFaces: new Set(), winnerSlot: undefined,
    agendaAwaits: undefined, chairAwaits: undefined, govBefore: undefined, rulerBefore: undefined, rulerBeforeByCard: undefined, rulerSettling: undefined, questBefore: undefined,
  };
}

export const parliamentHolds = reactive(emptyParliamentHolds()) as ParliamentDisplayHolds;

export function resetParliamentHolds(): void {
  Object.assign(parliamentHolds, emptyParliamentHolds());
}

/** Is anything of the ENACTMENT still held (the walk has a beat to play before the table reads the new state)? */
export function enactmentHeld(): boolean {
  const h = parliamentHolds;
  return h.agendaAwaits !== undefined || h.supportIncoming.size > 0 || h.returns.size > 0 || h.govBefore !== undefined ||
    h.rulerBefore !== undefined || h.questBefore !== undefined || h.govAwaits !== undefined;
}

/** Is anything of the RENEWAL still held (the renewal's beats have cards, cubes or delegates to move)? */
export function renewalHeld(): boolean {
  const h = parliamentHolds;
  return h.freshFaces.size > 0 || h.hiddenCubes.size > 0 || h.lobby.size > 0 || h.renewalReturns.size > 0 || h.renewalSeeded;
}

/** Release every hold of the ENACTMENT at once (the ceiling's honest recovery, reduced motion): the table reads the new state. */
export function releaseEnactmentHolds(): void {
  const h = parliamentHolds;
  h.returns.clear();
  h.supportIncoming.clear();
  h.rollStatus.clear();
  h.govAwaits = undefined;
  h.parked = undefined;
  h.agendaAwaits = undefined;
  h.govBefore = undefined;
  h.rulerBefore = undefined;
  h.rulerBeforeByCard = undefined;
  h.rulerSettling = undefined;
  h.questBefore = undefined;
  h.liftedFaces.clear();
  // The winner has left the table: its held slot stands vacated until the renewal takes the whole table.
  if (h.heldSlots !== undefined && h.winnerSlot !== undefined && h.heldSlots.some((slot) => slot.instance === h.winnerSlot)) {
    h.vacated.add(h.winnerSlot);
  }
}

/** Release every hold of the RENEWAL at once: the live table with its fresh faces, cubes and lobby. */
export function releaseRenewalHolds(): void {
  const h = parliamentHolds;
  h.freshFaces.clear();
  h.hiddenCubes.clear();
  h.lobby.clear();
  h.pile = undefined;
  h.renewalReturns.clear();
  h.departed.clear();
  h.renewalSeeded = false;
  h.heldSlots = undefined;
  h.vacated.clear();
  h.liftedFaces.clear();
  h.winnerSlot = undefined;
  h.support.clear();
}

/*
 * ONE SEAT'S WHOLE STANDING IN THE PARLIAMENT — the model the Information
 * zone «ПАРЛАМЕНТ» is built from, and the same readings the vote panel prints
 * (Turmoil Redux).
 *
 * The workspace shows the parliament as a TABLE: whose delegates stand where,
 * which resolution leads, what the Agenda track pays next. What it never
 * answers for ONE seat is «where do I stand, and what is my influence made
 * of» — the number a player is asked to vote on appears from nowhere. This
 * module answers exactly that, for ANY seat (the Information workspace walks
 * the table with the bumpers), by composing the readings that already exist:
 *
 *   · INFLUENCE — the track's own level, what stands ON TOP of it and WHO gave
 *     each part (`ParliamentPlayerModel.influenceSources`, the server's own
 *     ledger); a seat whose influence is the track's alone says so by having
 *     nothing to list, never by a «бонусы 0» line;
 *   · THE AGENDA — the step the marker stands on and what the NEXT one pays;
 *   · DELEGATES — the lobby, the reserve, and one entry per resolution the
 *     seat has a cube on (with the lead);
 *   · ACCESS — how many party effects the seat holds and how much of its
 *     action allowance is spent (the effects themselves are the «Эффекты»
 *     zone's — this one never restates them);
 *   · THE TABLE — the seat's own reading of every resolution up for the vote,
 *     in the vote panel's own grammar, and what it RECEIVED from the last
 *     enactment.
 *
 * Pure: no Vue, no DOM, no i18n — English keys, numbers and the shared
 * readings. Nothing here decides a rule.
 */
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {ParliamentModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import {InfluenceYield} from '@/common/parliament/influenceScaling';
import {AGENDA_TRACK, AgendaStep, influenceAtAgenda, ReduxParty, ResolutionInstanceId} from '@/common/parliament/ParliamentTypes';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {enactedYieldsOf} from './influenceYieldModel';
import {voteReadingOf, VoteReadingVm} from './voteInfoModel';

/** WHERE the seat's influence comes from — the track, and every entry on top of it by name. */
export type SeatInfluenceVm = {
  total: number;
  /** The Agenda track's own level at the seat's step. */
  track: number;
  /** Everything above it (0 = the track alone — the ordinary case today). */
  bonus: number;
  /** …itemised, when the server knows the givers. `source` is an i18n key / a card name. */
  sources: ReadonlyArray<{amount: number, source?: string}>;
};

export type SeatAgendaVm = {
  /** 0 = no marker on the track yet; 1…12 = the step it stands on. */
  position: number;
  /** What the NEXT step pays (undefined at the end of the track). */
  next?: AgendaStep;
};

/** One resolution the seat has delegates on. */
export type SeatDelegateSlotVm = {
  instance: ResolutionInstanceId;
  resolution: string;
  party: ReduxParty;
  votes: number;
  /** This seat would win the card as it stands (rulebook p.8). */
  leads: boolean;
};

export type SeatDelegatesVm = {
  /** The free delegate is in the lobby (a vote costs nothing). */
  lobby: boolean;
  reserve: number;
  onSlots: ReadonlyArray<SeatDelegateSlotVm>;
  /** The total on the table — the server's own count. */
  onResolutions: number;
};

/** What the seat may DO, never what the effects are (those are the «Эффекты» zone's own reading). */
export type SeatAccessVm = {
  /** Party effects the seat holds right now. */
  held: number;
  /** Party actions spent this generation… */
  partyActionsUsed: number;
  /** …and the enacted law's action. */
  resolutionActionsUsed: number;
};

/** One resolution of the voting area, read for this seat. */
export type SeatTableEntryVm = {
  instance: ResolutionInstanceId;
  resolution: string;
  party: ReduxParty;
  /** The card would be enacted if the generation ended now. */
  winning: boolean;
  /** The seat's own delegates on it. */
  votes: number;
  reading: VoteReadingVm;
};

/** What the seat RECEIVED from the resolution enacted at the last sitting. */
export type SeatEnactedVm = {
  resolution: string;
  party: ReduxParty;
  yields: ReadonlyArray<InfluenceYield>;
};

export type SeatParliamentReadingVm = {
  color: Color;
  /** The seat takes part at all (a MarsBot seat does not — every reading below is empty for it). */
  participates: boolean;
  influence: SeatInfluenceVm;
  agenda: SeatAgendaVm;
  delegates: SeatDelegatesVm;
  chairman: boolean;
  access: SeatAccessVm;
  table: ReadonlyArray<SeatTableEntryVm>;
  enacted?: SeatEnactedVm;
};

function seatOf(model: ParliamentModel | undefined, color: Color | undefined): ParliamentPlayerModel | undefined {
  return color === undefined ? undefined : model?.players.find((p) => p.color === color);
}

const EMPTY: SeatParliamentReadingVm = {
  color: 'neutral' as Color,
  participates: false,
  influence: {total: 0, track: 0, bonus: 0, sources: []},
  agenda: {position: 0},
  delegates: {lobby: false, reserve: 0, onSlots: [], onResolutions: 0},
  chairman: false,
  access: {held: 0, partyActionsUsed: 0, resolutionActionsUsed: 0},
  table: [],
};

/**
 * The seat's whole standing. A seat that does not take part (MarsBot) reads as
 * an EMPTY standing rather than as zeros with meaning: the surface says «не
 * участвует» in one line instead of drawing an empty parliament for it.
 */
export function seatParliamentReadingOf(
  model: ParliamentModel | undefined,
  color: Color | undefined,
  tableau: ReadonlyArray<{name: CardName}>,
  opts: {viewer?: Color} = {},
): SeatParliamentReadingVm {
  const seat = seatOf(model, color);
  if (model === undefined || seat === undefined || color === undefined) {
    return {...EMPTY, ...(color === undefined ? {} : {color})};
  }
  if (!seat.participates) {
    return {...EMPTY, color};
  }
  const track = influenceAtAgenda(seat.agenda);
  // A reading of ANOTHER seat speaks in the third person — but it does NOT name the subject: the
  // surface hosting this model already says whose standing it shows (the Information crumb).
  const rival = opts.viewer === undefined || opts.viewer === color ? undefined : {};
  const table = model.slots.map((slot) => ({
    instance: slot.instance,
    resolution: slot.resolution,
    party: slot.party,
    winning: slot.isWinning,
    votes: slot.votes.filter((vote) => vote.owner === color).length,
    // The SAME reading the vote panel prints, for this seat — in the person of whoever is looking.
    reading: voteReadingOf(getResolution(slot.resolution), model, color, tableau, rival),
  }));
  const out: SeatParliamentReadingVm = {
    color,
    participates: true,
    influence: {
      total: seat.influence,
      track,
      bonus: Math.max(0, seat.influence - track),
      sources: seat.influenceSources ?? [],
    },
    agenda: {
      position: seat.agenda,
      ...(seat.agenda >= AGENDA_TRACK.length ? {} : {next: AGENDA_TRACK[seat.agenda]}),
    },
    delegates: {
      lobby: seat.lobby,
      reserve: seat.reserve,
      onResolutions: seat.onResolutions,
      onSlots: model.slots
        .map((slot) => ({
          instance: slot.instance,
          resolution: slot.resolution,
          party: slot.party,
          votes: slot.votes.filter((vote) => vote.owner === color).length,
          leads: slot.leader === color,
        }))
        .filter((entry) => entry.votes > 0),
    },
    chairman: seat.chairman,
    access: {
      held: seat.access.filter((entry) => entry.hasEffect).length,
      partyActionsUsed: Object.values(seat.partyActionUses).reduce<number>((sum, uses) => sum + (uses ?? 0), 0),
      resolutionActionsUsed: seat.resolutionActionUses,
    },
    table,
  };
  // WHAT THE LAST SITTING PAID THIS SEAT — the recorded outcome, never a recomputation.
  const enacted = model.enacted;
  const resolution = enacted === undefined ? undefined : getResolution(enacted.resolution);
  if (enacted !== undefined && resolution !== undefined) {
    const yields = enactedYieldsOf(resolution, model, color).filter((y) => y.context !== 'reference');
    if (yields.length > 0) {
      out.enacted = {resolution: enacted.resolution, party: enacted.party, yields};
    }
  }
  return out;
}

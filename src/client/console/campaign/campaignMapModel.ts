// Campaign Map — the PURE view model (no Vue, no DOM, unit-tested under the
// server runner). Builds everything the map renders from the wire
// CampaignModel + the viewer resolution the server already did.

import {CampaignModel, CampaignMissionModel} from '@/common/campaign/CampaignModel';
import {CampaignSeat, MissionSlotState, TitleName} from '@/common/campaign/CampaignTypes';
import {Color} from '@/common/Color';
import {BoardName} from '@/common/boards/BoardName';
import {CardName} from '@/common/cards/CardName';
import {PlayerId} from '@/common/Types';

export type CmapResultRow = {
  seat: number;
  color: Color;
  name: string;
  place: number;
  score: number;
  /** Shared place partners (competition ranking) — rendered as «делят место». */
  tied: boolean;
  title?: TitleName;
};

export type CmapMissionVm = {
  slot: number;
  board: BoardName;
  final: boolean;
  state: MissionSlotState;
  isCurrent: boolean;
  /** English i18n state plate («завершена» / «идёт» / «готова» / «впереди»). */
  stateLabel: string;
  blockedReason?: string;
  gameId?: string;
  yourPlayerId?: PlayerId;
  /** Compact result strip, place-ordered (present when committed). */
  results?: ReadonlyArray<CmapResultRow>;
  generations?: number;
};

export type CmapRailRow = {
  seat: number;
  color: Color;
  name: string;
  isBot: boolean;
  isYou: boolean;
  /** Earned titles in mission order (compact icon row). */
  titles: ReadonlyArray<{title: TitleName, missionSlot: number}>;
  titlePoints: number;
  /** Bonus M€ pending for the NEXT mission (0 = none shown). */
  pendingBonus: number;
  /** Interlude only: this seat's carryover status line. */
  carry?: {status: 'pending' | 'confirmed', count: number};
  isChampion: boolean;
};

export type CmapCta =
  | {kind: 'launch', label: string, missionSlot: number, enabled: boolean, reason?: string}
  | {kind: 'join', label: string, playerId: PlayerId}
  | {kind: 'waiting', label: string}
  | {kind: 'carryover', label: string}
  | {kind: 'chronicle', label: string}
  | {kind: 'none'};

export type CampaignMapVm = {
  name: string;
  phase: CampaignModel['phase'];
  /** «Миссия N из M» header line (chronicle: «Кампания завершена»). */
  progressLabel: string;
  progressParams: ReadonlyArray<string>;
  currentSlot: number;
  missions: ReadonlyArray<CmapMissionVm>;
  rail: ReadonlyArray<CmapRailRow>;
  youSeat?: number;
  isCreator: boolean;
  cta: CmapCta;
  /** The viewer's own carryover door (interlude, unconsumed). */
  carryoverOpen: boolean;
  carryoverConfirmed: boolean;
  yourCarryCards: ReadonlyArray<CardName>;
  yourEligibleCards: ReadonlyArray<CardName>;
  championSeats: ReadonlyArray<number>;
};

function stateLabelOf(mission: CampaignMissionModel, phase: CampaignModel['phase']): string {
  switch (mission.state) {
  case 'committed': return 'Mission complete';
  case 'active': return 'Mission in progress';
  case 'ready': return phase === 'generated' ? 'Ready to launch' : 'Next mission';
  default: return 'Ahead';
  }
}

function seatOf(seats: ReadonlyArray<CampaignSeat>, index: number): CampaignSeat | undefined {
  return seats.find((s) => s.seat === index);
}

export function buildCampaignMapVm(model: CampaignModel): CampaignMapVm {
  const youSeat = model.you?.seat;
  const isCreator = youSeat === 0;
  const championSeats = model.championSeats ?? [];

  const missions: Array<CmapMissionVm> = model.missions.map((m) => {
    const results = m.result === undefined ? undefined :
      [...m.result.standings].sort((a, b) => a.place - b.place).map((s) => {
        const seat = seatOf(model.seats, s.seat);
        return {
          seat: s.seat,
          color: seat?.color ?? 'neutral' as Color,
          name: seat?.name ?? '',
          place: s.place,
          score: s.score,
          tied: s.tiedWith.length > 0,
          title: m.result?.titles.find((t) => t.seat === s.seat)?.title,
        };
      });
    return {
      slot: m.slot,
      board: m.board,
      final: m.final,
      state: m.state,
      isCurrent: m.slot === model.pointer && model.phase !== 'finished',
      stateLabel: stateLabelOf(m, model.phase),
      blockedReason: m.blockedReason,
      gameId: m.gameId,
      yourPlayerId: m.yourPlayerId,
      results,
      generations: m.result?.generations,
    };
  });

  const carry = model.carryover;
  const yourCarry = youSeat !== undefined ? carry?.bySeat.find((s) => s.seat === youSeat) : undefined;
  const rail: Array<CmapRailRow> = model.seats.map((seat) => ({
    seat: seat.seat,
    color: seat.color,
    name: seat.name,
    isBot: seat.kind === 'bot',
    isYou: seat.seat === youSeat,
    titles: model.progression.titles.filter((t) => t.seat === seat.seat)
      .map((t) => ({title: t.title, missionSlot: t.missionSlot})),
    titlePoints: model.progression.titlePoints[seat.seat] ?? 0,
    pendingBonus: model.progression.pendingBonuses[seat.seat] ?? 0,
    carry: seat.kind === 'human' && model.phase === 'interlude' ?
      (() => {
        const entry = carry?.bySeat.find((s) => s.seat === seat.seat);
        return entry === undefined ? undefined : {status: entry.status, count: entry.count};
      })() : undefined,
    isChampion: championSeats.includes(seat.seat),
  }));

  const current = missions[model.pointer];
  let cta: CmapCta = {kind: 'none'};
  if (model.phase === 'finished') {
    cta = {kind: 'chronicle', label: 'Final mission results'};
  } else if (model.phase === 'abandoned') {
    cta = {kind: 'none'};
  } else if (current?.state === 'active') {
    cta = current.yourPlayerId !== undefined ?
      {kind: 'join', label: current.gameId !== undefined ? 'Continue the mission' : 'Join the mission', playerId: current.yourPlayerId} :
      {kind: 'waiting', label: 'Mission in progress'};
  } else if (current?.state === 'ready') {
    // The viewer's own unresolved carryover outranks the launch/wait line —
    // it is the one thing THEY can do to move the campaign.
    if (yourCarry !== undefined && yourCarry.status === 'pending') {
      cta = {kind: 'carryover', label: 'Choose projects to carry over'};
    } else if (isCreator) {
      cta = {
        kind: 'launch',
        label: 'Launch the mission',
        missionSlot: current.slot,
        enabled: model.canLaunch,
        reason: model.launchBlockers[0],
      };
    } else {
      cta = {kind: 'waiting', label: 'Waiting for the campaign creator to launch the mission'};
    }
  }

  return {
    name: model.name,
    phase: model.phase,
    progressLabel: model.phase === 'finished' ? 'Campaign complete' : 'Mission ${0} of ${1}',
    progressParams: model.phase === 'finished' ? [] : [String(model.pointer + 1), String(model.missionCount)],
    currentSlot: model.pointer,
    missions,
    rail,
    youSeat,
    isCreator,
    cta,
    carryoverOpen: yourCarry !== undefined && !isCarryLocked(model),
    carryoverConfirmed: yourCarry?.status === 'confirmed',
    yourCarryCards: model.carryover?.yourCards ?? [],
    yourEligibleCards: model.carryover?.yourEligible ?? [],
    championSeats,
  };
}

function isCarryLocked(model: CampaignModel): boolean {
  // The selection window closes when the next mission exists (consumed).
  return model.phase !== 'interlude';
}

import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {BoardName} from '@/common/boards/BoardName';
import {CampaignSeatKind, MissionSlotState, TitleName} from '@/common/campaign/CampaignTypes';
import {CampaignMissionModel, CampaignModel} from '@/common/campaign/CampaignModel';
import {marsBotCorpInfo} from '@/common/automa/MarsBotCorpData';

/**
 * CAMPAIGN OVERVIEW MODEL — the ONE pure projection both campaign surfaces
 * read: the standalone Campaign Map (menu) and the in-game Information
 * overview. Derivations live here so the two contexts can never disagree on
 * a number, a provenance or a status line.
 *
 * Key vocabulary decisions (all test-pinned):
 *  - TP semantics is a STATUS, never bare digits: `accrues-final` (missions
 *    1–3: «Учитываются только в финальной миссии») vs `included-now`
 *    (mission 4: «Уже включены в ПО этой миссии») vs `included-final`
 *    (finished chronicle).
 *  - Corporation provenance is DERIVED from the committed result snapshots
 *    (each mission result carries the seat's corporations AT THAT mission's
 *    end), optionally extended by the live mission tableau — never guessed
 *    from array order alone.
 *  - Carried-in legacy distinguishes UNKNOWN (old save, no history) from a
 *    real zero — «нет данных» is never rendered as «0 карт».
 */

export type CampaignTpStatus = 'accrues-final' | 'included-now' | 'included-final';

export type OverviewTitle = {title: TitleName, missionSlot: number, titlePoints: number};

export type OverviewCorp = {
  name: CardName,
  /** Mission the corporation joined the lineage on; undefined = unknown. */
  missionSlot: number | undefined,
};

export type OverviewSeatRow = {
  seat: number;
  kind: CampaignSeatKind;
  name: string;
  color: Color;
  isYou: boolean;
  isChampion: boolean;
  titles: ReadonlyArray<OverviewTitle>;
  titlePoints: number;
  tpStatus: CampaignTpStatus;
  /** Full current lineage with provenance (bot: its single corp identity). */
  corps: ReadonlyArray<OverviewCorp>;
  /** Bonus M€ pending for the NEXT mission (interlude only). */
  pendingBonus: number;
};

export type OverviewMissionCard = {
  slot: number;
  board: BoardName;
  final: boolean;
  state: MissionSlotState;
  isCurrent: boolean;
  /** Compact place-ordered strip for a committed card. */
  podium?: ReadonlyArray<{seat: number, place: number, color: Color, score: number, title?: TitleName}>;
  generations?: number;
};

export type CampaignOverviewVm = {
  name: string;
  phase: CampaignModel['phase'];
  pointer: number;
  missionCount: number;
  progressLabel: string;
  progressParams: ReadonlyArray<string>;
  /** English i18n key of the campaign state chip. */
  phaseLabel: string;
  missions: ReadonlyArray<OverviewMissionCard>;
  seats: ReadonlyArray<OverviewSeatRow>;
  youSeat: number | undefined;
  championSeats: ReadonlyArray<number>;
  /** The slot whose frame defines TP semantics (the open/current mission). */
  contextSlot: number;
};

/** Optional live-game context (the in-game Information host knows more). */
export type OverviewLiveContext = {
  /** The OPEN mission's slot (gameOptions.campaign.missionSlot). */
  missionSlot: number;
  /** seat → corporations currently in that seat's tableau (public). */
  corpsBySeat?: Record<number, ReadonlyArray<CardName>>;
};

const TP_LABEL: Record<CampaignTpStatus, string> = {
  'accrues-final': 'Counted only in the final mission',
  'included-now': 'Already included in this mission’s VP',
  'included-final': 'Included in the final mission’s VP',
};

/** English i18n key of the one-line TP semantics note. */
export function tpStatusLabel(status: CampaignTpStatus): string {
  return TP_LABEL[status];
}

export function phaseChipLabel(model: CampaignModel): string {
  switch (model.phase) {
  case 'finished': return 'Campaign complete';
  case 'abandoned': return 'Campaign abandoned';
  case 'missionActive': return 'Mission in progress';
  case 'interlude': return 'Next mission';
  default: return 'Ready to launch';
  }
}

function tpStatusOf(model: CampaignModel, contextSlot: number): CampaignTpStatus {
  if (model.phase === 'finished') {
    return 'included-final';
  }
  const finalSlot = model.missionCount - 1;
  if (contextSlot === finalSlot && model.missions[finalSlot]?.state !== 'locked' && model.missions[finalSlot]?.state !== 'ready') {
    return 'included-now';
  }
  return 'accrues-final';
}

/**
 * Mission of origin for every corporation of a seat, derived from the
 * committed result snapshots (result.standings[seat].corporations is the
 * lineage AT that mission's end). A corporation absent from every snapshot
 * joined on the live (uncommitted) mission.
 */
export function corpOrigins(model: CampaignModel, seat: number, live?: OverviewLiveContext): Map<CardName, number | undefined> {
  const origins = new Map<CardName, number | undefined>();
  for (const mission of model.missions) {
    const standing = mission.result?.standings.find((s) => s.seat === seat);
    if (standing === undefined) {
      continue;
    }
    for (const corp of standing.corporations) {
      if (!origins.has(corp)) {
        origins.set(corp, mission.slot);
      }
    }
  }
  const lineage = model.progression.lineages[seat] ?? [];
  for (const corp of lineage) {
    if (!origins.has(corp)) {
      origins.set(corp, undefined);
    }
  }
  if (live?.corpsBySeat?.[seat] !== undefined) {
    for (const corp of live.corpsBySeat[seat]) {
      if (!origins.has(corp)) {
        // Joined on the live mission — the only mission without a snapshot.
        origins.set(corp, live.missionSlot);
      }
    }
  }
  return origins;
}

function seatCorps(model: CampaignModel, seat: number, kind: CampaignSeatKind, live?: OverviewLiveContext): ReadonlyArray<OverviewCorp> {
  if (kind === 'bot') {
    const botCorp = model.progression.botCorporation;
    if (botCorp === undefined) {
      return [];
    }
    return [{name: marsBotCorpInfo(botCorp).original, missionSlot: 0}];
  }
  const origins = corpOrigins(model, seat, live);
  // Acquisition order: the lineage first, then any live-mission addition.
  const ordered: Array<CardName> = [...(model.progression.lineages[seat] ?? [])];
  const liveCorps = live?.corpsBySeat?.[seat] ?? [];
  for (const corp of liveCorps) {
    if (!ordered.includes(corp)) {
      ordered.push(corp);
    }
  }
  return ordered.map((name) => ({name, missionSlot: origins.get(name)}));
}

export function buildCampaignOverview(model: CampaignModel, live?: OverviewLiveContext): CampaignOverviewVm {
  const contextSlot = live?.missionSlot ?? model.pointer;
  const tpStatus = tpStatusOf(model, contextSlot);
  const missions: Array<OverviewMissionCard> = model.missions.map((m) => ({
    slot: m.slot,
    board: m.board,
    final: m.final,
    state: m.state,
    isCurrent: m.slot === model.pointer && model.phase !== 'finished' && model.phase !== 'abandoned',
    podium: m.result === undefined ? undefined :
      [...m.result.standings]
        .sort((a, b) => a.place - b.place)
        .map((s) => ({
          seat: s.seat,
          place: s.place,
          color: model.seats.find((seat) => seat.seat === s.seat)?.color ?? 'neutral' as Color,
          score: s.score,
          title: m.result?.titles.find((t) => t.seat === s.seat)?.title,
        })),
    generations: m.result?.generations,
  }));

  const seats: Array<OverviewSeatRow> = model.seats.map((seat) => ({
    seat: seat.seat,
    kind: seat.kind,
    name: seat.name,
    color: seat.color,
    isYou: model.you?.seat === seat.seat,
    isChampion: model.championSeats?.includes(seat.seat) === true,
    titles: model.progression.titles.filter((t) => t.seat === seat.seat)
      .map((t) => ({title: t.title, missionSlot: t.missionSlot, titlePoints: t.titlePoints})),
    titlePoints: model.progression.titlePoints[seat.seat] ?? 0,
    tpStatus,
    corps: seatCorps(model, seat.seat, seat.kind, live),
    pendingBonus: model.progression.pendingBonuses[seat.seat] ?? 0,
  }));

  return {
    name: model.name,
    phase: model.phase,
    pointer: model.pointer,
    missionCount: model.missionCount,
    progressLabel: 'Mission ${0} of ${1}',
    progressParams: [String(Math.min(model.pointer + 1, model.missionCount)), String(model.missionCount)],
    phaseLabel: phaseChipLabel(model),
    missions,
    seats,
    youSeat: model.you?.seat,
    championSeats: model.championSeats ?? [],
    contextSlot,
  };
}

// ------------------------------------------------------- mission details --

export type MissionDetailsRow = {
  seat: number;
  place: number;
  tied: boolean;
  color: Color;
  name: string;
  isBot: boolean;
  score: number;
  megaCredits: number;
  title?: {title: TitleName, titlePoints: number};
  /** The seat's corporations AT THAT mission's end (historic composition). */
  corporations: ReadonlyArray<CardName>;
};

export type MissionOutgoingLegacy = {
  nextSlot: number;
  /** Bonus M€ assigned by this result toward the next mission (humans). */
  bonuses: ReadonlyArray<{seat: number, color: Color, name: string, megaCredits: number}>;
  /**
   * Cards carried into the NEXT mission. `known` distinguishes recorded
   * history from an old save with no data; `pending` = the interlude choice
   * is still being made (never presented as a done transfer).
   */
  carried: {
    known: boolean,
    pending: boolean,
    bySeat: ReadonlyArray<{seat: number, color: Color, name: string, count: number}>,
    yourCards?: ReadonlyArray<CardName>,
  };
};

export type MissionDetailsVm = {
  slot: number;
  board: BoardName;
  final: boolean;
  generations: number;
  rows: ReadonlyArray<MissionDetailsRow>;
  outgoing?: MissionOutgoingLegacy;
  championSeats: ReadonlyArray<number>;
};

export function buildMissionDetails(model: CampaignModel, slot: number): MissionDetailsVm | undefined {
  const mission = model.missions[slot];
  const result = mission?.result;
  if (mission === undefined || result === undefined) {
    return undefined;
  }
  const seatOf = (seat: number) => model.seats.find((s) => s.seat === seat);
  const rows: Array<MissionDetailsRow> = [...result.standings]
    .sort((a, b) => a.place - b.place || a.seat - b.seat)
    .map((s) => {
      const seat = seatOf(s.seat);
      const title = result.titles.find((t) => t.seat === s.seat);
      return {
        seat: s.seat,
        place: s.place,
        tied: s.tiedWith.length > 0,
        color: seat?.color ?? 'neutral' as Color,
        name: seat?.name ?? '',
        isBot: seat?.kind === 'bot',
        score: s.score,
        megaCredits: s.megaCredits,
        title: title === undefined ? undefined : {title: title.title, titlePoints: title.titlePoints},
        corporations: s.corporations,
      };
    });

  let outgoing: MissionOutgoingLegacy | undefined = undefined;
  if (!mission.final) {
    const nextSlot = slot + 1;
    const next: CampaignMissionModel | undefined = model.missions[nextSlot];
    const bonuses = result.bonuses.map((b) => {
      const seat = seatOf(b.seat);
      return {seat: b.seat, color: seat?.color ?? 'neutral' as Color, name: seat?.name ?? '', megaCredits: b.megaCredits};
    });
    // Carried-out: the durable per-slot history of the NEXT mission first,
    // the live interlude window as the pending/legacy fallback.
    let carried: MissionOutgoingLegacy['carried'];
    if (next?.carriedCounts !== undefined) {
      carried = {
        known: true,
        pending: false,
        bySeat: Object.entries(next.carriedCounts).map(([seat, count]) => {
          const s = seatOf(Number(seat));
          return {seat: Number(seat), color: s?.color ?? 'neutral' as Color, name: s?.name ?? '', count};
        }),
        yourCards: next.yourCarried,
      };
    } else if (model.carryover !== undefined && model.carryover.sourceSlot === slot) {
      // «Ещё выбирается» only while somebody actually IS choosing — an
      // all-confirmed selection before the launch is a fact (still
      // revisable, but never presented as absent).
      const pending = (next?.state === 'ready' || next?.state === 'locked') &&
        model.carryover.bySeat.some((s) => s.status === 'pending');
      carried = {
        known: true,
        pending,
        bySeat: model.carryover.bySeat.map((s) => {
          const seat = seatOf(s.seat);
          return {seat: s.seat, color: seat?.color ?? 'neutral' as Color, name: seat?.name ?? '', count: s.count};
        }),
        yourCards: model.carryover.yourCards,
      };
    } else {
      carried = {known: false, pending: false, bySeat: []};
    }
    if (bonuses.length > 0 || carried.known) {
      outgoing = {nextSlot, bonuses, carried};
    }
  }

  return {
    slot,
    board: mission.board,
    final: mission.final,
    generations: result.generations,
    rows,
    outgoing,
    championSeats: result.championSeats ?? [],
  };
}

// ----------------------------------------------------------- seat legacy --

export type SeatLegacyBonus = {
  amount: number;
  /** granted = received in the open mission · settled = a finished mission's
   *  grant (received by construction) · pending = the deployment press is
   *  still ahead · unknown = another live seat (self-only fact). */
  status: 'granted' | 'settled' | 'pending' | 'unknown';
};

export type SeatLegacyVm = {
  seat: number;
  name: string;
  color: Color;
  kind: CampaignSeatKind;
  isYou: boolean;
  /** Composition entering the CONTEXT mission, with provenance. */
  corps: ReadonlyArray<OverviewCorp>;
  /** The comeback bonus this seat STARTED the context mission with. */
  bonus?: SeatLegacyBonus;
  /** Cards carried INTO the context mission. */
  carried: {known: boolean, count: number, names?: ReadonlyArray<CardName>};
  titles: ReadonlyArray<OverviewTitle>;
  titlePoints: number;
  tpStatus: CampaignTpStatus;
};

export function buildSeatLegacy(
  model: CampaignModel,
  seat: number,
  opts: {contextSlot: number, live?: OverviewLiveContext, selfBonusGranted?: boolean},
): SeatLegacyVm | undefined {
  const seatModel = model.seats.find((s) => s.seat === seat);
  if (seatModel === undefined) {
    return undefined;
  }
  const {contextSlot} = opts;
  const mission = model.missions[contextSlot];
  const isYou = model.you?.seat === seat;

  let bonus: SeatLegacyBonus | undefined = undefined;
  if (seatModel.kind === 'human' && contextSlot > 0) {
    const amount = model.missions[contextSlot - 1]?.result?.bonuses.find((b) => b.seat === seat)?.megaCredits ?? 0;
    if (amount > 0) {
      let status: SeatLegacyBonus['status'];
      if (mission?.state === 'committed') {
        status = 'settled';
      } else if (mission?.state === 'ready' || mission?.state === 'locked') {
        // The mission has not launched — the grant lies ahead for everyone.
        status = 'pending';
      } else if (isYou && opts.selfBonusGranted !== undefined) {
        status = opts.selfBonusGranted ? 'granted' : 'pending';
      } else {
        status = 'unknown';
      }
      bonus = {amount, status};
    }
  }

  let carried: SeatLegacyVm['carried'];
  if (seatModel.kind === 'bot' || contextSlot === 0) {
    // The bot never carries; mission 1 has nothing before it. Known-zero.
    carried = {known: true, count: 0};
  } else if (mission?.carriedCounts !== undefined) {
    carried = {
      known: true,
      count: mission.carriedCounts[seat] ?? 0,
      names: isYou ? mission.yourCarried : undefined,
    };
  } else if (model.carryover !== undefined && model.carryover.sourceSlot === contextSlot - 1) {
    // The live interlude window addresses exactly this mission: for a READY
    // slot it is the (still revisable) selection travelling in, for an
    // ACTIVE one launched before the durable history existed it is the
    // old-save backfill — its counts ARE the carried-in history.
    const entry = model.carryover.bySeat.find((s) => s.seat === seat);
    carried = {
      known: entry !== undefined,
      count: entry?.count ?? 0,
      names: isYou ? model.carryover.yourCards : undefined,
    };
  } else {
    carried = {known: false, count: 0};
  }

  return {
    seat,
    name: seatModel.name,
    color: seatModel.color,
    kind: seatModel.kind,
    isYou,
    corps: seatCorps(model, seat, seatModel.kind, opts.live),
    bonus,
    carried,
    titles: model.progression.titles.filter((t) => t.seat === seat)
      .map((t) => ({title: t.title, missionSlot: t.missionSlot, titlePoints: t.titlePoints})),
    titlePoints: model.progression.titlePoints[seat] ?? 0,
    tpStatus: tpStatusOf(model, contextSlot),
  };
}

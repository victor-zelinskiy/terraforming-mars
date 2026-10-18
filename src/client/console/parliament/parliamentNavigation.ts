import {Message} from '@/common/logs/Message';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {armDescendOrigin, armDescendRect} from '@/client/console/surfaceMotion/workspaceDescend';
import {armActionFocusOrigin} from '@/client/console/consoleActionFocusMotion';
import {parliamentFlow} from './consoleParliamentFlow';
import {ParliamentViewVm, PartyActionStateVm} from './consoleParliamentModel';
import {ParliamentInspectRequest} from './parliamentInspect';

/*
 * THE BROWSE LAYER'S CURSOR («Зал» v7) — the chamber's ring, one stop per object the player can read or act on:
 *
 *   ┌ RULER ─┐  ┌ THE TABLE: slot · slot · slot ┐  ┌ OPPOSITION: five rows ┐
 *   │medallion│  │   ◀ ▶ walk the bills          │  │   ▲ ▼ walk the rows    │
 *   └────────┘  └───────────────────────────────┘  └───────────────────────┘
 *   [ENGINE: the chair + the quest] ═══ [AGENDA: the career track ▶ one stop] ═══════════════════════
 *
 * The geometry is spatial: ◀ ▶ cross the chamber (ruler ◀ table ▶ opposition), ▼ from any wing lands on the
 * edge below it (the engine under the ruler, the track under the table and the opposition), ▲ returns. The
 * opposition column may stand LEFT of the table too (the Ф1 batch left it open) — only `OPPOSITION_SIDE` would
 * change. `partyIndex` still indexes `view.parties` (all six, in the board's order); the column's walk skips
 * the ruler. The retired `government` zone reads as the ruler (a restored save, a parked stack).
 */

/** The opposition's indices into `view.parties` (the board's order minus the ruler). */
export function oppositionIndices(view: ParliamentViewVm): Array<number> {
  return view.parties.map((p, i) => ({p, i})).filter(({p}) => p.party !== view.rulingParty).map(({i}) => i);
}

/** Seat the column cursor on an OPPOSITION row: the preferred index when it is one, else the nearest. */
function seatOnOpposition(view: ParliamentViewVm, preferred: number): void {
  const row = oppositionIndices(view);
  if (row.length === 0) {
    return;
  }
  parliamentFlow.partyIndex = row.includes(preferred) ? preferred : row[Math.min(row.length - 1, Math.max(0, row.findIndex((i) => i >= preferred)))] ?? row[0];
}

/** The opposition's last cursor in the column — remembered across the ring, so ◀ ▶ return to the same row. */
function seatOnTable(view: ParliamentViewVm, index: number): void {
  parliamentFlow.zone = 'voting';
  parliamentFlow.slotIndex = Math.max(0, Math.min(Math.max(0, view.slots.length - 1), index));
}

/**
 * THE BROWSE RING: the ruler · the table's bills (◀ ▶ walk them — one stop per bill, the reading line reads the
 * one under the cursor) · the five opposition rows (▲ ▼) · the engine (the chair with its quest) · the track.
 */
export function navigateParliamentZones(dir: 'up' | 'down' | 'left' | 'right', view: ParliamentViewVm): void {
  const f = parliamentFlow;
  const row = oppositionIndices(view);
  switch (f.zone) {
  case 'voting':
    if (dir === 'left') {
      if (f.slotIndex > 0) {
        f.slotIndex -= 1;
      } else {
        f.zone = 'ruler';
      }
    } else if (dir === 'right') {
      if (f.slotIndex < view.slots.length - 1) {
        f.slotIndex += 1;
      } else if (row.length > 0) {
        f.zone = 'parties';
        const focused = view.slots[f.slotIndex];
        const idx = view.parties.findIndex((p) => p.party === focused?.party);
        seatOnOpposition(view, idx >= 0 && row.includes(idx) ? idx : (row[0] ?? 0));
      }
    } else if (dir === 'down') {
      f.zone = 'agenda';
    }
    return;
  // A Parliament restored with the retired zone (a save, a parked stack) lands on the medallion that replaced it.
  case 'government':
    f.zone = 'ruler';
    return;
  case 'ruler':
    if (dir === 'right') {
      seatOnTable(view, 0);
    } else if (dir === 'down') {
      f.zone = 'engine';
    }
    return;
  case 'engine':
    if (dir === 'up') {
      f.zone = 'ruler';
    } else if (dir === 'right') {
      f.zone = 'agenda';
    }
    return;
  case 'agenda':
    if (dir === 'left') {
      f.zone = 'engine';
    } else if (dir === 'up') {
      seatOnTable(view, f.slotIndex);
    }
    return;
  case 'parties': {
    const at = row.indexOf(f.partyIndex);
    const pos = at === -1 ? 0 : at;
    if (dir === 'up') {
      f.partyIndex = row[Math.max(0, pos - 1)] ?? f.partyIndex;
    } else if (dir === 'down') {
      if (pos < row.length - 1) {
        f.partyIndex = row[pos + 1] ?? f.partyIndex;
      } else {
        f.zone = 'agenda';
      }
    } else if (dir === 'left') {
      seatOnTable(view, view.slots.length - 1);
    }
    return;
  }
  }
}

function reasonText(reason: string | Message): string {
  return typeof reason === 'string' ? translateText(reason) : translateMessage(reason);
}

/**
 * WHY a party action cannot be taken from its medallion right now — the one
 * reason the notice names (the server's own, else the state's word), or
 * undefined when the door opens. `offered`: the server's option is in the
 * live action menu (the Unity trade needs none — the colonies ask for it).
 */
export function partyActionRefusal(state: PartyActionStateVm, offered: boolean, awaitingInput: boolean): string | undefined {
  if (state.kind !== 'available') {
    return state.reason !== undefined ? reasonText(state.reason) :
      translateText(state.kind === 'used' ? 'This party action was already used this generation' :
        (state.kind === 'not-now' ? (awaitingInput ? 'Finish your current action first' : 'Not your turn') : 'You do not have this party\'s effect'));
  }
  return offered ? undefined : translateText('This option is no longer offered');
}

/**
 * WHY the enacted resolution's action cannot be taken right now (Open IP Trade — the party refusal's twin): the
 * server's own reason, the state's word, or «no longer offered»; undefined when the door opens.
 */
export function resolutionActionRefusal(state: PartyActionStateVm, offered: boolean, awaitingInput: boolean): string | undefined {
  if (state.kind !== 'available') {
    return state.reason !== undefined ? reasonText(state.reason) :
      translateText(state.kind === 'used' ? 'This resolution action was already used this generation' :
        (state.kind === 'not-now' ? (awaitingInput ? 'Finish your current action first' : 'Not your turn') : 'The enacted resolution has no action of its own'));
  }
  return offered ? undefined : translateText('This option is no longer offered');
}

/** The enacted resolution's CARD in the government is the descent's origin — the action workspace unfolds from its rect. */
export function armResolutionActionDescent(root: HTMLElement | undefined): void {
  const card = root?.querySelector<HTMLElement>('.con-parl__gov-card .pcard') ?? root?.querySelector<HTMLElement>('.con-parl__gov-card');
  const rect = card?.getBoundingClientRect();
  if (rect !== undefined && rect.width > 0) {
    armDescendOrigin('action-browse', {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2});
    armDescendRect('action-slot', rect);
    armActionFocusOrigin(rect);
  }
}

/** The pressed medallion is the descent's origin — the action workspace unfolds from its rect (the ruler's in the government included). */
export function armPartyActionDescent(root: HTMLElement | undefined, party: ReduxParty): void {
  const plaque = root?.querySelector<HTMLElement>(`.con-parl__party[data-party="${party}"] .con-pseal`);
  const rect = plaque?.getBoundingClientRect();
  if (rect !== undefined && rect.width > 0) {
    armDescendOrigin('action-browse', {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2});
    armDescendRect('action-slot', rect);
    armActionFocusOrigin(rect);
  }
}

/**
 * THE INSPECTOR from the BROWSE layer — X on the object under the cursor, the console's one grammar (X = the
 * current object). A BILL on the table opens the resolution's dossier, paged over the three by LB/RB; the RULER
 * opens the ENACTED LAW's dossier (its party column is the ruling party's) — or the party's, before any law; the
 * ENGINE opens the law the quest is printed on (the starting rule has no card: the party's dossier then); a ROW
 * of the opposition opens that party's dossier. The track has no dossier yet (Ф4). The request names the
 * PHYSICAL element the card lifts out of (and returns into).
 */
export function parliamentBrowseInspectRequest(view: ParliamentViewVm, root: HTMLElement | undefined): ParliamentInspectRequest | undefined {
  const enacted = (origin: () => HTMLElement | null): ParliamentInspectRequest | undefined =>
    view.enacted === undefined ? undefined : {kind: 'resolution', ids: [view.enacted.resolutionId], index: 0, origin};
  const rulerParty = (): ParliamentInspectRequest =>
    ({kind: 'party', party: view.rulingParty, origin: () => root?.querySelector<HTMLElement>('[data-parl-ruler] .con-pseal') ?? null});
  const govCard = () => root?.querySelector<HTMLElement>('.con-parl__gov-card .pcard') ?? root?.querySelector<HTMLElement>('.con-parl__gov-card') ?? null;
  switch (parliamentFlow.zone) {
  case 'voting': {
    const slots = view.slots;
    if (slots.length === 0) {
      return undefined;
    }
    const index = Math.max(0, Math.min(slots.length - 1, parliamentFlow.slotIndex));
    const instance = slots[index]?.instance;
    return {
      kind: 'resolution', ids: slots.map((s) => s.resolutionId), index,
      origin: () => root?.querySelector<HTMLElement>(`.con-parl__slot[data-instance="${instance}"] .pcard`) ?? null,
    };
  }
  case 'government':
  case 'ruler':
  case 'engine':
    return enacted(govCard) ?? rulerParty();
  case 'parties': {
    const party = view.parties[parliamentFlow.partyIndex]?.party;
    return party === undefined ? undefined :
      {kind: 'party', party, origin: () => root?.querySelector<HTMLElement>(`.con-parl__party[data-party="${party}"] .con-pseal`) ?? null};
  }
  default:
    return undefined;
  }
}

/**
 * THE ENACTED RESOLUTION as a read of its own — the sitting's X (the object every stage is about). Undefined
 * until a resolution has ever been enacted.
 */
export function parliamentEnactedInspectRequest(view: ParliamentViewVm, root: HTMLElement | undefined): ParliamentInspectRequest | undefined {
  const enacted = view.enacted;
  if (enacted === undefined) {
    return undefined;
  }
  return {
    kind: 'resolution', ids: [enacted.resolutionId], index: 0,
    origin: () => root?.querySelector<HTMLElement>('.con-parl__gov-card .pcard') ?? root?.querySelector<HTMLElement>('.con-parl__gov-card') ?? null,
  };
}

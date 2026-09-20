import {Message} from '@/common/logs/Message';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {armDescendOrigin, armDescendRect} from '@/client/console/surfaceMotion/workspaceDescend';
import {armActionFocusOrigin} from '@/client/console/consoleActionFocusMotion';
import {parliamentFlow} from './consoleParliamentFlow';
import {ParliamentViewVm, PartyActionStateVm} from './consoleParliamentModel';
import {ParliamentInspectRequest} from './parliamentInspect';

/*
 * THE BROWSE LAYER'S CURSOR — four zones (the government's card · the RULING
 * PARTY's tile in the government · the voting area · the five OPPOSITION
 * tiles) and one d-pad grammar over them, plus what X inspects from each
 * zone. Pure over the flow record and the view.
 *
 * v2: the ruling party's tile stands in the government, the row below holds
 * the five parties WITHOUT power. `partyIndex` still indexes `view.parties`
 * (all six, in the board's order); the row's walk skips the ruler.
 */

/** The opposition's indices into `view.parties` (the board's order minus the ruler). */
export function oppositionIndices(view: ParliamentViewVm): Array<number> {
  return view.parties.map((p, i) => ({p, i})).filter(({p}) => p.party !== view.rulingParty).map(({i}) => i);
}

/** The index of the ruling party in `view.parties` (-1 when the view has no parties). */
export function rulerIndex(view: ParliamentViewVm): number {
  return view.parties.findIndex((p) => p.party === view.rulingParty);
}

function seatOnOpposition(view: ParliamentViewVm, preferred: number): void {
  const row = oppositionIndices(view);
  if (row.length === 0) {
    return;
  }
  parliamentFlow.partyIndex = row.includes(preferred) ? preferred : row[Math.min(row.length - 1, Math.max(0, row.findIndex((i) => i >= preferred)))] ?? row[0];
}

export function navigateParliamentZones(dir: 'up' | 'down' | 'left' | 'right', view: ParliamentViewVm): void {
  const f = parliamentFlow;
  const row = oppositionIndices(view);
  switch (f.zone) {
  case 'voting':
    if (dir === 'left') {
      f.zone = 'ruler';
    } else if (dir === 'down') {
      f.zone = 'parties';
      const focused = view.slots[f.slotIndex];
      const idx = view.parties.findIndex((p) => p.party === focused?.party);
      seatOnOpposition(view, idx >= 0 && row.includes(idx) ? idx : (row[Math.min(row.length - 1, 2)] ?? 0));
    }
    return;
  case 'government':
    if (dir === 'right') {
      f.zone = 'ruler';
    } else if (dir === 'down') {
      f.zone = 'parties';
      seatOnOpposition(view, row[0] ?? 0);
    }
    return;
  case 'ruler':
    if (dir === 'right') {
      f.zone = 'voting';
    } else if (dir === 'left') {
      f.zone = 'government';
    } else if (dir === 'down') {
      f.zone = 'parties';
      seatOnOpposition(view, row[Math.min(row.length - 1, 1)] ?? row[0] ?? 0);
    }
    return;
  case 'parties': {
    const at = row.indexOf(f.partyIndex);
    const pos = at === -1 ? 0 : at;
    if (dir === 'left') {
      f.partyIndex = row[Math.max(0, pos - 1)] ?? f.partyIndex;
    } else if (dir === 'right') {
      f.partyIndex = row[Math.min(row.length - 1, pos + 1)] ?? f.partyIndex;
    } else if (dir === 'up') {
      // The column above: the government's card over the first tile, the ruler over the second, the voting area over the rest.
      f.zone = pos === 0 ? 'government' : pos === 1 ? 'ruler' : 'voting';
    }
    return;
  }
  }
}

function reasonText(reason: string | Message): string {
  return typeof reason === 'string' ? translateText(reason) : translateMessage(reason);
}

/**
 * WHY a party action cannot be taken from its plaque right now — the one
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

/** The pressed plaque is the descent's origin — the action workspace unfolds from its rect (the ruler's tile in the government included). */
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
 * THE INSPECTOR from the BROWSE layer — X on the object under the cursor.
 * The request names the PHYSICAL element the card lifts out of (and returns
 * into). The voting area is ONE zone with no card of its own selected, so
 * nothing is inspected from it (the vote mode's X inspects the card it
 * stands on); the government inspects the enacted resolution, else the ruling
 * party's effect; the ruler's tile and a party plaque inspect that party's effect.
 */
export function parliamentBrowseInspectRequest(view: ParliamentViewVm, root: HTMLElement | undefined): ParliamentInspectRequest | undefined {
  switch (parliamentFlow.zone) {
  case 'government':
    if (view.enacted !== undefined) {
      const id = view.enacted.resolutionId;
      return {kind: 'resolution', ids: [id], index: 0, origin: () => root?.querySelector<HTMLElement>('.con-parl__gov-card .pcard') ?? root?.querySelector<HTMLElement>('.con-parl__gov-card') ?? null};
    }
    return {kind: 'party', party: view.rulingParty, origin: () => root?.querySelector<HTMLElement>('[data-parl-ruler] .con-pseal') ?? null};
  case 'ruler':
    return {kind: 'party', party: view.rulingParty, origin: () => root?.querySelector<HTMLElement>('[data-parl-ruler] .con-pseal') ?? null};
  case 'parties': {
    const party = view.parties[parliamentFlow.partyIndex]?.party;
    return party === undefined ? undefined :
      {kind: 'party', party, origin: () => root?.querySelector<HTMLElement>(`.con-parl__party[data-party="${party}"] .con-pseal`) ?? null};
  }
  default:
    return undefined;
  }
}

import {Message} from '@/common/logs/Message';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {translateMessage, translateText} from '@/client/directives/i18n';
import {armDescendOrigin, armDescendRect} from '@/client/console/surfaceMotion/workspaceDescend';
import {armActionFocusOrigin} from '@/client/console/consoleActionFocusMotion';
import {parliamentFlow} from './consoleParliamentFlow';
import {ParliamentViewVm, PartyActionStateVm} from './consoleParliamentModel';
import {ParliamentInspectRequest} from './parliamentInspect';

/*
 * THE BROWSE LAYER'S CURSOR — three zones (the government · the voting area ·
 * the parties) and one d-pad grammar over them, plus what X inspects from
 * each zone. Pure over the flow record and the view.
 */

/** The parties tier is ONE row of six plaques on every profile. */
const PARTY_COLUMNS = 6;

export function navigateParliamentZones(dir: 'up' | 'down' | 'left' | 'right', view: ParliamentViewVm): void {
  const f = parliamentFlow;
  switch (f.zone) {
  case 'voting':
    if (dir === 'left') {
      f.zone = 'government';
    } else if (dir === 'down') {
      f.zone = 'parties';
      const focused = view.slots[f.slotIndex];
      const idx = view.parties.findIndex((p) => p.party === focused?.party);
      f.partyIndex = idx >= 0 ? idx : Math.min(f.partyIndex, view.parties.length - 1);
    }
    return;
  case 'government':
    if (dir === 'right') {
      f.zone = 'voting';
    } else if (dir === 'down') {
      f.zone = 'parties';
      const idx = view.parties.findIndex((p) => p.party === view.rulingParty);
      f.partyIndex = idx >= 0 ? idx : 0;
    }
    return;
  case 'parties':
    if (dir === 'left') {
      f.partyIndex = Math.max(0, f.partyIndex - 1);
    } else if (dir === 'right') {
      f.partyIndex = Math.min(view.parties.length - 1, f.partyIndex + 1);
    } else if (dir === 'up') {
      if (f.partyIndex >= PARTY_COLUMNS) {
        f.partyIndex -= PARTY_COLUMNS;
      } else {
        f.zone = f.partyIndex < 2 ? 'government' : 'voting';
      }
    } else if (dir === 'down') {
      if (f.partyIndex + PARTY_COLUMNS < view.parties.length) {
        f.partyIndex += PARTY_COLUMNS;
      }
    }
    return;
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

/** The pressed plaque is the descent's origin — the action workspace unfolds from its rect. */
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
 * party's effect; a party plaque inspects that party's effect.
 */
export function parliamentBrowseInspectRequest(view: ParliamentViewVm, root: HTMLElement | undefined): ParliamentInspectRequest | undefined {
  switch (parliamentFlow.zone) {
  case 'government':
    if (view.enacted !== undefined) {
      const id = view.enacted.resolutionId;
      return {kind: 'resolution', ids: [id], index: 0, origin: () => root?.querySelector<HTMLElement>('.con-parl__gov-card .pcard') ?? root?.querySelector<HTMLElement>('.con-parl__gov-card') ?? null};
    }
    return {kind: 'party', party: view.rulingParty, origin: () => root?.querySelector<HTMLElement>('[data-parl-ruler]') ?? null};
  case 'parties': {
    const party = view.parties[parliamentFlow.partyIndex]?.party;
    return party === undefined ? undefined :
      {kind: 'party', party, origin: () => root?.querySelector<HTMLElement>(`.con-parl__party[data-party="${party}"] .con-pseal`) ?? null};
  }
  default:
    return undefined;
  }
}

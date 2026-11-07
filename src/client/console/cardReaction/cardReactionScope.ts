/**
 * @console-shared LIVE — WHOSE card reactions the board plays («СРАБАТЫВАНИЕ КАРТЫ»).
 *
 * The players' field report (2026-11-07): another seat's reactor rising at the stage — its face lifted, its tokens
 * flying into that seat's chip — is noise when nothing of it reaches the viewer. The preference:
 *
 *  - `mine` (DEFAULT) — the scene plays only reactions that GIVE THE VIEWER something: their own reactors (the
 *    director's own groups already require a share for the viewer) and a rival's reactor whose record pays the viewer
 *    too. A rival's reactor paying only its own seat is not played — its counters tick with the view, and the feed
 *    keeps its «Сработал эффект» card (`reactionScenePlaysFor` answers «no» for that seat, so the feed never treats
 *    it as told by the scene — no silent loss).
 *  - `all` — every reaction, the rivals' at the stage under their seat's caption (the behaviour before the setting).
 *
 * LEAF module (imports nothing of the director), read by the director and the settings model.
 * Config: localStorage `tm_card_reactions` → default `mine`. Pure client presentation, never sent to the server.
 */
import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {CardReactionRecord} from '@/common/models/CardReactionModel';

const STORAGE_KEY = 'tm_card_reactions';

export type CardReactionScope = 'mine' | 'all';
export const CARD_REACTION_SCOPE_CHOICES: ReadonlyArray<CardReactionScope> = ['mine', 'all'];

/** English i18n keys for the settings ring (translated at render). */
export const CARD_REACTION_SCOPE_LABELS: Readonly<Record<CardReactionScope, string>> = {
  mine: 'Only involving me',
  all: 'All players',
};

function storage(): Storage | undefined {
  try {
    return (globalThis as {localStorage?: Storage}).localStorage;
  } catch (err) {
    return undefined;
  }
}

function readInitial(): CardReactionScope {
  return storage()?.getItem(STORAGE_KEY) === 'all' ? 'all' : 'mine';
}

/** Reactive so the settings row re-renders; the director reads it at every seed. */
export const cardReactionScopeState = reactive({scope: readInitial()});

/** Persist + apply. A chain already on stage finishes; the next response's records follow the new scope. */
export function setCardReactionScope(scope: CardReactionScope): void {
  cardReactionScopeState.scope = scope;
  try {
    storage()?.setItem(STORAGE_KEY, scope);
  } catch (err) {
    // Private mode etc. — the in-session value still applies.
  }
}

/** Does a record of `owner`'s reactor reach the viewer — a share of any kind addressed to them (a refused unit counts: it is theirs)? */
export function reactionReachesViewer(record: Pick<CardReactionRecord, 'owner' | 'impacts'>, viewer: Color | undefined): boolean {
  return viewer !== undefined && (record.owner === viewer || record.impacts.some((i) => i.to === viewer));
}

/** Is a RIVAL's reactor played on this screen under the current scope? */
export function rivalReactionShown(record: Pick<CardReactionRecord, 'owner' | 'impacts'>, viewer: Color | undefined, scope: CardReactionScope = cardReactionScopeState.scope): boolean {
  return scope === 'all' || reactionReachesViewer(record, viewer);
}

import {reactive, watch} from 'vue';
import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {DeckCompositionModel} from '@/common/models/DeckCompositionModel';
import {NewGameConfig} from '@/common/game/NewGameConfig';
import {createGameState} from '@/client/components/create/premium/createGameState';
import {buildCreateGamePayloadFromPremiumState} from '@/client/components/create/premium/buildCreateGamePayload';

/*
 * THE CREATOR'S DECKS, AS THE SERVER COUNTS THEM (T04 «the deck is visible before
 * launch») — module reactive state, like `journalState`. While the creator is on screen it
 * asks `PUT /api/deck-composition` with the LAUNCH BODY whenever a setting the decks
 * depend on changes (an expansion · the seats · the bot · a guaranteed card), coalesced
 * to one ask per task; an answer older than the latest ask is dropped. While an ask is in
 * flight the PREVIOUS numbers stay (`status: 'loading'` — the surfaces dim them, never a
 * blank or «…»); a failed ask keeps them too (`status: 'error'`, a quiet line — the decks
 * are information, never a launch blocker). `docs/claude/console/pregame-showcase.md` § 6a.
 */

export type DeckCompositionStatus = 'idle' | 'loading' | 'ok' | 'error';

export const deckCompositionState = reactive<{
  composition: DeckCompositionModel | undefined;
  status: DeckCompositionStatus;
  /** The latest ask's number — an answer to an older one is stale. */
  seq: number;
}>({composition: undefined, status: 'idle', seq: 0});

export type DeckCompositionFetcher = (body: NewGameConfig) => Promise<DeckCompositionModel>;

async function serverFetch(body: NewGameConfig): Promise<DeckCompositionModel> {
  const res = await fetch(apiUrl(paths.API_DECK_COMPOSITION), {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: {'Content-Type': 'application/json'},
  });
  if (!res.ok) {
    throw new Error(`deck composition: ${res.status}`);
  }
  return await res.json() as DeckCompositionModel;
}

let fetcher: DeckCompositionFetcher = serverFetch;

/** Specs: answer the asks without a server. Returns the restore. */
export function setDeckCompositionFetcher(next: DeckCompositionFetcher): () => void {
  const previous = fetcher;
  fetcher = next;
  return () => {
    fetcher = previous;
  };
}

/**
 * What the decks depend on, as one string — a name being typed, a colour or the map
 * never re-asks. The players' NAMES and the first-player pick are left out (the body
 * still carries them; the server reads the seat count).
 */
export function deckCompositionKey(body: NewGameConfig): string {
  const {players, randomFirstPlayer: _first, board: _board, seed: _seed, ...rest} = body;
  return JSON.stringify({...rest, seats: players.length});
}

async function ask(body: NewGameConfig): Promise<void> {
  const seq = ++deckCompositionState.seq;
  deckCompositionState.status = 'loading';
  try {
    const composition = await fetcher(body);
    if (seq !== deckCompositionState.seq) {
      return;
    }
    deckCompositionState.composition = composition;
    deckCompositionState.status = 'ok';
  } catch {
    if (seq === deckCompositionState.seq) {
      deckCompositionState.status = 'error';
    }
  }
}

/**
 * Keep the counts live while the creator is mounted; returns the stop. The first ask goes
 * at once; later changes coalesce into one ask per task (a burst of toggles is one ask).
 */
export function trackDeckComposition(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastKey = '';
  const stop = watch(
    () => buildCreateGamePayloadFromPremiumState(createGameState.config),
    (body) => {
      const key = deckCompositionKey(body);
      if (key === lastKey) {
        return;
      }
      lastKey = key;
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        timer = undefined;
        void ask(body);
      }, 0);
    },
    {immediate: true, deep: true},
  );
  return () => {
    stop();
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  };
}

/** Forget the counts (specs; a creator leaving for good keeps them — the next visit shows the last decks at once). */
export function resetDeckCompositionState(): void {
  deckCompositionState.composition = undefined;
  deckCompositionState.status = 'idle';
  deckCompositionState.seq = 0;
}

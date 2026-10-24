/**
 * THE CHAIRMAN QUEST CEREMONY — «задание председателя выполнено», told to EVERY other seat (the owner, 2026-10-24).
 *
 * The milestone family's REMOTE beat (`maCeremonyState` / `ConsoleMaCeremony`): an unobtrusive top-centre strip that
 * names WHO completed the government's quest — never blocking, never trapping input — in the quest's OWN style (the
 * chair, the Parliament's violet). The completer is not announced to: their own surface already is the quest beat
 * (the gate «You completed the chairman quest», the chair, the Career step — `chairmanQuestDirector.ts`).
 *
 * Detection is the honest seed-then-diff idiom: the public `parliament.quest.completedBy` flips from unset to a colour
 * exactly once per quest (`Parliament.addQuestProgress` refuses a second completion — the quest is closed for
 * everyone until the next government). A quest is keyed by its generation and source, so a new government's quest
 * starts clean; the first observation (load / reconnect) seeds silently and never replays.
 */
import {reactive} from 'vue';
import {Color} from '@/common/Color';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';

export type QuestCeremonyEvent = {
  /** The completer — the new (or kept) chairman. */
  color: Color,
  /** The completer's DISPLAY label (the Automa seat reads «Бот»). */
  actorName: string,
  generation: number,
  at: number,
};

/** A queued beat older than this is dropped instead of shown (the shell was away). */
const QUEUE_TTL_MS = 45_000;

type QuestCeremonyView = {
  thisPlayer?: {color: Color},
  players?: ReadonlyArray<{color: Color, name: string, isMarsBot?: boolean}>,
  game: {parliament?: {quest?: {generation: number, source: string, completedBy?: Color}}},
};

export const questCeremonyState = reactive({
  seen: new Set<string>(),
  seeded: false,
  queue: [] as Array<QuestCeremonyEvent>,
  current: undefined as QuestCeremonyEvent | undefined,
  /** Bumped once per SHOWN beat — the shell's one-shot watch signal. */
  nonce: 0,
});

function questKey(quest: {generation: number, source: string}): string {
  return `${quest.generation}:${quest.source}`;
}

/**
 * Observe a fresh playerView (NotificationLayer's per-commit hook, beside the milestone ceremony). Returns true when
 * a beat was enqueued on THIS observation.
 */
export function observeQuestCeremony(view: QuestCeremonyView | undefined, now: number = Date.now()): boolean {
  const quest = view?.game.parliament?.quest;
  if (view === undefined) {
    return false;
  }
  if (!questCeremonyState.seeded) {
    if (quest?.completedBy !== undefined) {
      questCeremonyState.seen.add(questKey(quest));
    }
    questCeremonyState.seeded = true;
    return false;
  }
  if (quest === undefined || quest.completedBy === undefined) {
    return false;
  }
  const key = questKey(quest);
  if (questCeremonyState.seen.has(key)) {
    return false;
  }
  questCeremonyState.seen.add(key);
  // The completer's own surface IS the quest beat — the strip is for everyone else.
  if (view.thisPlayer?.color === quest.completedBy) {
    return false;
  }
  const player = view.players?.find((p) => p.color === quest.completedBy);
  questCeremonyState.queue.push({
    color: quest.completedBy,
    actorName: player !== undefined ? participantDisplayName(player) : quest.completedBy,
    generation: quest.generation,
    at: now,
  });
  if (questCeremonyState.current === undefined) {
    advanceQuestCeremony(now);
  }
  return true;
}

/** Show the next queued beat (the shell calls it when its beat has gone). Stale entries are dropped, never replayed. */
export function advanceQuestCeremony(now: number = Date.now()): void {
  let next = questCeremonyState.queue.shift();
  while (next !== undefined && now - next.at > QUEUE_TTL_MS) {
    next = questCeremonyState.queue.shift();
  }
  questCeremonyState.current = next;
  if (next !== undefined) {
    questCeremonyState.nonce++;
  }
}

/** A different game opened in-session (the notifications' boundary). */
export function resetQuestCeremony(): void {
  questCeremonyState.seen = new Set<string>();
  questCeremonyState.seeded = false;
  questCeremonyState.queue = [];
  questCeremonyState.current = undefined;
}

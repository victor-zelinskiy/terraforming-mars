import {paths} from '@/common/app/paths';
import {apiUrl} from '@/client/utils/runtimeConfig';

/**
 * Soft client→server ack that a bot-turn notification finished (the player
 * closed it, its TTL expired, or they opened its review). It only tells the
 * server "I've caught up with this turn" so the NEXT paced bot turn need not
 * wait on this client — it NEVER decides when the bot acts (that is
 * server-authoritative, BotTurnScheduler) and a lost/failed ack is harmless
 * (the scheduler bounds the wait regardless).
 *
 * The viewer id is captured from the notification layer (which already knows
 * `playerView.id`) so the pure marsbot modules can ack without threading it
 * through. Deduped per turn key so the three finish paths never double-post.
 */
let viewerId: string | undefined;
const acked = new Set<string>();

/** Called by the notification layer on every view update. Resets the dedup set
 *  when the viewer/game changes (a new game must re-ack its own turns). */
export function setBotAckViewer(id: string | undefined): void {
  if (id !== viewerId) {
    viewerId = id;
    acked.clear();
  }
}

export function ackBotTurn(key: string | undefined): void {
  if (viewerId === undefined || key === undefined || key === '' || acked.has(key)) {
    return;
  }
  acked.add(key);
  void fetch(
    `${apiUrl(paths.API_GAME_BOT_TURN_ACK)}?id=${encodeURIComponent(viewerId)}&key=${encodeURIComponent(key)}`,
    {method: 'POST'},
  ).catch(() => {
    // Best-effort — the scheduler's bounded timeout is the authority.
  });
}

/** Test seam: clear the module state between specs. */
export function resetBotTurnAckForTesting(): void {
  viewerId = undefined;
  acked.clear();
}

// Campaign «ТЕНДЕРЫ» — the BIDDING scene's tiny UI mirror the HOST reads.
// The endgame workspace and the campaign map own the one command bar while
// the bidding is their scene, and a host cannot reactively read a child's
// `$refs` — so the scene publishes what the host's bar needs here (the
// `campaignMapUi` pattern). The REVEAL latch lives here too: a bidding's deal
// and flip play ONCE per client, whichever host shows it first (a reload or a
// return lands settled — the re-entry contract of every console cinematic).

import {reactive} from 'vue';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';

export const tenderBiddingUi = reactive<{
  /** The scene's OWN command list, mirrored verbatim for the host's bar. */
  commands: ReadonlyArray<ConsoleCommand>,
  /** The deal / flip cinematic is playing — the pad is absorbed, the hold stands. */
  revealing: boolean,
  /** The focused document is open in the reader (X). */
  reading: boolean,
}>({
  commands: [],
  revealing: false,
  reading: false,
});

/** `campaignId:slot` of every bidding whose reveal this client already played. */
const revealed = new Set<string>();

export function biddingRevealKey(campaignId: string, slot: number): string {
  return `${campaignId}:${slot}`;
}

export function biddingRevealPlayed(key: string): boolean {
  return revealed.has(key);
}

export function markBiddingRevealPlayed(key: string): void {
  revealed.add(key);
}

export function resetTenderBiddingUi(): void {
  tenderBiddingUi.commands = [];
  tenderBiddingUi.revealing = false;
  tenderBiddingUi.reading = false;
}

/** Tests only — forget every played reveal. */
export function resetBiddingRevealsForTesting(): void {
  revealed.clear();
  resetTenderBiddingUi();
}

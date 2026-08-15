/*
 * CONVERSION PROMPT — the tiny reactive mirror beside the pure
 * `conversionPromptModel`.
 *
 * While the console serves a conversion-marked SelectAmount, the player rail's
 * two affected STOCK rows enter a delicate focus state (`con-res__row--conv-watch`):
 * the rail is the exact surface the decision is about and the surface its
 * commit animation will play on, so the eye is guided there BEFORE the commit —
 * without touching the displayed values (they change only after the server
 * answers; the premium transition then plays them).
 *
 * ConsoleTaskHost is the ONLY writer (serve/unserve of the conversion layout);
 * ConsoleResourcePanel is the reader. Module-level so it survives the reset
 * epoch, exactly like the sibling console UI states.
 */

import {reactive} from 'vue';

export const conversionPromptUi = reactive({
  /** Icon key of the STOCK row being spent ('' = no conversion prompt live). */
  watchFrom: '',
  /** Icon key of the STOCK row being gained ('' = none). */
  watchTo: '',
});

/** Serve: name the two stock rows the live conversion prompt is about. */
export function setConversionPromptWatch(from: string, to: string): void {
  conversionPromptUi.watchFrom = from;
  conversionPromptUi.watchTo = to;
}

/** Unserve (prompt left / answered / deferred) — idempotent. */
export function clearConversionPromptWatch(): void {
  conversionPromptUi.watchFrom = '';
  conversionPromptUi.watchTo = '';
}

/**
 * FAST MODE (`gameOptions.fastModeOption`) — the one place its player-facing
 * copy lives, shared by the server's structured reason and the console's rows,
 * so the two can never say two different things about one rule.
 *
 * Upstream's variant: a turn cannot end after a single action (take two
 * actions or pass for the generation). The fork's extension: the «Продажа
 * патентов» standard project is limited to ONE sale per generation per player.
 */

/** The sell-patents row's reason while the generation's one sale is spent. */
export const SELL_PATENTS_EXHAUSTED_REASON = 'Patents already sold this generation';

/** The sell-patents row's standing note in fast mode (printed while the sale is still open). */
export const SELL_PATENTS_ONCE_PER_GENERATION_NOTE = 'Once per generation';

/** The skip-turn verb's reason — the option never exists in a fast-mode game. */
export const SKIP_TURN_FAST_MODE_REASON = 'Unavailable in this game';

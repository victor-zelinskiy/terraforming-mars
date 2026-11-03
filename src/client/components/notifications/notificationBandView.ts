/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE CARD'S STATEMENTS, as the eye reads them (P53 · ledger FK — «ЛЕНТА: ЧИСЛО НЕ РЕЖЕТСЯ · ЦЕНА И ПРИХОД ПОРОЗНЬ»).
 * Pure readings the console notification card renders, so each rule is pinned by a unit spec rather than by a frame:
 *  · the hero band says NUMBERS in its pills and WORDS as a sentence (`bandStatements`) — a standing ban is not an
 *    amount, and a phrase squeezed into the number's frame read as a four-line tracked-caps pill;
 *  · the transfer arrow names WHO took it only when that is not the actor the head already named (`transferTaker`) —
 *    a bare «→ ●» after the loss said nothing the head had not;
 *  · an actor's line says what they GOT and what they PAID as two labelled groups (`clusterSides`) — «● +1 −25» put a
 *    rival's price beside their income with no word for either;
 *  · the head's glyph is a text glyph of the family, never an emoji (`notificationGlyph`).
 * No Vue, no DOM — read under the server runner.
 */
import {JournalImpactChip} from '@/client/components/journal/journalEventChild';
import {Color} from '@/common/Color';
import {NotificationVariant} from '@/client/components/notifications/notificationTypes';

/** A band chip with NO number whose whole message is a phrase — its sentence (an i18n key). */
export const BAND_PHRASE_LABEL: Readonly<Record<string, string>> = {
  // The Modular Floodgates blockade: no number moved — the loss IS the standing ban (its duration included).
  'hydro-blockade': 'Advancement blocked until the next generation',
};

export type BandStatements = {
  losses: Array<JournalImpactChip>,
  gains: Array<JournalImpactChip>,
  /** The word outcomes, as i18n keys — each a sentence under the sign, never a pill. */
  phrases: Array<string>,
};

function isPhrase(chip: JournalImpactChip): boolean {
  return chip.text === '' && BAND_PHRASE_LABEL[chip.icon] !== undefined;
}

/** The band's numbers (losses first, gains after — the producer's order) and its word outcomes apart. */
export function bandStatements(band: {losses: ReadonlyArray<JournalImpactChip>, gains: ReadonlyArray<JournalImpactChip>}): BandStatements {
  const phrases: Array<string> = [];
  for (const chip of [...band.losses, ...band.gains]) {
    if (isPhrase(chip) && !phrases.includes(BAND_PHRASE_LABEL[chip.icon])) {
      phrases.push(BAND_PHRASE_LABEL[chip.icon]);
    }
  }
  return {
    losses: band.losses.filter((c) => !isPhrase(c)),
    gains: band.gains.filter((c) => !isPhrase(c)),
    phrases,
  };
}

/** WHO the transfer arrow names — `undefined` when nobody, or when it is the actor the head's chip already named. */
export function transferTaker(band: {transfer?: boolean, attacker?: Color}, actor: Color | undefined): Color | undefined {
  if (band.transfer !== true || band.attacker === undefined || band.attacker === actor) {
    return undefined;
  }
  return band.attacker;
}

/** A chip's sign off its pre-formatted text ('+2' · '−2' with a real minus · '-2'). */
export function chipIsCost(chip: JournalImpactChip): boolean {
  return chip.saved !== true && /^[−-]/.test(chip.text);
}

/** An actor's line in two labelled groups: what they GOT, then what they PAID (dim). Either may be empty. */
export function clusterSides(chips: ReadonlyArray<JournalImpactChip>): {got: Array<JournalImpactChip>, paid: Array<JournalImpactChip>} {
  return {got: chips.filter((c) => !chipIsCost(c)), paid: chips.filter((c) => chipIsCost(c))};
}

/** The head's glyph per variant — TEXT glyphs of the card family (never an emoji: 🏆 🏅 ⚖ ⚠ ✖ render as pictures). */
export function notificationGlyph(variant: NotificationVariant): string {
  switch (variant) {
  case 'chairman': return '⟐';
  case 'milestone': return '✪';
  case 'award': return '❂';
  case 'warning': return '△';
  case 'bot-turn': return '⌬';
  case 'generation': return '◆';
  case 'pass': return '⏻';
  case 'standard-project': return '⬡';
  case 'colony': return '◉';
  case 'hydronetwork': return '≈';
  case 'planetary-event': return '◬';
  case 'blue-action': return '⟳';
  case 'passive-effect': return '✦';
  case 'destroy': return '✕';
  case 'steal': return '⇢';
  case 'production-reduction': return '▼';
  case 'production-transfer': return '⇄';
  case 'vp-loss': return '★';
  case 'threat': return '△';
  case 'reveal-deck': return '◇';
  case 'reveal-hand': return '⊙';
  case 'play-card':
  case 'event':
  default: return '◈';
  }
}

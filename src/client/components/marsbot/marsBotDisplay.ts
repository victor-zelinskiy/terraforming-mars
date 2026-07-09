/*
 * The ONE display-name resolver for the Automa participant.
 *
 * Server-side the bot stays canonical `MarsBot` (player name, ids, events,
 * saves — nothing renamed). The USER-FACING label localizes through the
 * i18n key 'MarsBot': English UI keeps "MarsBot", the Russian UI shows «Бот»
 * (with «Бот • Обычный»-style compact badges where a difficulty fits).
 *
 * Every component that renders a participant label routes through these
 * helpers — never a scattered `name === 'MarsBot'` check, never a raw
 * `player.name` for a visible bot label.
 */
import {DifficultyLevel} from '@/common/automa/AutomaTypes';
import {Color} from '@/common/Color';
import {translateText} from '@/client/directives/i18n';
import {DIFFICULTY_LABEL} from './marsBotView';

/** The localized visible name of the Automa seat («ИИ» in the Russian UI). */
export function automaDisplayName(): string {
  return translateText('MarsBot');
}

/** Compact «ИИ • Обычный»-style label for player cards / summaries. */
export function automaDisplayNameWithDifficulty(difficulty: DifficultyLevel): string {
  return `${automaDisplayName()} • ${translateText(DIFFICULTY_LABEL[difficulty])}`;
}

/**
 * The visible label of ANY participant: humans keep their real name; the
 * Automa seat resolves through the localized display name. Accepts every
 * player-model shape that carries `name` (+ the optional `isMarsBot` flag).
 */
export function participantDisplayName(participant: {name: string, isMarsBot?: boolean}): string {
  return participant.isMarsBot === true ? automaDisplayName() : participant.name;
}

/**
 * Resolve a colour to its visible participant label via {@link participantDisplayName}
 * — THE replacement for the scattered `players.find(...)?.name ?? color`
 * antipattern (which leaked a raw «MarsBot» into standings / popovers / pickers).
 * Falls back to the colour string when the colour isn't among `players`.
 */
export function displayNameForColor(players: ReadonlyArray<{color: string, name: string, isMarsBot?: boolean}>, color: Color | string | undefined): string {
  if (color === undefined) {
    return '';
  }
  const player = players.find((p) => p.color === color);
  return player !== undefined ? participantDisplayName(player) : color;
}

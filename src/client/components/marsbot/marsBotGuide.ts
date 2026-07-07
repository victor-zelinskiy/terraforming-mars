/*
 * The MarsBot TEACHING layer — one source of truth for "how does this bot
 * actually work", rendered by BOTH the desktop bot-board overlay and the
 * console info-mode board detail, so a player who has never met the tabletop
 * Automa learns it right in the interface.
 *
 * Pure and context-aware: sections are resolved for the CURRENT game
 * (difficulty modifiers, Venus/Colonies-only mechanics appear only when those
 * modules are on) — never "with expansion X it would…". Texts are English
 * i18n source keys.
 */
import {DifficultyLevel} from '@/common/automa/AutomaTypes';
import {BonusCardContext} from '@/common/automa/BonusCardData';
import {DIFFICULTY_LABEL} from './marsBotView';

export type GuideSection = {
  id: string;
  /** A sober anchor glyph (tinted by CSS). */
  glyph: string;
  /** English i18n key. */
  title: string;
  /** English i18n keys — one paragraph each. */
  body: ReadonlyArray<string>;
};

export function marsBotGuide(difficulty: DifficultyLevel, ctx: BonusCardContext): ReadonlyArray<GuideSection> {
  const sections: Array<GuideSection> = [];

  sections.push({
    id: 'turn',
    glyph: '⟳',
    title: 'Its turn in one sentence',
    body: [
      'On its turn MarsBot flips the top card of its action deck: a PROJECT card advances one tracker per printed tag, left to right; a BONUS card resolves its own special effect.',
      'Landing a tracker on an icon triggers that action immediately — gain TR, raise a parameter, place a tile, claim a milestone or fund an award.',
    ],
  });

  sections.push({
    id: 'actionDeck',
    glyph: '▤',
    title: 'Action deck',
    body: [
      'A face-down deck rebuilt every generation: project cards plus one bonus card. When it runs out mid-generation, MarsBot passes until the next one.',
      'MarsBot never pays for cards — the flipped card only feeds tags to its trackers, then goes to its played pile.',
    ],
  });

  sections.push({
    id: 'bonusDeck',
    glyph: '◈',
    title: 'Bonus cards, discard and destroyed',
    body: [
      'Bonus cards are MarsBot\'s special moves. One is shuffled into each generation\'s action deck.',
      'A resolved bonus card goes to the open DISCARD and returns when the bonus deck is reshuffled. A DESTROYED card is removed from the game permanently — usually the reward for MarsBot pulling its trick off.',
    ],
  });

  sections.push({
    id: 'tracks',
    glyph: '≡',
    title: 'Trackers and regression',
    body: [
      'Each tracker is one tag family. Tags on flipped cards push it right; the icons printed on the strip fire when reached.',
      'When one of MarsBot\'s productions would be reduced, the matching tracker steps BACK and the space is marked ✕ — that icon will not fire again when re-crossed.',
    ],
  });

  sections.push({
    id: 'failed',
    glyph: '!',
    title: 'Failed actions',
    body: [
      difficulty === 'easy' ?
        'When MarsBot cannot perform something (a maxed track, a completed parameter, no legal tile space, a tagless card), it takes a Failed Action: it gains 3 M€ instead.' :
        'When MarsBot cannot perform something (a maxed track, a completed parameter, no legal tile space, a tagless card), it takes a Failed Action: it gains 5 M€ instead.',
      'That money matters — see how it scores below.',
    ],
  });

  if (ctx.colonies) {
    sections.push({
      id: 'shipping',
      glyph: '⇄',
      title: 'Shipping storage',
      body: [
        'Resources MarsBot would gain are stored per colony area instead. Every 5 resources in one area are exchanged for a step on the matching tag\'s tracker.',
        'Stealing or removing MarsBot\'s resources takes them from these areas (its M€ supply covers the rest).',
      ],
    });
  }

  sections.push({
    id: 'scoring',
    glyph: '★',
    title: 'How it scores',
    body: [
      // Whole sentences per variant — the exact-match i18n never concatenates.
      difficulty === 'hard' || difficulty === 'brutal' ?
        'MarsBot scores TR, milestones, awards, cities and greenery like any player. On this difficulty its played cards also score +1 VP each when they print a non-negative VP icon.' :
        'MarsBot scores TR, milestones, awards, cities and greenery like any player. It scores NO victory points from its played cards.',
      'At game end its remaining M€ converts to VP — the later the game ends, the cheaper each VP gets, so its Failed-Action money keeps pressure on you to finish efficiently.',
    ],
  });

  sections.push({
    id: 'clock',
    glyph: '⌛',
    title: 'The clock',
    body: [
      'If the game ever reaches its final generation limit, MarsBot instantly wins regardless of the score — terraform fast.',
    ],
  });

  sections.push({
    id: 'difficulty',
    glyph: '◆',
    title: DIFFICULTY_LABEL[difficulty],
    body: difficultyBody(difficulty),
  });

  return sections;
}

function difficultyBody(difficulty: DifficultyLevel): ReadonlyArray<string> {
  switch (difficulty) {
  case 'easy':
    return ['Easy: MarsBot ignores the "advance again" tracker icons, gains only 3 M€ from Failed Actions and counts awards with a −5 handicap.'];
  case 'hard':
    return ['Hard: at the start of each generation, with 8+ M€ and enough milestone progress, MarsBot claims a milestone before its normal turn.'];
  case 'brutal':
    return ['Brutal: the Hard milestone pressure, plus an extra project card in every action deck and +1 VP per played card with a non-negative VP icon.'];
  default:
    return ['Normal: the official Automa rules exactly as printed.'];
  }
}

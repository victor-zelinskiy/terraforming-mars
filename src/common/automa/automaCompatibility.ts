import {BoardName} from '../boards/BoardName';

/**
 * The ONE source of truth for "which game options can be combined with
 * MarsBot (the official Automa)" — shared by the server-side creation guard
 * (`AutomaSetup.validateOptions`, which throws on the first conflict) and the
 * premium create-game UI (which highlights every conflicting control and
 * blocks the Create button BEFORE any payload is sent).
 *
 * Pure and framework-free: callers normalize their own options shape into
 * `AutomaCompatibilityInput`. Server validation stays authoritative — the UI
 * merely runs the same rules earlier.
 */

/** Which UI control family a conflict belongs to (drives premium highlighting). */
export type AutomaConflictKey =
  | 'board'
  | 'expansion:turmoil'
  | 'expansion:prelude2'
  | 'expansion:promo'
  | 'expansion:community'
  | 'expansion:moon'
  | 'expansion:pathfinders'
  | 'expansion:ceo'
  | 'expansion:starwars'
  | 'expansion:underworld'
  | 'rule:randomMilestonesAwards'
  | 'variant:soloTR'
  | 'variant:twoCorps'
  | 'variant:escapeVelocity'
  | 'variant:solarPhase'
  | 'variant:venusCompletion'
  | 'rule:randomBoardTiles'
  | 'variant:customLists';

export type AutomaConflict = {
  key: AutomaConflictKey;
  /**
   * The reason SUFFIX, exactly as the server throws it:
   * `MarsBot (Automa) does not support ${reason}`. English i18n source.
   */
  reason: string;
};

/** The option subset the MarsBot POC compatibility rules read (normalized). */
export type AutomaCompatibilityInput = {
  boardName: string;
  turmoil: boolean;
  prelude2: boolean;
  promo: boolean;
  community: boolean;
  moon: boolean;
  pathfinders: boolean;
  ceo: boolean;
  starwars: boolean;
  underworld: boolean;
  /** True when random milestones/awards are enabled at all (any mode). */
  randomMA: boolean;
  soloTR: boolean;
  twoCorpsVariant: boolean;
  /** True when Escape Velocity is configured. */
  escapeVelocity: boolean;
  solarPhaseOption: boolean;
  requiresVenusTrackCompletion: boolean;
  shuffleMapOption: boolean;
  /** True when any custom corporation/colony/prelude/CEO/banned/included list is set. */
  customLists: boolean;
};

type Rule = {
  key: AutomaConflictKey;
  test: (o: AutomaCompatibilityInput) => boolean;
  reason: (o: AutomaCompatibilityInput) => string;
};

/**
 * The POC supports exactly the officially-covered module set on Tharsis:
 * Corporate Era + Prelude 1 + Venus Next + Colonies (any subset). The rule
 * ORDER is load-bearing — the server throws the FIRST conflict, and existing
 * tests/messages rely on the current wording.
 */
const RULES: ReadonlyArray<Rule> = [
  {key: 'board', test: (o) => o.boardName !== BoardName.THARSIS, reason: (o) => `the ${o.boardName} board yet — the POC covers Tharsis`},
  // Unsupported expansions / modules.
  {key: 'expansion:turmoil', test: (o) => o.turmoil, reason: () => 'Turmoil in the POC'},
  {key: 'expansion:prelude2', test: (o) => o.prelude2, reason: () => 'Prelude 2 (per the official rules, and out of POC scope)'},
  {key: 'expansion:promo', test: (o) => o.promo, reason: () => 'promo cards in the POC'},
  {key: 'expansion:community', test: (o) => o.community, reason: () => 'community cards'},
  // NOTE: ARES is NOT a conflict — MarsBot plays it via house rules (mirrors the
  // alt-Venus-board / Delta Project precedents): Ares neighborhood bonuses pay
  // the bot 1 M€ per bonus unit (the printed-icon conversion), the bot AVOIDS
  // placing next to hazards (a strong scoring preference, never a legality
  // change), and a placement that still ends up next to a hazard regresses ONE
  // random tag track (its production-cost equivalent). See AutomaAres.ts +
  // the isMarsBot branches in AresHandler.
  {key: 'expansion:moon', test: (o) => o.moon, reason: () => 'The Moon'},
  {key: 'expansion:pathfinders', test: (o) => o.pathfinders, reason: () => 'Pathfinders'},
  {key: 'expansion:ceo', test: (o) => o.ceo, reason: () => 'CEOs'},
  {key: 'expansion:starwars', test: (o) => o.starwars, reason: () => 'Star Wars'},
  {key: 'expansion:underworld', test: (o) => o.underworld, reason: () => 'Underworld'},
  // NOTE: the Delta Project ("Гидросеть") is NOT a conflict — MarsBot plays it
  // via the Solo Delta Project reference card (see AutomaDeltaProject).
  // Variants the official Automa setup does not describe.
  // NOTE: the start-of-game DRAFT variants (initial / prelude / CEO) are NOT
  // conflicts — with a single human there is nobody to pass to and MarsBot
  // never joins the human's starting picks, so they DEGENERATE into the
  // standard setup. `Game.newInstance` normalizes them off for automa games
  // instead of rejecting (the resulting setup is identical either way).
  {key: 'rule:randomMilestonesAwards', test: (o) => o.randomMA, reason: () => 'random milestones and awards'},
  {key: 'variant:soloTR', test: (o) => o.soloTR, reason: () => 'the 63 TR solo variant (the win condition is beating MarsBot)'},
  {key: 'variant:twoCorps', test: (o) => o.twoCorpsVariant, reason: () => 'the two-corporations variant'},
  {key: 'variant:escapeVelocity', test: (o) => o.escapeVelocity, reason: () => 'Escape Velocity'},
  // Venus Next's World Government Terraforming: its role is played by the
  // Government Intervention bonus card (Adding Expansions p.3) — never both.
  {key: 'variant:solarPhase', test: (o) => o.solarPhaseOption, reason: () => 'the Solar Phase / WGT option (Government Intervention covers it)'},
  {key: 'variant:venusCompletion', test: (o) => o.requiresVenusTrackCompletion, reason: () => 'the "Venus must be completed" variant'},
  // NOTE: the ALTERNATE Venus board is NOT a conflict — MarsBot never answers
  // prompts, so its alt-track bonus resolves as fixed gains (house rule):
  // 1 M€ per crossed bonus space, +1 floater for the 30% wild resource.
  // See the isMarsBot branch in Game.increaseVenusScaleLevel.
  {key: 'rule:randomBoardTiles', test: (o) => o.shuffleMapOption, reason: () => 'the shuffled map (MarsBot tile placement uses the printed board)'},
  {key: 'variant:customLists', test: (o) => o.customLists, reason: () => 'custom card/colony lists in the POC'},
];

/** Every conflict of the given configuration, in the server's check order. */
export function automaConflicts(input: AutomaCompatibilityInput): Array<AutomaConflict> {
  const conflicts: Array<AutomaConflict> = [];
  for (const rule of RULES) {
    if (rule.test(input)) {
      conflicts.push({key: rule.key, reason: rule.reason(input)});
    }
  }
  return conflicts;
}

/** The conflict hitting a specific UI control, if any. */
export function conflictFor(conflicts: ReadonlyArray<AutomaConflict>, key: AutomaConflictKey): AutomaConflict | undefined {
  return conflicts.find((c) => c.key === key);
}

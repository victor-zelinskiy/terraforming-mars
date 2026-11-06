import {BoardName} from '../boards/BoardName';
import {RandomBoardOption} from '../boards/RandomBoardOption';

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
  | 'variant:customColonies';

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
  /** A concrete board, or a still-unresolved random request (`RandomBoardOption`). */
  boardName: string;
  turmoil: boolean;
  /**
   * Turmoil Redux («Кризис: Возвращение») — NOT a conflict: MarsBot is a seat
   * at the Mars Parliament (docs/TURMOIL_REDUX_MARSBOT.md — it votes through
   * Party Politics and Lobbying, may win a vote, may take the chairmanship;
   * an enacted law never pays it). Named here so the matrix STATES the
   * combination is allowed instead of merely not mentioning it.
   */
  turmoilRedux: boolean;
  prelude2: boolean;
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
  /**
   * True when a custom COLONY list is set. Custom CARD lists are deliberately
   * NOT here — see the rule below.
   */
  customColonyList: boolean;
};

type Rule = {
  key: AutomaConflictKey;
  test: (o: AutomaCompatibilityInput) => boolean;
  reason: (o: AutomaCompatibilityInput) => string;
};

/**
 * The maps MarsBot has a board, a reference card and a Corporate Competition
 * card for. Each one needs a `MarsBotMapProfile` on the server
 * (`src/server/automa/boards/MarsBotMapProfile.ts`) — a spec pins the two lists
 * together, so adding a name here without its profile fails loudly.
 *
 * Lives in `common` because BOTH the create-game UI (which greys out the
 * unsupported boards) and the server guard read it.
 */
export const AUTOMA_SUPPORTED_BOARDS: ReadonlyArray<BoardName> = [
  BoardName.THARSIS,
  BoardName.HELLAS,
  BoardName.ELYSIUM,
  BoardName.UTOPIA_PLANITIA,
  // The board the official Automa material calls «Terra Cimmeria»: the one
  // with the MSL Curiosity colony hex and the B12 milestone/award row. The
  // fork's older `TERRA_CIMMERIA` (the same geography, another row) has its own
  // home-made board below.
  BoardName.TERRA_CIMMERIA_NOVA,
  // The official Vastitas Borealis (Viking 1/2, the North Pole, the B13 row).
  BoardName.VASTITAS_BOREALIS_NOVA,
  // The fork's older, FAN-MADE Vastitas Borealis — the first map with a
  // HOME-MADE MarsBot board, Corporate Competition (BF1) and milestone / award
  // rules, designed by the law of the six official boards (2026-11-02;
  // docs/claude/marsbot-fan-map-checklist.md, docs/AUTOMA_DATA_AUDIT.md §2f / §17).
  BoardName.VASTITAS_BOREALIS,
  // The fan-made Amazonis Planitia — the second home-made profile (2026-11-02; §2g / §18).
  BoardName.AMAZONIS,
  // The OLD, fan-made Terra Cimmeria — the third home-made board (2026-11-03; §2h / §19). Not the official map
  // (`TERRA_CIMMERIA_NOVA`, B12 above): the same geography, another milestone / award row.
  BoardName.TERRA_CIMMERIA,
  // The fan-made Arabia Terra — the fourth home-made board (2026-11-05; §2i / §21): coves and the Pathfinders-style
  // cell bonuses.
  BoardName.ARABIA_TERRA,
  // The fan-made Hollandia — the fifth fan map and the LAST one (2026-11-06; §2j / §23): no milestone / award row of
  // its own, so every game on it draws its set and MarsBot plays the random-set generator's mat on a borrowed Tharsis
  // base, with the B14 «Corporate Competition · this game's set» (docs/claude/marsbot-dynamic-ma-framework.md). With it
  // every board of the game is covered — the `board` rule below now stands for a map a future sync brings.
  BoardName.HOLLANDIA,
];

/** «tharsis, hellas and elysium» — the list read out in the rejection reason. */
function supportedBoardList(): string {
  const names = [...AUTOMA_SUPPORTED_BOARDS];
  const last = names.pop();
  return names.length === 0 ? String(last) : `${names.join(', ')} and ${last}`;
}

/**
 * The supported module set: Corporate Era + Prelude 1 + Venus Next + Colonies
 * (any subset), on any board in {@link AUTOMA_SUPPORTED_BOARDS}. The rule
 * ORDER is load-bearing — the server throws the FIRST conflict, and existing
 * tests/messages rely on the current wording.
 */
const RULES: ReadonlyArray<Rule> = [
  {
    key: 'board',
    // A RANDOM board request is never a conflict: the server resolves it from
    // the MarsBot-supported pool (src/server/boards/randomBoard.ts), so the
    // concrete board an automa game actually gets is always supported. The
    // server-side guard only ever sees resolved boards; this branch matters
    // for the client's pre-submit check.
    test: (o) => o.boardName !== RandomBoardOption.ALL &&
      o.boardName !== RandomBoardOption.OFFICIAL &&
      !AUTOMA_SUPPORTED_BOARDS.includes(o.boardName as BoardName),
    reason: (o) => `the ${o.boardName} board yet — MarsBot covers ${supportedBoardList()}`,
  },
  // Unsupported expansions / modules.
  {key: 'expansion:turmoil', test: (o) => o.turmoil, reason: () => 'Turmoil in the POC'},
  // NOTE: TURMOIL REDUX is NOT a conflict — the bot is a political seat there
  // (`BotParliamentMode` 'politics': Party Politics + Lobbying place its
  // delegates, it can be the winning player and the chairman, and an enacted
  // law never pays or asks it). `turmoilRedux` is read by no rule on purpose;
  // it is in the input so the allowance is a stated fact of the matrix.
  // See docs/TURMOIL_REDUX_MARSBOT.md and AutomaCompatibility.spec.ts.
  // NOTE: PRELUDE 2 is NOT a conflict — the official rules play it with MarsBot (docs/AUTOMA_DATA_AUDIT.md: only
  // Recession leaves the deck), and the fork adapted every one of its 54 cards against the bot as one more seat
  // («the bot is just another player»: its twins kept apart by the collision key, each card's spec with its MarsBot
  // block). Recession leaves the SOLO game against the bot only (`AutomaBans`; a table of two humans and the bot keeps
  // it — docs/claude/marsbot-home-rules.md § 3). `prelude2` is read by no rule on purpose; it is in the input so the
  // allowance is a stated fact of the matrix.
  // NOTE: PROMO is NOT a conflict — the official FAQ (rulebook p.11) covers it:
  // generic remove/steal/production adapters + the per-card rules for LawSuit,
  // St. Joseph of Cupertino Mission, Asteroid Deflection System, and the Mons
  // Insurance official-solo ban (src/server/automa/AutomaBans.ts). See
  // docs/AUTOMA_DATA_AUDIT.md §9 + docs/AUTOMA_PROMO_MULTIPLAYER_FRAME.md.
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
  // RANDOM MILESTONES AND AWARDS play on every supported board since the random-set framework
  // (docs/claude/marsbot-dynamic-ma-framework.md): the generator deals the bot a mat, a placement layer and a B14
  // «Corporate Competition · this game's set» for the drawn set. A board MarsBot does not cover (none today — Hollandia,
  // the last one, plays since 2026-11-06) is refused by the `board` rule above; this one stays for that case only, so
  // the matrix still names the box.
  {key: 'rule:randomMilestonesAwards', test: (o) => o.randomMA && o.boardName !== RandomBoardOption.ALL &&
    o.boardName !== RandomBoardOption.OFFICIAL && !AUTOMA_SUPPORTED_BOARDS.includes(o.boardName as BoardName),
  reason: () => 'random milestones and awards on a board MarsBot does not cover'},
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
  // NOTE: custom CARD lists (corporations / preludes / project cards / banned /
  // included) are NOT a conflict — they only reshape the DECKS, which reaches
  // MarsBot indirectly at most. The bot is dealt no corporation, no prelude and
  // no CEO, and it resolves a project card purely from its PRINTED TAGS
  // (AutomaResolver.resolveProjectCard), with an unknown tag safely ignored —
  // so no card list can hand it something it cannot play.
  // The COLONY list is different: it is DIRECT bot data. MarsBot's shipping
  // board (ShippingBoardData) has exactly 11 storage areas — one per base
  // Colonies tile — and `AutomaColonies.addToStorage` THROWS on a colony
  // outside them, so a custom list can crash the bot mid-turn.
  {key: 'variant:customColonies', test: (o) => o.customColonyList, reason: () => 'a custom colony list (its shipping board covers the 11 base colony tiles)'},
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

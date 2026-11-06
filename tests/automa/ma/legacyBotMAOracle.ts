
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {MarsBotTrackRole} from '../../../src/common/automa/AutomaTypes';
import {IAward} from '../../../src/server/awards/IAward';
import {IMilestone, milestoneThreshold} from '../../../src/server/milestones/IMilestone';
import {IGame} from '../../../src/server/IGame';
import {IProjectCard} from '../../../src/server/cards/IProjectCard';
import {AmazonisEngineer} from '../../../src/server/awards/amazonisPlanitia/AmazonisEngineer';
import {Warmonger} from '../../../src/server/awards/terraCimmeria/Warmonger';
import {CosmicSettler} from '../../../src/server/awards/arabiaTerra/CosmicSettler';
import {newProjectCard} from '../../../src/server/createCard';
import {marsBotOf} from '../../../src/server/automa/AutomaUtil';

/**
 * THE LEGACY ORACLE — a FROZEN copy of the per-name `switch` statements `AutomaMAEvaluation` carried before the
 * bot-rule registry (`src/server/automa/ma/`) replaced them (HEAD `c3b90ef720`, 2026-11-06). Read ONLY by
 * `botMARegistryDifferential.spec.ts`, which proves the registry evaluates every name exactly as this code did.
 * Never edit the logic below: it is the reference the migration is measured against. A rule the registry
 * deliberately re-points later (docs/claude/marsbot-dynamic-ma-progress.md § deviations) is narrowed in the SPEC to
 * the boards where it must still agree — this file stays as it was.
 */
/** The position of the track holding this canonical role (0 when the board has no such track). */
function trackPosition(game: IGame, role: MarsBotTrackRole): number {
  return game.automa?.board.getTrackOfRole(role)?.position ?? 0;
}

/** Every track EXCEPT the separate Venus board — the set the "every track" milestones read. */
function martianTracks(game: IGame) {
  return game.automa?.board.tracks.filter((t) => t.definition.role !== 'venus') ?? [];
}

/**
 * The position of the track the JOVIAN tag rides on this map — addressed by
 * the TAG, because the pairing moves from board to board (Power on Tharsis /
 * Utopia, Science on Hellas / Elysium and the fan-made Vastitas Borealis,
 * Earth on Terra Cimmeria / Vastitas Borealis Nova) and a Jovian-counting
 * criterion means «wherever the Jovian tag lives». 0 when no track carries it.
 */
function jovianTrackPosition(game: IGame): number {
  const board = game.automa?.board;
  const index = board?.getTrackIndexForTag(Tag.JOVIAN);
  return board === undefined || index === undefined ? 0 : board.tracks[index].position;
}

/**
 * «Visionary — Lowest track space (2nd lowest if playing with Venus) doubled»
 * (Adding Expansions p.15, the Awards & Milestones module). The base is the
 * lowest position over EVERY track the board has; with Venus Next the Venus
 * row joins the set and the rule skips the single lowest — the substitution
 * reading Diversifier has (one track may be left behind).
 */
function visionaryBase(game: IGame): number {
  const positions = game.automa?.board.tracks.map((t) => t.position) ?? [];
  return everyTrackScore(positions, game.gameOptions.venusNextExtension ? 1 : 0);
}

/**
 * The threshold an "at least space N on every track" milestone actually clears.
 *
 * Without Venus that is simply the least-advanced track. With Venus the
 * official adaptation lets ONE track be substituted — «Planner (Tharsis):
 * reached spot 4 on every track except [Venus]», «Diversifier (Hellas):
 * reached spot 3 on 7 of the eight tracks (i.e., can substitute one other
 * track)» (Adding Expansions p.2). The two readings differ: Planner drops the
 * Venus track from the set, Diversifier counts it and drops the WORST of the
 * eight — so Diversifier can be met with the Venus track at 0 as long as the
 * seven others are there, and equally with Venus at 3 and one Martian track
 * behind.
 *
 * `drop` is how many of the lowest positions may be ignored; the value returned
 * is the lowest position that still counts, which doubles as the display score.
 */
function everyTrackScore(positions: ReadonlyArray<number>, drop: number): number {
  if (positions.length === 0) {
    return 0;
  }
  const sorted = [...positions].sort((a, b) => a - b);
  return sorted[Math.min(drop, sorted.length - 1)];
}

/** "7 of the eight tracks" — every track on the board, one substitutable, once Venus adds the 8th. */
function diversifierScore(game: IGame): number {
  const tracks = game.automa?.board.tracks ?? [];
  const substitutable = game.gameOptions.venusNextExtension ? 1 : 0;
  return everyTrackScore(tracks.map((t) => t.position), substitutable);
}

/** The furthest-advanced track — "any one track at space N or higher". */
function bestTrackPosition(game: IGame): number {
  const positions = game.automa?.board.tracks.map((t) => t.position) ?? [];
  return positions.length === 0 ? 0 : Math.max(...positions);
}

/**
 * "All N of the following tracks at space X or higher" — the least-advanced of
 * a NAMED set of roles (Utopia's Trader). The weakest member is both the gate
 * and the honest display value, exactly like `everyTrackScore`.
 *
 * A role the board does not have counts as 0, which is the right answer and not
 * a special case: Trader names the Venus track, and without Venus Next MarsBot
 * genuinely cannot reach space 2 on a track that is not in play.
 */
function allTracksScore(game: IGame, roles: ReadonlyArray<MarsBotTrackRole>): number {
  return Math.min(...roles.map((role) => trackPosition(game, role)));
}

/**
 * Project cards in MarsBot's PLAYED PILE matching a predicate — the bot has no
 * tableau, so every «cards in play» criterion has to read the pile instead.
 * The card OBJECT is what answers (its printed type and cost), never a UI
 * colour or a stored label.
 */
function botPlayedPile(game: IGame, matches: (card: IProjectCard) => boolean): number {
  let count = 0;
  for (const name of game.automa?.playedPile ?? []) {
    const card = newProjectCard(name);
    if (card !== undefined && matches(card)) {
      count++;
    }
  }
  return count;
}

/** A per-card QUANTITY summed over MarsBot's played pile (printed tags of one kind, …) — the pile's other reading. */
function botPlayedPileSum(game: IGame, amount: (card: IProjectCard) => number): number {
  let sum = 0;
  for (const name of game.automa?.playedPile ?? []) {
    const card = newProjectCard(name);
    if (card !== undefined) {
      sum += amount(card);
    }
  }
  return sum;
}

/** Green (automated) project cards in MarsBot's played pile. */
function botPlayedPileCount(game: IGame, type: CardType): number {
  return botPlayedPile(game, (card) => card.type === type);
}

/** «Green/blue cards» — the pair the Tycoon family counts (never events). */
const GREEN_AND_BLUE: ReadonlyArray<CardType> = [CardType.AUTOMATED, CardType.ACTIVE];

/**
 * The milestone's OWN printed threshold, used as the `target` of a bot
 * criterion that is the PLAYER's metric read out of a different container
 * (the played pile). Keeping the two equal makes the normalization the
 * identity — the bot's row shows the very number a human row would.
 *
 * `fallback` covers a milestone with no numeric threshold, which cannot happen
 * for this family but must not silently become a division by zero.
 */
function printedTarget(milestone: IMilestone, game: IGame, fallback: number): number {
  return milestoneThreshold(milestone, game) ?? fallback;
}

export function legacyMilestoneProgress(
  milestone: IMilestone, game: IGame,
): {value: number, target: number} | undefined {
  switch (milestone.name) {
  // ── Tharsis ──────────────────────────────────────────────────────────────
  case 'Builder': // Space 8 on the Building track (the human counts building tags).
    return {value: trackPosition(game, 'building'), target: 8};
  case 'Planner': // Space 4 on every track — except Venus (Adding Expansions p.2).
    return {value: everyTrackScore(martianTracks(game).map((t) => t.position), 0), target: 4};
    // ── Hellas (Adding Expansions p.9) ───────────────────────────────────────
  case 'Diversifier': // "At least space 3 on every track" (7 of 8 with Venus).
    return {value: diversifierScore(game), target: 3};
  case 'Tactician': // "It has at least 35 MC".
    return {value: marsBotOf(game).megaCredits, target: 35};
  case 'Energizer': // "[Power] track at space 6 or higher".
    return {value: trackPosition(game, 'power'), target: 6};
  case 'Rim Settler': // "[Jovian/Science] track at space 6 or higher".
    return {value: trackPosition(game, 'science'), target: 6};
    // ── Elysium (Adding Expansions p.9) ──────────────────────────────────────
  case 'Generalist':
    // "At least space 2 on EVERY track" — and the board prints the exclusion
    // itself: «(excl. [V])». So this is Planner's shape, NOT Diversifier's:
    // the Venus track leaves the set entirely instead of being the one
    // substitutable member. Seven Martian tracks at 2 with Venus at 0 is MET;
    // Venus at 18 never stands in for a Martian track that is still at 1.
    return {value: everyTrackScore(martianTracks(game).map((t) => t.position), 0), target: 2};
  case 'Specialist':
    // "Any one track at space 10 or higher". No exclusion is printed here —
    // the sheet marks «(excl. [V])» on Generalist alone — and «the Venus
    // track behaves identically to every other track» (Adding Expansions
    // p.2), so the Venus track is a candidate like the rest.
    return {value: bestTrackPosition(game), target: 10};
  case 'Ecologist': // "[Bio] track at space 4 or higher".
    return {value: trackPosition(game, 'bio'), target: 4};
  case 'Tycoon':
  case 'Tycoon10': // the fork's Elysium variant (10 blue+green, not 15)
    // Officially "Unchanged (green/blue cards in MarsBot's played pile)" —
    // the SAME metric as the human's, but the bot has no tableau, so the
    // milestone's own getScore would honestly read 0 forever. It is here for
    // that container difference ALONE: the target is the milestone's own
    // printed threshold (the fork ships Tycoon10 on Elysium, so this reads
    // 10, not a hard-coded 15), which makes the normalization the identity —
    // the bot's row is literally the human's number. The award twin of this
    // case is Magnate in `botAwardScore`.
    return {
      value: botPlayedPile(game, (card) => GREEN_AND_BLUE.includes(card.type)),
      target: printedTarget(milestone, game, 15),
    };
  case 'Legend':
  case 'Legend4': // the modular variant (4 red)
    // "Unchanged (red cards in MarsBot's played pile)" — the played-pile
    // container case again, see Tycoon above. Covers the modular Legend4.
    return {
      value: botPlayedPile(game, (card) => card.type === CardType.EVENT),
      target: printedTarget(milestone, game, 5),
    };
    // ── Utopia Planitia (Adding Expansions p.9) ──────────────────────────────
    // The fork ships this board's slots under its own canonical names, so the
    // cases below read Land Specialist / Tradesman / Smith where the reference
    // card prints Specialist / Trader / Metallurgist (deduplicated clones — see
    // the notes in Milestones.ts). The deprecated originals are aliased beside
    // them so an old save still evaluates.
  case 'Land Specialist':
    // "3 or more MarsBot bonus cards are destroyed." Nothing to do with the
    // human's special tiles — the bot's reference card replaces the criterion
    // outright, and the count is its permanent DESTROYED pile (B04/B05/B07 and
    // friends remove themselves from the game), never the per-generation discard.
    return {value: game.automa?.destroyedBonusCards.length ?? 0, target: 3};
  case 'Trader':
  case 'Tradesman':
    // "All 3 of the following tracks at space 2 or higher: [Jovian/Energy],
    // [Earth/City], [Venus]." Named by ROLE, so the Jovian pairing sitting on
    // the POWER track here (and on the science track on Hellas/Elysium) changes
    // nothing. Without Venus Next that track is absent and reads 0 — the
    // milestone is then simply unreachable, the honest answer for a criterion
    // that names a track nobody has.
    return {value: allTracksScore(game, ['power', 'earth', 'venus']), target: 2};
  case 'Metallurgist':
  case 'Smith':
    // "[Building] track and [Space] track have a COMBINED value of 7 or higher."
    // The board's own player aid still prints the pre-errata 5; the current
    // rulebook says 7, and a rulebook outranks a stale board reminder.
    return {value: trackPosition(game, 'building') + trackPosition(game, 'space'), target: 7};
  case 'Researcher': // "[Science] track at space 4 or higher".
    return {value: trackPosition(game, 'science'), target: 4};
    // ── Terra Cimmeria (Adding Expansions p.9) ───────────────────────────────
    // The fork ships this board's slots under its own canonical names, so the
    // cases below read Coastguard / C. Forester / Fundraiser where the reference
    // card prints Coast Guard / Forester / Financier. NOTE the board is
    // TERRA_CIMMERIA_NOVA — the fork's older TERRA_CIMMERIA is a different map
    // with a different M&A row and is not automa-supported, so no name here is
    // ambiguous (pinned by `noNameServesTwoBoards` in the normalization spec).
  case 'Planetologist':
    // "[Jovian/Earth] track and [Venus] track have a combined value of 5 or
    // higher." Named by ROLE, so the Jovian pairing sitting on the EARTH row
    // here (and on Power/Science elsewhere) needs no special case. Without
    // Venus Next that track is absent and contributes 0 — the same reading
    // every other Venus-naming criterion uses (`trackPosition` returns 0 for a
    // role the board does not have), so the milestone is simply harder, not
    // unreachable: the Jovian/Earth row alone can still carry it to 5.
    return {value: trackPosition(game, 'earth') + trackPosition(game, 'venus'), target: 5};
  case 'Architect': // "[City/Science] track at space 6 or higher".
    return {value: trackPosition(game, 'science'), target: 6};
  case 'C. Forester': // "[Bio] track at space 10 or higher".
    return {value: trackPosition(game, 'bio'), target: 10};
  case 'Fundraiser': // "[Event] track at space 10 or higher".
    return {value: trackPosition(game, 'event'), target: 10};
    // ── Vastitas Borealis (Adding Expansions p.11) ───────────────────────────
    // The board is VASTITAS_BOREALIS_NOVA — the fork's older VASTITAS_BOREALIS
    // is a fan map with its own M&A row and is not automa-supported, so no name
    // here is ambiguous (pinned by `noNameServesTwoBoards`). Geologist is
    // «Unchanged»: the bot's real tiles on or next to the volcanic areas, read
    // by the player evaluator (the default branch below), at the threshold the
    // map prints.
  case 'Agronomist': // "[Animal/Plant] track at space 4 or higher".
    return {value: trackPosition(game, 'bio'), target: 4};
  case 'V. Spacefarer': // "[Space] track space 5 or higher".
    return {value: trackPosition(game, 'space'), target: 5};
  case 'Engineer':
    // "[Jovian/Earth] track and [City/Energy] track has a combined value of 10
    // or higher." Named by ROLE — the City and Jovian moves of this board need
    // no special case.
    return {value: trackPosition(game, 'earth') + trackPosition(game, 'power'), target: 10};
  case 'Farmer':
    // "EITHER [Microbe/Science] track OR [Animal/Plant] track at space 6 or
    // higher." Either one suffices, so the progress is the FURTHER of the two
    // — never their sum (that would meet it at 3 + 3).
    return {value: Math.max(trackPosition(game, 'science'), trackPosition(game, 'bio')), target: 6};
    // ── Vastitas Borealis, the fan map (the fork's own rules — docs/AUTOMA_DATA_AUDIT.md §17.2)
    // Smith and Tradesman stand here under Utopia's official rules above (the
    // same milestones). Irrigator («4 tiles adjacent to oceans») and
    // Capitalist («64 M€») are the UNCHANGED family — the default branch
    // below: Irrigator is literally the Coastguard class («As usual», Adding
    // Expansions p.13) and the bot's tiles are real; Capitalist reads the M€
    // the bot really holds.
  case 'V. Electrician':
    // HOME RULE: «[Power] track at space 4 or higher» — the N ↔ N law of a
    // single-tag track (Researcher 4 science tags ↔ 4, Spacefarer 4 ↔ 4,
    // Terran 5 ↔ 5, Agronomist 4 ↔ 4); Power stands ALONE on this board, so
    // four power tags read as four spaces.
    return {value: trackPosition(game, 'power'), target: 4};
    // ── Amazonis Planitia, the fan map (docs/AUTOMA_DATA_AUDIT.md §18.2) ────
    // Colonizer («4 colonies» — the A&M list's Pioneer at 4: «As usual», its
    // three colony cubes printed on the board as `colony5` cells) and
    // Tropicalist (real tiles in the equatorial rows) are the UNCHANGED family.
  case 'Forester':
    // OFFICIAL (Adding Expansions p.13): «Forester — Reached space 6 on the
    // [bio] track» (the human: 4 plant production).
    return {value: trackPosition(game, 'bio'), target: 6};
  case 'Terran':
    // OFFICIAL calibration (p.14): «Terran — Reached space 5 on the [Earth]
    // track» for the list's 5-tag Terran (the fork's Terran5), on the Tharsis
    // board where Earth rides with City — 1:1. This map's Terran asks 6 tags,
    // so 6 spaces of the City/Earth row.
    return {value: trackPosition(game, 'earth'), target: 6};
  case 'Minimalist': {
    // HOME RULE. «Have no more than 2 cards in hand» — the bot has no hand,
    // and read as the player's metric (0 cards) the milestone would be met
    // from the first turn. Its hand is its ACTION DECK of the generation: the
    // milestone is met while at most 2 cards are left in it. Expressed as a
    // 0 / 1 fraction because the framework reads «met» as value ≥ target and
    // this is the one «at most» criterion in the supported set.
    const left = game.automa?.actionDeck.length ?? 0;
    return {value: left <= 2 ? 1 : 0, target: 1};
  }
  // ── The OLD (fan) Terra Cimmeria (docs/AUTOMA_DATA_AUDIT.md §19.2) ──────
  // Terra Pioneer («own 5 tiles on Mars» — Landlord's «As usual») and Gambler («fund 2 awards» — the bot funds
  // awards itself on its award cells, `AutomaMilestonesAwards.fundAwardAction`) are the UNCHANGED family below.
  case 'T. Collector': {
    // HOME RULE, «as usual» in the bot's container: «3 sets of automated, active and event cards in play» read
    // off its PLAYED PILE — Legend's (red cards) and Tycoon's (blue / green) official «As usual (… in played
    // pile)», the three colours at once. The weakest colour is the number of complete sets.
    const sets = Math.min(
      botPlayedPileCount(game, CardType.AUTOMATED),
      botPlayedPileCount(game, CardType.ACTIVE),
      botPlayedPileCount(game, CardType.EVENT));
    return {value: sets, target: printedTarget(milestone, game, 3)};
  }
  case 'Firestarter':
    // HOME RULE (the owner's answer, 2026-11-03): «have 20 heat» — the bot keeps no heat, so the heat-badged track
    // (the earth role) at space 8: Fundraiser's calibration (p.13: 12 M€ production ↔ space 8), the stock the
    // milestone asks for read as the production that would fill it.
    return {value: trackPosition(game, 'earth'), target: 8};
  case 'T. Spacefarer':
    // HOME RULE by the N ↔ N law of a single-tag track (Spacefarer 4 space tags ↔ space 4, p.14): 6 space tags ↔
    // the space track at 6 — Space stands alone on every board.
    return {value: trackPosition(game, 'space'), target: 6};
    // ── Arabia Terra, the fan map (docs/AUTOMA_DATA_AUDIT.md §21.2) ─────────
    // Pioneer and Land Specialist stand here under Utopia Planitia's official rules, Terran under Amazonis' (the same
    // milestones, by name).
  case 'Economizer':
    // HOME RULE (the owner's answer, 2026-11-05): «5 heat production» ↔ the POWER track at 5. The heat badge lives
    // on the earth row, which Terran already reads on this map (two criteria never share a track), so the criterion
    // takes the association the official Thermalist prints — heat ↔ the energy track (B08) — and Energizer's
    // calibration on a Power-alone track (6 energy production ↔ space 6): N ↔ N.
    return {value: trackPosition(game, 'power'), target: 5};
  case 'Martian':
    // HOME RULE, «as usual» in the bot's container: «4 Mars tags in play» read off its PLAYED PILE — the printed
    // Mars tags of the cards it resolved (the board has no Mars track: the tag itself is flipped by the home rule
    // `AUTOMA_FLIP_TAGS`, but the card stays a Mars card). Legend / Tycoon's official «As usual (… in played pile)».
    return {
      value: botPlayedPileSum(game, (card) => card.tags.filter((tag) => tag === Tag.MARS).length),
      target: printedTarget(milestone, game, 4),
    };
    // ── Venus Next ───────────────────────────────────────────────────────────
  case 'Hoverlord': // Unchanged: 7 floater resources (Adding Expansions p.2).
    return {value: game.automa?.floaters ?? 0, target: 7};
  default:
    // THE «UNCHANGED» FAMILY — the bot is judged by the PLAYER's own metric
    // because it honestly HAS that metric, in the very place the player
    // milestone looks:
    //   · Terraformer (incl. the fork's Terraformer29 variant) — real TR;
    //   · Mayor / Gardener — real city and greenery tiles;
    //   · Hellas' Polar Explorer — real tiles in the two bottom rows;
    //   · Utopia Planitia's Pioneer — real colonies: the bot's id really is
    //     on the tile (`AutomaColonies.botBuildColony`), so
    //     `getColoniesCount()` counts it exactly like a player's;
    //   · Terra Cimmeria's Coastguard — "Unchanged", and honestly so: the
    //     criterion is TILES ADJACENT TO OCEANS, and the bot's tiles are real
    //     board tiles, so the milestone's own getScore reads them exactly as
    //     it reads a human's. Nothing to normalize — same metric, same units,
    //     same threshold (whatever this board prints for it);
    //   · Ares: Networker reads aresData.milestoneResults (the bot is
    //     tallied there like any player); Purifier honestly stays 0 (the bot
    //     never covers a hazard).
    // ELYSIUM CONTRIBUTES NOTHING HERE, and that is a decision, not an
    // oversight: its row is Generalist / Specialist / Ecologist (own track
    // criteria) plus Tycoon and Legend, which are worded "Unchanged" yet
    // still get explicit branches above — not because the RULE differs but
    // because the bot keeps its cards in `automa.playedPile` instead of a
    // tableau, so `canClaim` would read a permanent 0. "Unchanged rule" and
    // "default branch" are therefore not the same question: ask whether the
    // player evaluator can SEE the bot's version of the quantity. Utopia's
    // Pioneer above is the control case — same "Unchanged" wording, and it
    // genuinely belongs here, because a colony is one of the few quantities
    // the bot keeps in the very place the player milestone looks.
    // A card-based milestone that cannot appear here
    // (validateOptions pins the board set) reads the bot's empty tableau and
    // is honestly "not met". Nothing to normalize: same metric, same scale.
    return undefined;
  }
}

export function legacyAwardRawScore(award: IAward, game: IGame): number {
  const bot = marsBotOf(game);
  let score: number;
  switch (award.name) {
  // ── Tharsis ──────────────────────────────────────────────────────────────
  case 'Landlord': // Unchanged: tiles owned in play.
    score = award.getScore(bot);
    break;
  case 'Banker':
    score = trackPosition(game, 'building') + trackPosition(game, 'event');
    break;
  case 'Scientist':
    score = trackPosition(game, 'science');
    break;
  case 'Thermalist':
    score = trackPosition(game, 'power') + 5;
    break;
  case 'Miner':
    score = trackPosition(game, 'space') + 5;
    break;
    // ── Hellas (Adding Expansions p.9) ───────────────────────────────────────
  case 'Magnate':
    // "Unchanged (green cards in MarsBot's played pile)" — the bot has no
    // tableau, so the award's own getScore would honestly read 0.
    score = botPlayedPileCount(game, CardType.AUTOMATED);
    break;
  case 'Space Baron': // "[Space] track space".
    score = trackPosition(game, 'space');
    break;
  case 'Excentric': // "Every 5 MC counts as 1 resource".
    score = Math.floor(bot.megaCredits / 5);
    break;
  case 'Contractor': // "[Building] track space".
    score = trackPosition(game, 'building');
    break;
    // ── Elysium (Adding Expansions p.9) ──────────────────────────────────────
  case 'Celebrity':
    // "As usual, but MarsBot INCLUDES EVENTS in this count unlike you" — the
    // one printed asymmetry on this card. Two differences from the player's
    // own getScore, then: the pile instead of a tableau, and red cards
    // counted. Cost is the card's own printed base cost, 20 EXACTLY included.
    score = botPlayedPile(game, (card) => card.cost >= 20);
    break;
  case 'Industrialist': // "[Power] track space + 5".
    score = trackPosition(game, 'power') + 5;
    break;
  case 'Benefactor':
    // "Reduce MarsBot's TR by 15 FOR THE PURPOSE OF THIS AWARD" — an
    // evaluation-only handicap. The bot's actual terraform rating is
    // untouched (no event, no endgame change): this number exists solely to
    // be compared against the humans' TR here.
    score = bot.terraformRating - 15;
    break;
    // ── Utopia Planitia (Adding Expansions p.9) ──────────────────────────────
  case 'Investor': // "[Earth/City] track space".
    score = trackPosition(game, 'earth');
    break;
  case 'Botanist':
    // "[Bio] track space MINUS 2" — an evaluation handicap, like Elysium's
    // Benefactor. The track itself never moves for it.
    score = trackPosition(game, 'bio') - 2;
    break;
  case 'Incorporator':
    // "As usual, but MarsBot INCLUDES EVENTS in this count unlike you" —
    // Celebrity's twin at the other end of the price range: the played pile
    // instead of a tableau, and red cards counted. 10 EXACTLY qualifies.
    score = botPlayedPile(game, (card) => card.cost <= 10);
    break;
    // ── Terra Cimmeria (Adding Expansions p.9) ───────────────────────────────
  case 'Electrician':
    // "[Energy] track space" — the STANDALONE energy row on this board
    // (Jovian moved to Earth), reached by canonical role.
    score = trackPosition(game, 'power');
    break;
  case 'Mogul':
    // "The most-advanced track's space number doubled." A read, never a
    // mutation, and a tie changes nothing about the NUMBER.
    score = bestTrackPosition(game) * 2;
    break;
  case 'A. Zoologist': // "[Bio] track space + 5".
    score = trackPosition(game, 'bio') + 5;
    break;
  case 'Forecaster':
    // "Every 7 MC counts as 1 card with requirement" — floor, like Hellas'
    // Excentric: 6 M€ is 0 cards, 7 is 1, 13 is 1, 14 is 2.
    score = Math.floor(bot.megaCredits / 7);
    break;
    // ── Vastitas Borealis (Adding Expansions p.11) ───────────────────────────
    // Landscaper and Highlander are «Unchanged» — the bot's real tiles, read by
    // the player evaluator (the default branch below).
  case 'Traveller': // "[Jovian/Earth] track space + 5".
    score = trackPosition(game, 'earth') + 5;
    break;
  case 'Promoter': // "[Event] track space".
    score = trackPosition(game, 'event');
    break;
  case 'Blacksmith':
    // "[Building] track space OR [Space] track space, whichever is
    // more-advanced." The further of the two, never their sum.
    score = Math.max(trackPosition(game, 'building'), trackPosition(game, 'space'));
    break;
    // ── Vastitas Borealis, the fan map (docs/AUTOMA_DATA_AUDIT.md §17.3) ─────
    // Forecaster (M€ / 7, Terra Cimmeria's official rule) and Edgedancer
    // (unchanged — real edge tiles, Utopia's) stand here under the cases they
    // already have.
  case 'Visionary':
    // OFFICIAL (Adding Expansions p.15): «Lowest track space (2nd lowest if
    // playing with Venus) doubled».
    score = visionaryBase(game) * 2;
    break;
  case 'Naturalist':
    // HOME RULE: «plant + heat production» ↔ the plant-badged track (bio)
    // PLUS the heat-badged track (earth) — Manufacturer's shape («Sum of
    // [Building] and [Energy] tracks» for steel + energy production, p.15)
    // and Banker's (building + event).
    score = trackPosition(game, 'bio') + trackPosition(game, 'earth');
    break;
  case 'Voyager':
    // HOME RULE: «most Jovian tags» ↔ HALF the space of the track the Jovian
    // tag rides, floored — calibrated on Rim Settler (Hellas, p.9: 3 Jovian
    // tags ↔ Jovian/Science space 6, a 2:1 ratio). The bare space (Space
    // Baron's shape) would read the SCIENCE half of the pairing as Jovian
    // tags — science is 15 % of the deck, Jovian 7 % — and double the bot.
    score = Math.floor(jovianTrackPosition(game) / 2);
    break;
    // ── Amazonis Planitia, the fan map (docs/AUTOMA_DATA_AUDIT.md §18.3) ────
    // Promoter (event track, official) and A. Zoologist (bio + 5, official)
    // stand here under the cases they already have; Tourist is UNCHANGED (the
    // bot's real tiles and their real empty neighbours — the default below).
  case 'Curator':
    // HOME RULE: «most tags of any one type» ↔ the bot's MOST-ADVANCED track
    // — Mogul's reading (p.15 «Highest track space doubled») without the
    // doubling: the furthest track IS the tag the bot has resolved most.
    score = bestTrackPosition(game);
    break;
  case 'A. Engineer':
    // «Most cards in play that directly alter your own production» — the
    // same criterion read off the bot's PLAYED PILE (it has no tableau): the
    // Magnate / Celebrity / Tycoon container family, through the award's own
    // predicate so the two readings cannot drift.
    score = botPlayedPile(game, (card) => AmazonisEngineer.altersProduction(card));
    break;
    // ── The OLD (fan) Terra Cimmeria (docs/AUTOMA_DATA_AUDIT.md §19.3) ──────
    // Incorporator stands here under its official case above; Urbanist (the VP of greeneries beside its REAL cities)
    // and T. Politician (the delegates it really PLACED — the Redux Parliament's `placeVote` counts the bot's like a
    // human's; with no Parliament every seat reads 0) are the UNCHANGED family below.
  case 'Biologist':
    // OFFICIAL (Adding Expansions p.14): «Biologist — [bio] track space +5».
    score = trackPosition(game, 'bio') + 5;
    break;
  case 'Warmonger':
    // HOME RULE: «most cards in play that reduce other players' resources or production, events included» read off
    // the bot's PLAYED PILE (it has no tableau) through the award's own predicate, so the readings cannot drift.
    score = botPlayedPile(game, (card) => Warmonger.include(card));
    break;
    // ── Arabia Terra, the fan map (docs/AUTOMA_DATA_AUDIT.md §21.3) ─────────
    // Botanist (bio − 2, Utopia's official) and Promoter (the event track, official) stand here under the cases they
    // already have.
  case 'Zoologist':
    // OFFICIAL (Adding Expansions p.15): «Zoologist — [bio] track space +5» — the rule Terra Cimmeria's A. Zoologist
    // carries under its own name.
    score = trackPosition(game, 'bio') + 5;
    break;
  case 'A. Manufacturer':
    // HOME RULE, «as usual» in the bot's container: «most active (blue) cards in play» read off its PLAYED PILE —
    // Magnate's official shape («As usual (blue and green cards in played pile)», p.15), the blue half.
    score = botPlayedPileCount(game, CardType.ACTIVE);
    break;
  case 'Cosmic Settler':
    // HOME RULE: «most cities not on Mars» — the bot's cities come off its track icons, always on Mars, so the
    // player's metric would read 0 for ever. Its off-Mars cities are the CARDS that place one, in its played pile
    // (Ganymede Colony, Phobos Space Haven, …) — the award's own co-located predicate.
    score = botPlayedPile(game, (card) => CosmicSettler.placesCityOffMars(card));
    break;
    // ── Venus Next ───────────────────────────────────────────────────────────
  case 'Venuphile': // Venus track position (Adding Expansions p.3).
    score = trackPosition(game, 'venus');
    break;
  default:
    // Tile-based awards evaluate the bot's real board presence — Hellas'
    // Cultivator ("unchanged", greeneries owned) rides this, and so does the
    // whole Elysium tile pair: Desert Settler ("unchanged", tiles in the
    // Southern Region) and Estate Dealer ("unchanged", tiles adjacent to an
    // ocean) read the bot's REAL tiles through the very same evaluator the
    // humans use — there is nothing bot-specific to write, and Utopia
    // Planitia's two "Unchanged" awards ride it for the same reason:
    // Edgedancer ("Suburban" on the reference card) counts the bot's real
    // tiles on the board edge, Metropolist its real cities. Terra Cimmeria's
    // FOUNDER rides it for the third time — "Unchanged", and the bot's tiles
    // and their special-tile neighbours are all real. Its asymmetry is on the
    // HUMAN side instead ("the Neural Instance counts as a special tile for
    // MarsBot but not for you"), which is `humanAwardScore` below. The Ares pair
    // rides it too: Rugged counts its REAL tiles next to hazards,
    // Entrepreneur honestly reads 0 (the bot never owns adjacency-bonus
    // tiles); anything else cannot appear (validateOptions pins the board
    // set).
    score = award.getScore(bot);
    break;
  }  return score;
}

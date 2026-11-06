
import {CardType} from '../../../src/common/cards/CardType';
import {Tag} from '../../../src/common/cards/Tag';
import {Resource} from '../../../src/common/Resource';
import {SpaceType} from '../../../src/common/boards/SpaceType';
import {MarsBotTrackRole} from '../../../src/common/automa/AutomaTypes';
import {Board, isSpecialTileSpace} from '../../../src/server/boards/Board';
import {Space} from '../../../src/server/boards/Space';
import {IGame} from '../../../src/server/IGame';
import {AmazonisEngineer} from '../../../src/server/awards/amazonisPlanitia/AmazonisEngineer';
import {Warmonger} from '../../../src/server/awards/terraCimmeria/Warmonger';
import {hasRequirement} from '../../../src/server/cards/requirements/CardsWithRequirementsRequirement';
import {castBotVote} from '../../../src/server/automa/AutomaPolitics';
import {AutomaResolver} from '../../../src/server/automa/AutomaResolver';
import {AutomaTilePlacer} from '../../../src/server/automa/AutomaTilePlacer';
import {marsBotOf} from '../../../src/server/automa/AutomaUtil';
import {mapCorporateCompetition, resolveCubeRemoval, revealUntilAndResolve, selectHighestScoringCubeAttack} from '../../../src/server/automa/AutomaBonusCards';

/**
 * THE LEGACY HELPER ORACLE — a FROZEN copy of `AutomaBonusCards.tryAwardHelper`'s per-name `switch` before the
 * bot-rule registry replaced it (HEAD `c3b90ef720`, 2026-11-06). Read ONLY by `botMARegistryDifferential.spec.ts`.
 * Never edit the logic below — it is the reference the migration is measured against.
 */
export function legacyTryAwardHelper(game: IGame, awardName: string): boolean {
  const automa = game.automa;
  if (automa === undefined) {
    throw new Error('Not an automa game');
  }
  const board = automa.board;
  const advanceRole = (role: MarsBotTrackRole): boolean => {
    const index = board.getTrackIndexOfRole(role);
    if (index === undefined || !board.tracks[index].canAdvance()) {
      return false;
    }
    AutomaResolver.advanceTrack(game, index);
    return true;
  };
  /**
   * «MarsBot places a greenery tile and raises oxygen 1 step» — the ORDINARY
   * bot greenery pipeline, so tile ownership, the covered-icon M€, oxygen, TR,
   * the placement bonuses, the «any player» card triggers, Ares and the map's
   * own tiebreakers all apply exactly as they do for a printed track icon.
   *
   * `restrict` is a card's HARD CONSTRAINT on WHERE (B10's Southern Region /
   * ocean adjacency): it narrows the LEGAL set before any strategy runs, and
   * an empty result means the helper is impossible — never a fallback to an
   * unconstrained greenery, and never a Failed Action (the caller then tries
   * the next funded award and MarsBot pays nothing).
   */
  const placeGreenery = (restrict?: (space: Space) => boolean): boolean =>
    AutomaTilePlacer.placeGreenery(game, {restrict, onEmpty: 'impossible'});
  /** «MarsBot places a city tile» — the ordinary bot city pipeline (B11 Metropolist). */
  const placeCity = (): boolean => AutomaTilePlacer.placeCity(game, {onEmpty: 'impossible'});
  switch (awardName) {
  // ── Tharsis (B08) ────────────────────────────────────────────────────────
  case 'Landlord':
    return placeGreenery();
  case 'Banker': {
    // Advance Building or Event, whichever is least advanced; Building on ties.
    const alive = (['building', 'event'] as const)
      .map((role) => ({role, track: board.getTrackOfRole(role)}))
      .filter((e) => e.track?.canAdvance() === true);
    if (alive.length === 0) {
      return false;
    }
    alive.sort((a, b) => (a.track?.position ?? 0) - (b.track?.position ?? 0)); // Stable: Building first on ties.
    return advanceRole(alive[0].role);
  }
  case 'Scientist': return advanceRole('science');
  case 'Thermalist': return advanceRole('power');
  case 'Miner': return advanceRole('space');
  // ── Hellas (B09, Adding Expansions p.12) ─────────────────────────────────
  case 'Cultivator':
    return placeGreenery();
  case 'Magnate':
    // «Reveal cards from the project deck until a green card is revealed,
    // resolve it, and discard the rest.»
    return revealUntilAndResolve(game, (card) => card.type === CardType.AUTOMATED);
  case 'Space Baron': return advanceRole('space');
  case 'Excentric': {
    // «You (the player) must remove the highest-scoring animal/microbe cube
    // from a card in your tableau, if possible» — the same sentence B02
    // Invasive Species prints, so it is the same resolver. Nothing removable
    // ⇒ impossible to resolve (no 5 M€ changes hands).
    const attack = selectHighestScoringCubeAttack(game);
    if (attack.kind !== 'removable') {
      return false;
    }
    resolveCubeRemoval(game, attack, mapCorporateCompetition(game));
    return true;
  }
  case 'Contractor': return advanceRole('building');
  // ── Elysium (B10, the official card) ──────────────────────────
  case 'Celebrity':
    // «Reveal cards from the project deck until a card costing 20+ M€ is
    // revealed. Resolve it.» Magnate's shape with a different predicate — the
    // rejected cards are discarded by the deck's own search. 20 EXACTLY
    // qualifies, and an EVENT costing 20+ qualifies (the bot counts events for
    // this award, so its helper must be able to find one).
    return revealUntilAndResolve(game, (card) => card.cost >= 20);
  case 'Industrialist':
    // «Advance the power track.» The canonical ROLE, so it reaches the same
    // track the award scores (+5) on every map. A maxed track cannot advance
    // ⇒ impossible to resolve, exactly like B09's track helpers — never a
    // paid Failed Action.
    return advanceRole('power');
  case 'Desert Settler':
    // «MarsBot places a greenery tile IN THE SOUTHERN REGION and raises oxygen
    // 1 step.» A hard constraint on the legal set (the same four bottom rows
    // the award counts), not a tiebreaker: with no legal Southern space the
    // helper is impossible and the card tries the next funded award.
    return placeGreenery(Board.isSouthernRegion);
  case 'Estate Dealer':
    // «MarsBot places a greenery tile ADJACENT TO AN OCEAN and raises oxygen
    // 1 step.» The second hard constraint — no ocean-adjacent legal space
    // means impossible, never a plain greenery somewhere else.
    return placeGreenery((space) => game.board.getAdjacentSpaces(space).some(Board.isOceanSpace));
  case 'Benefactor':
    // «MarsBot raises its TR 2 steps.» A direct terraform-rating gain through
    // the authoritative mutation — no global parameter moves, no tile, no
    // placement bonus. Always possible, so it always costs the 5 M€.
    marsBotOf(game).increaseTerraformRating(2, {log: true});
    return true;
  // ── Utopia Planitia (B11, the official card) ─────────────────────
  // The fork's canonical name for the board's «Suburban» slot is Edgedancer —
  // the same award stands on the fan-made Vastitas Borealis (BF1), where this
  // helper serves it unchanged.
  case 'Edgedancer':
    // «MarsBot places a greenery tile ON THE EDGE OF THE BOARD and raises
    // oxygen 1 step.» A hard constraint on the legal set — the same edge
    // predicate the award counts and the placement tiebreaker rewards — so no
    // legal edge space means impossible, never a greenery somewhere inland.
    return placeGreenery((space) => game.board.isEdge(space));
  case 'Investor':
    // «Advance the Earth track.» On this board that row carries City + Earth;
    // addressed by ROLE, so it is the same track the award scores.
    return advanceRole('earth');
  case 'Botanist':
    // «Advance the plant track» — the bio row (Plant/Animal/Microbe).
    return advanceRole('bio');
  case 'Incorporator':
    // «Reveal cards from the project deck until a card with a cost of 10 M€ or
    // less is revealed, and resolve it.» Magnate's shape, cheap end: 10
    // EXACTLY qualifies, and an EVENT costing ≤10 qualifies (the bot counts
    // events for this award, so its helper must be able to find one).
    return revealUntilAndResolve(game, (card) => card.cost <= 10);
  case 'Metropolist':
    // «MarsBot places a city tile.» The ordinary city pipeline, tiebreakers
    // and all; no legal space ⇒ impossible, and the card tries the next award.
    return placeCity();
  // ── Terra Cimmeria (B12, the official card) ────────────────────────
  case 'Electrician':
    // «Advance the power track.» On this board that row carries ENERGY alone
    // (Jovian moved to Earth) — reached by canonical role, so the helper and
    // the award read the very same track.
    return advanceRole('power');
  case 'Founder': {
    // «MarsBot places a city tile adjacent to a special tile.» A HARD
    // constraint on the legal set, with the Neural Instance counted in (the
    // canonical classifier already says so) — the same predicate the placement
    // tiebreaker and the award use. No such legal city space ⇒ impossible, and
    // the card tries the next funded award rather than placing anywhere.
    const board = game.board;
    return AutomaTilePlacer.placeCity(game, {
      restrict: (space) => board.getAdjacentSpaces(space).some(isSpecialTileSpace),
      onEmpty: 'impossible',
    });
  }
  case 'Mogul': {
    // «Advance the most-advanced track.» Ties go to the TOPMOST track, which is
    // the map profile's own printed row order — `getMostAdvancedNonMaxedTrackIndex`
    // walks the board in exactly that order and keeps the first of equals, so
    // the choice is deterministic and never an enum or iteration accident.
    const index = automa.board.getMostAdvancedNonMaxedTrackIndex();
    if (index === undefined) {
      return false; // Every track is maxed — impossible to resolve.
    }
    AutomaResolver.advanceTrack(game, index);
    return true;
  }
  case 'A. Zoologist':
    // «Advance the animal track» — on this board Animal sits on the bio row,
    // so this is the ordinary tag-style advancement: landing action, chain,
    // events and review all included.
    return advanceRole('bio');
  case 'Forecaster':
    // «Reveal cards from the project deck until a card WITH REQUIREMENTS is
    // revealed. Resolve it, and MarsBot gains 5 MC.» The requirement is a
    // SEARCH criterion only — MarsBot never checks whether it could meet it.
    // Canonical card metadata answers it (`hasRequirement`), never text.
    // ⚠️ And this helper does NOT pay the card's 5 M€ — see `helperIsFree`.
    // The same award stands on the fan-made Vastitas Borealis (BF1): the same
    // helper, the same free option.
    if (!revealUntilAndResolve(game, (card) => hasRequirement(card))) {
      return false;
    }
    marsBotOf(game).stock.add(Resource.MEGACREDITS, 5, {log: true});
    return true;
  // ── Vastitas Borealis (B13, the official card + Adding Expansions p.12) ───
  case 'Traveller':
    // «Advance the Jovian track» — on this board Jovian rides the EARTH row
    // (Jovian + Earth), the very track the award scores (+5).
    return advanceRole('earth');
  case 'Landscaper':
    // «MarsBot places a greenery tile and raises oxygen 1 step.» Unconstrained.
    return placeGreenery();
  case 'Highlander': {
    // «…a greenery tile and raises oxygen 1 step, NOT ADJACENT TO AN OCEAN OR A
    // SPACE RESERVED FOR AN OCEAN. If MarsBot cannot legally place a greenery
    // tile on such a space, this action is impossible to resolve» (Adding
    // Expansions p.12 — fuller than the card's own line, and the rulebook
    // outranks the card). A hard constraint, like B10's: a reserved ocean
    // space counts whether or not its ocean is down yet, and an ocean tile on
    // a land space (a placed ocean anywhere) counts too.
    const board = game.board;
    return placeGreenery((space) => !board.getAdjacentSpaces(space).some((adj) =>
      adj.spaceType === SpaceType.OCEAN || Board.isOceanSpace(adj)));
  }
  case 'Promoter': return advanceRole('event');
  case 'Blacksmith': {
    // «Advance the building or space track, whichever is more advanced.» Among
    // the two that can still move; ties go to the TOPMOST (building) — the
    // printed row order, the convention Mogul's tie reads too. Both maxed ⇒
    // impossible to resolve.
    const alive = (['building', 'space'] as const)
      .map((role) => ({role, track: board.getTrackOfRole(role)}))
      .filter((e) => e.track?.canAdvance() === true);
    if (alive.length === 0) {
      return false;
    }
    alive.sort((a, b) => (b.track?.position ?? 0) - (a.track?.position ?? 0)); // Stable: Building first on ties.
    return advanceRole(alive[0].role);
  }
  // ── Vastitas Borealis, the fan map (BF1 — the fork's own card, §17.6) ────
  // HOME RULES, each the shape the §A law gives its award's type: a «track
  // space» award → «advance that track» (the B08…B13 precedents named below).
  case 'Visionary': {
    // The award reads the bot's LEAST-advanced track (doubled) — so the helper
    // lifts the floor: «advance its least-advanced track, the topmost if tied»
    // — the very action two official corporation cards print (B28
    // Diversification, B32 Investors). Every track maxed ⇒ the least-advanced
    // one cannot move ⇒ impossible to resolve.
    const index = board.getLeastAdvancedTrackIndex();
    if (!board.tracks[index].canAdvance()) {
      return false;
    }
    AutomaResolver.advanceTrack(game, index);
    return true;
  }
  case 'Naturalist': {
    // The award sums the plant track (bio) and the heat-badged track (earth):
    // Banker's shape — «advance whichever of the two is least advanced, the
    // topmost (earth) on ties». Both maxed ⇒ impossible.
    const alive = (['earth', 'bio'] as const)
      .map((role) => ({role, track: board.getTrackOfRole(role)}))
      .filter((e) => e.track?.canAdvance() === true);
    if (alive.length === 0) {
      return false;
    }
    alive.sort((a, b) => (a.track?.position ?? 0) - (b.track?.position ?? 0)); // Stable: earth first on ties.
    return advanceRole(alive[0].role);
  }
  case 'Voyager': {
    // «Advance the Jovian track» — Traveller's (B13) shape, addressed by the
    // TAG: the track the Jovian tag rides on this map (Jovian/Science here),
    // the very track the award reads (halved). A board with no Jovian track
    // cannot happen (every profile pairs it somewhere); maxed ⇒ impossible.
    const index = board.getTrackIndexForTag(Tag.JOVIAN);
    if (index === undefined || !board.tracks[index].canAdvance()) {
      return false;
    }
    AutomaResolver.advanceTrack(game, index);
    return true;
  }
  // ── Amazonis Planitia, the fan map (BF2 — the fork's own card, §18.6) ────
  // Promoter and A. Zoologist stand here under their official helpers above.
  case 'Curator': {
    // The award reads the bot's MOST-advanced track — so the helper is Mogul's
    // (B12): «advance the most-advanced track, the topmost one of the tied».
    const index = automa.board.getMostAdvancedNonMaxedTrackIndex();
    if (index === undefined) {
      return false;
    }
    AutomaResolver.advanceTrack(game, index);
    return true;
  }
  case 'A. Engineer':
    // The reveal-until family (Magnate / Celebrity / Incorporator / Forecaster):
    // «reveal cards from the project deck until a card that alters production,
    // resolve it, discard the rest» — the award's own predicate decides.
    return revealUntilAndResolve(game, (card) => AmazonisEngineer.altersProduction(card));
  case 'Tourist': {
    // The award counts the EMPTY areas beside the bot's tiles — so the helper
    // builds where nothing stands: «MarsBot places a city tile with every
    // adjacent space empty» — B07's own placement form (the Neural Instance:
    // «all neighbors empty») under Founder's city constraint. A hard
    // constraint on the legal set: no such space ⇒ impossible, and the card
    // tries the next funded award. A city, never a greenery — a greenery must
    // touch the bot's own tiles when it can, which is the opposite constraint.
    const board = game.board;
    return AutomaTilePlacer.placeCity(game, {
      restrict: (space) => board.getAdjacentSpaces(space).every((adj) => adj.tile === undefined),
      onEmpty: 'impossible',
    });
  }
  // ── The OLD (fan) Terra Cimmeria (BF3 — the fork's own card, §19.6) ──────
  // Incorporator stands here under its official helper above.
  case 'Biologist':
    // OFFICIAL (Adding Expansions p.16): «Biologist — Advance the [bio] track» — the row the award reads (+5).
    return advanceRole('bio');
  case 'T. Politician': {
    // HOME RULE (the owner's answer, 2026-11-03): the award counts the delegates a seat PLACED, so the helper places
    // one — through the bot's ONE political door (`castBotVote`: the lobby's free delegate first, then the reserve;
    // the chooser picks the card; a reserve delegate the stakes call pointless is KEPT). The official Politician
    // prints no helper («This award has no corresponding competition effect»), but its criterion is not one the bot
    // can push; this one is. No Parliament / no delegate / a kept one ⇒ impossible, and the card tries the next award.
    if (game.parliament === undefined) {
      return false;
    }
    return castBotVote(game, marsBotOf(game), 1).placed;
  }
  case 'Urbanist':
    // HOME RULE: the award counts the VP of greeneries beside the bot's own CITIES, so «MarsBot places a greenery
    // tile ADJACENT TO ONE OF ITS CITIES and raises oxygen 1 step» — Estate Dealer's hard constraint (B10) aimed at
    // the award's own geometry. No such legal space (no city yet, or every neighbour taken) ⇒ impossible.
    return placeGreenery((space) => game.board.getAdjacentSpaces(space).some((adj) => Board.isCitySpace(adj) && adj.player === marsBotOf(game)));
  case 'Warmonger':
    // HOME RULE, the reveal-until family (Magnate / Celebrity / Incorporator / A. Engineer): «reveal cards from the
    // project deck until a card that reduces other players' resources or production, resolve it» — the award's own
    // predicate (`Warmonger.include`) decides, so the two readings cannot drift.
    return revealUntilAndResolve(game, (card) => Warmonger.include(card));
  // ── Arabia Terra, the fan map (BF4 — the fork's own card, §21.6) ─────────
  // Botanist and Promoter stand here under their official helpers above.
  case 'Zoologist':
    // OFFICIAL (Adding Expansions p.16): «Zoologist — Advance the [bio] track» (B12's A. Zoologist helper).
    return advanceRole('bio');
  case 'A. Manufacturer':
    // HOME RULE — Magnate's helper for the other colour: «reveal cards from the project deck until a BLUE card is
    // revealed, resolve it, discard the rest».
    return revealUntilAndResolve(game, (card) => card.type === CardType.ACTIVE);
  case 'Cosmic Settler':
    // NO HELPER — the official Politician's line («This award has no corresponding competition effect to resolve»,
    // p.16): the only thing that raises the bot's reading is a card placing a city off Mars, and a reveal-until for
    // a handful of cards in the whole deck would burn it. Impossible ⇒ the card tries the next funded award.
    return false;
  // ── Venus Next: added to ALL versions of the card ─────────────────────────
  case 'Venuphile': return advanceRole('venus');
  default:
    return false;
  }
}

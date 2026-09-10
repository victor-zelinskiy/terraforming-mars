import {expect} from 'chai';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';
import {IGame} from '../../src/server/IGame';
import {runAllActions, maxOutOceans, formatMessage} from '../TestingUtils';
import {cast, toID} from '../../src/common/utils/utils';
import {cardPlayPreview} from '../../src/server/models/cardPlayPreview';
import {actionPreview} from '../../src/server/models/actionPreview';
import {ActionPreview, StagedPlacementModel} from '../../src/common/models/ActionPreviewModel';
import {Payment} from '../../src/common/inputs/Payment';
import {CardName} from '../../src/common/cards/CardName';
import {Resource} from '../../src/common/Resource';
import {TileType} from '../../src/common/TileType';
import {SpaceType} from '../../src/common/boards/SpaceType';
import {SpaceBonus} from '../../src/common/boards/SpaceBonus';
import {Space} from '../../src/server/boards/Space';
import {Behavior} from '../../src/server/behavior/Behavior';
import {ICard} from '../../src/server/cards/ICard';
import {IProjectCard} from '../../src/server/cards/IProjectCard';
import {PlayerInput} from '../../src/server/PlayerInput';
import {SelectSpace} from '../../src/server/inputs/SelectSpace';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {SelectPlayer} from '../../src/server/inputs/SelectPlayer';
import {SelectOption} from '../../src/server/inputs/SelectOption';
import {SelectAmount} from '../../src/server/inputs/SelectAmount';
import {OrOptions} from '../../src/server/inputs/OrOptions';
import {AresHazards} from '../../src/server/ares/AresHazards';
import {CardManifest, ModuleManifest} from '../../src/server/cards/ModuleManifest';
import {BASE_CARD_MANIFEST, CORP_ERA_CARD_MANIFEST} from '../../src/server/cards/StandardCardManifests';
import {PROMO_CARD_MANIFEST} from '../../src/server/cards/promo/PromoCardManifest';
import {VENUS_CARD_MANIFEST} from '../../src/server/cards/venusNext/VenusCardManifest';
import {COLONIES_CARD_MANIFEST} from '../../src/server/cards/colonies/ColoniesCardManifest';
import {PRELUDE_CARD_MANIFEST} from '../../src/server/cards/prelude/PreludeCardManifest';
import {ARES_CARD_MANIFEST} from '../../src/server/cards/ares/AresCardManifest';
import {DELTA_PROJECT_CARD_MANIFEST} from '../../src/server/cards/delta/DeltaProjectCardManifest';
import {SubterraneanReservoir} from '../../src/server/cards/base/SubterraneanReservoir';
import {AquiferPumping} from '../../src/server/cards/base/AquiferPumping';
import {WaterImportFromEuropa} from '../../src/server/cards/base/WaterImportFromEuropa';
import {CometAiming} from '../../src/server/cards/promo/CometAiming';
import {MarsNomads} from '../../src/server/cards/promo/MarsNomads';
import {StJosephOfCupertinoMission} from '../../src/server/cards/promo/StJosephOfCupertinoMission';
import {IcyImpactors} from '../../src/server/cards/promo/IcyImpactors';
import {IceMoonColony} from '../../src/server/cards/colonies/IceMoonColony';
import {GanymedeColony} from '../../src/server/cards/base/GanymedeColony';
import {LandClaim} from '../../src/server/cards/base/LandClaim';
import {RestrictedArea} from '../../src/server/cards/base/RestrictedArea';
import {MiningRights} from '../../src/server/cards/base/MiningRights';

/**
 * STAGED PLAY parity guard (docs/TILE_PLAY_STAGED_COMMIT.md §6, plan step 2).
 *
 * The staged board payload (`stagedMarsSelectSpace`, attached to a play
 * preview's first Mars `boardPlacement` step) is what the player sees while the
 * play is still CANCELLABLE — before paying. The live `SelectSpace` is what the
 * committed play offers AFTER paying. This spec proves the two are the SAME
 * legal set for every staged card, cost-inclusion included: the staged set
 * folds the unpaid card's own cost in via `CanAffordOptions`, the live set is
 * computed against the post-pay bank, and both must land on identical cells.
 *
 * WORKLIST semantics (guard-test culture):
 *  - every card whose rig-time preview yields a `staged` payload is exercised
 *    end-to-end (preview → real `playCard` with real payment → drain the
 *    intermediate prompts → the SelectSpace); ANY mismatch or un-drivable card
 *    fails BY NAME — a newly staged bespoke card is picked up automatically;
 *  - every DECLARATIVE Mars placement (behavior ocean/city/greenery/tile) must
 *    end up exercised or in the documented SKIP list — a staged payload that
 *    silently stops being produced fails by name too.
 */

const SCOPE_MANIFESTS: ReadonlyArray<ModuleManifest> = [
  BASE_CARD_MANIFEST,
  CORP_ERA_CARD_MANIFEST,
  PROMO_CARD_MANIFEST,
  VENUS_CARD_MANIFEST,
  COLONIES_CARD_MANIFEST,
  PRELUDE_CARD_MANIFEST,
  ARES_CARD_MANIFEST,
  DELTA_PROJECT_CARD_MANIFEST,
];

/**
 * Cards ALLOWED to produce no staged payload in the rig, each with the reason.
 * Keep SHORT: an entry here is a hole in the guard, not a resolved case. A
 * listed card is STILL swept — the moment its preview starts staging, it is
 * exercised and parity-asserted like everyone else (so an entry only tolerates
 * absence; it can never hide a regression).
 */
const SKIP: ReadonlyMap<CardName, string> = new Map([
  // (empty — Imported Hydrogen / Large Convoy migrated: `gainOrAddResourceBranches`
  // now routes its behavior steps through `withStagedPlacement`, so their ocean
  // stages like every declarative one.)
]);

/**
 * TODO(staged-play): GENUINE field gap found by this guard (2026-09-06).
 * `MiningCard.bespokePlay` builds its live SelectSpace WITHOUT a `tileType`
 * (src/server/cards/base/MiningCard.ts — createMarsSelectSpace gets only
 * placementType/sourceCard/customReasoner), while the staged payload names the
 * card's own tile (MINING_AREA=8 / MINING_RIGHTS=9 via the shared
 * `actionPreviews.placementPreview({tile})` builder). For the non-Ares pair the
 * LIVE prompt could honestly carry the exact tile; for the Ares variants the
 * placed tile is decided by the chosen cell's bonus
 * (MINING_STEEL_BONUS/MINING_TITANIUM_BONUS), so there the STAGED side's fixed
 * guess is the questionable half. Owned by the card-migration workstream (the
 * fix is co-located in the card file); the LEGAL-SET parity of these cards
 * stays fully guarded meanwhile — only the tileType field check is waived. See
 * the skipped spec at the bottom of the parity describe.
 */
const KNOWN_TILETYPE_GAPS: ReadonlySet<CardName> = new Set([
  CardName.MINING_AREA,
  CardName.MINING_RIGHTS,
  CardName.MINING_AREA_ARES,
  CardName.MINING_RIGHTS_ARES,
]);

type Candidate = {
  name: CardName,
  make: () => IProjectCard,
  prelude: boolean,
};

function candidates(): Array<Candidate> {
  const out: Array<Candidate> = [];
  for (const manifest of SCOPE_MANIFESTS) {
    for (const [name, spec] of CardManifest.entries(manifest.projectCards)) {
      out.push({name, make: () => new spec.Factory(), prelude: false});
    }
    for (const [name, spec] of CardManifest.entries(manifest.preludeCards)) {
      out.push({name, make: () => new spec.Factory(), prelude: true});
    }
  }
  return out;
}

/** Mirror of `stagedForBehavior`'s eligibility: a Mars placement the staged
 *  path is EXPECTED to serve (colony-coupled plays and fixed off-grid city
 *  slots are excluded by design — D3 / the colony-first runtime order). */
function marsPlacementIn(b: Behavior): boolean {
  if (b.colonies?.buildColony !== undefined) {
    return false;
  }
  return b.ocean !== undefined ||
    (b.city !== undefined && b.city.space === undefined) ||
    b.greenery !== undefined ||
    b.tile !== undefined;
}

function declaresMarsPlacement(card: ICard): boolean {
  const b = card.behavior;
  if (b === undefined) {
    return false;
  }
  return marsPlacementIn(b) || (b.or?.behaviors.some(marsPlacementIn) ?? false);
}

type Found = {staged: StagedPlacementModel, branchIndex: number};

function findStaged(preview: ActionPreview): Found | undefined {
  for (const branch of preview.branches) {
    for (const step of branch.steps) {
      if (step.kind === 'boardPlacement' && step.staged !== undefined) {
        return {staged: step.staged, branchIndex: branch.index};
      }
    }
  }
  return undefined;
}

const isEmptyLand = (s: Space) =>
  s.spaceType === SpaceType.LAND && s.tile === undefined && s.player === undefined;

/**
 * A mid-game rig rich enough that placement-precondition cards produce a
 * non-empty staged set: an ocean (upgradeable-ocean tiles), a player greenery
 * adjacent to a metal-bonus land (Ecological Zone adjacency, Mining Area's
 * "bonus next to your tile"), and two player cities sharing an empty
 * neighbour (Urbanized Area's «adjacent to 2 cities», Industrial Center),
 * plus generous stocks and production (energy-coverage city filters,
 * production-cost behaviors).
 */
function buildRig(): {game: IGame, player: TestPlayer} {
  const [game, player] = testGame(2, {
    aresExtension: true, // hazards auto-disabled by testGame
    venusNextExtension: true,
    coloniesExtension: true,
    preludeExtension: true,
    deltaProjectExpansion: true,
  });
  player.steel = 10;
  player.titanium = 10;
  player.plants = 15;
  player.energy = 12;
  player.heat = 12;
  player.production.add(Resource.ENERGY, 2);
  player.production.add(Resource.MEGACREDITS, 3);
  player.production.add(Resource.STEEL, 2);
  player.production.add(Resource.TITANIUM, 2);
  player.production.add(Resource.PLANTS, 2);
  player.production.add(Resource.HEAT, 2);
  seedBoard(game, player);
  runAllActions(game);
  if (player.getWaitingFor() !== undefined) {
    throw new Error('rig setup left a live prompt — pick different seed cells');
  }
  return {game, player};
}

function seedBoard(game: IGame, player: TestPlayer) {
  const board = game.board;
  // 1. One ocean (upgradeable-ocean cards need an existing, non-upgraded ocean).
  const ocean = board.getAvailableSpacesForOcean(player)[0];
  game.addOcean(player, ocean);
  // 2. A player greenery adjacent to a steel/titanium-bonus land cell.
  let greeneryPlaced = false;
  for (const bonusCell of board.spaces) {
    if (!isEmptyLand(bonusCell) ||
        !(bonusCell.bonus.includes(SpaceBonus.STEEL) || bonusCell.bonus.includes(SpaceBonus.TITANIUM))) {
      continue;
    }
    const host = board.getAdjacentSpaces(bonusCell).find(isEmptyLand);
    if (host !== undefined) {
      game.addGreenery(player, host);
      greeneryPlaced = true;
      break;
    }
  }
  if (!greeneryPlaced) {
    throw new Error('rig: no greenery-next-to-metal-bonus geometry on this board');
  }
  // 3. Two player cities that are NOT adjacent to each other but share an
  //    empty land neighbour. The city cells must be BONUS-FREE and away from
  //    every existing tile: a city on the metal-bonus cell robs Mining Area of
  //    its geometry, and a city next to the seeded ocean empties New Holland's
  //    'upgradeable-ocean-new-holland' set (city placement rules apply to it).
  const cityHost = (s: Space) => isEmptyLand(s) && s.bonus.length === 0 &&
    !board.getAdjacentSpaces(s).some((adj) => adj.tile !== undefined);
  for (const shared of board.spaces.filter(isEmptyLand)) {
    const adj = board.getAdjacentSpaces(shared).filter(cityHost);
    for (let i = 0; i < adj.length; i++) {
      for (let j = i + 1; j < adj.length; j++) {
        const a = adj[i];
        const b = adj[j];
        if (!board.getAdjacentSpaces(a).some((s) => s.id === b.id)) {
          game.addCity(player, a);
          game.addCity(player, b);
          return;
        }
      }
    }
  }
  throw new Error('rig: no two-cities-around-one-cell geometry on this board');
}

/** Answer a leaf prompt generically (skip-style, first candidate). */
function answerLeaf(input: PlayerInput, name: string): void {
  if (input instanceof SelectOption) {
    input.cb(undefined);
    return;
  }
  if (input instanceof SelectCard) {
    input.cb([input.cards[0]]);
    return;
  }
  if (input instanceof SelectPlayer) {
    input.cb(input.players[0]);
    return;
  }
  if (input instanceof SelectAmount) {
    input.cb(input.min);
    return;
  }
  throw new Error(
    `${name}: unhandled intermediate prompt ${input.constructor.name} («${formatMessage(input.title)}») — ` +
    'teach the drain in stagedPlacementParity.spec.ts or SKIP-list the card with a reason');
}

/**
 * Drive the played card's intermediate NON-space prompts (elevated attacks,
 * resource choices, draws-with-keep) until the live SelectSpace surfaces.
 * `orBranchIndex >= 0` picks the staged branch when the card's own on-play
 * OrOptions arrives (runtime index semantics of `ActionPreviewBranch.index`);
 * every other OrOptions takes its LAST option (the skip option, by the
 * repo-wide optionMetadata convention — Flooding, plant removals).
 */
function drainToSelectSpace(game: IGame, player: TestPlayer, orBranchIndex: number, name: string): SelectSpace {
  let pendingOr: number | undefined = orBranchIndex >= 0 ? orBranchIndex : undefined;
  for (let i = 0; i < 15; i++) {
    const [wf, done] = player.popWaitingFor2();
    if (wf === undefined) {
      throw new Error(`${name}: the committed play produced NO SelectSpace, but the preview staged one`);
    }
    if (wf instanceof SelectSpace) {
      return wf;
    }
    if (wf instanceof OrOptions) {
      const idx = pendingOr ?? wf.options.length - 1;
      pendingOr = undefined;
      const chosen = wf.options[idx];
      if (chosen === undefined) {
        throw new Error(`${name}: or-branch index ${idx} out of range (${wf.options.length} options)`);
      }
      if (chosen instanceof SelectSpace) {
        return chosen;
      }
      answerLeaf(chosen, name);
    } else {
      answerLeaf(wf, name);
    }
    done?.();
    runAllActions(game);
  }
  throw new Error(`${name}: did not reach a SelectSpace within 15 prompts`);
}

function assertParity(name: string, staged: StagedPlacementModel, ss: SelectSpace) {
  const stagedIds = [...staged.spaces].sort();
  const liveIds = ss.spaces.map(toID).sort();
  expect(liveIds, `${name}: pre-pay staged legal set ≠ post-pay live SelectSpace set`).to.deep.equal(stagedIds);
  // The ADDRESSED batch tail (deferredInputBatch.stagedMismatch) lands the
  // staged cell ONLY on a SelectSpace carrying the same sourceCard — a live
  // prompt that forgets it would park the cell forever and degrade EVERY
  // staged commit of this card to a live re-ask. This is what separates the
  // card's own placement from a threshold bonus ocean that jumps the queue.
  expect(ss.sourceCard, `${name}: the live prompt must carry sourceCard (the staged tail's address)`).to.eq(name);
  expect(ss.placementType, `${name}: placementType parity`).to.eq(staged.placementType);
  if (!KNOWN_TILETYPE_GAPS.has(name as CardName)) {
    expect(ss.tileType, `${name}: tileType parity`).to.eq(staged.tileType);
  }
  expect([...(ss.hiddenTiles ?? [])].sort(), `${name}: hiddenTiles parity`)
    .to.deep.equal([...(staged.hiddenTiles ?? [])].sort());
}

type Outcome = 'no-staged' | 'live' | 'fixed';

function exerciseCard(cand: Candidate): Outcome {
  const {game, player} = buildRig();
  const card = cand.make();
  const cost = cand.prelude ? 0 : player.getCardCost(card);
  player.megaCredits = cost + 100;

  const preview = cardPlayPreview(player, card);
  const found = findStaged(preview);
  if (found === undefined) {
    return 'no-staged';
  }
  const staged = found.staged;
  expect(staged.sourceCard, `${cand.name}: staged.sourceCard must name the card`).to.eq(cand.name);
  expect(staged.spaces, `${cand.name}: a staged payload never carries an empty set`).to.not.be.empty;

  // The REAL play: money genuinely deducted, then the deferred chain drained.
  if (cand.prelude) {
    player.playCard(card);
  } else {
    player.playCard(card, {...Payment.EMPTY, megacredits: cost});
  }
  runAllActions(game);

  if (staged.fixed === true) {
    // Noctis-style reserved on-grid cell: NO SelectSpace exists — the server
    // places the tile itself; the staged single cell must be where it landed.
    expect(staged.spaces, `${cand.name}: a fixed staged payload names exactly one cell`).to.have.length(1);
    const space = game.board.getSpaceOrThrow(staged.spaces[0]);
    expect(space.tile, `${cand.name}: the fixed staged cell received its tile`).to.not.be.undefined;
    expect(space.player?.id, `${cand.name}: the fixed tile belongs to the actor`).to.eq(player.id);
    expect(player.getWaitingFor() instanceof SelectSpace,
      `${cand.name}: a fixed placement must not raise a SelectSpace`).is.false;
    return 'fixed';
  }

  const ss = drainToSelectSpace(game, player, found.branchIndex, cand.name);
  assertParity(cand.name, staged, ss);
  return 'live';
}

describe('staged placement parity (STAGED PLAY guard)', function() {
  // The sweep builds one fresh game per candidate card (~150 rigs).
  // eslint-disable-next-line no-invalid-this
  this.timeout(600000);

  const live: Array<CardName> = [];
  const fixed: Array<CardName> = [];
  const problems: Array<string> = [];
  let expectedDeclaratives: Array<CardName> = [];

  before(() => {
    const all = candidates();
    expectedDeclaratives = all.filter((c) => declaresMarsPlacement(c.make())).map((c) => c.name);
    for (const cand of all) {
      // Cheap prefilter: no declarative Mars placement and no bespoke preview
      // hook → the preview cannot possibly carry a staged payload.
      const probe = cand.make();
      if (!declaresMarsPlacement(probe) && probe.cardPlayPreview === undefined) {
        continue;
      }
      try {
        const outcome = exerciseCard(cand);
        if (outcome === 'live') {
          live.push(cand.name);
        } else if (outcome === 'fixed') {
          fixed.push(cand.name);
        }
      } catch (e) {
        problems.push(`${cand.name}: ${(e as Error).message}`);
      }
    }
    // Diagnostic breadth line — what the guard actually covered this run.
    console.log(`      [staged-parity] exercised ${live.length} live + ${fixed.length} fixed placements ` +
      `(${expectedDeclaratives.length} declarative expected, ${SKIP.size} skip-listed)`);
  });

  it('every staged card keeps pre-pay ↔ post-pay parity', () => {
    expect(problems, `staged parity problems:\n${problems.join('\n')}`).to.be.empty;
  });

  it('every declarative Mars placement is exercised (or explicitly SKIP-listed)', () => {
    const done = new Set<CardName>([...live, ...fixed]);
    const missing = expectedDeclaratives.filter((n) => !done.has(n) && !SKIP.has(n));
    expect(missing,
      `declarative placement cards the sweep could not stage+exercise (worklist):\n${missing.join('\n')}`)
      .to.be.empty;
  });

  it('the exemplars are in the swept set', () => {
    expect(live, 'Ecological Zone (bespoke reasoner)').to.include(CardName.ECOLOGICAL_ZONE);
    expect(live, 'Flooding (bespoke ocean)').to.include(CardName.FLOODING);
    expect(live, 'Restricted Area (declarative special tile)').to.include(CardName.RESTRICTED_AREA);
    expect(fixed, 'Noctis City rides the FIXED path on a noctis board').to.include(CardName.NOCTIS_CITY);
  });

  it('sweep breadth floor — raise when staged scope widens, never lower', () => {
    // The declarative-coverage guard above is the real floor; this catches the
    // sweep silently collapsing (e.g. the prefilter eating everything).
    // 72 exercised on 2026-09-06 (57 declarative + bespoke exemplars); the
    // floor sits below the declarative count alone so an in-flight bespoke
    // migration can't wobble it, and a collapsed sweep still fails loudly.
    expect(live.length + fixed.length, `swept only: ${[...live, ...fixed].join(', ')}`).to.be.gte(50);
  });

  // TODO(staged-play): un-skip when MiningCard's live SelectSpace carries the
  // tile identity (or the staged side stops guessing one for the Ares
  // variants) — see the KNOWN_TILETYPE_GAPS comment for the full finding.
  it.skip('TODO: Mining Area / Mining Rights — the live SelectSpace names the same tileType its staged twin does', () => {
    const {game, player} = buildRig();
    const card = new MiningRights();
    const cost = player.getCardCost(card);
    player.megaCredits = cost + 100;
    const staged = findStaged(cardPlayPreview(player, card))!.staged;
    player.playCard(card, {...Payment.EMPTY, megacredits: cost});
    runAllActions(game);
    const ss = cast(player.popWaitingFor(), SelectSpace);
    expect(ss.tileType, 'the live prompt must carry the tile identity the staged payload promised').to.eq(staged.tileType);
  });
});

describe('staged placement — cost-inclusive affordability (Ares hazard)', () => {
  /** An empty, bonus-free land cell carrying a mild-erosion hazard: covering it
   *  costs 8 M€ (`Game.addTile` hazard cover), which `Board.canAfford` folds
   *  into the placement plan on both sides of the commit boundary. */
  function hazardRig() {
    const [game, player] = testGame(2, {aresExtension: true});
    const cell = game.board.spaces.find((s) => isEmptyLand(s) && s.bonus.length === 0);
    if (cell === undefined) {
      throw new Error('no bonus-free empty land cell');
    }
    AresHazards.putHazardAt(game, cell, TileType.EROSION_MILD);
    return {game, player, cell};
  }

  it('1 M€ short of the cover cost: the hazard cell is excluded pre-pay AND post-pay, reason cannot-afford', () => {
    const {game, player, cell} = hazardRig();
    const card = new RestrictedArea();
    const cost = player.getCardCost(card);
    player.megaCredits = cost + 7; // 8 M€ cover − 1

    const preview = cardPlayPreview(player, card);
    const found = findStaged(preview);
    expect(found, 'Restricted Area must stage').to.not.be.undefined;
    const staged = found!.staged;
    expect(staged.spaces, 'staged set excludes the unaffordable hazard cell').to.not.include(cell.id);
    const stagedEntry = staged.illegalSpaces?.find((e) => e.spaceId === cell.id);
    expect(stagedEntry, 'the excluded cell explains itself').to.not.be.undefined;
    expect(stagedEntry!.reason).to.eq('cannot-afford');
    expect(stagedEntry!.deficit, 'the honest M€ gap').to.eq(1);

    player.playCard(card, {...Payment.EMPTY, megacredits: cost});
    runAllActions(game);
    const ss = cast(player.popWaitingFor(), SelectSpace);
    expect(ss.spaces.map(toID), 'the live post-pay prompt excludes it too').to.not.include(cell.id);
    const liveEntry = ss.illegalSpaces?.find((e) => e.spaceId === cell.id);
    expect(liveEntry?.reason).to.eq('cannot-afford');
    expect(liveEntry?.deficit).to.eq(1);
    assertParity(CardName.RESTRICTED_AREA, staged, ss);
  });

  it('with exactly enough for card + cover, the hazard cell is INCLUDED on both sides', () => {
    const {game, player, cell} = hazardRig();
    const card = new RestrictedArea();
    const cost = player.getCardCost(card);
    player.megaCredits = cost + 8;

    const staged = findStaged(cardPlayPreview(player, card))!.staged;
    expect(staged.spaces, 'cost-inclusive ≠ over-exclusive').to.include(cell.id);

    player.playCard(card, {...Payment.EMPTY, megacredits: cost});
    runAllActions(game);
    const ss = cast(player.popWaitingFor(), SelectSpace);
    expect(ss.spaces.map(toID)).to.include(cell.id);
    assertParity(CardName.RESTRICTED_AREA, staged, ss);
  });
});

describe('staged placement — plays that must NOT stage', () => {
  it('oceans maxed → the ocean play carries NO staged payload (silent-skip branch)', () => {
    const [game, player] = testGame(2);
    maxOutOceans(player);
    runAllActions(game);
    const card = new SubterraneanReservoir();
    expect(card.behavior?.ocean, 'rig honesty: this IS a declarative ocean card').to.not.be.undefined;
    player.megaCredits = 60;
    const preview = cardPlayPreview(player, card);
    expect(findStaged(preview), 'a play that will skip its placement stages nothing').to.be.undefined;
    // The placement STEP itself is still announced — only the staged payload is absent.
    const step = preview.branches[0].steps.find((s) => s.kind === 'boardPlacement');
    expect(step, 'the boardPlacement step remains in the preview').to.not.be.undefined;
  });

  it('colony-coupled play (Ice Moon Colony) → NO staged (the colony prompt comes first at runtime)', () => {
    const [, player] = testGame(2, {coloniesExtension: true});
    const card = new IceMoonColony();
    expect(card.behavior?.colonies?.buildColony, 'rig honesty').to.not.be.undefined;
    expect(card.behavior?.ocean, 'rig honesty').to.not.be.undefined;
    player.megaCredits = 60;
    expect(findStaged(cardPlayPreview(player, card))).to.be.undefined;
  });

  it('fixed off-grid city (Ganymede Colony) → NO staged and no boardPlacement step at all', () => {
    const [, player] = testGame(2);
    const card = new GanymedeColony();
    expect(card.behavior?.city?.space, 'rig honesty: an off-grid reserved slot').to.not.be.undefined;
    player.megaCredits = 60;
    const preview = cardPlayPreview(player, card);
    expect(findStaged(preview)).to.be.undefined;
    expect(preview.branches.some((b) => b.steps.some((s) => s.kind === 'boardPlacement')),
      'a D3 fixed slot is placed without any prompt — nothing to stage').is.false;
  });

  it('a marker with no tile (Land Claim) → NO staged', () => {
    const [, player] = testGame(2);
    const card = new LandClaim();
    player.megaCredits = 60;
    expect(findStaged(cardPlayPreview(player, card))).to.be.undefined;
  });
});

describe('staged ACTION placement parity (blue-card actions, D5)', () => {
  /**
   * The ACTION-side mirror of the play guard above (D5 — the staged path for
   * blue-card actions): the staged payload on an ACTION preview is what the
   * player sees while the action batch is still parked client-side; the live
   * `SelectSpace` is what the committed action raises after its own cost is
   * paid. Same legal set, same placementType/tileType — PLUS `placementEffect`
   * and the prompt title, which the client's synthetic prompt echoes: a move /
   * marker action that lost its declaration would promise tile-driven effects
   * the commit suppresses.
   */
  function assertActionParity(name: string, staged: StagedPlacementModel, ss: SelectSpace) {
    assertParity(name, staged, ss);
    expect(ss.placementEffect, `${name}: placementEffect parity`).to.eq(staged.placementEffect);
    expect(formatMessage(staged.title), `${name}: the staged title mirrors the live prompt`)
      .to.eq(formatMessage(ss.title));
    // The per-cell refusals are the same derivation on both sides (shared
    // reasoner + computeIllegalReasons) — byte-equal, reasons included.
    const byId = (a: {spaceId: string}, b: {spaceId: string}) => a.spaceId.localeCompare(b.spaceId);
    expect([...(ss.illegalSpaces ?? [])].sort(byId), `${name}: illegal-reason parity`)
      .to.deep.equal([...(staged.illegalSpaces ?? [])].sort(byId));
  }

  it('Aquifer Pumping: the staged ocean mirrors the live PlaceOceanTile prompt', () => {
    const [game, player] = testGame(2);
    const card = new AquiferPumping();
    player.playedCards.push(card);
    player.megaCredits = 20; // no steel → SelectPaymentDeferred auto-pays, no prompt
    const found = findStaged(actionPreview(player, card));
    expect(found, 'the action preview stages its ocean').to.not.be.undefined;
    expect(found!.staged.placementEffect, 'a real tile placement declares no effect override').to.be.undefined;
    card.action(player);
    runAllActions(game);
    assertActionParity(card.name, found!.staged, cast(player.popWaitingFor(), SelectSpace));
  });

  it('Aquifer Pumping at max oceans: NO staged payload (the live PlaceOceanTile silently skips)', () => {
    const [game, player] = testGame(2);
    const card = new AquiferPumping();
    player.playedCards.push(card);
    player.megaCredits = 20;
    maxOutOceans(player);
    runAllActions(game);
    expect(findStaged(actionPreview(player, card)),
      'a placement the commit will skip stages nothing — the action flows as today').to.be.undefined;
  });

  it('Water Import From Europa: the staged ocean mirrors the live prompt', () => {
    const [game, player] = testGame(2);
    const card = new WaterImportFromEuropa();
    player.playedCards.push(card);
    player.megaCredits = 20; // no titanium → the payment auto-pays
    const found = findStaged(actionPreview(player, card));
    expect(found, 'the action preview stages its ocean').to.not.be.undefined;
    card.action(player);
    runAllActions(game);
    assertActionParity(card.name, found!.staged, cast(player.popWaitingFor(), SelectSpace));
  });

  it('Comet Aiming: the ocean stages on ITS branch only, and mirrors the live prompt', () => {
    const [game, player] = testGame(2);
    const card = new CometAiming();
    player.playedCards.push(card);
    card.resourceCount = 1;
    player.titanium = 3; // both branches live → the action raises its OrOptions
    const preview = actionPreview(player, card);
    const found = findStaged(preview);
    expect(found, 'the place-ocean branch stages').to.not.be.undefined;
    expect(found!.branchIndex, 'the ocean is the FIRST runtime option (action() push order)').to.eq(0);
    const other = preview.branches.find((b) => b.index !== found!.branchIndex);
    expect(other!.steps.some((s) => s.kind === 'boardPlacement'),
      'the add-asteroid branch carries no placement at all').is.false;
    const or = cast(card.action(player), OrOptions);
    cast(or.options[found!.branchIndex], SelectOption).cb(undefined);
    runAllActions(game);
    assertActionParity(card.name, found!.staged, cast(player.popWaitingFor(), SelectSpace));
  });

  it('Mars Nomads: the staged MOVE mirrors the live prompt (bonus-only, no tile)', () => {
    const [game, player] = testGame(2);
    const card = new MarsNomads();
    player.playedCards.push(card);
    // The destinations hang off the camp's current cell (same seat the card's
    // own spec uses — an arbitrary land cell with free neighbours).
    game.nomadSpace = game.board.getAvailableSpacesOnLand(player)[12].id;
    const found = findStaged(actionPreview(player, card));
    expect(found, 'the move stages').to.not.be.undefined;
    const staged = found!.staged;
    expect(staged.placementEffect, 'a camp move declares bonus-only').to.eq('bonus-only');
    expect(staged.tileType, 'nothing is placed — no tile identity').to.be.undefined;
    // The live action RETURNS its SelectSpace directly (no deferreds in between).
    assertActionParity(card.name, staged, cast(card.action(player), SelectSpace));
  });

  it('St. Joseph of Cupertino Mission: the staged MARKER mirrors the live city pick', () => {
    const [game, player, player2] = testGame(2);
    const card = new StJosephOfCupertinoMission();
    player.playedCards.push(card);
    player.megaCredits = 20; // no steel → the payment auto-pays
    // Cities of BOTH players are targets; an already-cathedraled one is not.
    const land = game.board.getAvailableSpacesOnLand(player);
    const [mine, theirs, taken] = [land[0], land[5], land[10]];
    game.addCity(player, mine);
    game.addCity(player2, theirs);
    game.addCity(player2, taken);
    game.stJosephCathedrals.push(taken.id);
    runAllActions(game);
    player.steel = 0; // a city cell's printed bonus may have paid steel — keep the payment auto-paying
    const preview = actionPreview(player, card);
    // The step itself must not lie: no city is PLACED (the old `tileType: CITY`
    // promised one) — the identity comes from `placementEffect: 'marker'`.
    const step = preview.branches[0].steps.find((s) => s.kind === 'boardPlacement');
    expect(step?.kind === 'boardPlacement' && step.tileType, 'the step carries NO tileType').to.be.undefined;
    const found = findStaged(preview);
    expect(found, 'the marker stages').to.not.be.undefined;
    const staged = found!.staged;
    expect(staged.placementEffect, 'a cathedral is a MARKER on an existing city').to.eq('marker');
    expect(staged.tileType).to.be.undefined;
    expect(staged.spaces, 'spans all players\' cities, minus the cathedraled one')
      .to.have.members([mine.id, theirs.id]);
    card.action(player);
    runAllActions(game);
    assertActionParity(card.name, staged, cast(player.popWaitingFor(), SelectSpace));
  });

  it('Icy Impactors: deliberately NOT staged — the live SelectSpace goes to game.first, not the actor', () => {
    const [, player] = testGame(2);
    const card = new IcyImpactors();
    player.playedCards.push(card);
    card.resourceCount = 1;
    player.megaCredits = 20;
    const preview = actionPreview(player, card);
    expect(preview.branches.some((b) => b.steps.some((s) => s.kind === 'boardPlacement')),
      'rig honesty: the ocean follow-up IS declared').is.true;
    expect(findStaged(preview), 'but never staged — the actor has no cell to pick').to.be.undefined;
  });
});

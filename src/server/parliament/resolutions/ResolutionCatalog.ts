/*
 * THE RESOLUTION CATALOG — every resolution this build knows, by stable id.
 *
 * The deck is made of REAL resolutions only (each in its own file under the
 * party's directory — `greens/AquiferContest.ts` is the template). Beside them
 * the catalog keeps a few NEVER-DEALT (`copies: 0`) test / development
 * resolutions: engine fixtures for the mechanisms no real card covers yet (a
 * passive, a resolution action, a resumable multi-step ask). Adding a real
 * resolution is adding a definition here — the deck, the vote, the enactment,
 * the face and the client catalog all read this table.
 *
 * Ids are permanent. A save that names an id this table no longer has fails
 * to load explicitly (`Parliament.deserialize`) — except the RETIRED ids
 * below, which a load strips instead.
 */
import {CardRenderer} from '../../cards/render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {PartyName} from '../../../common/turmoil/PartyName';
import {Resource} from '../../../common/Resource';
import {Tag} from '../../../common/cards/Tag';
import {CardResource} from '../../../common/CardResource';
import {
  isResolutionCode, ResolutionCode, ResolutionId, resolutionInstanceId, ResolutionInstanceId, resolutionIdOf,
} from '../../../common/parliament/ParliamentTypes';
import {EnactContext, EnactStep, ResolutionDefinition} from './IResolution';
import {ExternalDrawIntake} from '../../deferredActions/ExternalDrawIntake';
import {PlayerInput} from '../../PlayerInput';
import {SelectOption} from '../../inputs/SelectOption';
import {SpaceType} from '../../../common/boards/SpaceType';
import {Board} from '../../boards/Board';
import {OrOptions} from '../../inputs/OrOptions';
import {AQUIFER_CONTEST} from './greens/AquiferContest';
import {ARCHITECTURE_AWARD} from './marsFirst/ArchitectureAward';
import {BIODOME_CONTEST} from './greens/BiodomeContest';
import {CENTRAL_POWER_GRID} from './industrialists/CentralPowerGrid';
import {CLIMATE_RESEARCH} from './greens/ClimateResearch';
import {CLOUD_DEVELOPMENT} from './unity/CloudDevelopment';
import {COLONIAL_AFFAIRS} from './unity/ColonialAffairs';
import {COLONIZATION_FUNDING} from './unity/ColonizationFunding';
import {COLONY_CONTEST} from './unity/ColonyContest';
import {DEVELOPMENT_CRAZE} from './marsFirst/DevelopmentCraze';
import {FORESTRY_SUPPORT} from './greens/ForestrySupport';
import {GAS_EXPORT} from './reds/GasExport';
import {GENEROUS_FUNDING} from './greens/GenerousFunding';
import {HEAT_CAPTURE} from './reds/HeatCapture';
import {INDUSTRIALIST_BUDGET} from './industrialists/IndustrialistBudget';
import {JOINT_RESEARCH} from './scientists/JointResearch';
import {JOVIAN_TAX_RIGHTS} from './unity/JovianTaxRights';
import {MEDICAL_DATABASE} from './scientists/MedicalDatabase';
import {METAL_RESEARCH} from './industrialists/MetalResearch';
import {MIGRATION_FUNDING} from './marsFirst/MigrationFunding';
import {MINING_INCENTIVES} from './industrialists/MiningIncentives';
import {MOHOLE_CONTEST} from './greens/MoholeContest';
import {SKYSCRAPERS} from './marsFirst/Skyscrapers';

/**
 * THE RETIRED IDS — iteration 0's DUMMY resolutions (a party, a quest, no
 * effect of their own), removed once real resolutions carried the deck. They
 * are no longer catalogued, dealt or drawn anywhere; this list exists only so
 * an OLDER save that still carries one loads with it STRIPPED (the deck, the
 * discard, the voting area, the enacted slot, the last phase's recap — see
 * `Parliament.deserialize`) instead of failing. Never re-point one of these
 * ids at a real card: an old save would wake up with an effect it never had.
 */
export const RETIRED_RESOLUTION_IDS: ReadonlySet<ResolutionId> = new Set([
  'RDX_DUMMY_UNITY_1', 'RDX_DUMMY_UNITY_2',
  'RDX_DUMMY_GREENS_1', 'RDX_DUMMY_GREENS_2',
  'RDX_DUMMY_SCIENTISTS_1', 'RDX_DUMMY_SCIENTISTS_2',
  'RDX_DUMMY_MARS_1', 'RDX_DUMMY_MARS_2',
  'RDX_DUMMY_INDUSTRIALISTS_1', 'RDX_DUMMY_INDUSTRIALISTS_2',
  'RDX_DUMMY_REDS_1', 'RDX_DUMMY_REDS_2',
]);

/**
 * THE RESUMABLE-EFFECT PROOF (never in a real deck: `copies: 0`). Four steps:
 * mutate → ask → mutate → ask. `tests/parliament/ParliamentPhase.spec.ts`
 * reloads the game inside the second ask and asserts that no reward is paid
 * twice, none is lost, and the first answer is remembered.
 */
export const TEST_CHOICE_RESOLUTION_ID: ResolutionId = 'RDX_TEST_CHOICE';

/** A supply grant that REPORTS itself (the author's contract: every step records what it did). */
function grantStock(ctx: EnactContext, resource: Resource, amount: number, from: {resolution: ResolutionId}): void {
  const before = ctx.player.stock.get(resource);
  ctx.player.stock.add(resource, amount, {log: true, from});
  ctx.report({kind: 'stock', stock: resource, amount, before, after: ctx.player.stock.get(resource)});
}

const TEST_CHOICE_STEPS: ReadonlyArray<EnactStep> = [
  {
    key: 'grant-mc',
    run: (ctx) => {
      grantStock(ctx, Resource.MEGACREDITS, 1, {resolution: ctx.parliament.resolutionOf(ctx.parliament.enactedInstanceOrThrow()).id});
      return undefined;
    },
  },
  {
    key: 'choose-plant-or-heat',
    run: (ctx) => {
      const from = {resolution: TEST_CHOICE_RESOLUTION_ID};
      return new OrOptions(
        new SelectOption('Gain 1 plant', 'Plant').andThen(() => {
          grantStock(ctx, Resource.PLANTS, 1, from);
          ctx.state.firstChoice = 'plant';
          return undefined;
        }),
        new SelectOption('Gain 1 heat', 'Heat').andThen(() => {
          grantStock(ctx, Resource.HEAT, 1, from);
          ctx.state.firstChoice = 'heat';
          return undefined;
        }),
      ).setTitle('Test resolution: choose a resource')
        .markChoiceContext({source: {kind: 'resolution', resolution: TEST_CHOICE_RESOLUTION_ID}, trigger: 'The enacted resolution asks you to choose', mode: 'effect-choice'});
    },
  },
  {
    key: 'grant-steel',
    run: (ctx) => {
      grantStock(ctx, Resource.STEEL, 1, {resolution: TEST_CHOICE_RESOLUTION_ID});
      return undefined;
    },
  },
  {
    key: 'choose-card-or-mc',
    run: (ctx) => {
      const from = {resolution: TEST_CHOICE_RESOLUTION_ID};
      return new OrOptions(
        new SelectOption('Draw 1 card', 'Draw').andThen(() => {
          // Straight into the hand (a test resolution): the record says so — no intake, nothing owed.
          ctx.player.drawCard(1);
          ctx.report({kind: 'cards', amount: 1, drawn: 1});
          ctx.state.secondChoice = 'card';
          return undefined;
        }),
        new SelectOption('Gain 2 M€', 'Gain').andThen(() => {
          grantStock(ctx, Resource.MEGACREDITS, 2, from);
          ctx.state.secondChoice = 'mc';
          return undefined;
        }),
      ).setTitle('Test resolution: choose a reward')
        .markChoiceContext({source: {kind: 'resolution', resolution: TEST_CHOICE_RESOLUTION_ID}, trigger: 'The enacted resolution asks you to choose', mode: 'effect-choice'});
    },
  },
];

/** The state key a dev draw step keeps its intake under — the proof it already drew (the Climate Research pattern). */
const DEV_INTAKE_KEY = 'drawIntake';

/**
 * A DRAW that REPORTS itself and survives a reload inside the take (the
 * shared intake: the cards leave the deck once, the take is re-derived from
 * the intake). `owed` 0 asks nothing and records the skip with `reason`.
 */
function drawStep(ctx: EnactContext, resolution: ResolutionId, owed: number, skipReason: string): PlayerInput | undefined {
  const remembered = ctx.state[DEV_INTAKE_KEY];
  if (typeof remembered === 'number') {
    const pending = ExternalDrawIntake.pendingOf(ctx.player, remembered);
    return pending === undefined ? undefined : ExternalDrawIntake.takePromptFor(ctx.player, pending);
  }
  if (owed <= 0) {
    ctx.report({kind: 'skipped', amount: 0, reason: skipReason});
    return undefined;
  }
  const intake = ExternalDrawIntake.open(ctx.player, owed, {kind: 'resolution', resolution, effect: 'draw'});
  if (intake === undefined) {
    ctx.report({kind: 'skipped', amount: owed, drawn: 0, reason: 'The project deck is empty'});
    return undefined;
  }
  ctx.state[DEV_INTAKE_KEY] = intake.id;
  ctx.report({kind: 'cards', amount: owed, drawn: intake.count, intake: intake.id});
  return ExternalDrawIntake.takePromptFor(ctx.player, intake);
}

const TEST_CHOICE: ResolutionDefinition = {
  id: TEST_CHOICE_RESOLUTION_ID,
  module: 'turmoilRedux',
  party: PartyName.SCIENTISTS,
  copies: 0,
  renderData: CardRenderer.builder((b) => {
    b.text('Test: two choices', Size.SMALL, true);
  }),
  text: {name: 'Test Resolution', effect: 'Test resolution: two sequential choices with rewards in between.', quest: 'Add 1 microbe to a card'},
  quest: {goal: {kind: 'cardResource', resource: CardResource.MICROBE}, count: 1},
  immediateSteps: TEST_CHOICE_STEPS,
};

export class ResolutionCatalog {
  private readonly byId = new Map<ResolutionId, ResolutionDefinition>();
  private readonly byCode = new Map<ResolutionCode, ResolutionDefinition>();

  constructor(definitions: ReadonlyArray<ResolutionDefinition>) {
    for (const definition of definitions) {
      if (this.byId.has(definition.id)) {
        throw new Error(`Duplicate resolution id ${definition.id}`);
      }
      const code = definition.code;
      if (code !== undefined) {
        if (!isResolutionCode(code)) {
          throw new Error(`Resolution ${definition.id} has a malformed code ${code} (expected RX##)`);
        }
        if (this.byCode.has(code)) {
          throw new Error(`Duplicate resolution code ${code} (${this.byCode.get(code)?.id} and ${definition.id})`);
        }
        this.byCode.set(code, definition);
      }
      this.byId.set(definition.id, definition);
    }
  }

  public get(id: ResolutionId): ResolutionDefinition | undefined {
    return this.byId.get(id);
  }

  /** The resolution wearing a printed code — the search / debug entry (`RX01`). */
  public byPrintedCode(code: ResolutionCode): ResolutionDefinition | undefined {
    return this.byCode.get(code);
  }

  public getOrThrow(id: ResolutionId): ResolutionDefinition {
    const definition = this.byId.get(id);
    if (definition === undefined) {
      throw new Error(`Unknown resolution ${id}`);
    }
    return definition;
  }

  public ofInstance(instance: ResolutionInstanceId): ResolutionDefinition {
    return this.getOrThrow(resolutionIdOf(instance));
  }

  public all(): ReadonlyArray<ResolutionDefinition> {
    return Array.from(this.byId.values());
  }

  /** Every physical card the deck starts with (copies > 0, compatible with the game). */
  public dealtInstances(isCompatible: (definition: ResolutionDefinition) => boolean): Array<ResolutionInstanceId> {
    const out: Array<ResolutionInstanceId> = [];
    for (const definition of this.byId.values()) {
      if (definition.copies <= 0 || !isCompatible(definition)) {
        continue;
      }
      for (let copy = 0; copy < definition.copies; copy++) {
        out.push(resolutionInstanceId(definition.id, copy));
      }
    }
    return out;
  }
}

/**
 * THE TEMPLATE'S DEVELOPMENT EXAMPLES (never dealt: `copies: 0`). One
 * IMMEDIATE effect, one PASSIVE and one ACTION, built from the existing
 * primitives. They were how the face, the inspector and the workspace were
 * proven before the real catalog existed; today the action is still the ONLY
 * card that exercises that mechanism, until a real resolution does — the
 * passive seam is walked by a real card (Development Craze, RX10).
 */
export const DEV_IMMEDIATE_RESOLUTION_ID: ResolutionId = 'RDX_DEV_IMMEDIATE';
export const DEV_PASSIVE_RESOLUTION_ID: ResolutionId = 'RDX_DEV_PASSIVE';
export const DEV_ACTION_RESOLUTION_ID: ResolutionId = 'RDX_DEV_ACTION';

const DEV_IMMEDIATE: ResolutionDefinition = {
  id: DEV_IMMEDIATE_RESOLUTION_ID,
  module: 'turmoilRedux',
  party: PartyName.GREENS,
  copies: 0,
  renderData: CardRenderer.builder((b) => {
    b.megacredits(3).nbsp.plants(1).asterix();
  }),
  text: {
    name: 'Reforestation Fund',
    // The timing is the inspector's block label («При принятии»), never a
    // prefix of the sentence — the label and the text must not say it twice.
    effect: 'Gain 3 M€ and 1 plant.',
    quest: 'Raise your plant production 2 steps',
  },
  quest: {goal: {kind: 'production', resource: Resource.PLANTS}, count: 2},
  // ONE record per step: two grants are two steps (the contract — a step reports exactly once).
  immediateSteps: [
    {
      key: 'grant-mc',
      run: (ctx) => {
        grantStock(ctx, Resource.MEGACREDITS, 3, {resolution: DEV_IMMEDIATE_RESOLUTION_ID});
        return undefined;
      },
    },
    {
      key: 'grant-plants',
      run: (ctx) => {
        grantStock(ctx, Resource.PLANTS, 1, {resolution: DEV_IMMEDIATE_RESOLUTION_ID});
        return undefined;
      },
    },
  ],
};

const DEV_PASSIVE: ResolutionDefinition = {
  id: DEV_PASSIVE_RESOLUTION_ID,
  module: 'turmoilRedux',
  party: PartyName.MARS,
  copies: 0,
  renderData: CardRenderer.builder((b) => {
    b.effect(undefined, (eb) => eb.city({size: Size.SMALL}).asterix().startEffect.megacredits(2));
  }),
  text: {
    name: 'Urban Charter',
    passive: 'Effect: whenever you place a city tile on Mars, gain 2 M€.',
    quest: 'Place 1 city tile on Mars',
  },
  quest: {goal: {kind: 'tile', tile: 'city'}, count: 1},
  passive: {
    onTilePlaced(player, space) {
      if (space.spaceType === SpaceType.COLONY || !Board.isCitySpace(space)) {
        return;
      }
      player.stock.add(Resource.MEGACREDITS, 2, {log: true, from: {resolution: DEV_PASSIVE_RESOLUTION_ID}});
    },
    placementFacts(ctx) {
      // `firesTilePassive`, never `grantsPlacementBonus`: the live hook pays for a COVERING city too (RX11's law).
      return ctx.onMars && ctx.firesTilePassive && ctx.countsAsCity ?
        [ctx.gain('urban-charter', {icon: 'megacredits', amount: 2, direction: 'gain'}, 'Enacted resolution: 2 M€ for a city you place on Mars')] :
        [];
    },
    forecast(ctx) {
      const cities = ctx.tiles.filter((tile) => !tile.offMars && tile.countsAsCity).reduce((sum, tile) => sum + tile.count, 0);
      if (cities === 0) {
        return [];
      }
      return [ctx.deferred(ctx.source('tile-placed'), [ctx.stockGain(Resource.MEGACREDITS, 2 * cities)],
        'Urban Charter pays 2 M€ per city you place on Mars', {id: 'urban-charter'})];
    },
  },
};

const DEV_ACTION: ResolutionDefinition = {
  id: DEV_ACTION_RESOLUTION_ID,
  module: 'turmoilRedux',
  party: PartyName.INDUSTRIALISTS,
  copies: 0,
  renderData: CardRenderer.builder((b) => {
    b.action(undefined, (ab) => ab.megacredits(2).startAction.heat(1));
  }),
  text: {
    name: 'Foundry Subsidy',
    // The per-generation limit is structural (`usesPerGeneration`), never a
    // clause of the sentence.
    action: 'Action: spend 2 M€ to gain 1 heat.',
    quest: 'Play 2 building tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.BUILDING}, count: 2},
  action: {
    usesPerGeneration: () => 1,
    canAct: (player) => player.canAfford(2) ? {available: true} : {available: false, reason: 'Not enough M€'},
    execute: (player) => {
      player.stock.deduct(Resource.MEGACREDITS, 2);
      player.stock.add(Resource.HEAT, 1, {log: true, from: {resolution: DEV_ACTION_RESOLUTION_ID}});
      return undefined;
    },
    preview: () => [
      {direction: 'cost', icon: 'megacredits', amount: 2},
      {direction: 'gain', icon: 'heat', amount: 1},
    ],
  },
};

/**
 * TWO LAYOUT EXAMPLES for the resolution INSPECTOR (never dealt: `copies: 0`).
 * A real catalog resolution will carry several rows, conditions, recipients
 * and a long name; the three technical examples above are single-row, so the
 * inspector's composition could not be judged against them. Both are built
 * from the existing primitives only (stock / draw / TR, the render DSL) —
 * no new game mechanic — and neither reaches a deck.
 */
export const DEV_COMPOUND_RESOLUTION_ID: ResolutionId = 'RDX_DEV_COMPOUND';
export const DEV_SCIENCE_RESOLUTION_ID: ResolutionId = 'RDX_DEV_SCIENCE';

const DEV_COMPOUND: ResolutionDefinition = {
  id: DEV_COMPOUND_RESOLUTION_ID,
  module: 'turmoilRedux',
  party: PartyName.REDS,
  copies: 0,
  renderData: CardRenderer.builder((b) => {
    b.megacredits(2).slash().tag(Tag.PLANT).tag(Tag.MICROBE).tag(Tag.ANIMAL).asterix().nbsp.cards(1).br;
    b.megacredits(2).asterix();
  }),
  text: {
    name: 'Interplanetary Reconstruction Accord',
    effect: 'Gain 2 M€ per plant, microbe and animal tag you have (max 10 M€) and draw 1 card.',
    // The winner's part pays a kind the address table knows (`rewardAddress.ts`) — a
    // TR grant would be a kind with an address and no payer, which the table refuses.
    winner: 'Gain 2 M€.',
    quest: 'Send 4 delegates to resolutions',
  },
  quest: {goal: {kind: 'delegates'}, count: 4},
  // ONE record per step: the M€ by tags and the draw are two steps.
  immediateSteps: [
    {
      key: 'grant-mc',
      run: (ctx) => {
        const tags = ctx.player.tags.count(Tag.PLANT, 'raw') + ctx.player.tags.count(Tag.MICROBE, 'raw') + ctx.player.tags.count(Tag.ANIMAL, 'raw');
        const megacredits = Math.min(10, 2 * tags);
        if (megacredits <= 0) {
          ctx.report({kind: 'skipped', stock: Resource.MEGACREDITS, amount: 0, reason: 'No plant, microbe or animal tags'});
          return undefined;
        }
        grantStock(ctx, Resource.MEGACREDITS, megacredits, {resolution: DEV_COMPOUND_RESOLUTION_ID});
        return undefined;
      },
    },
    {
      key: 'draw',
      run: (ctx) => drawStep(ctx, DEV_COMPOUND_RESOLUTION_ID, 1, 'The project deck is empty'),
    },
  ],
  winnerSteps: [{
    key: 'winner-mc',
    run: (ctx) => {
      grantStock(ctx, Resource.MEGACREDITS, 2, {resolution: DEV_COMPOUND_RESOLUTION_ID});
      return undefined;
    },
  }],
};

const DEV_SCIENCE: ResolutionDefinition = {
  id: DEV_SCIENCE_RESOLUTION_ID,
  module: 'turmoilRedux',
  party: PartyName.SCIENTISTS,
  copies: 0,
  renderData: CardRenderer.builder((b) => {
    b.cards(1).slash().tag(Tag.SCIENCE, 2).asterix();
  }),
  text: {
    name: 'Open Research Charter',
    effect: 'Draw 1 card per 2 science tags you have. Max 3 cards.',
    quest: 'Play 2 science tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.SCIENCE}, count: 2},
  immediateSteps: [{
    key: 'draw',
    run: (ctx) => {
      const cards = Math.min(3, Math.floor(ctx.player.tags.count(Tag.SCIENCE, 'raw') / 2));
      return drawStep(ctx, DEV_SCIENCE_RESOLUTION_ID, cards, 'Fewer than 2 science tags — no cards');
    },
  }],
};

/**
 * The shipped catalog: the REAL resolutions and the never-dealt test /
 * development resolutions.
 *
 * THE DECK IS THE SUM OF WHAT IS SHIPPED, never a fixed size and never a
 * quota per party: a party's share of the deck is how many of its resolutions
 * are implemented. The voting area's own rule — one resolution per party
 * among the three offered, never the enacted card's party
 * (`dealForVotingArea`) — is what keeps the offer legal; while few parties
 * have real cards, a slot that nothing fits simply stays empty. A card that
 * needs an expansion (`compatibility`) is in the sum only in a game that has
 * it — the deck of a Venus game holds one card more than a game without.
 */
export const REDUX_RESOLUTION_CATALOG = new ResolutionCatalog([
  AQUIFER_CONTEST,
  ARCHITECTURE_AWARD,
  BIODOME_CONTEST,
  CENTRAL_POWER_GRID,
  CLIMATE_RESEARCH,
  // Venus Next only (`compatibility`): the deal's filter keeps it out of a game without Venus.
  CLOUD_DEVELOPMENT,
  // A PLAN PER PLAYER (`immediateStepsFor`): one step per colony tile the seat has a cube on.
  COLONIAL_AFFAIRS,
  // A count over THE BOARD (space cities), not the tableau.
  COLONIZATION_FUNDING,
  // The winner's part is a COLONY built for free (`winnerReward: {kind: 'colony'}`) — the colonies screen hosted as
  // the sitting's own step.
  COLONY_CONTEST,
  // The first LIVE PASSIVE: a placement's bonuses paid a second time while the card stands enacted.
  DEVELOPMENT_CRAZE,
  // …and the first law that INTRODUCES a bonus the engine has none of: greeneries pay their neighbours.
  FORESTRY_SUPPORT,
  // The first law that changes THE WORLD instead of paying the table (`worldSteps` / `worldMoves`):
  // oxygen down, Venus up, and nobody is credited for either. Venus Next only.
  GAS_EXPORT,
  // A count over ONE PLAYER METRIC by threshold and step (sets of 5 TR over 15), not over things.
  GENEROUS_FUNDING,
  // The first law that touches the ECONOMY of cards: a world step (temperature −2, no TR) and a passive
  // DISCOUNT (3 M€ off a Building tag) asked by the one price function and itemized under the law's source.
  HEAT_CAPTURE,
  // The first BUDGET: a LEVY every participant pays FIRST (the family's shared declaration + step), then a payout
  // by PRODUCTION STEPS (the fifth count kind) + influence, then a flat production part.
  INDUSTRIALIST_BUDGET,
  // The Scientists' FIRST card, and the first value that is a LEVEL, not an amount: every seat draws UP TO
  // 6 + influence cards in hand (`upTo`) — the payout is the difference to the hand, zero being the rule working.
  JOINT_RESEARCH,
  // A count over the seat's COLONIES (the sixth count kind: cubes on the colony tiles, the engine's own list) beside
  // a plain titanium-by-influence part; the cap sits on the production part alone.
  JOVIAN_TAX_RIGHTS,
  // The distributing family over TWO KINDS of unit: the recipients are the holders of data AND of microbes at once,
  // and each unit's kind is its card's — never a second question (`AddResourcesToCards` over a list of kinds).
  MEDICAL_DATABASE,
  // The first law that changes the VALUE OF A RESOURCE (steel 3, titanium 4 while it stands): a passive asked by the
  // value ACCESSORS on the read — the player's serialized value field is never written by a law.
  METAL_RESEARCH,
  // A count over THE BOARD by QUANTITY (the `tiers` measure): 2 M€ per city on Mars, a tier of a stack apiece — the
  // engine's own `countCities`, never the cell list's length (which is Skyscrapers' count of destinations).
  MIGRATION_FUNDING,
  // The SIMPLEST shape the family has: two ordinary production parts (a flat titanium step for everyone and a steel
  // step by influence), no new mechanism at all — and the law that influence 0 skips only the part that asks for it.
  MINING_INCENTIVES,
  // The first winner part that is a DIRECT STEP of a global parameter (the temperature, 2 steps) — REWARDED, unlike a
  // world move: the winner's TR, the track's bonuses, and the 0 °C ocean as its own placement inside the sitting.
  MOHOLE_CONTEST,
  // The first recipients decided by a THRESHOLD (the winner + everyone with influence ≥ 2), and the first CITY STACK:
  // one city tile each, placed as a TIER on the seat's own city on Mars — the cell pays nothing again, every tier scores.
  SKYSCRAPERS,
  TEST_CHOICE,
  DEV_IMMEDIATE,
  DEV_PASSIVE,
  DEV_ACTION,
  DEV_COMPOUND,
  DEV_SCIENCE,
]);

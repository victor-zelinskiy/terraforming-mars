/*
 * THE RESOLUTION CATALOG — every resolution this build knows, by stable id.
 *
 * Iteration 0 ships DUMMY resolutions: two per party, each with a real party,
 * a real chairman quest and no effect of its own (the face says so), plus one
 * TEST resolution (never dealt) that exercises the resumable multi-step
 * effect contract. Adding a REAL resolution is adding a definition here (or
 * in a module file registered here) — the deck, the vote, the enactment, the
 * face and the client catalog all read this table.
 *
 * Ids are permanent. A save that names an id this table no longer has fails
 * to load explicitly (`Parliament.deserialize`).
 */
import {CardRenderer} from '../../cards/render/CardRenderer';
import {Size} from '../../../common/cards/render/Size';
import {PartyName} from '../../../common/turmoil/PartyName';
import {Resource} from '../../../common/Resource';
import {Tag} from '../../../common/cards/Tag';
import {CardResource} from '../../../common/CardResource';
import {
  isResolutionCode, QuestDefinition, ReduxParty, ResolutionCode, ResolutionId, resolutionInstanceId, ResolutionInstanceId, resolutionIdOf,
} from '../../../common/parliament/ParliamentTypes';
import {EnactStep, ResolutionDefinition} from './IResolution';
import {SelectOption} from '../../inputs/SelectOption';
import {SpaceType} from '../../../common/boards/SpaceType';
import {Board} from '../../boards/Board';
import {OrOptions} from '../../inputs/OrOptions';
import {AQUIFER_CONTEST} from './greens/AquiferContest';
import {ARCHITECTURE_AWARD} from './marsFirst/ArchitectureAward';

/** A DUMMY prints NO effect row: the face states «no effect of its own» as a
 *  quiet caption from the `dummy` flag, never as the card's centrepiece.
 *  Nothing about iterations or tests belongs on a card the player reads. */
const DUMMY_RENDER = CardRenderer.builder(() => {});

type DummySpec = {
  party: ReduxParty;
  n: 1 | 2;
  name: string;
  quest: QuestDefinition;
  questText: string;
  /**
   * A dummy a REAL resolution has replaced in the deck stays catalogued with
   * `copies: 0`: an older save that still carries it loads and reads it as
   * it was (its id is never re-pointed at the new card — a dummy enacted
   * yesterday must not wake up with an effect today); a new game never deals it.
   */
  copies?: 0;
};

const PARTY_KEY: Readonly<Record<ReduxParty, string>> = {
  [PartyName.UNITY]: 'UNITY',
  [PartyName.GREENS]: 'GREENS',
  [PartyName.SCIENTISTS]: 'SCIENTISTS',
  [PartyName.MARS]: 'MARS',
  [PartyName.INDUSTRIALISTS]: 'INDUSTRIALISTS',
  [PartyName.REDS]: 'REDS',
};

export function dummyResolutionId(party: ReduxParty, n: number): ResolutionId {
  return `RDX_DUMMY_${PARTY_KEY[party]}_${n}`;
}

/**
 * The dummy set. Quests are drawn from the goal kinds the tracker implements
 * (production steps, tags, tiles, colonies, TR, card resources, delegates,
 * card types) so the chairman mechanism is exercised for real from the first
 * generation on.
 */
const DUMMIES: ReadonlyArray<DummySpec> = [
  {party: PartyName.UNITY, n: 1, name: 'Unity Motion I', quest: {goal: {kind: 'tag', tag: Tag.EARTH}, count: 2}, questText: 'Play 2 Earth tags'},
  {party: PartyName.UNITY, n: 2, name: 'Unity Motion II', quest: {goal: {kind: 'colony'}, count: 1}, questText: 'Build 1 colony'},
  {party: PartyName.GREENS, n: 1, name: 'Greens Motion I', quest: {goal: {kind: 'tile', tile: 'greenery'}, count: 2}, questText: 'Place 2 greenery tiles'},
  // Replaced in the deck by Aquifer Contest (RX01) — kept for older saves only.
  {party: PartyName.GREENS, n: 2, name: 'Greens Motion II', quest: {goal: {kind: 'tag', tag: Tag.PLANT}, count: 2}, questText: 'Play 2 plant tags', copies: 0},
  {party: PartyName.SCIENTISTS, n: 1, name: 'Scientists Motion I', quest: {goal: {kind: 'tag', tag: Tag.SCIENCE}, count: 2}, questText: 'Play 2 science tags'},
  {party: PartyName.SCIENTISTS, n: 2, name: 'Scientists Motion II', quest: {goal: {kind: 'cardsPlayed', cardType: 'active'}, count: 2}, questText: 'Play 2 blue cards'},
  // Replaced in the deck by Architecture Award (RX02) — kept for older saves only.
  {party: PartyName.MARS, n: 1, name: 'Mars First Motion I', quest: {goal: {kind: 'tag', tag: Tag.BUILDING}, count: 2}, questText: 'Play 2 building tags', copies: 0},
  {party: PartyName.MARS, n: 2, name: 'Mars First Motion II', quest: {goal: {kind: 'tile', tile: 'city'}, count: 1}, questText: 'Place 1 city tile on Mars'},
  {party: PartyName.INDUSTRIALISTS, n: 1, name: 'Industrialists Motion I', quest: {goal: {kind: 'production', resource: Resource.STEEL}, count: 1}, questText: 'Raise your steel production 1 step'},
  {party: PartyName.INDUSTRIALISTS, n: 2, name: 'Industrialists Motion II', quest: {goal: {kind: 'cardsPlayed', cardType: 'automated'}, count: 2}, questText: 'Play 2 green cards'},
  {party: PartyName.REDS, n: 1, name: 'Reds Motion I', quest: {goal: {kind: 'delegates'}, count: 4}, questText: 'Send 4 delegates to resolutions'},
  {party: PartyName.REDS, n: 2, name: 'Reds Motion II', quest: {goal: {kind: 'tr'}, count: 3}, questText: 'Raise your terraform rating 3 steps'},
];

function dummy(spec: DummySpec): ResolutionDefinition {
  return {
    id: dummyResolutionId(spec.party, spec.n),
    module: 'turmoilRedux',
    party: spec.party,
    copies: spec.copies ?? 1,
    renderData: DUMMY_RENDER,
    text: {name: spec.name, quest: spec.questText},
    quest: spec.quest,
    dummy: true,
  };
}

/**
 * THE RESUMABLE-EFFECT PROOF (never in a real deck: `copies: 0`). Four steps:
 * mutate → ask → mutate → ask. `tests/parliament/ParliamentPhase.spec.ts`
 * reloads the game inside the second ask and asserts that no reward is paid
 * twice, none is lost, and the first answer is remembered.
 */
export const TEST_CHOICE_RESOLUTION_ID: ResolutionId = 'RDX_TEST_CHOICE';

const TEST_CHOICE_STEPS: ReadonlyArray<EnactStep> = [
  {
    key: 'grant-mc',
    run: (ctx) => {
      ctx.player.stock.add(Resource.MEGACREDITS, 1, {log: true, from: {resolution: ctx.parliament.resolutionOf(ctx.parliament.enactedInstanceOrThrow()).id}});
      return undefined;
    },
  },
  {
    key: 'choose-plant-or-heat',
    run: (ctx) => {
      const from = {resolution: TEST_CHOICE_RESOLUTION_ID};
      return new OrOptions(
        new SelectOption('Gain 1 plant', 'Plant').andThen(() => {
          ctx.player.stock.add(Resource.PLANTS, 1, {log: true, from});
          ctx.state.firstChoice = 'plant';
          return undefined;
        }),
        new SelectOption('Gain 1 heat', 'Heat').andThen(() => {
          ctx.player.stock.add(Resource.HEAT, 1, {log: true, from});
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
      ctx.player.stock.add(Resource.STEEL, 1, {log: true, from: {resolution: TEST_CHOICE_RESOLUTION_ID}});
      return undefined;
    },
  },
  {
    key: 'choose-card-or-mc',
    run: (ctx) => {
      const from = {resolution: TEST_CHOICE_RESOLUTION_ID};
      return new OrOptions(
        new SelectOption('Draw 1 card', 'Draw').andThen(() => {
          ctx.player.drawCard(1);
          ctx.state.secondChoice = 'card';
          return undefined;
        }),
        new SelectOption('Gain 2 M€', 'Gain').andThen(() => {
          ctx.player.stock.add(Resource.MEGACREDITS, 2, {log: true, from});
          ctx.state.secondChoice = 'mc';
          return undefined;
        }),
      ).setTitle('Test resolution: choose a reward')
        .markChoiceContext({source: {kind: 'resolution', resolution: TEST_CHOICE_RESOLUTION_ID}, trigger: 'The enacted resolution asks you to choose', mode: 'effect-choice'});
    },
  },
];

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
 * THE TEMPLATE'S DEVELOPMENT EXAMPLES (never dealt: `copies: 0`). One real
 * IMMEDIATE effect, one PASSIVE and one ACTION, built from the existing
 * primitives, so the resolution face, the inspector and the workspace can be
 * proven against a card with content before the real catalog exists. A dummy
 * with an empty effect zone proves nothing about the template.
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
    effect: 'Every player gains 3 M€ and 1 plant.',
    quest: 'Raise your plant production 2 steps',
  },
  quest: {goal: {kind: 'production', resource: Resource.PLANTS}, count: 2},
  immediateSteps: [{
    key: 'grant',
    run: (ctx) => {
      const from = {resolution: DEV_IMMEDIATE_RESOLUTION_ID};
      ctx.player.stock.add(Resource.MEGACREDITS, 3, {log: true, from});
      ctx.player.stock.add(Resource.PLANTS, 1, {log: true, from});
      return undefined;
    },
  }],
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
    b.tr(1).asterix();
  }),
  text: {
    name: 'Interplanetary Reconstruction Accord',
    effect: 'Every player gains 2 M€ for each plant, microbe and animal tag they have, up to 10 M€, and draws 1 card.',
    winner: 'Gain 1 TR.',
    quest: 'Send 4 delegates to resolutions',
  },
  quest: {goal: {kind: 'delegates'}, count: 4},
  immediateSteps: [{
    key: 'grant',
    run: (ctx) => {
      const from = {resolution: DEV_COMPOUND_RESOLUTION_ID};
      const tags = ctx.player.tags.count(Tag.PLANT, 'raw') + ctx.player.tags.count(Tag.MICROBE, 'raw') + ctx.player.tags.count(Tag.ANIMAL, 'raw');
      const megacredits = Math.min(10, 2 * tags);
      if (megacredits > 0) {
        ctx.player.stock.add(Resource.MEGACREDITS, megacredits, {log: true, from});
      }
      ctx.player.drawCard(1);
      return undefined;
    },
  }],
  winnerSteps: [{
    key: 'winner-tr',
    run: (ctx) => {
      ctx.player.increaseTerraformRating(1, {log: true, from: {resolution: DEV_COMPOUND_RESOLUTION_ID}});
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
    effect: 'Every player draws 1 card for every 2 science tags they have, up to 3 cards.',
    quest: 'Play 2 science tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.SCIENCE}, count: 2},
  immediateSteps: [{
    key: 'draw',
    run: (ctx) => {
      const cards = Math.min(3, Math.floor(ctx.player.tags.count(Tag.SCIENCE, 'raw') / 2));
      if (cards > 0) {
        ctx.player.drawCard(cards);
      }
      return undefined;
    },
  }],
};

/**
 * The shipped catalog: the REAL resolutions (each in its own file under the
 * party's directory — `greens/AquiferContest.ts` is the template), the
 * dummies still standing in for the rest of the 48 (a replaced dummy stays
 * with `copies: 0` for older saves), and the never-dealt test / development
 * resolutions. The deck keeps 12 dealt cards, two per party.
 */
export const REDUX_RESOLUTION_CATALOG = new ResolutionCatalog([
  AQUIFER_CONTEST,
  ARCHITECTURE_AWARD,
  ...DUMMIES.map(dummy),
  TEST_CHOICE,
  DEV_IMMEDIATE,
  DEV_PASSIVE,
  DEV_ACTION,
  DEV_COMPOUND,
  DEV_SCIENCE,
]);

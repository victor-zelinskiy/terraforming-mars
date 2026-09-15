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
import {QuestDefinition, ReduxParty, ResolutionId, resolutionInstanceId, ResolutionInstanceId, resolutionIdOf} from '../../../common/parliament/ParliamentTypes';
import {EnactStep, ResolutionDefinition} from './IResolution';
import {SelectOption} from '../../inputs/SelectOption';
import {OrOptions} from '../../inputs/OrOptions';

/** A DUMMY states its one honest fact on the face — calmly, in the game's own
 *  words: it has no effect. Nothing about iterations or tests belongs on a
 *  card the player reads. */
const DUMMY_RENDER = CardRenderer.builder((b) => {
  b.text('No effect of its own', Size.SMALL, true);
});

type DummySpec = {
  party: ReduxParty;
  n: 1 | 2;
  name: string;
  quest: QuestDefinition;
  questText: string;
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
  {party: PartyName.GREENS, n: 2, name: 'Greens Motion II', quest: {goal: {kind: 'tag', tag: Tag.PLANT}, count: 2}, questText: 'Play 2 plant tags'},
  {party: PartyName.SCIENTISTS, n: 1, name: 'Scientists Motion I', quest: {goal: {kind: 'tag', tag: Tag.SCIENCE}, count: 2}, questText: 'Play 2 science tags'},
  {party: PartyName.SCIENTISTS, n: 2, name: 'Scientists Motion II', quest: {goal: {kind: 'cardsPlayed', cardType: 'active'}, count: 2}, questText: 'Play 2 blue cards'},
  {party: PartyName.MARS, n: 1, name: 'Mars First Motion I', quest: {goal: {kind: 'tag', tag: Tag.BUILDING}, count: 2}, questText: 'Play 2 building tags'},
  {party: PartyName.MARS, n: 2, name: 'Mars First Motion II', quest: {goal: {kind: 'tile', tile: 'city'}, count: 1}, questText: 'Place 1 city tile on Mars'},
  {party: PartyName.INDUSTRIALISTS, n: 1, name: 'Industrialists Motion I', quest: {goal: {kind: 'production', resource: Resource.STEEL}, count: 1}, questText: 'Raise your steel production 1 step'},
  {party: PartyName.INDUSTRIALISTS, n: 2, name: 'Industrialists Motion II', quest: {goal: {kind: 'cardsPlayed', cardType: 'automated'}, count: 2}, questText: 'Play 2 green cards'},
  {party: PartyName.REDS, n: 1, name: 'Reds Motion I', quest: {goal: {kind: 'delegates'}, count: 4}, questText: 'Place 4 delegates'},
  {party: PartyName.REDS, n: 2, name: 'Reds Motion II', quest: {goal: {kind: 'tr'}, count: 3}, questText: 'Raise your terraform rating 3 steps'},
];

function dummy(spec: DummySpec): ResolutionDefinition {
  return {
    id: dummyResolutionId(spec.party, spec.n),
    module: 'turmoilRedux',
    party: spec.party,
    copies: 1,
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

  constructor(definitions: ReadonlyArray<ResolutionDefinition>) {
    for (const definition of definitions) {
      if (this.byId.has(definition.id)) {
        throw new Error(`Duplicate resolution id ${definition.id}`);
      }
      this.byId.set(definition.id, definition);
    }
  }

  public get(id: ResolutionId): ResolutionDefinition | undefined {
    return this.byId.get(id);
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

/** The shipped catalog: the 12 dummies + the never-dealt test resolution. */
export const REDUX_RESOLUTION_CATALOG = new ResolutionCatalog([
  ...DUMMIES.map(dummy),
  TEST_CHOICE,
]);

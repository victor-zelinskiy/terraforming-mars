/*
 * THE SIX REDUX PARTY EFFECTS (rulebook pp.3–5).
 *
 * A party effect is a full citizen of the effect framework: it has a source
 * (`{kind: 'party', name, owner}`), a printed graphic (render data, exported
 * to `genfiles/parliament.json` for the face and the inspect panels), rule
 * text keys, and — for four parties — an ACTION with the commit contract of
 * every other action in this fork: the prompt the action menu nests changes
 * NOTHING until it is answered, and the answer is the commit.
 *
 * Passive hooks are invoked by `ParliamentHandler` from the engine's own
 * mutation points; access is checked at the moment of the hook, so a passive
 * works in any phase where its condition holds (project decision Q7) while the
 * World Government keeps its existing exclusions (no TR in `Phase.SOLAR`, so
 * the Greens' hook never sees WGT).
 */
import {CardRenderer} from '../../cards/render/CardRenderer';
import {ICardRenderRoot} from '../../../common/cards/render/Types';
import {Size} from '../../../common/cards/render/Size';
import {PartyName} from '../../../common/turmoil/PartyName';
import {Resource} from '../../../common/Resource';
import {CardResource} from '../../../common/CardResource';
import {Tag} from '../../../common/cards/Tag';
import {Units} from '../../../common/Units';
import {Message} from '../../../common/logs/Message';
import {message} from '../../logs/MessageBuilder';
import {IPlayer} from '../../IPlayer';
import {PlayerInput} from '../../PlayerInput';
import {OrOptions} from '../../inputs/OrOptions';
import {AndOptions} from '../../inputs/AndOptions';
import {SelectOption} from '../../inputs/SelectOption';
import {SelectCard} from '../../inputs/SelectCard';
import {ICard} from '../../cards/ICard';
import {IProjectCard} from '../../cards/IProjectCard';
import {ActionEffect} from '../../../common/models/ActionPreviewModel';
import {PartyActionPromptMeta} from '../../../common/models/PlayerInputModel';
import {cardResourceIcon, drawGain, productionChange, targetVictoryPoints} from '../../cards/actionPreviews';
import {PartyActionId, ReduxParty} from '../../../common/parliament/ParliamentTypes';
import {IClientPartyEffect} from '../../../common/parliament/IClientResolution';
import {InputError} from '../../inputs/InputError';
import {Space} from '../../boards/Space';
import {Board} from '../../boards/Board';
import {SpaceType} from '../../../common/boards/SpaceType';
import {EventSource} from '../../../common/events/EventSource';
import type {Parliament} from '../Parliament';

export type PartyActionAvailability = {available: true} | {available: false; reason: string | Message};

/** The scope every party mutation runs under — WHOSE access produced it. */
export function partySource(party: ReduxParty, player: IPlayer): EventSource {
  return {kind: 'party', name: party, owner: player.color};
}

export interface PartyEffectDefinition {
  party: ReduxParty;
  /** English i18n keys. `rule` is the whole printed effect; `passive` / `action` split it for the inspect panels. */
  text: {rule: string; passive?: string; action?: string};
  passiveRenderData: ICardRenderRoot;
  actionRenderData?: ICardRenderRoot;
  actionId?: PartyActionId;
  /** The passive hooks (access already verified by the caller). */
  onTerraformRatingGained?(player: IPlayer, steps: number): void;
  onProductionChanged?(player: IPlayer, resource: Resource, delta: number): void;
  onTilePlaced?(player: IPlayer, space: Space): void;
  wildTags?(player: IPlayer): number;
  /** The action's availability, ignoring uses (the parliament counts those). */
  canAct?(player: IPlayer): PartyActionAvailability;
  /**
   * Build the ONE prompt the action menu nests. Building it changes nothing;
   * answering it is the commit. `meta` is stamped on the prompt (and on the
   * prompts it nests) so the console reads the action from structure alone.
   */
  actionInput?(player: IPlayer, parliament: Parliament, meta: PartyActionPromptMeta): PlayerInput;
  /** Result chips for the workspace's action tile (`current → resulting` where the outcome is fixed). */
  preview?(player: IPlayer): ReadonlyArray<ActionEffect>;
}

const REDS_TAGS: ReadonlyArray<Tag> = [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL];
export const REDS_MEGACREDITS_PER_TAG = 2;
export const GREENS_MEGACREDITS_PER_TR = 2;
export const SCIENTISTS_RESOURCES_PER_USE = 2;
export const SCIENTISTS_RESOURCE_KINDS: ReadonlyArray<CardResource> = [CardResource.DATA, CardResource.MICROBE];

/** The resources the Industrialists may DECREASE right now (one step, within production minimums). */
export function industrialistsDecreasable(player: IPlayer): Array<Resource> {
  return (Object.values(Resource) as Array<Resource>).filter((resource) => player.production.canAdjust(Units.of({[resource]: -1})));
}

/** 2 M€ per plant / microbe / animal tag on the discarded cards (an event's printed tags count too). */
export function redsPayoutFor(cards: ReadonlyArray<ICard>): number {
  let tags = 0;
  for (const card of cards) {
    tags += card.tags.filter((tag) => REDS_TAGS.includes(tag)).length;
  }
  return tags * REDS_MEGACREDITS_PER_TAG;
}

const UNITY: PartyEffectDefinition = {
  party: PartyName.UNITY,
  actionId: 'unity-trade',
  text: {
    rule: 'Action: trade for free once per generation. If you trade with a colony track this way, you may advance it 1 step before the trade.',
    // The ACTION text states what the action DOES — ONCE, including the
    // track advance (no separate note restates it); its per-generation limit
    // is structural (`usesPerGeneration`) and every surface prints it beside
    // the live uses — a limit baked into the sentence reads twice.
    action: 'Trade for free; if you trade with a colony track, you may advance it 1 step first.',
  },
  // An ACTION-ONLY party: the passive graphic is empty by design (the face and
  // the compact formula merge both roots), and the printed row is the
  // ACTION's — the one the action menu's tile draws, never a second drawing.
  passiveRenderData: CardRenderer.builder(() => {}),
  actionRenderData: CardRenderer.builder((b) => {
    b.action('Trade for free. You may advance the colony track 1 step first.', (ab) => ab.empty().startAction.trade().asterix());
  }),
  canAct(player) {
    const reason = player.colonies.tradeBlockedReason();
    return reason === undefined ? {available: true} : {available: false, reason};
  },
  preview() {
    return [{direction: 'cost', icon: 'megacredits', amount: 0, note: 'trade fee'}];
  },
};

const GREENS: PartyEffectDefinition = {
  party: PartyName.GREENS,
  text: {
    rule: 'Effect: whenever you increase your terraform rating, gain 2 M€ per step. When you increase your plant or heat production 1 step, increase your M€ production 1 step as well.',
    passive: 'Gain 2 M€ per TR step you gain; +1 M€ production per plant or heat production step you gain.',
  },
  passiveRenderData: CardRenderer.builder((b) => {
    b.effect(undefined, (eb) => eb.tr(1).startEffect.megacredits(2)).br;
    b.effect(undefined, (eb) => eb.production((pb) => pb.plants(1).slash().heat(1)).startEffect.production((pb) => pb.megacredits(1)));
  }),
  onTerraformRatingGained(player, steps) {
    player.stock.add(Resource.MEGACREDITS, GREENS_MEGACREDITS_PER_TR * steps, {log: true, from: {partyName: PartyName.GREENS}});
  },
  onProductionChanged(player, resource, delta) {
    if ((resource === Resource.PLANTS || resource === Resource.HEAT) && delta > 0) {
      player.production.add(Resource.MEGACREDITS, delta, {log: true, from: {partyName: PartyName.GREENS}});
    }
  },
};

const SCIENTISTS: PartyEffectDefinition = {
  party: PartyName.SCIENTISTS,
  actionId: 'scientists-lab',
  text: {
    // The passive is stated as a RULE (what the effect grants), never as a
    // claim about the reader («you have…») — the inspector's «for you» block
    // is where access is read, and the two must not contradict each other.
    rule: 'Effect: 1 extra wild tag when playing cards and actions. Action: add 2 data or 2 microbes to one of your cards that holds that resource, once per generation.',
    passive: '+1 wild tag when playing cards and actions.',
    action: 'Add 2 data or 2 microbes to one of your cards that holds that resource.',
  },
  // The wild tag is a TAG (the face's round tag holder) in the effect frame —
  // the game's own language for a permanent grant, not a «?» resource tile.
  // A STANDING MODIFIER: no cause, so the frame prints no colon (the premium
  // face draws an empty-cause effect as the modifier itself — «+ wild tag»),
  // never «: tag», which reads as a formula missing its condition.
  passiveRenderData: CardRenderer.builder((b) => {
    b.effect(undefined, (eb) => eb.empty().startEffect.plus().tag(Tag.WILD)).br;
  }),
  actionRenderData: CardRenderer.builder((b) => {
    b.action('Add 2 data or 2 microbes to one of your cards that holds that resource.', (ab) => ab.empty().startAction.resource(CardResource.DATA, 2).asterix().slash().resource(CardResource.MICROBE, 2).asterix());
  }),
  wildTags() {
    return 1;
  },
  canAct(player) {
    const any = SCIENTISTS_RESOURCE_KINDS.some((resource) => player.getResourceCards(resource).length > 0);
    return any ? {available: true} : {available: false, reason: 'No card of yours can hold data or microbes'};
  },
  actionInput(player, parliament, meta) {
    const options = new OrOptions()
      .setTitle('Add 2 data or 2 microbes to a card')
      .setButtonLabel('Add')
      .markPartyActionPrompt(meta)
      .markChoiceContext({source: {kind: 'party', party: PartyName.SCIENTISTS}, trigger: 'The Scientists\' action', mode: 'effect-choice'});
    for (const resource of SCIENTISTS_RESOURCE_KINDS) {
      const cards = player.getResourceCards(resource);
      if (cards.length === 0) {
        continue;
      }
      const pick = new SelectCard(
        message('Add ${0} ${1} to a card', (b) => b.number(SCIENTISTS_RESOURCES_PER_USE).string(resource)),
        'Add',
        cards,
        {min: 1, max: 1})
        .markResourceGainPrompt({
          amount: SCIENTISTS_RESOURCES_PER_USE,
          cardResource: cardResourceIcon(resource),
          vpBox: targetVictoryPoints(player, cards, SCIENTISTS_RESOURCES_PER_USE),
        })
        .markPartyActionPrompt(meta)
        .andThen(([card]) => {
          runPartyAction(player, parliament, PartyName.SCIENTISTS, () => {
            player.addResourceTo(card, {qty: SCIENTISTS_RESOURCES_PER_USE, log: true, from: {partyName: PartyName.SCIENTISTS}});
          });
          return undefined;
        });
      options.options.push(pick);
    }
    if (options.options.length === 0) {
      throw new InputError('No card can hold data or microbes');
    }
    return options;
  },
  preview() {
    return [{direction: 'gain', icon: cardResourceIcon(CardResource.DATA), amount: SCIENTISTS_RESOURCES_PER_USE, note: 'to a card'},
      {direction: 'gain', icon: cardResourceIcon(CardResource.MICROBE), amount: SCIENTISTS_RESOURCES_PER_USE, note: 'to a card'}];
  },
};

const MARS_FIRST: PartyEffectDefinition = {
  party: PartyName.MARS,
  text: {
    rule: 'Effect: whenever you place a tile on Mars, gain 1 steel. If it is a city tile, also draw a card.',
    passive: 'Whenever you place a tile on Mars, gain 1 steel; a city tile also draws a card.',
  },
  // ONE trigger, ONE extra: any tile on Mars pays the steel; a city ADDS a
  // card on top of it («+ card»). The second row must never restate the steel,
  // or the face reads as two triggers paying two steel for a city.
  passiveRenderData: CardRenderer.builder((b) => {
    b.effect(undefined, (eb) => eb.emptyTile('normal', {size: Size.SMALL}).asterix().startEffect.steel(1)).br;
    b.effect(undefined, (eb) => eb.city({size: Size.SMALL}).asterix().startEffect.plus().cards(1));
  }),
  onTilePlaced(player, space) {
    if (space.spaceType === SpaceType.COLONY) {
      return;
    }
    player.stock.add(Resource.STEEL, 1, {log: true, from: {partyName: PartyName.MARS}});
    if (Board.isCitySpace(space)) {
      player.drawCard(1);
    }
  },
};

const INDUSTRIALISTS: PartyEffectDefinition = {
  party: PartyName.INDUSTRIALISTS,
  actionId: 'industrialists-shift',
  text: {
    rule: 'Action: decrease one of your productions 1 step to increase your M€ or energy production 2 steps, once per generation. You may decrease the production you increase.',
    action: 'Decrease one production 1 step to increase your M€ or energy production 2 steps.',
  },
  passiveRenderData: CardRenderer.builder(() => {}),
  actionRenderData: CardRenderer.builder((b) => {
    b.action('Decrease any production 1 step to increase M€ or energy production 2 steps.', (ab) =>
      ab.production((pb) => pb.wild(1)).startAction.production((pb) => pb.megacredits(2).slash().energy(2)));
  }),
  canAct(player) {
    return industrialistsDecreasable(player).length > 0 ?
      {available: true} :
      {available: false, reason: 'No production of yours can be decreased'};
  },
  actionInput(player, parliament, meta) {
    let decrease: Resource | undefined;
    let increase: Resource | undefined;
    const decreaseOptions = new OrOptions().setTitle('Decrease a production 1 step').setButtonLabel('Decrease');
    for (const resource of industrialistsDecreasable(player)) {
      const current = player.production.get(resource);
      decreaseOptions.options.push(
        new SelectOption(message('Decrease ${0} production', (b) => b.string(resource)), 'Decrease')
          .withMetadata({kind: 'resourceRemoval', icon: resource, amount: 1, resource: {current, resulting: current - 1}, effects: [productionChange(player, resource, -1)]})
          .andThen(() => {
            decrease = resource;
            return undefined;
          }));
    }
    const increaseOptions = new OrOptions().setTitle('Increase a production 2 steps').setButtonLabel('Increase');
    for (const resource of [Resource.MEGACREDITS, Resource.ENERGY]) {
      const current = player.production.get(resource);
      increaseOptions.options.push(
        new SelectOption(message('Increase ${0} production 2 steps', (b) => b.string(resource)), 'Increase')
          .withMetadata({kind: 'resourceGain', icon: resource, amount: 2, resource: {current, resulting: current + 2}, effects: [productionChange(player, resource, 2)]})
          .andThen(() => {
            increase = resource;
            return undefined;
          }));
    }
    return new AndOptions(decreaseOptions, increaseOptions)
      .setTitle('Shift your production (Industrialists)')
      .setButtonLabel('Shift')
      .markPartyActionPrompt(meta)
      .markChoiceContext({source: {kind: 'party', party: PartyName.INDUSTRIALISTS}, trigger: 'The Industrialists\' action', mode: 'effect-choice'})
      .andThen(() => {
        const dec = decrease;
        const inc = increase;
        if (dec === undefined || inc === undefined) {
          throw new InputError('Both a production to decrease and one to increase must be chosen');
        }
        if (!player.production.canAdjust(Units.of({[dec]: -1}))) {
          throw new InputError(`${dec} production cannot be decreased`);
        }
        runPartyAction(player, parliament, PartyName.INDUSTRIALISTS, () => {
          player.production.add(dec, -1, {log: true, from: {partyName: PartyName.INDUSTRIALISTS}});
          player.production.add(inc, 2, {log: true, from: {partyName: PartyName.INDUSTRIALISTS}});
        });
        return undefined;
      });
  },
  preview() {
    return [
      {direction: 'cost', icon: 'resources', amount: 1, note: 'production'},
      {direction: 'gain', icon: 'megacredits', amount: 2, note: 'production'},
    ];
  },
};

const REDS: PartyEffectDefinition = {
  party: PartyName.REDS,
  actionId: 'reds-recycle',
  text: {
    rule: 'Action: draw 2 cards, then discard 2 cards, once per generation. Gain 2 M€ for every plant, microbe and animal tag on the discarded cards.',
    action: 'Draw 2 cards, then discard 2 cards; gain 2 M€ per plant, microbe or animal tag discarded.',
  },
  passiveRenderData: CardRenderer.builder(() => {}),
  actionRenderData: CardRenderer.builder((b) => {
    b.action('Draw 2 cards, then discard 2 cards. Gain 2 M€ per plant, microbe or animal tag discarded.', (ab) =>
      ab.empty().startAction.cards(2).nbsp.minus().cards(2).nbsp.megacredits(2).slash().tag(Tag.PLANT).tag(Tag.MICROBE).tag(Tag.ANIMAL));
  }),
  canAct() {
    return {available: true};
  },
  actionInput(player, parliament, meta) {
    // THE COMMIT IS THE CONFIRM: answering this option draws (random, irreversible).
    // The discard that follows is mandatory and cannot be cancelled or restarted.
    return new SelectOption('Draw 2 cards, then discard 2 cards (Reds)', 'Draw')
      .withMetadata({kind: 'generic', icon: 'cards', amount: 2, effects: [drawGain(2), {direction: 'cost', icon: 'cards', amount: 2, note: 'discard'}]})
      .markPartyActionPrompt(meta)
      .andThen(() => {
        runPartyAction(player, parliament, PartyName.REDS, () => {
          player.drawCard(2);
          parliament.pendingActions.push({kind: 'reds-recycle', player: player.id, countAction: false});
          // Deferred INSIDE the scope so the discard prompt keeps the action's chain.
          player.defer(() => redsDiscardPrompt(player, parliament));
        });
        return undefined;
      });
  },
  preview() {
    return [drawGain(2), {direction: 'cost', icon: 'cards', amount: 2, note: 'discard'}, {direction: 'gain', icon: 'megacredits', amount: REDS_MEGACREDITS_PER_TAG, note: 'per tag'}];
  },
};

/**
 * The mandatory second half of the Reds' recycle. Built from the persisted
 * pending record so a reload rebuilds exactly this prompt (the cards are
 * already in the hand; nothing is drawn twice).
 */
export function redsDiscardPrompt(player: IPlayer, parliament: Parliament): PlayerInput | undefined {
  const pending = parliament.pendingActions.find((action) => action.kind === 'reds-recycle' && action.player === player.id);
  if (pending === undefined || pending.kind !== 'reds-recycle') {
    return undefined;
  }
  const count = Math.min(2, player.cardsInHand.length);
  const meta: PartyActionPromptMeta = {
    party: PartyName.REDS,
    actionId: 'reds-recycle',
    stage: 'discard',
    usesLeft: parliament.partyActionUsesLeft(player, PartyName.REDS),
    usesPerGeneration: 1,
  };
  if (count === 0) {
    // Nothing to discard (an empty deck drew nothing): the action simply ends.
    finishRedsRecycle(player, parliament, pending, []);
    return undefined;
  }
  return new SelectCard<IProjectCard>(
    message('Select ${0} card(s) to discard (Reds)', (b) => b.number(count)),
    'Discard',
    player.cardsInHand,
    {min: count, max: count})
    .markDiscardPrompt({min: count, max: count, source: {kind: 'party', party: PartyName.REDS}, exchange: {icon: 'megacredits', amount: REDS_MEGACREDITS_PER_TAG, perTag: REDS_TAGS}})
    .markPartyActionPrompt(meta)
    .andThen((cards) => {
      finishRedsRecycle(player, parliament, pending, cards);
      return undefined;
    });
}

function finishRedsRecycle(player: IPlayer, parliament: Parliament, pending: {kind: 'reds-recycle'; player: string; countAction: boolean}, cards: ReadonlyArray<IProjectCard>): void {
  const events = player.game.events;
  const run = () => {
    for (const card of cards) {
      player.discardCardFromHand(card, {log: true});
    }
    const payout = redsPayoutFor(cards);
    if (payout > 0) {
      player.stock.add(Resource.MEGACREDITS, payout, {log: true, from: {partyName: PartyName.REDS}});
    } else if (cards.length > 0) {
      player.game.log('${0} discarded no plant, microbe or animal tags — no M€ from the ${1}', (b) => b.player(player).partyName(PartyName.REDS));
    }
  };
  // Inside the action's chain when the prompt was raised live; a REBUILT
  // prompt (after a reload) opens its own root so the payout is attributed.
  if (events.captureContext() === undefined) {
    events.beginAction(player, partySource(PartyName.REDS, player), {category: 'parliament'});
    try {
      run();
    } finally {
      events.endScope();
    }
  } else {
    run();
  }
  parliament.pendingActions = parliament.pendingActions.filter((action) => action !== pending);
  if (pending.countAction) {
    // The turn's own accounting was lost with the reload — the action is counted here.
    player.actionsTakenThisRound++;
    player.actionsTakenThisGame++;
  }
}

/**
 * THE COMMIT of a party action: opens the action's root scope, logs its
 * header, counts the use, runs the mutation. Every party action funnels
 * through here so the journal, the statistics and the notifications see one
 * shape.
 */
export function runPartyAction(player: IPlayer, parliament: Parliament, party: ReduxParty, mutate: () => void): void {
  const events = player.game.events;
  events.beginAction(player, partySource(party, player), {category: 'parliament'});
  try {
    player.game.log('${0} used the ${1} party action', (b) => b.player(player).partyName(party));
    parliament.recordPartyActionUse(player, party);
    mutate();
  } finally {
    events.endScope();
  }
}

export const PARTY_EFFECTS: Readonly<Record<ReduxParty, PartyEffectDefinition>> = {
  [PartyName.UNITY]: UNITY,
  [PartyName.GREENS]: GREENS,
  [PartyName.SCIENTISTS]: SCIENTISTS,
  [PartyName.MARS]: MARS_FIRST,
  [PartyName.INDUSTRIALISTS]: INDUSTRIALISTS,
  [PartyName.REDS]: REDS,
};

/** The client-facing catalog entry (render data + text keys), for `genfiles/parliament.json`. */
export function toClientPartyEffect(definition: PartyEffectDefinition): IClientPartyEffect {
  const out: IClientPartyEffect = {
    party: definition.party,
    passiveRenderData: definition.passiveRenderData,
    text: definition.text,
  };
  if (definition.actionRenderData !== undefined) {
    out.actionRenderData = definition.actionRenderData;
  }
  if (definition.actionId !== undefined) {
    out.actionId = definition.actionId;
    out.usesPerGeneration = 1;
  }
  return out;
}

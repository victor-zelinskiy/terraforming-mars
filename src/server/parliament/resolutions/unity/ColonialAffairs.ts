/*
 * COLONIAL AFFAIRS (Unity) — Turmoil Redux resolution RX07: the first card
 * that pays a player SEVERAL REWARDS OF DIFFERENT NATURES at one enactment
 * (a supply resource, a resource onto a card, a draw, a draw-then-discard),
 * one per colony tile the player has a cube on, every one of them a NUMBER
 * OF TIMES — and therefore the first whose steps are a PLAN PER PLAYER
 * (docs/TURMOIL_REDUX_COLONIAL_AFFAIRS.md).
 *
 * Printed: «Gain all your colony bonuses 2 times + 1/2 [influence]» —
 * «When enacted: Each player gains all of their colony bonuses 2 times + 1
 * extra time per 2 points of Influence they have.» Chairman quest: play 2
 * space tags. Requires Colonies, which Redux requires anyway.
 *
 * THE READINGS FIXED HERE:
 *  · THE MULTIPLIER k = 2 + ⌊influence / 2⌋, every participant's own
 *    (`COLONIAL_AFFAIRS_BONUSES` — `base: 2`, `perInfluence: 1`,
 *    `influenceStep: 2`); influence 1…5 reads 2, 3, 3, 4, 4. The winner's
 *    Agenda step has already moved when the effects pay (`ctx.influence`).
 *    There is no winner-only part: a neutral winner cancels nothing.
 *  · «A COLONY BONUS» is the tile's PRINTED colony bonus — what a cube's
 *    owner receives when somebody else trades there (`metadata.colony`,
 *    `IColony.colonyBonusGrant`) — never the trade income, never the build
 *    bonus. «ALL YOUR» is one per tile the player has a cube on (a player
 *    never holds two cubes on one tile), in the TABLE's order
 *    (`game.colonies`).
 *  · «k TIMES» — THE LAW OF MERGING: the k repeats of one bonus are ONE
 *    payout exactly when no decision and no new information stands between
 *    them. A supply gain (Luna 2 M€ ×k = 2k M€) merges; a resource onto a
 *    card (Titan 1 floater ×k) merges into ONE distribution of k units — k
 *    successive picks would allow exactly the same layouts; a plain draw
 *    (Miranda 1 card ×k) merges into ONE intake of k cards. Pluto's «draw 1,
 *    then discard 1» NEVER merges: the player must answer the discard before
 *    the next card is revealed (the reading the fork already fixed for a
 *    trade — `colonyBonusDiscardStep.ts`), so it is k PAIRS of two steps.
 *  · THE PLAN IS DETERMINISTIC over the game state it reads (the player's
 *    tiles, the influence) and NOTHING of it changes between the steps of
 *    one sitting (no colony is built inside the political phase), so a
 *    reload inside any step rebuilds the same plan and finds its own key:
 *    `colony:<tile>` for a merged bonus, `colony:<tile>:<n>:draw` /
 *    `:discard` for Pluto's pairs, `colonies` for the one step of a player
 *    with no colonies at all.
 *  · EVERY RECORD names its `colony` and carries `multiplier: k` beside its
 *    own unit — the ledger row it belongs to, and the number the contract
 *    guard checks against the declaration (`effect: 'colonyBonuses'`).
 *  · A COMMUNITY tile's benefit the chip language does not speak (Iapetus'
 *    discount, Titania's LOSS, Leavitt's paid reveal) is paid honestly
 *    through its own primitive and recorded as the general `colonyBonus`
 *    kind with the tile's printed description; a loss is a NEGATIVE amount,
 *    never a payout. Nothing is banked, converted or silent.
 *  · SKIPS NAME THEMSELVES WITH THEIR SIZE: no colonies → «×k colony
 *    bonuses: you have no colonies»; a resource onto a card with no holder →
 *    «k floaters: no card can hold floaters»; an empty deck as in Climate
 *    Research; an empty hand at Pluto's discard.
 *  · The chairman quest never counts any of it (the shared tracker refuses
 *    the political phase and any resolution source — decision Q5); MarsBot
 *    is not a participant and its cubes receive nothing.
 *
 * THE STEP CONTRACT (IResolution.ts): a step MUTATES or ASKS, never both —
 * the driver re-runs `run` on a reload to rebuild a pending prompt. The
 * merged supply / production / loss / discount steps mutate and report; the
 * distribution and the discard ASK and report inside the answer; the draws
 * are the one documented exception the shared intake makes safe (the cards
 * leave the deck at the enactment and sit in serialized game state until
 * taken, the prompt re-derived from it — `INTAKE_KEY` per step).
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {Size} from '../../../../common/cards/render/Size';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {Tag} from '../../../../common/cards/Tag';
import {Resource} from '../../../../common/Resource';
import {CardResource} from '../../../../common/CardResource';
import {ColonyName} from '../../../../common/colonies/ColonyName';
import {ColonyBonusShape, colonyBonusShape} from '../../../../common/parliament/colonyLedger';
import {ColonyTradeGrantModel} from '../../../../common/models/ColonyTradeManifestModel';
import {ChoiceContextSource} from '../../../../common/models/PlayerInputModel';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {sum} from '../../../../common/utils/utils';
import {IColony} from '../../../colonies/IColony';
import {IGame} from '../../../IGame';
import {IPlayer} from '../../../IPlayer';
import {message} from '../../../logs/MessageBuilder';
import {AddResourcesToCard} from '../../../deferredActions/AddResourcesToCard';
import {AddResourcesToCards} from '../../../deferredActions/AddResourcesToCards';
import {DiscardCards} from '../../../deferredActions/DiscardCards';
import {DrawCards} from '../../../deferredActions/DrawCards';
import {ExternalDrawIntake} from '../../../deferredActions/ExternalDrawIntake';
import type {Parliament} from '../../Parliament';
import {EnactContext, EnactOutcome, EnactStep, ResolutionDefinition} from '../IResolution';

export const COLONIAL_AFFAIRS_ID: ResolutionId = 'RDX_UNITY_COLONIAL_AFFAIRS';
export const COLONIAL_AFFAIRS_CODE: ResolutionCode = 'RX07';

/**
 * THE MULTIPLIER k — how many times every printed colony bonus is paid: 2
 * times + 1 more per 2 FULL points of influence, for every participant.
 * The unit is the multiplier itself; WHAT is multiplied is the seat's colony
 * ledger (`ParliamentPlayerModel.colonyBonuses`), which every surface reads.
 */
export const COLONIAL_AFFAIRS_BONUSES: InfluenceScaledEffect = {
  id: 'colonyBonuses',
  unit: {kind: 'colonyBonuses'},
  base: 2,
  perInfluence: 1,
  influenceStep: 2,
  recipient: 'each',
};

/** WHO asks — the same source on every pick, distribution, take and discard of the plan. */
const SOURCE: ChoiceContextSource = {kind: 'resolution', resolution: COLONIAL_AFFAIRS_ID};
const FROM = {resolution: COLONIAL_AFFAIRS_ID};

/** k for `influence` — the ONE formula (`scaledAmount` over the declaration). */
export function colonyBonusMultiplier(influence: number): number {
  return scaledAmount(COLONIAL_AFFAIRS_BONUSES, influence);
}

/** The step of a player with NO colonies — one named skip. */
export const NO_COLONIES_STEP_KEY = 'colonies';

/** The key of a MERGED bonus step (one per tile). */
export function colonyStepKey(colony: ColonyName): string {
  return `colony:${colony}`;
}

/** The key of one HALF of one REPEAT of a bonus that never merges (Pluto's pair n of k; Leavitt's reveal n of k). */
export function colonyRepeatStepKey(colony: ColonyName, n: number, half: 'draw' | 'discard' | 'reveal'): string {
  return `colony:${colony}:${n}:${half}`;
}

/** The tiles `player` has a cube on, in the TABLE's order (`game.colonies`). */
export function colonyTilesOf(player: IPlayer, game: IGame): Array<IColony> {
  return game.colonies.filter((colony) => colony.colonies.includes(player.id));
}

/**
 * WHAT A PRINTED COLONY BONUS BECOMES under ×k — the family table, stated
 * ONCE in the shared ledger module (`common/parliament/colonyLedger.ts`): the
 * plan below walks it, and the client's ledger reads the very same shapes.
 */
export type ColonyBonusStepShape = ColonyBonusShape;
export const colonyBonusStepShape = colonyBonusShape;

/** The SERVER's own skip reason for a card resource with no holder — the client's `noRecipientReasonKey` prints the same key. */
export function noHolderReason(resource: CardResource | undefined): string {
  switch (resource) {
  case CardResource.ANIMAL: return 'No card can hold animals';
  case CardResource.FLOATER: return 'No card can hold floaters';
  case CardResource.MICROBE: return 'No card can hold microbes';
  case CardResource.DATA: return 'No card can hold data';
  default: return 'No card can hold this resource';
  }
}

/** The pick / distribution titles — journal text only (the console reads the prompt's markers). */
function pickTitleOf(resource: CardResource, amount: number) {
  switch (resource) {
  case CardResource.FLOATER: return message('Add ${0} floater(s) to one of your cards', (b) => b.number(amount));
  case CardResource.MICROBE: return message('Add ${0} microbe(s) to one of your cards', (b) => b.number(amount));
  case CardResource.ANIMAL: return message('Add ${0} animal(s) to one of your cards', (b) => b.number(amount));
  default: return message('Add ${0} resource(s) to one of your cards', (b) => b.number(amount));
  }
}

function distributeTitleOf(resource: CardResource, amount: number) {
  switch (resource) {
  case CardResource.FLOATER: return message('Place ${0} floater(s) on your cards', (b) => b.number(amount));
  case CardResource.MICROBE: return message('Place ${0} microbe(s) on your cards', (b) => b.number(amount));
  case CardResource.ANIMAL: return message('Place ${0} animal(s) on your cards', (b) => b.number(amount));
  default: return message('Place ${0} resource(s) on your cards', (b) => b.number(amount));
  }
}

/** The state key under which the ONE announcement line of the player's whole effect is remembered. */
const ANNOUNCED_KEY = 'announced';

/** The intake a draw step opened, keyed by the step (the proof it already drew — the cards are game state). */
function intakeKey(stepKey: string): string {
  return `intake:${stepKey}`;
}

/** The fields EVERY record of the plan carries: the effect, the influence it was read at, k, and the tile. */
function recordedOf(ctx: EnactContext, colony: ColonyName | undefined): Pick<EnactOutcome, 'effect' | 'influence' | 'multiplier' | 'colony'> {
  return {
    effect: COLONIAL_AFFAIRS_BONUSES.id,
    influence: ctx.influence,
    multiplier: colonyBonusMultiplier(ctx.influence),
    ...(colony === undefined ? {} : {colony}),
  };
}

/** The ONE line of the whole effect for this player — logged by whichever step runs first, once. */
function announce(ctx: EnactContext): void {
  if (ctx.state[ANNOUNCED_KEY] === true) {
    return;
  }
  ctx.state[ANNOUNCED_KEY] = true;
  const k = colonyBonusMultiplier(ctx.influence);
  ctx.game.log('${0} gains all colony bonuses ${1} time(s) from ${2}: 2 + 1 per 2 points of influence, influence ${3}', (b) =>
    b.player(ctx.player).number(k).resolution(COLONIAL_AFFAIRS_ID).number(ctx.influence));
}

// ── the steps of the plan ─────────────────────────────────────────────────

/** A player with no cube anywhere: the whole effect is one named, sized skip. */
const NO_COLONIES_STEP: EnactStep = {
  key: NO_COLONIES_STEP_KEY,
  run(ctx) {
    announce(ctx);
    const k = colonyBonusMultiplier(ctx.influence);
    ctx.game.log('${0} has no colonies — nothing from ${1}', (b) => b.player(ctx.player).resolution(COLONIAL_AFFAIRS_ID));
    ctx.report({kind: 'skipped', ...recordedOf(ctx, undefined), amount: k, reason: 'You have no colonies'});
    return undefined;
  },
};

/** A supply gain ×k (Luna, Europa, Ceres, Io, Callisto, Triton, Ganymede; Hygiea, Kuiper, Mercury): ONE record of quantity × k. */
function stockStep(colony: IColony, grant: ColonyTradeGrantModel): EnactStep {
  return {
    key: colonyStepKey(colony.name),
    run(ctx) {
      announce(ctx);
      const player = ctx.player;
      const k = colonyBonusMultiplier(ctx.influence);
      const resource = grant.resource ?? Resource.MEGACREDITS;
      const amount = grant.quantity * k;
      const before = player.stock.get(resource);
      player.stock.add(resource, amount, {log: false, from: FROM});
      const after = player.stock.get(resource);
      ctx.game.log('${0} gained ${1} ${2}: the ${3} colony bonus ×${4} from ${5}', (b) =>
        b.player(player).number(amount).resource(resource).colony(colony).number(k).resolution(COLONIAL_AFFAIRS_ID));
      ctx.report({kind: 'stock', ...recordedOf(ctx, colony.name), stock: resource, amount, before, after});
      return undefined;
    },
  };
}

/** A production gain ×k (no base tile prints one as its colony bonus; the shape exists so a future tile pays through the same door). */
function productionStep(colony: IColony, grant: ColonyTradeGrantModel): EnactStep {
  return {
    key: colonyStepKey(colony.name),
    run(ctx) {
      announce(ctx);
      const player = ctx.player;
      const k = colonyBonusMultiplier(ctx.influence);
      const resource = grant.resource ?? Resource.MEGACREDITS;
      const amount = grant.quantity * k;
      const before = player.production.get(resource);
      player.production.add(resource, amount, {log: false, from: FROM});
      const after = player.production.get(resource);
      ctx.game.log('${0} raised ${1} production by ${2}: the ${3} colony bonus ×${4} from ${5}', (b) =>
        b.player(player).resource(resource).number(amount).colony(colony).number(k).resolution(COLONIAL_AFFAIRS_ID));
      ctx.report({kind: 'production', ...recordedOf(ctx, colony.name), production: resource, amount, before, after});
      return undefined;
    },
  };
}

/**
 * A resource onto a card ×k (Titan floaters, Enceladus microbes, Iapetus II
 * data): ONE distribution of k units over the player's holders through the
 * shared step (the layout with ≥ 2 holders, the family's ordinary pick with
 * one) — never k successive picks, which would allow exactly the same
 * layouts one question at a time.
 */
function cardResourceStep(colony: IColony, grant: ColonyTradeGrantModel): EnactStep {
  return {
    key: colonyStepKey(colony.name),
    run(ctx) {
      announce(ctx);
      const player = ctx.player;
      const k = colonyBonusMultiplier(ctx.influence);
      const resource = grant.cardResource;
      const owed = grant.quantity * k;
      if (resource === undefined || player.getResourceCards(resource).length === 0) {
        ctx.game.log('${0} has no card that can hold the ${1} colony bonus — ${2} resource(s) from ${3} are forfeited', (b) =>
          b.player(player).colony(colony).number(owed).resolution(COLONIAL_AFFAIRS_ID));
        ctx.report({kind: 'skipped', ...recordedOf(ctx, colony.name), ...(resource === undefined ? {} : {resource}), amount: owed, reason: noHolderReason(resource)});
        return undefined;
      }
      return new AddResourcesToCards(player, resource, owed, {
        autoSelect: false,
        cause: SOURCE,
        from: FROM,
        pickTitle: pickTitleOf(resource, owed),
        distributeTitle: distributeTitleOf(resource, owed),
      }).andThen((placed) => {
        const cards = placed.map((p) => ({card: p.card.name, amount: p.amount}));
        ctx.game.log('${0} placed ${1} resource(s): the ${2} colony bonus ×${3} from ${4}', (b) =>
          b.player(player).number(owed).colony(colony).number(k).resolution(COLONIAL_AFFAIRS_ID));
        ctx.report({
          kind: 'cardResource', ...recordedOf(ctx, colony.name), resource, amount: owed,
          ...(cards.length === 1 ? {card: cards[0].card} : {}),
          cards,
        });
        return undefined;
      }).execute();
    },
  };
}

/** A resource onto a VENUS card ×k (the community Venus tile): the family's pick over the Venus holders, k units onto the chosen one. */
function venusCardResourceStep(colony: IColony, grant: ColonyTradeGrantModel): EnactStep {
  return {
    key: colonyStepKey(colony.name),
    run(ctx) {
      announce(ctx);
      const player = ctx.player;
      const k = colonyBonusMultiplier(ctx.influence);
      const owed = grant.quantity * k;
      const holders = player.getResourceCards().filter((card) => card.tags.includes(Tag.VENUS));
      if (holders.length === 0) {
        ctx.game.log('${0} has no Venus card that can hold the ${1} colony bonus — ${2} resource(s) from ${3} are forfeited', (b) =>
          b.player(player).colony(colony).number(owed).resolution(COLONIAL_AFFAIRS_ID));
        ctx.report({kind: 'skipped', ...recordedOf(ctx, colony.name), amount: owed, reason: 'No Venus card can hold resources'});
        return undefined;
      }
      return new AddResourcesToCard(player, undefined, {
        count: owed,
        restrictedTag: Tag.VENUS,
        autoSelect: false,
        cause: SOURCE,
        from: FROM,
        title: message('Add ${0} resource(s) to one of your Venus cards', (b) => b.number(owed)),
      }).andThen((card) => {
        ctx.game.log('${0} placed ${1} resource(s): the ${2} colony bonus ×${3} from ${4}', (b) =>
          b.player(player).number(owed).colony(colony).number(k).resolution(COLONIAL_AFFAIRS_ID));
        ctx.report({
          kind: 'cardResource', ...recordedOf(ctx, colony.name),
          ...(card.resourceType === undefined ? {} : {resource: card.resourceType}),
          amount: owed, card: card.name, cards: [{card: card.name, amount: owed}],
        });
        return undefined;
      }).execute();
    },
  };
}

/**
 * THE DRAW HALF, shared by Miranda's merged draw (k cards, one intake) and
 * each of Pluto's pairs (one card): the shared intake takes the cards off the
 * deck at the enactment and withholds them until the mandatory take; a
 * reload inside the take re-derives the prompt from the intake (game state)
 * and draws nothing twice. An empty deck is named with the size it owed.
 */
function drawStep(colony: IColony, key: string, count: number, repeat?: {index: number, total: number}): EnactStep {
  return {
    key,
    run(ctx) {
      announce(ctx);
      const player = ctx.player;
      const remembered = ctx.state[intakeKey(key)];
      if (typeof remembered === 'number') {
        const pending = ExternalDrawIntake.pendingOf(player, remembered);
        return pending === undefined ? undefined : ExternalDrawIntake.takePromptFor(player, pending);
      }
      const intake = ExternalDrawIntake.open(player, count, {kind: 'resolution', resolution: COLONIAL_AFFAIRS_ID, effect: COLONIAL_AFFAIRS_BONUSES.id});
      if (intake === undefined) {
        ctx.report({kind: 'skipped', ...recordedOf(ctx, colony.name), amount: count, drawn: 0, reason: 'The project deck is empty'});
        return undefined;
      }
      ctx.state[intakeKey(key)] = intake.id;
      if (repeat === undefined) {
        ctx.game.log('${0} draws ${1} card(s): the ${2} colony bonus ×${3} from ${4}', (b) =>
          b.player(player).number(intake.count).colony(colony).number(colonyBonusMultiplier(ctx.influence)).resolution(COLONIAL_AFFAIRS_ID));
      } else {
        ctx.game.log('${0} draws 1 card: the ${1} colony bonus, ${2} of ${3}, from ${4}', (b) =>
          b.player(player).colony(colony).number(repeat.index).number(repeat.total).resolution(COLONIAL_AFFAIRS_ID));
      }
      if (intake.count < count) {
        ctx.game.log('Only ${0} of ${1} card(s) were left in the deck for ${2}', (b) => b.number(intake.count).number(count).player(player));
      }
      ctx.report({kind: 'cards', ...recordedOf(ctx, colony.name), amount: count, drawn: intake.count, intake: intake.id});
      return ExternalDrawIntake.takePromptFor(player, intake);
    },
  };
}

/**
 * THE DISCARD HALF of one of Pluto's pairs: the shared discard from hand,
 * marked with the resolution as its source and with the tile and the pair's
 * position (`colonyRepeat`) — the sitting hosts it as its own step; the
 * card drawn a step earlier is already in the hand among the candidates. A
 * hand of one card (or none) is decided by the rule itself, and an empty
 * hand is a named skip.
 */
function discardStep(colony: IColony, key: string, repeat: {index: number, total: number}): EnactStep {
  return {
    key,
    run(ctx) {
      announce(ctx);
      const player = ctx.player;
      if (player.cardsInHand.length === 0) {
        ctx.game.log('${0} has no card in hand to discard for the ${1} colony bonus from ${2}', (b) =>
          b.player(player).colony(colony).resolution(COLONIAL_AFFAIRS_ID));
        ctx.report({kind: 'skipped', ...recordedOf(ctx, colony.name), amount: 0, reason: 'No cards in hand to discard'});
        return undefined;
      }
      return new DiscardCards(player, 1, 1,
        message('Discard 1 card: the ${0} colony bonus, ${1} of ${2}, from ${3}', (b) =>
          b.colony(colony).number(repeat.index).number(repeat.total).resolution(COLONIAL_AFFAIRS_ID)),
        {source: SOURCE, colonyRepeat: {colonyName: colony.name, index: repeat.index, total: repeat.total}})
        .andThen((discards) => {
          const card = discards[0];
          ctx.game.log('${0} discarded 1 card: the ${1} colony bonus, ${2} of ${3}, from ${4}', (b) =>
            b.player(player).colony(colony).number(repeat.index).number(repeat.total).resolution(COLONIAL_AFFAIRS_ID));
          ctx.report({kind: 'discard', ...recordedOf(ctx, colony.name), amount: discards.length, ...(card === undefined ? {} : {card: card.name})});
          return undefined;
        }).execute();
    },
  };
}

/**
 * ONE PAID REVEAL (Leavitt's «reveal 1 card which you may pay to keep»), n of
 * k — a decision each time, so never merged. Paid through the engine's own
 * primitive (the same `DrawCards.keepSome` a Leavitt trade bonus uses), the
 * resolution as the pick's source; the record is the general colony bonus
 * with the tile's printed description.
 */
function revealBuyStep(colony: IColony, grant: ColonyTradeGrantModel, key: string, repeat: {index: number, total: number}): EnactStep {
  return {
    key,
    run(ctx) {
      announce(ctx);
      const player = ctx.player;
      DrawCards.keepSome(player, grant.quantity, {paying: true, logDrawnCard: true, promptSource: SOURCE}).execute();
      ctx.game.log('${0} reveals a card to keep for its cost: the ${1} colony bonus, ${2} of ${3}, from ${4}', (b) =>
        b.player(player).colony(colony).number(repeat.index).number(repeat.total).resolution(COLONIAL_AFFAIRS_ID));
      ctx.report({kind: 'colonyBonus', ...recordedOf(ctx, colony.name), amount: grant.quantity, description: colony.metadata.colony.description});
      return undefined;
    },
  };
}

/** A LOSS ×k (Titania's «lose 3 M€»): a negative record — a loss is never a payout; nothing to lose is a named skip. */
function lossStep(colony: IColony, grant: ColonyTradeGrantModel): EnactStep {
  return {
    key: colonyStepKey(colony.name),
    run(ctx) {
      announce(ctx);
      const player = ctx.player;
      const k = colonyBonusMultiplier(ctx.influence);
      const resource = grant.resource ?? Resource.MEGACREDITS;
      const before = player.stock.get(resource);
      const lost = Math.min(before, grant.quantity * k);
      if (lost <= 0) {
        ctx.report({kind: 'skipped', ...recordedOf(ctx, colony.name), stock: resource, amount: 0, reason: 'Nothing to lose'});
        return undefined;
      }
      player.stock.deduct(resource, lost, {log: false, from: FROM});
      const after = player.stock.get(resource);
      ctx.game.log('${0} lost ${1} ${2}: the ${3} colony bonus ×${4} from ${5}', (b) =>
        b.player(player).number(lost).resource(resource).colony(colony).number(k).resolution(COLONIAL_AFFAIRS_ID));
      ctx.report({kind: 'colonyBonus', ...recordedOf(ctx, colony.name), stock: resource, amount: -lost, before, after, description: colony.metadata.colony.description});
      return undefined;
    },
  };
}

/** A card DISCOUNT ×k (Iapetus' «pay 1 M€ less for cards this generation»): the discount counter, the general colony bonus record. */
function discountStep(colony: IColony): EnactStep {
  return {
    key: colonyStepKey(colony.name),
    run(ctx) {
      announce(ctx);
      const player = ctx.player;
      const k = colonyBonusMultiplier(ctx.influence);
      player.colonies.cardDiscount += k;
      ctx.game.log('Cards played by ${0} cost ${1} M€ less this generation: the ${2} colony bonus ×${3} from ${4}', (b) =>
        b.player(player).number(k).colony(colony).number(k).resolution(COLONIAL_AFFAIRS_ID));
      ctx.report({kind: 'colonyBonus', ...recordedOf(ctx, colony.name), amount: k, description: colony.metadata.colony.description});
      return undefined;
    },
  };
}

/** M€ per 3 Earth tags in play ×k (Terra) — a supply gain computed the way the tile's own trade bonus computes it. */
function mcPerEarthTagsStep(colony: IColony): EnactStep {
  return {
    key: colonyStepKey(colony.name),
    run(ctx) {
      announce(ctx);
      const player = ctx.player;
      const game = ctx.game;
      const k = colonyBonusMultiplier(ctx.influence);
      const tags = sum(game.players.map((p) => p.tags.count(Tag.EARTH, p.id === player.id ? 'default' : 'raw')));
      const perTime = Math.floor(tags / 3);
      const amount = perTime * k;
      if (amount <= 0) {
        ctx.report({kind: 'skipped', ...recordedOf(ctx, colony.name), stock: Resource.MEGACREDITS, amount: 0, reason: 'Fewer than 3 Earth tags in play'});
        return undefined;
      }
      const before = player.megaCredits;
      player.stock.add(Resource.MEGACREDITS, amount, {log: false, from: FROM});
      ctx.game.log('${0} gained ${1} M€: the ${2} colony bonus ×${3} from ${4} (${5} Earth tags in play)', (b) =>
        b.player(player).number(amount).colony(colony).number(k).resolution(COLONIAL_AFFAIRS_ID).number(tags));
      ctx.report({kind: 'stock', ...recordedOf(ctx, colony.name), stock: Resource.MEGACREDITS, amount, before, after: player.megaCredits});
      return undefined;
    },
  };
}

/** M€ per hazard tile on Mars ×k (Deimos) — a supply gain, or a named skip when Mars has no hazard. */
function mcPerHazardStep(colony: IColony): EnactStep {
  return {
    key: colonyStepKey(colony.name),
    run(ctx) {
      announce(ctx);
      const player = ctx.player;
      const k = colonyBonusMultiplier(ctx.influence);
      const hazards = ctx.game.board.getHazards().length;
      const amount = hazards * k;
      if (amount <= 0) {
        ctx.report({kind: 'skipped', ...recordedOf(ctx, colony.name), stock: Resource.MEGACREDITS, amount: 0, reason: 'No hazard tiles on Mars'});
        return undefined;
      }
      const before = player.megaCredits;
      player.stock.add(Resource.MEGACREDITS, amount, {log: false, from: FROM});
      ctx.game.log('${0} gained ${1} M€: the ${2} colony bonus ×${3} from ${4} (${5} hazard tiles)', (b) =>
        b.player(player).number(amount).colony(colony).number(k).resolution(COLONIAL_AFFAIRS_ID).number(hazards));
      ctx.report({kind: 'stock', ...recordedOf(ctx, colony.name), stock: Resource.MEGACREDITS, amount, before, after: player.megaCredits});
      return undefined;
    },
  };
}

/** A benefit no tile of the pool prints as its colony bonus — named, never thrown, never silent. */
function unsupportedStep(colony: IColony): EnactStep {
  return {
    key: colonyStepKey(colony.name),
    run(ctx) {
      announce(ctx);
      ctx.game.log('The ${0} colony bonus cannot be paid by ${1} — skipped', (b) => b.colony(colony).resolution(COLONIAL_AFFAIRS_ID));
      ctx.report({kind: 'skipped', ...recordedOf(ctx, colony.name), amount: 0, reason: 'This colony bonus is not paid by a resolution'});
      return undefined;
    },
  };
}

/** The steps ONE tile's printed bonus becomes under ×k — the family table applied. */
export function colonyBonusStepsOf(colony: IColony, k: number): Array<EnactStep> {
  const grant = colony.colonyBonusGrant();
  switch (colonyBonusStepShape(grant.benefit)) {
  case 'stock': return [stockStep(colony, grant)];
  case 'production': return [productionStep(colony, grant)];
  case 'cardResource': return [cardResourceStep(colony, grant)];
  case 'venusCardResource': return [venusCardResourceStep(colony, grant)];
  case 'draw': return [drawStep(colony, colonyStepKey(colony.name), grant.quantity * k)];
  case 'drawDiscard': {
    // k PAIRS — the next card is never revealed before the previous discard is answered.
    const out: Array<EnactStep> = [];
    for (let n = 1; n <= k; n++) {
      const repeat = {index: n, total: k};
      out.push(drawStep(colony, colonyRepeatStepKey(colony.name, n, 'draw'), grant.quantity, repeat));
      out.push(discardStep(colony, colonyRepeatStepKey(colony.name, n, 'discard'), repeat));
    }
    return out;
  }
  case 'revealBuy': {
    const out: Array<EnactStep> = [];
    for (let n = 1; n <= k; n++) {
      out.push(revealBuyStep(colony, grant, colonyRepeatStepKey(colony.name, n, 'reveal'), {index: n, total: k}));
    }
    return out;
  }
  case 'loss': return [lossStep(colony, grant)];
  case 'discount': return [discountStep(colony)];
  case 'mcPerEarthTags': return [mcPerEarthTagsStep(colony)];
  case 'mcPerHazard': return [mcPerHazardStep(colony)];
  case 'unsupported': return [unsupportedStep(colony)];
  }
}

/**
 * THE PLAN FOR ONE PLAYER: one step (or k pairs) per tile the player has a
 * cube on, in the table's order; a player with no cube at all gets the one
 * named skip. Deterministic over the table and the influence — the driver
 * asks for it on every entry and a reload finds the same keys.
 */
export function colonyBonusSteps(player: IPlayer, parliament: Parliament, game: IGame): ReadonlyArray<EnactStep> {
  const tiles = colonyTilesOf(player, game);
  if (tiles.length === 0) {
    return [NO_COLONIES_STEP];
  }
  const k = colonyBonusMultiplier(parliament.influence(player));
  return tiles.flatMap((tile) => colonyBonusStepsOf(tile, k));
}

export const COLONIAL_AFFAIRS: ResolutionDefinition = {
  id: COLONIAL_AFFAIRS_ID,
  code: COLONIAL_AFFAIRS_CODE,
  module: 'turmoilRedux',
  party: PartyName.UNITY,
  copies: 1,
  // THE FACE, as printed: the rule in words on one row («gain all your colony
  // bonuses»), the multiplier on the next — «2 times + 1 / 2 [influence]»:
  // the slash reads «per», the influence badge is the same asset the vote
  // surface and the Agenda readout print.
  renderData: CardRenderer.builder((b) => {
    b.text('Gain all your colony bonuses', Size.SMALL, true).br;
    b.text('2 times', Size.MEDIUM, true).plus().text('1', Size.MEDIUM, false, true).slash().text('2', Size.MEDIUM, false, true).influence();
  }),
  text: {
    name: 'Colonial Affairs',
    effect: 'Gain all your colony bonuses 2 times, plus 1 more time per 2 influence.',
    quest: 'Play 2 space tags',
  },
  quest: {goal: {kind: 'tag', tag: Tag.SPACE}, count: 2},
  scaled: [COLONIAL_AFFAIRS_BONUSES],
  immediateStepsFor: colonyBonusSteps,
};

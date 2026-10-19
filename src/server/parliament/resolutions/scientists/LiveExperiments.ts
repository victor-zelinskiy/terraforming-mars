/*
 * LIVE EXPERIMENTS (the Scientists) — Turmoil Redux resolution RX36: the first
 * action whose result is a whole CARD PLAY. RX28 made an action that COSTS
 * something; this one costs 6 M€ and then hands the seat the play of a card
 * from its hand with every global requirement set aside
 * (docs/TURMOIL_REDUX_LIVE_EXPERIMENTS.md).
 *
 * Printed: «When enacted: Gain data resources equal to your Influence.
 * Action: Pay 6 M€ to play a card ignoring all global parameter
 * requirements.» Chairman quest: play 2 cards with a requirement (the
 * footnote's yellow MIN plate ×2 — the spec's `Q-4`, closed by this card).
 *
 * THE READINGS FIXED HERE:
 *  · DATA AT THE ENACTMENT — Diverted Research's step one for one: 1 data
 *    per point of influence onto ONE card that can hold data (`autoSelect:
 *    false`), the zero NAMED, influence without a holder NAMED with its size
 *    and forfeited. The bot holds no seat at an enactment.
 *  · THE PRICE IS ONE FUNCTION. The bill is declared as data (`actionBill`:
 *    6 M€, nothing off for influence, no titanium) and priced by the
 *    family's `actionBillPrice` — 6 at every influence, stated honestly as a
 *    declaration, never a special case.
 *  · PAY, THEN PLAY — the family's paid funnel (`runPaidResolutionAction`):
 *    the use is recorded when the bill is SETTLED, never when the menu is
 *    built. The bill's settlement ARMS the law's waiver
 *    (`IPlayer.armedLawWaiver` — decision Р3) and queues the play of a card
 *    from hand (`PlayProjectCard`, the card and its own payment in ONE
 *    answer), the candidates read with the waiver already standing.
 *  · «PLAY A CARD» is an ordinary play of a PROJECT card from the hand: its
 *    own price is paid on top of the 6, its tags, its effects, the table's
 *    reactions are those of any play; the card goes to the table or the
 *    events pile. Never free, never from the deck, never a standard project.
 *  · «IGNORING ALL GLOBAL PARAMETER REQUIREMENTS» is the TR49 class's waiver
 *    (rule 3): every `GlobalParameterRequirement` — temperature, oxygen,
 *    oceans, Venus, MIN and MAX — is MET, never stretched; Think Tank / Aeron
 *    spend nothing on it. A tag, a production, the rating, cities /
 *    colonies / resources, a PARTY and the chairman are never waived.
 *  · THE WAIVER IS AN ARMED EFFECT OF THE LAW (decision Р3): serialized, read
 *    by the one waiver function (`IPlayer.globalRequirementWaiver`) before
 *    the table, published as a `requirementWaiver` with the law as its
 *    source, SPENT by the next card played by any road, lost on the pass. A
 *    reload between the bill and the pick therefore loses nothing: the 6 M€
 *    are paid, the waiver stands armed, the next ordinary play spends it.
 *    Beside an armed TR49 / Special Design both stand and one play spends
 *    both.
 *  · UNAVAILABLE WITH A REASON, never hidden: not enough to pay — the price
 *    NAMED with what the seat can put toward it; no card in hand the waiver
 *    would let the seat play AFTER the 6 M€ (the probe — the law armed for
 *    the length of the question, the bill held back as a reserve, the
 *    Merchant precedent); a spent use and a seat outside the parliament are
 *    the family's. FUTILITY (decision Р4 — information, never a block): when
 *    every card it would let through is playable without it, the action is
 *    «without effect» — the waiver opens nothing.
 *  · DECISION Q5: the card played THROUGH the law is under the resolution's
 *    source and counts toward no quest — this law's own included («2 cards
 *    with a requirement» is closed by ordinary plays).
 *  · THE QUEST is the tenth kind, `cardsWithRequirement` (decision Р2): a
 *    project card printing AT LEAST ONE requirement of any kind (the MIN /
 *    MAX plate exists) — reported by the ONE play report, never a second.
 *  · No `compatibility`: data is a base resource of this fork and global
 *    requirements exist in every game.
 *
 * THE STEP CONTRACT (IResolution.ts): the one enactment step MUTATES or ASKS,
 * never both — the amount is fixed in `ctx.state` the first time, and every
 * mutation happens inside the prompt's own callback.
 */
import {CardRenderer} from '../../../cards/render/CardRenderer';
import {PartyName} from '../../../../common/turmoil/PartyName';
import {CardResource} from '../../../../common/CardResource';
import {Units} from '../../../../common/Units';
import {ResolutionCode, ResolutionId} from '../../../../common/parliament/ParliamentTypes';
import {InfluenceScaledEffect, scaledAmount} from '../../../../common/parliament/influenceScaling';
import {ActionBillPrice, actionBillPrice, ResolutionActionBill} from '../../../../common/parliament/actionBill';
import {ChoiceContextSource} from '../../../../common/models/PlayerInputModel';
import {ActionEffect} from '../../../../common/models/ActionPreviewModel';
import {ActionFutilityVerdict} from '../../../../common/models/ActionFutilityModel';
import {message} from '../../../logs/MessageBuilder';
import {SelectOption} from '../../../inputs/SelectOption';
import {AddResourcesToCard} from '../../../deferredActions/AddResourcesToCard';
import {PlayProjectCard} from '../../../deferredActions/PlayProjectCard';
import {IProjectCard} from '../../../cards/IProjectCard';
import {IPlayer} from '../../../IPlayer';
import {requirementEasingOf} from '../../../models/requirementEasing';
import {unplayableReasons as computeUnplayableReasons} from '../../../models/unplayableReasons';
import {cardsToModel} from '../../../models/ModelUtils';
import {SelectProjectCardToPlay} from '../../../inputs/SelectProjectCardToPlay';
import {SelectPaymentDeferred} from '../../../deferredActions/SelectPaymentDeferred';
import {ResolutionPlayModel} from '../../../../common/models/ParliamentModel';
import {EnactStep, ResolutionAction, ResolutionDefinition} from '../IResolution';
import {runPaidResolutionAction} from '../ResolutionAction';

export const LIVE_EXPERIMENTS_ID: ResolutionId = 'RDX_SCIENTISTS_LIVE_EXPERIMENTS';
export const LIVE_EXPERIMENTS_CODE: ResolutionCode = 'RX36';
/** The printed bill: 6 M€, nothing off for influence, no titanium. */
export const LIVE_EXPERIMENTS_BILL: ResolutionActionBill = {amount: 6, discountPerInfluence: 0, titanium: false};
/** Once per generation, as every action of the Parliament. */
export const LIVE_EXPERIMENTS_USES_PER_GENERATION = 1;
/** The printed «2 [MIN plate]» — the chairman quest's count. */
export const LIVE_EXPERIMENTS_QUEST_CARDS = 2;

/** THE FORMULA: 1 data per point of influence, onto ONE card, for every participant — Diverted Research's row. */
export const LIVE_EXPERIMENTS_DATA: InfluenceScaledEffect = {
  id: 'data',
  unit: {kind: 'cardResource', resources: [CardResource.DATA]},
  perInfluence: 1,
  recipient: 'each',
};

/** The action's own gates. */
export const LIVE_EXPERIMENTS_UNAFFORDABLE_KEY = 'Need ${0} M€ for this action, you can pay ${1}';
export const LIVE_EXPERIMENTS_NO_CARD_REASON = 'No card in hand this would let you play';
/** The futility verdict's words (decision Р4 — information, never a block). */
export const LIVE_EXPERIMENTS_FUTILE_REASON = 'Every playable card is playable without it';
/** The enactment's forfeited share — the family's own sentence (Diverted Research). */
export const LIVE_EXPERIMENTS_NO_HOLDER_REASON = 'No card can hold data';

/** WHO asks — the same source on the enactment's picker, the menu option, the bill and the card pick. */
const SOURCE: ChoiceContextSource = {kind: 'resolution', resolution: LIVE_EXPERIMENTS_ID};

/** The state key the data step fixes its amount under (see the contract above). */
const DATA_OWED_KEY = 'dataOwed';

/** THE PRICE for this seat, right now — 6 at every influence (the bill declares no discount). */
export function liveExperimentsPrice(player: IPlayer): ActionBillPrice {
  return actionBillPrice(LIVE_EXPERIMENTS_BILL, player.game.parliament?.influence(player) ?? 0);
}

/**
 * THE BILL HELD BACK while a card is priced (the probe): the M€ first, and
 * what the seat's own M€ cannot cover in the M€-like pockets the bill may
 * really be paid from — Helion's heat, then Luna Trade Federation's titanium
 * (never steel / titanium for a project card: this bill takes none). The
 * reserve the engine's ONE affordability check reads (`PlayabilityOptions.reserve`).
 */
export function liveExperimentsReserve(player: IPlayer, amount: number): Partial<Units> {
  const megacredits = Math.min(amount, Math.max(0, player.megaCredits));
  let rest = amount - megacredits;
  const reserve: Partial<Units> = {megacredits};
  if (rest > 0 && player.canUseHeatAsMegaCredits) {
    const heat = Math.min(rest, player.availableHeat());
    reserve.heat = heat;
    rest -= heat;
  }
  if (rest > 0 && player.canUseTitaniumAsMegacredits) {
    // Luna's titanium pays at its value less one (`Player.spendableMegacredits`'s own reading).
    const value = Math.max(1, player.getTitaniumValue() - 1);
    reserve.titanium = Math.min(player.titanium, Math.ceil(rest / value));
  }
  return reserve;
}

/**
 * THE PROBE: `fn` asked with the LAW's waiver armed for the length of the
 * question (`IPlayer.temporaryGlobalRequirementWaiver` — Ecology Experts'
 * probe, widened to a law), restored in `finally`. Every reading of «what
 * would this law let me play» stands on it — the gate, the futility verdict,
 * the console's candidates, a candidate's play preview — so none of them can
 * disagree with the waiver the play will meet. Read-only: the hand's play
 * stamps (warnings, Think Tank costs) the question re-derived are re-derived
 * once more for the live state before returning.
 */
export function withLiveExperimentsProbe<T>(player: IPlayer, fn: () => T): T {
  const prior = player.temporaryGlobalRequirementWaiver;
  player.temporaryGlobalRequirementWaiver = {resolution: LIVE_EXPERIMENTS_ID};
  try {
    return fn();
  } finally {
    player.temporaryGlobalRequirementWaiver = prior;
    player.getPlayableCards();
  }
}

/**
 * The cards THIS seat could play through the law right now: playable with the
 * waiver armed AFTER the bill is paid (the reserve), each with whether the law
 * is what lets it through (`opened` — a global requirement met ONLY thanks to
 * the waiver, the TR49 class's `decisive`). Read-only (the probe).
 */
export function liveExperimentsCandidates(player: IPlayer): Array<{card: IProjectCard, opened: boolean}> {
  const price = liveExperimentsPrice(player).price;
  return withLiveExperimentsProbe(player, () => player.getPlayableCards({reserve: liveExperimentsReserve(player, price)})
    .map((card) => ({card, opened: requirementEasingOf(player, card).some((easing) => easing.decisive)})));
}

/** The reason a hand card the law does NOT let through stands refused for — when its own reasons say nothing (the bill's reserve). */
export const LIVE_EXPERIMENTS_AFTER_BILL_KEY = 'Not enough M€ left after the ${0} M€ of the action';

/**
 * THE PICK THE ACTION PROMISES (decision Р5 — the console pre-collects it):
 * the live `SelectProjectCardToPlay` the bill's settlement raises, in its own
 * shape — EVERY hand card (and every Self-replicating Robots card the play
 * could reach), the law's candidates enabled, the rest disabled with their
 * reason (the card's own requirement reasons read with the waiver standing —
 * a party requirement stays refused; the bill's reserve named where nothing
 * else explains it), each card's requirement read through the class's one
 * model (`requirementEasing` names the law). Read-only (the probe).
 */
export function liveExperimentsPlayModel(player: IPlayer): ResolutionPlayModel {
  const price = liveExperimentsPrice(player).price;
  const billAsks = new SelectPaymentDeferred(player, price, {canUseTitanium: LIVE_EXPERIMENTS_BILL.titanium}).previewPaymentModel() !== undefined;
  const input = withLiveExperimentsProbe(player, () => {
    const playable = new Set(player.getPlayableCards({reserve: liveExperimentsReserve(player, price)}).map((card) => card.name));
    const cards: Array<IProjectCard> = [...player.cardsInHand];
    for (const target of player.getSelfReplicatingRobotsTargetCards()) {
      if (!cards.includes(target)) {
        cards.push(target);
      }
    }
    const enabled = cards.map((card) => playable.has(card.name));
    // A card refused ONLY by the bill held back has no reason of its own (its own check passes without the bill):
    // it is NAMED — the law's 6 in words, and the shortfall structurally (the hand's own «need N more M€» reason).
    const billOnly = cards.map((card, i) => !enabled[i] && computeUnplayableReasons(player, card).length === 0);
    const disabledReasons = cards.map((_card, i) => billOnly[i] ? message(LIVE_EXPERIMENTS_AFTER_BILL_KEY, (b) => b.number(price)) : undefined);
    const select = new SelectProjectCardToPlay(player, cards, {enabled});
    const model = select.toModel(player);
    model.cards = cardsToModel(player, cards, {showCalculatedCost: true, extras: select.extras, enabled, disabledReasons, unplayableReasons: true})
      .map((card, i) => {
        if (!billOnly[i]) {
          return card;
        }
        const deficit = player.affordabilityDeficitFor(player.affordOptionsForCard(cards[i], {reserve: liveExperimentsReserve(player, price)}));
        return {...card, unplayableReasons: [{type: 'megacredits', message: 'Need ${0} more M€', params: [String(Math.max(1, deficit))]}]};
      });
    return model;
  });
  return {input, reserve: price, billAsks};
}

/** The law's verdict when it would OPEN nothing — every card it lets through is playable without it (decision Р4). */
export function liveExperimentsFutility(player: IPlayer): ActionFutilityVerdict | undefined {
  const candidates = liveExperimentsCandidates(player);
  if (candidates.length === 0 || candidates.some((c) => c.opened)) {
    return undefined;
  }
  return {kind: 'zero-yield', reason: LIVE_EXPERIMENTS_FUTILE_REASON};
}

/**
 * ARM THE LAW'S WAIVER — the bill is settled: the next card this seat plays
 * this generation ignores its global requirements. One field, one journal line.
 */
export function armLiveExperimentsWaiver(player: IPlayer, price: ActionBillPrice): void {
  player.armedLawWaiver = LIVE_EXPERIMENTS_ID;
  player.game.log('${0} paid ${1} M€ to ${2}: the next card played ignores its global requirements', (b) =>
    b.player(player).number(price.price).resolution(LIVE_EXPERIMENTS_ID));
}

const DATA_STEP: EnactStep = {
  key: 'data',
  run(ctx) {
    const player = ctx.player;
    const remembered = ctx.state[DATA_OWED_KEY];
    const owed = typeof remembered === 'number' ? remembered : scaledAmount(LIVE_EXPERIMENTS_DATA, ctx.influence);
    ctx.state[DATA_OWED_KEY] = owed;
    if (owed <= 0) {
      ctx.game.log('${0} has no influence — no data from ${1}', (b) => b.player(player).resolution(LIVE_EXPERIMENTS_ID));
      ctx.report({kind: 'skipped', effect: LIVE_EXPERIMENTS_DATA.id, resource: CardResource.DATA, amount: 0, influence: ctx.influence, reason: 'No influence'});
      return undefined;
    }
    const cards = player.getResourceCards(CardResource.DATA);
    if (cards.length === 0) {
      ctx.game.log('${0} has no card that can hold data — ${1} data from ${2} are forfeited', (b) =>
        b.player(player).number(owed).resolution(LIVE_EXPERIMENTS_ID));
      ctx.report({kind: 'skipped', effect: LIVE_EXPERIMENTS_DATA.id, resource: CardResource.DATA, amount: owed, influence: ctx.influence, reason: LIVE_EXPERIMENTS_NO_HOLDER_REASON});
      return undefined;
    }
    // THE SHARED PICKER (Aquifer Contest's): the candidates, the «current →
    // resulting» and VP readings and the source dock all come from it;
    // `autoSelect: false` is the «to ANY card» law of this fork.
    return new AddResourcesToCard(player, CardResource.DATA, {
      count: owed,
      autoSelect: false,
      title: message('Add ${0} data to one of your cards', (b) => b.number(owed)),
      cause: SOURCE,
      from: {resolution: LIVE_EXPERIMENTS_ID},
    }).andThen((card) => {
      ctx.report({kind: 'cardResource', effect: LIVE_EXPERIMENTS_DATA.id, resource: CardResource.DATA, amount: owed, card: card.name, influence: ctx.influence});
    }).execute();
  },
};

const LIVE_EXPERIMENTS_ACTION: ResolutionAction = {
  usesPerGeneration: () => LIVE_EXPERIMENTS_USES_PER_GENERATION,
  canAct(player) {
    const {price} = liveExperimentsPrice(player);
    // The engine's own affordability (the bill takes no titanium) — the reason names the price and the seat's means.
    if (price > 0 && !player.canAfford({cost: price, titanium: LIVE_EXPERIMENTS_BILL.titanium})) {
      return {available: false, reason: message(LIVE_EXPERIMENTS_UNAFFORDABLE_KEY, (b) => b.number(price).number(player.spendableMegacredits()))};
    }
    if (liveExperimentsCandidates(player).length === 0) {
      return {available: false, reason: LIVE_EXPERIMENTS_NO_CARD_REASON};
    }
    return {available: true};
  },
  // THE COMMIT CONTRACT: building the prompt changes nothing; the answer
  // DEFERS THE BILL, and the bill's settlement is the commit (the use, the
  // armed waiver, the card pick). The candidates of the pick are read AFTER
  // the bill, with the waiver already standing — nothing temporary there.
  execute(player, parliament, meta) {
    const price = liveExperimentsPrice(player);
    return new SelectOption(
      message('Pay ${0} M€ to play a card ignoring global requirements (Live Experiments)', (b) => b.number(price.price)),
      'Play card')
      .withMetadata({kind: 'generic', icon: 'megacredits', amount: price.price, effects: LIVE_EXPERIMENTS_ACTION.preview(player)})
      .markChoiceContext({source: SOURCE, trigger: 'Resolution action', mode: 'effect-choice'})
      .markResolutionActionPrompt(meta)
      .andThen(() => {
        const bill = liveExperimentsPrice(player);
        runPaidResolutionAction(player, parliament, LIVE_EXPERIMENTS_ID, {
          amount: bill.price,
          canUseTitanium: LIVE_EXPERIMENTS_BILL.titanium,
          title: message('Select how to pay ${0} M€ for Live Experiments', (b) => b.number(bill.price)),
          meta,
        }, () => {
          armLiveExperimentsWaiver(player, bill);
          player.game.defer(new PlayProjectCard(player, {
            context: {source: SOURCE, trigger: 'Resolution action', mode: 'effect-choice'},
            resolutionAction: {...meta, stage: 'play'},
            title: 'Play a card ignoring its global requirements (Live Experiments)',
          })).andThen((card) => {
            if (card === undefined) {
              // Something else spent the seat's money between the bill and the
              // pick: the play is NAMED, the waiver stays armed (paid = owed).
              player.game.log('${0} has no card to play with ${1} — the paid waiver stays armed for the next card', (b) =>
                b.player(player).resolution(LIVE_EXPERIMENTS_ID));
            }
          });
        });
        return undefined;
      });
  },
  // THE PRICE AS THE SEAT SEES IT, and what it buys stated as its note — the
  // action pays no chip of its own (the CARD it plays does: a different
  // result for every candidate, unknown until one is chosen). Without a seat
  // (the manifest) — the printed sum.
  preview(player) {
    const price = player === undefined ? actionBillPrice(LIVE_EXPERIMENTS_BILL, 0) : liveExperimentsPrice(player);
    const cost: ActionEffect = {direction: 'cost', icon: 'megacredits', amount: price.price, note: 'then play a card ignoring global requirements'};
    if (player !== undefined) {
      const current = player.spendableMegacredits();
      cost.current = current;
      cost.resulting = Math.max(0, current - price.price);
    }
    return [cost];
  },
  futility: liveExperimentsFutility,
  playModel: liveExperimentsPlayModel,
  withPlayProbe: withLiveExperimentsProbe,
};

export const LIVE_EXPERIMENTS: ResolutionDefinition = {
  id: LIVE_EXPERIMENTS_ID,
  code: LIVE_EXPERIMENTS_CODE,
  module: 'turmoilRedux',
  party: PartyName.SCIENTISTS,
  copies: 1,
  // THE FACE as printed: the per-influence formula on its own row («[data] /
  // [influence]»), then the ACTION — «6 M€ → GLOBAL REQS.» struck by the red
  // diagonal with its asterisk: upstream's printed «ignore global
  // requirements» glyph (`projectRequirements()`, the one TR49 and Ecology
  // Experts print), which both renderers already draw.
  renderData: CardRenderer.builder((b) => {
    b.resource(CardResource.DATA).slash().influence().br;
    b.action(undefined, (ab) => ab.megacredits(LIVE_EXPERIMENTS_BILL.amount).startAction.projectRequirements().asterix());
  }),
  text: {
    name: 'Live Experiments',
    effect: 'Add 1 data resource per point of your influence to one of your cards.',
    // The per-generation limit is structural (`usesPerGeneration`), never a
    // clause of the sentence — every surface prints it beside the live uses.
    action: 'Pay 6 M€ to play a card from your hand ignoring all its global parameter requirements.',
    quest: 'Play 2 cards with a requirement',
  },
  // A PROJECT card printing at least one requirement of any kind (decision Р2) — the tenth quest kind.
  quest: {goal: {kind: 'cardsWithRequirement'}, count: LIVE_EXPERIMENTS_QUEST_CARDS},
  scaled: [LIVE_EXPERIMENTS_DATA],
  immediateSteps: [DATA_STEP],
  action: LIVE_EXPERIMENTS_ACTION,
  actionBill: LIVE_EXPERIMENTS_BILL,
};

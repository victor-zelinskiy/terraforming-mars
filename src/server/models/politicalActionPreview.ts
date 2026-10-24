/*
 * THE PREVIEW OF A POLITICAL ACTION (Turmoil Redux) — a party's action or the
 * enacted law's, described in the card action's own `ActionPreview` shape so
 * the card actions' composer reads it the way it reads a blue card: the same
 * branches, the same per-branch input, the same chips, the same «no effect»
 * verdict. ONE framework: a party is a badge on the card actions' chassis,
 * never a second composer that re-reads the live prompt on its own.
 *
 * Built over the VERY prompt the action menu nests (`ParliamentHandler.
 * partyActionPrompt` / `resolutionActionPrompt` — building it changes nothing,
 * the commit contract of every action in this fork), so the preview is a
 * promise of the prompt's own form, branch for branch. Where the action is not
 * offered, the preview is ONE blocked branch carrying the parliament's own
 * reason (the model's verdict ladder — `partyActionModel` /
 * `resolutionActionModel`): a blocked action is shown disabled with its
 * reason, never hidden.
 *
 * READ-ONLY. Nothing here mutates game state or re-implements a rule.
 */
import {IPlayer} from '../IPlayer';
import {PlayerInput} from '../PlayerInput';
import {OrOptions} from '../inputs/OrOptions';
import {SelectOption} from '../inputs/SelectOption';
import {SelectCard} from '../inputs/SelectCard';
import {AndOptions} from '../inputs/AndOptions';
import {ParliamentHandler} from '../parliament/ParliamentHandler';
import {partyActionModel, resolutionActionModel} from '../parliament/ParliamentModel';
import {PARTY_EFFECTS} from '../parliament/parties/PartyEffects';
import {actionBillPrice} from '../../common/parliament/actionBill';
import {paymentStep} from '../cards/actionPreviews';
import {promptAddressOf} from '../../common/inputs/preselectAddress';
import {SelectCardModel} from '../../common/models/PlayerInputModel';
import {REDUX_PARTIES, ReduxParty} from '../../common/parliament/ParliamentTypes';
import {
  ActionEffect,
  ActionPreviewBranch,
  ActionPreviewStep,
  PoliticalActionAnswer,
  PoliticalActionPreview,
  PoliticalActionSource,
} from '../../common/models/ActionPreviewModel';
import {ParliamentActionModel} from '../../common/models/ParliamentModel';

/** `party:<ReduxParty>` / `law:<resolution id>` — the wire form of a political source (the preview route's `source`). */
export function parsePoliticalActionSource(raw: string): PoliticalActionSource | undefined {
  const at = raw.indexOf(':');
  if (at <= 0) {
    return undefined;
  }
  const kind = raw.slice(0, at);
  const id = raw.slice(at + 1);
  if (kind === 'party' && (REDUX_PARTIES as ReadonlyArray<string>).includes(id)) {
    return {kind: 'party', party: id as ReduxParty};
  }
  if (kind === 'law' && id.length > 0) {
    return {kind: 'law', resolution: id};
  }
  return undefined;
}

/**
 * The preview of `source`'s action for `player`, or `undefined` when the source names no action at all (a party
 * without one, a law that is not the enacted one or has no action, a game without a parliament).
 */
export function politicalActionPreview(player: IPlayer, source: PoliticalActionSource): PoliticalActionPreview | undefined {
  const parliament = player.game?.parliament;
  if (parliament === undefined) {
    return undefined;
  }
  let model: ParliamentActionModel | undefined;
  let prompt: PlayerInput | undefined;
  if (source.kind === 'party') {
    model = partyActionModel(parliament, player, source.party);
    // A party action that RIDES the colony trade (Unity's free trade — no prompt of its own, the trade's payment path
    // is the party's): ONE branch whose step is the trade's door, the payment path pinned to the party. Nothing is
    // asked here; the colony and the confirm are the trade's own.
    if (model?.available === true && PARTY_EFFECTS[source.party].actionInput === undefined) {
      return {source, answer: 'option', kind: 'bespoke', branches: [{
        index: -1,
        title: '',
        available: true,
        renderKeys: [],
        effects: model.preview,
        steps: [{kind: 'colonyTrade', party: source.party}],
      }]};
    }
    prompt = model?.available === true ? ParliamentHandler.partyActionPrompt(player, source.party) : undefined;
  } else {
    const law = resolutionActionModel(parliament, player);
    if (law === undefined || law.resolution !== source.resolution) {
      return undefined;
    }
    model = law;
    prompt = law.available ? ParliamentHandler.resolutionActionPrompt(player) : undefined;
  }
  if (model === undefined) {
    return undefined;
  }
  if (prompt === undefined) {
    return {source, answer: 'option', kind: 'bespoke', branches: [blockedBranch(model)]};
  }
  const shaped = source.kind === 'law' ? lawShape(player, source.resolution, prompt, branchesOf(player, prompt, model.preview)) :
    branchesOf(player, prompt, model.preview);
  const {answer, branches} = shaped;
  const futile = source.kind === 'law' ? resolutionActionModel(parliament, player)?.futile : undefined;
  return {
    source,
    answer,
    kind: 'bespoke',
    branches: futile !== undefined && branches.length === 1 && branches[0].available ? [{...branches[0], futile}] : branches,
  };
}

/**
 * THE LAW'S OWN STEPS, read off its declarations (never its name):
 *  · a REPEAT pick (R&D Funding RX26 — the prompt's `repeatActionPrompt` marker) is the card composer's repeat SLOT
 *    (Viron's `repeatAction` step) — its answer is the pick inside the menu option, the copy's answers behind it;
 *  · a declared BILL (`actionBill` — Trade Industries RX28, Live Experiments RX36) the answer defers is a payment
 *    STEP — the live `SelectPaymentDeferred` the settlement raises, addressed to the law, absent when it auto-pays;
 *  · a card PLAY (`action.playModel` — RX36) is the play SLOT, after the bill.
 */
function lawShape(
  player: IPlayer,
  resolution: string,
  prompt: PlayerInput,
  shaped: {answer: PoliticalActionAnswer, branches: Array<ActionPreviewBranch>},
): {answer: PoliticalActionAnswer, branches: Array<ActionPreviewBranch>} {
  const parliament = player.game.parliament;
  const enacted = parliament?.enactedDefinition();
  if (parliament === undefined || enacted === undefined || enacted.id !== resolution || shaped.branches.length !== 1) {
    return shaped;
  }
  const [branch] = shaped.branches;
  if (prompt instanceof SelectCard && branch.optionInput?.type === 'card' && (branch.optionInput as SelectCardModel).repeatActionPrompt === true) {
    const {optionInput, ...rest} = branch;
    return {answer: 'direct', branches: [{...rest, steps: [{kind: 'input', input: optionInput, repeatAction: true}]}]};
  }
  if (!(prompt instanceof SelectOption)) {
    return shaped;
  }
  const steps: Array<ActionPreviewStep> = [];
  const bill = enacted.actionBill;
  if (bill !== undefined) {
    const price = actionBillPrice(bill, parliament.influence(player)).price;
    const cause = {kind: 'resolution' as const, resolution};
    const pay = paymentStep(player, price, {canUseTitanium: bill.titanium, cause});
    if (pay !== undefined && pay.kind === 'input') {
      // Addressed to the LAW: the live prompt is marked with its cause centrally (`getWaitingFor`), a bare
      // `toModel` is not — the address is the cause the settlement raises it with.
      steps.push({...pay, for: {...promptAddressOf(pay.input), source: cause}});
    }
  }
  // The play slot — unless the bill ASKS a payment of its own (Helion's heat, Luna's titanium — PL-727): the card is
  // then asked LIVE after the bill, hosted in the same stage (nothing about the play is pre-collectable).
  const play = enacted.action?.playModel?.(player);
  if (play !== undefined && !play.billAsks) {
    steps.push({kind: 'lawPlay', resolution, play});
  }
  return steps.length === 0 ? shaped : {answer: shaped.answer, branches: [{...branch, steps}]};
}

/** The action is not offered: one branch, disabled, with the parliament's own reason — and the chips it would pay. */
function blockedBranch(model: ParliamentActionModel): ActionPreviewBranch {
  const reason = model.reason === '' ? undefined : model.reason;
  return {
    index: -1,
    title: '',
    available: false,
    ...(reason === undefined ? {} : {unavailableReason: reason}),
    renderKeys: [],
    effects: model.preview,
    steps: [],
  };
}

/**
 * The prompt's own form, as branches: a bare commit is one confirm branch; a choice is a branch per option (each
 * option's own input carried as `optionInput`); an input that IS the prompt is one branch carrying it. The chips are
 * the option's own (`metadata.effects`, the resource pick's printed yield), else the action's result chips.
 */
function branchesOf(player: IPlayer, prompt: PlayerInput, fallback: ReadonlyArray<ActionEffect>): {answer: PoliticalActionAnswer, branches: Array<ActionPreviewBranch>} {
  if (prompt instanceof SelectOption) {
    return {answer: 'option', branches: [{
      index: -1,
      title: prompt.title,
      available: true,
      renderKeys: [],
      effects: chipsOr(prompt.metadata?.effects, fallback),
      steps: [],
    }]};
  }
  if (prompt instanceof OrOptions) {
    const branches: Array<ActionPreviewBranch> = prompt.options.map((option, index) => {
      const gain = option instanceof SelectCard ? option.resourceGainPrompt : undefined;
      const branch: ActionPreviewBranch = {
        index,
        title: option.title,
        available: true,
        renderKeys: [],
        effects: option instanceof SelectOption ?
          (option.metadata?.effects ?? []) :
          gain?.cardResource !== undefined && gain.amount !== undefined ?
            [{direction: 'gain', icon: gain.cardResource, amount: gain.amount, note: 'to a card'}] :
            [],
        steps: [],
      };
      if (!(option instanceof SelectOption)) {
        branch.optionInput = option.toModel(player);
      }
      if (gain?.vpBox !== undefined) {
        branch.vpBox = gain.vpBox;
      }
      return branch;
    });
    // A refused option is SHOWN, disabled with its reason (never hidden) — after the offered ones, so every offered
    // branch keeps its runtime index.
    for (const disabled of prompt.disabledOptions) {
      branches.push({
        index: -1,
        title: disabled.title,
        available: false,
        unavailableReason: disabled.reason,
        renderKeys: [],
        effects: [],
        steps: [],
      });
    }
    return {answer: 'or', branches};
  }
  if (prompt instanceof AndOptions || prompt instanceof SelectCard) {
    return {answer: 'direct', branches: [{
      index: -1,
      title: prompt.title,
      available: true,
      renderKeys: [],
      effects: fallback,
      optionInput: prompt.toModel(player),
      steps: [],
    }]};
  }
  // Any other form: one confirm branch over the prompt itself (its answer is the input's own — the composer hosts it).
  return {answer: 'direct', branches: [{
    index: -1,
    title: prompt.title,
    available: true,
    renderKeys: [],
    effects: fallback,
    optionInput: prompt.toModel(player),
    steps: [],
  }]};
}

function chipsOr(chips: ReadonlyArray<ActionEffect> | undefined, fallback: ReadonlyArray<ActionEffect>): ReadonlyArray<ActionEffect> {
  return chips !== undefined && chips.length > 0 ? chips : fallback;
}

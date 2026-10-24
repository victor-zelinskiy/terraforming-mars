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
import {REDUX_PARTIES, ReduxParty} from '../../common/parliament/ParliamentTypes';
import {
  ActionEffect,
  ActionPreviewBranch,
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
  const {answer, branches} = branchesOf(player, prompt, model.preview);
  const futile = source.kind === 'law' ? resolutionActionModel(parliament, player)?.futile : undefined;
  return {
    source,
    answer,
    kind: 'bespoke',
    branches: futile !== undefined && branches.length === 1 && branches[0].available ? [{...branches[0], futile}] : branches,
  };
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

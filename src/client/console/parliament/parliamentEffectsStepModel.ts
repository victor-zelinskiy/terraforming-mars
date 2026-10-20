import {PartyActionId, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {ICardRenderRoot} from '@/common/cards/render/Types';
import {buildMechanics, MechanicsVM} from '@/client/components/premiumCard/mechanicsModel';
import {PARLIAMENT_GRAPHIC} from '@/client/components/premiumCard/resolutionPremiumVm';
import {EffectActionState, EffectItemsInput, EffectWhy, parliamentEffectItems} from './parliamentEffectsModel';
import {allianceSourceOf, alliancePartnerName, grantSourcesOf} from './consoleParliamentModel';
import {actionUsesFor} from '@/common/parliament/actionUses';

/*
 * THE INNER STEP «ВАШИ ЭФФЕКТЫ» (Парламент v8, docs/TURMOIL_REDUX_PARLIAMENT_V8_PLAN.md § 6, the mock `c1`): A on the
 * overview's block opens the FULL list inside the Parliament — ДЕЙСТВИЯ on the left (the source, WHY it is yours, the
 * action's printed graphic, its rule in words, «раз за поколение», its state and the verb), ПОСТОЯННЫЕ ЭФФЕКТЫ on the
 * right (the same, a passive). Read off the SAME sources as the block (`parliamentEffectItems`): what stands on the
 * overview is what opens here, never a second rule of «what is yours».
 */

/** WHY a source is the viewer's, as an i18n key with its params (the source card / the resolution that carries the delegates). */
export type EffectWhyReading = {key: string, params: ReadonlyArray<string>};

export type EffectsStepEntry = {
  key: string;
  kind: 'party' | 'law';
  party: ReduxParty;
  why: EffectWhy;
  whyReading: EffectWhyReading;
  /** The source's NAME — a party's i18n key or the law's printed name. */
  name: string;
  /** The printed graphic: a party's render root, or the law's sliced mechanics (passive / action groups only). */
  renderData?: ICardRenderRoot;
  mechanics?: MechanicsVM;
  /** The rule in words (English i18n key). */
  rule: string;
};

export type EffectsStepAction = EffectsStepEntry & {
  state: EffectActionState;
  actionId?: PartyActionId;
  usesPerGeneration: number;
  /** The uses left this generation, where the action is taken more than once (RX37 — «осталось 1 из 2»). */
  usesLeft?: number;
};

/** An entry of the step is an ACTION (it has a state and a door) — the type guard the step's readers branch on. */
export function isEffectsAction(entry: EffectsStepEntry | EffectsStepAction | undefined): entry is EffectsStepAction {
  return entry !== undefined && 'state' in entry;
}

export type EffectsStepModel = {
  actions: Array<EffectsStepAction>;
  standing: Array<EffectsStepEntry>;
};

function whyReadingOf(input: EffectItemsInput, party: ReduxParty, why: EffectWhy, lawName?: string): EffectWhyReading {
  const view = input.view;
  switch (why) {
  case 'ruling': return {key: 'rules · everyone\'s', params: []};
  case 'delegates': {
    const slot = view.slots.find((s) => s.party === party);
    const name = slot?.resolution?.text.name;
    return name === undefined ? {key: 'your delegates', params: []} : {key: 'your delegates · «${0}»', params: [name]};
  }
  case 'alliance': {
    // TR62: the partner that stands for this party, and the card that made the pair.
    const access = view.viewer?.access.find((a) => a.party === party);
    return {key: 'by the alliance: ${0} · «${1}»', params: [alliancePartnerName(access), allianceSourceOf(access)]};
  }
  case 'granted': {
    const card = grantSourcesOf(view.viewer?.access.find((a) => a.party === party))[0];
    return card === undefined ? {key: 'by a card', params: []} : {key: 'by the card «${0}»', params: [card]};
  }
  case 'law': return {key: 'the enacted law · «${0}»', params: [lawName ?? '']};
  }
}

function lawMechanicsOf(input: EffectItemsInput, kind: 'effect' | 'action'): MechanicsVM | undefined {
  const resolution = input.enacted?.resolution;
  if (resolution === undefined) {
    return undefined;
  }
  const mechanics = buildMechanics(resolution.renderData, PARLIAMENT_GRAPHIC);
  const groups = mechanics.groups.filter((g) => g.kind === kind);
  return groups.length === 0 ? undefined : {...mechanics, groups, textOnly: false};
}

/** The step's two lists, in the block's reading order (the ruler first, the held parties, the law). */
export function parliamentEffectsStep(input: EffectItemsInput): EffectsStepModel {
  const out: EffectsStepModel = {actions: [], standing: []};
  for (const item of parliamentEffectItems(input)) {
    if (item.kind === 'party') {
      const vm = input.view.parties.find((p) => p.party === item.party);
      const effect = vm?.effect;
      if (effect === undefined) {
        continue;
      }
      const base = {
        party: item.party, why: item.why, whyReading: whyReadingOf(input, item.party, item.why), name: item.party, kind: 'party' as const,
      };
      if (item.effect) {
        out.standing.push({...base, key: `${item.key}:effect`, renderData: effect.passiveRenderData, rule: effect.text.passive ?? effect.text.rule});
      }
      if (item.action !== undefined && effect.actionRenderData !== undefined) {
        out.actions.push({
          ...base, key: `${item.key}:action`, renderData: effect.actionRenderData, rule: effect.text.action ?? effect.text.rule,
          state: item.action, actionId: effect.actionId, usesPerGeneration: effect.usesPerGeneration ?? 1,
        });
      }
      continue;
    }
    const resolution = input.enacted?.resolution;
    if (resolution === undefined) {
      continue;
    }
    const base = {
      party: item.party, why: item.why, whyReading: whyReadingOf(input, item.party, 'law', resolution.text.name), name: resolution.text.name, kind: 'law' as const,
    };
    const passive = resolution.hasPassive ? lawMechanicsOf(input, 'effect') : undefined;
    if (passive !== undefined) {
      out.standing.push({...base, key: `${item.key}:effect`, mechanics: passive, rule: resolution.text.passive ?? ''});
    }
    const action = resolution.hasAction ? lawMechanicsOf(input, 'action') : undefined;
    if (action !== undefined && item.action !== undefined) {
      // THE LAW'S COUNT (RX37 — 2, 3 at influence 2+): the seat's LIVE verdict from the server (`usesPerGeneration`
      // read at the seat's influence), else the declaration's one reading at its base — never a constant 1.
      const live = input.resolutionActionState;
      const per = live !== undefined && live.usesPerGeneration > 0 ? live.usesPerGeneration : actionUsesFor(resolution.actionUses, 0);
      out.actions.push({
        ...base, key: `${item.key}:action`, mechanics: action, rule: resolution.text.action ?? '', state: item.action, usesPerGeneration: per,
        ...(live !== undefined && per > 1 ? {usesLeft: live.usesLeft} : {}),
      });
    }
  }
  return out;
}

/**
 * THE STEP'S CURSOR (◀ ▶ ▲ ▼): the ACTIONS are one column on the left, the STANDING effects a grid of `columns` on the
 * right. ▲ ▼ walk a column (a grid row by row); ◀ ▶ cross between the two (to the entry level with the cursor) and
 * between the grid's columns. A move that would leave the step stays put — B is the only way out (one level back).
 */
export function effectsStepCursorMove(model: EffectsStepModel, key: string, dir: 'up' | 'down' | 'left' | 'right', columns: number): string {
  const left = model.actions.map((e) => e.key);
  const right = model.standing.map((e) => e.key);
  const cols = Math.max(1, columns);
  const li = left.indexOf(key);
  if (li !== -1) {
    if (dir === 'up') {
      return left[Math.max(0, li - 1)];
    }
    if (dir === 'down') {
      return left[Math.min(left.length - 1, li + 1)];
    }
    if (dir === 'right' && right.length > 0) {
      const row = Math.min(li, Math.ceil(right.length / cols) - 1);
      return right[Math.min(right.length - 1, row * cols)];
    }
    return key;
  }
  const ri = right.indexOf(key);
  if (ri === -1) {
    return left[0] ?? right[0] ?? '';
  }
  const col = ri % cols;
  const row = Math.floor(ri / cols);
  switch (dir) {
  case 'up': return ri - cols >= 0 ? right[ri - cols] : key;
  case 'down': return ri + cols < right.length ? right[ri + cols] : key;
  case 'right': return col + 1 < cols && ri + 1 < right.length ? right[ri + 1] : key;
  case 'left':
    if (col > 0) {
      return right[ri - 1];
    }
    return left.length > 0 ? left[Math.min(left.length - 1, row)] : key;
  }
}

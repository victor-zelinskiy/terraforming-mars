/*
 * CONSOLE OR-CHOICE + TABBED-TARGET model (pure) — the console-native premium
 * rendering of an `OrOptions` pick and a `tabbedTargets` step, shared by BOTH
 * the play composer (ConsolePlayCardConfirm) and the action composer
 * (ConsoleActionComposer). Desktop parity with ModernOptionPicker +
 * TabbedRemovalPicker: every option shows its `OptionMetadata` (icon +
 * `current → resulting` + player chip + tradeoff), a NESTED-input option
 * (Comet For Venus's `SelectPlayer` sitting directly in the OrOptions) opens a
 * sub-pick and submits the nested response, and the informational
 * `disabledOptions` render greyed with their reason.
 *
 * Byte-parity: a leaf option submits `{type:'or', index, response:{type:'option'}}`;
 * a nested-input option submits `{type:'or', index, response:<nested response>}`;
 * a tabbed target submits its `{type:'or', index, response:…}` at the TOP level
 * (a step response). No Vue / DOM / i18n (labels stay raw). Unit-tested
 * (tests/client/components/console/consoleOrChoice.spec.ts).
 */

import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {OptionMetadata, OrOptionsModel, PlayerInputModel} from '@/common/models/PlayerInputModel';
import {TabbedTargetsStep} from '@/common/models/ActionPreviewModel';

/** One premium row of an OrOptions pick. */
export type ConsoleOrItem = {
  key: string;
  /** Index into `OrOptions.options` — the submitted `{type:'or', index}`. */
  optionIndex: number;
  label: string | Message;
  disabled: boolean;
  reason: string | Message;
  /** The premium cost/gain chips (from `metadata.effects`, or synthesized from
   *  `player`/`global`/`icon`+`amount`). */
  chips: ReadonlyArray<ActionEffect>;
  /** Player-target colour (renders a colour dot beside the label). */
  playerColor?: Color;
  /** A short descriptive sub-line / a non-numeric downside. */
  description?: string | Message;
  tradeoff?: string | Message;
  /** When the option IS a nested input (a `SelectPlayer`/`SelectCard`/
   *  `SelectAmount` sitting directly in the OrOptions, NOT a leaf SelectOption),
   *  this is that input — selecting the row opens a sub-pick over it and the
   *  chosen value nests into the branch's `{type:'or', index, response:<nested>}`. */
  nested?: PlayerInputModel;
};

/**
 * The target player's COLOUR of an option, so a player-target row (steal /
 * attack) shows a colour dot the player can read at a glance — even before the
 * name. Prefer the explicit `metadata.player.color`; else fall back to the
 * option TITLE's PLAYER data token (its `value` IS the seat colour), which
 * covers every "… from ${player}" option whose metadata omits the colour.
 */
function playerColorOf(title: string | Message, meta: OptionMetadata | undefined): Color | undefined {
  if (meta?.player?.color !== undefined) {
    return meta.player.color;
  }
  if (typeof title === 'string') {
    return undefined;
  }
  const token = title.data?.find((d) => d?.type === LogMessageDataType.PLAYER);
  return token !== undefined ? (token.value as Color) : undefined;
}

/** Build a chip from an option's metadata (mirrors the desktop chip logic). */
function chipsFromMetadata(m: OptionMetadata | undefined): Array<ActionEffect> {
  if (m === undefined) {
    return [];
  }
  if (m.effects !== undefined && m.effects.length > 0) {
    return [...m.effects];
  }
  const out: Array<ActionEffect> = [];
  if (m.icon !== undefined && m.amount !== undefined && m.amount !== 0) {
    // A steal / removal reads as the TARGET losing the resource (cost/amber);
    // a gain reads mint. `player.current → resulting` is the honest before→after.
    const gain = m.kind === 'resourceGain';
    out.push({
      direction: gain ? 'gain' : 'cost',
      icon: m.icon,
      amount: m.amount,
      current: m.player?.current,
      resulting: m.player?.resulting,
    });
  } else if (m.global !== undefined) {
    out.push({
      direction: 'gain',
      icon: m.icon ?? 'venus',
      amount: m.amount ?? 0,
      current: m.global.current,
      resulting: m.global.resulting,
      unit: m.global.unit,
    });
  } else if (m.resource !== undefined && m.icon !== undefined) {
    out.push({direction: 'cost', icon: m.icon, amount: m.amount ?? 0, current: m.resource.current, resulting: m.resource.resulting});
  }
  return out;
}

/**
 * Build the premium row model of an OrOptions pick: the selectable options
 * (leaf + nested-input) followed by the informational `disabledOptions`.
 */
export function buildOrItems(model: OrOptionsModel): Array<ConsoleOrItem> {
  const out: Array<ConsoleOrItem> = model.options.map((opt, i): ConsoleOrItem => {
    const leaf = opt.type === 'option';
    const meta = leaf ? (opt as {metadata?: OptionMetadata}).metadata : undefined;
    return {
      key: 'o' + i,
      optionIndex: i,
      label: opt.title,
      disabled: false,
      reason: '',
      chips: chipsFromMetadata(meta),
      playerColor: playerColorOf(opt.title, meta),
      description: meta?.description,
      tradeoff: meta?.tradeoff,
      nested: leaf ? undefined : opt,
    };
  });
  // Informational, non-selectable targets (a protected / empty opponent).
  for (const d of model.disabledOptions ?? []) {
    out.push({
      key: 'd' + out.length,
      optionIndex: -1,
      label: d.title,
      disabled: true,
      reason: d.reason ?? '',
      chips: chipsFromMetadata(d.metadata),
      playerColor: playerColorOf(d.title, d.metadata),
    });
  }
  return out;
}

/** The response for a picked or-item: a leaf `{type:'option'}` or the nested one. */
export function orItemResponse(item: ConsoleOrItem, nestedResponse?: unknown): unknown {
  const inner = item.nested !== undefined ? nestedResponse : {type: 'option' as const};
  return {type: 'or' as const, index: item.optionIndex, response: inner};
}

// ── tabbed targets (Virus: remove ≤2 animals OR ≤5 plants) ──────────────────

/** One selectable tabbed target (animal card OR plant player). */
export type ConsoleTabbedTarget = {
  tab: 'animal' | 'plant';
  key: string;
  label: string;
  /** Impact `current → resulting` (a plant target has it; an animal card uses
   *  the card's own count). */
  impact: string;
  disabled: boolean;
  reason: string | Message;
  playerColor?: Color;
  cardName?: string;
  /** The top-level OrOptions response this target submits. */
  response: unknown;
};

/**
 * The flat target list of a `tabbedTargets` step — the animal-card options then
 * the plant-player options. Each carries its byte-identical top-level `{type:'or',
 * index, response}` (the animal card nests a `{type:'card'}`, a plant player a
 * `{type:'option'}`).
 */
export function buildTabbedTargets(step: TabbedTargetsStep): Array<ConsoleTabbedTarget> {
  const out: Array<ConsoleTabbedTarget> = [];
  if (step.animal !== undefined) {
    const branchIndex = step.animal.branchIndex;
    for (const card of step.animal.input.cards) {
      const from = card.resources ?? 0;
      out.push({
        tab: 'animal',
        key: 'a' + card.name,
        label: card.name,
        impact: `${from} → ${Math.max(0, from - (step.animal.amount ?? 0))}`,
        disabled: card.isDisabled === true,
        reason: card.isDisabled === true ? (card.disabledReason ?? '') : '',
        cardName: card.name,
        response: {type: 'or', index: branchIndex, response: {type: 'card', cards: [card.name]}},
      });
    }
  }
  if (step.plant !== undefined) {
    for (const t of step.plant.targets) {
      out.push({
        tab: 'plant',
        key: 'p' + t.color,
        label: t.name,
        impact: `${t.current} → ${t.resulting}`,
        disabled: t.disabled === true,
        reason: t.reason ?? '',
        playerColor: t.color,
        response: {type: 'or', index: t.optionIndex, response: {type: 'option'}},
      });
    }
  }
  return out;
}

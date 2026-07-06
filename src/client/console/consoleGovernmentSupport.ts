/*
 * GOVERNMENT SUPPORT (World Government Terraforming) — the PURE card model
 * for the console-native decision panel (ConsoleGovernmentSupport.vue).
 *
 * The server WGT prompt (Game.worldGovernmentTerraformingInput) is a bare
 * OrOptions of stable-English `SelectOption`s ("Increase temperature" /
 * "Increase oxygen" / "Increase Venus scale" — leaf) and `SelectSpace`
 * options ("Add an ocean" / the Ares "Remove an unprotected hazard" — a
 * board pick). This module turns those options + the live global-parameter
 * values into an ORDERED, premium `GovCard[]` for a 2×2 briefing grid:
 * per-parameter icon / accent / a `current → next` preview + a compact
 * segmented-scale fraction / whether the option needs a board placement.
 *
 * It is 100% derived, NEVER mutates, and NEVER submits — the component
 * builds its response from `optionIndex` (byte-parity with the desktop WGT
 * modal). It ALSO synthesizes an honest DISABLED card for a CORE parameter
 * that is in this game but already MAXED (the server omits a maxed option),
 * so the grid reads as the complete set with a "maximum reached" reason —
 * never inventing an action (a synthesized card can't be selected).
 *
 * Matched by the option's STABLE English title (the WGT titles are plain
 * strings server-side — never i18n-mutated Message objects, so this is
 * safe, mirroring the desktop WorldGovernmentModalContent). Pure + unit
 * tested (tests/client/components/console/consoleGovernmentSupport.spec.ts).
 */

import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {Message} from '@/common/logs/Message';
import * as constants from '@/common/constants';

/** The visual accent family (drives the per-card colour in console.less). */
export type GovAccent = 'temperature' | 'oxygen' | 'ocean' | 'venus' | 'moon' | 'hazard' | 'neutral';

/** The parameter identity — canonical ordering + the synthesis scope. */
export type GovParam =
  | 'temperature' | 'oxygen' | 'oceans' | 'venus'
  | 'moon-habitat' | 'moon-mining' | 'moon-logistics' | 'hazard' | 'other';

export type GovCard = {
  /** Stable :key. */
  key: string;
  param: GovParam;
  /** Index into the WGT OrOptions.options (−1 for a synthesized maxed card). */
  optionIndex: number;
  /** The source option (undefined for a synthesized card) — space-pick needs it. */
  option: PlayerInputModel | undefined;
  /** Raw title (string or Message) — translated in the component via textOf. */
  title: string | Message;
  /** 'wgt-icon wgt-icon--<x>' class pair; '' when unknown. */
  iconClass: string;
  accent: GovAccent;
  /** true = a SelectSpace option (board placement follows the pick). */
  isSpace: boolean;
  /** Whether a `current → next` preview is shown (false for maxed / unknown). */
  hasPreview: boolean;
  /** The current value with its unit (e.g. "-24°C" / "7%" / "5 / 9"); '' = none. */
  currentText: string;
  /** The resulting value with its unit; '' when !hasPreview. */
  nextText: string;
  /** 0..1 current fill for the mini segmented scale; −1 = no scale. */
  fraction: number;
  /** 0..1 fill AFTER the action (the "gain" segment); −1 = no scale. */
  nextFraction: number;
  available: boolean;
  /** i18n key of the disabled reason (only when !available). */
  disabledReason: string;
};

/** The live global-parameter snapshot the builder needs (test-friendly). */
export type GovGameState = {
  temperature: number;
  oxygenLevel: number;
  oceans: number;
  venusScaleLevel: number;
  /** Whether the Venus expansion is in this game (gates the maxed synthesis). */
  venusInGame: boolean;
};

type ParamSpec = {
  param: GovParam;
  accent: GovAccent;
  icon: string;
  /** Increase per WGT action (temperature/venus = 2, oxygen/oceans = 1). */
  step: number;
  unit: string;
  min: number;
  max: number;
  isSpace: boolean;
  /** true = a CORE parameter eligible for the maxed-card synthesis. */
  core: boolean;
  /** For oceans the value reads "n / MAX". */
  showMax: boolean;
  value: (g: GovGameState) => number;
  /** Only meaningful for core params — is this param part of THIS game? */
  inGame: (g: GovGameState) => boolean;
};

/** English-title → parameter spec. WGT titles are stable server-side. */
const TITLE_SPECS: Record<string, ParamSpec> = {
  'Increase temperature': {
    param: 'temperature', accent: 'temperature', icon: 'temperature',
    step: 2, unit: '°C', min: constants.MIN_TEMPERATURE, max: constants.MAX_TEMPERATURE,
    isSpace: false, core: true, showMax: false,
    value: (g) => g.temperature, inGame: () => true,
  },
  'Increase oxygen': {
    param: 'oxygen', accent: 'oxygen', icon: 'oxygen',
    step: 1, unit: '%', min: constants.MIN_OXYGEN_LEVEL, max: constants.MAX_OXYGEN_LEVEL,
    isSpace: false, core: true, showMax: false,
    value: (g) => g.oxygenLevel, inGame: () => true,
  },
  'Add an ocean': {
    param: 'oceans', accent: 'ocean', icon: 'ocean',
    step: 1, unit: '', min: 0, max: constants.MAX_OCEAN_TILES,
    isSpace: true, core: true, showMax: true,
    value: (g) => g.oceans, inGame: () => true,
  },
  'Increase Venus scale': {
    param: 'venus', accent: 'venus', icon: 'venus',
    step: 2, unit: '%', min: constants.MIN_VENUS_SCALE, max: constants.MAX_VENUS_SCALE,
    isSpace: false, core: true, showMax: false,
    value: (g) => g.venusScaleLevel, inGame: (g) => g.venusInGame,
  },
};

/** Non-core options that carry an icon but no numeric preview (graceful). */
const EXTRA_ICON: Record<string, {param: GovParam, accent: GovAccent, icon: string, isSpace: boolean}> = {
  'Increase the Moon habitat rate': {param: 'moon-habitat', accent: 'moon', icon: 'moon-habitat', isSpace: false},
  'Increase the Moon mining rate': {param: 'moon-mining', accent: 'moon', icon: 'moon-mining', isSpace: false},
  'Increase the Moon logistics rate': {param: 'moon-logistics', accent: 'moon', icon: 'moon-logistics', isSpace: false},
  'Remove an unprotected hazard': {param: 'hazard', accent: 'hazard', icon: 'hazard', isSpace: true},
};

/** Canonical grid order — the core 2×2 first, extras trail in server order. */
const CORE_ORDER: ReadonlyArray<GovParam> = ['temperature', 'oxygen', 'oceans', 'venus'];

function rawTitle(title: string | Message | undefined): string {
  if (title === undefined) {
    return '';
  }
  return typeof title === 'string' ? title : title.message;
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function fractionOf(spec: ParamSpec, value: number): number {
  const span = spec.max - spec.min;
  return span <= 0 ? 0 : clamp01((value - spec.min) / span);
}

function valueText(spec: ParamSpec, value: number): string {
  if (spec.showMax) {
    return `${value} / ${spec.max}`;
  }
  return `${value}${spec.unit}`;
}

function availableCard(spec: ParamSpec, option: PlayerInputModel, index: number, g: GovGameState): GovCard {
  const current = spec.value(g);
  const next = Math.min(spec.max, current + spec.step);
  return {
    key: `${spec.param}#${index}`,
    param: spec.param,
    optionIndex: index,
    option,
    title: option.title,
    iconClass: `wgt-icon wgt-icon--${spec.icon}`,
    accent: spec.accent,
    isSpace: spec.isSpace,
    hasPreview: true,
    currentText: valueText(spec, current),
    nextText: valueText(spec, next),
    fraction: fractionOf(spec, current),
    nextFraction: fractionOf(spec, next),
    available: true,
    disabledReason: '',
  };
}

function extraCard(title: string, option: PlayerInputModel, index: number): GovCard {
  const extra = EXTRA_ICON[title];
  return {
    key: `${extra?.param ?? 'other'}#${index}`,
    param: extra?.param ?? 'other',
    optionIndex: index,
    option,
    title: option.title,
    iconClass: extra !== undefined ? `wgt-icon wgt-icon--${extra.icon}` : '',
    accent: extra?.accent ?? 'neutral',
    isSpace: extra?.isSpace ?? (option.type === 'space'),
    hasPreview: false,
    currentText: '',
    nextText: '',
    fraction: -1,
    nextFraction: -1,
    available: true,
    disabledReason: '',
  };
}

function maxedCard(spec: ParamSpec, g: GovGameState): GovCard {
  const current = spec.value(g);
  return {
    key: `${spec.param}#maxed`,
    param: spec.param,
    optionIndex: -1,
    option: undefined,
    // The server omits the option when maxed, so reuse the stable English title.
    title: TITLE_FOR_PARAM[spec.param] ?? '',
    iconClass: `wgt-icon wgt-icon--${spec.icon}`,
    accent: spec.accent,
    isSpace: spec.isSpace,
    hasPreview: false,
    currentText: valueText(spec, current),
    nextText: '',
    fraction: 1,
    nextFraction: 1,
    available: false,
    disabledReason: 'Maximum reached',
  };
}

/** Reverse map param → its stable English title (for synthesized cards). */
const TITLE_FOR_PARAM: Partial<Record<GovParam, string>> = {
  temperature: 'Increase temperature',
  oxygen: 'Increase oxygen',
  oceans: 'Add an ocean',
  venus: 'Increase Venus scale',
};

/**
 * Build the ordered card grid. Core parameters keep their canonical slot
 * (filled by the live option or a synthesized maxed card); recognized
 * extras (Moon / hazard) and any unknown option trail in server order.
 */
export function buildGovSupportCards(
  options: ReadonlyArray<PlayerInputModel>,
  g: GovGameState,
): Array<GovCard> {
  const byParam = new Map<GovParam, GovCard>();
  const extras: Array<GovCard> = [];

  options.forEach((option, index) => {
    const title = rawTitle(option.title);
    const spec = TITLE_SPECS[title];
    if (spec !== undefined) {
      byParam.set(spec.param, availableCard(spec, option, index, g));
    } else {
      extras.push(extraCard(title, option, index));
    }
  });

  const cards: Array<GovCard> = [];
  for (const param of CORE_ORDER) {
    const live = byParam.get(param);
    if (live !== undefined) {
      cards.push(live);
      continue;
    }
    // No live option — synthesize a disabled card ONLY when this in-scope
    // core parameter is genuinely MAXED (never claim "maximum" otherwise).
    const spec = coreSpec(param);
    if (spec !== undefined && spec.inGame(g) && spec.value(g) >= spec.max) {
      cards.push(maxedCard(spec, g));
    }
  }
  return [...cards, ...extras];
}

function coreSpec(param: GovParam): ParamSpec | undefined {
  for (const key of Object.keys(TITLE_SPECS)) {
    const spec = TITLE_SPECS[key];
    if (spec.param === param) {
      return spec;
    }
  }
  return undefined;
}

/** The index of the first SELECTABLE card (initial focus); 0 if none. */
export function firstAvailableIndex(cards: ReadonlyArray<GovCard>): number {
  const at = cards.findIndex((c) => c.available);
  return at === -1 ? 0 : at;
}

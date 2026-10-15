/*
 * THE PLAY COMPOSER'S READING OF THE ONE-PLAY CLASS (TR49) — two pure views
 * over the server's own facts (`ArmedPlayForecast`, the hand card's
 * `requirementEasing`):
 *   · the REQUIREMENT ROW — each printed global requirement a modifier bends:
 *     printed · now · effective (or ignored) · who bends it;
 *   · the CONSUME NOTE — every armed effect this play spends, and whether this
 *     card USES it or spends it for nothing (an `info` note, never a block).
 * Nothing is compared or derived here: the numbers and verdicts are the server's.
 */
import {CardName} from '@/common/cards/CardName';
import {CardAnnotation, CardAnnotationRow} from '@/client/components/cardAnnotations/annotationModel';
import {ArmedPlayForecast, RequirementEasingModel} from '@/common/models/ArmedPlayEffectModel';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {armedEffectFormula, easingBound, easingParameterLabel, easingSourcesText, easingUnit, EASING_KEYS} from '@/client/console/requirementEasingText';

export type ComposerRequirementView = {
  key: string;
  iconClass: string;
  /** «Температура». */
  label: string;
  /** «≥ 0°C» — the printed bound, always stated. */
  printed: string;
  /** «−30°C» — the scale now. */
  now: string;
  /** «≥ −4°C» — the bound with the modifiers (absent when ignored). */
  effective?: string;
  waived: boolean;
  met: boolean;
  decisive: boolean;
  /** «±2 Особая разработка · один розыгрыш». */
  sources: string;
};

export function composerRequirementViews(easings: ReadonlyArray<RequirementEasingModel> | undefined): ReadonlyArray<ComposerRequirementView> {
  return (easings ?? []).map((e) => {
    const view: ComposerRequirementView = {
      key: e.key,
      iconClass: iconClassFor(e.parameter),
      label: easingParameterLabel(e.parameter),
      printed: easingBound(e, e.printed),
      now: `${e.current}${easingUnit(e.parameter)}`,
      waived: e.effective === 'waived',
      met: e.met,
      decisive: e.decisive,
      sources: easingSourcesText(e),
    };
    if (e.effective !== 'waived') {
      view.effective = easingBound(e, e.effective);
    }
    return view;
  });
}

export const CONSUME_KEYS = {
  used: 'This play spends ${0}: ${1}',
  unused: 'This play spends ${0} for nothing — this card does not need it',
} as const;

export type ComposerConsumeNote = {source: CardName, used: boolean, text: string};

/** The armed effects this play spends — named, and said to be used or wasted. */
export function composerConsumeNotes(forecast: ArmedPlayForecast | undefined): ReadonlyArray<ComposerConsumeNote> {
  return (forecast?.consumes ?? []).map((c) => {
    const name = translateText(c.armed.source);
    return {
      source: c.armed.source,
      used: c.used,
      text: c.used ?
        translateTextWithParams(CONSUME_KEYS.used, [name, armedEffectFormula(c.armed.effect)]) :
        translateTextWithParams(CONSUME_KEYS.unused, [name]),
    };
  });
}

/** The row's state word: ignored / met thanks to / still short / met anyway. */
export function requirementStateText(view: ComposerRequirementView): string {
  if (view.waived) {
    return translateText(EASING_KEYS.requirementIgnored);
  }
  return view.met ? (view.decisive ? translateText(REQUIREMENT_STATE_KEYS.metThanks) : translateText(REQUIREMENT_STATE_KEYS.met)) :
    translateText(REQUIREMENT_STATE_KEYS.short);
}

export const REQUIREMENT_STATE_KEYS = {
  metThanks: 'Met thanks to the modifier',
  met: 'Met',
  short: 'Still short',
} as const;

// ── THE RULES PANEL: the printed requirement, and what bends it (TR49 class) ───────────────────────────

/** A row's translator (the panel's own `{text, params}` pair). */
type RowTranslator = {text: (key: string) => string, params: (key: string, params: Array<string>) => string};

export const RULE_EASING_KEYS = {
  shifted: 'Under an effect: ${0}',
  waived: 'Ignored: ${0}',
} as const;

/**
 * The line the RULES panel adds under a printed requirement a modifier bends —
 * «Под эффектом: ≥ −4°C · ±2 Особая разработка · один розыгрыш» / «Снято:
 * Новаторская разработка · один розыгрыш». The rule stays (it is still
 * printed); the line says what is left of it, in the class's one wording.
 */
export function ruleEasingLine(easing: RequirementEasingModel, t: RowTranslator): string {
  if (easing.effective === 'waived') {
    return t.params(RULE_EASING_KEYS.waived, [easingSourcesText(easing)]);
  }
  return t.params(RULE_EASING_KEYS.shifted, [`${easingBound(easing, easing.effective)} · ${easingSourcesText(easing)}`]);
}

/**
 * The rules panel's groups with each bent requirement ANNOTATED in place — a
 * line right under the printed rule it bends (matched by the rules-block
 * address the server's reading carries). A rule the availability panel
 * already restates is not in `groups` (suppressed upstream), and then its
 * annotation goes with it: the availability line names the modifier itself.
 */
export function withRequirementEasing(groups: ReadonlyArray<CardAnnotation>, easings: ReadonlyArray<RequirementEasingModel>, t: RowTranslator): ReadonlyArray<CardAnnotation> {
  if (easings.length === 0) {
    return groups;
  }
  return groups.map((group) => {
    if (group.kind !== 'requirement') {
      return group;
    }
    const rows: Array<CardAnnotationRow> = [];
    for (const row of group.rows) {
      rows.push(row);
      const easing = easings.find((e) => e.key === row.id);
      if (easing !== undefined) {
        rows.push({id: `${row.id}:eased`, text: '${0}', params: [ruleEasingLine(easing, t)], special: false, anyPlayer: false});
      }
    }
    return {...group, rows};
  });
}

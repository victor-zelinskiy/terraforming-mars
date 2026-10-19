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
import {CardAnnotation, CardAnnotationRow} from '@/client/components/cardAnnotations/annotationModel';
import {ArmedPlayForecast, armedSourceKey, RequirementEasingModel, RequirementEasingSourceModel} from '@/common/models/ArmedPlayEffectModel';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {armedEffectFormula, armedSourceName, easingBound, easingShareText, easingSourcesText, easingSubjectLabel, easingUnit, EASING_KEYS} from '@/client/console/requirementEasingText';
import {ModifierSourceVM, easingIsQuiet, modifierSourceOf} from '@/client/components/premiumCard/premiumModifierSources';
import {requirementPartyEmblem} from '@/client/components/premiumCard/partyEmblems';
import {partyNameKey} from '@/client/console/parliament/partyNames';

/** The party reason's own «now» (`unplayableReasonFormat` — one wording for the hand's reason and the composer's row). */
const PARTY_NOW_KEY = 'your delegates on the resolution of that party: ${0} of ${1}';
/** …and the PARTNER's «now» under an alliance (TR62): the road it stands by — «Марс вперёд» у власти / два ваших делегата. */
const PARTNER_NOW_KEYS = {
  ruling: '${0} is ruling',
  delegates: '${0}: two of your delegates on its resolution',
} as const;

export type ComposerRequirementView = {
  key: string;
  /** The scale's icon class; '' for a PARTY requirement (TR70), whose `emblem` stands in its place. */
  iconClass: string;
  /** The PARTY's emblem — the badge the hand's counter and the face's plate already draw. */
  emblem?: string;
  /** «Температура» — or the party's name. */
  label: string;
  /** «≥ 0°C» — the printed bound, always stated. */
  printed: string;
  /** «−30°C» — the scale now ('' when the source line says it — an alliance's partner road, TR62). */
  now: string;
  /** «≥ −4°C» — the bound with the modifiers (absent when ignored). */
  effective?: string;
  waived: boolean;
  /** TR62: a party requirement met THROUGH the alliance's partner (`effective` names it — «через «Марс вперёд»»). */
  viaAlly: boolean;
  met: boolean;
  decisive: boolean;
  /** «±2 Особая разработка · один розыгрыш». */
  sources: string;
  /**
   * EACH source with its own share — the mark and «±2 Inventrix» / «Новаторская разработка · один розыгрыш»: with
   * several modifiers the row reads the FINAL bound (`effective`) and then who contributed what.
   */
  shares: ReadonlyArray<{source: ModifierSourceVM, text: string}>;
  /**
   * SEVERAL sources: the row stands on TWO lines — the FINAL bound and the verdict on the first, the composition on
   * the second as a SUM («[card] ±2 Inventrix + [card] ±2 Adaptation Technology + … = ±6»), so the arithmetic that
   * moved the bound is read, never inferred. One source keeps the one line — except a requirement met THROUGH THE
   * ALLIANCE (TR62): its source names a card AND a partner, which never fit beside the verdict on one line (the 4K
   * row cut the partner's name by an ellipsis), so it takes the second line too.
   */
  stacked: boolean;
  /** «±6» — the sum the composition ends on (stacked shifts only). */
  total?: string;
};

export function composerRequirementViews(easings: ReadonlyArray<RequirementEasingModel> | undefined): ReadonlyArray<ComposerRequirementView> {
  // A requirement met ANYWAY under a shift is no decision of this play — the row stays for the ones a modifier decides.
  return (easings ?? []).filter((e) => !easingIsQuiet(e)).map((e) => {
    const emblem = e.party !== undefined ? requirementPartyEmblem(e.party) : undefined;
    const view: ComposerRequirementView = {
      key: e.key,
      iconClass: e.parameter !== undefined ? iconClassFor(e.parameter) : '',
      ...(emblem !== undefined ? {emblem} : {}),
      label: easingSubjectLabel(e),
      printed: easingBound(e, e.printed),
      // A PARTY requirement's «now» is the delegates road («your delegates …: 0 of 2») — the hand's reason, word for word;
      // under an alliance the PARTNER's road is what holds now, and the source line says it (`allyShareText`).
      now: e.effective === 'allied' ? '' : e.party !== undefined ? partyNow(e) : `${e.current}${easingUnit(e.parameter)}`,
      waived: e.effective === 'waived',
      viaAlly: e.effective === 'allied',
      met: e.met,
      decisive: e.decisive,
      sources: easingSourcesText(e),
      shares: e.sources.map((share, i) => ({source: modifierSourceOf(share, i), text: share.kind === 'ally' ? allyShareText(share) : easingShareText(share)})),
      stacked: e.sources.length > 1 || e.effective === 'allied',
    };
    if (view.stacked && e.sources.every((s) => s.kind === 'shift')) {
      view.total = `±${e.sources.reduce((sum, s) => sum + (s.steps ?? 0), 0)}`;
    }
    if (e.effective === 'allied') {
      view.effective = translateTextWithParams(EASING_KEYS.throughAlly, [e.via !== undefined ? translateText(partyNameKey(e.via)) : '']);
    } else if (e.effective !== 'waived') {
      view.effective = easingBound(e, e.effective);
    }
    return view;
  });
}

/** A PARTY requirement's «now»: the party's own delegates road («ваших делегатов на её резолюции: 0 из 2»). */
function partyNow(e: RequirementEasingModel): string {
  return translateTextWithParams(PARTY_NOW_KEY, [String(e.current), String(e.printed)]);
}

/**
 * AN ALLIANCE'S SOURCE LINE (TR62): the card, then the road its PARTNER stands by NOW — «Альянс Тарсиса · «Марс
 * вперёд» у власти». The partner is already named by the bound above («→ через «Марс вперёд»») and the verdict
 * says the party's own road does not hold, so the row reads each fact once (a row that read the partner three times
 * and the own road beside it took three lines on the TV).
 */
function allyShareText(share: RequirementEasingSourceModel): string {
  const card = easingShareText({...share, kind: 'shift', steps: undefined});
  if (share.via === undefined || share.road === undefined) {
    return easingShareText(share);
  }
  return `${card} · ${translateTextWithParams(PARTNER_NOW_KEYS[share.road], [translateText(partyNameKey(share.via))])}`;
}

export const CONSUME_KEYS = {
  used: 'This play spends ${0}: ${1}',
  unused: 'This play spends ${0} for nothing — this card does not need it',
} as const;

/** `source` is the armed source's stable key (a card's name, `law:<id>` for a law — RX36). */
export type ComposerConsumeNote = {source: string, used: boolean, text: string};

/** The armed effects this play spends — named, and said to be used or wasted. */
export function composerConsumeNotes(forecast: ArmedPlayForecast | undefined): ReadonlyArray<ComposerConsumeNote> {
  return (forecast?.consumes ?? []).map((c) => {
    const name = armedSourceName(c.armed.source);
    return {
      source: armedSourceKey(c.armed.source),
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
  if (view.viaAlly && view.met && view.decisive) {
    return translateText(REQUIREMENT_STATE_KEYS.metAlly);
  }
  const thanks = view.stacked ? REQUIREMENT_STATE_KEYS.metThanksMany : REQUIREMENT_STATE_KEYS.metThanks;
  return view.met ? (view.decisive ? translateText(thanks) : translateText(REQUIREMENT_STATE_KEYS.met)) :
    translateText(REQUIREMENT_STATE_KEYS.short);
}

export const REQUIREMENT_STATE_KEYS = {
  metThanks: 'Met thanks to the modifier',
  metThanksMany: 'Met thanks to the modifiers',
  /** TR62 — met through the alliance's partner. */
  metAlly: 'Met through the alliance',
  met: 'Met',
  short: 'Still short',
} as const;

// ── THE RULES PANEL: the printed requirement, and what bends it (TR49 class) ───────────────────────────

/** A row's translator (the panel's own `{text, params}` pair). */
type RowTranslator = {text: (key: string) => string, params: (key: string, params: Array<string>) => string};

export const RULE_EASING_KEYS = {
  shifted: 'Under an effect: ${0}',
  waived: 'Ignored: ${0}',
  /** TR62 — the party requirement met through the alliance's partner: «Через альянс: Альянс Тарсиса · альянс через «Марс вперёд»». */
  throughAlly: 'Met through the alliance: ${0}',
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
  if (easing.effective === 'allied') {
    return t.params(RULE_EASING_KEYS.throughAlly, [easingSourcesText(easing)]);
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
      const easing = easings.find((e) => e.key === row.id && !easingIsQuiet(e));
      if (easing !== undefined) {
        rows.push({id: `${row.id}:eased`, text: '${0}', params: [ruleEasingLine(easing, t)], special: false, anyPlayer: false});
      }
    }
    return {...group, rows};
  });
}

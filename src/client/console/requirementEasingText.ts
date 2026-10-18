/*
 * requirementEasingText — THE ONE WORDING of the TR49 class («a requirement
 * under a modifier», «an effect armed for one play»), shared by every surface
 * that names it: the availability verdict and panel, the inspector's «ДЛЯ
 * ВАС», the play composer's requirement row, the «ВЗВЕДЕНО» strip and the
 * «ЭФФЕКТЫ» section. Pure (no Vue, no DOM) — the readings are the server's
 * (`CardModel.requirementEasing`, `PublicPlayerModel.armedPlayEffects`); this
 * module only phrases them, so two surfaces can never name one modifier in
 * two ways.
 */
import {GlobalParameter} from '@/common/GlobalParameter';
import {EventSource} from '@/common/events/EventSource';
import {ArmedPlayEffectKind, ArmedPlayEffectModel, RequirementEasingModel, RequirementEasingSourceModel} from '@/common/models/ArmedPlayEffectModel';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {partyNameKey} from '@/client/console/parliament/partyNames';

/** The English i18n keys of the class (the text IS the key; RU in `armed_effects.json`). */
export const EASING_KEYS = {
  oneShot: 'One play',
  ignored: 'Ignored',
  requirementIgnored: 'Requirement ignored',
  thanksTo: 'thanks to ${0}',
  globalWaived: 'Global requirements ignored',
  globalShift: 'Global requirements ±${0}',
  discountNext: 'Next card −${0} M€',
  untilNextPlay: 'Until your next card play',
  armedHeading: 'Armed for your next card',
  modifier: 'Modifier',
  /** THE PARTY FAMILY (TR70 Backroom Deal): the next card's party requirement lifted. */
  partyWaived: 'Party requirement ignored',
  /** The party requirement's «bound» — «ruling or 2 delegates» (the printed rule's two roads, in the row's compact form). */
  partyBound: 'ruling or ${0} delegates',
  /** The struck plate's label in the strip / the section (the console's own key). */
  partyRequirement: 'Party requirement',
  /** THE ALLIANCE (TR62 Tharsis Alliance): a party requirement met THROUGH the partner party — «через «Марс вперёд»». */
  throughAlly: 'through ${0}',
  /** The share's tail — «Альянс Тарсиса · альянс с «Марс вперёд»». */
  allianceWith: 'alliance with ${0}',
} as const;

/** The partner's name an alliance stands on (TR62), in the parliament's words. */
function partnerName(easing: Pick<RequirementEasingModel, 'via'>): string {
  return easing.via !== undefined ? translateText(partyNameKey(easing.via)) : '';
}

const PARAMETER_LABELS: Readonly<Partial<Record<GlobalParameter, string>>> = {
  [GlobalParameter.TEMPERATURE]: 'Temperature',
  [GlobalParameter.OXYGEN]: 'Oxygen',
  [GlobalParameter.OCEANS]: 'Oceans',
  [GlobalParameter.VENUS]: 'Venus',
};

/** The scale's own unit, as the face and the reasons print it (none for a party requirement). */
export function easingUnit(parameter: GlobalParameter | undefined): string {
  switch (parameter) {
  case GlobalParameter.TEMPERATURE:
    return '°C';
  case GlobalParameter.OXYGEN:
  case GlobalParameter.VENUS:
    return '%';
  default:
    return '';
  }
}

/** «Температура» — the scale's translated name. */
export function easingParameterLabel(parameter: GlobalParameter | undefined): string {
  if (parameter === undefined) {
    return '';
  }
  const key = PARAMETER_LABELS[parameter];
  return key === undefined ? parameter : translateText(key);
}

/** WHAT the requirement is about — the scale's name, or (TR70) the PARTY's. */
export function easingSubjectLabel(easing: Pick<RequirementEasingModel, 'parameter' | 'party'>): string {
  return easing.party !== undefined ? translateText(partyNameKey(easing.party)) : easingParameterLabel(easing.parameter);
}

/** The modifier's own name — a card / corporation by its card name, a party by the parliament's name. */
export function easingSourceName(source: EventSource): string {
  switch (source.kind) {
  case 'card':
  case 'corporation':
    return translateText(source.card);
  case 'party':
    return translateText(partyNameKey(source.name));
  default:
    return translateText(EASING_KEYS.modifier);
  }
}

/** «≥ 0°C» / «≤ −18°C» — a bound of this requirement in its unit; a PARTY requirement's reads its two roads («ruling or 2 delegates»). */
export function easingBound(easing: RequirementEasingModel, value: number): string {
  if (easing.party !== undefined) {
    return translateTextWithParams(EASING_KEYS.partyBound, [String(value)]);
  }
  return `${easing.max ? '≤' : '≥'} ${value}${easingUnit(easing.parameter)}`;
}

/** «±2 Особая разработка · один розыгрыш» / «Новаторская разработка · один розыгрыш» — one modifier. */
export function easingShareText(share: RequirementEasingSourceModel): string {
  const parts: Array<string> = [];
  const name = easingSourceName(share.source);
  parts.push(share.kind === 'shift' && share.steps !== undefined ? `±${share.steps} ${name}` : name);
  if (share.kind === 'ally' && share.via !== undefined) {
    parts.push(translateTextWithParams(EASING_KEYS.allianceWith, [translateText(partyNameKey(share.via))]));
  }
  if (share.oneShot) {
    parts.push(translateText(EASING_KEYS.oneShot));
  }
  return parts.join(' · ');
}

/** Every modifier of one requirement, joined — the line under the bound. */
export function easingSourcesText(easing: RequirementEasingModel): string {
  return easing.sources.map(easingShareText).join(' · ');
}

/** The names of the modifiers (for «благодаря …»). */
export function easingSourceNames(easing: RequirementEasingModel): string {
  return easing.sources.map((s) => easingSourceName(s.source)).join(', ');
}

/**
 * THE REQUIREMENT'S FULL STATEMENT under its modifiers — the panel's / the
 * inspector's line: «Температура ≥ 0°C → −4°C» (eased) · «Температура ≥ 0°C —
 * требование игнорируется» (waived) · «Красные правят или 2 делегата → через
 * «Марс вперёд»» (allied, TR62). The printed bound always stands first.
 */
export function easingLine(easing: RequirementEasingModel): string {
  const head = `${easingSubjectLabel(easing)} ${easingBound(easing, easing.printed)}`;
  if (easing.effective === 'waived') {
    return `${head} — ${translateText(EASING_KEYS.requirementIgnored)}`;
  }
  if (easing.effective === 'allied') {
    return `${head} → ${translateTextWithParams(EASING_KEYS.throughAlly, [partnerName(easing)])}`;
  }
  return `${head} → ${easing.effective}${easingUnit(easing.parameter)}`;
}

/** The compact one-row form: «Температура ИГНОР.» / «Температура ≥ −4°C ±2». */
export function easingCompact(easing: RequirementEasingModel): string {
  const label = easingSubjectLabel(easing);
  if (easing.effective === 'waived') {
    return `${label} ${translateText(EASING_KEYS.ignored)}`;
  }
  if (easing.effective === 'allied') {
    return `${label} ${translateTextWithParams(EASING_KEYS.throughAlly, [partnerName(easing)])}`;
  }
  const steps = easing.sources.reduce((sum, s) => sum + (s.steps ?? 0), 0);
  return `${label} ${easingBound(easing, easing.effective)} ±${steps}`;
}

/** «благодаря «Особая разработка»» — the playable-thanks-to tail. */
export function easingThanksText(easings: ReadonlyArray<RequirementEasingModel>): string {
  const names = new Set<string>();
  for (const easing of easings) {
    for (const share of easing.sources) {
      names.add(easingSourceName(share.source));
    }
  }
  return translateTextWithParams(EASING_KEYS.thanksTo, [[...names].join(', ')]);
}

/** WHAT an armed effect does to the next card — «Требования глобальных параметров игнорируются» / «±2» / «−8 M€». */
export function armedEffectFormula(effect: ArmedPlayEffectKind): string {
  switch (effect.kind) {
  case 'requirementWaiver':
    return effect.parameter === undefined ?
      translateText(EASING_KEYS.globalWaived) :
      `${easingParameterLabel(effect.parameter)} — ${translateText(EASING_KEYS.requirementIgnored)}`;
  case 'requirementShift':
    return effect.parameter === undefined ?
      translateTextWithParams(EASING_KEYS.globalShift, [String(effect.steps)]) :
      `${easingParameterLabel(effect.parameter)} ±${effect.steps}`;
  case 'partyWaiver':
    return translateText(EASING_KEYS.partyWaived);
  case 'discount':
    return translateTextWithParams(EASING_KEYS.discountNext, [String(effect.amount)]);
  }
}

/** The armed effect's compact badge: «БЕЗ ТРЕБ.» is never printed — the strip draws a struck glyph; this is the text twin. */
export function armedEffectBadge(effect: ArmedPlayEffectKind): string {
  switch (effect.kind) {
  case 'requirementWaiver':
  case 'partyWaiver':
    return translateText(EASING_KEYS.ignored);
  case 'requirementShift':
    return `±${effect.steps}`;
  case 'discount':
    return `−${effect.amount}`;
  }
}

/** The struck-plate kind of an armed effect (the strip / chip / flight token draw the plate, not a badge). */
export function armedEffectStruckKind(kind: ArmedPlayEffectKind['kind']): 'global' | 'party' | undefined {
  return kind === 'requirementWaiver' ? 'global' : kind === 'partyWaiver' ? 'party' : undefined;
}

/** Does this armed effect bend a REQUIREMENT (vs. a price)? */
export function armedEffectIsRequirement(armed: ArmedPlayEffectModel): boolean {
  return armed.effect.kind !== 'discount';
}

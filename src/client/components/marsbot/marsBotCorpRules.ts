import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {CORP_SECTION_LABEL, MarsBotCorpSection, marsBotCorpInfo} from '@/common/automa/MarsBotCorpData';
import {DIVIDEND_SECTION_LABEL, marsBotDividendInfo} from '@/common/automa/MarsBotDividendData';
import {CardAnnotation} from '@/client/components/cardAnnotations/annotationModel';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

/**
 * The MarsBot corporation's FULL rule text, shaped as the card-annotation
 * groups the fullscreen viewer's right «§ ПРАВИЛА» panel renders — the same
 * panel, the same chassis, the same reading order as every card's structured
 * rules. Group kinds reuse the panel's accent language: the draft-priority
 * box takes the gold ACTION accent (the printed bronze kicker), the effect
 * box the blue EFFECT accent, the before-action-phase box the mint
 * on-play accent — colour families the player already reads.
 *
 * Texts are resolved HERE (translate + params) — the panel's own
 * `actionRuleText` pass is an identity for an already-resolved string.
 */

const SECTION_KIND: Readonly<Record<MarsBotCorpSection['kind'], CardAnnotation['kind']>> = {
  draftPriority: 'action',
  setup: 'immediate',
  effect: 'effect',
  beforeActionPhase: 'immediate',
  roundStart: 'immediate',
};

export function marsBotCorpAnnotations(id: MarsBotCorpId): ReadonlyArray<CardAnnotation> {
  const info = marsBotCorpInfo(id);
  return info.sections.map((section, index): CardAnnotation => ({
    id: `botcorp:${id}:${section.kind}`,
    kind: SECTION_KIND[section.kind],
    labelKey: CORP_SECTION_LABEL[section.kind],
    rows: section.lines.map((line, lineIndex) => ({
      id: `botcorp:${id}:${section.kind}:${lineIndex}`,
      text: line.params !== undefined && line.params.length > 0 ?
        translateTextWithParams(line.text, [...line.params]) :
        translateText(line.text),
      special: false,
      anyPlayer: false,
    })),
    special: false,
    anyPlayer: false,
    order: index,
  }));
}

/**
 * The rules of a HOLDING (the campaign portfolio): the bot plays it like any
 * corporation on the table, and the rules are where the difference is told —
 * its dividend FIRST (the one thing it does), then the printed boxes, each
 * marked as not acting while the corporation is held.
 */
export function marsBotHoldingAnnotations(id: MarsBotCorpId): ReadonlyArray<CardAnnotation> {
  const dividend = marsBotDividendAnnotation(id, 0, true);
  const printed = marsBotCorpAnnotations(id).map((group, i): CardAnnotation => ({
    ...group,
    order: i + 1,
    rows: [
      {id: `${group.id}:held`, text: translateText('Does not act while MarsBot holds this corporation'), special: false, anyPlayer: false},
      ...group.rows,
    ],
  }));
  return [dividend, ...printed];
}

/**
 * The «ДИВИДЕНДЫ» box — the campaign portfolio's fork box
 * (docs/claude/prompts/marsbot-portfolio-dividends.md). Kept APART from the
 * printed boxes above (`marsBotCorpAnnotations` is the printed card and only
 * it): the viewer appends this one in a campaign game, where it can apply. It
 * works only while the corporation is a HOLDING of the bot, and its first line
 * says so — the primary's own card never reads as if it scored twice.
 */
export function marsBotDividendAnnotation(id: MarsBotCorpId, order: number, holding: boolean = false): CardAnnotation {
  const box = marsBotDividendInfo(id);
  const lines = [
    {text: holding ?
      translateTextWithParams('${0}: MarsBot holds this corporation — it pays this dividend at the end of the game, its other boxes do not act', [translateText(box.name)]) :
      translateTextWithParams('${0}: works only while MarsBot holds this corporation (campaign)', [translateText(box.name)])},
    ...box.lines.map((line) => ({
      text: line.params !== undefined && line.params.length > 0 ?
        translateTextWithParams(line.text, [...line.params]) :
        translateText(line.text),
    })),
  ];
  return {
    id: `botcorp:${id}:dividend`,
    kind: 'victory-points',
    labelKey: DIVIDEND_SECTION_LABEL,
    rows: lines.map((line, i) => ({id: `botcorp:${id}:dividend:${i}`, text: line.text, special: false, anyPlayer: false})),
    special: false,
    anyPlayer: false,
    order,
  };
}

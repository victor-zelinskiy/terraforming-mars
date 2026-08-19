import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {CORP_SECTION_LABEL, MarsBotCorpSection, marsBotCorpInfo} from '@/common/automa/MarsBotCorpData';
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
  return info.sections.map((section, index) => ({
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

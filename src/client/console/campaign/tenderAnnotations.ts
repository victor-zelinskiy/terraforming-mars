// Campaign «ТЕНДЕРЫ» — THE CONTRACT'S READING in the ONE fullscreen viewer
// (the face's third pass, 2026-11-08 — the owner: «описание правил при X
// перенести с карты в блок правил справа — как мы делаем для проектов»).
// The face prints no prose at any size; X opens the viewer whose RIGHT column
// reads these blocks through the project card's own `ConsoleCardRulesPanel`
// and whose LEFT gutter reads the lore (`tenderLoreModel`). Pure: i18n keys
// and params, no translation here except the lore builder's injected one.

import {TENDER_COMPENSATION_MC, TenderId, tenderDef} from '@/common/campaign/tenders';
import {CardAnnotation, CardAnnotationKind} from '@/client/components/cardAnnotations/annotationModel';
import {LoreModel, loreLengthTier} from '@/client/cards/cardLore';
import {tenderMeta} from './tenderMeta';

type Row = string | {text: string, params: ReadonlyArray<string>};

function block(id: string, kind: CardAnnotationKind, labelKey: string, rows: ReadonlyArray<Row>, order: number): CardAnnotation {
  return {
    id,
    kind,
    labelKey,
    rows: rows.map((row, i) => ({
      id: `${id}:${i}`,
      text: typeof row === 'string' ? row : row.text,
      params: typeof row === 'string' ? undefined : [...row.params],
      special: false,
      anyPlayer: false,
    })),
    special: false,
    anyPlayer: false,
    order,
  };
}

/** WHEN the contract is executed — one sentence per window (English i18n keys). */
const WINDOW_RULE_KEY = {
  legacy: 'On the finale\'s threshold — the legacy step, before the finale is launched.',
  start: 'At the finale\'s start, while your initial selection is still open.',
} as const;

/**
 * The right column, in reading order: what the contract does · when it is executed · what it is worth unexecuted.
 * The tier, the lot and the window's NAME stay on the face — the column says only what the face cannot print.
 */
export function tenderAnnotations(id: TenderId): ReadonlyArray<CardAnnotation> {
  const meta = tenderMeta(id);
  const def = tenderDef(id);
  return [
    block('group:tender', 'immediate', 'Tender effect', [meta.ruleKey], 0),
    block('group:window', 'effect', 'When it is executed', [WINDOW_RULE_KEY[def.window]], 1),
    block('group:buyout', 'note', 'If it is not executed', [{text: 'The Committee buys it back for ${0} M€ at the finale\'s start.', params: [String(TENDER_COMPENSATION_MC)]}], 2),
  ];
}

/** The contract's lore for the viewer's left gutter (the archive block the project card lends its entry to). */
export function tenderLoreModel(id: TenderId, translate: (englishText: string) => string): LoreModel {
  const source = tenderMeta(id).loreKey;
  const text = translate(source);
  return {source, text, fallback: false, tier: loreLengthTier(text)};
}

/**
 * THE CLASSIC TURMOIL CARDS THE REDUX SET REPLACES — re-exported for the server's
 * readers. The rows (the printed set's fact: classic name, kind, scan, what the
 * scan changes) and the TR71…TR76 numbering live in `common/cards/
 * turmoilReduxReplacements.ts`, because the premium scope reads them on both
 * sides (`common/cards/premiumScope.ts` — a replaced classic card never enters it).
 */
export type {ClassicReplacement} from '../../../common/cards/turmoilReduxReplacements';
export {
  TURMOIL_REDUX_CLASSIC_REPLACEMENTS,
  TURMOIL_REDUX_REPLACED_CLASSIC_NAMES,
  replacementCardNumber,
} from '../../../common/cards/turmoilReduxReplacements';

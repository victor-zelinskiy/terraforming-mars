/*
 * Endgame RICH-TEXT token layer (Iteration 17 §4).
 *
 * Turns a translated i18n TEMPLATE (with `${0}` … placeholders) + its render params into a
 * flat list of structural tokens — plain-text runs and INTERACTIVE TERMS (player names in
 * colour, hoverable strategy / card terms, accented numbers). The renderer (EndgameRichText.vue)
 * walks the tokens; it never parses prose or uses v-html.
 *
 * The split is over the CONTROLLED template's own `${n}` markers — the exact substitution
 * `translateTextWithParams` performs — NOT over arbitrary translated prose, so it is
 * deterministic and safe. PURE: no Vue / DOM / i18n (texts arrive already translated).
 */
import type {Color} from '@/common/Color';
import type {NarrativeTermKind} from '@/client/components/endgame/insightEngine';
import type {ChipDetail} from '@/client/components/endgame/insightDetail';

/** A render param — the final (already-translated) text plus optional term metadata. */
export type RichParam = {
  text: string;
  kind?: NarrativeTermKind;
  color?: Color;
  detail?: ChipDetail;
  accent?: boolean;
};

export type NarrativeToken =
  | {type: 'text'; text: string}
  | {type: 'term'; kind: NarrativeTermKind; text: string; color?: Color; detail?: ChipDetail; accent?: boolean};

const PLACEHOLDER = /\$\{(\d+)\}/g;

/**
 * Build the ordered tokens for a template + params. A placeholder whose param carries a
 * `kind` becomes an interactive TERM; otherwise the param's text is inlined as plain text.
 * An out-of-range placeholder is left literal (defensive — never throws).
 */
export function buildNarrativeTokens(template: string, params: ReadonlyArray<RichParam>): Array<NarrativeToken> {
  const tokens: Array<NarrativeToken> = [];
  let last = 0;
  let match: RegExpExecArray | null;
  PLACEHOLDER.lastIndex = 0;
  while ((match = PLACEHOLDER.exec(template)) !== null) {
    if (match.index > last) {
      tokens.push({type: 'text', text: template.slice(last, match.index)});
    }
    const p = params[Number(match[1])];
    if (p === undefined) {
      tokens.push({type: 'text', text: match[0]});
    } else if (p.kind === undefined) {
      tokens.push({type: 'text', text: p.text});
    } else {
      tokens.push({type: 'term', kind: p.kind, text: p.text, color: p.color, detail: p.detail, accent: p.accent});
    }
    last = PLACEHOLDER.lastIndex;
  }
  if (last < template.length) {
    tokens.push({type: 'text', text: template.slice(last)});
  }
  return tokens;
}

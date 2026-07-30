/**
 * @console-shared LIVE — console native stands on this file, so it is NOT covered
 * by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).
 *
 * ACTION RULE TEXT — the ONE resolver for «what does THIS action do?».
 *
 * The console action workspace needs prose for the action the player is
 * looking at / configuring — not for the card as a whole. A card can draw two
 * actions (or an «or» pair), and each must speak for itself.
 *
 * Two authored sources already exist and neither is re-implemented here:
 *
 *  1. `metadata.information` — the generated, curated, per-graphic-block card
 *     text the fullscreen ПРАВИЛА tab reads (`buildCardAnnotations`). Every
 *     action gets its OWN group, keyed by the action's graphic id
 *     (`g:<nodeGraphicToken>`), and a bespoke card may add a `note` block with
 *     the printed fine print — text that exists NOWHERE else.
 *  2. The render node's co-located DSL description (`actionNodeDescription`) —
 *     universal (every `action()` box carries one) and index-exact by
 *     construction, so it covers every card, including modules the
 *     information generator has not been widened to yet.
 *
 * The resolver addresses (1) by CONTENT (the graphic token of the very node
 * the caller is pointing at), never by a bare ordinal, and falls back through
 * text identity → same-count ordinal → the printed description. For a
 * generated card both sources yield the same string, so the honest answer is
 * one line, never a doubled one.
 *
 * Pure: no Vue, no DOM. `text` values are ENGLISH i18n keys (project
 * convention) — `actionRuleText()` is the shared translate + strip + sentence
 * formatter every host uses, so the wording can never drift between the
 * fullscreen rules panel, the action browser and the setup stage.
 */

import {CardName} from '@/common/cards/CardName';
import {CardInfoGroup} from '@/common/cards/CardInformation';
import {getCard} from '@/client/cards/ClientCardManifest';
import {nodeGraphicToken} from '@/common/cards/render/cardGraphicIds';
import {ActionGroup, actionNodeDescription} from '@/client/components/actions/actionExtraction';
import {stripKindPrefix} from '@/client/components/cardAnnotations/annotationModel';
import {translateText} from '@/client/directives/i18n';

type GroupNode = ActionGroup['nodes'][number];

/** A rule line of ONE action. `text` is an English i18n key. */
export type ActionRuleLine = {
  /** `rule` — what the action does; `note` — its printed fine print. */
  kind: 'rule' | 'note';
  text: string;
};

export type ActionRules = {
  lines: ReadonlyArray<ActionRuleLine>;
  /** The single line a compact host shows (the browser's action slot). */
  summary: string;
};

/** The i18n label keys — the SAME vocabulary as the fullscreen rules tab. */
export const ACTION_RULE_LABEL: Readonly<Record<ActionRuleLine['kind'], string>> = {
  rule: 'Action',
  note: 'Special rule',
};

/**
 * Translate + strip the co-located `Action: ` / `Действие: ` prefix (the block
 * carries its kind as a chip) + read as a sentence. The one formatter for
 * every host of card rule text.
 */
export function actionRuleText(key: string): string {
  const text = stripKindPrefix(translateText(key));
  return text.length > 0 ? text[0].toLocaleUpperCase() + text.slice(1) : text;
}

/** The information groups that describe ACTIONS of this card, in card order. */
function actionInfoGroups(cardName: CardName): ReadonlyArray<CardInfoGroup> {
  const groups = getCard(cardName)?.metadata.information?.groups;
  return groups === undefined ? [] : groups.filter((g) => g.kind === 'action');
}

/**
 * The information group describing THIS node. Graded, most exact first:
 *  1. the node's own graphic token (`g:<token>`, `~N` for a card that draws
 *     two literally identical rows) — content-derived, so it cannot drift;
 *  2. text identity (a generated action block IS the node's DSL description);
 *  3. the ordinal, and only when the two enumerations agree on the count —
 *     which is what makes an AUTHORED corp action (whose text deliberately
 *     differs from the printed one) reachable.
 */
function infoGroupForNode(cardName: CardName, node: GroupNode, nodeIndex: number, nodeCount: number): CardInfoGroup | undefined {
  const groups = actionInfoGroups(cardName);
  if (groups.length === 0) {
    return undefined;
  }
  const token = node.actionNode === undefined ? undefined : nodeGraphicToken(node.actionNode);
  if (token !== undefined) {
    const byToken = groups.filter((g) => g.id === `g:${token}` || g.id.startsWith(`g:${token}~`));
    if (byToken.length === 1) {
      return byToken[0];
    }
    // Several identical action rows: keep the reading order between them.
    if (byToken.length > 1) {
      const twins = groups.filter((g) => byToken.includes(g));
      return twins[Math.min(nodeIndex, twins.length - 1)];
    }
  }
  const printed = actionNodeDescription(node);
  if (printed !== '') {
    const byText = groups.find((g) => g.blocks.some((b) => b.text === printed));
    if (byText !== undefined) {
      return byText;
    }
  }
  return groups.length === nodeCount ? groups[nodeIndex] : undefined;
}

/** Keep the lines a rule block should SPEAK; drop what the stage already draws. */
function linesOf(group: CardInfoGroup): Array<ActionRuleLine> {
  const lines: Array<ActionRuleLine> = [];
  const seen = new Set<string>();
  const push = (kind: ActionRuleLine['kind'], text: string) => {
    if (text !== '' && !seen.has(text)) {
      seen.add(text);
      lines.push({kind, text});
    }
  };
  for (const block of group.blocks) {
    if (block.kind === 'action') {
      push('rule', block.text);
    }
  }
  // The cost / result parts speak only when the group has no headline rule —
  // otherwise they would repeat the «Будет списано / Вы получите» chips.
  if (lines.length === 0) {
    for (const block of group.blocks) {
      if (block.kind === 'action-cost' || block.kind === 'action-result') {
        push('rule', block.text);
      }
    }
  }
  for (const block of group.blocks) {
    if (block.kind === 'note') {
      push('note', block.text);
    }
  }
  return lines;
}

/**
 * The rule text of ONE action of a card — the action the caller is pointing
 * at, never the card as a whole.
 *
 * @param group      the card's action group (`playerActionGroups`)
 * @param nodeIndex  which action node; < 0 (a combined whole-card draft) has
 *                   no single rule and returns undefined
 * @param fallback   an already-localized last resort (the preview branch's
 *                   title) for a card that carries neither source
 */
export function actionRules(group: ActionGroup, nodeIndex: number, fallback?: string): ActionRules | undefined {
  const node = nodeIndex < 0 ? undefined : group.nodes[nodeIndex];
  if (node === undefined) {
    return undefined;
  }
  const info = infoGroupForNode(group.cardName, node, nodeIndex, group.nodes.length);
  const lines = info === undefined ? [] : linesOf(info);
  if (lines.length === 0) {
    const printed = actionNodeDescription(node);
    if (printed !== '') {
      lines.push({kind: 'rule', text: printed});
    }
  }
  if (lines.length === 0 && fallback !== undefined && fallback !== '') {
    lines.push({kind: 'rule', text: fallback});
  }
  if (lines.length === 0) {
    return undefined;
  }
  return {lines, summary: lines[0].text};
}

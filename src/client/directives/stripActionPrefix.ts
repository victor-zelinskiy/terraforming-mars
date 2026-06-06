import {ObjectDirective} from 'vue';

/*
 * Strips a leading "Action: " / "Действие: " label from the action descriptions
 * shown in the Actions overlay (and the action-confirm modal), and uppercases
 * the following letter. The label is redundant there (the whole tab IS actions)
 * and it eats horizontal space, so dropping it lets the blocks render tighter.
 *
 * The sibling of `stripEffectPrefix` (which strips "Effect: ") — same DISPLAY-
 * ONLY, overlay-scoped contract: the card render keeps its "Action:" label, and
 * the underlying i18n keys / descriptions are untouched (the strip happens on
 * the already-localized DOM text). Listed AFTER `v-i18n` on the element so the
 * text is already translated. EN + RU covered; other locales keep their label.
 * Idempotent. Also handles a leading "(" wrapper (some cards wrap the whole
 * action text in parentheses, e.g. Weather Balloons' "(Action: …)").
 */

const PREFIXES = ['Action: ', 'Действие: '];

function stripPrefix(data: string): string {
  for (const prefix of PREFIXES) {
    if (data.startsWith(prefix)) {
      const rest = data.slice(prefix.length);
      return rest.charAt(0).toUpperCase() + rest.slice(1);
    }
    const wrapped = '(' + prefix;
    if (data.startsWith(wrapped)) {
      const rest = data.slice(wrapped.length);
      return '(' + rest.charAt(0).toUpperCase() + rest.slice(1);
    }
  }
  return data;
}

function stripNode(node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child as Text;
      const stripped = stripPrefix(text.data);
      if (stripped !== text.data) {
        text.data = stripped;
      }
    } else {
      stripNode(child);
    }
  }
}

export const stripActionPrefix: ObjectDirective<HTMLElement> = {
  mounted: stripNode,
  updated: stripNode,
};

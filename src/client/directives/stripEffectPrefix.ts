import {ObjectDirective} from 'vue';

/*
 * Strips a leading "Effect: " / "Эффект: " label from the effect descriptions
 * shown in the Effects overlay, and uppercases the following letter. The label
 * is redundant there (the whole tab IS effects) and it eats horizontal space on
 * the modal, so dropping it lets the blocks render tighter.
 *
 * This is a DISPLAY-ONLY, overlay-scoped tweak — the card render keeps its
 * "Effect:" label, and the underlying i18n keys / descriptions are untouched
 * (the strip happens on the already-localized DOM text).
 *
 * Listed AFTER `v-i18n` on the element, so by the time this runs the description
 * has already been translated. EN + RU are covered (the fork's languages); other
 * locales simply keep their label (harmless). Idempotent — re-running on an
 * already-stripped node is a no-op.
 */

// Known localized variants of the DSL's baked-in 'Effect: ' prefix.
const PREFIXES = ['Effect: ', 'Эффект: '];

// Strip the label from the START of a text node, OR right after a leading "(" —
// some cards wrap the whole effect text in parentheses (e.g. Neptunian Power
// Consultants' `plainText('(Effect: …)')`, where "(" + label live in ONE text
// node), whereas a `CardDescription` keeps "(" in a separate node so its inner
// text starts with the label directly. Both are handled; the next letter is
// uppercased and the wrapping "(" preserved.
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

export const stripEffectPrefix: ObjectDirective<HTMLElement> = {
  mounted: stripNode,
  updated: stripNode,
};

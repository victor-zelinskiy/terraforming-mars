/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A SUPPORT PLACE'S ONE-SHOT ANSWER — an ATTRIBUTE, never a class (FLAKE ZERO, 2026-11-16).
 *
 * A socket of a party's support area (`ConsoleSupportPlaces.vue` — one `v-for` row of a Vapor template) answers a
 * cube's TOUCHDOWN (`landed` — the sitting's support scene, the vote mode's grant) and a cube's LIFT-OFF (`left` —
 * TR12's discard) with a one-shot animation that ends on its own. The very callback that lights it also moves the
 * count the socket's bound `:class` reads (`parliamentHolds.supportIncoming` → `--on`; `supportDiscard`'s
 * `standing − 1`), and on a NON-ROOT element a Vapor class binding whose value changes writes `className` WHOLE
 * (`runtime-vapor` `setClass` — only a component root is patched incrementally): a class added with `classList.add`
 * was wiped by that same flush, before any frame, so the touchdown answer of every support cube never painted. The
 * law of `data-sweep` / `data-peek` (`.claude/rules/tests.md` law 19): state written imperatively onto an element
 * whose classes are bound is an attribute, and the sheet keys on it (`console_party_plaque.less`).
 */

export type SupportPlaceAnswer = 'landed' | 'left';

/** The attribute each answer's keyframes key on (`console_party_plaque.less`). */
export const SUPPORT_PLACE_ANSWER_ATTR: Readonly<Record<SupportPlaceAnswer, string>> = {
  landed: 'data-support-landed',
  left: 'data-support-left',
};

/** The selector of every place under a root that is playing `answer` now. */
export function answeringSupportPlaces(answer: SupportPlaceAnswer): string {
  return `.con-pseal__support-place[${SUPPORT_PLACE_ANSWER_ATTR[answer]}]`;
}

/** Play a place's answer ONCE (restarting it when it is already playing); it ends on its own `animationend`. */
export function answerSupportPlaceOnce(el: HTMLElement, answer: SupportPlaceAnswer): void {
  const attr = SUPPORT_PLACE_ANSWER_ATTR[answer];
  if (el.hasAttribute(attr)) {
    el.removeAttribute(attr);
    void el.offsetWidth; // a restyle between the two writes restarts the keyframes
  }
  el.setAttribute(attr, '');
  el.addEventListener('animationend', () => el.removeAttribute(attr), {once: true});
}

/** End a place's answer now (another socket's answer takes over — one socket answers at a time). */
export function endSupportPlaceAnswer(el: Element, answer: SupportPlaceAnswer): void {
  el.removeAttribute(SUPPORT_PLACE_ANSWER_ATTR[answer]);
}

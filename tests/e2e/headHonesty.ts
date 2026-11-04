import {expect, Page} from './consoleTest';

/**
 * THE HEAD IS HONEST (P60 · FX — the workspace head `ConsoleWsHead`, every host): on the head the player SEES,
 *
 *   ① no text member of the crumb paints into the TRAILING zone (the seats strip, a fleet dock, a counter) — a
 *     member's ink ends before the zone's box begins;
 *   ② the STAGE is whole — the line's one moving word never yields width (its ink is its full text);
 *   ③ a member with more text than room is the SUBJECT, cut by an ellipsis in its OWN box.
 *
 * The 4K frame that named it: «СТАРТ ПАРТИИ › ВОСХОЖДЕНИЕ … › ГОЛОСОВАНИЕ · 2» with « / 3» painted under
 * «ConsoleTester» — the stage's grid cell shrank beside the subject (`min-width: 0`), its nowrap word did not clip.
 * Returns the reading it judged, for the caller's annotation.
 */
export async function expectHeadHonest(page: Page, label: string): Promise<string> {
  const reading = await page.evaluate(() => {
    const visible = (el: Element) => (el as HTMLElement).checkVisibility({opacityProperty: true, visibilityProperty: true});
    const heads = Array.from(document.querySelectorAll<HTMLElement>('.con-wshead')).filter(visible);
    const head = heads[heads.length - 1];
    if (head === undefined) {
      return {problems: ['no visible workspace head'], told: ''};
    }
    const problems: Array<string> = [];
    const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    const trailing = head.querySelector<HTMLElement>(':scope > .con-wshead__trailing');
    const edge = trailing === null || trailing.getBoundingClientRect().width === 0 ? Infinity : trailing.getBoundingClientRect().left;
    const deep = head.querySelector<HTMLElement>('.con-wshead__layer--deep');
    const members = deep === null ? [] : Array.from(deep.querySelectorAll<HTMLElement>('.con-wshead__subject, .con-wshead__step, .con-wshead__sep'))
      .filter((el) => visible(el) && el.getBoundingClientRect().width > 0);
    for (const el of members) {
      const r = el.getBoundingClientRect();
      // The INK, not the box: a nowrap word that does not clip paints past its own box (scrollWidth).
      const inkRight = r.left + Math.max(r.width, el.scrollWidth);
      if (inkRight > edge + 1) {
        problems.push(`«${text(el)}» paints into the trailing zone: ink to ${Math.round(inkRight)} past ${Math.round(edge)}`);
      }
      if (el.classList.contains('con-wshead__step') && el.scrollWidth > el.clientWidth + 1) {
        problems.push(`the stage «${text(el)}» is cut: ${el.scrollWidth} > ${el.clientWidth}`);
      }
      if (el.classList.contains('con-wshead__subject') && el.scrollWidth > el.clientWidth + 1) {
        const cs = getComputedStyle(el);
        if (cs.textOverflow !== 'ellipsis' || cs.overflowX === 'visible') {
          problems.push(`the subject «${text(el)}» is cut without its own ellipsis`);
        }
      }
    }
    const told = members.map((el) => `${el.className.toString().split(' ')[0].replace('con-wshead__', '')}:${Math.round(el.getBoundingClientRect().width)}/${el.scrollWidth}`).join(' ') +
      ` | trailing@${edge === Infinity ? '-' : Math.round(edge)}`;
    return {problems, told};
  });
  expect(reading.problems, `${label}: the head is honest (${reading.told})`).toEqual([]);
  return reading.told;
}

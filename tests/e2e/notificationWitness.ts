import {Page} from './consoleTest';

/**
 * THE NOTIFICATION CARD'S HONESTY, read off the painted page (P53 · ledger FK — «ЛЕНТА: В СВОЕЙ ПОЛОСЕ · ЧИСЛО НЕ
 * РЕЖЕТСЯ · ОДНА СТРОКА ПРИЧИНЫ · ИСТОЧНИК ОДИН РАЗ»). One reader every notification stand calls at the moment its card
 * stands; each list names the cards that broke one rule, so a red says WHICH card and WHAT:
 *  · `clippedValues` — a hero number whose box leaves its card («РАСТЕНИЯ —» at 720p);
 *  · `overRail` — a card / the queue tail painted over the strategy rail (`.con-strat`) — PL-553 on every profile;
 *  · `strandedSeparator` — a wrapped cause line that STARTS with «·»;
 *  · `emoji` — a pictograph in the card's text (🏆 🏅 ⚖ ⚠ rendered as pictures);
 *  · `sourceTwice` — the kicker's card named again in the card's body (PL-548).
 * Only cards at full presence count (a card in its entrance / leave belongs to another state).
 */
export type NotificationHonesty = {
  cards: number,
  clippedValues: Array<string>,
  overRail: Array<string>,
  strandedSeparator: Array<string>,
  emoji: Array<string>,
  sourceTwice: Array<string>,
};

export async function notificationHonesty(page: Page): Promise<NotificationHonesty> {
  return await page.evaluate(() => {
    const out = {cards: 0, clippedValues: [] as Array<string>, overRail: [] as Array<string>, strandedSeparator: [] as Array<string>,
      emoji: [] as Array<string>, sourceTwice: [] as Array<string>};
    const opacityChain = (el: Element): number => {
      let o = 1;
      for (let n: Element | null = el; n !== null; n = n.parentElement) {
        o *= Number.parseFloat(getComputedStyle(n).opacity || '1');
      }
      return o;
    };
    const visibleRect = (el: Element | null): DOMRect | undefined => {
      if (el === null) {
        return undefined;
      }
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') {
        return undefined;
      }
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 ? r : undefined;
    };
    const overlap = (a: DOMRect, b: DOMRect): number =>
      Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const rail = visibleRect(document.querySelector('.con-strat'));
    const railOn = rail !== undefined && opacityChain(document.querySelector('.con-strat') as Element) > 0.5;
    const tail = document.querySelector('.con-notifq');
    const tailRect = visibleRect(tail);
    if (railOn && tailRect !== undefined && overlap(tailRect, rail!) > 4) {
      out.overRail.push(`queue tail ${Math.round(tailRect.left)}..${Math.round(tailRect.right)} over the rail from ${Math.round(rail!.left)}`);
    }
    for (const card of Array.from(document.querySelectorAll('.con-notif'))) {
      const box = visibleRect(card);
      if (box === undefined || opacityChain(card) < 0.95) {
        continue;
      }
      out.cards++;
      const id = card.getAttribute('data-notif-id') ?? '?';
      for (const value of Array.from(card.querySelectorAll('.con-notif__chip-value'))) {
        const r = value.getBoundingClientRect();
        if (r.right > box.right + 1 || r.left < box.left - 1 || (value as HTMLElement).scrollWidth > (value as HTMLElement).clientWidth + 1) {
          out.clippedValues.push(`${id}: «${value.textContent ?? ''}» at ${Math.round(r.left)}..${Math.round(r.right)}, card ${Math.round(box.left)}..${Math.round(box.right)}`);
        }
      }
      if (railOn && overlap(box, rail!) > 4) {
        out.overRail.push(`${id}: card ${Math.round(box.left)}..${Math.round(box.right)} over the rail from ${Math.round(rail!.left)}`);
      }
      for (const tails of Array.from(card.querySelectorAll('.con-notif__cause-tails'))) {
        const items = Array.from(tails.children);
        let lastTop = Number.NEGATIVE_INFINITY;
        for (const item of items) {
          const top = Math.round(item.getBoundingClientRect().top);
          const startsRow = top > lastTop + 2;
          lastTop = Math.max(lastTop, top);
          if (!startsRow) {
            continue;
          }
          const before = getComputedStyle(item, '::before').content;
          const text = (item.textContent ?? '').trim();
          if (before.includes('·') || text.startsWith('·')) {
            out.strandedSeparator.push(`${id}: a row starts with «·» — «${text}»`);
          }
        }
      }
      const text = card.textContent ?? '';
      if (/\p{Extended_Pictographic}/u.test(text)) {
        out.emoji.push(`${id}: ${text.match(/\p{Extended_Pictographic}/gu)?.join(' ')}`);
      }
      const kicker = (card.querySelector('[data-notif-type-card]')?.textContent ?? '').trim();
      if (kicker !== '') {
        const names = Array.from(card.querySelectorAll('.con-notif__card, .con-notif__cause-via')).filter((el) => (el.textContent ?? '').includes(kicker));
        if (names.length > 0) {
          out.sourceTwice.push(`${id}: «${kicker}» in the kicker and ${names.length}× in the body`);
        }
      }
    }
    return out;
  });
}

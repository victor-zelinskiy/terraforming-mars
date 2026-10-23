import * as fs from 'fs';
import * as path from 'path';
import {Page} from '@playwright/test';

/**
 * CH · «ЖУРНАЛ — ХРОНИКА, НЕ ЛОГ» — the three MOCKUPS the owner chooses from (decisions 5 and 6), painted as CSS plus a
 * few DOM tweaks OVER THE LIVE PANEL (the real fixture, the real rows) — never shipped, never a second panel. What a
 * mockup may not do is pretend: every number, name and picture is the panel's own; the tweaks only regroup it.
 *
 *   M1 — decision 5a whole: the event CARD (bigger art in the CF glass, a display-face headline, the consequences one
 *        tier quieter without arrows, the time ONCE per run of equal times in a gutter, a draw as a FAN of faces, the
 *        generation a plate);
 *   M2 — decision 5b: the panel's material + the bigger art + the time once — the chips as they are;
 *   M3 — M1 as PAGES of a chronicle: the art the card's full-width banner, the headline over it, the consequences under.
 */
export type JournalMock = 'M1' | 'M2' | 'M3';

/** RU card name → its art thumb URL, read off the build's own catalog (the panel's chips carry the translated name). */
export function journalArtIndex(): Record<string, string> {
  const root = path.resolve(__dirname, '..', '..');
  const ru = JSON.parse(fs.readFileSync(path.join(root, 'assets', 'locales', 'ru.json'), 'utf8')) as Record<string, string>;
  const cards = JSON.parse(fs.readFileSync(path.join(root, 'src', 'genfiles', 'cards.json'), 'utf8')) as
    Array<{name: string, metadata?: {cardNumber?: string}}> | Record<string, {name: string, metadata?: {cardNumber?: string}}>;
  const art = new Set(JSON.parse(fs.readFileSync(path.join(root, 'src', 'genfiles', 'cardArtManifest.json'), 'utf8')) as Array<string>);
  const out: Record<string, string> = {};
  for (const card of Array.isArray(cards) ? cards : Object.values(cards)) {
    const key = card.metadata?.cardNumber;
    if (key === undefined || !art.has(key)) {
      continue;
    }
    const url = `assets/card-images/thumb/${key}.webp`;
    out[card.name] = url;
    const translated = ru[card.name];
    if (translated !== undefined) {
      out[translated] = url;
    }
  }
  return out;
}

/** The CF plate (T03 · M3 «одна стеклянная плита») — the journal speaks the same glass, never a third. */
const PLATE = `
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 1.2rem),
    linear-gradient(180deg, rgba(32, 44, 60, 0.94), rgba(11, 18, 28, 0.96)) !important;
  box-shadow:
    inset 0 .07rem 0 rgba(255, 255, 255, 0.08),
    inset 0 -.08rem 0 rgba(0, 0, 0, 0.5),
    inset .07rem 0 0 rgba(0, 229, 255, 0.26),
    -.4rem 0 1.4rem rgba(0, 0, 0, 0.45) !important;
`;

const SHARED = `
  .con-journal.jm { ${PLATE} }
  .con-journal.jm .con-journal__header { background: linear-gradient(180deg, rgba(255,255,255,.03), transparent) !important; }
  .con-journal.jm .journal-group__time.jm-time-dup, .con-journal.jm .journal-entry__time.jm-time-dup { visibility: hidden !important; width: 0 !important; margin: 0 !important; padding: 0 !important; }
  .con-journal.jm .journal-group__time.jm-time-lead, .con-journal.jm .journal-entry__time.jm-time-lead {
    color: rgba(150, 200, 230, .72) !important; letter-spacing: .08rem !important;
  }
  .con-journal.jm .journal-gen-divider { margin: 1.1rem 0 .6rem !important; }
  .con-journal.jm .journal-gen-divider__line { display: none !important; }
  .con-journal.jm .journal-gen-divider__label {
    flex: 1 !important; text-align: center !important; padding: .35rem .8rem !important; border-radius: .35rem !important;
    letter-spacing: .3rem !important; color: #e8f4ff !important;
    background: linear-gradient(90deg, transparent, rgba(0, 229, 255, .14) 30%, rgba(0, 229, 255, .14) 70%, transparent) !important;
    box-shadow: inset 0 .05rem 0 rgba(255,255,255,.08), inset 0 -.05rem 0 rgba(0,0,0,.4) !important;
  }
`;

/** The event card's art — larger than the thumb row, cropped by the glass frame, ≥ 160 px at 4K. */
const ART = `
  .con-journal.jm .journal-group__object {
    width: 6.2rem !important; height: 4.15rem !important; flex-shrink: 0 !important; border-radius: .35rem !important; overflow: hidden !important;
    box-shadow: 0 0 0 .06rem rgba(255, 255, 255, .14), inset 0 0 0 .06rem rgba(0, 0, 0, .4), 0 .25rem .6rem rgba(0, 0, 0, .55) !important;
  }
  .con-journal.jm .journal-group__art { width: 100% !important; height: 100% !important; object-fit: cover !important; }
`;

const M1 = `
  ${SHARED}
  ${ART}
  .con-journal.jm-m1 .journal-group {
    display: grid !important; grid-template-columns: auto minmax(0, 1fr); grid-template-areas: "time time" "art head" "art body";
    column-gap: .8rem; row-gap: .35rem; align-items: start;
    padding: .6rem .7rem .65rem !important; margin: .55rem .15rem !important; border: 0 !important; border-radius: .5rem !important;
    background: linear-gradient(180deg, rgba(255, 255, 255, .045), transparent 1rem), rgba(20, 31, 44, .78) !important;
    box-shadow: inset 0 .05rem 0 rgba(255,255,255,.07), inset 0 -.06rem 0 rgba(0,0,0,.5), inset .14rem 0 0 var(--jg-accent), 0 .18rem .55rem rgba(0,0,0,.4) !important;
  }
  .con-journal.jm-m1 .journal-group__spine, .con-journal.jm-m1 .journal-group__tick { display: none !important; }
  .con-journal.jm-m1 .journal-group__root { display: contents !important; }
  .con-journal.jm-m1 .journal-group__object { grid-area: art; }
  .con-journal.jm-m1 .journal-group__time { grid-area: time; font-size: var(--con-t-floor) !important; }
  .con-journal.jm-m1 .journal-group__time.jm-time-dup { display: none !important; }
  .con-journal.jm-m1 .journal-group__root-body {
    grid-area: head; font-family: Prototype, Ubuntu, sans-serif !important; font-size: calc(var(--con-t-body) * 1.12) !important;
    line-height: 1.3 !important; color: #f1f7ff !important; letter-spacing: .02rem;
  }
  .con-journal.jm-m1 .journal-group__root-body .journal-player { background: none !important; box-shadow: none !important; padding: 0 !important; }
  .con-journal.jm-m1 .journal-group__root-body .journal-chip--card { background: none !important; border: 0 !important; padding: 0 !important; font-weight: 700 !important; color: #ffffff !important; }
  .con-journal.jm-m1 .journal-group__root-body .journal-chip__dot { display: none !important; }
  .con-journal.jm-m1 .journal-group__children { grid-area: body; margin: 0 !important; padding: 0 !important; display: flex; flex-direction: column; gap: .25rem; }
  .con-journal.jm-m1 .journal-group__child { padding: 0 !important; margin: 0 !important; }
  .con-journal.jm-m1 .journal-group__child-body { opacity: .92; }
  .con-journal.jm-m1 .journal-child-row__arrow { display: none !important; }
  .con-journal.jm-m1 .journal-child-row__src.jm-src-dup { display: none !important; }
  .con-journal.jm-m1 .journal-child-row__chip { background: rgba(255,255,255,.04) !important; box-shadow: inset 0 0 0 .05rem rgba(255,255,255,.08) !important; }
  .con-journal.jm-m1 .journal-entry { padding: .35rem .7rem !important; opacity: .9; }
  /* THE FAN — a draw's cards as faces, never a sheet of names. */
  .con-journal.jm .jm-hidden { display: none !important; }
  .con-journal.jm .jm-fan { display: flex; align-items: flex-end; padding: .25rem 0 .1rem .2rem; }
  .con-journal.jm .jm-mini {
    width: 2.7rem; height: 3.85rem; margin-left: -.55rem; border-radius: .22rem; flex-shrink: 0; position: relative;
    background: #18222e center / cover no-repeat;
    box-shadow: 0 0 0 .05rem rgba(255,255,255,.18), 0 .2rem .45rem rgba(0,0,0,.6);
  }
  .con-journal.jm .jm-mini:first-child { margin-left: 0; }
  .con-journal.jm .jm-mini--kept { box-shadow: 0 0 0 .07rem rgba(120, 230, 170, .85), 0 .2rem .45rem rgba(0,0,0,.6); }
  .con-journal.jm .jm-mini--discard { opacity: .55; }
  .con-journal.jm .jm-mini::after {
    content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 32%;
    background: linear-gradient(180deg, transparent, rgba(8, 12, 18, .85)); border-radius: 0 0 .22rem .22rem;
  }
  .con-journal.jm .jm-fan-tail { margin-left: .6rem; font-size: var(--con-t-floor); color: rgba(200, 220, 240, .75); align-self: center; letter-spacing: .05rem; }
`;

const M2 = `
  ${SHARED}
  ${ART}
  .con-journal.jm-m2 .journal-group__root { align-items: center !important; }
  .con-journal.jm-m2 .journal-group__time.jm-time-dup { display: none !important; }
  .con-journal.jm .jm-hidden { display: revert !important; }
`;

/**
 * M3 over the CHRONICLE build (the event card already real): the art becomes the card's full-width BANNER, the headline
 * stands over its lower edge, the consequences under it — a page of a chronicle rather than a card with a picture.
 */
const M3 = `
  ${SHARED}
  .con-journal.jm-m3 .journal-group--object {
    grid-template-columns: minmax(0, 1fr) !important; grid-template-areas: "time" "art" "body" !important; padding: 0 0 .6rem !important; overflow: hidden;
  }
  .con-journal.jm-m3 .journal-group--object .journal-group__time { padding: .45rem .7rem 0 !important; }
  .con-journal.jm-m3 .journal-group--object .journal-group__object {
    width: 100% !important; height: 6.4rem !important; border-radius: 0 !important; box-shadow: inset 0 -.06rem 0 rgba(0,0,0,.6) !important;
  }
  .con-journal.jm-m3 .journal-group--object .journal-group__root {
    grid-area: art !important; align-self: end; z-index: 1; padding: 1.6rem .7rem .45rem !important;
    background: linear-gradient(180deg, transparent, rgba(6, 10, 16, .92) 70%);
  }
  .con-journal.jm-m3 .journal-group--object .journal-group__children { padding: 0 .7rem !important; }
`;

const CSS: Record<JournalMock, string> = {M1, M2, M3};

/** Paint `mock` over the open panel; `art` maps a chip's name to its art (`journalArtIndex`). */
export async function applyJournalMock(page: Page, mock: JournalMock, art: Record<string, string>): Promise<void> {
  await page.addStyleTag({content: CSS[mock]});
  await page.evaluate(({mock, art}) => {
    const panel = document.querySelector('.con-journal');
    if (panel === null) {
      throw new Error('no journal panel to mock');
    }
    panel.classList.add('jm', `jm-${mock.toLowerCase()}`);
    const text = (el: Element | null) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    // The time ONCE per run of equal times (a turn reads one stamp, never one per line).
    let last = '';
    panel.querySelectorAll('.journal-group__time, .journal-entry__time').forEach((el) => {
      const t = text(el);
      el.classList.toggle('jm-time-dup', t === last);
      el.classList.toggle('jm-time-lead', t !== last);
      last = t;
    });
    // A consequence row that repeats the group's own card as its source says nothing the headline does not.
    panel.querySelectorAll('.journal-group').forEach((group) => {
      const head = text(group.querySelector('.journal-group__root-body .journal-chip--card .journal-chip__label'));
      group.querySelectorAll('.journal-child-row__src').forEach((src) => {
        src.classList.toggle('jm-src-dup', head !== '' && text(src).includes(head));
      });
    });
    if (mock === 'M2') {
      return;
    }
    // THE FAN: a draw's names become faces (the kept cards lit, the discarded dimmed), ≤ 6 then «+N».
    const fanOf = (chips: Array<Element>, kind: 'kept' | 'discard') => {
      const fan = document.createElement('span');
      fan.className = 'jm-fan';
      chips.slice(0, 6).forEach((chip) => {
        const mini = document.createElement('span');
        mini.classList.add('jm-mini');
        if (kind === 'kept') {
          mini.classList.add('jm-mini--kept');
        } else {
          mini.classList.add('jm-mini--discard');
        }
        const url = art[text(chip.querySelector('.journal-chip__label') ?? chip)];
        if (url !== undefined) {
          mini.style.backgroundImage = `url("${url}")`;
        }
        fan.appendChild(mini);
      });
      if (chips.length > 6) {
        const tail = document.createElement('span');
        tail.className = 'jm-fan-tail';
        tail.textContent = `+${chips.length - 6}`;
        fan.appendChild(tail);
      }
      return fan;
    };
    // A search row holds each thrown-away card in its own hook span — the fan gathers the whole row.
    panel.querySelectorAll('[data-journal-search]').forEach((row) => {
      const boxes = Array.from(row.querySelectorAll('[data-journal-search-discard]'));
      const chips = boxes.flatMap((box) => Array.from(box.querySelectorAll('.journal-chip--card')));
      if (chips.length > 0) {
        row.insertBefore(fanOf(chips, 'discard'), boxes[0]);
        boxes.forEach((box) => box.classList.add('jm-hidden'));
      }
    });
    panel.querySelectorAll('.journal-cards').forEach((box) => {
      const chips = Array.from(box.querySelectorAll('.journal-chip--card'));
      if (chips.length > 1 && box.parentElement !== null) {
        box.parentElement.insertBefore(fanOf(chips, 'kept'), box);
        box.classList.add('jm-hidden');
      }
    });
  }, {mock, art});
}

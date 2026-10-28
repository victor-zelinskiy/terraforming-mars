import {Page} from '@playwright/test';

/**
 * THE VISIBILITY OF A FLIGHT'S END — the polish remediation iteration № 1
 * (2026-10-11; `.claude/rules/console-ui.md` § THE ENDS OF A FLIGHT ARE VISIBLE).
 *
 * «Измерим» ≠ «видим». A source the transfer framework measures may stand
 * UNDER an opaque band surface (the ДОП. РЕСУРСЫ satellite under the composer's
 * glass — PL-137), be fading, or be unmounted by the time the token pops — and
 * the player sees a token born out of nothing. Three specs had written their
 * own «seen» helper (habitat-science, martian-census, chairman-quest); this is
 * the ONE: an element's box, its effective opacity down the ancestor chain, its
 * hidden-ness, whether it is in the viewport — and whether the topmost
 * hit-testable element at its centre belongs to a band surface (`.con-ws`)
 * that does not contain it (COVERED BY PAINT).
 *
 * ⚠ `elementsFromPoint` never returns a `pointer-events: none` element (the
 * satellite, the receiving stage, the transfer layer) — so the witness finds
 * the ANCHOR under a point by GEOMETRY first (the known landing / birth places,
 * painted), and asks the hit test only «is something ELSE painted over it»: a
 * `.con-ws` that does not contain the anchor is glass over it; the anchor's own
 * surface is not.
 */

export type EndVisibility = {
  found: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
  hidden: boolean;
  inView: boolean;
  /** The band surface painted over the element's centre ('' when none). */
  coveredBy: string;
  visible: boolean;
};

export async function effectiveVisibility(page: Page, selector: string): Promise<EndVisibility> {
  return page.evaluate((sel) => {
    const el = document.querySelector<HTMLElement>(sel);
    const none = {found: false, x: 0, y: 0, w: 0, h: 0, opacity: 0, hidden: true, inView: false, coveredBy: '', visible: false};
    if (el === null) {
      return none;
    }
    const r = el.getBoundingClientRect();
    let opacity = 1;
    let hidden = false;
    for (let n: HTMLElement | null = el; n !== null; n = n.parentElement) {
      const cs = getComputedStyle(n);
      opacity *= Number(cs.opacity);
      hidden = hidden || cs.visibility === 'hidden' || cs.display === 'none';
    }
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const inView = r.right > 0 && r.bottom > 0 && r.left < window.innerWidth && r.top < window.innerHeight;
    let coveredBy = '';
    const top = document.elementsFromPoint(cx, cy).find((e) => e.closest('.con-transfer') === null);
    if (top !== undefined && top !== el && !el.contains(top) && !top.contains(el)) {
      const surface = top.closest('.con-ws');
      if (surface !== null && !surface.contains(el)) {
        coveredBy = Array.from(surface.classList).filter((c) => c !== 'con-ws').slice(0, 2).join('.') || 'con-ws';
      }
    }
    return {
      found: true, x: cx, y: cy, w: r.width, h: r.height, opacity, hidden, inView, coveredBy,
      visible: r.width > 1 && r.height > 1 && opacity >= 0.5 && !hidden && inView && coveredBy === '',
    };
  }, selector);
}

/** One end of one token's flight, as the player saw it: where, when, and what was painted under that point. */
export type TransferEnd = {
  id: number;
  /** The chip's text («+1», «−8»). */
  value: string;
  t: number;
  x: number;
  y: number;
  /**
   * The anchor under the chip's centre: `wild` (a card's printed «?» — TR54) · `vp-badge` (a card's printed VP badge — TR55) · `ma-vp` (a ceremony's «+5») ·
   * `printed:<sprite>` (a printed icon on the play scene's landed card — the play's «+N» is born there, TR56) ·
   * `tag:<tag>` (a printed tag of the landed card — the table's answer it woke is born there, T06) · `seat:<color>` (another
   * seat's chip in the strip — a rival's payout lands there, T06) ·
   * `seal:<party>` (a party's seal in the chamber — a card's rating answer to a change of power is born there, TR63) ·
   * `law-face` (the law's face on a resolution action's stage — the law's own price lands there, PL-725) ·
   * `law` (the sitting's carrier card on its hero slot — a law's reward wave is born there, RX41) ·
   * `agenda-step:<n>` (a step of the Career — the winner's step pays its bonus off its node) · `hero` ·
   * `composer-card:<name>` ·
   * `recv:<card|front>` · `played:<card>` ·
   * `slot:<card>` (a live pick's candidate) · `source` (a plate's source dock) ·
   * `rail:<row>` · `aux:<key>` · `payrow:<unit>` · `forecast:<row|bolt>` (a «Сработает» chip — the table's answer is
   * born there, PL-220) · `cell:<id>` (a board cell — PL-306's price into the cell) — or, with no anchor there,
   * `glass:<surface>` · `board` · `other:<tag>`;
   * an anchor COVERED by a foreign band surface reads `glass:<surface>→<anchor>`.
   */
  under: string;
  /** The sample the chip's CONTACT BEAT first played beside it (the touchdown) — undefined for a chip that never landed. */
  touched?: number;
};
export type TransferWitness = {births: Array<TransferEnd>, landings: Array<TransferEnd>};

/**
 * ARM the transfer witness: from now on every `.con-transfer__chip` is followed
 * (a 16 ms sampler + a MutationObserver on the body — never rAF) and the
 * witness records its BIRTH (the first painted sample), its TOUCHDOWN (the
 * first sample its contact beat is painted beside it) and its LANDING (the
 * last painted sample before it left), each with what was painted under it.
 * A spec reads it with `transferWitness(page)` and asserts the law: no end on
 * `glass:*`, every birth on the printed source or its stand-in.
 */
export async function armTransferWitness(page: Page): Promise<void> {
  await page.evaluate(() => {
    type End = {id: number, value: string, t: number, x: number, y: number, under: string, touched?: number};
    const w = window as unknown as {__transferWitness?: {births: Array<End>, landings: Array<End>, t0: number, stop: () => void}};
    w.__transferWitness?.stop();
    const births: Array<End> = [];
    const landings: Array<End> = [];
    const ids = new WeakMap<Element, number>();
    const last = new Map<number, End>();
    const touchedAt = new Map<number, number>();
    let seq = 0;
    const t0 = performance.now();
    const name = (el: Element | null, attr: string) => el?.getAttribute(attr) ?? '';
    const painted = (el: Element): boolean => {
      let op = 1;
      for (let n: Element | null = el; n !== null; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.visibility === 'hidden' || cs.display === 'none') {
          return false;
        }
        op *= Number(cs.opacity);
      }
      return op > 0.05;
    };
    const contains = (el: Element, x: number, y: number): boolean => {
      const r = el.getBoundingClientRect();
      return r.width > 2 && r.height > 2 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    };
    /** The known places a token is born on or lands on, in priority order (the most specific first). */
    const ANCHORS: Array<[string, string]> = [
      // A LAW's printed «?» on the sitting's hero slot (RX40 — one of the card's own kind): the receipt's tokens are born
      // there. Before the generic «?» below — the same icon, a more specific place.
      ['law-wild', '[data-parl-sit-hero] .pcard-ic[style*="wild.png"]'],
      // A card's PRINTED «?» — a standard resource chosen from it is born there (TR54).
      ['wild', '.pcard-ic[style*="wild.png"]'],
      // A face of the RECEIPT OF THE TABLE (RX40) — a token of a payout that asked nobody lands on it. `receipt:<card>`.
      ['receipt', '[data-sit-receipt] [data-receipt-card]'],
      // A card's PRINTED VP badge — the score cell's token is born there (TR55); more specific than the card it is on.
      ['vp-badge', '.pcard__vp'],
      // …and a milestone's / an award's ceremony line — the +5's printed source (the MA workspace's stage, the global shell).
      ['ma-vp', '.con-mafocus__cere-vp, .con-macere__vp, [data-ma-cere-seat], .con-macere__stage'],
      ['forecast', '[data-forecast-rail], [data-forecast-row] .con-forecast__bolt'],
      // A STRUCK printed icon (RX35 — a law replaced the unit): the data's token is born on it. `struck:<icon>`.
      ['struck', '.action-effect-chip--diverted .action-effect-chip__icon:not(.action-effect-chip__diverted-icon)'],
      // …or on the plate's LAW SEAL where no struck icon is on screen (an embedded pick's stand-in for the dock).
      ['lawseal', '.con-task-host [data-task-law-seal]'],
      // A PRINTED icon on the landed card of the play's scene — the play's «+N» is born on the icon of its resource in
      // the on-play row (PL-190; TR56 — the chosen branch's own icon of a row of alternatives). `printed:<sprite>`.
      // A printed TAG of the landed card — the table's answer it woke is born there (T06 GMO Contract: «+2 M€» off the
      // plant tag of Lichen). `tag:<tag>`. More specific than the card's icons below.
      // THE REACTOR («СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК», TR80): the card whose printed effect fired, risen at a seat
      // of the reaction layer or out of its place on the receiving stage — its answer is born on the printed icon of ITS
      // effect row. `reactor:<card>:<sprite>`. Before the tags and the landed card's own icons: a token born here is the
      // reactor's, never the cause's.
      // …or IN ITS SEAT on the start stage (TR81 — a corporation answering its own first action rises where it stands).
      // …or IN ITS PLACE wherever its face stands (iteration 3 — the composer's hero, `data-reaction-home`; a target
      // miniature; the played table): one physical card, lifted where it is — the START SHELF too (TR82: Proteus answers
      // a Prelude out of its slot on «РАЗЫГРАНО»).
      ['reactor', '.con-reaction__face[data-reaction-card] .pcard-ic, .con-recv__emerge[data-played-key] .pcard-ic, .con-citypay__card[data-played-key] .pcard-ic, .con-start__embedsource [data-start-seat-card] .pcard-ic, [data-reaction-home][data-reaction-lifted] .pcard-ic, [data-composer-card][data-reaction-lifted] .pcard-ic, .con-played [data-played-key][data-reaction-lifted] .pcard-ic, .con-start__played [data-played-key][data-reaction-lifted] .pcard-ic'],
      // The START STAGE's seated card — the capsule a corporation's own answer lands in (TR81). `start-seat:<card>`.
      ['start-seat', '.con-start__embedsource [data-start-seat-card]'],
      // The ASKER's printed icon on the answer stage's hero (TR78) when the face is NOT lifted — a live pick's / layout's
      // answer is born there (the receive scene, not the framework's rise). `asker:<sprite>`.
      ['asker', '.con-tans [data-tans-asker-face] .pcard-ic'],
      // A face on the ANSWER STAGE (TR78 — «ОТВЕТ СТОЛА»): the asker's own capsule on the hero while it receives, a
      // recipient's face in the stage's row — a walk's unit lands on it. `answer:<card>`. After the printed-icon anchors
      // above: a token born on the lifted asker's effect row is the REACTOR's, never the stage's.
      ['answer', '.con-tans [data-tans-card], .con-tans [data-receipt-card]'],
      ['tag', '.con-recv [data-recv-front] .pcard-tag[data-tag], .con-played [data-played-key] .pcard-tag[data-tag]'],
      ['printed', '.con-recv [data-recv-front] .pcard-ic'],
      // A party's SEAL in the chamber — a card's rating answer to a change of power is born on the seal of the party that
      // came to power (TR63). `seal:<party>`.
      ['seal', '.con-parl__party[data-party] .con-pseal__seal'],
      // The LAW's face — the hero of a resolution action's stage: the law's own price is absorbed into its printed cost
      // (PL-725 — RX36's bill). `law-face`.
      ['law-face', '.con-cardactions .con-composer__actlaw'],
      // The SITTING's carrier card — on its hero slot, or standing (carried) in the government — a law's reward wave (a
      // production, a supply payout) is born on its printed graphic (RX41: the M€ production token). `law`.
      ['law', '[data-parl-sit-hero] .pcard, .con-parl [data-parl-gov] .con-parl__gov-card .pcard, .con-parl [data-parl-gov-carry] .pcard'],
      // A STEP of the Career on the Agenda track — the winner's step pays its own bonus off its node (the TR of a TR step).
      // `agenda-step:<n>`.
      ['agenda-step', '.con-parl [data-parl-agenda] .con-parl__step[data-step]'],
      ['hero', '.con-composer__actcardwrap'],
      ['play-card', '.con-composer__playcard'],
      ['composer-card', '[data-composer-card]'],
      ['recv', '.con-recv [data-recv-front], .con-recv [data-played-key], .con-sale-hero [data-played-key], .con-citypay [data-played-key], .con-colfocus [data-played-key], .con-fleetdock [data-played-key], .con-hydro [data-played-key]'],
      ['played', '.con-played [data-played-key], .con-start__played [data-played-key]'],
      // A LIVE PICK's own objects (TR53 iteration): the candidate a plate's answer lands on, and the source dock the
      // token is born on (a colony's plate, a card's) — the plate's own glass is not a foreign surface to them.
      ['slot', '.con-cards__slot[data-zoom-slot]'],
      ['source', '.con-src'],
      ['payrow', '.con-payrow'],
      // A COLONY's printed trade income / owner bonus — the trade's wave is born on the value it reads (the focus stage's
      // «состав награды» row, else the overview tile's cell; PL-1104: without it every honest income birth read as the
      // surface's own glass). `colony-income:<colony>` · `colony-bonus:<colony>`.
      ['colony-income', '[data-colony-trade-source]'],
      ['colony-bonus', '[data-colony-bonus-source]'],
      ['rail', '.con-res__row, .con-score__cell'],
      ['aux', '.con-res-aux__cell'],
      // A board CELL — the least specific anchor: a price drawn into the cell its tile grows out of (PL-306).
      // ANOTHER SEAT's INTAKE plaque under its chip — a rival's payout lands on its number (T06, the owner's M1). `intake:<color>`.
      ['intake', '[data-intake-seat] .con-status__intake-item'],
      // ANOTHER SEAT's chip in the status strip — a rival's payout lands there (T06). `seat:<color>`.
      ['seat', '.con-status__player[data-color]'],
      ['cell', '.board-space[data_space_id]'],
    ];
    const anchorName = (kind: string, el: Element): string => {
      switch (kind) {
      case 'hero': return 'hero';
      case 'play-card': return 'play-card';
      case 'composer-card': return `composer-card:${name(el, 'data-composer-card')}`;
      case 'recv': return `recv:${el.hasAttribute('data-recv-front') ? 'front' : name(el, 'data-played-key')}`;
      case 'played': return `played:${name(el, 'data-played-key')}`;
      case 'slot': return `slot:${name(el, 'data-zoom-slot')}`;
      case 'source': return 'source';
      case 'payrow': return `payrow:${name(el, 'data-pay-unit')}`;
      case 'colony-income': return `colony-income:${name(el, 'data-colony-trade-source')}`;
      case 'colony-bonus': return `colony-bonus:${name(el, 'data-colony-bonus-source')}`;
      case 'forecast': return `forecast:${name(el, 'data-forecast-rail') || 'bolt'}`;
      case 'rail': {
        const cls = Array.from(el.classList).find((c) => /^con-res__row--|^con-score__cell--/.test(c)) ?? 'rail';
        return `rail:${cls.replace(/^con-res__row--|^con-score__cell--/, '')}`;
      }
      case 'aux': return `aux:${name(el, 'data-aux-resource')}`;
      case 'cell': return `cell:${name(el, 'data_space_id')}`;
      case 'tag': return `tag:${name(el, 'data-tag')}`;
      case 'start-seat': return `start-seat:${name(el, 'data-start-seat-card')}`;
      case 'reactor': {
        const face = el.closest('[data-reaction-card], [data-played-key], [data-start-seat-card], [data-reaction-home], [data-composer-card]');
        const card = face === null ? '' :
          (face.getAttribute('data-reaction-card') ?? face.getAttribute('data-played-key') ?? face.getAttribute('data-start-seat-card') ??
            face.getAttribute('data-reaction-home') ?? face.getAttribute('data-composer-card') ?? '');
        const sprite = /([\w-]+)\.(?:png|webp|svg)/.exec((el as HTMLElement).style.backgroundImage ?? '')?.[1] ?? 'icon';
        return `reactor:${card}:${sprite}`;
      }
      case 'seat': return `seat:${name(el.closest('[data-color]'), 'data-color')}`;
      case 'intake': return `intake:${name(el.closest('[data-intake-seat]'), 'data-intake-seat')}`;
      case 'seal': return `seal:${name(el.closest('[data-party]'), 'data-party')}`;
      case 'struck': {
        const cls = Array.from(el.classList).find((c) => c.includes('--') && !c.startsWith('action-effect-chip')) ?? 'icon';
        return `struck:${cls.replace(/^.*--/, '')}`;
      }
      case 'lawseal': return 'lawseal';
      case 'agenda-step': return `agenda-step:${name(el, 'data-step')}`;
      case 'receipt': return `receipt:${name(el, 'data-receipt-card')}`;
      case 'answer': return `answer:${name(el, 'data-tans-card') || name(el, 'data-receipt-card')}`;
      case 'asker': {
        const sprite = /([\w-]+)\.(?:png|webp|svg)/.exec((el as HTMLElement).style.backgroundImage ?? '')?.[1] ?? 'icon';
        return `asker:${sprite}`;
      }
      case 'printed': {
        const sprite = /([\w-]+)\.(?:png|webp|svg)/.exec((el as HTMLElement).style.backgroundImage ?? '')?.[1] ?? 'icon';
        return `printed:${sprite}`;
      }
      default: return kind;
      }
    };
    const glassOf = (top: Element | undefined): string | undefined => {
      const ws = top?.closest('.con-ws') ?? null;
      return ws === null ? undefined : (Array.from(ws.classList).filter((c) => c !== 'con-ws').slice(0, 1).join('') || 'con-ws');
    };
    const classify = (x: number, y: number): string => {
      const top = document.elementsFromPoint(x, y).find((e) => e.closest('.con-transfer') === null);
      for (const [kind, sel] of ANCHORS) {
        const el = Array.from(document.querySelectorAll(sel)).find((e) => contains(e, x, y) && painted(e));
        if (el === undefined) {
          continue;
        }
        const label = anchorName(kind, el);
        // THE CARD-REACTION LAYER paints over every band surface (z 11650) and is `pointer-events: none`, so the hit
        // test under a reactor's face names the band it stands over — that band is never glass for it (the product's
        // own verdict says the same, `transferEndVerdict`; iteration 3: a reactor rises at the stage over a standing
        // composer by the owner's decision).
        const overlay = el.closest('.con-reaction') !== null;
        if (!overlay && top !== undefined && top !== el && !el.contains(top) && !top.contains(el)) {
          const ws = top.closest('.con-ws');
          if (ws !== null && !ws.contains(el)) {
            return `glass:${glassOf(top)}→${label}`;
          }
        }
        return label;
      }
      if (top === undefined) {
        return 'nothing';
      }
      const glass = glassOf(top);
      if (glass !== undefined) {
        return `glass:${glass}`;
      }
      if (top.closest('.con-board, .con-main') !== null) {
        return 'board';
      }
      return `other:${top.tagName.toLowerCase()}${Array.from(top.classList).slice(0, 2).map((c) => `.${c}`).join('')}`;
    };
    const sample = () => {
      const seen = new Set<number>();
      const beats = Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__beat')).filter(painted).map((b) => {
        const r = b.getBoundingClientRect();
        return {x: r.left + r.width / 2, y: r.top + r.height / 2};
      });
      for (const chip of Array.from(document.querySelectorAll<HTMLElement>('.con-transfer__chip'))) {
        const r = chip.getBoundingClientRect();
        if (r.width < 2 || !painted(chip)) {
          continue;
        }
        let id = ids.get(chip);
        const x = Math.round((r.left + r.width / 2) * 10) / 10;
        const y = Math.round((r.top + r.height / 2) * 10) / 10;
        const t = Math.round(performance.now() - t0);
        const end: End = {id: 0, value: (chip.textContent ?? '').replace(/\s+/g, ''), t, x, y, under: classify(x, y)};
        if (id === undefined) {
          id = ++seq;
          ids.set(chip, id);
          end.id = id;
          births.push({...end});
        }
        end.id = id;
        if (!touchedAt.has(id) && beats.some((b) => Math.hypot(b.x - x, b.y - y) <= Math.max(r.width, 24))) {
          touchedAt.set(id, t);
        }
        const touched = touchedAt.get(id);
        if (touched !== undefined) {
          end.touched = touched;
        }
        seen.add(id);
        last.set(id, end);
      }
      for (const [id, end] of Array.from(last.entries())) {
        if (!seen.has(id)) {
          landings.push(end);
          last.delete(id);
        }
      }
    };
    const timer = window.setInterval(sample, 16);
    const mo = new MutationObserver(sample);
    mo.observe(document.body, {subtree: true, childList: true});
    // `t0` — the witness's own clock origin (`performance.now()`), so a spec can line a touchdown up with its own samples.
    w.__transferWitness = {births, landings, t0, stop: () => {
      window.clearInterval(timer);
      mo.disconnect();
    }};
  });
}

/** Read the witness (a flight still in the air is not a landing yet — call after the scene has settled). */
export async function transferWitness(page: Page): Promise<TransferWitness> {
  return page.evaluate(() => {
    const w = window as unknown as {__transferWitness?: TransferWitness};
    return {births: [...(w.__transferWitness?.births ?? [])], landings: [...(w.__transferWitness?.landings ?? [])]};
  });
}

/** The witness as one trail line per end — for a spec's log beside its frames. */
export function transferTrail(w: TransferWitness): string {
  const line = (kind: string, e: TransferEnd) => `${kind} #${e.id} ${e.value} t=${e.t}${e.touched === undefined ? '' : ` touched=${e.touched}`} @${e.x},${e.y} under=${e.under}`;
  return [...w.births.map((e) => line('birth  ', e)), ...w.landings.map((e) => line('landing', e))].join('\n');
}

/** The ends that broke the law: born or landed over a band surface's glass, or over nothing. */
export function endsOverGlass(w: TransferWitness): Array<string> {
  const bad = (kind: string, e: TransferEnd) => /^glass:|^nothing$/.test(e.under) ? [`${kind} #${e.id} ${e.value} t=${e.t} under=${e.under}`] : [];
  return [...w.births.flatMap((e) => bad('birth', e)), ...w.landings.flatMap((e) => bad('landing', e))];
}

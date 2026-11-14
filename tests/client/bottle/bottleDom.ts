/*
 * THE BOTTLE'S PAGE (FREEZE ZERO · B3, the spike) — what jsdom is given so the REAL application can stand in it.
 *
 * jsdom is a DOM with no browser around it. Each thing the bottle adds is listed here WITH ITS REASON AND ITS EVIDENCE
 * (what the application did without it), because every one of them is a place where the bottle's page differs from
 * the suite's bare jsdom (`tests/client/components/setup.ts` adds constructors only, on purpose) — and all of it is
 * taken back by `giveBack()`:
 *
 *   location        the suite's page is `about:blank` (an opaque origin: `history.replaceState` throws, the root's
 *                   route reads no path). The bottle's page is `http://bottle.local/player?id=<seat>&<flags>` — set the
 *                   way `JSDOM#reconfigure` sets it (the suite does not hand its JSDOM object out).
 *   storage         `localStorage` / `sessionStorage`: one in-memory store per bottle (a reload keeps it — `reload()`).
 *   matchMedia      absent in jsdom. Answers «no match» to every query (not reduced motion, not coarse, no HDR).
 *   observers       `ResizeObserver` / `IntersectionObserver`: absent in jsdom. INERT stand-ins (observe nothing).
 *   «has a box»     jsdom lays nothing out: `getClientRects()` is ALWAYS empty and `offsetParent` ALWAYS null — and
 *                   those two are how the console's NETS ask «is this surface rendered» (`consoleLeakDetector.ts`
 *                   `paints` / `anyServingSurfaceRendered`). Without a stand-in every question is STRANDED at once:
 *                   measured on the first mount — `[console-leak-detector] STRANDED PROMPT: waitingFor "initialCards"`
 *                   → `[wait-graph] dead-end` → `[liveness] stall (unserved)` → the ladder's `stack-home`. The stand-in
 *                   answers from the DOM alone: an element has a box when it is connected and neither it nor an
 *                   ancestor is `display: none` INLINE (what `v-show` writes) or `hidden`. A surface a STYLESHEET hides
 *                   still reads «rendered» — the bottle loads no CSS; that difference is the browser monkey's to see.
 *   rects           `getBoundingClientRect()` stays jsdom's 0×0 at 0,0 — left AS IS (the report lists who reads one).
 *   canvas          `getContext()` answers `null` quietly (jsdom prints «Not implemented: HTMLCanvasElement's
 *                   getContext()» through `console.error` — an error record of every bottle).
 *   image decode    `HTMLImageElement#decode` is absent: `GameAtmosphere.vue` calls it bare in `mounted` and throws
 *                   (`TypeError: img.decode is not a function`), and its scene hold then ends by its 4 s bound. A warm
 *                   cache: decoded at once. (`load` events are NOT invented — an `<img @load>` never fires.)
 *   CSS             the `CSS` global is absent: `CSS.escape` is called bare by a pad handler
 *                   (`ConsoleScoreExplorer.vue` `descendCategory` — «ReferenceError: CSS is not defined» on A).
 *   Notification    absent: the transport's `notifyTurn()` reads `Notification.permission` bare inside the poll's
 *                   `onload`, BEFORE the chain re-arms. A stand-in that is never granted.
 *   WAAPI           `Element#animate` / `getAnimations` are absent: `BottleAnimation` — a Web Animation on the bottle's
 *                   clock (its header says what asked for it). ⚠ `takePage` must run BEFORE `takeTime` gives the
 *                   globals away only in the sense that nothing here captures a timer: every `setTimeout` /
 *                   `Date.now` below is read at the CALL, when the bottle's clock stands.
 *   scrolling       `Element#scrollBy` / `scrollTo` / `scrollIntoView` are absent, `window.scrollTo` prints «Not
 *                   implemented»: no-ops (nothing scrolls without layout).
 *   listeners       every listener the page adds to `window` / `document` is remembered and removed with the page (a
 *                   real reload gets a new window; the bottle keeps jsdom's one).
 */
type Globals = Record<string, unknown>;

export type BottlePage = {
  /** The page's storage (survives `reload()`). */
  storage: Map<string, string>,
  setUrl(url: string): void,
  giveBack(): void,
};

class MemoryStorage {
  constructor(private readonly data: Map<string, string>) {}
  get length(): number {
    return this.data.size;
  }
  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  clear(): void {
    this.data.clear();
  }
}

export type BottleAnimationOptions = {duration?: number, delay?: number, endDelay?: number, iterations?: number, fill?: string, easing?: string, id?: string};

/**
 * A WEB ANIMATION ON THE BOTTLE'S CLOCK. jsdom has no `Element#animate`; most callers test for it and take their «no
 * motion» branch, but not all (`AnimatedScaleMarker.vue` calls `markerNow.animate(…)` bare — the random search found
 * it: «TypeError: markerNow.animate is not a function» inside a watcher, after a heat conversion moved the scale).
 * With a stand-in the product takes its REAL branches — a leave that is in flight for its duration, a marker that
 * ARRIVES — and what it waits for comes: `finished` / `onfinish` after `delay + duration × iterations` of the clock
 * (the global `setTimeout` is the bottle's by then), `cancel()` rejecting `finished` (handled, as the standard says),
 * `getAnimations()` listing what still plays or still fills. It paints nothing: jsdom has no style to animate.
 */
export class BottleAnimation {
  public id: string;
  public playState: 'idle' | 'running' | 'paused' | 'finished' = 'running';
  public pending = false;
  public playbackRate = 1;
  public onfinish: ((event: {type: string, target: BottleAnimation}) => void) | null = null;
  public oncancel: ((event: {type: string, target: BottleAnimation}) => void) | null = null;
  public onremove: (() => void) | null = null;
  public readonly finished: Promise<BottleAnimation>;
  public readonly ready: Promise<BottleAnimation>;
  public readonly effect: {target: Element, getKeyframes(): unknown, getTiming(): Required<BottleAnimationOptions>, getComputedTiming(): Required<BottleAnimationOptions> & {endTime: number, activeDuration: number, progress: number | null}};
  private readonly timing: Required<BottleAnimationOptions>;
  private readonly listeners = new Map<string, Set<(event: {type: string, target: BottleAnimation}) => void>>();
  private readonly total: number;
  private startedAt = Date.now();
  private heldAt: number | undefined;
  private timer: unknown;
  private settle: {resolve: (animation: BottleAnimation) => void, reject: (error: Error) => void} = {resolve: () => {}, reject: () => {}};

  constructor(public readonly target: Element, keyframes: unknown, options: number | BottleAnimationOptions | undefined, private readonly registry: Set<BottleAnimation>) {
    const given = typeof options === 'number' ? {duration: options} : options ?? {};
    this.timing = {
      duration: Number(given.duration) || 0, delay: Number(given.delay) || 0, endDelay: Number(given.endDelay) || 0,
      iterations: given.iterations ?? 1, fill: given.fill ?? 'auto', easing: given.easing ?? 'linear', id: given.id ?? '',
    };
    this.id = this.timing.id;
    this.total = this.timing.delay + this.timing.duration * this.timing.iterations + this.timing.endDelay;
    this.effect = {
      target,
      getKeyframes: () => keyframes,
      getTiming: () => ({...this.timing}),
      getComputedTiming: () => ({
        ...this.timing, endTime: this.total, activeDuration: this.timing.duration * this.timing.iterations,
        progress: this.playState === 'idle' ? null : Math.min(1, this.timing.duration === 0 ? 1 : Math.max(0, (this.currentTime ?? 0) - this.timing.delay) / this.timing.duration),
      }),
    };
    this.finished = new Promise<BottleAnimation>((resolve, reject) => {
      this.settle = {resolve, reject};
    });
    // A cancelled animation's `finished` rejects WITHOUT being an unhandled rejection (Web Animations § cancel).
    this.finished.catch(() => {});
    this.ready = Promise.resolve(this);
    registry.add(this);
    this.arm();
  }

  get currentTime(): number | null {
    if (this.playState === 'idle') {
      return null;
    }
    if (this.playState === 'finished') {
      return this.total;
    }
    return Math.min(this.total, (this.heldAt ?? Date.now()) - this.startedAt);
  }
  set currentTime(value: number | null) {
    if (value === null || this.playState === 'idle') {
      return;
    }
    this.startedAt = (this.heldAt ?? Date.now()) - value;
    if (this.playState === 'running') {
      this.arm();
    }
  }
  get startTime(): number {
    return this.startedAt;
  }

  private arm(): void {
    clearTimeout(this.timer as ReturnType<typeof setTimeout>);
    if (Number.isFinite(this.total)) {
      this.timer = setTimeout(() => this.finish(), Math.max(0, this.total - (Date.now() - this.startedAt)));
    }
  }
  private emit(type: 'finish' | 'cancel'): void {
    const event = {type, target: this as BottleAnimation};
    (type === 'finish' ? this.onfinish : this.oncancel)?.(event);
    for (const listener of [...this.listeners.get(type) ?? []]) {
      listener(event);
    }
  }
  play(): void {
    if (this.playState === 'paused' && this.heldAt !== undefined) {
      this.startedAt += Date.now() - this.heldAt;
    } else if (this.playState !== 'running') {
      this.startedAt = Date.now();
    }
    this.heldAt = undefined;
    this.playState = 'running';
    this.registry.add(this);
    this.arm();
  }
  pause(): void {
    if (this.playState === 'running') {
      this.heldAt = Date.now();
      this.playState = 'paused';
      clearTimeout(this.timer as ReturnType<typeof setTimeout>);
    }
  }
  finish(): void {
    if (this.playState === 'finished' || this.playState === 'idle') {
      return;
    }
    clearTimeout(this.timer as ReturnType<typeof setTimeout>);
    this.playState = 'finished';
    // An animation that does not fill forwards stops being one of the element's animations once it is over.
    if (this.timing.fill !== 'forwards' && this.timing.fill !== 'both') {
      this.registry.delete(this);
    }
    this.settle.resolve(this);
    this.emit('finish');
  }
  cancel(): void {
    if (this.playState === 'idle') {
      return;
    }
    clearTimeout(this.timer as ReturnType<typeof setTimeout>);
    const wasFinished = this.playState === 'finished';
    this.playState = 'idle';
    this.registry.delete(this);
    if (!wasFinished) {
      this.settle.reject(Object.assign(new Error('The user aborted a request.'), {name: 'AbortError'}));
    }
    this.emit('cancel');
  }
  reverse(): void {}
  persist(): void {}
  commitStyles(): void {}
  updatePlaybackRate(rate: number): void {
    this.playbackRate = rate;
  }
  addEventListener(type: string, listener: (event: {type: string, target: BottleAnimation}) => void): void {
    const set = this.listeners.get(type) ?? new Set();
    set.add(listener);
    this.listeners.set(type, set);
  }
  removeEventListener(type: string, listener: (event: {type: string, target: BottleAnimation}) => void): void {
    this.listeners.get(type)?.delete(listener);
  }
}

/** `JSDOM#reconfigure({url})`, done from inside: the document's URL, its origin, the session history's entry. */
function reconfigureUrl(url: string, parse: (url: string) => unknown, originOf: (parsed: unknown) => string): void {
  const win = (globalThis as unknown as Globals).window as {
    _document: {_URL: unknown, _origin: string, _clearBaseURLCache(): void},
    _sessionHistory: {currentEntry: {url: unknown}},
  };
  const parsed = parse(url);
  if (parsed === null) {
    throw new TypeError(`Could not parse "${url}" as a URL`);
  }
  win._document._URL = parsed;
  win._document._origin = originOf(parsed);
  win._sessionHistory.currentEntry.url = parsed;
  win._document._clearBaseURLCache();
}

export function takePage(nodeRequire: (id: string) => unknown, url: string, storage: Map<string, string> = new Map()): BottlePage {
  const globals = globalThis as unknown as Globals;
  const win = globals.window as Globals;
  const doc = globals.document as Document;
  const whatwg = nodeRequire('whatwg-url') as {parseURL(url: string): unknown, serializeURLOrigin(parsed: unknown): string};
  const setUrl = (next: string) => reconfigureUrl(next, whatwg.parseURL, whatwg.serializeURLOrigin);
  setUrl(url);

  const saved: Array<() => void> = [];
  const replace = (host: Globals, key: string, value: unknown): void => {
    const descriptor = Object.getOwnPropertyDescriptor(host, key);
    Object.defineProperty(host, key, {value, configurable: true, writable: true, enumerable: descriptor?.enumerable ?? true});
    saved.push(() => {
      if (descriptor !== undefined) {
        Object.defineProperty(host, key, descriptor);
      } else {
        delete host[key];
      }
    });
  };
  const both = (key: string, value: unknown): void => {
    replace(globals, key, value);
    replace(win, key, value);
  };
  /** What the page left on `window` (its probes: `__conReady`, `__conFieldRecorder`, `_translations` …) goes with it. */
  const windowKeysBefore = new Set(Object.getOwnPropertyNames(win));
  /** …and on the document: only what THIS page added is taken away (another spec's leftovers are not the bottle's). */
  const nodesBefore = new Set<Element>([...doc.body.children, ...doc.head.children]);
  const attributesBefore = new Map<Element, Map<string, string>>(
    [doc.documentElement, doc.body].map((element) => [element, new Map([...element.attributes].map((a) => [a.name, a.value]))]));
  const titleBefore = doc.title;

  both('localStorage', new MemoryStorage(storage));
  both('sessionStorage', new MemoryStorage(new Map()));
  both('matchMedia', (query: string) => ({
    matches: false, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
  }));
  class InertObserver {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): Array<unknown> {
      return [];
    }
  }
  for (const name of ['ResizeObserver', 'IntersectionObserver']) {
    if (globals[name] === undefined) {
      both(name, InertObserver);
    }
  }
  if (globals.CSS === undefined) {
    both('CSS', {
      // (Every ASCII character that is not a name character is escaped; anything above ASCII is a name character.)
      escape: (value: string) => String(value).replace(/[^a-zA-Z0-9_\-\x80-\uffff]/g, (ch) => '\\' + ch),
      supports: () => false,
    });
  }
  if (globals.Notification === undefined) {
    both('Notification', {permission: 'denied', requestPermission: () => Promise.resolve('denied')});
  }

  // ── «has a box» ──
  const displayed = (el: Element): boolean => {
    if (!el.isConnected) {
      return false;
    }
    for (let at: Element | null = el; at !== null; at = at.parentElement) {
      if ((at as HTMLElement).style?.display === 'none' || at.hasAttribute('hidden')) {
        return false;
      }
    }
    return true;
  };
  const ElementProto = (globals.Element as {prototype: Globals}).prototype;
  const HtmlProto = (globals.HTMLElement as {prototype: Globals}).prototype;
  const box = {x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, toJSON: () => ({})};
  replace(ElementProto, 'getClientRects', function(this: Element) {
    return displayed(this) ? [box] : [];
  });
  const offsetParent = Object.getOwnPropertyDescriptor(HtmlProto, 'offsetParent');
  Object.defineProperty(HtmlProto, 'offsetParent', {
    configurable: true,
    get(this: Element) {
      return displayed(this) ? this.parentElement : null;
    },
  });
  saved.push(() => {
    if (offsetParent !== undefined) {
      Object.defineProperty(HtmlProto, 'offsetParent', offsetParent);
    }
  });
  const CanvasProto = (globals.HTMLCanvasElement as {prototype: Globals} | undefined)?.prototype;
  if (CanvasProto !== undefined) {
    replace(CanvasProto, 'getContext', () => null);
  }
  const ImageProto = (globals.HTMLImageElement as {prototype: Globals} | undefined)?.prototype;
  if (ImageProto !== undefined && ImageProto.decode === undefined) {
    replace(ImageProto, 'decode', () => Promise.resolve());
  }

  // ── scrolling ── nothing scrolls without layout; the calls must exist (`viewportEl?.scrollBy is not a function` —
  // `ConsoleScoreExplorer.vue` `scrollCatBody`), and jsdom's own `window.scrollTo` prints «Not implemented».
  for (const name of ['scrollBy', 'scrollTo', 'scrollIntoView']) {
    if (ElementProto[name] === undefined) {
      replace(ElementProto, name, () => {});
    }
  }
  both('scrollTo', () => {});
  both('scrollBy', () => {});

  // ── WAAPI ── see `BottleAnimation` below.
  const animations = new Set<BottleAnimation>();
  const relevant = (within: (target: Element) => boolean): Array<BottleAnimation> =>
    [...animations].filter((animation) => animation.playState !== 'idle' && animation.target.isConnected && within(animation.target));
  if (ElementProto.animate === undefined) {
    replace(ElementProto, 'animate', function(this: Element, keyframes: unknown, options?: number | BottleAnimationOptions) {
      return new BottleAnimation(this, keyframes, options, animations);
    });
    replace(ElementProto, 'getAnimations', function(this: Element, options?: {subtree?: boolean}) {
      return relevant((target) => target === this || (options?.subtree === true && this.contains(target)));
    });
    replace(doc as unknown as Globals, 'getAnimations', () => relevant(() => true));
  }
  // (The page is gone by the time this runs: what still played is dropped, nobody is told.)
  saved.push(() => animations.clear());

  // ── the page's listeners on the two objects that outlive it ──
  type Listens = {
    addEventListener(type: string, listener: unknown, options?: unknown): void,
    removeEventListener(type: string, listener: unknown, options?: unknown): void,
  };
  type Listening = {target: Listens, type: string, listener: unknown, options: unknown};
  const listening: Array<Listening> = [];
  for (const target of [win as unknown as Listens, doc as unknown as Listens]) {
    const add = target.addEventListener.bind(target);
    replace(target as unknown as Globals, 'addEventListener', (type: string, listener: unknown, options?: unknown) => {
      listening.push({target, type, listener, options});
      add(type, listener, options);
    });
  }

  return {
    storage,
    setUrl,
    giveBack: () => {
      for (const {target, type, listener, options} of listening.splice(0)) {
        target.removeEventListener(type, listener, options);
      }
      for (const restore of saved.reverse()) {
        restore();
      }
      saved.length = 0;
      for (const key of Object.getOwnPropertyNames(win)) {
        if (!windowKeysBefore.has(key)) {
          delete win[key];
        }
      }
      // What the page wrote on the document (teleports, the root's classes and variables, injected styles).
      for (const parent of [doc.body, doc.head]) {
        for (const child of [...parent.children]) {
          if (!nodesBefore.has(child)) {
            child.remove();
          }
        }
      }
      for (const element of [doc.documentElement, doc.body]) {
        const before = attributesBefore.get(element) ?? new Map<string, string>();
        for (const attribute of [...element.attributes]) {
          if (!before.has(attribute.name)) {
            element.removeAttribute(attribute.name);
          }
        }
        for (const [name, value] of before) {
          element.setAttribute(name, value);
        }
      }
      doc.title = titleBefore;
      setUrl('about:blank');
    },
  };
}

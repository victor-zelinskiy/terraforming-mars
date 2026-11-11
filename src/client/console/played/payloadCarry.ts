/*
 * THE PAYLOAD IS CARRIED ONE LEVEL DEEPER (TR56 «КУДА ЛЯЖЕТ», П3).
 *
 * A composer's «what» and «where» are ONE question asked on two levels: the variant tile answered WHAT («3 [мех]» —
 * the card's own print of that branch), the target step asks WHERE. The print is the object the player is carrying,
 * so it travels: it leaves the tile it was chosen on and lands in the step's contract line («КУДА: 3 [мех]»), while
 * the step's other groups surface from inside (the workspace descend's REVEAL). Same phrase, one level deeper — never
 * a second, unrelated header standing where the tile was.
 *
 * Two halves on the descend grammar's own primitives (`surfaceMotion/workspaceDescend.ts`): ARM measures the tile's
 * print on the press frame (the review it stands in unmounts in the next patch), PLAY flies the header's print from
 * that rect once the step has mounted. Transform + opacity only, on the COMPOSITOR's clock (Web Animations — the phrase
 * plays in the frames of a mount); one episode per root, its backstop catches it up; reduced motion — no carry, the
 * step simply stands.
 */
import {motionMs} from '@/client/components/motion/motionTokens';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {descendCascadeComposited, descendFlipComposited, descendFlipFrom, descendRectOf} from '@/client/console/surfaceMotion/workspaceDescend';

type Rect = {left: number, top: number, width: number, height: number};

/** The CARRY's length — one glide, a little longer than the reveal under it (the carried object lands last). */
const CARRY_MS = 360;
/** The step's groups surfacing from inside, under the carry. */
const REVEAL_MS = 300;

/**
 * ARM — the printed graphic of what the player CARRIES, as it stands on the press frame: the ONE result every price
 * buys when the group's «ИЛИ» stands on the price side (TR58 — `.con-vchoice__shared`, the tiles are the prices), else
 * the answered tile's own print (`[data-vchoice-print]` of the selected option inside `scope`). Undefined when the host
 * shows no print (a branch without one, a pick outside a variant group): the step then ENTERS without a carry
 * (`playPayloadCarry` — its groups still surface; it never stands in one frame, PL-473).
 */
export function armPayloadCarry(scope: Element | null | undefined): Rect | undefined {
  const ink = scope?.querySelector<HTMLElement>('.con-vchoice__shared [data-vchoice-print] .con-vchoice__ink') ??
    scope?.querySelector<HTMLElement>('.con-vchoice__opt--selected [data-vchoice-print] .con-vchoice__ink');
  return descendRectOf(ink ?? undefined);
}

/**
 * PLAY — the header's payload flies in from the tile's rect; every other group of the step surfaces from inside, the
 * contract line's own words with them. `stepRoot` is the step's `.con-ptsel`, `payload` its `[data-ptsel-payload]`.
 * The whole phrase rides the COMPOSITOR's clock (`descendCascadeComposited` / `descendFlipComposited`): it is played in
 * the flush that MOUNTS the step — its cards' art decoding, its first 4K layout — and a main-thread timeline created
 * there starts on GSAP's last tick, BEFORE that long task: the first painted frame was the cascade well past its
 * start, the cards 0 in one sample and whole the next (CI 2026-11-11, `console-smoothness` (A)). A Web Animation starts
 * at its first painted frame and keeps the display's cadence while the main thread works (animations.md law 7).
 */
export function playPayloadCarry(stepRoot: HTMLElement | undefined, payload: HTMLElement | undefined, from: Rect | undefined): void {
  if (stepRoot === undefined || consoleReducedMotionActive()) {
    return;
  }
  const flip = payload === undefined || from === undefined ? undefined : descendFlipFrom(payload, from);
  if (payload === undefined || flip === undefined) {
    // NOTHING TO CARRY (a branch without a print, a step with no payload in its contract): the step still ENTERS — its
    // groups surface from inside, the contract line first (PL-473: it used to stand in one frame).
    const groups = Array.from(stepRoot.querySelectorAll<HTMLElement>('[data-unfold-item]'));
    if (groups.length > 0) {
      runEpisode(stepRoot, REVEAL_MS, descendCascadeComposited(groups, motionMs(REVEAL_MS), 0));
    }
    return;
  }
  // The contract line's own words, and every group below it — never the payload (it is the carried object).
  const header = payload.closest<HTMLElement>('[data-unfold-item]');
  const words = header === null ? [] :
    Array.from(header.querySelectorAll<HTMLElement>('.con-ptsel__contract-head > *, .con-ptsel__contract-ask'))
      .filter((el) => el !== payload && !el.contains(payload) && !payload.contains(el));
  const groups = Array.from(stepRoot.querySelectorAll<HTMLElement>('[data-unfold-item]')).filter((el) => el !== header);
  const carry = descendFlipComposited(payload, flip, motionMs(CARRY_MS));
  runEpisode(stepRoot, CARRY_MS, [
    ...(carry === undefined ? [] : [carry]),
    ...descendCascadeComposited(words, motionMs(REVEAL_MS), motionMs(90), 20),
    ...descendCascadeComposited(groups, motionMs(REVEAL_MS), motionMs(60)),
  ]);
}

/** ARM THE RETURN — the step's header print as it stands, before the step unmounts (`[data-ptsel-payload]`). */
export function armPayloadReturn(step: Element | null | undefined): Rect | undefined {
  return descendRectOf(step?.querySelector<HTMLElement>('[data-ptsel-payload]') ?? undefined);
}

/**
 * PLAY THE RETURN — one level back of the same phrase: the selected tile's print flies home from the header's rect, and
 * the review's other groups surface from inside (the group holding the carried print stands — it is the destination).
 * `onDone` — the phrase's end (or at once when nothing plays): the review STANDS, the cursor may arrive (T14 · CC — the
 * commit row an answer lands on breathes only once it is there to be seen). The compositor's clock, as the carry's.
 */
export function playPayloadReturn(scope: HTMLElement | undefined, from: Rect | undefined, onDone: () => void = () => undefined): void {
  if (scope === undefined || from === undefined || consoleReducedMotionActive()) {
    onDone();
    return;
  }
  const ink = scope.querySelector<HTMLElement>('.con-vchoice__shared [data-vchoice-print] .con-vchoice__ink') ??
    scope.querySelector<HTMLElement>('.con-vchoice__opt--selected [data-vchoice-print] .con-vchoice__ink');
  const body = scope.querySelectorAll<HTMLElement>('.con-composer__scroll-body [data-unfold-item], .con-composer__playdock [data-unfold-item]');
  const all = Array.from(body.length > 0 ? body : scope.querySelectorAll<HTMLElement>('[data-unfold-item]'))
    .filter((el) => el.closest('.con-ptsel') === null);
  const flip = ink === null ? undefined : descendFlipFrom(ink, from);
  if (ink === null || flip === undefined) {
    // Nothing to carry home: the review still RETURNS — its groups surface from inside (never one frame, PL-473).
    if (all.length > 0) {
      runEpisode(scope, REVEAL_MS, descendCascadeComposited(all, motionMs(REVEAL_MS), 0), onDone);
    } else {
      onDone();
    }
    return;
  }
  const home = ink.closest<HTMLElement>('[data-unfold-item]');
  const groups = all.filter((el) => el !== home && !el.contains(ink));
  const carry = descendFlipComposited(ink, flip, motionMs(CARRY_MS));
  runEpisode(scope, CARRY_MS, [
    ...(carry === undefined ? [] : [carry]),
    ...descendCascadeComposited(groups, motionMs(REVEAL_MS), motionMs(60)),
  ], onDone);
}

/** The live phrase per root — a new phrase on the same root cancels the old one (its `done` still fires, once). */
const episodes = new WeakMap<Element, ReadonlyArray<Animation>>();

/**
 * ONE episode of Web Animations on `root`: the previous one is cancelled, `done` fires exactly once — when every
 * animation has finished or been cancelled. Its backstop CATCHES the phrase UP (`finish()` puts every piece on its end
 * — animations.md law 1), never resolves it in the air: a hidden document pauses the timeline and would hold `done`.
 */
function runEpisode(root: Element, totalMs: number, anims: ReadonlyArray<Animation>, done: () => void = () => undefined): void {
  episodes.get(root)?.forEach((a) => a.cancel());
  if (anims.length === 0) {
    episodes.delete(root);
    done();
    return;
  }
  episodes.set(root, anims);
  let ended = false;
  const end = () => {
    if (ended) {
      return;
    }
    ended = true;
    window.clearTimeout(backstop);
    if (episodes.get(root) === anims) {
      episodes.delete(root);
    }
    done();
  };
  const backstop = window.setTimeout(() => anims.forEach((a) => {
    if (a.playState !== 'finished' && a.playState !== 'idle') {
      a.finish();
    }
  }), motionMs(totalMs) + 900);
  void Promise.allSettled(anims.map((a) => a.finished)).then(end);
}

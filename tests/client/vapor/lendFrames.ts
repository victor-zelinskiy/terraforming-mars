/*
 * A FRAME SOURCE FOR A SPEC OF A VAPOR `<Transition>`.
 *
 * The unit environment lends no `requestAnimationFrame` on purpose (`tests/client/components/setup.ts` — feature
 * detection must keep seeing this environment), and test-utils' default `transition` STUB covers the virtual-DOM
 * component only: inside a Vapor component `<Transition>` is the real one, and the real one schedules its class swap
 * on a frame — two of them (`nextFrame` asks for a frame from inside a frame).
 *
 *   let giveBack: () => Promise<void>;
 *   beforeEach(() => { giveBack = lendFrames(); });
 *   afterEach(() => giveBack());
 *
 * The give-back first lets the frames already asked for run: taken away under a pending frame, the source is missing
 * when that frame asks for its second one — an uncaught `requestAnimationFrame is not defined` from a timer, which
 * mocha books to whatever hook happens to be running.
 */
type FrameHost = {requestAnimationFrame?: (run: () => void) => number};

export function lendFrames(): () => Promise<void> {
  const host = globalThis as unknown as FrameHost;
  const had = host.requestAnimationFrame;
  let pending = 0;
  host.requestAnimationFrame = (run) => {
    pending++;
    return setTimeout(() => {
      pending--;
      run();
    }, 0) as unknown as number;
  };
  return async () => {
    for (let turn = 0; turn < 20 && pending > 0; turn++) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    host.requestAnimationFrame = had;
  };
}

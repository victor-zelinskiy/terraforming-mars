/*
 * ConsoleActionComposer's MODULE state (docs/claude/vapor/RECIPES.md § R25). Inside `<script setup>` every top-level
 * statement runs once per INSTANCE, so the merged batch's assembly in flight lives here — ONE handle per page, as it
 * was (the composer and the one nested in it for a repeat pick share it) — together with the three things the composer
 * does with it. The composer calls these and never sees the handle.
 */
import {IntakeAssemblyArgs, IntakeAssemblyHandle, playIntakeAssembly} from '@/client/console/cardIntake/intakeAssemblyDirector';

/** The merged batch's assembly in flight (module scope — a GSAP handle never rides Vue reactivity). */
let composerAssembly: IntakeAssemblyHandle | undefined;

/**
 * Play the merged batch's assembly: the one in flight (if any) is killed first, and the handle is let go the moment the
 * scene is done — BEFORE the composer's own `onDone` runs (its hand-off asks `composerAssemblyInFlight()`). The body
 * is the component's own, moved: a plan that is done before `playIntakeAssembly` returns (no run to deal) still leaves
 * its spent handle here until the next play or kill, as the component's `let` did.
 */
export function playComposerAssembly(args: IntakeAssemblyArgs): void {
  composerAssembly?.kill();
  composerAssembly = playIntakeAssembly({
    ...args,
    onDone: () => {
      composerAssembly = undefined;
      args.onDone();
    },
  });
}

/** An assembly is still in flight — the hand-off to the real surface waits for it to settle. */
export function composerAssemblyInFlight(): boolean {
  return composerAssembly !== undefined;
}

/** Kill the assembly in flight and let its handle go (abort / unmount / phase abort); nothing to do when none is. */
export function killComposerAssembly(): void {
  composerAssembly?.kill();
  composerAssembly = undefined;
}

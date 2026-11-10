/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE SHELL PORT — how a controller taken out of `ConsoleShell.vue` reaches what still lives in the shell's options
 * (architecture v2, the shell slices; docs/claude/console/architecture-v2/PLAN.md §5).
 *
 * A controller is plain Composition-API code: it owns its state and names — in a typed PORT — every member of the rest
 * of the shell it reads, calls or writes. While those members are still Options-API members of the component, the port
 * is served by the component's public instance (the same object `this` is inside an option): reads are reactive, calls
 * are bound, and a member returned from `setup()` by ANOTHER controller is reached the same way. The port is a BRIDGE,
 * not the destination: a row of it disappears when the member it names moves into a controller the caller can depend
 * on directly, and the port's size is the measure of how entangled a domain still is.
 *
 * The shell proves it really is what every port says in `shellPortsConform()` (type-checked by vue-tsc).
 */
import {getCurrentInstance} from 'vue';

/** The component instance under construction, typed as the caller's port. Call it in `setup()` only. */
export function shellPort<P>(): P {
  const instance = getCurrentInstance();
  if (instance === null || instance.proxy === null) {
    throw new Error('shellPort() is called in setup() — there is no component instance here');
  }
  return instance.proxy as unknown as P;
}

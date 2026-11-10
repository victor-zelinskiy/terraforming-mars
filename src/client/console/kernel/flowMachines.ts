/*
 * @console-shared LIVE — the flow kernel (docs/claude/console/architecture-v2/KERNEL.md).
 *
 * THE REGISTER OF LIFECYCLE MACHINES — every statechart the console runs, with the sample events the law's explorer
 * drives it by. `tests/console/kernel/flowLaw.spec.ts` judges each one (the definition and its reachable snapshots);
 * `tests/console/kernel/flowMachineRegister.spec.ts` fails on a machine defined under `src/client` that is not listed
 * here — a lifecycle that skips the law is how «a state with no exit» comes back.
 */
import {AnyStateMachine, EventObject} from 'xstate';
import {FRAME_SAMPLE_EVENTS, frameMachine, frameSnapshotKey} from '@/client/console/consoleWorkspaceFrame';
import {SUBMIT_SAMPLE_EVENTS, submitMachine} from '@/client/console/transport/submitMachine';

export type FlowMachineEntry = {
  /** The machine's name (its file says where it lives). */
  name: string,
  machine: AnyStateMachine,
  /** One sample per event type (and per payload a guard tells apart) — what the explorer presses. */
  events: ReadonlyArray<EventObject>,
  /** The input the explorer starts it with, when it takes one. */
  input?: unknown,
  /** How the explorer tells two snapshots apart (default: value + context as JSON). */
  key?: (snapshot: {value: unknown, context: unknown}) => string,
  /** The module that defines it, relative to `src/client` (the register spec reads the files). */
  file: string,
};

export const FLOW_MACHINES: ReadonlyArray<FlowMachineEntry> = [
  {name: 'submit', file: 'console/transport/submitMachine.ts', machine: submitMachine, events: SUBMIT_SAMPLE_EVENTS},
  {
    name: 'frame', file: 'console/consoleWorkspaceFrame.ts', machine: frameMachine, events: FRAME_SAMPLE_EVENTS,
    input: {kind: 'hand', phase: 'browse', away: false}, key: frameSnapshotKey,
  },
];

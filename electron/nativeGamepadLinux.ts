// NATIVE LINUX GAMEPAD SOURCE — the Steam Deck fix.
//
// ── WHY THIS EXISTS (measured on the device, not guessed) ────────────────────
// On a Steam Deck launching this app through Steam, the renderer logged
// `[gamepad] installed — pads=0 slots=4` in EVERY session and never a single
// `connected` line, under every Steam Input layout we tried. A main-process
// probe of the kernel's own view, taken at the same moment, found the opposite:
//
//   js0 "Microsoft X-Box 360 pad 0"           /devices/virtual/input/input56/js0
//   js1 "Razer Wolverine V3 Pro for Xbox 2.4" /devices/virtual/input/input43/js1
//   js2 "Microsoft X-Box 360 pad 1"           /devices/virtual/input/input57/js2
//   INPUT SEEN on js1 — button 1 = 1      (a real press, read from plain Node)
//
// Three live, readable, event-emitting joysticks; `navigator.getGamepads()`
// blind to all of them. Chromium's Linux fetcher only accepts devices carrying
// the udev property `ID_INPUT_JOYSTICK` and keys device identity on the syspath
// up to the first "input" — which for every uinput device is the SAME string,
// `/sys/devices/virtual/`. Steam Input publishes its pads exactly there. Nothing
// in the renderer can work around this, and no Steam-side setting changed it.
//
// So we read the joystick character devices ourselves and hand the renderer
// ready-made W3C standard-mapping snapshots. This also sidesteps Chromium's
// 4-pad cap and its user-gesture visibility gate.
//
// ── SCOPE ───────────────────────────────────────────────────────────────────
// Linux only, and the renderer uses it ONLY while the Gamepad API reports no
// pads (see nativePadBridge.ts) — so a healthy platform, including every
// Windows build, keeps the stock path and can never receive input twice.
//
// Steam Input mirrors one physical controller into an extra virtual pad, so the
// same press legitimately arrives on two nodes here (js1 AND js0 above). That is
// not filtered: the renderer's single-driver election already exists for exactly
// this and makes the mirror inert.

import type {BrowserWindow} from 'electron';
import {ipcMain} from 'electron';
import * as fs from 'fs';
import * as path from 'path';

const DEV_INPUT = '/dev/input';
const SYS_CLASS_INPUT = '/sys/class/input';

/** joydev `struct js_event`: __u32 time, __s16 value, __u8 type, __u8 number. */
export const JS_EVENT_SIZE = 8;
/** Bit set on the synthetic burst joydev replays to describe state at open time. */
const JS_EVENT_INIT = 0x80;
const JS_EVENT_BUTTON = 0x01;
const JS_EVENT_AXIS = 0x02;

/** joydev's fixed-point axis range. */
const AXIS_MAX = 32767;

/** Coalescing window for renderer updates — matches the renderer's poll period. */
const PUSH_INTERVAL_MS = 8;
/** Debounce for hotplug rescans (a single plug event storms /dev/input). */
const RESCAN_DEBOUNCE_MS = 250;

/** The IPC channel carrying pad snapshots to the renderer. */
export const NATIVE_PADS_CHANNEL = 'desktop:native-pads';
/** The renderer's "do I still need these?" answer — see `wanted` below. */
export const NATIVE_PADS_WANTED_CHANNEL = 'desktop:native-pads-wanted';

/** One decoded joydev event. */
export interface JsEvent {
  type: number;
  number: number;
  value: number;
  /** True for the state-priming burst emitted on open — real edges only after. */
  init: boolean;
}

/** A device's raw joydev state, indexed exactly as the kernel numbers them. */
export interface RawPadState {
  buttons: number[];
  axes: number[];
}

/** What the renderer receives: already in W3C standard-mapping order. */
export interface NativePadSnapshot {
  index: number;
  id: string;
  buttons: number[];
  axes: number[];
}

/**
 * Decode whole js_event records from a byte buffer. Returns the events plus any
 * trailing partial record, which the caller must prepend to the next chunk — a
 * read on a character device is not guaranteed to land on a record boundary, and
 * silently dropping the remainder would corrupt every following event.
 */
export function parseJsEvents(buffer: Buffer): {events: JsEvent[], rest: Buffer} {
  const events: JsEvent[] = [];
  let offset = 0;
  while (offset + JS_EVENT_SIZE <= buffer.length) {
    const type = buffer[offset + 6];
    events.push({
      type: type & ~JS_EVENT_INIT,
      number: buffer[offset + 7],
      value: buffer.readInt16LE(offset + 4),
      init: (type & JS_EVENT_INIT) !== 0,
    });
    offset += JS_EVENT_SIZE;
  }
  return {events, rest: buffer.subarray(offset)};
}

/** Fold one event into the raw state. Unknown indices grow the arrays. */
export function applyJsEvent(state: RawPadState, event: JsEvent): void {
  if (event.type === JS_EVENT_BUTTON) {
    state.buttons[event.number] = event.value === 0 ? 0 : 1;
  } else if (event.type === JS_EVENT_AXIS) {
    state.axes[event.number] = event.value;
  }
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/** joydev fixed point → the W3C −1..1 stick range. */
function stick(raw: number | undefined): number {
  return clamp((raw ?? 0) / AXIS_MAX, -1, 1);
}

/** An analog trigger axis (rest −32767) → the W3C 0..1 button value. */
function trigger(raw: number | undefined): number {
  return clamp(((raw ?? -AXIS_MAX) + AXIS_MAX) / (2 * AXIS_MAX), 0, 1);
}

function bit(value: number | undefined): number {
  return value === undefined || value === 0 ? 0 : 1;
}

/**
 * Raw joydev state → the W3C "standard" mapping the poll model speaks.
 *
 * The layout is the xpad/X360 one every device here reports (both the Steam
 * virtual pads and the Wolverine's own node): buttons A B X Y LB RB Back Start
 * Guide LS RS, axes LX LY LT RX RY RT DPadX DPadY.
 *
 * The d-pad is read from BOTH conventions — the hat axes 6/7 and, where the
 * driver exposes them instead, buttons 11..14 — because which one a device uses
 * varies by driver version, and a union costs nothing while a wrong guess costs
 * the entire d-pad.
 */
export function toStandardPad(raw: RawPadState): {buttons: number[], axes: number[]} {
  const b = raw.buttons;
  const a = raw.axes;
  const hatX = a[6] ?? 0;
  const hatY = a[7] ?? 0;
  return {
    buttons: [
      bit(b[0]), // 0  A / confirm
      bit(b[1]), // 1  B / back
      bit(b[2]), // 2  X
      bit(b[3]), // 3  Y
      bit(b[4]), // 4  LB
      bit(b[5]), // 5  RB
      trigger(a[2]), // 6  LT (analog)
      trigger(a[5]), // 7  RT (analog)
      bit(b[6]), // 8  View / Back
      bit(b[7]), // 9  Menu / Start
      bit(b[9]), // 10 L3
      bit(b[10]), // 11 R3
      hatY < 0 || bit(b[11]) === 1 ? 1 : 0, // 12 D-pad up
      hatY > 0 || bit(b[12]) === 1 ? 1 : 0, // 13 D-pad down
      hatX < 0 || bit(b[13]) === 1 ? 1 : 0, // 14 D-pad left
      hatX > 0 || bit(b[14]) === 1 ? 1 : 0, // 15 D-pad right
      bit(b[8]), // 16 Guide
    ],
    axes: [stick(a[0]), stick(a[1]), stick(a[3]), stick(a[4])],
  };
}

// ── MIRROR SUPPRESSION ──────────────────────────────────────────────────────
// Steam Input publishes a controller TWICE: the device itself and a virtual
// twin. On the measured Deck both are live, so one press arrives on two nodes,
// the two land in different poll frames, and the renderer's driver changes hands
// about once per press. Input stays correct (the loser's edges are dropped) but
// the churn is noise we can remove at the source.
//
// Twins are identified by BEHAVIOUR, never by name or vendor id: two nodes that
// always agree on button state and diverge only for the instant it takes an edge
// to reach both. Two genuinely different controllers diverge the moment one is
// held and the other is not — far longer than the tolerance — and are then
// rejected PERMANENTLY, so a real pad can never be silenced. A pad with no twin
// is never even a candidate, which is what keeps a mixed set-up safe (one
// controller through Steam Input, another with it forced off).
//
// Every uncertainty resolves toward publishing both — the current behaviour.

/** Divergence longer than this means two genuinely different devices. */
export const TWIN_DISAGREE_TOLERANCE_MS = 64;
/** Agreements on a NON-NEUTRAL state needed before twinhood is accepted. */
export const TWIN_CONFIRM = 3;
/** Float slack when comparing analog values. */
const TWIN_EPSILON = 0.02;

/** How one pair of devices has been behaving relative to each other. */
export interface TwinState {
  /** Timestamp divergence began (0 = currently agreeing). */
  disagreeSince: number;
  /** Times they agreed while something was actually pressed. */
  activeAgreements: number;
  /** Diverged for longer than the tolerance — never twins again. */
  rejected: boolean;
}

export function initialTwinState(): TwinState {
  return {disagreeSince: 0, activeAgreements: 0, rejected: false};
}

export type MappedPad = {buttons: number[], axes: number[]};

/** Is nobody touching this pad? Two idle pads agree trivially and prove nothing. */
export function isNeutralPad(pad: MappedPad): boolean {
  return pad.buttons.every((v) => v <= TWIN_EPSILON) && pad.axes.every((v) => Math.abs(v) <= TWIN_EPSILON);
}

export function padsAgree(a: MappedPad, b: MappedPad): boolean {
  if (a.buttons.length !== b.buttons.length || a.axes.length !== b.axes.length) {
    return false;
  }
  return a.buttons.every((v, i) => Math.abs(v - b.buttons[i]) <= TWIN_EPSILON) &&
    a.axes.every((v, i) => Math.abs(v - b.axes[i]) <= TWIN_EPSILON);
}

/**
 * Fold one observation into a pair's twin state. Rejection is permanent: the
 * cost of wrongly keeping two views of one controller is log churn, while the
 * cost of wrongly dropping a real controller is a player with no input.
 */
export function updateTwinState(state: TwinState, a: MappedPad, b: MappedPad, now: number): TwinState {
  if (state.rejected) {
    return state;
  }
  if (padsAgree(a, b)) {
    return {
      disagreeSince: 0,
      // Only a shared PRESS is evidence; shared idleness is not.
      activeAgreements: isNeutralPad(a) ? state.activeAgreements : state.activeAgreements + 1,
      rejected: false,
    };
  }
  // Diverging: tolerated only as long as one edge needs to reach both nodes.
  const since = state.disagreeSince === 0 ? now : state.disagreeSince;
  return {
    disagreeSince: since,
    activeAgreements: state.activeAgreements,
    rejected: now - since > TWIN_DISAGREE_TOLERANCE_MS,
  };
}

export function areTwins(state: TwinState): boolean {
  return !state.rejected && state.activeAgreements >= TWIN_CONFIRM;
}

/** Identity a device is chosen or dropped by (order = who survives a pair). */
export type TwinCandidate = {node: string, index: number, steamVirtual: boolean};

/**
 * Given the confirmed twin pairs, decide which nodes NOT to publish: one member
 * of each group survives — the Steam Input virtual view first (it is the one
 * honouring the player's Steam layout), otherwise the lowest joystick index.
 * Groups are transitive, so a device mirrored three ways still yields one pad.
 */
export function suppressedMirrors(
  devices: ReadonlyArray<TwinCandidate>,
  isTwin: (a: string, b: string) => boolean,
): Set<string> {
  const preferred = [...devices].sort((x, y) =>
    x.steamVirtual !== y.steamVirtual ? (x.steamVirtual ? -1 : 1) : x.index - y.index);
  const keptFor = new Map<string, string>(); // node → the node that represents it
  const suppressed = new Set<string>();
  for (const device of preferred) {
    const twinOfKept = [...keptFor.keys()].find((kept) => isTwin(kept, device.node));
    if (twinOfKept === undefined) {
      keptFor.set(device.node, device.node);
    } else {
      suppressed.add(device.node);
    }
  }
  return suppressed;
}

/** The kernel's human name for a joystick node, e.g. "Microsoft X-Box 360 pad 0". */
function deviceName(node: string): string {
  try {
    return fs.readFileSync(path.join(SYS_CLASS_INPUT, node, 'device', 'name'), 'utf8').trim();
  } catch {
    return node;
  }
}

function log(message: string): void {
  console.log(`[gamepad] ${message}`);
}

/** Steam Input's virtual gamepad — the view that honours the player's layout. */
const STEAM_VIRTUAL_VENDOR = '28de';
const STEAM_VIRTUAL_PRODUCT = '11ff';

function sysfsId(node: string, field: 'vendor' | 'product'): string {
  try {
    return fs.readFileSync(path.join(SYS_CLASS_INPUT, node, 'device', 'id', field), 'utf8').trim().toLowerCase();
  } catch {
    return '';
  }
}

/** Used only to pick WHICH twin survives — never to decide what is a twin. */
function isSteamVirtual(node: string): boolean {
  return sysfsId(node, 'vendor') === STEAM_VIRTUAL_VENDOR &&
    sysfsId(node, 'product') === STEAM_VIRTUAL_PRODUCT;
}

/** Stable key for an unordered device pair. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** One opened joystick node. */
interface OpenDevice {
  node: string;
  index: number;
  id: string;
  /** Steam Input's virtual view — preferred survivor when twins are found. */
  steamVirtual: boolean;
  stream: fs.ReadStream;
  state: RawPadState;
  /** Bytes of a js_event record split across two reads. */
  carry: Buffer;
}

/**
 * Start reading every joystick device and streaming snapshots to the renderer.
 * Best-effort throughout: a device that cannot be opened is skipped and logged,
 * and any failure leaves the stock Chromium path untouched. Returns a disposer.
 */
export function installNativeGamepads(win: BrowserWindow): () => void {
  if (process.platform !== 'linux') {
    return () => {/* stock path everywhere else */};
  }

  const devices = new Map<string, OpenDevice>();
  /** Per unordered device pair: are these two views of one controller? */
  const twins = new Map<string, TwinState>();
  let dirty = false;
  let disposed = false;
  let rescanTimer: NodeJS.Timeout | undefined;

  /**
   * Does the renderer still need these snapshots?
   *
   * On a Linux host whose Gamepad API WORKS (a Steam Machine), the renderer
   * reads Chromium's pads and discards ours — so pushing them is pure waste
   * while a stick is moving. It answers here once it has POSITIVE proof the
   * stock path works, i.e. Chromium actually reports a connected pad.
   *
   * Defaulting to TRUE is load-bearing: at startup Chromium hides pads until
   * the first button press, so "no pads visible" is indistinguishable from
   * "fetcher is blind". Starting suppressed would mean the Steam Deck — where
   * that first press can only ever arrive through THIS source — never receives
   * anything, and nothing would ever flip it back. When in doubt, we push.
   *
   * The devices stay open either way: a working Gamepad API can lose its pads
   * again, and the fallback has to be instant.
   */
  let wanted = true;

  const push = (): void => {
    if (!dirty || !wanted || disposed || win.isDestroyed() || win.webContents.isDestroyed()) {
      return;
    }
    dirty = false;
    const live = [...devices.values()];
    const mapped = new Map(live.map((device) => [device.node, toStandardPad(device.state)]));

    // Update every pair's twin verdict from what the devices are doing RIGHT
    // NOW, then drop the redundant views. Both steps are pure; a mistake here
    // can only cost us the dedupe, never a device (see suppressedMirrors).
    const at = Date.now();
    for (let i = 0; i < live.length; i++) {
      for (let j = i + 1; j < live.length; j++) {
        const key = pairKey(live[i].node, live[j].node);
        const before = twins.get(key) ?? initialTwinState();
        const after = updateTwinState(
          before,
          mapped.get(live[i].node) as MappedPad,
          mapped.get(live[j].node) as MappedPad,
          at);
        twins.set(key, after);
        if (areTwins(after) !== areTwins(before)) {
          log(`native: ${live[i].node} ("${live[i].id}") and ${live[j].node} ("${live[j].id}") ` +
            `${areTwins(after) ? 'are the SAME controller — publishing one' : 'are DIFFERENT controllers — publishing both'}`);
        }
      }
    }
    const hidden = suppressedMirrors(live, (a, b) => areTwins(twins.get(pairKey(a, b)) ?? initialTwinState()));

    const pads: NativePadSnapshot[] = [];
    for (const device of live) {
      if (hidden.has(device.node)) {
        continue;
      }
      const state = mapped.get(device.node) as MappedPad;
      pads.push({index: device.index, id: device.id, buttons: state.buttons, axes: state.axes});
    }
    try {
      win.webContents.send(NATIVE_PADS_CHANNEL, pads);
    } catch {
      // Window tearing down — the next push (if any) will find it destroyed.
    }
  };

  const pushTimer = setInterval(push, PUSH_INTERVAL_MS);
  pushTimer.unref?.();

  const close = (device: OpenDevice): void => {
    devices.delete(device.node);
    // Forget this device's verdicts — a controller re-plugged onto the same node
    // is a fresh device and must earn (or escape) twinhood on its own behaviour.
    for (const key of [...twins.keys()]) {
      if (key.split('|').includes(device.node)) {
        twins.delete(key);
      }
    }
    try {
      device.stream.close();
    } catch {
      // already gone
    }
    log(`native: ${device.node} ("${device.id}") closed — ${devices.size} device(s) left`);
    dirty = true;
  };

  const open = (node: string): void => {
    if (devices.has(node)) {
      return;
    }
    const file = path.join(DEV_INPUT, node);
    const index = Number.parseInt(node.slice(2), 10);
    if (!Number.isFinite(index)) {
      return;
    }
    let stream: fs.ReadStream;
    try {
      stream = fs.createReadStream(file, {highWaterMark: JS_EVENT_SIZE * 64});
    } catch (err) {
      log(`native: cannot open ${file} — ${String(err)}`);
      return;
    }
    const device: OpenDevice = {
      node, index, id: deviceName(node), steamVirtual: isSteamVirtual(node), stream,
      state: {buttons: [], axes: []}, carry: Buffer.alloc(0),
    };
    devices.set(node, device);
    log(`native: reading ${node} "${device.id}"${device.steamVirtual ? ' (Steam Input virtual)' : ''}`);

    stream.on('data', (chunk: Buffer | string) => {
      if (typeof chunk === 'string') {
        return;
      }
      const {events, rest} = parseJsEvents(
        device.carry.length === 0 ? chunk : Buffer.concat([device.carry, chunk]));
      device.carry = Buffer.from(rest);
      for (const event of events) {
        applyJsEvent(device.state, event);
      }
      // The init burst still updates state (so rest values are correct from the
      // first push) — it just is not itself worth waking the renderer for.
      if (events.some((e) => !e.init)) {
        dirty = true;
      }
    });
    // A pad unplugged mid-read surfaces as ENODEV here.
    stream.on('error', () => close(device));
    stream.on('end', () => close(device));
    dirty = true;
  };

  const scan = (): void => {
    if (disposed) {
      return;
    }
    let nodes: string[];
    try {
      nodes = fs.readdirSync(DEV_INPUT).filter((e) => /^js\d+$/.test(e)).sort();
    } catch (err) {
      log(`native: cannot list ${DEV_INPUT} — ${String(err)}`);
      return;
    }
    for (const node of nodes) {
      open(node);
    }
    for (const device of [...devices.values()]) {
      if (!nodes.includes(device.node)) {
        close(device);
      }
    }
  };

  scan();
  if (devices.size === 0) {
    log(`native: no /dev/input/js* devices at startup — watching for hotplug`);
  }

  // Hotplug: /dev/input gains and loses js nodes as controllers and Steam Input's
  // virtual pads come and go. Debounced — one plug fires several dirent events.
  let watcher: fs.FSWatcher | undefined;
  try {
    watcher = fs.watch(DEV_INPUT, () => {
      if (rescanTimer !== undefined) {
        clearTimeout(rescanTimer);
      }
      rescanTimer = setTimeout(scan, RESCAN_DEBOUNCE_MS);
      rescanTimer.unref?.();
    });
  } catch (err) {
    log(`native: hotplug watch unavailable — ${String(err)}`);
  }

  // The renderer's suppression answer. `removeHandler` first because this app
  // can build its window more than once and `handle` throws on a duplicate
  // channel — a crash on the second window, from a diagnostic nicety.
  ipcMain.removeHandler(NATIVE_PADS_WANTED_CHANNEL);
  ipcMain.handle(NATIVE_PADS_WANTED_CHANNEL, (_event, value: unknown) => {
    const next = value !== false;
    if (next !== wanted) {
      log(`native: renderer ${next ? 'NEEDS' : 'does not need'} native pads ` +
        `(Chromium Gamepad API ${next ? 'is empty' : 'is working'})`);
    }
    wanted = next;
    if (next) {
      dirty = true; // resume with a fresh snapshot, not whatever it last saw
    }
  });

  // A renderer that (re)loads asks for the current set, since it missed the
  // pushes that happened while it was navigating — and it has not yet had the
  // chance to tell us whether it needs them, so we resume until it does. (This
  // app reloads at every game boundary, so a stale suppression would strand it.)
  const onDomReady = (): void => {
    wanted = true;
    dirty = true;
  };
  win.webContents.on('dom-ready', onDomReady);

  return () => {
    disposed = true;
    clearInterval(pushTimer);
    if (rescanTimer !== undefined) {
      clearTimeout(rescanTimer);
    }
    watcher?.close();
    ipcMain.removeHandler(NATIVE_PADS_WANTED_CHANNEL);
    // The usual caller is the window's own 'closed' event, and by then the
    // native window object is GONE — merely READING `win.webContents` throws
    // "Object has been destroyed" and, unhandled in the main process, that is a
    // crash dialog on the way out of the game. Its listeners died with it, so
    // there is nothing to detach in that case.
    if (!win.isDestroyed()) {
      win.webContents.off('dom-ready', onDomReady);
    }
    for (const device of [...devices.values()]) {
      close(device);
    }
  };
}

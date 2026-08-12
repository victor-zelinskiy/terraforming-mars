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

/** One opened joystick node. */
interface OpenDevice {
  node: string;
  index: number;
  id: string;
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
  let dirty = false;
  let disposed = false;
  let rescanTimer: NodeJS.Timeout | undefined;

  const push = (): void => {
    if (!dirty || disposed || win.isDestroyed() || win.webContents.isDestroyed()) {
      return;
    }
    dirty = false;
    const pads: NativePadSnapshot[] = [];
    for (const device of devices.values()) {
      const mapped = toStandardPad(device.state);
      pads.push({index: device.index, id: device.id, buttons: mapped.buttons, axes: mapped.axes});
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
      node, index, id: deviceName(node), stream,
      state: {buttons: [], axes: []}, carry: Buffer.alloc(0),
    };
    devices.set(node, device);
    log(`native: reading ${node} "${device.id}"`);

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

  // A renderer that (re)loads asks for the current set, since it missed the
  // pushes that happened while it was navigating.
  const onDomReady = (): void => {
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

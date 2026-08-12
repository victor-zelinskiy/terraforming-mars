// LINUX INPUT PROBE — answers "is the device missing, or is Chromium blind to it?"
//
// The Steam Deck field report that motivated this: the renderer logged
// `[gamepad] installed — pads=0 slots=4 [...]` in every session and NEVER a
// `connected` line, with any Steam Input layout. That is all the Gamepad API can
// tell us — it reports the ABSENCE of devices identically whether the kernel has
// no joystick node at all or whether Chromium's udev-based fetcher failed to
// enumerate one that is sitting right there.
//
// This module looks at the kernel's own view from the MAIN process (plain Node,
// no Chromium involvement) and prints it with the same `[gamepad]` prefix, so it
// lands in the Steam Deck wrapper log next to the renderer's line. Reading the
// two together is decisive:
//
//   js nodes present + renderer pads=0  → the devices exist; CHROMIUM is the
//                                         problem (udev/enumeration) → a native
//                                         input bridge is the only real fix.
//   no js nodes                         → Steam never created a virtual pad →
//                                         the fix is Steam-side configuration.
//   node present but silent on input    → created but dead (grabbed, or the
//                                         layout emits keyboard instead).
//
// STRICTLY READ-ONLY and best-effort: every syscall is wrapped, Linux-only, and
// any failure degrades to a logged note. It must never affect startup or input.

import * as fs from 'fs';
import * as path from 'path';

/** Where the kernel exposes joystick/event char devices and their metadata. */
const DEV_INPUT = '/dev/input';
const SYS_CLASS_INPUT = '/sys/class/input';
/** Chromium's udev-based fetcher needs this to exist to see ANY gamepad. */
const RUN_UDEV = '/run/udev';

/** How long the passive watch stays open for the player to press something. */
const WATCH_MS = 30000;
/** joydev's `struct js_event` is 8 bytes: __u32 time, __s16 value, __u8 type, __u8 number. */
const JS_EVENT_SIZE = 8;

function log(message: string): void {
  console.log(`[gamepad] ${message}`);
}

/** The kernel's name for an input node, e.g. "Microsoft X-Box 360 pad 0". */
function deviceName(node: string): string {
  try {
    return fs.readFileSync(path.join(SYS_CLASS_INPUT, node, 'device', 'name'), 'utf8').trim();
  } catch {
    return '?';
  }
}

/**
 * The sysfs path Chromium derives device identity from. Worth printing verbatim:
 * every uinput device lives under /devices/virtual/input/, and Chromium keys
 * devices on the substring BEFORE the first "input" — so all virtual pads
 * collapse to the same "/sys/devices/virtual/" prefix and only one survives.
 */
function devicePath(node: string): string {
  try {
    return fs.readlinkSync(path.join(SYS_CLASS_INPUT, node)).replace(/^(\.\.\/)+/, '/');
  } catch {
    return '?';
  }
}

/** Can we actually open it? A node we cannot read is invisible to Chromium too. */
function readable(file: string): boolean {
  try {
    fs.accessSync(file, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Open each joystick node read-only and report the FIRST real event from each.
 * joydev replays the current state as synthetic (`type & 0x80`) events on open —
 * those are filtered out, so a line here means the player physically moved
 * something and the kernel delivered it. Streams close themselves after the
 * window; handles are unref'd so they can never hold the app open.
 */
function watchForInput(nodes: ReadonlyArray<string>): void {
  for (const node of nodes) {
    const file = path.join(DEV_INPUT, node);
    let stream: fs.ReadStream;
    try {
      stream = fs.createReadStream(file, {highWaterMark: JS_EVENT_SIZE * 64});
    } catch (err) {
      log(`probe: cannot open ${file} — ${String(err)}`);
      continue;
    }
    let reported = false;
    stream.on('data', (chunk: Buffer | string) => {
      if (reported || typeof chunk === 'string') {
        return;
      }
      for (let i = 0; i + JS_EVENT_SIZE <= chunk.length; i += JS_EVENT_SIZE) {
        const type = chunk[i + 6];
        // Bit 7 marks joydev's synthetic initial-state burst — not a real press.
        if ((type & 0x80) !== 0) {
          continue;
        }
        reported = true;
        const number = chunk[i + 7];
        const value = chunk.readInt16LE(i + 4);
        const kind = (type & 0x02) !== 0 ? 'axis' : 'button';
        log(`probe: INPUT SEEN on ${node} ("${deviceName(node)}") — ${kind} ${number} = ${value}`);
        break;
      }
      if (reported) {
        stream.close();
      }
    });
    stream.on('error', (err) => log(`probe: read error on ${node} — ${String(err)}`));
    const timer = setTimeout(() => {
      if (!reported) {
        log(`probe: no input from ${node} ("${deviceName(node)}") in ${WATCH_MS / 1000}s`);
      }
      stream.close();
    }, WATCH_MS);
    timer.unref?.();
  }
}

/**
 * Enumerate the kernel's input devices and log them, then passively watch the
 * joystick nodes so a button press proves the device is alive. Linux-only; a
 * no-op everywhere else. Call once after the window exists — late enough that
 * Steam has created its virtual pads.
 */
export function probeLinuxInput(): void {
  if (process.platform !== 'linux') {
    return;
  }
  try {
    log(`probe: udev ${fs.existsSync(RUN_UDEV) ? 'present' : 'MISSING'} at ${RUN_UDEV} ` +
      `(Chromium enumerates gamepads through it — missing = it can never see any pad)`);

    const entries = fs.readdirSync(DEV_INPUT);
    const jsNodes = entries.filter((e) => /^js\d+$/.test(e)).sort();
    const eventNodes = entries.filter((e) => /^event\d+$/.test(e)).sort();

    if (jsNodes.length === 0) {
      log(`probe: NO /dev/input/js* nodes — the kernel has no joystick device, ` +
        `so no configuration of ours could surface one (${eventNodes.length} event nodes present)`);
      return;
    }
    for (const node of jsNodes) {
      const file = path.join(DEV_INPUT, node);
      log(`probe: ${node} "${deviceName(node)}" readable=${readable(file)} sysfs=${devicePath(node)}`);
    }
    log(`probe: watching ${jsNodes.join(', ')} for ${WATCH_MS / 1000}s — press a button on the controller that does not work`);
    watchForInput(jsNodes);
  } catch (err) {
    log(`probe: failed — ${String(err)}`);
  }
}

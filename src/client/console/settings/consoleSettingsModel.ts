/*
 * THE CONSOLE SETTINGS MODEL — one declarative description of every
 * persistent console preference, grouped into CATEGORIES.
 *
 * Why a model and not a component computed: the settings surface grew past
 * a single scrollable column (eleven rows and counting — they no longer fit
 * a TV screen), so it became a category rail + a compact row list + a detail
 * strip. That layout needs three things the old inline `switch` could not
 * give it:
 *
 *  1. CATEGORIES — a row belongs to exactly one, and a category that has no
 *     rows in the current context is never rendered (no empty tabs).
 *  2. A RING PER SETTING, not a cycle function — the panel steps values in
 *     BOTH directions (‹ / ›, d-pad left/right) and shows the position in
 *     the ring as pips. `index` / `count` / `step(dir)` come from here.
 *  3. A DESCRIPTION that is a first-class field, shown big in the detail
 *     strip instead of squeezed under the label. That is what let the rows
 *     become one line tall — the fix for "the settings do not fit".
 *
 * `minor: true` marks the technical/advanced categories (host-as-server
 * networking, the read-only diagnostics readout): the rail renders them
 * small and dim under a «ДОПОЛНИТЕЛЬНО» hairline, so the four categories a
 * player actually tunes stay the loud ones.
 *
 * The builder reads the same module singletons the settings themselves live
 * in (`glyphSetState`, `buttonLayoutState`, motionTokens' cached prefs, the
 * desktop bridge snapshots passed in) and returns already-TRANSLATED value /
 * note strings — labels and descriptions stay English i18n keys, translated
 * by the surface. Callers rebuild after every `step()` (the panel bumps a
 * revision counter): the motion prefs are module-cached, not reactive, so a
 * rebuild — not Vue tracking — is what makes their values honest.
 */

import {
  PROFILE_CHOICES,
  PROFILE_LABELS,
  consoleDisplayDiagnostics,
  consoleLayoutState,
  currentProfileOverride,
  setConsoleProfileOverride,
} from '@/client/console/consoleLayoutProfile';
import {consoleModeState, setConsoleMode} from '@/client/console/consoleModeState';
import {
  GLYPHSET_CHOICES,
  GLYPHSET_LABELS,
  glyphSetState,
  layoutSwapLabels,
  resolveGlyphSetId,
  setGlyphSetOverride,
} from '@/client/gamepad/glyphSets';
import {BUTTON_LAYOUT_CHOICES, BUTTON_LAYOUT_LABELS, buttonLayoutState, setButtonLayout} from '@/client/gamepad/buttonLayout';
import {WHEEL_CONTROL_CHOICES, WHEEL_CONTROL_LABELS, setWheelControlMode, wheelControlState} from '@/client/console/quickWheel/wheelControlMode';
import {privateScoreState, setPrivateScore} from '@/client/components/overview/privateScoreState';
import {
  type MotionFpsCap,
  type MotionSpeedPreset,
  motionFpsCap,
  motionSpeedPreset,
  setMotionFpsCap,
  setMotionSpeedPreset,
} from '@/client/components/motion/motionTokens';
import {consolePerfState, setConsolePerfLite} from '@/client/console/consolePerfMode';
import {READING_SCALE_CHOICES, readingScaleState, setConsoleReadingScale} from '@/client/console/consoleReadingScale';
import {ALBUM_LAYOUT_CHOICES, ALBUM_LAYOUT_LABELS, albumLayoutState, setConsoleAlbumLayout} from '@/client/console/consoleAlbumLayout';
import {
  FEED_MODE_CHOICES,
  FEED_MODE_LABELS,
  notificationFeedModeState,
  setNotificationFeedMode,
} from '@/client/components/notifications/notificationFeedMode';
import {desktopBridge, DesktopAppModeInfo, DesktopLanState} from '@/client/components/desktop/desktopUpdateState';
import {realtimeState, realtimeHealthy, realtimePollIntervalMs} from '@/client/components/realtime/realtimeService';
import {buildVersionLabel} from '@/common/utils/buildVersion';
import raw_settings from '@/genfiles/settings.json';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

/** Where the surface is hosted — 'game' is the in-game system menu. */
export type ConsoleSettingsContext = 'menu' | 'game';

export type ConsoleSettingsCategoryId =
  'interface' | 'controls' | 'graphics' | 'game' | 'network' | 'diagnostics';

export type ConsoleSettingId =
  'shell' | 'display' | 'textScale' | 'albumLayout' | 'notifications' | 'controller' | 'buttons' | 'wheelControl' |
  'motionSpeed' | 'motionRate' | 'perfMode' | 'privateScore' | 'gameServer' | 'lanVisible';

/** One dialable preference: a ring of options plus where we are in it. */
export type ConsoleSettingRow = {
  id: ConsoleSettingId,
  /** English i18n key — the row label (never echoes its category's noun). */
  label: string,
  /** English i18n key — the full description, shown in the detail strip. */
  desc: string,
  /** Already-translated current value. */
  value: string,
  /** Position in the option ring (0-based) and its size — the stepper pips. */
  index: number,
  count: number,
  /** Already-translated live note ('' = none): "applies after restart", … */
  note: string,
  /** `pending` paints the note amber (a choice not yet in effect). */
  noteTone: 'info' | 'pending',
  /** Apply the option `dir` steps away in the ring, wrapping. */
  step: (dir: 1 | -1) => void,
};

/** A read-only readout line (the diagnostics category). */
export type ConsoleReadoutRow = {
  label: string,
  /** true = `label` is a technical literal (Viewport / DPR), not an i18n key. */
  raw: boolean,
  value: string,
  tone: 'plain' | 'ok' | 'warn' | 'bad' | 'mono',
};

export type ConsoleReadoutGroup = {
  /** English i18n key. */
  label: string,
  rows: ReadonlyArray<ConsoleReadoutRow>,
  /** A trailing explanation ('' = none) — already translated or raw text. */
  note: string,
  noteBad: boolean,
};

export type ConsoleSettingsCategory = {
  id: ConsoleSettingsCategoryId,
  /** English i18n key. */
  label: string,
  glyph: string,
  /** Technical / advanced — the rail renders it small under «Дополнительно». */
  minor: boolean,
  rows: ReadonlyArray<ConsoleSettingRow>,
  /** Read-only groups; a category has either rows or a readout, never both. */
  readout: ReadonlyArray<ConsoleReadoutGroup>,
};

export type ConsoleSettingsInput = {
  context: ConsoleSettingsContext,
  /** Host-as-server snapshot (undefined on the web → the rows are hidden). */
  server?: DesktopAppModeInfo,
  lan?: DesktopLanState,
  /** Baked Electron app version, for the diagnostics «Client version» row. */
  desktopVersion?: string,
};

// English i18n keys ('Standard' / 'Auto' already exist — reused).
const MOTION_SPEED_LABELS: Record<MotionSpeedPreset, string> = {
  standard: 'Standard',
  calm: 'Calm',
  swift: 'Swift',
};
const MOTION_SPEED_CHOICES: ReadonlyArray<MotionSpeedPreset> = ['standard', 'calm', 'swift'];
const MOTION_FPS_LABELS: Record<'auto' | '30' | '60', string> = {
  auto: 'Auto',
  60: '60 FPS',
  30: '30 FPS',
};
const MOTION_FPS_CHOICES: ReadonlyArray<MotionFpsCap> = ['auto', 60, 30];

/** Step an index inside a ring, wrapping in both directions. */
function stepRing(length: number, index: number, dir: 1 | -1): number {
  return length === 0 ? 0 : (index + dir + length) % length;
}

/**
 * Build one dialable row from a RING: the option list, where the current
 * value sits in it, and how to apply another one. Every setting goes through
 * this, so «‹ / › steps and wraps» can never differ between two rows.
 */
function ringRow<T>(
  id: ConsoleSettingId,
  label: string,
  desc: string,
  ring: ReadonlyArray<T>,
  current: T,
  render: (value: T) => string,
  apply: (value: T) => void,
  note: {text: string, tone?: 'info' | 'pending'} = {text: ''},
): ConsoleSettingRow {
  // An unknown current value (a hand-edited localStorage key) must not make
  // the stepper unusable — treat it as position 0.
  const index = Math.max(0, ring.indexOf(current));
  return {
    id,
    label,
    desc,
    value: render(current),
    index,
    count: ring.length,
    note: note.text,
    noteTone: note.tone ?? 'info',
    step: (dir) => {
      const next = ring[stepRing(ring.length, index, dir)];
      if (next !== undefined) {
        apply(next);
      }
    },
  };
}

/** A two-state toggle is just a ring of `[false, true]` — same stepper. */
function toggleRow(
  id: ConsoleSettingId,
  label: string,
  desc: string,
  current: boolean,
  labels: readonly [string, string],
  apply: (value: boolean) => void,
  note: {text: string, tone?: 'info' | 'pending'} = {text: ''},
): ConsoleSettingRow {
  return ringRow(
    id, label, desc,
    [false, true] as ReadonlyArray<boolean>, current,
    (v) => translateText(v ? labels[1] : labels[0]),
    apply, note,
  );
}

/** «Обмен A / B» — the value NAMES two face buttons, so it follows the glyph set. */
function buttonLayoutValue(layout: typeof buttonLayoutState.layout): string {
  const labels = layoutSwapLabels(layout);
  return labels.length === 0 ?
    translateText(BUTTON_LAYOUT_LABELS[layout]) :
    translateTextWithParams(BUTTON_LAYOUT_LABELS[layout], [...labels]);
}

/** ── ИНТЕРФЕЙС ─────────────────────────────────────────────────────── */
function interfaceCategory(input: ConsoleSettingsInput): ConsoleSettingsCategory {
  const rows: Array<ConsoleSettingRow> = [];
  // The shell switch (console ↔ desktop) is MAIN-MENU ONLY: the desktop UI is
  // frozen and reachable only from the menu, and swapping shells mid-game is
  // jarring. Picking Desktop stores the opt-out the auto-enable honours.
  if (input.context !== 'game') {
    rows.push(toggleRow(
      'shell', 'Shell', 'Controller shell or mouse and keyboard',
      consoleModeState.enabled, ['Desktop', 'Console'],
      (v) => setConsoleMode(v),
    ));
  }
  // The layout profile. 'Auto' names what it currently resolves to, so the
  // pick is informed; the WHY lives in the diagnostics readout.
  const override = currentProfileOverride();
  rows.push(ringRow(
    'display', 'Display', 'Layout profile for this screen',
    PROFILE_CHOICES, override,
    (v) => (v === 'auto' ?
      `${translateText(PROFILE_LABELS.auto)} (${translateText(PROFILE_LABELS[consoleLayoutState.profile] ?? consoleLayoutState.profile)})` :
      translateText(PROFILE_LABELS[v] ?? v)),
    (v) => setConsoleProfileOverride(v),
  ));
  // Reading-text scale — long-form text only (card rules / archive entry /
  // prompt bodies on the reading tokens); chrome never rides it. 100% must
  // already be couch-comfortable — this is personal comfort, not a fix.
  rows.push(ringRow(
    'textScale', 'Reading text size', 'Card rules and archive text',
    READING_SCALE_CHOICES, readingScaleState.scale,
    (v) => (v === 100 ? translateText('Standard') : `${v}%`),
    (v) => setConsoleReadingScale(v),
  ));
  // The hand ALBUM composition: adaptive density pages (up to ten on a
  // desk/couch profile, thin pages showcase larger) vs «Крупные карты» —
  // always one big row of at most four. Pure presentation, applied through
  // the album's own recompose when the hand is open. The description
  // explains the CURRENT choice (the model rebuilds reactively).
  rows.push(ringRow(
    'albumLayout', 'Album layout',
    albumLayoutState.layout === 'large' ?
      'Up to 4 cards per page in a single row' :
      'Up to 10 cards per page, few cards grow larger',
    ALBUM_LAYOUT_CHOICES, albumLayoutState.layout,
    (v) => translateText(ALBUM_LAYOUT_LABELS[v]),
    (v) => setConsoleAlbumLayout(v),
  ));
  // Which top-right quick toasts present: everything (the default — identical
  // to the pre-setting behaviour) or only events that directly involve the
  // player. Filters PRESENTATION only — mandatory prompts, warnings, hostile
  // losses and the journal are never touched (notificationFeedPolicy.ts).
  rows.push(ringRow(
    'notifications', 'Quick notifications',
    'Hide events about other players unless they affect you directly; mandatory prompts and system alerts always show',
    FEED_MODE_CHOICES, notificationFeedModeState.mode,
    (v) => translateText(FEED_MODE_LABELS[v]),
    (v) => setNotificationFeedMode(v),
  ));
  return {id: 'interface', label: 'Interface', glyph: '◫', minor: false, rows, readout: []};
}

/** ── УПРАВЛЕНИЕ ────────────────────────────────────────────────────── */
function controlsCategory(): ConsoleSettingsCategory {
  const rows: Array<ConsoleSettingRow> = [
    // The button GLYPH set. Auto shows what it resolved to — Steam Input
    // virtualizes every pad as an Xbox one, so PlayStation is a manual pick.
    ringRow(
      'controller', 'Controller', 'Button glyph set',
      GLYPHSET_CHOICES, glyphSetState.override,
      (v) => (v === 'auto' ?
        `${translateText(GLYPHSET_LABELS.auto)} (${translateText(GLYPHSET_LABELS[resolveGlyphSetId()])})` :
        translateText(GLYPHSET_LABELS[v])),
      (v) => setGlyphSetOverride(v),
    ),
    // The confirm/cancel (A↔B) remap: the input funnels and the glyph layer
    // swap in lockstep, so the value always names the button that confirms.
    ringRow(
      'buttons', 'Button layout', 'Which face button confirms',
      BUTTON_LAYOUT_CHOICES, buttonLayoutState.layout,
      buttonLayoutValue,
      (v) => setButtonLayout(v),
    ),
    // The LT/RT quick wheel's control STYLE. Applies instantly — the shell's
    // watcher cancels any mid-wheel armed state without executing it.
    ringRow(
      'wheelControl', 'Wheel control', 'How the action wheel activates',
      WHEEL_CONTROL_CHOICES, wheelControlState.mode,
      (v) => translateText(WHEEL_CONTROL_LABELS[v]),
      (v) => setWheelControlMode(v),
    ),
  ];
  return {id: 'controls', label: 'Controls', glyph: '◎', minor: false, rows, readout: []};
}

/** ── ГРАФИКА ───────────────────────────────────────────────────────── */
function graphicsCategory(): ConsoleSettingsCategory {
  const rows: Array<ConsoleSettingRow> = [
    // Animation SPEED — Calm lengthens easings (fewer per-frame deltas),
    // Swift shortens them. Applied live through the `--motion-scale` bridge.
    ringRow(
      'motionSpeed', 'Motion speed', 'Pace of animations',
      MOTION_SPEED_CHOICES, motionSpeedPreset(),
      (v) => translateText(MOTION_SPEED_LABELS[v]),
      (v) => setMotionSpeedPreset(v),
    ),
    // Frame-rate cap — throttles both the rAF loops and (through the applier
    // main.ts registered on `setMotionFpsCap`) GSAP's global ticker, i.e. the
    // card-deal / FLIP cinematics. The bridge stays on the bootstrap side of
    // the seam, so this model never pulls gsap in.
    ringRow(
      'motionRate', 'Animation smoothness', 'Frame-rate cap for animations',
      MOTION_FPS_CHOICES, motionFpsCap(),
      (v) => translateText(MOTION_FPS_LABELS[v === 'auto' ? 'auto' : (String(v) as '30' | '60')]),
      (v) => setMotionFpsCap(v),
    ),
    // Performance mode — cuts the expensive DECORATIVE paint (blur + shadows).
    // Motion is untouched; only per-frame paint/layer cost drops.
    toggleRow(
      'perfMode', 'Performance mode', 'Cut shadows and blur for smoothness',
      consolePerfState.enabled, ['Off', 'On'],
      (v) => setConsolePerfLite(v),
    ),
  ];
  return {id: 'graphics', label: 'Graphics', glyph: '◈', minor: false, rows, readout: []};
}

/** ── ЭТА ПАРТИЯ (in-game only) ─────────────────────────────────────── */
function gameCategory(): ConsoleSettingsCategory {
  // Private score is a per-GAME display pref (keyed by the participant id),
  // so it is offered only where there is a game to scope it to.
  const rows: Array<ConsoleSettingRow> = [
    toggleRow(
      'privateScore', 'Private score', 'Hide your own victory points on screen',
      privateScoreState.enabled, ['Shown', 'Hidden'],
      (v) => setPrivateScore(v),
    ),
  ];
  // 'Game' («Партия»), NOT 'This game' — that key is the victory-point table's
  // «За партию» caption, and a settings category is not a scoring column.
  return {id: 'game', label: 'Game', glyph: '⬡', minor: false, rows, readout: []};
}

/** ── СЕТЬ (minor; desktop shell + main menu only) ───────────────────── */
function networkCategory(input: ConsoleSettingsInput): ConsoleSettingsCategory {
  const rows: Array<ConsoleSettingRow> = [];
  const server = input.server;
  if (server !== undefined) {
    // Host-as-server (docs/EMBEDDED_SERVER.md). The mode is a LAUNCH-time
    // property, so a changed value carries a pending note until restart.
    rows.push(ringRow(
      'gameServer', 'Game server', 'Local on this device or the online server; restart applies',
      ['host', 'remote'] as ReadonlyArray<'host' | 'remote'>, server.requested,
      (v) => translateText(v === 'host' ? 'Local' : 'Remote server'),
      (v) => {
        server.requested = v;
        void desktopBridge()?.setAppMode?.(v);
      },
      server.requested === server.effective ? {text: ''} : {text: translateText('Applies after restart'), tone: 'pending'},
    ));
    const lan = input.lan;
    if (server.requested === 'host' && lan !== undefined) {
      const active = lan.active ?? lan.visible;
      rows.push(toggleRow(
        'lanVisible', 'LAN visibility', 'Show hosted games on your local network; restart applies',
        lan.visible, ['Off', 'On'],
        (v) => {
          lan.visible = v;
          void desktopBridge()?.setLanVisible?.(v);
        },
        lan.visible === active ? {text: ''} : {text: translateText('Applies after restart'), tone: 'pending'},
      ));
    }
  }
  return {id: 'network', label: 'Network', glyph: '⇅', minor: true, rows, readout: []};
}

/** ── ДИАГНОСТИКА (minor; read-only) ────────────────────────────────── */
function diagnosticsCategory(input: ConsoleSettingsInput): ConsoleSettingsCategory {
  const d = consoleDisplayDiagnostics();
  const display: ConsoleReadoutGroup = {
    label: 'Display',
    rows: [
      // The profile is NAMED, not spelled as its enum id — the readout is read
      // by a player on a couch, not by a developer in a console log.
      {label: 'Profile', raw: false, value: `${translateText(PROFILE_LABELS[d.profile] ?? d.profile)} · ${translateText(d.forced ? 'manual' : 'auto')}`, tone: 'plain'},
      {label: 'Viewport', raw: true, value: d.viewport, tone: 'mono'},
      {label: 'Panel', raw: false, value: `${d.physical} · DPR ${d.devicePixelRatio}`, tone: 'mono'},
      {label: 'UI scale', raw: true, value: `×${d.uiScale}`, tone: 'plain'},
    ],
    // The resolver's own reason string — technical, deliberately untranslated
    // (it names the heuristic that chose the profile).
    note: d.reason,
    noteBad: false,
  };
  const connection: ConsoleReadoutGroup = {
    // Not 'Connection': the first ROW is already «Соединение» (the realtime
    // channel's state), and a group head that repeats its own first row
    // reads as a copy-paste slip.
    label: 'Server link',
    rows: connectionRows(input),
    note: versionMismatch(input) ? translateText('Client and server versions differ') : '',
    noteBad: versionMismatch(input),
  };
  return {
    id: 'diagnostics', label: 'Diagnostics', glyph: '⊙', minor: true, rows: [],
    readout: [connection, display],
  };
}

/**
 * The live realtime/poll snapshot. The `Poll interval` row is the key signal:
 * 20000 ms = WS healthy (calm), the safe `waitingForTimeout` (1000 ms) =
 * fallback polling — i.e. the client is hammering the server.
 */
function connectionRows(input: ConsoleSettingsInput): ReadonlyArray<ConsoleReadoutRow> {
  const s = realtimeState;
  const healthy = realtimeHealthy();
  let statusLabel: string;
  let statusTone: 'ok' | 'warn' | 'plain';
  if (s.status === 'disabled' || s.status === 'closed') {
    statusLabel = 'Realtime off';
    statusTone = 'plain';
  } else if (healthy) {
    statusLabel = 'Realtime active';
    statusTone = 'ok';
  } else if (s.status === 'error') {
    statusLabel = 'Error';
    statusTone = 'warn';
  } else if (s.status === 'reconnecting') {
    statusLabel = 'Reconnecting';
    statusTone = 'warn';
  } else {
    statusLabel = 'Connecting';
    statusTone = 'warn';
  }
  return [
    {label: 'Realtime', raw: false, value: translateText(statusLabel), tone: statusTone},
    {label: 'Poll interval', raw: false, value: `${realtimePollIntervalMs(raw_settings.waitingForTimeout)} ${translateText('ms')}`, tone: healthy ? 'ok' : 'warn'},
    {label: 'Updates received', raw: false, value: String(s.invalidationsReceived), tone: 'plain'},
    {label: 'Client version', raw: false, value: clientVersion(input), tone: 'mono'},
    {label: 'Server version', raw: false, value: serverVersion(), tone: versionMismatch(input) ? 'bad' : 'mono'},
  ];
}

/**
 * The same client version the main menu shows: baked Electron app version →
 * settings.json `version` → git `head`. The settings-derived part goes through
 * the SHARED buildVersionLabel — the exact resolver the server runs — so
 * «Client version» and «Server version» are directly comparable.
 */
function clientVersion(input: ConsoleSettingsInput): string {
  if (input.desktopVersion !== undefined && input.desktopVersion !== '') {
    return input.desktopVersion;
  }
  const label = buildVersionLabel(raw_settings);
  return label !== '' ? label : '—';
}

function serverVersion(): string {
  return realtimeState.serverBuildVersion ?? '—';
}

/** Only a REAL mismatch flags red — both sides must be genuinely known
 * ('—' means "not reported yet / older server", not a conflict). */
function versionMismatch(input: ConsoleSettingsInput): boolean {
  const client = clientVersion(input);
  const server = serverVersion();
  return client !== '—' && server !== '—' && client !== server;
}

/**
 * Every category that has something to show in this context, in rail order:
 * the four a player tunes, then the minor technical pair.
 */
export function buildConsoleSettings(input: ConsoleSettingsInput): ReadonlyArray<ConsoleSettingsCategory> {
  const all: Array<ConsoleSettingsCategory> = [
    interfaceCategory(input),
    controlsCategory(),
    graphicsCategory(),
  ];
  if (input.context === 'game') {
    all.push(gameCategory());
  }
  if (input.context !== 'game') {
    all.push(networkCategory(input));
  }
  all.push(diagnosticsCategory(input));
  // An empty category would render as a dead rail entry (network on the web,
  // where the desktop bridge answers nothing).
  return all.filter((c) => c.rows.length > 0 || c.readout.length > 0);
}

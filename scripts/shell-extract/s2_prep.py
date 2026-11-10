# S2 — the hand edits a pristine ConsoleShell.vue needs BEFORE the extraction specs are applied.
# Run from the worktree root. Idempotent: refuses when its anchors are gone (the shell moved — re-read and fix here).
import io, sys
p = sys.argv[1] if len(sys.argv) > 1 else 'src/client/components/console/ConsoleShell.vue'
s = io.open(p, encoding='utf8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
s = s.replace('\r\n', '\n')

def rep(old, new):
    global s
    assert s.count(old) == 1, (s.count(old), old[:90])
    s = s.replace(old, new, 1)

# (a) the conformance method the tool adds a row to per port
rep('''    // ── transport ────────────────────────────────────────────────────────
''', '''    /**
     * THE SHELL IS WHAT ITS CONTROLLERS' PORTS SAY (architecture v2 — `console/shell/shellPort.ts`). Never called: each
     * row is a compile-time proof (vue-tsc) that this component still provides every member a controller taken out
     * of it reads, calls or writes, with the type the controller expects. `scripts/shell-extract.mjs` adds a row per
     * extracted domain; a row goes when its port is empty.
     */
    shellPortsConform(): void {
    },
    // ── transport ────────────────────────────────────────────────────────
''')

# (b) a number two domains read lives in a module of its own
rep('''/** P17: px per full-deflection frame for the right-stick console scroll
 *  (mirrors the DOM engine's SCROLL_STEP_PX so the feel is identical). */
const CONSOLE_SCROLL_STEP_PX = 24;
''', '')
rep('''import {recordFieldHeartbeat} from '@/client/console/fieldRecorder';
''', '''import {recordFieldHeartbeat} from '@/client/console/fieldRecorder';
import {CONSOLE_SCROLL_STEP_PX} from '@/client/console/shell/shellMetrics';
''')

# (c) the viewer registers its own input gate (its controller's lifecycle — s2_post_viewer.py writes it there)
rep('''    // THE VIEWER'S FLIGHT IS A DELIBERATE SWALLOW — on the ledger, so a press it took is pressed again once it landed.
    this.zoomFlightAbsorbOff = registerInputAbsorber(ZOOM_FLIGHT_ABSORBER,
      () => this.consoleCardZoom.card !== undefined && (this.zoomClosing || this.zoomOpening), {scope: 'all'});
''', '')
rep('''    this.zoomFlightAbsorbOff?.();
''', '')
rep('''      zoomFlightAbsorbOff: undefined as (() => void) | undefined,
''', '')

# (d) the types a controller needs come from `.ts` modules (a `.ts` file cannot import a named export of a `.vue`;
#     vue_types_out.mjs moved them next to their SFCs)
import re
TYPES_HOME = {
    'ConsoleCommandBar': '@/client/console/consoleCommandModel',
}
def vue_named(m):
    default, names, path, comp = m.group(1), m.group(2), m.group(3), m.group(4)
    home = TYPES_HOME.get(comp, path.rsplit('/', 1)[0] + '/' + comp[0].lower() + comp[1:] + 'Types')
    return "import %s from '%s.vue';\nimport {%s} from '%s';" % (default, path, names, home)
s, n1 = re.subn(r"import (\w+), \{([^}]*)\} from '(@/client/components/console/(\w+))\.vue';", vue_named, s)
def vue_type_only(m):
    names, path, comp = m.group(1), m.group(2), m.group(3)
    return "import type {%s} from '%s';" % (names, path.rsplit('/', 1)[0] + '/' + comp[0].lower() + comp[1:] + 'Types')
s, n2 = re.subn(r"import type \{([^}]*)\} from '(@/client/components/console/(\w+))\.vue';", vue_type_only, s)
assert (n1, n2) == (7, 2), (n1, n2)

io.open(p, 'w', encoding='utf8', newline='').write(s.replace('\n', nl))
print('prep ok')

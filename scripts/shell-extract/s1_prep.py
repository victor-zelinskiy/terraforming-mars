# S1 — the hand edits ConsoleShell.vue needs BEFORE `apply supervisor.json`: the supervisor's start / stop become
# METHODS (so they move with it), and the control stand's defect window is declared through one.
import io, sys
p = sys.argv[1] if len(sys.argv) > 1 else 'src/client/components/console/ConsoleShell.vue'
s = io.open(p, encoding='utf8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
s = s.replace('\r\n', '\n')

def rep(old, new):
    global s
    assert s.count(old) == 1, (s.count(old), old[:90])
    s = s.replace(old, new, 1)

# the mounted rows → one call
rep('''    this.registerLivenessRungs();
    this.beatStallTimer = window.setInterval(() => this.checkLiveness(), 1000);
''', '''    this.startSupervisor();
''')
# the teardown rows → one call
rep('''    window.clearInterval(this.beatStallTimer); // …and so does the liveness arbiter
    for (const stop of this.livenessRungStops) {
      stop();
    }
    this.livenessRungStops = [];
    resetBeatStall();
    resetLiveness();
''', '''    this.stopSupervisor(); // …and so does the liveness arbiter
''')
# the control stand's seam
rep('''          screenControlDefectUntil = ms <= 0 ? 0 : Date.now() + Math.min(ms, SCREEN_CONTROL_DEFECT_MAX_MS);
''', '''          this.declareScreenControlDefect(ms);
''')
# the three verbs, beside the sampler they run
rep('''    checkLiveness(): void {
''', '''    /**
     * THE SUPERVISOR STARTS WITH THE SHELL'S MOUNT (called from `mounted`, in the row it always stood in): the rungs
     * and the wait graph's sources are registered, and the one 1 Hz sampler of the console begins.
     */
    startSupervisor(): void {
      this.registerLivenessRungs();
      this.beatStallTimer = window.setInterval(() => this.checkLiveness(), 1000);
    },
    /** …and ends with it: the sampler, every registration, the arbiter's and the beat guard's own state. */
    stopSupervisor(): void {
      window.clearInterval(this.beatStallTimer);
      for (const stop of this.livenessRungStops) {
        stop();
      }
      this.livenessRungStops = [];
      resetBeatStall();
      resetLiveness();
    },
    /** The control stand declares a defect it put in on purpose (`__conScreenControl.declareDefect`): named, bounded; `0` ends it. */
    declareScreenControlDefect(ms: number): void {
      screenControlDefectUntil = ms <= 0 ? 0 : Date.now() + Math.min(ms, SCREEN_CONTROL_DEFECT_MAX_MS);
    },
    checkLiveness(): void {
''')
# module state the supervisor shares with the conclusion / the entries → console/shell/shellFlowState.ts
import re
def cut_decl(pattern):
    global s
    m = re.search(pattern, s)
    assert m is not None, pattern[:60]
    assert len(re.findall(pattern, s)) == 1, pattern[:60]
    s = s[:m.start()] + s[m.end():]
cut_decl(r"\n/\*\*\n \* THE WORKSPACE-STALL FORCE GRACE\.[^\n]*(?:\n \*[^\n]*)*\n \*/\nconst OWED_CONCLUSION_FORCE_MS = 8000;")
cut_decl(r"\n/\*\*\n \* …AND THE GHOST VERDICT ITSELF MUST HOLD THIS LONG[^\n]*(?:\n \*[^\n]*)*\n \*/\nconst OWED_CONCLUSION_GHOST_CONFIRM_MS = 2500;")
cut_decl(r"\n/\*\*\n \* THE LAST REFUSED CONCLUSION —[^\n]*(?:\n \*[^\n]*)*\n \*/(?=\n)")
cut_decl(r"\nlet lastConclusionHold: \{kind: WorkspaceFrameKind, reason: string, at: number\} \| undefined;")
cut_decl(r"\n/\*\*\n \* Workspace entries deferred to the screen handoff[^\n]*(?:\n \*[^\n]*)*\n \*/\nconst handoffPendingEntries = reactive\(new Set<WorkspaceFrameKind>\(\)\);")
n_before = len(re.findall(r"\blastConclusionHold\b", s))
s = re.sub(r"\blastConclusionHold\b", "conclusionRefusal.last", s)
assert n_before == 9, n_before
rep('''import {StageHost, useWorkspaceBandGeometry} from '@/client/console/composables/useWorkspaceBandGeometry';
''', '''import {StageHost, useWorkspaceBandGeometry} from '@/client/console/composables/useWorkspaceBandGeometry';
import {conclusionRefusal, handoffPendingEntries, OWED_CONCLUSION_FORCE_MS, OWED_CONCLUSION_GHOST_CONFIRM_MS} from '@/client/console/shell/shellFlowState';
''')

# the session: one root for every flow, for the shell's life
rep('''    useConsoleNativeSurface();
''', '''    useConsoleNativeSurface();
    // THE SESSION — the one root of the console's flow tree (console/session/consoleSession.ts): it stands for this
    // shell's life and ends when the shell is unmounted, taking every flow opened inside it.
    useConsoleSession();
''')
rep('''import {StageHost, useWorkspaceBandGeometry} from '@/client/console/composables/useWorkspaceBandGeometry';
''', '''import {StageHost, useWorkspaceBandGeometry} from '@/client/console/composables/useWorkspaceBandGeometry';
import {useConsoleSession} from '@/client/console/session/consoleSession';
''')
io.open(p, 'w', encoding='utf8', newline='').write(s.replace('\n', nl))
print('s1 prep ok')

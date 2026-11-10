# S6 — the hand edits ConsoleShell.vue needs BEFORE the domain specs (the knots) are applied.
import io, sys
p = sys.argv[1] if len(sys.argv) > 1 else 'src/client/components/console/ConsoleShell.vue'
s = io.open(p, encoding='utf8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
s = s.replace('\r\n', '\n')

def rep(old, new):
    global s
    assert s.count(old) == 1, (s.count(old), old[:90])
    s = s.replace(old, new, 1)

# the series' input gate registers where it is noted (the pad router — s2_post_padRouter.py writes it there)
rep('''    // A SERIES' VISIT IS A DELIBERATE SWALLOW (PC04 · GS) — on the ledger, so a driver waits it out.
    this.seriesAbsorbOff = registerInputAbsorber(SERIES_VISIT_ABSORBER, () => this.seriesHeld !== undefined, {scope: 'all'});
''', '')
rep('''    this.seriesAbsorbOff?.();
''', '')
rep('''      seriesAbsorbOff: undefined as (() => void) | undefined,
''', '')

# what the hand section answers through a ref is NAMED (a `.ts` controller sees a `.vue` instance as `any` under plain
# tsc — the callbacks over its result would be implicit-any there)
n = s.count("const t = section?.transitionTargets() ?? {pairs: [], scrollTop: 0};")
assert n == 3, n
s = s.replace("const t = section?.transitionTargets() ?? {pairs: [], scrollTop: 0};",
              "const t: HandTransitionTargets = section?.transitionTargets() ?? {pairs: [], scrollTop: 0};")
rep("let t: ReturnType<InstanceType<typeof ConsoleHandSection>['transitionTargets']> =", "let t: HandTransitionTargets =")
rep("const before = section.transitionTargets();", "const before: HandTransitionTargets = section.transitionTargets();")
rep("return section.transitionTargets().pairs.map((p) =>", "return (section.transitionTargets() as HandTransitionTargets).pairs.map((p) =>")
rep("import {ConsoleHandEntry, ConsoleHandSelectMode} from '@/client/components/console/consoleHandSectionTypes';",
    "import {ConsoleHandEntry, ConsoleHandSelectMode, HandTransitionTargets} from '@/client/components/console/consoleHandSectionTypes';")

io.open(p, 'w', encoding='utf8', newline='').write(s.replace('\n', nl))
print('s6 prep ok')

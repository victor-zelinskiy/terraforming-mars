# After `apply padRouter.json`: the pad router registers the series' input gate it notes (a row of the shell's `mounted`
# before) — the gate's file both notes and registers it (tests/console/inputAbsorb.spec.ts).
import io, re
p = 'src/client/console/shell/padRouterController.ts'
s = io.open(p, encoding='utf8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
s = s.replace('\r\n', '\n')

c = "  return {\n"
i = s.rindex(c)
s = s[:i] + """  // ── lifecycle ────────────────────────────────────────────────────────────────────────────────────────────────────
  // A SERIES' VISIT IS A DELIBERATE SWALLOW (PC04 · GS) — on the ledger, so a driver waits it out. The router notes
  // the gate (`handleIntent`), so the router registers it, for the shell's mounted life.
  let seriesAbsorbOff: (() => void) | undefined;
  onMounted(() => {
    seriesAbsorbOff = registerInputAbsorber(SERIES_VISIT_ABSORBER, () => shell.seriesHeld !== undefined, {scope: 'all'});
  });
  onBeforeUnmount(() => {
    seriesAbsorbOff?.();
    seriesAbsorbOff = undefined;
  });

""" + s[i:]
m = re.search(r"import \{([^}]*)\} from '@/client/console/inputAbsorb';", s)
assert m is not None
names = [n.strip() for n in m.group(1).split(',')]
if 'registerInputAbsorber' not in names:
    names.append('registerInputAbsorber')
s = s.replace(m.group(0), "import {" + ', '.join(names) + "} from '@/client/console/inputAbsorb';", 1)
m = re.search(r"import \{([^}]*)\} from 'vue';", s)
names = [n.strip() for n in m.group(1).split(',')] if m else []
for n in ['onBeforeUnmount', 'onMounted']:
    if n not in names:
        names.append(n)
if m:
    s = s.replace(m.group(0), "import {" + ', '.join(names) + "} from 'vue';", 1)
else:
    j = s.index('\nimport ')
    s = s[:j] + "\nimport {" + ', '.join(names) + "} from 'vue';" + s[j:]
assert 'seriesHeld' in s
io.open(p, 'w', encoding='utf8', newline='').write(s.replace('\n', nl))
print('padRouter post ok')

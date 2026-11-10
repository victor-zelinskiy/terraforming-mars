# S2 — after `apply viewer.json`: the viewer controller owns its input gate (a row of the shell's `mounted` before).
import io, re
p = 'src/client/console/shell/viewerController.ts'
s = io.open(p, encoding='utf8', newline='').read()
nl = '\r\n' if '\r\n' in s else '\n'
s = s.replace('\r\n', '\n')

c = "  return {\n"
i = s.rindex(c)
s = s[:i] + """  // ── lifecycle ────────────────────────────────────────────────────────────────────────────────────────────────────
  // THE VIEWER'S FLIGHT IS A DELIBERATE SWALLOW — on the ledger, so a press it took is pressed again once it landed.
  // The controller registers its own gate for the shell's mounted life (it was a row of the shell's `mounted`).
  let zoomFlightAbsorbOff: (() => void) | undefined;
  onMounted(() => {
    zoomFlightAbsorbOff = registerInputAbsorber(ZOOM_FLIGHT_ABSORBER,
      () => consoleCardZoom.card !== undefined && (zoomClosing.value || zoomOpening.value), {scope: 'all'});
  });
  onBeforeUnmount(() => {
    zoomFlightAbsorbOff?.();
    zoomFlightAbsorbOff = undefined;
  });

""" + s[i:]
d = "import {noteInputAbsorbed} from '@/client/console/inputAbsorb';"
assert d in s
s = s.replace(d, "import {noteInputAbsorbed, registerInputAbsorber} from '@/client/console/inputAbsorb';", 1)
m = re.search(r"import \{([^}]*)\} from 'vue';", s)
names = [n.strip() for n in m.group(1).split(',')]
for n in ['onBeforeUnmount', 'onMounted']:
    if n not in names:
        names.append(n)
s = s.replace(m.group(0), "import {" + ', '.join(names) + "} from 'vue';", 1)
io.open(p, 'w', encoding='utf8', newline='').write(s.replace('\n', nl))
print('viewer post ok')

#!/usr/bin/env bash
#
# Terraforming Mars — Steam Deck one-shot installer.
#
# Run in DESKTOP MODE (Konsole):
#   curl -sSL https://raw.githubusercontent.com/victor-zelinskiy/terraforming-mars/main/scripts/steamdeck/install-steamdeck.sh | bash
#
# What it does (idempotent — safe to re-run):
#   1. downloads the latest AppImage from the fixed "latest" release URL,
#   2. writes the launcher wrapper (the --no-sandbox flags SteamOS/gamescope need),
#   3. downloads the Steam artwork (hero / header / portrait capsule),
#   4. adds a Non-Steam shortcut named "Terraforming Mars" with that artwork.
#
# The shortcut is written directly to Steam's shortcuts.vdf with a deterministic appid
# (the same crc32 scheme steam-rom-manager / Decky use), and the artwork is dropped into
# userdata/<id>/config/grid/ named by that appid — the only reliable way to attach custom
# art to a non-Steam game. (steamos-add-to-steam can register a shortcut but can't set the
# name or artwork, so we do it directly.) shortcuts.vdf is backed up before every write.
set -euo pipefail

REPO="victor-zelinskiy/terraforming-mars"
APP_NAME="Terraforming Mars"
APPS="$HOME/Applications"
APP="$APPS/TerraformingMars.AppImage"
WRAPPER="$APPS/run-terraforming-mars.sh"
ART="$APPS/terraforming-mars-art"
RAW="https://raw.githubusercontent.com/$REPO/main/assets/steamdeck"
LATEST="https://github.com/$REPO/releases/latest/download"

command -v curl   >/dev/null || { echo "!! curl not found"; exit 1; }
command -v python3 >/dev/null || { echo "!! python3 not found"; exit 1; }

mkdir -p "$APPS" "$ART"

echo "==> [1/4] Downloading the latest AppImage…"
curl -fL# -o "$APP" "$LATEST/TerraformingMars-x86_64.AppImage"
chmod +x "$APP"

echo "==> [2/4] Writing the launcher wrapper…"
cat > "$WRAPPER" <<'EOF'
#!/usr/bin/env bash
# Restart-loop launcher. This wrapper (NOT the AppImage) is the process Steam/gamescope
# tracks, so it stays in the session and can relaunch the updated AppImage IN-SESSION after
# an update — the app writes $TM_RESTART_MARKER and exits, and the loop below relaunches it.
# (A relaunch spawned by the app itself escapes the gamescope session → Steam would hang.)
APP="$HOME/Applications/TerraformingMars.AppImage"
LOG="$HOME/Applications/terraforming-mars-steam.log"
export TM_RESTART_SUPPORTED=1
export TM_RESTART_MARKER="$HOME/.cache/terraforming-mars-restart"
mkdir -p "$(dirname "$TM_RESTART_MARKER")"
cd "$HOME/Applications" || exit 1
echo "=== launch: $(date) ===" >> "$LOG"
while true; do
  rm -f "$TM_RESTART_MARKER"
  chmod +x "$APP" 2>/dev/null || true
  "$APP" --no-sandbox --disable-gpu-sandbox "$@" >> "$LOG" 2>&1
  if [ -f "$TM_RESTART_MARKER" ]; then
    echo "=== restart after update: $(date) ===" >> "$LOG"
    continue
  fi
  break
done
EOF
chmod +x "$WRAPPER"

echo "==> [3/4] Downloading Steam artwork…"
curl -fL# -o "$ART/hero.png"    "$RAW/steam-deck-hero-2172-724.png"
curl -fL# -o "$ART/header.jpg"  "$RAW/steam-deck-header-920-430.jpg"
curl -fL# -o "$ART/capsule.png" "$RAW/steam-deck-capsule-1024-1536.png"

echo "==> [4/4] Registering the Non-Steam shortcut + artwork…"
# Steam rewrites shortcuts.vdf on exit, so close it first for the edit to stick.
if pgrep -x steam >/dev/null 2>&1; then
  echo "    Steam is running — shutting it down so the shortcut is saved safely…"
  steam -shutdown >/dev/null 2>&1 || true
  for _ in $(seq 1 25); do pgrep -x steam >/dev/null 2>&1 || break; sleep 1; done
fi

python3 - "$WRAPPER" "$APP_NAME" "$APPS" "$ART" <<'PY'
import sys, os, zlib, shutil, time

wrapper, appname, startdir, art = sys.argv[1:5]
exe = '"%s"' % wrapper           # Steam stores Exe/StartDir quoted
startdir_q = '"%s"' % startdir

# --- deterministic shortcut appid (crc32 over Exe+AppName, high bit set) ---
def app_id_32(s):
    return (zlib.crc32(s.encode('utf-8')) | 0x80000000) & 0xffffffff

id32 = app_id_32(exe + appname)                 # what we store in the shortcut
art_ids = {id32, app_id_32(wrapper + appname)}  # also drop art for the unquoted variant

# --- minimal binary VDF (shortcuts.vdf) reader / writer ---
def read_map(b, i):
    m = {}
    while True:
        t = b[i]; i += 1
        if t == 0x08:
            return m, i
        j = b.index(0, i); key = b[i:j].decode('utf-8', 'replace'); i = j + 1
        if t == 0x00:
            v, i = read_map(b, i)
        elif t == 0x01:
            j = b.index(0, i); v = b[i:j].decode('utf-8', 'replace'); i = j + 1
        elif t == 0x02:
            v = int.from_bytes(b[i:i+4], 'little', signed=False); i += 4
        elif t == 0x07:
            v = int.from_bytes(b[i:i+8], 'little', signed=False); i += 8
        else:
            raise ValueError('unsupported vdf type 0x%02x' % t)
        m[key] = v

def write_map(m, out):
    for k, v in m.items():
        kb = k.encode('utf-8') + b'\x00'
        if isinstance(v, dict):
            out.append(0x00); out += kb; write_map(v, out)
        elif isinstance(v, bool):
            out.append(0x02); out += kb; out += int(v).to_bytes(4, 'little')
        elif isinstance(v, int):
            out.append(0x02); out += kb; out += (v & 0xffffffff).to_bytes(4, 'little')
        else:
            out.append(0x01); out += kb; out += str(v).encode('utf-8') + b'\x00'
    out.append(0x08)

def load(path):
    if os.path.exists(path) and os.path.getsize(path) > 0:
        with open(path, 'rb') as f:
            root, _ = read_map(f.read(), 0)
        if not isinstance(root.get('shortcuts'), dict):
            root['shortcuts'] = {}
        return root
    return {'shortcuts': {}}

def save(path, root):
    out = bytearray(); write_map(root, out)
    with open(path, 'wb') as f:
        f.write(bytes(out))

def new_entry():
    return {
        'appid': id32,
        'AppName': appname,
        'Exe': exe,
        'StartDir': startdir_q,
        'icon': os.path.join(art, 'header.jpg'),
        'ShortcutPath': '',
        'LaunchOptions': '',
        'IsHidden': 0,
        'AllowDesktopConfig': 1,
        'AllowOverlay': 1,
        'OpenVR': 0,
        'Devkit': 0,
        'DevkitGameID': '',
        'DevkitOverrideAppID': 0,
        'LastPlayTime': 0,
        'tags': {},
    }

home = os.path.expanduser('~')
bases = [os.path.join(home, '.steam/steam/userdata'),
         os.path.join(home, '.local/share/Steam/userdata'),
         os.path.join(home, '.steam/root/userdata')]
users = []
for base in bases:
    if os.path.isdir(base):
        for uid in os.listdir(base):
            if uid.isdigit() and uid != '0':
                users.append(os.path.realpath(os.path.join(base, uid)))
users = sorted(set(users))
if not users:
    sys.stderr.write('    !! no Steam user profile found — open Steam once, then re-run.\n')
    sys.exit(1)

for udir in users:
    cfg = os.path.join(udir, 'config'); os.makedirs(cfg, exist_ok=True)
    scpath = os.path.join(cfg, 'shortcuts.vdf')
    if os.path.exists(scpath):
        shutil.copy2(scpath, '%s.bak.%d' % (scpath, int(time.time())))
    root = load(scpath)
    sc = root['shortcuts']
    key = None
    for k, v in sc.items():
        if isinstance(v, dict):
            aid = v.get('appid')
            if v.get('Exe', '') == exe or (isinstance(aid, int) and (aid & 0xffffffff) == id32):
                key = k; break
    if key is None:
        idxs = [int(k) for k in sc.keys() if k.isdigit()]
        key = str(max(idxs) + 1 if idxs else 0)
    sc[key] = new_entry()
    save(scpath, root)

    grid = os.path.join(cfg, 'grid'); os.makedirs(grid, exist_ok=True)
    def put(src, *names):
        if os.path.exists(src):
            for n in names:
                shutil.copy2(src, os.path.join(grid, n))
    for aid in art_ids:
        aid64 = (aid << 32) | 0x02000000
        put(os.path.join(art, 'capsule.png'), '%dp.png' % aid, '%dp.png' % aid64)   # portrait/grid
        put(os.path.join(art, 'hero.png'),    '%d_hero.png' % aid, '%d_hero.png' % aid64)
        put(os.path.join(art, 'header.jpg'),  '%d.jpg' % aid, '%d.jpg' % aid64)      # header/capsule
    sys.stderr.write('    OK  %s  (appid=%d)\n' % (udir, id32))

sys.stderr.write('    Shortcut + artwork written for %d profile(s).\n' % len(users))
PY

echo
echo "Done. Open Steam again (or switch to Game Mode) — you'll see \"$APP_NAME\" with the artwork."
echo "It auto-updates through the in-app premium updater from now on."

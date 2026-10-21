# E2E on the Steam Machine — `npm run e2e:remote`

Status: **SHIPPED 2026-10-21** (the owner's decision: e2e runs ONLY on the Steam Machine; a laptop run is
never a verdict any more). Wrapper: `scripts/e2e-remote.mjs`. Policy for agents: `.claude/rules/tests.md`
§ «THE E2E RUNS ON THE STEAM MACHINE».

## 1. Why

The laptop carries several Claude sessions, builds, `webpack --watch`es and unit suites at once — it is
ALWAYS under load, and every 4K e2e timing taken there is a verdict about the load, not the product
(PL-149 was SwiftShader; «holds hitting their 8 s ceilings under two workers» was the box). The Steam
Machine (SteamOS, Valve «Fremont»: AMD 6c/12t, 15 GB, Radeon Navi 33, wired Ethernet, 1.8 TB free) is the
owner's PRODUCTION console on the same LAN, idle while nobody plays (load 0.03), and renders through the
AMD/RADV Vulkan stack the shipped SteamOS build runs on.

So the WHOLE run moves there — the Playwright runner, the per-worker game servers and the browsers all on
one host over its own loopback. The laptop only syncs a build in and pulls the results out; nothing of the
run crosses the network, so the network cannot slow it.

Measured on day one (same build, `--workers=1`, GPU on both): `aaa-driver-canary` 11.2 s on the Steam
Machine against ~19 s on the laptop; `console-classic-gmo-contract` (8 tests, fhd + tv4k, the transfer
witness) 8/8 in 2.2 min there (13–20 s per test, load 0.09) against 2.7 and 3.8 min on the laptop in
two runs (18–46 s per test) — the laptop's number moves with whatever else is running, which is the
whole point. End to end, from the command to the results on the laptop's disk: **144 s through the
wrapper** (≈12 s of it the wrapper's own — the ssh handshakes, a 0.4 s delta sync, the pull of twelve
4K frames) against **231 s** for the bare `npx playwright test` on the laptop.

## 2. Usage

```bash
npm run e2e:remote -- <task> tests/e2e/<spec>.spec.ts [playwright args…]
#   <task>  = your task's name (the same you gave `npm run e2e:snapshot`)
#   default --workers=2; a 4K timing / storyboard claim stays --workers=1
#   every TM_E2E_* env flag is forwarded (TM_E2E_GPU defaults to 1 — the point of the box)
```

What it does, in order:

1. **preflight** — the host answers over ssh; no `~/tm-e2e/DO_NOT_DISTURB`; the game is not running
   there; (another run in progress is only a notice — the lock below serializes).
2. **sync** — a MANIFEST diff (size + mtime, computed by `python3` on the host from the laptop's list;
   ~450 ms for 13 400 files), then a tar of only what changed, to TWO destinations: the shared mirror
   `~/tm-e2e/repo/` gets `src/` (the specs import from it, and the STALE check reads its mtimes),
   `tests/`, `assets/`, the package files and `playwright.config.ts` — one tree for every session of
   this clone; **the task's own `~/tm-e2e/builds/<task>/build/`** gets the BUILD — `.e2e-<task>/build`
   when that snapshot exists, else the shared `build/` — minus `build/tests` and the source maps
   (190 MB nobody opens in a run). Extraneous files under those roots are deleted. `node_modules` is
   never touched; it is re-installed inside the container only when `package-lock.json`'s hash changed.
3. **run** — in one of **K = 2 SLOTS** (`~/tm-e2e/slots/<i>`, one `flock` each; `TM_E2E_SLOTS`
   overrides): two sessions run SIDE BY SIDE, a third waits for a slot (up to 30 min, and says so).
   **`--exclusive`** takes ALL slots — for a timing / storyboard claim, whose numbers a neighbour's run
   would contaminate (the owner's call 2026-10-21: one run at a time was too strict for a dedicated box;
   one run at a time for a TIMING is the whole point of it). The run goes inside the `e2e` distrobox:
   `TM_E2E_GPU=1 TM_E2E_HOST=steam-machine TM_E2E_SLOT=<slot i/K | exclusive> TM_E2E_HEAD=<laptop HEAD>
   TM_E2E_ROOT=../builds/<task> npx playwright test <args>` with the task's own `test-results/` and
   `playwright-report/` (`TM_E2E_OUTPUT_DIR` / `TM_E2E_REPORT_DIR`, read by `playwright.config.ts`),
   output streamed to your terminal. The serve root `~/tm-e2e/builds/<task>/` carries `assets`, `tests`
   and `node_modules` as links to the mirror — the laptop's `e2e:snapshot` layout, mirrored. Before the
   slot is released the results are packed into `results.tar` there.
4. **results** — that archive into `.e2e-remote/<task>/` (`test-results/`, `playwright-report/`,
   `.last-exit`), the run's new `screenshots/**` files into the laptop's `screenshots/` (the same paths
   a local run writes). The `build` annotation of every test reads
   `build <sha> (<time>) from ../builds/<task> · HEAD <sha> · host steam-machine (slot 1/2 | exclusive)`
   — a timing read beside a neighbour's run says so.

**Exit codes.** 0 / 1 are Playwright's own. **2 / 3 / 4 mean the run did NOT happen**: 2 = the host is
unreachable, no mirror, no build, a sync failure, or Playwright never started; 3 = no slot (or, for
`--exclusive`, not the whole box) in 30 min; 4 = the game is running there or the owner set
`DO_NOT_DISTURB`. On any of them an agent STOPS and ASKS the owner — never a silent fallback to a laptop
run.

Product edits still need a fresh build (`npm run build` + `npm run e2e:snapshot <task>`) before the run:
the sync mirrors what is on disk. Spec edits sync by themselves (`tests/` is in the mirror).

**The laptop runs no Playwright browser — enforced in code.** `playwright.config.ts` throws outside CI
unless `TM_E2E_HOST` is set (the wrapper sets it on the Steam Machine) or the invocation is `--list`
(no browser). `TM_E2E_LAPTOP_OVERRIDE=1` is the owner's explicit, per-case permission (a display-bound
`--ui` / `--headed` debug session they asked for) — an agent never sets it on its own.

## 3. What stands on the Steam Machine (the one-time setup, 2026-10-21)

Everything lives in `deck`'s home — SteamOS's root is read-only and its packages are wiped by OS updates,
so nothing here needs `sudo` on the host and nothing is lost to an update:

| Piece | Where | Notes |
| --- | --- | --- |
| sshd | `systemctl enable --now sshd` (the owner, once) | key-only login for the laptop's `~/.ssh/id_ed25519_steammachine` (no passphrase — agents are non-interactive); alias `steam-machine` in the laptop's `~/.ssh/config` |
| Node 22.22.3 | `~/tm-e2e/node/` | the official linux-x64 tarball, same version as the laptop |
| Ubuntu 24.04 container | `distrobox create --name e2e --image docker.io/library/ubuntu:24.04` | the only place Playwright's Chromium has its libraries (`install-deps` is Debian-only); `/dev/dri` is mounted by distrobox, `mesa-vulkan-drivers` inside gives RADV; `build-essential python3` for native modules |
| the mirror | `~/tm-e2e/repo/` | `src tests assets package*.json tsconfig.json playwright.config.ts` + its own `node_modules` (`ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci`, stamped `node_modules/.tm-lock-sha`) — ONE tree for every session of this clone |
| the builds | `~/tm-e2e/builds/<task>/` | per task: `build/` (synced), `assets` + `tests` → links to the mirror, `test-results/`, `playwright-report/`, `.run-start`, `.last-exit`, `results.tar` (transient); a task idle for 14 days is pruned by the next run |
| browsers | `~/.cache/ms-playwright/` | `npx playwright install chromium --with-deps` inside the container |
| per-run files | `~/tm-e2e/slots/<i>` (the K slot locks), `~/tm-e2e/runs/<task>-<id>.{outer,inner}.sh` (removed on exit) | written by the wrapper |

Re-provisioning from scratch = the table top to bottom; the wrapper's `npm ci` branch rebuilds
`node_modules` + browsers by itself whenever the lock hash differs.

Owner-side: the Steam Machine's Gaming Mode **idle sleep must be «Never»** (Settings → Power — the
measured default was 1 h, `IdleSuspendACSeconds 3600`), because `systemd-inhibit` over ssh answers
«Interactive authentication required» (polkit) — the wrapper tries it and goes on without; and its IP
(`192.168.50.182`) is pinned in the router's DHCP manual assignment (done 2026-10-21).

## 4. The GPU road on Linux (`playwright.config.ts` `GPU_ARGS`)

Measured inside the container (`chrome://gpu` + a 300-layer rAF scene), 2026-10-21:

| flag set | GPU crashes | raster | compositing | WebGL |
| --- | --- | --- | --- | --- |
| none | 0 | software | software | SwiftShader |
| `--use-angle=vulkan --enable-features=DefaultANGLEVulkan` + raster flags | **0** | **hardware** | **hardware** | **ANGLE (AMD, Vulkan … RADV NAVI33)**, 61 fps |
| the product's full recipe (`Vulkan,DefaultANGLEVulkan,VulkanFromANGLE`) | 3 per launch | hardware | hardware | lost («no webgl») |
| the full recipe + `--disable-vulkan-surface` | 0 | hardware | software | hardware |

So the Linux branch is the SECOND row — ANGLE over Vulkan with GL compositing, not the Vulkan compositor
the shipped Electron uses: headless has no surface for it and the GPU process dies three times per launch.
`DefaultANGLEVulkan` is the load-bearing feature (without it ANGLE tries native EGL and falls back to
SwiftShader — `electron/perf.ts` says the same of the product). Only the `chromium` channel (the new
headless) can go through the GPU; the headless shell cannot open `chrome://gpu` at all.

## 5. Gotchas paid for on day one

- **Windows' built-in `ssh.exe` uploads a file-backed stdin at ~2 MB/s; Git's MSYS `ssh` at 42–64 MB/s**
  (40 MB: 18–22 s against 0.6–0.9 s). The wrapper prefers `C:\Program Files\Git\usr\bin\ssh.exe` (or the
  one beside `git --exec-path`) and falls back to the built-in. Both read the same `~/.ssh/config` and
  `known_hosts`.
- **A tar→ssh PIPE from Node died with `write EOF` mid-stream** (Win32-OpenSSH); a tar written to a temp
  file and handed to ssh as a FILE DESCRIPTOR delivers every byte. Two cwds (the repo, the build root) go
  into one archive with `tar -r`.
- **`pgrep -f <pattern>` matches the shell carrying the ssh command line itself** — the preflight's
  «is the game running» read true on an idle box. Use `'[T]erraformingMars.AppImage'`.
- **`systemd-inhibit` over ssh is refused by polkit** (no seat session) — best-effort only; the owner's
  «Never» is the real guarantee.
- **The remote mirror is not a git checkout** — `consoleTest.ts` takes `TM_E2E_HEAD` from the env for the
  annotation and names the host from `TM_E2E_HOST`.
- Each ssh round trip costs ~0.5–0.9 s on this LAN (key exchange); the wrapper spends five per run
  (preflight · manifest · sync · run · results). Never add a per-file round trip.
- **The run scripts are written BEFORE the lock is taken, so they are per-run files** (`~/tm-e2e/runs/`):
  with one fixed `inner.sh` a queued second session overwrote the running first session's script
  (bash reads a script while executing it) — seen on day one, the hour two sessions first met there.
- **The BUILD is per task, and the results are packed UNDER the lock** — the same hour: with one shared
  `~/tm-e2e/repo/build` the mirror held whichever build synced last, and a GMO run served a neighbour's
  STALE `t04` snapshot (four tv4k reds that were not the product's); and the neighbour's next run, taking
  the lock the moment it was released, wiped `test-results/` before its owner pulled it. The sync is
  therefore outside the lock by design (fast, per task, never touching another task's build), the run
  and the packing of `results.tar` inside it.
- **The box SLEEPS after 1 h idle until the owner sets «Never»**, and its NIC has Wake-on-LAN disabled
  (`/sys/class/net/enp5s0/device/power/wakeup` = `disabled`), so a magic packet cannot wake it: an
  `ssh: connect … timed out` in the preflight is «ask the owner», not something the wrapper can fix.
- **`package.json` / `package-lock.json` are re-sent on every run and the lock's hash ignores the root
  `version`**: the pre-commit `bump-version` hook rewrites the version on every commit of every session,
  so hashed raw the lock «changed» several times an hour — and each change would have been a 2-minute
  `npm ci` for nothing. The hash is over the lock with the root `version` (top level and `packages[""]`)
  dropped; the 0.4 MB re-send is noise.
- Two sessions run side by side in the two slots; a timing / storyboard claim is `--exclusive` and
  waits for the box to empty — its annotation then reads `exclusive`, a shared run's `slot i/2`. Raise
  `TM_E2E_SLOTS` only on measurement (the speed-up plan's phase 0: the worker-scaling curve).

# The road to `createVaporApp(App)` — the program

**The north star of the project (the owner / the architect, 2026-11-12): the client is ONE Vapor application —
`createVaporApp(App).mount('#app')` on Vue 3.6. No virtual-DOM runtime; every component a Vapor component. Rewriting
the EXISTING components is in scope; the Options API is being left behind.**

This file is the program: the stages and what «done» means for each, what the codebase looks like against the target
today (counted), the rules that are in force NOW, and how the pilot and the component rework are run. It is updated by
every stage. `CLAUDE.md` § North star is the short form; `.claude/rules/client-ui.md` § NORTH STAR is what loads when
you touch client code.

---

## 0. The stages — a stage does not start before the one before it is green on the full CI e2e

| Stage | What | «Done» means | State |
| --- | --- | --- | --- |
| **V0** | the docs: the north star in `CLAUDE.md`, this program, the rules, the architecture plan pointing at it | a new session reads the destination and the rules of the road before it writes a line | **done 2026-11-12** |
| **V1** | THE PILOT — `vue@3.6.0-rc.15` becomes the project's version (still a `createApp` app, still the virtual DOM) | §3: every check green on the pinned version, the differences found are written here, the bump is ONE commit; then 2 – 3 leaf components run as Vapor inside the vdom app and what Vapor cannot do for us yet is LISTED (§3.3) | next |
| **V2** | architecture v2 to the end — 100 % of the console UI on the flow kernel | `docs/claude/console/architecture-v2/PLAN.md` §11: the debt ledger is EMPTY (the surface registry, the prompt router, the domains' reactions as machines / runs, the session owning the tick — S-last: «the shell is layout») | after V1 |
| **V3** | THE REWORK — every component is `<script setup>` and compiles as Vapor, wave by wave | §4: the readiness ledger (§5) is at zero Options-API components; every wave passed the full e2e on CI before the next began | after V2 |
| **V4** | THE SWITCH — `createVaporApp(App).mount('#app')` | `main.ts` creates a Vapor app; the vdom runtime is not in the bundle; the full e2e and the timing class are green; the field build ships | after V3 |

**Why this order.** V1 first because everything after it should be written and measured on the runtime we are going
to: the reactivity core is new in 3.6 (alien-signals), and the architecture's sharpest edges are reactive ones (the
order of the shell's reactions in a tick, the sync watchers, `scopedState`'s `customRef`). V2 before V3 because the
architecture work REMOVES from the components exactly what makes them expensive to convert — logic in `methods`,
lifetimes in hooks, `this.$refs` between surfaces, the shell's `watch` table: after V2 a component is a template and
its wiring, and its conversion is mechanical. Converting 471 components first and re-architecting them after would be
doing the dangerous half twice.

---

## 1. Where the code stands against the target (counted 2026-11-12, `src/client`)

| | Count | What it becomes |
| --- | --- | --- |
| `.vue` components | **472** (271 under `components/console/`) | — |
| …written with the Options API (`defineComponent({…})`) | **471** | `<script setup lang="ts">` |
| …written with `<script setup>` | **1** | (the form of every new component) |
| …that already have a `setup()` beside their options | 94 | their `setup()` body is the seed of the script-setup block |
| `data()` blocks · `computed:` blocks · `watch:` blocks | 223 · 388 · 122 | `ref` / `reactive` · `computed()` · `watch()` — **in the same order** (creation order of watchers is load-bearing in the shell) |
| `this.$emit(` | 377 in 97 files | `defineEmits` |
| `this.$nextTick(` | 342 | `nextTick()` (or a kernel wait where it is used AS a wait) |
| `$refs` | 775 | a template ref (`useTemplateRef`) inside a component; **between** surfaces — the surface registry (architecture S3; 117 of them are in the shell's controllers and are already frozen by the debt ledger) |
| `this.$el` | 176 | a template ref on the root |
| `this.$watch(` | 7 | `watch()` |
| `<Transition>` / `<TransitionGroup>` | 187 | to verify in the pilot |
| `<Teleport>` | 34 | to verify in the pilot (the embedded-step architecture stands on it) |
| `defineAsyncComponent` | 32 | to verify in the pilot |
| `<component :is>` · `v-html` | 4 · 9 | to verify in the pilot |
| the `v-i18n` directive (a GLOBAL custom directive from `plugins/i18n.plugin.ts`) | **902** sites | **the largest single item** — Vapor's custom directives have a different interface (§1.1): port the directive once; the pilot says whether the 902 call sites stay as they are |
| `app.config.globalProperties.$t` | the i18n plugin | an import (`$t` from `directives/i18n`) |
| global registrations in `main.ts` | 3 components (`action-target-card`, `premium-card-face`, `console-source-dock`) · 1 directive (`trim-whitespace`) | explicit imports |
| `mixins:` · `$parent` / `$root` · render `h(` · `getCurrentInstance` | 1 · 2 · 4 · 3 call sites | composables / props / templates; `getCurrentInstance` — `null` in Vapor (§1.1): `provide` / `inject` and explicit ports |
| sync watchers (`flush: 'sync'`) · `customRef` · `effectScope` | 11 · 2 · 4 | unchanged API — their BEHAVIOUR on the new reactivity core is the pilot's first check |
| unit specs that mount components (`@vue/test-utils`) | 208 files | the test utils' support for Vapor components: to verify in the pilot |
| `ConsoleShell.vue` | 3.6k lines + 34 controllers built in its `setup()` | converted LAST (V3's final wave) — after V2 it is layout |
| components marked `@deprecated Desktop-only` | 5 | DELETED by the desktop deletion waves, never converted (`docs/DESKTOP_DEPRECATION_AUDIT.md`) |

### 1.1 What Vapor does NOT take — the upstream list, counted against our code

From the 3.6.0-rc.1 release notes, as cited in this repo's own research
(`docs/research/research_notes/Аудит современного стека Electron 45/libraries_visual_integration.md` §4, 2026-10-22 —
that report's verdict «Vapor: skip» is SUPERSEDED by the north star; its facts stand until the pilot re-reads them on
rc.15). Vapor takes template-only SFCs and `<script setup>`; a `createApp` application mixes Vapor and vdom components
through `vaporInteropPlugin`; a pure Vapor application is `createVaporApp()`.

| Not supported in a Vapor component | In our client | The way out |
| --- | --- | --- |
| the Options API | 471 components | `<script setup>` — V3 |
| `app.config.globalProperties` | `$t` (the i18n plugin) | import `$t` |
| `getCurrentInstance()` — returns `null` | 3 call sites: `session/consoleSession.ts` ×2 (`useConsoleSession` · `componentSessionScope`) and `shell/shellPort.ts` — **how every controller reaches the shell instance** | `provide` / `inject` only for the session; the port becomes explicit wiring (architecture S-last: «the session wires the controllers' ports directly, no instance in between») |
| template refs that expose `$el` / `$props` / `$attrs` / `$slots` / `$refs` of a child | 21 reads of a child's `$el` / `$props` through a ref (+ 176 `this.$el` of one's own root) | the child exposes what is needed (`defineExpose`) / registers it (the surface registry); one's own root is a template ref |
| `v-memo` | 12 | drop it (Vapor updates are already fine-grained) — verify there is no visible cost while still on vdom |
| `@vue:xxx` per-element lifecycle events | 0 | — |
| render functions / JSX (they stay vdom) | 4 `h(` · no JSX | templates |
| **custom directives — a different interface** | 16 definitions; **`v-i18n` at 902 sites**, `trim-whitespace` | port the two global directives to the Vapor directive interface ONCE (the call sites keep their syntax if the pilot confirms it) — else a composable / compile-time form |
| **event delegation at the document level — `stopPropagation()` blocks delegated handlers** | 92 `stopPropagation` / `.stop` (36 template modifiers) — and the console's own key / pad routing listens at the window (`consoleKeyBridge`, the input-absorb ledger) | audit each in its wave: a `.stop` that used to shield a parent's handler now also shields every delegated one above it. The pilot's Vapor probe must include a component with a `.stop` under the pad router |

The toolchain today: `vue` ^3.5 (3.5.42 installed) · `vue-loader` ^17 · `@vue/test-utils` ^2.4 · `vue-tsc` ^3.3 ·
`webpack` 5 · `typescript` 6 · `@vueuse/core` 14.

---

## 2. The rules in force NOW (every stage inherits them)

1. **A NEW component is `<script setup lang="ts">`** (Composition API). Never a new `defineComponent({data, computed,
   methods, watch})`. This is the one exception to «follow the style of the file around you».
2. **An EXISTING component is converted in its V3 wave, as a commit of its own** — never in passing inside an
   unrelated change. A conversion is verified by the e2e specs of its surface; a conversion hidden in a feature diff
   is a regression nobody can attribute. (Exception: V1's 2 – 3 pilot leaves.)
3. **Do not add what the target has no place for**: a mixin, `$parent` / `$root`, a new `app.config.globalProperties`
   member, a new global `app.component` / `app.directive` registration, a render function (`h(…)`) where a template
   will do, a new `this.$refs` reach from one surface into another (the debt ledger already fails on it in the
   controllers), a new `getCurrentInstance()`.
4. **Logic lives OUTSIDE the component** — state and flows in modules, controllers and composables on the flow kernel
   (architecture v2: `createFlowRun` / `deriveFlowRun`, `scopedState`, `sessionState`, `useFlowScope`). A component is
   a template and its wiring. Every method moved out today is a line that does not have to be converted tomorrow.
5. **The e2e hooks are the conversion's contract** (`CLAUDE.md` invariant 14): a `data-*` attribute, a class or a line
   of RU copy a spec waits for survives a conversion unchanged — or the spec moves in the same diff.
6. **The version is pinned EXACTLY** while it is a release candidate (`"vue": "3.6.0-rc.15"`, no caret): a new RC is
   a decision with its own run of §3, never an install-time surprise.
7. **Nothing here outranks the product** — console native is still what ships (`CLAUDE.md` § The product), the
   invariants still hold, and a stage that cannot be made green waits; it is not forced.

---

## 3. V1 — the pilot (the protocol)

Done in a worktree of its own; nothing is pushed until §3.2 is green.

### 3.1 The bump
`vue` → `3.6.0-rc.15` (exact), and whatever of the toolchain must move with it (`vue-loader`, `@vue/compiler-sfc` if
it is pinned apart, `@vue/test-utils`, `vue-tsc`) — each change written down here with the reason. The app is still
`createApp(App)`; no component changes in this step.

### 3.2 The checks — all of them, before/after where it is a number
- `npm run lint` (eslint · i18n audit · **vue-tsc**) and plain `tsc`; `npm run build:test`;
- `npm run test:client` and `npm run test:server` at their floors — every red read as «the new reactivity core or
  the spec?», and written down;
- the two ledgers and the kernel's law (`kernelCoverage` · `architectureDebt` · `tests/console/kernel/**`) — the
  flow kernel rides Vue's reactivity (`isLive()`, `until`, `deriveFlowRun`'s sync watcher, `scopedState`);
- `npm run build` — the client bundle's size before / after;
- **the full e2e on CI** and the timing class on the Steam Machine — the verdict;
- the perf probes before / after on the box (`console-longgame-perf-probe`, `console-played-perf-probe`,
  `console-recv-perf-probe`) and the long-frame split from a field session (`[long-frame]` — script vs
  style / layout / paint): what the new core actually buys on a 4K frame is a NUMBER in this file, not a hope.

What to look at first, because it is where a new reactivity core can change behaviour without changing an API:
the ORDER of the shell's 145 reactions inside a tick (the watch table — PLAN §5 · S5's lesson), the 11 sync
watchers, `scopedState` (`customRef` + `reactive`), the reactivity witness (`presentation/reactivityWitness.ts`),
`proxyRefs` over the controllers' refs, the lazy scope `Proxy` of `useFlowScope` under `markRaw`.

### 3.3 The Vapor probe (inside the vdom app, through the interop)
Two or three LEAF components — chosen to cover one each of: a `<Transition>`, the `v-i18n` directive, a `<Teleport>`
or a slot, an `$emit` a parent listens to, a unit spec that mounts it — are rewritten as `<script setup vapor>` and
run in the ordinary app. The output of the probe is a TABLE in this file: for every row of §1 marked «to verify» —
works · works with a change (which) · not yet (the fallback, and whether it blocks V3 or only V4).

### 3.4 «Done»
Everything in §3.2 green; §3.3's table written; the bump lands as ONE commit; this file's §0 says «V1 — done» with
the commit. Rollback is reverting that commit.

---

## 4. V3 — the rework (how it will be run)

- **Deletion first.** What the desktop deletion waves remove is never converted.
- **Waves, from the leaves to the shell**: ① leaf presentational components (badges, chips, glyphs, the premium card's
  parts) → ② the foundation components (`components/console/foundation/**`) → ③ the domain surfaces, domain by domain
  (each with its controller already holding its logic) → ④ the hosts and the workspaces → ⑤ `ConsoleShell.vue` and
  `App.vue`, last.
- **One recipe per construct** (the table of §1), applied the same way everywhere; a watcher keeps its place among
  its siblings; a component's public surface (props, emits, what it exposes, its e2e hooks) does not change in a
  conversion.
- **Every wave is its own series of commits and its own full e2e run on CI** — «все кейсы тестируем через e2e на CI»;
  the next wave does not start on a red one. Unit specs of a converted component move in the same commit.
- **The count is a ledger** (§5), so «how far» is a number and a converted component cannot drift back.

## 5. The readiness ledger (added with V1)

`tests/console/vaporReadiness.spec.ts` over a baseline, in the form of the two architecture ledgers: per file, the
Options-API component itself and the constructs of §1 with no place in the target; a file may not grow, **a new
`.vue` starts at zero** (so rule 1 of §2 is a failing test, not a convention), `npm run ready:vapor` lowers the
baseline and prints the line. V3 is done when it is empty; V4 is one line in `main.ts` after that.

## 6. How it meets architecture v2

The two programs are one road. Architecture v2 (PLAN §11) retires `surface-by-ref` (S3 — the surface registry: no
`$refs` between surfaces), the view-apply's writes and the set-aside flag (S4), the domains' reactions and resolver
mailboxes (S6) and finally the shell's own `watch` table and hooks (S-last: «the shell is layout»). Each of those is
also a row of §1 above. So V2 is not a detour before the rework — it is the half of the rework that changes
behaviour, done under the guards built for it; V3 is the half that only changes form.

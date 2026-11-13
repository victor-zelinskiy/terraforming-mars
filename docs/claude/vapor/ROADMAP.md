# The road to `createVaporApp(App)` — the program

**The north star of the project (the owner / the architect, 2026-11-12): the client is ONE Vapor application —
`createVaporApp(App).mount('#app')` on Vue 3.6. No virtual-DOM runtime; every component a Vapor component. Rewriting
the EXISTING components is in scope; the Options API is being left behind.**

This file is the program: the stages and what «done» means for each, what the codebase looks like against the target
today (counted), the rules that are in force NOW, what the pilot found, and how the component rework is run. It is
updated by every stage. `CLAUDE.md` § North star is the short form; `.claude/rules/client-ui.md` § NORTH STAR is what
loads when you touch client code.

---

## 0. The stages — a stage does not start before the one before it is green on the full CI e2e

| Stage | What | «Done» means | State |
| --- | --- | --- | --- |
| **V0** | the docs: the north star in `CLAUDE.md`, this program, the rules, the architecture plan pointing at it | a new session reads the destination and the rules of the road before it writes a line | **done 2026-11-12** (`da57cf6027`) |
| **V1** | THE PILOT — `vue@3.6.0-rc.15` is the project's version (still a `createApp` app); the toolchain compiles and tests Vapor; three leaves run as Vapor in the product | §3: every check green on the pinned version, the differences found are written here; the capability table of §3.6 is an executable suite | **done 2026-11-12** — §3 is the record |
| **V2** | architecture v2 to the end — 100 % of the console UI on the flow kernel | `docs/claude/console/architecture-v2/PLAN.md` §11: the debt ledger's DECISION rows are at ZERO and guarded there (2026-11-12 — the surface registry, the question's scope and «set aside» as its record, the owned answers, the last latch), and **S-last is done: the shell is layout** — `ConsoleShell.vue` has no `data` / `computed` / `methods` / `watch` / hooks, its port is no component instance. What the ledger still freezes is the supervisory layer (the nets), which retires on field evidence and blocks nothing of V3 | **the base for V3 stands (2026-11-12)**; open in V2: the two one-table redesigns, the domains' reactions as machines (PLAN §0) |
| **V3** | THE REWORK — every component is `<script setup>` and compiles as Vapor, wave by wave | §4: the readiness ledger (§5) is at zero Options-API components; every wave passed the full e2e on CI before the next began | after V2 |
| **V4** | THE SWITCH — `createVaporApp(App).mount('#app')` | `main.ts` creates a Vapor app; the vdom runtime and the interop plugin are not in the bundle; the full e2e and the timing class are green; the field build ships | after V3 |

**Why this order.** V1 first because everything after it should be written and measured on the runtime we are going
to: the reactivity core is new in 3.6 (alien-signals), and the architecture's sharpest edges are reactive ones (the
order of the shell's reactions in a tick, the sync watchers, `scopedState`'s `customRef`). V2 before V3 because the
architecture work REMOVES from the components exactly what makes them expensive to convert — logic in `methods`,
lifetimes in hooks, `this.$refs` between surfaces, the shell's `watch` table: after V2 a component is a template and
its wiring, and its conversion is mechanical. Converting 468 components first and re-architecting them after would be
doing the dangerous half twice.

---

## 1. Where the code stands against the target (`src/client`; the live numbers are the ledger's — §5)

| | Count (2026-11-12, after V1) | What it becomes |
| --- | --- | --- |
| `.vue` components | **455** (472 before V3 wave 4 — the 17 reachable from no entry are deleted, `docs/DESKTOP_REMOVAL_WAVE_5.md`) | — |
| …that are VAPOR (`<script setup vapor>`) | **3** — the pilot's leaves (§3.6) | all of them |
| …written with `<script setup>` (virtual DOM) | **452** — one older component, the six worked examples of step A, and **WAVES 1–4** (2026-11-13 — §4): three times 118, then the tail of 91 | gain `vapor` in their wave (step B) |
| …written with the Options API (`defineComponent({…})`) | **0** (462 before wave 1, 344 before wave 2, 226 before wave 3, 108 before wave 4) — **STEP A IS COMPLETE**: no component of the client is an Options-API component | — (the form is closed: the readiness ledger fails a new one) |
| …that already have a `setup()` beside their options | 94 | their `setup()` body is the seed of the script-setup block |
| `data()` blocks · `computed:` blocks · `watch:` blocks | 223 · 388 · 122 | `ref` / `reactive` · `computed()` · `watch()` — **in the same order** (see §3.5: order between watchers of DIFFERENT sources was never creation order) |
| `this.$emit(` | 377 in 97 files | `defineEmits` |
| `this.$nextTick(` | 342 | `nextTick()` (or a kernel wait where it is used AS a wait) |
| `$refs` | 785 | a template ref (`useTemplateRef`) inside a component; **between** surfaces — the surface registry (architecture S3 — **done 2026-11-12**: the shell's controllers hold none, guarded at zero; the template stands a surface with a FUNCTION ref, `:ref="surfaces.bind.<name>"`, which Vue 3.6 calls during the patch) |
| `this.$el` | 176 | a template ref on the root |
| `<Transition>` / `<TransitionGroup>` | 187 | works as it is (§3.6) |
| `<Teleport>` | 34 | works as it is (§3.6) |
| `defineAsyncComponent` | 32 | works as it is — a vdom async wrapper loads a Vapor component (§3.6) |
| `<component :is>` · `v-html` | 4 · 9 | work as they are (§3.6) |
| the `v-i18n` directive | **913** sites in 120 files (285 with dynamic content inside, 6 with params) | **ONE import line per component** — `import {vI18n} from '@/client/directives/vDirectives'`; the 913 call sites keep their syntax (§3.6) |
| `$t(` in templates (`app.config.globalProperties.$t`) | 2206 | **ONE import line per component** — `import {$t} from '@/client/directives/i18n'`; the call sites keep their syntax |
| global registrations | 6: `main.ts` 3 components (`action-target-card`, `premium-card-face`, `console-source-dock`) + `trim-whitespace`; the i18n plugin's `$t` + `i18n` | explicit imports; the registrations leave with the last Options-API component |
| `mixins:` · `$parent` / `$root` · render `h(` · `getCurrentInstance` | 1 · 1 · 4 · **0** | composables / props / templates; `getCurrentInstance` is GONE from the client (architecture S-last, 2026-11-12 — the shell's port is a late-bound object, `shell/shellPort.ts`) |
| `v-memo` | 11 | dropped at conversion (the Vapor compiler ignores it, with a warning) |
| sync watchers (`flush: 'sync'`) · `customRef` · `effectScope` | 11 · 2 · 4 | unchanged API **and unchanged behaviour** — pinned by `vueReactivityContract.spec` (§3.5) |
| unit specs that mount components (`@vue/test-utils`) | 208 files | a Vapor component is mounted under a virtual-DOM host (§3.6 · test-utils) |
| `ConsoleShell.vue` | 3.6k lines + 34 controllers built in its `setup()` | converted LAST (V3's final wave) — after V2 it is layout |
| components marked `@deprecated Desktop-only` | 5 | DELETED by the desktop deletion waves, never converted (`docs/DESKTOP_DEPRECATION_AUDIT.md`) |

### 1.1 What Vapor does NOT take — the upstream list, read against rc.15 by the pilot

| Not supported in a Vapor component | In our client | The way out |
| --- | --- | --- |
| the Options API | 468 components | `<script setup>` — V3 |
| `app.config.globalProperties` | `$t` (the i18n plugin) | `import {$t} from '@/client/directives/i18n'` — verified (§3.6) |
| `getCurrentInstance()` — returns `null` (verified) | was 3 call sites; **the flow kernel's two are gone** (`useConsoleSession` · `componentSessionScope` bind to the effect scope and `inject` — §3.4); the last one, `shell/shellPort.ts`, **went with S-last (2026-11-12)** | — (nothing in `src/client` asks for a component instance; the readiness ledger's `instance-access` row is empty and a new file starts at zero) |
| template refs that expose `$el` / `$props` / `$attrs` / `$slots` / `$refs` of a child | 21 reads of a child's `$el` / `$props` through a ref (+ 176 `this.$el` of one's own root) | the child exposes what is needed (`defineExpose` — verified: a parent's ref of a Vapor child IS its exposed object) / registers it (the surface registry); one's own root is `useTemplateRef` (verified) |
| `v-memo` | 11 | drop it — the Vapor compiler ignores it and says so |
| `@vue:xxx` per-element lifecycle events | 0 | — |
| render functions / JSX (they stay vdom) | 4 `h(` · no JSX | templates |
| **custom directives — a different interface** (one function, called once, `value` a getter, no `updated`; an OBJECT of hooks is refused with a warning) | five directives: **`v-i18n` at 907 sites**, `trim-whitespace`, and three local ones — `embed-zone` (8 components), `strip-action-prefix`, `strip-effect-prefix` | **DONE for all five (2026-11-12)**: `directives/vDirectives.ts` exports ONE binding per directive that both runtimes call (§3.6); a directive WITH A LIFETIME (`embed-zone` must unregister) is written with `dualDirective({mounted, updated?, unmounted?})` (`directives/dualDirective.ts`) — the form of every future directive. A global directive resolved by NAME inside a Vapor component is the vdom object — not callable: a `<script setup>` component imports |
| ~~event delegation at the document level~~ | — | **NOT the case on rc.15**: delegation became OPT-IN in rc.2 (`@click.delegate`). A plain `@click` in a Vapor component is a listener on the element; `.stop` shields exactly what it did; the console's window-level key bridge is not bypassed (verified — §3.6). Nothing to audit |

The toolchain after V1: `vue` **3.6.0-rc.15** (exact, with `overrides` — §3.7) · `vue-loader` 17.4.2 + `scripts/vapor/sfcTemplateCompiler.cjs` ·
`@vue/test-utils` 2.5.1 · `vue-tsc` 3.3.14 · `webpack` **5.112.2** · `mocha` **12** · `typescript` 6 · `@vueuse/core` **15** · `electron` **45.3.1**.

---

## 2. The rules in force NOW (every stage inherits them)

1. **A NEW component is `<script setup lang="ts">`** (Composition API). Never a new `defineComponent({data, computed,
   methods, watch})`. This is the one exception to «follow the style of the file around you». It may be
   `<script setup vapor lang="ts">` when everything it uses is a green row of the capability suite (§3.6) — a leaf with
   props, events, slots, a `<Transition>` / `<Teleport>`, `v-i18n` qualifies.
2. **It IMPORTS what the Options API got from the app**: `$t` (`@/client/directives/i18n`), `vI18n` / `vTrimWhitespace`
   (`@/client/directives/vDirectives` — one binding per directive, good in both runtimes, so the line does not change
   when the component gains `vapor`), every component it renders. The readiness ledger's `global-in-setup` row fails a
   `<script setup>` component that leans on a global.
3. **An EXISTING component is converted in its V3 wave, as a commit of its own** — never in passing inside an
   unrelated change. A conversion is verified by the e2e specs of its surface; a conversion hidden in a feature diff
   is a regression nobody can attribute.
4. **Do not add what the target has no place for**: a mixin, `$parent` / `$root`, a new `app.config.globalProperties`
   member, a new global `app.component` / `app.directive` registration, a render function (`h(…)`) where a template
   will do, a new `this.$refs` reach from one surface into another (the debt ledger already fails on it in the
   controllers), a new `getCurrentInstance()`. Each of these is a row of the readiness ledger (§5): a file may not
   gain one, a new file starts at zero.
5. **Logic lives OUTSIDE the component** — state and flows in modules, controllers and composables on the flow kernel
   (architecture v2: `createFlowRun` / `deriveFlowRun`, `scopedState`, `sessionState`, `useFlowScope`). A component is
   a template and its wiring. Every method moved out today is a line that does not have to be converted tomorrow.
6. **ONE MUTATION — ONE REACTION** (§3.5). Two reactions that read ONE collection and whose order matters are ONE
   `watch` with the order written in its body — which of them a single mutation wakes first is not a contract of the
   reactivity core (it flipped between 3.5 and 3.6). Guard: `tests/console/vueReactivityContract.spec.ts`.
7. **The e2e hooks are the conversion's contract** (`CLAUDE.md` invariant 14): a `data-*` attribute, a class or a line
   of RU copy a spec waits for survives a conversion unchanged — or the spec moves in the same diff.
8. **The version is pinned EXACTLY** while it is a release candidate (`"vue": "3.6.0-rc.15"`, no caret, and the same
   version in every row of `overrides`): a new RC is a decision with its own run of §3.8, never an install-time
   surprise.
9. **Nothing here outranks the product** — console native is still what ships (`CLAUDE.md` § The product), the
   invariants still hold, and a stage that cannot be made green waits; it is not forced.

---

## 3. V1 — the pilot: what was done and what it found (2026-11-12)

### 3.1 The bump
`vue` `^3.5.40` → **`3.6.0-rc.15`** (exact). With it: `vue-tsc` 3.3.14, `@vue/test-utils` 2.5.1, and an `overrides`
block (§3.7). The app is still `createApp(App)`. Two source changes were needed for green:

| File | Why |
| --- | --- |
| `console/vueErrorReport.ts` | TYPES: an instance's `parent` is a `GenericComponentInstance` in 3.6 (a vdom or a Vapor one) — the component chain is read through the two fields both kinds share |
| `components/marsbot/marsBotPresentation.ts` | BEHAVIOUR: the one flow that depended on which watcher a single `push` wakes first (§3.5) — two watchers became one reaction |

### 3.2 The checks

| Check | Before (3.5.42) | After (3.6.0-rc.15) |
| --- | --- | --- |
| `vue-tsc` · plain `tsc` · `build:test` · eslint | green | green (one type fix, above) |
| client unit suite | 8400 passing | 8399 passing + **1 red** → fixed (§3.5); now **8425** with the suites this stage added |
| server unit suite (incl. the kernel's law, both ledgers) | 22741 passing | 22741 passing (with the specs this stage added: **22771**) |
| client bundle — the bump alone | `vendors.js` 425.0 KB · gz 147.9 · br 130.2 | 455.8 KB · gz 159.7 · br 140.2 (**+11.8 KB gz**: the 3.6 core; `runtime-vapor` is tree-shaken out while no component is Vapor) |
| client bundle — the final state (the interop plugin + three Vapor leaves + the updated dependencies) | — | `vendors.js` 554.6 KB · gz 194.3 · br 169.2 (**+34.6 KB gz** over the bump alone — BOTH runtimes are in the bundle until V4 takes the virtual-DOM one out; `main.js` and the console chunk moved by < 0.2 %) |
| box e2e, the pointwise list (301 functional + 104 timing) | 301 / 301 · 104 / 104 | **301 / 301 · 104 / 104** (the whole final stack: Vue 3.6, the Vapor leaves, webpack 5.112, Playwright 1.65) |
| the same list on the box — the sum of the 405 tests' own times (`scripts/e2e-timings-diff.mjs`) | 7077 s (42.2 min functional wall, 2 workers) | 7207 s (43.5 min) — **+2 %, inside the run-to-run noise**; the e2e browser also moved to Chromium 158 in the same step. At this granularity the new core neither speeds the product's flows up nor slows them down — they are paced by motion, not by reactivity |

**What the new core itself buys** — `node --expose-gc scripts/vapor/reactivity-bench.cjs <node_modules>` (no DOM, no
components; the shapes the console leans on; median of five, two rounds each, the laptop):

| Shape | 3.5.42 | 3.6.0-rc.15 | |
| --- | --- | --- | --- |
| memory: 100 000 refs + 100 000 computeds over them | 56.1 MB | 37.8 MB | **−33 %** |
| fan-out: one ref → 2000 watched computeds, 100 writes | 113 – 121 ms | 42 – 44 ms | **2.7× faster** |
| view-apply: a game view rewritten field by field under 100 derivations, 60 turns | 80 – 83 ms | 62 – 73 ms | −10 … −26 % |
| chain: a computed chain 1000 deep, 300 invalidations | 14.5 ms | 11.2 – 12.2 ms | −20 % |
| sync edges: 200 sync watchers over one array, 2000 pushes | 90 ms | 77 – 82 ms | −10 … −14 % |

The three hand-run perf probes (`console-longgame-perf-probe`, `-played-`, `-recv-`) need a seeded server started by
hand and were NOT run in this stage; what was measured on the product is the box list above. A 4K frame-split from a
field session on the new core is still owed — it is a row of V2's first slice, not a claim made here.

### 3.3 What is NEW in 3.6 that the architecture can use — and what is not there
`node scripts/vapor/reactivity-facts.cjs <node_modules>` and a diff of the packages' exports, 3.5.42 against rc.15:

- **The public reactivity API did not change.** alien-signals is an internal replacement of the core. The new runtime
  exports of `@vue/reactivity` (`startBatch` / `endBatch`, `setActiveSub`, `setCurrentScope`, `trackDep` / `triggerDep`,
  `Dep`, `WatcherEffect`) are present but mostly UNTYPED — internals of the runtime packages, not something to build
  on. What the kernel uses (`watch` incl. `flush: 'sync'`, `computed`, `customRef`, `shallowRef`, `effectScope`,
  `getCurrentScope`, `onScopeDispose`, `markRaw`) is the stable surface, and its behaviour is now PINNED (§3.5).
- **Vapor is the new public surface**: `createVaporApp`, `vaporInteropPlugin`, `defineVaporComponent`,
  `defineVaporAsyncComponent`, `VaporDirective`, `VaporTransition` / `VaporTeleport` / `VaporKeepAlive`. A component
  has NO instance for user code there — `getCurrentInstance()` is `null` — while `provide` / `inject`,
  `hasInjectionContext()`, `getCurrentScope()` / `onScopeDispose` and every lifecycle hook work the same in both
  runtimes. **That is the surface the flow kernel's component binding stands on now** (§3.4).

### 3.4 The architecture, adapted (what changed in the framework)
- **`useFlowScope` / `useConsoleSession` / `componentSessionScope` bind to the EFFECT SCOPE and the injection context —
  never to a component instance.** The shell's session is keyed by its setup's effect scope; a component finds it by
  `inject`. One call serves a virtual-DOM component, a Vapor component and a composable run in a bare `effectScope()`
  (a controller under a spec with no mount). A component's flow scope still ends on its `unmounted` edge (after its
  children, after the patch — the edge every release was written against); its effect scope's disposal is the NET
  under the hook (a Vapor component removed before its mount gets `scope.stop()` and no hook) and the ending itself
  in a bare scope. Specs: `tests/client/console/useFlowScope.spec.ts`, `vaporCapability.spec` § the flow kernel.
- **The reactivity the kernel rides is a written contract** — `tests/console/vueReactivityContract.spec.ts` (module
  half) + `tests/client/console/vueTickOrder.spec.ts` (component half): a Vue bump that moves a fact fails there, by
  name, before any e2e.
- **The project's directives exist as imports good in both runtimes** (`directives/vDirectives.ts`), so a converted
  component's import lines are written once.
- **The build compiles Vapor**, the unit runner mounts it, the readiness ledger counts the road (§3.6 · §3.7 · §5).

### 3.5 What the new reactivity core changed — ONE thing
Compared fact by fact (the script above; both installs side by side):

| Fact | 3.5.42 | 3.6.0-rc.15 |
| --- | --- | --- |
| pre-flush watchers of no component run in the order they were TRIGGERED (not created) | ✔ | ✔ same |
| a watcher of no component runs BEFORE every component's watchers; the component's own run in TRIGGER order; a reaction woken by a reaction runs after the waiting ones and before the render; the render once; the child after | ✔ | ✔ same |
| sync watchers of ONE source run in creation order, inside the write | ✔ | ✔ same |
| a sync watcher sees one array mutation as ONE edge; two plain writes as two | ✔ | ✔ same |
| sync → pre → post → `nextTick` | ✔ | ✔ same |
| a self-triggering watcher re-runs in the same flush; write-and-restore inside a tick is no edge | ✔ | ✔ same |
| `customRef`, `shallowRef` / `triggerRef`, a detached `effectScope`, `markRaw` under `reactive` | ✔ | ✔ same |
| **ONE mutation of a collection wakes several reactions through DIFFERENT facets (an array's `length` · its iteration · one index; a Map's `size` · its values · one key): which is woken FIRST** | `length` readers, then iterators, then the key | **the key, then iterators, then `length` readers** — pre-flush AND sync |
| the order of `onScopeDispose` callbacks between a scope and its child scopes | the scope's own first | the children's first |

The first group is what the architecture relies on — it is pinned by the two contract specs. The last two rows are
NOT contracts and nothing may rely on them. One product flow did: the bot's staged timeline kept its strict FIFO only
because the liveness walk (a watcher of `transient.length + queue.length`) ran BEFORE the delivery (a watcher of
`transient.find(…)`) when one `push` woke both; on 3.6 the tail committed under the card still on screen
(`marsBotStagedCommits.spec` — the pilot's one red). Now it is ONE watcher with the order in its body, and the law is
rule 6 of §2 with a guard that fails on two `watch` sources in one file reading different facets of one collection.

⚠ The guard sees `watch(` sources. A pair of an Options-API component's `watch:` rows over two COMPUTEDS of one
collection is the same class and is not seen statically — it is what the full e2e is for, and what goes away as V2
takes the reactions out of the watch table.

### 3.6 The Vapor probe — the capability table (an executable suite)
`tests/client/vapor/vaporCapability.spec.ts`: Vapor single-file components compiled by the product's own toolchain,
mounted inside a virtual-DOM app through `vaporInteropPlugin` — how every wave of V3 will run. Every row is a test; a
new RC re-reads the table by running it.

| What | On rc.15 | Notes |
| --- | --- | --- |
| props from a vdom parent (reactive), text / class / attribute bindings, `v-for` keyed, `v-if` / `v-else`, `v-show`, `v-html`, `v-model`, `<component :is>` | ✔ works | |
| `emit` → a vdom parent's listener | ✔ works | |
| attributes / a class from the vdom parent falling through onto the root — a `v-if` root too, also one ABSENT at the mount | ✔ works **with a rule** | **the template must START with its root.** A development build keeps template comments; a comment before the root makes the root a FRAGMENT for Vapor and the attributes are dropped with a warning — in development and in unit specs ONLY (production strips the comment and inherits). Found on `ConsoleForecastDoor` (`data-unfold-late`). The comment goes into the script block; guard: `vaporReadiness.spec` § a Vapor template starts with its root |
| a parent's `ref` on a Vapor child | ✔ works | it IS the child's `defineExpose` object — nothing else (no `$el`, no `$props`) |
| events | ✔ works | NOT delegated (opt-in since rc.2): a listener above the component hears a plain click; `.stop` shields exactly what it did |
| `<Transition>` over a keyed `v-if` · `<TransitionGroup>` | ✔ works | the vdom names compile to the Vapor components; hooks and classes as before |
| `<Teleport :to :disabled>` — the SAME node moves, both ways | ✔ works | the embedded-step chain's mechanism |
| slots: a default and a scoped slot from a vdom parent INTO Vapor; a scoped slot from Vapor DOWN into a vdom child | ✔ works | |
| a Vapor PARENT hosting an Options-API CHILD (its props, its `$emit`, its global `v-i18n` / `$t`) | ✔ works | every wave has this shape at its edge |
| a vdom `defineAsyncComponent` loading a Vapor component | ✔ works | the lazy chunks |
| `v-i18n` / `v-trim-whitespace` as imports — static text, an interpolation, params, a late `v-if` branch; translated at the first frame and after every change | ✔ works | `directives/vDirectives.ts`: in Vapor the directive follows the text it owns through ONE shared `MutationObserver` (there is no `updated`); in a vdom `<script setup>` the same binding is called on `mounted` / `updated` |
| `$t(…)` in a template | ✔ works **with a change** | it is the imported binding — a Vapor component has no global properties |
| `useFlowScope` (the kernel) · lifecycle hooks · `useTemplateRef` | ✔ works | bound without an instance (§3.4) |
| `getCurrentInstance()` | ✘ `null` | by design — nothing of ours needs it (the shell's port stopped being the instance with architecture S-last) |
| TEMPLATE REFS: `useTemplateRef` on the root (what `this.$el` was) · a ref inside `v-for` (an ARRAY, in order, following the list) · a function ref (called with the element, and with `null` when it leaves) · a ref of a virtual-DOM child (its public instance — methods callable) · a ref of a Vapor child (its `defineExpose`d object) | ✔ (`VaporRefsProbe.vue`, 2026-11-12) | RECIPES § R11 · R12 |
| CONTEXT: `inject` of what a vdom ancestor provided · `provide` to an Options child · `defineOptions({inheritAttrs: false})` + `useAttrs()` · `$slots` / `$emit` / `$attrs` / `$props` in the TEMPLATE (the compiler binds them from the setup context) | ✔ (`VaporContextProbe.vue`, `VaporRefsProbe.vue`) | RECIPES § R3 · R13 · R16 — a template keeps `$emit(…)` and `$slots.x` as they are |
| HOOKS: `onBeforeUpdate` / `onUpdated` (fire when the component's own bindings re-ran) · a `flush: 'post'` watcher reads the DOM the same change wrote · `onErrorCaptured` catches a vdom child's error across the interop boundary | ✔ (`VaporContextProbe.vue`) | RECIPES § R6 · R9 |
| THE LOCAL DIRECTIVES, imported: two that rewrite the text `v-i18n` translated (they follow the text through an observer — Vapor has no `updated`), one with a LIFETIME (`v-embed-zone` registers AND unregisters) | ✔ in a Vapor component (`VaporDirectivesProbe.vue`) and — the same import lines — in a `<script setup>` one on the virtual DOM (`SetupDirectivesProbe.vue`, which also pins what `dualDirective` leans on: a function directive's `unmounted`) | RECIPES § R17 |
| THE SHELL'S COMPOSITION — controllers behind a late-bound port (`shell/shellPort.ts`), a surface standing in the registry through a function ref (`:ref="surfaces.bind.<name>"`), a reactions table of `watch()` rows over port members and a prop, a WRITTEN port row, `onMounted` / `onBeforeUnmount` | ✔ (fixture `VaporShellProbe.vue`, 2026-11-12) | `ConsoleShell.vue` is this shape (`useConsoleShell`): its conversion changes how the template names the members, not the mechanism |
| `v-memo` | ignored (compiler warning) | drop at conversion |
| `@vue/test-utils`: `mount(<a Vapor component>)` as the ROOT | ✘ throws in the package · ✔ in the suite | test-utils reads the root's vdom instance. Since 2026-11-13 the unit bundle's `mount` stands a Vapor root under a host itself and returns a wrapper that speaks for the component (§ 4b — `tests/client/testing/`). The interop plugin is installed for every mount by `tests/client/components/bundleSetup.ts` |
| test-utils' default `transition` stub | does not apply in the package · ✔ in the suite | the suite's layer applies it to a Vapor render too (§ 4b); the REAL Vapor `<Transition>` (`stubs: {transition: false}`) needs a frame source in a spec — `tests/client/vapor/lendFrames.ts` |
| test-utils' `stubs` / `findComponent` for the CHILDREN of a Vapor component | do not apply in the package · ✔ in the suite | a child is created by a direct call of the compiled template — no vnode stands for it. The layer wraps that call: the mount's stub rule and one tree walk over both runtimes (§ 4b; `tests/client/testing/vaporTestLayer.spec.ts`) |

**The three leaves that ship as Vapor** (each a different row of the table, each with live e2e over it):
`marsbot/BotReviewEdgeNotice.vue` (a `<Transition>` over a keyed `v-if` on module state · `$t`) ·
`console/ConsoleForecastDoor.vue` (an `emit` four vdom hosts listen to · attribute fallthrough · two vdom children
inside) · `card/CardDescription.vue` (`v-i18n` over an interpolation, many instances per screen, a unit spec).
`main.ts` installs `vaporInteropPlugin`.

### 3.7 The toolchain — what it took, and the decision it leaves
- **`vue-loader` does not know Vapor** (17.4.2 is its latest; the last commit is from January 2024). A production
  build compiled a Vapor SFC correctly anyway (the template is compiled inline by `compileScript`, which reads the
  `vapor` flag off the descriptor); the unit-test bundle and `dev:client` did NOT (the loader's own template loader
  calls `compileTemplate` without the flag — a vdom render function attached to a `defineVaporComponent`).
  **Fix: `scripts/vapor/sfcTemplateCompiler.cjs`**, handed to the loader as its `compiler` option — the DOM compiler
  for every component, `@vue/compiler-vapor` for one whose `<script>` / `<template>` carries `vapor`. No patched
  dependency; one extra template parse per component per build.
- **A prerelease does not satisfy a peer range** (`3.6.0-rc.15` is not in `^3.5.0` or `3.x`): without help npm keeps a
  SECOND, 3.5 copy of the compiler for `@vue/test-utils` and `vue-tsc` and leaves `@vue/server-renderer` unresolvable.
  **Fix: `overrides`** — `vue` and all eleven `@vue/*` core packages pinned to the same exact version (explicit
  strings; `$vue` references failed to resolve on a fresh lock). One flat tree.
- **`mochapack` is gone.** It was the client unit runner, unmaintained since 2021, and it deep-required the internals
  of both tools it glued (`webpack/lib/Watching`, moved in webpack 5.112; `mocha/lib/cli/run-helpers`, gone in
  mocha 12) — the one package holding the bundler and the test framework a version behind. `scripts/client-tests.mjs`
  does what it did for a run against the two tools' PUBLIC APIs (webpack → one file → mocha), collects the same
  suite (8 425 tests), and needs no flags (`npm run test:client:one -- <spec>`).
- **THE DECISION LEFT OPEN — the bundler's Vue plugin.** Everything above makes webpack + `vue-loader` sufficient for
  V2 and for V3's waves, and nothing here blocks them. But the loader is unmaintained and the official toolchain for
  Vapor is Vite's `@vitejs/plugin-vue`. Recommendation: stay on webpack through V2 (no reason to move a build under a
  redesign), and decide at the ENTRY of V3 — with one fact in hand that this pilot could not produce: a production
  build of a Vapor-heavy bundle, measured. If the wrapper compiler ever needs a second special case, that is the
  signal to move rather than patch.

### 3.8 The protocol of the NEXT bump (a new RC · 3.6 final)
1. `node scripts/vapor/reactivity-facts.cjs <old node_modules>` and `<new>` → diff. What it prints differently is
   what the suites are about to tell you the slow way.
2. Change the version in `dependencies.vue` AND every row of `overrides`; `npm install`.
3. `npm run lint`, `npm run build:test`, `npm run test:server`, `npm run test:client` — the two contract specs and the
   capability suite first: a red there is the bump's finding, by name.
4. `npm run build` — the bundle against the numbers of §3.2.
5. The box list, then the full CI. Write what moved into §3.5 / §3.6. The bump is one commit.

---

## 4. V3 — the rework (how it will be run)

- **Deletion first.** What the desktop deletion waves remove is never converted.
- **Waves, from the leaves to the shell**: ① leaf presentational components (badges, chips, glyphs, the premium card's
  parts) → ② the foundation components (`components/console/foundation/**`) → ③ the domain surfaces, domain by domain
  (each with its controller already holding its logic) → ④ the hosts and the workspaces → ⑤ `ConsoleShell.vue` and
  `App.vue`, last.
- **THE RECIPE BOOK IS `docs/claude/vapor/RECIPES.md`** — one recipe per construct, complete BY CHECK: `node scripts/vapor/inventory.mjs` reads every component with a real parser and fails on a construct with no row (`tests/console/vaporRecipes.spec.ts`); `--component <path>` prints a component's conversion SHEET (its constructs, what it MUST EXPOSE to the parents that reach it through a ref, who mounts it), `--wave` the worklist. A conversion is done by analogy from the sheet — nothing is discovered in the middle of a wave.
- **One recipe per construct, applied the same way everywhere** — the book's 26 rows (R0 – R25): the option blocks, the
  instance members, the watchers, the template's own constructs, the script's module level. A component's public
  surface (props, emits, what it exposes, its e2e hooks) does not change in a conversion.
- **THE FOUNDATION WAS TESTED BY USING IT (2026-11-12).** Six real components of six different kinds were each handed
  to a FRESH agent with nothing but the book and the component's sheet: the workspace header
  (`foundation/ConsoleWsHead`), a stateful leaf with timers and two prop watchers (`ConsoleFlipValue`), a stage with a
  directive that has a lifetime (`parliament/ConsoleParliamentDrawStage`), a component its parent reaches through a
  ref (`parliament/ConsoleParliamentEffectsStep`), an injection of a provided computed (`premiumCard/
  PremiumFleetMark`), a layer with function refs in `v-for` that three parents read (`cardDeal/ConsoleCardDealLayer`).
  All six converted to `<script setup>` (step A), their specs green, vue-tsc clean — and each agent reported every
  place it had to guess. Those reports became rows: R25 (the module level — in `<script setup>` it is PER INSTANCE,
  so module state moves out), the `inject` unwrap trap, a ref key that is also a member's name, what a parent's ref
  of a `<script setup>` child holds, `:key` re-mounts, the stub and expose rules of a spec, a `MUST EXPOSE` list
  that names only real members, a `STEP B` verdict on every sheet. **That loop — convert by the book, report the
  guesses, fix the book — is the protocol of every wave's first batch.**
- **The worked examples** are the table of `RECIPES.md` § 5: three at step B (the pilot's leaves) and those six at
  step A.
- **WAVE 1 — DONE AT STEP A (2026-11-13): the 118 lightest leaves, a quarter of the client.** How a wave is run,
  as it was:
  1. *Pick* — `inventory.mjs --wave`, lightest first; out go the components reachable from no entry (an import-graph
     walk from `main.ts` found 17 — dead code is deleted, not converted), the `@deprecated Desktop-only` ones, and
     those whose sheet carries a row that needs a neighbour to change (module state, a value export, `provide` /
     `inject`, a render function, the instance's internals) — those go in the wave whose first step moves that
     neighbour.
  2. *Convert* — fifteen agents, eight components each, in ONE tree on disjoint files; the brief is the book and the
     sheet, with one hard rule: **what the book does not say is a SKIP with its reason, never an improvisation.**
     Agents run their own specs and eslint; nobody runs vue-tsc, the suites or `ready:vapor` while others edit.
  3. *Read the gaps* — 112 converted (zero vue-tsc errors over the whole batch), 6 skipped. Every skip and every
     guess was a missing sentence: a member that only hands an import to the template, a member named like a global
     the template compiler allows, the three async-on-purpose global components (`components/asyncComponents.ts`), a
     spec that replaced a method through `wrapper.vm`. They became § 1's house rules and § 3's spec rules, and the
     six were converted by the updated book.
  4. *Verify once, centrally* — vue-tsc, plain tsc, `build:test`, eslint, both unit suites, the ledgers
     (`ready:vapor` run once), the functional e2e on the Steam Machine; then ONE COMMIT PER COMPONENT (the component
     and the spec that came with it — `git log --grep "V3 wave 1"`).
- **WAVE 2 — DONE AT STEP A (2026-11-13): the next 118 by weight** (stateful leaves and small surfaces — every
  component up to weight 3 that needs no neighbour to change; half the client is off the Options API). Same protocol,
  twenty agents of six. What it added to the protocol, each paid for:
  1. *The sheet's `MUST EXPOSE` was a guess in four shapes* (`(this.$refs.x ?? undefined) as {…}` held in a local,
     the `typedRefs` idiom, a ref on `<component :is>`, a member that returns the ref): six agents caught it by
     reading the parent, as the book told them to — and the tool was rebuilt so that it cannot hide a read at all: the
     sheet prints EVERY line of a parent that names the ref (complete by construction), follows what it can, and the
     inventory FAILS on a converted component that does not expose a member a parent reads. That audit ran over both
     waves: nothing was hidden.
  2. *`vueRoot(this)` was `$root` behind a helper* — invisible to the sheet, three components of the wave. It got its
     construct, its recipe (R26: the APP ROOT'S PORT — `App` provides `AppRoot`, a component takes it with
     `useAppRoot()`), a row of the readiness ledger (`root-through-instance`) and its first three conversions.
  3. *Twenty more sentences of the book* (RECIPES § 1, R2, R4, R5, R6, R11, R12, R21, R24, R25, § 3): the alias
     table by the member's SHAPE, a body's local named like its member, a `data()` with statements, the type that
     only annotated `data()`, a comment between two roots, `<component :is>` fed a string, a spec named after its
     component that only asserts «mounts».
  4. *«The template does not change» is CHECKED* — `node scripts/vapor/template-diff.mjs <the wave's base>` compares
     every converted template with what it was, comments aside: wave 1 — nothing; wave 2 — the one licensed guard and
     one space an agent lost between two attributes of a root, which nothing else would have shown.
  5. *A gap is closed in the SAME wave*: the nine components the agents skipped by rule were converted by the
     extended book before the wave was verified — a skip that waits for the next wave is a recipe nobody tested.
- **WAVE 3 — DONE AT STEP A (2026-11-13): the next 118 — everything up to weight 12** (the components with a `$refs`
  / `$el` reach, watchers, module state; three quarters of the client are off the Options API). Twenty-five agents;
  118 converted, vue-tsc green over the whole batch at the first central run. What it added:
  1. **THE CODEMOD — `scripts/vapor/convert.mjs`: the book applied mechanically.** It reads the script through
     TypeScript's AST (a language service for renames, one real program for the types of what `setup()` returns) and
     the template through the compiler, rewrites every `this.x` by what `x` is, applies the house rules, REFUSES what
     has no mechanical form and prints a REVIEW line per place a person must look at. Its tests are the waves
     themselves: over the Options form of every component waves 1–2 converted by hand it writes the same script for
     four in five (`tm-arch-tools/cm_corpus.py`); over ALL 226 remaining components, converted into a copy of the tree
     and type-checked there (`tm-arch-tools/shadow.sh`), it left three dozen type errors in 177 converted components
     — each a rule since added to it. It converted the four components this wave's agents had skipped by rule.
  2. *The sheet's last blind spots* — a surface read through the registry a line below the `at()` call, a computed
     ref key (`this.$refs[name]`), a component's own `expose({…})` as its contract, a read a parent makes of a member
     that was never exposed (named, with the reason — waking it is a fix of the parent).
  3. *The order was wrong in the book*: the Options API fires an `immediate` watcher BEFORE it calls `created()` —
     the `created` body stands AFTER the watchers. One conversion of the wave had it the other way; corrected.
  4. *Module state has three forms* (R25): a counter behind an accessor, a handle moved with the code that owns it,
     a container exported as itself — and a module-level `defineAsyncComponent` is state (its resolved cache).
  5. *The app root as the transport drives it* (`useTransportRoot()`), and `ConsoleBoardBinder` on it.
- **WAVE 4 — DONE AT STEP A (2026-11-13): THE TAIL — the last 91 live components, and with them the Options API is
  gone from the client** (`options-api: 0`). The monsters (`ConsoleStartScene`, `ConsoleActionComposer`,
  `ConsolePlayCardConfirm`, `ConsoleHydroSection`, `ConsoleParliamentSection`, `ConsoleTaskHost` — 4 000–8 000 lines
  each), the shell and the app root. Each was STARTED by the codemod and reviewed against its Options form; the 17
  reachable from no entry were deleted (`docs/DESKTOP_REMOVAL_WAVE_5.md` — with them the client's last mixin). What
  the tail added, each of it now a rule of the book or a check:
  1. **The shell is `<script setup>` over ONE composition** (R8): `const {…352 names…} = useConsoleShell(props)` — the
     names the template reads, taken off the composition's type by the codemod, kept honest by vue-tsc (a missing
     one) and eslint (an unused one); its own four template refs go to the composition BY NAME (`useTemplateRef`
     inside `composeShellMembers`), and it gained a unit spec that mounts the whole game screen.
  2. **The app root is a PORT object** (R26): accessors over the root's refs, satisfying `AppRoot` AND the transport's
     `TransportRoot`; `vueRoot.ts` is deleted, `$root` is read nowhere.
  3. **`ConsoleTeleport` is `<script setup>`** (R18): its render lives in a functional component of its script and
     reads the vnode it returned last instead of `this.$.subTree` — `instance-internals` is at zero.
  4. **A spec that ran members off the Options object against a stub `this`** (eight specs of the largest surfaces)
     moved those members behind a PORT into `<component>Logic.ts` (§ 3) — `consoleTaskHostLogic.ts` (32 members),
     `consoleParliamentSectionLogic.ts`, `consoleDraftWorkspaceLogic.ts`.
  5. **Two classes a mechanical conversion gets SILENTLY wrong are now a tool and a guard** (`scripts/vapor/audit.mjs`,
     `tests/console/vaporConversionAudit.spec.ts`): a module-level table that became per-instance (four scene
     contexts and a baseline were converted without a refusal before the tools learned a non-empty literal is state),
     and the unguarded root cast inside a callback that outlives the component (measured: two `TypeError`s per leave
     of the carry-over picker).
  6. **A template ref named like a ref-typed member** keeps the member's name (§ 1 — the twin `<key>El`, pinned in
     both template shapes by `refKeyTwin.spec.ts`); **`beforeCreate`** stands above every declaration (R9); **a guarded
     `$el`** keeps its guard, and in a development build the root ref makes code run that a comment-led template had
     kept dead (R12); **SOURCE GUARDS** — server-runner specs that slice a component's text — are on every sheet.
  7. *One behaviour changed on purpose:* the right stick now pages the SYSTEM OVERLAY (`GamepadLayer` looked its host
     up through `$el`, which under a teleport root is the teleport's placeholder — the lookup never found it).
  **What is left of V3 is STEP B** — the `vapor` attribute, wave by wave (§ 4a).
- **Two watchers of one collection are merged BEFORE their component is converted** (§2 rule 6) — a conversion does
  not get to discover an order dependency.
- **Every wave is its own series of commits and its own full e2e run on CI** — «все кейсы тестируем через e2e на CI»;
  the next wave does not start on a red one.

## 4a. From step A to `createVaporApp(App)` — what is LEFT, measured (2026-11-13)

Step A is complete: no component is an Options-API component. `createVaporApp(App)` asks for more than that — EVERY
component a Vapor component and nothing in the tree that needs the virtual-DOM runtime. What stands between, in the
order it has to be done, each with its number and the tool that prints it:

| # | What | Measured | How it is closed |
| --- | --- | --- | --- |
| B0 | **The release.** `vue@3.6.0-rc.15` is a release CANDIDATE; Vapor's interop and test story still move between RCs. | pinned exactly (§ 3.8) | re-read the capability table on every RC; V4 on a stable 3.6 is the owner's call |
| B1 | **Does it COMPILE as Vapor?** `node scripts/vapor/vapor-check.mjs` compiles every component with the Vapor compiler (the production, inline shape). | **448 of 455 compile clean** · 4 REFUSED · 2 warn · 1 needs the virtual DOM | the seven below |
| B2 | The four templates the Vapor compiler refuses: «`v-if`/`else` branches must use unique keys» — `ConsoleActionComposer`, `ConsoleCardActions`, `ConsoleEffectsExplorer`, `ConsoleStartScene`. | 4 | give the branches distinct keys (a template edit — each proven by its surface's e2e) |
| B3 | `v-memo` — ignored by the Vapor compiler. | 11 uses in 2 components (ledger row `v-memo`) | delete at B (R23) — a Vapor update is per binding already |
| B4 | `ConsoleTeleport` — a render function over the previous vnode. | 1 (ledger `render-function: 4` = its four `h(`) | the REWRITE on the Vapor `<Teleport>` (R18): a template, `v-if="targetStands"` + `:key="generation"` |
| B5 | **A parent that reads a CHILD's `$el` through its ref.** A Vapor child's ref is its `defineExpose` object — no `$el`. | 25 reads in 17 files (`grep '\.\$el\b' src/client`): the viewer controller ×5, the flight layers' tile / cube proxies, the source docks, the stage geometry's hull members | the child exposes its root (R12), or the parent asks the child for what it wanted the element for; done WITH the child's step B |
| B6 | **The unit suite.** `mount(<a Vapor component>)` as the ROOT throws; `stubs` do not reach the children of a Vapor parent; `findComponent` into a Vapor child fails; `wrapper.vm` has nothing to show. | 918 client spec files: **494 mount a component** · 254 use `stubs` · 224 `findComponent` · 208 `setProps` / `setData` · 64 `shallowMount` · 61 read `wrapper.vm` | **CLOSED 2026-11-13 — by a LAYER, not a codemod: no spec was rewritten** (§ 4b). The unit bundle's `@vue/test-utils` and `vue` are the suite's own (`tests/client/testing/`): a Vapor root is mounted under a host and wrapped, the mount's stub rule reaches what a Vapor render creates, `findComponent` walks one tree over both runtimes. A converted component is compiled AS WRITTEN in the unit bundle (`scripts/vapor/unitVaporPolicy.cjs`; the valve `tests/client/vaporUnit.json` is empty) |
| B7 | **Order-dependent watcher pairs** — two watchers of one source / one collection whose order matters are ONE `watch` before their component is Vapor (§ 2 rule 6; a Vapor effect has no «component render» to order against). | named by the wave's reviewers: `ConsoleMaScreen` (`kind` → `items`), `ConsoleHandSection` (`index` → `modeKey` → `entries`); the full list is a review of the 122 former `watch:` blocks | merged per component, in the commit before its `vapor` |
| B8 | **`onUpdated` / «after every parent re-render» logic** and reads through `wrapper.vm` of the dev shape. | per sheet (R9 «trap at B») | a `watch` of what is measured |
| B9 | **The flip itself** — `<script setup vapor>` on 452 components, leaves first, hosts after their children (a Vapor parent hosts a vdom child, and the reverse, through `vaporInteropPlugin` — so the waves can run in any order, but a ref's shape changes at each edge: B5). | 3 of 455 are Vapor | by wave, each on the box; the per-component sheet's `STEP B` line is clear for 452 (3 sheets carry a blocker: the two `v-memo` hosts, one `$t` without its import) |
| B10 | **What the APP still registers globally** — `app.component` ×3 (the async-on-purpose tags), `app.directive`, `globalProperties.$t`: a Vapor app has no global properties. | ledger `global-registration: 6` · `global-in-setup: 2` | removed once no component reads them (every `<script setup>` component already imports its own) |
| B11 | **V4 — the switch.** `createApp(App)` + `vaporInteropPlugin` → `createVaporApp(App)` in `main.ts`; the plugins the app installs (`i18n`), `app.config.errorHandler`, the unit runner's `bundleSetup.ts` interop install. | 1 file + the runner | after B1–B10 are zero and the whole e2e is green on the box with the interop plugin REMOVED |

**What is NOT left** (closed by step A and guarded): the Options API (`options-api: 0`), `$refs` (0), `getCurrentInstance`
(0), instance internals (0), `$parent` / `$root` / `vueRoot` (0), mixins (0), module state hidden in a component
(`audit.mjs` § A: 0), a deferred cast of a template ref (§ B: 0).

**The honest size of it:** the PRODUCT side of step B is small and measured (B2–B5: 4 templates, 11 `v-memo`, one
rewrite, 25 `$el` reads; B7–B8 are reviews). The TEST side (B6) was expected to be the bulk and is closed (§ 4b):
flipping a wave is the tool's one attribute (`node scripts/vapor/flip.mjs`), its unit specs under the true runtime,
and a box run.

## 4b. The unit suite over a Vapor tree — the layer (2026-11-13)

**The measurement that set the design.** The whole client was flipped in a side worktree (448 of 455 components —
`flip.mjs --all`; the seven of B1 stay) and the unit suite run under the true runtime with nothing else changed:
**906 of 9859 tests red**, in three classes — a Vapor root cannot be mounted, `stubs` do not reach a Vapor parent's
children, `findComponent` cannot enter one. All three are the TOOL's, none the specs': 494 spec files would have been
rewritten to say the same thing in other words. So the tool was completed instead.

**The layer** — `tests/client/testing/`, aliased in by `webpack.test.config.js` (a spec imports `@vue/test-utils` and
`vue` as it always did):

| File | What it is |
| --- | --- |
| `vueForTests.ts` | `vue` as the unit bundle sees it: the real package, with the three calls a COMPILED VAPOR TEMPLATE makes to create a component wrapped (`createComponent`, `createComponentWithFallback`, `createDynamicComponent`) — the one place a Vapor parent's children pass through |
| `vaporTree.ts` | the registry of what a Vapor render created (under whom, standing for which component), the mount's stub rule applied to that call, ONE tree walk over both runtimes in document order, wrappers of test-utils' reading surface over a Vapor instance |
| `vaporTestUtils.ts` | `@vue/test-utils` as the bundle sees it: `mount` / `shallowMount` (a Vapor root under a host; `props`, `slots`, `data()`, `setProps`, `unmount`), the finders of test-utils' own wrappers over the one tree, its stub hook taught not to stub the layer's stubs |
| `vaporTestLayer.spec.ts` + `fixtures/` | every promise above as a row, on fixtures that are Vapor in every mode — red on the day a new core moves an internal the layer reads |

What a spec may now rely on WITHOUT knowing its component was converted: `mount(Component, {props, slots, data,
global: {stubs}})` · `shallowMount` · `wrapper.element / classes / attributes / text / html / find / findAll / get /
props / emitted / setProps / trigger / unmount` · `wrapper.vm` (the `defineExpose` object, the setup bindings of a
development build, a prop by name, `$el`, `$emit`) · `findComponent` / `findAllComponents` / `getComponent` by the
component, by its stub, by `{name}`, from a component wrapper or a DOM wrapper · a stub by the parent script's LOCAL
binding name (`import Card from 'CardFace.vue'` → `stubs: {Card: …}`) or the component's own · the default
`transition` stub with its slot, `stubs: {teleport: true}` reading a teleport in place.

**After the layer: 10 of 9860 red under the true runtime — and every one is a fact about the PRODUCT** (the worklist
of the flips, not of the suite):

| What | Tests | It is |
| --- | --- | --- |
| a parent's ref on a Vapor child answers no `$el` — `CardZoomModal`, `ConsoleResourcePanel`, `ConsoleStartPlayedDock`, `ConsoleTilePlacementLayer` ×2, `ConsoleTileProxy` ×2, `PlayerCube` | 8 | **B5**, measured from the other side: the spec that pinned «the ref still answers the root (step A)» moves with the child's step B |
| `GlobalEvent` — a Vapor child whose SET-UP throws inside a virtual-DOM parent's patch: the guard's error is reported, then the interop fails the patch with a second one (`…reading '__vapor'`) | 1 | a gap of rc.15's interop; decided at the component's step B (a guard that reports and renders nothing, or the flip of its parents first) |
| the capability table's «teleport target missing» row, red only in that run | 1 | order-dependent on the nine above (a throw inside Vue's warn path latches its re-entrancy flag for the rest of the bundle) — re-read once they are closed |

Seven specs asserted how a runtime SERIALISES (the order of classes after an update, of attributes in `html()`, the
anchor comment an absent root leaves) — rewritten to assert the fact (the SET of classes, the attribute by name, «no
element»): green in both runtimes. That is the whole of the spec edits.

**The policy** (`scripts/vapor/unitVaporPolicy.cjs`): the unit bundle compiles a component AS WRITTEN — a converted
component meets its specs under the runtime that ships. The valve (`tests/client/vaporUnit.json` §
`virtualDomInUnit`, `{file: reason}`) sends one component to the virtual DOM in the unit bundle only; it is EMPTY, its
ceiling only falls (`tests/console/vaporUnitPolicy.spec.ts`), and V4 takes it empty. One run: `npm run
test:client:vapor[:one]` (the valve ignored) · `npm run test:client:vdom:one -- <spec>` (nothing of `src/client` as
Vapor — «is this red about the runtime at all?»).

**What the layer does NOT hide** — and a spec still has to know: a Vapor `<Transition>` asked for by `stubs:
{transition: false}` is the real one and needs a frame source (`tests/client/vapor/lendFrames.ts`); a slot given as a
STRING or a component goes test-utils' own road and, forwarded by a Vapor component into a virtual-DOM child, raises
rc.15's «invoked outside of the render function» (a FUNCTION slot does not — the layer hands it over itself; the fact
is a row of the layer's spec); `wrapper.vm` of a Vapor component has no Options-API surface (`$data`, `$options`).

## 5. The readiness ledger

`tests/console/vaporReadiness.spec.ts` over `vaporReadinessBaseline.json`, in the form of the two architecture
ledgers. Per file it counts what the target has no place for — `options-api` (the component itself) ·
`instance-access` (`getCurrentInstance`) · `parent-root` · `root-through-instance` (`vueRoot(this)` — the app root climbed to through the instance; → `useAppRoot()`, RECIPES § R26) · `mixin` · `global-registration` · `render-function` ·
`v-memo` · `refs` · `global-in-setup` (a `<script setup>` component leaning on `$t` / a global directive / a globally
registered component) · `instance-internals` (`this.$.…`, `$options`, `$forceUpdate`, `$data` — zero since wave 4). A file may not grow, **a new file starts at zero** (so rules 1, 2 and 4 of §2 are failing
tests, not conventions), a component that is Vapor stays Vapor, and a Vapor component holds nothing of the list.
`npm run ready:vapor` lowers the baseline and prints the line:

`Vapor components: 3 / 455 · options-api: 0 · instance-access: 0 · instance-internals: 0 · parent-root: 0 · root-through-instance: 0 · mixin: 0 · global-registration: 6 · render-function: 4 · v-memo: 11 · refs: 0 · global-in-setup: 2` (2026-11-13, after V3 wave 4 — step A complete; after wave 3: `options-api` 108, `refs` 571; after wave 2: 226 / 650; after wave 1: 344 / 652; at the pilot: `options-api` 468, `refs` 785, `instance-access` 1).

V3 is done when `options-api` is zero and every component is Vapor; V4 is one line in `main.ts` after that.

## 6. How it meets architecture v2

The two programs are one road. Architecture v2 (PLAN §11) retires `surface-by-ref` (S3 — the surface registry: no
`$refs` between surfaces), the view-apply's writes and the set-aside flag (S4), the domains' reactions and resolver
mailboxes (S6) and finally the shell's own `watch` table and hooks (S-last: «the shell is layout»). Each of those is
also a row of §1 above — and the watch table is exactly where §3.5's unguarded half lives. So V2 is not a detour
before the rework — it is the half of the rework that changes behaviour, done under the guards built for it; V3 is
the half that only changes form.

**Where that stands (2026-11-12).** All four are taken: the registry (S3), the question's scope and the set-aside
record (S4), the owned answers — `owedAnswer`, 29 resolver mailboxes of 26 modules (S6) — and the shell itself
(S-last). **`ConsoleShell.vue` — the largest component of the client, 27.8k lines when this started — is a template,
its `components`, its `props` and `setup(props) { return useConsoleShell(props); }`.** It is still counted as
`options-api` (it is a `defineComponent`), but nothing in it is Options-shaped any more: its conversion in V3 is ONE
decision — how the template names the members a `<script setup>` must bind at top level (a generated destructure of
the composition's return, or the region components each taking their slice; PLAN §5 · S-last) — and no rewrite of
logic. The composition asks Vue for nothing a Vapor component lacks: no instance, no `$refs`, no `$el`, no
`$watch`; its watchers are `watch()` calls in `setup`, its hooks `onMounted` / `onBeforeUnmount`, its template refs
refs and function refs. The recipe that took it apart (PLAN §5 · S-last, five steps, mechanical) is the recipe for
every other Options monolith of V3.

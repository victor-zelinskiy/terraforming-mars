# The recipe book — an Options-API component → `<script setup>` → Vapor

> The working half of `docs/claude/vapor/ROADMAP.md` (V3 — the rework of all components). **Every construct the
> client's 468 Options-API components use has ONE recipe here** — and that is checked: `node scripts/vapor/inventory.mjs`
> reads every component with a real parser and FAILS on a construct that has no row (`tests/console/vaporRecipes.spec.ts`
> runs it). A conversion is therefore done BY ANALOGY: print the component's sheet, apply the rows it names, run the
> checks of § 0. Nothing in a wave is discovered — if the sheet shows `UNKNOWN`, the recipe is written first.
>
> Every claim «works in Vapor» below is an executable row of `tests/client/vapor/vaporCapability.spec.ts` (the fixture
> is named); the worked examples are real components that ship.

## 0. The procedure — one component, one commit

```bash
node scripts/vapor/inventory.mjs --component src/client/components/console/foundation/ConsoleWsHead.vue
```

prints the component's SHEET: every construct with its recipe id, **`MUST EXPOSE`** (the members its parents reach
through a template ref — R11) **and, under it, EVERY LINE of a parent that names a ref standing on it — those lines
decide**: the list is what the tool could follow (through a cast, a `?? undefined`, a local, the `typedRefs` idiom, a
member that returns the ref, the shell's surface registry), the lines are complete by construction, and a read the
tool could not follow is still one of them. Then who mounts it, **the unit specs that import it and the specs that
NAME it** (a parent's spec that stubs it or finds it — re-run them all), its custom directives, the key it injects
and who provides it, its module-level value exports, and the **`STEP B`** line. The whole tree is audited the same
way on every run: a CONVERTED component that does not expose a member a parent reads fails the inventory (and with it
`tests/console/vaporRecipes.spec.ts`). Then:

1. **Convert the script** — the block order of § 1, each construct by its row. The TEMPLATE does not change (the
   exceptions are rows: a comment outside a root R24, a root ref for `$el` R12, the guard vue-tsc asks of a branch R2,
   `v-memo` R23 — and `scripts/vapor/template-diff.mjs` shows every other line that moved). The component's public surface — props,
   emits, what it exposes, every `data-*` / class / RU string an e2e spec waits for (`CLAUDE.md` invariant 14) — does
   not change.
2. **Types and lint**: `npm run lint:client` (vue-tsc — the only checker of template types), `npm run build:test`
   (the test tree — a spec that typechecks nowhere else), `npx eslint <the files>`; the production build's plain tsc
   runs inside `npm run build`.
3. **Its unit specs, in the same commit** — every spec the sheet lists, plus its own (§ 3 says what changes in a spec;
   a component with none gets `tests/client/components/<its path>/<camelCaseName>.spec.ts`).
4. **`npm run e2e:affected`** → the specs of its surface on the Steam Machine (`npm run e2e:remote`).
5. **`npm run ready:vapor`** — the ledger records the conversion and lowers the rows it cleared. It rewrites ONE shared
   baseline from the whole tree: in a batch of parallel conversions it is run ONCE, by whoever commits the batch (a
   row that fell without being recorded fails nothing in between).
6. **A commit of its own**, named after the component. A wave is a series of such commits and one full CI e2e run.

**Two steps, never one.** Step A: Options → `<script setup lang="ts">` (still virtual DOM — every recipe below).
Step B: `<script setup vapor lang="ts">` — one word. EVERY recipe below is ✔ Vapor unless its row says otherwise, so
what decides step B is the sheet's own `STEP B` line (it reads a converted script too, off the Composition API it
calls) plus the «at B» note of each row the sheet names — and, where a row's ✔ was proven on a simpler shape than
this component's (say so in the commit), a new row of the capability suite FIRST. A component may sit at A for as
long as it needs.

## 1. The shape of a converted script — the ORDER is part of the recipe

```ts
<script setup lang="ts">
/* (the comment that opened the template — verbatim, a block comment, FIRST in the script — R24) */
/* (the component's own header comment — the one that stood above `export default`; its `@console-shared` /
 *  `@deprecated` marker line survives) */
import {computed, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {$t} from '@/client/directives/i18n';                       // R19 — only if the template or the script says $t
import {vI18n} from '@/client/directives/vDirectives';              // R19 / R17 — every directive the template uses
import ChildA from '@/client/components/…/ChildA.vue';              // R1 — every component the template renders

export type ThingAccent = 'cyan' | 'gold';                         // R25 — module-level types / literal consts stay here
const FLIP_MS = 940;

defineOptions({name: 'ConsoleThing'});                             // R1 (+ inheritAttrs: false — R13)
const props = defineProps({ …the SAME object the option held… });  // R2
const emit = defineEmits([ …the SAME list… ]);                     // R3
const theme = inject<Ref<Theme> | undefined>(THEME_KEY, undefined); // R16 — injections, before what reads them

const flow = useFlowScope('console-thing');                        // R8 — what `setup()` returned, as top-level consts
const list = useTemplateRef<HTMLElement>('list');                  // R11 — the template refs the script reads
const open = ref(false);                                           // R4 — one `ref` per data field, the field's order
const label = computed(() => …);                                   // R5 — the computeds, in their order
function toggle(): void { … }                                      // R7 — the methods, as hoisted functions
provide(DOCK_KEY, label);                                          // R16 — after the declarations it hands down

// (created / beforeCreate bodies — R9 — here: after everything they read)
watch(() => props.value, (now, was) => { … }, {immediate: true});  // R6 — LAST among the declarations, in the block's order
onMounted(() => { … });                                            // R9 — hooks after the watchers
onBeforeUnmount(() => { … });
defineExpose({toggle});                                            // R11 — exactly the sheet's MUST EXPOSE list
</script>
```

Why the order: an Options component created its watchers AFTER `data`, `computed` and `methods` existed; an
`immediate` watcher written above a `const` it reads would hit it before its declaration. Declarations first, watchers
after them in the `watch` block's own order, hooks last — the same creation order the component had.

Inside the script: a data field / computed is `x.value`, a prop is `props.x`, a method is `x(…)`, **an injected ref is
`x.value`** (R16), `this` does not exist. In the template nothing changes — refs are unwrapped, props and functions are
reached by name.

House rules of a conversion (so two people — or a person and a codemod — produce the same file):
- **A MEMBER THAT ONLY HANDS AN IMPORT TO THE TEMPLATE IS DELETED — the import is the template's binding.** The
  Options API needed a member for everything a template names; `<script setup>` does not. Under the import's OWN name
  — a method `playerSymbol(c) { return playerSymbol(c); }`, the shorthand `methods: {$t, iconClassFor}`, a computed
  `LANGUAGES() { return LANGUAGES; }`, a data field `data() { return {PATH}; }` — the member goes and nothing replaces
  it (applied literally, R5 / R7 would redeclare the import). **Under ANOTHER name the test is SYNTACTIC, by the
  member's shape:**
  · a member that hands over a VALUE and whose body is one bare name — the shorthand `isItem: isICardRenderItem` /
    `noCards: NO_CARDS`, a computed or a data field `places() { return PARTY_EFFECT_PLACES; }` /
    `ui() { return consoleOverviewUi; }` — whether that name is an import, a module constant of the same script or
    module STATE: a plain alias at the member's place, `const places = PARTY_EFFECT_PLACES;` — no `computed` (nothing
    reactive is created; a type predicate keeps narrowing; module state is reactive by itself);
  · a computed whose body reads THROUGH something (`ring() { return focusState.ring; }`,
    `floater() { return CardResource.FLOATER; }`, `APP_NAME() { return constants.APP_NAME; }`): R5 literally — it stays
    a `computed` (the tool does not ask whether the property can change);
  · a WRAPPER method with a body (`iconClass(icon) { return iconClassFor(icon); }`): R7 literally — a `function`,
    verbatim. A wrapper fixes its arity (a caller that hands it more — an event, a `map` index — must not pass that on
    to the import) and its own signature is what the template is typed against.
  (The first waves wrote some of these the other way — a `computed` round a bare constant, an alias for a wrapper whose
  signature is identical. Both are right at run time and stay; a NEW conversion follows this table.)
- **A member named like a GLOBAL the template compiler allows** (`Math(): Math { return Math; }`, `Number`, `Date`,
  `JSON`, `Object`, `parseInt` …) was never read — the compiler does not prefix those names: delete it.
- **A member NOTHING reads** is dropped — as a local it would be an unused one — and NAMED in the commit message: a
  data field no template, script or spec names; a method no template, parent or spec calls; a computed only a
  commented-out line names; a field that is WRITTEN and never read (`shown = true` — it goes with its writes); and a
  TYPE nothing names any more (the `type Data` that only annotated `data(): Data`, the `Refs` of a `typedRefs` idiom —
  R4, R11) with the imports only it used. An EXPORTED type stays (R25: somebody imports it).
- **The `vue` import**: `defineComponent` goes; `PropType` and the other type imports stay as the file had them (a plain
  named import — `import type` is not required); add what the script now calls. **Import ORDER is free** — keep the
  file's; only the order of DECLARATIONS above is part of the recipe.
- **Comments travel with their construct**: the JSDoc of a prop, a data field, a computed, a method, a watcher moves
  with it, verbatim. A comment that DESCRIBES THE OPTIONS FORM («Vue unwraps an injected ref…», «mirrored in data() so
  the path watcher resolves») is rewritten to say what is true now.
- **Bodies keep their shape**: a computed / method body with statements stays a block (`computed((): T => { …; return …; })`);
  a local alias taken for type narrowing stays.
- **A name collision.** Options had separate namespaces (`methods`, `$refs`, props); `<script setup>` has ONE scope.
  · A member named like a TEMPLATE REF KEY (`methods: {explorer()}` beside `ref="explorer"` — the sheet prints «REF KEY
    = MEMBER NAME»): the template ref takes the key's name (`const explorer = useTemplateRef('explorer')`), the member
    takes an internal one and keeps its PUBLIC name where it is public — `defineExpose({explorer: hostedExplorer})`.
    Never leave a non-ref binding named like a ref key: Vue warns «Template ref "x" used on a non-ref value» on every
    mount and the ref does not work in a production build.
  · A new local that would shadow a prop or an import (a root ref beside a prop `root`): the LOCAL is renamed
    (`rootEl` — `useTemplateRef('root')` takes the attribute's string, the const may be named freely as long as no
    OTHER binding carries the key's name) — never the prop, the emit, the exposed name or the template.
  · A data field or a computed built from an import of the same name (`range: range(23)`, `paths` from `paths`,
    `deckLine() { return deckLine(this.deck); }`): the IMPORT is aliased (`import {range as rangeOf}`), the member keeps
    the name the template uses (`const range = ref(rangeOf(23))`).
  · **A body's own local named like the member it reads** (`const range = this.range;` inside a computed — 119 such
    lines in the client): written literally it is `const range = range.value;`, which reads itself before its
    declaration. The LOCAL takes the suffix `Now` (`const rangeNow = range.value;` — «the value at this moment»), and a
    shorthand property that used it is spelled out (`{gameId: gameIdNow}`); the member keeps its name. A body's local
    that merely SHADOWS a member without reading it (`const caption = captionOf(…)` inside the computed `caption`) is
    legal and stays verbatim. (Wave 2 named some of these locals by meaning — `armedSource`, `liveQuest`; they stay.)
  · A module-level constant named like a member (a table `boardColorClass` beside the computed `boardColorClass`): the
    CONSTANT is renamed in upper snake case (`BOARD_COLOR_CLASS`); the member keeps the name the template uses.
- **Where things go that § 1's skeleton does not show**: `const slots = useSlots()` / `useAttrs()` right after the
  macros; the component's HEADER comment stays where it stood (above the imports, or above the macros where it stood
  above `export default`) — only the R24 block is placed FIRST.

## 2. The recipes

Each row: what it was → what it becomes → ✔ / ✘ under Vapor (the capability fixture) → the trap.

### R0 — unchanged
`$event`, `v-model` on a native element, `v-html`, `v-once`, `v-if` / `v-for` / `v-show`, `:class` / `:style`, event
modifiers. ✔ Vapor (`VaporBasics.vue`). A plain `@click` is a listener on the element in both runtimes — nothing is
delegated to the document (ROADMAP § 3.6).
**`:key` outside `v-for`** (`tpl:key-remount` on the sheet — 172 uses): a forced re-mount (`:key="'in:' + nonce"`
restarts a CSS animation by replacing the node) and a keyed child of a `<Transition>` with no `v-if` (old and new
coexist for the swap). Unchanged at A. ✔ Vapor — a new key is a NEW node, and the keyed child of a `<Transition>`
enters as a new node (`VaporKeyProbe.vue`). *At B:* a unit spec that only reads classes and text cannot see a
re-mount that stopped happening — assert node identity once.

### R1 — `name`, `components`, global components
- `name: 'X'` → `defineOptions({name: 'X'})` (the error report's chain and devtools read it).
- `components: {A, B}` → nothing: an imported component is usable by its import name. A registration under a string
  (`'console-board-input': ConsoleBoardInput`) needs nothing either — `<console-board-input>` resolves to the import
  `ConsoleBoardInput`. A registration under a DIFFERENT name (`{Card: CardFace}`) → import it under that name.
- A component the template uses WITHOUT an import is a GLOBAL registration — exactly three, all ASYNC ON PURPOSE
  (`action-target-card`, `premium-card-face`, `console-source-dock`): import the SAME lazy binding from
  `@/client/components/asyncComponents` (`import {PremiumCardFace} from …` — the tag `<premium-card-face>` resolves to
  it). **Never a static import of the `.vue`**: for the premium face that closes the type cycle PremiumCard →
  CardZoomModal → CardZoomCard → PremiumCard and collapses vue-tsc; the module says why each of the three is lazy. The
  readiness ledger's `global-in-setup` row fails a `<script setup>` component that uses one of the tags without the
  import.
- A wrong `name` (a copy-paste — `ColonySpace.vue` carries `name: 'ColonyRow'`) is kept verbatim: fixing it is a
  change of its own (devtools, the error report's chain and name-keyed stubs read it). ✔ Vapor (a Vapor parent renders vdom children and the
  reverse — `VaporHostsVdom.vue`, every leaf of the pilot).

### R2 — props (`this.x`, `this.$props`)
`props: {…}` → `const props = defineProps({…})` **with the same object** (types, `required`, `default`, validators
intact — nothing to re-derive) — bound to `const props` only when the SCRIPT reads a prop (a bare `defineProps({…})`
otherwise: an unused local fails the type check). An array form `props: ['a']` → `defineProps(['a'])`. In the script a prop is
`props.x`; `this.$props` is `props`. The type-only form (`defineProps<{…}>()` + `withDefaults`) is equally good for a
component written fresh — do not mix the two in one conversion. ✔ Vapor. *Trap:* never destructure `props` at the top
level unless you mean to (`const {x} = props` is reactive-destructured by the compiler in 3.5+, but a `watch(x, …)`
of it is not a source — write `() => props.x`). *Trap:* `defineProps(…)` is HOISTED out of setup — a `default` or a
validator inside it may name an import or a LITERAL module const, never a non-literal local (`const D = make()`):
that one moves into a sibling `.ts` (R25). *Trap (vue-tsc only — the one template edit a type may ask for):* a prop
declared `{type: Object as PropType<T>, default: undefined}` read as `T` in the Options template and reads
`T | undefined` in the `<script setup>` one, which is the truth. A template branch that leaned on the old type gets
the guard its own `v-if` chain already implies (the root says `variant !== 'line' || view !== undefined`, so the
branch becomes `v-else-if="variant === 'line' && view !== undefined"` — nothing changes at run time); say it in the
commit (`console/ConsoleCardAvailabilityPanel.vue`).

### R3 — emits (`this.$emit`, `$emit` in the template)
`emits: [...]` / `emits: {…}` → `const emit = defineEmits([...])` (the same value) — bound to `const emit` only when
the SCRIPT calls it; a component that emits only through the template's `$emit` writes a bare `defineEmits([...])`. `this.$emit('x', a)` → `emit('x', a)`.
`$emit(…)` in the TEMPLATE stays as it is — ✔ in both runtimes (`VaporContextProbe.vue`). A component with
`this.$emit` and no `emits` option declares the list now (read the call sites). ✔ Vapor — `defineEmits` / `emit()`
reach a virtual-DOM parent's listener (`VaporBasics.vue`, `ConsoleForecastDoor.vue`). An emit a parent hears during
the child's unmount is still heard.

### R4 — `data()`
One `ref` per field, in the field's order: `open: false` → `const open = ref(false)`; a typed field
(`undefined as X | undefined`) → `ref<X | undefined>(undefined)`. A field initialised from a prop
(`data() { return {value: this.start}; }`) → `ref(props.start)`. A field that MIRRORS module state
(`consoleState`, `hydroFlow: hydroFlowState`) is not state of the component: delete it and let the template read the
import (under the name the template uses: `const hydroFlow = hydroFlowState;` when they differ).
A field that only hands a module CONSTANT to the template (`noCards: NO_CARDS`) is `const noCards = NO_CARDS` — no
ref; nothing ever writes it.
**Which fields are NOT refs** — the handle rule WINS over «one ref per field»: a field nothing REACTIVE reads (not the
template, not a computed, not a watcher's source, not a spec through `wrapper.vm`) and that is only stored — a timer
id, a cancel / `off()` function, a tween handle — becomes a plain `let`, at the field's place. A registry of ELEMENTS
(`proxyRefs: [] as Array<HTMLElement | null>` filled by a function ref) stays a `ref` unless nothing reactive reads
it — same test.
**A field initialised by calling a METHOD** (`shownText: this.display(this.value)`) → `ref(display(props.value))`: it
works because methods become hoisted `function`s (R7) — but if that function reads a `const` declared LATER (a ref, a
computed), declare that one first (the temporal dead zone is real here; the Options instance had none).
A `data()` that RETURNS A COMPUTED OBJECT instead of a literal (`return hashToModel(location.hash)` — one component,
`cardlist/CardList.vue`) → `const model = reactive(hashToModel(…))` and `const {a, b} = toRefs(model)` for the names
the template and the script read.
**A `data()` with STATEMENTS before its `return`** (a local looked up from a prop, a guard that throws, a value two
fields share): the statements move to the top level in their order, right before the refs they feed; a field built
from an EARLIER field reads that ref's `.value` (`const cursor = ref(indexOf(currentLang.value))`). *Trap:* a guard
that THROWS now throws in setup, and Vue REPORTS a setup error (`errorCaptured` / `app.config.errorHandler` / the
console) where a throw in `data()` unwound the parent's patch — the component then renders with nothing declared and
its siblings are still patched. A spec's ROOT `mount()` still throws (test-utils re-throws what the handler was
handed during the mount), so `expect(() => mount(…)).to.throw()` stays green; the difference shows under an
already-mounted host, and that is where a spec pins it (`turmoil/GlobalEvent.spec.ts`). Say it in the commit.
**The type that only annotated `data(): T`** (`type Data`, `DataModel` — 15 components): its field types go to the
refs that need one (`user: string | undefined` → `ref<string | undefined>(undefined)`; a field whose initialiser
already has the type needs none) and the type itself is dropped (§ 1 — nothing names it any more).
**A field holding a LITERAL nothing ever writes** (`sizes: [16, 24, 32]`) is a plain `const`, by the same rule as a
module constant — nothing writes it, so nothing needs a ref. (A `ref` there is equally correct and stays where a
wave wrote one.)
✔ Vapor. *Trap:* `ref` is deep, as `data` was — keep it; `shallowRef` is a behaviour change, not a conversion.

### R5 — `computed`
`x(): T { return …; }` → `const x = computed((): T => { return …; })` — the body keeps its SHAPE (a block stays a
block, with its comments; do not collapse it to an expression: two converters must produce the same file); a
`{get, set}` pair → `computed({get: …, set: …})`.
`this.other` inside → `other.value`. **The block keeps its order even where a computed reads one declared BELOW it**:
a computed runs when it is first read, after the whole script has been evaluated — only code that RUNS during setup
(a ref's initialiser, an `immediate` watcher, a top-level call) needs what it reads declared above it (R4's note).
✔ Vapor.

### R6 — `watch`, `this.$watch`
`key(now, was) {…}` → `watch(() => <key>, (now, was) => {…})`; `{handler, immediate, deep, flush}` → the same options
as the third argument. The getter of a key: a data field / computed `() => x.value` (or the ref itself, `watch(x, …)`),
a prop `() => props.x`, a PATH key `'a.b.c'` → `() => a.value.b.c` with `?.` wherever the path could be undefined (the
Options path getter tolerated a hole; TypeScript now shows where); when the path's HEAD is a data field that mirrored
module state and was deleted by R4 (`'focusState.ring.deniedEpoch'`), the getter reads the import
(`() => focusState.ring.deniedEpoch`). A string handler (`handler: 'reload'`) → the
function. `this.$watch(getter, cb)` → `const stop = watch(getter, cb)`. An array of handlers → one watch per handler,
in order.
- **Keep the block's order, and put the watchers after the declarations** (§ 1).
- **ONE MUTATION — ONE REACTION** (`CLAUDE.md` § North star; ROADMAP § 3.5): two watchers that read ONE array / Map /
  Set through different facets and whose order matters are merged into one `watch` BEFORE the conversion.
- **Watchers of DIFFERENT sources run in the order their sources were WRITTEN, not in the block's order** — in both
  runtimes (`vueTickOrder.spec`; under Vapor: `VaporKeyProbe.vue` — declared b-then-a, written a-then-b, ran a-then-b).
  For two PROPS that one parent update moves, that order is the parent's — the virtual DOM's prop patch at A, the
  parent's own bindings at B: it is not yours to rely on. A pair of prop watchers whose relative order matters (the
  flip's `value` before `text`) is ONE `watch(() => [props.value, props.text], …)` with the order in its body —
  merged before step B, and said in the commit.
- A watcher's body another member calls becomes a NAMED function both call (`whenXChanges`) — never
  `$options.watch[name].handler` (R14; `ConsoleParliamentSection.reconcileStandingPrompts` is the model).
✔ Vapor: `immediate`, `deep`, `flush: 'post'` (a post watcher reads the DOM the same change wrote —
`VaporContextProbe.vue`), `flush: 'sync'`. The tick's contract is pinned: `tests/client/console/vueTickOrder.spec.ts`.

### R7 — `methods`
Each method → a `function` declaration (hoisted — the order of methods is free). `this.x` by kind (§ 1). A method the
template calls needs nothing; a method ONLY parents call through a ref goes into `defineExpose` (R11). ✔ Vapor (a
function is a function).

### R8 — an existing `setup()`
Its body becomes the top of the script, its returned keys become top-level consts of the same names
(`return {flow: useFlowScope('x')}` → `const flow = useFlowScope('x');` — `this.flow.after(…)` → `flow.after(…)`).
A component whose key is `flowScope` (it already had a `flow` of its own) keeps that name. `useFlowScope`,
`useConsoleSession`, `componentSessionScope`, `useConsoleInput`, `useWorkspaceBandGeometry` bind to the effect scope
and the injection context — none asks for an instance. ✔ Vapor (`VaporFlowProbe.vue`, `VaporShellProbe.vue`).

### R9 — lifecycle hooks
`beforeCreate` / `created` → their bodies at the top level, after the declarations they read. `beforeMount` →
`onBeforeMount`, `mounted` → `onMounted`, `beforeUpdate` → `onBeforeUpdate`, `updated` → `onUpdated`,
`beforeUnmount` → `onBeforeUnmount`, `unmounted` → `onUnmounted`, `errorCaptured` → `onErrorCaptured`.
✔ Vapor — all of them (`VaporFlowProbe.vue`, `VaporContextProbe.vue`): `onBeforeUpdate` / `onUpdated` fire when the
component's own bindings re-ran (there is no re-render, so «updated» is «some binding of mine wrote the DOM»);
`onErrorCaptured` catches a virtual-DOM child's error across the interop boundary. *Trap at B:* a hook body that
relied on `updated` running after EVERY parent re-render (a re-measure) is a `watch` of what it measures instead — say
it in the conversion's commit. *Trap at B (not at A):* a Vapor component removed before it was mounted gets its scope
disposed and no `unmounted` hook — at step B, a cleanup that undoes something done IN SETUP (a registration, a module
flag raised at creation) moves to `onScopeDispose` or a flow scope (`useFlowScope` does both); a cleanup of something
done in `onMounted` stays in `onBeforeUnmount`.

### R10 — `this.$nextTick`
→ `nextTick()` / `await nextTick()` / `void nextTick(() => …)`. Where the tick stands for something else («after the
flight», «once the target exists») it is a kernel wait (`flow.afterFrame`, `scope.wait(until(…))`) — REVIEW.md § 1.
✔ Vapor.

### R11 — template refs (`this.$refs`), and what a parent may reach
- **An element of one's own**: `ref="list"` + `this.$refs.list as HTMLElement` → `const list = useTemplateRef<HTMLElement>('list')`
  and `list.value` — typed `T | null`: `null` until mounted and after a `v-if` took it away. `(this.$refs.x as T | undefined) ?? null`
  is simply `x.value`; keep the guard the code had (`if (el === null) return`), or the `?.`. The template's `ref="list"`
  does not change. Declare it among the first declarations (§ 1). **A `ref="…"` the script never reads** (the sheet says
  «never read in this script») gets NO `useTemplateRef` — leave the attribute (a parent or an e2e may read it); ✔ Vapor,
  an unread string ref is inert (`VaporKeyProbe.vue`).
  **A ref the Options code used with NO guard** where the callee needs an element (`showModal(this.$refs.dialog)`):
  `.value` is `T | null`, so the guard the code relied on is written out — `const el = dialog.value; if (el === null) { return; }`
  — never a `!`, never a cast (the ref is `null` exactly when the Options code would have thrown inside the callee).
  **The `typedRefs` idiom** (`typedRefs(): Refs { return this.$refs as unknown as Refs; }` and `this.typedRefs.dialog`
  — 6 components): each ref it names becomes its own `useTemplateRef<T>('dialog')` with `T` from the `Refs` type's
  member; the computed and the `Refs` type are dropped (§ 1). The sheet reads a ref through the idiom, in the
  component and in its parents.
- **A string ref inside `v-for`** is an ARRAY: `useTemplateRef<Array<HTMLElement>>('rows')` — it follows the list, but
  its order is not guaranteed to be the list's after a reorder. **Where the INDEX matters, the component already uses
  a function ref — keep it** (next bullet); a construct the sheet prints as both `tpl:ref-in-for` and `tpl:ref-dynamic`
  is that function ref, and only the function-ref bullet applies.
- **A function ref / a dynamic `:ref`** (`:ref="(el) => seat(el, i)"`, `:ref="surfaces.bind.x"`) stays — called with the
  element, and with `null` when it leaves, in both runtimes. ✔ Vapor also for a function ref inside a keyed `v-for`
  whose every key changes at once: the new nodes are seated index-aligned (`VaporKeyProbe.vue`).
- **A CHILD COMPONENT**: `useTemplateRef<InstanceType<typeof Child>>('child')` while the child is an Options
  component (its ref is its public instance — every method callable, also from a Vapor parent). **Once the child is
  `<script setup>` its ref is ONLY what it `defineExpose`s** — so a child's conversion starts from its sheet's
  `MUST EXPOSE` line: `defineExpose({handleIntent, stickScroll})`, typed for its parents by an exported type in a
  sibling `<component>Types.ts` when a `.ts` controller reads it (a `.ts` file cannot import a named export of a
  `.vue`). Never expose «everything»: the list is the component's contract with its parents, and the sheet prints it.
  «Nothing — no parent stands a ref on it» / «a ref is held and never read» on the sheet means NO `defineExpose` call
  at all. **Under the list the sheet prints every line of a parent that names the ref — the lines win**: the list is
  what the tool followed (it lists a name only when it IS a member of the component, and it reads names, not scopes: a
  member reached on the VALUE an exposed function returned — `step.explorer().handleIntent(…)` — belongs to that
  value's component), and where it says «nothing the tool could follow», the lines are the whole answer. A parent
  that reads the child's `$el` through the ref keeps working at A (R12 says what it becomes at B). The inventory fails
  on a converted component whose `defineExpose` lacks a member its parents read — that audit runs over the whole tree
  on every run, so a parent written LATER cannot reach into a converted child silently.
  A surface the shell's controllers reach through the registry is typed by name in its `<component>Types.ts` — that
  type IS its exposed list. **What the parent gets**: an object whose keys are
  exactly the exposed names; an exposed FUNCTION is called as before; an exposed REF arrives UNWRAPPED (the parent
  reads `child.root` — the element — with no `.value`); an exposed array of template refs is READONLY in a
  development build (a parent that sorts or splices it copies it first). A `.vue` parent's existing cast
  (`this.$refs.x as InstanceType<typeof Child>`) keeps working with no edit — vue-tsc's instance type of a
  `<script setup>` component carries its exposed members and nothing else, so a member that was forgotten is a
  compile error in the parent.
- **Between SURFACES** a ref is not the way at all: the shell's surfaces stand in the registry
  (`shell.surfaces.at<T>('handSection')` — `console/shell/surfaceRegistry.ts`).
✔ Vapor — every bullet (`VaporRefsProbe.vue`: root, `v-for` array, function ref with `null` on leave, a vdom child's
instance, a Vapor child's exposed object; `VaporBasics.vue` under a vdom parent).

### R12 — `this.$el`
→ a template ref on the root element: `<div ref="root" …>` + `const root = useTemplateRef<HTMLElement>('root')`.
(The one edit a template may need besides R24.) **A parent that reads a CHILD's `$el` through its ref**
(`(this.$refs.dock as {$el?: HTMLElement})?.$el` — the sheet prints `$el ← Parent` in MUST EXPOSE): at step A nothing
changes — the ref of a `<script setup>` child still answers `$el` (`SetupElProbe.vue`); at step B it is `undefined`
(a Vapor child's ref is its exposed object), so the child's step B exposes its root (`defineExpose({root})`) and the
parent reads that — or, better, asks the child for what it wanted the element for. ✔ Vapor.

### R13 — slots and attrs (`$slots`, `$attrs`, `inheritAttrs`)
`$slots.x` / `$attrs` in the TEMPLATE stay as they are (✔ both runtimes). In the script: `const slots = useSlots()`,
`const attrs = useAttrs()`. `inheritAttrs: false` → `defineOptions({inheritAttrs: false})` and the template's own
`v-bind="$attrs"` keeps working. ✔ Vapor (`VaporContextProbe.vue`; fallthrough onto a `v-if` root — `VaporIfRoot.vue`).

### R14 — what has NO target: `$parent`, `$root`, `$forceUpdate`, `$options`, `$data`, `this.$.…`
These are redesigned, not converted — and the readiness ledger counts them (`parent-root`, `instance-internals`), so
none can be added. The forms: an id of the instance → a module counter taken in setup
(`newParliamentDrawHostId()`); «am I unmounted» → a flag set by the component's own `onUnmounted`
(`CardZoomModal.viewerGone`); a watcher's handler called by name → a named function (R6); `$parent` → a prop, an
emit, or `provide` / `inject` (R16); `$root` → the app root's port (R26). What is left in the client: the one `$root`
inside `vueRoot.ts` (the bridge the Options components still call — it leaves with its last caller, R26) and
`ConsoleTeleport`'s `this.$.subTree` (R18).

### R15 — a mixin
→ a composable (a function called in the script that returns refs and functions). The client has ONE mixin
(`PaymentWidgetMixin`) and its one user is a `@deprecated Desktop-only` component: it is deleted by the desktop
deletion waves, never converted. A new mixin fails the readiness ledger.

### R16 — `provide` / `inject`
`provide() { return {k: v}; }` → `provide('k', v)` (after the declarations it hands down); `inject: ['k']` /
`inject: {x: {from: KEY, default: d}}` → `const x = inject<T>(KEY, d)` (among the first declarations — § 1).
- **THE TRAP: the Options API UNWRAPPED a provided ref; `inject()` hands over the ref itself.** Read what the PROVIDER
  provides (the sheet names it: «injects «KEY» ← Provider.vue»). A provided `ref` / `computed` is `x.value` in the
  script (`this.x.card` → `x.value.card`) — the template still reads `x` (top-level refs are unwrapped there). Applied
  literally, `x.card` reads `undefined` and nothing complains: a string key is untyped. Type it at the injection:
  `inject<Ref<Face> | undefined>(KEY, undefined)`.
- **Keep the default EXPLICIT** — `inject(KEY, undefined)`, never `inject(KEY)`: without the second argument every
  instance outside a provider logs «injection not found». A default that was a FACTORY function (the Options form
  called it) is `inject(KEY, factory, true)`.
- Its spec feeds it the provider's REAL shape (`global: {provide: {[KEY]: computed(…)}}`) and asserts it FOLLOWS a
  change — a plain object in the spec stays green over a conversion that is broken in the product.
✔ Vapor in BOTH directions across the interop boundary (`VaporContextProbe.vue` injects what a vdom host provided;
`VaporRefsProbe.vue` provides to an Options child; `VaporKeyProbe.vue` injects a REF and follows its change).

### R17 — custom directives
A `<script setup>` component IMPORTS each directive its template uses, from `@/client/directives/vDirectives` — a
binding named `vXxx` IS the directive `v-xxx`, no `directives:` registration:
`vI18n` · `vTrimWhitespace` · `vEmbedZone` · `vStripActionPrefix` · `vStripEffectPrefix` (that is all of them).
Each is ONE function both runtimes call, so the import line does not change at step B. **An EXISTING import of the
same name from another module is the Options form — re-point it**: `vEmbedZone` from `console/embedZoneRegistry` and
`stripActionPrefix` / `stripEffectPrefix` from their own files are objects of hooks (they work on the virtual DOM at A
and are REFUSED at B); the sheet's `STEP B` line names such an import, and `tests/console/vaporRecipes.spec.ts` fails a
`<script setup>` component that takes a directive from anywhere but `vDirectives`. ✔ Vapor
(`VaporI18nProbe.vue`, `VaporDirectivesProbe.vue`; the same imports on the virtual DOM — `SetupI18nProbe.vue`,
`SetupDirectivesProbe.vue`).
- **A NEW directive is written with `dualDirective({mounted, updated?, unmounted?})`**
  (`directives/dualDirective.ts`): Vapor takes only a function, called once, with the value as a getter, and uses what
  it returns as the cleanup; the virtual DOM takes a function as `mounted` + `updated` only — `dualDirective` gives
  both their three moments. A directive that must follow the element's TEXT subscribes to it itself in Vapor (there
  is no `updated`): `vI18n` and the two strip directives are the models.
- The `directives: {…}` option and the global `app.directive` registrations stay for the Options components that still
  use them and leave with the last one.

### R18 — a render function
A render function stays a virtual-DOM component (it keeps working inside the Vapor app only through the interop
plugin — which V4 removes). The client has ONE component with a `render()`:
**`console/foundation/ConsoleTeleport.vue`** — a wrapper that works around the native virtual-DOM `<Teleport>` (it
never mounts into an absent target) by inspecting its own `subTree`. Its conversion is a REWRITE on the Vapor
`<Teleport>` in wave ② (foundation), specified by its own laws (the header of the file) and its unit + e2e specs —
not a recipe. **The facts it stands on are pinned** (`VaporTeleportLate.vue`): a Vapor teleport whose target is
absent mounts NOTHING and a later patch does NOT throw (the virtual-DOM crash the wrapper exists for is gone); it
never looks for its target again (a target that arrives changes nothing); a RE-MOUNT with the target present, or
`disabled`, places the content. So the rewrite is a TEMPLATE, not a render function: the same «wait for the target»
loop (already a flow scope's timers), and `<Teleport v-if="targetStands" :key="generation" :to :disabled>` — the
wrapper keeps its three public laws and loses `subTree`. The three other `h(` uses are spec hosts and `vueRoot.ts`.

### R19 — i18n (`$t`, `v-i18n`, `this.$t`)
`$t(…)` in the template → the template is unchanged; the script gains `import {$t} from '@/client/directives/i18n'`
(added to the import from that module when the script already has one).
`this.$t(…)` → `$t(…)`. `v-i18n` / `v-trim-whitespace` → R17's import. ✔ Vapor (`VaporI18nProbe.vue`: the
translation is on screen at the first frame and follows a change).

### R20 — `v-model` on a component
Not used in the client (0). If one appears: `defineModel()`.

### R21 — `<Transition>`, `<TransitionGroup>`, `<Teleport>`, `<component :is>`, `defineAsyncComponent`
Unchanged — with ONE exception. ✔ Vapor (`VaporTransitionProbe.vue`, `VaporTeleportProbe.vue`, `VaporBasics.vue`; a
vdom async wrapper loads a Vapor component). *At B, in a unit spec:* a Vapor `<Transition>` is the real one
(test-utils' `transition` stub is virtual-DOM only) and needs a frame source — `tests/client/vapor/lendFrames.ts`.
- **`<component :is>` fed a STRING that names a component** (`tpl:component-is-string` on the sheet — a table
  `Record<Tab, string>` of `'EndgameOverviewTab'`-like names): the string resolved through the `components:`
  registration, and `<script setup>` registers nothing by name — left as it is, the tag renders as an unknown element
  (`<endgameoverviewtab>`). The table maps to the IMPORTED COMPONENTS themselves (`Record<Tab, Component>`), the
  computed's type follows, and a spec that compared the name compares the component. A string naming a NATIVE tag
  (`:is="'section'"`) is unchanged. *Trap:* the type is `import type {Component} from 'vue';` on a line of its own —
  beside a `<component>` tag a plain `import {Component}` reads to the SFC compiler as the template's binding, a
  development build returns it from setup, and the bundler warns «export 'Component' was not found in 'vue'»
  (`endgame/EndgameResultsOverlay.vue`).

### R22 — `<KeepAlive>`, `<Suspense>`
Not used in the client (0).

### R23 — `v-memo`
Step A: keep it. Step B: delete it (the Vapor compiler ignores it with a warning — an update is already per binding).
11 uses in 2 components.

### R24 — the root, and the comment before it
- **The template STARTS WITH ITS ROOT.** A `<!-- … -->` that opens the template (270 components have one) moves into
  the script block — at step A already: a `/* … */` block, FIRST in the script, its text verbatim, closed by the one
  line `(This comment opened the template; the template starts with its root now.)`. Several comments before the root
  become one block, a paragraph each. **A comment AFTER the root is the same defect** (`tpl:trailing-comment` on the
  sheet — a second top-level node) and moves the same way, closed by `(This comment closed the template, after its
  root; the template ends with that root now.)`. **So is a comment BETWEEN two roots** (`tpl:inter-root-comment` — the
  branches of a root `v-if` chain, the roots of a multi-root template: a development build folds it into the branch
  after it, which becomes a fragment). It moves by what the root AFTER it is:
  · a native element or a `<template>` whose content is elements → INTO that root, as its first child, on its own
    line(s) (it stays beside the branch it explains; inside a root a comment is harmless, and inside a `<template>`
    branch it is the same node it already was);
  · a component, `<component>`, `<slot>`, a root with `v-html` / `v-text`, or an element holding inline TEXT (a first
    child on its own line would add whitespace to the text) → the script's block, under a line naming the root
    (``— before the root `<span v-else class="…">`:``), the block closed by `(These comments stood between the
    template's roots; each names the root it stood before.)`.
  Comments INSIDE a root stay where they are. A comment in the template that describes the Options form («registered
  globally in main.ts») is corrected like a script comment (§ 1). **A comment of the FILE, above `<template>`** (the
  `@console-shared` banner of 13 files) is no node of the template: it stays where it is. ✔ Vapor once
  moved. (The first conversions marked the moved block three different ways; that is cosmetic and stays.) In a Vapor component a development build keeps the
  comment, the root becomes a fragment, and the attributes a parent lets fall through are dropped (dev and unit specs
  only — production strips comments); guarded by `tests/console/vaporReadiness.spec.ts`.
- **Several roots** (14 components): attributes do not fall through to a multi-root component in either runtime —
  nothing changes; a `v-if` / `v-else` chain at the root is ONE root.

### R25 — the script's MODULE level (code outside the component)
**Inside `<script setup>` every top-level statement is SETUP code — it runs once per INSTANCE, not once per module.**
An Options script's statements outside `export default` are on the sheet as `script:module-code` /
`script:module-state` / `script:type-export` / `script:value-export`; what each becomes:
- **A type / an interface** (exported or not) stays in place — `export type` is allowed in `<script setup>`, and so
  is the re-export of an imported type (`export type {TenderCardState};`). The one type that goes is the one nothing
  names after the conversion (§ 1: the `data(): T` annotation, a `typedRefs` idiom's `Refs`).
- **A constant and a pure helper** (`const FLIP_MS = 940`, a frozen table, a regex, a function that reads only its
  arguments) STAYS: it is re-created per instance, which changes nothing but allocation. Moving a table to a sibling
  `.ts` is an optimisation — taken on a profile's evidence, in a commit of its own, never inside a conversion (two
  converters must produce the same file, and «mounted many times» is not something a sheet can measure). It is now a
  setup binding the template can name (and `wrapper.vm` sees): when it collides with a prop, a field or a computed it
  is renamed in upper snake case (§ 1 — the member keeps the template's name).
- **MODULE STATE must move out** (`script:module-state` — the sheet prints «MODULE STATE»: a `let`, a counter, a
  cache, a `Map` / `Set` / array that is written to, a `reactive` shared by every instance — 34 statements in 25
  components): left in place it would silently become per-instance. It moves to a sibling `.ts` module
  (`<component>State.ts` / `<component>Model.ts`) and is imported. (A second plain `<script>` block beside
  `<script setup>` would also keep it per-module — do not use it: one block per component, and the tools read one.)
- **A VALUE export** (`export const`, `export function`, an enum — 10 in 8 components; «VALUE EXPORTS» on the sheet)
  is not allowed in `<script setup>`: it moves to a sibling `.ts` and its importers are re-pointed in the same commit.
  A type a `.ts` module imports from the component lives in that sibling too (plain tsc sees a `.vue` only through
  the shim).
✔ Vapor (the compiler treats the module level the same way).

### R26 — the app root (`vueRoot(this)`)
Nine components reached the application's root through their own instance — `vueRoot(this)` (`components/vueRoot.ts`
reads `this.$root`): the busy flag of the server request, the game the lobby loaded and the screen it lands on,
in-app navigation, the panels' visibility memory, the running game's view. The sheet prints it as `this:vueRoot`
(the helper hid it from the `$root` row for a whole wave). `<script setup>` has no instance to start from and a Vapor
component has none at all, so the root comes DOWN:
- **`const root = useAppRoot();`** (`@/client/components/appRoot` — among the first declarations, § 1) and
  `vueRoot(this).x` → `root?.x`. `App` provides the port (`provide()` → `APP_ROOT`); the port is the INTERFACE
  `AppRoot`, never the App component's type — today App's own instance satisfies it, when App is rewritten it
  provides an object of its refs and functions, and no consumer changes.
- **`root` is `undefined` outside the application** (a unit mount, a playground, a stand) — the component says what
  it does then, in the conversion: a READ takes the neutral answer (`root?.isServerSideRequestInProgress === true`,
  `root?.getVisibilityState(k) ?? false`), a WRITE is guarded (`if (root !== undefined) { root.game = …; }`). That is
  what `$root` of a bare mount did field by field (it answered `undefined`), now written down.
- **A member the port lacks is ADDED to `AppRoot`** (typed as narrowly as the need, `readonly` unless the consumer
  writes it) — `provide()` in `App.vue` assigns `this` to the interface, so vue-tsc proves App has it. The port is the
  list of what the tree may ask of its root: keep it short enough to read.
- **Its spec provides the port's slice** — `global: {provide: {[APP_ROOT as symbol]: {isServerSideRequestInProgress}}}`
  — where it used to feed `$root` through `global.mocks`, `global.mixins` or a `parentComponent`; a reactive fake
  (`reactive({…})`) when the spec asserts the component FOLLOWS the root; and one test with no root at all.
- The readiness ledger's `root-through-instance` row counts the `vueRoot(` call sites that are left (frozen per file,
  none may be added); `vueRoot.ts` is deleted with the last one.
✔ Vapor (`provide` / `inject` across the interop boundary in both directions — R16's rows). Models:
`common/AppButton.vue` (a read), `LoadGameForm.vue` (a write), `turmoil/Turmoil.vue` (two calls).

## 3. The unit spec of a converted component

- **Step A (`<script setup>`, virtual DOM):** `mount(Component, …)` works as before; `wrapper.vm.x` still reaches the
  setup state in a test build. A spec that called a method through `wrapper.vm` keeps working; a spec that set
  `data` through `setData` writes the ref instead (`wrapper.vm.open = true`). **A spec that seeds state through the
  MOUNT option `data()`** (`mount(C, {data() { return {discordClientId}; }})`) stays green: test-utils wraps `setup`
  and writes those keys into the refs it returned — AFTER setup ran (the Options API merged them before anything read
  them). The template and a computed see the seeded value; a ref INITIALISED from that field, or an `immediate`
  watcher, has already read the component's own — such a spec seeds through a prop or the module instead. (Not at
  step B: a Vapor component returns no setup state.) **`stubs` keep working, keyed as
  before**: test-utils matches a stub by the name the template uses (the import's name — also when the child's own
  `name` differs: `import Card from '…/CardFace.vue'` is stubbed as `Card`) and by the child's own
  `name` — also for a parent's spec that stubs THIS component (`stubs: {ConsoleFlipValue: true}`).
- **Three things a new spec trips on**: a state the component sets in `onMounted` reaches the DOM on the NEXT render
  (`await nextTick()` after `mount` before reading it); a value handed over by `setProps` reaches a stubbed child as
  test-utils' reactive VIEW of it (assert `deep.eq`, not identity — a mount-time value is the object itself); and the
  sheet's two spec lists are not the same thing — «import it» are the component's own, «NAME it» are its parents'
  (they stub it or find it): re-run both, assert in the first.
- **What it EXPOSES is asserted through a parent's ref, never through `wrapper.vm`** (which sees the whole setup state
  and stays green with `defineExpose` missing): mount it under a tiny host that holds `ref="child"` and assert
  `Object.keys(host.$refs.child)` equals the sheet's `MUST EXPOSE` list, then call each member.
- **A component fed by an injection** is mounted with the provider's real shape (R16).
- *Trap:* `wrapper.findComponent(Stub as any)` resolves to the DOM overload and fails `build:test` on `.props()` —
  pass the stub component uncast (declare it with `defineComponent`). `findAllComponents(Stub)` called on a DOM
  wrapper (the result of `w.find(…)`) types its items as `any` — call it on the component's own wrapper.
- **`global: {mocks: {$t}}` no longer reaches a converted component** — it imports the real `$t`. A spec stays green
  where the real `$t` returns the key (English is the key); a spec that asserted a MOCKED translation sets the
  translations instead (`window._translations` + `PreferencesManager` — `vaporCapability.spec.ts` shows the form).
- **A spec that REPLACED a method through `wrapper.vm` to intercept an internal call** (`wrapper.vm.reloadWindow = stub`)
  no longer intercepts it: inside `<script setup>` the caller reaches the hoisted function directly. The seam becomes
  explicit — the side effect is a function of a MODULE the component imports and the spec stubs there (or the spec
  asserts the effect itself). Say which in the commit.
- **The new spec's path**: `tests/client/components/<the component's path>/<camelCaseName>.spec.ts`; when that name is
  already the spec of a model module (`hydroReward.ts` ↔ `HydroReward.vue` — one file on a case-insensitive disk),
  the component's spec is `<camelCaseName>Component.spec.ts`. **A spec already named after the component**
  (`CardRowComponent.spec.ts`, `GameHome.spec.ts` — the same file as the path rule's on a case-insensitive disk) IS
  its spec: when all it asserts is «mounts without errors» / `wrapper.exists()` — the shape of the upstream specs —
  the conversion ADDS its 2–4 assertions to that file (what it renders for its props, what it emits, what it
  exposes), never a second file beside it. A spec that mounts the component only through a PARENT and never asserts on
  it is not its spec, and the component still gets its own.
- **The three `asyncComponents` bindings in a spec** (R1): a `stubs` entry keyed by the import's name
  (`PremiumCardFace`) does NOT match — the binding answers to the name `AsyncComponentWrapper`, which is the stub's
  key; a spec that used to feed the tag through `global.components` (the real `PremiumCard` as `premium-card-face`) is
  ignored by a converted component, which renders the lazy binding — resolve it once per suite (`before`: mount →
  `await flushPromises()` → unmount) and the mounts after it render the face at once.
- A comment in an existing spec that describes the pre-conversion template («the template opens with a comment node…»)
  is corrected in the same commit.
- **Step B (Vapor):** `mount(<the component>)` as the ROOT throws — stand it under a virtual-DOM host with an ELEMENT
  root (`mountVapor` in `vaporCapability.spec.ts`; `card/CardDescription.spec.ts` is the shipped model). DOM finders
  work; `findComponent` into a Vapor child does not; **`stubs` do not reach the children of a Vapor component** —
  assert on their real output. The interop plugin is installed for every mount by `bundleSetup.ts`.
- A component that had no spec gets one in its conversion's commit: what it renders for its props, what it emits,
  what it exposes. At B: `setProps` goes through the host's reactive props; the root's classes are read off the DOM.

## 4. What the tools guarantee

| Tool | What it answers |
| --- | --- |
| `node scripts/vapor/inventory.mjs` | every construct of every component, with its recipe id — fails on one with no row, and on a CONVERTED component that does not expose a member its parents read through a ref |
| `node scripts/vapor/inventory.mjs --component <path>` | ONE component's sheet: constructs, MUST EXPOSE + every parent line that names its ref, who mounts it, the specs that import it and the specs that name it |
| `node scripts/vapor/inventory.mjs --wave` | the worklist, lightest first |
| `node scripts/vapor/template-diff.mjs <base rev>` | «the template does not change», checked: every template line that differs — comments aside — in a component converted since `<base>`; exits 1 on a file not named with `--allow`. Run once per wave, before its commits: each line is one of the three licensed edits (R24 · R12 · R2's guard) or a mistake to put back |
| `npm run ready:vapor` · `tests/console/vaporReadiness.spec.ts` | what the target has no place for — frozen per file, a new file starts at zero, a Vapor component stays Vapor |
| `tests/client/vapor/vaporCapability.spec.ts` | what Vapor TAKES on the pinned release — every ✔ above; re-read on every bump (ROADMAP § 3.8) |
| `tests/console/vaporRecipes.spec.ts` | the book is complete: no construct without a recipe, no recipe id without its section |
| `tests/console/vueReactivityContract.spec.ts` · `tests/client/console/vueTickOrder.spec.ts` | the reactivity and the tick order a conversion may rely on |

## 5. The worked examples (real components, shipped)

The first three were written by the architect of the pilot. **The six at step A were each converted by a fresh agent
given nothing but this book and the component's sheet** — the test of «by analogy»; what they had to guess became the
paragraphs above that name them.

| Component | Step | The rows it shows |
| --- | --- | --- |
| **WAVE 1 — 118 leaves** (2026-11-13; `git log --grep "V3 wave 1"`) | A | fifteen agents, eight components each, the book and the sheet only: 112 converted with ZERO vue-tsc errors, 6 skipped by rule («do not improvise») and converted after their gaps became the paragraphs of § 1 that name them |
| **WAVE 2 — the next 118** (2026-11-13; `git log --grep "V3 wave 2"`) | A | twenty agents, six components each: 109 converted at once, 9 skipped by rule and converted in the SAME wave after their gaps became paragraphs — the app root's port (R26: `common/AppButton.vue`, `LoadGameForm.vue`, `turmoil/Turmoil.vue`), the `typedRefs` idiom and a ref used with no guard (`common/ConfirmDialog.vue`), a `data()` with statements and a guard that throws (`turmoil/GlobalEvent.vue`), `<component :is>` fed a string (`endgame/EndgameResultsOverlay.vue`), a pane six siblings share one ref with (`console/ConsoleOvTab*.vue` — `defineExpose({nav, primary})`), comments between roots (`card/CardZoomCard.vue`, `marsbot/BotReviewLineContent.vue`) |
| `console/foundation/ConsoleWsHead.vue` | A | R1 R2 R5 R13 R19 R21 R24 — the workspace header: six computeds, `$slots` in the template, a keyed `<transition>` child, the header comments |
| `console/ConsoleFlipValue.vue` | A | R2 R3 R4 R6 R7 R8 R25 — data from a method, a stored handle as `let`, `useFlowScope`, two prop watchers, a module-level `export type` |
| `console/parliament/ConsoleParliamentDrawStage.vue` | A | R1 R5 R9 R17 R19 R24 — `v-embed-zone` re-pointed to the dual binding, `onBeforeUnmount`, a vdom child |
| `console/parliament/ConsoleParliamentEffectsStep.vue` | A | R11 — a component its parents reach through a ref: `defineExpose` from the sheet's list, a child ref of its own |
| `premiumCard/PremiumFleetMark.vue` | A | R16 — `inject` of a provided COMPUTED (the unwrap trap), typed at the injection |
| `console/cardDeal/ConsoleCardDealLayer.vue` | A | R4 R6 R11 — a function ref inside `v-for`, an element registry, two exposed functions three parents call |
| `card/CardDescription.vue` | B (Vapor) | R1 R2 R19 R24 — `v-i18n` over an interpolation, many instances per screen |
| `console/ConsoleForecastDoor.vue` | B (Vapor) | R1 R2 R3 R13 R24 — an emit four vdom hosts listen to, fallthrough, vdom children |
| `marsbot/BotReviewEdgeNotice.vue` | B (Vapor) | R1 R4 R19 R21 — a `<Transition>` over module state |
| `console/shell/useConsoleShell.ts` + `ConsoleShell.vue` | composition | R6 R8 R9 R11 at the scale of the shell — a reactions table, a port with no instance, a surface registry (`VaporShellProbe.vue` is its shape under Vapor) |

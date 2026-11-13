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

**THE BOOK, APPLIED MECHANICALLY — `node scripts/vapor/convert.mjs <component.vue> [--write]`.** The codemod reads
the script through TypeScript's AST and the template through the compiler and writes what § 1 and the rows below
describe; it REFUSES what has no mechanical form (module state, a value export, a bare `this`, `$refs` as a whole, a
ref key named like a member — each is one pre-edit of the Options form, by its row, after which it converts) and
prints one REVIEW line per place a person must look at (an injected ref, a path watcher, a handle, a member it
dropped, an import it aliased). Its corpus is the waves: run over the Options form of every component waves 1–2
converted by hand it writes the same script for four in five and differs on the rest only where two readings of a
rule shipped (`tm-arch-tools/cm_corpus.py`). From wave 3's tail on, a conversion STARTS from its output: the codemod
converts, `eslint --fix` re-indents, the converter reviews the REVIEW lines against the original and writes the spec.

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

watch(() => props.value, (now, was) => { … }, {immediate: true});  // R6 — LAST among the declarations, in the block's order
// (the `created` body — R9 — here: AFTER the watchers, as the Options API ran it)
onMounted(() => { … });                                            // R9 — hooks after the watchers
onBeforeUnmount(() => { … });
defineExpose({toggle});                                            // R11 — exactly the sheet's MUST EXPOSE list
</script>
```

Why the order: an Options component created its watchers AFTER `data`, `computed` and `methods` existed; an
`immediate` watcher written above a `const` it reads would hit it before its declaration. Declarations first, watchers
after them in the `watch` block's own order, then the `created` body, hooks last — the same creation order the
component had: **the Options API created the watchers — and FIRED the `immediate` ones — BEFORE it called `created()`**
(a `created` body written above them would let an immediate watcher see the state `created` set, where it used to
see the initial one and then the change).

Inside the script: a data field / computed is `x.value`, a prop is `props.x`, a method is `x(…)`, **an injected ref is
`x.value`** (R16), `this` does not exist. In the template nothing changes — refs are unwrapped, props and functions are
reached by name.

House rules of a conversion (so two people — or a person and a codemod — produce the same file):
- **A MEMBER THAT ONLY HANDS AN IMPORT TO THE TEMPLATE IS DELETED — the import is the template's binding.** The
  Options API needed a member for everything a template names; `<script setup>` does not. («Import» here is any
  MODULE-LEVEL name: an import, a constant or a function of the same script — `logos() { return logos; }`,
  `data() { return {SVG_W}; }`, `methods: {textOf}` over a module function — and what `setup()` returned under its
  own name, `return {promptSequenceState}`.) The deleted member's comment goes with it when it described the
  hand-over («exposed to the template…»); a comment about the VALUE moves onto the import / the declaration. An
  import that only the deleted member used goes too. Under the import's OWN name
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
  R4, R11) with the imports only it used. An EXPORTED type stays (R25: somebody imports it). **A drop CASCADES**:
  what only the dropped member read goes with it — a `setup()` key, a module constant, an import (each would be an
  unused local) — and is named beside it.
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
    **A COMPUTED or a DATA FIELD named like a ref key** (`ref="sitting"` beside the computed `sitting` the template
    binds) is the other case, and the answer is the opposite one: the MEMBER keeps its name — the template reads it,
    and the template does not change — and the ref's const is `<key>El` (`const sittingEl = useTemplateRef('sitting')`).
    It is right because the member is a ref and the runtime never writes an element into a binding whose key
    `useTemplateRef` holds (`isTemplateRefKey` — the string shape of a development build and the `ref_key` shape of
    an inline production template alike; pinned in both by `tests/client/vapor/refKeyTwin.spec.ts`). The codemod
    writes the twin and says so in a REVIEW line.
  · A new local that would shadow a prop or an import (a root ref beside a prop `root`): the LOCAL is renamed
    (`rootEl` — `useTemplateRef('root')` takes the attribute's string, the const may be named freely as long as no
    OTHER binding carries the key's name) — never the prop, the emit, the exposed name or the template.
  · A data field or a computed built from an import of the same name (`range: range(23)`, `paths` from `paths`,
    `deckLine() { return deckLine(this.deck); }`): the IMPORT is aliased (`import {range as rangeOf}`), the member keeps
    the name the template uses (`const range = ref(rangeOf(23))`). The same for a METHOD with its own signature
    over an import of its name (`seatSourceOf(seat)` over `seatSourceOf(color, viewer, …)` — verbatim it would
    recurse); a name that already ends in `Of` takes `Fn` (`seatSourceOfFn`).
  · **A body's own local named like the member it reads** (`const range = this.range;` inside a computed — 119 such
    lines in the client): written literally it is `const range = range.value;`, which reads itself before its
    declaration. The LOCAL takes the suffix `Now` (`const rangeNow = range.value;` — «the value at this moment»), and a
    shorthand property that used it is spelled out (`{gameId: gameIdNow}`); the member keeps its name. A body's local
    that merely SHADOWS a member without reading it (`const caption = captionOf(…)` inside the computed `caption`) is
    legal and stays verbatim. The same suffix for a local named like the TEMPLATE REF it reads
    (`const root = this.$refs.root` → `const rootNow = root.value`) and for a local built FROM the member
    (`const players = this.players.map(…)` → `playersNow`): one rule, whatever the local holds. (Wave 2 named some of these locals by meaning — `armedSource`, `liveQuest`; they stay.)
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
- A component that renders ITSELF (`premiumCard/PremiumMechNode.vue`) imports nothing: its own tag resolves through
  its file name / `defineOptions({name})`.
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
`$emit(…)` in the TEMPLATE stays as it is — ✔ in both runtimes (`VaporContextProbe.vue`). **A component with NO
`emits` option that emits only through the template's `$emit`** gets no `defineEmits` at all — its surface is unchanged.
**An UNDECLARED event named like a native DOM event** (`click`, `input`, `focus`, `close` …) is the one place where
declaring changes behaviour: undeclared, the parent's `@click` ALSO falls through onto the root as a native listener
(and runs twice when the component emits `click` too); declared, only the emit reaches it. Where the script itself
calls `this.$emit('click')` the declaration is unavoidable (there is no `emit` without the macro): read the parents
first, and say what changes in the commit. (`tm-arch-tools/emits_audit.py` found none in waves 1–2; wave 3 kept
`logpanel/LogMessageComponent.vue` undeclared for exactly this.) A component with
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
it — same test. (A handle is told by what it IS, not by how its type is spelled: an object that is its own cancel — an animation
hold with `release()`, a beat with `kill()`, a `…Handle` an imported alias names — is one, and so is a registry of
them that is filled and never replaced: `{} as Record<string, () => void>` is a plain `const`.) **The rule is for HANDLES** — a function, a timer id, an observer, a tween, an element or a
registry of them: a VALUE nothing reactive reads today (a boolean latch `submitting`, a string compared in a
watcher's body) stays a `ref` — it costs nothing and a spec or the next change may read it. A registry held in a `Map`
/ `Set` that is filled but never replaced is a plain `const`. A `markRaw(…)` round a handle stays verbatim (inert on
a plain variable; «bodies keep their shape»).
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
(`() => focusState.ring.deniedEpoch`); when the head became a plain ALIAS the template still reads
(`state() { return hazardCleanupState; }` → `const state = hazardCleanupState;`), the getter reads through the alias
(`() => state.nonce`) — and an alias ONLY the watcher read is dropped, the getter reading the import. A string handler (`handler: 'reload'`) → the
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

**A watcher written `'key': function(now) {…}`** (or `{handler: function…}`) is the component's own function — Vue
binds its `this` — and converts like the method shorthand. **A path watcher of two hops and more**
(`'deal.state.active'`) is written `() => deal.value.state?.active` and the codemod says so: the Options getter
tolerated a hole at every hop, the type usually has none — drop each `?.` the type does not ask for (a `?.` that
stays makes the source `T | undefined` against the handler's `T`). **A path watcher whose head is an alias of module
state** reads through the alias when the alias stays (the template or the script reads it), and the module state
itself when the alias went.

### R7 — `methods`
Each method → a `function` declaration (hoisted — the order of methods is free). `this.x` by kind (§ 1). A method the
template calls needs nothing; a method ONLY parents call through a ref goes into `defineExpose` (R11). ✔ Vapor (a
function is a function).

### R8 — an existing `setup()`
Its body becomes the top of the script, its returned keys become top-level consts of the same names
(`return {flow: useFlowScope('x')}` → `const flow = useFlowScope('x');` — `this.flow.after(…)` → `flow.after(…)`).
A component whose key is `flowScope` (it already had a `flow` of its own) keeps that name. A key returned under
ANOTHER name (`return {vpWidth: width}`) is renamed where it is taken (`const {width: vpWidth} = useConsoleViewport();`).
**A setup `ref()` that BINDS a template ref of its own name** (`const viewport = ref<HTMLElement>()` returned beside
`ref="viewport"`) STAYS exactly that — it is already the script-setup form, its `=== undefined` guards keep their
meaning; `useTemplateRef` is for a ref the Options code read through `$refs`. **An `expose({…})` call inside `setup()`**
becomes `defineExpose({…})` with EXACTLY that list: the component's own `expose` is its contract, and it wins over
the sheet — a parent that reads a member which was never on it has always read `undefined` (the inventory names such
a read in `UNEXPOSED_READS`, with the reason; waking it is a fix of the parent, not a conversion). `useFlowScope`,
`useConsoleSession`, `componentSessionScope`, `useConsoleInput`, `useWorkspaceBandGeometry` bind to the effect scope
and the injection context — none asks for an instance. ✔ Vapor (`VaporFlowProbe.vue`, `VaporShellProbe.vue`).
**A `setup()` that returns NOTHING** (it only called a composable — `useConsoleNativeSurface()`): its body is the
top of the script, and that is all. **A `setup()` that returns ONE composition** (`setup(props) { return useConsoleShell(props); }` — the console shell,
a template over a composition root) is taken apart into what the template reads: ONE destructure,
`const {…} = useConsoleShell(props);`, because a `<script setup>` template resolves a name against a top-level binding
and nothing else. The codemod reads the names off the composition's TYPE (a template name, or a string ref key, that
is a key of what it returns). Taking it apart loses nothing only while the composition's object is never replaced and
every member is a ref, a function or a reactive object — the shell's port writes refs only (`shellPort.ts` throws on
anything else). The list keeps itself: a name the template gains fails vue-tsc until it is taken, a name it no longer
reads fails eslint; `tests/console/shellControllers.spec.ts` holds the script to imports, props and that one statement.

### R9 — lifecycle hooks
`created` → its body at the top level AFTER the watchers (§ 1 — the Options API ran it there: an `immediate` watcher
has already fired on the initial state). `beforeCreate` → its body ABOVE every declaration of the component — the state, the
computeds, the watchers (it ran before `data` existed, so it reads none of them; an `immediate` watcher fires on what
it left) — and BELOW what `setup()` did (the Options API called `setup()` first). `beforeMount` →
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
  **The ref's `T` is the type the code CAST it to** — a structural cast stays structural
  (`(this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.()` → `useTemplateRef<{show?: () => void}>('zoomModal')`
  and `zoomModal.value?.show?.()`; `{$el?: HTMLElement}` for a child read only for its element; the three async
  bindings, typed plain `Component`, have no `InstanceType`). Never upgrade it to `InstanceType<typeof Child>` in a
  conversion: the optional call would lose its `?.` and a stub without the member would throw. **A member CALLED on a
  child's ref with no guard** (`this.typedRefs.bugDialog.show()`) takes `?.` where the call is the whole statement
  (`bugDialog.value?.show();`), the early-return guard where more follows.
  **A STRING key bound dynamically inside `v-for`** (`:ref="i === index ? 'selectedRow' : undefined"` — «the row
  that carries the key»; 25 uses, the sheet prints `tpl:ref-dynamic` + `tpl:ref-in-for` and does not list the key):
  `useTemplateRef<HTMLElement | Array<HTMLElement>>('selectedRow')` — it receives an ARRAY of the rows that carry the
  key (one of them), and `[]` when none does; the Options code's cast already took both shapes
  (`as HTMLElement | Array<HTMLElement> | undefined`), so its reading stays (`selectedRow.value ?? undefined`).
  **Three more spellings of the same read**: `(this.$refs.x ?? undefined) as T | undefined` followed by an
  `=== undefined` guard → `x.value ?? undefined`, the guard verbatim; a cast of the WHOLE object
  (`(this.$refs as {zoomModal?: {show: () => void}}).zoomModal?.show()`) → the keyed form
  (`useTemplateRef<{show: () => void}>('zoomModal')`); ONE ref cast two ways (each use named the member it needed) →
  one type holding both (`{a?: …} & {b?: …}`, or the two literals merged). **A COMPUTED key**
  (`this.$refs[ref]`, `ref` one of several names) is followed by the sheet for every child that parent stands a ref
  on — the read is on the printed lines of each of them.
  **A PROP named like a ref key** (`rows` beside `ref="rows"`) is no collision for the template: the prop keeps its
  name, the ref's const takes another (`const rowsEl = useTemplateRef<…>('rows')`).
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
  type IS its exposed list; a controller that types it as `InstanceType<typeof X>` off the component's DEFAULT import
  needs no such file (vue-tsc's instance type of a `<script setup>` component carries what it exposes). The member is
  often read a line BELOW the registry line, or inside the helper the surface is handed to (`handedTo(panel, …)` →
  `surface.handleIntent`): open the controller at the printed line. **What the parent gets**: an object whose keys are
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
→ a template ref on the root element: `<div ref="root" …>` (first on the root's opening line — `template-diff`
sets exactly that attribute aside) + `const root = useTemplateRef<HTMLElement>('root')` (`rootEl` for both the key and
the const when `root` is taken — by a prop, a member, or the app root's port). **`this.$el` used with no guard**
(`this.$el.querySelector(…)`, `scroll.ensureVisible(this.$el.querySelector('.x'))`): `this.$el` existed whenever the
component was mounted, and the ref does too — the mechanical form is the cast, `(root.value as HTMLElement)`, which
fails exactly where `this.$el` would have (the codemod writes it); a hand conversion may write the early-return guard
on `const rootNow = root.value;` instead. Both ship; never `!`.
**…but the cast is right only for a read that runs WHILE THE COMPONENT STANDS** (`onMounted`, `onBeforeUnmount`, a
handler of its own DOM). After an unmount `this.$el` was still the detached element — its `querySelector` answered
`null` — while the ref is `null` and the cast THROWS: a read inside a `nextTick`, a promise, code after an `await`,
an observer, or a getter handed to a module that outlives the component (a flight's target, a zoom origin, a wait on
the session's frames) is **never the cast**. In front of a `querySelector` the form is the null-safe read,
`root.value?.querySelector<T>(…) ?? null` — the same answer while mounted, «not found» after (the codemod writes it
for every unguarded `$el.querySelector`); anywhere else it is the early-return guard, and the codemod prints a REVIEW
line on each cast it leaves. (Measured in wave 4: a carry-over picker's two target getters threw
`Cannot read properties of null (reading 'querySelector')` twice per leave in the cast form, never in the Options
one. `node scripts/vapor/audit.mjs` § B lists every such cast; guard `tests/console/vaporConversionAudit.spec.ts`.)
**`this.$el` WITH a guard keeps its guard — the cast would kill it.** `this.$el as HTMLElement | undefined` followed by
its `=== undefined` test (or handed to a callee that takes `undefined`) → `root.value ?? undefined`, the guard
verbatim; `… as HTMLElement | null` + `=== null` → `root.value`; read through `?.`
(`(this.$el as HTMLElement | undefined)?.querySelector(…)`) → `root.value?.querySelector(…)`;
`this.$el instanceof HTMLElement` → `root.value instanceof HTMLElement` (the narrowing does the rest). The codemod
writes all four. *Two facts the root ref changes, both in the code's favour:* in a DEVELOPMENT build (and so in every
unit mount) the `$el` of a template that opened with a comment was the fragment's ANCHOR, not the element — a
`this.$el instanceof HTMLElement` guard returned early there and the code behind it ran only in production; with the
root ref it runs everywhere (two converted surfaces gained behaviour in unit mounts this way — pinned by their specs).
And `this.$el` outlived the unmount (a detached node) while a root ref is `null` after it: a getter handed to a
module that outlives the component (`slotZoomOrigin(() => this.$el)`) answers «no element» then — the callee's own
guard is the contract.
(The one edit a template may need besides R24.) **A parent NEVER reads a CHILD's `$el` through its ref** — the ref
of a `<script setup>` child still answers it on the virtual DOM (`SetupElProbe.vue`), and a Vapor child's ref is its
exposed object: `undefined`, silently (the whole client flipped lost its fullscreen viewer, the band's rail edge and
every flying tile's proxy that way — ROADMAP § 4c). The contract is ONE name (`src/client/components/rootEl.ts`):
the child puts a template ref on its root element and exposes it — `const root = useTemplateRef<HTMLElement>('root');
defineExpose({rootEl: root /* , …its other members */})`; the parent types its ref `RootElHolder` (or the child's
instance type) and reads `child.value?.rootEl` — the same value in both runtimes (an exposed ref is unwrapped by
either expose proxy); a ref that may hold an element OR a component goes through `rootElOf(held)`. Prefer not needing
it: a parent that wants «the card inside my own stage» asks its OWN element (`CardZoomModal.runSlide` — the child's
root is one of a `v-if` chain's), and one that wants something DONE with the child's element asks the child to do
it. Guard: `tests/console/childRootEl.spec.ts` — no `.$el` under `src/client`, and an exposed `rootEl` is the ref of
the template's first tag. ✔ both runtimes.

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
plugin — which V4 removes). The client has ONE component that renders by function:
**`console/foundation/ConsoleTeleport.vue`** — a wrapper that works around the native virtual-DOM `<Teleport>` (it
never mounts into an absent target). Its four laws are decided in one render over what the PREVIOUS render put on
screen — was a teleport live, was it disabled, does content stand between its anchors — which a template cannot ask.
**Step A (done, V3 wave 4): it is `<script setup>`** — its template is `<TeleportView />`, a functional component of
its own script that holds the render, and what the Options form read off its instance (`this.$.subTree`) is the vnode
that render itself returned last: Vue mounts the very object a render returns, so its `el` / `anchor` / `props` are
the mounted teleport's (the readiness ledger's `instance-internals` row is at zero; its eight unit tests and the
runtime's own warnings are the same before and after). **Step B is a REWRITE on the Vapor `<Teleport>`**, specified
by its laws (the header of the file) and its unit + e2e specs — not a recipe. **The facts it stands on are pinned**
(`VaporTeleportLate.vue`): a Vapor teleport whose target is absent mounts NOTHING and a later patch does NOT throw
(the virtual-DOM crash the wrapper exists for is gone); it never looks for its target again (a target that arrives
changes nothing); a RE-MOUNT with the target present, or `disabled`, places the content. So that rewrite is a
TEMPLATE: the same «wait for the target» loop (already a flow scope's timers), and
`<Teleport v-if="targetStands" :key="generation" :to :disabled>`. The other `h(` uses of the client are spec hosts.

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
  · a component (`<Teleport>` and `<Transition>` among them), `<component>`, `<slot>`, a root with `v-html` / `v-text`, or an element holding inline TEXT (a first
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
  (camelCase, beside the component: `<component>State.ts` for what is WRITTEN, `<component>Model.ts` for a table or a
  pure helper) and is imported. A COUNTER is taken through an accessor (`let uid = 0; export function newPlayerCubeUid()`
  — an imported `let` cannot be written; R14's `newParliamentDrawHostId()` is the model); a container (a `Map`, a
  `reactive`) is exported as itself. A `const` container NOTHING WRITES (`const SIMPLE: ReadonlySet<…> = new Set([…])`)
  is a table, not state: it stays (the sheet prints MODULE STATE only for what the script mutates). A plain `let`
  HANDLE a component function reads and writes (an `AbortController`, a cached promise) moves TOGETHER WITH THE CODE
  THAT OWNS IT, behind one function (`replaceLogRequest()` — `logpanel/logPanelState.ts`; `loadChart()` —
  `gameend/victoryPointChartState.ts`): the component calls the function and never sees the handle.
  **A module-level `defineAsyncComponent(…)` is identity-bearing state too** (its resolved-component cache would be
  per instance — every re-mount would await the loaded chunk again): it moves to a sibling module on the model of
  `components/asyncComponents.ts`, typed `Component` (`console/menu/consolePlaygroundHubAsync.ts`). (A second plain `<script>` block beside
  `<script setup>` would also keep it per-module — do not use it: one block per component, and the tools read one.)
- **A VALUE export** (`export const`, `export function`, an enum — 10 in 8 components; «VALUE EXPORTS» on the sheet)
  is not allowed in `<script setup>`: it moves to a sibling `.ts` and its importers are re-pointed in the same commit.
  A value RE-EXPORT (`export {HYDRO_PICK_COPY};`) is the same construct: when nothing imports it through the `.vue`
  the line is deleted, otherwise its importers take the value from the module it came from.
  A type a `.ts` module imports from the component lives in that sibling too (plain tsc sees a `.vue` only through
  the shim).
✔ Vapor (the compiler treats the module level the same way).

**An object literal that is WRITTEN is state too** (`const ctx: SceneCtx = {beatHandles: []}` with
`ctx.sceneHandle = …` in the script — the tools' stateful test reads the initialiser's first token and takes it for a
table): it moves like a container, exported as itself. **A type the moved state needs that a `.vue` declares** moves
with it into the sibling (a `.ts` cannot import a type through the `.vue` shim — plain `tsc`, the production build,
does not see it); when the type belongs to ANOTHER component, the sibling spells the shape structurally and says so.

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
- **The transport's lifecycle owner takes the root as the TRANSPORT drives it** — `useTransportRoot()`: the same
  provided object, read through the contract the transport declares for itself (`TransportRoot`). The one cast
  (`vueRoot(this) as unknown as TransportRoot` — the root satisfies that contract by lifetime, not by type) lives in
  `appRoot.ts` with its reason, never at a call site. With no root there is no transport to start
  (`console/ConsoleBoardBinder.vue`).
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
- **A slot in a spec is a render function** (`slots: {default: () => h('i')}`) — a STRING slot throws in this build
  («"prefixIdentifiers" option is not supported»). **A stub of an `asyncComponents` binding** is keyed
  `AsyncComponentWrapper`: neither the import's name nor the kebab tag the Options-era spec used
  (`'console-source-dock'`) matches.
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
- **A spec that runs a member OFF THE OPTIONS OBJECT against a stub `this`**
  (`(Component as …).computed.x.call(stub)`, `.methods[name].call(stub, …)`, `.watch[key].call(stub, now, was)` —
  eight specs of the console's largest surfaces: the point is WHAT the member decides, not the mount) has nothing to
  take from a `<script setup>` component. The seam becomes a MODULE — where the north star wants the logic anyway —
  and ONLY the members the spec runs move:
  1. the sibling module `<componentCamelCase>Logic.ts` gets a PORT type — exactly the fields those bodies read, write
     and call, each with its type (`$nextTick` keeps its name when the stub provides it; the template refs a body
     read are ONE field `refs` — never `$refs` in a `.ts`, the readiness ledger counts that spelling — and the stub's
     key follows) — and one
     exported function per member: its Options body VERBATIM with `this` → `self`
     (`export function taskDecline(self: TaskDeclinePort): … {…}`; a watcher's handler gets a name —
     `whenTradeLiveChanges(self, now, was)`). A moved body that calls another moved member keeps calling it THROUGH
     the port (`self.closeStage()`): that is what lets the stub intercept it.
  2. the converted component builds the port ONCE, right under the macros — an object of ACCESSORS and arrows, never
     of values (it is read lazily, so it may stand above the declarations it names):
     `get warm() { return warm.value; }, set warm(now) { warm.value = now; }` for state a body writes; a bare getter
     for a prop, a computed, a template ref (`get refs() { return {supportMode: supportModeEl.value ?? undefined}; }`);
     `closeStage: (...args) => closeStage(...args)` for a function — and each moved member becomes its delegate:
     `const taskDecline = computed(() => taskDeclineOf(port));` ·
     `function serveStandingQuestion() { return serveStandingQuestionOf(port); }` ·
     `watch(source, (now, was) => whenTradeLiveChangesOf(port, now, was));` (the import takes the `…Of` alias where
     the member keeps the name — § 1).
  3. the spec keeps its stub, its laziness and every assertion; only the reach changes —
     `host.taskDecline.call(self)` → `taskDecline(self)`.
  The order of the work: the codemod converts the component FIRST; the bodies are then moved from the ORIGINAL
  Options source (`git show HEAD:<path>` — they already say `this.x`, nothing is un-converted by hand) and the
  converted copies become the delegates. The module goes under EXTRA, the moved members are named in the report.
  *What moves with a body:* its JSDoc (the delegate is bare); a module-level helper or a type it calls and a `.ts`
  cannot import from the `.vue` (`textOf`, a `ChoiceEntry` — the component imports back what it still uses); a type
  the PORT names that the `.vue` declared (`DraftZone`). *The port's type* may be ONE type per component with a
  `Pick<…>` slice per function — each function still says exactly what it reads. A union-typed port field costs the
  spec's stub an `as const` (`zone: 'buy' as const`), which is the stub being honest, not a changed assertion. Where
  the component already has a helper named `xOf`, the delegate's import takes `xFn` (§ 1's fallback). The model:
  `console/consoleTaskHostLogic.ts` (32 members, six specs) and `console/draft/consoleDraftWorkspaceLogic.ts`.
- **SOURCE GUARDS — the specs that read the component's TEXT.** Server-runner specs outside `tests/client`
  (`tests/console/*.spec.ts` mostly) read a `.vue` by path and slice it by its Options form — a member's 4-space
  indent, `this.x`, a `watch` key's signature. Nothing compiles against that text: a conversion turns such a guard
  red or, worse, BLIND (an anchor behind `if (at >= 0)` that no longer matches passes forever). The sheet prints
  them («SOURCE GUARDS that read its text»; a guard that reaches the file through a path held in a `src` table is
  found only by grepping `src` for the path). Each is run on the server runner and re-pointed at the new form in
  the conversion's commit — what it asserts stays, and a missing anchor must FAIL. A guard with a TREE-WIDE
  anti-vacuous floor counted in the Options form (`templateRefNullGuard`: «more than 300 normalized `$refs` reads»)
  is the wave's, not a component's: it is re-based on the form the tree now has.
- **A member that reaches a browser global the unit environment lacks** (`CSS.escape` — `setup.ts` exposes jsdom's
  constructors, not its imperative globals): the spec lends `window.CSS` to `globalThis` for that read and takes it
  back (`before` / `after`, or `try` / `finally`); the environment is not widened.
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
- **Step B (Vapor): the spec does not change because the component became Vapor.** The unit bundle compiles it as
  written and the suite's layer (`tests/client/testing/`, ROADMAP § 4b) keeps test-utils' whole reading surface over
  it: `mount(<the component>)` as the root, `props` / `slots` / `data()`, `setProps`, `stubs` (by the parent script's
  local binding name or the component's own) and `shallowMount` reaching the children a Vapor render creates,
  `findComponent` across both runtimes, `wrapper.vm` (the exposed object, the setup bindings, a prop by name). What
  DOES change at B is a fact the spec pinned about the virtual DOM, and it changes in the conversion's commit:
  - **«a parent's ref answers `$el`»** — a Vapor child's ref is its `defineExpose` object. The row is rewritten with
    the product (ROADMAP § 4a · B5): what the parent now reaches, by name;
  - **how the runtime SERIALISES** — the order of an element's classes after an update, of its attributes in
    `html()`, the anchor comment an absent root leaves (`<!--v-if-->` on the virtual DOM). Assert the FACT: the set
    (`to.have.members`), the attribute by name, «no element»;
  - **a real `<Transition>`** (`stubs: {transition: false}`) needs a frame source — `tests/client/vapor/lendFrames.ts`.
  Run it under the true runtime before the commit: `npm run test:client:vapor:one -- <spec>`; «is this red about the
  runtime at all?» — `npm run test:client:vdom:one -- <spec>`.
- A component that had no spec gets one in its conversion's commit: what it renders for its props, what it emits,
  what it exposes.

## 4. What the tools guarantee

| Tool | What it answers |
| --- | --- |
| `node scripts/vapor/inventory.mjs` | every construct of every component, with its recipe id — fails on one with no row, and on a CONVERTED component that does not expose a member its parents read through a ref |
| `node scripts/vapor/inventory.mjs --component <path>` | ONE component's sheet: constructs, MUST EXPOSE + every parent line that names its ref, who mounts it, the specs that import it and the specs that name it |
| `node scripts/vapor/inventory.mjs --wave` | the worklist, lightest first |
| `node scripts/vapor/template-diff.mjs <base rev>` | «the template does not change», checked: every template line that differs — comments aside — in a component converted since `<base>`; exits 1 on a file not named with `--allow`. Run once per wave, before its commits: each line is one of the three licensed edits (R24 · R12 · R2's guard) or a mistake to put back |
| `node scripts/vapor/audit.mjs` · `tests/console/vaporConversionAudit.spec.ts` | what a conversion changes SILENTLY, over every `<script setup>` component: **A** a top-level table the script writes through (module state that became per-instance — R25; a table that is per instance on purpose is an allowed row with its reason) · **B** a template ref cast to an element inside a callback that can run after the unmount (R12) |
| `node scripts/vapor/vapor-check.mjs [--list]` | STEP B, measured: every component compiled as if it carried `vapor` (the production, inline shape) — which compile clean, which the Vapor compiler refuses or warns about, which script still needs the virtual DOM. «It compiles» is a CANDIDATE, never a proof (ROADMAP § 4a) |
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

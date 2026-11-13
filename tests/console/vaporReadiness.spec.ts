import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE VAPOR READINESS LEDGER — how far the client is from ONE Vapor application, counted and FROZEN
 * (the north star: `createVaporApp(App).mount('#app')` — CLAUDE.md § North star; the program:
 * docs/claude/vapor/ROADMAP.md §5).
 *
 * The coverage ledger says nothing in the client WAITS outside a scope; the debt ledger says which decisions of the
 * shell still run on a mechanism the kernel replaces. This one answers the third question: WHICH FILES STILL HOLD
 * SOMETHING THE TARGET HAS NO PLACE FOR — a component written with the Options API, an instance reached by
 * `getCurrentInstance()`, a `$parent`, a mixin, a global registration, a render function, a `v-memo`, a `$refs` reach,
 * a `<script setup>` component that still leans on a global (`$t`, `v-i18n`) instead of importing it.
 *
 * Until V3 is over THE COUNT ONLY SHRINKS:
 *  · a file may not gain a use of a construct, and A NEW FILE STARTS AT ZERO — so «a new `.vue` is
 *    `<script setup lang="ts">`» (ROADMAP §2 rule 1) is a failing test, not a convention, and a new `<script setup>`
 *    component is written in the form that can become Vapor by adding one attribute;
 *  · a component that IS Vapor stays Vapor (`vapor` in the baseline — a conversion cannot drift back);
 *  · a wave of V3 lowers the baseline with `npm run ready:vapor`, which prints the line: converted / total.
 *
 * It counts FORM, not behaviour: what a Vapor component cannot do at all is the capability suite
 * (`tests/client/vapor/vaporCapability.spec.ts`), and what the rework must keep is the e2e (CLAUDE.md invariant 14).
 */
const ROOT = path.resolve(__dirname, '..', '..');
const BASELINE = path.resolve(__dirname, 'vaporReadinessBaseline.json');

type Sfc = {template: string, script: string, setup: boolean, vapor: boolean};

type Construct = {
  /** `.vue` only, `.ts` only, or both. */
  where: 'vue' | 'ts' | 'any',
  /** How many uses the file holds (0 = clean). `sfc` is given for a `.vue`. */
  count(code: string, sfc: Sfc | undefined, rel: string): number,
  what: string,
  instead: string,
};

const uses = (pattern: RegExp, text: string): number => (text.match(pattern) ?? []).length;

// (The components `main.ts` registers globally — `action-target-card`, `premium-card-face`, `console-source-dock` — are
// counted by the `global-in-setup` row below, each unless the script imports its binding from `asyncComponents.ts`.)

export const CONSTRUCTS: Readonly<Record<string, Construct>> = {
  'options-api': {
    where: 'vue',
    count: (_code, sfc) => (sfc !== undefined && sfc.script !== '' && !sfc.setup ? 1 : 0),
    what: 'a component written with the Options API (`defineComponent({data, computed, methods, watch})`) — Vapor does not take it',
    instead: 'a NEW component is `<script setup lang="ts">`: `defineProps` / `defineEmits`, `ref` / `computed()` / `watch()`, ' +
      '`useTemplateRef`, `nextTick()`, `const flow = useFlowScope(\'<kebab-name>\')`. An EXISTING one is converted in its V3 wave, as a commit of its own',
  },
  'instance-access': {
    where: 'any',
    count: (code) => uses(/\bgetCurrentInstance\(/g, code),
    what: '`getCurrentInstance()` — it answers `null` inside a Vapor component',
    instead: '`provide` / `inject` for what comes down the tree, `getCurrentScope()` / `onScopeDispose` for a lifetime ' +
      '(`session/consoleSession.ts`, `session/useFlowScope.ts` are the model); a port is explicit wiring ' +
      '(`shell/shellPort.ts` — the shell\'s port is a late-bound object, never the instance). ZERO since architecture S-last',
  },
  'instance-internals': {
    where: 'any',
    count: (code) => uses(/\bthis\.\$\.|\.\$(?:options|forceUpdate|data)\b/g, code),
    what: 'the component instance\'s INTERNALS or its Options-only members — `this.$.uid` / `.isUnmounted` / `.subTree`, `$options`, ' +
      '`$forceUpdate`, `$data`: a `<script setup>` component has no `this`, a Vapor one no such instance',
    instead: 'the component\'s own fact, kept by its own code: an id from a module counter taken in `setup`, «am I gone» from its own ' +
      '`onUnmounted`, a watcher\'s body as a NAMED function its other callers call (never `$options.watch[name].handler`). ' +
      'ZERO since V3 wave 4: `foundation/ConsoleTeleport.vue` — the last reader of its own `subTree` — remembers the vnode its ' +
      'render returned instead (docs/claude/vapor/RECIPES.md § R18)',
  },
  'parent-root': {
    where: 'any',
    count: (code) => uses(/\$(?:parent|root)\b/g, code),
    what: '`$parent` / `$root` — a component reaching up its tree by position',
    instead: 'a prop, an emit, or `provide` / `inject`',
  },
  'root-through-instance': {
    where: 'any',
    count: (code) => uses(/\bvueRoot\(/g, code),
    what: '`vueRoot(this)` — the app root reached through the component\'s own instance (`$root` behind a helper)',
    instead: '`useAppRoot()` — the app root\'s port comes down by injection (`components/appRoot.ts`; RECIPES.md § R26)',
  },
  'mixin': {
    where: 'any',
    count: (code) => uses(/^\s*mixins\s*:/gm, code),
    what: 'a mixin',
    instead: 'a composable (a function called in `<script setup>`)',
  },
  'global-registration': {
    where: 'ts',
    count: (code) => uses(/\.(?:component|directive)\(\s*['"`]|\bglobalProperties\./g, code),
    what: 'a GLOBAL registration (`app.component` / `app.directive` / `app.config.globalProperties`) — a Vapor component has no global properties, ' +
      'and a globally registered directive is the virtual-DOM form',
    instead: 'an import: a component imports what it renders, `$t` from `directives/i18n`, a directive from `directives/vDirectives` (one binding, both runtimes)',
  },
  'render-function': {
    where: 'any',
    count: (code, sfc) => {
      const script = sfc !== undefined ? sfc.script : code;
      return /import\s*(?:type\s*)?\{[^}]*\bh\b[^}]*\}\s*from\s*'vue'/.test(script) ? uses(/\bh\(/g, script) : 0;
    },
    what: 'a render function (`h(…)`) — it stays a virtual-DOM component',
    instead: 'a template (a dynamic tag is `<component :is>`, a wrapper is a slot)',
  },
  'v-memo': {
    where: 'vue',
    count: (_code, sfc) => uses(/\sv-memo=/g, sfc?.template ?? ''),
    what: '`v-memo` — ignored by the Vapor compiler (a Vapor update is already per binding)',
    instead: 'nothing: drop it when its component is converted',
  },
  'refs': {
    where: 'any',
    count: (code) => uses(/\$refs\b/g, code),
    what: '`$refs` — a Vapor component has no `this`, and a child\'s ref exposes only what the child `defineExpose`s',
    instead: 'inside a component — a template ref (`useTemplateRef`); BETWEEN surfaces — the surface registry (architecture S3; ' +
      'the controllers\' share of this row is the debt ledger\'s «surface-by-ref»)',
  },
  'global-in-setup': {
    where: 'vue',
    count: (_code, sfc) => {
      if (sfc === undefined || !sfc.setup) {
        return 0; // an Options-API component uses the globals by construction — counted once, as `options-api`
      }
      // A binding of the script — imported or declared — by that exact name (`$` is not a word character: no `\b`).
      const imported = (name: string): boolean => new RegExp(`(?<![\\w$])${name.replace('$', '\\$')}(?![\\w$])`).test(sfc.script);
      return (imported('$t') ? 0 : uses(/\$t\(/g, sfc.template)) +
        (imported('vI18n') ? 0 : uses(/\sv-i18n\b/g, sfc.template)) +
        (imported('vTrimWhitespace') ? 0 : uses(/\sv-trim-whitespace\b/g, sfc.template)) +
        // The three async-on-purpose components: imported from `components/asyncComponents.ts`, the tag is the binding.
        (imported('ActionTargetCard') ? 0 : uses(/<action-target-card\b/g, sfc.template)) +
        (imported('PremiumCardFace') ? 0 : uses(/<premium-card-face\b/g, sfc.template)) +
        (imported('ConsoleSourceDock') ? 0 : uses(/<console-source-dock\b/g, sfc.template));
    },
    what: 'a `<script setup>` component that leans on a GLOBAL — `$t` from `globalProperties`, a globally registered directive or component',
    instead: 'import it: `import {$t} from \'@/client/directives/i18n\'` · `import {vI18n} from \'@/client/directives/vDirectives\'` (one binding for ' +
      'both runtimes — the line does not change when the component gains `vapor`) · the component itself (`action-target-card` / ' +
      '`premium-card-face` / `console-source-dock` from `@/client/components/asyncComponents` — async on purpose). The template does not change',
  },
};

type Baseline = {uses: Record<string, Record<string, number>>, vapor: Array<string>};

function sources(dir: string, out: Array<string> = []): Array<string> {
  for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      sources(p, out);
    } else if (/\.(ts|vue)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

/** The code of a file: block comments, HTML comments and whole-line comments out (prose that NAMES a construct is not a use). */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
}

function parseSfc(text: string): Sfc {
  const open = /<script\b([^>]*)>/.exec(text);
  const templateOpen = /<template\b([^>]*)>/.exec(text);
  const scriptStart = open === null ? -1 : open.index;
  const template = templateOpen === null ? '' : text.slice(templateOpen.index, text.lastIndexOf('</template>') + 1);
  const script = scriptStart < 0 ? '' : text.slice(scriptStart, text.indexOf('</script>', scriptStart));
  const attrs = `${open?.[1] ?? ''} ${templateOpen?.[1] ?? ''}`;
  return {
    template,
    script,
    // A template-only SFC is as good as `<script setup>` to the target.
    setup: open === null || /\bsetup\b/.test(open[1]) || /\bvapor\b/.test(open[1]),
    vapor: /(?:^|\s)vapor(?=[\s=]|$)/.test(attrs),
  };
}

function scan(): {files: number, components: number, uses: Record<string, Record<string, number>>, vapor: Array<string>} {
  const found: Record<string, Record<string, number>> = {};
  for (const name of Object.keys(CONSTRUCTS)) {
    found[name] = {};
  }
  const vapor: Array<string> = [];
  let files = 0;
  let components = 0;
  for (const file of sources(path.join(ROOT, 'src', 'client'))) {
    const rel = path.relative(ROOT, file).split(path.sep).join('/');
    files++;
    const isVue = rel.endsWith('.vue');
    const raw = fs.readFileSync(file, 'utf8');
    const body = code(raw);
    const sfc = isVue ? parseSfc(body) : undefined;
    if (sfc !== undefined) {
      components++;
      if (sfc.vapor) {
        vapor.push(rel);
      }
    }
    for (const [name, construct] of Object.entries(CONSTRUCTS)) {
      if ((construct.where === 'vue' && !isVue) || (construct.where === 'ts' && isVue)) {
        continue;
      }
      const n = construct.count(body, sfc, rel);
      if (n > 0) {
        found[name][rel] = n;
      }
    }
  }
  return {files, components, uses: found, vapor: vapor.sort()};
}

const sum = (rows: Record<string, number>): number => Object.values(rows).reduce((a, b) => a + b, 0);

describe('vapor readiness — what the target has no place for only shrinks', function() {
  // A walk of the client tree: its budget is the walk's (tests.md § flake class ⑤).
  // eslint-disable-next-line no-invalid-this
  this.timeout(30_000);
  const now = scan();
  const line = (base: Baseline): string =>
    `vapor readiness — Vapor components: ${now.vapor.length} / ${now.components} · ` +
    Object.keys(CONSTRUCTS).map((name) => `${name}: ${sum(base.uses[name] ?? {})}`).join(' · ');

  if (process.env.TM_VAPOR_READINESS === 'lower') {
    // `npm run ready:vapor` — rewrite the baseline DOWNWARDS (a row is lowered to what stands, a clean file leaves) and
    // record every component that is Vapor now. Never raised: growth is a construct to write in the target's form.
    it('lowers the baseline to what stands now', () => {
      const old: Baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : {uses: now.uses, vapor: []};
      const next: Baseline = {uses: {}, vapor: now.vapor};
      for (const name of Object.keys(CONSTRUCTS)) {
        next.uses[name] = {};
        const was = old.uses[name] ?? now.uses[name];
        for (const file of Object.keys(was).sort()) {
          const cur = now.uses[name][file];
          if (cur !== undefined) {
            next.uses[name][file] = Math.min(was[file], cur);
          }
        }
      }
      fs.writeFileSync(BASELINE, JSON.stringify(next, null, 1) + '\n');
      console.log(line(next));
    });
    return;
  }

  const baseline: Baseline = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));

  it('reads a real corpus (anti-vacuous): the client is scanned, the SFC reader tells the three forms apart', () => {
    expect(now.files, 'client sources scanned').to.be.greaterThan(1000);
    expect(now.components, 'single-file components').to.be.greaterThan(400);
    expect(parseSfc('<template><i/></template>\n<script lang="ts">\nexport default defineComponent({});\n</script>')).to.include({setup: false, vapor: false});
    expect(parseSfc('<template><i/></template>\n<script setup lang="ts">\n</script>')).to.include({setup: true, vapor: false});
    expect(parseSfc('<template><i/></template>\n<script setup vapor lang="ts">\n</script>')).to.include({setup: true, vapor: true});
    expect(parseSfc('<template vapor><i/></template>')).to.include({setup: true, vapor: true});
    const leaning = parseSfc('<template><b v-i18n>{{ $t(x) }}</b></template>\n<script setup lang="ts">\nconst x = 1;\n</script>');
    expect(CONSTRUCTS['global-in-setup'].count('', leaning, 'x.vue'), '`$t` and `v-i18n` with no import').to.equal(2);
    const importing = parseSfc('<template><b v-i18n>{{ $t(x) }}</b></template>\n<script setup lang="ts">\nimport {$t} from \'a\';\nimport {vI18n} from \'b\';\n</script>');
    expect(CONSTRUCTS['global-in-setup'].count('', importing, 'x.vue')).to.equal(0);
  });

  for (const [name, construct] of Object.entries(CONSTRUCTS)) {
    it(`«${name}» does not grow — and a new file starts at zero`, () => {
      const grown: Array<string> = [];
      for (const [file, n] of Object.entries(now.uses[name])) {
        const allowed = baseline.uses[name]?.[file] ?? 0;
        if (n > allowed) {
          grown.push(`${file}: ${allowed} → ${n}`);
        }
      }
      expect(grown, `${construct.what}.\n      INSTEAD: ${construct.instead}.\n      (docs/claude/vapor/ROADMAP.md §2 · §4.)`).to.deep.equal([]);
    });
  }

  it('a component that is Vapor stays Vapor — a conversion does not drift back', () => {
    const lost = baseline.vapor.filter((file) => fs.existsSync(path.join(ROOT, file)) && !now.vapor.includes(file));
    expect(lost, 'was `<script setup vapor>`, is not any more').to.deep.equal([]);
    const unrecorded = now.vapor.filter((file) => !baseline.vapor.includes(file));
    expect(unrecorded, 'a new Vapor component: record it with `npm run ready:vapor` (in the same diff)').to.deep.equal([]);
  });

  it('a Vapor template starts with its ROOT — no comment before it (development keeps it, and the root becomes a fragment)', () => {
    // Found by the pilot on `ConsoleForecastDoor`: with `<!-- … -->` before the root, a development build / the unit
    // bundle dropped the `data-unfold-late` its hosts let fall through («Extraneous non-props attributes … renders
    // fragment»), while the production build — which strips template comments — inherited it. A difference between
    // what is tested and what ships is not something to live with: the comment goes into the script block.
    const offenders = now.vapor.filter((file) => /<template\b[^>]*>\s*<!--/.test(fs.readFileSync(path.join(ROOT, file), 'utf8')));
    expect(offenders, 'a comment before the root of a Vapor template').to.deep.equal([]);
  });

  it('a Vapor component holds NOTHING of the list (it could not run)', () => {
    const dirty: Array<string> = [];
    for (const file of now.vapor) {
      for (const name of Object.keys(CONSTRUCTS)) {
        if ((now.uses[name][file] ?? 0) > 0) {
          dirty.push(`${file}: ${name}`);
        }
      }
    }
    expect(dirty).to.deep.equal([]);
  });
});

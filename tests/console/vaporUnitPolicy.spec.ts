import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import {createRequire} from 'module';

/*
 * THE UNIT BUNDLE'S VAPOR POLICY (scripts/vapor/unitVaporPolicy.cjs · docs/claude/vapor/ROADMAP.md § 4a · B6).
 *
 * A converted component meets its unit specs under the runtime that SHIPS: the unit bundle compiles it as written.
 * The one way around that is THE VALVE — `tests/client/vaporUnit.json` § `virtualDomInUnit` — and a valve nobody
 * watches becomes the place every hard case goes to rest: specs green under a runtime the player never runs. So:
 *
 *   · an entry names an existing Vapor component of `src/client` and carries its REASON (what product work stands
 *     between its specs and the true runtime);
 *   · the count stands under a CEILING that only falls — raising it is an edit of this file, made in the open;
 *   · the policy itself answers as documented, for every mode of `TM_UNIT_VAPOR`.
 *
 * The switch to `createVaporApp(App)` takes an EMPTY valve.
 */
const ROOT = path.resolve(__dirname, '..', '..');
const requireFromHere = createRequire(__filename);
const POLICY = path.join(ROOT, 'scripts', 'vapor', 'unitVaporPolicy.cjs');

/** Entries the valve may hold. It only FALLS: an entry leaves with the product work its reason names. */
const CEILING = 0;

const VAPOR_BLOCK = /<(?:script|template)\b[^>]*?\svapor(?=[\s=>/])[^>]*>/;

type Policy = {unitCompilesAsVapor(filename: string): boolean, unitPolicyActive(): boolean, LIST_FILE: string};

/** A FRESH policy module: it reads its list once, and its answers depend on the environment of the call. */
function policy(): Policy {
  delete requireFromHere.cache[requireFromHere.resolve(POLICY)];
  return requireFromHere(POLICY) as Policy;
}

function valve(): Record<string, string> {
  const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'client', 'vaporUnit.json'), 'utf8')) as {virtualDomInUnit?: Record<string, string>};
  return raw.virtualDomInUnit ?? {};
}

describe('the unit bundle\'s Vapor policy — a converted component meets its specs under the runtime that ships', () => {
  const saved = {mode: process.env.TM_UNIT_VAPOR, flag: process.env.TM_VAPOR_POLICY};
  afterEach(() => {
    for (const [key, value] of [['TM_UNIT_VAPOR', saved.mode], ['TM_VAPOR_POLICY', saved.flag]] as const) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('THE VALVE: every entry is an existing Vapor component of src/client with its reason — and the count is under the ceiling', () => {
    const entries = valve();
    const problems: Array<string> = [];
    for (const [file, reason] of Object.entries(entries)) {
      const abs = path.join(ROOT, file);
      if (!file.startsWith('src/client/') || !file.endsWith('.vue')) {
        problems.push(`${file} — not a component of src/client (a forward-slash path from the repo root)`);
      } else if (!fs.existsSync(abs)) {
        problems.push(`${file} — no such file: the entry left with it`);
      } else if (!VAPOR_BLOCK.test(fs.readFileSync(abs, 'utf8'))) {
        problems.push(`${file} — not a Vapor component: there is nothing to hold back`);
      }
      if (typeof reason !== 'string' || reason.trim().length < 20) {
        problems.push(`${file} — the reason names the product work that stands in the way (a sentence, not a word)`);
      }
    }
    expect(problems, 'tests/client/vaporUnit.json § virtualDomInUnit').to.deep.equal([]);
    expect(Object.keys(entries).length, `the valve and its CEILING (${CEILING}) move together: a new entry is a decision made in this file, and an entry ` +
      'that left lowers the ceiling in the same diff — so it cannot come back unseen').to.equal(CEILING);
  });

  it('THE ANSWER: as written by default, the valve aside; `all` ignores the valve, `none` sends src/client to the virtual DOM; a file outside src/client is always as written', () => {
    const inClient = path.join(ROOT, 'src', 'client', 'components', 'card', 'CardDescription.vue');
    const fixture = path.join(ROOT, 'tests', 'client', 'vapor', 'fixtures', 'VaporBasics.vue');

    delete process.env.TM_UNIT_VAPOR;
    expect(policy().unitCompilesAsVapor(inClient), 'default').to.equal(!('src/client/components/card/CardDescription.vue' in valve()));
    expect(policy().unitCompilesAsVapor(`${inClient}?vue&type=template`), 'a loader query is not part of the name').to.equal(policy().unitCompilesAsVapor(inClient));
    expect(policy().unitCompilesAsVapor(fixture)).to.equal(true);

    process.env.TM_UNIT_VAPOR = 'all';
    expect(policy().unitCompilesAsVapor(inClient)).to.equal(true);
    for (const file of Object.keys(valve())) {
      expect(policy().unitCompilesAsVapor(path.join(ROOT, file)), `«all» ignores the valve: ${file}`).to.equal(true);
    }

    process.env.TM_UNIT_VAPOR = 'none';
    expect(policy().unitCompilesAsVapor(inClient)).to.equal(false);
    expect(policy().unitCompilesAsVapor(fixture), 'the fixtures of the capability table are Vapor in every mode').to.equal(true);
  });

  it('THE FLAG: the policy is in force inside the unit bundle only — the product build never consults it', () => {
    delete process.env.TM_VAPOR_POLICY;
    expect(policy().unitPolicyActive()).to.equal(false);
    process.env.TM_VAPOR_POLICY = 'unit';
    expect(policy().unitPolicyActive()).to.equal(true);
    const config = fs.readFileSync(path.join(ROOT, 'webpack.test.config.js'), 'utf8');
    expect(config, 'the unit config raises the flag before it loads the base config').to.match(/process\.env\.TM_VAPOR_POLICY = 'unit';[\s\S]*require\('\.\/webpack\.config\.js'\)/);
    expect(fs.readFileSync(path.join(ROOT, 'webpack.config.js'), 'utf8'), 'the product config never raises it').to.not.include('TM_VAPOR_POLICY');
  });
});

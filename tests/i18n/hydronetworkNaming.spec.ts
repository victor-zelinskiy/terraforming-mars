import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/**
 * THE MODULE'S INTERNAL NAME NEVER REACHES A PLAYER.
 *
 * «Delta Project» is what this fork calls the expansion in CODE — the
 * `GameModule` key, the directory, the class names, `CardName.DELTA_PROJECT`.
 * The player only ever meets it as the **Hydronetwork** («Гидросеть»), and the
 * two had drifted: a card's own effect plate read `DELTA TRACK`, the offer's
 * trigger sentence read «Advance 1 step on the Delta Project track», the
 * end-game tooltip said «Delta Project points», and every one of those is a
 * string an English player reads verbatim (English IS the i18n key here, so an
 * untranslated key is the UI).
 *
 * This guard reads the two places a player-visible string can live and fails
 * with the exact offender:
 *  - `src/locales/**` — every key AND every translation;
 *  - the render/prompt strings of the module's own source.
 *
 * It deliberately does NOT police comments, type names, `CardName` members or
 * the `deltaProject` module key: those are the internal name, and they are
 * supposed to stay.
 */
const ROOT = path.resolve(__dirname, '..', '..');
/** The internal name, in the forms a UI string could carry it. */
const FORBIDDEN = /delta[\s-]?(project|track)/i;

/** Source files whose STRING LITERALS must not name the module internally. */
const SOURCE_FILES: ReadonlyArray<string> = [
  'src/server/cards/delta/DeltaProject.ts',
  'src/server/cards/delta/DynamicOceanBarrier.ts',
  'src/server/deferredActions/BonusDeltaAdvance.ts',
  'src/server/delta/DeltaProjectExpansion.ts',
  'src/server/automa/AutomaDeltaProject.ts',
  'src/client/components/hydronetwork/hydroReasons.ts',
  'src/client/console/hydroFlow/hydroBonusOffer.ts',
];

/**
 * The literals a PLAYER could read. Comments, import specifiers and developer
 * `Error` messages are excluded on purpose: the first two are the internal name
 * by definition, and an engine invariant that throws is never localized and
 * never rendered — it is a crash report, not copy.
 */
function playerVisibleLiterals(source: string): ReadonlyArray<string> {
  const literals: Array<string> = [];
  const withoutBlockComments = source.replace(/[/][*][^]*?[*][/]/g, '');
  for (const raw of withoutBlockComments.split('\n')) {
    const line = raw.replace(/[/][/].*$/, '');
    // `import` may wrap, so the module specifier can sit on its own line.
    if (line.trimStart().startsWith('import') || line.includes("from '") || line.includes('new Error(')) {
      continue;
    }
    for (const match of line.matchAll(/'([^']*)'/g)) {
      literals.push(match[1]);
    }
  }
  return literals;
}

/** Machine identifiers that happen to spell the internal name. Never rendered:
 *  the event-recorder category the journal groups an advance under. */
const MACHINE_IDS: ReadonlySet<string> = new Set(['Delta Project', 'deltaProject', 'delta-project']);

describe('the Hydronetwork is never called by its internal name', () => {
  it('no locale key or translation carries it', () => {
    const localesDir = path.join(ROOT, 'src', 'locales');
    const offenders: Array<string> = [];
    for (const lang of fs.readdirSync(localesDir)) {
      const dir = path.join(localesDir, lang);
      if (!fs.statSync(dir).isDirectory()) {
        continue;
      }
      for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.json'))) {
        const json = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')) as Record<string, string>;
        for (const [key, value] of Object.entries(json)) {
          if (FORBIDDEN.test(key)) {
            offenders.push(`${lang}/${file} KEY: ${key}`);
          }
          if (typeof value === 'string' && FORBIDDEN.test(value)) {
            offenders.push(`${lang}/${file} VALUE: ${value}`);
          }
        }
      }
    }
    expect(offenders, `locale entries naming the module internally:\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('no player-visible string in the module\'s own source carries it', () => {
    const offenders: Array<string> = [];
    for (const rel of SOURCE_FILES) {
      const source = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      for (const literal of playerVisibleLiterals(source)) {
        if (MACHINE_IDS.has(literal)) {
          continue;
        }
        if (FORBIDDEN.test(literal)) {
          offenders.push(`${rel}: '${literal}'`);
        }
      }
    }
    expect(offenders, `player-visible strings naming the module internally:\n${offenders.join('\n')}`).to.deep.eq([]);
  });

  it('the module\'s DISPLAY name is the Hydronetwork, and it is translated', () => {
    const gameModule = fs.readFileSync(path.join(ROOT, 'src', 'common', 'cards', 'GameModule.ts'), 'utf8');
    expect(gameModule).to.contain("deltaProject: 'Hydronetwork'");
    const ru = JSON.parse(fs.readFileSync(
      path.join(ROOT, 'src', 'locales', 'ru', 'hydronetwork.json'), 'utf8')) as Record<string, string>;
    expect(ru['Hydronetwork']).to.eq('Гидросеть');
  });
});

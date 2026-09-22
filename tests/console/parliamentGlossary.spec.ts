import {expect} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

/*
 * THE PARLIAMENT GLOSSARY GUARD (docs/claude/parliament-glossary.md): one
 * word per concept, everywhere the parliament speaks. Static, over the RU
 * locale the fork owns (`parliament.json`) and the console's parliament
 * trees — a regression fails in seconds and names the key or the line.
 *   · CANON: a key the glossary pins prints exactly its canonical RU line;
 *   · BANNED: no RU value of the parliament's own file carries a retired form
 *     («побеждает» about a resolution, «при победе», «ваш эффект», …);
 *   · GONE: retired keys are neither translated nor referenced.
 */
const ROOT = path.join(__dirname, '..', '..');
const RU_PATH = path.join(ROOT, 'src', 'locales', 'ru', 'parliament.json');
const TREES = [
  path.join('src', 'client', 'console', 'parliament'),
  path.join('src', 'client', 'components', 'console', 'parliament'),
  path.join('src', 'client', 'components', 'console', 'ConsoleParliamentSection.vue'),
];

/** Glossary canon: EN key → the one RU line. */
const CANON: Record<string, string> = {
  'Winning': 'Принимается',
  'If you win': 'Если победите',
  'if you win': 'если победите',
  'Winning player': 'Победитель голосования',
  'Parliament overview': 'Обзор',
  'Ruling': 'Правит',
  'Your effect': 'Эффект ваш',
  'Your effect · granted by a card': 'Эффект ваш · выдан картой',
  'Your effect · 2 delegates': 'Эффект ваш · 2 делегата',
  'Chairmanship': 'Председательство',
  'Chairmanship (kept)': 'Председательство (сохраняется)',
  // «ПРЕДСЕДАТЕЛЬСТВО» (the chairman-quest flow): the crumb's two stages, one
  // word each, and the outgoing delegate's own fact — where it GOES.
  'Quest': 'Задание',
  'The delegate returns to the reserve': 'Делегат возвращается в резерв',
  'Agenda step': 'шаг Повестки',
  'Available to every player': 'Доступен всем',
  'Waiting for the other seats': 'Ожидание',
  'The ruling party answers': 'Ответ правящей партии',
  'Party effect': 'Эффект партии',
  'Inspect': 'Осмотреть',
  // «Заседание v2»: the one door to the winner's tile, the one closing stage, the row below the government.
  'Onto the board': 'К полю',
  'Results': 'Итоги',
  // «Обновление» (2026-09-22): the renewal is a page of its own before the results — one word, the tact's.
  'Renewal': 'Обновление',
  // Colonial Affairs (RX07): the sitting hosts a discard from hand as a step of its own — one word, the hand's.
  'Discarding': 'Сброс',
  'Distribution': 'Раскладка',
  'Opposition': 'Оппозиция',
  // «Заседание v4»: the government that has NOT left yet is named, so «принятая резолюция» can never be read
  // over a card on its way out (§2.3) — one word for one state of that block.
  'Outgoing government': 'Уходящее правительство',
  'Enacted resolution': 'Принятая резолюция',
  // «Итоги: честность»: the one lobby fact the delegates ledger does not state out loud.
  'Without a free delegate': 'Без свободного делегата',
};

/** Retired forms — none may survive in a RU value of the parliament's own file. */
const BANNED: ReadonlyArray<{pattern: RegExp, why: string}> = [
  {pattern: /побежда/i, why: 'a RESOLUTION «принимается» / «принята»; only a player is a «победитель голосования» (glossary §1–2)'},
  {pattern: /при победе/i, why: 'the condition is «если победите» (glossary §2)'},
  {pattern: /победивший игрок/i, why: 'the player is the «победитель голосования» (glossary §2)'},
  // (no `\b` — JS word boundaries are ASCII-only and never fire beside a Cyrillic letter)
  {pattern: /ваш эффект/i, why: 'the state reads «эффект ваш», the columns\' word order (glossary §3)'},
  {pattern: /правит · стартовое/i, why: 'the tile says «ПРАВИТ»; the basis is the government block\'s (glossary §3)'},
  {pattern: /ждём остальных/i, why: 'one wait form: «Ожидание» + the seat\'s chip (glossary §6)'},
  // Final polish B (the locale read as an editor): one grammar of access, one word for the government,
  // the party names with Ё, one currency spelling, the glossary's «осмотр» and «тайл».
  {pattern: /у вас (есть|нет|пока нет)/i, why: 'access reads «доступен · …» / «недоступен · …» (P-06, P-11, P-34)'},
  {pattern: /нет доступа/i, why: 'the state is «недоступен» (P-34)'},
  {pattern: /слот «принята»/i, why: 'the ENACTED slot is the «правительство» (P-32)'},
  {pattern: /марс вперед|ученые/i, why: 'the parliament prints its own party names, with Ё («Марс вперёд», «Учёные» — P-01)'},
  {pattern: /М€/, why: 'the currency is «M€» with a Latin M, as in the rest of the RU locale (P-38)'},
  {pattern: /размер в fullscreen|плитка/i, why: 'the glossary says «осмотр» and «тайл» (P-36, P-37)'},
];

/** Retired keys: not translated, not referenced. */
// «Итоги: честность» Ф1: the results panel's «В ЛОББИ» row restated the delegates ledger, which shows
// every seat's lobby socket and reserve stack by name — and said less (`lobbyRefilled` is «whose lobby was
// EMPTY and got filled»). Its place is now the EXCEPTION: «Без свободного делегата».
const GONE = ['Ruling · starting rule', 'No delegates yet', 'No leader yet', 'To the lobby'];

function listFiles(dir: string): Array<string> {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) {
    return [];
  }
  if (fs.statSync(abs).isFile()) {
    return [abs];
  }
  return fs.readdirSync(abs).flatMap((name) => {
    const p = path.join(abs, name);
    return fs.statSync(p).isDirectory() ? listFiles(path.relative(ROOT, p)) : [p];
  }).filter((p) => /\.(ts|vue)$/.test(p));
}

describe('parliament glossary — one word per concept (static guard)', () => {
  const ru = JSON.parse(fs.readFileSync(RU_PATH, 'utf8')) as Record<string, string>;
  const sources = TREES.flatMap(listFiles).map((p) => ({p: path.relative(ROOT, p), text: fs.readFileSync(p, 'utf8')}));

  it('every pinned key prints its canonical RU line', () => {
    const wrong = Object.entries(CANON)
      .filter(([key, canon]) => ru[key] !== canon && !(key === 'Inspect' || key === 'Party effect'))
      .map(([key, canon]) => `${key}: «${ru[key]}» ≠ «${canon}»`);
    expect(wrong, 'canon drift').to.deep.equal([]);
  });

  it('no RU value of the parliament file carries a retired form', () => {
    const hits: Array<string> = [];
    for (const [key, value] of Object.entries(ru)) {
      for (const b of BANNED) {
        if (b.pattern.test(value)) {
          hits.push(`«${value}» (${key}) — ${b.why}`);
        }
      }
    }
    expect(hits, 'retired forms').to.deep.equal([]);
  });

  it('retired keys are neither translated nor referenced', () => {
    const translated = GONE.filter((k) => k in ru);
    expect(translated, 'retired keys still translated').to.deep.equal([]);
    const referenced = sources.flatMap(({p, text}) => GONE.filter((k) => text.includes(`'${k}'`)).map((k) => `${p}: '${k}'`));
    expect(referenced, 'retired keys still referenced').to.deep.equal([]);
  });

  it('the party tile\'s X is «Осмотреть», never the name of what it opens', () => {
    const commands = sources.find(({p}) => p.endsWith('parliamentCommands.ts'));
    expect(commands, 'parliamentCommands.ts is in the tree').to.not.equal(undefined);
    expect(commands!.text.includes("label: 'Party effect'"), 'no «Party effect» command label').to.equal(false);
  });

  it('the resolution\'s party column and the party inspector name the mechanics the same way', () => {
    const annotations = sources.find(({p}) => p.endsWith('parliamentAnnotations.ts'));
    expect(annotations, 'parliamentAnnotations.ts is in the tree').to.not.equal(undefined);
    const aside = /const ASIDE_LABELS: MechanicLabels = \{effect: '([^']+)', action: '([^']+)'\}/.exec(annotations!.text);
    const inspector = /const PARTY_INSPECTOR_LABELS: MechanicLabels = \{effect: '([^']+)', action: '([^']+)'\}/.exec(annotations!.text);
    expect(aside?.slice(1), 'aside labels').to.deep.equal(inspector?.slice(1));
  });
});

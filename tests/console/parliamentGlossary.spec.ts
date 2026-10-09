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
/** The expansion's own name lives in the create-game file (RU + UA) — one term, glossary § 6-bis. */
const CREATE_GAME_RU = path.join(ROOT, 'src', 'locales', 'ru', 'create_game.json');
const CREATE_GAME_UA = path.join(ROOT, 'src', 'locales', 'ua', 'create_game.json');
const EXPANSION_KEY = 'Turmoil Redux';
const EXPANSION_RU = 'Кризис: Возвращение';
const EXPANSION_UA = 'Турбулентність: Повернення';
/**
 * The parliament's surfaces beyond the trees: the info panel's parliament block and the info mode's stat line —
 * they name the track too, and may not do it with the Pathfinders resource's key.
 */
const AGENDA_KEY_FILES = [
  path.join('src', 'client', 'components', 'console', 'ConsoleInfoParliament.vue'),
  path.join('src', 'client', 'components', 'console', 'ConsoleInfoMode.vue'),
];
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
  // THE LOWERED LAW (TR36 Council Seat — glossary § 5): one cube holds the effect, the card is QUOTED by name, the
  // requirement's note speaks the threshold's own words; the printed phrases stay (they are right at two).
  'Your effect · 1 delegate': 'Эффект ваш · 1 делегат',
  'You have it: one of your delegates is on its resolution (${0}: one is enough)': 'Доступен · ваш делегат на её резолюции («${0}»: достаточно одного)',
  'You do not have it — one of your delegates on its resolution would grant it (${0})': 'Недоступен · один ваш делегат на её резолюции откроет его («${0}»)',
  'Card requirement of this party: not met — one delegate opens the effect, the requirement still asks for two': 'Требование этой партии на картах: не выполнено — один делегат открывает эффект, требованию по-прежнему нужны два',
  'Unlocks the party effect for you (1 delegate — ${0})': 'Откроет вам эффект партии (1 делегат — «${0}»)',
  'The ruling party\'s effect is everyone\'s. A party with one of your delegates on its resolution gives you its effect too (${0}).': 'Эффект правящей партии есть у всех. Партия, на резолюции которой один ваш делегат, даёт свой эффект и вам («${0}»).',
  'Chairmanship': 'Председательство',
  'Chairmanship (kept)': 'Председательство (сохраняется)',
  // «ПРЕДСЕДАТЕЛЬСТВО» (the chairman-quest flow): the crumb's two stages, one
  // word each, and the outgoing delegate's own fact — where it GOES.
  'Quest': 'Задание',
  'The delegate returns to the reserve': 'Делегат возвращается в резерв',
  // «КАРЬЕРА» (owner's decision 2026-09-30, TR04): the Agenda track is «Карьера» in RU — the track, its start,
  // the stage of every flow that walks it and the step. The Pathfinders card RESOURCE keeps the bare `Agenda`
  // key («Повестка»); the parliament never prints that key (see the last case below).
  'Agenda track': 'Карьера',
  'Agenda start': 'Старт карьеры',
  'Agenda step': 'шаг Карьеры',
  // «ДЕЛЕГАТЫ» (owner's decision 2026-10-07, TR31): a card's rally of NEUTRAL delegates — the stage is one word
  // («Delegates»), the band's kicker names the cubes, the recount counts «in use» (glossary § 9-ter).
  'Delegates': 'Делегаты',
  'Neutral delegates': 'Нейтральные делегаты',
  'in use': 'в игре',
  'Delegates — neutral delegates in the Parliament': 'Делегаты — нейтральные делегаты в Парламенте',
  '+0 · the area is full': '+0 · область заполнена',
  '+0 · no neutral delegates left': '+0 · нейтральных не осталось',
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
  // Skyscrapers (RX20): a tile granted by THRESHOLD speaks the winner tile's own two forms — «размещаете вы»
  // before, «размещено вами» after — with the reason it is the viewer's beside it (glossary §6).
  'You place it — the winner of the vote': 'Размещаете вы — победитель голосования',
  'You place it — influence ${0}': 'Размещаете вы — влияние ${0}',
  'You placed it — the winner of the vote': 'Размещено вами — победитель голосования',
  'You placed it — influence ${0}': 'Размещено вами — влияние ${0}',
  'Only if you win — influence ${0} is below ${1}': 'Только если победите: влияние ${0} меньше ${1}',
  // ЧУЖИЕ ИСХОДЫ: the same conditions about ANOTHER seat — the condition word never changes («если
  // победит», never «при победе»), and the subject is named ONCE, by the reading's kicker.
  'if they win': 'если победит',
  'Only if they win — influence ${0} is below ${1}': 'Только если победит: влияние ${0} меньше ${1}',
  // THE GREENERY REVISION: the tile's own TR is named after the TILE everywhere it is
  // attributed — one placement («Тайл озеленения»: the journal row, the notification's cause,
  // the dossier's reason, the winner reward's note) and the aggregate in the score
  // («Тайлы озеленения»: the TR segment of the ceremony, the live score and the provenance).
  // Never «Марсианский парламент» for a tile the player just laid.
  'Greenery tile': 'Тайл озеленения',
  'Greenery tiles': 'Тайлы озеленения',
  // THE EXPANSION'S NAME (glossary § 6-bis): «Redux» is translated — the two parliament lines that name
  // the expansion print it, never the half-Latin «Кризис Redux» and never «Turmoil Redux» in a RU string.
  // THE VOTE'S THIRD DOOR (TR03 Political Donation — glossary § 9): the door is a navigation verb on the play
  // composer, the delegate is the CARD's («по карте», never «бесплатно» — the card was paid for), and the
  // party's support speaks in NUMBERS with the cause of a cut named («предел области», the supply's count).
  'Choose the resolution': 'Выбрать резолюцию',
  'Resolution — chosen in the Parliament': 'Резолюция — выбор в Парламенте',
  'from the reserve · by the card': 'из резерва · по карте',
  '+${0} of ${1} · area limit': '+${0} из ${1} · предел области',
  '+${0} of ${1} · neutral supply: ${2}': '+${0} из ${1} · нейтральных в запасе: ${2}',
  'area is full': 'область заполнена',
  'no neutral delegates left': 'нейтральных не осталось',
  // A PARTY REQUIREMENT (TR15 Martian Census — the set's first; glossary § 5): the rule and its «now» speak the
  // access line's own words — «два ваших делегата», «на голосовании» — and the party by its parliament name
  // («Марс вперёд»). ONE sentence serves every party, so it names NO pronoun: «на её резолюции» beside «Союз»
  // (masculine) or «Зелёные» (plural) read wrong (PL-053, TR29 walk) — «на резолюции этой партии» is right for all;
  // and NO verb that agrees in number: ««Красные» правит» (TR30, the first plural plate — PL-077) — «у власти» is.
  'Requires ${0} to be ruling or ${1} of your delegates on the resolution of that party': 'Требуется: у власти «${0}» или ${1} ваших делегата на резолюции этой партии',
  '${0} does not hold power': '«${0}» не у власти',
  'your delegates on the resolution of that party: ${0} of ${1}': 'ваших делегатов на резолюции этой партии: ${0} из ${1}',
  'the resolution of that party is not up for a vote': 'резолюции этой партии нет на голосовании',
  // THE SUPPORT-AREA MODE (TR12 Party Sanctions — glossary § 9-bis): the composer's door is a navigation verb, the
  // stage names what the pick does («САНКЦИИ»), the candidate's rule says where the cubes go and what does NOT change,
  // an empty area is a fact in the quiet register, and the chairman requirement names who holds the seat now.
  'Choose the party': 'Выбрать партию',
  'Popular support area — chosen in the Parliament': 'Область поддержки — выбор в Парламенте',
  'Sanctions': 'Санкции',
  'The neutral delegates return to the common supply. The resolutions keep their votes.': 'Нейтральные делегаты уходят в общий запас. Голоса на резолюциях не меняются.',
  'The support area is empty': 'Область пуста',
  'Requires you to be the chairman': 'Требуется быть председателем',
  'chairman now: ${0}': 'председатель сейчас: ${0}',
  'the chair is vacant': 'кресло свободно',
  'Turmoil Redux requires Colonies': '«Кризис: Возвращение» требует дополнение «Колонии»',
  'Redux resolutions showcase': 'Витрина резолюций «Кризис: Возвращение»',
};

/**
 * THE THIRD-PERSON FAMILY — every key a reading about ANOTHER SEAT prints.
 * Their RU lines may not carry the second person anywhere: the panel names
 * the subject once, in the kicker, and a «вы» below it would be a sentence
 * about the wrong player standing under somebody else's cube.
 */
const THIRD_PERSON_KEYS: ReadonlyArray<string> = [
  'For ${0} when enacted',
  'if they win',
  'If they win, the Agenda marker moves to step ${0} first. The effect uses that influence.',
  '${0} theirs',
  'No colonies',
  'Theirs at influence ${0} — win or not',
  'Only if they win — influence ${0} is below ${1}',
  'cities on Mars: ${0}',
  // THE PARTY'S SUPPORT (TR03): it stands in the vote panel whoever the reading's subject is, and it is
  // nobody's — the party's. None of its lines may turn it into «ваша».
  'Popular support',
  '+${0} of ${1} · area limit',
  '+${0} of ${1} · neutral supply: ${2}',
  'area is full',
  'no neutral delegates left',
  '${0} → ${1} of ${2}',
  'Neutral delegates in a party\'s Popular Support become votes on that party\'s next resolution. They do not vote on this one.',
  // …and the support it LOSES (TR12): the area is the party's, the cubes go back to nobody's supply.
  'The neutral delegates return to the common supply. The resolutions keep their votes.',
  'The support area is empty',
];

/** The second person in RU (no `` — JS word boundaries are ASCII-only and never fire beside Cyrillic). */
const SECOND_PERSON = /(^|\s|«)(вы|вас|вам|вами|ваш|ваша|ваше|ваши|ваших|ваше?му|вашей)(\s|,|:|;|»|\.|$)/i;

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
  // The expansion's name (glossary § 6-bis): «Кризис: Возвращение» — never the half-Latin form, never the English key inside a RU line.
  {pattern: /кризис redux|turmoil redux/i, why: 'the expansion is «Кризис: Возвращение» (glossary § 6-bis)'},
  // «КАРЬЕРА» (TR04, 2026-09-30): the track is never «Повестка» in a parliament line — the word reads as a
  // summons («повестка из военкомата»); the bare `Agenda` key belongs to the Pathfinders resource alone.
  {pattern: /повестк/i, why: 'the Agenda track is «Карьера» (glossary §4)'},
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

  it('the expansion is named «Кризис: Возвращение» in the create-game locale (RU) and «Турбулентність: Повернення» (UA) — glossary § 6-bis', () => {
    const createRu = JSON.parse(fs.readFileSync(CREATE_GAME_RU, 'utf8')) as Record<string, string>;
    const createUa = JSON.parse(fs.readFileSync(CREATE_GAME_UA, 'utf8')) as Record<string, string>;
    expect(createRu[EXPANSION_KEY]).to.equal(EXPANSION_RU);
    expect(createUa[EXPANSION_KEY]).to.equal(EXPANSION_UA);
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

  it('a reading about ANOTHER SEAT keeps no second-person phrase — the subject is named once, by the kicker', () => {
    const missing = THIRD_PERSON_KEYS.filter((key) => ru[key] === undefined);
    expect(missing, 'every third-person key has its RU line').to.deep.equal([]);
    const offenders = THIRD_PERSON_KEYS.filter((key) => SECOND_PERSON.test(ru[key] ?? '')).map((key) => `${key}: «${ru[key]}»`);
    expect(offenders, 'a rival’s reading speaks of «вы»').to.deep.equal([]);
  });

  it('retired keys are neither translated nor referenced', () => {
    const translated = GONE.filter((k) => k in ru);
    expect(translated, 'retired keys still translated').to.deep.equal([]);
    const referenced = sources.flatMap(({p, text}) => GONE.filter((k) => text.includes(`'${k}'`)).map((k) => `${p}: '${k}'`));
    expect(referenced, 'retired keys still referenced').to.deep.equal([]);
  });

  it('the track is named by the `Agenda track` key — the bare `Agenda` key is the Pathfinders resource\'s («Повестка») and never a parliament kicker, crumb tail or panel title', () => {
    const files = [...sources, ...AGENDA_KEY_FILES.flatMap(listFiles).map((p) => ({p: path.relative(ROOT, p), text: fs.readFileSync(p, 'utf8')}))];
    expect(files.length, 'the info surfaces are in the tree').to.be.greaterThan(sources.length);
    const bare = files.filter(({text}) => /'Agenda'|"Agenda"/.test(text)).map(({p}) => p);
    expect(bare, 'a parliament surface prints the bare «Agenda» key').to.deep.equal([]);
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

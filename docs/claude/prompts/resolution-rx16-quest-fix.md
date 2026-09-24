# Промт-фикс · RX16 Joint Research: задание председателя прочитано НЕВЕРНО

Выдан 2026-09-24, поверх сданной RX16 (коммиты `938be2f7bf` A · `17c842f54f` B · `15eff3fc03` D).

**Ошибка в постановке, не в исполнении.** Жёлтый кружок со стрелкой вниз на скане — это **МЕТКА
СОБЫТИЯ** (стандартная иконография Terraforming Mars), а не «сброс карты». Задание председателя у Joint
Research читается: **«Разыграйте 2 карты события»**. Реализованное «сбросить 2 карты» —
и вид задания `cardsDiscarded`, заведённый ради него, — подлежит УДАЛЕНИЮ, а не сохранению «на будущее»:
две оставшиеся неоднозначные карты (`Live Experiments` — жёлтый билет, `Trade Industries` — флот) к
сбросу отношения не имеют, так что вид останется мёртвым кодом.

Скан: `C:\Users\zelin\Downloads\TM Turmoil Redux\Resolutions\Joint Research.png` — сноска внизу справа
читается «2 × [метка события]».

---

## 1. ЛОВУШКА, из-за которой очевидный путь молча не работает

Напрашивается `{kind: 'tag', tag: Tag.EVENT}` — вид задания по метке уже есть. **Он никогда не
засчитается.**

Метка события **не печатается в `card.tags`**: в этом движке она следует из ТИПА карты
(`src/server/player/Tags.ts:156` — `if (target === Tag.EVENT && card.type === CardType.EVENT)`).
А трекер получает метки из `ParliamentHandler` при розыгрыше как `{kind: 'tag', tags: card.tags}` —
`Tag.EVENT` там отсутствует. Задание по метке события тихо застрянет на нуле, и ни один тест «метка
считается» этого не покажет, если он не про события.

**Делай через тип карты**, а не через метку:

- расширь `QuestGoal` → `{kind: 'cardsPlayed', cardType: 'automated' | 'active' | 'event'}`;
- допиши ветку в `QuestTracker.match` (сейчас сравнивает только `CardType.ACTIVE` / `CardType.AUTOMATED`);
- репорт уже существует и уже несёт тип: `QuestTracker.report(player, {kind: 'cardsPlayed', cardType: card.type})`.

Правило Q5 продолжает действовать само собой: розыгрыш под источником-резолюцией и всё вне своей фазы
действий отсекает `QuestTracker.eligible`.

## 2. Что поменять

**Карта** (`src/server/parliament/resolutions/scientists/JointResearch.ts`): `quest` →
`{goal: {kind: 'cardsPlayed', cardType: 'event'}, count: 2}`; `text.quest` → «Play 2 event cards»;
шапочный комментарий файла — переписать абзац про задание (он сейчас утверждает «discard 2 cards»).

**Графика сноски** (`questRender.ts`): по скану это **число + МЕТКА СОБЫТИЯ**, как на физической карте.
Ветка `cardsPlayed` сегодня рисует карту с цветной полосой типа (синяя / зелёная) — для `event` это
чтение не подходит: на карте напечатана метка, а не «красная карта». Нарисуй метку события ×2
(`b.tag(Tag.EVENT)`-путь), оставив существующее поведение `active` / `automated` нетронутым, и объясни
выбор комментарием рядом — как сделано для остальных веток.

**Удалить вид `cardsDiscarded` целиком**:
`QuestGoal` (`ParliamentTypes.ts:111`) · `QuestEvent` и ветка `match` (`QuestTracker.ts:37,97`) ·
ветка `questRender.ts:85` · `ParliamentHandler.onCardDiscarded` (253) · **его вызов в
`Player.discardCardFromHand` (`Player.ts:1812`)** · ключ локали «Discard 2 cards» → «Сбросьте 2 карты»
(`src/locales/ru/parliament.json:792`) · упоминания в тестах.

> ⚠️ **НЕ ТРОГАТЬ одноимённое поле нотификаций.** `EventImpact.cardsDiscarded`
> (`src/common/events/EventImpact.ts:31`, `notificationSemantics.ts`, `notificationFeedPolicy.ts`,
> `aggregate.ts`) — совсем другая сущность (сколько карт сброшено в событии ленты). Совпадение имён,
> никакой связи. Удаление по грепу без разбора сломает нотификации.

**Новые ключи i18n**: «Play 2 event cards» → «Разыграйте 2 карты события». Грепни точную строку по всем
`src/locales/<lang>/*.json` до добавления (сборка падает на дубликате); удали осиротевший старый ключ,
предварительно убедившись, что его больше никто не просит.

**Спек** (`docs/TURMOIL_REDUX_SPEC.md`): строка каталога 441 — задание «2 карты события»; в `Q-4`
Joint Research **закрыт** (значок опознан как метка события), `Live Experiments` и `Trade Industries`
остаются открытыми. Док карты `docs/TURMOIL_REDUX_JOINT_RESEARCH.md` и журнал
`docs/claude/parliament-sitting-progress.md` — привести в соответствие.

## 3. Тесты и фикстуры

- `tests/parliament/JointResearch.spec.ts` (три места: объявление задания, определение в парламенте,
  матчинг трекера) — переписать на новый вид; добавить спеки: **розыгрыш события засчитывается**,
  розыгрыш `automated` / `active` — нет, розыгрыш под источником-резолюцией — нет, добор самой
  резолюцией — нет;
- `tests/client/components/console/levelYieldModel.spec.ts:66`;
- **фикстуры** `parliament-research-vote` / `parliament-research-enact` — перегенерить точечно
  (`FIXTURES=… npm run e2e:fixtures`);
- **e2e `tests/e2e/console-parliament-research.spec.ts`**: проверка сноски утверждает «карта со стрелкой
  вниз — расставание, не добор» (строки ~85–97) — переписать на метку события. Прогнать **только этот
  один спек**; новых e2e не добавлять.
- `npm run lint`, `npm run build:test`, `npm run make:cards` (сноска на лице пересобирается), проверить
  `src/genfiles/parliament.json` на отсутствие `cardsDiscarded`.

Глазами один кадр: лицо резолюции со сноской задания.

## 4. Режим работы

Один коммит («RX16 · задание: 2 карты события вместо сброса; вид `cardsDiscarded` удалён»). Зелёные
юниты, **не пушить**.

В отчёте: подтверждение, что `cardsDiscarded` не осталось нигде, кроме нотификационного
`EventImpact`; как нарисована сноска и почему; результат прогона одного e2e; новые/удалённые ключи i18n.

## 5. Нельзя

Реализовывать задание через `{kind: 'tag', tag: Tag.EVENT}` (молча не засчитается). Оставлять вид
`cardsDiscarded` «про запас». Удалять или переименовывать `EventImpact.cardsDiscarded`. Гонять весь
парламентский набор e2e. Пуш и красные коммиты.

# Промт исполнителю · P85 Summit Logistics («Саммит логистикс» → см. решение 1) — ВТОРАЯ карта Prelude 2 и ПЕРВАЯ ПОЛИТИЧЕСКАЯ карта серии, «на месте» (`docs/PRELUDE2_ADAPTATION.md` §3.1, формы 1 + 5 — декларативная + ПОЛИТИЧЕСКАЯ): зелёная (автоматическая), 10 M€, метки Здание + Космос; «Требует, чтобы Учёные были у власти или у вас было 2 делегата там. Получите 1 M€ за каждую вашу метку планеты и колонию. Доберите 2 карты» — `requirements: {party: SCIENTISTS}` (Redux: правят ИЛИ 2 ваших делегата на их резолюции — фасад `game.politics`, уже работает), `stock.megacredits: {tag: [JOVIAN, EARTH, VENUS, MARS], colonies: {colonies: {}}}` — СЧЁТНЫЙ бонус с ДВУМЯ базами (метки ИЛИ + колонии), `drawCard: 2` — простой добор (класс T14, встроенная стадия «ДОБОР КАРТ») · РАБОТА КАРТЫ (≈ 35 %): маркер `politics: 'redux'`, честное лицо (метка Марса ЖИВАЯ в форке — восемь карт Redux её несут, а печать P85 её не рисует: решение 2), `infoText` по блоку на бонус, лор, арт, RU, строка долой, спек с Redux-таблицей по образцу T09 · ГЛАВНОЕ (≈ 65 %) — ПРОХОД ЦЕПОЧКИ ГЛАЗАМИ НА БОКСЕ + СТЕНД КЛАССА «ПОЛИТИЧЕСКОЕ ТРЕБОВАНИЕ В РУКЕ (две дороги, standing) → СЧЁТНЫЙ ЧИП С ДВУМЯ БАЗАМИ, КОТОРЫЙ ОБЪЯСНЯЕТ СЕБЯ («+5 = 3 метки планет + 2 колонии») → ОПЛАТА СТАЛЬЮ И ТИТАНОМ (два альтернативных источника на одной карте) → ВСТРОЕННЫЙ ДОБОР → УХОД», ноль молчаливых потерь, ноль блинков, один POST

> **Статус: ВЫДАН 2026-10-29.** HEAD `abd43e3df7` (P76 Ishtar Expedition СДАНА — `75d6ce23e4` карта · `6d9a244730` стенд · `abd43e3df7` доки; ворклист **1 / 54**;
> журнал серии `docs/claude/prelude2-cards-progress.md` открыт — твоя запись вторая; промт-образец серии — `docs/claude/prompts/prelude2-p76-ishtar-expedition.md`,
> его §0–§9 и чек-лист A–M — твоя форма; здесь — только то, чем P85 ОТЛИЧАЕТСЯ).
> Сосед держит незакоммиченные `package.json` / `package-lock.json` — НЕ коммитить и не чинить; хук версии бампает `package.json` сам.
> Арт — `C:\Users\zelin\Downloads\Mars Arts\P85.png` (ожидается 1536×1024; иному размеру скрипт ОТКАЗЫВАЕТ — `--force` не ставить, спросить).
> Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\projects\Prelude 2 & Turmoil - P85 - Summit Logistics.png`.
> Лор — СО СКАНА, дословно: «Train and shuttle services, welcoming scientists up to the Olympus Conference» (без точки на печати — добавить; гард лора).
> Реестр: последний раздел **CQ**, последний номер **PL-1120** (P76 раздела не брал — его находки записаны в журнал как решения класса/владельца) → эта задача
> берёт **CR**, номера — по footer В МОМЕНТ записи на своём HEAD.
> **e2e — ТОЛЬКО Steam Machine** (`npm run build` → `npm run e2e:snapshot p85` → `npm run e2e:remote -- p85 <spec…>`; exit 2/3/4 → СТОП и `AskUserQuestion`).
> **Коммит — сам по окончании, явными путями; сразу после коммита — пуш** (fast-forward; ветка позади → спросить владельца, чужое не трогать).

Процедура — `docs/PRELUDE2_ADAPTATION.md` ЦЕЛИКОМ (§1 — политические карты и маркер; **§3.1 п. 1 и п. 5** — форма ПОЛИТИЧЕСКАЯ; §2.5 — гард «политическая карта,
ушедшая из списка, помечена `politics: 'redux' | 'both'`»; §4; §5), `docs/claude/prelude2-cards-progress.md` (запись P76 — «Найдено» 1–3 и «Что даром следующим
картам»: НЕ переоткрывать, ссылаться), `docs/claude/expansion-adaptation-checklist.md` (таблица подсистем — каждую строку в отчёт «даром / сделано / не касается»;
«Turmoil» в gotchas), `docs/claude/turmoil-redux-card-checklist.md` §0 (чтение скана), §3, §7, `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1 п. 1 и п. 4 (политика
через фасад; спек-таблица Redux через `tests/parliament/parliamentArrange.ts`, никогда голой записью в слот), промты-образцы **`classic-t09-pr-office.md`** (карта
с требованием партии + СЧЁТНЫМ бонусом M€ за метки — ближайший родственник: `infoText` по блоку, превью с базой, «две дороги» со standing) и
`classic-t14-supported-research.md` (добор 2 — встроенная стадия).
**Контракты цепочки** — те же, что у P76 (CLAUDE.md § A WORKSPACE IS ONE FLOW, § ACTION COMMIT, инварианты 2 · 4 · 6 · 9 · 13 · 14 · 15 · 16; `console-ui.md` §
EMBEDDED STEP SURFACES, § A COMPOSER PRE-SELECT; `game-logic.md`; `card-intake-one-batch.md`), плюс: `docs/claude/parliament-glossary.md` (ОДИН глоссарий:
резолюция «принимается / принята», «у власти», «ваших делегата на их резолюции» — гард `parliamentGlossary.spec`), `docs/claude/console/composer-preselect.md`,
`docs/claude/console/countedPlay`-семья (см. образцы), `tests.md` § «TURMOIL REDUX: A SPEC OR A FIXTURE NEVER ASSUMES THE DEAL». Память: `rules-first`
(свод Redux важнее словесного описания), `redux-rules-outrank-owner-description`, `ru-tag-terminology-metka`, `card-intake-one-batch-prompt`, `hand-pick-always-album`,
`upstream-spec-encodes-upstream-rules`, `e2e-only-on-steam-machine`, `e2e-fixture-generator-gotchas`, `commit-at-end-of-work`, `push-right-after-commit`,
`git-commit-explicit-paths-shared-index`, `split-commits-by-hunk-temp-index`, `shell-template-escapes`, `perl-splice-utf8-double-encoding`, `unit-suites-need-a-quiet-machine`.

**Образцы — по частям:** требование партии — `cards/requirements/PartyRequirement.ts` (ОДИН предикат через фасад: правят ИЛИ 2 делегата на резолюции; вейвер
Backroom Deal TR70 — «снято»), причина руки — `models/unplayableReasons.ts:96–146` (`RequirementType.PARTY` — «вся печатная правило» в НАЗВАННОЙ форме;
`PARTY_REQUIREMENT_REASON`, `params: [party, '2']`, `current`, `partyOffVote`), лицо — `premiumCard/PremiumPartyRequirementGlyph.vue` + `premiumCardViewModel.ts:304/344`
(плашка партии); счётный бонус — `models/actionPreview.ts:405–470` (`countableBasis`: МАССИВ меток → ОДИН термин `'Your tags'` БЕЗ иконки — «an OR of tags has no
single icon — it keeps the label alone»; `colonies` → второй термин `'Your colonies'`), клиентское чтение — `console/countedPlay.ts` (`handForecastPlate` — плита
руки «[M€] +N»; **`whyTermOf :231` — «A basis of two or more plain terms has no one reason to name — its chip keeps its pill»** → у P85 композер НЕ объяснит число;
`countGlyphOf :160` — «an OR of tags reads as words»), `ModelUtils.countedPlayEffects` → `CardModel.countedPlay` (T09 спек `:223`); родственник T09 —
`turmoil/PROffice.ts` (`infoText` «Gain 1 M€ for each Earth tag you have, including this.» — ОДИН блок на бонус; `description` с требованием) и его спек
`tests/cards/turmoil/PROffice.spec.ts:57–160` (стол `table()` / `parliamentTable()` / `unityRuling()` / `twoDelegates()`; «0 of 2», «1 of 2», `partyOffVote`,
«a card-granted EFFECT is not a road» — FAQ p.19; `:208–231` — превью с базой, read-only; `:260` — MarsBot-стол: считаются ТОЛЬКО метки человека); колонии —
`behavior/Counter.ts:228–235` (ОДНО чтение своих колоний — `ColoniesHandler.coloniesOf`); лицо и проза — `premiumCard/mechanicsModel.ts:500–510, 597–650`
(`plainText` = ПРОЗА, на иконочном лице ОТБРАСЫВАЕТСЯ — «belongs to the fullscreen info panel»; ряд из одной прозы схлопывается); генератор текста —
`tools/cardInfo/buildCardInformation.ts:535` («Gain N …» — для СЧЁТНОГО количества числа нет → ожидай `needsCuration` → авторский `infoText`, как у T09),
гард KEY-rule — `tests/cards/cardInformation.spec.ts:388–400` (без `description` — пропуск; с `description` — word-diff против сгенерированного);
маркер — `cards/CardFactorySpec.ts:20–30` (`politics?: 'classic' | 'redux' | 'both'`; «never widening the Redux pool by API presence»); гард —
`tests/cards/prelude2/Prelude2CardsHeldBack.spec.ts:99–110, 206–211` (`isPolitical` / `reachesRedux`); метка Марса в скоупе —
`turmoilRedux/{CouncilSeat,FormulaZero,LobbyingCampaign,MartianCensus,AdministrationDistrict,MarsArmyMechs,MarsArmyShips,MarsFirstCampaign}.ts`; оплата двумя
источниками — `tests/e2e/console-payment-panel.spec.ts` (`:144` compact ⇄ expanded; `:270` «one alternative source» — ДВУХ источников свидетеля нет); добор 2 —
`console-play-draw-embed.spec.ts:259`; рецепты — `tests/e2e/fixtures/generate.ts` (`parliamentFixture :1413` поверх `reduxTable :1347` — `...options` принимает
`prelude2Expansion`; `supported-research :9090` — `seatEnacted(parliament, quietResolutionOf(SCIENTISTS))` + `moveToDeckTop` + карта в руку; колонии —
`track(ColonyName…)` `:3961+`); Olympus Conference по-русски — `ru/cards.json:596` «Конференция на Олимпе».

---

## Диагноз (подтверждён файл:строка на `abd43e3df7`; перепроверить на своём HEAD)

### Карта
1. **Код верен по правилам, но лицо и текст — нет.** `prelude2/SummitLogistics.ts`: `AUTOMATED`, `cost: 10`, `tags: [BUILDING, SPACE]`, `requirements: {party:
   SCIENTISTS}`, `behavior.stock.megacredits: {tag: [JOVIAN, EARTH, VENUS, MARS], colonies: {colonies: {}}}`, `drawCard: 2`, `cardNumber: 'P85'`. **`description` НЕТ** —
   правило живёт двумя `plainText`-рядами рендера: само правило (RU есть — `ru/prelude2_cards.json:64`, не в голосе набора) и **«(FAN EXPANSION NOTE: This includes
   Mars but not The Moon.)»** (RU `:65`). Рендер: `1 M€ / [J] [E] [V] [колония]`, `cards(2)` — совпадает с печатью (Марса на печати НЕТ), но НЕ с `behavior` (Марс
   считается). Манифест: `compatibility: 'turmoil'` БЕЗ `politics` (`Prelude2CardManifest.ts:62`) → после удаления строки гард §2.5 падает, пока не стоит
   `politics: 'redux'`.
2. **Чтение скана (§0):** «10» — цена; плашка «[колба]» — ТРЕБОВАНИЕ «Учёные» (не метка); кружки справа — Здание (коричневый) + Космос (звезда) — метки; слева
   внизу — значки дополнений (Prelude 2 «<», Turmoil-шестиугольник «нужен политический движок» — у карты модуля `prelude2` это `compatibility: 'turmoil'`, который в
   форке ОБЯЗАН нести `politics: 'redux'`); «P85» — номер; текст — «(Requires that Scientists are ruling or that you have 2 delegates there. Gain 1 M€ per planet tag
   and colony you have. Draw 2 cards.)»; лор — курсив.
3. **Метка Марса — ЖИВАЯ в форке.** Pathfinders вне скоупа, но ВОСЕМЬ карт Turmoil Redux несут `Tag.MARS` (Council Seat, Formula Zero, Lobbying Campaign, Martian
   Census, Administration District, Mars Army Mechs / Ships, Mars First Campaign). Апстримный «fan note» описывает ровно ситуацию форка («Mars — да, Луна — нет»),
   а печать P85 рисует только Юпитер + Землю + Венеру. Свод Redux термина «planet tag» не определяет (grep по спекам/анализу пуст). → решение 2.
4. **Счётный чип с ДВУМЯ базами не объясняет себя.** Сервер шлёт `basis = [{count, label: 'Your tags'} (без `tag` — массив), {count, label: 'Your colonies'}]`
   (`countableBasis`), а клиент (`whyTermOf`) при двух простых терминах оставляет чип голой пилюлей «+5 M€»: ни «ПОЧЕМУ» в композере, ни «ДЛЯ ВАС» в осмотре, плита
   руки — «[M€] +5» без разбивки. Это ПЕРВАЯ карта скоупа с двухтерминной базой (T09 — одна метка; TR23/TR43 — один термин; TR45 — композиция одного термина). Игрок
   не видит, что 5 = 3 метки + 2 колонии. → решение 3 (класс, CR).
5. **Колонии при выключенном дополнении.** `compatibility: 'turmoil'` → карта раздаётся и БЕЗ Colonies; термин `'Your colonies'` тогда честный 0 — но «ПОЧЕМУ» со
   строкой «колоний: 0» на столе, где колоний не бывает, читается как упрёк. → решение 4.
6. **Что даром:** требование (фасад + причина руки со standing: «Учёные: 0 из 2», `partyOffVote`, вейвер), плашка партии на лице, чипы превью (M€ счётный, +2 карты),
   `CardModel.countedPlay` (плита руки), стадия «ДОБОР КАРТ», оплата сталью И титаном (обе метки — панель двух источников), журнал, уведомления, финальный счёт (метки
   Здание + Космос считаются — карта автоматическая), MarsBot-стол (только метки человека — T09 `:260`). Хуков нет → двойников нет; `OrOptions` нет → триаж «не касается».
7. **Карта НЕ достижима из создателя** (§1 / §5) — рецепт фикстуры: `turmoilReduxExpansion` (`reduxTable` даёт сам) + `coloniesExtension` + `prelude2Expansion: true`.
8. **Локаль.** RU-имя «Саммит логистикс» (`ru/prelude2_cards.json:63`) — ломаная транслитерация (ни «Лоджистикс», ни перевод). RU описания — не в голосе
   («правящей партией партией были Ученые»). Лора `P85` нет; арта `P85.webp` нет.

## Правила карты (спек пинит каждое; апстримный блок спека — байт в байт, он на КЛАССИЧЕСКОМ столе и остаётся зелёным через фасад)
1. Зелёная, 10, Здание + Космос, без ПО, плашка Учёных; номер P85; манифест — `compatibility: 'turmoil'` + `politics: 'redux'`.
2. Требование на Redux-столе — две дороги (`satisfiesPartyRequirement`): ни одной → «0 из 2» (`PARTY_REQUIREMENT_REASON`, `current: 0`); один делегат → «1 из 2»;
   резолюция Учёных не на голосовании → `partyOffVote`; два делегата → можно; Учёные у власти → можно; дарованный ЭФФЕКТ партии — не дорога (FAQ p.19); вейвер
   TR70 — снято. Оплата: M€ + сталь (Здание) + титан (Космос) — оба предлагаются.
3. Розыгрыш → M€ = (свои метки Юпитера + Земли + Венеры [+ Марса — решение 2]) + свои колонии; метки событий не считаются, wild — считается (как T09 `:185`), чужие — нет;
   на столе с MarsBot — только метки человека; ноль меток и колоний → 0 M€ и ЧЕСТНЫЙ ноль (плита «0», чип называет ноль, в журнале нет «+0»); затем добор 2
   (встроенная стадия; карты в руку; одна пачка). Порядок журнала — M€ (`stock.add`), затем добор.
4. Превью (`cardPlayPreview`) — декларативное, read-only: чип M€ с ДВУМЯ терминами базы (счёт меток, счёт колоний — числа сервера), чип «+2 карты»;
   `countedPlayEffects` — то же число для плиты руки. Под RX42 / RX35 — не касается (РТ нет).
5. Раздача: с Redux + Prelude 2 — карта в колоде (`Prelude2CardsHeldBack` «deals exactly manifest − list» под Redux — только с маркером); без Prelude 2 — нет;
   Colonies выключены — карта есть, колоний 0. Save / reload — ничего нового.

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте; ОДИН батч `AskUserQuestion` — решения 1–4, рекомендация первой)
1. **RU-имя** — (а, рекомендовано) «Логистика саммита» (транслитерация «Саммит логистикс» — дефект, не имя); (б) оставить. RU-описание — в голос набора:
   «Требует, чтобы «Учёные» были у власти или у вас было 2 делегата на их резолюции. Получите 1 M€ за каждую вашу метку планеты (Юпитер, Земля, Венера[, Марс]) и
   за каждую вашу колонию. Доберите 2 карты.» Лор RU — «Поезда и шаттлы, везущие учёных наверх — на Конференцию на Олимпе.» (имя карты — как в `cards.json`).
2. **Метка Марса** — (а, рекомендовано) МАРС СЧИТАЕТСЯ (апстрим; в форке метка живая, и это единственное честное чтение «planet tag» за столом, где Марс — метка),
   и ЛИЦО ГОВОРИТ ПРАВДУ: рендер `1 M€ / [J] [E] [V] [M] [колония]` (добавить `.tag(Tag.MARS)`), строка «FAN EXPANSION NOTE» из рендера УБРАТЬ, правило перенести
   из `plainText` в `metadata.description` (новый EN-ключ с перечислением планет: «… Gain 1 M€ per planet tag (Jovian, Earth, Venus or Mars) and per colony you
   have. Draw 2 cards.» — RU к нему; старые RU-ключи двух `plainText` удалить, ТОЛЬКО если i18n-аудит `lint` помечает их неиспользуемыми — они принадлежат этой
   карте); (б) печать дословно — Марс из `behavior` убрать (расходится с апстримом и с живой меткой форка; придётся держать расхождение при каждом синке). Луна —
   вне скоупа, не упоминать нигде.
3. **Счётный чип с двумя базами ОБЪЯСНЯЕТ СЕБЯ** (диагноз 4) — (а, рекомендовано) класс в общем слое, раздел **CR**: `countedPlay.ts` читает МНОГОТЕРМИННУЮ базу как
   композицию — композер «ПОЧЕМУ» и осмотр «ДЛЯ ВАС» печатают «+5 M€ = 3 · метки планет [J][E][V][M] + 2 · [колония]» (числа — термины сервера, глифы — иконки
   меток массива и глиф колонии; `countGlyphOf` получает термин «OR меток» как РЯД иконок, не слова), плита руки — как сейчас («[M€] +5», лестница
   `HAND_PLATE_MAX_ITEMS`); ноль — названный («нет меток планет и колоний»); серверная сторона: `countableBasis` для МАССИВА меток кладёт в термин `tags: [...]`
   (новое поле `ActionEffectBasis`, старое `tag` не трогать), чтобы клиент рисовал ряд, не угадывал; гарды: `countedPlay.spec` (двухтерминная база — композиция;
   однотерминная — как была, PL-196), `actionPreview`-спек базы, `composerRender` «ПОЧЕМУ» для двух терминов; (б) оставить пилюлю — игрок не видит, откуда число.
4. **Колонии при выключенном Colonies** (диагноз 5) — (а, рекомендовано) термин колоний в базе НЕ ВЫДАЁТСЯ, когда `coloniesExtension` выключен (правило класса в
   `countableBasis`: термин сущности, которой на столе не бывает, — не термин; `count` сервера не меняется — он и так 0); лицо печатает глиф колонии как на печати;
   (б) выдавать «колоний: 0».
5. **Свой e2e-стенд — ДА** (первая политическая карта серии + классы «две дороги в руке», «чип с двумя базами», «оплата двумя источниками» — без свидетеля):
   `tests/e2e/console-summit-logistics.spec.ts`, фикстуры `summit-logistics` (Redux, Colonies, Prelude 2; Учёные у власти — `seatEnacted(quietResolutionOf(SCIENTISTS))`;
   p1 — корпорация с меткой Земли (Teractor) + 1–2 карты с метками планет в `playedCards` + ОДНА колония; сталь ≥ 2 и титан ≥ 1 для микса; карта в руке; M€ ≥ 10) и
   `summit-logistics-locked` (резолюция Учёных НА голосовании, 0 делегатов → «0 из 2»). Вторая дорога (2 делегата) и `partyOffVote` — серверный спек; Colonies OFF —
   серверный спек.
6. **Журнал серии** — запись в `docs/claude/prelude2-cards-progress.md` (строка таблицы + раздел по форме P76); `docs/PRELUDE2_ADAPTATION.md` — шапка «2 / 54»,
   строка P85 «СДАНА …», §3.1 п. 5 — одно предложение, если проход уточнил маршрут политической карты (маркер + фасад + Redux-таблица спека — уже написано).
7. Тумблер / `DECK_COMPOSITION_EXPANSIONS` / Автома — НЕ эта задача (§5).

## 0. Рабочее дерево
1. `git log --oneline -1` → `abd43e3df7`. **Сначала** `ListAgents` + процессы; `SendMessage` живым соседям: твои файлы — `prelude2/SummitLogistics.ts`,
   `Prelude2CardManifest.ts` (одна строка — маркер), `tests/cards/prelude2/SummitLogistics.spec.ts`, `common/cards/prelude2Adaptation.ts` (одна строка долой),
   `assets/text/lore_texts.json`, `assets/card-images/P85.webp` (+ манифест/миниатюра из `make:cards`), `ru/{prelude2_cards,card_info,lore_texts}.json`, `src/genfiles/*`,
   фикстуры + стенд, доки; **по решению 3–4** — `models/actionPreview.ts` (`countableBasis`), `common/models/ActionPreviewModel.ts` (`ActionEffectBasis.tags`),
   `console/countedPlay.ts`, композер «ПОЧЕМУ» / осмотр «ДЛЯ ВАС» (объявить соседям ДО правки). Коммиты явными путями; лор — своя строка; после коммита — пуш.
2. e2e — только бокс; фикстуры: `FIXTURES=summit-logistics,summit-logistics-locked npm run e2e:fixtures` (имена в `FixtureName` ДО сборки); `TM_E2E_STORYBOARD=1`.
3. Юниты — последовательно, на тихой машине; `npm run build:test` обязателен.

## 1. Сервер — карта (≈ 25 %)
- `SummitLogistics.ts` — по решению 2: рендер (Марс), `metadata.description` вместо `plainText`-правила, fan note долой; **`infoText` по блоку на бонус** (генератор
  не умеет счётное число — ждать `needsCuration`): `{text: 'Gain 1 M€ for each planet tag (Jovian, Earth, Venus or Mars) you have and for each colony you have.',
  tokens: ['megacredits']}`, `{text: 'Draw 2 cards.', tokens: ['cards']}` (если генератор сам засеял блок добора — не дублировать; блок требования — авто);
  порядок = порядок чтения лица; KEY-rule гард word-diff против новой `description` — слова совпадают.
- Манифест: `politics: 'redux'` (не `'both'` — классического стола в создателе нет; `'both'` только если апстримный спек на классике того потребует — он идёт
  через `canPlay` + фасад и `'redux'` ему не мешает: маркер читает только раздача).
- Лор EN + RU; арт (`node scripts/import-card-art.mjs "C:\Users\zelin\Downloads\Mars Arts\P85.png" P85` → `make:cards`); RU (решение 1); `card_info` RU
  (grep ключа по всем локалям ДО добавления; «метка» — канон); строка `SUMMIT_LOGISTICS` долой; `make:cards` 0 / 0 / 0, `make:json`.
- **Спек** `SummitLogistics.spec.ts`: апстримный блок (классика) — байт в байт; `describe('on a Turmoil Redux table')` по форме T09 `:57–160`: правила 1–5 по одному
  `it` (столы через `parliamentArrange`: `seatResolution` / `seatEnacted` / `quietResolutionOf` / `placeVote`), + «счёт меток: Юпитер + Земля + Венера + Марс (карта
  Redux с меткой Марса в `playedCards`), событие не считается, wild считается, чужие — нет», «колонии: 2 свои → +2; чужие — нет; Colonies OFF → 0 и термина нет
  (решение 4)», «превью: два термина базы с числами сервера (решение 3 — `tags` массив); read-only», «`countedPlayEffects` = та же сумма», «ноль — честный»,
  «добор 2 — одна пачка, источник карта», «MarsBot-стол», «раздача под Redux только с маркером», «save / reload».

## 2. Клиент — карта (≈ 10 %)
Даром: плита руки с причиной партии (standing), плашка Учёных на лице, композер, панель оплаты двух источников, стадия добора, док, журнал. Расхождение = класс → §3 / §7.
Решения 3–4 — класс в общем слое (§3.Б).

## 3. ГЛАВНОЕ — ПРОХОД ЦЕПОЧКИ ГЛАЗАМИ И СТЕНД (≈ 65 %)
Форма — чек-лист P76 A–M (таблица «пункт · должно · увидел · ✓ / PL-#»); здесь — чем P85 отличается:
- **A. Рука.** Плита: цена 10, Здание + Космос, зелёная, плашка Учёных; при «0 из 2» — ЗАПЕРТА, причина называет партию и standing («Учёные: 0 из 2 делегатов» в
  грамматике причин / глоссария — не выдумывать копию); при Учёных у власти — играбельна; плита несёт счётный прогноз «[M€] +N» (`handForecastPlate`); X —
  полноэкранный: дороги требования, «ДЛЯ ВАС» с разбивкой (решение 3).
- **B. Осмотр.** Арт P85, лор, блоки: требование · M€ за метки планет и колонии · добор 2; лицо — `1 M€ / [J][E][V][M] [колония]`, `[карта][карта]`; прозы на лице НЕТ.
- **C. Композер.** Чип «+5 M€» и «ПОЧЕМУ» = «3 · [J][E][V][M] + 2 · [колония]» (решение 3); чип «+2 карты»; ОПЛАТА: панель предлагает сталь И титан (два альтернативных
  источника — compact ⇄ expanded, RT заполняет, LT редактирует; CTA читает смешанную цену «Разыграть · 4 M€ + 2 [сталь] + 1 [титан]» в существующей грамматике);
  курсор прибывает на CTA, A в окне прибытия поглощён.
- **D. Коммит.** Цена уходит с рельса ВБОК в печатную стоимость — три жетона (M€, сталь, титан), каждый ряд тикает на уходе; награда M€ рождается после — из центра
  карты (P76 «Найдено 2» — класс, не переоткрывать) и садится в ряд M€ с тиком.
- **E. Добор.** Встроенная стадия «ДОБОР КАРТ», простой добор — ленты и лотка НЕТ (две карты с колоды); B — «Забрать все»; взятие в док.
- **F. Уход.** Флоу ЛЕВИТ на доску; карта — в таблице «РАЗЫГРАНО» (зелёная), HUD меток: Здание +1, Космос +1.
- **G/H. Журнал / соперник.** Запись: карта, токен «+5 M€» (с базой, если журнал её несёт — проверить, не выдумывать), дочерняя строка добора; соперник — «+5 M€ · добрал
  2 карты», имена карт не раскрыты.
- **I. «Сработает».** Реакторы на метки Здание / Космос в скоупе (grep `onCardPlayed` ∧ `Tag.BUILDING | Tag.SPACE`) — если дёшево, один в фикстуру (честный прогноз + CN).
- **J. Честные края (сервер).** Ноль; Colonies OFF; `partyOffVote`; вейвер TR70.
- **K. Две дороги в консоли (по возможности в стенде):** после `-locked` — ПРОГОЛОСОВАТЬ двумя делегатами за резолюцию Учёных через Парламент (существующий драйвер e2e
  ходьбы/голосования) → вернуться в руку → плита ОТКРЫЛАСЬ, причина исчезла, без перезагрузки (WS/poll) — сервер-авторитетно. Если драйвер дорог — серверный спек + запись в отчёт.
- **L/M.** Как у P76.

Стенд `console-summit-logistics.spec.ts`: (1) `-locked` — заперта, причина «0 из 2», 0 POST; (2) основная — рука (плита «+N») → композер (ПОЧЕМУ с двумя терминами;
оплата: RT сталь + титан, CTA со смешанной ценой) → A → ОДИН POST → три жетона цены → «+N» M€ → стадия добора в ТОЙ ЖЕ крошке → взятие → доска; сервер: M€ = было − 4 + N,
сталь − 2, титан − 1, рука +2; журнал — одна запись. Хуки — существующие; новый — только если ни один не различает проверяемое (`e2eLiveness`).

### 3.Б Класс «счётный чип с двумя базами» (решения 3–4, раздел CR)
`ActionEffectBasis.tags?: ReadonlyArray<Tag>` (массив меток термина — сервер) · `countableBasis` (массив → `tags`; колонии — не термин без Colonies) · `countedPlay.ts`
(`countedWhyOf`: многотерминная база = композиция терминов; `countGlyphOf` — ряд иконок для `tags`) · композер «ПОЧЕМУ» и осмотр «ДЛЯ ВАС» (те же читатели) · спеки
(`countedPlay.spec`, спек базы превью, `composerRender`) · RU-ключи (grep ДО добавления) · e2e-хуки, если изменилась разметка, — тем же диффом.

## 4. Лицо, локаль, лор, арт
Арт P85; лор EN + RU; RU имя/описание (решение 1); новая `description` (решение 2) + RU; `card_info` RU; «метка», «у власти», «на их резолюции» — глоссарий; чужой RU
не переписывать; `title` запрещён; глифы — через `GamepadGlyph`.

## 5. Тесты
1. Спек карты. Гарды после удаления строки: `Prelude2CardsHeldBack` (13 — в т.ч. «adapted political … politics: 'redux'»), `premiumScope`, `cardPlayPreviewCoverage`,
   `cardInformation` (KEY-rule против новой `description`; порядок блоков), `requirementProse`, `premiumCardViewModel`, `premiumCardIcons`, `cardLore`,
   `crossPlayerCoverageGuard`, `cardIntakeSourceCoverage`, `parliamentGlossary`, `PoliticalThinkTank.spec`-класс (пул карт с требованием партии — если он пинит
   состав, P85 в него входит), `e2eLiveness`, `glowRestraintGuard`, `glyphLiteralGuard`, `lessDeadSelectorGuard`, `tests/client/i18n.spec.ts`.
2. `build:server`, `build:test`, `lint` (i18n-аудит: старые `plainText`-ключи), `make:cards` 0 / 0 / 0, `make:json`.
3. e2e: свой стенд ×2; `npm run e2e:affected`; регрессия класса — `console-payment-panel`, `console-play-draw-embed`, `console-composer-preselect`, `console-hand-pick-preselect`,
   стенды счётных карт (TR45 `console-composting-initiative`-класс, TR23, TR43 — «ПОЧЕМУ» однотерминных не изменилось), `console-ishtar-expedition`.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV первым**, `--exclusive`, `TM_E2E_STORYBOARD=1`; fhd обязателен)
`screenshots/p85/{tv4k,fhd}/`: (а) плита заперта «0 из 2» / открыта при Учёных у власти, плита «+N»; (б) композер: «ПОЧЕМУ» с двумя терминами, панель оплаты с двумя
источниками, CTA со смешанной ценой; (в) коммит: три жетона цены в печатной стоимости, «+N» в ряд M€; (г) стадия добора в той же крошке; (д) доска после ухода, HUD меток,
журнал; (е) осмотр X из стадии. Своим глазом: «я вижу, ИЗ ЧЕГО сложились 5 M€, ЧЕМ я заплатил и ПОЧЕМУ карта была заперта?»

## 7. Полировка по пути
1. Реестр **CR** «P85 · СЧЁТНЫЙ ЧИП С ДВУМЯ БАЗАМИ ОБЪЯСНЯЕТ СЕБЯ · ТЕРМИН БЕЗ СУЩНОСТИ — НЕ ТЕРМИН» — решения 3–4 строками «что было / что стало / где» + всё, что проход
   показал не по классу; номера — по footer. Без гэпов — только журнал.
2. Доки: журнал серии (запись P85), `PRELUDE2_ADAPTATION.md` (2 / 54; строка; §3.1 п. 5 при необходимости), `docs/claude/console/composer-preselect.md` или
   контракт счётного чипа (где живёт «ПОЧЕМУ» — найти и дописать раздел «многотерминная база»), память `prelude2-adaptation.md` (2 / 54).

## 8. Режим работы
1. Читать до кода. Порядок: карта (решение 2) + маркер + спек + строка долой → лор / арт / RU → `make:cards` → решения 3–4 (класс + юниты) → фикстуры + стенд → проход
   A–M на боксе + раскадровка → CR → доки / журнал / память. Коммиты по шагам явными путями, после каждого — пуш.
2. Отчёт: первой строкой — арт; таблица подсистем чеклиста; таблица A–M с кадрами; POST на розыгрыш; гарды и `make:cards`; регрессия на боксе (аннотация `build`);
   решения 1–7 (что сделано по умолчанию); ОДИН батч `AskUserQuestion` по решениям 1–4; гэпы честно; что ушло в пуш.
3. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Читать политику мимо фасада (`Turmoil.getTurmoil`, `game.turmoil`); голую запись в слот Парламента в спеке/фикстуре; `'both'` без причины; снимать Марс из
  `behavior` без решения владельца; оставлять fan note в рендере, если принято 2(а); второй форматтер базы / второе чтение колоний; детектить промпт по заголовку;
  выводить доступность на клиенте; прятать запертую карту; «колоний: 0» на столе без Colonies, если принято 4(а); `title`; литерал кнопки; ореол; таймер вместо холда.
- Удалять из `prelude2Adaptation.ts` что-либо, кроме СВОЕЙ строки; трогать тумблер, `DECK_COMPOSITION_EXPANSIONS`, `automaCompatibility`, дев-пикер; переоткрывать
  находки P76 1–3 как новые гэпы.
- Мёртвые `data-*`-хуки / `a, b`-фолбэки; `--workers=4`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `git stash`; `git add -A`; `--force` /
  `--no-verify`; коммитить `package.json` / `package-lock.json` соседа; пересборку во время прогона e2e на боксе.

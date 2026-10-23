# Промт исполнителю · T03 Cultural Metropolis («Культурный метрополис») — девятая классическая карта Turmoil под Redux, «на месте» (§3.1): зелёная, 20, Город + Здание; требует «Союз» у власти или 2 ваших делегата на его резолюции; −1 пр. энергии, +3 пр. M€; ГОРОД; 2 ДЕЛЕГАТА НА ОДНУ РЕЗОЛЮЦИЮ — ПЕРВАЯ классическая карта с ПОЛИТИЧЕСКИМ ЭФФЕКТОМ (список «эффект читает движок напрямую» — фасад уже ждёт её по имени: `PoliticalOps.ts:31`) и ПЕРВЫЙ розыгрыш с ДВУМЯ ДВЕРЯМИ (staged-клетка города + голосование) · ГЛАВНОЕ — ПОЛИРОВКА ВИЗУАЛА (≈ 70 %) «ИГРОВОЙ ПЛАНШЕТ — ЛЕВАЯ ПАНЕЛЬ НА 4K: МАТЕРИАЛ, НЕ ФОРМА»: самые видимые пиксели продукта (ресурсы · производство · счёт · метки, на экране ВСЕГДА) — плоские серо-синие плиты с жирной цифрой и коричневой пилюлей «+0», метки — кружки с серой цифрой; правый рельс (золотые медальоны) и лица карт задают премиум-планку, до которой левая панель не дотягивает; при этом её ФОРМА (сетка рядов, токены, якоря полётов) — зрелый контракт, который нельзя сдвинуть ни на пиксель

> **Статус: ВЫДАН 2026-10-23.** HEAD `fcd6fb7374`. **T10 Public Celebrations СДАНА кодом** (`70ec5e1fa9` … `a75f03fb51`, раздел **CE**), но на этом HEAD
> ЕЩЁ НЕ ЗАПИСАНЫ её реестр (footer по-прежнему «PL-917», раздела CE нет), запись журнала и строка «8 из 22» в `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` —
> проверить `git log`; если исполнитель T10 ещё дописывает доки (`ListAgents`) — не сталкиваться. **Эта задача берёт раздел CF**; номера — по footer В МОМЕНТ
> записи (CE принадлежит T10 — не занимать). Лор владельца `T03` («By sponsoring culture and creativity under your dome, you have the means to influence popular
> opinion.») лежит НЕЗАКОММИЧЕННЫМ последней строкой `assets/text/lore_texts.json` — коммитить ПЕРВЫМ ханком (своя строка + запятая строки выше).
> Арт — `C:\Users\zelin\Downloads\Mars Arts\T03.png`. Скан — `C:\Users\zelin\Downloads\TerraformingMars-CardDatabase\projects\Turmoil - T03 - Cultural Metropolis.png`.
> **e2e — ТОЛЬКО Steam Machine** (`npm run e2e:remote -- t03 …`; exit 2/3/4 → спросить); сосед-27 (idle) — `SendMessage` перед первым прогоном.

Процедура — `docs/TURMOIL_REDUX_CLASSIC_CARDS.md` §3.1 (`:114–115`, `:197`, `:208` — карта названа «путь движка готов, её лицо / спек / превью — её задача»),
`docs/claude/turmoil-redux-card-checklist.md` (§2, §3, **§7**), промты T04 / T10 / T15 (образец §-блоков). **Контракты карты:** `docs/TURMOIL_REDUX_POLITICAL_DONATION.md`
(STAGED VOTE — третья дверь голосования), `docs/TILE_PLAY_STAGED_COMMIT.md` (+ §9-terdecies T15 «поле говорит розыгрыш»), `docs/claude/console/unavailability-reasons.md`,
`docs/claude/parliament-glossary.md` (резолюция · «у власти» · делегат · резерв), память `alternate-play-route-keeps-reversible-doors`, `composer-preselect-direction`
(курсор после ответа, прибытие на коммит), `table-question-deferrable-discard`, CLAUDE.md «ONE PRESS, SEVERAL EFFECTS — the surfaces go IN TURN» (`followUp`,
`owed-step`, `FOLLOW_UP_STEP_STAGES`), инварианты 1–4, 9. **Контракты полировки:** `docs/claude/console/hud-frame.md`, `rail-value-badges.md`, `resource-transfer.md`
(§ концы-объекты — рельс = адресат), `strategy-rail.md` (медальная грамматика правого рельса — ОБРАЗЕЦ планки), память `console-hud-frame-rails` (full-bleed
член корпуса, `--con-rail-w` — ШОВ, от которого считает каждая поверхность), `console-tag-matrix`, `console-score-header`, `console-rail-value-badges`,
`console-rail-protection-marks`, `resource-flight-live-ends-direction` (все три итерации — рельс как адресат, «ожидает», слой-близнец), `polish-priority-tv4k-no-deck-only`,
`polish-area-premium-visual-first` (владелец: «премиальная подача и понятность — где плохо, полировать в первую очередь»), `console-reading-typography`,
`length-tier-ladder-calibration`, `perf-measure-on-gpu-not-swiftshader`, `batch-decisions`, `concurrent-session-edits-same-files`, `e2e-only-on-steam-machine`,
`e2e-spec-rot-contract`, `shell-template-escapes`; CLAUDE.md «Project goals» 2 и 4 (Steam-ощущение; «освежать вид»: sci-fi типографика, градиентные/clip-path рамки,
тёмное стекло). Журнал — `docs/claude/turmoil-redux-cards-progress.md`, реестр — `docs/claude/gameplay-polish-ledger.md`.

**Образцы — по частям:** **T04 Diaspora Movement** (`turmoil/DiasporaMovement.ts` + спек `tests/cards/turmoil/DiasporaMovement.spec.ts:66–160` — стол Redux,
`seatResolution` / `quietResolutionOf` / `seatEnacted`, дороги требования «0 of 2» · «1 of 2» · `partyOffVote` · FAQ p.19) — то же требование партии, те же дороги;
**TR03 Political Donation** (`turmoilRedux/PoliticalDonation.ts`, `parliament/PlaceDelegatesOnResolution.ts:50–180` — ОДИН шаг «добавить N делегатов на резолюцию»,
маркер `votePrompt: {source: 'grant', count}`, `choiceContext.source` = карта, `previewSelectParty()`; e2e `console-political-donation.spec.ts` — STAGED VOTE внутри
руки, крошка РОЗЫГРЫШ → РАЗЫГРАНО → ГОЛОСОВАНИЕ, полёт кубиков из РЕЗЕРВА) — тело делегатов и стенд; **Redux-Венера** (колония «добавить 2 делегата» —
`ConsoleShell.vue:6233 colonyBuildGrantPrompt`, `:8320 colonyGrantStepLive`, `consoleTaskRouter.ts:430–437 DELEGATE_GRANT_STEP_STAGE`,
`ParliamentModel.ts:352–360 pendingDelegateGrantCount`) — ЖИВОЙ грант на 2 кубика, размещённый внутри потока, который его породил; **T15 Wildlife Dome** —
staged-клетка декларативной карты (CD: бар, play-plate, долг B); **фасад** `politics/PoliticalOps.ts:28–37` (`PlaceDelegatesOptions.oneParty` — «Cultural
Metropolis» назван), `:114–122` (`placeDelegates` — ДЕФЕРИТ, Redux → `PlaceDelegatesOnResolution(count)`), `:206–215`; `behavior/Executor.ts:272–279`
(`turmoil.sendDelegates` → `delegatesInReserve`), `:208–212` (клетка города), `Behavior.ts:143–149`; **полировка** — `ConsoleResourcePanel.vue` (1187 строк: `.con-score`
`:14–70`, ряды `:81–180` — `__iconwrap / __shield / __icon / __mcbadge / __store / __stockwrap / __digits / __prod / __prod--void`, матрица `.con-tagmx` `:198–230`),
стили `console.less:4630–4864` (`.con-res` — корпус, `__row` плита `rgba(16,26,38,.6)` + inset-линия, `__iconwrap` `#2c3a4e→#182231`, `__value` 700, `__prod`
коричневая пилюля `#8a5a2b→#6b4520` / красная `#8a2b2b`), `:4864–5000` (`.con-tagmx`), `:27099–27140` (состояния конвертации), TV `console_tv.less:213–262`
(токены `--cr-*`, `--con-rail-w: 11rem`, `__value 1.5rem`, медальон `2.6rem`), `.con-score` (`console-score-header`), **якоря полётов** —
`resourceTransfer/consoleResourceTransfer.ts:1563–1596` (`.con-score__value`, `.con-res__row--X .con-res__digits / __stockwrap / __prod`),
`generationScene/generationScene.ts:260–262`, `conversionPromptUi.ts`; e2e `console-rail-contract.spec.ts` (контракт формы: бюджет, колонки, три столбца матрицы),
`console-rail-landing`, `console-rail-protection`, `console-rail-value-badges`, `console-colony-reward-rail`, `console-start-rail-commit`, `console-flight-paint`,
`console-action-price-fold`, `tv-profile-screens`; кадр «сегодня» 4K — `screenshots/tv-profile/tv-4k/04-board.png` (левая панель рядом с правым рельсом).

---

## Диагноз (подтверждён файл:строка и кадром на `fcd6fb7374`; перепроверить на своём HEAD)

### Карта — путь движка готов, карта по нему не идёт
1. **Bespoke там, где всё декларативно.** `CulturalMetropolis.ts:35–43`: `bespokeCanPlay` читает КЛАССИЧЕСКИЙ движок (`Turmoil.getTurmoil` →
   `getAvailableDelegateCount`) и бросит на столе Redux (нет `game.turmoil`); `bespokePlay` деферит апстримный `SendDelegateToArea` — мимо фасада. При этом
   `behavior.turmoil.sendDelegates: {count: 2}` (Behavior.ts:145) уже даёт ВСЁ: доступность по `delegatesInReserve` (Executor:272), размещение через
   `politics.placeDelegates` → Redux `PlaceDelegatesOnResolution(player, 2, {kind:'card', card})` — два кубика на ОДНУ резолюцию (`oneParty` по умолчанию),
   недостача резерва — размещает, что есть, и называет (шаг TR03, правило «no silent loss»), классика — байт-в-байт `SendDelegateToArea {count: 2}`
   (`PoliticalOps.ts:275–283`). Клетка города — Executor:208. Карта становится полностью декларативной: удалить оба bespoke.
2. **Причина руки лжёт на Redux-столе.** `models/unplayableReasons.ts:498–503`: для декларативного `sendDelegates` причина читает `Turmoil.getTurmoil(game)` —
   на Redux-столе это бросок или ложь. Нужна причина ФАСАДА с числом: «делегатов в резерве: N из 2» (`politics.delegatesInReserve`), классика — прежний текст.
   Это ОБЩИЙ слой: исправление покрывает Martian Media Center и всех «посланников» prelude2 / Pathfinders на Redux-столе.
3. **Две двери в одном розыгрыше — впервые.** Превью карты несёт `boardPlacement.staged` (город) И `delegateGrant` (TR03-класс). `playDoorOf`
   (`consolePlayCardComposer.ts:286–301`) берёт ПЕРВУЮ дверь; `lawPlayStagedDoor` (`consolePlayPick.ts:118–130`) — одну. Порядок шагов превью решает, какая
   дверь станет staged, а вторая придёт ЖИВЫМ запросом после коммита. Для живого гранта от КАРТЫ хоста нет: `ConsoleShell.vue:6233 / 8320` знают только
   грант КОЛОНИИ (`source.kind === 'colony'`); `followUpStepOwed` (`:8181`) + `DELEGATE_GRANT_STEP_STAGE` (`consoleTaskRouter.ts:435`) уже называют стадию
   «ГОЛОСОВАНИЕ» для любого гранта — но КАДР, в который телепортируется режим голосования после staged-клетки (рука припаркована под полем — T15 «B owed,
   never lost»), не определён. ⚠ `StagedVoteModel` (`ActionPreviewModel.ts:806–809`): прогноз staged-двери считается для ОДНОГО делегата — грант на 2 обязан
   протянуть `count` (для ЖИВОГО гранта `pendingDelegateGrantCount` уже честен — аргумент в пользу решения 2а).
4. **Остальное стандартно:** требование партии — `PartyRequirement` через фасад (T04: дороги, `partyOffVote`, FAQ p.19, TR70-вейвер — всё готово);
   RU описания (`turmoil_cards.json:9` «Требование: Союз в правящий партии…» — не голос набора; T04 `:12` — образец голоса), лор RU, арт, `card_info`,
   строка долой (`turmoilReduxAdaptation.ts:44`), пин «as of the last adaptation» (9 из 22), событие «город размещён» — все счётчики городов (Aurora Station
   `:55–60`), production −1 энергии — обычная проверка.

### Левая панель — форма зрелая, материал нет
5. **Плиты, а не приборы.** `console.less:4700–4760`: ряд ресурса — плоская плита `rgba(16,26,38,.6)` с одной inset-линией; иконка в прямоугольном «колодце»
   `#2c3a4e→#182231`; число — голый `700`; производство — коричневая пилюля `#8a5a2b→#6b4520` (отрицательное — красная) одного вида для всех шести ресурсов.
   На кадре 4K `04-board.png`: шесть одинаковых серых прямоугольников «500 +0», в полуметре от них — золотые медальоны правого рельса и премиум-лица карт.
   Steam-планшет игрока (референс цели 2) — это ПРИБОРНАЯ ПАНЕЛЬ: материал, тон ресурса, гравировка, свет.
6. **Матрица меток — отладочная сетка.** `.con-tagmx` (`:4864+`): круглые PNG-медальоны, под ними серая цифра `1rem`, кикер «МЕТКИ» + тонкая линия. Ноль
   и единица читаются одинаково; ни ранга, ни материала; VP-бейджи и ценник (`rail-value-badges`) посажены на голый круг.
7. **Счёт (`.con-score`)** — лучшая часть (РТ-кольцо, ПО-щит), но стоит на той же плоской плите; её материал — эталон для остальных.
8. **Что НЕЛЬЗЯ трогать (и это главное):** сетка ряда `icon | value | production` с токенами `--cr-icon / --cr-prod-w` (`:4720–4740` — «один общий конец оси
   значений для шести рядов и обоих мест»), вертикальный бюджет (`overflow: hidden`, матрица уступает первой), шов `--con-rail-w` (каждая поверхность
   отсчитывает от него), ЯКОРЯ полётов (`consoleResourceTransfer.ts:1578–1596`, `generationScene.ts:260–262`): `.con-score__value`, `.con-res__row--X
   .con-res__digits / __stockwrap / __prod`; состояния `data-rail-quiet`, `--conv-source/-target/-watch`, щиты защиты, ценники, кубы хранилища, маска
   «приватный счёт», перекраска в info-режиме, место бота (`--rows--bot` — те же шесть рядов). Полировка = КРАСКА на тех же боксах; гард паритета геометрии
   обязан доказать ±1 px для каждого якоря на трёх профилях.

## Правила карты (спек пинит каждое)
1. Зелёная, 20, Город + Здание; требование «Союз» — дороги T04 (у власти / 2 делегата на резолюции «Союза» / резолюции нет на голосовании → дорога закрыта,
   не «0 из 2» / эффект от карты — не дорога / TR70-вейвер); −1 пр. энергии (пр. энергии 0 → не играется, причина обычная), +3 пр. M€; город на выбранную
   клетку (нет клетки → `PLACEMENT` «No space available for the tile»); ЗАТЕМ один `SelectParty` с `votePrompt {source:'grant', count: 2}` и
   `choiceContext.source` = карта → 2 кубика из РЕЗЕРВА на ОДНУ резолюцию области голосования (лобби не тратится).
2. Резерв < 2 → карта НЕ играется, причина «делегатов в резерве: N из 2» (Executor:272 + причина диагноза 2); резерв ровно 2 → играется. Область голосования
   пуста / место бота → именованный пропуск шага (TR03 правило «no silent loss»), карта разыграна (производство и город — её первые эффекты).
3. Классический стол — апстрим байт-в-байт (`SendDelegateToArea {count: 2}`, `getAvailableDelegateCount`); превью (`cardPlayPreview`): production + `boardPlacement.staged`
   + `delegateGrant` (count 2 в прогнозе); save / load — ничего нового; MarsBot не играет (колода бота — метки).

### Решения владельца (по умолчанию — как написано; подтвердить в отчёте; решения T04 1–6 / T14 CC / T15 CD не переспрашивать)
1. **RU** — имя оставить («Культурный метрополис»); описание — голос T04: «Требует, чтобы «Союз» был у власти или у вас было 2 делегата на его резолюции.
   Уменьшите производство энергии на 1 шаг и увеличьте производство M€ на 3 шага. Разместите тайл города. Добавьте 2 делегата на одну резолюцию.»;
   лор RU — «Поддерживая культуру и творчество под своим куполом, вы получаете средства влиять на общественное мнение.»
2. **Две двери** (диагноз 3) — (а, рекомендовано) STAGED-КЛЕТКА города — единственная reversible-дверь (последний обратимый шаг, T15), голосование —
   ЖИВОЙ follow-up-шаг ПОСЛЕ коммита: крошка с нажатия называет «ГОЛОСОВАНИЕ» (`FOLLOW_UP_STEP_STAGES` / `DELEGATE_GRANT_STEP_STAGE`), поток ДОЛЖЕН шаг
   (`owed-step`), режим голосования Парламента телепортируется в кадр руки (ОДИН экземпляр; `КАРТЫ В РУКЕ › КУЛЬТУРНЫЙ МЕТРОПОЛИС › ГОЛОСОВАНИЕ`), после
   посадки кубиков поток ЗАВЕРШАЕТСЯ на поле (одно охраняемое заключение); композер до нажатия показывает ряд «затем: 2 делегата на резолюцию — выбор в
   Парламенте» и прогноз; (б) две staged-двери цепочкой (клетка → голосование до отправки, B из голосования — к клетке) — больше кода и ⚠ прогноз на 2.
3. **Хост живого гранта от карты** — определить ОДНИМ правилом для `source.kind === 'card'` (как `colonyGrantStepLive` для колонии): кадр, который играл карту
   (рука / staged-поле с припаркованной рукой), держит экран, пока стоит грант, и хостит голосование; стандалон-Парламент — только если кадра нет (карта
   сыграна не из консольного потока).
4. **Планшет — «МАТЕРИАЛ, НЕ ФОРМА»** (диагноз 5–8) — (а, рекомендовано) ряд = ПРИБОР: плита-банк из тёмного стекла с рёбрами/фасками (clip-path/gradient
   рамки — цель 4), иконочный колодец КРУГЛЫЙ с внутренним кольцом в ТОНЕ ресурса (M€ золото · сталь бронза · титан серебро · растения зелень · энергия
   пурпур · тепло красно-оранж — токены ресурса, не хардкод в ряду), цифры — консольный дисплейный шрифт с табличными цифрами и лёгким свечением в тоне,
   производство — ГРАВИРОВАННЫЙ ярлык «+N» в тоне ресурса (не коричневая пилюля), отрицательное — красная гравировка; (б) только материал плиты + иконки,
   пилюля остаётся.
5. **Матрица меток** — (а, рекомендовано) медальонный банк: ободок (бронза), счёт ВНУТРИ/на ободке гравировкой, нулевое состояние приглушено по материалу
   (не только цветом), ненулевое — свет; кикер «МЕТКИ» + линия → шов секции в грамматике корпуса; (б) как есть + ободки.
6. **Счёт** — материал из решения 4 на той же геометрии; РТ-кольцо и ПО-щит — не трогать.
7. **Что остаётся прежним** — все состояния и наложения (ожидает, щиты, ценники, кубы, конвертация, quiet, бот, info-перекраска, приватный счёт) —
   пересажены на новую краску БЕЗ изменения их боксов; «ожидает» (тонкая линия в тоне ресурса, T06 решение 7) — на новом материале читается.
8. **Профили** — TV 4K первым; fhd; Deck — база не растёт (краска та же, токены те же); OLED/дистанция — контраст нуля ≥ прежнего (`console-tag-matrix`).
9. **Объём** — карта ≈ 30 % (две двери — главная работа), планшет ≈ 70 %; правый рельс, верхняя полоса, бар — вне скоупа (только если шов корпуса требует
   одной линии).

## 0. Рабочее дерево
1. `git log --oneline -1` → `fcd6fb7374` на выдаче. `ListAgents` + процессы; `SendMessage` живым соседям: твои файлы — `turmoil/CulturalMetropolis.ts` + спек,
   `common/cards/turmoilReduxAdaptation.ts`, `models/unplayableReasons.ts` (§ sendDelegates), `consolePlayCardComposer.ts` / `consolePlayPick.ts` / `ConsoleShell.vue`
   (хост гранта карты) / `consoleTaskRouter.ts`, `ConsoleResourcePanel.vue`, `console.less` §§ `.con-res` / `.con-tagmx` / `.con-score`, `console_tv.less` § рельс,
   `ru/{turmoil_cards,card_info,ui,console}.json`, e2e рельса, доки. Коммиты — ПО ХАНКАМ или явными путями; лор — своя строка; после коммита —
   `git reset -q -- package.json package-lock.json`. Никогда `git stash`, `git add -A`. Не пушить.
2. **e2e / стенд — только Steam Machine:** `npm run build` → `npm run e2e:snapshot t03` → `npm run e2e:remote -- t03 <spec> [--exclusive --workers=1]`;
   кадры «до» — клиент HEAD (`TM_E2E_SHOTS_TAG=before`); exit 2/3/4 — СТОП и `AskUserQuestion`. Перф 4K — только на GPU бокса (`perf-measure-on-gpu`).
3. **Стенд карты = спек** `tests/e2e/console-cultural-metropolis.spec.ts` (FUNCTIONAL, tv4k + fhd): (а) композер — плита производства «энергия 1 → 0 ·
   M€ +3», дверь «Выбрать клетку», ряд «затем: голосование»; (б) A → staged-поле (бар T15, play-plate «Культурный метрополис · 20 M€»), выбор клетки, A — ОДИН
   POST, хвост `stagedFor`; (в) город садится; режим голосования поднимается как follow-up ВНУТРИ кадра руки, крошка `… › ГОЛОСОВАНИЕ`, прогноз «0 → 2» на слотах,
   B не разрушает (шаг обязателен — отказа нет); (г) A → два кубика покидают РЕЗЕРВ на ленту резолюции (счёт резерва падает на подъёме), поток завершается на
   поле; (д) сервер согласен (стол, 20 M€, производство, город, два голоса, резерв −2); (е) `cultural-metropolis-locked` — «Союз» не у власти, 1 делегат → чип
   «1 из 2»; резерв 1 → чип «делегатов в резерве: 1 из 2».
4. **Стенд полировки = спек** `tests/e2e/console-rail-material.spec.ts` (FUNCTIONAL; три профиля): (а) ПАРИТЕТ ГЕОМЕТРИИ — rect каждого якоря (`.con-score__value`,
   `.con-res__row--X .con-res__digits / __stockwrap / __prod` × 6, `.con-tagmx__cell` × N, шов `--con-rail-w`) ДО/ПОСЛЕ ±1 px (эталон — JSON с базового клиента
   снапшота); (б) контракт формы (`console-rail-contract`) зелёный; (в) контраст нуля матрицы и цифры ряда ≥ прежних (пробник яркости); (г) кадры шести
   состояний ряда: покой · quiet · ожидает · щит · ценник · конвертация; бот-место; info-перекраска; приватный счёт; (д) reduced motion.
5. Фикстуры: `cultural-metropolis` (`parliamentFixture`: Redux, Colonies; три тихие резолюции, «Союз» ENACTED (`seatEnacted(quietResolutionOf(UNITY))`);
   p1 — пр. энергии 1, 40 M€, резерв ≥ 2, карта в руке, клетка города есть), `cultural-metropolis-locked` (Союз на голосовании, 1 делегат p1 на его
   резолюции; вариант резерв 1).

## 1. Сервер — карта + общий слой (≈ 20 %)
`CulturalMetropolis.ts`: `behavior: {production: {energy: -1, megacredits: 3}, city: {}, turmoil: {sendDelegates: {count: 2}}}` — bespoke удалить; RU, лор, арт
(`node scripts/import-card-art.mjs "<путь>/T03.png" T03` → `make:cards`), `card_info`, строка долой + пин (9 из 22). `unplayableReasons.ts:498` → фасад + число
(новый EN-ключ «Delegates in your reserve: ${0} of ${1}»; классика — прежний текст, если фасада нет — не трогать её строку). Спек: классический блок
(обновлённый под декларативность — тот же результат) + Redux-блок по правилам 1–3 + превью (две двери, count 2) + `unplayableReasons` на Redux-столе для
декларативного `sendDelegates` (общий слой — отдельный `it` в `unplayableReasons.spec`).

## 2. Клиент — ДВЕ ДВЕРИ (≈ 10 %)
По решению 2а/3: ряд «затем» в композере из `delegateGrant`-шага (count из модели, никогда из текста), стадия крошки с нажатия, хост живого гранта карты
(одно правило, `ConsoleShell` — рядом с `colonyGrantStepLive`), заключение потока после посадки; ⚠ прогноз `StagedVoteModel` на N — если 2б. Спеки:
`consolePlayCardComposer.spec` (две двери → `board` + follow-up ряд), `consoleTaskRouter.spec` (стадия гранта карты), `ConsoleShell`-уровень через стенд §0.3.

## 3. Клиент — ГЛАВНОЕ: «ПЛАНШЕТ — МАТЕРИАЛ, НЕ ФОРМА» (≈ 70 %)
### 3.А Кадры «до», эталон геометрии и макеты (первым делом)
Стенд §0.4 на базе: JSON якорей (эталон) + кадры трёх профилей. Макеты (CSS поверх живой сцены на Steam Machine, 4K): M1 — приборный банк (решение 4а +
5а); M2 — как M1, но пилюля производства остаётся (4б); M3 — «стеклянный планшет»: одна общая стеклянная плита на все шесть рядов с рёбрами-разделителями
вместо шести плит → батч владельцу (решения 4, 5) ДО реализации. Макет не двигает ни один якорь — проверить стендом.
### 3.Б Токены и материал
`console.less` § `.con-res`: токены тона ресурса (`--res-tone-<key>` из существующих цветов иконок — один источник, грепнуть `resource_icon--`), материал
плиты/банка (стекло + фаски — миксин, переиспользовать грамматику `.con-strat` медальонов и `.pcard` рамок, не третью), круглый колодец иконки с кольцом в
тоне, дисплейный шрифт цифр (из `console-reading-typography` — существующее семейство, табличные цифры), гравировка производства (`__prod` — та же коробка
`--cr-prod-w`, другая краска; `--negative`, `--void` без краски), счёт на том же материале; `.con-tagmx` — ободки, гравировка счёта, нуль по материалу;
`console_tv.less` — те же токены (размеры НЕ меняются). Все состояния диагноза 8 — пересадка. Dead-selector guard (`lessDeadSelectorGuard`) — ничего мёртвого.
### 3.В Гарды
`tests/console/railGeometryParity.spec.ts` (юнит на скомпилированном CSS: токены сетки/размеров ряда и матрицы = эталон; `--cr-*` не изменились), стенд §0.4,
`console-rail-contract`; `flightLayerZOrder.spec` (новая краска не создаёт stacking context над слоями полёта — `transform`/`filter` на ряду ЗАПРЕЩЕНЫ, см.
`fixed-layer-is-a-stacking-context`); перф: пробник 4K на GPU — новые тени/blur не роняют кадр (бюджет из `perf-on-gpu`).
### 3.Г Регрессия
`console-rail-landing`, `console-rail-protection`, `console-rail-value-badges`, `console-colony-reward-rail`, `console-start-rail-commit`, `console-flight-paint`,
`console-action-price-fold` (TIMING, `--exclusive --workers=1`), `console-rail-contract`, `tv-profile-screens`, `console-political-donation`, `console-staged-board-clarity`
— по 2 повтора; хуки, задетые краской (классы — не переименовывать; добавлять), — переводить ТЕМ ЖЕ диффом (инвариант 14).

## 4. Лицо, локаль, лор, арт
Арт T03; лор EN (ключ владельца) + RU; RU карты — решение 1; `card_info` — Redux-чтение «2 делегата на одну резолюцию»; новые EN-ключи: «Delegates in your
reserve: ${0} of ${1}», «Then: ${0} delegates to one resolution — chosen in the Parliament» (ряд композера; `grep` ключа по всем `src/locales/*/*.json` ДО
добавления); RU чужих не переписывать; делегат на лице — существующий `delegate.png` ×2 (не рисовать второй знак).

## 5. Тесты
1. Спек карты; гарды после удаления строки: `cardInformation`, `requirementProse`, `premiumCardViewModel`, `cardLore` (T03), `cardVictoryPointsAtPlay`,
   `crossPlayerCoverageGuard`, `TurmoilCardsUnderRedux` (пин 9), `premiumScope.spec`, `parliamentGlossary.spec`, `e2eLiveness`, `lessDeadSelectorGuard`,
   `glyphLiteralGuard`, `consoleTvTypeFloor`, `cursorGrammarGuard`, `flightLayerZOrder`, `transferSurfaceClear`.
2. Юниты §1, §2, §3.В; `npm run build:test`, `npm run lint`, `make:cards`, `make:json`; юниты — на тихой машине.
3. e2e §0.3, §0.4, §3.Г; `npm run e2e:affected` + перевод хуков тем же диффом.

## 6. Визуальная приёмка = РАСКАДРОВКА (**TV первым**; fhd и Deck обязательны)
`screenshots/t03/{tv,fhd,deck}/`: (а) планшет ДО / ПОСЛЕ — покой; (б) шесть состояний ряда + матрица 0/1/5; (в) посадка жетона на новый ряд (кадры подхода
/ касания / тика); (г) бот-место и info-перекраска; (д) карта: композер с двумя дверями → staged-поле → город → голосование внутри руки → кубики из резерва →
поле; (е) чип руки «1 из 2» и «делегатов в резерве: 1 из 2». Таблица якорей ДО / ПОСЛЕ (max |Δ| px) — в реестр. Каждый кадр — с дивана: «это приборная
панель корабля или таблица?»

## 7. Полировка по пути
1. Реестр: раздел **CF** «ИГРОВОЙ ПЛАНШЕТ — МАТЕРИАЛ, НЕ ФОРМА · ДВЕ ДВЕРИ ОДНОГО РОЗЫГРЫША» — диагноз 2–8 строками (классы: «причина читает чужой движок»,
   «вторая дверь без хоста», «плита вместо прибора», «матрица как отладка»); номера — по footer.
2. Бэклог `weak-visuals-backlog` — «левая панель» → DONE с номерами; кандидаты, замеченные по пути (верхняя полоса, бар) — ДОБАВИТЬ, не делать.
3. Доки: `docs/claude/console/hud-frame.md` — § «Материал планшета» (токены тона, якоря-инварианты, гард паритета); `resource-transfer.md` — строка «адресат
   на новом материале: те же селекторы»; `docs/TURMOIL_REDUX_POLITICAL_DONATION.md` — § «грант от карты как follow-up (T03)»; `docs/TURMOIL_REDUX_CLASSIC_CARDS.md`
   §4.2 — T03 «СДАНА» (9 из 22; список «эффект читает движок» — минус одна); `unavailability-reasons.md` — причина резерва; закон в `.claude/rules/console-ui.md`
   («the rail's paint may change; its boxes and anchors may not — a flight aims at the same selectors on every material»); запись в журнале.

## 8. Режим работы
1. Читать до кода; ПЕРВЫМ ДЕЛОМ — эталон якорей + кадры «до» в трёх профилях + макеты M1–M3 → батч; карта — параллельно (сервер → двери → стенд).
2. Порядок: лор → карта + причина фасада + спек + строка долой → двери (2а/3) + стенд карты → эталон + макеты → (после батча) 3.Б материал → 3.В гарды →
   регрессия → раскадровки → реестр / доки. Коммит по ханкам на каждом шаге; `console.less` — через временный индекс без чужих ханков.
3. Реестр: букву (CF) и номера объявлять В МОМЕНТ записи по текущему footer; CE — не занимать.
4. Отчёт: первой строкой — арт; затем кадры планшета ДО / ПОСЛЕ по профилям, таблица якорей (max |Δ|), макеты, кадры карты (две двери), результат регрессии,
   решения 1–9 с тем, что сделано по умолчанию, ОДИН батч `AskUserQuestion` (4 с макетами, 5, 2 — рекомендация первой), гэпы честно.
5. Не пушить. e2e — только `e2e:remote`; exit 2/3/4 — спросить.

## 9. Нельзя
- Сдвигать якорь, токен размера, колонку, шов `--con-rail-w`, бюджет; переименовывать класс рельса; `transform` / `filter` / `will-change` на ряду или
  корпусе (слой полёта); растить базу Deck; состояние только цветом; `title`; литерал кнопки; текст ниже пола TV; третья грамматика рамок.
- Читать классический движок в причине / превью / карте (`Turmoil.getTurmoil`) там, где есть фасад; `SelectParty` своими руками (только шаг TR03);
  auto-select резолюции; второй экземпляр Парламента; `v-if`-подмена стадий; закрытие потока под живым грантом.
- Трогать правый рельс / верхнюю полосу / бар (кроме одной линии шва), разбор хода бота, правила карты; RU чужих ключей; файл соседа; `git stash`;
  bare `git push`; Playwright на ноуте; `TM_E2E_LAPTOP_OVERRIDE` / `TM_E2E_BESIDE_GAME`; `--workers=4`.

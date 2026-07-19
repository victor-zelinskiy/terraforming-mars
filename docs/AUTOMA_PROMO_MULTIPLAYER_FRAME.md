# AUTOMA_PROMO_MULTIPLAYER_FRAME — архитектурная рамка promo-адаптации MarsBot и будущего мультиплеера

> Зафиксировано владельцем 2026-07-19, ДО начала реализации promo-support. Это НЕСУЩИЙ
> дизайн-док: любые изменения поведения карт ради MarsBot делаются только в границах этой
> рамки. Официальные данные (FAQ-транскрипция + статусы покрытия) — `AUTOMA_DATA_AUDIT.md` §9.

## 1. Два концептуальных режима

Код не должен зашивать допущение «Automa = ровно один человек + один бот навсегда».
Мультиплеер + Automa — стратегическое направление проекта (уникальная фича), не побочная деталь.

### A. `official_solo_automa` (текущий, официальный)
- Точная официальная поддержка: Tharsis + CorpEra + Prelude 1 + Venus + Colonies (+ явно
  задокументированные хоумрулы: Delta, alt-Venus board, Ares).
- Неподдержанные карты БЛОКИРУЮТСЯ (громко, на создании).
- Mons Insurance заблокирована (официальное правило).
- Recession удалена при Prelude 2 (сейчас prelude2 целиком вне скоупа — правило наследуется).
- Пер-карточные оверрайды — ТОЛЬКО из официального FAQ/reference-карт.
- Никакого угаданного поведения (positive production и т.п. — см. §5).

### B. `multiplayer_with_automa_house_rules` (будущий, проектный)
- Карты НЕ банятся глобально из-за присутствия бота.
- Взаимодействия человек↔человек остаются БАЙТ-В-БАЙТ обычными.
- Только bot-specific взаимодействия идут через Automa-адаптеры.
- Неподдержанные bot-взаимодействия получают ЯВНЫЙ хоумрул (named policy) или блок с
  внятной причиной — никогда молчаливый фолбэк.
- UI помечает режим как house-rule / project-specific.

Представление режима: расширить `gameOptions.automa` полем `mode` (default `'official-solo'`),
предикаты — `context.isOfficialSoloAutoma` / `context.isMultiplayerWithAutomaHouseRules`,
`humanPlayers.length`, `hasMarsBot`. Сегодняшний хард-гард `players.length === 2` в
`Game.newInstance` становится инвариантом РЕЖИМА A, не всей automa-подсистемы.

## 2. Несущий принцип: изменения карт скоупятся на ВЗАИМОДЕЙСТВИЕ с ботом, никогда глобально

ПЛОХО (запрещено):
- «Sponsored Academies теперь даёт всем оппонентам 1 MC вместо добора».
- «Lawsuit глобально переписана».
- «Mons Insurance глобально забанена, если в игре есть automa-модуль».

ХОРОШО (обязательный шаблон):
- затронутый оппонент — MarsBot → Automa-ветка;
- затронутый оппонент — человек → обычное поведение карты;
- режим A → официальные ограничения; режим B → явная house-rule policy для bot-взаимодействий,
  human↔human не тронут.

Текущий код этому уже соответствует (аудит 2026-07-19: все `isMarsBot`-ветки гейтятся на
конкретного игрока-цель или игрока-актора; глобальных подмен нет). Рамка фиксирует, что так
ДОЛЖНО остаться и в promo, и в мультиплеере.

## 3. Официальный FAQ = единственный источник пер-карточных правил

Транскрипция и статусы покрытия — `AUTOMA_DATA_AUDIT.md` §9 (всё из списка ниже РЕАЛИЗОВАНО
2026-07-19, см. §11):
- ✅ авто: Asteroid Deflection System (через `plantsAreProtected`), Galilean Waystation,
  Sponsored Academies, Toll Station (base-карта; верифицировано — декларативный `Counter`).
- ✅ per-card hooks: **Lawsuit** (steal 3 из supply — generic-адаптер; «в played pile бота без
  резолва иконок и без потери VP» — bespoke ветка + отключённый для бота card-VP-цикл; плюс
  атрибуция атак бота B01/B02 как «removed your resources»-триггера), **St. Joseph of
  Cupertino Mission** (2 MC if able + advance least-advanced track topmost-if-tied через
  wild-тайбрейкер резолвера).
- ✅ дефект ТЕКУЩЕГО скоупа закрыт: **B02 Invasive Species** теперь блокируется Protected
  Habitats + пер-карточным `protectedResources`.

Всё, чего в FAQ нет, — хоумрул: помечается как таковой в коде (комментарий со ссылкой на этот
док) и в UI режима B.

## 4. Mons Insurance — predicate-ban, НЕ вечный глобальный бан

Официальное правило: «You may not use Mons Insurance against MarsBot» — это правило РЕЖИМА A.

- Режим A (official solo): корпорация блокируется на создании/раздаче.
- Режим B (multiplayer house rules): корпорация ДОСТУПНА; поведение human↔human обычное;
  bot-специфичные триггеры (регресс трека бота как «production decrease»? атаки бота как
  «resources removed»?) получают явную policy, когда режим B будет проектироваться.

Реализация: бан — предикатный, не статический список:

```ts
isCardBannedForAutoma(card, context):
  if card === MonsInsurance:
    return context.isOfficialSoloAutoma;   // humanPlayers.length === 1 && hasMarsBot
  return false;
```

В режиме B это становится compatibility-policy, не баном.

## 5. Положительное production боту — запрет молчаливого мёртвого состояния

Факт: `Production.add` перехватывает только `amount < 0`; положительный add молча запишется в
production-поле бота, которое ничего не значит (у бота нет production-фазы). Комментарий «no
in-scope effect ever increases the bot's production» перестаёт быть верным с promo.

Официальные правила определяют ТОЛЬКО decrease (→ регресс трека). Официального правила для
increase НЕ существует.

Политика (обязательна ДО снятия promo-запрета):
1. НИКОГДА не писать положительное production в обычные поля бота молча — guard/assert в
   `Production.add` (isMarsBot && amount > 0 → явный резолвер, не запись в поле).
2. Каждый положительный production-эффект на бота обязан пройти через одно из:
   - официальное FAQ/card-specific правило (если появится);
   - блок «unsupported» в режиме A (громко);
   - явную house-rule policy в режиме B.
3. НЕ выбирать «конвертировать в MC» или «advance трека» скрытым дефолтом — оба варианта
   хоумрулы с разным балансом (MC слабее/безопаснее; advance трека симметричен регрессу, но
   сильно мощнее — может триггерить track actions).
4. Для режима B — именованная policy, напр. `positiveProductionToMarsBotPolicy:
   'unsupported' | 'gainMC' | 'advanceCorrespondingTrack' | 'perCardOverride'` — с честной
   пометкой «не официально».

## 6. Промпты, адресованные боту

MarsBot НИКОГДА не отвечает на промпты как человек; клиентский промпт для бота не открывается
ни при каких условиях. Любой эффект «бот должен выбрать» резолвится через:
- официальное правило, если есть;
- детерминированный тайбрейкер (прецеденты: wild-тег → least-advanced topmost; flip-метод);
- Failed Action / no effect, если так говорит карта/правило;
- явную house-rule policy в режиме B.

## 7. Аудит-классы promo (и будущих опциональных модулей)

Перед снятием блокера — grep-аудит директории карт по классам взаимодействий:
`opponents` / `any player` / `another player`, `attack(`, remove/steal resources, decrease
production, **increase production другим/всем**, draw cards for each/another/all, discard from
hand, inspect/copy hand или played area, промпты каждому игроку, «оппонент выбирает», эффекты
от размера руки оппонента, эффекты от played pile оппонента вне reference-правил.

Вероятно закрыто generic-адаптерами (проверять, не переделывать):
- remove/steal от бота → MC-supply/storage (`Player.attack`);
- decrease production → регресс трека (`Production.add`);
- подсчёт тегов оппонентов → треки (`Counter` → `automaTagCount`, вкл. FAQ-исключения);
- card-resource цели → storage (`RemoveResourcesFromCard`).

Требуют per-card hook (co-located, см. §8):
- «каждый/другой игрок берёт карты» (у бота нет руки — прецедент Sponsored Academies: FAQ или
  явный хоумрул);
- «каждый/другой игрок сбрасывает карты»;
- «оппонент выбирает …» (промпт боту запрещён — §6);
- copy/view руки или сыгранных карт оппонента;
- положительное production боту (§5);
- специальные played-pile эффекты вне FAQ (прецедент Lawsuit).

Результат аудита фиксируется таблицей в `AUTOMA_DATA_AUDIT.md` §9 (расширять таблицу, не
заводить параллельный список).

## 8. Форма реализации

Центральный compatibility-слой (политики, предикаты, generic-адаптеры) + co-located
пер-карточные ветки — ОБА, каждому своя роль:

- **Центральное** (automa-only код, upstream его не трогает): режимные предикаты и
  `isCardBannedForAutoma`, generic target-адаптеры (`AutomaTargeting`,
  ветки `Player.attack`/`Production.add`/`Counter`/`GiveColonyBonus`), positive-production
  резолвер (§5), prompt-fallback политика (§6), FAQ-каунтеры (`automaTagCount` + исключения).
- **Co-located** (внутри файла карты, рядом с `play`/`canPlay` — несущее правило CLAUDE.md:
  форк мержит upstream, и изменение карты upstream'ом должно конфликтовать в ТОМ ЖЕ diff):
  пер-карточные ветки уровня «этот оппонент — бот» (прецедент `SponsoredAcademies.ts`),
  вызывающие центральные билдеры. Lawsuit / St. Joseph — по этому образцу.
- `AutomaBonusCards`/automa-модули — санкционированное исключение из co-location (бот-код не
  живёт в upstream-файлах).

Запрещено: глобальный патч классов карт; глобальное выключение promo «потому что бот»;
глобальная подмена текста/эффектов для всех игроков; запись невозможного состояния боту;
промпт боту.

## 9. Известные single-human допущения (инвентарь для режима B)

Не чинить в рамках promo — но НЕ добавлять новых:
- `Game.newInstance` хард-гард «ровно 1 человек + 1 бот»;
- `humanOf(game)` в `AutomaBonusCards` (B01/B02 и др.) — единственный человек;
- B02 Invasive Species — SelectCard «человеку» (которому из нескольких?);
- B08 Corporate Coup — `humanLead`-эвристика;
- тайбрейкеры вех/наград «человек тоже соответствует / человек ближе»
  (`AutomaMAEvaluation`/`AutomaMilestonesAwards`);
- `AutomaDraft` — изоморфизм 2p hand-pass;
- instant-win на поколении 20/18 — семантика против нескольких людей;
- `BotTurnScheduler` ack + presentation-окно на нескольких зрителей (задокументировано в
  `MARSBOT_STATUS_AUDIT.md` §9).
- Инвариант «ровно один бот» (`opponents.find(isMarsBot)`, `marsBotOf`) — сохраняется и в
  режиме B.

## 10. Тестовые ожидания

Official solo (режим A):
- Recession удалена при Prelude 2 + MarsBot (когда prelude2 войдёт в скоуп; до тех пор —
  конфликт модуля).
- Mons Insurance заблокирована в official human-vs-MarsBot.
- Asteroid Deflection System блокирует Meteor Shower (B01 → protected → destroy).
- Protected Habitat блокирует Meteor Shower И Invasive Species (B02-дефект закрыт).
- Lawsuit vs MarsBot: steal 3 из MC-supply; карта в played pile бота; бот НЕ резолвит иконки;
  бот НЕ теряет очки.
- Sponsored Academies: бот получает 1 MC вместо добора (есть).
- St. Joseph of Cupertino Mission: собор на городе бота → −2 MC if able; вместо добора —
  advance least-advanced track (topmost if tied).
- Toll Station: +MC production человека = позиция Space-трека бота.
- Galilean Waystation: +floor(джовиан-трек бота / 2) (есть).

Generic:
- remove от бота → уменьшается MC-supply (есть);
- steal от бота → supply уменьшается, человек получает ИМЕНОВАННЫЙ картой тип (есть);
- decrease production бота → регресс трека (есть);
- положительное production боту НЕ пишет молчаливое мёртвое состояние (guard из §5).

Будущий режим B:
- Mons Insurance НЕ забанена глобально при людях + боте в house-rule режиме;
- поведение карт между людьми не изменено;
- только MarsBot-ветка идёт через Automa-адаптеры;
- неподдержанное bot-взаимодействие резолвится явной policy или блокируется с внятной причиной.

## 11. Порядок работ по promo — ✅ ВЫПОЛНЕНО 2026-07-19

1. ✅ B02 + Protected Habitats / `protectedResources` (дефект текущего скоупа закрыт).
2. ✅ Guard на положительное production боту (`Production.add` — громкий throw).
3. ✅ Grep-аудит promo по классам §7 → таблица в `AUTOMA_DATA_AUDIT.md` §9.
4. ✅ Per-card hooks: Lawsuit (+ атрибуция B01/B02 → `removingPlayers`; заодно заработал
   Crash Site Cleanup), St. Joseph (least-advanced-topmost через `AutomaResolver.advanceTrack`);
   Toll Station (base-карта, авто через Counter) и ADS верифицированы тестами.
5. ✅ Mons Insurance predicate-ban (`src/server/automa/AutomaBans.ts` → `GameCards`; НЕ через
   `gameOptions.bannedCards` — тот читался бы как customLists и ломал validateOptions реванша).
6. ✅ `expansion:promo` снят из `automaCompatibility.ts` + client preset/blocker вычищен.
7. ✅ Тесты: `tests/automa/AutomaPromoCards.spec.ts` (8) + B02/guard/ban кейсы; полный сьют + lint.

Дополнительно закрыто по ходу: для бота отключён общий card-VP-цикл `calculateVictoryPoints`
(его карточные ПО — исключительно `AutomaScoring`; board-based Vermin-штраф сохранён).

Мультиплеер (режим B) — отдельный последующий пакет: режимное поле + снятие сетап-гарда +
инвентарь §9; в promo-пакет не смешивать.

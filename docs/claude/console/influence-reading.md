# THE ONE READING OF INFLUENCE — the final number everywhere (T05 Event Analysts, 2026-10-23)

Ledger section **CG** (PL-939…945). The owner's word for the card: «игрок ВО ВСЕХ местах — и на шкале Карьеры — видит
ИТОГОВОЕ влияние с учётом модификатора».

## 1. The model

A seat's influence is the SERVER's number — `Parliament.influence(player)` = `influenceAtAgenda(agenda)` (the Career's level)
+ `influenceBonusOf` (the bonuses given beyond the track, each with its giver — `influenceSourcesOf`) + the tableau's
`getInfluenceBonus` hooks. `ParliamentModel.players[i].influence` is that total; `influenceSources` lists the givers for a
seat that takes part and has any (absent otherwise — «бонусы 0» is not a line that exists).

Until Event Analysts no card of the premium scope gave influence beyond the track, so the LEVEL and the INFLUENCE were the
same number and half the surfaces printed the level as the influence. With a bonus they part: a seat on step 3 (level 2)
holding Event Analysts votes with 3.

## 2. The reading — `src/client/console/parliament/influenceReading.ts`

- `influenceReadingOf(seat)` → `{total, track, bonus, sources}`: `total` = the model's `influence` (never re-added),
  `track` = the printed level at the seat's step, `bonus` = `max(0, total − track)` (a seat the Parliament does not count
  reads 0 and shows no bonus), `sources` = the server's ledger.
- `influenceAtStep(reading, step)` — the one projection: the step's level + the bonus the seat keeps (a bonus is not a step
  and survives every walk) — the forecast's own shape (`influenceYieldModel`).
- `influenceReadingAtStep(seat, step)` — the reading ON a step for a walk's announce; `undefined` without a bonus (the
  step's level IS the influence then, and the chip says it once).
- `SeatInfluenceVm` (`seatParliamentReading.ts` — Information and its dossier plate) IS this reading.

## 3. The grammar (glossary `parliament-glossary.md` § influence)

1. The number in an influence disc is the FINAL influence.
2. The modifier «+N» beside it is what stands BEYOND the Career — `ConsoleInfluenceMod.vue` (`.con-inf-mod`,
   `console_influence_reading.less`): one tab, em-sized (a step under the number it qualifies, every profile), the card
   ink, drawn only when N > 0, never re-colouring the number; its `data-hint` names the givers («сверх Карьеры: Анализ
   событий +1»), never `title`.
3. «Level N» is printed ONLY as the reward of a cell of the track (the step chips, the rungs, the influence ruler's spans).

## 4. The consumers

| Surface | What it prints |
| --- | --- |
| Career track head (`ConsoleParliamentAgenda`) | «[куб] ВАШЕ ВЛИЯНИЕ [влияние] 3 = [нашивка] 2 +1» — the word and the sum only with a bonus |
| Influence ruler (the viewer's span) | the ring on the LEVEL's span (a cell); its chip prints the final number + the tab (decision 2a) |
| Band · focus on the track | the own stop's chip = its LEVEL; «Влияние 3 +1» = the final (`BandChip count.modifier`) |
| Band · a walk / a law's step | an influence step of a seat with a bonus: «уровень N · влияние M +k» (`BandChip agenda.influence`) |
| Career dossier | each seat's coin = the final number + the tab |
| Information › Парламент, its dossier plate | the total + the tab; the sum «Карьера 2 + Бонусы 1 = 3» and the sources |
| Vote forecasts, the party action's price | already the final number (`influenceYieldModel`, `ConsolePartyActionComposer`) |
| Play composer | «[влияние] 2 → 3» — `actionPreview` from `Parliament.influence` (decision 4a; the classic table stays silent) |
| Journal | `influence-changed` — its own row under the giver «+1 [влияние] · Влияние 2 → 3»; a Career walk's row prints the final influence (`impact.agenda.influence`) |

## 5. The server half

- `ReduxPoliticalOps.addInfluenceBonus(player, bonus, source)` — the bonus with its giver, the event `influence-changed`
  (`impact.influence {before, after, amount}`, under the live scope — the card's play) and a typed log line («${0} gained
  +${1} influence from ${2} (${3} → ${4})»). The classic engine keeps upstream's bare sum.
- `ChairmanSeat.walkAgenda` records `impact.agenda.influence` (the final influence after the walk).
- A rival's notification reads `influence-changed` as a Parliament outcome (`PARLIAMENT_OUTCOME_EVENTS`).

## 6. Guards

`tests/console/influenceReading.spec.ts` (the reading, the band chips), `tests/client/components/console/
influenceReadingSurfaces.spec.ts` (the head, the spans, the dossier, the tab), `consoleParliamentModel.spec` § T05,
`tests/cards/turmoil/EventAnalysts.spec.ts` (the server: the bonus, the event, the walk's final influence, the readers that
APPLY the final number), e2e `console-event-analysts` (A–D).

# Арт корпорации · Ecotec (Prelude 2, PC04) — промт для генератора OpenAI

Составлен 2026-11-05. Замена текущего `assets/card-images/PC04.webp` (интерьер: лаборатория под куполом, биореактор,
герметичный биом с растениями и пчёлами, логотип на балке ВНУТРИ зала — отступление от паттерна, вынесено владельцу при
сдаче карты, `4b0d0bc882`). Семейство корпоративных артов (`R07` Pristar, `R38` Lakefront, `R14` TerraLabs, `R33` Utopia,
`R10` Point Luna; промты-соседи `corporation-art-*.md`, ближайший образец замены — `corporation-art-nirgal-enterprises.md`):
ЗДАНИЕ корпорации СНАРУЖИ — широкий план, ЛОГОТИП крупно по центру на фасаде, мир и люди корпорации вокруг здания
(владелец 2026-10-27); фото-честность стилевого блока резолюций.

Что читаем со скана (`Downloads\TerraformingMars-CardDatabase\corporations\Prelude 2 - Ecotec.png`): метки БАКТЕРИЯ ·
РАСТЕНИЕ; 42 M€, производство растений +1; эффект «разыграв метку бактерии, растения или животного (включая эти 2),
получите 1 растение или положите 1 бактерию на ЛЮБУЮ карту». Лор: «Ecotec изучает, как организмы размножаются и уживаются
друг с другом во внеземной среде. Выведенный компанией штамм бактерий, перерабатывающих перхлораты, стал ключом к первой
устойчивой экосистеме Марса». Логотип — словесный знак «ECOTEC» на горизонтальной ПЛАШКЕ-БРУСКЕ с объёмной фаской: плашка
делится по вертикали на две части — левая (около трёх пятых, «ECO») ТЁМНО-ЗЕЛЁНАЯ с ЖЁЛТЫМИ буквами, правая («TEC»)
ЖЁЛТАЯ с ТЁМНО-ЗЕЛЁНЫМИ буквами; граница цветов проходит у правого края «O»; буквы — широкие жирные рубленые капители
с большой разрядкой (округлые C и O почти круглые, E с длинными ровными перекладинами); правый торец плашки скошен; по
верхнему краю — светлая фаска, по нижнему — тёмная тень-подложка (брусок «стоит» над поверхностью).

Место и идея: «как организмы размножаются и уживаются» + «перхлоратные бактерии — ключ к первой устойчивой экосистеме»
— буквально, и снаружи. Штаб Ecotec — полевая биостанция на голой равнине: приземистый корпус лабораторий и рядом с ним
ряд невысоких цилиндрических БИОРЕАКТОРОВ (матовые резервуары со смотровыми окнами, внутри — мутная зеленовато-бурая
культура), трубы от них уходят к ОПЫТНЫМ ПОЛОСАМ грунта перед зданием. Полосы — главный образ: длинные прямые гряды
реголита, обработанного штаммом, и на них видна ПОСЛЕДОВАТЕЛЬНОСТЬ жизни — от сырого рыжего реголита (у дальнего края) к
потемневшему разрыхлённому грунту с зеленоватой корочкой бактериального мата, затем лишайник и мох, ближе к зданию —
первые низкие стойкие растения под прозрачными укрытиями-«тоннелями»; три метки эффекта (бактерия → растение →
животное) читаются как три стадии одной экосистемы. Животные — у торца корпуса: стеклянная пристройка-оранжерея, сквозь
стекло видны ульи и пчёлы над цветами (опылители — «уживаются друг с другом»), без фантастики. Люди Ecotec — биологи и
почвоведы в рабочих скафандрах: один берёт керн из грядки щупом, другой несёт кейс с образцами, третий записывает
показания у столбика-датчика. Деталь «со второго взгляда»: за оградой опытного поля, на нетронутом реголите, сам собой
начинается маленький язык зелёной корочки — экосистема уже выходит за свои грядки. Отличие от соседей: Nirgal — тесная
площадь на дне долины, Hartlan — промобъект на морозном рассвете, Proteus — лёд и газовый гигант, Deimos — чёрное небо,
Titan — внутри цилиндра, Veynon — дневной космодром; здесь — плоская равнина в низком послеполуденном свете, длинные
тени гряд, «лоскутное» поле от рыжего к зелёному.

Приложить к запуску: скан (логотип слева вверху — копировать С НЕГО).

## Промт (один блок, скопировать целиком)

```
You are illustrating the CORPORATION card "Ecotec" for the board game Terraforming Mars. Attached: the card scan — copy the corporate logo from its top-left corner. Generate ONE finished illustration right away, without asking questions.

WHO THEY ARE. Ecotec studies how organisms procreate and interact in extraterrestrial environments. Their own strain of perchlorate-metabolising bacteria was the key to establishing the first stable ecosystem on Mars: the microbes clean the toxic perchlorate out of the regolith, mosses and lichens follow, then hardy plants, then pollinating insects. They are field biologists and soil scientists — patient, practical, proud of slow results.

THE PICTURE. A wide EXTERIOR view of the Ecotec headquarters — a field biological station on a flat, open Martian plain in the low light of late afternoon; the building itself is the subject, do not show an interior. A long, low laboratory building of sturdy regolith-concrete and pale composite panels, a little weathered and dusty, with a few square windows and a wide main entrance in the middle. Beside it stands a row of five or six squat cylindrical bioreactor tanks of matte grey composite with small round sight-glasses showing a cloudy greenish-brown culture inside, connected by pipes and valves that run out along the ground to the test field. The test field in front of the building is the main image: long, straight, raised beds of regolith running diagonally away from the viewer, and along them life appears in sequence — at the far ends raw rust-red regolith, then darker, raked soil with a thin greenish crust of bacterial mat, then patches of grey-green lichen and moss, and nearest the building low hardy plants growing under clear plastic hoop tunnels. At one end of the building a glass-walled greenhouse wing: through the dusty glass, beehives and bees over small flowering plants. Ecotec people in practical, worn pressure suits work in the field: one pushes a soil-core probe into a bed, one carries a sealed sample case, one reads a short sensor post and writes on a tablet; a small utility rover with sample crates stands on the gravel path. To be found on the second look: beyond the low fence at the edge of the test field, on untouched red regolith, a small tongue of the same green crust has started to spread on its own — the ecosystem leaving its beds. Behind, the flat plain runs to a low horizon with a distant line of hills; above, the thin butterscotch-pink Martian sky with a small, low, pale sun.

THE LOGO — the centre of the image. Mounted high on the laboratory façade, directly above the main entrance, in the exact centre of the frame, about one quarter of the image width, copied faithfully from the scan: a long horizontal bar-shaped sign with a bevelled, slightly raised edge, split vertically into two colour fields — the left part (about three fifths, behind the letters "ECO") dark green with YELLOW letters, the right part (behind "TEC") yellow with DARK GREEN letters, the colour boundary falling just at the right edge of the "O"; the letters are wide, bold, geometric sans-serif capitals with generous spacing (round, almost circular C and O; E with long even bars); the right end of the bar is cut at a slant; a lighter bevel runs along the top edge and a darker shadow edge along the bottom. Spelled exactly E-C-O-T-E-C, nothing else. Built as a real, slightly weathered painted metal sign, a little dusty, lit only by daylight — no glow, no backlight, no neon, no light rays. The wordmark may repeat very small on the rover's door or a suit's shoulder patch. No other text, no other logo.

STYLE — match the original Terraforming Mars cards, which are photographs of real places: a photograph or sober documentary image of a real research station, NOT cinematic concept art; think of a documentary photograph of an agricultural research station with experimental plots in a remote desert; standard lens 35–50 mm from standing eye height at the edge of the test field, slightly off-axis so the beds and the façade run diagonally while the logo stays centred; asymmetric framing, never a symmetrical vanishing-point avenue; light only from plausible sources — the low afternoon sun throwing long shadows of the beds, tunnels, tanks and people across the dust, the scattered pink skylight, a few warm lamps inside the greenhouse wing; NO volumetric god-rays, glowing haze, lens flares, glossy reflections or bloom; a restrained palette of red-brown dust, grey concrete, dull composite and weathered paint, with the greens of the beds growing quietly from rust to moss to leaf and the logo's green and yellow repeated only in a few small places; no teal-and-orange grade, no cyan sci-fi tint, no saturated neon green; everything real and USED (dust in every seam, scuffed suits, stained tanks, hand-written stakes without readable text); modest human scale — a working station, not a monument; slight grain, no gloss, no AI sheen. Be warm in the idea and sober in the photograph: the drama is in life slowly taking hold of dead soil, never in effects.

NEVER: an interior view, a laboratory hall, a domed biome seen from inside; a giant transparent dome covering everything; a lush green jungle or open meadow outdoors (outdoors only the first, sparse, low life on the beds); trees outdoors; large animals, livestock or pets outdoors; a blue sky, clouds or water outdoors (this is Mars); Earth or other planets in the sky; glowing bacteria or glowing liquids; hovering vehicles or sleek white sci-fi architecture; a symmetrical vanishing-point avenue; a giant sculpted or glowing logo; readable text or numbers anywhere; any text other than the ECOTEC logo; game icons, tokens, cards, cubes, trophies or medals as objects; a card frame or border; heroic posing or glamour portraits; collage, split screen or inset.

OUTPUT: one landscape image, 1536×1024 (3:2), full bleed. Under the image write one short sentence naming the idea.
```

## Служебное

- **Проверить глазами:** это ЗДАНИЕ снаружи (не лаборатория изнутри, не купол над всем); логотип над входом по центру,
  ~¼ ширины — «ECOTEC» без ошибок, плашка-брусок со скошенным правым торцом, слева тёмно-зелёное поле с жёлтыми «ECO»,
  справа жёлтое с тёмно-зелёными «TEC», граница у правого края «O», без подсветки; ряд биореакторов с мутной культурой в
  окошках; опытные гряды с ПОСЛЕДОВАТЕЛЬНОСТЬЮ «рыжий реголит → корочка → лишайник/мох → растения под тоннелями»;
  пчёлы — только за стеклом пристройки; язык зелёной корочки за оградой «со второго взгляда»; снаружи нет леса, луга,
  воды, голубого неба; нет «AI-открытки» (лучи, глянец, неон-зелёный, осевая симметрия) — иначе перегенерить.
- **Перегенерация в том же чате:** «Another one: same station, test field and logo, a different moment and vantage —
  nothing from the previous frame's light.»
- **Выход:** PNG 1536×1024 → `C:\Users\zelin\Downloads\Mars Arts\Ecotec_art.png` →
  `node scripts/import-card-art.mjs "C:\Users\zelin\Downloads\Mars Arts\Ecotec_art.png" PC04 --force`
  (ключ арта = `metadata.cardNumber` = `PC04`; ключ уже занят нынешним интерьером — без `--force` импорт откажет) →
  `npm run make:cards`. ⚠ Тот же `PC04` и его миниатюра `assets/card-images/thumb/PC04.webp` — арт лица бот-двойника
  C40: проверить, что миниатюра пересобралась (если `make:cards` печатает «sharp not loaded» — пересобрать миниатюру
  отдельно), и посмотреть лицо C40 в «РАЗЫГРАНО» стола с ботом.

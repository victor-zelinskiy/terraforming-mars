# Арт корпорации · Hartlan Heating (Turmoil Redux) — промт для генератора OpenAI

Составлен 2026-10-26. Семейство корпоративных артов (`R07` Pristar, `R38` Lakefront, `R14` TerraLabs, `R33` Utopia, `R10`
Point Luna; промты-соседи `corporation-art-septem-tribus.md`, `corporation-art-arwind.md`, `corporation-art-ferrus-academy.md`):
широкий план резиденции корпорации, ЛОГОТИП крупно по центру на главной поверхности, мир и люди корпорации вокруг;
фото-честность стилевого блока резолюций сохраняется.

Что читаем со скана: метки Космос + Здание; 48 M€ + 2 пр. тепла; эффект — после зелёной карты, ставящей тайл, +6 тепла
и +1 пр. M€; действие — 12 тепла → 2 карты. Лор: «космос очень холодный — рассвет космических полётов принёс огромный спрос
на отопление; Hartlan его закрыл и вырос до размеров, достаточных для терраформирования». Фон скана — белёсая дымка,
город с куполами и башнями. Логотип — шестигранная «H»: две оранжевые скобки-шеврона с толстой оранжевой обводкой,
внутри серебристые трубы (две вертикальные стойки и горизонтальная перемычка на муфтах), верх и низ центра залиты
фиолетовым; под ним HARTLAN (оранжевые капители) и HEATING (фиолетовые, мельче).

Приложить к запуску: скан `…\TM Turmoil Redux\Corporations\Corporation - Hartlan Heating.png` (логотип слева вверху —
копировать С НЕГО).

## Промт (один блок, скопировать целиком)

```
You are illustrating the CORPORATION card "Hartlan Heating" for a fan expansion of the board game Terraforming Mars. Attached: the card scan — copy the corporate logo from its top-left corner. Generate ONE finished illustration right away, without asking questions.

WHO THEY ARE. Space is very cold. The dawn of space travel brought an enormous demand for heating solutions — for capsules, stations, habitats — and Hartlan was one of the companies that filled it, which grew it to a size fit for the terraforming of Mars. Today Hartlan keeps whole Martian settlements warm: district heating plants, buried heat mains, heat exchangers the size of houses. Every new greenhouse, forest and town on its network means more heat sold. Its people are plant operators, pipe fitters and heating engineers — practical, unglamorous, proud that nobody on their grid freezes.

THE PICTURE. A wide view of Hartlan's district heating plant on the edge of a domed Martian town, at dawn on a bitterly cold morning. In the centre of the frame stands the plant's main building: a solid, modern industrial block of insulated cladding panels with a control room window band, flanked by rows of large heat-exchanger units, squat insulated tanks and a short exhaust stack releasing a thin, natural plume of vapour that drifts sideways in the wind. From the plant, thick insulated heating mains on low pipe racks run off across the ground towards the town's domes and towers in the hazy distance. The ground is rust-red Martian soil covered in white frost — everywhere except along one buried heat main that runs from the plant out to a cluster of brand-new greenhouses and young trees under a small dome: along that line the frost has melted into a dark, damp strip, and the greenhouses glow faintly green from their grow lamps. Real people at work: two fitters in insulated pressure suits kneeling at an open pipe joint with a thermal camera, an operator visible in the control room window with a mug, a service crawler parked by a valve pit. Only one detail tells the origin story, to be found on the second look: beside the plant's entrance, on a small concrete plinth, an old, dented spacecraft cabin heater unit from the early days of space travel, kept as a company relic.

THE LOGO — the centre of the image. Mounted on the façade of the main building in the exact centre of the frame, about one quarter of the image width: the Hartlan Heating logo copied faithfully from the scan — a hexagonal letter H made of two orange chevron-shaped brackets with a thick orange outline, inside them silver-grey metal pipes (two upright pipes and one horizontal pipe crossbar joined by pipe-coupling fittings), the spaces above and below the crossbar filled with purple; beneath it the word HARTLAN in heavy orange capitals and the word HEATING in smaller purple capitals (letters spelled exactly H-A-R-T-L-A-N and H-E-A-T-I-N-G). Built as solid flat-painted metal fixed to the cladding, frosted at its lower edges, lit by the dawn daylight and one plain floodlight — no glow, no backlight, no neon. The H symbol may repeat very small, stencilled on a pipe rack or a valve-pit cover. No other text, no other logo.

STYLE — match the original Terraforming Mars cards, which are photographs of real places: a photograph or sober engineering visualisation of a real industrial facility, NOT cinematic concept art; think of a documentary photograph of a real Nordic district heating plant on a winter morning; standard lens 35–50 mm from standing eye height, slightly off-axis so the pipe racks run diagonally away from the camera while the logo stays centred; light only from plausible sources — low cold dawn daylight from a small sun near the horizon, blue-grey around the sun, the plant's plain work floodlights and the faint grow lamps of the greenhouses; NO volumetric god-rays, glowing haze, lens flares, mirror-polished floors or bloom; a cold palette of frost white, blue-grey and rust red, with the orange and purple of the logo repeated only in a few small places (a valve wheel, a pipe band, a crawler's stripe) and the small green of the greenhouses as the warm accent; no teal-and-orange grade; hardware utilitarian and USED (insulation patches, frost on bolts, cable trays, hazard striping, scuffed paint, ice at pipe joints); modest human scale — a working plant, not a power cathedral; slight grain, no gloss, no AI sheen. Be bold in the idea and sober in the photograph: the drama is in the melted line through the frost, never in effects.

NEVER: fire, flames, lava or glowing red-hot metal; dramatic billowing smoke or a polluting smokestack skyline; steampunk pipes and brass; any text other than the Hartlan Heating logo; game icons, tokens, cards, cubes or UI; a card frame or border; heroic posing, glamour portraits; matching coloured uniforms for everyone; a symmetrical vanishing-point corridor; collage, split screen or inset.

OUTPUT: one landscape image, 1536×1024 (3:2), full bleed. Under the image write one short sentence naming the idea.
```

## Служебное

- **Проверить глазами:** «H» шестигранная, из оранжевых шевронов с серебристыми трубами и фиолетовыми вставками; надписи
  HARTLAN (оранжевая) / HEATING (фиолетовая) без ошибок; логотип один крупный по центру; видна оттаявшая полоса в инее до
  теплиц (идея кадра); нет огня/раскалённого металла и стимпанка; нет «AI-открытки» (лучи, зеркальный пол, осевая
  симметрия) — иначе перегенерить.
- **Перегенерация в том же чате:** «Another one: same plant and logo, a different moment and vantage — nothing from the
  previous frame's light.»
- **Выход:** PNG 1536×1024 → `C:\Users\zelin\Downloads\Mars Arts\Hartlan Heating_art.png` → при внедрении карты
  `node scripts/import-card-art.mjs "<png>" <ключ арта = metadata.cardNumber карты>` → `npm run make:cards`.

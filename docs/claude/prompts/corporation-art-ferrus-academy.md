# Арт корпорации · Ferrus Academy (Turmoil Redux) — промт для генератора OpenAI

Составлен 2026-10-26. Семейство корпоративных артов (`R07` Pristar, `R38` Lakefront, `R14` TerraLabs, `R33` Utopia, `R10`
Point Luna; промты-соседи `corporation-art-septem-tribus.md`, `corporation-art-arwind.md`): широкий план резиденции
корпорации, ЛОГОТИП крупно по центру на главной поверхности, мир и люди корпорации вокруг; фото-честность стилевого блока
резолюций сохраняется.

Что читаем со скана: метки Наука + Город; 45 M€ (на плашке 40 — опечатка скана, текст правил — 45) + 1 пр. растений;
первое действие — город с ДВОЙНЫМ бонусом размещения, затем куб игрока на каждую соседнюю незарезервированную клетку —
ставить туда тайлы может только владелец; эффект — тайл на клетку со своим кубом → 3 данных на любую карту или карта.
Лор: «на заре терраформирования 5 богатых академиков сложили средства в самоуправляемый исследовательский кампус ради
науки. Плата за обучение астрономическая, но диплом ценится везде». Фон скана — светлый, почти белый: купола и белые
корпуса. Логотип — монограмма «FA» (F тёмно-бирюзовая, A оранжевая, квадратные блочные буквы встык) на белой плашке со
скруглёнными углами в тёмно-бирюзовой обводке; справа надпись FERRUS (бирюзовая) над тонкой линией и ACADEMY (оранжевая).

Приложить к запуску: скан `…\TM Turmoil Redux\Corporations\Corporation - Ferrus Academy.png` (логотип слева вверху —
копировать С НЕГО).

## Промт (один блок, скопировать целиком)

```
You are illustrating the CORPORATION card "Ferrus Academy" for a fan expansion of the board game Terraforming Mars. Attached: the card scan — copy the corporate logo from its top-left corner. Generate ONE finished illustration right away, without asking questions.

WHO THEY ARE. At the dawn of the terraforming effort five rich academics pooled their fortunes to found a self-governing research campus on Mars, for the benefit of the sciences. Tuition is astronomical, but the pedigree is valued everywhere: a Ferrus diploma opens every door on the planet. The Academy is a city in its own right — lecture halls, laboratories, libraries, dormitories, a data centre — and it guards its grounds jealously: the plots around the campus are reserved, and only the Academy may build on them. Its people are professors, researchers and the privileged children of the solar system's elite — earnest, ambitious, quietly aware of what they paid to be here.

THE PICTURE. A wide view across the main quadrangle of the Ferrus Academy campus, inside a large pressurised dome on Mars, on the first morning of the academic year. In the centre of the frame stands the Academy's main hall: a calm, modern building of pale stone-white panels and tall windows, with a broad flight of shallow steps. In front of it, a lawn with young trees planted in neat rows, still staked and wired — the campus grows its own green. Real people crossing the quad: new students in expensive civilian clothes dragging good luggage, parents who look as if they paid for the dome, a professor with a coffee and an armful of data drives talking to two postgraduates, a groundskeeper watering a sapling, a cleaning robot on the path. Around the edge of the campus, seen through the gaps between buildings and under the dome's frame, the empty plots of rust-coloured ground reserved for future faculties: survey stakes, a low fence, a foundation slab poured and waiting — the land is already the Academy's even where nothing stands yet. Beyond the dome glass, the Martian landscape under a pale butterscotch morning sky. Only one detail tells the pedigree story, to be found on the second look: five bronze founders' plaques set into the wall beside the main entrance, and a small private shuttle parked on a pad at the dome's edge, plainly belonging to one of the families.

THE LOGO — the centre of the image. Mounted on the façade of the main hall above the entrance, in the exact centre of the frame, about one quarter of the image width: the Ferrus Academy logo copied faithfully from the scan — the monogram FA made of two tall, square-cut block capitals set side by side, the F in dark teal and the A in bright orange, on a white rounded-square plate with a dark-teal outline; to its right, the word FERRUS in heavy dark-teal capitals above a thin dark-teal rule, and the word ACADEMY in heavy orange capitals beneath it (letters spelled exactly F-E-R-R-U-S and A-C-A-D-E-M-Y). Built as solid flat-painted metal letters fixed to the stone, lit only by the morning daylight with a soft shadow beneath — no glow, no backlight, no neon. The FA monogram may repeat very small on a student's bag or a lanyard. No other text, no other logo.

STYLE — match the original Terraforming Mars cards, which are photographs of real places: a photograph or sober architectural visualisation of a real campus, NOT cinematic concept art; think of a documentary photograph of a real university on its first day of term; standard lens 35–50 mm from standing eye height across the lawn, slightly off-axis so the steps and the paths run diagonally while the logo stays centred; light only from plausible sources — soft Martian morning daylight through the dome, the hall's interior lights faintly visible in the windows; NO volumetric god-rays, glowing haze, lens flares, mirror-polished floors or bloom; a light, airy palette led by pale stone, off-white and soft grey, with the teal and orange of the logo repeated only in a few small places (a banner, a bench, a bicycle), the young green of the trees and the rust of Mars beyond the glass; no teal-and-orange colour grade over the image; materials real and lived-in (scuffed steps, dust at the dome seams, fresh soil, cable ducts, signposts without readable text); modest human scale — a campus, not a palace; slight grain, no gloss, no AI sheen. Be bold in the idea and sober in the photograph: the drama is in the privilege and in the reserved empty land, never in effects.

NEVER: graduation caps thrown in the air, a crowd posing for the camera, glamour portraits; classical columns, a Greek temple or a gothic Oxford pastiche; floating books, holograms or glowing screens; any text other than the Ferrus Academy logo; game icons, tokens, cards, cubes or UI; a card frame or border; matching uniforms for everyone; a symmetrical vanishing-point avenue; collage, split screen or inset.

OUTPUT: one landscape image, 1536×1024 (3:2), full bleed. Under the image write one short sentence naming the idea.
```

## Служебное

- **Проверить глазами:** монограмма — F бирюзовая, A оранжевая, обе квадратные; надписи FERRUS / ACADEMY без ошибок
  (генераторы теряют букву R или пишут ACADAMY); логотип один крупный по центру; видны пустые зарезервированные участки
  (это механика карты); нет колонн/«Оксфорда», нет брошенных шапочек; нет «AI-открытки» (лучи, зеркальный пол, осевая
  симметрия) — иначе перегенерить.
- **Перегенерация в том же чате:** «Another one: same campus and logo, a different moment and vantage — nothing from the
  previous frame's light.»
- **Выход:** PNG 1536×1024 → `C:\Users\zelin\Downloads\Mars Arts\Ferrus Academy_art.png` → при внедрении карты
  `node scripts/import-card-art.mjs "<png>" <ключ арта = metadata.cardNumber карты>` → `npm run make:cards`.

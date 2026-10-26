# Арт корпорации · Arwind Inc. (Turmoil Redux) — промт для генератора OpenAI

Составлен 2026-10-26. Семейство корпоративных артов (`R07` Pristar, `R38` Lakefront, `R14` TerraLabs, `R33` Utopia, `R10`
Point Luna; промт-сосед `corporation-art-septem-tribus.md`): широкий план резиденции корпорации, ЛОГОТИП крупно по центру
на главной поверхности, мир и люди корпорации вокруг; фото-честность стилевого блока резолюций сохраняется.

Что читаем со скана: метка Космос, 38 M€ + 1 пр. титана; ресурс ИСТРЕБИТЕЛЬ (действие — истребитель на любую карту,
шаг Карьеры → истребитель, истребители платят за метку Космоса по 4 M€). Лор: «не просто производитель кораблей, а
ЕДИНСТВЕННЫЙ — де-факто монополия через эксклюзивные государственные контракты». Фон скана — холодный стально-синий
космос с тяжёлыми кораблями. Логотип — словесный знак: «ARWIND» тяжёлыми угловатыми чёрными буквами на белой вытянутой
плашке со скошенными острыми концами в чёрной обводке, под ней «INC.».

Приложить к запуску: скан `…\TM Turmoil Redux\Corporations\Corporation - Arwind Inc.png` (логотип слева вверху —
копировать С НЕГО).

## Промт (один блок, скопировать целиком)

```
You are illustrating the CORPORATION card "Arwind Inc." for a fan expansion of the board game Terraforming Mars. Attached: the card scan — copy the corporate logo from its top-left corner. Generate ONE finished illustration right away, without asking questions.

WHO THEY ARE. Arwind does not just want to be a spaceship manufacturer — it wants to be THE spaceship manufacturer, with a de facto monopoly on the whole business, and it has got there through exclusive government contracts. It builds the patrol craft, escorts and small single-seat fighters that every authority around Mars flies, and it builds them in series: its real product is not one ship but the production line and the contract that keeps it running. Its people are engineers, riggers and test pilots who know there is no competitor left to lose the next order to — calm, efficient, a little smug.

THE PICTURE. A wide view inside Arwind's orbital shipyard above Mars, in a pressurised assembly bay whose far side is open to space through a huge dock aperture: Mars below, curving across the lower part of the opening, the thin bright line of its atmosphere at the limb, black space above. In the centre of the frame, held in a steel dry-dock cradle, the long flank of a grey military patrol cruiser nearly finished — panel seams, access hatches, sensor blisters, scaffolding still on one end. In the foreground and midground, a long row of IDENTICAL compact single-seat space fighters stands on assembly stands in perfect order, canopies open, in unpainted grey with one thin dark stripe, at different stages of completion: the repetition is the point — this yard turns ships out like a factory turns out trucks. Real people at work: a rigger on a scissor lift fitting an engine bell, two technicians in grey coveralls running a cable test, a test pilot in a flight suit with a helmet under one arm. Near the line, a small group of government buyers in civilian suits and one officer in a plain service uniform walk with an Arwind engineer, one of them signing on a clipboard — the contract being accepted. Only one detail tells the monopoly story, to be found on the second look: in the depth of the dock, the neighbouring slipway that once belonged to another builder stands empty and half dismantled, its cradle cut down, its cranes parked.

THE LOGO — the centre of the image. Painted large on the flank of the cruiser in the exact centre of the frame, about one quarter of the image width: the Arwind wordmark copied faithfully from the scan — the word ARWIND in heavy, wide, angular black display capitals with sharp chamfered cuts (letters spelled exactly A-R-W-I-N-D), set on a white elongated plate whose left and right ends are cut to sharp chevron points, with a thick black outline; the word INC. in smaller white bold capitals directly beneath the plate. Flat paint on metal, slightly worn at the panel seams, lit by the same light as the rest of the hull — no glow, no backlight, no 3D lettering. The same wordmark may repeat very small, stencilled on the noses of a few fighters. No other text, no other logo.

STYLE — match the original Terraforming Mars cards, which are photographs of real places: a photograph or sober engineering visualisation of a real orbital facility, NOT cinematic concept art; think of documentary photographs from the International Space Station and of real aircraft assembly halls; standard lens 35–50 mm from a gantry slightly above the floor, slightly off-axis so the row of fighters runs diagonally while the logo stays centred; light only from plausible sources — the hard white sunlight entering through the dock aperture with crisp black shadows, plus the bay's own neutral work floodlights; NO volumetric god-rays, glowing haze, lens flares, mirror-polished floors or bloom; muted cool palette led by steel grey, blue-grey and black with the rust orange of Mars below as the only warm colour, no teal-and-orange grade; hardware utilitarian and USED (cable runs, brackets, fasteners, scuffed paint, hazard striping, tool carts, protective covers); modest human scale — a working factory in orbit, not a cathedral; slight grain, no gloss, no AI sheen. Be bold in the idea and sober in the photograph: the drama is in the endless identical row and the empty rival slipway, never in effects.

NEVER: ships in combat, explosions, laser fire or a space battle; a fleet flying in formation as an epic vista; star-destroyer-sized megastructures; any text other than the Arwind wordmark; game icons, tokens, cards, cubes or UI; a card frame or border; heroic posing, glamour portraits; matching coloured uniforms for everyone; a symmetrical vanishing-point corridor; collage, split screen or inset.

OUTPUT: one landscape image, 1536×1024 (3:2), full bleed. Under the image write one short sentence naming the idea.
```

## Служебное

- **Проверить глазами:** надпись — именно ARWIND (генераторы путают W/V и теряют букву), плашка с острыми концами, «INC.»
  под ней; логотип один крупный по центру (мелкие повторы на носах истребителей — допустимы); истребители ОДИНАКОВЫЕ;
  нет боя/взрывов; нет «AI-открытки» (лучи, зеркальный пол, осевая симметрия) — иначе перегенерить.
- **Перегенерация в том же чате:** «Another one: same yard and logo, a different moment and vantage — nothing from the
  previous frame's light.»
- **Выход:** PNG 1536×1024 → `C:\Users\zelin\Downloads\Mars Arts\Arwind Inc_art.png` → при внедрении карты
  `node scripts/import-card-art.mjs "<png>" <ключ арта = metadata.cardNumber карты>` → `npm run make:cards`.

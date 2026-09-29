# Арт планеты · колония VESTA (Turmoil Redux) — только арт, механика позже

Выдан 2026-09-29. Скан плитки: `C:\Users\zelin\Downloads\TM Turmoil Redux\Colonies\Vesta.png`.
Конвейер тот же, что у 11 базовых планет (2026-09-27) и Redux‑Венеры: генерация квадрата 1024×1024 на
ЧЁРНОМ фоне → `node scripts/import-planet-art.mjs "<путь>/vesta.png" vesta` → `assets/colonies-planets/vesta.webp`
(скрипт сам режет круглую альфу, ресемплирует диск в круг и ОТКАЗЫВАЕТ обрезанному краем или полуосвещённому диску —
при отказе перегенерировать, `--force` не давать).

## Промт для генератора (один блок, скопировать целиком)

```
Photorealistic astronomical image of the asteroid 4 Vesta as photographed by NASA's Dawn spacecraft framing camera in natural colour — sober scientific documentation, NOT cinematic concept art. The complete body centred, viewed from directly above its south pole so that its outline reads as a near-perfect circle (never a potato silhouette, never a flattened side touching the frame), the disc spanning 98% of the square frame, on a pure flat black background with no stars, no nebula, no gradient. The surface is the real Vesta, not a generic asteroid: the vast Rheasilvia impact basin filling the centre of the disc with its broad, rounded central mound; the older Veneneia basin overlapping its rim; the parallel equatorial troughs of Divalia Fossae curving around the limb; heavily cratered, older terrain beyond them; the 'snowman' crater trio (Marcia, Calpurnia, Minucia) near one edge; subtle bright ejecta rays and darker carbon-rich patches. Regolith a natural muted grey with only a faint warm tan tint, as in Dawn's true-colour releases — no colour grading, no orange, no blue cast, no teal-and-orange look. A single sun low from the upper left, the body nearly fully lit, not a crescent, no deep black terminator, only gentle relief shadows inside craters and troughs. No atmosphere glow, no haze, no rim light, no lens flare, no bloom, no vignette, no text, no spacecraft, no rings. Slight photographic grain, no gloss, no AI sheen. Square image, 1024×1024.
```

## Служебное (коротко)
- **Референсы приложить:** вырезанную Весту со скана плитки (общая тональность) и реальный снимок Dawn с южного
  полюса (Rheasilvia с центральной горой — NASA PIA15678 или любой true‑colour кадр 2011–2012). Референс нужен,
  чтобы модель не нарисовала Цереру/Луну: у Весты характерная «сплющенная» форма и гигантский полярный бассейн.
- **Почему вид с полюса:** консоль клипает круг, а скрипт требует ЗАПОЛНЕННЫЙ круглый диск (порог округлости) —
  Веста в профиль (572×557×446 км) даёт овал с плоским югом, и это тот же класс ловушки, что у Деймоса/Паллады.
- **Цвет — натуральный** (решение владельца по Луне 2026-09-27): на скане Веста тёплая коричневато‑бежевая, это
  стилизация плитки; в true‑colour Dawn она серая с лёгкой теплотой. Если модель уйдёт в «песочный шар» — перегенерить.
- Выход: PNG 1024×1024 → `C:\Users\zelin\Downloads\Mars Arts\planets\vesta.png` → импорт командой выше.
  LESS‑правило `.Vesta-background` появится вместе с самой колонией (промт на механику — отдельно; по скану:
  бонус колонии — сталь, доход торговли — X мехов ИЛИ X астероидов ИЛИ X истребителей по позиции, трек
  5 стали ×3 на первых делениях, шкала 0 1 1 1 2 2 3).

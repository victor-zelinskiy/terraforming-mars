---
description: i18n rules — English text is the key, duplicate-key build crash, canonical RU terminology, never rewrite someone else's translation.
paths:
  - "src/locales/**"
---

# Localization rules

## The model
Custom i18n (`src/client/directives/i18n.ts`, `v-i18n`): **the English string IS the key** — there is no `en/` locale. Translations live in `src/locales/<lang>/*.json`; `make_static_json` unions every file in a language directory.

## ⚠️ Duplicate keys CRASH the build
`make_static_json` throws `Repeated translation for [...]` when the same key appears in two files. **Before adding a key, grep the EXACT key across ALL of `src/locales/<lang>/*.json`** (`ui.json`, `UI_cards.json`, `cards.json`, `card_info.json`, `play_prompts.json`, `console.json`, `endgame.json`, `board_info.json`, `log_messages.json`, `game_end.json`, `help_iconography.json`, …). If the existing translation fits, reuse it; if not, coin a NEW more-specific English key rather than reusing a bad fit. Verify with `npm run make:json`.

## ⚠️ Never modify the RU translation of a key you didn't introduce
The same English string appears in logs, card text, tooltips and labels, each with its own context. Rewriting `"Convert"` to make one button read nicely silently changes it everywhere. Introduce a new, more specific English key instead. If you must reuse one, grep every usage across `src/client/`, `src/server/` and the other locales first, confirm the wording fits ALL of them, and call it out in your summary.

## File placement
- Card prompt titles → `ru/play_prompts.json`
- UI strings → `ru/ui.json`; console strings → `ru/console.json`; board explainability → `ru/board_info.json`; endgame → `ru/endgame.json`
- Generated/authored card text keys → `ru/card_info.json` (**hand-maintained** — the generator never writes it, it only reports gaps in `cardInfoAudit.json`)
- Card lore → `ru/lore_texts.json`
- An action-graphic key bakes an `'Action: '` / `'Effect: '` prefix — add the prefixed key (the client strips it).

## RU terminology — check two sources, in order
1. **The project itself** — grep `src/locales/ru/` and reuse the existing wording. Established: `Building → Здание`, `Space → Космос`, `Science → Наука`, `Power → Энергия`, `Earth → Земля`, `Venus → Венера`, `Plant → Растение`, `Microbe → Бактерия`, `Animal → Животное`, `Event → Событие`, `Wild → Любая`, `tag → метка`, `Ares → Арес`, hazard → «опасная зона».
2. **The official Russian edition** («Покорение Марса», Crowd Games) for tag / milestone / award / standard-project / resource names. If the project contradicts the printed canon, surface the discrepancy instead of silently picking one.

**Canonical abbreviations: TR → РТ, VP → ПО.** Never coin a new abbreviation. Never translate proper nouns that look like player names or English card names unless they're already in a translation file.

Adding a language later = fill the same English keys in a new `<lang>/` directory; zero code changes.

# Desktop removal — wave 5: the last components reachable from no entry

**Date:** 2026-11-13 · **Status:** DONE · **Predecessors:** `DESKTOP_REMOVAL_WAVE_1.md`, `DESKTOP_REMOVAL_WAVE_2.md`, `DESKTOP_REMOVAL_WAVE_3.md` · **Why now:** the V3 rework (`docs/claude/vapor/ROADMAP.md` § 4) converts every component off the Options API; dead code is deleted, not converted.

## 1. What was deleted, and why it was dead

An import-reachability walk from `src/client/main.ts` (static and dynamic `import()` edges, global registrations) left **17 Options-API components that nothing live reaches** — each imported only by its own spec, or only by another of the 17. Each was checked by path, by its kebab / Pascal tag in every template, and by dynamic import before it went.

| Deleted (`src/client/components/…`) | What reached it |
| --- | --- |
| `GlobalParameterValue.vue` · `WarningsComponent.vue` · `Party.vue` · `common/DynamicTitle.vue` · `common/PopupPanel.vue` · `card/CardTag.vue` · `delta/DeltaProjectBoard.vue` | its own spec only |
| `LanguageIcon.vue` → `LanguageSelectionDialog.vue` | the icon by its spec only; the dialog by the icon |
| `additionalResources/AdditionalResourcesPanel.vue` → `AdditionalResourceTooltip.vue` | nothing; the tooltip by the panel |
| `colonies/ColonyDetailView.vue` · `colonies/ColonyTradePaymentModal.vue` | two guard allow-lists («frozen desktop — scheduled for deletion») and a spec |
| `console/ConsoleConfirmDialog.vue` | nothing (`docs/claude/console/prompt-modal-family.md` had already said so) |
| `payment/StandardProjectPaymentContent.vue` → `PaymentFormV2.vue` → `PaymentRowV2.vue` | nothing; each by the one before it |

**Deleted with them** (what ONLY they used): `src/client/mixins/PaymentWidgetMixin.ts` (the client's LAST mixin — the readiness ledger's `mixin` row is at zero) and `src/client/mixins/HomeMixin.ts` (imported by nothing), `src/client/components/delta/DeltaBoardStep.ts` (a type of the delta board), and the eleven unit specs whose only subject was a deleted component (`GlobalParameterValue` · `LanguageIcon` · `LanguageSelectionDialog` · `Party` · `WarningsComponent` · `PaymentRowV2` · `card/CardTag` · `colonies/ColonyTradePaymentModal` · `common/DynamicTitle` · `common/PopupPanel` · `delta/DeltaProjectBoard`). 31 files in all.

## 2. What was kept, and why

- **Stylesheets and locale keys** the deleted components used (`payments_v2.less`, the `.card-tag` rules of `premium_tags.less` / `card_render_dsl.less`, `app_chrome.less`) — LESS and locales ride their own waves; several of those sheets also style live markup.
- `additionalResources/AdditionalResourceDetailOverlay.vue`, `additionalResources.ts`, `additionalResourcesState.ts`, `payment/paymentModelUtils.ts`, `colonies/colonyTradePlan.ts`, `card/cardWarnings.ts`, `console/paymentPlan.ts` — live importers (the console payment task stands on `paymentModelUtils` and `paymentPlan`; the trade composer on `colonyTradePlan`). Their comments that pointed at a deleted file as if it stood are corrected.
- The words `Party` / `CardTag` elsewhere in `src` are other things (the Turmoil parties; `Tag as CardTag` from `src/common/cards/Tag`).

## 3. What named them

- `tests/colonies/colonyCardResourceReader.spec.ts` and `tests/console/colonyBerths.spec.ts` — the allow-list rows of the two colony views are removed (the second list is now empty).
- `scripts/mark-desktop-deprecation.mjs` — four entries removed.
- `tests/console/vaporReadinessBaseline.json` — regenerated with the wave (`options-api` −17, `mixin` 1 → 0).

## 4. Upstream-sync policy

**Keep deleted.** An upstream change to any of these files is dropped at the merge (the console surfaces that replaced them are the product); a NEW upstream component that imports one of them is the signal to look at what the console needs, not to restore the file.

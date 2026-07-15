# Desktop UI deprecation — inventory (2026-07-15)

**Decision:** the desktop UI is FROZEN. All UI work goes into console native (`?console=1`); the future desktop UI will be rebuilt FROM the finished console UI. See the banner in `CLAUDE.md`. **Nothing is deleted** — desktop stays a working fallback.

This file answers ONE question: **is the file I'm about to touch frozen, or does console stand on it?**

Counts: **~93 desktop-only · ~232 shared · ~135 console-only** client files.

---

## The mode boundary (verified)

`App.vue` performs a **shell split**, not an overlay:

```
<ConsoleShell v-else-if="screen === 'player-home' && playerView !== undefined && consoleModeState.enabled" />
<player-home  v-else-if="screen === 'player-home' && playerView !== undefined" />
```

`ConsoleShell` sits ABOVE `player-home` in a `v-else-if` chain and both are `defineAsyncComponent` — so **in console mode the `player-home` chunk is never even downloaded**. Same for pre-game: `ConsoleMainMenu` / `ConsoleCreateGame` replace `PremiumMainMenu` / `PremiumCreateGame`.

The mode flag is `src/client/console/consoleModeState.ts` (`?console=1|0` → `localStorage['tm_console_mode']` → default OFF). `GamepadLayer` mounts in BOTH modes on every screen and owns console bootstrap + `html.con-profile-*` + `consoleKeyBridge`.

### ⚠️ The two definitions of "desktop-only" — do not confuse them

| | Meaning | Consequence |
| --- | --- | --- |
| **by IMPORT** | Not reachable from `ConsoleShell`'s import graph | Truly frozen — console never loads it |
| **by MOUNTING** | Reachable/loaded, but its App-level `v-if` carries `&& !consoleModeState.enabled` | Frozen as a *surface*, but its state/models are shared |

**They do NOT coincide.** The biggest trap: `MandatoryInputModal`, `PlacementBanner`, `Select*.vue` and all of `modalInputs/*` look like "desktop modals" but are **SHARED** — `ConsoleShell` mounts `WaitingFor.vue`, which pulls the whole `PlayerInputFactory` chain. Touching them affects console.

### The rule

> **A client file is DESKTOP-ONLY iff it is unreachable from `ConsoleShell`'s import graph.** Everything reachable — directly or transitively — is SHARED and stays live.

**The boundary runs per FILE, not per directory.** Nearly every feature directory is MIXED: `actions/actionExtraction.ts` is shared but `actions/ActionsOverlay.vue` is frozen; `journal/journalState.ts` is shared but `journal/JournalPanel.vue` is frozen. Never assume a folder is frozen because its overlay is.

**Rule of thumb:** the pure model / state / extraction / server-facing layer is shared and live; the Vue overlay that renders it on desktop is frozen. This is exactly the split the console port was built on — it is why the port was cheap. Keep it that way: **put new logic in a pure model, not in a component.**

### App-level layers — which mode gets them

**Gated OFF in console** (`&& !consoleModeState.enabled`) → desktop-only surface:
`DraftFlowOverlay` · `StartGameFlowOverlay` · `DrawCardRevealFlow` · `RevealResultOverlay` · `MaCeremonyOverlay` · `BotTurnReviewOverlay` · `JournalPanel` · `RevealedCardsModal`

**NOT gated → render in BOTH modes, therefore live:**
`NotificationLayer`¹ · `TurnHandoffLayer` · `EnergyConversionOverlay` · `HazardCleanupOverlay` · `AdditionalResourceDetailOverlay` · `EffectDetailOverlay` · `EndgameExperience` · `RematchLayer` · `GameAtmosphere` · `AppBootLoader` · `ConsoleLoadingScreen` · `GameExitButton` · `RealtimeLayer` · `GamepadLayer` · `DesktopUpdateOverlay`

¹ `NotificationLayer.vue` is the one desktop-side file that imports from `console/`: it swaps its card component — `cardComponent = consoleEnabled ? ConsoleNotificationCard : NotificationCard` (`NotificationLayer.vue:179`). The **layer** is shared; only `NotificationCard.vue` is frozen.

⚠️ `EndgameExperience` + `RematchLayer` + `MandatoryInputModal` are the documented **legacy fallback surfaces** the console TV profile integrates via `zoom: var(--con-ui-scale)` (see the TV-profile section in `CLAUDE.md`). They are **not** frozen — console renders them today. They are the port backlog (§5).

---

## 1. SHARED — console stands on these; full quality bar applies

Format: `module` — console importer.

### Module reactive state (survives the shell split, drives both modes)
| Module | Console importer |
| --- | --- |
| `journal/journalState` | `ConsoleJournalPanel`, `ConsoleShell` |
| `notifications/notificationState`, `notificationBus` | `ConsoleShell` |
| `notifications/notificationTypes`, `revealViewerState` | `ConsoleNotificationCard`, `ConsoleRevealOverlay`, `ConsoleShell` |
| `presentation/presentationFlow`, `presentationPolicy` | `ConsoleShell` |
| `board/boardInfoState` | `ConsoleBoardSection`, `ConsoleShell` |
| `board/scaleTooltipState` | `ConsoleContextPanel`, `ConsoleShell` |
| `drawnCards/drawnCardsState` | `ConsoleRevealOverlay`, `ConsoleShell`, `ConsoleBoardCardBonusLayer` |
| `ma/maCeremonyState`, `maConfirmModel`, `maArt` | `ConsoleMaCeremony`, `ConsoleMaConfirm`, `consoleMaInspectModel` |
| `marsbot/botTurnReviewState` | `ConsoleBotTurnReview`, `ConsoleShell` |
| `marsbot/marsBotPresentation`, `marsBotTurnArchive` | `ConsoleJournalPanel`, `ConsoleShell` |
| `hydronetwork/hydroNetworkState` | `ConsoleHydroSection`, `ConsoleShell` |
| `startGameFlow/startSetupRevealState` | `ConsoleResourcePanel`, `ConsoleStartScene`, `ConsoleShell` |
| `startGameFlow/startGameFlowState` | `ConsoleStartScene` |
| `feedback/changeFeedbackManager` | `ConsoleMaCeremony`, `ConsoleTerraformingCeremony`, `consoleGovScaleFocus` |
| `feedback/energyConversionTransition` | `ConsoleResourcePanel` |
| `gameProgress/terraformingCelebration` | `ConsoleTerraformingCeremony` |
| `desktop/desktopUpdateState`, `steamShortcutState` | `ConsoleMainMenu`, `consoleKeyBridge`, `consoleLayoutProfile`, `runtimeMode` |
| `handCards/sellPatentsState`, `handSelectState`, `handPlayState`, `standardProjectPlayState` · `awards/awardFundingState` · `placementLockState` · `playedCards/playedCardsPickState` · `actions/revealResultState` · `draftWaitState` · `initialDraft/initialDraftSharedState` | **transitively** via `ConsoleShell → WaitingFor.vue` |

### Pure models & extraction (the reusable brain — invest freely)
| Module | Console importer |
| --- | --- |
| `motion/motionTokens` | **21 files** — `ConsoleShell`, `ConsoleStartScene`, `ConsoleTaskHost`, `cardDeal/*Director`, `consoleZoomMotion`, `ceremony/ceremonyFx`, … |
| `modalInputs/optionIcons` | 10 console files |
| `actions/actionModel` | `ConsoleActionComposer`, `ConsoleCardActions`, `consoleCardActions` |
| `actions/actionExtraction` | `ConsoleInfoMode`, `ConsolePlayCardConfirm`, `ConsoleShell` |
| `actions/actionBranchView`, `actionPlayability`, `actionUsageSummary` | `ConsoleCardActions`, `consoleCardActions` |
| `effects/effectExtraction` | `ConsoleInfoMode`, `ConsolePlayCardConfirm` |
| `effects/effectSummary` | transitively (`effectExtraction`, `actionUsageSummary`) |
| `overview/victoryPointsModel` | `ConsoleInfoMode` |
| `overview/standardProjectVisuals` | `ConsoleJournalPanel`, `consoleQuickModel` |
| `overview/playerLabels`, `playerStatusPresenter` | `ConsoleStatusStrip` |
| `handCards/handCardModel`, `unplayableReasonFormat` | `consoleHandFilter` |
| `colonies/colonyTradePlan` | 5 console files |
| `colonies/colonyTradePreviewFetch` | `ConsoleColoniesSection`, `ConsoleColonyInspect`, `ConsoleShell` |
| `hydronetwork/hydroNetworkModel`, `hydroStages`, `hydroReward` | `ConsoleHydroConfirm`, `ConsoleHydroSection` |
| `hydronetwork/hydroPreview` | `ConsoleJournalPanel` |
| `hydronetwork/hydroReasons` | `ConsoleHydroSection` |
| `journal/journalView`, `journalDataSource`, `boardCellHighlight` | `ConsoleJournalPanel` |
| `journal/journalFilter` | `ConsoleJournalPanel`, `consoleJournalModel` |
| `journal/journalEventChild` | `ConsoleNotificationCard` |
| `marsbot/marsBotDisplay` | **15 files** |
| `marsbot/marsBotView`, `marsBotGuide` | `ConsoleInfoMode`, `ConsoleMarsBotSections` |
| `gameProgress/terraformingProgress` | `ConsoleStatusStrip` |
| `startGameFlow/startSetupRevealModel` | `ConsoleStartScene` |
| `PaymentLedger`, `PaymentDefaults`, `payment/paymentModelUtils` | `console/paymentPlan`, `ConsoleShell` |
| `board/placementReason`, `specialCellInfo`, `arcScaleTheme` | `ConsoleShell` |
| `board/TileView` | `ConsoleBoardSection` |
| `common/cardResources`, `additionalResources/additionalResources`, `initialDraft/initialDraftMoney` | console misc |
| `cards/ClientCardManifest` | 10 console files |
| `cards/cardArt` | `ConsoleCardFaceLite` |
| `MilestoneAwardManifest`, `colonies/ClientColonyManifest` | console |
| `directives/i18n` (29 files), `stripActionPrefix` | console |
| `utils/PreferencesManager`, `documentTitle`, `runtimeConfig`, `reducedMotion` | console |

### Shared Vue components (rendered by BOTH shells)
| Component | Console importer |
| --- | --- |
| `card/CardFace.vue` | `ConsoleHandSection`, `ConsoleInfoMode`, `ConsolePlayCardConfirm`, `ConsoleRevealOverlay`, `ConsoleStartScene`, `ConsoleTaskHost`, `ConsoleDraftTray`, … |
| `premiumCard/PremiumCard.vue`, `premiumCardTheme` | `ConsoleCardFaceLite`, `ConsolePlayedCardLite` |
| `card/CardTitle/CardCost/CardTags/CardContent/CardExpansion/CardVictoryPoints/CardRequirementsComponent` | `ConsoleCardFaceLite` |
| `card/CardRenderData`, `CardRenderEffectBoxComponent` | `ConsoleCardActions` |
| `card/CardZoomModal`, `CardZoomCard`, `cardZoomTypes` | `ConsoleShell`, `consoleCardZoom` |
| **`WaitingFor.vue`** | `ConsoleShell` — ⚠️ pulls `PlayerInputFactory` → `Select*.vue`, `modalInputs/*`, `MandatoryInputModal`, `PlacementBanner` |
| **`GameBoardView.vue`** | `ConsoleBoardSection` — ⚠️ pulls `Board`, `BoardSpace`, `moon/`, `pathfinders/`, `turmoil/`, arc-scale chain |
| `SelectSpace.vue` | `ConsoleShell` |
| `Tag.vue`, `TagCount.vue` | console |
| `feedback/AnimatedMetricValue.vue` | `ConsoleResourcePanel`, `ConsoleStatusStrip` |
| `actions/ActionEffectChip.vue` | 5 console files |
| `effects/EffectBlock.vue` | `ConsoleInfoMode` |
| `colonies/BenefitGlyph.vue`, `ColonyFleetIcon.vue`, `ColonyFleetPad.vue` | `ConsoleColonies*` |
| `overview/BarButtonIcon.vue` | 5 console files |
| `board/BoardFactGroups.vue` | `ConsoleContextPanel` |
| `journal/JournalEntry.vue`, `JournalGroup.vue` | `ConsoleJournalPanel` |
| `journal/JournalTokenRenderer.vue` | `ConsoleNotificationCard` |
| `ma/MaHeroArt.vue` | `ConsoleMaCeremony`, `ConsoleMaConfirm`, `ConsoleMaInspect` |
| `marsbot/BotTurnReviewBody.vue`, `BotReviewEdgeNotice.vue` | `ConsoleBotTurnReview` |
| `marsbot/MarsBotTracks.vue`, `BonusCardFace.vue` | `ConsoleMarsBotSections` |
| `hydronetwork/HydroReward.vue` | `ConsoleHydroConfirm`, `ConsoleHydroSection` |
| `gamepad/GamepadGlyph.vue` | **37 files** — the most-shared component |
| `gamepad/gamepadPollModel` (27), `glyphSets` (11), `focusScopes`, `spatialNav`, `inputModeState`, `gamepadSettings` | console |
| `cardAnnotations/*` | transitively via `CardZoomModal` |
| `create/premium/PremiumMapFingerprint.vue` | `ConsoleMapDeck`, `ConsoleLaunchPanel`, `ConsoleLaunchConfirm` |

### Pre-game (the console menu reuses desktop create-state)
`create/premium/createGameState` (8 console files) · `createGameMeta` (8) · `submitCreateGame` (`ConsoleCreateGame`) · `mainMenu/identity/identityState` (3), `playerIdentity`, `joinGamesState`, `lastGameState`, `expansionMeta` (`ConsoleMainMenu`, `ConsoleProfileEditor`) · `vueRoot` (`ConsoleCreateGame`, `ConsoleMainMenu`)

### Shared BY MOUNTING (console renders them; not imported by console code)
`endgame/*` (incl. the whole `insightEngine` / `gameStoryDna` / `keyEpisodeEngine` storytelling stack) · `rematch/*` · `realtime/*` · `TurnHandoffLayer` · `EnergyConversionOverlay` · `HazardCleanupOverlay` · `AdditionalResourceDetailOverlay` · `EffectDetailOverlay` · `GameAtmosphere`

**Everything under `src/server/`, `src/common/`, `src/locales/` is unaffected by this deprecation.** The EXPANSION ADAPTATION CHECKLIST in `CLAUDE.md` stays fully in force.

---

## 2. DESKTOP-ONLY — frozen; do not develop (~93 files)

**Shell:** `PlayerHome.vue` · `Sidebar.vue` · `KeyboardShortcuts.vue` · `KeyboardNavigation.ts` · `SortableCards.vue` · `StackedCards.vue` · `mixins/HomeMixin.ts` · `utils/CardUtils.ts` · `utils/useBoardAutoScale.ts` · `playerViewState.ts`

**Bar overlays:** `handCards/HandCardsOverlay.vue`, `OpponentHandOverlay.vue` · `playedCards/PlayedCardsOverlay.vue` · `actions/ActionsOverlay.vue` · `effects/EffectsOverlay.vue` · `overview/VictoryPointsOverlay.vue`, `MilestonesOverlay.vue`, `AwardsOverlay.vue`, `StandardProjectsOverlay.vue` · `colonies/ColoniesOverlay.vue` · `hydronetwork/HydroNetworkOverlay.vue` · `journal/JournalPanel.vue` (+ `JournalFeed`, `JournalGenerationSelector`, `JournalFilterSelector`) · `marsbot/MarsBotBoardOverlay.vue`, `MarsBotPanel.vue` · `overview/LeftPlayerPanel.vue`, `LeftPlayerCard.vue` · `additionalResources/AdditionalResourcesPanel.vue`

**Desktop-only state/models:** `cardPickRouting.ts` · `actions/actionsOverlayState.ts`, `actionsPickState.ts`, `actionRepeatPick.ts` · `effects/effectsOverlayState.ts` · `overview/privateScoreState.ts`, `turnHandoffState.ts` · `additionalResources/additionalResourcesState.ts` · `handCards/handActionPick.ts` · `playedCards/playedCardActionPick.ts`, `playedCardGroups.ts`, `playedCardsPickReason.ts`, `playedCardsViewState.ts`, `playedTableauFit.ts`

**Sub-components:** `actions/{ActionDetailsPanel, ActionGroupCard, ActionNextStepNotice, ActionResultsPreview, ActionRevealSlot, ActionsFilters, CardActionConfirmContent, CompactActionCard, RepeatActionPicker}` · `handCards/{HandCardItem, HandCardPaymentContent, HandCardsEmptyState, HandCardsFilters, TabbedRemovalPicker}` · `playedCards/{PlayedCardItem, PlayedCardsEmptyState, PlayedCardsFilters, PlayedCardsGroup, PlayedCardsStack, PlayedCardsTable, PlayedCardsTableRow}` · `overview/{AwardFundedBadge, ConvertHeatConfirmContent, HiddenVictoryPointsLock, MaConfirmContent, MilestoneClaimedBadge, PassConfirmContent, PlayerAlliedParty, PlayerResource(s), PlayerStatusGlyph, PlayerTagDiscount, PlayerTags, PointsPerTag, PrivateScoreMask}` · `initialDraft/{InitialDraftCeoStep, InitialDraftCorpStep, InitialDraftFinalConfirmContent, InitialDraftPillStack, InitialDraftPreludeStep, InitialDraftProjectsStep, InitialDraftSkipConfirmContent, InitialDraftStatusRail}` · `notifications/NotificationCard.vue` · `common/DynamicTitle.vue` · `card/PremiumCardWarnings.vue` · `effects/EffectDetailsPanel.vue` · `colonies/ColonyTradePaymentModal.vue`, `Colony.vue` · `payment/StandardProjectPaymentContent.vue` · `additionalResources/AdditionalResourceTooltip.vue` · `turmoil/AlliedPartyAgenda.vue` · `underworld/UndergroundTokens.vue` · `moon/MoonGlobalParameterValue.vue`

**Desktop-only by MOUNTING only** (state/models shared — see the ⚠️ table): `DraftFlowOverlay` · `StartGameFlowOverlay` · `DrawCardRevealFlow` · `RevealResultOverlay` · `MaCeremonyOverlay` · `BotTurnReviewOverlay` · `RevealedCardsModal` · `initialDraft/InitialDraftFlowOverlay.vue`

**Legacy (pre-fork, already dead-ish):** `GameEnd.vue` + `gameend/*` + `logpanel/*` (reachable only via a direct `/the-end?id=` link and `SpectatorHome`) · the legacy radio stack (`OrOptions.vue` / `SelectOption.vue` inline path)

**Mode-independent (neither — leave alone):** `admin/*` · `auth/*` · `boot/*` · `help/*` · `cardlist/*` · `SpectatorHome.vue` · `games-overview`

---

## 3. CONSOLE-ONLY — the live surface (~135 files)

`src/client/components/console/**` (≈75) · `src/client/console/**` (≈60) · `src/client/components/gamepad/**` (shared-by-use but console-native by nature).

**Back-edges (console code imported by desktop-side files — expected, don't "fix"):** `NotificationLayer.vue:118` → `ConsoleNotificationCard` + `consoleModeState`; `App.vue:409` → `ConsoleLoadingScreen`, `loadingScreenState`, `consoleModeState`; `App.vue:385` → `console/colonyFleet/consoleTradeFleet`, `console/hydroMarker/consoleHydroMarker`, `console/played/consolePlayedHero` (the `isXActive()` commit guards).

See `CONSOLE_MODE_CONCEPT.md` + `CONSOLE_FOUNDATION.md`.

---

## 4. Styles

⚠️ **All `.less` compile into ONE bundle via `src/styles/common.less`** (console files imported at lines 325–332). There is no per-mode bundle — the classification below is by *selector ownership / actual render*, and is the one section derived non-mechanically. Console-only + infrastructure groups are reliable; individual desktop/shared calls may be off by one or two.

**Console-only (8):** `console.less` · `console_foundation.less` · `console_menu.less` · `console_card_deal.less` · `console_trade_fleet.less` · `console_board_bonus.less` · `console_played.less` · `console_tv.less`

**Desktop-only (frozen):** `player_home.less` · `right_sidebar.less` · `players_overview.less` · `player_status_chip.less` · `other_player.less` · `hand_cards.less` · `played_cards.less` · `actions_overlay.less` · `effects_overlay.less` · `victory_points.less` · `vp_progress.less` · `colonies_overlay.less` · `additional_resources.less` · `initial_draft.less` · `start_game_flow.less` · `drawn_cards.less` · `reveal_viewer.less` · `card_action_buttons.less` · `card_selection.less` · `log.less` · `card_help.less` · `cards_filter.less` · `colonies_filter.less` · `corporations_filter.less` · `create_game_form.less` · `main_menu.less` · `start_screen.less` · `load_game_form.less` · `game_home.less` · `games-overview.less` · `card_list.less` · `help.less` · `preferences.less` · `popup.less`
*(`create_game_premium.less` is PARTIALLY shared — `PremiumMapFingerprint.vue` renders in `ConsoleMapDeck`/`LaunchPanel`/`LaunchConfirm`.)*

**Shared:**
- *Cards:* `cards.less` · `cards_v2.less` · `cards_scifi.less` · `premium_card.less` · `premium_tags.less`
- *Board:* `board.less` · `board_items_positions.less` · `board_placement_animation.less` · `bonus_zones.less` · `ares.less` · `moon.less` · `pathfinders.less` · `underworld.less` · `turmoil.less` · `colonies.less` · `colony_fleet.less` · `arc_scale.less` · `ocean_arc_scale.less` · `scale_marker.less` · `scale_tooltip.less` · `special_cell_info.less`
- *Input/modals (via `WaitingFor`):* `modal_inputs.less` · `waiting_for.less` · `contextual_choice.less` · `venus_bonus.less` · `payments.less` · `payments_v2.less` · `mandatory_input_modal.less` · `placement_banner.less`
- *Cross-mode layers:* `gamepad.less` · `notifications.less` · `turn_handoff.less` · `game_atmosphere.less` · `boot_loader.less` · `energy_conversion.less` · `hazard_cleanup.less` · `resource_change_feedback.less` · `endgame.less` · `final_scoring_reveal.less` · `rematch.less` · `game_end.less`
- *Other:* `journal.less` · `bot_review.less` · `hydronetwork.less` · `ma_confirm.less` · `card_annotations.less` · `main_menu_identity.less` · `player_cube.less` · `resources.less`
- *Infrastructure (always):* `variables.less` · `mixins.less` · `globs.less` · `common.less` · `language_hacks.less` · `language_icon.less`

---

## 5. Port backlog — shared surfaces still on a desktop implementation

These render in console TODAY via the legacy-fallback `zoom: var(--con-ui-scale)` integration. This is the concrete "finish console native" worklist; until each is ported, its desktop implementation is **live code, not frozen**:

1. **`MandatoryInputModal` + `modalInputs/*` premium inputs** — the generic prompt fallback reached through the shared `WaitingFor`. `ConsoleTaskHost` already serves most `TaskKind`s; the rest strand here. Highest value.
2. **`EndgameExperience` + `endgame/*`** — the whole storytelling stack (Iterations 5–17) is already pure-model + a desktop Vue skin; a console skin reuses `insightEngine` / `gameStoryDna` / `keyEpisodeEngine` / `corporationImpactEngine` unchanged.
3. **`RematchLayer` + `rematch/*`** — small, self-contained; `rematchState` is already module-reactive.
4. **`TurnHandoffLayer`, `EnergyConversionOverlay`, `HazardCleanupOverlay`, `AdditionalResourceDetailOverlay`, `EffectDetailOverlay`** — ungated App layers with desktop-shaped chrome.
5. **`cardAnnotations/*`** — fullscreen rule overlay, already reached from the shared `CardZoomModal`; mostly needs TV-profile typography, not a rewrite.
6. **`PlacementBanner`** — shared via `WaitingFor`; console has its own placement flow but the banner still rides along.

When one is ported, move its entry component from §1/§5 into §2 and mark it frozen.

---

## Method / confidence
Derived by (a) a transitive walk of the import graph (`from '@/client/…'` + dynamic `import()`) out of `src/client/components/console/` + `src/client/console/`, with ONE manual cut of the back-edge `vueRoot.ts → App.vue` (which otherwise makes everything look shared); (b) reading the `v-if` mode gate of every App-level layer in `App.vue`; (c) resolving `PlayerHome.vue`'s import graph. The import-derived lists are mechanical and reliable; the `.less` split is judgement-based (single bundle, no per-file imports). **When in doubt, grep before assuming a file is frozen.**

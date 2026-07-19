// One-shot marker stamper for the 2026-07-15 desktop-UI deprecation.
// Prepends a `@deprecated` / `@console-shared` banner to client files so the
// frozen-vs-live boundary is visible in the editor, not only in the audit doc.
// Idempotent: a file that already carries its marker is skipped.
// Inventory + rationale: docs/DESKTOP_DEPRECATION_AUDIT.md
import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {resolve, extname} from 'node:path';

const ROOT = resolve(process.argv[2] ?? '.');
const C = 'src/client/components';

const DEPRECATED_NOTE = [
  '@deprecated Desktop-only UI — FROZEN 2026-07-15. Do not develop further.',
  'All UI work goes into console native (`?console=1`, ConsoleShell.vue); the next',
  'desktop UI will be rebuilt from it. Unreachable from ConsoleShell, so changes',
  'here cannot affect console. Fix only what breaks the shared layer or play.',
  'See docs/DESKTOP_DEPRECATION_AUDIT.md + the deprecation banner in CLAUDE.md.',
];

const SHARED_NOTE = [
  '@console-shared LIVE — console native stands on this file, so it is NOT covered',
  'by the desktop-UI deprecation. Full quality bar applies (tests, guards, i18n).',
  'Before changing it, check the console consumers in docs/DESKTOP_DEPRECATION_AUDIT.md.',
];

// Desktop-only ENTRY surfaces. The audit lists ~93 frozen files; stamping every
// leaf sub-component would be noise, so we mark the entries a reader actually
// opens first — the ones whose whole subtree is frozen.
const DEPRECATED = [
  `${C}/PlayerHome.vue`,
  `${C}/Sidebar.vue`,
  `${C}/KeyboardShortcuts.vue`,
  `${C}/SortableCards.vue`,
  `${C}/StackedCards.vue`,
  'src/client/mixins/HomeMixin.ts',
  `${C}/cardPickRouting.ts`,
  `${C}/handCards/HandCardsOverlay.vue`,
  `${C}/handCards/OpponentHandOverlay.vue`,
  `${C}/handCards/HandCardPaymentContent.vue`,
  `${C}/playedCards/PlayedCardsOverlay.vue`,
  `${C}/playedCards/playedCardsViewState.ts`,
  `${C}/playedCards/playedTableauFit.ts`,
  `${C}/actions/ActionsOverlay.vue`,
  `${C}/actions/ActionDetailsPanel.vue`,
  `${C}/actions/CardActionConfirmContent.vue`,
  `${C}/actions/actionsOverlayState.ts`,
  `${C}/effects/EffectsOverlay.vue`,
  `${C}/effects/EffectDetailsPanel.vue`,
  `${C}/effects/effectsOverlayState.ts`,
  `${C}/overview/VictoryPointsOverlay.vue`,
  `${C}/overview/MilestonesOverlay.vue`,
  `${C}/overview/AwardsOverlay.vue`,
  `${C}/overview/StandardProjectsOverlay.vue`,
  `${C}/overview/LeftPlayerPanel.vue`,
  `${C}/colonies/ColoniesOverlay.vue`,
  `${C}/colonies/ColonyTradePaymentModal.vue`,
  `${C}/hydronetwork/HydroNetworkOverlay.vue`,
  `${C}/journal/JournalPanel.vue`,
  `${C}/journal/JournalFeed.vue`,
  `${C}/notifications/NotificationCard.vue`,
  `${C}/marsbot/MarsBotBoardOverlay.vue`,
  `${C}/marsbot/MarsBotPanel.vue`,
  `${C}/additionalResources/AdditionalResourcesPanel.vue`,
  `${C}/initialDraft/InitialDraftFlowOverlay.vue`,
  `${C}/DraftFlowOverlay.vue`,
  `${C}/startGameFlow/StartGameFlowOverlay.vue`,
  `${C}/payment/StandardProjectPaymentContent.vue`,
];

// SHARED files that LOOK desktop — the traps. A reader seeing "overlay/modal/
// desktop-ish name" would reasonably assume frozen; console actually mounts them.
const SHARED = [
  `${C}/WaitingFor.vue`,
  `${C}/MandatoryInputModal.vue`,
  `${C}/PlacementBanner.vue`,
  `${C}/GameBoardView.vue`,
  `${C}/SelectSpace.vue`,
  `${C}/notifications/NotificationLayer.vue`,
  `${C}/notifications/notificationState.ts`,
  `${C}/journal/journalState.ts`,
  `${C}/journal/journalView.ts`,
  `${C}/presentation/presentationFlow.ts`,
  `${C}/board/boardInfoState.ts`,
  `${C}/actions/actionExtraction.ts`,
  `${C}/actions/actionModel.ts`,
  `${C}/effects/effectExtraction.ts`,
  `${C}/effects/effectSummary.ts`,
  `${C}/overview/victoryPointsModel.ts`,
  `${C}/handCards/handCardModel.ts`,
  `${C}/colonies/colonyTradePlan.ts`,
  `${C}/hydronetwork/hydroNetworkModel.ts`,
  `${C}/ma/maConfirmModel.ts`,
  `${C}/startGameFlow/startGameFlowState.ts`,
  `${C}/card/CardFace.vue`,
  `${C}/premiumCard/PremiumCard.vue`,
  `${C}/motion/motionTokens.ts`,
  `${C}/feedback/changeFeedbackManager.ts`,
  `${C}/create/premium/createGameState.ts`,
];

const MARK = {deprecated: DEPRECATED_NOTE[0], shared: SHARED_NOTE[0]};

function banner(lines, ext) {
  const body = lines.map((l) => ` * ${l}`).join('\n');
  const block = `/**\n${body}\n */`;
  // A Vue SFC has no top-level JS scope, so a JS block comment before <template>
  // is a parse error — use an HTML comment there instead.
  return ext === '.vue' ? `<!--\n${lines.join('\n')}\n-->` : block;
}

let stamped = 0; let skipped = 0; const missing = [];

for (const [kind, list] of [['deprecated', DEPRECATED], ['shared', SHARED]]) {
  for (const rel of list) {
    const abs = resolve(ROOT, rel);
    if (!existsSync(abs)) { missing.push(rel); continue; }
    const src = readFileSync(abs, 'utf8');
    if (src.includes(MARK[kind])) { skipped++; continue; }
    const note = kind === 'deprecated' ? DEPRECATED_NOTE : SHARED_NOTE;
    writeFileSync(abs, `${banner(note, extname(abs))}\n${src}`, 'utf8');
    stamped++;
  }
}

console.log(`stamped=${stamped} already-marked=${skipped} missing=${missing.length}`);
if (missing.length > 0) console.log('MISSING (path drifted — fix the list):\n  ' + missing.join('\n  '));

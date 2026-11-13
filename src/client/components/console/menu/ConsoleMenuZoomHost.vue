<template>
  <div v-if="!consoleState.shellMounted" class="con-menu-zoom-host">
    <transition name="con-zoom-veil">
      <div v-if="consoleCardZoom.card !== undefined"
           class="con-zoom-veil"
           :class="{'con-zoom-veil--lifted': zoomClosing}"
           aria-hidden="true"></div>
    </transition>
    <div v-if="zoomOpenProxy !== undefined" class="con-zoom-flight-layer" aria-hidden="true">
      <div ref="zoomFlightProxy" class="con-zoom-flight-proxy">
        <div class="con-zoom-flight-proxy__zoom" :style="{zoom: String(zoomOpenProxy.zoom)}">
          <CardZoomCard :card="zoomOpenProxy.card" :selected="zoomSelected" />
        </div>
      </div>
    </div>
    <CardZoomModal v-if="consoleCardZoom.card !== undefined"
                   ref="cardZoom"
                   class="con-zoom"
                   :navCounter="!consoleCardZoom.counterInFooter"
                   :class="{'con-zoom--flight': zoomFlight, 'con-zoom--closing': zoomClosing, 'con-zoom--parliament': zoomResolutionId !== undefined, 'con-zoom--plates': zoomResolutionId !== undefined}"
                   :card="consoleCardZoom.card"
                   :cards="consoleCardZoom.cards.length > 1 ? consoleCardZoom.cards : undefined"
                   :index="consoleCardZoom.index"
                   :selected="zoomSelected"
                   :dismissable="!consoleCardZoom.mandatory"
                   :closing="zoomClosing"
                   :consoleMotion="true"
                   :annotationsSuppressed="zoomHasRules || zoomResolutionId !== undefined || zoomTenderAnnotations !== undefined"
                   :flankMotion="zoomResolutionId !== undefined"
                   :lore="true"
                   @navigate="onCardZoomNavigate"
                   @close="onCardZoomClosed">
      <!-- A RESOLUTION (Turmoil Redux) reads as the in-game scene does: its
           PARTY left, its own rules right, its standing and the viewer's
           influence readings in the bar — the same panels, fed the table the
           opener passed (`consoleCardZoom.parliament`; none → the catalog
           reading: the formula, no invented number). -->
      <template v-if="zoomResolutionParty !== undefined" #aside="aside">
        <div class="con-zoom-asidecol">
          <ConsoleResolutionAside :party="zoomResolutionParty"
                                  :parliament="zoomParliament"
                                  :viewer="zoomViewer"
                                  :contextKey="zoomResolutionContextKey"
                                  :tier="zoomResolutionTier"
                                  :nonce="aside.nonce"
                                  :closing="aside.closing" />
        </div>
      </template>
      <template v-if="zoomHasRules || zoomResolutionId !== undefined || zoomTenderAnnotations !== undefined" #side="side">
        <div class="con-zoom-sidecol">
          <ConsoleCardRulesPanel v-if="zoomResolutionId !== undefined"
                                 ref="zoomRulesPanel"
                                 keepOrder
                                 :tier="zoomResolutionTier"
                                 :annotationsOverride="zoomResolutionAnnotations"
                                 :nonce="side.nonce"
                                 :closing="side.closing" />
          <!-- A campaign TENDER: the contract's rule, window and buyout (`tenderAnnotations`) — the shell's own branch. -->
          <ConsoleCardRulesPanel v-else-if="zoomTenderAnnotations !== undefined"
                                 ref="zoomRulesPanel"
                                 keepOrder
                                 :annotationsOverride="zoomTenderAnnotations"
                                 :nonce="side.nonce"
                                 :closing="side.closing" />
          <ConsoleCardRulesPanel v-else-if="zoomRulesCardName !== undefined"
                                 ref="zoomRulesPanel"
                                 :cardName="zoomRulesCardName"
                                 :nonce="side.nonce"
                                 :closing="side.closing" />
        </div>
      </template>
      <template #actions>
        <div v-if="consoleCardZoom.contextLabel !== undefined" class="con-zoom__context">
          <span class="con-zoom__context-mark" aria-hidden="true">◈</span>
          <span>{{ $t(consoleCardZoom.contextLabel) }}</span>
        </div>
        <div class="con-zoom__bar" :class="{'con-zoom__bar--scene': zoomResolutionId !== undefined}">
          <ConsoleResolutionStatus v-if="zoomResolutionStatus !== undefined"
                                   class="con-zoom__bar-info"
                                   :status="zoomResolutionStatus"
                                   :viewerColor="zoomViewer" />
          <ConsoleInfluenceYield v-if="zoomResolutionYields.length > 0"
                                 class="con-zoom__bar-yield"
                                 :yields="zoomResolutionYields"
                                 :levy="zoomResolutionLevy"
                                 :formula="false"
                                 size="compact"
                                 data-zoom-yield />
          <!-- …and the answer of the party the resolution brings to power. -->
          <ConsolePartyReaction v-for="r in zoomResolutionReactions" :key="r.reaction.id"
                                class="con-zoom__bar-reaction"
                                :reading="r"
                                size="compact"
                                data-zoom-reaction />
          <ConsoleWinnerReward v-if="zoomResolutionWinner !== undefined && zoomResolutionWinner.context !== 'reference'"
                               class="con-zoom__bar-winner"
                               :reading="zoomResolutionWinner"
                               :viewerColor="zoomViewer"
                               :nameOf="zoomNameOf"
                               size="compact"
                               variant="chip"
                               data-zoom-winner />
          <ConsoleTileGrant v-if="zoomResolutionGrant !== undefined && zoomResolutionGrant.context !== 'reference'"
                            class="con-zoom__bar-grant"
                            :reading="zoomResolutionGrant"
                            size="compact"
                            variant="chip"
                            data-zoom-grant />
          <ConsoleAgendaGrant v-if="zoomResolutionCareer !== undefined && zoomResolutionCareer.context !== 'reference'"
                              class="con-zoom__bar-grant"
                              :reading="zoomResolutionCareer"
                              size="compact"
                              variant="inline"
                              data-zoom-career />
          <span v-if="zoomSelected" class="con-zoom__state">✓ {{ $t('Card selected') }}</span>
          <button v-if="zoomSelectable" type="button" class="con-zoom__btn con-zoom__btn--select" @click="zoomToggleSelect">
            <GamepadGlyph control="confirm" />
            <span>{{ $t(zoomSelected ? zoomDeselectLabel : zoomSelectLabel) }}</span>
          </button>
          <span v-if="consoleCardZoom.cards.length > 1" class="con-zoom__cmd con-zoom__cmd--flip">
            <GamepadGlyph control="bumperL" />
            <span class="con-zoom__flip-arrow" aria-hidden="true">◀</span>
            <!-- The position rides HERE when the opener asks for it (the resolutions stand — registry R-08 / R-22):
                 the same «LB ◀ 1/11 ▶ RB» the game shell prints, no counter plate over the card. -->
            <span v-if="consoleCardZoom.counterInFooter" class="con-zoom__flip-pos" data-zoom-position>
              <b>{{ consoleCardZoom.index + 1 }}</b><span aria-hidden="true">/</span>{{ consoleCardZoom.cards.length }}
            </span>
            <span v-else>{{ $t('Browse') }}</span>
            <span class="con-zoom__flip-arrow" aria-hidden="true">▶</span>
            <GamepadGlyph control="bumperR" />
          </span>
          <button v-if="!consoleCardZoom.mandatory" type="button" class="con-zoom__btn" @click="closeViewer">
            <GamepadGlyph control="back" />
            <span>{{ $t('Close') }}</span>
          </button>
        </div>
      </template>
    </CardZoomModal>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * PRE-GAME FULLSCREEN CARD VIEWER HOST — the App-level twin of the
 * ConsoleShell zoom host, for the console screens that live OUTSIDE a game
 * (main menu, create game, the campaign map). ONE module state drives both:
 * a pre-game surface calls `openConsoleCardZoom(...)` exactly like an
 * in-game one, and whichever host is mounted serves it — the shell in-game,
 * this component everywhere else (never both: App mounts this only off the
 * player screen). Presentation, choreography and input are the shell's,
 * subsetted to what pre-game contexts attach: the select bridge, browsing,
 * the rules side panel, the context caption. The receive/swap/inspect/
 * availability bridges are in-game-only and are never attached here.
 *
 * The OPEN is PROXY-FIRST (consoleZoomMotion): the landing is measured on
 * the still-closed dialog, the premium lift flies the proxy from the source
 * slot (ZoomOrigin), and `showModal()` fires only at touchdown — the same
 * compositor-safe shape as in-game. The source slot is HELD empty while its
 * card is "in the player's hands" (one visual owner), and the close flies
 * the card back into the slot of the card currently on screen.
 *
 * Input arrives via consoleMenuZoomBridge — installMenuPad consults it
 * BEFORE any screen handler, so the viewer owns the pad completely while
 * open (the same carve-out the shell runs first in handleIntent).
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch} from 'vue';
import {ExposedOf} from '@/client/components/exposedOf';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {probeTick} from '@/client/console/probeTick';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import CardZoomCard from '@/client/components/card/CardZoomCard.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleCardRulesPanel from '@/client/components/console/ConsoleCardRulesPanel.vue';
import {CardName} from '@/common/cards/CardName';
import {isResolutionZoom, isTenderZoom, ZoomCard} from '@/client/components/card/cardZoomTypes';
import {tenderAnnotations} from '@/client/console/campaign/tenderAnnotations';
import {Color} from '@/common/Color';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {InfluenceYield} from '@/common/parliament/influenceScaling';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import ConsoleResolutionAside from '@/client/components/console/parliament/ConsoleResolutionAside.vue';
import ConsoleResolutionStatus from '@/client/components/console/parliament/ConsoleResolutionStatus.vue';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import ConsoleWinnerReward from '@/client/components/console/parliament/ConsoleWinnerReward.vue';
import ConsoleTileGrant from '@/client/components/console/parliament/ConsoleTileGrant.vue';
import ConsoleAgendaGrant from '@/client/components/console/parliament/ConsoleAgendaGrant.vue';
import {AgendaGrantReading, agendaGrantReadingOf} from '@/client/console/parliament/agendaGrantModel';
import {$t, translateText} from '@/client/directives/i18n';
import {WinnerRewardReading, winnerRewardReadingOf} from '@/client/console/parliament/winnerRewardModel';
import {TileGrantReading, tileGrantReadingOf} from '@/client/console/parliament/tileGrantModel';
import {CardAnnotation} from '@/client/components/cardAnnotations/annotationModel';
import {resolutionAnnotations, resolutionPartyAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {resolutionPartyContextKey, resolutionStatusOf, ResolutionStatusVm} from '@/client/console/parliament/resolutionInspectModel';
import {enactedLevyOf, enactedYieldsOf, voteLevyOf, voteYieldsOf} from '@/client/console/parliament/influenceYieldModel';
import {LevyReading} from '@/common/parliament/resolutionLevy';
import {PartyReactionReading, partyReactionsOf, viewerHasSeat} from '@/client/console/parliament/partyReactionModel';
import ConsolePartyReaction from '@/client/components/console/parliament/ConsolePartyReaction.vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {consoleState} from '@/client/console/consoleRouter';
import {closeConsoleCardZoom, consoleCardZoom, navigateConsoleCardZoom, ZoomOrigin} from '@/client/console/consoleCardZoom';
import {beginZoomOpen, cancelZoomOpen, playZoomClose, playZoomOpenFlight, releaseZoomMotion, retargetZoomHold, zoomOpenSourceRect} from '@/client/console/consoleZoomMotion';
import {setMenuZoomIntentHandler} from '@/client/console/menu/consoleMenuZoomBridge';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {cardHasRules, denserRulesTier, RulesLengthTier, rulesLengthTier} from '@/client/components/console/consoleCardRules';
import {motionMs} from '@/client/components/motion/motionTokens';

defineOptions({name: 'ConsoleMenuZoomHost'});

const flow = useFlowScope('console-menu-zoom-host');
const cardZoom = useTemplateRef<ExposedOf<typeof CardZoomModal>>('cardZoom');
const zoomRulesPanel = useTemplateRef<{scrollBody?: (dy: number) => boolean}>('zoomRulesPanel');
const zoomFlightProxy = useTemplateRef<HTMLElement>('zoomFlightProxy');
/** Chrome hidden while the open flight carries the card (mirrors the shell). */
const zoomFlight = ref(false);
const zoomClosing = ref(false);
const zoomOpening = ref(false);
const zoomOpenProxy = ref<{card: ZoomCard, zoom: number} | undefined>(undefined);
const zoomOpenToken = ref(0);
let cancelZoomOpenClear = (() => {}) as () => void;
let offZoomIntent: (() => void) | undefined;

const zoomSelectable = computed((): boolean => {
  return consoleCardZoom.select !== undefined && consoleCardZoom.card !== undefined;
});
const zoomSelected = computed((): boolean => {
  const z = consoleCardZoom;
  return z.select !== undefined && z.card !== undefined && z.select.isSelected(z.card.name as CardName);
});
const zoomSelectLabel = computed((): string => {
  return consoleCardZoom.select?.selectLabel ?? 'Select';
});
const zoomDeselectLabel = computed((): string => {
  return consoleCardZoom.select?.deselectLabel ?? 'Deselect';
});
const zoomHasRules = computed((): boolean => {
  const name = zoomRulesCardName.value;
  return name !== undefined && zoomResolutionId.value === undefined && cardHasRules(name);
});
// ── A RESOLUTION on the stage (Turmoil Redux) — the shell's scene readers,
//    over the table the opener passed instead of a live game. ──────────
const zoomResolutionId = computed((): string | undefined => {
  const card = consoleCardZoom.card;
  return card !== undefined && isResolutionZoom(card) ? card.resolution : undefined;
});
const zoomResolutionParty = computed((): ReduxParty | undefined => {
  const id = zoomResolutionId.value;
  return id === undefined ? undefined : getResolution(id)?.party;
});
const zoomParliament = computed((): ParliamentModel | undefined => {
  return consoleCardZoom.parliament?.model();
});
const zoomViewer = computed((): Color | undefined => {
  return consoleCardZoom.parliament?.viewer();
});
const zoomResolutionStatus = computed((): ResolutionStatusVm | undefined => {
  const id = zoomResolutionId.value;
  return id === undefined ? undefined : resolutionStatusOf(id, zoomParliament.value, zoomViewer.value);
});
const zoomResolutionContextKey = computed((): string | undefined => {
  return resolutionPartyContextKey(zoomResolutionStatus.value);
});
const zoomResolutionYields = computed((): ReadonlyArray<InfluenceYield> => {
  const id = zoomResolutionId.value;
  const resolution = id === undefined ? undefined : getResolution(id);
  if (resolution === undefined || (resolution.scaled ?? []).length === 0) {
    return [];
  }
  const model = zoomParliament.value;
  return model?.enacted?.resolution === id ? enactedYieldsOf(resolution, model, zoomViewer.value) : voteYieldsOf(resolution, model, zoomViewer.value);
});
/** THE LEVY of the resolution on the stage (a budget) — read at the same moments as the yields. */
const zoomResolutionLevy = computed((): LevyReading | undefined => {
  const id = zoomResolutionId.value;
  const resolution = id === undefined ? undefined : getResolution(id);
  if (resolution === undefined || resolution.levy === undefined) {
    return undefined;
  }
  const model = zoomParliament.value;
  return model?.enacted?.resolution === id ? enactedLevyOf(resolution, model, zoomViewer.value) : voteLevyOf(resolution, model, zoomViewer.value);
});
/** The RULING PARTY's answer to those readings — the viewer's seat only. */
const zoomResolutionReactions = computed((): Array<PartyReactionReading> => {
  const id = zoomResolutionId.value;
  if (id === undefined || !viewerHasSeat(zoomParliament.value, zoomViewer.value)) {
    return [];
  }
  return partyReactionsOf(getResolution(id), zoomResolutionYields.value);
});
/** The WINNER's tile of the resolution on the stage, read over the opener's table (none outside a table). */
const zoomResolutionWinner = computed((): WinnerRewardReading | undefined => {
  const id = zoomResolutionId.value;
  return id === undefined ? undefined : winnerRewardReadingOf(getResolution(id), zoomParliament.value, consoleCardZoom.parliament?.table?.());
});
const zoomNameOf = computed((): (color: Color) => string => {
  return consoleCardZoom.parliament?.nameOf ?? ((color: Color) => translateText(color));
});
/** A TILE GRANTED BY THRESHOLD on the stage (Skyscrapers): the opener's own reading over its table. */
const zoomResolutionGrant = computed((): TileGrantReading | undefined => {
  const id = zoomResolutionId.value;
  return id === undefined ? undefined : tileGrantReadingOf(getResolution(id), zoomParliament.value, zoomViewer.value);
});
/** A STEP OF THE CAREER FOR EVERY SEAT on the stage (Reds Budget): the opener's own next node and the win's two. */
const zoomResolutionCareer = computed((): AgendaGrantReading | undefined => {
  const id = zoomResolutionId.value;
  return id === undefined ? undefined : agendaGrantReadingOf(getResolution(id), zoomParliament.value, zoomViewer.value);
});
/** A campaign TENDER on the stage — its contract read in the rules column. */
const zoomTenderAnnotations = computed((): ReadonlyArray<CardAnnotation> | undefined => {
  const card = consoleCardZoom.card;
  return card !== undefined && isTenderZoom(card) ? tenderAnnotations(card.tender) : undefined;
});
const zoomResolutionAnnotations = computed((): ReadonlyArray<CardAnnotation> => {
  const id = zoomResolutionId.value;
  return id === undefined ? [] : resolutionAnnotations(id, {table: consoleCardZoom.parliament?.table?.()});
});
const zoomResolutionTier = computed((): RulesLengthTier | undefined => {
  const id = zoomResolutionId.value;
  const party = zoomResolutionParty.value;
  return id === undefined || party === undefined ? undefined :
    denserRulesTier(rulesLengthTier(zoomResolutionAnnotations.value), rulesLengthTier(resolutionPartyAnnotations(party)));
});
const zoomRulesCardName = computed((): CardName | undefined => {
  const name = consoleCardZoom.card?.name;
  return name === undefined ? undefined : (name as CardName);
});

/** The pre-game zoom carve-out (consoleMenuZoomBridge): true ⇔ consumed. */
function onIntent(intent: GamepadIntent): boolean {
  if (consoleCardZoom.card === undefined || consoleState.shellMounted) {
    return false;
  }
  // A close flight is in progress: the card is mid-air — swallow all.
  if (zoomClosing.value) {
    return true;
  }
  // Mid open-flight: only closing is meaningful; B/X aborts cleanly.
  if (zoomOpening.value) {
    if (intent.kind === 'press' && !consoleCardZoom.mandatory) {
      const action = consoleActionOf(intent);
      if (action === 'back' || action === 'inspect') {
        void closeViewer();
      }
    }
    return true;
  }
  const zoom = cardZoom.value ?? undefined;
  const rules = zoomRulesPanel.value ?? undefined;
  if (intent.kind === 'nav') {
    if (intent.dir === 'left') {
      zoom?.prev();
    } else if (intent.dir === 'right') {
      zoom?.next();
    } else {
      // ↑/↓ read the rules column — the same body the right stick pages.
      rules?.scrollBody?.((intent.dir === 'down' ? 1 : -1) * 90 * conUiScale());
    }
    return true;
  }
  if (intent.kind === 'scroll') {
    // The stick's dy is a per-frame deflection (−1…1): scaled to pixels, or
    // the rules crawled under a pixel a frame.
    if (Math.abs(intent.dy) >= 0.05) {
      rules?.scrollBody?.(intent.dy * 24 * conUiScale());
    }
    return true;
  }
  if (intent.kind !== 'press') {
    return true;
  }
  switch (consoleActionOf(intent)) {
  case 'prevSection':
    zoom?.prev();
    return true;
  case 'nextSection':
    zoom?.next();
    return true;
  case 'primary':
    zoomToggleSelect();
    return true;
  case 'back':
  case 'inspect':
    if (!consoleCardZoom.mandatory) {
      void closeViewer();
    }
    return true;
  default:
    return true;
  }
}
function onCardZoomNavigate(card: ZoomCard, pos: number): void {
  navigateConsoleCardZoom(card, pos);
  // The card "in hand" changed: the table hold moves to ITS slot, and the
  // opener keeps the underlying cursor in lockstep.
  retargetZoomHold(pos);
  consoleCardZoom.origin.onBrowse?.(pos);
}
function zoomToggleSelect(): void {
  const z = consoleCardZoom;
  if (z.select !== undefined && z.card !== undefined) {
    z.select.toggle(z.card.name as CardName);
  }
}
/** The open sequence — a direct port of the shell's (consoleZoomMotion). */
async function runZoomOpen(zoom: ExposedOf<typeof CardZoomModal>): Promise<void> {
  const token = ++zoomOpenToken.value;
  zoomOpening.value = true;
  const origin: ZoomOrigin = consoleCardZoom.origin;
  beginZoomOpen(origin);
  const landing = await zoom.measureLanding();
  if (token !== zoomOpenToken.value || consoleCardZoom.card === undefined) {
    return; // closed / reopened while measuring — that sequence owns state
  }
  const index = consoleCardZoom.index;
  if (landing === undefined || consoleReducedMotionActive()) {
    zoom.show();
    zoomOpening.value = false;
    flow.after(motionMs(140), 'the zoom\'s chrome returns', () => {
      if (token === zoomOpenToken.value) {
        zoomFlight.value = false;
      }
    });
    return;
  }
  const source = zoomOpenSourceRect(index);
  zoomOpenProxy.value = {card: consoleCardZoom.card, zoom: landing.zoom};
  await nextTick();
  if (token !== zoomOpenToken.value) {
    return;
  }
  const proxyEl = zoomFlightProxy.value ?? undefined;
  playZoomOpenFlight(proxyEl, index, source, landing.rect, {
    onShow: () => {
      if (token === zoomOpenToken.value && consoleCardZoom.card !== undefined) {
        zoom.show();
      }
    },
    onDone: () => {
      if (token !== zoomOpenToken.value) {
        return;
      }
      zoomOpening.value = false;
      zoomFlight.value = false;
      cancelZoomOpenClear = flow.after(motionMs(160), 'the open flight\'s proxy is cleared', () => clearZoomOpenFlight());
    },
  });
}
function clearZoomOpenFlight(): void {
  cancelZoomOpenClear();
  zoomOpenProxy.value = undefined;
}
/** Choreographed close: chrome hides, the card flies back into the CURRENT
 *  card's slot (physical origin) or dives away, THEN the dialog closes. */
async function closeViewer(): Promise<void> {
  const zoom = cardZoom.value ?? undefined;
  if (zoom === undefined) {
    return;
  }
  const dialogEl = zoom.rootEl ?? undefined;
  // Closed during the OPEN flight (dialog never shown): abort the flight
  // and unwind directly — dialog.close() would no-op and the 'close'
  // event (the normal state unwinder) would never fire.
  if (zoomOpening.value && dialogEl?.open !== true) {
    cancelZoomOpen();
    onCardZoomClosed();
    return;
  }
  zoomFlight.value = true;
  zoomClosing.value = true;
  await playZoomClose(dialogEl as HTMLElement | undefined, consoleCardZoom.index);
  zoom.close();
}
function onCardZoomClosed(): void {
  // Any close path (choreographed B, native Esc, backdrop tap): restore
  // every held slot + kill the flight, then clear the module state.
  releaseZoomMotion();
  zoomOpenToken.value++; // fence out any stale open-sequence callback
  zoomFlight.value = false;
  zoomClosing.value = false;
  zoomOpening.value = false;
  clearZoomOpenFlight();
  document.body.classList.remove('con-zoom-open');
  closeConsoleCardZoom();
}

// The open rides the undefined→defined transition only (navigation keeps
// the dialog open) — a direct port of the shell's open watcher, including
// the synchronous `zoomOpening` mark (a B pressed while the landing is
// being measured must hit the cancel branch, never the normal close).
watch(() => consoleCardZoom.card, (card: ZoomCard | undefined, prev: ZoomCard | undefined) => {
  if (consoleState.shellMounted) {
    return; // the shell's host serves the module in-game
  }
  if (card === undefined && prev !== undefined) {
    // EXTERNAL clear (an opener closed the module directly, e.g. its own
    // unmount): unwind idempotently — the normal close path already ran
    // these in onCardZoomClosed, so a double run is harmless.
    releaseZoomMotion();
    zoomOpenToken.value++;
    zoomFlight.value = false;
    zoomClosing.value = false;
    zoomOpening.value = false;
    clearZoomOpenFlight();
    document.body.classList.remove('con-zoom-open');
    return;
  }
  if (card !== undefined && prev === undefined) {
    zoomFlight.value = true;
    zoomClosing.value = false;
    zoomOpening.value = true;
    document.body.classList.add('con-zoom-open');
    const tryOpen = (attempt: number) => {
      if (consoleCardZoom.card === undefined) {
        return; // closed before it ever opened
      }
      const zoom = cardZoom.value ?? undefined;
      const el = zoom?.rootEl ?? undefined;
      if (zoom === undefined || el === undefined || typeof el.querySelector !== 'function') {
        if (attempt < 10) {
          probeTick(() => tryOpen(attempt + 1));
        } else {
          onCardZoomClosed(); // never strand an open-but-empty zoom state
        }
        return;
      }
      void runZoomOpen(zoom);
    };
    void nextTick(() => tryOpen(0));
  }
});

onMounted(() => {
  offZoomIntent = setMenuZoomIntentHandler((intent) => onIntent(intent));
});
onBeforeUnmount(() => {
  offZoomIntent?.();
  // Screen switch mid-fullscreen (e.g. a mission launch navigates away):
  // never leave the module state / held slots / body class behind.
  if (consoleCardZoom.card !== undefined && !consoleState.shellMounted) {
    onCardZoomClosed();
  }
});
</script>

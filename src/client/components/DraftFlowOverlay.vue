<!--
@deprecated Desktop-only UI — FROZEN 2026-07-15. Do not develop further.
All UI work goes into console native (`?console=1`, ConsoleShell.vue); the next
desktop UI will be rebuilt from it. Unreachable from ConsoleShell, so changes
here cannot affect console. Fix only what breaks the shared layer or play.
See docs/DESKTOP_DEPRECATION_AUDIT.md + the deprecation banner in CLAUDE.md.
-->
<template>
  <!--
    Draft / buy-cards modal mounted at the APP level — outside the
    `<player-home :key="playerkey">` subtree that gets destroyed and
    recreated on every server response. Because this component sits
    in the same Vue tree as App itself, it is NOT subject to the
    playerkey++ remount and stays alive across every draft/research
    transition. The modal flicker the user reported after pressing
    "ВЫБРАТЬ" was caused by that remount unmounting the modal — this
    overlay sidesteps it entirely.

    Routing rules:
      cardInput (waitingfor.type === 'card')   → CardSelectionContent
      isDraftWaiting (waitingfor undefined &&
                      draftWaitState.pending) → DraftWaitingContent
      else                                     → nothing rendered
                                                  (modal v-if is false)

    `WaitingFor` no longer routes `'card'` through its own
    MandatoryInputModal so the two never compete. Payment / WGT /
    other modal inputs continue to flow through WaitingFor's modal.
  -->
  <MandatoryInputModal v-if="shouldShow && playerViewTyped !== undefined" :title="modalTitle">
    <!--
      Drafted-cards pile sits ABOVE the active content. Renders nothing
      when the drafted list is empty (component-internal v-if), so the
      modal is unaffected at the very first round. Visible in BOTH the
      card-selection view AND the waiting view so the player always sees
      what they've banked so far this draft.
    -->
    <DraftedCardsPile :cards="draftedCards" />

    <CardSelectionContent v-if="cardInput !== undefined"
                          :playerView="playerViewTyped"
                          :playerinput="cardInput"
                          :onsave="onsave" />
    <DraftWaitingContent v-else-if="isWaitingState"
                         :playerView="playerViewTyped"
                         :waitingOnPlayers="waitingOnPlayers" />
  </MandatoryInputModal>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {CardModel} from '@/common/models/CardModel';
import {Phase} from '@/common/Phase';
import {InputResponse} from '@/common/inputs/InputResponse';
import {Color} from '@/common/Color';
import {paths} from '@/common/app/paths';
import {statusCode} from '@/common/http/statusCode';
import {INVALID_RUN_ID, AppErrorResponse} from '@/common/app/AppErrorId';
import {Message} from '@/common/logs/Message';
import {translateText} from '@/client/directives/i18n';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {nextViewSnapshot} from '@/client/utils/viewSnapshotShare';
import {primeStartSetupReveal} from '@/client/components/startGameFlow/startSetupRevealState';
import {vueRoot} from '@/client/components/vueRoot';
import {
  draftWaitState,
  shouldPreserveCardPickModal,
} from '@/client/components/draftWaitState';
import {handCardSelectionPrompt} from '@/client/components/handCards/handSelectState';
import {acquireForegroundLease, isMandatoryPromptsHeld} from '@/client/components/presentation/presentationFlow';
import {startFlowAnyPreludePrompt, startFlowCorpSelectPrompt} from '@/client/components/startGameFlow/startGameFlowState';
import MandatoryInputModal from '@/client/components/MandatoryInputModal.vue';
import CardSelectionContent from '@/client/components/CardSelectionContent.vue';
import DraftWaitingContent from '@/client/components/DraftWaitingContent.vue';
import DraftedCardsPile from '@/client/components/DraftedCardsPile.vue';

const CANNOT_CONTACT_SERVER = 'Unable to reach the server. It may be restarting or down for maintenance.';

/*
 * Spectator playerView is shaped differently (SpectatorModel, no
 * waitingFor / thisPlayer). We accept the broader ViewModel from App
 * but only render content when it's a real PlayerViewModel.
 */
function isPlayerView(view: ViewModel | undefined): view is PlayerViewModel {
  return view !== undefined && (view as PlayerViewModel).thisPlayer !== undefined;
}

export default defineComponent({
  name: 'DraftFlowOverlay',
  components: {
    MandatoryInputModal,
    CardSelectionContent,
    DraftWaitingContent,
    DraftedCardsPile,
  },
  props: {
    playerView: {
      type: Object as PropType<ViewModel | undefined>,
      default: undefined,
    },
    /*
     * Live list of player colours the server is still waiting on
     * (from `/api/waitingFor` poll). Passed through from App.vue
     * — populated by WaitingFor's poll loop, which writes to App's
     * root data field. Used by DraftWaitingContent to build the
     * "waiting for Alice, Bob…" line.
     */
    waitingOnPlayers: {
      type: Array as PropType<ReadonlyArray<Color>>,
      default: () => [],
    },
  },
  data() {
    return {
      /*
       * Timestamp (ms since epoch) of the last self-heal force-
       * refresh fired by the `waitingOnPlayers` watcher below.
       * Used to debounce so the same poll-tick repetition can't
       * burst into a request storm if the server keeps reporting
       * us as waited-on for several seconds while we re-fetch.
       */
      lastSelfHealAt: 0,
      /** Release fn of the held 'mandatory-choice' presentation lease. */
      releaseLease: undefined as (() => void) | undefined,
    };
  },
  beforeUnmount() {
    this.releaseLease?.();
    this.releaseLease = undefined;
  },
  watch: {
    /*
     * PRESENTATION FLOW occupancy: while the draft/buy modal is visibly
     * presenting a mandatory choice, it holds a 'mandatory-choice' lease so
     * transient notifications queue instead of floating over it. The lease
     * follows visibility exactly (released when the overlay hides / unmounts).
     */
    shouldShow: {
      immediate: true,
      handler(visible: boolean): void {
        if (visible && this.releaseLease === undefined) {
          this.releaseLease = acquireForegroundLease('mandatory-choice');
        } else if (!visible && this.releaseLease !== undefined) {
          this.releaseLease();
          this.releaseLease = undefined;
        }
      },
    },
    /*
     * Self-heal for the "stuck on waiting screen even though the
     * server has my prompt ready" case.
     *
     * Reported symptom: both players see "ОЖИДАЕМ КАРТЫ ДЛЯ ДРАФТА"
     * but the server's polled wait list names one of them — meaning
     * the server has set THAT player's `waitingFor` and is blocking
     * on their pick, but their local `playerView.waitingFor` is
     * still undefined and `isWaitingState` falls through to the
     * "I'm waiting on others" branch.
     *
     * Probable root cause is a race between WaitingFor's polling
     * decision and the local prop update path. The polling callback
     * computes `viewerHasPrompt = this.waitingfor !== undefined`
     * from the Vue prop. If a recent playerView swap (via
     * applyPlayerViewUpdate in the preserve-card-pick path) hasn't
     * fully propagated to the prop by the time the next xhr.onload
     * fires, viewerHasPrompt can read true momentarily, the
     * `GO + !viewerHasPrompt` gate fails, and `root.updatePlayer()`
     * is skipped. Subsequent ticks normally catch it, but the
     * window where it can stick has been observed in practice.
     *
     * Regardless of root cause, the SYMPTOM is unambiguous: if the
     * server's wait list names me AND my own `view.waitingFor` is
     * undefined, those two facts can't both be right. Force-refresh
     * the playerView to recover. Debounced to one fetch per 3 s so
     * a slow / stuck server can't be hammered into request storms.
     *
     * No-op outside this contradiction — normal "I'm waiting on
     * others to pass me cards" passes through silently because the
     * wait list correctly excludes us in that case.
     */
    waitingOnPlayers(newList: ReadonlyArray<Color>) {
      const view = this.playerViewTyped;
      if (view === undefined) {
        return;
      }
      // A REQUIRED local prompt is genuine mid-input — not stuck. But an OPTIONAL
      // prompt (draft re-pick) is suppressed to the waiting view, so if the server
      // now names us as required-waiting while our stale local view still holds
      // that optional prompt, that IS the stuck contradiction — recover.
      if (view.waitingFor !== undefined && view.waitingFor.optional !== true) {
        return;
      }
      if (!newList.includes(view.thisPlayer.color)) {
        return;
      }
      const now = Date.now();
      if (now - this.lastSelfHealAt < 3000) {
        return;
      }
      this.lastSelfHealAt = now;
      vueRoot(this).updatePlayer();
    },
  },
  computed: {
    playerViewTyped(): PlayerViewModel | undefined {
      return isPlayerView(this.playerView) ? this.playerView : undefined;
    },
    cardInput(): SelectCardModel | undefined {
      const view = this.playerViewTyped;
      if (view === undefined) {
        return undefined;
      }
      const wf = view.waitingFor;
      if (wf === undefined || wf.type !== 'card') {
        return undefined;
      }
      // Optional draft re-pick prompt (upstream #8151): the server lets a player
      // change their pick until everyone has chosen. This fork intentionally does
      // NOT surface a re-pick UI — an optional prompt is treated as "waiting for
      // the other players" (see isWaitingState), so suppress the card grid here.
      if (wf.optional === true) {
        return undefined;
      }
      // Hand-card selections (discard / reveal / pick FROM the player's hand)
      // are hosted by the КАРТЫ В РУКЕ overlay (HandCardsOverlay) in its
      // mandatory-select mode — far better for browsing a large hand than this
      // modal grid. Let PlayerHome drive those; suppress the modal here so the
      // two don't both render. Draft / research / generic non-hand SelectCard
      // (played-card targets, dealt corps) still use this modal grid.
      if (handCardSelectionPrompt(view) !== undefined) {
        return undefined;
      }
      // Every start-of-game card prompt owned by StartGameFlowOverlay — prelude
      // selections (hand / draw / copy) AND Merger's 'choose a corporation'
      // (corporationSelection) — is suppressed here so the two don't both render.
      // Detected via the explicit server marker (startGamePrompt).
      if (startFlowAnyPreludePrompt(view) !== undefined || startFlowCorpSelectPrompt(view) !== undefined) {
        return undefined;
      }
      return wf;
    },
    /*
     * "Between draft rounds" — the player has no active prompt but
     * the game is mid-DRAFT (not mid-buy / mid-research).
     *
     * Two complementary triggers:
     *
     *   1. `draftWaitState.pending` — set by
     *      CardSelectionContent.onConfirm BEFORE a DRAFT submit (it
     *      is explicitly CLEARED before a buy submit, so this flag
     *      can only be true between draft rounds). This is the
     *      in-session signal: we KNOW the player just sent a draft
     *      pick, so we show the waiting view immediately on response
     *      landing.
     *
     *   2. Server-state fallback (refresh resilience) — `phase ∈
     *      card-pick && waitingFor === undefined && draftedCards.length
     *      > 0`. The first two are the same conditions the server
     *      itself uses to hold the player in "wait for the rest of
     *      the table". The third (`draftedCards.length > 0`) is the
     *      KEY distinction between "I'm mid-draft, waiting on others
     *      to pass me the next set" (draftedCards populated by my
     *      earlier picks) and "I just finished my buy round, done
     *      until next gen" (draftedCards cleared by server's draft
     *      endRound). Without this guard the fallback would
     *      mis-fire after a buy submit and re-open a "waiting"
     *      modal that has no real input to wait on — exactly the
     *      bug the player flagged.
     *
     * Both triggers are safe in non-card-pick phases: neither fires.
     * The brief windows where the server is in RESEARCH / DRAFTING
     * but hasn't yet dealt a prompt to us are short — at worst we
     * briefly show the waiting modal that immediately swaps to the
     * card grid when the prompt arrives.
     */
    isWaitingState(): boolean {
      const view = this.playerViewTyped;
      if (view === undefined) {
        return false;
      }
      // A required prompt means it's the player's turn to act — not a wait state.
      // An OPTIONAL prompt (draft re-pick) is treated as "waiting for others":
      // the player already made their required pick, so fall through to show the
      // "Waiting for draft cards" view instead of letting the overlay vanish.
      if (view.waitingFor !== undefined && view.waitingFor.optional !== true) {
        return false;
      }
      if (draftWaitState.pending) {
        return true;
      }
      const phase = view.game.phase;
      const inCardPickPhase =
        phase === Phase.RESEARCH ||
        phase === Phase.DRAFTING ||
        phase === Phase.INITIALDRAFTING;
      return inCardPickPhase && view.draftedCards.length > 0;
    },
    shouldShow(): boolean {
      // PRESENTATION FLOW: while the player is being shown what just happened
      // (the compact AI-turn card / the opened theater), the draft modal
      // holds off mounting — the prompt presents the moment the hold clears
      // (dismiss / TTL / theater close). Bounded, never a stall.
      if (isMandatoryPromptsHeld()) {
        return false;
      }
      return this.cardInput !== undefined || this.isWaitingState;
    },
    modalTitle(): string | Message {
      if (this.cardInput !== undefined) {
        return this.cardInput.title;
      }
      return translateText('Waiting for draft cards');
    },
    /*
     * Server-managed list of cards the viewer has already drafted in
     * this round (populated by Draft.ts push on each pick, cleared in
     * endRound when the draft round transitions to the next phase).
     * Lives directly on PlayerViewModel, NOT on `thisPlayer`. Pile
     * component renders nothing when empty.
     */
    draftedCards(): ReadonlyArray<CardModel> {
      return this.playerViewTyped?.draftedCards ?? [];
    },
  },
  methods: {
    /*
     * Inline replica of WaitingFor.fetchPlayerInput + onsave path,
     * adapted to live at App level. We can't simply call WaitingFor's
     * onsave via a ref because WaitingFor is inside #player-home and
     * its ref invalidates on remount; doing the POST from here
     * directly keeps this overlay self-contained.
     *
     * Response handling mirrors WaitingFor's: on 200 OK, swap
     * root.playerView (skipping playerkey++ when we're staying
     * inside card-pick so even WaitingFor's tree doesn't blink);
     * on bad request, surface via root.showAlert; on network
     * failure, surface via root.showAlert. `isServerSideRequestInProgress`
     * is shared with WaitingFor so the two paths can't both submit
     * at once.
     */
    onsave(response: InputResponse): void {
      const view = this.playerViewTyped;
      if (view === undefined) {
        return;
      }
      const root = vueRoot(this);
      if (root.isServerSideRequestInProgress) {
        console.warn('Server request in progress');
        return;
      }
      root.isServerSideRequestInProgress = true;

      fetch(
        apiUrl(paths.PLAYER_INPUT) + '?id=' + view.id,
        {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify({runId: view.runId, ...response}),
        },
      )
        .then(async (httpResponse) => {
          if (httpResponse.ok) {
            const newPlayerView = await httpResponse.json() as PlayerViewModel;
            this.applyPlayerViewUpdate(newPlayerView);
            return;
          }
          if (httpResponse.status === statusCode.badRequest) {
            const resp = await httpResponse.json() as AppErrorResponse;
            let cb = () => { /* default no-op */ };
            if (resp.id === INVALID_RUN_ID) {
              cb = () => setTimeout(() => window.location.reload(), 100);
            }
            root.showAlert('Error with input', resp.message, cb);
          } else {
            root.showAlert(
              'Error processing response',
              'Unexpected response from server. Please try again.',
            );

            console.error(httpResponse.statusText);
          }
        })
        .catch((e) => {
          root.showAlert('Error sending input', CANNOT_CONTACT_SERVER);

          console.error(e);
        })
        .finally(() => {
          root.isServerSideRequestInProgress = false;
        });
    },
    /*
     * Same skip-remount logic WaitingFor uses on its own
     * updatePlayerView. When the new state keeps us inside the
     * card-pick window, swap playerView reactively without bumping
     * playerkey — preserving both this overlay AND the player-home
     * tree below it. Otherwise the normal remount fires, this
     * overlay's reactive computed re-evaluates, and the modal
     * hides (or swaps content) naturally.
     */
    applyPlayerViewUpdate(newPlayerView: PlayerViewModel): void {
      const root = vueRoot(this);
      // Prime the start-of-game setup reveal BEFORE committing (the initial-cards
      // submit lands the ceremony view here on desktop). Idempotent with the
      // poll / WaitingFor paths.
      primeStartSetupReveal(root.playerView, newPlayerView);
      // Structural sharing (viewSnapshotShare.ts): unchanged branches keep
      // their references (children skip re-render); root identity changes.
      const applied = nextViewSnapshot(root.playerView, newPlayerView);
      if (shouldPreserveCardPickModal(newPlayerView)) {
        root.playerView = applied;
      } else {
        root.playerView = applied;
        // Bump the transient-UI reset epoch (the former remount trigger).
        root.playerkey++;
      }
    },
  },
});
</script>

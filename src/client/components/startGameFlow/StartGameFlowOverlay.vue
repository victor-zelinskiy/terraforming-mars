<template>
  <!--
    Unified premium START-OF-GAME orchestration modal. Mounted at App level
    (next to DraftFlowOverlay) so the `:key="playerkey"` remount on every server
    response can't destroy it. Walks the player through generation 1's start
    sequence as ONE continuous flow: play their preludes one-by-one, apply the
    corporation's mandatory first action (if any), then a final "begin the game"
    confirmation. It REPLACES the bare prelude card-selection and the corp
    first-action OrOptions (which are suppressed in DraftFlowOverlay / WaitingFor
    while this flow is active).

    Visibility = startGameFlowActive(view). While a focused sub-action (board
    placement / colony pick / payment from a prelude or the corp effect) is the
    active prompt, the full card collapses to a thin pill so the dedicated
    surface (PlacementBanner / ColoniesOverlay / MandatoryInputModal) owns the
    viewport; the pill restores when the flow returns to a prelude/corp/waiting
    step.
  -->
  <Teleport to="body">
    <div v-if="showFull" class="start-game-flow" data-test="start-game-flow">
      <!-- Mandatory: backdrop never dismisses. -->
      <div class="start-game-flow__backdrop"></div>

      <div class="start-game-flow__card">
        <div class="start-game-flow__corner start-game-flow__corner--tl"></div>
        <div class="start-game-flow__corner start-game-flow__corner--tr"></div>
        <div class="start-game-flow__corner start-game-flow__corner--bl"></div>
        <div class="start-game-flow__corner start-game-flow__corner--br"></div>

        <!-- Header: title + progress chips -->
        <div class="start-game-flow__header">
          <div class="start-game-flow__heading">
            <span class="start-game-flow__heading-dot"></span>
            <h1 class="start-game-flow__title" v-i18n>Start of the game</h1>
          </div>
          <p class="start-game-flow__subtitle" v-i18n>Play your prelude cards and apply your corporation's start effect.</p>
          <div class="start-game-flow__progress">
            <span v-if="preludeTotal > 0" class="start-game-flow__chip">
              <span v-i18n>Preludes</span>: {{ preludePlayedCount }} / {{ preludeTotal }}
            </span>
            <span class="start-game-flow__chip" :class="'start-game-flow__chip--' + corpStatus">
              <span v-i18n>Corporation</span>: <span v-i18n>{{ corpStatusLabel }}</span>
            </span>
          </div>
        </div>

        <div class="start-game-flow__body">
          <!-- Corporation area -->
          <section v-if="corpName !== undefined" class="start-game-flow__corp">
            <div class="start-game-flow__section-label" v-i18n>Corporation</div>
            <div class="start-game-flow__corp-row">
              <div class="start-game-flow__card-thumb">
                <Card :card="{name: corpName}" />
              </div>
              <div class="start-game-flow__corp-meta">
                <div class="start-game-flow__corp-status"
                     :class="'start-game-flow__corp-status--' + corpStatus"
                     data-test="start-game-flow-corp-status">
                  <span v-i18n>{{ corpStatusLabel }}</span>
                </div>
                <button v-if="corpStatus === 'ready'"
                        class="start-game-flow__apply-btn"
                        @click="applyCorpEffect"
                        data-test="start-game-flow-apply">
                  <span v-i18n>Apply effect</span>
                </button>
              </div>
            </div>
          </section>

          <!-- Prelude area -->
          <section v-if="preludeTotal > 0" class="start-game-flow__preludes">
            <div class="start-game-flow__section-label" v-i18n>Preludes</div>
            <div class="start-game-flow__prelude-grid">
              <div v-for="(entry, i) in preludes"
                   :key="entry.name + '-' + i"
                   class="start-game-flow__prelude"
                   :class="'start-game-flow__prelude--' + entry.status"
                   :data-test="'start-game-flow-prelude-' + entry.status">
                <div class="start-game-flow__card-thumb">
                  <Card :card="{name: entry.name}" />
                  <span v-if="entry.status === 'played'" class="start-game-flow__played-check" aria-hidden="true">✓</span>
                </div>
                <div class="start-game-flow__prelude-status"
                     :class="'start-game-flow__prelude-status--' + entry.status">
                  <span v-i18n>{{ preludeStatusLabel(entry.status) }}</span>
                </div>
                <button v-if="entry.status === 'playable'"
                        class="start-game-flow__play-btn"
                        @click="playPrelude(entry.name)"
                        :data-test="'start-game-flow-play-' + entry.name">
                  <span v-i18n>Play now</span>
                </button>
              </div>
            </div>
          </section>

          <!-- Waiting-for-others state -->
          <section v-if="waitingState" class="start-game-flow__waiting" data-test="start-game-flow-waiting">
            <div class="start-game-flow__waiting-dots" aria-hidden="true">
              <span></span><span></span><span></span>
            </div>
            <p class="start-game-flow__waiting-text">{{ waitingText }}</p>
          </section>
        </div>

        <!-- Completion footer -->
        <div v-if="allDone" class="start-game-flow__footer">
          <div class="start-game-flow__done-note" v-i18n>Initial setup complete.</div>
          <button class="start-game-flow__begin-btn"
                  @click="beginGame"
                  data-test="start-game-flow-begin">
            <span v-i18n>Begin the game</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <!--
    Thin pill (own teleport / stacking context). Shown while the modal is
    minimized for a focused sub-action — reuses the shared mandatory-pill chrome
    so every awaiting-prompt pill looks identical. Click restores by completing
    the sub-action (it is informational here — the sub-action surface drives the
    actual input); we keep it click-through-free so the player notices the flow
    is still active.
  -->
  <Teleport to="body">
    <div v-if="showPill"
         class="mandatory-input-modal-pill mandatory-input-modal-pill--visible start-game-flow-pill"
         data-test="start-game-flow-pill">
      <span class="mandatory-input-modal-pill__dot"></span>
      <span class="mandatory-input-modal-pill__label" v-i18n>AWAITING DECISION</span>
      <span class="mandatory-input-modal-pill__sep">/</span>
      <span class="mandatory-input-modal-pill__title" v-i18n>Start of the game</span>
    </div>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {paths} from '@/common/app/paths';
import {statusCode} from '@/common/http/statusCode';
import {INVALID_RUN_ID, AppErrorResponse} from '@/common/app/AppErrorId';
import {translateText} from '@/client/directives/i18n';
import {vueRoot} from '@/client/components/vueRoot';
import Card from '@/client/components/card/Card.vue';
import {
  startGameFlowState,
  startGameFlowActive,
  startGameFlowEligible,
  startGameFlowAllDone,
  startFlowHasFocusedSubAction,
  startFlowCorpPrompt,
  corpActionOptionIndex,
  preludeEntries,
  corporationCardName,
  markStartFlowActivated,
  markStartFlowCompleted,
  PreludeEntry,
  PreludeStatus,
} from '@/client/components/startGameFlow/startGameFlowState';

const CANNOT_CONTACT_SERVER = 'Unable to reach the server. It may be restarting or down for maintenance.';

function isPlayerView(view: ViewModel | undefined): view is PlayerViewModel {
  return view !== undefined && (view as PlayerViewModel).thisPlayer !== undefined;
}

type DataModel = {
  // Latches true once we've seen the corp owe an initial action, so the "done"
  // state can read "effect applied" rather than "no start action".
  corpActionWasPending: boolean;
};

export default defineComponent({
  name: 'StartGameFlowOverlay',
  components: {Card},
  props: {
    playerView: {
      type: Object as PropType<ViewModel | undefined>,
      default: undefined,
    },
    // Live list of player colours the server is still waiting on (from App's
    // `/api/waitingFor` poll) — names the players we're waiting on.
    waitingOnPlayers: {
      type: Array as PropType<ReadonlyArray<Color>>,
      default: () => [],
    },
  },
  data(): DataModel {
    return {corpActionWasPending: false};
  },
  watch: {
    // Latch activation + derive the minimize state on every view change.
    playerViewTyped: {
      immediate: true,
      handler(view: PlayerViewModel | undefined): void {
        if (view === undefined) {
          return;
        }
        if (startGameFlowEligible(view)) {
          markStartFlowActivated(view.id);
        }
        if (view.pendingInitialActions.length > 0 || startFlowCorpPrompt(view) !== undefined) {
          this.corpActionWasPending = true;
        }
        startGameFlowState.minimized = startFlowHasFocusedSubAction(view);
      },
    },
  },
  computed: {
    playerViewTyped(): PlayerViewModel | undefined {
      return isPlayerView(this.playerView) ? this.playerView : undefined;
    },
    active(): boolean {
      return startGameFlowActive(this.playerViewTyped);
    },
    showFull(): boolean {
      return this.active && this.playerViewTyped !== undefined && !startGameFlowState.minimized;
    },
    showPill(): boolean {
      return this.active && this.playerViewTyped !== undefined && startGameFlowState.minimized;
    },
    corpName(): CardName | undefined {
      const view = this.playerViewTyped;
      return view === undefined ? undefined : corporationCardName(view);
    },
    preludes(): ReadonlyArray<PreludeEntry> {
      const view = this.playerViewTyped;
      return view === undefined ? [] : preludeEntries(view);
    },
    preludeTotal(): number {
      return this.preludes.length;
    },
    preludePlayedCount(): number {
      return this.preludes.filter((p) => p.status === 'played').length;
    },
    // 'ready'   — corp prompt is live → show ПРИМЕНИТЬ ЭФФЕКТ.
    // 'pending' — corp owes an action but not promptable yet (preludes / waiting).
    // 'done'    — no action owed: applied earlier, or never had one.
    corpStatus(): 'ready' | 'pending' | 'done' {
      const view = this.playerViewTyped;
      if (view === undefined) {
        return 'done';
      }
      if (startFlowCorpPrompt(view) !== undefined) {
        return 'ready';
      }
      if (view.pendingInitialActions.length > 0) {
        return 'pending';
      }
      return 'done';
    },
    corpStatusLabel(): string {
      if (this.corpStatus === 'ready') {
        return 'Start effect ready';
      }
      if (this.corpStatus === 'pending') {
        return 'Start effect awaiting';
      }
      return this.corpActionWasPending ? 'Effect applied' : 'No start action';
    },
    allDone(): boolean {
      const view = this.playerViewTyped;
      return view !== undefined && startGameFlowAllDone(view);
    },
    // Server is processing / waiting on other players: no prompt for us, but the
    // flow isn't finished (otherwise we'd show the begin-game footer).
    waitingState(): boolean {
      const view = this.playerViewTyped;
      if (view === undefined) {
        return false;
      }
      return view.waitingFor === undefined && !this.allDone;
    },
    waitingText(): string {
      const view = this.playerViewTyped;
      if (view === undefined) {
        return translateText('Waiting for other players');
      }
      const me = view.thisPlayer.color;
      const names = this.waitingOnPlayers
        .filter((color: Color) => color !== me)
        .map((color: Color) => view.players.find((p) => p.color === color)?.name)
        .filter((n): n is string => typeof n === 'string' && n.length > 0);
      if (names.length === 0) {
        return translateText('Waiting for other players');
      }
      // Neutral phrasing — the awaited player may be playing preludes OR taking
      // their first turn; don't claim they're "playing prelude cards".
      return translateText('Waiting for: ${0}').replace('${0}', names.join(', '));
    },
  },
  methods: {
    preludeStatusLabel(status: PreludeStatus): string {
      if (status === 'played') {
        return 'Played';
      }
      if (status === 'playable') {
        return 'Ready to play';
      }
      return 'Awaiting';
    },
    playPrelude(name: CardName): void {
      this.onsave({type: 'card', cards: [name]});
    },
    applyCorpEffect(): void {
      const view = this.playerViewTyped;
      if (view === undefined) {
        return;
      }
      const prompt = startFlowCorpPrompt(view);
      const index = corpActionOptionIndex(prompt);
      if (index === -1) {
        return;
      }
      this.onsave({type: 'or', index, response: {type: 'option'}});
    },
    beginGame(): void {
      // No server round-trip — the action menu ('Take your first action') is
      // already active underneath; we just stop covering it. Keyed by THIS
      // player's id so it never affects another player viewed in the same client.
      const view = this.playerViewTyped;
      if (view !== undefined) {
        markStartFlowCompleted(view.id);
      }
    },
    /*
     * App-level submit, mirroring DraftFlowOverlay.onsave. Shares
     * root.isServerSideRequestInProgress so it can't race WaitingFor's POST.
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
        paths.PLAYER_INPUT + '?id=' + view.id,
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
     * Always a full remount (start-flow submits land in PRELUDES / ACTION, not
     * a card-pick phase). This overlay is an App-level sibling of <player-home>,
     * so the playerkey++ remount refreshes the board beneath us without
     * destroying this flow.
     */
    applyPlayerViewUpdate(newPlayerView: PlayerViewModel): void {
      const root = vueRoot(this);
      root.screen = 'empty';
      root.playerView = newPlayerView;
      root.playerkey++;
      root.screen = 'player-home';
      if (newPlayerView.game.phase === 'end' && window.location.pathname !== paths.THE_END) {
        window.location = window.location as any as (string & Location);
      }
    },
  },
});
</script>

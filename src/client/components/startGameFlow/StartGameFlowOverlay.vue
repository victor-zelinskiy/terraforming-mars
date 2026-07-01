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
    <div v-if="showFull" class="start-game-flow" :style="layoutStyle" data-test="start-game-flow">
      <!-- Mandatory: backdrop never dismisses. -->
      <div class="start-game-flow__backdrop"></div>

      <div class="start-game-flow__card">
        <div class="start-game-flow__corner start-game-flow__corner--tl"></div>
        <div class="start-game-flow__corner start-game-flow__corner--tr"></div>
        <div class="start-game-flow__corner start-game-flow__corner--bl"></div>
        <div class="start-game-flow__corner start-game-flow__corner--br"></div>

        <!--
          Manual minimize — same affordance as MandatoryInputModal (↗ СВЕРНУТЬ).
          Collapses to the shared pill so the player can inspect the board /
          their resource counters (and the delta-chips from the effects they
          just applied) before continuing. The pill restores it.
        -->
        <button class="start-game-flow__minimize-btn"
                @click="userMinimized = true"
                :title="$t('Minimize — look at the board')"
                data-test="start-game-flow-minimize">
          <span class="start-game-flow__minimize-glyph">↗</span>
          <span class="start-game-flow__minimize-label" v-i18n>Minimize</span>
        </button>

        <!-- Header: hero title + subtitle (left) · progress chips (right) -->
        <div class="start-game-flow__header">
          <div class="start-game-flow__header-lead">
            <div class="start-game-flow__heading">
              <span class="start-game-flow__heading-dot"></span>
              <h1 class="start-game-flow__title" v-i18n>Start of the game</h1>
            </div>
            <p class="start-game-flow__subtitle" v-i18n>Play your prelude cards and apply your corporation's start effect.</p>
          </div>
          <div class="start-game-flow__header-side">
            <div class="start-game-flow__progress">
              <span v-if="preludeTotal > 0"
                    class="start-game-flow__chip start-game-flow__chip--prelude"
                    :class="'start-game-flow__chip--' + preludeChipState">
                <span class="start-game-flow__chip-dot"></span>
                <span class="start-game-flow__chip-label" v-i18n>Preludes</span>
                <span class="start-game-flow__chip-value">{{ preludePlayedCount }} / {{ preludeTotal }}</span>
              </span>
              <span class="start-game-flow__chip start-game-flow__chip--corp"
                    :class="'start-game-flow__chip--' + corpStatus">
                <span class="start-game-flow__chip-dot"></span>
                <span class="start-game-flow__chip-label" v-i18n>Corporation</span>
                <span class="start-game-flow__chip-value" v-i18n>{{ corpStatusLabel }}</span>
              </span>
            </div>

            <div class="start-game-flow__header-status">
              <div v-if="waitingState"
                   class="start-game-flow__waiting start-game-flow__waiting--header"
                   data-test="start-game-flow-waiting">
                <div class="start-game-flow__waiting-loader" aria-hidden="true">
                  <span class="start-game-flow__waiting-ring"></span>
                  <div class="start-game-flow__waiting-dots">
                    <span></span><span></span><span></span>
                  </div>
                </div>
                <div class="start-game-flow__waiting-copy">
                  <p class="start-game-flow__waiting-text" v-i18n>Waiting for other players</p>
                  <div v-if="waitingPlayers.length > 0" class="start-game-flow__waiting-players">
                    <span v-for="p in waitingPlayers"
                          :key="p.color"
                          class="start-game-flow__waiting-chip">
                      <span class="start-game-flow__waiting-chip-dot"
                            :class="'player_bg_color_' + p.color"></span>
                      <span class="start-game-flow__waiting-chip-name">{{ p.name }}</span>
                    </span>
                  </div>
                </div>
              </div>

              <div v-else-if="allDone" class="start-game-flow__footer start-game-flow__footer--header">
                <div class="start-game-flow__done-badge" aria-hidden="true">✓</div>
                <div class="start-game-flow__done-note" v-i18n>Initial setup complete.</div>
                <button class="start-game-flow__begin-btn"
                        @click="beginGame"
                        data-test="start-game-flow-begin">
                  <span class="start-game-flow__begin-label" v-i18n>Begin the game</span>
                </button>
              </div>

              <div v-else class="start-game-flow__header-status-reserve" aria-hidden="true"></div>
            </div>
          </div>
        </div>

        <div class="start-game-flow__body">
          <!--
            Corporation area — one column PER corporation (base corp + any
            merged corp from Merger), side by side. Each corp's status + its
            ПРИМЕНИТЬ ЭФФЕКТ button sit UNDER the card (so a second corp has room
            to its right).
          -->
          <section v-if="corpCards.length > 0"
                   class="start-game-flow__corp"
                   :class="{'start-game-flow__corp--reserve-merger': mergerReserveActive}">
            <div class="start-game-flow__section-label" v-i18n>Corporation</div>
            <div class="start-game-flow__corp-grid">
              <div v-for="corp in corpCards"
                   :key="corp.name"
                   class="start-game-flow__corp-item"
                   :data-test="'start-game-flow-corp-' + corp.name">
                <div class="start-game-flow__card-thumb"
                     :class="{
                       'start-game-flow__card-thumb--ready': corp.status === 'ready',
                       'start-game-flow__card-thumb--applied': corp.status === 'done' && corpHadAction(corp.name),
                     }">
                  <Card :card="{name: corp.name}" />
                  <span v-if="corp.status === 'done' && corpHadAction(corp.name)"
                        class="start-game-flow__played-check start-game-flow__played-check--corp"
                        aria-hidden="true">✓</span>
                </div>
                <div v-if="corpStatusLabelFor(corp) !== ''"
                     class="start-game-flow__corp-status"
                     :class="'start-game-flow__corp-status--' + corp.status">
                  <span class="start-game-flow__corp-status-dot"></span>
                  <span v-i18n>{{ corpStatusLabelFor(corp) }}</span>
                </div>
                <div v-else class="start-game-flow__corp-status-reserve" aria-hidden="true"></div>
                <button v-if="corp.status === 'ready'"
                        class="start-game-flow__apply-btn"
                        @click="applyCorpEffect(corp.name)"
                        :data-test="'start-game-flow-apply-' + corp.name">
                  <span v-i18n>Apply effect</span>
                </button>
                <div v-else class="start-game-flow__action-reserve" aria-hidden="true"></div>
              </div>
              <div v-if="mergerReserveActive && corpCards.length < 2"
                   class="start-game-flow__corp-item start-game-flow__corp-item--reserved"
                   aria-hidden="true">
                <div class="start-game-flow__corp-reserved-card"></div>
                <div class="start-game-flow__corp-status-reserve"></div>
                <div class="start-game-flow__action-reserve"></div>
              </div>
            </div>
          </section>

          <!--
            Merger ('MERGER') — choose ONE additional corporation to merge. The
            chosen corp joins the corporation area above; unaffordable corps are
            shown disabled with a hint. (Payment of 42 M€ follows as a normal
            sub-action via MandatoryInputModal.)
          -->
          <section v-if="corpSelectCandidates.length > 0"
                   class="start-game-flow__corp-select"
                   data-test="start-game-flow-corp-select">
            <div class="start-game-flow__section-label" v-i18n>Choose a corporation</div>
            <div class="start-game-flow__prelude-grid">
              <div v-for="cand in corpSelectCandidates"
                   :key="cand.name"
                   class="start-game-flow__prelude"
                   :class="cand.disabled ? 'start-game-flow__prelude--discarded' : 'start-game-flow__prelude--playable'">
                <div class="start-game-flow__card-thumb">
                  <Card :card="{name: cand.name}" />
                </div>
                <button v-if="!cand.disabled"
                        class="start-game-flow__play-btn"
                        @click="selectMergerCorp(cand.name)"
                        :data-test="'start-game-flow-corp-select-' + cand.name">
                  <span v-i18n>Select</span>
                </button>
                <div v-else
                     class="start-game-flow__blocked-note"
                     :data-test="'start-game-flow-corp-disabled-' + cand.name">
                  <span v-i18n>Not enough M€</span>
                </div>
              </div>
            </div>
          </section>

          <!-- Prelude area -->
          <section v-if="preludeTotal > 0" class="start-game-flow__preludes">
            <div class="start-game-flow__section-label" v-i18n>Preludes</div>
            <div class="start-game-flow__prelude-grid">
              <div v-for="entry in preludes"
                   :key="entry.name"
                   class="start-game-flow__prelude"
                   :class="'start-game-flow__prelude--' + entry.status"
                   :data-test="'start-game-flow-prelude-' + entry.status">
                <div class="start-game-flow__card-thumb"
                     @click.capture.stop="openZoom(entry.name)">
                  <Card :card="{name: entry.name}" />
                  <span v-if="entry.status === 'played'" class="start-game-flow__played-check" aria-hidden="true">✓</span>
                </div>
                <div class="start-game-flow__prelude-status"
                     :class="'start-game-flow__prelude-status--' + entry.status">
                  <span v-i18n>{{ preludeStatusLabel(entry.status) }}</span>
                </div>
                <button v-if="entry.status === 'playable' && !entry.blocked"
                        class="start-game-flow__play-btn"
                        @click="playPrelude(entry.name)"
                        :data-test="'start-game-flow-play-' + entry.name">
                  <span v-i18n>Play now</span>
                </button>
                <!--
                  Would FIZZLE right now (e.g. Double Down before any other
                  prelude is played — nothing to copy). РАЗЫГРАТЬ is withheld
                  with a clear hint so the player plays a productive prelude
                  first instead of wasting this one for 15 M€.
                -->
                <div v-else-if="entry.blocked"
                     class="start-game-flow__blocked-note"
                     :data-test="'start-game-flow-blocked-' + entry.name">
                  <span v-i18n>Play another prelude first</span>
                </div>
                <div v-else class="start-game-flow__action-reserve" aria-hidden="true"></div>
              </div>
            </div>
          </section>

          <!--
            Drew-N-choose-ONE prelude block (New Partner prelude / Valley Trust
            corp action). Separate from the starting-prelude grid. While the
            prompt is live the player picks one; after the pick the chosen shows
            РАЗЫГРАНА and the rest СБРОШЕНА (discarded) for maximum clarity.
          -->
          <section v-if="drawCandidates.length > 0 || resolvedDrawChoices.length > 0"
                   class="start-game-flow__draw"
                   data-test="start-game-flow-draw">
            <div class="start-game-flow__section-label" v-i18n>Choose one prelude to play</div>

            <!-- Active choice: РАЗЫГРАТЬ on each candidate. -->
            <div v-if="drawCandidates.length > 0" class="start-game-flow__prelude-grid">
              <div v-for="(name, i) in drawCandidates"
                   :key="'draw-' + name + '-' + i"
                   class="start-game-flow__prelude start-game-flow__prelude--playable">
                <div class="start-game-flow__card-thumb"
                     @click.capture.stop="openZoom(name)">
                  <Card :card="{name}" />
                </div>
                <button class="start-game-flow__play-btn"
                        @click="playDrawPrelude(name)"
                        :data-test="'start-game-flow-draw-play-' + name">
                  <span v-i18n>Play now</span>
                </button>
              </div>
            </div>

            <!-- Resolved: chosen РАЗЫГРАНА / others СБРОШЕНА. -->
            <div v-for="(rec, ri) in resolvedDrawChoices"
                 :key="'rec-' + ri"
                 class="start-game-flow__prelude-grid">
              <div v-for="(name, ci) in rec.candidates"
                   :key="'recc-' + name + '-' + ci"
                   class="start-game-flow__prelude"
                   :class="name === rec.chosen ? 'start-game-flow__prelude--played' : 'start-game-flow__prelude--discarded'"
                   :data-test="name === rec.chosen ? 'start-game-flow-draw-played' : 'start-game-flow-draw-discarded'">
                <div class="start-game-flow__card-thumb"
                     @click.capture.stop="openZoom(name)">
                  <Card :card="{name}" />
                  <span v-if="name === rec.chosen" class="start-game-flow__played-check" aria-hidden="true">✓</span>
                  <span v-else class="start-game-flow__discard-mark" aria-hidden="true">✕</span>
                </div>
                <div class="start-game-flow__prelude-status"
                     :class="name === rec.chosen ? 'start-game-flow__prelude-status--played' : 'start-game-flow__prelude-status--discarded'">
                  <span v-i18n>{{ name === rec.chosen ? 'Played' : 'Discarded' }}</span>
                </div>
                <div class="start-game-flow__action-reserve" aria-hidden="true"></div>
              </div>
            </div>
          </section>

          <!--
            Double Down ('УДВОЕНИЕ') — pick one ALREADY-PLAYED prelude to copy.
            The source stays in the grid above (it's a played prelude); this is
            just the actionable picker. Nothing is drawn or discarded, so there
            is no РАЗЫГРАНА/СБРОШЕНА resolution and no grid exclusion.
          -->
          <section v-if="copyCandidates.length > 0"
                   class="start-game-flow__draw start-game-flow__copy"
                   data-test="start-game-flow-copy">
            <div class="start-game-flow__section-label" v-i18n>Choose a prelude to copy</div>
            <div class="start-game-flow__prelude-grid">
              <div v-for="(name, i) in copyCandidates"
                   :key="'copy-' + name + '-' + i"
                   class="start-game-flow__prelude start-game-flow__prelude--playable">
                <div class="start-game-flow__card-thumb"
                     @click.capture.stop="openZoom(name)">
                  <Card :card="{name}" />
                </div>
                <button class="start-game-flow__play-btn"
                        @click="playCopyPrelude(name)"
                        :data-test="'start-game-flow-copy-play-' + name">
                  <span v-i18n>Copy</span>
                </button>
              </div>
            </div>
          </section>

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
         role="button"
         tabindex="0"
         :title="$t('Click to expand the awaiting prompt')"
         @click="restoreFromPill"
         @keydown.enter="restoreFromPill"
         @keydown.space.prevent="restoreFromPill"
         data-test="start-game-flow-pill">
      <span class="mandatory-input-modal-pill__dot"></span>
      <span class="mandatory-input-modal-pill__label" v-i18n>AWAITING DECISION</span>
      <span class="mandatory-input-modal-pill__sep">/</span>
      <span class="mandatory-input-modal-pill__title" v-i18n>Start of the game</span>
      <span class="mandatory-input-modal-pill__restore" :title="$t('Restore')">⤢</span>
    </div>
  </Teleport>

  <!--
    Fullscreen prelude viewer. Single-click on any prelude card opens it here
    (the card's own built-in zoom is suppressed by @click.capture.stop on the
    thumb). Playable preludes (a playable starting prelude OR a drew-N-choose
    candidate) get a РАЗЫГРАТЬ in the #actions slot so the player can play
    straight from fullscreen; ← / → navigate across the shown preludes.
  -->
  <Teleport to="body">
    <CardZoomModal v-if="zoomCard !== undefined"
                   ref="zoomModal"
                   :card="zoomCard"
                   :cards="zoomNavCards"
                   @navigate="zoomCard = $event"
                   @close="zoomCard = undefined">
      <template #actions>
        <button v-if="zoomPlayable"
                type="button"
                class="card-zoom-actions__btn card-zoom-actions__btn--primary start-game-flow__zoom-play"
                @click="playZoom"
                data-test="start-game-flow-zoom-play">
          <span v-i18n>Play now</span>
        </button>
      </template>
    </CardZoomModal>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent, PropType, nextTick} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {Color} from '@/common/Color';
import {PlayerViewModel, ViewModel} from '@/common/models/PlayerModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {paths} from '@/common/app/paths';
import {statusCode} from '@/common/http/statusCode';
import {INVALID_RUN_ID, AppErrorResponse} from '@/common/app/AppErrorId';
import {vueRoot} from '@/client/components/vueRoot';
import {apiUrl} from '@/client/utils/runtimeConfig';
import Card from '@/client/components/card/Card.vue';
import CardZoomModal from '@/client/components/card/CardZoomModal.vue';
import {
  startGameFlowState,
  startGameFlowActive,
  startGameFlowEligible,
  startGameFlowAllDone,
  startFlowHasFocusedSubAction,
  startFlowCorpPrompt,
  startFlowCorpSelectPrompt,
  startFlowPreludeDrawPrompt,
  startFlowPreludeCopyPrompt,
  corpActionOptionIndexFor,
  corporationCardNames,
  corpStatusFor,
  preludeEntries,
  markStartFlowActivated,
  markStartFlowCompleted,
  recordDrawChoice,
  drawChoicesFor,
  PreludeEntry,
  PreludeStatus,
  CorpStatus,
  DrawChoiceRecord,
} from '@/client/components/startGameFlow/startGameFlowState';
import {
  startGameFlowLayoutBudget,
} from '@/client/components/startGameFlow/startGameFlowLayout';
import type {StartGameFlowLayoutBudget} from '@/client/components/startGameFlow/startGameFlowLayout';

const CANNOT_CONTACT_SERVER = 'Unable to reach the server. It may be restarting or down for maintenance.';

function isPlayerView(view: ViewModel | undefined): view is PlayerViewModel {
  return view !== undefined && (view as PlayerViewModel).thisPlayer !== undefined;
}

type DataModel = {
  // Corp names we've seen owe an initial action, so a 'done' corp reads "effect
  // applied" rather than nothing (per-corp — a Merger can give two corps each
  // with an effect).
  corpsThatHadAction: Array<CardName>;
  // Player pressed ↗ СВЕРНУТЬ — collapse to the pill (distinct from the
  // automatic sub-action minimize). Reset when the actionable step changes.
  userMinimized: boolean;
  // Signature of the current actionable step; userMinimized resets when it
  // changes so a NEW step always un-minimizes (mirrors MandatoryInputModal).
  lastStepSignature: string;
  // The prelude currently open in the fullscreen viewer (undefined = closed).
  zoomCard: CardModel | undefined;
  viewportWidth: number;
  viewportHeight: number;
};

export default defineComponent({
  name: 'StartGameFlowOverlay',
  components: {Card, CardZoomModal},
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
    return {
      corpsThatHadAction: [],
      userMinimized: false,
      lastStepSignature: '',
      zoomCard: undefined,
      viewportWidth: typeof window === 'undefined' ? 1280 : window.innerWidth,
      viewportHeight: typeof window === 'undefined' ? 860 : window.innerHeight,
    };
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
        // Remember every corp that owed an action (so a later 'done' reads
        // "effect applied"). Per-corp, since Merger can add a second such corp.
        for (const name of view.pendingInitialActions ?? []) {
          if (!this.corpsThatHadAction.includes(name)) {
            this.corpsThatHadAction.push(name);
          }
        }
        startGameFlowState.minimized = startFlowHasFocusedSubAction(view);
        // A NEW actionable step un-minimizes the manual collapse so the player
        // never misses it (same behaviour as MandatoryInputModal).
        const sig = this.stepSignature(view);
        if (sig !== this.lastStepSignature) {
          this.lastStepSignature = sig;
          this.userMinimized = false;
        }
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
    // Collapsed either automatically (a focused sub-action owns the screen) OR
    // manually (player pressed ↗ СВЕРНУТЬ).
    collapsed(): boolean {
      return startGameFlowState.minimized || this.userMinimized;
    },
    showFull(): boolean {
      return this.active && this.playerViewTyped !== undefined && !this.collapsed;
    },
    showPill(): boolean {
      return this.active && this.playerViewTyped !== undefined && this.collapsed;
    },
    layoutStyle(): Record<string, string> {
      const budget = this.layoutBudget;
      return {
        '--sgf-prelude-zoom': budget.preludeZoom.toFixed(2),
        '--sgf-corp-zoom': budget.corporationZoom.toFixed(2),
        '--sgf-grid-gap-x': budget.gridGapX + 'px',
        '--sgf-grid-gap-y': budget.gridGapY + 'px',
        '--sgf-window-w': budget.windowWidth + 'px',
        '--sgf-window-min-h': budget.windowMinHeight + 'px',
        '--sgf-body-min-h': budget.bodyMinHeight + 'px',
        '--sgf-header-status-w': budget.headerStatusWidth + 'px',
        '--sgf-header-status-h': budget.headerStatusHeight + 'px',
        '--sgf-main-gap-x': budget.mainGapX + 'px',
        '--sgf-main-gap-y': budget.mainGapY + 'px',
        '--sgf-corp-column-w': budget.corporationColumnWidth + 'px',
        '--sgf-prelude-column-w': budget.preludeColumnWidth + 'px',
        '--sgf-modal-offset-y': budget.modalOffsetY + 'px',
      };
    },
    layoutBudget(): StartGameFlowLayoutBudget {
      return startGameFlowLayoutBudget({
        preludeCount: this.preludes.length,
        corporationCount: this.corpCards.length,
        mergerReserveActive: this.mergerReserveActive,
        extraCardReserveActive: this.extraCardReserveActive,
        corporationSelectCount: this.corpSelectCandidates.length,
        drawCandidateCount: this.drawCandidates.length,
        resolvedDrawCounts: this.resolvedDrawChoices.map((rec) => rec.candidates.length),
        copyCandidateCount: this.copyCandidates.length,
        waiting: this.waitingState,
        allDone: this.allDone,
        viewportWidth: this.viewportWidth,
        viewportHeight: this.viewportHeight,
      });
    },
    // Candidates of the live drew-N-choose-ONE prompt (empty otherwise).
    drawCandidates(): ReadonlyArray<CardName> {
      const view = this.playerViewTyped;
      if (view === undefined) {
        return [];
      }
      const prompt = startFlowPreludeDrawPrompt(view);
      return prompt === undefined ? [] : prompt.cards.map((c) => c.name);
    },
    // Resolved draw-choices for this player (chosen РАЗЫГРАНА / others СБРОШЕНА).
    resolvedDrawChoices(): ReadonlyArray<DrawChoiceRecord> {
      const view = this.playerViewTyped;
      return view === undefined ? [] : drawChoicesFor(view.id);
    },
    // Candidates of the live "pick a played prelude to copy" prompt (Double Down).
    // These are ALREADY-PLAYED preludes — they stay in the grid, nothing is
    // discarded, so they're NOT recorded as draw-choices.
    copyCandidates(): ReadonlyArray<CardName> {
      const view = this.playerViewTyped;
      if (view === undefined) {
        return [];
      }
      const prompt = startFlowPreludeCopyPrompt(view);
      return prompt === undefined ? [] : prompt.cards.map((c) => c.name);
    },
    // Names the player can PLAY right now (a playable starting prelude OR a live
    // draw / copy candidate) — gates the РАЗЫГРАТЬ in the fullscreen viewer.
    playableZoomNames(): ReadonlySet<CardName> {
      const s = new Set<CardName>();
      for (const e of this.preludes) {
        if (e.status === 'playable' && !e.blocked) {
          s.add(e.name);
        }
      }
      for (const n of this.drawCandidates) {
        s.add(n);
      }
      for (const n of this.copyCandidates) {
        s.add(n);
      }
      return s;
    },
    zoomPlayable(): boolean {
      return this.zoomCard !== undefined && this.playableZoomNames.has(this.zoomCard.name);
    },
    // Every prelude card on display, in order — the fullscreen ← / → walks this.
    zoomNavCards(): ReadonlyArray<CardModel> {
      const names: Array<CardName> = [];
      for (const e of this.preludes) {
        names.push(e.name);
      }
      for (const n of this.drawCandidates) {
        names.push(n);
      }
      for (const n of this.copyCandidates) {
        names.push(n);
      }
      for (const rec of this.resolvedDrawChoices) {
        for (const n of rec.candidates) {
          names.push(n);
        }
      }
      return [...new Set(names)].map((name) => ({name}));
    },
    // Every corporation the player has (base + any merged from Merger), each
    // with its own start-effect status — drives the per-corp columns.
    corpCards(): ReadonlyArray<{name: CardName, status: CorpStatus}> {
      const view = this.playerViewTyped;
      if (view === undefined) {
        return [];
      }
      return corporationCardNames(view).map((name) => ({name, status: corpStatusFor(view, name)}));
    },
    // Merger's 'choose a corporation' candidates (disabled = unaffordable).
    corpSelectCandidates(): ReadonlyArray<{name: CardName, disabled: boolean}> {
      const view = this.playerViewTyped;
      if (view === undefined) {
        return [];
      }
      const prompt = startFlowCorpSelectPrompt(view);
      return (prompt?.cards ?? []).map((c) => ({name: c.name, disabled: c.isDisabled === true}));
    },
    mergerReserveActive(): boolean {
      return this.corpCards.length > 1 ||
        this.corpSelectCandidates.length > 0 ||
        this.preludes.some((entry) => entry.name === CardName.MERGER);
    },
    extraCardReserveActive(): boolean {
      return this.preludes.some((entry) =>
        entry.name === CardName.MERGER ||
        entry.name === CardName.NEW_PARTNER ||
        entry.name === CardName.VALLEY_TRUST ||
        entry.name === CardName.DOUBLE_DOWN,
      );
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
    // Aggregate corp status for the HEADER chip: ready if any corp is ready,
    // else pending if any is pending, else done.
    corpStatus(): CorpStatus {
      const cards = this.corpCards;
      if (cards.some((c) => c.status === 'ready')) {
        return 'ready';
      }
      if (cards.some((c) => c.status === 'pending')) {
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
      return 'Ready';
    },
    // Header prelude-chip state: 'complete' (cool-green, closed) once every
    // prelude is played, else 'neutral' (steel, in-progress).
    preludeChipState(): string {
      return this.preludeTotal > 0 && this.preludePlayedCount === this.preludeTotal ? 'complete' : 'neutral';
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
    // The specific players we're still waiting on, with their seat colour — drives
    // the waiting-state chips (colour dot + name). The calm "Waiting for other
    // players" label always shows above them, so an empty list is fine.
    waitingPlayers(): ReadonlyArray<{name: string, color: Color}> {
      const view = this.playerViewTyped;
      if (view === undefined) {
        return [];
      }
      const me = view.thisPlayer.color;
      const out: Array<{name: string, color: Color}> = [];
      for (const color of this.waitingOnPlayers) {
        if (color === me) {
          continue;
        }
        const p = view.players.find((pp) => pp.color === color);
        if (p !== undefined && typeof p.name === 'string' && p.name.length > 0) {
          out.push({name: p.name, color});
        }
      }
      return out;
    },
  },
  mounted(): void {
    window.addEventListener('resize', this.onResize);
  },
  beforeUnmount(): void {
    window.removeEventListener('resize', this.onResize);
  },
  methods: {
    onResize(): void {
      this.viewportWidth = window.innerWidth;
      this.viewportHeight = window.innerHeight;
    },
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
    // A drew-N-choose-ONE pick: remember the full candidate set + the choice
    // (the server discards the rest immediately, so this is our only chance to
    // capture it for the РАЗЫГРАНА / СБРОШЕНА display), then submit the choice.
    playDrawPrelude(name: CardName): void {
      const view = this.playerViewTyped;
      if (view === undefined) {
        return;
      }
      const prompt = startFlowPreludeDrawPrompt(view);
      if (prompt === undefined) {
        return;
      }
      recordDrawChoice(view.id, prompt.cards.map((c) => c.name), name);
      this.onsave({type: 'card', cards: [name]});
    },
    // A Double Down copy-source pick: just submit the chosen prelude. NO
    // recordDrawChoice — the source is an already-played prelude that must stay
    // in the grid, and nothing is discarded.
    playCopyPrelude(name: CardName): void {
      this.onsave({type: 'card', cards: [name]});
    },
    // Open a prelude in the fullscreen viewer (suppressing the card's own zoom).
    openZoom(name: CardName): void {
      this.zoomCard = {name};
      nextTick(() => {
        (this.$refs.zoomModal as {show?: () => void} | undefined)?.show?.();
      });
    },
    // Dispatch a play to the right path: a live draw candidate goes through the
    // draw-choice recorder; a copy candidate (Double Down) submits without
    // recording; a starting prelude through the normal play.
    playByName(name: CardName): void {
      if (this.drawCandidates.includes(name)) {
        this.playDrawPrelude(name);
      } else if (this.copyCandidates.includes(name)) {
        this.playCopyPrelude(name);
      } else {
        this.playPrelude(name);
      }
    },
    // РАЗЫГРАТЬ from fullscreen — close the viewer, then submit the current card.
    playZoom(): void {
      const card = this.zoomCard;
      if (card === undefined) {
        return;
      }
      (this.$refs.zoomModal as {close?: () => void} | undefined)?.close?.();
      this.zoomCard = undefined;
      this.playByName(card.name);
    },
    // Pill click: clear the MANUAL minimize only. If we're auto-minimized for a
    // focused sub-action, `startGameFlowState.minimized` stays true so the pill
    // remains (the sub-action surface still owns the screen).
    restoreFromPill(): void {
      this.userMinimized = false;
    },
    // Identifies the current actionable step so a NEW step can reset the manual
    // minimize. Marker-/state-based, never title-based.
    stepSignature(view: PlayerViewModel): string {
      const wf = view.waitingFor === undefined ? 'wait' : view.waitingFor.type;
      const corp = startFlowCorpPrompt(view) !== undefined ? 'c' : '';
      const corpSel = startFlowCorpSelectPrompt(view) !== undefined ? 's' : '';
      const draw = startFlowPreludeDrawPrompt(view) !== undefined ? 'd' : '';
      const done = startGameFlowAllDone(view) ? 'done' : '';
      return [wf, corp, corpSel, draw, done].join('|');
    },
    // Per-corp status label for the corp columns. Empty for a 'done' corp that
    // never owed an action (e.g. most base corps) — that column shows just the
    // card with no status line.
    corpStatusLabelFor(corp: {name: CardName, status: CorpStatus}): string {
      if (corp.status === 'ready') {
        return 'Start effect ready';
      }
      if (corp.status === 'pending') {
        return 'Start effect awaiting';
      }
      return this.corpsThatHadAction.includes(corp.name) ? 'Effect applied' : '';
    },
    // Whether this corp ever owed a start action (so a 'done' corp shows the
    // green "applied" check + badge, mirroring a played prelude). A base corp
    // with no start action stays badge-less.
    corpHadAction(name: CardName): boolean {
      return this.corpsThatHadAction.includes(name);
    },
    // Apply a SPECIFIC corp's first action — submit the corp OrOptions option
    // matching that corp (by CARD token, never Pass). Handles the multi-corp
    // (Merger) case where the OrOptions offers more than one corp.
    applyCorpEffect(corpName: CardName): void {
      const view = this.playerViewTyped;
      if (view === undefined) {
        return;
      }
      const index = corpActionOptionIndexFor(startFlowCorpPrompt(view), corpName);
      if (index === -1) {
        return;
      }
      this.onsave({type: 'or', index, response: {type: 'option'}});
    },
    // Merger: pick one of the dealt corporations to merge into the tableau.
    selectMergerCorp(name: CardName): void {
      this.onsave({type: 'card', cards: [name]});
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
    },
  },
});
</script>

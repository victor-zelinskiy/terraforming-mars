<template>
  <!--
    Modern sci-fi colonies overlay. Replaces the legacy in-page "Colonies"
    block (player_home_block--colonies) and the legacy SelectColony radio
    UI for the build-colony / trade-with-a-colony flows.

    Teleport to body so the overlay escapes every #player-home clip-path
    / overflow / transform context (same trick MandatoryInputModal uses).
    Backdrop dims the rest of the UI; clicking it closes the overlay
    UNLESS the overlay is mounted in response to a mandatory server prompt
    (build mode after Standard Project — the player MUST pick a colony).
    Trade mode and view mode allow backdrop / × dismissal.

    Layout is a grid of ColonyTile cards arranged around a central prompt.
    A "free fleets" panel sits below the prompt so the player can see at a
    glance whose ships are still available. We never scroll — colonies
    that don't fit are scaled down via CSS clamp.
  -->
  <Teleport to="body">
    <div :class="rootClass">
      <!--
        Backdrop owns the outside-click. In dismissable modes (trade /
        view) any click that lands on the backdrop closes the overlay;
        in build mode (mandatory server prompt) it's a no-op. When
        minimized, the backdrop becomes click-through so the player can
        interact with the board / panels while the prompt waits.
      -->
      <div class="colonies-overlay__backdrop"
           @click.self="onBackdropClick"></div>

      <!--
        Centred content column — wraps the close/minimize affordances AND
        the grid-stage / detail view. Sized to its content, so it IS the
        centred colonies block; the close button anchors to its top-right
        corner (just above the cards) instead of the far viewport corner.
        The overlay's `place-items: center` centres this whole block.
      -->
      <div class="colonies-overlay__content">

      <!--
        Close button — full exit. Visible only in dismissable modes
        (trade / view). Build mode locks the action: the server has
        committed the Standard Project payment, the only legal next
        step is picking a colony, so a "close" affordance would mislead
        the player into thinking they can back out without consequence.
      -->
      <button v-if="dismissable && !minimized"
              class="colonies-overlay__close"
              @click="$emit('close')"
              :title="$t('Close colonies overlay')"
              data-test="colonies-overlay-close">
        <span class="colonies-overlay__close-glyph">×</span>
        <span class="colonies-overlay__close-label" v-i18n>Close</span>
      </button>

      <!--
        Minimize button — collapses the whole overlay into a pill at the
        top of the viewport so the player can inspect the board / their
        tableau / other panels before committing. While minimized, other
        action buttons stay disabled automatically because they all gate
        on `playerView.waitingFor` (which the server has parked on the
        SelectColony prompt). Click the pill to expand back.

        Only shown in build mode — trade/view modes already have the
        full × close, so minimize would be a redundant second affordance.
      -->
      <button v-if="!dismissable && !minimized"
              class="colonies-overlay__minimize"
              @click="minimize"
              :title="$t('Minimize — look at the board before deciding')"
              data-test="colonies-overlay-minimize">
        <span class="colonies-overlay__minimize-glyph">↗</span>
        <span class="colonies-overlay__minimize-label" v-i18n>Minimize</span>
      </button>

      <!--
        Cancel — a safe path back from a not-yet-committed colony build
        (pay-on-commit standard project). Shown only when the server marked the
        placement cancellable; submits a CancelResponse (nothing is spent).
      -->
      <button v-if="!dismissable && cancellable && !minimized"
              class="colonies-overlay__cancel"
              @click="$emit('cancel')"
              :title="$t('Cancel construction')"
              data-test="colonies-overlay-cancel">
        <span class="colonies-overlay__minimize-glyph">×</span>
        <span class="colonies-overlay__minimize-label" v-i18n>Cancel construction</span>
      </button>

      <!--
        Grid view — visible while no specific colony is open. ColonyTiles
        are positioned with auto-fit so 1..many colonies all read well.
        `@click.self` on the grid-stage catches clicks that land on EMPTY
        cells of the grid (between tiles) — tile clicks bubble up to
        here but the `.self` filter rejects them, so only true empty-
        area clicks dismiss in dismissable modes.
      -->
      <div v-if="detailColonyName === undefined" class="colonies-overlay__grid-stage"
           @click.self="onBackdropClick">
        <div class="colonies-overlay__tiles">
          <ColonyTile
            v-for="colony in colonies"
            :key="colony.name"
            :colony="colony"
            :mode="mode"
            :selectable="selectableSet.has(colony.name)"
            :disabledReason="reasonFor(colony)"
            :visitor="colony.visitor"
            :visitorName="visitorNameFor(colony)"
            :viewerColor="viewerColor"
            @view="onTileView"
            @select="onTileSelect" />
        </div>

        <!--
          Central prompt panel. Differs per mode (trade vs build vs view).
          Houses the prompt text and the free-fleets indicator stack.
        -->
        <div class="colonies-overlay__center" :data-test="'colonies-overlay-mode-' + mode">
          <div class="colonies-overlay__center-frame">
            <div class="colonies-overlay__center-corner colonies-overlay__center-corner--tl"></div>
            <div class="colonies-overlay__center-corner colonies-overlay__center-corner--tr"></div>
            <div class="colonies-overlay__center-corner colonies-overlay__center-corner--bl"></div>
            <div class="colonies-overlay__center-corner colonies-overlay__center-corner--br"></div>

            <!--
              Free trade fleets. One row per player; each renders that
              player's `fleetSize - tradesThisGeneration` ships in their
              colour. Quick visual signal: blue still has 2 ships, green 1,
              etc. When a player's fleet has been sent to a colony THIS
              generation we render that ship over the corresponding tile
              (see `colony-tile__visitor`), so the two views together tell
              the full story.
            -->
            <div class="colonies-overlay__fleets" v-if="players.length > 0">
              <div class="colonies-overlay__fleets-title" v-i18n>Free trade fleets</div>
              <div class="colonies-overlay__fleets-rows">
                <div v-for="p in playersWithFleets" :key="p.color"
                     class="colonies-overlay__fleets-row">
                  <span class="colonies-overlay__fleets-row-name"
                        :class="'player-name-' + p.color">{{ p.name }}</span>
                  <div class="colonies-overlay__fleets-ships">
                    <div v-for="i in freeFleetCount(p)"
                         :key="i"
                         :class="'colonies-fleet colonies-fleet-' + p.color"
                         class="colonies-overlay__fleet-ship"></div>
                    <div v-if="freeFleetCount(p) === 0" class="colonies-overlay__fleets-none" v-i18n>— none</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="colonies-overlay__prompt" v-i18n>{{ promptText }}</div>
          </div>
        </div>
      </div>

      <!--
        Single-colony detail view. Replaces the grid stage when the player
        clicks on a tile's body (not its SELECT button). Returning to grid
        is via the in-detail "Close" button — does NOT close the overlay.
      -->
      <ColonyDetailView v-else
                        :colony="detailColony"
                        :mode="mode"
                        :selectable="selectableSet.has(detailColonyName)"
                        :disabledReason="reasonFor(detailColony)"
                        :activationReason="detailColony.isActive ? '' : reasonFor(detailColony)"
                        :players="players"
                        @close="detailColonyName = undefined"
                        @select="onDetailSelect" />
      </div>
    </div>
  </Teleport>

  <!--
    Minimized-state pill. Sits in its OWN teleport (independent of the
    overlay's stacking context) so we can place it at a moderate
    z-index — above the board but below bar-overlays, exactly the same
    way the MandatoryInputModal pill behaves. The whole pill is the
    click target; pressing Enter / Space when focused also restores.

    Class shape mirrors `.mandatory-input-modal-pill` styles for
    visual consistency.
  -->
  <Teleport to="body">
    <div :class="pillClass"
         role="button"
         tabindex="0"
         :title="$t('Click to expand the awaiting prompt')"
         @click="restore"
         @keydown.enter="restore"
         @keydown.space="restore"
         data-test="colonies-overlay-pill">
      <span class="colonies-overlay-pill__dot"></span>
      <span class="colonies-overlay-pill__label" v-i18n>AWAITING DECISION</span>
      <span class="colonies-overlay-pill__sep">/</span>
      <span class="colonies-overlay-pill__title" v-i18n>{{ pillPrompt }}</span>
      <span class="colonies-overlay-pill__restore" :title="$t('Restore')">⤢</span>
    </div>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import ColonyTile from './ColonyTile.vue';
import ColonyDetailView from './ColonyDetailView.vue';
import {translateText} from '@/client/directives/i18n';

export type ColoniesOverlayMode = 'trade' | 'build' | 'view';

type DataModel = {
  detailColonyName: ColonyName | undefined;
  // While `true`, the whole overlay collapses to a pill at the top of
  // the viewport. Player can interact with the rest of the page (board,
  // panels) but cannot take any new actions — every action button gates
  // on `playerView.waitingFor`, which the server has parked on the
  // SelectColony prompt that's driving this overlay open.
  minimized: boolean;
};

export default defineComponent({
  name: 'ColoniesOverlay',
  components: {ColonyTile, ColonyDetailView},
  props: {
    // Full list of colonies in this game — always rendered, even when
    // not selectable, per the product requirement "always show all
    // colonies; dim+disabled when unavailable".
    colonies: {
      type: Array as () => ReadonlyArray<ColonyModel>,
      required: true,
    },
    // Every player in the game. Drives the free-fleets indicator panel.
    players: {
      type: Array as () => ReadonlyArray<PublicPlayerModel>,
      required: true,
    },
    // 'trade' — open from the bottom-bar button, the player picks a
    // colony to trade with. Triggers a payment chooser before submission.
    // 'build' — server-driven, response to picking the Build Colony SP.
    //           Click-through is direct (no payment chooser).
    // 'view'  — informational, no action available right now. All tiles
    //           are dimmed, SELECT is disabled with explanatory tooltip.
    mode: {
      type: String as () => ColoniesOverlayMode,
      default: 'view',
    },
    /*
     * Серверный `buttonLabel` SelectColony-промпта — единственный признак,
     * по которому в build-режиме отличается «строим колонию» от «добавляем
     * планшет колонии в игру»:
     *   - 'Build'             → BuildColony deferred (Standard Project,
     *                            card-driven build) — prompt «… для строительства»
     *   - 'Add colony tile'   → ColoniesHandler.addColonyTile (Aridor initial
     *                            action и любые будущие «add-tile» эффекты)
     *                            — prompt «… для добавления в игру»
     * Пусто в trade / view режимах.
     *
     * NB: универсальная привязка к серверному signal'у, без if на имя
     * корпорации — любая будущая карта/прелюдия, которая использует тот же
     * `addColonyTile` путь, автоматически получит правильную надпись.
     */
    buildButtonLabel: {
      type: String,
      default: '',
    },
    // Names of colonies that the server is currently offering as picks.
    // Empty in 'view' mode. Drives per-tile enabled state + the SELECT
    // button's clickability.
    selectableNames: {
      type: Array as () => ReadonlyArray<ColonyName>,
      default: () => [],
    },
    // Per-colony explanations for the disabled state. The overlay falls
    // back to a generic "Unavailable" message when there's no entry.
    disabledReasons: {
      type: Object as () => Partial<Record<ColonyName, string>>,
      default: () => ({}),
    },
    // When false (build mode) backdrop / × clicks do nothing — the
    // server is waiting for a colony pick and we don't have a Reset path
    // mounted in this overlay. Trade/view modes default to true.
    dismissable: {
      type: Boolean,
      default: true,
    },
    // True when the (build-mode) colony placement is a pay-on-commit standard
    // project that hasn't committed yet → show a "Cancel construction" button.
    cancellable: {
      type: Boolean,
      default: false,
    },
    // Viewer colour — passed down to each ColonyTile so its visitor
    // tooltip can tell "your own fleet" apart from "someone else's
    // fleet" parked on a colony.
    viewerColor: {
      type: String as () => Color | undefined,
      default: undefined,
    },
    // Глобальная причина блокировки SELECT на всех колониях. Когда
    // непустая — `reasonFor` возвращает её для каждой колонии (после
    // i18n-перевода), полностью переопределяя per-colony / view-mode
    // дефолты. Используется, например, во время initial draft phase:
    // overlay открывается в режиме view, но tooltip обязан явно сказать
    // «Недоступно на этапе драфта» вместо общего «No colony action
    // available right now». Параллельно блокирует наблюдаемый клик —
    // selectableSet и так пуст в view-mode, так что Select-кнопки уже
    // disabled; этот prop только меняет текст подсказки.
    forceDisabledReason: {
      type: String,
      default: '',
    },
  },
  emits: ['select', 'close', 'cancel'],
  data(): DataModel {
    return {
      detailColonyName: undefined,
      minimized: false,
    };
  },
  watch: {
    // When the server flips the prompt (e.g. one SelectColony resolves
    // and another fires for a different action), reset minimize so the
    // new prompt isn't silently buried in the pill the player didn't
    // expect.
    mode() {
      this.minimized = false;
    },
  },
  computed: {
    rootClass(): string {
      const classes = ['colonies-overlay'];
      if (this.minimized) {
        classes.push('colonies-overlay--minimized');
      }
      return classes.join(' ');
    },
    pillClass(): string {
      const classes = ['colonies-overlay-pill'];
      if (this.minimized) {
        classes.push('colonies-overlay-pill--visible');
      }
      return classes.join(' ');
    },
    // Short label shown in the pill so the player knows what's waiting
    // without expanding. Trade mode never minimizes (no minimize button)
    // — only build mode does — so we tune the label for the build flow.
    pillPrompt(): string {
      if (this.mode === 'build') {
        return 'Pick a colony';
      }
      if (this.mode === 'trade') {
        return 'Pick a colony';
      }
      return 'Colonies';
    },
    selectableSet(): Set<ColonyName> {
      return new Set(this.selectableNames);
    },
    detailColony(): ColonyModel {
      // Only accessed when detailColonyName !== undefined — guard by
      // returning a safe placeholder in the impossible case.
      const found = this.colonies.find((c) => c.name === this.detailColonyName);
      // Caller guarantees presence via v-else on the grid stage; non-null
      // assertion in TS would be cleaner but we keep TS-strict here.
      return found ?? this.colonies[0];
    },
    promptText(): string {
      if (this.mode === 'build') {
        // 'Add colony tile' идёт от ColoniesHandler.addColonyTile — это
        // Aridor (initial action) и любые будущие add-tile эффекты.
        // Семантика «добавляем планшет в игру», а не «строим колонию».
        if (this.buildButtonLabel === 'Add colony tile') {
          return 'Select a colony tile to add to the game.';
        }
        return 'Select a colony tile for construction.';
      }
      if (this.mode === 'trade') {
        return 'Select a colony tile for trade.';
      }
      return 'Viewing colonies.';
    },
    // Drop players with 0 max fleet — typically those who haven't yet
    // played any fleet-granting card. Keep players who currently have 0
    // FREE fleets (all sent out) so the row still surfaces them with the
    // "— none" placeholder, useful information.
    playersWithFleets(): ReadonlyArray<PublicPlayerModel> {
      return this.players.filter((p) => (p.fleetSize ?? 0) > 0);
    },
  },
  methods: {
    freeFleetCount(p: PublicPlayerModel): number {
      // fleetSize is the total trade ships the player owns; subtracted
      // by tradesThisGeneration to give the count still available to send
      // out THIS generation.
      return Math.max(0, (p.fleetSize ?? 0) - (p.tradesThisGeneration ?? 0));
    },
    reasonFor(colony: ColonyModel): string {
      // Selectable colonies don't surface a reason — the tooltip shows
      // the positive "select this" message instead.
      if (this.selectableSet.has(colony.name)) {
        return '';
      }
      // Глобальное переопределение (например, initial draft phase) — имеет
      // приоритет над per-colony объяснениями и fallback'ами.
      if (this.forceDisabledReason !== '') {
        return translateText(this.forceDisabledReason);
      }
      const explicit = this.disabledReasons[colony.name];
      if (explicit) {
        return translateText(explicit);
      }
      // Fall-back defaults — derived from the visible colony state so the
      // tooltip stays informative even when the host didn't supply a
      // specific reason. View mode gets a mode-specific generic.
      if (!colony.isActive) {
        return translateText('Colony is inactive');
      }
      if (this.mode === 'trade' && colony.visitor !== undefined) {
        return translateText('Another trade fleet is already here');
      }
      if (this.mode === 'view') {
        return translateText('No colony action available right now');
      }
      return translateText('Unavailable for the current action');
    },
    onTileView(name: ColonyName): void {
      this.detailColonyName = name;
    },
    onTileSelect(name: ColonyName): void {
      // Defensive — the tile already checks selectable, but bypassing
      // the prop (e.g. tests, future hot-key) shouldn't trigger a
      // server call for a non-pickable colony.
      if (!this.selectableSet.has(name)) {
        return;
      }
      this.$emit('select', name);
    },
    onDetailSelect(name: ColonyName): void {
      if (!this.selectableSet.has(name)) {
        return;
      }
      this.$emit('select', name);
    },
    minimize(): void {
      this.minimized = true;
    },
    restore(): void {
      this.minimized = false;
    },
    // Look up the visiting player's display name from the players list,
    // so the tile's fleet-tooltip can read "Trade fleet of NASTYA is
    // here" rather than just "Trade fleet currently here". Returns ''
    // when there's no visitor — the ColonyTile uses that to fall back
    // to the colour-only tooltip.
    visitorNameFor(colony: ColonyModel): string {
      if (colony.visitor === undefined) {
        return '';
      }
      const p = this.players.find((p) => p.color === colony.visitor);
      return p?.name ?? '';
    },
    onBackdropClick(): void {
      // Defensive: when minimized, CSS already makes the backdrop
      // pointer-events: none, but a stray click finding the handler
      // would otherwise dismiss the prompt that the player intentionally
      // collapsed. Bail explicitly.
      if (this.minimized) {
        return;
      }
      if (!this.dismissable) {
        return;
      }
      // Detail view first — clicking the backdrop while in detail view
      // returns to the grid, not all the way out. Two clicks = exit.
      if (this.detailColonyName !== undefined) {
        this.detailColonyName = undefined;
        return;
      }
      this.$emit('close');
    },
  },
});
</script>

<template>
  <!--
    Always-visible top banner pill announcing that the game is waiting for
    a tile placement on the Mars board. Visual style mirrors the
    mandatory-input-modal pill so the player learns the pattern once: an
    "AWAITING" pill at the top of the viewport = the game wants something.

    Two stacking contexts via separate teleports:
      1. Banner pill (z-index 100) — sits ABOVE the board, BELOW top-bar
         overlays (Awards / Milestones / Standard Projects, z=110) so the
         player can briefly hide it by opening an overlay to inspect data.
      2. Details modal (z-index 12000) — covers everything; click-outside
         backdrop dismiss closes the details only (does NOT cancel the
         pending placement).

    Click on the pill → opens details modal explaining what's happening
    and (for cancellable placements) offering a Cancel button.
  -->
  <Teleport to="body">
    <div ref="banner"
         class="placement-banner"
         role="button"
         tabindex="0"
         :title="$t('Click for details about this placement')"
         @click="showDetails = true"
         @keydown.enter="showDetails = true"
         @keydown.space.prevent="showDetails = true"
         data-test="placement-banner">
      <!--
        Dedicated drag handle — 6-dot sci-fi grip, same pattern as the
        MandatoryInputModal pill. Splits click-vs-drag into clean zones:
        the rest of the banner body is the click target (opens details);
        the grip on the left is the ONLY drag start point. Without this,
        the entire banner was both clickable and draggable, with a 5-px
        threshold trying to disambiguate — which still occasionally
        opened details when the player meant to drag (especially on
        touch / fast pointer devices).

        `touch-action: none` on the handle (CSS) prevents browser touch
        panning from being mistaken for a scroll. `aria-hidden` keeps
        the grip out of the screen-reader label since it's pure visual
        affordance — keyboard users move/restore via Enter/Space on the
        banner itself (existing focus + keydown handlers).
      -->
      <span ref="dragHandle"
            class="placement-banner__handle"
            :title="$t('Drag to reposition')"
            aria-hidden="true"
            data-test="placement-banner-handle">
        <span></span><span></span>
        <span></span><span></span>
        <span></span><span></span>
      </span>
      <span class="placement-banner__dot"></span>
      <span class="placement-banner__label" v-i18n>AWAITING PLACEMENT</span>
      <span class="placement-banner__sep">/</span>
      <span class="placement-banner__title">{{ titleText }}</span>
      <span class="placement-banner__expand" :title="$t('Show details')">⤢</span>
    </div>
  </Teleport>

  <!--
    Details modal — appears on banner click. Sci-fi card matching the
    MandatoryInputModal chrome (L-corner ticks, cyan halo, dark glass
    background). Holds the explanation text + actions.

    Action semantics:
      - "Close details" — closes the modal only. Placement is still
        pending; the banner remains visible; the board still highlights
        selectable spaces.
      - "Cancel placement" (cancellable only) — emits 'cancel' and
        closes the modal. Parent (PlayerHome) handles the actual cancel
        (toggles convertPlantsPickerActive back to false, which
        unmounts SelectSpace and clears board highlights via its
        beforeUnmount hook).
  -->
  <Teleport to="body">
    <div v-if="showDetails" class="placement-details">
      <div class="placement-details__backdrop"
           @click="showDetails = false"
           data-test="placement-details-backdrop"></div>
      <div class="placement-details__card">
        <div class="placement-details__corner placement-details__corner--tl"></div>
        <div class="placement-details__corner placement-details__corner--tr"></div>
        <div class="placement-details__corner placement-details__corner--bl"></div>
        <div class="placement-details__corner placement-details__corner--br"></div>

        <div class="placement-details__header">
          <span class="placement-details__header-dot"></span>
          <span class="placement-details__header-label" v-i18n>AWAITING PLACEMENT</span>
        </div>

        <h2 class="placement-details__title">{{ titleText }}</h2>

        <p class="placement-details__body" v-i18n>
          The game is waiting for you to choose a place on the Mars board.
        </p>

        <p v-if="sourceMessage" class="placement-details__source">{{ $t(sourceMessage) }}</p>

        <p v-if="!cancellable && reasonText !== undefined" class="placement-details__mandatory">{{ reasonText }}</p>
        <p v-else-if="!cancellable" class="placement-details__mandatory" v-i18n>
          This action is mandatory and cannot be cancelled.
        </p>

        <div class="placement-details__actions">
          <button v-if="cancellable"
                  class="placement-details__btn placement-details__btn--cancel"
                  @click="onCancelClick"
                  data-test="placement-details-cancel">
            <span v-i18n>Cancel placement</span>
          </button>
          <button class="placement-details__btn placement-details__btn--close"
                  @click="showDetails = false"
                  data-test="placement-details-close">
            <span v-i18n>Close details</span>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Message} from '@/common/logs/Message';
import {translateText, translateMessage} from '@/client/directives/i18n';
import {makeDraggable, DraggableController, DraggablePosition} from '@/client/components/draggable';

type DataModel = {
  showDetails: boolean;
  /*
   * Pixel offset from the default centred-top position. Updated by
   * the drag controller on pointerup (final value only — per-frame
   * drag visuals go through inline CSS vars `--drag-x`/`--drag-y`
   * written directly on the banner element, bypassing Vue's render
   * pipeline for perf). (0, 0) = default position, vars unset.
   */
  dragOffset: DraggablePosition;
  /* Reference to the active drag controller so we can tear it down
   * in `beforeUnmount` and avoid leaked document-level listeners. */
  dragController: DraggableController | null;
};

export default defineComponent({
  name: 'PlacementBanner',
  props: {
    // Prompt title from the server (or from the client-side prompt for
    // convert-plants picker). Accepts the same `string | Message` shape
    // every PlayerInput model uses. Falls back to a generic localized
    // title when undefined/empty so the banner is never blank.
    title: {
      type: [String, Object] as unknown as PropType<string | Message | undefined>,
      required: false,
      default: '',
    },
    // false  → mandatory placement (server is locked in SelectSpace; no
    //          take-back). Details modal hides the Cancel button and
    //          shows the "mandatory" note.
    // true   → cancellable placement (client-side picker preview where
    //          the server is still in OrOptions). Details modal shows
    //          Cancel. Cancel emits 'cancel'; parent decides what that
    //          actually means (typically: dismiss the picker and restore
    //          the action menu).
    cancellable: {
      type: Boolean,
      default: false,
    },
    // Optional English key for an extra explanation paragraph in the
    // details modal — used to tell the player WHERE the prompt came from
    // when it isn't obvious from the title alone. Example: the convert-
    // plants picker passes "This action was initiated by the convert-
    // plants action." Empty string means no source line.
    sourceMessage: {
      type: String,
      default: '',
    },
    // Optional honest reason (server `placementContext.reason`) shown when the
    // placement is NOT cancellable — replaces the generic "mandatory" note with
    // the specific cause (e.g. "resources already spent"). Accepts string | Message.
    reason: {
      type: [String, Object] as unknown as PropType<string | Message | undefined>,
      required: false,
      default: undefined,
    },
  },
  emits: ['cancel'],
  data(): DataModel {
    return {
      showDetails: false,
      dragOffset: {x: 0, y: 0},
      dragController: null,
    };
  },
  computed: {
    titleText(): string {
      const t = this.title;
      if (t === undefined || t === '') {
        return translateText('Awaiting tile placement');
      }
      if (typeof t === 'string') {
        return translateText(t);
      }
      return translateMessage(t);
    },
    reasonText(): string | undefined {
      const r = this.reason;
      if (r === undefined || r === '') {
        return undefined;
      }
      return typeof r === 'string' ? translateText(r) : translateMessage(r);
    },
  },
  watch: {
    // If the prompt swaps without unmounting (e.g. one mandatory
    // placement resolves and the server immediately fires another), the
    // open details modal would be showing stale info. Closing on title
    // change makes the player explicitly re-open to see the new context.
    title() {
      this.showDetails = false;
    },
  },
  mounted() {
    const el = this.$refs.banner as HTMLElement | undefined;
    const handleEl = this.$refs.dragHandle as HTMLElement | undefined;
    if (el !== undefined) {
      // Pass the 6-dot grip as the dedicated drag handle so click vs
      // drag is geometrically separated — click on the body opens
      // details, drag from the grip moves the pill. Same pattern as
      // MandatoryInputModal's pill.
      this.dragController = makeDraggable(el, this.dragOffset, {handle: handleEl});
    }
  },
  beforeUnmount() {
    this.dragController?.destroy();
    this.dragController = null;
  },
  methods: {
    onCancelClick(): void {
      this.showDetails = false;
      this.$emit('cancel');
    },
  },
});
</script>

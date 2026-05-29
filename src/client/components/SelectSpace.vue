<template>
  <div class="select_space_cont">
    <confirm-dialog
        message="Place your tile here?"
        :enableDontShowAgainCheckbox="true"
        ref="confirmation"
        v-on:accept="confirmPlacement"
        v-on:dismiss="cancelPlacement"
        v-on:hide="hideDialog" />
    <div v-if="showtitle" class="wf-select-space">
      {{ $t(playerinput.title) }}
      <go-to-map :playerinput="playerinput"></go-to-map>
    </div>
    <div v-if="warning" class="nes-container is-rounded">
      <span class="nes-text is-warning" v-i18n>{{ warning }}</span>
      <go-to-map :playerinput="playerinput"></go-to-map>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {SelectSpaceModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {getPreferences, PreferencesManager} from '@/client/utils/PreferencesManager';
import {SelectSpaceResponse} from '@/common/inputs/InputResponse';
import ConfirmDialog from '@/client/components/common/ConfirmDialog.vue';
import GoToMap from '@/client/components/waitingFor/GoToMap.vue';
import {SpaceId} from '@/common/Types';
import {PLACEMENT_REASON_LABEL, PlacementIllegalReason} from '@/common/inputs/PlacementIllegalReason';
import {translateText} from '@/client/directives/i18n';

/**
 * Marker attribute on cells we annotated with an illegal-reason tooltip.
 * Used so cleanup only touches cells we actually modified, leaving any
 * existing `title` / data attributes on other elements untouched.
 */
const DATA_ILLEGAL_MARKER = 'data-placement-illegal';


type Refs = {
  confirmation: InstanceType<typeof ConfirmDialog>;
};

type DataModel = {
  spaces: Set<SpaceId>;
  selectedTile: HTMLElement | undefined,
  spaceId: SpaceId | undefined;
  warning: string | undefined;
};

export default defineComponent({
  name: 'SelectSpace',
  props: {
    playerView: {
      type: Object as () => PlayerViewModel,
      required: true,
    },
    playerinput: {
      type: Object as () => SelectSpaceModel,
      required: true,
    },
    onsave: {
      type: Function as unknown as () => (out: SelectSpaceResponse) => void,
      required: true,
    },
    showsave: {
      type: Boolean,
      required: true,
    },
    showtitle: {
      type: Boolean,
      required: true,
    },
  },
  data(): DataModel {
    return {
      spaces: new Set(this.playerinput.spaces),
      selectedTile: undefined,
      spaceId: undefined,
      warning: undefined,
    };
  },
  components: {
    'confirm-dialog': ConfirmDialog,
    GoToMap,
  },
  computed: {
    typedRefs(): Refs {
      return this.$refs as unknown as Refs;
    },
  },
  methods: {
    animateSpace(tile: Element, activate: boolean) {
      if (activate) {
        tile.classList.add('board-space--available');
      } else {
        tile.classList.remove('board-space--available');
      }
    },
    animateSpaces(tiles: Array<Element>) {
      tiles.forEach((tile: Element) => {
        const spaceId = tile.getAttribute('data_space_id') as SpaceId;
        if (spaceId !== null && this.spaces.has(spaceId)) {
          this.animateSpace(tile, true);
        }
      });
    },
    /**
     * Apply native browser tooltip (`title`) + `.board-space--illegal`
     * class to every cell the server reported as off-limits for this
     * placement. Only touches cells whose spaceId is in `illegalSpaces`
     * — legal cells, special cells, and unknown markers are left alone.
     *
     * Reason → localized string lookup via PLACEMENT_REASON_LABEL + the
     * existing `translateText` helper so RU / other locales work out
     * of the box once the strings are added to `ui.json`.
     *
     * The `data-placement-illegal` marker attribute is dropped in
     * `removeIllegalTooltips()` so cleanup is surgical.
     */
    applyIllegalTooltips(tiles: Array<Element>) {
      const illegal = this.playerinput.illegalSpaces;
      if (illegal === undefined || illegal.length === 0) return;
      const reasonsBySpace = new Map<SpaceId, PlacementIllegalReason>();
      for (const entry of illegal) {
        reasonsBySpace.set(entry.spaceId, entry.reason);
      }
      for (const tile of tiles) {
        const spaceId = tile.getAttribute('data_space_id') as SpaceId;
        if (spaceId === null) continue;
        const reason = reasonsBySpace.get(spaceId);
        if (reason === undefined) continue;
        const label = PLACEMENT_REASON_LABEL[reason] ?? PLACEMENT_REASON_LABEL['unavailable'];
        tile.setAttribute('title', translateText(label));
        tile.setAttribute(DATA_ILLEGAL_MARKER, '1');
        tile.classList.add('board-space--illegal');
      }
    },
    removeIllegalTooltips() {
      // Use the marker so we only revert cells WE annotated. Avoids
      // clobbering any title set elsewhere (BoardSpaceTile sets one for
      // tile descriptions).
      const marked = document.querySelectorAll('[' + DATA_ILLEGAL_MARKER + ']');
      marked.forEach((el) => {
        el.removeAttribute('title');
        el.removeAttribute(DATA_ILLEGAL_MARKER);
        el.classList.remove('board-space--illegal');
      });
    },
    cancelPlacement() {
      if (this.selectedTile === undefined) {
        throw new Error('unexpected, no tile selected!');
      }
      this.animateSpace(this.selectedTile, false);
      const tiles = this.getSelectableSpaces();
      this.animateSpaces(tiles);
      this.applyIllegalTooltips(tiles);
    },
    confirmPlacement() {
      const tiles = this.getSelectableSpaces();
      tiles.forEach((tile) => {
        tile.onclick = null;
      });

      if (this.selectedTile === undefined) {
        throw new Error('unexpected, no tile selected!');
      }
      const spaceId = this.selectedTile.getAttribute('data_space_id') as SpaceId;
      if (spaceId === null) {
        throw new Error('unexpected, space has no id');
      }
      this.spaceId = spaceId;
      this.selectedTile.classList.add('board-space--selected');
      this.saveData();
    },
    disableAnimation() {
      const tiles = this.getSelectableSpaces();
      tiles.forEach((tile) => {
        tile.classList.remove('board-space--available', 'board-space--selected');
      });
      this.removeIllegalTooltips();
    },
    getSelectableSpaces(): Array<HTMLElement> {
      const spaces: Array<HTMLElement> = [];

      const regions = ['main_board', 'moon_board', 'colony_spaces', 'moon_board_outer_spaces'];
      for (const region of regions) {
        const board = document.getElementById(region);
        if (board !== null) {
          const array = board.getElementsByClassName('board-space-selectable');
          for (let i = 0, length = array.length; i < length; i++) {
            spaces.push(array[i] as HTMLElement);
          }
        }
      }

      return spaces;
    },
    hideDialog(hide: boolean) {
      PreferencesManager.INSTANCE.set('hide_tile_confirmation', hide);
    },
    onTileSelected(tile: HTMLElement) {
      this.selectedTile = tile;
      this.disableAnimation();
      this.animateSpace(tile, true);
      tile.classList.remove('board-space--available');
      const hideTileConfirmation = getPreferences().hide_tile_confirmation;
      if (hideTileConfirmation) {
        this.confirmPlacement();
      } else {
        this.typedRefs.confirmation.show();
      }
    },
    saveData() {
      if (this.spaceId === undefined) {
        this.warning = 'Must select a space';
        return;
      }
      this.onsave({type: 'space', spaceId: this.spaceId});
    },
  },
  mounted() {
    this.disableAnimation();
    const tiles = this.getSelectableSpaces();
    this.animateSpaces(tiles);
    this.applyIllegalTooltips(tiles);
    for (let i = 0, length = tiles.length; i < length; i++) {
      const tile = tiles[i];
      const spaceId = tile.getAttribute('data_space_id') as SpaceId;

      if (spaceId === null || this.spaces.has(spaceId) === false) {
        continue;
      }

      tile.onclick = () => this.onTileSelected(tile);
    }
  },
  // Cleanup is critical when SelectSpace can be UNMOUNTED without a tile
  // being picked first — e.g. when the dedicated Convert-Plants button is
  // toggled off mid-pick. Without this, `board-space--available` lingers
  // (tiles keep blinking) and the `onclick` handlers stay attached
  // (clicking a tile after toggling off would still submit a space pick).
  // Safe to run on every unmount because `disableAnimation` is idempotent
  // and clearing `onclick` on an already-cleared tile is a no-op.
  beforeUnmount() {
    this.disableAnimation();
    const tiles = this.getSelectableSpaces();
    for (const tile of tiles) {
      tile.onclick = null;
    }
  },
});

</script>

<template>
  <div :class="mainClass" :data_space_id="space.id">
    <board-space-tile
      :space="space"
      :aresExtension="false"
      :tileView="tileView"
      :placementCleared="placementCleared"
    ></board-space-tile>
    <div class="board-space-text" v-if="text" v-i18n>{{ text }}</div>
    <bonus v-if="space.tileType === undefined || tileView === 'hide' || placementCleared" :bonus="space.bonus" />
    <template v-if="tileView === 'coords'">
      <div class="board-space-coords">{{ getSpaceName(space.id) }}</div>
    </template>
    <div v-if="space.color !== undefined && tileView === 'show'" :class="playerColorCss"></div>
    <div v-if="space.coOwner !== undefined && tileView === 'show'" :class="coOwnerColorCss"></div>
    <div class="board-log-highlight" :data_log_highlight_id="space.id"></div>
  </div>
</template>

<script setup lang="ts">
import {computed} from 'vue';
import {SpaceModel} from '@/common/models/SpaceModel';
import Bonus from '@/client/components/Bonus.vue';
import {TileView} from '../board/TileView';
import BoardSpaceTile from '@/client/components/board/BoardSpaceTile.vue';
import {getPreferences} from '@/client/utils/PreferencesManager';
import {getSpaceName} from '@/common/boards/spaces';
import {placementRenderState} from '@/client/components/board/placementRenderState';
import {vI18n} from '@/client/directives/vDirectives';

defineOptions({name: 'MoonSpace'});
const props = defineProps({
  space: {
    type: Object as () => SpaceModel,
    required: true,
  },
  text: {
    type: String,
    required: false,
  },
  tileView: {
    type: String as () => TileView,
    default: 'show',
  },
});

const mainClass = computed((): string => {
  let css = 'board-space moon-space-' + props.space.id.toString();
  css += ' board-space-selectable';

  if (props.space.spaceType === 'lunar_mine') {
    css += ' moon-space-type-mine';
  } else {
    css += ' moon-space-type-other';
  }

  return css;
});
const playerColorCss = computed((): string => {
  if (props.space?.color === undefined) {
    return '';
  }
  const css = 'board-cube board-cube--' + props.space.color;
  return getPreferences().symbol_overlay ? css + ' overlay' : css;
});
const coOwnerColorCss = computed((): string => {
  if (props.space?.coOwner === undefined) {
    return '';
  }
  const css = 'board-cube-coOwner board-cube--' + props.space.coOwner;
  return getPreferences().symbol_overlay ? css + ' overlay' : css;
});
// True while this mine cell is a remove-and-replace target (Lunar Mine
// Urbanization): hide the doomed mine graphic and show its bonus instead.
const placementCleared = computed((): boolean => {
  return placementRenderState.hiddenTiles.has(props.space.id);
});
</script>

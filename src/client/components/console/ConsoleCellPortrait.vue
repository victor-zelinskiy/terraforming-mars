<template>
  <!--
    THE CELL'S PORTRAIT (TR67 «КЛЕТКА — ОДНО ДОСЬЕ») — the head of the board
    column in every mode: the square at scene scale (its tile's real art, or
    its printed bonus as large icons on its kind's ground), the owner's cube,
    the tile's own points, and its SIX NEIGHBOURS around it in the board's true
    geometry — each wearing the relation tone the board lights it with and,
    when the server states one, what that ONE neighbour means for this cell.

    DATA, NOT MOTION: a d-pad step swaps the portrait's content in the same
    frame (nothing here has a transition); the slots themselves never move —
    the six neighbour positions are fixed by CSS, so the geometry is constant
    from one cell to the next and an edge simply draws no hex.
  -->
  <div class="con-cellp" :class="{'con-cellp--ring': ring.length > 0}"
       data-cell-portrait :data-cell-space="portrait.space">
    <div class="con-cellp__stage">
      <div v-for="slot in ring" :key="slot.dir"
           class="con-cellp__nb" :class="nbClasses(slot)"
           :data-ring-dir="slot.dir" :data-ring-space="slot.piece?.space" :data-ring-tone="slot.tone">
        <template v-if="slot.piece !== undefined">
          <span class="con-cellp__hex con-cellp__hex--nb" :class="groundClass(slot.piece)" aria-hidden="true">
            <span v-if="artClass(slot.piece) !== ''" class="con-cellp__art con-cellp__art--nb" :class="artClass(slot.piece)"></span>
          </span>
          <span v-if="slot.piece.ownerColor !== undefined && slot.piece.hazard !== true"
                class="con-cellp__cube con-cellp__cube--nb" :class="'player_bg_color_' + slot.piece.ownerColor" aria-hidden="true"></span>
          <span v-if="slot.chip !== undefined" class="con-cellp__chip" :key="chipKey(slot)" data-ring-chip>
            <template v-if="slot.chip.delta !== undefined">
              <span class="con-cellp__chip-ico" :class="iconClass(slot.chip.delta.icon)" aria-hidden="true"></span>
              <b>{{ slot.chip.delta.direction === 'cost' ? '−' : '+' }}{{ slot.chip.delta.amount }}</b>
            </template>
            <template v-else-if="slot.chip.vp !== undefined">
              <span v-if="slot.chip.for !== undefined" class="con-cellp__chip-dot" :class="'player_bg_color_' + slot.chip.for" aria-hidden="true"></span>
              <b>{{ slot.chip.vp < 0 ? '−' : '+' }}{{ Math.abs(slot.chip.vp) }}</b><i>{{ $t('VP') }}</i>
            </template>
          </span>
        </template>
      </div>

      <div class="con-cellp__centre">
        <span class="con-cellp__hex con-cellp__hex--c" :class="groundClass(portrait)" aria-hidden="true">
          <span v-if="centreArt !== ''" class="con-cellp__art con-cellp__art--c" :class="centreArt"></span>
          <span v-else-if="bonusIcons.length > 0" class="con-cellp__bonus" :class="'con-cellp__bonus--n' + Math.min(bonusIcons.length, 4)">
            <span v-for="(icon, i) in bonusIcons" :key="i" class="con-cellp__bonus-ico" :class="icon"></span>
          </span>
        </span>
        <!-- TR44: the water the city stands on, a piece of its own — its miniature at the pile's foot (the board's own mark). -->
        <span v-if="underArt !== ''" class="con-cellp__under" aria-hidden="true">
          <span class="con-cellp__art con-cellp__art--under" :class="underArt"></span>
        </span>
        <span v-if="portrait.ownerColor !== undefined && portrait.hazard !== true"
              class="con-cellp__cube con-cellp__cube--c" :class="'player_bg_color_' + portrait.ownerColor" aria-hidden="true"></span>
        <!-- The tile's OWN points at the end, in the score cell's language (the gold shield + the signed count). -->
        <span v-if="ownVp !== undefined" class="con-cellp__vp" :key="'vp' + ownVp" data-cell-vp>
          <ConsoleVpBadge :label="$t('VP')" />
          <b>{{ ownVp < 0 ? '−' : '+' }}{{ Math.abs(ownVp) }}</b>
        </span>
      </div>
    </div>
    <div v-if="marks.length > 0" class="con-cellp__marks">
      <span v-for="mark in marks" :key="mark.key" class="con-cellp__mark">{{ markText(mark) }}</span>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * Presentation only — what the portrait SAYS (the ring's tones and chips, the
 * marks, the tile's own points) is decided by the pure `cellDossier.ts` over
 * the server's `BoardCellInfo.portrait`; this file only draws it.
 */
import {defineComponent, PropType} from 'vue';
import {CellPortrait, CellPortraitPiece} from '@/common/boards/BoardInformationFacts';
import {SpaceType} from '@/common/boards/SpaceType';
import {tileCssClassOf} from '@/client/components/board/BoardSpaceTile.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {cellBonusIcons} from '@/client/console/revealStageHead';
import {CellMark, CellRingSlot} from '@/client/console/cellDossier';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import ConsoleVpBadge from '@/client/components/console/ConsoleVpBadge.vue';

export default defineComponent({
  name: 'ConsoleCellPortrait',
  components: {ConsoleVpBadge},
  props: {
    portrait: {type: Object as PropType<CellPortrait>, required: true},
    ring: {type: Array as PropType<ReadonlyArray<CellRingSlot>>, default: () => []},
    marks: {type: Array as PropType<ReadonlyArray<CellMark>>, default: () => []},
    ownVp: {type: Number as PropType<number | undefined>, default: undefined},
    /** Ares tile-art variants are active (`tileCssClassOf` needs the flag). */
    aresTiles: {type: Boolean, default: false},
  },
  computed: {
    Math(): Math {
      return Math;
    },
    centreArt(): string {
      return this.artClass(this.portrait);
    },
    underArt(): string {
      const under = this.portrait.under;
      if (under === undefined) {
        return '';
      }
      const suffix = tileCssClassOf(under, this.aresTiles);
      return suffix === '' ? '' : 'board-space-tile--' + suffix;
    },
    bonusIcons(): Array<string> {
      return cellBonusIcons(this.portrait.bonus);
    },
  },
  methods: {
    /** The board's own tile art for a piece ('' = an empty square). */
    artClass(piece: CellPortraitPiece): string {
      if (piece.tileType === undefined) {
        return '';
      }
      const suffix = tileCssClassOf(piece.tileType, this.aresTiles);
      return suffix === '' ? '' : 'board-space-tile--' + suffix;
    },
    /** The square's printed kind as its ground (land / an ocean reserve / a reserved square). */
    groundClass(piece: CellPortraitPiece): string {
      if (piece.reserved !== undefined) {
        return 'con-cellp__hex--reserved';
      }
      switch (piece.spaceType) {
      case SpaceType.OCEAN: return 'con-cellp__hex--ocean';
      case SpaceType.COVE: return 'con-cellp__hex--cove';
      case SpaceType.DEFLECTION_ZONE: return 'con-cellp__hex--deflection';
      default: return 'con-cellp__hex--land';
      }
    },
    nbClasses(slot: CellRingSlot): Array<string> {
      const out = ['con-cellp__nb--d' + slot.dir];
      if (slot.piece === undefined) {
        out.push('con-cellp__nb--edge');
      } else if (slot.tone !== undefined) {
        out.push('con-cellp__nb--lit', 'con-cellp__nb--' + slot.tone);
      } else if (slot.piece.tileType === undefined) {
        out.push('con-cellp__nb--quiet');
      }
      return out;
    },
    chipKey(slot: CellRingSlot): string {
      const c = slot.chip;
      return c === undefined ? '' : `${c.delta?.icon ?? ''}${c.delta?.amount ?? ''}|${c.vp ?? ''}|${c.for ?? ''}`;
    },
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
    markText(mark: CellMark): string {
      return mark.params !== undefined ? translateTextWithParams(mark.key, [...mark.params]) : translateText(mark.key);
    },
  },
});
</script>

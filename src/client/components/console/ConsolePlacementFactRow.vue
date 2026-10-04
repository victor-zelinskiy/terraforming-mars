<template>
  <!--
    ONE line of the placement dossier — a STABLE two-column composition: the
    statement reads left in the reading face, the change reads right in the
    display face on a fixed-width numeric column, so values never shift
    horizontally as the cursor walks the board. The row carries no capsule of
    its own: severity speaks through colour, and the panel is one shell.
  -->
  <div class="con-dossier-row" :class="['con-dossier-row--' + row.severity, {'con-dossier-row--landing': hasLines}]">
    <div class="con-dossier-row__main">
      <div class="con-dossier-row__title">
        <span v-i18n="row.params">{{ row.label }}</span
        ><span v-if="row.count > 1" class="con-dossier-row__count">×{{ row.count }}</span>
      </div>
      <!-- A LANDING's own lines, under the title (the row gives its value track back for them). -->
      <div v-if="hasLines" class="con-dossier-row__lines">
        <!-- WHERE IT LANDS — the card the player chose before the cell (a reward
             the cell decides: Arboretum's data). Its face, its name and its count
             moving by this cell's amount: two server numbers added, nothing
             computed. Static per row (keyed values flick like every other). -->
        <div v-if="row.target !== undefined" class="con-dossier-row__target" data-dossier-target>
          <span class="con-dossier-row__target-arrow" aria-hidden="true">→</span>
          <span class="con-dossier-row__target-face" aria-hidden="true">
            <ConsoleCardFaceLite :name="row.target.name" :lightweight="true" />
          </span>
          <span class="con-dossier-row__target-name">{{ $t(row.target.name) }}</span>
          <span class="con-dossier-row__target-val" :key="row.target.from + '-' + row.target.to">
            <span class="con-dossier-row__line-ico" :class="targetIconClass" aria-hidden="true"></span>
            <span class="con-dossier-row__line-from">{{ row.target.from }}</span>
            <span class="con-dossier-row__line-arrow" aria-hidden="true">→</span>
            <b class="con-dossier-row__line-to">{{ row.target.to }}</b>
          </span>
        </div>
        <!-- …and what the TABLE answers to it, read with its cause: «⚡ Марсианское оптоволокно +4». -->
        <div v-for="reaction in row.reactions ?? []" :key="reaction.key" class="con-dossier-row__react" data-dossier-reaction>
          <span class="con-dossier-row__react-bolt" aria-hidden="true">⚡</span>
          <span class="con-dossier-row__react-name" v-i18n>{{ reaction.label }}</span>
          <span class="con-dossier-row__react-val" :key="reaction.delta.amount">
            <span class="con-dossier-row__line-ico" :class="reactionIconClasses[reaction.key]" aria-hidden="true"></span>
            <b>{{ reaction.delta.direction === 'cost' ? '−' : '+' }}{{ reaction.delta.amount }}</b>
          </span>
        </div>
      </div>
      <!-- The compact breakdown of an AGGREGATED value: what made it up. One
           line, middle dots between terms — never a stack of full rows. -->
      <div v-if="row.reasons.length > 0" class="con-dossier-row__why">
        <span v-for="reason in row.reasons" :key="reason.key" class="con-dossier-row__why-term">
          <span v-i18n>{{ reason.label }}</span>
          <b>{{ reason.amount }}</b>
        </span>
      </div>
      <div v-else-if="row.note !== undefined" class="con-dossier-row__note" v-i18n="row.note.params">{{ row.note.text }}</div>
      <div v-if="row.source !== undefined" class="con-dossier-row__src" v-i18n>{{ row.source }}</div>
    </div>

    <!-- THE VALUE COLUMN. Its inner node is keyed on the rendered text, so a
         value that CHANGED re-mounts and plays the 90 ms update flick while an
         unchanged one keeps its node and stays perfectly still — «only what
         changed animates», with no timeline to queue up during fast
         navigation. -->
    <div class="con-dossier-row__val">
      <span v-if="delta !== undefined" :key="deltaText" class="con-dossier-row__delta" :class="deltaToneClass">
        <span v-if="delta.production === true" class="con-dossier-row__prod" aria-hidden="true">
          <span v-if="deltaIconClass !== ''" class="con-dossier-row__ico" :class="deltaIconClass"></span>
        </span>
        <span v-else-if="deltaIconClass !== ''" class="con-dossier-row__ico" :class="deltaIconClass" aria-hidden="true"></span>
        <span class="con-dossier-row__nums">
          <template v-if="hasRange">
            <span class="con-dossier-row__cur">{{ delta.current }}{{ unit }}</span>
            <span class="con-dossier-row__arrow" aria-hidden="true">→</span>
            <span class="con-dossier-row__res">{{ delta.resulting }}{{ unit }}</span>
          </template>
          <span v-else class="con-dossier-row__amt">{{ sign }}{{ delta.amount }}{{ unit }}</span>
        </span>
      </span>

      <!-- A VP POOL's vector — «2 → 3 ПО»: one parameter moving (a move's
           «City VP»), its members listed under the label, never two rows. -->
      <span v-if="row.vpVector !== undefined" :key="'vv' + row.vpVector.from + '-' + row.vpVector.to"
            class="con-dossier-row__vp con-dossier-row__vp--vector"
            :class="{'con-dossier-row__vp--neg': row.vpVector.to < row.vpVector.from}">
        <span class="con-dossier-row__cur">{{ row.vpVector.from }}</span>
        <span class="con-dossier-row__arrow" aria-hidden="true">→</span>
        <span class="con-dossier-row__res">{{ row.vpVector.to }}</span> <i>{{ $t('VP') }}</i>
      </span>

      <!-- Endgame VP — the gold badge (identity as TYPE: there is no sprite). -->
      <span v-else-if="row.vp !== undefined && row.vp !== 0" :key="'vp' + row.vp"
            class="con-dossier-row__vp" :class="{'con-dossier-row__vp--neg': row.vp < 0}">
        {{ row.vp < 0 ? '−' : '+' }}{{ Math.abs(row.vp) }} <i>{{ $t('VP') }}</i>
      </span>

      <!-- Milestone / award standing + the micro track. -->
      <span v-if="row.progress !== undefined" :key="'p' + row.progress.from + '-' + row.progress.to"
            class="con-dossier-row__prog" :class="{'con-dossier-row__prog--reached': progressReached}">
        <span class="con-dossier-row__prog-nums">
          <span class="con-dossier-row__cur">{{ row.progress.from }}</span>
          <span class="con-dossier-row__arrow" aria-hidden="true">→</span>
          <span class="con-dossier-row__res">{{ row.progress.to }}</span>
          <span v-if="row.progress.target !== undefined" class="con-dossier-row__prog-tgt">/{{ row.progress.target }}</span>
        </span>
        <span v-if="track !== undefined" class="con-dossier-row__track" aria-hidden="true">
          <i v-for="(cell, i) in track" :key="i" :class="'con-dossier-row__seg con-dossier-row__seg--' + cell"></i>
        </span>
      </span>

      <span v-if="row.timingKey !== undefined" class="con-dossier-row__when">{{ $t(row.timingKey) }}</span>
    </div>

  </div>
</template>

<script lang="ts">
/**
 * Presentation only — WHAT a line says (its compact label, whether several
 * facts aggregate into one change-vector, which breakdown it carries) is
 * decided by the pure `placementDossier` model.
 */
import {defineComponent, PropType} from 'vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {DossierRow, progressTrack} from '@/client/console/placementDossier';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

export default defineComponent({
  name: 'ConsolePlacementFactRow',
  components: {ConsoleCardFaceLite},
  props: {
    row: {type: Object as PropType<DossierRow>, required: true},
  },
  computed: {
    Math() {
      return Math;
    },
    delta() {
      return this.row.delta;
    },
    targetIconClass(): string {
      return this.row.target !== undefined ? iconClassFor(this.row.target.icon) : '';
    },
    deltaIconClass(): string {
      return this.delta !== undefined ? iconClassFor(this.delta.icon) : '';
    },
    hasRange(): boolean {
      return this.delta?.current !== undefined && this.delta?.resulting !== undefined;
    },
    unit(): string {
      return this.delta?.unit ?? '';
    },
    sign(): string {
      // A neutral chip states a quantity the cell HOLDS («×2»), not a change of the player's.
      if (this.row.neutralDelta === true) {
        return '×';
      }
      return this.delta?.direction === 'cost' ? '−' : '+';
    },
    /** The rendered value — the update key (see the template note). */
    deltaText(): string {
      const d = this.delta;
      if (d === undefined) {
        return '';
      }
      return this.hasRange ? `${d.current}>${d.resulting}${this.unit}` : `${this.sign}${d.amount}${this.unit}`;
    },
    /** The shared icon vocabulary for a reaction's resource (M€ for Martian Fiber). */
    reactionIconClasses(): Record<string, string> {
      const out: Record<string, string> = {};
      for (const r of this.row.reactions ?? []) {
        out[r.key] = iconClassFor(r.delta.icon);
      }
      return out;
    },
    /** The row carries a landing's own lines (where the delta lands · what answers it). */
    hasLines(): boolean {
      return this.row.target !== undefined || (this.row.reactions ?? []).length > 0;
    },
    deltaToneClass(): string {
      if (this.row.severity === 'danger') {
        return 'con-dossier-row__delta--danger';
      }
      if (this.row.neutralDelta === true) {
        return 'con-dossier-row__delta--neutral';
      }
      return this.delta?.direction === 'cost' ? 'con-dossier-row__delta--cost' : 'con-dossier-row__delta--gain';
    },
    progressReached(): boolean {
      const p = this.row.progress;
      return p !== undefined && p.target !== undefined && p.to >= p.target;
    },
    track() {
      return progressTrack(this.row.progress);
    },
  },
});
</script>

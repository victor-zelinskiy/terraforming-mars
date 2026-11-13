<template>
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
      <div v-else-if="row.note !== undefined" class="con-dossier-row__note" v-i18n="row.note?.params">{{ row.note?.text }}</div>
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

<script setup vapor lang="ts">
/*
 * ONE line of the placement dossier — a STABLE two-column composition: the
 * statement reads left in the reading face, the change reads right in the
 * display face on a fixed-width numeric column, so values never shift
 * horizontally as the cursor walks the board. The row carries no capsule of
 * its own: severity speaks through colour, and the panel is one shell.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
/**
 * Presentation only — WHAT a line says (its compact label, whether several
 * facts aggregate into one change-vector, which breakdown it carries) is
 * decided by the pure `placementDossier` model.
 */
import {computed, PropType} from 'vue';
import {$t} from '@/client/directives/i18n';
import {vI18n} from '@/client/directives/vDirectives';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {DossierRow, progressTrack} from '@/client/console/placementDossier';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

defineOptions({name: 'ConsolePlacementFactRow'});
const props = defineProps({
  row: {type: Object as PropType<DossierRow>, required: true},
});

const delta = computed(() => {
  return props.row.delta;
});
const targetIconClass = computed((): string => {
  return props.row.target !== undefined ? iconClassFor(props.row.target.icon) : '';
});
const deltaIconClass = computed((): string => {
  return delta.value !== undefined ? iconClassFor(delta.value.icon) : '';
});
const hasRange = computed((): boolean => {
  return delta.value?.current !== undefined && delta.value?.resulting !== undefined;
});
const unit = computed((): string => {
  return delta.value?.unit ?? '';
});
const sign = computed((): string => {
  // A neutral chip states a quantity the cell HOLDS («×2»), not a change of the player's.
  if (props.row.neutralDelta === true) {
    return '×';
  }
  return delta.value?.direction === 'cost' ? '−' : '+';
});
/** The rendered value — the update key (see the template note). */
const deltaText = computed((): string => {
  const d = delta.value;
  if (d === undefined) {
    return '';
  }
  return hasRange.value ? `${d.current}>${d.resulting}${unit.value}` : `${sign.value}${d.amount}${unit.value}`;
});
/** The shared icon vocabulary for a reaction's resource (M€ for Martian Fiber). */
const reactionIconClasses = computed((): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const r of props.row.reactions ?? []) {
    out[r.key] = iconClassFor(r.delta.icon);
  }
  return out;
});
/** The row carries a landing's own lines (where the delta lands · what answers it). */
const hasLines = computed((): boolean => {
  return props.row.target !== undefined || (props.row.reactions ?? []).length > 0;
});
const deltaToneClass = computed((): string => {
  if (props.row.severity === 'danger') {
    return 'con-dossier-row__delta--danger';
  }
  if (props.row.neutralDelta === true) {
    return 'con-dossier-row__delta--neutral';
  }
  return delta.value?.direction === 'cost' ? 'con-dossier-row__delta--cost' : 'con-dossier-row__delta--gain';
});
const progressReached = computed((): boolean => {
  const p = props.row.progress;
  return p !== undefined && p.target !== undefined && p.to >= p.target;
});
const track = computed(() => {
  return progressTrack(props.row.progress);
});
</script>

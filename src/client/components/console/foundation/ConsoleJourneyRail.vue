<template>
  <!-- ONE LIVE FLOW OBJECT. Expanded, compact and terminal are three
       superposed presentations inside one fixed-height viewport; changing
       presentation never replaces the rail root or leaves an empty frame. -->
  <div class="con-jrail"
       :class="[
         'con-jrail--presentation-' + presentation,
         {'con-jrail--committing': committing},
       ]"
       :data-presentation="presentation"
       role="group"
       :aria-label="$t('Stages')">
    <div class="con-jrail__viewport">
      <div class="con-jrail__view con-jrail__view--expanded"
           :aria-hidden="presentation === 'expanded' ? undefined : 'true'">
        <template v-for="(phase, phaseIndex) in phases" :key="phase.id">
          <span v-if="phaseIndex > 0"
                class="con-jrail__bridge"
                :class="{'con-jrail__bridge--passed': phase.state !== 'locked'}"
                aria-hidden="true">
            <i class="con-jrail__bridge-line"></i>
            <i class="con-jrail__bridge-tip"></i>
          </span>
          <section class="con-jrail__phase"
                   :class="[
                     'con-jrail__phase--' + phase.state,
                     'con-jrail__phase--' + phase.mode,
                     {'con-jrail__phase--open': phase.state === 'current' || phase.state === 'waiting'},
                   ]"
                   :data-phase="phase.id"
                   :data-mode="phase.mode">
            <div class="con-jrail__phase-head">
              <!-- A chapter plate, deliberately NOT the step-number grammar.
                   The phase keeps its two-digit campaign ordinal while the
                   inner track uses single figures inside physical nodes. -->
              <span class="con-jrail__phase-index">
                <span class="con-jrail__phase-num">{{ phase.ordinal }}</span>
                <span class="con-jrail__phase-state" aria-hidden="true">{{ phaseMark(phase) }}</span>
              </span>
              <span class="con-jrail__phase-label">{{ $t(phase.label) }}</span>
            </div>

            <!-- Every phase keeps its detailed map mounted. A non-current
                 phase clips that SAME body and leaves only its named chapter
                 head; state never teleports between two trees. -->
            <div class="con-jrail__phase-body"
                 :role="phase.mode === 'tabs' ? 'tablist' : 'list'"
                 :aria-hidden="phase.state === 'current' || phase.state === 'waiting' ? undefined : 'true'">
              <span class="con-jrail__phase-lead" aria-hidden="true">
                <i class="con-jrail__phase-lead-line"></i>
                <i class="con-jrail__phase-lead-tip"></i>
              </span>
              <template v-for="(item, itemIndex) in phase.items" :key="item.id">
                <span v-if="itemIndex > 0"
                      class="con-jrail__connector"
                      :class="'con-jrail__connector--' + connectorState(phase, itemIndex)"
                      aria-hidden="true">
                  <i class="con-jrail__connector-line"></i>
                  <i class="con-jrail__connector-tip"></i>
                </span>
                <span class="con-jrail__item"
                      :class="{
                        'con-jrail__item--current': item.state === 'current',
                        'con-jrail__item--done': item.state === 'completed',
                        'con-jrail__item--available': item.state === 'available',
                        'con-jrail__item--locked': item.state === 'locked',
                        'con-jrail__item--endpoint': isEndpoint(phaseIndex, phase, itemIndex),
                        'con-jrail__item--anticipate': anticipated(phase, item),
                        'con-jrail__item--from-left': anticipated(phase, item) && pulseDir >= 0,
                        'con-jrail__item--from-right': anticipated(phase, item) && pulseDir < 0,
                      }"
                      :data-item="item.id"
                      :role="phase.mode === 'tabs' ? 'tab' : 'listitem'"
                      :aria-selected="phase.mode === 'tabs' ? (item.state === 'current' ? 'true' : 'false') : undefined"
                      :aria-disabled="item.state === 'locked' ? 'true' : undefined">
                  <span class="con-jrail__item-node" aria-hidden="true">
                    <span class="con-jrail__num">{{ itemMark(item, itemIndex) }}</span>
                  </span>
                  <span class="con-jrail__label">{{ $t(item.label) }}</span>
                  <i v-if="anticipated(phase, item)" :key="pulseKey" class="con-jrail__pulse" aria-hidden="true"></i>
                </span>
              </template>
            </div>

          </section>
        </template>
        <!-- The final light pass is scoped to the actual content-sized view,
             not to the wider invisible geometry reserve around it. -->
        <i class="con-jrail__commit-beam" aria-hidden="true"></i>
      </div>

      <div class="con-jrail__view con-jrail__view--compact"
           :aria-hidden="presentation === 'compact' ? undefined : 'true'">
        <span class="con-jrail__compact-index">
          <span class="con-jrail__compact-num">{{ compactContext.ordinal }}</span>
        </span>
        <span class="con-jrail__compact-phase">{{ $t(compactContext.phaseLabel) }}</span>
        <span class="con-jrail__compact-track" aria-hidden="true">
          <i class="con-jrail__compact-line"></i>
          <i class="con-jrail__compact-node"></i>
        </span>
        <span class="con-jrail__compact-swap">
          <transition name="con-jrail-context">
            <span :key="compactContext.itemLabel" class="con-jrail__compact-item">
              {{ $t(compactContext.itemLabel) }}
            </span>
          </transition>
        </span>
      </div>

      <div class="con-jrail__view con-jrail__view--terminal"
           :aria-hidden="presentation === 'complete' ? undefined : 'true'">
        <span class="con-jrail__terminal-lead" aria-hidden="true"></span>
        <span class="con-jrail__terminal-mark" aria-hidden="true"><i>✓</i></span>
        <span class="con-jrail__terminal-label">{{ $t(terminalLabel) }}</span>
        <span class="con-jrail__terminal-cap" aria-hidden="true"></span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

export type JourneyItemState = 'completed' | 'current' | 'available' | 'locked';

export type JourneyItem = {
  id: string,
  /** i18n key. */
  label: string,
  state: JourneyItemState,
};

export type JourneyPhaseState = 'completed' | 'current' | 'waiting' | 'locked';

export type JourneyPhase = {
  id: string,
  /** Stable, already formatted phase ordinal (for example `01`). */
  ordinal: string,
  /** i18n key. */
  label: string,
  state: JourneyPhaseState,
  /** Editable navigation and irreversible progress intentionally keep their
   *  different semantics while sharing one visual language. */
  mode: 'tabs' | 'progress',
  items: ReadonlyArray<JourneyItem>,
};

export type JourneyCompactContext = {
  ordinal: string,
  /** i18n keys owned by the host flow. */
  phaseLabel: string,
  itemLabel: string,
};

export type JourneyPresentation = 'expanded' | 'compact' | 'complete';

/**
 * Pure flow presentation. The host owns business state and supplies two or
 * more phases plus the compact parent context; the shared WorkspaceHeader
 * supplies only the stable root-aligned berth. No item is focusable here. A reversible
 * host may expose navigation through its existing controller contract, while
 * a progress phase remains an inert readout by construction.
 */
export default defineComponent({
  name: 'ConsoleJourneyRail',
  props: {
    phases: {type: Array as PropType<ReadonlyArray<JourneyPhase>>, required: true},
    presentation: {type: String as PropType<JourneyPresentation>, default: 'expanded'},
    compactContext: {
      type: Object as PropType<JourneyCompactContext>,
      default: () => ({ordinal: '', phaseLabel: '', itemLabel: ''}),
    },
    terminalLabel: {type: String, default: 'Ready'},
    /** Final all-phase commit is running (presentation-only accent). */
    committing: {type: Boolean, default: false},
    /** The item the player ASKED for while its physical stage transition is
     *  still running. Its label/state stay unchanged; only a light impulse
     *  acknowledges direction. */
    pendingItemId: {type: String, default: ''},
    pulseKey: {type: Number, default: 0},
    pulseDir: {type: Number, default: 0},
  },
  methods: {
    anticipated(phase: JourneyPhase, item: JourneyItem): boolean {
      return phase.state === 'current' && item.id === this.pendingItemId;
    },
    itemMark(item: JourneyItem, index: number): string {
      if (item.state === 'completed') {
        return '\u2713';
      }
      return String(index + 1);
    },
    /** The last node of the last chapter is a terminal endpoint, not another
     *  category. This stays generic: the presentation knows only topology,
     *  never Start Game item ids or rules. */
    isEndpoint(phaseIndex: number, phase: JourneyPhase, itemIndex: number): boolean {
      return phaseIndex === this.phases.length - 1 && itemIndex === phase.items.length - 1;
    },
    connectorState(phase: JourneyPhase, itemIndex: number): JourneyItemState {
      const previous = phase.items[itemIndex - 1];
      const next = phase.items[itemIndex];
      if (previous?.state === 'completed' && next?.state === 'completed') {
        return 'completed';
      }
      if (next?.state === 'current') {
        return 'current';
      }
      return next?.state ?? 'locked';
    },
    phaseMark(phase: JourneyPhase): string {
      switch (phase.state) {
      case 'completed': return '\u2713';
      case 'current': return '';
      case 'waiting': return '\u2026';
      case 'locked': return '';
      }
    },
  },
});
</script>

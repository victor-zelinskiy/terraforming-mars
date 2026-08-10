<template>
  <!-- The workspace's PERSISTENT chrome. It is never rebuilt between stages:
       the identity line stays in the DOM and GROWS a tail, and everything that
       differs between browse and flow lives as two layers of ONE fixed-height
       zone that crossfade in place. Nothing is `v-if`'d out of the FLOW, so the
       header can neither blink nor change height under an entering animation —
       the stage below always assembles in the geometry the browse layer was
       measured in. -->
  <header class="con-wshead" :class="{'con-wshead--deep': deep, 'con-wshead--flow': $slots.flow !== undefined}">
    <div class="con-wshead__ident">
      <span v-if="emblem !== undefined" class="con-wshead__emblem"
            :data-wheel-anchor="wheelAnchor" aria-hidden="true">
        <BarButtonIcon :name="emblem" />
      </span>
      <span v-else-if="mark !== ''" class="con-wshead__mark" aria-hidden="true">{{ mark }}</span>
      <span class="con-wshead__root">{{ $t(root) }}</span>
      <!-- A FIXED second root segment (a repeat's source card): part of the
           parent anchor, not of any stage — it never animates on a stage swap. -->
      <template v-if="context !== ''">
        <span class="con-wshead__sep" aria-hidden="true">›</span>
        <span class="con-wshead__context">{{ $t(context) }}</span>
      </template>
    </div>

    <!-- ── The AUX ZONE — ONE region, two stacked layers. Only the BROWSE layer
         (the host's filters / counts, via the default slot) is in the FLOW: it
         alone decides the zone's width and height, so both are identical in
         both stages. The DEEP layer (the breadcrumb tail) lies over it — which
         is why a long card name can never push the header taller. They
         crossfade; neither is ever removed. ── -->
    <div class="con-wshead__aux">
      <div class="con-wshead__layer con-wshead__layer--browse"
           :class="{'con-wshead__layer--out': deep}"
           :aria-hidden="deep ? 'true' : undefined">
        <slot />
      </div>
      <div class="con-wshead__layer con-wshead__layer--deep"
           :class="{'con-wshead__layer--out': !deep}"
           :aria-hidden="deep ? undefined : 'true'">
        <template v-if="deep">
          <span class="con-wshead__sep" aria-hidden="true">›</span>
          <!-- STABLE CONTEXT BEFORE MUTABLE STAGE (consoleWorkspaceHeader):
                 КАРТЫ В РУКЕ › ЦЕНТР ИИ › РОЗЫГРЫШ
               The SUBJECT is the anchor of the whole flow and stands FIXED;
               only the tail changes. -->
          <span class="con-wshead__swap">
            <transition name="con-wshead-swap">
              <span class="con-wshead__subject" :key="subjectText">{{ subjectLabel }}</span>
            </transition>
          </span>
          <template v-if="stageText !== ''">
            <span class="con-wshead__sep" aria-hidden="true">›</span>
            <!-- The STAGE — the ONLY animating segment. Crossfade, never
                 `mode="out-in"`: out-in empties the slot between the two words,
                 and that gap is a visible blink on the one line whose whole job
                 is to prove the flow never broke. Both words share ONE grid
                 cell sized to the wider of them, so nothing beside them shifts
                 mid-swap. -->
            <span class="con-wshead__swap">
              <transition name="con-wshead-swap">
                <span class="con-wshead__step"
                      :class="{'con-wshead__step--committed': committed}"
                      :key="stageText">{{ $t(stageText) }}</span>
              </transition>
            </span>
          </template>
          <span class="con-wshead__tail"><slot name="deep" /></span>
        </template>
      </div>
    </div>

    <!-- `display: contents` preserves the original one-line contract for
         ordinary workspaces. A flow-enabled header promotes the same slot to
         the first row's stable META region without asking hosts to change
         their counters/status markup. -->
    <div v-if="$slots.trailing" class="con-wshead__trailing">
      <slot name="trailing" />
    </div>

    <!-- A workspace-owned FLOW presentation. The header owns only its
         permanent second-tier geometry; the host owns the model, phase and
         interaction semantics. The connector is presentation-only: it grows
         from the stable ROOT marker and hands the line to the slotted rail.
         It never follows the mutable subject/stage tail. -->
    <div v-if="$slots.flow" class="con-wshead__flow">
      <span class="con-wshead__flow-connector" aria-hidden="true">
        <i class="con-wshead__flow-stem"></i>
        <i class="con-wshead__flow-turn"></i>
        <i class="con-wshead__flow-run"></i>
      </span>
      <slot name="flow" />
    </div>
  </header>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import {buildWorkspaceHeader, WorkspaceHeaderModel} from '@/client/console/consoleWorkspaceHeader';
import {translateText} from '@/client/directives/i18n';

/**
 * @console-shared LIVE — console native stands on this file.
 *
 * THE WORKSPACE HEADER — one component for every console workspace.
 *
 * Two screens had already grown the same header twice, in two class trees, at
 * two type scales: «ДЕЙСТВИЯ КАРТ» carried an identity emblem, a three-voice
 * breadcrumb and a fixed-height aux zone, while «КАРТЫ В РУКЕ» carried a plain
 * 1.05rem title and its filters pinned to the far right. The player reads that
 * as two different products, and every past divergence in this fork's console
 * (stage title tier, kicker placement, head height) was a MARKUP divergence,
 * not a style one — a shared class set would have drifted again the first time
 * one host needed a wrapper.
 *
 * So this owns the whole line, and the model behind it is the pure
 * `consoleWorkspaceHeader.buildWorkspaceHeader` grammar: STABLE CONTEXT BEFORE
 * MUTABLE STAGE, the tail is the only thing that ever animates.
 *
 * The HOST still owns two things, and only two:
 *  · what fills the browse layer of the aux zone (its own filters / counts) —
 *    the default slot. That content is genuinely per-screen and pretending
 *    otherwise would produce a props soup nobody can read;
 *  · the outer element's identity, which arrives as a fall-through class.
 * A host may additionally publish one presentation-only `flow` slot. The
 * header gives it a stable second tier rooted at the identity marker, but
 * deliberately knows nothing about that flow's business state (Start Game is
 * the first consumer).
 *
 * Height is RESERVED by the browse layer, never content-driven: the deep layer
 * is an absolute overlay, so a card name of any length costs zero layout and
 * the stage below always assembles in the geometry it was measured in.
 */
export default defineComponent({
  name: 'ConsoleWsHead',
  components: {BarButtonIcon},
  props: {
    /** The workspace's own name (i18n key) — the crumb's ROOT, never changes. */
    root: {type: String, required: true},
    /** The identity symbol: a `BarButtonIcon` name (the same glyph the action
     *  wheel's tile carries). Part of the PARENT anchor — constant box, size,
     *  position and gap through every stage, never re-animated by a stage
     *  change. */
    emblem: {type: String as PropType<string | undefined>, default: undefined},
    /** `data-wheel-anchor` id, when this emblem is a wheel flight's landing
     *  anchor. Omitted → the emblem is decorative and the wheel handoff (which
     *  may target something else entirely, e.g. the hand dock) is untouched. */
    wheelAnchor: {type: String as PropType<string | undefined>, default: undefined},
    /** A text glyph instead of an emblem (the repeat-mode ⟳). */
    mark: {type: String, default: ''},
    /** A FIXED extra root segment (a repeat's source card) — never animated. */
    context: {type: String, default: ''},
    /** The object under work (a card name — an i18n key unless `subjectRaw`). */
    subject: {type: String, default: ''},
    /** `subject` is a proper noun already in the player's language. */
    subjectRaw: {type: Boolean, default: false},
    /** The current step (i18n key) — the ONLY animating segment. */
    stage: {type: String, default: ''},
    /** Past the commit boundary: the stage marker goes amber (a committed
     *  stage is a statement, not an invitation). */
    committed: {type: Boolean, default: false},
  },
  computed: {
    /** The pure model — the single grammar both workspaces are built on. */
    model(): WorkspaceHeaderModel {
      return buildWorkspaceHeader({
        root: this.root,
        subject: this.subject === '' ? undefined : {text: this.subject, translate: !this.subjectRaw},
        stage: this.stage === '' ? undefined : this.stage,
        committed: this.committed,
      });
    },
    /** The crumb has a tail: the workspace has been DESCENDED into. */
    deep(): boolean {
      return this.subject !== '';
    },
    subjectText(): string {
      return this.model.segments.find((s) => s.role === 'subject')?.text ?? '';
    },
    subjectLabel(): string {
      const seg = this.model.segments.find((s) => s.role === 'subject');
      if (seg === undefined) {
        return '';
      }
      return seg.translate ? translateText(seg.text) : seg.text;
    },
    stageText(): string {
      return this.model.stageKey;
    },
  },
});
</script>

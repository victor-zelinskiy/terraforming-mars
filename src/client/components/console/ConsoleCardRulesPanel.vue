<template>
  <div class="con-zoom-rules-host" :class="{'con-zoom-rules-host--closing': closing, 'con-zoom-rules-host--embedded': embedded}">
    <aside class="con-zoom-rules" :class="'con-zoom-rules--' + lengthTier" aria-label="Rules">
      <!-- The head is HIDDEN when embedded in the inspect dossier — the
           dossier's own ПРАВИЛА/СТАТИСТИКА tab bar replaces it. -->
      <div v-if="!embedded" class="con-zoom-rules__head">
        <span class="con-zoom-rules__mark" aria-hidden="true">§</span>
        <span class="con-zoom-rules__title">{{ $t('Rules') }}</span>
      </div>
      <ConsoleScrollArea class="con-zoom-rules__scroll" axis="y">
        <div class="con-zoom-rules__body">
          <section v-for="group in orderedAnnotations" :key="group.id"
                   class="con-zoom-rules__group"
                   :class="'con-zoom-rules__group--' + group.kind">
            <span class="con-zoom-rules__kind">
              <span v-if="group.special" class="con-zoom-rules__spark" aria-hidden="true">✱</span>
              {{ $t(group.labelKey) }}
            </span>
            <p v-for="row in group.rows" :key="row.id" class="con-zoom-rules__text">{{ rowText(row.text) }}</p>
          </section>
        </div>
      </ConsoleScrollArea>
    </aside>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE fullscreen-card RULES PANEL (docs/CONSOLE_TV_PREMIUM_PLAN.md Этап 1-R2
 * + the perfection pass) — the stable right-hand rules surface of the
 * console card viewer. A projection of the build-time Card Information
 * Model via the SAME annotationModel the desktop floating callouts use
 * (one content source, no drift).
 *
 * READING ORDER = THE CARD'S ORDER: blocks are sorted by the vertical
 * position of their linked graphic row on the LANDED card (data-graphic-id
 * anchors, measured on `nonce`), so the panel always reads top-to-bottom
 * exactly like the card. Cards without measurable anchors fall back to the
 * canonical card order: requirement → action → effect → on-play → VP → note.
 *
 * LINKAGE = COLOUR: each block's kind chip carries the EXACT accent of its
 * card element (requirement copper / effect blue / action gold / on-play
 * mint / VP prestige) — the connection is READ, not drawn. The earlier
 * schematic leader lines were removed once the colour link landed (they
 * were redundant chrome). `closing` hides the panel instantly so it never
 * lags the departing card.
 */
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {getCard} from '@/client/cards/ClientCardManifest';
import {buildCardAnnotations, CardAnnotation, CardAnnotationRow} from '@/client/components/cardAnnotations/annotationModel';
import {actionRuleText} from '@/client/components/actions/actionDescription';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';

/** Does this card carry any structured rules to show? (The shell gates the
 *  side slot — and the viewer's width reservation — on this.) */
export function cardHasRules(cardName: string | undefined): boolean {
  if (cardName === undefined) {
    return false;
  }
  const card = getCard(cardName as CardName);
  return card !== undefined && buildCardAnnotations(card).length > 0;
}

/** The reading order used when blocks carry no measurable graphic anchors
 *  (corporations): requirements bar → action frames → effect frames → the
 *  bottom on-play «при розыгрыше» zone → the VP badge → fine print. Mirrors
 *  the reordered card face (mechanicsModel.orderMechGroups). */
const PHYSICAL_KIND_ORDER: ReadonlyArray<CardAnnotation['kind']> =
  ['requirement', 'action', 'effect', 'immediate', 'victory-points', 'note'];

const STAGE_SELECTOR = '.con-zoom .card-zoom-stage';

function cssEscapeId(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape !== undefined ? CSS.escape(value) : value.replace(/"/g, '\\"');
}

export default defineComponent({
  name: 'ConsoleCardRulesPanel',
  components: {ConsoleScrollArea},
  props: {
    cardName: {type: String as PropType<CardName>, required: true},
    /** The viewer's settle signal: bumps when the card has LANDED (open
     *  settled / browse slide finished). The card-order measure runs then. */
    nonce: {type: Number, default: 0},
    /** The close flight began — hide instantly (never lag the card). */
    closing: {type: Boolean, default: false},
    /** Embedded in the inspect DOSSIER (a ПРАВИЛА tab): drop the own glass
     *  chrome + head — the dossier box + tab bar own them. Default false keeps
     *  the standalone rules panel (journal / source-chip inspect) unchanged. */
    embedded: {type: Boolean, default: false},
  },
  data() {
    return {
      /** Anchor-measured order (annotation ids); undefined until measured. */
      measuredOrder: undefined as ReadonlyArray<string> | undefined,
    };
  },
  computed: {
    annotations(): Array<CardAnnotation> {
      const card = getCard(this.cardName);
      return card === undefined ? [] : buildCardAnnotations(card);
    },
    /** Physical-order fallback (stable within a kind: model order). */
    fallbackOrdered(): Array<CardAnnotation> {
      return [...this.annotations].sort((a, b) => {
        const ka = PHYSICAL_KIND_ORDER.indexOf(a.kind);
        const kb = PHYSICAL_KIND_ORDER.indexOf(b.kind);
        return ka !== kb ? ka - kb : a.order - b.order;
      });
    },
    orderedAnnotations(): Array<CardAnnotation> {
      if (this.measuredOrder === undefined) {
        return this.fallbackOrdered;
      }
      const rank = new Map(this.measuredOrder.map((id, i) => [id, i]));
      return [...this.annotations].sort((a, b) =>
        (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
    },
    /** READING TIER from the LOCALIZED text volume (the couch-typography
     *  length modes — console.less § READING SURFACE): a one-liner reads
     *  roomier, the longest RU rules step down to the reading floor and
     *  gain hyphenation. Measured on what actually renders (post-i18n),
     *  because RU runs ~15–20% longer than the English keys. */
    lengthTier(): 'brief' | 'regular' | 'dense' {
      let total = 0;
      for (const group of this.annotations) {
        for (const row of group.rows) {
          total += actionRuleText(row.text).length;
        }
      }
      return total <= 90 ? 'brief' : total <= 240 ? 'regular' : 'dense';
    },
  },
  watch: {
    nonce() {
      this.scheduleMeasure();
    },
    cardName() {
      // A browse step re-points the panel BEFORE the slide settles: drop the
      // stale order immediately (falls back), the landed card re-measures.
      this.measuredOrder = undefined;
    },
  },
  mounted() {
    this.scheduleMeasure();
  },
  methods: {
    /** The SHARED rule-text formatter (translate → strip the co-located
     *  kind prefix → read as a sentence). The action workspace shows the
     *  same texts, so the wording lives in ONE place — see
     *  components/actions/actionDescription.ts. */
    rowText(key: CardAnnotationRow['text']): string {
      return actionRuleText(key);
    },
    /** Resolve an annotation's ROW element (mirrors CardAnnotationsLayer.rowEl
     *  incl. the documented special-id fallbacks). */
    anchorEl(stage: HTMLElement, graphicId: string | undefined): HTMLElement | null {
      if (graphicId === undefined) {
        return null;
      }
      const exact = stage.querySelector<HTMLElement>(`[data-graphic-id="${cssEscapeId(graphicId)}"]`);
      if (exact !== null) {
        return exact;
      }
      if (graphicId.startsWith('req:')) {
        return stage.querySelector<HTMLElement>('.pcard__reqs');
      }
      if (graphicId === 'vp') {
        return stage.querySelector<HTMLElement>('.pcard__vp');
      }
      if (graphicId === 'tags') {
        return stage.querySelector<HTMLElement>('.pcard__tags');
      }
      return stage.querySelector<HTMLElement>('.pcard__mech');
    },
    scheduleMeasure(): void {
      // Two rAFs: the landed card's zoom/layout must be committed before
      // rects are read (the settle nonce fires right at landing).
      requestAnimationFrame(() => requestAnimationFrame(() => this.measure()));
    },
    measure(): void {
      if (this.closing) {
        return;
      }
      const stage = document.querySelector<HTMLElement>(STAGE_SELECTOR);
      const host = this.$el as HTMLElement | undefined;
      if (stage === null || host === undefined || !host.isConnected) {
        return;
      }
      // The CARD order: sort anchored blocks by their row's Y on the card.
      const rowY = new Map<string, number>();
      for (const a of this.annotations) {
        const el = this.anchorEl(stage, a.graphicId);
        if (el !== null) {
          const r = el.getBoundingClientRect();
          if (r.height > 0) {
            rowY.set(a.id, r.top + r.height / 2);
          }
        }
      }
      const fallbackRank = new Map(this.fallbackOrdered.map((a, i) => [a.id, i]));
      this.measuredOrder = [...this.annotations]
        .sort((a, b) => {
          const ya = rowY.get(a.id);
          const yb = rowY.get(b.id);
          if (ya !== undefined && yb !== undefined && Math.abs(ya - yb) > 1) {
            return ya - yb;
          }
          if (ya !== undefined && yb === undefined) {
            return -1;
          }
          if (ya === undefined && yb !== undefined) {
            return 1;
          }
          return (fallbackRank.get(a.id) ?? 0) - (fallbackRank.get(b.id) ?? 0);
        })
        .map((a) => a.id);
    },
  },
});
</script>

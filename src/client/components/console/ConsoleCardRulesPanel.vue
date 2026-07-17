<template>
  <div class="con-zoom-rules-host" :class="{'con-zoom-rules-host--closing': closing}">
    <!-- Schematic LEADERS (variant B of the linkage design): one thin
         hairline per anchored block, from a node dot on the card's right
         edge (at the linked row's height) to the block's kind chip. Drawn
         in the GAP between the stage card and the panel (the console
         viewer hides the desktop nav arrows, so the gap is clean).
         Measured on `nonce` (the card LANDED) — never mid-flight. -->
    <svg v-if="links.length > 0"
         class="con-zoom-rules__links"
         :style="{left: -gapW + 'px', width: gapW + 'px', height: panelH + 'px'}"
         :viewBox="'0 0 ' + gapW + ' ' + panelH"
         aria-hidden="true">
      <g v-for="link in links" :key="link.id"
         class="con-zoom-rules__link"
         :class="'con-zoom-rules__link--' + link.kind">
        <circle :cx="5" :cy="link.y1" r="4.5" class="con-zoom-rules__node" />
        <line :x1="10" :y1="link.y1" :x2="gapW" :y2="link.y2" class="con-zoom-rules__wire" />
      </g>
    </svg>

    <aside class="con-zoom-rules" aria-label="Card rules">
      <div class="con-zoom-rules__head">
        <span class="con-zoom-rules__mark" aria-hidden="true">§</span>
        <span class="con-zoom-rules__title">{{ $t('Card rules') }}</span>
      </div>
      <ConsoleScrollArea class="con-zoom-rules__scroll" axis="y">
        <div class="con-zoom-rules__body">
          <section v-for="group in orderedAnnotations" :key="group.id"
                   :ref="(el) => setBlockRef(group.id, el)"
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
 * CONSOLE fullscreen-card RULES PANEL (CONSOLE_TV_PREMIUM_PLAN.md Этап 1-R2
 * + the perfection pass) — the stable right-hand rules surface of the
 * console card viewer. A projection of the build-time Card Information
 * Model via the SAME annotationModel the desktop floating callouts use
 * (one content source, no drift).
 *
 * READING ORDER = THE CARD'S ORDER: blocks are sorted by the vertical
 * position of their linked graphic row on the LANDED card (data-graphic-id
 * anchors, measured on `nonce`), so the panel always reads top-to-bottom
 * exactly like the card. Cards without anchors (corporations — their rows
 * carry no graphicIds) fall back to the PHYSICAL card order: requirement →
 * on-play (start resources) → effect → action → VP → note — which fixes
 * the Polyphemos-class inversion (effect above the starting resources).
 *
 * LINKAGE: anchored blocks draw a schematic leader (node dot on the card
 * edge + hairline to the block chip) — the blueprint-HUD language; the
 * card face itself is never painted over. `closing` (the viewer's close
 * flight began) hides the whole host in ~90ms so the panel can never lag
 * behind the departing card.
 */
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {getCard} from '@/client/cards/ClientCardManifest';
import {buildCardAnnotations, stripKindPrefix, CardAnnotation, CardAnnotationRow} from '@/client/components/cardAnnotations/annotationModel';
import {translateText} from '@/client/directives/i18n';
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

/** The PHYSICAL reading order of a printed card, used when blocks carry no
 *  graphic anchors (corporations): requirements bar → start/on-play row →
 *  effect frames → action frames → the VP badge → fine print. */
const PHYSICAL_KIND_ORDER: ReadonlyArray<CardAnnotation['kind']> =
  ['requirement', 'immediate', 'effect', 'action', 'victory-points', 'note'];

const STAGE_SELECTOR = '.con-zoom .card-zoom-stage';
const STAGE_CARD_SELECTOR = ':is(.card-container.filterDiv, .pcard, .mb-face)';

function cssEscapeId(value: string): string {
  return typeof CSS !== 'undefined' && CSS.escape !== undefined ? CSS.escape(value) : value.replace(/"/g, '\\"');
}

type Link = {id: string, kind: CardAnnotation['kind'], y1: number, y2: number};

export default defineComponent({
  name: 'ConsoleCardRulesPanel',
  components: {ConsoleScrollArea},
  props: {
    cardName: {type: String as PropType<CardName>, required: true},
    /** The viewer's settle signal: bumps when the card has LANDED (open
     *  settled / browse slide finished). Leaders measure only then. */
    nonce: {type: Number, default: 0},
    /** The close flight began — hide instantly (never lag the card). */
    closing: {type: Boolean, default: false},
  },
  data() {
    return {
      /** Anchor-measured order (annotation ids); undefined until measured. */
      measuredOrder: undefined as ReadonlyArray<string> | undefined,
      links: [] as Array<Link>,
      gapW: 0,
      panelH: 0,
      blockEls: new Map<string, HTMLElement>(),
      onResize: undefined as (() => void) | undefined,
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
  },
  watch: {
    nonce() {
      this.scheduleMeasure();
    },
    cardName() {
      // A browse step re-points the panel BEFORE the slide settles: drop the
      // stale geometry immediately (order falls back, leaders hide) — the
      // landed card re-measures via the next nonce bump.
      this.measuredOrder = undefined;
      this.links = [];
    },
    closing(now: boolean) {
      if (now) {
        this.links = [];
      }
    },
  },
  mounted() {
    this.onResize = () => this.scheduleMeasure();
    window.addEventListener('resize', this.onResize);
    this.scheduleMeasure();
  },
  beforeUnmount() {
    if (this.onResize !== undefined) {
      window.removeEventListener('resize', this.onResize);
    }
  },
  methods: {
    rowText(key: CardAnnotationRow['text']): string {
      return stripKindPrefix(translateText(key));
    },
    setBlockRef(id: string, el: unknown): void {
      if (el instanceof HTMLElement) {
        this.blockEls.set(id, el);
      } else {
        this.blockEls.delete(id);
      }
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
      requestAnimationFrame(() => requestAnimationFrame(() => void this.measure()));
    },
    async measure(): Promise<void> {
      if (this.closing) {
        return;
      }
      const stage = document.querySelector<HTMLElement>(STAGE_SELECTOR);
      const host = this.$el as HTMLElement | undefined;
      if (stage === null || host === undefined || !host.isConnected) {
        return;
      }
      // Phase 1 — the CARD order: sort anchored blocks by their row's Y.
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
      // Phase 2 — the leaders: card right edge → each block's kind chip.
      await this.$nextTick();
      const cardEl = stage.querySelector<HTMLElement>(STAGE_CARD_SELECTOR);
      const panel = host.querySelector<HTMLElement>('.con-zoom-rules');
      if (cardEl === null || panel === null) {
        this.links = [];
        return;
      }
      const cardRect = cardEl.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      const gap = Math.round(panelRect.left - cardRect.right);
      if (gap < 24) {
        this.links = []; // no clean channel (stacked layout) — skip leaders
        return;
      }
      const links: Array<Link> = [];
      for (const a of this.annotations) {
        const y = rowY.get(a.id);
        const block = this.blockEls.get(a.id);
        if (y === undefined || block === undefined) {
          continue;
        }
        const chip = block.querySelector<HTMLElement>('.con-zoom-rules__kind') ?? block;
        const chipRect = chip.getBoundingClientRect();
        const y1 = y - panelRect.top;
        const y2 = chipRect.top + chipRect.height / 2 - panelRect.top;
        if (y1 < -8 || y1 > panelRect.height + 8) {
          continue; // row outside the panel band (extreme layouts) — skip
        }
        links.push({id: a.id, kind: a.kind, y1: Math.round(y1), y2: Math.round(y2)});
      }
      this.gapW = gap;
      this.panelH = Math.round(panelRect.height);
      this.links = links;
    },
  },
});
</script>

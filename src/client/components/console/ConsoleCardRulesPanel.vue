<template>
  <div ref="root" class="con-zoom-rules-host" :class="{'con-zoom-rules-host--closing': closing, 'con-zoom-rules-host--embedded': embedded}">
    <aside class="con-zoom-rules" :class="'con-zoom-rules--' + lengthTier" aria-label="Rules">
      <!-- The head is HIDDEN when embedded in the inspect dossier — the
           dossier's own ПРАВИЛА/СТАТИСТИКА tab bar replaces it. -->
      <div v-if="!embedded" class="con-zoom-rules__head">
        <span class="con-zoom-rules__mark" aria-hidden="true">§</span>
        <span class="con-zoom-rules__title">{{ $t('Rules') }}</span>
      </div>
      <ConsoleScrollArea ref="scroll" class="con-zoom-rules__scroll" axis="y"
                         @overflow-change="onOverflow">
        <div class="con-zoom-rules__body" data-zoom-flank-content>
          <section v-for="group in orderedAnnotations" :key="group.id"
                   class="con-zoom-rules__group"
                   :class="'con-zoom-rules__group--' + group.kind"
                   :data-rules-group="group.id">
            <span class="con-zoom-rules__kind">
              <span v-if="group.special" class="con-zoom-rules__spark" aria-hidden="true">✱</span>
              {{ $t(group.labelKey) }}
            </span>
            <p v-for="row in group.rows" :key="row.id" class="con-zoom-rules__text">{{ rowText(row) }}</p>
            <!-- A host's LIVE reading of this very group (the bot's dividend ledger under its printed box) —
                 inside the group, so it reads, scrolls and fits with the rule it explains. -->
            <slot name="group-extra" :group="group" :tier="lengthTier" />
          </section>
        </div>
      </ConsoleScrollArea>
    </aside>
  </div>
</template>

<script setup lang="ts">
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
import {computed, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardAnnotation, CardAnnotationRow} from '@/client/components/cardAnnotations/annotationModel';
import {cardRuleAnnotations, RulesLengthTier, rulesLengthTier, steppedRulesTier} from '@/client/components/console/consoleCardRules';
import {probeTick} from '@/client/console/probeTick';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {actionRuleText} from '@/client/components/actions/actionDescription';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import {$t} from '@/client/directives/i18n';

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

defineOptions({name: 'ConsoleCardRulesPanel'});
const props = defineProps({
  /** The manifest card whose Card-Information blocks feed the panel.
   *  Optional when `annotationsOverride` supplies the groups directly. */
  cardName: {type: String as PropType<CardName | undefined>, default: undefined},
  /**
   * EXTERNALLY-BUILT annotation groups — the ONE sanctioned entry for rules
   * that are not a manifest card's information model (the MarsBot
   * corporations: `marsBotCorpRules.ts` shapes their printed boxes into the
   * same groups). Rendering, ordering, tiers and scroll are byte-identical.
   */
  annotationsOverride: {type: Array as PropType<ReadonlyArray<CardAnnotation> | undefined>, default: undefined},
  /** The viewer's settle signal: bumps when the card has LANDED (open
   *  settled / browse slide finished). The card-order measure runs then. */
  nonce: {type: Number, default: 0},
  /** The close flight began — hide instantly (never lag the card). */
  closing: {type: Boolean, default: false},
  /** Embedded in the inspect DOSSIER (a ПРАВИЛА tab): drop the own glass
   *  chrome + head — the dossier box + tab bar own them. Default false keeps
   *  the standalone rules panel (journal / source-chip inspect) unchanged. */
  embedded: {type: Boolean, default: false},
  /**
   * Rules blocks the AVAILABILITY panel beside this one already states in
   * full (`CardAvailabilityView.coveredRequirementIds`) — hidden here so a
   * requirement is never printed twice. Default empty: every other host
   * (journal, dossier, draft) shows the complete rules.
   */
  suppressIds: {type: Array as PropType<ReadonlyArray<string>>, default: () => []},
  /**
   * Read the blocks in the ORDER THEY WERE GIVEN (`CardAnnotation.order`),
   * never re-sorted by kind or by a measured anchor. For an externally built
   * reading whose order IS its meaning — a party's standing effect before
   * its action, exactly as the printed formula above draws them; a
   * resolution's own effect before its quest. Default false keeps the card
   * panel's card-order reading.
   */
  keepOrder: {type: Boolean, default: false},
  /**
   * The reading TIER, decided by the host for a scene of SEVERAL panels (the
   * resolution inspector's party column and rules column read at ONE type
   * size — the denser of the two). Undefined: the panel's own tier.
   */
  tier: {type: String as PropType<RulesLengthTier | undefined>, default: undefined},
});

const flow = useFlowScope('card-rules-panel');
const scroll = useTemplateRef<{overflowing?: boolean} & {scrollByPx?: (dy: number) => void}>('scroll');
const root = useTemplateRef<HTMLElement>('root');
/** Anchor-measured order (annotation ids); undefined until measured. */
const measuredOrder = ref<ReadonlyArray<string> | undefined>(undefined);
/**
 * The BODY needs a scroll right now — true only when the side column
 * genuinely could not give this panel its full height (a very long
 * rules set beside an availability panel). The scroll area draws its
 * own progress rail; the host reads this to route the right stick.
 */
const overflowing = ref(false);
/** Rungs stepped DENSER than the length tier because the body overflowed (`steppedRulesTier`). */
const fitSteps = ref(0);

const annotations = computed((): Array<CardAnnotation> => {
  if (props.annotationsOverride !== undefined) {
    return [...props.annotationsOverride];
  }
  if (props.cardName === undefined) {
    return [];
  }
  return cardRuleAnnotations(props.cardName, props.suppressIds);
});
/** Physical-order fallback (stable within a kind: model order). */
const fallbackOrdered = computed((): Array<CardAnnotation> => {
  return [...annotations.value].sort((a, b) => {
    const ka = PHYSICAL_KIND_ORDER.indexOf(a.kind);
    const kb = PHYSICAL_KIND_ORDER.indexOf(b.kind);
    return ka !== kb ? ka - kb : a.order - b.order;
  });
});
const orderedAnnotations = computed((): Array<CardAnnotation> => {
  if (props.keepOrder) {
    return [...annotations.value].sort((a, b) => a.order - b.order);
  }
  if (measuredOrder.value === undefined) {
    return fallbackOrdered.value;
  }
  const rank = new Map(measuredOrder.value.map((id, i) => [id, i]));
  return [...annotations.value].sort((a, b) =>
    (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER));
});
/** READING TIER from the LOCALIZED text volume (the couch-typography
 *  length modes — console.less § READING SURFACE): a one-liner reads
 *  roomier, the longest RU rules step down to the reading floor and
 *  gain hyphenation. Measured on what actually renders (post-i18n),
 *  because RU runs ~15–20% longer than the English keys. */
const baseTier = computed((): RulesLengthTier => {
  return props.tier ?? rulesLengthTier(annotations.value);
});
/** …stepped denser while the body still overflows its room (the measured half of the ladder). */
const lengthTier = computed((): RulesLengthTier => {
  return steppedRulesTier(baseTier.value, fitSteps.value);
});
/** What the fit steps were measured FOR — a new reading starts from its own length tier again. */
const fitKey = computed((): string => {
  return `${baseTier.value}|${annotations.value.map((a) => `${a.id}:${a.rows.length}`).join(',')}`;
});

/** The scroll area's own verdict: an overflow first steps the reading DENSER, and only the last rung scrolls. */
function onOverflow(overflowingNow: boolean): void {
  overflowing.value = overflowingNow;
  if (overflowingNow) {
    fitDenser();
  }
}
function fitDenser(): void {
  if (lengthTier.value !== 'packed') {
    fitSteps.value++;
  }
}
/** The SHARED rule-text formatter (translate → strip the co-located
 *  kind prefix → read as a sentence). The action workspace shows the
 *  same texts, so the wording lives in ONE place — see
 *  components/actions/actionDescription.ts. */
function rowText(row: CardAnnotationRow): string {
  // A parameterised row (the parliament panels name a resolution, a
  // player, a count) interpolates its display strings first — the key is
  // then read as a sentence exactly like every other row.
  if (row.params !== undefined && row.params.length > 0) {
    return actionRuleText(row.text, [...row.params]);
  }
  return actionRuleText(row.text);
}
/**
 * Right-stick paging of the rules BODY, routed by the shell's zoom intent
 * handler. Returns false when there is nothing to scroll, so the caller
 * can keep swallowing the stick as it always did instead of pretending a
 * journey the player cannot make.
 */
function scrollBody(delta: number): boolean {
  if (!overflowing.value) {
    return false;
  }
  const area = scroll.value ?? undefined;
  area?.scrollByPx?.(delta);
  return true;
}
/** Resolve an annotation's ROW element (mirrors CardAnnotationsLayer.rowEl
 *  incl. the documented special-id fallbacks). */
function anchorEl(stage: HTMLElement, graphicId: string | undefined): HTMLElement | null {
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
}
function scheduleMeasure(): void {
  // Two rAFs: the landed card's zoom/layout must be committed before
  // rects are read (the settle nonce fires right at landing).
  flow.afterFrame('the landed card\'s layout commits before the rules measure', () => measure(), 2);
}
function measure(): void {
  if (props.closing) {
    return;
  }
  const stage = document.querySelector<HTMLElement>(STAGE_SELECTOR);
  const host = root.value ?? undefined;
  if (stage === null || host === undefined || !host.isConnected) {
    return;
  }
  // The CARD order: sort anchored blocks by their row's Y on the card.
  const rowY = new Map<string, number>();
  for (const a of annotations.value) {
    const el = anchorEl(stage, a.graphicId);
    if (el !== null) {
      const r = el.getBoundingClientRect();
      if (r.height > 0) {
        rowY.set(a.id, r.top + r.height / 2);
      }
    }
  }
  const fallbackRank = new Map(fallbackOrdered.value.map((a, i) => [a.id, i]));
  measuredOrder.value = [...annotations.value]
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
}

watch(() => fitKey.value, () => {
  fitSteps.value = 0;
  // The scroll area reports only a CHANGE of its overflow, so a reading that overflows exactly like the
  // one before it would never be heard: re-ask once the new body has been measured.
  probeTick(() => probeTick(() => {
    const area = scroll.value ?? undefined;
    if (area?.overflowing === true) {
      fitDenser();
    }
  }));
});
watch(() => props.nonce, () => {
  scheduleMeasure();
});
watch(() => props.cardName, () => {
  // A browse step re-points the panel BEFORE the slide settles: drop the
  // stale order immediately (falls back), the landed card re-measures.
  measuredOrder.value = undefined;
});

onMounted(() => {
  scheduleMeasure();
});
defineExpose({scrollBody});
</script>

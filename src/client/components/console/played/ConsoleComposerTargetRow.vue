<template>
  <div class="con-tgtrow" :data-tgtrow-state="result === undefined ? 'open' : 'answered'" data-composer-target-row>
    <!-- THE TARGET ROW OF A COMPOSER — ONE row for both composers (TR56 «КУДА ЛЯЖЕТ», П2), the question line of a
         «put N on ANY card» pick and its answer:
           · the LABEL is the question, and it never changes with the answer: «КУДА: 3 [мех]» — the payload's own print
             (the variant tile's hero) — or, with no payload, the host's role word («Карта-источник»);
           · UNANSWERED, the value is the STRIP of the server's candidates — their live faces, up to five and «ещё N»,
             a door ›. It never says «this card» about a card it does not mean, and never tells the player to choose
             (the commit rail says that, once, in one place);
           · ANSWERED, the chosen card's miniature (a flight end — `data-composer-card`), its name and owner, the tag
             under the step's card read again beside it (`ConsolePlayedTargetTag`) — or, a pick with no tag (a spend's
             source), its readings.
         ONE LINE: the question on the left, its value to the right — a row the height of the miniature, so the 4K
         column keeps its room (a label over the value cost the column a line and scrolled it).
         The two values share ONE grid cell and change by a phrase (opacity + a hair of scale) — never a `v-if` blink —
         and are the same height (the miniature's), so answering or un-answering moves nothing below the row (П5). -->
    <div class="con-composer__row-label con-tgtrow__label">
      <template v-if="payload !== undefined">
        <!-- A pick asked by SOMEBODY ELSE than the composer's card names its asker first («КОЛОНИЯ · ТИТАН · КУДА: 1
             [аэростат]» — a card paying all your colony bonuses asks once per tile, and the ledger above lists them). -->
        <template v-if="asker !== ''">
          <span class="con-tgtrow__asker" data-tgtrow-asker>{{ asker }}</span>
          <span class="con-tgtrow__sep" aria-hidden="true">·</span>
        </template>
        <span class="con-tgtrow__where">{{ $t('Where to') }}:</span>
        <span class="con-tgtrow__payload" data-tgtrow-payload :data-tgtrow-payload-icon="payload.icon">
          <span v-if="payload.printed !== undefined" class="con-tgtrow__payload-ink">
            <PremiumMechNode v-for="(node, n) in payload.printed" :key="n" :node="node" />
          </span>
          <template v-else>
            <b class="con-tgtrow__payload-num">{{ payload.amount }}</b>
            <i class="con-tgtrow__payload-icon" :class="iconClass(payload.icon)" aria-hidden="true"></i>
          </template>
        </span>
      </template>
      <span v-else>{{ label }}</span>
    </div>
    <div class="con-tgtrow__cell">
      <transition name="con-tgtrow-swap">
        <div v-if="result === undefined" key="open" class="con-tgtrow__body con-tgtrow__strip" data-tgtrow-strip
             :data-tgtrow-count="candidates.length">
          <template v-for="card in shown" :key="card.name">
            <!-- The card being PLAYED stands in the hero slot to the left — its place in the strip is a handle, never a
                 second face of one object. -->
            <span v-if="card.name === sourceCard" class="con-tgtrow__handle" :data-tgtrow-card="card.name" aria-hidden="true">↰</span>
            <span v-else class="con-tgtrow__mini" :data-tgtrow-card="card.name" aria-hidden="true">
              <ConsoleCardFaceLite :name="card.name" :card="card" lightweight />
            </span>
          </template>
          <span v-if="more > 0" class="con-tgtrow__more" data-tgtrow-more>{{ moreText }}</span>
          <span class="con-tgtrow__door" aria-hidden="true">›</span>
        </div>
        <div v-else key="answered" class="con-tgtrow__body con-composer__target">
          <!-- `data-composer-card`: the miniature IS the card on this surface — a resource put on it lands here, a spend
               taken off it is born here (consoleActionCommitRail, PL-162 / PL-268). A SOURCE-CARD target draws no face:
               the real card stands in the hero slot. -->
          <div v-if="result.relation !== 'source-card'" class="con-composer__target-thumb" :data-composer-card="result.cardName" aria-hidden="true">
            <ConsoleCardFaceLite :name="result.cardName" :card="resultModel" />
          </div>
          <span v-else class="con-composer__target-selflink" aria-hidden="true">↰</span>
          <div class="con-composer__target-body">
            <span class="con-composer__target-name">{{ $t(result.cardName) }}</span>
            <span class="con-composer__target-dot" :class="'player_bg_color_' + result.ownerColor" aria-hidden="true"></span>
            <span class="con-composer__target-origin" :class="'player_color_' + result.ownerColor">{{ result.ownerName }}</span>
            <!-- The TAG the step showed under this card — the same line, read again where the answer stands (П2). -->
            <span v-if="tag !== undefined" class="con-ptsel__tag con-tgtrow__tag" :class="'con-ptsel__tag--' + tag.tone" :data-ptsel-tag="tag.tone">
              <ConsolePlayedTargetTag :tag="tag" />
            </span>
            <span v-for="imp in readings" :key="imp.key" class="con-ptsel__imp"
                  :class="[imp.outcome !== undefined ? 'con-ptsel__imp--' + imp.outcome : '', {'con-ptsel__imp--down': imp.from !== undefined && imp.to !== undefined && imp.to < imp.from && imp.static !== true}]">
              <i v-if="imp.icon" class="con-ptsel__imp-icon" :class="iconClass(imp.icon)" aria-hidden="true"></i>
              <!-- ONE renderer for a reading with params (PL-160) — never `$t(imp.label)`. -->
              <span class="con-ptsel__imp-label">{{ impactText(imp) }}</span>
              <span v-if="imp.tail !== undefined" class="con-ptsel__imp-tail">{{ impactTail(imp) }}</span>
              <b v-if="imp.from !== undefined && imp.to !== undefined" class="con-ptsel__imp-delta">{{ imp.from }}<span aria-hidden="true"> → </span>{{ imp.to }}</b>
              <b v-else-if="imp.amount !== undefined" class="con-ptsel__imp-delta">{{ imp.amount > 0 ? '+' : '' }}{{ imp.amount }}</b>
              <template v-else-if="imp.per !== undefined"><b class="con-ptsel__imp-delta con-ptsel__imp-count">{{ imp.from }}</b><span class="con-ptsel__imp-per">· {{ $t(imp.per) }}</span></template>
            </span>
          </div>
          <!-- The CHANGE affordance — drawn ONLY while this row holds the cursor (one button, one verb at a time); its
               slot is reserved either way, so gaining the cursor moves nothing. -->
          <span class="con-composer__target-change" :class="{'con-composer__target-change--on': focused}">
            <GamepadGlyph control="confirm" />
            <span>{{ $t('Change selection') }}</span>
          </span>
        </div>
      </transition>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ConsolePlayedTargetTag from '@/client/components/console/played/ConsolePlayedTargetTag.vue';
import PremiumMechNode from '@/client/components/premiumCard/PremiumMechNode.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {CardModel} from '@/common/models/CardModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateTextWithParams} from '@/client/directives/i18n';
import {readingTailText, readingText} from '@/client/console/readingText';
import {
  PlayedTargetPayload, PlayedTargetQuickImpact, PlayedTargetResult, PlayedTargetTag,
} from '@/client/console/played/consolePlayedTargetModel';

/** How many candidate faces the unanswered strip shows before «ещё N». */
export const TARGET_ROW_STRIP_FACES = 5;

export default defineComponent({
  name: 'ConsoleComposerTargetRow',
  components: {ConsoleCardFaceLite, ConsolePlayedTargetTag, PremiumMechNode, GamepadGlyph},
  props: {
    /** The row's role word (already translated) — the label when the pick carries no payload. */
    label: {type: String, default: ''},
    /** Who asks, when it is not the composer's card (already translated — «Колония · Титан»); leads the label. */
    asker: {type: String, default: ''},
    /** WHAT lands (`playedTargetPayloadOf`) — the label becomes «КУДА: [печать]». */
    payload: {type: Object as PropType<PlayedTargetPayload | undefined>, default: undefined},
    /** The SERVER's candidates of the pick, in its order — the unanswered strip. */
    candidates: {type: Array as PropType<ReadonlyArray<CardModel>>, default: () => []},
    /** The card the composer stands on (its own candidate is a handle in the strip). */
    sourceCard: {type: String, default: ''},
    /** The answered target (undefined = unanswered, or an answer gone stale). */
    result: {type: Object as PropType<PlayedTargetResult | undefined>, default: undefined},
    /** The chosen card's live model — its capsule states the count the token lands on. */
    resultModel: {type: Object as PropType<CardModel | undefined>, default: undefined},
    /** The chosen candidate's outcome tag — the step's own line under that card. */
    tag: {type: Object as PropType<PlayedTargetTag | undefined>, default: undefined},
    /** The readings only words can say (the tag already prints the digits). */
    impacts: {type: Array as PropType<ReadonlyArray<PlayedTargetQuickImpact>>, default: () => []},
    /** The row holds the cursor — the change affordance shows. */
    focused: {type: Boolean, default: false},
  },
  computed: {
    shown(): ReadonlyArray<CardModel> {
      return this.candidates.slice(0, TARGET_ROW_STRIP_FACES);
    },
    more(): number {
      return Math.max(0, this.candidates.length - TARGET_ROW_STRIP_FACES);
    },
    /**
     * What the row reads beside the miniature: the TAG — the step's own line under that card — and only the words it
     * cannot print: a threshold's sentence («Хватит на делегата: 3 / 3» beside «[делегат] ✓»), a role's value line. A
     * reading whose numbers the tag prints whole (a tender's «+18», a look, «+1 card» — `tagSays`) would be the same
     * number a second time; a pick with no tag (a loss — the source of a spend) keeps every reading.
     */
    readings(): ReadonlyArray<PlayedTargetQuickImpact> {
      return this.tag !== undefined ? this.impacts.filter((imp) => imp.tagSays !== true) : this.impacts;
    },
    moreText(): string {
      return translateTextWithParams('+${0} more', [String(this.more)]);
    },
  },
  methods: {
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
    impactText(imp: PlayedTargetQuickImpact): string {
      return readingText(imp);
    },
    impactTail(imp: PlayedTargetQuickImpact): string {
      return readingTailText(imp) ?? '';
    },
  },
});
</script>

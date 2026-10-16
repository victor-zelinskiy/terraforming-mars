<template>
  <!--
    ONE CARD'S ACTIONS — the card PLATE and its action SLOTS, the «Действия карт» tile (TR60, decision 6a: one markup,
    two hosts). The workspace that ACTS (ConsoleCardActions) drives the cursor, the shake and the descent through its
    props; the Information workspace's «Действия» zone hosts the SAME markup `readonly` — no cursor, no verb, the turn
    gate read as the rules allow it (`readonlyTileVerdict`), never a submit by construction (this component emits
    nothing). Everything a tile SAYS is `console/actionTileView.ts`.
    The CARD is the group and is never split: the plate leads on TOP (the source is what the eye scans first: the
    name + everything the whole card owns — stored resource, accrued VP), the slots follow under it. A slot keeps a
    FIXED three-zone anatomy (service row · action canvas · diagnostics), so every canvas across the screen sits at
    the same height and the «или» joint can anchor to the canvas' true centre (the `--act-*` slot tokens).
  -->
  <div class="con-cardactions__group"
       :class="[
         'con-cardactions__group--' + group.status,
         {
           'con-cardactions__group--wide': group.tiles.length > 1,
           'con-cardactions__group--live': groupHasFocus,
           'con-cardactions__group--futile': group.futile !== undefined,
           'con-cardactions__group--readonly': readonly,
         },
       ]"
       :data-action-group="group.cardName">
    <!-- The CARD PLATE — the group's identity header: reading order is source first, action second. For an «или»
         card it spans BOTH slots, visibly uniting the alternatives. -->
    <div class="con-cardactions__plate" :class="{'con-cardactions__plate--party': group.party !== undefined || group.resolutionAction !== undefined}">
      <img v-if="group.party !== undefined" class="con-cardactions__plate-emblem" :src="partyEmblemOf(group.party)" alt="" />
      <!-- THE LAW's plate (Turmoil Redux): its author's seal, its own kicker, its printed name. -->
      <img v-else-if="group.resolutionParty !== undefined" class="con-cardactions__plate-emblem" :src="partyEmblemOf(group.resolutionParty)" alt="" />
      <span v-if="group.party !== undefined" class="con-cardactions__plate-kicker">{{ $t('Party action') }}</span>
      <span v-else-if="group.resolutionAction !== undefined" class="con-cardactions__plate-kicker">{{ $t('Resolution action') }}</span>
      <!-- A party is named by the parliament's ONE glossary key («Учёные», never the upstream «Ученые» — PL-110). -->
      <span class="con-cardactions__plate-name">{{ $t(partyNameKeyOf(group.party) ?? resolutionNameOf(group.resolutionAction) ?? group.cardName) }}</span>
      <span v-if="(group.party !== undefined || group.resolutionAction !== undefined) && group.tiles[0] !== undefined" class="con-cardactions__plate-chip con-cardactions__plate-chip--uses">
        <b>{{ usesText(group.tiles[0]) }}</b>
      </span>
      <span v-if="group.cardResource !== undefined" class="con-cardactions__plate-chip">
        <i class="con-cardactions__res-icon" :class="resIconClass(group.cardResource.type)" aria-hidden="true"></i>
        <b>{{ group.cardResource.count }}</b>
      </span>
      <span v-if="group.vp !== undefined" class="con-cardactions__plate-chip con-cardactions__plate-chip--vp">
        <b>{{ group.vp.points }}</b>
        <span class="con-cardactions__plate-vp-unit">{{ $t('VP') }}</span>
        <em v-if="group.vp.toNext > 0">+1 · {{ group.vp.toNext }}</em>
      </span>
    </div>

    <div class="con-cardactions__acts"
         :class="{'con-cardactions__acts--pair': group.tiles.length > 1}">
      <div v-for="tile in group.tiles" :key="tile.key"
           class="con-cardactions__tile"
           :class="[
             'con-cardactions__tile--' + (readonly ? readonlyStatus(tile) : tile.status),
             {
               'con-cardactions__tile--party': tile.party !== undefined,
               'con-cardactions__tile--focused': !readonly && focusKey === tile.key,
               'con-cardactions__tile--shake': !readonly && shakeKey === tile.key,
               'con-cardactions__tile--descend': !readonly && descendKey === tile.key,
               'con-cardactions__tile--futile': isFutile(tile),
             },
           ]"
           :data-action-futile="isFutile(tile) ? tile.futile?.kind : undefined"
           :data-action-card="tile.cardName"
           :data-action-party="tile.party"
           :data-action-resolution="tile.resolutionAction"
           :data-action-verdict="verdictOf(tile)">
        <!-- The «или» joint rides the shared edge with the sibling button to the left, anchored to the CANVAS centre. -->
        <div v-if="tile.joinLeft" class="con-cardactions__or con-cardactions__or--joint" aria-hidden="true">{{ $t('or') }}</div>

        <!-- SERVICE ROW — always laid out (the fixed anatomy): the quiet «Вариант N» way-finder on the left, the verdict
             chip on the right ONLY when it is news (a blocked / not-now / used state; «available» is the norm and says
             nothing). -->
        <div class="con-cardactions__tile-head">
          <!-- One column (the Deck) stacks a card's slots, so the joint has no shared edge — the alternative says
               «или» in words instead. Never both. -->
          <span v-if="!tile.joinLeft && tile.nodeIndex > 0" class="con-cardactions__tile-or">{{ $t('or') }}</span>
          <span v-if="tile.variantTotal > 1" class="con-cardactions__tile-variant">{{ $t('Option') }} {{ tile.nodeIndex + 1 }}</span>
          <span v-if="verdictOf(tile) !== 'available'" class="con-cardactions__tile-status" :class="'con-cardactions__tile-status--' + verdictOf(tile)">
            {{ $t(statusLabel(verdictOf(tile))) }}
          </span>
        </div>

        <!-- ── THE ACTION BODY — zone 2 of the slot anatomy, and the slot's whole statement: the FIXED graphic canvas
             on the left, the action's own sentence in the space beside it. The row's height is the canvas' height,
             so the «или» seam badge keeps one anchor for every slot on the screen whatever either side draws. ── -->
        <div class="con-cardactions__actbody">
          <!-- ACTION CANVAS — ONE stage for every formula: fixed width AND height, content centred, the printed art
               straight from the manifest (instant, no fetch). The canvas NEVER takes its size from what it holds;
               formulas of different natural widths are fitted INTO the stage (`--act-fit`, the host's fit pass). -->
          <div class="con-cardactions__canvas">
            <div v-if="tile.party !== undefined" class="con-cardactions__graphic con-cardactions__graphic--party">
              <ConsolePartyFormula :party="tile.party" :renderRoot="tile.node.renderRoot" size="compact" />
            </div>
            <!-- THE LAW's action row — the printed formula off the face, the action row alone. -->
            <div v-else-if="tile.resolutionAction !== undefined" class="con-cardactions__graphic card-container" v-i18n v-strip-action-prefix>
              <CardRenderData v-if="tile.node.renderRoot !== undefined" :renderData="tile.node.renderRoot" />
              <span v-else class="con-cardactions__graphic-text">{{ tile.node.text }}</span>
            </div>
            <div v-else class="con-cardactions__graphic card-container" v-i18n v-strip-action-prefix>
              <CardRenderEffectBoxComponent v-if="tile.node.actionNode !== undefined" :effectData="tile.node.actionNode" />
              <CardRenderData v-else-if="tile.node.renderRoot !== undefined" :renderData="tile.node.renderRoot" />
              <span v-else class="con-cardactions__graphic-text">{{ tile.node.text }}</span>
            </div>
          </div>

          <!-- ACTION DESCRIPTION — what the action does, in the card's own words, in the width the wide button already
               has. SIZE FOLLOWS LENGTH (`descTier`): the profile declares three (size, lines) pairs, all of which fit
               the fixed body row. The clamp lives on the INNER block (a flex item is blockified by the engine, which
               quietly disables the line clamp on it). -->
          <div v-if="ruleText(tile) !== ''" class="con-cardactions__desc-slot">
            <p class="con-cardactions__desc"
               :class="'con-cardactions__desc--' + descTier(ruleText(tile))">{{ ruleText(tile) }}</p>
          </div>
        </div>

        <!-- ── DIAGNOSTICS / CONTINUATION — zone 3, reserved and SINGLE-PURPOSE: it speaks about the slot's STATE,
             never about what the action does. Exactly one of two semantic kinds, taken from two different model
             fields (a blocked verdict's `reason` vs the branch's named `choiceKinds`) — the distinction is data. ── -->
        <div class="con-cardactions__tile-meta">
          <!-- The TONE is data: a turn/phase gate is `warning` («не сейчас», ⏳), a rules verdict is `danger` (✕). -->
          <div v-if="metaOf(tile).kind === 'validation'"
               class="con-cardactions__tile-reason"
               :class="'con-cardactions__tile-reason--' + metaOf(tile).tone">
            <span aria-hidden="true">{{ metaOf(tile).tone === 'warning' ? '⏳' : '✕' }}</span>
            <span>{{ metaOf(tile).text }}</span>
          </div>
          <!-- AVAILABLE and changing nothing: the server's reason, in the quiet register — a fact, not a refusal. -->
          <div v-else-if="metaOf(tile).kind === 'futile'"
               class="con-cardactions__tile-reason con-cardactions__tile-reason--futile" data-tile-futile>
            <span aria-hidden="true">○</span>
            <span>{{ metaOf(tile).text }}</span>
          </div>
          <div v-else-if="metaOf(tile).kind === 'continuation'" class="con-cardactions__tile-choices">
            <span aria-hidden="true">◈</span>
            <span>{{ metaOf(tile).text }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardResource} from '@/common/CardResource';
import {ReduxParty, ResolutionId} from '@/common/parliament/ParliamentTypes';
import {ConsoleActionGroup, ConsoleActionTile, ParliamentActionSource, actionDescTier, ActionDescTier} from '@/client/console/consoleCardActions';
import {
  readonlyTileVerdict, SlotMeta, slotMeta, slotRuleText, sourceUsesText, TILE_STATUS_LABEL, tileFutile, TileVerdict, tileVerdict,
} from '@/client/console/actionTileView';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {stripActionPrefix} from '@/client/directives/stripActionPrefix';
import ConsolePartyFormula from '@/client/components/console/parliament/ConsolePartyFormula.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';

export default defineComponent({
  name: 'ConsoleActionGroupView',
  components: {ConsolePartyFormula, CardRenderEffectBoxComponent, CardRenderData},
  directives: {stripActionPrefix},
  props: {
    group: {type: Object as PropType<ConsoleActionGroup>, required: true},
    /** The acting host's cursor / shake / descent (empty for a read-only host). */
    focusKey: {type: String, default: ''},
    shakeKey: {type: String, default: ''},
    descendKey: {type: String, default: ''},
    /** The Parliament's sources (a party / law tile's «uses this generation»). */
    parliamentActionSources: {type: Array as PropType<ReadonlyArray<ParliamentActionSource>>, default: () => []},
    /** A host that only READS (the Information workspace): no cursor, no verb, the turn gate is no news. */
    readonly: {type: Boolean, default: false},
  },
  computed: {
    groupHasFocus(): boolean {
      return !this.readonly && this.group.tiles.some((t) => t.key === this.focusKey);
    },
  },
  methods: {
    resIconClass(icon: string | CardResource): string {
      return iconClassFor(String(icon).toLowerCase().replace(/\s+/g, '-'));
    },
    statusLabel(status: TileVerdict): string {
      return TILE_STATUS_LABEL[status];
    },
    isFutile(tile: ConsoleActionTile): boolean {
      return tileFutile(tile);
    },
    verdictOf(tile: ConsoleActionTile): TileVerdict {
      return this.readonly ? readonlyTileVerdict(tile) : tileVerdict(tile);
    },
    /** The status class a read-only host paints (the turn gate reads as the rules allow it). */
    readonlyStatus(tile: ConsoleActionTile): string {
      return tile.status === 'soft' ? 'available' : tile.status;
    },
    ruleText(tile: ConsoleActionTile): string {
      return slotRuleText(tile);
    },
    descTier(text: string): ActionDescTier {
      return actionDescTier(text);
    },
    metaOf(tile: ConsoleActionTile): SlotMeta {
      return slotMeta(tile, this.readonly);
    },
    usesText(tile: ConsoleActionTile): string {
      return sourceUsesText(tile, this.parliamentActionSources);
    },
    partyEmblemOf(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    /** The law's printed name (an i18n key) for its plate — never the catalog id. */
    resolutionNameOf(id: ResolutionId | undefined): string | undefined {
      return id === undefined ? undefined : (getResolution(id)?.text.name ?? id);
    },
    /** A party's name KEY — the parliament's glossary key («Учёные», never the bare upstream one, PL-110). */
    partyNameKeyOf(party: string | undefined): string | undefined {
      return party === undefined ? undefined : partyNameKey(party);
    },
  },
});
</script>

<template>
  <div v-if="piles.length > 0 || lineage.length > 0 || carried.length > 0 || tenders.length > 0" class="con-startdock"
       :class="{'con-startdock--plated': plated}">
    <!--
      THE SELECTION DOCK — the Game Start Workspace's preparation shelf: the
      decisions ALREADY MADE on earlier steps lie here as compact face-down
      piles (corporation / preludes / projects), physically collected on RT
      and physically returned to their grid slots on LT (startDockMotion).

      OWNERSHIP IS PHYSICAL: the backs render from `pile.backs`, which follows
      the FLYING CARDS (dockDrift) — a back appears only when its card lands,
      and disappears the moment its card departs. On the SUMMARY the cards
      themselves lie open in the tiles, so the piles are physically EMPTY and
      each slot collapses to the informational trace («КОРПОРАЦИЯ · 1») —
      never a duplicate card back under an open card.

      NOT the Hand Dock (real bought cards) and NOT the Played Tableau (real
      played cards): everything here is still reversible — a prepared stack
      on the table's edge, waiting for the summary to open it.
    -->
    <span class="con-startdock__title" aria-hidden="true">{{ $t('Prepared') }}</span>
    <div v-for="pile in piles"
         :key="pile.id"
         class="con-startdock__pile"
         aria-hidden="true"
         :class="{
           'con-startdock__pile--empty': pile.backs === 0,
           'con-startdock__pile--waiting': !pile.collected,
           'con-startdock__pile--trace': traceOnly(pile),
         }"
         :data-start-pile="pile.id">
      <!-- The stack CONTAINER always stands (it is the flights' measured
           destination — geometry must exist before any card flies); only the
           BACKS inside follow the physical cards. Trace mode empties and
           visually mutes it, never unmounts it. -->
      <div class="con-startdock__stack">
        <template v-if="pile.backs > 0">
          <div v-for="i in Math.min(3, pile.backs)"
               :key="i"
               class="con-startdock__back"
               :style="{transform: `translate(${(i - 1) * 2}px, ${(1 - i) * 2}px)`}">
            <div class="con-card-back con-card-back--flyer"></div>
          </div>
        </template>
        <div v-else-if="!pile.collected" class="con-startdock__back con-startdock__back--ghost">
          <div class="con-card-back con-card-back--flyer"></div>
        </div>
      </div>
      <div class="con-startdock__meta">
        <span class="con-startdock__label">{{ $t(pile.label) }}</span>
        <b class="con-startdock__count" :key="pile.count">{{ pile.count }}</b>
      </div>
    </div>

    <!-- CAMPAIGN «ТЕНДЕРЫ» — THE TENDER DOOR (§19, the owner 2026-11-09): the holder's tenders, always in sight on the
         shelf, LEFT of «НАСЛЕДИЕ» — so its door is the LEFT stick (L3) as the legacy's is the right one (R3). Every
         holding is its certificate in MINIATURE (the face itself, zoomed: the tier's metal, the art, the stamp read as
         material), one row beside the cap with the executed tally. On the page where a tender EXECUTES the block says so
         — a kant and the words «МОЖНО ИСПОЛНИТЬ · N» (material, never a glow); L3 opens the door's list, its certificates
         rising out of these very miniatures (`heldTenders` keeps a miniature empty while its certificate is up). A tender
         standing in its mode is marked on its miniature (`activeTender`). -->
    <div v-if="tenders.length > 0" class="con-startdock__legacy con-startdock__tenders"
         :class="{'con-startdock__tenders--ready': tenderReady > 0}"
         data-tender-dock :data-tender-dock-ready="tenderReady">
      <span class="con-startdock__legacy-divider" aria-hidden="true"></span>
      <div class="con-startdock__legacy-body">
        <div class="con-startdock__legacy-head">
          <span class="con-startdock__legacy-cap">{{ $t('Tenders') }}</span>
          <span class="con-startdock__tenders-line">
            <span v-if="tenderDoor" class="con-startdock__legacy-hint"><GamepadGlyph control="stickL" /></span>
            <span v-if="tenderReady > 0" class="con-startdock__tenders-ready" data-tender-dock-ready-word>{{ readyText }}</span>
            <span v-else class="con-startdock__tenders-tally" data-tender-dock-tally>{{ executedTenders }}/{{ tenders.length }}</span>
          </span>
        </div>
        <div class="con-startdock__legacy-row">
          <div v-for="t in tenders" :key="t.instance" class="con-tmini"
               :class="[`con-tmini--${t.status}`, {
                 'con-tmini--just-executed': stamped === t.instance,
                 'con-tmini--aloft': heldTenders.includes(t.instance),
                 'con-tmini--active': activeTender === t.instance,
               }]"
               :data-tender-dock-chip="t.instance" :data-tender-dock-status="t.status"
               :aria-label="$t(tenderNameKey(t.id))">
            <!-- Only the certificates that execute on THIS page stand bright in the dock; the rest step back (the face's own
                 dim — the same one the list and every flight carry). -->
            <ConsoleTenderCard :id="t.id" size="table" :state="tenderCardStateOf(t.status)" :dim="!readyTenders.includes(t.instance)" />
          </div>
        </div>
      </div>
    </div>

    <!-- CAMPAIGN missions 2+: «НАСЛЕДИЕ» — the corporations already acquired
         (the established lineage the new pick will merge into). A separate
         premium-captioned block AFTER every pile, in the SAME shelf row — it
         costs the candidate strip zero space. Face-up compact tiles; a click
         (and R3 anywhere in the wizard) descends into the workspace's LEGACY
         OVERVIEW — these very tiles are the flight's physical source, so a
         tile whose card is UP THERE right now is held empty (`heldNames`:
         visibility only — the shelf's geometry never changes). -->
    <div v-if="lineage.length > 0" class="con-startdock__legacy">
      <span class="con-startdock__legacy-divider" aria-hidden="true"></span>
      <div class="con-startdock__legacy-body">
        <div class="con-startdock__legacy-head">
          <span class="con-startdock__legacy-cap">{{ $t('Legacy') }}</span>
          <span v-if="lineageHint" class="con-startdock__legacy-hint">
            <GamepadGlyph control="stickR" />
          </span>
        </div>
        <div class="con-startdock__legacy-row">
          <button v-for="name in lineage" :key="name" type="button"
                  class="con-startdock__legacy-card"
                  :class="{'con-startdock__legacy-card--held': isHeld(name)}"
                  :data-zoom-slot="isHeld(name) ? undefined : name"
                  :data-legacy-dock="name"
                  :aria-label="$t(name)"
                  @click.capture.stop="$emit('inspect-lineage', name)">
            <Card :card="{name}" :key="name" lightweight />
          </button>
        </div>
      </div>
    </div>

    <!-- CAMPAIGN «Наследие проектов»: the project cards carried over from the
         previous mission — their own block BESIDE the corporations (identity
         matters for the picks being made above: a carried project can change
         what the player buys). Same chassis, same overview door. -->
    <div v-if="carried.length > 0" class="con-startdock__legacy con-startdock__legacy--projects">
      <span class="con-startdock__legacy-divider" aria-hidden="true"></span>
      <div class="con-startdock__legacy-body">
        <div class="con-startdock__legacy-head">
          <span class="con-startdock__legacy-cap">{{ $t('Legacy projects') }}</span>
        </div>
        <div class="con-startdock__legacy-row">
          <button v-for="name in carried" :key="name" type="button"
                  class="con-startdock__legacy-card"
                  :class="{'con-startdock__legacy-card--held': isHeld(name)}"
                  :data-zoom-slot="isHeld(name) ? undefined : name"
                  :data-legacy-dock="name"
                  :aria-label="$t(name)"
                  @click.capture.stop="$emit('inspect-lineage', name)">
            <Card :card="{name}" :key="name" lightweight />
          </button>
        </div>
      </div>
    </div>

    <!-- A TENDER'S MODE PLATE (§19): while a tender stands in its mode on the page above, the shelf's ROW is its
         control plate — its name, what it gives in live numbers, its own small controls (the request's tags). The plate
         lies OVER the shelf in the shelf's own box (absolute, inset 0): the dock's height never changes, so the cards of
         the page above never move (the owner: «размер и раскладка карт не должны измениться»); the shelf's blocks step
         back by opacity under it and return the same nodes. -->
    <div class="con-startdock__plate" :class="{'con-startdock__plate--up': plated}" :aria-hidden="plated ? undefined : 'true'" data-tender-plate-host>
      <slot name="plate" />
    </div>
  </div>
</template>

<script setup vapor lang="ts">
import {computed, PropType} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleTenderCard from '@/client/components/console/campaign/ConsoleTenderCard.vue';
import {tenderCardStateOf} from '@/client/console/campaign/tenderPortfolio';
import {CardName} from '@/common/cards/CardName';
import {TenderId, TenderStatus, tenderNameKey} from '@/common/campaign/tenders';
import {$t, translateTextWithParams} from '@/client/directives/i18n';

/** One tender on the shelf — the chip's data. */
export type StartDockTender = {instance: string, id: TenderId, status: TenderStatus};

export type StartDockPile = {
  id: string,
  /** i18n key. */
  label: string,
  /** Informational count (the trace number). */
  count: number,
  /** Backs physically lying here right now. */
  backs: number,
  /** The step whose picks these are has been collected past. */
  collected?: boolean,
  /** A flight is landing here right now (a brief receiving accent). */
  hot?: boolean,
};

defineOptions({name: 'ConsoleStartSelectionDock'});
const props = defineProps({
  piles: {type: Array as PropType<ReadonlyArray<StartDockPile>>, required: true},
  /** CAMPAIGN: the established corporation lineage («Наследие» block). */
  lineage: {type: Array as PropType<ReadonlyArray<CardName>>, required: false, default: () => []},
  /** CAMPAIGN: the carried project cards («Проекты наследия» block). */
  carried: {type: Array as PropType<ReadonlyArray<CardName>>, required: false, default: () => []},
  /** Show the R3 legacy-overview glyph (where the press actually opens it). */
  lineageHint: {type: Boolean, required: false, default: false},
  /** CAMPAIGN «ТЕНДЕРЫ»: the holder's tenders (the portfolio's home on the shelf). */
  tenders: {type: Array as PropType<ReadonlyArray<StartDockTender>>, required: false, default: () => []},
  /** The chip that just took its stamp (a one-shot class). */
  stamped: {type: String, required: false, default: undefined},
  /** The «ТЕНДЕРЫ» block is a DOOR here (L3 opens the list) — its glyph stands. */
  tenderDoor: {type: Boolean, required: false, default: false},
  /** How many tenders EXECUTE on the page the player stands on — > 0 lights the block («МОЖНО ИСПОЛНИТЬ · N»). */
  tenderReady: {type: Number, required: false, default: 0},
  /** Miniatures whose certificate is UP in the door's list (held empty — the flight home aims at them). */
  heldTenders: {type: Array as PropType<ReadonlyArray<string>>, required: false, default: () => []},
  /** The holdings that execute on the page standing now (bright in the dock; every other one dimmed). */
  readyTenders: {type: Array as PropType<ReadonlyArray<string>>, required: false, default: () => []},
  /** The tender standing in its mode on the page (its miniature is marked). */
  activeTender: {type: String, required: false, default: undefined},
  /** A tender's mode plate covers the shelf's row (the `plate` slot). */
  plated: {type: Boolean, required: false, default: false},
  /** Tiles whose card is physically UP in the legacy overview right now —
   *  held empty (visibility only: the tile stays the flight's measured
   *  home, and the shelf's geometry never changes). */
  heldNames: {type: Array as PropType<ReadonlyArray<CardName>>, required: false, default: () => []},
});
defineEmits(['inspect-lineage']);

/** How many of the holdings have already executed — the dock's quiet tally beside the cap. */
const executedTenders = computed((): number => {
  return props.tenders.filter((t) => t.status === 'executed').length;
});
const readyText = computed((): string => {
  return translateTextWithParams('Can execute: ${0}', [String(props.tenderReady)]);
});
/** The pile's cards are laid out elsewhere (the summary tiles) — only
 *  the informational label · count trace remains, no physical backs. */
function traceOnly(pile: StartDockPile): boolean {
  return pile.backs === 0 && pile.collected === true && pile.count > 0;
}
function isHeld(name: CardName): boolean {
  return props.heldNames.includes(name);
}
</script>

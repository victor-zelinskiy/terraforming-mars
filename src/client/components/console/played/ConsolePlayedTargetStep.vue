<template>
  <!-- THE EMBEDDED PLAYED-TARGET STEP — a level of the Card Play Workspace,
       not a surface over it. No band geometry, no plate, no backdrop, no
       `con-ws` marker: the workspace it stands in already owns all of those,
       and the source card stays visible to its left throughout. -->
  <div class="con-ptsel"
       :data-mode="layout.mode"
       :data-flow="sizing.sectionFlow"
       :data-overflow="sizing.overflows ? '1' : undefined"
       :style="sizeVars">
    <!-- ── THE SELECTION CONTRACT — one question, answered once. The count
         rides the SAME line as the title: it is a property of the ask, not a
         third statement of it (the owner bar and the category rails used to
         repeat the very same number twice more). ── -->
    <header class="con-ptsel__contract" data-unfold-item ref="contract">
      <div class="con-ptsel__contract-head">
        <span class="con-ptsel__contract-mark" aria-hidden="true">◈</span>
        <span class="con-ptsel__contract-title">{{ $t('Choose a played card') }}</span>
        <span class="con-ptsel__contract-sep" aria-hidden="true">·</span>
        <span class="con-ptsel__scope-count">{{ scopeLine }}</span>
        <!-- MULTI: the live accumulation, so «сколько ещё можно» is never a
             guess. At the cap it says so instead of silently ignoring A. -->
        <template v-if="selection.mode === 'multi'">
          <span class="con-ptsel__contract-sep" aria-hidden="true">·</span>
          <span class="con-ptsel__scope-picked"
                :class="{'con-ptsel__scope-picked--full': atCap}">{{ pickedLine }}</span>
          <span v-if="atCap" class="con-ptsel__scope-note">{{ $t('Deselect another card first') }}</span>
        </template>
        <span v-else-if="model.contract.selfAllowed && model.contract.opponentsInvolved"
              class="con-ptsel__scope-note">{{ $t('Your own card or another player\'s') }}</span>
      </div>
      <!-- The server's ask, and only when it says something the head above it
           does not. Empty = boilerplate («добавить ресурс на эту карту» under
           an action rule that already reads «Добавьте 1 аэростат на любую
           карту»), and a second instruction that repeats the first is how a
           screen teaches the player to stop reading it. -->
      <div v-if="model.contract.ask !== ''" class="con-ptsel__contract-ask">{{ model.contract.ask }}</div>
    </header>

    <!-- ── OWNER TABS — only in tabbed mode, and only over owners that HAVE
         targets (which, by construction of the model, is all of them). ── -->
    <div v-if="layout.mode === 'tabs' && model.owners.length > 1" class="con-ptsel__tabs" data-unfold-item ref="tabs">
      <GamepadGlyph control="bumperL" />
      <span v-for="owner in model.owners" :key="owner.id"
            class="con-ptsel__tab"
            :class="['player_color_' + owner.color, {'con-ptsel__tab--active': owner.id === activeOwnerId}]">
        <span class="con-ptsel__tab-dot" :class="'player_bg_color_' + owner.color" aria-hidden="true"></span>
        <span class="con-ptsel__tab-name">{{ owner.name }}</span>
        <b>{{ owner.candidates.length }}</b>
      </span>
      <GamepadGlyph control="bumperR" />
    </div>

    <!-- ── THE CANDIDATE VIEWPORT — the ONLY scrollable zone of this step.
         Everything outside it is FIXED: the contract above, the owner tabs, and
         the status rail below. With a large table the cards genuinely have to
         scroll (they may not be shrunk to unreadable), and when they do the
         rail must not travel with them — it is the reading of the card under
         the cursor, so it has to stay where the eye already is.
         The step caps its own height against the band (see `budgetPx`), which
         is what turns `flex: 1; min-height: 0` here into a real scroll
         container rather than an ever-growing column. ── -->
    <ConsoleScrollArea class="con-ptsel__viewport" content-class="con-ptsel__viewport-body" ref="viewport">
    <!-- ── OWNER GROUPS. Each owner is a SPATIAL group with its own rail —
         candidates are never mixed into one grid with small badges, because
         whose card this is must read from where it sits. ── -->
    <div class="con-ptsel__zone" ref="zone">
      <section v-for="owner in visibleOwners" :key="owner.id"
               class="con-ptsel__owner"
               :class="{'con-ptsel__owner--self': owner.self, 'con-ptsel__owner--focused': owner.id === focus.ownerId}"
               data-unfold-item>
        <header class="con-ptsel__ownerbar">
          <span class="con-ptsel__ownerdot" :class="'player_bg_color_' + owner.color" aria-hidden="true"></span>
          <span class="con-ptsel__ownername" :class="'player_color_' + owner.color">{{ owner.name }}</span>
          <!-- SELF-HARM, once per GROUP. The rules allow taking from your own
               table and we may not forbid what the printed rules permit — but
               the player must never do it by accident. One marker on the block
               header, not one per card: the fact is «everything under here is
               yours», and repeating it on every face would be noise the eye
               learns to skip. Only shown when an opponent's card was available
               instead (`selfHarm`), so it never fires on a card whose own
               resource IS the cost. -->
          <span v-if="owner.selfHarm" class="con-ptsel__ownerwarn">⚠ {{ $t('Your own cards') }}</span>
          <!-- NO «РАЗЫГРАНО N». It counts the player's WHOLE table, and this
               surface shows only the ELIGIBLE cards — «разыграно 3» over one
               visible candidate reads as two cards that failed to render. The
               only count this step owes is «сколько целей», which the contract
               line already states once. The eligible-per-owner count survives
               ONLY with several owners, where it answers «where are they»
               instead of repeating the contract's total. -->
          <span v-if="showsOwnerTargets" class="con-ptsel__ownercount">
            <i>{{ $t('Selectable') }}</i><b class="con-ptsel__ownercount-live">{{ owner.candidates.length }}</b>
          </span>
        </header>

        <div class="con-ptsel__sections">
          <div v-for="section in sectionsOf(owner)" :key="section.key" class="con-ptsel__section" :style="sectionStyle(section)">
            <!-- The SELF block draws no rail of its own (the proxy is a handle,
                 not a card family) — but while the neighbours wear rails it
                 keeps an EMPTY one, so every cards row starts on one baseline. -->
            <div v-if="showsRails(owner)" class="con-ptsel__catrail" :class="{'con-ptsel__catrail--blank': section.self}">
              <template v-if="!section.self">
                <span class="con-ptsel__catname">{{ $t(section.label) }}</span>
                <span class="con-ptsel__catcount">{{ section.candidates.length }}</span>
              </template>
            </div>
            <div class="con-ptsel__cards">
              <!-- The CELL is the measured, never-transformed box: focus lifts
                   the slot INSIDE it, so the geometry the navigation reads can
                   never be the emphasis it is applying. -->
              <div v-for="cand in section.candidates" :key="cand.cardName"
                   class="con-ptsel__cell"
                   data-ptsel-cell
                   :data-owner="owner.id"
                   :data-index="indexOf(owner, cand.cardName)"
                   :data-focused="isFocused(owner.id, cand.cardName) ? '1' : undefined">
                <!-- THE SELF-TARGET PROXY. The source card is already standing
                     in the workspace's hero slot; drawing it AGAIN at full size
                     would put two copies of one physical object on one screen.
                     So this candidate is a NAVIGATION PROXY that points at the
                     real card — a full navigation stop with its own focus, its
                     own A and its own lock, standing in the SAME horizontal row
                     as the physical targets beside it.
                     `data-ptsel-self` is the connector's right-hand anchor (the
                     wire to the hero card is measured off this box), and it is
                     deliberately NOT a `data-zoom-slot`: X on this proxy must
                     lift the REAL card, so the origin resolves to the hero (see
                     `playedTargetZoomOrigin`). A slot key here is what made the
                     viewer rise out of the chip while the card it names stayed
                     lying on the left — two copies again, by another route.
                     ITS BOX IS FIXED (`--con-ptsel-slot-w`, the same solved
                     card width every cell gets) and every state marker below is
                     out of flow, so focus / select / deselect cannot change the
                     row's shape. That is the whole reflow fix: the width used to
                     be intrinsic, so the ✓ badge alone pushed the proxy past a
                     card width and the flex row broke to a second line — the
                     "horizontal turns vertical when I choose this card" bug. -->
                <div v-if="cand.relation === 'source-card'"
                     class="con-ptsel__self"
                     data-ptsel-self
                     :class="{
                       'con-ptsel__self--focused': isFocused(owner.id, cand.cardName),
                       'con-ptsel__self--locked': isChosen(cand.cardName),
                     }">
                  <span class="con-ptsel__self-body">
                    <!-- «ЭТА КАРТА», and nothing before it. «ИСТОЧНИК» is the
                         console's word for the card that PRODUCED what you are
                         looking at (`L3 Источник`), and this proxy is not that
                         — it is one of the targets. Two roles under one word on
                         one screen is how a vocabulary stops meaning anything. -->
                    <span class="con-ptsel__self-kicker">{{ $t('This card') }}</span>
                    <span class="con-ptsel__self-name">{{ $t(cand.cardName) }}</span>
                  </span>
                  <ConsoleCardResourceChip v-if="showsResource(cand)"
                                           variant="proxy"
                                           :icon="cand.resourceContext?.icon ?? ''"
                                           :count="cand.resourceContext?.count ?? 0" />
                  <span v-if="isChosen(cand.cardName)" class="con-ptsel__self-check" aria-hidden="true">{{ pickOrdinal(cand.cardName) }}</span>
                </div>
                <div v-else
                     class="con-ptsel__slot"
                     :class="{
                       'con-ptsel__slot--focused': isFocused(owner.id, cand.cardName),
                       'con-ptsel__slot--locked': isChosen(cand.cardName),
                     }"
                     :data-zoom-slot="cand.slotKey">
                  <!-- THE LIVE MODEL, so the card's OWN capsule (bottom-left,
                       beside the expansion stamp — the premium face's service
                       anchor) states the real count. It used to receive only a
                       name, so every candidate printed a permanent «0» there
                       and the true number had to be repeated by a second chip
                       somewhere else on the same card. One counter, one place,
                       on every surface. -->
                  <ConsoleCardFaceLite :name="cand.cardName" :card="cand.model" />
                  <span v-if="isChosen(cand.cardName)" class="con-ptsel__lock" aria-hidden="true">{{ pickOrdinal(cand.cardName) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
    </ConsoleScrollArea>

    <!-- ── THE CONTEXTUAL STATUS RAIL — ONE line, permanently present, whose
         only job is «what does the card under the cursor give me, here».
         It states the identity and the contextual impacts, and nothing else:
         no card type (the group says it), no availability reason (everything
         shown is available), no section titles, no clarifying notes, no second
         wording of the same delta. Its height is a fixed row, so moving the
         cursor cannot move the cards. ── -->
    <footer class="con-ptsel__rail" data-unfold-item ref="rail">
      <template v-if="focused !== undefined">
        <span class="con-ptsel__railcard">{{ $t(focused.cardName) }}</span>
        <!-- The owner marker is dropped when there is only one group: it would
             repeat the header two lines above it. -->
        <template v-if="showsOwnerTargets">
          <span class="con-ptsel__railsep" aria-hidden="true">·</span>
          <span class="con-ptsel__railowner" :class="'player_color_' + focusedOwnerColor">{{ focusedOwnerName }}</span>
        </template>
        <!-- …and at the moment of decision, on the focused candidate. The rail
             already names WHOSE card this is one segment to the left, so this
             adds the judgement, not the fact. -->
        <span v-if="focusedSelfHarm" class="con-ptsel__railwarn">⚠ {{ $t('This is your own card') }}</span>
        <template v-if="railImpacts.length > 0">
          <span class="con-ptsel__railarrow" aria-hidden="true">→</span>
          <span class="con-ptsel__railimpacts">
            <span v-for="imp in railImpacts" :key="imp.key" class="con-ptsel__imp"
                  :class="['con-ptsel__imp--' + imp.entity, {'con-ptsel__imp--static': imp.static}]">
              <i v-if="imp.icon" class="con-ptsel__imp-icon" :class="iconClass(imp.icon)" aria-hidden="true"></i>
              <span class="con-ptsel__imp-label">{{ imp.translate === false ? imp.label : $t(imp.label) }}</span>
              <b v-if="imp.from !== undefined && imp.to !== undefined" class="con-ptsel__imp-delta">
                {{ imp.from }}<span aria-hidden="true"> → </span>{{ imp.to }}
              </b>
              <b v-else-if="imp.amount !== undefined" class="con-ptsel__imp-delta">{{ imp.amount > 0 ? '+' : '' }}{{ imp.amount }}</b>
            </span>
            <span v-if="railOverflow > 0" class="con-ptsel__imp con-ptsel__imp--more">+{{ railOverflow }}</span>
          </span>
        </template>
      </template>
    </footer>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE PLAYED-TARGET STEP — the reusable embedded step for «point at a card
 * that is already on the table».
 *
 * It renders a MODEL and reports focus + selection upward; it contains no game rules
 * and no card names. Eligibility arrives from the server's own candidate set,
 * the contextual preview arrives pre-built from the host (which owns the game
 * knowledge), and the layout decision arrives from the pure planner. That is
 * what makes the same component serve Industrial Robots today, Predators next,
 * and the Blue Actions Workspace after that — the only thing a new host writes
 * is a preview builder.
 *
 * IT IS NOT A TABLEAU. Only eligible candidates render, so a thirty-card table
 * with two legal targets mounts two faces. The heavy «Разыграно» surfaces keep
 * their own architecture for their own (very different) job.
 *
 * TWO THINGS THIS COMPONENT OWNS, because only it can:
 *
 *  · THE SIZE. Card size is not a per-profile CSS constant — it is what the
 *    candidate count and the measured zone jointly allow (`planPlayedTargetSizing`).
 *    Two candidates on a 4K band get two big faces; ten get a grid. Measured
 *    once at mount and on real layout changes, published as `--con-ptsel-zoom`
 *    BEFORE the first painted frame, so the entrance never re-lays out.
 *  · THE GEOMETRY. Directional navigation is resolved against the cards' real
 *    boxes (`stepPlayedTargetFocusAt`), pulled by the host through `cells()`
 *    and cached until the layout genuinely changes. Index arithmetic cannot
 *    describe a layout it does not own — that is why Down did nothing while two
 *    candidates sat visibly one above the other.
 *
 * PHYSICALITY, with the RIGHT semantics. A card chosen from hand is TAKEN; a
 * played card being targeted is NOT — it stays in its owner's tableau. So the
 * focused candidate lifts a little inside its own group and takes a ring; it
 * never leaves, never flies to the source card, and confirming locks it in
 * place rather than carrying it away.
 *
 * Control grammar (published by the host to the ONE command bar): D-pad = move
 * (crossing between owner groups in split view) · LB/RB = owner tabs (tabbed
 * view only) · A = choose · X = inspect · B = back to the play step.
 */
import {defineComponent, PropType, markRaw} from 'vue';
import {useResizeObserver} from '@vueuse/core';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ConsoleCardResourceChip from '@/client/components/console/played/ConsoleCardResourceChip.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateTextWithParams} from '@/client/directives/i18n';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {setPlayedTargetSelfLink, bumpPlayedTargetSelfGeometry, resetPlayedTargetSelf} from '@/client/console/played/consolePlayedTargetSelf';
import {
  PlayedTargetModel, PlayedTargetLayout, PlayedTargetFocus, PlayedTargetOwner,
  PlayedTargetCandidate, PlayedTargetSection, PlayedTargetSelection,
  PlayedTargetSizing, PlayedTargetCell, PlayedTargetQuickImpact,
  PLAYED_TARGET_RAIL_IMPACT_CAP, PLAYED_TARGET_FOCUS_SCALE, playedTargetSelfBox,
  playedTargetSections, playedTargetShowsCategoryRails, playedTargetAt,
  playedTargetShowsOwnerTargetCount, playedTargetShowsResource,
  playedTargetQuickImpacts, planPlayedTargetSizing,
} from '@/client/console/played/consolePlayedTargetModel';

/** The sizing used until the first measurement lands (one frame, at most). */
/** The premium face's unzoomed width — the section span is counted in these. */
const SLOT_W_PX = 320;
/** `.con-ptsel { gap: .55rem }` at the 20 px rem base — mirrored here so the
 *  budget subtracts the gaps the column will actually draw. */
const PTSEL_COLUMN_GAP_PX = 11;

const UNMEASURED: PlayedTargetSizing =
  {cardZoom: 0.58, gapPx: 11, sectionFlow: 'rows', sectionColumns: 1, rows: 1, perRow: 3, overflows: false};

export default defineComponent({
  name: 'ConsolePlayedTargetStep',
  components: {ConsoleCardFaceLite, ConsoleCardResourceChip, GamepadGlyph, ConsoleScrollArea},
  props: {
    model: {type: Object as PropType<PlayedTargetModel>, required: true},
    layout: {type: Object as PropType<PlayedTargetLayout>, required: true},
    focus: {type: Object as PropType<PlayedTargetFocus>, required: true},
    /**
     * HOW MANY the step asks for. `single` (A chooses and closes) or the
     * server's merged up-to-N ask (A toggles, RT confirms) — the shape follows
     * the prompt, never a per-card rule here.
     */
    selection: {type: Object as PropType<PlayedTargetSelection>, default: () => ({mode: 'single'} as PlayedTargetSelection)},
    /**
     * THE VERTICAL BUDGET, measured by the host on a STRETCHED box before this
     * step was visible.
     *
     * It is a prop and not a self-measurement on purpose. Everything between
     * this component and the workspace band is content-sized, so any height
     * this component could read is a height its own cards produced — a cycle
     * whose fixpoint depends on the unmeasured first render. It settled LOWER
     * for one candidate than for two (one stacked block is a shorter column
     * than two), which is exactly why a lone target came out smaller than each
     * of a pair. The host owns the band; the step owns what goes in it.
     */
    bandHeight: {type: Number, default: 0},
    /** The already-confirmed target of a SINGLE step (a re-entry from «Изменить
     *  выбор»); in multi the picks live in `selection.picked`. */
    lockedCard: {type: String, default: ''},
  },
  data() {
    return {
      sizing: UNMEASURED as PlayedTargetSizing,
      /** The measured cells, rebuilt only when the layout genuinely changed. */
      cellCache: undefined as ReadonlyArray<PlayedTargetCell> | undefined,
      stopResizeObs: undefined as (() => void) | undefined,
      /** The step's own vertical CAP, measured against the stretched band. */
      budgetPx: 0,
    };
  },
  computed: {
    /** SPLIT shows every owner side by side; TABS shows the active one. */
    visibleOwners(): ReadonlyArray<PlayedTargetOwner> {
      return this.layout.mode === 'split' ?
        this.model.owners :
        this.model.owners.filter((o) => o.id === this.activeOwnerId);
    },
    activeOwnerId(): string {
      return this.focus.ownerId;
    },
    focused(): PlayedTargetCandidate | undefined {
      return playedTargetAt(this.focus, this.model.owners);
    },
    focusedOwner(): PlayedTargetOwner | undefined {
      return this.model.owners.find((o) => o.id === this.focus.ownerId);
    },
    focusedOwnerName(): string {
      return this.focusedOwner?.name ?? '';
    },
    focusedOwnerColor(): string {
      return this.focusedOwner?.color ?? 'neutral';
    },
    /** Several owners → the per-owner and per-focus markers earn their place. */
    showsOwnerTargets(): boolean {
      return playedTargetShowsOwnerTargetCount(this.model.owners);
    },
    /** «3 доступные цели у 2 игроков» — the scope, in one honest line. */
    scopeLine(): string {
      const {targetCount, ownerCount} = this.model.contract;
      return ownerCount > 1 ?
        translateTextWithParams('${0} targets across ${1} players', [String(targetCount), String(ownerCount)]) :
        translateTextWithParams('${0} available targets', [String(targetCount)]);
    },
    /** The focused candidate's contextual effect — the rail's whole payload. */
    railQuick(): ReadonlyArray<PlayedTargetQuickImpact> {
      return this.focused === undefined ? [] : playedTargetQuickImpacts(this.focused.preview);
    },
    /** The focused candidate belongs to the viewer AND this step takes from it. */
    focusedSelfHarm(): boolean {
      return this.model.owners.some((o) => o.id === this.focus.ownerId && o.selfHarm);
    },
    railImpacts(): ReadonlyArray<PlayedTargetQuickImpact> {
      return this.railQuick.slice(0, PLAYED_TARGET_RAIL_IMPACT_CAP);
    },
    railOverflow(): number {
      return Math.max(0, this.railQuick.length - PLAYED_TARGET_RAIL_IMPACT_CAP);
    },
    /**
     * THE SOLVED CELL WIDTH — derived ONCE.
     *
     * Two consumers must agree on it exactly or the reflow fix comes undone:
     * the section's inline SPAN (`cols × this + gaps`, which is where the flex
     * row wraps) and the proxy's CSS bound (`--con-ptsel-slot-w`). Two hand-
     * written copies of `SLOT_W_PX * cardZoom` is precisely how a rounding step
     * added to one of them would let the proxy exceed a card width again — with
     * the stylesheet guard still green, because it asserts the CSS rather than
     * the agreement between two derivations.
     */
    cardWidthPx(): number {
      return SLOT_W_PX * this.sizing.cardZoom;
    },
    /** Is a PHYSICAL card standing in the row beside the proxy? That, and only
     *  that, is what makes the solved cell width binding on it: with no card
     *  there is no shared column and nothing the row could wrap on. */
    hasCardCandidates(): boolean {
      return (this.model?.owners ?? []).some((o) =>
        o.candidates.some((c) => c.relation !== 'source-card'));
    },
    /** The proxy's box — one derivation, shared by the tokens and the guards. */
    selfBox(): {w: number, h: number} {
      return playedTargetSelfBox({
        cardWidthPx: this.cardWidthPx,
        hasCardCandidates: this.hasCardCandidates,
        ui: conUiScale(),
      });
    },
    /** The measured size, handed to CSS. One writer, so the cards, the gaps and
     *  the badge de-zoom can never disagree about how big a candidate is. */
    sizeVars(): Record<string, string> {
      return {
        '--con-ptsel-zoom': this.sizing.cardZoom.toFixed(3),
        '--con-ptsel-gap': `${this.sizing.gapPx.toFixed(2)}px`,
        '--con-ptsel-focus-scale': String(PLAYED_TARGET_FOCUS_SCALE),
        // THE SOLVED CELL WIDTH, in the layout's own px. Every cell of the
        // candidate row is exactly this wide — the section's inline span is
        // `cols × this + gaps`, so anything that renders WIDER than it wraps the
        // row. The self-target proxy is the one cell whose content is text, so
        // it is the one cell that has to be TOLD the number instead of getting
        // it from a card face. Published here because this is the only place
        // that knows it: the size is solved, never a CSS constant.
        '--con-ptsel-slot-w': `${this.cardWidthPx.toFixed(2)}px`,
        // THE PROXY'S OWN BOX — a slot in the same grid, solved by the one
        // module that owns this layout's numbers. It is NOT the card fit: that
        // fit is height-bound, so a lone proxy in a short band inherited a
        // small card's width and collapsed to a text-sized pill with hundreds
        // of px free beside it.
        '--con-ptsel-self-w': `${this.selfBox.w.toFixed(2)}px`,
        '--con-ptsel-self-h': `${this.selfBox.h.toFixed(2)}px`,
        // The CAP, not a fixed height: a short step still hugs its cards (the
        // rail sits right under them, exactly as before), and a tall one stops
        // growing and hands the excess to the candidate viewport's scroll.
        ...(this.budgetPx > 0 ? {'--con-ptsel-max-h': `${Math.round(this.budgetPx)}px`} : {}),
      };
    },
    /** «Выбрано 1 из 2» — the live accumulation of a multi ask. */
    pickedLine(): string {
      if (this.selection.mode !== 'multi') {
        return '';
      }
      return translateTextWithParams('Selected ${0} of ${1}',
        [String(this.selection.picked.length), String(this.selection.max)]);
    },
    atCap(): boolean {
      return this.selection.mode === 'multi' && this.selection.picked.length >= this.selection.max;
    },
    /** The state of the SELF-TARGET link, as one value the watcher can publish
     *  to the composer that owns the real source card. */
    selfLink(): {present: boolean, focused: boolean, locked: boolean} {
      const self = this.model.owners
        .flatMap((o) => o.candidates)
        .find((c) => c.relation === 'source-card');
      if (self === undefined) {
        return {present: false, focused: false, locked: false};
      }
      return {
        present: true,
        focused: this.focused?.cardName === self.cardName,
        locked: this.isChosen(self.cardName),
      };
    },
  },
  watch: {
    // The four events that genuinely change the geometry — and nothing else.
    // (A focus move does not: the cell boxes are what focus moves BETWEEN.)
    model() {
      this.invalidateGeometry();
      this.measureSizing();
    },
    'layout.mode'() {
      this.invalidateGeometry();
      this.measureSizing();
    },
    bandHeight() {
      this.measureSizing();
    },
    /**
     * THE SELF LINK. The handle cannot reach the source card (it lives one
     * level up, in the composer's hero slot), so the fact is published and the
     * composer lights the REAL card. Immediate: the very first frame of a
     * self-target-only step must already show the link.
     */
    selfLink: {
      immediate: true,
      handler(v: {present: boolean, focused: boolean, locked: boolean}) {
        setPlayedTargetSelfLink(v);
      },
    },
    activeOwnerId() {
      this.invalidateGeometry();
    },
    'sizing.cardZoom'() {
      this.invalidateGeometry();
    },
    'sizing.sectionFlow'() {
      this.invalidateGeometry();
    },
  },
  mounted() {
    // BEFORE the first painted frame: the host's entrance cascade builds its
    // 0-state from `[data-unfold-item]` a frame later, so the size it captures
    // is already final and the surface never re-lays out mid-reveal.
    this.measureSizing();
    // The RESPONSIVE path — the band itself changing (a profile switch, the
    // rail lifting). Never a manual window listener: the observer answers for
    // the element that actually carries the budget.
    const zone = this.$refs.zone as HTMLElement | undefined;
    if (zone !== undefined) {
      this.stopResizeObs = useResizeObserver(zone, () => {
        this.measureSizing();
        this.invalidateGeometry();
      }).stop;
    }
  },
  beforeUnmount() {
    this.stopResizeObs?.();
    this.stopResizeObs = undefined;
    resetPlayedTargetSelf();
  },
  methods: {
    /**
     * THE HOST'S GEOMETRY PULL. Cached: rebuilt only after a mount, a real
     * layout change, an owner-tab switch or a candidate-set change — never per
     * input press.
     */
    cells(): ReadonlyArray<PlayedTargetCell> {
      if (this.cellCache !== undefined) {
        return this.cellCache;
      }
      const root = this.$el as HTMLElement | undefined;
      const out: Array<PlayedTargetCell> = [];
      for (const el of Array.from(root?.querySelectorAll<HTMLElement>('[data-ptsel-cell]') ?? [])) {
        const ownerId = el.dataset.owner;
        const index = Number(el.dataset.index);
        if (ownerId === undefined || !Number.isFinite(index)) {
          continue;
        }
        const r = el.getBoundingClientRect();
        out.push({ownerId, index, left: r.left, top: r.top, width: r.width, height: r.height});
      }
      this.cellCache = markRaw(out);
      return this.cellCache;
    },
    /**
     * The measured boxes expired.
     *
     * The self-target CONNECTOR measures real elements across two columns, so
     * it is invalidated by exactly the same four events as the navigation cells
     * — a new model, a re-solved size, an owner-tab switch, a resize. Focus and
     * selection are deliberately not among them: they may not move anything,
     * and a re-measure per cursor press would be a measurement the layout never
     * asked for.
     */
    invalidateGeometry(): void {
      this.cellCache = undefined;
      bumpPlayedTargetSelfGeometry();
    },
    /**
     * Keep the cursored candidate inside the CANDIDATE VIEWPORT — the step's
     * own scroller, not the composer's. The host calls this after a move; with
     * the rail and the contract fixed outside, this is the only thing a cursor
     * move may ever scroll.
     */
    ensureFocusVisible(): void {
      void this.$nextTick(() => {
        const area = this.$refs.viewport as {ensureVisible?: (el: Element | null | undefined) => void} | undefined;
        const el = (this.$el as HTMLElement | undefined)?.querySelector('[data-ptsel-cell][data-focused]');
        area?.ensureVisible?.(el);
      });
    },
    /** Right-stick scroll, routed by the host while the step owns the screen. */
    scrollBy(dy: number): void {
      (this.$refs.viewport as {scrollByPx?: (d: number) => void} | undefined)?.scrollByPx?.(dy);
    },
    /**
     * Solve the card size against the real box.
     *
     * WIDTH is measured here (the zone is stretched, so its width is the band's
     * and no card can move it). HEIGHT arrives from the host — see `bandHeight`.
     *
     * The step's OWN chrome is measured and subtracted: a contract line, the
     * owner tabs and the status rail. All three are text at a fixed size, so
     * none of them depends on how big the cards turned out — which is what
     * keeps this acyclic even though it reads the live DOM.
     */
    measureSizing(): void {
      const zone = this.$refs.zone as HTMLElement | undefined;
      const root = this.$el as HTMLElement | undefined;
      if (zone === undefined || root?.closest === undefined) {
        return;
      }
      const availW = zone.clientWidth;
      // No band, no honest budget: a bare unit mount keeps the default rather
      // than sizing itself from a box it produced.
      if (availW <= 0 || this.bandHeight <= 0) {
        return;
      }
      /**
       * THE STEP'S OWN CAP — «the bottom of whatever will actually clip me,
       * minus where I start», and never taller than that box itself.
       *
       * ⚠️ IT USED TO BE THE BAND'S BOTTOM, and the step does not live on the
       * band. In the action host it sits FOUR boxes deeper, inside the stage
       * plate's own scroll area, whose viewport ends `.6rem` above the band
       * (the plate's bottom padding). Sizing against the band therefore
       * licensed the step to grow PAST its own container: the outer scroller
       * gained ~12–24 px of travel — a SECOND vertical rail beside this step's
       * own, with only two target cards on screen — and what it clipped was the
       * last element of this column: the status rail, i.e. the Result line.
       *
       * The clip box is the honest reference precisely because it is the thing
       * that decides whether anything scrolls. The band stays in the `min` for
       * the host that stretches its scroller to the band (the play path), where
       * the two agree anyway.
       *
       * ACYCLIC, and the clamp is what makes it so. `root.top` is read while
       * this step sits INSIDE that scroller, so a scrolled viewport would hand
       * back a LARGER budget → a taller step → more to scroll → larger still.
       * Bounding the budget by the clip box's own height breaks that loop by
       * construction, at every scroll position.
       */
      const band = root.closest<HTMLElement>('[data-ws-band]');
      // EVERY BOTTOM EDGE BETWEEN THIS STEP AND THE BAND. The band's bottom is
      // the honest floor, but the step does not sit ON it: in the action host
      // the stage plate wraps it and keeps `.6rem` of padding below, so a step
      // sized to the band's bottom ends `.6rem` past the box that clips it. The
      // outer scroller then gained travel — a SECOND rail with two cards on
      // screen — and cut the last element of this column, the Result line.
      //
      // ⚠️ PADDINGS AND BORDERS ONLY, and that is the whole reason this is safe:
      // they are fixed by the layout, so none of them is a function of the size
      // this measurement is about to produce. (Reading the scroll VIEWPORT's own
      // height instead is the tempting version and it is circular — that box is
      // `flex: 0 1 auto`, i.e. content-sized, so it reports back whatever the
      // cards last came out as. It collapsed the budget until a two-card row
      // stacked vertically.)
      let inset = 0;
      for (let el = root.parentElement; el !== null && el !== band; el = el.parentElement) {
        const cs = getComputedStyle(el);
        inset += (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
      }
      const budget = Math.max(160, band !== null ?
        band.getBoundingClientRect().bottom - root.getBoundingClientRect().top - inset :
        this.bandHeight);
      this.budgetPx = budget;
      const chrome = (this.$refs.contract as HTMLElement | undefined)?.offsetHeight ?? 0;
      const tabs = (this.$refs.tabs as HTMLElement | undefined)?.offsetHeight ?? 0;
      const rail = (this.$refs.rail as HTMLElement | undefined)?.offsetHeight ?? 0;
      // The column gaps of `.con-ptsel` — one FEWER than its children, and the
      // owner-tabs row is conditional. It was hardcoded to 3, which handed back
      // 11 px of phantom room on every single-owner step (the common case).
      const gaps = (tabs > 0 ? 3 : 2) * PTSEL_COLUMN_GAP_PX * conUiScale();
      // The RAIL IS RESERVED FIRST. Its height comes out of the budget before a
      // single card is sized — the cards get what is left, never the other way
      // round. That ordering is what stops an oversized candidate from pushing
      // the reading of it off the screen.
      const availH = Math.max(120, budget - chrome - tabs - rail - gaps);
      this.sizing = planPlayedTargetSizing({
        owners: this.model.owners,
        mode: this.layout.mode,
        availW,
        availH,
        ui: conUiScale(),
        handheld: consoleLayoutState.profile === 'handheld',
      });
    },
    /** Chosen = the confirmed single target, or a member of the multi pick. */
    isChosen(cardName: string): boolean {
      return this.selection.mode === 'multi' ?
        this.selection.picked.includes(cardName) :
        cardName === this.lockedCard;
    },
    /** In a multi ask the badge carries the ORDER — «первое / второе событие»
     *  is what the server's own slots mean, so the player can see which is
     *  which without reading the prompt again. A single ask just ticks. */
    pickOrdinal(cardName: string): string {
      if (this.selection.mode !== 'multi') {
        return '✓';
      }
      const at = this.selection.picked.indexOf(cardName);
      return at < 0 ? '✓' : String(at + 1);
    },
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
    showsResource(cand: PlayedTargetCandidate): boolean {
      return playedTargetShowsResource(cand.resourceContext);
    },
    sectionsOf(owner: PlayedTargetOwner): ReadonlyArray<PlayedTargetSection> {
      return playedTargetSections(owner);
    },
    /**
     * A category's WIDTH IS ITS SPAN — the columns its own cards need at the
     * solved row count, not an equal share of the band.
     *
     * This is the visual half of the layout fix. A two-card category gets two
     * card widths; a one-card category gets one. Bounding the section to
     * exactly that width is what makes the flex row inside it wrap at the right
     * place, so the cards land in the grid the solver actually planned.
     */
    sectionStyle(section: PlayedTargetSection): Record<string, string> {
      const cols = Math.max(1, Math.ceil(section.candidates.length / Math.max(1, this.sizing.rows)));
      const cardW = this.cardWidthPx;
      // CEIL plus a pixel of slack: the cards row wraps at exactly this
      // width, so a half-pixel of rounding the other way would push the last
      // card of a span onto a second line — the very stack this span exists
      // to prevent.
      return {width: `${Math.ceil(cols * cardW + (cols - 1) * this.sizing.gapPx) + 1}px`};
    },
    showsRails(owner: PlayedTargetOwner): boolean {
      return playedTargetShowsCategoryRails(playedTargetSections(owner));
    },
    /** The candidate's index in its OWNER's list — the focus vocabulary. The
     *  cards render grouped by category, so a section-local index would name a
     *  different card than the one the host is pointing at. */
    indexOf(owner: PlayedTargetOwner, cardName: string): number {
      return owner.candidates.findIndex((c) => c.cardName === cardName);
    },
    isFocused(ownerId: string, cardName: string): boolean {
      return this.focus.ownerId === ownerId && this.focused?.cardName === cardName;
    },
  },
});
</script>

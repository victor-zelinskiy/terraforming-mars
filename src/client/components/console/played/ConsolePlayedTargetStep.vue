<template>
  <!-- THE EMBEDDED PLAYED-TARGET STEP — a level of the Card Play Workspace,
       not a surface over it. No band geometry, no plate, no backdrop, no
       `con-ws` marker: the workspace it stands in already owns all of those,
       and the source card stays visible to its left throughout. -->
  <div class="con-ptsel"
       :data-mode="layout.mode"
       :data-flow="sizing.sectionFlow"
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
      <div class="con-ptsel__contract-ask">{{ model.contract.ask }}</div>
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
          <!-- «РАЗЫГРАНО 9» — the one thing only this line says: these cards
               come off a real, larger table. The eligible count joins it ONLY
               when there are several owners, where it stops being a repeat of
               the contract's total and starts answering «where are they». -->
          <span class="con-ptsel__ownercount">
            <i>{{ $t('Played') }}</i><b>{{ owner.totalPlayed }}</b>
            <template v-if="showsOwnerTargets">
              <span class="con-ptsel__ownercount-sep" aria-hidden="true">·</span>
              <i>{{ $t('Selectable') }}</i><b class="con-ptsel__ownercount-live">{{ owner.candidates.length }}</b>
            </template>
          </span>
        </header>

        <div class="con-ptsel__sections">
          <div v-for="section in sectionsOf(owner)" :key="section.category" class="con-ptsel__section">
            <div v-if="showsRails(owner)" class="con-ptsel__catrail">
              <span class="con-ptsel__catname">{{ $t(section.label) }}</span>
              <span class="con-ptsel__catcount">{{ section.candidates.length }}</span>
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
                <!-- THE SELF-TARGET HANDLE. The source card is already standing
                     in the workspace's hero slot; drawing it AGAIN at full size
                     would put two copies of one physical object on one screen.
                     So this candidate is a HANDLE that points at the real card
                     — a full navigation stop with its own focus, its own A, its
                     own lock, and a link marker instead of a face. -->
                <div v-if="cand.relation === 'source-card'"
                     class="con-ptsel__self"
                     :class="{
                       'con-ptsel__self--focused': isFocused(owner.id, cand.cardName),
                       'con-ptsel__self--locked': isChosen(cand.cardName),
                     }"
                     :data-zoom-slot="cand.slotKey">
                  <span class="con-ptsel__self-link" aria-hidden="true">↰</span>
                  <span class="con-ptsel__self-body">
                    <span class="con-ptsel__self-kicker">{{ $t('This card') }}</span>
                    <span class="con-ptsel__self-name">{{ $t(cand.cardName) }}</span>
                  </span>
                  <span v-if="showsResource(cand)" class="con-ptsel__self-res">
                    <i v-if="cand.resourceContext?.icon" class="con-ptsel__res-icon" :class="iconClass(cand.resourceContext.icon)" aria-hidden="true"></i>
                    <b>{{ cand.resourceContext?.count }}</b>
                  </span>
                  <span v-if="isChosen(cand.cardName)" class="con-ptsel__self-check" aria-hidden="true">{{ pickOrdinal(cand.cardName) }}</span>
                </div>
                <div v-else
                     class="con-ptsel__slot"
                     :class="{
                       'con-ptsel__slot--focused': isFocused(owner.id, cand.cardName),
                       'con-ptsel__slot--locked': isChosen(cand.cardName),
                     }"
                     :data-zoom-slot="cand.slotKey">
                  <ConsoleCardFaceLite :name="cand.cardName" />
                  <!-- CONTEXT-DRIVEN only: a resource badge appears when the
                       resource IS the choice, never because the card has a
                       counter (that painted a gold «0» on every building). -->
                  <span v-if="showsResource(cand)" class="con-ptsel__res">
                    <i v-if="cand.resourceContext?.icon" class="con-ptsel__res-icon" :class="iconClass(cand.resourceContext.icon)" aria-hidden="true"></i>
                    <b>{{ cand.resourceContext?.count }}</b>
                  </span>
                  <span v-if="isChosen(cand.cardName)" class="con-ptsel__lock" aria-hidden="true">{{ pickOrdinal(cand.cardName) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

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
        <template v-if="railImpacts.length > 0">
          <span class="con-ptsel__railarrow" aria-hidden="true">→</span>
          <span class="con-ptsel__railimpacts">
            <span v-for="imp in railImpacts" :key="imp.key" class="con-ptsel__imp" :class="'con-ptsel__imp--' + imp.entity">
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
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateTextWithParams} from '@/client/directives/i18n';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {setPlayedTargetSelfFocus, setPlayedTargetSelfLock, resetPlayedTargetSelf} from '@/client/console/played/consolePlayedTargetSelf';
import {
  PlayedTargetModel, PlayedTargetLayout, PlayedTargetFocus, PlayedTargetOwner,
  PlayedTargetCandidate, PlayedTargetSection, PlayedTargetSelection,
  PlayedTargetSizing, PlayedTargetCell, PlayedTargetQuickImpact,
  PLAYED_TARGET_RAIL_IMPACT_CAP, PLAYED_TARGET_FOCUS_SCALE,
  playedTargetSections, playedTargetShowsCategoryRails, playedTargetAt,
  playedTargetShowsOwnerTargetCount, playedTargetShowsResource,
  playedTargetQuickImpacts, planPlayedTargetSizing,
} from '@/client/console/played/consolePlayedTargetModel';

/** The sizing used until the first measurement lands (one frame, at most). */
const UNMEASURED: PlayedTargetSizing =
  {cardZoom: 0.58, gapPx: 11, sectionFlow: 'rows', sectionColumns: 1, perRow: 3, overflows: false};

export default defineComponent({
  name: 'ConsolePlayedTargetStep',
  components: {ConsoleCardFaceLite, GamepadGlyph},
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
    railImpacts(): ReadonlyArray<PlayedTargetQuickImpact> {
      return this.railQuick.slice(0, PLAYED_TARGET_RAIL_IMPACT_CAP);
    },
    railOverflow(): number {
      return Math.max(0, this.railQuick.length - PLAYED_TARGET_RAIL_IMPACT_CAP);
    },
    /** The measured size, handed to CSS. One writer, so the cards, the gaps and
     *  the badge de-zoom can never disagree about how big a candidate is. */
    sizeVars(): Record<string, string> {
      return {
        '--con-ptsel-zoom': this.sizing.cardZoom.toFixed(3),
        '--con-ptsel-gap': `${this.sizing.gapPx.toFixed(2)}px`,
        '--con-ptsel-focus-scale': String(PLAYED_TARGET_FOCUS_SCALE),
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
    selfLink(): {focused: boolean, locked: boolean} {
      const self = this.model.owners
        .flatMap((o) => o.candidates)
        .find((c) => c.relation === 'source-card');
      if (self === undefined) {
        return {focused: false, locked: false};
      }
      return {
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
      handler(v: {focused: boolean, locked: boolean}) {
        setPlayedTargetSelfFocus(v.focused);
        setPlayedTargetSelfLock(v.locked);
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
    invalidateGeometry(): void {
      this.cellCache = undefined;
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
      if (zone === undefined) {
        return;
      }
      const availW = zone.clientWidth;
      // No band, no honest budget: a bare unit mount keeps the default rather
      // than sizing itself from a box it produced.
      if (availW <= 0 || this.bandHeight <= 0) {
        return;
      }
      const chrome = (this.$refs.contract as HTMLElement | undefined)?.offsetHeight ?? 0;
      const tabs = (this.$refs.tabs as HTMLElement | undefined)?.offsetHeight ?? 0;
      const rail = (this.$refs.rail as HTMLElement | undefined)?.offsetHeight ?? 0;
      // The column gaps between contract / tabs / zone / rail.
      const gaps = 3 * 11 * conUiScale();
      const availH = Math.max(120, this.bandHeight - chrome - tabs - rail - gaps);
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

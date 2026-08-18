<template>
  <div class="con-recv" :class="{'con-recv--engaged': presenting, 'con-recv--revealed': revealed}" aria-hidden="true">
    <!--
      THE PLAYED TABLEAU RECEIVING & EFFECT RESOLUTION STAGE — the specialized
      final scene of the Card Play Workspace (played-hero host 'workspace').
      NOT the embedded «Разыграно» overview: this surface answers one question
      — «where does this card physically go, and where does its effect then
      arrive?» — so it composes around exactly that:

       - ONE SHELF ROW in canonical family order, every pile bottom-anchored
         to the same table line, captions in a fixed lane underneath. The
         DESTINATION stands IN ITS OWN SLOT of that row, promoted (large): the
         spatial answer «куда легла карта» and «где остальные категории» is
         one picture, and the reserved front anchor sits at a STABLE height
         whatever the stack holds;
       - the destination stack: a capped strip column receding upward + the
         open previous top + the RESERVED FRONT ANCHOR the hero flies into
         (Top Card Handoff is geometric: the previous top simply overflows its
         future strip until the arriving card covers it back);
       - every other family is a COMPACT PILE: the top card's real HEAD BAND
         (a face crop, never a deformation) over closed-pile depth edges;
         events show the sleeve's own top band the same way;
       - EFFECT DELIVERY: a card-target reward physically EMERGES from its
         pile (strip / mini / a foreign owner's mini prepared at prewarm),
         PRESENTS above the shelf, receives the chips into its own stored-
         resource capsule (the count ticks AT the contact — never before the
         flight), and SETTLES back — one visual owner throughout.

      Pre-mounted hidden from the submit's arm (prewarm); the composer's layer
      class is the reveal. Read-only and input-inert — the transaction gates
      the pad. NB the comment lives INSIDE the root: a top-level template
      comment makes the dev build a fragment and $el a comment node.
    -->
    <!-- Owner context — one compact chip, never a second surface title. -->
    <div class="con-recv__owner" data-recv-group>
      <span class="con-status__dot" :class="'player_bg_color_' + viewer.color" aria-hidden="true"></span>
      <span class="con-recv__owner-name">{{ ownerName }}</span>
    </div>

    <!-- The air above the shelf — also the emergence presentation space. -->
    <div class="con-recv__air"></div>

    <!-- ── THE SHELF — one physical row of piles, the destination inline ── -->
    <div class="con-recv__row" ref="row">
      <template v-for="entry in rowEntries" :key="entry.key">
        <!-- THE DESTINATION — the receiving stack, promoted in its own slot. -->
        <div v-if="entry.kind === 'dest'" class="con-recv__dest" data-recv-group ref="dest">
          <!-- EVENTS destination: the face-down pile; the incoming card lands
               face-down on top (the flip rides the hero arc). Depth reads from
               the pile shadowing + the caption count, never loose card crops. -->
          <div v-if="destKey === 'events'" class="con-recv__backcol" :style="{width: plan.slotW + 'px'}">
            <div class="con-recv__backpile" :class="{'con-recv__backpile--deep': stackCount > 1}" :style="{height: plan.cardH + 'px'}">
              <div v-if="stackCount > 0" class="con-card-back con-recv__back"></div>
              <div class="con-recv__front con-recv__front--back"
                   data-recv-front
                   :class="{'con-recv__front--pulse': sourcePulse, 'con-recv__front--seat': stackCount === 0}"
                   :data-played-key="revealed && incoming !== undefined ? incoming.name : undefined">
                <div v-if="revealed" class="con-card-back con-recv__back"></div>
              </div>
            </div>
          </div>

          <!-- FACE-UP destination: slivers → strips → the previous top (its
               open face overflows its strip until the dock) → the front anchor. -->
          <div v-else class="con-recv__stack" :style="{width: plan.slotW + 'px'}">
            <div v-if="view.hiddenCount > 0" class="con-recv__slivers" aria-hidden="true">
              <div class="con-recv__sliver" :style="{height: plan.sliverH + 'px'}"></div>
              <div class="con-recv__sliver" :style="{height: plan.sliverH + 'px'}"></div>
            </div>
            <div v-for="s in view.strips"
                 :key="s"
                 class="con-recv__strip"
                 :data-recv-strip="s"
                 :style="{height: plan.stripH + 'px'}">
              <div class="con-recv__face" :style="{zoom: String(plan.zoom)}" :class="{'con-recv__face--away': emergedName === s}">
                <ConsolePlayedCardLite :name="s" peek />
              </div>
            </div>
            <div v-if="view.prevTop !== undefined"
                 class="con-recv__strip con-recv__strip--prev"
                 :data-recv-strip="view.prevTop"
                 :data-played-key="emergedName === view.prevTop ? undefined : view.prevTop"
                 :class="{'con-recv__strip--accent': targetAccent === view.prevTop}"
                 :style="{height: plan.stripH + 'px'}">
              <div class="con-recv__face" :style="{zoom: String(plan.zoom)}" :class="{'con-recv__face--away': emergedName === view.prevTop}">
                <ConsolePlayedCardLite :name="view.prevTop" :peek="revealed" :card="capsuleModelFor(view.prevTop)" />
              </div>
            </div>
            <div class="con-recv__front"
                 data-recv-front
                 :data-played-key="revealed && incoming !== undefined ? incoming.name : undefined"
                 :class="{'con-recv__front--pulse': sourcePulse}"
                 :style="{height: plan.cardH + 'px'}">
              <div v-if="revealed && incoming !== undefined" class="con-recv__face" :style="{zoom: String(plan.zoom)}">
                <ConsolePlayedCardLite :name="incoming.name" :card="capsuleModelFor(incoming.name)" />
              </div>
            </div>
          </div>

          <div class="con-recv__caption" :class="'con-recv__caption--' + destKey">
            <span class="con-recv__caption-label">{{ $t(destLabel) }}</span>
            <b class="con-recv__caption-count" :key="destCount">{{ destCount }}</b>
          </div>
        </div>

        <!-- A PERIPHERAL PILE — the top card's head band over depth edges. -->
        <div v-else
             class="con-recv__mini"
             :data-recv-mini="entry.mini.id"
             :class="{'con-recv__mini--emerging': emergedMiniId === entry.mini.id, 'con-recv__mini--foreign': entry.mini.ownerColor !== undefined}">
          <div v-if="entry.mini.ownerColor !== undefined" class="con-recv__mini-owner">
            <span class="con-status__dot" :class="'player_bg_color_' + entry.mini.ownerColor" aria-hidden="true"></span>
            <span>{{ entry.mini.ownerName }}</span>
          </div>
          <div class="con-recv__mini-pile" :style="{width: plan.miniW + 'px'}">
            <!-- Face-down family (events): the sleeve's own top band — an
                 aspect-true CROP of the card back, never a stretch. -->
            <div v-if="entry.mini.isEvents"
                 class="con-recv__mini-band con-recv__mini-band--sleeve"
                 :style="{height: plan.miniBandH + 'px'}"></div>
            <div v-else-if="entry.mini.topName !== undefined"
                 class="con-recv__mini-band"
                 :data-recv-ministrip="miniStripKey(entry.mini, entry.mini.topName)"
                 :style="{height: plan.miniBandH + 'px'}">
              <div class="con-recv__face" :style="{zoom: String(plan.miniZoom)}"
                   :class="{'con-recv__face--away': emergedName === entry.mini.topName && emergedMiniId === entry.mini.id}">
                <ConsolePlayedCardLite :name="entry.mini.topName" peek />
              </div>
            </div>
            <!-- Closed-pile thickness — bounded depth edges, never per-card. -->
            <div v-for="d in entry.mini.depth"
                 :key="'d' + d"
                 class="con-recv__mini-edge"
                 :style="{height: plan.miniDepthH + 'px', marginLeft: (d * 3) + 'px', marginRight: (d * 3) + 'px'}"></div>
          </div>
          <div class="con-recv__mini-caption" :class="'con-recv__caption--' + entry.mini.family">
            <span class="con-recv__mini-label">{{ $t(miniLabel(entry.mini)) }}</span>
            <b class="con-recv__mini-count">{{ entry.mini.count }}</b>
          </div>
        </div>
      </template>
    </div>

    <!-- ── THE EMERGENCE LAYER — the effect target physically forward ── -->
    <div v-if="emerged !== undefined"
         ref="emergeEl"
         class="con-recv__emerge"
         :data-played-key="emerged.name">
      <div class="con-recv__face" :style="{zoom: String(plan.zoom)}">
        <ConsolePlayedCardLite :name="emerged.name" :card="capsuleModelFor(emerged.name)" />
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {gsap} from 'gsap';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {buildPlayedZones, PlayedZones} from '@/client/components/console/consolePlayedModel';
import {PlayedCategoryKey, PLAYED_CATEGORY_ORDER, PLAYED_CATEGORY_LABEL} from '@/client/components/console/consolePlayedCategoryModel';
import {
  planReceivingStage, receivingStackView, receivingMinis, foreignTargetMinis,
  familyForCardType, receivingFamilyOf, zoneCards,
  ReceivingPlan, ReceivingStackView, ReceivingMini,
} from '@/client/console/played/receivingStageModel';
import {
  playedHeroState, playedHeroIncomingCard, playedHeroCardTargets, playedHeroCardGainTotals,
  providePlayedHeroTarget, provideReceivingEffectHooks,
} from '@/client/console/played/consolePlayedHero';
import {cardResourceLanded} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {playLandingShowing} from '@/client/console/played/consolePlayOutcomeClaim';
import {HeroRect} from '@/client/console/played/playedHeroModel';
import ConsolePlayedCardLite from '@/client/components/console/played/ConsolePlayedCardLite.vue';

/** Emergence flight (ms @ motion scale 1) — strip → forward presentation. */
const EMERGE_MS = 260;
/** The return leg — a touch quicker (the story is already told). */
const RETURN_MS = 220;
/** The target's confirmation response after its gain arrives. */
const TARGET_SETTLE_MS = 150;
/** The stage emergence (the shelf rises; the destination leads). */
const STAGE_IN_MS = 230;
/** Fallback stage box before the first measure (logical px). */
const FALLBACK_W = 1400;
const FALLBACK_H = 620;

type EmergedTarget = {
  name: CardName,
  /** The mini the card came out of ('' — the destination stack itself). */
  miniId: string,
  /** The anchor rect it must return into (viewport px). */
  home: {x: number, y: number, w: number, h: number},
};

type RowEntry =
  {kind: 'dest', key: string} |
  {kind: 'mini', key: string, mini: ReceivingMini};

export default defineComponent({
  name: 'ConsolePlayedReceivingStage',
  components: {ConsolePlayedCardLite},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  data() {
    return {
      heroState: playedHeroState,
      box: {w: 0, h: 0},
      /** The target currently OUT of its stack (the emergence layer). */
      emerged: undefined as EmergedTarget | undefined,
      /** The prev-top accent for a target that needs no emergence. */
      targetAccent: undefined as CardName | undefined,
      unregisterTarget: undefined as (() => void) | undefined,
      unregisterHooks: undefined as (() => void) | undefined,
      /** One-shot latches per transaction nonce. */
      emergenceRan: false,
      /**
       * THE SETTLED TABLEAU, FROZEN — the arrived card, kept past the end of
       * the hero transaction.
       *
       * The transaction ends when the card has landed and its rewards have
       * resolved, and it CLEARS its own state there (`card`, `revealed`). But
       * the workspace legitimately keeps this scene on screen afterwards while
       * what the play DREW is still coming off the deck (`playLandingHolding`)
       * — and read live, the stage would answer «nothing is arriving» in that
       * window: the front anchor would empty and the card would jump back into
       * the strips behind it, re-laying out a tableau the player is looking at.
       * Reset with the nonce, so a new play never inherits the last one's.
       */
      latchedIncoming: undefined as CardModel | undefined,
      /** …and that it had ARRIVED. Separate from the card on purpose: the card
       *  is known from the lift, the arrival only at the dock, and conflating
       *  them showed the tableau already holding a card that was still in the
       *  air (a filled front anchor and a ticked count on the first frame). */
      latchedRevealed: false,
      /**
       * Per-card totals of THIS play's card-resource gains, latched at the
       * arm (the transaction empties its own copy when the wave starts). A
       * visible target's stored-resource capsule renders `committed − still
       * in flight` and ticks at each chip's own touchdown — the count changes
       * AT the contact, never before the flight.
       */
      latchedGainTotals: {} as Readonly<Record<string, number>>,
    };
  },
  computed: {
    viewer(): PublicPlayerModel {
      return this.playerView.thisPlayer;
    },
    ownerName(): string {
      return participantDisplayName(this.viewer);
    },
    presenting(): boolean {
      // SHOWING, not holding: the scene keeps its content while it dissolves
      // off the stage (the deck has begun dealing) — read live, the front
      // anchor would empty and the card would jump back into the strips
      // mid-fade, which is a re-layout the player watches happen.
      return playLandingShowing();
    },
    revealed(): boolean {
      return this.heroState.revealed || (this.latchedRevealed && this.presenting);
    },
    /** The front card pulses as the EFFECT SOURCE through the result beat. */
    sourcePulse(): boolean {
      return this.heroState.revealed && this.heroState.phase === 'showing-result';
    },
    /** The card the hero is bringing (or has brought — see `latchedIncoming`). */
    incoming(): CardModel | undefined {
      return (playedHeroIncomingCard() as CardModel | undefined) ?? this.latchedIncoming;
    },
    zones(): PlayedZones {
      return buildPlayedZones(this.viewer.tableau);
    },
    /** Destination from the card's TYPE — known before the commit. */
    destKey(): PlayedCategoryKey {
      const name = this.incoming?.name ?? this.heroState.card;
      return familyForCardType(name !== undefined ? getCard(name)?.type : undefined) ?? 'automated';
    },
    destLabel(): string {
      return PLAYED_CATEGORY_LABEL[this.destKey];
    },
    /** Cards LYING in the destination (the incoming excluded — stable across
     *  the commit; see receivingStackView). */
    destCards(): ReadonlyArray<CardModel> {
      const name = this.incoming?.name ?? this.heroState.card;
      return zoneCards(this.zones, this.destKey).filter((c) => c.name !== name);
    },
    stackCount(): number {
      return this.destCards.length;
    },
    /** The caption count — ticks to N+1 exactly at the dock (re-keyed pulse). */
    destCount(): number {
      return this.stackCount + (this.revealed ? 1 : 0);
    },
    plan(): ReceivingPlan {
      return planReceivingStage({
        availW: this.box.w > 0 ? this.box.w : FALLBACK_W * conUiScale(),
        availH: this.box.h > 0 ? this.box.h : FALLBACK_H * conUiScale(),
        stackCount: this.stackCount,
        miniCount: this.minis.length,
        uiScale: conUiScale(),
      });
    },
    view(): ReceivingStackView {
      const name = (this.incoming?.name ?? this.heroState.card ?? '') as CardName;
      return receivingStackView(this.destCards, name, this.plan.maxStrips);
    },
    /** The effect targets of THIS play — from the LATCHED totals, so a
     *  foreign owner's pile stands through the whole scene (the transaction
     *  clears its own copy before the latched view lets go). */
    effectTargets(): ReadonlyArray<CardName> {
      const played = this.incoming?.name ?? this.heroState.card;
      return (Object.keys(this.latchedGainTotals) as Array<CardName>).filter((n) => n !== played);
    },
    /** Peripheral piles: the viewer's other families + foreign owners of
     *  effect targets (known at arm — prepared before anything moves). */
    minis(): ReadonlyArray<ReceivingMini> {
      const own = receivingMinis(this.zones, this.destKey);
      const foreign = foreignTargetMinis(
        this.playerView.players, this.viewer.color, this.effectTargets, buildPlayedZones);
      return [...own, ...foreign];
    },
    /** The shelf row: canonical family order with the DESTINATION inline in
     *  its own slot; foreign owners' piles close the row past a seam. */
    rowEntries(): ReadonlyArray<RowEntry> {
      const out: Array<RowEntry> = [];
      const byFamily = new Map(this.minis.filter((m) => m.ownerColor === undefined).map((m) => [m.family, m]));
      for (const key of PLAYED_CATEGORY_ORDER) {
        if (key === this.destKey) {
          out.push({kind: 'dest', key: 'dest'});
          continue;
        }
        const mini = byFamily.get(key);
        if (mini !== undefined) {
          out.push({kind: 'mini', key: mini.id, mini});
        }
      }
      for (const mini of this.minis) {
        if (mini.ownerColor !== undefined) {
          out.push({kind: 'mini', key: mini.id, mini});
        }
      }
      return out;
    },
    emergedName(): CardName | undefined {
      return this.emerged?.name;
    },
    emergedMiniId(): string | undefined {
      return this.emerged?.miniId;
    },
  },
  watch: {
    /** THE STAGE EMERGENCE — the prepared scene surfaces: the shelf rises as
     *  one table, the destination leads, its strips cascade open. One-shot
     *  per transaction; reduced motion keeps the visibility flip. */
    presenting(now: boolean) {
      if (now && !this.emergenceRan) {
        this.emergenceRan = true;
        void this.$nextTick(() => this.runStageEmergence());
      }
    },
    'heroState.nonce'() {
      this.emergenceRan = false;
      this.emerged = undefined;
      this.targetAccent = undefined;
      this.latchedIncoming = undefined;
      this.latchedRevealed = false;
      this.latchGainTotals();
    },
    /** Freeze the arrived card while the transaction still knows it. */
    'incoming': {
      immediate: true,
      handler(now: CardModel | undefined) {
        if (now !== undefined) {
          this.latchedIncoming = now;
        }
      },
    },
    'heroState.revealed': {
      immediate: true,
      handler(now: boolean) {
        if (now) {
          this.latchedRevealed = true;
        }
      },
    },
  },
  mounted() {
    this.measure();
    this.latchGainTotals();
    this.unregisterTarget = providePlayedHeroTarget(() => this.measureFrontAnchor());
    this.unregisterHooks = provideReceivingEffectHooks({
      emergeTarget: (card) => this.emergeTarget(card),
      settleTarget: (card) => this.settleTarget(card),
    });
  },
  beforeUnmount() {
    this.unregisterTarget?.();
    this.unregisterHooks?.();
    const root = this.$el as HTMLElement | undefined;
    if (root !== undefined && typeof root.querySelectorAll === 'function') {
      gsap.killTweensOf(root.querySelectorAll('[data-recv-group], [data-recv-strip], .con-recv__mini, .con-recv__emerge'));
    }
  },
  methods: {
    miniLabel(m: ReceivingMini): string {
      return PLAYED_CATEGORY_LABEL[m.family];
    },
    /** The destination column element — the `ref` sits inside the row's
     *  `v-for`, so Vue 3 collects it as an ARRAY of one. */
    destEl(): HTMLElement | undefined {
      const r = this.$refs.dest as HTMLElement | ReadonlyArray<HTMLElement> | undefined;
      const el = Array.isArray(r) ? r[0] : r;
      return el === null ? undefined : (el as HTMLElement | undefined);
    },
    miniStripKey(m: ReceivingMini, name: CardName): string {
      return `${m.id}|${name}`;
    },
    /**
     * Latch this play's card-gain totals + WARM the effect targets' arts.
     * The emergence mounts a FULL face for a card the screen has never shown
     * — without the prewarm its art would start decoding on the very frame
     * the flight starts (a guaranteed hitch on 4K), and the prewarm window
     * (the submit round trip) is exactly where that cost is free.
     */
    latchGainTotals(): void {
      this.latchedGainTotals = playedHeroCardGainTotals();
      const targets = playedHeroCardTargets();
      if (targets.length > 0) {
        preloadPremiumCardArt(targets);
      }
    },
    /**
     * The LIVE MODEL of a visible effect target / the landed card — with its
     * stored-resource capsule showing `committed − still in flight`, so the
     * count ticks exactly at each chip's touchdown (`cardResourceLanded` is
     * bumped at the contact beat). Pre-commit the committed view IS the
     * pre-play truth and renders untouched. Undefined for a card that is not
     * in any visible tableau (the face falls back to the printed name-only
     * face — never a wrong number).
     */
    capsuleModelFor(name: CardName | string | undefined): CardModel | undefined {
      if (name === undefined) {
        return undefined;
      }
      const model = this.viewer.tableau.find((c) => c.name === name) ??
        this.playerView.players.flatMap((p) => p.color === this.viewer.color ? [] : p.tableau)
          .find((c) => c.name === name);
      if (model === undefined) {
        return undefined;
      }
      if (!this.revealed) {
        return model;
      }
      const total = this.latchedGainTotals[name] ?? 0;
      if (total <= 0) {
        return model;
      }
      const remaining = Math.max(0, total - cardResourceLanded(name));
      if (remaining <= 0) {
        return model;
      }
      return {...model, resources: Math.max(0, (model.resources ?? 0) - remaining)};
    },
    measure(): void {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.getBoundingClientRect !== 'function') {
        return;
      }
      const r = root.getBoundingClientRect();
      if (r.width > 40 && r.height > 40) {
        this.box = {w: r.width, h: r.height};
      }
    },
    // ── the hero target: the reserved front anchor ─────────────────────
    async measureFrontAnchor(): Promise<HeroRect | undefined> {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelector !== 'function') {
        return undefined;
      }
      this.measure(); // the box may have settled since the prewarm mount
      await this.$nextTick();
      const el = root.querySelector<HTMLElement>('[data-recv-front]');
      if (el === null) {
        return undefined;
      }
      // Stability loop — the arc flies into settled geometry (the stage
      // emergence tween must have finished shaping the rect).
      let last: HeroRect | undefined = undefined;
      for (let i = 0; i < 30; i++) {
        await this.frame();
        const r = el.getBoundingClientRect();
        if (r.width > 4 && last !== undefined &&
            Math.abs(r.left - last.x) < 0.5 && Math.abs(r.top - last.y) < 0.5 &&
            Math.abs(r.width - last.w) < 0.5 && Math.abs(r.height - last.h) < 0.5) {
          return last;
        }
        last = r.width > 4 ? {x: r.left, y: r.top, w: r.width, h: r.height} : undefined;
      }
      return last;
    },
    frame(): Promise<void> {
      return new Promise((resolve) => {
        if (typeof requestAnimationFrame === 'function') {
          requestAnimationFrame(() => resolve());
        } else {
          setTimeout(resolve, 16);
        }
      });
    },
    // ── the stage emergence ────────────────────────────────────────────
    /**
     * The shelf rises as ONE table: the destination leads (a grounded rise
     * out of its own slot — origin at its shelf line, never a float), its
     * strips cascade open from the front, and the neighbour piles follow
     * outward from the destination's position. Transform/opacity only, one
     * bounded set of elements; reduced motion keeps the visibility flip.
     */
    runStageEmergence(): void {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelectorAll !== 'function' || consoleReducedMotionActive()) {
        return; // the layer's visibility flip is the whole entrance
      }
      const dur = motionMs(STAGE_IN_MS) / 1000;
      const ui = conUiScale();
      const dest = this.destEl();
      if (dest !== undefined) {
        gsap.fromTo(dest,
          {autoAlpha: 0, y: 16 * ui, scale: 0.955},
          {autoAlpha: 1, y: 0, scale: 1, transformOrigin: '50% 100%', duration: dur, ease: 'power3.out', clearProps: 'transform,opacity,visibility'});
        const strips = Array.from(dest.querySelectorAll<HTMLElement>('[data-recv-strip]'));
        if (strips.length > 0) {
          // The stack unfolds from the front upward — newest first, a quiet
          // cascade that reads as the pile splaying open, never a re-layout.
          gsap.fromTo(strips.reverse(),
            {y: 7 * ui, opacity: 0},
            {y: 0, opacity: 1, duration: dur * 0.9, ease: 'power2.out', stagger: 0.024, delay: 0.05, clearProps: 'transform,opacity'});
        }
      }
      const minis = Array.from(root.querySelectorAll<HTMLElement>('.con-recv__mini'));
      if (minis.length > 0) {
        // Neighbours follow OUTWARD from the destination's slot — the table
        // spreads from where the eye already is.
        const row = this.$refs.row as HTMLElement | undefined;
        const destIdx = row !== undefined && dest !== undefined ?
          Math.max(0, Array.from(row.children).indexOf(dest)) : 0;
        gsap.fromTo(minis,
          {autoAlpha: 0, y: 10 * ui},
          {
            autoAlpha: 1, y: 0, duration: dur, ease: 'power2.out', delay: 0.05,
            stagger: {each: 0.035, from: Math.min(destIdx, Math.max(0, minis.length - 1))},
            clearProps: 'transform,opacity,visibility',
          });
      }
    },
    // ── effect delivery: target emergence / settle ─────────────────────
    /** The physical anchor a target would emerge FROM (its strip in the
     *  destination stack, its head band in a mini, or the mini block itself
     *  when the card lies deeper than the visible band). */
    findTargetAnchor(card: CardName): {el: HTMLElement, miniId: string} | undefined {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelector !== 'function') {
        return undefined;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
        CSS.escape(card) : card.replace(/"/g, '\\"');
      const strip = root.querySelector<HTMLElement>(`[data-recv-strip="${esc}"]`);
      if (strip !== null) {
        return {el: strip, miniId: ''};
      }
      // Suffix-matched in JS, not with a `$=` attribute selector — the value
      // embeds `|`, which CSS engines disagree about.
      const miniStrip = Array.from(root.querySelectorAll<HTMLElement>('[data-recv-ministrip]'))
        .find((el) => (el.dataset.recvMinistrip ?? '').endsWith(`|${card}`));
      if (miniStrip !== undefined) {
        const mini = miniStrip.closest<HTMLElement>('[data-recv-mini]');
        return {el: miniStrip, miniId: mini?.dataset.recvMini ?? ''};
      }
      // The card is not among the visible bands — it emerges from the DEPTH
      // of its family: the owning mini block (or the destination slivers).
      const mini = this.findOwningMini(card);
      if (mini !== undefined) {
        const el = root.querySelector<HTMLElement>(`[data-recv-mini="${CSS.escape(mini.id)}"]`);
        if (el !== null) {
          return {el, miniId: mini.id};
        }
      }
      const dest = this.destEl();
      return dest !== undefined ? {el: dest, miniId: ''} : undefined;
    },
    findOwningMini(card: CardName): ReceivingMini | undefined {
      return this.minis.find((m) => {
        const owner = m.ownerColor !== undefined ?
          this.playerView.players.find((p) => p.color === m.ownerColor) : this.viewer;
        if (owner === undefined) {
          return false;
        }
        const zones = buildPlayedZones(owner.tableau);
        return receivingFamilyOf(zones, card) === m.family &&
          zoneCards(zones, m.family).some((c) => c.name === card);
      });
    },
    /**
     * TARGET EMERGENCE — the effect target comes physically forward:
     *  - the OPEN previous top needs no emergence (an accent marks it);
     *  - a strip / mini-band target rises out of its band (clip opens
     *    band → card) and PRESENTS above the shelf, over its own pile;
     *  - a depth/mini target rises out of its family block the same way.
     * Resolves when the card stands at its presentation anchor.
     */
    async emergeTarget(card: CardName): Promise<void> {
      this.targetAccent = undefined;
      if (this.view.prevTop === card && this.emerged === undefined) {
        // Already lying open right under the played card — no emergence.
        this.targetAccent = card;
        await this.wait(motionMs(120));
        return;
      }
      const anchor = this.findTargetAnchor(card);
      if (anchor === undefined) {
        return; // degraded: the chips still fly (the aux satellite fallback)
      }
      const measured = anchor.el.getBoundingClientRect();
      const home = {x: measured.left, y: measured.top, w: measured.width, h: measured.height};
      this.emerged = {name: card, miniId: anchor.miniId, home};
      await this.$nextTick();
      const el = this.$refs.emergeEl as HTMLElement | undefined;
      const root = this.$el as HTMLElement | undefined;
      if (el === undefined || root === undefined) {
        return;
      }
      const to = this.emergePresentationRect(el, home);
      // Reduced motion / unmeasurable geometry: the card still PRESENTS at
      // its anchor (one controlled step, no flight) — the story survives.
      if (consoleReducedMotionActive() || home.w < 4 || home.h < 4) {
        gsap.set(el, {x: to.x, y: to.y, autoAlpha: 1});
        return;
      }
      // Band → card: the proxy starts ON the band (clipped to it,
      // width-matched via scale), rises forward and opens to the full face.
      const startScale = home.w > 4 ? home.w / el.offsetWidth : 1;
      const clipFrom = `inset(0 0 ${Math.max(0, 100 - (home.h / Math.max(1, el.offsetHeight * startScale)) * 100)}% 0)`;
      await new Promise<void>((resolve) => {
        gsap.timeline({onComplete: resolve})
          .set(el, {x: home.x, y: home.y, scale: startScale, transformOrigin: '0 0', clipPath: clipFrom, autoAlpha: 1})
          .to(el, {
            x: to.x, y: to.y, scale: 1, clipPath: 'inset(0 0 0% 0)',
            duration: motionMs(EMERGE_MS) / 1000, ease: 'power3.out', clearProps: 'clipPath',
          });
      });
    },
    /**
     * Where the emerged target PRESENTS (viewport px, top-left of the layer):
     * ABOVE THE SHELF, over the pile it came out of — the card physically
     * rises out of its stack into the free air, x clamped to the stage.
     */
    emergePresentationRect(el: HTMLElement, home: {x: number, y: number, w: number, h: number}): {x: number, y: number} {
      const root = (this.$el as HTMLElement).getBoundingClientRect();
      const row = (this.$refs.row as HTMLElement | undefined)?.getBoundingClientRect();
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const gap = 22 * conUiScale();
      const x = Math.max(root.left + 8, Math.min(home.x + home.w / 2 - w / 2, root.right - w - 8));
      const shelfTop = row !== undefined ? row.top : root.bottom - h - gap;
      const y = Math.max(root.top + 8, shelfTop - h - gap);
      return {x, y};
    },
    /**
     * TARGET SETTLE — the gain has arrived: a short confirmation press, then
     * the card returns along the same physical path into its band; the
     * placeholder becomes its real band again in the handoff frame.
     */
    async settleTarget(card: CardName): Promise<void> {
      if (this.targetAccent === card) {
        // The open previous top: the accent releases after a beat.
        await this.wait(motionMs(TARGET_SETTLE_MS));
        this.targetAccent = undefined;
        return;
      }
      const el = this.$refs.emergeEl as HTMLElement | undefined;
      const state = this.emerged;
      if (el === undefined || state === undefined || state.name !== card) {
        this.emerged = undefined;
        return;
      }
      if (consoleReducedMotionActive() || state.home.w < 4 || state.home.h < 4) {
        gsap.set(el, {autoAlpha: 0});
        this.emerged = undefined;
        return;
      }
      const startScale = state.home.w > 4 ? state.home.w / el.offsetWidth : 1;
      const clipTo = `inset(0 0 ${Math.max(0, 100 - (state.home.h / Math.max(1, el.offsetHeight * startScale)) * 100)}% 0)`;
      await new Promise<void>((resolve) => {
        gsap.timeline({onComplete: resolve})
          // The confirmation press — the card takes its gain.
          .to(el, {scale: 1.03, duration: motionMs(TARGET_SETTLE_MS) / 2000, ease: 'power1.out'})
          .to(el, {scale: 1, duration: motionMs(TARGET_SETTLE_MS) / 2000, ease: 'power2.out'})
          // The return leg — back into the very band it came out of.
          .to(el, {
            x: state.home.x, y: state.home.y, scale: startScale, clipPath: clipTo,
            duration: motionMs(RETURN_MS) / 1000, ease: 'power3.inOut',
          })
          .to(el, {autoAlpha: 0, duration: 0.08});
      });
      this.emerged = undefined;
    },
    wait(ms: number): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, ms));
    },
  },
});
</script>

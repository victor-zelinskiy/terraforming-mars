<template>
  <div class="con-recv" :class="{'con-recv--engaged': presenting, 'con-recv--revealed': revealed}" aria-hidden="true">
    <!--
      THE PLAYED TABLEAU RECEIVING & EFFECT RESOLUTION STAGE — the specialized
      final scene of the Card Play Workspace (played-hero host 'workspace',
      iteration 2). NOT the embedded «Разыграно» overview: this surface answers
      one question — «where does this card physically go, and where does its
      effect then arrive?» — so it composes around exactly that:

       - the DESTINATION STACK is the protagonist: large, centred, top-anchored,
         a capped strip column + the open previous top + the RESERVED FRONT
         ANCHOR the hero flies into. The final silhouette is laid out from the
         first frame (Top Card Handoff is geometric: the previous top simply
         overflows its future strip until the arriving card covers it back);
       - every other family is a COMPACT MINI (caption + count + title strips)
         on the periphery — tabletop context, never content columns;
       - EFFECT DELIVERY: for a card-target reward the target physically
         EMERGES from its strip (in this stack, in a mini, or in a foreign
         owner's mini prepared at prewarm), receives the chips between two real
         anchors, and SETTLES back — one visual owner throughout.

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

    <!-- ── THE DESTINATION — the receiving stack, centre stage ── -->
    <div class="con-recv__main">
      <div class="con-recv__dest" data-recv-group ref="dest">
        <div class="con-recv__caption" :class="'con-recv__caption--' + destKey">
          <span class="con-recv__caption-label">{{ $t(destLabel) }}</span>
          <b class="con-recv__caption-count" :key="destCount">{{ destCount }}</b>
        </div>

        <!-- EVENTS destination: the face-down pile; the incoming card lands
             face-down on top (the flip rides the hero arc). Depth reads from
             the pile shadowing + the caption count, never loose card crops. -->
        <div v-if="destKey === 'events'" class="con-recv__backcol" :style="{width: plan.slotW + 'px'}">
          <div class="con-recv__backpile" :class="{'con-recv__backpile--deep': stackCount > 1}" :style="{height: plan.cardH + 'px'}">
            <div v-if="stackCount > 0" class="con-card-back con-recv__back"></div>
            <div class="con-recv__front con-recv__front--back"
                 data-recv-front
                 :class="{'con-recv__front--pulse': sourcePulse}"
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
              <ConsolePlayedCardLite :name="view.prevTop" :peek="revealed" />
            </div>
          </div>
          <div class="con-recv__front"
               data-recv-front
               :data-played-key="revealed && incoming !== undefined ? incoming.name : undefined"
               :class="{'con-recv__front--pulse': sourcePulse}"
               :style="{height: plan.cardH + 'px'}">
            <div v-if="revealed && incoming !== undefined" class="con-recv__face" :style="{zoom: String(plan.zoom)}">
              <ConsolePlayedCardLite :name="incoming.name" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── THE PERIPHERY — compact helper families (+ foreign owners of
         effect targets, prepared at prewarm) ── -->
    <div v-if="minis.length > 0" class="con-recv__minis">
      <div v-for="m in minis"
           :key="m.id"
           class="con-recv__mini"
           :data-recv-mini="m.id"
           :class="{'con-recv__mini--emerging': emergedMiniId === m.id}">
        <div v-if="m.ownerColor !== undefined" class="con-recv__mini-owner">
          <span class="con-status__dot" :class="'player_bg_color_' + m.ownerColor" aria-hidden="true"></span>
          <span>{{ m.ownerName }}</span>
        </div>
        <div class="con-recv__mini-caption" :class="'con-recv__caption--' + m.family">
          <span class="con-recv__mini-label">{{ $t(miniLabel(m)) }}</span>
          <b class="con-recv__mini-count">{{ m.count }}</b>
        </div>
        <div v-if="m.isEvents" class="con-recv__mini-back" :style="{width: plan.miniW + 'px'}">
          <div class="con-card-back con-recv__back"></div>
        </div>
        <div v-else class="con-recv__mini-stack" :style="{width: plan.miniW + 'px'}">
          <div v-for="(n, i) in m.topNames"
               :key="n"
               class="con-recv__mini-strip"
               :data-recv-ministrip="miniStripKey(m, n)"
               :style="{height: plan.miniStripH + 'px', zIndex: i + 1}">
            <div class="con-recv__face" :style="{zoom: String(plan.miniZoom)}" :class="{'con-recv__face--away': emergedName === n && emergedMiniId === m.id}">
              <ConsolePlayedCardLite :name="n" peek />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── THE EMERGENCE LAYER — the effect target physically forward ── -->
    <div v-if="emerged !== undefined"
         ref="emergeEl"
         class="con-recv__emerge"
         :data-played-key="emerged.name">
      <div class="con-recv__face" :style="{zoom: String(plan.zoom)}">
        <ConsolePlayedCardLite :name="emerged.name" />
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
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {buildPlayedZones, PlayedZones} from '@/client/components/console/consolePlayedModel';
import {PlayedCategoryKey, PLAYED_CATEGORY_LABEL} from '@/client/components/console/consolePlayedCategoryModel';
import {
  planReceivingStage, receivingStackView, receivingMinis, foreignTargetMinis,
  familyForCardType, receivingFamilyOf, zoneCards,
  ReceivingPlan, ReceivingStackView, ReceivingMini,
} from '@/client/console/played/receivingStageModel';
import {
  playedHeroState, playedHeroIncomingCard, playedHeroCardTargets,
  providePlayedHeroTarget, provideReceivingEffectHooks,
} from '@/client/console/played/consolePlayedHero';
import {playLandingHolding} from '@/client/console/played/consolePlayOutcomeClaim';
import {HeroRect} from '@/client/console/played/playedHeroModel';
import ConsolePlayedCardLite from '@/client/components/console/played/ConsolePlayedCardLite.vue';

/** Emergence flight (ms @ motion scale 1) — strip → forward presentation. */
const EMERGE_MS = 260;
/** The return leg — a touch quicker (the story is already told). */
const RETURN_MS = 220;
/** The target's confirmation response after its gain arrives. */
const TARGET_SETTLE_MS = 150;
/** The stage emergence (destination from depth / minis fading in). */
const STAGE_IN_MS = 200;
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
      return playLandingHolding();
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
        uiScale: conUiScale(),
      });
    },
    view(): ReceivingStackView {
      const name = (this.incoming?.name ?? this.heroState.card ?? '') as CardName;
      return receivingStackView(this.destCards, name, this.plan.maxStrips);
    },
    /** Peripheral minis: the viewer's other families + foreign owners of
     *  effect targets (known at arm — prepared before anything moves). */
    minis(): ReadonlyArray<ReceivingMini> {
      const own = receivingMinis(this.zones, this.destKey);
      const foreign = foreignTargetMinis(
        this.playerView.players, this.viewer.color, playedHeroCardTargets(), buildPlayedZones);
      return [...own, ...foreign];
    },
    emergedName(): CardName | undefined {
      return this.emerged?.name;
    },
    emergedMiniId(): string | undefined {
      return this.emerged?.miniId;
    },
  },
  watch: {
    /** THE STAGE EMERGENCE — the prepared scene surfaces: the destination
     *  stack comes forward out of depth, the periphery fades in around it.
     *  One-shot per transaction; reduced motion keeps the visibility flip. */
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
      gsap.killTweensOf(root.querySelectorAll('[data-recv-group], .con-recv__mini, .con-recv__emerge'));
    }
  },
  methods: {
    miniLabel(m: ReceivingMini): string {
      return PLAYED_CATEGORY_LABEL[m.family];
    },
    miniStripKey(m: ReceivingMini, name: CardName): string {
      return `${m.id}|${name}`;
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
    runStageEmergence(): void {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelectorAll !== 'function' || consoleReducedMotionActive()) {
        return; // the layer's visibility flip is the whole entrance
      }
      const dur = motionMs(STAGE_IN_MS) / 1000;
      const groups = Array.from(root.querySelectorAll<HTMLElement>('[data-recv-group]'));
      if (groups.length > 0) {
        // The destination surfaces FROM DEPTH — scale only (its front anchor
        // must hold still as early as possible for the flight's measure).
        gsap.fromTo(groups,
          {autoAlpha: 0, scale: 0.975},
          {autoAlpha: 1, scale: 1, transformOrigin: '50% 40%', duration: dur, ease: 'power2.out', clearProps: 'transform,opacity,visibility'});
      }
      const minis = Array.from(root.querySelectorAll<HTMLElement>('.con-recv__mini'));
      if (minis.length > 0) {
        gsap.fromTo(minis,
          {autoAlpha: 0, y: 6 * conUiScale()},
          {autoAlpha: 1, y: 0, duration: dur, ease: 'power2.out', stagger: 0.03, delay: 0.06, clearProps: 'transform,opacity,visibility'});
      }
    },
    // ── effect delivery: target emergence / settle ─────────────────────
    /** The physical anchor a target would emerge FROM (its strip in the
     *  destination stack, its strip in a mini, or the mini block itself when
     *  the card lies deeper than the visible strips). */
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
      // The card is not among the visible strips — it emerges from the DEPTH
      // of its family: the owning mini block (or the destination slivers).
      const mini = this.findOwningMini(card);
      if (mini !== undefined) {
        const el = root.querySelector<HTMLElement>(`[data-recv-mini="${CSS.escape(mini.id)}"]`);
        if (el !== null) {
          return {el, miniId: mini.id};
        }
      }
      const dest = this.$refs.dest as HTMLElement | undefined;
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
     *  - a strip target rises out of its strip (clip opens strip → card);
     *  - a depth/mini target rises out of its family block.
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
      const home = anchor.el.getBoundingClientRect();
      this.emerged = {
        name: card,
        miniId: anchor.miniId,
        home: {x: home.left, y: home.top, w: home.width, h: home.height},
      };
      await this.$nextTick();
      const el = this.$refs.emergeEl as HTMLElement | undefined;
      const root = this.$el as HTMLElement | undefined;
      if (el === undefined || root === undefined) {
        return;
      }
      const to = this.emergePresentationRect(el);
      // Reduced motion / unmeasurable geometry: the card still PRESENTS at
      // its anchor (one controlled step, no flight) — the story survives.
      if (consoleReducedMotionActive() || home.width < 4 || home.height < 4) {
        gsap.set(el, {x: to.x, y: to.y, autoAlpha: 1});
        return;
      }
      // Strip → card: the proxy starts ON the strip (clipped to the band,
      // width-matched via scale), rises forward and opens to the full face.
      const startScale = home.width > 4 ? home.width / el.offsetWidth : 1;
      const clipFrom = `inset(0 0 ${Math.max(0, 100 - (home.height / Math.max(1, el.offsetHeight * startScale)) * 100)}% 0)`;
      await new Promise<void>((resolve) => {
        gsap.timeline({onComplete: resolve})
          .set(el, {x: home.left, y: home.top, scale: startScale, transformOrigin: '0 0', clipPath: clipFrom, autoAlpha: 1})
          .to(el, {
            x: to.x, y: to.y, scale: 1, clipPath: 'inset(0 0 0% 0)',
            duration: motionMs(EMERGE_MS) / 1000, ease: 'power3.out', clearProps: 'clipPath',
          });
      });
    },
    /** Where the emerged target PRESENTS (viewport px, top-left of the layer):
     *  beside the destination stack, front-row — falls back to the other side
     *  when the right lane is too narrow. */
    emergePresentationRect(el: HTMLElement): {x: number, y: number} {
      const root = (this.$el as HTMLElement).getBoundingClientRect();
      const dest = (this.$refs.dest as HTMLElement | undefined)?.getBoundingClientRect();
      const w = el.offsetWidth;
      const gap = 26 * conUiScale();
      if (dest !== undefined) {
        const y = Math.max(root.top + 8, Math.min(dest.top + 40 * conUiScale(), root.bottom - el.offsetHeight - 8));
        const right = dest.right + gap;
        if (right + w <= root.right - 8) {
          return {x: right, y};
        }
        return {x: Math.max(root.left + 8, dest.left - gap - w), y};
      }
      return {x: root.left + (root.width - w) / 2, y: root.top + 40 * conUiScale()};
    },
    /**
     * TARGET SETTLE — the gain has arrived: a short confirmation press, then
     * the card returns along the same physical path into its strip; the
     * placeholder becomes its real strip again in the handoff frame.
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
          // The return leg — back into the very strip it came out of.
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

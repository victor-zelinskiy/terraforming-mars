<template>
  <!-- ══ THE BANNER MODE («ЗНАМЯ», Turmoil Redux Septem Tribus:redux) — the Parliament picks the PARTY whose banner
       takes the viewer's cube (the first action). The objects are the six party PLAQUES where they stand: the cursor
       walks them as the hall lays them out (▲ ▼ the opposition's column, ▶ ◀ the dais — `supportCursorStep`) and
       nothing moves; the plaque under the cursor wears the GHOST of the cube in its banner socket. THIS panel is the
       reading of that plaque — what the cube opens, the party's clauses with their GRAPHIC and words, the FAQ — in the
       voting area's own rect (the bills recede under it). A places the cube; the answer plays on this very stage: the
       CORPORATION stands up in the table's cell and the cube leaves its printed glyph for the socket (`bannerCubeStage`),
       then — when the cube opened the party's effect — the party's seal travels into «ВАШИ ЭФФЕКТЫ» (the access
       scene), and the surface leaves whole. ══ -->
  <div class="con-parl__support con-parl__banner"
       :class="{
         'con-parl__support--committed': flow.bannerCommitted,
         'con-parl__support--live': true,
       }"
       :style="{'--parl-accent': reading !== undefined ? accentOf(reading.party) : undefined}"
       data-parl-banner-mode
       :data-banner-beat="flow.bannerBeat || undefined">
    <div class="con-parl__support-stage">
    <transition name="con-parl-xfade">
      <div v-if="reading !== undefined" :key="reading.party" class="con-parl__support-body"
           data-parl-banner-reading
           :data-banner-party="reading.party"
           :data-banner-available="reading.available ? '' : undefined">
        <div class="con-parl__support-head">
          <img class="con-parl__support-emblem" :src="emblemOf(reading.party)" alt="" />
          <b class="con-parl__support-name">{{ $t(partyNameKey(reading.party)) }}</b>
        </div>
        <!-- WHAT THE CUBE OPENS — the SOCKET as it will stand (the ghost of the viewer's cube before the press: a dashed
             contour + a pale cube, the grammar of an arriving place, no light; the cube itself once it has landed) and
             the consequence in one line; a refused banner names its ONE reason instead. -->
        <span class="con-parl__support-row con-parl__banner-row">
          <span class="con-parl__banner-socket" :class="{'con-parl__banner-socket--ghost': !landed, 'con-parl__banner-socket--seated': landed}" data-parl-banner-socket>
            <PlayerCube v-if="viewerColor !== undefined" :color="viewerColor" :size="20" :glow="false" :shadow="false" />
          </span>
          <span v-if="reading.available" class="con-parl__banner-consequence" data-parl-banner-consequence>{{ $t(consequenceKey) }}</span>
          <span v-else class="con-parl__support-reason con-parl__banner-reason" data-parl-banner-reason>{{ $t(reading.reason ?? 'Your cube already stands on this banner') }}</span>
        </span>
        <!-- WHAT THE PARTY DOES — its clauses as the Charter prints them: each under its engraved label, the GRAPHIC at
             reading size (the ONE formula renderer) with its words beside it (the party's own text, never a paraphrase). -->
        <div class="con-parl__banner-clauses" :data-banner-clauses="clauses.length">
          <section v-for="clause in clauses" :key="clause.kind" class="con-parl__banner-clause" :class="'con-parl__banner-clause--' + clause.kind" :data-banner-clause="clause.kind">
            <span class="con-parl__banner-clause-label">
              <svg v-if="clause.kind === 'action'" viewBox="0 0 16 16" aria-hidden="true"><path d="M9.6 1 3.4 9.1h3.9L6.2 15l6.4-8.4H8.6z" /></svg>
              <svg v-else viewBox="0 0 24 12" aria-hidden="true"><path d="M6 1.5C3 1.5 1.2 3.6 1.2 6S3 10.5 6 10.5c3.6 0 8.4-9 12-9 3 0 4.8 2.1 4.8 4.5S21 10.5 18 10.5c-3.6 0-8.4-9-12-9z" fill="none" stroke-width="1.7" /></svg>
              {{ $t(clause.kind === 'action' ? 'Action' : 'Effect') }}
            </span>
            <div v-if="clause.root !== undefined" class="con-parl__banner-clause-formula" data-banner-clause-graphic>
              <ConsolePartyFormula :party="reading.party" :renderRoot="clause.root" size="wide" />
            </div>
            <span v-if="clause.text !== undefined" class="con-parl__banner-clause-text">{{ $t(clause.text) }}</span>
          </section>
        </div>
        <!-- THE FAQ (rulebook p.19): the cube gives the EFFECT, never the party's requirement. -->
        <span class="con-parl__support-rule con-parl__banner-faq" data-parl-banner-faq>{{ $t(faqKey) }}</span>
      </div>
    </transition>
    </div>
    <!-- THE CONFIRM — «Поставить куб» while the pick is open; a status once it is pressed. -->
    <div class="con-parl__cta con-parl__support-cta"
         :class="{
           'con-parl__cta--ready': ctaReady,
           'con-parl__cta--blocked': !flow.bannerCommitted && reading !== undefined && !reading.available,
           'con-parl__cta--busy': flow.bannerCommitted && flow.bannerBeat !== 'done',
           'con-parl__cta--done': flow.bannerBeat === 'done',
         }"
         data-parl-banner-cta @click="submit()">
      <GamepadGlyph v-if="ctaReady" control="confirm" class="con-parl__cta-glyph" />
      <span class="con-parl__cta-label">{{ ctaText }}</span>
    </div>
  </div>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {BannerPromptMeta} from '@/common/models/PlayerInputModel';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import PlayerCube from '@/client/components/PlayerCube.vue';
import ConsolePartyFormula from '@/client/components/console/parliament/ConsolePartyFormula.vue';
import {ICardRenderRoot} from '@/common/cards/render/Types';
import {buildMechanics} from '@/client/components/premiumCard/mechanicsModel';
import {PARLIAMENT_GRAPHIC} from '@/client/components/premiumCard/resolutionPremiumVm';
import {preloadPremiumCardArt} from '@/client/cards/cardArt';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {setWorkspaceFramePhase} from '@/client/console/consoleWorkspaceStack';
import {translateText} from '@/client/directives/i18n';
import {probeTick} from '@/client/console/probeTick';
import {getPartyEffect} from '@/client/parliament/ClientParliamentManifest';
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {ParliamentBeat, scheduleParliamentBeat} from '@/client/console/parliament/parliamentBeat';
import {parliamentFlow, parliamentRootEl} from '@/client/console/parliament/consoleParliamentFlow';
import {freezeParliamentFit} from '@/client/console/parliament/parliamentCardFit';
import {flyAccessSeal, rectOf} from '@/client/console/parliament/parliamentFlights';
import {abortBannerCubeStage, playBannerCubeStage} from '@/client/console/parliament/bannerCubeStage';
import {parliamentHolds} from '@/client/console/parliament/parliamentDisplayHolds';
import {parliamentBrowseInspectRequest} from '@/client/console/parliament/parliamentNavigation';
import {bannerCubesOn, bannerPickResponse, ParliamentPromptBridge, ParliamentViewVm} from '@/client/console/parliament/consoleParliamentModel';
import {supportCursorOrder, supportCursorStep} from '@/client/console/parliament/supportPickModel';
import {BANNER_CUBE_FAQ_KEY, bannerConsequenceKey, bannerReadingOf, BannerReadingVm} from '@/client/console/parliament/bannerPickModel';
import {bannerCubeHeld, bannerCubeTargetRect, landBannerCube, releaseBannerCube} from '@/client/console/parliament/bannerCubeScene';
import {Rect} from '@/client/console/parliament/consoleParliamentVoteMotion';
import {armAccessToldOnStage, disarmAccessToldOnStage} from '@/client/console/parliament/accessToldOnStage';

/** The read beat after the cube has landed (no seal followed), and after the seal has landed in «ВАШИ ЭФФЕКТЫ». */
const BANNER_READ_MS = 640;

/**
 * THE BANNER MODE — the reading of the plaque under the cursor, the d-pad over the ring, the commit and the answer
 * (the cube's carry, the access scene). Nothing here decides a candidate: every fact is the server's row.
 */
export default defineComponent({
  name: 'ConsoleParliamentBannerMode',
  components: {ConsolePartyFormula, GamepadGlyph, PlayerCube},
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    bridge: {type: Object as PropType<ParliamentPromptBridge>, required: true},
  },
  emits: ['notice', 'inspect', 'inspect-source', 'send', 'flow-complete'],
  data() {
    return {
      faqKey: BANNER_CUBE_FAQ_KEY,
      latchedCard: undefined as CardName | undefined,
      outcomeHold: undefined as AnimationHold | undefined,
      beat: undefined as ParliamentBeat | undefined,
      /** The cube has touched down in the plaque's socket (the panel's socket shows it seated). */
      landed: false,
      /** The corporation's stage, while it still stands (the flow leaves only once the card has gone back down). */
      stageDone: undefined as Promise<unknown> | undefined,
      /** The mode is being torn down — a stage cut by that tear-down owes the flow nothing more. */
      stopped: false,
    };
  },
  computed: {
    flow() {
      return parliamentFlow;
    },
    meta(): BannerPromptMeta | undefined {
      return this.bridge.bannerPick?.meta ?? parliamentFlow.bannerMeta;
    },
    ruler(): ReduxParty {
      return parliamentHolds.rulerBefore ?? this.view.rulingParty;
    },
    order(): Array<ReduxParty> {
      return supportCursorOrder(this.view.parties.map((p) => p.party), this.ruler);
    },
    cursor(): ReduxParty | undefined {
      if (parliamentFlow.zone === 'ruler') {
        return this.ruler;
      }
      return this.view.parties[parliamentFlow.partyIndex]?.party;
    },
    reading(): BannerReadingVm | undefined {
      return bannerReadingOf(this.meta, parliamentFlow.bannerSnapshot?.party ?? this.cursor);
    },
    consequenceKey(): string {
      return this.reading === undefined ? '' : bannerConsequenceKey(this.reading);
    },
    /**
     * WHAT THE CUBE GIVES — the party's clauses as the Charter prints them: its standing EFFECT and its ACTION, each its
     * own graphic (the manifest's render roots) with the party's own words for it. A clause with no GRAPHIC (an action-only
     * party's empty passive — Unity) is not drawn: «no printed effect» under a label would be a clause that says nothing.
     */
    clauses(): Array<{kind: 'effect' | 'action', root?: ICardRenderRoot, text?: string}> {
      const party = this.reading?.party;
      const effect = party === undefined ? undefined : getPartyEffect(party);
      if (effect === undefined) {
        return [];
      }
      const graphic = (root: ICardRenderRoot | undefined): ICardRenderRoot | undefined =>
        root !== undefined && !buildMechanics(root, PARLIAMENT_GRAPHIC).textOnly ? root : undefined;
      const out: Array<{kind: 'effect' | 'action', root?: ICardRenderRoot, text?: string}> = [];
      const passive = graphic(effect.passiveRenderData);
      const passiveText = effect.text.passive ?? (effect.actionRenderData === undefined ? effect.text.rule : undefined);
      if (passive !== undefined || passiveText !== undefined) {
        out.push({kind: 'effect', ...(passive === undefined ? {} : {root: passive}), ...(passiveText === undefined ? {} : {text: passiveText})});
      }
      if (effect.actionRenderData !== undefined) {
        const action = graphic(effect.actionRenderData);
        out.push({kind: 'action', ...(action === undefined ? {} : {root: action}), text: effect.text.action ?? effect.text.rule});
      }
      return out;
    },
    ctaReady(): boolean {
      return !parliamentFlow.bannerCommitted && this.reading?.available === true;
    },
    ctaText(): string {
      if (parliamentFlow.bannerCommitted) {
        return translateText(parliamentFlow.bannerBeat === 'done' || parliamentFlow.bannerBeat === 'read' ? 'Cube placed' : 'Performing…');
      }
      const r = this.reading;
      if (r !== undefined && !r.available) {
        return translateText(r.reason ?? 'Your cube already stands on this banner');
      }
      return translateText('Place cube');
    },
  },
  mounted() {
    // The corporation that stands up at the press paints its art from its first frame (decoded now, not at the rise).
    const card = this.bridge.bannerPick?.card;
    if (card !== undefined) {
      preloadPremiumCardArt([card], ['full', 'thumb']);
    }
  },
  beforeUnmount() {
    this.stopOutcome();
  },
  methods: {
    partyNameKey(party: string): string {
      return partyNameKey(party);
    },
    emblemOf(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    accentOf(party: ReduxParty): string {
      return partyAccent(party);
    },
    moveTo(party: ReduxParty | undefined): void {
      if (party === undefined) {
        return;
      }
      if (party === this.ruler) {
        parliamentFlow.zone = 'ruler';
        return;
      }
      const index = this.view.parties.findIndex((p) => p.party === party);
      if (index >= 0) {
        parliamentFlow.zone = 'parties';
        parliamentFlow.partyIndex = index;
      }
    },
    /** The mode's own verbs: the d-pad walks the plaques, A places the cube, X inspects the plaque, L3 the corporation. */
    handleIntent(intent: GamepadIntent): void {
      if (parliamentFlow.bannerCommitted || parliamentFlow.stage !== 'banner') {
        return;
      }
      if (intent.kind === 'nav') {
        // The bench the cursor left keeps its place in `partyIndex` while the dais is focused — ◀ returns there.
        this.moveTo(supportCursorStep(this.order, this.ruler, this.cursor, intent.dir, this.view.parties[parliamentFlow.partyIndex]?.party));
        return;
      }
      if (intent.kind === 'press' && intent.button === 'stickL') {
        const card = this.bridge.bannerPick?.card;
        if (card !== undefined) {
          this.$emit('inspect-source', card);
        }
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary':
        this.submit();
        return;
      case 'inspect': {
        const request = parliamentBrowseInspectRequest(this.view, parliamentRootEl());
        if (request !== undefined) {
          this.$emit('inspect', request);
        }
        return;
      }
      default:
        return;
      }
    },
    /** A — the cube onto the banner under the cursor. Never auto: the player walks to the plaque and presses. */
    submit(): void {
      const party = this.cursor;
      const reading = this.reading;
      if (parliamentFlow.stage !== 'banner' || parliamentFlow.bannerCommitted || party === undefined || reading === undefined) {
        return;
      }
      if (!reading.available) {
        this.$emit('notice', translateText(reading.reason ?? 'Your cube already stands on this banner'));
        return;
      }
      const response = bannerPickResponse(this.bridge, party);
      if (response === undefined) {
        this.$emit('notice', translateText('This option is no longer offered'));
        return;
      }
      parliamentFlow.bannerMeta = this.meta;
      parliamentFlow.bannerSnapshot = {party};
      // A cube that OPENS the party's effect is told by the hall (the seal into «ВАШИ ЭФФЕКТЫ»), never by the feed too.
      if (!reading.hasEffect && party !== this.view.rulingParty) {
        armAccessToldOnStage(party);
      }
      this.latchedCard = this.bridge.bannerPick?.card;
      freezeParliamentFit(true);
      this.$emit('send', {response, from: 'banner'});
    },
    /**
     * THE ANSWER IS IN (the section's answer-key watcher, post-flush). LANDED — the viewer's cube stands on the chosen
     * banner: the carry plays on this stage. Anything else (the prompt re-asked, nothing placed) — the mode stands
     * again in place, the cursor kept.
     */
    answerAfterSubmit(): void {
      const f = parliamentFlow;
      const party = f.bannerSnapshot?.party;
      const viewer = this.viewerColor;
      const placed = party !== undefined && viewer !== undefined && bannerCubesOn(this.playerView.game.parliament, party).includes(viewer);
      if (!placed) {
        f.stage = 'banner';
        f.bannerCommitted = false;
        f.bannerSnapshot = undefined;
        freezeParliamentFit(false);
        return;
      }
      this.playOutcome(party, viewer);
    },
    /**
     * LANDED: the CORPORATION stands up in the table's cell and the cube leaves its printed on-play glyph for the plaque's
     * socket (`bannerCubeStage` — the sitting's own phrase); then (an effect opened) the seal. With no card to stand
     * up (a door with no source) the cube is carried from the viewer's seat, as before.
     */
    playOutcome(party: ReduxParty, viewer: Color): void {
      const f = parliamentFlow;
      f.stage = 'banner';
      f.bannerCommitted = true;
      f.bannerBeat = 'flight';
      setWorkspaceFramePhase('parliament', 'executing');
      this.outcomeHold?.release();
      this.outcomeHold = beginAnimationHold('parliament-banner-cube', {maxHoldMs: 9000});
      void this.$nextTick(() => probeTick(() => {
        if (!bannerCubeHeld(party, viewer)) {
          // Nothing held (reduced motion decided earlier, a reload): the cube already stands — read and go on.
          this.afterCube(party);
          return;
        }
        const card = this.latchedCard;
        if (card === undefined) {
          landBannerCube(party, viewer, this.seatRect(viewer), () => {
            this.landed = true;
            this.afterCube(party);
          });
          return;
        }
        this.stageDone = playBannerCubeStage([{party, color: viewer, card}], {
          origin: 'play',
          onLanded: () => {
            this.landed = true;
            this.afterCube(party);
          },
        }).then((result) => {
          // A stage CUT before its touchdown (a second stage, a throw) still owes this flow its end: the cube is shown
          // where it stands, and the reading goes on from it — never a mode left standing at «flight».
          if (result === 'aborted' && !this.stopped) {
            this.afterCube(party);
          }
          return result;
        });
      }));
    },
    /** The cube's source when no card stands up: the viewer's own seat on the bench (its colour is its place). */
    seatRect(color: Color): Rect | undefined {
      const root = parliamentRootEl();
      const seat = rectOf(root?.querySelector(`[data-parl-seat="${color}"]`));
      const target = bannerCubeTargetRect(parliamentFlow.bannerSnapshot?.party ?? this.view.rulingParty);
      if (seat === undefined) {
        return undefined;
      }
      const size = target?.height ?? Math.min(seat.height, 24);
      return {left: seat.left + size * 0.2, top: seat.top + seat.height / 2 - size / 2, width: size, height: size};
    },
    /** The cube is seated. An effect it OPENED is carried into «ВАШИ ЭФФЕКТЫ» (the access scene); else a read. */
    afterCube(party: ReduxParty): void {
      const f = parliamentFlow;
      if (f.bannerBeat !== 'flight') {
        return;
      }
      const opened = this.view.viewer?.access.some((a) => a.party === party && a.hasEffect) === true && this.view.rulingParty !== party;
      if (!opened) {
        this.read();
        return;
      }
      f.bannerBeat = 'seal';
      f.accessParty = party;
      f.accessBeat = 'flight';
      void this.$nextTick(() => {
        const root = parliamentRootEl();
        const from = bannerCubeTargetRect(party);
        const to = rectOf(root?.querySelector(`.con-parl__effects-row[data-party="${party}"] .con-parl__effects-seal`));
        flyAccessSeal({from, to, emblemUrl: partyEmblemUrl(party), onLanded: () => {
          f.accessBeat = 'landed';
          this.read();
        }});
      });
    },
    read(): void {
      const f = parliamentFlow;
      f.bannerBeat = 'read';
      this.beat?.kill();
      this.beat = scheduleParliamentBeat(BANNER_READ_MS, () => {
        this.beat = undefined;
        // The surface leaves whole: never under a corporation still going back down into the table.
        void (this.stageDone ?? Promise.resolve()).then(() => this.finish());
      });
    },
    finish(): void {
      const f = parliamentFlow;
      if (f.bannerBeat === 'done') {
        return;
      }
      f.bannerBeat = 'done';
      if (f.accessParty !== undefined) {
        f.accessBeat = 'done';
      }
      this.outcomeHold?.release();
      this.outcomeHold = undefined;
      disarmAccessToldOnStage();
      this.$emit('flow-complete', 'banner');
    },
    /** Cut every beat (the section unmounts): the held cube is shown, the hold lets go. */
    stopOutcome(): void {
      this.stopped = true;
      abortBannerCubeStage();
      this.beat?.kill();
      this.beat = undefined;
      const party = parliamentFlow.bannerSnapshot?.party;
      if (party !== undefined && this.viewerColor !== undefined) {
        releaseBannerCube(party, this.viewerColor);
      }
      this.outcomeHold?.release();
      this.outcomeHold = undefined;
    },
  },
});
</script>

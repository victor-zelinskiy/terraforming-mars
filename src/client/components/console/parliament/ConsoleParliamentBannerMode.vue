<template>
  <!-- ══ THE BANNER MODE («ЗНАМЯ», Turmoil Redux Septem Tribus:redux) — the Parliament picks the PARTY whose banner
       takes the viewer's cube (the first action). The objects are the six party PLAQUES where they stand: the cursor
       walks them (the support mode's ring) and nothing moves; the plaque under the cursor wears the GHOST of the cube in
       its banner socket. THIS panel is the reading of that plaque, in the voting area's own rect (the bills recede under
       it — nothing flies to or from them). A places the cube; the answer plays on this very stage: the cube is carried
       from the viewer's seat into the socket, then — when the cube opened the party's effect — the party's seal travels
       into «ВАШИ ЭФФЕКТЫ» (the access scene), and the surface leaves whole. ══ -->
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
        <div class="con-parl__support-area">
          <span class="con-parl__info-kicker con-parl__support-kicker">{{ $t('Party banner') }}</span>
          <!-- THE SOCKET, as it will stand: the GHOST of the viewer's cube (a dashed contour + a pale cube — the grammar
               of an arriving place, no light) before the press; the cube itself once it has landed. -->
          <span class="con-parl__support-row con-parl__banner-row">
            <span class="con-parl__banner-socket" :class="{'con-parl__banner-socket--ghost': !landed, 'con-parl__banner-socket--seated': landed}" data-parl-banner-socket>
              <PlayerCube v-if="viewerColor !== undefined" :color="viewerColor" :size="20" :glow="false" :shadow="false" />
            </span>
            <span v-if="reading.available" class="con-parl__banner-consequence" data-parl-banner-consequence>{{ $t(consequenceKey) }}</span>
          </span>
          <!-- THE PARTY'S STANDING EFFECT — what the cube gives (the party's own rule, never a paraphrase). -->
          <span v-if="ruleKey !== ''" class="con-parl__banner-rule" data-parl-banner-rule>{{ $t(ruleKey) }}</span>
          <span v-if="!reading.available" class="con-parl__support-reason" data-parl-banner-reason>{{ $t(reading.reason ?? 'Your cube already stands on this banner') }}</span>
          <!-- THE FAQ (rulebook p.19): the cube gives the EFFECT, never the party's requirement. -->
          <span class="con-parl__support-rule con-parl__banner-faq" data-parl-banner-faq>{{ $t(faqKey) }}</span>
        </div>
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
  components: {GamepadGlyph, PlayerCube},
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
    /** The party's standing effect in its own words (the manifest's rule) — what the cube gives. */
    ruleKey(): string {
      const party = this.reading?.party;
      return party === undefined ? '' : (getPartyEffect(party)?.text.rule ?? '');
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
        this.moveTo(supportCursorStep(this.order, this.ruler, this.cursor, intent.dir));
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
    /** LANDED: the cube is carried from the viewer's seat into the plaque's socket, then (an effect opened) the seal. */
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
        landBannerCube(party, viewer, this.seatRect(viewer), () => {
          this.landed = true;
          this.afterCube(party);
        });
      }));
    },
    /** The cube's source: the viewer's own seat on the bench (its colour is its place), a cube-sized rect at its head. */
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
        this.finish();
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

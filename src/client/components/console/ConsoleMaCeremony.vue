<template>
  <!--
    CONSOLE MA CEREMONY — the announcement channel for milestone claims /
    award fundings, for EVERY player at the table (it replaces the
    milestone/award notification card; the journal record is untouched).

    Two presentations off ONE queue (maCeremonyState):
    - OWN (the viewer just confirmed): the full cinematic — centre stage,
      coronation gold "+5 VP" / medal seal.
    - REMOTE (another player acted): an unobtrusive top-centre beat — no
      veil, compact art, the ACTOR named by colour chip — it never covers
      open overlays or interrupts an action, but WHO took WHAT is explicit.

    Like the old terraforming ceremony did (the MA ceremony keeps it): pointer-events none (the game stays
    fully playable underneath — intents are NOT trapped), bounded lifetime
    through motionMs, one-shot animations, reduced-motion honest. When a
    beat finishes the shell advances the queue (a poll can bring two).
  -->
  <transition name="con-macere" @after-leave="onGone">
    <div v-if="visible && event !== undefined"
         class="con-macere"
         :class="['con-macere--' + event.kind, {'con-macere--remote': !event.own}]"
         aria-hidden="true">
      <template v-if="event.own">
        <div class="con-macere__veil"></div>
        <div class="con-macere__scene">
          <div class="con-macere__halo"></div>
          <div ref="stage" class="con-macere__stage">
            <span class="con-macere__ring"></span>
            <MaHeroArt :name="event.name" :kind="event.kind" class="con-macere__hero" />
          </div>
          <div class="con-macere__kicker">{{ $t(kickerKey) }}</div>
          <div class="con-macere__name" v-i18n>{{ displayName }}</div>
          <div class="con-macere__actor">
            <span class="con-macere__actor-dot" :class="'player_bg_color_' + event.color"></span>
            <span>{{ event.actorName }}</span>
          </div>
          <div v-if="event.kind === 'milestone'" class="con-macere__vp">
            <span class="con-macere__vp-num">+5</span>
            <span class="con-macere__vp-unit">{{ $t('VP') }}</span>
          </div>
          <div v-else-if="event.free" class="con-macere__cost">{{ $t('Free sponsorship') }}</div>
          <div v-else-if="event.cost !== undefined" class="con-macere__cost">
            <span>{{ $t('Cost') }}: <b>{{ event.cost }}</b></span>
            <i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
          </div>
        </div>
      </template>
      <!-- REMOTE: the unobtrusive top-centre beat — no veil, never blocking. -->
      <div v-else class="con-macere__strip">
        <div ref="stripStage" class="con-macere__strip-stage">
          <MaHeroArt :name="event.name" :kind="event.kind" class="con-macere__strip-hero" />
        </div>
        <div class="con-macere__strip-body">
          <div class="con-macere__kicker con-macere__strip-kicker">{{ $t(kickerKey) }}</div>
          <div class="con-macere__strip-name" v-i18n>{{ displayName }}</div>
          <div class="con-macere__actor">
            <span class="con-macere__actor-dot" :class="'player_bg_color_' + event.color"></span>
            <span>{{ event.actorName }}</span>
            <span v-if="event.kind === 'milestone'" class="con-macere__strip-vp">+5 {{ $t('VP') }}</span>
          </div>
        </div>
      </div>
    </div>
  </transition>
  <!-- THE CHAIRMAN QUEST, completed by ANOTHER seat (the owner, 2026-10-24): the same remote strip in the quest's own
       style — the chair on the Parliament's violet, WHO completed it, and what it gave them (the chairmanship and one
       step of the Career). One strip at a time: it waits for a milestone / award strip to leave. -->
  <transition name="con-macere" @after-leave="onQuestGone">
    <div v-if="questVisible && questEvent !== undefined" class="con-macere con-macere--remote con-macere--quest" aria-hidden="true"
         data-quest-ceremony :data-quest-ceremony-actor="questEvent.color">
      <div class="con-macere__strip">
        <div ref="questStage" class="con-macere__strip-stage con-macere__strip-stage--quest">
          <PremiumChairGlyph class="con-macere__quest-chair" />
        </div>
        <div class="con-macere__strip-body">
          <div class="con-macere__kicker con-macere__strip-kicker">{{ $t('Chairman quest completed') }}</div>
          <div class="con-macere__actor con-macere__quest-actor">
            <span class="con-macere__actor-dot" :class="'player_bg_color_' + questEvent.color"></span>
            <span class="con-macere__strip-name">{{ questEvent.actorName }}</span>
          </div>
          <div class="con-macere__quest-gain">
            <span>{{ $t('Chairmanship') }}</span>
            <span class="con-macere__quest-step">+1 <i class="career-step-glyph" aria-hidden="true"></i></span>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import MaHeroArt from '@/client/components/ma/MaHeroArt.vue';
import {advanceMaCeremony, maCeremonyState, maCeremonyEventEmbedded, MaCeremonyEvent} from '@/client/components/ma/maCeremonyState';
import {maDisplayName} from '@/client/components/ma/maArt';
import {motionMs} from '@/client/components/motion/motionTokens';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {playCeremonyBurst, CeremonyBurstHandle} from '@/client/console/ceremony/ceremonyFx';
import {$t} from '@/client/directives/i18n';
import {flyMaVp} from '@/client/console/scoreCell/maVp';
import PremiumChairGlyph from '@/client/components/premiumCard/PremiumChairGlyph.vue';
import {advanceQuestCeremony, questCeremonyState, QuestCeremonyEvent} from '@/client/console/parliament/questCeremony';

/** The own coronation lingers a beat longer than the seal / a rival's beat. */
const MILESTONE_LIFETIME_MS = 3600;
const AWARD_LIFETIME_MS = 3000;
const REMOTE_LIFETIME_MS = 2800;
/** The quest strip reads a beat longer than a rival's milestone: it names two gains (the chair and a Career step). */
const QUEST_LIFETIME_MS = 3200;
const REDUCED_LIFETIME_MS = 1600;

export default defineComponent({
  name: 'ConsoleMaCeremony',
  components: {MaHeroArt, PremiumChairGlyph},
  data() {
    return {
      visible: false,
      hideTimer: undefined as ReturnType<typeof setTimeout> | undefined,
      fx: undefined as CeremonyBurstHandle | undefined,
      questVisible: false,
      questTimer: undefined as ReturnType<typeof setTimeout> | undefined,
      questFx: undefined as CeremonyBurstHandle | undefined,
    };
  },
  computed: {
    nonce(): number {
      return maCeremonyState.nonce;
    },
    event(): MaCeremonyEvent | undefined {
      return maCeremonyState.current;
    },
    questNonce(): number {
      return questCeremonyState.nonce;
    },
    questEvent(): QuestCeremonyEvent | undefined {
      return questCeremonyState.current;
    },
    displayName(): string {
      return this.event !== undefined ? maDisplayName(this.event.name) : '';
    },
    kickerKey(): string {
      if (this.event?.kind === 'milestone') {
        return 'Milestone claimed';
      }
      return this.event?.free ? 'Award sponsored' : 'Award funded';
    },
  },
  watch: {
    nonce() {
      this.showCurrent();
    },
    questNonce() {
      this.showQuest();
    },
  },
  mounted() {
    // A beat queued while no shell was mounted (screen transition) is
    // picked up here instead of stalling the queue forever.
    this.showCurrent();
    this.showQuest();
  },
  beforeUnmount() {
    if (this.hideTimer !== undefined) {
      clearTimeout(this.hideTimer);
    }
    if (this.questTimer !== undefined) {
      clearTimeout(this.questTimer);
    }
    this.stopFx();
    this.questFx?.stop();
  },
  methods: {
    $t,
    showCurrent(): void {
      if (this.event === undefined) {
        return;
      }
      // The MA workspace's focus stage CLAIMED this own beat — the ceremony
      // plays INSIDE the workspace (the hero emblem already on stage is its
      // entry object). The claimant advances the queue when its scene
      // settles; presenting here too would put two emblems on screen.
      if (maCeremonyEventEmbedded(this.event)) {
        return;
      }
      // A rival's strip waits for a quest strip standing at the top (one strip at a time; the own cinematic never waits).
      if (!this.event.own && this.questVisible) {
        return;
      }
      if (this.hideTimer !== undefined) {
        clearTimeout(this.hideTimer);
      }
      this.visible = true;
      // The gsap burst layer (rings/sparks/flash) plays over the stage once
      // it exists — timed so the CSS hero entrance lands first.
      void this.$nextTick(() => this.playFx());
      const base = prefersReducedMotion() ? REDUCED_LIFETIME_MS :
        !this.event.own ? REMOTE_LIFETIME_MS :
          this.event.kind === 'milestone' ? MILESTONE_LIFETIME_MS : AWARD_LIFETIME_MS;
      const own = this.event.own;
      const kind = this.event.kind;
      this.hideTimer = setTimeout(() => {
        this.hideTimer = undefined;
        const hide = () => {
          this.visible = false;
          this.stopFx();
        };
        // THE POINTS LEAVE THE CEREMONY FIRST (TR55): the own beat's token is born on its «+5» / its seal and has
        // left it before the shell fades — the score cell ticks at the touchdown.
        if (own) {
          void flyMaVp(kind).then(hide);
        } else {
          hide();
        }
      }, motionMs(base));
    },
    /** The coronation gets the full burst; a rival's remote beat only a calm
     *  ring ping — it must stay unobtrusive by contract. */
    playFx(): void {
      this.stopFx();
      const event = this.event;
      if (event === undefined || !this.visible) {
        return;
      }
      const host = (event.own ? this.$refs.stage : this.$refs.stripStage) as HTMLElement | undefined;
      if (host === undefined || host === null) {
        return;
      }
      this.fx = playCeremonyBurst({
        host,
        accent: event.kind === 'milestone' ? 'gold' : 'medal',
        reduced: prefersReducedMotion(),
        intensity: event.own ? 'full' : 'ping',
        delayMs: event.own ? 260 : 140,
      });
    },
    stopFx(): void {
      this.fx?.stop();
      this.fx = undefined;
    },
    /** The leave transition finished — hand the stage to the next queued beat. */
    onGone(): void {
      advanceMaCeremony();
      // A quest beat that waited for this strip takes the top now.
      this.showQuest();
    },
    /** The quest's remote strip — shown only while no milestone / award strip stands at the top. */
    showQuest(): void {
      if (this.questEvent === undefined || this.questVisible || this.visible) {
        return;
      }
      this.questVisible = true;
      void this.$nextTick(() => {
        const host = this.$refs.questStage as HTMLElement | undefined;
        if (host !== undefined && host !== null) {
          this.questFx = playCeremonyBurst({host, accent: 'quest', reduced: prefersReducedMotion(), intensity: 'ping', delayMs: 140});
        }
      });
      this.questTimer = setTimeout(() => {
        this.questTimer = undefined;
        this.questVisible = false;
        this.questFx?.stop();
        this.questFx = undefined;
      }, motionMs(prefersReducedMotion() ? REDUCED_LIFETIME_MS : QUEST_LIFETIME_MS));
    },
    onQuestGone(): void {
      advanceQuestCeremony();
      // A rival's milestone / award strip that waited for this one takes the top now.
      if (!this.visible) {
        this.showCurrent();
      }
      // Two completions in one commit (never in practice — the quest closes) or a quest strip that waited: next.
      this.showQuest();
    },
  },
});
</script>

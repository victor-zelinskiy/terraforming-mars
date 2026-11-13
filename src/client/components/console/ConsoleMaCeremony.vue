<template>
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
          <!-- PC01 · GO: the viewer's own waived price — the struck table price, 0 and the source's seal. -->
          <div v-else-if="event.price !== undefined && event.price.kind === 'waived'" class="con-macere__cost" data-ma-price-kind="waived">
            <span>{{ $t('Cost') }}:</span>
            <ConsoleMaWaivedPrice :printed="event.price.printed" :waivedBy="event.price.waivedBy" />
          </div>
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

<script setup lang="ts">
/*
 * CONSOLE MA CEREMONY — the announcement channel for milestone claims /
 * award fundings, for EVERY player at the table (it replaces the
 * milestone/award notification card; the journal record is untouched).
 *
 * Two presentations off ONE queue (maCeremonyState):
 * - OWN (the viewer just confirmed): the full cinematic — centre stage,
 *   coronation gold "+5 VP" / medal seal.
 * - REMOTE (another player acted): an unobtrusive top-centre beat — no
 *   veil, compact art, the ACTOR named by colour chip — it never covers
 *   open overlays or interrupts an action, but WHO took WHAT is explicit.
 *
 * Like the old terraforming ceremony did (the MA ceremony keeps it): pointer-events none (the game stays
 * fully playable underneath — intents are NOT trapped), bounded lifetime
 * through motionMs, one-shot animations, reduced-motion honest. When a
 * beat finishes the shell advances the queue (a poll can bring two).
 *
 * (This comment opened the template; the template starts with its root now.)
 *
 * — before the root `<transition name="con-macere" @after-leave="onQuestGone">`:
 * THE CHAIRMAN QUEST, completed by ANOTHER seat (the owner, 2026-10-24): the same remote strip in the quest's own
 *       style — the chair on the Parliament's violet, WHO completed it, and what it gave them (the chairmanship and one
 *       step of the Career). One strip at a time: it waits for a milestone / award strip to leave.
 *
 * (These comments stood between the template's roots; each names the root it stood before.)
 */

import {computed, nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch} from 'vue';
import MaHeroArt from '@/client/components/ma/MaHeroArt.vue';
import {advanceMaCeremony, maCeremonyState, maCeremonyEventEmbedded, MaCeremonyEvent} from '@/client/components/ma/maCeremonyState';
import {maDisplayName} from '@/client/components/ma/maArt';
import {motionMs} from '@/client/components/motion/motionTokens';
import {prefersReducedMotion} from '@/client/components/feedback/changeFeedbackManager';
import {playCeremonyBurst, CeremonyBurstHandle} from '@/client/console/ceremony/ceremonyFx';
import {$t} from '@/client/directives/i18n';
import {flyMaVp} from '@/client/console/scoreCell/maVp';
import PremiumChairGlyph from '@/client/components/premiumCard/PremiumChairGlyph.vue';
import ConsoleMaWaivedPrice from '@/client/components/console/foundation/ConsoleMaWaivedPrice.vue';
import {advanceQuestCeremony, questCeremonyState, QuestCeremonyEvent} from '@/client/console/parliament/questCeremony';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {vI18n} from '@/client/directives/vDirectives';

/** The own coronation lingers a beat longer than the seal / a rival's beat. */
const MILESTONE_LIFETIME_MS = 3600;
const AWARD_LIFETIME_MS = 3000;
const REMOTE_LIFETIME_MS = 2800;
/** The quest strip reads a beat longer than a rival's milestone: it names two gains (the chair and a Career step). */
const QUEST_LIFETIME_MS = 3200;
const REDUCED_LIFETIME_MS = 1600;

defineOptions({name: 'ConsoleMaCeremony'});

const flow = useFlowScope('ma-ceremony');
const stage = useTemplateRef<HTMLElement>('stage');
const stripStage = useTemplateRef<HTMLElement>('stripStage');
const questStage = useTemplateRef<HTMLElement>('questStage');
const visible = ref(false);
/** The strip's lifetime — its cancel (the shell's scope takes both lifetimes back on unmount). */
let hideTimer: (() => void) | undefined;
/** The beat this shell put on screen — its leave advances the queue only while it is still the current one. */
const shownEvent = ref<MaCeremonyEvent | undefined>(undefined);
let fx: CeremonyBurstHandle | undefined;
const questVisible = ref(false);
let questFx: CeremonyBurstHandle | undefined;

const nonce = computed((): number => {
  return maCeremonyState.nonce;
});
const event = computed((): MaCeremonyEvent | undefined => {
  return maCeremonyState.current;
});
const questNonce = computed((): number => {
  return questCeremonyState.nonce;
});
const questEvent = computed((): QuestCeremonyEvent | undefined => {
  return questCeremonyState.current;
});
const displayName = computed((): string => {
  return event.value !== undefined ? maDisplayName(event.value.name) : '';
});
const kickerKey = computed((): string => {
  if (event.value?.kind === 'milestone') {
    return 'Milestone claimed';
  }
  return event.value?.free ? 'Award sponsored' : 'Award funded';
});

function showCurrent(): void {
  if (event.value === undefined) {
    return;
  }
  // The MA workspace's focus stage CLAIMED this own beat — the ceremony
  // plays INSIDE the workspace (the hero emblem already on stage is its
  // entry object). The claimant advances the queue when its scene
  // settles; presenting here too would put two emblems on screen.
  if (maCeremonyEventEmbedded(event.value)) {
    return;
  }
  // A rival's strip waits for a quest strip standing at the top (one strip at a time; the own cinematic never waits).
  if (!event.value.own && questVisible.value) {
    return;
  }
  if (hideTimer !== undefined) {
    hideTimer();
  }
  visible.value = true;
  shownEvent.value = event.value;
  // The gsap burst layer (rings/sparks/flash) plays over the stage once
  // it exists — timed so the CSS hero entrance lands first.
  void nextTick(() => playFx());
  const base = prefersReducedMotion() ? REDUCED_LIFETIME_MS :
    !event.value.own ? REMOTE_LIFETIME_MS :
      event.value.kind === 'milestone' ? MILESTONE_LIFETIME_MS : AWARD_LIFETIME_MS;
  const own = event.value.own;
  const kind = event.value.kind;
  hideTimer = flow.after(motionMs(base), 'the ceremony strip\'s lifetime', () => {
    hideTimer = undefined;
    const hide = () => {
      visible.value = false;
      stopFx();
    };
    // THE POINTS LEAVE THE CEREMONY FIRST (TR55): the own beat's token is born on its «+5» / its seal and has
    // left it before the shell fades — the score cell ticks at the touchdown.
    if (own) {
      void flyMaVp(kind).then(hide);
    } else {
      hide();
    }
  });
}
/** The coronation gets the full burst; a rival's remote beat only a calm
 *  ring ping — it must stay unobtrusive by contract. */
function playFx(): void {
  stopFx();
  const eventNow = event.value;
  if (eventNow === undefined || !visible.value) {
    return;
  }
  const host = eventNow.own ? stage.value : stripStage.value;
  if (host === undefined || host === null) {
    return;
  }
  fx = playCeremonyBurst({
    host,
    accent: eventNow.kind === 'milestone' ? 'gold' : 'medal',
    reduced: prefersReducedMotion(),
    intensity: eventNow.own ? 'full' : 'ping',
    delayMs: eventNow.own ? 260 : 140,
  });
}
function stopFx(): void {
  fx?.stop();
  fx = undefined;
}
/** The leave transition finished — hand the stage to the next queued beat. */
function onGone(): void {
  // ONE advance per beat (ledger HC): a beat whose hold already expired was advanced by its owner's recovery — a
  // second advance here would skip the beat queued behind it.
  const shown = shownEvent.value;
  shownEvent.value = undefined;
  if (shown === undefined || maCeremonyState.current === shown) {
    advanceMaCeremony();
  }
  // A quest beat that waited for this strip takes the top now.
  showQuest();
}
/** The quest's remote strip — shown only while no milestone / award strip stands at the top. */
function showQuest(): void {
  if (questEvent.value === undefined || questVisible.value || visible.value) {
    return;
  }
  questVisible.value = true;
  void nextTick(() => {
    const host = questStage.value ?? undefined;
    if (host !== undefined && host !== null) {
      questFx = playCeremonyBurst({host, accent: 'quest', reduced: prefersReducedMotion(), intensity: 'ping', delayMs: 140});
    }
  });
  flow.after(motionMs(prefersReducedMotion() ? REDUCED_LIFETIME_MS : QUEST_LIFETIME_MS), 'the quest strip\'s lifetime', () => {
    questVisible.value = false;
    questFx?.stop();
    questFx = undefined;
  });
}
function onQuestGone(): void {
  advanceQuestCeremony();
  // A rival's milestone / award strip that waited for this one takes the top now.
  if (!visible.value) {
    showCurrent();
  }
  // Two completions in one commit (never in practice — the quest closes) or a quest strip that waited: next.
  showQuest();
}

watch(() => nonce.value, () => {
  showCurrent();
});
watch(() => questNonce.value, () => {
  showQuest();
});

onMounted(() => {
  // A beat queued while no shell was mounted (screen transition) is
  // picked up here instead of stalling the queue forever.
  showCurrent();
  showQuest();
});
onBeforeUnmount(() => {
  stopFx();
  questFx?.stop();
});
</script>

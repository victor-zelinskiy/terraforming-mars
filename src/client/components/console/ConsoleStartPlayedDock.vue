<template>
  <aside class="con-start__played con-splayed"
         :class="{'con-splayed--receiving': receivingKey !== undefined}"
         aria-hidden="true">
    <!--
      THE COMPACT PLAYED DESTINATION of the Game Start Workspace deployment —
      «РАЗЫГРАНО · <owner>» as a destination-focused RECEIVING dock, never the
      full tableau overview (that layout answers "what has this player
      played?"; this one answers "where does THIS card physically go?").

      Composition mirrors the Card Play Workspace finale's receiving stage
      (ConsolePlayedReceivingStage / receivingStageModel) scaled to a column:
       - each start family (corporation / preludes …) is ONE physical stack:
         capped peek strips + the OPEN top card — the played cards stay
         physically visible, compact by construction;
       - the RECEIVING family carries the reserved FRONT ANCHOR
         (`[data-start-front]`) the played-card hero flies into. The final
         silhouette is laid out from the arm frame: the previous top keeps its
         open face OVERFLOWING its future strip until the dock, and the
         arriving card covers it back to a strip — the Top Card Handoff is
         geometric, nothing ever moves;
       - counts are honest: the caption ticks to N+1 exactly at the dock
         (the incoming card is excluded from the lying set until revealed).

      The root keeps the legacy `.con-start__played` class ON PURPOSE: the
      resource-transfer framework and the played-hero reward sources resolve
      `.con-start__played [data-played-key]` — the dock is the same physical
      address the flights already know.

      NB the comment lives INSIDE the root: a top-level template comment makes
      the dev build a fragment and $el a comment node.
    -->
    <div class="con-splayed__head">
      <span class="con-splayed__title">{{ $t('Played') }}</span>
      <span class="con-splayed__owner">
        <span class="con-splayed__dot" :class="'player_bg_color_' + viewer.color" aria-hidden="true"></span>
        <span class="con-splayed__owner-name">{{ ownerName }}</span>
      </span>
    </div>
    <div class="con-splayed__families">
      <section v-for="fam in families" :key="fam.key"
               class="con-splayed__fam"
               :class="{
                 'con-splayed__fam--receiving': fam.receiving,
                 'con-splayed__fam--aside': receivingKey !== undefined && !fam.receiving,
                 'con-splayed__fam--empty': fam.empty && !fam.receiving,
               }"
               :data-splayed-fam="fam.key">
        <div class="con-splayed__cap">
          <span class="con-splayed__cap-label">{{ $t(fam.label) }}</span>
          <b v-if="fam.count > 0" class="con-splayed__cap-count" :key="'c' + fam.count">{{ fam.count }}</b>
        </div>
        <div class="con-splayed__stack" :style="{width: plan.slotW + 'px'}">
          <!-- Depth strips: everything under the top card, oldest → newest. -->
          <div v-for="s in fam.strips" :key="s"
               class="con-splayed__strip"
               :data-played-key="s" :data-zoom-slot="s"
               :style="{height: plan.stripH + 'px'}">
            <div class="con-splayed__face" :style="{zoom: String(plan.zoom)}">
              <ConsolePlayedCardLite :name="s" peek />
            </div>
          </div>
          <!-- The TOP card. Idle: an open face in a full-height slot. While
               RECEIVING it sits in its FUTURE strip slot and overflows it
               downward with the same open face (the geometric handoff) until
               the arriving card is revealed, when it crops back to the strip. -->
          <div v-if="fam.top !== undefined"
               class="con-splayed__strip"
               :class="fam.receiving ? 'con-splayed__strip--prev' : 'con-splayed__strip--top'"
               :data-played-key="fam.top" :data-zoom-slot="fam.top"
               :style="{height: (fam.receiving ? plan.stripH : plan.cardH) + 'px'}">
            <div class="con-splayed__face" :style="{zoom: String(plan.zoom)}">
              <ConsolePlayedCardLite :name="fam.top" :peek="fam.receiving && revealed" />
            </div>
          </div>
          <!-- The RESERVED FRONT ANCHOR — the hero's landing box. Mounted from
               the arm (the flight measures a real rect), empty until the
               reveal, then the landed card occupies it and STAYS. -->
          <div v-if="fam.receiving"
               class="con-splayed__front"
               data-start-front
               :data-played-key="revealed && incomingName !== undefined ? incomingName : undefined"
               :data-zoom-slot="revealed && incomingName !== undefined ? incomingName : undefined"
               :class="{'con-splayed__front--filled': revealed}"
               :style="{height: plan.cardH + 'px'}">
            <div v-if="revealed && incomingName !== undefined" class="con-splayed__face" :style="{zoom: String(plan.zoom)}">
              <ConsolePlayedCardLite :name="incomingName" />
            </div>
          </div>
          <!-- An EMPTY family: the calm waiting plate — the destination
               visibly exists before anything flies. -->
          <div v-if="fam.empty && !fam.receiving" class="con-splayed__plate"
               :style="{height: (plan.stripH * 2) + 'px'}"></div>
        </div>
      </section>
    </div>
  </aside>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {getCard} from '@/client/cards/ClientCardManifest';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {buildPlayedZones, PlayedZones, PLAYED_CARD_NATURAL_W, PLAYED_CARD_NATURAL_H, PLAYED_PEEK_NATURAL} from '@/client/components/console/consolePlayedModel';
import {PlayedCategoryKey, PLAYED_CATEGORY_LABEL} from '@/client/components/console/consolePlayedCategoryModel';
import {familyForCardType, zoneCards} from '@/client/console/played/receivingStageModel';
import {playedHeroState, providePlayedHeroTarget} from '@/client/console/played/consolePlayedHero';
import {HeroRect} from '@/client/console/played/playedHeroModel';
import ConsolePlayedCardLite from '@/client/components/console/played/ConsolePlayedCardLite.vue';

/** Visible depth strips under the top card (history, never a column). */
const STRIP_CAP = 2;
/** The dock's one face zoom (× conUiScale) — strips and open cards share it,
 *  so a mode flip never resizes a single painted pixel. */
const DOCK_ZOOM = 0.42;

type StartPlayedFamily = {
  key: PlayedCategoryKey,
  label: string,
  /** Honest caption count (ticks to N+1 exactly at the dock). */
  count: number,
  /** Peek strips under the top (oldest → newest, capped). */
  strips: ReadonlyArray<CardName>,
  /** The open top card (undefined — empty family). */
  top: CardName | undefined,
  receiving: boolean,
  empty: boolean,
};

/** The start families, in tableau order. Corporation and preludes ALWAYS
 *  stand (a destination exists before anything flies); the rest join only
 *  once they hold cards (a CEO start, a future variant). */
const CORE_FAMILIES: ReadonlyArray<PlayedCategoryKey> = ['corporation', 'prelude'];
const EXTRA_FAMILIES: ReadonlyArray<PlayedCategoryKey> = ['ceo', 'active', 'automated', 'events'];

export default defineComponent({
  name: 'ConsoleStartPlayedDock',
  components: {ConsolePlayedCardLite},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  },
  data() {
    return {
      heroState: playedHeroState,
      unregisterTarget: undefined as (() => void) | undefined,
    };
  },
  computed: {
    viewer(): PublicPlayerModel {
      return this.playerView.thisPlayer;
    },
    ownerName(): string {
      const me = this.playerView.players.find((p) => p.color === this.playerView.thisPlayer.color);
      return participantDisplayName({
        name: me?.name ?? this.viewer.name ?? '',
        isMarsBot: me?.isMarsBot === true,
      });
    },
    zones(): PlayedZones {
      return buildPlayedZones(this.viewer.tableau);
    },
    /** The card physically travelling to this dock right now (armed → closing:
     *  the destination prepares AT THE PRESS, so the flight always measures a
     *  standing front anchor). */
    incomingName(): CardName | undefined {
      const hero = this.heroState;
      if (!hero.active || hero.card === undefined || hero.phase === 'idle' || hero.phase === 'failed') {
        return undefined;
      }
      return hero.card;
    },
    revealed(): boolean {
      return this.incomingName !== undefined && this.heroState.revealed;
    },
    /** The RECEIVING family — from the card's manifest TYPE (the card is not
     *  in the tableau yet at arm; same resolution as the receiving stage). */
    receivingKey(): PlayedCategoryKey | undefined {
      const name = this.incomingName;
      if (name === undefined) {
        return undefined;
      }
      return familyForCardType(getCard(name)?.type);
    },
    plan(): {zoom: number, slotW: number, cardH: number, stripH: number} {
      const zoom = DOCK_ZOOM * conUiScale();
      return {
        zoom,
        slotW: Math.round(PLAYED_CARD_NATURAL_W * zoom),
        cardH: Math.round(PLAYED_CARD_NATURAL_H * zoom),
        stripH: Math.round(PLAYED_PEEK_NATURAL * zoom),
      };
    },
    families(): ReadonlyArray<StartPlayedFamily> {
      const incoming = this.incomingName;
      const receivingKey = this.receivingKey;
      const build = (key: PlayedCategoryKey): StartPlayedFamily => {
        // The incoming card is EXCLUDED from the lying set until its reveal —
        // the strips and the top never change identity mid-flight, and the
        // caption count ticks exactly at the dock (one visual owner).
        const lying = zoneCards(this.zones, key)
          .map((c) => c.name as CardName)
          .filter((n) => n !== incoming);
        const receiving = receivingKey === key;
        const top = lying.length > 0 ? lying[lying.length - 1] : undefined;
        const rest = lying.slice(0, Math.max(0, lying.length - 1));
        return {
          key,
          label: PLAYED_CATEGORY_LABEL[key],
          count: lying.length + (receiving && this.revealed ? 1 : 0),
          strips: rest.slice(Math.max(0, rest.length - STRIP_CAP)),
          top,
          receiving,
          empty: lying.length === 0,
        };
      };
      const out = CORE_FAMILIES.map(build);
      for (const key of EXTRA_FAMILIES) {
        const fam = build(key);
        if (!fam.empty || fam.receiving) {
          out.push(fam);
        }
      }
      return out;
    },
  },
  mounted() {
    // The hero's landing target IS this dock's reserved front anchor.
    this.unregisterTarget = providePlayedHeroTarget(() => this.measureFrontAnchor());
  },
  beforeUnmount() {
    this.unregisterTarget?.();
  },
  methods: {
    /** The front anchor's settled rect — stability-looped so the arc lands on
     *  final geometry only (the expansion has finished shaping the column). */
    async measureFrontAnchor(): Promise<HeroRect | undefined> {
      await this.$nextTick();
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelector !== 'function') {
        return undefined;
      }
      const el = root.querySelector<HTMLElement>('[data-start-front]');
      if (el === null) {
        return undefined;
      }
      let last: HeroRect | undefined = undefined;
      for (let i = 0; i < 30; i++) {
        await new Promise<void>((r) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(() => r()) : setTimeout(r, 16)));
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
  },
});
</script>

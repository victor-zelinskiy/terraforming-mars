<!--
@console-shared LIVE — the face of a Turmoil Redux PARTY (the Mars Parliament's own object). Mounted by `PremiumCard`
inside its `.pcard` root (theme `charter`), so every host that draws a party as a card — the action composer's hero,
the fullscreen inspector — keeps zooming / measuring / inspecting one `.pcard` in the 320×460 design box.
-->
<template>
  <!--
    THE CHARTER (2026-10-25, the owner: «надо всё вывести под формат карточек … свой неповторимый НАСТОЛЬНЫЙ дизайн,
    логотипу не должно быть отдано так много места»). A party is neither a project (it is played by nobody, it has no
    cost, no tags, no illustration) nor a bill (it is not a document that is voted on — it is the standing body that
    brings bills in). It is the faction's CHARTER: a board-game faction card whose anatomy is its mechanics:

      · the BOARD — a stiff chamfered tile (cut corners all round): told from a project card (gold frame, rounded) and
        from a bill (a page with a folded corner) by its OUTLINE alone, from across the room;
      · the BANNER — the party's own dyed cloth across the head, cut in a pennant's chevron, hemmed in gold: the party
        reads by its colour as a MASS, the way a faction's colour does on a table;
      · the CREST — the emblem, a modest seal on the banner (never the art window the project anatomy gave it);
      · the NAME — under the crest, in vellum caps on the dye;
      · the CLAUSES — what the party DOES, each under its own engraved label: its standing EFFECT («∞ ЭФФЕКТ») and its
        ACTION («⚡ ДЕЙСТВИЕ»), through the ONE formula renderer — the same node references the ACTION COMMIT's impulse
        runs over (`data-graphic-node`), so the composer's commit lands on this face exactly as on a card's;
      · the FOOT — the printed LAW OF ACCESS as marks («[crown] / [delegate][delegate]» — the ruling party, or two of
        your delegates on its bill), the expansion stamp beside it.
    Console-safe by construction: gradients, clip-path and box-shadow only — no `filter`, no glow, nothing animated.
  -->
  <div class="pcard-charter__sheet" aria-hidden="true">
    <div class="pcard-charter__board">
      <div class="pcard-charter__banner">
        <img class="pcard-charter__crest pcard__party-emblem" :src="emblemUrl" alt="" draggable="false" />
        <div class="pcard-charter__title pcard__title" :class="'pcard__title--t' + titleTier"><span>{{ title }}</span></div>
      </div>
      <div class="pcard-charter__clauses" :data-charter-clauses="clauses.length">
        <section v-for="clause in clauses" :key="clause.kind" class="pcard-charter__clause" :class="'pcard-charter__clause--' + clause.kind" :data-charter-clause="clause.kind">
          <div class="pcard-charter__label">
            <svg v-if="clause.kind === 'action'" class="pcard-charter__glyph" viewBox="0 0 16 16"><path d="M9.6 1 3.4 9.1h3.9L6.2 15l6.4-8.4H8.6z" /></svg>
            <svg v-else class="pcard-charter__glyph pcard-charter__glyph--effect" viewBox="0 0 24 12"><path d="M6 1.5C3 1.5 1.2 3.6 1.2 6S3 10.5 6 10.5c3.6 0 8.4-9 12-9 3 0 4.8 2.1 4.8 4.5S21 10.5 18 10.5c-3.6 0-8.4-9-12-9z" fill="none" stroke-width="1.7" /></svg>
            <span class="pcard-charter__label-text">{{ $t(clause.kind === 'action' ? 'Action' : 'Effect') }}</span>
          </div>
          <PremiumMechanicsPanel :mechanics="clause.mechanics" />
        </section>
      </div>
      <div class="pcard-charter__foot">
        <span class="pcard-charter__access" data-charter-access>
          <svg class="pcard-charter__crown" viewBox="0 0 24 16"><path d="M2 13 3.5 4l5 4.5L12 1.5l3.5 7L20.5 4 22 13z" /><rect x="2" y="13.6" width="20" height="2" rx="1" /></svg>
          <span class="pcard-charter__slash">/</span>
          <span class="pcard-charter__seat"><img :src="delegateUrl" alt="" draggable="false" /></span>
          <span class="pcard-charter__seat"><img :src="delegateUrl" alt="" draggable="false" /></span>
        </span>
        <span class="pcard-charter__stamp">
          <span v-if="showCode && vm.code !== undefined" class="pcard__code" :data-card-code="vm.code">{{ vm.code }}</span>
          <span class="pcard__exp-medallion" :class="{'pcard__exp-medallion--base': expansionIcon === undefined}" :style="expansionStyle"></span>
        </span>
      </div>
      <!-- The board's printed keyline, a finger's width inside the cut outline. -->
      <span class="pcard-charter__keyline"></span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {PremiumCardVM} from './premiumCardViewModel';
import {MechanicsVM} from './mechanicsModel';
import {TitleTier} from './titleFit';
import {expansionIconUrl} from './premiumCardIcons';
import PremiumMechanicsPanel from './PremiumMechanicsPanel.vue';

type Clause = {kind: 'effect' | 'action', mechanics: MechanicsVM};

export default defineComponent({
  name: 'PremiumPartyFace',
  components: {PremiumMechanicsPanel},
  props: {
    vm: {type: Object as () => PremiumCardVM, required: true},
    /** The translated title and its length tier (the host face already derived both). */
    title: {type: String, required: true},
    titleTier: {type: Number as unknown as () => TitleTier, required: true},
    /** «Настройки» → «Номера карт» (`cardNumberDisplay.ts`), off by default. */
    showCode: {type: Boolean, default: false},
  },
  computed: {
    emblemUrl(): string {
      return this.vm.parliament?.emblemUrl ?? '';
    },
    delegateUrl(): string {
      return 'assets/misc/delegate.svg';
    },
    /** The party's clauses in the printed order — the standing effect, then the action (a party prints one or both). */
    clauses(): ReadonlyArray<Clause> {
      const charter = this.vm.parliament?.charter;
      const out: Array<Clause> = [];
      if (charter?.effect !== undefined) {
        out.push({kind: 'effect', mechanics: charter.effect});
      }
      if (charter?.action !== undefined) {
        out.push({kind: 'action', mechanics: charter.action});
      }
      return out;
    },
    expansionIcon(): string | undefined {
      return expansionIconUrl(this.vm.expansion);
    },
    expansionStyle(): Record<string, string> {
      return this.expansionIcon !== undefined ? {backgroundImage: `url(${this.expansionIcon})`} : {};
    },
  },
});
</script>

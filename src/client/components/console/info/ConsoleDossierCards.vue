<template>
  <!--
    THE DOSSIER'S CARD HISTORY (TR60 · the Information polish of 2026-10-19 — «минималистично, без перегруза»): what the
    seat has PLAYED, as a small TABLE — the corporation's face (the bot's own corporation face for MarsBot) and one neat
    PILE per printed type in the «Разыграно» table's own order and grouping (`buildPlayedZones` → `dossierCardHistory`),
    so this tile is the miniature of the table it opens. A pile is ONE upright card — the newest face; the events lie
    face DOWN, the table's own law — with the paper edges of what lies under it (one to three, by the count); under the
    pile the count in tabular numerals and the type's name, both quiet. No badges, no fans, no colour bars: the faces
    already carry their type's frame. Faces are LITE (inert, render-once) at the thumb tier, the corporation at the
    scene's full tier. Nothing here is focusable: the zone is the ring's stop. An empty story is a composed object —
    the outline of the pile that is not there, and one line saying so.
  -->
  <div ref="root" class="con-dcards" :class="{'con-dcards--empty': history.stacks.length === 0}" :data-stacks="history.stacks.length" data-dcards-fit="0" data-dossier-cards>
    <div class="con-dcards__corp" data-dossier-corp>
      <div v-if="botCorp !== undefined" class="con-dcards__corpface con-dcards__corpface--bot">
        <MarsBotCorpFace :id="botCorp.id" :resources="botCorp.resources" :resource="botCorp.resource" />
      </div>
      <div v-else-if="history.corporations.length > 0" class="con-dcards__corpface">
        <ConsoleCardFaceLite :name="history.corporations[0]" :card="cardOf(history.corporations[0])" />
      </div>
      <div v-else class="con-dcards__corpface con-dcards__corpface--ghost" aria-hidden="true"></div>
      <span v-if="history.corporations.length > 1" class="con-dcards__corpmore">+{{ history.corporations.length - 1 }}</span>
    </div>
    <div class="con-dcards__stacks">
      <div v-for="s in history.stacks" :key="s.key" class="con-dcards__stack" :class="'con-dcards__stack--' + s.key" :data-dossier-stack="s.key">
        <div class="con-dcards__pile" :data-depth="depthOf(s.count)">
          <span v-for="d in edgesOf(s.count)" :key="d" class="con-dcards__edge" :style="{'--edge-i': d}" aria-hidden="true"></span>
          <div v-if="s.key === 'events'" class="con-dcards__top con-dcards__top--back con-card-back" aria-hidden="true"></div>
          <div v-else-if="s.faces.length > 0" class="con-dcards__top">
            <ConsoleCardFaceLite :name="s.faces[0]" :card="cardOf(s.faces[0])" lightweight />
          </div>
        </div>
        <b class="con-dcards__count" data-dossier-stack-count>{{ s.count }}</b>
        <span class="con-dcards__label">{{ $t(s.label) }}</span>
      </div>
      <div v-if="history.stacks.length === 0" class="con-dcards__void" data-dossier-empty="played">
        <div class="con-dcards__pile con-dcards__pile--ghost" aria-hidden="true"><span class="con-dcards__ghostcard"></span></div>
        <span class="con-dcards__voidline">{{ $t('No played projects yet') }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, markRaw, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {MarsBotCorpModel} from '@/common/automa/MarsBotCorpData';
import {DossierCardHistory} from '@/client/console/infoDossierModel';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import MarsBotCorpFace from '@/client/components/marsbot/MarsBotCorpFace.vue';

/** The paper edges under a pile's top card: one per card beneath it, three at most (a pile reads thick, never tall). */
const MAX_EDGES = 3;
/** The steps the faces may take DOWN when the row does not fit its zone (`data-dcards-fit`, each a tenth smaller). */
const FIT_LEVELS = 3;

export default defineComponent({
  name: 'ConsoleDossierCards',
  components: {ConsoleCardFaceLite, MarsBotCorpFace},
  props: {
    history: {type: Object as PropType<DossierCardHistory>, required: true},
    /** The seat's live tableau — what makes a face's resource capsule the TRUTH, never a printed 0. */
    tableau: {type: Array as PropType<ReadonlyArray<CardModel>>, default: () => []},
    /** The bot's corporation (its own entity) — undefined for a human seat. */
    botCorp: {type: Object as PropType<MarsBotCorpModel | undefined>, default: undefined},
  },
  data() {
    return {
      observer: undefined as ResizeObserver | undefined,
    };
  },
  mounted() {
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = markRaw(new ResizeObserver(() => this.fit()));
      this.observer.observe(this.$refs.root as HTMLElement);
    }
    this.fit();
  },
  updated() {
    this.fit();
  },
  beforeUnmount() {
    this.observer?.disconnect();
    this.observer = undefined;
  },
  methods: {
    /**
     * THE ROW HOLDS ITS ZONE: the size the pile count chooses (`data-stacks`) is the START; when the zone is narrower
     * than that row (a long type name, the TV's caption floor, a narrow column) the faces step down a tenth at a time
     * (`data-dcards-fit` 0 → 3) until nothing stands past the zone — measured, never guessed. Attribute writes only.
     */
    fit(): void {
      const root = this.$refs.root as HTMLElement | undefined;
      if (root === undefined) {
        return;
      }
      const stacks = root.querySelector<HTMLElement>('.con-dcards__stacks');
      const overflows = () => root.scrollWidth > root.clientWidth + 1 || root.scrollHeight > root.clientHeight + 1 ||
        (stacks !== null && stacks.scrollWidth > stacks.clientWidth + 1);
      for (let level = 0; level <= FIT_LEVELS; level++) {
        root.dataset.dcardsFit = String(level);
        if (!overflows()) {
          return;
        }
      }
    },
    cardOf(name: CardName): CardModel | undefined {
      return this.tableau.find((c) => c.name === name);
    },
    depthOf(count: number): number {
      return Math.max(0, Math.min(MAX_EDGES, count - 1));
    },
    /** The edges farthest first — the DOM paints the nearest edge last, right under the top card. */
    edgesOf(count: number): Array<number> {
      return Array.from({length: this.depthOf(count)}, (_, i) => this.depthOf(count) - i);
    },
  },
});
</script>

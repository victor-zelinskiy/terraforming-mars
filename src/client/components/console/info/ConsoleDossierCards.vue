<template>
  <!--
    THE DOSSIER'S CARD HISTORY (TR60): the second voice of the Information summary — what the seat has PLAYED, as the
    cards themselves: the corporation's premium face (the bot's own corporation face for MarsBot — the played table's
    parity) and a fan per printed type (active · automated · events · preludes · CEO), the most recent faces on top,
    the count as the fan's badge. The grouping is the «Разыграно» table's own (`buildPlayedZones` →
    `dossierCardHistory`), so the dossier and the table can never disagree. Faces are LITE (inert, render-once) at the
    thumb tier, the corporation at the scene's full tier. Nothing here is focusable: the zone is the ring's stop.
    An empty story is a composed object — the silhouette of the fan that is not there, and one line saying so.
  -->
  <div class="con-dcards" :class="{'con-dcards--empty': history.stacks.length === 0, 'con-dcards--dense': history.stacks.length >= 4, 'con-dcards--few': history.stacks.length > 0 && history.stacks.length <= 2}" data-dossier-cards>
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
        <div class="con-dcards__fan" :data-faces="s.faces.length">
          <div v-for="(name, i) in reversed(s.faces)" :key="name" class="con-dcards__fanface"
               :style="{'--fan-i': i, '--fan-n': s.faces.length}">
            <ConsoleCardFaceLite :name="name" :card="cardOf(name)" lightweight />
          </div>
          <span class="con-dcards__badge" data-dossier-stack-count>{{ s.count }}</span>
        </div>
        <span class="con-dcards__label">{{ $t(s.label) }}<template v-if="s.more > 0"> <em class="con-dcards__more">+{{ s.more }}</em></template></span>
      </div>
      <div v-if="history.stacks.length === 0" class="con-dcards__void" data-dossier-empty="played">
        <div class="con-dcards__fan con-dcards__fan--ghost" aria-hidden="true">
          <span class="con-dcards__ghostcard"></span><span class="con-dcards__ghostcard"></span><span class="con-dcards__ghostcard"></span>
        </div>
        <span class="con-dcards__voidline">{{ $t('No played projects yet') }}</span>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {MarsBotCorpModel} from '@/common/automa/MarsBotCorpData';
import {DossierCardHistory} from '@/client/console/infoDossierModel';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import MarsBotCorpFace from '@/client/components/marsbot/MarsBotCorpFace.vue';

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
  methods: {
    cardOf(name: CardName): CardModel | undefined {
      return this.tableau.find((c) => c.name === name);
    },
    /** The fan is drawn bottom-up: the most recent face is the LAST child (on top). */
    reversed(faces: ReadonlyArray<CardName>): ReadonlyArray<CardName> {
      return [...faces].reverse();
    },
  },
});
</script>

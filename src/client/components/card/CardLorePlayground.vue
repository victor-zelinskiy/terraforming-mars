<template>
  <div class="lore-playground" :class="{'lore-playground--embedded': embedded}">
    <div class="lore-playground__bar">
      <span class="lore-playground__title">ARCHIVE ENTRY — visual states</span>
      <button v-for="l in LOCALES" :key="l.code"
              class="lore-playground__loc"
              :class="{'lore-playground__loc--on': lang === l.code}"
              @click="setLang(l.code)">{{ l.label }}</button>
      <label class="lore-playground__toggle">
        <input type="checkbox" v-model="revealed" /> revealed
      </label>
      <span class="lore-playground__hint">the strip on the right marks where the card frame would start</span>
    </div>

    <div class="lore-playground__grid">
      <section v-for="state in states" :key="state.key" class="lore-playground__cell">
        <header class="lore-playground__caption">
          <b>{{ state.key }}</b>
          <span>{{ state.note }}</span>
        </header>
        <!--
          The block is measured against the SAME geometry the fullscreen viewer
          gives it: the flank grid's gutter, right-aligned, with a card-frame
          marker where the stage would begin. `--card-zoom-fit` mirrors a
          typical fullscreen zoom so the vertical lift is representative.
        -->
        <div class="lore-playground__gutter">
          <CardLoreAside :key="`${state.key}-${lang}-${revealed}`"
                         :model="models[state.key]"
                         :nonce="revealed ? 1 : 0" />
          <span class="lore-playground__cardedge" aria-hidden="true"></span>
        </div>
      </section>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * DEV-ONLY visual harness for the fullscreen ARCHIVE ENTRY (`?lorePlayground`).
 *
 * The e2e drive proves the block inside a real fullscreen viewer; this shows
 * every TEXT SHAPE at once — the states the composition has to survive:
 * a one-line aphorism, a technical sentence, an ironic triple, an entry with
 * its own quotation marks, formulae / subscripts (E=mc², N₂, CO₂), the longest
 * corporate paragraph, and the no-entry fallback — in both RU and EN, because
 * a translation routinely wraps to a different number of lines.
 *
 * It renders the REAL component with the REAL data (no fixtures), so it can
 * never drift from production.
 */
import {defineComponent} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PartyName} from '@/common/turmoil/PartyName';
import {ReduxParty} from '@/common/parliament/ParliamentTypes';
import {PreferencesManager} from '@/client/utils/PreferencesManager';
import {LoreModel, buildCardLoreModel} from '@/client/cards/cardLore';
import {buildPartyLoreModel} from '@/client/cards/partyLore';
import {translateLore} from '@/client/cards/loreTranslate';
import CardLoreAside from '@/client/components/card/CardLoreAside.vue';

/** A stand cell: a project card's entry, or a Turmoil Redux party's paragraph. */
type LoreState = {key: string, card: CardName, note: string} | {key: string, party: ReduxParty, note: string};

const STATES: ReadonlyArray<LoreState> = [
  {key: 'short', card: CardName.AI_CENTRAL, note: '«Сорок два.» / “42.” — a one-line aphorism'},
  {key: 'short · slogan', card: CardName.PHOBOS_SPACE_HAVEN, note: 'a short slogan'},
  {key: 'regular · technical', card: CardName.BACTOVIRAL_RESEARCH, note: 'a plain technical sentence'},
  {key: 'regular · ironic', card: CardName.HACKERS, note: 'three clipped sentences'},
  {key: 'inner quotes', card: CardName.TOLL_STATION, note: 'the string already quotes something'},
  {key: 'inner quotes · long', card: CardName.LUNAR_EXPORTS, note: 'quotes inside a longer entry'},
  {key: 'formula', card: CardName.MASS_CONVERTER, note: 'E=mc² + an emphasised word'},
  {key: 'subscript', card: CardName.NITROGEN_RICH_ASTEROID, note: 'N₂ / CO₂ subscripts'},
  {key: 'quotation', card: CardName.CUTTING_EDGE_TECHNOLOGY, note: 'a full JFK quotation with an attribution dash'},
  {key: 'extended · corp', card: CardName.SATURN_SYSTEMS, note: 'the longest corporate paragraph'},
  {key: 'extended · corp 2', card: CardName.MINING_GUILD, note: 'a latin corporate name inside Russian prose'},
  {key: 'fallback', card: 'A Card With No Archive Entry' as CardName, note: 'no entry — the honest notice'},
  // The party corpus at both ends of its length — the same block, the other resolver.
  {key: 'party · longest', party: PartyName.INDUSTRIALISTS, note: 'the longest party paragraph (Industrialists)'},
  {key: 'party · shortest', party: PartyName.SCIENTISTS, note: 'the shortest party paragraph (Scientists)'},
];

const LOCALES = [{code: 'ru', label: 'RU'}, {code: 'en', label: 'EN'}] as const;

export default defineComponent({
  name: 'CardLorePlayground',
  components: {CardLoreAside},
  props: {
    /** Hosted in the console playground stand — the host owns fullscreen + scroll. */
    embedded: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      lang: PreferencesManager.INSTANCE.values().lang,
      revealed: true,
    };
  },
  computed: {
    states(): ReadonlyArray<LoreState> {
      return STATES;
    },
    /** One finished model per cell — rebuilt when the locale switches. */
    models(): Record<string, LoreModel> {
      void this.lang; // the dependency: the translator reads the locale outside reactivity
      const out: Record<string, LoreModel> = {};
      for (const state of STATES) {
        out[state.key] = 'party' in state ?
          buildPartyLoreModel(state.party, translateLore) :
          buildCardLoreModel(state.card, translateLore);
      }
      return out;
    },
    LOCALES(): ReadonlyArray<{code: string, label: string}> {
      return LOCALES;
    },
  },
  methods: {
    setLang(code: string): void {
      PreferencesManager.INSTANCE.set('lang', code);
      this.lang = code;
    },
  },
});
</script>

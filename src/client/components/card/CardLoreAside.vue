<template>
  <aside class="card-zoom-lore"
         :class="[
           'card-zoom-lore--' + model.tier,
           'card-zoom-lore--' + script,
           {'card-zoom-lore--fallback': model.fallback, 'card-zoom-lore--in': revealed},
         ]"
         data-test="card-zoom-lore">
    <h2 class="card-zoom-lore__label">
      <span class="card-zoom-lore__spark" aria-hidden="true"></span>
      <span class="card-zoom-lore__label-text">{{ heading }}</span>
      <span class="card-zoom-lore__rule" aria-hidden="true"></span>
      <span class="card-zoom-lore__tip" aria-hidden="true"></span>
    </h2>
    <!--
      The quotation marks are DECORATION, never punctuation: the lore strings
      already carry «», ‘’, dashes and, in one case, a full quotation. They are
      aria-hidden spans whose glyph is CSS-generated, so the accessible text
      stays exactly the localized sentence.
    -->
    <blockquote class="card-zoom-lore__quote" :lang="textLang">
      <span v-if="!model.fallback" class="card-zoom-lore__mark card-zoom-lore__mark--open" aria-hidden="true"></span>
      <span class="card-zoom-lore__text">{{ model.text }}</span>
      <span v-if="!model.fallback" class="card-zoom-lore__mark card-zoom-lore__mark--close" aria-hidden="true"></span>
    </blockquote>
  </aside>
</template>

<script lang="ts">
/**
 * FULLSCREEN ARCHIVE ENTRY (the card's lore text).
 *
 * A literary note in the LEFT gutter of the fullscreen card viewer,
 * deliberately NOT a panel: no frame, no head bar, no glass, no buttons, no
 * focus, no scroll, no truncation. Just a heading, a hairline pointing at the
 * card, the text in full, and two decorative quotation marks.
 * `pointer-events: none` (card_lore.less) keeps it out of every pointer and
 * controller path.
 *
 * Rendered ONLY by `CardZoomModal` (the one fullscreen card presentation of the
 * app) and only when its host opts in — so it can never leak into a card list,
 * the Action Focus hero, a compact zoom, the rules panel, the statistics tab,
 * a tooltip, the journal, or the card face itself.
 *
 * All resolution (lore lookup, the `reimplements` borrow, localization, the
 * length tier) happens in the pure `@/client/cards/cardLore` model — this
 * component only presents it and owns the reveal choreography.
 *
 * CHOREOGRAPHY: the block is silent until the card has LANDED. The host passes
 * its settle `nonce` (bumped when the fullscreen card is stationary — open
 * settled / LB-RB slide finished); until then the entry stays hidden and the
 * PREVIOUSLY shown text is kept on screen, so browsing never overlaps two
 * different entries and never snaps a height change into view.
 */
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {buildCardLoreModel, CardLoreModel, LORE_FALLBACK_KEY, LORE_HEADING_KEY, loreScriptForLocale, LoreScript} from '@/client/cards/cardLore';
import {translateText} from '@/client/directives/i18n';
import {getPreferences} from '@/client/utils/PreferencesManager';

/**
 * The lore corpus is PROSE, so it opts out of `translateText`'s "non-word"
 * guard — that guard is meant for card-render fragments (`x`, `3x`) and would
 * otherwise leave a whole archive entry that happens to be digits and a full
 * stop («42.» — AI Central) permanently untranslated.
 */
const translateLore = (englishText: string): string => translateText(englishText, {translateNonWordText: true});

export default defineComponent({
  name: 'CardLoreAside',
  props: {
    /** The card on the fullscreen stage. */
    cardName: {type: String as PropType<CardName>, required: true},
    /** The viewer's settle signal — 0 while the card is in flight / closed. */
    nonce: {type: Number, default: 0},
    /** The close flight began: fade out at once, never lag the departing card. */
    closing: {type: Boolean, default: false},
  },
  data() {
    return {
      /** The card whose entry is currently ON SCREEN. Swapped only while the
       *  block is hidden, so two entries can never be visible at once. */
      shownName: this.cardName as CardName,
      revealed: false,
    };
  },
  computed: {
    model(): CardLoreModel {
      return buildCardLoreModel(this.shownName, translateLore);
    },
    heading(): string {
      return translateText(LORE_HEADING_KEY);
    },
    script(): LoreScript {
      return loreScriptForLocale(getPreferences().lang);
    },
    /** Honest `lang` for the quotation: the active locale, unless the string
     *  came back untranslated (`translateText` returns its English key when the
     *  locale has no entry — and make:json forbids a translation equal to its
     *  own key, so identity means "not translated"). */
    textLang(): string {
      const lang = getPreferences().lang;
      if (lang === 'en') {
        return 'en';
      }
      const englishKey = this.model.fallback ? LORE_FALLBACK_KEY : this.model.source;
      return englishKey !== undefined && this.model.text === englishKey ? 'en' : lang;
    },
  },
  watch: {
    cardName() {
      // A browse step re-points the viewer BEFORE the new card settles: hide
      // now (the OLD text fades out), swap + reveal on the settle nonce.
      this.revealed = false;
    },
    nonce(value: number) {
      this.syncReveal(value);
    },
    closing(now: boolean) {
      if (now) {
        this.revealed = false;
      }
    },
  },
  mounted() {
    this.syncReveal(this.nonce);
  },
  methods: {
    syncReveal(nonce: number): void {
      if (nonce <= 0 || this.closing) {
        this.revealed = false;
        return;
      }
      this.shownName = this.cardName;
      this.revealed = true;
    },
  },
});
</script>

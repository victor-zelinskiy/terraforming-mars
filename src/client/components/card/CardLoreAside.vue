<template>
  <aside class="card-zoom-lore"
         :class="[
           'card-zoom-lore--' + model.tier,
           'card-zoom-lore--' + script,
           {'card-zoom-lore--fallback': model.fallback, 'card-zoom-lore--in': revealed,
            'card-zoom-lore--closing': closing},
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
      aria-hidden inline SVG, so the accessible text stays exactly the
      localized sentence — and the silhouette is identical on every platform
      and in both literary faces.
    -->
    <blockquote class="card-zoom-lore__quote" :lang="textLang">
      <svg v-if="!model.fallback"
           class="card-zoom-lore__mark card-zoom-lore__mark--open"
           :viewBox="MARK_VIEWBOX" aria-hidden="true" focusable="false">
        <g v-for="dx in MARK_OFFSETS" :key="dx" :transform="`translate(${dx} 0)`">
          <circle :cx="MARK_BOWL.cx" :cy="MARK_BOWL.cy" :r="MARK_BOWL.r" />
          <path :d="MARK_TAIL" />
        </g>
      </svg>
      <span class="card-zoom-lore__text">{{ model.text }}</span>
      <svg v-if="!model.fallback"
           class="card-zoom-lore__mark card-zoom-lore__mark--close"
           :viewBox="MARK_VIEWBOX" aria-hidden="true" focusable="false">
        <g v-for="dx in MARK_OFFSETS" :key="dx" :transform="`translate(${dx} 0)`">
          <circle :cx="MARK_BOWL.cx" :cy="MARK_BOWL.cy" :r="MARK_BOWL.r" />
          <path :d="MARK_TAIL" />
        </g>
      </svg>
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

/*
 * The decorative quotation mark, drawn LOCALLY as two commas.
 *
 * One comma = a bowl (the disc) + a tail sweeping up and to the left — the
 * classic "6" silhouette, so the pair reads as “ and, rotated 180° in CSS, as
 * ” (the real typographic relationship between the two, for free). Authored as
 * primitives rather than a font glyph so the shape is identical on Windows /
 * SteamOS and identical in Literata and Newsreader, and so its weight can be
 * tuned independently of the text face. No external asset, no filter, no mask.
 */
const MARK_VIEWBOX = '0 0 41 30';
const MARK_BOWL = {cx: 11.5, cy: 22.5, r: 7.5} as const;
// The tail: out of the bowl's right flank, up and to the left, tapering to a
// point at the top. Deliberately carries roughly half the bowl's visual mass —
// a smaller bowl with a longer tail is what makes the pair read as quotation
// marks rather than as two dots.
const MARK_TAIL = 'M18.6 19.2C19.4 11.5 13.6 4.2 2.6 0L0.6 5.6C8.6 8.6 12.4 13.6 12.4 19.6Z';
/** x offsets of the two commas inside the viewBox. */
const MARK_OFFSETS: ReadonlyArray<number> = [0, 22];

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
    // The decorative mark's geometry, exposed to the template (see the
    // MARK_* constants above — pure data, never state).
    MARK_VIEWBOX(): string {
      return MARK_VIEWBOX;
    },
    MARK_BOWL(): {cx: number, cy: number, r: number} {
      return MARK_BOWL;
    },
    MARK_TAIL(): string {
      return MARK_TAIL;
    },
    MARK_OFFSETS(): ReadonlyArray<number> {
      return MARK_OFFSETS;
    },
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

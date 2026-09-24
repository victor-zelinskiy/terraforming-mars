<template>
  <aside class="card-zoom-lore"
         :class="[
           'card-zoom-lore--' + shown.tier,
           'card-zoom-lore--' + script,
           {'card-zoom-lore--fallback': shown.fallback, 'card-zoom-lore--in': revealed,
            'card-zoom-lore--closing': closing},
         ]"
         data-test="card-zoom-lore">
    <!--
      THE BODY hugs the content; the ASIDE around it is a CONSTANT-height frame
      (card_lore.less). That split is what keeps «ЗАПИСЬ ИЗ АРХИВА» on the same
      line of the screen for every card while the radial scrim still wraps the
      words themselves — a scrim sized to the constant frame would sit under a
      one-line aphorism as a large dark blob with the text stranded at its top.
    -->
    <div class="card-zoom-lore__body">
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
        <svg v-if="!shown.fallback"
             class="card-zoom-lore__mark card-zoom-lore__mark--open"
             :viewBox="MARK_VIEWBOX" aria-hidden="true" focusable="false">
          <g v-for="dx in MARK_OFFSETS" :key="dx" :transform="`translate(${dx} 0)`">
            <circle :cx="MARK_BOWL.cx" :cy="MARK_BOWL.cy" :r="MARK_BOWL.r" />
            <path :d="MARK_TAIL" />
          </g>
        </svg>
        <span class="card-zoom-lore__text">{{ shown.text }}</span>
        <svg v-if="!shown.fallback"
             class="card-zoom-lore__mark card-zoom-lore__mark--close"
             :viewBox="MARK_VIEWBOX" aria-hidden="true" focusable="false">
          <g v-for="dx in MARK_OFFSETS" :key="dx" :transform="`translate(${dx} 0)`">
            <circle :cx="MARK_BOWL.cx" :cy="MARK_BOWL.cy" :r="MARK_BOWL.r" />
            <path :d="MARK_TAIL" />
          </g>
        </svg>
      </blockquote>
    </div>
  </aside>
</template>

<script lang="ts">
/**
 * FULLSCREEN ARCHIVE ENTRY (the subject's lore text).
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
 * THE BLOCK DOES NOT KNOW WHOSE LORE IT HOLDS. It receives a finished
 * `LoreModel` (source · text · fallback · tier) and presents it; the HOST
 * decides the subject and builds the model with that subject's resolver — a
 * project card through `@/client/cards/cardLore` (lore lookup, the
 * `reimplements` borrow, localization, the length tier), a Turmoil Redux party
 * through `@/client/cards/partyLore`. One heading, one typography, one reveal
 * choreography for every subject; no «if it is a party» branch in here, ever.
 *
 * CHOREOGRAPHY: the block is silent until the card has LANDED. The host passes
 * its settle `nonce` (bumped when the fullscreen card is stationary — open
 * settled / LB-RB slide finished); until then the entry stays hidden and the
 * PREVIOUSLY shown text is kept on screen, so browsing never overlaps two
 * different entries and never snaps a height change into view.
 */
import {defineComponent, PropType} from 'vue';
import {LoreModel, LORE_FALLBACK_KEY, LORE_HEADING_KEY, loreScriptForLocale, LoreScript} from '@/client/cards/cardLore';
import {translateText} from '@/client/directives/i18n';
import {getPreferences} from '@/client/utils/PreferencesManager';

/** Two models print the same thing — a rebuilt object is not a new entry. */
function sameLore(a: LoreModel, b: LoreModel): boolean {
  return a.text === b.text && a.source === b.source && a.fallback === b.fallback;
}

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
    /** The finished lore model of the subject on the fullscreen stage. */
    model: {type: Object as PropType<LoreModel>, required: true},
    /** The viewer's settle signal — 0 while the card is in flight / closed. */
    nonce: {type: Number, default: 0},
    /** The close flight began: fade out at once, never lag the departing card. */
    closing: {type: Boolean, default: false},
  },
  data() {
    return {
      /** The model currently ON SCREEN. Swapped only while the block is
       *  hidden, so two entries can never be visible at once. */
      shown: this.model as LoreModel,
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
      const englishKey = this.shown.fallback ? LORE_FALLBACK_KEY : this.shown.source;
      return englishKey !== undefined && this.shown.text === englishKey ? 'en' : lang;
    },
  },
  watch: {
    model(next: LoreModel, previous: LoreModel) {
      if (sameLore(next, previous)) {
        // The host rebuilt the object around the same words (a re-render, a
        // computed refreshed): adopt it in place — nothing to hide or reveal.
        this.shown = next;
        return;
      }
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
      this.shown = this.model;
      this.revealed = true;
    },
  },
});
</script>

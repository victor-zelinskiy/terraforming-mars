<template>
  <div class="mb-face mb-face--corp" :class="{'mb-face--large': large}">
    <header class="mbc__head">
      <span class="mbc__badge">{{ botName }}</span>
      <span class="mbc__number">{{ view.cardNumber }}</span>
    </header>
    <div class="mbc__identity">
      <PremiumCorpIdentity :name="view.original" />
    </div>
    <div v-if="art !== undefined" class="mbc__art">
      <PremiumCardArt :art="art" :tier="large ? 'full' : 'thumb'" />
    </div>
    <div v-if="view.startingTags.length > 0" class="mbc__tags">
      <span class="mbc__tags-label" v-i18n>Starting tags</span>
      <Tag v-for="(tag, i) in view.startingTags" :key="i" :tag="tag" size="med" type="secondary" />
    </div>
    <section v-for="section in view.sections" :key="section.kind" class="mbc__section">
      <span class="mbc__kicker" :class="'mbc__kicker--' + section.kind" v-i18n>{{ sectionLabel(section) }}</span>
      <div class="mb-face__lines">
        <div v-for="(line, i) in section.lines" :key="i" class="mb-face__line" :class="{'mb-face__line--muted': line.muted}">
          <span class="mb-face__icon-slot" aria-hidden="true">
            <i v-if="iconClass(line.icon) !== ''" class="mb-face__icon" :class="iconClass(line.icon)"></i>
            <span v-else-if="glyph(line.icon) !== ''" class="mb-face__glyph">{{ glyph(line.icon) }}</span>
          </span>
          <span class="mb-face__text">{{ lineText(line) }}</span>
        </div>
      </div>
    </section>
    <div v-if="view.resource !== undefined" class="mbc__res" :class="{'mbc__res--empty': (resources ?? 0) === 0}">
      <i class="mbc__res-icon" :class="resourceIconClass" aria-hidden="true"></i>
      <span class="mbc__res-label" v-i18n>{{ resourceLabel }}</span>
      <span class="mbc__res-count">{{ resources ?? 0 }}</span>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The MarsBot CORPORATION card face — the bot corporation as its own game
 * entity (Rule Book B). From the ORIGINAL human corporation it takes exactly
 * the four official links: name/logo (CardCorporationLogo), art
 * (premiumCardArt by the original CardName; lore rides the fullscreen aside
 * the same way) — and NOTHING else: the rule zone renders only the MarsBot
 * boxes (Draft Priority / Effect / Before Action Phase), the tag row only the
 * bot card's own starting tags, so no human rule or tag can ever leak in.
 * Shares the `mb-face` family chrome with BonusCardFace (`--large` = the
 * TV-readable tier; the fullscreen zoom stage fits `.mb-face`).
 */
import {defineComponent, PropType} from 'vue';
import {MarsBotCorpId} from '@/common/automa/AutomaTypes';
import {BonusCardEffectLine} from '@/common/automa/BonusCardData';
import {CORP_SECTION_LABEL, MarsBotCorpSection, MarsBotCorpView, buildMarsBotCorpView} from '@/common/automa/MarsBotCorpData';
import {PremiumCardArt as PremiumCardArtModel, premiumCardArt} from '@/client/cards/cardArt';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {automaDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import PremiumCardArt from '@/client/components/premiumCard/PremiumCardArt.vue';
import PremiumCorpIdentity from '@/client/components/premiumCard/PremiumCorpIdentity.vue';
import Tag from '@/client/components/Tag.vue';

/** MarsBot-specific icon keys (mirrors BonusCardFace's vocabulary). */
const OWN_ICONS: Record<string, string> = {
  city: 'mb-ico mb-ico--city',
  greenery: 'mb-ico mb-ico--greenery',
  ocean: 'mb-ico mb-ico--ocean',
  temperature: 'mb-ico mb-ico--temperature',
  venus: 'mb-ico mb-ico--venus',
  floater: 'mb-ico mb-ico--floater',
};

const GLYPHS: Record<string, string> = {
  milestone: '🏆',
  award: '🏅',
  vp: '★',
  deck: '▤',
};

export default defineComponent({
  name: 'MarsBotCorpFace',
  components: {PremiumCardArt, PremiumCorpIdentity, Tag},
  props: {
    id: {type: String as PropType<MarsBotCorpId>, required: true},
    /** Live resources ON the corporation card (Ecoline plant / Spire science). */
    resources: {type: Number, default: undefined},
    /** TV-readable sizing (console fullscreen). */
    large: {type: Boolean, default: false},
    /** Hide the art band (compact hosts: tableau slot rows). */
    compact: {type: Boolean, default: false},
  },
  computed: {
    view(): MarsBotCorpView {
      return buildMarsBotCorpView(this.id);
    },
    botName(): string {
      return automaDisplayName();
    },
    art(): PremiumCardArtModel | undefined {
      if (this.compact) {
        return undefined;
      }
      const art = premiumCardArt(this.view.original);
      // A corporation face never paints the procedural fallback (the
      // wordmark identity zone carries the look instead) — same rule as
      // resolveArt() on the premium human face.
      return art.fallback ? undefined : art;
    },
    resourceIconClass(): string {
      // The same families iconClassFor resolves: the standard plants sprite /
      // the science card-resource cube (single-dash class, cards_v2 family).
      return this.view.resource === 'plant' ?
        'resource_icon resource_icon--plants' :
        'card-resource card-resource-science';
    },
    resourceLabel(): string {
      return this.view.resource === 'plant' ? 'Plants on the card' : 'Science on the card';
    },
  },
  methods: {
    sectionLabel(section: MarsBotCorpSection): string {
      return CORP_SECTION_LABEL[section.kind];
    },
    iconClass(key: string | undefined): string {
      if (key === undefined) {
        return '';
      }
      if (OWN_ICONS[key] !== undefined) {
        return OWN_ICONS[key];
      }
      if (GLYPHS[key] !== undefined) {
        return '';
      }
      return iconClassFor(key);
    },
    glyph(key: string | undefined): string {
      return key !== undefined ? (GLYPHS[key] ?? '') : '';
    },
    lineText(line: BonusCardEffectLine): string {
      if (line.params !== undefined && line.params.length > 0) {
        return translateTextWithParams(line.text, [...line.params]);
      }
      return translateText(line.text);
    },
  },
});
</script>

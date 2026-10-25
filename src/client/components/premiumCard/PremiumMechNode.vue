<template>
  <!-- ITEM -->
  <span v-if="itemNode !== undefined"
        class="pcard-mi"
        :class="itemClasses">
    <!-- structural text kinds -->
    <span v-if="isPlateItem" class="pcard-plate">{{ itemText }}</span>
    <span v-else-if="isTextItem"
          class="pcard-mi__text"
          :class="[textSizeClass, {'pcard-mi__text--uc': itemNode.isUppercase, 'pcard-mi__text--b': itemNode.isBold}]">{{ itemText }}</span>
    <span v-else-if="isNbsp" class="pcard-mi__nbsp">&nbsp;</span>
    <!-- glyph icons (X multiplier, ? vp) -->
    <span v-else-if="glyph !== undefined" class="pcard-mi__digit">{{ glyph }}</span>
    <!-- the CEO once-per-game action marker: «1×» capsule + action arrow -->
    <span v-else-if="isOpgMarker" class="pcard-opg">
      <span class="pcard-opg__badge">1×</span>
      <span class="pcard-opg__arrow"></span>
    </span>
    <!-- localized text plate (prelude / award / milestone / ignore global req) -->
    <span v-else-if="labelText !== undefined" class="pcard-plate" :class="labelAccentClass">{{ labelText }}</span>
    <!-- trade-discount light value token -->
    <span v-else-if="isDiscountToken" class="pcard-token">{{ insideText }}</span>
    <!-- premium player cube (community) — the same 3D board marker -->
    <span v-else-if="cubeColor !== undefined" class="pcard-cube">
      <player-cube :color="cubeColor" :glow="true" :shadow="false" :overlay-symbol="false" />
    </span>
    <!-- the Mars Nomads camp — the SAME NomadToken the board renders -->
    <span v-else-if="isNomadMarker" class="pcard-cube pcard-cube--nomad">
      <nomad-token :shadow="false" :glow="true" />
    </span>
    <!-- a card with a tag and a VP icon (Turmoil Redux) — the shared composed glyph -->
    <PremiumVpCardGlyph v-else-if="isVpCard" class="pcard-ic pcard-ic--vp-card" :tag="vpCardTag" />
    <!-- a card with a requirement of ANY party (TR13) — the plate with the wild-party pill -->
    <PremiumPartyRequirementGlyph v-else-if="isPartyRequirement" class="pcard-ic pcard-ic--party-req" :class="{'pprq--waived': isPartyRequirementWaived}" :data-party-req-waived="isPartyRequirementWaived ? 'true' : undefined" />
    <!-- a card with ANY requirement (RX36) — the same plate, bare; the count as a DIGIT beside one plate -->
    <template v-else-if="isRequirementPlate">
      <span v-if="digitText !== undefined" class="pcard-mi__digit">{{ digitText }}</span>
      <PremiumPartyRequirementGlyph class="pcard-ic pcard-ic--party-req" :bare="true" data-requirement-plate="true" />
    </template>
    <!-- ONE NAMED PARTY's seal (TR62) — its emblem; a STACKED seal overlaps the one before it, the caption under the pair -->
    <span v-else-if="partySeal !== undefined" class="pcard-pseal" :class="{'pcard-pseal--stacked': partySeal.stacked === true, 'pcard-pseal--captioned': partySeal.caption !== undefined}" :data-party-seal="partySeal.party">
      <span class="pcard-pseal__disc" :style="{backgroundImage: `url(${partySeal.url})`}"></span>
      <span v-if="partySeal.caption !== undefined" class="pcard-pseal__caption">{{ $t(partySeal.caption) }}</span>
    </span>
    <!-- your cube on a party's banner (Septem Tribus:redux) — the wild-party pill with the cube in its corner -->
    <PremiumBannerCubeGlyph v-else-if="isBannerCube" class="pcard-ic pcard-ic--banner-cube" data-banner-cube-glyph="true" />
    <!-- a card that HOLDS resources (TR53) — the white card with its three cubes -->
    <PremiumResourceCardGlyph v-else-if="isResourceCard" class="pcard-ic pcard-ic--resource-card" :wild="resourceCardWild" />
    <!-- image icons -->
    <template v-else-if="iconUrl !== undefined">
      <span v-if="digitText !== undefined" class="pcard-mi__digit">{{ digitText }}</span>
      <span v-for="i in repeats" :key="i" class="pcard-ic" :class="iconModClass" :style="iconStyle">
        <span v-if="insideText !== undefined && i === 1" class="pcard-mi__inside" :class="{'pcard-mi__inside--rating': ratingInner}">{{ insideText }}</span>
      </span>
      <span v-if="bubbleUrl !== undefined" class="pcard-mi__bubble" :class="{'pcard-mi__bubble--tile': bubble?.shape === 'tile'}" :style="bubbleStyle"></span>
      <!-- «card WITH a requirement» (AltSecondaryTag.REQ — Xavier): the
           requirements plate in miniature, drawn, not an image -->
      <span v-else-if="isReqBubble" class="pcard-mi__bubble pcard-mi__bubble--req"></span>
    </template>
    <!-- honest fallback chip for unmapped vocabulary -->
    <span v-else class="pcard-mi__chip">{{ fallbackLabel }}</span>
    <!-- The fleet dock's mark slot — mounted on the ▲ of a printed trade only (PremiumFleetMark). -->
    <PremiumFleetMark v-if="isTradeNode()" />
  </span>

  <!-- SYMBOL -->
  <span v-else-if="symbolNode !== undefined"
        class="pcard-sym"
        :class="symbolClasses">
    <template v-if="!isArrowSymbol">{{ symbolGlyph }}</template>
  </span>

  <!-- TILE -->
  <!-- A TILE OVER A TILE (TR44 — a city on top of an ocean): ONE pictogram of two pieces — the water below, the
       city above, the printed down-arrow between them; the same node the dossier and the composer draw. -->
  <span v-else-if="tileNode !== undefined && tileSpec.over !== undefined" class="pcard-tile pcard-tile--over" data-tile-over>
    <span class="pcard-tile__under" :style="{backgroundImage: `url(${tileSpec.over})`}"></span>
    <span class="pcard-tile__top" :style="{backgroundImage: `url(${tileSpec.base})`}"></span>
    <span class="pcard-tile__down" aria-hidden="true"></span>
  </span>
  <span v-else-if="tileNode !== undefined" class="pcard-tile" :style="{backgroundImage: `url(${tileSpec.base})`}">
    <span v-if="tileSpec.symbol !== undefined" class="pcard-tile__symbol" :style="{backgroundImage: `url(${tileSpec.symbol})`}"></span>
  </span>

  <!-- PRODUCTION BOX -->
  <span v-else-if="productionNode !== undefined" class="pcard-prod">
    <span v-for="(row, ri) in productionNode.rows" :key="ri" class="pcard-prod__row">
      <PremiumMechNode v-for="(child, ci) in renderable(row)" :key="ci" :node="child" />
    </span>
  </span>

  <!-- EFFECT / ACTION frame -->
  <span v-else-if="effectNode !== undefined" class="pcard-effect" :class="{'pcard-effect--action': effectKind === 'action', 'pcard-effect--standing': effectKind !== 'action' && effect.cause.length === 0}">
    <!-- A part with an authored VERTICAL SPACE folds into LINES in the DOM
         (`partLines`) — a column of rows, never a 100%-basis spacer: a
         wrapping row's max-content is the sum of its items, so the spacer
         left a shrink-to-fit host as wide as the single-line layout. -->
    <span v-if="effect.cause.length > 0" class="pcard-effect__part" :class="{'pcard-effect__part--lines': causeLines.length > 1}">
      <template v-if="causeLines.length > 1">
        <span v-for="(line, li) in causeLines" :key="'cl' + li" class="pcard-effect__line">
          <PremiumMechNode v-for="(child, ci) in line" :key="ci" :node="child" />
        </span>
      </template>
      <template v-else>
        <PremiumMechNode v-for="(child, ci) in effect.cause" :key="'c' + ci" :node="child" />
      </template>
    </span>
    <!-- A STANDING MODIFIER (an EFFECT with no cause — a discount, an extra
         tag, an influence bonus) prints its result alone inside the effect
         frame: the frame already says «effect», and a lone colon before the
         result reads as a trigger whose condition went missing. An ACTION
         keeps its arrow whatever it costs — «→ result» IS a free action. -->
    <PremiumMechNode v-if="effect.delimiter !== undefined && (effectKind === 'action' || effect.cause.length > 0)" :node="effect.delimiter" />
    <span class="pcard-effect__part" :class="{'pcard-effect__part--lines': resultLines.length > 1}">
      <template v-if="resultLines.length > 1">
        <span v-for="(line, li) in resultLines" :key="'rl' + li" class="pcard-effect__line">
          <PremiumMechNode v-for="(child, ci) in line" :key="ci" :node="child" />
        </span>
      </template>
      <template v-else>
        <PremiumMechNode v-for="(child, ci) in effect.result" :key="'r' + ci" :node="child" />
      </template>
    </span>
  </span>

  <!-- CORP BOX (defensive — mechanicsModel flattens corp boxes into root
       groups, so this branch is normally unreachable) -->
  <span v-else-if="corpBoxNode !== undefined" class="pcard-effect">
    <template v-for="(row, ri) in corpBoxNode.rows" :key="ri">
      <PremiumMechNode v-for="(child, ci) in renderable(row)" :key="ri + '-' + ci" :node="child" />
    </template>
  </span>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';
import {AltSecondaryTag} from '@/common/cards/render/AltSecondaryTag';
import {Size} from '@/common/cards/render/Size';
import {Tag} from '@/common/cards/Tag';
import {
  ItemType,
  ICardRenderEffect,
  ICardRenderItem,
  ICardRenderProductionBox,
  ICardRenderSymbol,
  ICardRenderTile,
  isICardRenderCorpBoxAction,
  isICardRenderCorpBoxEffect,
  isICardRenderCorpBoxEffectAction,
  isICardRenderEffect,
  isICardRenderItem,
  isICardRenderProductionBox,
  isICardRenderSymbol,
  isICardRenderTile,
} from '@/common/cards/render/Types';
import {effectKindOf, effectParts, EffectParts, itemRepeats, partLines, renderableNodes} from './mechanicsModel';
import {mechItemIcon, MechIconSpec, secondaryBubbleOf, SecondaryBubbleSpec, tagIconStyle, tileIcon, TileIconSpec} from './premiumCardIcons';
import {translateText} from '@/client/directives/i18n';
import {Color} from '@/common/Color';
import PlayerCube from '@/client/components/PlayerCube.vue';
import NomadToken from '@/client/components/NomadToken.vue';
import PremiumVpCardGlyph from './PremiumVpCardGlyph.vue';
import PremiumResourceCardGlyph from './PremiumResourceCardGlyph.vue';
import PremiumPartyRequirementGlyph from './PremiumPartyRequirementGlyph.vue';
import PremiumBannerCubeGlyph from './PremiumBannerCubeGlyph.vue';
import PremiumFleetMark from './PremiumFleetMark.vue';

type CorpBoxLike = {rows: Array<Array<ItemType>>};

/**
 * ONE recursive renderer for every mechanics node of the render DSL —
 * item / symbol / tile / production box / effect frame. Pure presentation:
 * classification and icon resolution live in mechanicsModel / premiumCardIcons.
 */
export default defineComponent({
  name: 'PremiumMechNode',
  components: {PlayerCube, NomadToken, PremiumVpCardGlyph, PremiumPartyRequirementGlyph, PremiumBannerCubeGlyph, PremiumResourceCardGlyph, PremiumFleetMark},
  props: {
    node: {
      type: [Object, String] as unknown as () => ItemType,
      required: true,
    },
  },
  computed: {
    itemNode(): ICardRenderItem | undefined {
      return isICardRenderItem(this.node) ? this.node : undefined;
    },
    symbolNode(): ICardRenderSymbol | undefined {
      return isICardRenderSymbol(this.node) ? this.node : undefined;
    },
    tileNode(): ICardRenderTile | undefined {
      return isICardRenderTile(this.node) ? this.node : undefined;
    },
    productionNode(): ICardRenderProductionBox | undefined {
      return isICardRenderProductionBox(this.node) ? this.node : undefined;
    },
    effectNode(): ICardRenderEffect | undefined {
      return isICardRenderEffect(this.node) ? this.node : undefined;
    },
    corpBoxNode(): CorpBoxLike | undefined {
      const n = this.node;
      if (isICardRenderCorpBoxEffect(n) || isICardRenderCorpBoxAction(n) || isICardRenderCorpBoxEffectAction(n)) {
        return n;
      }
      return undefined;
    },

    /* ── item rendering ─────────────────────────────────────────────── */
    isTextItem(): boolean {
      return this.itemNode?.type === CardRenderItemType.TEXT;
    },
    isPlateItem(): boolean {
      return this.itemNode?.type === CardRenderItemType.PLATE || this.itemNode?.isPlate === true;
    },
    isNbsp(): boolean {
      return this.itemNode?.type === CardRenderItemType.NBSP;
    },
    itemText(): string {
      const item = this.itemNode;
      if (item === undefined) {
        return '';
      }
      const raw = item.text ?? item.innerText ?? '';
      const translated = translateText(raw);
      return item.inParens === true ? `(${translated})` : translated;
    },
    /** Resolve the icon spec ONCE for this item (structural kinds excluded). */
    mechIcon(): MechIconSpec | undefined {
      const item = this.itemNode;
      if (item === undefined || this.isTextItem || this.isPlateItem || this.isNbsp) {
        return undefined;
      }
      return mechItemIcon(item);
    },
    glyph(): string | undefined {
      return this.mechIcon?.kind === 'glyph' ? this.mechIcon.glyph : undefined;
    },
    iconUrl(): string | undefined {
      return this.mechIcon?.kind === 'img' ? this.mechIcon.url : undefined;
    },
    iconModClass(): string | undefined {
      const icon = this.mechIcon;
      return icon?.kind === 'img' && icon.mod !== undefined ? `pcard-ic--${icon.mod}` : undefined;
    },
    iconStyle(): Record<string, string> {
      const item = this.itemNode;
      if (this.iconUrl !== undefined && item?.type === CardRenderItemType.TAG && item.tag !== undefined) {
        return tagIconStyle(item.tag);
      }
      return this.iconUrl !== undefined ? {backgroundImage: `url(${this.iconUrl})`} : {};
    },
    /** Localized text plate (prelude / award / milestone / global requirements). */
    labelText(): string | undefined {
      const icon = this.mechIcon;
      return icon?.kind === 'label' ? translateText(icon.text) : undefined;
    },
    labelAccentClass(): string | undefined {
      const icon = this.mechIcon;
      return icon?.kind === 'label' && icon.accent !== undefined ? `pcard-plate--${icon.accent}` : undefined;
    },
    /** Trade-discount light value token (the −N rides `insideText`). */
    isDiscountToken(): boolean {
      return this.mechIcon?.kind === 'token';
    },
    /** The CEO once-per-game action marker (ARROW_OPG). */
    isOpgMarker(): boolean {
      return this.mechIcon?.kind === 'opg';
    },
    /**
     * Sized text runs — the DSL's `.text('5', Size.LARGE)` (Tate / Faraday
     * counters), `Size.SMALL` clarifiers and `Size.TINY` fine print keep
     * their printed proportions instead of collapsing to one size.
     */
    textSizeClass(): string | undefined {
      switch (this.itemNode?.size) {
      case Size.LARGE: return 'pcard-mi__text--lg';
      case Size.SMALL: return 'pcard-mi__text--sm';
      case Size.TINY: return 'pcard-mi__text--xs';
      default: return undefined;
      }
    },
    /** Premium player-cube colour for the community marker. */
    cubeColor(): Color | undefined {
      return this.mechIcon?.kind === 'cube' ? this.mechIcon.color : undefined;
    },
    /** The Mars Nomads camp marker — the board's own NomadToken. */
    isNomadMarker(): boolean {
      return this.mechIcon?.kind === 'nomad';
    },
    isVpCard(): boolean {
      return this.mechIcon?.kind === 'vpCard';
    },
    vpCardTag(): Tag | undefined {
      return this.mechIcon?.kind === 'vpCard' ? this.mechIcon.tag : undefined;
    },
    isPartyRequirement(): boolean {
      return this.mechIcon?.kind === 'partyRequirement';
    },
    /** «Your cube on a party's banner» (Septem Tribus:redux). */
    isBannerCube(): boolean {
      return this.mechIcon?.kind === 'bannerCube';
    },
    /** The requirement plate alone (RX36 — «a card with ANY requirement»). */
    isRequirementPlate(): boolean {
      return this.mechIcon?.kind === 'requirementPlate';
    },
    /** The party plate STRUCK (TR70 — the next card ignores its party requirement): the class's own diagonal, not the generic ×. */
    isPartyRequirementWaived(): boolean {
      return this.mechIcon?.kind === 'partyRequirement' && this.mechIcon.waived === true;
    },
    /** One named party's seal (TR62 Tharsis Alliance) — its emblem from the one table, never a text plate. */
    partySeal(): Extract<MechIconSpec, {kind: 'partySeal'}> | undefined {
      const icon = this.mechIcon;
      return icon?.kind === 'partySeal' ? icon : undefined;
    },
    isResourceCard(): boolean {
      return this.mechIcon?.kind === 'resourceCard';
    },
    /** The holder carries the printed «?» — a KIND of resource (RX41), not its three cubes. */
    resourceCardWild(): boolean {
      const icon = this.mechIcon;
      return icon?.kind === 'resourceCard' && icon.wild === true;
    },
    isMegacredits(): boolean {
      return this.itemNode?.type === CardRenderItemType.MEGACREDITS;
    },
    /** A RATING square with an authored inner text (RX42's «>») — printed inside, in the square's own light ink. */
    ratingInner(): boolean {
      const item = this.itemNode;
      return item !== undefined && item.type === CardRenderItemType.TR && item.innerText !== undefined && item.innerText !== '';
    },
    /** M€ (and explicit amountInside items) draw the value INSIDE the icon. */
    insideText(): string | undefined {
      const item = this.itemNode;
      if (item === undefined) {
        return undefined;
      }
      if (item.questionMark === true) {
        return '?';
      }
      // A RATING with an authored inner text (RX42 UNMI Veto prints «[TR >] : [TR struck]» — the «>» the scan
      // puts inside the first rating square): the DSL's `{text}` option on a TR item is the author saying «print this
      // INSIDE the icon»; before this branch the premium face dropped it and printed two identical squares.
      if (this.isMegacredits || item.amountInside === true || this.ratingInner) {
        // The DSL's `{text: 'x'}` item option lands on `innerText`, NOT `text`
        // (`text` is set only by `.plate()` / `.text()`, which never produce an
        // M€ item) — reading only `text` printed the placeholder amount `1` over
        // every variable M€ face («2x» on Energy Market, «?» on Playwrights,
        // «0» on Nirgal Enterprises). Legacy `CardRenderItemComponent` has always
        // preferred `innerText` here; mirror it.
        const override = item.innerText ?? item.text;
        if (override !== undefined && override !== '') {
          return override;
        }
        // A REAL negative here (an M€ discount like «−4») keeps its sign —
        // typographic minus for consistency with the cost delta chip.
        return String(item.amount).replace('-', '−');
      }
      return undefined;
    },
    repeats(): number {
      const item = this.itemNode;
      if (item === undefined) {
        return 1;
      }
      if (this.insideText !== undefined) {
        return 1;
      }
      return itemRepeats(item);
    },
    /*
     * Leading digit («3 [icon]») when the count doesn't repeat as icons.
     * LEGACY SEMANTICS (load-bearing): the digit shows ONLY on an explicit
     * `showDigit` (or the >5 compactness heuristic) and is ALWAYS the
     * ABSOLUTE value — negativity in the DSL rides explicit MINUS symbol
     * nodes, and `amount: -1` is the builder's «unspecified» default
     * (= one icon, no digit). Deriving a digit from a negative amount
     * plastered a bogus «−1» over every default icon.
     */
    digitText(): string | undefined {
      const item = this.itemNode;
      if (item === undefined || this.insideText !== undefined) {
        return undefined;
      }
      const showDigit = item.showDigit === true || Math.abs(item.amount) > 5;
      if (!showDigit) {
        return undefined;
      }
      return String(Math.abs(item.amount));
    },
    /** The corner mark this item wears — the ONE mapping (`premiumCardIcons.secondaryBubbleOf`). */
    bubble(): SecondaryBubbleSpec | undefined {
      return this.itemNode === undefined ? undefined : secondaryBubbleOf(this.itemNode);
    },
    /** The secondary-tag bubble — a tag through the ONE tag style, so a planet sphere seats like the rest. */
    bubbleStyle(): Record<string, string> {
      const bubble = this.bubble;
      if (bubble === undefined) {
        return {};
      }
      return bubble.tag !== undefined ? tagIconStyle(bubble.tag) : {backgroundImage: `url(${bubble.url})`};
    },
    bubbleUrl(): string | undefined {
      return this.bubble?.url;
    },
    /** «Card with a requirement» (Xavier) — a drawn copper bar, no asset. */
    isReqBubble(): boolean {
      return this.itemNode?.secondaryTag === AltSecondaryTag.REQ;
    },
    itemClasses(): Record<string, boolean> {
      const item = this.itemNode;
      return {
        'pcard-mi--mc': this.insideText !== undefined,
        'pcard-mi--any': item?.anyPlayer === true,
        // The party plate draws the one-play class's own stroke (`pprq--waived`), never the generic × over it too.
        'pcard-mi--cancelled': item?.cancelled === true && !this.isPartyRequirementWaived,
        'pcard-mi--bubbled': this.bubbleUrl !== undefined || this.isReqBubble,
        'pcard-mi--superscript': item?.isSuperscript === true,
      };
    },
    fallbackLabel(): string {
      return String(this.itemNode?.type ?? '?');
    },

    /* ── symbol rendering ───────────────────────────────────────────── */
    isArrowSymbol(): boolean {
      return this.symbolNode?.type === CardRenderSymbolType.ARROW;
    },
    symbolGlyph(): string {
      switch (this.symbolNode?.type) {
      case CardRenderSymbolType.OR: return translateText('OR');
      case CardRenderSymbolType.MINUS: return '−';
      case CardRenderSymbolType.PLUS: return '+';
      case CardRenderSymbolType.COLON: return ':';
      case CardRenderSymbolType.SLASH: return '/';
      case CardRenderSymbolType.ASTERIX: return '*';
      case CardRenderSymbolType.EQUALS: return '=';
      case CardRenderSymbolType.BRACKET_OPEN: return '(';
      case CardRenderSymbolType.BRACKET_CLOSE: return ')';
      case CardRenderSymbolType.NBSP:
      case CardRenderSymbolType.VSPACE:
      case CardRenderSymbolType.EMPTY: return ' ';
      default: return '';
      }
    },
    symbolClasses(): Record<string, boolean> {
      const s = this.symbolNode;
      return {
        'pcard-sym--arrow': this.isArrowSymbol,
        'pcard-sym--or': s?.type === CardRenderSymbolType.OR,
        'pcard-sym--asterix': s?.type === CardRenderSymbolType.ASTERIX,
        // A vertical space is a LINE BREAK inside a wrapping row (the legacy
        // renderer drew it as a block-level spacer): the authored break point
        // of a long formula — the Reds' payout under their draw-and-discard.
        'pcard-sym--vspace': s?.type === CardRenderSymbolType.VSPACE,
        'pcard-sym--cancelled': s?.cancelled === true,
      };
    },

    /* ── tile / effect (template-guarded by their v-else-if branches; the
          neutral fallbacks only satisfy the type checker) ──────────────── */
    tileSpec(): TileIconSpec {
      const node = this.tileNode;
      return node === undefined ? {base: ''} : tileIcon(node);
    },
    effect(): EffectParts {
      const node = this.effectNode;
      return node === undefined ? {cause: [], delimiter: undefined, result: []} : effectParts(node);
    },
    /** The cause's authored lines (a VERTICAL SPACE is a structural break — see `partLines`). */
    causeLines(): Array<Array<ItemType>> {
      return partLines(this.effect.cause);
    },
    /** The result's authored lines. */
    resultLines(): Array<Array<ItemType>> {
      return partLines(this.effect.result);
    },
    effectKind(): 'effect' | 'action' {
      const node = this.effectNode;
      return node === undefined ? 'effect' : effectKindOf(node);
    },
  },
  methods: {
    /** The ▲ of a printed trade — the only node a fleet-dock face hangs its mark on (a method: no effect per node). */
    isTradeNode(): boolean {
      return this.itemNode?.type === CardRenderItemType.TRADE;
    },
    renderable(row: ReadonlyArray<ItemType>): Array<ItemType> {
      return renderableNodes(row);
    },
  },
});
</script>

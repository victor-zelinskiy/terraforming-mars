<template>
  <!-- ITEM -->
  <span v-if="itemNode !== undefined"
        class="pcard-mi"
        :class="itemClasses">
    <!-- structural text kinds -->
    <span v-if="isPlateItem" class="pcard-plate">{{ itemText }}</span>
    <span v-else-if="isTextItem"
          class="pcard-mi__text"
          :class="{'pcard-mi__text--uc': itemNode.isUppercase, 'pcard-mi__text--b': itemNode.isBold}">{{ itemText }}</span>
    <span v-else-if="isNbsp" class="pcard-mi__nbsp">&nbsp;</span>
    <!-- glyph icons (X multiplier, ? vp) -->
    <span v-else-if="glyph !== undefined" class="pcard-mi__digit">{{ glyph }}</span>
    <!-- image icons -->
    <template v-else-if="iconUrl !== undefined">
      <span v-if="digitText !== undefined" class="pcard-mi__digit">{{ digitText }}</span>
      <span v-for="i in repeats" :key="i" class="pcard-ic" :style="iconStyle">
        <span v-if="insideText !== undefined && i === 1" class="pcard-mi__inside">{{ insideText }}</span>
      </span>
      <span v-if="bubbleUrl !== undefined" class="pcard-mi__bubble" :style="{backgroundImage: `url(${bubbleUrl})`}"></span>
    </template>
    <!-- honest fallback chip for unmapped vocabulary -->
    <span v-else class="pcard-mi__chip">{{ fallbackLabel }}</span>
  </span>

  <!-- SYMBOL -->
  <span v-else-if="symbolNode !== undefined"
        class="pcard-sym"
        :class="symbolClasses">
    <template v-if="!isArrowSymbol">{{ symbolGlyph }}</template>
  </span>

  <!-- TILE -->
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
  <span v-else-if="effectNode !== undefined" class="pcard-effect" :class="{'pcard-effect--action': effectKind === 'action'}">
    <span v-if="effect.cause.length > 0" class="pcard-effect__part">
      <PremiumMechNode v-for="(child, ci) in effect.cause" :key="'c' + ci" :node="child" />
    </span>
    <PremiumMechNode v-if="effect.delimiter !== undefined" :node="effect.delimiter" />
    <span class="pcard-effect__part">
      <PremiumMechNode v-for="(child, ci) in effect.result" :key="'r' + ci" :node="child" />
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
import {effectKindOf, effectParts, EffectParts, itemRepeats, renderableNodes} from './mechanicsModel';
import {mechItemIcon, tagIconUrl, tileIcon, TileIconSpec} from './premiumCardIcons';
import {translateText} from '@/client/directives/i18n';

type CorpBoxLike = {rows: Array<Array<ItemType>>};

/**
 * ONE recursive renderer for every mechanics node of the render DSL —
 * item / symbol / tile / production box / effect frame. Pure presentation:
 * classification and icon resolution live in mechanicsModel / premiumCardIcons.
 */
export default defineComponent({
  name: 'PremiumMechNode',
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
    glyph(): string | undefined {
      const item = this.itemNode;
      if (item === undefined || this.isTextItem || this.isPlateItem || this.isNbsp) {
        return undefined;
      }
      const icon = mechItemIcon(item);
      return icon?.kind === 'glyph' ? icon.glyph : undefined;
    },
    iconUrl(): string | undefined {
      const item = this.itemNode;
      if (item === undefined || this.isTextItem || this.isPlateItem || this.isNbsp) {
        return undefined;
      }
      const icon = mechItemIcon(item);
      return icon?.kind === 'img' ? icon.url : undefined;
    },
    iconStyle(): Record<string, string> {
      return this.iconUrl !== undefined ? {backgroundImage: `url(${this.iconUrl})`} : {};
    },
    isMegacredits(): boolean {
      return this.itemNode?.type === CardRenderItemType.MEGACREDITS;
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
      if (this.isMegacredits || item.amountInside === true) {
        if (item.text !== undefined && item.text !== '') {
          return item.text;
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
    bubbleUrl(): string | undefined {
      const secondary = this.itemNode?.secondaryTag;
      if (secondary === undefined) {
        return undefined;
      }
      if ((Object.values(Tag) as Array<string>).includes(secondary)) {
        return tagIconUrl(secondary as Tag);
      }
      if (secondary === AltSecondaryTag.OXYGEN) {
        // The oxygen-raising greenery uses the O₂-BAKED asset (greenery.png)
        // — a separate bubble would double the symbol.
        if (this.itemNode?.type === CardRenderItemType.GREENERY) {
          return undefined;
        }
        return 'assets/global-parameters/oxygen.png';
      }
      if (secondary === AltSecondaryTag.FLOATER) {
        return 'assets/resources/floater.png';
      }
      return undefined;
    },
    itemClasses(): Record<string, boolean> {
      const item = this.itemNode;
      return {
        'pcard-mi--mc': this.insideText !== undefined,
        'pcard-mi--any': item?.anyPlayer === true,
        'pcard-mi--cancelled': item?.cancelled === true,
        'pcard-mi--bubbled': this.bubbleUrl !== undefined,
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
    effectKind(): 'effect' | 'action' {
      const node = this.effectNode;
      return node === undefined ? 'effect' : effectKindOf(node);
    },
  },
  methods: {
    renderable(row: ReadonlyArray<ItemType>): Array<ItemType> {
      return renderableNodes(row);
    },
  },
});
</script>

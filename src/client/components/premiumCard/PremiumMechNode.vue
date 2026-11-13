<template>
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
      <span v-if="bubbleUrl !== undefined" class="pcard-mi__bubble"
            :class="{'pcard-mi__bubble--tile': bubble?.shape === 'tile', 'pcard-mi__bubble--card': bubble?.shape === 'card', 'pcard-ic--type-green': bubble?.band === 'green', 'pcard-ic--type-blue': bubble?.band === 'blue'}"
            :style="bubbleStyle"></span>
    </template>
    <!-- honest fallback chip for unmapped vocabulary -->
    <span v-else class="pcard-mi__chip">{{ fallbackLabel }}</span>
    <!-- The fleet dock's mark slot — mounted on the ▲ of a printed trade only (PremiumFleetMark). -->
    <PremiumFleetMark v-if="isTradeNode()" />
  </span>

  <span v-else-if="symbolNode !== undefined"
        class="pcard-sym"
        :class="symbolClasses">
    <!-- SYMBOL -->
    <template v-if="!isArrowSymbol">{{ symbolGlyph }}</template>
  </span>

  <span v-else-if="tileNode !== undefined && tileSpec.over !== undefined" class="pcard-tile pcard-tile--over" data-tile-over>
    <!-- TILE -->
    <!-- A TILE OVER A TILE (TR44 — a city on top of an ocean): ONE pictogram of two pieces — the water below, the
         city above, the printed down-arrow between them; the same node the dossier and the composer draw. -->
    <span class="pcard-tile__under" :style="{backgroundImage: `url(${tileSpec.over})`}"></span>
    <span class="pcard-tile__top" :style="{backgroundImage: `url(${tileSpec.base})`}"></span>
    <span class="pcard-tile__down" aria-hidden="true"></span>
  </span>
  <span v-else-if="tileNode !== undefined" class="pcard-tile" :style="{backgroundImage: `url(${tileSpec.base})`}">
    <span v-if="tileSpec.symbol !== undefined" class="pcard-tile__symbol" :style="{backgroundImage: `url(${tileSpec.symbol})`}"></span>
  </span>

  <span v-else-if="productionNode !== undefined" class="pcard-prod">
    <!-- PRODUCTION BOX -->
    <span v-for="(row, ri) in productionNode.rows" :key="ri" class="pcard-prod__row">
      <PremiumMechNode v-for="(child, ci) in renderable(row)" :key="ci" :node="child" />
    </span>
  </span>

  <span v-else-if="effectNode !== undefined" class="pcard-effect" :class="{'pcard-effect--action': effectKind === 'action', 'pcard-effect--standing': effectKind !== 'action' && effect.cause.length === 0}">
    <!-- EFFECT / ACTION frame -->
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

  <span v-else-if="corpBoxNode !== undefined" class="pcard-effect">
    <!-- CORP BOX (defensive — mechanicsModel flattens corp boxes into root
         groups, so this branch is normally unreachable) -->
    <template v-for="(row, ri) in corpBoxNode.rows" :key="ri">
      <PremiumMechNode v-for="(child, ci) in renderable(row)" :key="ri + '-' + ci" :node="child" />
    </template>
  </span>
</template>

<script setup lang="ts">
/*
 * ITEM
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed} from 'vue';
import {CardRenderItemType} from '@/common/cards/render/CardRenderItemType';
import {CardRenderSymbolType} from '@/common/cards/render/CardRenderSymbolType';
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
import {$t, translateText} from '@/client/directives/i18n';
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
defineOptions({name: 'PremiumMechNode'});
const props = defineProps({
  node: {
    type: [Object, String] as unknown as () => ItemType,
    required: true,
  },
});

const itemNode = computed((): ICardRenderItem | undefined => {
  return isICardRenderItem(props.node) ? props.node : undefined;
});
const symbolNode = computed((): ICardRenderSymbol | undefined => {
  return isICardRenderSymbol(props.node) ? props.node : undefined;
});
const tileNode = computed((): ICardRenderTile | undefined => {
  return isICardRenderTile(props.node) ? props.node : undefined;
});
const productionNode = computed((): ICardRenderProductionBox | undefined => {
  return isICardRenderProductionBox(props.node) ? props.node : undefined;
});
const effectNode = computed((): ICardRenderEffect | undefined => {
  return isICardRenderEffect(props.node) ? props.node : undefined;
});
const corpBoxNode = computed((): CorpBoxLike | undefined => {
  const n = props.node;
  if (isICardRenderCorpBoxEffect(n) || isICardRenderCorpBoxAction(n) || isICardRenderCorpBoxEffectAction(n)) {
    return n;
  }
  return undefined;
});

/* ── item rendering ─────────────────────────────────────────────── */
const isTextItem = computed((): boolean => {
  return itemNode.value?.type === CardRenderItemType.TEXT;
});
const isPlateItem = computed((): boolean => {
  return itemNode.value?.type === CardRenderItemType.PLATE || itemNode.value?.isPlate === true;
});
const isNbsp = computed((): boolean => {
  return itemNode.value?.type === CardRenderItemType.NBSP;
});
const itemText = computed((): string => {
  const item = itemNode.value;
  if (item === undefined) {
    return '';
  }
  const raw = item.text ?? item.innerText ?? '';
  const translated = translateText(raw);
  return item.inParens === true ? `(${translated})` : translated;
});
/** Resolve the icon spec ONCE for this item (structural kinds excluded). */
const mechIcon = computed((): MechIconSpec | undefined => {
  const item = itemNode.value;
  if (item === undefined || isTextItem.value || isPlateItem.value || isNbsp.value) {
    return undefined;
  }
  return mechItemIcon(item);
});
const glyph = computed((): string | undefined => {
  return mechIcon.value?.kind === 'glyph' ? mechIcon.value.glyph : undefined;
});
const iconUrl = computed((): string | undefined => {
  return mechIcon.value?.kind === 'img' ? mechIcon.value.url : undefined;
});
const iconModClass = computed((): string | undefined => {
  const icon = mechIcon.value;
  return icon?.kind === 'img' && icon.mod !== undefined ? `pcard-ic--${icon.mod}` : undefined;
});
const iconStyle = computed((): Record<string, string> => {
  const item = itemNode.value;
  if (iconUrl.value !== undefined && item?.type === CardRenderItemType.TAG && item.tag !== undefined) {
    return tagIconStyle(item.tag);
  }
  return iconUrl.value !== undefined ? {backgroundImage: `url(${iconUrl.value})`} : {};
});
/** Localized text plate (prelude / award / milestone / global requirements). */
const labelText = computed((): string | undefined => {
  const icon = mechIcon.value;
  return icon?.kind === 'label' ? translateText(icon.text) : undefined;
});
const labelAccentClass = computed((): string | undefined => {
  const icon = mechIcon.value;
  return icon?.kind === 'label' && icon.accent !== undefined ? `pcard-plate--${icon.accent}` : undefined;
});
/** Trade-discount light value token (the −N rides `insideText`). */
const isDiscountToken = computed((): boolean => {
  return mechIcon.value?.kind === 'token';
});
/** The CEO once-per-game action marker (ARROW_OPG). */
const isOpgMarker = computed((): boolean => {
  return mechIcon.value?.kind === 'opg';
});
/**
 * Sized text runs — the DSL's `.text('5', Size.LARGE)` (Tate / Faraday
 * counters), `Size.SMALL` clarifiers and `Size.TINY` fine print keep
 * their printed proportions instead of collapsing to one size.
 */
const textSizeClass = computed((): string | undefined => {
  switch (itemNode.value?.size) {
  case Size.LARGE: return 'pcard-mi__text--lg';
  case Size.SMALL: return 'pcard-mi__text--sm';
  case Size.TINY: return 'pcard-mi__text--xs';
  default: return undefined;
  }
});
/** Premium player-cube colour for the community marker. */
const cubeColor = computed((): Color | undefined => {
  return mechIcon.value?.kind === 'cube' ? mechIcon.value.color : undefined;
});
/** The Mars Nomads camp marker — the board's own NomadToken. */
const isNomadMarker = computed((): boolean => {
  return mechIcon.value?.kind === 'nomad';
});
const isVpCard = computed((): boolean => {
  return mechIcon.value?.kind === 'vpCard';
});
const vpCardTag = computed((): Tag | undefined => {
  return mechIcon.value?.kind === 'vpCard' ? mechIcon.value.tag : undefined;
});
const isPartyRequirement = computed((): boolean => {
  return mechIcon.value?.kind === 'partyRequirement';
});
/** «Your cube on a party's banner» (Septem Tribus:redux). */
const isBannerCube = computed((): boolean => {
  return mechIcon.value?.kind === 'bannerCube';
});
/** The party plate STRUCK (TR70 — the next card ignores its party requirement): the class's own diagonal, not the generic ×. */
const isPartyRequirementWaived = computed((): boolean => {
  return mechIcon.value?.kind === 'partyRequirement' && mechIcon.value.waived === true;
});
/** One named party's seal (TR62 Tharsis Alliance) — its emblem from the one table, never a text plate. */
const partySeal = computed((): Extract<MechIconSpec, {kind: 'partySeal'}> | undefined => {
  const icon = mechIcon.value;
  return icon?.kind === 'partySeal' ? icon : undefined;
});
const isResourceCard = computed((): boolean => {
  return mechIcon.value?.kind === 'resourceCard';
});
/** The holder carries the printed «?» — a KIND of resource (RX41), not its three cubes. */
const resourceCardWild = computed((): boolean => {
  const icon = mechIcon.value;
  return icon?.kind === 'resourceCard' && icon.wild === true;
});
const isMegacredits = computed((): boolean => {
  return itemNode.value?.type === CardRenderItemType.MEGACREDITS;
});
/** A RATING square with an authored inner text (RX42's «>») — printed inside, in the square's own light ink. */
const ratingInner = computed((): boolean => {
  const item = itemNode.value;
  return item !== undefined && item.type === CardRenderItemType.TR && item.innerText !== undefined && item.innerText !== '';
});
/** M€ (and explicit amountInside items) draw the value INSIDE the icon. */
const insideText = computed((): string | undefined => {
  const item = itemNode.value;
  if (item === undefined) {
    return undefined;
  }
  if (item.questionMark === true) {
    return '?';
  }
  // A RATING with an authored inner text (RX42 UNMI Veto prints «[TR >] : [TR struck]» — the «>» the scan
  // puts inside the first rating square): the DSL's `{text}` option on a TR item is the author saying «print this
  // INSIDE the icon»; before this branch the premium face dropped it and printed two identical squares.
  if (isMegacredits.value || item.amountInside === true || ratingInner.value) {
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
});
const repeats = computed((): number => {
  const item = itemNode.value;
  if (item === undefined) {
    return 1;
  }
  if (insideText.value !== undefined) {
    return 1;
  }
  return itemRepeats(item);
});
/*
 * Leading digit («3 [icon]») when the count doesn't repeat as icons.
 * LEGACY SEMANTICS (load-bearing): the digit shows ONLY on an explicit
 * `showDigit` (or the >5 compactness heuristic) and is ALWAYS the
 * ABSOLUTE value — negativity in the DSL rides explicit MINUS symbol
 * nodes, and `amount: -1` is the builder's «unspecified» default
 * (= one icon, no digit). Deriving a digit from a negative amount
 * plastered a bogus «−1» over every default icon.
 */
const digitText = computed((): string | undefined => {
  const item = itemNode.value;
  if (item === undefined || insideText.value !== undefined) {
    return undefined;
  }
  const showDigit = item.showDigit === true || Math.abs(item.amount) > 5;
  if (!showDigit) {
    return undefined;
  }
  return String(Math.abs(item.amount));
});
/** The corner mark this item wears — the ONE mapping (`premiumCardIcons.secondaryBubbleOf`). */
const bubble = computed((): SecondaryBubbleSpec | undefined => {
  return itemNode.value === undefined ? undefined : secondaryBubbleOf(itemNode.value);
});
/** The secondary-tag bubble — a tag through the ONE tag style, so a planet sphere seats like the rest. */
const bubbleStyle = computed((): Record<string, string> => {
  const bubbleNow = bubble.value;
  if (bubbleNow === undefined) {
    return {};
  }
  return bubbleNow.tag !== undefined ? tagIconStyle(bubbleNow.tag) : {backgroundImage: `url(${bubbleNow.url})`};
});
const bubbleUrl = computed((): string | undefined => {
  return bubble.value?.url;
});
const itemClasses = computed((): Record<string, boolean> => {
  const item = itemNode.value;
  return {
    'pcard-mi--mc': insideText.value !== undefined,
    'pcard-mi--any': item?.anyPlayer === true,
    // The party plate draws the one-play class's own stroke (`pprq--waived`), never the generic × over it too.
    'pcard-mi--cancelled': item?.cancelled === true && !isPartyRequirementWaived.value,
    'pcard-mi--bubbled': bubbleUrl.value !== undefined,
    'pcard-mi--superscript': item?.isSuperscript === true,
  };
});
const fallbackLabel = computed((): string => {
  return String(itemNode.value?.type ?? '?');
});

/* ── symbol rendering ───────────────────────────────────────────── */
const isArrowSymbol = computed((): boolean => {
  return symbolNode.value?.type === CardRenderSymbolType.ARROW;
});
const symbolGlyph = computed((): string => {
  switch (symbolNode.value?.type) {
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
});
const symbolClasses = computed((): Record<string, boolean> => {
  const s = symbolNode.value;
  return {
    'pcard-sym--arrow': isArrowSymbol.value,
    'pcard-sym--or': s?.type === CardRenderSymbolType.OR,
    'pcard-sym--asterix': s?.type === CardRenderSymbolType.ASTERIX,
    // A vertical space is a LINE BREAK inside a wrapping row (the legacy
    // renderer drew it as a block-level spacer): the authored break point
    // of a long formula — the Reds' payout under their draw-and-discard.
    'pcard-sym--vspace': s?.type === CardRenderSymbolType.VSPACE,
    'pcard-sym--cancelled': s?.cancelled === true,
  };
});

/* ── tile / effect (template-guarded by their v-else-if branches; the
      neutral fallbacks only satisfy the type checker) ──────────────── */
const tileSpec = computed((): TileIconSpec => {
  const node = tileNode.value;
  return node === undefined ? {base: ''} : tileIcon(node);
});
const effect = computed((): EffectParts => {
  const node = effectNode.value;
  return node === undefined ? {cause: [], delimiter: undefined, result: []} : effectParts(node);
});
/** The cause's authored lines (a VERTICAL SPACE is a structural break — see `partLines`). */
const causeLines = computed((): Array<Array<ItemType>> => {
  return partLines(effect.value.cause);
});
/** The result's authored lines. */
const resultLines = computed((): Array<Array<ItemType>> => {
  return partLines(effect.value.result);
});
const effectKind = computed((): 'effect' | 'action' => {
  const node = effectNode.value;
  return node === undefined ? 'effect' : effectKindOf(node);
});

/** The ▲ of a printed trade — the only node a fleet-dock face hangs its mark on (a function, not a computed: no effect per node). */
function isTradeNode(): boolean {
  return itemNode.value?.type === CardRenderItemType.TRADE;
}
function renderable(row: ReadonlyArray<ItemType>): Array<ItemType> {
  return renderableNodes(row);
}
</script>

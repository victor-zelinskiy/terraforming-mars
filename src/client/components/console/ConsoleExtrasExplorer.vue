<template>
  <div ref="root" class="con-exr" :class="{'con-exr--bot': viewedIsBot}">
    <template v-if="types.length > 0 && selected !== undefined">
      <transition :css="false" mode="out-in"
                  @enter="typeSwapEnter" @leave="typeSwapLeave"
                  @enter-cancelled="typeSwapCancelled" @leave-cancelled="typeSwapCancelled">
        <div class="con-exr__body" :key="selected.key">

          <!-- ── THE HERO: the selected type's identity + the summary the
               column cell cannot carry. The counter is the SUM OVER CARDS —
               the subtitle binds it to its holders, so it never reads as a
               freely spendable wallet. Fixed height: a type change morphs
               ink, never the frame. -->
          <header class="con-exr__hero" :data-exr-hero="selected.key">
            <i class="con-exr__hero-icon" :class="selected.iconClass" aria-hidden="true"></i>
            <div class="con-exr__hero-id">
              <span class="con-exr__hero-line">
                <span class="con-exr__hero-name">{{ typeTitle }}</span>
                <b class="con-exr__hero-total">{{ selected.total }}</b>
              </span>
              <span class="con-exr__hero-sub">{{ heroSubtitle }}</span>
            </div>
            <div class="con-exr__hero-chips">
              <!-- VP honesty: the LINEAR sum, the conditional sum named
                   apart, the hidden-score state said in one quiet chip. -->
              <span v-if="vpChip !== ''" class="con-exr__chip con-exr__chip--vp"
                    :class="{'con-exr__chip--zero': selected.vpFromResources === 0 && (selected.vpConditional ?? 0) === 0}">{{ vpChip }}</span>
              <span v-else-if="!viewedIsBot && selected.scoringCards > 0" class="con-exr__chip con-exr__chip--hidden">{{ $t('Score is hidden until the end of the game') }}</span>
              <span v-if="conditionalChip !== ''" class="con-exr__chip con-exr__chip--cond">{{ conditionalChip }}</span>
              <span v-if="selected.actionCards > 0" class="con-exr__chip">{{ actionChip }}</span>
              <span v-if="selected.payment !== undefined" class="con-exr__chip con-exr__chip--pay">{{ payChip }}</span>
              <span v-if="selected.protection !== undefined" class="con-exr__chip con-exr__chip--shield">{{ $t('protected') }}</span>
            </div>
          </header>

          <!-- ── THE GALLERY (human): every holder of this type — cards with
               0 resources INCLUDED (a holder is a fact; the quiet pose is
               ink, never absence). Strict pages, page derived from the
               cursor; each slot is the zoom viewer's physical origin. -->
          <div v-if="!viewedIsBot" class="con-exr__stage">
            <transition :css="false" mode="out-in"
                        @enter="pageSwapEnter" @leave="pageSwapLeave"
                        @enter-cancelled="typeSwapCancelled" @leave-cancelled="typeSwapCancelled">
              <div class="con-exr__page" :key="page">
                <div v-for="entry in pageEntries" :key="entry.card.name"
                     class="con-exr__slot"
                     :class="{
                       'con-exr__slot--focused': focusedName === entry.card.name && ui.zone === 'cards',
                       'con-exr__slot--zero': entry.card.amount === 0,
                     }"
                     :data-zoom-slot="entry.card.name"
                     :data-exr-card="entry.card.name"
                     @click.capture.stop="slotPressed(entry.index)">
                  <Card :card="entry.model" :key="entry.card.name" lightweight />
                  <!-- The per-card meta plate — UNDER the face (count + VP),
                       so nothing ever covers the name, cost or art. -->
                  <div class="con-exr__slot-meta">
                    <span class="con-exr__slot-count" :class="{'con-exr__slot-count--zero': entry.card.amount === 0}">
                      <i :class="selected.iconClass" aria-hidden="true"></i>×{{ entry.card.amount }}
                    </span>
                    <span v-if="slotVpText(entry.card) !== ''" class="con-exr__slot-vp"
                          :class="{
                            'con-exr__slot-vp--zero': entry.card.scoring !== undefined && entry.card.scoring.vpNow === 0,
                            'con-exr__slot-vp--cond': entry.card.scoring !== undefined && entry.card.scoring.kind === 'special',
                          }">{{ slotVpText(entry.card) }}</span>
                  </div>
                </div>
              </div>
            </transition>
            <!-- The pager — only when there are pages to turn; the cursor
                 crossing a page edge IS the turn (album grammar). -->
            <div v-if="pages > 1" class="con-exr__pager" aria-hidden="true">
              <i v-for="p in pages" :key="p" class="con-exr__pager-dot" :class="{'con-exr__pager-dot--on': p - 1 === page}"></i>
              <span class="con-exr__pager-num">{{ page + 1 }}/{{ pages }}</span>
            </div>
          </div>

          <!-- ── THE BOT FILL: the same semantic screen over the Automa's
               real pools — WHERE the stock sits (colony areas / the one
               floater pool). Only what the model actually supports. -->
          <div v-else class="con-exr__stage con-exr__stage--bot">
            <div class="con-exr__botpools">
              <div v-if="selected.holders.length === 0" class="con-exr__botpool">
                <span class="con-exr__botpool-name">{{ $t('Common pool') }}</span>
                <b class="con-exr__botpool-amount">{{ selected.total }}</b>
              </div>
              <div v-for="h in selected.holders" :key="h.name" class="con-exr__botpool">
                <span class="con-exr__botpool-name">{{ $t(h.name) }}</span>
                <b class="con-exr__botpool-amount">{{ h.amount }}</b>
              </div>
            </div>
            <!-- How each store spends is the bot's mechanics — told on «Экран бота» only (D16: the bot reads as a player). -->
          </div>

          <!-- ── THE FACT STRIP: the focused card's whole story in one fixed
               line — the printed rule, the current contribution, the honest
               «N more», and what else the stock is FOR. Fixed height: focus
               navigation never re-fits the gallery above it. -->
          <footer v-if="!viewedIsBot" class="con-exr__detail">
            <template v-if="focusedCard !== undefined">
              <span class="con-exr__detail-name">{{ $t(focusedCard.name) }}</span>
              <span class="con-exr__detail-count"><i :class="selected.iconClass" aria-hidden="true"></i>×{{ focusedCard.amount }}</span>
              <span v-if="focusedCard.scoring !== undefined && focusedCard.scoring.kind === 'per'" class="con-exr__detail-rule">
                <b>{{ focusedCard.scoring.per }}</b><i :class="selected.iconClass" aria-hidden="true"></i><span class="con-exr__detail-arrow">→</span><b>{{ focusedCard.scoring.each }}</b> {{ $t('VP') }}
              </span>
              <span v-else-if="focusedCard.scoring !== undefined" class="con-exr__detail-rule con-exr__detail-rule--special">{{ $t('Special scoring') }}</span>
              <span v-if="detailNowText !== ''" class="con-exr__detail-now"
                    :class="{'con-exr__detail-now--zero': focusedCard.scoring?.vpNow === 0}">{{ detailNowText }}</span>
              <span v-if="detailNextText !== ''" class="con-exr__detail-next">{{ detailNextText }}</span>
              <span v-if="detailOtherVpText !== ''" class="con-exr__detail-other">{{ detailOtherVpText }}</span>
              <span v-if="focusedCard.scoring === undefined && focusedCard.otherVp === undefined" class="con-exr__detail-none">{{ $t('No VP from these resources') }}</span>
              <span class="con-exr__detail-chips">
                <span v-if="focusedCard.hasAction" class="con-exr__chip con-exr__chip--mini">{{ $t('Action') }}</span>
                <span v-if="focusedCard.payRate !== undefined" class="con-exr__chip con-exr__chip--mini con-exr__chip--pay">1 = {{ focusedCard.payRate }} M€</span>
                <span v-if="focusedCard.isCorporation" class="con-exr__chip con-exr__chip--mini">{{ $t('Corporation') }}</span>
              </span>
            </template>
          </footer>
        </div>
      </transition>
    </template>

    <!-- ── THE EMPTY STATE: the seat has no resource holders at all — a
         full, honest room (never a bare frame), reached by A on the empty
         group or by a seat switch. B returns like everywhere else. -->
    <div v-else class="con-exr__void" data-insp-slide>
      <i class="con-exr__void-mark" aria-hidden="true">◇</i>
      <template v-if="viewedIsBot">
        <div class="con-exr__void-title">{{ $t('No stored resources yet') }}</div>
      </template>
      <template v-else>
        <div class="con-exr__void-title">{{ $t('No cards that can hold resources') }}</div>
        <div class="con-exr__void-body">{{ $t('Cards able to store resources will appear here once they are in play') }}</div>
      </template>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * THE EXTRAS EXPLORER — the «Доп. ресурсы» screen of the Information
 *       workspace. The TYPE NAVIGATION is the rail satellite (`.con-res-aux`,
 *       shell chrome — pixel-anchored, this component renders none of it);
 *       what lives here is the CONTENT of the selected type: the hero header
 *       (identity + honest summary), the card gallery (real premium faces,
 *       strict pages) and the focused-card fact strip. Read-only by the
 *       overlay's contract — nothing here submits anything.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

/**
 * THE EXTRAS EXPLORER (Information workspace, extras route) — presentation
 * + input over the PURE `extrasExplorerModel` builders. Reads only PUBLIC
 * models; never submits anything.
 *
 *  · The TYPE COLUMN is the rail satellite — shell chrome this component
 *    deliberately does NOT render. It owns the cursors (`extrasExplorerUi`)
 *    the satellite paints, so «who is focused» has one owner.
 *  · VP figures are the SERVER's own per-card rows
 *    (`victoryPointsBreakdown.detailsCards[].mechanics`) — per-card
 *    flooring is the engine's, never a client formula; a hidden score
 *    keeps the printed rule and withholds every number.
 *  · FULLSCREEN (X) goes through the ONE console zoom inspector
 *    (`openConsoleCardZoom` + `slotZoomOrigin`): the gallery slot is the
 *    physical origin, LB/RB in the viewer browses the same list via
 *    `onBrowse` (the page follows the cursor — it is derived), and B lands
 *    the card back in its slot.
 */
import {computed, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {gsap} from 'gsap';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {CardResource} from '@/common/CardResource';
import {getCard} from '@/client/cards/ClientCardManifest';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {useConsoleViewport} from '@/client/console/composables/useConsoleViewport';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {additionalResourceRoleGroups, resourceScoring} from '@/client/components/additionalResources/additionalResources';
import {cardResourceCSS} from '@/client/components/common/cardResources';
import {cardHasAction} from '@/client/components/actions/actionExtraction';
import {railMcBadges} from '@/client/console/railValueModel';
import {railProtections} from '@/client/console/railProtectionModel';
import {marsBotExtraGroups, marsBotExtrasContext} from '@/client/components/console/marsBotRailModel';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {infoModeState} from '@/client/console/infoModeState';
import {extrasExplorerUi, selectExtrasType} from '@/client/console/consoleExtrasExplorer';
import {
  buildBotExtrasTypes,
  buildExtrasTypes,
  ExtrasCardVm,
  ExtrasTypeVm,
  extrasNavigate,
  extrasPageCount,
  extrasPageOf,
} from '@/client/console/extrasExplorerModel';
import {consoleCardZoom, openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import Card from '@/client/components/card/CardFace.vue';

defineOptions({name: 'ConsoleExtrasExplorer'});
const props = defineProps({
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
});

const viewport = useConsoleViewport();
const root = useTemplateRef<HTMLElement>('root');
const ui = extrasExplorerUi;
/** The last selected type's INDEX — signs the type-swap direction. */
const lastTypeIndex = ref(0);
/** The last rendered page — signs the page-turn direction. */
const lastPage = ref(0);

const viewed = computed((): PublicPlayerModel => {
  const color = infoModeState.playerColor;
  return props.playerView.players.find((p) => p.color === color) ?? props.playerView.thisPlayer;
});
const isSelf = computed((): boolean => {
  return viewed.value.color === props.playerView.thisPlayer.color;
});
const viewedIsBot = computed((): boolean => {
  return viewed.value.isMarsBot === true && botAutoma.value !== undefined;
});
const botAutoma = computed((): MarsBotModel | undefined => {
  return props.playerView.game.automa;
});
const vpVisible = computed((): boolean => {
  return isSelf.value || viewedIsBot.value ||
    props.playerView.game.gameOptions.showOtherPlayersVP === true;
});
/** The canonical type list — the SAME derivation the satellite renders
 *  (first-appearance order, zero holders included), so the column and
 *  this screen can never disagree. */
const types = computed((): ReadonlyArray<ExtrasTypeVm> => {
  const automa = botAutoma.value;
  if (viewedIsBot.value && automa !== undefined) {
    return buildBotExtrasTypes(marsBotExtraGroups(automa, marsBotExtrasContext(props.playerView.game)));
  }
  return buildExtrasTypes({
    groups: additionalResourceRoleGroups(viewed.value.tableau),
    detailsCards: viewed.value.victoryPointsBreakdown.detailsCards,
    vpVisible: vpVisible.value,
    lookup: (name) => {
      const card = getCard(name as CardName);
      if (card === undefined) {
        return undefined;
      }
      let hasAction = false;
      try {
        hasAction = cardHasAction(name as CardName);
      } catch (err) {
        hasAction = false;
      }
      const scoring = resourceScoring(name as CardName);
      return {
        isCorporation: card.type === CardType.CORPORATION,
        hasAction,
        printedRule: scoring !== undefined ? scoring :
          (card.victoryPoints === 'special' && card.resourceType !== undefined ? 'special' : undefined),
      };
    },
    iconFor: (resource: CardResource) => `card-resource ${cardResourceCSS[resource]}`,
    protections: railProtections(viewed.value).cardResources,
    payments: railMcBadges(viewed.value).cardBound,
  });
});
const selected = computed((): ExtrasTypeVm | undefined => {
  return types.value.find((t) => t.key === ui.typeKey) ?? types.value[0];
});
const selectedIndex = computed((): number => {
  const key = selected.value?.key;
  return Math.max(0, types.value.findIndex((t) => t.key === key));
});
const perPage = computed((): number => {
  return viewport.isHandheld.value ? 3 : 4;
});
const page = computed((): number => {
  return Math.min(
    extrasPageOf(ui.cardCursor, perPage.value),
    pages.value - 1);
});
const pages = computed((): number => {
  return extrasPageCount(selected.value?.cards.length ?? 0, perPage.value);
});
/** The page's slots — each with its live tableau CardModel (the real
 *  premium face draws its own resource cubes). */
const pageEntries = computed((): Array<{card: ExtrasCardVm, model: CardModel, index: number}> => {
  const cards = selected.value?.cards ?? [];
  const start = page.value * perPage.value;
  return cards.slice(start, start + perPage.value).map((card, i) => ({
    card,
    model: liveCard(card.name),
    index: start + i,
  }));
});
const focusedCard = computed((): ExtrasCardVm | undefined => {
  return selected.value?.cards[ui.cardCursor] ?? selected.value?.cards[0];
});
const focusedName = computed((): string => {
  return focusedCard.value?.name ?? '';
});
/** The category title — PLURAL where the locale has one (a category
 *  names the family, not one unit); the bot's labels arrive plural. */
const typeTitle = computed((): string => {
  const label = selected.value?.label ?? '';
  const plural: Partial<Record<string, string>> = {
    'Animal': 'Animals', 'Microbe': 'Microbes', 'Floater': 'Floaters',
    'Asteroid': 'Asteroids', 'Seed': 'Seeds', 'Fighter': 'Fighters',
    'Mech': 'Mechs',
    // A mass noun in English — the plural is its own key (`ui.json`), never «Leverages».
    'Leverage': 'Leverage resources',
  };
  const title = translateText(plural[label] ?? label);
  // A type SPLIT by role (PL-030) names the role beside the resource: «Мехи · делегаты» / «Мехи · деньги».
  const caption = selected.value?.roleCaption;
  return caption === undefined ? title : `${title} · ${translateText(caption)}`;
});
const heroSubtitle = computed((): string => {
  const sel = selected.value;
  if (sel === undefined) {
    return '';
  }
  if (viewedIsBot.value) {
    if (sel.holders.length === 0) {
      return translateText('Common pool');
    }
    const notes = sel.botNotes ?? [];
    // A CORP-only store's holder is the corporation card, not a
    // shipping area — name it instead of claiming an area count.
    if (notes.length === 1 && notes[0] === 'corp') {
      return translateText(sel.holders[0].name);
    }
    // MIXED sources (Pluto science + a corp store): the type-agnostic
    // holder count — «Storage areas: 2» would misname the corp card.
    if (notes.includes('corp')) {
      return translateTextWithParams('Holders: ${0}', [String(sel.holders.length)]);
    }
    return translateTextWithParams('Storage areas: ${0}', [String(sel.holders.length)]);
  }
  return translateTextWithParams('Holders: ${0}', [String(sel.cards.length)]);
});
const vpChip = computed((): string => {
  const sel = selected.value;
  const vp = sel?.vpFromResources;
  if (sel === undefined || vp === undefined || sel.scoringCards === 0) {
    return '';
  }
  // All-conditional types speak through the conditional chip alone — a
  // «+0» beside a real conditional sum would read as a contradiction.
  if (vp === 0 && (sel.vpConditional ?? 0) !== 0) {
    return '';
  }
  return translateTextWithParams('VP from resources: ${0}', [vp > 0 ? `+${vp}` : String(vp)]);
});
const conditionalChip = computed((): string => {
  const vp = selected.value?.vpConditional;
  return vp !== undefined && vp !== 0 ?
    translateTextWithParams('Conditional: ${0}', [`+${vp}`]) : '';
});
const actionChip = computed((): string => {
  return translateTextWithParams('Actions: ${0}', [String(selected.value?.actionCards ?? 0)]);
});
const payChip = computed((): string => {
  const badge = selected.value?.payment;
  return badge !== undefined ?
    translateTextWithParams('Pays: 1 = ${0} M€', [badge.text]) : '';
});
const detailNowText = computed((): string => {
  const s = focusedCard.value?.scoring;
  if (s === undefined || s.vpNow === undefined) {
    return '';
  }
  return translateTextWithParams('Now: ${0} VP', [s.vpNow > 0 ? `+${s.vpNow}` : String(s.vpNow)]);
});
const detailNextText = computed((): string => {
  const s = focusedCard.value?.scoring;
  if (s === undefined || s.toNext === undefined) {
    return '';
  }
  return translateTextWithParams('${0} toward the next VP', [String(s.toNext)]);
});
const detailOtherVpText = computed((): string => {
  const other = focusedCard.value?.otherVp;
  if (other === undefined || other.vpNow === undefined) {
    return '';
  }
  return other.conditional ?
    translateTextWithParams('Card VP (not from resources): ${0}, conditional', [String(other.vpNow)]) :
    translateTextWithParams('Card VP (not from resources): ${0}', [String(other.vpNow)]);
});
/** The explorer's live command contract — ConsoleInfoMode republishes it. */
const barState = computed((): Array<ConsoleCommand> => {
  const cmds: Array<ConsoleCommand> = [
    {control: 'bumperL', control2: 'bumperR', label: 'Players', priority: 1},
  ];
  if (types.value.length > 0) {
    // The bot screen has only the type column; a human screen offers
    // «Выбрать» over the column and «Осмотреть» over the gallery.
    if (viewedIsBot.value || ui.zone === 'types') {
      cmds.push({control: 'confirm', label: 'Select'});
    } else if (focusedCard.value !== undefined) {
      cmds.push({control: 'secondary', label: 'Inspect'});
    }
  }
  cmds.push({control: 'back', label: 'To overview'});
  cmds.push({control: 'inspect', label: 'Close', priority: 0});
  return cmds;
});

function liveCard(name: string): CardModel {
  return viewed.value.tableau.find((c) => c.name === name) ?? ({name: name as CardName} as CardModel);
}
function normalizeSelection(): void {
  if (types.value.length === 0) {
    ui.typeKey = undefined;
    ui.typeCursor = 0;
    ui.cardCursor = 0;
    return;
  }
  const at = types.value.findIndex((t) => t.key === ui.typeKey);
  if (at === -1) {
    ui.typeKey = types.value[0].key;
    ui.typeCursor = 0;
    ui.cardCursor = 0;
  } else {
    ui.typeCursor = Math.min(ui.typeCursor, types.value.length - 1);
  }
  const count = selected.value?.cards.length ?? 0;
  if (ui.cardCursor >= count) {
    ui.cardCursor = Math.max(0, count - 1);
  }
}
function slotVpText(card: ExtrasCardVm): string {
  const s = card.scoring;
  if (s === undefined) {
    return '';
  }
  if (s.vpNow === undefined) {
    // Hidden score: the printed rule is public — state it, no values.
    return s.kind === 'per' ? `${s.per}→${s.each} ${translateText('VP')}` : translateText('Special scoring');
  }
  if (s.kind === 'special') {
    return `${s.vpNow > 0 ? '+' + s.vpNow : s.vpNow} ${translateText('VP')} · ${translateText('conditional')}`;
  }
  return `${s.vpNow > 0 ? '+' + s.vpNow : s.vpNow} ${translateText('VP')}`;
}
// ── input (forwarded by the shell while the extras route is up) ──────
function handleIntent(intent: GamepadIntent): void {
  if (intent.kind === 'nav') {
    onNav(intent.dir);
    return;
  }
  if (intent.kind !== 'press') {
    return;
  }
  const action = consoleActionOf(intent);
  if (action === 'primary') {
    onPrimary();
  } else if (action === 'inspect') {
    onInspect();
  }
}
function onNav(dir: 'up' | 'down' | 'left' | 'right'): void {
  const next = extrasNavigate(
    {zone: ui.zone, typeCursor: ui.typeCursor, cardCursor: ui.cardCursor},
    dir,
    types.value.length,
    viewedIsBot.value ? 0 : (selected.value?.cards.length ?? 0),
  );
  ui.zone = next.zone;
  ui.typeCursor = next.typeCursor;
  ui.cardCursor = next.cardCursor;
}
function onPrimary(): void {
  if (ui.zone === 'types') {
    const tile = types.value[ui.typeCursor];
    if (tile !== undefined && tile.key !== ui.typeKey) {
      lastTypeIndex.value = selectedIndex.value;
      selectExtrasType(tile.key, ui.typeCursor);
    }
    return;
  }
  // A in the gallery — the unadvertised alias of X (the one the thumb
  // expects); the bar keeps advertising the console-wide X grammar.
  onInspect();
}
/** The satellite cell press / the shell's aux-press route. */
function selectType(key: string, index: number): void {
  if (key === ui.typeKey) {
    ui.typeCursor = index;
    ui.zone = 'types';
    return;
  }
  lastTypeIndex.value = selectedIndex.value;
  selectExtrasType(key, index);
  ui.zone = 'types';
}
function slotPressed(index: number): void {
  ui.zone = 'cards';
  ui.cardCursor = index;
  onInspect();
}
function onInspect(): void {
  if (viewedIsBot.value || selected.value === undefined || selected.value.cards.length === 0) {
    return;
  }
  const cards = selected.value.cards.map((c) => liveCard(c.name));
  const idx = Math.min(ui.cardCursor, cards.length - 1);
  ui.zone = 'cards';
  openConsoleCardZoom(cards, idx, undefined, undefined, {
    contextLabel: 'Extra resources',
    origin: slotZoomOrigin(
      () => root.value as HTMLElement,
      (i) => selected.value?.cards[i]?.name ?? '',
      (i) => {
        // The viewer browses THIS list — the cursor (and the derived
        // page) follows, so B lands on the very card being read.
        ui.cardCursor = i;
      },
    ),
  });
}
// ── the content transitions ──────────────────────────────────────────
/** A type change slides the body from the direction of the newly
 *  selected cell (visual tether to the satellite column); a page turn
 *  is the horizontal cousin. Reduced motion / an open zoom snap —
 *  and an out-in `done` must be a MICROTASK, never synchronous. */
function snapSwap(el: Element, done: () => void): boolean {
  if (consoleReducedMotionActive() || consoleCardZoom.card !== undefined) {
    gsap.set(el, {clearProps: 'transform,opacity'});
    void Promise.resolve().then(done);
    return true;
  }
  return false;
}
function typeSwapEnter(el: Element, done: () => void): void {
  if (snapSwap(el, done)) {
    return;
  }
  const dir = selectedIndex.value >= lastTypeIndex.value ? 1 : -1;
  lastTypeIndex.value = selectedIndex.value;
  gsap.fromTo(el,
    {opacity: 0, y: dir * 12 * conUiScale()},
    {opacity: 1, y: 0, duration: motionMs(180) / 1000, ease: 'power2.out', clearProps: 'transform,opacity', onComplete: done});
}
function typeSwapLeave(el: Element, done: () => void): void {
  if (snapSwap(el, done)) {
    return;
  }
  const dir = selectedIndex.value >= lastTypeIndex.value ? 1 : -1;
  gsap.to(el, {opacity: 0, y: dir * -9 * conUiScale(), duration: motionMs(90) / 1000, ease: 'power1.in', onComplete: done});
}
function typeSwapCancelled(el: Element): void {
  gsap.killTweensOf(el);
  gsap.set(el, {clearProps: 'transform,opacity'});
}
function pageSwapEnter(el: Element, done: () => void): void {
  if (snapSwap(el, done)) {
    lastPage.value = page.value;
    return;
  }
  const dir = page.value >= lastPage.value ? 1 : -1;
  lastPage.value = page.value;
  gsap.fromTo(el,
    {opacity: 0, x: dir * 16 * conUiScale()},
    {opacity: 1, x: 0, duration: motionMs(170) / 1000, ease: 'power2.out', clearProps: 'transform,opacity', onComplete: done});
}
function pageSwapLeave(el: Element, done: () => void): void {
  if (snapSwap(el, done)) {
    return;
  }
  const dir = page.value >= lastPage.value ? 1 : -1;
  gsap.to(el, {opacity: 0, x: dir * -12 * conUiScale(), duration: motionMs(80) / 1000, ease: 'power1.in', onComplete: done});
}

watch(() => barState.value, (cmds: ReadonlyArray<ConsoleCommand>) => {
  extrasExplorerUi.barCommands = cmds;
}, {immediate: true, deep: true});
/** Keep the selection VALID against the live list: a seat switch keeps
 *  the type when the new participant has it (useful comparison
 *  context), else lands on the first available one — predictable,
 *  never dark. */
watch(() => types.value, () => {
  normalizeSelection();
}, {immediate: true});
watch(() => infoModeState.playerColor, (): void => {
  // The gallery list is a different player's — the card cursor restarts;
  // the type survives when it exists (normalizeSelection).
  ui.cardCursor = 0;
  ui.zone = 'types';
  normalizeSelection();
});

onMounted(() => {
  normalizeSelection();
  lastTypeIndex.value = selectedIndex.value;
});
onBeforeUnmount(() => {
  extrasExplorerUi.barCommands = undefined;
});
defineExpose({handleIntent, selectType});
</script>

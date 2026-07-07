<template>
  <div class="con-info" role="dialog" :aria-label="$t('Information')">
    <div class="con-info__backdrop" aria-hidden="true"></div>
    <div class="con-info__frame">

      <!-- ── Header: whose profile + switching hints ─────────────────── -->
      <header class="con-info__head">
        <div class="con-info__who">
          <GamepadGlyph control="bumperL" class="con-info__bumper" />
          <span :class="'con-status__dot player_bg_color_' + viewed.color"></span>
          <span class="con-info__name">{{ viewed.name }}</span>
          <span v-if="isSelf" class="con-info__chip con-info__chip--you">{{ $t('You') }}</span>
          <span v-if="isSelf && myTurn" class="con-info__chip con-info__chip--turn">{{ $t('Your turn') }}</span>
          <span v-if="isPassed" class="con-info__chip con-info__chip--passed">{{ $t('passed') }}</span>
          <GamepadGlyph control="bumperR" class="con-info__bumper" />
        </div>
        <div class="con-info__head-meta">
          <span v-if="corpName !== ''" class="con-info__corp">{{ $t(corpName) }}</span>
          <span v-else-if="viewedIsBot" class="con-info__corp con-info__corp--bot">{{ $t('Automa opponent') }} · {{ $t(botDifficultyLabel) }}</span>
          <span class="con-info__tr">{{ viewed.terraformRating }} {{ $t('TR') }}</span>
          <span v-if="vpVisible" class="con-info__vp">{{ vpTotal }} {{ $t('VP') }}</span>
          <span class="con-info__close-hint"><GamepadGlyph control="inspect" /><span>{{ $t('Close') }}</span></span>
        </div>
      </header>

      <!-- ── DASHBOARD (MarsBot participant) ─────────────────────────── -->
      <div v-if="infoModeState.detail === undefined && viewedIsBot && botAutoma !== undefined" class="con-info__scroll con-info__grid">
        <ConsoleMarsBotSections mode="dashboard" :bot="viewed" :automa="botAutoma" :ctx="botCardContext" />
        <!-- VP — the SAME block as a human participant (shared model + rule). -->
        <section class="con-info__block">
          <h3 class="con-info__block-title">{{ $t('Victory Points') }}
            <span v-if="vpVisible" class="con-info__hotkey"><GamepadGlyph control="confirm" /></span>
          </h3>
          <template v-if="vpVisible">
            <div class="con-info__vp-total">{{ vpTotal }}</div>
            <div class="con-info__stat-lines">
              <div v-for="s in vpScales" :key="s.key" class="con-info__stat-line">
                <span>{{ $t(s.label) }}</span><b>{{ s.total }}</b>
              </div>
            </div>
          </template>
          <div v-else class="con-info__hidden">{{ $t('Score is hidden until the end of the game') }}</div>
        </section>
      </div>

      <!-- ── DASHBOARD ───────────────────────────────────────────────── -->
      <div v-else-if="infoModeState.detail === undefined" class="con-info__scroll con-info__grid">
        <!-- Resources & production — the headline block. -->
        <section class="con-info__block con-info__block--resources">
          <h3 class="con-info__block-title">{{ $t('Resources') }}</h3>
          <div class="con-info__res-grid">
            <div v-for="row in resourceRows" :key="row.key" class="con-info__res">
              <i class="con-info__res-icon" :class="'resource_icon resource_icon--' + row.key" aria-hidden="true"></i>
              <span class="con-info__res-value">{{ row.value }}</span>
              <span class="con-res__prod" :class="{'con-res__prod--negative': row.production < 0}">
                {{ row.production >= 0 ? '+' + row.production : row.production }}
              </span>
            </div>
          </div>
          <div class="con-info__res-legend">{{ $t('Stock') }} · <span class="con-info__res-legend-prod">{{ $t('Production') }}</span></div>
        </section>

        <!-- Tags -->
        <section class="con-info__block">
          <h3 class="con-info__block-title">{{ $t('Tags') }}</h3>
          <div v-if="tagEntries.length > 0" class="con-info__tags">
            <tag-count v-for="t in tagEntries" :key="t.tag" :tag="t.tag" :count="t.count" size="big" type="secondary" />
          </div>
          <div v-else class="con-info__empty">{{ $t('No tags played yet') }}</div>
        </section>

        <!-- Extra card resources — compact summary + X detail. -->
        <section class="con-info__block">
          <h3 class="con-info__block-title">{{ $t('Extra resources') }}
            <span class="con-info__hotkey"><GamepadGlyph control="secondary" /></span>
          </h3>
          <div v-if="extraSummary.length > 0" class="con-info__extras">
            <span v-for="e in extraSummary" :key="e.key" class="con-info__extra">
              <i :class="e.iconClass" aria-hidden="true"></i>
              <span class="con-info__extra-count">{{ e.total }}</span>
            </span>
          </div>
          <div v-else class="con-info__empty">{{ $t('No resources on cards') }}</div>
        </section>

        <!-- Cards availability -->
        <section class="con-info__block">
          <h3 class="con-info__block-title">{{ $t('Cards') }}</h3>
          <div class="con-info__stat-lines">
            <div v-if="isSelf" class="con-info__stat-line"><span>{{ $t('Playable now') }}</span><b class="con-info__mint">{{ cardsPlayable }}</b></div>
            <div class="con-info__stat-line"><span>{{ $t('In hand') }}</span><b>{{ cardsTotal }}</b></div>
          </div>
          <div v-if="!isSelf" class="con-info__note">{{ $t('Hand contents are hidden') }}</div>
        </section>

        <!-- Actions availability + Y detail -->
        <section class="con-info__block">
          <h3 class="con-info__block-title">{{ $t('Actions') }}
            <span class="con-info__hotkey"><GamepadGlyph control="triggerL" /></span>
          </h3>
          <div class="con-info__stat-lines">
            <div class="con-info__stat-line"><span>{{ $t('Available now') }}</span><b class="con-info__mint">{{ actionsAvailable }}</b></div>
            <div class="con-info__stat-line"><span>{{ $t('Total') }}</span><b>{{ actionsTotal }}</b></div>
          </div>
        </section>

        <!-- Effects + RT detail -->
        <section class="con-info__block">
          <h3 class="con-info__block-title">{{ $t('Effects') }}
            <span class="con-info__hotkey"><GamepadGlyph control="triggerR" /></span>
          </h3>
          <div class="con-info__stat-lines">
            <div class="con-info__stat-line"><span>{{ $t('Active') }}</span><b class="con-info__mint">{{ effectsCount }}</b></div>
            <div v-if="discountCount > 0" class="con-info__stat-line"><span>{{ $t('Discounts') }}</span><b>{{ discountCount }}</b></div>
          </div>
        </section>

        <!-- VP + A detail (or the hidden-score panel) -->
        <section class="con-info__block">
          <h3 class="con-info__block-title">{{ $t('Victory Points') }}
            <span v-if="vpVisible" class="con-info__hotkey"><GamepadGlyph control="confirm" /></span>
          </h3>
          <template v-if="vpVisible">
            <div class="con-info__vp-total">{{ vpTotal }}</div>
            <div class="con-info__stat-lines">
              <div v-for="s in vpScales" :key="s.key" class="con-info__stat-line">
                <span>{{ $t(s.label) }}</span><b>{{ s.total }}</b>
              </div>
            </div>
          </template>
          <div v-else class="con-info__hidden">{{ $t('Score is hidden until the end of the game') }}</div>
        </section>
      </div>

      <!-- ── DETAILS ─────────────────────────────────────────────────── -->
      <div v-else class="con-info__detail">
        <div class="con-info__detail-head">
          <span class="con-info__detail-title">{{ $t(detailTitle) }}</span>
          <span class="con-info__detail-back"><GamepadGlyph control="back" /><span>{{ $t('To overview') }}</span></span>
        </div>

        <!-- MarsBot details: printed board / played pile / bonus piles -->
        <ConsoleMarsBotSections
          v-if="isBotDetail && botAutoma !== undefined"
          :mode="botDetailMode"
          :bot="viewed"
          :automa="botAutoma"
          :ctx="botCardContext" />

        <!-- Extra resources detail -->
        <div v-if="infoModeState.detail === 'extras'" class="con-info__scroll con-info__detail-scroll">
          <div v-if="extraGroups.length === 0" class="con-info__empty con-info__empty--big">{{ $t('No resources on cards') }}</div>
          <section v-for="g in extraGroups" :key="g.key" class="con-info__exgroup">
            <h4 class="con-info__exgroup-title">
              <i :class="g.iconClass" aria-hidden="true"></i>
              <span>{{ $t(g.label) }}</span>
              <b class="con-info__mint">{{ g.total }}</b>
            </h4>
            <!-- INFO PARITY (CTS-3.8): the holders are REAL premium card
                 renders (the live model already draws the resource cubes);
                 the count chip doubles the read at TV distance. -->
            <div class="con-info__excards">
              <div v-for="c in g.cards" :key="c.card.name" class="con-info__excard">
                <Card :card="c.card" :key="c.card.name" lightweight />
                <span class="con-info__excard-count">
                  <i :class="g.iconClass" aria-hidden="true"></i> ×{{ c.amount }}
                </span>
              </div>
            </div>
          </section>
        </div>

        <!-- Actions detail -->
        <div v-else-if="infoModeState.detail === 'actions'" class="con-info__scroll con-info__detail-scroll">
          <div v-if="actionRows.length === 0" class="con-info__empty con-info__empty--big">{{ $t('No action cards') }}</div>
          <div v-for="row in actionRows" :key="row.name" class="con-info__acrow" :class="{'con-info__acrow--ok': row.available}">
            <span class="con-info__acrow-state" aria-hidden="true">{{ row.available ? '✓' : '·' }}</span>
            <span class="con-info__acrow-name">{{ $t(row.name) }}</span>
            <span v-if="row.available" class="con-info__acrow-badge">{{ $t('Available now') }}</span>
            <span v-else-if="row.reason !== ''" class="con-info__acrow-reason">{{ row.reason }}</span>
          </div>
          <div v-if="!isSelf" class="con-info__note">{{ $t('Opponent state is read-only') }}</div>
        </div>

        <!-- Effects detail (reuses the desktop effect blocks — real graphics) -->
        <div v-else-if="infoModeState.detail === 'effects'" class="con-info__scroll con-info__detail-scroll">
          <div v-if="effectGroups.length === 0" class="con-info__empty con-info__empty--big">{{ $t('No passive effects') }}</div>
          <div class="con-info__effects">
            <EffectBlock v-for="g in effectGroups" :key="g.key" :group="g" :card="tableauCard(g.cardName)" />
          </div>
        </div>

        <!-- VP detail -->
        <div v-else-if="infoModeState.detail === 'vp'" class="con-info__scroll con-info__detail-scroll">
          <template v-if="vpVisible">
            <div class="con-info__vp-hero">{{ vpTotal }} <span>{{ $t('VP') }}</span></div>
            <section v-for="s in vpModel.scales" :key="s.key" class="con-info__vpscale">
              <h4 class="con-info__vpscale-title"><span>{{ $t(s.label) }}</span><b>{{ s.total }}</b></h4>
              <div class="con-info__vpsegs">
                <span v-for="seg in s.segments" :key="seg.key" class="con-info__vpseg" :class="'con-info__vpseg--' + seg.key">
                  {{ $t(seg.label) }}: <b>{{ seg.value }}</b>
                </span>
              </div>
            </section>
            <section v-for="g in vpModel.cardGroups" :key="g.kind" class="con-info__vpcards">
              <h4 class="con-info__vpscale-title"><span>{{ $t(g.label) }}</span><b>{{ g.total }}</b></h4>
              <div v-for="row in g.rows" :key="row.cardName" class="con-info__exrow">
                <span class="con-info__exrow-name">{{ $t(row.cardName) }}</span>
                <span class="con-info__exrow-count">{{ row.victoryPoint }}</span>
              </div>
            </section>
          </template>
          <div v-else class="con-info__hidden con-info__empty--big">{{ $t('Score is hidden until the end of the game') }}</div>
        </div>
      </div>

      <!-- ── Foot hints ──────────────────────────────────────────────── -->
      <footer class="con-info__foot" aria-hidden="true">
        <span class="con-info__foot-item"><GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" /><span>{{ $t('Players') }}</span></span>
        <template v-if="infoModeState.detail === undefined && viewedIsBot">
          <span class="con-info__foot-item"><GamepadGlyph control="secondary" /><span>{{ $t('MarsBot board') }}</span></span>
          <span class="con-info__foot-item"><GamepadGlyph control="triggerL" /><span>{{ $t('Played cards') }}</span></span>
          <span class="con-info__foot-item"><GamepadGlyph control="triggerR" /><span>{{ $t('Bonus cards') }}</span></span>
          <span class="con-info__foot-item" :class="{'con-info__foot-item--off': !vpVisible}"><GamepadGlyph control="confirm" /><span>{{ $t('VP overview') }}</span></span>
        </template>
        <template v-else-if="infoModeState.detail === undefined">
          <span class="con-info__foot-item"><GamepadGlyph control="secondary" /><span>{{ $t('Extra resources') }}</span></span>
          <span class="con-info__foot-item"><GamepadGlyph control="triggerL" /><span>{{ $t('Actions') }}</span></span>
          <span class="con-info__foot-item"><GamepadGlyph control="triggerR" /><span>{{ $t('Effects') }}</span></span>
          <span class="con-info__foot-item" :class="{'con-info__foot-item--off': !vpVisible}"><GamepadGlyph control="confirm" /><span>{{ $t('VP overview') }}</span></span>
        </template>
        <span v-else class="con-info__foot-item"><GamepadGlyph control="back" /><span>{{ $t('To overview') }}</span></span>
        <span class="con-info__foot-item"><GamepadGlyph control="inspect" /><span>{{ $t('Close') }}</span></span>
      </footer>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * LT INFORMATION MODE (feedback iteration 3 §2-§5) — the console-native
 * read-only player dashboard: "информация не скрыта — LT, посмотрел,
 * вернулся ровно туда же".
 *
 * All data comes from PUBLIC models (PublicPlayerModel + the client card
 * manifest) — the same sources the desktop chips/overlays read:
 *  - resources/production/tags: the player model fields;
 *  - extra card resources: tableau CardModel.resources + manifest
 *    resourceType (tableaus are public; opponent HANDS are never touched —
 *    only cardsInHandNbr, which the desktop shows too);
 *  - actions: availableBlueCardActionCount / playerActionSourceCount;
 *  - effects: the effects-overlay extraction (manifest-driven);
 *  - VP: victoryPointsBreakdown through the SAME pure model as the desktop
 *    VP overlay, gated by the SAME visibility rule (self OR
 *    gameOptions.showOtherPlayersVP) — hidden mode shows the safe panel.
 * Input (hotkeys, player switching, scrolling) is routed by ConsoleShell;
 * this component is pure presentation over infoModeState.
 */
import {defineComponent, PropType} from 'vue';
import {PlayerViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {getCard} from '@/client/cards/ClientCardManifest';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {playerActionSourceCount, cardHasAction} from '@/client/components/actions/actionExtraction';
import {playerEffects, playerEffectGroups, EffectGroup} from '@/client/components/effects/effectExtraction';
import {buildVictoryPointsModel, VictoryPointsModel} from '@/client/components/overview/victoryPointsModel';
import {findPerformActionCard, findPlayProjectCardAction} from '@/client/console/turnIntents';
import {infoModeState} from '@/client/console/infoModeState';
import {translateTextWithParams} from '@/client/directives/i18n';
import {MarsBotModel} from '@/common/models/MarsBotModel';
import {BonusCardContext} from '@/common/automa/BonusCardData';
import {DIFFICULTY_LABEL} from '@/client/components/marsbot/marsBotView';
import ConsoleMarsBotSections from '@/client/components/console/ConsoleMarsBotSections.vue';
import TagCount from '@/client/components/TagCount.vue';
import EffectBlock from '@/client/components/effects/EffectBlock.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import Card from '@/client/components/card/Card.vue';

const TAG_ORDER: ReadonlyArray<Tag> = [
  Tag.BUILDING, Tag.SPACE, Tag.SCIENCE, Tag.POWER, Tag.EARTH, Tag.JOVIAN,
  Tag.VENUS, Tag.PLANT, Tag.MICROBE, Tag.ANIMAL, Tag.CITY, Tag.MOON,
  Tag.MARS, Tag.WILD, Tag.EVENT, Tag.CLONE,
];

const DETAIL_TITLES: Record<string, string> = {
  extras: 'Extra resources',
  actions: 'Actions',
  effects: 'Effects',
  vp: 'Victory Points',
  botBoard: 'MarsBot board',
  botPlayed: 'Played cards',
  botBonus: 'Bonus cards',
};

export default defineComponent({
  name: 'ConsoleInfoMode',
  components: {'tag-count': TagCount, ConsoleMarsBotSections, EffectBlock, GamepadGlyph, Card},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    myTurn: {type: Boolean, default: false},
  },
  data() {
    return {infoModeState};
  },
  computed: {
    viewed(): PublicPlayerModel {
      const color = this.infoModeState.playerColor;
      return this.playerView.players.find((p) => p.color === color) ?? this.playerView.thisPlayer;
    },
    isSelf(): boolean {
      return this.viewed.color === this.playerView.thisPlayer.color;
    },
    /** The viewed participant is the MarsBot seat → bot-specific sections. */
    viewedIsBot(): boolean {
      return this.viewed.isMarsBot === true;
    },
    botAutoma(): MarsBotModel | undefined {
      return this.playerView.game.automa;
    },
    botDifficultyLabel(): string {
      const automa = this.botAutoma;
      return automa !== undefined ? DIFFICULTY_LABEL[automa.difficulty] : '';
    },
    /** The expansion context — resolves bonus-card faces for THIS game. */
    botCardContext(): BonusCardContext {
      const expansions = this.playerView.game.gameOptions.expansions;
      return {venus: expansions.venus === true, colonies: expansions.colonies === true};
    },
    isBotDetail(): boolean {
      const d = this.infoModeState.detail;
      return d === 'botBoard' || d === 'botPlayed' || d === 'botBonus';
    },
    botDetailMode(): 'botBoard' | 'botPlayed' | 'botBonus' {
      const d = this.infoModeState.detail;
      return d === 'botPlayed' || d === 'botBonus' ? d : 'botBoard';
    },
    isPassed(): boolean {
      return this.playerView.game.passedPlayers.includes(this.viewed.color);
    },
    corpName(): string {
      for (const c of this.viewed.tableau) {
        try {
          if (getCard(c.name)?.type === CardType.CORPORATION) {
            return c.name;
          }
        } catch (err) {
          // manifest gap — skip
        }
      }
      return '';
    },
    resourceRows(): Array<{key: string, value: number, production: number}> {
      const p = this.viewed;
      return [
        {key: 'megacredits', value: p.megacredits, production: p.megacreditProduction},
        {key: 'steel', value: p.steel, production: p.steelProduction},
        {key: 'titanium', value: p.titanium, production: p.titaniumProduction},
        {key: 'plants', value: p.plants, production: p.plantProduction},
        {key: 'energy', value: p.energy, production: p.energyProduction},
        {key: 'heat', value: p.heat, production: p.heatProduction},
      ];
    },
    tagEntries(): Array<{tag: Tag, count: number}> {
      const counts = this.viewed.tags;
      return TAG_ORDER.map((tag) => ({tag, count: counts[tag] ?? 0})).filter((e) => e.count > 0);
    },
    /** Extra card resources aggregated by type (public — tableaus only). */
    extraGroups(): Array<{key: string, label: string, iconClass: string, total: number, cards: Array<{card: CardModel, amount: number}>}> {
      const byType = new Map<string, {label: string, total: number, cards: Array<{card: CardModel, amount: number}>}>();
      for (const card of this.viewed.tableau) {
        const amount = card.resources ?? 0;
        if (amount <= 0) {
          continue;
        }
        let type: string | undefined;
        try {
          type = getCard(card.name)?.resourceType;
        } catch (err) {
          type = undefined;
        }
        if (type === undefined) {
          continue;
        }
        const entry = byType.get(type) ?? {label: type, total: 0, cards: []};
        entry.total += amount;
        // The LIVE CardModel (info parity, CTS-3.8): the real premium card
        // render carries the resource cubes itself — never a name-only row.
        entry.cards.push({card, amount});
        byType.set(type, entry);
      }
      return Array.from(byType.entries()).map(([key, e]) => ({
        key,
        label: e.label,
        iconClass: `con-info__exicon ${iconClassFor(key.toLowerCase().replace(/ /g, '-'))}`,
        total: e.total,
        cards: e.cards.sort((a, b) => b.amount - a.amount),
      })).sort((a, b) => b.total - a.total);
    },
    extraSummary(): Array<{key: string, iconClass: string, total: number}> {
      return this.extraGroups.map((g) => ({key: g.key, iconClass: g.iconClass, total: g.total}));
    },
    cardsPlayable(): number {
      if (!this.isSelf) {
        return 0;
      }
      const play = findPlayProjectCardAction(this.playerView.waitingFor);
      return (play?.input.cards ?? []).filter((c) => c.isDisabled !== true).length;
    },
    cardsTotal(): number {
      if (this.isSelf) {
        return this.playerView.cardsInHand.length + (this.playerView.thisPlayer.selfReplicatingRobotsCards ?? []).length;
      }
      // Opponent: the PUBLIC hand count only — contents stay hidden.
      return this.viewed.cardsInHandNbr;
    },
    actionsAvailable(): number {
      return this.viewed.availableBlueCardActionCount;
    },
    actionsTotal(): number {
      return playerActionSourceCount(this.viewed.tableau);
    },
    effectsCount(): number {
      return playerEffects(this.viewed.tableau).length;
    },
    discountCount(): number {
      return playerEffects(this.viewed.tableau).filter((e) => e.signature?.discount !== undefined).length;
    },
    effectGroups(): Array<EffectGroup> {
      return playerEffectGroups(this.viewed.tableau);
    },
    /** VP visibility: self always; opponents only when the game options allow. */
    vpVisible(): boolean {
      return this.isSelf || this.playerView.game.gameOptions.showOtherPlayersVP === true;
    },
    vpTotal(): number {
      return this.viewed.victoryPointsBreakdown.total;
    },
    vpModel(): VictoryPointsModel {
      const game = this.playerView.game;
      return buildVictoryPointsModel(this.viewed.victoryPointsBreakdown, {
        hasMoon: game.moon !== undefined,
        hasPathfinders: game.pathfinders !== undefined,
        hasEscapeVelocity: game.gameOptions.escapeVelocity !== undefined,
      });
    },
    vpScales(): Array<{key: string, label: string, total: number}> {
      return this.vpModel.scales.map((s) => ({key: s.key, label: s.label, total: s.total}));
    },
    /** Actions detail rows — availability is server truth for SELF only. */
    actionRows(): Array<{name: CardName, available: boolean, reason: string}> {
      const availableNames = this.isSelf ?
        new Set((findPerformActionCard(this.playerView.waitingFor)?.model.cards ?? []).map((c) => c.name)) :
        new Set<CardName>();
      return this.viewed.tableau
        .filter((c) => {
          try {
            return cardHasAction(c.name);
          } catch (err) {
            return false;
          }
        })
        .map((c) => {
          const reason = this.isSelf ? c.actionReasons?.[0] : undefined;
          return {
            name: c.name,
            available: availableNames.has(c.name),
            reason: reason !== undefined ?
              translateTextWithParams(reason.message, (reason.params ?? []).map(String)) : '',
          };
        });
    },
    detailTitle(): string {
      return DETAIL_TITLES[this.infoModeState.detail ?? ''] ?? '';
    },
  },
  methods: {
    tableauCard(name: CardName): CardModel | undefined {
      return this.viewed.tableau.find((c) => c.name === name);
    },
  },
});
</script>

<template>
  <!--
    THE EFFECTS EXPLORER («Информация › Эффекты») — the card-actions browse
    language re-hosted READ-ONLY: a dossier column (the focused effect's source
    card — the physical zoom slot and the descend FLIP thumb) + a 2-column grid
    of per-EFFECT tiles, and an in-explorer DETAIL layer (the effect dossier:
    hero card + printed rule + the «За партию» summary) that UNFOLDS out of the
    pressed tile (consoleEffectsFocusMotion — the action-focus phrase).

    Host-agnostic on purpose: everything derives from the `cards` prop (any
    seat's tableau — or, for a future host, any card set) + the optional
    `stats`; the ONE bottom bar carries every verb (barCommands published on
    the host's `EffectsExplorerUi`, returned verbatim by the host). The host
    provides the frame and the crumb — this surface draws NO kicker of its own
    (the stage name travels up through `effectsStagePath` /
    `forecastStageText`).

    TWO MODES, ONE CHASSIS. `mode="forecast"` is the composers' R3 «Эффекты»
    layer: the SAME tiles, dossier column, detail stage, motion, fit ladders
    and input — fed by the server's `EffectForecast` instead of the tableau.
    The facet strip cycles the eight forecast GROUPS instead of the four
    families, the «ПОРЯДОК» band appears when the queue order is honest, and
    every tile's meta line is the forecast FOR THIS PLAY (never a statistic).
    The dossier answers the five questions — WHAT / WHY / UNDER WHAT CONDITION
    / TO WHOM / WHEN — from the server's fact; nothing is derived here.
  -->
  <div ref="rootEl" class="con-efx" :class="{'con-efx--forecast': forecastMode}" role="region" :aria-label="$t('Effects')">
    <div class="con-efx__stagewrap">
      <div ref="browseEl" class="con-efx__browse" :class="{'con-efx__browse--parked': detailUp}">
        <!-- The facet is BROWSE chrome — it parks with the layer at the
             descent (a filter has no meaning over one open dossier). -->
        <div class="con-efx__filters">
          <div class="con-efx__fgroup">
            <span class="con-efx__fgroup-keys" aria-hidden="true">
              <GamepadGlyph control="triggerL" />
              <GamepadGlyph control="triggerR" />
            </span>
            <template v-if="forecastMode">
              <button v-for="chip in fmodel.chips" :key="chip.id" type="button"
                      class="con-efx__chip" :class="{'con-efx__chip--active': chip.active}"
                      @click="setSection(chip.id)">
                <span v-if="chip.glyph !== ''" class="con-efx__chip-glyph" :class="'con-efx__chip-glyph--' + chip.id" aria-hidden="true">{{ chip.glyph }}</span>
                <span v-i18n>{{ chip.label }}</span>
                <b>{{ chip.count }}</b>
              </button>
            </template>
            <template v-else>
              <button v-for="chip in model.familyChips" :key="chip.id" type="button"
                      class="con-efx__chip" :class="{'con-efx__chip--active': chip.active}"
                      @click="setFamily(chip.id)">
                <span v-i18n>{{ chip.label }}</span>
                <b>{{ chip.count }}</b>
              </button>
            </template>
          </div>
        </div>

        <!-- «ПОРЯДОК» — the queue order of the questions and the deferred
             payouts, ONLY when every one of them declares its priority (a
             guessed order is worse than none — the pure model decides). -->
        <div v-if="forecastMode && orderSteps.length > 0" class="con-efx__order" :aria-label="$t('Order')">
          <span class="con-efx__order-label" v-i18n>Order</span>
          <ol class="con-efx__order-steps">
            <li v-for="(step, i) in orderSteps" :key="step.key" class="con-efx__order-step" :class="'con-efx__order-step--' + step.kind">
              <b>{{ i + 1 }}</b>
              <span class="con-efx__order-text">{{ orderStepText(step) }}</span>
              <span v-if="i < orderSteps.length - 1" class="con-efx__order-arrow" aria-hidden="true">→</span>
            </li>
          </ol>
        </div>

        <div class="con-efx__body">
          <!-- The DOSSIER column — the browse twin of the detail stage's hero
               column: the thumb already stands where the hero lands, so the
               descend FLIP is a short settle. The zoom slot binds ONLY while
               browse owns the screen (the hero carries it at detail — two
               slots with one key would land the close flight in the parked
               thumb). -->
          <aside v-if="forecastMode ? focusedFTile !== undefined : focusedGroup !== undefined" ref="detailEl" class="con-efx__detail">
            <template v-if="forecastMode && focusedFTile !== undefined">
              <div class="con-efx__detail-name">{{ ftileTitle(focusedFTile) }}</div>
              <div v-if="ftileOwnerName(focusedFTile) !== ''" class="con-efx__detail-owner">
                <span class="con-efx__owner-dot" :class="'player_bg_color_' + ftileOwner(focusedFTile)" aria-hidden="true"></span>
                <span>{{ ftileOwnerName(focusedFTile) }}</span>
              </div>
              <div v-if="focusedFCardName !== ''" class="con-efx__detail-cardwrap"
                   data-effect-flow-thumb
                   :data-zoom-slot="detailUp ? undefined : focusedFCardName">
                <div :key="focusedFCardName" class="con-efx__detail-card">
                  <ConsoleCardFaceLite :name="focusedFCardName" :card="liveCardOf(focusedFCardName, ftileOwner(focusedFTile))" />
                </div>
              </div>
              <span class="con-efx__tile-fam" :class="'con-efx__tile-fam--fx-' + focusedFTile.group">
                <span aria-hidden="true">{{ focusedFTile.glyph }}</span> <span v-i18n>{{ focusedFTile.groupLabel }}</span>
              </span>
              <div class="con-efx__fq" data-forecast-questions>
                <div class="con-efx__fq-title" v-i18n>What will happen</div>
                <div v-for="q in ftileQuestions(focusedFTile)" :key="q.id" class="con-efx__fq-row" :class="'con-efx__fq-row--' + q.id">
                  <span class="con-efx__fq-label" v-i18n>{{ q.label }}</span>
                  <span class="con-efx__fq-value">
                    <span v-if="q.recipient !== undefined && q.recipient.kind !== 'you'" class="con-efx__owner-dot" :class="'player_bg_color_' + q.recipient.color" aria-hidden="true"></span>
                    <template v-if="q.chips !== undefined && q.chips.length > 0">
                      <ActionEffectChip v-for="(eff, k) in q.chips" :key="'q' + k" :effect="eff" :skipped="q.skipped === true" />
                    </template>
                    <template v-for="(alt, a) in (q.alternatives ?? [])" :key="'a' + a">
                      <span class="con-efx__fq-or" v-i18n>or</span>
                      <ActionEffectChip v-for="(eff, k) in alt.chips" :key="'alt' + a + k" :effect="eff" />
                      <span v-if="alt.chips.length === 0" class="con-efx__fq-text">{{ alt.label }}</span>
                    </template>
                    <span v-if="q.state !== undefined" class="con-efx__fq-state" :class="'con-efx__fq-state--' + q.state" v-i18n>{{ stateLabel(q.state) }}</span>
                    <span v-if="(q.text !== undefined && q.text !== '') || q.textTail !== undefined" class="con-efx__fq-text">{{ q.text }}<span v-if="q.textTail !== undefined" class="con-efx__fq-tail">{{ q.textTail }}<span v-if="q.tag !== undefined" class="resource-tag con-efx__fq-tag" :class="'tag-' + q.tag" aria-hidden="true"></span></span></span>
                    <span v-if="q.tag !== undefined && q.textTail === undefined" class="resource-tag con-efx__fq-tag" :class="'tag-' + q.tag" aria-hidden="true"></span>
                    <span v-if="q.note !== undefined" class="con-efx__fq-note">{{ q.note }}</span>
                  </span>
                </div>
              </div>
              <p v-if="ftileRule(focusedFTile) !== ''" class="con-efx__detail-rule" v-i18n v-strip-effect-prefix>{{ ftileRule(focusedFTile) }}</p>
              <div v-if="ftileStatLine(focusedFTile) !== ''" class="con-efx__detail-count">{{ ftileStatLine(focusedFTile) }}</div>
            </template>
            <template v-else-if="focusedGroup !== undefined">
              <div class="con-efx__detail-name" v-i18n>{{ focusedGroup.cardName }}</div>
              <div class="con-efx__detail-cardwrap"
                   data-effect-flow-thumb
                   :data-zoom-slot="detailUp ? undefined : focusedGroup.cardName">
                <div :key="focusedGroup.cardName" class="con-efx__detail-card">
                  <ConsoleCardFaceLite :name="focusedGroup.cardName" :card="liveCard(focusedGroup.cardName)" />
                </div>
              </div>
              <span v-if="focusedTile !== undefined"
                    class="con-efx__tile-fam" :class="'con-efx__tile-fam--' + focusedTile.family"
                    v-i18n>{{ focusedTile.familyLabel }}</span>
              <p v-if="focusedRule !== ''" class="con-efx__detail-rule" v-i18n v-strip-effect-prefix>{{ focusedRule }}</p>
              <div v-if="focusedOrdinal !== ''" class="con-efx__detail-count">{{ focusedOrdinal }}</div>
            </template>
          </aside>

          <ConsoleScrollArea ref="list" class="con-efx__list" content-class="con-efx__list-body">
            <!-- ═══ FORECAST MODE — the eight groups as sections, one tile per
                 fact / discount / payment value. ═══ -->
            <template v-if="forecastMode">
              <div v-if="fmodel.sections.length === 0" class="con-efx__empty">
                <div class="con-efx__empty-mark" aria-hidden="true">⌁</div>
                <div class="con-efx__empty-title" v-i18n>Nothing will trigger</div>
                <div v-if="ui.sectionFilter !== 'all' && fmodel.total > 0" class="con-efx__empty-filters" v-i18n>Hidden by the active filter</div>
              </div>
              <template v-for="sec in fmodel.sections" :key="sec.id">
                <div class="con-efx__fsection" :class="'con-efx__fsection--' + sec.id" :data-forecast-group="sec.id">
                  <span class="con-efx__fsection-glyph" aria-hidden="true">{{ sec.glyph }}</span>
                  <span class="con-efx__fsection-label" v-i18n>{{ sec.label }}</span>
                  <b class="con-efx__fsection-count">{{ sec.tiles.length }}</b>
                </div>
                <button v-for="tile in sec.tiles" :key="tile.key" type="button"
                        class="con-efx__tile con-efx__tile--fx"
                        :class="{
                          'con-efx__tile--focused': tile.key === ui.focusKey,
                          'con-efx__tile--descend': tile.key === descendKey,
                          ['con-efx__tile--fx-' + tile.group]: true,
                        }"
                        :data-effect-key="tile.key"
                        :data-forecast-item="tile.item.kind"
                        @click="onTilePressed(tile.key)">
                  <!-- The head: the SOURCE leads (the whole width is its —
                       a truncated name is the one thing a forecast tile may
                       never show), the owner plate follows for a foreign
                       seat; WHEN lives in the meta line / the dossier. -->
                  <span class="con-efx__tile-head">
                    <span class="con-efx__tile-src">{{ ftileTitle(tile) }}</span>
                    <span v-if="ftileOwnerName(tile) !== ''" class="con-efx__tile-owner">
                      <span class="con-efx__owner-dot" :class="'player_bg_color_' + ftileOwner(tile)" aria-hidden="true"></span>
                      <span>{{ ftileOwnerName(tile) }}</span>
                    </span>
                  </span>
                  <span class="con-efx__effbody">
                    <span class="con-efx__canvas">
                      <span v-if="ftileEffectNode(tile) !== undefined" class="con-efx__graphic card-container" v-i18n v-strip-effect-prefix>
                        <CardRenderEffectBoxComponent :effectData="ftileEffectNodeOf(tile)" />
                      </span>
                      <span v-else-if="ftileRenderRoot(tile) !== undefined" class="con-efx__graphic card-container" v-i18n v-strip-effect-prefix>
                        <CardRenderData :renderData="ftileRenderRootOf(tile)" />
                      </span>
                      <span v-else class="con-efx__graphic"><span class="con-efx__graphic-text">{{ ftileCanvasText(tile) }}</span></span>
                    </span>
                    <span v-if="ftileDesc(tile) !== ''" class="con-efx__desc-slot">
                      <span class="con-efx__desc" :class="'con-efx__desc--' + ftileDescTier(tile)" v-i18n v-strip-effect-prefix>{{ ftileDesc(tile) }}</span>
                    </span>
                  </span>
                  <span class="con-efx__tile-meta">
                    <!-- Keyed on the line's VALUES: a refreshed forecast that
                         moved a number re-mounts the line and its entrance is
                         the flick (the cell dossier's changed-value beat). -->
                    <span :key="ftileMetaKey(tile)" class="con-efx__meta-line con-efx__meta-line--fx" :class="'con-efx__meta-line--fx-' + tile.group">
                      <template v-if="tile.item.kind === 'fact'">
                        <span v-if="tile.item.fact.recipient.kind !== 'you'" class="con-efx__owner-dot" :class="'player_bg_color_' + tile.item.fact.recipient.color" aria-hidden="true"></span>
                        <ActionEffectChip v-for="(eff, k) in ftileMeta(tile).chips" :key="'m' + k" :effect="eff" :skipped="tile.item.fact.certainty === 'skipped'" />
                        <template v-if="ftileMeta(tile).alternative !== undefined">
                          <span class="con-efx__fq-or" v-i18n>or</span>
                          <ActionEffectChip v-for="(eff, k) in ftileMeta(tile).alternative!.chips" :key="'ma' + k" :effect="eff" />
                          <span v-if="ftileMeta(tile).alternative!.chips.length === 0" class="con-efx__meta-text">{{ textOf(ftileMeta(tile).alternative!.label) }}</span>
                        </template>
                        <span v-if="ftileMeta(tile).label !== undefined" class="con-efx__meta-text" v-i18n>{{ ftileMeta(tile).label }}</span>
                      </template>
                      <template v-else-if="tile.item.kind === 'discount'">
                        <span class="con-efx__meta-num">−{{ tile.item.amount }}</span>
                        <i class="resource_icon resource_icon--megacredits con-efx__meta-icon" aria-hidden="true"></i>
                        <span class="con-efx__meta-text">{{ discountTotal }}</span>
                      </template>
                      <template v-else-if="tile.item.kind === 'other-discount'">
                        <span class="con-efx__meta-num">−{{ tile.item.amount }}</span>
                        <i class="resource_icon resource_icon--megacredits con-efx__meta-icon" aria-hidden="true"></i>
                        <span class="con-efx__meta-text">{{ discountTotal }}</span>
                      </template>
                      <template v-else-if="tile.item.kind === 'payment'">
                        <span class="con-efx__meta-num">1</span>
                        <span class="con-efx__meta-icon" :class="iconClassFor(String(tile.item.value.resource))" aria-hidden="true"></span>
                        <span class="con-efx__meta-num">= {{ tile.item.value.value }}</span>
                        <i class="resource_icon resource_icon--megacredits con-efx__meta-icon" aria-hidden="true"></i>
                        <span class="con-efx__meta-text">{{ paymentAvailable(tile.item.value.count) }}</span>
                      </template>
                      <template v-else>
                        <span class="con-efx__meta-text" v-i18n>Nothing will trigger</span>
                      </template>
                    </span>
                  </span>
                </button>
              </template>
            </template>

            <!-- ═══ STATS MODE — the Information workspace's per-card groups. ═══ -->
            <template v-else>
              <div v-if="model.groups.length === 0" class="con-efx__empty">
                <div class="con-efx__empty-mark" aria-hidden="true">⌁</div>
                <div class="con-efx__empty-title" v-i18n>No passive effects</div>
                <div v-if="ui.familyFilter !== 'all' && model.total > 0" class="con-efx__empty-filters" v-i18n>Hidden by the active filter</div>
              </div>
              <template v-else>
                <section v-for="g in model.groups" :key="g.key"
                         class="con-efx__group"
                         :class="{
                           'con-efx__group--wide': g.wide && columns === 2,
                           'con-efx__group--live': groupIsLive(g),
                           'con-efx__group--disabled': g.isDisabled,
                         }">
                  <div class="con-efx__plate">
                    <span class="con-efx__plate-name" v-i18n>{{ g.cardName }}</span>
                    <span v-if="plateChip(g) !== undefined" class="con-efx__plate-chip">
                      <span class="con-efx__res-icon" :class="plateChip(g)?.icon" aria-hidden="true"></span>
                      <b>{{ plateChip(g)?.count }}</b>
                    </span>
                  </div>
                  <div class="con-efx__slots" :class="{'con-efx__slots--pair': g.wide && columns === 2}">
                    <button v-for="tile in g.tiles" :key="tile.key" type="button"
                            class="con-efx__tile"
                            :class="{
                              'con-efx__tile--focused': tile.key === ui.focusKey,
                              'con-efx__tile--descend': tile.key === descendKey,
                              ['con-efx__tile--fam-' + tile.family]: true,
                            }"
                            :data-effect-key="tile.key"
                            @click="onTilePressed(tile.key)">
                      <span class="con-efx__tile-head">
                        <span v-if="g.tiles.length > 1" class="con-efx__tile-variant">{{ tileOrdinal(tile) }}</span>
                        <span class="con-efx__tile-fam" :class="'con-efx__tile-fam--' + tile.family" v-i18n>{{ tile.familyLabel }}</span>
                      </span>
                      <span class="con-efx__effbody">
                        <span class="con-efx__canvas">
                          <span v-if="tile.entry.effectNode !== undefined" class="con-efx__graphic card-container" v-i18n v-strip-effect-prefix>
                            <CardRenderEffectBoxComponent :effectData="tile.entry.effectNode" />
                          </span>
                          <span v-else-if="tile.entry.renderRoot !== undefined" class="con-efx__graphic card-container" v-i18n v-strip-effect-prefix>
                            <CardRenderData :renderData="tile.entry.renderRoot" />
                          </span>
                          <span v-else class="con-efx__graphic"><span class="con-efx__graphic-text" v-i18n v-strip-effect-prefix>{{ tile.entry.text }}</span></span>
                        </span>
                        <span v-if="tileDesc(tile) !== ''" class="con-efx__desc-slot">
                          <span class="con-efx__desc" :class="'con-efx__desc--' + tileDescTier(tile)" v-i18n v-strip-effect-prefix>{{ tileDesc(tile) }}</span>
                        </span>
                      </span>
                      <span class="con-efx__tile-meta">
                        <span v-if="tile.meta.kind === 'stat'" class="con-efx__meta-line con-efx__meta-line--stat">
                          <span v-if="tile.meta.icon !== undefined" class="con-efx__meta-icon" :class="iconClassFor(tile.meta.icon)" aria-hidden="true"></span>
                          <span v-i18n>{{ tile.meta.label }}</span>
                          <b>{{ tile.meta.value }}</b>
                        </span>
                        <span v-else-if="tile.meta.kind === 'idle'" class="con-efx__meta-line con-efx__meta-line--idle">
                          <span v-i18n>{{ tile.meta.label }}</span>
                        </span>
                        <span v-else-if="tile.meta.kind === 'cardScoped'" class="con-efx__meta-line con-efx__meta-line--scoped">
                          <span v-i18n>{{ tile.meta.label }}</span>
                        </span>
                      </span>
                    </button>
                  </div>
                </section>
              </template>
            </template>
          </ConsoleScrollArea>
        </div>
      </div>

      <!-- The DETAIL layer — v-if inside a JS transition (the copied action
           focus phrase); the browse layer above PARKS (autoAlpha), never
           unmounts, so cursor/filter/scroll survive by construction. -->
      <transition :css="false"
                  @enter="effectsFocusEnterHook"
                  @leave="effectsFocusLeaveHook"
                  @enter-cancelled="effectsFocusEnterCancelledHook"
                  @leave-cancelled="effectsFocusLeaveCancelledHook">
        <div v-if="detailUp" ref="stageEl" key="stage" class="con-efx__stage">
          <div class="con-efx__hero" data-effect-focus-card :data-zoom-slot="detailCardName !== '' ? detailCardName : undefined">
            <div v-if="detailCardName !== ''" :key="detailCardName" class="con-efx__hero-card">
              <ConsoleCardFaceLite :name="detailCardName" :card="forecastMode ? liveCardOf(detailCardName, detailOwner) : liveCard(detailCardName)" />
            </div>
            <!-- A cardless source (a party policy, the cardless discount
                 remainder) keeps the hero column's geometry with its glyph. -->
            <div v-else class="con-efx__hero-rule" aria-hidden="true">{{ detailFTile?.glyph ?? '⚡' }}</div>
          </div>
          <div class="con-efx__surface" data-unfold-surface>
            <ConsoleScrollArea ref="stageScroll" class="con-efx__surface-scroll" content-class="con-efx__surface-body">
              <!-- FORECAST: «ЧТО ПРОИЗОЙДЁТ» comes FIRST — the whole reason
                   the player descended; the printed rule and the whole-game
                   statistic follow as secondary reading. -->
              <div v-if="forecastMode && detailFTile !== undefined" class="con-efx__fq con-efx__fq--stage" data-unfold-item data-forecast-questions>
                <div class="con-efx__fq-title">
                  <span v-i18n>What will happen</span>
                  <span v-if="detailFTile !== undefined" class="con-efx__tile-fam" :class="'con-efx__tile-fam--fx-' + detailFTile.group">
                    <span aria-hidden="true">{{ detailFTile.glyph }}</span> <span v-i18n>{{ detailFTile.groupLabel }}</span>
                  </span>
                </div>
                <div v-for="q in ftileQuestions(detailFTile)" :key="q.id" class="con-efx__fq-row" :class="'con-efx__fq-row--' + q.id">
                  <span class="con-efx__fq-label" v-i18n>{{ q.label }}</span>
                  <span class="con-efx__fq-value">
                    <span v-if="q.recipient !== undefined && q.recipient.kind !== 'you'" class="con-efx__owner-dot" :class="'player_bg_color_' + q.recipient.color" aria-hidden="true"></span>
                    <template v-if="q.chips !== undefined && q.chips.length > 0">
                      <ActionEffectChip v-for="(eff, k) in q.chips" :key="'q' + k" :effect="eff" :skipped="q.skipped === true" />
                    </template>
                    <template v-for="(alt, a) in (q.alternatives ?? [])" :key="'a' + a">
                      <span class="con-efx__fq-or" v-i18n>or</span>
                      <ActionEffectChip v-for="(eff, k) in alt.chips" :key="'alt' + a + k" :effect="eff" />
                      <span v-if="alt.chips.length === 0" class="con-efx__fq-text">{{ alt.label }}</span>
                    </template>
                    <span v-if="q.state !== undefined" class="con-efx__fq-state" :class="'con-efx__fq-state--' + q.state" v-i18n>{{ stateLabel(q.state) }}</span>
                    <span v-if="(q.text !== undefined && q.text !== '') || q.textTail !== undefined" class="con-efx__fq-text">{{ q.text }}<span v-if="q.textTail !== undefined" class="con-efx__fq-tail">{{ q.textTail }}<span v-if="q.tag !== undefined" class="resource-tag con-efx__fq-tag" :class="'tag-' + q.tag" aria-hidden="true"></span></span></span>
                    <span v-if="q.tag !== undefined && q.textTail === undefined" class="resource-tag con-efx__fq-tag" :class="'tag-' + q.tag" aria-hidden="true"></span>
                    <span v-if="q.note !== undefined" class="con-efx__fq-note">{{ q.note }}</span>
                  </span>
                </div>
              </div>
              <div v-if="!forecastMode || detailEntry !== undefined" class="con-efx__rule" data-unfold-item>
                <span class="con-efx__rule-label" v-i18n>Effect</span>
                <div class="con-efx__rule-canvas">
                  <div v-if="detailEffectNode !== undefined" class="con-efx__rule-graphic card-container" v-i18n v-strip-effect-prefix>
                    <CardRenderEffectBoxComponent :effectData="detailEffectNode" />
                  </div>
                  <div v-else-if="detailRenderRoot !== undefined" class="con-efx__rule-graphic card-container" v-i18n v-strip-effect-prefix>
                    <CardRenderData :renderData="detailRenderRoot" />
                  </div>
                  <div v-else class="con-efx__rule-graphic"><span class="con-efx__graphic-text" v-i18n v-strip-effect-prefix>{{ detailEntry?.text }}</span></div>
                </div>
                <p v-if="detailRule !== ''" class="con-efx__rule-text" v-i18n v-strip-effect-prefix>{{ detailRule }}</p>
              </div>
              <div v-if="!forecastMode || detailSummaryAvailable" class="con-efx__summary" :class="{'con-efx__summary--quiet': forecastMode}" data-unfold-item>
                <ConsoleEffectSummary :summary="detailSummary" />
              </div>
            </ConsoleScrollArea>
            <div v-if="flatKeys.length > 1" class="con-efx__stepper" data-unfold-item>
              <GamepadGlyph control="bumperL" />
              <b>{{ detailPos }}</b>&nbsp;/ {{ flatKeys.length }}
              <GamepadGlyph control="bumperR" />
            </div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {Message} from '@/common/logs/Message';
import {CardModel} from '@/common/models/CardModel';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import type {ICardRenderEffect, ICardRenderRoot} from '@/common/cards/render/Types';
import {EffectForecast, EffectForecastRecipient} from '@/common/models/EffectForecastModel';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {getCard} from '@/client/cards/ClientCardManifest';
import {EffectEntry, playerEffects} from '@/client/components/effects/effectExtraction';
import {EffectRules, effectRules} from '@/client/components/effects/effectDescription';
import {EffectSummaryViewModel, emptyEffectOverlayStat, getEffectSummary} from '@/client/components/effects/effectSummary';
import {perEffectStat} from '@/client/components/effects/effectChannels';
import {
  EffectFamily,
  EffectsBrowseModel,
  EffectsGroupVm,
  EffectsTileVm,
  buildEffectsBrowseModel,
  stepEffect,
} from '@/client/console/effectsExplorerModel';
import {
  CERTAINTY_LABEL,
  ForecastBranchInfo,
  ForecastBrowseModel,
  ForecastGroupId,
  ForecastMetaLine,
  ForecastOperation,
  ForecastTileVm,
  OrderStep,
  timingLabel,
  attributeItemToEffect,
  buildForecastBrowseModel,
  cycleForecastSection,
  factBeyondOwnEffect,
  forecastItemCard,
  forecastItemOwner,
  forecastMetaLine,
  forecastOrderBand,
} from '@/client/console/effectForecastModel';
import {EffectsExplorerUi, effectsExplorerUi} from '@/client/console/consoleEffectsExplorer';
import {actionDescTier, stepActionRows} from '@/client/console/consoleCardActions';
import {fitActionCanvases} from '@/client/console/consoleActionCanvasFit';
import {resolveDetailFit} from '@/client/console/consoleDetailFit';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {stripEffectPrefix} from '@/client/directives/stripEffectPrefix';
import {reasonParams} from '@/client/cards/tagLabel';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {
  armEffectsFocusOrigin,
  armEffectsInstantFold,
  armEffectsPress,
  armEffectsSlot,
  effectsFocusEnterHook,
  effectsFocusLeaveHook,
  effectsFocusEnterCancelledHook,
  effectsFocusLeaveCancelledHook,
  playEffectsDetailStep,
} from '@/client/console/consoleEffectsFocusMotion';
import {descendRectOf} from '@/client/console/surfaceMotion/workspaceDescend';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ConsoleEffectSummary from '@/client/components/console/ConsoleEffectSummary.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import CardRenderEffectBoxComponent from '@/client/components/card/CardRenderEffectBoxComponent.vue';
import CardRenderData from '@/client/components/card/CardRenderData.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

type ExplorerTile = EffectsTileVm<EffectEntry>;
type ScrollAreaRef = InstanceType<typeof ConsoleScrollArea> & {
  scrollByPx: (dy: number) => void,
  ensureVisible: (el: Element) => void,
  scrollToStart: () => void,
};

/** A seat the forecast may name — the public player model fits structurally. */
export type ForecastSeat = {
  color: Color | string,
  name: string,
  isMarsBot?: boolean,
  tableau: ReadonlyArray<CardModel>,
};

/** One answered question of the dossier's «ЧТО ПРОИЗОЙДЁТ» block. */
type ForecastQuestion = {
  id: 'what' | 'why' | 'condition' | 'whom' | 'when',
  /** English i18n key. */
  label: string,
  chips?: ReadonlyArray<ActionEffect>,
  skipped?: boolean,
  alternatives?: ReadonlyArray<{label: string, chips: ReadonlyArray<ActionEffect>}>,
  /** Already translated. */
  text?: string,
  /** The text's LAST WORD, split off so it can be bound to the tag icon in
   *  one unbreakable pair («…с меткой науки ⚛» — the icon never falls onto a
   *  line of its own). Present only when `tag` is. */
  textTail?: string,
  tag?: Tag,
  state?: 'met' | 'depends' | 'unmet',
  recipient?: EffectForecastRecipient,
  /** Already translated. */
  note?: string,
};

export default defineComponent({
  name: 'ConsoleEffectsExplorer',
  components: {ConsoleScrollArea, ConsoleCardFaceLite, ConsoleEffectSummary, ActionEffectChip, CardRenderEffectBoxComponent, CardRenderData, GamepadGlyph},
  directives: {stripEffectPrefix},
  props: {
    /** The inspected seat's tableau (or any future host's card set). In the
     *  forecast mode: the VIEWER's tableau (live resources of own sources). */
    cards: {type: Array as PropType<ReadonlyArray<CardModel>>, required: true},
    /** The seat identity — a change drops the detail layer instantly. */
    color: {type: String, required: true},
    /** The seat's effect stats (undefined = loading — metas claim nothing). */
    stats: {type: Array as PropType<ReadonlyArray<EffectOverlayStat>>, default: undefined},
    /**
     * `stats` — the Information workspace's whole-tableau explorer;
     * `forecast` — a composer's R3 «Эффекты» layer over the server's
     * `EffectForecast` (the same chassis, the eight groups as facets).
     */
    mode: {type: String as PropType<'stats' | 'forecast'>, default: 'stats'},
    /**
     * The transient cursors this instance reads and writes. The Information
     * workspace passes nothing (the module-level instance); a composer passes
     * its OWN (`forecastExplorerUi(host)`), so two explorers never share a
     * cursor.
     */
    explorerUi: {type: Object as PropType<EffectsExplorerUi>, default: () => effectsExplorerUi},
    /** Forecast mode: the server's forecast (rides inside the preview). */
    forecast: {type: Object as PropType<EffectForecast | undefined>, default: undefined},
    /** Forecast mode: every seat of the game — names, colours, live tableaux. */
    players: {type: Array as PropType<ReadonlyArray<ForecastSeat>>, default: () => []},
    /** Forecast mode: the composer's branches (position + title + availability). */
    branches: {type: Array as PropType<ReadonlyArray<ForecastBranchInfo>>, default: () => []},
    /** Forecast mode: the branch the composer has selected (live, no request). */
    selectedBranchPos: {type: Number, default: undefined},
    /** Forecast mode: per-seat effect stats (undefined per seat = loading). */
    statsByColor: {type: Object as PropType<Partial<Record<string, ReadonlyArray<EffectOverlayStat> | undefined>>>, default: () => ({})},
    /** Forecast mode: the play's own steps the «ПОРЯДОК» band interleaves. */
    orderFlags: {type: Object as PropType<{cardChoices: boolean, placesTile: boolean}>, default: () => ({cardChoices: false, placesTile: false})},
    /** Forecast mode: the OPERATION the forecast is about — the WHEN answer
     *  of an immediate reaction is «сразу после розыгрыша» for a card play
     *  and «сразу после выполнения» for a card action. */
    operation: {type: String as PropType<ForecastOperation>, default: 'play'},
  },
  data() {
    return {
      /** The one-shot CSS commit pulse on the pressed tile. */
      descendKey: '',
      lastFlatIndex: 0,
      fitFrame: undefined as number | undefined,
    };
  },
  computed: {
    ui(): EffectsExplorerUi {
      return this.explorerUi;
    },
    forecastMode(): boolean {
      return this.mode === 'forecast';
    },
    entries(): ReadonlyArray<EffectEntry> {
      return playerEffects(this.cards);
    },
    columns(): 1 | 2 {
      // The FORECAST layer stands in a composer's work column — half the
      // band, beside the dossier — so its tiles run ONE per row: the printed
      // canvas keeps its size and the caption + the meta chips keep their
      // reading measure (two abreast truncated both at 4K).
      return consoleLayoutState.profile === 'handheld' || this.forecastMode ? 1 : 2;
    },
    model(): EffectsBrowseModel<EffectEntry> {
      return buildEffectsBrowseModel({
        entries: this.entries,
        tableau: this.cards,
        stats: this.stats,
        familyFilter: this.ui.familyFilter,
        columns: this.columns,
      });
    },
    // ── forecast mode ─────────────────────────────────────────────────────
    fmodel(): ForecastBrowseModel {
      return buildForecastBrowseModel({
        forecast: this.forecastMode ? this.forecast : undefined,
        branches: this.branches,
        sectionFilter: this.ui.sectionFilter,
        columns: this.columns,
      });
    },
    /** The unfiltered model — the open dossier survives a facet change. */
    fmodelAll(): ForecastBrowseModel {
      return buildForecastBrowseModel({
        forecast: this.forecastMode ? this.forecast : undefined,
        branches: this.branches,
        sectionFilter: 'all',
        columns: this.columns,
      });
    },
    ftileByKey(): Map<string, ForecastTileVm> {
      const map = new Map<string, ForecastTileVm>();
      for (const s of this.fmodelAll.sections) {
        for (const t of s.tiles) {
          map.set(t.key, t);
        }
      }
      return map;
    },
    focusedFTile(): ForecastTileVm | undefined {
      return this.forecastMode ? this.ftileByKey.get(this.ui.focusKey) : undefined;
    },
    /** The focused forecast item's source card ('' for a cardless source). */
    focusedFCardName(): CardName {
      const tile = this.focusedFTile;
      return (tile === undefined ? undefined : this.ftileCard(tile)) ?? ('' as CardName);
    },
    detailFTile(): ForecastTileVm | undefined {
      const detail = this.ui.detail;
      return this.forecastMode && detail !== undefined ? this.ftileByKey.get(detail.effectKey) : undefined;
    },
    /** The printed effect entries of every source card the forecast names,
     *  read through the manifest — a foreign seat's card included. */
    forecastEntries(): Map<CardName, ReadonlyArray<EffectEntry>> {
      const map = new Map<CardName, ReadonlyArray<EffectEntry>>();
      if (!this.forecastMode) {
        return map;
      }
      for (const tile of this.ftileByKey.values()) {
        const name = forecastItemCard(tile.item);
        if (name === undefined || map.has(name)) {
          continue;
        }
        map.set(name, playerEffects([this.liveCardOf(name, this.ftileOwner(tile))]));
      }
      return map;
    },
    orderSteps(): ReadonlyArray<OrderStep> {
      return this.forecastMode ? forecastOrderBand(this.forecast, this.selectedBranchPos, this.orderFlags) : [];
    },
    /** «итого 10 → 8» — the discounts group's shared total line. */
    discountTotal(): string {
      const d = this.forecast?.discounts;
      if (d === undefined || d.final >= d.base) {
        return '';
      }
      return `${d.base} → ${d.final}`;
    },
    // ── mode-independent geometry ──────────────────────────────────────────
    flatKeys(): ReadonlyArray<string> {
      return this.forecastMode ? this.fmodel.flatKeys : this.model.flatKeys;
    },
    rows(): ReadonlyArray<ReadonlyArray<string>> {
      return this.forecastMode ? this.fmodel.rows : this.model.rows;
    },
    detailUp(): boolean {
      return this.ui.detail !== undefined;
    },
    tileByKey(): Map<string, ExplorerTile> {
      const map = new Map<string, ExplorerTile>();
      for (const g of this.model.groups) {
        for (const t of g.tiles) {
          map.set(t.key, t);
        }
      }
      return map;
    },
    focusedTile(): ExplorerTile | undefined {
      return this.forecastMode ? undefined : this.tileByKey.get(this.ui.focusKey);
    },
    focusedGroup(): EffectsGroupVm<EffectEntry> | undefined {
      return this.forecastMode ? undefined : this.model.groups.find((g) => g.tiles.some((t) => t.key === this.ui.focusKey));
    },
    focusedRule(): string {
      return this.fullRuleOf(this.focusedTile);
    },
    focusedOrdinal(): string {
      const g = this.focusedGroup;
      const t = this.focusedTile;
      if (g === undefined || t === undefined || g.tiles.length <= 1) {
        return '';
      }
      return `${translateText('Effect')} ${translateTextWithParams('${0} of ${1}', [String(t.entry.effectIndex + 1), String(g.tiles.length)])}`;
    },
    /** The open dossier's tile (survives a filter change — resolved over the
     *  UNFILTERED entry set so the stage never goes dark under the player). */
    detailTile(): ExplorerTile | undefined {
      const detail = this.ui.detail;
      if (detail === undefined || this.forecastMode) {
        return undefined;
      }
      const shown = this.tileByKey.get(detail.effectKey);
      if (shown !== undefined) {
        return shown;
      }
      const entry = this.entries.find((e) => e.key === detail.effectKey);
      if (entry === undefined) {
        return undefined;
      }
      const all = buildEffectsBrowseModel({entries: this.entries, tableau: this.cards, stats: this.stats, familyFilter: 'all', columns: this.columns});
      for (const g of all.groups) {
        for (const t of g.tiles) {
          if (t.key === detail.effectKey) {
            return t;
          }
        }
      }
      return undefined;
    },
    detailCardName(): CardName {
      return this.ui.detail?.cardName ?? ('' as CardName);
    },
    /** Forecast mode: the seat holding the open dossier's source. */
    detailOwner(): Color | undefined {
      const tile = this.detailFTile;
      return tile === undefined ? undefined : this.ftileOwner(tile);
    },
    /** The printed effect the open dossier stands on (stats: the tile's
     *  entry; forecast: the ATTRIBUTED one, or none). */
    detailEntry(): EffectEntry | undefined {
      if (this.forecastMode) {
        const tile = this.detailFTile;
        return tile === undefined ? undefined : this.ftileEntry(tile);
      }
      return this.detailTile?.entry;
    },
    detailEffectNode(): EffectEntry['effectNode'] {
      return this.detailEntry?.effectNode;
    },
    detailRenderRoot(): EffectEntry['renderRoot'] {
      return this.detailEntry?.renderRoot;
    },
    detailRule(): string {
      if (this.forecastMode) {
        const tile = this.detailFTile;
        return tile === undefined ? '' : this.ftileRule(tile);
      }
      return this.fullRuleOf(this.detailTile);
    },
    detailPos(): number {
      const i = this.flatKeys.indexOf(this.ui.detail?.effectKey ?? '');
      return i >= 0 ? i + 1 : 1;
    },
    /** Forecast mode: the «За партию» panel renders only for a source whose
     *  seat's stats have ARRIVED (a bot / rule source has none — no skeleton
     *  standing forever). */
    detailSummaryAvailable(): boolean {
      if (!this.forecastMode) {
        return true;
      }
      const tile = this.detailFTile;
      return tile !== undefined && this.detailEntry !== undefined && this.statsFor(this.ftileOwner(tile)) !== undefined;
    },
    detailSummary(): EffectSummaryViewModel | undefined {
      const entry = this.detailEntry;
      if (entry === undefined) {
        return undefined;
      }
      const owner = this.forecastMode ? this.detailOwner : undefined;
      const stats = this.forecastMode ? this.statsFor(owner) : this.stats;
      if (stats === undefined) {
        return undefined; // loading — the skeleton renders, never a fake zero
      }
      const cardEntries = this.forecastMode ?
        (this.forecastEntries.get(entry.cardName) ?? [entry]) :
        this.entries.filter((e) => e.cardName === entry.cardName);
      const cardStat = stats.find((s) => s.card === entry.cardName && (s.kind === 'corporation') === entry.isCorporation);
      const per = (!this.forecastMode ? this.detailTile?.per : undefined) ?? perEffectStat(entry, cardEntries, cardStat);
      const sourceKind = entry.isCorporation ? 'corporation' as const : 'card' as const;
      const resourceType = getCard(entry.cardName)?.resourceType;
      const live = this.forecastMode ? this.liveCardOf(entry.cardName, owner) : this.liveCard(entry.cardName);
      const base = {
        sourceName: entry.cardName,
        sourceKind,
        cardResourceType: resourceType,
        currentCardResource: resourceType !== undefined ? (live.resources ?? 0) : undefined,
        effectIndex: entry.effectIndex,
        signature: entry.signature,
      };
      const stat = per.stat ?? emptyEffectOverlayStat(entry.cardName, sourceKind);
      if (per.scope === 'effect') {
        // The channel split made this stat honestly THIS effect's — single-effect
        // semantics apply (real trigger count, no card-scoped caption).
        return getEffectSummary(stat, {...base, effectCount: 1, siblingIcons: []});
      }
      const siblingIcons = cardEntries.filter((e) => e.key !== entry.key).flatMap((e) => [...e.signature.icons]);
      return getEffectSummary(stat, {...base, effectCount: cardEntries.length, siblingIcons});
    },
    /** The explorer's live command contract — the host republishes it. */
    barState(): Array<ConsoleCommand> {
      if (this.forecastMode) {
        return this.forecastBarState();
      }
      const close: ConsoleCommand = {control: 'inspect', label: 'Close', priority: 0};
      if (this.detailUp) {
        const cmds: Array<ConsoleCommand> = [];
        if (this.model.flatKeys.length > 1) {
          cmds.push({control: 'bumperL', control2: 'bumperR', label: 'Other effects', priority: 1});
        }
        cmds.push({control: 'secondary', label: 'Inspect'});
        cmds.push({control: 'back', label: 'Back'});
        cmds.push(close);
        return cmds;
      }
      if (this.model.groups.length === 0) {
        const cmds: Array<ConsoleCommand> = [{control: 'bumperL', control2: 'bumperR', label: 'Players', priority: 1}];
        if (this.ui.familyFilter !== 'all' && this.model.total > 0) {
          cmds.push({control: 'stickR', label: 'Reset'});
        }
        cmds.push({control: 'back', label: 'To overview'});
        cmds.push(close);
        return cmds;
      }
      return [
        {control: 'bumperL', control2: 'bumperR', label: 'Players', priority: 1},
        {control: 'confirm', label: 'Open'},
        {control: 'secondary', label: 'Inspect'},
        {control: 'back', label: 'To overview'},
        close,
      ];
    },
  },
  watch: {
    'barState': {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>) {
        this.ui.barCommands = cmds;
      },
    },
    /** Keep the cursor on a valid, present tile (filter change / seat switch /
     *  update) — the nearest-survivor rule, never a jarring reset to first. */
    'flatKeys': {
      immediate: true,
      handler(keys: ReadonlyArray<string>) {
        if (keys.length === 0) {
          this.ui.focusKey = '';
          return;
        }
        const liveIndex = keys.indexOf(this.ui.focusKey);
        if (liveIndex >= 0) {
          this.lastFlatIndex = liveIndex;
          return;
        }
        const at = Math.min(this.lastFlatIndex, keys.length - 1);
        this.ui.focusKey = keys[at];
        this.lastFlatIndex = at;
      },
    },
    /** A seat switch drops the detail INSTANTLY — another seat almost never
     *  has the same effect, and a stranger's fold must not play. */
    color(): void {
      this.dropDetail();
    },
    /** Forecast mode: a refreshed forecast that no longer carries the open
     *  item drops the dossier (the browse layer updates in place). */
    detailFTile(tile: ForecastTileVm | undefined): void {
      if (this.forecastMode && this.detailUp && tile === undefined) {
        this.dropDetail();
      }
    },
    /** Re-fit the printed graphics whenever the grid recomposes. */
    model(): void {
      this.scheduleCanvasFit();
    },
    fmodel(): void {
      this.scheduleCanvasFit();
    },
  },
  mounted() {
    this.scheduleCanvasFit();
  },
  beforeUnmount() {
    this.ui.barCommands = undefined;
    if (this.fitFrame !== undefined && typeof cancelAnimationFrame === 'function') {
      cancelAnimationFrame(this.fitFrame);
    }
  },
  methods: {
    iconClassFor,
    // The browse ⇄ detail transition hooks (the copied action-focus phrase) —
    // exposed as methods so the template's <transition> can bind them.
    effectsFocusEnterHook,
    effectsFocusLeaveHook,
    effectsFocusEnterCancelledHook,
    effectsFocusLeaveCancelledHook,
    liveCard(name: CardName | string): CardModel {
      return this.cards.find((c) => c.name === name) ?? ({name: name as CardName} as CardModel);
    },
    /** Forecast mode: the live model of a card held by ANY seat — the owner's
     *  tableau first (foreign resources are public), the viewer's, else a
     *  bare name (the manifest draws the face; a bot's corp has no model). */
    liveCardOf(name: CardName | string | undefined, owner: Color | string | undefined): CardModel {
      if (name === undefined) {
        return {name: '' as CardName} as CardModel;
      }
      const seat = owner === undefined ? undefined : this.players.find((p) => p.color === owner);
      return seat?.tableau.find((c) => c.name === name) ?? this.liveCard(name);
    },
    textOf(v: string | Message | undefined, tag?: Tag): string {
      if (v === undefined) {
        return '';
      }
      if (typeof v !== 'string') {
        return translateMessage(v);
      }
      return tag !== undefined ? translateTextWithParams(v, reasonParams(undefined, tag)) : translateText(v);
    },
    statsFor(owner: Color | string | undefined): ReadonlyArray<EffectOverlayStat> | undefined {
      return owner === undefined ? undefined : this.statsByColor[owner];
    },
    /** The resolved rule record of one effect (info-group short + full). */
    rulesOf(tile: ExplorerTile | undefined): EffectRules | undefined {
      if (tile === undefined) {
        return undefined;
      }
      const entry = tile.entry;
      const count = this.entries.filter((e) => e.cardName === entry.cardName).length;
      return this.rulesOfEntry(entry, count);
    },
    rulesOfEntry(entry: EffectEntry, count: number): EffectRules | undefined {
      return effectRules({
        cardName: entry.cardName,
        effectIndex: entry.effectIndex,
        effectNode: entry.effectNode,
        description: entry.description,
        text: entry.text,
      }, count);
    },
    /** The FULL rule — the dossier's and the detail stage's reading. */
    fullRuleOf(tile: ExplorerTile | undefined): string {
      return this.rulesOf(tile)?.lines[0]?.text ?? tile?.entry.description ?? tile?.entry.text ?? '';
    },
    tileOrdinal(tile: ExplorerTile): string {
      return `${translateText('Effect')} ${tile.entry.effectIndex + 1}`;
    },
    tileDesc(tile: ExplorerTile): string {
      // The tile CAPTION: the card's curated short when the full rule is too
      // long for a calm one/two-line read, else the full sentence (never a
      // truncation — the effectDescription contract). Text-only overrides
      // already ARE the graphic — no duplicate caption.
      if (tile.entry.effectNode === undefined && tile.entry.renderRoot === undefined) {
        return '';
      }
      return this.rulesOf(tile)?.summary ?? tile.entry.description ?? '';
    },
    tileDescTier(tile: ExplorerTile): string {
      return actionDescTier(translateText(this.tileDesc(tile)).replace(/^(Effect|Действие|Эффект):\s*/i, ''));
    },
    plateChip(g: EffectsGroupVm<EffectEntry>): {icon: string, count: number} | undefined {
      const resourceType = getCard(g.cardName)?.resourceType;
      if (resourceType === undefined) {
        return undefined;
      }
      const live = this.liveCard(g.cardName);
      return {icon: iconClassFor(String(resourceType)), count: live.resources ?? 0};
    },
    groupIsLive(g: EffectsGroupVm<EffectEntry>): boolean {
      return g.tiles.some((t) => t.key === this.ui.focusKey);
    },
    setFamily(id: EffectFamily | 'all'): void {
      this.ui.familyFilter = id;
    },
    cycleFamily(dir: 1 | -1): void {
      const ids = this.model.familyChips.map((c) => c.id);
      if (ids.length <= 1) {
        return;
      }
      const at = ids.indexOf(this.ui.familyFilter);
      const next = (at + dir + ids.length) % ids.length;
      this.ui.familyFilter = ids[next];
    },
    // ── forecast mode helpers ──────────────────────────────────────────────
    setSection(id: ForecastGroupId | 'all'): void {
      this.ui.sectionFilter = id;
    },
    cycleSection(dir: 1 | -1): void {
      if (this.fmodel.groups.length === 0) {
        return;
      }
      this.ui.sectionFilter = cycleForecastSection(this.fmodel.groups, this.ui.sectionFilter, dir);
    },
    ftileCard(tile: ForecastTileVm): CardName | undefined {
      return forecastItemCard(tile.item);
    },
    ftileOwner(tile: ForecastTileVm): Color | undefined {
      return forecastItemOwner(tile.item, this.color as Color);
    },
    /** The owner's name — ONLY for a foreign source (own cards need no plate). */
    ftileOwnerName(tile: ForecastTileVm): string {
      const owner = this.ftileOwner(tile);
      if (owner === undefined || owner === this.color) {
        return '';
      }
      return displayNameForColor(this.players, owner);
    },
    ftileEntry(tile: ForecastTileVm): EffectEntry | undefined {
      const name = this.ftileCard(tile);
      if (name === undefined) {
        return undefined;
      }
      return attributeItemToEffect(tile.item, this.forecastEntries.get(name) ?? []);
    },
    ftileEffectNode(tile: ForecastTileVm): ICardRenderEffect | undefined {
      return this.ftileEntry(tile)?.effectNode;
    },
    /** The template's non-optional binding — called only behind the v-if. */
    ftileEffectNodeOf(tile: ForecastTileVm): ICardRenderEffect {
      return this.ftileEffectNode(tile) as ICardRenderEffect;
    },
    ftileRenderRoot(tile: ForecastTileVm): ICardRenderRoot | undefined {
      return this.ftileEntry(tile)?.renderRoot;
    },
    ftileRenderRootOf(tile: ForecastTileVm): ICardRenderRoot {
      return this.ftileRenderRoot(tile) as ICardRenderRoot;
    },
    /** The tile's TITLE — the source card (an i18n key), the rule's name, the
     *  cardless remainder, or the branch the empty row belongs to. */
    ftileTitle(tile: ForecastTileVm): string {
      const item = tile.item;
      switch (item.kind) {
      case 'fact':
        return translateText(item.fact.source.name);
      case 'other-discount':
        return translateText('Other discounts');
      case 'branch-empty':
        return this.branchTitle(item.branchPos);
      default: {
        const name = this.ftileCard(tile);
        return name === undefined ? translateText('Other discounts') : translateText(name);
      }
      }
    },
    branchTitle(pos: number): string {
      const branch = this.branches.find((b) => b.pos === pos);
      const title = branch === undefined ? '' : this.textOf(branch.title);
      return translateTextWithParams('If you choose «${0}»', [title]);
    },
    /** The canvas text when no printed block can be vouched for — the honest
     *  «an effect of this card» (never a guess at WHICH block). */
    ftileCanvasText(tile: ForecastTileVm): string {
      const item = tile.item;
      if (item.kind === 'fact' && item.fact.source.kind === 'rule') {
        return translateText(item.fact.source.name);
      }
      if (item.kind === 'other-discount') {
        return translateText('A discount with no card source');
      }
      if (item.kind === 'branch-empty') {
        return translateText('Nothing will trigger');
      }
      return translateText('Effect of this card');
    },
    ftileDesc(tile: ForecastTileVm): string {
      const entry = this.ftileEntry(tile);
      if (entry === undefined || (entry.effectNode === undefined && entry.renderRoot === undefined)) {
        return '';
      }
      const name = entry.cardName;
      const count = (this.forecastEntries.get(name) ?? []).length;
      return this.rulesOfEntry(entry, count)?.summary ?? entry.description ?? '';
    },
    ftileDescTier(tile: ForecastTileVm): string {
      return actionDescTier(translateText(this.ftileDesc(tile)).replace(/^(Effect|Действие|Эффект):\s*/i, ''));
    },
    /** The FULL printed rule of the attributed effect ('' when unattributed). */
    ftileRule(tile: ForecastTileVm): string {
      const entry = this.ftileEntry(tile);
      if (entry === undefined) {
        return '';
      }
      const count = (this.forecastEntries.get(entry.cardName) ?? []).length;
      return this.rulesOfEntry(entry, count)?.lines[0]?.text ?? entry.description ?? entry.text ?? '';
    },
    ftileMeta(tile: ForecastTileVm): ForecastMetaLine {
      return forecastMetaLine(tile.item, this.operation);
    },
    /** The WHY sentence with its last word split off, so the tag icon can
     *  ride that word in a `nowrap` pair (no tag → the whole sentence). The
     *  separating space stays at the END of `text`: a whitespace-only node
     *  between two template elements is condensed away by the compiler
     *  («с меткойнауки» shipped that way), while a space inside the
     *  interpolated text survives and is the one break opportunity before
     *  the unbreakable tail. */
    whyText(text: string, tag: Tag | undefined): {text: string, textTail?: string} {
      if (tag === undefined) {
        return {text};
      }
      const trimmed = text.trimEnd();
      const at = trimmed.lastIndexOf(' ');
      if (at <= 0) {
        return {text: '', textTail: trimmed};
      }
      return {text: trimmed.slice(0, at + 1), textTail: trimmed.slice(at + 1)};
    },
    /** The meta line's value signature — its re-mount key. */
    ftileMetaKey(tile: ForecastTileVm): string {
      const item = tile.item;
      if (item.kind !== 'fact') {
        return item.kind === 'discount' || item.kind === 'other-discount' ? `${item.kind}:${item.amount}` :
          (item.kind === 'payment' ? `payment:${item.value.value}:${item.value.count}` : item.kind);
      }
      const sig = (e: ActionEffect) => `${e.icon}${e.amount}${e.current ?? ''}${e.resulting ?? ''}`;
      const line = forecastMetaLine(item);
      return `${line.chips.map(sig).join(',')}|${(line.alternative?.chips ?? []).map(sig).join(',')}`;
    },
    /** «За партию: срабатывал N раз» — one quiet line, only once the owner's
     *  stats have arrived (a bot / rule source claims nothing). */
    ftileStatLine(tile: ForecastTileVm): string {
      const entry = this.ftileEntry(tile);
      const stats = this.statsFor(this.ftileOwner(tile));
      if (entry === undefined || stats === undefined) {
        return '';
      }
      const cardEntries = this.forecastEntries.get(entry.cardName) ?? [entry];
      const cardStat = stats.find((s) => s.card === entry.cardName && (s.kind === 'corporation') === entry.isCorporation);
      const per = perEffectStat(entry, cardEntries, cardStat);
      const count = per.stat?.triggerCount ?? 0;
      return count > 0 ? `${translateText('Times triggered')}: ${count}` : translateText('Not triggered yet');
    },
    paymentAvailable(count: number): string {
      return translateTextWithParams('${0} available in payment', [String(count)]);
    },
    stateLabel(state: 'met' | 'depends' | 'unmet'): string {
      switch (state) {
      case 'met': return 'Condition met';
      case 'depends': return 'Depends on your choice';
      default: return 'Condition not met';
      }
    },
    recipientText(recipient: EffectForecastRecipient): string {
      if (recipient.kind === 'you') {
        return translateText('You');
      }
      return displayNameForColor(this.players, recipient.color);
    },
    /** The dossier's five questions in their fixed order — every answer is
     *  the SERVER's (`reason`, `condition`, `recipient`, `timing`), only
     *  worded here. */
    ftileQuestions(tile: ForecastTileVm): Array<ForecastQuestion> {
      const item = tile.item;
      const out: Array<ForecastQuestion> = [];
      if (item.kind === 'fact') {
        const fact = item.fact;
        const what: ForecastQuestion = {id: 'what', label: 'What', chips: fact.effects, recipient: fact.recipient, skipped: fact.certainty === 'skipped'};
        if (fact.alternatives !== undefined && fact.alternatives.length > 0) {
          what.alternatives = fact.alternatives.map((a) => ({label: this.textOf(a.label), chips: a.effects}));
        }
        if (fact.effects.length === 0 && (fact.certainty === 'no' || fact.certainty === 'unknown')) {
          what.text = translateText(CERTAINTY_LABEL[fact.certainty]);
        }
        if (factBeyondOwnEffect(fact)) {
          what.note = translateText('Beyond the card\'s own effect');
        }
        if (fact.note !== undefined) {
          what.note = (what.note === undefined ? '' : what.note + ' · ') + this.textOf(fact.note);
        }
        out.push(what);
        out.push({id: 'why', label: 'Why', ...this.whyText(this.textOf(fact.reason, fact.reasonTag), fact.reasonTag), tag: fact.reasonTag});
        if (fact.condition !== undefined) {
          const cond: ForecastQuestion = {id: 'condition', label: 'Condition', state: fact.condition.state};
          if (fact.condition.state === 'depends' && fact.condition.branchPos !== undefined) {
            cond.text = this.branchTitle(fact.condition.branchPos);
            if (fact.condition.branchPos === this.selectedBranchPos) {
              cond.note = translateText('Selected');
            }
          } else if (this.textOf(fact.condition.text, fact.reasonTag) !== this.textOf(fact.reason, fact.reasonTag)) {
            cond.text = this.textOf(fact.condition.text, fact.reasonTag);
          }
          out.push(cond);
        }
        out.push({id: 'whom', label: 'To whom', text: this.recipientText(fact.recipient), recipient: fact.recipient});
        out.push({id: 'when', label: 'When', text: translateText(timingLabel(fact.timing, this.operation))});
        return out;
      }
      if (item.kind === 'discount' || item.kind === 'other-discount') {
        out.push({id: 'what', label: 'What', chips: [{direction: 'gain', icon: 'megacredits', amount: item.amount, note: 'discount'}]});
        out.push({id: 'why', label: 'Why', text: item.kind === 'discount' ?
          translateTextWithParams('${0} lowers the printed cost', [this.ftileTitle(tile)]) :
          translateText('A discount with no card source')});
        out.push({id: 'condition', label: 'Condition', text: this.discountTotal === '' ? '' : `${translateText('Cost')} ${this.discountTotal}`, state: 'met'});
        out.push({id: 'whom', label: 'To whom', text: translateText('You')});
        out.push({id: 'when', label: 'When', text: translateText('At payment')});
        return out;
      }
      if (item.kind === 'payment') {
        const v = item.value;
        out.push({id: 'what', label: 'What', chips: [{direction: 'gain', icon: String(v.resource).toLowerCase(), amount: 1, note: `= ${v.value} M€`}]});
        out.push({id: 'why', label: 'Why', text: translateTextWithParams('${0} lets you pay with this resource', [this.ftileTitle(tile)])});
        out.push({id: 'condition', label: 'Condition', text: this.paymentAvailable(v.count), state: v.count > 0 ? 'met' : 'unmet'});
        out.push({id: 'whom', label: 'To whom', text: translateText('You')});
        out.push({id: 'when', label: 'When', text: translateText('At payment')});
        return out;
      }
      out.push({id: 'what', label: 'What', text: translateText('Nothing will trigger')});
      out.push({id: 'condition', label: 'Condition', text: this.branchTitle(item.branchPos), state: 'depends',
        note: item.branchPos === this.selectedBranchPos ? translateText('Selected') : undefined});
      return out;
    },
    orderStepText(step: OrderStep): string {
      switch (step.kind) {
      case 'card-choice':
        return translateText('The card\'s own choice');
      case 'cell':
        return translateText('The cell for the tile');
      default: {
        const fact = step.fact;
        const source = translateText(fact.source.name);
        if (fact.certainty === 'asks') {
          return `${source} — ${translateText('asks')}`;
        }
        const chip = fact.effects[0];
        if (chip === undefined) {
          return source;
        }
        const sign = chip.direction === 'cost' ? '−' : '+';
        return `${source} ${sign}${chip.amount} ${translateText(iconWord(chip.icon))}`;
      }
      }
    },
    forecastBarState(): Array<ConsoleCommand> {
      const close: ConsoleCommand = {control: 'stickR', label: 'Close', priority: 0};
      if (this.detailUp) {
        const cmds: Array<ConsoleCommand> = [];
        if (this.flatKeys.length > 1) {
          cmds.push({control: 'bumperL', control2: 'bumperR', label: 'Other effects', priority: 1});
        }
        if (this.detailCardName !== '') {
          cmds.push({control: 'secondary', label: 'Inspect'});
        }
        cmds.push({control: 'back', label: 'Back'});
        cmds.push(close);
        return cmds;
      }
      const cmds: Array<ConsoleCommand> = [];
      if (this.fmodel.chips.length > 2) {
        cmds.push({control: 'triggerL', control2: 'triggerR', label: 'Sections', priority: 1});
      }
      if (this.focusedFTile !== undefined) {
        cmds.push({control: 'confirm', label: 'Open'});
        if (this.ftileCard(this.focusedFTile) !== undefined) {
          cmds.push({control: 'secondary', label: 'Inspect'});
        }
      }
      cmds.push({control: 'back', label: 'Back'});
      cmds.push(close);
      return cmds;
    },
    // ── geometry ───────────────────────────────────────────────────────────
    tileEl(key: string): HTMLElement | null {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (root === undefined || key === '') {
        return null;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(key) : key.replace(/"/g, '\\"');
      return root.querySelector<HTMLElement>(`[data-effect-key="${esc}"]`);
    },
    scrollFocusedIntoView(): void {
      const list = this.$refs.list as ScrollAreaRef | undefined;
      const el = this.tileEl(this.ui.focusKey);
      if (list === undefined || el === null) {
        return;
      }
      if (this.lastFlatIndex === 0) {
        list.scrollToStart();
      } else {
        list.ensureVisible(el);
      }
    },
    scheduleCanvasFit(): void {
      if (typeof window === 'undefined' || typeof requestAnimationFrame !== 'function') {
        return;
      }
      if (this.fitFrame !== undefined) {
        cancelAnimationFrame(this.fitFrame);
      }
      this.fitFrame = requestAnimationFrame(() => {
        this.fitFrame = undefined;
        fitActionCanvases(this.$refs.rootEl as HTMLElement | undefined, {
          graphicSelector: '.con-efx__graphic',
          canvasClass: 'con-efx__canvas',
          varName: '--efx-fit',
        });
        // The dossier column composes rather than scrolls (no reachable
        // scroll context there) — the measured ladder steps it down only as
        // far as a real overflow demands.
        const detail = this.$refs.detailEl as HTMLElement | undefined;
        if (detail !== undefined) {
          resolveDetailFit(detail, detail, (level) => detail.setAttribute('data-fit', String(level)));
        }
      });
    },
    // ── input (forwarded by the host while the explorer is up) ─────────────
    handleIntent(intent: GamepadIntent): void {
      if (intent.kind === 'scroll') {
        const target = this.detailUp ?
          (this.$refs.stageScroll as ScrollAreaRef | undefined) :
          (this.$refs.list as ScrollAreaRef | undefined);
        target?.scrollByPx(intent.dy * 22 * conUiScale());
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      // R3 is «reset the facet» in the Information workspace only — inside a
      // composer's layer it is the host's own close verb, handled above us.
      const action = consoleActionOf(intent, this.forecastMode ? undefined : {stickR: 'reset'});
      if (this.detailUp) {
        if (action === 'prevSection' || action === 'nextSection') {
          this.stepDetail(action === 'prevSection' ? -1 : 1);
        } else if (action === 'inspect') {
          this.inspectDetail();
        }
        return;
      }
      switch (action) {
      case 'primary': this.descendFocused(); break;
      case 'inspect': this.inspectFocused(); break;
      case 'prevTab': this.forecastMode ? this.cycleSection(-1) : this.cycleFamily(-1); break;
      case 'nextTab': this.forecastMode ? this.cycleSection(1) : this.cycleFamily(1); break;
      case 'reset': if (!this.forecastMode) {
        this.setFamily('all');
      } break;
      default: break;
      }
    },
    onNav(dir: 'up' | 'down' | 'left' | 'right'): void {
      if (this.detailUp) {
        // The dossier's own reading scroll (its list cursor lives in browse).
        const stage = this.$refs.stageScroll as ScrollAreaRef | undefined;
        if (dir === 'up' || dir === 'down') {
          stage?.scrollByPx((dir === 'down' ? 1 : -1) * 90 * conUiScale());
        }
        return;
      }
      if (this.rows.length === 0) {
        return;
      }
      const next = stepActionRows(this.rows, this.ui.focusKey, dir);
      if (next !== this.ui.focusKey) {
        this.ui.focusKey = next;
        this.$nextTick(() => this.scrollFocusedIntoView());
      }
    },
    onTilePressed(key: string): void {
      this.ui.focusKey = key;
      this.descendFocused();
    },
    /** The identity the detail layer opens on for the focused tile. */
    detailIdentityOf(key: string): {cardName: CardName, effectKey: string} | undefined {
      if (this.forecastMode) {
        const tile = this.ftileByKey.get(key);
        return tile === undefined ? undefined : {cardName: this.ftileCard(tile) ?? ('' as CardName), effectKey: key};
      }
      const tile = this.tileByKey.get(key);
      return tile === undefined ? undefined : {cardName: tile.entry.cardName, effectKey: key};
    },
    /** A on a tile — the WORKSPACE DESCEND into the effect dossier. Arming is
     *  SYNCHRONOUS in the press handler (armed rects expire in 1 s). */
    descendFocused(): void {
      const identity = this.detailIdentityOf(this.ui.focusKey);
      if (identity === undefined || this.detailUp) {
        return;
      }
      const slotEl = this.tileEl(identity.effectKey);
      const slotRect = descendRectOf(slotEl);
      if (slotRect !== undefined) {
        armEffectsSlot(slotRect);
        armEffectsPress({x: slotRect.left + slotRect.width / 2, y: slotRect.top + slotRect.height / 2});
      }
      const root = this.$refs.rootEl as HTMLElement | undefined;
      armEffectsFocusOrigin(descendRectOf(root?.querySelector<HTMLElement>('[data-effect-flow-thumb]')));
      this.descendKey = identity.effectKey;
      this.ui.detail = identity;
    },
    /** B at detail — fold back one level (the host asks before its own back). */
    consumeEffectsBack(): boolean {
      if (!this.detailUp) {
        return false;
      }
      this.descendKey = '';
      this.ui.detail = undefined;
      return true;
    },
    /** Seat switch / reset — the stage drops with NO fold (instant). */
    dropDetail(): void {
      if (!this.detailUp) {
        return;
      }
      armEffectsInstantFold();
      this.descendKey = '';
      this.ui.detail = undefined;
    },
    /** Detail LB/RB — the sibling effect, patched IN the standing stage. */
    stepDetail(dir: 1 | -1): void {
      const current = this.ui.detail;
      if (current === undefined) {
        return;
      }
      const next = stepEffect(this.flatKeys, current.effectKey, dir);
      if (next === current.effectKey) {
        return;
      }
      const identity = this.detailIdentityOf(next);
      if (identity === undefined) {
        return;
      }
      // The browse cursor follows UNDER the parked layer, and the fold's
      // destination re-arms to the stepped tile (autoAlpha keeps layout, so
      // the rect is live) — B after stepping folds into the RIGHT slot.
      this.ui.focusKey = next;
      this.lastFlatIndex = Math.max(0, this.flatKeys.indexOf(next));
      const slotRect = descendRectOf(this.tileEl(next));
      if (slotRect !== undefined) {
        armEffectsSlot(slotRect);
      }
      this.ui.detail = identity;
      playEffectsDetailStep(this.$refs.stageEl as HTMLElement | undefined, dir);
    },
    /** X at browse — the source card fullscreen, browsing across GROUPS. */
    inspectFocused(): void {
      if (this.forecastMode) {
        this.inspectForecastFocused();
        return;
      }
      const groups = this.model.groups;
      const at = groups.findIndex((g) => g.tiles.some((t) => t.key === this.ui.focusKey));
      if (groups.length === 0 || at === -1) {
        return;
      }
      openConsoleCardZoom(groups.map((g) => this.liveCard(g.cardName)), at, undefined, undefined, {
        contextLabel: 'Effects',
        origin: slotZoomOrigin(
          () => this.$refs.rootEl as HTMLElement,
          (i) => groups[i]?.cardName ?? '',
          (i) => {
            const g = groups[i];
            if (g !== undefined) {
              this.ui.focusKey = g.tiles[0].key;
              this.$nextTick(() => this.scrollFocusedIntoView());
            }
          },
        ),
      });
    },
    /** Forecast browse X — the DISTINCT source cards of the visible order, the
     *  focused one first under the cursor; stepping in the viewer moves the
     *  browse cursor onto that card's first tile. */
    inspectForecastFocused(): void {
      const cards: Array<{name: CardName, owner: Color | undefined, firstKey: string}> = [];
      for (const key of this.flatKeys) {
        const tile = this.ftileByKey.get(key);
        const name = tile === undefined ? undefined : this.ftileCard(tile);
        if (tile === undefined || name === undefined || cards.some((c) => c.name === name)) {
          continue;
        }
        cards.push({name, owner: this.ftileOwner(tile), firstKey: key});
      }
      const focused = this.focusedFTile;
      const focusedName = focused === undefined ? undefined : this.ftileCard(focused);
      const at = cards.findIndex((c) => c.name === focusedName);
      if (cards.length === 0 || at === -1) {
        return;
      }
      openConsoleCardZoom(cards.map((c) => this.liveCardOf(c.name, c.owner)), at, undefined, undefined, {
        contextLabel: 'Effects',
        origin: slotZoomOrigin(
          () => this.$refs.rootEl as HTMLElement,
          (i) => cards[i]?.name ?? '',
          (i) => {
            const c = cards[i];
            if (c !== undefined) {
              this.ui.focusKey = c.firstKey;
              this.$nextTick(() => this.scrollFocusedIntoView());
            }
          },
        ),
      });
    },
    /** X at detail — the hero card fullscreen (one-card list, hero slot). */
    inspectDetail(): void {
      const name = this.ui.detail?.cardName;
      if (name === undefined || name === '') {
        return;
      }
      const card = this.forecastMode ? this.liveCardOf(name, this.detailOwner) : this.liveCard(name);
      openConsoleCardZoom([card], 0, undefined, undefined, {
        contextLabel: 'Effects',
        origin: slotZoomOrigin(() => this.$refs.rootEl as HTMLElement, () => name),
      });
    },
  },
});

/** The «ПОРЯДОК» band names a payout by its resource WORD (i18n keys of the
 *  resource names the console already carries). */
function iconWord(icon: string): string {
  switch (icon) {
  case 'megacredits': return 'M€';
  case 'steel': return 'Steel';
  case 'titanium': return 'Titanium';
  case 'plants': return 'Plants';
  case 'energy': return 'Energy';
  case 'heat': return 'Heat';
  case 'tr': return 'TR';
  case 'cards': return 'Cards';
  default: return icon;
  }
}
</script>

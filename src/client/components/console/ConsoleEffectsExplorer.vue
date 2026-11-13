<template>
  <div ref="rootEl" class="con-efx" :class="{'con-efx--forecast': forecastMode, 'con-efx--column': workColumn}" role="region" :aria-label="$t('Effects')">
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
              <div class="con-efx__detail-name" v-i18n>{{ groupTitle(focusedGroup) }}</div>
              <!-- A PARTY / the LAW (Turmoil Redux «один фреймворк»): its own face stands where a card's would — the
                   party's emblem over its printed standing effect, the law's face; the badge is the plate's. -->
              <div class="con-efx__detail-cardwrap"
                   data-effect-flow-thumb
                   :data-zoom-slot="detailUp ? undefined : groupZoomName(focusedGroup)">
                <div v-if="focusedGroup.cardName !== undefined" :key="'card|' + focusedGroup.key" class="con-efx__detail-card">
                  <ConsoleCardFaceLite :name="focusedGroup.cardName" :card="liveCard(focusedGroup.cardName)" />
                </div>
                <div v-else-if="focusedGroup.source.kind === 'law'" :key="'law|' + focusedGroup.key" class="con-efx__detail-card con-efx__detail-card--law">
                  <PremiumCard v-if="lawFaceVm(focusedGroup) !== undefined" :vmOverride="lawFaceVm(focusedGroup)" :lightweight="true" :inert="true" />
                </div>
                <!-- A PARTY: its CHARTER (2026-10-25) — the face the composer's hero and the inspector draw. -->
                <div v-else :key="'party|' + focusedGroup.key" class="con-efx__detail-card con-efx__detail-card--party" :style="{'--parl-accent': partyAccentOf(focusedGroup)}">
                  <PremiumCard v-if="partyFaceVm(focusedGroup) !== undefined" :vmOverride="partyFaceVm(focusedGroup)" :lightweight="true" :inert="true" />
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
                      <!-- A PARTY source (Turmoil Redux) has no printed block: its emblem stands where the card's graphic would. -->
                      <span v-else-if="ftilePartyEmblem(tile) !== undefined" class="con-efx__graphic con-efx__graphic--party"><img class="con-efx__party-emblem" :src="ftilePartyEmblem(tile)" alt="" /></span>
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
                        <!-- What this play REALLY saves; an offer the 0-floor cut names its cap («−1 из 2» — P62 · GB). -->
                        <span class="con-efx__meta-num" :data-forecast-saved="tile.item.saved ?? tile.item.amount">−{{ tile.item.saved ?? tile.item.amount }}</span>
                        <!-- the cap stands WITH its number («−1 из 2»), never beside the price line («из 21 → 0» on the 4K frame) -->
                        <span v-if="tile.item.saved !== undefined" class="con-efx__meta-text" :data-forecast-capped="tile.item.amount">{{ discountCapText(tile.item.amount) }}</span>
                        <i class="resource_icon resource_icon--megacredits con-efx__meta-icon" aria-hidden="true"></i>
                        <span class="con-efx__meta-text">{{ discountTotal }}</span>
                      </template>
                      <template v-else-if="tile.item.kind === 'other-discount'">
                        <span class="con-efx__meta-num">−{{ tile.item.amount }}</span>
                        <i class="resource_icon resource_icon--megacredits con-efx__meta-icon" aria-hidden="true"></i>
                        <span class="con-efx__meta-text">{{ discountTotal }}</span>
                      </template>
                      <!-- A REQUIREMENT MODIFIER of the play (TR49 class): its badge (the waiver's struck plate), and what this
                           play does with it — spends it (one play), spends it for NOTHING, or reads a standing ±2. -->
                      <template v-else-if="tile.item.kind === 'modifier'">
                        <PremiumPartyRequirementGlyph v-if="tile.item.partyWaive" class="pprq--waived con-armed__pprq" />
                        <span v-else-if="tile.item.waive" class="con-armed__struck" aria-hidden="true">{{ $t('Global requirements') }}</span>
                        <span v-else-if="tile.item.badge !== ''" class="con-armed__badge">{{ tile.item.badge }}</span>
                        <span class="con-efx__meta-text" :data-forecast-modifier="tile.item.used ? 'used' : 'unused'">{{ modifierMetaText(tile.item) }}</span>
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
                  <!-- A political source's plate wears the BADGE — the party's emblem, the kicker («ЭФФЕКТ ПАРТИИ» /
                       «ЭФФЕКТ, ПОКА ПРИНЯТА»), its name, the party's accent on the edge — and nothing else differs. -->
                  <div v-if="g.cardName === undefined" class="con-efx__plate con-efx__plate--political" :data-efx-source="g.key" :style="{'--parl-accent': partyAccentOf(g)}">
                    <img class="con-efx__plate-emblem" :src="partyEmblemOf(g)" alt="" />
                    <span class="con-efx__plate-kicker" v-i18n>{{ g.source.kind === 'law' ? 'Effect while enacted' : 'Party effect' }}</span>
                    <span class="con-efx__plate-name" v-i18n>{{ groupTitle(g) }}</span>
                  </div>
                  <div v-else class="con-efx__plate">
                    <span class="con-efx__plate-name" v-i18n>{{ g.cardName }}</span>
                    <span v-if="plateChip(g) !== undefined" class="con-efx__plate-chip">
                      <span class="con-efx__res-icon" :class="plateChip(g)?.icon" aria-hidden="true"></span>
                      <b>{{ plateChip(g)?.count }}</b>
                    </span>
                    <!-- A FLEET DOCK with the trade fleet standing on it (TR06 Water
                         Hauling): the card's STATE, not a used action — it never
                         dims like a disabled card. -->
                    <span v-if="g.cardName !== undefined && fleetDockedOn(g.cardName) !== undefined" class="con-efx__plate-state" data-efx-fleet-docked>
                      <ColonyFleetIcon class="con-efx__plate-ship" :color="fleetDockedOn(g.cardName!) ?? 'neutral'" />
                      <span v-i18n>Trade fleet docked · returns next generation</span>
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
                        <span v-else-if="tile.meta.kind === 'access'" class="con-efx__meta-line con-efx__meta-line--access"
                              :class="{'con-efx__meta-line--warn': tile.meta.tone === 'warn'}" data-efx-access>
                          <span>{{ accessText(tile.meta) }}</span>
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
          <div class="con-efx__hero" data-effect-focus-card :data-zoom-slot="detailZoomName">
            <div v-if="detailCardName !== ''" :key="detailCardName" class="con-efx__hero-card">
              <ConsoleCardFaceLite :name="detailCardName" :card="forecastMode ? liveCardOf(detailCardName, detailOwner) : liveCard(detailCardName)" />
            </div>
            <!-- A PARTY / the LAW: the party's plaque, the law's face — in the hero's slot, at the hero's place. -->
            <div v-else-if="detailPolitical !== undefined && detailPolitical.source.kind === 'law'" :key="'law|' + detailPolitical.key" class="con-efx__hero-card con-efx__hero-card--law">
              <PremiumCard v-if="lawVmOf(detailPolitical.source.resolution) !== undefined" :vmOverride="lawVmOf(detailPolitical.source.resolution)" :lightweight="true" :inert="true" />
            </div>
            <div v-else-if="detailPolitical !== undefined" :key="'party|' + detailPolitical.key" class="con-efx__hero-card con-efx__hero-card--party">
              <PremiumCard v-if="partyVmOf(detailPolitical.party) !== undefined" :vmOverride="partyVmOf(detailPolitical.party)" :lightweight="true" :inert="true" />
            </div>
            <!-- A cardless source (a party policy, the cardless discount
                 remainder) keeps the hero column's geometry with its glyph. -->
            <div v-else-if="detailPartyEmblem() !== undefined" class="con-efx__hero-rule con-efx__hero-rule--party" aria-hidden="true"><img class="con-efx__party-emblem" :src="detailPartyEmblem()" alt="" /></div>
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
                <p v-if="detailPolitical !== undefined" class="con-efx__rule-access" :class="{'con-efx__rule-access--warn': detailPolitical.access.tone === 'warn'}" data-efx-access>{{ accessText({label: detailPolitical.access.key, params: detailPolitical.access.params}) }}</p>
              </div>
              <div v-if="detailSummaryAvailable" class="con-efx__summary" :class="{'con-efx__summary--quiet': forecastMode}" data-unfold-item>
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

<script setup vapor lang="ts">
/*
 * THE EFFECTS EXPLORER («Информация › Эффекты») — the card-actions browse
 * language re-hosted READ-ONLY: a dossier column (the focused effect's source
 * card — the physical zoom slot and the descend FLIP thumb) + a 2-column grid
 * of per-EFFECT tiles, and an in-explorer DETAIL layer (the effect dossier:
 * hero card + printed rule + the «За партию» summary) that UNFOLDS out of the
 * pressed tile (consoleEffectsFocusMotion — the action-focus phrase).
 *
 * Host-agnostic on purpose: everything derives from the `cards` prop (any
 * seat's tableau — or, for a future host, any card set) + the optional
 * `stats`; the ONE bottom bar carries every verb (barCommands published on
 * the host's `EffectsExplorerUi`, returned verbatim by the host). The host
 * provides the frame and the crumb — this surface draws NO kicker of its own
 * (the stage name travels up through `effectsStagePath` /
 * `forecastStageText`).
 *
 * TWO MODES, ONE CHASSIS. `mode="forecast"` is the composers' R3 «Эффекты»
 * layer: the SAME tiles, dossier column, detail stage, motion, fit ladders
 * and input — fed by the server's `EffectForecast` instead of the tableau.
 * The facet strip cycles the eight forecast GROUPS instead of the four
 * families, the «ПОРЯДОК» band appears when the queue order is honest, and
 * every tile's meta line is the forecast FOR THIS PLAY (never a statistic).
 * The dossier answers the five questions — WHAT / WHY / UNDER WHAT CONDITION
 * / TO WHOM / WHEN — from the server's fact; nothing is derived here.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {ExposedOf} from '@/client/components/exposedOf';
import {CardName} from '@/common/cards/CardName';
import {Color} from '@/common/Color';
import {Tag} from '@/common/cards/Tag';
import {Message} from '@/common/logs/Message';
import {CardModel} from '@/common/models/CardModel';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import type {ICardRenderEffect, ICardRenderRoot} from '@/common/cards/render/Types';
import {EffectForecast, EffectForecastRecipient, forecastSourceIsCardless} from '@/common/models/EffectForecastModel';
import {REDUX_PARTIES, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {EffectOverlayStat} from '@/common/events/aggregate';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {getCard} from '@/client/cards/ClientCardManifest';
import {EffectEntry, ExplorerEntry, PoliticalEffectEntry, isPoliticalEntry, playerEffects} from '@/client/components/effects/effectExtraction';
import {partyEffectZoomEntry, resolutionZoomEntry, ZoomCard} from '@/client/components/card/cardZoomTypes';
import {resolutionPremiumVm} from '@/client/components/premiumCard/resolutionPremiumVm';
import {partyPremiumVm} from '@/client/components/premiumCard/partyPremiumVm';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
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
  forecastItemPoliticalSource,
  forecastMetaLine,
  forecastOrderBand,
  ForecastModifierItem,
} from '@/client/console/effectForecastModel';
import {armedEffectFormula, easingLine} from '@/client/console/requirementEasingText';
import {EffectsExplorerUi, effectsExplorerUi} from '@/client/console/consoleEffectsExplorer';
import {actionDescTier, stepActionRows} from '@/client/console/consoleCardActions';
import {fitActionCanvases} from '@/client/console/consoleActionCanvasFit';
import {fitDescTiers} from '@/client/console/descTier';
import {resolveDetailFit} from '@/client/console/consoleDetailFit';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {$t, translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
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
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import PremiumPartyRequirementGlyph from '@/client/components/premiumCard/PremiumPartyRequirementGlyph.vue';
import {vI18n, vStripEffectPrefix} from '@/client/directives/vDirectives';

// (An exported type stands with the imports, above the script's first statement: the body of a Vapor script-setup block
// is a function body to the type checker, and an `export` below a statement is not at a module's top level there.)
/** A seat the forecast may name — the public player model fits structurally. */
export type ForecastSeat = {
  color: Color | string,
  name: string,
  isMarsBot?: boolean,
  tableau: ReadonlyArray<CardModel>,
};

type ExplorerTile = EffectsTileVm<ExplorerEntry>;
type ExplorerGroup = EffectsGroupVm<ExplorerEntry>;
type ScrollAreaRef = ExposedOf<typeof ConsoleScrollArea> & {
  scrollByPx: (dy: number) => void,
  ensureVisible: (el: Element, margin?: number) => void,
  scrollToStart: () => void,
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

/** The zoom-entry name of a political source — `PARTY_<party>` for a party's effect, the law's id (`cardZoomTypes`). */
function politicalZoomName(entry: PoliticalEffectEntry): string {
  return entry.source.kind === 'law' ? resolutionZoomEntry(entry.source.resolution).name : partyEffectZoomEntry(entry.party).name;
}

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

defineOptions({name: 'ConsoleEffectsExplorer'});
const props = defineProps({
  /** The inspected seat's tableau (or any future host's card set). In the
   *  forecast mode: the VIEWER's tableau (live resources of own sources). */
  cards: {type: Array as PropType<ReadonlyArray<CardModel>>, required: true},
  /** The seat identity — a change drops the detail layer instantly. */
  color: {type: String, required: true},
  /**
   * THE PARLIAMENT'S standing effects of this seat (Turmoil Redux «один фреймворк») — built by the host
   * (`politicalEffectEntries(politicalSources(…))`), shown as ordinary groups of the grid, FIRST (decision Р1: the law,
   * the ruling party, then the board's order). Stats mode only.
   */
  politicalEntries: {type: Array as PropType<ReadonlyArray<PoliticalEffectEntry>>, default: () => []},
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
  /**
   * The host stands the explorer in a WORK COLUMN (a share of the band beside another zone — the Parliament's
   * «ВАШИ ЭФФЕКТЫ» beside its actions): its tiles run one per row, as the forecast layer's do. Two abreast cut the
   * tile's caption to one letter per line at 4K (the owner's frame of 2026-10-24).
   */
  workColumn: {type: Boolean, default: false},
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
});

const flow = useFlowScope('effects-explorer');
const rootEl = useTemplateRef<HTMLElement>('rootEl');
const list = useTemplateRef<ScrollAreaRef>('list');
const detailEl = useTemplateRef<HTMLElement>('detailEl');
const stageScroll = useTemplateRef<ScrollAreaRef>('stageScroll');
const stageEl = useTemplateRef<HTMLElement>('stageEl');
/** The one-shot CSS commit pulse on the pressed tile. */
const descendKey = ref('');
const lastFlatIndex = ref(0);
/** The pending canvas-fit frame — its cancel (the explorer's scope takes it back on unmount). */
let fitFrame: (() => void) | undefined;

const ui = computed((): EffectsExplorerUi => {
  return props.explorerUi;
});
const forecastMode = computed((): boolean => {
  return props.mode === 'forecast';
});
const entries = computed((): ReadonlyArray<ExplorerEntry> => {
  return forecastMode.value ? playerEffects(props.cards) : [...props.politicalEntries, ...playerEffects(props.cards)];
});
const columns = computed((): 1 | 2 => {
  // The FORECAST layer stands in a composer's work column — half the
  // band, beside the dossier — so its tiles run ONE per row: the printed
  // canvas keeps its size and the caption + the meta chips keep their
  // reading measure (two abreast truncated both at 4K).
  return consoleLayoutState.profile === 'handheld' || forecastMode.value || props.workColumn ? 1 : 2;
});
const model = computed((): EffectsBrowseModel<ExplorerEntry> => {
  return buildEffectsBrowseModel({
    entries: entries.value,
    tableau: props.cards,
    stats: props.stats,
    familyFilter: ui.value.familyFilter,
    columns: columns.value,
  });
});
// ── forecast mode ─────────────────────────────────────────────────────
const fmodel = computed((): ForecastBrowseModel => {
  return buildForecastBrowseModel({
    forecast: forecastMode.value ? props.forecast : undefined,
    branches: props.branches,
    sectionFilter: ui.value.sectionFilter,
    columns: columns.value,
  });
});
/** The unfiltered model — the open dossier survives a facet change. */
const fmodelAll = computed((): ForecastBrowseModel => {
  return buildForecastBrowseModel({
    forecast: forecastMode.value ? props.forecast : undefined,
    branches: props.branches,
    sectionFilter: 'all',
    columns: columns.value,
  });
});
const ftileByKey = computed((): Map<string, ForecastTileVm> => {
  const map = new Map<string, ForecastTileVm>();
  for (const s of fmodelAll.value.sections) {
    for (const t of s.tiles) {
      map.set(t.key, t);
    }
  }
  return map;
});
const focusedFTile = computed((): ForecastTileVm | undefined => {
  return forecastMode.value ? ftileByKey.value.get(ui.value.focusKey) : undefined;
});
/** The focused forecast item's source card ('' for a cardless source). */
const focusedFCardName = computed((): CardName => {
  const tile = focusedFTile.value;
  return (tile === undefined ? undefined : ftileCard(tile)) ?? ('' as CardName);
});
const detailFTile = computed((): ForecastTileVm | undefined => {
  const detail = ui.value.detail;
  return forecastMode.value && detail !== undefined ? ftileByKey.value.get(detail.effectKey) : undefined;
});
/** The printed effect entries of every source card the forecast names,
 *  read through the manifest — a foreign seat's card included. */
const forecastEntries = computed((): Map<CardName, ReadonlyArray<EffectEntry>> => {
  const map = new Map<CardName, ReadonlyArray<EffectEntry>>();
  if (!forecastMode.value) {
    return map;
  }
  for (const tile of ftileByKey.value.values()) {
    const name = forecastItemCard(tile.item);
    if (name === undefined || map.has(name)) {
      continue;
    }
    map.set(name, playerEffects([liveCardOf(name, ftileOwner(tile))]));
  }
  return map;
});
const orderSteps = computed((): ReadonlyArray<OrderStep> => {
  return forecastMode.value ? forecastOrderBand(props.forecast, props.selectedBranchPos, props.orderFlags) : [];
});
/** «итого 10 → 8» — the discounts group's shared total line. */
const discountTotal = computed((): string => {
  const d = props.forecast?.discounts;
  if (d === undefined || d.final >= d.base) {
    return '';
  }
  return `${d.base} → ${d.final}`;
});
// ── mode-independent geometry ──────────────────────────────────────────
const flatKeys = computed((): ReadonlyArray<string> => {
  return forecastMode.value ? fmodel.value.flatKeys : model.value.flatKeys;
});
const rows = computed((): ReadonlyArray<ReadonlyArray<string>> => {
  return forecastMode.value ? fmodel.value.rows : model.value.rows;
});
const detailUp = computed((): boolean => {
  return ui.value.detail !== undefined;
});
const tileByKey = computed((): Map<string, ExplorerTile> => {
  const map = new Map<string, ExplorerTile>();
  for (const g of model.value.groups) {
    for (const t of g.tiles) {
      map.set(t.key, t);
    }
  }
  return map;
});
const focusedTile = computed((): ExplorerTile | undefined => {
  return forecastMode.value ? undefined : tileByKey.value.get(ui.value.focusKey);
});
const focusedGroup = computed((): ExplorerGroup | undefined => {
  return forecastMode.value ? undefined : model.value.groups.find((g) => g.tiles.some((t) => t.key === ui.value.focusKey));
});
const focusedRule = computed((): string => {
  return fullRuleOf(focusedTile.value);
});
const focusedOrdinal = computed((): string => {
  const g = focusedGroup.value;
  const t = focusedTile.value;
  if (g === undefined || t === undefined || g.tiles.length <= 1) {
    return '';
  }
  return `${translateText('Effect')} ${translateTextWithParams('${0} of ${1}', [String(t.entry.effectIndex + 1), String(g.tiles.length)])}`;
});
/** The open dossier's tile (survives a filter change — resolved over the
 *  UNFILTERED entry set so the stage never goes dark under the player). */
const detailTile = computed((): ExplorerTile | undefined => {
  const detail = ui.value.detail;
  if (detail === undefined || forecastMode.value) {
    return undefined;
  }
  const shown = tileByKey.value.get(detail.effectKey);
  if (shown !== undefined) {
    return shown;
  }
  const entry = entries.value.find((e) => e.key === detail.effectKey);
  if (entry === undefined) {
    return undefined;
  }
  const all = buildEffectsBrowseModel({entries: entries.value, tableau: props.cards, stats: props.stats, familyFilter: 'all', columns: columns.value});
  for (const g of all.groups) {
    for (const t of g.tiles) {
      if (t.key === detail.effectKey) {
        return t;
      }
    }
  }
  return undefined;
});
const detailCardName = computed((): CardName => {
  return ui.value.detail?.cardName ?? ('' as CardName);
});
/** The open dossier's POLITICAL entry (a party / the law), else undefined. */
const detailPolitical = computed((): PoliticalEffectEntry | undefined => {
  const entry = forecastMode.value ? undefined : detailTile.value?.entry;
  return entry !== undefined && isPoliticalEntry(entry) ? entry : undefined;
});
/** The hero's zoom-slot key — the card's name, the party's / the law's zoom entry name, else none. */
const detailZoomName = computed((): string | undefined => {
  if (detailCardName.value !== '') {
    return detailCardName.value;
  }
  const political = detailPolitical.value;
  return political === undefined ? undefined : politicalZoomName(political);
});
/** Forecast mode: the seat holding the open dossier's source. */
const detailOwner = computed((): Color | undefined => {
  const tile = detailFTile.value;
  return tile === undefined ? undefined : ftileOwner(tile);
});
/** The printed effect the open dossier stands on (stats: the tile's
 *  entry; forecast: the ATTRIBUTED one, or none). */
const detailEntry = computed((): ExplorerEntry | undefined => {
  if (forecastMode.value) {
    const tile = detailFTile.value;
    return tile === undefined ? undefined : ftileEntry(tile);
  }
  return detailTile.value?.entry;
});
const detailEffectNode = computed((): EffectEntry['effectNode'] => {
  return detailEntry.value?.effectNode;
});
const detailRenderRoot = computed((): EffectEntry['renderRoot'] => {
  return detailEntry.value?.renderRoot;
});
const detailRule = computed((): string => {
  if (forecastMode.value) {
    const tile = detailFTile.value;
    return tile === undefined ? '' : ftileRule(tile);
  }
  return fullRuleOf(detailTile.value);
});
const detailPos = computed((): number => {
  const i = flatKeys.value.indexOf(ui.value.detail?.effectKey ?? '');
  return i >= 0 ? i + 1 : 1;
});
/** Forecast mode: the «За партию» panel renders only for a source whose
 *  seat's stats have ARRIVED (a bot / rule source has none — no skeleton
 *  standing forever). */
const detailSummaryAvailable = computed((): boolean => {
  if (!forecastMode.value) {
    // A political source keeps no statistic — the block is honestly absent, never a skeleton standing forever.
    return detailPolitical.value === undefined;
  }
  const tile = detailFTile.value;
  return tile !== undefined && detailEntry.value !== undefined && statsFor(ftileOwner(tile)) !== undefined;
});
const detailSummary = computed((): EffectSummaryViewModel | undefined => {
  const candidate = detailEntry.value;
  if (candidate === undefined || isPoliticalEntry(candidate)) {
    return undefined;
  }
  const entry: EffectEntry = candidate;
  const owner = forecastMode.value ? detailOwner.value : undefined;
  const stats = forecastMode.value ? statsFor(owner) : props.stats;
  if (stats === undefined) {
    return undefined; // loading — the skeleton renders, never a fake zero
  }
  const cardEntries: ReadonlyArray<EffectEntry> = forecastMode.value ?
    (forecastEntries.value.get(entry.cardName) ?? [entry]) :
    cardEntriesOf(entry.cardName);
  const cardStat = stats.find((s) => s.card === entry.cardName && (s.kind === 'corporation') === entry.isCorporation);
  const per = (!forecastMode.value ? detailTile.value?.per : undefined) ?? perEffectStat(entry, cardEntries, cardStat);
  const sourceKind = entry.isCorporation ? 'corporation' as const : 'card' as const;
  const resourceType = getCard(entry.cardName)?.resourceType;
  const live = forecastMode.value ? liveCardOf(entry.cardName, owner) : liveCard(entry.cardName);
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
});
/** The explorer's live command contract — the host republishes it. */
const barState = computed((): Array<ConsoleCommand> => {
  if (forecastMode.value) {
    return forecastBarState();
  }
  const close: ConsoleCommand = {control: 'inspect', label: 'Close', priority: 0};
  if (detailUp.value) {
    const cmds: Array<ConsoleCommand> = [];
    if (model.value.flatKeys.length > 1) {
      cmds.push({control: 'bumperL', control2: 'bumperR', label: 'Other effects', priority: 1});
    }
    cmds.push({control: 'secondary', label: 'Inspect'});
    cmds.push({control: 'back', label: 'Back'});
    cmds.push(close);
    return cmds;
  }
  if (model.value.groups.length === 0) {
    const cmds: Array<ConsoleCommand> = [{control: 'bumperL', control2: 'bumperR', label: 'Players', priority: 1}];
    if (ui.value.familyFilter !== 'all' && model.value.total > 0) {
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
});

function liveCard(name: CardName | string): CardModel {
  return props.cards.find((c) => c.name === name) ?? ({name: name as CardName} as CardModel);
}
/** Forecast mode: the live model of a card held by ANY seat — the owner's
 *  tableau first (foreign resources are public), the viewer's, else a
 *  bare name (the manifest draws the face; a bot's corp has no model). */
function liveCardOf(name: CardName | string | undefined, owner: Color | string | undefined): CardModel {
  if (name === undefined) {
    return {name: '' as CardName} as CardModel;
  }
  const seat = owner === undefined ? undefined : props.players.find((p) => p.color === owner);
  return seat?.tableau.find((c) => c.name === name) ?? liveCard(name);
}
function textOf(v: string | Message | undefined, tag?: Tag): string {
  if (v === undefined) {
    return '';
  }
  if (typeof v !== 'string') {
    return translateMessage(v);
  }
  return tag !== undefined ? translateTextWithParams(v, reasonParams(undefined, tag)) : translateText(v);
}
function statsFor(owner: Color | string | undefined): ReadonlyArray<EffectOverlayStat> | undefined {
  return owner === undefined ? undefined : props.statsByColor[owner];
}
/** The card entries of one source card (stats mode). */
function cardEntriesOf(cardName: CardName): Array<EffectEntry> {
  return entries.value.filter((e): e is EffectEntry => !isPoliticalEntry(e) && e.cardName === cardName);
}
/** The resolved rule record of one effect (info-group short + full). */
function rulesOf(tile: ExplorerTile | undefined): EffectRules | undefined {
  if (tile === undefined) {
    return undefined;
  }
  const entry = tile.entry;
  if (isPoliticalEntry(entry)) {
    // A party / a law: its printed sentence IS the rule (the catalog's `text.passive`, one per block).
    const text = entry.description ?? entry.text ?? '';
    return text === '' ? undefined : {lines: [{kind: 'rule', text}], summary: text, curated: false};
  }
  return rulesOfEntry(entry, cardEntriesOf(entry.cardName).length);
}
function rulesOfEntry(entry: EffectEntry, count: number): EffectRules | undefined {
  return effectRules({
    cardName: entry.cardName,
    effectIndex: entry.effectIndex,
    effectNode: entry.effectNode,
    description: entry.description,
    text: entry.text,
  }, count);
}
/** The FULL rule — the dossier's and the detail stage's reading. */
function fullRuleOf(tile: ExplorerTile | undefined): string {
  return rulesOf(tile)?.lines[0]?.text ?? tile?.entry.description ?? tile?.entry.text ?? '';
}
/** A group's NAME key — the card, the party's glossary name, the law's printed name. */
function groupTitle(g: ExplorerGroup): string {
  const first = g.tiles[0]?.entry;
  return first !== undefined && isPoliticalEntry(first) ? first.title : (g.cardName ?? '');
}
/** A political group's badge party (a law wears its own party). */
function politicalParty(g: ExplorerGroup): ReduxParty {
  const first = g.tiles[0]?.entry;
  return (first !== undefined && isPoliticalEntry(first) ? first.party : REDUX_PARTIES[0]) as ReduxParty;
}
function partyEmblemOf(g: ExplorerGroup): string {
  return partyEmblemUrl(politicalParty(g));
}
function partyAccentOf(g: ExplorerGroup): string {
  return partyAccent(politicalParty(g));
}
function lawVmOf(resolution: string): PremiumCardVM | undefined {
  const law = getResolution(resolution);
  return law === undefined ? undefined : resolutionPremiumVm(law);
}
/** A party's CHARTER (`partyPremiumVm`) — the one face a party wears wherever a card would stand. */
function partyVmOf(party: ReduxParty | undefined): PremiumCardVM | undefined {
  return party === undefined ? undefined : partyPremiumVm(party);
}
function partyFaceVm(g: ExplorerGroup): PremiumCardVM | undefined {
  return g.source.kind === 'party' ? partyVmOf(g.source.party) : undefined;
}
function lawFaceVm(g: ExplorerGroup): PremiumCardVM | undefined {
  return g.source.kind === 'law' ? lawVmOf(g.source.resolution) : undefined;
}
/** A group's zoom-slot key — the card's name, or its zoom entry's name (`PARTY_<party>` / the law's id). */
function groupZoomName(g: ExplorerGroup): string {
  if (g.cardName !== undefined) {
    return g.cardName;
  }
  const first = g.tiles[0]?.entry;
  return first !== undefined && isPoliticalEntry(first) ? politicalZoomName(first) : g.key;
}
/** What X opens for a group — the live card, the party's effect, the law's face. */
function groupZoomCard(g: ExplorerGroup): ZoomCard {
  if (g.cardName !== undefined) {
    return liveCard(g.cardName);
  }
  return g.source.kind === 'law' ? resolutionZoomEntry(g.source.resolution) : partyEffectZoomEntry(politicalParty(g));
}
/** The access reading (an i18n key + its params, the names already translated). */
function accessText(meta: {label: string, params: ReadonlyArray<string>}): string {
  return meta.params.length > 0 ? translateTextWithParams(meta.label, [...meta.params]) : translateText(meta.label);
}
function tileOrdinal(tile: ExplorerTile): string {
  return `${translateText('Effect')} ${tile.entry.effectIndex + 1}`;
}
function tileDesc(tile: ExplorerTile): string {
  // The tile CAPTION: the card's curated short when the full rule is too
  // long for a calm one/two-line read, else the full sentence (never a
  // truncation — the effectDescription contract). Text-only overrides
  // already ARE the graphic — no duplicate caption.
  if (tile.entry.effectNode === undefined && tile.entry.renderRoot === undefined) {
    return '';
  }
  return rulesOf(tile)?.summary ?? tile.entry.description ?? '';
}
function tileDescTier(tile: ExplorerTile): string {
  return actionDescTier(translateText(tileDesc(tile)).replace(/^(Effect|Действие|Эффект):\s*/i, ''));
}
/** The trade fleet standing on a fleet-dock card (its owner's livery) — public state. */
function fleetDockedOn(cardName: CardName): Color | undefined {
  return props.cards.find((c) => c.name === cardName)?.fleetDocked;
}
function plateChip(g: ExplorerGroup): {icon: string, count: number} | undefined {
  if (g.cardName === undefined) {
    return undefined;
  }
  const resourceType = getCard(g.cardName)?.resourceType;
  if (resourceType === undefined) {
    return undefined;
  }
  const live = liveCard(g.cardName);
  return {icon: iconClassFor(String(resourceType)), count: live.resources ?? 0};
}
function groupIsLive(g: ExplorerGroup): boolean {
  return g.tiles.some((t) => t.key === ui.value.focusKey);
}
function setFamily(id: EffectFamily | 'all'): void {
  ui.value.familyFilter = id;
}
function cycleFamily(dir: 1 | -1): void {
  const ids = model.value.familyChips.map((c) => c.id);
  if (ids.length <= 1) {
    return;
  }
  const at = ids.indexOf(ui.value.familyFilter);
  const next = (at + dir + ids.length) % ids.length;
  ui.value.familyFilter = ids[next];
}
// ── forecast mode helpers ──────────────────────────────────────────────
function setSection(id: ForecastGroupId | 'all'): void {
  ui.value.sectionFilter = id;
}
function cycleSection(dir: 1 | -1): void {
  if (fmodel.value.groups.length === 0) {
    return;
  }
  ui.value.sectionFilter = cycleForecastSection(fmodel.value.groups, ui.value.sectionFilter, dir);
}
function ftileCard(tile: ForecastTileVm): CardName | undefined {
  return forecastItemCard(tile.item);
}
/**
 * A PARTY- or RESOLUTION-sourced fact's emblem (Turmoil Redux) — the cardless
 * source's own face; a DISCOUNT the law or a party's policy took off the
 * price wears the same emblem (an enacted resolution's law lowering a
 * Building card is the parliament's doing, and the tile says so).
 */
function ftilePartyEmblem(tile: ForecastTileVm): string | undefined {
  const item = tile.item;
  const political = forecastItemPoliticalSource(item);
  if (political !== undefined) {
    return politicalEmblem(political.kind === 'resolution' ? getResolution(political.id)?.party : political.name);
  }
  if (item.kind !== 'fact') {
    return undefined;
  }
  const source = item.fact.source;
  if (source.kind === 'resolution') {
    return politicalEmblem(getResolution(source.name)?.party);
  }
  return source.kind === 'party' ? politicalEmblem(source.name) : undefined;
}
function politicalEmblem(party: string | undefined): string | undefined {
  return party !== undefined && (REDUX_PARTIES as ReadonlyArray<string>).includes(party) ? partyEmblemUrl(party as ReduxParty) : undefined;
}
/** A cardless source's NAME key: a resolution resolves to its printed name through the parliament manifest. */
function fsourceName(source: {kind: string, name: string}): string {
  return source.kind === 'resolution' ? (getResolution(source.name)?.text.name ?? source.name) : source.name;
}
/**
 * A political DISCOUNT's name key (the law's printed name through the
 * manifest, a party's own name) — '' for a discount of a card. The tile's
 * title, its canvas and the dossier's WHY all read this one answer.
 */
function fdiscountLawName(tile: ForecastTileVm): string {
  const political = forecastItemPoliticalSource(tile.item);
  if (political === undefined) {
    return '';
  }
  return political.kind === 'resolution' ? (getResolution(political.id)?.text.name ?? political.id) : political.name;
}
function detailPartyEmblem(): string | undefined {
  const tile = detailFTile.value;
  return tile === undefined ? undefined : ftilePartyEmblem(tile);
}
function ftileOwner(tile: ForecastTileVm): Color | undefined {
  return forecastItemOwner(tile.item, props.color as Color);
}
/** The owner's name — ONLY for a foreign source (own cards need no plate). */
function ftileOwnerName(tile: ForecastTileVm): string {
  const owner = ftileOwner(tile);
  if (owner === undefined || owner === props.color) {
    return '';
  }
  return displayNameForColor(props.players, owner);
}
function ftileEntry(tile: ForecastTileVm): EffectEntry | undefined {
  const name = ftileCard(tile);
  if (name === undefined) {
    return undefined;
  }
  return attributeItemToEffect(tile.item, forecastEntries.value.get(name) ?? []);
}
function ftileEffectNode(tile: ForecastTileVm): ICardRenderEffect | undefined {
  return ftileEntry(tile)?.effectNode;
}
/** The template's non-optional binding — called only behind the v-if. */
function ftileEffectNodeOf(tile: ForecastTileVm): ICardRenderEffect {
  return ftileEffectNode(tile) as ICardRenderEffect;
}
function ftileRenderRoot(tile: ForecastTileVm): ICardRenderRoot | undefined {
  return ftileEntry(tile)?.renderRoot;
}
function ftileRenderRootOf(tile: ForecastTileVm): ICardRenderRoot {
  return ftileRenderRoot(tile) as ICardRenderRoot;
}
/** The tile's TITLE — the source card (an i18n key), the rule's name, the
 *  cardless remainder, or the branch the empty row belongs to. */
function ftileTitle(tile: ForecastTileVm): string {
  const item = tile.item;
  switch (item.kind) {
  case 'fact':
    return translateText(fsourceName(item.fact.source));
  case 'other-discount':
    return translateText('Other discounts');
  case 'branch-empty':
    return branchTitle(item.branchPos);
  default: {
    const name = ftileCard(tile);
    if (name !== undefined) {
      return translateText(name);
    }
    // A discount of the LAW / a party's policy is named, never «other»: the
    // player must know WHY the price fell, not only that it did.
    const law = fdiscountLawName(tile);
    return law === '' ? translateText('Other discounts') : translateText(law);
  }
  }
}
function branchTitle(pos: number): string {
  const branch = props.branches.find((b) => b.pos === pos);
  const title = branch === undefined ? '' : textOf(branch.title);
  return translateTextWithParams('If you choose «${0}»', [title]);
}
/** The canvas text when no printed block can be vouched for — the honest
 *  «an effect of this card» (never a guess at WHICH block). */
function ftileCanvasText(tile: ForecastTileVm): string {
  const item = tile.item;
  if (item.kind === 'fact' && forecastSourceIsCardless(item.fact.source)) {
    return translateText(fsourceName(item.fact.source));
  }
  if (item.kind === 'other-discount') {
    return translateText('A discount with no card source');
  }
  if (item.kind === 'branch-empty') {
    return translateText('Nothing will trigger');
  }
  if (item.kind === 'modifier') {
    return item.armed !== undefined ? armedEffectFormula(item.armed.effect) : item.easings.map((e) => easingLine(e)).join(' · ');
  }
  const law = fdiscountLawName(tile);
  return translateText(law === '' ? 'Effect of this card' : law);
}
function ftileDesc(tile: ForecastTileVm): string {
  const entry = ftileEntry(tile);
  if (entry === undefined || (entry.effectNode === undefined && entry.renderRoot === undefined)) {
    return '';
  }
  const name = entry.cardName;
  const count = (forecastEntries.value.get(name) ?? []).length;
  return rulesOfEntry(entry, count)?.summary ?? entry.description ?? '';
}
function ftileDescTier(tile: ForecastTileVm): string {
  return actionDescTier(translateText(ftileDesc(tile)).replace(/^(Effect|Действие|Эффект):\s*/i, ''));
}
/** The FULL printed rule of the attributed effect ('' when unattributed). */
function ftileRule(tile: ForecastTileVm): string {
  const entry = ftileEntry(tile);
  if (entry === undefined) {
    return '';
  }
  const count = (forecastEntries.value.get(entry.cardName) ?? []).length;
  return rulesOfEntry(entry, count)?.lines[0]?.text ?? entry.description ?? entry.text ?? '';
}
function ftileMeta(tile: ForecastTileVm): ForecastMetaLine {
  return forecastMetaLine(tile.item, props.operation);
}
/** The WHY sentence with its last word split off, so the tag icon can
 *  ride that word in a `nowrap` pair (no tag → the whole sentence). The
 *  separating space stays at the END of `text`: a whitespace-only node
 *  between two template elements is condensed away by the compiler
 *  («с меткойнауки» shipped that way), while a space inside the
 *  interpolated text survives and is the one break opportunity before
 *  the unbreakable tail. */
function whyText(text: string, tag: Tag | undefined): {text: string, textTail?: string} {
  if (tag === undefined) {
    return {text};
  }
  const trimmed = text.trimEnd();
  const at = trimmed.lastIndexOf(' ');
  if (at <= 0) {
    return {text: '', textTail: trimmed};
  }
  return {text: trimmed.slice(0, at + 1), textTail: trimmed.slice(at + 1)};
}
/** The meta line's value signature — its re-mount key. */
function ftileMetaKey(tile: ForecastTileVm): string {
  const item = tile.item;
  if (item.kind !== 'fact') {
    return item.kind === 'discount' || item.kind === 'other-discount' ? `${item.kind}:${item.amount}:${item.kind === 'discount' ? item.saved ?? '' : ''}` :
      (item.kind === 'payment' ? `payment:${item.value.value}:${item.value.count}` : item.kind);
  }
  const sig = (e: ActionEffect) => `${e.icon}${e.amount}${e.current ?? ''}${e.resulting ?? ''}`;
  const line = forecastMetaLine(item);
  return `${line.chips.map(sig).join(',')}|${(line.alternative?.chips ?? []).map(sig).join(',')}`;
}
/** «За партию: срабатывал N раз» — one quiet line, only once the owner's
 *  stats have arrived (a bot / rule source claims nothing). */
function ftileStatLine(tile: ForecastTileVm): string {
  const entry = ftileEntry(tile);
  const stats = statsFor(ftileOwner(tile));
  if (entry === undefined || stats === undefined) {
    return '';
  }
  const cardEntries = forecastEntries.value.get(entry.cardName) ?? [entry];
  const cardStat = stats.find((s) => s.card === entry.cardName && (s.kind === 'corporation') === entry.isCorporation);
  const per = perEffectStat(entry, cardEntries, cardStat);
  const count = per.stat?.triggerCount ?? 0;
  return count > 0 ? `${translateText('Times triggered')}: ${count}` : translateText('Not triggered yet');
}
/** A modifier tile's meta: spent by this play / spent for nothing / a standing modifier (TR49 class). */
function modifierMetaText(item: ForecastModifierItem): string {
  if (!item.oneShot) {
    return translateText('Standing modifier');
  }
  return translateText(item.used ? 'One play — spent by this play' : 'One play — this play spends it for nothing');
}
function paymentAvailable(count: number): string {
  return translateTextWithParams('${0} available in payment', [String(count)]);
}
/** «из 2» — the offer an emptied-by-the-floor discount line names as its cap (P62 · GB). */
function discountCapText(offer: number): string {
  return translateTextWithParams('of ${0}', [String(offer)]);
}
function stateLabel(state: 'met' | 'depends' | 'unmet'): string {
  switch (state) {
  case 'met': return 'Condition met';
  case 'depends': return 'Depends on your choice';
  default: return 'Condition not met';
  }
}
function recipientText(recipient: EffectForecastRecipient): string {
  if (recipient.kind === 'you') {
    return translateText('You');
  }
  return displayNameForColor(props.players, recipient.color);
}
/** The dossier's five questions in their fixed order — every answer is
 *  the SERVER's (`reason`, `condition`, `recipient`, `timing`), only
 *  worded here. */
function ftileQuestions(tile: ForecastTileVm): Array<ForecastQuestion> {
  const item = tile.item;
  const out: Array<ForecastQuestion> = [];
  if (item.kind === 'fact') {
    const fact = item.fact;
    const what: ForecastQuestion = {id: 'what', label: 'What', chips: fact.effects, recipient: fact.recipient, skipped: fact.certainty === 'skipped'};
    if (fact.alternatives !== undefined && fact.alternatives.length > 0) {
      what.alternatives = fact.alternatives.map((a) => ({label: textOf(a.label), chips: a.effects}));
    }
    if (fact.effects.length === 0 && (fact.certainty === 'no' || fact.certainty === 'unknown')) {
      what.text = translateText(CERTAINTY_LABEL[fact.certainty]);
    }
    if (factBeyondOwnEffect(fact)) {
      what.note = translateText('Beyond the card\'s own effect');
    }
    if (fact.note !== undefined) {
      what.note = (what.note === undefined ? '' : what.note + ' · ') + textOf(fact.note);
    }
    out.push(what);
    out.push({id: 'why', label: 'Why', ...whyText(textOf(fact.reason, fact.reasonTag), fact.reasonTag), tag: fact.reasonTag});
    if (fact.condition !== undefined) {
      const cond: ForecastQuestion = {id: 'condition', label: 'Condition', state: fact.condition.state};
      if (fact.condition.state === 'depends' && fact.condition.branchPos !== undefined) {
        cond.text = branchTitle(fact.condition.branchPos);
        if (fact.condition.branchPos === props.selectedBranchPos) {
          cond.note = translateText('Selected');
        }
      } else if (textOf(fact.condition.text, fact.reasonTag) !== textOf(fact.reason, fact.reasonTag)) {
        cond.text = textOf(fact.condition.text, fact.reasonTag);
      }
      out.push(cond);
    }
    out.push({id: 'whom', label: 'To whom', text: recipientText(fact.recipient), recipient: fact.recipient});
    out.push({id: 'when', label: 'When', text: translateText(timingLabel(fact.timing, props.operation))});
    return out;
  }
  if (item.kind === 'discount' || item.kind === 'other-discount') {
    // The saving, never the offer: an offer the 0-floor cut says so in words (invariant 4 — P62 · GB).
    const saved = item.kind === 'discount' ? item.saved : undefined;
    out.push({id: 'what', label: 'What', chips: [{direction: 'gain', icon: 'megacredits', amount: saved ?? item.amount, note: 'discount'}],
      note: saved === undefined ? undefined : translateTextWithParams('The price cannot go below 0 — ${0} of the ${1} offered', [String(saved), String(item.amount)])});
    out.push({id: 'why', label: 'Why', text: item.kind === 'discount' ?
      translateTextWithParams('${0} lowers the printed cost', [ftileTitle(tile)]) :
      translateText('A discount with no card source')});
    out.push({id: 'condition', label: 'Condition', text: discountTotal.value === '' ? '' : `${translateText('Cost')} ${discountTotal.value}`, state: 'met'});
    out.push({id: 'whom', label: 'To whom', text: translateText('You')});
    out.push({id: 'when', label: 'When', text: translateText('At payment')});
    return out;
  }
  if (item.kind === 'modifier') {
    // THE FIVE QUESTIONS of a requirement modifier (TR49 class) — every word from the class's one formatter.
    const name = ftileTitle(tile);
    out.push({id: 'what', label: 'What', text: item.armed !== undefined ? armedEffectFormula(item.armed.effect) : item.easings.map((e) => easingLine(e)).join(' · '),
      note: item.oneShot ? translateText(item.used ? 'One play — spent by this play' : 'One play — this play spends it for nothing') : undefined});
    out.push({id: 'why', label: 'Why', text: translateTextWithParams(item.armed !== undefined ? '${0} armed it for your next card' : '${0} bends the printed requirement', [name])});
    if (item.easings.length > 0) {
      out.push({id: 'condition', label: 'Condition', text: item.easings.map((e) => easingLine(e)).join(' · '), state: item.easings.every((e) => e.met) ? 'met' : 'unmet'});
    }
    out.push({id: 'whom', label: 'To whom', text: translateText('You')});
    out.push({id: 'when', label: 'When', text: translateText('On play')});
    return out;
  }
  if (item.kind === 'payment') {
    const v = item.value;
    out.push({id: 'what', label: 'What', chips: [{direction: 'gain', icon: String(v.resource).toLowerCase(), amount: 1, note: `= ${v.value} M€`}]});
    out.push({id: 'why', label: 'Why', text: translateTextWithParams('${0} lets you pay with this resource', [ftileTitle(tile)])});
    out.push({id: 'condition', label: 'Condition', text: paymentAvailable(v.count), state: v.count > 0 ? 'met' : 'unmet'});
    out.push({id: 'whom', label: 'To whom', text: translateText('You')});
    out.push({id: 'when', label: 'When', text: translateText('At payment')});
    return out;
  }
  out.push({id: 'what', label: 'What', text: translateText('Nothing will trigger')});
  out.push({id: 'condition', label: 'Condition', text: branchTitle(item.branchPos), state: 'depends',
    note: item.branchPos === props.selectedBranchPos ? translateText('Selected') : undefined});
  return out;
}
function orderStepText(step: OrderStep): string {
  switch (step.kind) {
  case 'card-choice':
    return translateText('The card\'s own choice');
  case 'cell':
    return translateText('The cell for the tile');
  default: {
    const fact = step.fact;
    const source = translateText(fsourceName(fact.source));
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
}
function forecastBarState(): Array<ConsoleCommand> {
  const close: ConsoleCommand = {control: 'stickR', label: 'Close', priority: 0};
  if (detailUp.value) {
    const cmds: Array<ConsoleCommand> = [];
    if (flatKeys.value.length > 1) {
      cmds.push({control: 'bumperL', control2: 'bumperR', label: 'Other effects', priority: 1});
    }
    if (detailCardName.value !== '') {
      cmds.push({control: 'secondary', label: 'Inspect'});
    }
    cmds.push({control: 'back', label: 'Back'});
    cmds.push(close);
    return cmds;
  }
  const cmds: Array<ConsoleCommand> = [];
  if (fmodel.value.chips.length > 2) {
    cmds.push({control: 'triggerL', control2: 'triggerR', label: 'Sections', priority: 1});
  }
  if (focusedFTile.value !== undefined) {
    cmds.push({control: 'confirm', label: 'Open'});
    if (ftileCard(focusedFTile.value) !== undefined) {
      cmds.push({control: 'secondary', label: 'Inspect'});
    }
  }
  cmds.push({control: 'back', label: 'Back'});
  cmds.push(close);
  return cmds;
}
// ── geometry ───────────────────────────────────────────────────────────
function tileEl(key: string): HTMLElement | null {
  const root = rootEl.value ?? undefined;
  if (root === undefined || key === '') {
    return null;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(key) : key.replace(/"/g, '\\"');
  return root.querySelector<HTMLElement>(`[data-effect-key="${esc}"]`);
}
function scrollFocusedIntoView(): void {
  const listNow = list.value ?? undefined;
  const el = tileEl(ui.value.focusKey);
  if (listNow === undefined || el === null) {
    return;
  }
  // The FIRST row belongs to the top of the list (the facet strip's gap
  // would otherwise read as «stuck»). Asked of the ROWS, never of a
  // remembered index — `lastFlatIndex` is the nearest-survivor record, and
  // read here it pinned every d-pad step back to the top (the owner's
  // 4K frame of 2026-11-02: the grid never scrolled on the d-pad).
  if (rows.value[0]?.includes(ui.value.focusKey) === true) {
    listNow.scrollToStart();
    return;
  }
  // The tile's GROUP comes along — its plate names the source above the
  // tile; a group taller than the viewport keeps the tile itself in view.
  const group = el.closest<HTMLElement>('.con-efx__group');
  const viewport = el.closest<HTMLElement>('.con-scroll-area__viewport');
  const fits = group !== null && viewport !== null && group.offsetHeight <= viewport.clientHeight - 2 * 22 * conUiScale();
  listNow.ensureVisible(fits ? group : el, Math.round(22 * conUiScale()));
}
function scheduleCanvasFit(): void {
  if (typeof window === 'undefined' || typeof requestAnimationFrame !== 'function') {
    return;
  }
  if (fitFrame !== undefined) {
    fitFrame();
  }
  fitFrame = flow.afterFrame('the effect canvases fit after the paint', () => {
    fitFrame = undefined;
    fitActionCanvases(rootEl.value ?? undefined, {
      graphicSelector: '.con-efx__graphic',
      canvasClass: 'con-efx__canvas',
      varName: '--efx-fit',
    });
    // The caption's tier is the column's to decide (PL-123): this column is ~20% narrower than the action centre's.
    fitDescTiers(rootEl.value ?? undefined, {selector: '.con-efx__desc', classPrefix: 'con-efx__desc'});
    // The dossier column composes rather than scrolls (no reachable
    // scroll context there) — the measured ladder steps it down only as
    // far as a real overflow demands.
    const detail = detailEl.value ?? undefined;
    if (detail !== undefined) {
      resolveDetailFit(detail, detail, (level) => detail.setAttribute('data-fit', String(level)));
    }
  });
}
// ── input (forwarded by the host while the explorer is up) ─────────────
function handleIntent(intent: GamepadIntent): void {
  if (intent.kind === 'scroll') {
    const target = detailUp.value ?
      (stageScroll.value ?? undefined) :
      (list.value ?? undefined);
    target?.scrollByPx(intent.dy * 22 * conUiScale());
    return;
  }
  if (intent.kind === 'nav') {
    onNav(intent.dir);
    return;
  }
  if (intent.kind !== 'press') {
    return;
  }
  // R3 is «reset the facet» in the Information workspace only — inside a
  // composer's layer it is the host's own close verb, handled above us.
  const action = consoleActionOf(intent, forecastMode.value ? undefined : {stickR: 'reset'});
  if (detailUp.value) {
    if (action === 'prevSection' || action === 'nextSection') {
      stepDetail(action === 'prevSection' ? -1 : 1);
    } else if (action === 'inspect') {
      inspectDetail();
    }
    return;
  }
  switch (action) {
  case 'primary': descendFocused(); break;
  case 'inspect': inspectFocused(); break;
  case 'prevTab': forecastMode.value ? cycleSection(-1) : cycleFamily(-1); break;
  case 'nextTab': forecastMode.value ? cycleSection(1) : cycleFamily(1); break;
  case 'reset': if (!forecastMode.value) {
    setFamily('all');
  } break;
  default: break;
  }
}
function onNav(dir: 'up' | 'down' | 'left' | 'right'): void {
  if (detailUp.value) {
    // The dossier's own reading scroll (its list cursor lives in browse).
    const stage = stageScroll.value ?? undefined;
    if (dir === 'up' || dir === 'down') {
      stage?.scrollByPx((dir === 'down' ? 1 : -1) * 90 * conUiScale());
    }
    return;
  }
  if (rows.value.length === 0) {
    return;
  }
  const next = stepActionRows(rows.value, ui.value.focusKey, dir);
  if (next !== ui.value.focusKey) {
    ui.value.focusKey = next;
    nextTick(() => scrollFocusedIntoView());
  }
}
function onTilePressed(key: string): void {
  ui.value.focusKey = key;
  descendFocused();
}
/** The identity the detail layer opens on for the focused tile. */
function detailIdentityOf(key: string): {cardName: CardName, effectKey: string, title?: string} | undefined {
  if (forecastMode.value) {
    const tile = ftileByKey.value.get(key);
    return tile === undefined ? undefined : {cardName: ftileCard(tile) ?? ('' as CardName), effectKey: key};
  }
  const tile = tileByKey.value.get(key);
  if (tile === undefined) {
    return undefined;
  }
  // A party / the law has no card: the crumb names it by its own title (the stage tail «ЭФФЕКТЫ · КРАСНЫЕ»).
  return isPoliticalEntry(tile.entry) ? {cardName: '' as CardName, effectKey: key, title: tile.entry.title} : {cardName: tile.entry.cardName, effectKey: key};
}
/** A on a tile — the WORKSPACE DESCEND into the effect dossier. Arming is
 *  SYNCHRONOUS in the press handler (armed rects expire in 1 s). */
function descendFocused(): void {
  const identity = detailIdentityOf(ui.value.focusKey);
  if (identity === undefined || detailUp.value) {
    return;
  }
  const slotEl = tileEl(identity.effectKey);
  const slotRect = descendRectOf(slotEl);
  if (slotRect !== undefined) {
    armEffectsSlot(slotRect);
    armEffectsPress({x: slotRect.left + slotRect.width / 2, y: slotRect.top + slotRect.height / 2});
  }
  const root = rootEl.value ?? undefined;
  armEffectsFocusOrigin(descendRectOf(root?.querySelector<HTMLElement>('[data-effect-flow-thumb]')));
  descendKey.value = identity.effectKey;
  ui.value.detail = identity;
}
/** B at detail — fold back one level (the host asks before its own back). */
function consumeEffectsBack(): boolean {
  if (!detailUp.value) {
    return false;
  }
  descendKey.value = '';
  ui.value.detail = undefined;
  return true;
}
/** Seat switch / reset — the stage drops with NO fold (instant). */
function dropDetail(): void {
  if (!detailUp.value) {
    return;
  }
  armEffectsInstantFold();
  descendKey.value = '';
  ui.value.detail = undefined;
}
/** Detail LB/RB — the sibling effect, patched IN the standing stage. */
function stepDetail(dir: 1 | -1): void {
  const current = ui.value.detail;
  if (current === undefined) {
    return;
  }
  const next = stepEffect(flatKeys.value, current.effectKey, dir);
  if (next === current.effectKey) {
    return;
  }
  const identity = detailIdentityOf(next);
  if (identity === undefined) {
    return;
  }
  // The browse cursor follows UNDER the parked layer, and the fold's
  // destination re-arms to the stepped tile (autoAlpha keeps layout, so
  // the rect is live) — B after stepping folds into the RIGHT slot.
  ui.value.focusKey = next;
  lastFlatIndex.value = Math.max(0, flatKeys.value.indexOf(next));
  const slotRect = descendRectOf(tileEl(next));
  if (slotRect !== undefined) {
    armEffectsSlot(slotRect);
  }
  ui.value.detail = identity;
  playEffectsDetailStep(stageEl.value ?? undefined, dir);
}
/** X at browse — the source card fullscreen, browsing across GROUPS. */
function inspectFocused(): void {
  if (forecastMode.value) {
    inspectForecastFocused();
    return;
  }
  const groups = model.value.groups;
  const at = groups.findIndex((g) => g.tiles.some((t) => t.key === ui.value.focusKey));
  if (groups.length === 0 || at === -1) {
    return;
  }
  openConsoleCardZoom(groups.map((g) => groupZoomCard(g)), at, undefined, undefined, {
    contextLabel: 'Effects',
    origin: slotZoomOrigin(
      () => rootEl.value as HTMLElement,
      (i) => (groups[i] === undefined ? '' : groupZoomName(groups[i])),
      (i) => {
        const g = groups[i];
        if (g !== undefined) {
          ui.value.focusKey = g.tiles[0].key;
          nextTick(() => scrollFocusedIntoView());
        }
      },
    ),
  });
}
/** Forecast browse X — the DISTINCT source cards of the visible order, the
 *  focused one first under the cursor; stepping in the viewer moves the
 *  browse cursor onto that card's first tile. */
function inspectForecastFocused(): void {
  const cards: Array<{name: CardName, owner: Color | undefined, firstKey: string}> = [];
  for (const key of flatKeys.value) {
    const tile = ftileByKey.value.get(key);
    const name = tile === undefined ? undefined : ftileCard(tile);
    if (tile === undefined || name === undefined || cards.some((c) => c.name === name)) {
      continue;
    }
    cards.push({name, owner: ftileOwner(tile), firstKey: key});
  }
  const focused = focusedFTile.value;
  const focusedName = focused === undefined ? undefined : ftileCard(focused);
  const at = cards.findIndex((c) => c.name === focusedName);
  if (cards.length === 0 || at === -1) {
    return;
  }
  openConsoleCardZoom(cards.map((c) => liveCardOf(c.name, c.owner)), at, undefined, undefined, {
    contextLabel: 'Effects',
    origin: slotZoomOrigin(
      () => rootEl.value as HTMLElement,
      (i) => cards[i]?.name ?? '',
      (i) => {
        const c = cards[i];
        if (c !== undefined) {
          ui.value.focusKey = c.firstKey;
          nextTick(() => scrollFocusedIntoView());
        }
      },
    ),
  });
}
/** X at detail — the hero card fullscreen (one-card list, hero slot). */
function inspectDetail(): void {
  const political = detailPolitical.value;
  if (political !== undefined) {
    // A party's effect / the law's face — the same viewer the Parliament's X opens.
    const zoomName = politicalZoomName(political);
    const card = political.source.kind === 'law' ? resolutionZoomEntry(political.source.resolution) : partyEffectZoomEntry(political.party);
    openConsoleCardZoom([card], 0, undefined, undefined, {
      contextLabel: 'Effects',
      origin: slotZoomOrigin(() => rootEl.value as HTMLElement, () => zoomName),
    });
    return;
  }
  const name = ui.value.detail?.cardName;
  if (name === undefined || name === '') {
    return;
  }
  const card = forecastMode.value ? liveCardOf(name, detailOwner.value) : liveCard(name);
  openConsoleCardZoom([card], 0, undefined, undefined, {
    contextLabel: 'Effects',
    origin: slotZoomOrigin(() => rootEl.value as HTMLElement, () => name),
  });
}

watch(() => barState.value, (cmds: ReadonlyArray<ConsoleCommand>) => {
  ui.value.barCommands = cmds;
}, {immediate: true, deep: true});
/** Track the cursor's live flat position (feeds the nearest-survivor pick). */
watch(() => ui.value.focusKey, (key: string): void => {
  const i = flatKeys.value.indexOf(key);
  if (i >= 0) {
    lastFlatIndex.value = i;
  }
});
/** Keep the cursor on a valid, present tile (filter change / seat switch /
 *  update) — the nearest-survivor rule, never a jarring reset to first. */
watch(() => flatKeys.value, (keys: ReadonlyArray<string>) => {
  if (keys.length === 0) {
    ui.value.focusKey = '';
    return;
  }
  const liveIndex = keys.indexOf(ui.value.focusKey);
  if (liveIndex >= 0) {
    lastFlatIndex.value = liveIndex;
    return;
  }
  const at = Math.min(lastFlatIndex.value, keys.length - 1);
  ui.value.focusKey = keys[at];
  lastFlatIndex.value = at;
}, {immediate: true});
/** A seat switch drops the detail INSTANTLY — another seat almost never
 *  has the same effect, and a stranger's fold must not play. */
watch(() => props.color, (): void => {
  dropDetail();
});
/** Forecast mode: a refreshed forecast that no longer carries the open
 *  item drops the dossier (the browse layer updates in place). */
watch(() => detailFTile.value, (tile: ForecastTileVm | undefined): void => {
  if (forecastMode.value && detailUp.value && tile === undefined) {
    dropDetail();
  }
});
/** Re-fit the printed graphics whenever the grid recomposes. */
watch(() => model.value, (): void => {
  scheduleCanvasFit();
});
watch(() => fmodel.value, (): void => {
  scheduleCanvasFit();
});

onMounted(() => {
  scheduleCanvasFit();
});
onBeforeUnmount(() => {
  ui.value.barCommands = undefined;
});
defineExpose({consumeEffectsBack, handleIntent});
</script>

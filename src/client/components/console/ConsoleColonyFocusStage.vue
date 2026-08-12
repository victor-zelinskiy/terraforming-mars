<template>
  <!--
    COLONY FOCUS STAGE (iteration 3 — the premium detail scene). The
    workspace's DEEPER state for ONE colony; the crumb above already says
    «КОЛОНИИ › <colony> › <этап>», so the stage never titles itself.

    COMPOSITION — ONE surface, three columns, read left → right:

      HERO      the colony as a physical object: the big planet with its
                orbital berth (the fleet's live landing anchor), the active
                state, what the colony IS, who is parked here, and the honest
                verdict beside the identity it judges.

      MAIN      the GAME OBJECT, top to bottom:
                · the EXPANDED TRADE TRACK — one big cell per position with
                  its reward, and a real marker SEAT on a rail underneath
                  (the seat is what the glide proxy lands on, so the flying
                  marker is the same size as the resting one);
                · the RETURN BASE — the rule made visible: a bracket from
                  position 1 to the built-colony count with the ⟲ anchor
                  under the exact cell the track falls back to, the built
                  cubes inline, and (in build mode) the +1 ghost one cell
                  further right;
                · the COLONY BERTHS — three real places, each carrying the
                  return step it would buy («⟲ 2/3/4»), so «building raises
                  my trade floor» is read, never deduced;
                · the ACTION CONFIGURATION (payment paths + decisions for
                  trade; the confirm brief for build/pick; the colony's own
                  rules for inspect — never an empty payment skeleton).

      RESULT    the outcome grouped BY SOURCE, one card per source: the trade
                reward / the owners' bonus / extras / payment — or the build
                grant / the new colony / the future owner bonus.

      (The command verbs live ONLY in the shell's bottom bar.)

    RESOLUTION HAPPENS HERE: the hero planet carries the live
    `data-fleet-berth`, every track cell's SEAT carries
    `data-colony-track-cell`, the tight reward values carry
    `data-colony-trade-source` / `data-colony-bonus-source` and each berth's
    cube seat carries `data-colony-build-slot` + `data-colony-build-seat` —
    so the fleet, the reward chips, the marker glide and the build cube all
    land on THIS stage at THIS stage's real geometry.

    MOTION: `data-unfold-item` marks the structural groups (they surface from
    inside the opened panel) and `data-unfold-late` the FINE PRINT — text and
    numbers arrive only once the geometry has settled (consoleColonyFocusMotion).
  -->
  <div class="con-colfocus"
       ref="rootEl"
       :class="['con-colfocus--' + presentMode, {
         'con-colfocus--resolving': resolving,
         'con-colfocus--gliding': trackGliding,
         /* OWNERSHIP — the stage is a follow-up's host, so it holds its
            geometry (the action height) from submit time. It paints NOTHING:
            a claim that turns out to have nothing to present must leave no
            trace, and a zone that dressed itself on ownership alone is what
            stood as an empty dimmed box over Луна's finished trade. */
         'con-colfocus--claimed': outcomeZone,
         /* READINESS — a payout is genuinely STANDING in the zone, so the
            working area is handed over. It comes BACK the moment the payout
            leaves (see `workingAreaYielded`): the closing beat — the track
            reset — plays on the track this pose hides. */
         'con-colfocus--handing': workingAreaYielded,
         /* THE TARGET STEP — the trade's working area yields to the embedded
            played-card selector (one level deeper, reversible: B returns and
            everything under the pose is untouched). The hero planet stays. */
         'con-colfocus--targeting': sub === 'targets',
         /* THE PRESENTED TARGETS — the chosen host card(s) stand over the
            working area while the reward physically lands on them. The
            summary rail stays lit (the chips are BORN from its income value). */
         'con-colfocus--carding': cardlandHolds,
       }]"
       :data-colony-intent="intent">
    <div class="con-colfocus__surface" data-unfold-surface>
      <!-- THE EDGE IS NOT THE SUBJECT. The stage's boundary is a separate,
           inert layer so it can be brought up AFTER the surface has finished
           opening and the colony's own objects have taken their places —
           «the frame forms around what unfolded», never «a finished bordered
           rectangle grew out of a tile». Being its own element is also what
           lets the light be DIRECTIONAL (lit seam at the head, almost nothing
           at the foot) instead of one equally loud rule all the way round,
           which is what read as a panel-inside-a-panel. -->
      <span class="con-colfocus__edge" data-unfold-edge aria-hidden="true"></span>
      <!-- ═══ HERO — the colony as a physical object ═══ -->
      <section class="con-colfocus__hero">
        <div class="con-colfocus__planetwrap">
          <!-- THE CARD SOURCE. A card payout is BORN AT THE COLONY: physical
               causality says the cards leave the planet the fleet just traded
               with, not the number in the summary rail that happens to count
               them. (Resource rewards still leave their own printed value —
               those ARE the value moving; a card is a thing the colony hands
               over.) -->
          <div class="con-colfocus__planet" :class="planetClass"
               data-colony-focus-planet
               :data-colony-card-source="colony.name" aria-hidden="true">
            <span class="con-colfocus__planet-light" aria-hidden="true"></span>
            <span class="con-colfocus__planet-rim" aria-hidden="true"></span>
            <!-- The ORBITAL BERTH — the live landing anchor of the trade
                 fleet while the stage is up (same data key as the tile's
                 dock; the directors prefer the stage's match). -->
            <span class="con-colfocus__orbit"
                  :data-fleet-berth="colony.name"
                  :class="colony.visitor !== undefined ? ['con-colfocus__orbit--occupied', 'fleet-hue--' + colony.visitor] : []"
                  aria-hidden="true">
              <ColonyFleetIcon v-if="colony.visitor !== undefined" :color="colony.visitor" />
            </span>
          </div>
          <span class="con-colfocus__state" :class="colony.isActive ? 'con-colfocus__state--on' : 'con-colfocus__state--off'"
                data-unfold-late>
            {{ $t(colony.isActive ? 'Active' : 'Not active yet') }}
          </span>
        </div>
        <div class="con-colfocus__idmeta" data-unfold-late>
          <div class="con-colfocus__desc" v-i18n>{{ metadata.trade.description }}</div>
          <div v-if="visitorLine !== ''" class="con-colfocus__fleetline">
            <ColonyFleetIcon v-if="colony.visitor !== undefined" :color="colony.visitor" />
            <span>{{ visitorLine }}</span>
          </div>
        </div>
        <!-- The honest verdict, under the identity it judges — never a
             stranded red bar at the bottom of an empty page.
             It is a PRE-COMMIT judgement («can I do this?»), so it stops
             existing at the commit boundary — and once THIS stage session has
             crossed it, it never comes back (`commitLatched`): the resolution's
             final beats drop `pastCommit` one signal at a time (transaction
             ends → claim releases → workspace closes), and the live
             re-derivation flashed «✕ Здесь стоит ваш флот» in red for the
             last second before the close — the screen refusing an action it
             had already carried out. -->
        <div v-if="!pastCommit && !commitLatched"
             class="con-colfocus__verdict"
             :class="presentAvailable ? 'con-colfocus__verdict--ok' : 'con-colfocus__verdict--no'"
             data-unfold-late>
          <template v-if="presentAvailable">
            <span class="con-coltile__status-dot" aria-hidden="true"></span>
            <span>{{ $t(intent === 'build' ? 'Build here' : intent === 'pick' ? (pickLabel || 'Can select') : 'Trade available') }}</span>
          </template>
          <template v-else>
            <span aria-hidden="true">✕</span>
            <span>{{ blockReason !== '' ? $t(blockReason) : $t('Trade unavailable') }}</span>
          </template>
        </div>
        <!-- ═══ THE RESOLUTION CONTEXT — past the commit the colony IS the
             SOURCE of what the player is receiving. A calm chip under the
             planet names the role the hero plays right now («Награда за
             торговлю» → «Бонус владельца» as the waves advance), and a bonus
             triggered by ANOTHER player's trade names that player — the whole
             entry story lives in the identity column, never a second panel,
             and the planet itself stays lit (the source must read as active). -->
        <div v-if="presentedContext !== undefined" class="con-colfocus__srcctx">
          <span class="con-colfocus__srcchip">
            <span class="con-colfocus__srcchip-mark" aria-hidden="true">◈</span>
            <span>{{ $t('Source') }}</span>
          </span>
          <span class="con-colfocus__srcctx-role"
                :class="{'con-colfocus__srcctx-role--bonus': presentedContext.bonus}">
            {{ $t(presentedContext.roleKey) }}
          </span>
          <span v-if="presentedContext.traderLine !== ''" class="con-colfocus__srcctx-trader">
            <span v-if="presentedContext.traderColor !== ''"
                  :class="'con-status__dot player_bg_color_' + presentedContext.traderColor"
                  aria-hidden="true"></span>
            <span>{{ presentedContext.traderLine }}</span>
          </span>
        </div>
        <!-- (The «СБРОШЕНО» seat lives at SECTION level — one spot that
             survives the focus ⇄ full-stage-discard recompositions without a
             jump; see ConsoleColoniesSection.) -->
      </section>

      <!-- ═══ MAIN — the game object: track › guard rail › berths › setup ═══ -->
      <div class="con-colfocus__main" ref="mainEl">
        <!-- ── THE EXPANDED TRADE TRACK. One big cell per position with its
             reward; the MARKER RAIL underneath carries a real seat per cell —
             the seat is the glide anchor, so the flying marker is exactly the
             size of the resting one and lands on it, not beside it. ── -->
        <section class="con-colfocus__trackzone"
                 :style="{'--stop-col': resetPosition, '--ghost-col': resetPositionAfterBuild}">
          <header class="con-colfocus__zonehead" data-unfold-late>
            <span class="con-colfocus__sec-title">{{ $t('Trade track') }}</span>
            <span v-if="offsetSteps > 0" class="con-colfocus__tracknote-adv">
              {{ $t('Your trade advances the track first') }} <b>+{{ offsetSteps }}</b>
            </span>
          </header>

          <!-- THE TRACK AND THE BERTHS SHARE ONE 7-COLUMN GRID. Berth `i` sits
               under track cell `i` because that is literally the rule: an
               occupied berth PROTECTS that position — the marker can never
               return past it. The reset number is therefore never written
               anywhere; it is where the guard rail stops. -->
          <div class="con-colfocus__xtrack" data-colony-focus-track>
            <div v-for="cell in trackCells" :key="cell.index"
                 class="con-colfocus__xcell"
                 :class="{
                   'con-colfocus__xcell--marker': cell.marker,
                   'con-colfocus__xcell--effective': cell.effective,
                   'con-colfocus__xcell--passed': cell.passed,
                   'con-colfocus__xcell--protected': cell.index < resetPosition,
                   'con-colfocus__xcell--latching': cell.index === latchCell,
                   'con-colfocus__xcell--willprotect': buildPreview && cell.index === resetPosition,
                   'con-colfocus__xcell--settled': cell.index === settledCell,
                 }">
              <span class="con-colfocus__xcell-num">{{ cell.index + 1 }}</span>
              <!-- THE CARD LAUNCH CELL: a card payout physically separates
                   from the CARD BACK printed on the REWARD cell — the exact
                   glyph whose number the player just read — never from
                   «somewhere in the planet's area». Post-commit (when the
                   covers actually measure) the EFFECTIVE flag has already
                   collapsed with the spent offer, and the frozen MARKER cell
                   (presentedColonyModel holds the pre-reset position) IS the
                   cell the reward was paid at — so both flags anchor. -->
              <span class="con-colfocus__xcell-body"
                    :data-colony-card-cell="(cell.effective || cell.marker) ? colony.name : undefined">
                <span class="con-colfocus__xcell-glyph">
                  <BenefitGlyph :benefit="tradeBenefitAt(cell.index)" :idx="cell.index" :cardResource="metadata.cardResource" />
                </span>
                <b v-if="cell.quantity > 0" class="con-colfocus__xcell-qty">{{ cell.quantity }}</b>
                <span v-else class="con-colfocus__xcell-void">—</span>
              </span>
              <!-- THE MARKER RAIL SEAT — the glide's landing geometry. -->
              <span class="con-colfocus__xcell-rail" aria-hidden="true">
                <span class="con-colfocus__xcell-seat"
                      :data-colony-track-cell="colony.name + '#' + cell.index"></span>
                <!-- The GUARD: this position is held by a colony below. -->
                <span class="con-colfocus__xcell-guard"></span>
              </span>
            </div>

            <!-- THE STOP — the mechanical end of the return travel. It rides
                 `--stop-col`, so building a colony SLIDES it one cell right
                 (transform only) instead of re-rendering a new marker.
                 WORDLESS on purpose (iteration 4): the bracket + the anchor
                 under a real cell ARE the reading — a «ВОЗВРАТ» caption on
                 the scale (and a berth-row caption beside it) restated what
                 the graphic already draws. -->
            <span class="con-colfocus__stop" aria-hidden="true"></span>
            <span v-if="buildPreview && resetPositionAfterBuild !== resetPosition"
                  class="con-colfocus__stop con-colfocus__stop--ghost" aria-hidden="true"></span>
          </div>

          <!-- THE BERTHS — the physical foundation of the first three
               positions. There is deliberately nothing under cells 4…7: no
               colony can ever protect them, and the empty span says so. -->
          <div class="con-colfocus__berths" data-colony-focus-slots data-unfold-item>
            <div v-for="idx in [0, 1, 2]" :key="idx"
                 class="con-colfocus__berth"
                 :class="{
                   'con-colfocus__berth--taken': colony.colonies[idx] !== undefined,
                   'con-colfocus__berth--mine': colony.colonies[idx] === viewerColor,
                   'con-colfocus__berth--dest': buildPreview && idx === nextBuildSlot,
                   'con-colfocus__berth--latching': idx === latchCell,
                 }">
              <!-- The LATCH: an occupied berth is physically bolted to the
                   track cell above it. -->
              <span class="con-colfocus__berth-latch" aria-hidden="true"></span>
              <span class="con-colfocus__berth-seat"
                    :data-colony-build-slot="colony.name + '#' + idx"
                    data-colony-build-seat
                    :data-colony-bonus-source="colony.colonies[idx] !== undefined ? colony.name : undefined">
                <PlayerCube v-if="colony.colonies[idx] !== undefined" :color="colony.colonies[idx]" :size="44" />
                <BenefitGlyph v-else :benefit="buildBenefit" :idx="idx" :cardResource="metadata.cardResource" />
              </span>
              <!-- Only an OCCUPIED berth has something to say: an empty seat
                   already reads as empty, and «Свободное место» in a
                   one-column box could only ever be clipped. -->
              <span v-if="colony.colonies[idx] !== undefined" class="con-colfocus__berth-name" data-unfold-late>
                {{ ownerNameAt(idx) }}
              </span>
            </div>
            <!-- THE OWNER BONUS — the CONTINUATION of the ownership row, not a
                 card parked in the middle of the scene. It takes exactly the
                 span the berths do not: from past the third berth to the end
                 of the track, so «who stands here» and «what standing here
                 pays» are one horizontal statement, read left to right off the
                 same baseline.

                 It states the MECHANISM, and only the mechanism: the rate, and
                 — when a holder has more than one seat here — the arithmetic
                 drawn from the REAL tokens (`rate × the cubes you can see =
                 total`). WHO receives how much is the summary rail's sentence;
                 neither panel repeats the other's job. -->
            <div class="con-colfocus__ownerbonus"
                 :class="{'con-colfocus__ownerbonus--math': bonusMath !== undefined}"
                 :data-colony-bonus-source="owners.length === 0 ? colony.name : undefined">
              <span class="con-colfocus__ob-label" data-unfold-late>{{ $t('Owner bonus') }}</span>
              <!-- The BONUS card's own launch anchor — the bonus cover
                   separates from THIS zone's printed card, a beat after the
                   income wave (the two origins stay distinguishable). -->
              <span class="con-colfocus__ob-value" :data-colony-bonus-cell="colony.name">
                <b v-if="focusedBonusQty > 0">{{ focusedBonusQty }}</b>
                <span class="con-colfocus__rglyph con-colfocus__rglyph--lg">
                  <BenefitGlyph :benefit="colonyBenefit" :idx="0" :cardResource="metadata.cardResource" />
                </span>
              </span>
              <template v-if="bonusMath !== undefined">
                <span class="con-colfocus__ob-op" aria-hidden="true">×</span>
                <!-- The multiplier is not a number the player has to trust —
                     it is the very cubes seated in the berths to the left. -->
                <span class="con-colfocus__ob-tokens">
                  <PlayerCube v-for="n in bonusMath.count" :key="n" :color="bonusMath.color" :size="20" />
                </span>
                <span class="con-colfocus__ob-op" aria-hidden="true">=</span>
                <span class="con-colfocus__ob-total">
                  <b>{{ bonusMath.total }}</b>
                  <span class="con-colfocus__rglyph con-colfocus__rglyph--lg">
                    <BenefitGlyph :benefit="colonyBenefit" :idx="0" :cardResource="metadata.cardResource" />
                  </span>
                </span>
              </template>
              <span class="con-colfocus__ob-note" data-unfold-late>{{ $t('Each trade here') }}</span>
            </div>
          </div>
        </section>

        <!-- ── THE ACTION CONFIGURATION — adaptive by mode: never an empty
             «СПОСОБ ОПЛАТЫ» skeleton when there is nothing to choose. ── -->
        <section class="con-colfocus__config" data-unfold-item>
          <!-- SUB: the M€ lanes mix — the SHARED payment panel, expanded. -->
          <template v-if="sub === 'lanes' && paymentView !== undefined">
            <ConsolePaymentPanel :view="paymentView"
                                 mode="expanded"
                                 hint-mode="none"
                                 :focus-unit="payFocusUnit"
                                 :flash-nonce="payFlashNonce" />
          </template>

          <!-- SUB: track advance choice (IncreaseColonyTrack). -->
          <template v-else-if="sub === 'track' && trackStep !== undefined">
            <div class="con-colfocus__sub-title">{{ $t('Increase colony track before trade') }}</div>
            <div v-for="(opt, i) in trackOptions" :key="'tr' + i"
                 class="con-task__option"
                 :class="{
                   'con-task__option--focused': subIdx === i,
                   'con-colfocus__option--chosen': captures['track'] === opt.steps,
                 }"
                 :ref="subIdx === i ? 'focusedEl' : undefined">
              <div class="con-task__option-main">
                <span class="con-task__opt-title">{{ opt.title }}</span>
                <span class="con-colfocus__track-reward">
                  <span v-if="opt.quantity > 1" class="con-colfocus__track-rewardqty">{{ opt.quantity }}</span>
                  <BenefitGlyph :benefit="tradeBenefitAt(opt.position)" :idx="opt.position" :cardResource="metadata.cardResource" />
                </span>
                <span v-if="captures['track'] === opt.steps" class="con-colfocus__opt-check" aria-hidden="true">✓</span>
              </div>
            </div>
          </template>

          <!-- (The card-target pick is NOT a config sub-list any more: it is
               the EMBEDDED TARGET STEP — a deeper level of this same flow over
               the whole working area, hosting the SHARED played-card selector.
               See `__targetstage` below the config section.) -->

          <!-- TRADE REVIEW: payment paths + the follow-up decisions. -->
          <template v-else-if="intent === 'trade' && presentAvailable">
            <ConsoleScrollArea class="con-colfocus__configscroll" ref="scroll">
              <!-- The heading belongs to the ROWS, not to the mode: past the
                   commit the server takes the options away and a bare
                   «СПОСОБ ОПЛАТЫ» over nothing read as a broken panel. -->
              <div v-if="visiblePayEntries.length + visibleDisabledEntries.length > 0" class="con-colfocus__sec-title">{{ $t('Payment method') }}</div>
              <div v-for="entry in visiblePayEntries" :key="'p' + entry.index"
                   class="con-colfocus__payrow"
                   :class="{
                     'con-colfocus__payrow--focused': isFocused('pay', entry.index),
                     'con-colfocus__payrow--chosen': payIdx === entry.index,
                     // THE FEE IS FIXED by the entry (a card action walked in
                     // here), and a fixed fee is not a list: the other paths
                     // are not merely unpickable, they are unreachable, so
                     // showing them would be a menu that refuses every item.
                     // They are filtered out entirely — see `visiblePayEntries`.
                     'con-colfocus__payrow--locked': lockedPayIdx === entry.index,
                   }"
                   :ref="isFocused('pay', entry.index) ? 'focusedEl' : undefined">
                <span class="con-colfocus__payrow-pick" aria-hidden="true">
                  <span v-if="payIdx === entry.index" class="con-colfocus__payrow-dot"></span>
                </span>
                <i v-if="entry.iconClass !== ''" class="con-colfocus__payrow-icon" :class="entry.iconClass" aria-hidden="true"></i>
                <span class="con-colfocus__payrow-title">{{ entry.title }}</span>
                <span v-if="entry.preview !== ''" class="con-colfocus__payrow-delta">{{ entry.preview }}</span>
              </div>
              <div v-for="(d, i) in visibleDisabledEntries" :key="'d' + i" class="con-colfocus__payrow con-colfocus__payrow--off">
                <span class="con-colfocus__payrow-pick" aria-hidden="true"></span>
                <i v-if="d.iconClass !== ''" class="con-colfocus__payrow-icon" :class="d.iconClass" aria-hidden="true"></i>
                <span class="con-colfocus__payrow-title">{{ d.title }}</span>
                <span class="con-colfocus__payrow-reason">{{ d.reason }}</span>
              </div>
              <!-- PAST THE COMMIT the server takes the options away, but the
                   stage is still resolving the move the player made ON IT —
                   so it keeps showing WHAT WAS CHOSEN. Blanking the zone here
                   left a hole under a flying reward and read as the screen
                   forgetting the decision the moment it was taken. -->
              <div v-if="heldPayment !== undefined && payEntries.length === 0"
                   class="con-colfocus__payrow con-colfocus__payrow--chosen con-colfocus__payrow--locked">
                <span class="con-colfocus__payrow-pick" aria-hidden="true">
                  <span class="con-colfocus__payrow-dot"></span>
                </span>
                <i v-if="heldPayment.iconClass !== ''" class="con-colfocus__payrow-icon" :class="heldPayment.iconClass" aria-hidden="true"></i>
                <span class="con-colfocus__payrow-title">{{ heldPayment.title }}</span>
                <span v-if="heldPayment.preview !== ''" class="con-colfocus__payrow-delta">{{ heldPayment.preview }}</span>
              </div>

              <template v-if="stepRows.length > 0">
                <div class="con-colfocus__sec-title con-colfocus__sec-title--steps">{{ $t('Your choices') }}</div>
                <div v-for="(row, i) in stepRows" :key="row.key"
                     class="con-colfocus__steprow"
                     :class="{
                       'con-colfocus__steprow--focused': isFocused('step', i),
                       'con-colfocus__steprow--missing': rowMissing(row),
                     }"
                     :ref="isFocused('step', i) ? 'focusedEl' : undefined">
                  <div class="con-colfocus__steprow-label">{{ $t(row.label) }}</div>
                  <div class="con-colfocus__steprow-value">
                    <template v-if="row.kind === 'payment'">
                      <span v-if="paymentSummary !== ''">{{ paymentSummary }}</span>
                      <span v-else class="con-colfocus__steprow-empty">{{ $t('Configure payment') }}…</span>
                    </template>
                    <template v-else-if="row.kind === 'trackChoice'">
                      <span v-if="captures['track'] !== undefined">{{ trackSummary }}</span>
                      <span v-else class="con-colfocus__steprow-empty">{{ $t('Choose the track advance') }}…</span>
                    </template>
                    <template v-else-if="row.kind === 'cardTarget' && row.step !== undefined">
                      <i v-if="row.iconClass !== ''" class="con-colfocus__steprow-icon" :class="row.iconClass" aria-hidden="true"></i>
                      <span v-if="captures[row.key] !== undefined">{{ $t(String(captures[row.key])) }}</span>
                      <span v-else class="con-colfocus__steprow-empty">{{ $t('Choose a card') }}…</span>
                      <em v-if="captures[row.key] !== undefined">{{ targetImpact(row) }}</em>
                      <!-- The answered pick stays re-enterable: A on this row
                           re-opens the target step with the choice pre-locked
                           (B there keeps it — «Изменить», never «потерять»). -->
                      <span v-if="captures[row.key] !== undefined && isFocused('step', i)"
                            class="con-colfocus__steprow-change">{{ $t('Change selection') }}</span>
                    </template>
                  </div>
                </div>
              </template>
            </ConsoleScrollArea>
          </template>

          <!-- BUILD / PICK: NOTHING HERE EITHER — there is no configuration to
               make. The brief that used to stand here restated, word for word,
               what the summary rail says one column to the right («НАГРАДА ЗА
               ПОСТРОЙКУ +2», «НОВАЯ КОЛОНИЯ · Слот 1») while the destination
               berth was already lit on the row above and the verb was already
               under the planet and on the A chip: the same sentence in four
               places. It also cost the stage ~7rem of height it does not have
               inside a shorter host — a prelude's Build Colony step in the
               start workspace pushed it straight out of the frame. -->

          <!-- INSPECT / UNAVAILABLE: NOTHING. The dossier is the physical
               scene above — the track states every reward, the guard rail and
               the berths state the return rule, the result column states the
               colony's rate. A «how it works» panel here was a manual bolted
               onto a game surface: it appeared exactly when the player could
               NOT act, which made the screen change genre at the worst moment.
               The stage is simply SHORTER in this mode (see `--colfocus-h`). -->
          <template v-else />
        </section>
      </div>

      <!-- ═══ RESULT — «WHAT HAPPENS IF I CONFIRM NOW?», nothing else ═══
           ONE card per SOURCE of value, and ONLY sources this action moves:
           the trade income / the owners' cut / the payment — or the build
           grant / the new colony. Rules, the return point and the colony's
           standing rate are NOT restated here: the track and the guard rail
           above already carry them physically. The income's tight VALUE
           carries `data-colony-trade-source` — the reward chips and card
           covers leave that exact number. -->
      <!-- THE FOLLOW-UP'S OWN ZONE. It stands INSIDE the stage's frame, so a
           Pluto payout is not «cards flying over the old screen»: the
           configuration RELEASES in place, the zone UNFOLDS from the rect the
           configuration occupied, and the reveal's content surfaces from
           inside it (`consoleActionOutcomeMotion` — the same phrase the blue
           action flow speaks). The destination therefore exists, measured and
           on screen, before a single card moves. -->
      <section v-if="outcomeZone" class="con-colfocus__outcome"
               data-outcome-zone data-embed-slot="colonies-focus-reveal"></section>

      <!-- ═══ THE TARGET STEP — «куда положить награду» as a DEEPER LEVEL of
           this same flow. The planet stays the anchor (hero column untouched);
           the track, the configuration and the summary rail RELEASE in place
           (`--targeting`), and the SHARED played-card selector — the very
           surface the blue-action and play composers descend into — unfolds
           over the working area with physical candidate faces, ownership and
           the honest `current → resulting` on each. B folds back one level
           with every trade decision intact. -->
      <!-- (No ask line of our own: the selector's contract header already
           states the server's ask and the target scope — a second statement
           above it was the tripled-title screenshot.) -->
      <section v-if="sub === 'targets' && targetStepModel !== undefined && targetFocus !== undefined"
               class="con-colfocus__targetstage" ref="targetZone">
        <ConsolePlayedTargetStep ref="targetStep"
                                 :model="targetStepModel"
                                 :layout="targetLayout"
                                 :focus="targetFocus"
                                 :bandHeight="targetBandH"
                                 :lockedCard="targetLockedCard" />
      </section>

      <!-- ═══ THE PRESENTED TARGETS — the chosen host card(s), physically ON
           STAGE for the resolution. The reward chip is born at the income
           value in the summary rail (its launch anchor) and lands on the
           card's own stored-resource capsule; the counter is FROZEN at the
           pre-trade value and ticks — with a pop — at each touchdown:
           «было → прилетел → стало», never a number that silently changed.
           The scene recedes before the closing track glide (the conclusion
           waits for the working area through `stageBusy`). -->
      <section v-if="cardlandVisible" class="con-colfocus__cardland"
               :class="{'con-colfocus__cardland--leaving': cardlandReleased}"
               :data-cardland-count="presentedTargets.length">
        <div v-for="t in presentedTargets" :key="t.card"
             class="con-colfocus__landcell"
             :class="{'con-colfocus__landcell--landed': landedOf(t) > 0}"
             :data-played-key="t.card">
          <div class="con-colfocus__landcard">
            <ConsoleCardFaceLite :name="t.card" :card="presentedModelOf(t)" />
            <!-- Re-keyed per touchdown: each landed chip replays the one-shot
                 contact flash over the card's own counter capsule. -->
            <span v-if="landedOf(t) > 0" :key="'flash' + landedOf(t)"
                  class="con-colfocus__landflash" aria-hidden="true"></span>
          </div>
          <div class="con-colfocus__landmeta">
            <i v-if="t.icon !== ''" :class="rewardIconClass(t.icon)" aria-hidden="true"></i>
            <em>{{ t.before }} → {{ t.before + t.amount }}</em>
          </div>
        </div>
      </section>

      <section class="con-colfocus__result" data-unfold-item>
        <div class="con-colfocus__sec-title" data-unfold-late>{{ $t(resultTitle) }}</div>

        <!-- TRADE / INSPECT / PICK — THE REWARD PACKAGE. Three questions in
             the order a player asks them: what do I END UP with, what is that
             made of, and what does everyone else get. The middle block is the
             arithmetic made visible; the last one is deliberately OUTSIDE the
             total (it used to sit beside it, reading as part of the payout). -->
        <template v-if="intent !== 'build'">
          <div class="con-colfocus__rsec con-colfocus__rsec--lead">
            <div class="con-colfocus__rsec-label" data-unfold-late>{{ $t(presentAvailable && intent !== 'pick' ? 'Your total' : 'On the current level') }}</div>
            <div v-for="total in rewardPackage.totals" :key="total.key"
                 class="con-colfocus__rrow con-colfocus__rrow--gain con-colfocus__rrow--big">
              <span class="con-colfocus__rvalue">
                <b>+{{ total.amount }}</b>
                <span class="con-colfocus__rglyph con-colfocus__rglyph--lg"
                      :class="{'con-colfocus__rglyph--prod': total.production}">
                  <i v-if="total.icon !== undefined" :class="rewardIconClass(total.icon)" aria-hidden="true"></i>
                  <span v-else class="con-colfocus__rlabel">{{ $t(total.label ?? '') }}</span>
                </span>
              </span>
              <!-- The NUMBER when the viewer's stock has one, otherwise WHERE
                   it goes: «+2 животных» with no destination is an amount the
                   player cannot place. -->
              <em v-if="total.current !== undefined" data-unfold-late>{{ total.current }} → {{ total.resulting }}</em>
              <em v-else-if="total.destinationKey !== undefined" data-unfold-late>{{ $t(total.destinationKey) }}</em>
            </div>
            <div v-if="rewardPackage.totals.length === 0" class="con-colfocus__muted" data-unfold-late>{{ $t('No reward at this level') }}</div>
            <div v-if="resourceLost" class="con-colfocus__notice con-colfocus__notice--warn" data-unfold-late>
              <span aria-hidden="true">⚠</span>
              <span>{{ $t('Resource will be lost — no card') }}</span>
            </div>
          </div>

          <!-- THE COMPOSITION — where each part came from. The track's own
               value keeps `data-colony-trade-source`: the reward chips and
               card covers physically leave THAT number. -->
          <div v-if="rewardPackage.sources.length > 0" class="con-colfocus__rsec" data-unfold-late>
            <div class="con-colfocus__rsec-label">{{ $t('Reward breakdown') }}</div>
            <div v-for="row in rewardPackage.sources" :key="row.key" class="con-colfocus__rrow con-colfocus__rrow--part">
              <span class="con-colfocus__rpart">{{ sourceRowLabel(row) }}</span>
              <span class="con-colfocus__rvalue"
                    :data-colony-trade-source="row.kind === 'track' ? colony.name : undefined">
                <b>+{{ row.amount }}</b>
                <span class="con-colfocus__rglyph" :class="{'con-colfocus__rglyph--prod': row.production}">
                  <i v-if="row.icon !== undefined" :class="rewardIconClass(row.icon)" aria-hidden="true"></i>
                  <span v-else class="con-colfocus__rlabel">{{ $t(row.label ?? '') }}</span>
                </span>
              </span>
            </div>
            <!-- The chosen host card's own before → after, under the part it
                 explains (a card resource has no rail number of its own). -->
            <div v-for="line in targetOutcomeLines" :key="line.key" class="con-colfocus__rrow con-colfocus__rrow--target">
              <i v-if="line.iconClass !== ''" :class="line.iconClass" aria-hidden="true"></i>
              <span class="con-colfocus__rrow-card">{{ $t(line.card) }}</span>
              <em>{{ line.before }} → {{ line.after }}</em>
            </div>
          </div>

          <!-- THE OTHER OWNERS — what the trade pays everyone else. Their
               names, their amounts, and nothing of theirs in your total. -->
          <div class="con-colfocus__rsec" data-unfold-late>
            <div class="con-colfocus__rsec-label">{{ $t('To other players') }}</div>
            <div v-for="row in otherOwnerRows" :key="row.color" class="con-colfocus__rrow con-colfocus__rrow--gain">
              <span class="con-colfocus__rowner">
                <span :class="'con-status__dot player_bg_color_' + row.color"></span>
                <span>{{ row.name }}</span>
                <em v-if="row.count > 1">×{{ row.count }}</em>
              </span>
              <span class="con-colfocus__rvalue">
                <b>+{{ row.amount }}</b>
                <span class="con-colfocus__rglyph" :class="{'con-colfocus__rglyph--prod': row.production}">
                  <i v-if="row.icon !== undefined" :class="rewardIconClass(row.icon)" aria-hidden="true"></i>
                  <span v-else class="con-colfocus__rlabel">{{ $t(row.label ?? '') }}</span>
                </span>
              </span>
            </div>
            <div v-if="otherOwnerRows.length === 0" class="con-colfocus__muted">{{ $t('No other owners here') }}</div>
          </div>

          <div v-if="noticeRows.length > 0" class="con-colfocus__rsec" data-unfold-late>
            <div class="con-colfocus__rsec-label">{{ $t('Extras') }}</div>
            <div v-for="(notice, i) in noticeRows" :key="'n' + i"
                 class="con-colfocus__notice" :class="'con-colfocus__notice--' + notice.tone">
              <span aria-hidden="true">{{ notice.tone === 'warn' ? '!' : '›' }}</span>
              <i v-if="notice.iconClass !== ''" :class="notice.iconClass" aria-hidden="true"></i>
              <span>{{ notice.text }}</span>
            </div>
          </div>

          <div v-if="intent === 'trade' && presentAvailable && outcome.cost.length > 0"
               class="con-colfocus__rsec con-colfocus__rsec--pay" data-unfold-late>
            <div class="con-colfocus__rsec-label">{{ $t('Payment') }}</div>
            <div v-for="(chip, k) in outcome.cost" :key="'c' + k" class="con-colfocus__rrow con-colfocus__rrow--cost">
              <i v-if="chip.icon" :class="chipIconClass(chip)" aria-hidden="true"></i>
              <b>−{{ chip.amount }}</b>
              <em v-if="chip.current !== undefined">{{ chip.current }} → {{ chip.resulting }}</em>
            </div>
          </div>
        </template>

        <!-- BUILD: the placement grant, the new colony, the future bonus. -->
        <template v-else>
          <div class="con-colfocus__rsec con-colfocus__rsec--lead">
            <div class="con-colfocus__rsec-label" data-unfold-late>{{ $t('Build grant') }}</div>
            <div v-if="buildQty > 0" class="con-colfocus__rrow con-colfocus__rrow--gain con-colfocus__rrow--big">
              <span class="con-colfocus__rvalue" :data-colony-trade-source="colony.name">
                <b>+{{ buildQty }}</b>
                <span class="con-colfocus__rglyph con-colfocus__rglyph--lg">
                  <BenefitGlyph :benefit="buildBenefit" :idx="nextBuildSlot" :cardResource="metadata.cardResource" />
                </span>
              </span>
            </div>
            <div v-else class="con-colfocus__muted" data-unfold-late>{{ $t('No placement bonus') }}</div>
            <div v-if="buildLost" class="con-colfocus__notice con-colfocus__notice--warn" data-unfold-late>
              <span aria-hidden="true">⚠</span>
              <span>{{ $t('Resource will be lost — no card') }}</span>
            </div>
          </div>
          <div class="con-colfocus__rsec" data-unfold-late>
            <div class="con-colfocus__rsec-label">{{ $t('New colony') }}</div>
            <div class="con-colfocus__rrow">
              <PlayerCube v-if="viewerColor !== undefined" class="con-colfocus__rcube" :color="viewerColor" :size="18" />
              <span>{{ $t('Slot') }} {{ nextBuildSlot + 1 }}</span>
            </div>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The COLONY FOCUS STAGE — the ONE detail surface behind every overview verb
 * (A = act, X = inspect; intents `trade` / `build` / `pick` / `inspect`), and
 * — iteration 2 — the surface the action RESOLVES ON: the confirm keeps the
 * stage open, the fleet docks at the hero planet's orbital berth, the marker
 * glides along the expanded track, the rewards launch from their own result
 * groups and the build cube lands in the big destination slot.
 *
 * All numbers come from the same pure modules every colony surface reads
 * (`colonyTradePlan`, `paymentPlan`, the server `ColonyTradePreviewModel`) —
 * one source of truth; the presentation GROUPS them by source instead of
 * pouring them into one list.
 *
 * Input arrives via `handleIntent` (the shell routes the pad here while the
 * stage is open): d-pad walks payment/decision rows, A picks/opens (trade) or
 * CONFIRMS (build/pick — there is nothing else to choose), X = the one final
 * trade confirm, RT = max the focused lane, B = close a sub-editor / fold
 * back. The bar mirrors через consoleColoniesUi.
 */
import {defineComponent, PropType} from 'vue';
import {CardModel} from '@/common/models/CardModel';
import {ColonyModel} from '@/common/models/ColonyModel';
import {ColonyMetadata} from '@/common/colonies/ColonyMetadata';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {getCard} from '@/client/cards/ClientCardManifest';
import {ColonyName} from '@/common/colonies/ColonyName';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SelectOptionModel, OrOptionsModel} from '@/common/models/PlayerInputModel';
import {ColonyTradePreviewModel} from '@/common/models/ColonyTradePreviewModel';
import {Message} from '@/common/logs/Message';
import {SpendableResource} from '@/common/inputs/Spendable';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {translateMessage, translateText, translateTextWithParams, translateCardName} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {consoleColoniesUi, setColonyFocusStage, ColonyFocusIntent} from '@/client/console/consoleColoniesModel';
import {
  paymentLanes,
  megacreditsAvailable,
  paymentFromCounts,
  initialCounts,
  dialLaneCount,
  buildPaymentView,
  editableRows,
  PaymentLane,
  PaymentView,
} from '@/client/console/paymentPlan';
import {
  ColonyRewardPackage,
  RewardOtherRow,
  RewardSourceRow,
  TradeStep,
  colonyOwnerCounts,
  colonyRewardPackage,
  effectiveTradePosition,
  rewardAtPosition,
  tradeNotices,
  tradeOutcome,
  TradeOutcomeChip,
  trackResetAfterBuild,
  trackResetPosition,
  tradeSteps,
} from '@/client/components/colonies/colonyTradePlan';
import {presentedColonyModel, colonyTradeState, colonyTrackAdvancing, setColonyStageYielded} from '@/client/console/colonyTrade/consoleColonyTrade';
import {
  ColonyTradePresentedTarget, buildColonyTradeTargetModel, colonyTradeCardDestinations,
  presentedTargetModel,
} from '@/client/console/colonyTrade/colonyTradeTargetStep';
import {ColonyTradeTargets} from '@/client/console/colonyTrade/colonyTradeModel';
import {
  PlayedTargetCell, PlayedTargetFocus, PlayedTargetLayout, PlayedTargetModel, PlayedTargetNavDir,
  findPlayedTargetFocus, planPlayedTargetLayout, playedTargetAt, playedTargetSourceCardName,
  reseatPlayedTargetFocus, stepPlayedTargetFocus, stepPlayedTargetFocusAt, stepPlayedTargetOwner,
} from '@/client/console/played/consolePlayedTargetModel';
import {playedTargetZoomOrigin} from '@/client/console/played/consolePlayedTargetZoom';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {playColonyTargetStepEnter, playColonyTargetStepLeave} from '@/client/console/consoleColonyFocusMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {colonyBonusEntry, colonyResolutionUi, revealIsOwnerBonus} from '@/client/console/colonyTrade/colonyResolution';
import {cardColonyTradeCard, lockedTradePaymentIndex} from '@/client/console/colonyTrade/colonyTradeEntry';
import {cardDiscardColonyBonus} from '@/client/console/cardDiscard/consoleCardDiscard';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import {colonyBuildState} from '@/client/console/colonyBuild/consoleColonyBuild';
import {workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {
  armOutcomeOriginFrom, playConfigRelease, playOutcomePhase, playOutcomeContent,
} from '@/client/console/consoleActionOutcomeMotion';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

type PayEntry = {title: string, iconClass: string, preview: string};
type StepRow = {
  key: string,
  kind: 'payment' | 'trackChoice' | 'cardTarget',
  label: string,
  iconClass: string,
  step?: Extract<TradeStep, {kind: 'cardTarget'}>,
};
/**
 * How long the working area takes to come BACK once the payout leaves — the
 * `--handing` release transition in `console.less` (260 ms opacity / 320 ms
 * transform, the result rail 90 ms behind). The closing beat waits it out, so
 * the marker never launches into a fading track.
 */
const WORKING_AREA_BACK_MS = 340;
/** The landed reading's calm beat: the counter just ticked, the player sees
 *  the new number, THEN the presented scene gives the working area back. */
const CARDLAND_READ_MS = 680;

type Sub = undefined | 'lanes' | 'track' | 'targets';
type NoticeRow = {tone: 'warn' | 'info', iconClass: string, text: string};
type Focusable = {zone: 'pay' | 'step', index: number};
type TrackCell = {
  index: number,
  quantity: number,
  marker: boolean,
  effective: boolean,
  passed: boolean,
  /** The cell the marker falls back to after a trade (= built colonies). */
  reset: boolean,
};

export default defineComponent({
  name: 'ConsoleColonyFocusStage',
  components: {
    BenefitGlyph, ColonyFleetIcon, PlayerCube, ConsoleScrollArea, ConsolePaymentPanel,
    ConsolePlayedTargetStep, ConsoleCardFaceLite,
  },
  props: {
    colony: {type: Object as PropType<ColonyModel>, required: true},
    /** What the player came to DO (`consoleColoniesModel.ColonyFocusIntent`). */
    intent: {type: String as PropType<ColonyFocusIntent>, default: 'inspect'},
    /** The action is genuinely offerable HERE (server truth, per intent). */
    actionAvailable: {type: Boolean, default: false},
    /** Honest reason when the action is impossible ('' when available). */
    blockReason: {type: String, default: ''},
    /** The pick's server verb ('Build' / 'Remove colony' …, pick intent). */
    pickLabel: {type: String, default: ''},
    /**
     * The workspace holds an OUTCOME CLAIM and this stage is its host: the
     * stage gives the follow-up its own zone and steps back. The SECTION owns
     * the publication of the slot selector (one writer), so this prop is the
     * only thing the stage needs to know.
     */
    outcomeZone: {type: Boolean, default: false},
    /** The inner "Pay trade fee" OrOptions options (server-affordable). */
    options: {type: Array as PropType<ReadonlyArray<SelectOptionModel>>, default: () => []},
    disabledOptions: {type: Array as PropType<NonNullable<OrOptionsModel['disabledOptions']>>, default: () => []},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, default: () => []},
    preview: {type: Object as PropType<ColonyTradePreviewModel | undefined>, default: undefined},
    thisPlayer: {type: Object as PropType<PublicPlayerModel | undefined>, default: undefined},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    tradeOffset: {type: Number, default: 0},
  },
  emits: ['confirm', 'build-confirm', 'pick-confirm', 'cancel'],
  data() {
    return {
      payIdx: 0,
      focusIdx: 0,
      subIdx: 0,
      sub: undefined as Sub,
      captures: {} as Record<string, unknown>,
      /** The embedded target step's cursor (the shared selector's own shape). */
      targetFocus: undefined as PlayedTargetFocus | undefined,
      /** The target zone's measured box (the step's layout + height budget). */
      targetZoneW: 0,
      targetZoneH: 0,
      /**
       * THE PRESENTED TARGETS — the card-resource destinations of the
       * confirmed trade (picked + auto), snapshotted at the commit boundary
       * beside `heldView`. The resolution scene renders these as physical
       * faces; the transfer chips land on them; both read ONE list.
       */
      presentedTargets: [] as ReadonlyArray<ColonyTradePresentedTarget>,
      /** The presented scene has finished (all chips landed + a read beat, or
       *  a card payout took the area over) and is receding. */
      cardlandReleased: false,
      cardlandDwell: undefined as number | undefined,
      paymentCounts: {} as Partial<Record<SpendableResource, number>>,
      payFlashNonce: 0,
      tradeFleetState,
      colonyTradeState,
      colonyBuildState,
      workspaceOutcomeState,
      /** The remote-entry context (module reactive, mirrored for tracking). */
      bonusEntry: colonyBonusEntry,
      /** The resolution's presentation facts — the payout LIFT-OFF cue lives
       *  here (a module reactive must be mirrored in `data()` to be tracked). */
      resolutionUi: colonyResolutionUi,
      /** ONE-SHOT: the outcome handoff (config release + zone unfold) has
       *  played for the current claim — drives the `--handing` pose too, so
       *  the CSS dissolve can never run ahead of the phrase. */
      outcomeHandoffPlayed: false,
      /** The «working area is back» dwell (see the `workingAreaYielded` watcher). */
      stageBackTimer: undefined as number | undefined,
      /**
       * THIS STAGE SESSION HAS CROSSED THE COMMIT. Latched on `pastCommit`'s
       * rising edge and never dropped (a new colony / a fresh mount resets):
       * the resolution's final beats release `pastCommit`'s terms one at a
       * time, and the pre-commit verdict re-deriving in that gap is the red
       * «Здесь стоит ваш флот» flash over a payout the fleet just earned.
       */
      commitLatched: false,
      /** The last non-empty resolution context — held through the close so
       *  the hero keeps naming the SOURCE role to the final frame. */
      heldContext: undefined as {roleKey: string, bonus: boolean, traderColor: string, traderLine: string} | undefined,
      /**
       * The COMMIT-BOUNDARY freeze: at the confirm the stage pins WHAT it was
       * showing ({mode, available}), because the server's answer flips the
       * props (the pick is gone, the trade is spent) while the resolution is
       * still physically playing on this stage — recomputing live re-titled
       * the crumb «Осмотр» and swapped the verdict under a flying cube.
       * Released by the transaction's own falling edge, never a timer.
       */
      heldView: undefined as {mode: string, available: boolean, payment?: PayEntry} | undefined,
    };
  },
  computed: {
    colonyName(): ColonyName {
      return this.colony.name as ColonyName;
    },
    /** The action is RESOLVING on this stage (fleet flying / rewards landing
     *  / marker gliding / the BUILD cube seating) — chrome inert, anchors
     *  live, nothing folds. */
    resolving(): boolean {
      return (this.tradeFleetState.active && this.tradeFleetState.colonyName === this.colony.name) ||
        (this.colonyTradeState.active && this.colonyTradeState.colonyName === this.colony.name) ||
        (this.colonyBuildState.active && this.colonyBuildState.colonyName === this.colony.name);
    },
    /**
     * THE SOURCE CONTEXT of the running resolution (the hero's chip). The
     * role advances with the waves — trade income first, then the owner
     * bonus (the batch's own `role` tag / the discard step both say so) —
     * and a REMOTE entry (another player's trade) names that player from
     * the fleet parked on the colony. `undefined` pre-commit: the verdict
     * owns that space.
     */
    resolutionContext(): {roleKey: string, bonus: boolean, traderColor: string, traderLine: string} | undefined {
      const isEntry = this.bonusEntry.colonyName === this.colony.name;
      const claimed = this.workspaceOutcomeState.host === 'colonies' &&
        this.workspaceOutcomeState.sourceCard === this.colony.name;
      const own = this.colonyTradeState.active && this.colonyTradeState.colonyName === this.colony.name;
      if (!isEntry && !claimed && !own) {
        return undefined;
      }
      if (isEntry) {
        const line = this.bonusEntry.traderName !== '' ?
          translateTextWithParams('${0} traded with this colony', [this.bonusEntry.traderName]) : '';
        return {roleKey: 'Owner bonus triggered', bonus: true, traderColor: this.bonusEntry.traderColor, traderLine: line};
      }
      const bonusWave = revealIsOwnerBonus(currentRevealEvent()?.source) ||
        cardDiscardColonyBonus() !== undefined;
      if (bonusWave) {
        return {roleKey: 'Owner bonus', bonus: true, traderColor: '', traderLine: ''};
      }
      // A BUILD's payout is the PLACEMENT bonus, not trade income. Keyed on the
      // stage's own intent rather than on the build transaction, which ends at
      // the commit while its cards are still on the table — the label would
      // otherwise turn into «Торговая награда» halfway through a payout no
      // trade produced. (Only readable at all since the stage now stays up
      // through the flight, which is exactly when the player reads it.)
      const build = this.intent === 'build';
      return {
        roleKey: build ? 'Colony placement bonus' : 'Trade reward',
        bonus: false, traderColor: '', traderLine: '',
      };
    },
    /**
     * What the SOURCE chip actually shows: the live context, or — past the
     * commit — the LAST one, held to the final frame. The live derivation's
     * terms (transaction, claim, entry) release one signal at a time at the
     * resolution's end, and the chip vanishing a second before the workspace
     * closes read as the screen forgetting whose payout it just presented.
     */
    presentedContext(): {roleKey: string, bonus: boolean, traderColor: string, traderLine: string} | undefined {
      return this.resolutionContext ?? (this.commitLatched ? this.heldContext : undefined);
    },
    /**
     * THE HANDOFF CUE — when the configuration may let go. ⚠️ Deliberately NOT
     * the claim (the submit), and — iteration 4 — deliberately NOT the covers'
     * take-off either: the fan and the departures play OVER the still-standing
     * scene (the player must read the count and the source), and only the
     * layer's `ascend` beat — the first cover deep into its travel, almost
     * grown — starts the dissolve underneath. Releasing at `fly` was
     * «интерфейс уже исчез в момент отделения карт».
     *  · or — for a flow with no covers of its own (a build's board lift, a
     *    served remote batch, reduced motion, a degrade) — the content
     *    genuinely landing in the zone is the cue.
     */
    outcomeHandoffDue(): boolean {
      if (!this.outcomeZone) {
        return false;
      }
      // THE TRACK IS STILL MOVING. The payout is a CONSEQUENCE of the marker
      // arriving at the cell it is read at, so nothing of it — least of all
      // this dissolve — may begin while the marker is still crossing the very
      // track it would take with it. (`outcomeContentIn` goes true as soon as
      // the batch teleports into the zone, which is exactly mid-glide: the
      // reveal was mounting, veiled, while the interface evaporated under a
      // marker still in flight.)
      if (colonyTrackAdvancing() && this.colonyTradeState.colonyName === this.colony.name) {
        return false;
      }
      // THE CARDS ARE ON THE MOVE — the one fact every cover scene raises
      // (`colonyResolutionUi.payoutLiftOff`): the trade's covers at their
      // separation, the build's cover-lift when its proxies take over. The
      // stage dissolves WITH them, over the whole rise-and-turn, which is what
      // makes the departure one phrase instead of a cut. Per-scene phase
      // reads are deliberately gone: the build path had none, so its stage
      // could only let go once the cards had already landed.
      if (this.resolutionUi.payoutLiftOff) {
        return true;
      }
      if (this.colonyTradeState.active &&
          this.colonyTradeState.colonyName === this.colony.name &&
          (this.colonyTradeState.cardScene === 'ascend' ||
            this.colonyTradeState.cardScene === 'frame' ||
            this.colonyTradeState.cardScene === 'handoff')) {
        return true;
      }
      return this.outcomeContentIn;
    },
    /** The availability the stage PRESENTS — pinned across the commit
     *  boundary (see `heldView`), live everywhere else. */
    presentAvailable(): boolean {
      return this.heldView !== undefined ? this.heldView.available : this.actionAvailable;
    },
    /** The payment path the player actually chose, pinned at the commit —
     *  what the config zone keeps showing while the trade resolves. */
    heldPayment(): PayEntry | undefined {
      return this.heldView?.payment;
    },
    /** The presentation mode the adaptive layout keys off. */
    presentMode(): string {
      if (this.heldView !== undefined) {
        return this.heldView.mode;
      }
      if (this.intent === 'build') {
        return this.actionAvailable ? 'build' : 'inspect';
      }
      if (this.intent === 'trade') {
        return this.actionAvailable ? 'trade' : 'inspect';
      }
      if (this.intent === 'pick') {
        return 'pick';
      }
      return 'inspect';
    },
    resultTitle(): string {
      if (this.intent === 'build') {
        return 'Build outcome';
      }
      // Pick / inspect: the first group inside is ALREADY labelled «On the
      // current level» — repeating it as the section title read as a stutter
      // (the 4K removal-pick frame). The section states its subject instead.
      return this.intent === 'trade' && this.presentAvailable ? 'Trade outcome' : 'Colony rewards';
    },
    metadata(): ColonyMetadata {
      return getColony(this.colony.name);
    },
    planetClass(): string {
      return this.colony.name.replace(' ', '-') + '-background';
    },
    presented(): ColonyModel {
      return presentedColonyModel(this.colony);
    },
    trackMax(): number {
      return this.metadata.trade.quantity.length - 1;
    },
    effectivePosition(): number {
      const offset = this.colony.isActive ? this.tradeOffset : 0;
      return effectiveTradePosition(this.presented, this.metadata, offset);
    },
    offsetSteps(): number {
      return Math.max(0, this.effectivePosition - this.markerPosition);
    },
    /** The marker's DISPLAYED position — the presented one, so a committed
     *  reset stays frozen behind the transaction and only the glide moves it
     *  (the same `presentedColonyModel` the overview tile reads). */
    markerPosition(): number {
      return Math.min(this.presented.trackPosition, this.trackMax);
    },
    /** How many colonies stand here — the ONE number the reset rule reads. */
    builtCount(): number {
      return this.colony.colonies.length;
    },
    /**
     * THE RULE, as a number: after a trade the track falls back to the
     * BUILT-COLONY COUNT (`Colony.trade()` → `trackPosition = colonies.length`).
     * The return base is therefore an index into the very same track, which is
     * why the stage can draw it as an anchor under a real cell instead of
     * explaining it in prose.
     */
    resetPosition(): number {
      return trackResetPosition(this.colony, this.metadata);
    },
    /** Where the base would move if a colony were built here right now. */
    resetPositionAfterBuild(): number {
      return trackResetAfterBuild(this.colony, this.metadata);
    },
    /** The build preview is LIVE (build intent, genuinely offerable). */
    buildPreview(): boolean {
      return this.intent === 'build' && this.presentAvailable && this.builtCount < 3;
    },
    /**
     * The cell/berth pair currently being LATCHED by a landing build — the
     * one-shot beat that makes «I just protected this position» a physical
     * event rather than a number that silently changed. Driven by the build
     * transaction's own phase, never a timer.
     */
    latchCell(): number {
      const b = this.colonyBuildState;
      if (!b.active || b.colonyName !== this.colony.name) {
        return -1;
      }
      return b.phase === 'landed' || b.phase === 'done' ? b.slotIndex : -1;
    },
    /** This colony's marker is mid-glide — the resting marker yields to the
     *  flying proxy (the overview tile's `--marker-gliding` contract, now
     *  honoured on the stage the trade actually resolves on). */
    trackGliding(): boolean {
      return this.colonyTradeState.phase === 'glide' && this.colonyTradeState.colonyName === this.colony.name;
    },
    /** The teleported follow-up has actually landed in our zone. */
    outcomeContentIn(): boolean {
      return this.outcomeZone && this.workspaceOutcomeState.stage === 'presenting';
    },
    /**
     * IS THE PAYOUT STANDING ON OUR WORKING AREA RIGHT NOW?
     *
     * The handoff is one-shot (`outcomeHandoffPlayed` — the phrase plays once
     * per claim), but the POSE is not: `--handing` takes
     * `.con-colfocus__main` to `opacity: 0`, and the TRACK is drawn there. The
     * claim outlives the batch by design (the resolution owns the workspace
     * until the reset commits), so keeping the pose on the claim left the
     * colony blank for the closing beat — the white marker glided across an
     * invisible track. The pose therefore rides the payout ITSELF: while a
     * reveal batch is on the table (or on its way), and not a frame longer.
     */
    workingAreaYielded(): boolean {
      return this.outcomeZone && this.outcomeHandoffPlayed &&
        currentRevealEvent() !== undefined;
    },
    /**
     * THE COMMIT BOUNDARY, as this stage sees it: the move is being made or
     * has been made. Everything that answers «can I do this?» — the verdict
     * chip, the availability dot — belongs strictly BEFORE it; everything
     * after describes what happened.
     */
    pastCommit(): boolean {
      return this.resolving || this.outcomeZone || this.heldView !== undefined;
    },
    /** One-shot: the cell the reset marker just landed on (the settle glow). */
    settledCell(): number {
      return this.colonyTradeState.colonyName === this.colony.name ? this.colonyTradeState.settledCell : -1;
    },
    trackCells(): Array<TrackCell> {
      const marker = this.markerPosition;
      const reset = this.resetPosition;
      const cells: Array<TrackCell> = [];
      for (let i = 0; i <= this.trackMax; i++) {
        cells.push({
          index: i,
          quantity: this.metadata.trade.quantity[i] ?? 0,
          marker: i === marker,
          effective: i === this.effectivePosition && this.effectivePosition !== marker,
          passed: i < marker,
          reset: i === reset,
        });
      }
      return cells;
    },
    buildBenefit(): {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown} {
      const b = this.metadata.build;
      return {type: b.type, quantity: b.quantity, resource: Array.isArray(b.resource) ? b.resource[0] : b.resource};
    },
    colonyBenefit(): {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown} {
      const c = this.metadata.colony;
      return {type: c.type, quantity: [c.quantity ?? 1], resource: c.resource};
    },
    focusedBonusQty(): number {
      return this.metadata.colony.quantity ?? 1;
    },
    nextBuildSlot(): number {
      return Math.min(this.colony.colonies.length, 2);
    },
    buildQty(): number {
      return this.metadata.build.quantity[this.nextBuildSlot] ?? 0;
    },
    buildLost(): boolean {
      return this.benefitResourceLost(this.metadata.build.type);
    },
    owners(): Array<{color: Color, count: number, name: string}> {
      return colonyOwnerCounts(this.colony).map((owner) => {
        const player = this.players.find((p) => p.color === owner.color);
        return {...owner, name: player !== undefined ? participantDisplayName(player) : owner.color};
      });
    },
    /**
     * THE ARITHMETIC WORTH DRAWING. A single seat needs none — the rate IS the
     * payout, and «1 ×» is noise. It appears only where the number genuinely
     * differs from the rate, and it belongs to ONE holder: the viewer when
     * they stand here (it is their bonus), otherwise the largest holder (the
     * one whose stake the scene has to explain).
     */
    bonusMath(): {color: Color, count: number, total: number} | undefined {
      const mine = this.viewerColor === undefined ?
        undefined :
        this.owners.find((o) => o.color === this.viewerColor);
      const subject = mine ?? [...this.owners].sort((a, b) => b.count - a.count)[0];
      if (subject === undefined || subject.count < 2 || this.focusedBonusQty <= 0) {
        return undefined;
      }
      return {color: subject.color, count: subject.count, total: subject.count * this.focusedBonusQty};
    },
    visitorLine(): string {
      const visitor = this.colony.visitor;
      if (visitor === undefined) {
        return '';
      }
      if (visitor === this.viewerColor) {
        return translateText('Your trade fleet is currently here');
      }
      const player = this.players.find((p) => p.color === visitor);
      if (player !== undefined) {
        return translateTextWithParams('Trade fleet of ${0} is currently here', [participantDisplayName(player)]);
      }
      return translateText('Trade fleet currently here');
    },
    payEntries(): Array<PayEntry> {
      return this.options.map((o) => {
        const meta = o.metadata;
        const res = meta?.resource;
        return {
          title: textOf(o.title),
          iconClass: meta?.icon !== undefined ? iconClassFor(meta.icon) + ' con-task__opt-res' : '',
          preview: res !== undefined ? `${res.current} → ${res.resulting}` : '',
        };
      });
    },
    disabledEntries(): Array<{title: string, iconClass: string, reason: string}> {
      return this.disabledOptions.map((d) => {
        const rec = d as {title?: string | Message, label?: string | Message, reason?: string | Message, metadata?: {icon?: string, resource?: {current: number}}};
        const current = rec.metadata?.resource?.current;
        const title = textOf(rec.title ?? rec.label);
        return {
          title: current !== undefined ? `${title} · ${current}` : title,
          iconClass: rec.metadata?.icon !== undefined ? iconClassFor(rec.metadata.icon) + ' con-task__opt-res' : '',
          reason: textOf(rec.reason),
        };
      });
    },
    /**
     * THE PATHS THE PLAYER CAN ACTUALLY TAKE.
     *
     * With the fee fixed by the entry there is exactly one, and the rest are
     * not choices at all — a card action walked in through THIS path and
     * cannot switch. A dimmed list of four would be a menu whose every other
     * item refuses the press; the header already says where the trade came
     * from, and that is the whole explanation the player needs.
     *
     * The original index rides along: `payIdx`, the focus ring and the submit
     * all speak the SERVER's option order, and a filtered list must never
     * renumber it.
     */
    visiblePayEntries(): Array<PayEntry & {index: number}> {
      const rows = this.payEntries.map((entry, index) => ({...entry, index}));
      return this.lockedPayIdx >= 0 ? rows.filter((r) => r.index === this.lockedPayIdx) : rows;
    },
    /** …and a REFUSED path is equally irrelevant once the fee is fixed. */
    visibleDisabledEntries(): Array<{title: string, iconClass: string, reason: string}> {
      return this.lockedPayIdx >= 0 ? [] : this.disabledEntries;
    },
    /**
     * THE FEE IS FIXED — this trade was entered from a card's own action, so
     * its payment path is the entry, not a decision. `-1` = the ordinary
     * «Колонии» entry, where every path is the player's to pick.
     *
     * Resolved from the option's `metadata.card`, never its label.
     */
    lockedPayIdx(): number {
      return lockedTradePaymentIndex(this.options, cardColonyTradeCard());
    },
    isMcSelected(): boolean {
      return this.options[this.payIdx]?.metadata?.icon === 'megacredits';
    },
    tradeConfigLive(): boolean {
      return this.intent === 'trade' && this.presentAvailable;
    },
    steps(): Array<TradeStep> {
      return this.tradeConfigLive ? tradeSteps(this.preview, this.isMcSelected) : [];
    },
    stepKeys(): Array<string> {
      let target = 0;
      return this.steps.map((step) => {
        if (step.kind === 'payment') {
          return 'payment';
        }
        if (step.kind === 'trackChoice') {
          return 'track';
        }
        return `target:${target++}`;
      });
    },
    stepRows(): Array<StepRow> {
      return this.steps.map((step, i) => {
        const key = this.stepKeys[i];
        if (step.kind === 'payment') {
          return {key, kind: 'payment' as const, label: 'Payment', iconClass: ''};
        }
        if (step.kind === 'trackChoice') {
          return {key, kind: 'trackChoice' as const, label: 'Colony track', iconClass: ''};
        }
        return {
          key,
          kind: 'cardTarget' as const,
          label: step.role === 'tradeReward' ? 'Trade reward target' : 'Colony bonus target',
          iconClass: this.resourceIconClass(step.resource),
          step,
        };
      });
    },
    focusables(): Array<Focusable> {
      if (!this.tradeConfigLive) {
        return [];
      }
      // A LOCKED fee is not a choice, so it is not a cursor stop: the entry
      // came through the card that pays, and «выбрать другой способ» would be
      // a control that refuses every press. The rows still RENDER (the player
      // sees the whole structure of the trade) — they just cannot be reached.
      const out: Array<Focusable> = this.lockedPayIdx >= 0 ?
        [] : this.payEntries.map((_, i) => ({zone: 'pay' as const, index: i}));
      this.stepRows.forEach((_, i) => out.push({zone: 'step', index: i}));
      return out;
    },
    focused(): Focusable | undefined {
      return this.focusables[this.focusIdx];
    },
    trackStep(): Extract<TradeStep, {kind: 'trackChoice'}> | undefined {
      const step = this.steps.find((s) => s.kind === 'trackChoice');
      return step?.kind === 'trackChoice' ? step : undefined;
    },
    trackOptions(): Array<{steps: number, position: number, quantity: number, title: string}> {
      const step = this.trackStep;
      const current = this.preview?.track.current ?? 0;
      if (step === undefined) {
        return [];
      }
      const options: Array<{steps: number, position: number, quantity: number, title: string}> = [];
      for (let n = step.steps; n >= 0; n--) {
        const position = Math.min(current + n, this.metadata.trade.quantity.length - 1);
        options.push({
          steps: n,
          position,
          quantity: rewardAtPosition(this.metadata, position).quantity,
          title: n > 0 ?
            translateTextWithParams('Increase colony track ${0} step(s)', [String(n)]) :
            translateText('Don\'t increase colony track'),
        });
      }
      return options;
    },
    trackSummary(): string {
      const chosen = this.captures['track'];
      if (typeof chosen !== 'number') {
        return '';
      }
      return chosen > 0 ?
        translateTextWithParams('Advance ${0} step(s)', [String(chosen)]) :
        translateText('Don\'t increase colony track');
    },
    activeTargetStep(): Extract<TradeStep, {kind: 'cardTarget'}> | undefined {
      const focused = this.focused;
      if (focused?.zone !== 'step') {
        return undefined;
      }
      const row = this.stepRows[focused.index];
      return row?.kind === 'cardTarget' ? row.step : undefined;
    },
    activeTargetKey(): string {
      const focused = this.focused;
      return focused?.zone === 'step' ? (this.stepRows[focused.index]?.key ?? '') : '';
    },
    targetSubTitle(): string {
      const step = this.activeTargetStep;
      if (step === undefined) {
        return '';
      }
      return textOf(step.pick.title) || translateText('Choose a card');
    },
    /**
     * THE SHARED SELECTOR'S MODEL for the focused card-target step — the same
     * pure model the blue-action and play composers build, translated from the
     * trade preview's own shapes (`buildColonyTradeTargetModel`). No
     * `sourceCardName`: the hero of this stage is the PLANET, so every
     * candidate renders as its own physical face and the «ЭТА КАРТА» proxy
     * never appears here.
     */
    targetStepModel(): PlayedTargetModel | undefined {
      const step = this.activeTargetStep;
      if (step === undefined || this.viewerColor === undefined) {
        return undefined;
      }
      return buildColonyTradeTargetModel({
        step,
        ask: this.targetSubTitle,
        players: this.players,
        viewerColor: this.viewerColor,
        typeOf: (name) => getCard(name)?.type,
        resourceOf: (name) => getCard(name)?.resourceType,
      });
    },
    targetLayout(): PlayedTargetLayout {
      return planPlayedTargetLayout({
        owners: this.targetStepModel?.owners ?? [],
        availW: this.targetZoneW > 0 ? this.targetZoneW : 900,
        ui: conUiScale(),
        handheld: consoleLayoutState.profile === 'handheld',
      });
    },
    /** The step's vertical budget — the zone IS the room (its own contract
     *  header and rail are part of the step and already in its budget). */
    targetBandH(): number {
      return Math.max(0, this.targetZoneH);
    },
    targetLockedCard(): string {
      const captured = this.captures[this.activeTargetKey];
      return typeof captured === 'string' ? captured : '';
    },
    /**
     * THE PRESENTED SCENE IS UP — the chosen host card(s) own the working
     * area while the reward physically arrives. It stands from the commit
     * (the fleet is still flying — the player reads WHERE the reward will
     * land) and yields the moment a CARD payout takes the area over
     * (`workingAreaYielded` — the covers' scene outranks it).
     */
    cardlandVisible(): boolean {
      return this.presentedTargets.length > 0 && this.pastCommit && !this.workingAreaYielded;
    },
    /** …and while it stands unreleased it BLOCKS the closing beat: the track
     *  is drawn under it, and a marker gliding under a standing scene is the
     *  same fault the payout pose already guards (`stageBusy`). */
    cardlandHolds(): boolean {
      return this.cardlandVisible && !this.cardlandReleased;
    },
    /**
     * THE ONE «working area is busy» fact the conclusion waits on — the card
     * payout standing in the outcome zone OR the presented-target scene. The
     * closing track glide may start only once BOTH have receded (published
     * through `setColonyStageYielded`, with the pose's own return dwell).
     */
    stageBusy(): boolean {
      return this.workingAreaYielded || this.cardlandHolds;
    },
    /** Every presented card has received its full landing tally. */
    cardlandAllLanded(): boolean {
      return this.presentedTargets.length > 0 &&
        this.presentedTargets.every((t) => this.landedOf(t) >= t.amount);
    },
    paymentStep(): Extract<TradeStep, {kind: 'payment'}> | undefined {
      const step = this.steps.find((s) => s.kind === 'payment');
      return step?.kind === 'payment' ? step : undefined;
    },
    payLanes(): ReadonlyArray<PaymentLane> {
      const step = this.paymentStep;
      const player = this.thisPlayer;
      return step === undefined || player === undefined ? [] : paymentLanes(step.model, player);
    },
    paymentView(): PaymentView | undefined {
      const step = this.paymentStep;
      const player = this.thisPlayer;
      if (step === undefined || player === undefined) {
        return undefined;
      }
      return buildPaymentView({
        cost: step.model.amount,
        lanes: this.payLanes,
        counts: this.paymentCounts,
        mcAvailable: megacreditsAvailable(player),
      });
    },
    payFocusUnit(): string | undefined {
      const v = this.paymentView;
      return v === undefined || this.sub !== 'lanes' ? undefined : editableRows(v)[this.subIdx]?.unit;
    },
    paymentSummary(): string {
      const view = this.paymentView;
      if (view === undefined) {
        return '';
      }
      const parts: Array<string> = [];
      for (const row of view.rows) {
        if (row.auto) {
          continue;
        }
        if (row.used > 0) {
          parts.push(`${row.used} ${translateText(row.labelKey)}`);
        }
      }
      const mc = view.rows.find((r) => r.auto)?.used ?? 0;
      if (mc > 0 || parts.length === 0) {
        parts.push(`${mc} M€`);
      }
      return parts.join(' + ');
    },
    rewardPosition(): number {
      const track = this.preview?.track;
      const chosen = this.captures['track'];
      if (typeof chosen === 'number') {
        const current = track?.current ?? this.colony.trackPosition;
        return Math.min(current + chosen, this.metadata.trade.quantity.length - 1);
      }
      if (track !== undefined) {
        return track.effective;
      }
      return this.effectivePosition;
    },
    ownColonyCount(): number {
      if (this.viewerColor === undefined) {
        return 0;
      }
      return this.colony.colonies.filter((c) => c === this.viewerColor).length;
    },
    outcome(): {cost: Array<TradeOutcomeChip>, gains: Array<TradeOutcomeChip>} {
      const player = this.thisPlayer;
      const meta = this.tradeConfigLive ? this.options[this.payIdx]?.metadata : undefined;
      const payment = meta?.icon !== undefined && meta.amount !== undefined ?
        // `resource` rides along: for a CARD-paid fee it is the ONLY source of
        // the before → after (the viewer's rail has no floaters on it).
        {icon: meta.icon, amount: meta.amount, resource: meta.resource} :
        undefined;
      return tradeOutcome({
        metadata: this.metadata,
        rewardPosition: this.rewardPosition,
        payment,
        ownColonyCount: this.ownColonyCount,
        flatBonuses: this.preview?.flatBonuses,
        stocks: player !== undefined ? {
          megacredits: player.megacredits,
          steel: player.steel,
          titanium: player.titanium,
          plants: player.plants,
          energy: player.energy,
          heat: player.heat,
        } : {},
        production: player !== undefined ? {
          megacredits: player.megacreditProduction,
          steel: player.steelProduction,
          titanium: player.titaniumProduction,
          plants: player.plantProduction,
          energy: player.energyProduction,
          heat: player.heatProduction,
        } : {},
      });
    },
    /**
     * THE REWARD PACKAGE the summary rail renders — «ВАШ ИТОГ» / «СОСТАВ
     * НАГРАДЫ» / «ДРУГИМ ИГРОКАМ», all three from the ONE pure derivation
     * every colony surface shares (`colonyRewardPackage`).
     */
    rewardPackage(): ColonyRewardPackage {
      return colonyRewardPackage({
        gains: this.outcome.gains,
        metadata: this.metadata,
        colony: this.colony,
        viewer: this.viewerColor,
      });
    },
    /** The other owners' rows with their display names resolved. */
    otherOwnerRows(): Array<RewardOtherRow & {name: string}> {
      return this.rewardPackage.others.map((row) => {
        const player = this.players.find((p) => p.color === row.color);
        return {...row, name: player !== undefined ? participantDisplayName(player) : row.color};
      });
    },
    targetOutcomeLines(): Array<{key: string, card: string, amount: number, before: number, after: number, iconClass: string}> {
      const lines: Array<{key: string, card: string, amount: number, before: number, after: number, iconClass: string}> = [];
      let ordinal = -1;
      for (const row of this.stepRows) {
        if (row.kind !== 'cardTarget' || row.step === undefined) {
          continue;
        }
        ordinal++;
        const captured = this.captures[row.key];
        const name = typeof captured === 'string' ? captured : undefined;
        const card = row.step.pick.cards.find((c) => c.name === name);
        if (card === undefined) {
          continue;
        }
        const before = card.resources ?? 0;
        lines.push({
          key: `line:${ordinal}`,
          card: card.name,
          amount: row.step.amount,
          before,
          after: before + row.step.amount,
          iconClass: row.iconClass,
        });
      }
      return lines;
    },
    resourceLost(): boolean {
      return this.benefitResourceLost(this.metadata.trade.type);
    },
    noticeRows(): Array<NoticeRow> {
      if (!this.tradeConfigLive) {
        return [];
      }
      const rows: Array<NoticeRow> = [];
      for (const notice of tradeNotices(this.preview)) {
        if (notice.kind === 'autoTarget') {
          rows.push({
            tone: 'info',
            iconClass: this.resourceIconClass(notice.resource),
            text: translateTextWithParams('+${0} to ${1} (the only eligible card)', [String(notice.amount), translateText(notice.card)]),
          });
        } else if (notice.kind === 'lostResource') {
          rows.push({
            tone: 'warn',
            iconClass: this.resourceIconClass(notice.resource),
            text: translateText('No eligible card — this resource is not added.'),
          });
        } else {
          rows.push({tone: 'info', iconClass: '', text: translateText(notice.note)});
        }
      }
      return rows;
    },
    canConfirm(): boolean {
      if (!this.actionAvailable) {
        return false;
      }
      if (this.intent === 'build' || this.intent === 'pick') {
        return true;
      }
      if (this.intent !== 'trade') {
        return false;
      }
      if (this.paymentView !== undefined && !this.paymentView.status.ok) {
        return false;
      }
      return this.steps.every((step, i) => {
        if (step.kind === 'payment') {
          return true;
        }
        return this.captures[this.stepKeys[i]] !== undefined;
      });
    },
    focusedRowEditable(): boolean {
      const focused = this.focused;
      if (focused === undefined) {
        return false;
      }
      if (focused.zone === 'pay') {
        return true;
      }
      const row = this.stepRows[focused.index];
      if (row === undefined) {
        return false;
      }
      if (row.kind === 'payment') {
        return this.payLanes.length > 0;
      }
      return true;
    },
  },
  watch: {
    isMcSelected() {
      this.seedPaymentDefault();
    },
    preview() {
      this.seedPaymentDefault();
      // THE GAME STATE MOVED UNDER A CAPTURE. The preview is the candidates'
      // source of truth, so a fresh one INVALIDATES anything it no longer
      // offers: a captured target whose card left the eligible set is dropped
      // (the row returns to «Выберите карту…», the confirm re-locks), and a
      // vanished track choice goes with its step. Silently submitting a stale
      // pick — or showing it as still chosen — is the one forbidden outcome.
      this.pruneStaleCaptures();
      this.syncUiMirror();
    },
    sub() {
      this.publishStageName();
      this.syncUiMirror();
    },
    canConfirm() {
      this.syncUiMirror();
    },
    // The fee options arrive with the prompt, which can land a frame after the
    // stage mounts (and re-lands on every response) — re-pin, never re-seed.
    lockedPayIdx: {
      immediate: true,
      handler() {
        this.syncLockedPayment();
      },
    },
    focusedRowEditable() {
      this.syncUiMirror();
    },
    intent() {
      this.publishStageName();
      this.syncUiMirror();
    },
    'colony.name'() {
      this.captures = {};
      this.sub = undefined;
      this.subIdx = 0;
      this.payIdx = 0;
      this.focusIdx = 0;
      this.heldView = undefined;
      this.commitLatched = false;
      this.heldContext = undefined;
      this.targetFocus = undefined;
      this.presentedTargets = [];
      this.cardlandReleased = false;
      this.clearCardlandDwell();
      this.seedPaymentDefault();
      this.syncLockedPayment();
      this.publishStageName();
      this.syncUiMirror();
    },
    // The commit latch: once this stage session crossed the boundary, the
    // pre-commit verdict never returns (see `commitLatched`). `immediate`:
    // a stage that MOUNTS mid-resolution (the post-discard restore, a remote
    // entry) is past the commit from its first frame.
    pastCommit: {
      immediate: true,
      handler(now: boolean) {
        if (now) {
          this.commitLatched = true;
        }
      },
    },
    // Hold the last SOURCE context through the close (see `presentedContext`).
    resolutionContext: {
      immediate: true,
      handler(ctx: {roleKey: string, bonus: boolean, traderColor: string, traderLine: string} | undefined) {
        if (ctx !== undefined) {
          this.heldContext = {...ctx};
        }
      },
    },
    actionAvailable() {
      this.publishStageName();
      this.syncUiMirror();
    },
    // THE CONFIGURATION LETS GO only when the flow's physical bridge is on
    // stage (covers airborne / content landing) — never at the bare claim.
    // One-shot per outcome; re-arms when the zone folds (the next cycle's
    // batch opens its own phrase).
    outcomeHandoffDue(due: boolean) {
      if (due && !this.outcomeHandoffPlayed) {
        this.outcomeHandoffPlayed = true;
        this.playOutcomeHandoff();
      }
    },
    outcomeZone(on: boolean) {
      if (!on) {
        this.outcomeHandoffPlayed = false;
      }
    },
    /**
     * THE CLOSING BEAT WAITS FOR THIS STAGE. The trade's conclusion (the track
     * reset) may not start while the track is hidden under the payout — and
     * not on the frame the pose drops either: the working area fades back over
     * its own transition, and a marker launched into that fade is the same
     * «белая точка по пустому интерфейсу», just shorter. The RISE is published
     * at once (nothing may slip in behind it); the FALL is published after the
     * pose has settled — a dwell, not a gate (the section's own
     * COMPLETION_SETTLE precedent), scaled by the speed preset.
     */
    stageBusy: {
      immediate: true,
      handler(busy: boolean) {
        if (this.stageBackTimer !== undefined) {
          window.clearTimeout(this.stageBackTimer);
          this.stageBackTimer = undefined;
        }
        if (busy) {
          setColonyStageYielded(true);
          return;
        }
        this.stageBackTimer = window.setTimeout(() => {
          this.stageBackTimer = undefined;
          setColonyStageYielded(false);
        }, motionMs(WORKING_AREA_BACK_MS));
      },
    },
    /**
     * EVERY CHIP HAS TOUCHED ITS CARD — hold the landed reading for one calm
     * beat (the counter just ticked; the player must see the new number), then
     * recede and give the working area back. A read beat, not a gate: nothing
     * is being waited for.
     */
    cardlandAllLanded(landed: boolean) {
      if (!landed || !this.cardlandVisible || this.cardlandReleased) {
        return;
      }
      this.clearCardlandDwell();
      this.cardlandDwell = window.setTimeout(() => {
        this.cardlandDwell = undefined;
        this.cardlandReleased = true;
      }, motionMs(CARDLAND_READ_MS));
    },
    /** A CARD payout took the working area over (Miranda: animals landed,
     *  now the drawn card's covers own the room) — the presented scene must
     *  not stand under it, and its counters must not stay frozen. */
    outcomeHandoffPlayed(played: boolean) {
      if (played && this.presentedTargets.length > 0) {
        this.clearCardlandDwell();
        this.cardlandReleased = true;
      }
    },
    /**
     * THE SCENE'S OWN NET. `onArrive` fires on every transfer path (flight,
     * reduced motion, degrade, safety), so the landings normally release the
     * scene — but a presented target whose chip the MANIFEST never produced
     * (a plan/actual divergence) would hold the working area forever. Once
     * the transaction's chip phase is over, whatever has not landed is not
     * coming: release after the same read beat, honestly.
     */
    'colonyTradeState.phase'(phase: string) {
      const chipsOver = phase === 'awaiting' || phase === 'glide' || phase === 'settle' || phase === 'idle';
      if (!chipsOver || !this.cardlandVisible || this.cardlandReleased ||
          this.cardlandAllLanded || this.cardlandDwell !== undefined) {
        return;
      }
      this.cardlandDwell = window.setTimeout(() => {
        this.cardlandDwell = undefined;
        this.cardlandReleased = true;
      }, motionMs(CARDLAND_READ_MS));
    },
    outcomeContentIn(landed: boolean) {
      if (landed) {
        void this.$nextTick(() => playOutcomeContent(this.$el as HTMLElement));
      }
    },
    resolving(now: boolean, was: boolean) {
      if (!now && was) {
        // The transaction ended — SUCCESS (the workspace is about to fold) or
        // a clean rollback (the server refused / the fleet aborted). Either
        // way the commit-boundary snapshot lets go: the presentation unpins,
        // the presented-target scene leaves, input returns.
        this.clearCardlandDwell();
        this.presentedTargets = [];
        this.cardlandReleased = false;
        if (this.heldView !== undefined) {
          this.heldView = undefined;
          this.publishStageName();
          this.syncUiMirror();
        }
      }
    },
  },
  methods: {
    cardLabel(name: string): string {
      return translateCardName(name);
    },
    ownerNameAt(idx: number): string {
      const color = this.colony.colonies[idx];
      if (color === undefined) {
        return '';
      }
      const player = this.players.find((p) => p.color === color);
      return player !== undefined ? participantDisplayName(player) : color;
    },
    benefitResourceLost(type: ColonyBenefit): boolean {
      const meta = this.metadata;
      if (meta.cardResource === undefined) {
        return false;
      }
      if (type !== ColonyBenefit.ADD_RESOURCES_TO_CARD && type !== ColonyBenefit.ADD_RESOURCES_TO_VENUS_CARD) {
        return false;
      }
      const viewer = this.players.find((p) => p.color === this.viewerColor);
      const tableau = viewer?.tableau ?? [];
      return !tableau.some((card) => getCard(card.name)?.resourceType === meta.cardResource);
    },
    isFocused(zone: 'pay' | 'step', index: number): boolean {
      return this.sub === undefined && this.focused?.zone === zone && this.focused.index === index;
    },
    chipIconClass(chip: TradeOutcomeChip): string {
      // `con-task__opt-res` is what SIZES the sprite. A standard-resource class
      // carries a box of its own and happened to survive without it; a
      // card-resource class is only a background-image, so the floater's icon
      // was a 0×0 element — present in the DOM, invisible on screen. Every
      // other icon on this stage goes through `resourceIconClass`; this was the
      // one exception, and it is why the fee row lost its icon.
      return chip.icon !== undefined ? iconClassFor(chip.icon) + ' con-task__opt-res' : '';
    },
    /** A reward line's sprite — the SAME sizing every icon on this stage gets
     *  (a bare card-resource class is only a background-image: a 0×0 element
     *  without `con-task__opt-res`, which is how the fee row lost its icon). */
    rewardIconClass(icon: string): string {
      return iconClassFor(icon) + ' con-task__opt-res';
    },
    /**
     * WHO PAYS this part, in words: the colony's own track, the viewer's
     * settlements (with the multiplier that makes «2 колонии × 1 карта» read
     * as one line), or a card that pays on every trade.
     */
    sourceRowLabel(row: RewardSourceRow): string {
      if (row.kind === 'card') {
        return translateText(row.card ?? 'Card effect');
      }
      if (row.kind === 'ownColony') {
        return translateTextWithParams('Your colony ×${0}', [String(row.count)]);
      }
      return translateText('Trade track');
    },
    resourceKey(resource: string | undefined): string | undefined {
      return resource?.toString().toLowerCase().replace(/ /g, '-');
    },
    resourceIconClass(resource: string | undefined): string {
      const key = this.resourceKey(resource);
      return key !== undefined ? iconClassFor(key) + ' con-task__opt-res' : '';
    },
    tradeBenefitAt(position: number): {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown} {
      const t = this.metadata.trade;
      const resource = Array.isArray(t.resource) ? t.resource[position] : t.resource;
      return {type: t.type, quantity: t.quantity, resource};
    },
    targetImpact(row: StepRow): string {
      const step = row.step;
      if (step === undefined) {
        return '';
      }
      const captured = this.captures[row.key];
      const name = typeof captured === 'string' ? captured : undefined;
      const card = step.pick.cards.find((c) => c.name === name);
      if (card === undefined) {
        return '';
      }
      const before = card.resources ?? 0;
      return `${before} → ${before + step.amount}`;
    },
    /**
     * PIN THE FEE to the entry's own path. Called wherever `payIdx` could
     * otherwise drift (mount, a new colony, a fresh option list): the entry
     * IS the payment, so the selection is not seeded — it is fixed.
     */
    syncLockedPayment(): void {
      if (this.lockedPayIdx >= 0) {
        this.payIdx = this.lockedPayIdx;
      }
    },
    seedPaymentDefault(): void {
      const step = this.paymentStep;
      const player = this.thisPlayer;
      if (step === undefined || player === undefined) {
        this.paymentCounts = {};
        return;
      }
      const lanes = paymentLanes(step.model, player);
      this.paymentCounts = initialCounts(step.model.amount, lanes, megacreditsAvailable(player));
    },
    /** The stage names its crumb tail (rule 5 — never a header of its own).
     *  Reads the PRESENTED availability, so the tail cannot re-title itself
     *  «Осмотр» while a committed action is still resolving on the stage. */
    publishStageName(): void {
      // The target step is one level DEEPER in the same flow — only the tail
      // advances («…› ТОРГОВЛЯ» → «…› ЦЕЛЬ НАГРАДЫ»), and B walks it back.
      if (this.sub === 'targets') {
        setColonyFocusStage('Reward target');
        return;
      }
      if (this.intent === 'build') {
        setColonyFocusStage(this.presentAvailable ? 'Construction' : 'Inspection');
        return;
      }
      if (this.intent === 'pick') {
        setColonyFocusStage('Selection');
        return;
      }
      setColonyFocusStage(this.intent === 'trade' && this.presentAvailable ? 'Trading' : 'Inspection');
    },
    syncUiMirror(): void {
      consoleColoniesUi.composerSub = this.sub === undefined ?
        '' :
        (this.sub === 'lanes' ? 'lanes' : (this.sub === 'targets' ? 'targets' : 'list'));
      consoleColoniesUi.composerReady = this.canConfirm;
      consoleColoniesUi.composerEditable = this.tradeConfigLive && this.focusedRowEditable;
    },
    /** The shell routes every intent here while the stage is open. */
    handleIntent(intent: GamepadIntent): void {
      // The resolution — or a commit still on the wire (`heldView`) — owns
      // the moment: input is ABSORBED, so a double submit is impossible by
      // construction (the workspace-flow 'none' verb).
      if (this.resolving || this.heldView !== undefined) {
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      const action = consoleActionOf(intent);
      if (action !== undefined) {
        this.onPress(action);
      }
    },
    onNav(dir: NavDirection): void {
      if (this.sub === 'lanes') {
        this.onLanesNav(dir);
        return;
      }
      if (this.sub === 'targets') {
        this.targetNav(dir);
        return;
      }
      if (this.sub !== undefined) {
        if (dir === 'up' || dir === 'down') {
          const n = this.subListLength();
          this.subIdx = Math.min(n - 1, Math.max(0, this.subIdx + (dir === 'down' ? 1 : -1)));
        }
        return;
      }
      if (dir === 'up' || dir === 'down') {
        this.focusIdx = Math.min(this.focusables.length - 1, Math.max(0, this.focusIdx + (dir === 'down' ? 1 : -1)));
        this.scrollFocusedIntoView();
      }
    },
    onLanesNav(dir: NavDirection): void {
      const view = this.paymentView;
      if (view === undefined) {
        return;
      }
      if (dir === 'up' || dir === 'down') {
        this.subIdx = Math.min(this.payLanes.length - 1, Math.max(0, this.subIdx + (dir === 'down' ? 1 : -1)));
        return;
      }
      this.adjustPayLane(this.subIdx, dir === 'right' ? 1 : -1);
    },
    adjustPayLane(idx: number, step: number, toMax = false): void {
      const view = this.paymentView;
      const lane = this.payLanes[idx];
      if (view === undefined || lane === undefined) {
        return;
      }
      const before = this.paymentCounts[lane.unit] ?? 0;
      // AGGREGATE anti-overpay limit (the pure `dialLaneCount`) — «+» and
      // «МАКС.» both count what the other alternatives already pay.
      const next = dialLaneCount(view.cost, lane, this.payLanes, this.paymentCounts, toMax ? 'max' : step);
      if (next === before) {
        return;
      }
      this.paymentCounts = {...this.paymentCounts, [lane.unit]: next};
      this.payFlashNonce += 1;
    },
    subListLength(): number {
      if (this.sub === 'track') {
        return this.trackOptions.length;
      }
      return 0;
    },
    onPress(action: ConsoleAction): void {
      // THE TARGET STEP SPEAKS THE SHARED SELECTOR'S GRAMMAR — A chooses,
      // X inspects the focused candidate fullscreen (never a second confirm
      // verb), LB/RB the owner axis, B one level back with the previous
      // pre-select intact. Routed before the generic sub handling: the
      // generic branch reads X as «confirm», which is exactly the collision
      // the console-wide «X = осмотреть» grammar forbids here.
      if (this.sub === 'targets') {
        switch (action) {
        case 'primary': this.targetConfirm(); return;
        case 'inspect': this.targetInspect(); return;
        case 'prevSection': this.cycleTargetOwner(-1); return;
        case 'nextSection': this.cycleTargetOwner(1); return;
        case 'back': this.closeTargetStep(); return;
        default: return;
        }
      }
      switch (action) {
      case 'primary':
        // BUILD / PICK: there is nothing else to choose on this stage — A IS
        // the confirm (the destination slot and the grant are already shown).
        if (this.sub === undefined && (this.intent === 'build' || this.intent === 'pick')) {
          if (this.canConfirm) {
            this.$emit(this.intent === 'build' ? 'build-confirm' : 'pick-confirm');
          }
          return;
        }
        this.onConfirmPress();
        return;
      case 'inspect':
        // X = the one final trade confirm (only when every decision is in).
        if (this.sub === undefined && this.intent === 'trade' && this.canConfirm) {
          this.emitConfirm();
        } else if (this.sub !== undefined) {
          this.onConfirmPress();
        }
        return;
      case 'nextTab':
        if (this.sub === 'lanes') {
          this.adjustPayLane(this.subIdx, 0, true);
        }
        return;
      case 'back':
        if (this.sub !== undefined) {
          this.sub = undefined;
          return;
        }
        this.$emit('cancel');
        return;
      default:
        return;
      }
    },
    onConfirmPress(): void {
      if (this.sub === 'lanes') {
        if (this.paymentView?.status.ok === true) {
          this.sub = undefined;
        }
        return;
      }
      if (this.sub === 'track') {
        const option = this.trackOptions[this.subIdx];
        if (option !== undefined) {
          this.captures = {...this.captures, track: option.steps};
          this.sub = undefined;
        }
        return;
      }
      const focused = this.focused;
      if (focused === undefined) {
        return;
      }
      if (focused.zone === 'pay') {
        if (this.lockedPayIdx < 0) {
          this.payIdx = focused.index;
        }
        return;
      }
      const row = this.stepRows[focused.index];
      if (row === undefined) {
        return;
      }
      if (row.kind === 'payment') {
        this.sub = 'lanes';
        this.subIdx = 0;
        return;
      }
      if (row.kind === 'trackChoice') {
        this.sub = 'track';
        this.subIdx = 0;
        return;
      }
      if (row.kind === 'cardTarget') {
        this.openTargetStep();
        return;
      }
    },
    // ── the embedded TARGET STEP (the shared played-card selector) ─────────
    /**
     * DESCEND into the target step — one level deeper in the same flow. The
     * cursor lands on the previously chosen card when there is one (a
     * re-entry through «Изменить выбор» — already target-locked), else on the
     * model's own first seat. The zone is measured a tick later, when it
     * stands; the step re-solves its cards on that budget by contract.
     */
    openTargetStep(): void {
      const model = this.targetStepModel;
      const owners = model?.owners ?? [];
      if (owners.length === 0) {
        return;
      }
      this.targetFocus = findPlayedTargetFocus(this.targetLockedCard, owners) ??
        reseatPlayedTargetFocus(undefined, owners);
      if (this.targetFocus === undefined) {
        return;
      }
      this.sub = 'targets';
      void this.$nextTick(() => {
        this.measureTargetZone();
        const zone = this.$refs.targetZone as HTMLElement | undefined;
        if (zone !== undefined && zone !== null) {
          playColonyTargetStepEnter(zone);
        }
      });
    },
    measureTargetZone(): void {
      const zone = this.$refs.targetZone as HTMLElement | undefined;
      if (zone === undefined || zone === null) {
        return;
      }
      // CONTENT box, not client box: `clientHeight` includes the zone's own
      // padding, and a budget fed the padding solves cards for room that does
      // not exist — a hairline scroll rail and a cropped bottom row at 4K.
      const cs = getComputedStyle(zone);
      this.targetZoneW = Math.max(0, zone.clientWidth -
        (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0));
      this.targetZoneH = Math.max(0, zone.clientHeight -
        (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0));
    },
    /**
     * B — fold ONE level back. The previous pre-select is deliberately kept:
     * closing the step is «передумал смотреть», never «передумал выбирать» —
     * a confirmed target survives every visit that ends with B.
     */
    closeTargetStep(): void {
      const zone = this.$refs.targetZone as HTMLElement | undefined;
      const drop = (): void => {
        if (this.sub === 'targets') {
          this.sub = undefined;
        }
        this.scrollFocusedIntoView();
      };
      if (zone !== undefined && zone !== null) {
        playColonyTargetStepLeave(zone, drop);
      } else {
        drop();
      }
    },
    targetNav(dir: NavDirection): void {
      const owners = this.targetStepModel?.owners ?? [];
      const focus = this.targetFocus;
      if (focus === undefined || owners.length === 0) {
        return;
      }
      const map: Record<string, PlayedTargetNavDir | undefined> =
        {left: 'left', right: 'right', up: 'up', down: 'down'};
      const d = map[dir as string];
      if (d === undefined) {
        return;
      }
      const step = this.$refs.targetStep as {cells?: () => ReadonlyArray<PlayedTargetCell>} | undefined;
      const cells = step?.cells?.() ?? [];
      const next = cells.length > 0 ?
        stepPlayedTargetFocusAt(focus, d, cells) :
        stepPlayedTargetFocus(focus, d, owners, this.targetLayout);
      if (next === undefined) {
        return; // an edge HOLDS — never a wrap, never a silent owner change
      }
      this.targetFocus = next;
      (this.$refs.targetStep as {ensureFocusVisible?: () => void} | undefined)?.ensureFocusVisible?.();
    },
    /** LB/RB — the owner axis, tabbed mode only (the shared grammar; colony
     *  targets are normally the viewer's own single group, so this is quiet). */
    cycleTargetOwner(delta: number): void {
      const owners = this.targetStepModel?.owners ?? [];
      const focus = this.targetFocus;
      if (focus === undefined || this.targetLayout.mode !== 'tabs' || owners.length < 2) {
        return;
      }
      const ownerId = stepPlayedTargetOwner(focus.ownerId, delta, owners);
      if (ownerId !== focus.ownerId) {
        this.targetFocus = reseatPlayedTargetFocus({ownerId, index: 0}, owners) ?? focus;
      }
    },
    /** A — lock the focused candidate in as this step's target and return to
     *  the trade review. The capture is the SAME shape the batch always sent
     *  (`{type:'card', cards:[name]}` downstream) — the selector is
     *  presentation, never a second source of truth. */
    targetConfirm(): void {
      const owners = this.targetStepModel?.owners ?? [];
      const candidate = playedTargetAt(this.targetFocus, owners);
      const key = this.activeTargetKey;
      if (candidate === undefined || key === '') {
        return;
      }
      this.captures = {...this.captures, [key]: candidate.cardName};
      this.closeTargetStep();
    },
    /** X — the focused candidate fullscreen, lifting from its own slot (the
     *  console-wide «X inspects the current object»). */
    targetInspect(): void {
      const owners = this.targetStepModel?.owners ?? [];
      const candidate = playedTargetAt(this.targetFocus, owners);
      if (candidate === undefined) {
        return;
      }
      const cards = owners.flatMap((o) => o.candidates.map((c) => c.model));
      const at = Math.max(0, cards.findIndex((c) => c.name === candidate.cardName));
      openConsoleCardZoom(cards, at, undefined, undefined, {
        // The explicit root ref, never `this.$el`: a root-level template
        // comment makes the dev build a fragment whose $el is a Comment node.
        origin: playedTargetZoomOrigin(
          () => this.$refs.rootEl as HTMLElement | undefined,
          (i) => cards[i]?.name ?? '',
          playedTargetSourceCardName(owners)),
      });
    },
    /** The presented-target helpers (the resolution scene). */
    landedOf(t: ColonyTradePresentedTarget): number {
      return this.colonyTradeState.cardResLanded[t.card] ?? 0;
    },
    presentedModelOf(t: ColonyTradePresentedTarget): CardModel {
      const live = this.players
        .flatMap((p) => p.tableau)
        .find((c) => c.name === t.card);
      return presentedTargetModel(t, live, this.landedOf(t));
    },
    clearCardlandDwell(): void {
      if (this.cardlandDwell !== undefined) {
        window.clearTimeout(this.cardlandDwell);
        this.cardlandDwell = undefined;
      }
    },
    /**
     * A fresh preview re-judges every capture (the invalidation half of the
     * pre-select contract): a target no longer offered is dropped, a track
     * step that vanished releases its choice, and a target sub whose step
     * disappeared folds back to the review.
     */
    pruneStaleCaptures(): void {
      const next: Record<string, unknown> = {...this.captures};
      let changed = false;
      const keys = this.stepKeys;
      this.steps.forEach((step, i) => {
        const key = keys[i];
        if (step.kind !== 'cardTarget') {
          return;
        }
        const captured = next[key];
        if (typeof captured === 'string' && !step.pick.cards.some((c) => c.name === captured)) {
          delete next[key];
          changed = true;
        }
      });
      // Captures whose STEP is gone entirely (a re-shaped preview).
      const live = new Set(keys);
      for (const key of Object.keys(next)) {
        if ((key.startsWith('target:') || key === 'track') && !live.has(key)) {
          delete next[key];
          changed = true;
        }
      }
      if (changed) {
        this.captures = next;
      }
      if (this.sub === 'targets' && this.activeTargetStep === undefined) {
        this.sub = undefined;
      }
    },
    rowMissing(row: StepRow): boolean {
      if (row.kind === 'trackChoice') {
        return this.captures['track'] === undefined;
      }
      if (row.kind === 'cardTarget') {
        return this.captures[row.key] === undefined;
      }
      if (row.kind === 'payment') {
        return this.paymentView !== undefined && !this.paymentView.status.ok;
      }
      return false;
    },
    scrollFocusedIntoView(): void {
      void this.$nextTick(() => {
        const el = this.$refs.focusedEl as HTMLElement | Array<HTMLElement> | undefined;
        const node = Array.isArray(el) ? el[0] : el;
        (this.$refs.scroll as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(node);
      });
    },
    /**
     * The card-resource DESTINATIONS of this confirm — the picked targets AND
     * the single-candidate AUTO ones the server applies without a prompt.
     * ONE derivation feeds both consumers (the transfer flight's `targets`
     * and the presented resolution scene), so the card a chip lands on and
     * the card the player is shown can never be two different answers.
     */
    cardDestinations(): {targets: ColonyTradeTargets, presented: ReadonlyArray<ColonyTradePresentedTarget>} {
      return colonyTradeCardDestinations({
        steps: this.steps,
        stepKeys: this.stepKeys,
        captures: this.captures,
        notices: this.tradeConfigLive ? tradeNotices(this.preview) : [],
        resourceOf: (name) => getCard(name)?.resourceType,
        beforeOf: (name) => this.players
          .flatMap((p) => p.tableau)
          .find((c) => c.name === name)?.resources ?? 0,
      });
    },
    emitConfirm(): void {
      const capturesByIndex: Record<number, unknown> = {};
      this.steps.forEach((step, i) => {
        const key = this.stepKeys[i];
        if (step.kind === 'payment') {
          const view = this.paymentView;
          const player = this.thisPlayer;
          if (view !== undefined && player !== undefined) {
            capturesByIndex[i] = paymentFromCounts(view.cost, this.payLanes, this.paymentCounts, megacreditsAvailable(player));
          }
        } else if (this.captures[key] !== undefined) {
          capturesByIndex[i] = this.captures[key];
        }
      });
      this.$emit('confirm', {
        paymentIndex: this.payIdx,
        steps: this.steps,
        captures: capturesByIndex,
        targets: this.cardDestinations().targets,
      });
    },
    /**
     * The follow-up's stage handoff, in the shared grammar: the configuration
     * lets go ON THE SPOT, the outcome zone opens FROM ITS RECT, and the
     * teleported content surfaces from inside once it actually lands. The
     * origin is armed at the commit, while the configuration still stands.
     */
    playOutcomeHandoff(): void {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || root === null) {
        return;
      }
      playConfigRelease(root);
      void this.$nextTick(() => playOutcomePhase(root, () => undefined));
    },
    /** THE COMMIT BOUNDARY: pin what the stage shows before the props flip
     *  (the answer removes the pick / spends the trade while the resolution
     *  still plays HERE). Called by the SHELL only after ITS guards accepted
     *  the confirm (a hold with no submit behind it would gate input forever
     *  — the transaction that releases it would never start). Released by
     *  the transaction's falling edge. */
    holdPresentation(): void {
      // Arm the outcome origin while the configuration surface still stands —
      // its rect is what the follow-up's zone will unfold from.
      // The WORKING AREA is what hands over — the identity column stays, so
      // the follow-up opens from the track/config box, not from the whole
      // panel (an origin larger than the zone clips to nothing and the unfold
      // silently degrades into a fade).
      armOutcomeOriginFrom(this.$refs.mainEl as HTMLElement | undefined);
      this.heldView = {
        mode: this.presentMode,
        available: this.presentAvailable,
        payment: this.payEntries[this.payIdx],
      };
      // THE PRESENTED TARGETS — snapshotted AT the boundary, like everything
      // else in the held view: the server's answer will rewrite the preview
      // and the tableau under the resolution, and the scene must keep showing
      // the decision as it was made («было → прилетело → стало»).
      const destinations = this.cardDestinations();
      this.presentedTargets = destinations.presented;
      this.cardlandReleased = false;
      this.clearCardlandDwell();
    },
  },
  mounted() {
    this.seedPaymentDefault();
    this.syncLockedPayment();
    this.publishStageName();
    this.syncUiMirror();
  },
  beforeUnmount() {
    consoleColoniesUi.composerSub = '';
    consoleColoniesUi.composerReady = false;
    consoleColoniesUi.composerEditable = false;
    // A stage that is GONE hides nothing: the closing beat must never wait on
    // a screen that no longer exists (the discard closes this stage mid-flow,
    // and the reset then plays on the restored one — or on the overview tile).
    if (this.stageBackTimer !== undefined) {
      window.clearTimeout(this.stageBackTimer);
      this.stageBackTimer = undefined;
    }
    this.clearCardlandDwell();
    setColonyStageYielded(false);
  },
});
</script>

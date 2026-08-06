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
       :class="['con-colfocus--' + presentMode, {
         'con-colfocus--resolving': resolving,
         'con-colfocus--gliding': trackGliding,
       }]"
       :data-colony-intent="intent">
    <div class="con-colfocus__surface" data-unfold-surface>
      <!-- ═══ HERO — the colony as a physical object ═══ -->
      <section class="con-colfocus__hero">
        <div class="con-colfocus__planetwrap">
          <div class="con-colfocus__planet" :class="planetClass" data-colony-focus-planet aria-hidden="true">
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
             stranded red bar at the bottom of an empty page. -->
        <div class="con-colfocus__verdict"
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
      </section>

      <!-- ═══ MAIN — the game object: track › return base › berths › setup ═══ -->
      <div class="con-colfocus__main">
        <!-- ── THE EXPANDED TRADE TRACK. One big cell per position with its
             reward; the MARKER RAIL underneath carries a real seat per cell —
             the seat is the glide anchor, so the flying marker is exactly the
             size of the resting one and lands on it, not beside it. ── -->
        <section class="con-colfocus__trackzone">
          <header class="con-colfocus__zonehead" data-unfold-late>
            <span class="con-colfocus__sec-title">{{ $t('Trade track') }}</span>
            <span v-if="offsetSteps > 0" class="con-colfocus__tracknote-adv">
              {{ $t('Your trade advances the track first') }} <b>+{{ offsetSteps }}</b>
            </span>
            <!-- THE RULE IN WORDS, on the line that names the object it
                 governs — the rail below draws the same sentence. -->
            <span class="con-colfocus__resetnote">
              <span class="con-colfocus__resetnote-built">
                <span class="con-colfocus__rn-label">{{ $t('Built here') }}</span>
                <span v-if="builtCount > 0" class="con-colfocus__rn-cubes">
                  <PlayerCube v-for="(c, i) in colony.colonies" :key="'b' + i" :color="c" :size="11" />
                </span>
                <b>{{ builtCount }}</b>
              </span>
              <span class="con-colfocus__rn-arrow" aria-hidden="true">→</span>
              <span class="con-colfocus__resetnote-target">
                <span class="con-colfocus__rn-label">{{ $t('Track returns to') }}</span>
                <b class="con-colfocus__rn-pos">{{ resetPosition + 1 }}</b>
                <em v-if="buildPreview">→ <b>{{ resetPositionAfterBuild + 1 }}</b></em>
              </span>
            </span>
          </header>

          <div class="con-colfocus__xtrack" data-colony-focus-track>
            <div v-for="cell in trackCells" :key="cell.index"
                 class="con-colfocus__xcell"
                 :class="{
                   'con-colfocus__xcell--marker': cell.marker,
                   'con-colfocus__xcell--effective': cell.effective,
                   'con-colfocus__xcell--passed': cell.passed,
                   'con-colfocus__xcell--reset': cell.reset,
                   'con-colfocus__xcell--settled': cell.index === settledCell,
                 }">
              <span class="con-colfocus__xcell-num">{{ cell.index + 1 }}</span>
              <span class="con-colfocus__xcell-body">
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
              </span>
            </div>
          </div>

          <!-- ── THE RETURN BASE — the colony-count rule, drawn. The bracket
               runs from position 1 to the built-colony count and plants the
               ⟲ anchor under the EXACT cell the marker falls back to; a build
               preview extends a ghost one cell further. ── -->
          <div class="con-colfocus__resetrail" data-unfold-item aria-hidden="true">
            <span v-for="cell in trackCells" :key="'r' + cell.index"
                  class="con-colfocus__rrcell"
                  :class="{
                    'con-colfocus__rrcell--base': cell.index <= resetPosition,
                    'con-colfocus__rrcell--anchor': cell.index === resetPosition,
                    'con-colfocus__rrcell--ghost': buildPreview && cell.index === resetPositionAfterBuild,
                    'con-colfocus__rrcell--span': trackWillReset && cell.index > resetPosition && cell.index <= markerPosition,
                  }">
              <span class="con-colfocus__rr-line"></span>
              <span v-if="cell.index === resetPosition" class="con-colfocus__rr-anchor">⟲</span>
              <span v-else-if="buildPreview && cell.index === resetPositionAfterBuild" class="con-colfocus__rr-ghost">+1</span>
            </span>
          </div>

        </section>

        <!-- ── THE COLONY BERTHS — three real places. Each carries the RETURN
             STEP it would buy, which is what makes «build raises my trade
             floor» readable instead of deducible. The cube SEAT is both the
             build-cube landing anchor and the owner-bonus launch cell. ── -->
        <section class="con-colfocus__berthzone">
          <header class="con-colfocus__zonehead" data-unfold-late>
            <span class="con-colfocus__sec-title">{{ $t('Colony berths') }}</span>
            <span class="con-colfocus__zonehead-note">{{ $t('Each colony raises the return by one') }}</span>
          </header>
          <div class="con-colfocus__berths" data-colony-focus-slots data-unfold-item>
            <div v-for="idx in [0, 1, 2]" :key="idx"
                 class="con-colfocus__berth"
                 :class="{
                   'con-colfocus__berth--taken': colony.colonies[idx] !== undefined,
                   'con-colfocus__berth--mine': colony.colonies[idx] === viewerColor,
                   'con-colfocus__berth--dest': buildPreview && idx === nextBuildSlot,
                 }">
              <span class="con-colfocus__berth-seat"
                    :data-colony-build-slot="colony.name + '#' + idx"
                    data-colony-build-seat
                    :data-colony-bonus-source="colony.colonies[idx] !== undefined ? colony.name : undefined">
                <PlayerCube v-if="colony.colonies[idx] !== undefined" :color="colony.colonies[idx]" :size="44" />
                <BenefitGlyph v-else :benefit="buildBenefit" :idx="idx" :cardResource="metadata.cardResource" />
              </span>
              <span class="con-colfocus__berth-name" data-unfold-late>
                {{ colony.colonies[idx] !== undefined ? ownerNameAt(idx) : $t('Open berth') }}
              </span>
              <span class="con-colfocus__berth-step" data-unfold-late>⟲ {{ Math.min(idx + 1, trackMax) + 1 }}</span>
            </div>
            <!-- The OWNER BONUS belongs to this zone: it is what the berths
                 pay out, so it stands beside them and not in a far column. -->
            <div class="con-colfocus__ownerbonus"
                 :data-colony-bonus-source="owners.length === 0 ? colony.name : undefined">
              <span class="con-colfocus__ob-label" data-unfold-late>{{ $t('Owner bonus') }}</span>
              <span class="con-colfocus__ob-value">
                <b v-if="focusedBonusQty > 0">{{ focusedBonusQty }}</b>
                <span class="con-colfocus__rglyph con-colfocus__rglyph--lg">
                  <BenefitGlyph :benefit="colonyBenefit" :idx="0" :cardResource="metadata.cardResource" />
                </span>
              </span>
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

          <!-- SUB: card-target picker (where the reward resources land). -->
          <template v-else-if="sub === 'targets' && activeTargetStep !== undefined">
            <div class="con-colfocus__sub-title">{{ targetSubTitle }}</div>
            <div v-for="(card, i) in activeTargetStep.pick.cards" :key="card.name"
                 class="con-task__option"
                 :class="{
                   'con-task__option--focused': subIdx === i,
                   'con-colfocus__option--chosen': captures[activeTargetKey] === card.name,
                 }"
                 :ref="subIdx === i ? 'focusedEl' : undefined">
              <div class="con-task__option-main">
                <i v-if="targetIconClass !== ''" class="con-task__opt-icon" :class="targetIconClass" aria-hidden="true"></i>
                <span class="con-task__opt-title">{{ cardLabel(card.name) }}</span>
                <span class="con-task__opt-preview">{{ card.resources ?? 0 }} → {{ (card.resources ?? 0) + activeTargetStep.amount }}</span>
                <span v-if="captures[activeTargetKey] === card.name" class="con-colfocus__opt-check" aria-hidden="true">✓</span>
              </div>
            </div>
          </template>

          <!-- TRADE REVIEW: payment paths + the follow-up decisions. -->
          <template v-else-if="intent === 'trade' && presentAvailable">
            <ConsoleScrollArea class="con-colfocus__configscroll" ref="scroll">
              <!-- The heading belongs to the ROWS, not to the mode: past the
                   commit the server takes the options away and a bare
                   «СПОСОБ ОПЛАТЫ» over nothing read as a broken panel. -->
              <div v-if="payEntries.length + disabledEntries.length > 0" class="con-colfocus__sec-title">{{ $t('Payment method') }}</div>
              <div v-for="(entry, i) in payEntries" :key="'p' + i"
                   class="con-colfocus__payrow"
                   :class="{
                     'con-colfocus__payrow--focused': isFocused('pay', i),
                     'con-colfocus__payrow--chosen': payIdx === i,
                   }"
                   :ref="isFocused('pay', i) ? 'focusedEl' : undefined">
                <span class="con-colfocus__payrow-pick" aria-hidden="true">
                  <span v-if="payIdx === i" class="con-colfocus__payrow-dot"></span>
                </span>
                <i v-if="entry.iconClass !== ''" class="con-colfocus__payrow-icon" :class="entry.iconClass" aria-hidden="true"></i>
                <span class="con-colfocus__payrow-title">{{ entry.title }}</span>
                <span v-if="entry.preview !== ''" class="con-colfocus__payrow-delta">{{ entry.preview }}</span>
              </div>
              <div v-for="(d, i) in disabledEntries" :key="'d' + i" class="con-colfocus__payrow con-colfocus__payrow--off">
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
                    </template>
                  </div>
                </div>
              </template>
            </ConsoleScrollArea>
          </template>

          <!-- BUILD BRIEF: destination + grant recap, one calm confirm. -->
          <template v-else-if="intent === 'build' && presentAvailable">
            <div class="con-colfocus__brief">
              <div class="con-colfocus__brief-line">
                <PlayerCube v-if="viewerColor !== undefined" class="con-colfocus__rcube" :color="viewerColor" :size="18" />
                <span>{{ $t('Build here') }} — {{ $t('Slot') }} {{ nextBuildSlot + 1 }}</span>
              </div>
              <div v-if="buildQty > 0" class="con-colfocus__brief-line con-colfocus__brief-line--gain">
                <span>{{ $t('Build grant') }}:</span>
                <b>+{{ buildQty }}</b>
                <span class="con-colfocus__rglyph">
                  <BenefitGlyph :benefit="buildBenefit" :idx="nextBuildSlot" :cardResource="metadata.cardResource" />
                </span>
              </div>
              <div class="con-colfocus__brief-note">{{ $t('When building') }} · {{ $t('Future owner bonus') }} {{ $t('Each trade here').toLowerCase() }}</div>
            </div>
          </template>

          <!-- PICK BRIEF (setup remove / add-tile): the verb, plainly. -->
          <template v-else-if="intent === 'pick' && presentAvailable">
            <div class="con-colfocus__brief">
              <div class="con-colfocus__brief-line">{{ $t(pickLabel || 'Select') }}</div>
            </div>
          </template>

          <!-- INSPECT / UNAVAILABLE: the colony's OWN RULES take the room —
               no empty payment skeleton, no fake controls, and never a blank
               half-screen: this is a dossier, so it reads like one. -->
          <template v-else>
            <ConsoleScrollArea class="con-colfocus__configscroll con-colfocus__rules">
              <div class="con-colfocus__sec-title" data-unfold-late>{{ $t('How it works') }}</div>
              <div class="con-colfocus__rule">
                <span class="con-colfocus__rglyph">
                  <BenefitGlyph :benefit="tradeBenefitAt(effectivePosition)" :idx="effectivePosition" :cardResource="metadata.cardResource" />
                </span>
                <span class="con-colfocus__rule-body" data-unfold-late>
                  <b>{{ $t('Trade') }}</b>
                  <span v-i18n>{{ metadata.trade.description }}</span>
                </span>
              </div>
              <div class="con-colfocus__rule">
                <span class="con-colfocus__rglyph">
                  <BenefitGlyph :benefit="buildBenefit" :idx="nextBuildSlot" :cardResource="metadata.cardResource" />
                </span>
                <span class="con-colfocus__rule-body" data-unfold-late>
                  <b>{{ $t('Build a colony') }}</b>
                  <span v-i18n>{{ metadata.build.description }}</span>
                </span>
              </div>
              <div class="con-colfocus__rule">
                <span class="con-colfocus__rglyph">
                  <BenefitGlyph :benefit="colonyBenefit" :idx="0" :cardResource="metadata.cardResource" />
                </span>
                <span class="con-colfocus__rule-body" data-unfold-late>
                  <b>{{ $t('Colony bonus (each trade)') }}</b>
                  <span v-i18n>{{ metadata.colony.description }}</span>
                </span>
              </div>
            </ConsoleScrollArea>
          </template>
        </section>
      </div>

      <!-- ═══ RESULT — the outcome, ONE CARD PER SOURCE ═══
           Each group states WHERE its value comes from, so «what the trade
           pays me» / «what the owners take» / «what building grants» / «what
           changes for the future» are never one undifferentiated list. The
           trade income's tight VALUE carries `data-colony-trade-source`: the
           reward chips and card covers leave that exact number. -->
      <section class="con-colfocus__result" data-unfold-item>
        <div class="con-colfocus__sec-title" data-unfold-late>{{ $t(resultTitle) }}</div>

        <!-- TRADE / INSPECT / PICK -->
        <template v-if="intent !== 'build'">
          <div class="con-colfocus__rsec con-colfocus__rsec--lead">
            <div class="con-colfocus__rsec-label" data-unfold-late>{{ $t(presentAvailable && intent !== 'pick' ? 'Trade reward here' : 'On the current level') }}</div>
            <div class="con-colfocus__rrow con-colfocus__rrow--gain con-colfocus__rrow--big">
              <span class="con-colfocus__rvalue" :data-colony-trade-source="colony.name">
                <b v-if="focusedReward.quantity > 0">+{{ focusedReward.quantity }}</b>
                <span class="con-colfocus__rglyph con-colfocus__rglyph--lg">
                  <BenefitGlyph :benefit="tradeBenefitAt(effectivePosition)" :idx="effectivePosition" :cardResource="metadata.cardResource" />
                </span>
              </span>
              <em v-if="tradeGainDelta !== ''" data-unfold-late>{{ tradeGainDelta }}</em>
            </div>
            <div v-if="resourceLost" class="con-colfocus__notice con-colfocus__notice--warn" data-unfold-late>
              <span aria-hidden="true">⚠</span>
              <span>{{ $t('Resource will be lost — no card') }}</span>
            </div>
            <div v-for="line in targetOutcomeLines" :key="line.key" class="con-colfocus__rrow con-colfocus__rrow--target" data-unfold-late>
              <i v-if="line.iconClass !== ''" :class="line.iconClass" aria-hidden="true"></i>
              <span class="con-colfocus__rrow-card">{{ $t(line.card) }}</span>
              <em>{{ line.before }} → {{ line.after }}</em>
            </div>
          </div>

          <div class="con-colfocus__rsec" data-unfold-late>
            <div class="con-colfocus__rsec-label">{{ $t('To the owners') }}</div>
            <div v-if="owners.length > 0" class="con-colfocus__rrow con-colfocus__rrow--gain">
              <b v-if="focusedBonusQty > 0">+{{ focusedBonusQty }}</b>
              <span class="con-colfocus__rglyph">
                <BenefitGlyph :benefit="colonyBenefit" :idx="0" :cardResource="metadata.cardResource" />
              </span>
              <span class="con-colfocus__rowners">
                <span v-for="owner in owners" :key="owner.color" class="con-colfocus__rowner">
                  <span :class="'con-status__dot player_bg_color_' + owner.color"></span>
                  <span>{{ owner.name }}</span><span v-if="owner.count > 1"> ×{{ owner.count }}</span>
                </span>
              </span>
            </div>
            <div v-else class="con-colfocus__muted">{{ $t('No colonies built here yet') }}</div>
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
          <div class="con-colfocus__rsec" data-unfold-late>
            <div class="con-colfocus__rsec-label">{{ $t('Future owner bonus') }}</div>
            <div class="con-colfocus__rrow con-colfocus__rrow--gain">
              <b v-if="focusedBonusQty > 0">+{{ focusedBonusQty }}</b>
              <span class="con-colfocus__rglyph">
                <BenefitGlyph :benefit="colonyBenefit" :idx="0" :cardResource="metadata.cardResource" />
              </span>
              <em>{{ $t('Each trade here') }}</em>
            </div>
          </div>
          <div class="con-colfocus__rsec con-colfocus__rsec--rule" data-unfold-late>
            <div class="con-colfocus__rsec-label">{{ $t('Track returns to') }}</div>
            <div class="con-colfocus__rrow">
              <b class="con-colfocus__rn-pos">{{ resetPosition + 1 }}</b>
              <span aria-hidden="true">→</span>
              <b class="con-colfocus__rn-pos con-colfocus__rn-pos--next">{{ resetPositionAfterBuild + 1 }}</b>
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
  laneCap,
  buildPaymentView,
  editableRows,
  PaymentLane,
  PaymentView,
} from '@/client/console/paymentPlan';
import {
  TradeStep,
  colonyOwnerCounts,
  effectiveTradePosition,
  rewardAtPosition,
  tradeNotices,
  tradeOutcome,
  TradeOutcomeChip,
  trackResetAfterBuild,
  trackResetPosition,
  tradeSteps,
} from '@/client/components/colonies/colonyTradePlan';
import {presentedColonyModel, colonyTradeState} from '@/client/console/colonyTrade/consoleColonyTrade';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import {colonyBuildState} from '@/client/console/colonyBuild/consoleColonyBuild';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';

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
  components: {BenefitGlyph, ColonyFleetIcon, PlayerCube, ConsoleScrollArea, ConsolePaymentPanel},
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
      paymentCounts: {} as Partial<Record<SpendableResource, number>>,
      payFlashNonce: 0,
      tradeFleetState,
      colonyTradeState,
      colonyBuildState,
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
    /** A trade from here would visibly pull the marker back. */
    trackWillReset(): boolean {
      return this.markerPosition > this.resetPosition;
    },
    /** This colony's marker is mid-glide — the resting marker yields to the
     *  flying proxy (the overview tile's `--marker-gliding` contract, now
     *  honoured on the stage the trade actually resolves on). */
    trackGliding(): boolean {
      return this.colonyTradeState.phase === 'glide' && this.colonyTradeState.colonyName === this.colony.name;
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
    focusedReward(): {quantity: number} {
      return rewardAtPosition(this.metadata, this.effectivePosition);
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
      const out: Array<Focusable> = this.payEntries.map((_, i) => ({zone: 'pay' as const, index: i}));
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
    targetIconClass(): string {
      return this.resourceIconClass(this.activeTargetStep?.resource);
    },
    targetSubTitle(): string {
      const step = this.activeTargetStep;
      if (step === undefined) {
        return '';
      }
      return textOf(step.pick.title) || translateText('Choose a card');
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
        {icon: meta.icon, amount: meta.amount} :
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
    /** The trade income's before→after on the viewer's stock ('' = n/a). */
    tradeGainDelta(): string {
      const gain = this.outcome.gains.find((chip) => chip.current !== undefined);
      return gain !== undefined && gain.current !== undefined ? `${gain.current} → ${gain.resulting}` : '';
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
      this.syncUiMirror();
    },
    sub() {
      this.syncUiMirror();
    },
    canConfirm() {
      this.syncUiMirror();
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
      this.seedPaymentDefault();
      this.publishStageName();
      this.syncUiMirror();
    },
    actionAvailable() {
      this.publishStageName();
      this.syncUiMirror();
    },
    // The transaction's OWN falling edge releases the commit freeze — the
    // stage re-derives its presentation in one step (fresh verdict, fresh
    // crumb tail), never mid-flight. No timer anywhere.
    resolving(now: boolean, was: boolean) {
      if (!now && was && this.heldView !== undefined) {
        this.heldView = undefined;
        this.publishStageName();
        this.syncUiMirror();
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
      return chip.icon !== undefined ? iconClassFor(chip.icon) : '';
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
      consoleColoniesUi.composerSub = this.sub === undefined ? '' : (this.sub === 'lanes' ? 'lanes' : 'list');
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
      const cap = laneCap(view.cost, lane);
      const before = this.paymentCounts[lane.unit] ?? 0;
      const next = toMax ? cap : Math.min(cap, Math.max(0, before + step));
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
      if (this.sub === 'targets') {
        return this.activeTargetStep?.pick.cards.length ?? 0;
      }
      return 0;
    },
    onPress(action: ConsoleAction): void {
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
      if (this.sub === 'targets') {
        const step = this.activeTargetStep;
        const card = step?.pick.cards[this.subIdx];
        if (step !== undefined && card !== undefined) {
          this.captures = {...this.captures, [this.activeTargetKey]: card.name};
          this.sub = undefined;
        }
        return;
      }
      const focused = this.focused;
      if (focused === undefined) {
        return;
      }
      if (focused.zone === 'pay') {
        this.payIdx = focused.index;
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
        this.sub = 'targets';
        const captured = this.captures[row.key];
        const idx = row.step?.pick.cards.findIndex((c) => c.name === captured) ?? -1;
        this.subIdx = idx !== -1 ? idx : 0;
        return;
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
      this.$emit('confirm', {paymentIndex: this.payIdx, steps: this.steps, captures: capturesByIndex});
    },
    /** THE COMMIT BOUNDARY: pin what the stage shows before the props flip
     *  (the answer removes the pick / spends the trade while the resolution
     *  still plays HERE). Called by the SHELL only after ITS guards accepted
     *  the confirm (a hold with no submit behind it would gate input forever
     *  — the transaction that releases it would never start). Released by
     *  the transaction's falling edge. */
    holdPresentation(): void {
      this.heldView = {
        mode: this.presentMode,
        available: this.presentAvailable,
        payment: this.payEntries[this.payIdx],
      };
    },
  },
  mounted() {
    this.seedPaymentDefault();
    this.publishStageName();
    this.syncUiMirror();
  },
  beforeUnmount() {
    consoleColoniesUi.composerSub = '';
    consoleColoniesUi.composerReady = false;
    consoleColoniesUi.composerEditable = false;
  },
});
</script>

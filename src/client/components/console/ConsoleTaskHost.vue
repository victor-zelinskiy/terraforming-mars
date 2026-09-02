<template>
  <!-- --table-beat: the TABLE owns the screen (draft pick landing / the
       research rise) — the modal chrome dissolves so the drafted tray and
       the flying cards are seen; releasing it IS the frame materialization
       around the fresh content (consoleDraftTray.ts owns the flag).
       data-motion-*: rides the shared `.con-shade` dim + the surface-motion
       director (no own backdrop; the shade's --veil mirrors the table beat). -->
  <div class="con-task-host" :class="{
         'con-ws': !embedded,
         'con-task-host--embedded': embedded,
         'con-task-host--table-beat': trayTableBeat,
       }"
       :role="embedded ? 'group' : 'dialog'" :aria-label="titleText"
       :data-motion-surface="embedded ? undefined : 'task-host'">

    <!-- Keyed frame: prompt→prompt switches cross-fade (CTS-3.9). -->
    <transition name="con-task-swap" mode="out-in">
      <!-- `con-ws-stage-*` are the SHARED embedded-stage chassis classes (frame
           / card row / status line). The drawn reveal wears the same three, so
           both stages spend the SAME chrome and the shared fit returns the same
           hero — see .con-ws-stage-frame in console.less. -->
      <div class="con-task"
           :class="{'con-task--wide': activeTask.kind === 'cardSelect', 'con-ws-stage-frame': embedded}"
           :key="panelKey" data-motion-panel>
        <!-- ── Frame header ──────────────────────────────────────────
             EMBEDDED: the KICKER is handed UP to the workspace's breadcrumb
             (setWorkspaceOutcomePhase) instead of being drawn here. Rendering
             «◈ ПОКУПКА» inside someone else's frame is what made this stage
             read as a modal that had arrived rather than the next step of the
             action the player just confirmed. The TITLE stays — it is the
             server's instruction («Выберите карты для покупки»), not an
             identity — but demotes to a subtitle under the breadcrumb. -->
        <!-- EMBEDDED: the SHARED stage header component — the stage's sentence
             and its live state on ONE row. The drawn reveal renders the very
             same component, so the two stages are one styled thing (markup,
             height, hierarchy, profile ladders) rather than two look-alike
             rule sets that have drifted apart four times already. -->
        <ConsoleWsStageHead v-if="embedded" class="con-task__head" :title="titleText">
          <template v-if="embeddedBadges.length > 0" #badges>
            <span v-for="badge in embeddedBadges" :key="badge.key" class="con-ws-stage-badge"
                  :class="{'con-ws-stage-badge--warn': badge.warn}">
              <span class="con-ws-stage-badge__label">{{ badge.label }}</span>
              <b class="con-ws-stage-badge__num">{{ badge.value }}</b>
              <i v-if="badge.coin" class="resource_icon resource_icon--megacredits con-ws-stage-badge__coin" aria-hidden="true"></i>
            </span>
          </template>
        </ConsoleWsStageHead>
        <header v-else class="con-task__head">
          <div class="con-task__kicker">
            <span class="con-task__kicker-mark" aria-hidden="true">◈</span>
            <span>{{ $t(kickerText) }}</span>
          </div>
          <div class="con-task__title">{{ titleText }}</div>
          <!-- Phase note (draft: what happens to the cards you don't keep). -->
          <div v-if="phaseSubtext !== ''" class="con-task__subtext">{{ phaseSubtext }}</div>
          <div v-if="triggerText !== ''" class="con-task__trigger">{{ triggerText }}</div>
          <!-- Card browser: the live pick counter (multi only) + BUY economics.
               The buy price is per-card RESEARCH cost (base 3 M€), never the
               card's printed cost — see buyCostPerCard. -->
          <!-- EMBEDDED single card: the counters fold away — «Выбрано 0/1»
               and a running total are mass-selector instruments, and for one
               revealed card the economics live on the card's own status line
               below (price / balance after). Multi-card keeps them all. -->
          <div v-if="activeTask.kind === 'cardSelect' && (!singlePick || isBuyMode) && !embeddedSingleBuy" class="con-task__pickline">
            <span v-if="!singlePick" class="con-task__pickcount" :class="{'con-task__pickcount--ready': cardPicksValid}">
              {{ $t('Selected') }}: <b>{{ picks.length }}</b><template v-if="cardMax > 0"> / {{ cardMax }}</template>
            </span>
            <template v-if="isBuyMode">
              <!-- Main total + muted "N × unit" breakdown — honest, printed-cost-free. -->
              <span class="con-task__buysum" :class="{'con-task__buysum--over': !cardBuyAffordable}">
                <span class="con-task__buysum-total">{{ $t('Purchase') }}: −{{ buyTotal }}<i class="resource_icon resource_icon--megacredits con-task__buysum-mc" aria-hidden="true"></i></span>
                <span v-if="picks.length > 0" class="con-task__buysum-detail">{{ picks.length }} × {{ buyCostPerCard }} {{ $t('per card') }}</span>
              </span>
              <!-- Wallet: you-have + after-purchase (only when affordable).
                   The coin sits in an inline-flex item so it is vertically
                   CENTRED on the number (a bare inline <i> floated on the text
                   baseline — the "crooked coin"). -->
              <span class="con-task__buywallet">
                <span class="con-task__buywallet-item">{{ $t('You have') }}: <b>{{ megacreditsOnHand }}</b><i class="resource_icon resource_icon--megacredits con-task__buysum-mc" aria-hidden="true"></i></span>
                <span v-if="picks.length > 0 && cardBuyAffordable" class="con-task__buywallet-after">{{ $t('After purchase') }}: <b>{{ megacreditsAfterPurchase }}</b></span>
              </span>
            </template>
          </div>
          <!-- Insufficient-funds banner (buy phase) — RT is also disabled. -->
          <div v-if="isBuyMode && picks.length > 0 && !cardBuyAffordable" class="con-task__buywarn">⚠ {{ buyShortfallText }}</div>
          <!-- Drafted-cards zone (draft only): COMPACT count here (the wide
               modal covers the corners); RT opens the read-only viewer. The
               desktop-style stack is drawn on the calm draftWait banner. -->
          <div v-if="isDraftPick && draftedCards.length > 0" class="con-task__drafted">
            <span class="con-task__drafted-label">{{ $t('DRAFTED CARDS') }}</span>
            <span class="con-task__drafted-count">{{ draftedCards.length }}</span>
            <span v-if="canInspectDrafted" class="con-task__drafted-hint"><GamepadGlyph control="triggerR" /><span>{{ $t('Inspect') }}</span></span>
          </div>
          <!-- (The payment price + live coverage are NOT repeated here: the
               shared payment panel below owns both, so there is exactly one
               place in the UI stating what this costs and what is covered.) -->
        </header>

        <div class="con-task__main">
          <!-- WHO asked — the SHARED source dock (`console-source-dock`, global
               in main.ts), identical on every decision surface.
               COMPACT when the prompt is a DIAL or a LIST the card merely
               produced (Philares' resource distribution): the card is context,
               recognisable but never the subject, and L3 opens it. A `choice`
               keeps the full dock and its X — there the card IS what is being
               decided about. -->
          <console-source-dock v-if="dockedSource !== undefined" :view="dockedSource"
                               :compact="sourceCompact" ref="sourceCard" />

          <div class="con-task__body con-info__scroll" ref="body">
            <!-- Warnings carry over (parity). -->
            <div v-if="warningTexts.length > 0" class="con-task__warnings">
              <div v-for="(w, i) in warningTexts" :key="i" class="con-task__warning">⚠ {{ w }}</div>
            </div>

            <!-- ── CHOICE ─────────────────────────────────────────── -->
            <template v-if="activeTask.kind === 'choice'">
              <div v-for="(entry, i) in choiceEntries" :key="'o' + entry.index"
                   class="con-task__option"
                   :class="{
                     'con-task__option--focused': focusIdx === i,
                     'con-task__option--armed': focusIdx === i && armed,
                     'con-task__option--skip': entry.isSkip,
                   }">
                <div class="con-task__option-main">
                  <i v-if="entry.iconClass !== ''" class="con-task__opt-icon" :class="entry.iconClass" aria-hidden="true"></i>
                  <span v-if="entry.playerColor !== undefined" class="con-task__opt-player">
                    <span :class="'con-status__dot player_bg_color_' + entry.playerColor"></span>
                    <span>{{ entry.playerName }}</span>
                  </span>
                  <span class="con-task__opt-title">{{ entry.title }}</span>
                  <span v-if="entry.preview !== ''" class="con-task__opt-preview">{{ entry.preview }}</span>
                  <span v-if="entry.isSpace" class="con-task__opt-board">{{ $t('Choose a location on the board') }} →</span>
                  <span v-else-if="entry.isNested" class="con-task__opt-board" aria-hidden="true">›</span>
                  <!-- A CONTEXTUAL choice commits on A in one press, so the badge
                       ALWAYS advertises A — never the old "A selects, now press X"
                       two-step (a risky option arms and the second A confirms,
                       which is still this same glyph). A GENERIC OrOptions keeps
                       its desktop-parity select → confirm, and says so. -->
                  <GamepadGlyph v-if="focusIdx === i"
                                :control="!choiceOnePress && armed ? 'secondary' : 'confirm'"
                                class="con-task__opt-a" />
                </div>
                <div v-if="entry.effects.length > 0" class="con-task__opt-effects">
                  <ActionEffectChip v-for="(eff, k) in entry.effects" :key="k" :effect="eff" />
                </div>
                <div v-if="entry.description !== ''" class="con-task__opt-desc">{{ entry.description }}</div>
                <div v-if="entry.tradeoff !== ''" class="con-task__opt-tradeoff">⚠ {{ entry.tradeoff }}</div>
                <!-- The engine's own caution, in words. Rendered on the ROW, not
                     only in the arm bar, so it is readable BEFORE the first press
                     — a warning that appears only after you have committed to
                     pressing is a receipt, not a warning. -->
                <div v-for="(w, k) in entry.warnings" :key="'w' + k" class="con-task__opt-tradeoff">⚠ {{ w }}</div>
                <div v-if="focusIdx === i && armed && entry.risky" class="con-task__opt-confirmbar">
                  {{ entry.warnings.length > 0 ? entry.warnings[0] : entry.tradeoff }}
                  <span class="con-task__opt-confirmbar-cta">{{ $t('Press again to confirm') }}</span>
                </div>
              </div>
              <div v-if="disabledChoiceEntries.length > 0" class="con-task__disabled">
                <div class="con-task__disabled-title">{{ $t('Unavailable targets') }}</div>
                <div v-for="(d, i) in disabledChoiceEntries" :key="'d' + i" class="con-task__option con-task__option--disabled">
                  <div class="con-task__option-main">
                    <span v-if="d.playerColor !== undefined" class="con-task__opt-player">
                      <span :class="'con-status__dot player_bg_color_' + d.playerColor"></span>
                    </span>
                    <span class="con-task__opt-title">{{ d.title }}</span>
                    <span class="con-task__opt-reason">{{ d.reason }}</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- ── PLAYER ─────────────────────────────────────────── -->
            <template v-else-if="activeTask.kind === 'player'">
              <div v-for="(p, i) in playerEntries" :key="p.color"
                   class="con-task__option"
                   :class="{'con-task__option--focused': focusIdx === i, 'con-task__option--armed': focusIdx === i && armed}">
                <div class="con-task__option-main">
                  <span class="con-task__opt-player">
                    <span :class="'con-status__dot player_bg_color_' + p.color"></span>
                    <span>{{ p.name }}</span>
                  </span>
                  <span v-if="p.corp !== ''" class="con-task__opt-corp">{{ $t(p.corp) }}</span>
                  <!-- «Это вы»: the rules permit hitting your own production, so
                       the option stays and the job is to make it unpickable by
                       accident. Only when it costs you AND another target was
                       available. -->
                  <span v-if="p.selfHarm" class="con-task__opt-selfwarn">⚠ {{ $t('This is you') }}</span>
                  <!-- Server-computed before→after rows — the SAME layout for a
                       human resource/production row and a MarsBot track row. -->
                  <span v-if="p.changes.length > 0" class="con-task__opt-previews">
                    <span v-for="(row, ri) in p.changes" :key="ri" class="con-task__opt-preview" :class="{'con-task__opt-preview--prod': row.prod}">
                      <Tag v-if="row.isTrack" :tag="row.tag!" size="small" type="secondary" class="con-task__opt-tag" />
                      <i v-else :class="row.iconClass" class="con-task__opt-icon" aria-hidden="true"></i>
                      {{ row.from }} → {{ row.to }}
                      <span v-if="row.steps !== undefined && row.steps > 0" class="con-task__opt-steps">−{{ row.steps }}</span>
                    </span>
                  </span>
                  <GamepadGlyph v-if="focusIdx === i" :control="armed ? 'secondary' : 'confirm'" class="con-task__opt-a" />
                </div>
              </div>
              <div v-if="disabledPlayerEntries.length > 0" class="con-task__disabled">
                <div class="con-task__disabled-title">{{ $t('Unavailable targets') }}</div>
                <div v-for="(d, i) in disabledPlayerEntries" :key="'dp' + i" class="con-task__option con-task__option--disabled">
                  <div class="con-task__option-main">
                    <span class="con-task__opt-player">
                      <span :class="'con-status__dot player_bg_color_' + d.color"></span>
                      <span>{{ d.name }}</span>
                    </span>
                    <span class="con-task__opt-reason">{{ d.reason }}</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- ── AMOUNT ─────────────────────────────────────────── -->
            <template v-else-if="activeTask.kind === 'amount'">
              <!-- PREMIUM CONVERSION (the server's `conversion` hint — e.g.
                   Supercapacitors' optional production-phase energy→heat):
                   compact selector + ONE result preview stating both sides'
                   `current → after`. No in-panel button hints — the bottom
                   command bar is the one source of verbs (§3.2). The panel
                   locks visually on submit; the ACTUAL conversion plays as the
                   existing rail transition after this surface leaves. -->
              <div v-if="conversionVm !== undefined" class="con-convert"
                   :class="{'con-convert--committing': submitting}">
                <!-- 0..1 = a BINARY CHOICE, not a dial («THE INSTRUMENT FOLLOWS
                     THE BUDGET»): two plates, focus IS the pending value, A
                     commits the focused one. LB/RB/MAX still land here. -->
                <div v-if="conversionVm.binary" class="con-convert__choices">
                  <div class="con-task__option con-task__option--skip"
                       :class="{'con-task__option--focused': value === 0}">
                    <div class="con-task__option-main">
                      <span class="con-task__opt-title">{{ $t('Do not convert') }}</span>
                      <GamepadGlyph v-if="value === 0" control="confirm" class="con-task__opt-a" />
                    </div>
                  </div>
                  <div class="con-task__option"
                       :class="{'con-task__option--focused': value === conversionVm.max}">
                    <div class="con-task__option-main">
                      <i class="con-task__opt-icon" :class="'resource_icon resource_icon--' + conversionVm.from.icon" aria-hidden="true"></i>
                      <span class="con-task__opt-title">{{ convertMaxLabel }}</span>
                      <GamepadGlyph v-if="value === conversionVm.max" control="confirm" class="con-task__opt-a" />
                    </div>
                  </div>
                </div>
                <!-- >1 available: the compact dial. The − / + pills are STATE
                     (dim at the bound — no wrap-around), not mouse targets:
                     this host is pad/keyboard-driven like every con-task kind. -->
                <div v-else class="con-convert__dial">
                  <span class="con-convert__step" :class="{'con-convert__step--out': value <= conversionVm.min}" aria-hidden="true">−</span>
                  <span class="con-convert__readout">
                    <i class="con-convert__res resource_icon" :class="'resource_icon--' + conversionVm.from.icon" aria-hidden="true"></i>
                    <span class="con-convert__value">{{ value }}</span>
                    <span class="con-convert__of">/ {{ conversionVm.max }}</span>
                  </span>
                  <span class="con-convert__step" :class="{'con-convert__step--out': value >= conversionVm.max}" aria-hidden="true">+</span>
                </div>
                <!-- THE OPERATION, both sides at once: source row → target row,
                     linked — the SHARED preview (same component the composers'
                     amount rows render, one derivation, one markup). -->
                <ConsoleAmountOperation :vm="conversionVm" />
              </div>
              <!-- Generic amount dial (no conversion hint) — hints live in the
                   bottom command bar only, never repeated in the panel. -->
              <template v-else>
                <div class="con-task__stepper">
                  <i v-if="amountIconClass !== ''" :class="amountIconClass" class="con-task__stepper-icon" aria-hidden="true"></i>
                  <div class="con-task__stepper-readout">
                    <span class="con-task__stepper-value">{{ value }}</span>
                    <span v-if="amountUnit !== ''" class="con-task__stepper-unit">{{ amountUnit }}</span>
                  </div>
                  <div class="con-task__stepper-range">{{ amountMin }} – {{ amountMax }}</div>
                </div>
                <!-- The dial's DIRECTION, when the model states one (result /
                     price): the same live cost → gain chips the composer
                     shows, so a natively-arriving SelectAmount is never a bare
                     number the player has to guess the meaning of. -->
                <div v-if="amountCostChips.length > 0 || amountGainChips.length > 0" class="con-task__stepper-formula">
                  <ActionEffectChip v-for="(eff, k) in amountCostChips" :key="'ac' + k" :effect="eff" />
                  <span v-if="amountCostChips.length > 0 && amountGainChips.length > 0" class="con-task__stepper-arrow" aria-hidden="true">→</span>
                  <ActionEffectChip v-for="(eff, k) in amountGainChips" :key="'ag' + k" :effect="eff" />
                </div>
              </template>
            </template>

            <!-- ── RESOURCE ───────────────────────────────────────── -->
            <template v-else-if="activeTask.kind === 'resource'">
              <div class="con-task__tiles">
                <div v-for="(unit, i) in resourceUnits" :key="unit"
                     class="con-task__tile"
                     :class="{'con-task__tile--focused': focusIdx === i, 'con-task__tile--armed': focusIdx === i && armed}">
                  <i class="con-task__tile-icon" :class="'resource_icon resource_icon--' + unit" aria-hidden="true"></i>
                  <GamepadGlyph v-if="focusIdx === i" :control="armed ? 'secondary' : 'confirm'" class="con-task__opt-a" />
                </div>
              </div>
            </template>

            <!-- ── CARD BROWSER (T2 · P13 rework): ONE clean composition —
                 the focused card is emphasized IN PLACE (scaled up,
                 neighbours calmed), X opens the fullscreen viewer; >6
                 candidates wrap into a GRID (no kilometre scrolling). -->
            <template v-else-if="activeTask.kind === 'cardSelect'">
              <div class="con-cards">
                <div class="con-cards__strip"
                     :class="{'con-cards__strip--grid': gridMode, 'con-cards__strip--has-focus': cardEntries.length > 0,
                              'con-ws-stage-row': embedded && !gridMode}"
                     ref="cardStrip">
                  <!-- P15: no per-card cost overlay (the buy math lives in
                       the pickline), strong «✓ SELECTED» band, unpicked
                       cards de-emphasize at the pick max. -->
                  <!-- During a draft pick BEAT the chosen card flies to the
                       tray as a proxy — its slot must show NOTHING (holdSource
                       hides the card image, but the slot's OWN --focused /
                       --picked outline and the «✓ Выбрана» band live on the
                       slot, not the card, so they'd linger in the empty slot).
                       `trayPickBeat` suppresses that chrome + the band. -->
                  <div v-for="(entry, i) in cardEntries" :key="entry.card.name + '#' + i"
                       class="con-cards__slot"
                       :data-zoom-slot="entry.card.name"
                       :class="{
                         'con-cards__slot--focused': focusIdx === i && !trayPickBeat && !arrivalPending,
                         'con-cards__slot--picked': isPicked(entry.card.name) && !trayPickBeat,
                         'con-cards__slot--disabled': entry.disabled,
                         'con-cards__slot--dim': cardDimUnpicked && !entry.disabled && !isPicked(entry.card.name),
                         'con-deal-hold': deal.isHeld(entry.card.name + '#' + i),
                       }"
                       :ref="focusIdx === i ? 'focusedCardSlot' : undefined">
                    <Card :card="entry.card" :key="entry.card.name" lightweight />
                    <span v-if="isPicked(entry.card.name) && !trayPickBeat" class="con-cards__pickband" aria-hidden="true">✓ {{ $t('Card selected') }}</span>
                    <!-- P18: disabled candidates wear the state badge + the
                         concrete reason line (glance + detail). -->
                    <span v-else-if="entry.disabled" class="con-cards__pickband con-cards__pickband--disabled" aria-hidden="true">{{ $t('Unavailable') }}</span>
                    <span v-if="entry.disabled" class="con-cards__reason">{{ entry.reason !== '' ? entry.reason : $t('Unavailable right now') }}</span>
                  </div>
                </div>
                <!-- The focused card's verdict line — compact context, never a
                     duplicate card (X = the universal fullscreen INSPECT read).
                     PICK phase: A = select (one press commits, no deselect).
                     BUY / multi: A = select/deselect, RT = commit the set. -->
                <!-- ALWAYS IN LAYOUT once the browser has cards: the bar
                     reserves its row from the first frame, so the fit engine
                     measures the true modal chrome and the deal's end can never
                     reflow the strip (the old v-if mounted it late — the "rail
                     pops in under the cards" jump). While the cinematic runs
                     only its CONTENT hides (opacity — never promise a selection
                     that isn't interactive yet). -->
                <div v-if="cardEntries.length > 0" class="con-cards__verdictbar"
                     :class="{'con-cards__verdictbar--held': deal.state.active || trayPickBeat || arrivalPending,
                              'con-ws-stage-status': embedded}">
                  <div v-if="focusedCardEntry !== undefined" class="con-cards__verdict-inner">
                    <!-- Only the NAME re-keys on a d-pad move (a one-shot settle,
                         no out-in gap); the button-hint chips are PERSISTENT
                         nodes patched in place — they never blink between cards
                         (the old wholesale keyed swap faded them all out/in). -->
                    <span class="con-cards__verdict-name" :key="focusedCardEntry.card.name">{{ $t(focusedCardEntry.card.name) }}</span>
                    <span v-if="focusedCardEntry.disabled" class="con-cards__verdict con-cards__verdict--blocked">
                      <span aria-hidden="true">✕</span>
                      <span>{{ focusedCardEntry.reason !== '' ? focusedCardEntry.reason : $t('Unavailable right now') }}</span>
                    </span>
                    <!-- EMBEDDED (inside a workspace): this line is STATUS, not a
                         second command bar — the bottom bar is the one source of
                         gamepad verbs, and repeating A/X/RT here made two footers
                         compete. What earns its place beside the card is what the
                         bar cannot say: the card's own economics. -->
                    <template v-else-if="embedded">
                      <!-- The aggregate SHORTFALL outranks the economics: it is
                           the one thing that stops the decision, and now that
                           the header is a single row this line is where the
                           embedded stage states things. -->
                      <span v-if="isBuyMode && picks.length > 0 && !cardBuyAffordable"
                            class="con-cards__verdict con-cards__verdict--blocked">
                        <span aria-hidden="true">⚠</span><span>{{ buyShortfallText }}</span>
                      </span>
                      <template v-else-if="embeddedSingleBuy">
                        <!-- «Покупка: 3», not «Цена карты»: the card face already
                             wears its PRINTED cost badge, and a second «price of
                             the card» beside it read as a contradiction — this
                             number is what BUYING it to hand costs (the research
                             cost, discounts included server-side). -->
                        <span class="con-cards__verdict con-cards__verdict--price">
                          <span>{{ $t('Purchase') }}: <b>{{ buyCostPerCard }}</b></span>
                          <i class="resource_icon resource_icon--megacredits con-task__buysum-mc" aria-hidden="true"></i>
                        </span>
                        <span v-if="isPicked(focusedCardEntry.card.name) && cardBuyAffordable" class="con-cards__verdict con-cards__verdict--picked">
                          <span>{{ $t('After purchase') }}: <b>{{ megacreditsAfterPurchase }}</b></span>
                          <i class="resource_icon resource_icon--megacredits con-task__buysum-mc" aria-hidden="true"></i>
                        </span>
                      </template>
                      <!-- A blocked STATE is information, not a command — it stays. -->
                      <span v-else-if="!singlePick && !isPicked(focusedCardEntry.card.name) && !canPickFocusedCard"
                            class="con-cards__verdict con-cards__verdict--blocked">
                        <span aria-hidden="true">✕</span><span>{{ $t('Deselect another card first') }}</span>
                      </span>
                    </template>
                    <template v-else>
                      <span v-if="singlePick" class="con-cards__verdict con-cards__verdict--ok">
                        <GamepadGlyph control="confirm" /><span>{{ $t('Select') }}</span>
                      </span>
                      <span v-else-if="isPicked(focusedCardEntry.card.name)" class="con-cards__verdict con-cards__verdict--picked">
                        <GamepadGlyph control="confirm" /><span>{{ $t('Deselect') }}</span>
                      </span>
                      <span v-else-if="canPickFocusedCard" class="con-cards__verdict con-cards__verdict--ok">
                        <GamepadGlyph control="confirm" /><span>{{ $t('Select') }}</span>
                      </span>
                      <span v-else class="con-cards__verdict con-cards__verdict--blocked">
                        <span aria-hidden="true">✕</span><span>{{ $t('Deselect another card first') }}</span>
                      </span>
                      <span class="con-cards__verdict con-cards__verdict--zoom">
                        <GamepadGlyph control="secondary" /><span>{{ $t('Inspect') }}</span>
                      </span>
                      <span v-if="!singlePick && confirmReady" class="con-cards__verdict con-cards__verdict--go">
                        <GamepadGlyph control="triggerR" /><span>{{ $t(cardConfirmLabel) }}</span>
                      </span>
                    </template>
                  </div>
                </div>
              </div>
            </template>

            <!-- ── PAYMENT (T3) — the SHARED payment panel, in its EXPANDED
                 density: this whole screen IS the payment, so the editor is
                 the resting state. Identical rows / verdict / geometry to the
                 payment block inside the card-play and blue-action composers,
                 so a player who learned one has learned all three. The command
                 bar already carries the controls → no in-panel hint. ────── -->
            <template v-else-if="activeTask.kind === 'payment' && paymentView !== undefined">
              <ConsolePaymentPanel :view="paymentView"
                                   mode="expanded"
                                   hint-mode="none"
                                   :focus-unit="payFocusUnit"
                                   :flash-nonce="payFlashNonce" />
            </template>

            <!-- ── PROJECT CARD (generic — desktop-removal wave 2): the
                 fallback the legacy MandatoryInputModal used to serve. PICK
                 rides the shared card-browser chassis; PAY is the shared
                 payment panel beside the chosen card; ONE submit
                 {type:'projectCard', card, payment}. ─────────────────── -->
            <template v-else-if="activeTask.kind === 'projectCard'">
              <div v-if="pcStage === 'pick'" class="con-cards">
                <div class="con-cards__strip"
                     :class="{'con-cards__strip--grid': pcGrid, 'con-cards__strip--has-focus': pcEntries.length > 0}"
                     ref="cardStrip">
                  <div v-for="(entry, i) in pcEntries" :key="entry.card.name + '#' + i"
                       class="con-cards__slot"
                       :data-zoom-slot="entry.card.name"
                       :class="{
                         'con-cards__slot--focused': focusIdx === i,
                         'con-cards__slot--disabled': entry.disabled,
                       }"
                       :ref="focusIdx === i ? 'focusedCardSlot' : undefined">
                    <Card :card="entry.card" :key="entry.card.name" lightweight />
                  </div>
                </div>
              </div>
              <div v-else class="con-task__pcpay">
                <div class="con-task__pcpay-card">
                  <Card v-if="pcPicked !== undefined" :card="pcPicked" :key="pcPicked.name" lightweight />
                </div>
                <div class="con-task__pcpay-panel">
                  <ConsolePaymentPanel v-if="pcPaymentView !== undefined"
                                       :view="pcPaymentView"
                                       mode="expanded"
                                       hint-mode="none"
                                       :focus-unit="pcFocusUnit"
                                       :flash-nonce="payFlashNonce" />
                </div>
              </div>
            </template>

            <!-- ── DISTRIBUTE ─────────────────────────────────────── -->
            <template v-else-if="activeTask.kind === 'distribute'">
              <!-- The budget meter. The SINGLE-STEP gain drops it («Всего 0/1»
                   over a radio restates the title's own count — the Venus-bonus
                   rule); the blocked line below then carries the honest «why
                   not yet». The production loss keeps it always: there the
                   meter IS the readout of the server's cost. -->
              <div v-if="activeTask.mode === 'production' || !distSingleStep"
                   class="con-task__dist-target" :class="{'con-task__dist-target--ready': distributeReady}">
                {{ $t('Total') }}: <b>{{ distributedSum }}</b> / {{ distributeTarget }}
              </div>
              <div v-if="distBlockedText !== ''" class="con-task__dist-blocked">⚠ {{ distBlockedText }}</div>
              <div v-for="(lane, i) in lanes" :key="lane.key"
                   class="con-task__lane"
                   :class="{
                     'con-task__lane--focused': focusIdx === i,
                     'con-task__lane--active': laneValue(lane.key) > 0,
                     'con-task__lane--gain': activeTask.mode === 'resources',
                   }">
                <span class="con-task__lane-id" :class="{'con-task__lane-id--prod': activeTask.mode === 'production'}">
                  <i class="con-task__opt-icon" :class="lane.iconClass" aria-hidden="true"></i>
                </span>
                <span class="con-task__lane-name">{{ $t(lane.label) }}</span>

                <!-- The production LOSS: picked / the server's own cap. -->
                <template v-if="activeTask.mode === 'production'">
                  <span class="con-task__lane-value">{{ laneValue(lane.key) }}</span>
                  <span class="con-task__lane-max">/ {{ lane.max }}</span>
                </template>
                <!-- The GAIN: what you have → what it becomes. The stock CAPS
                     nothing (the budget is the only limit) — it is the reading
                     that makes «where does the bonus land» a real decision. -->
                <template v-else>
                  <span class="con-task__lane-stock">
                    <span class="con-task__lane-cur" :class="{'con-task__lane-cur--faded': laneValue(lane.key) > 0}">{{ lane.available }}</span>
                    <template v-if="laneValue(lane.key) > 0">
                      <span class="con-task__lane-arrow" aria-hidden="true">→</span>
                      <span class="con-task__lane-next">{{ (lane.available ?? 0) + laneValue(lane.key) }}</span>
                    </template>
                  </span>
                  <span v-if="!distSingleStep" class="con-task__lane-delta" :class="{'con-task__lane-delta--empty': laneValue(lane.key) === 0}">
                    <template v-if="laneValue(lane.key) > 0">+{{ laneValue(lane.key) }}</template>
                  </span>
                </template>

                <span class="con-task__lane-keys" aria-hidden="true">
                  <!-- SINGLE-STEP: the chosen lane keeps its mark once the
                       cursor moves on; the focused row shows the A gesture —
                       BOTH when they coincide (the cursor is not the answer). -->
                  <template v-if="distSingleStep">
                    <span v-if="laneValue(lane.key) > 0" class="con-task__lane-tick">✓</span>
                    <GamepadGlyph v-if="focusIdx === i" control="confirm" />
                  </template>
                  <template v-else-if="focusIdx === i">
                    <GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />
                  </template>
                </span>
              </div>
            </template>
          </div>
        </div>

        <!-- The command contract publishes to the shell's ONE bottom command
             bar via consolePanelUi (CONSOLE_TV_PREMIUM_PLAN §3.2) — the
             footCommands watch below; no panel-local hint row. -->
      </div>
    </transition>

    <!-- The deal cinematic stage (draft / buy / research card sets). -->
    <ConsoleCardDealLayer v-if="deal.state.active" ref="dealLayer"
                          :cards="deal.state.cards" :models="dealModels" :nonce="deal.state.nonce" />
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE TASK HOST — CTS T1–T3 (docs/CONSOLE_MODE_CONCEPT.md §CTS-1). The
 * single console-native surface for the prompt kinds: T1 primitives
 * (choice / player / amount / resource / distribute) + the T2 CARD
 * BROWSER (draft / buy / select / target — inspector + filmstrip, pick
 * counter, buy economics, disabled candidates with reasons) + the T3
 * PAYMENT lanes (desktop ledger math via paymentPlan.ts; M€ is an AUTO
 * lane so under/over-payment is impossible). The desktop
 * MandatoryInputModal is SUPPRESSED whenever this host serves
 * (taskServedByHost) — no fallback. `promptOverride` additionally hosts
 * CLIENT-BUILT prompts (the standard-project alt-resource payment) where
 * B = Cancel instead of Minimize (`deferLabel`).
 *
 * Control grammar (user-mandated):
 *   A  = select / toggle the focused element; A on the selected = confirm
 *   X  = CONFIRM in one press from anywhere (risky options arm first)
 *   B  = cancel when possible, else DEFER (inspect the board; B returns)
 *   LB/RB = −1 / +1 on value lanes · ←/→ mirror · Y = MAX
 *
 * INFO PARITY (CTS-3.8): the source card renders as the REAL <Card>;
 * option metadata (icons, player chips, current→resulting, effect chips
 * via the shared ActionEffectChip, tradeoffs, descriptions), disabled
 * targets with reasons and prompt warnings all carry over from the desktop
 * premium inputs. Submission payloads are byte-identical (taskResponses).
 */
import {defineComponent, PropType} from 'vue';
import {useEventListener, useResizeObserver} from '@vueuse/core';
import Card from '@/client/components/card/CardFace.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel, OrOptionsModel, SelectAmountModel, SelectOptionModel, OptionMetadata, SelectCardModel, SelectPaymentModel, SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Phase} from '@/common/Phase';
import {Color} from '@/common/Color';
import {Units} from '@/common/Units';
import {Message} from '@/common/logs/Message';
import {Tag} from '@/common/cards/Tag';
import {getCard} from '@/client/cards/ClientCardManifest';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {playerResourceValue} from '@/client/components/modalInputs/playerResourceFields';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {conversionPromptVm, conversionCommitLabel, ConversionPromptVm} from '@/client/console/conversionPromptModel';
import {setConversionPromptWatch, clearConversionPromptWatch} from '@/client/console/conversionPromptUi';
import {Warning} from '@/common/cards/Warning';
import {warningText} from '@/client/components/card/cardWarnings';
import {targetImpactIsLoss} from '@/client/components/modalInputs/targetImpactRows';
import {ConsoleTask} from '@/client/console/consoleTaskRouter';
import {fitRowZoom} from '@/client/console/cardStripFit';
import {wsStageLayout, wsStageLayoutStyle} from '@/client/console/consoleWsStageLayout';
import ConsoleWsStageHead from '@/client/components/console/foundation/ConsoleWsStageHead.vue';
import ConsoleAmountOperation from '@/client/components/console/foundation/ConsoleAmountOperation.vue';
import {rememberCardBrowserPicks, recallCardBrowserPicks, clearCardBrowserPicks} from '@/client/console/consoleRouter';
import {consoleTaskSummary} from '@/client/console/consoleTaskSummary';
import {promptSourceView, PromptSourceView} from '@/client/console/promptSource';
import {setWorkspaceOutcomePhase, workspaceOutcomeArrivalPending, workspaceOutcomeState, workspaceSourceZoomOrigin} from '@/client/console/consoleWorkspaceOutcome';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {TargetImpact, TargetImpactChange} from '@/common/models/TargetImpactModel';
import TagComponent from '@/client/components/Tag.vue';
import {displayNameForColor, participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';

/** A render-ready target-impact row: a resource/M€ stock change (iconClass), or
 *  a MarsBot production hit shown as its track's Tag + step count. */
type TargetRowVM = {isTrack: boolean, tag?: Tag, iconClass: string, from: number, to: number, steps?: number, prod: boolean};
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {productionLossLanes, standardGainLanes} from '@/client/console/compositePrompts';
import {
  BudgetLane, BudgetRule, BudgetState, budgetBlockedKey, budgetSingleStep, budgetTotal, budgetValid,
  maxOntoLane, stepLane, toggleSoleStep,
} from '@/client/console/budgetLanes';
import {GlyphControl} from '@/client/gamepad/glyphSets';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {setPanelCommands, clearPanelCommands} from '@/client/console/consolePanelUi';
import {
  amountResponse, cardsResponse, deltaProjectResponse, optionConfirmResponse, orOptionResponse,
  orWrappedResponse, paymentResponse, playerResponse, productionToLoseResponse, projectCardResponse,
  resourceResponse, resourcesResponse,
} from '@/client/console/taskResponses';
import {CardModel} from '@/common/models/CardModel';
import {SpendableResource} from '@/common/inputs/Spendable';
import {
  buildPaymentView, editableRows, initialCounts, dialLaneCount, megacreditsAvailable, paymentCovers,
  paymentFromCounts, PaymentLane, paymentLanes, paymentTotal, PaymentView,
  projectCardPaymentPrompt,
} from '@/client/console/paymentPlan';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {applyDiscardExit, ExitSource, runHeroPick} from '@/client/console/cardDeal/cardExitDirector';
import {discardOpenCards} from '@/client/console/cardDiscard/discardOpenCard';
import {runHandIntake} from '@/client/console/handDock/handDeliveryDirector';
import {createCardDealSequence, RiseLaunchExtras} from '@/client/console/cardDeal/cardDealSequence';
import {shouldRunDealOnce} from '@/client/console/cardDeal/cardDealMemory';
import {DealTargetRect} from '@/client/console/cardDeal/cardDealDirector';
import {
  beginRiseScene, draftPickBeatActive, draftTrayState, finishRiseScene, resolveTraySlot,
  riseArrivalLanded, riseFrameReveal, riseLiftOff, riseSceneEngaged, riseSetComplete,
  runDraftPickBeat, skipDraftPickBeat, whenPickBeatDone,
} from '@/client/console/cardDeal/consoleDraftTray';
import {motionMs} from '@/client/components/motion/motionTokens';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import ConsoleCardDealLayer from '@/client/components/console/cardDeal/ConsoleCardDealLayer.vue';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';
import {isHandCardSelection} from '@/client/console/consoleHandPick';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

type ChoiceEntry = {
  index: number,
  title: string,
  iconClass: string,
  playerColor: Color | undefined,
  playerName: string,
  preview: string,
  effects: ReadonlyArray<ActionEffect>,
  description: string,
  tradeoff: string,
  /** The engine's own per-option cautions, already resolved to sentences. */
  warnings: ReadonlyArray<string>,
  isSkip: boolean,
  isSpace: boolean,
  /** T9: the option nests a hostable input — confirming OPENS it (one-level wizard). */
  isNested: boolean,
  risky: boolean,
  option: PlayerInputModel,
};

/**
 * T9: the task kind a NESTED option's input maps to (the one-level
 * wizard). Composites (`and`) and deeper `or` nesting are NOT here — they
 * stay on the desktop modal (the router's serve predicate mirrors this).
 */
function nestedTaskFor(input: PlayerInputModel): ConsoleTask | undefined {
  switch (input.type) {
  case 'card':
    return {kind: 'cardSelect', mode: 'target'};
  case 'payment':
    return {kind: 'payment'};
  case 'amount':
    return {kind: 'amount', flavor: 'generic'};
  case 'player':
    return {kind: 'player'};
  case 'resource':
    return {kind: 'resource'};
  case 'resources':
    return {kind: 'distribute', mode: 'resources'};
  case 'productionToLose':
    return {kind: 'distribute', mode: 'production'};
  default:
    return undefined;
  }
}

const RESOURCE_FIELD: Record<string, {stock: string, production: string}> = {
  megacredits: {stock: 'megacredits', production: 'megacreditProduction'},
  steel: {stock: 'steel', production: 'steelProduction'},
  titanium: {stock: 'titanium', production: 'titaniumProduction'},
  plants: {stock: 'plants', production: 'plantProduction'},
  energy: {stock: 'energy', production: 'energyProduction'},
  heat: {stock: 'heat', production: 'heatProduction'},
};

export default defineComponent({
  name: 'ConsoleTaskHost',
  components: {Card, GamepadGlyph, ActionEffectChip, Tag: TagComponent, ConsoleCardDealLayer, ConsolePaymentPanel, ConsoleWsStageHead, ConsoleAmountOperation},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    task: {type: Object as PropType<ConsoleTask>, required: true},
    /**
     * CLIENT-SIDE prompt override (T3): hosts a client-built input (the
     * standard-project alt-resource payment) instead of `waitingFor` —
     * nothing is committed server-side, so B = CANCEL (`deferLabel`).
     */
    promptOverride: {type: Object as PropType<PlayerInputModel | undefined>, default: undefined},
    /** The B affordance label: 'Minimize' (server prompt) / 'Cancel' (client). */
    deferLabel: {type: String, default: 'Minimize'},
    /**
     * EMBEDDED — this host is teleported into a workspace that CLAIMED the
     * prompt (consoleWorkspaceOutcome), instead of rising as its own band.
     * Same instance and same submit path; it sheds the band geometry, the
     * `con-ws` rail marker and its motion-surface identity, because the
     * workspace frame is already the surface and already owns the rail.
     */
    embedded: {type: Boolean, default: false},
  },
  emits: ['submit', 'defer', 'space-pick', 'hand-pick', 'result-detached'],
  data() {
    return {
      focusIdx: 0,
      armed: false,
      value: 0,
      units: {} as Partial<Record<keyof Units, number>>,
      /** T2 card browser: picked card names, in pick order. */
      picks: [] as Array<CardName>,
      /** projectCard (generic, wave 2): pick → pay two-stage state. */
      pcStage: 'pick' as 'pick' | 'pay',
      pcPick: undefined as CardName | undefined,
      /** T3 payment: the dialed-in non-M€ lane counts (M€ auto-derives). */
      payCounts: {} as Partial<Record<SpendableResource, number>>,
      /** Re-keyed on each adjust so the dialed row's one-shot pulse replays. */
      payFlashNonce: 0,
      /** T9: the OPEN nested option (one-level wizard) — B returns to the list. */
      nested: undefined as {index: number, input: PlayerInputModel} | undefined,
      /** Blocks a duplicate submit between the emit and the next server response
       *  (e.g. rapid A presses in the pick phase) — cleared on every response. */
      submitting: false,
      /** The deal cinematic lifecycle (holds slots, flies proxies, skips). */
      deal: createCardDealSequence(),
      dealLaunchTimer: undefined as number | undefined,
      settleFitTimer: undefined as number | undefined,
      /** The draft-tray brain (pick beats / research rise) — module state. */
      draftTrayState,
      /** Single-row card fit (sets --con-cards-zoom so the row always fits →
       *  never scrolls on focus). Observers run it on resize; NEVER per focus.
       *  VueUse stop-handles (auto-managed; no raw addEventListener). */
      stopStripObs: undefined as (() => void) | undefined,
      stopResize: undefined as (() => void) | undefined,
      fitScheduled: false,
      fitRetries: 0,
    };
  },
  computed: {
    /** The TOP-LEVEL prompt (never the nested input). */
    parentWf(): PlayerInputModel | undefined {
      return this.promptOverride ?? this.playerView.waitingFor;
    },
    /** What the bodies render: the nested input while the wizard is open. */
    wf(): PlayerInputModel | undefined {
      return this.nested?.input ?? this.parentWf;
    },
    /** The kind actually rendered (the nested input's kind while open). */
    activeTask(): ConsoleTask {
      if (this.nested !== undefined) {
        return nestedTaskFor(this.nested.input) ?? this.task;
      }
      return this.task;
    },
    /** The PROMPT identity — a change means a genuinely new server ask. */
    baseKey(): string {
      const override = this.promptOverride !== undefined ? 'client|' : '';
      return `${override}${this.parentWf?.type ?? ''}|${textOf(this.parentWf?.title)}`;
    },
    taskKey(): string {
      return this.nested !== undefined ? `${this.baseKey}|n${this.nested.index}` : this.baseKey;
    },
    /** The keyed FRAME's identity: the prompt PLUS the native projectCard
     *  stage — pick → pay is a stage swap of the same prompt, and unkeyed it
     *  re-dressed the standing plate in one frame (a card grid snapping into
     *  the pay panel). Keying it rides the same `con-task-swap` crossfade
     *  every prompt→prompt switch uses. `taskKey` itself stays prompt-only:
     *  the reset epoch and the nested-step machinery must not see a stage
     *  flip as a new ask. */
    panelKey(): string {
      const stage = this.activeTask.kind === 'projectCard' ? `|${this.pcStage}` : '';
      return `${this.taskKey}${stage}`;
    },
    /**
     * The RESET epoch — a genuinely new server ask OR a fresh card SET inside
     * the SAME prompt identity. The between-generation draft re-uses ONE prompt
     * across rounds (same type + title; only the dealt cards shrink 4→3→2→1), so
     * `taskKey` never changes between rounds and the focus would stay on the
     * previous round's slot — the fresh set then reads "unfocused / dim" (most
     * visible against a bot that answers instantly, so the next deal lands at
     * once). Folding the card identities in re-fires resetState() → focus snaps
     * back to the first available card. The frame `:key` stays `taskKey` (no
     * cross-fade between rounds — the content updates in place).
     */
    resetKey(): string {
      if (this.activeTask.kind !== 'cardSelect') {
        return this.taskKey;
      }
      return `${this.taskKey}|c${this.cardEntries.map((e) => e.card.name).join(',')}`;
    },
    titleText(): string {
      // A recognised CONVERSION leads with its compact headline
      // («Преобразование энергии») — the server ask moves to the subtext.
      // Structural (the conversion hint), never a title match.
      if (this.conversionAskDemoted) {
        return translateText(this.conversionVm?.headlineKey ?? '');
      }
      // Phase-aware card-browser titles — the server title there is generic
      // ("Select up to N cards to buy" / "Select a card to keep and pass…").
      // Other kinds AND every nested step keep the descriptive server title.
      if (this.nested === undefined && this.activeTask.kind === 'cardSelect') {
        if (this.isBuyMode) {
          // EMBEDDED single card: the mass-selector title misnames the moment.
          // ONE card was just revealed by the player's own action, and the
          // decision is buy-or-decline — not «select cards» out of a set.
          if (this.embeddedSingleBuy) {
            return translateText('Buy the revealed card?');
          }
          return translateText('Select cards to purchase');
        }
        // Only the single-keep draft gets the "1 card" title; a multi-keep
        // draft keeps the (translated) server title ("Select two cards to keep…").
        if (this.isDraftPick && this.singlePick) {
          return translateText('Choose 1 card to draft');
        }
      }
      return textOf(this.wf?.title);
    },
    /**
     * The classification chip over the title. It names WHAT KIND of decision
     * this is ("ОПЛАТА" / "ДРАФТ" / "АТАКА") instead of the old context-less
     * «Ожидает решения» — shared with the deferred chip + the command bar via
     * `consoleTaskSummary`, so the three surfaces cannot disagree.
     *
     * `activeTask` + `wf` are both NESTED-AWARE, so an open wizard step is
     * classified as ITSELF (the nested payment reads "ОПЛАТА"), and the
     * client-built payment rides `parentWf`'s `promptOverride`.
     */
    kickerText(): string {
      return translateText(this.kickerKey);
    },
    /** The raw i18n key — the embedded host hands THIS to the workspace's
     *  breadcrumb rather than drawing a second kicker of its own. */
    kickerKey(): string {
      return consoleTaskSummary(this.activeTask, this.playerView, {prompt: this.wf}).kickerKey;
    },
    /** What to publish upward: the stage name while embedded, '' otherwise. */
    embeddedPhase(): string {
      return this.embedded ? this.kickerKey : '';
    },
    /** choiceContext trigger sentence (parity with ContextualChoiceContent);
     *  inside a nested step — the PARENT ask as a breadcrumb. */
    triggerText(): string {
      if (this.nested !== undefined) {
        return `← ${textOf(this.parentWf?.title)}`;
      }
      const trigger = this.wf?.choiceContext?.trigger;
      return textOf(trigger as string | Message | undefined);
    },
    /** WHO asked — normalized by the shared model, so every marker the server
     *  might have used lands in ONE dock. The context lives on the PARENT
     *  prompt, so it stays visible through a nested wizard step. */
    sourceView(): PromptSourceView | undefined {
      return promptSourceView(this.parentWf);
    },
    /**
     * WHAT THE DOCK RENDERS — never anything while EMBEDDED.
     *
     * Inside a workspace the source is already on stage: the composer's hero
     * column holds that very card for the whole flow, and `L3 Источник` LIFTS
     * THAT ONE (`workspaceSourceZoomOrigin`). Drawing a second copy beside the
     * result is the console's own «two of the same card» violation, and it
     * costs the stage the width and height the result needs — the buy stage's
     * card halved the day the server started attributing draw picks.
     */
    dockedSource(): PromptSourceView | undefined {
      return this.embedded ? undefined : this.sourceView;
    },
    /** The docked source CARD, when the source is one — what X / L3 opens. */
    sourceCardName(): CardName | undefined {
      return this.sourceView?.inspectable === true ? this.sourceView.card : undefined;
    },
    /**
     * The STANDALONE host's inspectable source — the card that PRODUCED this
     * prompt, offered on L3.
     *
     * `choice` is deliberately excluded and keeps its shipped X: there the card
     * IS the object being decided about (Pharmacy Union asks about Pharmacy
     * Union), which is the console grammar's "pre-commit — the source IS the
     * current object" case. Every other kind hands the player a DIAL or a LIST
     * that the card merely produced (Philares' resource distribution arrives
     * after the tile already landed — possibly on an OPPONENT's turn), so the
     * card is a source in the strict sense and belongs on L3.
     */
    standaloneSourceCard(): CardName | undefined {
      if (this.embedded || this.activeTask.kind === 'choice') {
        return undefined;
      }
      return this.sourceCardName;
    },
    /** The dock presents COMPACT exactly when the card is a source rather than
     *  the subject — the same condition that puts it on L3. */
    sourceCompact(): boolean {
      return this.standaloneSourceCard !== undefined;
    },
    /** The L3 «Источник» hint, appended before the B verb by every kind that
     *  has a source to inspect. Discoverable nowhere else → outlives the
     *  self-evident stick/dpad hints when the bar drops for fit. */
    sourceHint(): Array<ConsoleCommand> {
      return this.standaloneSourceCard === undefined ?
        [] :
        [{control: 'stickL' as GlyphControl, label: 'Source', priority: 1}];
    },
    /**
     * The workspace claim's SOURCE card — the action whose activation produced
     * this pick. Present only while EMBEDDED (the claim is exactly what
     * re-homed this host into the workspace), and it is what L3 inspects —
     * the console-wide «X = the current object, L3 = its source» grammar.
     * A prompt carries no source attribution of its own (see
     * workspaceClaimsPick), so the claim is the one honest place to read it.
     */
    workspaceSourceCard(): CardName | undefined {
      if (!this.embedded) {
        return undefined;
      }
      const name = workspaceOutcomeState.sourceCard;
      return name !== '' ? (name as CardName) : undefined;
    },
    /**
     * ONE revealed card offered for purchase inside the workspace — the
     * presentation adapts: the title asks the actual question, the top
     * pickline folds away, and the card's own status line carries the
     * economics (price / balance after). The multi-card composition is the
     * same component with the counters back on.
     */
    embeddedSingleBuy(): boolean {
      return this.embedded && this.activeTask.kind === 'cardSelect' &&
        this.isBuyMode && this.cardEntries.length === 1;
    },
    /**
     * The embedded stage's live state as compact HEADER BADGES — the same
     * visual entity the drawn reveal's «ПОЛУЧЕНО N» is, on the same row as the
     * title. It used to be a second full row under the heading, which cost the
     * result stage a whole band of height that the cards then paid for.
     *
     * The COUNT of badges is constant per mode (never 2 then 3), so a d-pad
     * move or a pick can't change the header's shape under the player.
     * Selection rules are the previous pickline's, unchanged: one revealed
     * card offered for purchase folds them away entirely (its economics live
     * on the card's own status line), a plain single pick has nothing to count.
     */
    embeddedBadges(): Array<{key: string, label: string, value: string, warn: boolean, coin: boolean}> {
      if (!this.embedded || this.activeTask.kind !== 'cardSelect' ||
          this.embeddedSingleBuy || (this.singlePick && !this.isBuyMode)) {
        return [];
      }
      const out: Array<{key: string, label: string, value: string, warn: boolean, coin: boolean}> = [];
      if (!this.singlePick) {
        out.push({
          key: 'selected',
          label: translateText('Selected'),
          value: this.cardMax > 0 ? `${this.picks.length}/${this.cardMax}` : `${this.picks.length}`,
          warn: false,
          coin: false,
        });
      }
      if (this.isBuyMode) {
        out.push({
          key: 'purchase',
          label: translateText('Purchase'),
          value: `−${this.buyTotal}`,
          warn: !this.cardBuyAffordable,
          coin: true,
        });
        const spent = this.picks.length > 0 && this.cardBuyAffordable;
        out.push({
          key: 'wallet',
          label: translateText(spent ? 'After purchase' : 'You have'),
          value: `${spent ? this.megacreditsAfterPurchase : this.megacreditsOnHand}`,
          warn: false,
          coin: true,
        });
      }
      return out;
    },
    /**
     * A `Warning` is a KEY, not a sentence.
     *
     * Translating the key itself printed `removeOwnPlants` on screen — the raw
     * identifier, in a slot meant to explain a risk. `warningText` is the one
     * place that maps a key to its English i18n sentence (shared with the
     * desktop card warnings), so both surfaces can never word the same warning
     * differently.
     */
    warningTexts(): Array<string> {
      const warnings = (this.wf as {warnings?: ReadonlyArray<Warning>} | undefined)?.warnings ?? [];
      return warnings.map((w) => translateText(warningText(w)));
    },
    confirmLabel(): string {
      const label = this.wf?.buttonLabel;
      return label !== undefined && label !== '' ? label : 'Confirm';
    },
    /**
     * Does A decide a CHOICE in ONE press? Exactly for the CONTEXTUAL flavor —
     * DESKTOP PARITY, precisely: `ContextualChoiceContent` hosts its options
     * `controlled` (one click commits) + `confirmRisky` (only an irreversible
     * option arms an inline confirm), whereas a GENERIC `OrOptions` renders as
     * `ModernOptionPicker`'s select → ПОДТВЕРДИТЬ — a deliberate two-step so a
     * destructive target is never a single mis-press. The console mirrors both.
     */
    choiceOnePress(): boolean {
      return this.activeTask.kind === 'choice' && this.activeTask.flavor === 'contextual';
    },
    /**
     * The A verb of a one-press CHOICE. A LEAF option is decided on the spot, so
     * A reads «Подтвердить»; an option that OPENS something (a nested wizard
     * step, a board pick) honestly reads «Выбрать» — it selects the branch and
     * the decision lands one screen later.
     */
    choiceCommandLabel(): string {
      const entry = this.choiceEntries[this.focusIdx];
      return entry !== undefined && (entry.isNested || entry.isSpace) ? 'Select' : 'Confirm';
    },
    // ── choice ───────────────────────────────────────────────────────
    orOptions(): ReadonlyArray<PlayerInputModel> {
      if (this.wf?.type === 'or') {
        return (this.wf as OrOptionsModel).options;
      }
      return [];
    },
    allChoiceEntries(): Array<ChoiceEntry> {
      const source = this.wf?.type === 'option' ? [this.wf] : this.orOptions;
      return source.map((option, index) => {
        const meta: OptionMetadata | undefined = (option as SelectOptionModel).metadata;
        const player = meta?.player;
        const playerModel = player !== undefined ? this.playerView.players.find((p) => p.color === player.color) : undefined;
        const preview =
          player?.current !== undefined && player?.resulting !== undefined ? `${player.current} → ${player.resulting}` :
            meta?.global?.current !== undefined && meta?.global?.resulting !== undefined ?
              `${meta.global.current}${meta.global.unit ?? ''} → ${meta.global.resulting}${meta.global.unit ?? ''}` :
              meta?.resource !== undefined ? `${meta.resource.current} → ${meta.resource.resulting}` : '';
        const tradeoff = textOf(meta?.tradeoff);
        const title = textOf(option.title);
        const description = textOf(meta?.description);
        return {
          index,
          title,
          iconClass: meta?.icon !== undefined ? iconClassFor(meta.icon) + ' con-task__opt-res' : '',
          playerColor: player?.color,
          playerName: playerModel !== undefined ? participantDisplayName(playerModel) : '',
          preview,
          effects: meta?.effects ?? [],
          description,
          tradeoff,
          isSkip: meta?.kind === 'skip',
          isSpace: option.type === 'space',
          isNested: option.type !== 'option' && option.type !== 'space',
          // The engine's own per-option warnings, as SENTENCES. They used to be
          // collapsed straight into the `risky` boolean below, so the one thing
          // the rules engine actually says about a self-harming choice («это
          // ваши растения») reached the player as an unexplained second key
          // press. A gate that asks twice without saying why is read as the UI
          // being awkward, not as a caution — it costs trust and prevents nothing.
          warnings: ((option as {warnings?: ReadonlyArray<Warning>}).warnings ?? []).map((w) => translateText(warningText(w))),
          risky: tradeoff !== '' || ((option as {warnings?: ReadonlyArray<Warning>}).warnings ?? []).length > 0,
          option,
        };
      });
    },
    /** Primary rows first, skip options last (desktop parity). */
    choiceEntries(): Array<ChoiceEntry> {
      const all = this.allChoiceEntries;
      return [...all.filter((e) => !e.isSkip), ...all.filter((e) => e.isSkip)];
    },
    disabledChoiceEntries(): Array<{title: string, reason: string, playerColor: Color | undefined}> {
      if (this.wf?.type !== 'or') {
        return [];
      }
      return ((this.wf as OrOptionsModel).disabledOptions ?? []).map((d) => {
        const rec = d as {label?: string | Message, reason?: string | Message, player?: {color?: Color}, metadata?: OptionMetadata};
        return {
          title: textOf(rec.label),
          reason: textOf(rec.reason),
          playerColor: rec.metadata?.player?.color ?? rec.player?.color,
        };
      });
    },
    // ── player ───────────────────────────────────────────────────────
    playerEntries(): Array<{color: Color, name: string, corp: string, selfHarm: boolean, changes: Array<TargetRowVM>}> {
      if (this.wf?.type !== 'player') {
        return [];
      }
      const model = this.wf as PlayerInputModel & {type: 'player', players: ReadonlyArray<Color>, icon?: string, amount?: number, scope?: 'stock' | 'production', targetImpacts?: ReadonlyArray<TargetImpact>};
      const scope = model.scope ?? 'stock';
      const serverImpacts = model.targetImpacts ?? [];
      return model.players.map((color) => {
        const p = this.playerView.players.find((pp) => pp.color === color);
        let corp = '';
        for (const c of p?.tableau ?? []) {
          try {
            if (getCard(c.name)?.type === CardType.CORPORATION) {
              corp = c.name;
              break;
            }
          } catch (err) { /* manifest gap */ }
        }
        // SERVER truth first (correct for a MarsBot — its production hit is a
        // TRACK regression, its stock loss is M€), else derive from the model.
        const server = serverImpacts.find((ti) => ti.color === color);
        let raw: ReadonlyArray<TargetImpactChange> = [];
        if (server !== undefined) {
          raw = server.changes;
        } else if (model.icon !== undefined && model.amount !== undefined && p !== undefined) {
          const field = RESOURCE_FIELD[model.icon]?.[scope];
          const current = field !== undefined ? (p as unknown as Record<string, number>)[field] : undefined;
          if (current !== undefined) {
            raw = [{icon: model.icon, from: current, to: current - model.amount, scope}];
          }
        }
        return {
          color, name: p !== undefined ? participantDisplayName(p) : color, corp,
          // «Это вы» — only when the move COSTS you and another target was
          // selectable. Alone in the list it is a forced hit, not a mistake, and
          // the card already warns about that case before it is played.
          selfHarm: color === this.playerView.thisPlayer.color &&
            model.players.length > 1 && targetImpactIsLoss(raw),
          changes: raw.map((r) => this.toTargetRow(r)),
        };
      });
    },
    disabledPlayerEntries(): Array<{color: Color, name: string, reason: string}> {
      if (this.wf?.type !== 'player') {
        return [];
      }
      const model = this.wf as PlayerInputModel & {type: 'player', disabledPlayers?: ReadonlyArray<{color: Color, reason?: string | Message}>};
      return (model.disabledPlayers ?? []).map((d) => ({
        color: d.color,
        name: displayNameForColor(this.playerView.players, d.color),
        reason: textOf(d.reason),
      }));
    },
    // ── amount ───────────────────────────────────────────────────────
    /**
     * The delta family's DISCRETE legal values, sorted — the server's own
     * lists (`validSteps` / `claimable`), which are SPARSE when a blocked
     * position splits them (e.g. `[1, 3]`). The dial snaps along this list
     * instead of counting integers, so every value it shows is submittable.
     * `undefined` for the plain min/max amount.
     */
    amountValidValues(): ReadonlyArray<number> | undefined {
      if (this.wf?.type === 'deltaProject') {
        return [...(this.wf as PlayerInputModel & {type: 'deltaProject'}).validSteps].sort((a, b) => a - b);
      }
      if (this.wf?.type === 'deltaStageReward') {
        return [...(this.wf as PlayerInputModel & {type: 'deltaStageReward'}).claimable].sort((a, b) => a - b);
      }
      return undefined;
    },
    amountMin(): number {
      const values = this.amountValidValues;
      if (values !== undefined) {
        return values[0] ?? 0;
      }
      return this.wf?.type === 'amount' ? (this.wf as PlayerInputModel & {type: 'amount'}).min : 0;
    },
    amountMax(): number {
      const values = this.amountValidValues;
      if (values !== undefined) {
        return values[values.length - 1] ?? 0;
      }
      return this.wf?.type === 'amount' ? (this.wf as PlayerInputModel & {type: 'amount'}).max : 0;
    },
    amountIconClass(): string {
      const icon = this.wf?.type === 'amount' ? (this.wf as PlayerInputModel & {type: 'amount', icon?: string}).icon : 'energy';
      return icon !== undefined ? iconClassFor(icon) + ' con-task__opt-res' : '';
    },
    amountUnit(): string {
      const unit = this.wf?.type === 'amount' ? (this.wf as PlayerInputModel & {type: 'amount', unit?: string}).unit : undefined;
      return unit ?? '';
    },
    /** The dial's model, when this task IS a SelectAmount. */
    amountModel(): SelectAmountModel | undefined {
      return this.wf?.type === 'amount' ? this.wf as SelectAmountModel : undefined;
    },
    /**
     * The PREMIUM CONVERSION composition (the server's `conversion` hint —
     * Supercapacitors' energy→heat is the reference): both sides'
     * `current → after` for the dialed value, the neutral/binary verdicts and
     * the headline. One pure source (`conversionPromptModel`), so the panel,
     * the commit label and the spec all state the same numbers — and the
     * preview mirrors exactly what the server's own callback will apply.
     */
    conversionVm(): ConversionPromptVm | undefined {
      return conversionPromptVm(this.amountModel, this.playerView.thisPlayer, this.value);
    },
    /** The binary plate's act label («Преобразовать 1»). */
    convertMaxLabel(): string {
      const vm = this.conversionVm;
      return vm === undefined ? '' : translateTextWithParams('Convert ${0}', [String(vm.max)]);
    },
    /**
     * The amount commit verb for the command bar. A CONVERSION names the
     * operation and its magnitude — «ПРЕОБРАЗОВАТЬ N», or the honest
     * «НЕ ПРЕОБРАЗОВЫВАТЬ» at 0 (a zero commit is a stated refusal, never a
     * generic «ОК»). Spend/priced operations (result / cost) and bare amounts
     * keep the server's own specific verb («Потратить энергию», «Получить
     * энергию», «Сбросить аэростаты»).
     */
    amountConfirmLabel(): string {
      if (this.conversionVm?.kind !== 'conversion') {
        return this.confirmLabel;
      }
      const label = conversionCommitLabel(this.value);
      return label.params.length > 0 ?
        translateTextWithParams(label.key, label.params) :
        translateText(label.key);
    },
    /**
     * The conversion headline REPLACES the generic server title as the panel's
     * main line («Преобразование энергии»), demoting the server ask to the
     * subtext — only standalone (an embedded stage's one-line head keeps the
     * full ask; a nested wizard step keeps its own title).
     */
    conversionAskDemoted(): boolean {
      return this.nested === undefined && !this.embedded &&
        this.conversionVm?.headlineKey !== undefined;
    },
    /**
     * The player-rail FOCUS accent: while a conversion prompt is live, its two
     * affected STOCK rows are what the decision is about (and where the commit
     * animation will play), so the rail marks them. '' = nothing to watch
     * (no conversion / embedded / production-scope sides have no stock row).
     */
    conversionWatchKey(): string {
      const vm = this.conversionVm;
      if (vm === undefined || this.embedded) {
        return '';
      }
      const from = vm.from.production ? '' : vm.from.icon;
      const to = vm.to.production ? '' : vm.to.icon;
      return from === '' && to === '' ? '' : `${from}|${to}`;
    },
    /**
     * What the CURRENT dial value SPENDS — the pool it comes out of, with
     * `current → resulting`. A `conversion`/`amountResult` dial counts the thing
     * spent (its own icon); an `amountCost` dial counts the thing GAINED and is
     * priced per unit out of another pool. No hint → no chip (a bare dial that
     * genuinely has no direction, e.g. "how many delegates").
     */
    amountCostChips(): ReadonlyArray<ActionEffect> {
      const m = this.amountModel;
      if (m === undefined) {
        return [];
      }
      if (m.amountCost !== undefined) {
        const spent = this.value * (m.amountCost.perUnit ?? 1);
        const pool = playerResourceValue(this.playerView.thisPlayer, m.amountCost.icon, m.amountCost.scope ?? 'stock');
        return [{direction: 'cost', icon: m.amountCost.icon, amount: spent, current: pool, resulting: pool !== undefined ? pool - spent : undefined,
          note: m.amountCost.scope === 'production' ? 'production' : undefined}];
      }
      const icon = m.icon ?? m.conversion?.from;
      if ((m.amountResult === undefined && m.conversion === undefined) || icon === undefined) {
        return [];
      }
      const scope = m.conversion?.fromScope ?? 'stock';
      const pool = playerResourceValue(this.playerView.thisPlayer, icon, scope);
      return [{direction: 'cost', icon, amount: this.value, current: pool, resulting: pool !== undefined ? pool - this.value : undefined,
        note: scope === 'production' ? 'production' : undefined}];
    },
    /** What the CURRENT dial value PRODUCES — the mirror of `amountCostChips`. */
    amountGainChips(): ReadonlyArray<ActionEffect> {
      const m = this.amountModel;
      if (m === undefined) {
        return [];
      }
      if (m.amountResult !== undefined) {
        return [{direction: 'gain', icon: m.amountResult.icon, amount: this.value * (m.amountResult.perUnit ?? 1)}];
      }
      if (m.conversion !== undefined) {
        const gained = this.value * (m.conversion.ratio ?? 1);
        const scope = m.conversion.toScope ?? 'stock';
        const pool = playerResourceValue(this.playerView.thisPlayer, m.conversion.to, scope);
        return [{direction: 'gain', icon: m.conversion.to, amount: gained, current: pool, resulting: pool !== undefined ? pool + gained : undefined,
          note: scope === 'production' ? 'production' : undefined}];
      }
      if (m.amountCost !== undefined && m.icon !== undefined) {
        const pool = playerResourceValue(this.playerView.thisPlayer, m.icon, 'stock');
        return [{direction: 'gain', icon: m.icon, amount: this.value, current: pool, resulting: pool !== undefined ? pool + this.value : undefined, unit: m.unit}];
      }
      return [];
    },
    // ── resource ─────────────────────────────────────────────────────
    resourceUnits(): ReadonlyArray<keyof Units> {
      if (this.wf?.type !== 'resource') {
        return [];
      }
      return (this.wf as PlayerInputModel & {type: 'resource'}).include;
    },
    // ── distribute ───────────────────────────────────────────────────
    /**
     * The lane set, as the shared `budgetLanes` engine speaks it. PRODUCTION
     * (a nested loss) keeps the server's own per-lane caps — how far each
     * production can fall IS a rule. RESOURCES is a GAIN (`SelectResources`:
     * Philares, the behavior DSL's `standardResource`) whose only limit is the
     * budget itself — the server validates nothing but the sum. It used to cap
     * every lane by the player's CURRENT STOCK: a limit that isn't one (an
     * empty pool read «0 / 0» and refused its share of the reward). The stock
     * now rides along as `available`, the «518 → 519» readout.
     */
    lanes(): Array<BudgetLane> {
      if (this.activeTask.kind !== 'distribute') {
        return [];
      }
      if (this.activeTask.mode === 'production') {
        const model = this.wf as PlayerInputModel & {type: 'productionToLose'};
        return productionLossLanes(model.payProduction.units);
      }
      const stock = this.playerView.thisPlayer as unknown as Partial<Record<keyof Units, number>>;
      return standardGainLanes(this.distributeTarget, stock);
    },
    distributeTarget(): number {
      if (this.activeTask.kind !== 'distribute') {
        return 0;
      }
      if (this.activeTask.mode === 'production') {
        return (this.wf as PlayerInputModel & {type: 'productionToLose'}).payProduction.cost;
      }
      return (this.wf as PlayerInputModel & {type: 'resources'}).count;
    },
    distRule(): BudgetRule {
      return {kind: 'exact', target: this.distributeTarget};
    },
    /**
     * ONE unit to place → the lanes are a RADIO, not six dials: A puts it on
     * the focused lane / takes it back, X commits, and −1/+1/MAX are not
     * advertised (they still land on the same gesture — muscle memory must
     * never meet a dead button). The same question the Venus-bonus and
     * spend-heat surfaces ask of the same engine, so the three cannot drift.
     */
    distSingleStep(): boolean {
      return this.activeTask.kind === 'distribute' && budgetSingleStep(this.lanes, this.distRule);
    },
    /** The lane under the cursor already holds the unit — A takes it back. */
    distFocusedPicked(): boolean {
      const lane = this.lanes[this.focusIdx];
      return lane !== undefined && this.laneValue(lane.key) > 0;
    },
    /**
     * Why the confirm is withheld — the honest reason under the ask, never a
     * dead button (gain mode only: the production loss keeps its meter, whose
     * amber «Всего n / m» already says the same thing in loss language).
     */
    distBlockedText(): string {
      if (this.activeTask.kind !== 'distribute' || this.activeTask.mode !== 'resources' || this.distributeReady) {
        return '';
      }
      const key = budgetBlockedKey(this.lanes, this.units as BudgetState, this.distRule);
      return key === undefined ? '' : translateText(key);
    },
    distributedSum(): number {
      return budgetTotal(this.lanes, this.units as BudgetState);
    },
    distributeReady(): boolean {
      return budgetValid(this.lanes, this.units as BudgetState, this.distRule);
    },
    /** Every card the viewer holds (incl. Self-Replicating-Robots hosts) — the
     *  ownership test behind routing a nested pick to the hand overlay. */
    handNames(): ReadonlySet<string> {
      const view = this.playerView;
      return new Set<string>([
        ...view.cardsInHand.map((c) => c.name),
        ...(view.thisPlayer.selfReplicatingRobotsCards ?? []).map((c) => c.name),
      ]);
    },
    // ── card browser (T2) ────────────────────────────────────────────
    cardModel(): SelectCardModel | undefined {
      return this.wf?.type === 'card' ? (this.wf as SelectCardModel) : undefined;
    },
    /** Selectable candidates first, then the DISABLED ones (with reasons). */
    /** Live models aligned with the deal's card list — the flying face must
     *  match the landed face (the parity contract). */
    dealModels(): Array<CardModel | undefined> {
      const pool = this.cardEntries.map((e) => e.card);
      return this.deal.state.cards.map((name) => pool.find((c) => c.name === name));
    },
    cardEntries(): Array<{card: CardModel, disabled: boolean, reason: string}> {
      const model = this.cardModel;
      if (model === undefined) {
        return [];
      }
      return [
        ...model.cards.map((card) => ({card, disabled: false, reason: ''})),
        ...(model.disabledCards ?? []).map((card) => ({card, disabled: true, reason: textOf(card.disabledReason)})),
      ];
    },
    focusedCardEntry(): {card: CardModel, disabled: boolean, reason: string} | undefined {
      return this.cardEntries[this.focusIdx];
    },
    cardMin(): number {
      return this.cardModel?.min ?? 0;
    },
    cardMax(): number {
      return this.cardModel?.max ?? 0;
    },
    /** min === max === 1 (P15: A toggles ONLY — Y is the one confirm). */
    singlePick(): boolean {
      return this.cardMin === 1 && this.cardMax === 1;
    },
    /** P15: at the pick max, unpicked cards de-emphasize (desktop parity). */
    cardDimUnpicked(): boolean {
      return this.cardMax > 0 && this.picks.length >= this.cardMax;
    },
    /** Can A pick the focused (unpicked, enabled) card right now? */
    canPickFocusedCard(): boolean {
      return this.cardMax === 1 || this.picks.length < this.cardMax;
    },
    /** P13: >6 candidates wrap into a grid (no kilometre scrolling). */
    gridMode(): boolean {
      return this.activeTask.kind === 'cardSelect' && this.cardEntries.length > 6;
    },
    isBuyMode(): boolean {
      return this.activeTask.kind === 'cardSelect' && this.activeTask.mode === 'buy';
    },
    /**
     * The between-generation DRAFT pick (keep a card, pass the rest on). The
     * REAL Draft.ts prompt uses buttonLabel 'Select' (→ router `mode: 'target'`),
     * so the reliable signal is the PHASE (mirrors the desktop
     * CardSelectionContent.isDraftPhase). The dead `mode: 'draft'` branch stays
     * for any future 'Keep'-labelled prompt.
     */
    isDraftPick(): boolean {
      const phase = this.playerView.game.phase;
      return this.activeTask.kind === 'cardSelect' &&
        (this.activeTask.mode === 'draft' || phase === Phase.DRAFTING || phase === Phase.INITIALDRAFTING);
    },
    /** Cards the viewer has already drafted this round (server-managed;
     *  cleared at endRound). Shown COMPACTLY here — the wide host modal covers
     *  the screen corners, so a full pile would collide; the calm draftWait
     *  banner draws the desktop-style stack once the modal is gone. */
    draftedCards(): ReadonlyArray<CardModel> {
      return this.playerView.draftedCards ?? [];
    },
    /** RT opens the read-only drafted-cards viewer — ONLY in the single-keep
     *  draft, where RT is otherwise free (a multi-keep RT commits the set). */
    canInspectDrafted(): boolean {
      return this.isDraftPick && this.singlePick && this.draftedCards.length > 0;
    },
    /**
     * The per-card RESEARCH/buy cost — `player.cardCost` (base 3 M€, raised by
     * Polyphemos to 5 / dropped by Terralabs Research to 1), which is EXACTLY
     * what the server charges after we submit the card list (ChooseCards →
     * `cost = selected.length * player.cardCost`). Mirrors the desktop
     * CardSelectionContent.costPerCard — UI and the actual charge cannot diverge.
     *
     * NEVER `cards[0].calculatedCost`: that is the card's PLAY cost (printed
     * cost minus play discounts), baked into every `played:false` CardModel for
     * information only. Using it BUY-priced a card at its printed cost (the
     * "2 × 17 = −34" bug).
     */
    buyCostPerCard(): number {
      return this.playerView.thisPlayer.cardCost;
    },
    buyTotal(): number {
      return this.picks.length * this.buyCostPerCard;
    },
    megacreditsOnHand(): number {
      return megacreditsAvailable(this.playerView.thisPlayer);
    },
    /** M€ left after the current buy selection (buy-phase readout). */
    megacreditsAfterPurchase(): number {
      return this.megacreditsOnHand - this.buyTotal;
    },
    cardBuyAffordable(): boolean {
      return !this.isBuyMode || this.buyTotal <= this.megacreditsOnHand;
    },
    /** The honest insufficient-funds banner text (buy phase). */
    buyShortfallText(): string {
      return translateText('Not enough M€: need ${0}, have ${1}')
        .replace('${0}', String(this.buyTotal))
        .replace('${1}', String(this.megacreditsOnHand));
    },
    /** RT/commit label for the MULTI (buy / multi-target) commit. */
    cardConfirmLabel(): string {
      if (this.isBuyMode) {
        return this.picks.length === 0 ? 'Skip' : 'Buy';
      }
      return this.confirmLabel;
    },
    /** A one-line explanation under the title (single-keep draft: what happens
     *  to the cards you don't keep; a conversion: the demoted server ask). */
    phaseSubtext(): string {
      if (this.conversionAskDemoted) {
        return textOf(this.wf?.title);
      }
      return this.isDraftPick && this.singlePick ?
        translateText('The card is kept for you, the rest are passed on.') : '';
    },
    cardPicksValid(): boolean {
      return this.picks.length >= this.cardMin && this.picks.length <= this.cardMax && this.cardBuyAffordable;
    },
    // ── payment (T3) ─────────────────────────────────────────────────
    paymentModel(): SelectPaymentModel | undefined {
      return this.wf?.type === 'payment' ? (this.wf as SelectPaymentModel) : undefined;
    },
    paymentCost(): number {
      return this.paymentModel?.amount ?? 0;
    },
    payLanes(): Array<PaymentLane> {
      const model = this.paymentModel;
      if (model === undefined) {
        return [];
      }
      return paymentLanes(model, this.playerView.thisPlayer);
    },
    /** The SHARED payment presentation model — the same one the card-play and
     *  blue-action composers render, so this standalone prompt speaks the
     *  identical language (rows, order, verdict, geometry). */
    paymentView(): PaymentView | undefined {
      const model = this.paymentModel;
      if (model === undefined) {
        return undefined;
      }
      return buildPaymentView({
        cost: model.amount,
        lanes: this.payLanes,
        counts: this.payCounts,
        mcAvailable: this.megacreditsOnHand,
      });
    },
    /** The unit the cursor sits on — the lane list and the panel's editable
     *  rows are the SAME sequence, so `focusIdx` indexes both. */
    payFocusUnit(): string | undefined {
      const v = this.paymentView;
      return v === undefined ? undefined : editableRows(v)[this.focusIdx]?.unit;
    },
    payTotal(): number {
      return paymentTotal(this.paymentCost, this.payLanes, this.payCounts, this.megacreditsOnHand);
    },
    paymentReady(): boolean {
      return this.activeTask.kind !== 'payment' ||
        paymentCovers(this.paymentCost, this.payLanes, this.payCounts, this.megacreditsOnHand);
    },
    // ── projectCard (generic — desktop-removal wave 2) ─────────────────
    // The fallback the legacy MandatoryInputModal used to serve: candidates
    // that are neither the hand nor the standard-project sheet (Odyssey's
    // played events; a future producer's foreign list). Two stages inside
    // this ONE host surface: PICK (the shared card-browser chassis) → PAY
    // (the shared payment panel over `projectCardPaymentPrompt`), one submit
    // `{type:'projectCard', card, payment}` — byte-parity with the desktop
    // SelectProjectCardToPlay it replaces.
    pcModel(): SelectProjectCardToPlayModel | undefined {
      return this.activeTask.kind === 'projectCard' && this.wf?.type === 'projectCard' ?
        this.wf as SelectProjectCardToPlayModel : undefined;
    },
    pcEntries(): Array<{card: CardModel, disabled: boolean, reason: string}> {
      const model = this.pcModel;
      if (model === undefined) {
        return [];
      }
      return model.cards.map((card) => ({
        card,
        disabled: card.isDisabled === true,
        reason: textOf(card.disabledReason),
      }));
    },
    pcPicked(): CardModel | undefined {
      return this.pcEntries.find((e) => e.card.name === this.pcPick)?.card;
    },
    pcCost(): number {
      const card = this.pcPicked;
      if (card === undefined) {
        return 0;
      }
      return card.calculatedCost ?? getCard(card.name)?.cost ?? 0;
    },
    pcLanes(): Array<PaymentLane> {
      const card = this.pcPicked;
      const model = this.pcModel;
      if (card === undefined || model === undefined) {
        return [];
      }
      const tags = getCard(card.name)?.tags ?? [];
      const prompt = projectCardPaymentPrompt(
        this.pcCost, tags, model.paymentOptions ?? {},
        this.playerView.thisPlayer.lastCardPlayed, card.reserveUnits);
      return paymentLanes(prompt, this.playerView.thisPlayer);
    },
    pcPaymentView(): PaymentView | undefined {
      if (this.pcPicked === undefined) {
        return undefined;
      }
      return buildPaymentView({
        cost: this.pcCost,
        lanes: this.pcLanes,
        counts: this.payCounts,
        mcAvailable: this.megacreditsOnHand,
      });
    },
    pcFocusUnit(): string | undefined {
      const v = this.pcPaymentView;
      return v === undefined ? undefined : editableRows(v)[this.focusIdx]?.unit;
    },
    pcReady(): boolean {
      return this.pcPicked !== undefined &&
        paymentCovers(this.pcCost, this.pcLanes, this.payCounts, this.megacreditsOnHand);
    },
    pcGrid(): boolean {
      return this.pcEntries.length > 6;
    },
    /** Can X submit right now? */
    confirmReady(): boolean {
      switch (this.activeTask.kind) {
      case 'distribute':
        return this.distributeReady;
      case 'choice':
        return this.choiceEntries.length > 0;
      case 'player':
        return this.playerEntries.length > 0;
      case 'resource':
        return this.resourceUnits.length > 0;
      case 'cardSelect':
        return this.cardPicksValid;
      case 'payment':
        return this.paymentReady;
      case 'projectCard':
        return this.pcStage === 'pay' ?
          this.pcReady :
          !(this.pcEntries[this.focusIdx]?.disabled ?? true);
      default:
        return true;
      }
    },
    /** The live command contract — published to the shell's ONE bottom
     *  command bar through consolePanelUi (the footCommands watch below). */
    footCommands(): Array<ConsoleCommand> {
      // While the deal cinematic / a draft beat runs, selection is NOT
      // interactive yet — the bar advertises only the skip (any button skips).
      if (this.deal.state.active || this.trayPickBeat) {
        return [{control: 'confirm', label: 'Skip'}];
      }
      // The workspace's batch is still landing: the stage advertises NOTHING
      // yet. A verb on the bar while the slots are empty is a promise the
      // stage cannot keep, and the input path swallows it anyway.
      if (this.arrivalPending) {
        return [];
      }
      const confirm = {control: 'secondary' as GlyphControl, label: this.confirmLabel, enabled: this.confirmReady};
      const defer = {control: 'back' as GlyphControl, label: this.nested !== undefined ? 'Back' : this.deferLabel};
      // The select → confirm contract (A picks, X commits) every arm-then-confirm
      // kind shares — a generic OrOptions / player / resource pick.
      const selectThenConfirm: Array<ConsoleCommand> = [
        {control: 'dpad', label: 'Navigate'},
        {control: 'confirm', label: 'Select'},
        confirm, ...this.sourceHint, defer,
      ];
      switch (this.activeTask.kind) {
      case 'choice': {
        if (!this.choiceOnePress) {
          return selectThenConfirm; // a GENERIC OrOptions keeps the two-step
        }
        // ONE press decides: A commits the focused option, so the bar must NOT
        // advertise a second «Выполнить» on X (that read as a required step —
        // and it WAS one: A only armed). X becomes the console-wide INSPECT
        // verb, offered only when there IS a source card to inspect.
        const cmds: Array<ConsoleCommand> = [
          {control: 'dpad', label: 'Navigate'},
          {control: 'confirm', label: this.choiceCommandLabel, enabled: this.confirmReady},
        ];
        if (this.sourceCardName !== undefined) {
          cmds.push({control: 'secondary', label: 'Inspect'});
        }
        cmds.push(defer);
        return cmds;
      }
      case 'amount': {
        // A dial has NO select step, so the commit sits on A (the console-wide
        // decisive press — the same convention every one-press surface
        // advertises); X stays a silent alias in the input path. A conversion's
        // verb names the operation and its magnitude and follows the dial live.
        const amountCommit: ConsoleCommand =
          {control: 'confirm', label: this.amountConfirmLabel, enabled: this.confirmReady};
        if (this.conversionVm?.binary === true) {
          // Binary = two plates: the d-pad walks them, A commits the focused
          // one. LB/RB/RT still land silently (muscle memory), but the bar
          // advertises only the two real verbs — no dial chrome for one unit.
          return [
            {control: 'dpad', label: 'Navigate'}, amountCommit, ...this.sourceHint, defer,
          ];
        }
        return [
          {control: 'bumperL', label: '−1'}, {control: 'bumperR', label: '+1'},
          {control: 'triggerR', label: 'MAX'}, amountCommit, ...this.sourceHint, defer,
        ];
      }
      case 'distribute': {
        // ONE unit → one gesture: A places / takes back, X commits. Offering
        // −1 / +1 / MAX for a dial that can only read 0 or 1 is four ways to
        // say the same thing (the budgetLanes rule; the Venus surface's bar).
        if (this.distSingleStep) {
          return [
            {control: 'dpad', label: 'Navigate'},
            {control: 'confirm', label: this.distFocusedPicked ? 'Remove here' : 'Add here'},
            confirm, ...this.sourceHint, defer,
          ];
        }
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'bumperL', label: '−1'}, {control: 'bumperR', label: '+1'},
          {control: 'triggerR', label: 'MAX'}, confirm, ...this.sourceHint, defer,
        ];
      }
      case 'payment':
        return [
          {control: 'dpad', label: 'Navigate'},
          {control: 'bumperL', label: '−1'}, {control: 'bumperR', label: '+1'},
          {control: 'triggerR', label: 'MAX'}, confirm, ...this.sourceHint, defer,
        ];
      case 'projectCard': {
        if (this.pcStage === 'pay') {
          // The PAY stage: the shared payment contract + B = one level back.
          return [
            {control: 'dpad', label: 'Navigate'},
            {control: 'bumperL', label: '−1'}, {control: 'bumperR', label: '+1'},
            {control: 'triggerR', label: 'MAX'},
            {control: 'secondary', label: this.confirmLabel, enabled: this.confirmReady},
            {control: 'back', label: 'Back'},
          ];
        }
        // The PICK stage mirrors the single-pick card browser: A carries the
        // candidate forward, X inspects fullscreen.
        return [
          {control: this.pcGrid ? 'dpad' : 'dpadH', label: 'Navigate'},
          {control: 'confirm', label: 'Select', enabled: this.confirmReady},
          {control: 'secondary', label: 'Inspect'},
          defer,
        ];
      }
      case 'cardSelect': {
        // X ALWAYS opens the fullscreen INSPECT viewer (never labelled "Card").
        const nav: {control: GlyphControl, label: string} = {control: this.gridMode ? 'dpad' : 'dpadH', label: 'Navigate'};
        const inspect: {control: GlyphControl, label: string} = {control: 'secondary', label: 'Inspect'};
        if (this.singlePick) {
          // PICK phase (draft / single target): A commits the focused card in
          // one press — no toggle-then-confirm, no re-pick. RT (otherwise free)
          // opens the drafted-cards viewer in a single-keep draft.
          // STANDALONE: a card browser opened BY a marked prompt (a contextual
          // choice's nested target pick) has a source too — L3 already worked
          // here, but only the embedded case advertised it, so it was reachable
          // and undiscoverable. Mutually exclusive with the workspace hint below
          // (that one is embedded-only).
          const pickHints: Array<ConsoleCommand> = [
            nav, {control: 'confirm', label: 'Select'}, inspect, ...this.sourceHint,
          ];
          if (this.workspaceSourceCard !== undefined) {
            // Discoverable nowhere else → survives the Deck bar's fit drops
            // longer than the self-evident stick/dpad hints (default 3).
            pickHints.push({control: 'stickL', label: 'Source', priority: 1});
          }
          if (this.canInspectDrafted) {
            pickHints.push({control: 'triggerR', label: 'Drafted'});
          }
          pickHints.push(defer);
          return pickHints;
        }
        // BUY / multi phase: A toggles the pick, RT commits the whole set.
        // Embedded: L3 re-opens the SOURCE card fullscreen (X belongs to the
        // revealed result here — the same X/L3 split every reveal stage uses).
        const buyHints: Array<ConsoleCommand> = [
          nav,
          {control: 'confirm', label: 'Select / Deselect'},
          inspect,
          ...this.sourceHint,
        ];
        if (this.workspaceSourceCard !== undefined) {
          // Discoverable nowhere else → outlives the self-evident hints in
          // the Deck bar's fit drops (stick default is 3 = first to go).
          buyHints.push({control: 'stickL', label: 'Source', priority: 1});
        }
        // The stage's COMMIT verb: with the embedded status line carrying no
        // glyph chips anymore, the bar is the ONE place RT is discoverable —
        // it must be the last droppable standing.
        buyHints.push({control: 'triggerR', label: this.cardConfirmLabel, enabled: this.confirmReady, priority: 0});
        buyHints.push(defer);
        return buyHints;
      }
      default:
        return selectThenConfirm;
      }
    },
    focusCount(): number {
      switch (this.activeTask.kind) {
      case 'choice': return this.choiceEntries.length;
      case 'player': return this.playerEntries.length;
      case 'resource': return this.resourceUnits.length;
      case 'distribute': return this.lanes.length;
      case 'cardSelect': return this.cardEntries.length;
      case 'payment': return this.payLanes.length;
      case 'projectCard':
        return this.pcStage === 'pay' ? this.pcLanes.length : this.pcEntries.length;
      default: return 0;
      }
    },
    /** The table owns the screen (pick landing / rise) — chrome dissolved. */
    trayTableBeat(): boolean {
      return this.draftTrayState.tableView;
    },
    /** A hero pick flight is live — input skips it, chrome stays quiet. */
    trayPickBeat(): boolean {
      return this.draftTrayState.pickActive || this.draftTrayState.processing;
    },
    /**
     * THE BATCH IS STILL ARRIVING (embedded only). The cards this stage renders
     * are physically flying in as proxies over their held, invisible slots, so
     * interaction opens only when they are all down and handed over — a focus
     * ring on an empty slot promises a card that is not there, and a press
     * accepted mid-flight is an input race by construction. Exactly the
     * `deal.state.active` rule the standalone stage has always applied to its
     * own cinematic, for the workspace's.
     */
    arrivalPending(): boolean {
      return this.embedded && workspaceOutcomeArrivalPending();
    },
  },
  watch: {
    // Hand the stage's NAME up to the workspace breadcrumb while embedded, so
    // «ДЕЙСТВИЯ КАРТ › ПОКУПКА · Коммерческая сеть» is one continuous line
    // instead of a detached «◈ ПОКУПКА» floating inside someone else's frame.
    // Retracted the moment we stop being embedded.
    embeddedPhase: {
      immediate: true,
      handler(key: string) {
        setWorkspaceOutcomePhase(key);
      },
    },
    resetKey: {
      immediate: true,
      handler() {
        this.resetState();
        // Pre-flush: arm the deal HOLD before the new frame paints (the
        // real cards mount hidden — zero first-frame flash).
        this.prepareDeal();
        // Re-fit the single-row card strip for the new prompt (after render),
        // then AGAIN after the entry/deal cinematic settles — the first fit
        // can race a transitional layout (the wide panel / the rise flight),
        // leaving small cards; the delayed re-fit lands the final size.
        void this.$nextTick(() => this.fitCardStrip());
        this.scheduleSettleFit();
      },
    },
    /** A genuinely NEW server prompt discards an open nested step. */
    baseKey() {
      this.nested = undefined;
    },
    /** Every server response (root identity always changes) re-arms submission —
     *  robust against a same-key prompt re-send that the taskKey watcher misses. */
    playerView() {
      this.submitting = false;
    },
    /** The draft-beat safety recovered a stalled/failed pick submit: bring
     *  the round back — un-reject the tumbled slots, release the pick-beat
     *  source hold, re-arm submission (the transport's alert explains). */
    'draftTrayState.recoverNonce'() {
      this.submitting = false;
      const strip = this.$refs.cardStrip as HTMLElement | undefined;
      if (strip === undefined || strip === null || typeof strip.querySelectorAll !== 'function') {
        return;
      }
      for (const el of Array.from(strip.querySelectorAll<HTMLElement>('.con-exit-reject'))) {
        el.classList.remove('con-exit-reject');
        el.style.removeProperty('animation-delay');
      }
      // The pick-beat holds the source .card-container via classList (the
      // deal's own holds live on the SLOT via a Vue :class — untouched).
      for (const el of Array.from(strip.querySelectorAll<HTMLElement>(':is(.card-container, .pcard).con-deal-hold'))) {
        el.classList.remove('con-deal-hold');
      }
    },
    /** The deal finished (or was skipped BEFORE launch) while the rise scene
     *  was engaged — finalize the handoff so the tray never lingers. */
    'deal.state.active'(active: boolean) {
      if (!active) {
        if (riseSceneEngaged()) {
          finishRiseScene();
        }
        // RE-FIT once the cinematic settles. The BETWEEN-GENERATION BUY always
        // follows a draft → the research-RISE flies the cards in, and the fit
        // that ran mid-cinematic (against a transitional layout) could leave
        // the strip at the fallback zoom (small cards on 4K — the reported
        // buy-modal defect). Re-fitting on the final, settled layout sizes
        // them to the wide panel. The draft path re-fits per round already,
        // which is why it composed and the buy did not.
        void this.$nextTick(() => this.fitCardStrip());
      }
    },
    /** Card count or grid↔row transition changes the fit (never per focus). */
    focusCount() {
      void this.$nextTick(() => this.fitCardStrip());
    },
    gridMode() {
      void this.$nextTick(() => this.fitCardStrip());
    },
    /** Persist card-browser picks so a minimize→restore keeps the selection. */
    picks: {
      deep: true,
      handler(picks: ReadonlyArray<CardName>) {
        if (this.activeTask.kind === 'cardSelect') {
          rememberCardBrowserPicks(this.resetKey, picks);
        }
      },
    },
    /** Publish the CONTEXTUAL command contract to the shell's ONE bottom
     *  command bar (consolePanelUi) — hints live only there, never in a
     *  panel-local footer (CONSOLE_TV_PREMIUM_PLAN §3.2). */
    footCommands: {
      immediate: true,
      deep: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>) {
        setPanelCommands('taskHost', cmds);
      },
    },
    /** While a conversion prompt is live, the player rail marks the two stock
     *  rows the decision is about (a delicate focus, values untouched). */
    conversionWatchKey: {
      immediate: true,
      handler(key: string) {
        if (key === '') {
          clearConversionPromptWatch();
          return;
        }
        const [from, to] = key.split('|');
        setConversionPromptWatch(from ?? '', to ?? '');
      },
    },
  },
  mounted() {
    void this.$nextTick(() => this.fitCardStrip());
    // Foundation: VueUse-managed listeners (no raw add/removeEventListener).
    this.stopStripObs = useResizeObserver(this.$el as HTMLElement, () => this.scheduleFit()).stop;
    this.stopResize = useEventListener(window, 'resize', this.scheduleFit);
  },
  beforeUnmount() {
    clearPanelCommands('taskHost');
    // Same rule as the panel commands: watchers do not fire on unmount, so the
    // rail's conversion focus is retracted explicitly (idempotent).
    clearConversionPromptWatch();
    // The watcher does not fire on unmount — retract the published stage name
    // explicitly, or the workspace breadcrumb keeps announcing a step that is
    // no longer on screen.
    if (this.embedded) {
      setWorkspaceOutcomePhase('');
    }
    this.stopStripObs?.();
    this.stopResize?.();
    if (this.dealLaunchTimer !== undefined) {
      window.clearTimeout(this.dealLaunchTimer);
    }
    if (this.settleFitTimer !== undefined) {
      window.clearTimeout(this.settleFitTimer);
    }
    this.deal.dispose();
    // An engaged rise scene can't outlive its frame — hand the tray off
    // (the watcher may not flush during teardown).
    if (riseSceneEngaged()) {
      finishRiseScene();
    }
  },
  methods: {
    // Render-ready row for a server-computed target change (resource/M€ stock, or
    // a MarsBot track regression shown as the track's Tag + step count).
    toTargetRow(r: TargetImpactChange): TargetRowVM {
      const isTrack = r.scope === 'track';
      return {
        isTrack,
        tag: isTrack ? (r.icon as Tag) : undefined,
        iconClass: isTrack ? '' : iconClassFor(r.icon) + ' con-task__opt-res',
        from: r.from,
        to: r.to,
        steps: r.scope === 'track' ? r.steps : undefined,
        prod: r.scope !== 'stock',
      };
    },
    resetState(): void {
      this.focusIdx = 0;
      this.armed = false;
      this.units = {};
      // Card-browser picks survive a minimize→restore: seed from the
      // defer-durable module store when the reset key matches (same prompt +
      // card set, e.g. a re-expanded modal), otherwise start empty (a
      // genuinely new ask / fresh card set / non-card task).
      this.picks = this.activeTask.kind === 'cardSelect' ? recallCardBrowserPicks(this.resetKey) as Array<CardName> : [];
      // projectCard (generic): a fresh prompt always re-opens on the PICK
      // stage — a stale pay stage would price a card the new ask never offered.
      this.pcStage = 'pick';
      this.pcPick = undefined;
      this.submitting = false;
      // Payment opens on the SAME optimal default mix the desktop form uses.
      this.payCounts = this.activeTask.kind === 'payment' ?
        initialCounts(this.paymentCost, this.payLanes, this.megacreditsOnHand) : {};
      // A CONVERSION opens at the SAFE floor (0 — «не преобразовывать») even
      // when the server marks maxByDefault: converting is a deliberate opt-in
      // and the commit verb names the refusal explicitly, so nothing can be
      // spent by a reflex press. Bare amounts keep the server's default.
      const amountModel = this.wf?.type === 'amount' ? (this.wf as SelectAmountModel) : undefined;
      const init = amountModel !== undefined ?
        (amountModel.conversion !== undefined ? amountModel.min :
          (amountModel.maxByDefault ? this.amountMax : this.amountMin)) :
        // The Hydronetwork move stepper opens at the SAFE floor — the fewest
        // legal steps to buy; spending more energy is a deliberate dial-up.
        (this.wf?.type === 'deltaProject' ? this.amountMin : this.amountMax);
      this.value = init;
    },
    /** The shell routes every intent here while the host is active. */
    handleIntent(intent: GamepadIntent): void {
      // Any input mid-PICK-BEAT (the hero flying into the tray) skips it —
      // the press is consumed, nothing can act on the dissolving round.
      if (draftPickBeatActive()) {
        skipDraftPickBeat();
        return;
      }
      // Any input mid-deal SKIPS the cinematic (and is consumed) — no press
      // can act on cards that aren't interactive yet.
      if (this.deal.state.active) {
        this.deal.skip();
        return;
      }
      // The workspace's BATCH ARRIVAL is the same rule one level out: the cards
      // are still flying in over these slots, so every verb is absorbed until
      // they have landed and handed over. Absorbed, not queued — a press the
      // player made at an empty stage must not fire on whatever lands there.
      if (this.arrivalPending) {
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      // L3 = the SOURCE, fullscreen. EMBEDDED reads the workspace claim (the
      // one thing that knows which card's action produced this pick);
      // STANDALONE reads the prompt's own `choiceContext` source — the card
      // that caused a decision the player did not open themselves (Philares).
      // The stage under the viewer is never unmounted: selection, cost and
      // focus all survive.
      if (intent.kind === 'press' && intent.button === 'stickL') {
        if (this.workspaceSourceCard !== undefined) {
          this.zoomWorkspaceSource();
          return;
        }
        if (this.standaloneSourceCard !== undefined) {
          this.zoomSourceCard();
          return;
        }
      }
      const action = consoleActionOf(intent);
      if (action !== undefined) {
        this.onPress(action);
      }
    },
    /**
     * DEAL CINEMATIC (console_card_deal.less / cardDealSequence.ts): decide
     * + arm the hold for a fresh card set, synchronously — called pre-flush
     * from the resetKey watcher, so the real cards render hidden from their
     * very first frame. Only the card browser deals; every other task kind
     * clears any previous hold.
     */
    prepareDeal(): void {
      if (this.dealLaunchTimer !== undefined) {
        window.clearTimeout(this.dealLaunchTimer);
        this.dealLaunchTimer = undefined;
      }
      const cards = this.activeTask.kind === 'cardSelect' ? this.cardEntries.map((e) => e.card) : [];
      const names = cards.map((c) => c.name);
      const keys = cards.map((c, i) => c.name + '#' + i);
      const dealKey = `${this.playerView.id}|${this.resetKey}`;
      // The SAME rule for the workspace's execution beat. Embedded, the
      // card has ALREADY been pulled off the HUD pile, flown into this very
      // zone and turned over — that beat IS this set's arrival. Dealing again
      // sends the same card from the same deck a second time: the player
      // watches it arrive, settle, and then arrive again. (Log signature:
      // `onSettled` → `beatDone` → the old deal starting.)
      if (this.embedded && names.length > 0) {
        this.deal.dispose();
        shouldRunDealOnce(dealKey);
        return;
      }
      if (this.deal.prepare(dealKey, names, keys)) {
        // Launch after the con-task-swap frame transition (160ms) settles +
        // fitCardStrip has sized the row — the measured rects are final.
        // A still-landing draft pick (the hero flying into the tray) is
        // AWAITED first: consequences never precede their explanation.
        this.dealLaunchTimer = window.setTimeout(() => {
          this.dealLaunchTimer = undefined;
          void whenPickBeatDone().then(() => requestAnimationFrame(() => this.launchDeal()));
        }, motionMs(260));
      } else if (riseSceneEngaged() && this.isBuyMode) {
        // The buy set was already dealt once (defer/restore path) — never
        // replay the scene; the tray hands off instantly.
        finishRiseScene();
      }
    },
    launchDeal(): void {
      if (!this.deal.state.active) {
        return;
      }
      const strip = this.$refs.cardStrip as HTMLElement | undefined;
      const layer = this.$refs.dealLayer as InstanceType<typeof ConsoleCardDealLayer> | undefined;
      if (strip === undefined || strip === null || layer === undefined) {
        this.deal.dispose();
        if (riseSceneEngaged()) {
          finishRiseScene();
        }
        return;
      }
      const slotCards = Array.from(strip.querySelectorAll<HTMLElement>(':scope > .con-cards__slot > :is(.card-container, .pcard)'));
      this.deal.launch({
        slotCards, proxies: layer.proxyEls(), deck: layer.deckEl(), rise: this.riseExtras(),
        // EMBEDDED as a workspace outcome: these cards were physically taken
        // off the HUD project deck by the action the player just confirmed, so
        // they must leave FROM it. Dealing them from the synthetic bottom
        // dealer contradicts «посмотрите верхнюю карту колоды» and breaks the
        // causal chain the whole flow is built on — the player must see where
        // the card came from. Outside the workspace the dealer is unchanged.
        originEl: this.embedded ? document.querySelector<HTMLElement>('.con-deckstack__pile') : null,
      });
    },
    /**
     * THE RESEARCH RISE (the flagship draft→research transition): when the
     * buy prompt arrives with the just-drafted pile still on the tray, the
     * deal launches in RISE mode — proxies start on the TRAY slots (the
     * auto-passed last card first ARRIVES from the deck, flipping), the
     * completed set pulses, then the whole pile flies into the research
     * row and the modal frame materializes around it. A missing/degenerate
     * tray (edge) falls back to the honest deck deal.
     */
    riseExtras(): RiseLaunchExtras | undefined {
      if (!riseSceneEngaged() || !this.isBuyMode || this.activeTask.kind !== 'cardSelect') {
        return undefined;
      }
      const cards = this.deal.state.cards;
      const sources: Array<DealTargetRect> = [];
      const arrivals: Array<number> = [];
      for (let i = 0; i < cards.length; i++) {
        const name = cards[i];
        const slot = resolveTraySlot(name);
        const card = slot !== null ? (slot.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? slot) : null;
        const r = card !== null ? card.getBoundingClientRect() : undefined;
        if (r === undefined || r.width < 10 || r.height < 10) {
          finishRiseScene(); // no believable tray — the deck deal carries it
          return undefined;
        }
        sources.push({left: r.left, top: r.top, width: r.width, height: r.height});
        if (this.draftTrayState.sceneArrivals.includes(name)) {
          arrivals.push(i);
        }
      }
      beginRiseScene();
      return {
        sources,
        arrivals,
        onArrivalLanded: (i) => {
          const name = cards[i];
          if (name !== undefined) {
            riseArrivalLanded(name);
          }
        },
        onSetComplete: riseSetComplete,
        onLiftOff: riseLiftOff,
        onFrameReveal: riseFrameReveal,
      };
    },
    /** P13/P15: X opens the focused card fullscreen (reused viewer). The
     *  select context lets A toggle the pick from fullscreen — disabled
     *  candidates stay readable but never pickable (toggle no-ops).
     *  PHYSICAL origin: the fullscreen card lifts out of / returns into the
     *  strip slot of the BROWSED card; the strip focus follows LB/RB. */
    zoomFocusedCard(): void {
      if (this.cardEntries.length === 0) {
        return;
      }
      const cards = this.cardEntries.map((e) => e.card);
      const origin = slotZoomOrigin(
        () => this.$refs.cardStrip as HTMLElement | undefined,
        (i) => cards[i]?.name ?? '',
        (i) => {
          this.focusIdx = i;
          void this.$nextTick(() => this.scrollFocusedIntoView());
        },
      );
      // A card-EVALUATION context (a draft pick / the research or reveal BUY —
      // both structural: the router's mode / the game phase) opts the viewer
      // into the availability panel in the DRAFT voice («пока не выполнено» /
      // «уже не выполнить»). A plain select/discard/target pick passes nothing:
      // current playability is irrelevant to that decision.
      const availability = this.isBuyMode || this.isDraftPick ? 'draft' as const : undefined;
      if (this.singlePick) {
        // PICK phase: A in the viewer COMMITS the card (the ACTION bridge —
        // executes AFTER the viewer closes, never a toggle) — parity with the
        // strip's single-press select, and with the desktop fullscreen "Select".
        openConsoleCardZoom(cards, this.focusIdx, undefined, {
          labelFor: (name) => (this.cardEntries.find((e) => e.card.name === name)?.disabled ? undefined : 'Select'),
          reasonsFor: (name) => {
            const e = this.cardEntries.find((entry) => entry.card.name === name);
            return e !== undefined && e.disabled && e.reason !== '' ? [e.reason] : [];
          },
          execute: (name) => this.commitSingleCard(name),
        }, {origin, availability});
        return;
      }
      // BUY / multi: A toggles the pick and the viewer STAYS open to browse.
      openConsoleCardZoom(cards, this.focusIdx, {
        isSelected: (name) => this.isPicked(name),
        toggle: (name) => this.toggleCardPickByName(name),
      }, undefined, {origin, availability});
    },
    /** Read-only browse of the already-drafted cards (LB/RB page, B closes) —
     *  no select/action bridge, so it can never re-submit a drafted card.
     *  Opened from the count chip (no card tiles on screen) → TEXTUAL. */
    openDraftedViewer(): void {
      if (this.draftedCards.length > 0) {
        openConsoleCardZoom([...this.draftedCards], 0, undefined, undefined, {origin: {kind: 'textual'}});
      }
    },
    /**
     * Inspect the docked SOURCE card fullscreen — read-only (no select / action
     * bridge, so it can never submit the prompt). The card is a VISIBLE tile, so
     * it lifts physically out of its dock and dives back into it on close.
     * Reached by X on a CHOICE (there the card IS the subject) and by L3
     * everywhere else (there it is the source that produced the prompt); the
     * viewer NAMES that role, mirroring the drawn reveal's «ИСТОЧНИК ДОБОРА».
     */
    zoomSourceCard(): void {
      const name = this.sourceCardName;
      if (name === undefined) {
        return;
      }
      openConsoleCardZoom([{name}], 0, undefined, undefined, {
        statusLabel: 'Source',
        origin: {
          kind: 'physical',
          resolve: () => {
            // The dock is a COMPONENT now — reach its root element.
            const dock = this.$refs.sourceCard as {$el?: HTMLElement} | undefined;
            return dock?.$el?.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? null;
          },
        },
      });
    },
    /**
     * L3 (embedded): fullscreen the workspace SOURCE — the card whose action
     * produced this pick. Read-only (no select/action bridge), lifting
     * physically out of the workspace's standing hero slot and returning into
     * it on close; the pick stage itself is never unmounted, so the selection,
     * the cost math and the focused card all survive the round trip.
     */
    zoomWorkspaceSource(): void {
      const name = this.workspaceSourceCard;
      if (name === undefined) {
        return;
      }
      const card = this.playerView.thisPlayer.tableau.find((c) => c.name === name) ?? {name};
      openConsoleCardZoom([card as CardModel], 0, undefined, undefined, {
        contextLabel: 'Card actions',
        statusLabel: 'Source',
        // ONE resolver for every host that offers L3 Источник — the hero card
        // itself lifts out of the composer column (see the helper).
        origin: workspaceSourceZoomOrigin(String(name)),
      });
    },
    /**
     * Row jump in GRID mode — measured from the real DOM (offsetTop groups),
     * so it is robust to flex-wrap at any profile/width: pick the slot in
     * the adjacent row whose centre is nearest horizontally.
     */
    moveFocusRow(step: 1 | -1): void {
      const strip = this.$refs.cardStrip as HTMLElement | null | undefined;
      if (strip === undefined || strip === null) {
        return;
      }
      const slots = Array.from(strip.children) as Array<HTMLElement>;
      const cur = slots[this.focusIdx];
      if (cur === undefined) {
        return;
      }
      const curTop = cur.offsetTop;
      const curCx = cur.offsetLeft + cur.offsetWidth / 2;
      let best = -1;
      let bestScore = Infinity;
      slots.forEach((el, i) => {
        const dTop = el.offsetTop - curTop;
        if ((step === 1 && dTop <= 4) || (step === -1 && dTop >= -4)) {
          return; // not in the requested direction
        }
        const rowDist = Math.abs(dTop);
        const cx = el.offsetLeft + el.offsetWidth / 2;
        const score = rowDist * 10000 + Math.abs(cx - curCx);
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      });
      if (best !== -1 && best !== this.focusIdx) {
        this.focusIdx = best;
        this.armed = false;
        void this.$nextTick(() => this.scrollFocusedIntoView());
      }
    },
    onNav(dir: NavDirection): void {
      const vertical = dir === 'up' || dir === 'down';
      if (this.activeTask.kind === 'amount') {
        // The BINARY conversion renders as two vertical plates, so ↑/↓ walk
        // them too (the value IS the focus); ←/→ keep adjusting everywhere.
        const binaryRows = this.conversionVm?.binary === true;
        if (dir === 'left' || (binaryRows && dir === 'up')) {
          this.adjust(-1);
        }
        if (dir === 'right' || (binaryRows && dir === 'down')) {
          this.adjust(1);
        }
        return;
      }
      if (this.activeTask.kind === 'distribute' || this.activeTask.kind === 'payment' ||
          (this.activeTask.kind === 'projectCard' && this.pcStage === 'pay')) {
        if (vertical) {
          this.moveFocus(dir === 'down' ? 1 : -1);
        } else {
          this.adjust(dir === 'right' ? 1 : -1);
        }
        return;
      }
      if (this.activeTask.kind === 'resource' || this.activeTask.kind === 'cardSelect' ||
          this.activeTask.kind === 'projectCard') {
        // Horizontal tile row / filmstrip; the P13 GRID adds row jumps.
        if (!vertical) {
          this.moveFocus(dir === 'right' ? 1 : -1);
        } else if ((this.activeTask.kind === 'cardSelect' && this.gridMode) ||
                   (this.activeTask.kind === 'projectCard' && this.pcGrid)) {
          this.moveFocusRow(dir === 'down' ? 1 : -1);
        }
        return;
      }
      // choice / player: vertical rows.
      if (vertical) {
        this.moveFocus(dir === 'down' ? 1 : -1);
      }
    },
    moveFocus(step: number): void {
      const n = this.focusCount;
      if (n === 0) {
        return;
      }
      const next = Math.min(n - 1, Math.max(0, this.focusIdx + step));
      if (next !== this.focusIdx) {
        this.focusIdx = next;
        this.armed = false;
        void this.$nextTick(() => this.scrollFocusedIntoView());
      }
    },
    scrollFocusedIntoView(): void {
      const body = this.$refs.body as HTMLElement | undefined;
      const slot = this.$refs.focusedCardSlot as HTMLElement | Array<HTMLElement> | undefined;
      const cardEl = Array.isArray(slot) ? slot[0] : slot;
      if (cardEl !== undefined && cardEl !== null) {
        // The single ROW is fit-to-width (fitCardStrip) so it NEVER scrolls —
        // scrolling it on focus shifted the other cards AND churned the whole
        // strip every d-pad move (Steam Deck perf hit). Only GRID mode scrolls,
        // and only VERTICALLY to the focused row.
        if (this.gridMode) {
          cardEl.scrollIntoView({block: 'nearest', behavior: 'smooth'});
        }
        return;
      }
      const focused = body?.querySelector('.con-task__option--focused, .con-task__tile--focused, .con-task__lane--focused, .con-payrow--focused');
      focused?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    },
    /** rAF-coalesced fit for resize bursts (never fires per focus move). */
    scheduleFit(): void {
      if (this.fitScheduled) {
        return;
      }
      this.fitScheduled = true;
      requestAnimationFrame(() => {
        this.fitScheduled = false;
        this.fitCardStrip();
      });
    },
    /**
     * The vertical space the MODAL may occupy — the host's padded content
     * box. The host's CSS padding reserves the top HUD strip + the bottom
     * command-bar band (the WORK BAND), so measuring it keeps the fit and
     * the CSS `max-height: 100%` in exact agreement: the modal can never
     * outgrow the visible play area again. Fallback: the legacy 86vh
     * viewport budget (JSDOM / not laid out yet).
     */
    workBandHeight(): number {
      const host = this.$el as HTMLElement | undefined;
      if (host !== undefined && host !== null && host.clientHeight > 0) {
        const cs = window.getComputedStyle(host);
        const h = host.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
        if (h > 0) {
          return h;
        }
      }
      return 0.86 * window.innerHeight;
    },
    /**
     * The modal's NON-STRIP vertical chrome, MEASURED: task paddings + the
     * header (title / draft subtext / the tall BUY economics rows) + the
     * always-mounted verdict bar (+ the .con-cards gap above it). The old
     * fixed `220 * s` estimate under-counted the buy header and never saw
     * the verdict bar at all (it mounted after the deal) — the two reasons
     * the modal could overrun the work band. Falls back to the estimate
     * when nothing is measurable (JSDOM / mid-teardown).
     */
    modalChromeHeight(strip: HTMLElement, s: number): number {
      const task = strip.closest('.con-task') as HTMLElement | null;
      if (task === null) {
        return 220 * s;
      }
      const tcs = window.getComputedStyle(task);
      let total = (parseFloat(tcs.paddingTop) || 0) + (parseFloat(tcs.paddingBottom) || 0);
      let measuredAny = false;
      const head = task.querySelector<HTMLElement>('.con-task__head');
      if (head !== null && head.offsetHeight > 0) {
        total += head.offsetHeight + (parseFloat(window.getComputedStyle(head).marginBottom) || 0);
        measuredAny = true;
      }
      const verdict = task.querySelector<HTMLElement>('.con-cards__verdictbar');
      if (verdict !== null && verdict.offsetHeight > 0) {
        const cards = verdict.parentElement;
        const gap = cards !== null ? (parseFloat(window.getComputedStyle(cards).rowGap) || 0) : 0;
        total += verdict.offsetHeight + gap;
        measuredAny = true;
      }
      // Rounding / focus-lift headroom on top of the measured chrome.
      return measuredAny ? total + 8 * s : 220 * s;
    },
    /** A one-shot re-fit AFTER the entry/deal cinematic settles (~360ms) —
     *  the safety net for the buy modal, whose first fit could race the wide
     *  panel / rise flight and leave small cards. Cheap + idempotent. */
    scheduleSettleFit(): void {
      if (this.settleFitTimer !== undefined) {
        window.clearTimeout(this.settleFitTimer);
      }
      this.settleFitTimer = window.setTimeout(() => {
        this.settleFitTimer = undefined;
        this.fitCardStrip();
      }, motionMs(380));
    },
    /**
     * Size the SINGLE-ROW card strip so N cards ALWAYS fit its width — the
     * strip then never overflows, so it never scrolls on focus and neighbours
     * never shift. Sets `--con-cards-zoom` (a layout `zoom` on each slot); the
     * focused card's `transform: scale` rides ON TOP (visual, no reflow). Runs
     * on mount / prompt / count / resize — NEVER per focus, so the per-d-pad
     * cost is zero (Steam Deck). Grid mode keeps its own wrapping zoom.
     */
    fitCardStrip(): void {
      // Vue 3 sets a template ref to `null` (not `undefined`) once its v-if'd
      // element unmounts — a queued `$nextTick(fitCardStrip)` from a watcher can
      // fire AFTER the cardStrip left the DOM (task kind changed), so guard both.
      const strip = this.$refs.cardStrip as HTMLElement | null | undefined;
      if (strip === undefined || strip === null) {
        return;
      }
      if (this.activeTask.kind !== 'cardSelect') {
        strip.style.removeProperty('--con-cards-zoom');
        strip.style.removeProperty('--con-cards-grid-zoom');
        strip.style.removeProperty('max-width');
        return;
      }
      const n = strip.children.length;
      if (n === 0) {
        strip.style.removeProperty('--con-cards-zoom');
        strip.style.removeProperty('--con-cards-grid-zoom');
        strip.style.removeProperty('max-width');
        return;
      }
      const grid = this.gridMode;
      // Probe one slot at natural scale (offsetWidth/Height ignore the focused
      // card's transform: scale AND report the UNZOOMED box). The premium
      // 320×460 face made HEIGHT the binding constraint for the grid buy, so
      // both branches now fit height too (was width-only + a fixed grid zoom
      // tuned for the legacy 300×415 card → the 10-card buy overflowed).
      // ⚠️ RESET THE ENGINE'S OWN OUTPUTS BEFORE MEASURING. The wrap cap is a
      // `max-width` on this very row, so a second fit would measure the width
      // the FIRST fit chose — narrower room, more rows, a narrower cap, and so
      // on. Same rule as the zoom reset beside it: an engine never reads its
      // own output.
      strip.style.setProperty(grid ? '--con-cards-grid-zoom' : '--con-cards-zoom', '1');
      strip.style.setProperty('--con-ws-stage-rowmax', '100%');
      strip.style.removeProperty(grid ? '--con-cards-zoom' : '--con-cards-grid-zoom');
      strip.style.removeProperty('max-width');
      const probe = strip.children[0] as HTMLElement;
      const slotW = probe.offsetWidth;
      const slotH = probe.offsetHeight;
      if (slotW <= 0 || slotH <= 0) {
        // Not laid out yet (JSDOM / mid-reload) — retry a bounded number of frames.
        if (this.fitRetries < 20) {
          this.fitRetries++;
          requestAnimationFrame(() => this.fitCardStrip());
        }
        return;
      }
      this.fitRetries = 0;
      const cs = window.getComputedStyle(strip);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const colGap = parseFloat(cs.columnGap) || parseFloat(cs.gap) || 14;
      const rowGap = parseFloat(cs.rowGap) || colGap;
      const availW = strip.clientWidth - padX;
      // TV profile: the card face is px-natural (320×460), so its logical
      // size ceiling scales with the profile; floors follow so cards never
      // read logically SMALLER on a 4K viewport than on 1080p.
      const s = conUiScale();
      // The REAL vertical budget: the work band (the host's padded content
      // box — top HUD strip and command bar excluded) minus the MEASURED
      // modal chrome (header + verdict bar + paddings). Shared by both
      // branches so the modal always closes inside the visible play area.
      const availH = Math.max(200 * s, this.workBandHeight() - this.modalChromeHeight(strip, s) - padY);
      if (!grid) {
        if (this.embedded) {
          // EMBEDDED: the SHARED STAGE LAYOUT (consoleWsStageLayout) — the
          // drawn reveal solves its stage with the very same function, so
          // «купить» and «получена» present a byte-identical hero, gap and row
          // shape. The gap is an OUTPUT here (focus-safe by construction), and
          // a large batch may wrap instead of only shrinking.
          //
          // The BUDGET is this row's own box, not the work band minus an
          // enumerated chrome list: the embedded stage is a strict flex column
          // whose row is the only flexing part, so its height IS what the stage
          // can spend — the same number, measured the same way, on both stages.
          const layout = wsStageLayout({
            availW,
            availH: Math.max(200 * s, strip.clientHeight - padY),
            slotW, slotH, n, ui: s, rowGapPx: rowGap, padXPx: padX,
          });
          Object.entries(wsStageLayoutStyle(layout))
            .forEach(([k, v]) => strip.style.setProperty(k, v));
          return;
        }
        // STANDALONE: the historical row fit (cardStripFit) — the full-bleed
        // band is a different box with its own tuned chrome, and it is not
        // part of the workspace-stage parity contract.
        const zoom = fitRowZoom({availW, availH, slotW, slotH, n, colGap, ui: s});
        strip.style.setProperty('--con-cards-zoom', zoom.toFixed(3));
        return;
      }
      // GRID buy: the modal is centred + band-capped (max-height: 100% of the
      // padded host), so the available HEIGHT is the shared work-band budget
      // computed above, NOT the strip's own height (which grows WITH the
      // cards → circular). Pick the balanced rows×cols with the largest zoom
      // that fits both axes; cap the width so flex-wrap breaks at the planned
      // columns (5+5, never 6+4).
      let best = {zoom: 0, cols: Math.ceil(n / 2)};
      for (let rows = 1; rows <= Math.min(3, n); rows++) {
        const cols = Math.ceil(n / rows);
        const wZoom = (availW - (cols - 1) * colGap) / (cols * slotW);
        const hZoom = (availH - (rows - 1) * rowGap) / (rows * slotH);
        const zoom = Math.min(1 * s, wZoom, hZoom);
        if (zoom > best.zoom) {
          best = {zoom, cols};
        }
      }
      const zoom = Math.max(0.4 * s, best.zoom);
      strip.style.setProperty('--con-cards-grid-zoom', zoom.toFixed(3));
      // Zoom quantizes tiles to device px — give the row rounding room so the
      // planned column count can't flex-wrap into an unplanned extra row.
      strip.style.maxWidth = `${Math.ceil(best.cols * slotW * zoom + (best.cols - 1) * colGap + padX + 2 + 4 * s)}px`;
    },
    // ── card browser helpers (T2) ────────────────────────────────────
    isPicked(name: CardName): boolean {
      return this.picks.includes(name);
    },
    togglePick(): void {
      const entry = this.focusedCardEntry;
      if (entry === undefined || entry.disabled) {
        return; // a disabled candidate is readable, never pickable
      }
      this.toggleCardPickByName(entry.card.name);
    },
    /** P15: pure selection flip — shared by the strip AND the fullscreen
     *  viewer's A (picked → deselect, even single-pick; the hidden
     *  A-on-picked confirm is gone — Y is the one confirm). */
    toggleCardPickByName(name: CardName): void {
      const entry = this.cardEntries.find((e) => e.card.name === name);
      if (entry === undefined || entry.disabled) {
        return;
      }
      const at = this.picks.indexOf(name);
      if (at !== -1) {
        this.picks.splice(at, 1);
        return;
      }
      if (this.cardMax === 1) {
        this.picks = [name]; // single-slot: the new pick replaces
        return;
      }
      if (this.picks.length >= this.cardMax) {
        return; // slots full — the verdict bar explains (deselect first)
      }
      this.picks.push(name);
    },
    /** PICK phase (single card): select the focused card AND submit at once —
     *  no lingering "selected" state, no re-pick (desktop single-select parity). */
    commitFocusedCard(): void {
      const entry = this.focusedCardEntry;
      if (entry !== undefined && !entry.disabled) {
        this.commitSingleCard(entry.card.name);
      }
    },
    /** The live strip slot for a card (data-zoom-slot marker). */
    exitSlotFor(name: CardName): HTMLElement | null {
      const strip = this.$refs.cardStrip as HTMLElement | undefined;
      if (strip === undefined || strip === null || typeof strip.querySelector !== 'function') {
        return null;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
      return strip.querySelector<HTMLElement>(`[data-zoom-slot="${esc}"]`);
    },
    commitSingleCard(name: CardName): void {
      const entry = this.cardEntries.find((e) => e.card.name === name);
      if (entry === undefined || entry.disabled) {
        return;
      }
      const commit = () => {
        this.picks = [name];
        this.onConfirm();
      };
      // `this.picks` is still EMPTY here, so the live `confirmReady`
      // (= cardPicksValid, which needs picks.length ≥ cardMin) is false for
      // every min-1 prompt — it CANNOT gate this pick. Compute the would-be
      // validity of committing exactly [name] instead. Without this the
      // guard always fell through to the instant commit and the hero beat
      // (and the whole draft-tray transfer) never played — the modal just
      // swapped out with all cards, no flight.
      const wouldBeValid = this.cardMin <= 1 && this.cardMax >= 1 && this.cardBuyAffordable;
      if (this.submitting || !wouldBeValid) {
        commit(); // onConfirm self-guards
        return;
      }
      const slot = this.exitSlotFor(name);
      if (slot === null) {
        commit();
        return;
      }
      const strip = this.$refs.cardStrip as HTMLElement | undefined;
      const rejects = strip !== undefined && strip !== null ?
        (Array.from(strip.children) as Array<HTMLElement>).filter((el) => el !== slot && !el.classList.contains('con-deal-hold')) : [];
      // The hero beat reads FIRST; the rejects start tumbling under it.
      applyDiscardExit(rejects, {delayMs: 150});
      // THE DRAFT PICK BEAT (consoleDraftTray.ts): the chosen card is a HERO
      // that physically joins the drafted tray — the modal chrome dissolves
      // under it (`tableView`), the card lands ON the pile, and only then
      // does the next round / waiting state take the screen. Submit fires
      // at onLift — the game flow is never delayed behind the cinematic.
      if (this.isDraftPick) {
        runDraftPickBeat({picks: [{name, el: slot}], commit});
        return;
      }
      // Non-draft single pick (choose a target): the classic hero departure
      // to the player zone — there is no tray to land on.
      void runHeroPick({name, el: slot}, commit);
    },
    /** BUY / multi commit (RT) — the PURCHASE cinematic: the kept cards
     *  gather into one back-stack above the HAND DOCK (one confirmation
     *  pulse) and peel bottom-first into their real pack slots — the
     *  «КАРТЫ» counter ticks per landing (handDeliveryDirector; the submit
     *  fires as the flight begins, the server response lands mid-flight
     *  and the intake polls the dock slots in). A picked card that never
     *  reaches the hand degrades to a quiet fade — the intake self-adapts,
     *  so non-buy multi selects stay safe. The unbought cards drift to the
     *  discard side. Zero picks → just the calm discard (no hero objects).
     *  A MULTI-KEEP DRAFT (Luna Project Office / Mars Maths round 1)
     *  instead lands its heroes on the drafted tray — the same physical
     *  place every pick joins. */
    confirmCardSetWithExit(): void {
      if (this.activeTask.kind !== 'cardSelect' || this.singlePick || this.submitting || !this.confirmReady) {
        this.onConfirm(); // self-guarding fallback (also the 'not ready' path)
        return;
      }
      const commit = () => this.onConfirm();
      const strip = this.$refs.cardStrip as HTMLElement | undefined;
      if (strip === undefined || strip === null) {
        commit();
        return;
      }
      const sources: Array<ExitSource> = this.picks
        .map((name) => ({name, el: this.exitSlotFor(name)}))
        .filter((s): s is {name: CardName, el: HTMLElement} => s.el !== null);
      const chosen = new Set(sources.map((s) => s.el));
      const rejects = (Array.from(strip.children) as Array<HTMLElement>)
        .filter((el) => !chosen.has(el) && !el.classList.contains('con-deal-hold'));
      if (this.isDraftPick && sources.length > 0) {
        applyDiscardExit(rejects, {delayMs: 150});
        runDraftPickBeat({picks: sources, commit});
        return;
      }
      if (sources.length === 0) {
        // NOTHING BOUGHT. Embedded, the refusal is a physical OUTCOME, not an
        // absence: this card was turned over by the action the player just
        // performed, so it has to be seen going to the discard — the same
        // premium language a hand discard speaks, through the same director
        // (`discardOpenCards`), so future polish lands in one place.
        //
        // Deliberately NOT awaited: the refusal is already decided and the
        // game must not wait behind a flight. The proxies stand over the real
        // cards before the collapse, and the layer that carries them is
        // app-level, so they outlive this surface.
        if (this.embedded) {
          const refused = (this.cardEntries ?? [])
            .map((e) => ({name: e.card.name, el: this.exitSlotFor(e.card.name) ?? undefined}))
            .filter((s) => s.el !== undefined);
          if (refused.length > 0) {
            void discardOpenCards(refused);
            this.$emit('result-detached');
            commit();
            return;
          }
        }
        applyDiscardExit(rejects);
        if (this.embedded) {
          this.$emit('result-detached');
        }
        commit();
        return;
      }
      applyDiscardExit(rejects);
      // THE PURCHASE HANDOFF. `onStaged` is the director's designed seam: it
      // fires the frame the proxies physically stand over the real cards, so
      // the host may drop its surface with nothing left to lose. Collapsing
      // THERE (rather than before, or after the flight) is what makes the two
      // overlap — the card lifts, the workspace folds under it, the dock comes
      // back, and only then does the intake's own slot polling find the REAL
      // geometry and finish the flight. Never a guessed target, never a pause.
      void runHandIntake(sources.map((s) => ({name: s.name, el: s.el})), {
        mode: 'stack',
        commit,
        onStaged: this.embedded ? () => this.$emit('result-detached') : undefined,
      });
    },
    laneValue(unit: string): number {
      return (this.units as Record<string, number>)[unit] ?? 0;
    },
    /** The single-step gesture: put the one unit on this lane, or take it back. */
    distToggleFocused(): void {
      if (this.submitting) {
        return; // commit lock — see adjust()
      }
      const lane = this.lanes[this.focusIdx];
      if (lane !== undefined) {
        this.units = {...toggleSoleStep(this.lanes, this.units as BudgetState, this.distRule, lane.key)};
      }
    },
    payCount(unit: SpendableResource): number {
      return this.payCounts[unit] ?? 0;
    },
    adjust(step: number): void {
      // COMMIT LOCK: past the submit the dialed value is the committed value —
      // a dial move racing the server response would repaint the preview (and
      // the commit verb) as something the player did NOT confirm.
      if (this.submitting) {
        return;
      }
      if (this.activeTask.kind === 'amount') {
        const values = this.amountValidValues;
        if (values !== undefined && values.length > 0) {
          // Snap along the discrete list — it can be sparse, so a step must
          // land on the NEXT legal value, never between two.
          this.value = step > 0 ?
            (values.find((v) => v > this.value) ?? values[values.length - 1]) :
            ([...values].reverse().find((v) => v < this.value) ?? values[0]);
          return;
        }
        this.value = Math.min(this.amountMax, Math.max(this.amountMin, this.value + step));
        return;
      }
      if (this.activeTask.kind === 'distribute') {
        const lane = this.lanes[this.focusIdx];
        if (lane === undefined) {
          return;
        }
        // SINGLE-STEP: LB takes the unit back, RB moves it here — the silent
        // aliases of the A gesture (a plain `+1` under a full budget is
        // refused, so RB rebuilds from empty exactly as the toggle does).
        const next = this.distSingleStep ?
          (step < 0 ?
            (this.distFocusedPicked ? {} : this.units as BudgetState) :
            stepLane(this.lanes, {}, this.distRule, lane.key, 1)) :
          stepLane(this.lanes, this.units as BudgetState, this.distRule, lane.key, step);
        this.units = {...next};
        return;
      }
      if (this.activeTask.kind === 'payment') {
        const lane = this.payLanes[this.focusIdx];
        if (lane === undefined) {
          return;
        }
        const current = this.payCounts[lane.unit] ?? 0;
        // The AGGREGATE anti-overpay limit (dialLaneCount): a second alternative
        // may only cover what the others leave unpaid.
        const next = dialLaneCount(this.paymentCost, lane, this.payLanes, this.payCounts, step);
        if (next === current) {
          return;
        }
        this.payCounts = {...this.payCounts, [lane.unit]: next};
        this.payFlashNonce += 1;
        return;
      }
      if (this.activeTask.kind === 'projectCard' && this.pcStage === 'pay') {
        const lane = this.pcLanes[this.focusIdx];
        if (lane === undefined) {
          return;
        }
        const current = this.payCounts[lane.unit] ?? 0;
        const next = dialLaneCount(this.pcCost, lane, this.pcLanes, this.payCounts, step);
        if (next === current) {
          return;
        }
        this.payCounts = {...this.payCounts, [lane.unit]: next};
        this.payFlashNonce += 1;
      }
    },
    maxOut(): void {
      if (this.submitting) {
        return; // commit lock — see adjust()
      }
      if (this.activeTask.kind === 'amount') {
        this.value = this.amountMax;
        return;
      }
      if (this.activeTask.kind === 'distribute') {
        const lane = this.lanes[this.focusIdx];
        if (lane === undefined) {
          return;
        }
        const next = this.distSingleStep ?
          stepLane(this.lanes, {}, this.distRule, lane.key, 1) :
          maxOntoLane(this.lanes, this.units as BudgetState, this.distRule, lane.key);
        this.units = {...next};
        return;
      }
      if (this.activeTask.kind === 'payment') {
        const lane = this.payLanes[this.focusIdx];
        if (lane === undefined) {
          return;
        }
        // MAX = as much of THIS source as is still useful once the others are
        // counted — never «enough to cover the whole price alone».
        this.payCounts = {...this.payCounts, [lane.unit]: dialLaneCount(this.paymentCost, lane, this.payLanes, this.payCounts, 'max')};
        this.payFlashNonce += 1;
        return;
      }
      if (this.activeTask.kind === 'projectCard' && this.pcStage === 'pay') {
        const lane = this.pcLanes[this.focusIdx];
        if (lane === undefined) {
          return;
        }
        this.payCounts = {...this.payCounts, [lane.unit]: dialLaneCount(this.pcCost, lane, this.pcLanes, this.payCounts, 'max')};
        this.payFlashNonce += 1;
      }
    },
    // Foundation: SEMANTIC actions — LB/RB(prev/nextSection) adjust,
    // RT(nextTab) multi-commit/max, A(primary) act, X(inspect) zoom/confirm,
    // B(back) exit-nested/defer.
    onPress(action: ConsoleAction): void {
      switch (action) {
      case 'prevSection':
        this.adjust(-1);
        return;
      case 'nextSection':
        this.adjust(1);
        return;
      case 'nextTab':
        // CARD context: RT is the MULTI (buy / multi-target) commit. In the
        // single-keep DRAFT (where RT would otherwise be inert) RT opens the
        // read-only drafted-cards viewer instead.
        if (this.activeTask.kind === 'cardSelect') {
          if (this.canInspectDrafted) {
            this.openDraftedViewer();
          } else if (!this.singlePick) {
            this.confirmCardSetWithExit();
          }
          return;
        }
        this.maxOut();
        return;
      case 'primary':
        this.onPrimary();
        return;
      case 'inspect':
        // P13 global rule: X opens the focused card FULLSCREEN in every
        // card context; elsewhere it stays the one-press confirm.
        if (this.activeTask.kind === 'cardSelect') {
          this.zoomFocusedCard();
          return;
        }
        if (this.activeTask.kind === 'projectCard') {
          // Pick stage: inspect the focused candidate; pay stage: the picked
          // card (the one thing the payment is about).
          this.pcZoom();
          return;
        }
        // CONTEXTUAL CHOICE: A already commits, so X is free for the console-wide
        // INSPECT verb — the docked SOURCE card fullscreen (the card that caused
        // this choice). Without a source card X stays a harmless confirm alias,
        // and a GENERIC OrOptions keeps X as its real commit.
        if (this.choiceOnePress && this.sourceCardName !== undefined) {
          this.zoomSourceCard();
          return;
        }
        this.onConfirm();
        return;
      case 'back':
        // T9: inside a nested step B returns to the branch list, never defers.
        if (this.nested !== undefined) {
          this.exitNested();
          return;
        }
        // projectCard pay stage: B is ONE logical level — back to the pick
        // (nothing has been committed), never straight to a defer.
        if (this.activeTask.kind === 'projectCard' && this.pcStage === 'pay') {
          this.pcBackToPick();
          return;
        }
        this.$emit('defer');
        return;
      default:
        return;
      }
    },
    /** A: select/arm the focused element; A on the armed one = confirm. */
    onPrimary(): void {
      // SINGLE-STEP distribute: A is the radio gesture (place the unit here /
      // take it back) — the commit lives on X alone, so one press can never
      // both choose a lane and submit the choice.
      if (this.activeTask.kind === 'distribute' && this.distSingleStep) {
        this.distToggleFocused();
        return;
      }
      if (this.activeTask.kind === 'amount' || this.activeTask.kind === 'distribute' || this.activeTask.kind === 'payment') {
        this.onConfirm();
        return;
      }
      if (this.activeTask.kind === 'projectCard') {
        if (this.pcStage === 'pick') {
          this.pcSelectFocused();
        } else {
          this.onConfirm();
        }
        return;
      }
      if (this.activeTask.kind === 'cardSelect') {
        if (this.singlePick) {
          this.commitFocusedCard(); // PICK phase: A selects + submits at once
        } else {
          this.togglePick(); // BUY / multi: A toggles; RT commits
        }
        return;
      }
      if (this.wf?.type === 'option') {
        this.onConfirm(); // bare confirm — a single A is enough
        return;
      }
      // CONTEXTUAL CHOICE: picking a listed option IS the decision, so A commits
      // it in ONE press (see `choiceOnePress` for the desktop parity this
      // mirrors). `onConfirm` still arms a RISKY option (tradeoff / warning)
      // first, so an irreversible branch keeps its «нажмите ещё раз». Every
      // other kind — a GENERIC OrOptions, `player`, `resource` — keeps the
      // arm-then-confirm two-step its desktop twin also demands.
      if (this.choiceOnePress) {
        this.onConfirm();
        return;
      }
      if (this.armed) {
        this.onConfirm();
      } else {
        this.armed = true;
      }
    },
    /** X: one-press confirm of the focused selection (risky arms first). */
    onConfirm(): void {
      if (!this.confirmReady) {
        return;
      }
      switch (this.activeTask.kind) {
      case 'choice': {
        if (this.wf?.type === 'option') {
          this.submitResponse( optionConfirmResponse());
          return;
        }
        const entry = this.choiceEntries[this.focusIdx];
        if (entry === undefined) {
          return;
        }
        if (entry.risky && !this.armed) {
          this.armed = true; // risky: X arms first, second press confirms
          return;
        }
        if (entry.isSpace) {
          // Nested board pick — the shell hosts the headless SelectSpace
          // and wraps the space response into this option's OR index.
          this.$emit('space-pick', {index: entry.index, spacePrompt: entry.option});
          return;
        }
        if (entry.isNested) {
          // A nested pick whose candidates are ALL IN HAND is never a flat grid
          // inside this modal: it rides the real hand overlay, exactly like a
          // top-level in-hand prompt and like a composer's hand pick. That is
          // what makes Mars University's "discard a card to draw a card" the
          // SAME experience as every other discard instead of a third one.
          const handPick = entry.option.type === 'card' &&
            isHandCardSelection(entry.option, this.handNames) ? entry.option : undefined;
          if (handPick !== undefined) {
            this.$emit('hand-pick', {index: entry.index, cardPrompt: handPick});
            return;
          }
          // T9: OPEN the nested input as a one-level wizard step — its
          // submit is wrapped into this option's OR index; B returns here.
          this.nested = {index: entry.index, input: entry.option};
          return;
        }
        this.submitResponse(orOptionResponse(entry.index));
        return;
      }
      case 'player': {
        const p = this.playerEntries[this.focusIdx];
        if (p !== undefined) {
          this.submitResponse( playerResponse(p.color));
        }
        return;
      }
      case 'amount':
        // The 'delta' flavor serves BOTH Hydronetwork shapes on divergence:
        // the move stepper answers the move step; the reward-only claim
        // answers with its own positioned response.
        this.submitResponse( this.activeTask.flavor === 'delta' ?
          (this.wf?.type === 'deltaStageReward' ?
            {type: 'deltaStageReward' as const, position: this.value} :
            deltaProjectResponse(this.value)) :
          amountResponse(this.value));
        return;
      case 'resource': {
        const unit = this.resourceUnits[this.focusIdx];
        if (unit !== undefined) {
          this.submitResponse( resourceResponse(unit));
        }
        return;
      }
      case 'distribute':
        this.submitResponse( this.activeTask.mode === 'production' ?
          productionToLoseResponse(this.units) : resourcesResponse(this.units));
        return;
      case 'cardSelect':
        // Byte-parity: the bare top-level {type:'card', cards} the desktop
        // CardSelectionContent / hand-select flow POSTs.
        this.submitResponse( cardsResponse(this.picks));
        // The pick is committed — drop the defer-durable copy so it can never
        // rehydrate a later same-key prompt.
        clearCardBrowserPicks();
        return;
      case 'payment':
        this.submitResponse( paymentResponse(
          paymentFromCounts(this.paymentCost, this.payLanes, this.payCounts, this.megacreditsOnHand)));
        return;
      case 'projectCard': {
        if (this.pcStage === 'pick') {
          this.pcSelectFocused();
          return;
        }
        const card = this.pcPick;
        if (card === undefined) {
          return;
        }
        // Byte-parity with the desktop SelectProjectCardToPlay submit.
        this.submitResponse(projectCardResponse(
          card, paymentFromCounts(this.pcCost, this.pcLanes, this.payCounts, this.megacreditsOnHand)));
        return;
      }
      default:
        return;
      }
    },
    // ── projectCard (generic) stage moves ────────────────────────────
    /** A on a candidate: carry it into the PAY stage (nothing submitted). */
    pcSelectFocused(): void {
      const entry = this.pcEntries[this.focusIdx];
      if (entry === undefined || entry.disabled) {
        return;
      }
      this.pcPick = entry.card.name;
      this.pcStage = 'pay';
      // The payment opens on the same optimal default mix every payment
      // surface seeds (initialCounts) — M€ auto-derives.
      this.payCounts = initialCounts(this.pcCost, this.pcLanes, this.megacreditsOnHand);
      this.focusIdx = 0;
      this.armed = false;
    },
    /** B from PAY: one logical level back — the pick survives as the cursor. */
    pcBackToPick(): void {
      const backTo = this.pcEntries.findIndex((e) => e.card.name === this.pcPick);
      this.pcStage = 'pick';
      this.pcPick = undefined;
      this.payCounts = {};
      this.focusIdx = backTo !== -1 ? backTo : 0;
      this.armed = false;
    },
    /** X: fullscreen-inspect the stage's card (candidate / the picked one). */
    pcZoom(): void {
      if (this.pcStage === 'pay') {
        const card = this.pcPicked;
        if (card !== undefined) {
          openConsoleCardZoom([card], 0);
        }
        return;
      }
      const cards = this.pcEntries.map((e) => e.card);
      if (cards.length === 0) {
        return;
      }
      const origin = slotZoomOrigin(
        () => this.$refs.cardStrip as HTMLElement | undefined,
        (i) => cards[i]?.name ?? '',
        (i) => {
          this.focusIdx = i;
          void this.$nextTick(() => this.scrollFocusedIntoView());
        },
      );
      // A in the viewer carries the candidate into the PAY stage — the same
      // ACTION bridge the card browser's pick phase uses.
      openConsoleCardZoom(cards, this.focusIdx, undefined, {
        labelFor: (name) => (this.pcEntries.find((e) => e.card.name === name)?.disabled ? undefined : 'Select'),
        reasonsFor: (name) => {
          const e = this.pcEntries.find((x) => x.card.name === name);
          return e !== undefined && e.disabled && e.reason !== '' ? [e.reason] : [];
        },
        execute: (name) => {
          const i = this.pcEntries.findIndex((e) => e.card.name === name);
          if (i !== -1) {
            this.focusIdx = i;
            this.pcSelectFocused();
          }
        },
      }, {origin});
    },
    /** T9: back from a nested step to the branch list (nothing submitted). */
    exitNested(): void {
      this.nested = undefined;
    },
    /**
     * ALL submits route here: a nested step's response is WRAPPED into its
     * OR index (`{type:'or', index, response}` — byte-identical to the
     * desktop ModernOptionPicker's nestedSave); a top-level response
     * passes through unchanged.
     */
    submitResponse(response: unknown): void {
      if (this.submitting) {
        return; // guard rapid double-presses — no duplicate action (req §8)
      }
      this.submitting = true;
      // THE ONE FUNNEL every committed decision passes through — so the
      // workspace release lives HERE, not in a cinematic branch.
      //
      // It used to ride `onStaged` inside `confirmCardSetWithExit`, which is
      // only reached when the exit cinematic actually runs: the early returns
      // at its top (`singlePick`, `!confirmReady`) hand straight to
      // `onConfirm`, and a refusal takes a different arm than a purchase. That
      // is exactly the "closes every other time" the player saw — two paths,
      // one of which never announced itself. Emitting from the funnel makes it
      // path-independent; `onStaged` still fires too, and releasing twice is a
      // no-op, so the OVERLAP (collapse under the lifted card) is preserved
      // where the cinematic exists and simply absent where it never ran.
      if (this.embedded) {
        this.$emit('result-detached');
      }
      if (this.nested !== undefined) {
        this.$emit('submit', orWrappedResponse(this.nested.index, response));
        return;
      }
      this.$emit('submit', response);
    },
  },
});
</script>

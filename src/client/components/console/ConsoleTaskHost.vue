<template>
  <div ref="root" class="con-task-host" :class="{
         'con-ws': !embedded,
         'con-task-host--embedded': embedded,
         'con-task-host--table-beat': trayTableBeat,
         'con-task-host--receiving': receivingPick !== undefined,
         'con-task-host--receiving-board': receive.board,
         'con-task-host--receiving-home': receive.homing,
       }"
       :role="embedded ? 'group' : 'dialog'" :aria-label="titleText"
       :data-motion-surface="embedded ? undefined : 'task-host'">

    <!-- Keyed frame: a prompt → prompt switch is the PROMPT HANDOFF (PL-384 — the answered plate lets go, the next
         one arrives and composes from the top; `promptHandoffMotion.ts`), never a plain cross-fade. -->
    <transition :css="false" mode="out-in"
                @enter="promptSwapEnterHook" @leave="promptSwapLeaveHook"
                @enter-cancelled="promptSwapEnterCancelledHook" @leave-cancelled="promptSwapLeaveCancelledHook">
      <!-- `con-ws-stage-*` are the SHARED embedded-stage chassis classes (frame
           / card row / status line). The drawn reveal wears the same three, so
           both stages spend the SAME chrome and the shared fit returns the same
           hero — see .con-ws-stage-frame in console.less. -->
      <!-- STANDALONE, the panel is a plate of the PROMPT-MODAL FAMILY (`console_prompt.less`): its SIZE tier is read
           off the content (`promptSize`), its TONE (gain / loss / neutral) off the prompt's structural markers. -->
      <div class="con-task"
           :class="[
             {'con-task--wide': activeTask.kind === 'cardSelect', 'con-ws-stage-frame': embedded},
             embedded ? '' : 'con-prompt con-prompt--' + promptSize + ' con-prompt--' + tone,
           ]"
           :key="panelKey" data-motion-panel :data-prompt-panel="embedded ? undefined : ''">
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
          <template v-if="embeddedBadges.length > 0 || taskDecline !== undefined" #badges>
            <span v-for="badge in embeddedBadges" :key="badge.key" class="con-ws-stage-badge"
                  :class="{'con-ws-stage-badge--warn': badge.warn}">
              <span class="con-ws-stage-badge__label">{{ badge.label }}</span>
              <b class="con-ws-stage-badge__num">{{ badge.value }}</b>
              <i v-if="badge.coin" class="resource_icon resource_icon--megacredits con-ws-stage-badge__coin" aria-hidden="true"></i>
            </span>
            <ConsoleDeclinePlate v-if="taskDecline !== undefined" class="con-task__decline"
                                 :label="taskDecline.label" :forgone="taskDecline.forgone" />
          </template>
        </ConsoleWsStageHead>
        <!-- STANDALONE: the family's ONE head — the tone's crest and emblem, the category, «РЕШЕНИЕ N» for a follow-up
             of the same press, the tone tag, the ask and why it appeared. THE QUESTION LINE carries an optional
             choice's DECLINE as a plate: the refusal is RT, never one more option among the answers (2026-10-13). -->
        <ConsolePromptHead v-else class="con-task__head" :tone="tone" :kicker="kickerText" :title="titleText"
                           :trigger="triggerText" :prompt-key="sequenceKey" :series="promptSeries">
          <template v-if="taskDecline !== undefined" #decline>
            <ConsoleDeclinePlate class="con-task__decline" :label="taskDecline.label" :forgone="taskDecline.forgone" />
          </template>
          <!-- Phase note (draft: what happens to the cards you don't keep). -->
          <div v-if="phaseSubtext !== ''" class="con-task__subtext">{{ phaseSubtext }}</div>
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
                <span v-if="picks.length > 0" class="con-task__buysum-detail con-price-hint" data-purchase-price :data-hint="buyPriceHint">{{ picks.length }} × {{ buyCostPerCard }} {{ $t('per card') }}</span>
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
        </ConsolePromptHead>

        <div class="con-task__main">
          <!-- WHO asked — the SHARED source dock (`console-source-dock`, the lazy
               binding of `asyncComponents`), identical on every decision surface.
               COMPACT when the prompt is a DIAL or a LIST the card merely
               produced (Philares' resource distribution): the card is context,
               recognisable but never the subject, and L3 opens it. A `choice`
               keeps the full dock and its X — there the card IS what is being
               decided about. -->
          <!-- THE LAW'S SEAL (RX35): a pick asked by a law that REPLACED the seat's own terraforming, hosted inside
               a door's plate (the heat confirm, a standard project's step) — the embedded plate has no dock, so the
               law that pays stands here as its seal: the party's emblem on its accent and the resolution's name. The
               data's token is born on it where no struck icon is on screen. Never beside the standalone dock, which
               already shows the law's face. -->
          <div v-if="divertedLawSeal !== undefined" class="con-task__lawseal" data-task-law-seal
               :style="{'--parl-accent': divertedLawSeal.accent}">
            <img class="con-task__lawseal-emblem" :src="divertedLawSeal.emblem" alt="" />
            <span class="con-task__lawseal-text">
              <span class="con-task__lawseal-kind">{{ $t('Enacted resolution') }}</span>
              <b class="con-task__lawseal-name">{{ $t(divertedLawSeal.name) }}</b>
            </span>
          </div>
          <!-- `data-reaction-home` (the card-reaction law «one object per card»): the asker standing here IS the card on
               screen — its own answer (a series' plant, PC04) lifts THIS face in place, never a second instance risen over
               the plate. -->
          <console-source-dock v-if="dockedSource !== undefined" :view="dockedSource" :data-reaction-home="dockedSource.card"
                               :compact="sourceCompact" :boardName="playerView.game.gameOptions.boardName" ref="sourceCard">
            <!-- A resolution's payout reads under its face: influence → the
                 amount THIS pick adds (the server's own number). -->
            <template v-if="sourceYield !== undefined" #under>
              <ConsoleInfluenceYield class="con-task__source-yield" :yields="[sourceYield]" size="compact" />
            </template>
          </console-source-dock>

          <div class="con-task__body con-info__scroll" ref="body">
            <!-- Warnings carry over (parity). -->
            <div v-if="warningTexts.length > 0" class="con-task__warnings">
              <div v-for="(w, i) in warningTexts" :key="i" class="con-task__warning">⚠ {{ w }}</div>
            </div>

            <!-- ── CHOICE ─────────────────────────────────────────── -->
            <!-- P58 · FS — A CARD'S «WHICH TILE NEXT» (`placementOrderPrompt`): the «ВАРИАНТ» family's step, the card's own
                 printed hexes, the tiles placed sealed in place — the SAME component the start hosts in its body; here
                 it stands in the hand's zone (a prelude played mid-game) or, with nobody to host it, in this band. -->
            <ConsolePreludeVariantStep v-if="placementOrderVariant !== undefined" class="con-task__order"
                                       :variant="placementOrderVariant" :focus="placementOrderFocusRow" :embedded="true"
                                       @pick="onPlacementOrderPick" />
            <template v-else-if="activeTask.kind === 'choice'">
              <!-- THE OPTIONS — the variant grammar (`ConsoleVariantChoice`, TR51): the cursor a cold lift, an ARMED option
                   (the generic select → confirm) the seal, «ИЛИ» between a few exclusive results. A CONTEXTUAL choice
                   commits on A in one press, so the badge ALWAYS advertises A — a risky option arms and the second A
                   confirms; a GENERIC OrOptions keeps its select → confirm and says so (X). -->
              <ConsoleVariantChoice class="con-task__choices" layout="column" :exclusive="choiceEntries.length <= 3"
                                    :options="choiceOptions" :label="choiceGroupLabel">
                <template #body="{index}">
                  <template v-for="entry in [choiceEntries[index]]" :key="entry.index">
                    <div class="con-task__option-main">
                      <i v-if="entry.iconClass !== ''" class="con-task__opt-icon" :class="entry.iconClass" aria-hidden="true"></i>
                      <span v-if="entry.preview !== ''" class="con-task__opt-preview">{{ entry.preview }}</span>
                      <span v-if="entry.isSpace" class="con-task__opt-board">{{ $t('Choose a location on the board') }} →</span>
                      <GamepadGlyph v-if="focusIdx === index"
                                    :control="!choiceOnePress && armed ? 'secondary' : 'confirm'"
                                    class="con-task__opt-a" />
                    </div>
                    <div v-if="entry.effects.length > 0" class="con-task__opt-effects">
                      <ActionEffectChip v-for="(eff, k) in entry.effects" :key="k" :effect="eff" />
                    </div>
                    <div v-if="entry.description !== ''" class="con-task__opt-desc">{{ entry.description }}</div>
                    <div v-if="entry.tradeoff !== ''" class="con-task__opt-tradeoff">⚠ {{ entry.tradeoff }}</div>
                    <!-- The engine's own caution, in words — on the option itself, readable BEFORE the first press. -->
                    <div v-for="(w, k) in entry.warnings" :key="'w' + k" class="con-task__opt-tradeoff">⚠ {{ w }}</div>
                    <div v-if="focusIdx === index && armed && entry.risky" class="con-task__opt-confirmbar">
                      {{ entry.warnings.length > 0 ? entry.warnings[0] : entry.tradeoff }}
                      <span class="con-task__opt-confirmbar-cta">{{ $t('Press again to confirm') }}</span>
                    </div>
                  </template>
                </template>
              </ConsoleVariantChoice>
              <!-- Relevant targets the rules exclude: shown with the reason, never pressable — the same grammar, refused. -->
              <div v-if="disabledChoiceEntries.length > 0" class="con-task__disabled">
                <div class="con-task__disabled-title">{{ $t('Unavailable targets') }}</div>
                <ConsoleVariantChoice layout="list" :exclusive="false" :options="disabledChoiceOptions" :label="$t('Unavailable targets')" />
              </div>
            </template>

            <!-- ── PLAYER ─────────────────────────────────────────── -->
            <template v-else-if="activeTask.kind === 'player'">
              <!-- THE TARGETS — the variant grammar's LIST (`ConsoleVariantChoice`, TR51): a player is a row with its dot;
                   the armed target wears the ONE seal; the server's before → after rows read on the row itself. -->
              <ConsoleVariantChoice class="con-task__choices" layout="list" :exclusive="false"
                                    :options="playerOptions" :label="titleText">
                <template #body="{index}">
                  <template v-for="p in [playerEntries[index]]" :key="p.color">
                    <span v-if="p.corp !== ''" class="con-task__opt-corp">{{ $t(p.corp) }}</span>
                    <!-- «Это вы»: only when it costs you AND another target was available. -->
                    <span v-if="p.selfHarm" class="con-task__opt-selfwarn">⚠ {{ $t('This is you') }}</span>
                    <!-- Server-computed before→after rows — the ONE row renderer (`ConsoleTargetImpactRows`): the SAME
                         layout for a human row and a MarsBot track row, and for a play's table-impact block (P59). -->
                    <ConsoleTargetImpactRows v-if="p.raw.length > 0" class="con-task__opt-previews" :changes="p.raw" />
                    <GamepadGlyph v-if="focusIdx === index" :control="armed ? 'secondary' : 'confirm'" class="con-task__opt-a" />
                  </template>
                </template>
              </ConsoleVariantChoice>
              <div v-if="disabledPlayerEntries.length > 0" class="con-task__disabled">
                <div class="con-task__disabled-title">{{ $t('Unavailable targets') }}</div>
                <ConsoleVariantChoice layout="list" :exclusive="false" :options="disabledPlayerOptions" :label="$t('Unavailable targets')" />
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
              <!-- THE PALETTE (TR54, «ПАЛИТРА СТАНДАРТНОГО РЕСУРСА») — the variant grammar's palette, never six bare icons:
                   each tile the resource's own sprite, the number the server states (`SelectResourceModel.amount`) and
                   the viewer's own `current → resulting`; the cursor a cold lift, the ARMED tile the seal; the printed
                   «?» on the kicker. The input path is the host's own (the focus index, A arms, X confirms). -->
              <ConsoleVariantChoice class="con-task__palette" layout="palette" :exclusive="false"
                                    :kicker="resourcePaletteKicker" emblem="wild" data-variant-axis="row"
                                    :options="resourcePaletteOptions" :label="resourcePaletteKicker">
                <template #body="{index}">
                  <ActionEffectChip v-if="resourceReadings[index] !== undefined" :effect="resourceReadings[index]!" />
                </template>
              </ConsoleVariantChoice>
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
                  <!-- THE WHOLE REVEAL, in deck order (P88): a split reveal's COMPANIONS — the cards
                       the RULE already sent to the hand for free — stand in the same row, interleaved
                       in the order the deck turned them over (the arriving batch pairs its proxies
                       with the slots by DOM order — a CSS reorder would land the wrong face). Never
                       pickable, never focused: the cursor walks the OFFERED cards (`i`) only. -->
                  <template v-for="(entry, i) in cardEntries" :key="entry.card.name + '#' + i">
                  <div v-for="c in companionsBefore(i)" :key="'companion:' + c.name"
                       class="con-cards__slot con-cards__slot--companion"
                       :data-zoom-slot="c.name"
                       data-companion-slot>
                    <Card :card="c" :key="c.name" lightweight />
                    <!-- The verdict is MATERIAL (a kant + the tag + a word), never light — the SERVER
                         decided it (the marker's companion list); the client only prints it. -->
                    <span class="con-cards__pickband con-cards__pickband--free" data-companion-verdict>
                      <span class="con-cards__pickband-tag resource-tag" :class="'tag-' + companionCheckTag" aria-hidden="true"></span>{{ companionVerdictText }}
                    </span>
                  </div>
                  <div class="con-cards__slot"
                       :data-zoom-slot="entry.card.name"
                       :data-spread="isSpreadMode ? spreadOnCard(entry.card.name) : undefined"
                       :class="{
                         'con-cards__slot--focused': focusIdx === i && !trayPickBeat && !arrivalPending && !buyPayStage,
                         'con-cards__slot--picked': isPicked(entry.card.name) && !trayPickBeat,
                         'con-cards__slot--spread': isSpreadMode && spreadOnCard(entry.card.name) > 0,
                         'con-cards__slot--disabled': entry.disabled,
                         'con-cards__slot--refused': buyCannotAfford && !entry.disabled,
                         'con-cards__slot--dim': cardDimUnpicked && !entry.disabled && !isPicked(entry.card.name),
                         'con-cards__slot--receiving': receivingPick === entry.card.name,
                         'con-cards__slot--receded': receivingPick !== undefined && receivingPick !== entry.card.name,
                         'con-deal-hold': deal.isHeld(entry.card.name + '#' + i),
                       }"
                       :data-receive-pick="receivingPick === entry.card.name ? '1' : undefined"
                       :ref="focusIdx === i ? 'focusedCardSlot' : undefined">
                    <Card :card="landedCardOf(entry.card)" :key="entry.card.name" lightweight />
                    <!-- THE LAYOUT COUNTER (distribute mode): what the player has put on THIS card so far —
                         a pre-commit mark on the same band chassis as the selection mark. The card's own
                         stored-resource capsule stays at its live count: nothing has landed yet, and it
                         ticks only when the chips do (`landedCardOf`). -->
                    <span v-if="isSpreadMode && spreadOnCard(entry.card.name) > 0" class="con-cards__pickband con-cards__pickband--spread" aria-hidden="true" data-spread-band>
                      +{{ spreadOnCard(entry.card.name) }}<i class="con-cards__spread-icon" :class="spreadIconClassOf(entry.card.name)"></i>
                    </span>
                    <span v-else-if="isPicked(entry.card.name) && !trayPickBeat" class="con-cards__pickband" aria-hidden="true">✓ {{ $t('Card selected') }}</span>
                    <!-- P18: disabled candidates wear the state badge + the
                         concrete reason line (glance + detail). -->
                    <span v-else-if="entry.disabled" class="con-cards__pickband con-cards__pickband--disabled" aria-hidden="true">{{ $t('Unavailable') }}</span>
                    <span v-if="entry.disabled" class="con-cards__reason">{{ entry.reason !== '' ? entry.reason : $t('Unavailable right now') }}</span>
                    <!-- A paying reveal the player cannot afford (`max 0`): the card is not choosable and
                         goes to the discard — NAMED with the price that stops it (no silent loss). -->
                    <span v-if="buyCannotAfford && !entry.disabled" class="con-cards__pickband con-cards__pickband--discard" data-buy-verdict="discard">{{ $t('To the discard pile') }}</span>
                  </div>
                  </template>
                  <div v-for="c in companionsAfter" :key="'companion:' + c.name"
                       class="con-cards__slot con-cards__slot--companion"
                       :data-zoom-slot="c.name"
                       data-companion-slot>
                    <Card :card="c" :key="c.name" lightweight />
                    <!-- The verdict is MATERIAL (a kant + the tag + a word), never light — the SERVER
                         decided it (the marker's companion list); the client only prints it. -->
                    <span class="con-cards__pickband con-cards__pickband--free" data-companion-verdict>
                      <span class="con-cards__pickband-tag resource-tag" :class="'tag-' + companionCheckTag" aria-hidden="true"></span>{{ companionVerdictText }}
                    </span>
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
                <!-- PICK-THEN-PAY (PL-1411): the purchase's payment stands BESIDE the cards being bought — the shared
                     payment panel, the payment contract on the bar; B is one level back to the picks. -->
                <div v-if="buyPayStage && buyPayView !== undefined" class="con-task__buypay" data-buy-pay>
                  <ConsolePaymentPanel :view="buyPayView"
                                       mode="expanded"
                                       hint-mode="none"
                                       :focus-unit="buyPayFocusUnit"
                                       :flash-nonce="payFlashNonce" />
                </div>
                <div v-else-if="cardEntries.length > 0" class="con-cards__verdictbar"
                     :class="{'con-cards__verdictbar--held': deal.state.active || trayPickBeat || arrivalPending,
                              'con-ws-stage-status': embedded}">
                  <div v-if="focusedCardEntry !== undefined" class="con-cards__verdict-inner">
                    <!-- Only the NAME re-keys on a d-pad move (a one-shot settle,
                         no out-in gap); the button-hint chips are PERSISTENT
                         nodes patched in place — they never blink between cards
                         (the old wholesale keyed swap faded them all out/in). -->
                    <span class="con-cards__verdict-name" :key="focusedCardEntry.card.name">{{ $t(focusedCardEntry.card.name) }}</span>
                    <!-- The premium target reading of an ADD-RESOURCE pick (the
                         server's `resourceGainPrompt`): what lands on THIS card
                         (`current → resulting`) and what its VICTORY POINTS do —
                         the same authoritative numbers the composers' target
                         steps show, so a deferred arrival (an Ares adjacency
                         bonus) is never a bare face. A static VP reading stays,
                         quietly — «responds but does not move» is a reading. -->
                    <span v-for="(imp, k) in focusedTargetImpacts" :key="'ti' + k"
                          class="con-cards__verdict con-cards__verdict--impact"
                          :class="{'con-cards__verdict--impact-static': imp.static}">
                      <!-- iconClassFor resolves the icon's CSS FAMILY (a card
                           resource is `card-resource-*`, never `resource_icon--*`). -->
                      <i v-if="imp.iconClass !== ''" class="con-cards__impact-icon" :class="imp.iconClass" aria-hidden="true"></i>
                      <!-- ONE renderer for a reading with params (PL-160) — never `$t(imp.label)`. A VALUE reading
                           (PL-075 — what one unit is worth here; TR53's «also draws a card») is WORDS beside its icon:
                           it has no «before → after», and a bare «[M€] →» stood on the 4K colony stand. -->
                      <span v-if="imp.iconClass === '' || imp.value === true" class="con-cards__impact-label">{{ impactText(imp) }}</span>
                      <span v-if="imp.from !== undefined && imp.to !== undefined" class="con-cards__impact-nums">{{ imp.from }}<span aria-hidden="true"> → </span>{{ imp.to }}</span>
                      <span v-else-if="imp.amount !== undefined && imp.value !== true" class="con-cards__impact-nums">{{ imp.amount > 0 ? '+' : '' }}{{ imp.amount }}</span>
                    </span>
                    <span v-if="focusedCardEntry.disabled" class="con-cards__verdict con-cards__verdict--blocked">
                      <span aria-hidden="true">✕</span>
                      <span>{{ focusedCardEntry.reason !== '' ? focusedCardEntry.reason : $t('Unavailable right now') }}</span>
                    </span>
                    <!-- EMBEDDED (inside a workspace): this line is STATUS, not a
                         second command bar — the bottom bar is the one source of
                         gamepad verbs, and repeating A/X/RT here made two footers
                         compete. What earns its place beside the card is what the
                         bar cannot say: the card's own economics. -->
                    <!-- THE LAYOUT (distribute mode), embedded or not: the status line answers what is
                         left to place — the honest reason the commit is withheld (invariant 5) — and the
                         whole layout's VP shift; the focused card's own `current → resulting` and its VP
                         for THIS amount stand to the left as the impact rows above. -->
                    <template v-else-if="isSpreadMode">
                      <span v-if="spreadBlockedText !== ''" class="con-cards__verdict con-cards__verdict--blocked" data-spread-blocked>
                        <span aria-hidden="true">⚠</span><span>{{ spreadBlockedText }}</span>
                      </span>
                      <span v-else class="con-cards__verdict con-cards__verdict--ok" data-spread-ready>
                        <span>{{ $t('All placed') }}</span>
                      </span>
                      <span v-if="spreadVpShift !== 0" class="con-cards__verdict con-cards__verdict--impact" data-spread-vp :data-spread-vp-shift="spreadVpShift">
                        <span class="con-cards__impact-label">{{ $t('VP total') }}</span>
                        <span class="con-cards__impact-nums">{{ spreadVpShift > 0 ? '+' : '' }}{{ spreadVpShift }}</span>
                      </span>
                    </template>
                    <template v-else-if="embedded">
                      <!-- The aggregate SHORTFALL outranks the economics: it is
                           the one thing that stops the decision, and now that
                           the header is a single row this line is where the
                           embedded stage states things. -->
                      <span v-if="buyCannotAfford" class="con-cards__verdict con-cards__verdict--blocked" data-buy-verdict-reason>
                        <span aria-hidden="true">✕</span><span>{{ $t('To the discard pile') }} · {{ buyCannotAffordText }}</span>
                      </span>
                      <span v-else-if="isBuyMode && picks.length > 0 && !cardBuyAffordable"
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
              <!-- The budget meter and the honest «why not yet» live in the CONSEQUENCE FOOTER under the body (the
                   family's one place for what the confirm does): the SINGLE-STEP gain drops the meter there («0 / 1»
                   over a radio restates the title's own count — the Venus-bonus rule); the production loss keeps
                   it always — there the meter IS the readout of the server's cost. -->
              <div v-for="(lane, i) in lanes" :key="lane.key"
                   class="con-task__lane"
                   :class="{
                     'con-task__lane--focused': focusIdx === i,
                     'con-task__lane--active': laneValue(lane.key) > 0,
                     'con-task__lane--gain': activeTask.mode === 'resources',
                     'con-task__lane--loss': activeTask.mode === 'production',
                   }">
                <span class="con-task__lane-id" :class="{'con-task__lane-id--prod': activeTask.mode === 'production'}">
                  <i class="con-task__opt-icon" :class="lane.iconClass" aria-hidden="true"></i>
                </span>
                <span class="con-task__lane-name">{{ $t(lane.label) }}</span>

                <!-- The production LOSS reads like the dedicated loss surface's rows: the income as it stands →
                     what it becomes, and the chosen −N in the loss ink (one language for one loss, wherever it
                     arrives — standalone or as a wizard step of a choice). -->
                <template v-if="activeTask.mode === 'production'">
                  <span class="con-task__lane-stock">
                    <span class="con-task__lane-cur" :class="{'con-task__lane-cur--faded': laneValue(lane.key) > 0}">{{ signedProduction(lane.max) }}</span>
                    <template v-if="laneValue(lane.key) > 0">
                      <span class="con-task__lane-arrow" aria-hidden="true">→</span>
                      <span class="con-task__lane-next">{{ signedProduction(lane.max - laneValue(lane.key)) }}</span>
                    </template>
                  </span>
                  <span class="con-task__lane-delta" :class="{'con-task__lane-delta--empty': laneValue(lane.key) === 0}">
                    <template v-if="laneValue(lane.key) > 0">−{{ laneValue(lane.key) }}</template>
                  </span>
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

        <!-- THE CONSEQUENCE FOOTER — a DISTRIBUTION's answer is a sum of lanes, so what the confirm does is stated
             once, at the plate's foot, in the decision's tone («ВЫ ПОЛУЧИТЕ» / «ВЫ ПОТЕРЯЕТЕ» + the budget). A choice
             between OPTIONS states each option's consequence on the option itself and has no footer. -->
        <ConsolePromptOutcome v-if="!embedded && activeTask.kind === 'distribute'" class="con-task__outcome"
                              :tone="tone" :items="distOutcomeItems" :meter="distOutcomeMeter" :pending="distPendingText" />

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

<script setup lang="ts">
/*
 * --table-beat: the TABLE owns the screen (draft pick landing / the
 *       research rise) — the modal chrome dissolves so the drafted tray and
 *       the flying cards are seen; releasing it IS the frame materialization
 *       around the fresh content (consoleDraftTray.ts owns the flag).
 *       data-motion-*: rides the shared `.con-shade` dim + the surface-motion
 *       director (no own backdrop; the shade's --veil mirrors the table beat).
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {ExposedOf} from '@/client/components/exposedOf';
import {RootElHolder} from '@/client/components/rootEl';
import {choiceSeriesOf} from '@/client/console/promptSeries';
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
import {cursorEnsureVisible, scrollContainerOf} from '@/client/console/cursorScroll';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {probeTick} from '@/client/console/probeTick';
import {useEventListener, useResizeObserver} from '@vueuse/core';
import Card from '@/client/components/card/CardFace.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import ConsoleVariantChoice from '@/client/components/console/foundation/ConsoleVariantChoice.vue';
import ConsolePreludeVariantStep from '@/client/components/console/foundation/ConsolePreludeVariantStep.vue';
import {preludePreStepStage} from '@/client/console/preludeVariant/preludeVariantModel';
// The keyed panel's prompt → prompt swap: the PROMPT HANDOFF phrase (release → arrive → compose, PL-384) on a
// family plate; an embedded stage keeps its quiet swap.
import {
  promptSwapEnterCancelledHook, promptSwapEnterHook, promptSwapLeaveCancelledHook, promptSwapLeaveHook,
} from '@/client/console/surfaceMotion/promptHandoffMotion';
import {VariantChoiceOption} from '@/client/console/variantChoiceModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {GrantSeries, PlayerInputModel, OrOptionsModel, AndOptionsModel, CardResourceDistributionMeta, SelectAmountModel, SelectOptionModel, OptionMetadata, SelectCardModel, SelectPaymentModel, SelectProjectCardToPlayModel} from '@/common/models/PlayerInputModel';
import {
  pourRemaining, spreadBlocked, spreadCardReading, spreadComplete, spreadFromPicks, spreadOn, spreadRemaining, SpreadState, spreadToPicks,
  spreadTotal, spreadVictoryPointsShift, stepSpread,
} from '@/client/console/cardResourceDistribution';
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
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {readingText, readingLineText} from '@/client/console/readingText';
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
import {playedTargetPreviewFor} from '@/client/console/played/consolePlayedTargetPreview';
import type {PlayedTargetImpact} from '@/client/console/played/consolePlayedTargetModel';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {TargetImpact, TargetImpactChange} from '@/common/models/TargetImpactModel';
import ConsoleTargetImpactRows from '@/client/components/console/foundation/ConsoleTargetImpactRows.vue';
import {displayNameForColor, participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';

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
  amountResponse, cardResourceDistributionResponse, cardsResponse, deltaProjectResponse, optionConfirmResponse, orOptionResponse,
  orWrappedResponse, paymentResponse, playerResponse, productionToLoseResponse, projectCardResponse,
  resourceResponse, resourcesResponse,
} from '@/client/console/taskResponses';
import {CardModel} from '@/common/models/CardModel';
import {SpendableResource} from '@/common/inputs/Spendable';
import {
  buildPaymentView, editableRows, initialCounts, dialLaneCount, paymentCovers,
  paymentFromCounts, PaymentLane, paymentLanes, PaymentView,
  projectCardPaymentPrompt,
} from '@/client/console/paymentPlan';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {resolutionZoomEntry} from '@/client/components/card/cardZoomTypes';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {resolvingYieldOf, scaledEffectForCardResource} from '@/client/console/parliament/influenceYieldModel';
import {payoutPickLandsInPlace, pickPayoutLandedOn} from '@/client/console/parliament/consoleResolutionPayout';
import {armPromptReceive, promptReceiveLandedOn, promptReceiveState} from '@/client/console/cardReceive/promptReceive';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {InfluenceYield} from '@/common/parliament/influenceScaling';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import {availabilityContextFor} from '@/client/console/cardAvailability';
import {applyDiscardExit, ExitSource, runHeroPick} from '@/client/console/cardDeal/cardExitDirector';
import {discardOpenCards} from '@/client/console/cardDiscard/discardOpenCard';
import {runHandIntake} from '@/client/console/handDock/handDeliveryDirector';
import {createCardDealSequence, RiseLaunchExtras} from '@/client/console/cardDeal/cardDealSequence';
import {shouldRunDealOnce} from '@/client/console/cardDeal/cardDealMemory';
import {DealTargetRect} from '@/client/console/cardDeal/cardDealDirector';
// `draftTrayState` — the draft-tray brain (pick beats / research rise), module state.
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
import ConsoleDeclinePlate from '@/client/components/console/foundation/ConsoleDeclinePlate.vue';
import ConsolePromptHead from '@/client/components/console/foundation/ConsolePromptHead.vue';
import ConsolePromptOutcome, {PromptOutcomeItem} from '@/client/components/console/foundation/ConsolePromptOutcome.vue';
import {PromptTone, promptCommitLabelKey, promptToneWithin} from '@/client/console/promptTone';
import {promptSequenceKey} from '@/client/console/promptSequence';
import {noteInputAbsorbed, registerInputAbsorber} from '@/client/console/inputAbsorb';
import {purchasePriceHint, purchasePriceSource} from '@/client/console/purchasePriceSource';
import {ConsoleSourceDock} from '@/client/components/asyncComponents';
// What this host DECIDES lives in the sibling module (its unit specs run those bodies against a stub): each member
// below named like one of these is its one-line delegate over `port`. The helpers the bodies share with this script
// (`textOf`, `directNestedOf`, `handNamesOf`) and the `ChoiceEntry` row come from there too.
import {
  activeTask as activeTaskOf, adjust as adjustOf, amountMax as amountMaxOf, amountMin as amountMinOf, amountValidValues as amountValidValuesOf,
  baseKey as baseKeyOf, buyCostPerCard as buyCostPerCardOf, buyPayStage as buyPayStageOf, buyPaymentPrompt as buyPaymentPromptOf,
  buyPaysByPrompt as buyPaysByPromptOf, buyTotal as buyTotalOf, cardBuyAffordable as cardBuyAffordableOf, choiceEntries as choiceEntriesOf,
  choiceOnePress as choiceOnePressOf, declineOnRt as declineOnRtOf, directNested as directNestedFn, footCommands as footCommandsOf,
  handNames as handNamesFn, megacreditsAfterPurchase as megacreditsAfterPurchaseOf, megacreditsOnHand as megacreditsOnHandOf,
  nestedIsDirect as nestedIsDirectOf, parentWf as parentWfOf, placementOrderFocusRow as placementOrderFocusRowOf,
  placementOrderVariant as placementOrderVariantOf, resourceGainAmount as resourceGainAmountOf, resourcePaletteOptions as resourcePaletteOptionsOf,
  resourceReadings as resourceReadingsOf, resourceUnits as resourceUnitsOf, submitBuyBatch as submitBuyBatchOf, taskDecline as taskDeclineOf,
  taskKey as taskKeyOf, wf as wfOf,
  ChoiceEntry, directNestedOf, handNamesOf, TaskHostPort, textOf,
} from '@/client/components/console/consoleTaskHostLogic';

/** The prompt-modal family's SIZE tiers (`console_prompt.less` § SIZE RULES). */
type PromptSize = 's' | 'm' | 'l' | 'xl';

const RESOURCE_FIELD: Record<string, {stock: string, production: string}> = {
  megacredits: {stock: 'megacredits', production: 'megacreditProduction'},
  steel: {stock: 'steel', production: 'steelProduction'},
  titanium: {stock: 'titanium', production: 'titaniumProduction'},
  plants: {stock: 'plants', production: 'plantProduction'},
  energy: {stock: 'energy', production: 'energyProduction'},
  heat: {stock: 'heat', production: 'heatProduction'},
};

/** The stage's batch arrival — every verb absorbed until the cards have landed (the input-absorb ledger). */
const TASK_HOST_ARRIVAL_ABSORBER = 'task-host-arrival';

defineOptions({name: 'ConsoleTaskHost'});
const props = defineProps({
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  task: {type: Object as PropType<ConsoleTask>, required: true},
  /**
   * CLIENT-SIDE prompt override (T3): hosts a client-built input (the
   * standard-project alt-resource payment) instead of `waitingFor` —
   * nothing is committed server-side, so B = CANCEL (`deferLabel`).
   */
  promptOverride: {type: Object as PropType<PlayerInputModel | undefined>, default: undefined},
  /**
   * THE SERVER'S QUESTION THIS HOST STANDS ON when it is no longer the live one (PC04 · GS — the shell holds the
   * answered member of a series while the next is not admitted). Unlike `promptOverride` (a client-built prompt) it
   * keeps the question's own identity — the same frame key, so the plate does not re-mount on the hold.
   */
  heldPrompt: {type: Object as PropType<PlayerInputModel | undefined>, default: undefined},
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
});
const emit = defineEmits(['submit', 'submit-batch', 'defer', 'space-pick', 'hand-pick', 'result-detached']);

/**
 * THE PORT of `consoleTaskHostLogic.ts` — what its bodies read, write and call of this host. Accessors and arrows,
 * never values: it is read lazily (inside a computed, a function), so it stands above the declarations it names.
 */
const port: TaskHostPort = {
  // ── props
  get playerView() {
    return props.playerView;
  },
  get task() {
    return props.task;
  },
  get promptOverride() {
    return props.promptOverride;
  },
  get heldPrompt() {
    return props.heldPrompt;
  },
  get embedded() {
    return props.embedded;
  },
  // ── state the bodies read
  get nested() {
    return nested.value;
  },
  get focusIdx() {
    return focusIdx.value;
  },
  get armed() {
    return armed.value;
  },
  get picks() {
    return picks.value;
  },
  get buyStage() {
    return buyStage.value;
  },
  get pcStage() {
    return pcStage.value;
  },
  // ── state the bodies WRITE
  get value() {
    return value.value;
  },
  set value(now) {
    value.value = now;
  },
  get units() {
    return units.value;
  },
  set units(now) {
    units.value = now;
  },
  get payCounts() {
    return payCounts.value;
  },
  set payCounts(now) {
    payCounts.value = now;
  },
  get payFlashNonce() {
    return payFlashNonce.value;
  },
  set payFlashNonce(now) {
    payFlashNonce.value = now;
  },
  get submitting() {
    return submitting.value;
  },
  set submitting(now) {
    submitting.value = now;
  },
  // ── the delegated members, read through the port
  get parentWf() {
    return parentWf.value;
  },
  get wf() {
    return wf.value;
  },
  get activeTask() {
    return activeTask.value;
  },
  get baseKey() {
    return baseKey.value;
  },
  get placementOrderVariant() {
    return placementOrderVariant.value;
  },
  get choiceEntries() {
    return choiceEntries.value;
  },
  get resourceUnits() {
    return resourceUnits.value;
  },
  get resourceGainAmount() {
    return resourceGainAmount.value;
  },
  get amountValidValues() {
    return amountValidValues.value;
  },
  get amountMin() {
    return amountMin.value;
  },
  get amountMax() {
    return amountMax.value;
  },
  get handNames() {
    return handNames.value;
  },
  get taskDecline() {
    return taskDecline.value;
  },
  get directNested() {
    return directNested.value;
  },
  get declineOnRt() {
    return declineOnRt.value;
  },
  get buyPaysByPrompt() {
    return buyPaysByPrompt.value;
  },
  get buyPaymentPrompt() {
    return buyPaymentPrompt.value;
  },
  get buyPayStage() {
    return buyPayStage.value;
  },
  get buyCostPerCard() {
    return buyCostPerCard.value;
  },
  get buyTotal() {
    return buyTotal.value;
  },
  get megacreditsOnHand() {
    return megacreditsOnHand.value;
  },
  // ── the host's other members
  get allChoiceEntries() {
    return allChoiceEntries.value;
  },
  get baseFootCommands() {
    return baseFootCommands.value;
  },
  get lanes() {
    return lanes.value;
  },
  get distRule() {
    return distRule.value;
  },
  get distSingleStep() {
    return distSingleStep.value;
  },
  get distFocusedPicked() {
    return distFocusedPicked.value;
  },
  get cardModel() {
    return cardModel.value;
  },
  get isSpreadMode() {
    return isSpreadMode.value;
  },
  get isBuyMode() {
    return isBuyMode.value;
  },
  get singlePick() {
    return singlePick.value;
  },
  get canInspectDrafted() {
    return canInspectDrafted.value;
  },
  get buyPayLanes() {
    return buyPayLanes.value;
  },
  get paymentCost() {
    return paymentCost.value;
  },
  get payLanes() {
    return payLanes.value;
  },
  get pcCost() {
    return pcCost.value;
  },
  get pcLanes() {
    return pcLanes.value;
  },
  spreadStepFocused: (step) => spreadStepFocused(step),
  $emit: (event, ...args) => emit(event, ...args),
};

const flow = useFlowScope('console-task-host');
const cardStrip = useTemplateRef<HTMLElement>('cardStrip');
const dealLayer = useTemplateRef<ExposedOf<typeof ConsoleCardDealLayer>>('dealLayer');
const sourceCard = useTemplateRef<RootElHolder>('sourceCard');
const body = useTemplateRef<HTMLElement>('body');
const focusedCardSlot = useTemplateRef<HTMLElement | Array<HTMLElement>>('focusedCardSlot');
const root = useTemplateRef<HTMLElement>('root');
const focusIdx = ref(0);
const armed = ref(false);
const value = ref(0);
const units = ref<Partial<Record<keyof Units, number>>>({});
/** T2 card browser: picked card names, in pick order. */
const picks = ref<Array<CardName>>([]);
/**
 * The card browser's LAYOUT MODE (`cardSelect` / `distribute`): units placed
 * per card — the shared distribution step's answer in the making. Opens
 * EMPTY (no default recipient: an auto-select and a loaded reflex submit
 * at once); LB / RB / RT move it; only a COMPLETE layout can be sent.
 */
const spread = ref<SpreadState>({});
/** projectCard (generic, wave 2): pick → pay two-stage state. */
const pcStage = ref('pick' as 'pick' | 'pay');
/** PICK-THEN-PAY (PL-1411): a purchase whose price the server WILL ask stands its payment as its own second stage. */
const buyStage = ref('pick' as 'pick' | 'pay');
const pcPick = ref<CardName | undefined>(undefined);
/** T3 payment: the dialed-in non-M€ lane counts (M€ auto-derives). */
const payCounts = ref<Partial<Record<SpendableResource, number>>>({});
/** Re-keyed on each adjust so the dialed row's one-shot pulse replays. */
const payFlashNonce = ref(0);
/** T9: the OPEN nested option (one-level wizard) — B returns to the list. An optional choice whose one answer is
 *  that step OPENS on it (`directNestedOf`) — B there is the decision's own (minimize). */
const nested = ref(directNestedOf(props.task, props.promptOverride ?? props.heldPrompt ?? props.playerView.waitingFor, handNamesOf(props.playerView)));
/** Blocks a duplicate submit between the emit and the next server response
 *  (e.g. rapid A presses in the pick phase) — cleared on every response. */
const submitting = ref(false);
/** The deal cinematic lifecycle (holds slots, flies proxies, skips). */
const deal = ref(createCardDealSequence());
let cancelDealLaunch = (() => {}) as () => void;
let cancelSettleFit = (() => {}) as () => void;
/** A live pick's answer playing as a scene (TR53 iteration) — module state: the seal, the board hand-off, the home. */
const receive = promptReceiveState;
/** Single-row card fit (sets --con-cards-zoom so the row always fits →
 *  never scrolls on focus). Observers run it on resize; NEVER per focus.
 *  VueUse stop-handles (auto-managed; no raw addEventListener). */
let stopStripObs: (() => void) | undefined;
/** The input-absorb ledger's registration of this stage's batch-arrival gate (`inputAbsorb.ts`). */
let absorbOff: (() => void) | undefined;
let stopResize: (() => void) | undefined;
const fitScheduled = ref(false);
const fitRetries = ref(0);

const parentWf = computed(() => parentWfOf(port));
const wf = computed(() => wfOf(port));
const activeTask = computed(() => activeTaskOf(port));
const baseKey = computed(() => baseKeyOf(port));
const taskKey = computed(() => taskKeyOf(port));
/** The keyed FRAME's identity: the prompt PLUS the native projectCard
 *  stage — pick → pay is a stage swap of the same prompt, and unkeyed it
 *  re-dressed the standing plate in one frame (a card grid snapping into
 *  the pay panel). Keying it rides the same prompt handoff every
 *  prompt→prompt switch plays. `taskKey` itself stays prompt-only:
 *  the reset epoch and the nested-step machinery must not see a stage
 *  flip as a new ask. */
const panelKey = computed((): string => {
  const stage = activeTask.value.kind === 'projectCard' ? `|${pcStage.value}` : '';
  return `${taskKey.value}${stage}`;
});
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
const resetKey = computed((): string => {
  if (activeTask.value.kind !== 'cardSelect') {
    return taskKey.value;
  }
  return `${taskKey.value}|c${cardEntries.value.map((e) => e.card.name).join(',')}`;
});
const titleText = computed((): string => {
  // A recognised CONVERSION leads with its compact headline
  // («Преобразование энергии») — the server ask moves to the subtext.
  // Structural (the conversion hint), never a title match.
  if (conversionAskDemoted.value) {
    return translateText(conversionVm.value?.headlineKey ?? '');
  }
  // Phase-aware card-browser titles — the server title there is generic
  // ("Select up to N cards to buy" / "Select a card to keep and pass…").
  // Other kinds AND every nested step keep the descriptive server title.
  if (nested.value === undefined && activeTask.value.kind === 'cardSelect') {
    if (isBuyMode.value) {
      // EMBEDDED single card: the mass-selector title misnames the moment.
      // ONE card was just revealed by the player's own action, and the
      // decision is buy-or-decline — not «select cards» out of a set.
      if (buyCannotAfford.value) {
        return textOf(wf.value?.title);
      }
      if (buyPayStage.value) {
        return translateTextWithParams('Select how to spend ${0} M€ for ${1} cards', [String(buyTotal.value), String(picks.value.length)]);
      }
      if (embeddedSingleBuy.value) {
        return translateText('Buy the revealed card?');
      }
      return translateText('Select cards to purchase');
    }
    // Only the single-keep draft gets the "1 card" title; a multi-keep
    // draft keeps the (translated) server title ("Select two cards to keep…").
    if (isDraftPick.value && singlePick.value) {
      return translateText('Choose 1 card to draft');
    }
  }
  return textOf(wf.value?.title);
});
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
const kickerText = computed((): string => {
  return translateText(kickerKey.value);
});
/** The raw i18n key — the embedded host hands THIS to the workspace's
 *  breadcrumb rather than drawing a second kicker of its own. */
const kickerKey = computed((): string => {
  return consoleTaskSummary(activeTask.value, props.playerView, {prompt: wf.value}).kickerKey;
});
/** What to publish upward: the stage name while embedded, '' otherwise. */
const embeddedPhase = computed((): string => {
  // PICK-THEN-PAY: the crumb's tail moves forward to the purchase's payment («› ОПЛАТА»).
  if (props.embedded && buyPayStage.value) {
    return 'Payment';
  }
  // P58 · FS — «… › ОЧЕРЁДНОСТЬ»: the order of a card's placements.
  if (props.embedded && placementOrderVariant.value !== undefined) {
    return preludePreStepStage(placementOrderVariant.value);
  }
  return props.embedded ? kickerKey.value : '';
});
/**
 * The decision's CHARACTER (`promptTone.ts` — structural markers only): a
 * reward, a loss, or a free choice. An open wizard step keeps its own
 * character when it has one (a production loss behind an `or` is a loss).
 */
const tone = computed((): PromptTone => {
  return promptToneWithin(parentWf.value, nested.value?.input);
});
/** The question's place in a series (PC04 — `choiceContext.series`), counted by the head. */
const promptSeries = computed((): GrantSeries | undefined => {
  // The PARENT question's (a nested pick inside it is the same decision, not a second one of the series).
  return choiceSeriesOf(parentWf.value);
});
/** The decision's identity in the press's sequence (`promptSequence.ts`); '' while embedded (a stage, not a modal). */
const sequenceKey = computed((): string => {
  return props.embedded ? '' : promptSequenceKey(parentWf.value, baseKey.value, nested.value?.index);
});
/**
 * The plate's SIZE tier, read off the content (never a per-prompt number):
 * a card browser is `xl`; a choice beside its FULL source card is `l` (the
 * card is the subject and needs its column); a dial, a resource pick or a
 * short choice with no source at all is `s`; everything else — rows,
 * lanes, lists beside a compact source — is `m`.
 */
const promptSize = computed((): PromptSize => {
  switch (activeTask.value.kind) {
  case 'cardSelect':
    return 'xl';
  case 'choice':
    if (dockedSource.value !== undefined && !sourceCompact.value) {
      return 'l';
    }
    return dockedSource.value === undefined && choiceEntries.value.length <= 3 ? 's' : 'm';
  case 'amount':
  case 'resource':
    return dockedSource.value === undefined ? 's' : 'm';
  default:
    return 'm';
  }
});
/** The consequence footer of a DISTRIBUTION: every lane holding part of the answer, `current → resulting`. */
const distOutcomeItems = computed((): Array<PromptOutcomeItem> => {
  if (activeTask.value.kind !== 'distribute') {
    return [];
  }
  const production = activeTask.value.mode === 'production';
  return lanes.value
    .filter((lane) => laneValue(lane.key) > 0)
    .map((lane): PromptOutcomeItem => {
      const placed = laneValue(lane.key);
      if (production) {
        return {
          key: lane.key, iconClass: lane.iconClass, prod: true, delta: -placed,
          from: signedProduction(lane.max), to: signedProduction(lane.max - placed),
        };
      }
      const have = lane.available;
      return {
        key: lane.key, iconClass: lane.iconClass, delta: placed,
        from: have !== undefined ? String(have) : undefined, to: have !== undefined ? String(have + placed) : undefined,
      };
    });
});
/** The budget readout — the SINGLE-STEP gain has none (a radio restating the title's count is noise). */
const distOutcomeMeter = computed((): {done: number, of: number} | undefined => {
  if (activeTask.value.kind !== 'distribute' || (activeTask.value.mode === 'resources' && distSingleStep.value)) {
    return undefined;
  }
  return {done: distributedSum.value, of: distributeTarget.value};
});
/** Nothing placed yet: what is still owed, in words (the honest «why not yet» — invariant 5). */
const distPendingText = computed((): string => {
  if (activeTask.value.kind === 'distribute' && activeTask.value.mode === 'production') {
    return translateText('Choose the production to lose');
  }
  return distBlockedText.value !== '' ? distBlockedText.value : translateText('Distribute resources');
});
/** choiceContext trigger sentence (parity with ContextualChoiceContent);
 *  inside a nested step — the PARENT ask as a breadcrumb. */
const triggerText = computed((): string => {
  if (nested.value !== undefined) {
    return `← ${textOf(parentWf.value?.title)}`;
  }
  const trigger = wf.value?.choiceContext?.trigger;
  return textOf(trigger as string | Message | undefined);
});
/** WHO asked — normalized by the shared model, so every marker the server
 *  might have used lands in ONE dock. The context lives on the PARENT
 *  prompt, so it stays visible through a nested wizard step. */
const sourceView = computed((): PromptSourceView | undefined => {
  return promptSourceView(parentWf.value);
});
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
const dockedSource = computed((): PromptSourceView | undefined => {
  return props.embedded ? undefined : sourceView.value;
});
/** The docked source CARD, when the source is one — what X / L3 opens. */
const sourceCardName = computed((): CardName | undefined => {
  return sourceView.value?.inspectable === true ? sourceView.value.card : undefined;
});
/** The docked source RESOLUTION (Turmoil Redux), when the source is one — X / L3 open its own inspector. */
const sourceResolutionId = computed((): string | undefined => {
  return sourceView.value?.inspectable === true ? sourceView.value.resolution : undefined;
});
/** SOMETHING to open fullscreen stands in the dock — a card or a resolution (never a bare rule plate). */
const sourceInspectable = computed((): boolean => {
  return sourceCardName.value !== undefined || sourceResolutionId.value !== undefined;
});
/** The LAW behind a replaced unit's pick (RX35, `resourceGainPrompt.diverted`) — shown as a seal where the plate has no dock. */
const divertedLawSeal = computed((): {emblem: string, accent: string, name: string} | undefined => {
  const id = cardModel.value?.resourceGainPrompt?.diverted?.resolution;
  if (id === undefined || dockedSource.value !== undefined) {
    return undefined;
  }
  const resolution = getResolution(id);
  if (resolution === undefined) {
    return undefined;
  }
  return {emblem: partyEmblemUrl(resolution.party), accent: partyAccent(resolution.party), name: resolution.text.name};
});
/**
 * WHAT A RESOLUTION-SOURCED PICK PAYS — the influence → result reading
 * under the source face (Turmoil Redux, an enacted resolution's payout):
 * the SERVER's amount (the prompt's own `resourceGainPrompt`), the rule
 * it came from (the manifest's scaled declaration) and the viewer's
 * influence it was computed at. Only for a pick whose source is a
 * resolution with a matching scaled part; every other pick keeps its
 * dock untouched.
 */
const sourceYield = computed((): InfluenceYield | undefined => {
  const id = sourceView.value?.resolution;
  const meta = cardModel.value?.resourceGainPrompt;
  // A pick made BEFORE its amount exists (`amountBasis`, no `amount`) has no yield to read yet. A law's
  // REPLACEMENT of the seat's own terraforming (RX35, `diverted`) is no enactment payout: no influence reading.
  if (id === undefined || meta?.amount === undefined || meta.diverted !== undefined || activeTask.value.kind !== 'cardSelect') {
    return undefined;
  }
  // The pick names its ONE kind, or the kinds it spans — either finds the effect whose unit lists any of them.
  const effect = scaledEffectForCardResource(getResolution(id), meta.cardResources ?? meta.cardResource);
  return effect === undefined ? undefined : resolvingYieldOf(effect, meta.amount, props.playerView.game.parliament, props.playerView.thisPlayer.color);
});
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
const standaloneSourceCard = computed((): CardName | undefined => {
  if (props.embedded || activeTask.value.kind === 'choice') {
    return undefined;
  }
  return sourceCardName.value;
});
/** The dock presents COMPACT exactly when the card is a source rather than
 *  the subject — the same condition that puts it on L3. */
const sourceCompact = computed((): boolean => {
  return standaloneSourceCard.value !== undefined;
});
/** The L3 «Источник» hint, appended before the B verb by every kind that
 *  has a source to inspect. Discoverable nowhere else → outlives the
 *  self-evident stick/dpad hints when the bar drops for fit. */
const sourceHint = computed((): Array<ConsoleCommand> => {
  return standaloneSourceCard.value === undefined && stageSourceResolution.value === undefined ?
    [] :
    [{control: 'stickL' as GlyphControl, label: 'Source', priority: 1}];
});
/**
 * An EMBEDDED prompt whose source is a RESOLUTION (Turmoil Redux — the
 * Parliament's enactment stage): the host that teleported this pick
 * carries that very face on its stage, so L3 lifts it (the one resolver,
 * `workspaceSourceZoomOrigin`) instead of a docked copy. A workspace
 * claim's source card, when there is one, keeps L3.
 */
const stageSourceResolution = computed((): string | undefined => {
  return props.embedded && workspaceSourceCard.value === undefined ? sourceResolutionId.value : undefined;
});
/**
 * The workspace claim's SOURCE card — the action whose activation produced
 * this pick. Present only while EMBEDDED (the claim is exactly what
 * re-homed this host into the workspace), and it is what L3 inspects —
 * the console-wide «X = the current object, L3 = its source» grammar.
 * A prompt carries no source attribution of its own (see
 * workspaceClaimsPick), so the claim is the one honest place to read it.
 */
const workspaceSourceCard = computed((): CardName | undefined => {
  if (!props.embedded) {
    return undefined;
  }
  const name = workspaceOutcomeState.sourceCard;
  return name !== '' ? (name as CardName) : undefined;
});
/**
 * ONE revealed card offered for purchase inside the workspace — the
 * presentation adapts: the title asks the actual question, the top
 * pickline folds away, and the card's own status line carries the
 * economics (price / balance after). The multi-card composition is the
 * same component with the counters back on.
 */
const embeddedSingleBuy = computed((): boolean => {
  return props.embedded && activeTask.value.kind === 'cardSelect' &&
    isBuyMode.value && cardEntries.value.length === 1;
});
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
const embeddedBadges = computed((): Array<{key: string, label: string, value: string, warn: boolean, coin: boolean}> => {
  if (!props.embedded || activeTask.value.kind !== 'cardSelect' ||
      embeddedSingleBuy.value || (singlePick.value && !isBuyMode.value)) {
    return [];
  }
  // THE LAYOUT's two live numbers — placed of N, and what is left — always
  // TWO badges (a constant count per mode, so a press never reshapes the head).
  if (isSpreadMode.value) {
    return [
      {key: 'placed', label: translateText('Laid out'), value: `${spreadPlaced.value}/${spreadAmount.value}`, warn: false, coin: false},
      {key: 'left', label: translateText('Left'), value: `${spreadLeft.value}`, warn: spreadLeft.value > 0, coin: false},
    ];
  }
  const out: Array<{key: string, label: string, value: string, warn: boolean, coin: boolean}> = [];
  if (!singlePick.value) {
    out.push({
      key: 'selected',
      label: translateText('Selected'),
      value: cardMax.value > 0 ? `${picks.value.length}/${cardMax.value}` : `${picks.value.length}`,
      warn: false,
      coin: false,
    });
  }
  if (isBuyMode.value) {
    out.push({
      key: 'purchase',
      label: translateText('Purchase'),
      value: `−${buyTotal.value}`,
      warn: !cardBuyAffordable.value,
      coin: true,
    });
    const spent = picks.value.length > 0 && cardBuyAffordable.value;
    out.push({
      key: 'wallet',
      label: translateText(spent ? 'After purchase' : 'You have'),
      value: `${spent ? megacreditsAfterPurchase.value : megacreditsOnHand.value}`,
      warn: false,
      coin: true,
    });
  }
  return out;
});
/**
 * A `Warning` is a KEY, not a sentence.
 *
 * Translating the key itself printed `removeOwnPlants` on screen — the raw
 * identifier, in a slot meant to explain a risk. `warningText` is the one
 * place that maps a key to its English i18n sentence (shared with the
 * desktop card warnings), so both surfaces can never word the same warning
 * differently.
 */
const warningTexts = computed((): Array<string> => {
  const warnings = (wf.value as {warnings?: ReadonlyArray<Warning>} | undefined)?.warnings ?? [];
  return warnings.map((w) => translateText(warningText(w)));
});
const confirmLabel = computed((): string => {
  const label = wf.value?.buttonLabel;
  return label !== undefined && label !== '' ? label : 'Confirm';
});
const choiceOnePress = computed(() => choiceOnePressOf(port));
const placementOrderVariant = computed(() => placementOrderVariantOf(port));
const placementOrderFocusRow = computed(() => placementOrderFocusRowOf(port));
/**
 * The A verb of a one-press CHOICE. A LEAF option is decided on the spot, so
 * A reads «Подтвердить»; an option that OPENS something (a nested wizard
 * step, a board pick) honestly reads «Выбрать» — it selects the branch and
 * the decision lands one screen later.
 */
const choiceCommandLabel = computed((): string => {
  const entry = choiceEntries.value[focusIdx.value];
  return entry !== undefined && (entry.isNested || entry.isSpace) ? 'Select' : 'Confirm';
});
// ── choice ───────────────────────────────────────────────────────
const orOptions = computed((): ReadonlyArray<PlayerInputModel> => {
  if (wf.value?.type === 'or') {
    return (wf.value as OrOptionsModel).options;
  }
  return [];
});
const allChoiceEntries = computed((): Array<ChoiceEntry> => {
  const source = wf.value?.type === 'option' ? [wf.value] : orOptions.value;
  return source.map((option, index) => {
    const meta: OptionMetadata | undefined = (option as SelectOptionModel).metadata;
    const player = meta?.player;
    const playerModel = player !== undefined ? props.playerView.players.find((p) => p.color === player.color) : undefined;
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
});
/** Primary rows first, skip options last (desktop parity). */
/** The choice in the variant grammar — the cursor, the ARMED answer (the seal), the words, the owner dot, the door. */
const choiceOptions = computed((): ReadonlyArray<VariantChoiceOption> => {
  return choiceEntries.value.map((entry, i): VariantChoiceOption => ({
    key: 'o' + entry.index,
    state: {focused: focusIdx.value === i, selected: focusIdx.value === i && armed.value, off: false},
    title: entry.playerColor !== undefined && entry.playerName !== '' ? `${entry.playerName} · ${entry.title}` : entry.title,
    door: entry.isNested,
    color: entry.playerColor,
    attrs: {'data-choice-skip': entry.isSkip ? '1' : undefined},
  }));
});
const resourcePaletteOptions = computed(() => resourcePaletteOptionsOf(port));
const resourceGainAmount = computed(() => resourceGainAmountOf(port));
const resourceReadings = computed(() => resourceReadingsOf(port));
const resourcePaletteKicker = computed((): string => {
  return translateTextWithParams('One of ${0}', [String(resourceUnits.value.length)]);
});
const disabledChoiceOptions = computed((): ReadonlyArray<VariantChoiceOption> => {
  return disabledChoiceEntries.value.map((d, i): VariantChoiceOption => ({
    key: 'd' + i, state: {focused: false, selected: false, off: true}, title: d.title, reason: d.reason, color: d.playerColor,
  }));
});
const playerOptions = computed((): ReadonlyArray<VariantChoiceOption> => {
  return playerEntries.value.map((p, i): VariantChoiceOption => ({
    key: 'p' + p.color, state: {focused: focusIdx.value === i, selected: focusIdx.value === i && armed.value, off: false}, title: p.name, color: p.color,
  }));
});
const disabledPlayerOptions = computed((): ReadonlyArray<VariantChoiceOption> => {
  return disabledPlayerEntries.value.map((d): VariantChoiceOption => ({
    key: 'dp' + d.color, state: {focused: false, selected: false, off: true}, title: d.name, reason: d.reason, color: d.color,
  }));
});
const choiceGroupLabel = computed((): string => {
  return titleText.value;
});
const choiceEntries = computed(() => choiceEntriesOf(port));
const disabledChoiceEntries = computed((): Array<{title: string, reason: string, playerColor: Color | undefined}> => {
  if (wf.value?.type !== 'or') {
    return [];
  }
  return ((wf.value as OrOptionsModel).disabledOptions ?? []).map((d) => {
    // The model's field is `title` (`DisabledOptionModel`); `label` is an older producer's spelling, read as a fallback.
    // Reading `label` alone dropped every disabled option's NAME — the row stood as a bare reason (TR79 walk, 2026-10-26).
    const rec = d as {title?: string | Message, label?: string | Message, reason?: string | Message, player?: {color?: Color}, metadata?: OptionMetadata};
    return {
      title: textOf(rec.title ?? rec.label),
      reason: textOf(rec.reason),
      playerColor: rec.metadata?.player?.color ?? rec.player?.color,
    };
  });
});
// ── player ───────────────────────────────────────────────────────
const playerEntries = computed((): Array<{color: Color, name: string, corp: string, selfHarm: boolean, raw: ReadonlyArray<TargetImpactChange>}> => {
  if (wf.value?.type !== 'player') {
    return [];
  }
  const model = wf.value as PlayerInputModel & {type: 'player', players: ReadonlyArray<Color>, icon?: string, amount?: number, scope?: 'stock' | 'production', targetImpacts?: ReadonlyArray<TargetImpact>};
  const scope = model.scope ?? 'stock';
  const serverImpacts = model.targetImpacts ?? [];
  return model.players.map((color) => {
    const p = props.playerView.players.find((pp) => pp.color === color);
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
      selfHarm: color === props.playerView.thisPlayer.color &&
        model.players.length > 1 && targetImpactIsLoss(raw),
      raw,
    };
  });
});
const disabledPlayerEntries = computed((): Array<{color: Color, name: string, reason: string}> => {
  if (wf.value?.type !== 'player') {
    return [];
  }
  const model = wf.value as PlayerInputModel & {type: 'player', disabledPlayers?: ReadonlyArray<{color: Color, reason?: string | Message}>};
  return (model.disabledPlayers ?? []).map((d) => ({
    color: d.color,
    name: displayNameForColor(props.playerView.players, d.color),
    reason: textOf(d.reason),
  }));
});
// ── amount ───────────────────────────────────────────────────────
const amountValidValues = computed(() => amountValidValuesOf(port));
const amountMin = computed(() => amountMinOf(port));
const amountMax = computed(() => amountMaxOf(port));
const amountIconClass = computed((): string => {
  const icon = wf.value?.type === 'amount' ? (wf.value as PlayerInputModel & {type: 'amount', icon?: string}).icon : 'energy';
  return icon !== undefined ? iconClassFor(icon) + ' con-task__opt-res' : '';
});
const amountUnit = computed((): string => {
  const unit = wf.value?.type === 'amount' ? (wf.value as PlayerInputModel & {type: 'amount', unit?: string}).unit : undefined;
  return unit ?? '';
});
/** The dial's model, when this task IS a SelectAmount. */
const amountModel = computed((): SelectAmountModel | undefined => {
  return wf.value?.type === 'amount' ? wf.value as SelectAmountModel : undefined;
});
/**
 * The PREMIUM CONVERSION composition (the server's `conversion` hint —
 * Supercapacitors' energy→heat is the reference): both sides'
 * `current → after` for the dialed value, the neutral/binary verdicts and
 * the headline. One pure source (`conversionPromptModel`), so the panel,
 * the commit label and the spec all state the same numbers — and the
 * preview mirrors exactly what the server's own callback will apply.
 */
const conversionVm = computed((): ConversionPromptVm | undefined => {
  return conversionPromptVm(amountModel.value, props.playerView.thisPlayer, value.value);
});
/** The binary plate's act label («Преобразовать 1»). */
const convertMaxLabel = computed((): string => {
  const vm = conversionVm.value;
  return vm === undefined ? '' : translateTextWithParams('Convert ${0}', [String(vm.max)]);
});
/**
 * The amount commit verb for the command bar. A CONVERSION names the
 * operation and its magnitude — «ПРЕОБРАЗОВАТЬ N», or the honest
 * «НЕ ПРЕОБРАЗОВЫВАТЬ» at 0 (a zero commit is a stated refusal, never a
 * generic «ОК»). Spend/priced operations (result / cost) and bare amounts
 * keep the server's own specific verb («Потратить энергию», «Получить
 * энергию», «Сбросить аэростаты»).
 */
const amountConfirmLabel = computed((): string => {
  if (conversionVm.value?.kind !== 'conversion') {
    return confirmLabel.value;
  }
  const label = conversionCommitLabel(value.value);
  return label.params.length > 0 ?
    translateTextWithParams(label.key, label.params) :
    translateText(label.key);
});
/**
 * The conversion headline REPLACES the generic server title as the panel's
 * main line («Преобразование энергии»), demoting the server ask to the
 * subtext — only standalone (an embedded stage's one-line head keeps the
 * full ask; a nested wizard step keeps its own title).
 */
const conversionAskDemoted = computed((): boolean => {
  return nested.value === undefined && !props.embedded &&
    conversionVm.value?.headlineKey !== undefined;
});
/**
 * The player-rail FOCUS accent: while a conversion prompt is live, its two
 * affected STOCK rows are what the decision is about (and where the commit
 * animation will play), so the rail marks them. '' = nothing to watch
 * (no conversion / embedded / production-scope sides have no stock row).
 */
const conversionWatchKey = computed((): string => {
  const vm = conversionVm.value;
  if (vm === undefined || props.embedded) {
    return '';
  }
  const from = vm.from.production ? '' : vm.from.icon;
  const to = vm.to.production ? '' : vm.to.icon;
  return from === '' && to === '' ? '' : `${from}|${to}`;
});
/**
 * What the CURRENT dial value SPENDS — the pool it comes out of, with
 * `current → resulting`. A `conversion`/`amountResult` dial counts the thing
 * spent (its own icon); an `amountCost` dial counts the thing GAINED and is
 * priced per unit out of another pool. No hint → no chip (a bare dial that
 * genuinely has no direction, e.g. "how many delegates").
 */
const amountCostChips = computed((): ReadonlyArray<ActionEffect> => {
  const m = amountModel.value;
  if (m === undefined) {
    return [];
  }
  if (m.amountCost !== undefined) {
    const spent = value.value * (m.amountCost.perUnit ?? 1);
    const pool = playerResourceValue(props.playerView.thisPlayer, m.amountCost.icon, m.amountCost.scope ?? 'stock');
    return [{direction: 'cost', icon: m.amountCost.icon, amount: spent, current: pool, resulting: pool !== undefined ? pool - spent : undefined,
      note: m.amountCost.scope === 'production' ? 'production' : undefined}];
  }
  const icon = m.icon ?? m.conversion?.from;
  if ((m.amountResult === undefined && m.conversion === undefined) || icon === undefined) {
    return [];
  }
  const scope = m.conversion?.fromScope ?? 'stock';
  const pool = playerResourceValue(props.playerView.thisPlayer, icon, scope);
  return [{direction: 'cost', icon, amount: value.value, current: pool, resulting: pool !== undefined ? pool - value.value : undefined,
    note: scope === 'production' ? 'production' : undefined}];
});
/** What the CURRENT dial value PRODUCES — the mirror of `amountCostChips`. */
const amountGainChips = computed((): ReadonlyArray<ActionEffect> => {
  const m = amountModel.value;
  if (m === undefined) {
    return [];
  }
  if (m.amountResult !== undefined) {
    return [{direction: 'gain', icon: m.amountResult.icon, amount: value.value * (m.amountResult.perUnit ?? 1)}];
  }
  if (m.conversion !== undefined) {
    const gained = value.value * (m.conversion.ratio ?? 1);
    const scope = m.conversion.toScope ?? 'stock';
    const pool = playerResourceValue(props.playerView.thisPlayer, m.conversion.to, scope);
    return [{direction: 'gain', icon: m.conversion.to, amount: gained, current: pool, resulting: pool !== undefined ? pool + gained : undefined,
      note: scope === 'production' ? 'production' : undefined}];
  }
  if (m.amountCost !== undefined && m.icon !== undefined) {
    const pool = playerResourceValue(props.playerView.thisPlayer, m.icon, 'stock');
    return [{direction: 'gain', icon: m.icon, amount: value.value, current: pool, resulting: pool !== undefined ? pool + value.value : undefined, unit: m.unit}];
  }
  return [];
});
// ── resource ─────────────────────────────────────────────────────
const resourceUnits = computed(() => resourceUnitsOf(port));
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
const lanes = computed((): Array<BudgetLane> => {
  if (activeTask.value.kind !== 'distribute') {
    return [];
  }
  if (activeTask.value.mode === 'production') {
    const model = wf.value as PlayerInputModel & {type: 'productionToLose'};
    return productionLossLanes(model.payProduction.units);
  }
  const stock = props.playerView.thisPlayer as unknown as Partial<Record<keyof Units, number>>;
  return standardGainLanes(distributeTarget.value, stock);
});
const distributeTarget = computed((): number => {
  if (activeTask.value.kind !== 'distribute') {
    return 0;
  }
  if (activeTask.value.mode === 'production') {
    return (wf.value as PlayerInputModel & {type: 'productionToLose'}).payProduction.cost;
  }
  return (wf.value as PlayerInputModel & {type: 'resources'}).count;
});
const distRule = computed((): BudgetRule => {
  return {kind: 'exact', target: distributeTarget.value};
});
/**
 * ONE unit to place → the lanes are a RADIO, not six dials: A puts it on
 * the focused lane / takes it back, X commits, and −1/+1/MAX are not
 * advertised (they still land on the same gesture — muscle memory must
 * never meet a dead button). The same question the Venus-bonus and
 * spend-heat surfaces ask of the same engine, so the three cannot drift.
 */
const distSingleStep = computed((): boolean => {
  return activeTask.value.kind === 'distribute' && budgetSingleStep(lanes.value, distRule.value);
});
/** The lane under the cursor already holds the unit — A takes it back. */
const distFocusedPicked = computed((): boolean => {
  const lane = lanes.value[focusIdx.value];
  return lane !== undefined && laneValue(lane.key) > 0;
});
/**
 * Why the confirm is withheld — the honest reason under the ask, never a
 * dead button (gain mode only: the production loss keeps its meter, whose
 * amber «Всего n / m» already says the same thing in loss language).
 */
const distBlockedText = computed((): string => {
  if (activeTask.value.kind !== 'distribute' || activeTask.value.mode !== 'resources' || distributeReady.value) {
    return '';
  }
  const key = budgetBlockedKey(lanes.value, units.value as BudgetState, distRule.value);
  return key === undefined ? '' : translateText(key);
});
const distributedSum = computed((): number => {
  return budgetTotal(lanes.value, units.value as BudgetState);
});
const distributeReady = computed((): boolean => {
  return budgetValid(lanes.value, units.value as BudgetState, distRule.value);
});
const handNames = computed(() => handNamesFn(port));
const taskDecline = computed(() => taskDeclineOf(port));
const directNested = computed(() => directNestedFn(port));
const nestedIsDirect = computed(() => nestedIsDirectOf(port));
const declineOnRt = computed(() => declineOnRtOf(port));
// ── card browser (T2) ────────────────────────────────────────────
const cardModel = computed((): SelectCardModel | undefined => {
  if (wf.value?.type === 'card') {
    return wf.value as SelectCardModel;
  }
  // THE LAYOUT MODE reads the SAME model shape off the distribution marker:
  // the faces (their live stored counts included), the sum as the pick's own
  // `resourceGainPrompt` amount, and no single recipient to choose (min 0).
  // One chassis, two modes — the grid, the fit, the zoom and the status
  // line are the card pick's, untouched.
  const spread = spreadMeta.value;
  if (spread !== undefined && wf.value !== undefined) {
    return {
      type: 'card',
      title: wf.value.title,
      buttonLabel: wf.value.buttonLabel,
      cards: spread.cards,
      min: 0,
      max: spread.cards.length,
      showOnlyInLearnerMode: false,
      selectBlueCardAction: false,
      showOwner: false,
      showSelectAll: false,
      resourceGainPrompt: {
        amount: spread.amount,
        ...(spread.cardResource === undefined ? {} : {cardResource: spread.cardResource}),
        ...(spread.cardResources === undefined ? {} : {cardResources: spread.cardResources}),
        ...(spread.cardResourceByCard === undefined ? {} : {cardResourceByCard: spread.cardResourceByCard}),
      },
      choiceContext: wf.value.choiceContext,
    };
  }
  return undefined;
});
/** The DISTRIBUTION marker of a `distribute`-mode ask (the shared `AddResourcesToCards` step's `and`). */
const spreadMeta = computed((): CardResourceDistributionMeta | undefined => {
  if (activeTask.value.kind !== 'cardSelect' || activeTask.value.mode !== 'distribute' || wf.value?.type !== 'and') {
    return undefined;
  }
  return (wf.value as AndOptionsModel).cardResourceDistributionPrompt;
});
/** The card browser stands in LAYOUT mode: N units to spread, a counter per card, the remaining count. */
const isSpreadMode = computed((): boolean => {
  return spreadMeta.value !== undefined;
});
const spreadAmount = computed((): number => {
  return spreadMeta.value?.amount ?? 0;
});
const spreadLeft = computed((): number => {
  return spreadRemaining(spreadAmount.value, spread.value);
});
const spreadPlaced = computed((): number => {
  return spreadTotal(spread.value);
});
/** The layout is complete — every unit placed (the ONE condition the commit stands on). */
const spreadReady = computed((): boolean => {
  return isSpreadMode.value && spreadComplete(spreadAmount.value, spread.value);
});
/** Why the commit is withheld («Осталось разложить: 2»), '' when the layout is complete. */
const spreadBlockedText = computed((): string => {
  if (!isSpreadMode.value) {
    return '';
  }
  const blocked = spreadBlocked(spreadAmount.value, spread.value);
  return blocked === undefined ? '' : translateTextWithParams(blocked.key, [...blocked.params]);
});
/** The whole layout's VP shift — the sum of each placed card's own entry of the server's table. */
const spreadVpShift = computed((): number => {
  const meta = spreadMeta.value;
  return meta === undefined ? 0 : spreadVictoryPointsShift(meta, spread.value);
});
/** The picks store's key for the layout — its own, beside the picks' (a minimize → restore keeps both). */
const spreadStoreKey = computed((): string => {
  return `${resetKey.value}|spread`;
});
/** Selectable candidates first, then the DISABLED ones (with reasons). */
/** Live models aligned with the deal's card list — the flying face must
 *  match the landed face (the parity contract). */
const dealModels = computed((): Array<CardModel | undefined> => {
  const pool = cardEntries.value.map((e) => e.card);
  return deal.value.state.cards.map((name) => pool.find((c) => c.name === name));
});
/**
 * The FOCUSED candidate's premium target reading (`resources current →
 * resulting` + «ПО from → to») for a pick the SERVER stamped with
 * `resourceGainPrompt` — the SAME pure builder both composers run, so a
 * deferred arrival (an Ares adjacency bonus, a triggered gift) explains
 * its targets exactly as a pre-collected step does. Empty for every other
 * card pick, so nothing else in the browser gains a line.
 */
const focusedTargetImpacts = computed((): ReadonlyArray<PlayedTargetImpact & {iconClass: string}> => {
  const model = cardModel.value;
  const entry = focusedCardEntry.value;
  if (model?.resourceGainPrompt === undefined || entry === undefined || entry.disabled) {
    return [];
  }
  // THE LAYOUT MODE reads the focused card for ITS CURRENT AMOUNT: the
  // resource «current → resulting» for what the player has put on it, and
  // the VP for exactly that amount — the server's own table entry, never a
  // delta scaled here. At 0 placed both readings stand still (quiet).
  const spreadNow = spreadMeta.value;
  if (spreadNow !== undefined) {
    const reading = spreadCardReading(spreadNow, spread.value, entry.card.name as CardName);
    if (reading === undefined) {
      return [];
    }
    // The icon is the kind THIS card takes — its own (a layout over several kinds), else the layout's one kind.
    const icon = spreadResourceOf(entry.card.name);
    const out: Array<PlayedTargetImpact & {iconClass: string}> = [{
      label: 'Resources on this card', icon, from: reading.resources.from, to: reading.resources.to,
      static: reading.placed === 0, iconClass: iconClassFor(icon),
    }];
    if (reading.vp !== undefined) {
      out.push({label: 'VP', from: reading.vp.from, to: reading.vp.to, static: reading.vp.from === reading.vp.to, iconClass: ''});
    }
    return out;
  }
  const sections = playedTargetPreviewFor(undefined, model, entry.card.name as CardName);
  return (sections.find((s) => s.key === 'res')?.impacts ?? [])
    .map((imp) => ({...imp, iconClass: iconClassFor(imp.icon)}));
});
const cardEntries = computed((): Array<{card: CardModel, disabled: boolean, reason: string}> => {
  const model = cardModel.value;
  if (model === undefined) {
    return [];
  }
  return [
    ...model.cards.map((card) => ({card, disabled: false, reason: ''})),
    ...(model.disabledCards ?? []).map((card) => ({card, disabled: true, reason: textOf(card.disabledReason)})),
  ];
});
const focusedCardEntry = computed((): {card: CardModel, disabled: boolean, reason: string} | undefined => {
  return cardEntries.value[focusIdx.value];
});
/**
 * A SPLIT REVEAL's COMPANIONS (P88 Venus Orbital Survey — the server's `deckPickPrompt.companions`):
 * the cards of the SAME reveal the rule already sent to the hand for free. Shown beside the
 * offered ones, never pickable; they leave with the answer in the SAME intake as the bought cards.
 * The verdict is the server's — the client never counts a tag.
 */
const companionCards = computed((): ReadonlyArray<CardModel> => {
  return isBuyMode.value ? (cardModel.value?.deckPickPrompt?.companions?.cards ?? []) : [];
});
/**
 * WHERE each companion stands in the row: the reveal's own order (`deckPickPrompt.order`) mapped
 * onto the offered entries — `before[i]` are the companions the deck turned over between offered
 * card i−1 and i, `after` those past the last one. Computed once per prompt (pure over the model).
 */
const companionPlacement = computed((): {before: Array<Array<CardModel>>, after: Array<CardModel>} => {
  const companions = companionCards.value;
  const before: Array<Array<CardModel>> = cardEntries.value.map(() => []);
  if (companions.length === 0) {
    return {before, after: []};
  }
  const byName = new Map(companions.map((c) => [c.name, c] as const));
  const order = cardModel.value?.deckPickPrompt?.order ?? companions.map((c) => c.name);
  const pending: Array<CardModel> = [];
  const placed = new Set<string>();
  let next = 0;
  for (const name of order) {
    const companion = byName.get(name);
    if (companion !== undefined) {
      pending.push(companion);
      placed.add(name);
      continue;
    }
    const at = cardEntries.value.findIndex((e, i) => i >= next && e.card.name === name);
    if (at < 0) {
      continue;
    }
    before[at].push(...pending.splice(0));
    next = at + 1;
  }
  // A companion the order did not name (an older marker) closes the row.
  const after = [...pending, ...companions.filter((c) => !placed.has(c.name))];
  return {before, after};
});
const companionsAfter = computed((): ReadonlyArray<CardModel> => {
  return companionPlacement.value.after;
});
/** The printed check the companions met — its tag glyph on the verdict band. */
const companionCheckTag = computed((): string => {
  return cardModel.value?.deckPickPrompt?.companions?.check.tag ?? '';
});
const companionVerdictText = computed((): string => {
  return translateText(companionCheckTag.value === Tag.VENUS ? 'Venus card — to your hand for free' : 'To your hand for free');
});
/**
 * A PAYING reveal the player cannot afford at all (`max 0` — «You cannot afford any cards»): the
 * purchase stage still stands (it is routed by the marker), nothing is choosable, every offered
 * card is marked for the discard with the price that stops it, and RT is the server's «OK».
 */
const buyCannotAfford = computed((): boolean => {
  return isBuyMode.value && cardMax.value === 0;
});
/** «Не хватает M€ (3 за карту)» — the named reason of the discard above (one renderer, PL-160). */
const buyCannotAffordText = computed((): string => {
  return translateTextWithParams('Not enough M€ (${0} per card)', [String(buyCostPerCard.value)]);
});
const buyPaysByPrompt = computed(() => buyPaysByPromptOf(port));
const buyPaymentPrompt = computed(() => buyPaymentPromptOf(port));
const buyPayStage = computed(() => buyPayStageOf(port));
const buyPayLanes = computed((): Array<PaymentLane> => {
  const model = buyPaymentPrompt.value;
  return model === undefined ? [] : paymentLanes(model, props.playerView.thisPlayer);
});
const buyPayView = computed((): PaymentView | undefined => {
  if (buyPaymentPrompt.value === undefined) {
    return undefined;
  }
  return buildPaymentView({cost: buyTotal.value, lanes: buyPayLanes.value, counts: payCounts.value, mcAvailable: megacreditsOnHand.value});
});
const buyPayFocusUnit = computed((): string | undefined => {
  const v = buyPayView.value;
  return v === undefined ? undefined : editableRows(v)[focusIdx.value]?.unit;
});
const buyPayReady = computed((): boolean => {
  return paymentCovers(buyTotal.value, buyPayLanes.value, payCounts.value, megacreditsOnHand.value);
});
const cardMin = computed((): number => {
  return cardModel.value?.min ?? 0;
});
const cardMax = computed((): number => {
  return cardModel.value?.max ?? 0;
});
/** min === max === 1 (P15: A toggles ONLY — Y is the one confirm). */
const singlePick = computed((): boolean => {
  return cardMin.value === 1 && cardMax.value === 1;
});
/** P15: at the pick max, unpicked cards de-emphasize (desktop parity). */
const cardDimUnpicked = computed((): boolean => {
  return cardMax.value > 0 && picks.value.length >= cardMax.value;
});
/** Can A pick the focused (unpicked, enabled) card right now? */
const canPickFocusedCard = computed((): boolean => {
  return cardMax.value === 1 || picks.value.length < cardMax.value;
});
/** P13: >6 candidates wrap into a grid (no kilometre scrolling). */
const gridMode = computed((): boolean => {
  return activeTask.value.kind === 'cardSelect' && cardEntries.value.length > 6;
});
const isBuyMode = computed((): boolean => {
  return activeTask.value.kind === 'cardSelect' && activeTask.value.mode === 'buy';
});
/**
 * The between-generation DRAFT pick (keep a card, pass the rest on). The
 * REAL Draft.ts prompt uses buttonLabel 'Select' (→ router `mode: 'target'`),
 * so the reliable signal is the PHASE (mirrors the desktop
 * CardSelectionContent.isDraftPhase). The dead `mode: 'draft'` branch stays
 * for any future 'Keep'-labelled prompt.
 */
const isDraftPick = computed((): boolean => {
  const phase = props.playerView.game.phase;
  return activeTask.value.kind === 'cardSelect' &&
    (activeTask.value.mode === 'draft' || phase === Phase.DRAFTING || phase === Phase.INITIALDRAFTING);
});
/** Cards the viewer has already drafted this round (server-managed;
 *  cleared at endRound). Shown COMPACTLY here — the wide host modal covers
 *  the screen corners, so a full pile would collide; the calm draftWait
 *  banner draws the desktop-style stack once the modal is gone. */
const draftedCards = computed((): ReadonlyArray<CardModel> => {
  return props.playerView.draftedCards ?? [];
});
/** RT opens the read-only drafted-cards viewer — ONLY in the single-keep
 *  draft, where RT is otherwise free (a multi-keep RT commits the set). */
const canInspectDrafted = computed((): boolean => {
  return isDraftPick.value && singlePick.value && draftedCards.value.length > 0;
});
const buyCostPerCard = computed(() => buyCostPerCardOf(port));
/** Who set a non-default `buyCostPerCard` — the «N × unit»'s hint ('' on a plain table). */
const buyPriceHint = computed((): string => {
  return purchasePriceHint(purchasePriceSource(props.playerView.thisPlayer));
});
const buyTotal = computed(() => buyTotalOf(port));
const megacreditsOnHand = computed(() => megacreditsOnHandOf(port));
const megacreditsAfterPurchase = computed(() => megacreditsAfterPurchaseOf(port));
const cardBuyAffordable = computed(() => cardBuyAffordableOf(port));
/** The honest insufficient-funds banner text (buy phase). */
const buyShortfallText = computed((): string => {
  // ONE renderer for a key with params (PL-160) — never a hand-rolled replace of the template.
  return translateTextWithParams('Not enough M€: need ${0}, have ${1}', [String(buyTotal.value), String(megacreditsOnHand.value)]);
});
/** RT/commit label for the MULTI (buy / multi-target) commit. */
const cardConfirmLabel = computed((): string => {
  if (isBuyMode.value) {
    // Nothing can be bought: the decision is only «seen» — the server's own «OK».
    if (buyCannotAfford.value) {
      return 'OK';
    }
    return picks.value.length === 0 ? 'Skip' : 'Buy';
  }
  return confirmLabel.value;
});
/** A one-line explanation under the title (single-keep draft: what happens
 *  to the cards you don't keep; a conversion: the demoted server ask). */
const phaseSubtext = computed((): string => {
  if (conversionAskDemoted.value) {
    return textOf(wf.value?.title);
  }
  return isDraftPick.value && singlePick.value ?
    translateText('The card is kept for you, the rest are passed on.') : '';
});
const cardPicksValid = computed((): boolean => {
  return picks.value.length >= cardMin.value && picks.value.length <= cardMax.value && cardBuyAffordable.value;
});
// ── payment (T3) ─────────────────────────────────────────────────
const paymentModel = computed((): SelectPaymentModel | undefined => {
  return wf.value?.type === 'payment' ? (wf.value as SelectPaymentModel) : undefined;
});
const paymentCost = computed((): number => {
  return paymentModel.value?.amount ?? 0;
});
const payLanes = computed((): Array<PaymentLane> => {
  const model = paymentModel.value;
  if (model === undefined) {
    return [];
  }
  return paymentLanes(model, props.playerView.thisPlayer);
});
/** The SHARED payment presentation model — the same one the card-play and
 *  blue-action composers render, so this standalone prompt speaks the
 *  identical language (rows, order, verdict, geometry). */
const paymentView = computed((): PaymentView | undefined => {
  const model = paymentModel.value;
  if (model === undefined) {
    return undefined;
  }
  return buildPaymentView({
    cost: model.amount,
    lanes: payLanes.value,
    counts: payCounts.value,
    mcAvailable: megacreditsOnHand.value,
  });
});
/** The unit the cursor sits on — the lane list and the panel's editable
 *  rows are the SAME sequence, so `focusIdx` indexes both. */
const payFocusUnit = computed((): string | undefined => {
  const v = paymentView.value;
  return v === undefined ? undefined : editableRows(v)[focusIdx.value]?.unit;
});
const paymentReady = computed((): boolean => {
  return activeTask.value.kind !== 'payment' ||
    paymentCovers(paymentCost.value, payLanes.value, payCounts.value, megacreditsOnHand.value);
});
// ── projectCard (generic — desktop-removal wave 2) ─────────────────
// The fallback the legacy MandatoryInputModal used to serve: candidates
// that are neither the hand nor the standard-project sheet (Odyssey's
// played events; a future producer's foreign list). Two stages inside
// this ONE host surface: PICK (the shared card-browser chassis) → PAY
// (the shared payment panel over `projectCardPaymentPrompt`), one submit
// `{type:'projectCard', card, payment}` — byte-parity with the desktop
// SelectProjectCardToPlay it replaces.
const pcModel = computed((): SelectProjectCardToPlayModel | undefined => {
  return activeTask.value.kind === 'projectCard' && wf.value?.type === 'projectCard' ?
    wf.value as SelectProjectCardToPlayModel : undefined;
});
const pcEntries = computed((): Array<{card: CardModel, disabled: boolean, reason: string}> => {
  const model = pcModel.value;
  if (model === undefined) {
    return [];
  }
  return model.cards.map((card) => ({
    card,
    disabled: card.isDisabled === true,
    reason: textOf(card.disabledReason),
  }));
});
const pcPicked = computed((): CardModel | undefined => {
  return pcEntries.value.find((e) => e.card.name === pcPick.value)?.card;
});
const pcCost = computed((): number => {
  const card = pcPicked.value;
  if (card === undefined) {
    return 0;
  }
  return card.calculatedCost ?? getCard(card.name)?.cost ?? 0;
});
const pcLanes = computed((): Array<PaymentLane> => {
  const card = pcPicked.value;
  const model = pcModel.value;
  if (card === undefined || model === undefined) {
    return [];
  }
  const tags = getCard(card.name)?.tags ?? [];
  const prompt = projectCardPaymentPrompt(
    pcCost.value, tags, model.paymentOptions ?? {},
    props.playerView.thisPlayer.lastCardPlayed, card.reserveUnits);
  return paymentLanes(prompt, props.playerView.thisPlayer);
});
const pcPaymentView = computed((): PaymentView | undefined => {
  if (pcPicked.value === undefined) {
    return undefined;
  }
  return buildPaymentView({
    cost: pcCost.value,
    lanes: pcLanes.value,
    counts: payCounts.value,
    mcAvailable: megacreditsOnHand.value,
  });
});
const pcFocusUnit = computed((): string | undefined => {
  const v = pcPaymentView.value;
  return v === undefined ? undefined : editableRows(v)[focusIdx.value]?.unit;
});
const pcReady = computed((): boolean => {
  return pcPicked.value !== undefined &&
    paymentCovers(pcCost.value, pcLanes.value, payCounts.value, megacreditsOnHand.value);
});
const pcGrid = computed((): boolean => {
  return pcEntries.value.length > 6;
});
/** Can X submit right now? */
const confirmReady = computed((): boolean => {
  switch (activeTask.value.kind) {
  case 'distribute':
    return distributeReady.value;
  case 'choice':
    return choiceEntries.value.length > 0;
  case 'player':
    return playerEntries.value.length > 0;
  case 'resource':
    return resourceUnits.value.length > 0;
  case 'cardSelect':
    // The LAYOUT is sendable only when complete — the same condition the
    // handler and the response builder each check for themselves.
    if (buyPayStage.value) {
      return buyPayReady.value;
    }
    return isSpreadMode.value ? spreadReady.value : cardPicksValid.value;
  case 'payment':
    return paymentReady.value;
  case 'projectCard':
    return pcStage.value === 'pay' ?
      pcReady.value :
      !(pcEntries.value[focusIdx.value]?.disabled ?? true);
  default:
    return true;
  }
});
const footCommands = computed(() => footCommandsOf(port));
const baseFootCommands = computed((): Array<ConsoleCommand> => {
  // While the deal cinematic / a draft beat runs, selection is NOT
  // interactive yet — the bar advertises only the skip (any button skips).
  if (deal.value.state.active || trayPickBeat.value) {
    return [{control: 'confirm', label: 'Skip'}];
  }
  // The workspace's batch is still landing: the stage advertises no VERB
  // yet. A verb on the bar while the slots are empty is a promise the
  // stage cannot keep, and the input path swallows it anyway. ⚠ Never an
  // EMPTY contract: the shell reads «nothing published» as «use the static
  // set» and lit «A Выбрать · X Подтвердить» over a stage absorbing every
  // press (P88 · CI 2026-11-03) — the bar narrates the arrival instead,
  // the composer's own draw-beat status.
  if (arrivalPending.value) {
    return [{control: 'confirm', label: 'Drawing cards…', enabled: false}];
  }
  // A live pick's ANSWER is playing as a scene (TR53 iteration): nothing on this surface accepts a press any more —
  // the bar is a STATUS («Выполняется…»), never a verb nothing accepts (the composers' own grammar past the press).
  if (receivingPick.value !== undefined) {
    return [{control: 'confirm', label: 'Performing…', enabled: false}];
  }
  // The COMMIT speaks the decision's character (`tonedCommit`): a loss is ACCEPTED in the danger ink, a gain is
  // COLLECTED in the claimable glow — never one «Подтвердить» for both (the Philares → hazard chain).
  const confirm = tonedCommit({control: 'secondary' as GlyphControl, label: confirmLabel.value, enabled: confirmReady.value});
  const defer = {control: 'back' as GlyphControl, label: nested.value !== undefined && !nestedIsDirect.value ? 'Back' : props.deferLabel};
  // The select → confirm contract (A picks, X commits) every arm-then-confirm
  // kind shares — a generic OrOptions / player / resource pick.
  const selectThenConfirm: Array<ConsoleCommand> = [
    {control: 'dpad', label: 'Navigate'},
    {control: 'confirm', label: 'Select'},
    confirm, ...sourceHint.value, defer,
  ];
  switch (activeTask.value.kind) {
  case 'choice': {
    if (!choiceOnePress.value) {
      return selectThenConfirm; // a GENERIC OrOptions keeps the two-step
    }
    // ONE press decides: A commits the focused option, so the bar must NOT
    // advertise a second «Выполнить» on X (that read as a required step —
    // and it WAS one: A only armed). X becomes the console-wide INSPECT
    // verb, offered only when there IS a source card to inspect.
    // A press that OPENS something («Выбрать») is not the commit of the decision — only a leaf is toned.
    const decide: ConsoleCommand = {control: 'confirm', label: choiceCommandLabel.value, enabled: confirmReady.value};
    const cmds: Array<ConsoleCommand> = [
      {control: 'dpad', label: 'Navigate'},
      choiceCommandLabel.value === 'Confirm' ? tonedCommit(decide) : decide,
    ];
    if (sourceInspectable.value) {
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
      {control: 'confirm', label: amountConfirmLabel.value, enabled: confirmReady.value};
    if (conversionVm.value?.binary === true) {
      // Binary = two plates: the d-pad walks them, A commits the focused
      // one. LB/RB/RT still land silently (muscle memory), but the bar
      // advertises only the two real verbs — no dial chrome for one unit.
      return [
        {control: 'dpad', label: 'Navigate'}, amountCommit, ...sourceHint.value, defer,
      ];
    }
    return [
      {control: 'bumperL', label: '−1'}, {control: 'bumperR', label: '+1'},
      {control: 'triggerR', label: 'MAX'}, amountCommit, ...sourceHint.value, defer,
    ];
  }
  case 'distribute': {
    // ONE unit → one gesture: A places / takes back, X commits. Offering
    // −1 / +1 / MAX for a dial that can only read 0 or 1 is four ways to
    // say the same thing (the budgetLanes rule; the Venus surface's bar).
    if (distSingleStep.value) {
      return [
        {control: 'dpad', label: 'Navigate'},
        {control: 'confirm', label: distFocusedPicked.value ? 'Remove here' : 'Add here'},
        confirm, ...sourceHint.value, defer,
      ];
    }
    // RT places what is LEFT on the focused lane — named so (never «МАКС.»).
    // The layout's own verbs and its commit (X here) are the LAST to drop
    // from a crowded bar: at the default bumper rank LB/RB went first,
    // before the generic Source — the bar then hid how to distribute at all.
    // RT is a SHORTCUT (LB/RB place the same units one by one), so it keeps
    // the trigger rank and drops BEFORE L3: the source has no other home on
    // this surface (the dock draws no badge), the shortcut's work does
    // (CI 2026-11-08, `console-prompt-source` — the 1440 bar dropped «Источник»).
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'bumperL', control2: 'bumperR', label: 'Distribute −1 / +1', priority: 0},
      {control: 'triggerR', label: 'Rest here', enabled: distributedSum.value < distributeTarget.value, priority: 2},
      {...confirm, priority: 0}, ...sourceHint.value, defer,
    ];
  }
  case 'payment':
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'bumperL', label: '−1'}, {control: 'bumperR', label: '+1'},
      {control: 'triggerR', label: 'MAX'}, confirm, ...sourceHint.value, defer,
    ];
  case 'projectCard': {
    if (pcStage.value === 'pay') {
      // The PAY stage: the shared payment contract + B = one level back.
      return [
        {control: 'dpad', label: 'Navigate'},
        {control: 'bumperL', label: '−1'}, {control: 'bumperR', label: '+1'},
        {control: 'triggerR', label: 'MAX'},
        {control: 'secondary', label: confirmLabel.value, enabled: confirmReady.value},
        {control: 'back', label: 'Back'},
      ];
    }
    // The PICK stage mirrors the single-pick card browser: A carries the
    // candidate forward, X inspects fullscreen.
    return [
      {control: pcGrid.value ? 'dpad' : 'dpadH', label: 'Navigate'},
      {control: 'confirm', label: 'Select', enabled: confirmReady.value},
      {control: 'secondary', label: 'Inspect'},
      defer,
    ];
  }
  case 'cardSelect': {
    // X ALWAYS opens the fullscreen INSPECT viewer (never labelled "Card").
    const nav: {control: GlyphControl, label: string} = {control: gridMode.value ? 'dpad' : 'dpadH', label: 'Navigate'};
    const inspect: {control: GlyphControl, label: string} = {control: 'secondary', label: 'Inspect'};
    // THE PURCHASE'S PAY STAGE (PL-1411): the shared payment contract + B = one level back to the picks.
    if (buyPayStage.value) {
      return [
        {control: 'dpad', label: 'Navigate'},
        {control: 'bumperL', label: '−1'}, {control: 'bumperR', label: '+1'},
        {control: 'triggerR', label: 'MAX'},
        {control: 'confirm', label: 'Pay', enabled: confirmReady.value, priority: 0},
        ...sourceHint.value,
        {control: 'back', label: 'Back'},
      ];
    }
    if (isSpreadMode.value) {
      // THE LAYOUT: LB / RB move one unit on the focused card, RT pours the
      // REST onto it, A confirms — enabled only once everything is placed
      // (the status line says why not yet). Inspect and Source as on any
      // pick. The verbs NAME the layout (the owner, 2026-11-08: a bare
      // «−1 · +1 · МАКС.» did not read as «this is how you distribute», and
      // «МАКС.» hid that RT places what is LEFT, not a maximum). They are
      // the LAST to drop from a crowded bar (beside A): at the default
      // bumper rank they went before Inspect / Source. RT alone keeps the
      // trigger rank — a shortcut for what LB/RB already do, it drops
      // before the verbs with no other home (Inspect, Source).
      const focused = focusedCardEntry.value;
      const live = focused !== undefined && !focused.disabled;
      const canTake = live && spreadOnCard(focused.card.name) > 0;
      const canPut = live && spreadLeft.value > 0;
      return [
        nav,
        {control: 'bumperL', control2: 'bumperR', label: 'Distribute −1 / +1', enabled: canTake || canPut, priority: 0},
        {control: 'triggerR', label: 'Rest here', enabled: canPut, priority: 2},
        {control: 'confirm', label: confirmLabel.value, enabled: spreadReady.value, priority: 0},
        inspect, ...sourceHint.value, defer,
      ];
    }
    if (singlePick.value) {
      // PICK phase (draft / single target): A commits the focused card in
      // one press — no toggle-then-confirm, no re-pick. RT (otherwise free)
      // opens the drafted-cards viewer in a single-keep draft.
      // STANDALONE: a card browser opened BY a marked prompt (a contextual
      // choice's nested target pick) has a source too — L3 already worked
      // here, but only the embedded case advertised it, so it was reachable
      // and undiscoverable. Mutually exclusive with the workspace hint below
      // (that one is embedded-only).
      const pickHints: Array<ConsoleCommand> = [
        nav, {control: 'confirm', label: 'Select'}, inspect, ...sourceHint.value,
      ];
      if (workspaceSourceCard.value !== undefined) {
        // Discoverable nowhere else → survives the Deck bar's fit drops
        // longer than the self-evident stick/dpad hints (default 3).
        pickHints.push({control: 'stickL', label: 'Source', priority: 1});
      }
      if (canInspectDrafted.value) {
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
      ...sourceHint.value,
    ];
    if (workspaceSourceCard.value !== undefined) {
      // Discoverable nowhere else → outlives the self-evident hints in
      // the Deck bar's fit drops (stick default is 3 = first to go).
      buyHints.push({control: 'stickL', label: 'Source', priority: 1});
    }
    // The stage's COMMIT verb: with the embedded status line carrying no
    // glyph chips anymore, the bar is the ONE place RT is discoverable —
    // it must be the last droppable standing.
    buyHints.push({control: 'triggerR', label: cardConfirmLabel.value, enabled: confirmReady.value, priority: 0});
    buyHints.push(defer);
    return buyHints;
  }
  default:
    return selectThenConfirm;
  }
});
const focusCount = computed((): number => {
  switch (activeTask.value.kind) {
  case 'choice': return choiceEntries.value.length;
  case 'player': return playerEntries.value.length;
  case 'resource': return resourceUnits.value.length;
  case 'distribute': return lanes.value.length;
  case 'cardSelect': return cardEntries.value.length;
  case 'payment': return payLanes.value.length;
  case 'projectCard':
    return pcStage.value === 'pay' ? pcLanes.value.length : pcEntries.value.length;
  default: return 0;
  }
});
/**
 * The candidate a LIVE pick's answer is landing on (TR53 iteration): sealed in place while its scene is owed or
 * playing; every other candidate recedes. Only a candidate of THIS host's strip (a stale name never poses).
 */
const receivingPick = computed((): CardName | undefined => {
  const card = receive.card;
  return card !== undefined && cardEntries.value.some((e) => e.card.name === card) ? card : undefined;
});
/** The table owns the screen (pick landing / rise) — chrome dissolved. */
const trayTableBeat = computed((): boolean => {
  return draftTrayState.tableView;
});
/** A hero pick flight is live — input skips it, chrome stays quiet. */
const trayPickBeat = computed((): boolean => {
  return draftTrayState.pickActive || draftTrayState.processing;
});
/**
 * THE BATCH IS STILL ARRIVING (embedded only). The cards this stage renders
 * are physically flying in as proxies over their held, invisible slots, so
 * interaction opens only when they are all down and handed over — a focus
 * ring on an empty slot promises a card that is not there, and a press
 * accepted mid-flight is an input race by construction. Exactly the
 * `deal.state.active` rule the standalone stage has always applied to its
 * own cinematic, for the workspace's.
 *
 * ⚠️ IT IS ABOUT THE SLOTS, NOT ABOUT THE CLAIM. A play claims its outcome
 * OPTIMISTICALLY — `draw` + `pick` + `effect`, before the response exists,
 * because a triggered draw is invisible to every preview — and the arrival
 * is marked done by whoever actually LANDS the cards. A response that
 * carries no cards at all therefore leaves `arrivalDone` false until the
 * claim's own backstop fires, which is harmless for a stage the batch was
 * going to land on and pure damage for one it never could: a prelude's
 * embedded PAYMENT («Огромный астероид» paid with Helion's heat) stood
 * exact and valid with every press swallowed and the bar reduced to the
 * shell's fallback verbs for the backstop's whole length. The gate belongs
 * to the LANDING ZONE — see `stageTakesBatch`.
 */
const arrivalPending = computed((): boolean => {
  return props.embedded && stageTakesBatch.value && workspaceOutcomeArrivalPending();
});
/**
 * IS THIS STAGE THE CLAIMED BATCH'S LANDING ZONE — the card strip whose
 * held, invisible slots the proxies fly into?
 *
 * Only the card families have slots for a batch to arrive over. A payment,
 * an amount, a resource pick, an OrOptions branch list renders no card of
 * the batch at all, so for them «the batch is still arriving» can only ever
 * mean «swallow the player's input for nothing».
 */
const stageTakesBatch = computed((): boolean => {
  return activeTask.value.kind === 'cardSelect' ||
    (activeTask.value.kind === 'projectCard' && pcStage.value === 'pick');
});

/** The split reveal's companions the deck turned over right before offered card `i` (see `companionPlacement`). */
function companionsBefore(i: number): ReadonlyArray<CardModel> {
  return companionPlacement.value.before[i] ?? [];
}
/** The companion slots as they stand in the row (DOM = reveal order) — they leave WITH the answer. */
function companionExitSources(): Array<{name: CardName, el: HTMLElement}> {
  const strip = cardStrip.value ?? undefined;
  if (strip === undefined || strip === null || typeof strip.querySelectorAll !== 'function') {
    return [];
  }
  return Array.from(strip.querySelectorAll<HTMLElement>(':scope > [data-companion-slot]'))
    .map((el) => ({name: (el.dataset.zoomSlot ?? '') as CardName, el}))
    .filter((s) => s.name !== '');
}
/** A target impact's label — the ONE renderer of a reading with params (PL-160). */
function impactText(imp: PlayedTargetImpact): string {
  // A value reading carries its «where» as a tail («Оплата: 3 M€ · за карты с меткой Венеры») — the whole line.
  return imp.value === true ? readingLineText(imp) : readingText(imp);
}
function resetState(): void {
  focusIdx.value = 0;
  armed.value = false;
  units.value = {};
  // Card-browser picks survive a minimize→restore: seed from the
  // defer-durable module store when the reset key matches (same prompt +
  // card set, e.g. a re-expanded modal), otherwise start empty (a
  // genuinely new ask / fresh card set / non-card task).
  picks.value = activeTask.value.kind === 'cardSelect' && !isSpreadMode.value ? recallCardBrowserPicks(resetKey.value) as Array<CardName> : [];
  // THE LAYOUT OPENS EMPTY — or exactly as it was left when the same ask was minimized.
  const spreadNow = spreadMeta.value;
  spread.value = spreadNow === undefined ? {} : spreadFromPicks(recallCardBrowserPicks(spreadStoreKey.value), spreadNow);
  // projectCard (generic): a fresh prompt always re-opens on the PICK
  // stage — a stale pay stage would price a card the new ask never offered.
  pcStage.value = 'pick';
  pcPick.value = undefined;
  buyStage.value = 'pick';
  submitting.value = false;
  // Payment opens on the SAME optimal default mix the desktop form uses.
  payCounts.value = activeTask.value.kind === 'payment' ?
    initialCounts(paymentCost.value, payLanes.value, megacreditsOnHand.value) : {};
  // A CONVERSION opens at the SAFE floor (0 — «не преобразовывать») even
  // when the server marks maxByDefault: converting is a deliberate opt-in
  // and the commit verb names the refusal explicitly, so nothing can be
  // spent by a reflex press. Bare amounts keep the server's default.
  const amountModel = wf.value?.type === 'amount' ? (wf.value as SelectAmountModel) : undefined;
  const init = amountModel !== undefined ?
    (amountModel.conversion !== undefined ? amountModel.min :
      (amountModel.maxByDefault ? amountMax.value : amountMin.value)) :
    // The Hydronetwork move stepper opens at the SAFE floor — the fewest
    // legal steps to buy; spending more energy is a deliberate dial-up.
    (wf.value?.type === 'deltaProject' ? amountMin.value : amountMax.value);
  value.value = init;
}
/** The shell routes every intent here while the host is active. */
function handleIntent(intent: GamepadIntent): void {
  // Any input mid-PICK-BEAT (the hero flying into the tray) skips it —
  // the press is consumed, nothing can act on the dissolving round.
  if (draftPickBeatActive()) {
    skipDraftPickBeat();
    return;
  }
  // Any input mid-deal SKIPS the cinematic (and is consumed) — no press
  // can act on cards that aren't interactive yet.
  if (deal.value.state.active) {
    deal.value.skip();
    return;
  }
  // The workspace's BATCH ARRIVAL is the same rule one level out: the cards
  // are still flying in over these slots, so every verb is absorbed until
  // they have landed and handed over. Absorbed, not queued — a press the
  // player made at an empty stage must not fire on whatever lands there.
  if (arrivalPending.value) {
    noteInputAbsorbed(TASK_HOST_ARRIVAL_ABSORBER);
    return;
  }
  if (intent.kind === 'nav') {
    onNav(intent.dir);
    return;
  }
  // L3 = the SOURCE, fullscreen. EMBEDDED reads the workspace claim (the
  // one thing that knows which card's action produced this pick);
  // STANDALONE reads the prompt's own `choiceContext` source — the card
  // that caused a decision the player did not open themselves (Philares).
  // The stage under the viewer is never unmounted: selection, cost and
  // focus all survive.
  if (intent.kind === 'press' && intent.button === 'stickL') {
    if (workspaceSourceCard.value !== undefined) {
      zoomWorkspaceSource();
      return;
    }
    if (standaloneSourceCard.value !== undefined) {
      zoomSourceCard();
      return;
    }
    if (stageSourceResolution.value !== undefined) {
      zoomStageResolution();
      return;
    }
  }
  const action = consoleActionOf(intent);
  if (action !== undefined) {
    onPress(action);
  }
}
/**
 * DEAL CINEMATIC (console_card_deal.less / cardDealSequence.ts): decide
 * + arm the hold for a fresh card set, synchronously — called pre-flush
 * from the resetKey watcher, so the real cards render hidden from their
 * very first frame. Only the card browser deals; every other task kind
 * clears any previous hold.
 */
function prepareDeal(): void {
  cancelDealLaunch();
  const cards = activeTask.value.kind === 'cardSelect' ? cardEntries.value.map((e) => e.card) : [];
  const names = cards.map((c) => c.name);
  const keys = cards.map((c, i) => c.name + '#' + i);
  const dealKey = `${props.playerView.id}|${resetKey.value}`;
  // The SAME rule for the workspace's execution beat. Embedded, the
  // card has ALREADY been pulled off the HUD pile, flown into this very
  // zone and turned over — that beat IS this set's arrival. Dealing again
  // sends the same card from the same deck a second time: the player
  // watches it arrive, settle, and then arrive again. (Log signature:
  // `onSettled` → `beatDone` → the old deal starting.)
  if (props.embedded && names.length > 0) {
    deal.value.dispose();
    shouldRunDealOnce(dealKey);
    return;
  }
  if (deal.value.prepare(dealKey, names, keys)) {
    // Launch after the con-task-swap frame transition (160ms) settles +
    // fitCardStrip has sized the row — the measured rects are final.
    // A still-landing draft pick (the hero flying into the tray) is
    // AWAITED first: consequences never precede their explanation.
    cancelDealLaunch = flow.after(motionMs(260), 'the task frame settles before the deal', () => {
      void whenPickBeatDone().then(() => flow.afterFrame('the deal launches', () => launchDeal()));
    });
  } else if (riseSceneEngaged() && isBuyMode.value) {
    // The buy set was already dealt once (defer/restore path) — never
    // replay the scene; the tray hands off instantly.
    finishRiseScene();
  }
}
function launchDeal(): void {
  if (!deal.value.state.active) {
    return;
  }
  const strip = cardStrip.value ?? undefined;
  const layer = dealLayer.value ?? undefined;
  if (strip === undefined || strip === null || layer === undefined) {
    deal.value.dispose();
    if (riseSceneEngaged()) {
      finishRiseScene();
    }
    return;
  }
  const slotCards = Array.from(strip.querySelectorAll<HTMLElement>(':scope > .con-cards__slot > :is(.card-container, .pcard)'));
  deal.value.launch({
    slotCards, proxies: layer.proxyEls(), deck: layer.deckEl(), rise: riseExtras(),
    // EMBEDDED as a workspace outcome: these cards were physically taken
    // off the HUD project deck by the action the player just confirmed, so
    // they must leave FROM it. Dealing them from the synthetic bottom
    // dealer contradicts «посмотрите верхнюю карту колоды» and breaks the
    // causal chain the whole flow is built on — the player must see where
    // the card came from. Outside the workspace the dealer is unchanged.
    originEl: props.embedded ? document.querySelector<HTMLElement>('.con-deckstack__pile') : null,
  });
}
/**
 * THE RESEARCH RISE (the flagship draft→research transition): when the
 * buy prompt arrives with the just-drafted pile still on the tray, the
 * deal launches in RISE mode — proxies start on the TRAY slots (the
 * auto-passed last card first ARRIVES from the deck, flipping), the
 * completed set pulses, then the whole pile flies into the research
 * row and the modal frame materializes around it. A missing/degenerate
 * tray (edge) falls back to the honest deck deal.
 */
function riseExtras(): RiseLaunchExtras | undefined {
  if (!riseSceneEngaged() || !isBuyMode.value || activeTask.value.kind !== 'cardSelect') {
    return undefined;
  }
  const cards = deal.value.state.cards;
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
    if (draftTrayState.sceneArrivals.includes(name)) {
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
}
/** P13/P15: X opens the focused card fullscreen (reused viewer). The
 *  select context lets A toggle the pick from fullscreen — disabled
 *  candidates stay readable but never pickable (toggle no-ops).
 *  PHYSICAL origin: the fullscreen card lifts out of / returns into the
 *  strip slot of the BROWSED card; the strip focus follows LB/RB. */
function zoomFocusedCard(): void {
  if (cardEntries.value.length === 0) {
    return;
  }
  const cards = cardEntries.value.map((e) => e.card);
  const origin = slotZoomOrigin(
    () => cardStrip.value ?? undefined,
    (i) => cards[i]?.name ?? '',
    (i) => {
      focusIdx.value = i;
      void nextTick(() => scrollFocusedIntoView());
    },
  );
  // A card-EVALUATION context (a draft pick / the research or reveal BUY —
  // both structural: the router's mode / the game phase) opts the viewer
  // into the availability panel via the ONE policy («пока не выполнено» /
  // «уже не выполнить»). A plain select/target pick maps to 'target-pick':
  // current playability is irrelevant to that decision, and the policy's
  // safe default keeps the panel away.
  const availability = availabilityContextFor(
    isBuyMode.value ? 'research-buy' : isDraftPick.value ? 'draft-pick' : 'target-pick');
  if (singlePick.value) {
    // PICK phase: A in the viewer COMMITS the card (the ACTION bridge —
    // executes AFTER the viewer closes, never a toggle) — parity with the
    // strip's single-press select, and with the desktop fullscreen "Select".
    openConsoleCardZoom(cards, focusIdx.value, undefined, {
      labelFor: (name) => (cardEntries.value.find((e) => e.card.name === name)?.disabled ? undefined : 'Select'),
      reasonsFor: (name) => {
        const e = cardEntries.value.find((entry) => entry.card.name === name);
        return e !== undefined && e.disabled && e.reason !== '' ? [e.reason] : [];
      },
      execute: (name) => commitSingleCard(name),
    }, {origin, availability});
    return;
  }
  // BUY / multi: A toggles the pick and the viewer STAYS open to browse.
  openConsoleCardZoom(cards, focusIdx.value, {
    isSelected: (name) => isPicked(name),
    toggle: (name) => toggleCardPickByName(name),
  }, undefined, {origin, availability});
}
/** Read-only browse of the already-drafted cards (LB/RB page, B closes) —
 *  no select/action bridge, so it can never re-submit a drafted card.
 *  Opened from the count chip (no card tiles on screen) → TEXTUAL. */
function openDraftedViewer(): void {
  if (draftedCards.value.length > 0) {
    // The viewer's OWN mid-draft cards are still being evaluated for
    // later ('drafted-review' → draft voice).
    openConsoleCardZoom([...draftedCards.value], 0, undefined, undefined,
      {origin: {kind: 'textual'}, availability: availabilityContextFor('drafted-review')});
  }
}
/**
 * Inspect the docked SOURCE card fullscreen — read-only (no select / action
 * bridge, so it can never submit the prompt). The card is a VISIBLE tile, so
 * it lifts physically out of its dock and dives back into it on close.
 * Reached by X on a CHOICE (there the card IS the subject) and by L3
 * everywhere else (there it is the source that produced the prompt); the
 * viewer NAMES that role, mirroring the drawn reveal's «ИСТОЧНИК ДОБОРА».
 */
/**
 * A candidate a PAYOUT is flying into (an enacted resolution's animals onto
 * the card just chosen) shows what has LANDED on it — its stored-resource
 * capsule ticks at the chip's contact, before the pick leaves the screen.
 * Every other candidate is the server's model, untouched.
 */
function landedCardOf(card: CardModel): CardModel {
  // A resolution's payout, or a live pick's own answer landing on the card just chosen (TR53 iteration).
  const landed = pickPayoutLandedOn(card.name) + promptReceiveLandedOn(card.name);
  return landed === 0 ? card : {...card, resources: (card.resources ?? 0) + landed};
}
function zoomSourceCard(): void {
  const name = sourceCardName.value;
  const resolution = sourceResolutionId.value;
  if (name === undefined && resolution === undefined) {
    return;
  }
  // A RESOLUTION source (Turmoil Redux) opens the resolution inspector —
  // its party column, its own rules, its standing — over the same
  // physical face the dock draws; a card source opens the card viewer.
  const entries = resolution !== undefined ? [resolutionZoomEntry(resolution)] : [{name: name as CardName}];
  openConsoleCardZoom(entries, 0, undefined, undefined, {
    statusLabel: 'Source',
    origin: {
      kind: 'physical',
      resolve: () => {
        // The dock is a COMPONENT — it hands its root over (`rootEl`).
        const dock = sourceCard.value ?? undefined;
        return dock?.rootEl?.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? null;
      },
    },
  });
}
/**
 * L3 (embedded, a resolution source): the resolution inspector, lifted out
 * of the host stage's own face; the pick under it never unmounts, so the
 * focused candidate survives the round trip.
 */
function zoomStageResolution(): void {
  const id = stageSourceResolution.value;
  if (id === undefined) {
    return;
  }
  openConsoleCardZoom([resolutionZoomEntry(id)], 0, undefined, undefined, {
    statusLabel: 'Source',
    origin: workspaceSourceZoomOrigin('resolution:' + id),
  });
}
/**
 * L3 (embedded): fullscreen the workspace SOURCE — the card whose action
 * produced this pick. Read-only (no select/action bridge), lifting
 * physically out of the workspace's standing hero slot and returning into
 * it on close; the pick stage itself is never unmounted, so the selection,
 * the cost math and the focused card all survive the round trip.
 */
function zoomWorkspaceSource(): void {
  const name = workspaceSourceCard.value;
  if (name === undefined) {
    return;
  }
  const card = props.playerView.thisPlayer.tableau.find((c) => c.name === name) ?? {name};
  openConsoleCardZoom([card as CardModel], 0, undefined, undefined, {
    contextLabel: 'Card actions',
    statusLabel: 'Source',
    // ONE resolver for every host that offers L3 Источник — the hero card
    // itself lifts out of the composer column (see the helper).
    origin: workspaceSourceZoomOrigin(String(name)),
  });
}
/**
 * Row jump in GRID mode — measured from the real DOM (offsetTop groups),
 * so it is robust to flex-wrap at any profile/width: pick the slot in
 * the adjacent row whose centre is nearest horizontally.
 */
function moveFocusRow(step: 1 | -1): void {
  const strip = cardStrip.value ?? undefined;
  if (strip === undefined || strip === null) {
    return;
  }
  const slots = Array.from(strip.children) as Array<HTMLElement>;
  const cur = slots[focusIdx.value];
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
  if (best !== -1 && best !== focusIdx.value) {
    focusIdx.value = best;
    armed.value = false;
    void nextTick(() => scrollFocusedIntoView());
  }
}
function onNav(dir: NavDirection): void {
  const vertical = dir === 'up' || dir === 'down';
  if (activeTask.value.kind === 'amount') {
    // The BINARY conversion renders as two vertical plates, so ↑/↓ walk
    // them too (the value IS the focus); ←/→ keep adjusting everywhere.
    const binaryRows = conversionVm.value?.binary === true;
    if (dir === 'left' || (binaryRows && dir === 'up')) {
      adjust(-1);
    }
    if (dir === 'right' || (binaryRows && dir === 'down')) {
      adjust(1);
    }
    return;
  }
  if (activeTask.value.kind === 'distribute' || activeTask.value.kind === 'payment' ||
      (activeTask.value.kind === 'projectCard' && pcStage.value === 'pay') ||
      (activeTask.value.kind === 'cardSelect' && buyPayStage.value)) {
    if (vertical) {
      moveFocus(dir === 'down' ? 1 : -1);
    } else {
      adjust(dir === 'right' ? 1 : -1);
    }
    return;
  }
  if (activeTask.value.kind === 'resource' || activeTask.value.kind === 'cardSelect' ||
      activeTask.value.kind === 'projectCard') {
    // Horizontal tile row / filmstrip; the P13 GRID adds row jumps.
    if (!vertical) {
      moveFocus(dir === 'right' ? 1 : -1);
    } else if ((activeTask.value.kind === 'cardSelect' && gridMode.value) ||
               (activeTask.value.kind === 'projectCard' && pcGrid.value)) {
      moveFocusRow(dir === 'down' ? 1 : -1);
    }
    return;
  }
  // choice / player: vertical rows. P58 · FS — the «ОЧЕРЁДНОСТЬ» step is ONE column, and every direction walks
  // it (the variant step's law — a direction that does nothing reads as a dropped input at couch distance).
  if (vertical || placementOrderVariant.value !== undefined) {
    moveFocus(dir === 'down' || dir === 'right' ? 1 : -1);
  }
}
function moveFocus(step: number): void {
  const n = focusCount.value;
  if (n === 0) {
    return;
  }
  const next = Math.min(n - 1, Math.max(0, focusIdx.value + step));
  if (next !== focusIdx.value) {
    focusIdx.value = next;
    armed.value = false;
    void nextTick(() => scrollFocusedIntoView());
  }
}
function scrollFocusedIntoView(): void {
  const bodyNow = body.value ?? undefined;
  const slot = focusedCardSlot.value ?? undefined;
  const cardEl = Array.isArray(slot) ? slot[0] : slot;
  if (cardEl !== undefined && cardEl !== null) {
    // The single ROW is fit-to-width (fitCardStrip) so it NEVER scrolls —
    // scrolling it on focus shifted the other cards AND churned the whole
    // strip every d-pad move (Steam Deck perf hit). Only GRID mode scrolls,
    // and only VERTICALLY to the focused row.
    if (gridMode.value) {
      const box = scrollContainerOf(cardEl, 'y');
      if (box !== undefined) {
        cursorEnsureVisible(box, cardEl, {axis: 'y'});
      }
    }
    return;
  }
  const focused = bodyNow?.querySelector('.con-task__option--focused, .con-task__palette .con-vchoice__opt--focused, .con-task__lane--focused, .con-payrow--focused');
  const box = focused === null || focused === undefined ? undefined : scrollContainerOf(focused, 'y');
  if (focused !== null && focused !== undefined && box !== undefined) {
    cursorEnsureVisible(box, focused, {axis: 'y'});
  }
}
/** rAF-coalesced fit for resize bursts (never fires per focus move). */
function scheduleFit(): void {
  if (fitScheduled.value) {
    return;
  }
  fitScheduled.value = true;
  flow.afterFrame('the card strip re-fits', () => {
    fitScheduled.value = false;
    fitCardStrip();
  });
}
/**
 * The vertical space the MODAL may occupy — the host's padded content
 * box. The host's CSS padding reserves the top HUD strip + the bottom
 * command-bar band (the WORK BAND), so measuring it keeps the fit and
 * the CSS `max-height: 100%` in exact agreement: the modal can never
 * outgrow the visible play area again. Fallback: the legacy 86vh
 * viewport budget (JSDOM / not laid out yet).
 */
function workBandHeight(): number {
  const host = root.value ?? undefined;
  if (host !== undefined && host !== null && host.clientHeight > 0) {
    const cs = window.getComputedStyle(host);
    const h = host.clientHeight - (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0);
    if (h > 0) {
      return h;
    }
  }
  return 0.86 * window.innerHeight;
}
/**
 * The modal's NON-STRIP vertical chrome, MEASURED: task paddings + the
 * header (title / draft subtext / the tall BUY economics rows) + the
 * always-mounted verdict bar (+ the .con-cards gap above it). The old
 * fixed `220 * s` estimate under-counted the buy header and never saw
 * the verdict bar at all (it mounted after the deal) — the two reasons
 * the modal could overrun the work band. Falls back to the estimate
 * when nothing is measurable (JSDOM / mid-teardown).
 */
function modalChromeHeight(strip: HTMLElement, s: number): number {
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
}
/** A one-shot re-fit AFTER the entry/deal cinematic settles (~360ms) —
 *  the safety net for the buy modal, whose first fit could race the wide
 *  panel / rise flight and leave small cards. Cheap + idempotent. */
function scheduleSettleFit(): void {
  cancelSettleFit();
  cancelSettleFit = flow.after(motionMs(380), 'the settle re-fit', () => {
    fitCardStrip();
  });
}
/**
 * Size the SINGLE-ROW card strip so N cards ALWAYS fit its width — the
 * strip then never overflows, so it never scrolls on focus and neighbours
 * never shift. Sets `--con-cards-zoom` (a layout `zoom` on each slot); the
 * focused card's `transform: scale` rides ON TOP (visual, no reflow). Runs
 * on mount / prompt / count / resize — NEVER per focus, so the per-d-pad
 * cost is zero (Steam Deck). Grid mode keeps its own wrapping zoom.
 */
function fitCardStrip(): void {
  // Vue 3 sets a template ref to `null` (not `undefined`) once its v-if'd
  // element unmounts — a queued `nextTick(fitCardStrip)` from a watcher can
  // fire AFTER the cardStrip left the DOM (task kind changed), so guard both.
  const strip = cardStrip.value ?? undefined;
  if (strip === undefined || strip === null) {
    return;
  }
  if (activeTask.value.kind !== 'cardSelect') {
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
  const grid = gridMode.value;
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
    if (fitRetries.value < 20) {
      fitRetries.value++;
      probeTick(() => fitCardStrip());
    }
    return;
  }
  fitRetries.value = 0;
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
  const availH = Math.max(200 * s, workBandHeight() - modalChromeHeight(strip, s) - padY);
  if (!grid) {
    if (props.embedded) {
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
}
// ── card browser helpers (T2) ────────────────────────────────────
function isPicked(name: CardName): boolean {
  return picks.value.includes(name);
}
function togglePick(): void {
  const entry = focusedCardEntry.value;
  if (entry === undefined || entry.disabled) {
    return; // a disabled candidate is readable, never pickable
  }
  toggleCardPickByName(entry.card.name);
}
/** P15: pure selection flip — shared by the strip AND the fullscreen
 *  viewer's A (picked → deselect, even single-pick; the hidden
 *  A-on-picked confirm is gone — Y is the one confirm). */
function toggleCardPickByName(name: CardName): void {
  const entry = cardEntries.value.find((e) => e.card.name === name);
  if (entry === undefined || entry.disabled) {
    return;
  }
  const at = picks.value.indexOf(name);
  if (at !== -1) {
    picks.value.splice(at, 1);
    return;
  }
  if (cardMax.value === 1) {
    picks.value = [name]; // single-slot: the new pick replaces
    return;
  }
  if (picks.value.length >= cardMax.value) {
    return; // slots full — the verdict bar explains (deselect first)
  }
  picks.value.push(name);
}
/** PICK phase (single card): select the focused card AND submit at once —
 *  no lingering "selected" state, no re-pick (desktop single-select parity). */
function commitFocusedCard(): void {
  const entry = focusedCardEntry.value;
  if (entry !== undefined && !entry.disabled) {
    commitSingleCard(entry.card.name);
  }
}
/** The live strip slot for a card (data-zoom-slot marker). */
function exitSlotFor(name: CardName): HTMLElement | null {
  const strip = cardStrip.value ?? undefined;
  if (strip === undefined || strip === null || typeof strip.querySelector !== 'function') {
    return null;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
  return strip.querySelector<HTMLElement>(`[data-zoom-slot="${esc}"]`);
}
function commitSingleCard(name: CardName): void {
  const entry = cardEntries.value.find((e) => e.card.name === name);
  if (entry === undefined || entry.disabled) {
    return;
  }
  const commit = () => {
    picks.value = [name];
    onConfirm();
  };
  // `picks` is still EMPTY here, so the live `confirmReady`
  // (= cardPicksValid, which needs picks.length ≥ cardMin) is false for
  // every min-1 prompt — it CANNOT gate this pick. Compute the would-be
  // validity of committing exactly [name] instead. Without this the
  // guard always fell through to the instant commit and the hero beat
  // (and the whole draft-tray transfer) never played — the modal just
  // swapped out with all cards, no flight.
  const wouldBeValid = cardMin.value <= 1 && cardMax.value >= 1 && cardBuyAffordable.value;
  if (submitting.value || !wouldBeValid) {
    commit(); // onConfirm self-guards
    return;
  }
  // A PAYOUT the console flies ONTO the chosen card (an enacted
  // resolution's resources — `consoleResolutionPayout`): the recipient
  // stays where it is, picked, while the chip lands on its capsule; the
  // hero departure below would carry it away before its payout arrives.
  if (payoutPickLandsInPlace(wf.value)) {
    commit();
    return;
  }
  // THE LIVE «ON WHICH CARD» PICK (`resourceGainPrompt` — an Ares adjacency, a cell's printed bonus, a foreign
  // trade's colony bonus, a card's gift): its answer is a SCENE, never a draft departure (TR53 iteration — the
  // owner's photo: the chosen card «tilts and falls off the bottom» and no resource ever flies). The chosen
  // candidate is SEALED IN PLACE, the others RECEDE, and the transport plays the resource landing on it and the
  // card going home (`cardReceive/promptReceive.ts`). `runHeroPick` / `con-exit-reject` are for a card that goes
  // INTO THE HAND (a draft, a buy) — never for a target.
  if (cardModel.value?.resourceGainPrompt !== undefined) {
    armPromptReceive(wf.value, name, {client: props.promptOverride !== undefined});
    commit();
    return;
  }
  const slot = exitSlotFor(name);
  if (slot === null) {
    commit();
    return;
  }
  const strip = cardStrip.value ?? undefined;
  const rejects = strip !== undefined && strip !== null ?
    (Array.from(strip.children) as Array<HTMLElement>).filter((el) => el !== slot && !el.classList.contains('con-deal-hold')) : [];
  // The hero beat reads FIRST; the rejects start tumbling under it.
  applyDiscardExit(rejects, {delayMs: 150});
  // THE DRAFT PICK BEAT (consoleDraftTray.ts): the chosen card is a HERO
  // that physically joins the drafted tray — the modal chrome dissolves
  // under it (`tableView`), the card lands ON the pile, and only then
  // does the next round / waiting state take the screen. Submit fires
  // at onLift — the game flow is never delayed behind the cinematic.
  if (isDraftPick.value) {
    runDraftPickBeat({picks: [{name, el: slot}], commit});
    return;
  }
  // Non-draft single pick (choose a target): the classic hero departure
  // to the player zone — there is no tray to land on.
  void runHeroPick({name, el: slot}, commit);
}
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
function confirmCardSetWithExit(): void {
  // PICK-THEN-PAY: RT on a purchase whose price the server WILL ask carries the picks into the payment — nothing is
  // sent and nothing leaves; the second press (A in the pay stage) answers both prompts in one batch.
  if (activeTask.value.kind === 'cardSelect' && buyPaysByPrompt.value && !buyPayStage.value &&
      picks.value.length > 0 && cardPicksValid.value && !submitting.value) {
    enterBuyPay();
    return;
  }
  if (activeTask.value.kind !== 'cardSelect' || singlePick.value || submitting.value || !confirmReady.value) {
    onConfirm(); // self-guarding fallback (also the 'not ready' path)
    return;
  }
  const commit = () => onConfirm();
  const strip = cardStrip.value ?? undefined;
  if (strip === undefined || strip === null) {
    commit();
    return;
  }
  const sources: Array<ExitSource> = picks.value
    .map((name) => ({name, el: exitSlotFor(name)}))
    .filter((s): s is {name: CardName, el: HTMLElement} => s.el !== null);
  const chosen = new Set(sources.map((s) => s.el));
  // A split reveal's COMPANIONS (P88) are neither picked nor rejected: the rule sent them to the
  // hand, so they leave WITH the answer in the same intake as the bought cards.
  const companions = companionExitSources();
  const companionEls = new Set(companions.map((c) => c.el));
  const rejects = (Array.from(strip.children) as Array<HTMLElement>)
    .filter((el) => !chosen.has(el) && !companionEls.has(el) && !el.classList.contains('con-deal-hold'));
  if (isDraftPick.value && sources.length > 0) {
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
    if (props.embedded) {
      const refused = (cardEntries.value ?? [])
        .map((e) => ({name: e.card.name, el: exitSlotFor(e.card.name) ?? undefined}))
        .filter((s) => s.el !== undefined);
      if (refused.length > 0 || companions.length > 0) {
        if (refused.length > 0) {
          void discardOpenCards(refused);
        }
        // The companions still go home — ONE intake, the same seam as a purchase (`onStaged`).
        if (companions.length > 0) {
          void runHandIntake(companions, {mode: 'stack', commit, onStaged: () => emit('result-detached')});
          return;
        }
        emit('result-detached');
        commit();
        return;
      }
    }
    applyDiscardExit(rejects);
    if (props.embedded) {
      emit('result-detached');
    }
    commit();
    return;
  }
  // AN UNBOUGHT CARD BESIDE A PURCHASE lands on the table's ONE discard pile too (TR52 — «СБРОС»
  // is an object of the table): embedded, these cards were turned over by the player's own action,
  // and a tumble into nowhere beside the bought card was a second truth of the same discard.
  if (props.embedded) {
    const refused = rejects
      .map((el) => ({name: (el.dataset.zoomSlot ?? '') as CardName, el}))
      .filter((r) => r.name !== '');
    if (refused.length > 0) {
      void discardOpenCards(refused);
    }
  } else {
    applyDiscardExit(rejects);
  }
  // THE PURCHASE HANDOFF. `onStaged` is the director's designed seam: it
  // fires the frame the proxies physically stand over the real cards, so
  // the host may drop its surface with nothing left to lose. Collapsing
  // THERE (rather than before, or after the flight) is what makes the two
  // overlap — the card lifts, the workspace folds under it, the dock comes
  // back, and only then does the intake's own slot polling find the REAL
  // geometry and finish the flight. Never a guessed target, never a pause.
  // ONE intake for everything that goes home — the bought cards and the companions, in the row's
  // order (= the reveal's): «one action — one intake».
  const home = companions.length === 0 ? sources : (Array.from(strip.children) as Array<HTMLElement>)
    .filter((el) => chosen.has(el) || companionEls.has(el))
    .map((el) => sources.find((s) => s.el === el) ?? companions.find((c) => c.el === el))
    .filter((s): s is ExitSource => s !== undefined);
  void runHandIntake(home.map((s) => ({name: s.name, el: s.el})), {
    mode: 'stack',
    commit,
    onStaged: props.embedded ? () => emit('result-detached') : undefined,
  });
}
function laneValue(unit: string): number {
  return (units.value as Record<string, number>)[unit] ?? 0;
}
/** A production is an INCOME rate — signed, so «+3 → +2» and a negative M€ income read alike everywhere. */
function signedProduction(n: number): string {
  return n >= 0 ? `+${n}` : `−${Math.abs(n)}`;
}
/**
 * The decision's COMMIT in its tone — the bar's half of the family's tone
 * markers. A LOSS is «Принять убыток» in the danger ink; a GAIN is
 * «Забрать» with the claimable glow once it is ready; a free choice keeps
 * its own verb. Embedded stages keep the workspace's verbs untouched.
 */
function tonedCommit(cmd: ConsoleCommand): ConsoleCommand {
  if (props.embedded) {
    return cmd;
  }
  if (tone.value === 'loss') {
    return {...cmd, label: promptCommitLabelKey('loss', cmd.label), tone: 'danger'};
  }
  if (tone.value === 'gain') {
    const generic = cmd.label === 'Select' || cmd.label === 'Confirm' || cmd.label === 'Save';
    return {...cmd, label: generic ? 'Collect' : cmd.label, highlight: cmd.enabled !== false};
  }
  return cmd;
}
/** Units the layout has put on `card` so far (distribute mode). */
function spreadOnCard(card: string): number {
  return spreadOn(spread.value, card);
}
/**
 * THE KIND `card` TAKES in the layout — the marker's per-card map (a layout over SEVERAL kinds: a data
 * holder takes data, a microbe holder microbes), else the layout's ONE kind. Never the step's list.
 */
function spreadResourceOf(card: string): string | undefined {
  const meta = spreadMeta.value;
  return meta === undefined ? undefined : (meta.cardResourceByCard?.[card as CardName] ?? meta.cardResource);
}
/** The counter band's icon on `card` — the kind that card takes (`spreadResourceOf`). */
function spreadIconClassOf(card: string): string {
  return iconClassFor(spreadResourceOf(card));
}
/**
 * THE LAYOUT'S GESTURES: LB / RB move one unit on the focused card, RT pours
 * everything left onto it. Bounded by the engine (never below 0, never past
 * what is left), so LB on zero and RB with nothing left are no-ops — and
 * neither is advertised as available by the bar's own enabled states.
 */
function spreadStepFocused(delta: number): void {
  const entry = focusedCardEntry.value;
  if (entry === undefined || entry.disabled) {
    return;
  }
  spread.value = stepSpread(spread.value, entry.card.name, delta, spreadAmount.value);
}
function spreadPourFocused(): void {
  const entry = focusedCardEntry.value;
  if (entry === undefined || entry.disabled) {
    return;
  }
  spread.value = pourRemaining(spread.value, entry.card.name, spreadAmount.value);
}
/**
 * A on the layout: SEND ONLY A COMPLETE LAYOUT. The check stands in the
 * handler itself — not only on the bar's disabled verb — so a press that
 * arrives with units left to place does nothing: no submit, no nudge, no
 * transition. The response builder refuses an incomplete layout once more.
 */
function spreadCommit(): void {
  if (!spreadReady.value) {
    return;
  }
  onConfirm();
}
/** The single-step gesture: put the one unit on this lane, or take it back. */
function distToggleFocused(): void {
  if (submitting.value) {
    return; // commit lock — see adjust()
  }
  const lane = lanes.value[focusIdx.value];
  if (lane !== undefined) {
    units.value = {...toggleSoleStep(lanes.value, units.value as BudgetState, distRule.value, lane.key)};
  }
}
function adjust(step: number): void {
  adjustOf(port, step);
}
function maxOut(): void {
  if (submitting.value) {
    return; // commit lock — see adjust()
  }
  if (activeTask.value.kind === 'cardSelect' && isSpreadMode.value) {
    spreadPourFocused();
    return;
  }
  if (activeTask.value.kind === 'amount') {
    value.value = amountMax.value;
    return;
  }
  if (activeTask.value.kind === 'distribute') {
    const lane = lanes.value[focusIdx.value];
    if (lane === undefined) {
      return;
    }
    const next = distSingleStep.value ?
      stepLane(lanes.value, {}, distRule.value, lane.key, 1) :
      maxOntoLane(lanes.value, units.value as BudgetState, distRule.value, lane.key);
    units.value = {...next};
    return;
  }
  if (activeTask.value.kind === 'payment') {
    const lane = payLanes.value[focusIdx.value];
    if (lane === undefined) {
      return;
    }
    // MAX = as much of THIS source as is still useful once the others are
    // counted — never «enough to cover the whole price alone».
    payCounts.value = {...payCounts.value, [lane.unit]: dialLaneCount(paymentCost.value, lane, payLanes.value, payCounts.value, 'max')};
    payFlashNonce.value += 1;
    return;
  }
  if (activeTask.value.kind === 'projectCard' && pcStage.value === 'pay') {
    const lane = pcLanes.value[focusIdx.value];
    if (lane === undefined) {
      return;
    }
    payCounts.value = {...payCounts.value, [lane.unit]: dialLaneCount(pcCost.value, lane, pcLanes.value, payCounts.value, 'max')};
    payFlashNonce.value += 1;
    return;
  }
  if (activeTask.value.kind === 'cardSelect' && buyPayStage.value) {
    const lane = buyPayLanes.value[focusIdx.value];
    if (lane === undefined) {
      return;
    }
    payCounts.value = {...payCounts.value, [lane.unit]: dialLaneCount(buyTotal.value, lane, buyPayLanes.value, payCounts.value, 'max')};
    payFlashNonce.value += 1;
  }
}
// Foundation: SEMANTIC actions — LB/RB(prev/nextSection) adjust,
// RT(nextTab) multi-commit/max, A(primary) act, X(inspect) zoom/confirm,
// B(back) exit-nested/defer.
function onPress(action: ConsoleAction): void {
  switch (action) {
  case 'prevSection':
    adjust(-1);
    return;
  case 'nextSection':
    adjust(1);
    return;
  case 'nextTab':
    // An optional choice's DECLINE — wherever RT has no other job on the standing surface.
    if (declineOnRt.value) {
      submitDecline();
      return;
    }
    // CARD context: RT is the MULTI (buy / multi-target) commit. In the
    // single-keep DRAFT (where RT would otherwise be inert) RT opens the
    // read-only drafted-cards viewer instead. In the LAYOUT it pours
    // everything left onto the focused card (the amount grammar's MAX).
    if (activeTask.value.kind === 'cardSelect') {
      if (buyPayStage.value) {
        maxOut(); // the payment contract: RT = MAX of the focused source
        return;
      }
      if (isSpreadMode.value) {
        spreadPourFocused();
      } else if (canInspectDrafted.value) {
        openDraftedViewer();
      } else if (!singlePick.value) {
        confirmCardSetWithExit();
      }
      return;
    }
    maxOut();
    return;
  case 'primary':
    onPrimary();
    return;
  case 'inspect':
    // P13 global rule: X opens the focused card FULLSCREEN in every
    // card context; elsewhere it stays the one-press confirm.
    if (activeTask.value.kind === 'cardSelect') {
      // The pay stage speaks the payment contract: X pays (A too).
      if (buyPayStage.value) {
        confirmCardSetWithExit();
        return;
      }
      zoomFocusedCard();
      return;
    }
    if (activeTask.value.kind === 'projectCard') {
      // Pick stage: inspect the focused candidate; pay stage: the picked
      // card (the one thing the payment is about).
      pcZoom();
      return;
    }
    // CONTEXTUAL CHOICE: A already commits, so X is free for the console-wide
    // INSPECT verb — the docked SOURCE card fullscreen (the card that caused
    // this choice). Without a source card X stays a harmless confirm alias,
    // and a GENERIC OrOptions keeps X as its real commit.
    if (choiceOnePress.value && sourceInspectable.value) {
      zoomSourceCard();
      return;
    }
    onConfirm();
    return;
  case 'back':
    // T9: inside a nested step B returns to the branch list, never defers — unless the choice opened ON that step
    // (there is no list above it): then B is the decision's own minimize.
    if (nested.value !== undefined && !nestedIsDirect.value) {
      exitNested();
      return;
    }
    // projectCard pay stage: B is ONE logical level — back to the pick
    // (nothing has been committed), never straight to a defer.
    if (activeTask.value.kind === 'projectCard' && pcStage.value === 'pay') {
      pcBackToPick();
      return;
    }
    // The purchase's pay stage: B is ONE level — back to the picks, nothing sent.
    if (activeTask.value.kind === 'cardSelect' && buyPayStage.value) {
      buyBackToPick();
      return;
    }
    emit('defer');
    return;
  default:
    return;
  }
}
/** A: select/arm the focused element; A on the armed one = confirm. */
function onPrimary(): void {
  // SINGLE-STEP distribute: A is the radio gesture (place the unit here /
  // take it back) — the commit lives on X alone, so one press can never
  // both choose a lane and submit the choice.
  if (activeTask.value.kind === 'distribute' && distSingleStep.value) {
    distToggleFocused();
    return;
  }
  if (activeTask.value.kind === 'amount' || activeTask.value.kind === 'distribute' || activeTask.value.kind === 'payment') {
    onConfirm();
    return;
  }
  if (activeTask.value.kind === 'projectCard') {
    if (pcStage.value === 'pick') {
      pcSelectFocused();
    } else {
      onConfirm();
    }
    return;
  }
  if (activeTask.value.kind === 'cardSelect') {
    if (isSpreadMode.value) {
      spreadCommit(); // LAYOUT: A sends a COMPLETE layout, and nothing else
    } else if (buyPayStage.value) {
      confirmCardSetWithExit(); // the purchase's payment: A pays
    } else if (singlePick.value) {
      commitFocusedCard(); // PICK phase: A selects + submits at once
    } else {
      togglePick(); // BUY / multi: A toggles; RT commits
    }
    return;
  }
  if (wf.value?.type === 'option') {
    onConfirm(); // bare confirm — a single A is enough
    return;
  }
  // CONTEXTUAL CHOICE: picking a listed option IS the decision, so A commits
  // it in ONE press (see `choiceOnePress` for the desktop parity this
  // mirrors). `onConfirm` still arms a RISKY option (tradeoff / warning)
  // first, so an irreversible branch keeps its «нажмите ещё раз». Every
  // other kind — a GENERIC OrOptions, `player`, `resource` — keeps the
  // arm-then-confirm two-step its desktop twin also demands.
  if (choiceOnePress.value) {
    onConfirm();
    return;
  }
  if (armed.value) {
    onConfirm();
  } else {
    armed.value = true;
  }
}
/** P58 · FS — a click / tap on an order row: the row's option focused and answered (one press). */
function onPlacementOrderPick(rowIndex: number): void {
  const row = placementOrderVariant.value?.rows[rowIndex];
  const entry = row === undefined ? -1 : choiceEntries.value.findIndex((e) => e.index === row.branchIndex);
  if (entry < 0) {
    return;
  }
  focusIdx.value = entry;
  onConfirm();
}
/** X: one-press confirm of the focused selection (risky arms first). */
function onConfirm(): void {
  if (!confirmReady.value) {
    return;
  }
  switch (activeTask.value.kind) {
  case 'choice': {
    if (wf.value?.type === 'option') {
      submitResponse( optionConfirmResponse());
      return;
    }
    const entry = choiceEntries.value[focusIdx.value];
    if (entry === undefined) {
      return;
    }
    if (entry.risky && !armed.value) {
      armed.value = true; // risky: X arms first, second press confirms
      return;
    }
    if (entry.isSpace) {
      // Nested board pick — the shell hosts the headless SelectSpace
      // and wraps the space response into this option's OR index.
      emit('space-pick', {index: entry.index, spacePrompt: entry.option});
      return;
    }
    if (entry.isNested) {
      // A nested pick whose candidates are ALL IN HAND is never a flat grid
      // inside this modal: it rides the real hand overlay, exactly like a
      // top-level in-hand prompt and like a composer's hand pick. That is
      // what makes Mars University's "discard a card to draw a card" the
      // SAME experience as every other discard instead of a third one.
      const handPick = entry.option.type === 'card' &&
        isHandCardSelection(entry.option, handNames.value) ? entry.option : undefined;
      if (handPick !== undefined) {
        // The choice's refusal rides into the album (RT + the plate there too).
        emit('hand-pick', {index: entry.index, cardPrompt: handPick, decline: taskDecline.value});
        return;
      }
      // T9: OPEN the nested input as a one-level wizard step — its
      // submit is wrapped into this option's OR index; B returns here.
      nested.value = {index: entry.index, input: entry.option};
      return;
    }
    submitResponse(orOptionResponse(entry.index));
    return;
  }
  case 'player': {
    const p = playerEntries.value[focusIdx.value];
    if (p !== undefined) {
      submitResponse( playerResponse(p.color));
    }
    return;
  }
  case 'amount':
    // The 'delta' flavor serves BOTH Hydronetwork shapes on divergence:
    // the move stepper answers the move step; the reward-only claim
    // answers with its own positioned response.
    submitResponse( activeTask.value.flavor === 'delta' ?
      (wf.value?.type === 'deltaStageReward' ?
        {type: 'deltaStageReward' as const, position: value.value} :
        deltaProjectResponse(value.value)) :
      amountResponse(value.value));
    return;
  case 'resource': {
    const unit = resourceUnits.value[focusIdx.value];
    if (unit !== undefined) {
      submitResponse( resourceResponse(unit));
    }
    return;
  }
  case 'distribute':
    submitResponse( activeTask.value.mode === 'production' ?
      productionToLoseResponse(units.value) : resourcesResponse(units.value));
    return;
  case 'cardSelect': {
    const spreadNow = spreadMeta.value;
    if (spreadNow !== undefined) {
      // THE LAYOUT — one amount per candidate in the server's own card
      // order; the builder yields nothing for any sum but N, so an
      // incomplete layout never reaches the transport whatever pressed.
      const response = cardResourceDistributionResponse(spreadNow.cards.map((c) => c.name), spread.value, spreadNow.amount);
      if (response === undefined) {
        return;
      }
      submitResponse(response);
      clearCardBrowserPicks();
      return;
    }
    // PICK-THEN-PAY: the purchase and its payment answered in ONE batch.
    if (buyPayStage.value) {
      submitBuyBatch();
      clearCardBrowserPicks();
      return;
    }
    // Byte-parity: the bare top-level {type:'card', cards} the desktop
    // CardSelectionContent / hand-select flow POSTs.
    submitResponse( cardsResponse(picks.value));
    // The pick is committed — drop the defer-durable copy so it can never
    // rehydrate a later same-key prompt.
    clearCardBrowserPicks();
    return;
  }
  case 'payment':
    submitResponse( paymentResponse(
      paymentFromCounts(paymentCost.value, payLanes.value, payCounts.value, megacreditsOnHand.value)));
    return;
  case 'projectCard': {
    if (pcStage.value === 'pick') {
      pcSelectFocused();
      return;
    }
    const card = pcPick.value;
    if (card === undefined) {
      return;
    }
    // Byte-parity with the desktop SelectProjectCardToPlay submit.
    submitResponse(projectCardResponse(
      card, paymentFromCounts(pcCost.value, pcLanes.value, payCounts.value, megacreditsOnHand.value)));
    return;
  }
  default:
    return;
  }
}
// ── projectCard (generic) stage moves ────────────────────────────
/** A on a candidate: carry it into the PAY stage (nothing submitted). */
function pcSelectFocused(): void {
  const entry = pcEntries.value[focusIdx.value];
  if (entry === undefined || entry.disabled) {
    return;
  }
  pcPick.value = entry.card.name;
  pcStage.value = 'pay';
  // The payment opens on the same optimal default mix every payment
  // surface seeds (initialCounts) — M€ auto-derives.
  payCounts.value = initialCounts(pcCost.value, pcLanes.value, megacreditsOnHand.value);
  focusIdx.value = 0;
  armed.value = false;
}
/** B from PAY: one logical level back — the pick survives as the cursor. */
function pcBackToPick(): void {
  const backTo = pcEntries.value.findIndex((e) => e.card.name === pcPick.value);
  pcStage.value = 'pick';
  pcPick.value = undefined;
  payCounts.value = {};
  focusIdx.value = backTo !== -1 ? backTo : 0;
  armed.value = false;
}
/** PICK-THEN-PAY: RT carries the picks into the payment (the same optimal default mix every payment opens on). */
function enterBuyPay(): void {
  buyStage.value = 'pay';
  payCounts.value = initialCounts(buyTotal.value, buyPayLanes.value, megacreditsOnHand.value);
  focusIdx.value = 0;
  armed.value = false;
}
/** B from the purchase's payment: one level back — the picks survive, the cursor on the first of them. */
function buyBackToPick(): void {
  const backTo = cardEntries.value.findIndex((e) => picks.value.includes(e.card.name as CardName));
  buyStage.value = 'pick';
  payCounts.value = {};
  focusIdx.value = backTo !== -1 ? backTo : 0;
  armed.value = false;
}
function submitBuyBatch(): void {
  submitBuyBatchOf(port);
}
/** X: fullscreen-inspect the stage's card (candidate / the picked one). */
function pcZoom(): void {
  if (pcStage.value === 'pay') {
    const card = pcPicked.value;
    if (card !== undefined) {
      openConsoleCardZoom([card], 0);
    }
    return;
  }
  const cards = pcEntries.value.map((e) => e.card);
  if (cards.length === 0) {
    return;
  }
  const origin = slotZoomOrigin(
    () => cardStrip.value ?? undefined,
    (i) => cards[i]?.name ?? '',
    (i) => {
      focusIdx.value = i;
      void nextTick(() => scrollFocusedIntoView());
    },
  );
  // A in the viewer carries the candidate into the PAY stage — the same
  // ACTION bridge the card browser's pick phase uses. This IS a play-now
  // decision ('project-play'): usually every candidate is playable and
  // the panel stays silent, but a candidate the server sent with reasons
  // gets the honest play-voice verdict.
  openConsoleCardZoom(cards, focusIdx.value, undefined, {
    labelFor: (name) => (pcEntries.value.find((e) => e.card.name === name)?.disabled ? undefined : 'Select'),
    reasonsFor: (name) => {
      const e = pcEntries.value.find((x) => x.card.name === name);
      return e !== undefined && e.disabled && e.reason !== '' ? [e.reason] : [];
    },
    execute: (name) => {
      const i = pcEntries.value.findIndex((e) => e.card.name === name);
      if (i !== -1) {
        focusIdx.value = i;
        pcSelectFocused();
      }
    },
  }, {origin, availability: availabilityContextFor('project-play')});
}
/** RT — the optional choice's refusal, answered at the TOP level (never wrapped into an open wizard step). */
function submitDecline(): void {
  const decline = taskDecline.value;
  if (decline === undefined || submitting.value) {
    return;
  }
  submitting.value = true;
  if (props.embedded) {
    emit('result-detached');
  }
  emit('submit', orOptionResponse(decline.index));
}
/** T9: back from a nested step to the branch list (nothing submitted). */
function exitNested(): void {
  nested.value = undefined;
}
/**
 * ALL submits route here: a nested step's response is WRAPPED into its
 * OR index (`{type:'or', index, response}` — byte-identical to the
 * desktop ModernOptionPicker's nestedSave); a top-level response
 * passes through unchanged.
 */
function submitResponse(response: unknown): void {
  if (submitting.value) {
    return; // guard rapid double-presses — no duplicate action (req §8)
  }
  submitting.value = true;
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
  if (props.embedded) {
    emit('result-detached');
  }
  if (nested.value !== undefined) {
    emit('submit', orWrappedResponse(nested.value.index, response));
    return;
  }
  emit('submit', response);
}

// Hand the stage's NAME up to the workspace breadcrumb while embedded, so
// «ДЕЙСТВИЯ КАРТ › ПОКУПКА · Коммерческая сеть» is one continuous line
// instead of a detached «◈ ПОКУПКА» floating inside someone else's frame.
// Retracted the moment we stop being embedded.
watch(() => embeddedPhase.value, (key: string) => {
  setWorkspaceOutcomePhase(key);
}, {immediate: true});
// The purchase's pay stage takes the status rail's room under the strip: the row re-fits to what is left.
watch(() => buyStage.value, (): void => {
  void nextTick(() => fitCardStrip());
});
watch(() => resetKey.value, () => {
  resetState();
  // Pre-flush: arm the deal HOLD before the new frame paints (the
  // real cards mount hidden — zero first-frame flash).
  prepareDeal();
  // Re-fit the single-row card strip for the new prompt (after render),
  // then AGAIN after the entry/deal cinematic settles — the first fit
  // can race a transitional layout (the wide panel / the rise flight),
  // leaving small cards; the delayed re-fit lands the final size.
  void nextTick(() => fitCardStrip());
  scheduleSettleFit();
}, {immediate: true});
/** A genuinely NEW server prompt discards an open nested step — or opens the one it IS (`directNestedOf`). */
watch(() => baseKey.value, () => {
  nested.value = directNested.value;
});
/** Every server response (root identity always changes) re-arms submission —
 *  robust against a same-key prompt re-send that the taskKey watcher misses. */
watch(() => props.playerView, () => {
  submitting.value = false;
});
/** The draft-beat safety recovered a stalled/failed pick submit: bring
 *  the round back — un-reject the tumbled slots, release the pick-beat
 *  source hold, re-arm submission (the transport's alert explains). */
watch(() => draftTrayState.recoverNonce, () => {
  submitting.value = false;
  const strip = cardStrip.value ?? undefined;
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
});
/** The deal finished (or was skipped BEFORE launch) while the rise scene
 *  was engaged — finalize the handoff so the tray never lingers. */
watch(() => deal.value.state.active, (active: boolean) => {
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
    void nextTick(() => fitCardStrip());
  }
});
/** Card count or grid↔row transition changes the fit (never per focus). */
watch(() => focusCount.value, () => {
  void nextTick(() => fitCardStrip());
});
watch(() => gridMode.value, () => {
  void nextTick(() => fitCardStrip());
});
/** Persist card-browser picks so a minimize→restore keeps the selection. */
watch(() => picks.value, (picks: ReadonlyArray<CardName>) => {
  // The layout mode keeps no picks — its own watcher below owns the store.
  if (activeTask.value.kind === 'cardSelect' && !isSpreadMode.value) {
    rememberCardBrowserPicks(resetKey.value, picks);
  }
}, {deep: true});
/** …and the LAYOUT the same way: a minimize → restore comes back to the same counters. */
watch(() => spread.value, (state: SpreadState) => {
  if (isSpreadMode.value) {
    rememberCardBrowserPicks(spreadStoreKey.value, spreadToPicks(state));
  }
}, {deep: true});
/** Publish the CONTEXTUAL command contract to the shell's ONE bottom
 *  command bar (consolePanelUi) — hints live only there, never in a
 *  panel-local footer (CONSOLE_TV_PREMIUM_PLAN §3.2). */
watch(() => footCommands.value, (cmds: ReadonlyArray<ConsoleCommand>) => {
  setPanelCommands('taskHost', cmds);
}, {immediate: true, deep: true});
/** While a conversion prompt is live, the player rail marks the two stock
 *  rows the decision is about (a delicate focus, values untouched). */
watch(() => conversionWatchKey.value, (key: string) => {
  if (key === '') {
    clearConversionPromptWatch();
    return;
  }
  const [from, to] = key.split('|');
  setConversionPromptWatch(from ?? '', to ?? '');
}, {immediate: true});

onMounted(() => {
  void nextTick(() => fitCardStrip());
  // Foundation: VueUse-managed listeners (no raw add/removeEventListener).
  stopStripObs = useResizeObserver(root.value as HTMLElement, () => scheduleFit()).stop;
  stopResize = useEventListener(window, 'resize', scheduleFit);
  // The batch arrival absorbs every verb (see `handleIntent`): the gate's live predicate, for a driver that was
  // told its press was absorbed and waits for exactly this to open.
  absorbOff = registerInputAbsorber(TASK_HOST_ARRIVAL_ABSORBER, () => arrivalPending.value, {scope: 'all'});
});
onBeforeUnmount(() => {
  absorbOff?.();
  clearPanelCommands('taskHost');
  // Same rule as the panel commands: watchers do not fire on unmount, so the
  // rail's conversion focus is retracted explicitly (idempotent).
  clearConversionPromptWatch();
  // The watcher does not fire on unmount — retract the published stage name
  // explicitly, or the workspace breadcrumb keeps announcing a step that is
  // no longer on screen.
  if (props.embedded) {
    setWorkspaceOutcomePhase('');
  }
  stopStripObs?.();
  stopResize?.();
  deal.value.dispose();
  // An engaged rise scene can't outlive its frame — hand the tray off
  // (the watcher may not flush during teardown).
  if (riseSceneEngaged()) {
    finishRiseScene();
  }
});
defineExpose({handleIntent});
</script>

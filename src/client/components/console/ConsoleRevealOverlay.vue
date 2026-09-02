<template>
  <!-- data-motion-*: the surface-motion contract — the dim is the shared
       `.con-shade`; the card frame is the animated panel. The VARIANT gates
       the director: 'headless' renders nothing (no shade, no motion),
       'drawn' is choreographed by its own draw cinematic (shade only). A
       'result' entry that follows a composer's confirm plays the PHASE
       continuation — the source card FLIPs from the composer's slot into
       the «Источник» column below. -->
  <div ref="rootEl" class="con-reveal"
       :class="{
         'con-reveal--headless': headless,
         'con-reveal--embedded': embedded,
         'con-reveal--collecting': collecting,
         'con-reveal--bonus-mode': bonusMode,
         'con-reveal--bonus-veiled': bonusVeiled,
         'con-reveal--bonus-held': bonusHeld,
       }"
       :role="embedded ? 'group' : 'dialog'" :aria-label="titleText"
       :data-motion-surface="embedded ? undefined : 'reveal'"
       :data-motion-variant="embedded ? undefined : (headless ? 'headless' : mode)">
    <!--
      SINGLE-CARD drawn reveal is HEADLESS: the received card IS the reveal,
      shown DIRECTLY in the fullscreen viewer (auto-opened). Nothing renders
      here (the dialog owns the backdrop + the whole presentation); this
      invisible, non-blocking root keeps the reveal a registered serving
      surface and hosts the auto-open lifecycle. Multi-card / result / viewer
      render the modal frame below.
    -->
    <template v-if="!headless">
      <transition name="con-task-swap" mode="out-in">
        <div class="con-reveal__card" :key="revealKey" data-motion-panel
             :class="{'con-reveal__card--drawn': mode === 'drawn', 'con-ws-stage-frame': embedded}">
          <!-- ── Header ──────────────────────────────────────────────────
               EMBEDDED follows the SAME rule as the embedded task host: the
               KICKER goes UP into the workspace breadcrumb (it would repeat
               it), but the TITLE stays — «Получена карта» is the stage's own
               sentence, and without it the draw read as a bare card floating
               in an empty column while the buy case next door had a proper
               heading. The source chip goes: it points at the hero standing
               beside it. -->
          <!-- EMBEDDED: the SHARED stage header component — the title and the
               live state on ONE row. Two separate rows (heading, then a
               «ПОЛУЧЕНО N» strip) cost the result stage a whole band of
               height for two short strings, and the cards paid for it in size.
               Byte-identical to the buy stage's heading by construction: it is
               the same component, not a matching rule set. -->
          <!-- EMBEDDED RESULT has NO head at all: the workspace breadcrumb
               already says «… › РЕЗУЛЬТАТ ВСКРЫТИЯ» (this surface hands that
               name UP — see the `embedded` watcher), and the only sentence a
               head could add is the acting card's name, which the labelled
               «ИСТОЧНИК» column below states as an object rather than as a
               title. A stage that titles itself inside someone else's frame is
               exactly how an embedded surface starts reading as a modal. -->
          <ConsoleWsStageHead v-if="embedded && mode !== 'result'"
                              class="con-reveal__head con-reveal__head--embedded"
                              :title="titleText">
            <template v-if="mode === 'drawn' && drawnEvent !== undefined && drawnEvent.cards.length > 1" #badges>
              <span class="con-ws-stage-badge">
                <span class="con-ws-stage-badge__icon resource_icon resource_icon--cards" aria-hidden="true"></span>
                <span class="con-ws-stage-badge__label">{{ $t('Received') }}</span>
                <b class="con-ws-stage-badge__num">{{ drawnEvent.cards.length }}</b>
              </span>
            </template>
          </ConsoleWsStageHead>
          <header v-else-if="!embedded" class="con-reveal__head">
            <div class="con-task__kicker">
              <span class="con-task__kicker-mark" aria-hidden="true">◈</span>
              <span>{{ $t(kickerText) }}</span>
            </div>
            <div class="con-reveal__headrow">
              <div class="con-reveal__headmain">
                <div class="con-reveal__title">{{ titleText }}</div>
                <div v-if="mode === 'drawn'" class="con-reveal__subtitle">
                  {{ $t('Cards were added from a draw source.') }}
                </div>
                <!--
                  Compact SOURCE chip — a navigation-context metadata element,
                  NEVER a second full card competing with the received cards.
                  An inspectable (card) source is a button (L3 opens it); a
                  colony / tile source is a plain informational chip.
                -->
                <button v-if="mode === 'drawn' && sourceChip !== undefined"
                        type="button"
                        class="con-reveal__source-chip"
                        :class="{'con-reveal__source-chip--inspectable': sourceChip.inspectable}"
                        :disabled="!sourceChip.inspectable"
                        @click="zoomSource">
                  <span class="con-reveal__source-chip-mark" aria-hidden="true">◈</span>
                  <span class="con-reveal__source-chip-label">{{ $t('Source') }}</span>
                  <span class="con-reveal__source-chip-sep" aria-hidden="true">·</span>
                  <span class="con-reveal__source-chip-name">{{ sourceChip.name }}</span>
                  <span v-if="sourceChip.inspectable" class="con-reveal__source-chip-l3">
                    <GamepadGlyph control="stickL" />
                  </span>
                </button>
              </div>
              <!-- Compact premium count chip (NEVER a full-width strip). -->
              <div v-if="mode === 'drawn' && drawnEvent !== undefined" class="con-reveal__count">
                <span class="con-reveal__count-icon resource_icon resource_icon--cards" aria-hidden="true"></span>
                <span class="con-reveal__count-label">{{ $t('Received') }}</span>
                <b class="con-reveal__count-num">{{ drawnEvent.cards.length }}</b>
              </div>
              <div v-else-if="mode === 'viewer' && viewerReveal !== undefined" class="con-reveal__meta">
                <span v-if="viewerActor !== undefined" class="con-task__opt-player">
                  <span :class="'con-status__dot player_bg_color_' + viewerActor.color"></span>
                  <span>{{ viewerActor.name }}</span>
                </span>
                <span class="con-reveal__chip">{{ viewerReveal.cards.length }} {{ $t('cards') }}</span>
                <span class="con-reveal__chip">{{ $t(viewerOriginLabel) }}</span>
                <span class="con-reveal__chip">{{ $t(viewerResultLabel) }}</span>
              </div>
            </div>
          </header>

          <!-- ── DRAWN: take the received cards (source is the header chip) ── -->
          <div v-if="mode === 'drawn' && drawnEvent !== undefined" class="con-reveal__body con-reveal__body--drawn con-info__scroll">
            <div class="con-reveal__main">
              <!--
                A TransitionGroup, so taking a card never SNAPS the row: the
                survivors FLIP to their new centred positions on transform
                only (`--shift-move`), and the taken card leaves the flow at
                once — its hand-intake proxy is already carrying it away, so a
                leave animation here would be a second copy of the same card.
                Applies to every reveal, not just the colony bonus.
              -->
              <transition-group tag="div" name="con-reveal-shift"
                   class="con-cards__strip con-reveal__strip"
                   :class="[stripCountClass, {'con-cards__strip--has-focus': drawnUntaken.length > 1,
                            'con-ws-stage-row': embedded}]"
                   :style="stripZoomStyle">
                <!-- The trade-income cards (or the whole batch when it isn't
                     a merged colony trade). Focus/take order is UNCHANGED —
                     `pos` is the card's logical strip position. EMBEDDED MULTI
                     renders the WHOLE batch (taken cards stay in their slots
                     as face-down backs — see stripEntries), so the row never
                     re-flows while the player works through it. -->
                <div v-for="entry in stripEntries" :key="entry.card.name + '#' + entry.index"
                     class="con-cards__slot con-start__deal"
                     :style="dealDelay(entry.pos)"
                     :data-zoom-slot="entry.card.name + '#' + entry.index"
                     :class="{'con-cards__slot--focused': !entry.taken && focusIdx === entry.pos && !arrivalPending,
                              'con-cards__slot--taken': entry.taken}"
                     :ref="!entry.taken && focusIdx === entry.pos ? 'focusedCardSlot' : undefined">
                  <!-- TAKE-IN-PLACE (embedded multi): the slot is a flip
                       chassis — A presses the card down and turns it face-down
                       IN ITS SLOT (the hand dock is unreachable while the
                       workspace is up); the whole batch flies to the hand as
                       ONE stack when the last card is taken. The bonus-zone
                       chassis classes carry the 3D; only the turn direction
                       (face → back) and the taken rest state are new. -->
                  <div v-if="embeddedMulti" class="con-reveal__flip con-reveal__takeflip"
                       :class="{'con-reveal__takeflip--taking': takingIdx === entry.index,
                                'con-reveal__takeflip--taken': entry.taken && takingIdx !== entry.index}"
                       @animationend="onTakeFlipEnd(entry.index, $event)">
                    <div class="con-reveal__flip-face">
                      <Card :card="entry.card" :key="entry.card.name" lightweight />
                    </div>
                    <div class="con-reveal__flip-back" aria-hidden="true">
                      <span class="con-card-back"></span>
                    </div>
                  </div>
                  <Card v-else :card="entry.card" :key="entry.card.name" lightweight />
                  <!-- Sibling of the flip, NOT inside it (a child would render
                       mirrored through the 180° turn). Absolute → zero layout. -->
                  <div v-if="entry.taken" class="con-reveal__takenmark">
                    <span class="con-reveal__takenmark-check">✓</span>
                    <span class="con-reveal__takenmark-text">{{ $t('Taken') }}</span>
                  </div>
                  <!-- EMBEDDED: no per-card command pill — the ONE bottom bar
                       owns every verb (the same rule as the buy status line). -->
                  <div v-if="!entry.taken && focusIdx === entry.pos && !embedded" class="con-start__slot-a">
                    <GamepadGlyph control="confirm" /><span>{{ $t('Take card') }}</span>
                  </div>
                </div>
                <!--
                  ONE ZONE PER COLONY. By the rules each colony resolves
                  separately and in full — draw 1, discard 1 — so the sequence
                  is laid out as a table: exactly one zone is ACTIVE, earlier
                  ones carry a calm completion mark, and later ones show a
                  face-down placeholder (their card is not drawn yet — the
                  server only draws it once this one is finished).
                -->
                <div v-for="zone in bonusZones" :key="'zone' + zone.index"
                     class="con-reveal__bonus-zone"
                     :class="'con-reveal__bonus-zone--' + zone.state">
                  <span class="con-reveal__bonus-zone-label">
                    {{ $t('Colony bonus') }}
                    <b v-if="zone.total > 1">{{ zone.index }}/{{ zone.total }}</b>
                  </span>

                  <!-- ACTIVE: the real card, exactly as the strip renders one.
                       IT ARRIVES ALREADY OPEN — the cover that carried it here
                       turned in the air like every other card of the payout, so
                       there is nothing left for this zone to reveal. It used to
                       hold its own face-down flip chassis, and that produced
                       both reported faults at once: the zone painted a card
                       BACK from the moment it mounted (so while the cover was
                       still airborne there were two backs for one card), and
                       the landed card then played a SECOND, different turn
                       in place while its neighbours had turned on the way. One
                       object, one turn, one grammar. -->
                  <div v-if="zone.state === 'active' && activeBonusEntry !== undefined"
                       class="con-cards__slot con-reveal__bonus-slot"
                       :data-zoom-slot="activeBonusEntry.card.name + '#' + activeBonusEntry.index"
                       :class="{'con-cards__slot--focused': focusIdx === activeBonusEntry.pos}"
                       :ref="focusIdx === activeBonusEntry.pos ? 'focusedCardSlot' : undefined">
                    <Card :card="activeBonusEntry.card" :key="activeBonusEntry.card.name" lightweight />
                    <div v-if="focusIdx === activeBonusEntry.pos && !embedded" class="con-start__slot-a">
                      <GamepadGlyph control="confirm" /><span>{{ $t('Take card') }}</span>
                    </div>
                  </div>

                  <!-- FUTURE: a face-down placeholder — an honest "one more
                       bonus is coming", never a card the player could read. -->
                  <div v-else-if="zone.state === 'future'" class="con-cards__slot con-reveal__bonus-slot con-reveal__bonus-slot--waiting" aria-hidden="true">
                    <span class="con-reveal__bonus-cover con-card-back"></span>
                  </div>

                  <!-- ACTIVE with NO card entry — a transitional frame (the
                       batch not reconciled yet, or a shape the wave split
                       missed): the EMPTY socket alone. Never the ✓ — an
                       active zone claiming «this colony has paid» over a card
                       the player has not taken is a lie the player acts on. -->
                  <div v-else-if="zone.state === 'active'" class="con-cards__slot con-reveal__bonus-slot con-reveal__bonus-slot--empty" aria-hidden="true">
                    <span class="con-reveal__bonus-socket"></span>
                  </div>

                  <!-- TAKEN / DONE: the EMPTY SOCKET the card came out of —
                       the same footprint, so nothing resizes or shifts, with
                       the ✓ that says this colony has paid. Showing its BACK
                       here would read as a card still on the table. -->
                  <div v-else class="con-cards__slot con-reveal__bonus-slot con-reveal__bonus-slot--empty" aria-hidden="true">
                    <span class="con-reveal__bonus-socket"></span>
                    <span class="con-reveal__bonus-done">✓</span>
                  </div>

                  <!-- THIS COLONY's own discard — the step that closes THIS
                       payout. STANDALONE ONLY: inside a workspace the ONE
                       bottom status bar owns every verb (the same rule as the
                       take chip), and an in-zone button was exactly what
                       pushed the zone past the stage's vertical budget. -->
                  <div v-if="zone.state === 'active' && discardStep !== undefined && !embedded"
                       class="con-reveal__closer"
                       :class="{'con-reveal__closer--ready': discardStepReady}">
                    <span class="con-reveal__closer-cta" :class="{'con-reveal__closer-cta--locked': !discardStepReady}">
                      <GamepadGlyph control="confirm" />
                      <span>{{ $t(discardStep.label) }}</span>
                    </span>
                    <span v-if="!discardStepReady" class="con-reveal__closer-lock">{{ $t(discardStep.lockedReason) }}</span>
                  </div>
                  <span v-else-if="zone.state === 'future'" class="con-reveal__bonus-wait">
                    {{ $t('Waits for the previous bonus') }}
                  </span>
                </div>
              </transition-group>
              <!-- EMBEDDED contextual footer — the focused card's name + the
                   ONE take verb, the buy status line's voice. The verb chip is
                   deliberate (user-mandated): with several cards it names
                   exactly which card A takes; the name re-keys with focus. -->
              <!-- ALWAYS IN LAYOUT once embedded: the bar reserves its fixed
                   row from the first frame, so the fit engine measures the
                   true stage chrome and the arrival's end can never reflow the
                   row. While the batch is still landing only its CONTENT hides
                   (opacity — never promise a card that has not arrived). -->
              <div v-if="embedded" class="con-reveal__namebar con-ws-stage-status"
                   :class="{'con-reveal__namebar--held': arrivalPending ||
                            (drawnUntaken[focusIdx] === undefined && discardStep === undefined)}">
                <template v-if="drawnUntaken[focusIdx] !== undefined">
                  <span class="con-cards__verdict-name" :key="drawnUntaken[focusIdx].card.name">{{ $t(drawnUntaken[focusIdx].card.name) }}</span>
                  <span class="con-cards__verdict con-cards__verdict--ok">
                    <GamepadGlyph control="confirm" /><span>{{ $t('Take card') }}</span>
                  </span>
                </template>
                <!-- The payout's CLOSING STEP lives in the ONE status bar when
                     embedded (never an in-zone button): the same row that
                     named the takeable card now carries the mandatory
                     «Выбрать карту для сброса» — one place, one voice. -->
                <template v-else-if="discardStep !== undefined">
                  <span class="con-cards__verdict"
                        :class="discardStepReady ? 'con-cards__verdict--ok' : 'con-reveal__closer-cta--locked'">
                    <GamepadGlyph control="confirm" /><span>{{ $t(discardStep.label) }}</span>
                  </span>
                  <span v-if="!discardStepReady" class="con-reveal__closer-lock">{{ $t(discardStep.lockedReason) }}</span>
                </template>
              </div>
              <div v-if="drawnUntaken.length > 4" class="con-reveal__pager" aria-hidden="true">
                <span class="con-reveal__pager-b">[</span>
                <span class="con-reveal__pager-i">{{ focusIdx + 1 }}</span>
                <span class="con-reveal__pager-s">/</span>
                <span class="con-reveal__pager-n">{{ drawnUntaken.length }}</span>
                <span class="con-reveal__pager-b">]</span>
              </div>
            </div>
            <!--
              The DISCARD tray of a conditional deck search — the cards the
              deck turned over and threw away to find these. Deliberately
              SECONDARY: a compact face-down pile in its own corner that never
              shrinks the received cards. It is NOT a focus target (it never
              competes with the received cards for the selection frame) — it is
              opened ONLY by R3, always available while the modal is up, so
              inspecting it is a deliberate side-move, never part of the flow.
            -->
            <div v-if="discardedCards.length > 0" class="con-reveal__discard">
              <span class="con-reveal__discard-pile" aria-hidden="true">
                <span v-if="discardedCards.length > 2" class="con-card-back con-reveal__discard-back con-reveal__discard-back--3"></span>
                <span v-if="discardedCards.length > 1" class="con-card-back con-reveal__discard-back con-reveal__discard-back--2"></span>
                <span class="con-card-back con-reveal__discard-back con-reveal__discard-back--1"></span>
                <span class="con-reveal__discard-count">{{ discardedCards.length }}</span>
              </span>
              <span class="con-reveal__discard-meta">
                <span class="con-reveal__discard-label">{{ $t('DISCARDED') }}</span>
                <span class="con-reveal__discard-hint">
                  <GamepadGlyph control="stickR" /><span>{{ $t('Inspect') }}</span>
                </span>
              </span>
            </div>
          </div>

          <!-- ── RESULT: the deck-check outcome (SearchForLife etc.) — a filled
               left→right story: the SOURCE card (the acting card, position/role
               UNCHANGED — the connection to the previous action overlay), a
               connector, the REVEALED card, then the verdict + info panel.
               EMBEDDED (a play's repeated action, the Hydronetwork's copy) the
               SAME story stands inside the workspace's own zone: the source
               column is what tells the player WHICH action turned this card
               over — «Проверка проекта» copies somebody else's, so the acting
               card is nowhere else on screen. -->
          <div v-else-if="mode === 'result' && lastReveal !== undefined" class="con-reveal__body con-reveal__body--result">
            <div class="con-reveal__source">
              <div class="con-start__section-title">{{ $t('Source') }}</div>
              <!-- The source card ANCHOR: on the composer → result phase
                   handoff the confirm modal's card FLIPs into this slot. L3
                   inspects it fullscreen (the `source:` zoom slot is the FLIP
                   origin), mirroring the drawn reveal's L3 = source. -->
              <div :data-motion-anchor="'card:' + lastReveal.action"
                   :data-zoom-slot="'source:' + lastReveal.action">
                <Card :card="{name: lastReveal.action}" :key="lastReveal.action" lightweight />
              </div>
            </div>
            <!-- CONNECTOR: the source card drew + revealed the deck card. -->
            <div class="con-reveal__link" aria-hidden="true">
              <span class="con-reveal__link-label">{{ $t('reveals') }}</span>
              <span class="con-reveal__link-beam"></span>
            </div>
            <!-- The revealed card is the flight's LANDING SLOT: the real card
                 stays hidden (layout kept) until the deck→slot flip settles,
                 so the proxy lands on its exact rect and the swap is invisible. -->
            <div class="con-reveal__revealed" ref="resultSlot"
                 :data-zoom-slot="'revealed:' + lastReveal.revealed.name"
                 :class="{
                   'con-reveal__revealed--met': resultRevealed && lastReveal.conditionMet,
                   'con-reveal__revealed--miss': resultRevealed && !lastReveal.conditionMet,
                 }">
              <Card :card="lastReveal.revealed" :key="lastReveal.revealed.name"
                    :style="{visibility: resultStage === 'settled' ? 'visible' : 'hidden'}" />
            </div>
            <!-- VERDICT + INFO panel: the «revealing» status while the card
                 flies, the full breakdown (verdict · what was checked · reward ·
                 VP) once it lands. A reserved-width slot keeps the card centred
                 across the swap.
                 The breakdown is the SHARED panel — the same component the
                 EMBEDDED workspace stage renders, so this legacy surface can
                 never again be the more informative of the two. -->
            <div class="con-reveal__verdict-slot">
              <transition name="con-actfocus-outcome" mode="out-in">
                <div v-if="!resultRevealed" key="status" class="con-reveal__verdict con-reveal__verdict--pending" role="status">
                  <span class="con-reveal__revealstatus-spin" aria-hidden="true"></span>
                  <span class="con-reveal__verdict-waiting">{{ $t('Revealing the card') }}</span>
                </div>
                <ConsoleRevealVerdict v-else key="verdict" :reveal="lastReveal" />
              </transition>
            </div>
            <!-- The deck→slot FLIGHT layer (fixed proxy — the shared deal
                 chassis; the SAME director the in-frame reveal uses). Teleported
                 to body so no ancestor panel transform can trap its fixed
                 coordinates (the flight measures viewport-absolute rects). -->
            <Teleport to="body">
              <div v-if="resultFlightOn" class="con-reveal__revealfly" aria-hidden="true">
                <div class="con-deal-proxy" ref="resultProxy">
                  <div class="con-deal-proxy__flip" ref="resultFlip">
                    <div class="con-deal-proxy__face">
                      <ConsoleCardFaceLite :name="lastReveal.revealed.name" />
                    </div>
                    <div class="con-deal-proxy__back">
                      <div class="con-card-back con-card-back--flyer"></div>
                    </div>
                  </div>
                </div>
              </div>
            </Teleport>
          </div>

          <!-- ── VIEWER: another player's public reveal (read-only) ──── -->
          <div v-else-if="mode === 'viewer' && viewerReveal !== undefined" class="con-reveal__body con-info__scroll">
            <div class="con-reveal__main">
              <div class="con-cards__strip con-reveal__strip"
                   :class="stripCountClass"
                   :style="stripZoomStyle">
                <div v-for="(name, i) in viewerReveal.cards" :key="name + '#' + i"
                     class="con-cards__slot con-start__deal"
                     :style="dealDelay(i)"
                     :data-zoom-slot="name + '#' + i"
                     :class="{'con-cards__slot--focused': focusIdx === i}"
                     :ref="focusIdx === i ? 'focusedCardSlot' : undefined">
                  <Card :card="{name}" :key="name" lightweight />
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>

      <!-- The gliding selection frame — THE primary focus indicator of card
           navigation (shared vocabulary with hand / draft / start scene).
           Self-resolving inside this overlay, so it can never target the
           task host's focused card underneath. -->
      <!-- The gliding frame lands only on the received cards — the discard
           tray is opened by R3, never focused. -->
    </template>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE REVEAL OVERLAY — CTS T6 row 25 (docs/CONSOLE_MODE_CONCEPT.md). The
 * console-native surface for the three REVEAL flows, replacing the desktop
 * modals (gated off in console) with one calm card-reveal frame:
 *
 *  drawn  — «you received N cards». TWO presentation modes, decided by the
 *           batch's TOTAL card count at open time (stable — never flips
 *           mid-session):
 *             · MULTI-CARD (≥2) — the modal frame: a compact SOURCE CHIP in
 *               the header (never a second full card), the received cards as
 *               a focusable strip filling the freed space. A = take the
 *               focused card, RT/B = take all, X = inspect, L3 = source.
 *             · SINGLE-CARD (exactly 1) — HEADLESS: the received card IS the
 *               reveal, opened DIRECTLY in the fullscreen viewer (mandatory —
 *               it can only be completed by taking). L3 flips the fullscreen
 *               between the received card and the source (no nested viewer);
 *               A departs the card straight to the player. See the shell's
 *               zoom handlers for the take/swap/close-prevention wiring.
 *           Take/ack semantics are the SHARED drawnCardsState functions
 *           (byte-identical to the desktop flow).
 *  result — the deck-check outcome (SearchForLife / AsteroidDeflection-
 *           System): source card + the revealed card in a green/red frame
 *           + the ✓/✗ verdict + the reward chip + VP delta. OK marks it seen.
 *  viewer — another player's PUBLIC reveal (opened via a notification CTA):
 *           read-only browse + close.
 *
 * ONE hint zone: the bottom command bar (rendered above the modal by the
 * shell) carries the whole contract — this overlay has NO footer of its own,
 * so B never reads two conflicting labels. Priority drawn > result > viewer.
 */
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {runActionRevealFlight, ActionRevealFlightHandle} from '@/client/console/consoleActionRevealMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {RevealResultModel} from '@/common/models/RevealResultModel';
import {CardDrawRevealSource} from '@/common/models/CardDrawRevealModel';
import {translateText} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {
  sourceSeatReservePx, verdictStageFit, wsStageLayout, wsStageLayoutStyle,
} from '@/client/console/consoleWsStageLayout';
import ConsoleWsStageHead from '@/client/components/console/foundation/ConsoleWsStageHead.vue';
import ConsoleRevealVerdict from '@/client/components/console/foundation/ConsoleRevealVerdict.vue';
import {focusKicker} from '@/client/console/consoleActionFlow';
import {setWorkspaceOutcomePhase, workspaceClaimsColonyReveal, workspaceClaimsDrawReveal, workspaceOutcomeArrivalPending, workspaceOutcomeState, workspaceSourceZoomOrigin} from '@/client/console/consoleWorkspaceOutcome';
import {useEventListener, useResizeObserver} from '@vueuse/core';
import {
  DrawnCardEntry, closeAndReleaseEvent, currentRevealEvent, holdRevealForFollowUp, markAllTaken,
  markCardTaken, releaseRevealFollowUp,
} from '@/client/components/drawnCards/drawnCardsState';
import {ColonyBonusDiscardMeta} from '@/common/models/PlayerInputModel';
import {
  bonusDiscardOwnsBatch, bonusDiscardStep, bonusZones, segmentlessZoneBatch,
  BonusDiscardStep, BonusZone,
} from '@/client/console/colonyTrade/colonyBonusDiscardStep';
import {CardName} from '@/common/cards/CardName';
import {handDockReachable, runHandIntake} from '@/client/console/handDock/handDeliveryDirector';
import {RevealMeta} from '@/client/components/notifications/notificationTypes';
import {closeRevealViewer, revealViewerState} from '@/client/components/notifications/revealViewerState';
import {
  consoleCardZoom, ConsoleZoomReceive, ConsoleZoomSwap, openConsoleCardZoom, repointConsoleCardZoom, slotZoomOrigin,
} from '@/client/console/consoleCardZoom';
import {
  boardCardBonusClaimsReveal, boardCardBonusState, bonusHoldingSingleZoom, bonusZoomOriginEl,
  isBoardCardBonusActive, isBonusRevealStaged,
} from '@/client/console/boardCardBonus/consoleBoardCardBonus';
import {
  deckDrawHoldingSingleZoom, deckDrawState, deckDrawZoomOriginEl, isDeckDrawActive, isDeckDrawStaged,
} from '@/client/console/deckDraw/consoleDeckDraw';
import {
  colonyTradeHoldingSingleZoom, colonyTradeState, colonyTradeWillDressReveal, colonyTradeZoomOriginEl,
  isColonyTradeActive, isColonyTradeRevealStaged,
} from '@/client/console/colonyTrade/consoleColonyTrade';
import {revealWaveForIndex} from '@/client/console/colonyTrade/colonyTradeModel';
import {setRevealVeilSuppressed} from '@/client/console/surfaceMotion/surfaceMotionState';
import {
  DrawnRevealPresentationCtx, drawnRevealDetached, drawnRevealHeadless, drawnRevealViewerOpens,
} from '@/client/console/consoleRevealPresentation';
import {rewardPayoutSettling} from '@/client/console/rewardPayoutQuiet';

/** The scene phases during which the reveal frame stays fully veiled. */
const BONUS_PRE_FRAME_PHASES: ReadonlySet<string> = new Set(['lift', 'hover', 'gather', 'fan']);

/**
 * The deck-draw phases during which the frame stays veiled. Note 'search' and
 * 'settle' can't appear here — the shell withholds the overlay from mounting
 * at all until the search is over ([[deckDrawHolds]]); by the time this modal
 * exists the scene is already assembling into it.
 */
const DECK_DRAW_PRE_FRAME_PHASES: ReadonlySet<string> = new Set(['search', 'settle', 'assemble']);


export type ConsoleRevealMode = 'drawn' | 'result' | 'viewer';

/** The compact source chip descriptor (multi-card drawn header). */
type SourceChip = {name: string, inspectable: boolean};

/** One untaken strip card: the batch index (take key) + its strip position. */
type StripEntry = {card: CardModel, index: number, pos: number};

export default defineComponent({
  name: 'ConsoleRevealOverlay',
  components: {Card, ConsoleCardFaceLite, ConsoleWsStageHead, ConsoleRevealVerdict, GamepadGlyph},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    mode: {type: String as PropType<ConsoleRevealMode>, required: true},
    /**
     * EMBEDDED — the SAME component re-seated inside a workspace that CLAIMED
     * this batch (consoleWorkspaceOutcome), instead of the fixed full-bleed
     * band. Mirrors `ConsolePlayedOverlay.embedded`: no own band geometry, no
     * plate, no header, no motion-surface identity — the host frame is the
     * chassis and owns the naming and the enter/leave.
     *
     * Everything physical is unchanged: the strip slots keep their
     * `data-zoom-slot` keys (so the deck-draw cinematic's document-wide
     * `.con-reveal [data-zoom-slot]` targeting lands here byte-identically),
     * the take flights stay fixed-viewport proxies, and the intake still ends
     * in the dock. Rect math is viewport-px in both hosts.
     */
    embedded: {type: Boolean, default: false},
    /**
     * THE HOST STANDS THE SOURCE CARD ITSELF, beside this stage.
     *
     * Two consequences, both about saying one thing once: the compact source
     * CHIP in the head is suppressed (the card is already on stage and
     * `L3 Источник` lifts THAT one — the same rule `ConsoleTaskHost` applies to
     * its `dockedSource`), and the embedded fit re-runs when the seat comes or
     * goes, because the seat is `position: absolute` and therefore changes
     * neither the root's nor the row's box: no observer can see it.
     */
    sourceSeat: {type: Boolean, default: false},
  },
  emits: ['dismiss-result', 'discard-pick', 'drawn-complete', 'result-detached'],
  data() {
    return {
      /* (The colony-bonus card no longer opens ON the table: it TURNS IN THE
         AIR, like every other card of the payout, and the zone receives it
         already open. The `down/flipping/up` machine that used to live here —
         and the second, differently-shaped turn it played — is gone with it.) */
      focusIdx: 0,
      /**
       * TAKE-IN-PLACE state machine (EMBEDDED MULTI batches only). A card is
       * `available` (untaken, not animating) → `taking` (`takingIdx` — the
       * in-slot press+turn is playing; ALL input is swallowed, so a double A
       * or an A+B race can never start two transactions) → `taken` (recorded
       * in the batch's `takenIndices`; face-down in its slot, out of the
       * focus ring) → `collecting` (the final stack gather is in flight —
       * the terminal stage; the workspace folds under it). Explicit fields,
       * never scattered booleans: every guard reads these two.
       */
      takingIdx: undefined as number | undefined,
      collecting: false,
      /**
       * IS THE HAND DOCK REACHABLE for this batch (sampled once per batch —
       * see `refreshDockReachable`)? It picks the take grammar (per-card
       * intake flights vs take-in-place), and it is sampled ONCE because it
       * also drives what the strip RENDERS: re-deciding mid-batch would
       * re-flow the row under the player's hand. A dock that disappears
       * later degrades safely anyway — `runHandIntake` commits honestly with
       * no flight when it finds no dock.
       */
      dockReachable: false,
      /**
       * THE LAST CARD, TURNED BUT DELIBERATELY NOT COMMITTED.
       *
       * `currentRevealEvent()` is `!dismissed && untakenCount > 0` — so marking
       * the last card taken is EXACTLY what makes the reveal stop existing:
       * the shell's `rawDrawnRevealPending` goes false and this overlay
       * unmounts on the spot (measured: the unmount landed 2 ms after the
       * mark, and the collection then found no event at all — nothing flew and
       * the stage simply blinked to the board).
       *
       * «Взять всё» never had this because it marks NOTHING up front — its
       * `markAllTaken` runs inside the intake's staged commit, once the
       * proxies already stand over the cards. So the per-card path does the
       * same: the final turn records itself HERE (which is all the row needs
       * to keep the card face-down) and the batch commits at that same seam.
       */
      turnedIdx: undefined as number | undefined,
      /**
       * THE BATCH THIS SURFACE HAS SEEN A WORKSPACE OWN (`revealKey`; '' = none).
       *
       * Ownership is a LIVE claim — and the claim ENDS AT THE TAKE. The last
       * card's intake stages its proxies, `result-detached` fires, the shell
       * releases the claim and folds the workspace, all inside ONE synchronous
       * block — while this surface is still mounted over a batch that is only
       * dismissed a tick later (`holdRevealForFollowUp` + the `$nextTick` in
       * `takeFocused`). Re-deriving the presentation from the live claim inside
       * that window flips a one-card embedded reveal to HEADLESS, and headless
       * means exactly one thing: auto-open the fullscreen viewer. So pressing
       * «A Взять карту» threw the player into a full-bleed viewer of the very
       * card that was at that moment flying into their hand — a viewer opened
       * `mandatory: true`, over a surface about to unmount.
       *
       * So the mode is decided ONCE PER BATCH and only ever HARDENS: the latch
       * is written on the RISING edge (the claim is live from submit time, so
       * that is at or before mount) and read on the falling one — no watcher
       * ordering is load-bearing. A new batch re-stamps it, and a claim that
       * lands LATE still flips the live term first, so the deliberate
       * «claim after an open» path in `singleCardNeedsFullscreen` keeps working.
       */
      ownedBatchKey: '',
      /**
       * The SHARED stage layout (consoleWsStageLayout) for the embedded strip
       * — the same size / gap / row-shape source the buy pick uses, so
       * «купить» and «получена» present a byte-identical hero. 0 = not measured
       * yet (the ladder fallback renders one frame, then the fit lands).
       */
      embedFitZoom: 0,
      /**
       * WHICH BATCH the current solve belongs to ('' = none yet).
       *
       * The in-flight guard below may hold a SOLVED row still; it may never
       * withhold the row's FIRST solve, or the scene that is about to aim at
       * it measures the coarse fallback ladder instead of the layout the cards
       * will actually land in.
       */
      fitSolvedKey: '',
      /** The solved layout as CSS custom properties (one writer, both hosts). */
      embedLayoutStyle: {} as Record<string, string>,
      embedFitRetries: 0,
      embedFitScheduled: false,
      /** The solved verdict-band factor (0 = not measured yet). */
      verdictFit: 0,
      stopVerdictResize: undefined as (() => void) | undefined,
      stopVerdictObs: undefined as (() => void) | undefined,
      verdictSettleTimer: undefined as number | undefined,
      stopFitResize: undefined as (() => void) | undefined,
      stopFitObs: undefined as (() => void) | undefined,
      /** …and the ROW's own observer (attached on the first real measure —
       *  see `fitEmbeddedStrip`; the row is what the fit reads). */
      stopRowObs: undefined as (() => void) | undefined,
      settleFitTimer: undefined as number | undefined,
      // ── The 'result' deck→slot reveal flight (reuses the in-frame director) ──
      /** pending → the card is flying / flipping (status shows); settled → the
       *  face is up and the real card + verdict are shown. */
      resultStage: 'pending' as 'pending' | 'face' | 'settled',
      /** The fixed flight proxy is mounted (the face-down card in transit). */
      resultFlightOn: false,
      resultHandle: undefined as ActionRevealFlightHandle | undefined,
      resultLaunchTimer: undefined as number | undefined,
    };
  },
  computed: {
    // ── drawn ────────────────────────────────────────────────────────
    drawnEvent(): DrawnCardEntry | undefined {
      return this.mode === 'drawn' ? currentRevealEvent() : undefined;
    },
    /** The measured embedded fit applies — the watcher owns install/teardown. */
    embedFitEligible(): boolean {
      return this.embedded && this.mode === 'drawn';
    },
    /**
     * …and the VERDICT stage has a fit of its own, on the same lifecycle. Its
     * shape is a row of DIFFERENT things (see `verdictStageFit`), so it solves
     * one factor rather than a slot layout — but the reason is identical: the
     * authored constants are the standalone band's, and inside a workspace the
     * zone is the room.
     */
    verdictFitEligible(): boolean {
      return this.embedded && this.mode === 'result';
    },
    drawnSource(): CardDrawRevealSource | undefined {
      const source = this.drawnEvent?.source;
      return source !== undefined && source.type !== 'other' ? source : undefined;
    },
    /** Untaken cards paired with their FULL-array index (the take mapping). */
    drawnUntaken(): Array<{card: CardModel, index: number}> {
      const e = this.drawnEvent;
      if (e === undefined) {
        return [];
      }
      const out: Array<{card: CardModel, index: number}> = [];
      e.cards.forEach((card, index) => {
        if (!e.takenIndices.has(index)) {
          out.push({card, index});
        }
      });
      return out;
    },
    /**
     * The untaken cards split by TRADE WAVE (a merged colony-trade batch):
     * the income cards render plainly, the colony-bonus cards inside their
     * own labelled zone. `pos` keeps each card's logical strip position, so
     * focus / navigation / take order are byte-identical to the flat strip
     * (income precedes bonus in the batch by construction). A batch without
     * trade segments is all-income — no zone renders.
     */
    drawnGrouped(): {income: Array<StripEntry>, bonus: Array<StripEntry>} {
      const segments = this.drawnEvent?.tradeSegments;
      // The zone renderer below draws the bonus wave ONLY for a per-colony
      // discard sequence; without it a bonus card is an ordinary card of the
      // payout and belongs in the strip (see `revealWaveForIndex`).
      const zoned = this.bonusZones.length > 0;
      // The OUT-OF-TRADE owner bonus (ProductiveOutpost / Yvonne): no trade
      // window, so no segments — but the discard marker and the batch's own
      // colony source prove the one card IS the zone's (pure + spec'd in
      // `segmentlessZoneBatch`). Without it the card stood BESIDE its zone
      // and the cardless active zone showed the taken-✓ socket.
      const zoneBatch = zoned && segmentlessZoneBatch(
        this.drawnEvent?.source, segments, this.bonusDiscard, this.drawnEvent?.cards.length ?? 0);
      const income: Array<StripEntry> = [];
      const bonus: Array<StripEntry> = [];
      this.drawnUntaken.forEach((u, pos) => {
        const entry = {card: u.card, index: u.index, pos};
        if (zoneBatch || revealWaveForIndex(segments, u.index, zoned) === 'bonus') {
          bonus.push(entry);
        } else {
          income.push(entry);
        }
      });
      return {income, bonus};
    },
    /**
     * TAKE-IN-PLACE mode — the FALLBACK grammar for a multi-card batch: A
     * turns the focused card face-down IN ITS SLOT and the whole batch rides
     * ONE stack intake at the end.
     *
     * It is chosen by the DESTINATION, never by the surface's identity: when
     * the hand dock is genuinely reachable (`dockReachable` — mounted,
     * painted, measurable) every take flies there the moment it is taken and
     * the survivors re-flow behind it, which is the premium grammar and the
     * one the standalone reveal has always used. Only a batch whose cards
     * have nowhere to fly (dock unmounted / hidden / covered — a pre-game
     * host, a fullscreen cinematic) takes in place. Merged colony trades and
     * discard-owing payouts keep their own grammar (guarded anyway).
     */
    embeddedMulti(): boolean {
      const e = this.drawnEvent;
      return this.embedded && !this.dockReachable && e !== undefined && e.cards.length > 1 &&
        e.tradeSegments === undefined && this.bonusDiscard === undefined;
    },
    /**
     * The strip rows. Embedded-multi renders the WHOLE batch — taken cards
     * stay in their slots as face-down backs (the row must never re-flow
     * while the player works through it); `pos` stays the UNTAKEN ordinal
     * (−1 for taken), so focus / navigation / take order are byte-identical
     * to the flat untaken strip and taken cards are skipped by construction.
     */
    stripEntries(): Array<StripEntry & {taken: boolean}> {
      if (!this.embeddedMulti) {
        return this.drawnGrouped.income.map((entry) => ({...entry, taken: false}));
      }
      const e = this.drawnEvent;
      if (e === undefined) {
        return [];
      }
      let pos = 0;
      return e.cards.map((card, index) => {
        // `turnedIdx` is the last card: physically turned over, deliberately
        // not committed yet (committing it would unmount this surface before
        // the collection could start) — it must still RENDER as taken.
        const taken = e.takenIndices.has(index) || this.turnedIdx === index;
        return {card, index, pos: taken ? -1 : pos++, taken};
      });
    },
    /** A card source opens fullscreen on L3 (colony/tile/other are not). */
    drawnSourceInspectable(): boolean {
      return this.drawnSource?.type === 'card';
    },
    /**
     * The compact source chip (multi-card drawn header). A card source shows
     * its name + is inspectable (L3); a colony source shows the colony name; a
     * tile bonus shows a label. Undefined = no meaningful source to show.
     */
    sourceChip(): SourceChip | undefined {
      const s = this.drawnSource;
      if (s === undefined) {
        return undefined;
      }
      // The host already stands this card on stage — a chip repeating its name
      // is the same sentence in a second voice, and the head is where the
      // player looks for what is HAPPENING, not for what caused it.
      if (this.sourceSeat && s.type === 'card') {
        return undefined;
      }
      if (s.type === 'card') {
        return {name: translateText(s.cardName), inspectable: true};
      }
      if (s.type === 'colony') {
        return {name: translateText(s.colonyName), inspectable: false};
      }
      if (s.type === 'tile') {
        return {name: translateText('Tile bonus'), inspectable: false};
      }
      if (s.type === 'globalParameter' && s.parameter === 'venus') {
        return {name: translateText('Venus scale bonus'), inspectable: false};
      }
      return undefined;
    },
    /**
     * A WORKSPACE OWNS THIS BATCH, right now. Lifted out of `singleCardMode`
     * because the answer also has to be LATCHED for the batch's life — see
     * `ownedBatchKey` for why a live read alone is a bug.
     */
    workspaceOwnsBatch(): boolean {
      const src = this.drawnEvent?.source;
      const claimed = (workspaceClaimsDrawReveal(src) || workspaceClaimsColonyReveal(src)) &&
        !boardCardBonusClaimsReveal(src);
      return this.embedded || claimed;
    },
    /** The batch identity to LATCH, or '' while nothing owns this one. */
    workspaceOwnedStamp(): string {
      return this.workspaceOwnsBatch ? this.revealKey : '';
    },
    /**
     * WHAT THIS HOST KNOWS about the batch — the input of the ONE presentation
     * decision (`consoleRevealPresentation`, pure and spec'd there).
     *
     * ⚠️ OWNERSHIP, not readiness, and LIVE **or** LATCHED. `embedded` is
     * derived from the embed SLOT existing, and the slot is published
     * `flush: 'post'` — so for the frames between the claim and the host's
     * mount `embedded` is false while the card is unambiguously the
     * workspace's, and `mounted()` fires in exactly that window. The CLAIM is
     * the honest answer there, and it is live from submit time. At the other
     * end of the flow the claim is RELEASED before the batch is dismissed,
     * which is what `ownedBatchKey` covers.
     *
     * The BOARD lift still goes fullscreen, by construction rather than by a
     * flag: a cover lifted off a cell carries `{type:'tile'}` /
     * `{type:'globalParameter'}`, which no workspace claim can match — and the
     * one board source that IS a colony (Pluto's build bonus) is carved out by
     * asking the bonus scene itself (see `workspaceOwnsBatch`).
     */
    revealPresentationCtx(): DrawnRevealPresentationCtx {
      const e = this.mode === 'drawn' ? this.drawnEvent : undefined;
      return {
        cardCount: e?.cards.length ?? 0,
        untakenCount: this.drawnUntaken.length,
        ownedNow: this.workspaceOwnsBatch,
        ownedEver: this.ownedBatchKey !== '' && this.ownedBatchKey === this.revealKey,
        hasClosingStep: this.bonusDiscard !== undefined,
      };
    },
    /**
     * SINGLE-CARD mode — the headless presentation: the received card IS the
     * fullscreen viewer. Keyed on the batch's TOTAL card count (stable; it
     * never shrinks as cards are taken), so a multi-card batch taken down to
     * one still stays multi (never a jarring mid-session mode flip).
     */
    singleCardMode(): boolean {
      return drawnRevealHeadless(this.revealPresentationCtx);
    },
    /**
     * THE PAYOUT ISN'T FINISHED: this trade's colony bonus pays "draw N, then
     * discard N" (Pluto), and the server marked the pending discard prompt
     * structurally (`discardPrompt.colonyBonus`). The modal hosts that discard
     * as its closing, MANDATORY step — the player reads the whole bonus as one
     * thing instead of being handed a discard prompt that looks unrelated to
     * the trade. The pick itself, and the card physically leaving the hand,
     * belong to the ONE shared discard flow (cardDiscard/*).
     */
    bonusDiscard(): ColonyBonusDiscardMeta | undefined {
      if (this.mode !== 'drawn') {
        return undefined;
      }
      // …OF THIS BATCH. A marker that belongs to another colony's payout is a
      // parked demand, not this reveal's closing step — see
      // `bonusDiscardOwnsBatch` for the four surfaces that read it and the
      // freeze the unscoped read caused on the take path.
      const meta = this.playerView.waitingFor?.discardPrompt?.colonyBonus;
      return bonusDiscardOwnsBatch(meta, this.drawnEvent?.source) ? meta : undefined;
    },
    /** The closing step — ONE shared derivation with the shell's command bar. */
    discardStep(): BonusDiscardStep | undefined {
      return bonusDiscardStep(this.bonusDiscard, this.drawnUntaken.length);
    },
    /**
     * Ready to hand over: every card on the table has been taken.
     *
     * The «not while a card is still turning» arm is gone with the in-place
     * turn — cards now arrive open (they turned in the air), and `ready`
     * already means every one of them was taken, which a card still in flight
     * cannot be: the arrival gate (`arrivalPending`) owns that window.
     */
    discardStepReady(): boolean {
      return this.discardStep?.ready === true;
    },
    /** One zone per colony of the recipient's sequence (see bonusZones). */
    bonusZones(): ReadonlyArray<BonusZone> {
      return bonusZones(this.bonusDiscard);
    },
    /**
     * The card of the colony resolving right now. The batch carries exactly one
     * bonus card (the rules draw one per colony), so this is that card — the
     * later colonies have not drawn yet and render as face-down placeholders.
     */
    activeBonusEntry(): StripEntry | undefined {
      return this.drawnGrouped.bonus[0];
    },
    /** The single received card (single-card mode). */
    singleCard(): CardModel | undefined {
      return this.singleCardMode ? this.drawnEvent?.cards[0] : undefined;
    },
    /**
     * NOTHING RENDERS HERE. Two different reasons, one root state:
     *  · single-card mode — the fullscreen viewer IS the reveal;
     *  · DETACHED — the batch is finished and its host has let go (the closing
     *    tick of every embedded take). Without this the surface loses its zone,
     *    re-dresses as the standalone band and presents — and animates out —
     *    over the board for a few frames, outside the workspace it belonged to.
     */
    headless(): boolean {
      return this.singleCardMode || drawnRevealDetached(this.revealPresentationCtx);
    },
    /**
     * The single-card reveal SHOULD be showing its fullscreen but isn't (the
     * initial mount, or an unexpected close while the card is still untaken).
     * The watcher (re-)opens it, so the reveal can never be left "invisible".
     * HELD while the board card-bonus cover is still travelling — the viewer
     * then opens off the arrived cover (a physical origin), never over it.
     */
    singleCardNeedsFullscreen(): boolean {
      // `drawnRevealViewerOpens` already carries the workspace-ownership
      // carve-out AND the «nothing left to take» one, and it is read through a
      // computed — so a claim that lands AFTER an open flips this back to false
      // and the watcher stops re-opening. That is the whole reason the check
      // lives in the shared decision rather than being duplicated here.
      //
      // …and the fullscreen may NEVER open over a resource payout still in
      // the air (the same placement's chips, absorb tails included). The
      // scene-side gate (`bonusHoldingSingleZoom` + the layer's signal-driven
      // release) already sequences the ordinary path; this is the OPENER's
      // own reading of the ONE settling predicate, so no scene-lifecycle
      // edge (an abort that pre-set `zoomEntryReady`, a scene that died
      // early) can slip the viewer over a flying chip. Bounded transitively:
      // every settling term is a scene state with its own safety net.
      return drawnRevealViewerOpens(this.revealPresentationCtx) &&
        consoleCardZoom.card === undefined &&
        !rewardPayoutSettling() &&
        !bonusHoldingSingleZoom(this.drawnEvent?.id) &&
        !deckDrawHoldingSingleZoom(this.drawnEvent?.id) &&
        !colonyTradeHoldingSingleZoom(this.drawnEvent?.id);
    },
    // ── STAGED entrance (a scene owns this batch's arrival) ────────────
    /*
     * TWO scenes stage a reveal, and the contract is identical for both: the
     * cards physically arrive on their own stage and land in THESE slots, so
     * the modal must suppress its stock deal-in entrance and stay veiled
     * until the scene hands off.
     *   · boardCardBonus — the cover lifts off a board cell / the Venus marker
     *   · deckDraw       — the cards peel off the top-bar project deck
     * The classes keep their `bonus-*` names (the CSS contract is shared);
     * a batch can only ever be claimed by one scene, since they split on the
     * reveal's source.
     */
    /**
     * A scene owns this batch's entrance: the stock deal-in / frame rise are
     * suppressed for the batch's whole on-screen life (this persists after
     * the scene ends — see each controller's `stagedEventId` doc — otherwise
     * dropping it would replay the entrance).
     */
    bonusMode(): boolean {
      return this.mode === 'drawn' &&
        (isBonusRevealStaged(this.drawnEvent?.id) || isDeckDrawStaged(this.drawnEvent?.id) ||
          isColonyTradeRevealStaged(this.drawnEvent?.id) ||
          // …and from the very first render for a batch the live trade is about
          // to claim: the claim lands one scheduler job LATER than this mount,
          // and that gap is a fully visible modal — see colonyTradeWillDressReveal.
          colonyTradeWillDressReveal(this.drawnEvent?.id, this.drawnEvent?.source) ||
          // EMBEDDED: the workspace's EXECUTION BEAT owns this batch's arrival
          // (the face-down card already flew off the pile and flips in the
          // zone) — replaying the stock deal-in on top of it is exactly the
          // «карта просто появилась» double-entrance.
          this.embedded);
    },
    /** Pre-frame: the modal is mounted for measurement but fully veiled. */
    bonusVeiled(): boolean {
      if (!this.bonusMode) {
        return false;
      }
      return (isBoardCardBonusActive() && BONUS_PRE_FRAME_PHASES.has(boardCardBonusState.phase)) ||
        (isDeckDrawActive() && DECK_DRAW_PRE_FRAME_PHASES.has(deckDrawState.phase)) ||
        (isColonyTradeActive() && isColonyTradeRevealStaged(this.drawnEvent?.id) &&
          colonyTradeState.cardScene === 'fly') ||
        // The pre-claim frames: veiled from mount, so the modal never paints
        // before its cards are on the way.
        colonyTradeWillDressReveal(this.drawnEvent?.id, this.drawnEvent?.source);
    },
    /** The static cards stay hidden until the handoff releases them. */
    bonusHeld(): boolean {
      if (!this.bonusMode) {
        return false;
      }
      return (isBoardCardBonusActive() &&
          (BONUS_PRE_FRAME_PHASES.has(boardCardBonusState.phase) || boardCardBonusState.phase === 'frame')) ||
        (isDeckDrawActive() &&
          (DECK_DRAW_PRE_FRAME_PHASES.has(deckDrawState.phase) || deckDrawState.phase === 'frame')) ||
        (isColonyTradeActive() && isColonyTradeRevealStaged(this.drawnEvent?.id) &&
          (colonyTradeState.cardScene === 'fly' || colonyTradeState.cardScene === 'ascend' ||
            colonyTradeState.cardScene === 'frame')) ||
        colonyTradeWillDressReveal(this.drawnEvent?.id, this.drawnEvent?.source);
    },
    /**
     * The slot count driving the strip layout.
     *
     * ⚠️ It counts what the row HOLDS, not what is left to take. Taking a card
     * must never resize the ones beside it: a taken card leaves its empty
     * socket, a future colony holds a face-down placeholder, so the row's width
     * — and with it the card scale — is fixed from the batch's first frame. On
     * the untaken count the ladder stepped up as cards left and every remaining
     * card visibly GREW.
     */
    stripCount(): number {
      if (this.mode === 'viewer') {
        return this.viewerReveal?.cards.length ?? 0;
      }
      const cards = this.drawnEvent?.cards.length ?? 0;
      const zones = this.bonusZones.length;
      // The batch carries exactly ONE bonus card (one colony resolves at a
      // time), so the extra slots are the OTHER zones of the sequence.
      return zones === 0 ? cards : cards + zones - 1;
    },
    /**
     * Count-driven card scale so 1–4 cards stay roomy with a generous safe gap
     * (no overlap); larger batches compact and scroll as a focus carousel. The
     * strip's `.con-cards__slot` reads `--con-cards-zoom` (set on the strip).
     */
    stripZoom(): number {
      const n = this.stripCount;
      // EMBEDDED 1–2 cards: full hero presence — the received card is the
      // stage's protagonist, the SAME size language the buy pick gives it
      // (its single card rides an unscaled slot). Denser batches keep the
      // shared ladder.
      const ladder = n <= 2 ? (this.embedded ? 1 : 0.94) : n <= 3 ? 0.82 : n <= 4 ? 0.72 : n <= 6 ? 0.6 : 0.52;
      // The payout's closing step lives UNDER the strip, and the modal's height
      // was already fully spent on the cards — without giving the row back a
      // notch the step (and the bonus zone's caption) get clipped by the frame.
      return this.discardStep !== undefined ? ladder * 0.88 : ladder;
    },
    /**
     * The base ladder rides two PROFILE factors resolved in CSS: the TV rem
     * scale (`--con-ui-scale` — px card faces must grow with the scaled rem
     * layout or they read desktop-small at 4K) and the per-count reveal boost
     * (`--con-reveal-zoom-boost`, set only by the tv profile via the strip's
     * count class in console_tv.less — 1 everywhere else, so standard /
     * handheld render byte-identical).
     *
     * A THIRD, independent factor is the HOST (`--con-reveal-host-scale`): the
     * embedded zone is a workspace column, not the full band, so its cards sit
     * a notch smaller. It is deliberately its own token rather than an override
     * of the boost — the boost is the PROFILE's per-count tuning and the host
     * factor is orthogonal to it, so they compose. Overriding the boost from
     * the embedded root would have silently thrown away the TV ladder.
     */
    stripZoomStyle(): Record<string, string> {
      // EMBEDDED: the SHARED fit engine owns the size (one source with the
      // buy pick — see fitEmbeddedStrip).
      if (this.embedded && this.mode === 'drawn') {
        if (this.embedFitZoom > 0) {
          return this.embedLayoutStyle;
        }
        // The PRE-FIT frames stand at the NATURAL slot size, never the
        // compact count ladder: the ladder is a full-bleed device, and for
        // the one-to-two-card hero case it painted a thumbnail that then
        // JUMPED to the measured fit a frame later (the deck-draw scene
        // could even measure the small slots and fly at them). The natural
        // slot is within ~1% of the solved hero here; a large batch is
        // corrected by the fit before its cards are interactive, clipped by
        // the zone for the odd frame in between.
        return {'--con-cards-zoom': 'calc(1 * var(--con-ui-scale, 1))'};
      }
      return {'--con-cards-zoom': `calc(${this.stripZoom} * var(--con-ui-scale, 1) * var(--con-reveal-zoom-boost, 1) * var(--con-reveal-host-scale, 1))`};
    },
    /**
     * THE BATCH IS STILL ARRIVING — the cards this surface renders are, right
     * now, physically flying in as proxies over their (held, invisible) real
     * slots. Interaction opens only when they are all down and handed over:
     * a focus ring on an empty slot promises a card that is not there, and an
     * «A Взять» accepted mid-flight is an input race by construction.
     *
     * Only meaningful embedded — a standalone reveal is not preceded by the
     * workspace's arrival at all.
     */
    arrivalPending(): boolean {
      return this.embedded && this.mode === 'drawn' && workspaceOutcomeArrivalPending();
    },
    /** The count class the tv profile keys its per-count boost / gap off. */
    stripCountClass(): string {
      const n = this.stripCount;
      return n > 6 ? 'con-reveal__strip--many' : `con-reveal__strip--n${Math.max(n, 1)}`;
    },
    // ── result ───────────────────────────────────────────────────────
    lastReveal(): RevealResultModel | undefined {
      return this.mode === 'result' ? this.playerView.lastReveal : undefined;
    },
    /** The face has turned up — show the verdict + the real card (the status
     *  «Вскрываем карту» yields the instant the flip crosses the camera plane). */
    resultRevealed(): boolean {
      return this.resultStage !== 'pending';
    },
    /** This surface is a workspace's own VERDICT STAGE — the one case that
     *  publishes its name into the host's breadcrumb (see the watcher). */
    resultEmbedPhase(): boolean {
      return this.embedded && this.mode === 'result';
    },
    /* (The verdict's own readings — the checked tag, its icon, the VP delta —
       live in the SHARED panel component beside its markup. Keeping copies here
       is how the two renderings of one event drifted apart in the first place.) */
    // ── viewer ───────────────────────────────────────────────────────
    viewerReveal(): RevealMeta | undefined {
      return this.mode === 'viewer' ? revealViewerState.reveal : undefined;
    },
    viewerActor(): {color: string, name: string} | undefined {
      const color = this.viewerReveal?.actor;
      if (color === undefined) {
        return undefined;
      }
      const p = this.playerView.players.find((pp) => pp.color === color);
      return {color, name: p !== undefined ? participantDisplayName(p) : color};
    },
    viewerOriginLabel(): string {
      return this.viewerReveal?.origin === 'hand' ? 'from hand' : 'from deck';
    },
    viewerResultLabel(): string {
      switch (this.viewerReveal?.result) {
      case 'discarded': return 'discarded';
      case 'shown': return 'shown';
      case 'kept': return 'kept';
      default: return 'revealed';
      }
    },
    // ── frame ────────────────────────────────────────────────────────
    kickerText(): string {
      switch (this.mode) {
      case 'drawn': return 'Cards received';
      case 'result': return 'Reveal result';
      default: return this.viewerReveal?.origin === 'hand' ? 'Shown cards' : 'Revealed cards';
      }
    },
    titleText(): string {
      switch (this.mode) {
      case 'drawn':
        // Singular when the deck turned over exactly one card — «Получены
        // карты» over a single card reads as a template that was not filled
        // in. Counted off the batch's TOTAL (never the untaken remainder), so
        // the heading cannot change mid-flow as cards are taken.
        return translateText((this.drawnEvent?.cards.length ?? 0) === 1 ?
          'Card received' : 'Cards received');
      case 'result':
        return this.lastReveal !== undefined ? translateText(this.lastReveal.action) : '';
      default:
        return translateText(this.viewerReveal?.origin === 'hand' ? 'Shown cards' : 'Revealed cards');
      }
    },
    revealKey(): string {
      switch (this.mode) {
      case 'drawn': return `drawn|${this.drawnEvent?.id ?? ''}`;
      case 'result': return `result|${this.lastReveal?.action ?? ''}|${this.lastReveal?.revealed.name ?? ''}`;
      default: return `viewer|${(this.viewerReveal?.cards ?? []).join(',')}`;
      }
    },
    focusCount(): number {
      switch (this.mode) {
      // The discard tray is NOT in the focus ring — it is opened by R3 only,
      // so the received cards own the selection frame alone.
      case 'drawn': return this.drawnUntaken.length;
      case 'viewer': return this.viewerReveal?.cards.length ?? 0;
      default: return 0;
      }
    },
    /**
     * The cards this batch's conditional search turned over and threw away.
     * Server truth (the reveal's own sequence) — the client neither derives
     * nor re-orders it. Empty for a plain draw: no tray, nothing to inspect.
     */
    discardedCards(): Array<CardModel> {
      const seq = this.drawnEvent?.sequence;
      if (seq === undefined) {
        return [];
      }
      return seq.filter((step) => !step.matched).map((step) => step.card);
    },
  },
  watch: {
    /*
     * LATCH the workspace ownership for this batch (see `ownedBatchKey`).
     * `immediate` because the rising edge is at or before mount — the claim is
     * live from submit time — and that is precisely what makes the latch
     * ordering-free at the falling edge, which is the frame that used to open
     * a fullscreen viewer over a card already flying to the dock.
     */
    workspaceOwnedStamp: {
      immediate: true,
      handler(stamp: string): void {
        if (stamp !== '') {
          this.ownedBatchKey = stamp;
        }
      },
    },
    revealKey() {
      this.focusIdx = 0;
      // A NEW BATCH decides its take grammar once, against the live dock.
      this.refreshDockReachable();
      // A fresh reveal (result mode) restarts the deck→slot flight from the top.
      if (this.mode === 'result' && this.lastReveal !== undefined) {
        this.scheduleResultFlight();
      }
    },
    focusCount(now: number) {
      if (this.focusIdx >= now) {
        this.focusIdx = Math.max(0, now - 1);
      }
    },
    // The batch (or its card count) changed — re-derive the embedded fit
    // against the fresh row. Also covers the first population after mount.
    stripCount() {
      if (this.embedded && this.mode === 'drawn') {
        void this.$nextTick(() => this.fitEmbeddedStrip());
      }
    },
    /**
     * THE FIT'S LIFECYCLE RIDES THE EMBED, NOT THE MOUNT. The overlay is one
     * re-homed instance (`<Teleport>` re-targets, `mounted()` never re-runs),
     * so «embedded» has real edges mid-life: the workspace publishes its zone
     * a flush after the batch arrives, a standalone batch follows an embedded
     * one, a park retracts the slot. Rising edge → install the measured fit
     * (the same `wsStageLayout` solve the deck pick uses — count-aware from
     * the real zone box); falling edge → tear it down and drop the solved
     * zoom, so a standalone presentation honestly reads its own ladder.
     */
    // The seat is absolutely placed, so its arrival/departure moves no box any
    // observer watches — the fit has to be told. (The reserve is measured off
    // the DOM, so a `$nextTick` is what makes the read see the new state.)
    sourceSeat() {
      void this.$nextTick(() => this.scheduleEmbedFit());
    },
    verdictFitEligible(on: boolean) {
      if (on) {
        this.installVerdictFit();
      } else {
        this.teardownVerdictFit();
      }
    },
    // The verdict's own content arrives in beats (the card flies, then the
    // panel resolves), and none of those moves the BAND — so the fit is
    // re-asked on the stage it is drawn for.
    resultStage() {
      if (this.verdictFitEligible) {
        void this.$nextTick(() => this.fitVerdictStage());
      }
    },
    embedFitEligible(on: boolean) {
      if (on) {
        this.installEmbedFit();
      } else {
        this.teardownEmbedFit();
        this.teardownVerdictFit();
      }
    },
    // Single-card reveal: (re-)open the fullscreen whenever it should be
    // showing but isn't — the initial mount is handled in mounted(); this
    // covers a multi→single batch transition and any unexpected close.
    singleCardNeedsFullscreen(needs: boolean) {
      if (needs) {
        this.openSingleCardFullscreen();
      }
    },
    // SURFACE MOTION: while a scene VEILS the mounted reveal (its frame is
    // measured but invisible, the cards still flying) the shared shade must
    // stay dark-free too — else the field dims before the scene hands over.
    bonusVeiled: {
      immediate: true,
      handler(veiled: boolean): void {
        setRevealVeilSuppressed(veiled);
      },
    },
    /**
     * THE STAGE NAME GOES UP. An embedded surface never titles itself — it
     * hands its name to the workspace's breadcrumb, which is the ONE line that
     * says where the player is: «КАРТЫ В РУКЕ › ПРОВЕРКА ПРОЕКТА › РЕЗУЛЬТАТ
     * ВСКРЫТИЯ». Without this the crumb falls back to its host's generic
     * («ДОБОР КАРТ» for a play), i.e. it would name a stage that is not the one
     * on screen.
     *
     * Only the RESULT publishes: the drawn stage's own name is already handed
     * up by its host (the composer's phase), and a second writer would fight it.
     */
    resultEmbedPhase: {
      immediate: true,
      handler(on: boolean): void {
        if (on) {
          setWorkspaceOutcomePhase(focusKicker('reveal'));
        } else if (workspaceOutcomeState.phaseKey === focusKicker('reveal')) {
          // Only OUR key — the claim may already be naming another stage.
          setWorkspaceOutcomePhase('');
        }
      },
    },
  },
  mounted() {
    // The take grammar is decided by WHERE THE CARDS CAN GO, so it is sampled
    // the moment this batch has a surface (and again per batch — see the
    // revealKey watcher). `nextTick` because an embedded host may still be
    // unfolding: the dock is what we measure, but its own layer settles in
    // the same flush the workspace opens in.
    this.refreshDockReachable();
    void this.$nextTick(() => this.refreshDockReachable());
    if (this.singleCardNeedsFullscreen) {
      this.openSingleCardFullscreen();
    }
    // The deck-check RESULT (SearchForLife / AsteroidDeflection, incl. a
    // ProjectInspection repeat) reveals its card with the SAME premium
    // deck→slot flight + flip the in-frame Action Center uses.
    if (this.mode === 'result' && this.lastReveal !== undefined) {
      this.scheduleResultFlight();
    }
    // EMBEDDED: the shared row fit sizes the strip (one size source with the
    // buy pick). The mount edge asks for itself; the LIFECYCLE belongs to the
    // `embedFitEligible` watcher — the overlay is ONE re-homed instance, so
    // `embedded` routinely flips true AFTER mount (the teleport re-targets
    // when the workspace publishes its zone) and a mounted()-only install
    // left `embedFitZoom` at 0 forever: the received cards then fell back to
    // the coarse count ladder and rendered as thumbnails in a huge zone.
    if (this.embedFitEligible) {
      this.installEmbedFit();
    }
    if (this.verdictFitEligible) {
      this.installVerdictFit();
    }
  },
  beforeUnmount() {
    setRevealVeilSuppressed(false);
    // The stage name dies with the stage (the watcher does not fire on unmount).
    if (this.resultEmbedPhase && workspaceOutcomeState.phaseKey === focusKicker('reveal')) {
      setWorkspaceOutcomePhase('');
    }
    this.abortResultFlight();
    this.teardownEmbedFit();
    this.stopRowObs?.();
  },
  methods: {
    dealDelay(i: number): Record<string, string> {
      if (consoleReducedMotionActive()) {
        return {};
      }
      return {animationDelay: `calc(${Math.min(Math.max(i, 0), 12) * 55}ms * var(--motion-scale, 1))`};
    },
    /**
     * INSTALL the embedded-fit machinery (idempotent — the mount edge and the
     * `embedFitEligible` rising edge both ask). Options-API has no effect
     * scope here — the stop handles are kept and released by the teardown.
     */
    installEmbedFit(): void {
      if (this.stopFitResize !== undefined) {
        return;
      }
      void this.$nextTick(() => this.fitEmbeddedStrip());
      this.stopFitResize = useEventListener(window, 'resize', () => this.scheduleEmbedFit());
      // The stage zone GROWS as the workspace unfolds (and again when the
      // command bar / status line settle): a first fit against the opening
      // box is a permanently small card. The observer is the honest wait —
      // never a guessed delay — and the settle pass is its cheap backstop
      // for a growth that produced no observable resize.
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (root !== undefined && root !== null) {
        this.stopFitObs = useResizeObserver(root, () => this.scheduleEmbedFit()).stop;
      }
      this.settleFitTimer = window.setTimeout(() => {
        this.settleFitTimer = undefined;
        this.fitEmbeddedStrip();
      }, motionMs(480));
    },
    /** The embed ended (re-homed standalone / unmount) — release the handles
     *  and drop the solved zoom so the ladder honestly serves standalone. */
    teardownEmbedFit(): void {
      this.stopFitResize?.();
      this.stopFitResize = undefined;
      this.stopFitObs?.();
      this.stopFitObs = undefined;
      if (this.settleFitTimer !== undefined) {
        window.clearTimeout(this.settleFitTimer);
        this.settleFitTimer = undefined;
      }
      this.embedFitZoom = 0;
      this.fitSolvedKey = '';
    },
    /**
     * INSTALL / TEARDOWN the verdict fit — the same protocol as the strip fit
     * (a `$nextTick` first pass, a resize listener, an observer on the box that
     * is actually measured, and a settle backstop for a growth that produced no
     * observable resize).
     */
    installVerdictFit(): void {
      if (this.stopVerdictResize !== undefined) {
        return;
      }
      void this.$nextTick(() => this.fitVerdictStage());
      this.stopVerdictResize = useEventListener(window, 'resize', () => this.fitVerdictStage());
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (root !== undefined && root !== null) {
        this.stopVerdictObs = useResizeObserver(root, () => this.fitVerdictStage()).stop;
      }
      this.verdictSettleTimer = window.setTimeout(() => {
        this.verdictSettleTimer = undefined;
        this.fitVerdictStage();
      }, motionMs(480));
    },
    teardownVerdictFit(): void {
      this.stopVerdictResize?.();
      this.stopVerdictResize = undefined;
      this.stopVerdictObs?.();
      this.stopVerdictObs = undefined;
      if (this.verdictSettleTimer !== undefined) {
        window.clearTimeout(this.verdictSettleTimer);
        this.verdictSettleTimer = undefined;
      }
      this.verdictFit = 0;
    },
    /**
     * SOLVE the verdict band's one factor. Probe protocol as everywhere else:
     * force factor 1 with a direct style write, measure the natural boxes
     * synchronously (no paint happens inside one JS turn), write the solved
     * value back, and mirror it reactively so Vue's next patch cannot fight it.
     */
    fitVerdictStage(): void {
      if (!this.embedded || this.mode !== 'result' || typeof window === 'undefined') {
        return;
      }
      const root = this.$refs.rootEl as HTMLElement | undefined;
      const body = root?.querySelector<HTMLElement>('.con-reveal__body--result');
      if (root === undefined || root === null || body === null || body === undefined) {
        return;
      }
      const scaling = Array.from(body.querySelectorAll<HTMLElement>(
        ':scope > :is(.con-reveal__source, .con-reveal__revealed)'));
      if (scaling.length === 0) {
        return;
      }
      body.style.setProperty('--con-reveal-verdict-fit', '1');
      const cs = window.getComputedStyle(body);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      const gap = parseFloat(cs.columnGap) || parseFloat(cs.gap) || 0;
      const availW = body.clientWidth - padX;
      const availH = body.clientHeight - padY;
      if (availW <= 0 || availH <= 0) {
        body.style.removeProperty('--con-reveal-verdict-fit');
        return;
      }
      // ⚠️ ONE COORDINATE SPACE, AND IT IS THE SCREEN'S. These slots carry a
      // CSS `zoom`, and `offsetWidth`/`offsetHeight` report the element's own
      // UNZOOMED box while `clientWidth`/`clientHeight` on the (unzoomed) band
      // report screen pixels. Mixing them handed the solve a budget inflated by
      // the whole `--con-ui-scale` factor: at 4K it solved `fH = 3.15` for a
      // composition that actually needed 1.57, hit the ceiling instead, and
      // rendered both cards clipped with the verdict panel pushed off the line.
      // Every term below is a bounding rect — the space the budget is in.
      let cardsW = 0;
      let natH = 0;
      for (const el of scaling) {
        const r = el.getBoundingClientRect();
        cardsW += r.width;
        natH = Math.max(natH, r.height);
      }
      // Everything the factor does NOT scale still occupies the line.
      let fixedW = gap * Math.max(0, body.children.length - 1);
      for (const el of Array.from(body.children)) {
        if (!scaling.includes(el as HTMLElement)) {
          fixedW += (el as HTMLElement).getBoundingClientRect().width;
        }
      }
      const f = verdictStageFit({availW, availH, cardsW, fixedW, natH});
      this.verdictFit = f;
      body.style.setProperty('--con-reveal-verdict-fit', f.toFixed(3));
      // The band states its own solve — same reason the strip does.
      body.setAttribute('data-verdict-fit',
        `f=${f} w=${Math.round(availW)} h=${Math.round(availH)} ` +
        `cards=${Math.round(cardsW)} fixed=${Math.round(fixedW)} nat=${Math.round(natH)}`);
    },
    /** rAF-coalesced embedded fit for resize bursts (mirrors the buy host). */
    scheduleEmbedFit(): void {
      if (this.embedFitScheduled || !this.embedded || this.mode !== 'drawn') {
        return;
      }
      this.embedFitScheduled = true;
      requestAnimationFrame(() => {
        this.embedFitScheduled = false;
        this.fitEmbeddedStrip();
      });
    },
    /**
     * ONE SIZE SOURCE with the buy pick: measure the embed zone's real band
     * (zone height − the head/namebar chrome, exactly how the buy fit
     * subtracts ITS chrome) and derive the slot zoom from the SHARED
     * `fitRowZoom` — the same formula over the same kind of measurement, so
     * the received hero is byte-identical to the purchase hero by
     * construction, never by hand-matched constants.
     *
     * Probe protocol (same as the buy host): force the strip to zoom 1 with a
     * DIRECT style write, measure the natural slot box synchronously (no
     * paint happens inside one JS turn), then write the computed zoom back —
     * the reactive mirror (`embedFitZoom`) keeps Vue's next patch writing the
     * same value, so the direct write and the binding can never fight.
     */
    fitEmbeddedStrip(): void {
      if (!this.embedded || this.mode !== 'drawn') {
        return;
      }
      // A LANDING TARGET MUST NOT MOVE UNDER A FLYING COVER. The trade-cover
      // scene measured this strip's slots at launch; re-solving the fit while
      // its covers are airborne (the probe write forces zoom 1 for a frame,
      // then a fresh solve) slides the row under the flight and a cover comes
      // down beside its slot. Defer to a short retry — bounded by the scene's
      // own lifecycle nets — and run the real fit when the cards are handed
      // over.
      //
      // ⚠️ …BUT ONLY A RE-SOLVE. The old guard's premise — «the mount-time fit
      // is untouched, the scene only launches after it» — is FALSE for the
      // path that matters: the trade claims its batch on a PRE-FLUSH watcher,
      // so `cardScene` is already `'fly'` when this overlay mounts and the
      // FIRST fit was deferred too. The strip then rendered at the coarse
      // count-ladder fallback, the covers aimed at THOSE rects, and the real
      // solve landed at the handoff — every card resized under the cards that
      // had just come down on it («карты летят по странной траектории»). A row
      // that has never been solved for this batch must be solved BEFORE
      // anything aims at it; from then on the guard holds it still.
      if (this.fitSolvedKey === this.revealKey &&
          (colonyTradeState.cardScene === 'fly' || colonyTradeState.cardScene === 'ascend' ||
            colonyTradeState.cardScene === 'frame')) {
        if (this.settleFitTimer === undefined) {
          this.settleFitTimer = window.setTimeout(() => {
            this.settleFitTimer = undefined;
            this.fitEmbeddedStrip();
          }, motionMs(180));
        }
        return;
      }
      const root = this.$refs.rootEl as HTMLElement | undefined;
      const strip = root?.querySelector<HTMLElement>('.con-reveal__strip');
      const probe = strip?.querySelector<HTMLElement>('.con-cards__slot');
      if (root === undefined || strip === undefined || strip === null ||
          probe === undefined || probe === null || typeof window === 'undefined') {
        return;
      }
      strip.style.setProperty('--con-cards-zoom', '1');
      const slotW = probe.offsetWidth;
      const slotH = probe.offsetHeight;
      if (slotW <= 0 || slotH <= 0 || strip.clientHeight <= 0) {
        // Not laid out yet (mid-teleport / JSDOM) — bounded frame retries.
        strip.style.removeProperty('--con-cards-zoom');
        if (this.embedFitRetries < 20) {
          this.embedFitRetries++;
          requestAnimationFrame(() => this.fitEmbeddedStrip());
        }
        return;
      }
      this.embedFitRetries = 0;
      // ⚠️ WATCH THE BOX YOU MEASURE. The observer set up in `mounted()` is on
      // the reveal's ROOT, and the root can keep its size while the ROW loses
      // height inside it — the host's panel settling on its own measured need,
      // a status line appearing, the stage's chrome resolving. The fit then
      // keeps a zoom solved for a budget that no longer exists, and a batch
      // that overflows by a card's title is CROPPED, silently, on exactly the
      // profiles where the row is tightest (measured: solved 387px of card into
      // a 318px row at 1080). The row is what the fit reads, so the row is what
      // it watches; its own writes cannot feed back (the row is `flex: 1` in a
      // host-sized frame with `min-height: 0`, so its box is never content-driven).
      if (this.stopRowObs === undefined) {
        this.stopRowObs = useResizeObserver(strip, () => this.scheduleEmbedFit()).stop;
      }
      const cs = window.getComputedStyle(strip);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const colGap = parseFloat(cs.columnGap) || parseFloat(cs.gap) || 14;
      const availW = strip.clientWidth - padX;
      const ui = conUiScale();
      const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
      // THE BUDGET IS THE ROW'S OWN BOX — measured, never reconstructed.
      //
      // The chrome used to be ENUMERATED (frame paddings + heading + margin +
      // status + a column gap + a rounding slack) and an enumeration is only
      // ever as right as its list: at 4K a wrapper's padding sat outside it,
      // the fit handed the row 200px it did not have, and the stage overflowed
      // the column it lives in. The stage is now a strict flex column in which
      // the ROW is the only flexing part (`flex: 1; min-height: 0`), so its own
      // height IS what the stage can spend on cards — no list to keep in sync,
      // and byte-identical to how the buy stage measures its own row.
      const availH = Math.max(200 * ui, strip.clientHeight - padY);
      // The row's occupancy is WHAT THE BATCH HOLDS (`stripCount`: the batch's
      // total cards + the other colonies' zones) — NOT what is left to take.
      // Two shipped bugs live in this line: solving for the flat entries alone
      // clipped the LAST zone on the stage edge (the row was 1-2 slots wider
      // than the budget), and solving for the UNTAKEN remainder re-ran the fit
      // as cards left, so the survivors — and the lone taken-socket — visibly
      // GREW mid-batch. The scale is fixed from the batch's first frame.
      const n = Math.max(this.stripCount, 1);
      // ⚠️ A BONUS ZONE IS NOT A SLOT, AND THE ENGINE ONLY KNOWS SLOTS.
      //
      // `wsStageLayout` solves `n` boxes of exactly `slotW × slotH`. A colony's
      // «Бонус колонии» zone is a slot PLUS its own furniture: a lateral margin
      // that keeps its decorative frame off its neighbour, and a caption that
      // floats ABOVE the row it stands in. Both are real layout the row has to
      // pay for, and neither was in the budget — so a merged Pluto payout (two
      // income cards + two colony zones) solved a shape that could not render:
      // the line came out wider than the width it was solved for, `flex-wrap`
      // broke a card off, the shape gained a row it had no height for, and the
      // stage cropped the cards. Measured from the DOM, never re-stated from
      // LESS: the zone owns those numbers.
      const zoneEls = Array.from(strip.querySelectorAll<HTMLElement>('.con-reveal__bonus-zone'));
      let zoneExtraW = 0;
      let zoneExtraH = 0;
      let zoneCaptionH = 0;
      zoneEls.forEach((zone) => {
        const zs = window.getComputedStyle(zone);
        zoneExtraW += (parseFloat(zs.marginLeft) || 0) + (parseFloat(zs.marginRight) || 0);
        // …and a zone is TALLER than the slot it holds (its own column gap, the
        // waiting cover's box). That difference does not scale with the card —
        // it is a fixed cost on the line's height, and the line is as tall as
        // its tallest item, so the cards must be solved for what is left.
        // ⚠️ NEVER NEGATIVE. The slot is `zoom`ed and the zone is not, so the
        // difference is only a COST while the zone is the taller of the two; a
        // measurement taken mid-write (the probe forces zoom 1, Vue may still
        // be patching the previous value) can read the other way round, and
        // subtracting a negative number GROWS the height budget — a card
        // solved for more room than exists is cropped by the frame, which is
        // the exact fault this whole line exists to remove.
        const inner = zone.querySelector<HTMLElement>('.con-cards__slot');
        if (inner !== null) {
          zoneExtraH = Math.max(zoneExtraH, zone.offsetHeight - inner.offsetHeight, 0);
        }
        const label = zone.querySelector<HTMLElement>('.con-reveal__bonus-zone-label');
        if (label !== null) {
          // How far the caption reaches ABOVE its zone's own box — the
          // clearance a WRAPPED row needs, and which the strip's own padding
          // only ever provided for the first row.
          zoneCaptionH = Math.max(zoneCaptionH,
            zone.getBoundingClientRect().top - label.getBoundingClientRect().top);
        }
      });
      // THE SHARED STAGE LAYOUT: size, focus-safe gap and row shape solved
      // together (consoleWsStageLayout). The gap is an OUTPUT, not a CSS
      // constant — that is what stops a focused card's ring from growing over
      // its neighbour, and what lets a big batch wrap instead of only shrinking.
      // The zone furniture rides in as room the cards may NOT spend (`availW`)
      // and as room the WRAP CAP must still hold (`padXPx`), so the line that
      // gets laid out is the line the shape was solved for.
      // ⚠️ SUBTRACT, NEVER FLOOR. `Math.max(slotW/slotH, …)` reads like a safety
      // rail and is the engine's one forbidden move: a budget raised to a whole
      // unzoomed card is by definition asking for a card that does not fit
      // (`consoleWsStageLayout`: «ceiling only… small honest cards beat cropped
      // ones»). It shipped for one run and cropped the row at 1080 — the fit
      // solved 387 px of card into a 293 px budget it had itself replaced with
      // 460. The clamp here guards a degenerate measurement and nothing else.
      // THE SOURCE SEAT'S SAFE ZONE — the same contract the deck pick honours,
      // for the same reason: a host may stand a compact source card at the left
      // of its zone (the Hydronetwork's repeated action, the start workspace's
      // play-from-hand), the card group is CENTRED, and reserving the seat's
      // width on BOTH sides is what guarantees the margin can never be narrower
      // than the seat — spatial separation by construction, not a z-index and
      // not an overlap the eye forgives.
      //
      // It rides `availW` and NOT `padXPx`: a virtual margin folded into the
      // wrap cap makes the cap wider than the shape it caps (the deck pick's
      // own 4 + 3 → 5 + 2 regression). And the height budget is untouched —
      // the seat is BESIDE the cards, so it may not cost them a single pixel of
      // the height they are the protagonists of.
      const seatReserve = sourceSeatReservePx(ui);
      const layout = wsStageLayout({
        availW: Math.max(1, availW - zoneExtraW - seatReserve * 2),
        availH: Math.max(1, availH - zoneExtraH),
        slotW, slotH, n, ui,
        rowGapPx: colGap + zoneCaptionH,
        padXPx: padX + zoneExtraW,
      });
      this.embedLayoutStyle = wsStageLayoutStyle(layout);
      Object.entries(this.embedLayoutStyle).forEach(([k, v]) => strip.style.setProperty(k, v));
      this.embedFitZoom = layout.zoom;
      this.fitSolvedKey = this.revealKey;
      // THE ROW STATES ITS OWN SOLVE. Every past defect in this engine was
      // diagnosed by guessing which INPUT was wrong, at the one resolution the
      // guesser happened to be looking at; the inputs are what has to be
      // readable. Costs one attribute write per fit.
      strip.setAttribute('data-fit',
        `z=${layout.zoom} w=${Math.round(availW)} h=${Math.round(availH)} ` +
        `slot=${Math.round(slotW)}x${Math.round(slotH)} n=${n} ui=${ui} ` +
        `seat=${Math.round(seatReserve)} rows=${layout.rows}x${layout.perRow}`);
      // THE FIT'S OWN INPUTS, on the row it solved. A cropped batch is always a
      // disagreement between what the engine measured and what the browser laid
      // out, and reading the result alone can never tell them apart — this is
      // the same «state the facts once, where the probe can see them» idiom as
      // `__conColonyDiag`.
      strip.dataset.fit = `w${Math.round(availW - zoneExtraW)} h${Math.round(availH - zoneExtraH)} ` +
        `slot${Math.round(slotW)}x${Math.round(slotH)} n${n} ` +
        `zx${Math.round(zoneExtraW)}/${Math.round(zoneExtraH)} gap${Math.round(colGap)} ` +
        `→ z${layout.zoom.toFixed(3)} r${layout.rows}x${layout.perRow}`;
    },
    // ── RESULT reveal flight (deck → slot + flip; reuses the in-frame director) ──
    /**
     * A face-down card is pulled off the HUD project deck, travels into the
     * revealed-card slot and flips face-up in place — the SAME premium beat the
     * in-frame Action Center reveal plays (shared `runActionRevealFlight` + the
     * shared deal proxy; no animation logic is duplicated). Launched once the
     * modal frame's own entrance settles so the landing rect is stable.
     */
    scheduleResultFlight(): void {
      this.abortResultFlight();
      this.resultStage = 'pending';
      this.resultFlightOn = true;
      this.resultLaunchTimer = window.setTimeout(() => {
        this.resultLaunchTimer = undefined;
        void this.$nextTick(() => this.beginResultFlight());
      }, motionMs(220));
    },
    beginResultFlight(): void {
      if (this.mode !== 'result' || this.lastReveal === undefined) {
        return;
      }
      const proxy = this.$refs.resultProxy as HTMLElement | undefined;
      const flip = this.$refs.resultFlip as HTMLElement | undefined;
      const slotHost = this.$refs.resultSlot as HTMLElement | undefined;
      // Land on the CARD rect (not the padded slot frame) so the proxy → real
      // card swap is pixel-true. The real card is visibility:hidden — it keeps
      // its layout, so its rect is measurable while it stays invisible.
      const slot = slotHost?.querySelector<HTMLElement>('.pcard, .card-container') ?? slotHost;
      if (proxy === undefined || flip === undefined || slot === undefined) {
        // No stage to fly on (torn-down DOM / test runner): show the result now.
        this.resultStage = 'settled';
        this.resultFlightOn = false;
        return;
      }
      this.resultHandle = runActionRevealFlight({
        proxy, flip, slot,
        onFaceShown: () => {
          if (this.resultStage === 'pending') {
            this.resultStage = 'face';
          }
        },
        onSettled: () => {
          // ONE flush: the proxy unmounts and the real card becomes visible
          // together (the proxy landed on the slot — the swap is invisible).
          this.resultStage = 'settled';
          this.resultFlightOn = false;
          this.resultHandle = undefined;
        },
      });
      // The revealed identity is already committed — release the flip so it
      // turns face-up the instant it lands (no waiting on a server payload).
      this.resultHandle.notifyPayload();
    },
    abortResultFlight(): void {
      if (this.resultLaunchTimer !== undefined) {
        window.clearTimeout(this.resultLaunchTimer);
        this.resultLaunchTimer = undefined;
      }
      this.resultHandle?.kill();
      this.resultHandle = undefined;
      this.resultFlightOn = false;
    },
    /** The shell routes every intent here while the MULTI-CARD overlay owns
     *  input (single-card hands off to the shell's zoom handlers entirely). */
    handleIntent(intent: GamepadIntent): void {
      // Single-card: the fullscreen viewer owns the pad (the shell routes to
      // handleZoomIntent). If we're ever reached in the brief window before
      // the auto-open, do nothing — never a bare take without the flight.
      if (this.singleCardMode) {
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      if (intent.kind !== 'press') {
        return;
      }
      // A take turn / the final collection swallows the stick verbs too — a
      // fullscreen (X/L3) opening over a card mid-turn would zoom a surface
      // that is about to change under it. The BATCH ARRIVAL absorbs them for
      // the same reason one level earlier: until every card has landed and the
      // flight proxies have handed over, the slots under this surface are
      // still empty, and a press there would act on a card that is not there.
      if (this.mode === 'drawn' &&
          (this.arrivalPending || this.takingIdx !== undefined || this.collecting)) {
        return;
      }
      // L3 = inspect the SOURCE card fullscreen (screen-specific stick). Drawn
      // mode opens the DRAW SOURCE; result mode opens the acting card that did
      // the deck-check — the same L3 = source idiom, one language.
      if (intent.button === 'stickL' && this.mode === 'drawn') {
        this.zoomSource();
        return;
      }
      if (intent.button === 'stickL' && this.mode === 'result') {
        this.zoomResultSource();
        return;
      }
      // R3 = browse the DISCARD pile of a conditional search (drawn mode). The
      // ONLY way in — the tray is not a focus target, so this never competes
      // with taking a card.
      if (intent.button === 'stickR' && this.mode === 'drawn' && this.discardedCards.length > 0) {
        this.openDiscards();
        return;
      }
      const action = consoleActionOf(intent);
      if (action !== undefined) {
        this.onPress(action);
      }
    },
    onNav(dir: NavDirection): void {
      if (dir !== 'left' && dir !== 'right') {
        return;
      }
      // Navigation is between AVAILABLE cards only; while the batch is still
      // arriving, a take turn plays or the final collection runs, the frame
      // stays where it is (there is nothing under it to move between yet).
      if (this.arrivalPending || this.takingIdx !== undefined || this.collecting) {
        return;
      }
      const count = this.focusCount;
      if (count === 0) {
        return;
      }
      const next = Math.min(count - 1, Math.max(0, this.focusIdx + (dir === 'right' ? 1 : -1)));
      if (next !== this.focusIdx) {
        this.focusIdx = next;
        void this.$nextTick(() => {
          const slot = this.$refs.focusedCardSlot as HTMLElement | Array<HTMLElement> | undefined;
          const el = Array.isArray(slot) ? slot[0] : slot;
          // Snap while a take / collection / FLIP episode owns the strip: a
          // SMOOTH scroll retargets the container for ~300ms UNDER transforms
          // whose deltas were measured against the pre-scroll layout — the
          // cards then glide against a moving floor.
          const busy = this.takingIdx !== undefined || this.collecting || this.arrivalPending;
          el?.scrollIntoView({inline: 'center', block: 'nearest', behavior: busy ? 'auto' : 'smooth'});
        });
      }
    },
    // Foundation: SEMANTIC actions — A(primary) take/dismiss, X(inspect) zoom,
    // RT(nextTab)/B(back) take-all/dismiss. L3 source-zoom handled in handleIntent.
    onPress(action: ConsoleAction): void {
      switch (this.mode) {
      case 'drawn':
        // The cards are physically arriving — no take, no take-all, no
        // hand-over can be triggered mid-flight (and no double-press can slip
        // through the beat). Same swallow for the take-in-place turn and the
        // final collection: `taking`/`collecting` absorb EVERY verb, so a
        // near-simultaneous A+B is exactly one transaction by construction.
        if (this.arrivalPending || this.takingIdx !== undefined || this.collecting) {
          return;
        }
        if (action === 'primary') {
          // Once everything is taken, A IS the payout's closing step; while
          // cards remain it keeps its ordinary "take the focused card" job.
          if (this.discardStepReady) {
            this.openDiscardPick();
          } else {
            this.takeFocused();
          }
        } else if (action === 'inspect') {
          // P13 global rule: X reads the focused card fullscreen.
          this.zoomFocused();
        } else if (action === 'nextTab' || action === 'back') {
          // Take-all is the shortcut, never an exit: with nothing left to take
          // and a discard owed, the modal has no dismiss action at all.
          if (this.drawnUntaken.length > 0) {
            this.takeAll();
          }
        }
        return;
      case 'result':
        // A VERDICT IS TERMINAL: nothing is chosen, owed or continued after it,
        // so «ОК» is the only way out and B is not on offer (the bar advertises
        // A/X/L3 and nothing else). B used to dismiss here as an unadvertised
        // alias — harmless standalone, but embedded it is the same press that
        // means «свернуть», and a verdict that keeps no decision alive has
        // nothing to be minimized to (consoleWorkspaceFlow 'verdict').
        if (action === 'inspect') {
          this.zoomRevealed();
        } else if (action === 'primary') {
          this.$emit('dismiss-result');
        }
        return;
      default:
        if (action === 'inspect') {
          this.zoomViewerCard();
        } else if (action === 'primary' || action === 'nextTab' || action === 'back') {
          closeRevealViewer();
        }
        return;
      }
    },
    /** PHYSICAL zoom origin over this overlay's `data-zoom-slot` tiles; the
     *  strip focus follows the fullscreen browse (drawn duplicates are keyed
     *  `name#i`, so two copies of one card resolve to distinct slots). */
    zoomOriginFor(keyOf: (i: number) => string, follow: boolean) {
      return slotZoomOrigin(
        // The EXPLICIT root ref, never `$el`: this template opens with a
        // comment, so a dev build keeps it and the component root is a
        // FRAGMENT whose `$el` is that Comment node — `querySelector` is
        // absent and `slotZoomOrigin` silently degrades to "no physical
        // origin" (the card would appear from nowhere and return to nowhere).
        // Prod strips comments, which is exactly why it stayed invisible.
        () => this.$refs.rootEl as HTMLElement | undefined,
        keyOf,
        follow ? (i) => {
          this.focusIdx = i;
          void this.$nextTick(() => {
            const slot = this.$refs.focusedCardSlot as HTMLElement | Array<HTMLElement> | undefined;
            const el = Array.isArray(slot) ? slot[0] : slot;
            // Same snap-under-episode rule as focusStep (see there).
            const busy = this.takingIdx !== undefined || this.collecting || this.arrivalPending;
            el?.scrollIntoView({inline: 'center', block: 'nearest', behavior: busy ? 'auto' : 'smooth'});
          });
        } : undefined,
      );
    },
    /** P13: X fullscreen for the focused card (MULTI-CARD only) — with the
     *  RECEIVE bridge so A takes the card / RT takes all WITHOUT leaving the
     *  viewer (until the last card, which closes it). Shared take logic. */
    zoomFocused(): void {
      const entries = this.drawnUntaken;
      const list = entries.map((e) => e.card);
      if (list.length === 0) {
        return;
      }
      openConsoleCardZoom(list, this.focusIdx, undefined, undefined, {
        receive: {
          takeLabel: 'Take card',
          takeAt: (idx) => this.takeFromZoom(idx),
          takeAllLabel: list.length > 1 ? 'Take all cards' : undefined,
          takeAll: list.length > 1 ? () => this.takeAllFromZoom() : undefined,
        },
        origin: this.zoomOriginFor((i) => {
          const e = this.drawnUntaken[i];
          return e !== undefined ? `${e.card.name}#${e.index}` : '';
        }, true),
      });
    },
    /**
     * Browse the cards the search discarded — READ-ONLY, and only ever on the
     * player's own initiative (the hero scene never stops to let them be
     * read). B returns to the modal with focus intact, exactly like the
     * played-events pile. No receive bridge: these cards are not takeable.
     */
    openDiscards(): void {
      const list = this.discardedCards;
      if (list.length === 0) {
        return;
      }
      openConsoleCardZoom(list, 0, undefined, undefined, {
        statusLabel: 'Discarded card',
        // The pile IS the physical origin — the viewer lifts out of it.
        origin: {
          kind: 'physical',
          resolve: () => (this.$refs.rootEl as HTMLElement | undefined)?.querySelector<HTMLElement>('.con-reveal__discard-pile') ?? null,
        },
      });
    },
    /** L3: inspect the DRAW SOURCE card fullscreen (multi-card modal). The
     *  read-only source names itself «ИСТОЧНИК ДОБОРА»; B returns to the modal
     *  (focus/scroll/selection preserved — the modal was never unmounted). */
    zoomSource(): void {
      const s = this.drawnSource;
      if (s === undefined || s.type !== 'card') {
        return;
      }
      // The SOURCE card is a real object standing in the workspace's hero
      // column — L3 lifts THAT card (its slot is held empty while the viewer
      // is up), never opens a second identical copy beside it. A standalone
      // reveal has no composer on screen: the resolver returns null and the
      // viewer degrades to its textual entrance on its own.
      openConsoleCardZoom([{name: s.cardName} as CardModel], 0, undefined, undefined, {
        statusLabel: 'Draw source',
        origin: workspaceSourceZoomOrigin(String(s.cardName)),
      });
    },
    zoomRevealed(): void {
      const r = this.lastReveal;
      if (r !== undefined) {
        openConsoleCardZoom([r.revealed], 0, undefined, undefined, {
          origin: this.zoomOriginFor(() => `revealed:${r.revealed.name}`, false),
        });
      }
    },
    /** L3: inspect the SOURCE (acting) card fullscreen — the read-only card that
     *  performed the deck-check; B returns to the result (never unmounted). */
    zoomResultSource(): void {
      const r = this.lastReveal;
      if (r !== undefined) {
        openConsoleCardZoom([{name: r.action} as CardModel], 0, undefined, undefined, {
          statusLabel: 'Source',
          origin: this.zoomOriginFor(() => `source:${r.action}`, false),
        });
      }
    },
    zoomViewerCard(): void {
      const names = this.viewerReveal?.cards ?? [];
      if (names.length > 0) {
        openConsoleCardZoom(names.map((name) => ({name}) as CardModel), this.focusIdx, undefined, undefined, {
          origin: this.zoomOriginFor((i) => `${names[i]}#${i}`, true),
        });
      }
    },
    // ── SINGLE-CARD reveal (headless → fullscreen) ─────────────────────
    /**
     * Open the single received card DIRECTLY in the fullscreen viewer. The
     * reveal IS the fullscreen: mandatory (no close but a take), a textual
     * rise-from-depth entrance, the receive bridge (A departs the card to the
     * player), and — when the source is an inspectable card — the L3 swap
     * bridge (received ⇄ source). No card tile on screen → textual origin.
     */
    openSingleCardFullscreen(): void {
      const card = this.singleCard;
      if (card === undefined) {
        return;
      }
      // A STAGED batch: a scene's proxy already stands where the card should
      // be — the board card-bonus cover at its presentation point, or the
      // deck-draw card in its hold zone. The viewer opens with a PHYSICAL
      // origin resolving to that proxy, so the existing zoom FLIP lifts the
      // very card that flew (and `con-zoom-hold` hides the proxy the frame
      // the flight starts) — never a fresh copy over a dissolving one.
      const bonusEntrance = isBoardCardBonusActive() && isBonusRevealStaged(this.drawnEvent?.id);
      const deckEntrance = isDeckDrawActive() && isDeckDrawStaged(this.drawnEvent?.id);
      const tradeEntrance = isColonyTradeActive() && isColonyTradeRevealStaged(this.drawnEvent?.id);
      const physicalOrigin = bonusEntrance ? () => bonusZoomOriginEl() :
        (deckEntrance ? () => deckDrawZoomOriginEl() :
          (tradeEntrance ? () => colonyTradeZoomOriginEl() : undefined));
      openConsoleCardZoom([card], 0, undefined, undefined, {
        receive: this.singleReceiveBridge(),
        swap: this.singleSwapBridge('received'),
        sourceInfo: this.singleSourceInfo(),
        // R3 peeks the conditional-search discard pile — the fullscreen twin of
        // the multi-card modal's R3 (the headless single-card presentation had
        // no way in). Only wired when the search actually discarded something.
        discards: this.discardedCards.length > 0 ? () => this.openDiscards() : undefined,
        receivedCount: this.drawnEvent?.cards.length ?? 1,
        statusLabel: 'Received card',
        mandatory: true,
        origin: physicalOrigin !== undefined ? {kind: 'physical', resolve: physicalOrigin} : {kind: 'textual'},
      });
    },
    /**
     * The STATIC source chip for the single-card fullscreen when the source is
     * NOT an inspectable card (a tile / colony bonus — «ИСТОЧНИК · Бонус
     * клетки»). A card source is shown interactively via the swap bridge (L3)
     * instead, so this returns undefined for it.
     */
    singleSourceInfo(): {label: string, name: string} | undefined {
      const chip = this.sourceChip;
      if (chip === undefined || chip.inspectable) {
        return undefined;
      }
      // A lone COLONY-BONUS card (a merged trade batch whose only card came
      // from the settlement bonus) names its wave, not just the colony.
      const segments = this.drawnEvent?.tradeSegments;
      const bonusOnly = segments !== undefined && segments.length > 0 &&
        segments.every((s) => s.role === 'bonus');
      return {label: bonusOnly ? 'Colony bonus payout' : 'Source', name: chip.name};
    },
    /** The single-card receive bridge — A departs the card from fullscreen. */
    singleReceiveBridge(): ConsoleZoomReceive {
      return {
        takeLabel: 'Take card',
        takeAt: () => this.singleCardTake(),
        departFromFullscreen: true,
      };
    },
    /**
     * The L3 swap bridge — present only when the source is an inspectable
     * card. `showing` names the card CURRENTLY on screen, so the bridge points
     * L3 at the OTHER one (received ⇄ source).
     */
    singleSwapBridge(showing: 'received' | 'source'): ConsoleZoomSwap | undefined {
      const s = this.drawnSource;
      const received = this.singleCard;
      if (s === undefined || s.type !== 'card' || received === undefined) {
        return undefined;
      }
      return showing === 'received' ?
        {label: 'Source', otherName: s.cardName as CardName, swap: () => this.showSource()} :
        {label: 'Received card', otherName: received.name, swap: () => this.showReceived()};
    },
    /** L3 from the received card → show the SOURCE (read-only, no take). */
    showSource(): void {
      const s = this.drawnSource;
      if (s === undefined || s.type !== 'card') {
        return;
      }
      repointConsoleCardZoom({name: s.cardName} as CardModel, {
        swap: this.singleSwapBridge('source'),
        statusLabel: 'Draw source',
      });
    },
    /** L3 from the source → back to the RECEIVED card (take re-armed). */
    showReceived(): void {
      const card = this.singleCard;
      if (card === undefined) {
        return;
      }
      repointConsoleCardZoom(card, {
        receive: this.singleReceiveBridge(),
        swap: this.singleSwapBridge('received'),
        statusLabel: 'Received card',
      });
    },
    /**
     * A on the single received card — the BARE commit. The premium DEPART
     * flight (playZoomDepart) already ran on the fullscreen stage (the shell
     * owns it), so this only marks the card taken + releases + acks the batch;
     * the reveal then resolves (the overlay unmounts) and the dialog closes.
     */
    singleCardTake(): void {
      const e = this.drawnEvent;
      const entry = this.drawnUntaken[0];
      if (e === undefined || entry === undefined) {
        return;
      }
      closeAndReleaseEvent(this.playerView.id, e.id, () => markCardTaken(e.id, entry.index));
    },
    // ── MULTI-CARD take (from the strip / from fullscreen) ─────────────
    /** The live slot element for a drawn/viewer card (data-zoom-slot key). */
    exitSlotFor(key: string): HTMLElement | null {
      // Explicit ref — see zoomOriginFor: `$el` is a Comment in dev builds.
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (root === undefined || typeof root.querySelector !== 'function') {
        return null;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(key) : key.replace(/"/g, '\\"');
      return root.querySelector<HTMLElement>(`[data-zoom-slot="${esc}"]`);
    },
    /** A: take the focused card (last one closes + releases + acks).
     *  HAND-INTAKE cinematic (handDeliveryDirector): the card physically
     *  lifts off the reveal surface, arcs into the bottom-centre hand dock
     *  flipping face → back, and LAYS ONTO its real pack slot — the «КАРТЫ»
     *  counter ticks on the touchdown, never before. State commits the
     *  frame the proxy stands ready, so the real card never blinks; the
     *  flight lives on the app-level delivery layer, surviving the overlay
     *  closing on the last take. Reduced motion → the bare commit. */
    takeFocused(): void {
      // FALLBACK GRAMMAR: no reachable dock → the take happens IN THE SLOT
      // (flip face-down + stay) and the batch flies as one stack at the end.
      if (this.embeddedMulti) {
        this.takeInPlace();
        return;
      }
      const e = this.drawnEvent;
      const entry = this.drawnUntaken[this.focusIdx];
      if (e === undefined || entry === undefined) {
        return;
      }
      // EMBEDDED, several cards, dock reachable: this take is one of MANY —
      // the stage may only detach on the LAST one, or the workspace would
      // fold while the player still owes takes.
      const lastOfBatch = this.drawnUntaken.length === 1;
      const commit = () => {
        if (this.drawnUntaken.length > 1) {
          markCardTaken(e.id, entry.index);
          return;
        }
        // The LAST card. A payout that still owes its discard does NOT close:
        // the cards land in the hand, and the modal stays up on its closing
        // step (released + acknowledged when the player presses it).
        //
        // ⚠️ HOLD FIRST, DECIDE A TICK LATER. This commit runs at the intake's
        // own seam, which can land mid view-update — reading the discard
        // marker on that exact frame once caught it BLINKED-OFF, the batch
        // closed as if free of obligations, and the whole colony workspace
        // folded out from under a live mandatory discard (the e2e timeline:
        // claim → completeFlow → goBoardHome inside 400 ms). The provisional
        // hold costs one invisible tick when no discard is owed; deciding on
        // settled state is what makes the close honest.
        markCardTaken(e.id, entry.index);
        holdRevealForFollowUp(e.id);
        void this.$nextTick(() => {
          if (this.bonusDiscard !== undefined) {
            return; // the closing step (openDiscardPick) owns the release
          }
          releaseRevealFollowUp();
          closeAndReleaseEvent(this.playerView.id, e.id, () => undefined);
          this.$emit('drawn-complete');
        });
      };
      const slot = this.exitSlotFor(`${entry.card.name}#${entry.index}`);
      void runHandIntake([{name: entry.card.name, el: slot ?? undefined}], {
        commit,
        // SEAMLESS: the take's commit REMOVES this card (and, embedded, closes
        // the whole stage with it). Committing before the proxies exist left a
        // three-frame hole — card blinks out, surface folds, and only then the
        // flight starts. Staged, the proxy is already standing over the card
        // when the state changes: one continuous object, no gap.
        commitAt: 'staged',
        // EMBEDDED: the workspace must get out of the way BEFORE the cards
        // fly — the hand dock is what they aim at, and `onStaged` is the seam
        // where the proxies already stand over them, so releasing the frame
        // there overlaps the collapse with the flight instead of sequencing
        // them. Identical to the purchase handoff; one language for both.
        // Only on the LAST take: with a reachable dock every card flies as it
        // is taken, and the stage has to stand until the batch is finished.
        onStaged: this.embedded && lastOfBatch ? () => this.$emit('result-detached') : undefined,
      });
    },
    /** Sample the destination (see `handDockReachable`) — the ONE input that
     *  picks this batch's take grammar. */
    refreshDockReachable(): void {
      this.dockReachable = handDockReachable();
    },
    /**
     * TAKE-IN-PLACE (embedded multi): A starts the in-slot press+turn on the
     * focused card. The state records ONLY the intent (`takingIdx`); the
     * taken fact commits on the animation's own end event — never a timer —
     * so a fast second press, a B during the turn or an unmount mid-turn can
     * never double-commit or strand the batch.
     */
    takeInPlace(): void {
      if (this.takingIdx !== undefined || this.collecting) {
        return;
      }
      const e = this.drawnEvent;
      const entry = this.drawnUntaken[this.focusIdx];
      if (e === undefined || entry === undefined) {
        return;
      }
      if (consoleReducedMotionActive()) {
        // No turn to wait for — commit the same state transition directly.
        this.commitTakeInPlace(entry.index);
        return;
      }
      this.takingIdx = entry.index;
    },
    /** The in-slot turn finished — commit the taken state + advance focus. */
    onTakeFlipEnd(index: number, ev: AnimationEvent): void {
      // The chassis raises animationend for every child animation (the deal-in
      // replays under reduced layouts, the mark's own fade) — only the take
      // turn commits a take.
      if (this.takingIdx !== index || !String(ev.animationName || '').includes('con-take-turn')) {
        return;
      }
      this.commitTakeInPlace(index);
    },
    commitTakeInPlace(index: number): void {
      const e = this.drawnEvent;
      this.takingIdx = undefined;
      if (e === undefined || e.takenIndices.has(index)) {
        return;
      }
      // Focus advance: the right neighbour slides into the taken card's
      // untaken position; when the last one went, the nearest LEFT card takes
      // the frame. Computed BEFORE the mark and applied in the same tick, so
      // the frame can never rest on the taken card for even one render.
      const takenPos = this.drawnUntaken.findIndex((u) => u.index === index);
      // ⚠️ THE LAST CARD IS NOT MARKED HERE. `currentRevealEvent()` keys on
      // «are any cards still untaken», so this mark is what ENDS the reveal:
      // the shell drops the event, this overlay unmounts, and the collection
      // that was about to start finds nothing to collect. The turn is recorded
      // locally instead (the row keeps the card face-down all the same) and
      // the batch commits inside the intake's staged seam — which is exactly
      // what «Взять всё» has always done.
      if (this.drawnUntaken.length === 1) {
        this.turnedIdx = index;
        this.collectTaken();
        return;
      }
      markCardTaken(e.id, index);
      const left = this.drawnUntaken.length;
      this.focusIdx = Math.max(0, Math.min(takenPos < 0 ? this.focusIdx : takenPos, left - 1));
    },
    /**
     * THE FINAL COLLECTION (embedded multi): every card is face-down in its
     * slot — the batch gathers into ONE physical stack and rides the EXISTING
     * hand-intake bridge (app-level proxies that survive the workspace fold:
     * `onStaged` folds the frame under them, the stack then peels into the
     * dock — the same handoff, the same code path as every other take-all).
     * Cards already face-down spawn their proxies BACK side out
     * (`HandIntakeEntry.back`), so a flipped card never flashes open.
     */
    collectTaken(): void {
      if (this.collecting) {
        return;
      }
      const e = this.drawnEvent;
      if (e === undefined) {
        return;
      }
      this.collecting = true;
      const entries = e.cards.map((card, index) => ({
        name: card.name,
        el: this.exitSlotFor(`${card.name}#${index}`) ?? undefined,
        // The last card is face-down too — its turn played, it simply is not
        // committed yet (see `turnedIdx`), so its proxy must spawn back-out
        // like every other one or it would flash open on the way to the dock.
        back: e.takenIndices.has(index) || this.turnedIdx === index,
      }));
      void runHandIntake(entries, {
        mode: 'stack',
        commitAt: 'staged', // see takeFocused — the cards must not blink out
        commit: () => {
          closeAndReleaseEvent(this.playerView.id, e.id, () => markAllTaken(e.id));
          this.$emit('drawn-complete');
        },
        onStaged: () => {
          this.$emit('result-detached');
        },
      });
    },
    /**
     * THE CLOSING STEP: release the held batch (ack the reveal) and hand the
     * player over to the discard pick. The press IS the acknowledgement of the
     * mandatory beat, so the shell opens the hand overlay straight away instead
     * of announcing the prompt a second time — from the player's side the same
     * payout simply continues into "now choose what goes".
     */
    openDiscardPick(): void {
      const e = this.drawnEvent;
      if (e === undefined || !this.discardStepReady) {
        return;
      }
      releaseRevealFollowUp();
      closeAndReleaseEvent(this.playerView.id, e.id, () => undefined);
      this.$emit('discard-pick');
    },
    /** RT / B: take everything — the STACK intake gesture: the fan gathers
     *  into one back-stack above the hand dock (one confirmation pulse),
     *  then the cards peel off bottom-first into their real pack slots,
     *  the counter ticking with every landing (handDeliveryDirector). */
    takeAll(): void {
      const e = this.drawnEvent;
      if (e === undefined) {
        return;
      }
      // EMBEDDED MULTI: «взять всё» IS the final collection — untaken cards
      // fly open-faced into the forming stack (the gather's own flip turns
      // them), already-taken ones join it back side out. One guard window
      // with the per-card take: B during a turn / a second B does nothing.
      if (this.embeddedMulti) {
        if (this.takingIdx !== undefined || this.collecting) {
          return;
        }
        this.collectTaken();
        return;
      }
      const commit = () => {
        // HOLD FIRST, DECIDE A TICK LATER — the same seam-blink defence as the
        // per-card take above: a discard marker sampled mid view-update once
        // read as absent and closed a batch that still owed its mandatory step.
        markAllTaken(e.id);
        holdRevealForFollowUp(e.id);
        void this.$nextTick(() => {
          if (this.bonusDiscard !== undefined) {
            return; // the closing step (openDiscardPick) owns the release
          }
          releaseRevealFollowUp();
          closeAndReleaseEvent(this.playerView.id, e.id, () => undefined);
          this.$emit('drawn-complete');
        });
      };
      const entries = this.drawnUntaken
        .map((entry) => ({name: entry.card.name, el: this.exitSlotFor(`${entry.card.name}#${entry.index}`) ?? undefined}));
      void runHandIntake(entries, {
        mode: 'stack',
        commitAt: 'staged', // see takeFocused — the cards must not blink out
        commit,
        onStaged: this.embedded ? () => this.$emit('result-detached') : undefined,
      });
    },
    /**
     * A from FULLSCREEN (MULTI-CARD) — the shell has ALREADY choreographed the
     * viewer's close (the card flew back into its reveal slot), so this just
     * SYNCS the focus to the inspected card and runs the SAME premium take as
     * an in-modal A (the hand intake — lift off the slot + lay into the dock).
     */
    takeFromZoom(idx: number): void {
      this.focusIdx = Math.max(0, Math.min(idx, this.drawnUntaken.length - 1));
      // nextTick: the dialog just closed — let the reveal strip settle so the
      // take reads the live focused slot rect.
      void this.$nextTick(() => this.takeFocused());
    },
    /** RT from FULLSCREEN (MULTI-CARD) — the shell already closed the viewer;
     *  run the SAME premium stack intake as an in-modal RT. */
    takeAllFromZoom(): void {
      void this.$nextTick(() => this.takeAll());
    },
  },
});
</script>

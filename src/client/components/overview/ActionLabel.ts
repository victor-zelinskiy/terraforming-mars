// Labels describing what the player is currently doing in the game flow.
// The label is the INTERNAL key — the player-facing text + visual category
// are derived from it in `playerStatusPresenter.ts`. Add a label here when
// a new state needs distinct presentation; don't reuse an existing label for
// a different meaning.
//
// Convention: active states (server waits for input from this player) come
// first. The presenter maps each of them to the same "active" visual category
// but to its own player-facing label so the player understands what specifically
// they're being asked to do.
export type ActionLabel =
  | 'turn'             // ACTION phase — taking a regular action AND `player.isActive`
                       // (server's activePlayer === this player). Carries the 1/2
                       // step counter via the presenter's `showCounter` flag.
                       // Если сервер ждёт ввод, но `isActive===false` (триггер-
                       // реакция типа Philares или off-turn ответ), лейбл
                       // вырождается в `'forcedaction'` — тот же визуальный
                       // active-стиль, но БЕЗ счётчика, потому что слот хода
                       // не тратится.
  | 'forcedaction'     // Сервер ждёт ввод, но это не регулярный action-слот:
                       // спасовавший игрок получил триггер (Philares и т.п.),
                       // off-turn реакция, форсированный выбор в нестандартной
                       // фазе. Презентер выдаёт active-категорию + dot, но
                       // `showCounter: false`.
  | 'researching'      // RESEARCH phase, gen 2+ — buying drafted cards (3 M€ each).
  | 'drafting'         // DRAFTING phase — between-generation pick-and-pass draft.
  | 'initialdrafting'  // Initial picks: either INITIALDRAFTING phase
                       // (initial-draft variant) OR RESEARCH phase on gen 1
                       // (corporation + starting hand select). Both surface as
                       // "СТАРТОВЫЙ ВЫБОР" because that's the player-facing
                       // concept — the technical phase distinction is irrelevant.
  | 'preludes'         // PRELUDES phase — playing prelude cards.
  | 'ceos'             // CEOS phase — playing CEO opportunity cards.
  | 'globalsupport'    // World Government Terraforming — picking which global
                       // parameter to bump as the "world government" (SOLAR phase).
  | 'delegate'         // Turmoil delegate placement / party choice prompt.
  | 'bottheater'       // MarsBot's already-resolved turn is being replayed by
                       // the client turn theater. The server never waits on the
                       // bot (its turn resolves synchronously), so this is the
                       // ONLY "active" window the other participants ever see
                       // for it — presented exactly like a human's turn (active
                       // category, pulsing dot), just without the 1/2 counter.
  | 'passed'           // Player has passed this generation; server is not
                       // waiting on them (Philares-style exceptions land in one
                       // of the active states because `isWaiting` is checked
                       // first — see playerLabels.ts).
  | 'ready'            // Simultaneous-pick phase (initial draft / draft /
                       // research): player has already submitted this round and
                       // is waiting for the others to finish. Distinct from
                       // `waiting` because the visual category is positive
                       // ("done your part") rather than passive ("idle").
  | 'next'             // ACTION phase: the player who will act immediately after
                       // the currently-active one. Shown only in 3+ player games.
  | 'waiting'          // Generic idle — game is running, server not waiting on
                       // this player, no simultaneous-pick context to mark them
                       // as "ready". Player-facing "ОЖИДАЕТ".
  | 'none'             // Nothing meaningful to show (END phase). Renders the
                       // status row invisibly so the card height stays constant.
  | '';

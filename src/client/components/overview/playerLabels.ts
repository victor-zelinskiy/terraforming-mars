import {ViewModel, PublicPlayerModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {ActionLabel} from './ActionLabel';

const SHOW_NEXT_LABEL_MIN = 2;

export function playerIndexInList(
  color: PublicPlayerModel['color'],
  players: ReadonlyArray<PublicPlayerModel>,
): number {
  for (let idx = 0; idx < players.length; idx++) {
    if (players[idx].color === color) {
      return idx;
    }
  }
  return -1;
}

/**
 * Returns the status label for `player` in the current game state.
 *
 * Source of truth for "is the server waiting on this player?" is
 * `livePlayersWaitingFor` when provided (continuous-poll signal — stays
 * in sync across all clients without requiring a full view refresh),
 * otherwise the per-player `isWaitingForInput` snapshot from the model.
 * Past versions used `player.isActive` / `needsToDraft` / `needsToResearch`
 * which can stay stale across phase transitions (e.g. when ACTION ends
 * and a Turmoil prompt fires, `activePlayer` may still point at the
 * last actor, but it is NOT the one being prompted).
 *
 * The phase-specific label distinguishes WHAT they're being waited on
 * for: action turn / research / drafting / Turmoil decision.
 */
export function actionLabelForPlayer(
  playerView: ViewModel,
  player: PublicPlayerModel,
  livePlayersWaitingFor?: ReadonlyArray<Color>,
): ActionLabel {
  const game = playerView.game;

  // Источник истины — `waitingFor` сервера: если сервер чего-то ждёт от
  // игрока, статус ОБЯЗАН показать это, даже если игрок уже спасовал
  // в этом поколении. Реальный кейс: Philares-эффект (или любой другой
  // триггер) даёт спасовавшему игроку выбор ресурса / тайла / карты в
  // ответ на действие соперника. Со старым порядком «passed первым»
  // такая ситуация оставалась под подписью «СПАСОВАЛ», и было совершенно
  // неочевидно, что игра ждёт ввода. Поэтому isWaiting проверяется
  // ПЕРВЫМ; статус 'passed' остаётся как fallback, когда сервер не ждёт
  // ввода.
  //
  // «Passer-flash» (короткая вспышка «ДЕЙСТВИЕ 1/2» сразу после пасса)
  // при новом порядке не возвращается: isPlayerWaiting гейтит результат
  // через `player.isWaitingForInput`, и серверная модель ставит этот
  // флаг в false атомарно с попаданием игрока в `passedPlayers`. То
  // есть к моменту, когда мы видим passedPlayers с новым именем,
  // isWaitingForInput уже false — isWaiting вернёт false, и мы корректно
  // упадём в ветку 'passed' ниже. Лаг живого `playersWaitingFor`-поллинга
  // здесь не играет роли, потому что isPlayerWaiting сначала смотрит
  // в модель.
  const isWaiting = isPlayerWaiting(player, livePlayersWaitingFor);

  if (isWaiting) {
    // A specific prompt-kind from the server (World Government Terraforming
    // or Turmoil delegate) takes priority over the generic phase-based label.
    // Detection is in ServerModel.detectWaitingForKind — based on the title
    // of the player's current waitingFor.
    if (player.waitingForKind === 'globalsupport') {
      return 'globalsupport';
    }
    if (player.waitingForKind === 'delegate') {
      return 'delegate';
    }

    switch (game.phase) {
    case Phase.INITIALDRAFTING:
      return 'initialdrafting';
    case Phase.DRAFTING:
      return 'drafting';
    case Phase.PRELUDES:
      return 'preludes';
    case Phase.CEOS:
      return 'ceos';
    case Phase.RESEARCH:
      // First generation в RESEARCH-фазе — это стартовый выбор (корпорация +
      // покупка стартовой руки), а не обычная межпоколенческая покупка
      // карт. Игровая фаза одинаковая (`gotoInitialResearchPhase` ставит
      // RESEARCH), отличается по generation. Player-facing лейбл
      // «СТАРТОВЫЙ ВЫБОР» покрывает оба пути входа в стартовый экран:
      // initial-draft variant (INITIALDRAFTING) и initial research
      // (RESEARCH gen 1).
      return game.generation === 1 ? 'initialdrafting' : 'researching';
    default:
      // Default-ветка ловит ACTION / SOLAR / END. `'turn'` имеет смысл (и
      // несёт счётчик 1/2) ТОЛЬКО когда это регулярный action-слот игрока:
      // фаза ACTION + сервер реально считает этого игрока активным
      // (`player.isActive === player.id === game.activePlayer.id`).
      //
      // Все остальные waiting-кейсы внутри этой ветки — триггер-реакции:
      //   • Philares: спасовавший Victor получил выбор ресурса в ответ на
      //     соседство тайла, поставленного оппонентом. game.phase === ACTION,
      //     но активный игрок — оппонент. Слот хода Victor не тратится.
      //   • Off-turn reactions любых карт (Steel-tax, прочее).
      //   • Final greenery placements в END и форсированные SOLAR-промпты.
      //
      // Для них лейбл вырождается в 'forcedaction' — тот же premium active-
      // визуал (cyan dot + glow), но `showCounter: false` в presenter'e,
      // потому что 1/2 счётчик у такой реакции не имеет смысла.
      return (game.phase === Phase.ACTION && player.isActive) ?
        'turn' :
        'forcedaction';
    }
  }

  if (game.passedPlayers.includes(player.color)) {
    return 'passed';
  }

  // "next" label is only meaningful during ACTION phase — show it on the
  // player who's up immediately after the current actor (so multi-player
  // games have a clear "you're on deck" hint).
  if (game.phase === Phase.ACTION) {
    const notPassedPlayers = playerView.players.filter(
      (p) => !game.passedPlayers.includes(p.color),
    );
    const currentPlayerIndex = playerIndexInList(player.color, notPassedPlayers);
    if (currentPlayerIndex !== -1 && playerView.players.length > SHOW_NEXT_LABEL_MIN) {
      const prevPlayerIndex = currentPlayerIndex === 0 ?
        notPassedPlayers.length - 1 :
        currentPlayerIndex - 1;
      if (isPlayerWaiting(notPassedPlayers[prevPlayerIndex], livePlayersWaitingFor)) {
        return 'next';
      }
    }
  }

  // Simultaneous-pick фазы (initial draft / draft / research) — если сервер
  // не ждёт ввода и игрок не passed, значит он уже отправил свой выбор и
  // ждёт остальных. Это позитивное «ГОТОВ», а не пассивное «ОЖИДАЕТ» —
  // визуально другая категория (см. presentPlayerStatus).
  if (game.phase === Phase.INITIALDRAFTING ||
      game.phase === Phase.DRAFTING ||
      game.phase === Phase.RESEARCH) {
    return 'ready';
  }

  // Нейтральное «ожидает» (раньше возвращалось 'none' и подпись просто
  // пропадала). Партия идёт, игрок не активен и не passed — он реально
  // ждёт; явный статус снимает у наблюдателя ощущение «карта без статуса
  // == забытый игрок». END-фаза остаётся 'none' — там показывать нечего.
  if (game.phase === Phase.END) {
    return 'none';
  }
  return 'waiting';
}

function isPlayerWaiting(
  player: PublicPlayerModel,
  livePlayersWaitingFor: ReadonlyArray<Color> | undefined,
): boolean {
  // Two signals carry "is this player being waited on by the server":
  //
  //  - `player.isWaitingForInput` from the playerView model — set when the
  //    server built the playerView (i.e. atomically with the POST response
  //    that resolved the previous action).
  //  - `livePlayersWaitingFor` from an independent poll timer in
  //    WaitingFor.vue — updates between full playerView refreshes so the
  //    UI can track simultaneous-action phases (drafting, research)
  //    without requiring a model refresh.
  //
  // When they disagree, the right tiebreaker depends on which is fresher.
  // The "passer-flash" bug is the canonical disagreement: the viewer just
  // passed, the POST response arrives with a fresh model where
  // `isWaitingForInput=false`, but the live poll hasn't caught up yet and
  // still lists the viewer as waiting. Trusting the live signal here makes
  // the LeftPlayerCard flash "ДЕЙСТВИЕ 1/2" for a tick before the poll
  // refreshes (because `actionsTakenThisRound` was reset to 0).
  //
  // Rule: if the model says NOT waiting, trust it — there's no realistic
  // scenario where the server-built playerView says false while the live
  // signal correctly says true (the live poll can update WITHOUT a model
  // refresh, but every model refresh comes from the server after the new
  // state is committed, so the model is never "behind" on `false`).
  if (!player.isWaitingForInput) {
    return false;
  }
  // Model says waiting. Defer to live signal when available — it can
  // legitimately disagree by saying "not waiting" if another player
  // resolved their simultaneous prompt between model refreshes.
  return livePlayersWaitingFor !== undefined ?
    livePlayersWaitingFor.includes(player.color) :
    true;
}

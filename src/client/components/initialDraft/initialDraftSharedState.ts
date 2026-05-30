import {reactive} from 'vue';
import {Phase} from '@/common/Phase';
import {PlayerViewModel} from '@/common/models/PlayerModel';

/*
 * Shared reactive state initial-draft экрана.
 *
 * Поле `active` — два consumer'a:
 *   - InitialDraftFlowOverlay (writer) — обновляет `active` каждый раз,
 *     когда его computed `isActive` меняется (waitingFor.type === 'initialCards'
 *     ИЛИ awaiting-окно после submit'a).
 *   - PlayerHome (reader) — использует `active` чтобы решить, монтировать
 *     ли InitialDraftStatusRail. Без shared state PlayerHome полагался
 *     бы только на waitingFor (которое становится undefined сразу после
 *     submit'a) и снимал rail в неподходящий момент — игрок больше не
 *     видел бы, кого мы ждём, и это нарушало бы изначальный контракт
 *     rail'а.
 *
 * Это та же паттерна, что `placementLockState.ts` — module-level
 * reactive() с импортом из обоих сторон, без EventBus или provide/inject.
 */
export const initialDraftSharedState = reactive({
  active: false,
});

/*
 * Awaiting-окно «я отправил выбор стартовых карт, жду остальных игроков»
 * ВЫВОДИТСЯ напрямую из серверного playerView, а не хранится в локальном
 * флаге. Это ключ к «железной» работе блокировки:
 *
 *   - переживает любой playerkey++ remount <player-home> (overlay живёт
 *     ВНУТРИ player-home и пересоздаётся на каждом remount);
 *   - переживает перезагрузку страницы (после F5 состояние восстанавливается
 *     из того же серверного view);
 *   - не может «протечь» в research-фазу следующего поколения (см. guard
 *     по generation ниже).
 *
 * Три условия одновременно:
 *
 *   1. generation === 1 — начальный выбор карт всегда идёт в первом
 *      поколении (Game.generation стартует с 1 и инкрементится только в
 *      production-фазе). Guard ОБЯЗАТЕЛЕН: в research-фазе поколений 2+
 *      тоже бывает `phase===RESEARCH && waitingFor===undefined` (игрок
 *      сдал карты драфта и ждёт остальных), но это уже зона ответственности
 *      DraftFlowOverlay, а не initial-draft overlay'a.
 *
 *   2. phase === RESEARCH — prompt 'initialCards' (выбор корпорации/
 *      прелюдий/CEO/проектов) сервер шлёт именно в фазе RESEARCH (см.
 *      Game.gotoInitialResearchPhase → `this.phase = Phase.RESEARCH`), а
 *      НЕ в INITIALDRAFTING (на той идёт только драфт проектов). Фаза
 *      остаётся RESEARCH, пока хоть один игрок не подтвердил выбор:
 *      Game.playerIsFinishedWithResearchPhase меняет её на ACTION только
 *      когда researchedPlayers.size === players.length. Прежний код
 *      проверял `=== INITIALDRAFTING` — оно НИКОГДА не выполнялось,
 *      поэтому awaiting не включался и экран сразу уходил в игру. Это
 *      и был баг.
 *
 *   3. waitingFor === undefined — до submit'a у игрока активен prompt
 *      'initialCards' (waitingFor определён), и overlay показывает экран
 *      выбора. Сервер очищает waitingFor ровно когда наш ответ принят, а
 *      партия ещё не стартовала — это и есть момент входа в awaiting.
 *
 * Как только сервер уводит партию из этого состояния (все игроки
 * подтвердили → phase становится PRELUDES / CEOS / ACTION), предикат даёт
 * false: overlay снимается, игрок видит игровой UI (в т.ч. чтобы разыграть
 * собственные прелюдии).
 */
export function isInitialDraftAwaiting(view: PlayerViewModel | undefined): boolean {
  if (view === undefined) {
    return false;
  }
  return view.game.generation === 1 &&
    view.game.phase === Phase.RESEARCH &&
    view.waitingFor === undefined;
}

/**
 * Должен ли App-level `playerkey++` remount <player-home> быть ПРОПУЩЕН
 * для этого обновления playerView? Да — пока мы в awaiting-окне начального
 * драфта.
 *
 * InitialDraftFlowOverlay живёт ВНУТРИ <player-home>, поэтому без этого
 * предиката случайный poll-driven `updatePlayer` (любой REFRESH от сервера)
 * уничтожал бы overlay вместе с собранной summary — даже когда другие
 * игроки ещё не закончили выбор. С предикатом overlay переживает любые
 * промежуточные обновления (плавный reactive swap playerView), а remount
 * происходит ровно один раз — когда сервер реально уводит партию из
 * awaiting-окна (тогда предикат даёт false). Полный аналог
 * shouldPreserveCardPickModal для draft/buy-модала.
 */
export function shouldPreserveInitialDraftOverlay(view: PlayerViewModel | undefined): boolean {
  return isInitialDraftAwaiting(view);
}

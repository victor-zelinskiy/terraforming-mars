import {reactive} from 'vue';

/*
 * Shared reactive state initial-draft экрана.
 *
 * Два consumer'a:
 *   - InitialDraftFlowOverlay (writer) — обновляет `active` каждый раз,
 *     когда его computed `isActive` меняется (waitingFor.type === 'initialCards'
 *     ИЛИ awaitingOtherPlayers).
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

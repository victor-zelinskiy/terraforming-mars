/*
 * Client-side AI story STATE (Iteration 20 §17). Module-level reactive so it survives the
 * App `:key="playerkey"` remount (like the other endgame module states). Default is
 * `fallback` — with no backend wired the deterministic story renders, so the AI layer is a
 * pure enhancement and never blocks the screen (§19).
 */
import {reactive} from 'vue';
import type {EndgameAiStoryState} from '@/common/endgame/aiStory';

export const endgameAiStoryState = reactive<EndgameAiStoryState>({status: 'fallback'});

export function resetAiStory(): void {
  endgameAiStoryState.status = 'fallback';
  endgameAiStoryState.story = undefined;
  endgameAiStoryState.errorCode = undefined;
}

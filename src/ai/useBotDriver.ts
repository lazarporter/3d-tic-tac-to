import { useEffect } from 'react';
import { isOver } from '../game/engine';
import { useStore } from '../store';
import { chooseMove } from './bot';

const THINK_MS = { easy: 450, medium: 650 } as const;
const SHOW_MS = 380; // how long the chosen cell glows before the piece lands

/**
 * Plays the computer's moves. Whenever it's a bot's turn: pause briefly, pick a move,
 * highlight it with the normal selection glow, then place it. Any change to the game
 * (undo, new game, switching seats) cancels a pending move.
 */
export function useBotDriver() {
  const game = useStore((s) => s.game);
  const level = useStore((s) => s.players[s.game.current]);

  useEffect(() => {
    if (isOver(game) || level === 'human') return;
    const { setBotThinking, select } = useStore.getState();
    setBotThinking(true);
    let place: ReturnType<typeof setTimeout> | undefined;
    const think = setTimeout(() => {
      if (useStore.getState().game !== game) return;
      const move = chooseMove(game.board, game.current, level);
      select(move);
      place = setTimeout(() => {
        if (useStore.getState().game === game) useStore.getState().botMove(move);
      }, SHOW_MS);
    }, THINK_MS[level]);
    return () => {
      clearTimeout(think);
      if (place) clearTimeout(place);
      useStore.getState().setBotThinking(false);
    };
  }, [game, level]);
}

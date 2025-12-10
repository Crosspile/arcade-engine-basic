
import { GameModel } from './games/GameModel';
import type { SoundEmitter } from './engine/types';

const DEBUG_HANDLERS: Record<string, (game: GameModel) => void> = {
    // A single, generic handler that calls the game's own debug method.
    default: (game) => {
        // Check if the game instance has implemented its own debug action.
        if (typeof (game as any).debugAction === 'function') {
            (game as any).debugAction();
        }
    }
};

type GameModule = {
    default: new (audio?: SoundEmitter) => GameModel;
};

export interface GameDefinition {
    id: string;
    name: string;
    // The class is now loaded via a dynamic import function
    loader: () => Promise<GameModule>;
    debug?: (game: GameModel) => void;
}

// The single source of truth for all games
const ALL_GAMES: GameDefinition[] = [
    // The 'as any' cast is no longer needed if the imported modules have a default export.
    { id: 'geometryshowcase', name: 'Geo Showcase', loader: () => import('./games/GeometryShowcase'), debug: DEBUG_HANDLERS.default },
    { id: 'spaceinvaders', name: 'Space Invaders', loader: () => import('./games/SpaceInvaders'), debug: DEBUG_HANDLERS.default },
    { id: 'snake', name: 'Snake', loader: () => import('./games/Snake') as any, debug: DEBUG_HANDLERS.default },
    { id: 'sokoban', name: 'Sokoban', loader: () => import('./games/Sokoban'), debug: DEBUG_HANDLERS.default },
    { id: 'match3', name: 'Match-3', loader: () => import('./games/Match3'), debug: DEBUG_HANDLERS.default},
    { id: 'tetris', name: 'Tetris', loader: () => import('./games/Tetris'), debug: DEBUG_HANDLERS.default },
    { id: '2048', name: '2048', loader: () => import('./games/Game2048'), debug: DEBUG_HANDLERS.default },
    { id: 'lightsout', name: 'Lights Out', loader: () => import('./games/LightsOut'), debug: DEBUG_HANDLERS.default },
    { id: 'minesweeper', name: 'Minesweeper', loader: () => import('./games/Minesweeper'), debug: DEBUG_HANDLERS.default },
    { id: 'memory', name: 'Memory', loader: () => import('./games/Memory'), debug: DEBUG_HANDLERS.default },
    { id: 'simon', name: 'Simon', loader: () => import('./games/Simon'), debug: DEBUG_HANDLERS.default },
    { id: 'tictactoe', name: 'Tic Tac Toe', loader: () => import('./games/TicTacToe'), debug: DEBUG_HANDLERS.default },
    { id: 'sliding', name: 'Sliding Puzzle', loader: () => import('./games/SlidingPuzzle'), debug: DEBUG_HANDLERS.default },
    { id: 'whackamole', name: 'Whack-A-Mole', loader: () => import('./games/WhackAMole'), debug: DEBUG_HANDLERS.default },
    { id: 'samegame', name: 'SameGame', loader: () => import('./games/SameGame'), debug: DEBUG_HANDLERS.default },
    { id: 'mazerun', name: 'Maze Run', loader: () => import('./games/MazeRun'), debug: DEBUG_HANDLERS.default },
    { id: 'sudoku', name: 'Sudoku', loader: () => import('./games/Sudoku'), debug: DEBUG_HANDLERS.default },
    { id: 'crossword', name: 'Mini Crossword', loader: () => import('./games/Crossword'), debug: DEBUG_HANDLERS.default },
    { id: 'pacman', name: 'Pacman', loader: () => import('./games/Pacman'), debug: DEBUG_HANDLERS.default },
];


// Generate the registry map from the single source of truth
export const GAME_REGISTRY: Record<string, GameDefinition> = {};
ALL_GAMES.forEach(game => {
    GAME_REGISTRY[game.id] = game;
});

// Generate the game list for the UI from the single source of truth
export const GAME_LIST = ALL_GAMES.map(({ id, name }) => ({ id, name }));

// Generate the game IDs list
export const GAME_IDS = ALL_GAMES.map(g => g.id);

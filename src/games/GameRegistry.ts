
import { GameModel } from './GameModel';
import { SokobanGame } from './Sokoban';
import { Match3Game } from './Match3';
import { TetrisGame } from './Tetris';
import { SnakeGame } from './Snake';
import { Game2048 } from './Game2048';
import { LightsOutGame } from './LightsOut';
import { Minesweeper } from './Minesweeper';
import { MemoryGame } from './Memory';
import { SimonGame } from './Simon';
import { TicTacToe } from './TicTacToe';
import { SlidingPuzzle } from './SlidingPuzzle';
import { Connect4 } from './Connect4';
import { WhackAMole } from './WhackAMole';
import { SameGame } from './SameGame';
import { Flappy } from './Flappy';
import { Sudoku } from './Sudoku';
import { Crossword } from './Crossword';
import { ZumZumGame } from './ZumZum';
import { MazeRun } from './MazeRun';
import { SoundEmitter } from '../types';
import { BubbleShooterGame } from './BubbleShooter';

const DEBUG_HANDLERS: Record<string, (game: GameModel) => void> = {
    '2048': (game) => {
        const g = game as Game2048;
        // Cheat: Spawn a 2048 tile
        const empty = [];
        for(let x=0;x<4;x++) for(let y=0;y<4;y++) if(!g.pieces.find(p=>p.x===x&&p.y===y)) empty.push({x,y});
        if(empty.length) {
            const p = empty[0];
            g.pieces.push({ id: `debug_${Math.random()}`, x: p.x, y: p.y, value: 2048, type: 11 });
            g.emit();
        }
    },
    // Fallback for most games to just trigger their win condition
    default: (game) => {
        if ((game as any).handleWin) {
            (game as any).handleWin();
        } else if ((game as any).checkWin) {
            (game as any).checkWin(); // Attempt force check
            if(!game.isGameOver) game.updateScore(1000); // If checkWin didn't trigger, just give points
        } else {
            game.updateScore(1000);
        }
    }
};

export interface GameDefinition {
    id: string;
    name: string;
    class: new (audio?: SoundEmitter) => GameModel;
    debug?: (game: GameModel) => void;
}

// The single source of truth for all games
const ALL_GAMES: GameDefinition[] = [
    { id: 'bubble', name: 'Bubble Shooter', class: BubbleShooterGame, debug: DEBUG_HANDLERS.default },
    { id: 'sokoban', name: 'Sokoban', class: SokobanGame, debug: DEBUG_HANDLERS.default },
    { id: 'match3', name: 'Match-3', class: Match3Game, debug: DEBUG_HANDLERS.default},
    { id: 'tetris', name: 'Tetris', class: TetrisGame, debug: DEBUG_HANDLERS.default },
    { id: 'snake', name: 'Snake', class: SnakeGame, debug: DEBUG_HANDLERS.default },
    { id: '2048', name: '2048', class: Game2048, debug: DEBUG_HANDLERS['2048'] },
    { id: 'lightsout', name: 'Lights Out', class: LightsOutGame, debug: DEBUG_HANDLERS.default },
    { id: 'minesweeper', name: 'Minesweeper', class: Minesweeper, debug: DEBUG_HANDLERS.default },
    { id: 'memory', name: 'Memory', class: MemoryGame, debug: DEBUG_HANDLERS.default },
    { id: 'simon', name: 'Simon', class: SimonGame, debug: DEBUG_HANDLERS.default },
    { id: 'tictactoe', name: 'Tic Tac Toe', class: TicTacToe, debug: DEBUG_HANDLERS.default },
    { id: 'sliding', name: 'Sliding Puzzle', class: SlidingPuzzle, debug: DEBUG_HANDLERS.default },
    { id: 'connect4', name: 'Connect 4', class: Connect4, debug: DEBUG_HANDLERS.default },
    { id: 'whackamole', name: 'Whack-A-Mole', class: WhackAMole, debug: DEBUG_HANDLERS.default },
    { id: 'samegame', name: 'SameGame', class: SameGame, debug: DEBUG_HANDLERS.default },
    { id: 'mazerun', name: 'Maze Run', class: MazeRun, debug: DEBUG_HANDLERS.default },
    { id: 'flappy', name: 'Flappy', class: Flappy, debug: DEBUG_HANDLERS.default },
    { id: 'sudoku', name: 'Sudoku', class: Sudoku, debug: DEBUG_HANDLERS.default },
    { id: 'crossword', name: 'Mini Crossword', class: Crossword, debug: DEBUG_HANDLERS.default },
    { id: 'zumzum', name: 'ZumZum', class: ZumZumGame, debug: DEBUG_HANDLERS.default },
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

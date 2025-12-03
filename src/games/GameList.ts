
export interface GameMeta {
    id: string;
    name: string;
}

export const GAME_LIST: GameMeta[] = [
    { id: 'bubble', name: 'Bubble Shooter' },
    { id: 'match3', name: 'Match-3' },
    { id: 'sokoban', name: 'Sokoban' },
    { id: 'tetris', name: 'Tetris' },
    { id: 'snake', name: 'Snake' },
    { id: '2048', name: '2048' },
    { id: 'lightsout', name: 'Lights Out' },
    { id: 'minesweeper', name: 'Minesweeper' },
    { id: 'memory', name: 'Memory' },
    { id: 'simon', name: 'Simon' },
    { id: 'tictactoe', name: 'Tic Tac Toe' },
    { id: 'sliding', name: 'Sliding Puzzle' },
    { id: 'connect4', name: 'Connect 4' },
    { id: 'whackamole', name: 'Whack-A-Mole' },
    { id: 'samegame', name: 'SameGame' },
    { id: 'mazerun', name: 'Maze Run' },
    { id: 'flappy', name: 'Flappy' },
    { id: 'sudoku', name: 'Sudoku' },
    { id: 'crossword', name: 'Mini Crossword' },
    { id: 'zumzum', name: 'ZumZum' },
    { id: 'towerblox', name: 'Tower Blox' }
];

export const GAME_IDS = GAME_LIST.map(g => g.id);

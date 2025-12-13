import { GameModel } from './GameModel';
import type { GameItem, InputAction, SoundEmitter } from '../engine/types';

const INVALID = 0;
const HOLE = 1;
const PEG = 2;

export default class PegSolitaire extends GameModel {
    grid: number[][] = [];
    selected: { x: number, y: number } | null = null;
    pegCount = 0;

    constructor(audio?: SoundEmitter) {
        super(7, 7, 'pegsolitaire', audio);
    }

    start() {
        this.level = 1;
        this.startLevel();
    }

    startLevel() {
        this.isGameOver = false;
        this.resize(7, 7);
        // English Board Layout (Standard Cross)
        // 0 0 1 1 1 0 0
        // 0 0 1 1 1 0 0
        // 1 1 1 1 1 1 1
        // 1 1 1 1 1 1 1
        // 1 1 1 1 1 1 1
        // 0 0 1 1 1 0 0
        // 0 0 1 1 1 0 0

        const mask = [
            [0,0,1,1,1,0,0],
            [0,0,1,1,1,0,0],
            [1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1],
            [1,1,1,1,1,1,1],
            [0,0,1,1,1,0,0],
            [0,0,1,1,1,0,0]
        ];

        this.grid = [];
        this.pegCount = 0;

        // Initialize Grid based on mask
        for(let x=0; x<7; x++) {
            this.grid[x] = [];
            for(let y=0; y<7; y++) {
                const val = mask[6-y][x]; 
                this.grid[x][y] = val === 1 ? HOLE : INVALID;
            }
        }

        if (this.level === 1) {
            // Standard Start: All pegs except center
            for(let x=0; x<7; x++) for(let y=0; y<7; y++) {
                if (this.grid[x][y] === HOLE) {
                    this.grid[x][y] = PEG;
                    this.pegCount++;
                }
            }
            this.grid[3][3] = HOLE;
            this.pegCount--;
        } else {
            // Procedural: Reverse generation
            // Start with winning state (one peg in center)
            this.grid[3][3] = PEG;
            this.pegCount = 1;

            // Number of reverse moves to attempt (increases with level)
            const targetMoves = 15 + Math.floor(this.level * 2); 
            let moves = 0;
            let attempts = 0;
            
            while(moves < targetMoves && attempts < 1000) {
                attempts++;
                // Find all pegs that can "un-jump" (Reverse of a capture)
                // C (PEG) jumps backwards over B (HOLE) to A (HOLE) -> Result: C=HOLE, B=PEG, A=PEG
                const candidates: {x:number, y:number, dx:number, dy:number}[] = [];
                const dirs = [[0,1], [0,-1], [1,0], [-1,0]];
                
                for(let x=0; x<7; x++) for(let y=0; y<7; y++) {
                    if (this.grid[x][y] === PEG) {
                        for(const d of dirs) {
                            const mx = x + d[0], my = y + d[1]; // Middle
                            const ax = x + d[0]*2, ay = y + d[1]*2; // Destination (Start of jump)
                            
                            if (ax>=0 && ax<7 && ay>=0 && ay<7) {
                                if (this.grid[mx][my] === HOLE && this.grid[ax][ay] === HOLE) {
                                    candidates.push({x, y, dx: d[0], dy: d[1]});
                                }
                            }
                        }
                    }
                }
                
                if (candidates.length > 0) {
                    const move = candidates[Math.floor(Math.random() * candidates.length)];
                    const mx = move.x + move.dx, my = move.y + move.dy;
                    const ax = move.x + move.dx*2, ay = move.y + move.dy*2;
                    
                    this.grid[move.x][move.y] = HOLE; // The peg that jumped moves back
                    this.grid[mx][my] = PEG;          // The captured peg returns
                    this.grid[ax][ay] = PEG;          // The jumper returns to start
                    this.pegCount++; // Net +1 peg (1 removed, 2 added)
                    moves++;
                } else {
                    break; // No more moves possible
                }
            }
        }

        this.selected = null;
        this.status$.next(`Level ${this.level}`);
        this.emit();
    }

    handleInput(action: InputAction) {
        if (this.isGameOver) return;

        if (action.type === 'SELECT' && action.data?.gridPos) {
            const { x, y } = action.data.gridPos;
            if (x < 0 || x >= 7 || y < 0 || y >= 7) return;

            const cell = this.grid[x][y];

            if (cell === PEG) {
                // Select this peg
                this.selected = { x, y };
                this.audio.playSelect();
                this.emit();
            } else if (cell === HOLE && this.selected) {
                // Attempt move
                this.tryMove(this.selected, { x, y });
            } else {
                // Deselect if clicking invalid area or same peg
                this.selected = null;
                this.emit();
            }
        }
    }

    tryMove(from: {x: number, y: number}, to: {x: number, y: number}) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;

        // Must jump exactly 2 spaces orthogonally
        if ((Math.abs(dx) === 2 && dy === 0) || (Math.abs(dy) === 2 && dx === 0)) {
            const midX = from.x + dx / 2;
            const midY = from.y + dy / 2;

            if (this.grid[midX][midY] === PEG) {
                // Valid Jump
                this.grid[from.x][from.y] = HOLE;
                this.grid[midX][midY] = HOLE; // Remove jumped peg
                this.grid[to.x][to.y] = PEG;
                
                this.pegCount--;
                this.selected = null;
                
                this.audio.playMove();
                this.effects$.next({ type: 'PARTICLE', x: midX, y: midY, color: 0xff0000, style: 'PUFF' });
                
                this.checkGameState();
                this.emit();
            } else {
                this.audio.playTone(150, 'sawtooth', 0.1); // Error sound
            }
        } else {
            this.selected = null;
            this.emit();
        }
    }

    checkGameState() {
        if (this.pegCount === 1) {
            if (this.grid[3][3] === PEG) {
                this.status$.next('PERFECT!');
                this.updateScore(1000);
            } else {
                this.status$.next('SOLVED!');
                this.updateScore(500);
            }
            this.handleWin();
            return;
        }

        // Check if any moves possible
        const dirs = [[0,2], [0,-2], [2,0], [-2,0]];
        let canMove = false;
        for(let x=0; x<7; x++) for(let y=0; y<7; y++) {
            if (this.grid[x][y] === PEG) {
                for(const d of dirs) {
                    const tx = x + d[0], ty = y + d[1];
                    const mx = x + d[0]/2, my = y + d[1]/2;
                    if (tx >= 0 && tx < 7 && ty >= 0 && ty < 7 && this.grid[tx][ty] === HOLE && this.grid[mx][my] === PEG) {
                        canMove = true;
                        break;
                    }
                }
            }
            if (canMove) break;
        }

        if (!canMove) {
            this.status$.next('GAME OVER');
            this.isGameOver = true;
            this.audio.playGameOver();
            setTimeout(() => this.effects$.next({ type: 'GAMEOVER' }), 2000);
        }
    }

    handleWin() {
        this.audio.playMatch();
        this.effects$.next({ type: 'EXPLODE', x: 3, y: 3, color: 0x00ff00, style: 'EXPLODE' });
        this.isGameOver = true; // Block input during transition
        setTimeout(() => {
            this.level++;
            this.startLevel();
        }, 2000);
    }

    emit() {
        const items: GameItem[] = [];
        for(let x=0; x<7; x++) {
            for(let y=0; y<7; y++) {
                const val = this.grid[x][y];
                if (val !== INVALID) {
                    // Board hole visual
                    items.push({ id: `b_${x}_${y}`, x, y, type: 0, scale: 0.8 }); 
                    
                    if (val === PEG) {
                        const isSel = this.selected && this.selected.x === x && this.selected.y === y;
                        items.push({ id: `p_${x}_${y}`, x, y, type: isSel ? 2 : 1 });
                    }
                }
            }
        }
        this.state$.next(items);
    }

    getRenderConfig() {
        return {
            geometry: {
                0: 'Cylinder', // Hole
                1: 'Sphere',   // Peg
                2: 'Sphere'    // Selected Peg
            },
            colors: {
                0: 0x222222, // Dark Grey Hole
                1: 0x00aaff, // Blue Peg
                2: 0xffaa00  // Orange Selected
            },
            bgColor: 0x111111
        };
    }

    // Debug cheat
    debugAction() {
        this.grid.forEach(col => col.fill(HOLE));
        this.grid[3][3] = PEG;
        this.pegCount = 1;
        this.checkGameState();
        this.emit();
    }
}
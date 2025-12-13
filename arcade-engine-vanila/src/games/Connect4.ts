import { GameModel } from './GameModel';
import type { GameItem, InputAction, SoundEmitter } from '../engine/types';

export default class Connect4 extends GameModel {
    grid: number[][] = []; // 7 cols x 6 rows. 0=Empty, 1=P1, 2=CPU
    turn = 1;
    cursor = 3;

    constructor(audio?: SoundEmitter) {
        super(7, 6, 'connect4', audio);
    }

    start() {
        this.level = 1;
        this.startLevel();
    }

    startLevel() {
        this.isGameOver = false;
        this.resize(7, 6);
        this.grid = Array(7).fill(0).map(() => Array(6).fill(0));
        this.turn = 1;
        this.cursor = 3;
        this.status$.next('Your Turn');
        this.emit();
    }

    handleInput(action: InputAction) {
        if (this.isGameOver || this.turn !== 1) return;

        if (action.type === 'LEFT' && this.cursor > 0) {
            this.cursor--;
            this.emit();
        } else if (action.type === 'RIGHT' && this.cursor < 6) {
            this.cursor++;
            this.emit();
        } else if (action.type === 'SELECT') {
            if (this.dropPiece(this.cursor, 1)) {
                this.audio.playMove();
                this.emit();
                if (this.checkWin(1)) {
                    this.handleWin(1);
                } else {
                    this.turn = 2;
                    this.status$.next('CPU Turn');
                    setTimeout(() => this.cpuMove(), 600);
                }
            } else {
                this.audio.playTone(150, 'sawtooth', 0.1);
            }
        }
    }

    dropPiece(col: number, player: number): boolean {
        for (let y = 0; y < 6; y++) {
            if (this.grid[col][y] === 0) {
                this.grid[col][y] = player;
                return true;
            }
        }
        return false;
    }

    cpuMove() {
        if (this.isGameOver) return;

        // Simple AI: 1. Win, 2. Block, 3. Random
        let move = -1;

        // Check win/block
        for(let p of [2, 1]) {
            for(let c=0; c<7; c++) {
                // Simulate drop
                const tempY = this.grid[c].indexOf(0);
                if (tempY !== -1) {
                    this.grid[c][tempY] = p;
                    if (this.checkWin(p)) {
                        move = c;
                        this.grid[c][tempY] = 0; // Undo
                        break;
                    }
                    this.grid[c][tempY] = 0; // Undo
                }
            }
            if (move !== -1) break;
        }

        if (move === -1) {
            // Random valid column
            const valid = [0,1,2,3,4,5,6].filter(c => this.grid[c][5] === 0);
            if (valid.length > 0) move = valid[Math.floor(Math.random() * valid.length)];
        }

        if (move !== -1) {
            this.dropPiece(move, 2);
            this.audio.playMove();
            this.emit();
            if (this.checkWin(2)) {
                this.handleWin(2);
            } else if (this.grid.every(col => col[5] !== 0)) {
                this.status$.next('DRAW');
                this.isGameOver = true;
                setTimeout(() => this.startLevel(), 2000);
            } else {
                this.turn = 1;
                this.status$.next('Your Turn');
            }
        } else {
            // Draw
            this.status$.next('DRAW');
            this.isGameOver = true;
            setTimeout(() => this.startLevel(), 2000);
        }
    }

    checkWin(p: number) {
        // Horizontal
        for(let y=0; y<6; y++) for(let x=0; x<4; x++) 
            if(this.grid[x][y]===p && this.grid[x+1][y]===p && this.grid[x+2][y]===p && this.grid[x+3][y]===p) return true;
        // Vertical
        for(let x=0; x<7; x++) for(let y=0; y<3; y++) 
            if(this.grid[x][y]===p && this.grid[x][y+1]===p && this.grid[x][y+2]===p && this.grid[x][y+3]===p) return true;
        // Diag /
        for(let x=0; x<4; x++) for(let y=0; y<3; y++) 
            if(this.grid[x][y]===p && this.grid[x+1][y+1]===p && this.grid[x+2][y+2]===p && this.grid[x+3][y+3]===p) return true;
        // Diag \
        for(let x=0; x<4; x++) for(let y=3; y<6; y++) 
            if(this.grid[x][y]===p && this.grid[x+1][y-1]===p && this.grid[x+2][y-2]===p && this.grid[x+3][y-3]===p) return true;
        
        return false;
    }

    handleWin(p: number) {
        this.status$.next(p === 1 ? 'YOU WIN!' : 'CPU WINS');
        if (p === 1) {
            this.updateScore(1000);
            this.audio.playMatch();
        } else {
            this.audio.playGameOver();
        }
        this.isGameOver = true;
        setTimeout(() => {
            if (p === 1) this.level++;
            this.startLevel();
        }, 2000);
    }

    emit() {
        const items: GameItem[] = [];
        for(let x=0; x<7; x++) for(let y=0; y<6; y++) {
            items.push({ id: `c_${x}_${y}`, x, y, type: this.grid[x][y] });
        }
        // Cursor
        if (!this.isGameOver) items.push({ id: 'cursor', x: this.cursor, y: 6, type: this.turn === 1 ? 1 : 2, scale: 0.5 });
        this.state$.next(items);
    }

    getRenderConfig() {
        return {
            geometry: { 0: 'Box', 1: 'Sphere', 2: 'Sphere' },
            colors: { 0: 0x0044aa, 1: 0xd93030, 2: 0xffd700 }, // Classic Blue Rack, Red/Yellow pieces
            bgColor: 0x111111
        };
    }
}

import { GameModel } from './GameModel';
import { GameItem, InputAction, SoundEmitter } from '../types';

export class Connect4 extends GameModel {
    grid: number[][] = []; // 7 cols, 6 rows. 0, 1(P1), 2(AI)
    turn = 1;

    constructor(audio?: SoundEmitter) { super(7, 6, 'connect4', audio); }

    start() {
        this.grid = Array(7).fill(null).map(() => Array(6).fill(0));
        this.turn = 1;
        this.emit();
        this.status$.next('Select Column');
    }

    handleInput(action: InputAction) {
        if (this.isGameOver || this.turn !== 1 || action.type !== 'SELECT') return;
        
        const pos = action.data && action.data.gridPos ? action.data.gridPos : null;
        if (!pos) return;
        
        const { x } = pos;
        this.dropPiece(x, 1);
    }

    async dropPiece(x: number, p: number) {
        if (x < 0 || x >= 7 || this.grid[x][5] !== 0) return;
        
        let y = 0;
        while (y < 5 && this.grid[x][y] !== 0) y++; // Find first empty from bottom
        // If grid[x][0] is taken, try 1.
        y = 0;
        while (y < 6 && this.grid[x][y] !== 0) y++;
        if (y >= 6) return; // Full col

        this.grid[x][y] = p;
        this.audio.playMove();
        this.emit();

        if (this.checkWin(p)) {
            this.status$.next(p === 1 ? 'YOU WIN!' : 'CPU WINS');
            this.isGameOver = true;
            if(p===1) this.audio.playMatch(); else this.audio.playGameOver();
            setTimeout(() => this.effects$.next({ type: 'GAMEOVER' }), 2000);
        } else if (this.grid.every(c => c[5] !== 0)) {
            this.status$.next('DRAW');
            this.isGameOver = true;
            setTimeout(() => this.effects$.next({ type: 'GAMEOVER' }), 2000);
        } else {
            this.turn = p === 1 ? 2 : 1;
            if (this.turn === 2) {
                this.status$.next('CPU Turn');
                setTimeout(() => this.cpuMove(), 600);
            } else {
                this.status$.next('Your Turn');
            }
        }
    }

    cpuMove() {
        const moves = [];
        for(let x=0; x<7; x++) if(this.grid[x][5] === 0) moves.push(x);
        if (moves.length) {
            this.dropPiece(moves[Math.floor(Math.random() * moves.length)], 2);
        }
    }

    checkWin(p: number) {
        // Horizontal
        for(let y=0; y<6; y++) for(let x=0; x<4; x++) 
            if(this.grid[x][y]==p && this.grid[x+1][y]==p && this.grid[x+2][y]==p && this.grid[x+3][y]==p) return true;
        // Vertical
        for(let x=0; x<7; x++) for(let y=0; y<3; y++)
            if(this.grid[x][y]==p && this.grid[x][y+1]==p && this.grid[x][y+2]==p && this.grid[x][y+3]==p) return true;
        // Diag 1
        for(let x=0; x<4; x++) for(let y=0; y<3; y++)
            if(this.grid[x][y]==p && this.grid[x+1][y+1]==p && this.grid[x+2][y+2]==p && this.grid[x+3][y+3]==p) return true;
        // Diag 2
        for(let x=0; x<4; x++) for(let y=3; y<6; y++)
            if(this.grid[x][y]==p && this.grid[x+1][y-1]==p && this.grid[x+2][y-2]==p && this.grid[x+3][y-3]==p) return true;
        return false;
    }

    emit() {
        const items: GameItem[] = [];
        for(let x=0; x<7; x++) for(let y=0; y<6; y++) {
            if (this.grid[x][y] !== 0) items.push({ id: `c4_${x}_${y}`, x, y, type: this.grid[x][y] });
        }
        this.state$.next(items);
    }

    getRenderConfig() {
        return { 
            geometry: 'cylinder' as const, 
            colors: { 1: 0xffff00, 2: 0xff0000 }, 
            bgColor: 0x0000aa 
        };
    }
}

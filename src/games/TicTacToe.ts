
import { GameModel } from './GameModel';
import { GameItem, InputAction, SoundEmitter } from '../types';

export class TicTacToe extends GameModel {
    grid: number[] = []; // 0: empty, 1: X, 2: O
    turn = 1;
    gridSize = 3;

    constructor(audio?: SoundEmitter) { super(3, 3, 'tictactoe', audio); }

    start() {
        this.gridSize = 3;
        this.startLevel();
    }

    startLevel() {
        this.resize(this.gridSize, this.gridSize);
        this.grid = Array(this.width * this.height).fill(0);
        this.turn = 1;
        this.emit();
        this.status$.next(`Level ${this.gridSize - 2}: X Turn`);
    }

    handleInput(action: InputAction) {
        if (this.isGameOver || this.turn !== 1 || action.type !== 'SELECT') return;
        
        const pos = action.data && action.data.gridPos ? action.data.gridPos : null;
        if (!pos) return;

        const { x, y } = pos;
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        
        const idx = y * this.width + x;
        
        if (this.grid[idx] === 0) {
            this.grid[idx] = 1;
            this.audio.playMove();
            this.emit();
            
            if (this.checkWin(1)) {
                this.handlePlayerWin();
            } else if (this.grid.every(c => c !== 0)) {
                this.status$.next('DRAW');
                this.isGameOver = true;
                setTimeout(() => this.effects$.next({ type: 'GAMEOVER' }), 2000);
            } else {
                this.turn = 2;
                this.status$.next('CPU Turn');
                setTimeout(() => this.cpuMove(), 500);
            }
        }
    }

    cpuMove() {
        if(this.isGameOver) return;
        const moves: number[] = [];
        this.grid.forEach((c, i) => { if (c === 0) moves.push(i); });
        
        if (moves.length > 0) {
            const move = moves[Math.floor(Math.random() * moves.length)];
            this.grid[move] = 2;
            this.audio.playMove();
            this.emit();
            
            if (this.checkWin(2)) {
                this.status$.next('CPU WINS');
                this.isGameOver = true;
                this.audio.playGameOver();
                setTimeout(() => this.effects$.next({ type: 'GAMEOVER' }), 2000);
            } else if (this.grid.every(c => c !== 0)) {
                this.status$.next('DRAW');
                this.isGameOver = true;
                setTimeout(() => this.effects$.next({ type: 'GAMEOVER' }), 2000);
            } else {
                this.turn = 1;
                this.status$.next('Your Turn');
            }
        }
    }

    checkWin(p: number) {
        const N = this.gridSize;
        
        // Rows
        for(let y=0; y<N; y++) {
            let win = true;
            for(let x=0; x<N; x++) if(this.grid[y*N+x] !== p) win = false;
            if(win) return true;
        }
        
        // Cols
        for(let x=0; x<N; x++) {
            let win = true;
            for(let y=0; y<N; y++) if(this.grid[y*N+x] !== p) win = false;
            if(win) return true;
        }
        
        // Diag 1
        let d1 = true;
        for(let i=0; i<N; i++) if(this.grid[i*N+i] !== p) d1 = false;
        if(d1) return true;
        
        // Diag 2
        let d2 = true;
        for(let i=0; i<N; i++) if(this.grid[i*N+(N-1-i)] !== p) d2 = false;
        if(d2) return true;

        return false;
    }

    handlePlayerWin() {
        this.status$.next('LEVEL CLEARED!');
        this.updateScore(100 * this.gridSize);
        this.audio.playMatch();
        this.effects$.next({ type: 'PARTICLE', x: Math.floor(this.width/2), y: Math.floor(this.height/2), color: 0xffff00, style: 'EXPLODE' });
        
        this.turn = -1; // Block input
        
        setTimeout(() => {
            this.gridSize++;
            this.startLevel();
        }, 1500);
    }

    emit() {
        const items: GameItem[] = [];
        for(let i=0; i<this.grid.length; i++) {
            items.push({ 
                id: `ttt_${i}`, 
                x: i % this.width, 
                y: Math.floor(i / this.width), 
                type: this.grid[i] 
            });
        }
        this.state$.next(items);
    }

    getRenderConfig() {
        return { 
            geometry: 'box' as const, 
            colors: { 
                0: 0x333366, 
                1: 0x00ffff, 
                2: 0xff00ff  
            }, 
            bgColor: 0x000044 
        };
    }
}

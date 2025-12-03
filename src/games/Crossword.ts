
import { GameModel } from './GameModel';
import { GameItem, InputAction, SoundEmitter } from '../types';

export class Crossword extends GameModel {
    grid: string[][] = [];
    solution: string[][] = [];
    selected: {x:number, y:number} = {x:0, y:0};
    
    constructor(audio?: SoundEmitter) { super(5, 5, 'crossword', audio); }

    start() {
        // Simple 5x5 Grid. 
        // 0 = Black, Letter = Solution
        const puzzle = [
            ['H','E','L','L','O'],
            ['E',' ','I',' ',' '],
            ['A','P','P','L','E'],
            ['R',' ','S',' ',' '],
            ['T','R','A','I','N']
        ];
        
        this.solution = puzzle;
        this.grid = puzzle.map(row => row.map(c => c === ' ' ? ' ' : ''));
        this.emit();
        this.status$.next('Select & Type');
    }

    handleInput(action: InputAction) {
        if (this.isGameOver) return;
        
        if (action.type === 'SELECT' && action.data?.gridPos) {
            const {x, y} = action.data.gridPos;
            if (this.solution[4-y][x] !== ' ') {
                this.selected = {x, y};
                // In a real app we'd pop a keyboard. Here we just cycle common letters for demo
                // Or "Fill" cheat for debug
                const current = this.grid[4-y][x];
                const sol = this.solution[4-y][x];
                
                // Simulate typing: if empty -> correct letter (auto-solve for arcade feel)
                // Or cycle A-Z? Too tedious without keyboard.
                // Let's make it "Click to reveal" cost points? No that's Minesweeper.
                // Let's cycle A, E, I, O, U, S, T, R, N, L and Correct
                
                const alpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ";
                let idx = alpha.indexOf(current);
                if(idx === -1) idx = 0;
                
                // Smart cycle: Include the solution letter in the cycle to make it playable
                const opts = [' ', 'A','E','I','O','U','S','T','R','N','L', sol].filter((v,i,a)=>a.indexOf(v)===i);
                let nextIdx = (opts.indexOf(current) + 1) % opts.length;
                this.grid[4-y][x] = opts[nextIdx];
                
                this.audio.playSelect();
                this.checkWin();
                this.emit();
            }
        }
    }
    
    checkWin() {
        let correct = true;
        for(let y=0; y<5; y++) for(let x=0; x<5; x++) {
            if (this.solution[y][x] !== ' ' && this.grid[y][x] !== this.solution[y][x]) correct = false;
        }
        if(correct) {
            this.handleWin();
        }
    }
    
    handleWin() {
        this.status$.next('SOLVED!');
        this.updateScore(500);
        this.audio.playMatch();
        this.effects$.next({ type: 'GAMEOVER' });
    }

    emit() {
        const items: GameItem[] = [];
        for(let y=0; y<5; y++) for(let x=0; x<5; x++) {
            // Render from top-left logic (array) to bottom-left logic (GL)
            const row = 4-y;
            const isBlack = this.solution[row][x] === ' ';
            const isSel = this.selected.x === x && this.selected.y === y;
            const val = this.grid[row][x];
            
            items.push({ 
                id: `cw_${x}_${y}`, x, y, 
                type: isBlack ? 0 : (isSel ? 2 : 1),
                text: isBlack ? undefined : val,
                textColor: '#000000'
            });
        }
        this.state$.next(items);
    }

    getRenderConfig() {
        return { 
            geometry: 'box' as const, 
            colors: { 
                0: 0x111111, // Black block
                1: 0xffffff, // White block
                2: 0xffff00  // Selected
            }, 
            bgColor: 0x222222 
        };
    }
}

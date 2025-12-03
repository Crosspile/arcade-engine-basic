
import { GameModel } from './GameModel';
import { GameItem, InputAction, SoundEmitter } from '../types';

export class Sudoku extends GameModel {
    grid: number[] = [];
    fixed: boolean[] = [];
    selectedIdx: number = -1;
    
    constructor(audio?: SoundEmitter) { super(9, 9, 'sudoku', audio); }

    start() {
        this.generateLevel();
    }

    generateLevel() {
        // Base valid board
        const base = [
            1,2,3,4,5,6,7,8,9,
            4,5,6,7,8,9,1,2,3,
            7,8,9,1,2,3,4,5,6,
            2,3,4,5,6,7,8,9,1,
            5,6,7,8,9,1,2,3,4,
            8,9,1,2,3,4,5,6,7,
            3,4,5,6,7,8,9,1,2,
            6,7,8,9,1,2,3,4,5,
            9,1,2,3,4,5,6,7,8
        ];
        
        // Shuffle rows/bands/stacks (simplified shuffle: just swap numbers)
        const map = [1,2,3,4,5,6,7,8,9].sort(()=>Math.random()-0.5);
        this.grid = base.map(v => map[v-1]);
        
        // Remove N items
        this.fixed = Array(81).fill(false);
        const toKeep = 30; // Easy
        const indices = Array.from({length: 81}, (_,i)=>i).sort(()=>Math.random()-0.5);
        
        for(let i=0; i<81; i++) {
            if (i < toKeep) {
                this.fixed[indices[i]] = true;
            } else {
                this.grid[indices[i]] = 0;
            }
        }
        
        this.emit();
        this.status$.next('Fill cells');
    }

    handleInput(action: InputAction) {
        if (this.isGameOver) return;
        
        const pos = action.data && action.data.gridPos ? action.data.gridPos : null;
        if (pos) {
            // Select cell
            if(pos.x>=0 && pos.x<9 && pos.y>=0 && pos.y<9) {
                const idx = pos.y * 9 + pos.x;
                this.selectedIdx = idx;
                
                // If already selected and not fixed, cycle
                if (!this.fixed[idx]) {
                    if (action.type === 'SELECT') {
                         this.grid[idx] = (this.grid[idx] % 9) + 1;
                         this.audio.playSelect();
                         this.checkWin();
                    }
                }
                this.emit();
            }
        }
    }
    
    checkWin() {
        if (this.grid.includes(0)) return;
        
        // Validate rows, cols, 3x3
        let valid = true;
        // Simple check: Is every row unique sum? (weak check but fast)
        // Better: Set check
        const check = (arr: number[]) => new Set(arr).size === 9;
        
        for(let i=0; i<9; i++) {
            // Row
            if(!check(this.grid.slice(i*9, (i+1)*9))) valid = false;
            // Col
            const col = [];
            for(let r=0; r<9; r++) col.push(this.grid[r*9+i]);
            if(!check(col)) valid = false;
        }
        
        if(valid) {
            this.handleWin();
        }
    }
    
    handleWin() {
        this.status$.next('SOLVED!');
        this.updateScore(1000);
        this.audio.playMatch();
        this.effects$.next({ type: 'GAMEOVER' });
    }

    emit() {
        const items: GameItem[] = [];
        for(let i=0; i<81; i++) {
            const val = this.grid[i];
            const isSel = this.selectedIdx === i;
            const type = this.fixed[i] ? 2 : (val === 0 ? 0 : 1);
            
            // Checkerboard pattern for 3x3 blocks
            const x = i%9; const y = Math.floor(i/9);
            const bx = Math.floor(x/3); const by = Math.floor(y/3);
            const bgType = (bx+by)%2 === 0 ? 0 : 3;
            
            items.push({ 
                id: `sud_${i}`, x, y: 8-y, // Invert Y for render
                type: isSel ? 4 : (val === 0 ? bgType : bgType),
                text: val > 0 ? val.toString() : undefined,
                textColor: this.fixed[i] ? '#000000' : '#0000aa'
            });
        }
        this.state$.next(items);
    }

    getRenderConfig() {
        return { 
            geometry: 'box' as const, 
            colors: { 
                0: 0xffffff, // White BG
                1: 0xffffff, // User filled
                2: 0xdddddd, // Fixed
                3: 0xeeeeee, // Alt BG
                4: 0xffff00  // Selected
            }, 
            bgColor: 0x222222 
        };
    }
}

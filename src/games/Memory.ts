
import { GameModel } from './GameModel';
import { GameItem, InputAction, SoundEmitter } from '../types';

export class MemoryGame extends GameModel {
    grid: number[][] = [];
    revealed: boolean[][] = [];
    matched: boolean[][] = [];
    first: { x: number, y: number } | null = null;
    locked = false;

    constructor(audio?: SoundEmitter) { super(6, 6, 'memory', audio); }

    start() {
        this.level = 1;
        this.startLevel();
    }
    
    startLevel() {
        // Prog: 2x2, 4x2, 4x3, 4x4, 5x4, 6x5, 6x6
        const levels = [
            [2,2], [4,2], [4,3], [4,4], [5,4], [6,5], [6,6], [8,6], [8,7], [8,8]
        ];
        const cfg = levels[Math.min(this.level-1, levels.length-1)];
        this.resize(cfg[0], cfg[1]);

        const numPairs = (this.width * this.height) / 2;
        const pairs = [];
        for(let i=0; i<numPairs; i++) { 
            const type = (i % 9) + 1;
            pairs.push(type); pairs.push(type); 
        } 
        pairs.sort(() => Math.random() - 0.5);
        
        this.grid = [];
        this.revealed = [];
        this.matched = [];
        for(let x=0; x<this.width; x++) {
            this.grid[x] = []; this.revealed[x] = []; this.matched[x] = [];
            for(let y=0; y<this.height; y++) {
                const p = pairs.pop();
                this.grid[x][y] = p !== undefined ? p : 0;
                this.revealed[x][y] = false;
                this.matched[x][y] = false;
            }
        }
        this.emit();
        this.status$.next(`Lvl ${this.level}: Pairs`);
    }

    async handleInput(action: InputAction) {
        if (this.locked || action.type !== 'SELECT') return;
        
        const pos = action.data && action.data.gridPos ? action.data.gridPos : null;
        if (!pos) return;
        
        const { x, y } = pos;
        if (x<0 || x>=this.width || y<0 || y>=this.height || this.revealed[x][y] || this.matched[x][y]) return;

        this.revealed[x][y] = true;
        this.audio.playSelect();
        this.emit();

        if (!this.first) {
            this.first = { x, y };
        } else {
            this.locked = true;
            this.subStat++;
            this.subStat$.next(this.subStat);
            
            if (this.grid[x][y] === this.grid[this.first.x][this.first.y]) {
                this.audio.playMatch();
                this.matched[x][y] = true;
                this.matched[this.first.x][this.first.y] = true;
                this.updateScore(100);
                this.effects$.next({ type: 'PARTICLE', x, y, color: 0x00ff00, style: 'PUFF' });
                this.first = null;
                this.locked = false;
                this.checkWin();
            } else {
                await new Promise(r => setTimeout(r, 800));
                this.revealed[x][y] = false;
                this.revealed[this.first.x][this.first.y] = false;
                this.first = null;
                this.locked = false;
                this.emit();
            }
        }
    }
    
    checkWin() {
        if (this.matched.every(col => col.every(c => c))) {
            this.handleWin();
        }
    }
    
    handleWin() {
        this.status$.next('CLEARED!');
        this.effects$.next({ type: 'EXPLODE', x: this.width/2, y: this.height/2, color: 0xffd700, style: 'EXPLODE' });
        setTimeout(() => {
            this.level++;
            this.startLevel();
        }, 2000);
    }

    emit() {
        const items: GameItem[] = [];
        for (let x = 0; x < this.width; x++) for (let y = 0; y < this.height; y++) {
            items.push({ 
                id: `mem_${x}_${y}`, x, y, 
                type: (this.revealed[x][y] || this.matched[x][y]) ? this.grid[x][y] : 0,
            });
        }
        this.state$.next(items);
    }

    getRenderConfig() {
        return { 
            geometry: 'box' as const, 
            colors: { 
                0: 0xffffff, // Back
                1: 0xff0000, 2: 0x00ff00, 3: 0x0000ff, 4: 0xffff00, 5: 0xff00ff, 6: 0x00ffff, 7: 0xff8800, 8: 0x8800ff, 9: 0xffaabb
            }, 
            bgColor: 0x222222 
        };
    }
}

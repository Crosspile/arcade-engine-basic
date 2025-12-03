
import { GameModel } from './GameModel';
import { GameItem, InputAction, SoundEmitter } from '../types';

export class SlidingPuzzle extends GameModel {
    tiles: { v: number, x: number, y: number }[] = [];

    constructor(audio?: SoundEmitter) { super(4, 4, 'sliding', audio); }

    start() {
        this.level = 1;
        this.startLevel();
    }
    
    startLevel() {
        // 3x3 (level 1), 4x4 (level 2), 5x5...
        const size = Math.min(6, 2 + this.level);
        this.resize(size, size);
        
        this.tiles = [];
        const count = size * size;
        for(let i=1; i<count; i++) {
            this.tiles.push({ v: i, x: (i-1)%size, y: size - 1 - Math.floor((i-1)/size) });
        }
        
        // Shuffle
        let lx = size - 1, ly = 0; // Empty starts bottom right
        const moves = 50 * this.level;
        
        for(let i=0; i<moves; i++) {
            const neighbors = [];
            if(lx>0) neighbors.push({x:lx-1, y:ly});
            if(lx<size-1) neighbors.push({x:lx+1, y:ly});
            if(ly>0) neighbors.push({x:lx, y:ly-1});
            if(ly<size-1) neighbors.push({x:lx, y:ly+1});
            const n = neighbors[Math.floor(Math.random()*neighbors.length)];
            const t = this.tiles.find(t => t.x === n.x && t.y === n.y);
            if(t) {
                t.x = lx; t.y = ly;
                lx = n.x; ly = n.y;
            }
        }
        this.emit();
        this.status$.next(`Lvl ${this.level}: Solve`);
    }

    handleInput(action: InputAction) {
        if (this.isGameOver || action.type !== 'SELECT') return;
        
        const pos = action.data && action.data.gridPos ? action.data.gridPos : null;
        if (!pos) return;

        const { x, y } = pos;
        const tile = this.tiles.find(t => t.x === x && t.y === y);
        if (!tile) return;

        // Find empty spot
        const used = new Set(this.tiles.map(t => `${t.x},${t.y}`));
        let ex = -1, ey = -1;
        
        const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
        for(let d of dirs) {
            const nx = x+d[0], ny = y+d[1];
            if(nx>=0 && nx<this.width && ny>=0 && ny<this.height && !used.has(`${nx},${ny}`)) {
                ex = nx; ey = ny; break;
            }
        }

        if (ex !== -1) {
            tile.x = ex; tile.y = ey;
            this.audio.playMove();
            this.emit();
            this.checkWin();
        }
    }

    checkWin() {
        if (this.tiles.every(t => t.x === (t.v-1)%this.width && t.y === this.height - 1 - Math.floor((t.v-1)/this.width))) {
            this.handleWin();
        }
    }
    
    handleWin() {
        this.status$.next('SOLVED!');
        this.updateScore(1000 * this.level);
        this.audio.playMatch();
        this.effects$.next({ type: 'EXPLODE', x: this.width/2, y: this.height/2, color: 0xffffff, style: 'EXPLODE' });
        setTimeout(() => {
            this.level++;
            this.startLevel();
        }, 1500);
    }

    emit() {
        this.state$.next(this.tiles.map(t => ({ 
            id: `t_${t.v}`, x: t.x, y: t.y, type: t.v,
            text: t.v.toString(), textColor: '#ffffff'
        })));
    }

    getRenderConfig() {
        const colors: any = {};
        const count = this.width * this.height;
        for(let i=1; i<count; i++) {
            const r = Math.floor((i/count) * 255);
            colors[i] = (r << 16) | (0 << 8) | (255 - r);
        }
        return { geometry: 'box' as const, colors, bgColor: 0x111111 };
    }
}

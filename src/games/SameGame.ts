
import { GameModel } from './GameModel';
import { GameItem, InputAction, SoundEmitter } from '../types';

export class SameGame extends GameModel {
    grid: number[][] = []; 

    constructor(audio?: SoundEmitter) { super(10, 10, 'samegame', audio); }

    start() {
        this.level = 1;
        this.startLevel();
    }
    
    startLevel() {
        // Grow from 6x6 to 12x12
        const size = Math.min(12, 5 + this.level);
        this.resize(size, size);
        
        const numColors = Math.min(5, 3 + Math.floor(this.level/3));
        
        this.grid = Array(size).fill(null).map(() => Array(size).fill(0).map(() => Math.floor(Math.random() * numColors) + 1));
        this.emit();
        this.status$.next(`Lvl ${this.level}`);
    }

    handleInput(action: InputAction) {
        if (this.isGameOver || action.type !== 'SELECT') return;
        
        const pos = action.data && action.data.gridPos ? action.data.gridPos : null;
        if (!pos) return;

        const { x, y } = pos;
        if(x<0||x>=this.width||y<0||y>=this.height||this.grid[x][y]===0) return;

        const color = this.grid[x][y];
        const group: {x:number, y:number}[] = [];
        const visited = new Set<string>();
        const stack = [{x,y}];
        
        while(stack.length) {
            const p = stack.pop()!;
            const k = `${p.x},${p.y}`;
            if(visited.has(k)) continue;
            visited.add(k);
            group.push(p);

            [[0,1],[0,-1],[1,0],[-1,0]].forEach(d => {
                const nx = p.x+d[0], ny = p.y+d[1];
                if(nx>=0&&nx<this.width&&ny>=0&&ny<this.height&&this.grid[nx][ny]===color) stack.push({x:nx, y:ny});
            });
        }

        if (group.length > 1) {
            this.removeGroup(group);
        }
    }

    async removeGroup(group: {x:number, y:number}[]) {
        const score = (group.length - 2) * (group.length - 2) * 10;
        this.updateScore(score);
        this.audio.playMatch();
        
        group.forEach(p => {
            this.effects$.next({ type: 'PARTICLE', x: p.x, y: p.y, color: this.getColor(this.grid[p.x][p.y]), style: 'PUFF' });
            this.grid[p.x][p.y] = 0;
        });
        this.emit();
        
        await new Promise(r => setTimeout(r, 200));

        // Gravity
        for(let x=0; x<this.width; x++) {
            const col = this.grid[x].filter(c => c !== 0);
            for(let y=0; y<this.height; y++) this.grid[x][y] = col[y] || 0;
        }
        
        // Shift Empty Cols
        const newGrid = this.grid.filter(col => col.some(c => c !== 0));
        while(newGrid.length < this.width) newGrid.push(Array(this.height).fill(0));
        this.grid = newGrid;

        this.emit();
        this.checkWin();
    }

    checkWin() {
        if (this.grid.every(col => col.every(c => c===0))) {
            this.handleWin();
        }
    }
    
    handleWin() {
        this.status$.next('CLEARED!');
        this.updateScore(1000);
        setTimeout(() => {
            this.level++;
            this.startLevel();
        }, 1500);
    }

    getColor(t: number) {
        const colors: any = { 1: 0xff0000, 2: 0x00ff00, 3: 0x0000ff, 4: 0xffff00, 5: 0x00ffff };
        return colors[t] || 0xffffff;
    }

    emit() {
        const items: GameItem[] = [];
        for(let x=0; x<this.width; x++) for(let y=0; y<this.height; y++) {
            if(this.grid[x][y] !== 0) items.push({ id: `sg_${x}_${y}`, x, y, type: this.grid[x][y] });
        }
        this.state$.next(items);
    }

    getRenderConfig() {
        return { 
            geometry: 'box' as const, 
            colors: { 1: 0xff0000, 2: 0x00ff00, 3: 0x0000ff, 4: 0xffff00, 5: 0x00ffff }, 
            bgColor: 0x222222 
        };
    }
}

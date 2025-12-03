
import { GameModel } from './GameModel';
import { GameItem, InputAction, SoundEmitter } from '../types';

export class LightsOutGame extends GameModel {
    grid: boolean[][] = [];
    
    constructor(audio?: SoundEmitter) { super(5, 5, 'lightsout', audio); }

    start() {
        this.level = 1;
        this.startLevel();
    }

    startLevel() {
        const size = Math.min(10, 3 + (this.level - 1));
        this.resize(size, size);
        
        this.grid = Array(size).fill(false).map(() => Array(size).fill(false));
        const clicks = 5 + this.level * 2;
        for(let i=0; i<clicks; i++) {
            this.toggle(Math.floor(Math.random()*size), Math.floor(Math.random()*size), true);
        }
        this.emit();
        this.status$.next(`Lvl ${this.level}: Turn off`);
    }

    handleInput(action: InputAction) {
        if (action.type === 'SELECT' && action.data && action.data.gridPos) {
            this.toggle(action.data.gridPos.x, action.data.gridPos.y);
            this.checkWin();
        }
    }

    toggle(x: number, y: number, silent = false) {
        if(x<0||x>=this.width||y<0||y>=this.height) return;
        if(!silent) this.audio.playSelect();
        
        const t = (cx: number, cy: number) => {
            if(cx>=0&&cx<this.width&&cy>=0&&cy<this.height) this.grid[cx][cy] = !this.grid[cx][cy];
        };
        t(x, y); t(x+1, y); t(x-1, y); t(x, y+1); t(x, y-1);
        this.emit();
    }

    checkWin() {
        if (this.grid.every(col => col.every(c => !c))) {
            this.handleWin();
        }
    }
    
    handleWin() {
        this.status$.next('CLEARED!');
        this.updateScore(500 * this.level);
        this.audio.playMatch();
        this.effects$.next({ type: 'EXPLODE', x: Math.floor(this.width/2), y: Math.floor(this.height/2), color: 0xffff00, style: 'EXPLODE' });
        setTimeout(() => {
            this.level++;
            this.startLevel();
        }, 1500);
    }

    emit() {
        const items: GameItem[] = [];
        for (let x = 0; x < this.width; x++) for (let y = 0; y < this.height; y++) {
            items.push({ 
                id: `c_${x}_${y}`, 
                x, y, 
                type: this.grid[x][y] ? 1 : 0 
            });
        }
        this.state$.next(items);
    }

    getRenderConfig() {
        return { geometry: 'box' as const, colors: { 0: 0x222222, 1: 0xffff00 }, bgColor: 0x000000 };
    }
}

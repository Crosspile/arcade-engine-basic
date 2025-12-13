
import { GameModel } from './GameModel';
import type{ GameItem, InputAction, SoundEmitter } from '../engine/types';

export class Match3Game extends GameModel {
    colors = [0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93];
    grid: (GameItem | null)[][] = [];
    selected: { x: number, y: number } | null = null;
    isLocked = false;

    constructor(audio?: SoundEmitter) {
        super(6, 6, 'match3', audio);
    }

    start() {
        this.isGameOver = false;
        this.grid = Array(this.width).fill(null).map(() => Array(this.height).fill(null));
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                this.grid[x][y] = { id: this.uid(), type: Math.floor(Math.random() * 5), x, y };
            }
        }
        this.emit();
        this.status$.next('Pick a tile');
    }

    async handleInput(action: InputAction) {
        if (this.isLocked || action.type !== 'SELECT') return;
        
        // Handle grid selection via raycast data
        const data = action.data && action.data.gridPos ? action.data.gridPos : null;

        if (!data && this.selected) {
            this.selected = null;
            this.status$.next('Pick a tile');
            return;
        }
        if (!data) return;

        const { x, y } = data;
        
        // Bounds check
        if(x < 0 || x >= this.width || y < 0 || y >= this.height) return;

        if (!this.selected) {
            this.selected = { x, y };
            this.audio.playSelect();
            this.status$.next('Select neighbor');
        } else {
            if (Math.abs(this.selected.x - x) + Math.abs(this.selected.y - y) === 1) {
                await this.swap(this.selected.x, this.selected.y, x, y);
            }
            this.selected = null;
            this.status$.next('Pick a tile');
        }
    }

    async swap(x1: number, y1: number, x2: number, y2: number) {
        this.isLocked = true;
        this.audio.playMove();
        
        let t = this.grid[x1][y1];
        this.grid[x1][y1] = this.grid[x2][y2];
        this.grid[x2][y2] = t;

        if (this.grid[x1][y1]) { this.grid[x1][y1]!.x = x1; this.grid[x1][y1]!.y = y1; }
        if (this.grid[x2][y2]) { this.grid[x2][y2]!.x = x2; this.grid[x2][y2]!.y = y2; }

        this.emit();
        await new Promise(r => setTimeout(r, 300));

        const m = this.findMatches();
        if (m.length) {
            this.subStat++;
            this.subStat$.next(this.subStat);
            await this.processMatches(m);
        } else {
            // Undo swap
            t = this.grid[x1][y1];
            this.grid[x1][y1] = this.grid[x2][y2];
            this.grid[x2][y2] = t;
            if (this.grid[x1][y1]) { this.grid[x1][y1]!.x = x1; this.grid[x1][y1]!.y = y1; }
            if (this.grid[x2][y2]) { this.grid[x2][y2]!.x = x2; this.grid[x2][y2]!.y = y2; }
            this.emit();
            await new Promise(r => setTimeout(r, 300));
        }
        this.isLocked = false;
    }

    findMatches() {
        const m = new Set<GameItem>();
        const check = (x: number, y: number, dx: number, dy: number) => {
            const c1 = this.grid[x][y], c2 = this.grid[x + dx][y + dy], c3 = this.grid[x + dx * 2][y + dy * 2];
            if (c1 && c2 && c3 && c1.type === c2.type && c1.type === c3.type) {
                m.add(c1); m.add(c2); m.add(c3);
            }
        };
        for (let y = 0; y < this.height; y++) for (let x = 0; x < this.width - 2; x++) check(x, y, 1, 0);
        for (let x = 0; x < this.width; x++) for (let y = 0; y < this.height - 2; y++) check(x, y, 0, 1);
        return Array.from(m);
    }

    async processMatches(matches: GameItem[]) {
        while (matches.length) {
            this.updateScore(matches.length * 10);
            this.audio.playMatch();
            matches.forEach(p => this.effects$.next({ 
                type: 'EXPLODE', 
                x: p.x, 
                y: p.y, 
                color: this.colors[p.type], 
                style: 'EXPLODE' 
            }));
            
            matches.forEach(p => (p as any).destroyed = true);
            this.emit();
            await new Promise(r => setTimeout(r, 300));

            for (let x = 0; x < this.width; x++) {
                let col = this.grid[x].filter(p => p && !(p as any).destroyed);
                while (col.length < this.height) {
                    col.push({ id: this.uid(), type: Math.floor(Math.random() * 5), x: x, y: 0, spawnStyle: 'drop' });
                }
                for (let y = 0; y < this.height; y++) {
                    this.grid[x][y] = col[y];
                    if(this.grid[x][y]) {
                        this.grid[x][y]!.x = x;
                        this.grid[x][y]!.y = y;
                    }
                }
            }
            this.emit();
            await new Promise(r => setTimeout(r, 400));
            matches = this.findMatches();
        }
    }

    // Standardized debug method
    debugAction() {
        this.updateScore(5000);
    }

    emit() {
        const r: GameItem[] = [];
        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                if(this.grid[x][y]) r.push({ ...this.grid[x][y]!, x, y });
            }
        }
        this.state$.next(r);
    }

    getRenderConfig() {
        return { 
            geometry: 'cylinder' as const, 
            colors: { 0: 0xff595e, 1: 0xffca3a, 2: 0x8ac926, 3: 0x1982c4, 4: 0x6a4c93 }, 
            bgColor: 0x222222 
        };
    }
}

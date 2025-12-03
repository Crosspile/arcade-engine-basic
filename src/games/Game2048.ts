
import { GameModel } from './GameModel';
import { GameItem, InputAction, SoundEmitter } from '../types';

export class Game2048 extends GameModel {
    pieces: GameItem[] = [];
    cols: Record<number, number> = { 1: 0xeee4da, 2: 0xede0c8, 3: 0xf2b179, 4: 0xf59563, 5: 0xf67c5f, 6: 0xf65e3b, 7: 0xedcf72, 8: 0xedcc61 };

    constructor(audio?: SoundEmitter) {
        super(4, 4, '2048', audio);
    }

    start() {
        this.pieces = [];
        this.spawn();
        this.spawn();
        this.emit();
        this.status$.next('Join numbers');
    }

    spawn() {
        const e: { x: number, y: number }[] = [];
        for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) if (!this.pieces.find(p => p.x === x && p.y === y)) e.push({ x, y });
        if (e.length) {
            const p = e[Math.floor(Math.random() * e.length)];
            const v = Math.random() < .9 ? 1 : 2;
            this.pieces.push({ id: this.uid(), x: p.x, y: p.y, value: Math.pow(2, v), type: v });
        }
    }

    async handleInput(action: InputAction) {
        let dx = 0, dy = 0;
        if (action.type === 'UP') dy = 1;
        if (action.type === 'DOWN') dy = -1;
        if (action.type === 'LEFT') dx = -1;
        if (action.type === 'RIGHT') dx = 1;
        if (!dx && !dy) return;

        let moved = false;
        const merged = new Set<string>();
        
        this.pieces.sort((m, n) => dx === 1 ? n.x - m.x : dx === -1 ? m.x - n.x : dy === 1 ? n.y - m.y : m.y - n.y);

        for (let p of this.pieces) {
            let cx = p.x, cy = p.y;
            while (true) {
                const nx = cx + dx, ny = cy + dy;
                if (nx < 0 || nx >= 4 || ny < 0 || ny >= 4) break;
                
                const b = this.pieces.find(o => o.x === nx && o.y === ny);
                if (b) {
                    if (b.type === p.type && !merged.has(b.id) && !b.pm) {
                        p.x = nx; p.y = ny;
                        (p as any).pm = b; (b as any).pm = true;
                        merged.add(p.id);
                        moved = true;
                    }
                    break;
                } else {
                    cx = nx; cy = ny;
                }
            }
            if ((cx !== p.x || cy !== p.y) && !(p as any).pm) {
                p.x = cx; p.y = cy;
                moved = true;
            }
        }

        if (moved) {
            this.audio.playMove();
            this.emit();
            await new Promise(r => setTimeout(r, 200));
            
            const np: GameItem[] = [];
            for (let p of this.pieces) {
                if ((p as any).pm && typeof (p as any).pm === 'object') continue;
                if ((p as any).pm === true) {
                    p.type++;
                    (p as any).value *= 2;
                    this.updateScore((p as any).value);
                    (p as any).pm = false;
                    np.push(p);
                    this.effects$.next({ type: 'PARTICLE', x: p.x, y: p.y, color: this.cols[p.type] || 0xffffff, style: 'PUFF' });
                } else {
                    np.push(p);
                }
            }
            this.pieces = np;
            this.spawn();
            this.emit();
        }
    }

    emit() {
        this.state$.next(this.pieces.map(p => ({ id: p.id, type: p.type, x: p.x, y: p.y })));
    }

    getRenderConfig() {
        return { geometry: 'box' as const, colors: this.cols, bgColor: 0xbbada0 };
    }
}

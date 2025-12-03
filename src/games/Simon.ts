
import { GameModel } from './GameModel';
import { GameItem, InputAction, SoundEmitter } from '../types';

export class SimonGame extends GameModel {
    sequence: number[] = [];
    userStep = 0;
    state: 'WATCH' | 'INPUT' | 'GAME_OVER' = 'WATCH';
    lit: number = -1;

    constructor(audio?: SoundEmitter) { super(2, 2, 'simon', audio); }

    start() {
        this.level = 1;
        this.startLevel();
    }
    
    startLevel() {
        // Progressive expansion: 2x2, 3x3, 4x4, etc.
        const size = Math.min(6, 2 + Math.floor((this.level - 1)));
        this.resize(size, size);
        
        this.sequence = [];
        this.nextRound();
    }

    async nextRound() {
        this.state = 'WATCH';
        const gridSize = this.width * this.height;
        this.sequence.push(Math.floor(Math.random() * gridSize));
        this.userStep = 0;
        this.status$.next(`Lvl ${this.level}: Watch ${this.sequence.length}`);
        this.emit();
        
        const speed = Math.max(200, 800 - (this.level * 50));
        await new Promise(r => setTimeout(r, speed));

        for (const idx of this.sequence) {
            if (this.isGameOver) return;
            this.lit = idx;
            this.emit();
            this.audio.playTone(200 + idx * 100, 'sine', 0.2);
            await new Promise(r => setTimeout(r, speed/2));
            this.lit = -1;
            this.emit();
            await new Promise(r => setTimeout(r, speed/4));
        }

        this.state = 'INPUT';
        this.status$.next('Repeat');
    }

    handleInput(action: InputAction) {
        if (this.state !== 'INPUT' || action.type !== 'SELECT') return;
        
        const pos = action.data && action.data.gridPos ? action.data.gridPos : null;
        if (!pos) return;

        const { x, y } = pos;
        if(x<0||x>=this.width||y<0||y>=this.height) return;

        const idx = (this.height - 1 - y) * this.width + x;
        
        this.highlight(idx);
        
        if (idx === this.sequence[this.userStep]) {
            this.userStep++;
            if (this.userStep >= this.sequence.length) {
                this.updateScore(this.sequence.length * 10);
                this.state = 'WATCH';
                this.status$.next('Good!');
                
                if (this.sequence.length >= 3 + Math.floor(this.level/2)) {
                    this.handleWin();
                } else {
                    setTimeout(() => this.nextRound(), 1000);
                }
            }
        } else {
            this.state = 'GAME_OVER';
            this.status$.next('WRONG!');
            this.audio.playGameOver();
            this.isGameOver = true;
            setTimeout(() => this.effects$.next({ type: 'GAMEOVER' }), 1500);
        }
    }

    handleWin() {
        this.status$.next('LEVEL UP!');
        this.updateScore(500);
        this.audio.playMatch();
        this.effects$.next({ type: 'PARTICLE', x: Math.floor(this.width/2), y: Math.floor(this.height/2), color: 0x00ff00, style: 'EXPLODE' });
        setTimeout(() => {
            this.level++;
            this.startLevel();
        }, 1500);
    }

    async highlight(idx: number) {
        this.lit = idx;
        this.emit();
        this.audio.playTone(200 + idx * 100, 'sine', 0.1);
        await new Promise(r => setTimeout(r, 200));
        this.lit = -1;
        this.emit();
    }

    emit() {
        const items: GameItem[] = [];
        for(let y=0; y<this.height; y++) for(let x=0; x<this.width; x++) {
            const idx = (this.height - 1 - y) * this.width + x;
            items.push({ 
                id: `s_${x}_${y}`, x, y, 
                type: this.lit === idx ? idx + 10 : idx % 9 + 1 
            });
        }
        this.state$.next(items);
    }

    getRenderConfig() {
        const colors: any = { };
        const base = [0x004400, 0x440000, 0x444400, 0x000044, 0x440044, 0x004444, 0x444444, 0x222222, 0x111111];
        const lit =  [0x00ff00, 0xff0000, 0xffff00, 0x0000ff, 0xff00ff, 0x00ffff, 0xffffff, 0xaaaaaa, 0x888888];
        
        for(let i=0; i<9; i++) {
            colors[i+1] = base[i];
            colors[i+10] = lit[i];
        }

        return { geometry: 'box' as const, colors, bgColor: 0x111111 };
    }
}

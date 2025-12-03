
import { interval, filter } from 'rxjs';
import { GameModel } from './GameModel';
import { GameItem, InputAction, SoundEmitter } from '../types';

export class TetrisGame extends GameModel {
    shapes = [[[1,1,1,1]], [[1,1],[1,1]], [[0,1,0],[1,1,1]], [[1,1,0],[0,1,1]], [[0,1,1],[1,1,0]]];
    cols: Record<number, number> = { 0: 0x00f0f0, 1: 0xf0f000, 2: 0xa000f0, 3: 0xf00000, 4: 0x00f000 };
    grid: (GameItem | null)[][] = [];
    active: { shape: number[][], x: number, y: number, type: number, id: string } | null = null;

    constructor(audio?: SoundEmitter) { super(10, 20, 'tetris', audio); }

    start() {
        this.grid = Array(this.width).fill(null).map(() => Array(this.height).fill(null));
        this.spawn();
        this.status$.next('Lines: 0');
        
        this.sub.add(
            interval(500).pipe(
                filter(() => !this.isPaused && !this.isGameOver)
            ).subscribe(() => {
                if (this.active && !this.move(0, -1)) this.lock();
            })
        );
    }

    spawn() {
        const t = Math.floor(Math.random() * this.shapes.length);
        this.active = { shape: this.shapes[t], x: 3, y: 19, type: t, id: this.uid() };
        if (this.col(0, 0)) {
            this.stop();
            this.isGameOver = true;
            this.status$.next('GAME OVER');
            this.audio.playGameOver();
            setTimeout(() => this.effects$.next({ type: 'GAMEOVER' }), 2000);
        }
        this.emit();
    }

    handleInput(action: InputAction) {
        if (this.isPaused || this.isGameOver) return;
        if (action.type === 'LEFT') this.move(-1, 0);
        if (action.type === 'RIGHT') this.move(1, 0);
        if (action.type === 'DOWN') this.move(0, -1);
        if (action.type === 'UP') this.rot();
        if (action.type === 'SELECT') {
            while (this.move(0, -1));
            this.lock();
            this.audio.playMove();
        }
    }

    move(dx: number, dy: number) {
        if (!this.active) return false;
        this.active.x += dx; this.active.y += dy;
        if (this.col(0, 0)) {
            this.active.x -= dx; this.active.y -= dy;
            return false;
        }
        this.emit();
        return true;
    }

    rot() {
        if(!this.active) return;
        const s = this.active.shape;
        this.active.shape = s[0].map((_, i) => s.map(r => r[i]).reverse());
        if (this.col(0, 0)) this.active.shape = s;
        else this.emit();
    }

    col(dx: number, dy: number) {
        if(!this.active) return false;
        const s = this.active.shape;
        for (let r = 0; r < s.length; r++) for (let c = 0; c < s[r].length; c++) if (s[r][c]) {
            const wx = this.active.x + c + dx, wy = this.active.y - r + dy;
            if (wx < 0 || wx >= 10 || wy < 0 || (wy < 20 && this.grid[wx][wy])) return true;
        }
        return false;
    }

    lock() {
        if(!this.active) return;
        const s = this.active.shape;
        for (let r = 0; r < s.length; r++) for (let c = 0; c < s[r].length; c++) if (s[r][c]) {
            const wy = this.active.y - r;
            if (wy >= 0) this.grid[this.active.x + c][wy] = { 
                id: `${this.active.id}${r}${c}`, type: this.active.type, x: this.active.x + c, y: wy
            };
        }
        this.audio.playSelect();
        let l = 0;
        for (let y = 0; y < 20; y++) {
            if ([...Array(10)].every((_, x) => this.grid[x][y])) {
                l++;
                for (let x = 0; x < 10; x++) this.effects$.next({ type: 'EXPLODE', x, y, color: this.cols[this.grid[x][y]!.type], style: 'CONFETTI' });
                for (let k = y; k < 19; k++) for (let x = 0; x < 10; x++) {
                    this.grid[x][k] = this.grid[x][k + 1];
                    if(this.grid[x][k]) this.grid[x][k]!.y = k;
                }
                for (let x = 0; x < 10; x++) this.grid[x][19] = null;
                y--;
            }
        }
        if (l) {
            this.updateScore(l * 100);
            this.subStat$.next(this.subStat += l);
        }
        this.spawn();
    }

    emit() {
        const renderList: GameItem[] = [];
        for (let x = 0; x < 10; x++) for (let y = 0; y < 20; y++) if (this.grid[x][y]) renderList.push({ ...this.grid[x][y]!, spawnStyle: 'instant' });
        if (this.active) {
            const s = this.active.shape;
            for (let r = 0; r < s.length; r++) for (let c = 0; c < s[r].length; c++) if (s[r][c])
                renderList.push({ id: `${this.active.id}p${r}${c}`, type: this.active.type, x: this.active.x + c, y: this.active.y - r });
        }
        this.state$.next(renderList);
    }

    getRenderConfig() { return { geometry: 'box' as const, colors: this.cols, bgColor: 0x050510 }; }
}

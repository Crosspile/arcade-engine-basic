import { interval, filter } from 'rxjs';
import { GameModel } from './GameModel';
import type { GameItem, InputAction, SoundEmitter } from '../engine/types';

const EMPTY = 0;
const FILLED = 1;
const BORDER = 2;
const TRAIL = 3;

export default class Qix extends GameModel {
    grid: number[][] = [];
    player = { x: 0, y: 0, drawing: false };
    trail: {x: number, y: number}[] = [];
    
    qixes: {
        pos: { x: number, y: number };
        vel: { x: number, y: number };
    }[] = [];

    filledCount = 0;
    totalArea = 0;

    constructor(audio?: SoundEmitter) {
        super(20, 15, 'qix', audio);
    }

    start() {
        this.level = 1;
        this.startLevel();
    }

    startLevel() {
        this.isGameOver = false;
        
        // Progressive map size
        const w = Math.min(100, 20 + (this.level - 1));
        const h = Math.min(75, 15 + (this.level - 1));
        this.resize(w, h);
        
        // Init grid: Borders are filled, inside is empty
        this.grid = Array(this.width).fill(0).map(() => Array(this.height).fill(EMPTY));
        
        for(let x=0; x<this.width; x++) {
            this.grid[x][0] = BORDER;
            this.grid[x][this.height-1] = BORDER;
        }
        for(let y=0; y<this.height; y++) {
            this.grid[0][y] = BORDER;
            this.grid[this.width-1][y] = BORDER;
        }

        this.totalArea = (this.width-2) * (this.height-2);
        this.filledCount = 0;

        this.player = { x: Math.floor(this.width/2), y: 0, drawing: false };
        this.trail = [];
        
        // Progressive enemies
        this.qixes = [];
        const numQixes = 1 + Math.floor(this.level / 5); // One new Qix every 5 levels
        for (let i = 0; i < numQixes; i++) {
            this.qixes.push({
                pos: { x: this.width/2 + (Math.random()-0.5)*10, y: this.height/2 + (Math.random()-0.5)*10 },
                vel: { x: (0.5 + this.level * 0.05) * (Math.random() > 0.5 ? 1 : -1), y: (0.4 + this.level * 0.05) * (Math.random() > 0.5 ? 1 : -1) }
            });
        }

        this.status$.next(`Level ${this.level}: 0%`);
        this.emit();

        this.stop();
        this.sub.add(interval(50).pipe(filter(() => !this.isPaused && !this.isGameOver)).subscribe(() => this.tick()));
    }

    handleInput(action: InputAction) {
        if (this.isGameOver) return;

        let dx = 0, dy = 0;
        if (action.type === 'UP') dy = 1;
        if (action.type === 'DOWN') dy = -1;
        if (action.type === 'LEFT') dx = -1;
        if (action.type === 'RIGHT') dx = 1;

        if (dx === 0 && dy === 0) return;

        const nx = this.player.x + dx;
        const ny = this.player.y + dy;

        if (nx < 0 || nx >= this.width || ny < 0 || ny >= this.height) return;

        const targetCell = this.grid[nx][ny];

        if (this.player.drawing) {
            if (targetCell === EMPTY) {
                this.updateTrail(nx, ny);
            } else if (targetCell === BORDER || targetCell === FILLED) {
                this.closeShape(nx, ny);
            } else if (targetCell === TRAIL) {
                // Cannot cross own trail
                this.handleDeath();
            }
        } else {
            // Not drawing
            if (targetCell === BORDER || targetCell === FILLED) {
                this.player.x = nx;
                this.player.y = ny;
            } else if (targetCell === EMPTY) {
                // Start drawing
                this.player.drawing = true;
                this.trail.push({x: this.player.x, y: this.player.y}); // Add start point
                this.updateTrail(nx, ny);
            }
        }
        this.emit();
    }

    updateTrail(x: number, y: number) {
        this.player.x = x;
        this.player.y = y;
        this.grid[x][y] = TRAIL;
        this.trail.push({x, y});
    }

    closeShape(endX: number, endY: number) {
        this.player.x = endX;
        this.player.y = endY;
        this.player.drawing = false;
        
        // Convert trail to border temporarily for flood fill check
        this.trail.forEach(p => this.grid[p.x][p.y] = BORDER);

        const safeArea = new Set<string>();

        // For each Qix, find its reachable area and add it to the safe zone
        for (const qix of this.qixes) {
            const qx = Math.floor(qix.pos.x);
            const qy = Math.floor(qix.pos.y);

            if (qx < 0 || qx >= this.width || qy < 0 || qy >= this.height || this.grid[qx][qy] !== EMPTY) continue;
            if (safeArea.has(`${qx},${qy}`)) continue;

            const stack = [{x: qx, y: qy}];
            const visitedThisQix = new Set<string>();
            visitedThisQix.add(`${qx},${qy}`);

            while(stack.length > 0) {
                const p = stack.pop()!;
                const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
                for(const d of dirs) {
                    const nx = p.x + d[0];
                    const ny = p.y + d[1];
                    if(nx>=0 && nx<this.width && ny>=0 && ny<this.height) {
                        if (this.grid[nx][ny] === EMPTY && !visitedThisQix.has(`${nx},${ny}`)) {
                            visitedThisQix.add(`${nx},${ny}`);
                            stack.push({x: nx, y: ny});
                        }
                    }
                }
            }
            visitedThisQix.forEach(key => safeArea.add(key));
        }

        // Any EMPTY cell NOT in the safeArea is the captured area.
        let captured = 0;
        for(let x=0; x<this.width; x++) {
            for(let y=0; y<this.height; y++) {
                if (this.grid[x][y] === EMPTY && !safeArea.has(`${x},${y}`)) {
                    this.grid[x][y] = FILLED;
                    captured++;
                    this.effects$.next({ type: 'PARTICLE', x, y, color: 0x0000ff, style: 'PUFF' });
                }
            }
        }

        // Convert the path itself to filled area
        this.trail.forEach(p => {
            if (this.grid[p.x][p.y] === BORDER) {
                this.grid[p.x][p.y] = FILLED;
                captured++;
            }
        });

        this.trail = [];
        this.filledCount += captured;
        
        const percent = Math.floor((this.filledCount / this.totalArea) * 100);
        this.status$.next(`Level ${this.level}: ${percent}%`);
        this.updateScore(captured * 10);
        this.audio.playMatch();

        if (percent >= 75) {
            this.handleWin();
        }
    }

    tick() {
        // Move Qixes
        for (const qix of this.qixes) {
            let nx = qix.pos.x + qix.vel.x;
            let ny = qix.pos.y + qix.vel.y;

            const ix = Math.floor(nx);
            const iy = Math.floor(ny);

            if (ix < 0 || ix >= this.width || iy < 0 || iy >= this.height) {
                 qix.vel.x *= -1; qix.vel.y *= -1;
                 continue;
            }

            const cell = this.grid[ix][iy];

            if (cell === TRAIL) {
                this.handleDeath();
                return;
            }

            if (cell === BORDER || cell === FILLED) {
                // Bounce logic
                const testX = Math.floor(qix.pos.x + qix.vel.x);
                const testY = Math.floor(qix.pos.y);
                if (testX < 0 || testX >= this.width || (this.grid[testX][testY] !== EMPTY && this.grid[testX][testY] !== TRAIL)) {
                    qix.vel.x *= -1;
                }
                
                const testX2 = Math.floor(qix.pos.x);
                const testY2 = Math.floor(qix.pos.y + qix.vel.y);
                if (testY2 < 0 || testY2 >= this.height || (this.grid[testX2][testY2] !== EMPTY && this.grid[testX2][testY2] !== TRAIL)) {
                    qix.vel.y *= -1;
                }
                
                nx = qix.pos.x + qix.vel.x;
                ny = qix.pos.y + qix.vel.y;
            }

            qix.pos.x = nx;
            qix.pos.y = ny;
        }

        this.emit();
    }

    handleDeath() {
        this.isGameOver = true;
        this.status$.next('GAME OVER');
        this.audio.playGameOver();
        this.effects$.next({ type: 'EXPLODE', x: this.player.x, y: this.player.y, color: 0xff0000, style: 'EXPLODE' });
        setTimeout(() => this.effects$.next({ type: 'GAMEOVER' }), 2000);
    }

    handleWin() {
        this.status$.next('LEVEL CLEARED!');
        this.audio.playMatch();
        setTimeout(() => {
            this.level++;
            this.startLevel();
        }, 2000);
    }

    emit() {
        const items: GameItem[] = [];
        // Optimize: Only render non-empty cells to save triangles
        for(let x=0; x<this.width; x++) for(let y=0; y<this.height; y++) {
            const t = this.grid[x][y];
            if (t !== EMPTY) items.push({ id: `q_${x}_${y}`, x, y, type: t });
        }
        
        items.push({ id: 'player', x: this.player.x, y: this.player.y, type: 10 });
        
        this.qixes.forEach((q, i) => {
            items.push({ id: `qix_${i}`, x: q.pos.x - 0.5, y: q.pos.y - 0.5, type: 20, tween: { duration: 50 } });
        });
        this.state$.next(items);
    }

    getRenderConfig() {
        return {
            geometry: {
                1: 'Box', // Filled
                2: 'Box', // Border
                3: 'Box', // Trail
                10: 'Box', // Player
                20: 'Sphere' // Qix
            },
            colors: {
                1: 0x0000aa, // Blue Fill
                2: 0xffffff, // White Border
                3: 0xff0000, // Red Trail
                10: 0x00ff00, // Green Player
                20: 0xff0000  // Red Qix
            },
            bgColor: 0x000000
        };
    }
}
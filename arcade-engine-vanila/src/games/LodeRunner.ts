import { interval, filter } from 'rxjs';
import { GameModel } from './GameModel';
import type { GameItem, InputAction, SoundEmitter } from '../engine/types';

const W = 20;
const H = 16;

const T_EMPTY = 0;
const T_BRICK = 1;
const T_SOLID = 2;
const T_LADDER = 3;
const T_ROPE = 4;
const T_GOLD = 5;

interface Entity {
    id: string;
    x: number;
    y: number;
    type: 'PLAYER' | 'ENEMY';
    dx: number; // Last direction x
    state: 'IDLE' | 'RUN' | 'CLIMB' | 'FALL' | 'TRAPPED';
    fallY: number; // For smooth falling animation logic if needed, or just logic state
    trapTimer: number;
    hasGold?: boolean;
}

interface Hole {
    x: number;
    y: number;
    timer: number;
}

export default class LodeRunner extends GameModel {
    grid: number[][] = [];
    gold: {x: number, y: number, id: string}[] = [];
    holes: Hole[] = [];
    
    player: Entity = { id: 'p1', x: 1, y: 1, type: 'PLAYER', dx: 0, state: 'IDLE', fallY: 0, trapTimer: 0 };
    enemies: Entity[] = [];
    
    collected = 0;
    totalGold = 0;
    exitOpen = false;

    constructor(audio?: SoundEmitter) {
        super(W, H, 'loderunner', audio);
    }

    start() {
        this.level = 1;
        this.score = 0;
        this.startLevel();
    }

    startLevel() {
        this.isGameOver = false;
        this.resize(W, H);
        this.grid = Array(W).fill(0).map(() => Array(H).fill(T_EMPTY));
        this.gold = [];
        this.holes = [];
        this.enemies = [];
        this.collected = 0;
        this.exitOpen = false;

        // Generate Level
        // Floor
        for(let x=0; x<W; x++) this.grid[x][0] = T_SOLID;
        
        // Platforms
        for(let y=3; y<H-2; y+=3) {
            let gap = false;
            for(let x=0; x<W; x++) {
                if (Math.random() < 0.1) gap = !gap;
                if (!gap) this.grid[x][y] = T_BRICK;
                else if (Math.random() < 0.5 && x > 0 && x < W-1) this.grid[x][y] = T_ROPE;
            }
        }

        // Ladders
        for(let y=0; y<H-3; y+=3) {
            const ladders = Math.floor(Math.random() * 2) + 2;
            for(let i=0; i<ladders; i++) {
                const x = Math.floor(Math.random() * (W-2)) + 1;
                // Build ladder up to next platform
                for(let k=0; k<=3; k++) {
                    if (y+k < H) this.grid[x][y+k] = T_LADDER;
                }
            }
        }

        // Gold
        this.totalGold = 5 + Math.floor(this.level * 1.5);
        for(let i=0; i<this.totalGold; i++) {
            let placed = false;
            while(!placed) {
                const x = Math.floor(Math.random() * W);
                const y = Math.floor(Math.random() * (H-2)) + 1;
                if (this.grid[x][y] === T_EMPTY && this.grid[x][y-1] !== T_EMPTY) {
                    this.gold.push({ x, y, id: this.uid() });
                    placed = true;
                }
            }
        }

        // Player Spawn
        this.player = { id: 'p1', x: 1, y: 1, type: 'PLAYER', dx: 1, state: 'IDLE', fallY: 0, trapTimer: 0 };

        // Enemies
        const enemyCount = Math.min(5, 2 + Math.floor(this.level/2));
        for(let i=0; i<enemyCount; i++) {
            this.enemies.push({
                id: this.uid(),
                x: W - 2 - i,
                y: H - 2,
                type: 'ENEMY',
                dx: -1,
                state: 'FALL',
                fallY: 0,
                trapTimer: 0
            });
        }

        this.status$.next(`Level ${this.level}`);
        this.emit();
        
        this.stop();
        this.sub.add(interval(150).pipe(filter(() => !this.isPaused && !this.isGameOver)).subscribe(() => this.tick()));
    }

    handleInput(action: InputAction) {
        if (this.isGameOver) return;
        
        if (action.type === 'SELECT') {
            this.dig();
            return;
        }

        if (this.player.state === 'FALL' || this.player.state === 'TRAPPED') return;

        let dx = 0;
        let dy = 0;

        if (action.type === 'LEFT') dx = -1;
        if (action.type === 'RIGHT') dx = 1;
        if (action.type === 'UP') dy = 1;
        if (action.type === 'DOWN') dy = -1;

        if (dx !== 0) {
            this.player.dx = dx;
            const nx = this.player.x + dx;
            if (nx >= 0 && nx < W) {
                const t = this.grid[nx][this.player.y];
                if (t !== T_BRICK && t !== T_SOLID) {
                    this.player.x = nx;
                    this.player.state = 'RUN';
                }
            }
        } else if (dy !== 0) {
            const ny = this.player.y + dy;
            const cx = this.player.x;
            const cy = this.player.y;
            
            // Climbing logic
            const current = this.grid[cx][cy];
            const target = (ny >= 0 && ny < H) ? this.grid[cx][ny] : T_SOLID;

            if (dy > 0) { // Up
                if (current === T_LADDER || (target === T_LADDER)) {
                    if (target !== T_BRICK && target !== T_SOLID) {
                        this.player.y = ny;
                        this.player.state = 'CLIMB';
                    }
                }
            } else { // Down
                if (current === T_LADDER || this.grid[cx][cy-1] === T_LADDER || current === T_ROPE) {
                     if (ny >= 0 && target !== T_BRICK && target !== T_SOLID) {
                        this.player.y = ny;
                        this.player.state = 'CLIMB';
                     }
                }
            }
        }
        this.emit();
    }

    dig() {
        // Dig in direction of dx
        const tx = this.player.x + (this.player.dx || 1);
        const ty = this.player.y - 1;

        if (tx >= 0 && tx < W && ty >= 0) {
            // Check if target is brick and space above it is empty
            if (this.grid[tx][ty] === T_BRICK && this.grid[tx][ty+1] !== T_BRICK && this.grid[tx][ty+1] !== T_SOLID && this.grid[tx][ty+1] !== T_LADDER) {
                this.grid[tx][ty] = T_EMPTY;
                this.holes.push({ x: tx, y: ty, timer: 20 }); // ~3 seconds
                this.audio.playMove(); // Dig sound
                this.emit();
            }
        }
    }

    tick() {
        // 1. Update Holes
        for(let i=this.holes.length-1; i>=0; i--) {
            const h = this.holes[i];
            h.timer--;
            if (h.timer <= 0) {
                // Fill hole
                this.grid[h.x][h.y] = T_BRICK;
                
                // Kill anything inside
                if (this.player.x === h.x && this.player.y === h.y) this.handleDeath();
                
                this.enemies.forEach(e => {
                    if (e.x === h.x && e.y === h.y) {
                        // Respawn enemy at top
                        e.x = Math.floor(Math.random() * W);
                        e.y = H - 1;
                        e.state = 'FALL';
                    }
                });
                
                this.holes.splice(i, 1);
            }
        }

        // 2. Physics (Gravity)
        this.applyPhysics(this.player);
        this.enemies.forEach(e => {
            this.moveEnemy(e);
            this.applyPhysics(e);
        });

        // 3. Interactions
        // Gold
        for(let i=this.gold.length-1; i>=0; i--) {
            const g = this.gold[i];
            if (this.player.x === g.x && this.player.y === g.y) {
                this.gold.splice(i, 1);
                this.collected++;
                this.updateScore(100);
                this.audio.playSelect();
                if (this.collected >= this.totalGold && !this.exitOpen) {
                    this.exitOpen = true;
                    this.status$.next('EXIT OPEN!');
                    this.audio.playMatch();
                    // Spawn exit ladder at top
                    for(let y=0; y<H; y++) this.grid[W-1][y] = T_LADDER;
                }
            }
        }

        // Enemies
        this.enemies.forEach(e => {
            if (Math.abs(e.x - this.player.x) < 0.5 && Math.abs(e.y - this.player.y) < 0.5) {
                this.handleDeath();
            }
        });

        // Win
        if (this.exitOpen && this.player.y === H-1) {
            this.handleWin();
        }

        this.emit();
    }

    moveEnemy(e: Entity) {
        if (e.state === 'TRAPPED') {
            e.trapTimer--;
            if (e.trapTimer <= 0) {
                // Climb out if possible
                e.y++;
                e.state = 'IDLE';
            }
            return;
        }
        if (e.state === 'FALL') return;

        // Simple AI
        // Move towards player X
        const dx = this.player.x > e.x ? 1 : -1;
        const dy = this.player.y > e.y ? 1 : -1;

        // Try horizontal
        if (e.x !== this.player.x) {
            const nx = e.x + dx;
            if (nx >= 0 && nx < W && this.grid[nx][e.y] !== T_BRICK && this.grid[nx][e.y] !== T_SOLID) {
                e.x = nx;
                e.dx = dx;
                return;
            }
        }

        // Try vertical (Ladder)
        if (this.grid[e.x][e.y] === T_LADDER) {
            const ny = e.y + dy;
            if (ny >= 0 && ny < H && this.grid[e.x][ny] !== T_BRICK && this.grid[e.x][ny] !== T_SOLID) {
                e.y = ny;
            }
        }
    }

    applyPhysics(e: Entity) {
        // Check if trapped in hole
        const inHole = this.holes.some(h => h.x === e.x && h.y === e.y);
        if (inHole) {
            if (e.state !== 'TRAPPED') {
                e.state = 'TRAPPED';
                e.trapTimer = 30; // Stuck for a bit
            }
            return;
        }

        // Gravity
        const current = this.grid[e.x][e.y];
        const below = e.y > 0 ? this.grid[e.x][e.y-1] : T_SOLID;
        
        const supported = 
            below === T_BRICK || 
            below === T_SOLID || 
            below === T_LADDER || 
            current === T_LADDER || 
            current === T_ROPE ||
            this.holes.some(h => h.x === e.x && h.y === e.y - 1 && e.type === 'PLAYER');

        if (!supported) {
            e.y--;
            e.state = 'FALL';
        } else {
            if (e.state === 'FALL') e.state = 'IDLE';
        }
    }

    handleDeath() {
        this.isGameOver = true;
        this.status$.next('GAME OVER');
        this.audio.playGameOver();
        this.effects$.next({ type: 'EXPLODE', x: this.player.x, y: this.player.y, color: 0xffffff, style: 'EXPLODE' });
        setTimeout(() => this.effects$.next({ type: 'GAMEOVER' }), 2000);
    }

    handleWin() {
        this.status$.next('STAGE CLEAR!');
        this.audio.playMatch();
        setTimeout(() => {
            this.level++;
            this.startLevel();
        }, 2000);
    }

    emit() {
        const items: GameItem[] = [];
        for(let x=0; x<W; x++) for(let y=0; y<H; y++) {
            const t = this.grid[x][y];
            if (t !== T_EMPTY) items.push({ id: `t_${x}_${y}`, x, y, type: t });
        }
        
        this.gold.forEach(g => items.push({ id: g.id, x: g.x, y: g.y, type: T_GOLD, scale: 0.6 }));
        
        items.push({ id: 'player', x: this.player.x, y: this.player.y, type: 10 });
        
        this.enemies.forEach(e => {
            items.push({ id: e.id, x: e.x, y: e.y, type: 20 });
        });

        this.state$.next(items);
    }

    getRenderConfig() {
        return {
            geometry: {
                1: 'Box', // Brick
                2: 'Box', // Solid
                3: 'Cylinder', // Ladder
                4: 'Cylinder', // Rope
                5: 'Sphere', // Gold
                10: 'Sphere', // Player
                20: 'Sphere' // Enemy
            },
            colors: {
                1: 0xb22222, // Brick Red
                2: 0x555555, // Concrete Grey
                3: 0xffffff, // Ladder White
                4: 0xaaaaaa, // Rope Grey
                5: 0xffd700, // Gold
                10: 0x00ff00, // Player Green
                20: 0xff0000 // Enemy Red
            },
            bgColor: 0x000000
        };
    }
}
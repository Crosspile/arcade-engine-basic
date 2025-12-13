import { interval, filter } from 'rxjs';
import { GameModel } from './GameModel';
import type { GameItem, InputAction, SoundEmitter } from '../engine/types';

const TILE_EMPTY = 0;
const TILE_HARD = 1;
const TILE_SOFT = 2;
const TILE_BOMB = 3;
const TILE_EXPLOSION = 4;

const ITEM_NONE = 0;
const ITEM_FIRE = 5;
const ITEM_BOMB = 6;
const ITEM_DOOR = 7;

interface Entity {
    id: string;
    x: number;
    y: number;
    type: 'PLAYER' | 'ENEMY';
    dir?: { x: number, y: number };
    isDead?: boolean;
    moveTimer?: number;
}

interface Bomb {
    x: number;
    y: number;
    timer: number;
    range: number;
    id: string;
}

interface Explosion {
    x: number;
    y: number;
    timer: number;
}

export default class Bomberman extends GameModel {
    grid: number[][] = [];
    hiddenItems: number[][] = []; // Items hidden under soft walls
    
    player: Entity = { id: 'p1', x: 1, y: 1, type: 'PLAYER' };
    enemies: Entity[] = [];
    bombs: Bomb[] = [];
    explosions: Explosion[] = [];

    // Player Stats
    bombRange = 1;
    maxBombs = 1;
    
    constructor(audio?: SoundEmitter) {
        super(15, 13, 'bomberman', audio);
    }

    start() {
        this.level = 1;
        this.score = 0;
        this.bombRange = 1;
        this.maxBombs = 1;
        this.startLevel();
    }

    startLevel() {
        // Scale grid with level: Start 15x13, +2 every 2 levels, max 25x23
        this.isGameOver = false;
        const w = Math.min(25, 15 + Math.floor((this.level - 1) / 2) * 2);
        const h = Math.min(23, 13 + Math.floor((this.level - 1) / 2) * 2);
        this.resize(w, h);

        this.grid = Array(this.width).fill(0).map(() => Array(this.height).fill(TILE_EMPTY));
        this.hiddenItems = Array(this.width).fill(0).map(() => Array(this.height).fill(ITEM_NONE));
        this.bombs = [];
        this.explosions = [];
        this.enemies = [];
        this.player = { id: 'p1', x: 1, y: 1, type: 'PLAYER' };

        // Generate Map
        const freeSpots: {x: number, y: number}[] = [];

        for(let x=0; x<this.width; x++) {
            for(let y=0; y<this.height; y++) {
                // Hard Walls: Edges and fixed grid (odd x, odd y)
                if (x === 0 || x === this.width-1 || y === 0 || y === this.height-1 || (x % 2 === 0 && y % 2 === 0)) {
                    this.grid[x][y] = TILE_HARD;
                } else {
                    // Safe zone around player
                    if ((x===1 && y===1) || (x===2 && y===1) || (x===1 && y===2)) {
                        this.grid[x][y] = TILE_EMPTY;
                    } else {
                        // Random Soft Walls
                        if (Math.random() < 0.4) {
                            this.grid[x][y] = TILE_SOFT;
                            freeSpots.push({x, y}); // Track soft walls for items
                        } else {
                            // Chance for enemy spawn in empty space
                            if (Math.random() < 0.05) this.spawnEnemy(x, y);
                        }
                    }
                }
            }
        }

        // Place Door and Powerups under Soft Walls
        if (freeSpots.length > 0) {
            const doorIdx = Math.floor(Math.random() * freeSpots.length);
            const door = freeSpots.splice(doorIdx, 1)[0];
            this.hiddenItems[door.x][door.y] = ITEM_DOOR;

            if (freeSpots.length > 0) {
                const itemIdx = Math.floor(Math.random() * freeSpots.length);
                const item = freeSpots.splice(itemIdx, 1)[0];
                this.hiddenItems[item.x][item.y] = Math.random() > 0.5 ? ITEM_FIRE : ITEM_BOMB;
            }
        }

        // Ensure at least 3 enemies
        const maxEnemies = Math.min(15, 3 + this.level);
        while(this.enemies.length < maxEnemies) {
            let ex = Math.floor(Math.random() * (this.width-2)) + 1;
            let ey = Math.floor(Math.random() * (this.height-2)) + 1;
            if (this.grid[ex][ey] === TILE_EMPTY && (Math.abs(ex-1) + Math.abs(ey-1) > 4)) {
                this.spawnEnemy(ex, ey);
            }
        }

        this.status$.next(`Level ${this.level}`);
        this.emit();
        
        this.stop();
        this.sub.add(interval(150).pipe(filter(() => !this.isPaused && !this.isGameOver)).subscribe(() => this.tick()));
    }

    spawnEnemy(x: number, y: number) {
        this.enemies.push({ 
            id: this.uid(), x, y, type: 'ENEMY', 
            dir: {x: 1, y: 0}, moveTimer: 0 
        });
    }

    handleInput(action: InputAction) {
        if (this.isGameOver) return;

        if (action.type === 'SELECT') {
            this.placeBomb();
            return;
        }

        let dx = 0, dy = 0;
        if (action.type === 'UP') dy = 1;
        if (action.type === 'DOWN') dy = -1;
        if (action.type === 'LEFT') dx = -1;
        if (action.type === 'RIGHT') dx = 1;

        if (dx !== 0 || dy !== 0) {
            const nx = this.player.x + dx;
            const ny = this.player.y + dy;
            
            // Check bounds and walls
            if (this.isWalkable(nx, ny)) {
                this.player.x = nx;
                this.player.y = ny;
                this.checkItemPickup();
                this.emit();
            }
        }
    }

    isWalkable(x: number, y: number) {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return false;
        const tile = this.grid[x][y];
        // Can walk on Empty, Explosion, or Items (which are technically Empty in grid but have visual items)
        // Cannot walk on Hard(1), Soft(2), Bomb(3)
        // Exception: If player is ON a bomb (just placed it), they can walk OFF it.
        if (tile === TILE_BOMB) {
            if (this.player.x === x && this.player.y === y) return true;
            return false;
        }
        return tile === TILE_EMPTY || tile === TILE_EXPLOSION;
    }

    placeBomb() {
        if (this.bombs.length >= this.maxBombs) return;
        if (this.grid[this.player.x][this.player.y] === TILE_BOMB) return;

        this.bombs.push({
            x: this.player.x, y: this.player.y,
            timer: 20, // ~3 seconds at 150ms tick
            range: this.bombRange,
            id: this.uid()
        });
        this.grid[this.player.x][this.player.y] = TILE_BOMB;
        this.audio.playMove(); // Sound for placing
        this.emit();
    }

    tick() {
        // 1. Update Bombs
        for (let i = this.bombs.length - 1; i >= 0; i--) {
            const b = this.bombs[i];
            b.timer--;
            if (b.timer <= 0) {
                this.explode(b);
                this.bombs.splice(i, 1);
            }
        }

        // 2. Update Explosions
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const e = this.explosions[i];
            e.timer--;
            if (e.timer <= 0) {
                // Clear explosion from grid if it's still there
                if (this.grid[e.x][e.y] === TILE_EXPLOSION) {
                    this.grid[e.x][e.y] = TILE_EMPTY;
                }
                this.explosions.splice(i, 1);
            }
        }

        // 3. Move Enemies
        this.enemies.forEach(e => {
            if (Math.random() < 0.2 || !this.isWalkable(e.x + e.dir!.x, e.y + e.dir!.y)) {
                // Change direction
                const dirs = [{x:0, y:1}, {x:0, y:-1}, {x:1, y:0}, {x:-1, y:0}];
                const valid = dirs.filter(d => this.isWalkable(e.x + d.x, e.y + d.y));
                if (valid.length > 0) {
                    e.dir = valid[Math.floor(Math.random() * valid.length)];
                }
            }
            
            if (this.isWalkable(e.x + e.dir!.x, e.y + e.dir!.y)) {
                e.x += e.dir!.x;
                e.y += e.dir!.y;
            }
        });

        this.checkCollisions();
        this.emit();
    }

    explode(b: Bomb) {
        this.audio.playExplosion();
        this.createExplosionCell(b.x, b.y);

        const dirs = [{x:0, y:1}, {x:0, y:-1}, {x:1, y:0}, {x:-1, y:0}];
        
        dirs.forEach(d => {
            for(let i=1; i<=b.range; i++) {
                const tx = b.x + d.x * i;
                const ty = b.y + d.y * i;
                
                if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) break;
                
                const tile = this.grid[tx][ty];
                
                if (tile === TILE_HARD) break; // Stop at hard wall
                
                if (tile === TILE_SOFT) {
                    this.grid[tx][ty] = TILE_EMPTY; // Destroy soft wall
                    this.createExplosionCell(tx, ty);
                    this.updateScore(10);
                    break; // Stop ray
                }
                
                if (tile === TILE_BOMB) {
                    // Chain reaction! Find the bomb and trigger it
                    const otherB = this.bombs.find(ob => ob.x === tx && ob.y === ty);
                    if (otherB) otherB.timer = 1; // Explode next tick
                }

                this.createExplosionCell(tx, ty);
            }
        });
    }

    createExplosionCell(x: number, y: number) {
        this.grid[x][y] = TILE_EXPLOSION;
        this.explosions.push({ x, y, timer: 5 }); // Lasts 5 ticks
        this.effects$.next({ type: 'PARTICLE', x, y, color: 0xffaa00, style: 'EXPLODE' });
    }

    checkCollisions() {
        // Player vs Explosion or Enemy
        if (this.grid[this.player.x][this.player.y] === TILE_EXPLOSION || 
            this.enemies.some(e => e.x === this.player.x && e.y === this.player.y)) {
            this.handleDeath();
        }

        // Enemies vs Explosion
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (this.grid[e.x][e.y] === TILE_EXPLOSION) {
                this.enemies.splice(i, 1);
                this.updateScore(100);
                this.effects$.next({ type: 'PARTICLE', x: e.x, y: e.y, color: 0xff0000, style: 'PUFF' });
            }
        }
    }

    checkItemPickup() {
        const item = this.hiddenItems[this.player.x][this.player.y];
        if (item !== ITEM_NONE) {
            if (item === ITEM_FIRE) {
                this.bombRange++;
                this.updateScore(50);
                this.status$.next('FIRE UP!');
                this.hiddenItems[this.player.x][this.player.y] = ITEM_NONE;
                this.audio.playSelect();
            } else if (item === ITEM_BOMB) {
                this.maxBombs++;
                this.updateScore(50);
                this.status$.next('BOMB UP!');
                this.hiddenItems[this.player.x][this.player.y] = ITEM_NONE;
                this.audio.playSelect();
            } else if (item === ITEM_DOOR) {
                if (this.enemies.length === 0) {
                    this.handleWin();
                }
            }
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
        
        for(let x=0; x<this.width; x++) for(let y=0; y<this.height; y++) {
            const tile = this.grid[x][y];
            const hidden = this.hiddenItems[x][y];
            
            // Render Floor/Items first
            if (hidden !== ITEM_NONE && tile === TILE_EMPTY) {
                items.push({ id: `i_${x}_${y}`, x, y, type: hidden, scale: 0.6 });
            }

            if (tile === TILE_HARD) items.push({ id: `w_${x}_${y}`, x, y, type: TILE_HARD });
            else if (tile === TILE_SOFT) items.push({ id: `s_${x}_${y}`, x, y, type: TILE_SOFT });
            else if (tile === TILE_BOMB) items.push({ id: `b_${x}_${y}`, x, y, type: TILE_BOMB, scale: 0.8 });
            else if (tile === TILE_EXPLOSION) items.push({ id: `e_${x}_${y}`, x, y, type: TILE_EXPLOSION, scale: 0.9 });
        }

        items.push({ id: 'player', x: this.player.x, y: this.player.y, type: 10 });
        
        this.enemies.forEach(e => {
            items.push({ id: e.id, x: e.x, y: e.y, type: 20 });
        });

        this.state$.next(items);
    }

    getRenderConfig() {
        return {
            geometry: {
                1: 'Box', // Hard Wall
                2: 'Box', // Soft Wall
                3: 'Sphere', // Bomb
                4: 'Box', // Explosion
                5: 'Cylinder', // Fire Item
                6: 'Sphere', // Bomb Item
                7: 'Box', // Door
                10: 'Sphere', // Player
                20: 'Sphere', // Enemy
            },
            colors: {
                1: 0x555555, // Grey Hard Wall
                2: 0xcd853f, // Brick Soft Wall
                3: 0x000000, // Black Bomb
                4: 0xff4500, // Orange Explosion
                5: 0xffd700, // Gold Fire
                6: 0x000000, // Black Bomb Item
                7: 0x0000ff, // Blue Door
                10: 0xffffff, // White Player
                20: 0xff0000, // Red Enemy
            },
            bgColor: 0x228b22 // Green Grass
        };
    }
}
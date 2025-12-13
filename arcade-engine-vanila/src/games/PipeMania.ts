import * as THREE from 'three';
import { interval, filter } from 'rxjs';
import { GameModel } from './GameModel';
import type { GameItem, InputAction, SoundEmitter } from '../engine/types';
import { util } from '../engine/utils/util';

// Direction Bitmasks
const UP = 1;
const RIGHT = 2;
const DOWN = 4;
const LEFT = 8;

// Pipe Definitions (Bitmask of connections)
const P_V = UP | DOWN;          // 5  ║
const P_H = LEFT | RIGHT;       // 10 ═
const P_UR = UP | RIGHT;        // 3  ╚
const P_RD = RIGHT | DOWN;      // 6  ╔
const P_DL = DOWN | LEFT;       // 12 ╗
const P_LU = LEFT | UP;         // 9  ╝
const P_CROSS = UP | RIGHT | DOWN | LEFT; // 15 ╬
const OBSTACLE = 16;            // 16 █

const CHARS: Record<number, string> = {
    [P_V]: '║', [P_H]: '═',
    [P_UR]: '╚', [P_RD]: '╔', [P_DL]: '╗', [P_LU]: '╝',
    [P_CROSS]: '╬'
};

interface Cell {
    type: number;   // Pipe bitmask
    filled: boolean;
    fixed: boolean; // Start/End are fixed
    flowDir: number; // Direction water entered from (for rendering flow)
}

export default class PipeMania extends GameModel {
    grid: Cell[][] = [];
    cursor = { x: 0, y: 0 };
    queue: number[] = [];
    
    // Flow State
    flowing = false;
    flowX = 0;
    flowY = 0;
    flowEnterDir = 0; // Direction water is entering the current cell FROM
    timer = 0;
    flowSpeed = 500;
    
    startPos = { x: 0, y: 0, dir: RIGHT };
    endPos = { x: 0, y: 0, dir: LEFT };

    constructor(audio?: SoundEmitter) {
        super(10, 10, 'pipemania', audio);
    }

    start() {
        this.level = 1;
        this.startLevel();
    }

    startLevel() {
        this.isGameOver = false;
        this.flowing = false;
        
        // Scale grid size every 5 levels to allow obstacle density to build up
        const cycle = 5;
        const size = Math.min(15, 6 + Math.floor((this.level - 1) / cycle));
        this.resize(size, size);
        
        // Init Grid
        this.grid = Array(this.width).fill(null).map(() => 
            Array(this.height).fill(null).map(() => ({ type: 0, filled: false, fixed: false, flowDir: 0 }))
        );

        // Setup Start (Left side)
        this.startPos = { x: 0, y: Math.floor(Math.random() * (this.height - 2)) + 1, dir: RIGHT };
        this.grid[this.startPos.x][this.startPos.y] = { type: P_H, filled: true, fixed: true, flowDir: LEFT }; // Filled initially
        
        // Setup End (Right side)
        this.endPos = { x: this.width - 1, y: Math.floor(Math.random() * (this.height - 2)) + 1, dir: LEFT };
        this.grid[this.endPos.x][this.endPos.y] = { type: P_H, filled: false, fixed: true, flowDir: 0 };

        // Place Obstacles: Start at 2, increase by 2 each level within the cycle
        // This reaches ~10 obstacles before grid expands (approx 25% of 6x6)
        const subLevel = (this.level - 1) % cycle;
        const obstacleCount = 2 + (subLevel * 2);
        this.placeObstacles(obstacleCount);

        // Init Queue
        this.queue = [];
        for(let i=0; i<5; i++) {
            const last = this.queue.length > 0 ? this.queue[this.queue.length - 1] : null;
            this.queue.push(this.generatePipe(last));
        }

        // Init Flow State
        this.flowX = this.startPos.x;
        this.flowY = this.startPos.y;
        this.flowEnterDir = LEFT; // Water enters start from the "void" on the left
        
        // Timer for auto-start
        // Time increases with grid area and obstacles
        this.timer = 10 + Math.floor((size * size) / 5) + Math.floor(obstacleCount * 1.5);
        this.flowSpeed = Math.max(100, 500 - (this.level * 10));

        this.cursor = { x: 1, y: this.startPos.y };
        
        this.status$.next(`Flow in ${this.timer}s`);
        this.emit();

        this.stop();
        // Tick for timer and flow
        this.sub.add(interval(1000).pipe(filter(() => !this.isPaused && !this.isGameOver && !this.flowing)).subscribe(() => {
            this.timer--;
            this.status$.next(`Flow in ${this.timer}s`);
            if (this.timer <= 0) {
                this.startFlow();
            }
        }));

        this.sub.add(interval(this.flowSpeed).pipe(filter(() => !this.isPaused && !this.isGameOver && this.flowing)).subscribe(() => {
            this.tickFlow();
        }));
    }

    placeObstacles(count: number) {
        let placed = 0;
        let attempts = 0;
        while(placed < count && attempts < 1000) {
            attempts++;
            const x = Math.floor(Math.random() * this.width);
            const y = Math.floor(Math.random() * this.height);
            
            // Don't place on start, end, existing obstacle or immediately adjacent to start/end
            if ((x === this.startPos.x && y === this.startPos.y) ||
                (x === this.endPos.x && y === this.endPos.y) ||
                this.grid[x][y].type !== 0 || (x === this.startPos.x + 1 && y === this.startPos.y) ||
                (x === this.endPos.x - 1 && y === this.endPos.y)) {
                continue;
            }
            
            // Temporarily place
            this.grid[x][y].type = OBSTACLE;
            this.grid[x][y].fixed = true;
            
            // Check path
            if (this.hasPath()) {
                placed++;
            } else {
                // Revert if it blocks the path
                this.grid[x][y].type = 0;
                this.grid[x][y].fixed = false;
            }
        }
    }

    hasPath() {
        const q = [{x: this.startPos.x, y: this.startPos.y}];
        const visited = new Set<string>();
        visited.add(`${this.startPos.x},${this.startPos.y}`);
        const dirs = [{x:0, y:1}, {x:0, y:-1}, {x:1, y:0}, {x:-1, y:0}];
        
        while(q.length > 0) {
            const curr = q.shift()!;
            if (curr.x === this.endPos.x && curr.y === this.endPos.y) return true;
            for(const d of dirs) {
                const nx = curr.x + d.x, ny = curr.y + d.y;
                if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                    const key = `${nx},${ny}`;
                    if (!visited.has(key) && this.grid[nx][ny].type !== OBSTACLE) {
                        visited.add(key);
                        q.push({x: nx, y: ny});
                    }
                }
            }
        }
        return false;
    }

    generatePipe(exclude: number | null) {
        const pool = [P_V, P_H, P_UR, P_RD, P_DL, P_LU, P_CROSS];
        return util.ds.array.pickRandomNoRepeat(pool, exclude);
    }

    handleInput(action: InputAction) {
        if (this.isGameOver) return;

        let dx = 0, dy = 0;
        if (action.type === 'UP') dy = 1;
        if (action.type === 'DOWN') dy = -1;
        if (action.type === 'LEFT') dx = -1;
        if (action.type === 'RIGHT') dx = 1;

        if (dx !== 0 || dy !== 0) {
            const nx = this.cursor.x + dx;
            const ny = this.cursor.y + dy;
            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                this.cursor.x = nx;
                this.cursor.y = ny;
                this.emit();
            }
        } else if (action.type === 'SELECT') {
            const cell = this.grid[this.cursor.x][this.cursor.y];
            
            // If clicking start and not flowing, start immediately
            if (this.cursor.x === this.startPos.x && this.cursor.y === this.startPos.y && !this.flowing) {
                this.startFlow();
                return;
            }

            // Place pipe
            if (!cell.fixed && !cell.filled) {
                const pipe = this.queue.shift()!;
                const last = this.queue[this.queue.length - 1];
                this.queue.push(this.generatePipe(last));
                
                cell.type = pipe;
                this.audio.playMove();
                this.emit();
            } else {
                this.audio.playTone(150, 'sawtooth', 0.1); // Error sound
            }
        }
    }

    startFlow() {
        this.flowing = true;
        this.status$.next('FLOWING!');
        this.audio.playSelect();
    }

    tickFlow() {
        // Determine exit direction from current cell based on entry direction
        const currentCell = this.grid[this.flowX][this.flowY];
        
        let exitDir = 0;
        
        if (currentCell.type === P_CROSS) {
            // Cross goes straight
            exitDir = this.getOppositeDir(this.flowEnterDir);
        } else {
            // Find the bit that is NOT the enter dir
            exitDir = currentCell.type & ~this.flowEnterDir;
        }

        // Calculate next position
        let nextX = this.flowX;
        let nextY = this.flowY;
        let nextEnterDir = 0;

        if (exitDir === UP) { nextY++; nextEnterDir = DOWN; }
        else if (exitDir === DOWN) { nextY--; nextEnterDir = UP; }
        else if (exitDir === LEFT) { nextX--; nextEnterDir = RIGHT; }
        else if (exitDir === RIGHT) { nextX++; nextEnterDir = LEFT; }
        else {
            this.handleLeak();
            return;
        }

        // Check bounds
        if (nextX < 0 || nextX >= this.width || nextY < 0 || nextY >= this.height) {
            this.handleLeak();
            return;
        }

        const nextCell = this.grid[nextX][nextY];

        // Check connection: Next cell must have a port facing us (matching nextEnterDir)
        if ((nextCell.type & nextEnterDir) === 0) {
            this.handleLeak();
            return;
        }

        // Move water
        this.flowX = nextX;
        this.flowY = nextY;
        this.flowEnterDir = nextEnterDir;
        
        nextCell.filled = true;
        nextCell.flowDir = nextEnterDir;
        
        this.updateScore(10);
        this.audio.playTone(400 + (this.flowX * 20), 'sine', 0.05);
        this.emit();

        // Check Win
        if (this.flowX === this.endPos.x && this.flowY === this.endPos.y) {
            this.handleWin();
        }
    }

    getOppositeDir(dir: number) {
        if (dir === UP) return DOWN;
        if (dir === DOWN) return UP;
        if (dir === LEFT) return RIGHT;
        if (dir === RIGHT) return LEFT;
        return 0;
    }

    handleLeak() {
        this.status$.next('LEAK!');
        this.isGameOver = true;
        this.audio.playExplosion();
        this.effects$.next({ type: 'EXPLODE', x: this.flowX, y: this.flowY, color: 0x0000ff, style: 'EXPLODE' });
        setTimeout(() => this.effects$.next({ type: 'GAMEOVER' }), 2000);
    }

    handleWin() {
        this.flowing = false;
        this.stop();
        this.status$.next('CONNECTED!');
        this.updateScore(1000);
        this.audio.playMatch();
        this.effects$.next({ type: 'PARTICLE', x: this.endPos.x, y: this.endPos.y, color: 0x00ff00, style: 'CONFETTI' });
        setTimeout(() => {
            this.level++;
            this.startLevel();
        }, 2000);
    }

    createPipeMeshItems(x: number, y: number, type: number, color: number, idBase: string, spawnStyle?:string): GameItem[] {
        const items: GameItem[] = [];
        const base = { x, y, color, type: 5, spawnStyle:spawnStyle as any }; // Default to curve (5)

        switch (type) {
            case P_V:
                items.push({ ...base, id: idBase, type: 4 });
                break;
            case P_H:
                items.push({ ...base, id: idBase, type: 4, rotation: { x: 0, y: 0, z: Math.PI / 2 } });
                break;
            case P_CROSS:
                items.push(
                    { ...base, id: `${idBase}_v`, type: 4 },
                    { ...base, id: `${idBase}_h`, type: 4, rotation: { x: 0, y: 0, z: Math.PI / 2 } }
                );
                break;
            case P_UR:
                items.push({ ...base, id: idBase, rotation: { x: 0, y: 0, z: Math.PI } });
                break;
            case P_RD:
                items.push({ ...base, id: idBase, rotation: { x: 0, y: 0, z: Math.PI / 2 } });
                break;
            case P_DL:
                items.push({ ...base, id: idBase });
                break;
            case P_LU:
                items.push({ ...base, id: idBase, rotation: { x: 0, y: 0, z: -Math.PI / 2 } });
                break;
        }
        return items;
    }

    emit() {
        const items: GameItem[] = [];
        
        for(let x=0; x<this.width; x++) for(let y=0; y<this.height; y++) {
            const cell = this.grid[x][y];
            const isCursor = this.cursor.x === x && this.cursor.y === y;
            
            // Base Tile
            let type = 0; // Empty
            let color = 0x222222;
            let text = undefined;
            let textColor = '#ffffff';

            if (cell.type === OBSTACLE) {
                items.push({
                    id: `obs_${x}_${y}`, x, y, type: 6, color: 0x441111
                });
                continue;
            }

            if (cell.type !== 0) {
                type = 1; // Pipe
                color = cell.filled ? 0x0044aa : 0x555555;
                text = CHARS[cell.type];
                
                if (cell.fixed) {
                    color = cell.filled ? 0x0066cc : 0x444444;
                    if (x === this.startPos.x && y === this.startPos.y) { text = 'S'; color = 0x008800; }
                    if (x === this.endPos.x && y === this.endPos.y) { text = 'E'; color = cell.filled ? 0x0044aa : 0x880000; }
                }
            }

            if (isCursor) {
                // Highlight cursor pos
                if (type === 0) { type = 2; color = 0x333333; } // Cursor on empty
                else { 
                    const c = new THREE.Color(color);
                    c.offsetHSL(0, 0, 0.2);
                    color = c.getHex();
                } // Cursor on pipe (highlight)
            }

            if(text){
                items.push(...this.createPipeMeshItems(x, y, cell.type, color, `${cell.type}_${x}_${y}`,'pop'));
            } else items.push({
                id: `next_${x}_${y}`,
                x, y,
                type,
                color,
                text,
                textColor,
                opacity:0.2
            });

        }

        // Render Queue (Next Piece)
        const nextPipe = this.queue[0];
        items.push(...this.createPipeMeshItems(this.width / 2 + 1, this.height, nextPipe, 0x555555, `next_piece_${nextPipe}`));

        this.state$.next(items);
    }

    getRenderConfig() {
        return {
            geometry: 'box' as const,
            colors: {
                0: 0x222222, // Empty
                1: 0x555555, // Pipe
                2: 0xffa500, // Orange Top
                6: 0x441111, // Obstacle
            },
            bgColor: 0x111111,
            customGeometry: (type: number) => {
                switch (type) {
                    case 4:{
                        const geo = new THREE.CylinderGeometry(0.15, 0.15, 1,14);
                        geo.translate(0,0,0);
                        return geo;
                    }
                    case 5:{
                        const geometry = new THREE.TorusGeometry(0.5, 0.15, 5, 10, Math.PI / 2);
                        
                        const segmentCenterAngle = Math.PI / 4;
                        const centerX = 0.72 * Math.cos(segmentCenterAngle);
                        const centerY = 0.72 * Math.sin(segmentCenterAngle);
                        geometry.translate(-centerX, -centerY, 0);
                        
                        return geometry;
                    }
                }
                return null;
            }
        };
    }
}

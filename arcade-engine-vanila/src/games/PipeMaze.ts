import * as THREE from 'three';
import { interval, filter } from 'rxjs';
import { GameModel } from './GameModel';
import type { GameItem, InputAction, SoundEmitter } from '../engine/types';

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
    flowDir: number; // Direction water entered from
}

export default class PipeMaze extends GameModel {
    grid: Cell[][] = [];
    cursor = { x: 0, y: 0 };
    
    // Flow State
    timer = 0;
    
    startPos = { x: 0, y: 0, dir: RIGHT };
    endPos = { x: 0, y: 0, dir: LEFT };

    constructor(audio?: SoundEmitter) {
        super(10, 10, 'pipemaze', audio);
    }

    start() {
        this.level = 1;
        this.startLevel();
    }

    startLevel() {
        this.isGameOver = false;
        
        const cycle = 5;
        const size = Math.min(15, 6 + Math.floor((this.level - 1) / cycle));
        this.resize(size, size);
        
        // Init Grid
        this.grid = Array(this.width).fill(null).map(() => 
            Array(this.height).fill(null).map(() => ({ type: 0, filled: false, fixed: false, flowDir: 0 }))
        );

        // Setup Start/End
        this.startPos = { x: 0, y: Math.floor(Math.random() * (this.height - 2)) + 1, dir: RIGHT };
        this.endPos = { x: this.width - 1, y: Math.floor(Math.random() * (this.height - 2)) + 1, dir: LEFT };

        // 1. Generate a valid path first
        this.generatePath();

        // 2. Place Obstacles
        const subLevel = (this.level - 1) % cycle;
        const obstacleCount = Math.floor((size * size) * 0.15) + (subLevel * 3);
        this.placeObstacles(obstacleCount);

        // 3. Fill remaining empty cells with random pipes
        this.fillRandom();

        // 4. Scramble rotations
        this.scramble();

        // 5. Fix Start/End (Must be Horizontal for this game's layout)
        this.grid[this.startPos.x][this.startPos.y] = { type: P_H, filled: true, fixed: true, flowDir: LEFT };
        this.grid[this.endPos.x][this.endPos.y] = { type: P_H, filled: false, fixed: true, flowDir: 0 };

        this.timer = 15 + Math.floor((size * size) / 4);

        this.cursor = { x: 1, y: this.startPos.y };
        
        this.updateFlow();
        this.status$.next(`Time: ${this.timer}`);
        this.emit();

        this.stop();
        this.sub.add(interval(1000).pipe(filter(() => !this.isPaused && !this.isGameOver)).subscribe(() => {
            this.timer--;
            this.status$.next(`Time: ${this.timer}`);
            if (this.timer <= 0) {
                this.handleTimeout();
            }
        }));
    }

    placeObstacles(count: number) {
        let placed = 0;
        let attempts = 0;
        while(placed < count && attempts < 1000) {
            attempts++;
            const x = Math.floor(Math.random() * this.width);
            const y = Math.floor(Math.random() * this.height);
            if (this.grid[x][y].type === 0) {
                this.grid[x][y].type = OBSTACLE;
                placed++;
            }
        }
    }

    generatePath() {
        // DFS Backtracking to ensure a valid path exists
        const startNode = { x: 1, y: this.startPos.y };
        const targetNode = { x: this.width - 2, y: this.endPos.y };
        
        const path: {x: number, y: number}[] = [];
        const visited = new Set<string>();
        
        // Add start (fixed)
        path.push({x: 0, y: this.startPos.y});
        visited.add(`0,${this.startPos.y}`);

        const solve = (curr: {x: number, y: number}): boolean => {
            path.push(curr);
            visited.add(`${curr.x},${curr.y}`);

            if (curr.x === targetNode.x && curr.y === targetNode.y) {
                return true;
            }

            // Randomize directions
            const dirs = [
                {x: 1, y: 0}, {x: -1, y: 0}, {x: 0, y: 1}, {x: 0, y: -1}
            ].sort(() => Math.random() - 0.5);

            for (const d of dirs) {
                const nx = curr.x + d.x;
                const ny = curr.y + d.y;

                // Stay within the inner grid (columns 1 to width-2)
                if (nx >= 1 && nx <= this.width - 2 && ny >= 0 && ny < this.height) {
                    if (!visited.has(`${nx},${ny}`)) {
                        if (solve({x: nx, y: ny})) return true;
                    }
                }
            }

            path.pop();
            visited.delete(`${curr.x},${curr.y}`);
            return false;
        };

        if (!solve(startNode)) {
            console.warn("Failed to generate maze path");
            return;
        }

        // Add end (fixed)
        path.push({x: this.width - 1, y: this.endPos.y});

        // Convert path points to pipe types
        for(let i=1; i<path.length-1; i++) {
            const prev = path[i-1];
            const curr = path[i];
            const next = path[i+1];
            
            let mask = 0;
            if (prev.x < curr.x || next.x < curr.x) mask |= LEFT;
            if (prev.x > curr.x || next.x > curr.x) mask |= RIGHT;
            if (prev.y < curr.y || next.y < curr.y) mask |= DOWN;
            if (prev.y > curr.y || next.y > curr.y) mask |= UP;
            
            this.grid[curr.x][curr.y].type = mask;
        }
    }

    fillRandom() {
        const types = [P_V, P_H, P_UR, P_RD, P_DL, P_LU, P_CROSS];
        for(let x=0; x<this.width; x++) for(let y=0; y<this.height; y++) {
            if (this.grid[x][y].type === 0) {
                this.grid[x][y].type = types[Math.floor(Math.random() * types.length)];
            }
        }
    }

    scramble() {
        for(let x=0; x<this.width; x++) for(let y=0; y<this.height; y++) {
            if (!this.grid[x][y].fixed) {
                const r = Math.floor(Math.random() * 4);
                for(let i=0; i<r; i++) this.grid[x][y].type = this.rotateType(this.grid[x][y].type);
            }
        }
    }

    rotateType(t: number) {
        if (t === P_V) return P_H;
        if (t === P_H) return P_V;
        if (t === P_UR) return P_RD;
        if (t === P_RD) return P_DL;
        if (t === P_DL) return P_LU;
        if (t === P_LU) return P_UR;
        return t;
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
            
            if (!cell.fixed && cell.type !== OBSTACLE) {
                cell.type = this.rotateType(cell.type);
                this.audio.playMove();
                this.updateFlow();
                this.emit();
            } else {
                this.audio.playTone(150, 'sawtooth', 0.1);
            }
        }
    }

    updateFlow() {
        // Reset filled status
        for(let x=0; x<this.width; x++) for(let y=0; y<this.height; y++) {
            this.grid[x][y].filled = false;
            this.grid[x][y].flowDir = 0;
        }

        // Start is always filled
        const startCell = this.grid[this.startPos.x][this.startPos.y];
        startCell.filled = true;
        startCell.flowDir = LEFT;

        const queue = [{x: this.startPos.x, y: this.startPos.y}];
        const visited = new Set<string>();
        visited.add(`${this.startPos.x},${this.startPos.y}`);

        let reachedEnd = false;

        while(queue.length > 0) {
            const curr = queue.shift()!;
            const cell = this.grid[curr.x][curr.y];

            const dirs = [
                {x:0, y:1, mask: UP, opp: DOWN},
                {x:0, y:-1, mask: DOWN, opp: UP},
                {x:1, y:0, mask: RIGHT, opp: LEFT},
                {x:-1, y:0, mask: LEFT, opp: RIGHT}
            ];

            for(const d of dirs) {
                if ((cell.type & d.mask) !== 0) {
                    const nx = curr.x + d.x;
                    const ny = curr.y + d.y;
                    if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                        const nextCell = this.grid[nx][ny];
                        if ((nextCell.type & d.opp) !== 0 && !visited.has(`${nx},${ny}`)) {
                            nextCell.filled = true;
                            nextCell.flowDir = d.opp;
                            visited.add(`${nx},${ny}`);
                            queue.push({x: nx, y: ny});
                            if (nx === this.endPos.x && ny === this.endPos.y) reachedEnd = true;
                        }
                    }
                }
            }
        }

        if (reachedEnd) this.handleWin();
    }

    handleTimeout() {
        this.status$.next('TIME UP!');
        this.isGameOver = true;
        this.audio.playGameOver();
        setTimeout(() => this.effects$.next({ type: 'GAMEOVER' }), 2000);
    }

    handleWin() {
        this.stop();
        this.status$.next('CONNECTED!');
        this.updateScore(1000);
        this.audio.playMatch();
        this.effects$.next({ type: 'PARTICLE', x: this.endPos.x, y: this.endPos.y, color: 0x00ff00, style: 'CONFETTI' });
        setTimeout(() => { this.level++; this.startLevel(); }, 2000);
    }

    createPipeMeshItems(x: number, y: number, type: number, color: number, idBase: string): GameItem[] {
        const items: GameItem[] = [];
        const base = { x, y, color, type: 5, spawnStyle: 'instant' as const };
        switch (type) {
            case P_V: items.push({ ...base, id: idBase, type: 4 }); break;
            case P_H: items.push({ ...base, id: idBase, type: 4, rotation: { x: 0, y: 0, z: Math.PI / 2 } }); break;
            case P_CROSS: items.push({ ...base, id: `${idBase}_v`, type: 4 }, { ...base, id: `${idBase}_h`, type: 4, rotation: { x: 0, y: 0, z: Math.PI / 2 } }); break;
            case P_UR: items.push({ ...base, id: idBase, rotation: { x: 0, y: 0, z: Math.PI } }); break;
            case P_RD: items.push({ ...base, id: idBase, rotation: { x: 0, y: 0, z: Math.PI / 2 } }); break;
            case P_DL: items.push({ ...base, id: idBase }); break;
            case P_LU: items.push({ ...base, id: idBase, rotation: { x: 0, y: 0, z: -Math.PI / 2 } }); break;
        }
        return items;
    }

    emit() {
        const items: GameItem[] = [];
        for(let x=0; x<this.width; x++) for(let y=0; y<this.height; y++) {
            const cell = this.grid[x][y];
            const isCursor = this.cursor.x === x && this.cursor.y === y;
            
            let color = cell.filled ? 0x0044aa : 0x555555;
            if (cell.fixed) {
                color = cell.filled ? 0x0066cc : 0x444444;
                if (x === this.startPos.x && y === this.startPos.y) color = 0x008800;
                if (x === this.endPos.x && y === this.endPos.y) color = cell.filled ? 0x0044aa : 0x880000;
            }
            if (isCursor) {
                const c = new THREE.Color(color);
                c.offsetHSL(0, 0, 0.2);
                color = c.getHex();
            }

            items.push(...this.createPipeMeshItems(x, y, cell.type, color, `${cell.type}_${x}_${y}`));
        }
        this.state$.next(items);
    }

    getRenderConfig() {
        return {
            geometry: 'box' as const,
            colors: { 0: 0x222222, 1: 0x555555 },
            bgColor: 0x111111,
            customGeometry: (type: number) => {
                if (type === 4) { const geo = new THREE.CylinderGeometry(0.15, 0.15, 1, 14); geo.translate(0,0,0); return geo; }
                if (type === 5) { const geo = new THREE.TorusGeometry(0.5, 0.15, 5, 10, Math.PI/2); geo.translate(-0.5, -0.5, 0); return geo; }
                return null;
            }
        };
    }
}
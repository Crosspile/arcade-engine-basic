import { interval, filter } from 'rxjs';
import { GameModel } from './GameModel';
import type { GameItem, InputAction, SoundEmitter } from '../engine/types';

const UP = { x: 0, y: 1 };
const DOWN = { x: 0, y: -1 };
const LEFT = { x: -1, y: 0 };
const RIGHT = { x: 1, y: 0 };

type Dir = typeof UP;

interface Entity {
    id: string;
    x: number;
    y: number;
    dir: Dir;
    nextDir: Dir;
    color: number;
    type: 'PACMAN' | 'BLINKY' | 'PINKY' | 'INKY' | 'CLYDE';
    spawn: { x: number, y: number };
    isDead?: boolean;
}

export default class Pacman extends GameModel {
    // 19x22 Grid
    grid: number[][] = [];
    
    pacman: Entity = { id: 'pacman', x: 1, y: 1, dir: RIGHT, nextDir: RIGHT, color: 0xffff00, type: 'PACMAN', spawn: {x:1, y:1} };
    ghosts: Entity[] = [];
    
    lives = 3;
    
    // Game States
    mode: 'CHASE' | 'SCATTER' | 'FRIGHTENED' = 'SCATTER';
    modeTimer = 0;
    frightenedTimer = 0;
    combo = 0;

    // Map definition
    // W: Wall, .: Pellet, o: Power, -: Empty, P: Pacman, R: Blinky, S: Pinky, I: Inky, C: Clyde, G: Gate
    rawMap = [
        "WWWWWWWWWWWWWWWWWWW",
        "W........W........W",
        "W.WW.WWW.W.WWW.WW.W",
        "WoWW.WWW.W.WWW.WWoW",
        "W.................W",
        "WW.W.WWWWWWWWW.W.WW",
        "WW.W.....W.....W.WW",
        "WW.WWWWW.W.WWWWW.WW",
        "WW....... .......WW",
        "WWWWWW.W-G-W.WWWWWW",
        ".......W-R-W.......",
        "WWWWWW.W-S-W.WWWWWW",
        "WW.....W-I-W.....WW",
        "WW.W.WWWW-WWWW.W.WW",
        "WW.W.....C.....W.WW",
        "WW.W.WWW.W.WWW.W.WW",
        "W......W.W.W......W",
        "W.WWWW.W.W.W.WWWW.W",
        "W.W......P......W.W",
        "WoW.WWWWWWWWWWW.WoW",
        "W.................W",
        "WWWWWWWWWWWWWWWWWWW"
    ];

    constructor(audio?: SoundEmitter) {
        super(19, 22, 'pacman', audio);
    }

    start() {
        this.lives = 3;
        this.score = 0;
        this.level = 1;
        this.startLevel();
    }

    startLevel() {
        if (this.level === 1) {
            this.parseMap();
        } else {
            this.generateLevel();
        }
        this.resetPositions();
        this.status$.next('READY!');
        this.emit();
        
        this.stop();
        
        // Game Loop: Tick every 200ms
        this.sub.add(interval(200).pipe(filter(() => !this.isPaused && !this.isGameOver)).subscribe(() => {
            this.tick();
        }));
    }

    parseMap() {
        const h = this.rawMap.length;
        const w = this.rawMap[0].length;
        this.resize(w, h);
        
        this.grid = [];
        this.ghosts = [];
        
        for(let x=0; x<w; x++) {
            this.grid[x] = [];
            for(let y=0; y<h; y++) {
                const char = this.rawMap[y][x];
                const ly = h - 1 - y; // Invert Y for rendering
                
                let val = 0;
                if (char === 'W') val = 1;
                else if (char === '.') val = 2;
                else if (char === 'o') val = 3;
                else if (char === 'G') val = 4;
                
                this.grid[x][ly] = val;

                if (char === 'P') { this.pacman.spawn = {x, y: ly}; }
                if (char === 'R') this.addGhost('BLINKY', x, ly, 0xff0000);
                if (char === 'S') this.addGhost('PINKY', x, ly, 0xffb8ff);
                if (char === 'I') this.addGhost('INKY', x, ly, 0x00ffff);
                if (char === 'C') this.addGhost('CLYDE', x, ly, 0xffb852);
            }
        }
    }

    generateLevel() {
        const w = 19;
        const h = 22;
        this.resize(w, h);
        // Fill with walls
        this.grid = Array(w).fill(0).map(() => Array(h).fill(1));
        this.ghosts = [];

        // 1. Maze Generation (Recursive Backtracker on left half 1..8)
        const visited = new Set<string>();
        const stack: {x: number, y: number}[] = [];
        const start = {x: 1, y: 1};
        
        this.grid[start.x][start.y] = 0;
        stack.push(start);
        visited.add(`${start.x},${start.y}`);

        while(stack.length > 0) {
            const current = stack[stack.length - 1];
            const neighbors = [];
            // Step 2 to preserve walls
            const dirs = [[0,2], [0,-2], [2,0], [-2,0]];
            
            for(const d of dirs) {
                const nx = current.x + d[0];
                const ny = current.y + d[1];
                
                // Bounds: x in [1, 8], y in [1, h-2]
                if (nx >= 1 && nx <= 8 && ny >= 1 && ny < h-1) {
                    // Avoid Ghost House area (x=7,8 near y=9..13) to prevent overwriting walls later
                    // The house is at x=8..10, y=10..12. We need walls at x=7 and y=9,13.
                    if (nx >= 7 && ny >= 9 && ny <= 13) {
                        // Skip
                    } else if (!visited.has(`${nx},${ny}`)) {
                        neighbors.push({nx, ny, dx: d[0]/2, dy: d[1]/2});
                    }
                }
            }

            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];
                
                // Carve path
                this.grid[next.nx][next.ny] = 0;
                this.grid[current.x + next.dx][current.y + next.dy] = 0;
                
                visited.add(`${next.nx},${next.ny}`);
                stack.push({x: next.nx, y: next.ny});
            } else {
                stack.pop();
            }
        }

        // 2. Mirror to right half
        for(let x=0; x<=8; x++) {
            for(let y=0; y<h; y++) {
                this.grid[w-1-x][y] = this.grid[x][y];
            }
        }

        // 3. Connect Center (Column 9)
        for(let y=1; y<h-1; y++) {
            // If left neighbor is open, chance to open center
            if (this.grid[8][y] === 0 && Math.random() > 0.3) {
                this.grid[9][y] = 0;
            }
        }
        // Ensure at least a few connections
        this.grid[9][3] = 0; 
        this.grid[9][h-4] = 0;

        // 4. Stamp Ghost House (Center)
        const houseY = 10;
        
        // Build Walls around house
        for(let x=7; x<=11; x++) { this.grid[x][houseY-1] = 1; this.grid[x][houseY+3] = 1; }
        for(let y=houseY-1; y<=houseY+3; y++) { this.grid[7][y] = 1; this.grid[11][y] = 1; }
        
        // Clear interior
        for(let x=8; x<=10; x++) for(let y=houseY; y<=houseY+2; y++) this.grid[x][y] = 0;
        
        this.grid[9][houseY+2] = 4; // Gate
        
        // Ensure Exit path above gate
        this.grid[9][houseY+3] = 0;
        this.grid[9][houseY+4] = 0;
        
        // 5. Reduce Wall Density (Randomly remove internal walls)
        for(let x=2; x<9; x++) for(let y=2; y<h-2; y++) {
            if (this.grid[x][y] === 1) {
                // Don't break the ghost house walls (approx check)
                if (x >= 7 && x <= 11 && y >= 9 && y <= 13) continue;
                
                // 20% chance to open any wall to reduce density
                if (Math.random() < 0.2) {
                    this.grid[x][y] = 0;
                    this.grid[w-1-x][y] = 0;
                }
            }
        }

        // 6. Power Pellets (Place BEFORE connectivity check to ensure they are reachable)
        [[1,1], [w-2,1], [1,h-2], [w-2,h-2]].forEach(([px, py]) => {
            this.grid[px][py] = 3;
            // Ensure neighbors are open so they aren't isolated
            if(px < w/2) this.grid[px+1][py] = 0; else this.grid[px-1][py] = 0;
            if(py < h/2) this.grid[px][py+1] = 0; else this.grid[px][py-1] = 0;
        });

        // 7. Validate Connectivity (Fix trapped edibles/ghosts)
        this.ensureConnectivity();

        // 7.5. Place Power Pellets at all Dead Ends
        for(let x=1; x<w-1; x++) {
            for(let y=1; y<h-1; y++) {
                // Skip Ghost House interior
                if (x >= 8 && x <= 10 && y >= 10 && y <= 12) continue;

                if (this.grid[x][y] === 0) {
                    let openNeighbors = 0;
                    // Check 4 directions. 1 is wall, 4 is gate (treat as wall for player)
                    if (this.grid[x+1][y] !== 1 && this.grid[x+1][y] !== 4) openNeighbors++;
                    if (this.grid[x-1][y] !== 1 && this.grid[x-1][y] !== 4) openNeighbors++;
                    if (this.grid[x][y+1] !== 1 && this.grid[x][y+1] !== 4) openNeighbors++;
                    if (this.grid[x][y-1] !== 1 && this.grid[x][y-1] !== 4) openNeighbors++;

                    if (openNeighbors === 1) {
                        this.grid[x][y] = 3;
                    }
                }
            }
        }

        // 8. Populate Items
        for(let x=0; x<w; x++) for(let y=0; y<h; y++) {
            if (this.grid[x][y] === 0) {
                if (!(x >= 8 && x <= 10 && y >= houseY && y <= houseY+2)) {
                    this.grid[x][y] = 2; // Pellet
                }
            }
        }

        // 9. Set Spawns
        this.pacman.spawn = {x: 9, y: 4};
        
        // Ensure player spawn is not trapped by clearing a safe zone
        this.grid[9][4] = 0; 
        this.grid[9][3] = 0; this.grid[9][5] = 0; // Vertical clearance
        this.grid[8][4] = 0; this.grid[10][4] = 0; // Horizontal clearance
        
        // Drill Left from (8,4) until we hit a path to ensure connectivity
        let drillX = 8;
        while (drillX > 1) {
            drillX--;
            if (this.grid[drillX][4] === 0) break; // Found a connection
            this.grid[drillX][4] = 0; // Carve
            this.grid[w-1-drillX][4] = 0; // Mirror Carve
        }
        // If we reached x=1 and it was a wall, we carved it. Ensure x=1 connects to (1,1)
        if (drillX === 1) {
             for(let y=4; y>=1; y--) {
                 this.grid[1][y] = 0; this.grid[w-2][y] = 0;
             }
        }
        
        this.addGhost('BLINKY', 9, houseY+3, 0xff0000); // Outside
        this.addGhost('PINKY', 9, houseY+1, 0xffb8ff);  // Inside
        this.addGhost('INKY', 8, houseY+1, 0x00ffff);   // Inside
        this.addGhost('CLYDE', 10, houseY+1, 0xffb852); // Inside
    }

    debugAction() {
        this.status$.next('WIN CHEAT');
        this.level++;
        this.startLevel();
    }

    ensureConnectivity() {
        const start = {x: 9, y: 4}; // Pacman Spawn
        const ghostExit = {x: 9, y: 13}; // Just outside gate
        
        // Helper for BFS to find all reachable cells for Pacman
        const getReachable = () => {
            const reachable = new Set<string>();
            const queue = [start];
            reachable.add(`${start.x},${start.y}`);
            
            while(queue.length) {
                const {x, y} = queue.shift()!;
                [[0,1],[0,-1],[1,0],[-1,0]].forEach(d => {
                    const nx = x+d[0], ny = y+d[1];
                    if(nx>=0 && nx<this.width && ny>=0 && ny<this.height) {
                        const val = this.grid[nx][ny];
                        // Pacman treats 0 as walkable. 1 is wall. 4 is gate (blocked).
                        if (val !== 1 && val !== 4 && !reachable.has(`${nx},${ny}`)) {
                            reachable.add(`${nx},${ny}`);
                            queue.push({x: nx, y: ny});
                        }
                    }
                });
            }
            return reachable;
        };

        let reachable = getReachable();

        // 1. Check if Ghost Exit is reachable. If not, force a path.
        if (!reachable.has(`${ghostExit.x},${ghostExit.y}`)) {
            // Connect via left side of house (Column 6) to avoid drilling through the Ghost House/Gate
            for(let y=4; y<=13; y++) this.grid[6][y] = 0; 
            for(let x=6; x<=9; x++) this.grid[x][13] = 0; // Connect top
            for(let x=6; x<=9; x++) this.grid[x][4] = 0;  // Connect bottom
            
            // Mirror to right side
            for(let y=4; y<=13; y++) this.grid[this.width-1-6][y] = 0;
            for(let x=6; x<=9; x++) this.grid[this.width-1-x][13] = 0;
            for(let x=6; x<=9; x++) this.grid[this.width-1-x][4] = 0;

            reachable = getReachable(); // Re-calculate
        }

        // 2. Remove unreachable pockets (Trapped Edibles fix)
        for(let x=0; x<this.width; x++) {
            for(let y=0; y<this.height; y++) {
                // If it's empty (0) or Power Pellet (3) but not reachable
                if ((this.grid[x][y] === 0 || this.grid[x][y] === 3) && !reachable.has(`${x},${y}`)) {
                    // Exception: Ghost House Interior (x=8..10, y=10..12) is intentionally blocked by gate
                    const isGhostHouse = (x >= 8 && x <= 10 && y >= 10 && y <= 12);
                    if (!isGhostHouse) {
                        this.grid[x][y] = 1; // Fill with wall
                    }
                }
            }
        }
    }

    addGhost(type: any, x: number, y: number, color: number) {
        this.ghosts.push({
            id: type, type, x, y, dir: UP, nextDir: UP, color, spawn: {x, y}, isDead: false
        });
    }

    resetPositions() {
        this.pacman.x = this.pacman.spawn.x;
        this.pacman.y = this.pacman.spawn.y;
        this.pacman.dir = RIGHT;
        this.pacman.nextDir = RIGHT;

        this.ghosts.forEach(g => {
            g.x = g.spawn.x;
            g.y = g.spawn.y;
            g.dir = UP;
            g.isDead = false;
        });
        
        this.mode = 'SCATTER';
        this.modeTimer = 0;
        this.frightenedTimer = 0;
    }

    handleInput(action: InputAction) {
        if (this.isGameOver) return;
        if (action.type === 'UP') this.pacman.nextDir = UP;
        if (action.type === 'DOWN') this.pacman.nextDir = DOWN;
        if (action.type === 'LEFT') this.pacman.nextDir = LEFT;
        if (action.type === 'RIGHT') this.pacman.nextDir = RIGHT;
    }

    tick() {
        this.updateMode();
        this.movePacman();
        this.checkCollisions();
        if (this.isGameOver) return;
        this.moveGhosts();
        this.checkCollisions();
        this.emit();
    }

    updateMode() {
        if (this.mode === 'FRIGHTENED') {
            this.frightenedTimer--;
            if (this.frightenedTimer <= 0) {
                this.mode = 'CHASE';
                this.combo = 0;
            }
        } else {
            this.modeTimer++;
            const cycle = (this.modeTimer / 5) % 27;
            if (cycle < 7) this.mode = 'SCATTER';
            else this.mode = 'CHASE';
        }
    }

    movePacman() {
        if (this.canMove(this.pacman.x, this.pacman.y, this.pacman.nextDir)) {
            this.pacman.dir = this.pacman.nextDir;
        }
        
        if (this.canMove(this.pacman.x, this.pacman.y, this.pacman.dir)) {
            this.pacman.x += this.pacman.dir.x;
            this.pacman.y += this.pacman.dir.y;
            
            if (this.pacman.x < 0) this.pacman.x = this.width - 1;
            if (this.pacman.x >= this.width) this.pacman.x = 0;
            
            const cell = this.grid[this.pacman.x][this.pacman.y];
            if (cell === 2) {
                this.grid[this.pacman.x][this.pacman.y] = 0;
                this.updateScore(10);
                this.audio.playTone(400, 'sine', 0.05);
                this.checkWin();
            } else if (cell === 3) {
                this.grid[this.pacman.x][this.pacman.y] = 0;
                this.updateScore(50);
                this.mode = 'FRIGHTENED';
                this.frightenedTimer = 40;
                this.combo = 1;
                this.audio.playMatch();
                this.ghosts.forEach(g => g.dir = { x: -g.dir.x, y: -g.dir.y });
                this.checkWin();
            }
        }
    }

    moveGhosts() {
        this.ghosts.forEach(g => {
            if (g.isDead) {
                if (Math.random() < 0.1) {
                    g.x = g.spawn.x;
                    g.y = g.spawn.y;
                    g.isDead = false;
                }
                return;
            }

            const opts = [UP, DOWN, LEFT, RIGHT].filter(d => {
                if (d.x === -g.dir.x && d.y === -g.dir.y) return false;
                return this.canMove(g.x, g.y, d, true);
            });
            
            if (opts.length === 0) {
                g.dir = { x: -g.dir.x, y: -g.dir.y };
            } else {
                let target = { x: this.pacman.x, y: this.pacman.y };
                
                if (this.mode === 'FRIGHTENED') {
                    g.dir = opts[Math.floor(Math.random() * opts.length)];
                } else {
                    if (this.mode === 'SCATTER') {
                        if (g.type === 'BLINKY') target = { x: this.width-2, y: this.height-2 };
                        if (g.type === 'PINKY') target = { x: 1, y: this.height-2 };
                        if (g.type === 'INKY') target = { x: this.width-2, y: 1 };
                        if (g.type === 'CLYDE') target = { x: 1, y: 1 };
                    } else {
                        if (g.type === 'PINKY') { 
                            target = { x: this.pacman.x + this.pacman.dir.x*4, y: this.pacman.y + this.pacman.dir.y*4 };
                        }
                    }
                    
                    opts.sort((a, b) => {
                        const ax = g.x + a.x, ay = g.y + a.y;
                        const bx = g.x + b.x, by = g.y + b.y;
                        return (Math.abs(ax - target.x) + Math.abs(ay - target.y)) - (Math.abs(bx - target.x) + Math.abs(by - target.y));
                    });
                    
                    g.dir = opts[0];
                }
            }
            
            g.x += g.dir.x;
            g.y += g.dir.y;
            
            if (g.x < 0) g.x = this.width - 1;
            if (g.x >= this.width) g.x = 0;
        });
    }

    canMove(x: number, y: number, dir: Dir, isGhost = false) {
        const nx = x + dir.x;
        const ny = y + dir.y;
        
        if (nx < 0 || nx >= this.width) return true;
        if (ny < 0 || ny >= this.height) return false;
        
        const cell = this.grid[nx][ny];
        if (cell === 1) return false;
        if (cell === 4 && !isGhost) return false;
        
        return true;
    }

    checkCollisions() {
        this.ghosts.forEach(g => {
            if (!g.isDead && g.x === this.pacman.x && g.y === this.pacman.y) {
                if (this.mode === 'FRIGHTENED') {
                    g.isDead = true;
                    this.updateScore(200 * this.combo);
                    this.combo *= 2;
                    this.audio.playSelect();
                    this.effects$.next({ type: 'PARTICLE', x: g.x, y: g.y, color: g.color, style: 'EXPLODE' });
                } else {
                    // this.handleDeath();
                }
            }
        });
    }

    handleDeath() {
        this.lives--;
        this.audio.playExplosion();
        this.effects$.next({ type: 'EXPLODE', x: this.pacman.x, y: this.pacman.y, color: 0xffff00, style: 'EXPLODE' });
        
        if (this.lives <= 0) {
            this.isGameOver = true;
            this.status$.next('GAME OVER');
            this.audio.playGameOver();
            setTimeout(() => this.effects$.next({ type: 'GAMEOVER' }), 2000);
        } else {
            this.status$.next(`Lives: ${this.lives}`);
            this.resetPositions();
        }
    }

    checkWin() {
        let hasPellets = false;
        for(let x=0; x<this.width; x++) for(let y=0; y<this.height; y++) {
            if (this.grid[x][y] === 2 || this.grid[x][y] === 3) {
                hasPellets = true;
                break;
            }
        }
        
        if (!hasPellets) {
            this.status$.next('CLEARED!');
            this.audio.playMatch();
            setTimeout(() => {
                this.level++;
                this.startLevel();
            }, 2000);
        }
    }

    emit() {
        const items: GameItem[] = [];
        
        for(let x=0; x<this.width; x++) for(let y=0; y<this.height; y++) {
            const c = this.grid[x][y];
            if (c === 1) items.push({ id: `w_${x}_${y}`, x, y, type: 1 });
            if (c === 2) items.push({ id: `p_${x}_${y}`, x, y, type: 2, scale: 0.3 });
            if (c === 3) items.push({ id: `o_${x}_${y}`, x, y, type: 3, scale: 0.6 });
            if (c === 4) items.push({ id: `g_${x}_${y}`, x, y, type: 4, scale: 0.2 });
        }
        
        items.push({ id: 'pacman', x: this.pacman.x, y: this.pacman.y, type: 10 });
        
        this.ghosts.forEach(g => {
            if (!g.isDead) {
                items.push({ 
                    id: g.id, x: g.x, y: g.y, 
                    type: this.mode === 'FRIGHTENED' ? 20 : (g.type === 'BLINKY' ? 11 : g.type === 'PINKY' ? 12 : g.type === 'INKY' ? 13 : 14)
                });
            }
        });
        
        this.state$.next(items);
    }

    getRenderConfig() {
        return {
            geometry: {
                1: 'Box', 2: 'Sphere', 3: 'Sphere', 4: 'Box',
                10: 'Sphere', 11: 'Cylinder', 12: 'Cylinder', 13: 'Cylinder', 14: 'Cylinder', 20: 'Cylinder',
            },
            colors: {
                1: 0x1919A6, 2: 0xffb8ae, 3: 0xffb8ae, 4: 0xffaaaa,
                10: 0xffff00, 11: 0xff0000, 12: 0xffb8ff, 13: 0x00ffff, 14: 0xffb852, 20: 0x0000ff,
            },
            bgColor: 0x000000
        };
    }
}
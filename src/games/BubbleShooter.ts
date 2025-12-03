import { GameModel } from './GameModel';
import { GameItem, InputAction, SoundEmitter } from '../types';

const BUBBLE_DIAMETER = 1.0;
const Y_SPACING = Math.sqrt(3) / 2; // ~0.866 for hex grid

export class BubbleShooterGame extends GameModel {
    colors = [0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93, 0x560bad];
    grid: (GameItem | null)[][] = [];
    
    cannonBubble: GameItem | null = null;
    nextBubble: GameItem | null = null;
    
    aimerItems: GameItem[] = [];
    aimerAngle = 90; // degrees, 90 is straight up
    
    isShooting = false;
    shotsUntilNextRow = 5;

    constructor(audio?: SoundEmitter) {
        super(9, 15, 'bubble', audio); // 9 columns, 15 rows for vertical gap
    }

    start() {
        this.isGameOver = false;
        this.isShooting = false;
        this.shotsUntilNextRow = 5;
        this.score = 0;
        this.score$.next(0);
        this.grid = Array(this.width).fill(null).map(() => Array(this.height).fill(null));

        // Spawn bubbles at the ceiling (top rows)
        const startRow = this.height - 1;
        const endRow = this.height - 6; 
        for (let y = startRow; y >= endRow; y--) {
            for (let x = 0; x < this.width; x++) {
                if (Math.random() > 0.2) {
                     this.grid[x][y] = this.createBubble(x, y);
                }
            }
        }
        
        this.loadCannon();
        this.updateAimer();
        this.emit();
        this.status$.next('Aim and Shoot!');
    }
    
    createBubble(x: number, y: number, type?: number): GameItem {
        const bubbleType = type !== undefined ? type : Math.floor(Math.random() * this.colors.length);
        return {
            id: this.uid(),
            type: bubbleType,
            x,
            y,
            spawnStyle: 'pop'
        };
    }
    
    loadCannon() {
        this.cannonBubble = this.nextBubble || this.createBubble(0,0);
        this.cannonBubble.x = Math.floor(this.width / 2);
        this.cannonBubble.y = -1; // Position cannon at the bottom

        const existingColors = new Set<number>();
        this.grid.flat().forEach(b => { if (b) existingColors.add(b.type); });
        
        const colors = existingColors.size > 0 ? Array.from(existingColors) : this.colors.map((_, i) => i);
        const nextType = colors[Math.floor(Math.random() * colors.length)];
        this.nextBubble = this.createBubble(0,0, nextType);
        this.nextBubble.x = this.width - 2; 
        this.nextBubble.y = -1;
    }

    handleInput(action: InputAction) {
        if (this.isShooting || this.isGameOver) return;

        if (action.type === 'LEFT') {
            this.aimerAngle = Math.min(160, this.aimerAngle + 5);
            this.updateAimer();
            this.emit();
        }
        if (action.type === 'RIGHT') {
            this.aimerAngle = Math.max(20, this.aimerAngle - 5);
            this.updateAimer();
            this.emit();
        }
        if (action.type === 'SELECT') {
            this.fire();
        }
    }
    
    updateAimer() {
        this.aimerItems = [];
        const rad = this.aimerAngle * Math.PI / 180;
        const dx = Math.cos(rad);
        const dy = Math.sin(rad);
        const startX = this.width / 2 - 0.5;
        const startY = -0.5;

        for (let i = 1; i <= 15; i++) {
            this.aimerItems.push({
                id: `aim_${i}`,
                type: 10, // aimer color type
                x: startX + dx * i * 0.8,
                y: startY + dy * i * 0.8,
            });
        }
    }
    
    getHexNeighbors(x: number, y: number): {x: number, y: number}[] {
        const isOddRow = y % 2 !== 0;
        const neighbors: {x: number, y: number}[] = [];
        
        const directions = [
            [1, 0], [-1, 0], [0, 1], [0, -1], // Horizontal and vertical
            ...(isOddRow ? [[1, 1], [1, -1]] : [[-1, 1], [-1, -1]]) // Diagonals
        ];
        
        for (const [dx, dy] of directions) {
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height) {
                neighbors.push({x: nx, y: ny});
            }
        }
        return neighbors;
    }

    async fire() {
        if (!this.cannonBubble) return;
        this.isShooting = true;
        this.audio.playMove();

        const rad = this.aimerAngle * Math.PI / 180;
        const speed = 0.8;
        let vx = Math.cos(rad) * speed;
        let vy = Math.sin(rad) * speed;

        let shot = {
            id: this.cannonBubble.id,
            type: this.cannonBubble.type,
            x: this.width / 2 - 0.5,
            y: -1,
        };

        let finalPos: {x: number, y: number} | null = null;
        
        while(finalPos === null) {
            shot.x += vx;
            shot.y += vy;

            // Wall bounce
            if (shot.x < 0 || shot.x > this.width - 1) {
                vx *= -1;
                shot.x += vx;
            }

            // Hit ceiling (top of grid)
            if (shot.y / Y_SPACING >= this.height - 1) {
                const gridY = this.height - 1;
                const isOdd = gridY % 2 !== 0;
                const gridX = Math.round(isOdd ? shot.x - 0.5 : shot.x);
                finalPos = { x: gridX, y: this.height - 1};
                if (finalPos.x < 0) finalPos.x = 0;
                if (finalPos.x >= this.width) finalPos.x = this.width - 1;
                break;
            }

            // Hit other bubbles
            for (let y = this.height - 1; y >= 0; y--) {
                for (let x = 0; x < this.width; x++) {
                    const bubble = this.grid[x][y];
                    if (bubble) {
                        const bubbleVisualX = y % 2 !== 0 ? x + 0.5 : x;
                        const bubbleVisualY = y * Y_SPACING;
                        const dist = Math.sqrt(Math.pow(shot.x - bubbleVisualX, 2) + Math.pow(shot.y - bubbleVisualY, 2));
                        
                        if (dist < BUBBLE_DIAMETER) {
                            const neighbors = this.getHexNeighbors(bubble.x, bubble.y);
                            const emptyNeighbors = neighbors.filter(n => !this.grid[n.x][n.y]);

                            let bestPos: {x: number, y: number} | null = null;
                            let minDist = Infinity;

                            for (const n of emptyNeighbors) {
                                const nVisX = n.y % 2 !== 0 ? n.x + 0.5 : n.x;
                                const nVisY = n.y * Y_SPACING;
                                const d = Math.sqrt(Math.pow(shot.x - nVisX, 2) + Math.pow(shot.y - nVisY, 2));
                                if (d < minDist) {
                                    minDist = d;
                                    bestPos = n;
                                }
                            }
                            finalPos = bestPos;
                            // Fallback if no empty neighbor
                            if (!finalPos) {
                                const gridY = Math.round(shot.y / Y_SPACING);
                                const isOdd = gridY % 2 !== 0;
                                const gridX = Math.round(isOdd ? shot.x - 0.5 : shot.x);
                                finalPos = { x: gridX, y: gridY };
                            }
                            break;
                        }
                    }
                }
                if(finalPos) break;
            }
        }
        
        if (finalPos.x < 0) finalPos.x = 0;
        if (finalPos.x >= this.width) finalPos.x = this.width - 1;
        if (finalPos.y < 0) finalPos.y = 0;
        if (finalPos.y >= this.height) finalPos.y = this.height - 1;

        if (this.grid[finalPos.x][finalPos.y]) {
            // Find a nearby empty spot if the chosen one is filled (can happen with fallback)
            const q = [finalPos];
            const visited = new Set([`${finalPos.x},${finalPos.y}`]);
            let found = false;
            while(q.length > 0) {
                const curr = q.shift()!;
                if (!this.grid[curr.x][curr.y]) {
                    finalPos = curr;
                    found = true;
                    break;
                }
                this.getHexNeighbors(curr.x, curr.y).forEach(n => {
                    const key = `${n.x},${n.y}`;
                    if(!visited.has(key)) {
                        visited.add(key);
                        q.push(n);
                    }
                });
            }
        }

        const landingBubble = this.createBubble(finalPos.x, finalPos.y, shot.type);
        landingBubble.id = this.cannonBubble.id;
        
        const visualX = finalPos.y % 2 !== 0 ? finalPos.x + 0.5 : finalPos.x;
        const visualY = finalPos.y * Y_SPACING;
        this.cannonBubble.x = visualX;
        this.cannonBubble.y = visualY;
        this.aimerItems = [];
        this.emit();
        
        await new Promise(r => setTimeout(r, 100));

        if (finalPos.y >= 0 && finalPos.y < this.height) {
            this.grid[finalPos.x][finalPos.y] = landingBubble;
        }
        
        this.audio.playSelect();
        
        await this.checkMatches(finalPos.x, finalPos.y);
        
        this.shotsUntilNextRow--;
        if (this.shotsUntilNextRow <= 0) {
            await this.addNewRow();
        }
        
        if (this.isGameOver) return;
        
        this.loadCannon();
        this.updateAimer();
        this.isShooting = false;
        this.emit();
    }

    async checkMatches(startX: number, startY: number) {
        const startBubble = this.grid[startX]?.[startY];
        if (!startBubble) return;
        
        const toRemove = new Set<GameItem>();
        const q = [startBubble];
        const visited = new Set<string>([startBubble.id]);
        toRemove.add(startBubble);

        while(q.length > 0) {
            const current = q.shift()!;
            const neighbors = this.getHexNeighbors(current.x, current.y);
            for (const n of neighbors) {
                const neighbor = this.grid[n.x]?.[n.y];
                if (neighbor && neighbor.type === startBubble.type && !visited.has(neighbor.id)) {
                    visited.add(neighbor.id);
                    toRemove.add(neighbor);
                    q.push(neighbor);
                }
            }
        }
        
        if (toRemove.size >= 3) {
            this.updateScore(toRemove.size * 10 * toRemove.size);
            this.audio.playMatch();
            toRemove.forEach(b => {
                this.grid[b.x][b.y] = null;
                this.effects$.next({ type: 'EXPLODE', x: b.x, y: b.y * Y_SPACING, color: this.colors[b.type], style: 'PUFF'});
            });
            
            this.emit();
            await new Promise(r => setTimeout(r, 200));

            await this.handleDrops();
        }
    }
    
    async handleDrops() {
        const connectedToCeiling = new Set<string>();
        const q: GameItem[] = [];

        // Find all bubbles connected to the top row (Ceiling is height-1)
        for(let x=0; x<this.width; x++) {
            if (this.grid[x][this.height-1]) {
                q.push(this.grid[x][this.height-1]!);
                connectedToCeiling.add(this.grid[x][this.height-1]!.id);
            }
        }
        
        while(q.length > 0) {
            const current = q.shift()!;
            const neighbors = this.getHexNeighbors(current.x, current.y);
            for (const n of neighbors) {
                const neighbor = this.grid[n.x]?.[n.y];
                if (neighbor && !connectedToCeiling.has(neighbor.id)) {
                    connectedToCeiling.add(neighbor.id);
                    q.push(neighbor);
                }
            }
        }

        let dropped = false;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const bubble = this.grid[x][y];
                if (bubble && !connectedToCeiling.has(bubble.id)) {
                    this.grid[x][y] = null;
                    dropped = true;
                    this.updateScore(100);
                     this.effects$.next({ type: 'EXPLODE', x: bubble.x, y: bubble.y * Y_SPACING, color: this.colors[bubble.type], style: 'CONFETTI'});
                }
            }
        }
        
        if (dropped) {
            this.emit();
            await new Promise(r => setTimeout(r, 200));
        }
    }
    
    async addNewRow() {
        this.shotsUntilNextRow = 5;
        
        // Check for Game Over at bottom row (y=0)
        for(let x=0; x<this.width; x++){
            if(this.grid[x][0]){
                this.gameOver();
                return;
            }
        }

        // Shift everything DOWN (y+1 -> y)
        for (let y = 0; y < this.height - 1; y++) {
            for (let x = 0; x < this.width; x++) {
                const bubble = this.grid[x][y+1];
                this.grid[x][y] = bubble;
                if (bubble) bubble.y = y;
            }
        }
        
        // Add new top row at height-1
        for(let x=0; x<this.width; x++) {
            this.grid[x][this.height-1] = null;
            if (Math.random() > 0.2) {
                 this.grid[x][this.height-1] = this.createBubble(x, this.height-1);
            }
        }

        this.emit();
        await new Promise(r => setTimeout(r, 200));
    }
    
    gameOver() {
        if(this.isGameOver) return;
        this.isGameOver = true;
        this.status$.next('GAME OVER');
        this.audio.playGameOver();
        this.effects$.next({type: 'GAMEOVER'});
    }

    emit() {
        const items: GameItem[] = [];
        this.grid.flat().forEach(b => { 
            if(b) {
                const visualX = b.y % 2 !== 0 ? b.x + 0.5 : b.x;
                const visualY = b.y * Y_SPACING;
                items.push({...b, x: visualX, y: visualY});
            }
        });
        
        if (this.cannonBubble && !this.isShooting) {
            items.push(this.cannonBubble);
        } else if (this.isShooting) {
            const shotBubble = this.state$.value.find(item => item.id === this.cannonBubble?.id);
            if (shotBubble) items.push(shotBubble);
        }

        if (this.nextBubble) items.push(this.nextBubble);
        items.push(...this.aimerItems);

        this.state$.next(items);
    }

    getRenderConfig() {
        const configColors = this.colors.reduce((acc, color, i) => {
            acc[i] = color;
            return acc;
        }, {} as Record<number, number>);
        configColors[10] = 0xcccccc; // aimer color

        return { 
            geometry: 'cylinder' as const, 
            colors: configColors,
            bgColor: 0x1d2d50
        };
    }
}

import { GameModel } from './GameModel';
import { GameItem, InputAction, SoundEmitter } from '../types';

export class MazeRun extends GameModel {
    grid: number[][] = [];
    player = { x: 1, y: 1 };
    exit = { x: 13, y: 13 };
    isProcessingWin = false;

    constructor(audio?: SoundEmitter) { super(15, 15, 'mazerun', audio); }

    start() {
        this.level = 1;
        this.startLevel();
    }
    
    startLevel() {
        this.isProcessingWin = false;
        // Grow size. Always odd.
        const s = Math.min(25, 9 + (this.level * 2));
        this.resize(s, s);

        this.generateLevel();
        this.status$.next(`Level ${this.level}`);
    }

    generateLevel() {
        this.grid = Array(this.width).fill(null).map(() => Array(this.height).fill(1)); // 1=Wall
        const stack = [{x: 1, y: 1}];
        this.grid[1][1] = 0;
        
        while(stack.length) {
            const current = stack[stack.length-1];
            const neighbors = [];
            [[0,2],[0,-2],[2,0],[-2,0]].forEach(d => {
                const nx = current.x+d[0], ny = current.y+d[1];
                if(nx>0 && nx<this.width-1 && ny>0 && ny<this.height-1 && this.grid[nx][ny] === 1) {
                    neighbors.push({x:nx, y:ny, dx:d[0]/2, dy:d[1]/2});
                }
            });

            if(neighbors.length) {
                const next = neighbors[Math.floor(Math.random()*neighbors.length)];
                this.grid[next.x][next.y] = 0;
                this.grid[current.x + next.dx][current.y + next.dy] = 0;
                stack.push({x:next.x, y:next.y});
            } else {
                stack.pop();
            }
        }
        
        this.player = { x: 1, y: 1 };
        this.exit = { x: this.width-2, y: this.height-2 };
        this.grid[this.width-2][this.height-2] = 0; 
        
        this.emit();
    }

    handleInput(action: InputAction) {
        if (this.isGameOver || this.isProcessingWin) return;
        
        let dx = 0, dy = 0;
        if (action.type === 'UP') dy = 1;
        if (action.type === 'DOWN') dy = -1;
        if (action.type === 'LEFT') dx = -1;
        if (action.type === 'RIGHT') dx = 1;
        
        const nx = this.player.x + dx;
        const ny = this.player.y + dy;
        
        if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && this.grid[nx][ny] === 0) {
            this.player.x = nx;
            this.player.y = ny;
            this.effects$.next({ type: 'AUDIO', name: 'MOVE' });
            this.emit();
            
            if (nx === this.exit.x && ny === this.exit.y) {
                this.handleWin();
            }
        }
    }

    handleWin() {
        this.isProcessingWin = true;
        this.status$.next('LEVEL CLEARED!');
        this.updateScore(500 + (this.level * 100));
        this.effects$.next({ type: 'AUDIO', name: 'MATCH' });
        this.effects$.next({ type: 'PARTICLE', x: this.exit.x, y: this.exit.y, color: 0x00ff00, style: 'CONFETTI' });
        
        setTimeout(() => {
            this.level++;
            this.startLevel();
        }, 1500);
    }

    emit() {
        const items: GameItem[] = [];
        for(let x=0; x<this.width; x++) for(let y=0; y<this.height; y++) {
            if(this.grid[x][y] === 0) items.push({ id: `floor_${x}_${y}`, x, y, type: 0 }); 
            else items.push({ id: `wall_${x}_${y}`, x, y, type: 1 });
        }
        items.push({ id: 'player', x: this.player.x, y: this.player.y, type: 2 });
        items.push({ id: 'exit', x: this.exit.x, y: this.exit.y, type: 3 });
        this.state$.next(items);
    }

    getRenderConfig() {
        return { 
            geometry: 'box' as const, 
            colors: { 0: 0x222222, 1: 0x555555, 2: 0x00ffff, 3: 0x00ff00 }, 
            bgColor: 0x111111 
        };
    }
}

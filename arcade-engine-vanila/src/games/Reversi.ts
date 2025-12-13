import * as THREE from 'three';
import { GameModel } from './GameModel';
import type { GameItem, InputAction, SoundEmitter } from '../engine/types';

const EMPTY = 0;
const P1 = 1; // Black
const P2 = 2; // White (CPU)

export default class Reversi extends GameModel {
    grid: number[][] = [];
    turn = P1;
    justFlipped = new Set<string>();
    
    constructor(audio?: SoundEmitter) {
        super(8, 8, 'reversi', audio);
    }

    start() {
        this.level = 1;
        this.startLevel();
    }

    startLevel() {
        const size = 8 + (this.level - 1);
        this.resize(size, size);
        this.grid = Array(size).fill(0).map(() => Array(size).fill(EMPTY));
        // Initial setup
        const mid = Math.floor(size / 2);
        this.grid[mid-1][mid-1] = P2;
        this.grid[mid][mid] = P2;
        this.grid[mid-1][mid] = P1;
        this.grid[mid][mid-1] = P1;
        
        this.turn = P1;
        this.status$.next('Your Turn (Black)');
        this.emit();
    }

    handleInput(action: InputAction) {
        if (this.isGameOver || this.turn !== P1) return;

        if (action.type === 'SELECT' && action.data?.gridPos) {
            const { x, y } = action.data.gridPos;
            const flips = this.getFlipsForMove(x, y, P1);
            if (flips.length > 0) {
                this.makeMove(x, y, P1, flips);
            }
        }
    }

    getFlipsForMove(x: number, y: number, player: number): {x: number, y: number}[] {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height || this.grid[x][y] !== EMPTY) return [];
        
        const opponent = player === P1 ? P2 : P1;
        const dirs = [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]];
        const allFlips: {x: number, y: number}[] = [];
        
        for(let d of dirs) {
            let nx = x + d[0], ny = y + d[1];
            const lineFlips: {x: number, y: number}[] = [];
            
            while(nx>=0 && nx<this.width && ny>=0 && ny<this.height && this.grid[nx][ny] === opponent) {
                lineFlips.push({x: nx, y: ny});
                nx += d[0];
                ny += d[1];
            }
            
            if (lineFlips.length > 0 && nx>=0 && nx<this.width && ny>=0 && ny<this.height && this.grid[nx][ny] === player) {
                allFlips.push(...lineFlips);
            }
        }
        return allFlips;
    }

    makeMove(x: number, y: number, player: number, flips: {x: number, y: number}[]) {
        this.grid[x][y] = player;
        this.justFlipped.clear();

        flips.forEach(p => {
            this.grid[p.x][p.y] = player;
            this.justFlipped.add(`${p.x},${p.y}`);
            this.effects$.next({ type: 'PARTICLE', x: p.x, y: p.y, color: player === P1 ? 0x111111 : 0xffffff, style: 'PUFF' });
        });

        this.audio.playMove();
        
        // Next turn
        const nextPlayer = player === P1 ? P2 : P1;
        if (this.hasValidMoves(nextPlayer)) {
            this.turn = nextPlayer;
            this.status$.next(nextPlayer === P1 ? 'Your Turn' : 'CPU Turn');
            if (nextPlayer === P2) setTimeout(() => this.cpuMove(), 800);
        } else if (this.hasValidMoves(player)) {
            this.status$.next(nextPlayer === P1 ? 'CPU Passed' : 'You Passed');
            // The current player gets to go again, so if it's the CPU, it needs to move again.
            if (player === P2) setTimeout(() => this.cpuMove(), 800);
        } else {
            this.endGame();
        }

        this.emit();
    }

    hasValidMoves(player: number) {
        for(let x=0; x<this.width; x++) for(let y=0; y<this.height; y++) {
            if (this.grid[x][y] === EMPTY) {
                if (this.getFlipsForMove(x, y, player).length > 0) return true;
            }
        }
        return false;
    }

    cpuMove() {
        if (this.isGameOver) return;
        
        // AI: Find move with max flips, with corner/edge bias
        const moves: {x:number, y:number, score:number, flips: {x:number, y:number}[]}[] = [];
        
        for(let x=0; x<this.width; x++) for(let y=0; y<this.height; y++) {
            const flips = this.getFlipsForMove(x, y, P2);
            if (flips.length > 0) {
                let score = flips.length;
                // Corner bonus
                if ((x===0||x===this.width-1) && (y===0||y===this.height-1)) score += 10;
                // Edge bonus
                else if (x===0||x===this.width-1||y===0||y===this.height-1) score += 2;
                
                moves.push({x, y, score, flips});
            }
        }
        
        if (moves.length > 0) {
            moves.sort((a, b) => b.score - a.score);
            const bestMove = moves[0];
            this.makeMove(bestMove.x, bestMove.y, P2, bestMove.flips);
        }
    }

    endGame() {
        let p1 = 0, p2 = 0;
        this.grid.forEach(row => row.forEach(c => { if(c===P1) p1++; if(c===P2) p2++; }));
        
        if (p1 > p2) {
            this.status$.next(`WIN! ${p1}-${p2}`);
            this.updateScore(1000 + (p1-p2)*10);
            this.audio.playMatch();
            setTimeout(() => {
                this.level++;
                this.startLevel();
            }, 2000);
        } else {
            if (p2 > p1) {
                this.status$.next(`LOSE ${p1}-${p2}`);
                this.audio.playGameOver();
            } else {
                this.status$.next('DRAW');
            }
            this.isGameOver = true;
            setTimeout(() => this.effects$.next({ type: 'GAMEOVER' }), 2000);
        }
    }

    emit() {
        const items: GameItem[] = [];

        // 1. Board Background
        for(let x=0; x<this.width; x++) for(let y=0; y<this.height; y++) {
            const isDark = (x + y) % 2 === 0;
            // Use types 10/11 to avoid SceneEntityManager's auto z-offset for type 0
            items.push({ id: `bg_${x}_${y}`, x, y, type: isDark ? 10 : 11 }); 
        }

        // Valid moves for player
        if (this.turn === P1 && !this.isGameOver) {
            for(let x=0; x<this.width; x++) for(let y=0; y<this.height; y++) {
                if (this.grid[x][y] === EMPTY) {
                    if (this.getFlipsForMove(x, y, P1).length > 0) {
                        items.push({ id: `h_${x}_${y}`, x, y, type: 4, opacity: 0.3 });
                    }
                }
            }
        }

        // Pieces
        for(let x=0; x<this.width; x++) for(let y=0; y<this.height; y++) {
            const pieceType = this.grid[x][y];
            if (pieceType !== EMPTY) {
                const isFlipped = this.justFlipped.has(`${x},${y}`);
                items.push({ 
                    id: isFlipped ? this.uid() : `p_${x}_${y}`, 
                    x, y, 
                    type: pieceType, 
                    spawnStyle: isFlipped ? 'pop' : undefined
                });
            }
        }
        this.state$.next(items);
    }

    getRenderConfig() {
        return {
            geometry: 'box' as const,
            colors: { 
                10: 0x006600, 11: 0x007700, // Board Dark/Light
                1: 0x111111, 2: 0xeeeeee,   // Pieces Black/White
                4: 0x55ff55                 // Hint
            }, 
            bgColor: 0x222222,
            customGeometry: (type: number) => {
                if (type === 10 || type === 11) {
                    const geo = new THREE.BoxGeometry(1, 1, 0.2);
                    geo.translate(0, 0, -0.1); // Top face at Z=0
                    return geo;
                }
                if (type === 1 || type === 2 || type === 4) {
                    const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 32);
                    geo.rotateX(Math.PI / 2);
                    geo.translate(0, 0, 0.1); // Bottom face at Z=0
                    return geo;
                }
                return null;
            }
        };
    }
}

import { interval, filter } from 'rxjs';
import { GameModel } from './GameModel';
import { GameItem, InputAction, SoundEmitter } from '../types';

export class Flappy extends GameModel {
    birdY = 7;
    velocity = 0;
    obstacles: { x: number, gapY: number }[] = [];
    tickCount = 0;

    constructor(audio?: SoundEmitter) { super(10, 15, 'flappy', audio); }

    start() {
        this.birdY = 7;
        this.velocity = 0;
        this.obstacles = [];
        this.tickCount = 0;
        
        this.sub.add(interval(150).pipe(filter(() => !this.isPaused && !this.isGameOver)).subscribe(() => this.tick()));
    }

    tick() {
        this.tickCount++;
        // Gravity
        this.velocity -= 0.15;
        this.birdY += this.velocity;
        
        // Spawn Obstacle
        if (this.tickCount % 20 === 0) {
            this.obstacles.push({ x: 10, gapY: Math.floor(Math.random() * 8) + 2 });
        }
        
        // Move Obstacles
        this.obstacles.forEach(o => o.x -= 0.5);
        this.obstacles = this.obstacles.filter(o => o.x > -2);

        // Check Collision
        const bx = 2; // Fixed bird X
        const by = Math.round(this.birdY);
        
        if (by < 0 || by >= 15) this.gameOver();
        
        this.obstacles.forEach(o => {
            if (Math.abs(o.x - bx) < 0.8) {
                if (by < o.gapY || by > o.gapY + 3) this.gameOver();
                else if (Math.abs(o.x - bx) < 0.1) {
                    this.updateScore(1);
                    this.audio.playSelect();
                }
            }
        });

        this.emit();
    }

    handleInput(action: InputAction) {
        if (this.isGameOver) return;
        if (action.type === 'SELECT' || action.type === 'UP') {
            this.velocity = 0.8;
            this.audio.playMove();
        }
    }

    gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.status$.next('CRASHED!');
        this.audio.playGameOver();
        setTimeout(() => this.effects$.next({ type: 'GAMEOVER' }), 1000);
    }

    emit() {
        const items: GameItem[] = [];
        items.push({ id: 'bird', x: 2, y: Math.round(this.birdY), type: 1 });
        
        this.obstacles.forEach((o, i) => {
            const ox = Math.round(o.x);
            if (ox >= 0 && ox < 10) {
                for(let y=0; y<15; y++) {
                    if (y < o.gapY || y > o.gapY + 3) {
                        items.push({ id: `p_${i}_${y}`, x: ox, y, type: 2 });
                    }
                }
            }
        });
        this.state$.next(items);
    }

    getRenderConfig() {
        return { 
            geometry: 'box' as const, 
            colors: { 1: 0xffff00, 2: 0x00cc00 }, 
            bgColor: 0x87ceeb 
        };
    }
}

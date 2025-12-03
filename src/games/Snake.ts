
import { interval, filter } from 'rxjs';
import { GameModel } from './GameModel';
import { GameItem, InputAction, SoundEmitter } from '../types';

export class SnakeGame extends GameModel {
    d = { x: 0, y: 1 };
    nd = { x: 0, y: 1 };
    snake: GameItem[] = [];
    food: GameItem | null = null;

    constructor(audio?: SoundEmitter) { super(15, 15, 'snake', audio); }

    start() {
        this.snake = [{ x: 7, y: 7, id: this.uid(), type: 0 }];
        this.d = { x: 0, y: 1 };
        this.spawn();
        this.status$.next('Eat');

        this.sub.add(
            interval(200).pipe(
                filter(() => !this.isPaused && !this.isGameOver)
            ).subscribe(() => this.tick())
        );
    }

    handleInput(action: InputAction) {
        if (this.isPaused || this.isGameOver) return;
        const map: any = { UP: {x:0,y:1}, DOWN: {x:0,y:-1}, LEFT: {x:-1,y:0}, RIGHT: {x:1,y:0} };
        const n = map[action.type];
        if (n && (n.x !== -this.d.x || n.y !== -this.d.y)) this.nd = n;
    }

    tick() {
        this.d = this.nd;
        const h = this.snake[0];
        const nh: GameItem = { x: h.x + this.d.x, y: h.y + this.d.y, id: this.uid(), type: 0 };

        if (nh.x < 0 || nh.x >= 15 || nh.y < 0 || nh.y >= 15 || this.snake.some(s => s.x === nh.x && s.y === nh.y)) {
            this.stop();
            this.isGameOver = true;
            this.status$.next('GAME OVER');
            this.audio.playGameOver();
            setTimeout(() => this.effects$.next({ type: 'GAMEOVER' }), 2000);
            return;
        }

        this.snake.unshift(nh);
        
        if (this.food && nh.x === this.food.x && nh.y === this.food.y) {
            this.updateScore(50);
            this.subStat$.next(++this.subStat);
            this.effects$.next({ type: 'PARTICLE', x: nh.x, y: nh.y, color: 0xff0000, style: 'PUFF' });
            this.effects$.next({ type: 'AUDIO', name: 'SELECT' });
            this.spawn();
        } else {
            this.snake.pop();
        }
        this.emit();
    }

    spawn() {
        while (true) {
            const x = Math.floor(Math.random() * 15);
            const y = Math.floor(Math.random() * 15);
            if (!this.snake.some(s => s.x === x && s.y === y)) {
                this.food = { x, y, id: 'f', type: 2 };
                break;
            }
        }
    }

    emit() {
        const r = this.snake.map((s, i) => ({ id: s.id, x: s.x, y: s.y, type: i ? 1 : 0, spawnStyle: 'instant' as const }));
        if (this.food) r.push({ ...this.food, spawnStyle: 'instant' as const });
        this.state$.next(r);
    }

    getRenderConfig() {
        return { geometry: 'box' as const, colors: { 0: 0x00ff00, 1: 0x008800, 2: 0xff0000 }, bgColor: 0x0a1a0a };
    }
}

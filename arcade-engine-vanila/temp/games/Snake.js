import { GameModel } from "../GameModel.js";

import { filter, interval } from "rxjs";

//#region src/games/Snake.ts
var SnakeGame = class extends GameModel {
    d={
        x: 0,
        y: 1
    };
    nd={
        x: 0,
        y: 1
    };
    snake=[];
    food=null;
    constructor(audio) {
        super(15, 15, "snake", audio);
    }
    start() {
        this.snake = [ {
            x: 7,
            y: 7,
            id: this.uid(),
            type: 0
        } ];
        this.d = {
            x: 0,
            y: 1
        };
        this.spawn();
        this.status$.next("Eat");
        this.sub.add(interval(200).pipe(filter(() => !this.isPaused && !this.isGameOver)).subscribe(() => this.tick()));
    }
    handleInput(action) {
        if (this.isPaused || this.isGameOver) return;
        const n = {
            UP: {
                x: 0,
                y: 1
            },
            DOWN: {
                x: 0,
                y: -1
            },
            LEFT: {
                x: -1,
                y: 0
            },
            RIGHT: {
                x: 1,
                y: 0
            }
        }[action.type];
        if (n && (n.x !== -this.d.x || n.y !== -this.d.y)) this.nd = n;
    }
    tick() {
        this.d = this.nd;
        const h = this.snake[0];
        const nh = {
            x: h.x + this.d.x,
            y: h.y + this.d.y,
            id: this.uid(),
            type: 0
        };
        if (nh.x < 0 || nh.x >= 15 || nh.y < 0 || nh.y >= 15 || this.snake.some(s => s.x === nh.x && s.y === nh.y)) {
            this.stop();
            this.isGameOver = true;
            this.status$.next("GAME OVER");
            this.audio.playGameOver();
            setTimeout(() => this.effects$.next({
                type: "GAMEOVER"
            }), 2e3);
            return;
        }
        this.snake.unshift(nh);
        if (this.food && nh.x === this.food.x && nh.y === this.food.y) {
            this.updateScore(50);
            this.subStat$.next(++this.subStat);
            this.effects$.next({
                type: "PARTICLE",
                x: nh.x,
                y: nh.y,
                color: 16711680,
                style: "PUFF"
            });
            this.effects$.next({
                type: "AUDIO",
                name: "SELECT"
            });
            this.spawn();
        } else this.snake.pop();
        this.emit();
    }
    spawn() {
        while (true) {
            const x = Math.floor(Math.random() * 15);
            const y = Math.floor(Math.random() * 15);
            if (!this.snake.some(s => s.x === x && s.y === y)) {
                this.food = {
                    x: x,
                    y: y,
                    id: "f",
                    type: 2
                };
                break;
            }
        }
    }
    emit() {
        const r = this.snake.map((s, i) => ({
            id: s.id,
            x: s.x,
            y: s.y,
            type: i ? 1 : 0,
            spawnStyle: "instant"
        }));
        if (this.food) r.push({
            ...this.food,
            spawnStyle: "instant"
        });
        this.state$.next(r);
    }
    getRenderConfig() {
        return {
            geometry: "box",
            colors: {
                0: 65280,
                1: 34816,
                2: 16711680
            },
            bgColor: 662026
        };
    }
};

//#endregion
export { SnakeGame };
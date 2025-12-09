import { GameModel } from "../GameModel.js";

import { filter, interval } from "rxjs";

//#region src/games/WhackAMole.ts
var WhackAMole = class extends GameModel {
    grid=[];
    timer=30;
    constructor(audio) {
        super(3, 3, "whackamole", audio);
    }
    start() {
        this.level = 1;
        this.startLevel();
    }
    startLevel() {
        const size = Math.min(5, 2 + Math.floor((this.level - 1) / 2));
        this.resize(size, size);
        this.grid = Array(size * size).fill(0);
        this.timer = Math.max(10, 30 - this.level * 2);
        this.status$.next(`Lvl ${this.level}: Time ${this.timer}`);
        this.stop();
        this.sub.add(interval(1e3).pipe(filter(() => !this.isPaused && !this.isGameOver)).subscribe(() => {
            this.timer--;
            this.status$.next(`Time: ${this.timer}`);
            if (this.timer <= 0) this.handleWin();
        }));
        const spawnRate = Math.max(200, 800 - this.level * 50);
        this.sub.add(interval(spawnRate).pipe(filter(() => !this.isPaused && !this.isGameOver)).subscribe(() => {
            if (Math.random() > .3) {
                const idx = Math.floor(Math.random() * this.grid.length);
                if (this.grid[idx] === 0) {
                    this.grid[idx] = 1;
                    this.emit();
                    setTimeout(() => {
                        if (this.grid[idx] === 1) {
                            this.grid[idx] = 0;
                            this.emit();
                        }
                    }, spawnRate + 400);
                }
            }
        }));
        this.emit();
    }
    handleInput(action) {
        if (this.isGameOver || action.type !== "SELECT") return;
        const pos = action.data && action.data.gridPos ? action.data.gridPos : null;
        if (!pos) return;
        const {x: x, y: y} = pos;
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        const idx = y * this.width + x;
        if (this.grid[idx] === 1) {
            this.grid[idx] = 0;
            this.updateScore(100);
            this.audio.playSelect();
            this.effects$.next({
                type: "PARTICLE",
                x: x,
                y: y,
                color: 9127187,
                style: "PUFF"
            });
            this.emit();
        }
    }
    handleWin() {
        this.status$.next("LEVEL CLEARED!");
        this.updateScore(500);
        this.audio.playMatch();
        setTimeout(() => {
            this.level++;
            this.startLevel();
        }, 1500);
    }
    emit() {
        const items = [];
        for (let i = 0; i < this.grid.length; i++) items.push({
            id: `wam_${i}`,
            x: i % this.width,
            y: Math.floor(i / this.width),
            type: this.grid[i]
        });
        this.state$.next(items);
    }
    getRenderConfig() {
        return {
            geometry: "cylinder",
            colors: {
                0: 2263842,
                1: 9127187
            },
            bgColor: 8900331
        };
    }
};

//#endregion
export { WhackAMole };
import { GameModel } from "../GameModel.js";

import { filter, interval } from "rxjs";

//#region src/games/Tetris.ts
var TetrisGame = class extends GameModel {
    shapes=[ [ [ 1, 1, 1, 1 ] ], [ [ 1, 1 ], [ 1, 1 ] ], [ [ 0, 1, 0 ], [ 1, 1, 1 ] ], [ [ 1, 1, 0 ], [ 0, 1, 1 ] ], [ [ 0, 1, 1 ], [ 1, 1, 0 ] ] ];
    cols={
        0: 61680,
        1: 15790080,
        2: 10486e3,
        3: 15728640,
        4: 61440
    };
    grid=[];
    active=null;
    constructor(audio) {
        super(10, 20, "tetris", audio);
    }
    start() {
        this.grid = Array(this.width).fill(null).map(() => Array(this.height).fill(null));
        this.spawn();
        this.status$.next("Lines: 0");
        this.sub.add(interval(500).pipe(filter(() => !this.isPaused && !this.isGameOver)).subscribe(() => {
            if (this.active && !this.move(0, -1)) this.lock();
        }));
    }
    spawn() {
        const t = Math.floor(Math.random() * this.shapes.length);
        this.active = {
            shape: this.shapes[t],
            x: 3,
            y: 19,
            type: t,
            id: this.uid()
        };
        if (this.col(0, 0)) {
            this.stop();
            this.isGameOver = true;
            this.status$.next("GAME OVER");
            this.audio.playGameOver();
            setTimeout(() => this.effects$.next({
                type: "GAMEOVER"
            }), 2e3);
        }
        this.emit();
    }
    handleInput(action) {
        if (this.isPaused || this.isGameOver) return;
        if (action.type === "LEFT") this.move(-1, 0);
        if (action.type === "RIGHT") this.move(1, 0);
        if (action.type === "DOWN") this.move(0, -1);
        if (action.type === "UP") this.rot();
        if (action.type === "SELECT") {
            while (this.move(0, -1)) ;
            this.lock();
            this.audio.playMove();
        }
    }
    move(dx, dy) {
        if (!this.active) return false;
        this.active.x += dx;
        this.active.y += dy;
        if (this.col(0, 0)) {
            this.active.x -= dx;
            this.active.y -= dy;
            return false;
        }
        this.emit();
        return true;
    }
    rot() {
        if (!this.active) return;
        const s = this.active.shape;
        this.active.shape = s[0].map((_, i) => s.map(r => r[i]).reverse());
        if (this.col(0, 0)) this.active.shape = s; else this.emit();
    }
    col(dx, dy) {
        if (!this.active) return false;
        const s = this.active.shape;
        for (let r = 0; r < s.length; r++) for (let c = 0; c < s[r].length; c++) if (s[r][c]) {
            const wx = this.active.x + c + dx, wy = this.active.y - r + dy;
            if (wx < 0 || wx >= 10 || wy < 0 || wy < 20 && this.grid[wx][wy]) return true;
        }
        return false;
    }
    lock() {
        if (!this.active) return;
        const s = this.active.shape;
        for (let r = 0; r < s.length; r++) for (let c = 0; c < s[r].length; c++) if (s[r][c]) {
            const wy = this.active.y - r;
            if (wy >= 0) this.grid[this.active.x + c][wy] = {
                id: `${this.active.id}${r}${c}`,
                type: this.active.type,
                x: this.active.x + c,
                y: wy
            };
        }
        this.audio.playSelect();
        let l = 0;
        for (let y = 0; y < 20; y++) if ([ ...Array(10) ].every((_, x) => this.grid[x][y])) {
            l++;
            for (let x = 0; x < 10; x++) this.effects$.next({
                type: "EXPLODE",
                x: x,
                y: y,
                color: this.cols[this.grid[x][y].type],
                style: "CONFETTI"
            });
            for (let k = y; k < 19; k++) for (let x = 0; x < 10; x++) {
                this.grid[x][k] = this.grid[x][k + 1];
                if (this.grid[x][k]) this.grid[x][k].y = k;
            }
            for (let x = 0; x < 10; x++) this.grid[x][19] = null;
            y--;
        }
        if (l) {
            this.updateScore(l * 100);
            this.subStat$.next(this.subStat += l);
        }
        this.spawn();
    }
    emit() {
        const renderList = [];
        for (let x = 0; x < 10; x++) for (let y = 0; y < 20; y++) if (this.grid[x][y]) renderList.push({
            ...this.grid[x][y],
            spawnStyle: "instant"
        });
        if (this.active) {
            const s = this.active.shape;
            for (let r = 0; r < s.length; r++) for (let c = 0; c < s[r].length; c++) if (s[r][c]) renderList.push({
                id: `${this.active.id}p${r}${c}`,
                type: this.active.type,
                x: this.active.x + c,
                y: this.active.y - r
            });
        }
        this.state$.next(renderList);
    }
    getRenderConfig() {
        return {
            geometry: "box",
            colors: this.cols,
            bgColor: 328976
        };
    }
};

//#endregion
export { TetrisGame };
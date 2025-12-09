import { GameModel } from "../GameModel.js";

//#region src/games/Minesweeper.ts
var Minesweeper = class extends GameModel {
    grid=[];
    generated=false;
    constructor(audio) {
        super(10, 10, "minesweeper", audio);
    }
    start() {
        this.grid = Array(10).fill(null).map(() => Array(10).fill(null).map(() => ({
            mine: false,
            state: "covered",
            neighbors: 0
        })));
        this.generated = false;
        this.emit();
        this.status$.next("Click to reveal");
    }
    generate(fx, fy) {
        let mines = 15;
        while (mines > 0) {
            const x = Math.floor(Math.random() * 10);
            const y = Math.floor(Math.random() * 10);
            if ((Math.abs(x - fx) > 1 || Math.abs(y - fy) > 1) && !this.grid[x][y].mine) {
                this.grid[x][y].mine = true;
                mines--;
            }
        }
        for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) {
            if (this.grid[x][y].mine) continue;
            let n = 0;
            for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
                if (dx === 0 && dy === 0) continue;
                const nx = x + dx;
                const ny = y + dy;
                if (nx >= 0 && nx < 10 && ny >= 0 && ny < 10 && this.grid[nx][ny].mine) n++;
            }
            this.grid[x][y].neighbors = n;
        }
        this.generated = true;
    }
    handleInput(action) {
        if (this.isGameOver || action.type !== "SELECT") return;
        if (!action.data || !action.data.gridPos) return;
        const {x: x, y: y} = action.data.gridPos;
        if (x < 0 || x >= 10 || y < 0 || y >= 10) return;
        if (!this.generated) this.generate(x, y);
        const cell = this.grid[x][y];
        if (cell.state === "revealed") return;
        if (cell.mine) {
            cell.state = "revealed";
            this.emit();
            this.status$.next("BOOM!");
            this.audio.playExplosion();
            this.isGameOver = true;
            this.grid.forEach(col => col.forEach(c => c.state = "revealed"));
            this.emit();
            setTimeout(() => this.effects$.next({
                type: "GAMEOVER"
            }), 2e3);
        } else {
            this.reveal(x, y);
            this.audio.playSelect();
            this.emit();
            this.checkWin();
        }
    }
    reveal(x, y) {
        if (x < 0 || x >= 10 || y < 0 || y >= 10 || this.grid[x][y].state === "revealed") return;
        this.grid[x][y].state = "revealed";
        this.updateScore(10);
        if (this.grid[x][y].neighbors === 0) for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) this.reveal(x + dx, y + dy);
    }
    checkWin() {
        let covered = 0;
        this.grid.forEach(col => col.forEach(c => {
            if (c.state === "covered") covered++;
        }));
        if (covered === 15) {
            this.status$.next("CLEARED!");
            this.updateScore(1e3);
            this.isGameOver = true;
            this.audio.playMatch();
            setTimeout(() => this.effects$.next({
                type: "GAMEOVER"
            }), 2e3);
        }
    }
    emit() {
        const items = [];
        for (let x = 0; x < 10; x++) for (let y = 0; y < 10; y++) {
            const c = this.grid[x][y];
            let type = 10;
            if (c.state === "revealed") if (c.mine) type = 11; else type = c.neighbors;
            items.push({
                id: `m_${x}_${y}`,
                x: x,
                y: y,
                type: type
            });
        }
        this.state$.next(items);
    }
    getRenderConfig() {
        return {
            geometry: "box",
            colors: {
                10: 10066329,
                11: 0,
                0: 3355443,
                1: 255,
                2: 65280,
                3: 16711680,
                4: 128,
                5: 8388608,
                6: 32896,
                7: 0,
                8: 8421504
            },
            bgColor: 1118481
        };
    }
};

//#endregion
export { Minesweeper };
import { GameModel } from "../GameModel.js";

//#region src/games/TicTacToe.ts
var TicTacToe = class extends GameModel {
    grid=[];
    turn=1;
    gridSize=3;
    constructor(audio) {
        super(3, 3, "tictactoe", audio);
    }
    start() {
        this.gridSize = 3;
        this.startLevel();
    }
    startLevel() {
        this.resize(this.gridSize, this.gridSize);
        this.grid = Array(this.width * this.height).fill(0);
        this.turn = 1;
        this.emit();
        this.status$.next(`Level ${this.gridSize - 2}: X Turn`);
    }
    handleInput(action) {
        if (this.isGameOver || this.turn !== 1 || action.type !== "SELECT") return;
        const pos = action.data && action.data.gridPos ? action.data.gridPos : null;
        if (!pos) return;
        const {x: x, y: y} = pos;
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) return;
        const idx = y * this.width + x;
        if (this.grid[idx] === 0) {
            this.grid[idx] = 1;
            this.audio.playMove();
            this.emit();
            if (this.checkWin(1)) this.handlePlayerWin(); else if (this.grid.every(c => c !== 0)) {
                this.status$.next("DRAW");
                this.isGameOver = true;
                setTimeout(() => this.effects$.next({
                    type: "GAMEOVER"
                }), 2e3);
            } else {
                this.turn = 2;
                this.status$.next("CPU Turn");
                setTimeout(() => this.cpuMove(), 500);
            }
        }
    }
    cpuMove() {
        if (this.isGameOver) return;
        const moves = [];
        this.grid.forEach((c, i) => {
            if (c === 0) moves.push(i);
        });
        if (moves.length > 0) {
            const move = moves[Math.floor(Math.random() * moves.length)];
            this.grid[move] = 2;
            this.audio.playMove();
            this.emit();
            if (this.checkWin(2)) {
                this.status$.next("CPU WINS");
                this.isGameOver = true;
                this.audio.playGameOver();
                setTimeout(() => this.effects$.next({
                    type: "GAMEOVER"
                }), 2e3);
            } else if (this.grid.every(c => c !== 0)) {
                this.status$.next("DRAW");
                this.isGameOver = true;
                setTimeout(() => this.effects$.next({
                    type: "GAMEOVER"
                }), 2e3);
            } else {
                this.turn = 1;
                this.status$.next("Your Turn");
            }
        }
    }
    checkWin(p) {
        const N = this.gridSize;
        for (let y = 0; y < N; y++) {
            let win = true;
            for (let x = 0; x < N; x++) if (this.grid[y * N + x] !== p) win = false;
            if (win) return true;
        }
        for (let x = 0; x < N; x++) {
            let win = true;
            for (let y = 0; y < N; y++) if (this.grid[y * N + x] !== p) win = false;
            if (win) return true;
        }
        let d1 = true;
        for (let i = 0; i < N; i++) if (this.grid[i * N + i] !== p) d1 = false;
        if (d1) return true;
        let d2 = true;
        for (let i = 0; i < N; i++) if (this.grid[i * N + (N - 1 - i)] !== p) d2 = false;
        if (d2) return true;
        return false;
    }
    handlePlayerWin() {
        this.status$.next("LEVEL CLEARED!");
        this.updateScore(100 * this.gridSize);
        this.audio.playMatch();
        this.effects$.next({
            type: "PARTICLE",
            x: Math.floor(this.width / 2),
            y: Math.floor(this.height / 2),
            color: 16776960,
            style: "EXPLODE"
        });
        this.turn = -1;
        setTimeout(() => {
            this.gridSize++;
            this.startLevel();
        }, 1500);
    }
    emit() {
        const items = [];
        for (let i = 0; i < this.grid.length; i++) items.push({
            id: `ttt_${i}`,
            x: i % this.width,
            y: Math.floor(i / this.width),
            type: this.grid[i]
        });
        this.state$.next(items);
    }
    getRenderConfig() {
        return {
            geometry: "box",
            colors: {
                0: 3355494,
                1: 65535,
                2: 16711935
            },
            bgColor: 68
        };
    }
};

//#endregion
export { TicTacToe };
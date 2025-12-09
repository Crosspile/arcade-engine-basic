import { GameModel } from "../GameModel.js";

//#region src/games/Sudoku.ts
var Sudoku = class extends GameModel {
    grid=[];
    fixed=[];
    selectedIdx=-1;
    constructor(audio) {
        super(9, 9, "sudoku", audio);
    }
    start() {
        this.generateLevel();
    }
    generateLevel() {
        const base = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 4, 5, 6, 7, 8, 9, 1, 2, 3, 7, 8, 9, 1, 2, 3, 4, 5, 6, 2, 3, 4, 5, 6, 7, 8, 9, 1, 5, 6, 7, 8, 9, 1, 2, 3, 4, 8, 9, 1, 2, 3, 4, 5, 6, 7, 3, 4, 5, 6, 7, 8, 9, 1, 2, 6, 7, 8, 9, 1, 2, 3, 4, 5, 9, 1, 2, 3, 4, 5, 6, 7, 8 ];
        const map = [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ].sort(() => Math.random() - .5);
        this.grid = base.map(v => map[v - 1]);
        this.fixed = Array(81).fill(false);
        const toKeep = 30;
        const indices = Array.from({
            length: 81
        }, (_, i) => i).sort(() => Math.random() - .5);
        for (let i = 0; i < 81; i++) if (i < toKeep) this.fixed[indices[i]] = true; else this.grid[indices[i]] = 0;
        this.emit();
        this.status$.next("Fill cells");
    }
    handleInput(action) {
        if (this.isGameOver) return;
        const pos = action.data && action.data.gridPos ? action.data.gridPos : null;
        if (pos) {
            if (pos.x >= 0 && pos.x < 9 && pos.y >= 0 && pos.y < 9) {
                const idx = pos.y * 9 + pos.x;
                this.selectedIdx = idx;
                if (!this.fixed[idx]) {
                    if (action.type === "SELECT") {
                        this.grid[idx] = this.grid[idx] % 9 + 1;
                        this.audio.playSelect();
                        this.checkWin();
                    }
                }
                this.emit();
            }
        }
    }
    checkWin() {
        if (this.grid.includes(0)) return;
        let valid = true;
        const check = arr => new Set(arr).size === 9;
        for (let i = 0; i < 9; i++) {
            if (!check(this.grid.slice(i * 9, (i + 1) * 9))) valid = false;
            const col = [];
            for (let r = 0; r < 9; r++) col.push(this.grid[r * 9 + i]);
            if (!check(col)) valid = false;
        }
        if (valid) this.handleWin();
    }
    handleWin() {
        this.status$.next("SOLVED!");
        this.updateScore(1e3);
        this.audio.playMatch();
        this.effects$.next({
            type: "GAMEOVER"
        });
    }
    emit() {
        const items = [];
        for (let i = 0; i < 81; i++) {
            const val = this.grid[i];
            const isSel = this.selectedIdx === i;
            this.fixed[i];
            const x = i % 9;
            const y = Math.floor(i / 9);
            const bgType = (Math.floor(x / 3) + Math.floor(y / 3)) % 2 === 0 ? 0 : 3;
            items.push({
                id: `sud_${i}`,
                x: x,
                y: 8 - y,
                type: isSel ? 4 : val === 0 ? bgType : bgType,
                text: val > 0 ? val.toString() : void 0,
                textColor: this.fixed[i] ? "#000000" : "#0000aa"
            });
        }
        this.state$.next(items);
    }
    getRenderConfig() {
        return {
            geometry: "box",
            colors: {
                0: 16777215,
                1: 16777215,
                2: 14540253,
                3: 15658734,
                4: 16776960
            },
            bgColor: 2236962
        };
    }
};

//#endregion
export { Sudoku };
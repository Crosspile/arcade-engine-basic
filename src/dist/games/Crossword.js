import { G as GameModel } from "../GameModel.js";

import "rxjs";

class Crossword extends GameModel {
    constructor(audio) {
        super(5, 5, "crossword", audio);
        this.grid = [];
        this.solution = [];
        this.selected = {
            x: 0,
            y: 0
        };
    }
    start() {
        const puzzle = [ [ "H", "E", "L", "L", "O" ], [ "E", " ", "I", " ", " " ], [ "A", "P", "P", "L", "E" ], [ "R", " ", "S", " ", " " ], [ "T", "R", "A", "I", "N" ] ];
        this.solution = puzzle;
        this.grid = puzzle.map(row => row.map(c => c === " " ? " " : ""));
        this.emit();
        this.status$.next("Select & Type");
    }
    handleInput(action) {
        var _a;
        if (this.isGameOver) return;
        if (action.type === "SELECT" && ((_a = action.data) == null ? void 0 : _a.gridPos)) {
            const {x: x, y: y} = action.data.gridPos;
            if (this.solution[4 - y][x] !== " ") {
                this.selected = {
                    x: x,
                    y: y
                };
                const current = this.grid[4 - y][x];
                const sol = this.solution[4 - y][x];
                const opts = [ " ", "A", "E", "I", "O", "U", "S", "T", "R", "N", "L", sol ].filter((v, i, a) => a.indexOf(v) === i);
                let nextIdx = (opts.indexOf(current) + 1) % opts.length;
                this.grid[4 - y][x] = opts[nextIdx];
                this.audio.playSelect();
                this.checkWin();
                this.emit();
            }
        }
    }
    checkWin() {
        let correct = true;
        for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
            if (this.solution[y][x] !== " " && this.grid[y][x] !== this.solution[y][x]) correct = false;
        }
        if (correct) {
            this.handleWin();
        }
    }
    handleWin() {
        this.status$.next("SOLVED!");
        this.updateScore(500);
        this.audio.playMatch();
        this.effects$.next({
            type: "GAMEOVER"
        });
    }
    emit() {
        const items = [];
        for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
            const row = 4 - y;
            const isBlack = this.solution[row][x] === " ";
            const isSel = this.selected.x === x && this.selected.y === y;
            const val = this.grid[row][x];
            items.push({
                id: `cw_${x}_${y}`,
                x: x,
                y: y,
                type: isBlack ? 0 : isSel ? 2 : 1,
                text: isBlack ? void 0 : val,
                textColor: "#000000"
            });
        }
        this.state$.next(items);
    }
    getRenderConfig() {
        return {
            geometry: "box",
            colors: {
                0: 1118481,
                // Black block
                1: 16777215,
                // White block
                2: 16776960
            },
            bgColor: 2236962
        };
    }
}

export { Crossword };

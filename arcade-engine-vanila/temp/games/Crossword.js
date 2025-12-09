import { GameModel } from "../GameModel.js";

//#region src/games/Crossword.ts
var Crossword = class extends GameModel {
    grid=[];
    solution=[];
    selected={
        x: 0,
        y: 0
    };
    constructor(audio) {
        super(5, 5, "crossword", audio);
    }
    start() {
        const puzzle = [ [ "H", "E", "L", "L", "O" ], [ "E", " ", "I", " ", " " ], [ "A", "P", "P", "L", "E" ], [ "R", " ", "S", " ", " " ], [ "T", "R", "A", "I", "N" ] ];
        this.solution = puzzle;
        this.grid = puzzle.map(row => row.map(c => c === " " ? " " : ""));
        this.emit();
        this.status$.next("Select & Type");
    }
    handleInput(action) {
        if (this.isGameOver) return;
        if (action.type === "SELECT" && action.data?.gridPos) {
            const {x: x, y: y} = action.data.gridPos;
            if (this.solution[4 - y][x] !== " ") {
                this.selected = {
                    x: x,
                    y: y
                };
                const current = this.grid[4 - y][x];
                const sol = this.solution[4 - y][x];
                let idx = "ABCDEFGHIJKLMNOPQRSTUVWXYZ ".indexOf(current);
                if (idx === -1) idx = 0;
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
        for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (this.solution[y][x] !== " " && this.grid[y][x] !== this.solution[y][x]) correct = false;
        if (correct) this.handleWin();
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
                1: 16777215,
                2: 16776960
            },
            bgColor: 2236962
        };
    }
};

//#endregion
export { Crossword };
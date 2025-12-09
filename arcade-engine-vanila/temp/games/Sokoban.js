import { GameModel } from "../GameModel.js";

//#region src/games/Sokoban.ts
var SokobanGame = class extends GameModel {
    playerPos={
        x: 0,
        y: 0
    };
    grid=[];
    targets=[];
    constructor(audio) {
        super(8, 8, "sokoban", audio);
    }
    start() {
        this.level = 1;
        this.startLevel();
    }
    startLevel() {
        const size = Math.min(12, 6 + Math.floor(this.level / 2));
        this.resize(size, size);
        this.generateLevel();
        this.status$.next(`Level ${this.level}`);
    }
    generateLevel() {
        this.grid = Array(this.width).fill(null).map(() => Array(this.height).fill(null));
        this.targets = [];
        for (let x = 0; x < this.width; x++) for (let y = 0; y < this.height; y++) if (x === 0 || x === this.width - 1 || y === 0 || y === this.height - 1) this.grid[x][y] = {
            id: `w_${x}_${y}`,
            type: 1,
            x: x,
            y: y
        };
        let px = Math.floor(Math.random() * (this.width - 2)) + 1;
        let py = Math.floor(Math.random() * (this.height - 2)) + 1;
        this.playerPos = {
            x: px,
            y: py
        };
        const numBoxes = Math.min(5, 2 + Math.floor(this.level / 2));
        const tempTargets = [];
        while (tempTargets.length < numBoxes) {
            let tx = Math.floor(Math.random() * (this.width - 4)) + 2;
            let ty = Math.floor(Math.random() * (this.height - 4)) + 2;
            if ((tx !== px || ty !== py) && !tempTargets.some(t => t.x === tx && t.y === ty)) tempTargets.push({
                x: tx,
                y: ty
            });
        }
        const dirs = [ {
            x: 0,
            y: 1
        }, {
            x: 0,
            y: -1
        }, {
            x: 1,
            y: 0
        }, {
            x: -1,
            y: 0
        } ];
        const boxes = tempTargets.map(t => ({
            ...t
        }));
        for (let i = 0; i < numBoxes * 15; i++) {
            const box = boxes[Math.floor(Math.random() * boxes.length)];
            const dir = dirs[Math.floor(Math.random() * dirs.length)];
            const pullX = box.x + dir.x;
            const pullY = box.y + dir.y;
            const playerX = box.x + 2 * dir.x;
            const playerY = box.y + 2 * dir.y;
            if (pullX > 0 && pullX < this.width - 1 && pullY > 0 && pullY < this.height - 1 && playerX > 0 && playerX < this.width - 1 && playerY > 0 && playerY < this.height - 1) {
                const obs1 = this.grid[pullX][pullY];
                const obs2 = this.grid[playerX][playerY];
                const boxAtPull = boxes.some(b => b.x === pullX && b.y === pullY);
                const boxAtPlayer = boxes.some(b => b.x === playerX && b.y === playerY);
                if (!obs1 && !obs2 && !boxAtPull && !boxAtPlayer) {
                    box.x = pullX;
                    box.y = pullY;
                    this.playerPos = {
                        x: playerX,
                        y: playerY
                    };
                }
            }
        }
        this.targets = tempTargets;
        for (let x = 1; x < this.width - 1; x++) for (let y = 1; y < this.height - 1; y++) this.grid[x][y] = null;
        this.targets.forEach(t => {
            this.grid[t.x][t.y] = {
                id: `t_${t.x}_${t.y}`,
                type: 4,
                x: t.x,
                y: t.y
            };
        });
        boxes.forEach((b, i) => {
            const onTarget = this.isTarget(b.x, b.y);
            this.grid[b.x][b.y] = {
                id: `b_${i}`,
                type: onTarget ? 5 : 2,
                x: b.x,
                y: b.y
            };
        });
        this.emit();
    }
    handleInput(action) {
        if (this.isGameOver) return;
        let dx = 0, dy = 0;
        if (action.type === "UP") dy = 1;
        if (action.type === "DOWN") dy = -1;
        if (action.type === "LEFT") dx = -1;
        if (action.type === "RIGHT") dx = 1;
        if (!dx && !dy) return;
        const tx = this.playerPos.x + dx;
        const ty = this.playerPos.y + dy;
        if (this.isWall(tx, ty)) return;
        const p = this.grid[tx] ? this.grid[tx][ty] : null;
        if (p && (p.type === 2 || p.type === 5)) {
            const px = tx + dx;
            const py = ty + dy;
            if (this.isWall(px, py) || this.grid[px][py] && (this.grid[px][py].type === 2 || this.grid[px][py].type === 5)) return;
            this.move(tx, ty, px, py);
            const isT = this.isTarget(px, py);
            this.grid[px][py].type = isT ? 5 : 2;
            this.audio.playMove();
        }
        this.move(this.playerPos.x, this.playerPos.y, tx, ty);
        this.playerPos = {
            x: tx,
            y: ty
        };
        this.subStat++;
        this.subStat$.next(this.subStat);
        this.emit();
        this.checkWin();
    }
    checkWin() {
        if (this.targets.every(t => {
            const item = this.grid[t.x][t.y];
            return item && item.type === 5;
        }) && this.targets.length > 0) this.handleWin();
    }
    handleWin() {
        this.status$.next("LEVEL CLEARED!");
        this.updateScore(1e3);
        this.audio.playMatch();
        this.effects$.next({
            type: "EXPLODE",
            x: this.width / 2,
            y: this.height / 2,
            color: 65280,
            style: "EXPLODE"
        });
        setTimeout(() => {
            this.level++;
            this.startLevel();
        }, 1500);
    }
    debugAction() {
        this.handleWin();
    }
    move(x1, y1, x2, y2) {
        this.grid[x2][y2] = this.grid[x1][y1];
        this.grid[x1][y1] = null;
        if (this.grid[x2][y2]) {
            this.grid[x2][y2].x = x2;
            this.grid[x2][y2].y = y2;
        }
        if (this.isTarget(x1, y1)) this.grid[x1][y1] = {
            id: `t_${x1}_${y1}`,
            type: 4,
            x: x1,
            y: y1
        };
    }
    isWall(x, y) {
        return x < 0 || x >= this.width || y < 0 || y >= this.height || this.grid[x][y] && this.grid[x][y].type === 1;
    }
    isTarget(x, y) {
        return this.targets.some(t => t.x === x && t.y === y);
    }
    emit() {
        const r = [];
        for (let x = 0; x < this.width; x++) for (let y = 0; y < this.height; y++) if (this.grid[x][y]) r.push({
            ...this.grid[x][y],
            x: x,
            y: y
        });
        r.push({
            id: "p",
            type: 3,
            x: this.playerPos.x,
            y: this.playerPos.y
        });
        this.state$.next(r);
    }
    getRenderConfig() {
        return {
            geometry: "box",
            colors: {
                1: 5592405,
                2: 13468991,
                3: 5097983,
                4: 16724787,
                5: 65280
            },
            bgColor: 1118481
        };
    }
};

//#endregion
export { SokobanGame };
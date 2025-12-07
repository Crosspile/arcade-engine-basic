const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["games/Snake.js","GameModel.js","games/Sokoban.js","games/Match3.js","games/Tetris.js","games/Game2048.js","games/LightsOut.js","games/Minesweeper.js","games/Memory.js","games/Simon.js","games/TicTacToe.js","games/SlidingPuzzle.js","games/WhackAMole.js","games/SameGame.js","games/MazeRun.js","games/Sudoku.js","games/Crossword.js"])))=>i.map(i=>d[i]);
//#region \0vite/preload-helper.js
var scriptRel = "modulepreload";

var assetsURL = function(dep) {
    return "/" + dep;
};

var seen = {};

const __vitePreload = function preload(baseModule, deps, importerUrl) {
    let promise = Promise.resolve();
    if (true && deps && deps.length > 0) {
        const links = document.getElementsByTagName("link");
        const cspNonceMeta = document.querySelector("meta[property=csp-nonce]");
        const cspNonce = cspNonceMeta?.nonce || cspNonceMeta?.getAttribute("nonce");
        function allSettled(promises$2) {
            return Promise.all(promises$2.map(p => Promise.resolve(p).then(value$1 => ({
                status: "fulfilled",
                value: value$1
            }), reason => ({
                status: "rejected",
                reason: reason
            }))));
        }
        promise = allSettled(deps.map(dep => {
            dep = assetsURL(dep, importerUrl);
            if (dep in seen) return;
            seen[dep] = true;
            const isCss = dep.endsWith(".css");
            const cssSelector = isCss ? '[rel="stylesheet"]' : "";
            if (!!importerUrl) for (let i$1 = links.length - 1; i$1 >= 0; i$1--) {
                const link$1 = links[i$1];
                if (link$1.href === dep && (!isCss || link$1.rel === "stylesheet")) return;
            } else if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) return;
            const link = document.createElement("link");
            link.rel = isCss ? "stylesheet" : scriptRel;
            if (!isCss) link.as = "script";
            link.crossOrigin = "";
            link.href = dep;
            if (cspNonce) link.setAttribute("nonce", cspNonce);
            document.head.appendChild(link);
            if (isCss) return new Promise((res, rej) => {
                link.addEventListener("load", res);
                link.addEventListener("error", () => rej( new Error(`Unable to preload CSS for ${dep}`)));
            });
        }));
    }
    function handlePreloadError(err$2) {
        const e$1 = new Event("vite:preloadError", {
            cancelable: true
        });
        e$1.payload = err$2;
        window.dispatchEvent(e$1);
        if (!e$1.defaultPrevented) throw err$2;
    }
    return promise.then(res => {
        for (const item of res || []) {
            if (item.status !== "rejected") continue;
            handlePreloadError(item.reason);
        }
        return baseModule().catch(handlePreloadError);
    });
};

//#endregion
//#region src/GameRegistry.ts
var DEBUG_HANDLERS = {
    default: game => {
        if (typeof game.debugAction === "function") game.debugAction();
    }
};

var ALL_GAMES = [ {
    id: "snake",
    name: "Snake",
    loader: () => __vitePreload(() => import("./games/Snake.js"), __vite__mapDeps([0,1])),
    debug: DEBUG_HANDLERS.default
}, {
    id: "sokoban",
    name: "Sokoban",
    loader: () => __vitePreload(() => import("./games/Sokoban.js"), __vite__mapDeps([2,1])),
    debug: DEBUG_HANDLERS.default
}, {
    id: "match3",
    name: "Match-3",
    loader: () => __vitePreload(() => import("./games/Match3.js"), __vite__mapDeps([3,1])),
    debug: DEBUG_HANDLERS.default
}, {
    id: "tetris",
    name: "Tetris",
    loader: () => __vitePreload(() => import("./games/Tetris.js"), __vite__mapDeps([4,1])),
    debug: DEBUG_HANDLERS.default
}, {
    id: "2048",
    name: "2048",
    loader: () => __vitePreload(() => import("./games/Game2048.js"), __vite__mapDeps([5,1])),
    debug: DEBUG_HANDLERS.default
}, {
    id: "lightsout",
    name: "Lights Out",
    loader: () => __vitePreload(() => import("./games/LightsOut.js"), __vite__mapDeps([6,1])),
    debug: DEBUG_HANDLERS.default
}, {
    id: "minesweeper",
    name: "Minesweeper",
    loader: () => __vitePreload(() => import("./games/Minesweeper.js"), __vite__mapDeps([7,1])),
    debug: DEBUG_HANDLERS.default
}, {
    id: "memory",
    name: "Memory",
    loader: () => __vitePreload(() => import("./games/Memory.js"), __vite__mapDeps([8,1])),
    debug: DEBUG_HANDLERS.default
}, {
    id: "simon",
    name: "Simon",
    loader: () => __vitePreload(() => import("./games/Simon.js"), __vite__mapDeps([9,1])),
    debug: DEBUG_HANDLERS.default
}, {
    id: "tictactoe",
    name: "Tic Tac Toe",
    loader: () => __vitePreload(() => import("./games/TicTacToe.js"), __vite__mapDeps([10,1])),
    debug: DEBUG_HANDLERS.default
}, {
    id: "sliding",
    name: "Sliding Puzzle",
    loader: () => __vitePreload(() => import("./games/SlidingPuzzle.js"), __vite__mapDeps([11,1])),
    debug: DEBUG_HANDLERS.default
}, {
    id: "whackamole",
    name: "Whack-A-Mole",
    loader: () => __vitePreload(() => import("./games/WhackAMole.js"), __vite__mapDeps([12,1])),
    debug: DEBUG_HANDLERS.default
}, {
    id: "samegame",
    name: "SameGame",
    loader: () => __vitePreload(() => import("./games/SameGame.js"), __vite__mapDeps([13,1])),
    debug: DEBUG_HANDLERS.default
}, {
    id: "mazerun",
    name: "Maze Run",
    loader: () => __vitePreload(() => import("./games/MazeRun.js"), __vite__mapDeps([14,1])),
    debug: DEBUG_HANDLERS.default
}, {
    id: "sudoku",
    name: "Sudoku",
    loader: () => __vitePreload(() => import("./games/Sudoku.js"), __vite__mapDeps([15,1])),
    debug: DEBUG_HANDLERS.default
}, {
    id: "crossword",
    name: "Mini Crossword",
    loader: () => __vitePreload(() => import("./games/Crossword.js"), __vite__mapDeps([16,1])),
    debug: DEBUG_HANDLERS.default
} ];

const GAME_REGISTRY = {};

ALL_GAMES.forEach(game => {
    GAME_REGISTRY[game.id] = game;
});

const GAME_LIST = ALL_GAMES.map(({id: id, name: name}) => ({
    id: id,
    name: name
}));

const GAME_IDS = ALL_GAMES.map(g => g.id);

//#endregion
export { GAME_REGISTRY as n, GAME_LIST as t };
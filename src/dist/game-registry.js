const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["games/Sokoban.js","GameModel.js","games/Match3.js","games/Tetris.js","games/Snake.js","games/Game2048.js","games/LightsOut.js","games/Minesweeper.js","games/Memory.js","games/Simon.js","games/TicTacToe.js","games/SlidingPuzzle.js","games/WhackAMole.js","games/SameGame.js","games/MazeRun.js","games/Sudoku.js","games/Crossword.js"])))=>i.map(i=>d[i]);
const scriptRel = "modulepreload";

const assetsURL = function(dep) {
    return "/" + dep;
};

const seen = {};

const __vitePreload = function preload(baseModule, deps, importerUrl) {
    let promise = Promise.resolve();
    if (deps && deps.length > 0) {
        let allSettled2 = function(promises) {
            return Promise.all(promises.map(p => Promise.resolve(p).then(value => ({
                status: "fulfilled",
                value: value
            }), reason => ({
                status: "rejected",
                reason: reason
            }))));
        };
        document.getElementsByTagName("link");
        const cspNonceMeta = document.querySelector("meta[property=csp-nonce]");
        const cspNonce = (cspNonceMeta == null ? void 0 : cspNonceMeta.nonce) || (cspNonceMeta == null ? void 0 : cspNonceMeta.getAttribute("nonce"));
        promise = allSettled2(deps.map(dep => {
            dep = assetsURL(dep);
            if (dep in seen) return;
            seen[dep] = true;
            const isCss = dep.endsWith(".css");
            const cssSelector = isCss ? '[rel="stylesheet"]' : "";
            if (document.querySelector(`link[href="${dep}"]${cssSelector}`)) {
                return;
            }
            const link = document.createElement("link");
            link.rel = isCss ? "stylesheet" : scriptRel;
            if (!isCss) {
                link.as = "script";
            }
            link.crossOrigin = "";
            link.href = dep;
            if (cspNonce) {
                link.setAttribute("nonce", cspNonce);
            }
            document.head.appendChild(link);
            if (isCss) {
                return new Promise((res, rej) => {
                    link.addEventListener("load", res);
                    link.addEventListener("error", () => rej(new Error(`Unable to preload CSS for ${dep}`)));
                });
            }
        }));
    }
    function handlePreloadError(err) {
        const e = new Event("vite:preloadError", {
            cancelable: true
        });
        e.payload = err;
        window.dispatchEvent(e);
        if (!e.defaultPrevented) {
            throw err;
        }
    }
    return promise.then(res => {
        for (const item of res || []) {
            if (item.status !== "rejected") continue;
            handlePreloadError(item.reason);
        }
        return baseModule().catch(handlePreloadError);
    });
};

const DEBUG_HANDLERS = {
    // A single, generic handler that calls the game's own debug method.
    default: game => {
        if (typeof game.debugAction === "function") {
            game.debugAction();
        }
    }
};

const ALL_GAMES = [ {
    id: "sokoban",
    name: "Sokoban",
    loader: () => __vitePreload(() => import("./games/Sokoban.js"), true ? __vite__mapDeps([0,1]) : void 0),
    debug: DEBUG_HANDLERS.default
}, {
    id: "match3",
    name: "Match-3",
    loader: () => __vitePreload(() => import("./games/Match3.js"), true ? __vite__mapDeps([2,1]) : void 0),
    debug: DEBUG_HANDLERS.default
}, {
    id: "tetris",
    name: "Tetris",
    loader: () => __vitePreload(() => import("./games/Tetris.js"), true ? __vite__mapDeps([3,1]) : void 0),
    debug: DEBUG_HANDLERS.default
}, {
    id: "snake",
    name: "Snake",
    loader: () => __vitePreload(() => import("./games/Snake.js"), true ? __vite__mapDeps([4,1]) : void 0),
    debug: DEBUG_HANDLERS.default
}, {
    id: "2048",
    name: "2048",
    loader: () => __vitePreload(() => import("./games/Game2048.js"), true ? __vite__mapDeps([5,1]) : void 0),
    debug: DEBUG_HANDLERS.default
}, {
    id: "lightsout",
    name: "Lights Out",
    loader: () => __vitePreload(() => import("./games/LightsOut.js"), true ? __vite__mapDeps([6,1]) : void 0),
    debug: DEBUG_HANDLERS.default
}, {
    id: "minesweeper",
    name: "Minesweeper",
    loader: () => __vitePreload(() => import("./games/Minesweeper.js"), true ? __vite__mapDeps([7,1]) : void 0),
    debug: DEBUG_HANDLERS.default
}, {
    id: "memory",
    name: "Memory",
    loader: () => __vitePreload(() => import("./games/Memory.js"), true ? __vite__mapDeps([8,1]) : void 0),
    debug: DEBUG_HANDLERS.default
}, {
    id: "simon",
    name: "Simon",
    loader: () => __vitePreload(() => import("./games/Simon.js"), true ? __vite__mapDeps([9,1]) : void 0),
    debug: DEBUG_HANDLERS.default
}, {
    id: "tictactoe",
    name: "Tic Tac Toe",
    loader: () => __vitePreload(() => import("./games/TicTacToe.js"), true ? __vite__mapDeps([10,1]) : void 0),
    debug: DEBUG_HANDLERS.default
}, {
    id: "sliding",
    name: "Sliding Puzzle",
    loader: () => __vitePreload(() => import("./games/SlidingPuzzle.js"), true ? __vite__mapDeps([11,1]) : void 0),
    debug: DEBUG_HANDLERS.default
}, {
    id: "whackamole",
    name: "Whack-A-Mole",
    loader: () => __vitePreload(() => import("./games/WhackAMole.js"), true ? __vite__mapDeps([12,1]) : void 0),
    debug: DEBUG_HANDLERS.default
}, {
    id: "samegame",
    name: "SameGame",
    loader: () => __vitePreload(() => import("./games/SameGame.js"), true ? __vite__mapDeps([13,1]) : void 0),
    debug: DEBUG_HANDLERS.default
}, {
    id: "mazerun",
    name: "Maze Run",
    loader: () => __vitePreload(() => import("./games/MazeRun.js"), true ? __vite__mapDeps([14,1]) : void 0),
    debug: DEBUG_HANDLERS.default
}, {
    id: "sudoku",
    name: "Sudoku",
    loader: () => __vitePreload(() => import("./games/Sudoku.js"), true ? __vite__mapDeps([15,1]) : void 0),
    debug: DEBUG_HANDLERS.default
}, {
    id: "crossword",
    name: "Mini Crossword",
    loader: () => __vitePreload(() => import("./games/Crossword.js"), true ? __vite__mapDeps([16,1]) : void 0),
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

export { GAME_IDS as G, GAME_LIST as a, GAME_REGISTRY as b };

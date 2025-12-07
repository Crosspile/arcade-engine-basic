import { i as GameRenderer, n as SoundManager, r as InputManager, t as DebugCamera } from "./engine.js";

import { n as GAME_REGISTRY, t as GAME_LIST } from "./game-registry.js";

//#region \0vite/modulepreload-polyfill.js
(function polyfill() {
    const relList = document.createElement("link").relList;
    if (relList && relList.supports && relList.supports("modulepreload")) return;
    for (const link of document.querySelectorAll('link[rel="modulepreload"]')) processPreload(link);
    new MutationObserver(mutations => {
        for (const mutation of mutations) {
            if (mutation.type !== "childList") continue;
            for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
        }
    }).observe(document, {
        childList: true,
        subtree: true
    });
    function getFetchOpts(link) {
        const fetchOpts = {};
        if (link.integrity) fetchOpts.integrity = link.integrity;
        if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
        if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include"; else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit"; else fetchOpts.credentials = "same-origin";
        return fetchOpts;
    }
    function processPreload(link) {
        if (link.ep) return;
        link.ep = true;
        const fetchOpts = getFetchOpts(link);
        fetch(link.href, fetchOpts);
    }
})();

//#endregion
//#region src/components/debug/DebugUI.ts
var DebugUI = class {
    element;
    callbacks;
    state;
    selectGame;
    scoreEl;
    highScoreEl;
    subStatEl;
    statusEl;
    viewBtn;
    soundBtn;
    constructor(callbacks) {
        this.element = document.createElement("div");
        this.callbacks = callbacks;
        this.state = {
            gameId: GAME_LIST[0].id,
            score: 0,
            highScore: 0,
            subStat: 0,
            status: "Loading...",
            isOrtho: false,
            isSoundOn: false,
            isMenuOpen: false
        };
        this.render();
        this.attachEventListeners();
    }
    render() {
        this.element.className = "absolute top-5 right-5 z-50 pointer-events-auto bg-black/90 backdrop-blur-md p-4 rounded-xl border border-red-500/30 shadow-2xl min-w-[240px] animate-in fade-in slide-in-from-top-5 duration-200 font-mono";
        const gameOptions = GAME_LIST.map(game => `<option value="${game.id}" class="bg-neutral-800">${game.name}</option>`).join("");
        this.element.innerHTML = `\n            <div class="flex justify-between items-center mb-3 border-b border-red-500/30 pb-2">\n                <h2 class="text-red-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2">\n                    <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>Debug Control\n                </h2>\n                <button class="text-gray-500 hover:text-white transition-colors" data-action="toggleMenu">\n                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>\n                </button>\n            </div>\n            <div class="flex flex-col gap-3">\n                <div class="flex flex-col gap-1">\n                    <label class="text-[10px] text-gray-500 font-bold uppercase">Active Game</label>\n                    <select class="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-red-500/50 transition-colors" data-element="selectGame">\n                        ${gameOptions}\n                    </select>\n                </div>\n                <div class="h-px bg-white/5 my-1"></div>\n                <div class="flex flex-col gap-1 bg-white/5 p-2 rounded border border-white/5">\n                    <label class="text-[10px] text-gray-500 font-bold uppercase mb-1">Live Stats</label>\n                    <div class="flex justify-between text-xs"><span class="text-gray-400">Score</span><span class="text-yellow-400 font-bold" data-element="score">0</span></div>\n                    <div class="flex justify-between text-xs"><span class="text-gray-400">Best</span><span class="text-gray-400 font-bold" data-element="highScore">0</span></div>\n                    <div class="flex justify-between text-xs"><span class="text-gray-400">Moves/Lines</span><span class="text-blue-300 font-bold" data-element="subStat">0</span></div>\n                    <div class="flex justify-between text-xs mt-1 pt-1 border-t border-white/5"><span class="text-gray-500">Status</span><span class="text-gray-300 max-w-[100px] truncate text-right" data-element="status">Level 1</span></div>\n                </div>\n                <div class="h-px bg-white/5 my-1"></div>\n                <div class="grid grid-cols-3 gap-1">\n                    <button class="py-1.5 border text-[10px] rounded hover:bg-white/10 transition-colors bg-green-900/30 border-green-500/30 text-green-200" data-action="toggleView">3D</button>\n                    <button class="py-1.5 border text-[10px] rounded hover:bg-white/10 transition-colors bg-white/5 border-white/10 text-gray-400" data-action="toggleSound">MUTE</button>\n                    <button class="py-1.5 border text-[10px] rounded hover:bg-white/10 transition-colors bg-white/5 border-white/10 text-gray-400" data-action="toggleMenu">MENU</button>\n                </div>\n                <div class="grid grid-cols-2 gap-2 mt-1">\n                    <button class="py-2 bg-yellow-600/20 border border-yellow-500/30 text-yellow-200 text-[10px] rounded hover:bg-yellow-600/40 uppercase font-bold tracking-wider transition-all active:scale-95" data-action="debugWin">Force Win</button>\n                    <button class="py-2 bg-blue-600/20 border border-blue-500/30 text-blue-200 text-[10px] rounded hover:bg-blue-600/40 uppercase font-bold tracking-wider transition-all active:scale-95" data-action="toggleDebugCam">Free Cam</button>\n                </div>\n            </div>\n        `;
        this.selectGame = this.element.querySelector('[data-element="selectGame"]');
        this.scoreEl = this.element.querySelector('[data-element="score"]');
        this.highScoreEl = this.element.querySelector('[data-element="highScore"]');
        this.subStatEl = this.element.querySelector('[data-element="subStat"]');
        this.statusEl = this.element.querySelector('[data-element="status"]');
        this.viewBtn = this.element.querySelector('[data-action="toggleView"]');
        this.soundBtn = this.element.querySelector('[data-action="toggleSound"]');
    }
    attachEventListeners() {
        this.selectGame.addEventListener("change", e => this.callbacks.onSwitchGame(e.target.value));
        this.element.addEventListener("click", e => {
            const button = e.target.closest("button");
            if (!button) return;
            switch (button.dataset.action) {
              case "toggleMenu":
                this.callbacks.onToggleMenu();
                break;

              case "debugWin":
                this.callbacks.onDebugWin();
                break;

              case "toggleDebugCam":
                this.callbacks.onToggleDebugCam();
                break;

              case "toggleView":
                this.callbacks.onToggleView();
                break;

              case "toggleSound":
                this.callbacks.onToggleSound();
                break;
            }
        });
    }
    getElement() {
        return this.element;
    }
    update(newState) {
        Object.assign(this.state, newState);
        if (this.selectGame.value !== this.state.gameId) this.selectGame.value = this.state.gameId;
        if (this.scoreEl.textContent !== String(this.state.score)) this.scoreEl.textContent = String(this.state.score);
        if (this.highScoreEl.textContent !== String(this.state.highScore)) this.highScoreEl.textContent = String(this.state.highScore);
        if (this.subStatEl.textContent !== String(this.state.subStat)) this.subStatEl.textContent = String(this.state.subStat);
        if (this.statusEl.textContent !== this.state.status) this.statusEl.textContent = this.state.status;
        this.viewBtn.textContent = this.state.isOrtho ? "3D" : "2D";
        this.soundBtn.textContent = this.state.isSoundOn ? "MUTE" : "UNMUTE";
    }
};

//#endregion
//#region src/components/GameInfo.ts
var GameInfo = class {
    element;
    gameNameElement;
    constructor() {
        this.element = document.createElement("div");
        this.element.className = "absolute top-5 left-5 z-40 pointer-events-none";
        const title = document.createElement("h1");
        title.className = "m-0 text-cyan-400 text-lg uppercase tracking-widest font-bold shadow-black drop-shadow-md";
        title.textContent = "Arcade Engine";
        this.gameNameElement = document.createElement("h2");
        this.gameNameElement.className = "text-white/60 text-xs font-mono mt-1 uppercase tracking-wider";
        const versionDiv = document.createElement("div");
        versionDiv.className = "mt-1 text-[10px] text-gray-500 font-mono";
        versionDiv.textContent = "v1.0.0";
        this.element.appendChild(title);
        this.element.appendChild(this.gameNameElement);
        this.element.appendChild(versionDiv);
    }
    getElement() {
        return this.element;
    }
    update(state) {
        const gameName = GAME_REGISTRY[state.gameId]?.name || "Unknown Game";
        this.gameNameElement.textContent = gameName;
    }
};

//#endregion
//#region src/components/VirtualControls.ts
var VirtualControls = class {
    element;
    constructor(callbacks) {
        this.element = document.createElement("div");
        this.element.className = "absolute inset-0 w-full h-full pointer-events-none";
        const dpad = this.createDPad(callbacks.onMove);
        const actionButtons = this.createActionButtons(callbacks.onAction);
        this.element.append(dpad, actionButtons);
    }
    createDPad(onMove) {
        const container = document.createElement("div");
        container.className = "absolute bottom-8 left-8 grid grid-cols-3 gap-2 w-36 h-36 pointer-events-auto";
        [ {
            dir: "up",
            gridArea: "1 / 2 / 2 / 3"
        }, {
            dir: "left",
            gridArea: "2 / 1 / 3 / 2"
        }, {
            dir: "right",
            gridArea: "2 / 3 / 3 / 4"
        }, {
            dir: "down",
            gridArea: "3 / 2 / 4 / 3"
        } ].forEach(({dir: dir, gridArea: gridArea}) => {
            const button = this.createControlButton(dir.toUpperCase());
            button.style.gridArea = gridArea;
            button.addEventListener("pointerdown", () => onMove(dir));
            button.addEventListener("pointerup", () => onMove("none"));
            button.addEventListener("pointerleave", () => onMove("none"));
            container.appendChild(button);
        });
        return container;
    }
    createActionButtons(onAction) {
        const container = document.createElement("div");
        container.className = "absolute bottom-12 right-8 flex gap-4 pointer-events-auto";
        const buttonA = this.createControlButton("A", "w-16 h-16 rounded-full");
        buttonA.addEventListener("pointerdown", () => onAction("a"));
        const buttonB = this.createControlButton("B", "w-16 h-16 rounded-full");
        buttonB.addEventListener("pointerdown", () => onAction("b"));
        container.append(buttonB, buttonA);
        return container;
    }
    createControlButton(text, extraClasses = "w-12 h-12") {
        const button = document.createElement("button");
        button.textContent = text;
        button.className = `bg-black/40 text-white font-bold rounded-md flex items-center justify-center ${extraClasses}`;
        button.addEventListener("contextmenu", e => e.preventDefault());
        return button;
    }
    getElement() {
        return this.element;
    }
    update(state) {
        this.element.style.display = state.visible ? "block" : "none";
    }
};

//#endregion
//#region src/App.ts
var DEFAULT_GAME_ID = GAME_LIST[0].id;

var App = class {
    container;
    gameContainer;
    engine=null;
    debugCam=null;
    activeGame=null;
    inputManager=null;
    audio;
    gameId=DEFAULT_GAME_ID;
    score=0;
    highScore=0;
    subStat=0;
    status="";
    isMenuOpen=false;
    isOrtho=false;
    isSoundOn=false;
    isTouchDevice=false;
    debugUI;
    gameInfo;
    virtualControls;
    constructor(container) {
        this.container = container;
        this.audio = new SoundManager;
        this.container.className = "relative w-full h-screen bg-neutral-900 overflow-hidden select-none";
        this.createDOMStructure();
        this.isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
        this.init();
    }
    createDOMStructure() {
        this.gameContainer = document.createElement("div");
        this.gameContainer.className = "w-full h-full";
        this.container.appendChild(this.gameContainer);
    }
    async init() {
        this.inputManager = new InputManager(this.gameContainer, () => this.engine?.activeCamera, (x, y) => null);
        this.engine = new GameRenderer(this.gameContainer, this.inputManager, {
            onSwitchGame: id => this.loadGame(id),
            onRestart: () => {
                if (this.activeGame) this.loadGame(this.activeGame.gameId);
            },
            onMenuStateChange: isOpen => {
                this.isMenuOpen = isOpen;
                this.isSoundOn = this.audio.enabled;
                this.updateUI();
            },
            onStatsUpdate: () => {
                if (this.activeGame) {
                    this.score = this.activeGame.score;
                    this.highScore = this.activeGame.highScore;
                    this.subStat = this.activeGame.subStat;
                    this.status = this.activeGame.status$.value;
                    this.updateUI();
                }
            }
        }, this.audio, GAME_LIST);
        this.debugCam = new DebugCamera(this.engine);
        this.inputManager.action$.subscribe(action => {
            if (this.activeGame && !this.activeGame.isPaused) if (action.type === "SELECT" && action.data && action.data.raycaster && this.engine) {
                const gridPos = this.engine.getGridFromRay(action.data.raycaster);
                if (gridPos) this.activeGame.handleInput({
                    type: "SELECT",
                    data: {
                        gridPos: gridPos
                    }
                });
            } else this.activeGame.handleInput(action);
        });
        this.createUI();
        await this.loadGame(DEFAULT_GAME_ID);
        requestAnimationFrame(() => this.engine.onResize());
    }
    async loadGame(id) {
        if (!this.engine) return;
        if (this.activeGame) this.activeGame.stop();
        const gameDefinition = GAME_REGISTRY[id] || GAME_REGISTRY[DEFAULT_GAME_ID];
        try {
            const gameModule = await gameDefinition.loader();
            const game = new (gameModule.default || Object.values(gameModule).find(m => typeof m === "function" && /^\s*class\s+/.test(m.toString())))(this.audio);
            this.activeGame = game;
            this.engine.setGame(game);
            this.gameId = id;
            this.highScore = game.highScore;
            this.isOrtho = this.engine.isOrtho;
            game.start();
            this.updateUI();
        } catch (error) {
            console.error("Failed to load game:", id, error);
        }
    }
    createUI() {
        this.gameInfo = new GameInfo;
        this.debugUI = new DebugUI({
            onSwitchGame: id => this.loadGame(id),
            onDebugWin: () => this.handleDebugWin(),
            onToggleDebugCam: () => this.handleToggleDebugCam(),
            onToggleView: () => this.handleToggleView(),
            onToggleSound: () => this.handleToggleSound(),
            onToggleMenu: () => this.handleToggleMenu()
        });
        if (this.inputManager) this.virtualControls = new VirtualControls({
            onMove: direction => this.inputManager?.emitVirtual(direction),
            onAction: () => this.inputManager?.emitVirtual("SELECT")
        });
        this.container.append(this.gameInfo.getElement(), this.debugUI.getElement(), this.virtualControls.getElement());
    }
    updateUI() {
        this.gameInfo?.update({
            gameId: this.gameId
        });
        this.debugUI?.update({
            gameId: this.gameId,
            score: this.score,
            highScore: this.highScore,
            subStat: this.subStat,
            status: this.status,
            isOrtho: this.isOrtho,
            isSoundOn: this.isSoundOn,
            isMenuOpen: this.isMenuOpen
        });
        this.virtualControls?.update({
            visible: this.isTouchDevice
        });
    }
    handleDebugWin=() => {
        if (this.activeGame) {
            const def = GAME_REGISTRY[this.activeGame.gameId];
            if (def && def.debug) def.debug(this.activeGame);
        }
    };
    handleToggleDebugCam=() => {
        this.debugCam?.toggle();
    };
    handleToggleView=() => {
        if (this.engine) {
            this.isOrtho = this.engine.toggleCamera();
            this.updateUI();
        }
    };
    handleToggleSound=() => {
        this.isSoundOn = this.audio.toggle();
        this.updateUI();
    };
    handleToggleMenu=() => {
        this.engine?.toggleMenu();
    };
};

//#endregion
//#region src/main.ts
var appRoot = document.getElementById("app");

if (appRoot) new App(appRoot);
//#endregion
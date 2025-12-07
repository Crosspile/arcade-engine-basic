import { GAME_LIST } from '../../GameRegistry';
import type { GameId } from '../../engine/types';

interface DebugUIState {
    gameId: GameId;
    score: number;
    highScore: number;
    subStat: number;
    status: string;
    isOrtho: boolean;
    isSoundOn: boolean;
    isMenuOpen: boolean;
}

interface DebugCallbacks {
    onSwitchGame: (id: string) => void;
    onDebugWin: () => void;
    onToggleDebugCam: () => void;
    onToggleView: () => void;
    onToggleSound: () => void;
    onToggleMenu: () => void;
}

export class DebugUI {
    private element: HTMLElement;
    private callbacks: DebugCallbacks;
    private state: DebugUIState;

    // DOM Element References
    private selectGame!: HTMLSelectElement;
    private scoreEl!: HTMLSpanElement;
    private highScoreEl!: HTMLSpanElement;
    private subStatEl!: HTMLSpanElement;
    private statusEl!: HTMLSpanElement;
    private viewBtn!: HTMLButtonElement;
    private soundBtn!: HTMLButtonElement;

    constructor(callbacks: DebugCallbacks) {
        this.element = document.createElement('div');
        this.callbacks = callbacks;
        this.state = {
            gameId: GAME_LIST[0].id,
            score: 0,
            highScore: 0,
            subStat: 0,
            status: 'Loading...',
            isOrtho: false,
            isSoundOn: false,
            isMenuOpen: false,
        };

        this.render();
        this.attachEventListeners();
    }

    private render() {
        this.element.className = 'absolute top-5 right-5 z-50 pointer-events-auto bg-black/90 backdrop-blur-md p-4 rounded-xl border border-red-500/30 shadow-2xl min-w-[240px] animate-in fade-in slide-in-from-top-5 duration-200 font-mono';
        
        const gameOptions = GAME_LIST.map(game => 
            `<option value="${game.id}" class="bg-neutral-800">${game.name}</option>`
        ).join('');

        this.element.innerHTML = `
            <div class="flex justify-between items-center mb-3 border-b border-red-500/30 pb-2">
                <h2 class="text-red-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>Debug Control
                </h2>
                <button class="text-gray-500 hover:text-white transition-colors" data-action="toggleMenu">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
                </button>
            </div>
            <div class="flex flex-col gap-3">
                <div class="flex flex-col gap-1">
                    <label class="text-[10px] text-gray-500 font-bold uppercase">Active Game</label>
                    <select class="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-red-500/50 transition-colors" data-element="selectGame">
                        ${gameOptions}
                    </select>
                </div>
                <div class="h-px bg-white/5 my-1"></div>
                <div class="flex flex-col gap-1 bg-white/5 p-2 rounded border border-white/5">
                    <label class="text-[10px] text-gray-500 font-bold uppercase mb-1">Live Stats</label>
                    <div class="flex justify-between text-xs"><span class="text-gray-400">Score</span><span class="text-yellow-400 font-bold" data-element="score">0</span></div>
                    <div class="flex justify-between text-xs"><span class="text-gray-400">Best</span><span class="text-gray-400 font-bold" data-element="highScore">0</span></div>
                    <div class="flex justify-between text-xs"><span class="text-gray-400">Moves/Lines</span><span class="text-blue-300 font-bold" data-element="subStat">0</span></div>
                    <div class="flex justify-between text-xs mt-1 pt-1 border-t border-white/5"><span class="text-gray-500">Status</span><span class="text-gray-300 max-w-[100px] truncate text-right" data-element="status">Level 1</span></div>
                </div>
                <div class="h-px bg-white/5 my-1"></div>
                <div class="grid grid-cols-3 gap-1">
                    <button class="py-1.5 border text-[10px] rounded hover:bg-white/10 transition-colors bg-green-900/30 border-green-500/30 text-green-200" data-action="toggleView">3D</button>
                    <button class="py-1.5 border text-[10px] rounded hover:bg-white/10 transition-colors bg-white/5 border-white/10 text-gray-400" data-action="toggleSound">MUTE</button>
                    <button class="py-1.5 border text-[10px] rounded hover:bg-white/10 transition-colors bg-white/5 border-white/10 text-gray-400" data-action="toggleMenu">MENU</button>
                </div>
                <div class="grid grid-cols-2 gap-2 mt-1">
                    <button class="py-2 bg-yellow-600/20 border border-yellow-500/30 text-yellow-200 text-[10px] rounded hover:bg-yellow-600/40 uppercase font-bold tracking-wider transition-all active:scale-95" data-action="debugWin">Force Win</button>
                    <button class="py-2 bg-blue-600/20 border border-blue-500/30 text-blue-200 text-[10px] rounded hover:bg-blue-600/40 uppercase font-bold tracking-wider transition-all active:scale-95" data-action="toggleDebugCam">Free Cam</button>
                </div>
            </div>
        `;

        // Store references to dynamic elements
        this.selectGame = this.element.querySelector('[data-element="selectGame"]') as HTMLSelectElement;
        this.scoreEl = this.element.querySelector('[data-element="score"]') as HTMLSpanElement;
        this.highScoreEl = this.element.querySelector('[data-element="highScore"]') as HTMLSpanElement;
        this.subStatEl = this.element.querySelector('[data-element="subStat"]') as HTMLSpanElement;
        this.statusEl = this.element.querySelector('[data-element="status"]') as HTMLSpanElement;
        this.viewBtn = this.element.querySelector('[data-action="toggleView"]') as HTMLButtonElement;
        this.soundBtn = this.element.querySelector('[data-action="toggleSound"]') as HTMLButtonElement;
    }

    private attachEventListeners() {
        this.selectGame.addEventListener('change', (e) => this.callbacks.onSwitchGame((e.target as HTMLSelectElement).value));
        this.element.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            const button = target.closest('button');
            if (!button) return;

            const action = button.dataset.action;
            switch (action) {
                case 'toggleMenu': this.callbacks.onToggleMenu(); break;
                case 'debugWin': this.callbacks.onDebugWin(); break;
                case 'toggleDebugCam': this.callbacks.onToggleDebugCam(); break;
                case 'toggleView': this.callbacks.onToggleView(); break;
                case 'toggleSound': this.callbacks.onToggleSound(); break;
            }
        });
    }

    public getElement(): HTMLElement {
        return this.element;
    }

    public update(newState: Partial<DebugUIState>) {
        Object.assign(this.state, newState);

        if (this.selectGame.value !== this.state.gameId) this.selectGame.value = this.state.gameId;
        if (this.scoreEl.textContent !== String(this.state.score)) this.scoreEl.textContent = String(this.state.score);
        if (this.highScoreEl.textContent !== String(this.state.highScore)) this.highScoreEl.textContent = String(this.state.highScore);
        if (this.subStatEl.textContent !== String(this.state.subStat)) this.subStatEl.textContent = String(this.state.subStat);
        if (this.statusEl.textContent !== this.state.status) this.statusEl.textContent = this.state.status;

        this.viewBtn.textContent = this.state.isOrtho ? '3D' : '2D';
        this.soundBtn.textContent = this.state.isSoundOn ? 'MUTE' : 'UNMUTE';
    }
}
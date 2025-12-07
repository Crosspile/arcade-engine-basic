
import { GameRenderer } from './engine/core/GameRenderer';
import { InputManager } from './engine/core/InputManager';
import { SoundManager } from './engine/core/SoundManager';
import { DebugCamera } from './engine/debug/DebugCamera';
import { GameModel } from './games/GameModel';
import { GAME_REGISTRY, GAME_LIST } from './GameRegistry.ts';
import { DebugUI } from './components/debug/DebugUI';
import { GameInfo } from './components/GameInfo.ts';
import { VirtualControls } from './components/VirtualControls.ts';
import type { GameId } from './engine/types';

const DEFAULT_GAME_ID = GAME_LIST[0].id;

export class App {
    private container: HTMLDivElement;
    private gameContainer!: HTMLDivElement;
    private engine: GameRenderer | null = null;
    private debugCam: DebugCamera | null = null;
    private activeGame: GameModel | null = null;
    private inputManager: InputManager | null = null;
    private audio: SoundManager;

    // Game State
    private gameId: GameId = DEFAULT_GAME_ID;
    private score: number = 0;
    private highScore: number = 0;
    private subStat: number = 0;
    private status: string = '';

    // UI State
    private isMenuOpen: boolean = false;
    private isOrtho: boolean = false;
    private isSoundOn: boolean = false;
    private isTouchDevice: boolean = false;

    // Child components (to be converted)
    private debugUI!: DebugUI;
    private gameInfo!: GameInfo;
    private virtualControls!: VirtualControls;

    constructor(container: HTMLDivElement) {
        this.container = container;
        this.audio = new SoundManager();

        // Ensure the container is styled correctly to be visible and acts as a layout root.
        // This replaces the Tailwind classes from the original React component.
        this.container.className = 'relative w-full h-screen bg-neutral-900 overflow-hidden select-none';
        
        this.createDOMStructure();
        this.isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
        this.init();
    }

    private createDOMStructure() {
        // Create a dedicated container for the game/canvas
        this.gameContainer = document.createElement('div');
        this.gameContainer.className = 'w-full h-full';
        this.container.appendChild(this.gameContainer);
    }

    private async init() {
        // --- ATOMIC INITIALIZATION ---
        this.inputManager = new InputManager(
            this.gameContainer, // Input manager should listen on the game container
            () => this.engine?.activeCamera,
            (x, y) => null // Placeholder for raycasting logic
        );

        const callbacks = {
            onSwitchGame: (id: string) => this.loadGame(id),
            onRestart: () => {
                if (this.activeGame) this.loadGame(this.activeGame.gameId);
            },
            onMenuStateChange: (isOpen: boolean) => {
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
        };

        this.engine = new GameRenderer(this.gameContainer, this.inputManager, callbacks, this.audio, GAME_LIST);
        this.debugCam = new DebugCamera(this.engine);

        this.inputManager.action$.subscribe(action => {
            if (this.activeGame && !this.activeGame.isPaused) {
                if (action.type === 'SELECT' && action.data && action.data.raycaster && this.engine) {
                    const gridPos = this.engine.getGridFromRay(action.data.raycaster);
                    if (gridPos) {
                        this.activeGame.handleInput({ type: 'SELECT', data: { gridPos } });
                    }
                } else {
                    this.activeGame.handleInput(action);
                }
            }
        });

        this.createUI();

        // Initial game load
        await this.loadGame(DEFAULT_GAME_ID);

        // Force an initial resize.
        // We use requestAnimationFrame to ensure the browser has computed the layout and the container has its final size.
        requestAnimationFrame(() => this.engine!.onResize());
    }

    private async loadGame(id: GameId) {
        if (!this.engine) return;

        if (this.activeGame) {
            this.activeGame.stop();
        }

        const gameDefinition = GAME_REGISTRY[id] || GAME_REGISTRY[DEFAULT_GAME_ID];
        try {
            const gameModule = await gameDefinition.loader();
            const GameClass = gameModule.default || Object.values(gameModule).find(
                (m) => typeof m === 'function' && /^\s*class\s+/.test(m.toString())
            );

            const game = new GameClass(this.audio);

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

    private createUI() {
        // Create UI components
        this.gameInfo = new GameInfo(); // No longer needs a container
        this.debugUI = new DebugUI({
            onSwitchGame: (id: string) => this.loadGame(id),
            onDebugWin: () => this.handleDebugWin(),
            onToggleDebugCam: () => this.handleToggleDebugCam(),
            onToggleView: () => this.handleToggleView(),
            onToggleSound: () => this.handleToggleSound(),
            onToggleMenu: () => this.handleToggleMenu(),
        });
        if (this.inputManager) {
            this.virtualControls = new VirtualControls({
                onMove: (direction) => this.inputManager?.emitVirtual(direction as any),
                onAction: () => this.inputManager?.emitVirtual('SELECT'),
            });
        }

        // Append component elements to the main container for correct layering
        this.container.append(this.gameInfo.getElement(), this.debugUI.getElement(), this.virtualControls.getElement());
    }

    private updateUI() {
        this.gameInfo?.update({ gameId: this.gameId });
        this.debugUI?.update({
            gameId: this.gameId,
            score: this.score,
            highScore: this.highScore,
            subStat: this.subStat,
            status: this.status,
            isOrtho: this.isOrtho,
            isSoundOn: this.isSoundOn,
            isMenuOpen: this.isMenuOpen,
        });
        this.virtualControls?.update({
            // Only show virtual controls on touch devices
            visible: this.isTouchDevice,
        });
    }

    private handleDebugWin = () => {
        if (this.activeGame) {
            const def = GAME_REGISTRY[this.activeGame.gameId];
            if (def && def.debug) {
                def.debug(this.activeGame);
            }
        }
    };
    
    private handleToggleDebugCam = () => {
        this.debugCam?.toggle();
    };
    
    private handleToggleView = () => {
        if (this.engine) {
            this.isOrtho = this.engine.toggleCamera();
            this.updateUI();
        }
    };

    private handleToggleSound = () => {
        this.isSoundOn = this.audio.toggle();
        this.updateUI();
    };
    
    private handleToggleMenu = () => {
        this.engine?.toggleMenu();
    };
}

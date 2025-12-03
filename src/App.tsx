
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameRenderer } from './engine/core/GameRenderer';
import { InputManager } from './engine/core/InputManager';
import { SoundManager } from './engine/core/SoundManager';
import { DebugCamera } from './engine/debug/DebugCamera';
import DebugUI from './components/debug/DebugUI';
import GameInfo from './components/GameInfo';
import VirtualControls from './components/VirtualControls';
import { GameModel } from './games/GameModel';
import { GameId } from './types';
import { GAME_REGISTRY, GAME_LIST } from './games/GameRegistry';

const DEFAULT_GAME_ID = GAME_LIST[0].id;

const App: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<GameRenderer | null>(null);
    const debugCamRef = useRef<DebugCamera | null>(null);
    const activeGameRef = useRef<GameModel | null>(null);
    const [gameId, setGameId] = useState<GameId>(DEFAULT_GAME_ID);
    const [score, setScore] = useState(0);
    const [highScore, setHighScore] = useState(0);
    const [subStat, setSubStat] = useState(0);
    const [status, setStatus] = useState('');
    
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isOrtho, setIsOrtho] = useState(false);
    const [isSoundOn, setIsSoundOn] = useState(false);
    
    // Use state for input manager to pass to virtual controls
    const [inputManager, setInputManager] = useState<InputManager | null>(null);

    // Use a stable, single instance of the sound manager
    const [audio] = useState(() => new SoundManager());

    // Fix: Moved loadGame out of useEffect and wrapped in useCallback to fix scope issue.
    const loadGame = useCallback((id: string) => {
        const engine = engineRef.current;
        if (!engine) return;

        if (activeGameRef.current) {
            activeGameRef.current.stop();
        }

        const definition = GAME_REGISTRY[id] || GAME_REGISTRY[DEFAULT_GAME_ID];
        const game = new definition.class(audio);

        activeGameRef.current = game;
        engine.setGame(game);

        setGameId(id);
        setHighScore(game.highScore);
        setIsOrtho(engine.isOrtho);
        
        game.start();
    }, [audio]);

    useEffect(() => {
        if (!containerRef.current) return;

        let engine: GameRenderer;
        let debugCam: DebugCamera;
        let input: InputManager;

        const callbacks = {
            onSwitchGame: loadGame,
            onRestart: () => {
                if(activeGameRef.current) loadGame(activeGameRef.current.gameId);
            },
            onMenuStateChange: (isOpen: boolean) => {
                setIsMenuOpen(isOpen);
                setIsSoundOn(audio.enabled);
            },
            onStatsUpdate: () => {
                if (activeGameRef.current) {
                    setScore(activeGameRef.current.score);
                    setHighScore(activeGameRef.current.highScore);
                    setSubStat(activeGameRef.current.subStat);
                    setStatus(activeGameRef.current.status$.value);
                }
            }
        };

        // --- ATOMIC INITIALIZATION ---
        input = new InputManager(
            containerRef.current,
            () => engine?.activeCamera,
            (x, y) => null
        );
        
        engine = new GameRenderer(containerRef.current, input, callbacks, audio);
        engineRef.current = engine;

        debugCam = new DebugCamera(engine);
        debugCamRef.current = debugCam;
        
        setInputManager(input);

        const sub = input.action$.subscribe(action => {
            if (activeGameRef.current && !activeGameRef.current.isPaused) {
                if (action.type === 'SELECT' && action.data && action.data.raycaster) {
                    const gridPos = engine.getGridFromRay(action.data.raycaster);
                    if (gridPos) {
                        activeGameRef.current.handleInput({ type: 'SELECT', data: { gridPos } });
                    }
                } else {
                    activeGameRef.current.handleInput(action);
                }
            }
        });

        // Initial game load
        loadGame(DEFAULT_GAME_ID);

        // Cleanup
        return () => {
            sub.unsubscribe();
            engine.destroy();
            engineRef.current = null;
            debugCamRef.current = null;
            activeGameRef.current = null;
        };
    }, [audio, loadGame]);

    const handleDebugWin = () => {
        if (activeGameRef.current) {
            const def = GAME_REGISTRY[activeGameRef.current.gameId];
            if (def?.debug) {
                def.debug(activeGameRef.current);
            }
        }
    };
    
    const handleToggleDebugCam = () => {
        if (debugCamRef.current) {
            debugCamRef.current.toggle();
        }
    };
    
    const handleToggleView = () => {
        if (engineRef.current) {
            setIsOrtho(engineRef.current.toggleCamera());
        }
    };

    const handleToggleSound = () => {
        setIsSoundOn(audio.toggle());
    };
    
    const handleToggleMenu = () => {
        if (engineRef.current) {
            engineRef.current.toggleMenu();
        }
    };

    return (
        <div className="relative w-full h-screen bg-neutral-900 overflow-hidden select-none">
            <div ref={containerRef} className="w-full h-full" />
            
            <GameInfo gameId={gameId} />

            <DebugUI 
                gameId={gameId}
                score={score}
                highScore={highScore}
                subStat={subStat}
                status={status}
                isOrtho={isOrtho}
                isSoundOn={isSoundOn}
                isMenuOpen={isMenuOpen}
                onSwitchGame={loadGame}
                onDebugWin={handleDebugWin}
                onToggleDebugCam={handleToggleDebugCam}
                onToggleView={handleToggleView}
                onToggleSound={handleToggleSound}
                onToggleMenu={handleToggleMenu}
            />

            <VirtualControls inputManager={inputManager} />
        </div>
    );
};

export default App;

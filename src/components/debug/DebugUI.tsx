
import React, { useState } from 'react';
import { GAME_LIST } from '../../games/GameRegistry';

interface DebugProps {
    gameId: string;
    score: number;
    highScore: number;
    subStat: number;
    status: string;
    isOrtho: boolean;
    isSoundOn: boolean;
    isMenuOpen: boolean;
    onSwitchGame: (id: string) => void;
    onDebugWin: () => void;
    onToggleDebugCam: () => void;
    onToggleView: () => void;
    onToggleSound: () => void;
    onToggleMenu: () => void;
}

const DebugUI: React.FC<DebugProps> = ({ 
    gameId, score, highScore, subStat, status, 
    isOrtho, isSoundOn, isMenuOpen,
    onSwitchGame, onDebugWin, onToggleDebugCam,
    onToggleView, onToggleSound, onToggleMenu
}) => {
    const [isMinimized, setIsMinimized] = useState(false);

    if (isMinimized) {
        return (
            <button 
                onClick={() => setIsMinimized(false)}
                className="absolute top-5 right-5 z-50 bg-black/80 text-red-400 p-2 rounded-lg border border-red-500/30 hover:bg-black hover:text-red-300 transition-colors shadow-lg"
                title="Open Debug Tools"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6"/></svg>
            </button>
        );
    }

    return (
        <div className="absolute top-5 right-5 z-50 bg-black/90 backdrop-blur-md p-4 rounded-xl border border-red-500/30 shadow-2xl min-w-[240px] animate-in fade-in slide-in-from-top-5 duration-200 font-mono">
            <div className="flex justify-between items-center mb-3 border-b border-red-500/30 pb-2">
                <h2 className="text-red-400 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"/>
                    Debug Control
                </h2>
                <button 
                    onClick={() => setIsMinimized(true)}
                    className="text-gray-500 hover:text-white transition-colors"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                </button>
            </div>
            
            <div className="flex flex-col gap-3">
                {/* Game Switcher */}
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-gray-500 font-bold uppercase">Active Game</label>
                    <select 
                        value={gameId}
                        onChange={(e) => onSwitchGame(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded px-2 py-1.5 text-xs text-gray-300 focus:outline-none focus:border-red-500/50 transition-colors"
                    >
                        {GAME_LIST.map((game) => (
                            <option key={game.id} value={game.id} className="bg-neutral-800">
                                {game.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="h-px bg-white/5 my-1" />

                {/* Live Stats */}
                <div className="flex flex-col gap-1 bg-white/5 p-2 rounded border border-white/5">
                    <label className="text-[10px] text-gray-500 font-bold uppercase mb-1">Live Stats</label>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Score</span>
                        <span className="text-yellow-400 font-bold">{score}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Best</span>
                        <span className="text-gray-400 font-bold">{highScore}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Moves/Lines</span>
                        <span className="text-blue-300 font-bold">{subStat}</span>
                    </div>
                    <div className="flex justify-between text-xs mt-1 pt-1 border-t border-white/5">
                        <span className="text-gray-500">Status</span>
                        <span className="text-gray-300 max-w-[100px] truncate text-right">{status}</span>
                    </div>
                </div>

                <div className="h-px bg-white/5 my-1" />

                {/* Toggles */}
                <div className="grid grid-cols-3 gap-1">
                    <button onClick={onToggleView} className={`py-1.5 border text-[10px] rounded hover:bg-white/10 transition-colors ${!isOrtho ? 'bg-green-900/30 border-green-500/30 text-green-200' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                        {isOrtho ? '2D' : '3D'}
                    </button>
                    <button onClick={onToggleSound} className={`py-1.5 border text-[10px] rounded hover:bg-white/10 transition-colors ${isSoundOn ? 'bg-green-900/30 border-green-500/30 text-green-200' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                        {isSoundOn ? 'SND' : 'MUTE'}
                    </button>
                    <button onClick={onToggleMenu} className={`py-1.5 border text-[10px] rounded hover:bg-white/10 transition-colors ${isMenuOpen ? 'bg-green-900/30 border-green-500/30 text-green-200' : 'bg-white/5 border-white/10 text-gray-400'}`}>
                        MENU
                    </button>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2 mt-1">
                    <button onClick={onDebugWin} className="py-2 bg-yellow-600/20 border border-yellow-500/30 text-yellow-200 text-[10px] rounded hover:bg-yellow-600/40 uppercase font-bold tracking-wider transition-all active:scale-95">
                        Force Win
                    </button>
                    <button onClick={onToggleDebugCam} className="py-2 bg-blue-600/20 border border-blue-500/30 text-blue-200 text-[10px] rounded hover:bg-blue-600/40 uppercase font-bold tracking-wider transition-all active:scale-95">
                        Free Cam
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DebugUI;

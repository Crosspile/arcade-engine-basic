
import React from 'react';
import { GAME_LIST } from '../games/GameRegistry';

interface Props {
    gameId: string;
}

const GameInfo: React.FC<Props> = ({ gameId }) => {
    const gameName = GAME_LIST.find(g => g.id === gameId)?.name || 'Unknown Game';
    
    return (
        <div className="absolute top-5 left-5 z-40 pointer-events-none">
            <h1 className="m-0 text-cyan-400 text-lg uppercase tracking-widest font-bold shadow-black drop-shadow-md">
                Arcade Engine
            </h1>
            <h2 className="text-white/60 text-xs font-mono mt-1 uppercase tracking-wider">
                {gameName}
            </h2>
            <div className="mt-1 text-[10px] text-gray-500 font-mono">
                v1.0.0
            </div>
        </div>
    );
};

export default GameInfo;

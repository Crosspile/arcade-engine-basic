
import React from 'react';
import { InputManager } from '../engine/core/InputManager';
import { InputType } from '../types';

interface Props {
    inputManager: InputManager | null;
}

const VirtualControls: React.FC<Props> = ({ inputManager }) => {
    const handleInput = (type: InputType) => {
        if (inputManager) inputManager.emitVirtual(type);
    };

    return (
        <>
            <div className="absolute bottom-8 right-8 grid grid-cols-3 grid-rows-2 gap-2 z-10 md:hidden">
                <button className="col-start-2 row-start-1 w-16 h-16 bg-white/10 backdrop-blur border border-white/30 rounded-xl flex items-center justify-center text-2xl active:bg-cyan-400 active:text-black transition-colors"
                    onPointerDown={(e) => { e.preventDefault(); handleInput('UP'); }}>↑</button>
                <button className="col-start-1 row-start-2 w-16 h-16 bg-white/10 backdrop-blur border border-white/30 rounded-xl flex items-center justify-center text-2xl active:bg-cyan-400 active:text-black transition-colors"
                    onPointerDown={(e) => { e.preventDefault(); handleInput('LEFT'); }}>←</button>
                <button className="col-start-2 row-start-2 w-16 h-16 bg-white/10 backdrop-blur border border-white/30 rounded-xl flex items-center justify-center text-2xl active:bg-cyan-400 active:text-black transition-colors"
                    onPointerDown={(e) => { e.preventDefault(); handleInput('DOWN'); }}>↓</button>
                <button className="col-start-3 row-start-2 w-16 h-16 bg-white/10 backdrop-blur border border-white/30 rounded-xl flex items-center justify-center text-2xl active:bg-cyan-400 active:text-black transition-colors"
                    onPointerDown={(e) => { e.preventDefault(); handleInput('RIGHT'); }}>→</button>
            </div>
            
            <button className="absolute bottom-8 left-8 w-20 h-20 bg-yellow-400/20 border-2 border-yellow-400/50 rounded-full flex items-center justify-center text-yellow-400 font-bold backdrop-blur z-10 md:hidden active:bg-yellow-400 active:text-black active:scale-95 transition-all"
                onPointerDown={(e) => { e.preventDefault(); handleInput('SELECT'); }}>
                ACT
            </button>
        </>
    );
};

export default VirtualControls;

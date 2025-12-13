import type { EasingType } from "./utils/easing";

export type GameId = string;

export interface TweenConfig {
    duration: number;
    easing?: EasingType;
    delay?: number;
}

export interface ParticleStyle {
    count: number;
    speed: number;
    life: number;
    easing: EasingType;
    scaleStart: number;
    scaleEnd: number;
    upward?: number;
    gravity?: number;
}

export interface GameItem {
    id: string;
    type: number;
    x: number;
    y: number;
    spawnStyle?: 'elastic' | 'pop' | 'drop';
    tween?: TweenConfig;
    text?: string;
    textColor?: string;
    rotation?: { x?: number, y?: number, z?: number };
    color?: number;
    opacity?: number;
    [key: string]: any;
}

export interface GameEffect {
    type: 'EXPLODE' | 'PARTICLE' | 'AUDIO' | 'GAMEOVER' | 'RESIZE';
    x?: number;
    y?: number;
    color?: number;
    style?: string | ParticleStyle;
    name?: string;
}

export interface RenderConfig {
    geometry?: 'box' | 'cylinder' | { [key: number]: string; default?: string };
    colors: Record<number, number>;
    bgColor: number;
    shading?: 'basic' | 'standard';
    models?: Record<string, string>;
    customGeometry?: (type: number) => any;
}

export type InputType = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'SELECT';

export interface InputAction {
    type: InputType;
    data?: any;
}

// Stricter type for Web Audio API
export type OscillatorType = 'sine' | 'square' | 'sawtooth' | 'triangle';

export interface SoundEmitter {
    playTone(f: number, t: OscillatorType, d: number, v?: number): void;
    playMove(): void;
    playSelect(): void;
    playMatch(): void;
    playExplosion(): void;
    playGameOver(): void;
}

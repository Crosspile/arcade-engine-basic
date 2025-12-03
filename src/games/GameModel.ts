
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { GameItem, GameEffect, RenderConfig, InputAction, GameId, SoundEmitter } from '../types';

export abstract class GameModel {
    state$ = new BehaviorSubject<GameItem[]>([]);
    score$ = new BehaviorSubject<number>(0);
    subStat$ = new BehaviorSubject<number>(0);
    status$ = new BehaviorSubject<string>('READY');
    effects$ = new Subject<GameEffect>();
    
    score = 0;
    subStat = 0;
    highScore = 0;
    isPaused = false;
    isGameOver = false;
    level = 1;

    // Central subscription for cleanup
    protected sub = new Subscription();
    protected audio: SoundEmitter;

    constructor(public width: number, public height: number, public gameId: GameId, audio?: SoundEmitter) {
        // Fallback for games instantiated without audio in tests/legacy
        this.audio = audio || { playTone:()=>{}, playMove:()=>{}, playSelect:()=>{}, playMatch:()=>{}, playExplosion:()=>{}, playGameOver:()=>{} };

        try {
            this.highScore = parseInt(localStorage.getItem(`hs_${gameId}`) || '0');
        } catch { this.highScore = 0; }

        // Reactive High Score persistence
        this.sub.add(this.score$.subscribe(s => {
            if (s > this.highScore) {
                this.highScore = s;
                try { localStorage.setItem(`hs_${gameId}`, s.toString()); } catch {}
            }
        }));
    }

    protected uid() { return Math.random().toString(36).substr(2, 9); }

    updateScore(points: number) {
        this.score += points;
        this.score$.next(this.score);
    }

    setPaused(val: boolean) { this.isPaused = val; }

    // Centralized resize logic to ensure GameRenderer syncs correctly
    resize(width: number, height: number) {
        this.width = width;
        this.height = height;
        this.effects$.next({ type: 'RESIZE' });
    }

    abstract start(): void;
    
    stop() { 
        this.sub.unsubscribe();
        this.sub = new Subscription(); 
    }
    
    abstract handleInput(action: InputAction): void;
    abstract getRenderConfig(): RenderConfig;
}

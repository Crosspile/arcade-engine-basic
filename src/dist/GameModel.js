import { BehaviorSubject, Subject, Subscription } from "rxjs";

class GameModel {
    constructor(width, height, gameId, audio) {
        this.width = width;
        this.height = height;
        this.gameId = gameId;
        this.state$ = new BehaviorSubject([]);
        this.score$ = new BehaviorSubject(0);
        this.subStat$ = new BehaviorSubject(0);
        this.status$ = new BehaviorSubject("READY");
        this.effects$ = new Subject;
        this.score = 0;
        this.subStat = 0;
        this.highScore = 0;
        this.isPaused = false;
        this.isGameOver = false;
        this.level = 1;
        this.sub = new Subscription;
        this.audio = audio || {
            playTone: () => {},
            playMove: () => {},
            playSelect: () => {},
            playMatch: () => {},
            playExplosion: () => {},
            playGameOver: () => {}
        };
        try {
            this.highScore = parseInt(localStorage.getItem(`hs_${gameId}`) || "0");
        } catch {
            this.highScore = 0;
        }
        this.sub.add(this.score$.subscribe(s => {
            if (s > this.highScore) {
                this.highScore = s;
                try {
                    localStorage.setItem(`hs_${gameId}`, s.toString());
                } catch {}
            }
        }));
    }
    uid() {
        return Math.random().toString(36).substr(2, 9);
    }
    updateScore(points) {
        this.score += points;
        this.score$.next(this.score);
    }
    setPaused(val) {
        this.isPaused = val;
    }
    // Centralized resize logic to ensure GameRenderer syncs correctly
    resize(width, height) {
        this.width = width;
        this.height = height;
        this.effects$.next({
            type: "RESIZE"
        });
    }
    stop() {
        this.sub.unsubscribe();
        this.sub = new Subscription;
    }
}

export { GameModel as G };

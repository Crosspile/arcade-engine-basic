import { BehaviorSubject, Subject, Subscription } from "rxjs";

//#region src/games/GameModel.ts
var GameModel = class {
    state$=new BehaviorSubject([]);
    score$=new BehaviorSubject(0);
    subStat$=new BehaviorSubject(0);
    status$=new BehaviorSubject("READY");
    effects$=new Subject;
    score=0;
    subStat=0;
    highScore=0;
    isPaused=false;
    isGameOver=false;
    level=1;
    sub=new Subscription;
    audio;
    constructor(width, height, gameId, audio) {
        this.width = width;
        this.height = height;
        this.gameId = gameId;
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
};

//#endregion
export { GameModel as t };
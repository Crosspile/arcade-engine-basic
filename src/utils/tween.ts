import { Easing, EasingType } from './easing';

interface TweenTask {
    target: any;
    props: any;
    start: any;
    startTime: number;
    duration: number;
    easing: EasingType;
    resolve: () => void;
}

class TweenManager {
    tweens: TweenTask[] = [];

    to(target: any, props: any, duration: number, easing: EasingType = 'outCubic') {
        return new Promise<void>(resolve => {
            const start: any = {};
            for (const k in props) {
                start[k] = target[k] !== undefined ? target[k] : 0;
            }
            this.tweens.push({ 
                target, 
                props, 
                start, 
                startTime: Date.now(), 
                duration, 
                easing, 
                resolve 
            });
        });
    }

    update() {
        const now = Date.now();
        this.tweens = this.tweens.filter(t => {
            const el = now - t.startTime;
            let p = Math.min(1, el / t.duration);
            const fn = Easing[t.easing] || Easing.outCubic;
            let v = fn(p);
            
            for (let k in t.props) {
                t.target[k] = t.start[k] + (t.props[k] - t.start[k]) * v;
            }
            
            if (p >= 1) { 
                t.resolve(); 
                return false; 
            }
            return true;
        });
    }
}

export const TWEEN = new TweenManager();
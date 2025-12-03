
export const Easing = {
    linear: (t: number) => t,
    inQuad: (t: number) => t*t,
    outQuad: (t: number) => t*(2-t),
    inOutQuad: (t: number) => t<.5 ? 2*t*t : -1+(4-2*t)*t,
    outCubic: (t: number) => (--t)*t*t+1,
    inBack: (t: number) => {
        var s = 1.70158;
        return t*t*((s+1)*t - s);
    },
    outElastic: (t: number) => {
        var p=0.3;
        var a=1;
        if (t===0) return 0;  if ((t/=1)===1) return 1;
        var s = p/(2*Math.PI) * Math.asin (1/a);
        return a*Math.pow(2,-10*t) * Math.sin( (t*1-s)*(2*Math.PI)/p ) + 1;
    },
    outBack: (t: number) => {
        var s = 1.70158;
        return ((t=t-1)*t*((s+1)*t + s) + 1);
    },
    outExpo: (t: number) => (t===1) ? 1 : (-Math.pow(2, -10 * t) + 1),
    outCirc: (t: number) => Math.sqrt(1 - (t=t-1)*t),
    outSine: (t: number) => Math.sin(t * (Math.PI/2)),
    elastic: (t: number) => {
        var p=0.3; var a=1;
        if (t===0) return 0; if ((t/=1)===1) return 1;
        var s = p/(2*Math.PI) * Math.asin (1/a);
        return a*Math.pow(2,-10*t) * Math.sin( (t*1-s)*(2*Math.PI)/p ) + 1;
    }
};

export type EasingType = keyof typeof Easing;

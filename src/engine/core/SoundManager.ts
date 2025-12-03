
export class SoundManager {
    ctx: AudioContext | null = null;
    masterGain: GainNode | null = null;
    enabled: boolean = false;

    constructor() {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass();
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = 0.2;
                if (this.ctx) {
                   this.masterGain.connect(this.ctx.destination);
                }
            }
        } catch (e) {
            console.warn('AudioContext initialization failed', e);
        }
    }

    toggle() {
        if (!this.ctx) return false;
        
        this.enabled = !this.enabled;
        if (this.enabled && this.ctx.state === 'suspended') {
            this.ctx.resume().catch(e => console.warn('AudioContext resume failed', e));
        }
        return this.enabled;
    }

    playTone(f: number, t: OscillatorType, d: number, v: number = 1) {
        if (!this.enabled || !this.ctx || !this.masterGain) return;
        
        try {
            if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
            
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            
            o.type = t; 
            o.frequency.setValueAtTime(f, this.ctx.currentTime);
            
            g.gain.setValueAtTime(0.1 * v, this.ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + d);
            
            o.connect(g); 
            g.connect(this.masterGain); 
            
            o.start(); 
            o.stop(this.ctx.currentTime + d);
        } catch (e) {
            // Ignore audio errors
        }
    }

    playMove() { this.playTone(600, 'sine', 0.05, 0.5); }
    playSelect() { this.playTone(880, 'triangle', 0.1); }
    playMatch() { 
        this.playTone(440, 'sine', 0.2); 
        setTimeout(() => this.playTone(554, 'sine', 0.2), 50); 
        setTimeout(() => this.playTone(659, 'sine', 0.2), 100); 
    }
    playExplosion() { 
        this.playTone(150, 'sawtooth', 0.3); 
        this.playTone(100, 'square', 0.3); 
    }
    playGameOver() { 
        this.playTone(400, 'sawtooth', 0.3); 
        setTimeout(() => this.playTone(300, 'sawtooth', 0.4), 150); 
        setTimeout(() => this.playTone(200, 'sawtooth', 0.6), 300); 
    }
}

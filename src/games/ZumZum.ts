import { interval, filter } from 'rxjs';
import { GameModel } from './GameModel';
import { GameItem, InputAction, SoundEmitter } from '../types';

export class ZumZumGame extends GameModel {
    colors = [0xff595e, 0xffca3a, 0x8ac926, 0x1982c4, 0x6a4c93];
    path: { x: number, y: number }[] = [];
    chain: (GameItem & { progress: number })[] = [];
    
    cannonBubble: GameItem | null = null;
    nextBubble: GameItem | null = null;
    
    aimerAngle = 0; // Angle in degrees
    isShooting = false;
    
    private chainSpeed = 0.15;
    private spawnCounter = 0;

    constructor(audio?: SoundEmitter) {
        super(20, 15, 'zumzum', audio);
        this.generatePath();
    }

    generatePath() {
        // A simple S-shaped path
        this.path = [];
        for (let i = 0; i < 40; i++) this.path.push({ x: 1, y: 1 + i * 0.3 });
        for (let i = 0; i < 60; i++) this.path.push({ x: 1 + i * 0.3, y: 13 });
        for (let i = 0; i < 40; i++) this.path.push({ x: 19, y: 13 - i * 0.3 });
    }

    start() {
        this.isGameOver = false;
        this.isShooting = false;
        this.score = 0;
        this.score$.next(0);
        this.chain = [];
        this.spawnCounter = 0;

        // Initial chain
        for (let i = 0; i < 20; i++) {
            this.addBubbleToChain(i, true);
        }

        this.loadCannon();
        this.emit();
        this.status$.next('Clear the chain!');

        this.sub.add(
            interval(100).pipe(
                filter(() => !this.isPaused && !this.isGameOver && !this.isShooting)
            ).subscribe(() => this.tick())
        );
    }

    tick() {
        // Move existing bubbles
        this.chain.forEach(b => b.progress += this.chainSpeed);

        // Spawn new bubbles
        this.spawnCounter++;
        if (this.spawnCounter > 20 && this.chain.length < 50) {
            this.addBubbleToChain(0, false);
            this.spawnCounter = 0;
        }

        // Check for game over
        if (this.chain.length > 0 && this.chain[this.chain.length - 1].progress >= this.path.length - 1) {
            this.gameOver();
        }

        this.emit();
    }

    addBubbleToChain(progress: number, atStart: boolean) {
        const type = Math.floor(Math.random() * this.colors.length);
        const newBubble: GameItem & { progress: number } = {
            id: this.uid(),
            type,
            x: 0, y: 0, // Will be set by emit
            progress: progress,
        };
        if (atStart) {
            this.chain.push(newBubble);
        } else {
            this.chain.unshift(newBubble);
            // Push all other bubbles back to make space
            for (let i = 1; i < this.chain.length; i++) {
                this.chain[i].progress -= 2.5;
            }
        }
    }

    loadCannon() {
        const existingColors = Array.from(new Set(this.chain.map(b => b.type)));
        const type = existingColors.length > 0 ? existingColors[Math.floor(Math.random() * existingColors.length)] : 0;

        this.cannonBubble = { id: this.uid(), type, x: this.width / 2, y: this.height / 2 };
    }

    handleInput(action: InputAction) {
        if (this.isShooting || this.isGameOver) return;

        if (action.type === 'LEFT') this.aimerAngle -= 5;
        if (action.type === 'RIGHT') this.aimerAngle += 5;
        if (action.type === 'SELECT') this.fire();

        this.emit();
    }

    async fire() {
        if (!this.cannonBubble) return;
        this.isShooting = true;
        this.audio.playMove();

        const rad = this.aimerAngle * Math.PI / 180;
        const speed = 1;
        const shot = { ...this.cannonBubble, dx: Math.cos(rad) * speed, dy: Math.sin(rad) * speed };

        let hitIndex = -1;

        while (hitIndex === -1) {
            shot.x += shot.dx;
            shot.y += shot.dy;

            if (shot.x < 0 || shot.x > this.width || shot.y < 0 || shot.y > this.height) break;

            for (let i = 0; i < this.chain.length; i++) {
                const b = this.chain[i];
                const dist = Math.sqrt(Math.pow(shot.x - b.x, 2) + Math.pow(shot.y - b.y, 2));
                if (dist < 1.0) {
                    hitIndex = i;
                    break;
                }
            }
            this.state$.next([...this.getChainItems(), shot]);
            await new Promise(r => setTimeout(r, 16));
        }

        if (hitIndex !== -1) {
            const newBubble: GameItem & { progress: number } = {
                id: shot.id, type: shot.type, x: 0, y: 0,
                progress: this.chain[hitIndex].progress + 1.25
            };
            this.chain.splice(hitIndex, 0, newBubble);

            // Push back subsequent bubbles
            for (let i = hitIndex + 1; i < this.chain.length; i++) {
                this.chain[i].progress += 2.5;
            }
            this.audio.playSelect();
            await this.checkMatches(hitIndex);
        }

        this.loadCannon();
        this.isShooting = false;
        this.emit();
    }

    async checkMatches(startIndex: number) {
        const startBubble = this.chain[startIndex];
        if (!startBubble) return;

        let first = startIndex;
        let last = startIndex;

        // Find start of match
        for (let i = startIndex - 1; i >= 0; i--) {
            if (this.chain[i].type === startBubble.type) first = i; else break;
        }
        // Find end of match
        for (let i = startIndex + 1; i < this.chain.length; i++) {
            if (this.chain[i].type === startBubble.type) last = i; else break;
        }

        if (last - first + 1 >= 3) {
            const removed = this.chain.splice(first, last - first + 1);
            this.updateScore(removed.length * 10);
            this.audio.playMatch();
            
            removed.forEach(b => this.effects$.next({ type: 'EXPLODE', x: b.x, y: b.y, color: this.colors[b.type], style: 'PUFF' }));
            this.emit();
            await new Promise(r => setTimeout(r, 300));

            // Collapse chain and check for chain reaction
            if (first > 0 && first < this.chain.length && this.chain[first - 1].type === this.chain[first].type) {
                await this.checkMatches(first);
            }
        }
    }

    gameOver() {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.status$.next('GAME OVER');
        this.audio.playGameOver();
        this.effects$.next({ type: 'GAMEOVER' });
    }

    getChainItems(): GameItem[] {
        return this.chain.map(b => {
            const pathIndex = Math.min(this.path.length - 1, Math.max(0, Math.floor(b.progress)));
            const pos = this.path[pathIndex];
            b.x = pos.x;
            b.y = pos.y;
            return { id: b.id, type: b.type, x: b.x, y: b.y };
        });
    }

    emit() {
        const items = this.getChainItems();
        if (this.cannonBubble && !this.isShooting) {
            items.push(this.cannonBubble);
            
            // Aimer
            const rad = this.aimerAngle * Math.PI / 180;
            items.push({
                id: 'aimer', type: 10,
                x: this.cannonBubble.x + Math.cos(rad) * 2,
                y: this.cannonBubble.y + Math.sin(rad) * 2,
            });
        }
        this.state$.next(items);
    }

    getRenderConfig() {
        const configColors = this.colors.reduce((acc, color, i) => {
            acc[i] = color;
            return acc;
        }, {} as Record<number, number>);
        configColors[10] = 0xcccccc; // aimer color

        return {
            geometry: 'cylinder' as const,
            colors: configColors,
            bgColor: 0x1d2d50
        };
    }
}
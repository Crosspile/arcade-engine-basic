import { interval, filter } from 'rxjs';
import { GameModel } from './GameModel';
import type { SoundEmitter, InputAction } from '../engine/types';
import type { GameItem } from '../engine/types';

const GRID_WIDTH = 15;
const GRID_HEIGHT = 15;

const ALIEN_MOVE_INTERVAL_BASE = 750; // ms
const BULLET_MOVE_INTERVAL = 50; // ms
const AUTOSHOOT_INTERVAL = 250; // ms

interface Position {
    x: number;
    y: number;
}

interface Alien extends Position { id: string; }

export default class SpaceInvaders extends GameModel {
    private player: Position = { x: 0, y: 0 };
    private aliens: Alien[] = [];
    private playerBullets: Position[] = [];
    private alienBullets: Position[] = [];
    private alienBulletAccumulator: number = 0;
    private alienDirection: 'LEFT' | 'RIGHT' = 'RIGHT';
    private isShooting: boolean = false;
    private seededRandom: () => number = () => 0;

    constructor(audio?: SoundEmitter) {
        super(GRID_WIDTH, GRID_HEIGHT, 'spaceinvaders', audio);
    }

    public start(): void {
        this.level = 1;
        this.score = 0;
        this.isGameOver = false;
        this.isPaused = false;
        this.isShooting = false;
        setTimeout(() => {
            this.isShooting = true;
        }, 1000);
        this.startLevel();

        // Stop any previous game loops
        this.stop();

        // Main game loop for alien movement
        this.sub.add(
            interval(ALIEN_MOVE_INTERVAL_BASE).pipe(
                filter(() => !this.isPaused && !this.isGameOver)
            ).subscribe(() => this.updateAliens())
        );

        // Faster loop for bullet movement
        this.sub.add(
            interval(BULLET_MOVE_INTERVAL).pipe(
                filter(() => !this.isPaused && !this.isGameOver)
            ).subscribe(() => this.updateBullets())
        );

        // Autoshoot loop
        this.sub.add(
            interval(AUTOSHOOT_INTERVAL).pipe(
                filter(() => !this.isPaused && !this.isGameOver && this.isShooting)
            ).subscribe(() => this.firePlayerBullet())
        );
    }

    private startLevel(): void {
        this.player = { x: Math.floor(GRID_WIDTH / 2), y: GRID_HEIGHT - 1 };
        this.aliens = [];
        this.playerBullets = [];
        this.alienBullets = [];
        this.procedurallyGenerateLevel();
        this.status$.next(`Level ${this.level}`);
        this.emitState();
    }

    private initSeededRandom() {
        let seed = this.level * 12345;
        this.seededRandom = () => {
            const x = Math.sin(seed++) * 10000;
            return x - Math.floor(x);
        };
    }

    private procedurallyGenerateLevel(): void {
        this.initSeededRandom(); // Reset the seed for the level
        const alienRows = 3 + Math.min(this.level, 4); // 3 to 7 rows
        const alienCols = 5 + Math.min(this.level, 6); // 5 to 11 cols
        const formationStartX = Math.floor((GRID_WIDTH - alienCols) / 2);
        const startY = 1;
        const density = Math.min(0.5 + this.level * 0.05, 0.9);
        // Ensure the count is always even for perfect symmetry
        const targetAlienCount = Math.floor(alienRows * alienCols * density) & ~1;

        // Generate a symmetrical pattern with a fixed count
        const midCol = Math.ceil(alienCols / 2);
        const potentialSlots: {x: number, y: number}[] = [];
        for (let y = 0; y < alienRows; y++) {
            for (let x = 0; x < midCol; x++) {
                potentialSlots.push({x, y});
            }
        }
        potentialSlots.sort(() => this.seededRandom() - 0.5); // Shuffle slots deterministically

        while(this.aliens.length < targetAlienCount && potentialSlots.length > 0) {
            const slot = potentialSlots.pop()!;
            const leftX = formationStartX + slot.x;
            this.aliens.push({ x: leftX, y: startY + slot.y, id: this.uid() });

            const rightX = formationStartX + (alienCols - 1 - slot.x);
            if (leftX !== rightX && this.aliens.length < targetAlienCount) {
                this.aliens.push({ x: rightX, y: startY + slot.y, id: this.uid() });
            }
        }
        
        if (this.aliens.length === 0) {
            for (let x = 0; x < alienCols; x++) {
                this.aliens.push({ x: formationStartX + x, y: startY, id: this.uid() });
            }
        }
        this.alienDirection = 'RIGHT';
    }

    private updateAliens(): void {
        this.moveAliens();
        this.checkCollisions();
        this.checkWinLossConditions();
        this.emitState();
    }

    private updateBullets(): void {
        this.playerBullets = this.playerBullets.map(b => ({ ...b, y: b.y - 1 })).filter(b => b.y >= 0);

        // Slow down alien bullets by only moving them every 3rd frame (150ms)
        this.alienBulletAccumulator++;
        if (this.alienBulletAccumulator % 3 === 0) {
            this.alienBullets = this.alienBullets.map(b => ({ ...b, y: b.y + 1 })).filter(b => b.y < GRID_HEIGHT);
        }


        this.checkCollisions();
        this.emitState();
    }

    private moveAliens(): void {
        let dropDown = false;
        for (const alien of this.aliens) {
            if ((this.alienDirection === 'RIGHT' && alien.x >= GRID_WIDTH - 1) ||
                (this.alienDirection === 'LEFT' && alien.x <= 0)) {
                dropDown = true;
                break;
            }
        }

        if (dropDown) {
            this.aliens.forEach(alien => alien.y++);
            this.alienDirection = this.alienDirection === 'RIGHT' ? 'LEFT' : 'RIGHT';
        } else {
            const dx = this.alienDirection === 'RIGHT' ? 1 : -1;
            this.aliens.forEach(alien => alien.x += dx);
        }

        const maxAlienBullets = Math.min(10, 2 + this.level); // Cap at 10 bullets, increasing with level
        if (this.aliens.length > 0 && this.alienBullets.length < maxAlienBullets && this.seededRandom() < 0.2 + this.level * 0.02) {
            const randomAlien = this.aliens[Math.floor(this.seededRandom() * this.aliens.length)];
            this.alienBullets.push({ ...randomAlien, y: randomAlien.y + 1 });
            this.audio.playTone(200, 'triangle', 0.1);
        }
    }

    private checkCollisions(): void {
        const newPlayerBullets: Position[] = [];
        for (const bullet of this.playerBullets) {
            const hitAlienIndex = this.aliens.findIndex(a => a.x === bullet.x && a.y === bullet.y);
            if (hitAlienIndex !== -1) {
                this.updateScore(10);
                const alienColor = this.getRenderConfig().colors[2];
                this.effects$.next({ type: 'PARTICLE', x: bullet.x, y: GRID_HEIGHT - 1 - bullet.y, color: alienColor, style: 'PUFF' });
                this.aliens.splice(hitAlienIndex, 1);
                this.audio.playTone(800, 'square', 0.05);
            } else {
                newPlayerBullets.push(bullet);
            }
        }
        this.playerBullets = newPlayerBullets;

        const playerHit = this.alienBullets.some(b => b.x === this.player.x && b.y === this.player.y);
        if (playerHit) {
            this.endGame('GAME OVER');
        }
    }

    private checkWinLossConditions(): void {
        if (this.aliens.length === 0) {
            this.level++;
            this.audio.playMatch();
            this.startLevel();
        }

        if (this.aliens.some(a => a.y >= GRID_HEIGHT - 1)) {
            this.endGame('GAME OVER');
        }
    }

    private endGame(message: string) {
        if (this.isGameOver) return;
        this.isGameOver = true;
        this.status$.next(message);
        this.audio.playGameOver();
        this.stop();
        setTimeout(() => this.effects$.next({ type: 'GAMEOVER' }), 2000);
    }

    private emitState(): void {
        const items: GameItem[] = [];
        const invertY = (y: number) => GRID_HEIGHT - 1 - y;

        items.push({ id: 'player', type: 1, x: this.player.x, y: invertY(this.player.y) });
        this.aliens.forEach((a) => items.push({ id: a.id, type: 2, x: a.x, y: invertY(a.y) }));
        this.playerBullets.forEach((b, i) => items.push({ id: `pb_${i}`, type: 3, x: b.x, y: invertY(b.y) }));
        this.alienBullets.forEach((b, i) => items.push({ id: `ab_${i}`, type: 4, x: b.x, y: invertY(b.y) }));
        this.state$.next(items);
    }

    public handleInput(action: InputAction): void {
        if (this.isGameOver || this.isPaused) return;

        // Handle player movement
        if (action.type === 'LEFT' && this.player.x > 0) {
            this.player.x--;
            this.emitState();
        } else if (action.type === 'RIGHT' && this.player.x < GRID_WIDTH - 1) {
            this.player.x++;
            this.emitState();
        }

        // The virtual controller sends a MOVE action with direction, keyboard sends simple actions.
        // This handles both cases for firing.
        const isFireAction = (action.type === 'UP') || (action.type === 'ACTION') || (action.type === 'SELECT');

        if (isFireAction) {
             this.isShooting = !this.isShooting;
        }

    }

    private firePlayerBullet(): void {
        // if (this.playerBullets.length >= 2) return;
        this.playerBullets.push({ ...this.player, y: this.player.y - 1 });
        this.audio.playTone(440, 'sine', 0.1);
        this.emitState();
    }

    public debugAction(): void {
        this.aliens = [];
        console.log('DEBUG: All aliens cleared.');
    }

    public getRenderConfig() {
        return {
            geometry: 'box' as const,
            colors: {
                1: 0x00ff00, // Player
                2: 0xf2881f, // Alien
                3: 0x00ffff, // Player Bullet
                4: 0xffff00  // Alien Bullet
            },
            bgColor: 0x050510
        };
    }
}
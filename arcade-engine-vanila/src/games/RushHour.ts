import { GameModel } from './GameModel';
import type { GameItem, InputAction, SoundEmitter } from '../engine/types';
import * as THREE from 'three';

interface Car {
    id: string;
    x: number;
    y: number;
    len: number;
    axis: 'H' | 'V';
    color: number;
    isRed: boolean;
}

export default class RushHour extends GameModel {
    cars: Car[] = [];
    selectedCar: Car | null = null;
    cursor = { x: 0, y: 0 };

    constructor(audio?: SoundEmitter) {
        super(6, 6, 'rushhour', audio);
    }

    start() {
        this.level = 1;
        this.startLevel();
    }

    startLevel() {
        this.isGameOver = false;
        
        // Increase grid size every 3 levels (6x6 -> 7x7 -> 8x8...)
        const size = Math.min(10, 6 + Math.floor((this.level - 1) / 3));
        this.resize(size, size);
        
        this.cars = [];
        this.selectedCar = null;
        this.cursor = { x: Math.floor(size/2), y: Math.floor(size/2) };

        this.generateLevel();
        this.status$.next(`Level ${this.level}`);
        this.emit();
    }

    generateLevel() {
        const exitY = Math.floor(this.height / 2);
        const redLen = 2;

        // Unique colors palette
        const palette = [
            0x0000ff, 0x00ff00, 0xffff00, 0xff00ff, 0x00ffff, 
            0xffa500, 0x800080, 0x008000, 0x000080, 0x800000, 
            0x808000, 0x008080, 0xc0c0c0, 0xff1493, 0x7fff00
        ];

        let attempts = 0;

        // Try to generate a valid puzzle
        while(attempts < 10) {
            attempts++;
            this.cars = [];
            
            // 1. Start with Red Car at LEFT (Start position)
            this.cars.push({
                id: 'red', x: 0, y: exitY, len: redLen, axis: 'H', color: 0xff0000, isRed: true
            });

            // 2. Fill the board with cars, LEAVING MAIN LANE EMPTY
            // This guarantees the puzzle is initially solvable (trivial).
            let placeAttempts = 0;
            let failCount = 0;
            const currentPalette = [...palette].sort(() => Math.random() - 0.5);
            
            // Try to pack as many cars as possible until we fail repeatedly
            while (failCount < 50) {
                placeAttempts++;
                const axis = Math.random() > 0.5 ? 'H' : 'V';
                const len = Math.random() > 0.7 ? 3 : 2;
                const x = Math.floor(Math.random() * (this.width - (axis === 'H' ? len : 0)));
                const y = Math.floor(Math.random() * (this.height - (axis === 'V' ? len : 0)));
                
                // CONSTRAINT: Main Lane (exitY) must be empty of obstacles initially
                let overlapsMain = false;
                if (axis === 'H') {
                    if (y === exitY) overlapsMain = true;
                } else {
                    // Vertical car must not overlap exitY
                    if (y <= exitY && y + len > exitY) overlapsMain = true;
                }

                if (overlapsMain) {
                    failCount++;
                    continue;
                }

                if (this.checkCollision(x, y, len, axis, null)) {
                    failCount++;
                    continue;
                }
                
                this.cars.push({
                    id: `c_${this.cars.length}`,
                    x, y, len, axis,
                    color: currentPalette[this.cars.length % currentPalette.length] || Math.floor(Math.random() * 0xffffff),
                    isRed: false
                });
                failCount = 0; // Reset fail count on success
            }

            // 3. Shuffle (Complicate the puzzle)
            // Since we started with a clear path, any state reached by valid moves is solvable.
            let currentCars = JSON.parse(JSON.stringify(this.cars));
            let bestState: Car[] = [];
            
            const moves = 2000 + (this.level * 500);
            
            for(let i=0; i<moves; i++) {
                const carIdx = Math.floor(Math.random() * currentCars.length);
                const car = currentCars[carIdx];
                const dir = Math.random() > 0.5 ? 1 : -1;
                
                // Apply move locally
                let moved = false;
                if (car.axis === 'H') {
                    if (!this.checkCollision(car.x + dir, car.y, car.len, car.axis, car, currentCars)) {
                        car.x += dir;
                        moved = true;
                    }
                } else {
                    if (!this.checkCollision(car.x, car.y + dir, car.len, car.axis, car, currentCars)) {
                        car.y += dir;
                        moved = true;
                    }
                }

                if (moved) {
                    // We want a state where Red is at the start (x=0) but the board is scrambled.
                    // We continuously update bestState whenever we hit a valid start configuration.
                    // This ensures we get the "deepest" shuffle that still respects the start condition.
                    if (currentCars[0].x === 0) {
                        bestState = JSON.parse(JSON.stringify(currentCars));
                    }
                }
            }
            
            if (bestState.length > 0) {
                this.cars = bestState;
                break;
            }
        }
    }

    checkCollision(x: number, y: number, len: number, axis: 'H'|'V', ignoreCar: Car | null, carList: Car[] = this.cars) {
        // Bounds
        if (x < 0 || y < 0) return true;
        if (axis === 'H' && x + len > this.width) return true;
        if (axis === 'V' && y + len > this.height) return true;

        // Overlap
        for (const c of carList) {
            if (c.id === ignoreCar?.id) continue;
            
            // Check intersection of segments
            for(let i=0; i<len; i++) {
                const cx = axis === 'H' ? x + i : x;
                const cy = axis === 'V' ? y + i : y;
                
                if (c.axis === 'H') {
                    if (cy === c.y && cx >= c.x && cx < c.x + c.len) return true;
                } else {
                    if (cx === c.x && cy >= c.y && cy < c.y + c.len) return true;
                }
            }
        }
        return false;
    }

    handleInput(action: InputAction) {
        if (this.isGameOver) return;

        // Cursor Movement
        if (action.type === 'UP' && !this.selectedCar) this.cursor.y = Math.min(this.height-1, this.cursor.y + 1);
        if (action.type === 'DOWN' && !this.selectedCar) this.cursor.y = Math.max(0, this.cursor.y - 1);
        if (action.type === 'LEFT' && !this.selectedCar) this.cursor.x = Math.max(0, this.cursor.x - 1);
        if (action.type === 'RIGHT' && !this.selectedCar) this.cursor.x = Math.min(this.width-1, this.cursor.x + 1);

        if (action.type === 'SELECT') {
            if (this.selectedCar) {
                this.selectedCar = null;
                this.audio.playSelect();
            } else {
                const car = this.getCarAt(this.cursor.x, this.cursor.y);
                if (car) {
                    this.selectedCar = car;
                    this.audio.playSelect();
                }
            }
        }

        // Move Selected Car
        if (this.selectedCar) {
            let dx = 0, dy = 0;
            if (action.type === 'UP') dy = 1;
            if (action.type === 'DOWN') dy = -1;
            if (action.type === 'LEFT') dx = -1;
            if (action.type === 'RIGHT') dx = 1;

            if (dx !== 0 || dy !== 0) {
                if (this.selectedCar.axis === 'H' && dy !== 0) return;
                if (this.selectedCar.axis === 'V' && dx !== 0) return;

                const nx = this.selectedCar.x + dx;
                const ny = this.selectedCar.y + dy;

                if (!this.checkCollision(nx, ny, this.selectedCar.len, this.selectedCar.axis, this.selectedCar)) {
                    this.selectedCar.x = nx;
                    this.selectedCar.y = ny;
                    this.cursor.x += dx;
                    this.cursor.y += dy;
                    this.audio.playMove();
                    this.checkWin();
                } else {
                    this.audio.playTone(150, 'sawtooth', 0.1);
                }
            }
        }
        this.emit();
    }

    getCarAt(x: number, y: number) {
        for (const c of this.cars) {
            if (c.axis === 'H') {
                if (y === c.y && x >= c.x && x < c.x + c.len) return c;
            } else {
                if (x === c.x && y >= c.y && y < c.y + c.len) return c;
            }
        }
        return null;
    }

    checkWin() {
        const red = this.cars[0]; // Red is always first
        if (red.x === this.width - red.len) {
             this.handleWin();
        }
    }

    handleWin() {
        this.status$.next('ESCAPED!');
        this.updateScore(1000);
        this.audio.playMatch();
        this.effects$.next({ type: 'EXPLODE', x: this.width-1, y: Math.floor(this.height/2), color: 0xff0000, style: 'EXPLODE' });
        setTimeout(() => {
            this.level++;
            this.startLevel();
        }, 2000);
    }

    emit() {
        const items: GameItem[] = [];
        
        // Board floor
        for(let x=0; x<this.width; x++) for(let y=0; y<this.height; y++) {
            items.push({ id: `f_${x}_${y}`, x, y, type: 0 });
        }
        
        // Exit Marker
        const exitY = Math.floor(this.height / 2);
        items.push({ id: 'exit', x: this.width, y: exitY, type: 3 });

        // Cars
        for (const c of this.cars) {
            const isSel = this.selectedCar === c;
            for(let i=0; i<c.len; i++) {
                const cx = c.axis === 'H' ? c.x + i : c.x;
                const cy = c.axis === 'V' ? c.y + i : c.y;
                items.push({
                    id: `${c.id}_${i}`,
                    x: cx,
                    y: cy,
                    type: c.isRed ? 1 : 2,
                    color: isSel ? 0xffffff : (c.isRed ? 0xff0000 : c.color)
                });
            }
        }
        
        // Cursor
        if (!this.selectedCar) {
            items.push({ id: 'cursor', x: this.cursor.x, y: this.cursor.y, type: 4, scale: 0.5 });
        }

        this.state$.next(items);
    }

    getRenderConfig() {
        return {
            geometry: 'box' as const,
            colors: {
                0: 0x222222, // Floor
                1: 0xff0000, // Red Car
                2: 0x0000ff, // Other Car (overridden)
                3: 0x00ff00, // Exit
                4: 0xffffff  // Cursor
            },
            bgColor: 0x111111,
            customGeometry: (type: number) => {
                if (type === 3) {
                    // Exit Marker as a ramp
                    const geom = new THREE.BoxGeometry(1, 0.2, 1);
                    geom.translate(0, 0, 0.5);
                    return geom;
                }
                if (type === 4) {
                    const geom = new THREE.BoxGeometry(1, 1, 1);
                    geom.translate(0, 0, 2.0);
                    return geom;
                }
            }
        }
    }
}
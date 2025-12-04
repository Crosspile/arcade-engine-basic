
import * as THREE from 'three';
import { Subscription, filter } from 'rxjs';
import { TWEEN } from '../../utils/tween';
import { InputManager } from './InputManager';
import { GAME_IDS } from '../../games/GameRegistry';
import { MenuContext } from './MenuContext';
import { SoundEmitter } from '../../types';

export interface MenuCallbacks {
    onSwitchGame: (id: string) => void;
    onRestart: () => void;
    onMenuStateChange: (isOpen: boolean) => void;
    onStatsUpdate: () => void;
}

export interface MenuItem { text: string; action: string; dynamic?: boolean; }

const HUD_MARGIN_X = 0.5;
const HUD_MARGIN_Y = 0.5; 
const UI_Z_DISTANCE = -8; // <<< CHANGED: Brought UI closer to the camera

export class Menu3D {
    static sharedGeometry: THREE.PlaneGeometry | null = null;

    camera: THREE.Camera;
    group = new THREE.Group();
    hudGroup = new THREE.Group();
    visible = false;
    items: THREE.Mesh[] = [];
    selectedIndex = 0;
    menuStack: string[] = [];
    currentMenuId = 'main';
    subs: Subscription[] = [];
    menus: Map<string, MenuItem[]> = new Map();
    audio: SoundEmitter;

    private visibleHeight: number = 10; // A safe default

    // HUD Elements
    scoreLabel: THREE.Mesh | null = null;
    statusLabel: THREE.Mesh | null = null;
    highScoreLabel: THREE.Mesh | null = null;

    constructor(camera: THREE.Camera, inputManager: InputManager, public renderer: MenuContext, public callbacks: MenuCallbacks, audio: SoundEmitter) {
        if (!Menu3D.sharedGeometry) {
            Menu3D.sharedGeometry = new THREE.PlaneGeometry(4, 1);
        }

        this.camera = camera;
        this.camera.add(this.group);
        this.camera.add(this.hudGroup);
        this.audio = audio;
        
        this.group.position.z = UI_Z_DISTANCE;
        this.hudGroup.position.z = UI_Z_DISTANCE;
        this.group.visible = false;

        this.registerMenu('main', [
            { text: 'PLAY GAMES', action: 'goto:games' },
            { text: 'OPTIONS', action: 'goto:options' },
            { text: 'CLOSE', action: 'close' }
        ]);
        
        const gameItems: MenuItem[] = GAME_IDS.map(id => ({ text: id.toUpperCase(), action: `game:${id}` }));
        gameItems.push({ text: 'BACK', action: 'back' });
        this.registerMenu('games', gameItems);

        this.registerMenu('options', [
            { text: 'SOUND: ON', action: 'toggle:sound', dynamic: true },
            { text: 'VIEW: 3D', action: 'toggle:view', dynamic: true },
            { text: 'BACK', action: 'back' }
        ]);
        this.registerMenu('gameover', [
            { text: 'TRY AGAIN', action: 'restart' },
            { text: 'MAIN MENU', action: 'goto:main' }
        ]);

        this.subs.push(inputManager.action$.pipe(filter(() => this.visible && this.items.length > 0)).subscribe(action => {
            if (action.type === 'UP') this.select(this.selectedIndex - 1);
            else if (action.type === 'DOWN') this.select(this.selectedIndex + 1);
            else if (action.type === 'LEFT' && this.menuStack.length > 0) this.goBack();
            else if (action.type === 'SELECT' || action.type === 'RIGHT') {
                if (action.data && action.data.raycaster) {
                    const hits = action.data.raycaster.intersectObjects(this.group.children);
                    if (hits.length > 0) {
                        const hitMesh = hits[0].object;
                        const idx = this.items.indexOf(hitMesh as THREE.Mesh);
                        if (idx !== -1) {
                            if (idx !== this.selectedIndex) {
                                this.select(idx);
                            } else {
                                this.trigger();
                            }
                        }
                    }
                } else {
                    this.trigger();
                }
            }
        }));
        
        this.initHUD();
    }

    setCamera(newCamera: THREE.Camera) {
        this.camera.remove(this.group);
        this.camera.remove(this.hudGroup);
        this.camera = newCamera;
        this.camera.add(this.group);
        this.camera.add(this.hudGroup);
    }

    initHUD() {
        this.scoreLabel = this.createHUDMesh("SCORE: 0", 0xffff00);
        this.hudGroup.add(this.scoreLabel);
        
        this.statusLabel = this.createHUDMesh("READY", 0xffffff, 0.5);
        this.hudGroup.add(this.statusLabel);

        this.highScoreLabel = this.createHUDMesh("BEST: 0", 0xaaaaaa, 0.4);
        this.hudGroup.add(this.highScoreLabel);
    }

    createHUDMesh(text: string, color: number, scale: number = 0.6) {
        const mesh = this.createMesh(text, 0, true);
        mesh.scale.set(scale, scale, scale);
        (mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
        mesh.raycast = () => {}; 
        return mesh;
    }

    updateHUDText(mesh: THREE.Mesh | null, text: string) {
        if (!mesh) return;
        const canvas = (mesh.material as any).map.image;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#00000000'; 
            ctx.clearRect(0,0,512,128);
            
            ctx.shadowColor = "black";
            ctx.shadowBlur = 4;
            ctx.fillStyle = '#ffffff'; 
            ctx.font = 'bold 80px ui-sans-serif, system-ui, sans-serif'; 
            ctx.textAlign = 'center'; 
            ctx.textBaseline = 'middle'; 
            ctx.fillText(text, 256, 64);
        }
        (mesh.material as any).map.needsUpdate = true;
    }

    updateScore(score: number) { this.updateHUDText(this.scoreLabel, `SCORE: ${score}`); }
    updateHighScore(score: number) { this.updateHUDText(this.highScoreLabel, `BEST: ${score}`); }
    updateStatus(status: string) { this.updateHUDText(this.statusLabel, status); }

    layoutHUD(width: number, height: number) {
        if (!width || !height || isNaN(width) || isNaN(height)) return;
        
        this.visibleHeight = height;

        const halfW = width / 2;
        const halfH = height / 2;

        if (this.scoreLabel) {
            this.scoreLabel.position.set(-halfW + HUD_MARGIN_X + (this.scoreLabel.scale.x * 2), halfH - HUD_MARGIN_Y - (this.scoreLabel.scale.y * 0.5), 0);
        }
        if (this.highScoreLabel) {
            this.highScoreLabel.position.set(halfW - HUD_MARGIN_X - (this.highScoreLabel.scale.x * 2), halfH - HUD_MARGIN_Y - (this.highScoreLabel.scale.y * 0.5), 0);
        }
        if (this.statusLabel) {
            this.statusLabel.position.set(0, -halfH + HUD_MARGIN_Y + (this.statusLabel.scale.y * 0.5), 0);
        }
    }

    registerMenu(id: string, items: MenuItem[]) { this.menus.set(id, items); }

    createMesh(text: string, index: number, isTransparent: boolean = false) {
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            if (!isTransparent) {
                ctx.fillStyle = '#002456'; ctx.fillRect(0, 0, 512, 128);
                ctx.strokeStyle = '#4dc9ff'; ctx.lineWidth = 10; ctx.strokeRect(5, 5, 502, 118);
            }
            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 60px ui-sans-serif, system-ui, sans-serif'; 
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 256, 64);
        }
        
        const material = new THREE.MeshBasicMaterial({ 
            map: new THREE.CanvasTexture(canvas), 
            transparent: true, 
            opacity: isTransparent ? 1 : 0.9,
            depthTest: false // <<< FIX: Disable depth testing to ensure UI is always visible
        });

        const mesh = new THREE.Mesh(Menu3D.sharedGeometry!, material);
        mesh.renderOrder = 1; // <<< FIX: Ensure UI renders on top of the game scene
        return mesh;
    }

    open(menuId: string) {
        this.visible = true; this.group.visible = true; this.menuStack = [];
        this.clearItems();
        this.renderMenu(menuId);
        
        this.group.scale.set(0.1, 0.1, 0.1);
        TWEEN.to(this.group.scale, { x: 1, y: 1, z: 1 }, 400, 'outBack');
        
        this.callbacks.onMenuStateChange(true);
        if (this.renderer.activeGame) this.renderer.activeGame.setPaused(true);
    }

    close() {
        this.visible = false; this.group.visible = false; this.menuStack = [];
        this.callbacks.onMenuStateChange(false);
        if (this.renderer.activeGame) this.renderer.activeGame.setPaused(false);
    }

    renderMenu(menuId: string) {
        this.currentMenuId = menuId;
        const data = this.menus.get(menuId);
        if (!data) return;
        
        this.clearItems();
        data.forEach((item, i) => {
            let txt = item.text;
            if (item.action === 'toggle:sound') txt = (this.audio as any).enabled ? 'SOUND: ON' : 'SOUND: OFF';
            if (item.action === 'toggle:view') txt = this.renderer.isOrtho ? 'VIEW: 2D' : 'VIEW: 3D';
            const mesh = this.createMesh(txt, i);
            mesh.userData = { action: item.action };
            this.group.add(mesh);
            this.items.push(mesh);
        });
        
        this.select(0);
    }

    clearItems() {
        this.items.forEach(m => { 
            this.group.remove(m); 
            if ((m.material as any).map) (m.material as any).map.dispose(); 
            (m.material as any).dispose(); 
        });
        this.items = [];
    }

    showGameOver() { this.open('gameover'); }
    toggle() { this.visible ? this.close() : this.open('main'); }

    select(index: number) {
        if (!this.items.length) return;
        this.selectedIndex = (index + this.items.length) % this.items.length;
        this.audio.playMove();

        const halfVisibleHeight = this.visibleHeight / 2;

        this.items.forEach((m, i) => {
            const mat = m.material as THREE.MeshBasicMaterial;
            const diff = i - this.selectedIndex;
            
            const targetY = diff * -1.2;
            const targetZ = Math.abs(diff) * -0.5;
            const targetRotX = diff * 0.1;
            
            const isSelected = i === this.selectedIndex;
            const targetScale = isSelected ? 1.3 : 1.0;
            const targetOpacity = Math.max(0.2, 1 - Math.abs(diff) * 0.3);
            
            // Virtual Scrolling: Hide items that are too far off-screen
            const itemHeight = 1.0 * targetScale; // Use the mesh's scaled height
            const topEdge = targetY + itemHeight / 2;
            const bottomEdge = targetY - itemHeight / 2;

            // Use a small buffer to prevent items from popping in/out at the very edge
            const buffer = 0.5;
            if (topEdge < -halfVisibleHeight - buffer || bottomEdge > halfVisibleHeight + buffer) {
                m.visible = false;
            } else {
                m.visible = true;
            }

            if (isSelected) {
                mat.color.setHex(0x4dc9ff);
            } else {
                mat.color.setHex(0xffffff);
            }
            
            mat.opacity = targetOpacity;

            TWEEN.to(m.position, { x: 0, y: targetY, z: targetZ }, 300, 'outCubic');
            TWEEN.to(m.scale, { x: targetScale, y: targetScale, z: targetScale }, 300, 'outCubic');
            TWEEN.to(m.rotation, { x: targetRotX, y: 0, z: 0 }, 300, 'outCubic');
        });
    }

    trigger() {
        if (!this.items[this.selectedIndex]) return;
        const act = this.items[this.selectedIndex].userData.action;
        this.audio.playSelect();
        if (act.startsWith('goto:')) { this.menuStack.push(this.currentMenuId); this.renderMenu(act.split(':')[1]); }
        else if (act === 'back') this.goBack();
        else if (act.startsWith('game:')) { this.callbacks.onSwitchGame(act.split(':')[1]); this.close(); }
        else if (act === 'close') this.close();
        else if (act === 'restart') { this.callbacks.onRestart(); this.close(); }
        else if (act === 'toggle:sound') { (this.audio as any).toggle(); this.renderMenu(this.currentMenuId); }
        else if (act === 'toggle:view') { this.renderer.toggleCamera(); this.renderMenu(this.currentMenuId); }
    }

    goBack() { if (this.menuStack.length) this.renderMenu(this.menuStack.pop()!); }
    
    destroy() { 
        this.subs.forEach(s => s.unsubscribe()); 
        this.clearItems(); 
    }
}

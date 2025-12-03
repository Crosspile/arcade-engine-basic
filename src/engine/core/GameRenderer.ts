
import * as THREE from 'three';
import { Subscription } from 'rxjs';
import { GameModel } from '../../games/GameModel';
import { ParticleManager } from './ParticleManager';
import { TWEEN } from '../../utils/tween';
import { InputManager } from './InputManager';
import { GameItem, SoundEmitter } from '../../types';
import { Menu3D, MenuCallbacks } from './Menu3D';
import { MenuContext } from './MenuContext';

export class GameRenderer implements MenuContext {
    scene: THREE.Scene;
    camera: THREE.Camera;
    renderer: THREE.WebGLRenderer;
    perspCam: THREE.PerspectiveCamera;
    orthoCam: THREE.OrthographicCamera;
    activeCamera: THREE.Camera;
    externalCamera: THREE.Camera | null = null;
    
    group: THREE.Group;
    meshes: Map<string, THREE.Mesh>;
    textureCache: Map<string, THREE.CanvasTexture>;
    particles: ParticleManager;
    menu: Menu3D;
    gridHelper: THREE.GridHelper;
    cameraHelper: THREE.CameraHelper;
    
    inputManager: InputManager;
    activeGame: GameModel | null = null;
    
    shake: number = 0;
    isOrtho: boolean = false;
    
    requestRef: number = 0;
    renderConfig: any;
    
    private audio: SoundEmitter;
    private subs: Subscription[] = [];
    private updateHooks: (() => void)[] = [];
    
    constructor(container: HTMLElement, inputManager: InputManager, callbacks: MenuCallbacks, audio: SoundEmitter) {
        this.inputManager = inputManager;
        this.audio = audio;
        
        // Setup Three.js
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);
        
        // Cameras
        const width = container.clientWidth || 1;
        const height = container.clientHeight || 1;
        const aspect = width / height;
        
        this.perspCam = new THREE.PerspectiveCamera(60, aspect, 0.1, 100);
        this.orthoCam = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.1, 100);
        
        this.activeCamera = this.perspCam;
        this.camera = this.perspCam; // Alias

        // Critical for scene viewer: Add cameras to the scene so they can be viewed by other cameras.
        this.scene.add(this.perspCam);
        this.scene.add(this.orthoCam);
        
        // Lights
        const light = new THREE.DirectionalLight(0xffffff, 0.8);
        light.position.set(5, 10, 10);
        this.scene.add(light);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
        
        this.group = new THREE.Group();
        this.scene.add(this.group);
        
        // Add GridHelper and CameraHelper for debug view
        this.gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
        this.gridHelper.visible = false;
        this.scene.add(this.gridHelper);

        this.cameraHelper = new THREE.CameraHelper(this.activeCamera);
        this.cameraHelper.visible = false;
        this.scene.add(this.cameraHelper);

        this.meshes = new Map();
        this.textureCache = new Map();
        this.particles = new ParticleManager(this.scene);

        // Menu is now parented to the camera for consistent scale
        this.menu = new Menu3D(this.activeCamera, inputManager, this, callbacks, this.audio);
        
        // Start Loop
        this.animate = this.animate.bind(this);
        this.animate();
        
        // Resize observer
        this.onResize = this.onResize.bind(this);
        window.addEventListener('resize', this.onResize);
    }
    
    addUpdateHook(fn: () => void) {
        this.updateHooks.push(fn);
    }

    setExternalCamera(cam: THREE.Camera | null) {
        this.externalCamera = cam;
        // Toggle helpers with debug camera
        this.gridHelper.visible = !!cam;
        this.cameraHelper.visible = !!cam;
    }
    
    setGame(game: GameModel) {
        // Unsubscribe from previous game
        this.subs.forEach(s => s.unsubscribe());
        this.subs = [];
        
        // Clear meshes with disposal
        this.meshes.forEach(m => {
            this.group.remove(m);
            this.disposeMesh(m);
        });
        this.meshes.clear();
        this.textureCache.forEach(t => t.dispose());
        this.textureCache.clear();
        
        this.activeGame = game;
        this.renderConfig = game.getRenderConfig();
        this.scene.background = new THREE.Color(this.renderConfig.bgColor);
        
        this.syncCamera();
        
        // Initial HUD state
        this.menu.updateScore(game.score);
        this.menu.updateHighScore(game.highScore);
        this.menu.updateStatus('READY');
        this.menu.callbacks.onStatsUpdate(); 
        
        // Subscriptions
        this.subs.push(game.state$.subscribe(items => this.sync(items)));
        
        this.subs.push(game.score$.subscribe(s => {
            this.menu.updateScore(s);
            this.menu.callbacks.onStatsUpdate();
        }));
        
        this.subs.push(game.status$.subscribe(s => {
            this.menu.updateStatus(s);
            this.menu.callbacks.onStatsUpdate();
            if (s === 'GAME OVER') {
                this.menu.showGameOver();
            }
        }));

        this.subs.push(game.subStat$.subscribe(() => {
            this.menu.callbacks.onStatsUpdate();
        }));
        
        this.subs.push(game.effects$.subscribe(e => {
            if (!this.activeGame) return;
            
            if (e.type === 'GAMEOVER') {
                this.menu.showGameOver();
                return;
            }

            if (e.type === 'RESIZE') {
                this.syncCamera();
                return;
            }

            const tileSize = 1.1;
            const offsetX = (this.activeGame.width * tileSize) / 2 - 0.5;
            const offsetY = (this.activeGame.height * tileSize) / 2 - 0.5;
            
            if (e.type === 'EXPLODE' || e.type === 'PARTICLE') {
                const tx = (e.x || 0) * tileSize - offsetX;
                const ty = (e.y || 0) * tileSize - offsetY;
                this.particles.spawn(tx, ty, e.color || 0xffffff, e.style);
                if (e.type === 'EXPLODE') this.audio.playExplosion();
            } else if (e.type === 'AUDIO') {
                if (e.name === 'SELECT') this.audio.playSelect();
                else if (e.name === 'MOVE') this.audio.playMove();
                else if (e.name === 'MATCH') this.audio.playMatch();
                else if (e.name === 'GAMEOVER') this.audio.playGameOver();
                else if (e.name === 'EXPLOSION') this.audio.playExplosion();
            }
        }));
    }
    
    toggleCamera() {
        if (this.externalCamera) return this.isOrtho; 
        this.isOrtho = !this.isOrtho;
        this.activeCamera = this.isOrtho ? this.orthoCam : this.perspCam;
        
        // Update menu parenting and camera helper
        this.menu.setCamera(this.activeCamera);
        this.cameraHelper.camera = this.activeCamera;
        
        this.syncCamera();
        return this.isOrtho;
    }

    toggleMenu() {
        this.menu.toggle();
    }
    
    syncCamera() {
        if (!this.activeGame) return;
        
        const w = this.activeGame.width;
        const h = this.activeGame.height;
        const maxDim = Math.max(w, h);
        const aspect = window.innerWidth / window.innerHeight;

        // Step 1: Configure the active camera and scale the game group
        if (this.isOrtho) {
            this._setupOrthoCamera(w, h, aspect);
        } else {
            this._setupPerspCamera(maxDim, aspect);
        }

        // Step 2: Layout the HUD based on the final camera's visible area
        const { visibleWidth, visibleHeight } = this._getUIVisibleBounds(this.activeCamera);
        this.menu.layoutHUD(visibleWidth, visibleHeight);
    }

    private _setupOrthoCamera(gameWidth: number, gameHeight: number, aspect: number) {
        // Use a fixed orthographic view height for consistent UI scale
        const ORTHO_VIEW_HEIGHT = 12;

        this.orthoCam.top = ORTHO_VIEW_HEIGHT / 2;
        this.orthoCam.bottom = -ORTHO_VIEW_HEIGHT / 2;
        this.orthoCam.left = -ORTHO_VIEW_HEIGHT / 2 * aspect;
        this.orthoCam.right = ORTHO_VIEW_HEIGHT / 2 * aspect;
        this.orthoCam.position.set(0, 0, 10);
        this.orthoCam.lookAt(0, 0, 0);
        this.orthoCam.updateProjectionMatrix();

        // Calculate the scale needed to fit the game board into the fixed view
        const TILE_SIZE = 1.1; // As used in sync()
        const gameWorldHeight = gameHeight * TILE_SIZE;
        const gameWorldWidth = gameWidth * TILE_SIZE;
        
        const availableHeight = ORTHO_VIEW_HEIGHT * 0.9; // Use 90% of view for padding
        const availableWidth = (ORTHO_VIEW_HEIGHT * aspect) * 0.9;
        
        const scaleY = gameWorldHeight > 0 ? availableHeight / gameWorldHeight : 1;
        const scaleX = gameWorldWidth > 0 ? availableWidth / gameWorldWidth : 1;
        
        const scale = Math.min(scaleX, scaleY);
        this.group.scale.set(scale, scale, scale);
    }

    private _setupPerspCamera(maxDim: number, aspect: number) {
        this.group.scale.set(1, 1, 1);
        this.perspCam.aspect = aspect;
        const distance = maxDim * 2.0; 
        this.perspCam.position.set(0, 0, distance);
        this.perspCam.lookAt(0, 0, 0);
        this.perspCam.updateProjectionMatrix();
    }

    private _getUIVisibleBounds(camera: THREE.Camera, distance: number = 8) {
        const aspect = window.innerWidth / window.innerHeight;
        if (camera instanceof THREE.PerspectiveCamera) {
            const vFOV = THREE.MathUtils.degToRad(camera.fov);
            const visibleHeight = 2 * Math.tan(vFOV / 2) * Math.abs(distance);
            return { visibleWidth: visibleHeight * camera.aspect, visibleHeight };
        } else if (camera instanceof THREE.OrthographicCamera) {
            return { visibleWidth: camera.right - camera.left, visibleHeight: camera.top - camera.bottom };
        }
        // Fallback
        return { visibleWidth: 10 * aspect, visibleHeight: 10 };
    }
    
    createLabelTexture(text: string, bgColor: number, textColor: string = '#ffffff') {
        const key = `${text}_${bgColor}_${textColor}`;
        if (this.textureCache.has(key)) return this.textureCache.get(key);

        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const bgHex = '#' + bgColor.toString(16).padStart(6, '0');
            ctx.fillStyle = bgHex;
            ctx.fillRect(0, 0, 128, 128);
            
            ctx.font = 'bold 80px sans-serif';
            ctx.fillStyle = textColor;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, 64, 64);
            
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 4;
            ctx.strokeRect(2, 2, 124, 124);
        }
        const tex = new THREE.CanvasTexture(canvas);
        this.textureCache.set(key, tex);
        return tex;
    }

    sync(items: GameItem[]) {
        if (!this.activeGame) return;
        
        const activeIds = new Set<string>();
        const tileSize = 1.1;
        const offsetX = (this.activeGame.width * tileSize) / 2 - 0.5;
        const offsetY = (this.activeGame.height * tileSize) / 2 - 0.5;

        items.forEach(item => {
            activeIds.add(item.id);
            let mesh = this.meshes.get(item.id);
            const tx = item.x * tileSize - offsetX;
            const ty = item.y * tileSize - offsetY;
            
            const zOffset = (item.type === 0) ? -0.1 : 0;
            const color = this.renderConfig.colors[item.type] || 0xffffff;

            if (!mesh) {
                let geom;
                if (this.renderConfig.geometry === 'cylinder') geom = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32);
                else geom = new THREE.BoxGeometry(0.9, 0.9, 0.9);
                
                if (this.renderConfig.geometry === 'cylinder') geom.rotateX(Math.PI / 2);
                
                const mat = new THREE.MeshBasicMaterial({ color });
                mesh = new THREE.Mesh(geom, mat);
                this.group.add(mesh);
                this.meshes.set(item.id, mesh);

                if (item.spawnStyle === 'instant') {
                    mesh.position.set(tx, ty, zOffset);
                } else if (item.spawnStyle === 'pop') {
                    mesh.position.set(tx, ty, zOffset);
                    mesh.scale.set(0, 0, 0);
                    TWEEN.to(mesh.scale, { x: 1, y: 1, z: 1 }, 200, 'outBack');
                } else {
                    mesh.position.set(tx, ty + 10, zOffset);
                    TWEEN.to(mesh.position, { x: tx, y: ty }, 400, 'elastic');
                }
            } else {
                const mat = mesh.material as THREE.MeshBasicMaterial;
                
                if (item.text !== undefined) {
                    const tex = this.createLabelTexture(item.text, color, item.textColor);
                    if (mat.map !== tex) {
                        mat.map = tex || null;
                        mat.color.setHex(0xffffff);
                        mat.needsUpdate = true;
                    }
                } else {
                    if (mat.map) {
                        mat.map = null;
                        mat.needsUpdate = true;
                    }
                    mat.color.setHex(color);
                }

                if (Math.abs(mesh.position.x - tx) > 0.01 || Math.abs(mesh.position.y - ty) > 0.01 || mesh.position.z !== zOffset) {
                    TWEEN.to(mesh.position, { x: tx, y: ty, z: zOffset }, 150);
                }
            }
        });

        this.meshes.forEach((m, id) => {
            if (!activeIds.has(id)) {
                this.group.remove(m);
                this.disposeMesh(m);
                this.meshes.delete(id);
            }
        });
    }

    disposeMesh(m: THREE.Mesh) {
        if (m.geometry) m.geometry.dispose();
        if (Array.isArray(m.material)) {
            m.material.forEach(mat => mat.dispose());
        } else if (m.material) {
            (m.material as THREE.Material).dispose();
        }
    }
    
    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.renderer.setSize(width, height);
        
        const aspect = height > 0 ? width / height : 1;
        this.perspCam.aspect = aspect;
        this.perspCam.updateProjectionMatrix();
        
        this.orthoCam.left = this.orthoCam.bottom * aspect;
        this.orthoCam.right = this.orthoCam.top * aspect;
        this.orthoCam.updateProjectionMatrix();

        if (this.activeGame) this.syncCamera();
    }
    
    animate() {
        this.requestRef = requestAnimationFrame(this.animate);
        TWEEN.update();
        this.particles.update();
        
        this.updateHooks.forEach(hook => hook());
        
        const currentCam = this.externalCamera || this.activeCamera;

        if (!this.externalCamera) {
            if (this.shake > 0) {
                const shakeIntensity = 0.2 * this.shake;
                this.activeCamera.position.x += (Math.random() - 0.5) * shakeIntensity;
                this.activeCamera.position.y += (Math.random() - 0.5) * shakeIntensity;
                this.shake *= 0.9;
                if (this.shake < 0.01) {
                    this.shake = 0;
                    if (this.activeGame) this.syncCamera();
                }
            }
        }

        if (this.cameraHelper.visible) {
            this.cameraHelper.update();
        }
        
        this.renderer.render(this.scene, currentCam);
    }
    
    getGridFromRay(raycaster: THREE.Raycaster) {
        if (!this.activeGame) return null;
        const intersects = raycaster.intersectObjects(this.group.children);
        if (intersects.length > 0) {
            const tileSize = 1.1;
            const offsetX = (this.activeGame.width * tileSize) / 2 - 0.5;
            const offsetY = (this.activeGame.height * tileSize) / 2 - 0.5;
            
            // Account for group scale
            const hitPoint = intersects[0].point.clone().divide(this.group.scale);

            const gx = Math.round((hitPoint.x + offsetX) / tileSize);
            const gy = Math.round((hitPoint.y + offsetY) / tileSize);
            return { x: gx, y: gy };
        }
        return null;
    }

    destroy() {
        window.removeEventListener('resize', this.onResize);
        cancelAnimationFrame(this.requestRef);
        this.subs.forEach(s => s.unsubscribe());
        
        this.menu.destroy();
        
        this.meshes.forEach(m => {
            this.disposeMesh(m);
        });
        this.textureCache.forEach(t => t.dispose());
        
        this.renderer.dispose();
        
        if (this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
    }
}

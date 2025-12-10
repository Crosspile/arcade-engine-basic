
import * as THREE from 'three';
import { Subscription, interval } from 'rxjs';
import { GameModel } from '../../games/GameModel';
import { SceneEntityManager } from './SceneEntityManager';
import { PostProcessor } from './PostProcessor';
import { ParticleManager } from './ParticleManager';
import { InputManager } from './InputManager';
import { Menu3D, type MenuCallbacks } from './Menu3D';
import type { MenuContext } from './MenuContext';
import type { GameItem, SoundEmitter } from '../types';
import { TWEEN } from '../utils/tween';
import { Clock } from 'three';


export class GameRenderer implements MenuContext {
    scene: THREE.Scene;
    camera: THREE.Camera;
    renderer: THREE.WebGLRenderer;
    perspCam: THREE.PerspectiveCamera;
    orthoCam: THREE.OrthographicCamera;
    activeCamera: THREE.Camera;
    externalCamera: THREE.Camera | null = null;
    
    sceneEntityManager: SceneEntityManager;
    particles: ParticleManager;
    postProcessor: PostProcessor;
    menu: Menu3D;
    gridHelper: THREE.GridHelper;
    cameraHelper: THREE.CameraHelper;

    inputManager: InputManager;
    activeGame: GameModel | null = null;
    
    shake: number = 0;
    isOrtho: boolean = false;
    
    private animationFrameId: number = 0;
    renderConfig: any;
    
    private audio: SoundEmitter;
    private subs: Subscription[] = [];
    private updateHooks: (() => void)[] = [];
    private clock = new Clock();

    // Performance Stats
    public fps: number = 0;
    public triangles: number = 0;
    
    // FPS Limiter
    private fpsLimit: number = 60;
    private fpsInterval: number;
    private then: number = 0;
    
    constructor(container: HTMLElement, inputManager: InputManager, callbacks: MenuCallbacks, audio: SoundEmitter, gameList: GameItem[]) {
        this.inputManager = inputManager;
        this.audio = audio;
        
        // Setup Three.js
        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.info.autoReset = false;
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
        
        this.sceneEntityManager = new SceneEntityManager();
        this.scene.add(this.sceneEntityManager.group);
        
        // Add GridHelper and CameraHelper for debug view
        this.gridHelper = new THREE.GridHelper(50, 50, 0x444444, 0x222222);
        this.gridHelper.visible = false;
        this.scene.add(this.gridHelper);

        this.cameraHelper = new THREE.CameraHelper(this.activeCamera);
        this.cameraHelper.visible = false;
        this.scene.add(this.cameraHelper);

        this.particles = new ParticleManager(this.scene);
        
        // Initialize PostProcessor
        this.postProcessor = new PostProcessor(this.renderer, this.scene, this.activeCamera, width, height);

        // Menu is now parented to the camera for consistent scale
        this.menu = new Menu3D(this.activeCamera, inputManager, this, callbacks, this.audio, gameList);
        
        // Start Loop
        this.renderLoop = this.renderLoop.bind(this);
        this.renderLoop(0);

        this.fpsInterval = 1000 / this.fpsLimit;
        this.then = performance.now();
        
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
        this.postProcessor.setCamera(cam || this.activeCamera);
    }
    
    setGame(game: GameModel) {
        // Unsubscribe from previous game
        this.subs.forEach(s => s.unsubscribe());
        this.subs = [];
        
        this.sceneEntityManager.clear();
        
        this.activeGame = game;
        this.renderConfig = game.getRenderConfig();
        this.sceneEntityManager.setConfig(this.renderConfig);
        
        this.scene.background = new THREE.Color(this.renderConfig.bgColor);
        
        this.syncCamera();
        
        // Initial HUD state
        this.menu.updateScore(game.score);
        this.menu.updateHighScore(game.highScore);
        this.menu.updateStatus('READY');
        this.menu.callbacks.onStatsUpdate(); 
        
        // Subscriptions
        this.subs.push(game.state$.subscribe(items => {
            if (this.activeGame) this.sceneEntityManager.sync(items, this.activeGame.width, this.activeGame.height);
        }));
        
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
        this.postProcessor.setCamera(this.activeCamera);
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

    private renderLoop = (time: number) => {
        this.animationFrameId = requestAnimationFrame(this.renderLoop);
        this.renderer.info.reset();
        
        const now = performance.now();
        const elapsed = now - this.then;

        // If enough time has passed, draw the next frame
        if (elapsed < this.fpsInterval) {
            return;
        }
        this.then = now - (elapsed % this.fpsInterval);

        // Calculate FPS
        const deltaTime = elapsed / 1000; // Use throttled delta time
        this.fps = 1000 / elapsed;
        this.particles.update(deltaTime);

        if (this.activeGame) {
            this.updateHooks.forEach(hook => hook());
        }

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

        // Render via PostProcessor
        this.postProcessor.render(deltaTime);
        TWEEN.update();

        // Update triangle count after render
        this.triangles = this.renderer.info.render.triangles;
    };

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
        this.sceneEntityManager.group.scale.set(scale, scale, scale);
    }

    private _setupPerspCamera(maxDim: number, aspect: number) {
        this.sceneEntityManager.group.scale.set(1, 1, 1);
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
    
    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        this.renderer.setSize(width, height);
        this.postProcessor.setSize(width, height);
        
        const aspect = height > 0 ? width / height : 1;
        this.perspCam.aspect = aspect;
        this.perspCam.updateProjectionMatrix();
        
        this.orthoCam.left = this.orthoCam.bottom * aspect;
        this.orthoCam.right = this.orthoCam.top * aspect;
        this.orthoCam.updateProjectionMatrix();

        if (this.activeGame) this.syncCamera();
    }
    
    getGridFromRay(raycaster: THREE.Raycaster) {
        if (!this.activeGame) return null;
        const intersects = raycaster.intersectObjects(this.sceneEntityManager.group.children);
        if (intersects.length > 0) {
            const tileSize = 1.1;
            const offsetX = (this.activeGame.width * tileSize) / 2 - 0.5;
            const offsetY = (this.activeGame.height * tileSize) / 2 - 0.5;
            
            // Account for group scale
            const hitPoint = intersects[0].point.clone().divide(this.sceneEntityManager.group.scale);

            const gx = Math.round((hitPoint.x + offsetX) / tileSize);
            const gy = Math.round((hitPoint.y + offsetY) / tileSize);
            return { x: gx, y: gy };
        }
        return null;
    }

    destroy() {
        window.removeEventListener('resize', this.onResize);
        cancelAnimationFrame(this.animationFrameId);
        this.subs.forEach(s => s.unsubscribe());
        
        this.menu.destroy();
        
        this.sceneEntityManager.clear();
        
        this.renderer.dispose();
        
        if (this.renderer.domElement.parentNode) {
            this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
        }
    }

    // --- Post Processing Public API ---
    public setToneMapping(toneMapping: THREE.ToneMapping) {
        this.renderer.toneMapping = toneMapping;
        this.scene.traverse((object) => {
            if ((object as any).isMesh) (object as any).material.needsUpdate = true;
        });
    }

    public setDotScreen(enabled: boolean, scale: number) {
        this.postProcessor.setDotScreen(enabled, scale);
    }

    public setCurvature(enabled: boolean, amount: number) {
        this.postProcessor.setCurvature(enabled, amount);
    }

    public setColorCorrection(tint: number, grayscale: number) {
        this.postProcessor.setColorCorrection(tint, grayscale);
    }
}

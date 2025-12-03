
import * as THREE from 'three';

// Define interface locally to avoid importing GameRenderer and causing circular dependency/loading issues
interface RendererLike {
    renderer: THREE.WebGLRenderer;
    activeGame: { width: number, height: number } | null;
    addUpdateHook(fn: () => void): void;
    setExternalCamera(cam: THREE.Camera | null): void;
}

export class DebugCamera {
    camera: THREE.PerspectiveCamera;
    isActive = false;
    renderer: RendererLike;
    
    // Orbit State
    radius = 20;
    theta = 0;
    phi = Math.PI / 3;
    dragging = false;
    lastX = 0;
    lastY = 0;

    constructor(renderer: RendererLike) {
        this.renderer = renderer;
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        
        this.setupControls(renderer.renderer.domElement);
        
        // Hook into renderer loop
        renderer.addUpdateHook(() => this.update());
        
        window.addEventListener('resize', () => {
             this.camera.aspect = window.innerWidth / window.innerHeight;
             this.camera.updateProjectionMatrix();
        });
    }

    setupControls(dom: HTMLElement) {
        dom.addEventListener('pointerdown', (e) => {
            if (!this.isActive) return;
            this.dragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
        });

        window.addEventListener('pointermove', (e) => {
            if (!this.isActive || !this.dragging) return;
            const dx = e.clientX - this.lastX;
            const dy = e.clientY - this.lastY;
            this.lastX = e.clientX;
            this.lastY = e.clientY;

            this.theta -= dx * 0.01;
            this.phi -= dy * 0.01;
            
            // Clamp phi to avoid flipping
            this.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.phi));
        });

        window.addEventListener('pointerup', () => {
            this.dragging = false;
        });

        dom.addEventListener('wheel', (e) => {
            if (!this.isActive) return;
            e.preventDefault();
            this.radius += e.deltaY * 0.02;
            this.radius = Math.max(2, Math.min(100, this.radius));
        }, { passive: false });
    }

    toggle() {
        this.isActive = !this.isActive;
        this.renderer.setExternalCamera(this.isActive ? this.camera : null);
        
        if (this.isActive) {
            // Reset view to reasonable default based on current game
            const game = this.renderer.activeGame;
            if (game) {
                 const maxDim = Math.max(game.width, game.height);
                 this.radius = maxDim * 1.5;
            }
        }
        return this.isActive;
    }

    update() {
        if (!this.isActive) return;
        
        this.camera.position.x = this.radius * Math.sin(this.phi) * Math.sin(this.theta);
        this.camera.position.y = this.radius * Math.cos(this.phi);
        this.camera.position.z = this.radius * Math.sin(this.phi) * Math.cos(this.theta);
        this.camera.lookAt(0, 0, 0);
    }
}

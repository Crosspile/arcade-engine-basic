import * as THREE from 'three';
import { TWEEN } from '../utils/tween';
import { ModelManager } from './ModelManager';
import type { GameItem, RenderConfig } from '../types';

export class SceneEntityManager {
    public group: THREE.Group;
    private meshes: Map<string, THREE.Mesh>;
    private textureCache: Map<string, THREE.CanvasTexture>;
    private modelManager: ModelManager;
    private renderConfig: RenderConfig | null = null;

    constructor() {
        this.group = new THREE.Group();
        this.meshes = new Map();
        this.textureCache = new Map();
        this.modelManager = new ModelManager();
    }

    public setConfig(config: RenderConfig) {
        this.renderConfig = config;
    }

    public clear() {
        this.meshes.forEach(m => {
            this.group.remove(m);
            this.disposeMesh(m);
        });
        this.meshes.clear();
        this.textureCache.forEach(t => t.dispose());
        this.textureCache.clear();
    }

    public async sync(items: GameItem[], gameWidth: number, gameHeight: number) {
        if (!this.renderConfig) return;
        
        const activeIds = new Set<string>();
        const tileSize = 1.1;
        const offsetX = (gameWidth * tileSize) / 2 - 0.5;
        const offsetY = (gameHeight * tileSize) / 2 - 0.5;

        for (const item of items) {
            activeIds.add(item.id);
            let mesh = this.meshes.get(item.id);
            const tx = item.x * tileSize - offsetX;
            const ty = item.y * tileSize - offsetY;
            
            const zOffset = (item.type === 0) ? -0.1 : 0;
            const color = item.color !== undefined ? item.color : ((this.renderConfig.colors && this.renderConfig.colors[item.type] !== undefined) 
                ? this.renderConfig.colors[item.type] 
                : 0xffffff);
            const opacity = item.opacity !== undefined ? item.opacity : 1;
            const transparent = opacity < 1;

            if (!mesh) {
                if (item.modelId && this.renderConfig.models && this.renderConfig.models[item.modelId]) {
                    const modelUrl = this.renderConfig.models[item.modelId];
                    try {
                        const modelGroup = await this.modelManager.get(modelUrl);
                        mesh = modelGroup.children[0] as THREE.Mesh;
                        if (!mesh.material) {
                            const matParams: any = { color, transparent, opacity };
                            mesh.material = this.renderConfig.shading === 'standard' 
                                ? new THREE.MeshStandardMaterial(matParams) 
                                : new THREE.MeshBasicMaterial(matParams);
                        }
                    } catch (error) {
                        console.error(`Could not load model for item ${item.id}`, error);
                        continue;
                    }
                } else {
                    const geom = this.createGeometry(item.type);
                    const matParams: any = { color, transparent, opacity };
                    if (this.renderConfig.shading === 'standard') {
                        matParams.metalness = 0.2;
                        matParams.roughness = 0.8;
                    }
                    const mat = this.renderConfig.shading === 'standard'
                        ? new THREE.MeshStandardMaterial(matParams)
                        : new THREE.MeshBasicMaterial(matParams);
                    mesh = new THREE.Mesh(geom, mat);
                }

                if (item.scale) mesh.scale.set(item.scale, item.scale, item.scale);

                // Bloom Layer Logic
                const bloomConfig = this.renderConfig.bloom;
                if (bloomConfig && (bloomConfig.all || (bloomConfig.types && bloomConfig.types.includes(item.type)))) {
                    mesh.layers.enable(1);
                } else {
                    mesh.layers.disable(1);
                }

                this.group.add(mesh);
                this.meshes.set(item.id, mesh);

                if (item.rotation) {
                    mesh.rotation.set(item.rotation.x || 0, item.rotation.y || 0, item.rotation.z || 0);
                }

                switch( item.spawnStyle ) {
                    case 'pop':{
                        mesh.position.set(tx, ty, zOffset);
                        mesh.scale.set(0, 0, 0);
                        TWEEN.to(mesh.scale, { x: 1, y: 1, z: 1 }, 200, 'outBack');
                        break;
                    }
                    case 'elastic':{
                        mesh.position.set(tx, ty + 5, zOffset);
                        TWEEN.to(mesh.position, { x: tx, y: ty }, 400, 'elastic');
                        break;
                    }
                    default:{
                        mesh.position.set(tx, ty, zOffset);
                    }
                }

            } else {
                const mat = mesh.material as THREE.MeshBasicMaterial | THREE.MeshStandardMaterial;
                if (item.text !== undefined) {
                    const tex = this.createLabelTexture(item.text, color, item.textColor);
                    if (mat.map !== tex) {
                        mat.map = tex || null;
                        mat.color.setHex(0xffffff);
                        mat.needsUpdate = true;
                    }
                } else {
                    if (mat.map) { mat.map = null; mat.needsUpdate = true; }
                    mat.color.setHex(color);
                }
                
                if (mat.opacity !== opacity) {
                    mat.opacity = opacity;
                    mat.transparent = transparent;
                    mat.needsUpdate = true;
                }

                if (Math.abs(mesh.position.x - tx) > 0.01 || Math.abs(mesh.position.y - ty) > 0.01 || mesh.position.z !== zOffset) {
                    const duration = item.tween?.duration !== undefined ? item.tween.duration : 150;
                    TWEEN.to(mesh.position, { x: tx, y: ty, z: zOffset }, duration);
                }

                if (item.rotation) {
                    TWEEN.to(mesh.rotation, { x: item.rotation.x || 0, y: item.rotation.y || 0, z: item.rotation.z || 0 }, 150);
                }
            }
        }

        this.meshes.forEach((m, id) => {
            if (!activeIds.has(id)) {
                this.group.remove(m);
                this.disposeMesh(m);
                this.meshes.delete(id);
            }
        });
    }

    private createGeometry(type: number): THREE.BufferGeometry {
        if (this.renderConfig?.customGeometry) {
            const geo = this.renderConfig.customGeometry(type);
            if (geo) return geo;
        }
        const geometry = this.renderConfig?.geometry;
        const geoType = (geometry as any)?.[type] || (geometry as any)?.['default'] || 'Box';
        switch (geoType) {
            case 'Cylinder': return new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32).rotateX(Math.PI / 2);
            case 'Sphere': return new THREE.SphereGeometry(0.5, 32, 16);
            case 'Torus': return new THREE.TorusGeometry(0.4, 0.15, 16, 100);
            case 'Icosahedron': return new THREE.IcosahedronGeometry(0.5);
            case 'Cone': return new THREE.ConeGeometry(0.5, 1, 32);
            default: return new THREE.BoxGeometry(0.9, 0.9, 0.9);
        }
    }

    private createLabelTexture(text: string, bgColor: number, textColor: string = '#ffffff') {
        const key = `${text}_${bgColor}_${textColor}`;
        if (this.textureCache.has(key)) return this.textureCache.get(key)!;
        const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.fillStyle = '#' + bgColor.toString(16).padStart(6, '0'); ctx.fillRect(0, 0, 128, 128);
            ctx.font = 'bold 80px sans-serif'; ctx.fillStyle = textColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 64, 64);
            ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth = 4; ctx.strokeRect(2, 2, 124, 124);
        }
        const tex = new THREE.CanvasTexture(canvas); this.textureCache.set(key, tex); return tex;
    }

    private disposeMesh(m: THREE.Mesh) {
        if (m.geometry) m.geometry.dispose();
        if (Array.isArray(m.material)) m.material.forEach(mat => mat.dispose());
        else if (m.material) (m.material as THREE.Material).dispose();
    }
}
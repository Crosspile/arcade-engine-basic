
import * as THREE from 'three';
import { Easing, EasingType } from '../../utils/easing';
import { ParticleStyle } from '../../types';

const STYLES: Record<string, ParticleStyle> = {
    EXPLODE: { count: 2, speed: 0.1, life: 2, easing: 'outExpo', scaleStart: 4, scaleEnd: 0 },
    PUFF: { count: 6, speed: 0.02, life: 6, easing: 'outCirc', scaleStart: 2, scaleEnd: 0, upward: 0.05 },
    CONFETTI: { count: 30, speed: 0.3, life: 3, easing: 'outSine', scaleStart: 1.5, scaleEnd: 0, gravity: -0.005 }
};

interface Particle {
    mesh: THREE.Mesh;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    maxLife: number;
    easing: EasingType;
    scaleStart: number;
    scaleEnd: number;
    gravity: number;
}

export class ParticleManager {
    scene: THREE.Scene;
    particles: Particle[] = [];
    geom: THREE.BoxGeometry;
    mat: THREE.MeshBasicMaterial;

    constructor(scene: THREE.Scene) {
        this.scene = scene;
        this.geom = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        this.mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    }

    spawn(x: number, y: number, colorHex: number, styleOrName: string | ParticleStyle = 'EXPLODE') {
        let style: ParticleStyle;

        if (typeof styleOrName === 'string') {
            style = STYLES[styleOrName] || STYLES.EXPLODE;
        } else {
            // Merge custom style with default to ensure all props exist
            style = { ...STYLES.EXPLODE, ...styleOrName }; 
        }

        for (let i = 0; i < style.count; i++) {
            const mesh = new THREE.Mesh(this.geom, this.mat.clone());
            mesh.material.color.setHex(colorHex);
            mesh.position.set(x, y, 0);

            const vx = (Math.random() - 0.5) * style.speed;
            const vy = (Math.random() - 0.5) * style.speed + (style.upward ? style.upward * 0.1 : 0);
            const vz = (Math.random() - 0.5) * style.speed;

            this.scene.add(mesh);
            this.particles.push({
                mesh,
                vx, vy, vz,
                life: 0,
                maxLife: style.life * 60,
                easing: style.easing,
                scaleStart: style.scaleStart,
                scaleEnd: style.scaleEnd,
                gravity: style.gravity || 0
            });
        }
    }

    update() {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life++;
            const progress = p.life / p.maxLife;

            if (progress >= 1) {
                this.scene.remove(p.mesh);
                (p.mesh.material as THREE.Material).dispose();
                this.particles.splice(i, 1);
                continue;
            }

            p.mesh.position.x += p.vx;
            p.mesh.position.y += p.vy;
            p.mesh.position.z += p.vz;
            p.vy += p.gravity;

            const fn = Easing[p.easing] || Easing.linear;
            const easeVal = fn(progress);

            const currentScale = p.scaleStart + (p.scaleEnd - p.scaleStart) * easeVal;
            p.mesh.scale.setScalar(currentScale);
            p.mesh.rotation.x += 0.1;
            p.mesh.rotation.z += 0.1;
        }
    }
}

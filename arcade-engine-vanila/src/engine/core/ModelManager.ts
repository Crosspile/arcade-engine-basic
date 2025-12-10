import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class ModelManager {
    private loader = new GLTFLoader();
    private cache = new Map<string, Promise<THREE.Scene>>();

    public get(url: string): Promise<THREE.Group> {
        if (!this.cache.has(url)) {
            const loadPromise = new Promise<THREE.Scene>((resolve, reject) => {
                this.loader.load(
                    url,
                    (gltf) => {
                        // Cache the original loaded scene
                        resolve(gltf.scene);
                    },
                    undefined, // onProgress callback (optional)
                    (error) => {
                        console.error(`Failed to load model from ${url}`, error);
                        this.cache.delete(url); // Remove failed promise from cache
                        reject(error);
                    }
                );
            });
            this.cache.set(url, loadPromise);
        }

        // Return a new promise that resolves with a clone of the cached scene.
        // This ensures each caller gets a unique, mutable object.
        return this.cache.get(url)!.then(scene => scene.clone(true));
    }
}
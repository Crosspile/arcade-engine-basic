import { GameModel } from './GameModel';
import type { GameItem, InputAction, SoundEmitter } from '../engine/types';

const GEOMETRY_TYPES = [
    'Box',
    'Cylinder',
    'Sphere',
    'Torus',
    'Icosahedron',
    'Cone',
];

export default class GeometryShowcase extends GameModel {
    constructor(audio?: SoundEmitter) {
        super(7, 2, 'geometryshowcase', audio);
    }

    public start(): void {
        this.status$.next('Geometry Showcase');
        this.emitState();
    }

    private emitState(): void {
        const items: GameItem[] = [];

        // Display all standard geometries
        GEOMETRY_TYPES.forEach((geoName, index) => {
            items.push({
                id: `geo_${index}`,
                type: index, // Use type to map to geometry in renderConfig
                x: index,
                y: 1,
                text: geoName,
                textColor: '#FFFFFF'
            });
        });

        // Display a custom loaded model
        items.push({
            id: 'custom_model_1',
            type: 99, // A type not used by standard geometries
            modelId: 'duck', // This ID maps to the renderConfig
            x: 6,
            y: 1/2,
            scale: 0.005, // Custom models might need scaling
            // rotation: { x: 0, y: Math.PI / 2, z: 0 } // Optional rotation
        });

        this.state$.next(items);
    }

    public handleInput(action: InputAction): void {
        // No input needed for this showcase
    }

    public getRenderConfig() {
        return {
            shading: 'standard' as const,
            // Map item type to a geometry name
            geometry: {
                0: 'Box',
                1: 'Cylinder',
                2: 'Sphere',
                3: 'Torus',
                4: 'Icosahedron',
                5: 'Cone',
                default: 'Box',
            },
            // Map item type to a color
            colors: {
                0: 0xff595e, 1: 0xffca3a, 2: 0x8ac926, 3: 0x1982c4, 4: 0x6a4c93, 5: 0xf59563
            },
            // Define paths for custom models
            models: {
                // Using a reliable, CORS-enabled model from the official glTF samples repo
                duck: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/master/2.0/Duck/glTF-Binary/Duck.glb',
            },
            bgColor: 0x1d222b,
        };
    }
}
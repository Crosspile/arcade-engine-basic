
import * as THREE from 'three';
import { fromEvent, merge, map, filter, switchMap, take, share, Observable, Subject } from 'rxjs';
import { InputType, InputAction } from '../../types';

export class InputManager {
    action$: Observable<InputAction>;
    private virtualSubject = new Subject<InputAction>();

    constructor(
        domElement: HTMLElement, 
        cameraGetter: () => THREE.Camera | null | undefined, 
        getGridPos: (x: number, y: number) => { x: number, y: number } | null
    ) {
        const KEY_MAP: Record<string, InputType> = {
            ArrowUp: 'UP', w: 'UP', ArrowDown: 'DOWN', s: 'DOWN',
            ArrowLeft: 'LEFT', a: 'LEFT', ArrowRight: 'RIGHT', d: 'RIGHT',
            ' ': 'SELECT', Enter: 'SELECT'
        };

        const key$ = fromEvent<KeyboardEvent>(window, 'keydown').pipe(
            map(e => KEY_MAP[e.key]),
            filter((type): type is InputType => !!type),
            map(type => ({ type }))
        );

        const getRayIntersects = (cx: number, cy: number) => {
            const cam = cameraGetter();
            if (!cam) return null;
            const mouse = new THREE.Vector2((cx / window.innerWidth) * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, cam);
            return raycaster;
        };

        const pointer$ = merge(
            fromEvent<MouseEvent>(window, 'mousedown').pipe(map(e => ({ x: e.clientX, y: e.clientY }))),
            fromEvent<TouchEvent>(window, 'touchstart').pipe(map(e => {
                const t = e.touches[0];
                return t ? { x: t.clientX, y: t.clientY } : null;
            }), filter(p => p !== null))
        ).pipe(
            switchMap(start => merge(
                fromEvent<MouseEvent>(window, 'mouseup').pipe(map(e => ({ x: e.clientX, y: e.clientY }))),
                fromEvent<TouchEvent>(window, 'touchend').pipe(map(e => {
                    const t = e.changedTouches[0];
                    return t ? { x: t.clientX, y: t.clientY } : null;
                }), filter(p => p !== null))
            ).pipe(
                take(1),
                map(end => {
                    const dx = end!.x - start!.x;
                    const dy = end!.y - start!.y;
                    if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
                        return { type: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'RIGHT' : 'LEFT') : (dy > 0 ? 'DOWN' : 'UP') } as InputAction;
                    }
                    return { type: 'SELECT', data: { raycaster: getRayIntersects(end!.x, end!.y) } } as InputAction;
                })
            ))
        );

        this.action$ = merge(key$, pointer$, this.virtualSubject).pipe(share());
    }

    emitVirtual(type: InputType) {
        this.virtualSubject.next({ type });
    }
}

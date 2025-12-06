import * as THREE from "three";

import { filter, Subject, fromEvent, map, merge, switchMap, take, share } from "rxjs";

import { G as GAME_IDS } from "./game-registry.js";

const Easing = {
    linear: t => t,
    inQuad: t => t * t,
    outQuad: t => t * (2 - t),
    inOutQuad: t => t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    outCubic: t => --t * t * t + 1,
    inBack: t => {
        var s = 1.70158;
        return t * t * ((s + 1) * t - s);
    },
    outElastic: t => {
        var p = .3;
        var a = 1;
        if (t === 0) return 0;
        if ((t /= 1) === 1) return 1;
        var s = p / (2 * Math.PI) * Math.asin(1 / a);
        return a * Math.pow(2, -10 * t) * Math.sin((t * 1 - s) * (2 * Math.PI) / p) + 1;
    },
    outBack: t => {
        var s = 1.70158;
        return (t = t - 1) * t * ((s + 1) * t + s) + 1;
    },
    outExpo: t => t === 1 ? 1 : -Math.pow(2, -10 * t) + 1,
    outCirc: t => Math.sqrt(1 - (t = t - 1) * t),
    outSine: t => Math.sin(t * (Math.PI / 2)),
    elastic: t => {
        var p = .3;
        var a = 1;
        if (t === 0) return 0;
        if ((t /= 1) === 1) return 1;
        var s = p / (2 * Math.PI) * Math.asin(1 / a);
        return a * Math.pow(2, -10 * t) * Math.sin((t * 1 - s) * (2 * Math.PI) / p) + 1;
    }
};

const STYLES = {
    EXPLODE: {
        count: 2,
        speed: .1,
        life: 2,
        easing: "outExpo",
        scaleStart: 4,
        scaleEnd: 0
    },
    PUFF: {
        count: 6,
        speed: .02,
        life: 6,
        easing: "outCirc",
        scaleStart: 2,
        scaleEnd: 0,
        upward: .05
    },
    CONFETTI: {
        count: 30,
        speed: .3,
        life: 3,
        easing: "outSine",
        scaleStart: 1.5,
        scaleEnd: 0,
        gravity: -.005
    }
};

class ParticleManager {
    constructor(scene) {
        this.particles = [];
        this.scene = scene;
        this.geom = new THREE.BoxGeometry(.2, .2, .2);
        this.mat = new THREE.MeshBasicMaterial({
            color: 16777215
        });
    }
    spawn(x, y, colorHex, styleOrName = "EXPLODE") {
        let style;
        if (typeof styleOrName === "string") {
            style = STYLES[styleOrName] || STYLES.EXPLODE;
        } else {
            style = {
                ...STYLES.EXPLODE,
                ...styleOrName
            };
        }
        for (let i = 0; i < style.count; i++) {
            const mesh = new THREE.Mesh(this.geom, this.mat.clone());
            mesh.material.color.setHex(colorHex);
            mesh.position.set(x, y, 0);
            const vx = (Math.random() - .5) * style.speed;
            const vy = (Math.random() - .5) * style.speed + (style.upward ? style.upward * .1 : 0);
            const vz = (Math.random() - .5) * style.speed;
            this.scene.add(mesh);
            this.particles.push({
                mesh: mesh,
                vx: vx,
                vy: vy,
                vz: vz,
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
                p.mesh.material.dispose();
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
            p.mesh.rotation.x += .1;
            p.mesh.rotation.z += .1;
        }
    }
}

class TweenManager {
    constructor() {
        this.tweens = [];
    }
    to(target, props, duration, easing = "outCubic") {
        return new Promise(resolve => {
            const start = {};
            for (const k in props) {
                start[k] = target[k] !== void 0 ? target[k] : 0;
            }
            this.tweens.push({
                target: target,
                props: props,
                start: start,
                startTime: Date.now(),
                duration: duration,
                easing: easing,
                resolve: resolve
            });
        });
    }
    update() {
        const now = Date.now();
        this.tweens = this.tweens.filter(t => {
            const el = now - t.startTime;
            let p = Math.min(1, el / t.duration);
            const fn = Easing[t.easing] || Easing.outCubic;
            let v = fn(p);
            for (let k in t.props) {
                t.target[k] = t.start[k] + (t.props[k] - t.start[k]) * v;
            }
            if (p >= 1) {
                t.resolve();
                return false;
            }
            return true;
        });
    }
}

const TWEEN = new TweenManager;

const HUD_MARGIN_X = .5;

const HUD_MARGIN_Y = .5;

const UI_Z_DISTANCE = -8;

const _Menu3D = class _Menu3D {
    constructor(camera, inputManager, renderer, callbacks, audio) {
        this.renderer = renderer;
        this.callbacks = callbacks;
        this.group = new THREE.Group;
        this.hudGroup = new THREE.Group;
        this.visible = false;
        this.items = [];
        this.selectedIndex = 0;
        this.menuStack = [];
        this.currentMenuId = "main";
        this.subs = [];
        this.menus =  new Map;
        this.visibleHeight = 10;
        this.scoreLabel = null;
        this.statusLabel = null;
        this.highScoreLabel = null;
        if (!_Menu3D.sharedGeometry) {
            _Menu3D.sharedGeometry = new THREE.PlaneGeometry(4, 1);
        }
        this.camera = camera;
        this.camera.add(this.group);
        this.camera.add(this.hudGroup);
        this.audio = audio;
        this.group.position.z = UI_Z_DISTANCE;
        this.hudGroup.position.z = UI_Z_DISTANCE;
        this.group.visible = false;
        this.registerMenu("main", [ {
            text: "PLAY GAMES",
            action: "goto:games"
        }, {
            text: "OPTIONS",
            action: "goto:options"
        }, {
            text: "CLOSE",
            action: "close"
        } ]);
        const gameItems = GAME_IDS.map(id => ({
            text: id.toUpperCase(),
            action: `game:${id}`
        }));
        gameItems.push({
            text: "BACK",
            action: "back"
        });
        this.registerMenu("games", gameItems);
        this.registerMenu("options", [ {
            text: "SOUND: ON",
            action: "toggle:sound",
            dynamic: true
        }, {
            text: "VIEW: 3D",
            action: "toggle:view",
            dynamic: true
        }, {
            text: "BACK",
            action: "back"
        } ]);
        this.registerMenu("gameover", [ {
            text: "TRY AGAIN",
            action: "restart"
        }, {
            text: "MAIN MENU",
            action: "goto:main"
        } ]);
        this.subs.push(inputManager.action$.pipe(filter(() => this.visible && this.items.length > 0)).subscribe(action => {
            if (action.type === "UP") this.select(this.selectedIndex - 1); else if (action.type === "DOWN") this.select(this.selectedIndex + 1); else if (action.type === "LEFT" && this.menuStack.length > 0) this.goBack(); else if (action.type === "SELECT" || action.type === "RIGHT") {
                if (action.data && action.data.raycaster) {
                    const hits = action.data.raycaster.intersectObjects(this.group.children);
                    if (hits.length > 0) {
                        const hitMesh = hits[0].object;
                        const idx = this.items.indexOf(hitMesh);
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
    setCamera(newCamera) {
        this.camera.remove(this.group);
        this.camera.remove(this.hudGroup);
        this.camera = newCamera;
        this.camera.add(this.group);
        this.camera.add(this.hudGroup);
    }
    initHUD() {
        this.scoreLabel = this.createHUDMesh("SCORE: 0", 16776960);
        this.hudGroup.add(this.scoreLabel);
        this.statusLabel = this.createHUDMesh("READY", 16777215, .5);
        this.hudGroup.add(this.statusLabel);
        this.highScoreLabel = this.createHUDMesh("BEST: 0", 11184810, .4);
        this.hudGroup.add(this.highScoreLabel);
    }
    createHUDMesh(text, color, scale = .6) {
        const mesh = this.createMesh(text, 0, true);
        mesh.scale.set(scale, scale, scale);
        mesh.material.color.setHex(color);
        mesh.raycast = () => {};
        return mesh;
    }
    updateHUDText(mesh, text) {
        if (!mesh) return;
        const canvas = mesh.material.map.image;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.fillStyle = "#00000000";
            ctx.clearRect(0, 0, 512, 128);
            ctx.shadowColor = "black";
            ctx.shadowBlur = 4;
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 80px ui-sans-serif, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, 256, 64);
        }
        mesh.material.map.needsUpdate = true;
    }
    updateScore(score) {
        this.updateHUDText(this.scoreLabel, `SCORE: ${score}`);
    }
    updateHighScore(score) {
        this.updateHUDText(this.highScoreLabel, `BEST: ${score}`);
    }
    updateStatus(status) {
        this.updateHUDText(this.statusLabel, status);
    }
    layoutHUD(width, height) {
        if (!width || !height || isNaN(width) || isNaN(height)) return;
        this.visibleHeight = height;
        const halfW = width / 2;
        const halfH = height / 2;
        if (this.scoreLabel) {
            this.scoreLabel.position.set(-halfW + HUD_MARGIN_X + this.scoreLabel.scale.x * 2, halfH - HUD_MARGIN_Y - this.scoreLabel.scale.y * .5, 0);
        }
        if (this.highScoreLabel) {
            this.highScoreLabel.position.set(halfW - HUD_MARGIN_X - this.highScoreLabel.scale.x * 2, halfH - HUD_MARGIN_Y - this.highScoreLabel.scale.y * .5, 0);
        }
        if (this.statusLabel) {
            this.statusLabel.position.set(0, -halfH + HUD_MARGIN_Y + this.statusLabel.scale.y * .5, 0);
        }
    }
    registerMenu(id, items) {
        this.menus.set(id, items);
    }
    createMesh(text, index, isTransparent = false) {
        const canvas = document.createElement("canvas");
        canvas.width = 512;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            if (!isTransparent) {
                ctx.fillStyle = "#002456";
                ctx.fillRect(0, 0, 512, 128);
                ctx.strokeStyle = "#4dc9ff";
                ctx.lineWidth = 10;
                ctx.strokeRect(5, 5, 502, 118);
            }
            ctx.fillStyle = "#ffffff";
            ctx.font = "bold 60px ui-sans-serif, system-ui, sans-serif";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, 256, 64);
        }
        const material = new THREE.MeshBasicMaterial({
            map: new THREE.CanvasTexture(canvas),
            transparent: true,
            opacity: isTransparent ? 1 : .9,
            depthTest: false
        });
        const mesh = new THREE.Mesh(_Menu3D.sharedGeometry, material);
        mesh.renderOrder = 1;
        return mesh;
    }
    open(menuId) {
        this.visible = true;
        this.group.visible = true;
        this.menuStack = [];
        this.clearItems();
        this.renderMenu(menuId);
        this.group.scale.set(.1, .1, .1);
        TWEEN.to(this.group.scale, {
            x: 1,
            y: 1,
            z: 1
        }, 400, "outBack");
        this.callbacks.onMenuStateChange(true);
        if (this.renderer.activeGame) this.renderer.activeGame.setPaused(true);
    }
    close() {
        this.visible = false;
        this.group.visible = false;
        this.menuStack = [];
        this.callbacks.onMenuStateChange(false);
        if (this.renderer.activeGame) this.renderer.activeGame.setPaused(false);
    }
    renderMenu(menuId) {
        this.currentMenuId = menuId;
        const data = this.menus.get(menuId);
        if (!data) return;
        this.clearItems();
        data.forEach((item, i) => {
            let txt = item.text;
            if (item.action === "toggle:sound") txt = this.audio.enabled ? "SOUND: ON" : "SOUND: OFF";
            if (item.action === "toggle:view") txt = this.renderer.isOrtho ? "VIEW: 2D" : "VIEW: 3D";
            const mesh = this.createMesh(txt, i);
            mesh.userData = {
                action: item.action
            };
            this.group.add(mesh);
            this.items.push(mesh);
        });
        this.select(0);
    }
    clearItems() {
        this.items.forEach(m => {
            this.group.remove(m);
            if (m.material.map) m.material.map.dispose();
            m.material.dispose();
        });
        this.items = [];
    }
    showGameOver() {
        this.open("gameover");
    }
    toggle() {
        this.visible ? this.close() : this.open("main");
    }
    select(index) {
        if (!this.items.length) return;
        this.selectedIndex = (index + this.items.length) % this.items.length;
        this.audio.playMove();
        const halfVisibleHeight = this.visibleHeight / 2;
        this.items.forEach((m, i) => {
            const mat = m.material;
            const diff = i - this.selectedIndex;
            const targetY = diff * -1.2;
            const targetZ = Math.abs(diff) * -.5;
            const targetRotX = diff * .1;
            const isSelected = i === this.selectedIndex;
            const targetScale = isSelected ? 1.3 : 1;
            const targetOpacity = Math.max(.2, 1 - Math.abs(diff) * .3);
            const itemHeight = 1 * targetScale;
            const topEdge = targetY + itemHeight / 2;
            const bottomEdge = targetY - itemHeight / 2;
            const buffer = .5;
            if (topEdge < -halfVisibleHeight - buffer || bottomEdge > halfVisibleHeight + buffer) {
                m.visible = false;
            } else {
                m.visible = true;
            }
            if (isSelected) {
                mat.color.setHex(5097983);
            } else {
                mat.color.setHex(16777215);
            }
            mat.opacity = targetOpacity;
            TWEEN.to(m.position, {
                x: 0,
                y: targetY,
                z: targetZ
            }, 300, "outCubic");
            TWEEN.to(m.scale, {
                x: targetScale,
                y: targetScale,
                z: targetScale
            }, 300, "outCubic");
            TWEEN.to(m.rotation, {
                x: targetRotX,
                y: 0,
                z: 0
            }, 300, "outCubic");
        });
    }
    trigger() {
        if (!this.items[this.selectedIndex]) return;
        const act = this.items[this.selectedIndex].userData.action;
        this.audio.playSelect();
        if (act.startsWith("goto:")) {
            this.menuStack.push(this.currentMenuId);
            this.renderMenu(act.split(":")[1]);
        } else if (act === "back") this.goBack(); else if (act.startsWith("game:")) {
            this.callbacks.onSwitchGame(act.split(":")[1]);
            this.close();
        } else if (act === "close") this.close(); else if (act === "restart") {
            this.callbacks.onRestart();
            this.close();
        } else if (act === "toggle:sound") {
            this.audio.toggle();
            this.renderMenu(this.currentMenuId);
        } else if (act === "toggle:view") {
            this.renderer.toggleCamera();
            this.renderMenu(this.currentMenuId);
        }
    }
    goBack() {
        if (this.menuStack.length) this.renderMenu(this.menuStack.pop());
    }
    destroy() {
        this.subs.forEach(s => s.unsubscribe());
        this.clearItems();
    }
};

_Menu3D.sharedGeometry = null;

let Menu3D = _Menu3D;

class GameRenderer {
    constructor(container, inputManager, callbacks, audio) {
        this.externalCamera = null;
        this.activeGame = null;
        this.shake = 0;
        this.isOrtho = false;
        this.requestRef = 0;
        this.subs = [];
        this.updateHooks = [];
        this.inputManager = inputManager;
        this.audio = audio;
        this.scene = new THREE.Scene;
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        container.appendChild(this.renderer.domElement);
        const width = container.clientWidth || 1;
        const height = container.clientHeight || 1;
        const aspect = width / height;
        this.perspCam = new THREE.PerspectiveCamera(60, aspect, .1, 100);
        this.orthoCam = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, .1, 100);
        this.activeCamera = this.perspCam;
        this.camera = this.perspCam;
        this.scene.add(this.perspCam);
        this.scene.add(this.orthoCam);
        const light = new THREE.DirectionalLight(16777215, .8);
        light.position.set(5, 10, 10);
        this.scene.add(light);
        this.scene.add(new THREE.AmbientLight(16777215, .4));
        this.group = new THREE.Group;
        this.scene.add(this.group);
        this.gridHelper = new THREE.GridHelper(50, 50, 4473924, 2236962);
        this.gridHelper.visible = false;
        this.scene.add(this.gridHelper);
        this.cameraHelper = new THREE.CameraHelper(this.activeCamera);
        this.cameraHelper.visible = false;
        this.scene.add(this.cameraHelper);
        this.meshes =  new Map;
        this.textureCache =  new Map;
        this.particles = new ParticleManager(this.scene);
        this.menu = new Menu3D(this.activeCamera, inputManager, this, callbacks, this.audio);
        this.animate = this.animate.bind(this);
        this.animate();
        this.onResize = this.onResize.bind(this);
        window.addEventListener("resize", this.onResize);
    }
    addUpdateHook(fn) {
        this.updateHooks.push(fn);
    }
    setExternalCamera(cam) {
        this.externalCamera = cam;
        this.gridHelper.visible = !!cam;
        this.cameraHelper.visible = !!cam;
    }
    setGame(game) {
        this.subs.forEach(s => s.unsubscribe());
        this.subs = [];
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
        this.menu.updateScore(game.score);
        this.menu.updateHighScore(game.highScore);
        this.menu.updateStatus("READY");
        this.menu.callbacks.onStatsUpdate();
        this.subs.push(game.state$.subscribe(items => this.sync(items)));
        this.subs.push(game.score$.subscribe(s => {
            this.menu.updateScore(s);
            this.menu.callbacks.onStatsUpdate();
        }));
        this.subs.push(game.status$.subscribe(s => {
            this.menu.updateStatus(s);
            this.menu.callbacks.onStatsUpdate();
            if (s === "GAME OVER") {
                this.menu.showGameOver();
            }
        }));
        this.subs.push(game.subStat$.subscribe(() => {
            this.menu.callbacks.onStatsUpdate();
        }));
        this.subs.push(game.effects$.subscribe(e => {
            if (!this.activeGame) return;
            if (e.type === "GAMEOVER") {
                this.menu.showGameOver();
                return;
            }
            if (e.type === "RESIZE") {
                this.syncCamera();
                return;
            }
            const tileSize = 1.1;
            const offsetX = this.activeGame.width * tileSize / 2 - .5;
            const offsetY = this.activeGame.height * tileSize / 2 - .5;
            if (e.type === "EXPLODE" || e.type === "PARTICLE") {
                const tx = (e.x || 0) * tileSize - offsetX;
                const ty = (e.y || 0) * tileSize - offsetY;
                this.particles.spawn(tx, ty, e.color || 16777215, e.style);
                if (e.type === "EXPLODE") this.audio.playExplosion();
            } else if (e.type === "AUDIO") {
                if (e.name === "SELECT") this.audio.playSelect(); else if (e.name === "MOVE") this.audio.playMove(); else if (e.name === "MATCH") this.audio.playMatch(); else if (e.name === "GAMEOVER") this.audio.playGameOver(); else if (e.name === "EXPLOSION") this.audio.playExplosion();
            }
        }));
    }
    toggleCamera() {
        if (this.externalCamera) return this.isOrtho;
        this.isOrtho = !this.isOrtho;
        this.activeCamera = this.isOrtho ? this.orthoCam : this.perspCam;
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
        if (this.isOrtho) {
            this._setupOrthoCamera(w, h, aspect);
        } else {
            this._setupPerspCamera(maxDim, aspect);
        }
        const {visibleWidth: visibleWidth, visibleHeight: visibleHeight} = this._getUIVisibleBounds(this.activeCamera);
        this.menu.layoutHUD(visibleWidth, visibleHeight);
    }
    _setupOrthoCamera(gameWidth, gameHeight, aspect) {
        const ORTHO_VIEW_HEIGHT = 12;
        this.orthoCam.top = ORTHO_VIEW_HEIGHT / 2;
        this.orthoCam.bottom = -ORTHO_VIEW_HEIGHT / 2;
        this.orthoCam.left = -ORTHO_VIEW_HEIGHT / 2 * aspect;
        this.orthoCam.right = ORTHO_VIEW_HEIGHT / 2 * aspect;
        this.orthoCam.position.set(0, 0, 10);
        this.orthoCam.lookAt(0, 0, 0);
        this.orthoCam.updateProjectionMatrix();
        const TILE_SIZE = 1.1;
        const gameWorldHeight = gameHeight * TILE_SIZE;
        const gameWorldWidth = gameWidth * TILE_SIZE;
        const availableHeight = ORTHO_VIEW_HEIGHT * .9;
        const availableWidth = ORTHO_VIEW_HEIGHT * aspect * .9;
        const scaleY = gameWorldHeight > 0 ? availableHeight / gameWorldHeight : 1;
        const scaleX = gameWorldWidth > 0 ? availableWidth / gameWorldWidth : 1;
        const scale = Math.min(scaleX, scaleY);
        this.group.scale.set(scale, scale, scale);
    }
    _setupPerspCamera(maxDim, aspect) {
        this.group.scale.set(1, 1, 1);
        this.perspCam.aspect = aspect;
        const distance = maxDim * 2;
        this.perspCam.position.set(0, 0, distance);
        this.perspCam.lookAt(0, 0, 0);
        this.perspCam.updateProjectionMatrix();
    }
    _getUIVisibleBounds(camera, distance = 8) {
        const aspect = window.innerWidth / window.innerHeight;
        if (camera instanceof THREE.PerspectiveCamera) {
            const vFOV = THREE.MathUtils.degToRad(camera.fov);
            const visibleHeight = 2 * Math.tan(vFOV / 2) * Math.abs(distance);
            return {
                visibleWidth: visibleHeight * camera.aspect,
                visibleHeight: visibleHeight
            };
        } else if (camera instanceof THREE.OrthographicCamera) {
            return {
                visibleWidth: camera.right - camera.left,
                visibleHeight: camera.top - camera.bottom
            };
        }
        return {
            visibleWidth: 10 * aspect,
            visibleHeight: 10
        };
    }
    createLabelTexture(text, bgColor, textColor = "#ffffff") {
        const key = `${text}_${bgColor}_${textColor}`;
        if (this.textureCache.has(key)) return this.textureCache.get(key);
        const canvas = document.createElement("canvas");
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            const bgHex = "#" + bgColor.toString(16).padStart(6, "0");
            ctx.fillStyle = bgHex;
            ctx.fillRect(0, 0, 128, 128);
            ctx.font = "bold 80px sans-serif";
            ctx.fillStyle = textColor;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(text, 64, 64);
            ctx.strokeStyle = "rgba(255,255,255,0.2)";
            ctx.lineWidth = 4;
            ctx.strokeRect(2, 2, 124, 124);
        }
        const tex = new THREE.CanvasTexture(canvas);
        this.textureCache.set(key, tex);
        return tex;
    }
    sync(items) {
        if (!this.activeGame) return;
        const activeIds =  new Set;
        const tileSize = 1.1;
        const offsetX = this.activeGame.width * tileSize / 2 - .5;
        const offsetY = this.activeGame.height * tileSize / 2 - .5;
        items.forEach(item => {
            activeIds.add(item.id);
            let mesh = this.meshes.get(item.id);
            const tx = item.x * tileSize - offsetX;
            const ty = item.y * tileSize - offsetY;
            const zOffset = item.type === 0 ? -.1 : 0;
            const color = this.renderConfig.colors[item.type] || 16777215;
            if (!mesh) {
                let geom;
                if (this.renderConfig.geometry === "cylinder") geom = new THREE.CylinderGeometry(.4, .4, .3, 32); else geom = new THREE.BoxGeometry(.9, .9, .9);
                if (this.renderConfig.geometry === "cylinder") geom.rotateX(Math.PI / 2);
                const mat = new THREE.MeshBasicMaterial({
                    color: color
                });
                mesh = new THREE.Mesh(geom, mat);
                this.group.add(mesh);
                this.meshes.set(item.id, mesh);
                if (item.spawnStyle === "instant") {
                    mesh.position.set(tx, ty, zOffset);
                } else if (item.spawnStyle === "pop") {
                    mesh.position.set(tx, ty, zOffset);
                    mesh.scale.set(0, 0, 0);
                    TWEEN.to(mesh.scale, {
                        x: 1,
                        y: 1,
                        z: 1
                    }, 200, "outBack");
                } else {
                    mesh.position.set(tx, ty + 10, zOffset);
                    TWEEN.to(mesh.position, {
                        x: tx,
                        y: ty
                    }, 400, "elastic");
                }
            } else {
                const mat = mesh.material;
                if (item.text !== void 0) {
                    const tex = this.createLabelTexture(item.text, color, item.textColor);
                    if (mat.map !== tex) {
                        mat.map = tex || null;
                        mat.color.setHex(16777215);
                        mat.needsUpdate = true;
                    }
                } else {
                    if (mat.map) {
                        mat.map = null;
                        mat.needsUpdate = true;
                    }
                    mat.color.setHex(color);
                }
                if (Math.abs(mesh.position.x - tx) > .01 || Math.abs(mesh.position.y - ty) > .01 || mesh.position.z !== zOffset) {
                    TWEEN.to(mesh.position, {
                        x: tx,
                        y: ty,
                        z: zOffset
                    }, 150);
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
    disposeMesh(m) {
        if (m.geometry) m.geometry.dispose();
        if (Array.isArray(m.material)) {
            m.material.forEach(mat => mat.dispose());
        } else if (m.material) {
            m.material.dispose();
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
                const shakeIntensity = .2 * this.shake;
                this.activeCamera.position.x += (Math.random() - .5) * shakeIntensity;
                this.activeCamera.position.y += (Math.random() - .5) * shakeIntensity;
                this.shake *= .9;
                if (this.shake < .01) {
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
    getGridFromRay(raycaster) {
        if (!this.activeGame) return null;
        const intersects = raycaster.intersectObjects(this.group.children);
        if (intersects.length > 0) {
            const tileSize = 1.1;
            const offsetX = this.activeGame.width * tileSize / 2 - .5;
            const offsetY = this.activeGame.height * tileSize / 2 - .5;
            const hitPoint = intersects[0].point.clone().divide(this.group.scale);
            const gx = Math.round((hitPoint.x + offsetX) / tileSize);
            const gy = Math.round((hitPoint.y + offsetY) / tileSize);
            return {
                x: gx,
                y: gy
            };
        }
        return null;
    }
    destroy() {
        window.removeEventListener("resize", this.onResize);
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

class InputManager {
    constructor(domElement, cameraGetter, getGridPos) {
        this.virtualSubject = new Subject;
        const KEY_MAP = {
            ArrowUp: "UP",
            w: "UP",
            ArrowDown: "DOWN",
            s: "DOWN",
            ArrowLeft: "LEFT",
            a: "LEFT",
            ArrowRight: "RIGHT",
            d: "RIGHT",
            " ": "SELECT",
            Enter: "SELECT"
        };
        const key$ = fromEvent(window, "keydown").pipe(map(e => KEY_MAP[e.key]), filter(type => !!type), map(type => ({
            type: type
        })));
        const getRayIntersects = (cx, cy) => {
            const cam = cameraGetter();
            if (!cam) return null;
            const mouse = new THREE.Vector2(cx / window.innerWidth * 2 - 1, -(cy / window.innerHeight) * 2 + 1);
            const raycaster = new THREE.Raycaster;
            raycaster.setFromCamera(mouse, cam);
            return raycaster;
        };
        const pointer$ = merge(fromEvent(window, "mousedown").pipe(map(e => ({
            x: e.clientX,
            y: e.clientY
        }))), fromEvent(window, "touchstart").pipe(map(e => {
            const t = e.touches[0];
            return t ? {
                x: t.clientX,
                y: t.clientY
            } : null;
        }), filter(p => p !== null))).pipe(switchMap(start => merge(fromEvent(window, "mouseup").pipe(map(e => ({
            x: e.clientX,
            y: e.clientY
        }))), fromEvent(window, "touchend").pipe(map(e => {
            const t = e.changedTouches[0];
            return t ? {
                x: t.clientX,
                y: t.clientY
            } : null;
        }), filter(p => p !== null))).pipe(take(1), map(end => {
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            if (Math.abs(dx) > 30 || Math.abs(dy) > 30) {
                return {
                    type: Math.abs(dx) > Math.abs(dy) ? dx > 0 ? "RIGHT" : "LEFT" : dy > 0 ? "DOWN" : "UP"
                };
            }
            return {
                type: "SELECT",
                data: {
                    raycaster: getRayIntersects(end.x, end.y)
                }
            };
        }))));
        this.action$ = merge(key$, pointer$, this.virtualSubject).pipe(share());
    }
    emitVirtual(type) {
        this.virtualSubject.next({
            type: type
        });
    }
}

class SoundManager {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.enabled = false;
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (AudioContextClass) {
                this.ctx = new AudioContextClass;
                this.masterGain = this.ctx.createGain();
                this.masterGain.gain.value = .2;
                if (this.ctx) {
                    this.masterGain.connect(this.ctx.destination);
                }
            }
        } catch (e) {
            console.warn("AudioContext initialization failed", e);
        }
    }
    toggle() {
        if (!this.ctx) return false;
        this.enabled = !this.enabled;
        if (this.enabled && this.ctx.state === "suspended") {
            this.ctx.resume().catch(e => console.warn("AudioContext resume failed", e));
        }
        return this.enabled;
    }
    playTone(f, t, d, v = 1) {
        if (!this.enabled || !this.ctx || !this.masterGain) return;
        try {
            if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
            const o = this.ctx.createOscillator();
            const g = this.ctx.createGain();
            o.type = t;
            o.frequency.setValueAtTime(f, this.ctx.currentTime);
            g.gain.setValueAtTime(.1 * v, this.ctx.currentTime);
            g.gain.exponentialRampToValueAtTime(.001, this.ctx.currentTime + d);
            o.connect(g);
            g.connect(this.masterGain);
            o.start();
            o.stop(this.ctx.currentTime + d);
        } catch (e) {}
    }
    playMove() {
        this.playTone(600, "sine", .05, .5);
    }
    playSelect() {
        this.playTone(880, "triangle", .1);
    }
    playMatch() {
        this.playTone(440, "sine", .2);
        setTimeout(() => this.playTone(554, "sine", .2), 50);
        setTimeout(() => this.playTone(659, "sine", .2), 100);
    }
    playExplosion() {
        this.playTone(150, "sawtooth", .3);
        this.playTone(100, "square", .3);
    }
    playGameOver() {
        this.playTone(400, "sawtooth", .3);
        setTimeout(() => this.playTone(300, "sawtooth", .4), 150);
        setTimeout(() => this.playTone(200, "sawtooth", .6), 300);
    }
}

class DebugCamera {
    constructor(renderer) {
        this.isActive = false;
        this.radius = 20;
        this.theta = 0;
        this.phi = Math.PI / 3;
        this.dragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.renderer = renderer;
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, .1, 1e3);
        this.setupControls(renderer.renderer.domElement);
        renderer.addUpdateHook(() => this.update());
        window.addEventListener("resize", () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        });
    }
    setupControls(dom) {
        dom.addEventListener("pointerdown", e => {
            if (!this.isActive) return;
            this.dragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
        });
        window.addEventListener("pointermove", e => {
            if (!this.isActive || !this.dragging) return;
            const dx = e.clientX - this.lastX;
            const dy = e.clientY - this.lastY;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            this.theta -= dx * .01;
            this.phi -= dy * .01;
            this.phi = Math.max(.1, Math.min(Math.PI - .1, this.phi));
        });
        window.addEventListener("pointerup", () => {
            this.dragging = false;
        });
        dom.addEventListener("wheel", e => {
            if (!this.isActive) return;
            e.preventDefault();
            this.radius += e.deltaY * .02;
            this.radius = Math.max(2, Math.min(100, this.radius));
        }, {
            passive: false
        });
    }
    toggle() {
        this.isActive = !this.isActive;
        this.renderer.setExternalCamera(this.isActive ? this.camera : null);
        if (this.isActive) {
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

export { DebugCamera as D, GameRenderer as G, InputManager as I, SoundManager as S };

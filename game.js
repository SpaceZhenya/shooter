import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ─── DOM refs ────────────────────────────────────────────────
const blocker = document.getElementById('blocker');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreVal = document.getElementById('scoreVal');
const healthVal = document.getElementById('healthVal');
const healthFill = document.getElementById('health-fill');
const ammoVal = document.getElementById('ammoVal');
const waveVal = document.getElementById('waveVal');
const reloadEl = document.getElementById('reload');
const gameOverEl = document.getElementById('gameOver');
const finalScore = document.getElementById('finalScore');
const finalWave = document.getElementById('finalWave');
const dmgOverlay = document.getElementById('damage-overlay');
const loadingInfo = document.getElementById('loading-info');

// ─── Procedural textures ─────────────────────────────────────
function makePattern(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d'); fn(ctx, w, h);
    return new THREE.CanvasTexture(c);
}

const roadTex = makePattern(128, 128, (ctx) => {
    ctx.fillStyle = '#555'; ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#666'; ctx.fillRect(0, 0, 128, 2);
    ctx.fillRect(0, 126, 128, 2);
});

const sidewalkTex = makePattern(64, 64, (ctx) => {
    ctx.fillStyle = '#999'; ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
    for (let y = 0; y < 64; y += 16) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(64, y); ctx.stroke(); }
    for (let x = 0; x < 64; x += 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 64); ctx.stroke(); }
});

const glowTex = makePattern(32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,200,100,1)');
    g.addColorStop(0.3, 'rgba(255,100,0,0.6)');
    g.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
});

// ─── Scene setup ─────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x7EC8E3);
scene.fog = new THREE.Fog(0x7EC8E3, 120, 200);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250);
camera.position.set(0, 1.7, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
document.body.prepend(renderer.domElement);

// ─── Sky ─────────────────────────────────────────────────────
const skyGeo = new THREE.SphereGeometry(190, 32, 32);
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 512; skyCanvas.height = 512;
const sctx = skyCanvas.getContext('2d');
const grad = sctx.createLinearGradient(0, 0, 0, 512);
grad.addColorStop(0, '#4A90D9');
grad.addColorStop(0.4, '#7EC8E3');
grad.addColorStop(0.7, '#B5E6F5');
grad.addColorStop(1, '#E8F5E8');
sctx.fillStyle = grad;
sctx.fillRect(0, 0, 512, 512);
// Clouds
for (let i = 0; i < 30; i++) {
    const x = Math.random() * 512, y = 60 + Math.random() * 200;
    const r = 20 + Math.random() * 50;
    sctx.fillStyle = `rgba(255,255,255,${0.15 + Math.random() * 0.25})`;
    sctx.beginPath(); sctx.ellipse(x, y, r, r * 0.5, 0, 0, Math.PI * 2); sctx.fill();
    sctx.beginPath(); sctx.ellipse(x + r * 0.6, y - 5, r * 0.7, r * 0.4, 0, 0, Math.PI * 2); sctx.fill();
}
const skyTex = new THREE.CanvasTexture(skyCanvas);
const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// ─── Lighting ────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0x8899bb, 0.6);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xffeedd, 1.5);
sun.position.set(60, 100, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 160;
sun.shadow.camera.left = -70;
sun.shadow.camera.right = 70;
sun.shadow.camera.top = 70;
sun.shadow.camera.bottom = -70;
scene.add(sun);

const hemi = new THREE.HemisphereLight(0x87CEEB, 0x98D89E, 0.5);
scene.add(hemi);

// ─── Ground ──────────────────────────────────────────────────
const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9 });
const road = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), roadMat);
road.rotation.x = -Math.PI / 2;
road.receiveShadow = true;
scene.add(road);

// Sidewalk border
const swMat = new THREE.MeshStandardMaterial({ map: sidewalkTex, roughness: 0.8 });
const sw = new THREE.Mesh(new THREE.RingGeometry(45, 48, 4), swMat);
sw.rotation.x = -Math.PI / 2;
sw.receiveShadow = true;
scene.add(sw);

// Grass outside
const grassMat = new THREE.MeshStandardMaterial({ color: 0x7EC850, roughness: 0.9 });
const grass = new THREE.Mesh(new THREE.RingGeometry(48, 90, 4), grassMat);
grass.rotation.x = -Math.PI / 2;
grass.receiveShadow = true;
scene.add(grass);

// Road markings (crosswalk)
function createCrosswalk(x, z, rot) {
    const g = new THREE.Group();
    const markMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = -3; i <= 3; i++) {
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.8), markMat);
        strip.rotation.x = -Math.PI / 2;
        strip.position.set(i * 0.45, 0.01, 0);
        g.add(strip);
    }
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    scene.add(g);
}

// Center line
function createRoadLine() {
    const lm = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    for (let z = -42; z <= 42; z += 3) {
        const seg = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 1.5), lm);
        seg.rotation.x = -Math.PI / 2;
        seg.position.set(0, 0.01, z);
        scene.add(seg);
    }
}
createRoadLine();
createCrosswalk(0, -8, 0);
createCrosswalk(0, 8, 0);
createCrosswalk(-8, 0, Math.PI / 2);
createCrosswalk(8, 0, Math.PI / 2);

// ─── Low-poly city buildings ─────────────────────────────────
const walls = [];
const wallBBs = [];

const CITY_COLORS = [
    0xFF6B6B, 0x4ECDC4, 0xFFE66D, 0xFF8E53,
    0xA18CD1, 0x6BCB77, 0xFF6F91, 0x45B7D1,
    0xF7DC6F, 0xBB8FCE, 0x85C1E9, 0xF0B27A,
    0x82E0AA, 0xF1948A, 0x85929E, 0x73C6B6,
];

function createLPBuilding(x, z, w, h, d, color, hasRoof = true) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.6,
        flatShading: true,
    });

    // Main body
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Windows - simple colored squares
    const winMat = new THREE.MeshStandardMaterial({
        color: 0x87CEEB,
        emissive: 0x4488aa,
        emissiveIntensity: 0.2,
        flatShading: true,
    });
    const winMatDark = new THREE.MeshStandardMaterial({
        color: 0x334455,
        flatShading: true,
    });
    const winPositions = [];
    for (let wy = 0.3; wy < h - 0.3; wy += 0.5) {
        for (let wx = -w / 2 + 0.3; wx < w / 2 - 0.2; wx += 0.5) {
            if (Math.random() > 0.3) winPositions.push({ x: wx, y: wy, on: Math.random() > 0.4 });
        }
    }
    // Front face windows
    for (const wp of winPositions.slice(0, Math.min(winPositions.length, 12))) {
        const win = new THREE.Mesh(
            new THREE.PlaneGeometry(0.2, 0.25),
            wp.on ? winMat : winMatDark
        );
        win.position.set(wp.x, wp.y, d / 2 + 0.005);
        group.add(win);
    }

    // Roof accent
    if (hasRoof) {
        const roofMat = new THREE.MeshStandardMaterial({
            color: 0xDDDDDD,
            roughness: 0.7,
            flatShading: true,
        });
        const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.1, d + 0.1), roofMat);
        roof.position.y = h + 0.05;
        roof.castShadow = true;
        roof.receiveShadow = true;
        group.add(roof);

        // Roof box/accent (AC unit)
        if (Math.random() > 0.5) {
            const box = new THREE.Mesh(
                new THREE.BoxGeometry(0.2, 0.15, 0.2),
                new THREE.MeshStandardMaterial({ color: 0x888888, flatShading: true })
            );
            box.position.set(w * 0.2, h + 0.15, d * 0.2);
            group.add(box);
        }
    }

    group.position.set(x, 0, z);
    scene.add(group);
    walls.push(group);
    wallBBs.push(new THREE.Box3(
        new THREE.Vector3(x - w / 2, 0, z - d / 2),
        new THREE.Vector3(x + w / 2, h, z + d / 2)
    ));
    return group;
}

// Building layout - city blocks
const buildings = [
    // Corner buildings - larger
    { x: -22, z: -22, w: 8, h: 5 + Math.random() * 3, d: 8 },
    { x: 22, z: -22, w: 8, h: 5 + Math.random() * 3, d: 8 },
    { x: -22, z: 22, w: 8, h: 5 + Math.random() * 3, d: 8 },
    { x: 22, z: 22, w: 8, h: 5 + Math.random() * 3, d: 8 },
    // Side buildings
    { x: 0, z: -32, w: 12, h: 3 + Math.random() * 2, d: 5 },
    { x: 0, z: 32, w: 12, h: 3 + Math.random() * 2, d: 5 },
    { x: -32, z: 0, w: 5, h: 3 + Math.random() * 2, d: 12 },
    { x: 32, z: 0, w: 5, h: 3 + Math.random() * 2, d: 12 },
    // Inner buildings
    { x: -12, z: -12, w: 5, h: 3 + Math.random() * 3, d: 5 },
    { x: 12, z: -12, w: 5, h: 3 + Math.random() * 3, d: 5 },
    { x: -12, z: 12, w: 5, h: 3 + Math.random() * 3, d: 5 },
    { x: 12, z: 12, w: 5, h: 3 + Math.random() * 3, d: 5 },
    // More fillers
    { x: -26, z: -10, w: 4, h: 2.5, d: 4 },
    { x: 26, z: -10, w: 4, h: 2.5, d: 4 },
    { x: -26, z: 10, w: 4, h: 2.5, d: 4 },
    { x: 26, z: 10, w: 4, h: 2.5, d: 4 },
    { x: -10, z: -26, w: 4, h: 2.5, d: 4 },
    { x: 10, z: -26, w: 4, h: 2.5, d: 4 },
    { x: -10, z: 26, w: 4, h: 2.5, d: 4 },
    { x: 10, z: 26, w: 4, h: 2.5, d: 4 },
    // Center building
    { x: 0, z: 0, w: 4, h: 3, d: 4 },
];

let ci = 0;
for (const b of buildings) {
    createLPBuilding(b.x, b.z, b.w, Math.floor(b.h), b.d, CITY_COLORS[ci % CITY_COLORS.length]);
    ci++;
}

// ─── Low-poly trees ──────────────────────────────────────────
function createLPTree(x, z) {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x8B6914, roughness: 0.9, flatShading: true,
    });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.15, 1.5, 5), trunkMat);
    trunk.position.y = 0.75;
    trunk.castShadow = true;
    group.add(trunk);

    const treeColors = [0x6BCB77, 0x4ECDC4, 0x45B7D1, 0x82E0AA, 0x88D8B0, 0x66BB6A];
    const leafMat = new THREE.MeshStandardMaterial({
        color: treeColors[Math.floor(Math.random() * treeColors.length)],
        roughness: 0.8,
        flatShading: true,
    });
    const crown = new THREE.Mesh(new THREE.ConeGeometry(1.0, 1.5, 6), leafMat);
    crown.position.y = 1.8;
    crown.castShadow = true;
    crown.receiveShadow = true;
    group.add(crown);

    group.position.set(x, 0, z);
    scene.add(group);
    return group;
}

const treePositions = [
    [-36, -36], [36, -36], [-36, 36], [36, 36],
    [-38, -20], [38, 20], [-20, -38], [20, 38],
    [-38, 20], [38, -20], [-20, 38], [20, -38],
    [-42, 0], [42, 0], [0, -42], [0, 42],
];
for (const [x, z] of treePositions) createLPTree(x, z);

// ─── Streetlamps ─────────────────────────────────────────────
function createStreetlamp(x, z) {
    const group = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({
        color: 0x444444, roughness: 0.5, metalness: 0.3, flatShading: true,
    });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 2.5, 5), poleMat);
    pole.position.y = 1.25;
    pole.castShadow = true;
    group.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.03), poleMat);
    arm.position.set(0.15, 2.4, 0);
    group.add(arm);

    const bulbMat = new THREE.MeshStandardMaterial({
        color: 0xFFE66D, emissive: 0xFFE66D, emissiveIntensity: 0.3, flatShading: true,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 5, 5), bulbMat);
    bulb.position.set(0.3, 2.35, 0);
    group.add(bulb);

    group.position.set(x, 0, z);
    scene.add(group);

    const light = new THREE.PointLight(0xffddaa, 0.3, 8);
    light.position.set(x + 0.3, 2.3, z);
    scene.add(light);
    return group;
}

const lampPositions = [
    [-15, -15], [15, -15], [-15, 15], [15, 15],
    [-25, 0], [25, 0], [0, -25], [0, 25],
    [-25, -25], [25, -25], [-25, 25], [25, 25],
];
for (const [x, z] of lampPositions) createStreetlamp(x, z);

// ─── Park benches ────────────────────────────────────────────
function createBench(x, z, rot) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8, flatShading: true });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.04, 0.2), mat);
    seat.position.y = 0.2;
    group.add(seat);
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.03), mat);
    leg1.position.set(-0.25, 0.09, 0.07);
    group.add(leg1);
    const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.03), mat);
    leg2.position.set(0.25, 0.09, 0.07);
    group.add(leg2);
    const leg3 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.03), mat);
    leg3.position.set(-0.25, 0.09, -0.07);
    group.add(leg3);
    const leg4 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.18, 0.03), mat);
    leg4.position.set(0.25, 0.09, -0.07);
    group.add(leg4);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.15, 0.02), mat);
    back.position.set(0, 0.35, -0.1);
    group.add(back);

    group.position.set(x, 0, z);
    group.rotation.y = rot;
    scene.add(group);
    return group;
}

createBench(-13, -16, 0.5);
createBench(13, -16, -0.5);
createBench(-13, 16, -0.5);
createBench(13, 16, 0.5);

// ─── Trash can ───────────────────────────────────────────────
function createTrashCan(x, z) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x556677, roughness: 0.7, flatShading: true });
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.25, 6), mat);
    can.position.y = 0.125;
    can.castShadow = true;
    g.add(can);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.02, 6), mat);
    lid.position.y = 0.26;
    g.add(lid);
    g.position.set(x, 0, z);
    scene.add(g);
}

createTrashCan(-16, -12);
createTrashCan(16, -12);
createTrashCan(-16, 12);
createTrashCan(16, 12);

// ─── Hedges ──────────────────────────────────────────────────
function createHedge(x, z, w) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x4CAF50, roughness: 0.8, flatShading: true });
    const h = new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, 0.3), mat);
    h.position.y = 0.2;
    h.castShadow = true;
    h.receiveShadow = true;
    h.position.set(x, 0.2, z);
    scene.add(h);
    walls.push(h);
    wallBBs.push(new THREE.Box3(
        new THREE.Vector3(x - w / 2, 0, z - 0.15),
        new THREE.Vector3(x + w / 2, 0.4, z + 0.15)
    ));
}

createHedge(-6, -14, 1.8);
createHedge(6, -14, 1.8);
createHedge(-6, 14, 1.8);
createHedge(6, 14, 1.8);

// ─── Weapon model ────────────────────────────────────────────
const weaponGroup = new THREE.Group();

function buildWeapon() {
    const flat = (color, rough = 0.4, metal = 0.6) =>
        new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: true });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.28), flat(0x222233));
    body.position.set(0, -0.05, -0.14); weaponGroup.add(body);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.18, 6), flat(0x111122, 0.3, 0.8));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, -0.05, -0.28); weaponGroup.add(barrel);

    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.04, 6), flat(0x222233, 0.3, 0.7));
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, -0.05, -0.37); weaponGroup.add(tip);

    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.16), flat(0x333344, 0.4, 0.7));
    slide.position.set(0, -0.02, -0.14); weaponGroup.add(slide);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.06), flat(0x332211, 0.8));
    grip.position.set(0, -0.12, 0.04); grip.rotation.x = 0.2; weaponGroup.add(grip);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.03), flat(0x222233, 0.5, 0.6));
    guard.position.set(0, -0.09, -0.02); weaponGroup.add(guard);
}

buildWeapon();
weaponGroup.position.set(0.3, -0.2, -0.35);
camera.add(weaponGroup);
scene.add(camera);

// ─── GLTF human model loader ─────────────────────────────────
let loadedHumanModels = [];
let modelsReady = false;

const MODEL_URLS = [
    'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.gltf',
];

const skinTones = [0xF5D0A9, 0xDEB887, 0xC68642, 0x8D5524, 0xE8C492, 0xD4A574];
const shirtColors = [0xFFFFFF, 0xFF6B6B, 0x4ECDC4, 0xFFE66D, 0xA18CD1, 0x6BCB77, 0x45B7D1, 0xFF8E53, 0x222222];
const pantsColors = [0x2F4F4F, 0x333344, 0x444466, 0x555555, 0x1a1a2e];
const shoeColors = [0x1a1a1a, 0x333333, 0x3a2a1a];

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function loadHumanModels() {
    const loader = new GLTFLoader();
    let loaded = 0;
    for (const url of MODEL_URLS) {
        loader.load(url, (gltf) => {
            const model = gltf.scene;
            model.scale.set(0.55, 0.55, 0.55);
            model.traverse((child) => { if (child.isMesh) { child.castShadow = true; child.receiveShadow = true; } });
            loadedHumanModels.push(model);
            loaded++;
            if (loaded >= MODEL_URLS.length) {
                modelsReady = true;
                loadingInfo.textContent = '✓ Модели загружены!';
                loadingInfo.style.color = '#4a4';
            }
        }, undefined, () => {
            loaded++;
            if (loaded >= MODEL_URLS.length) {
                loadingInfo.textContent = '✓ Игра готова!';
                loadingInfo.style.color = '#888';
            }
        });
    }
}
loadHumanModels();

// ─── Procedural human model ──────────────────────────────────
function createProceduralHuman() {
    const group = new THREE.Group();
    const skin = pickRandom(skinTones);
    const shirt = pickRandom(shirtColors);
    const pants = pickRandom(pantsColors);
    const shoes = pickRandom(shoeColors);

    const flat = (color, rough = 0.6, metal = 0.1) =>
        new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, flatShading: true });

    const shoeMat = flat(shoes, 0.8);
    new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.18), shoeMat)
        .applyMatrix4(new THREE.Matrix4().makeTranslation(-0.12, 0.025, 0.04)).castShadow = true;
    const footL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.18), shoeMat);
    footL.position.set(-0.12, 0.025, 0.04); footL.castShadow = true; group.add(footL);
    const footR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.18), shoeMat);
    footR.position.set(0.12, 0.025, 0.04); footR.castShadow = true; group.add(footR);

    const pantsMat = flat(pants, 0.7);
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.55, 6), pantsMat);
    legL.position.set(-0.12, 0.3, 0); legL.castShadow = true; group.add(legL);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.55, 6), pantsMat);
    legR.position.set(0.12, 0.3, 0); legR.castShadow = true; group.add(legR);

    const shirtMat = flat(shirt, 0.5);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 6), shirtMat);
    torso.position.y = 0.8; torso.castShadow = true; group.add(torso);

    const shoulderMat = flat(shirt, 0.5);
    const shL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 5), shoulderMat);
    shL.position.set(-0.28, 1.0, 0); group.add(shL);
    const shR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 5, 5), shoulderMat);
    shR.position.set(0.28, 1.0, 0); group.add(shR);

    const skinMat = flat(skin, 0.5);
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.45, 5), skinMat);
    armL.position.set(-0.32, 0.78, 0); armL.rotation.z = 0.15; armL.castShadow = true; group.add(armL);
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.45, 5), skinMat);
    armR.position.set(0.32, 0.78, 0); armR.rotation.z = -0.15; armR.castShadow = true; group.add(armR);

    const handMat = flat(skin, 0.5);
    const hL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 4), handMat);
    hL.position.set(-0.34, 0.55, 0); group.add(hL);
    const hR = new THREE.Mesh(new THREE.SphereGeometry(0.035, 4, 4), handMat);
    hR.position.set(0.34, 0.55, 0); group.add(hR);

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 5), skinMat);
    neck.position.y = 1.08; group.add(neck);

    const headMat = flat(skin, 0.4);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), headMat);
    head.position.y = 1.2; head.castShadow = true; group.add(head);

    const hairColors = [0x1a1a1a, 0x2a1a0a, 0x3a2a1a, 0xa08050, 0xc0a060];
    const hairMat = flat(pickRandom(hairColors), 0.7);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.145, 6, 6, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
    hair.position.y = 1.24; group.add(hair);

    const eyeMat = flat(0xffffff, 0.1);
    const pupilMat = flat(0x222222, 0.1);
    for (const side of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 5, 5), eyeMat);
        e.position.set(side * 0.06, 1.22, -0.12); group.add(e);
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.015, 4, 4), pupilMat);
        p.position.set(side * 0.06, 1.22, -0.09); group.add(p);
    }

    const allMats = [shirtMat, pantsMat, skinMat, headMat, shoeMat, hairMat,
        legL.material, legR.material, armL.material, armR.material];
    return { group, materials: allMats };
}

// ─── Apply colors to GLTF model ─────────────────────────────
function applyModelColors(model) {
    const skin = pickRandom(skinTones);
    const shirt = pickRandom(shirtColors);
    const pants = pickRandom(pantsColors);
    const shoes = pickRandom(shoeColors);
    const mats = [];
    model.traverse((child) => {
        if (child.isMesh) {
            const name = child.name ? child.name.toLowerCase() : '';
            let color = 0x888888;
            if (name.includes('head') || name.includes('face') || name.includes('neck') || name.includes('hand') || name.includes('arm')) {
                color = skin;
            } else if (name.includes('body') || name.includes('torso') || name.includes('shirt') || name.includes('upper') || name.includes('coat')) {
                color = shirt;
            } else if (name.includes('leg') || name.includes('pant') || name.includes('hip') || name.includes('thigh')) {
                color = pants;
            } else if (name.includes('foot') || name.includes('shoe') || name.includes('boot')) {
                color = shoes;
            }
            child.material = child.material.clone();
            child.material.color.setHex(color);
            child.material.roughness = 0.6;
            child.material.flatShading = true;
            mats.push(child.material);
        }
    });
    return mats;
}

function createEnemyModel() {
    if (modelsReady && loadedHumanModels.length > 0) {
        const src = loadedHumanModels[Math.floor(Math.random() * loadedHumanModels.length)];
        const clone = src.clone(true);
        const mats = applyModelColors(clone);
        return { group: clone, materials: mats };
    }
    return createProceduralHuman();
}

// ─── Ambient particles ───────────────────────────────────────
const ambientParticles = [];

function createAmbientParticle() {
    const size = 0.02 + Math.random() * 0.04;
    const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.08 + Math.random() * 0.12,
        depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 3, 3), mat);
    const angle = Math.random() * Math.PI * 2;
    const dist = 10 + Math.random() * 40;
    mesh.position.set(Math.cos(angle) * dist, 0.5 + Math.random() * 5, Math.sin(angle) * dist);
    mesh.userData = {
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.2),
        life: 5 + Math.random() * 10,
        maxLife: 5 + Math.random() * 10,
    };
    scene.add(mesh);
    ambientParticles.push(mesh);
}
for (let i = 0; i < 60; i++) createAmbientParticle();

// ─── Particle system ─────────────────────────────────────────
const particles = [];

function spawnParticles(pos, color, count, speed, lifetime, size) {
    for (let i = 0; i < count; i++) {
        const s = size || (0.03 + Math.random() * 0.05);
        const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 4, 4), mat);
        mesh.position.copy(pos);
        const dir = new THREE.Vector3(
            (Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(speed * (0.5 + Math.random()));
        mesh.userData = { vel: dir, life: lifetime || 0.5 + Math.random() * 0.5, maxLife: lifetime || 0.5 + Math.random() * 0.5, gravity: 1.5 };
        scene.add(mesh);
        particles.push(mesh);
    }
}

function spawnHitSparks(pos, normal) {
    for (let i = 0; i < 6; i++) {
        const s = 0.01 + Math.random() * 0.02;
        const mat = new THREE.MeshBasicMaterial({ color: 0xffff88, transparent: true, opacity: 1, depthWrite: false });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 4, 4), mat);
        mesh.position.copy(pos).add(normal.clone().multiplyScalar(0.05));
        const dir = normal.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8
        )).normalize().multiplyScalar(1.5 + Math.random() * 3);
        mesh.userData = { vel: dir, life: 0.2 + Math.random() * 0.25, maxLife: 0.2 + Math.random() * 0.25, gravity: 4 };
        scene.add(mesh);
        particles.push(mesh);
    }
}

function spawnBlood(pos) {
    for (let i = 0; i < 6; i++) {
        const s = 0.03 + Math.random() * 0.05;
        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0, 0.8, 0.15 + Math.random() * 0.1),
            transparent: true, opacity: 0.8, depthWrite: false,
        });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 4, 4), mat);
        mesh.position.copy(pos);
        const dir = new THREE.Vector3(
            (Math.random() - 0.5) * 2, Math.random() * 1.5 + 0.5, (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(1 + Math.random() * 2);
        mesh.userData = { vel: dir, life: 0.5 + Math.random() * 0.5, maxLife: 0.5 + Math.random() * 0.5, gravity: 3 };
        scene.add(mesh);
        particles.push(mesh);
    }
}

function spawnExplosion(pos) {
    for (let i = 0; i < 15; i++) {
        const s = 0.05 + Math.random() * 0.12;
        const hue = 0.04 + Math.random() * 0.1;
        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(hue, 1, 0.4 + Math.random() * 0.4),
            transparent: true, opacity: 1, depthWrite: false,
        });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 5, 5), mat);
        mesh.position.copy(pos);
        const dir = new THREE.Vector3(
            (Math.random() - 0.5) * 2.5, Math.random() * 2, (Math.random() - 0.5) * 2.5
        ).normalize().multiplyScalar(2 + Math.random() * 4);
        mesh.userData = { vel: dir, life: 0.3 + Math.random() * 0.5, maxLife: 0.3 + Math.random() * 0.5, gravity: 2 };
        scene.add(mesh);
        particles.push(mesh);
    }
}

// ─── Player state ────────────────────────────────────────────
const player = {
    position: new THREE.Vector3(0, 1.7, 0),
    velocity: new THREE.Vector3(),
    health: 100, maxHealth: 100,
    score: 0,
    ammo: 30, maxAmmo: 30,
    reloading: false, reloadTime: 2000,
    lastShot: 0, shootCooldown: 120, damage: 34,
    moveSpeed: 6, runSpeed: 11,
    isRunning: false, bobPhase: 0, bobAmount: 0,
};

let pitch = 0, yaw = 0;
const sensitivity = 0.0018;

// ─── Enemies ─────────────────────────────────────────────────
const enemies = [];
let wave = 1, enemiesAlive = 0, enemiesPerWave = 3, gameRunning = false;
const raycaster = new THREE.Raycaster();

// ─── Audio ───────────────────────────────────────────────────
let audioCtx = null;
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }

function playSound(type) {
    try {
        initAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        const t = audioCtx.currentTime;
        switch (type) {
            case 'shoot':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(900, t); osc.frequency.exponentialRampToValueAtTime(150, t + 0.06);
                gain.gain.setValueAtTime(0.08, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
                osc.start(t); osc.stop(t + 0.06); break;
            case 'hit':
                osc.type = 'square';
                osc.frequency.setValueAtTime(200, t); osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);
                gain.gain.setValueAtTime(0.06, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
                osc.start(t); osc.stop(t + 0.08); break;
            case 'kill':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, t); osc.frequency.exponentialRampToValueAtTime(40, t + 0.4);
                gain.gain.setValueAtTime(0.1, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
                osc.start(t); osc.stop(t + 0.4); break;
            case 'hurt':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(150, t); osc.frequency.exponentialRampToValueAtTime(60, t + 0.2);
                gain.gain.setValueAtTime(0.15, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                osc.start(t); osc.stop(t + 0.2); break;
        }
    } catch (e) { }
}

// ─── Create enemy ────────────────────────────────────────────
function createEnemy() {
    const { group, materials } = createEnemyModel();
    let x, z;
    do {
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 20;
        x = Math.cos(angle) * dist;
        z = Math.sin(angle) * dist;
    } while (Math.abs(x) < 8 && Math.abs(z) < 8);
    group.position.set(x, 0, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    scene.add(group);
    const health = 60 + wave * 15;
    enemies.push({ mesh: group, health, maxHealth: health, speed: Math.min(2 + wave * 0.25, 5.5), damage: 10 + wave * 2, attackRange: 1.8, attackCooldown: 1200, lastAttack: 0, materials: materials || [] });
    enemiesAlive++;
}

function spawnWave() {
    waveVal.textContent = wave;
    const count = enemiesPerWave + Math.floor(wave * 0.7);
    for (let i = 0; i < count; i++) setTimeout(() => createEnemy(), i * 250);
}

// ─── Collision ───────────────────────────────────────────────
function checkCollision(pos, r = 0.35) {
    for (const bb of wallBBs) {
        if (pos.x + r > bb.min.x && pos.x - r < bb.max.x &&
            pos.z + r > bb.min.z && pos.z - r < bb.max.z &&
            pos.y < bb.max.y) return true;
    }
    if (Math.abs(pos.x) > 48 || Math.abs(pos.z) > 48) return true;
    return false;
}

// ─── Shooting effects ────────────────────────────────────────
function createMuzzleFlash() {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    spawnParticles(camera.position.clone().add(dir.multiplyScalar(0.7)), 0xffaa44, 5, 3, 0.15, 0.03);
    const flash = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xffff88, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
    );
    flash.position.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(0.55));
    flash.lookAt(camera.position);
    scene.add(flash);
    setTimeout(() => { flash.material.opacity = 0; setTimeout(() => scene.remove(flash), 50); }, 30);
}

const bulletHoles = [];
function createBulletHole(point, normal) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.04, 6), new THREE.MeshBasicMaterial({ color: 0x222222, depthTest: true }));
    hole.position.copy(point).add(normal.clone().multiplyScalar(0.02));
    hole.lookAt(point.clone().add(normal));
    scene.add(hole);
    bulletHoles.push(hole);
    if (bulletHoles.length > 40) scene.remove(bulletHoles.shift());
    spawnHitSparks(point, normal);
}

// ─── Shoot ───────────────────────────────────────────────────
function shoot() {
    if (!gameRunning || player.reloading) return;
    if (player.ammo <= 0) { startReload(); return; }
    const now = Date.now();
    if (now - player.lastShot < player.shootCooldown) return;
    player.lastShot = now;
    player.ammo--;
    updateHUD();
    playSound('shoot');
    createMuzzleFlash();
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    let hit = false;
    for (const enemy of enemies) {
        const meshes = [];
        enemy.mesh.traverse((c) => { if (c.isMesh) meshes.push(c); });
        const intersects = raycaster.intersectObjects(meshes);
        if (intersects.length > 0) {
            enemy.health -= player.damage; hit = true;
            spawnBlood(intersects[0].point); playSound('hit');
            for (const m of enemy.materials) { m._origColor = m._origColor || m.color.getHex(); m.color.setHex(0xffffff); }
            setTimeout(() => { for (const m of enemy.materials) { if (m.color && m._origColor) m.color.setHex(m._origColor); } }, 60);
            if (enemy.health <= 0) { killEnemy(enemy); break; }
        }
    }
    if (!hit) { const wi = raycaster.intersectObjects(walls); if (wi.length > 0) createBulletHole(wi[0].point, wi[0].face.normal); }
}

// ─── Kill enemy ──────────────────────────────────────────────
function killEnemy(enemy) {
    spawnExplosion(enemy.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)));
    scene.remove(enemy.mesh);
    const idx = enemies.indexOf(enemy);
    if (idx > -1) enemies.splice(idx, 1);
    enemiesAlive--; player.score += 100; updateHUD(); playSound('kill');
    if (enemiesAlive <= 0) { wave++; setTimeout(spawnWave, 2500); }
}

// ─── Reload ──────────────────────────────────────────────────
function startReload() {
    if (player.reloading || player.ammo === player.maxAmmo) return;
    player.reloading = true; reloadEl.style.display = 'block';
    setTimeout(() => { player.ammo = player.maxAmmo; player.reloading = false; reloadEl.style.display = 'none'; updateHUD(); }, player.reloadTime);
}

// ─── Hurt player ─────────────────────────────────────────────
function hurtPlayer(amount) {
    player.health = Math.max(0, player.health - amount); updateHUD(); playSound('hurt');
    dmgOverlay.style.opacity = '1'; setTimeout(() => { dmgOverlay.style.opacity = '0'; }, 150);
    if (player.health <= 0) gameOver();
}

// ─── Game over / reset ───────────────────────────────────────
function gameOver() {
    gameRunning = false; document.exitPointerLock();
    finalScore.textContent = player.score; finalWave.textContent = wave;
    gameOverEl.style.display = 'flex';
}

function resetGame() {
    for (const e of enemies) scene.remove(e.mesh);
    enemies.length = 0; enemiesAlive = 0; wave = 1;
    for (const h of bulletHoles) scene.remove(h);
    bulletHoles.length = 0;
    for (const p of particles) scene.remove(p);
    particles.length = 0;
    player.health = player.maxHealth; player.score = 0; player.ammo = player.maxAmmo; player.reloading = false;
    player.position.set(0, 1.7, 0); camera.position.set(0, 1.7, 0);
    pitch = 0; yaw = 0; weaponGroup.position.set(0.3, -0.2, -0.35);
    gameOverEl.style.display = 'none'; dmgOverlay.style.opacity = '0'; reloadEl.style.display = 'none';
    updateHUD(); spawnWave(); gameRunning = true;
}

function updateHUD() {
    scoreVal.textContent = player.score;
    healthVal.textContent = Math.max(0, Math.round(player.health));
    healthFill.style.width = `${(player.health / player.maxHealth) * 100}%`;
    ammoVal.textContent = player.ammo;
}

// ─── Controls ────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'r' && gameRunning) startReload();
});
document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    yaw -= e.movementX * sensitivity; pitch -= e.movementY * sensitivity;
    pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
});
document.addEventListener('mousedown', (e) => { if (e.button === 0 && document.pointerLockElement === renderer.domElement) shoot(); });
startBtn.addEventListener('click', () => { initAudio(); blocker.style.display = 'none'; renderer.domElement.requestPointerLock(); resetGame(); });
restartBtn.addEventListener('click', () => { gameOverEl.style.display = 'none'; renderer.domElement.requestPointerLock(); resetGame(); });
window.addEventListener('resize', () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); });

// ─── Game loop ───────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);

    for (let i = ambientParticles.length - 1; i >= 0; i--) {
        const p = ambientParticles[i];
        p.userData.life -= delta;
        p.position.add(p.userData.vel.clone().multiplyScalar(delta));
        p.material.opacity = Math.max(0, (p.userData.life / p.userData.maxLife) * 0.12);
        if (p.userData.life <= 0) { scene.remove(p); ambientParticles.splice(i, 1); }
    }
    while (ambientParticles.length < 60) createAmbientParticle();

    if (gameRunning) {
        player.isRunning = !!keys['shift'];
        const speed = player.isRunning ? player.runSpeed : player.moveSpeed;
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        const move = new THREE.Vector3();
        if (keys['w']) move.add(forward); if (keys['s']) move.sub(forward);
        if (keys['a']) move.sub(right); if (keys['d']) move.add(right);
        if (move.length() > 0) {
            move.normalize().multiplyScalar(speed * delta);
            const np = player.position.clone().add(move);
            if (!checkCollision(np)) player.position.copy(np);
            else {
                const tx = player.position.clone().add(new THREE.Vector3(move.x, 0, 0));
                if (!checkCollision(tx)) player.position.x = tx.x;
                const tz = player.position.clone().add(new THREE.Vector3(0, 0, move.z));
                if (!checkCollision(tz)) player.position.z = tz.z;
            }
            player.bobPhase += delta * (player.isRunning ? 12 : 8);
            player.bobAmount = player.isRunning ? 0.04 : 0.02;
        } else { player.bobPhase *= 0.9; player.bobAmount *= 0.9; }

        camera.position.copy(player.position);
        camera.quaternion.setFromEuler(new THREE.Euler(pitch, yaw, 0, 'YXZ'));

        const bobX = Math.sin(player.bobPhase) * player.bobAmount;
        const bobY = Math.abs(Math.cos(player.bobPhase)) * player.bobAmount;
        weaponGroup.position.x = 0.3 + bobX; weaponGroup.position.y = -0.2 + bobY;
        const kickT = (Date.now() - player.lastShot) / 200;
        if (kickT < 1) { const k = 1 - kickT; weaponGroup.rotation.x = -0.03 * k * k; weaponGroup.position.y -= 0.02 * k * k; }
        else weaponGroup.rotation.x *= 0.95;

        for (const enemy of enemies) {
            const dir = new THREE.Vector3().copy(player.position).sub(enemy.mesh.position);
            dir.y = 0; const dist = dir.length();
            if (dist > enemy.attackRange) {
                dir.normalize().multiplyScalar(enemy.speed * delta);
                enemy.mesh.position.add(dir);
                enemy.mesh.rotation.y = Math.atan2(dir.x, dir.z);
            } else {
                const now = Date.now();
                if (now - enemy.lastAttack > enemy.attackCooldown) {
                    enemy.lastAttack = now; hurtPlayer(enemy.damage);
                    spawnBlood(player.position.clone().add(new THREE.Vector3(0, 1, 0)));
                }
            }
        }
        waveVal.textContent = wave;
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.userData.life -= delta;
        p.position.add(p.userData.vel.clone().multiplyScalar(delta));
        p.userData.vel.y -= p.userData.gravity * delta;
        const t = p.userData.life / p.userData.maxLife;
        p.material.opacity = Math.max(0, t * 0.8);
        p.scale.setScalar(0.5 + t * 0.5);
        if (p.userData.life <= 0) { scene.remove(p); particles.splice(i, 1); }
    }

    renderer.render(scene, camera);
}

animate();

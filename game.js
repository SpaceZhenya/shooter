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
function makeGrassTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#4a7a4a';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 8000; i++) {
        const x = Math.random() * 256, y = Math.random() * 256;
        const g = 100 + Math.random() * 100;
        ctx.fillStyle = `rgb(40,${g},40)`;
        ctx.fillRect(x, y, 1, 2 + Math.random() * 3);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(30, 30);
    tex.anisotropy = 4;
    return tex;
}

function makeBuildingTexture() {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#666';
    ctx.fillRect(0, 0, 128, 128);
    for (let y = 12; y < 128; y += 28) {
        for (let x = 8; x < 128; x += 24) {
            ctx.fillStyle = '#334';
            ctx.fillRect(x, y, 12, 18);
            ctx.fillStyle = '#aac4e0';
            ctx.fillRect(x + 2, y + 2, 8, 14);
        }
    }
    const tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    return tex;
}

function makeCrateTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = '#5a4510';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 60, 60);
    ctx.strokeRect(6, 6, 52, 52);
    return new THREE.CanvasTexture(c);
}

function makeEmissiveGlow() {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,200,100,1)');
    g.addColorStop(0.3, 'rgba(255,100,0,0.6)');
    g.addColorStop(1, 'rgba(255,50,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
}

const grassTex = makeGrassTexture();
const buildTex = makeBuildingTexture();
const crateTex = makeCrateTexture();
const glowTex = makeEmissiveGlow();

// ─── Scene setup ─────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.FogExp2(0x1a1a2e, 0.006);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 250);
camera.position.set(0, 1.7, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.prepend(renderer.domElement);

// ─── Sky ─────────────────────────────────────────────────────
const skyGeo = new THREE.SphereGeometry(190, 32, 32);
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 512; skyCanvas.height = 512;
const sctx = skyCanvas.getContext('2d');
const grad = sctx.createLinearGradient(0, 0, 0, 512);
grad.addColorStop(0, '#0a0a1a');
grad.addColorStop(0.3, '#1a1a3e');
grad.addColorStop(0.5, '#2a1a2e');
grad.addColorStop(0.7, '#4a2a3e');
grad.addColorStop(0.85, '#8a4a3e');
grad.addColorStop(1, '#1a1a2e');
sctx.fillStyle = grad;
sctx.fillRect(0, 0, 512, 512);
for (let i = 0; i < 600; i++) {
    const x = Math.random() * 512, y = Math.random() * 320;
    const r = 0.5 + Math.random() * 1.5;
    const b = 100 + Math.random() * 155;
    sctx.fillStyle = `rgba(${b},${b},${200 + Math.random() * 55},${0.3 + Math.random() * 0.7})`;
    sctx.beginPath(); sctx.arc(x, y, r, 0, Math.PI * 2); sctx.fill();
}
const skyTex = new THREE.CanvasTexture(skyCanvas);
const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// ─── Lighting ────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0x223366, 0.4);
scene.add(ambient);

const moon = new THREE.DirectionalLight(0x8888cc, 0.6);
moon.position.set(-40, 60, -20);
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.near = 0.5;
moon.shadow.camera.far = 160;
moon.shadow.camera.left = -60;
moon.shadow.camera.right = 60;
moon.shadow.camera.top = 60;
moon.shadow.camera.bottom = -60;
scene.add(moon);

const hemi = new THREE.HemisphereLight(0x334488, 0x223322, 0.3);
scene.add(hemi);

// ─── Ground ──────────────────────────────────────────────────
const groundGeo = new THREE.PlaneGeometry(180, 180, 1, 1);
const groundMat = new THREE.MeshStandardMaterial({
    map: grassTex,
    roughness: 0.95,
    metalness: 0,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ─── World objects ───────────────────────────────────────────
const walls = [];
const wallBBs = [];

function createBuilding(x, z, w, h, d, color) {
    const group = new THREE.Group();
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
        map: buildTex,
        roughness: 0.8,
        metalness: 0.1,
        color,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    const roofMat = new THREE.MeshStandardMaterial({ color: 0x444455, roughness: 0.9 });
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.2, d + 0.4), roofMat);
    roof.position.y = h / 2 + 0.1;
    roof.castShadow = true;
    roof.receiveShadow = true;
    group.add(roof);

    group.position.set(x, 0, z);
    scene.add(group);
    walls.push(group);
    wallBBs.push(new THREE.Box3(new THREE.Vector3(x - w/2, 0, z - d/2), new THREE.Vector3(x + w/2, h, z + d/2)));
    return group;
}

function createCrate(x, z, size) {
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshStandardMaterial({ map: crateTex, roughness: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, size / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    walls.push(mesh);
    const half = size / 2;
    wallBBs.push(new THREE.Box3(new THREE.Vector3(x - half, 0, z - half), new THREE.Vector3(x + half, size, z + half)));
    return mesh;
}

function createTree(x, z) {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.9 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 2, 6), trunkMat);
    trunk.position.y = 1;
    trunk.castShadow = true;
    group.add(trunk);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x1a3a1a, roughness: 0.8 });
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(1.2, 7, 7), canopyMat);
    canopy.position.y = 2.4;
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    group.add(canopy);
    group.position.set(x, 0, z);
    scene.add(group);
    return group;
}

function createLamppost(x, z) {
    const group = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.5, metalness: 0.7 });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3, 6), poleMat);
    pole.position.y = 1.5;
    pole.castShadow = true;
    group.add(pole);

    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.04), poleMat);
    arm.position.set(0.2, 2.9, 0);
    group.add(arm);

    const bulbMat = new THREE.MeshStandardMaterial({
        color: 0xff8833,
        emissive: 0xff6600,
        emissiveIntensity: 0.8,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), bulbMat);
    bulb.position.set(0.4, 2.85, 0);
    group.add(bulb);

    const glow = new THREE.Mesh(
        new THREE.PlaneGeometry(1.2, 1.2),
        new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })
    );
    glow.position.set(0.4, 2.7, 0);
    glow.lookAt(0, 2.7, 1);
    group.add(glow);

    group.position.set(x, 0, z);
    scene.add(group);

    const light = new THREE.PointLight(0xff6600, 0.6, 10);
    light.position.set(x + 0.4, 2.7, z);
    scene.add(light);
    return group;
}

function createBarricade(x, z, angle) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x554433, roughness: 0.9 });
    const plank = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 0.1), mat);
    plank.position.y = 0.3;
    plank.castShadow = true;
    plank.receiveShadow = true;
    group.add(plank);
    const plank2 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.1, 0.1), mat);
    plank2.position.y = 0.65;
    plank2.castShadow = true;
    group.add(plank2);
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), mat);
    leg1.position.set(-0.7, 0.3, 0);
    group.add(leg1);
    const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), mat);
    leg2.position.set(0.7, 0.3, 0);
    group.add(leg2);
    group.position.set(x, 0, z);
    group.rotation.y = angle;
    scene.add(group);
    walls.push(group);
    const hw = 0.9, hd = 0.3;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const cx = x, cz = z;
    wallBBs.push(new THREE.Box3(
        new THREE.Vector3(cx - hw * Math.abs(cos) - hd * Math.abs(sin), 0, cz - hw * Math.abs(sin) - hd * Math.abs(cos)),
        new THREE.Vector3(cx + hw * Math.abs(cos) + hd * Math.abs(sin), 0.8, cz + hw * Math.abs(sin) + hd * Math.abs(cos))
    ));
    return group;
}

// ─── Build arena ─────────────────────────────────────────────
createBuilding(-28, -28, 10, 6, 10, 0x777788);
createBuilding(28, -28, 10, 6, 10, 0x777788);
createBuilding(-28, 28, 10, 6, 10, 0x777788);
createBuilding(28, 28, 10, 6, 10, 0x777788);
createBuilding(0, -36, 14, 3.5, 5, 0x887766);
createBuilding(0, 36, 14, 3.5, 5, 0x887766);
createBuilding(-38, 0, 5, 3.5, 14, 0x887766);
createBuilding(38, 0, 5, 3.5, 14, 0x887766);
createBuilding(0, 0, 6, 4, 6, 0x666688);

const cratePos = [
    [-16, -16], [16, -16], [-16, 16], [16, 16],
    [-30, -10], [30, 10], [10, -30], [-10, 30],
    [-30, 15], [30, -15], [15, 30], [-15, -30],
    [-8, -8], [8, 8], [-8, 8], [8, -8],
];
for (const [x, z] of cratePos) createCrate(x, z, 0.8);

const treePos = [
    [-40, -40], [40, -40], [-40, 40], [40, 40],
    [-40, -20], [40, 20], [-20, -40], [20, 40],
    [-44, 0], [44, 0], [0, -44], [0, 44],
];
for (const [x, z] of treePos) createTree(x, z);

const lampPos = [
    [-20, -20], [20, -20], [-20, 20], [20, 20],
    [0, -20], [0, 20], [-20, 0], [20, 0],
];
for (const [x, z] of lampPos) createLamppost(x, z);

createBarricade(-6, -14, 0);
createBarricade(6, -14, 0);
createBarricade(-6, 14, Math.PI);
createBarricade(6, 14, Math.PI);
createBarricade(-14, -6, Math.PI / 2);
createBarricade(-14, 6, Math.PI / 2);
createBarricade(14, -6, -Math.PI / 2);
createBarricade(14, 6, -Math.PI / 2);

// ─── Weapon model ────────────────────────────────────────────
const weaponGroup = new THREE.Group();

function buildWeapon() {
    const mat = (color, roughness = 0.4, metalness = 0.6) =>
        new THREE.MeshStandardMaterial({ color, roughness, metalness });

    const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.28), mat(0x222233));
    body.position.set(0, -0.05, -0.14);
    weaponGroup.add(body);

    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.18, 8), mat(0x111122, 0.3, 0.8));
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, -0.05, -0.28);
    weaponGroup.add(barrel);

    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.04, 8), mat(0x222233, 0.3, 0.7));
    tip.rotation.x = Math.PI / 2;
    tip.position.set(0, -0.05, -0.37);
    weaponGroup.add(tip);

    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.16), mat(0x333344, 0.4, 0.7));
    slide.position.set(0, -0.02, -0.14);
    weaponGroup.add(slide);

    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.06), mat(0x332211, 0.8));
    grip.position.set(0, -0.12, 0.04);
    grip.rotation.x = 0.2;
    weaponGroup.add(grip);

    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.03), mat(0x222233, 0.5, 0.6));
    guard.position.set(0, -0.09, -0.02);
    weaponGroup.add(guard);

    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.015, 0.004), mat(0xff4400, 0.3, 0.5));
    sight.position.set(0, 0.01, -0.18);
    sight.material.emissive = new THREE.Color(0xff4400);
    sight.material.emissiveIntensity = 0.3;
    weaponGroup.add(sight);
}

buildWeapon();
weaponGroup.position.set(0.3, -0.2, -0.35);
camera.add(weaponGroup);
scene.add(camera);

// ─── Load GLTF human models ──────────────────────────────────
let loadedHumanModels = [];
let modelsReady = false;

const MODEL_URLS = [
    'https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.gltf',
];

const skinTones = [
    0xf5d0a9, 0xdeb887, 0xc68642, 0x8d5524,
    0xe8c492, 0xd4a574, 0xbe7c4a, 0xa0522d,
];

const shirtColors = [
    0xffffff, 0xcccccc, 0x888888, 0x444444,
    0x2244aa, 0xaa2222, 0x22aa44, 0x222222,
    0x8B4513, 0x2F4F4F, 0x800020, 0x556B2F,
];

const pantsColors = [
    0x2F4F4F, 0x333344, 0x444444, 0x555555,
    0x1a1a2e, 0x3B3B3B, 0x4a4a4a, 0x2a2a3a,
];

const shoeColors = [0x1a1a1a, 0x333333, 0x3a2a1a, 0xffffff];

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function loadHumanModels() {
    const loader = new GLTFLoader();
    let loaded = 0;

    for (const url of MODEL_URLS) {
        loader.load(url, (gltf) => {
            const model = gltf.scene;
            model.scale.set(0.55, 0.55, 0.55);
            model.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
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
                loadingInfo.textContent = '✓ Используются процедурные модели';
                loadingInfo.style.color = '#884';
            }
        });
    }
}

loadHumanModels();

// ─── Procedural human model (fallback) ───────────────────────
function createProceduralHuman() {
    const group = new THREE.Group();
    const skin = pickRandom(skinTones);
    const shirt = pickRandom(shirtColors);
    const pants = pickRandom(pantsColors);
    const shoes = pickRandom(shoeColors);

    const mat = (color, rough = 0.6, metal = 0.1, emit = null, ei = 0) => {
        const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
        if (emit) { m.emissive = new THREE.Color(emit); m.emissiveIntensity = ei; }
        return m;
    };

    // Feet / shoes
    const shoeMat = mat(shoes, 0.8);
    const footL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.18), shoeMat);
    footL.position.set(-0.12, 0.025, 0.04);
    footL.castShadow = true;
    group.add(footL);
    const footR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.18), shoeMat);
    footR.position.set(0.12, 0.025, 0.04);
    footR.castShadow = true;
    group.add(footR);

    // Legs
    const pantsMat = mat(pants, 0.7);
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.55, 7), pantsMat);
    legL.position.set(-0.12, 0.3, 0);
    legL.castShadow = true;
    group.add(legL);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.55, 7), pantsMat);
    legR.position.set(0.12, 0.3, 0);
    legR.castShadow = true;
    group.add(legR);

    // Torso
    const shirtMat = mat(shirt, 0.5);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 8), shirtMat);
    torso.position.y = 0.8;
    torso.castShadow = true;
    group.add(torso);

    // Shoulders
    const shoulderMat = mat(shirt, 0.5);
    const shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), shoulderMat);
    shoulderL.position.set(-0.28, 1.0, 0);
    group.add(shoulderL);
    const shoulderR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), shoulderMat);
    shoulderR.position.set(0.28, 1.0, 0);
    group.add(shoulderR);

    // Arms
    const skinMat = mat(skin, 0.5);
    const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.45, 6), skinMat);
    armL.position.set(-0.32, 0.78, 0);
    armL.rotation.z = 0.15;
    armL.castShadow = true;
    group.add(armL);
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.45, 6), skinMat);
    armR.position.set(0.32, 0.78, 0);
    armR.rotation.z = -0.15;
    armR.castShadow = true;
    group.add(armR);

    // Hands
    const handMat = mat(skin, 0.5);
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 5), handMat);
    handL.position.set(-0.34, 0.55, 0);
    group.add(handL);
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.035, 5, 5), handMat);
    handR.position.set(0.34, 0.55, 0);
    group.add(handR);

    // Neck
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 6), skinMat);
    neck.position.y = 1.08;
    group.add(neck);

    // Head
    const headMat = mat(skin, 0.4);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), headMat);
    head.position.y = 1.2;
    head.castShadow = true;
    group.add(head);

    // Hair
    const hairMat = mat(pickRandom([0x1a1a1a, 0x2a1a0a, 0x3a2a1a, 0x4a3a2a, 0xa08050, 0xc0a060, 0xd4b070]), 0.7);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.145, 7, 7, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
    hair.position.y = 1.24;
    group.add(hair);

    // Eyes
    const eyeMat = mat(0xffffff, 0.1);
    const pupilMat = mat(0x222222, 0.1);
    for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyeMat);
        eye.position.set(side * 0.06, 1.22, -0.12);
        group.add(eye);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.015, 5, 5), pupilMat);
        pupil.position.set(side * 0.06, 1.22, -0.09);
        group.add(pupil);
    }

    // Eyebrows
    const browMat = mat(hairMat.color.getHex(), 0.7);
    for (const side of [-1, 1]) {
        const brow = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.008), browMat);
        brow.position.set(side * 0.06, 1.26, -0.13);
        group.add(brow);
    }

    // Mouth
    const mouthMat = mat(0xcc8888, 0.5);
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.005, 0.01), mouthMat);
    mouth.position.set(0, 1.16, -0.13);
    group.add(mouth);

    return { group, skin, shirt, pants, skinMat, shirtMat, pantsMat, headMat, bodyMat: shirtMat };
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
            child.material.metalness = 0.1;
            mats.push(child.material);
        }
    });
    return mats;
}

// ─── Choose model source ─────────────────────────────────────
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
    const size = 0.03 + Math.random() * 0.06;
    const mat = new THREE.MeshBasicMaterial({
        color: 0x8888aa,
        transparent: true,
        opacity: 0.15 + Math.random() * 0.2,
        depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(size, 3, 3), mat);
    const angle = Math.random() * Math.PI * 2;
    const dist = 10 + Math.random() * 40;
    mesh.position.set(Math.cos(angle) * dist, 0.5 + Math.random() * 4, Math.sin(angle) * dist);
    mesh.userData = {
        vel: new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.3),
        life: 5 + Math.random() * 10,
        maxLife: 5 + Math.random() * 10,
    };
    scene.add(mesh);
    ambientParticles.push(mesh);
}

for (let i = 0; i < 80; i++) createAmbientParticle();

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
    for (let i = 0; i < 8; i++) {
        const s = 0.01 + Math.random() * 0.02;
        const mat = new THREE.MeshBasicMaterial({ color: 0xffff88, transparent: true, opacity: 1, depthWrite: false });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 4, 4), mat);
        mesh.position.copy(pos).add(normal.clone().multiplyScalar(0.05));
        const dir = normal.clone().add(new THREE.Vector3(
            (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8
        )).normalize().multiplyScalar(1.5 + Math.random() * 3);
        mesh.userData = { vel: dir, life: 0.2 + Math.random() * 0.3, maxLife: 0.2 + Math.random() * 0.3, gravity: 4 };
        scene.add(mesh);
        particles.push(mesh);
    }
}

function spawnBlood(pos) {
    for (let i = 0; i < 8; i++) {
        const s = 0.03 + Math.random() * 0.06;
        const mat = new THREE.MeshBasicMaterial({
            color: new THREE.Color().setHSL(0, 0.7 + Math.random() * 0.3, 0.15 + Math.random() * 0.15),
            transparent: true, opacity: 0.9, depthWrite: false,
        });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 4, 4), mat);
        mesh.position.copy(pos);
        const dir = new THREE.Vector3(
            (Math.random() - 0.5) * 2, Math.random() * 1.5 + 0.5, (Math.random() - 0.5) * 2
        ).normalize().multiplyScalar(1 + Math.random() * 2);
        mesh.userData = { vel: dir, life: 0.6 + Math.random() * 0.6, maxLife: 0.6 + Math.random() * 0.6, gravity: 3 };
        scene.add(mesh);
        particles.push(mesh);
    }
}

function spawnExplosion(pos) {
    for (let i = 0; i < 20; i++) {
        const s = 0.05 + Math.random() * 0.15;
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
        mesh.userData = { vel: dir, life: 0.4 + Math.random() * 0.6, maxLife: 0.4 + Math.random() * 0.6, gravity: 2 };
        scene.add(mesh);
        particles.push(mesh);
    }
    for (let i = 0; i < 10; i++) {
        const s = 0.1 + Math.random() * 0.2;
        const mat = new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.4, depthWrite: false });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 5, 5), mat);
        mesh.position.copy(pos);
        const dir = new THREE.Vector3(
            (Math.random() - 0.5) * 1.5, Math.random() * 2 + 0.5, (Math.random() - 0.5) * 1.5
        ).normalize().multiplyScalar(1 + Math.random() * 2);
        mesh.userData = { vel: dir, life: 0.8 + Math.random() * 0.8, maxLife: 0.8 + Math.random() * 0.8, gravity: -0.5, fade: true };
        scene.add(mesh);
        particles.push(mesh);
    }
}

// ─── Player state ────────────────────────────────────────────
const player = {
    position: new THREE.Vector3(0, 1.7, 0),
    velocity: new THREE.Vector3(),
    health: 100,
    maxHealth: 100,
    score: 0,
    ammo: 30,
    maxAmmo: 30,
    reloading: false,
    reloadTime: 2000,
    lastShot: 0,
    shootCooldown: 120,
    damage: 34,
    moveSpeed: 6,
    runSpeed: 11,
    isRunning: false,
    bobPhase: 0,
    bobAmount: 0,
};

let pitch = 0;
let yaw = 0;
const sensitivity = 0.0018;

// ─── Enemies ─────────────────────────────────────────────────
const enemies = [];
let wave = 1;
let enemiesAlive = 0;
let enemiesPerWave = 3;
let gameRunning = false;

const raycaster = new THREE.Raycaster();

// ─── Audio ───────────────────────────────────────────────────
let audioCtx = null;
function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

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
                osc.start(t); osc.stop(t + 0.06);
                break;
            case 'hit':
                osc.type = 'square';
                osc.frequency.setValueAtTime(200, t); osc.frequency.exponentialRampToValueAtTime(60, t + 0.08);
                gain.gain.setValueAtTime(0.06, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
                osc.start(t); osc.stop(t + 0.08);
                break;
            case 'kill':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(300, t); osc.frequency.exponentialRampToValueAtTime(40, t + 0.4);
                gain.gain.setValueAtTime(0.1, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
                osc.start(t); osc.stop(t + 0.4);
                break;
            case 'hurt':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(150, t); osc.frequency.exponentialRampToValueAtTime(60, t + 0.2);
                gain.gain.setValueAtTime(0.15, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
                osc.start(t); osc.stop(t + 0.2);
                break;
        }
    } catch(e) {}
}

// ─── Create enemy ────────────────────────────────────────────
function createEnemy() {
    const { group, materials } = createEnemyModel();

    let x, z;
    do {
        const angle = Math.random() * Math.PI * 2;
        const dist = 25 + Math.random() * 20;
        x = Math.cos(angle) * dist;
        z = Math.sin(angle) * dist;
    } while (Math.abs(x) < 8 && Math.abs(z) < 8);

    group.position.set(x, 0, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    scene.add(group);

    const health = 60 + wave * 15;
    enemies.push({
        mesh: group,
        health,
        maxHealth: health,
        speed: Math.min(2 + wave * 0.25, 5.5),
        damage: 10 + wave * 2,
        attackRange: 1.8,
        attackCooldown: 1200,
        lastAttack: 0,
        materials: materials || [],
    });
    enemiesAlive++;
}

// ─── Wave system ─────────────────────────────────────────────
function spawnWave() {
    waveVal.textContent = wave;
    const count = enemiesPerWave + Math.floor(wave * 0.7);
    const delay = Math.max(100, 400 - wave * 10);
    for (let i = 0; i < count; i++)
        setTimeout(() => createEnemy(), i * delay);
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
    const pos = camera.position.clone().add(dir.multiplyScalar(0.7));
    spawnParticles(pos, 0xffaa44, 5, 3, 0.15, 0.03);

    const flash = new THREE.Mesh(
        new THREE.PlaneGeometry(0.4, 0.4),
        new THREE.MeshBasicMaterial({
            color: 0xffff88, transparent: true, opacity: 0.7,
            depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        })
    );
    flash.position.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(0.55));
    flash.lookAt(camera.position);
    scene.add(flash);
    setTimeout(() => { flash.material.opacity = 0; setTimeout(() => scene.remove(flash), 50); }, 30);
}

const bulletHoles = [];
function createBulletHole(point, normal) {
    const hole = new THREE.Mesh(
        new THREE.CircleGeometry(0.04, 6),
        new THREE.MeshBasicMaterial({ color: 0x222222, depthTest: true })
    );
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
            enemy.health -= player.damage;
            hit = true;
            spawnBlood(intersects[0].point);
            playSound('hit');
            // White flash on all materials
            for (const m of enemy.materials) {
                m._origColor = m._origColor || m.color.getHex();
                m.color.setHex(0xffffff);
            }
            setTimeout(() => {
                for (const m of enemy.materials) {
                    if (m.color && m._origColor) m.color.setHex(m._origColor);
                }
            }, 60);
            if (enemy.health <= 0) { killEnemy(enemy); break; }
        }
    }

    if (!hit) {
        const wi = raycaster.intersectObjects(walls);
        if (wi.length > 0) createBulletHole(wi[0].point, wi[0].face.normal);
    }
}

// ─── Kill enemy ──────────────────────────────────────────────
function killEnemy(enemy) {
    spawnExplosion(enemy.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)));
    scene.remove(enemy.mesh);
    const idx = enemies.indexOf(enemy);
    if (idx > -1) enemies.splice(idx, 1);
    enemiesAlive--;
    player.score += 100;
    updateHUD();
    playSound('kill');
    if (enemiesAlive <= 0) { wave++; setTimeout(spawnWave, 2500); }
}

// ─── Reload ──────────────────────────────────────────────────
function startReload() {
    if (player.reloading || player.ammo === player.maxAmmo) return;
    player.reloading = true;
    reloadEl.style.display = 'block';
    setTimeout(() => {
        player.ammo = player.maxAmmo;
        player.reloading = false;
        reloadEl.style.display = 'none';
        updateHUD();
    }, player.reloadTime);
}

// ─── Hurt player ─────────────────────────────────────────────
function hurtPlayer(amount) {
    player.health = Math.max(0, player.health - amount);
    updateHUD();
    playSound('hurt');
    dmgOverlay.style.opacity = '1';
    setTimeout(() => { dmgOverlay.style.opacity = '0'; }, 150);
    if (player.health <= 0) gameOver();
}

// ─── Game over / reset ───────────────────────────────────────
function gameOver() {
    gameRunning = false;
    document.exitPointerLock();
    finalScore.textContent = player.score;
    finalWave.textContent = wave;
    gameOverEl.style.display = 'flex';
}

function resetGame() {
    for (const e of enemies) scene.remove(e.mesh);
    enemies.length = 0; enemiesAlive = 0; wave = 1;
    for (const h of bulletHoles) scene.remove(h);
    bulletHoles.length = 0;
    for (const p of particles) scene.remove(p);
    particles.length = 0;

    player.health = player.maxHealth; player.score = 0;
    player.ammo = player.maxAmmo; player.reloading = false;
    player.position.set(0, 1.7, 0);
    camera.position.set(0, 1.7, 0);
    pitch = 0; yaw = 0;
    weaponGroup.position.set(0.3, -0.2, -0.35);

    gameOverEl.style.display = 'none';
    dmgOverlay.style.opacity = '0';
    reloadEl.style.display = 'none';
    updateHUD();
    spawnWave();
    gameRunning = true;
}

// ─── HUD ─────────────────────────────────────────────────────
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
    yaw -= e.movementX * sensitivity;
    pitch -= e.movementY * sensitivity;
    pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
});

document.addEventListener('mousedown', (e) => {
    if (e.button === 0 && document.pointerLockElement === renderer.domElement) shoot();
});

startBtn.addEventListener('click', () => {
    initAudio();
    blocker.style.display = 'none';
    renderer.domElement.requestPointerLock();
    resetGame();
});

restartBtn.addEventListener('click', () => {
    gameOverEl.style.display = 'none';
    renderer.domElement.requestPointerLock();
    resetGame();
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Game loop ───────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);

    // ── Ambient particles ──
    for (let i = ambientParticles.length - 1; i >= 0; i--) {
        const p = ambientParticles[i];
        p.userData.life -= delta;
        p.position.add(p.userData.vel.clone().multiplyScalar(delta));
        p.material.opacity = Math.max(0, (p.userData.life / p.userData.maxLife) * 0.2);
        if (p.userData.life <= 0) { scene.remove(p); ambientParticles.splice(i, 1); }
    }
    while (ambientParticles.length < 80) createAmbientParticle();

    if (gameRunning) {
        // ── Movement ──
        player.isRunning = !!keys['shift'];
        const speed = player.isRunning ? player.runSpeed : player.moveSpeed;
        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        const move = new THREE.Vector3();
        if (keys['w']) move.add(forward);
        if (keys['s']) move.sub(forward);
        if (keys['a']) move.sub(right);
        if (keys['d']) move.add(right);
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
        } else {
            player.bobPhase *= 0.9;
            player.bobAmount *= 0.9;
        }

        camera.position.copy(player.position);
        const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(euler);

        // ── Weapon bob ──
        const bobX = Math.sin(player.bobPhase) * player.bobAmount;
        const bobY = Math.abs(Math.cos(player.bobPhase)) * player.bobAmount;
        weaponGroup.position.x = 0.3 + bobX;
        weaponGroup.position.y = -0.2 + bobY;

        const kickT = (Date.now() - player.lastShot) / 200;
        if (kickT < 1) {
            const k = (1 - kickT);
            weaponGroup.rotation.x = -0.03 * k * k;
            weaponGroup.position.y -= 0.02 * k * k;
        } else {
            weaponGroup.rotation.x *= 0.95;
        }

        // ── Enemy AI ──
        for (const enemy of enemies) {
            const dir = new THREE.Vector3().copy(player.position).sub(enemy.mesh.position);
            dir.y = 0;
            const dist = dir.length();
            if (dist > enemy.attackRange) {
                dir.normalize().multiplyScalar(enemy.speed * delta);
                enemy.mesh.position.add(dir);
                enemy.mesh.rotation.y = Math.atan2(dir.x, dir.z);
            } else {
                const now = Date.now();
                if (now - enemy.lastAttack > enemy.attackCooldown) {
                    enemy.lastAttack = now;
                    hurtPlayer(enemy.damage);
                    spawnBlood(player.position.clone().add(new THREE.Vector3(0, 1, 0)));
                }
            }
        }

        waveVal.textContent = wave;
    }

    // ── Update particles ──
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.userData.life -= delta;
        p.position.add(p.userData.vel.clone().multiplyScalar(delta));
        p.userData.vel.y -= p.userData.gravity * delta;
        const t = p.userData.life / p.userData.maxLife;
        p.material.opacity = Math.max(0, p.userData.fade ? t * 0.4 : t);
        p.scale.setScalar(0.5 + t * 0.5);
        if (p.userData.life <= 0) { scene.remove(p); particles.splice(i, 1); }
    }

    renderer.render(scene, camera);
}

animate();

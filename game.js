import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

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

// ─── Normal map generator ────────────────────────────────────
function heightToNormal(heightCanvas, strength = 2) {
    const w = heightCanvas.width, h = heightCanvas.height;
    const hCtx = heightCanvas.getContext('2d');
    const src = hCtx.getImageData(0, 0, w, h);
    const nCanvas = document.createElement('canvas');
    nCanvas.width = w; nCanvas.height = h;
    const nCtx = nCanvas.getContext('2d');
    const dst = nCtx.createImageData(w, h);

    const getH = (x, y) => {
        x = Math.max(0, Math.min(w - 1, x));
        y = Math.max(0, Math.min(h - 1, y));
        const i = (y * w + x) * 4;
        return (src.data[i] + src.data[i + 1] + src.data[i + 2]) / 3 / 255;
    };

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const dx = (getH(x + 1, y) - getH(x - 1, y)) * strength;
            const dy = (getH(x, y + 1) - getH(x, y - 1)) * strength;
            const len = Math.sqrt(dx * dx + dy * dy + 1);
            const i = (y * w + x) * 4;
            dst.data[i] = (dx / len * 0.5 + 0.5) * 255;
            dst.data[i + 1] = (dy / len * 0.5 + 0.5) * 255;
            dst.data[i + 2] = (1 / len * 0.5 + 0.5) * 255;
            dst.data[i + 3] = 255;
        }
    }
    nCtx.putImageData(dst, 0, 0);
    return nCanvas;
}

function makeTexture(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const ctx = c.getContext('2d'); fn(ctx, w, h);
    return c;
}

function canvasToTex(canvas, repeat = 1, wrap = true) {
    const tex = new THREE.CanvasTexture(canvas);
    if (wrap) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat, repeat); }
    tex.anisotropy = 16;
    tex.needsUpdate = true;
    return tex;
}

// ─── Generate realistic textures ─────────────────────────────
// Asphalt
const asphaltH = makeTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#555'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 30000; i++) {
        const g = 80 + Math.random() * 60;
        ctx.fillStyle = `rgb(${g},${g},${g})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 2);
    }
    // Cracks
    for (let i = 0; i < 8; i++) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5 + Math.random();
        ctx.beginPath();
        let x = Math.random() * w, y = Math.random() * h;
        ctx.moveTo(x, y);
        for (let j = 0; j < 5; j++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; ctx.lineTo(x, y); }
        ctx.stroke();
    }
});
const asphaltN = heightToNormal(asphaltH, 3);
const asphaltTex = canvasToTex(asphaltH, 20);
const asphaltNormal = canvasToTex(asphaltN, 20);

// Sidewalk
const sidewalkH = makeTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#aaa'; ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
        const g = 150 + Math.random() * 60;
        ctx.fillStyle = `rgb(${g},${g},${g})`;
        ctx.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 4, 1 + Math.random() * 2);
    }
    ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
    for (let y = 0; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
});
const sidewalkN = heightToNormal(sidewalkH, 2);
const sidewalkTex = canvasToTex(sidewalkH, 10);
const sidewalkNormal = canvasToTex(sidewalkN, 10);

// Building wall
function makeWallTex(hue) {
    const c = makeTexture(256, 256, (ctx, w, h) => {
        ctx.fillStyle = `hsl(${hue}, 20%, ${50 + Math.random() * 20}%)`;
        ctx.fillRect(0, 0, w, h);
        // Brick/panel pattern
        for (let y = 0; y < h; y += 12) {
            for (let x = 0; x < w; x += 20) {
                const off = (y % 24 === 0) ? 0 : 10;
                const v = 40 + Math.random() * 20;
                ctx.fillStyle = `hsl(${hue}, 15%, ${v}%)`;
                ctx.fillRect(x + off, y, 18, 10);
                ctx.strokeStyle = `hsla(${hue}, 10%, 30%, 0.3)`;
                ctx.lineWidth = 0.5;
                ctx.strokeRect(x + off, y, 18, 10);
            }
        }
        // Dirt/stain
        for (let i = 0; i < 20; i++) {
            const g = 30 + Math.random() * 40;
            ctx.fillStyle = `rgba(${g},${g},${g},0.05)`;
            const x = Math.random() * w, y = Math.random() * h;
            ctx.fillRect(x, y, 20 + Math.random() * 40, 5 + Math.random() * 20);
        }
    });
    const n = heightToNormal(c, 2.5);
    return { map: canvasToTex(c, 2, false), normal: canvasToTex(n, 2, false) };
}

// Glass
function makeGlassTex() {
    const c = makeTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#8aadc8'; ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 500; i++) {
            const a = 40 + Math.random() * 60;
            ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.05})`;
            ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
        }
    });
    return canvasToTex(c, 1, false);
}
const glassTex = makeGlassTex();

// ─── Scene setup ─────────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x4A90D9);
scene.fog = new THREE.Fog(0xB0D4F1, 150, 300);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 400);
camera.position.set(0, 1.7, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.bias = 0.0005;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.prepend(renderer.domElement);

// ─── Environment map (IBL) ───────────────────────────────────
const pmremGen = new THREE.PMREMGenerator(renderer);
pmremGen.compileEquirectangularShader();

// Generate env map from a scene we create
const envScene = new THREE.Scene();
const envCanvas = document.createElement('canvas');
envCanvas.width = 1024; envCanvas.height = 512;
const ectx = envCanvas.getContext('2d');
const eg = ectx.createLinearGradient(0, 0, 0, 512);
eg.addColorStop(0, '#1a2a6c');
eg.addColorStop(0.2, '#4A90D9');
eg.addColorStop(0.5, '#87CEEB');
eg.addColorStop(0.7, '#B0D4F1');
eg.addColorStop(0.85, '#D4A574');
eg.addColorStop(1, '#8B7355');
ectx.fillStyle = eg; ectx.fillRect(0, 0, 1024, 512);
// Sun glow
const sg = ectx.createRadialGradient(800, 100, 0, 800, 100, 300);
sg.addColorStop(0, 'rgba(255,240,200,1)');
sg.addColorStop(0.1, 'rgba(255,220,180,0.8)');
sg.addColorStop(0.4, 'rgba(255,200,150,0.2)');
sg.addColorStop(1, 'rgba(255,200,150,0)');
ectx.fillStyle = sg; ectx.fillRect(0, 0, 1024, 512);
const envTex = new THREE.CanvasTexture(envCanvas);
const envMat = new THREE.MeshBasicMaterial({ map: envTex, side: THREE.BackSide });
const envSphere = new THREE.Mesh(new THREE.SphereGeometry(200, 32, 32), envMat);
envScene.add(envSphere);

const envRT = pmremGen.fromScene(envScene, 0, 0.1, 100);
scene.environment = envRT.texture;
scene.environmentIntensity = 0.6;
pmremGen.compileCubemapShader();

// ─── Sky ─────────────────────────────────────────────────────
const skyGeo = new THREE.SphereGeometry(290, 48, 48);
const skyCanvas = document.createElement('canvas');
skyCanvas.width = 1024; skyCanvas.height = 512;
const sctx = skyCanvas.getContext('2d');
const sgrad = sctx.createLinearGradient(0, 0, 0, 512);
sgrad.addColorStop(0, '#1a2a6c');
sgrad.addColorStop(0.15, '#3a70c8');
sgrad.addColorStop(0.35, '#6BA3D9');
sgrad.addColorStop(0.5, '#87CEEB');
sgrad.addColorStop(0.7, '#B0D4F1');
sgrad.addColorStop(0.85, '#D4A574');
sgrad.addColorStop(1, '#8B7355');
sctx.fillStyle = sgrad; sctx.fillRect(0, 0, 1024, 512);
// Clouds
for (let i = 0; i < 40; i++) {
    const x = Math.random() * 1024, y = 80 + Math.random() * 180;
    const rx = 30 + Math.random() * 80, ry = 10 + Math.random() * 30;
    sctx.fillStyle = `rgba(255,255,255,${0.1 + Math.random() * 0.2})`;
    sctx.beginPath(); sctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); sctx.fill();
    sctx.beginPath(); sctx.ellipse(x + rx * 0.5, y - 5, rx * 0.7, ry * 0.8, 0, 0, Math.PI * 2); sctx.fill();
    sctx.beginPath(); sctx.ellipse(x - rx * 0.4, y + 3, rx * 0.5, ry * 0.7, 0, 0, Math.PI * 2); sctx.fill();
}
// Distant haze
const haze = sctx.createLinearGradient(0, 400, 0, 512);
haze.addColorStop(0, 'rgba(180,200,220,0)');
haze.addColorStop(1, 'rgba(180,200,220,0.6)');
sctx.fillStyle = haze; sctx.fillRect(0, 400, 1024, 112);
const skyTex = new THREE.CanvasTexture(skyCanvas);
skyTex.colorSpace = THREE.SRGBColorSpace;
const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide });
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

// ─── Lighting ────────────────────────────────────────────────
const ambient = new THREE.AmbientLight(0x8899bb, 0.35);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0xfff0dd, 2.5);
sun.position.set(80, 120, 60);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 200;
sun.shadow.camera.left = -80;
sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
sun.shadow.bias = -0.001;
sun.shadow.normalBias = 0.02;
scene.add(sun);

const hemi = new THREE.HemisphereLight(0x87CEEB, 0x98D89E, 0.4);
scene.add(hemi);

// ─── Post-processing ─────────────────────────────────────────
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const ssaoPass = new SSAOPass(scene, camera);
ssaoPass.kernelRadius = 0.5;
ssaoPass.minDistance = 0.1;
ssaoPass.maxDistance = 20;
ssaoPass.output = SSAOPass.OUTPUT.Default;
composer.addPass(ssaoPass);

const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.15, 0.3, 0.1
);
composer.addPass(bloomPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

// ─── Ground (asphalt) ────────────────────────────────────────
const asphMat = new THREE.MeshStandardMaterial({
    map: asphaltTex, normalMap: asphaltNormal, normalScale: new THREE.Vector2(0.8, 0.8),
    roughness: 0.9, metalness: 0,
});
const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), asphMat);
asphalt.rotation.x = -Math.PI / 2;
asphalt.receiveShadow = true;
scene.add(asphalt);

// ─── Sidewalk / curb ─────────────────────────────────────────
const swMat = new THREE.MeshStandardMaterial({
    map: sidewalkTex, normalMap: sidewalkNormal, normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.85, metalness: 0,
});
const swGeo = new THREE.RingGeometry(50, 54, 32);
const swMesh = new THREE.Mesh(swGeo, swMat);
swMesh.rotation.x = -Math.PI / 2;
swMesh.receiveShadow = true;
scene.add(swMesh);

// Curb (3D edge)
const curbMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.7 });
const curbSegments = 32;
for (let i = 0; i < curbSegments; i++) {
    const angle = (i / curbSegments) * Math.PI * 2;
    const nextAngle = ((i + 1) / curbSegments) * Math.PI * 2;
    const r1 = 50, r2 = 50.2;
    const h = 0.12;
    const shape = new THREE.Shape();
    shape.moveTo(r1 * Math.cos(angle), r1 * Math.sin(angle));
    shape.lineTo(r2 * Math.cos(angle), r2 * Math.sin(angle));
    shape.lineTo(r2 * Math.cos(nextAngle), r2 * Math.sin(nextAngle));
    shape.lineTo(r1 * Math.cos(nextAngle), r1 * Math.sin(nextAngle));
    shape.closePath();
    const extrudeSettings = { depth: h, bevelEnabled: false };
    const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    const mesh = new THREE.Mesh(geo, curbMat);
    mesh.receiveShadow = true; mesh.castShadow = true;
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = -h / 2;
    scene.add(mesh);
}

// Grass outer ring
const grassMat = new THREE.MeshStandardMaterial({
    color: 0x6a9a6a, roughness: 0.95, metalness: 0,
});
const grassRing = new THREE.Mesh(new THREE.RingGeometry(54, 120, 4), grassMat);
grassRing.rotation.x = -Math.PI / 2;
grassRing.receiveShadow = true;
scene.add(grassRing);

// ─── Road markings (3D) ──────────────────────────────────────
const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
function createRoadLine3D() {
    for (let z = -45; z <= 45; z += 4) {
        const seg = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2), lineMat);
        seg.rotation.x = -Math.PI / 2;
        seg.position.set(0, 0.01, z);
        scene.add(seg);
    }
}
createRoadLine3D();

// Crosswalk bars (3D)
const crossMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 });
function createCrosswalk3D(x, z, rot) {
    for (let i = -3; i <= 3; i++) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.01, 0.8), crossMat);
        bar.position.set(x + i * 0.5, 0.01, z);
        bar.rotation.y = rot;
        bar.receiveShadow = true;
        scene.add(bar);
    }
}
createCrosswalk3D(0, -10, 0);
createCrosswalk3D(0, 10, 0);
createCrosswalk3D(-10, 0, Math.PI / 2);
createCrosswalk3D(10, 0, Math.PI / 2);

// ─── City buildings ──────────────────────────────────────────
const walls = [];
const wallBBs = [];

const BUILDING_HUES = [0, 30, 45, 90, 180, 210, 240, 300, 350, 15, 50, 140, 200, 270, 330, 20];

function createRealBuilding(x, z, w, h, d, hue) {
    const group = new THREE.Group();
    const { map, normal } = makeWallTex(hue);

    const wallMat = new THREE.MeshStandardMaterial({
        map, normalMap: normal, normalScale: new THREE.Vector2(0.3, 0.3),
        roughness: 0.8, metalness: 0.05,
        envMapIntensity: 0.3,
    });

    // Main body
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), wallMat);
    body.position.y = h / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Cornice (top trim)
    const corniceMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5, metalness: 0.2 });
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.15, 0.08, d + 0.15), corniceMat);
    cornice.position.y = h;
    cornice.castShadow = true;
    group.add(cornice);

    // Cornice bottom trim
    const bCornice = new THREE.Mesh(new THREE.BoxGeometry(w + 0.1, 0.06, d + 0.1), corniceMat);
    bCornice.position.y = 0.03;
    bCornice.castShadow = true;
    group.add(bCornice);

    // Windows
    const glassMat = new THREE.MeshPhysicalMaterial({
        map: glassTex,
        roughness: 0.05, metalness: 0, transmission: 0.6, thickness: 0.1,
        envMapIntensity: 0.8,
        transparent: true, opacity: 0.7,
    });
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.3 });

    const winRows = Math.floor((h - 0.6) / 0.6);
    const winCols = Math.floor((w - 0.6) / 0.7);
    for (let row = 0; row < Math.min(winRows, 4); row++) {
        for (let col = 0; col < Math.min(winCols, 5); col++) {
            if (Math.random() > 0.2) {
                const wx = -w / 2 + 0.4 + col * 0.7;
                const wy = 0.5 + row * 0.6;
                // Window frame
                const frame = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.03), frameMat);
                frame.position.set(wx, wy, d / 2 + 0.001);
                group.add(frame);
                // Window glass (lit from inside at night, but for day, reflection)
                const lit = Math.random() > 0.5;
                const winMat = lit ? new THREE.MeshPhysicalMaterial({
                    roughness: 0.05, metalness: 0, transmission: 0.4,
                    envMapIntensity: 1.0,
                }) : glassMat;
                const win = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.25), winMat);
                win.position.set(wx, wy, d / 2 + 0.005);
                group.add(win);
            }
        }
    }

    // Roof details
    if (h > 3) {
        const roofMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.7 });
        const roofBox = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.2, 0.3), roofMat);
        roofBox.position.set(w * 0.25, h + 0.15, d * 0.25);
        roofBox.castShadow = true;
        group.add(roofBox);
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

// Building layout
const bldData = [
    { x: -24, z: -24, w: 9, h: 6 + Math.random() * 4, d: 9 },
    { x: 24, z: -24, w: 9, h: 6 + Math.random() * 4, d: 9 },
    { x: -24, z: 24, w: 9, h: 6 + Math.random() * 4, d: 9 },
    { x: 24, z: 24, w: 9, h: 6 + Math.random() * 4, d: 9 },
    { x: 0, z: -34, w: 14, h: 4 + Math.random() * 3, d: 6 },
    { x: 0, z: 34, w: 14, h: 4 + Math.random() * 3, d: 6 },
    { x: -34, z: 0, w: 6, h: 4 + Math.random() * 3, d: 14 },
    { x: 34, z: 0, w: 6, h: 4 + Math.random() * 3, d: 14 },
    { x: -14, z: -14, w: 5, h: 3 + Math.random() * 4, d: 5 },
    { x: 14, z: -14, w: 5, h: 3 + Math.random() * 4, d: 5 },
    { x: -14, z: 14, w: 5, h: 3 + Math.random() * 4, d: 5 },
    { x: 14, z: 14, w: 5, h: 3 + Math.random() * 4, d: 5 },
    { x: 0, z: 0, w: 5, h: 4, d: 5 },
    { x: -28, z: -12, w: 4, h: 3, d: 4 },
    { x: 28, z: -12, w: 4, h: 3, d: 4 },
    { x: -28, z: 12, w: 4, h: 3, d: 4 },
    { x: 28, z: 12, w: 4, h: 3, d: 4 },
];
for (const b of bldData) {
    createRealBuilding(b.x, b.z, b.w, Math.floor(b.h), b.d,
        BUILDING_HUES[Math.floor(Math.random() * BUILDING_HUES.length)]);
}

// ─── Trees ───────────────────────────────────────────────────
function createRealTree(x, z) {
    const group = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9, envMapIntensity: 0.1 });
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.15, 1.8, 7), trunkMat);
    trunk.position.y = 0.9;
    trunk.castShadow = true;
    group.add(trunk);

    // Branch
    const branchMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 });
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.6, 5), branchMat);
    branch.position.set(0.2, 1.3, 0);
    branch.rotation.z = 0.5;
    group.add(branch);

    // Canopy - multiple spheres for organic look
    const leafMat = new THREE.MeshStandardMaterial({
        color: 0x4a8a4a, roughness: 0.8, envMapIntensity: 0.2,
    });
    const leafMat2 = new THREE.MeshStandardMaterial({
        color: 0x5a9a5a, roughness: 0.8, envMapIntensity: 0.2,
    });
    const leafMat3 = new THREE.MeshStandardMaterial({
        color: 0x3a7a3a, roughness: 0.8, envMapIntensity: 0.2,
    });

    const c1 = new THREE.Mesh(new THREE.SphereGeometry(0.8, 6, 6), leafMat);
    c1.position.set(0, 2.2, 0); c1.castShadow = true; c1.receiveShadow = true; group.add(c1);
    const c2 = new THREE.Mesh(new THREE.SphereGeometry(0.6, 6, 6), leafMat2);
    c2.position.set(0.5, 1.9, 0.3); c2.castShadow = true; c2.receiveShadow = true; group.add(c2);
    const c3 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 6), leafMat3);
    c3.position.set(-0.4, 1.8, -0.3); c3.castShadow = true; c3.receiveShadow = true; group.add(c3);
    const c4 = new THREE.Mesh(new THREE.SphereGeometry(0.4, 6, 6), leafMat2);
    c4.position.set(0.2, 1.6, -0.6); c4.castShadow = true; c4.receiveShadow = true; group.add(c4);

    group.position.set(x, 0, z);
    scene.add(group);
    return group;
}

const treePos = [
    [-40, -40], [40, -40], [-40, 40], [40, 40],
    [-42, -22], [42, 22], [-22, -42], [22, 42],
    [-42, 22], [42, -22], [-22, 42], [22, -42],
    [-44, 0], [44, 0], [0, -44], [0, 44],
];
for (const [x, z] of treePos) createRealTree(x, z);

// ─── Streetlamps ─────────────────────────────────────────────
function createLamp(x, z) {
    const g = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({
        color: 0x333344, roughness: 0.3, metalness: 0.7, envMapIntensity: 0.5,
    });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 2.8, 8), poleMat);
    pole.position.y = 1.4;
    pole.castShadow = true;
    g.add(pole);

    const armMat = new THREE.MeshStandardMaterial({ color: 0x333344, roughness: 0.3, metalness: 0.6 });
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 0.03), armMat);
    arm.position.set(0.18, 2.7, 0);
    g.add(arm);

    const bulbMat = new THREE.MeshPhysicalMaterial({
        color: 0xffeedd, roughness: 0.1, metalness: 0,
        emissive: 0xffdd99, emissiveIntensity: 0.3,
        transparent: true, opacity: 0.7,
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 7), bulbMat);
    bulb.position.set(0.35, 2.65, 0);
    bulb.castShadow = true;
    g.add(bulb);

    g.position.set(x, 0, z);
    scene.add(g);
    const light = new THREE.PointLight(0xffddaa, 0.4, 8);
    light.position.set(x + 0.35, 2.5, z);
    scene.add(light);
    return g;
}

const lampP = [
    [-18, -18], [18, -18], [-18, 18], [18, 18],
    [-28, 0], [28, 0], [0, -28], [0, 28],
];
for (const [x, z] of lampP) createLamp(x, z);

// ─── Park bench ──────────────────────────────────────────────
function createBench(x, z, rot) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.8, envMapIntensity: 0.2 });
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.22), mat);
    seat.position.y = 0.22; seat.castShadow = true; seat.receiveShadow = true; g.add(seat);
    for (const ox of [-0.3, 0, 0.3]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), mat);
        leg.position.set(ox, 0.1, 0.08); g.add(leg);
        const leg2 = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.03), mat);
        leg2.position.set(ox, 0.1, -0.08); g.add(leg2);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.02), mat);
    back.position.set(0, 0.38, -0.11); back.castShadow = true; g.add(back);
    const matMetal = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.4, metalness: 0.6 });
    for (const ox of [-0.3, 0.3]) {
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.35, 5), matMetal);
        br.position.set(ox, 0.22, -0.11); g.add(br);
    }
    g.position.set(x, 0, z); g.rotation.y = rot;
    scene.add(g);
}

createBench(-16, -14, 0.3);
createBench(16, -14, -0.3);
createBench(-16, 14, -0.3);
createBench(16, 14, 0.3);

// ─── Trash can ───────────────────────────────────────────────
function createTrash(x, z) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x445566, roughness: 0.5, metalness: 0.3 });
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.25, 7), mat);
    can.position.y = 0.125; can.castShadow = true; g.add(can);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 7), mat);
    lid.position.y = 0.26; g.add(lid);
    g.position.set(x, 0, z); scene.add(g);
}
createTrash(-18, -10); createTrash(18, -10);
createTrash(-18, 10); createTrash(18, 10);

// ─── Weapon model ────────────────────────────────────────────
const weaponGroup = new THREE.Group();
function buildWeapon() {
    const pbr = (c, r = 0.4, m = 0.6) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, envMapIntensity: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.28), pbr(0x222233));
    body.position.set(0, -0.05, -0.14); weaponGroup.add(body);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.18, 8), pbr(0x111122, 0.3, 0.8));
    barrel.rotation.x = Math.PI / 2; barrel.position.set(0, -0.05, -0.28); weaponGroup.add(barrel);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, 0.04, 8), pbr(0x222233, 0.3, 0.7));
    tip.rotation.x = Math.PI / 2; tip.position.set(0, -0.05, -0.37); weaponGroup.add(tip);
    const slide = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 0.16), pbr(0x333344, 0.4, 0.7));
    slide.position.set(0, -0.02, -0.14); weaponGroup.add(slide);
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.1, 0.06), pbr(0x332211, 0.8));
    grip.position.set(0, -0.12, 0.04); grip.rotation.x = 0.2; weaponGroup.add(grip);
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.03), pbr(0x222233, 0.5, 0.6));
    guard.position.set(0, -0.09, -0.02); weaponGroup.add(guard);
}
buildWeapon();
weaponGroup.position.set(0.3, -0.2, -0.35);
camera.add(weaponGroup);
scene.add(camera);

// ─── GLTF human model loader ─────────────────────────────────
let loadedHumanModels = [];
let modelsReady = false;
const MODEL_URLS = ['https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.gltf'];
const skinTones = [0xF5D0A9, 0xDEB887, 0xC68642, 0x8D5524, 0xE8C492, 0xD4A574];
const shirtColors = [0xFFFFFF, 0xFF6B6B, 0x4ECDC4, 0xFFE66D, 0xA18CD1, 0x6BCB77, 0x45B7D1, 0xFF8E53, 0x222222];
const pantsColors = [0x2F4F4F, 0x333344, 0x444466, 0x555555, 0x1a1a2e];
const shoeColors = [0x1a1a1a, 0x333333, 0x3a2a1a];
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function loadHumanModels() {
    const loader = new GLTFLoader(); let loaded = 0;
    for (const url of MODEL_URLS) {
        loader.load(url, (gltf) => {
            const model = gltf.scene; model.scale.set(0.55, 0.55, 0.55);
            model.traverse((c) => { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; if (c.material) { c.material.envMapIntensity = 0.4; } } });
            loadedHumanModels.push(model); loaded++;
            if (loaded >= MODEL_URLS.length) { modelsReady = true; loadingInfo.textContent = '✓ Модели загружены!'; loadingInfo.style.color = '#4a4'; }
        }, undefined, () => { loaded++; if (loaded >= MODEL_URLS.length) { loadingInfo.textContent = '✓ Игра готова!'; loadingInfo.style.color = '#888'; } });
    }
}
loadHumanModels();

// ─── Procedural human ────────────────────────────────────────
function createProceduralHuman() {
    const group = new THREE.Group();
    const skin = pickRandom(skinTones); const shirt = pickRandom(shirtColors);
    const pants = pickRandom(pantsColors); const shoes = pickRandom(shoeColors);
    const pbr = (c, r = 0.6, m = 0.1) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, envMapIntensity: 0.3 });

    const shoeMat = pbr(shoes, 0.8);
    const fL = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.18), shoeMat);
    fL.position.set(-0.12, 0.025, 0.04); fL.castShadow = true; group.add(fL);
    const fR = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.18), shoeMat);
    fR.position.set(0.12, 0.025, 0.04); fR.castShadow = true; group.add(fR);

    const pantsMat = pbr(pants, 0.7);
    const lL = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.55, 7), pantsMat);
    lL.position.set(-0.12, 0.3, 0); lL.castShadow = true; group.add(lL);
    const lR = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.55, 7), pantsMat);
    lR.position.set(0.12, 0.3, 0); lR.castShadow = true; group.add(lR);

    const shirtMat = pbr(shirt, 0.5);
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 7), shirtMat);
    torso.position.y = 0.8; torso.castShadow = true; group.add(torso);
    const shL = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), shirtMat);
    shL.position.set(-0.28, 1.0, 0); group.add(shL);
    const shR = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), shirtMat);
    shR.position.set(0.28, 1.0, 0); group.add(shR);

    const skinMat = pbr(skin, 0.5);
    const aL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.45, 6), skinMat);
    aL.position.set(-0.32, 0.78, 0); aL.rotation.z = 0.15; aL.castShadow = true; group.add(aL);
    const aR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.45, 6), skinMat);
    aR.position.set(0.32, 0.78, 0); aR.rotation.z = -0.15; aR.castShadow = true; group.add(aR);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.08, 6), skinMat);
    neck.position.y = 1.08; group.add(neck);
    const headMat = pbr(skin, 0.4);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 7, 7), headMat);
    head.position.y = 1.2; head.castShadow = true; group.add(head);

    return { group, materials: [shirtMat, pantsMat, skinMat, headMat, shoeMat] };
}

function applyModelColors(model) {
    const skin = pickRandom(skinTones); const shirt = pickRandom(shirtColors);
    const pants = pickRandom(pantsColors); const shoes = pickRandom(shoeColors);
    const mats = [];
    model.traverse((c) => {
        if (c.isMesh) {
            const n = c.name ? c.name.toLowerCase() : ''; let color = 0x888888;
            if (n.includes('head') || n.includes('face') || n.includes('neck') || n.includes('hand') || n.includes('arm')) color = skin;
            else if (n.includes('body') || n.includes('torso') || n.includes('shirt') || n.includes('upper')) color = shirt;
            else if (n.includes('leg') || n.includes('pant') || n.includes('hip') || n.includes('thigh')) color = pants;
            else if (n.includes('foot') || n.includes('shoe') || n.includes('boot')) color = shoes;
            c.material = c.material.clone(); c.material.color.setHex(color);
            c.material.roughness = 0.6; c.material.envMapIntensity = 0.4; mats.push(c.material);
        }
    });
    return mats;
}
function createEnemyModel() {
    if (modelsReady && loadedHumanModels.length > 0) {
        const src = loadedHumanModels[Math.floor(Math.random() * loadedHumanModels.length)];
        const clone = src.clone(true); const mats = applyModelColors(clone);
        return { group: clone, materials: mats };
    }
    return createProceduralHuman();
}

// ─── Ambient particles ───────────────────────────────────────
const ambientParticles = [];
function createDust() {
    const s = 0.01 + Math.random() * 0.02;
    const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.04 + Math.random() * 0.06, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 3, 3), m);
    const a = Math.random() * Math.PI * 2; const d = 5 + Math.random() * 50;
    mesh.position.set(Math.cos(a) * d, 0.3 + Math.random() * 4, Math.sin(a) * d);
    mesh.userData = { vel: new THREE.Vector3((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.1), life: 8 + Math.random() * 15, maxLife: 8 + Math.random() * 15 };
    scene.add(mesh); ambientParticles.push(mesh);
}
for (let i = 0; i < 40; i++) createDust();

// ─── Particles ───────────────────────────────────────────────
const particles = [];
function spawnParticles(pos, color, count, speed, lifetime, size) {
    for (let i = 0; i < count; i++) {
        const s = size || (0.02 + Math.random() * 0.04);
        const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 4, 4), m);
        mesh.position.copy(pos);
        const dir = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5, (Math.random() - 0.5) * 2).normalize().multiplyScalar(speed * (0.5 + Math.random()));
        mesh.userData = { vel: dir, life: lifetime || 0.4 + Math.random() * 0.4, maxLife: lifetime || 0.4 + Math.random() * 0.4, gravity: 1.5 };
        scene.add(mesh); particles.push(mesh);
    }
}
function spawnSparks(pos, normal) {
    for (let i = 0; i < 6; i++) {
        const s = 0.008 + Math.random() * 0.015;
        const m = new THREE.MeshBasicMaterial({ color: 0xffffaa, transparent: true, opacity: 1, depthWrite: false });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 4, 4), m);
        mesh.position.copy(pos).add(normal.clone().multiplyScalar(0.05));
        const dir = normal.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8, (Math.random() - 0.5) * 0.8)).normalize().multiplyScalar(2 + Math.random() * 3);
        mesh.userData = { vel: dir, life: 0.15 + Math.random() * 0.2, maxLife: 0.15 + Math.random() * 0.2, gravity: 4 };
        scene.add(mesh); particles.push(mesh);
    }
}
function spawnBlood(pos) {
    for (let i = 0; i < 6; i++) {
        const s = 0.02 + Math.random() * 0.04;
        const m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0, 0.8, 0.12 + Math.random() * 0.1), transparent: true, opacity: 0.8, depthWrite: false });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 4, 4), m);
        mesh.position.copy(pos);
        const dir = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 1.5 + 0.5, (Math.random() - 0.5) * 2).normalize().multiplyScalar(1 + Math.random() * 2);
        mesh.userData = { vel: dir, life: 0.4 + Math.random() * 0.4, maxLife: 0.4 + Math.random() * 0.4, gravity: 3 };
        scene.add(mesh); particles.push(mesh);
    }
}
function spawnExplosion(pos) {
    for (let i = 0; i < 12; i++) {
        const s = 0.04 + Math.random() * 0.1;
        const m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.04 + Math.random() * 0.08, 1, 0.4 + Math.random() * 0.4), transparent: true, opacity: 1, depthWrite: false });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(s, 5, 5), m);
        mesh.position.copy(pos);
        const dir = new THREE.Vector3((Math.random() - 0.5) * 2.5, Math.random() * 2, (Math.random() - 0.5) * 2.5).normalize().multiplyScalar(2 + Math.random() * 4);
        mesh.userData = { vel: dir, life: 0.3 + Math.random() * 0.4, maxLife: 0.3 + Math.random() * 0.4, gravity: 2 };
        scene.add(mesh); particles.push(mesh);
    }
}

// ─── Player state ────────────────────────────────────────────
const player = {
    position: new THREE.Vector3(0, 1.7, 0), velocity: new THREE.Vector3(),
    health: 100, maxHealth: 100, score: 0,
    ammo: 30, maxAmmo: 30, reloading: false, reloadTime: 2000,
    lastShot: 0, shootCooldown: 120, damage: 34,
    moveSpeed: 6, runSpeed: 11, isRunning: false, bobPhase: 0, bobAmount: 0,
};
let pitch = 0, yaw = 0;
const sensitivity = 0.0018;
const enemies = [];
let wave = 1, enemiesAlive = 0, enemiesPerWave = 3, gameRunning = false;
const raycaster = new THREE.Raycaster();

// ─── Audio ───────────────────────────────────────────────────
let audioCtx = null;
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playSound(type) {
    try { initAudio(); const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination); const t = audioCtx.currentTime;
        switch (type) {
            case 'shoot': osc.type = 'sawtooth'; osc.frequency.setValueAtTime(900, t); osc.frequency.exponentialRampToValueAtTime(150, t + 0.06); gain.gain.setValueAtTime(0.08, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06); osc.start(t); osc.stop(t + 0.06); break;
            case 'hit': osc.type = 'square'; osc.frequency.setValueAtTime(200, t); osc.frequency.exponentialRampToValueAtTime(60, t + 0.08); gain.gain.setValueAtTime(0.06, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08); osc.start(t); osc.stop(t + 0.08); break;
            case 'kill': osc.type = 'sawtooth'; osc.frequency.setValueAtTime(300, t); osc.frequency.exponentialRampToValueAtTime(40, t + 0.4); gain.gain.setValueAtTime(0.1, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4); osc.start(t); osc.stop(t + 0.4); break;
            case 'hurt': osc.type = 'sine'; osc.frequency.setValueAtTime(150, t); osc.frequency.exponentialRampToValueAtTime(60, t + 0.2); gain.gain.setValueAtTime(0.15, t); gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2); osc.start(t); osc.stop(t + 0.2); break;
        }
    } catch (e) { }
}

function createEnemy() {
    const { group, materials } = createEnemyModel();
    let x, z;
    do { const a = Math.random() * Math.PI * 2; const d = 20 + Math.random() * 20; x = Math.cos(a) * d; z = Math.sin(a) * d; } while (Math.abs(x) < 8 && Math.abs(z) < 8);
    group.position.set(x, 0, z); group.rotation.y = Math.random() * Math.PI * 2; scene.add(group);
    const health = 60 + wave * 15;
    enemies.push({ mesh: group, health, maxHealth: health, speed: Math.min(2 + wave * 0.25, 5.5), damage: 10 + wave * 2, attackRange: 1.8, attackCooldown: 1200, lastAttack: 0, materials: materials || [] });
    enemiesAlive++;
}
function spawnWave() { waveVal.textContent = wave; const count = enemiesPerWave + Math.floor(wave * 0.7); for (let i = 0; i < count; i++) setTimeout(() => createEnemy(), i * 250); }

function checkCollision(pos, r = 0.35) {
    for (const bb of wallBBs) { if (pos.x + r > bb.min.x && pos.x - r < bb.max.x && pos.z + r > bb.min.z && pos.z - r < bb.max.z && pos.y < bb.max.y) return true; }
    return Math.abs(pos.x) > 48 || Math.abs(pos.z) > 48;
}

function createMuzzleFlash() {
    const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    spawnParticles(camera.position.clone().add(dir.multiplyScalar(0.7)), 0xffaa44, 5, 3, 0.15, 0.03);
    const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.4), new THREE.MeshBasicMaterial({ color: 0xffff88, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
    flash.position.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(0.55)); flash.lookAt(camera.position);
    scene.add(flash); setTimeout(() => { flash.material.opacity = 0; setTimeout(() => scene.remove(flash), 50); }, 30);
}

const bulletHoles = [];
function createBulletHole(point, normal) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.03, 6), new THREE.MeshBasicMaterial({ color: 0x222222, depthTest: true }));
    hole.position.copy(point).add(normal.clone().multiplyScalar(0.02)); hole.lookAt(point.clone().add(normal));
    scene.add(hole); bulletHoles.push(hole); if (bulletHoles.length > 40) scene.remove(bulletHoles.shift());
    spawnSparks(point, normal);
}

function shoot() {
    if (!gameRunning || player.reloading) return; if (player.ammo <= 0) { startReload(); return; }
    const now = Date.now(); if (now - player.lastShot < player.shootCooldown) return;
    player.lastShot = now; player.ammo--; updateHUD(); playSound('shoot'); createMuzzleFlash();
    raycaster.setFromCamera({ x: 0, y: 0 }, camera); let hit = false;
    for (const enemy of enemies) {
        const meshes = []; enemy.mesh.traverse((c) => { if (c.isMesh) meshes.push(c); });
        const intersects = raycaster.intersectObjects(meshes);
        if (intersects.length > 0) {
            enemy.health -= player.damage; hit = true; spawnBlood(intersects[0].point); playSound('hit');
            for (const m of enemy.materials) { m._origColor = m._origColor || m.color.getHex(); m.color.setHex(0xffffff); }
            setTimeout(() => { for (const m of enemy.materials) { if (m.color && m._origColor) m.color.setHex(m._origColor); } }, 60);
            if (enemy.health <= 0) { killEnemy(enemy); break; }
        }
    }
    if (!hit) { const wi = raycaster.intersectObjects(walls); if (wi.length > 0) createBulletHole(wi[0].point, wi[0].face.normal); }
}

function killEnemy(enemy) {
    spawnExplosion(enemy.mesh.position.clone().add(new THREE.Vector3(0, 1, 0)));
    scene.remove(enemy.mesh); const idx = enemies.indexOf(enemy);
    if (idx > -1) enemies.splice(idx, 1); enemiesAlive--; player.score += 100; updateHUD(); playSound('kill');
    if (enemiesAlive <= 0) { wave++; setTimeout(spawnWave, 2500); }
}

function startReload() {
    if (player.reloading || player.ammo === player.maxAmmo) return;
    player.reloading = true; reloadEl.style.display = 'block';
    setTimeout(() => { player.ammo = player.maxAmmo; player.reloading = false; reloadEl.style.display = 'none'; updateHUD(); }, player.reloadTime);
}

function hurtPlayer(amount) {
    player.health = Math.max(0, player.health - amount); updateHUD(); playSound('hurt');
    dmgOverlay.style.opacity = '1'; setTimeout(() => { dmgOverlay.style.opacity = '0'; }, 150);
    if (player.health <= 0) gameOver();
}

function gameOver() { gameRunning = false; document.exitPointerLock(); finalScore.textContent = player.score; finalWave.textContent = wave; gameOverEl.style.display = 'flex'; }
function resetGame() {
    for (const e of enemies) scene.remove(e.mesh); enemies.length = 0; enemiesAlive = 0; wave = 1;
    for (const h of bulletHoles) scene.remove(h); bulletHoles.length = 0;
    for (const p of particles) scene.remove(p); particles.length = 0;
    player.health = player.maxHealth; player.score = 0; player.ammo = player.maxAmmo; player.reloading = false;
    player.position.set(0, 1.7, 0); camera.position.set(0, 1.7, 0);
    pitch = 0; yaw = 0; weaponGroup.position.set(0.3, -0.2, -0.35);
    gameOverEl.style.display = 'none'; dmgOverlay.style.opacity = '0'; reloadEl.style.display = 'none';
    updateHUD(); spawnWave(); gameRunning = true;
}
function updateHUD() {
    scoreVal.textContent = player.score; healthVal.textContent = Math.max(0, Math.round(player.health));
    healthFill.style.width = `${(player.health / player.maxHealth) * 100}%`; ammoVal.textContent = player.ammo;
}

const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true; if (e.key.toLowerCase() === 'r' && gameRunning) startReload();
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
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Game loop ───────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);

    for (let i = ambientParticles.length - 1; i >= 0; i--) {
        const p = ambientParticles[i]; p.userData.life -= delta;
        p.position.add(p.userData.vel.clone().multiplyScalar(delta));
        p.material.opacity = Math.max(0, (p.userData.life / p.userData.maxLife) * 0.06);
        if (p.userData.life <= 0) { scene.remove(p); ambientParticles.splice(i, 1); }
    }
    while (ambientParticles.length < 40) createDust();

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

        const bx = Math.sin(player.bobPhase) * player.bobAmount;
        const by = Math.abs(Math.cos(player.bobPhase)) * player.bobAmount;
        weaponGroup.position.x = 0.3 + bx; weaponGroup.position.y = -0.2 + by;
        const kt = (Date.now() - player.lastShot) / 200;
        if (kt < 1) { const k = 1 - kt; weaponGroup.rotation.x = -0.03 * k * k; weaponGroup.position.y -= 0.02 * k * k; }
        else weaponGroup.rotation.x *= 0.95;

        for (const enemy of enemies) {
            const dir = new THREE.Vector3().copy(player.position).sub(enemy.mesh.position);
            dir.y = 0; const dist = dir.length();
            if (dist > enemy.attackRange) {
                dir.normalize().multiplyScalar(enemy.speed * delta);
                enemy.mesh.position.add(dir); enemy.mesh.rotation.y = Math.atan2(dir.x, dir.z);
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
        const p = particles[i]; p.userData.life -= delta;
        p.position.add(p.userData.vel.clone().multiplyScalar(delta));
        p.userData.vel.y -= p.userData.gravity * delta;
        const t = p.userData.life / p.userData.maxLife;
        p.material.opacity = Math.max(0, t); p.scale.setScalar(0.5 + t * 0.5);
        if (p.userData.life <= 0) { scene.remove(p); particles.splice(i, 1); }
    }

    composer.render();
}

animate();

import * as THREE from 'three';

// --- DOM refs ---
const blocker = document.getElementById('blocker');
const startBtn = document.getElementById('startBtn');
const restartBtn = document.getElementById('restartBtn');
const scoreEl = document.getElementById('score');
const healthEl = document.getElementById('health');
const ammoEl = document.getElementById('ammo');
const waveEl = document.getElementById('wave');
const reloadEl = document.getElementById('reload');
const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');

// --- Scene setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 80, 150);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 1.7, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

// --- Lighting ---
const ambientLight = new THREE.AmbientLight(0x404060, 0.6);
scene.add(ambientLight);

const sun = new THREE.DirectionalLight(0xffeedd, 1.2);
sun.position.set(50, 80, 30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 150;
sun.shadow.camera.left = -80;
sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
scene.add(sun);

const hemi = new THREE.HemisphereLight(0x87CEEB, 0x3a7a3a, 0.4);
scene.add(hemi);

// --- Ground ---
const groundGeo = new THREE.PlaneGeometry(200, 200);
const groundMat = new THREE.MeshStandardMaterial({ color: 0x4a7a4a, roughness: 0.9 });
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// --- World objects ---
const walls = [];

function createBuilding(x, z, w, h, d, color) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    walls.push(mesh);
    return mesh;
}

function createBox(x, y, z, size, color) {
    const geo = new THREE.BoxGeometry(size, size, size);
    const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.5 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + size / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    walls.push(mesh);
    return mesh;
}

// Create a fun arena
createBuilding(-20, -20, 8, 5, 8, 0x888888);
createBuilding(20, -20, 8, 5, 8, 0x888888);
createBuilding(-20, 20, 8, 5, 8, 0x888888);
createBuilding(20, 20, 8, 5, 8, 0x888888);
createBuilding(0, -30, 12, 3, 4, 0xaa6644);
createBuilding(0, 30, 12, 3, 4, 0xaa6644);
createBuilding(-30, 0, 4, 3, 12, 0xaa6644);
createBuilding(30, 0, 4, 3, 12, 0xaa6644);

// Scattered cover boxes
const boxPositions = [
    [-12, -12], [12, -12], [-12, 12], [12, 12],
    [-25, 0], [25, 0], [0, -25], [0, 25],
    [-8, -25], [8, 25], [25, -8], [-25, 8]
];
for (const [x, z] of boxPositions) {
    createBox(x, 0.5, z, 1, 0xcc8844);
}

// --- Player state ---
const player = {
    position: new THREE.Vector3(0, 1.7, 0),
    velocity: new THREE.Vector3(),
    health: 100,
    score: 0,
    ammo: 30,
    maxAmmo: 30,
    reloading: false,
    reloadTime: 2000,
    lastShot: 0,
    shootCooldown: 150,
    damage: 34,
    moveSpeed: 8,
    runSpeed: 14,
    isRunning: false,
};

// Mouse look
let pitch = 0;
let yaw = 0;
const sensitivity = 0.002;

// --- Enemies ---
const enemies = [];
const enemyBullets = [];
let wave = 1;
let enemiesAlive = 0;
let enemiesPerWave = 4;
let gameRunning = false;

// --- Raycaster for shooting ---
const raycaster = new THREE.Raycaster();

// --- Audio (simple oscillator sounds) ---
let audioCtx = null;

function initAudio() {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playShootSound() {
    try {
        initAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(800, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(200, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.08);
    } catch(e) {}
}

function playHitSound() {
    try {
        initAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
    } catch(e) {}
}

function playReloadSound() {
    try {
        initAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.setValueAtTime(600, audioCtx.currentTime + 0.1);
        osc.frequency.setValueAtTime(800, audioCtx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.3);
    } catch(e) {}
}

function playDeathSound() {
    try {
        initAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.5);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.5);
    } catch(e) {}
}

function playEnemyHitSound() {
    try {
        initAudio();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.type = 'square';
        osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    } catch(e) {}
}

// --- Create enemy ---
function createEnemy() {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CylinderGeometry(0.4, 0.5, 1.2, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    group.add(body);

    // Head
    const headGeo = new THREE.SphereGeometry(0.3, 8, 8);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xee4444, roughness: 0.4 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.35;
    head.castShadow = true;
    group.add(head);

    // Eyes
    const eyeGeo = new THREE.SphereGeometry(0.07, 6, 6);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffff00 });
    const eye1 = new THREE.Mesh(eyeGeo, eyeMat);
    eye1.position.set(-0.12, 1.4, -0.25);
    group.add(eye1);
    const eye2 = new THREE.Mesh(eyeGeo, eyeMat);
    eye2.position.set(0.12, 1.4, -0.25);
    group.add(eye2);

    // Random spawn position away from player
    let x, z;
    do {
        const angle = Math.random() * Math.PI * 2;
        const dist = 20 + Math.random() * 20;
        x = Math.cos(angle) * dist;
        z = Math.sin(angle) * dist;
    } while (Math.abs(x) < 5 && Math.abs(z) < 5);

    group.position.set(x, 0, z);

    // Random rotation
    group.rotation.y = Math.random() * Math.PI * 2;

    scene.add(group);

    const health = 50 + wave * 10;
    const speed = 2 + wave * 0.2;

    enemies.push({
        mesh: group,
        health,
        maxHealth: health,
        speed: Math.min(speed, 6),
        damage: 8 + wave * 2,
        attackRange: 2,
        attackCooldown: 1000,
        lastAttack: 0,
        state: 'chase', // chase, attack
    });
    enemiesAlive++;
}

// --- Enemy damage indicator ---
function showDamageIndicator(enemy) {
    const mat = enemy.mesh.children[0].material;
    const origColor = mat.color.getHex();
    mat.color.setHex(0xffffff);
    setTimeout(() => {
        if (mat.color) mat.color.setHex(origColor);
    }, 80);
}

// --- Spawn wave ---
function spawnWave() {
    waveEl.textContent = `Волна: ${wave}`;
    const count = enemiesPerWave + Math.floor(wave * 0.5);
    for (let i = 0; i < count; i++) {
        setTimeout(() => createEnemy(), i * 300);
    }
}

// --- Collision detection ---
function checkCollision(pos, radius = 0.4) {
    for (const wall of walls) {
        const box = new THREE.Box3().setFromObject(wall);
        const playerBox = new THREE.Box3(
            new THREE.Vector3(pos.x - radius, 0, pos.z - radius),
            new THREE.Vector3(pos.x + radius, 2, pos.z + radius)
        );
        if (playerBox.intersectsBox(box)) return true;
    }
    // Arena bounds
    const limit = 45;
    if (Math.abs(pos.x) > limit || Math.abs(pos.z) > limit) return true;
    return false;
}

// --- Shooting ---
function shoot() {
    if (!gameRunning) return;
    if (player.reloading) return;
    if (player.ammo <= 0) {
        startReload();
        return;
    }

    const now = Date.now();
    if (now - player.lastShot < player.shootCooldown) return;
    player.lastShot = now;

    player.ammo--;
    updateHUD();
    playShootSound();

    // Muzzle flash effect
    createMuzzleFlash();

    // Raycast from center of screen
    raycaster.setFromCamera({ x: 0, y: 0 }, camera);

    // Check enemy hits
    const enemyMeshes = enemies.map(e => ({
        enemy: e,
        meshes: e.mesh.children.filter(c => c.isMesh),
    }));

    let hit = false;
    for (const { enemy, meshes } of enemyMeshes) {
        const intersects = raycaster.intersectObjects(meshes);
        if (intersects.length > 0) {
            enemy.health -= player.damage;
            showDamageIndicator(enemy);
            playEnemyHitSound();
            hit = true;

            if (enemy.health <= 0) {
                killEnemy(enemy);
            }
            break;
        }
    }

    if (!hit) {
        // Check wall hits for visual feedback
        const wallIntersects = raycaster.intersectObjects(walls);
        if (wallIntersects.length > 0) {
            createBulletHole(wallIntersects[0].point, wallIntersects[0].face.normal);
        }
    }
}

// --- Muzzle flash ---
function createMuzzleFlash() {
    const flash = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 0.3),
        new THREE.MeshBasicMaterial({
            color: 0xffff00,
            transparent: true,
            opacity: 0.8,
            depthWrite: false,
            side: THREE.DoubleSide,
        })
    );
    flash.position.copy(camera.position);
    flash.position.add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(1.5));
    flash.lookAt(camera.position);
    scene.add(flash);
    setTimeout(() => scene.remove(flash), 50);
}

// --- Bullet holes ---
const bulletHoles = [];

function createBulletHole(point, normal) {
    const hole = new THREE.Mesh(
        new THREE.CircleGeometry(0.05, 6),
        new THREE.MeshBasicMaterial({ color: 0x222222, depthTest: true })
    );
    hole.position.copy(point);
    hole.position.add(normal.clone().multiplyScalar(0.01));
    hole.lookAt(point.clone().add(normal));
    scene.add(hole);
    bulletHoles.push(hole);
    if (bulletHoles.length > 50) {
        scene.remove(bulletHoles.shift());
    }
}

// --- Kill enemy ---
function killEnemy(enemy) {
    scene.remove(enemy.mesh);
    const idx = enemies.indexOf(enemy);
    if (idx > -1) enemies.splice(idx, 1);
    enemiesAlive--;

    player.score += 100;
    updateHUD();
    playDeathSound();

    // Check wave clear
    if (enemiesAlive <= 0) {
        wave++;
        setTimeout(spawnWave, 2000);
    }
}

// --- Reload ---
function startReload() {
    if (player.reloading || player.ammo === player.maxAmmo) return;
    player.reloading = true;
    reloadEl.style.display = 'block';
    playReloadSound();
    setTimeout(() => {
        player.ammo = player.maxAmmo;
        player.reloading = false;
        reloadEl.style.display = 'none';
        updateHUD();
    }, player.reloadTime);
}

// --- Enemy hurt player ---
function hurtPlayer(amount) {
    player.health = Math.max(0, player.health - amount);
    updateHUD();

    // Red overlay effect
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(255,0,0,0.15); pointer-events: none; z-index: 6;
        transition: opacity 0.3s;
    `;
    document.body.appendChild(overlay);
    setTimeout(() => {
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 300);
    }, 100);

    if (player.health <= 0) {
        gameOver();
    }
}

// --- Game over ---
function gameOver() {
    gameRunning = false;
    document.exitPointerLock();
    gameOverEl.style.display = 'flex';
    finalScoreEl.textContent = `Очки: ${player.score}`;
}

// --- Reset game ---
function resetGame() {
    // Remove all enemies
    for (const enemy of enemies) {
        scene.remove(enemy.mesh);
    }
    enemies.length = 0;
    enemyBullets.length = 0;
    enemiesAlive = 0;
    wave = 1;

    // Remove bullet holes
    for (const hole of bulletHoles) {
        scene.remove(hole);
    }
    bulletHoles.length = 0;

    // Reset player
    player.health = 100;
    player.score = 0;
    player.ammo = player.maxAmmo;
    player.reloading = false;
    player.velocity.set(0, 0, 0);
    player.position.set(0, 1.7, 0);
    camera.position.set(0, 1.7, 0);
    pitch = 0;
    yaw = 0;

    gameOverEl.style.display = 'none';
    updateHUD();
    reloadEl.style.display = 'none';

    spawnWave();
    gameRunning = true;
}

// --- HUD update ---
function updateHUD() {
    scoreEl.textContent = `Очки: ${player.score}`;
    healthEl.textContent = `❤️ ${player.health}`;
    ammoEl.textContent = `🔫 ${player.ammo} / ${player.maxAmmo}`;
}

// --- Controls ---
const keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key.toLowerCase()] = true;
    if (e.key.toLowerCase() === 'r' && gameRunning) startReload();
});
document.addEventListener('keyup', (e) => {
    keys[e.key.toLowerCase()] = false;
});

document.addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    yaw -= e.movementX * sensitivity;
    pitch -= e.movementY * sensitivity;
    pitch = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch));
});

document.addEventListener('mousedown', (e) => {
    if (e.button === 0 && document.pointerLockElement === renderer.domElement) {
        shoot();
    }
});

// Pointer lock
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

document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== renderer.domElement && gameRunning && player.health > 0) {
        // Don't show blocker, just let them click back
    }
});

// Window resize
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- Game loop ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);

    if (gameRunning) {
        // Player movement
        player.isRunning = keys['shift'];
        const speed = player.isRunning ? player.runSpeed : player.moveSpeed;

        const forward = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);

        const moveVec = new THREE.Vector3();
        if (keys['w']) moveVec.add(forward);
        if (keys['s']) moveVec.sub(forward);
        if (keys['a']) moveVec.sub(right);
        if (keys['d']) moveVec.add(right);

        if (moveVec.length() > 0) {
            moveVec.normalize().multiplyScalar(speed * delta);
            const newPos = player.position.clone().add(moveVec);
            if (!checkCollision(newPos)) {
                player.position.copy(newPos);
            } else {
                // Try sliding along walls (separate axes)
                const tryX = player.position.clone().add(new THREE.Vector3(moveVec.x, 0, 0));
                if (!checkCollision(tryX)) player.position.x = tryX.x;
                const tryZ = player.position.clone().add(new THREE.Vector3(0, 0, moveVec.z));
                if (!checkCollision(tryZ)) player.position.z = tryZ.z;
            }
        }

        // Apply camera
        camera.position.copy(player.position);
        const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
        camera.quaternion.setFromEuler(euler);

        // Enemy AI
        for (const enemy of enemies) {
            const dir = new THREE.Vector3()
                .copy(player.position)
                .sub(enemy.mesh.position);
            dir.y = 0;
            const dist = dir.length();

            if (dist > enemy.attackRange) {
                // Chase
                dir.normalize().multiplyScalar(enemy.speed * delta);
                enemy.mesh.position.add(dir);
                enemy.mesh.rotation.y = Math.atan2(dir.x, dir.z);
            } else {
                // Attack
                const now = Date.now();
                if (now - enemy.lastAttack > enemy.attackCooldown) {
                    enemy.lastAttack = now;
                    hurtPlayer(enemy.damage);
                    // Knockback effect
                    const knockback = player.position.clone().sub(enemy.mesh.position).normalize().multiplyScalar(2);
                    const newPos = player.position.clone().add(knockback);
                    if (!checkCollision(newPos)) player.position.copy(newPos);
                }
            }
        }

        // Update hud wave display
        waveEl.textContent = `Волна: ${wave} | Врагов: ${enemiesAlive}`;
    }

    renderer.render(scene, camera);
}

animate();

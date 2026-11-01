import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// --- GAME CONFIG & STATE ---
const CONFIG = {
    lanes: [-2.5, 0, 2.5],
    speed: 18,
    maxSpeed: 35,
    speedIncrement: 0.05,
    gravity: 30,
    jumpForce: 12
};

let score = 0;
let coinsCount = 0;
let isGameOver = false;
let gameStarted = false;
let currentLaneIndex = 1; // Start in middle lane (0: left, 1: mid, 2: right)

// --- THREE.JS SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a1a);
scene.fog = new THREE.FogExp2(0x0a0a1a, 0.025);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 4, 8);
camera.lookAt(0, 1, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
document.body.appendChild(renderer.domElement);

// --- LIGHTING ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xfff0f5, 1.2);
dirLight.position.set(10, 20, 10);
dirLight.castShadow = true;
scene.add(dirLight);

// --- ENVIRONMENT (Infinite Scrolling Track & City Blocks) ---
const trackLength = 100;
const obstacles = [];
const coins = [];

// Create a stylish cyberpunk road
const roadGeometry = new THREE.PlaneGeometry(10, trackLength);
const roadMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x111122, 
    roughness: 0.8,
    metalness: 0.2 
});

const road1 = new THREE.Mesh(roadGeometry, roadMaterial);
road1.rotation.x = -Math.PI / 2;
road1.position.z = -trackLength / 2;
scene.add(road1);

const road2 = new THREE.Mesh(roadGeometry, roadMaterial);
road2.rotation.x = -Math.PI / 2;
road2.position.z = -trackLength * 1.5;
scene.add(road2);

// --- ASSET LOADER (GLTF Models) ---
const loader = new GLTFLoader();
let playerModel = null;
let obstacleTemplate = null;
let coinTemplate = null;

// Fallback geometries in case models are loading/missing
const fallbackPlayerGeo = new THREE.BoxGeometry(0.8, 1.5, 0.8);
const fallbackMat = new THREE.MeshStandardMaterial({ color: 0x00ffcc });
let player = new THREE.Mesh(fallbackPlayerGeo, fallbackMat);
player.position.set(CONFIG.lanes[currentLaneIndex], 0.75, 0);
scene.add(player);

// Load GLB models using Vite's relative asset URL bundling
loader.load(new URL('./models/player.glb', import.meta.url).href, (gltf) => {
    scene.remove(player);
    playerModel = gltf.scene;
    playerModel.scale.set(0.8, 0.8, 0.8);
    playerModel.position.set(CONFIG.lanes[currentLaneIndex], 0, 0);
    scene.add(playerModel);
    player = playerModel;
}, undefined, (error) => {
    console.log('Using fallback player shape.');
});

loader.load(new URL('./models/obstacle.glb', import.meta.url).href, (gltf) => {
    obstacleTemplate = gltf.scene;
});

loader.load(new URL('./models/coin.glb', import.meta.url).href, (gltf) => {
    coinTemplate = gltf.scene;
});

// --- SPAWNING SYSTEM ---
function spawnObstacleOrCoin(zPos) {
    const lane = Math.floor(Math.random() * 3);
    
    // Spawn Coin
    if (Math.random() > 0.4) {
        if (coinTemplate) {
            const coin = coinTemplate.clone();
            coin.scale.set(0.5, 0.5, 0.5);
            coin.position.set(CONFIG.lanes[lane], 0.5, zPos);
            scene.add(coin);
            coins.push(coin);
        } else {
            const cGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16);
            const cMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8 });
            const coin = new THREE.Mesh(cGeo, cMat);
            coin.rotation.x = Math.PI / 2;
            coin.position.set(CONFIG.lanes[lane], 0.5, zPos);
            scene.add(coin);
            coins.push(coin);
        }
    } 
    // Spawn Obstacle
    else {
        if (obstacleTemplate) {
            const obst = obstacleTemplate.clone();
            obst.scale.set(1, 1, 1);
            obst.position.set(CONFIG.lanes[lane], 0, zPos);
            scene.add(obst);
            obstacles.push(obst);
        } else {
            const oGeo = new THREE.BoxGeometry(1.2, 1.2, 1.2);
            const oMat = new THREE.MeshStandardMaterial({ color: 0xff3366 });
            const obst = new THREE.Mesh(oGeo, oMat);
            obst.position.set(CONFIG.lanes[lane], 0.6, zPos);
            scene.add(obst);
            obstacles.push(obst);
        }
    }
}

// Initial spawn sequence
for (let i = -20; i > -150; i -= 15) {
    spawnObstacleOrCoin(i);
}

// --- CONTROLS ---
let targetX = CONFIG.lanes[currentLaneIndex];
let isJumping = false;
let verticalVelocity = 0;

window.addEventListener('keydown', (e) => {
    if (!gameStarted || isGameOver) return;

    if ((e.key === 'ArrowLeft' || e.key === 'a') && currentLaneIndex > 0) {
        currentLaneIndex--;
        targetX = CONFIG.lanes[currentLaneIndex];
    }
    if ((e.key === 'ArrowRight' || e.key === 'd') && currentLaneIndex < 2) {
        currentLaneIndex++;
        targetX = CONFIG.lanes[currentLaneIndex];
    }
    if ((e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') && !isJumping) {
        isJumping = true;
        verticalVelocity = CONFIG.jumpForce;
    }
});

// Touch / Mobile swipe support
let touchStartX = 0;
let touchStartY = 0;
window.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
});
window.addEventListener('touchend', (e) => {
    if (!gameStarted || isGameOver) return;
    const diffX = e.changedTouches[0].clientX - touchStartX;
    const diffY = e.changedTouches[0].clientY - touchStartY;

    if (Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX > 30 && currentLaneIndex < 2) {
            currentLaneIndex++;
            targetX = CONFIG.lanes[currentLaneIndex];
        } else if (diffX < -30 && currentLaneIndex > 0) {
            currentLaneIndex--;
            targetX = CONFIG.lanes[currentLaneIndex];
        }
    } else {
        if (diffY < -30 && !isJumping) {
            isJumping = true;
            verticalVelocity = CONFIG.jumpForce;
        }
    }
});

// --- UI OVERLAYS ---
const uiDiv = document.createElement('div');
uiDiv.id = 'ui';
uiDiv.innerHTML = `
    <div id="hud" style="display:none;">
        <span id="scoreVal">Score: 0</span> | <span id="coinsVal">Coins: 0</span>
    </div>
    <div id="menu">
        <h1>3D City Runner</h1>
        <p>Use A/D or Arrow Keys to switch lanes. W/Space to jump.</p>
        <button id="startBtn">START GAME</button>
    </div>
    <div id="gameover" style="display:none;">
        <h2>CRASHED!</h2>
        <p id="finalScore">Score: 0</p>
        <button id="restartBtn">PLAY AGAIN</button>
    </div>
`;
document.body.appendChild(uiDiv);

// Style UI
const styleSheet = document.createElement('style');
styleSheet.innerHTML = `
    body { margin: 0; overflow: hidden; background: #0a0a1a; font-family: Arial, sans-serif; user-select: none; }
    #ui { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; display: flex; justify-content: center; align-items: center; }
    #hud { position: absolute; top: 20px; left: 20px; color: #fff; font-size: 20px; font-weight: bold; text-shadow: 2px 2px 4px #000; pointer-events: auto; }
    #menu, #gameover { background: rgba(10, 10, 26, 0.85); padding: 30px; border-radius: 12px; text-align: center; color: #fff; border: 2px solid #00ffcc; pointer-events: auto; box-shadow: 0 0 20px rgba(0,255,204,0.3); }
    h1 { margin-top: 0; color: #00ffcc; font-size: 28px; }
    p { color: #ccc; font-size: 14px; }
    button { background: #00ffcc; color: #000; border: none; padding: 12px 24px; font-size: 16px; font-weight: bold; border-radius: 6px; cursor: pointer; margin-top: 15px; transition: 0.2s; }
    button:hover { background: #fff; box-shadow: 0 0 10px #fff; }
`;
document.head.appendChild(styleSheet);

document.getElementById('startBtn').addEventListener('click', () => {
    document.getElementById('menu').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    gameStarted = true;
});

document.getElementById('restartBtn').addEventListener('click', () => {
    location.reload();
});

// --- GAME LOOP ---
let clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);

    const dt = clock.getDelta();

    if (gameStarted && !isGameOver) {
        // Progressive speed scaling
        if (CONFIG.speed < CONFIG.maxSpeed) {
            CONFIG.speed += CONFIG.speedIncrement * dt;
        }

        score += Math.round(CONFIG.speed * dt * 10);
        document.getElementById('scoreVal').innerText = `Score: ${score}`;

        // Smooth lane switching
        player.position.x += (targetX - player.position.x) * 15 * dt;

        // Jump physics
        if (isJumping) {
            player.position.y += verticalVelocity * dt;
            verticalVelocity -= CONFIG.gravity * dt;

            if (player.position.y <= 0) {
                player.position.y = 0;
                isJumping = false;
                verticalVelocity = 0;
            }
        }

        // Infinite road scrolling
        road1.position.z += CONFIG.speed * dt;
        road2.position.z += CONFIG.speed * dt;
        if (road1.position.z > trackLength) road1.position.z = road2.position.z - trackLength;
        if (road2.position.z > trackLength) road2.position.z = road1.position.z - trackLength;

        // Update Obstacles
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obst = obstacles[i];
            obst.position.z += CONFIG.speed * dt;

            // Collision check
            const playerBox = new THREE.Box3().setFromObject(player);
            const obstBox = new THREE.Box3().setFromObject(obst);

            if (playerBox.intersectsBox(obstBox)) {
                isGameOver = true;
                document.getElementById('finalScore').innerText = `Final Score: ${score}`;
                document.getElementById('gameover').style.display = 'block';
                document.getElementById('hud').style.display = 'none';
            }

            // Recycle obstacle
            if (obst.position.z > 5) {
                scene.remove(obst);
                obstacles.splice(i, 1);
                spawnObstacleOrCoin(-120);
            }
        }

        // Update Coins
        for (let i = coins.length - 1; i >= 0; i--) {
            const coin = coins[i];
            coin.position.z += CONFIG.speed * dt;
            coin.rotation.z += 3 * dt;

            // Collection check
            const playerBox = new THREE.Box3().setFromObject(player);
            const coinBox = new THREE.Box3().setFromObject(coin);

            if (playerBox.intersectsBox(coinBox)) {
                coinsCount++;
                document.getElementById('coinsVal').innerText = `Coins: ${coinsCount}`;
                scene.remove(coin);
                coins.splice(i, 1);
                continue;
            }

            // Recycle coin
            if (coin.position.z > 5) {
                scene.remove(coin);
                coins.splice(i, 1);
                spawnObstacleOrCoin(-120);
            }
        }
    }

    renderer.render(scene, camera);
}

animate();

// Window resizing
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
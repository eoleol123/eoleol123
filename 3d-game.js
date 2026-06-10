/* ==========================================================================
   🎮 Three.js 3D Cyberpunk Space Mission GameMode
   ========================================================================== */

(function() {
  let scene, camera, renderer, clock;
  let player = null; // This will hold our spaceship Group
  let controls = null;
  let animationFrameId = null;
  let isGameActive = false;

  // Game Stage & Player State Variables
  let gameStage = 1; // 1: Meteors, 2: Pirate, 3: Timed Teleport, 4: Dragon Boss
  let currentRingIndex = 0;
  let playerHP = 100;
  let cameraShake = 0;
  let isGameOver = false;
  let isMissionClear = false;

  // Space stage objects
  let starfield = null;
  let rings = [];
  let navigationArrow = null;
  let activeParticles = [];

  // Stage 1 (Meteors) state
  let meteors = [];
  let meteorSpawnTimer = 0;

  // Stage 2 (Pirate Ship) state - Fleet of 4
  let pirateShips = [];
  let pirateLasers = [];

  // Stage 3 (Timed Chase) state
  let stage3Timer = 12.0;

  // Stage 4 (Cyber Dragon Boss) state
  let dragon = null;
  let dragonSegments = [];
  let dragonFireballs = [];
  let activeDragonLaser = null;
  let bombardmentActive = null;
  let blackHoleActive = null;
  let dragonAttackTimer = 0;

  // Flight variables for gradual build-up and slow down
  let currentSpeed = 0;
  let yaw = Math.PI; // horizontal rotation angle (start facing forward)
  let pitch = 0;     // vertical angle (nose up/down)
  let roll = 0;      // bank angle (tilt left/right)
  let hoverHeight = 0.1; // start on ground
  let hoverVelocity = 0; // vertical speed for smooth acceleration/deceleration
  let targetHoverHeight = 0.1; // hover height target

  // Flight performance constants
  const normalSpeed = 16.0;
  const boostSpeed = 36.0;
  const reverseSpeed = -8.0;
  const acceleration = 15.0;
  const friction = 5.0;
  
  const pitchSpeed = 1.2;
  const rollSpeed = 2.0;
  const yawSpeed = 1.4;

  // Custom camera look angle offsets
  let cameraYaw = 0;
  let cameraPitch = 0.2; // slight down-look angle
  let isDraggingMouse = false;

  // Keyboard key states
  const keys = { 
    w: false, a: false, s: false, d: false, 
    Shift: false, ' ': false,
    q: false, e: false,
    ArrowUp: false, ArrowDown: false
  };

  // DOM elements
  const openGameBtn = document.getElementById('open-game-btn');
  const closeGameBtn = document.getElementById('close-game-btn');
  const gameContainer = document.getElementById('game-container');
  const gameCanvas = document.getElementById('game-canvas');
  const loadingOverlay = document.getElementById('game-loading-overlay');
  const loadingText = document.getElementById('game-loading-text');

  // Staged ring coordinates
  const ringCoords = [
    // Stage 1 (1 to 5): Forward trail
    new THREE.Vector3(0, 15, -70),
    new THREE.Vector3(15, 20, -140),
    new THREE.Vector3(-15, 12, -210),
    new THREE.Vector3(10, 25, -280),
    new THREE.Vector3(-10, 18, -350),
    
    // Stage 2 (6 to 10): Turning and climbing (Forward progression)
    new THREE.Vector3(0, 22, -420),
    new THREE.Vector3(20, 15, -490),
    new THREE.Vector3(-20, 28, -560),
    new THREE.Vector3(15, 18, -630),
    new THREE.Vector3(-15, 25, -700),
    
    // Stage 3 (11 to 15): Timed rings (Forward progression)
    new THREE.Vector3(0, 20, -770),
    new THREE.Vector3(25, 25, -840),
    new THREE.Vector3(-25, 15, -910),
    new THREE.Vector3(15, 30, -980),
    new THREE.Vector3(-15, 22, -1050),
    
    // Stage 4 (16 to 20): Orbiting the boss zone (Forward progression)
    new THREE.Vector3(0, 25, -1120),
    new THREE.Vector3(30, 20, -1190),
    new THREE.Vector3(-30, 30, -1260),
    new THREE.Vector3(20, 15, -1330),
    new THREE.Vector3(0, 25, -1400)
  ];

  if (!openGameBtn || !gameContainer) {
    console.error("Game Mode DOM elements not found!");
    return;
  }

  // Open Game Mode
  openGameBtn.addEventListener('click', () => {
    initGame();
  });

  // Close Game Mode
  closeGameBtn.addEventListener('click', () => {
    destroyGame();
  });

  // Handle ESC key to exit
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isGameActive) {
      destroyGame();
    }
  });

  function initGame() {
    if (isGameActive) return;
    isGameActive = true;
    gameContainer.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Pause main portfolio background video
    const bgVideo = document.querySelector('.hero-video-bg');
    if (bgVideo) bgVideo.pause();

    // Create scene, camera, renderer
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020204);
    scene.fog = new THREE.FogExp2(0x020204, 0.006);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2.5, 5.0);

    renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    clock = new THREE.Clock();

    // OrbitControls for camera
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enabled = false;   // Turn off OrbitControls to use custom follow camera

    // Ambient light (Bright indigo tone)
    const ambientLight = new THREE.AmbientLight(0x3a3f58, 1.2);
    scene.add(ambientLight);

    // Directional light (Cyber Space Moon - white and bright)
    const dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    dirLight.position.set(100, 150, 50);
    scene.add(dirLight);

    // Hemisphere light (Space ambient scattering)
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x111122, 1.0);
    scene.add(hemiLight);

    // Cosmic colored point lights
    const pinkLight = new THREE.PointLight(0xff007f, 3.5, 120);
    pinkLight.position.set(-30, 20, -100);
    scene.add(pinkLight);

    const cyanLight = new THREE.PointLight(0x00f0ff, 3.5, 120);
    cyanLight.position.set(30, 10, -200);
    scene.add(cyanLight);

    const greenLight = new THREE.PointLight(0x00ff66, 3.5, 120);
    greenLight.position.set(0, 40, 120);
    scene.add(greenLight);

    // Create Cosmic Starfield
    createStarfield();

    // Create Spaceship
    createSpaceship();

    // Create Mission Rings
    createRings();

    // Create Navigation Arrow Compass
    createNavigationArrow();

    // Bind restart button handlers
    const restartBtnOver = document.getElementById('game-restart-btn-over');
    const restartBtnClear = document.getElementById('game-restart-btn-clear');
    if (restartBtnOver) restartBtnOver.onclick = () => resetGame();
    if (restartBtnClear) restartBtnClear.onclick = () => resetGame();

    // Reset game variables on startup
    resetGame();

    // Hide loading overlay
    loadingOverlay.classList.add('fade-out');

    // Setup inputs and animation frame
    bindInput();
    animate();

    window.addEventListener('resize', onWindowResize);
  }

  function createStarfield() {
    if (starfield) scene.remove(starfield);
    
    const starGeo = new THREE.BufferGeometry();
    const starPositions = [];
    for (let i = 0; i < 1500; i++) {
      const x = (Math.random() - 0.5) * 1000;
      const y = (Math.random() - 0.5) * 1000;
      const z = (Math.random() - 0.5) * 1000;
      starPositions.push(x, y, z);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
    const starMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.9,
      transparent: true,
      opacity: 0.85,
      sizeAttenuation: true
    });
    starfield = new THREE.Points(starGeo, starMat);
    scene.add(starfield);
  }

  function createSpaceship() {
    const shipGroup = new THREE.Group();

    // 1. Sleek metallic main fuselage (cone pointing forward)
    const bodyGeo = new THREE.ConeGeometry(0.5, 2.6, 8);
    bodyGeo.rotateX(Math.PI / 2); // align along Z-axis
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x5a6982, // Light steel/slate blue
      roughness: 0.25,
      metalness: 0.85
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    shipGroup.add(body);

    // 2. High-tech glowing cockpit (Cyan glass sphere)
    const cockpitGeo = new THREE.SphereGeometry(0.32, 16, 16);
    cockpitGeo.scale(1.0, 0.7, 1.6);
    const cockpitMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x004444,
      roughness: 0.1,
      metalness: 0.9
    });
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0, 0.22, -0.4);
    shipGroup.add(cockpit);

    // 3. Swept-back wings
    const wingGeo = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      // Left Wing
      0.0, 0.0, 0.4,
      -2.0, -0.05, 0.7,
      0.0, 0.0, -0.9,
      
      // Right Wing
      0.0, 0.0, 0.4,
      2.0, -0.05, 0.7,
      0.0, 0.0, -0.9
    ]);
    wingGeo.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    wingGeo.computeVertexNormals();
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x2e3b4e, // Lighter wing color
      roughness: 0.3,
      metalness: 0.8,
      side: THREE.DoubleSide
    });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.castShadow = true;
    wings.receiveShadow = true;
    shipGroup.add(wings);

    // 4. Glowing neon pink trim on wings
    const leftTrimGeo = new THREE.BoxGeometry(0.08, 0.04, 1.6);
    leftTrimGeo.rotateY(Math.PI / 6);
    const neonMat = new THREE.MeshStandardMaterial({
      color: 0xff007f,
      emissive: 0xff007f,
      emissiveIntensity: 1.5
    });
    const leftTrim = new THREE.Mesh(leftTrimGeo, neonMat);
    leftTrim.position.set(-1.0, -0.04, 0.15);
    shipGroup.add(leftTrim);

    const rightTrim = leftTrim.clone();
    rightTrim.position.x = 1.0;
    rightTrim.rotation.y = -leftTrim.rotation.y;
    shipGroup.add(rightTrim);

    // 5. Engine Cylinders (Dark chrome)
    const engineGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.7, 8);
    engineGeo.rotateX(Math.PI / 2);
    const engineMat = new THREE.MeshStandardMaterial({
      color: 0x222633,
      metalness: 0.9,
      roughness: 0.15
    });
    
    const leftEngine = new THREE.Mesh(engineGeo, engineMat);
    leftEngine.position.set(-0.35, -0.08, 1.1);
    shipGroup.add(leftEngine);

    const rightEngine = leftEngine.clone();
    rightEngine.position.x = 0.35;
    shipGroup.add(rightEngine);

    // 6. Thrust cone flames (scale changes dynamically on W / Shift)
    const thrusterGeo = new THREE.ConeGeometry(0.16, 0.5, 8);
    thrusterGeo.rotateX(-Math.PI / 2); // point backwards
    thrusterGeo.translate(0, 0, 0.25); // move pivot to base
    
    const thrusterMat = new THREE.MeshBasicMaterial({
      color: 0xff3300,
      transparent: true,
      opacity: 0.85
    });
    
    const leftThruster = new THREE.Mesh(thrusterGeo, thrusterMat);
    leftThruster.position.set(-0.35, -0.08, 1.45);
    shipGroup.add(leftThruster);

    const rightThruster = leftThruster.clone();
    rightThruster.position.x = 0.35;
    shipGroup.add(rightThruster);

    // Save references for dynamic thruster scaling
    shipGroup.userData = {
      leftThruster: leftThruster,
      rightThruster: rightThruster
    };

    player = shipGroup;
    scene.add(player);

    // Starting values (Takeoff/ground constraints completely removed)
    player.position.set(0, 15, 0); 
    player.rotation.set(0, Math.PI, 0); // face forward (Z-)
  }

  function createRingLabel(num) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Draw background circle
    ctx.fillStyle = 'rgba(12, 12, 18, 0.85)';
    ctx.strokeStyle = '#ffcc00';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(64, 64, 55, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    
    // Draw text
    ctx.font = 'bold 64px Courier New, Arial';
    ctx.fillStyle = '#ffcc00';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(255, 204, 0, 0.8)';
    ctx.shadowBlur = 10;
    ctx.fillText(num.toString(), 64, 64);
    
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(9.5, 9.5, 1);
    return sprite;
  }

  function createRings() {
    rings.forEach(r => {
      if (r.mesh) scene.remove(r.mesh);
    });
    rings = [];

    // 2.5x larger ring geometry
    const ringGeo = new THREE.TorusGeometry(8.0, 0.7, 8, 24);

    for (let i = 0; i < ringCoords.length; i++) {
      const ringGroup = new THREE.Group();
      
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xffcc00,
        emissive: 0xffcc00,
        emissiveIntensity: 0.9,
        roughness: 0.1,
        metalness: 0.9
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringGroup.add(ringMesh);
      
      const label = createRingLabel(i + 1);
      label.position.y = 12.0;
      ringGroup.add(label);
      
      ringGroup.position.copy(ringCoords[i]);
      // Initially hidden – visibility managed by updateRingsVisibility()
      rings.push({
        mesh: ringGroup,
        material: ringMat,
        position: ringCoords[i].clone(),
        number: i + 1,
        passed: false
      });
    }
    updateRingsVisibility();
  }

  // Show only rings belonging to the current gameStage; hide all others
  function updateRingsVisibility() {
    const stageStart = (gameStage - 1) * 5; // e.g. stage 1 → 0, stage 2 → 5
    const stageEnd   = stageStart + 5;      // exclusive upper bound
    rings.forEach((ring, idx) => {
      if (idx >= stageStart && idx < stageEnd) {
        if (!scene.getObjectById(ring.mesh.id)) {
          scene.add(ring.mesh);
        }
      } else {
        scene.remove(ring.mesh);
      }
    });
  }

  function createNavigationArrow() {
    if (navigationArrow) scene.remove(navigationArrow);
    
    navigationArrow = new THREE.Group();
    
    // Cylinder shaft
    const shaftGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8);
    shaftGeo.rotateX(Math.PI / 2);
    shaftGeo.translate(0, 0, 0.35); // move pivot
    const shaftMat = new THREE.MeshBasicMaterial({ color: 0x00ffcc });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    navigationArrow.add(shaft);
    
    // Cone head
    const coneGeo = new THREE.ConeGeometry(0.18, 0.45, 8);
    coneGeo.rotateX(-Math.PI / 2);
    coneGeo.translate(0, 0, 0.95);
    const cone = new THREE.Mesh(coneGeo, shaftMat);
    navigationArrow.add(cone);
    
    scene.add(navigationArrow);
  }

  function spawnExplosion(position, color, count = 25, size = 0.5) {
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(size * (0.3 + Math.random() * 0.7), 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.9
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.copy(position);
      
      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 22,
        (Math.random() - 0.5) * 22
      );
      p.userData = {
        velocity: velocity,
        life: 0.7 + Math.random() * 0.5,
        maxLife: 1.2
      };
      scene.add(p);
      activeParticles.push(p);
    }
  }

  function updateParticles(deltaTime) {
    for (let i = activeParticles.length - 1; i >= 0; i--) {
      const p = activeParticles[i];
      p.position.addScaledVector(p.userData.velocity, deltaTime);
      p.userData.life -= deltaTime;
      p.material.opacity = Math.max(0, p.userData.life / p.userData.maxLife);
      
      if (p.userData.life <= 0) {
        scene.remove(p);
        p.geometry.dispose();
        p.material.dispose();
        activeParticles.splice(i, 1);
      }
    }
  }

  function bindInput() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    // Custom camera look drag events
    gameCanvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    
    window.focus();
    gameCanvas.focus();
  }

  function unbindInput() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    
    if (gameCanvas) gameCanvas.removeEventListener('mousedown', onMouseDown);
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('mouseup', onMouseUp);
  }

  function onKeyDown(e) {
    if (e.key === 'w' || e.key === 'W') keys.w = true;
    if (e.key === 'a' || e.key === 'A') keys.a = true;
    if (e.key === 's' || e.key === 'S') keys.s = true;
    if (e.key === 'd' || e.key === 'D') keys.d = true;
    if (e.key === 'Shift') keys.Shift = true;
    if (e.key === ' ') keys[' '] = true;
    
    // Flight pitch controls
    if (e.key === 'q' || e.key === 'Q') keys.q = true;
    if (e.key === 'e' || e.key === 'E') keys.e = true;
    if (e.key === 'ArrowUp') keys.ArrowUp = true;
    if (e.key === 'ArrowDown') keys.ArrowDown = true;
  }

  function onKeyUp(e) {
    if (e.key === 'w' || e.key === 'W') keys.w = false;
    if (e.key === 'a' || e.key === 'A') keys.a = false;
    if (e.key === 's' || e.key === 'S') keys.s = false;
    if (e.key === 'd' || e.key === 'D') keys.d = false;
    if (e.key === 'Shift') keys.Shift = false;
    if (e.key === ' ') keys[' '] = false;
    
    // Flight pitch controls
    if (e.key === 'q' || e.key === 'Q') keys.q = false;
    if (e.key === 'e' || e.key === 'E') keys.e = false;
    if (e.key === 'ArrowUp') keys.ArrowUp = false;
    if (e.key === 'ArrowDown') keys.ArrowDown = false;
  }

  function onMouseDown(e) {
    if (e.button === 0 || e.button === 2) {
      isDraggingMouse = true;
    }
  }

  function onMouseMove(e) {
    if (isDraggingMouse) {
      cameraYaw -= e.movementX * 0.005;
      cameraPitch += e.movementY * 0.005;
      cameraPitch = Math.max(-0.4, Math.min(0.6, cameraPitch));
    }
  }

  function onMouseUp(e) {
    isDraggingMouse = false;
  }

  function onWindowResize() {
    if (!isGameActive) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function showWarningBanner(text) {
    const overlay = document.getElementById('game-warning-overlay');
    const warningText = document.getElementById('game-warning-text');
    if (overlay && warningText) {
      warningText.innerText = text;
      overlay.classList.remove('hidden');
      
      if (window.warningTimeout) clearTimeout(window.warningTimeout);
      window.warningTimeout = setTimeout(() => {
        overlay.classList.add('hidden');
      }, 2500);
    }
  }

  function takeDamage(amount) {
    if (isGameOver || isMissionClear) return;
    
    playerHP -= amount;
    if (playerHP < 0) playerHP = 0;

    // Update HP HUD
    const hpText = document.getElementById('hud-hp-text');
    const hpBar = document.getElementById('hud-hp-bar-inner');
    if (hpText) hpText.innerText = playerHP;
    if (hpBar) hpBar.style.width = playerHP + '%';

    // Flash screen red
    const flash = document.getElementById('game-damage-flash');
    if (flash) {
      flash.classList.add('flash-active');
      setTimeout(() => {
        flash.classList.remove('flash-active');
      }, 150);
    }

    // Set camera shake multiplier
    cameraShake = 0.65;

    if (playerHP <= 0) {
      triggerGameOver();
    }
  }

  function triggerGameOver() {
    isGameOver = true;
    currentSpeed = 0;
    const overScreen = document.getElementById('game-over-screen');
    if (overScreen) overScreen.classList.remove('hidden');
  }

  function triggerMissionClear() {
    isMissionClear = true;
    currentSpeed = 0;
    const clearScreen = document.getElementById('game-clear-screen');
    if (clearScreen) clearScreen.classList.remove('hidden');

    // Celebration fireworks explosions
    for (let i = 0; i < 15; i++) {
      setTimeout(() => {
        if (!isMissionClear) return;
        const offset = new THREE.Vector3(
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 25,
          (Math.random() - 0.5) * 40
        );
        const spawnPos = player.position.clone().add(offset);
        const colors = [0xffcc00, 0x00ff66, 0x00ffff, 0xff00ff, 0xff0033];
        const randomColor = colors[Math.floor(Math.random() * colors.length)];
        spawnExplosion(spawnPos, randomColor, 35, 0.6);
      }, i * 300);
    }
  }

  function resetGame() {
    playerHP = 100;
    currentRingIndex = 0;
    gameStage = 1;
    isGameOver = false;
    isMissionClear = false;

    // Reset flight variables (start mid-air in space)
    currentSpeed = 0;
    yaw = Math.PI;
    pitch = 0;
    roll = 0;
    hoverHeight = 15;
    hoverVelocity = 0;
    targetHoverHeight = 15;

    // Hide screen overlays
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('game-clear-screen').classList.add('hidden');
    document.getElementById('hud-timer-box').classList.add('hidden');

    // Reset player position (mid-air in space)
    if (player) {
      player.position.set(0, 15, 0);
      player.rotation.set(0, Math.PI, 0);
    }

    // Reset HUD text
    const hpText = document.getElementById('hud-hp-text');
    const hpBar = document.getElementById('hud-hp-bar-inner');
    if (hpText) hpText.innerText = playerHP;
    if (hpBar) hpBar.style.width = '100%';

    const ringText = document.getElementById('hud-ring-text');
    if (ringText) ringText.innerText = 1;

    const stageName = document.getElementById('hud-stage-name');
    if (stageName) stageName.innerText = "STAGE 1: METEOR SHOWER";

    // Clear stage entities
    meteors.forEach(m => scene.remove(m));
    meteors = [];
    meteorSpawnTimer = 0;

    // Clear pirate fleet
    pirateShips.forEach(ps => scene.remove(ps.group));
    pirateShips = [];
    pirateLasers.forEach(l => scene.remove(l));
    pirateLasers = [];

    despawnDragon();

    activeParticles.forEach(p => scene.remove(p));
    activeParticles = [];

    // Recreate rings
    createRings();

    showWarningBanner("MISSION INITIATED: EN ROUTE TO RINGS");
  }

  function checkRings(deltaTime) {
    if (isGameOver || isMissionClear) return;
    
    const activeRing = rings[currentRingIndex];
    if (activeRing) {
      // Glow and rotate the active ring
      activeRing.material.emissiveIntensity = 1.6 + Math.sin(clock.getElapsedTime() * 12) * 0.6;
      activeRing.mesh.rotation.y += 0.8 * deltaTime;

      // Distance check for collision (2.5x ring size)
      const dist = player.position.distanceTo(activeRing.position);
      if (dist < 10.5) {
        passRing(activeRing);
      }
    }

    // Stage 3 timer updates
    if (gameStage === 3) {
      stage3Timer -= deltaTime;
      const timerBox = document.getElementById('hud-timer-box');
      const timerText = document.getElementById('hud-timer-text');
      if (timerBox) timerBox.classList.remove('hidden');
      if (timerText) timerText.innerText = Math.max(0, stage3Timer).toFixed(1);

      if (stage3Timer <= 0) {
        relocateActiveRing(activeRing);
      }
    } else {
      const timerBox = document.getElementById('hud-timer-box');
      if (timerBox) timerBox.classList.add('hidden');
    }
  }

  function relocateActiveRing(ring) {
    if (!ring) return;

    // Relocate ring in front of player
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    const newPos = player.position.clone()
      .addScaledVector(forward, 45.0 + Math.random() * 20.0)
      .add(new THREE.Vector3(
        (Math.random() - 0.5) * 45,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 20
      ));

    ring.position.copy(newPos);
    ring.mesh.position.copy(newPos);
    stage3Timer = 12.0;

    spawnExplosion(newPos, 0xffcc00, 20, 0.55);
    showWarningBanner("RING TELEPORTED! RELOCATED AHEAD!");
  }

  function passRing(ring) {
    ring.passed = true;
    ring.material.color.setHex(0x00ff66);
    ring.material.emissive.setHex(0x00ff66);
    ring.material.emissiveIntensity = 2.0;

    spawnExplosion(ring.position, 0x00ff66, 30, 0.6);

    currentRingIndex++;

    const ringText = document.getElementById('hud-ring-text');
    if (ringText) ringText.innerText = Math.min(currentRingIndex + 1, 20);

    if (currentRingIndex >= 20) {
      triggerMissionClear();
      return;
    }

    if (gameStage === 3) {
      stage3Timer = 12.0;
    }

    checkStageTransition();
  }

  function checkStageTransition() {
    const stageName = document.getElementById('hud-stage-name');
    const prevStage = gameStage;
    
    if (currentRingIndex < 5) {
      gameStage = 1;
      if (stageName) stageName.innerText = "STAGE 1: METEOR SHOWER";
    } else if (currentRingIndex < 10) {
      if (gameStage !== 2) {
        gameStage = 2;
        showWarningBanner("WARNING: PIRATE AMBUSH INCOMING!");
        if (stageName) stageName.innerText = "STAGE 2: PIRATE HUNT";
      }
    } else if (currentRingIndex < 15) {
      if (gameStage !== 3) {
        gameStage = 3;
        stage3Timer = 12.0;
        showWarningBanner("WARNING: QUANTUM TELEPORTATION ACTIVE!");
        if (stageName) stageName.innerText = "STAGE 3: TIMED CHASE";
      }
    } else {
      if (gameStage !== 4) {
        gameStage = 4;
        showWarningBanner("BOSS BATTLE: CYBER DRAGON AWOKEN!");
        if (stageName) stageName.innerText = "FINAL STAGE: DRAGON BOSS";
      }
    }
    // Refresh ring visibility on any stage change
    if (gameStage !== prevStage) {
      updateRingsVisibility();
    }
  }

  function updateMeteors(deltaTime) {
    if (gameStage !== 1) {
      meteors.forEach(m => scene.remove(m));
      meteors = [];
      return;
    }

    meteorSpawnTimer += deltaTime;
    if (meteorSpawnTimer >= 0.5) {
      meteorSpawnTimer = 0;
      spawnMeteor();
    }

    // Update existing meteors
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.position.addScaledVector(m.userData.velocity, deltaTime);
      m.rotation.x += m.userData.rotSpeed.x * deltaTime;
      m.rotation.y += m.userData.rotSpeed.y * deltaTime;

      const dist = m.position.distanceTo(player.position);
      if (dist < m.userData.radius + 1.8) {
        takeDamage(5);
        spawnExplosion(m.position, 0xffaa00, 15, 0.4);
        scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
        meteors.splice(i, 1);
        continue;
      }

      // Remove meteor if it flies far behind the player
      const relativeZ = m.position.clone().sub(player.position).applyQuaternion(player.quaternion.clone().invert()).z;
      if (relativeZ > 50.0) {
        scene.remove(m);
        m.geometry.dispose();
        m.material.dispose();
        meteors.splice(i, 1);
      }
    }
  }

  function spawnMeteor() {
    const radius = 1.0 + Math.random() * 2.5;
    const geo = new THREE.DodecahedronGeometry(radius, 1);
    
    // Deform geometry
    const posAttr = geo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      posAttr.setX(i, posAttr.getX(i) + (Math.random() - 0.5) * (radius * 0.25));
      posAttr.setY(i, posAttr.getY(i) + (Math.random() - 0.5) * (radius * 0.25));
      posAttr.setZ(i, posAttr.getZ(i) + (Math.random() - 0.5) * (radius * 0.25));
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x4a4a4e,
      roughness: 0.95,
      metalness: 0.05
    });
    const mesh = new THREE.Mesh(geo, mat);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);
    const spawnPos = player.position.clone()
      .addScaledVector(forward, 90.0)
      .add(new THREE.Vector3(
        (Math.random() - 0.5) * 55,
        (Math.random() - 0.5) * 35,
        (Math.random() - 0.5) * 25
      ));

    mesh.position.copy(spawnPos);

    // Aim towards player + error
    const dir = new THREE.Vector3().subVectors(player.position, spawnPos).normalize();
    dir.x += (Math.random() - 0.5) * 0.25;
    dir.y += (Math.random() - 0.5) * 0.25;
    dir.z += (Math.random() - 0.5) * 0.25;
    dir.normalize();

    const speed = 25.0 + Math.random() * 25.0;
    mesh.userData = {
      velocity: dir.multiplyScalar(speed),
      radius: radius,
      rotSpeed: new THREE.Vector3(Math.random() * 1.5, Math.random() * 1.5, Math.random() * 1.5)
    };

    scene.add(mesh);
    meteors.push(mesh);
  }

  // Build a single 3x-scale pirate ship group and return it
  function buildPirateShipGroup() {
    const group = new THREE.Group();
    // Dark red mecha hull (3x scale: cone radius 9, height 27)
    const hullGeo = new THREE.ConeGeometry(9, 27, 4);
    hullGeo.rotateX(Math.PI / 2);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x5a1818, metalness: 0.9, roughness: 0.2 });
    const body = new THREE.Mesh(hullGeo, hullMat);
    group.add(body);

    // Laser targeting pointer (3x scale)
    const laserPointerGeo = new THREE.CylinderGeometry(0.06, 0.06, 240, 4);
    laserPointerGeo.rotateX(Math.PI / 2);
    laserPointerGeo.translate(0, 0, -120);
    const laserPointerMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.18 });
    const pointer = new THREE.Mesh(laserPointerGeo, laserPointerMat);
    pointer.name = "pointer";
    group.add(pointer);

    // Thrusters (3x scale)
    const engineGeo = new THREE.CylinderGeometry(2.4, 2.4, 6, 8);
    engineGeo.rotateX(Math.PI / 2);
    const engineMat = new THREE.MeshStandardMaterial({ color: 0xff0033, emissive: 0xff0033, emissiveIntensity: 1.5 });
    const engLeft = new THREE.Mesh(engineGeo, engineMat);
    engLeft.position.set(-6, 0, 13.5);
    const engRight = engLeft.clone();
    engRight.position.x = 6;
    group.add(engLeft);
    group.add(engRight);

    return group;
  }

  function spawnPirateFleet() {
    // Remove any previous ships
    pirateShips.forEach(ps => scene.remove(ps.group));
    pirateShips = [];

    const activeRing = rings[currentRingIndex];
    const basePos = activeRing ? activeRing.position.clone() : new THREE.Vector3(0, 22, -420);

    // Offsets so ships spread around the ring
    const offsets = [
      new THREE.Vector3( 80, 30, -60),
      new THREE.Vector3(-80, 20, -60),
      new THREE.Vector3( 40, 50,  60),
      new THREE.Vector3(-40, 10,  60)
    ];

    offsets.forEach((offset, idx) => {
      const group = buildPirateShipGroup();
      group.position.copy(basePos).add(offset);
      scene.add(group);
      pirateShips.push({
        group: group,
        fireTimer: idx * 0.5,           // stagger initial shots
        lockOnTarget: new THREE.Vector3(),
        orbitOffset: offset.clone(),
        orbitPhase: idx * (Math.PI / 2)  // quarter-turn apart
      });
    });
  }

  function updatePirateShip(deltaTime) {
    if (gameStage !== 2) {
      pirateShips.forEach(ps => scene.remove(ps.group));
      pirateShips = [];
      pirateLasers.forEach(l => scene.remove(l));
      pirateLasers = [];
      return;
    }

    if (pirateShips.length === 0) {
      spawnPirateFleet();
    }

    const time = clock.getElapsedTime();
    const activeRing = rings[currentRingIndex];

    pirateShips.forEach((ps, idx) => {
      // Patrol orbit around the active ring
      if (activeRing) {
        const angle = time * 0.5 + ps.orbitPhase;
        const targetPos = activeRing.position.clone().add(new THREE.Vector3(
          Math.cos(angle) * 90,
          20 + Math.sin(time * 0.4 + idx) * 15,
          Math.sin(angle) * 90
        ));
        ps.group.position.lerp(targetPos, 1.0 * deltaTime);
      }
      ps.group.lookAt(player.position);

      // Each ship has its own fire timer
      ps.fireTimer += deltaTime;
      const pointer = ps.group.getObjectByName("pointer");

      if (pointer) {
        if (ps.fireTimer < 1.3) {
          pointer.visible = true;
          ps.lockOnTarget.copy(player.position);
        } else {
          pointer.visible = false;
        }
      }

      if (ps.fireTimer >= 2.5) {
        ps.fireTimer = 0;

        // Fire laser bolt
        const laserGeo = new THREE.CylinderGeometry(0.5, 0.5, 18, 8);
        laserGeo.rotateX(Math.PI / 2);
        const laserMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
        const laser = new THREE.Mesh(laserGeo, laserMat);
        laser.position.copy(ps.group.position);
        const dir = new THREE.Vector3().subVectors(ps.lockOnTarget, ps.group.position).normalize();
        laser.lookAt(ps.lockOnTarget);
        laser.userData = { direction: dir, speed: 80.0, life: 4.0 };
        scene.add(laser);
        pirateLasers.push(laser);
        showWarningBanner("ALERT: PIRATE LASER FIRED!");
      }
    });

    // Update all laser bolts
    for (let i = pirateLasers.length - 1; i >= 0; i--) {
      const l = pirateLasers[i];
      l.position.addScaledVector(l.userData.direction, l.userData.speed * deltaTime);
      l.userData.life -= deltaTime;

      if (l.userData.life <= 0) {
        scene.remove(l);
        l.geometry.dispose();
        l.material.dispose();
        pirateLasers.splice(i, 1);
        continue;
      }

      // Collision check (larger hit radius for 3x ships)
      const dist = l.position.distanceTo(player.position);
      if (dist < 6.0) {
        takeDamage(5);
        spawnExplosion(l.position, 0xff3b30, 10, 0.3);
        scene.remove(l);
        l.geometry.dispose();
        l.material.dispose();
        pirateLasers.splice(i, 1);
      }
    }
  }

  // ─── Western Dragon ──────────────────────────────────────────────
  // Builds a highly polygonal, static Western dragon from primitives.
  // The dragon never moves — only its head-group pivots to face the player.
  function buildWesternDragon() {
    const root = new THREE.Group();

    const scaleDragonMat = (emissInt) => new THREE.MeshStandardMaterial({
      color: 0x0d2b0a,
      metalness: 0.85,
      roughness: 0.25,
      emissive: 0x1a4a10,
      emissiveIntensity: emissInt
    });
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xd4c07a, metalness: 0.3, roughness: 0.6 });
    const eyeMat  = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff6600, emissiveIntensity: 3.0 });
    const wingMat = new THREE.MeshStandardMaterial({
      color: 0x0a1a08, metalness: 0.7, roughness: 0.4,
      emissive: 0x002200, emissiveIntensity: 0.5,
      side: THREE.DoubleSide
    });

    // ── TORSO (Cylinder + sphere caps, r128 compatible) ──
    const torsoGroup = new THREE.Group();
    const torsoCyl = new THREE.Mesh(
      new THREE.CylinderGeometry(28, 28, 70, 16),
      scaleDragonMat(0.6)
    );
    torsoCyl.rotation.z = Math.PI / 2;
    torsoGroup.add(torsoCyl);
    const torsoCapL = new THREE.Mesh(new THREE.SphereGeometry(28, 14, 10), scaleDragonMat(0.6));
    torsoCapL.position.set(-35, 0, 0);
    torsoGroup.add(torsoCapL);
    const torsoCapR = torsoCapL.clone();
    torsoCapR.position.set(35, 0, 0);
    torsoGroup.add(torsoCapR);
    root.add(torsoGroup);

    // ── CHEST ──
    const chestGeo = new THREE.SphereGeometry(32, 14, 12);
    chestGeo.scale(1.1, 0.85, 0.9);
    const chest = new THREE.Mesh(chestGeo, scaleDragonMat(0.7));
    chest.position.set(0, 4, -22);
    root.add(chest);

    // ── BELLY PLATES (4 plates along underside) ──
    for (let i = 0; i < 4; i++) {
      const plateGeo = new THREE.SphereGeometry(22, 8, 6);
      plateGeo.scale(1.0, 0.25, 0.6);
      const plate = new THREE.Mesh(plateGeo, new THREE.MeshStandardMaterial({ color: 0x4a7a30, metalness: 0.4, roughness: 0.5 }));
      plate.position.set(0, -24, -10 + i * 20);
      root.add(plate);
    }

    // ── HEAD GROUP (pivots to track player) ──
    const headGroup = new THREE.Group();
    headGroup.position.set(0, 18, -80); // front of torso
    root.add(headGroup);

    // Head base
    const headGeo = new THREE.SphereGeometry(22, 16, 12);
    headGeo.scale(1.0, 0.82, 1.4);
    const head = new THREE.Mesh(headGeo, scaleDragonMat(0.9));
    headGroup.add(head);

    // Upper jaw / snout
    const snoutGeo = new THREE.ConeGeometry(14, 40, 8);
    snoutGeo.rotateX(Math.PI / 2);
    const snout = new THREE.Mesh(snoutGeo, scaleDragonMat(0.8));
    snout.position.set(0, -4, -38);
    headGroup.add(snout);

    // Lower jaw
    const jawGeo = new THREE.ConeGeometry(12, 34, 8);
    jawGeo.rotateX(-Math.PI / 2 + 0.3);
    const jaw = new THREE.Mesh(jawGeo, scaleDragonMat(0.75));
    jaw.position.set(0, -16, -28);
    headGroup.add(jaw);

    // Fangs (4)
    [[-6, -20, -56], [6, -20, -56], [-10, -18, -50], [10, -18, -50]].forEach(([x, y, z]) => {
      const fangGeo = new THREE.ConeGeometry(2.5, 14, 6);
      fangGeo.rotateX(Math.PI);
      const fang = new THREE.Mesh(fangGeo, boneMat);
      fang.position.set(x, y, z);
      headGroup.add(fang);
    });

    // Eyes
    [[-14, 8, -18], [14, 8, -18]].forEach(([x, y, z]) => {
      const eyeGeo = new THREE.SphereGeometry(6, 10, 10);
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(x, y, z);
      headGroup.add(eye);
      // Pupil slit
      const slitGeo = new THREE.SphereGeometry(3.5, 8, 8);
      slitGeo.scale(0.3, 1, 0.5);
      const slit = new THREE.Mesh(slitGeo, new THREE.MeshBasicMaterial({ color: 0x000000 }));
      slit.position.set(x, y, z - 5.5);
      headGroup.add(slit);
    });

    // Horns (2 curved horns)
    [[-16, 20, 0], [16, 20, 0]].forEach(([x, y, z], idx) => {
      const hornGeo = new THREE.ConeGeometry(4, 32, 8);
      const horn = new THREE.Mesh(hornGeo, boneMat);
      horn.position.set(x, y, z);
      horn.rotation.z = idx === 0 ? -0.45 : 0.45;
      horn.rotation.x = -0.3;
      headGroup.add(horn);
      // Horn tip ridge
      const tipGeo = new THREE.ConeGeometry(2, 14, 8);
      const tip = new THREE.Mesh(tipGeo, boneMat);
      tip.position.set(x + (idx === 0 ? -8 : 8), y + 34, z - 6);
      tip.rotation.z = horn.rotation.z;
      headGroup.add(tip);
    });

    // Brow ridges
    [[-12, 12, -8], [12, 12, -8]].forEach(([x, y, z]) => {
      const ridgeGeo = new THREE.SphereGeometry(6, 8, 6);
      ridgeGeo.scale(1.8, 0.5, 1.2);
      const ridge = new THREE.Mesh(ridgeGeo, scaleDragonMat(0.4));
      ridge.position.set(x, y, z);
      headGroup.add(ridge);
    });

    // Neck
    const neckGeo = new THREE.CylinderGeometry(16, 22, 50, 10);
    neckGeo.rotateX(-0.45);
    const neck = new THREE.Mesh(neckGeo, scaleDragonMat(0.65));
    neck.position.set(0, 14, -52);
    root.add(neck);

    // Neck spines (6 dorsal spines along neck)
    for (let i = 0; i < 6; i++) {
      const spineGeo = new THREE.ConeGeometry(3.5, 18, 6);
      const spine = new THREE.Mesh(spineGeo, boneMat);
      spine.position.set(0, 28, -32 - i * 8);
      spine.rotation.x = -0.2;
      root.add(spine);
    }

    // Dorsal spines along torso (8 spines)
    for (let i = 0; i < 8; i++) {
      const spineH = 20 - i * 1.5;
      const spineGeo = new THREE.ConeGeometry(3, spineH, 6);
      const spine = new THREE.Mesh(spineGeo, boneMat);
      spine.position.set(0, 30, 10 + i * 12);
      root.add(spine);
    }

    // ── WINGS ──
    const buildWing = (side) => {
      const wingGroup = new THREE.Group();

      // Main wing membrane (large flat shape built from triangles → use PlaneGeometry)
      const memGeo = new THREE.PlaneGeometry(120, 90, 6, 4);
      // Taper the top edge to give wing shape
      const memPos = memGeo.attributes.position;
      for (let v = 0; v < memPos.count; v++) {
        const y = memPos.getY(v);
        if (y > 20) {
          const taper = (y - 20) / 70;
          memPos.setX(v, memPos.getX(v) * (1 - taper * 0.7));
        }
      }
      memGeo.computeVertexNormals();
      const mem = new THREE.Mesh(memGeo, wingMat);
      mem.position.set(side * 60, 20, 10);
      mem.rotation.z = side * 0.3;
      mem.rotation.y = side * -0.15;
      wingGroup.add(mem);

      // Wing arm bone (thick cylinder)
      const armGeo = new THREE.CylinderGeometry(5, 7, 80, 10);
      armGeo.rotateZ(Math.PI / 2);
      const arm = new THREE.Mesh(armGeo, scaleDragonMat(0.5));
      arm.position.set(side * 40, 28, 5);
      wingGroup.add(arm);

      // Wing finger bones (3 fingers spread from tip)
      for (let f = 0; f < 3; f++) {
        const fGeo = new THREE.CylinderGeometry(2, 3.5, 65, 8);
        fGeo.rotateZ(Math.PI / 2);
        const finger = new THREE.Mesh(fGeo, scaleDragonMat(0.4));
        const angle = side * (-0.4 + f * 0.3);
        finger.position.set(side * 90, 25 + f * -8, 5 + f * 15);
        finger.rotation.z = angle;
        wingGroup.add(finger);
      }

      // Wing wrist joint
      const wristGeo = new THREE.SphereGeometry(8, 10, 8);
      const wrist = new THREE.Mesh(wristGeo, scaleDragonMat(0.6));
      wrist.position.set(side * 80, 22, 5);
      wingGroup.add(wrist);

      root.add(wingGroup);
    };
    buildWing(1);
    buildWing(-1);

    // ── FRONT LEGS ──
    const buildFrontLeg = (side) => {
      const lg = new THREE.Group();

      // Upper leg (cylinder + sphere caps)
      const upperGroup = new THREE.Group();
      const upCyl = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 40, 10), scaleDragonMat(0.55));
      upperGroup.add(upCyl);
      const upCapT = new THREE.Mesh(new THREE.SphereGeometry(9, 8, 6), scaleDragonMat(0.55));
      upCapT.position.y = 20;
      upperGroup.add(upCapT);
      const upCapB = upCapT.clone();
      upCapB.position.y = -20;
      upperGroup.add(upCapB);
      upperGroup.rotation.z = side * 0.5;
      upperGroup.position.set(side * 34, -30, -30);
      lg.add(upperGroup);

      // Lower leg
      const lowerGroup = new THREE.Group();
      const loCyl = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 38, 10), scaleDragonMat(0.5));
      lowerGroup.add(loCyl);
      const loCapT = new THREE.Mesh(new THREE.SphereGeometry(7, 8, 6), scaleDragonMat(0.5));
      loCapT.position.y = 19;
      lowerGroup.add(loCapT);
      const loCapB = loCapT.clone();
      loCapB.position.y = -19;
      lowerGroup.add(loCapB);
      lowerGroup.position.set(side * 44, -58, -35);
      lowerGroup.rotation.z = side * 0.6;
      lg.add(lowerGroup);

      const footGeo = new THREE.SphereGeometry(10, 10, 8);
      footGeo.scale(1.2, 0.5, 1.5);
      const foot = new THREE.Mesh(footGeo, scaleDragonMat(0.45));
      foot.position.set(side * 52, -78, -28);
      lg.add(foot);

      // Claws
      for (let c = 0; c < 3; c++) {
        const clawGeo = new THREE.ConeGeometry(2.5, 12, 6);
        clawGeo.rotateX(Math.PI / 2);
        const claw = new THREE.Mesh(clawGeo, boneMat);
        claw.position.set(side * 52 + (c - 1) * 5, -84, -22 - c * 4);
        lg.add(claw);
      }
      root.add(lg);
    };
    buildFrontLeg(1);
    buildFrontLeg(-1);

    // ── REAR LEGS ──
    const buildRearLeg = (side) => {
      const lg = new THREE.Group();

      // Upper rear leg
      const upperGroup = new THREE.Group();
      const upCyl = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 45, 10), scaleDragonMat(0.55));
      upperGroup.add(upCyl);
      const upCapT = new THREE.Mesh(new THREE.SphereGeometry(11, 8, 6), scaleDragonMat(0.55));
      upCapT.position.y = 22.5;
      upperGroup.add(upCapT);
      const upCapB = upCapT.clone();
      upCapB.position.y = -22.5;
      upperGroup.add(upCapB);
      upperGroup.position.set(side * 36, -28, 30);
      upperGroup.rotation.z = side * 0.45;
      lg.add(upperGroup);

      // Lower rear leg
      const lowerGroup = new THREE.Group();
      const loCyl = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 40, 10), scaleDragonMat(0.5));
      lowerGroup.add(loCyl);
      const loCapT = new THREE.Mesh(new THREE.SphereGeometry(9, 8, 6), scaleDragonMat(0.5));
      loCapT.position.y = 20;
      lowerGroup.add(loCapT);
      const loCapB = loCapT.clone();
      loCapB.position.y = -20;
      lowerGroup.add(loCapB);
      lowerGroup.position.set(side * 46, -60, 40);
      lowerGroup.rotation.z = side * 0.5;
      lg.add(lowerGroup);

      const footGeo = new THREE.SphereGeometry(12, 10, 8);
      footGeo.scale(1.2, 0.5, 1.5);
      const foot = new THREE.Mesh(footGeo, scaleDragonMat(0.45));
      foot.position.set(side * 54, -82, 50);
      lg.add(foot);

      for (let c = 0; c < 3; c++) {
        const clawGeo = new THREE.ConeGeometry(3, 14, 6);
        clawGeo.rotateX(Math.PI / 2);
        const claw = new THREE.Mesh(clawGeo, boneMat);
        claw.position.set(side * 54 + (c - 1) * 6, -90, 56 + c * 4);
        lg.add(claw);
      }
      root.add(lg);
    };
    buildRearLeg(1);
    buildRearLeg(-1);

    // ── TAIL (7 tapered cylinder segments, r128 compatible) ──
    let tailZ = 60;
    let tailR = 22;
    for (let t = 0; t < 7; t++) {
      const tailR2 = Math.max(4, tailR - 2.6);
      const tGeo = new THREE.CylinderGeometry(tailR2, tailR, 30, 10);
      tGeo.rotateX(Math.PI / 2);
      const tail = new THREE.Mesh(tGeo, scaleDragonMat(0.5 - t * 0.05));
      tail.position.set(0, -8 + t * -4, tailZ + t * 28);
      tail.rotation.y = Math.sin(t * 0.6) * 0.25;
      root.add(tail);
      tailR = tailR2;
    }

    // Tail spike
    const tailSpikeGeo = new THREE.ConeGeometry(8, 40, 8);
    tailSpikeGeo.rotateX(Math.PI / 2);
    const tailSpike = new THREE.Mesh(tailSpikeGeo, boneMat);
    tailSpike.position.set(0, -34, tailZ + 7 * 28 + 20);
    root.add(tailSpike);

    // ── AMBIENT POINT LIGHT (dragon eyes glow on scene) ──
    const dragonLight = new THREE.PointLight(0xff6600, 3.5, 350);
    dragonLight.position.set(0, 18, -80);
    root.add(dragonLight);

    // Store head group reference for aim tracking
    root.userData.headGroup = headGroup;

    return root;
  }

  function spawnDragon() {
    despawnDragon();

    // Build static Western dragon
    dragon = buildWesternDragon();

    // Place far behind ring 20 (index 19), facing the player (forward = -Z)
    const ring20 = rings[19];
    const dragonZ = ring20 ? ring20.position.z + 600 : -3000;
    dragon.position.set(0, 40, dragonZ);
    dragon.rotation.y = Math.PI; // face toward -Z (toward player approach)

    scene.add(dragon);

    dragonSegments = []; // not used for Western dragon
    dragonAttackTimer = 0;
  }

  function updateDragon(deltaTime) {
    if (gameStage !== 4) {
      despawnDragon();
      return;
    }

    if (!dragon) {
      spawnDragon();
    }

    // Dragon body is STATIC — only the head group pivots toward the player
    const headGroup = dragon.userData.headGroup;
    if (headGroup && player) {
      // Convert player world pos to dragon-local space for lookAt
      const playerLocal = dragon.worldToLocal(player.position.clone());
      headGroup.lookAt(playerLocal);
    }

    // Swirl ring rotation inside active black hole
    if (blackHoleActive && blackHoleActive.group) {
      const swirl = blackHoleActive.group.getObjectByName("swirl");
      if (swirl) swirl.rotation.z += 2.5 * deltaTime;
    }

    // Dragon attacks
    dragonAttackTimer += deltaTime;
    if (dragonAttackTimer >= 4.0) {
      dragonAttackTimer = 0;
      const roll = Math.floor(Math.random() * 3) + 1;
      triggerDragonAttack(roll);
    }

    // 1) Update active dragon laser beam — tracks & rotates toward player each frame
    if (activeDragonLaser) {
      activeDragonLaser.timer -= deltaTime;

      // Mouth is at headGroup world position + forward offset
      const headGroup = dragon.userData.headGroup;
      const headWorldPos = new THREE.Vector3();
      headGroup.getWorldPosition(headWorldPos);
      // Push from head centre toward snout (~60 units in local -Z → world)
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(headGroup.getWorldQuaternion(new THREE.Quaternion()));
      const mouthPos = headWorldPos.clone().addScaledVector(fwd, 60);

      // Beam direction toward player
      const beamDir = new THREE.Vector3().subVectors(player.position, mouthPos).normalize();
      const zAxis = new THREE.Vector3(0, 0, 1);
      const beamQuat = new THREE.Quaternion().setFromUnitVectors(zAxis, beamDir);

      activeDragonLaser.mesh.position.copy(mouthPos);
      activeDragonLaser.mesh.quaternion.copy(beamQuat);

      // Pulse glow
      const pulse = 0.55 + 0.45 * Math.sin(clock.getElapsedTime() * 28);
      activeDragonLaser.mesh.material.opacity = pulse;

      // Damage check
      const toPlayer = new THREE.Vector3().subVectors(player.position, mouthPos);
      const projLen = toPlayer.dot(beamDir);
      if (projLen > 0 && projLen < 600) {
        const perp = toPlayer.clone().addScaledVector(beamDir, -projLen);
        if (perp.length() < 10.0) takeDamage(3);
      }

      if (activeDragonLaser.timer <= 0) {
        scene.remove(activeDragonLaser.mesh);
        activeDragonLaser.mesh.geometry.dispose();
        activeDragonLaser.mesh.material.dispose();
        activeDragonLaser = null;
      }
    }

    // 2) Warning bombardment
    if (bombardmentActive) {
      const time = clock.getElapsedTime();
      bombardmentActive.timer -= deltaTime;
      const scale = 1.0 + Math.sin(time * 24) * 0.12;
      bombardmentActive.mesh.scale.set(scale, scale, scale);

      if (bombardmentActive.timer <= 0) {
        const center = bombardmentActive.center;
        spawnExplosion(center, 0xff4500, 30, 0.7);
        if (player.position.distanceTo(center) < 12.0) takeDamage(5);
        scene.remove(bombardmentActive.mesh);
        bombardmentActive.mesh.geometry.dispose();
        bombardmentActive.mesh.material.dispose();
        bombardmentActive = null;
      }
    }

    // 3) Black hole gravitational pull
    if (blackHoleActive) {
      blackHoleActive.timer -= deltaTime;
      const center = blackHoleActive.center;
      const pullDir = new THREE.Vector3().subVectors(center, player.position);
      const dist = pullDir.length();

      if (dist < 45.0) {
        const pullForce = (28.0 / Math.max(dist, 4.0)) * 1.6;
        player.position.addScaledVector(pullDir.normalize(), pullForce * deltaTime);
      }
      if (dist < 3.2) {
        takeDamage(5);
        const bounceDir = new THREE.Vector3().subVectors(player.position, center).normalize();
        player.position.addScaledVector(bounceDir, 12.0);
      }
      if (blackHoleActive.timer <= 0) {
        scene.remove(blackHoleActive.group);
        blackHoleActive.group.traverse(obj => {
          if (obj.geometry) obj.geometry.dispose();
          if (obj.material) obj.material.dispose();
        });
        blackHoleActive = null;
      }
    }
  }

  function triggerDragonAttack(patternId) {
    if (patternId === 1) {
      // TRACKING LASER BEAM from dragon mouth
      if (activeDragonLaser) return;

      const beamGeo = new THREE.CylinderGeometry(5.0, 5.0, 600, 16);
      beamGeo.rotateX(Math.PI / 2);
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.88 });
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);

      // Mouth position (head world pos + forward)
      const headGroup = dragon.userData.headGroup;
      const headWorldPos = new THREE.Vector3();
      headGroup.getWorldPosition(headWorldPos);
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(headGroup.getWorldQuaternion(new THREE.Quaternion()));
      const mouthPos = headWorldPos.clone().addScaledVector(fwd, 60);
      beamMesh.position.copy(mouthPos);

      const beamDir = new THREE.Vector3().subVectors(player.position, mouthPos).normalize();
      const zAxis = new THREE.Vector3(0, 0, 1);
      beamMesh.quaternion.setFromUnitVectors(zAxis, beamDir);

      scene.add(beamMesh);
      activeDragonLaser = { mesh: beamMesh, timer: 3.5 };
      showWarningBanner("BOSS ATTACK: DRAGON FIRE BREATH!");
      spawnExplosion(mouthPos, 0xff4400, 25, 1.2);

    } else if (patternId === 2) {
      // Orbital warning bombardment
      if (bombardmentActive) return;
      const center = player.position.clone();
      const warningGeo = new THREE.SphereGeometry(12, 16, 16);
      const warningMat = new THREE.MeshBasicMaterial({ color: 0xff3b30, wireframe: true, transparent: true, opacity: 0.35 });
      const warningMesh = new THREE.Mesh(warningGeo, warningMat);
      warningMesh.position.copy(center);
      scene.add(warningMesh);
      bombardmentActive = { mesh: warningMesh, center: center, timer: 2.0 };
      showWarningBanner("WARNING: PLASMATIC BOMBARDMENT!");

    } else if (patternId === 3) {
      // Black hole gravity well
      if (blackHoleActive) return;
      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 8,
        -18
      ).applyQuaternion(player.quaternion);
      const center = player.position.clone().add(offset);
      const bhGroup = new THREE.Group();
      const coreGeo = new THREE.SphereGeometry(2.0, 16, 16);
      const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: 0x06000d }));
      bhGroup.add(core);
      const torusGeo = new THREE.TorusGeometry(4.0, 0.35, 8, 20);
      const torusMat = new THREE.MeshStandardMaterial({ color: 0x7b00ff, emissive: 0x7b00ff, emissiveIntensity: 1.5, transparent: true, opacity: 0.8 });
      const torus = new THREE.Mesh(torusGeo, torusMat);
      torus.name = "swirl";
      torus.rotateX(Math.PI / 2);
      bhGroup.add(torus);
      bhGroup.position.copy(center);
      scene.add(bhGroup);
      blackHoleActive = { group: bhGroup, center: center, timer: 5.0 };
      showWarningBanner("WARNING: GRAVITY BLACK HOLE!");
    }
  }

  function despawnDragon() {
    if (dragon) {
      scene.remove(dragon);
      dragon.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
      dragon = null;
    }
    dragonSegments.forEach(s => scene.remove(s));
    dragonSegments = [];
    dragonFireballs.forEach(f => scene.remove(f));
    dragonFireballs = [];

    if (activeDragonLaser) {
      scene.remove(activeDragonLaser.mesh);
      activeDragonLaser.mesh.geometry.dispose();
      activeDragonLaser.mesh.material.dispose();
      activeDragonLaser = null;
    }
    if (bombardmentActive) {
      scene.remove(bombardmentActive.mesh);
      bombardmentActive = null;
    }
    if (blackHoleActive) {
      scene.remove(blackHoleActive.group);
      blackHoleActive = null;
    }
  }

  function animate() {
    if (!isGameActive) return;
    
    animationFrameId = requestAnimationFrame(animate);

    const deltaTime = Math.min(clock.getDelta(), 0.1); // Clamp deltaTime

    // Update flight controls and physics
    updatePlayerPhysics(deltaTime);

    // Update Mission checks
    checkRings(deltaTime);

    // Update Stage specific loops
    updateMeteors(deltaTime);
    updatePirateShip(deltaTime);
    updateDragon(deltaTime);

    // Update explosive particles
    updateParticles(deltaTime);

    // Update Navigation Arrow Compass pointing to active ring
    if (navigationArrow && player) {
      const activeRing = rings[currentRingIndex];
      if (activeRing) {
        navigationArrow.visible = true;
        
        // Position slightly in front of ship's nose
        const offset = new THREE.Vector3(0, 0.5, -1.6).applyQuaternion(player.quaternion);
        navigationArrow.position.copy(player.position).add(offset);
        
        // Look at target ring position
        navigationArrow.lookAt(activeRing.position);
      } else {
        navigationArrow.visible = false;
      }
    }

    // Smooth follow camera locked behind ship
    if (player) {
      if (controls) controls.enabled = false;
      
      const relativeCameraHolder = new THREE.Vector3(0, 2.0, 5.0); // 5 behind, 2 up
      const euler = new THREE.Euler(cameraPitch, cameraYaw, 0, 'YXZ');
      const quat = new THREE.Quaternion().setFromEuler(euler);
      const combinedRotation = player.quaternion.clone().multiply(quat);
      
      relativeCameraHolder.applyQuaternion(combinedRotation);
      relativeCameraHolder.add(player.position);
      
      camera.position.lerp(relativeCameraHolder, 0.08);

      // Camera Shake impact
      if (cameraShake > 0.01) {
        camera.position.x += (Math.random() - 0.5) * cameraShake;
        camera.position.y += (Math.random() - 0.5) * cameraShake;
        camera.position.z += (Math.random() - 0.5) * cameraShake;
        cameraShake = THREE.MathUtils.lerp(cameraShake, 0, 10.0 * deltaTime);
      }
      
      const lookAtPos = player.position.clone();
      lookAtPos.y += 0.8;
      camera.lookAt(lookAtPos);
    }

    renderer.render(scene, camera);
  }

  function updatePlayerPhysics(deltaTime) {
    if (!player) return;

    // 1. Hover elevation (Spacebar) - Spring-Damper Physics
    if (keys[' '] && !isGameOver && !isMissionClear) {
      targetHoverHeight += 5.0 * deltaTime; // climb continuously when holding Spacebar
    }
    
    const hoverStiffness = 5.0;
    const hoverDamping = 3.0;
    
    const hoverForce = hoverStiffness * (targetHoverHeight - hoverHeight) - hoverDamping * hoverVelocity;
    hoverVelocity += hoverForce * deltaTime;
    
    hoverVelocity = THREE.MathUtils.clamp(hoverVelocity, -12.0, 12.0);
    hoverHeight += hoverVelocity * deltaTime;
    // No floor clamp — free descent in space

    // 2. Forward/reverse speed (gradual velocity build-up & slow down)
    let targetSpeed = 0;
    const isMovingForward = keys.w || keys.W;
    const isMovingBackward = keys.s || keys.S;
    const isBoosting = keys.Shift; 

    if (!isGameOver && !isMissionClear) {
      if (isBoosting) {
        targetSpeed = boostSpeed;
      } else if (isMovingForward) {
        targetSpeed = normalSpeed;
      } else if (isMovingBackward) {
        targetSpeed = reverseSpeed;
      }
    }

    // Smooth speed interpolation (gradual build up / slow down)
    if (currentSpeed < targetSpeed) {
      currentSpeed += acceleration * deltaTime;
      if (currentSpeed > targetSpeed) currentSpeed = targetSpeed;
    } else if (currentSpeed > targetSpeed) {
      const decel = (targetSpeed === 0) ? friction : acceleration;
      currentSpeed -= decel * deltaTime;
      if (currentSpeed < targetSpeed) currentSpeed = targetSpeed;
    }

    // 3. Pitch, Roll, Yaw calculations
    let targetPitch = 0;
    let targetRoll = 0;

    if (!isGameOver && !isMissionClear) {
      // Manual Pitch (ArrowUp/ArrowDown)
      if (keys.ArrowUp) {
        targetPitch = -0.45; // Pitch down
      } else if (keys.ArrowDown) {
        targetPitch = 0.45;  // Pitch up
      }

      // Coupled Pitch from W/S acceleration/deceleration
      if (isMovingForward || isBoosting) {
        targetPitch -= 0.18; // tilt nose down when accelerating forward
      }
      if (isMovingBackward) {
        targetPitch += 0.28; // tilt nose up when backing up/braking
      }

      // Yaw & Roll banking (A/D)
      if (keys.a || keys.A) {
        yaw += yawSpeed * deltaTime; // turn left
        targetRoll = 0.55;           // bank left
      } else if (keys.d || keys.D) {
        yaw -= yawSpeed * deltaTime; // turn right
        targetRoll = -0.55;          // bank right
      }

      // Manual Roll (Q/E) overriding A/D banking
      if (keys.q || keys.Q) {
        targetRoll = 0.65;
      } else if (keys.e || keys.E) {
        targetRoll = -0.65;
      }
    }

    // Interpolate rotations smoothly
    pitch = THREE.MathUtils.lerp(pitch, targetPitch, 4.0 * deltaTime);
    roll = THREE.MathUtils.lerp(roll, targetRoll, 5.0 * deltaTime);

    // Apply rotations
    player.rotation.set(0, 0, 0);
    player.rotation.y = yaw;
    player.rotateX(pitch);
    player.rotateZ(roll);

    // 4. Update Position
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(player.quaternion);

    // Free space flight — no ground constraints
    player.position.addScaledVector(direction, currentSpeed * deltaTime);

    // Adjust targetHoverHeight dynamically to follow active flight climbing/diving when manually pitching
    const isMoving = isMovingForward || isMovingBackward || isBoosting;
    const isManuallyPitching = keys.ArrowUp || keys.ArrowDown;
    if (isMoving && isManuallyPitching) {
      targetHoverHeight = player.position.y;
    }

    // Apply altitude tracking (spacebar lifts, no floor clamp)
    if (player.position.y > hoverHeight) {
      const pullDownSpeed = keys[' '] ? 1.2 : 4.5;
      player.position.y = THREE.MathUtils.lerp(player.position.y, hoverHeight, pullDownSpeed * deltaTime);
    } else {
      player.position.y = THREE.MathUtils.lerp(player.position.y, hoverHeight, 8.0 * deltaTime);
    }

    // Auto-center camera back behind the ship if the user isn't dragging
    if (!isDraggingMouse) {
      cameraYaw = THREE.MathUtils.lerp(cameraYaw, 0, 2.0 * deltaTime);
      cameraPitch = THREE.MathUtils.lerp(cameraPitch, 0.2, 2.0 * deltaTime);
    }

    // 5. Thruster scaling and colors (grows based on speed & boost)
    if (player.userData.leftThruster && player.userData.rightThruster) {
      const activeThrust = (isMovingForward || isBoosting) ? (isBoosting ? 2.5 : 1.4) : 0.4;
      const currentScaleZ = player.userData.leftThruster.scale.z;
      const nextScaleZ = THREE.MathUtils.lerp(currentScaleZ, activeThrust, 10.0 * deltaTime);
      
      player.userData.leftThruster.scale.set(1.0, 1.0, nextScaleZ);
      player.userData.rightThruster.scale.set(1.0, 1.0, nextScaleZ);
      
      if (isBoosting) {
        player.userData.leftThruster.material.color.setHex(0x00f0ff);
        player.userData.rightThruster.material.color.setHex(0x00f0ff);
      } else {
        player.userData.leftThruster.material.color.setHex(0xff3300);
        player.userData.rightThruster.material.color.setHex(0xff3300);
      }
    }

    // 6. Camera Field-Of-View shake/expand on Booster active
    if (isBoosting) {
      camera.fov = THREE.MathUtils.lerp(camera.fov, 74, 5.0 * deltaTime);
    } else {
      camera.fov = THREE.MathUtils.lerp(camera.fov, 60, 5.0 * deltaTime);
    }
    camera.updateProjectionMatrix();
  }

  function destroyGame() {
    if (!isGameActive) return;
    isGameActive = false;
    
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    // Hide container and reset scroll
    gameContainer.classList.add('hidden');
    document.body.style.overflow = 'auto';

    // Resume Background video
    const bgVideo = document.querySelector('.hero-video-bg');
    if (bgVideo) {
      bgVideo.play().catch(err => console.log("Video resume failed:", err));
    }

    // Unbind listeners
    unbindInput();
    window.removeEventListener('resize', onWindowResize);

    // Deep clean-up Three.js memory
    if (scene) {
      // Despawn stages
      meteors.forEach(m => scene.remove(m));
      meteors = [];
      
      // Clear pirate fleet
      pirateShips.forEach(ps => scene.remove(ps.group));
      pirateShips = [];
      pirateLasers.forEach(l => scene.remove(l));
      pirateLasers = [];
      
      despawnDragon();
      
      activeParticles.forEach(p => scene.remove(p));
      activeParticles = [];

      rings.forEach(r => scene.remove(r.mesh));
      rings = [];

      if (navigationArrow) {
        scene.remove(navigationArrow);
        navigationArrow = null;
      }

      if (starfield) {
        scene.remove(starfield);
        starfield = null;
      }

      scene.traverse((object) => {
        if (object.isMesh) {
          if (object.geometry) object.geometry.dispose();
          if (object.material) {
            if (Array.isArray(object.material)) {
              object.material.forEach(mat => disposeMaterial(mat));
            } else {
              disposeMaterial(object.material);
            }
          }
        }
      });
      scene = null;
    }

    if (controls) {
      controls.dispose();
      controls = null;
    }

    if (renderer) {
      renderer.dispose();
      renderer = null;
    }

    player = null;
    clock = null;
    
    console.log("3D GameMode components disposed and memory freed successfully.");
  }

  function disposeMaterial(mat) {
    if (mat.map) mat.map.dispose();
    if (mat.lightMap) mat.lightMap.dispose();
    if (mat.bumpMap) mat.bumpMap.dispose();
    if (mat.normalMap) mat.normalMap.dispose();
    if (mat.specularMap) mat.specularMap.dispose();
    if (mat.envMap) mat.envMap.dispose();
    if (mat.alphaMap) mat.alphaMap.dispose();
    if (mat.aoMap) mat.aoMap.dispose();
    if (mat.displacementMap) mat.displacementMap.dispose();
    if (mat.emissiveMap) mat.emissiveMap.dispose();
    if (mat.gradientMap) mat.gradientMap.dispose();
    if (mat.metalnessMap) mat.metalnessMap.dispose();
    if (mat.roughnessMap) mat.roughnessMap.dispose();
    mat.dispose();
  }
})();

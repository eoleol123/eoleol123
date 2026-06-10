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

  // Stage 2 (Pirate Ship) state
  let pirateShip = null;
  let pirateLasers = [];
  let pirateFireTimer = 0;
  let pirateLockOnTarget = new THREE.Vector3();

  // Stage 3 (Timed Chase) state
  let stage3Timer = 12.0;

  // Stage 4 (Cyber Dragon Boss) state
  let dragon = null;
  let dragonSegments = [];
  let dragonFireballs = [];
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
    new THREE.Vector3(0, 10, -50),
    new THREE.Vector3(15, 18, -100),
    new THREE.Vector3(-20, 12, -150),
    new THREE.Vector3(-5, 22, -200),
    new THREE.Vector3(25, 15, -250),
    
    // Stage 2 (6 to 10): Turning and climbing
    new THREE.Vector3(0, 32, -300),
    new THREE.Vector3(-35, 42, -320),
    new THREE.Vector3(-55, 28, -265),
    new THREE.Vector3(-25, 18, -215),
    new THREE.Vector3(15, 28, -195),
    
    // Stage 3 (11 to 15): Timed rings (relocate on timeout)
    new THREE.Vector3(45, 22, -145),
    new THREE.Vector3(55, 38, -95),
    new THREE.Vector3(35, 18, -45),
    new THREE.Vector3(5, 32, 5),
    new THREE.Vector3(-35, 22, 55),
    
    // Stage 4 (16 to 20): Orbiting the boss zone
    new THREE.Vector3(-55, 38, 125),
    new THREE.Vector3(-25, 48, 185),
    new THREE.Vector3(25, 28, 205),
    new THREE.Vector3(55, 42, 145),
    new THREE.Vector3(0, 32, 95)
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

    // Ambient light (Dark indigo tone)
    const ambientLight = new THREE.AmbientLight(0x090a16, 0.5);
    scene.add(ambientLight);

    // Directional light (Cyber Space Moon)
    const dirLight = new THREE.DirectionalLight(0x50558a, 0.8);
    dirLight.position.set(40, 60, 20);
    scene.add(dirLight);

    // Cosmic colored point lights
    const pinkLight = new THREE.PointLight(0xff007f, 3.0, 80);
    pinkLight.position.set(-30, 20, -100);
    scene.add(pinkLight);

    const cyanLight = new THREE.PointLight(0x00f0ff, 3.0, 80);
    cyanLight.position.set(30, 10, -200);
    scene.add(cyanLight);

    const greenLight = new THREE.PointLight(0x00ff66, 3.0, 80);
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
      color: 0x1a2130,
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
      color: 0x111320,
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

    // Starting values
    player.position.set(0, 0.1, 0); // rest on floor
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
    sprite.scale.set(3.8, 3.8, 1);
    return sprite;
  }

  function createRings() {
    rings.forEach(r => {
      if (r.mesh) scene.remove(r.mesh);
    });
    rings = [];

    const ringGeo = new THREE.TorusGeometry(3.2, 0.28, 8, 24);

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
      label.position.y = 4.8;
      ringGroup.add(label);
      
      ringGroup.position.copy(ringCoords[i]);
      scene.add(ringGroup);
      
      rings.push({
        mesh: ringGroup,
        material: ringMat,
        position: ringCoords[i].clone(),
        number: i + 1,
        passed: false
      });
    }
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

    // Reset flight variables
    currentSpeed = 0;
    yaw = Math.PI;
    pitch = 0;
    roll = 0;
    hoverHeight = 0.1;
    hoverVelocity = 0;
    targetHoverHeight = 0.1;

    // Hide screen overlays
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('game-clear-screen').classList.add('hidden');
    document.getElementById('hud-timer-box').classList.add('hidden');

    // Reset player position
    if (player) {
      player.position.set(0, 0.1, 0);
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

    if (pirateShip) {
      scene.remove(pirateShip);
      pirateShip = null;
    }
    pirateLasers.forEach(l => scene.remove(l));
    pirateLasers = [];
    pirateFireTimer = 0;

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

      // Distance check for collision
      const dist = player.position.distanceTo(activeRing.position);
      if (dist < 4.2) {
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

    // Ensure it doesn't go below floor level
    if (newPos.y < 5.0) newPos.y = 5.0;

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
        if (stageName) stageName.innerText = "FINAL STAGE: DRAGON DEFEATED";
      }
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

  function spawnPirateShip() {
    if (pirateShip) scene.remove(pirateShip);
    
    pirateShip = new THREE.Group();
    // Dark red mecha hull
    const hullGeo = new THREE.ConeGeometry(3, 9, 4);
    hullGeo.rotateX(Math.PI / 2);
    const hullMat = new THREE.MeshStandardMaterial({ color: 0x5a1818, metalness: 0.9, roughness: 0.2 });
    const body = new THREE.Mesh(hullGeo, hullMat);
    pirateShip.add(body);
    
    // Laser pointer line
    const laserPointerGeo = new THREE.CylinderGeometry(0.02, 0.02, 80, 4);
    laserPointerGeo.rotateX(Math.PI / 2);
    laserPointerGeo.translate(0, 0, -40); // pivot
    const laserPointerMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.15 });
    const pointer = new THREE.Mesh(laserPointerGeo, laserPointerMat);
    pointer.name = "pointer";
    pirateShip.add(pointer);

    // Thrusters
    const engineGeo = new THREE.CylinderGeometry(0.8, 0.8, 2, 8);
    engineGeo.rotateX(Math.PI / 2);
    const engineMat = new THREE.MeshStandardMaterial({ color: 0xff0033, emissive: 0xff0033, emissiveIntensity: 1.5 });
    const engLeft = new THREE.Mesh(engineGeo, engineMat);
    engLeft.position.set(-2, 0, 4.5);
    const engRight = engLeft.clone();
    engRight.position.x = 2;
    pirateShip.add(engLeft);
    pirateShip.add(engRight);

    scene.add(pirateShip);
    pirateShip.position.set(0, 25, -230);
    pirateFireTimer = 0;
  }

  function updatePirateShip(deltaTime) {
    if (gameStage !== 2) {
      if (pirateShip) {
        scene.remove(pirateShip);
        pirateShip = null;
      }
      pirateLasers.forEach(l => scene.remove(l));
      pirateLasers = [];
      return;
    }

    if (!pirateShip) {
      spawnPirateShip();
    }

    // Stationed hovering near active ring
    const time = clock.getElapsedTime();
    const activeRing = rings[currentRingIndex];
    if (activeRing) {
      const targetPos = activeRing.position.clone().add(new THREE.Vector3(
        Math.sin(time * 0.8) * 20,
        15 + Math.cos(time * 0.5) * 5,
        -40
      ));
      pirateShip.position.lerp(targetPos, 1.2 * deltaTime);
    }

    pirateShip.lookAt(player.position);

    // Laser fire cycle
    pirateFireTimer += deltaTime;
    const pointer = pirateShip.getObjectByName("pointer");
    
    // Scale tracking pointer
    if (pointer) {
      if (pirateFireTimer < 1.3) {
        pointer.visible = true;
        // Lock indicator targeting player
        pirateLockOnTarget.copy(player.position);
      } else {
        pointer.visible = false;
      }
    }

    if (pirateFireTimer >= 2.0) {
      pirateFireTimer = 0;

      // Fire actual red laser
      const laserGeo = new THREE.CylinderGeometry(0.18, 0.18, 6, 8);
      laserGeo.rotateX(Math.PI / 2);
      const laserMat = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
      const laser = new THREE.Mesh(laserGeo, laserMat);
      
      laser.position.copy(pirateShip.position);
      
      const dir = new THREE.Vector3().subVectors(pirateLockOnTarget, pirateShip.position).normalize();
      laser.lookAt(pirateLockOnTarget);
      laser.userData = {
        direction: dir,
        speed: 75.0,
        life: 3.2
      };

      scene.add(laser);
      pirateLasers.push(laser);
      showWarningBanner("ALERT: PIRATE LASER FIRED!");
    }

    // Update lasers
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

      // Collision check
      const dist = l.position.distanceTo(player.position);
      if (dist < 2.0) {
        takeDamage(5);
        spawnExplosion(l.position, 0xff3b30, 10, 0.3);
        scene.remove(l);
        l.geometry.dispose();
        l.material.dispose();
        pirateLasers.splice(i, 1);
      }
    }
  }

  function spawnDragon() {
    despawnDragon();

    dragon = new THREE.Group();

    // Dragon head mesh built from cones/boxes
    const headGeo = new THREE.ConeGeometry(3.5, 8, 4);
    headGeo.rotateX(Math.PI / 2);
    const headMat = new THREE.MeshStandardMaterial({ color: 0x081c15, metalness: 0.9, roughness: 0.25 });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    dragon.add(headMesh);

    // Glowing green eyes
    const eyeGeo = new THREE.SphereGeometry(0.5, 8, 8);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x00ff66, emissive: 0x00ff66, emissiveIntensity: 2.0 });
    const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
    eyeL.position.set(-1.6, 1.0, -2.5);
    const eyeR = eyeL.clone();
    eyeR.position.x = 1.6;
    dragon.add(eyeL);
    dragon.add(eyeR);

    scene.add(dragon);
    dragon.position.set(0, 32, 140);

    // Body segments (10 segments follows head)
    dragonSegments = [];
    let prevPos = dragon.position.clone();
    for (let i = 0; i < 10; i++) {
      const segGeo = new THREE.SphereGeometry(3.0 - i * 0.22, 8, 8);
      const segMat = new THREE.MeshStandardMaterial({
        color: 0x05130e,
        metalness: 0.9,
        roughness: 0.3,
        emissive: 0x00ff66,
        emissiveIntensity: 0.45 - (i * 0.045)
      });
      const segment = new THREE.Mesh(segGeo, segMat);
      segment.position.copy(prevPos).z += 4.0;
      scene.add(segment);
      dragonSegments.push(segment);
      prevPos = segment.position;
    }

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

    // Slithering central orbit pattern (X, Y, Z sine waves)
    const time = clock.getElapsedTime();
    const targetX = Math.sin(time * 0.65) * 32;
    const targetY = 26 + Math.cos(time * 0.45) * 12;
    const targetZ = 130 + Math.sin(time * 0.22) * 16;

    dragon.position.lerp(new THREE.Vector3(targetX, targetY, targetZ), 1.2 * deltaTime);
    dragon.lookAt(player.position);

    // Body segments follow lag
    let lead = dragon;
    for (let i = 0; i < dragonSegments.length; i++) {
      const seg = dragonSegments[i];
      const dir = new THREE.Vector3().subVectors(seg.position, lead.position).normalize();
      const targetPos = lead.position.clone().addScaledVector(dir, 3.8 - i * 0.08);
      seg.position.lerp(targetPos, 8.0 * deltaTime);
      seg.lookAt(lead.position);
      lead = seg;
    }

    // Swirl ring rotation inside active black hole
    if (blackHoleActive && blackHoleActive.group) {
      const swirl = blackHoleActive.group.getObjectByName("swirl");
      if (swirl) {
        swirl.rotation.z += 2.5 * deltaTime;
      }
    }

    // Dragon attacks
    dragonAttackTimer += deltaTime;
    if (dragonAttackTimer >= 4.0) {
      dragonAttackTimer = 0;
      const roll = Math.floor(Math.random() * 3) + 1;
      triggerDragonAttack(roll);
    }

    // 1) Update homing fireballs
    for (let i = dragonFireballs.length - 1; i >= 0; i--) {
      const f = dragonFireballs[i];
      
      // Homing tracking logic
      const targetDir = new THREE.Vector3().subVectors(player.position, f.position).normalize();
      f.userData.direction.lerp(targetDir, 2.5 * deltaTime).normalize();

      f.position.addScaledVector(f.userData.direction, f.userData.speed * deltaTime);
      f.userData.life -= deltaTime;

      const dist = f.position.distanceTo(player.position);
      if (dist < 2.2) {
        takeDamage(5);
        spawnExplosion(f.position, 0xff00ff, 15, 0.4);
        scene.remove(f);
        f.geometry.dispose();
        f.material.dispose();
        dragonFireballs.splice(i, 1);
        continue;
      }

      if (f.userData.life <= 0) {
        scene.remove(f);
        f.geometry.dispose();
        f.material.dispose();
        dragonFireballs.splice(i, 1);
      }
    }

    // 2) Update warning bombardment
    if (bombardmentActive) {
      bombardmentActive.timer -= deltaTime;
      const scale = 1.0 + Math.sin(time * 24) * 0.12;
      bombardmentActive.mesh.scale.set(scale, scale, scale);

      if (bombardmentActive.timer <= 0) {
        const center = bombardmentActive.center;
        spawnExplosion(center, 0xff4500, 30, 0.7);

        // Check range damage
        if (player.position.distanceTo(center) < 12.0) {
          takeDamage(5);
        }

        scene.remove(bombardmentActive.mesh);
        bombardmentActive.mesh.geometry.dispose();
        bombardmentActive.mesh.material.dispose();
        bombardmentActive = null;
      }
    }

    // 3) Update black hole gravitational pull
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
        player.position.addScaledVector(bounceDir, 12.0); // bounce back
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
      // Homing Dragon Breath
      const ballGeo = new THREE.SphereGeometry(1.5, 12, 12);
      const ballMat = new THREE.MeshBasicMaterial({ color: 0xff00ff });
      const fireball = new THREE.Mesh(ballGeo, ballMat);

      fireball.position.copy(dragon.position).add(new THREE.Vector3(0, 0, -3).applyQuaternion(dragon.quaternion));
      const dir = new THREE.Vector3().subVectors(player.position, fireball.position).normalize();
      
      fireball.userData = {
        direction: dir,
        speed: 18.0,
        life: 5.0
      };

      scene.add(fireball);
      dragonFireballs.push(fireball);
      showWarningBanner("BOSS ATTACK: HOMING BREATH!");
      
    } else if (patternId === 2) {
      // Orbital warning bombardment
      if (bombardmentActive) return;

      const center = player.position.clone();
      const warningGeo = new THREE.SphereGeometry(12, 16, 16);
      const warningMat = new THREE.MeshBasicMaterial({
        color: 0xff3b30,
        wireframe: true,
        transparent: true,
        opacity: 0.35
      });
      const warningMesh = new THREE.Mesh(warningGeo, warningMat);
      warningMesh.position.copy(center);

      scene.add(warningMesh);
      bombardmentActive = {
        mesh: warningMesh,
        center: center,
        timer: 2.0
      };
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
      const coreMat = new THREE.MeshBasicMaterial({ color: 0x06000d });
      const core = new THREE.Mesh(coreGeo, coreMat);
      bhGroup.add(core);

      const torusGeo = new THREE.TorusGeometry(4.0, 0.35, 8, 20);
      const torusMat = new THREE.MeshStandardMaterial({
        color: 0x7b00ff,
        emissive: 0x7b00ff,
        emissiveIntensity: 1.5,
        transparent: true,
        opacity: 0.8
      });
      const torus = new THREE.Mesh(torusGeo, torusMat);
      torus.name = "swirl";
      torus.rotateX(Math.PI / 2);
      bhGroup.add(torus);

      bhGroup.position.copy(center);
      scene.add(bhGroup);

      blackHoleActive = {
        group: bhGroup,
        center: center,
        timer: 5.0
      };
      showWarningBanner("WARNING: GRAVITY BLACK HOLE!");
    }
  }

  function despawnDragon() {
    if (dragon) {
      scene.remove(dragon);
      dragon = null;
    }
    dragonSegments.forEach(s => scene.remove(s));
    dragonSegments = [];
    dragonFireballs.forEach(f => scene.remove(f));
    dragonFireballs = [];
    
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
    
    hoverVelocity = THREE.MathUtils.clamp(hoverVelocity, -7.0, 7.0);
    hoverHeight += hoverVelocity * deltaTime;
    
    if (hoverHeight < 0.1) {
      hoverHeight = 0.1;
      hoverVelocity = 0;
      if (targetHoverHeight < 0.1) targetHoverHeight = 0.1;
    }

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
    
    // Only allow forward/backward movement if ship is hovering off the ground
    const flightAllowed = hoverHeight > 0.2;
    const speedMultiplier = flightAllowed ? 1.0 : 0.0;
    
    // Move ship
    player.position.addScaledVector(direction, currentSpeed * speedMultiplier * deltaTime);

    // Adjust targetHoverHeight dynamically to follow active flight climbing/diving when manually pitching
    const isMoving = isMovingForward || isMovingBackward || isBoosting;
    const isManuallyPitching = keys.ArrowUp || keys.ArrowDown;
    if (isMoving && isManuallyPitching) {
      targetHoverHeight = player.position.y;
    }

    // Apply altitude constraints
    if (player.position.y > hoverHeight) {
      const pullDownSpeed = keys[' '] ? 1.2 : 4.5;
      player.position.y = THREE.MathUtils.lerp(player.position.y, hoverHeight, pullDownSpeed * deltaTime);
    } else {
      player.position.y = THREE.MathUtils.lerp(player.position.y, hoverHeight, 8.0 * deltaTime);
    }

    if (player.position.y < 0.1) {
      player.position.y = 0.1;
      if (targetHoverHeight < 0.1) targetHoverHeight = 0.1;
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
      
      if (pirateShip) {
        scene.remove(pirateShip);
        pirateShip = null;
      }
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

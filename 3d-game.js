/* ==========================================================================
   🎮 Three.js 3D Cyberpunk Flight GameMode
   ========================================================================== */

(function() {
  let scene, camera, renderer, clock;
  let player = null; // This will hold our spaceship Group
  let controls = null;
  let animationFrameId = null;
  let isGameActive = false;

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
    scene.background = new THREE.Color(0x030305);
    scene.fog = new THREE.FogExp2(0x030305, 0.012);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2.5, 5.0);

    renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    clock = new THREE.Clock();

    // OrbitControls for camera (as fallback or editor mode)
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.08;
    controls.minDistance = 2.0;
    controls.maxDistance = 12.0;
    controls.enablePan = false; // Disable panning to keep target locked on ship
    controls.enabled = false;   // Turn off OrbitControls to use custom follow camera

    // Ambient light (Dark indigo tone)
    const ambientLight = new THREE.AmbientLight(0x0b0a1a, 0.6);
    scene.add(ambientLight);

    // Directional light (Cyber Moon)
    const dirLight = new THREE.DirectionalLight(0x403d75, 0.9);
    dirLight.position.set(40, 50, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // Neon Lights (Pink and Cyan) placed at specific points
    const pinkLight = new THREE.PointLight(0xff007f, 3.5, 45);
    pinkLight.position.set(-25, 8, -25);
    scene.add(pinkLight);

    const cyanLight = new THREE.PointLight(0x00f0ff, 3.5, 45);
    cyanLight.position.set(25, 8, 25);
    scene.add(cyanLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(300, 120, 0x00f0ff, 0xff007f);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // Dark standard ground plane
    const groundGeo = new THREE.PlaneGeometry(300, 300);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: 0x06060c, 
      roughness: 0.9, 
      metalness: 0.8 
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add neon block towers/obstacles
    createObstacles();

    // Create spaceships and thruster setup
    createSpaceship();

    // Hide loading screen immediately since spaceship is generated locally
    loadingOverlay.classList.add('fade-out');

    // Setup inputs and animation frame
    bindInput();
    animate();

    window.addEventListener('resize', onWindowResize);
  }

  function createSpaceship() {
    const shipGroup = new THREE.Group();

    // 1. Sleek metallic main fuselage (cone pointing forward)
    const bodyGeo = new THREE.ConeGeometry(0.5, 2.6, 8);
    bodyGeo.rotateX(Math.PI / 2); // align along Z-axis
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x1f2230,
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
      color: 0x141620,
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
      color: 0x2b2f3d,
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

  function createObstacles() {
    const obstacleGroup = new THREE.Group();
    const colors = [0xff007f, 0x00f0ff, 0x9d00ff, 0xffaa00];
    
    for (let i = 0; i < 40; i++) {
      const width = 3.0 + Math.random() * 6;
      const height = 4.0 + Math.random() * 18;
      const depth = 3.0 + Math.random() * 6;
      
      const geo = new THREE.BoxGeometry(width, height, depth);
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const mat = new THREE.MeshStandardMaterial({
        color: 0x060610,
        roughness: 0.15,
        metalness: 0.85,
        emissive: color,
        emissiveIntensity: 0.2
      });
      
      const mesh = new THREE.Mesh(geo, mat);
      
      let x, z;
      do {
        x = (Math.random() - 0.5) * 200;
        z = (Math.random() - 0.5) * 200;
      } while (Math.abs(x) < 12 && Math.abs(z) < 12); // avoid starting zone
      
      mesh.position.set(x, height / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      // Neon edges
      const wireGeo = new THREE.EdgesGeometry(geo);
      const wireMat = new THREE.LineBasicMaterial({ color: color, linewidth: 2 });
      const wire = new THREE.LineSegments(wireGeo, wireMat);
      mesh.add(wire);

      obstacleGroup.add(mesh);
    }
    
    scene.add(obstacleGroup);
  }

  function bindInput() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    
    // Custom camera look drag events
    gameCanvas.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    
    // Force focus
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

  function animate() {
    if (!isGameActive) return;
    
    animationFrameId = requestAnimationFrame(animate);

    const deltaTime = Math.min(clock.getDelta(), 0.1); // Clamp to avoid physics explosion

    // Update flight controls and physics
    updatePlayerPhysics(deltaTime);

    // Smooth over-the-shoulder follow camera locked behind the spaceship
    if (player) {
      if (controls) controls.enabled = false; // Bypass OrbitControls
      
      // Auto-center camera back behind the ship if the user isn't dragging
      if (!isDraggingMouse) {
        cameraYaw = THREE.MathUtils.lerp(cameraYaw, 0, 2.0 * deltaTime);
        cameraPitch = THREE.MathUtils.lerp(cameraPitch, 0.2, 2.0 * deltaTime);
      }
      
      // Calculate target camera position behind the ship
      const relativeCameraHolder = new THREE.Vector3(0, 2.0, 5.0); // 5 units behind, 2.0 units up
      
      const euler = new THREE.Euler(cameraPitch, cameraYaw, 0, 'YXZ');
      const quat = new THREE.Quaternion().setFromEuler(euler);
      
      // Combine ship quaternion and mouse look rotation
      const combinedRotation = player.quaternion.clone().multiply(quat);
      
      relativeCameraHolder.applyQuaternion(combinedRotation);
      relativeCameraHolder.add(player.position);
      
      // Lerp camera position for lag follow spring effect
      camera.position.lerp(relativeCameraHolder, 0.08);
      
      // Look at spaceship slightly above cockpit
      const lookAtPos = player.position.clone();
      lookAtPos.y += 0.8;
      camera.lookAt(lookAtPos);
    } else if (controls) {
      controls.enabled = true;
      controls.update();
    }

    // Render 3D Scene
    renderer.render(scene, camera);
  }

  function updatePlayerPhysics(deltaTime) {
    if (!player) return;

    // 1. Hover elevation (Spacebar) - Spring-Damper Physics
    if (keys[' ']) {
      targetHoverHeight += 5.0 * deltaTime; // climb continuously when holding Spacebar
    }
    
    const hoverStiffness = 5.0;
    const hoverDamping = 3.0;
    
    const hoverForce = hoverStiffness * (targetHoverHeight - hoverHeight) - hoverDamping * hoverVelocity;
    hoverVelocity += hoverForce * deltaTime;
    
    // Clamp vertical speed for safety
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
    const isBoosting = keys.Shift; // Shift alone can boost forward

    if (isBoosting) {
      targetSpeed = boostSpeed;
    } else if (isMovingForward) {
      targetSpeed = normalSpeed;
    } else if (isMovingBackward) {
      targetSpeed = reverseSpeed;
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

    // Interpolate rotations smoothly
    pitch = THREE.MathUtils.lerp(pitch, targetPitch, 4.0 * deltaTime);
    roll = THREE.MathUtils.lerp(roll, targetRoll, 5.0 * deltaTime);

    // Apply rotations
    player.rotation.set(0, 0, 0);
    player.rotation.y = yaw;
    player.rotateX(pitch);
    player.rotateZ(roll);

    // 4. Update Position
    // Ship moves in the direction it's pointing
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

    // Apply altitude constraints (pull down to hoverHeight, clamp to ground)
    if (player.position.y > hoverHeight) {
      // Pull down to current hoverHeight (faster if Space is not held, simulating gravity)
      const pullDownSpeed = keys[' '] ? 1.2 : 4.5;
      player.position.y = THREE.MathUtils.lerp(player.position.y, hoverHeight, pullDownSpeed * deltaTime);
    } else {
      // If below hoverHeight, push up to hoverHeight quickly
      player.position.y = THREE.MathUtils.lerp(player.position.y, hoverHeight, 8.0 * deltaTime);
    }

    if (player.position.y < 0.1) {
      player.position.y = 0.1;
      if (targetHoverHeight < 0.1) targetHoverHeight = 0.1;
    }

    // 5. Thruster scaling and colors (grows based on speed & boost)
    if (player.userData.leftThruster && player.userData.rightThruster) {
      const activeThrust = (isMovingForward || isBoosting) ? (isBoosting ? 2.5 : 1.4) : 0.4;
      const currentScaleZ = player.userData.leftThruster.scale.z;
      const nextScaleZ = THREE.MathUtils.lerp(currentScaleZ, activeThrust, 10.0 * deltaTime);
      
      player.userData.leftThruster.scale.set(1.0, 1.0, nextScaleZ);
      player.userData.rightThruster.scale.set(1.0, 1.0, nextScaleZ);
      
      // Cyan flame on Boost, Orange flame on normal speed
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

    // Deep clean-up Three.js memory to prevent leaks
    if (scene) {
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

    // Reset references
    player = null;
    clock = null;
    
    console.log("3D Flight GameMode components disposed and memory freed successfully.");
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

/* ==========================================================================
   🎮 Three.js 3D Cyberpunk GameMode
   ========================================================================== */

(function() {
  let scene, camera, renderer, clock;
  let player = null;
  let mixer = null;
  let animations = {};
  let currentAction = null;
  let controls = null;
  let animationFrameId = null;
  let isGameActive = false;

  // Rigged skeleton bones for procedural walking animation
  let bones = { leftLeg: null, rightLeg: null, leftArm: null, rightArm: null };

  // Key states
  const keys = { w: false, a: false, s: false, d: false, Shift: false, ' ': false };

  // Movement parameters
  const walkSpeed = 7.0;
  const runSpeed = 14.0;
  const gravity = 28.0;
  const jumpStrength = 12.0;
  let verticalVelocity = 0.0;
  let isJumping = false;

  // Rotation offset for the model (adjust if model is facing backwards)
  let rotationOffset = 0; 

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

  // Handle ESC key
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

    // Pause background video
    const bgVideo = document.querySelector('.hero-video-bg');
    if (bgVideo) bgVideo.pause();

    // Create scene, camera, renderer
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040406);
    scene.fog = new THREE.FogExp2(0x040406, 0.015);

    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 5, 10);

    renderer = new THREE.WebGLRenderer({ canvas: gameCanvas, antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    clock = new THREE.Clock();

    // OrbitControls for camera (locked 3rd person follow style)
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Don't go below ground
    controls.minDistance = 3.0;
    controls.maxDistance = 15;
    controls.enablePan = false; // Disable panning to replicate Unreal spring arm look

    // Ambient light (Dark purple / Cyberpunk vibe)
    const ambientLight = new THREE.AmbientLight(0x0e0d1f, 0.7);
    scene.add(ambientLight);

    // Directional light (Moonlight)
    const dirLight = new THREE.DirectionalLight(0x4b448f, 0.9);
    dirLight.position.set(30, 45, 10);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 150;
    const d = 40;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    scene.add(dirLight);

    // Neon Lights (Pink and Cyan) placed at specific points
    const pinkLight = new THREE.PointLight(0xff007f, 3, 40);
    pinkLight.position.set(-20, 6, -20);
    scene.add(pinkLight);

    const cyanLight = new THREE.PointLight(0x00f0ff, 3, 40);
    cyanLight.position.set(20, 6, 20);
    scene.add(cyanLight);

    // Grid Floor
    const gridHelper = new THREE.GridHelper(250, 100, 0x00ffff, 0xff00ff);
    gridHelper.position.y = -0.01;
    scene.add(gridHelper);

    // Invisible physics ground plane
    const groundGeo = new THREE.PlaneGeometry(250, 250);
    const groundMat = new THREE.MeshStandardMaterial({ 
      color: 0x070710, 
      roughness: 0.9, 
      metalness: 0.8 
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add neon obstacles
    createObstacles();

    // Show loading
    loadingOverlay.classList.remove('fade-out');
    loadingText.innerText = "캐릭터 데이터 분석 중...";

    // Attempt to load character from Base64 data (CORS-free for local file:/// executions)
    if (window.MIR_FBX_BASE64) {
      try {
        console.log("Loading character from embedded Base64 data...");
        const binaryString = atob(window.MIR_FBX_BASE64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const arrayBuffer = bytes.buffer;

        const loader = new THREE.FBXLoader();
        const fbx = loader.parse(arrayBuffer, 'assets/');
        
        setupPlayer(fbx);
        loadingOverlay.classList.add('fade-out');
        bindInput();
        animate();
      } catch (e) {
        console.error("Failed to parse embedded Base64 FBX, falling back to HTTP load:", e);
        loadCharacterViaHttp();
      }
    } else {
      console.log("No embedded Base64 data found. Falling back to HTTP load...");
      loadCharacterViaHttp();
    }

    function loadCharacterViaHttp() {
      loadingText.innerText = "Mir_Fix.fbx 로딩 중... (0%)";
      const loader = new THREE.FBXLoader();
      loader.load('assets/Mir_Fix.fbx', (fbx) => {
        setupPlayer(fbx);
        loadingOverlay.classList.add('fade-out');
        bindInput();
        animate();
      }, (xhr) => {
        if (xhr.total > 0) {
          const percent = Math.round((xhr.loaded / xhr.total) * 100);
          loadingText.innerText = `Mir_Fix.fbx 로딩 중... (${percent}%)`;
        } else {
          const kb = Math.round(xhr.loaded / 1024);
          loadingText.innerText = `Mir_Fix.fbx 로드 중... (${kb} KB)`;
        }
      }, (error) => {
        console.error("FBX HTTP loading error:", error);
        loadingText.innerText = "로딩 실패. 기본 캐릭터로 대체합니다.";
        
        createFallbackPlayer();
        loadingOverlay.classList.add('fade-out');
        bindInput();
        animate();
      });
    }

    function findBones(root) {
      bones = { leftLeg: null, rightLeg: null, leftArm: null, rightArm: null };
      root.traverse((child) => {
        if (child.isBone) {
          const name = child.name.toLowerCase();
          
          // Thigh/leg bone mapping
          if (name.includes('upperleg') || name.includes('thigh') || name.includes('upleg') || name.includes('leg_l') || name.includes('leg_r')) {
            if (name.includes('left') || name.includes('_l_') || name.endsWith('_l') || name.includes('l_upperleg') || name.includes('l_thigh')) {
              bones.leftLeg = child;
            } else if (name.includes('right') || name.includes('_r_') || name.endsWith('_r') || name.includes('r_upperleg') || name.includes('r_thigh')) {
              bones.rightLeg = child;
            }
          }
          
          // Upper arm bone mapping
          if (name.includes('upperarm') || name.includes('arm') || name.includes('shoulder')) {
            if (name.includes('left') || name.includes('_l_') || name.endsWith('_l') || name.includes('l_upperarm')) {
              bones.leftArm = child;
            } else if (name.includes('right') || name.includes('_r_') || name.endsWith('_r') || name.includes('r_upperarm')) {
              bones.rightArm = child;
            }
          }
        }
      });
      console.log("Procedural bones found:", bones);
    }

    function loadLocalTextures(root) {
      const textureLoader = new THREE.TextureLoader();
      const texturePaths = {
        hair: 'assets/hair.png',
        face: 'assets/face.png',
        body: 'assets/body.png',
        outfit: 'assets/outfit.png'
      };

      root.traverse((child) => {
        if (child.isMesh && child.material) {
          const name = child.name.toLowerCase();
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          
          mats.forEach((mat) => {
            let targetTexture = null;
            if (name.includes('hair')) targetTexture = texturePaths.hair;
            else if (name.includes('face') || name.includes('eye')) targetTexture = texturePaths.face;
            else if (name.includes('body') || name.includes('skin')) targetTexture = texturePaths.body;
            else if (name.includes('outfit') || name.includes('cloth') || name.includes('f00_000')) targetTexture = texturePaths.outfit;
            
            if (targetTexture) {
              textureLoader.load(targetTexture, (tex) => {
                tex.encoding = THREE.sRGBEncoding;
                tex.flipY = false;
                mat.map = tex;
                mat.color.setHex(0xffffff); // Reset color to white for texturing
                mat.needsUpdate = true;
                console.log("Successfully mapped local texture:", targetTexture);
              }, undefined, (err) => {
                // Ignore texture load failure (CORS/missing file)
              });
            }
          });
        }
      });
    }

    function setupPlayer(fbx) {
      player = fbx;
      
      // Auto-scale character to a realistic height
      const box = new THREE.Box3().setFromObject(player);
      const size = box.getSize(new THREE.Vector3());
      console.log("Original FBX Size:", size);
      
      const targetHeight = 2.0;
      const scaleFactor = targetHeight / size.y;
      player.scale.setScalar(scaleFactor);
      
      // Position on the ground
      player.position.set(0, 0, 0);
      player.rotation.set(0, Math.PI, 0); // Face forward (away from camera initially)
      
      // 1. Detect skeleton bones
      findBones(player);

      // 2. Traver and optimize materials
      player.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => optimizeMaterial(mat, child.name));
            } else {
              optimizeMaterial(child.material, child.name);
            }
          }
        }
      });

      // 3. Attempt to load textures from assets/ (if provided by user)
      loadLocalTextures(player);

      scene.add(player);

      // Check animations
      if (player.animations && player.animations.length > 0) {
        mixer = new THREE.AnimationMixer(player);
        console.log("Loaded animations:", player.animations.map(a => a.name));
        
        player.animations.forEach((clip) => {
          const clipName = clip.name.toLowerCase();
          const action = mixer.clipAction(clip);
          animations[clipName] = action;
          
          // Map tags
          if (clipName.includes('idle')) animations['idle'] = action;
          else if (clipName.includes('walk')) animations['walk'] = action;
          else if (clipName.includes('run')) animations['run'] = action;
          else if (clipName.includes('jump')) animations['jump'] = action;
        });

        // Set fallbacks
        if (!animations['idle']) {
          animations['idle'] = mixer.clipAction(player.animations[0]);
        }
        if (!animations['walk']) {
          animations['walk'] = animations['idle'];
        }
        
        // Start with Idle
        if (animations['idle']) {
          currentAction = animations['idle'];
          currentAction.play();
        }
      }
    }

    window.addEventListener('resize', onWindowResize);
  }

  function optimizeMaterial(material, meshName) {
    material.roughness = 0.4;
    material.metalness = 0.1;
    
    if (meshName) {
      const name = meshName.toLowerCase();
      
      // Procedural color mapping if texture map is missing
      if (!material.map) {
        if (name.includes('hair')) {
          material.color.setHex(0x18181c); // Black Hair
          material.roughness = 0.8;
          material.metalness = 0.0;
        } else if (name.includes('face') || name.includes('skin') || name.includes('body')) {
          material.color.setHex(0xffdbac); // Skin Tone
          material.roughness = 0.6;
          material.metalness = 0.0;
        } else if (name.includes('eye')) {
          material.color.setHex(0x39ff14); // Green Eyes
          if (material.emissive) material.emissive.setHex(0x113311);
        } else if (name.includes('leg') || name.includes('stocking') || name.includes('socks')) {
          material.color.setHex(0x39ff14); // Green Stockings
          material.roughness = 0.5;
        } else {
          material.color.setHex(0x18181c); // Dark Outfit
          material.roughness = 0.3;
          material.metalness = 0.7; // Metallic Cyber-suit look
        }
      }
    } else if (material.color) {
      material.color.multiplyScalar(1.2);
    }
  }

  function createFallbackPlayer() {
    const playerGroup = new THREE.Group();
    
    // Cyber-suit body
    const bodyGeo = new THREE.CylinderGeometry(0.3, 0.2, 1.5, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ 
      color: 0x00ffff, 
      emissive: 0x001a1a,
      roughness: 0.1,
      metalness: 0.9
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.75;
    body.castShadow = true;
    body.receiveShadow = true;
    playerGroup.add(body);

    // Glowing head helmet
    const headGeo = new THREE.SphereGeometry(0.24, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ 
      color: 0xff00ff,
      emissive: 0x220022,
      roughness: 0.1
    });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 1.7;
    head.castShadow = true;
    playerGroup.add(head);

    // Visor
    const visorGeo = new THREE.BoxGeometry(0.3, 0.08, 0.15);
    const visorMat = new THREE.MeshBasicMaterial({ color: 0xffff00 });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 1.7, 0.16);
    playerGroup.add(visor);

    player = playerGroup;
    scene.add(player);
    
    // For fallback cylinder, default rotation needs to point in direction of movement
    rotationOffset = 0;
  }

  function createObstacles() {
    const obstacleGroup = new THREE.Group();
    const colors = [0xff007f, 0x00f0ff, 0x9d00ff, 0xffaa00];
    
    // Populate 30 random neon blocks/columns
    for (let i = 0; i < 35; i++) {
      const width = 2.5 + Math.random() * 5;
      const height = 3.0 + Math.random() * 14;
      const depth = 2.5 + Math.random() * 5;
      
      const geo = new THREE.BoxGeometry(width, height, depth);
      const color = colors[Math.floor(Math.random() * colors.length)];
      
      const mat = new THREE.MeshStandardMaterial({
        color: 0x080814,
        roughness: 0.15,
        metalness: 0.85,
        emissive: color,
        emissiveIntensity: 0.2
      });
      
      const mesh = new THREE.Mesh(geo, mat);
      
      // Place randomly, avoiding the center start area
      let x, z;
      do {
        x = (Math.random() - 0.5) * 160;
        z = (Math.random() - 0.5) * 160;
      } while (Math.abs(x) < 10 && Math.abs(z) < 10);
      
      mesh.position.set(x, height / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      
      // Neon wireframe borders
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
  }

  function unbindInput() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
  }

  function onKeyDown(e) {
    if (e.key === 'w' || e.key === 'W') keys.w = true;
    if (e.key === 'a' || e.key === 'A') keys.a = true;
    if (e.key === 's' || e.key === 'S') keys.s = true;
    if (e.key === 'd' || e.key === 'D') keys.d = true;
    if (e.key === 'Shift') keys.Shift = true;
    
    if (e.key === ' ' && !isJumping) {
      keys[' '] = true;
      isJumping = true;
      verticalVelocity = jumpStrength;
      playAnimation('jump');
    }
  }

  function onKeyUp(e) {
    if (e.key === 'w' || e.key === 'W') keys.w = false;
    if (e.key === 'a' || e.key === 'A') keys.a = false;
    if (e.key === 's' || e.key === 'S') keys.s = false;
    if (e.key === 'd' || e.key === 'D') keys.d = false;
    if (e.key === 'Shift') keys.Shift = false;
    if (e.key === ' ') keys[' '] = false;
  }

  function playAnimation(name) {
    if (!mixer || !animations[name]) return false;
    
    const action = animations[name];
    if (currentAction === action) return true;
    
    action.reset();
    action.setEffectiveTimeScale(1);
    action.setEffectiveWeight(1);
    
    if (currentAction) {
      currentAction.crossFadeTo(action, 0.2, true);
    }
    action.play();
    currentAction = action;
    return true;
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

    // Update animations
    if (mixer) {
      mixer.update(deltaTime);
    }

    // Update controls and physics
    updatePlayerPhysics(deltaTime);

    // Orbit Follow Target Update (focuses slightly above player feet)
    if (player && controls) {
      controls.target.copy(player.position).y += 1.0;
      controls.update();
    }

    // Render 3D Scene
    renderer.render(scene, camera);
  }

  function updatePlayerPhysics(deltaTime) {
    if (!player) return;

    // Movement relative to camera's orientation
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
    right.y = 0;
    right.normalize();

    let moveDirection = new THREE.Vector3();
    if (keys.w) moveDirection.add(forward);
    if (keys.s) moveDirection.sub(forward);
    if (keys.a) moveDirection.sub(right);
    if (keys.d) moveDirection.add(right);

    const isMoving = moveDirection.lengthSq() > 0;
    const isRunning = keys.Shift && isMoving;

    if (isMoving) {
      moveDirection.normalize();
      const speed = isRunning ? runSpeed : walkSpeed;
      player.position.addScaledVector(moveDirection, speed * deltaTime);

      // Interpolate rotation to make player face moving direction smoothly
      const targetAngle = Math.atan2(moveDirection.x, moveDirection.z) + rotationOffset;
      let diff = targetAngle - player.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff)); // Clamp between -PI and PI
      player.rotation.y += diff * 10.0 * deltaTime;

      if (!isJumping) {
        if (isRunning) {
          // Play run animation, fallback to walk
          if (!playAnimation('run')) playAnimation('walk');
        } else {
          playAnimation('walk');
        }
      }
    } else {
      if (!isJumping) {
        playAnimation('idle');
      }
    }

    // Procedural bone skeletal swing (if FBX is in a static T-pose / has no walking animation clips)
    const hasProceduralBones = bones.leftLeg || bones.rightLeg || bones.leftArm || bones.rightArm;
    if (hasProceduralBones) {
      if (isMoving) {
        const time = clock.getElapsedTime() * (isRunning ? 14 : 9);
        const swing = Math.sin(time) * 0.45;
        
        if (bones.leftLeg) bones.leftLeg.rotation.x = swing;
        if (bones.rightLeg) bones.rightLeg.rotation.x = -swing;
        
        if (bones.leftArm) {
          bones.leftArm.rotation.x = -swing * 0.6;
          bones.leftArm.rotation.z = -1.2; // Relax arms down from T-pose
        }
        if (bones.rightArm) {
          bones.rightArm.rotation.x = swing * 0.6;
          bones.rightArm.rotation.z = 1.2; // Relax arms down from T-pose
        }
        
        // Procedural bounce
        if (!isJumping) {
          player.position.y = Math.abs(Math.sin(time * 2)) * 0.06;
        }
      } else {
        // Natural standing A-pose/idle (relax arms down, straighten legs)
        if (bones.leftLeg) bones.leftLeg.rotation.x = 0;
        if (bones.rightLeg) bones.rightLeg.rotation.x = 0;
        
        if (bones.leftArm) {
          bones.leftArm.rotation.x = 0;
          bones.leftArm.rotation.z = -1.2;
        }
        if (bones.rightArm) {
          bones.rightArm.rotation.x = 0;
          bones.rightArm.rotation.z = 1.2;
        }
        
        if (!isJumping) {
          player.position.y = 0;
        }
      }
    } else if (!mixer) {
      // Bobbing fallback if bones not detected
      if (isMoving && !isJumping) {
        player.position.y = Math.sin(clock.getElapsedTime() * (isRunning ? 14 : 9)) * 0.08;
      } else if (!isJumping) {
        player.position.y = 0;
      }
    }

    // Jump Physics
    if (isJumping) {
      verticalVelocity -= gravity * deltaTime;
      player.position.y += verticalVelocity * deltaTime;

      if (player.position.y <= 0) {
        player.position.y = 0;
        isJumping = false;
        verticalVelocity = 0;

        // Reset animation state
        if (isMoving) {
          if (isRunning) {
            if (!playAnimation('run')) playAnimation('walk');
          } else {
            playAnimation('walk');
          }
        } else {
          playAnimation('idle');
        }
      }
    }
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
    mixer = null;
    animations = {};
    currentAction = null;
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

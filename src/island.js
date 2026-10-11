import * as THREE from 'three';

/**
 * Hyper-Realistic Island & Ocean World
 * Features:
 * - Medium-sized organic island with golden-apricot beaches, central plateau, and gentle dunes
 * - Hyper-realistic ocean shader with dynamic Gerstner waves, animated shoreline surf foam,
 *   translucent turquoise shallows, and deep sapphire abyss
 * - Expanding energy circle / blue light shockwave that grows to infinity and reveals the island
 */

export class IslandWorld {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    // Expansion & Reveal State
    this.isRevealing = false;
    this.revealRadius = 4.8; // Starts at pedestal radius
    this.targetRevealRadius = 1200.0;
    this.revealSpeed = 0.0;
    this.isFullyRevealed = false;
    this.waveColor = new THREE.Color(0x00d2d3);

    // Meshes and materials
    this.islandMesh = null;
    this.islandMaterial = null;
    this.oceanMesh = null;
    this.oceanMaterial = null;
    this.skyMesh = null;
    this.skyMat = null;
    this.shockwaveRing = null;
    this.shockwaveWall = null;
    this.shockwaveLight = null;

    this.init();
  }

  init() {
    this.createSky();
    this.createIsland();
    this.createOcean();
    this.createExpandingRing();

    // Hidden initially until reveal is triggered
    this.group.visible = false;
  }

  createSky() {
    // 360-degree Sunset Sky Dome with real setting sun resting on the sea horizon
    const skyGeo = new THREE.SphereGeometry(2200, 48, 32);
    const sunDir = new THREE.Vector3(-0.58, 0.002, -0.81).normalize();

    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uSunDir: { value: sunDir }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uSunDir;
        varying vec3 vWorldPos;

        void main() {
          vec3 dir = normalize(vWorldPos);
          float y = dir.y;

          // Pure Sunset Sky Gradient:
          // Deep evening indigo zenith
          vec3 zenith = vec3(0.10, 0.08, 0.22);
          // Twilight purple-rose
          vec3 upper = vec3(0.40, 0.16, 0.30);
          // Mid sky: warm sunset coral
          vec3 midSky = vec3(0.82, 0.34, 0.18);
          // Lower sky approaching sea horizon: warm sunset orange
          vec3 horizonOrange = vec3(1.0, 0.52, 0.20);
          // Distant ocean below horizon (matches deep ocean dark navy)
          vec3 oceanBelow = vec3(0.04, 0.14, 0.25);

          vec3 col;
          if (y >= 0.0) {
            col = mix(horizonOrange, midSky, smoothstep(0.0, 0.15, y));
            col = mix(col, upper, smoothstep(0.15, 0.44, y));
            col = mix(col, zenith, smoothstep(0.44, 0.95, y));
          } else {
            // Below horizon: smooth match to distant ocean surface
            col = mix(horizonOrange, oceanBelow, clamp(-y * 24.0, 0.0, 1.0));
          }

          // True Euclidean angular distance to sun center
          float sunDist = length(dir - uSunDir);

          // Setting sun geometry:
          // The sun center sits right on the ocean horizon line (uSunDir.y ≈ 0.002).
          // Above y = 0.0: clean, pure circular dome (half-circle ball).
          // Below y = 0.0: cleanly cut off by the sea horizon line.
          // Strictly NO horizontal clouds, NO base platform, NO hat brim!
          float isAboveHorizon = step(0.0, y);
          
          // 1. Radially symmetric gentle glow (strictly clipped at waterline)
          float sunHalo = exp(-sunDist * 36.0) * 0.28 * isAboveHorizon;
          col += vec3(1.0, 0.44, 0.12) * sunHalo;

          // 2. Pure circle/ball setting sun disk, bisected by the horizon into half circle
          float sunRadius = 0.026;
          float sunDisk = smoothstep(sunRadius, sunRadius - 0.0012, sunDist) * isAboveHorizon;
          vec3 solidSun = vec3(1.0, 0.46, 0.12) * 2.2;
          col = mix(col, solidSun, sunDisk);

          gl_FragColor = vec4(col, 1.0);
        }
      `
    });

    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
    this.group.add(this.skyMesh);
  }

  // Coastline radius function (same in JS and GLSL) - much bigger expansive island
  static getCoastRadius(angle) {
    return 88.0 
      + 18.0 * Math.sin(angle * 2.0 - 0.4) 
      + 12.0 * Math.cos(angle * 3.0 + 1.1) 
      + 8.0 * Math.sin(angle * 5.0 - 0.7) 
      + 4.0 * Math.cos(angle * 7.0 + 2.3);
  }

  // Terrain height calculation for smooth, natural island contours
  static getIslandHeight(x, z) {
    const d = Math.hypot(x, z);
    const angle = Math.atan2(z, x);
    const rCoast = IslandWorld.getCoastRadius(angle);

    // Center plateau (where buggy, bench, lamp, trees sit at y = 0.55): radius 5.2m
    if (d <= 5.2) {
      return 0.55;
    }

    // Inside island landmass (between 5.2m and coastline)
    if (d <= rCoast) {
      const t = (d - 5.2) / (rCoast - 5.2);
      // Gentle slope from 0.55 down to 0.20 (waterline is 0.18)
      const baseH = 0.55 * (1.0 - Math.pow(t, 1.25)) + 0.20 * Math.pow(t, 1.25);
      // Natural dunes and terrain undulation across the big island
      const dune = (Math.sin(x * 0.055) * Math.cos(z * 0.055) * 0.32 
                  + Math.sin(x * 0.12 + z * 0.09) * 0.16 
                  + Math.sin(x * 0.22 - z * 0.16) * 0.08) * (1.0 - t);
      return Math.max(0.19, baseH + dune);
    }

    // Underwater shelf sloping gently down below the sea surface
    const distPast = d - rCoast;
    return Math.max(-5.5, 0.19 - Math.pow(distPast * 0.22, 1.25));
  }

  createIsland() {
    // High-resolution grid plane for island terrain (260m x 260m, 220 segments)
    const size = 260;
    const segments = 220;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2); // Orient horizontally (XZ plane)

    const pos = geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const y = IslandWorld.getIslandHeight(x, z);
      pos.setY(i, y);
    }
    geometry.computeVertexNormals();

    // Procedural multi-scale sand texture
    const sandCanvas = document.createElement('canvas');
    sandCanvas.width = 512;
    sandCanvas.height = 512;
    const sctx = sandCanvas.getContext('2d');
    sctx.fillStyle = '#f09658'; // Warm peach-apricot tone matching reference screenshot
    sctx.fillRect(0, 0, 512, 512);

    // Add fine sand grain noise
    const imgData = sctx.getImageData(0, 0, 512, 512);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 20;
      data[i] = Math.min(255, Math.max(0, data[i] + n));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + n * 0.85));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + n * 0.7));
    }
    sctx.putImageData(imgData, 0, 0);

    const sandTexture = new THREE.CanvasTexture(sandCanvas);
    sandTexture.wrapS = THREE.RepeatWrapping;
    sandTexture.wrapT = THREE.RepeatWrapping;
    sandTexture.repeat.set(12, 12);

    // Hyper-realistic custom shader material for island sand with natural sunset lighting
    this.islandMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uSandMap: { value: sandTexture },
        uRevealRadius: { value: this.revealRadius },
        uWaveColor: { value: this.waveColor },
        uTime: { value: 0.0 },
        uSunDir: { value: new THREE.Vector3(-0.58, 0.002, -0.81).normalize() }
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform sampler2D uSandMap;
        uniform float uRevealRadius;
        uniform vec3 uWaveColor;
        uniform float uTime;
        uniform vec3 uSunDir;

        varying vec3 vWorldPos;
        varying vec3 vNormal;
        varying vec2 vUv;

        // Coastline equation matching JS (much bigger island)
        float getCoastRadius(float angle) {
          return 88.0 
            + 18.0 * sin(angle * 2.0 - 0.4) 
            + 12.0 * cos(angle * 3.0 + 1.1) 
            + 8.0 * sin(angle * 5.0 - 0.7) 
            + 4.0 * cos(angle * 7.0 + 2.3);
        }

        void main() {
          float dist = length(vWorldPos.xz);

          // Reveal clipping: hide parts before the expanding circle reaches them
          if (dist > uRevealRadius) {
            discard;
          }

          float angle = atan(vWorldPos.z, vWorldPos.x);
          float rCoast = getCoastRadius(angle);

          // Don't render deep seabed terrain if it is beyond the coastline shelf
          if (dist > rCoast + 18.0) {
            discard;
          }

          // Sample micro sand texture (tiled across large island)
          vec4 sandSample = texture2D(uSandMap, vUv * 24.0);

          // Base sand colors matching the reference screenshot:
          // Dry sand: rich apricot-peach ground tone
          vec3 drySandColor = vec3(0.96, 0.60, 0.35) * sandSample.rgb;
          // Wet sand near waterline (darker amber-terracotta)
          vec3 wetSandColor = vec3(0.72, 0.40, 0.22) * sandSample.rgb;

          // Water level is at y = 0.18
          float wetness = smoothstep(0.38, 0.19, vWorldPos.y);
          vec3 albedo = mix(drySandColor, wetSandColor, wetness);

          // Natural sunset lighting:
          // 1. Deep stylized purple shadow ambient from the screenshot
          vec3 ambient = vec3(0.24, 0.14, 0.28);

          // 2. Sunset directional sunlight: rich orangish shade matching user request
          float nDotL = max(0.0, dot(vNormal, uSunDir));
          vec3 sunsetLightColor = vec3(1.0, 0.50, 0.16); // Rich orangish sunset shade
          vec3 diffuse = sunsetLightColor * nDotL * 1.5;

          // 3. Wet sand specular reflection (glossy sheen near waterline)
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          vec3 halfVector = normalize(uSunDir + viewDir);
          float specPower = mix(12.0, 75.0, wetness);
          float specIntensity = mix(0.04, 0.65, wetness);
          float specular = pow(max(0.0, dot(vNormal, halfVector)), specPower) * specIntensity;

          vec3 finalColor = albedo * (ambient + diffuse) + vec3(1.0, 0.75, 0.45) * specular;

          // Glowing energy pulse at the expanding circle boundary
          float edgeDist = abs(dist - uRevealRadius);
          if (edgeDist < 2.2) {
            float edgeGlow = (1.0 - edgeDist / 2.2);
            edgeGlow = pow(edgeGlow, 2.0);
            finalColor += uWaveColor * edgeGlow * 3.2;
          }

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    });

    this.islandMesh = new THREE.Mesh(geometry, this.islandMaterial);
    this.islandMesh.receiveShadow = true;
    this.islandMesh.castShadow = true;
    this.group.add(this.islandMesh);
  }

  createOcean() {
    // Vast expansive ocean plane (2400m x 2400m, 180 segments) at water level y = 0.18
    const size = 2400;
    const segments = 180;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    // Hyper-realistic ocean shader matching user's reference screenshot:
    // - Shallow near shore: luminous, crystal light blue / cyan
    // - Smooth gradual change in shade through clear tropical teal to deep dark blue
    // - Delicate white shore surf foam lines along sand contact
    // - Floating sakura blossom petals scattered on water surface
    // - Clean, crisp specular glints without muddy orange wash
    this.oceanMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true,
      uniforms: {
        uRevealRadius: { value: this.revealRadius },
        uWaveColor: { value: this.waveColor },
        uTime: { value: 0.0 },
        uSunDir: { value: new THREE.Vector3(-0.58, 0.002, -0.81).normalize() }
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorldPos;
        varying vec3 vWaveNormal;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);

          // Gentle Gerstner wave displacement for natural ocean swells
          float w1 = sin(worldPos.x * 0.08 + uTime * 1.5) * 0.06;
          float w2 = cos(worldPos.z * 0.12 + uTime * 1.8) * 0.04;
          float w3 = sin((worldPos.x + worldPos.z) * 0.18 + uTime * 2.2) * 0.025;

          worldPos.y = 0.18 + (w1 + w2 + w3);
          vWorldPos = worldPos.xyz;

          // Wave surface normal perturbation
          float dHdx = 0.08 * 0.06 * cos(worldPos.x * 0.08 + uTime * 1.5) 
                     + 0.18 * 0.025 * cos((worldPos.x + worldPos.z) * 0.18 + uTime * 2.2);
          float dHdz = -0.12 * 0.04 * sin(worldPos.z * 0.12 + uTime * 1.8) 
                     + 0.18 * 0.025 * cos((worldPos.x + worldPos.z) * 0.18 + uTime * 2.2);
          vWaveNormal = normalize(vec3(-dHdx, 1.0, -dHdz));

          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uRevealRadius;
        uniform vec3 uWaveColor;
        uniform float uTime;
        uniform vec3 uSunDir;

        varying vec3 vWorldPos;
        varying vec3 vWaveNormal;
        varying vec2 vUv;

        // Coastline equation matching JS (expansive organic island)
        float getCoastRadius(float angle) {
          return 88.0 
            + 18.0 * sin(angle * 2.0 - 0.4) 
            + 12.0 * cos(angle * 3.0 + 1.1) 
            + 8.0 * sin(angle * 5.0 - 0.7) 
            + 4.0 * cos(angle * 7.0 + 2.3);
        }

        void main() {
          float dist = length(vWorldPos.xz);

          // Reveal clipping: hide sea beyond expanding circle (fully revealed when radius > 1100)
          if (uRevealRadius < 1100.0 && dist > uRevealRadius) {
            discard;
          }

          float angle = atan(vWorldPos.z, vWorldPos.x);
          float rCoast = getCoastRadius(angle);
          float distToCoast = dist - rCoast;

          // Don't render sea over dry island center
          if (distToCoast < -1.0) {
            discard;
          }

          // Exact water shades from user reference screenshot:
          // 1. Shallow near shore: luminous light blue / aqua cyan (#2cd5c4 / #2ec9c3)
          vec3 shallowLightBlue = vec3(0.18, 0.85, 0.82);
          // 2. Intermediate depth: clear tropical teal-blue (#1a85a6)
          vec3 midTealBlue      = vec3(0.10, 0.54, 0.66);
          // 3. Deeper water: rich oceanic dark blue (#10385c)
          vec3 deepDarkBlue     = vec3(0.06, 0.22, 0.36);
          // 4. Abyss / open ocean horizon: deep navy blue (#0a2440)
          vec3 oceanAbyss       = vec3(0.04, 0.14, 0.25);

          // Smooth gradual change in shade from shallow light blue to deep dark blue
          float depthFactor = clamp(distToCoast / 45.0, 0.0, 1.0);
          float t1 = smoothstep(0.0, 0.28, depthFactor);
          float t2 = smoothstep(0.22, 0.82, depthFactor);
          float t3 = smoothstep(0.70, 1.00, depthFactor);

          vec3 waterBase = mix(shallowLightBlue, midTealBlue, t1);
          waterBase = mix(waterBase, deepDarkBlue, t2);
          waterBase = mix(waterBase, oceanAbyss, t3);

          // Animated Shoreline Foam Waves (Surf Lines along the beach)
          float foam = 0.0;
          if (distToCoast >= -1.0 && distToCoast <= 7.0) {
            // Delicate white contact line directly against the sand
            float rim = smoothstep(0.7, -0.3, distToCoast);
            // Wave 1 rolling onto shore
            float surf1 = smoothstep(0.52, 0.98, sin(distToCoast * 3.2 - uTime * 2.2)) 
                        * smoothstep(6.5, 0.3, distToCoast);
            // Wave 2 secondary ripple
            float surf2 = smoothstep(0.65, 0.98, sin(distToCoast * 4.8 - uTime * 2.8 + sin(angle * 12.0) * 1.2)) 
                        * smoothstep(4.5, 0.0, distToCoast);

            foam = clamp(rim * 0.92 + surf1 * 0.72 + surf2 * 0.50, 0.0, 1.0);
          }

          // Floating sakura blossom petals scattered on water (as seen in screenshot)
          vec2 petalCoord = vWorldPos.xz * 1.6;
          vec2 cellId = floor(petalCoord);
          vec2 cellFract = fract(petalCoord) - 0.5;
          float petalHash = fract(sin(dot(cellId, vec2(127.1, 311.7))) * 43758.5453);
          float hasPetal = step(0.86, petalHash) * step(0.4, distToCoast) * step(distToCoast, 34.0);
          float petalDist = abs(cellFract.x) + abs(cellFract.y);
          float petalMask = step(petalDist, 0.15) * hasPetal;
          vec3 petalColor = mix(vec3(0.92, 0.30, 0.20), vec3(0.98, 0.48, 0.26), petalHash);

          // Clean lighting & subtle wave shading (preserving pure blue colors)
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          vec3 normal = normalize(vWaveNormal);

          // Subtle wave slope shading for 3D depth
          float waveShade = dot(normal, vec3(0.0, 1.0, 0.0));
          vec3 finalColor = waterBase * (0.86 + 0.14 * waveShade);

          // Very subtle soft sky reflection at grazing angles (cool tone, no orange wash)
          float fresnel = pow(1.0 - max(0.0, dot(viewDir, normal)), 4.5);
          vec3 skyCoolTone = vec3(0.20, 0.50, 0.70);
          finalColor = mix(finalColor, skyCoolTone, fresnel * 0.18);

          // Crisp localized specular glint (tight, never a flat hat-brim wash)
          vec3 halfVec = normalize(uSunDir + viewDir);
          float nDotH = max(0.0, dot(normal, halfVec));
          float sunGlint = pow(nDotH, 120.0) * 0.75;
          finalColor += vec3(1.0, 0.85, 0.60) * sunGlint;

          // Blend white surf foam onto the water surface
          vec3 whiteFoam = vec3(0.98, 0.99, 1.0);
          finalColor = mix(finalColor, whiteFoam, foam * 0.92);

          // Blend floating sakura petals on top of water
          finalColor = mix(finalColor, petalColor, petalMask * 0.96);

          // Opacity: slightly translucent at shore edge, solid deeper out
          float alpha = clamp(0.86 + depthFactor * 0.14 + foam * 0.12, 0.0, 0.98);

          // Glowing energy pulse at the expanding circle boundary
          if (uRevealRadius < 1100.0) {
            float edgeDist = abs(dist - uRevealRadius);
            if (edgeDist < 2.4) {
              float edgeGlow = (1.0 - edgeDist / 2.4);
              edgeGlow = pow(edgeGlow, 2.0);
              finalColor += uWaveColor * edgeGlow * 3.5;
              alpha = 1.0;
            }
          }

          gl_FragColor = vec4(finalColor, alpha);
        }
      `
    });

    this.oceanMesh = new THREE.Mesh(geometry, this.oceanMaterial);
    this.oceanMesh.position.y = 0.0;
    this.group.add(this.oceanMesh);
  }

  createExpandingRing() {
    this.shockwaveGroup = new THREE.Group();

    // 1. Torus ring (thick glowing neon circle)
    const ringGeo = new THREE.TorusGeometry(4.8, 0.16, 16, 96);
    this.ringMat = new THREE.MeshBasicMaterial({
      color: 0x00d2d3,
      transparent: true,
      opacity: 0.95
    });
    this.shockwaveRing = new THREE.Mesh(ringGeo, this.ringMat);
    this.shockwaveRing.rotation.x = Math.PI / 2;
    this.shockwaveRing.position.y = 0.58;
    this.shockwaveGroup.add(this.shockwaveRing);

    // 2. Vertical energy ribbon / light cylinder
    const wallGeo = new THREE.CylinderGeometry(4.8, 4.8, 1.8, 96, 1, true);
    this.wallMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uColor: { value: this.waveColor },
        uOpacity: { value: 0.0 }
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        varying vec2 vUv;
        void main() {
          // Soft vertical fade on the cylindrical energy beam
          float verticalFade = sin(vUv.y * 3.14159);
          float alpha = verticalFade * uOpacity;
          gl_FragColor = vec4(uColor * 1.5, alpha);
        }
      `
    });
    this.shockwaveWall = new THREE.Mesh(wallGeo, this.wallMat);
    this.shockwaveWall.position.y = 0.9;
    this.shockwaveGroup.add(this.shockwaveWall);

    // 3. Dynamic expanding point light to cast ambient light during the transition
    this.shockwaveLight = new THREE.PointLight(0x00d2d3, 1.5, 25, 1.5);
    this.shockwaveLight.position.set(0, 1.5, 0);
    this.shockwaveGroup.add(this.shockwaveLight);

    this.shockwaveGroup.visible = true;
    this.group.add(this.shockwaveGroup);
  }

  // Set the glowing ring and shockwave color (matches selected car paint)
  setWaveColor(colorHex) {
    this.waveColor.setHex(colorHex);
    if (this.ringMat) {
      this.ringMat.color.setHex(colorHex);
    }
    if (this.wallMat) {
      this.wallMat.uniforms.uColor.value.setHex(colorHex);
    }
    if (this.shockwaveLight) {
      this.shockwaveLight.color.setHex(colorHex);
    }
    if (this.islandMaterial) {
      this.islandMaterial.uniforms.uWaveColor.value.setHex(colorHex);
    }
    if (this.oceanMaterial) {
      this.oceanMaterial.uniforms.uWaveColor.value.setHex(colorHex);
    }
  }

  // Trigger the expansion of the blue light outwards to infinity
  triggerReveal(colorHex) {
    if (this.isRevealing || this.isFullyRevealed) return;

    if (colorHex !== undefined) {
      this.setWaveColor(colorHex);
    }

    this.group.visible = true;
    this.shockwaveGroup.visible = true;
    if (this.wallMat) {
      this.wallMat.uniforms.uOpacity.value = 0.75;
    }
    if (this.shockwaveLight) {
      this.shockwaveLight.intensity = 3.5;
    }
    this.isRevealing = true;
    this.revealRadius = 4.8;
    this.revealSpeed = 6.0; // initial burst speed (m/s)
  }

  update(time, delta) {
    // 1. Update shader time uniforms for waves and sand effects
    if (this.islandMaterial) {
      this.islandMaterial.uniforms.uTime.value = time;
      this.islandMaterial.uniforms.uRevealRadius.value = this.revealRadius;
    }
    if (this.oceanMaterial) {
      this.oceanMaterial.uniforms.uTime.value = time;
      this.oceanMaterial.uniforms.uRevealRadius.value = this.revealRadius;
    }

    // 2. Animate expanding circle
    if (this.isRevealing && !this.isFullyRevealed) {
      // Accelerate outwards smoothly towards infinity
      this.revealSpeed += delta * 55.0;
      this.revealRadius += this.revealSpeed * delta;

      // Update shockwave ring geometry scale
      const scale = this.revealRadius / 4.8;
      this.shockwaveRing.scale.set(scale, scale, 1);
      this.shockwaveWall.scale.set(scale, 1, scale);

      // Fade out shockwave light and wall as it expands far out
      if (this.revealRadius > 110.0) {
        const fade = Math.max(0, 1.0 - (this.revealRadius - 110.0) / 220.0);
        this.ringMat.opacity = fade * 0.95;
        this.wallMat.uniforms.uOpacity.value = fade * 0.75;
        this.shockwaveLight.intensity = fade * 3.5;
      }

      // Completed reveal
      if (this.revealRadius >= this.targetRevealRadius) {
        this.isFullyRevealed = true;
        this.shockwaveGroup.visible = false;
      }
    }
  }
}

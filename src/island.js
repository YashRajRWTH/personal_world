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
    this.targetRevealRadius = 450.0;
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
    // 360-degree Sunset Sky Dome with real sunset resting on the distant sea horizon
    const skyGeo = new THREE.SphereGeometry(1100, 48, 32);
    const sunDir = new THREE.Vector3(-0.58, 0.075, -0.81).normalize();

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

          // Realistic Ocean Sunset Sky Gradient:
          // Deep evening indigo zenith
          vec3 zenith = vec3(0.08, 0.07, 0.17);
          // Twilight purple-rose
          vec3 upper = vec3(0.38, 0.15, 0.28);
          // Mid sky: warm sunset coral
          vec3 midSky = vec3(0.82, 0.32, 0.18);
          // Above sea horizon: fiery sunset orange-amber
          vec3 horizonOrange = vec3(1.0, 0.52, 0.20);
          // Sea waterline: glowing golden sunset haze
          vec3 seaHorizon = vec3(1.0, 0.64, 0.28);

          vec3 col = seaHorizon;
          if (y > 0.0) {
            col = mix(seaHorizon, horizonOrange, smoothstep(0.0, 0.05, y));
            col = mix(col, midSky, smoothstep(0.05, 0.16, y));
            col = mix(col, upper, smoothstep(0.16, 0.44, y));
            col = mix(col, zenith, smoothstep(0.44, 1.0, y));
          } else {
            // Distant ocean surface below horizon
            col = mix(seaHorizon, vec3(0.30, 0.14, 0.10), clamp(-y * 3.5, 0.0, 1.0));
          }

          // Soft atmospheric sunset clouds resting just above the distant ocean horizon
          float cloud1 = sin(dir.x * 8.0 + dir.z * 5.0) * cos(y * 55.0);
          float cloud2 = sin(dir.z * 12.0 - dir.x * 9.0) * cos(y * 80.0);
          float clouds = smoothstep(0.40, 0.95, cloud1 * 0.55 + cloud2 * 0.45) * smoothstep(0.22, 0.02, abs(y - 0.04));
          col = mix(col, vec3(0.88, 0.36, 0.15), clouds * 0.45);

          // Sunset Sun far away in the distant sea (compact, small size & deep sunset orange)
          float sunDot = max(0.0, dot(dir, uSunDir));
          
          // 1. Subtle, tight atmospheric halo around the distant sun
          col += vec3(1.0, 0.35, 0.08) * pow(sunDot, 55.0) * 0.45;
          // 2. Warm orange corona hugging the distant sun
          col += vec3(1.0, 0.45, 0.10) * pow(sunDot, 350.0) * 0.85;
          
          // 3. Compact distant sun disk (small and far away on the sea horizon)
          float sunDisk = smoothstep(0.99986, 0.99995, sunDot);
          // Deep rich sunset orange color
          vec3 sunDiskColor = vec3(1.0, 0.36, 0.05);
          float sunCore = smoothstep(0.99996, 0.99999, sunDot);
          vec3 sunFinal = mix(sunDiskColor * 1.5, vec3(1.0, 0.58, 0.15) * 1.6, sunCore);
          col = mix(col, sunFinal, sunDisk);

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
        uSunDir: { value: new THREE.Vector3(-0.58, 0.075, -0.81).normalize() }
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
    // Vast ocean surface plane (800m x 800m, 200 segments) at water level y = 0.18
    const size = 800;
    const segments = 200;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    // Hyper-realistic ocean shader with warm sunset reflections
    this.oceanMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: true,
      uniforms: {
        uRevealRadius: { value: this.revealRadius },
        uWaveColor: { value: this.waveColor },
        uTime: { value: 0.0 },
        uSunDir: { value: new THREE.Vector3(-0.58, 0.075, -0.81).normalize() }
      },
      vertexShader: `
        uniform float uTime;
        varying vec3 vWorldPos;
        varying vec3 vWaveNormal;
        varying vec2 vUv;

        void main() {
          vUv = uv;
          vec4 worldPos = modelMatrix * vec4(position, 1.0);

          // Gerstner wave displacement for natural ocean swells
          float w1 = sin(worldPos.x * 0.10 + uTime * 1.5) * 0.07;
          float w2 = cos(worldPos.z * 0.14 + uTime * 1.8) * 0.05;
          float w3 = sin((worldPos.x + worldPos.z) * 0.22 + uTime * 2.2) * 0.03;

          worldPos.y = 0.18 + (w1 + w2 + w3);
          vWorldPos = worldPos.xyz;

          // Wave surface normal perturbation
          float dHdx = 0.10 * 0.07 * cos(worldPos.x * 0.10 + uTime * 1.5) 
                     + 0.22 * 0.03 * cos((worldPos.x + worldPos.z) * 0.22 + uTime * 2.2);
          float dHdz = -0.14 * 0.05 * sin(worldPos.z * 0.14 + uTime * 1.8) 
                     + 0.22 * 0.03 * cos((worldPos.x + worldPos.z) * 0.22 + uTime * 2.2);
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

          // Reveal clipping: hide sea beyond expanding circle
          if (dist > uRevealRadius) {
            discard;
          }

          float angle = atan(vWorldPos.z, vWorldPos.x);
          float rCoast = getCoastRadius(angle);
          float distToCoast = dist - rCoast;

          // Don't render sea over dry island center
          if (distToCoast < -1.0) {
            discard;
          }

          // Sea Color Gradient (matching reference screenshot)
          // 1. Crystal translucent shallow turquoise near the beach
          vec3 shallowTurquoise = vec3(0.08, 0.88, 0.82);
          // 2. Vibrant tropical cyan/azure at mid-depth
          vec3 midCyan = vec3(0.04, 0.58, 0.72);
          // 3. Deep sapphire ocean in open waters
          vec3 deepNavy = vec3(0.05, 0.22, 0.42);

          float depthT = clamp((distToCoast + 1.0) / 36.0, 0.0, 1.0);
          vec3 waterBase = mix(shallowTurquoise, midCyan, smoothstep(0.0, 0.4, depthT));
          waterBase = mix(waterBase, deepNavy, smoothstep(0.4, 1.0, depthT));

          // Animated Shoreline Foam Waves (Surf Lines along the beach)
          float foam = 0.0;
          if (distToCoast >= -1.2 && distToCoast <= 7.5) {
            // Wave 1 rolling to shore
            float surfPhase1 = distToCoast * 3.0 - uTime * 2.4;
            float surf1 = sin(surfPhase1);
            surf1 = smoothstep(0.35, 0.98, surf1) * smoothstep(7.0, 0.5, distToCoast);

            // Wave 2 secondary ripple
            float surfPhase2 = distToCoast * 4.8 - uTime * 3.0 + sin(angle * 14.0) * 1.5;
            float surf2 = sin(surfPhase2);
            surf2 = smoothstep(0.55, 0.98, surf2) * smoothstep(5.0, 0.0, distToCoast);

            // Shore contact line (gentle white lapping rim directly against sand)
            float rim = smoothstep(1.0, -0.4, distToCoast);

            foam = clamp(surf1 * 0.85 + surf2 * 0.6 + rim * 0.95, 0.0, 1.0);
          }

          // Lighting, Specular & Fresnel with warm sunset reflections
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          vec3 normal = normalize(vWaveNormal);

          // Fresnel reflection (water reflects warm sunset sky at grazing angles)
          float fresnel = pow(1.0 - max(0.0, dot(viewDir, normal)), 3.8);
          vec3 skyReflectColor = vec3(0.96, 0.48, 0.24); // Warm sunset golden-coral reflection!

          // Sun specular glint sparkle (golden sunset trail across waves)
          vec3 halfVec = normalize(uSunDir + viewDir);
          float nDotH = max(0.0, dot(normal, halfVec));
          float sunTrail = pow(nDotH, 50.0) * 1.8 + pow(nDotH, 200.0) * 2.8;

          vec3 finalColor = mix(waterBase, skyReflectColor, fresnel * 0.55);
          finalColor += vec3(1.0, 0.74, 0.40) * sunTrail;

          // Blend white surf foam onto the water surface
          vec3 foamColor = vec3(1.0, 0.96, 0.92);
          finalColor = mix(finalColor, foamColor, foam * 0.92);

          // Opacity: slightly transparent right at shallow shore, solid further out
          float alpha = clamp(0.78 + depthT * 0.22 + foam * 0.22, 0.0, 0.98);

          // Glowing energy pulse at the expanding circle boundary
          float edgeDist = abs(dist - uRevealRadius);
          if (edgeDist < 2.4) {
            float edgeGlow = (1.0 - edgeDist / 2.4);
            edgeGlow = pow(edgeGlow, 2.0);
            finalColor += uWaveColor * edgeGlow * 3.5;
            alpha = 1.0;
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

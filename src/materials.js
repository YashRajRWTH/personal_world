import * as THREE from 'three';

/**
 * Creates custom materials for the hyper-realistic diorama world
 */

// Procedural tile paver canvas texture for diorama platform top
export function createPaverTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  // Dark stone base with warm synthwave tint
  ctx.fillStyle = '#1c1724';
  ctx.fillRect(0, 0, 1024, 1024);

  const tileSize = 64;
  const gutter = 3;

  for (let x = 0; x < 1024; x += tileSize) {
    for (let y = 0; y < 1024; y += tileSize) {
      // Subtle color variation per tile
      const noise = (Math.random() - 0.5) * 16;
      const r = Math.min(255, Math.max(0, 32 + noise));
      const g = Math.min(255, Math.max(0, 24 + noise * 0.8));
      const b = Math.min(255, Math.max(0, 42 + noise * 1.2));
      
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(x + gutter, y + gutter, tileSize - gutter * 2, tileSize - gutter * 2);

      // Subtle paver edge highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + gutter, y + gutter, tileSize - gutter * 2, tileSize - gutter * 2);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  return texture;
}

// Custom GLSL Shader for the infinite Synthwave cross-grid ground
export function createInfiniteGridMaterial() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uGridSize: { value: 1.5 },
      uCrossSize: { value: 0.16 },
      uCrossThickness: { value: 0.024 },
      uColor: { value: new THREE.Color(0x5a189a) }, // deep moody synthwave purple
      uGlowColor: { value: new THREE.Color(0x7b2cbf) }, // royal purple
      uBgColor: { value: new THREE.Color(0x06020c) },
      uFogNear: { value: 8.0 },
      uFogFar: { value: 65.0 },
      uCenterHoleRadius: { value: 4.8 }, // keep clean under circular island
      uTime: { value: 0.0 }
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPos.xyz;
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: `
      uniform float uGridSize;
      uniform float uCrossSize;
      uniform float uCrossThickness;
      uniform vec3 uColor;
      uniform vec3 uGlowColor;
      uniform vec3 uBgColor;
      uniform float uFogNear;
      uniform float uFogFar;
      uniform float uCenterHoleRadius;
      uniform float uTime;

      varying vec3 vWorldPosition;
      varying vec2 vUv;

      void main() {
        vec2 p = vWorldPosition.xz;
        float distFromCenter = length(p);

        // Distance fog calculation
        float fog = smoothstep(uFogFar, uFogNear, distFromCenter);

        // Tiled grid coordinates [-0.5, 0.5]
        vec2 grid = fract(p / uGridSize + 0.5) - 0.5;
        grid *= uGridSize;

        // Draw cross marker (+)
        float horizontal = step(abs(grid.y), uCrossThickness * 0.5) * step(abs(grid.x), uCrossSize * 0.5);
        float vertical = step(abs(grid.x), uCrossThickness * 0.5) * step(abs(grid.y), uCrossSize * 0.5);
        float cross = max(horizontal, vertical);

        // Soft, gentle glow around each cross (muted)
        float d = min(
          max(abs(grid.y) - uCrossThickness, abs(grid.x) - uCrossSize * 0.5),
          max(abs(grid.x) - uCrossThickness, abs(grid.y) - uCrossSize * 0.5)
        );
        float crossGlow = exp(-max(0.0, d) * 22.0) * 0.22;

        vec3 crossCol = mix(uColor, uGlowColor, 0.5);
        vec3 finalColor = crossCol * (cross * 1.2 + crossGlow * 0.8);

        // Fade in floor background + crosses
        float alpha = (cross + crossGlow * 0.6) * fog;
        
        // Soft hole under the diorama island
        float holeMask = smoothstep(uCenterHoleRadius - 0.5, uCenterHoleRadius + 0.5, distFromCenter);
        alpha *= holeMask;

        if (alpha < 0.01) discard;

        gl_FragColor = vec4(finalColor, alpha);
      }
    `
  });
}

// Glowing neon border ring material for the circular diorama island (Default Cyber Cyan)
export function createNeonRingMaterial(colorHex = 0x00d2d3, intensity = 1.8) {
  return new THREE.MeshStandardMaterial({
    color: colorHex,
    emissive: new THREE.Color(colorHex),
    emissiveIntensity: intensity,
    roughness: 0.15,
    metalness: 0.1
  });
}

// Cherry blossom leaf shader material - natural muted organic tones, not radioactive
export function createBlossomMaterial(baseColorHex = 0x6e3152) {
  const customMat = new THREE.MeshStandardMaterial({
    color: baseColorHex,
    roughness: 0.75,
    metalness: 0.05,
    emissive: new THREE.Color(0x321325),
    emissiveIntensity: 0.04,
    side: THREE.DoubleSide
  });

  customMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 };
    shader.uniforms.uWindStrength = { value: 0.14 };

    shader.vertexShader = `
      uniform float uTime;
      uniform float uWindStrength;
      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      // Gentle wind breeze displacement
      float sway = sin(uTime * 2.2 + position.y * 3.0 + position.x * 2.0) * uWindStrength;
      float swayZ = cos(uTime * 1.8 + position.y * 2.5 + position.z * 1.5) * (uWindStrength * 0.7);
      transformed.x += sway * (1.0 + position.y * 0.2);
      transformed.z += swayZ * (1.0 + position.y * 0.2);
      `
    );

    customMat.userData.shader = shader;
  };

  return customMat;
}

// "CLICK TO START" curved along the circular diorama boundary at the side of the vehicle
export function createClickToStartTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');

  const cx = 1024;
  const cy = 1024;
  // Radius in canvas pixels: island rim is ~980px, place text at 785px
  const R = 785;
  const text = 'CLICK   TO   START';

  function renderText() {
    ctx.clearRect(0, 0, 2048, 2048);

    ctx.save();
    // Big hand-lettered bold font matching reference screenshot (bigger size: 148px)
    ctx.font = '600 148px "Caveat", "Outfit", cursive, sans-serif';

    // Measure character widths for precise arc positioning
    const charWidths = [];
    let totalWidth = 0;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const w = ch === ' ' ? 55 : ctx.measureText(ch).width + 8;
      charWidths.push(w);
      totalWidth += w;
    }

    const dTheta = totalWidth / R;
    // Centered around ~37 degrees (facing the side/front-right of the car)
    const thetaCenter = 0.64;
    let theta = thetaCenter + dTheta / 2;

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const w = charWidths[i];
      const alpha = theta - (w / 2) / R;
      theta -= w / R;

      if (ch === ' ') continue;

      const x = cx + R * Math.cos(alpha);
      const y = cy + R * Math.sin(alpha);
      const angle = alpha - Math.PI / 2;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(angle);

      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Soft drop shadow
      ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 4;

      // Thin delicate outline (2.5px) for crisp contrast on sand
      ctx.strokeStyle = 'rgba(5, 2, 10, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.strokeText(ch, 0, 0);

      // Pure solid white fill
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(ch, 0, 0);

      ctx.restore();
    }

    ctx.restore();
  }

  renderText();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  if (document.fonts) {
    document.fonts.load('600 148px "Caveat"').then(() => {
      renderText();
      texture.needsUpdate = true;
    }).catch(() => {});

    document.fonts.ready.then(() => {
      renderText();
      texture.needsUpdate = true;
    });

    setTimeout(() => {
      renderText();
      texture.needsUpdate = true;
    }, 400);
  }

  return texture;
}




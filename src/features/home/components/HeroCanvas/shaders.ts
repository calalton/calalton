// GLSL for the hero flowmap distortion. The mark stays centred; a mouse-velocity
// field distorts its UVs and drives a chromatic (RGB) split on hover.

/** Fullscreen-quad vertex shader (PlaneGeometry(2,2) → clip space directly). */
export const QUAD_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/** Flowmap update pass — accumulates pointer velocity, dissipates over time. */
export const FLOW_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform vec2 uMouse;
  uniform vec2 uVelocity;
  uniform float uAspect;
  uniform float uRadius;
  uniform float uDissipation;

  void main() {
    vec2 prev = texture2D(uPrev, vUv).rg * uDissipation;
    vec2 p = vUv - uMouse;
    p.x *= uAspect;
    float influence = 1.0 - smoothstep(0.0, uRadius, length(p));
    vec2 vel = clamp(prev + uVelocity * influence, -1.0, 1.0);
    gl_FragColor = vec4(vel, length(vel), 1.0);
  }
`;

/**
 * Multi-point flowmap update. Same field as FLOW_FRAG but injects several
 * splats per frame — the pointer plus every floating sticker overlapping the
 * logo — so passing stickers drive the same warp/chromatic-split as hover.
 */
export const FLOW_MULTI_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uPrev;
  uniform float uAspect;
  uniform float uDissipation;

  const int MAX_POINTS = 16;
  uniform int uCount;
  uniform vec2 uPoints[MAX_POINTS];
  uniform vec2 uVels[MAX_POINTS];
  uniform float uRadii[MAX_POINTS];

  void main() {
    vec2 acc = texture2D(uPrev, vUv).rg * uDissipation;
    for (int i = 0; i < MAX_POINTS; i++) {
      if (i >= uCount) break;
      vec2 p = vUv - uPoints[i];
      p.x *= uAspect;
      float influence = 1.0 - smoothstep(0.0, uRadii[i], length(p));
      acc += uVels[i] * influence;
    }
    vec2 vel = clamp(acc, -1.0, 1.0);
    gl_FragColor = vec4(vel, length(vel), 1.0);
  }
`;

/**
 * Composite pass. Draws the centred logo (contain-fit, correct aspect); hover
 * distorts it and splits R/G/B via the pointer flow. Transparent elsewhere.
 */
export const COMPOSITE_FRAG = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D uLogo;
  uniform sampler2D uFlow;
  uniform vec2 uResolution;
  uniform float uLogoAspect;
  uniform float uFit;
  uniform float uDistortion;
  uniform float uAberration;
  uniform float uSpread;
  uniform vec3 uPaper;

  void main() {
    vec2 uv = vUv;
    vec3 flow = texture2D(uFlow, uv).rgb;
    float mag = flow.b;

    float screenAspect = uResolution.x / uResolution.y;
    vec2 disp = flow.rg * uDistortion;

    vec2 c = uv - 0.5;
    c.x *= screenAspect / uLogoAspect;
    c /= uFit;
    vec2 duv = c + 0.5 + disp;

    float aber = mag * uSpread * uAberration;
    vec2 dir = mag > 0.0001 ? normalize(flow.rg + 1e-5) : vec2(1.0, 0.0);

    float lr = texture2D(uLogo, duv + dir * aber).r;
    float lg = texture2D(uLogo, duv).g;
    float lb = texture2D(uLogo, duv - dir * aber).b;
    float a = max(max(lr, lg), lb);

    gl_FragColor = vec4(vec3(lr, lg, lb) * uPaper, a);
  }
`;

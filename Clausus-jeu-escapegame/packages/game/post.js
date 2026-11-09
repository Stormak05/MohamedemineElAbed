// Final pass in display space: barrel distortion, chromatic aberration, grading (crushed blacks,
// green shadows / warm highlights), vignette, grain, then ordered-dither colour reduction.
// uLoss (0 = healthy, 1 = sanity gone) drives the hallucination effects and the vignette.
export const NightShader = {
  name: 'NightShader',
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uLoss: { value: 0 },
    uPulse: { value: 0 },
    uBlack: { value: 0 },
    uRelief: { value: 0 },
    uLevels: { value: 20 },
    uDither: { value: 1 },
    uGrain: { value: 0.05 },
    uVignette: { value: 0.18 },
    uVignetteSick: { value: 0.85 },
    uAberration: { value: 0.0018 },
    uBarrel: { value: 0.05 },
    uContrast: { value: 1.12 },
    uBlack0: { value: 0.012 },
    uSaturation: { value: 0.88 },
    uScanlines: { value: 0.06 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = vec4(position.xy, 0.0, 1.0);
    }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uLoss, uPulse, uBlack, uRelief, uLevels, uDither, uGrain, uVignette, uVignetteSick, uAberration;
    uniform float uBarrel, uContrast, uBlack0, uSaturation, uScanlines;
    varying vec2 vUv;

    const float BAYER[16] = float[16](
       0.0,  8.0,  2.0, 10.0,
      12.0,  4.0, 14.0,  6.0,
       3.0, 11.0,  1.0,  9.0,
      15.0,  7.0, 13.0,  5.0);

    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

    vec3 sampleSplit(vec2 uv, vec2 dir) {
      return vec3(texture2D(tDiffuse, uv + dir).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - dir).b);
    }

    void main() {
      vec2 cc = vUv - 0.5;
      float r2 = dot(cc, cc);
      vec2 uv = 0.5 + cc * (1.0 + uBarrel * r2 * 4.0) * (1.0 - uBarrel * 0.45);

      // Sickness: the image breathes and swims.
      float s = uLoss * uLoss;
      uv.x += sin(uv.y * 9.0 + uTime * 2.1) * 0.005 * s;
      uv.y += sin(uv.x * 7.0 - uTime * 1.6) * 0.004 * s;
      uv = 0.5 + (uv - 0.5) * (1.0 - 0.02 * s * sin(uTime * 0.9));

      vec2 dir = cc * (uAberration + 0.012 * s + 0.006 * uPulse);
      vec3 c = sampleSplit(uv, dir);
      // Double vision.
      float dbl = smoothstep(0.45, 1.0, uLoss) * (0.5 + 0.5 * sin(uTime * 0.7));
      vec2 off = vec2(0.012 + 0.01 * sin(uTime * 1.3), 0.004 * sin(uTime * 0.9)) * dbl;
      c = mix(c, sampleSplit(uv + off, dir), 0.42 * dbl);

      // Grade.
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, uSaturation - 0.4 * uLoss + 0.15 * uRelief);
      c = max(c - uBlack0, 0.0) / (1.0 - uBlack0);
      c = clamp((c - 0.5) * uContrast + 0.5, 0.0, 1.0);
      l = dot(c, vec3(0.299, 0.587, 0.114));
      c *= mix(vec3(0.78, 0.96, 0.88), vec3(1.10, 1.00, 0.80), smoothstep(0.05, 0.65, l));
      c = mix(c, c * vec3(1.15, 0.7, 0.65), 0.35 * uPulse);

      // Vignette: soft when healthy, closing in as sanity goes.
      float dist = length(cc) * 1.414;
      float vig = clamp(mix(uVignette, uVignetteSick, smoothstep(0.0, 1.0, uLoss)) + 0.12 * uPulse - 0.1 * uRelief, 0.0, 1.0);
      float inner = mix(0.35, 0.05, smoothstep(0.3, 1.0, uLoss));
      c *= 1.0 - smoothstep(inner, 1.0, dist) * vig;

      if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) c = vec3(0.0);
      c *= 1.0 - uBlack;

      c *= 1.0 - uScanlines * step(1.0, mod(gl_FragCoord.y, 2.0));
      c += (hash(gl_FragCoord.xy + fract(uTime * 7.0) * 113.0) - 0.5) * (uGrain + 0.07 * uLoss);

      if (uLevels > 1.0) {
        ivec2 cell = ivec2(gl_FragCoord.xy) % 4;
        float threshold = BAYER[cell.y * 4 + cell.x] / 16.0 - 0.46875;
        c += threshold * uDither / (uLevels - 1.0);
        c = floor(clamp(c, 0.0, 1.0) * (uLevels - 1.0) + 0.5) / (uLevels - 1.0);
      }
      gl_FragColor = vec4(c, 1.0);
    }`,
};

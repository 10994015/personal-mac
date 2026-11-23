/*
 * 背景暈染效果：滑鼠碰到空白桌面時，大字會染色並像墨水一樣暈開。
 * 流程：低解析度的模擬層保存墨水濃度與流速，顯示層再用濃度替大字上色。
 * 不支援 WebGL2 或使用者要求減少動態時，直接維持靜態背景。
 * 想調整手感可以改 TUNING。
 */
(() => {
  'use strict';

  const TUNING = {
    radius: 0.075,   // 筆觸大小（相對畫面高度）
    fade: 0.986,     // 墨水每格保留比例，越接近 1 停留越久
    spread: 0.011,   // 往外暈開的力道
    wander: 0.00055, // 墨水自己飄動的力道
    idleMs: 6000,    // 停止輸入多久後關閉運算
  };

  const canvas = document.getElementById('ink');
  const hit = document.getElementById('desktopHit');
  const words = [...document.querySelectorAll('.wallpaper span')];
  if (!canvas || !hit || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false });
  if (!gl) return;

  const VERT = `#version 300 es
    out vec2 vUv;
    void main() {
      vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
      vUv = p;
      gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
    }`;

  const SIM = `#version 300 es
    precision highp float;
    uniform sampler2D uPrev;
    uniform vec2 uTexel, uA, uB, uVel;
    uniform float uAspect, uF, uTime, uRadius, uAmp, uFade, uSpread, uWander;
    in vec2 vUv;
    out vec4 o;

    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) {
      vec2 i = floor(p), f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
    }
    vec2 curl(vec2 p) {
      const float e = 0.02;
      return vec2(noise(p + vec2(0, e)) - noise(p - vec2(0, e)), noise(p - vec2(e, 0)) - noise(p + vec2(e, 0))) / (2.0 * e);
    }
    float segment(vec2 p, vec2 a, vec2 b) {
      vec2 ab = b - a;
      float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
      return length(p - a - ab * t);
    }
    void main() {
      vec4 c = texture(uPrev, vUv);
      vec4 L = texture(uPrev, vUv - vec2(uTexel.x, 0));
      vec4 R = texture(uPrev, vUv + vec2(uTexel.x, 0));
      vec4 D = texture(uPrev, vUv - vec2(0, uTexel.y));
      vec4 U = texture(uPrev, vUv + vec2(0, uTexel.y));

      vec2 grad = vec2(R.b - L.b, U.b - D.b);
      vec2 p = vUv * vec2(uAspect, 1.0);
      vec2 flow = c.xy - grad / (1.0 + length(grad) * 6.0) * uSpread + curl(p * 3.2 + uTime * 0.07) * uWander * min(c.b * 3.0, 1.0);
      vec4 next = texture(uPrev, vUv - flow * uF * vec2(1.0 / uAspect, 1.0));
      // Steep fronts get extra smoothing so the ink edge stays soft.
      next = mix(next, (L + R + U + D) * 0.25, clamp(0.24 * uF + length(grad) * 3.0, 0.0, 0.9));

      next.xy *= pow(0.962, uF);
      next.b = max(next.b * pow(uFade, uF) - 0.00035 * uF, 0.0);

      float d = segment(p, uA, uB);
      float g = exp(-d * d / (uRadius * uRadius));
      next.b = min(next.b + uAmp * g, 1.6);
      next.xy += uVel * g;
      o = next;
    }`;

  const SHOW = `#version 300 es
    precision highp float;
    uniform sampler2D uSim, uMask, uSoft;
    uniform vec2 uTexel, uSoftTexel;
    uniform float uAspect, uTime;
    in vec2 vUv;
    out vec4 o;

    const vec3 C[6] = vec3[6](
      vec3(0.13, 0.34, 0.94), vec3(0.01, 0.78, 0.86), vec3(0.84, 0.38, 1.0),
      vec3(1.0, 0.42, 0.72), vec3(1.0, 0.56, 0.16), vec3(1.0, 0.80, 0.27)
    );
    vec3 palette(float t) {
      t = fract(t) * 6.0;
      int i = int(floor(t));
      return mix(C[i], C[(i + 1) % 6], smoothstep(0.0, 1.0, fract(t)));
    }
    float soft(vec2 uv) {
      vec2 e = uSoftTexel * 1.5;
      return (texture(uSoft, uv).a * 2.0
        + texture(uSoft, uv + vec2(e.x, 0)).a + texture(uSoft, uv - vec2(e.x, 0)).a
        + texture(uSoft, uv + vec2(0, e.y)).a + texture(uSoft, uv - vec2(0, e.y)).a) / 6.0;
    }
    void main() {
      vec4 s = texture(uSim, vUv);
      float d = s.b;
      if (d < 0.003) { o = vec4(0.0); return; }

      vec2 e = uTexel * 3.0;
      vec2 grad = vec2(texture(uSim, vUv + vec2(e.x, 0)).b - texture(uSim, vUv - vec2(e.x, 0)).b,
                       texture(uSim, vUv + vec2(0, e.y)).b - texture(uSim, vUv - vec2(0, e.y)).b) / 3.0;
      float ink = smoothstep(0.02, 0.42, d);
      vec2 bend = (grad * 0.55 + s.xy * 1.4) * vec2(1.0 / uAspect, 1.0) * ink;
      float bendLen = length(bend);
      if (bendLen > 0.05) bend *= 0.05 / bendLen;
      vec2 uv = vUv + bend;

      float sharp = texture(uMask, uv).a;
      float glow = soft(uv);
      float body = clamp(sharp * 0.92 + glow * 0.62, 0.0, 1.0);

      float halo = smoothstep(0.3, 1.3, d) * 0.05;
      float a = max(ink * body, halo);

      float tone = d * 0.85 + dot(vUv, vec2(0.55, 0.35)) * 1.1 + (s.x - s.y) * 3.0 + uTime * 0.035;
      o = vec4(palette(tone) * a, a);
    }`;

  function program(fragment) {
    const compile = (type, src) => {
      const sh = gl.createShader(type);
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
      return sh;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, fragment));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    const u = new Proxy({}, { get: (cache, name) => (name in cache ? cache[name] : (cache[name] = gl.getUniformLocation(prog, name))) });
    return { prog, u };
  }

  let sim, show, vao, targets, maskTex, softTex;
  let simW = 0;
  let simH = 0;
  let viewW = 1;
  let viewH = 1;
  let ready = false;

  // Pointer path since the last simulated frame, in aspect-corrected units.
  let last = null;
  let pending = null;
  let burst = 0;
  let lastInput = -Infinity;
  let running = false;
  let prevTime = 0;

  const toSim = (x, y) => [(x / viewW) * (viewW / viewH), 1 - y / viewH];

  function makeTarget(w, h) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return complete ? { tex, fbo } : null;
  }

  function uploadMask(tex, source) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /* Redraws the wallpaper's words at their real on-screen positions. */
  function drawMasks() {
    const c = document.createElement('canvas');
    c.width = viewW;
    c.height = viewH;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    words.forEach((el) => {
      const st = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      ctx.font = `${st.fontWeight} ${st.fontSize} ${st.fontFamily}`;
      if ('letterSpacing' in ctx) ctx.letterSpacing = st.letterSpacing;
      const m = ctx.measureText(el.textContent);
      const asc = m.fontBoundingBoxAscent;
      const desc = m.fontBoundingBoxDescent;
      ctx.fillText(el.textContent, r.left, r.top + (r.height - (asc + desc)) / 2 + asc);
    });
    uploadMask(maskTex, c);

    // Shrinking twice gives a cheap blur that works in every browser.
    const small = document.createElement('canvas');
    small.width = Math.max(8, Math.round(viewW / 8));
    small.height = Math.max(8, Math.round(viewH / 8));
    const sctx = small.getContext('2d');
    sctx.imageSmoothingQuality = 'high';
    sctx.drawImage(c, 0, 0, small.width, small.height);
    const tiny = document.createElement('canvas');
    tiny.width = Math.max(4, Math.round(viewW / 28));
    tiny.height = Math.max(4, Math.round(viewH / 28));
    const tctx = tiny.getContext('2d');
    tctx.imageSmoothingQuality = 'high';
    tctx.drawImage(small, 0, 0, tiny.width, tiny.height);
    uploadMask(softTex, tiny);
    gl.useProgram(show.prog);
    gl.uniform2f(show.u.uSoftTexel, 1 / tiny.width, 1 / tiny.height);
  }

  function resize() {
    viewW = Math.max(1, innerWidth);
    viewH = Math.max(1, innerHeight);
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);

    const scale = Math.min(0.4, 640 / viewW);
    simW = Math.max(64, Math.round(viewW * scale));
    simH = Math.max(64, Math.round(viewH * scale));
    if (targets) targets.forEach((t) => { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); });
    targets = [makeTarget(simW, simH), makeTarget(simW, simH)];
    ready = Boolean(targets[0] && targets[1]);
    if (!ready) return;
    drawMasks();
    last = null;
    pending = null;
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function step(now) {
    const dtMs = Math.min(now - prevTime, 50);
    prevTime = now;
    const F = dtMs / (1000 / 60);
    const t = now / 1000;
    const aspect = viewW / viewH;

    let a = last || pending || [-10, -10];
    let b = pending || a;
    const vx = pending && last ? b[0] - a[0] : 0;
    const vy = pending && last ? b[1] - a[1] : 0;
    const speed = Math.hypot(vx, vy);
    const amp = (pending ? Math.min(0.1 + speed * 2.6, 0.34) * Math.min(F, 3) : 0) + burst;
    const cap = speed > 0.03 ? 0.03 / speed : 1;
    if (pending) last = pending;
    pending = null;
    const radius = TUNING.radius * (burst ? 1.25 : 1);
    burst = 0;

    gl.bindVertexArray(vao);
    gl.disable(gl.BLEND);

    gl.useProgram(sim.prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, targets[1].fbo);
    gl.viewport(0, 0, simW, simH);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[0].tex);
    gl.uniform1i(sim.u.uPrev, 0);
    gl.uniform2f(sim.u.uTexel, 1 / simW, 1 / simH);
    gl.uniform1f(sim.u.uAspect, aspect);
    gl.uniform1f(sim.u.uF, F);
    gl.uniform1f(sim.u.uTime, t);
    gl.uniform2f(sim.u.uA, a[0], a[1]);
    gl.uniform2f(sim.u.uB, b[0], b[1]);
    gl.uniform2f(sim.u.uVel, vx * cap * 0.22, vy * cap * 0.22);
    gl.uniform1f(sim.u.uRadius, radius);
    gl.uniform1f(sim.u.uAmp, amp);
    gl.uniform1f(sim.u.uFade, TUNING.fade);
    gl.uniform1f(sim.u.uSpread, TUNING.spread);
    gl.uniform1f(sim.u.uWander, TUNING.wander);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    targets.reverse();

    gl.useProgram(show.prog);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, targets[0].tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, maskTex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, softTex);
    gl.uniform1i(show.u.uSim, 0);
    gl.uniform1i(show.u.uMask, 1);
    gl.uniform1i(show.u.uSoft, 2);
    gl.uniform2f(show.u.uTexel, 1 / simW, 1 / simH);
    gl.uniform1f(show.u.uAspect, aspect);
    gl.uniform1f(show.u.uTime, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    if (!ready) { running = false; return; }
    step(now);
    if (now - lastInput > TUNING.idleMs) {
      // Ink has fully faded by now: clear it and stop using the GPU.
      targets.forEach((t) => {
        gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
        gl.clear(gl.COLOR_BUFFER_BIT);
      });
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.clear(gl.COLOR_BUFFER_BIT);
      running = false;
      return;
    }
    requestAnimationFrame(frame);
  }

  function wake() {
    lastInput = performance.now();
    if (running || !ready) return;
    running = true;
    prevTime = lastInput;
    requestAnimationFrame(frame);
  }

  function bindInput() {
    addEventListener('pointermove', (e) => {
      if (e.target !== hit) { last = null; pending = null; return; }
      pending = toSim(e.clientX, e.clientY);
      wake();
    }, { passive: true });
    hit.addEventListener('pointerdown', (e) => {
      pending = toSim(e.clientX, e.clientY);
      burst = 0.55;
      wake();
    });
    const lift = () => { last = null; };
    hit.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') lift(); });
    hit.addEventListener('pointercancel', lift);
    hit.addEventListener('pointerleave', lift);
  }

  function init() {
    if (!gl.getExtension('EXT_color_buffer_float') && !gl.getExtension('EXT_color_buffer_half_float')) return false;
    sim = program(SIM);
    show = program(SHOW);
    vao = gl.createVertexArray();
    maskTex = gl.createTexture();
    softTex = gl.createTexture();
    targets = null;
    resize();
    return ready;
  }

  let resizeTimer;
  addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { if (ready || targets) resize(); }, 180);
  });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); ready = false; });
  canvas.addEventListener('webglcontextrestored', () => { init(); });

  // The mask must use the real wallpaper font, so wait until loading has finished.
  const start = () => {
    try {
      if (init()) bindInput();
    } catch (err) {
      console.warn('背景暈染效果未啟用：', err);
    }
  };
  (window.siteReady || Promise.resolve()).then(start);

  // A slow font can still arrive after loading gives up; keep the mask aligned.
  if (document.fonts && document.fonts.addEventListener) {
    let fontTimer;
    document.fonts.addEventListener('loadingdone', () => {
      clearTimeout(fontTimer);
      fontTimer = setTimeout(() => { if (ready) drawMasks(); }, 200);
    });
  }
})();

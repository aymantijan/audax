// three.js engine for the 3D skill tree. Framework-free: SkillGalaxy.jsx owns
// the React side. Colours come from the CSS tokens of globals.css (read at
// runtime), never hard-coded. One draw call per kind of thing (instanced
// spheres, one glow point cloud, one line set) so ~400 compétences stay smooth
// on a phone; rendering pauses when the tab or the canvas is not visible.

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FAMILY_MAP } from '../../utils/skill-families.js';

const token = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888888';
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function palette() {
  const bg = new THREE.Color(token('--bg-primary'));
  const light = bg.r * 0.299 + bg.g * 0.587 + bg.b * 0.114 > 0.5;
  return {
    light,
    locked: new THREE.Color(token('--border')).lerp(new THREE.Color(token('--text-secondary')), 0.35),
    available: new THREE.Color(token('--accent-secondary')),
    active: new THREE.Color(token('--success')),
    mastered: new THREE.Color(token('--accent-primary')),
    capped: new THREE.Color(token('--warning')),
    ink: new THREE.Color(token('--text-secondary')),
    blend: light ? THREE.NormalBlending : THREE.AdditiveBlending,
  };
}

function statusColor(pal, st) {
  if (!st || st.status === 'locked') return pal.locked;
  if (st.status === 'mastered') return pal.mastered;
  if (st.status === 'available') return pal.available;
  // active: greener at low levels, warming toward gold as it grows
  return pal.active.clone().lerp(pal.mastered, Math.max(0, (st.level - 1) / 4) * 0.55);
}
const nodeSize = (st) => (!st || st.status === 'locked' ? 0.5 : st.status === 'available' ? 0.75 : 0.85 + st.level * 0.17);
const glowSize = (st) => (!st || st.status === 'locked' ? 2.5 : st.status === 'available' ? 6 : 7.5 + st.level * 2.6);

const GLOW_VS = `
attribute float size; attribute vec3 color; varying vec3 vColor; uniform float uScale;
void main() { vColor = color; vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`;
const GLOW_FS = `
uniform sampler2D map; uniform float uOpacity; varying vec3 vColor;
void main() { vec4 t = texture2D(map, gl_PointCoord); gl_FragColor = vec4(vColor, t.a * uOpacity); }`;

export function createGalaxy(container, { onHover, onSelect, lowPower = false, reducedMotion = false } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: !lowPower, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null; // no WebGL → the page shows the list view
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lowPower ? 1 : 2));
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'sg-canvas';
  container.appendChild(renderer.domElement);

  const labelLayer = document.createElement('div');
  labelLayer.className = 'sg-labels';
  container.appendChild(labelLayer);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
  camera.position.set(0, 40, 90);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.6;
  controls.minDistance = 4;
  controls.maxDistance = 320;
  controls.autoRotate = !reducedMotion;
  controls.autoRotateSpeed = 0.35;

  let pal = palette();
  const tex = glowTexture();
  scene.add(new THREE.AmbientLight(0xffffff, pal.light ? 1.4 : 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.3);
  key.position.set(40, 80, 60);
  scene.add(key);
  const core = new THREE.PointLight(0xffffff, 1.5, 0, 0);
  scene.add(core);

  // ── starfield
  const starN = lowPower ? 500 : 1600;
  const starPos = new Float32Array(starN * 3);
  for (let i = 0; i < starN; i++) {
    const r = 260 + Math.random() * 380;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    starPos.set([r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)], i * 3);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: pal.ink, size: 1.3, sizeAttenuation: true, transparent: true, opacity: pal.light ? 0.35 : 0.7, depthWrite: false });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);

  const world = new THREE.Group();
  scene.add(world);
  const sphereGeo = new THREE.IcosahedronGeometry(1, lowPower ? 1 : 2);
  const sphereMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.15 });
  const ringGeo = new THREE.TorusGeometry(1, 0.06, 8, 48);
  const shockGeo = new THREE.RingGeometry(0.9, 1, 48);

  let data = null; // { layout, states, mesh, glow, lines, rings, clusterCores, labels }
  let layoutKey = '';
  let hovered = -1;
  let focusModel = null;
  let focusNode = null;
  const effects = [];
  const baseScale = [];
  const pulse = []; // extra scale per node, animated
  const tmpM = new THREE.Matrix4();
  const tmpQ = new THREE.Quaternion();
  const tmpV = new THREE.Vector3();
  const tmpS = new THREE.Vector3();

  function clearWorld() {
    if (!data) return;
    effects.length = 0;
    baseScale.length = 0;
    pulse.length = 0;
    const shared = new Set([sphereGeo, ringGeo, shockGeo]);
    for (const obj of [...world.children]) {
      world.remove(obj);
      obj.traverse?.((o) => {
        if (o.geometry && !shared.has(o.geometry) && !o.isSprite) o.geometry.dispose();
        if (o.material && o.material !== sphereMat) o.material.dispose();
      });
    }
    labelLayer.textContent = '';
    data = null;
  }

  function writeMatrix(i) {
    const n = data.layout.nodes[i];
    const s = baseScale[i] * (1 + (pulse[i] || 0));
    tmpM.compose(tmpV.set(...n.pos), tmpQ, tmpS.set(s, s, s));
    data.mesh.setMatrixAt(i, tmpM);
  }

  function build(layout, states) {
    clearWorld();
    const N = layout.nodes.length;
    const mesh = new THREE.InstancedMesh(sphereGeo, sphereMat, Math.max(1, N));
    mesh.count = N;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    world.add(mesh);

    const glowGeo = new THREE.BufferGeometry();
    const gPos = new Float32Array((N + layout.clusters.length) * 3);
    layout.nodes.forEach((n, i) => gPos.set(n.pos, i * 3));
    layout.clusters.forEach((c, k) => gPos.set(c.center, (N + k) * 3));
    glowGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
    glowGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array((N + layout.clusters.length) * 3), 3));
    glowGeo.setAttribute('size', new THREE.BufferAttribute(new Float32Array(N + layout.clusters.length), 1));
    const glowMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: tex }, uScale: { value: 300 }, uOpacity: { value: pal.light ? 0.55 : 0.9 } },
      vertexShader: GLOW_VS, fragmentShader: GLOW_FS, transparent: true, depthWrite: false, blending: pal.blend,
    });
    const glow = new THREE.Points(glowGeo, glowMat);
    world.add(glow);

    // curved links (prerequisite → compétence) + core → foundation links
    const SEG = lowPower ? 4 : 8;
    const segs = [];
    const curve = (a, b, bend) => {
      const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + bend, (a[2] + b[2]) / 2];
      const pts = [];
      for (let s = 0; s <= SEG; s++) {
        const t = s / SEG;
        const u = 1 - t;
        pts.push([u * u * a[0] + 2 * u * t * mid[0] + t * t * b[0], u * u * a[1] + 2 * u * t * mid[1] + t * t * b[1], u * u * a[2] + 2 * u * t * mid[2] + t * t * b[2]]);
      }
      return pts;
    };
    const linkDefs = [];
    for (const [a, b] of layout.links) linkDefs.push({ from: layout.nodes[a].pos, to: layout.nodes[b].pos, target: b, bend: 1.2 });
    const clusterIdx = new Map(layout.clusters.map((c, k) => [c.model, k]));
    for (const r of layout.roots) linkDefs.push({ from: layout.clusters[clusterIdx.get(layout.nodes[r].model)].center, to: layout.nodes[r].pos, target: r, bend: 0.4, core: true });
    for (const l of linkDefs) {
      l.pts = curve(l.from, l.to, l.bend);
      for (let s = 0; s < SEG; s++) segs.push(l.pts[s], l.pts[s + 1]);
    }
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs.flat()), 3));
    lineGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(segs.length * 3), 3));
    const lines = new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: pal.light ? 0.6 : 0.55, blending: pal.blend, depthWrite: false }));
    world.add(lines);

    // cluster cores
    const coreMeshes = layout.clusters.map((c) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 2), new THREE.MeshStandardMaterial({ color: pal.mastered, emissive: pal.mastered, emissiveIntensity: 0.35, roughness: 0.3 }));
      m.position.set(...c.center);
      world.add(m);
      return m;
    });

    const rings = new THREE.Group();
    world.add(rings);

    // labels: one per cluster, one per node (shown selectively)
    const clusterLabels = layout.clusters.map((c) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'sg-label sg-cluster';
      el.textContent = c.label;
      el.addEventListener('click', () => api.flyTo({ cluster: c.model }));
      labelLayer.appendChild(el);
      return el;
    });
    const nodeLabels = layout.nodes.map((n) => {
      const el = document.createElement('div');
      el.className = 'sg-label sg-node';
      el.textContent = FAMILY_MAP[n.id]?.name || n.id;
      labelLayer.appendChild(el);
      return el;
    });

    data = { layout, states, mesh, glow, lines, linkDefs, SEG, coreMeshes, rings, clusterLabels, nodeLabels, colors: [] };
    applyStates(states, true);
  }

  // Colours, sizes, glows, link tints and mastery rings from the current states.
  function applyStates(states, instant = false) {
    if (!data) return;
    const { layout, mesh, glow, lines, linkDefs, SEG, rings } = data;
    const N = layout.nodes.length;
    const gCol = glow.geometry.attributes.color;
    const gSize = glow.geometry.attributes.size;
    for (let i = 0; i < N; i++) {
      const st = states[layout.nodes[i].id];
      const c = statusColor(pal, st);
      const prev = data.colors[i];
      if (!instant && prev && !prev.equals(c)) {
        const from = prev.clone();
        effects.push({ t: 0, dur: 0.9, step(k) { const cc = from.clone().lerp(c, k); mesh.setColorAt(i, cc); gCol.setXYZ(i, cc.r, cc.g, cc.b); mesh.instanceColor.needsUpdate = true; gCol.needsUpdate = true; } });
      } else {
        mesh.setColorAt(i, c);
        gCol.setXYZ(i, c.r, c.g, c.b);
      }
      data.colors[i] = c;
      baseScale[i] = nodeSize(st);
      pulse[i] = pulse[i] || 0;
      gSize.setX(i, glowSize(st));
      writeMatrix(i);
    }
    layout.clusters.forEach((cl, k) => { gCol.setXYZ(N + k, pal.mastered.r, pal.mastered.g, pal.mastered.b); gSize.setX(N + k, 26); });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    gCol.needsUpdate = true;
    gSize.needsUpdate = true;

    const lCol = lines.geometry.attributes.color;
    let v = 0;
    for (const l of linkDefs) {
      const st = states[layout.nodes[l.target].id];
      const c = st && st.status !== 'locked' ? statusColor(pal, st) : pal.locked;
      const dim = st && st.status !== 'locked' ? 1 : 0.55;
      for (let s = 0; s < SEG * 2; s++) lCol.setXYZ(v++, c.r * dim, c.g * dim, c.b * dim);
    }
    lCol.needsUpdate = true;

    // permanent mastery rings + "needs a proof" rings
    for (const r of [...rings.children]) { rings.remove(r); r.material.dispose(); }
    layout.nodes.forEach((n, i) => {
      const st = states[n.id];
      if (!st || (st.status !== 'mastered' && !st.capped)) return;
      const mastered = st.status === 'mastered';
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: mastered ? pal.mastered : pal.capped, transparent: true, opacity: mastered ? 0.9 : 0.6, blending: pal.blend, depthWrite: false }));
      ring.position.set(...n.pos);
      const s = baseScale[i] * (mastered ? 1.9 : 1.6);
      ring.scale.set(s, s, s);
      ring.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      ring.userData = { spin: mastered ? 0.6 : 0.25, pulse: !mastered };
      rings.add(ring);
    });
    data.states = states;
  }

  // ── effects
  function shockwave(pos, color, size = 7) {
    const m = new THREE.Mesh(shockGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, side: THREE.DoubleSide, blending: pal.blend, depthWrite: false }));
    m.position.set(...pos);
    world.add(m);
    effects.push({ t: 0, dur: 1.3, step(k) { m.quaternion.copy(camera.quaternion); const s = 0.5 + ease(k) * size; m.scale.set(s, s, s); m.material.opacity = 1 - k; }, done() { world.remove(m); m.material.dispose(); } });
  }
  function bump(i, amount = 0.8, dur = 0.9) {
    effects.push({ t: 0, dur, step(k) { pulse[i] = Math.sin(k * Math.PI) * amount; writeMatrix(i); data.mesh.instanceMatrix.needsUpdate = true; }, done() { pulse[i] = 0; writeMatrix(i); data.mesh.instanceMatrix.needsUpdate = true; } });
  }
  // A glowing particle that travels along a path, with a short trail.
  function travel(pts, color, dur, onArrive, delay = 0) {
    const TRAIL = lowPower ? 2 : 5;
    const sprites = [];
    for (let j = 0; j < TRAIL; j++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color, transparent: true, blending: pal.blend, depthWrite: false, opacity: 1 - j / TRAIL }));
      const s = 2.2 * (1 - j / (TRAIL + 1));
      sp.scale.set(s, s, s);
      sp.visible = false;
      world.add(sp);
      sprites.push(sp);
    }
    const at = (k) => {
      const f = Math.max(0, Math.min(1, k)) * (pts.length - 1);
      const a = Math.floor(f);
      const b = Math.min(pts.length - 1, a + 1);
      return lerp3(pts[a], pts[b], f - a);
    };
    effects.push({
      t: -delay, dur,
      step(k) { sprites.forEach((sp, j) => { sp.visible = true; sp.position.set(...at(ease(k) - j * 0.035)); }); },
      done() { sprites.forEach((sp) => { world.remove(sp); sp.material.dispose(); }); onArrive?.(); },
    });
  }
  const bezier = (a, b, lift) => {
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + lift, (a[2] + b[2]) / 2];
    return Array.from({ length: 25 }, (_, s) => { const t = s / 24; const u = 1 - t; return [u * u * a[0] + 2 * u * t * mid[0] + t * t * b[0], u * u * a[1] + 2 * u * t * mid[1] + t * t * b[1], u * u * a[2] + 2 * u * t * mid[2] + t * t * b[2]]; });
  };

  // ── camera flight
  let flight = null;
  function flyTo(target) {
    if (!data) return;
    let to; let dist;
    const dir = tmpV.copy(camera.position).sub(controls.target).normalize();
    if (target === 'overview' || !target) {
      focusModel = null; focusNode = null;
      to = [0, 0, 0];
      // fit the whole ring (+ the biggest cluster) in the frame
      const extent = data.layout.ringR + Math.max(8, ...data.layout.clusters.map((c) => c.radius)) + 4;
      const half = Math.tan((camera.fov * Math.PI) / 360);
      dist = Math.max(extent / (half * Math.min(camera.aspect, 1.7)), (extent * 0.75) / half) * 1.05;
      dir.set(0, 0.55, 1).normalize();
    } else if (target.cluster) {
      const c = data.layout.clusters.find((x) => x.model === target.cluster);
      if (!c) return;
      focusModel = c.model; focusNode = null;
      to = c.center;
      dist = c.radius * 2.6 + 10;
      if (data.layout.ringR > 0) dir.set(c.center[0], data.layout.ringR * 0.5, c.center[2]).normalize();
    } else if (target.node) {
      const i = data.layout.index.get(target.node);
      if (i == null) return;
      const n = data.layout.nodes[i];
      focusModel = n.model; focusNode = n.id;
      to = n.pos;
      dist = 11;
    }
    const fromT = controls.target.toArray();
    const fromP = camera.position.toArray();
    const toP = [to[0] + dir.x * dist, to[1] + dir.y * dist, to[2] + dir.z * dist];
    flight = { t: 0, dur: reducedMotion ? 0.01 : 1.3, fromT, fromP, toT: to, toP };
    controls.autoRotate = false;
  }

  // ── picking
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let pointer = null;
  let downAt = null;
  const onMove = (e) => { const r = renderer.domElement.getBoundingClientRect(); pointer = { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height }; };
  const onLeave = () => { pointer = null; };
  const pick = () => {
    if (!pointer || !data) return -1;
    ndc.set((pointer.x / pointer.w) * 2 - 1, -(pointer.y / pointer.h) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(data.mesh, false)[0];
    return hit ? hit.instanceId : -1;
  };
  const onDown = (e) => { downAt = { x: e.clientX, y: e.clientY }; };
  const onUp = (e) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) { downAt = null; return; }
    downAt = null;
    onMove(e);
    const i = pick();
    if (i >= 0) { const id = data.layout.nodes[i].id; flyTo({ node: id }); onSelect?.(id); }
  };
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerleave', onLeave);
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);

  let idleTimer = null;
  controls.addEventListener('start', () => { controls.autoRotate = false; flight = null; clearTimeout(idleTimer); });
  controls.addEventListener('end', () => { clearTimeout(idleTimer); if (!reducedMotion) idleTimer = setTimeout(() => { if (!focusNode) controls.autoRotate = true; }, 9000); });

  // ── size & visibility
  let W = 1; let H = 1;
  const resize = () => {
    W = container.clientWidth || 1;
    H = container.clientHeight || 1;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();
  let onScreen = true;
  const io = new IntersectionObserver((ents) => { onScreen = ents[0]?.isIntersecting ?? true; });
  io.observe(container);

  // ── loop
  const clock = new THREE.Clock();
  let raf = 0;
  let frame = 0;
  const proj = new THREE.Vector3();
  function placeLabel(el, pos, show) {
    if (!show) { if (el.style.display !== 'none') el.style.display = 'none'; return; }
    proj.set(...pos).project(camera);
    if (proj.z > 1 || Math.abs(proj.x) > 1.1 || Math.abs(proj.y) > 1.1) { el.style.display = 'none'; return; }
    el.style.display = '';
    el.style.transform = `translate(-50%, -140%) translate(${((proj.x + 1) / 2) * W}px, ${((1 - proj.y) / 2) * H}px)`;
  }
  function tick() {
    raf = requestAnimationFrame(tick);
    if (document.hidden || !onScreen) return;
    const dt = Math.min(0.05, clock.getDelta());
    frame++;
    if (flight) {
      flight.t += dt / flight.dur;
      const k = ease(Math.min(1, flight.t));
      controls.target.set(...lerp3(flight.fromT, flight.toT, k));
      camera.position.set(...lerp3(flight.fromP, flight.toP, k));
      if (flight.t >= 1) flight = null;
    }
    controls.update();
    for (let j = effects.length - 1; j >= 0; j--) {
      const fx = effects[j];
      fx.t += dt;
      if (fx.t < 0) continue;
      const k = Math.min(1, fx.t / fx.dur);
      fx.step(k);
      if (k >= 1) { fx.done?.(); effects.splice(j, 1); }
    }
    if (data) {
      const time = clock.elapsedTime;
      for (const r of data.rings.children) {
        r.rotation.z += dt * r.userData.spin;
        r.rotation.x += dt * r.userData.spin * 0.4;
        if (r.userData.pulse) r.material.opacity = 0.35 + Math.sin(time * 3) * 0.25;
      }
      data.coreMeshes.forEach((m, k) => { const s = 1 + Math.sin(time * 1.6 + k) * 0.08; m.scale.set(s, s, s); });
      data.glow.material.uniforms.uScale.value = H * 0.9;
      stars.rotation.y += dt * 0.004;
      // hover (every other frame is plenty)
      if (frame % 2 === 0) {
        const i = pick();
        if (i !== hovered) {
          hovered = i;
          renderer.domElement.style.cursor = i >= 0 ? 'pointer' : '';
          onHover?.(i >= 0 ? data.layout.nodes[i].id : null);
        }
      }
      data.layout.clusters.forEach((c, k) => placeLabel(data.clusterLabels[k], [c.center[0], c.center[1] + 2.6, c.center[2]], !focusNode));
      const dist = camera.position.distanceTo(controls.target);
      data.layout.nodes.forEach((n, i) => {
        const st = data.states[n.id];
        const show = i === hovered || n.id === focusNode || (focusModel === n.model && dist < 80 && st && st.status !== 'locked');
        placeLabel(data.nodeLabels[i], n.pos, show);
        data.nodeLabels[i].classList.toggle('sg-strong', i === hovered || n.id === focusNode);
      });
    }
    renderer.render(scene, camera);
  }
  tick();

  const api = {
    setData(layout, states) {
      const k = layout.nodes.map((n) => n.id).join('|');
      if (k !== layoutKey || !data) {
        const first = !data;
        layoutKey = k;
        build(layout, states);
        if (first) {
          flyTo('overview');
          if (flight) { flight.t = 1; camera.position.set(...flight.toP); controls.target.set(...flight.toT); flight = null; }
          controls.autoRotate = !reducedMotion;
        }
      } else applyStates(states);
    },
    // Replay what changed between two state maps: activity flowing in,
    // unlock waves along the links, level-up shockwaves. Returns the count.
    playDiff(before, after, { stagger = 0.35 } = {}) {
      if (!data || !before) return 0;
      const { layout } = data;
      const clusterOf = new Map(layout.clusters.map((c) => [c.model, c]));
      let n = 0;
      const MAX = lowPower ? 6 : 14;
      for (let i = 0; i < layout.nodes.length && n < MAX; i++) {
        const node = layout.nodes[i];
        const a = before[node.id];
        const b = after[node.id];
        if (!a || !b) continue;
        const gained = b.points - a.points;
        const leveled = b.level > a.level;
        const unlocked = !a.available && b.available && FAMILY_MAP[node.id].prereqs.length > 0;
        if (gained <= 0 && !leveled && !unlocked) continue;
        const delay = n * stagger;
        n++;
        const col = statusColor(pal, b);
        if (gained > 0 || leveled) {
          const c = clusterOf.get(node.model);
          const src = [c.center[0], c.center[1] - 14, c.center[2]];
          travel(bezier(src, node.pos, 8), col, 1.4, () => {
            bump(i, leveled ? 1.1 : 0.5);
            if (leveled) { shockwave(node.pos, col, b.level >= 5 ? 12 : 7); if (b.level >= 5) shockwave(node.pos, pal.mastered, 18); }
          }, delay);
        }
        if (unlocked) {
          const links = data.linkDefs.filter((l) => l.target === i && !l.core);
          for (const l of links) travel(l.pts, pal.available, 1.1, () => { bump(i, 0.9); shockwave(node.pos, pal.available, 5); }, delay + 0.6);
        }
      }
      return n;
    },
    flyTo,
    refreshTheme() { pal = palette(); if (data) { const { layout, states } = data; layoutKey = ''; api.setData(layout, states); } },
    dispose() {
      cancelAnimationFrame(raf);
      clearTimeout(idleTimer);
      ro.disconnect();
      io.disconnect();
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerleave', onLeave);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      clearWorld();
      controls.dispose();
      [sphereGeo, ringGeo, shockGeo, starGeo].forEach((g) => g.dispose());
      [sphereMat, starMat].forEach((m) => m.dispose());
      tex.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.remove();
    },
  };
  return api;
}

// flickpaint3d — M1: load a T-pose sheet -> grounded, paintable 3D standee.
// Pipeline (web-native port of puppet.py's extrude idea):
//   her drawing (flat gray ~140 bg) -> key out bg (border flood-fill) -> silhouette mask
//   -> 2-sided extruded relief (front + back + side walls) -> drop on floor (minY=0) + contact shadow
//   -> raycast pointer -> hit.uv -> splat brush into the skin canvas (the mesh texture)  [the Surface shim]
//
// Chrome stays DOM (SPEC sec.4); the engine is GPU (Three.js / WebGL2). No CDN at runtime (SPEC law sec.4):
// three.js is vendored under ./vendor and resolved via the page's import map.

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ---------------------------------------------------------------- tuning
const TARGET_HEIGHT = 2.4;   // world height of a loaded character
const GRID_LONG     = 150;   // silhouette grid cells on the long axis (higher = smoother edge, heavier)
const REL_DEPTH     = 0.05;  // half-thickness of the relief, in local (height=1) units
const MAX_TEX       = 1024;  // cap source processing resolution
const BG_TOL        = 46;    // colour distance to the sampled background that still counts as background

// ---------------------------------------------------------------- scene
const viewport = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, viewport.clientWidth / viewport.clientHeight, 0.1, 100);
camera.position.set(0, 1.6, 5);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 1.1, 0);
controls.minDistance = 1.2;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI * 0.92;

// floor: a grid + a faint plane, so the character is clearly "dropped onto" y=0 (SPEC: the floor is the floor)
const grid = new THREE.GridHelper(40, 40, 0x39ff14, 0x2a2a33);
grid.material.transparent = true; grid.material.opacity = 0.35;
scene.add(grid);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshBasicMaterial({ color: 0x14141c, transparent: true, opacity: 0.55, depthWrite: false })
);
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.001;
scene.add(floor);

// ---------------------------------------------------------------- contact shadow (a soft radial blob on the floor)
function makeShadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(128, 128, 4, 128, 128, 124);
  grd.addColorStop(0, 'rgba(0,0,0,0.55)');
  grd.addColorStop(0.6, 'rgba(0,0,0,0.22)');
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}
const shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ map: makeShadowTexture(), transparent: true, depthWrite: false })
);
shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.002; shadow.visible = false;
scene.add(shadow);

// ---------------------------------------------------------------- image -> silhouette mask
// Returns { w,h, isBg:Uint8Array, base:HTMLCanvasElement } where base = the source with bg made transparent.
function processImage(img) {
  let w = img.naturalWidth, h = img.naturalHeight;
  const scale = Math.min(1, MAX_TEX / Math.max(w, h));
  w = Math.round(w * scale); h = Math.round(h * scale);

  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;

  // sample background colour from the four corners (the sheets are a flat ~140 gray)
  const corners = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3]];
  let br = 0, bg = 0, bb = 0;
  for (const [x, y] of corners) { const i = (y * w + x) * 4; br += px[i]; bg += px[i + 1]; bb += px[i + 2]; }
  br /= 4; bg /= 4; bb /= 4;

  const isBgColour = (i) => {
    const a = px[i + 3];
    if (a < 16) return true;                            // already transparent
    const dr = px[i] - br, dg = px[i + 1] - bg, db = px[i + 2] - bb;
    return Math.sqrt(dr * dr + dg * dg + db * db) < BG_TOL;
  };

  // flood-fill the background inward from the borders so gray *inside* the figure is kept
  const isBg = new Uint8Array(w * h);
  const stack = [];
  const pushIf = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (isBg[p]) return;
    if (isBgColour(p * 4)) { isBg[p] = 1; stack.push(p); }
  };
  for (let x = 0; x < w; x++) { pushIf(x, 0); pushIf(x, h - 1); }
  for (let y = 0; y < h; y++) { pushIf(0, y); pushIf(w - 1, y); }
  while (stack.length) {
    const p = stack.pop(); const x = p % w, y = (p - x) / w;
    pushIf(x + 1, y); pushIf(x - 1, y); pushIf(x, y + 1); pushIf(x, y - 1);
  }

  // base skin: the source art with the keyed background knocked transparent
  const base = document.createElement('canvas'); base.width = w; base.height = h;
  const bctx = base.getContext('2d');
  const out = bctx.createImageData(w, h);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    out.data[i] = px[i]; out.data[i + 1] = px[i + 1]; out.data[i + 2] = px[i + 2];
    out.data[i + 3] = isBg[p] ? 0 : 255;
  }
  bctx.putImageData(out, 0, 0);
  return { w, h, isBg, base };
}

// ---------------------------------------------------------------- mask -> 2-sided extruded geometry
function buildGeometry(mask) {
  const { w, h, isBg } = mask;
  const aspect = w / h;
  // grid resolution: long axis = GRID_LONG
  let gw, gh;
  if (aspect >= 1) { gw = GRID_LONG; gh = Math.max(1, Math.round(GRID_LONG / aspect)); }
  else { gh = GRID_LONG; gw = Math.max(1, Math.round(GRID_LONG * aspect)); }

  // occupancy: sample the source pixel at each cell centre
  const occ = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      const sx = Math.min(w - 1, Math.floor((gx + 0.5) / gw * w));
      const sy = Math.min(h - 1, Math.floor((gy + 0.5) / gh * h));
      occ[gy * gw + gx] = isBg[sy * w + sx] ? 0 : 1;
    }
  }
  const occAt = (gx, gy) => (gx < 0 || gy < 0 || gx >= gw || gy >= gh) ? 0 : occ[gy * gw + gx];

  const pos = [], uv = [], nor = [];
  const d = REL_DEPTH;
  // local layout: x in [0,aspect], y (up) in [0,1]. UV maps straight to the image (v flipped).
  const X = (gx) => gx / gw * aspect;
  const Y = (gy) => 1 - gy / gh;            // grid row 0 is image top -> world top
  const U = (gx) => gx / gw;
  const V = (gy) => 1 - gy / gh;

  const quad = (a, b, c2, e, n, uvs) => {
    // two triangles a,b,c2 and a,c2,e
    for (const [vx, t] of [[a, 0], [b, 1], [c2, 2], [a, 0], [c2, 2], [e, 3]]) {
      pos.push(vx[0], vx[1], vx[2]); nor.push(n[0], n[1], n[2]); uv.push(uvs[t][0], uvs[t][1]);
    }
  };

  // PASS A — front + back faces (group 0 = the painted skin)
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      if (!occ[gy * gw + gx]) continue;
      const x0 = X(gx), x1 = X(gx + 1), y0 = Y(gy + 1), y1 = Y(gy);
      const u0 = U(gx), u1 = U(gx + 1), v0 = V(gy + 1), v1 = V(gy);

      // FRONT (+z), CCW seen from +z
      quad([x0, y0, d], [x1, y0, d], [x1, y1, d], [x0, y1, d], [0, 0, 1],
           [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]);
      // BACK (-z), CCW seen from -z; UV mirrored in u so the rear shows the mirrored front
      quad([x1, y0, -d], [x0, y0, -d], [x0, y1, -d], [x1, y1, -d], [0, 0, -1],
           [[1 - u1, v0], [1 - u0, v0], [1 - u0, v1], [1 - u1, v1]]);
    }
  }
  const skinVerts = pos.length / 3;

  // PASS B — side walls along silhouette boundaries (group 1 = a flat dark die-cut edge)
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      if (!occ[gy * gw + gx]) continue;
      const x0 = X(gx), x1 = X(gx + 1), y0 = Y(gy + 1), y1 = Y(gy);
      const uv0 = [[0, 0], [0, 0], [0, 0], [0, 0]];   // walls aren't textured
      if (!occAt(gx - 1, gy)) quad([x0, y0, -d], [x0, y1, -d], [x0, y1, d], [x0, y0, d], [-1, 0, 0], uv0);
      if (!occAt(gx + 1, gy)) quad([x1, y0, d], [x1, y1, d], [x1, y1, -d], [x1, y0, -d], [1, 0, 0], uv0);
      if (!occAt(gx, gy - 1)) quad([x0, y1, d], [x1, y1, d], [x1, y1, -d], [x0, y1, -d], [0, 1, 0], uv0);
      if (!occAt(gx, gy + 1)) quad([x0, y0, -d], [x1, y0, -d], [x1, y0, d], [x0, y0, d], [0, -1, 0], uv0);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.addGroup(0, skinVerts, 0);                      // skin
  geo.addGroup(skinVerts, pos.length / 3 - skinVerts, 1); // edge
  geo.computeBoundingBox();
  return geo;
}

// ---------------------------------------------------------------- the skin (base art + a live paint layer)
class Skin {
  constructor(base) {
    this.w = base.width; this.h = base.height;
    this.base = base;                                   // her art, transparent bg (immutable)
    this.paint = document.createElement('canvas');      // strokes only
    this.paint.width = this.w; this.paint.height = this.h;
    this.pctx = this.paint.getContext('2d');
    this.comp = document.createElement('canvas');       // base + paint -> the texture
    this.comp.width = this.w; this.comp.height = this.h;
    this.cctx = this.comp.getContext('2d');
    this.cctx.drawImage(this.base, 0, 0);
    this.tex = new THREE.CanvasTexture(this.comp);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
  }
  dab(x, y, r, color, opacity, erase) {
    const ctx = this.pctx;
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = erase ? 1 : opacity;
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(0.7, rgba(color, a));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    this._recomposite(x - r - 2, y - r - 2, r * 2 + 4, r * 2 + 4);
  }
  _recomposite(x, y, w, h) {
    x = Math.max(0, x | 0); y = Math.max(0, y | 0);
    w = Math.min(this.w - x, Math.ceil(w)); h = Math.min(this.h - y, Math.ceil(h));
    if (w <= 0 || h <= 0) return;
    this.cctx.clearRect(x, y, w, h);
    this.cctx.drawImage(this.base, x, y, w, h, x, y, w, h);
    this.cctx.drawImage(this.paint, x, y, w, h, x, y, w, h);
    this.tex.needsUpdate = true;
  }
  clearPaint() {
    this.pctx.clearRect(0, 0, this.w, this.h);
    this.cctx.clearRect(0, 0, this.w, this.h);
    this.cctx.drawImage(this.base, 0, 0);
    this.tex.needsUpdate = true;
  }
}
function rgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------------------------------------------------------------- character lifecycle
let current = null; // { mesh, skin }
function disposeCurrent() {
  if (!current) return;
  scene.remove(current.mesh);
  current.mesh.geometry.dispose();
  for (const m of [].concat(current.mesh.material)) m.dispose();
  current.skin.tex.dispose();
  shadow.visible = false;
  current = null;
}

function loadCharacter(url, name) {
  setStatus(`loading ${name}…`);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    try {
      const mask = processImage(img);
      const geo = buildGeometry(mask);
      const skin = new Skin(mask.base);
      const skinMat = new THREE.MeshBasicMaterial({ map: skin.tex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
      const edgeMat = new THREE.MeshBasicMaterial({ color: 0x15151c, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, [skinMat, edgeMat]);

      // ground it: scale to TARGET_HEIGHT, centre x/z, sit minY on the floor
      const bb = geo.boundingBox, size = new THREE.Vector3(); bb.getSize(size);
      const s = TARGET_HEIGHT / size.y;
      mesh.scale.setScalar(s);
      mesh.position.x = -((bb.min.x + bb.max.x) / 2) * s;
      mesh.position.z = -((bb.min.z + bb.max.z) / 2) * s;
      mesh.position.y = -bb.min.y * s;

      disposeCurrent();
      scene.add(mesh);
      current = { mesh, skin };

      // contact shadow under the footprint
      shadow.scale.set(size.x * s * 1.15, size.z * s * 8 + 0.6, 1);
      shadow.position.set(0, 0.002, 0);
      shadow.visible = true;

      frameModel(size.y * s);
      setStatus(`${name} — drag on the model to paint, drag the background to spin`);
    } catch (e) {
      console.error(e); setStatus('could not build that one: ' + e.message);
    }
  };
  img.onerror = () => setStatus('could not load image: ' + url);
  img.src = url;
}

function frameModel(height) {
  const t = new THREE.Vector3(0, height * 0.5, 0);
  controls.target.copy(t);
  camera.position.set(height * 0.55, height * 0.62, height * 1.55);
  controls.update();
}

// ---------------------------------------------------------------- painting (the Surface shim: raycast -> uv -> texel)
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const tool = { color: '#39ff14', size: 26, opacity: 0.9, erase: false };
let painting = false, lastUV = null;
const activePointers = new Set();

function pointerNDC(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}
function hitUV(e) {
  if (!current) return null;
  pointerNDC(e);
  raycaster.setFromCamera(ndc, camera);
  const hit = raycaster.intersectObject(current.mesh, false)[0];
  return hit && hit.uv ? hit.uv : null;
}
function paintAt(uv) {
  const sk = current.skin;
  const x = uv.x * sk.w, y = (1 - uv.y) * sk.h;
  if (lastUV) {
    // interpolate along the stroke so fast drags stay continuous
    const x0 = lastUV.x * sk.w, y0 = (1 - lastUV.y) * sk.h;
    const dist = Math.hypot(x - x0, y - y0);
    const step = Math.max(1, tool.size * 0.35);
    const n = Math.ceil(dist / step);
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      sk.dab(x0 + (x - x0) * t, y0 + (y - y0) * t, tool.size, tool.color, tool.opacity, tool.erase);
    }
  } else {
    sk.dab(x, y, tool.size, tool.color, tool.opacity, tool.erase);
  }
  lastUV = uv;
}

const dom = renderer.domElement;
dom.addEventListener('pointerdown', (e) => {
  activePointers.add(e.pointerId);
  if (activePointers.size > 1) { painting = false; lastUV = null; controls.enabled = true; return; }
  const uv = hitUV(e);
  if (uv) { painting = true; lastUV = null; controls.enabled = false; paintAt(uv); }
});
dom.addEventListener('pointermove', (e) => {
  if (!painting || activePointers.size > 1) return;
  const uv = hitUV(e);
  if (uv) paintAt(uv);
});
function endStroke(e) {
  activePointers.delete(e.pointerId);
  if (activePointers.size === 0) { painting = false; lastUV = null; controls.enabled = true; }
}
dom.addEventListener('pointerup', endStroke);
dom.addEventListener('pointercancel', endStroke);
dom.addEventListener('pointerleave', endStroke);

// ---------------------------------------------------------------- DOM chrome
const statusEl = document.getElementById('status');
function setStatus(t) { statusEl.textContent = t; }

async function buildTray() {
  const tray = document.getElementById('tray');
  let data;
  try { data = await (await fetch('characters.json')).json(); }
  catch (e) { setStatus('could not load characters.json (serve over http, not file://)'); return; }
  for (const ch of data.characters) {
    const b = document.createElement('button');
    b.className = 'char';
    b.title = ch.name;
    const im = document.createElement('img'); im.loading = 'lazy'; im.src = ch.front; im.alt = ch.name;
    const cap = document.createElement('span'); cap.textContent = ch.name;
    b.append(im, cap);
    b.addEventListener('click', () => {
      document.querySelectorAll('.char.active').forEach(n => n.classList.remove('active'));
      b.classList.add('active');
      loadCharacter(ch.front, ch.name);
    });
    tray.appendChild(b);
  }
  // auto-load the first character
  const first = tray.querySelector('.char');
  if (first) first.click();
}

// tools
const $ = (id) => document.getElementById(id);
$('size').addEventListener('input', (e) => { tool.size = +e.target.value; $('sizeVal').textContent = e.target.value; });
$('opacity').addEventListener('input', (e) => { tool.opacity = +e.target.value / 100; $('opacityVal').textContent = e.target.value + '%'; });
$('color').addEventListener('input', (e) => { tool.color = e.target.value; tool.erase = false; syncTool(); });
document.querySelectorAll('.swatch').forEach(s => s.addEventListener('click', () => {
  tool.color = s.dataset.c; tool.erase = false; $('color').value = s.dataset.c; syncTool();
}));
$('brush').addEventListener('click', () => { tool.erase = false; syncTool(); });
$('eraser').addEventListener('click', () => { tool.erase = true; syncTool(); });
function syncTool() {
  $('brush').classList.toggle('active', !tool.erase);
  $('eraser').classList.toggle('active', tool.erase);
  $('color').value = tool.color;   // authoritative over any browser form-restore
  document.querySelectorAll('.swatch').forEach(s =>
    s.classList.toggle('active', !tool.erase && s.dataset.c.toLowerCase() === tool.color.toLowerCase()));
}
$('clear').addEventListener('click', () => { if (current) current.skin.clearPaint(); });
$('reset').addEventListener('click', () => { if (current) frameModel(TARGET_HEIGHT); });
$('save').addEventListener('click', () => {
  if (!current) return;
  const a = document.createElement('a');
  a.download = 'flickpaint3d-skin.png';
  a.href = current.skin.comp.toDataURL('image/png');
  a.click();
});
$('shot').addEventListener('click', () => {
  renderer.render(scene, camera);
  const a = document.createElement('a');
  a.download = 'flickpaint3d.png';
  a.href = renderer.domElement.toDataURL('image/png');
  a.click();
});

// ---------------------------------------------------------------- loop + resize
function onResize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  camera.aspect = w / h; camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}
addEventListener('resize', onResize);
function tick() { controls.update(); renderer.render(scene, camera); requestAnimationFrame(tick); }

syncTool();
buildTray();
tick();

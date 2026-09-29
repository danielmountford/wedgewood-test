/* Wedgewood — live 3D building size preview
   Classic script (not an ES module) so it loads from file:// and any web server.
   Loaded on demand by quote.js after assets/vendor/three/three.min.js (window.THREE, MIT).
   Geometry is generated from the dimensions (never a stretched model), rendered on demand only. */
(function () {
'use strict';
const THREE = window.THREE;
const { BackSide, BoxGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, PointLight, Scene } = THREE;

/* Room environment (from three.js examples, MIT — https://github.com/mrdoob/three.js),
   adapted to a classic script so it works from file:// as well as a web server. */
class RoomEnvironment extends Scene {

	constructor() {

		super();

		const geometry = new BoxGeometry();
		geometry.deleteAttribute( 'uv' );

		const roomMaterial = new MeshStandardMaterial( { side: BackSide } );
		const boxMaterial = new MeshStandardMaterial();

		const mainLight = new PointLight( 0xffffff, 900, 28, 2 );
		mainLight.position.set( 0.418, 16.199, 0.300 );
		this.add( mainLight );

		const room = new Mesh( geometry, roomMaterial );
		room.position.set( - 0.757, 13.219, 0.717 );
		room.scale.set( 31.713, 28.305, 28.591 );
		this.add( room );

		const box1 = new Mesh( geometry, boxMaterial );
		box1.position.set( - 10.906, 2.009, 1.846 );
		box1.rotation.set( 0, - 0.195, 0 );
		box1.scale.set( 2.328, 7.905, 4.651 );
		this.add( box1 );

		const box2 = new Mesh( geometry, boxMaterial );
		box2.position.set( - 5.607, - 0.754, - 0.758 );
		box2.rotation.set( 0, 0.994, 0 );
		box2.scale.set( 1.970, 1.534, 3.955 );
		this.add( box2 );

		const box3 = new Mesh( geometry, boxMaterial );
		box3.position.set( 6.167, 0.857, 7.803 );
		box3.rotation.set( 0, 0.561, 0 );
		box3.scale.set( 3.927, 6.285, 3.687 );
		this.add( box3 );

		const box4 = new Mesh( geometry, boxMaterial );
		box4.position.set( - 2.017, 0.018, 6.124 );
		box4.rotation.set( 0, 0.333, 0 );
		box4.scale.set( 2.002, 4.566, 2.064 );
		this.add( box4 );

		const box5 = new Mesh( geometry, boxMaterial );
		box5.position.set( 2.291, - 0.756, - 2.621 );
		box5.rotation.set( 0, - 0.286, 0 );
		box5.scale.set( 1.546, 1.552, 1.496 );
		this.add( box5 );

		const box6 = new Mesh( geometry, boxMaterial );
		box6.position.set( - 2.193, - 0.369, - 5.547 );
		box6.rotation.set( 0, 0.516, 0 );
		box6.scale.set( 3.875, 3.487, 2.986 );
		this.add( box6 );


		// -x right
		const light1 = new Mesh( geometry, createAreaLightMaterial( 50 ) );
		light1.position.set( - 16.116, 14.37, 8.208 );
		light1.scale.set( 0.1, 2.428, 2.739 );
		this.add( light1 );

		// -x left
		const light2 = new Mesh( geometry, createAreaLightMaterial( 50 ) );
		light2.position.set( - 16.109, 18.021, - 8.207 );
		light2.scale.set( 0.1, 2.425, 2.751 );
		this.add( light2 );

		// +x
		const light3 = new Mesh( geometry, createAreaLightMaterial( 17 ) );
		light3.position.set( 14.904, 12.198, - 1.832 );
		light3.scale.set( 0.15, 4.265, 6.331 );
		this.add( light3 );

		// +z
		const light4 = new Mesh( geometry, createAreaLightMaterial( 43 ) );
		light4.position.set( - 0.462, 8.89, 14.520 );
		light4.scale.set( 4.38, 5.441, 0.088 );
		this.add( light4 );

		// -z
		const light5 = new Mesh( geometry, createAreaLightMaterial( 20 ) );
		light5.position.set( 3.235, 11.486, - 12.541 );
		light5.scale.set( 2.5, 2.0, 0.1 );
		this.add( light5 );

		// +y
		const light6 = new Mesh( geometry, createAreaLightMaterial( 100 ) );
		light6.position.set( 0.0, 20.0, 0.0 );
		light6.scale.set( 1.0, 0.1, 1.0 );
		this.add( light6 );

	}

	dispose() {

		const resources = new Set();

		this.traverse( ( object ) => {

			if ( object.isMesh ) {

				resources.add( object.geometry );
				resources.add( object.material );

			}

		} );

		for ( const resource of resources ) {

			resource.dispose();

		}

	}

}

function createAreaLightMaterial( intensity ) {

	const material = new MeshBasicMaterial();
	material.color.setScalar( intensity );
	return material;

}

/* Swap finishes here without touching the geometry code */
const PREVIEW_CONFIG = {
  colours: {
    wall: '#D5DBDE',          // light grey composite cladding
    roof: '#4A565D',          // slate roof sheets
    trim: '#0F2430',          // Wedgewood navy flashings & trims
    door: '#A3ADB2',          // roller shutter (illustrative)
    personnelDoor: '#1C3E50', // personnel door (illustrative)
    dimension: '#E54711'      // Wedgewood orange dimension lines
  },
  profilePitch: 1 / 3,        // metres between cladding ribs — kept constant as the building grows
  slatPitch: 0.1,             // metres between roller-shutter slats
  overhang: 0.3,              // roof overhang at eaves & gables (m)
  background: '#FFFFFF'
};

const ease = (t) => 1 - Math.pow(1 - t, 3);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- Procedural textures (no third-party assets) ---------- */
function profileCanvas(samples, heightAt, roughAt) {
  const n = document.createElement('canvas');
  const r = document.createElement('canvas');
  n.width = r.width = samples; n.height = r.height = 2;
  const nc = n.getContext('2d'); const rc = r.getContext('2d');
  const nd = nc.createImageData(samples, 2); const rd = rc.createImageData(samples, 2);
  for (let i = 0; i < samples; i++) {
    const t = (i + 0.5) / samples;
    const dt = 1 / samples;
    const slope = (heightAt(t + dt / 2) - heightAt(t - dt / 2)) / dt;
    let nx = -slope, nz = 1; const len = Math.hypot(nx, nz); nx /= len; nz /= len;
    const rough = roughAt(t);
    for (let y = 0; y < 2; y++) {
      const k = (y * samples + i) * 4;
      nd.data[k] = Math.round((nx * 0.5 + 0.5) * 255); nd.data[k + 1] = 128; nd.data[k + 2] = Math.round((nz * 0.5 + 0.5) * 255); nd.data[k + 3] = 255;
      const g = Math.round(rough * 255);
      rd.data[k] = g; rd.data[k + 1] = g; rd.data[k + 2] = g; rd.data[k + 3] = 255;
    }
  }
  nc.putImageData(nd, 0, 0); rc.putImageData(rd, 0, 0);
  return { normal: n, rough: r };
}
function toTexture(canvas, renderer) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.NoColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}
/* Trapezoidal sheet: narrow crest, sloped webs, wide pan (one period per UV unit) */
function trapezoid(t) {
  t = ((t % 1) + 1) % 1;
  const k = 0.55; // rib depth factor in the normal map (restrained)
  if (t < 0.10) return k;
  if (t < 0.20) return k * (1 - (t - 0.10) / 0.10);
  if (t < 0.88) return 0;
  return k * ((t - 0.88) / 0.12);
}
const trapRough = (t) => (t < 0.10 ? 0.40 : t < 0.20 || t > 0.88 ? 0.62 : 0.5);
const slat = (t) => 0.22 * Math.sin(((t % 1) + 1) % 1 * Math.PI * 2);
const slatRough = () => 0.55;

/* ---------- Geometry helpers (world-space, UVs in real units) ---------- */
function triangles(points, uv) {
  const pos = new Float32Array(points.length * 3);
  const uvs = new Float32Array(points.length * 2);
  points.forEach((p, i) => {
    pos.set(p, i * 3);
    const [u, v] = uv(p);
    uvs[i * 2] = u; uvs[i * 2 + 1] = v;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  g.computeVertexNormals();
  return g;
}
const quad = (a, b, c, d, uv) => triangles([a, b, c, a, c, d], uv);
const flip = (tris) => { const out = []; for (let i = 0; i < tris.length; i += 3) out.push(tris[i], tris[i + 2], tris[i + 1]); return out; };

function createBuildingPreview(container, { onRender, config = {} } = {}) {
  const cfg = { ...PREVIEW_CONFIG, ...config, colours: { ...PREVIEW_CONFIG.colours, ...(config.colours || {}) } };

  /* Renderer */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(cfg.background, 1);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();

  /* Neutral studio lighting: soft room environment + one directional key light */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envTex = pmrem.fromScene(room, 0.04).texture;
  room.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  pmrem.dispose();
  scene.environment = envTex;
  scene.environmentIntensity = 0.62;

  const sun = new THREE.DirectionalLight(0xffffff, 1.9);
  sun.castShadow = true;
  const small = Math.min(container.clientWidth, container.clientHeight) < 360;
  sun.shadow.mapSize.set(small ? 512 : 1024, small ? 512 : 1024);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  /* Ground: white, receives a soft cast shadow, plus a restrained contact shadow */
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.12 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), groundMat);
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);

  const ccan = document.createElement('canvas'); ccan.width = ccan.height = 128;
  const cctx = ccan.getContext('2d');
  // soft rectangle via an offset canvas shadow (works in every browser, unlike ctx.filter)
  cctx.shadowColor = 'rgba(15,36,48,.55)'; cctx.shadowBlur = 22; cctx.shadowOffsetX = 1000; cctx.fillRect(30 - 1000, 30, 68, 68);
  const contactTex = new THREE.CanvasTexture(ccan); contactTex.colorSpace = THREE.SRGBColorSpace;
  const contactMat = new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, depthWrite: false, opacity: 0.55, toneMapped: false });
  const contact = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), contactMat);
  contact.rotation.x = -Math.PI / 2; contact.position.y = 0.003; contact.renderOrder = 1; scene.add(contact);

  /* Materials: painted steel with corrugation (normal map) and gentle roughness variation */
  const prof = profileCanvas(256, trapezoid, trapRough);
  const slats = profileCanvas(64, slat, slatRough);
  const profN = toTexture(prof.normal, renderer), profR = toTexture(prof.rough, renderer);
  const slatN = toTexture(slats.normal, renderer), slatR = toTexture(slats.rough, renderer);
  const steel = (colour, normal, rough, extra = {}) => new THREE.MeshStandardMaterial({
    color: colour, metalness: 0.22, roughness: 1, roughnessMap: rough, normalMap: normal,
    normalScale: new THREE.Vector2(0.9, 0.9), envMapIntensity: 0.9, ...extra
  });
  const mats = {
    wall: steel(cfg.colours.wall, profN, profR),
    roof: steel(cfg.colours.roof, profN, profR, { side: THREE.DoubleSide }),
    door: steel(cfg.colours.door, slatN, slatR),
    trim: new THREE.MeshStandardMaterial({ color: cfg.colours.trim, metalness: 0.3, roughness: 0.45 }),
    pdoor: new THREE.MeshStandardMaterial({ color: cfg.colours.personnelDoor, metalness: 0.25, roughness: 0.5 }),
    dim: new THREE.LineBasicMaterial({ color: cfg.colours.dimension, toneMapped: false }),
    dash: new THREE.LineDashedMaterial({ color: cfg.colours.dimension, dashSize: 0.3, gapSize: 0.22, toneMapped: false })
  };

  const building = new THREE.Group(); scene.add(building);
  const dims = new THREE.Group(); scene.add(dims);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 3000);
  let current = null;          // dims currently drawn
  let yaw = 0;                 // optional user rotation (radians)
  let anim = 0;                // rAF id while tweening
  let lastFit = null;
  let anchors = {};

  /* ---------- Build the building for a set of dimensions (metres) ---------- */
  function clearGroup(g) {
    for (let i = g.children.length - 1; i >= 0; i--) { const c = g.children[i]; c.geometry && c.geometry.dispose(); g.remove(c); }
  }
  function mesh(geo, mat, cast = true, receive = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = receive; building.add(m); return m; }
  function box(sx, sy, sz, x, y, z, rotZ = 0, mat = mats.trim) { const m = mesh(new THREE.BoxGeometry(sx, sy, sz), mat); m.position.set(x, y, z); m.rotation.z = rotZ; return m; }

  function build(d) {
    clearGroup(building); clearGroup(dims);
    const { w, l, e, h } = d;
    const P = cfg.profilePitch, o = cfg.overhang, hw = w / 2, hl = l / 2;
    const rise = h - e, slopeLen = Math.hypot(hw, rise), a = Math.atan2(rise, hw);
    const ux = hw / slopeLen, uy = -rise / slopeLen;             // unit vector ridge → eave (right slope)
    const ex = hw + ux * o, ey = e + uy * o;                      // eave edge incl. overhang
    const L = hl + o;

    /* Walls — UVs in metres ÷ rib pitch, so rib spacing never stretches */
    const sideUV = (p) => [p[2] / P, p[1] / P];
    mesh(quad([hw, 0, hl], [hw, 0, -hl], [hw, e, -hl], [hw, e, hl], sideUV), mats.wall);
    mesh(quad([-hw, 0, -hl], [-hw, 0, hl], [-hw, e, hl], [-hw, e, -hl], sideUV), mats.wall);
    const gable = (z) => [[-hw, 0, z], [hw, 0, z], [hw, e, z], [-hw, 0, z], [hw, e, z], [-hw, e, z], [-hw, e, z], [hw, e, z], [0, h, z]];
    const gableUV = (p) => [p[0] / P, p[1] / P];
    mesh(triangles(gable(hl), gableUV), mats.wall);
    mesh(triangles(flip(gable(-hl)), gableUV), mats.wall);

    /* Roof sheets — ribs run eaves-to-ridge, so the profile repeats along the length */
    const roofUV = (p) => [p[2] / P, Math.hypot(p[0], p[1] - h) / P];
    mesh(quad([0, h, L], [ex, ey, L], [ex, ey, -L], [0, h, -L], roofUV), mats.roof);
    mesh(quad([0, h, -L], [-ex, ey, -L], [-ex, ey, L], [0, h, L], roofUV), mats.roof);

    /* Flashings & trims (silhouette detail) */
    const t = 0.14;
    [[hw, hl], [-hw, hl], [hw, -hl], [-hw, -hl]].forEach(([x, z]) => box(t, e, t, x, e / 2, z));             // corner trims
    [1, -1].forEach((s) => box(0.2, 0.16, 2 * L, s * (ex + 0.05), ey - 0.1, 0));                             // gutters
    box(0.42, 0.07, 2 * L + 0.02, 0, h + 0.03, 0);                                                           // ridge cap
    [1, -1].forEach((s) => [L, -L].forEach((z) => {                                                           // barge flashings
      const len = slopeLen + o;
      box(len, 0.2, 0.07, s * (ex / 2), (h + ey) / 2 + 0.06, z + Math.sign(z) * 0.02, s * -a);
    }));
    box(w + 0.1, 0.12, 0.05, 0, 0.06, hl + 0.03); box(w + 0.1, 0.12, 0.05, 0, 0.06, -hl - 0.03);              // base flashings (gables)
    box(0.05, 0.12, l, hw + 0.03, 0.06, 0); box(0.05, 0.12, l, -hw - 0.03, 0.06, 0);                          // base flashings (sides)

    /* Openings on the front gable — illustrative positions */
    const dw = clamp(w * 0.34, 2.4, 6), dh = Math.min(clamp(e * 0.72, 2.4, 6), e - 0.6);
    let dx = -w * 0.12; dx = clamp(dx, -hw + dw / 2 + 0.6, hw - dw / 2 - 0.6);
    if (dh > 1.6 && w > dw + 1.2) {
      const z = hl + 0.025, sUV = (p) => [p[1] / cfg.slatPitch, p[0] / cfg.slatPitch];
      mesh(quad([dx - dw / 2, 0, z], [dx + dw / 2, 0, z], [dx + dw / 2, dh, z], [dx - dw / 2, dh, z], sUV), mats.door);
      box(0.14, dh, 0.14, dx - dw / 2 - 0.07, dh / 2, hl + 0.06); box(0.14, dh, 0.14, dx + dw / 2 + 0.07, dh / 2, hl + 0.06);
      box(dw + 0.34, 0.38, 0.34, dx, dh + 0.19, hl + 0.14);                                                   // shutter box
      const px = hw - 1.35;
      if (w >= 8 && px - 0.5 > dx + dw / 2 + 0.8 && e > 2.6) {                                                  // personnel door
        const pz = hl + 0.03;
        mesh(quad([px - 0.47, 0, pz], [px + 0.47, 0, pz], [px + 0.47, 2.1, pz], [px - 0.47, 2.1, pz], () => [0, 0]), mats.pdoor);
        box(0.08, 2.18, 0.1, px - 0.51, 1.09, hl + 0.05); box(0.08, 2.18, 0.1, px + 0.51, 1.09, hl + 0.05); box(1.1, 0.08, 0.1, px, 2.18, hl + 0.05);
        box(1.5, 0.06, 0.7, px, 2.55, hl + 0.35);                                                              // canopy
      }
    }

    /* Dimension lines (orange) + anchor points for the HTML labels */
    const g = Math.max(0.9, Math.min(w, l) * 0.08), tk = g * 0.35;
    const seg = []; const dash = [];
    const S = (a1, b1) => seg.push(a1, b1);
    S([-hw, 0.02, hl + g], [hw, 0.02, hl + g]); S([-hw, 0.02, hl + 0.2], [-hw, 0.02, hl + g + tk]); S([hw, 0.02, hl + 0.2], [hw, 0.02, hl + g + tk]);     // width
    S([hw + g, 0.02, hl], [hw + g, 0.02, -hl]); S([hw + 0.2, 0.02, -hl], [hw + g + tk, 0.02, -hl]); S([hw + 0.2, 0.02, hl], [hw + g + tk, 0.02, hl]);  // length
    S([hw + g, 0, hl + 0.001], [hw + g, e, hl + 0.001]); S([hw + g - tk, e, hl], [hw + g + tk, e, hl]);                                                // eaves
    dash.push([hw + 0.1, e, hl], [hw + g, e, hl]);
    S([-hw - g, 0, hl], [-hw - g, h, hl]); S([-hw - g - tk, h, hl], [-hw - g + tk, h, hl]); S([-hw - g - tk, 0, hl], [-hw - g + tk, 0, hl]);          // overall height
    dash.push([0, h, hl], [-hw - g, h, hl]);
    const lg = new THREE.BufferGeometry().setFromPoints(seg.map((p) => new THREE.Vector3(...p)));
    dims.add(new THREE.LineSegments(lg, mats.dim));
    const dg = new THREE.BufferGeometry().setFromPoints(dash.map((p) => new THREE.Vector3(...p)));
    const dl = new THREE.LineSegments(dg, mats.dash); dl.computeLineDistances(); dims.add(dl);

    anchors = {
      w: new THREE.Vector3(0, 0, hl + g + tk * 1.6),
      l: new THREE.Vector3(hw + g + tk * 1.6, 0, 0),
      e: new THREE.Vector3(hw + g, e * 0.72, hl),
      h: new THREE.Vector3(-hw - g, h * 0.5, hl)
    };

    /* Ground, contact shadow and key light follow the building */
    const size = Math.max(w, l, h);
    ground.scale.set(size * 8, size * 8, 1);
    contact.scale.set((w + 1.6) * 1.35, (l + 1.6) * 1.35, 1);
    const sd = size * 1.6;
    sun.position.set(-0.62 * sd, 1.05 * sd, 0.72 * sd);
    sun.target.position.set(0, 0, 0);
    const sc = sun.shadow.camera; const ext = size * 1.1;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.near = 0.1; sc.far = sd * 3.5; sc.updateProjectionMatrix();

    lastFit = { xmin: -hw - g - 0.6, xmax: hw + g + tk * 2 + 0.6, ymin: 0, ymax: h + 0.4, zmin: -L, zmax: hl + g + tk * 2 + 0.4 };
  }

  /* ---------- Camera: consistent three-quarter view, reframed to fit ---------- */
  const baseDir = new THREE.Vector3(1.0, 0.5, 1.3).normalize();
  function fit() {
    const r = container.getBoundingClientRect();
    const W = Math.max(1, r.width), H = Math.max(1, r.height);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    const b = lastFit; if (!b) return;
    const corners = [];
    for (const x of [b.xmin, b.xmax]) for (const y of [b.ymin, b.ymax]) for (const z of [b.zmin, b.zmax]) corners.push(new THREE.Vector3(x, y, z));
    const dir = baseDir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const target = new THREE.Vector3((b.xmin + b.xmax) / 2, (b.ymin + b.ymax) / 2, (b.zmin + b.zmax) / 2);
    let dist = Math.hypot(b.xmax - b.xmin, b.ymax - b.ymin, b.zmax - b.zmin) * 1.2;
    const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const right = new THREE.Vector3(), up = new THREE.Vector3(), v = new THREE.Vector3();
    for (let k = 0; k < 5; k++) {
      camera.position.copy(target).addScaledVector(dir, dist);
      camera.lookAt(target); camera.updateMatrixWorld();
      let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
      corners.forEach((c) => { v.copy(c).project(camera); minx = Math.min(minx, v.x); maxx = Math.max(maxx, v.x); miny = Math.min(miny, v.y); maxy = Math.max(maxy, v.y); });
      const halfH = dist * tanH, halfW = halfH * camera.aspect;
      right.setFromMatrixColumn(camera.matrixWorld, 0); up.setFromMatrixColumn(camera.matrixWorld, 1);
      target.addScaledVector(right, ((minx + maxx) / 2) * halfW).addScaledVector(up, ((miny + maxy) / 2) * halfH);
      const need = Math.max((maxx - minx) / 2 / 0.9, (maxy - miny) / 2 / 0.84);
      dist *= need;
    }
    camera.position.copy(target).addScaledVector(dir, dist);
    camera.lookAt(target); camera.near = Math.max(0.1, dist / 200); camera.far = dist * 10; camera.updateProjectionMatrix();
  }

  function render() {
    fit();
    renderer.render(scene, camera);
    if (onRender) {
      const r = container.getBoundingClientRect();
      const out = {};
      const v = new THREE.Vector3();
      Object.entries(anchors).forEach(([k, p]) => {
        v.copy(p).project(camera);
        out[k] = { x: (v.x + 1) / 2 * r.width, y: (1 - v.y) / 2 * r.height, visible: v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 };
      });
      onRender(out);
    }
  }

  function resize() {
    const r = container.getBoundingClientRect();
    renderer.setSize(Math.max(1, Math.round(r.width)), Math.max(1, Math.round(r.height)), false);
    if (current) render();
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(container);
  resize();

  /* ---------- Public: update to new dimensions (tweened, render on demand) ---------- */
  function update(next, { animate = true } = {}) {
    cancelAnimationFrame(anim);
    const to = { ...next };
    if (!current || !animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      current = to; build(current); render(); return;
    }
    const from = { ...current }, t0 = performance.now(), dur = 520;
    const step = (now) => {
      const p = ease(Math.min(1, (now - t0) / dur));
      current = { w: from.w + (to.w - from.w) * p, l: from.l + (to.l - from.l) * p, e: from.e + (to.e - from.e) * p, h: from.h + (to.h - from.h) * p };
      build(current); render();
      if (p < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  /* Optional interaction: drag to rotate (limited), double-click to reset */
  let dragX = null;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => { dragX = e.clientX; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => {
    if (dragX === null) return;
    yaw = clamp(yaw - (e.clientX - dragX) * 0.006, -0.75, 0.75); dragX = e.clientX;
    if (current) render();
  });
  const end = () => { dragX = null; };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('dblclick', () => {
    const y0 = yaw, t0 = performance.now();
    const step = (now) => { const p = ease(Math.min(1, (now - t0) / 450)); yaw = y0 * (1 - p); render(); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });

  function dispose() {
    cancelAnimationFrame(anim); ro.disconnect();
    clearGroup(building); clearGroup(dims);
    [ground.geometry, contact.geometry].forEach((g) => g.dispose());
    Object.values(mats).forEach((m) => m.dispose());
    [profN, profR, slatN, slatR, contactTex, envTex].forEach((t) => t.dispose());
    groundMat.dispose(); contactMat.dispose();
    renderer.dispose(); el.remove();
  }

  return { update, resize, render: () => current && render(), dispose, get dims() { return current; } };
}

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch (e) { return false; }
}

window.WSBBuildingPreview = { createBuildingPreview, PREVIEW_CONFIG, webglAvailable };
})();

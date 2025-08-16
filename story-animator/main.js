import * as THREE from 'https://cdn.skypack.dev/three@0.161.0';
import { OrbitControls } from 'https://cdn.skypack.dev/three@0.161.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://cdn.skypack.dev/three@0.161.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://cdn.skypack.dev/three@0.161.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://cdn.skypack.dev/three@0.161.0/examples/jsm/postprocessing/UnrealBloomPass.js';

const dom = {
	viewport: /** @type {HTMLCanvasElement} */ (document.getElementById('viewport')),
	letterbox: document.getElementById('letterbox'),
	status: document.getElementById('status'),
	download: /** @type {HTMLAnchorElement} */ (document.getElementById('downloadLink')),
	story: /** @type {HTMLTextAreaElement} */ (document.getElementById('storyInput')),
	generate: document.getElementById('generateBtn'),
	preview: document.getElementById('previewBtn'),
	record: document.getElementById('recordBtn'),
	style: /** @type {HTMLSelectElement} */ (document.getElementById('styleSelect')),
	fps: /** @type {HTMLInputElement} */ (document.getElementById('fpsInput')),
	durationPerScene: /** @type {HTMLInputElement} */ (document.getElementById('durationPerScene')),
	maxMinutes: /** @type {HTMLInputElement} */ (document.getElementById('maxMinutes')),
	resolution: /** @type {HTMLSelectElement} */ (document.getElementById('resolutionSelect')),
	seed: /** @type {HTMLInputElement} */ (document.getElementById('seedInput')),
	sceneList: document.getElementById('sceneList'),
	durationSummary: document.getElementById('durationSummary'),
};

const examples = {
	'example-epic': `The sun rises over a misty valley. A young hero tightens their cloak and steps onto an ancient bridge.

Wolves howl in the distance as the hero lights a torch and enters a forgotten forest temple.

A hidden chamber opens; a crystal levitates, bathing the room in golden light.`,
	'example-scifi': `A neon city flickers under rain. A hovercar darts between towers.

In a maintenance tunnel, a rogue bot guides a hacker to a glowing conduit.

A rooftop sprint ends as drones surround them under a pulsing billboard sky.`,
	'example-noir': `Streetlights smear across a rain‑soaked alley. A detective flips their collar.

Smoke coils in a dusty office as a single fan turns.

A shadow slips across a rooftop as sirens wail far below.`,
	'example-pixel': `A voxel village wakes with blocky sunbeams.

A pixelated knight jumps across floating islands.

A giant 8‑bit whale swims through the sky as stars blink.`,
	'example-fantasy': `Moonlight filters through ancient oaks. Fireflies swirl.

A stag of light leads a wanderer to a mossy stone arch.

A waterfall reveals a hidden glade bathed in gold.`,
	'example-space': `A ringed planet looms as a shuttle glides toward a station.

Inside, corridors hum; a maintenance drone maps a dark sector.

Outside, suits drift among stars, tether lines glowing.`
};

const MAX_MINUTES_LIMIT = 120;

function setStatus(text) {
	dom.status.textContent = text;
}

function seededRandom(seed) {
	let s = seed % 2147483647;
	if (s <= 0) s += 2147483646;
	return () => (s = s * 16807 % 2147483647) / 2147483647;
}

function splitIntoScenes(text) {
	const raw = text.trim().split(/\n\s*\n+/g).map(s => s.trim()).filter(Boolean);
	if (raw.length === 0) {
		// fallback: sentence-ish split
		return text.split(/(?<=[.!?])\s+/g).map(s => s.trim()).filter(Boolean);
	}
	return raw;
}

function summarizeScenes(scenes) {
	const li = scenes.map((s, i) => `<li><strong>Scene ${i + 1}:</strong> ${s.substring(0, 96)}${s.length > 96 ? '…' : ''}</li>`).join('');
	dom.sceneList.innerHTML = li;
}

function computeTotalDuration(scenes, secondsPerScene) {
	return scenes.length * secondsPerScene;
}

function updateDurationSummary(totalSeconds) {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	dom.durationSummary.textContent = `Total: ${minutes}m ${seconds}s (cap: ${MAX_MINUTES_LIMIT} minutes)`;
}

function parseResolution(value) {
	const [w, h] = value.split('x').map(Number);
	return { width: w, height: h };
}

function clampTotalDuration(seconds) {
	return Math.min(seconds, MAX_MINUTES_LIMIT * 60);
}

// Style presets map to shader/post effects and color palettes
const STYLE_PRESETS = {
	cinematic: {
		bg: 0x0b0c10,
		fog: 0x0b0c10,
		ambient: 0x404040,
		light: 0xffddaa,
		bloom: 0.5,
		palette: [0x22262f, 0x556270, 0x4ecdc4, 0xc7f464, 0xff6b6b],
		letterbox: true,
	},
	movie: {
		bg: 0x0c0d12,
		fog: 0x0c0d12,
		ambient: 0x505050,
		light: 0xffffff,
		bloom: 0.35,
		palette: [0x334, 0x557, 0x88a, 0xccd, 0xe2b714],
		letterbox: true,
	},
	pixel: {
		bg: 0x0e0f14,
		fog: 0x0e0f14,
		ambient: 0x303030,
		light: 0x88ffaa,
		bloom: 0.0,
		palette: [0x1b998b, 0xed217c, 0x2d3047, 0xfffd82, 0xff9b71],
		letterbox: false,
	},
	toon: {
		bg: 0x151922,
		fog: 0x151922,
		ambient: 0x404040,
		light: 0xfff4d6,
		bloom: 0.15,
		palette: [0x0e7c7b, 0x17bebb, 0xd4f4dd, 0xd62246, 0x4b1d3f],
		letterbox: false,
	},
	noir: {
		bg: 0x0a0a0a,
		fog: 0x0a0a0a,
		ambient: 0x202020,
		light: 0xffffff,
		bloom: 0.0,
		palette: [0x0b0b0b, 0x151515, 0x2b2b2b, 0x6b6b6b, 0xe0e0e0],
		letterbox: true,
	},
	vaporwave: {
		bg: 0x1a0f1f,
		fog: 0x1a0f1f,
		ambient: 0x402040,
		light: 0xff7eb6,
		bloom: 0.8,
		palette: [0xff7eb6, 0x7afcff, 0xfeff9c, 0xb693fe, 0x6ef3d6],
		letterbox: false,
	},
	scifi: {
		bg: 0x0b0f14,
		fog: 0x0b0f14,
		ambient: 0x204050,
		light: 0x00d1ff,
		bloom: 0.65,
		palette: [0x14213d, 0xfca311, 0xe5e5e5, 0x00d1ff, 0x2ec4b6],
		letterbox: false,
	},
	fantasy: {
		bg: 0x0b0c10,
		fog: 0x0b0c10,
		ambient: 0x304050,
		light: 0xfff2cc,
		bloom: 0.4,
		palette: [0x264653, 0x2a9d8f, 0xe9c46a, 0xf4a261, 0xe76f51],
		letterbox: true,
	},
	retro: {
		bg: 0x1a130f,
		fog: 0x1a130f,
		ambient: 0x453a31,
		light: 0xffe0b2,
		bloom: 0.2,
		palette: [0x8c564b, 0xe377c2, 0x7f7f7f, 0xbcbd22, 0x17becf],
		letterbox: false,
	},
	comic: {
		bg: 0x0f141d,
		fog: 0x0f141d,
		ambient: 0x404040,
		light: 0xffd166,
		bloom: 0.25,
		palette: [0x118ab2, 0x06d6a0, 0xef476f, 0xffd166, 0x073b4c],
		letterbox: false,
	},
	minimal: {
		bg: 0x0b0c10,
		fog: 0x0b0c10,
		ambient: 0x404040,
		light: 0xffffff,
		bloom: 0.0,
		palette: [0x2d3142, 0x4f5d75, 0xbfc0c0, 0xffffff, 0xef8354],
		letterbox: false,
	},
	human: {
		bg: 0x0d0e12,
		fog: 0x0d0e12,
		ambient: 0x505050,
		light: 0xffe4c4,
		bloom: 0.1,
		palette: [0xa3b18a, 0x588157, 0x3a5a40, 0xe5989b, 0xffd6a5],
		letterbox: true,
	},
};

function applyPresetClass(value) {
	const app = document.getElementById('app');
	Object.keys(STYLE_PRESETS).forEach(k => app.classList.remove(`preset-${k}`));
	app.classList.add(`preset-${value}`);
}

class SceneOrchestrator {
	constructor(canvas) {
		this.canvas = canvas;
		this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
		this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

		this.scene = new THREE.Scene();
		this.camera = new THREE.PerspectiveCamera(60, 16/9, 0.1, 2000);
		this.camera.position.set(6, 3, 8);
		this.controls = new OrbitControls(this.camera, canvas);
		this.controls.enableDamping = true;
		this.controls.enabled = false; // turned on in debug if desired

		this.composer = null;
		this.clock = new THREE.Clock();
		this.resizeObserver = new ResizeObserver(() => this.handleResize());
		this.resizeObserver.observe(canvas);

		this.currentPreset = STYLE_PRESETS.cinematic;
		this.objectGroup = new THREE.Group();
		this.scene.add(this.objectGroup);

		this.directional = new THREE.DirectionalLight(0xffffff, 1.2);
		this.directional.position.set(10, 10, 6);
		this.scene.add(this.directional);
		this.scene.add(new THREE.AmbientLight(0x404040, 0.8));

		this.activeAnimation = null;
	}

	setPreset(name) {
		this.currentPreset = STYLE_PRESETS[name] || STYLE_PRESETS.cinematic;
		this.scene.background = new THREE.Color(this.currentPreset.bg);
		this.scene.fog = new THREE.Fog(new THREE.Color(this.currentPreset.fog), 8, 80);
		this.directional.color = new THREE.Color(this.currentPreset.light);
		const amb = this.scene.children.find(o => o.isAmbientLight);
		if (amb) amb.color = new THREE.Color(this.currentPreset.ambient);

		if (this.composer) {
			this.composer = null;
		}
		this.composer = new EffectComposer(this.renderer);
		this.composer.addPass(new RenderPass(this.scene, this.camera));
		if (this.currentPreset.bloom > 0) {
			const size = new THREE.Vector2(this.canvas.clientWidth, this.canvas.clientHeight);
			const bloomPass = new UnrealBloomPass(size, this.currentPreset.bloom, 0.4, 0.85);
			this.composer.addPass(bloomPass);
		}
	}

	setSize(width, height) {
		this.renderer.setSize(width, height, false);
		this.camera.aspect = width / height;
		this.camera.updateProjectionMatrix();
		if (this.composer) this.composer.setSize(width, height);
	}

	handleResize() {
		const rect = this.canvas.getBoundingClientRect();
		this.setSize(rect.width, rect.height);
	}

	clearObjects() {
		while (this.objectGroup.children.length) {
			const c = this.objectGroup.children.pop();
			c.traverse?.((o) => {
				if (o.geometry) o.geometry.dispose();
				if (o.material) {
					if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
					else o.material.dispose();
				}
			});
		}
	}

	// Procedural scene based on text hints
	buildSceneFromText(text, seed) {
		this.clearObjects();
		const rand = seededRandom(seed);

		// Ground plane
		const groundGeo = new THREE.PlaneGeometry(200, 200, 1, 1);
		const groundMat = new THREE.MeshStandardMaterial({ color: palettePick(this.currentPreset.palette, rand), roughness: 0.9, metalness: 0.1 });
		const ground = new THREE.Mesh(groundGeo, groundMat);
		ground.rotation.x = -Math.PI / 2;
		ground.position.y = -0.01;
		ground.receiveShadow = true;
		this.objectGroup.add(ground);

		// Elements derived from keywords
		const lower = text.toLowerCase();
		const addMany = (count, meshFactory) => {
			for (let i = 0; i < count; i++) {
				const m = meshFactory();
				m.position.set(randRange(rand, -20, 20), 0, randRange(rand, -20, 20));
				m.rotation.y = randRange(rand, 0, Math.PI * 2);
				const s = randRange(rand, 0.5, 3.0);
				m.scale.setScalar(s);
				this.objectGroup.add(m);
			}
		};

		if (/(city|tower|neon|rooftop|alley|street)/.test(lower)) {
			addMany(80, () => createBuilding(rand, this.currentPreset.palette));
			this.camera.position.set(20, 20, 20);
		}
		if (/(forest|tree|temple|valley|mist|river)/.test(lower)) {
			addMany(120, () => createTree(rand, this.currentPreset.palette));
			this.camera.position.set(10, 10, 16);
		}
		if (/(desert|sand|dune|sun)/.test(lower)) {
			addMany(120, () => createRock(rand, this.currentPreset.palette));
			this.camera.position.set(16, 10, 16);
		}
		if (/(ocean|sea|whale|island)/.test(lower)) {
			addMany(40, () => createIsland(rand, this.currentPreset.palette));
			this.camera.position.set(16, 14, 20);
		}
		if (/(space|star|planet|drone|hover|bot)/.test(lower)) {
			addMany(60, () => createDrone(rand, this.currentPreset.palette));
			this.camera.position.set(14, 10, 18);
		}
		if (/(temple|ruin|chamber|bridge)/.test(lower)) {
			addMany(20, () => createMonument(rand, this.currentPreset.palette));
			this.camera.position.set(12, 8, 16);
		}

		// Sky light rig
		this.directional.intensity = 1.2;
		this.directional.position.set(20, 40, 20);
	}

	startAnimation(kind = 'orbit') {
		this.activeAnimation = kind;
		this.clock.start();
	}

	stopAnimation() {
		this.activeAnimation = null;
	}

	renderFrame() {
		const dt = this.clock.getDelta();
		if (this.activeAnimation) {
			const t = performance.now() / 1000;
			if (this.activeAnimation === 'orbit') {
				const radius = 24;
				this.camera.position.x = Math.cos(t * 0.15) * radius;
				this.camera.position.z = Math.sin(t * 0.15) * radius;
				this.camera.position.y = 10 + Math.sin(t * 0.5) * 2.0;
				this.camera.lookAt(0, 0, 0);
			}
			if (this.activeAnimation === 'dolly') {
				this.camera.position.z -= dt * 2.0;
			}
		}
		if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
	}
}

// Primitive generators
function palettePick(palette, rand) {
	return palette[Math.floor(rand() * palette.length)];
}
function randRange(rand, a, b) { return a + (b - a) * rand(); }

function createBuilding(rand, palette) {
	const w = randRange(rand, 1.5, 4);
	const d = randRange(rand, 1.5, 4);
	const h = randRange(rand, 4, 20);
	const geo = new THREE.BoxGeometry(w, h, d);
	const mat = new THREE.MeshStandardMaterial({ color: palettePick(palette, rand), metalness: 0.4, roughness: 0.6 });
	const mesh = new THREE.Mesh(geo, mat);
	mesh.position.y = h / 2;
	return mesh;
}
function createTree(rand, palette) {
	const trunkGeo = new THREE.CylinderGeometry(0.2, 0.4, 2, 8);
	const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7a5230, roughness: 1 });
	const trunk = new THREE.Mesh(trunkGeo, trunkMat);
	trunk.position.y = 1;
	const foliageGeo = new THREE.DodecahedronGeometry(randRange(rand, 1.5, 2.5));
	const foliageMat = new THREE.MeshStandardMaterial({ color: palettePick(palette, rand) });
	const foliage = new THREE.Mesh(foliageGeo, foliageMat);
	foliage.position.y = 2.4;
	const g = new THREE.Group();
	g.add(trunk); g.add(foliage);
	return g;
}
function createRock(rand, palette) {
	const geo = new THREE.DodecahedronGeometry(randRange(rand, 0.5, 2.5));
	const mat = new THREE.MeshStandardMaterial({ color: palettePick(palette, rand), roughness: 1 });
	const mesh = new THREE.Mesh(geo, mat);
	mesh.position.y = geo.parameters.radius || 1;
	return mesh;
}
function createIsland(rand, palette) {
	const geo = new THREE.CylinderGeometry(randRange(rand, 1.5, 4), randRange(rand, 3, 6), randRange(rand, 0.5, 1.5), 8);
	const mat = new THREE.MeshStandardMaterial({ color: palettePick(palette, rand), roughness: 0.9 });
	const mesh = new THREE.Mesh(geo, mat);
	mesh.position.y = (geo.parameters.height || 1) / 2;
	return mesh;
}
function createDrone(rand, palette) {
	const body = new THREE.Mesh(
		new THREE.DodecahedronGeometry(1.0),
		new THREE.MeshStandardMaterial({ color: palettePick(palette, rand), metalness: 0.6, roughness: 0.3 })
	);
	body.position.y = 2;
	const g = new THREE.Group();
	g.add(body);
	return g;
}
function createMonument(rand, palette) {
	const base = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 1, 12), new THREE.MeshStandardMaterial({ color: palettePick(palette, rand) }));
	const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 6, 12), new THREE.MeshStandardMaterial({ color: palettePick(palette, rand) }));
	pillar.position.y = 3.5;
	const cap = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 16), new THREE.MeshStandardMaterial({ color: palettePick(palette, rand) }));
	cap.position.y = 7;
	const g = new THREE.Group();
	g.add(base, pillar, cap);
	return g;
}

// Recording utilities (WebM via MediaRecorder)
async function recordCanvas(canvas, durationSeconds, fps) {
	const stream = canvas.captureStream(fps);
	const chunks = [];
	const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
	return await new Promise((resolve, reject) => {
		recorder.ondataavailable = e => { if (e.data && e.data.size > 0) chunks.push(e.data); };
		recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
		recorder.onerror = reject;
		recorder.start();
		setTimeout(() => recorder.stop(), durationSeconds * 1000);
	});
}

function rafLoop(fn) {
	let id;
	function tick() {
		id = requestAnimationFrame(tick);
		fn();
	}
	id = requestAnimationFrame(tick);
	return () => cancelAnimationFrame(id);
}

// App state
let orchestrator;
let stopLoop = null;
let scenes = [];

function init() {
	// Wire examples
	document.querySelectorAll('.example').forEach(btn => {
		btn.addEventListener('click', () => {
			const id = btn.getAttribute('data-id');
			dom.story.value = examples[id] || '';
		});
	});

	// Build renderer
	orchestrator = new SceneOrchestrator(dom.viewport);
	applyPresetClass(dom.style.value);
	orchestrator.setPreset(dom.style.value);
	setCanvasSizeFromResolution();
	orchestrator.handleResize();

	window.addEventListener('resize', () => orchestrator.handleResize());
	dom.style.addEventListener('change', () => {
		applyPresetClass(dom.style.value);
		orchestrator.setPreset(dom.style.value);
		dom.letterbox.classList.toggle('hidden', !STYLE_PRESETS[dom.style.value].letterbox);
	});

	dom.generate.addEventListener('click', onGenerate);
	dom.preview.addEventListener('click', onPreview);
	dom.record.addEventListener('click', onRecord);

	// Defaults
	dom.story.value = examples['example-epic'];
	onGenerate();
	dom.letterbox.classList.toggle('hidden', !STYLE_PRESETS[dom.style.value].letterbox);
}

function setCanvasSizeFromResolution() {
	const { width, height } = parseResolution(dom.resolution.value);
	dom.viewport.width = width;
	dom.viewport.height = height;
	dom.viewport.style.width = '100%';
	dom.viewport.style.height = '100%';
}

function onGenerate() {
	const text = dom.story.value.trim();
	if (!text) { setStatus('Please enter a story or choose an example.'); return; }
	scenes = splitIntoScenes(text);
	summarizeScenes(scenes);
	const secondsPerScene = Math.max(1, Math.min(120, parseInt(dom.durationPerScene.value || '8', 10)));
	let totalSeconds = computeTotalDuration(scenes, secondsPerScene);
	const cap = Math.min(MAX_MINUTES_LIMIT, parseInt(dom.maxMinutes.value || '120', 10)) * 60;
	if (totalSeconds > cap) totalSeconds = cap;
	updateDurationSummary(totalSeconds);
	setStatus(`Generated ${scenes.length} scenes.`);
}

async function onPreview() {
	if (!scenes.length) { onGenerate(); if (!scenes.length) return; }
	setStatus('Preview: building scenes...');
	const rand = seededRandom(parseInt(dom.seed.value || '0', 10));
	const secondsPerScene = Math.max(1, Math.min(120, parseInt(dom.durationPerScene.value || '8', 10)));
	
	stopLoop?.();
	let current = 0;
	orchestrator.setPreset(dom.style.value);
	dom.letterbox.classList.toggle('hidden', !STYLE_PRESETS[dom.style.value].letterbox);
	const playScene = (index) => {
		const txt = scenes[index];
		orchestrator.buildSceneFromText(txt, Math.floor(rand() * 1e6));
		orchestrator.startAnimation('orbit');
	};
	playScene(current);

	let elapsed = 0;
	stopLoop = rafLoop(() => {
		orchestrator.renderFrame();
		elapsed += orchestrator.clock.getDelta();
		if (elapsed >= secondsPerScene) {
			elapsed = 0;
			current = (current + 1) % scenes.length;
			playScene(current);
		}
	});
	setStatus('Previewing.');
}

async function onRecord() {
	if (!scenes.length) { onGenerate(); if (!scenes.length) return; }
	const fps = Math.max(12, Math.min(60, parseInt(dom.fps.value || '30', 10)));
	const secondsPerScene = Math.max(1, Math.min(120, parseInt(dom.durationPerScene.value || '8', 10)));
	const capSeconds = Math.min(MAX_MINUTES_LIMIT, parseInt(dom.maxMinutes.value || '120', 10)) * 60;
	const totalSecondsRaw = scenes.length * secondsPerScene;
	const totalSeconds = clampTotalDuration(Math.min(totalSecondsRaw, capSeconds));
	if (totalSeconds <= 0) { setStatus('Nothing to render.'); return; }

	setStatus(`Rendering ${scenes.length} scenes (${totalSeconds}s @ ${fps}fps)...`);
	dom.download.classList.add('hidden');

	// Deterministic playback
	const rand = seededRandom(parseInt(dom.seed.value || '0', 10));
	let current = 0;
	let elapsedInScene = 0;
	let elapsedTotal = 0;
	orchestrator.setPreset(dom.style.value);
	dom.letterbox.classList.toggle('hidden', !STYLE_PRESETS[dom.style.value].letterbox);
	const playScene = (index) => {
		const txt = scenes[index];
		orchestrator.buildSceneFromText(txt, Math.floor(rand() * 1e6));
		orchestrator.startAnimation('orbit');
	};
	playScene(current);

	// Drive frames at desired FPS
	const intervalMs = 1000 / fps;
	let lastTime = performance.now();
	let frameAccumulator = 0;
	const manualLoop = () => {
		const now = performance.now();
		const deltaMs = now - lastTime;
		lastTime = now;
		frameAccumulator += deltaMs;
		while (frameAccumulator >= intervalMs) {
			frameAccumulator -= intervalMs;
			orchestrator.renderFrame();
			elapsedInScene += intervalMs / 1000;
			elapsedTotal += intervalMs / 1000;
			if (elapsedInScene >= secondsPerScene) {
				elapsedInScene = 0;
				current = (current + 1) % scenes.length;
				playScene(current);
			}
			if (elapsedTotal >= totalSeconds) {
				return false;
			}
		}
		return true;
	};

	let rafId;
	const pump = () => {
		if (manualLoop()) rafId = requestAnimationFrame(pump);
	};
	pump();

	try {
		const blob = await recordCanvas(dom.viewport, totalSeconds, fps);
		cancelAnimationFrame(rafId);
		setStatus('Render complete. Preparing download...');
		const url = URL.createObjectURL(blob);
		dom.download.href = url;
		dom.download.classList.remove('hidden');
		dom.download.click();
	} catch (err) {
		console.error(err);
		setStatus('Recording failed. Your browser may not support MediaRecorder with the chosen settings.');
	}
}

init();
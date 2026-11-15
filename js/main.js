/* =====================================================================
   OPERACIÓN EXTRACCIÓN – Videojuego FPS 3D (Three.js)
   Curso: Computación Gráfica y Visual – UPN – T3
   ---------------------------------------------------------------------
   Secciones del código:
     1. Configuración general
     2. Escena, cámara, renderizador e iluminación
     3. Construcción del mundo 3D (escenario + colisionadores)
     4. Carga de modelos GLB (armas y zombi)
     5. Jugador: cámara FPS, movimiento WASD y colisiones
     6. Sistema de armas y municiones
     7. Disparos con raycasting
     8. Zombis: máquina de estados (inactivo / activo / muerto)
     9. Objetos coleccionables (munición y adrenalina)
    10. Progresión, victoria, Game Over y reinicio
    11. HUD, sonido y bucle principal
   ===================================================================== */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/* ============================ 1. CONFIGURACIÓN ============================ */
const CONFIG = {
  velocidadJugador: 6.0,       // m/s
  multiplicadorAdrenalina: 1.6,
  duracionAdrenalina: 8,       // s
  radioJugador: 0.45,
  alturaOjos: 1.65,
  sensibilidadMouse: 0.0022,
  radioContactoZombi: 1.0,     // distancia a la que el zombi "atrapa" al jugador
  vidaZombi: 2,                // RF07: dos puntos de resistencia
  municionPorCaja: { pistola: 6, rifle: 3 },
  radioExtraccion: 4,
  posicionInicio: new THREE.Vector3(0, 0, 2),
  posicionExtraccion: new THREE.Vector3(0, 0, -226),
};

// Tipos de zombi: la distancia de activación (rango) es configurable (RF05)
const EMISIVO_ZOMBI = 0x1c2a14;   // leve brillo para distinguirlos en la oscuridad
const TIPOS_ZOMBI = {
  normal:   { velocidad: 2.2, rango: 15, escala: 1.0 },
  corredor: { velocidad: 4.2, rango: 20, escala: 0.92 }, // más rápido (RF11)
};

// Dos armas GLB con contador de munición independiente (RF01, RF02)
const ARMAS = [
  { id: 'pistola', nombre: 'Pistola 9mm', archivo: 'models/pistola.glb',
    municionInicial: 12, alcance: 45, retroceso: 0.06,
    posicion: new THREE.Vector3(0.2, -0.2, -0.42), escala: 0.85 },
  { id: 'rifle', nombre: 'Rifle de precisión', archivo: 'models/rifle.glb',
    municionInicial: 6, alcance: 100, retroceso: 0.12,
    posicion: new THREE.Vector3(0.2, -0.2, -0.4), escala: 0.75 },
];

// Distribución estratégica de zombis por zonas (RF11)
const ZOMBIS_NIVEL = [
  // Calle principal
  { x: -5, z: -25, tipo: 'normal' }, { x: 6, z: -32, tipo: 'normal' },
  { x: 0, z: -45, tipo: 'normal' },  { x: -7, z: -55, tipo: 'normal' },
  { x: 7, z: -62, tipo: 'normal' },
  // Plaza
  { x: -15, z: -80, tipo: 'normal' }, { x: 14, z: -82, tipo: 'normal' },
  { x: 0, z: -89, tipo: 'corredor' }, { x: -20, z: -100, tipo: 'normal' },
  { x: 18, z: -98, tipo: 'normal' },  { x: -6, z: -108, tipo: 'corredor' },
  { x: 8, z: -112, tipo: 'normal' },  { x: 0, z: -117, tipo: 'normal' },
  // Callejón (paso obligado y estrecho)
  { x: 0, z: -130, tipo: 'normal' },  { x: -2, z: -140, tipo: 'normal' },
  { x: 2, z: -149, tipo: 'corredor' }, { x: 0, z: -156, tipo: 'normal' },
  // Zona industrial
  { x: -13, z: -170, tipo: 'normal' }, { x: 11, z: -175, tipo: 'corredor' },
  { x: 0, z: -180, tipo: 'normal' },  { x: -14, z: -196, tipo: 'corredor' },
  { x: 13, z: -197, tipo: 'normal' }, { x: 0, z: -205, tipo: 'corredor' },
  // Guardianes del helipuerto
  { x: -7, z: -219, tipo: 'corredor' }, { x: 7, z: -221, tipo: 'corredor' },
  { x: -3, z: -232, tipo: 'normal' },
];

const OBJETOS_NIVEL = [
  { x: 7, z: -12, tipo: 'municion' },  { x: -8, z: -50, tipo: 'municion' },
  { x: -22, z: -95, tipo: 'municion' }, { x: 21, z: -116, tipo: 'municion' },
  { x: 2.5, z: -138, tipo: 'municion' }, { x: 15, z: -165, tipo: 'municion' },
  { x: -15, z: -206, tipo: 'municion' },
  { x: 22, z: -75, tipo: 'adrenalina' }, { x: -16, z: -182, tipo: 'adrenalina' },
];

const ZONAS = [ // para mostrar en qué parte del recorrido está el jugador
  { hasta: -10, nombre: 'Refugio (inicio)' }, { hasta: -70, nombre: 'Calle principal' },
  { hasta: -120, nombre: 'Plaza central' }, { hasta: -160, nombre: 'Callejón' },
  { hasta: -210, nombre: 'Zona industrial' }, { hasta: -999, nombre: 'Helipuerto de extracción' },
];

/* ================= 2. ESCENA, CÁMARA, RENDERIZADOR, LUCES ================= */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0f17);
scene.fog = new THREE.FogExp2(0x0b0f17, 0.018);

// Cámara en perspectiva (FOV 75°). Jerarquía: jugador (yaw) -> cámara (pitch) -> arma
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 400);
const jugador = new THREE.Object3D();       // rota en Y (izquierda/derecha)
jugador.add(camera);                        // la cámara rota en X (arriba/abajo)
camera.position.y = CONFIG.alturaOjos;
scene.add(jugador);

scene.add(new THREE.HemisphereLight(0x7a8aa8, 0x2a2a2a, 1.4));
const luna = new THREE.DirectionalLight(0x9fb3d9, 1.0);
luna.castShadow = true;
luna.shadow.mapSize.set(2048, 2048);
Object.assign(luna.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 150 });
scene.add(luna, luna.target);

/* ===================== 3. CONSTRUCCIÓN DEL MUNDO 3D ===================== */
const colisionadores = [];   // cajas AABB (THREE.Box3) que bloquean al jugador y a los zombis
const obstaculosRay = [];    // mallas que bloquean las balas

function texturaVentanas() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2a2d33'; g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 256; y += 32) for (let x = 8; x < 128; x += 30) {
    const r = Math.random();
    g.fillStyle = r < 0.12 ? '#e8c46a' : r < 0.2 ? '#6a5a3a' : '#111418';
    g.fillRect(x, y, 18, 20);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const texVentanas = [texturaVentanas(), texturaVentanas(), texturaVentanas()];

/** Crea una caja sólida entre (x1,z1) y (x2,z2) con altura h y la registra como colisionador. */
function bloque(x1, z1, x2, z2, h, material, bloqueaBalas = true) {
  const ancho = Math.abs(x2 - x1), largo = Math.abs(z2 - z1);
  const malla = new THREE.Mesh(new THREE.BoxGeometry(ancho, h, largo), material);
  malla.position.set((x1 + x2) / 2, h / 2, (z1 + z2) / 2);
  malla.castShadow = malla.receiveShadow = true;
  scene.add(malla);
  colisionadores.push(new THREE.Box3().setFromObject(malla));
  if (bloqueaBalas) obstaculosRay.push(malla);
  return malla;
}

/** Fila de edificios con alturas variadas entre z1 y z2 (borde del recorrido). */
function edificios(x1, x2, z1, z2) {
  const paso = 12;
  for (let z = z1; z > z2; z -= paso) {
    const zf = Math.max(z - paso, z2);
    const h = 8 + Math.random() * 14;
    const tex = texVentanas[Math.floor(Math.random() * 3)].clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, Math.abs(z - zf) / 5), h / 8);
    bloque(x1, z, x2, zf, h, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
  }
}

const matAuto = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: 0.4 });
function auto(x, z, girado = false, color = 0x6b2222) {
  const [w, l] = girado ? [4.2, 2] : [2, 4.2];
  bloque(x - w / 2, z - l / 2, x + w / 2, z + l / 2, 1.1, matAuto(color));
  const cabina = new THREE.Mesh(new THREE.BoxGeometry(girado ? 2.2 : 1.8, 0.7, girado ? 1.8 : 2.2), matAuto(0x222831));
  cabina.position.set(x, 1.45, z); cabina.castShadow = true; scene.add(cabina);
}
const matBarricada = new THREE.MeshStandardMaterial({ color: 0x7a6a48, roughness: 1 });
const matContenedor = [0x2f5d8a, 0x8a3a2f, 0x3f7a3a, 0x8a7a2f].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.3 }));
function contenedor(x, z, girado, i) {
  const [w, l] = girado ? [6, 2.5] : [2.5, 6];
  bloque(x - w / 2, z - l / 2, x + w / 2, z + l / 2, 2.6, matContenedor[i % 4]);
}

function cartel(texto, color, x, y, z, alto = 1.5) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = 'bold 64px Arial';
  c.width = Math.ceil(g.measureText(texto).width) + 60; c.height = 110;   // el ancho se ajusta al texto
  g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, c.width, c.height);
  g.font = 'bold 64px Arial'; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(texto, c.width / 2, c.height / 2);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), fog: false }));
  s.position.set(x, y, z); s.scale.set(alto * c.width / c.height, alto, 1); scene.add(s);
  return s;
}

function farola(x, z) {
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 5), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  poste.position.set(x, 2.5, z); scene.add(poste);
  const foco = new THREE.Mesh(new THREE.SphereGeometry(0.25), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
  foco.position.set(x, 5, z); scene.add(foco);
}

function construirMundo() {
  // Suelo (asfalto) y líneas de carretera
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(120, 300),
    new THREE.MeshStandardMaterial({ color: 0x1d1f22, roughness: 1 }));
  suelo.rotation.x = -Math.PI / 2; suelo.position.z = -115; suelo.receiveShadow = true;
  scene.add(suelo); obstaculosRay.push(suelo);
  const matLinea = new THREE.MeshBasicMaterial({ color: 0x8a8a6a });
  for (let z = -12; z > -68; z -= 6) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 3), matLinea);
    l.rotation.x = -Math.PI / 2; l.position.set(0, 0.01, z); scene.add(l);
  }

  // --- Límites del recorrido (edificios) ---
  bloque(-14, 9, 14, 8, 6, new THREE.MeshStandardMaterial({ color: 0x3a3a3a })); // muro trasero del refugio
  edificios(-36, -10, 8, -70);  edificios(10, 36, 8, -70);    // calle principal (x: -10..10)
  edificios(-36, -25, -70, -120); edificios(25, 36, -70, -120); // plaza (x: -25..25)
  edificios(-36, -4, -120, -160); edificios(4, 36, -120, -160); // callejón (x: -4..4)
  edificios(-36, -18, -160, -236); edificios(18, 36, -160, -236); // industrial + helipuerto (x: -18..18)
  bloque(-36, -235, 36, -237, 8, new THREE.MeshStandardMaterial({ color: 0x444a52 })); // muro final

  // --- Calle principal: autos abandonados y barricada ---
  auto(-6, -20); auto(5, -40, false, 0x224466); auto(-3, -60, true, 0x555555);
  bloque(-10, -66, -3, -67, 1.2, matBarricada); bloque(3, -66, 10, -67, 1.2, matBarricada);
  for (let z = -10; z > -70; z -= 15) { farola(-9, z); farola(9, z - 7); }

  // --- Plaza: fuente central y autos ---
  const fuente = bloque(-3, -98, 3, -92, 0.9, new THREE.MeshStandardMaterial({ color: 0x777b80 }));
  fuente.geometry = new THREE.CylinderGeometry(3, 3.2, 0.9, 24);
  const estatua = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.6, 3.5), new THREE.MeshStandardMaterial({ color: 0x6e7468 }));
  estatua.position.set(0, 2.2, -95); estatua.castShadow = true; scene.add(estatua);
  auto(-12, -85, false, 0x445522); auto(15, -108, true, 0x663311);
  const fuego = new THREE.PointLight(0xff7a2a, 25, 25); fuego.position.set(10, 1.5, -90); scene.add(fuego);
  const barril = bloque(9.6, -90.4, 10.4, -89.6, 1, new THREE.MeshStandardMaterial({ color: 0x552200, emissive: 0x331100 }));
  barril.geometry = new THREE.CylinderGeometry(0.4, 0.4, 1, 12);

  // --- Callejón: barricadas en zigzag (obliga a maniobrar) ---
  bloque(-4, -135, 1, -136, 1.3, matBarricada); bloque(-1, -145, 4, -146, 1.3, matBarricada);
  const luzCallejon = new THREE.PointLight(0xff2222, 12, 18); luzCallejon.position.set(0, 4, -140); scene.add(luzCallejon);

  // --- Zona industrial: contenedores ---
  contenedor(-8, -172, false, 0); contenedor(6, -185, true, 1);
  contenedor(-10, -192, false, 2); contenedor(12, -205, true, 3); contenedor(-4, -165, true, 1);
  const luzInd = new THREE.PointLight(0x88aaff, 20, 30); luzInd.position.set(0, 6, -185); scene.add(luzInd);

  // --- Zona de inicio ---
  const anilloInicio = new THREE.Mesh(new THREE.RingGeometry(2.5, 3, 40), new THREE.MeshBasicMaterial({ color: 0x33ff66, side: THREE.DoubleSide }));
  anilloInicio.rotation.x = -Math.PI / 2; anilloInicio.position.set(0, 0.02, 2); scene.add(anilloInicio);
  cartel('INICIO – REFUGIO', '#66ff88', 0, 4, 7.5, 1.2);
  cartel('↑ EXTRACCIÓN 230 m', '#ffd166', 0, 4.5, -14, 1.1);
  const luzInicio = new THREE.PointLight(0x44ff77, 10, 15); luzInicio.position.set(0, 3, 2); scene.add(luzInicio);
}

/* ---- Zona de extracción: helipuerto con baliza pulsante ---- */
let baliza, luzExtraccion;
function construirExtraccion() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#2a2a2a'; g.beginPath(); g.arc(128, 128, 126, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ffd166'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 110, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#ffffff'; g.font = 'bold 150px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 128, 136);
  const p = CONFIG.posicionExtraccion;
  const heli = new THREE.Mesh(new THREE.CircleGeometry(CONFIG.radioExtraccion, 48),
    new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(c) }));
  heli.rotation.x = -Math.PI / 2; heli.position.set(p.x, 0.03, p.z); heli.receiveShadow = true; scene.add(heli);
  baliza = new THREE.Mesh(new THREE.CylinderGeometry(CONFIG.radioExtraccion, CONFIG.radioExtraccion, 40, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x33ff88, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, fog: false }));
  baliza.position.set(p.x, 20, p.z); scene.add(baliza);
  luzExtraccion = new THREE.PointLight(0x33ff88, 30, 30); luzExtraccion.position.set(p.x, 4, p.z); scene.add(luzExtraccion);
  cartel('ZONA DE EXTRACCIÓN', '#5dff8a', p.x, 6, p.z, 1.6);
}

/* ======================= 4. CARGA DE MODELOS GLB ======================= */
const loader = new GLTFLoader();
const cargarGLB = (url) => new Promise((ok, error) => loader.load(url, (gltf) => ok(gltf.scene), undefined, error));

/* =========== 5. JUGADOR: CÁMARA FPS, MOVIMIENTO Y COLISIONES =========== */
const teclas = {};
let yaw = 0, pitch = 0;
let velocidadActual = CONFIG.velocidadJugador;
let tiempoAdrenalina = 0;
let distanciaRecorrida = 0;

document.addEventListener('keydown', (e) => { teclas[e.code] = true; manejarTecla(e); });
document.addEventListener('keyup', (e) => { teclas[e.code] = false; });

// Orientación con el mouse (Pointer Lock API)
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== renderer.domElement || estado !== 'jugando') return;
  yaw -= e.movementX * CONFIG.sensibilidadMouse;
  pitch -= e.movementY * CONFIG.sensibilidadMouse;
  pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, pitch));
  jugador.rotation.y = yaw;   // giro horizontal
  camera.rotation.x = pitch;  // giro vertical
});

/** Empuja un círculo (posición x,z con radio r) fuera de todas las cajas AABB. */
function resolverColisiones(pos, radio) {
  for (const caja of colisionadores) {
    const cx = Math.max(caja.min.x, Math.min(pos.x, caja.max.x)); // punto más cercano de la caja
    const cz = Math.max(caja.min.z, Math.min(pos.z, caja.max.z));
    const dx = pos.x - cx, dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < radio * radio) {
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2), empuje = radio - d;
        pos.x += (dx / d) * empuje; pos.z += (dz / d) * empuje;
      } else { // centro dentro de la caja: salir por el lado más cercano
        const opciones = [[caja.min.x - radio - pos.x, 0], [caja.max.x + radio - pos.x, 0],
                          [0, caja.min.z - radio - pos.z], [0, caja.max.z + radio - pos.z]];
        opciones.sort((a, b) => Math.abs(a[0] + a[1]) - Math.abs(b[0] + b[1]));
        pos.x += opciones[0][0]; pos.z += opciones[0][1];
      }
    }
  }
}

const vAdelante = new THREE.Vector3(), vDerecha = new THREE.Vector3(), vMov = new THREE.Vector3();
function actualizarJugador(dt) {
  // Vectores adelante/derecha en el plano XZ según el ángulo yaw
  vAdelante.set(-Math.sin(yaw), 0, -Math.cos(yaw));
  vDerecha.set(Math.cos(yaw), 0, -Math.sin(yaw));
  vMov.set(0, 0, 0);
  if (teclas.KeyW) vMov.add(vAdelante);   // W: avanzar
  if (teclas.KeyS) vMov.sub(vAdelante);   // S: retroceder
  if (teclas.KeyD) vMov.add(vDerecha);    // D: derecha
  if (teclas.KeyA) vMov.sub(vDerecha);    // A: izquierda

  if (tiempoAdrenalina > 0) {
    tiempoAdrenalina -= dt;
    velocidadActual = CONFIG.velocidadJugador * CONFIG.multiplicadorAdrenalina;
  } else velocidadActual = CONFIG.velocidadJugador;

  const moviendo = vMov.lengthSq() > 0;
  if (moviendo) {
    vMov.normalize().multiplyScalar(velocidadActual * dt);
    jugador.position.add(vMov);
    distanciaRecorrida += vMov.length();
    resolverColisiones(jugador.position, CONFIG.radioJugador);
  }
  animarArma(dt, moviendo);
}

/* ===================== 6. SISTEMA DE ARMAS Y MUNICIONES ===================== */
const soporteArma = new THREE.Group();     // hijo de la cámara: el arma sigue sus rotaciones
camera.add(soporteArma);
const modelosArma = [];                    // modelos GLB de cada arma
const municion = {};                       // contador independiente por arma
let armaActual = 0;
let cambioArma = 0;                        // temporizador de la animación de cambio
let armaPendiente = -1;
let retroceso = 0, tiempoBalanceo = 0;
const destello = new THREE.PointLight(0xffaa33, 0, 6);
const fogonazo = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffdd66 }));
soporteArma.add(destello, fogonazo);

function prepararArmas(modelos) {
  modelos.forEach((m, i) => {
    m.scale.setScalar(ARMAS[i].escala);
    m.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.material.fog = false; } });
    m.visible = i === 0;
    soporteArma.add(m);
    modelosArma.push(m);
  });
  soporteArma.position.copy(ARMAS[0].posicion);
}

function seleccionarArma(indice) {           // RF01: tecla 1 -> pistola, tecla 2 -> rifle
  if (indice === armaActual && armaPendiente === -1) return;
  armaPendiente = indice;
  cambioArma = 0.35;                         // baja el arma, cambia el modelo y la sube
  sonido('cambio');
}

function animarArma(dt, moviendo) {
  if (cambioArma > 0) {
    cambioArma -= dt;
    if (armaPendiente !== -1 && cambioArma < 0.175) {   // a mitad de la animación se cambia el modelo
      modelosArma[armaActual].visible = false;
      armaActual = armaPendiente; armaPendiente = -1;
      modelosArma[armaActual].visible = true;
      actualizarHUD();
    }
  }
  const bajada = cambioArma > 0 ? Math.sin((cambioArma / 0.35) * Math.PI) * 0.35 : 0;
  if (moviendo) tiempoBalanceo += dt * velocidadActual * 1.6;
  const base = ARMAS[armaActual].posicion;
  retroceso = Math.max(0, retroceso - dt * 0.6);
  soporteArma.position.set(
    base.x + Math.sin(tiempoBalanceo) * 0.012,
    base.y - bajada + Math.abs(Math.cos(tiempoBalanceo)) * 0.012,
    base.z + retroceso);
  soporteArma.rotation.x = retroceso * 2.5;
  fogonazo.position.set(0, 0.03, armaActual === 1 ? -0.65 : -0.25);
  destello.position.copy(fogonazo.position);
  if (destello.intensity > 0) destello.intensity = Math.max(0, destello.intensity - dt * 120);
  fogonazo.visible = destello.intensity > 0.5;
}

/* ======================= 7. DISPAROS CON RAYCASTING ======================= */
const raycaster = new THREE.Raycaster();
const CENTRO_PANTALLA = new THREE.Vector2(0, 0);

// RF01: 'mousedown' se dispara una sola vez por pulsación -> un clic = un disparo.
// Mantener el botón presionado NO genera más eventos, por lo tanto no hay disparo automático.
document.addEventListener('mousedown', (e) => {
  if (e.button !== 0 || estado !== 'jugando' || document.pointerLockElement !== renderer.domElement) return;
  disparar();
});

function disparar() {
  if (cambioArma > 0) return;                         // no se dispara mientras se cambia de arma
  const arma = ARMAS[armaActual];
  if (municion[arma.id] <= 0) {                       // RF02: bloqueo al agotar munición
    sonido('vacio');
    mostrarAviso('¡Sin munición! Busca una caja de munición amarilla');
    return;
  }
  municion[arma.id]--;                                // RF02: cada disparo consume 1 bala
  actualizarHUD();
  retroceso = arma.retroceso; destello.intensity = 40; sonido(arma.id);

  // Rayo desde el centro de la cámara (la mira) hacia adelante
  raycaster.setFromCamera(CENTRO_PANTALLA, camera);
  raycaster.far = arma.alcance;
  const vivos = zombis.filter((z) => z.estado !== 'muerto').map((z) => z.modelo);
  const impactos = raycaster.intersectObjects([...vivos, ...obstaculosRay], true);
  if (impactos.length === 0) return;

  const zombi = buscarZombi(impactos[0].object); // solo cuenta si lo PRIMERO que toca el rayo es un zombi
  if (zombi) { zombi.recibirImpacto(); marcarImpacto(); }
  else chispa(impactos[0].point);
}

function buscarZombi(objeto) {        // sube por la jerarquía hasta encontrar el zombi dueño de la malla
  for (let o = objeto; o; o = o.parent) if (o.userData.zombi) return o.userData.zombi;
  return null;
}

const chispas = [];
function chispa(punto) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffcc66 }));
  m.position.copy(punto); m.userData.vida = 0.25; scene.add(m); chispas.push(m);
}

/* ============= 8. ZOMBIS: MÁQUINA DE ESTADOS (INACTIVO/ACTIVO/MUERTO) ============= */
const zombis = [];
let bajas = 0;

class Zombi {
  constructor(plantilla, datos) {
    this.datos = datos;
    this.tipo = TIPOS_ZOMBI[datos.tipo];
    this.modelo = plantilla.clone(true);
    this.materiales = [];
    this.modelo.traverse((o) => {
      if (o.isMesh) {
        o.material = o.material.clone();          // material propio para el destello de daño
        o.castShadow = true;
        this.materiales.push(o.material);
      }
    });
    this.modelo.userData.zombi = this;            // enlace malla -> objeto Zombi (para el raycasting)
    this.partes = {};
    for (const n of ['brazoIzq', 'brazoDer', 'piernaIzq', 'piernaDer', 'cabeza'])
      this.partes[n] = this.modelo.getObjectByName(n);
    if (datos.tipo === 'corredor') this.materiales.forEach((m) => m.color.multiplyScalar(0.75));
    scene.add(this.modelo);
    this.reiniciar();
  }

  reiniciar() {
    this.vida = CONFIG.vidaZombi;                 // RF07: 2 puntos de resistencia
    this.estado = 'inactivo';                     // RF05: comienza inactivo
    this.tiempo = Math.random() * 10;
    this.tiempoDanio = 0;
    this.tiempoMuerto = 0;
    this.modelo.position.set(this.datos.x, 0, this.datos.z);
    this.modelo.rotation.set(0, Math.random() * Math.PI * 2, 0);
    this.modelo.scale.setScalar(this.tipo.escala);
    this.modelo.visible = true;
    this.materiales.forEach((m) => m.emissive.setHex(EMISIVO_ZOMBI));
  }

  recibirImpacto() {
    if (this.estado === 'muerto') return;
    this.vida -= 1;                               // RF07: cada impacto válido resta 1
    this.tiempoDanio = 0.15;
    sonido('impacto');
    if (this.vida <= 0) this.morir();             // muere exactamente al 2.º impacto
  }

  morir() {
    this.estado = 'muerto';                       // deja de perseguir y de atacar
    bajas++;
    sonido('muerte');
    actualizarHUD();
  }

  actualizar(dt, posJugador) {
    this.tiempo += dt;
    // Destello rojo al recibir daño
    if (this.tiempoDanio > 0) {
      this.tiempoDanio -= dt;
      this.materiales.forEach((m) => m.emissive.setHex(this.tiempoDanio > 0 ? 0xaa0000 : EMISIVO_ZOMBI));
    }

    if (this.estado === 'muerto') {               // animación de caída y luego desaparece
      this.tiempoMuerto += dt;
      this.modelo.rotation.x = Math.max(-Math.PI / 2, -this.tiempoMuerto * 4);
      if (this.tiempoMuerto > 4) this.modelo.position.y -= dt * 0.4;
      if (this.tiempoMuerto > 7) this.modelo.visible = false;
      return;
    }

    const dx = posJugador.x - this.modelo.position.x;
    const dz = posJugador.z - this.modelo.position.z;
    const distancia = Math.hypot(dx, dz);

    if (this.estado === 'inactivo') {
      // RF05: permanece quieto (solo se balancea) hasta que el jugador entre en su rango
      this.partes.cabeza.rotation.z = Math.sin(this.tiempo * 0.8) * 0.15;
      this.partes.brazoIzq.rotation.x = this.partes.brazoDer.rotation.x = Math.sin(this.tiempo) * 0.05;
      if (distancia < this.tipo.rango) {
        this.estado = 'activo';
        sonido('gruñido');
      }
      return;
    }

    // ---- Estado ACTIVO: persecución ----
    this.modelo.rotation.y = Math.atan2(dx, dz);              // mira hacia el jugador
    if (distancia > 0.01) {
      const paso = Math.min(this.tipo.velocidad * dt, distancia);
      this.modelo.position.x += (dx / distancia) * paso;
      this.modelo.position.z += (dz / distancia) * paso;
      resolverColisiones(this.modelo.position, 0.4);          // no atraviesa paredes
    }
    // Animación procedural: brazos al frente y piernas caminando
    const f = this.tiempo * this.tipo.velocidad * 3;
    this.partes.brazoIzq.rotation.x = -1.4 + Math.sin(f) * 0.15;
    this.partes.brazoDer.rotation.x = -1.4 - Math.sin(f) * 0.15;
    this.partes.piernaIzq.rotation.x = Math.sin(f) * 0.6;
    this.partes.piernaDer.rotation.x = -Math.sin(f) * 0.6;

    // RF09: contacto con el jugador -> GAME OVER
    if (distancia < CONFIG.radioContactoZombi) gameOver();
  }
}

function separarZombis() {   // evita que los zombis activos se superpongan
  for (let i = 0; i < zombis.length; i++) for (let j = i + 1; j < zombis.length; j++) {
    const a = zombis[i], b = zombis[j];
    if (a.estado !== 'activo' || b.estado !== 'activo') continue;
    const dx = b.modelo.position.x - a.modelo.position.x, dz = b.modelo.position.z - a.modelo.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 0 && d < 0.8) {
      const e = (0.8 - d) / 2;
      a.modelo.position.x -= (dx / d) * e; a.modelo.position.z -= (dz / d) * e;
      b.modelo.position.x += (dx / d) * e; b.modelo.position.z += (dz / d) * e;
    }
  }
}

/* ============ 9. OBJETOS COLECCIONABLES (MUNICIÓN Y ADRENALINA) ============ */
const objetos = [];
function texturaCaja(texto, fondo, colorTexto) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = fondo; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = '#222'; g.lineWidth = 8; g.strokeRect(4, 4, 120, 120);
  g.fillStyle = colorTexto; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(texto, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const matMunicion = new THREE.MeshStandardMaterial({ map: texturaCaja('AMMO', '#d9a520', '#222'), emissive: 0x332200 });
const matAdrenalina = new THREE.MeshStandardMaterial({ map: texturaCaja('⚡', '#2a8adf', '#fff'), emissive: 0x002244 });

function crearObjetos() {
  for (const d of OBJETOS_NIVEL) {
    const malla = d.tipo === 'municion'
      ? new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.5), matMunicion)
      : new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.6, 16), matAdrenalina);
    malla.castShadow = true;
    malla.position.set(d.x, 0.8, d.z);
    scene.add(malla);
    objetos.push({ ...d, malla, recogido: false });
  }
}

function actualizarObjetos(dt, t) {
  for (const o of objetos) {
    if (o.recogido) continue;
    o.malla.rotation.y += dt * 1.5;                       // gira y flota para llamar la atención
    o.malla.position.y = 0.8 + Math.sin(t * 2 + o.x) * 0.15;
    const d = Math.hypot(jugador.position.x - o.x, jugador.position.z - o.z);
    if (d < 1.3) recoger(o);
  }
}

function recoger(o) {
  o.recogido = true; o.malla.visible = false; sonido('recoger');
  if (o.tipo === 'municion') {                           // RF02: única forma de recuperar munición
    municion.pistola += CONFIG.municionPorCaja.pistola;
    municion.rifle += CONFIG.municionPorCaja.rifle;
    mostrarAviso(`+${CONFIG.municionPorCaja.pistola} balas de pistola  |  +${CONFIG.municionPorCaja.rifle} balas de rifle`);
  } else {                                               // RF10: potenciador de velocidad
    tiempoAdrenalina = CONFIG.duracionAdrenalina;
    mostrarAviso(`¡Adrenalina! Velocidad aumentada durante ${CONFIG.duracionAdrenalina} s`);
  }
  actualizarHUD();
}

/* ============ 10. PROGRESIÓN, VICTORIA, GAME OVER Y REINICIO ============ */
let estado = 'cargando';   // cargando | menu | jugando | pausa | gameover | victoria
let tiempoPartida = 0;

function comprobarExtraccion() {
  const p = CONFIG.posicionExtraccion;
  if (Math.hypot(jugador.position.x - p.x, jugador.position.z - p.z) < CONFIG.radioExtraccion) victoria();
}

function finalizar(nuevoEstado, idPantalla, idResumen) {
  estado = nuevoEstado;
  document.exitPointerLock();
  mostrarPantalla(idPantalla);
  document.getElementById(idResumen).textContent =
    `Tiempo: ${formatearTiempo(tiempoPartida)}  |  Zombis eliminados: ${bajas}/${zombis.length}  |  ` +
    `Distancia recorrida: ${distanciaRecorrida.toFixed(0)} m`;
}
function gameOver() { if (estado === 'jugando') { sonido('gameover'); finalizar('gameover', 'pantalla-gameover', 'resumen-derrota'); } }
function victoria() { if (estado === 'jugando') { sonido('victoria'); finalizar('victoria', 'pantalla-victoria', 'resumen-victoria'); } }

function reiniciarPartida() {
  jugador.position.copy(CONFIG.posicionInicio);
  yaw = 0; pitch = 0; jugador.rotation.y = 0; camera.rotation.x = 0;
  ARMAS.forEach((a) => { municion[a.id] = a.municionInicial; });   // munición limitada al inicio
  modelosArma.forEach((m, i) => { m.visible = i === 0; });
  armaActual = 0; armaPendiente = -1; cambioArma = 0;
  zombis.forEach((z) => z.reiniciar());
  objetos.forEach((o) => { o.recogido = false; o.malla.visible = true; });
  bajas = 0; tiempoPartida = 0; tiempoAdrenalina = 0; distanciaRecorrida = 0;
  actualizarHUD();
}

function comenzar() {
  if (estado === 'gameover' || estado === 'victoria' || estado === 'menu') reiniciarPartida();
  estado = 'jugando';
  mostrarPantalla(null);
  renderer.domElement.requestPointerLock();
  iniciarAudio();
}

function manejarTecla(e) {
  if (estado === 'jugando') {
    if (e.code === 'Digit1' || e.code === 'Numpad1') seleccionarArma(0);
    if (e.code === 'Digit2' || e.code === 'Numpad2') seleccionarArma(1);
  }
  if (e.code === 'KeyR' && (estado === 'gameover' || estado === 'victoria')) comenzar();
}

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== renderer.domElement && estado === 'jugando') {
    estado = 'pausa'; mostrarPantalla('pantalla-pausa');
  }
});
document.getElementById('btn-jugar').onclick = comenzar;
document.getElementById('btn-continuar').onclick = () => {
  estado = 'jugando'; mostrarPantalla(null); renderer.domElement.requestPointerLock();
};
document.getElementById('btn-reiniciar-1').onclick = comenzar;
document.getElementById('btn-reiniciar-2').onclick = comenzar;

/* ======================= 11. HUD, SONIDO Y BUCLE ======================= */
const $ = (id) => document.getElementById(id);
function mostrarPantalla(id) {
  for (const p of ['pantalla-inicio', 'pantalla-pausa', 'pantalla-gameover', 'pantalla-victoria'])
    $(p).classList.toggle('oculto', p !== id);
  $('hud').classList.toggle('oculto', id === 'pantalla-inicio');
}
function formatearTiempo(s) { return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`; }

function actualizarHUD() {
  const arma = ARMAS[armaActual];
  $('nombre-arma').textContent = arma.nombre;
  $('balas').textContent = municion[arma.id];
  $('municion-actual').classList.toggle('vacio', municion[arma.id] === 0);
  ARMAS.forEach((a, i) => {
    $(`mun-${i}`).textContent = municion[a.id];
    $(`slot-${i}`).classList.toggle('activo', i === armaActual);
  });
  $('bajas').textContent = `${bajas}/${zombis.length}`;
}

function actualizarHUDcontinuo() {
  const p = CONFIG.posicionExtraccion;
  $('distancia').textContent = `Distancia a la extracción: ${Math.hypot(jugador.position.x - p.x, jugador.position.z - p.z).toFixed(0)} m`;
  $('zona-actual').textContent = 'Zona: ' + ZONAS.find((z) => jugador.position.z > z.hasta).nombre;
  $('tiempo').textContent = formatearTiempo(tiempoPartida);
  const activos = zombis.filter((z) => z.estado === 'activo');
  $('activos').textContent = activos.length;
  const cercania = activos.reduce((min, z) => Math.min(min, z.modelo.position.distanceTo(jugador.position)), Infinity);
  $('peligro').style.opacity = cercania < 6 ? (1 - cercania / 6).toFixed(2) : 0;
  $('potenciador').classList.toggle('oculto', tiempoAdrenalina <= 0);
  $('potenciador-t').textContent = Math.ceil(Math.max(0, tiempoAdrenalina));
}

let temporizadorAviso;
function mostrarAviso(texto) {
  $('aviso').textContent = texto; $('aviso').classList.add('visible');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => $('aviso').classList.remove('visible'), 1800);
}
function marcarImpacto() {
  $('marcador-impacto').classList.add('visible');
  setTimeout(() => $('marcador-impacto').classList.remove('visible'), 90);
}

// Sonidos sintetizados con Web Audio API (no requieren archivos externos)
let audio = null;
function iniciarAudio() { if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); }
function tono(frec, dur, tipo = 'square', vol = 0.2, frecFinal = null) {
  if (!audio) return;
  const o = audio.createOscillator(), g = audio.createGain(), t = audio.currentTime;
  o.type = tipo; o.frequency.setValueAtTime(frec, t);
  if (frecFinal) o.frequency.exponentialRampToValueAtTime(frecFinal, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur);
}
function ruido(dur, vol = 0.4) {
  if (!audio) return;
  const buf = audio.createBuffer(1, audio.sampleRate * dur, audio.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 3;
  const s = audio.createBufferSource(), g = audio.createGain();
  s.buffer = buf; g.gain.value = vol; s.connect(g).connect(audio.destination); s.start();
}
function sonido(n) {
  switch (n) {
    case 'pistola': ruido(0.15, 0.35); tono(180, 0.1, 'square', 0.1, 60); break;
    case 'rifle': ruido(0.35, 0.5); tono(110, 0.25, 'sawtooth', 0.15, 40); break;
    case 'vacio': tono(900, 0.04, 'square', 0.08); break;
    case 'cambio': tono(400, 0.05, 'triangle', 0.08); setTimeout(() => tono(600, 0.05, 'triangle', 0.08), 120); break;
    case 'impacto': tono(220, 0.08, 'sawtooth', 0.15, 90); break;
    case 'muerte': tono(160, 0.6, 'sawtooth', 0.15, 40); break;
    case 'gruñido': tono(90 + Math.random() * 30, 0.7, 'sawtooth', 0.07, 60); break;
    case 'recoger': tono(660, 0.08, 'sine', 0.2); setTimeout(() => tono(990, 0.12, 'sine', 0.2), 80); break;
    case 'gameover': tono(300, 1.2, 'sawtooth', 0.2, 50); break;
    case 'victoria': [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tono(f, 0.3, 'triangle', 0.2), i * 150)); break;
  }
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const reloj = new THREE.Clock();
function bucle() {
  requestAnimationFrame(bucle);
  const dt = Math.min(reloj.getDelta(), 0.05);
  const t = reloj.elapsedTime;

  // Elementos decorativos animados siempre
  if (baliza) { baliza.material.opacity = 0.1 + Math.sin(t * 3) * 0.05; luzExtraccion.intensity = 25 + Math.sin(t * 3) * 10; }
  for (let i = chispas.length - 1; i >= 0; i--) {
    chispas[i].userData.vida -= dt;
    if (chispas[i].userData.vida <= 0) { scene.remove(chispas[i]); chispas.splice(i, 1); }
  }

  if (estado === 'jugando') {                // la lógica solo avanza durante la partida
    tiempoPartida += dt;
    actualizarJugador(dt);
    for (const z of zombis) { z.actualizar(dt, jugador.position); if (estado !== 'jugando') break; }
    separarZombis();
    actualizarObjetos(dt, t);
    comprobarExtraccion();
    actualizarHUDcontinuo();
  }
  // La luz de la luna (y sus sombras) sigue al jugador
  luna.position.set(jugador.position.x + 20, 40, jugador.position.z + 10);
  luna.target.position.copy(jugador.position);
  renderer.render(scene, camera);
}

/* ============================ INICIALIZACIÓN ============================ */
async function iniciar() {
  construirMundo();
  construirExtraccion();
  crearObjetos();
  try {
    const [pistola, rifle, zombi] = await Promise.all([
      cargarGLB(ARMAS[0].archivo), cargarGLB(ARMAS[1].archivo), cargarGLB('models/zombi.glb'),
    ]);
    prepararArmas([pistola, rifle]);
    for (const datos of ZOMBIS_NIVEL) zombis.push(new Zombi(zombi, datos));
    reiniciarPartida();
    estado = 'menu';
    $('estado-carga').textContent = `Modelos cargados: 2 armas GLB + ${zombis.length} zombis GLB`;
    $('btn-jugar').disabled = false;
  } catch (err) {
    console.error(err);
    $('estado-carga').innerHTML = '<b style="color:#f55">Error al cargar los modelos GLB.</b> ' +
      'Ejecuta el juego desde un servidor local (ver README), no abriendo el archivo directamente.';
  }
  bucle();
}
iniciar();

// Acceso de depuración desde la consola del navegador (útil para pruebas)
window.juego = { CONFIG, zombis, municion, jugador, objetos, get estado() { return estado; },
  disparar, seleccionarArma, reiniciarPartida, comenzar };

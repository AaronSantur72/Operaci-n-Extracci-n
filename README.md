Operación Extracción – FPS 3D

Videojuego de disparos en primera persona (FPS) desarrollado con **Three.js (WebGL)** para el curso
**Computación Gráfica y Visual – UPN (T3)**.

> La ciudad ha sido invadida por zombis. Eres uno de los últimos sobrevivientes: atraviesa la calle
> principal, la plaza central, el callejón y la zona industrial, administra tu munición y llega al
> **helipuerto de extracción** antes de ser atrapado.

Controles

| Control | Acción |
|---|---|
| **W** | Avanzar |
| **S** | Retroceder |
| **A** | Desplazarse a la izquierda |
| **D** | Desplazarse a la derecha |
| **Mouse** | Orientar la cámara |
| **Clic izquierdo** | Disparar una vez (no hay disparo automático) |
| **1** | Seleccionar Pistola 9mm |
| **2** | Seleccionar Rifle de precisión |
| **R** | Reiniciar tras *Game Over* o victoria |
| **ESC** | Pausa |

Instalación y ejecución

El juego **no requiere instalar dependencias**: Three.js está incluido en la carpeta `lib/`.
Como los módulos ES y los modelos `.glb` se cargan con `fetch`, **debe ejecutarse desde un servidor local**
(abrir `index.html` con doble clic no funciona por las restricciones CORS del navegador).

**Opción 1 – Python**
```bash
git clone https://github.com/USUARIO/operacion-extraccion.git
cd operacion-extraccion
python -m http.server 8000
```
Abrir en el navegador: <http://localhost:8000>

**Opción 2 – Node.js**
```bash
npx serve .
```

**Opción 3 – VS Code:** instalar la extensión *Live Server*, clic derecho en `index.html` → *Open with Live Server*.

Navegadores recomendados: Chrome, Edge o Firefox actualizados.

### Regenerar los modelos GLB (opcional)
Los modelos ya vienen incluidos en `models/`. Para volver a generarlos:
```bash
pip install trimesh
python herramientas/generar_modelos.py
```
Mecánicas implementadas

| Requerimiento | Implementación |
|---|---|
| RF01 Armas | 2 armas GLB (`pistola.glb`, `rifle.glb`); teclas 1/2 con animación de cambio; un disparo por evento `mousedown`. |
| RF02 Munición | Contador independiente por arma (pistola 12, rifle 6). No se dispara en 0. Solo se recupera con cajas amarillas *AMMO* (+6 pistola / +3 rifle). |
| RF03 Mundo 3D | Ciudad nocturna de ~240 m: Refugio → Calle principal → Plaza → Callejón → Zona industrial → Helipuerto. |
| RF04 Zombis GLB | `zombi.glb` con piezas articuladas (brazos, piernas, cabeza) animadas por código. |
| RF05 Comportamiento | Máquina de estados `inactivo → activo → muerto`. Rango de detección configurable (normal 15 m, corredor 20 m). |
| RF06 Cámara FPS | Pointer Lock API; jerarquía jugador (yaw) → cámara (pitch) → arma. Balanceo y retroceso del arma. |
| RF07 Disparos | `THREE.Raycaster` desde el centro de la pantalla. 2 puntos de vida; muere exactamente al 2.º impacto. |
| RF08 Progresión | Inicio marcado, 5 zonas con enemigos y zona de extracción con mensaje **¡MISIÓN COMPLETADA!** |
| RF09 Game Over | Al contacto con un zombi se muestra **GAME OVER** y se detiene la lógica. Reinicio con R. |
| RF10 Coleccionables | Cajas de munición y potenciador de velocidad *Adrenalina* (8 s). |
| RF11 Dificultad | 26 zombis distribuidos por zonas, zombis *corredores* más rápidos, munición limitada, callejón con barricadas en zigzag. |

Estructura del proyecto
```
operacion-extraccion/
├── index.html               # Página principal, HUD y pantallas
├── css/estilos.css          # Estilos de la interfaz
├── js/main.js               # Toda la lógica del juego (comentada por secciones)
├── models/
│   ├── pistola.glb          # Arma 1
│   ├── rifle.glb            # Arma 2
│   └── zombi.glb            # Enemigo
├── lib/                     # Three.js r170 + GLTFLoader (local)
└── herramientas/generar_modelos.py   # Script que genera los GLB
```

Fuentes y recursos externos
- **Three.js r170** – Licencia MIT – <https://threejs.org>
- **GLTFLoader / BufferGeometryUtils** – ejemplos oficiales de Three.js, licencia MIT.
- **trimesh** (Python) – Licencia MIT – usado solo para generar los modelos GLB.
- Modelos 3D (`pistola.glb`, `rifle.glb`, `zombi.glb`): **creación propia** mediante el script `herramientas/generar_modelos.py`.
- Texturas (ventanas, cajas, helipuerto) y sonidos: **generados por código** (Canvas 2D y Web Audio API).

Video demostrativo
Enlace: *(agregar enlace de YouTube / Drive)*

Juego en línea (opcional)
Enlace: https://aaronsantur72.github.io/Operaci-n-Extracci-n/

Autor
Luis Aaron Santur Vega – Universidad Privada del Norte – Computación Gráfica y Visual – 2026

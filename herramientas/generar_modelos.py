"""
Generador de modelos GLB para "Operación Extracción".
Crea: models/pistola.glb, models/rifle.glb, models/zombi.glb
Uso:  pip install trimesh   ->   python herramientas/generar_modelos.py
Cada modelo está formado por piezas (nodos con nombre) para poder
animarlas desde Three.js (por ejemplo, brazos y piernas del zombi).
"""
import os
import numpy as np
import trimesh

SALIDA = os.path.join(os.path.dirname(__file__), "..", "models")
os.makedirs(SALIDA, exist_ok=True)


def caja(tam, color, centro=(0, 0, 0)):
    """Crea una caja de tamaño (x,y,z) con color RGBA, desplazada a 'centro'."""
    m = trimesh.creation.box(extents=tam)
    m.apply_translation(centro)
    m.visual.face_colors = np.tile(np.array(color, dtype=np.uint8), (len(m.faces), 1))
    return m


def cilindro(radio, largo, color, centro=(0, 0, 0)):
    """Cilindro orientado a lo largo del eje Z (hacia adelante = -Z)."""
    m = trimesh.creation.cylinder(radius=radio, height=largo, sections=16)
    m.apply_translation(centro)
    m.visual.face_colors = np.tile(np.array(color, dtype=np.uint8), (len(m.faces), 1))
    return m


def trasladar(x, y, z):
    return trimesh.transformations.translation_matrix([x, y, z])


def exportar(escena, nombre):
    ruta = os.path.join(SALIDA, nombre)
    escena.export(ruta)
    print("Generado:", os.path.abspath(ruta))


# ---------------- PISTOLA (apunta hacia -Z) ----------------
NEGRO = (35, 35, 40, 255)
GRIS = (90, 92, 98, 255)
MADERA = (110, 70, 40, 255)
pistola = trimesh.Scene()
pistola.add_geometry(caja((0.07, 0.07, 0.30), GRIS, (0, 0.03, -0.05)), node_name="corredera")
pistola.add_geometry(caja((0.065, 0.05, 0.26), NEGRO, (0, -0.02, -0.04)), node_name="armazon")
pistola.add_geometry(caja((0.06, 0.16, 0.08), NEGRO, (0, -0.11, 0.06)), node_name="empunadura")
pistola.add_geometry(cilindro(0.015, 0.06, NEGRO, (0, 0.03, -0.22)), node_name="canon")
pistola.add_geometry(caja((0.02, 0.025, 0.02), (200, 60, 40, 255), (0, 0.075, -0.18)), node_name="mira")
exportar(pistola, "pistola.glb")

# ---------------- RIFLE (apunta hacia -Z) ----------------
VERDE = (60, 75, 50, 255)
rifle = trimesh.Scene()
rifle.add_geometry(caja((0.08, 0.10, 0.55), VERDE, (0, 0, -0.10)), node_name="cuerpo")
rifle.add_geometry(cilindro(0.02, 0.45, NEGRO, (0, 0.01, -0.60)), node_name="canon")
rifle.add_geometry(caja((0.07, 0.12, 0.28), MADERA, (0, -0.03, 0.30)), node_name="culata")
rifle.add_geometry(caja((0.05, 0.16, 0.07), NEGRO, (0, -0.12, -0.12)), node_name="cargador")
rifle.add_geometry(caja((0.06, 0.13, 0.06), NEGRO, (0, -0.10, 0.08)), node_name="empunadura")
rifle.add_geometry(cilindro(0.03, 0.18, NEGRO, (0, 0.10, -0.10)), node_name="mira_telescopica")
exportar(rifle, "rifle.glb")

# ---------------- ZOMBI (mira hacia +Z, pies en y=0) ----------------
PIEL = (110, 150, 95, 255)
CAMISA = (95, 60, 55, 255)
PANTALON = (45, 50, 75, 255)
OJO = (230, 30, 20, 255)
zombi = trimesh.Scene()
zombi.add_geometry(caja((0.55, 0.65, 0.30), CAMISA), node_name="torso", transform=trasladar(0, 1.25, 0))
zombi.add_geometry(caja((0.38, 0.38, 0.36), PIEL), node_name="cabeza", transform=trasladar(0, 1.78, 0))
zombi.add_geometry(caja((0.08, 0.06, 0.02), OJO, (-0.09, 0.03, 0.18)), node_name="ojoIzq", transform=trasladar(0, 1.78, 0))
zombi.add_geometry(caja((0.08, 0.06, 0.02), OJO, (0.09, 0.03, 0.18)), node_name="ojoDer", transform=trasladar(0, 1.78, 0))
# Brazos: la geometría cuelga desde el hombro (pivote en el origen del nodo)
zombi.add_geometry(caja((0.16, 0.65, 0.16), PIEL, (0, -0.30, 0)), node_name="brazoIzq", transform=trasladar(-0.36, 1.52, 0))
zombi.add_geometry(caja((0.16, 0.65, 0.16), PIEL, (0, -0.30, 0)), node_name="brazoDer", transform=trasladar(0.36, 1.52, 0))
# Piernas: pivote en la cadera
zombi.add_geometry(caja((0.20, 0.92, 0.22), PANTALON, (0, -0.46, 0)), node_name="piernaIzq", transform=trasladar(-0.14, 0.92, 0))
zombi.add_geometry(caja((0.20, 0.92, 0.22), PANTALON, (0, -0.46, 0)), node_name="piernaDer", transform=trasladar(0.14, 0.92, 0))
exportar(zombi, "zombi.glb")

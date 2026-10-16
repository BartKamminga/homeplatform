import * as THREE from 'three'
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { ROOM_KINDS, roofHeight } from '../model.js'
import { panelDims } from './plan/SolarPanelShape.jsx'

// Dak in 3D: de dakvlakken (ruimtes van soort roof) gedrapeerd over het dakprofiel van de hoogste verdieping met een
// dak, met de zonnepanelen erop. Alles staat in plattegrond-coördinaten (bovenaanzicht), net als in de 2D-weergave;
// daardoor liggen panelen en vlakken precies zoals op de plattegrond, alleen opgetild naar de dakhoogte.

export const isRoofFloor = (f) => f.rooms.length > 0 && f.rooms.every((r) => r.kind === 'roof')

// Verdieping waarvan het dakprofiel (roof.line) de hoogte bepaalt.
export function roofBase(home) {
  return [...home.floors].filter((f) => f.roof?.line?.length).sort((a, b) => b.level - a.level)[0] || null
}

// Absolute hoogte van het dakoppervlak boven x; een plat dak (tilt 0) ligt op de voet van het dak.
function surface(base, flat) {
  return (x) => base.level + (flat ? 0 : roofHeight(base.roof, x))
}

// Vlakke vorm in plattegrond-coördinaten, per hoekpunt opgetild naar het dakoppervlak.
function drape(points, height, lift) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)))
  const geo = new THREE.ShapeGeometry(shape)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = -pos.getY(i)
    pos.setXYZ(i, x, height(x) + lift, z)
  }
  geo.computeVertexNormals()
  return geo
}

function panelCorners(device) {
  const [w, h] = panelDims(device)
  const [px, pz] = device.meta.position
  const a = ((device.meta.panel?.rotation || 0) * Math.PI) / 180
  return [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
    .map(([x, z]) => [px + x * Math.cos(a) - z * Math.sin(a), pz + x * Math.sin(a) + z * Math.cos(a)])
}

// Bouwt het dak; geeft de groep, de klikbare vlakken (userData.roomId) en de panelen (voor live kleuren).
export function buildRoof(floor, base, { selectedId, selMat, lineMat }) {
  const group = new THREE.Group()
  const planes = []
  const panels = []
  for (const room of floor.rooms) {
    if (!room.polygon?.length) continue
    const height = surface(base, room.meta?.tilt === 0)
    const mat = room.id === selectedId ? selMat : new THREE.MeshStandardMaterial({
      color: room.meta?.floor_color || ROOM_KINDS.roof.color, roughness: 0.85, side: THREE.DoubleSide,
    })
    const plane = new THREE.Mesh(drape(room.polygon, height, 0.02), mat)
    plane.userData.roomId = room.id
    planes.push(plane)
    group.add(plane)
    const edge = room.polygon.map(([x, z]) => new THREE.Vector3(x, height(x) + 0.025, z))
    group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(edge), lineMat))

    const placed = room.devices.filter((d) => d.kind === 'solar_panel' && d.meta?.position)
    for (const d of placed) {
      const corners = panelCorners(d)
      const mesh = new THREE.Mesh(drape(corners, height, 0.06),
        new THREE.MeshStandardMaterial({ color: '#8e979a', roughness: 0.35, metalness: 0.2, side: THREE.DoubleSide }))
      mesh.userData.device = d
      panels.push(mesh)
      group.add(mesh)
      const rim = corners.map(([x, z]) => new THREE.Vector3(x, height(x) + 0.065, z))
      group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(rim), new THREE.LineBasicMaterial({ color: '#d6dadb' })))
    }

    const [cx, cz] = room.label_at || room.polygon.reduce(([a, b], [x, z]) => [a + x / room.polygon.length, b + z / room.polygon.length], [0, 0])
    const lbl = document.createElement('div')
    lbl.className = 'mh-lbl'
    lbl.innerHTML = `${room.name}${placed.length ? `<small>${placed.length} panels</small>` : ''}`
    const o = new CSS2DObject(lbl)
    o.position.set(cx, height(cx) + 0.3, cz)
    group.add(o)
  }
  return { group, planes, panels }
}

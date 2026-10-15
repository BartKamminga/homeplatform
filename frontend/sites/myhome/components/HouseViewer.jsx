import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'
import { ROOM_KINDS, fmtArea, isOpen, liveSummary, panelWatt, roofHeight } from '../model.js'
import { panelColor } from './plan/SolarPanelShape.jsx'
import { buildRoof, isRoofFloor, roofBase } from './roof3d.js'

// 3D-weergave van het huismodel. x = links→rechts op de plattegrond, z = tuin (min) → straat (plus).
// Props: home (export uit de API), floor ('all' of floor-key), explode (m), highWalls, showRoof,
// selectedId, onSelect(roomId|null).

const cssVar = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback

function centroid(p) {
  return p.reduce(([a, b], [x, z]) => [a + x / p.length, b + z / p.length], [0, 0])
}

function bounds(home) {
  const pts = home.floors.flatMap((f) => f.rooms.flatMap((r) => r.polygon || []))
  if (!pts.length) return { cx: 0, cz: 0, size: 10, minZ: -5, maxZ: 5 }
  const xs = pts.map((p) => p[0])
  const zs = pts.map((p) => p[1])
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)]
  return { cx: (minX + maxX) / 2, cz: (minZ + maxZ) / 2, size: Math.max(maxX - minX, maxZ - minZ), minZ, maxZ }
}

function wallsFor(room, floor, high, material, lineMat) {
  const g = new THREE.Group()
  if (isOpen(room.kind) || !room.polygon) return g
  const h = (x) => Math.min(high ? 2.6 : 1.0, floor.roof ? roofHeight(floor.roof, x) : Infinity)
  const pos = []
  room.polygon.forEach(([x1, z1], i) => {
    const [x2, z2] = room.polygon[(i + 1) % room.polygon.length]
    pos.push(x1, 0, z1, x2, 0, z2, x2, h(x2), z2, x1, 0, z1, x2, h(x2), z2, x1, h(x1), z1)
  })
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.computeVertexNormals()
  g.add(new THREE.Mesh(geo, material))
  const top = room.polygon.map(([x, z]) => new THREE.Vector3(x, h(x) + 0.005, z))
  g.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(top), lineMat))
  return g
}

function roofMesh(roof, material) {
  const line = [...roof.line].sort((a, b) => a[0] - b[0])
  const pts = [[line[0][0], 0], ...line, [line[line.length - 1][0], 0]]
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)))
  const mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: roof.z_to - roof.z_from, bevelEnabled: false }), material)
  mesh.position.z = roof.z_from
  return mesh
}

export default function HouseViewer({ home, floor, explode, highWalls, showRoof, selectedId, onSelect, live = {} }) {
  const hostRef = useRef(null)
  const labelsRef = useRef(null)
  const stateRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect
  // Alleen opnieuw opbouwen als er echt een ruimte aan/uit gaat, niet bij elke poll van de live-status.
  const litKey = (home?.floors || []).flatMap((f) => f.rooms)
    .filter((r) => r.devices.some((d) => liveSummary(live[d.id]).on)).map((r) => r.id).join(',')

  // Renderer, camera en controls: eenmalig per mount.
  useEffect(() => {
    const host = hostRef.current
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    host.prepend(renderer.domElement)
    const labelRenderer = new CSS2DRenderer({ element: labelsRef.current })
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.maxPolarAngle = Math.PI * 0.49
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f8c, 1.6))
    const sun = new THREE.DirectionalLight(0xffffff, 1.4)
    sun.position.set(-8, 20, 6)
    scene.add(sun)
    const content = new THREE.Group()
    scene.add(content)

    const resize = () => {
      const w = host.clientWidth
      const h = host.clientHeight
      renderer.setSize(w, h)
      labelRenderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    const ray = new THREE.Raycaster()
    let down = null
    const onDown = (e) => { down = [e.clientX, e.clientY] }
    const onUp = (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return
      const r = renderer.domElement.getBoundingClientRect()
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera)
      const pickable = stateRef.current.floorMeshes.filter((m) => m.parent.visible)
      const hit = ray.intersectObjects(pickable, false)[0]
      onSelectRef.current?.(hit ? hit.object.userData.roomId : null)
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)
    renderer.setAnimationLoop(() => {
      controls.update()
      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)
    })
    stateRef.current = { scene, camera, controls, content, floorMeshes: [], groups: {}, panels: [], framed: null }

    return () => {
      renderer.setAnimationLoop(null)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      labelsRef.current && (labelsRef.current.innerHTML = '')
    }
  }, [])

  // Scene opbouwen uit het model.
  useEffect(() => {
    const s = stateRef.current
    if (!s || !home) return
    s.content.traverse((o) => { o.geometry?.dispose?.() })
    s.content.clear()
    if (labelsRef.current) labelsRef.current.innerHTML = ''
    s.floorMeshes = []
    s.groups = {}
    s.panels = []

    const bg = cssVar('--color-background', '#f4f5f3')
    const fg = cssVar('--color-text-muted', '#5d6a6c')
    s.scene.background = new THREE.Color(bg)
    const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(bg).lerp(new THREE.Color('#d8d4cc'), 0.6), side: THREE.DoubleSide, roughness: 0.95 })
    const lineMat = new THREE.LineBasicMaterial({ color: fg })
    const roofMat = new THREE.MeshStandardMaterial({ color: '#6b4a3a', transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide })
    const selMat = new THREE.MeshStandardMaterial({ color: '#e0952f', emissive: '#e0952f', emissiveIntensity: 0.3, side: THREE.DoubleSide })

    const b = bounds(home)
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(b.size * 4, b.size * 4), new THREE.MeshStandardMaterial({ color: new THREE.Color(bg).offsetHSL(0, 0, -0.04) }))
    ground.rotation.x = -Math.PI / 2
    ground.position.set(b.cx, -0.02, b.cz)
    s.content.add(ground)
    const garden = home.garden_orientation ? ` · ${home.garden_orientation}` : ''
    for (const [txt, z] of [[`GARDEN${garden}`, b.minZ - 2.5], ['STREET', b.maxZ + 2.5]]) {
      const d = document.createElement('div')
      d.className = 'mh-lbl compass'
      d.textContent = txt
      const o = new CSS2DObject(d)
      o.position.set(b.cx, 0, z)
      s.content.add(o)
    }

    home.floors.filter((f) => !isRoofFloor(f)).forEach((f, i) => {
      const g = new THREE.Group()
      // Tuin blijft op maaiveld; alleen verdiepingen schuiven uit elkaar.
      g.userData = { key: f.key, level: f.level, index: f.rooms.length && f.rooms.every((r) => r.kind === 'garden') ? 0 : i }
      s.groups[f.key] = g
      s.content.add(g)
      for (const room of f.rooms) {
        if (!room.polygon?.length) continue
        const shape = new THREE.Shape(room.polygon.map(([x, z]) => new THREE.Vector2(x, -z)))
        const lit = litKey.split(',').includes(room.id)
        const floorColor = room.meta?.floor_color || ROOM_KINDS[room.kind]?.color || '#dddddd'
        const floorMat = room.id === selectedId ? selMat : new THREE.MeshStandardMaterial({
          color: floorColor, roughness: 0.9, side: THREE.DoubleSide,
          emissive: lit ? '#ffc35a' : '#000000', emissiveIntensity: lit ? 0.45 : 0,
        })
        const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape), floorMat)
        mesh.rotation.x = -Math.PI / 2
        mesh.position.y = 0.01
        mesh.userData.roomId = room.id
        s.floorMeshes.push(mesh)
        g.add(mesh)
        const roomWallMat = room.meta?.wall_color
          ? new THREE.MeshStandardMaterial({ color: room.meta.wall_color, side: THREE.DoubleSide, roughness: 0.95 })
          : wallMat
        g.add(wallsFor(room, f, highWalls, roomWallMat, lineMat))
        const [cx, cz] = room.label_at || centroid(room.polygon)
        const d = document.createElement('div')
        d.className = 'mh-lbl'
        d.innerHTML = `${room.name}<small>${fmtArea(room.area_m2)}${room.devices.length ? ` · ${room.devices.length} dev.` : ''}</small>`
        const o = new CSS2DObject(d)
        o.position.set(cx, 0.15, cz)
        g.add(o)
      }
      if (f.roof?.line?.length && showRoof) g.add(roofMesh(f.roof, roofMat))
    })

    // Dakvlakken + zonnepanelen; schuift mee met de verdieping waarvan het dakprofiel komt.
    const base = roofBase(home)
    const roofFloor = home.floors.find(isRoofFloor)
    if (base && roofFloor) {
      const roof = buildRoof(roofFloor, base, { selectedId, selMat, lineMat })
      roof.group.userData = { key: roofFloor.key, level: 0, index: s.groups[base.key].userData.index, roof: true }
      s.groups[roofFloor.key] = roof.group
      s.content.add(roof.group)
      s.floorMeshes.push(...roof.planes)
      s.panels = roof.panels
      s.paintPanels?.()
    }

    if (s.framed !== home.id) {
      s.camera.position.set(b.cx - b.size * 1.3, b.size * 1.9, b.cz + b.size * 2.4)
      s.controls.target.set(b.cx, 3, b.cz)
      s.framed = home.id
    }
  }, [home, highWalls, showRoof, selectedId, litKey])

  // Verdiepingfilter en uit-elkaar-schuiven.
  useEffect(() => {
    const s = stateRef.current
    if (!s) return
    for (const g of Object.values(s.groups)) {
      const visible = g.userData.roof ? (floor === 'all' ? showRoof : floor === g.userData.key) : floor === 'all' || floor === g.userData.key
      g.visible = visible
      g.position.y = floor === 'all' ? g.userData.level + g.userData.index * explode : 0
      g.traverse((o) => { if (o.isCSS2DObject) o.element.hidden = !visible })
    }
  }, [home, floor, explode, highWalls, showRoof, selectedId, litKey])

  // Panelen kleuren naar het live vermogen (zonder de scene opnieuw op te bouwen).
  useEffect(() => {
    const s = stateRef.current
    if (!s) return
    s.paintPanels = () => {
      const max = Math.max(1, ...s.panels.map((m) => panelWatt(m.userData.device, live) || 0))
      for (const m of s.panels) m.material.color.setStyle(panelColor(panelWatt(m.userData.device, live), max))
    }
    s.paintPanels()
  }, [live])

  return (
    <div className="mh-viewer" ref={hostRef}>
      <div className="mh-viewer-labels" ref={labelsRef} />
      <div className="mh-viewer-hint">drag = rotate · scroll = zoom · click a room</div>
    </div>
  )
}

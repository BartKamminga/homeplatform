import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js'

// 3D map: every layer is a ring, dimensions are hubs on their ring, elements orbit their dimension.
// Props: cat, elements, links, focus (Set of element ids in the chosen system, or null), selectedId,
// allLabels, onSelect(id | null).

const R = 10
const LAYER_Y = [6.5, 2.2, -2.2, -6.5]
const cssVar = (name) => getComputedStyle(document.querySelector('.ks') || document.documentElement).getPropertyValue(name).trim() || '#888'

function layout(cat, elements) {
  const pos = {}
  cat.layers.forEach((layer, li) => {
    const dims = cat.dimensions.filter((d) => d.layer === layer.key)
    dims.forEach((d, i) => {
      const a = (i / dims.length) * Math.PI * 2 + li * 0.9
      pos[d.key] = new THREE.Vector3(Math.cos(a) * R, LAYER_Y[li], Math.sin(a) * R)
    })
  })
  const byDim = {}
  elements.forEach((e) => { if (e.dimension) (byDim[e.dimension] ||= []).push(e) })
  const golden = Math.PI * (3 - Math.sqrt(5))
  Object.entries(byDim).forEach(([dim, list]) => {
    const radius = 1.6 + Math.sqrt(list.length) * 0.45
    list.forEach((e, i) => {
      const y = 1 - ((i + 0.5) / list.length) * 2
      const r = Math.sqrt(1 - y * y)
      pos[e.id] = pos[dim].clone().add(new THREE.Vector3(Math.cos(golden * i) * r * radius, y * radius * 0.55, Math.sin(golden * i) * r * radius))
    })
  })
  return pos
}

export default function MapScene({ cat, elements, links, focus, selectedId, allLabels, onSelect }) {
  const hostRef = useRef(null)
  const stateRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  // Build the scene whenever the data changes
  useEffect(() => {
    const host = hostRef.current
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    host.appendChild(renderer.domElement)
    const labelRenderer = new CSS2DRenderer()
    labelRenderer.domElement.className = 'ks-map-labels'
    host.appendChild(labelRenderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 300)
    camera.position.set(20, 12, 26)
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.autoRotate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    controls.autoRotateSpeed = 0.4
    controls.addEventListener('start', () => { controls.autoRotate = false })
    scene.add(new THREE.AmbientLight(0xffffff, 0.8))
    const sun = new THREE.DirectionalLight(0xffffff, 0.6)
    sun.position.set(10, 20, 15)
    scene.add(sun)

    const pos = layout(cat, elements)
    const color = (layer) => new THREE.Color(cssVar(`--ks-${layer}`))
    const sphere = new THREE.SphereGeometry(1, 24, 16)

    cat.layers.forEach((layer, li) => {
      const ring = new THREE.Mesh(new THREE.RingGeometry(R - 4, R + 4, 96),
        new THREE.MeshBasicMaterial({ color: color(layer.key), transparent: true, opacity: 0.06, side: THREE.DoubleSide, depthWrite: false }))
      ring.rotation.x = -Math.PI / 2
      ring.position.y = LAYER_Y[li]
      scene.add(ring)
    })

    const nodes = {}
    const pickables = []
    const addLabel = (text, cls, p, lift) => {
      const div = document.createElement('div')
      div.className = cls
      div.textContent = text
      const obj = new CSS2DObject(div)
      obj.position.copy(p).add(new THREE.Vector3(0, lift, 0))
      scene.add(obj)
      return div
    }
    cat.dimensions.forEach((d) => {
      const m = new THREE.MeshStandardMaterial({ color: color(d.layer), roughness: 0.45, transparent: true })
      const mesh = new THREE.Mesh(sphere, m)
      mesh.scale.setScalar(0.7)
      mesh.position.copy(pos[d.key])
      mesh.userData = { id: `dim:${d.key}` }
      scene.add(mesh)
      pickables.push(mesh)
      const label = addLabel(d.name, 'ks-map-dim', pos[d.key], 1.1)
      label.style.setProperty('--c', `var(--ks-${d.layer})`)
      nodes[`dim:${d.key}`] = { mesh, label, base: 1 }
    })
    elements.forEach((e) => {
      if (!pos[e.id]) return
      const layer = cat.dims[e.dimension].layer
      const base = e.status === 'present' ? 1 : e.status === 'partial' ? 0.5 : 0.9
      const m = e.status === 'missing'
        ? new THREE.MeshBasicMaterial({ color: color(layer), wireframe: true, transparent: true, opacity: base })
        : new THREE.MeshStandardMaterial({ color: color(layer), roughness: 0.5, transparent: true, opacity: base })
      const mesh = new THREE.Mesh(sphere, m)
      mesh.scale.setScalar(0.26)
      mesh.position.copy(pos[e.id])
      mesh.userData = { id: e.id }
      scene.add(mesh)
      pickables.push(mesh)
      const spoke = new THREE.Line(new THREE.BufferGeometry().setFromPoints([pos[e.dimension], pos[e.id]]),
        new THREE.LineBasicMaterial({ color: color(layer), transparent: true, opacity: 0.2 }))
      scene.add(spoke)
      const label = addLabel(e.name, 'ks-map-el', pos[e.id], 0.42)
      nodes[e.id] = { mesh, label, base, spoke }
    })

    const edges = links.filter((l) => pos[l.from_id] && pos[l.to_id]).map((l) => {
      const a = pos[l.from_id], b = pos[l.to_id]
      const mid = a.clone().add(b).multiplyScalar(0.5)
      mid.x *= 0.5
      mid.z *= 0.5
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b)
      const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(cssVar('--ks-muted')), transparent: true, opacity: 0.18 })
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)), mat)
      scene.add(line)
      return { ...l, line, mat }
    })

    const ray = new THREE.Raycaster()
    const mouse = new THREE.Vector2()
    let down = null
    const onDown = (ev) => { down = [ev.clientX, ev.clientY] }
    const onUp = (ev) => {
      if (!down || Math.hypot(ev.clientX - down[0], ev.clientY - down[1]) > 5) return
      const r = renderer.domElement.getBoundingClientRect()
      mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(mouse, camera)
      const hit = ray.intersectObjects(pickables.filter((p) => p.material.opacity > 0.1))[0]
      onSelectRef.current(hit ? hit.object.userData.id : null)
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)

    const resize = () => {
      const w = host.clientWidth, h = host.clientHeight
      renderer.setSize(w, h)
      labelRenderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(host)
    resize()

    let raf
    const state = { nodes, edges, pos, controls, camera, fly: null }
    stateRef.current = state
    const loop = () => {
      if (state.fly) {
        controls.target.lerp(state.fly.target, 0.08)
        camera.position.lerp(state.fly.cam, 0.08)
        if (camera.position.distanceTo(state.fly.cam) < 0.05) state.fly = null
      }
      controls.update()
      renderer.render(scene, camera)
      labelRenderer.render(scene, camera)
      raf = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      scene.traverse((o) => { o.geometry?.dispose?.(); o.material?.dispose?.() })
      host.innerHTML = ''
      stateRef.current = null
    }
  }, [cat, elements, links])

  // Highlight: chosen system, selection and its neighbours
  useEffect(() => {
    const s = stateRef.current
    if (!s) return
    const neighbours = new Set()
    let hotEdge = () => false
    if (selectedId?.startsWith('dim:')) {
      const dim = selectedId.slice(4)
      elements.forEach((e) => { if (e.dimension === dim) neighbours.add(e.id) })
      hotEdge = (l) => neighbours.has(l.from_id) || neighbours.has(l.to_id)
    } else if (selectedId) {
      neighbours.add(selectedId)
      s.edges.forEach((l) => { if (l.from_id === selectedId) neighbours.add(l.to_id); if (l.to_id === selectedId) neighbours.add(l.from_id) })
      hotEdge = (l) => l.from_id === selectedId || l.to_id === selectedId
    }
    const lit = (id) => (selectedId ? neighbours.has(id) || id === selectedId : !focus || focus.has(id))
    Object.entries(s.nodes).forEach(([id, n]) => {
      const isDim = id.startsWith('dim:')
      n.mesh.material.opacity = isDim || lit(id) ? n.base : 0.08
      if (n.spoke) n.spoke.material.opacity = lit(id) ? 0.25 : 0.04
      if (!isDim) {
        n.label.style.display = allLabels || (selectedId && lit(id)) ? '' : 'none'
        n.label.classList.toggle('hot', id === selectedId)
      }
    })
    s.edges.forEach((l) => {
      const hot = hotEdge(l)
      const inFocus = !focus || focus.has(l.from_id) || focus.has(l.to_id)
      l.line.visible = hot || (!selectedId && inFocus)
      l.mat.opacity = hot ? 0.9 : 0.18
      l.mat.color.set(cssVar(hot ? '--ks-ink' : '--ks-muted'))
    })
    const target = selectedId && s.pos[selectedId.startsWith('dim:') ? selectedId.slice(4) : selectedId]
    if (target) {
      const dir = s.camera.position.clone().sub(s.controls.target).normalize()
      s.fly = { target: target.clone(), cam: target.clone().add(dir.multiplyScalar(selectedId.startsWith('dim:') ? 20 : 15)) }
      s.controls.autoRotate = false
    }
  }, [selectedId, focus, allLabels, elements])

  return <div className="ks-map" ref={hostRef} />
}

import { useCallback, useEffect, useState } from 'react'
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react'
import dagre from 'dagre'
import '@xyflow/react/dist/style.css'
import { listItems, linkItems, unlinkItems } from '../api.js'

// Item 1058 (vervolg, Bart): "de linking is zinvol, maar het aanmaak-
// formulier is omslachtig - ik wil het in de graph zelf kunnen doen" -
// klik 2 nodes aan om te koppelen (type verschijnt in een klein paneeltje),
// klik een lijn aan om 'm te verwijderen. De graph is nu zowel overzicht
// als bewerkscherm i.p.v. een apart select+select+knop-formulier per item.
// Item 1058 (vervolg): geen apart "response"-kind meer - text_content geeft
// aan dat een item een bewerkbaar/gegenereerd tekstbestand is.
const KIND_ICON = { case_export: '📋' }
function iconFor(item) {
  if (KIND_ICON[item.kind]) return KIND_ICON[item.kind]
  return item.text_content != null ? '📝' : '📄'
}
const NODE_WIDTH = 200
const NODE_HEIGHT = 44
const CUSTOM_LINK_TYPE_SENTINEL = '__custom__'
const LINK_TYPE_OPTIONS = [
  { value: 'related_to', label: 'gerelateerd aan' },
  { value: 'duplicate_of', label: 'duplicaat van' },
  { value: 'source_of', label: 'bron van' },
  { value: 'reply_to', label: 'vervolg op' },
]

function layoutNodes(nodes, edges) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 50, ranksep: 80 })
  nodes.forEach(n => g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT }))
  edges.forEach(e => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return nodes.map(n => {
    const { x, y } = g.node(n.id)
    return { ...n, position: { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 } }
  })
}

function buildGraph(items, selectedId) {
  const itemIds = new Set(items.map(i => i.id))
  const rawNodes = items.map(item => ({
    id: item.id,
    data: { label: `${iconFor(item)} ${item.original_filename}` },
    position: { x: 0, y: 0 },
    style: {
      fontSize: 12, padding: '8px 10px', borderRadius: 8, width: NODE_WIDTH, cursor: 'pointer',
      border: item.id === selectedId ? '2px solid var(--color-primary)' : '1px solid var(--color-border)',
      background: 'var(--color-surface)',
    },
  }))

  const rawEdges = []
  items.forEach(item => {
    // Bijlage-van (parent_item_id) - bestaande relatie, niet via deze graph
    // te verwijderen (dat loopt via "loskoppelen van deze case"/delete).
    if (item.parent_item_id && itemIds.has(item.parent_item_id)) {
      rawEdges.push({
        id: `attach-${item.id}`, source: item.parent_item_id, target: item.id,
        type: 'smoothstep', label: 'bijlage van',
        markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'var(--color-text-muted)' },
      })
    }
    // Generieke item<->item-links - alleen 'out' nemen, anders komt elke
    // link dubbel (1x als 'out' op het bronitem, 1x als 'in' op het doel).
    ;(item.links || []).forEach(l => {
      if (l.direction !== 'out' || !itemIds.has(l.item_id)) return
      rawEdges.push({
        id: l.link_id, source: item.id, target: l.item_id,
        type: 'smoothstep', label: l.link_type,
        markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'var(--color-primary)', cursor: 'pointer' },
      })
    })
  })

  return { nodes: layoutNodes(rawNodes, rawEdges), edges: rawEdges }
}

export default function RelationsGraph({ caseId }) {
  const [items, setItems] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [pending, setPending] = useState(null) // { sourceId, targetId }
  const [linkType, setLinkType] = useState('')
  const [linkTypeCustom, setLinkTypeCustom] = useState('')

  const load = useCallback(() => {
    listItems(caseId).then(setItems).catch(() => {})
  }, [caseId])
  useEffect(() => { load() }, [load])

  function handleNodeClick(_e, node) {
    if (!selectedId) {
      setSelectedId(node.id)
    } else if (selectedId === node.id) {
      setSelectedId(null)
    } else {
      setPending({ sourceId: selectedId, targetId: node.id })
      setSelectedId(null)
    }
  }

  async function handleEdgeClick(_e, edge) {
    if (edge.id.startsWith('attach-')) return  // bijlage-relatie, niet hier te verwijderen
    if (!window.confirm('Deze relatie verwijderen?')) return
    await unlinkItems(edge.id)
    load()
  }

  function cancelPending() {
    setPending(null)
    setLinkType('')
    setLinkTypeCustom('')
  }

  async function confirmPending() {
    const type = linkType === CUSTOM_LINK_TYPE_SENTINEL ? linkTypeCustom.trim() : linkType
    if (!pending || !type) return
    await linkItems(pending.sourceId, pending.targetId, type)
    cancelPending()
    load()
  }

  if (!items.length) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>Nog geen bestanden in deze case.</div>
  }

  const { nodes, edges } = buildGraph(items, selectedId)
  const sourceItem = pending && items.find(i => i.id === pending.sourceId)
  const targetItem = pending && items.find(i => i.id === pending.targetId)

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 6 }}>
        {selectedId
          ? 'Klik een 2e bestand aan om te koppelen (of klik hetzelfde bestand nogmaals om te annuleren).'
          : 'Klik een bestand aan om een relatie te leggen. Klik op een lijn om die te verwijderen.'}
      </div>
      {pending && (
        <div style={{
          display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8,
          padding: 8, background: 'var(--color-background)', border: '1px solid var(--color-border)', borderRadius: 6,
        }}>
          <span style={{ fontSize: 12 }}>
            Koppelen: <strong>{sourceItem?.original_filename}</strong> → <strong>{targetItem?.original_filename}</strong>
          </span>
          <select
            value={linkType}
            onChange={e => setLinkType(e.target.value)}
            style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}
          >
            <option value="">Link-type...</option>
            {LINK_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            <option value={CUSTOM_LINK_TYPE_SENTINEL}>anders...</option>
          </select>
          {linkType === CUSTOM_LINK_TYPE_SENTINEL && (
            <input
              value={linkTypeCustom}
              onChange={e => setLinkTypeCustom(e.target.value)}
              placeholder="eigen link-type"
              style={{ padding: '4px 8px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)' }}
            />
          )}
          <button
            onClick={confirmPending}
            style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer' }}
          >
            Koppelen
          </button>
          <button
            onClick={cancelPending}
            style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', cursor: 'pointer' }}
          >
            Annuleren
          </button>
        </div>
      )}
      <div style={{ width: '100%', height: 500, border: '1px solid var(--color-border)', borderRadius: 8 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  )
}

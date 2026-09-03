import { useMemo } from 'react'
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react'
import dagre from 'dagre'
import '@xyflow/react/dist/style.css'

// Item 1058 (vervolg, Bart): "eigenlijk wil ik de relaties met nette lijnen
// zien... vaak ontstaat een nieuw document uit een hoofddocument (response,
// tekst-extract)" - een echte node-graph i.p.v. de badge/pillenlijst
// (die blijft bestaan voor het AANMAKEN van relaties, dit is puur de
// visualisatie). dagre doet de layout (boven-naar-onder boom, afgeleid uit
// de edges) zodat "ontstaan uit" van boven naar beneden leesbaar is.
const KIND_ICON = { upload: '📄', response: '📧', case_export: '📋' }
const NODE_WIDTH = 200
const NODE_HEIGHT = 44

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

// `items` = ALLE items van 1 case, ONGEFILTERD (dus ook kind=response/
// case_export - dat is juist het punt: zichtbaar maken hoe een response uit
// een hoofddocument ontstaat).
export default function RelationsGraph({ items }) {
  const { nodes, edges } = useMemo(() => {
    const itemIds = new Set(items.map(i => i.id))
    const rawNodes = items.map(item => ({
      id: item.id,
      data: { label: `${KIND_ICON[item.kind] || '📄'} ${item.original_filename}` },
      position: { x: 0, y: 0 },
      style: {
        fontSize: 12, padding: '8px 10px', borderRadius: 8, width: NODE_WIDTH,
        border: '1px solid var(--color-border)', background: 'var(--color-surface)',
      },
    }))

    const rawEdges = []
    items.forEach(item => {
      // Bijlage-van (parent_item_id) - al bestaande relatie, ook een vorm
      // van "ontstaan uit" (bv. een PDF uit een .msg geextraheerd).
      if (item.parent_item_id && itemIds.has(item.parent_item_id)) {
        rawEdges.push({
          id: `attach-${item.id}`, source: item.parent_item_id, target: item.id,
          type: 'smoothstep', label: 'bijlage van',
          markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'var(--color-text-muted)' },
        })
      }
      // Generieke item<->item-links (source_of/reply_to/vrij) - alleen de
      // 'out'-richting nemen, anders komt elke link dubbel in de lijst (1x
      // als 'out' op het bronitem, 1x als 'in' op het doelitem).
      ;(item.links || []).forEach(l => {
        if (l.direction !== 'out' || !itemIds.has(l.item_id)) return
        rawEdges.push({
          id: l.link_id, source: item.id, target: l.item_id,
          type: 'smoothstep', label: l.link_type,
          markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: 'var(--color-primary)' },
        })
      })
    })

    return { nodes: layoutNodes(rawNodes, rawEdges), edges: rawEdges }
  }, [items])

  if (!items.length) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 13 }}>Nog geen bestanden in deze case.</div>
  }

  return (
    <div style={{ width: '100%', height: 500, border: '1px solid var(--color-border)', borderRadius: 8 }}>
      <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}

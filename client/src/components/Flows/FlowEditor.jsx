import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import useAuthStore from '../../store/authStore'
import flowService from '../../services/flowService'
import NodePalette from './NodePalette'
import NodeEditPanel from './NodeEditPanel'
import ProcessNode  from './nodes/ProcessNode'
import ServiceNode  from './nodes/ServiceNode'
import ActorNode    from './nodes/ActorNode'
import DatabaseNode from './nodes/DatabaseNode'
import DecisionNode from './nodes/DecisionNode'
import StartEndNode from './nodes/StartEndNode'

const NODE_TYPES = {
  process:  ProcessNode,
  service:  ServiceNode,
  actor:    ActorNode,
  database: DatabaseNode,
  decision: DecisionNode,
  start:    StartEndNode,
  end:      (props) => <StartEndNode {...props} data={{ ...props.data, variant: 'end' }} />,
}

let nodeIdCounter = 1

export default function FlowEditor() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const user       = useAuthStore((s) => s.user)
  const canEdit    = user?.role === 'admin' || user?.role === 'lead'

  const [diagram,   setDiagram]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [dirty,     setDirty]     = useState(false)
  const [toast,     setToast]     = useState(null)
  const [selected,  setSelected]  = useState(null)
  const [showGrid,  setShowGrid]  = useState(true)

  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const reactFlowWrapper = useRef(null)
  const [rfInstance, setRfInstance] = useState(null)

  // Charger le diagramme
  useEffect(() => {
    flowService.get(id)
      .then((d) => {
        setDiagram(d)
        setNodes(d.nodes || [])
        setEdges(d.edges || [])
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
        showToast('Impossible de charger le diagramme', 'error')
      })
  }, [id])

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Marquer modifié quand nœuds/arêtes changent (après chargement)
  const firstRender = useRef(true)
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    setDirty(true)
  }, [nodes, edges])

  const onConnect = useCallback((params) => {
    setEdges((eds) =>
      addEdge({
        ...params,
        type: 'smoothstep',
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: false,
      }, eds)
    )
  }, [])

  // Drop depuis NodePalette
  const onDrop = useCallback((e) => {
    e.preventDefault()
    if (!canEdit || !rfInstance) return

    const type  = e.dataTransfer.getData('application/reactflow-type')
    const color = e.dataTransfer.getData('application/reactflow-color')
    if (!type) return

    const bounds   = reactFlowWrapper.current.getBoundingClientRect()
    const position = rfInstance.screenToFlowPosition({
      x: e.clientX - bounds.left,
      y: e.clientY - bounds.top,
    })

    const newNode = {
      id:   `node-${nodeIdCounter++}`,
      type,
      position,
      data: { label: type.charAt(0).toUpperCase() + type.slice(1), description: '', color },
    }
    setNodes((nds) => [...nds, newNode])
  }, [canEdit, rfInstance])

  const onDragOver = useCallback((e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  // Mise à jour d'un nœud depuis le panneau d'édition
  function handleNodeUpdate(nodeId, data) {
    setNodes((nds) =>
      nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)
    )
    // Mettre à jour also le nœud sélectionné pour que NodeEditPanel reflète le changement
    setSelected((prev) =>
      prev?.id === nodeId ? { ...prev, data: { ...prev.data, ...data } } : prev
    )
  }

  function handleNodeDelete(nodeId) {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
    setSelected(null)
  }

  function onNodeClick(_, node) {
    setSelected(node)
  }

  function onPaneClick() {
    setSelected(null)
  }

  async function handleSave() {
    if (!canEdit) return
    setSaving(true)
    try {
      await flowService.saveCanvas(id, { nodes, edges })
      setDirty(false)
      showToast('Diagramme sauvegardé')
    } catch {
      showToast('Erreur lors de la sauvegarde', 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="-m-6 flex h-[calc(100vh-56px)] items-center justify-center">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="-m-6 flex flex-col h-[calc(100vh-56px)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
        <button
          onClick={() => navigate('/flows')}
          className="p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition-colors"
          title="Retour à la liste"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold text-gray-800 truncate">{diagram?.title}</h1>
          {diagram?.description && (
            <p className="text-xs text-gray-400 truncate">{diagram.description}</p>
          )}
        </div>

        {dirty && (
          <span className="text-xs text-amber-600 font-medium whitespace-nowrap">● Non sauvegardé</span>
        )}

        {/* Grille toggle */}
        <button
          onClick={() => setShowGrid((v) => !v)}
          className={`p-1.5 rounded-md border transition-colors text-xs ${showGrid ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
          title="Afficher/masquer la grille"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" />
          </svg>
        </button>

        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              dirty ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {saving ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
              </svg>
            )}
            Sauvegarder
          </button>
        )}
      </div>

      {/* Body : palette + canvas + edit panel */}
      <div className="flex flex-1 min-h-0">
        <NodePalette canEdit={canEdit} />

        <div className="flex-1 relative" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={canEdit ? onNodesChange : undefined}
            onEdgesChange={canEdit ? onEdgesChange : undefined}
            onConnect={canEdit ? onConnect : undefined}
            onInit={setRfInstance}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            nodeTypes={NODE_TYPES}
            fitView
            deleteKeyCode={canEdit ? 'Backspace' : null}
            edgesFocusable={canEdit}
            nodesDraggable={canEdit}
            nodesConnectable={canEdit}
            elementsSelectable={true}
          >
            {showGrid && <Background color="#e5e7eb" gap={20} />}
            <Controls />
            <MiniMap
              nodeColor={(n) => n.data?.color || '#6b7280'}
              maskColor="rgba(240,240,240,0.6)"
              style={{ bottom: 12, right: 12 }}
            />
          </ReactFlow>
        </div>

        {canEdit && (
          <NodeEditPanel
            node={selected}
            onUpdate={handleNodeUpdate}
            onDelete={handleNodeDelete}
          />
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg shadow-lg text-sm font-medium text-white z-50 transition-opacity ${
            toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}

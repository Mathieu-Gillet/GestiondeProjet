import { Handle, Position } from '@xyflow/react'

export default function DatabaseNode({ data, selected }) {
  const color = data.color || '#f59e0b'
  return (
    <div className={`relative flex flex-col items-center ${selected ? 'drop-shadow-md' : ''}`} style={{ minWidth: 110 }}>
      <Handle type="target" position={Position.Top}    className="!w-2.5 !h-2.5 !bg-amber-400" style={{ top: 8 }} />
      <Handle type="target" position={Position.Left}   className="!w-2.5 !h-2.5 !bg-amber-400" id="left-target" />

      {/* Ellipse top (couvercle) */}
      <div
        className="w-full"
        style={{
          height: 18,
          background: color,
          borderRadius: '50%',
          position: 'relative',
          zIndex: 1,
        }}
      />
      {/* Corps cylindre */}
      <div
        className="w-full flex items-center justify-center"
        style={{
          background: `${color}cc`,
          borderLeft: `2px solid ${color}`,
          borderRight: `2px solid ${color}`,
          minHeight: 40,
          marginTop: -9,
          paddingTop: 12,
          paddingBottom: 4,
          paddingLeft: 8,
          paddingRight: 8,
        }}
      >
        <div className="text-center">
          <p className="text-xs font-semibold text-white break-words leading-tight drop-shadow">{data.label || 'Base de données'}</p>
          {data.description && <p className="text-[10px] text-white/80 mt-0.5 break-words">{data.description}</p>}
        </div>
      </div>
      {/* Ellipse bottom */}
      <div
        className="w-full"
        style={{
          height: 18,
          background: `${color}cc`,
          border: `2px solid ${color}`,
          borderRadius: '50%',
          marginTop: -9,
        }}
      />

      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-amber-400" style={{ bottom: 8 }} />
      <Handle type="source" position={Position.Right}  className="!w-2.5 !h-2.5 !bg-amber-400" id="right-source" />
    </div>
  )
}

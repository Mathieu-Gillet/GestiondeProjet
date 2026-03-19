import { Handle, Position } from '@xyflow/react'

export default function DecisionNode({ data, selected }) {
  const color = data.color || '#8b5cf6'
  const size = 100

  return (
    <div
      className={`relative flex items-center justify-center ${selected ? 'drop-shadow-md' : ''}`}
      style={{ width: size, height: size }}
    >
      <Handle type="target" position={Position.Top}    className="!w-2.5 !h-2.5 !bg-violet-400" />
      <Handle type="target" position={Position.Left}   className="!w-2.5 !h-2.5 !bg-violet-400" />
      {/* Losange */}
      <div
        style={{
          width: size * 0.75,
          height: size * 0.75,
          background: `${color}22`,
          border: `2px solid ${color}`,
          transform: 'rotate(45deg)',
          position: 'absolute',
        }}
      />
      {/* Label (contre-rotation) */}
      <div className="relative z-10 text-center px-2" style={{ maxWidth: size - 16 }}>
        <p className="text-[11px] font-semibold text-gray-800 break-words leading-tight">{data.label || 'Décision'}</p>
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-violet-400" />
      <Handle type="source" position={Position.Right}  className="!w-2.5 !h-2.5 !bg-violet-400" />
    </div>
  )
}

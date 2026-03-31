import { Handle, Position } from '@xyflow/react'

export default function ActorNode({ data, selected }) {
  const color = data.color || '#10b981'
  return (
    <div
      className={`px-4 py-2 min-w-[100px] text-center transition-shadow ${selected ? 'shadow-md' : 'shadow-sm'}`}
      style={{
        background: `${color}18`,
        border: `2px solid ${color}`,
        borderRadius: '9999px',
      }}
    >
      <Handle type="target" position={Position.Top}    className="!w-2.5 !h-2.5 !bg-emerald-400" />
      <Handle type="target" position={Position.Left}   className="!w-2.5 !h-2.5 !bg-emerald-400" id="left-target" />
      <div className="flex items-center justify-center gap-1">
        <svg className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
        <p className="text-xs font-semibold text-gray-800 break-words leading-tight">{data.label || 'Acteur'}</p>
      </div>
      {data.description && <p className="text-[10px] text-gray-500 mt-0.5 break-words">{data.description}</p>}
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-emerald-400" />
      <Handle type="source" position={Position.Right}  className="!w-2.5 !h-2.5 !bg-emerald-400" id="right-source" />
    </div>
  )
}

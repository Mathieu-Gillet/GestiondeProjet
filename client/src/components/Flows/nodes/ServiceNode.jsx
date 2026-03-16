import { Handle, Position } from '@xyflow/react'

export default function ServiceNode({ data, selected }) {
  const color = data.color || '#0ea5e9'
  return (
    <div
      className={`bg-white px-3 py-2 min-w-[120px] text-center transition-shadow ${selected ? 'shadow-md' : 'shadow-sm'}`}
      style={{
        border: `2px solid ${color}`,
        outline: `3px solid ${color}22`,
        outlineOffset: '2px',
        borderRadius: '6px',
      }}
    >
      <Handle type="target" position={Position.Top}    className="!w-2.5 !h-2.5 !bg-sky-400" />
      <Handle type="target" position={Position.Left}   className="!w-2.5 !h-2.5 !bg-sky-400" id="left-target" />
      <div className="flex items-center justify-center gap-1 mb-0.5">
        <svg className="w-3 h-3 flex-shrink-0" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
        </svg>
        <p className="text-xs font-semibold text-gray-800 break-words leading-tight">{data.label || 'Service'}</p>
      </div>
      {data.description && <p className="text-[10px] text-gray-500 break-words">{data.description}</p>}
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-sky-400" />
      <Handle type="source" position={Position.Right}  className="!w-2.5 !h-2.5 !bg-sky-400" id="right-source" />
    </div>
  )
}

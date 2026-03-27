import { Handle, Position } from '@xyflow/react'

export default function StartEndNode({ data, selected }) {
  const isEnd  = data.variant === 'end'
  const color  = data.color || (isEnd ? '#ef4444' : '#22c55e')

  return (
    <div
      className={`px-5 py-2 min-w-[90px] text-center transition-shadow ${selected ? 'shadow-md ring-2 ring-offset-1' : 'shadow-sm'}`}
      style={{
        background: color,
        borderRadius: '9999px',
        ringColor: color,
      }}
    >
      {!isEnd && <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-white/70" />}
      {!isEnd && <Handle type="source" position={Position.Right}  className="!w-2.5 !h-2.5 !bg-white/70" id="right-source" />}
      {isEnd  && <Handle type="target" position={Position.Top}    className="!w-2.5 !h-2.5 !bg-white/70" />}
      {isEnd  && <Handle type="target" position={Position.Left}   className="!w-2.5 !h-2.5 !bg-white/70" id="left-target" />}
      <p className="text-xs font-bold text-white drop-shadow">{data.label || (isEnd ? 'Fin' : 'Début')}</p>
    </div>
  )
}

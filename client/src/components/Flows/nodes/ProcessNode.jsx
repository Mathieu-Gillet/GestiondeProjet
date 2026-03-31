import { Handle, Position } from '@xyflow/react'

export default function ProcessNode({ data, selected }) {
  const border = data.color || '#6366f1'
  return (
    <div
      className={`rounded-lg bg-white shadow-sm px-3 py-2 min-w-[120px] text-center transition-shadow ${selected ? 'shadow-md ring-2 ring-indigo-400' : ''}`}
      style={{ borderWidth: 2, borderStyle: 'solid', borderColor: border }}
    >
      <Handle type="target" position={Position.Top}    className="!w-2.5 !h-2.5 !bg-gray-400" />
      <Handle type="target" position={Position.Left}   className="!w-2.5 !h-2.5 !bg-gray-400" id="left-target" />
      <p className="text-xs font-semibold text-gray-800 break-words leading-tight">{data.label || 'Processus'}</p>
      {data.description && <p className="text-[10px] text-gray-500 mt-0.5 break-words">{data.description}</p>}
      <Handle type="source" position={Position.Bottom} className="!w-2.5 !h-2.5 !bg-gray-400" />
      <Handle type="source" position={Position.Right}  className="!w-2.5 !h-2.5 !bg-gray-400" id="right-source" />
    </div>
  )
}

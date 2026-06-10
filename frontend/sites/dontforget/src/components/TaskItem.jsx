export default function TaskItem({ task, onToggle, onEdit }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 16px', borderBottom: '0.5px solid var(--border)',
      cursor: 'pointer',
    }}>
      <div onClick={() => onToggle(task.id)} style={{
        width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
        border: task.done ? 'none' : '1.5px solid var(--border)',
        background: task.done ? 'var(--done)' : 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all var(--transition)',
      }}>
        {task.done && <i className="ti ti-check" style={{ fontSize: 13, color: '#fff' }} aria-hidden="true" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }} onClick={() => onEdit(task)}>
        <div style={{
          fontSize: 14, color: task.done ? 'var(--text-faint)' : 'var(--text)',
          textDecoration: task.done ? 'line-through' : 'none',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {task.title}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2, display: 'flex', gap: 6 }}>
          {task.repeat !== 'once' && <><i className="ti ti-repeat" style={{ fontSize: 11 }} />{task.repeat}</>}
          {task.repeat === 'once' && <><i className="ti ti-clock" style={{ fontSize: 11 }} />Eenmalig</>}
        </div>
      </div>
      {task.photo_path && (
        <img
          src={`/api/uploads/${task.photo_path}`}
          alt=""
          style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0, border: '0.5px solid var(--border)' }}
        />
      )}
      <div style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: task.priority === 'high' ? 'var(--prio-high)' : 'var(--prio-normal)',
      }} />
    </div>
  )
}

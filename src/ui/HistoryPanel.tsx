import type { HistoryItem } from './history';

export function HistoryPanel({
  items,
  onRestore,
  onClear,
}: {
  items: HistoryItem[];
  onRestore: (item: HistoryItem) => void;
  onClear: () => void;
}) {
  return (
    <div className="history">
      <div className="panel-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h2>History</h2>
          <p>Your recent calculations, saved on this device.</p>
        </div>
        {items.length > 0 && (
          <button className="icon-btn" onClick={onClear}>Clear all</button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card empty">No saved calculations yet. Compute something and press Save.</div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <ul className="history-list">
            {items.map((it, i) => (
              <li key={i}>
                <button className="history-item" onClick={() => onRestore(it)}>
                  <div>
                    <div className="history-title">{it.title}</div>
                    <div className="history-when">{new Date(it.at).toLocaleString()}</div>
                  </div>
                  <div className="history-value num">{it.primary}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

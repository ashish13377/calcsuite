import { useEffect, useRef, useState } from 'react';
import { saveHistory, type HistoryItem } from './history';

// Saves to the shared history store and flashes confirmation so the action is visible.
export function SaveButton({ item }: { item: Omit<HistoryItem, 'at'> }) {
  const [saved, setSaved] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = () => {
    saveHistory(item);
    setSaved(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setSaved(false), 1500);
  };

  return (
    <button className={`icon-btn ${saved ? 'saved' : ''}`} onClick={onClick} aria-live="polite">
      {saved ? 'Saved ✓' : 'Save'}
    </button>
  );
}

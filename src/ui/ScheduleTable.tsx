import { Fragment, useState } from 'react';
import type { ScheduleView } from '../core/kit';

// Generic amortisation / projection schedule (§5.3, §11.7). Real <table>, right-aligned
// tabular figures, expandable year groups, principal/interest tone columns.
export function ScheduleTable({ schedule }: { schedule: ScheduleView }) {
  const [open, setOpen] = useState<Set<number>>(new Set([0]));
  const toneOf = (col: number) => schedule.toneCols?.[col];
  const cellClass = (col: number) => {
    const t = toneOf(col + 1); // +1: cells align after the label column
    return t === 'principal' ? 'pr-txt' : t === 'interest' ? 'in-txt' : '';
  };

  const toggle = (i: number) =>
    setOpen((prev) => {
      const n = new Set(prev);
      n.has(i) ? n.delete(i) : n.add(i);
      return n;
    });

  return (
    <div className="sched-wrap">
      <table className="sched">
        {schedule.title && <caption>{schedule.title}</caption>}
        <thead>
          <tr>
            {schedule.columns.map((c, i) => (
              <th key={i} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {schedule.groups
            ? schedule.groups.map((g, gi) => {
                const isOpen = open.has(gi);
                return (
                  <Fragment key={gi}>
                    <tr className="year-row" onClick={() => toggle(gi)} aria-expanded={isOpen}>
                      <th scope="row">
                        <span className="caret">{isOpen ? '▾' : '▸'}</span> {g.label}
                      </th>
                      {g.summary.map((c, ci) => (
                        <td key={ci} className={cellClass(ci)}>
                          {c}
                        </td>
                      ))}
                    </tr>
                    {isOpen &&
                      g.rows.map((r, ri) => (
                        <tr key={ri} className="month-row">
                          <th scope="row" style={{ fontWeight: 400, paddingLeft: 28 }}>
                            {r.label}
                          </th>
                          {r.cells.map((c, ci) => (
                            <td key={ci} className={cellClass(ci)}>
                              {c}
                            </td>
                          ))}
                        </tr>
                      ))}
                  </Fragment>
                );
              })
            : schedule.rows?.map((r, ri) => (
                <tr key={ri} className="month-row">
                  <th scope="row" style={{ fontWeight: 400 }}>
                    {r.label}
                  </th>
                  {r.cells.map((c, ci) => (
                    <td key={ci} className={cellClass(ci)}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}

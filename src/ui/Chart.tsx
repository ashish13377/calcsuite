import type { ChartSeries } from '../core/kit';

const stroke: Record<string, string> = {
  principal: 'var(--fc-principal)',
  interest: 'var(--fc-interest)',
  accent: 'var(--fc-accent)',
};

// Generic multi-series line/area chart. Inline SVG — no charting dependency.
export function Chart({ chart }: { chart: ChartSeries }) {
  const W = 720;
  const H = 260;
  const padL = 8;
  const padR = 8;
  const padT = 12;
  const padB = 22;

  const maxLen = Math.max(...chart.series.map((s) => s.points.length), 1);
  const yMax = Math.max(...chart.series.flatMap((s) => s.points), 1);

  const x = (i: number) => padL + (i / Math.max(maxLen - 1, 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - v / yMax) * (H - padT - padB);
  const line = (pts: number[]) => pts.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = (pts: number[]) =>
    `M${x(0)},${y(0)} ${pts.map((v, i) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} L${x(pts.length - 1)},${y(0)} Z`;

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Projection chart">
        <line x1={padL} y1={y(0)} x2={W - padR} y2={y(0)} stroke="var(--fc-line)" />
        {chart.series.map((s, i) => (
          <g key={i}>
            {s.area && <path className="chart-area" d={area(s.points)} fill={stroke[s.tone]} opacity={0.12} />}
            <path className={s.dash ? 'chart-area' : 'chart-line'} d={line(s.points)} fill="none" stroke={stroke[s.tone]} strokeWidth={2} strokeDasharray={s.dash ? '5 4' : undefined} />
          </g>
        ))}
      </svg>
      <div className="chart-legend">
        {chart.series.map((s, i) => (
          <span key={i}>
            <span className={`dot ${s.tone === 'principal' ? 'pr' : s.tone === 'interest' ? 'in' : 'ac'}`} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

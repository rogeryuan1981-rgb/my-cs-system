import React from 'react';
import { formatNumber } from '../../utils/formatters';

export default function BarChart({ data, isDarkMode, color = '#6366f1', onClick }) {
  if (!data || Object.keys(data).length === 0) return <div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-500 font-black">無數據</div>;

  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const maxVal = Math.max(...entries.map(([, value]) => value), 10);
  const labels = entries.map(([label]) => label);
  const width = 800;
  const height = 380;
  const paddingX = 60;
  const paddingBottom = 120;
  const paddingTop = 30;
  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingBottom - paddingTop;
  const barWidth = (chartWidth / labels.length) * 0.5;
  const gridColor = isDarkMode ? '#334155' : '#e2e8f0';
  const axisTextColor = isDarkMode ? '#cbd5e1' : '#64748b';

  return (
    <div className="w-full overflow-x-auto scrollbar-hide mt-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto min-h-[400px] min-w-[700px] drop-shadow-sm">
        {[0, 0.5, 1].map((ratio) => {
          const y = height - paddingBottom - ratio * chartHeight;
          return (
            <g key={ratio}>
              <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke={gridColor} strokeDasharray="4 4" />
              <text x={paddingX - 12} y={y + 4} fontSize="14" fill={axisTextColor} textAnchor="end" fontWeight="900">{formatNumber(Math.round(maxVal * ratio))}</text>
            </g>
          );
        })}

        {entries.map(([label, value], index) => {
          const x = paddingX + (index * (chartWidth / labels.length)) + (chartWidth / labels.length / 2);
          const barHeight = (value / maxVal) * chartHeight;
          const y = height - paddingBottom - barHeight;
          const isLongText = label.length > 3;
          const rotateAngle = isLongText ? 35 : 0;
          const textAnchor = isLongText ? 'start' : 'middle';
          const labelFontSize = label.length > 10 ? '11' : '13';

          return (
            <g key={label} className="cursor-pointer group" onClick={() => onClick && onClick(label)}>
              <rect x={x - barWidth / 2} y={y} width={barWidth} height={barHeight} fill={color} rx="6" className="transition-all duration-500 ease-out group-hover:brightness-125 shadow-lg" />
              {value > 0 && (
                <text x={x} y={y - 10} fontSize="15" fill={isDarkMode ? '#cbd5e1' : '#1e293b'} textAnchor="middle" fontWeight="900">
                  {formatNumber(value)}
                </text>
              )}
              <g transform={`translate(${x}, ${height - paddingBottom + 18})`}>
                <text transform={`rotate(${rotateAngle})`} fontSize={labelFontSize} fill={axisTextColor} textAnchor={textAnchor} fontWeight="900" className="select-none group-hover:fill-blue-500 transition-colors">
                  {label}
                </text>
              </g>
            </g>
          );
        })}
        <line x1={paddingX} y1={height - paddingBottom} x2={width - paddingX} y2={height - paddingBottom} stroke={gridColor} strokeWidth="2" />
      </svg>
    </div>
  );
}

import React, { useState } from 'react';
import { formatNumber, getNiceChartScale } from '../../utils/formatters';

export default function LineChart({ datasets, labels, isDarkMode }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  if (!Array.isArray(datasets) || datasets.length === 0 || !labels) return <div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-500">無數據</div>;
  const allData = datasets.flatMap((dataset) => dataset.data || []);
  if (allData.length === 0) return <div className="h-48 flex items-center justify-center text-slate-400 dark:text-slate-500">無數據</div>;

  const { max: maxVal, ticks: yTicks } = getNiceChartScale(Math.max(...allData, 10));
  const height = 260;
  const width = 800;
  const paddingX = 40;
  const paddingY = 40;
  const gridColor = isDarkMode ? '#334155' : '#e2e8f0';
  const axisTextColor = '#94a3b8';
  const bgStroke = isDarkMode ? '#1e293b' : '#ffffff';

  return (
    <div className="w-full flex flex-col items-center">
      <div className="flex flex-wrap justify-center gap-4 mb-6 h-8 items-center">
        {datasets.map((dataset, index) => {
          const isHovered = hoveredPoint?.dsIdx === index;
          return (
            <div key={dataset.label} className={`flex items-center text-xs font-bold px-3 py-1.5 rounded-xl transition-all duration-300 ${isHovered ? 'bg-slate-200 dark:bg-slate-700 scale-110 shadow-sm' : ''}`}>
              <span className="w-3 h-3 rounded-full mr-2 shadow-sm" style={{ backgroundColor: dataset.color }} />
              <span className={isDarkMode ? 'text-slate-200' : 'text-slate-700'}>{dataset.label}</span>
            </div>
          );
        })}
      </div>
      <div className="w-full overflow-x-auto relative scrollbar-hide">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64 md:h-80 drop-shadow-sm min-w-[600px]">
          {yTicks.map((tickValue) => {
            const ratio = tickValue / maxVal;
            const y = height - paddingY - ratio * (height - paddingY * 2);
            return (
              <g key={tickValue}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke={gridColor} strokeDasharray="4 4" />
                <text x={paddingX - 10} y={y + 4} fontSize="10" fill={axisTextColor} textAnchor="end">{formatNumber(tickValue)}</text>
              </g>
            );
          })}
          {datasets.map((dataset) => {
            const points = dataset.data.map((value, index) => `${paddingX + (index * ((width - paddingX * 2) / (labels.length - 1 || 1)))},${height - paddingY - (value / maxVal) * (height - paddingY * 2)}`).join(' ');
            return <polyline key={`line-${dataset.label}`} points={points} fill="none" stroke={dataset.color} strokeWidth={dataset.dashed ? '2' : '3'} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dataset.dashed ? '6 6' : 'none'} className="transition-all duration-500" />;
          })}
          {datasets.map((dataset, datasetIndex) => dataset.data.map((value, index) => {
            if (hoveredPoint?.dsIdx === datasetIndex && hoveredPoint?.i === index) return null;
            const x = paddingX + (index * ((width - paddingX * 2) / (labels.length - 1 || 1)));
            const y = height - paddingY - (value / maxVal) * (height - paddingY * 2);
            let dy = -12;
            let dx = 0;
            if (datasetIndex === 0) dy = -22;
            if (datasetIndex === 1) dy = -10;
            if (datasetIndex === 2) { dy = 14; dx = 10; }
            if (datasetIndex === 3) { dy = 24; dx = -10; }
            if (y + dy > height - paddingY - 5) dy = -10;

            return (
              <g key={`point-${dataset.label}-${index}`} onMouseEnter={() => setHoveredPoint({ dsIdx: datasetIndex, i: index })} onMouseLeave={() => setHoveredPoint(null)} className="cursor-pointer">
                <circle cx={x} cy={y} r="4" fill={isDarkMode ? '#1e293b' : '#ffffff'} stroke={dataset.color} strokeWidth="2" className="transition-all duration-200" />
                {value > 0 && <text x={x + dx} y={y + dy} fontSize="11" fill={dataset.color} textAnchor="middle" fontWeight="black" className="select-none transition-all duration-200" stroke={bgStroke} strokeWidth="3" paintOrder="stroke" strokeLinejoin="round">{formatNumber(value)}</text>}
              </g>
            );
          }))}
          {hoveredPoint && (() => {
            const { dsIdx, i } = hoveredPoint;
            const dataset = datasets[dsIdx];
            const value = dataset.data[i];
            const x = paddingX + (i * ((width - paddingX * 2) / (labels.length - 1 || 1)));
            const y = height - paddingY - (value / maxVal) * (height - paddingY * 2);
            return (
              <g className="pointer-events-none">
                <circle cx={x} cy={y} r="7" fill={isDarkMode ? '#1e293b' : '#ffffff'} stroke={dataset.color} strokeWidth="3" />
                <text x={x} y={y - 15} fontSize="18" fill={dataset.color} textAnchor="middle" fontWeight="black" stroke={bgStroke} strokeWidth="5" paintOrder="stroke" strokeLinejoin="round">{formatNumber(value)}</text>
              </g>
            );
          })()}
          {labels.map((label, index) => <text key={`label-${index}`} x={paddingX + (index * ((width - paddingX * 2) / (labels.length - 1 || 1)))} y={height - 10} fontSize="11" fill={axisTextColor} textAnchor="middle" fontWeight="bold">{label}</text>)}
        </svg>
      </div>
    </div>
  );
}

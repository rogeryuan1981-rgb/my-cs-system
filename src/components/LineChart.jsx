import React, { useState } from 'react';

/**
 * 共用折線圖元件 (LineChart)
 * 用於進階統計區顯示趨勢圖表
 */
const LineChart = ({ datasets, labels, isDarkMode }) => {
  const [hoveredPoint, setHoveredPoint] = useState(null);

  if (!Array.isArray(datasets) || datasets.length === 0 || !labels) {
    return <div className="h-48 flex items-center justify-center text-slate-400">無數據</div>;
  }
  
  const allData = datasets.flatMap(ds => ds.data || []);
  if (allData.length === 0) {
    return <div className="h-48 flex items-center justify-center text-slate-400">無數據</div>;
  }
  
  const maxVal = Math.max(...allData, 10);
  const height = 260, width = 800, paddingX = 40, paddingY = 40;
  const gridColor = isDarkMode ? "#334155" : "#e2e8f0";
  const axisTextColor = isDarkMode ? "#94a3b8" : "#94a3b8";
  const bgStroke = isDarkMode ? "#1e293b" : "#ffffff";

  return (
    <div className="w-full flex flex-col items-center">
      <div className="flex flex-wrap justify-center gap-4 mb-6 h-8 items-center">
        {datasets.map((ds, idx) => {
          const isHovered = hoveredPoint?.dsIdx === idx;
          return (
            <div key={ds.label} className={`flex items-center text-xs font-bold px-3 py-1.5 rounded-xl transition-all duration-300 ${isHovered ? 'bg-slate-200 dark:bg-slate-700 scale-110 shadow-sm' : ''}`}>
              <span className="w-3 h-3 rounded-full mr-2 shadow-sm" style={{ backgroundColor: ds.color }}></span>
              <span className={isDarkMode ? "text-slate-200" : "text-slate-700"}>{ds.label}</span>
            </div>
          );
        })}
      </div>
      <div className="w-full overflow-x-auto relative scrollbar-hide">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-64 md:h-80 drop-shadow-sm min-w-[600px]">
          {[0, 0.5, 1].map(ratio => {
            const y = height - paddingY - ratio * (height - paddingY * 2);
            return (
              <g key={ratio}>
                <line x1={paddingX} y1={y} x2={width-paddingX} y2={y} stroke={gridColor} strokeDasharray="4 4" />
                <text x={paddingX - 10} y={y + 4} fontSize="10" fill={axisTextColor} textAnchor="end">{Math.round(maxVal * ratio)}</text>
              </g>
            );
          })}
          {datasets.map((ds) => {
            const points = ds.data.map((val, i) => `${paddingX + (i * ((width - paddingX * 2) / (labels.length - 1 || 1)))},${height - paddingY - (val / maxVal) * (height - paddingY * 2)}`).join(' ');
            return <polyline key={`line-${ds.label}`} points={points} fill="none" stroke={ds.color} strokeWidth={ds.dashed ? "2" : "3"} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={ds.dashed ? '6 6' : 'none'} className="transition-all duration-500" />;
          })}
          {datasets.map((ds, dsIdx) => ds.data.map((val, i) => {
            if (hoveredPoint?.dsIdx === dsIdx && hoveredPoint?.i === i) return null;
            const x = paddingX + (i * ((width - paddingX * 2) / (labels.length - 1 || 1)));
            const y = height - paddingY - (val / maxVal) * (height - paddingY * 2);
            let dy = -12, dx = 0;
            if (dsIdx === 0) dy = -22;
            if (dsIdx === 1) dy = -10;
            if (dsIdx === 2) { dy = 14; dx = 10; }
            if (dsIdx === 3) { dy = 24; dx = -10; }
            if (y + dy > height - paddingY - 5) dy = -10;

            return (
              <g key={`point-${ds.label}-${i}`} onMouseEnter={() => setHoveredPoint({ dsIdx, i })} onMouseLeave={() => setHoveredPoint(null)} className="cursor-pointer">
                <circle cx={x} cy={y} r="4" fill={isDarkMode ? "#1e293b" : "#ffffff"} stroke={ds.color} strokeWidth="2" className="transition-all duration-200" />
                {val > 0 && <text x={x + dx} y={y + dy} fontSize="11" fill={ds.color} textAnchor="middle" fontWeight="black" className="select-none transition-all duration-200" stroke={bgStroke} strokeWidth="3" paintOrder="stroke" strokeLinejoin="round">{val}</text>}
              </g>
            );
          }))}
          {hoveredPoint && (() => {
            const { dsIdx, i } = hoveredPoint;
            const ds = datasets[dsIdx];
            const val = ds.data[i];
            const x = paddingX + (i * ((width - paddingX * 2) / (labels.length - 1 || 1)));
            const y = height - paddingY - (val / maxVal) * (height - paddingY * 2);
            return (
              <g className="pointer-events-none">
                <circle cx={x} cy={y} r="7" fill={isDarkMode ? "#1e293b" : "#ffffff"} stroke={ds.color} strokeWidth="3" />
                <text x={x} y={y - 15} fontSize="18" fill={ds.color} textAnchor="middle" fontWeight="black" stroke={bgStroke} strokeWidth="5" paintOrder="stroke" strokeLinejoin="round">{val}</text>
              </g>
            );
          })()}
          {labels.map((lbl, i) => <text key={`lbl-${i}`} x={paddingX + (i * ((width - paddingX * 2) / (labels.length - 1 || 1)))} y={height - 10} fontSize="11" fill={axisTextColor} textAnchor="middle" fontWeight="bold">{lbl}</text>)}
        </svg>
      </div>
    </div>
  );
};

export default LineChart;

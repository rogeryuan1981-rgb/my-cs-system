import React from 'react';

/**
 * 簡易趨勢圖表元件 (LineChart)
 * 專門用於 Dashboard 展示近半年服務量趨勢
 */
const LineChart = ({ datasets, labels, isDarkMode }) => {
  const chartHeight = 240;
  const chartWidth = 800;
  const padding = 40;

  // 找出數據的最大值，決定座標軸刻度
  const allValues = datasets.flatMap(d => d.data);
  const maxValue = Math.max(...allValues, 10);
  const steps = 5;

  // 座標轉換邏輯
  const getX = (idx) => padding + (idx * (chartWidth - padding * 2) / (labels.length - 1));
  const getY = (val) => chartHeight - padding - (val * (chartHeight - padding * 2) / maxValue);

  return (
    <div className="w-full overflow-x-auto py-4">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full min-w-[600px] h-auto overflow-visible">
        {/* 背景格線 */}
        {[...Array(steps + 1)].map((_, i) => {
          const val = Math.round((maxValue / steps) * i);
          const y = getY(val);
          return (
            <g key={i}>
              <line x1={padding} y1={y} x2={chartWidth - padding} y2={y} stroke={isDarkMode ? "#334155" : "#f1f5f9"} strokeWidth="1" />
              <text x={padding - 10} y={y + 4} textAnchor="end" className="text-[10px] fill-slate-400 font-mono">{val}</text>
            </g>
          );
        })}

        {/* 橫軸標籤 */}
        {labels.map((label, i) => (
          <text key={i} x={getX(i)} y={chartHeight - 10} textAnchor="middle" className="text-[10px] fill-slate-400 font-bold">{label}</text>
        ))}

        {/* 數據折線 */}
        {datasets.map((dataset, dsIdx) => {
          const points = dataset.data.map((val, i) => `${getX(i)},${getY(val)}`).join(' ');
          return (
            <g key={dsIdx}>
              <polyline
                fill="none"
                stroke={dataset.color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={dataset.dashed ? "4 4" : "0"}
                points={points}
                className="transition-all duration-1000"
              />
              {dataset.data.map((val, i) => (
                <circle
                  key={i}
                  cx={getX(i)}
                  cy={getY(val)}
                  r="4"
                  fill={isDarkMode ? "#1e293b" : "white"}
                  stroke={dataset.color}
                  strokeWidth="2"
                  className="hover:r-6 cursor-pointer transition-all"
                >
                  <title>{`${dataset.label}: ${val} 件`}</title>
                </circle>
              ))}
            </g>
          );
        })}

        {/* 圖例 */}
        <g transform={`translate(${padding}, 0)`}>
          {datasets.map((d, i) => (
            <g key={i} transform={`translate(${i * 80}, 0)`}>
              <line x1="0" y1="0" x2="15" y2="0" stroke={d.color} strokeWidth="3" strokeDasharray={d.dashed ? "2 2" : "0"} />
              <text x="20" y="4" className="text-[10px] fill-slate-500 font-black">{d.label}</text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
};

export default LineChart;

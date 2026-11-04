import React from 'react';

export interface DonutChartItem {
  id: string;
  name: string;
  cents: number;
  color: string;
}

export interface DonutChartProps {
  items: DonutChartItem[];
  size?: number;
  strokeWidth?: number;
  centerText?: string;
  centerSubtext?: string;
}

/**
 * Gráfico de rosca em SVG puro, sem bibliotecas externas pesadas.
 */
export const DonutChart: React.FC<DonutChartProps> = ({
  items,
  size = 180,
  strokeWidth = 24,
  centerText,
  centerSubtext,
}) => {
  const total = items.reduce((acc, curr) => acc + Math.max(0, curr.cents), 0);

  if (total === 0 || items.length === 0) {
    return (
      <div
        style={{ width: size, height: size }}
        className="mx-auto flex flex-col items-center justify-center rounded-full border border-dashed border-[#262630] text-center p-4"
      >
        <span className="text-[11px] text-[#9A9AA6]">Sem dados</span>
      </div>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let accumulatedAngle = 0;

  return (
    <div
      style={{ width: size, height: size }}
      className="relative mx-auto flex items-center justify-center"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform -rotate-90"
      >
        {items.map((item) => {
          const ratio = Math.max(0, item.cents) / total;
          const strokeDasharray = `${ratio * circumference} ${circumference}`;
          const strokeDashoffset = -accumulatedAngle;
          accumulatedAngle += ratio * circumference;

          return (
            <circle
              key={item.id}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke={item.color || '#FF7A1A'}
              strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={strokeDashoffset}
              className="transition-all duration-500 hover:opacity-85"
            />
          );
        })}
      </svg>

      {/* Conteúdo central */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
        {centerText && (
          <span className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[120px]">
            {centerText}
          </span>
        )}
        {centerSubtext && (
          <span className="text-[10px] text-[#9A9AA6] truncate max-w-[110px]">
            {centerSubtext}
          </span>
        )}
      </div>
    </div>
  );
};


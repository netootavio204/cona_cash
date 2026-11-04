import React from 'react';

export interface MiniBarChartProps {
  data: {
    label: string;
    valueCents: number;
    secondaryCents?: number;
    sublabel?: string;
  }[];
  height?: number;
  corPrimaria?: string;
  corSecundaria?: string;
}

/**
 * Gráfico de barras minimalista em SVG puro, ultraleve e responsivo, sem dependências pesadas.
 */
export const MiniBarChart: React.FC<MiniBarChartProps> = ({
  data,
  height = 140,
  corPrimaria = '#FF7A1A',
  corSecundaria = '#FF3B30',
}) => {
  if (!data || data.length === 0) {
    return (
      <div
        style={{ height }}
        className="w-full flex items-center justify-center text-xs text-[#9A9AA6]"
      >
        Sem movimentações no período selecionado.
      </div>
    );
  }

  const maxVal = Math.max(
    1,
    ...data.map((d) => Math.max(d.valueCents || 0, d.secondaryCents || 0))
  );

  return (
    <div className="w-full flex flex-col gap-2 min-w-0">
      <div
        style={{ height }}
        className="w-full flex items-end justify-between gap-1 sm:gap-2 pt-4 px-1 min-w-0"
      >
        {data.map((item, idx) => {
          const pctPrimaria = Math.min(100, Math.max(4, (item.valueCents / maxVal) * 100));
          const pctSecundaria = item.secondaryCents
            ? Math.min(100, Math.max(4, (item.secondaryCents / maxVal) * 100))
            : 0;

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center justify-end h-full gap-1 min-w-0 group relative"
            >
              {/* Tooltip no hover/foco */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-[#0B0B0D] border border-[#262630] text-[10px] text-white px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap z-20">
                {item.sublabel || item.label}: R$ {(item.valueCents / 100).toFixed(2)}
              </div>

              <div className="w-full max-w-[28px] flex items-end justify-center gap-0.5 h-full">
                {/* Barra Principal (Ganhos) */}
                <div
                  style={{
                    height: `${pctPrimaria}%`,
                    backgroundColor: corPrimaria,
                  }}
                  className="w-full rounded-t-md transition-all duration-300 hover:brightness-110"
                />

                {/* Barra Secundária opcional (Saídas) */}
                {item.secondaryCents !== undefined && (
                  <div
                    style={{
                      height: `${pctSecundaria}%`,
                      backgroundColor: corSecundaria,
                    }}
                    className="w-full rounded-t-md transition-all duration-300 hover:brightness-110 opacity-75"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Rótulos inferiores */}
      <div className="w-full flex justify-between gap-1 px-1 border-t border-[#262630]/60 pt-1 text-[10px] text-[#9A9AA6] min-w-0">
        {data.map((item, idx) => (
          <span key={idx} className="flex-1 text-center truncate" title={item.label}>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
};


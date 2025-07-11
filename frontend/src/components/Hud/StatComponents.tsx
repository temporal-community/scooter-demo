// Purpose: Contains reusable Stat and BreakdownStat presentational components.

interface StatProps {
  label: string;
  value: string;
}

export function Stat({ label, value }: StatProps) {
  return (
    <div className="flex justify-between items-center py-1.5 px-1 border-b border-gray-100 last:border-b-0">
      <span className="text-gray-700 font-sans text-xs font-medium tracking-tight">{label}</span>
      <span className="text-gray-900 font-mono text-xs font-bold tracking-wider">{value}</span>
    </div>
  );
}

interface BreakdownStatProps {
  label: string;
  value: string;
  cost?: string;
  bold?: boolean;
}

export function BreakdownStat({ label, value, cost, bold }: BreakdownStatProps) {
  return (
    <div className="flex justify-between items-start">
      <span className={`text-gray-600 text-xs ${bold ? 'font-bold' : ''}`}>{label}</span>
      <div className="text-right">
        <span className={`text-gray-900 font-mono text-sm ${bold ? 'font-bold' : ''}`}>{value}</span>
        {cost && <div className="text-[10px] text-gray-500 leading-tight">{cost}</div>}
      </div>
    </div>
  );
}
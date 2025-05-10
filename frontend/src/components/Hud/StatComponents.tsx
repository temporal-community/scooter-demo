// Purpose: Contains reusable Stat and BreakdownStat presentational components.

interface StatProps {
  label: string;
  value: string;
}

export function Stat({ label, value }: StatProps) {
  return (
    <div className="flex justify-between items-center py-2 px-1 border-b border-gray-100 last:border-b-0">
      <span className="text-gray-700 font-sans text-base font-medium tracking-tight">{label}</span>
      <span className="text-gray-900 font-mono text-lg font-bold tracking-wider">{value}</span>
    </div>
  );
}

interface BreakdownStatProps {
  label: string;
  value: string;
  bold?: boolean;
}

export function BreakdownStat({ label, value, bold }: BreakdownStatProps) {
  return (
    <div className="flex justify-between items-center">
      <span className={`text-gray-600 text-sm ${bold ? 'font-bold' : ''}`}>{label}</span>
      <span className={`text-gray-900 font-mono text-base ${bold ? 'font-bold' : ''}`}>{value}</span>
    </div>
  );
}
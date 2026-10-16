import { Sparkles, SlidersHorizontal } from 'lucide-react';
import { NuPolicy } from '../lib/subjectUtils';

interface Props {
  policy: NuPolicy;
  onSelectPolicy: (policy: NuPolicy) => void;
  nuCount: number;
  onOpenIndividualModal: () => void;
  individualDecidedCount: number;
  officialPercentage: number | null;
  simulatedPercentage: number | null;
}

export default function NuPolicySelector({
  policy,
  onSelectPolicy,
  nuCount,
  onOpenIndividualModal,
  individualDecidedCount,
  officialPercentage,
  simulatedPercentage,
}: Props) {
  if (nuCount === 0) {
    return null;
  }

  const diff = officialPercentage !== null && simulatedPercentage !== null
    ? Number((simulatedPercentage - officialPercentage).toFixed(1))
    : 0;

  return (
    <div className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3 animate-fade-in">
      {/* Left: Info pill */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/60 flex items-center justify-center shrink-0">
          <Sparkles size={16} />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-900">
            {nuCount} Not Updated (NU) Sessions
          </span>
          {policy !== 'ignored' && simulatedPercentage !== null && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
              Simulated: {simulatedPercentage.toFixed(1)}% {diff !== 0 && `(${diff > 0 ? `+${diff}` : diff}%)`}
            </span>
          )}
        </div>
      </div>

      {/* Right: Sleek Segmented Simulation Selector */}
      <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold self-start md:self-auto overflow-x-auto max-w-full">
        <button
          type="button"
          onClick={() => onSelectPolicy('ignored')}
          className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
            policy === 'ignored'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Official (Excluded)
        </button>

        <button
          type="button"
          onClick={() => onSelectPolicy('all_present')}
          className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
            policy === 'all_present'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-emerald-700'
          }`}
        >
          All Present
        </button>

        <button
          type="button"
          onClick={() => onSelectPolicy('all_absent')}
          className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap ${
            policy === 'all_absent'
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-rose-700'
          }`}
        >
          All Absent
        </button>

        <button
          type="button"
          onClick={onOpenIndividualModal}
          className={`px-3 py-1.5 rounded-lg transition-all whitespace-nowrap flex items-center gap-1 ${
            policy === 'individual'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-slate-600 hover:text-indigo-700'
          }`}
        >
          <SlidersHorizontal size={12} />
          <span>Individual {individualDecidedCount > 0 ? `(${individualDecidedCount}/${nuCount})` : ''}</span>
        </button>
      </div>
    </div>
  );
}

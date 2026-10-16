import { OverallSummary, TARGET_ATTENDANCE, getAttendanceHealth } from '../lib/types';
import AttendanceProgressBar from './AttendanceProgressBar';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

interface Props {
  summary: OverallSummary;
  latestRecordDate?: string | null;
}

export default function OverallAttendanceCard({ summary, latestRecordDate }: Props) {
  const health = getAttendanceHealth(summary.overall_percentage);
  
  const textColorClass = 
    summary.overall_percentage === null ? 'text-slate-400' :
    health === 'healthy' ? 'text-emerald-600' :
    health === 'warning' ? 'text-amber-600' :
    'text-rose-600';

  return (
    <div className="glass-panel p-6 sm:p-8 animate-fade-in">
      <div className="flex flex-col md:flex-row gap-8 items-center md:items-stretch">
        
        {/* Left: Overall Percentage & Gauge */}
        <div className="flex-1 flex flex-col items-center md:items-start justify-center min-w-[240px]">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Overall Attendance
            </span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
              health === 'healthy'
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : health === 'warning'
                ? 'bg-amber-50 text-amber-700 border-amber-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}>
              {health === 'healthy' ? <ShieldCheck size={12} /> : <AlertTriangle size={12} />}
              <span>{health === 'healthy' ? 'Target Met (≥80%)' : health === 'warning' ? 'Warning Zone' : 'Critical'}</span>
            </span>
          </div>

          <div className="flex items-baseline gap-1.5 mb-3">
            <span className={`text-6xl sm:text-7xl font-black tracking-tight ${textColorClass}`}>
              {summary.overall_percentage !== null 
                ? summary.overall_percentage.toFixed(1) 
                : '--'}
            </span>
            <span className="text-2xl text-slate-400 font-bold">%</span>
          </div>
          
          <div className="w-full max-w-sm">
            <AttendanceProgressBar percentage={summary.overall_percentage} height="md" />
            <div className="flex justify-between text-[11px] text-slate-400 mt-1.5 font-medium">
              <span>0%</span>
              <span>Target: {TARGET_ATTENDANCE}%</span>
              <span>100%</span>
            </div>
            {latestRecordDate && (
              <p className="text-[11px] text-slate-500 mt-2 font-medium">
                Active records through <span className="font-bold text-slate-800">{latestRecordDate}</span>
              </p>
            )}
          </div>
        </div>
        
        {/* Divider */}
        <div className="hidden md:block w-px bg-slate-200/80" />
        
        {/* Right: Clean Stats Grid */}
        <div className="flex-1 grid grid-cols-2 gap-3.5 w-full">
          <StatBox 
            label="Present Sessions" 
            value={summary.total_present} 
            color="text-emerald-600" 
          />
          <StatBox 
            label="Absent Sessions" 
            value={summary.total_absent} 
            color="text-rose-600" 
          />
          <StatBox 
            label="Counted Total" 
            value={summary.total_counted} 
            color="text-slate-900" 
          />
          <StatBox 
            label="Not Updated (NU)" 
            value={summary.total_not_updated} 
            color="text-amber-600" 
            sub="Excluded from calculation"
          />
        </div>
        
      </div>
    </div>
  );
}

function StatBox({ label, value, color, sub }: { label: string, value: number, color: string, sub?: string }) {
  return (
    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col justify-center">
      <span className="text-xs font-semibold text-slate-500 mb-1">{label}</span>
      <span className={`text-2xl sm:text-3xl font-extrabold ${color}`}>{value}</span>
      {sub && <span className="text-[10px] text-slate-400 mt-0.5">{sub}</span>}
    </div>
  );
}

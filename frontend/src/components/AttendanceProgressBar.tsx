import { getAttendanceHealth, TARGET_ATTENDANCE } from '../lib/types';

interface ProgressBarProps {
  percentage: number | null;
  height?: 'sm' | 'md' | 'lg';
  showTarget?: boolean;
}

export default function AttendanceProgressBar({ 
  percentage, 
  height = 'md',
  showTarget = true
}: ProgressBarProps) {
  if (percentage === null) {
    return (
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${
        height === 'sm' ? 'h-1.5' : height === 'md' ? 'h-2' : 'h-3'
      }`}>
        <div className="bg-slate-300 h-full w-full opacity-50" />
      </div>
    );
  }

  const health = getAttendanceHealth(percentage);
  
  const colorClass = 
    health === 'healthy' ? 'bg-[var(--color-status-healthy)]' :
    health === 'warning' ? 'bg-[var(--color-status-warning)]' :
    'bg-[var(--color-status-critical)]';

  const clampedPercentage = Math.min(100, Math.max(0, percentage));

  return (
    <div className="relative w-full">
      <div className={`w-full bg-slate-100 rounded-full overflow-hidden ${
        height === 'sm' ? 'h-1.5' : height === 'md' ? 'h-2' : 'h-3'
      }`}>
        <div 
          className={`h-full transition-all duration-1000 ease-out rounded-full ${colorClass}`}
          style={{ width: `${clampedPercentage}%` }}
        />
      </div>
      
      {showTarget && (
        <div 
          className="absolute top-0 bottom-0 w-0.5 bg-slate-900/20 z-10"
          style={{ left: `${TARGET_ATTENDANCE}%` }}
          title={`Target: ${TARGET_ATTENDANCE}%`}
        >
          <div className="absolute -top-1 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-slate-400" />
        </div>
      )}
    </div>
  );
}

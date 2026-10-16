import { AttendanceStatus } from '../lib/types';

interface Props {
  status: string;
}

export default function AttendanceStatusBadge({ status }: Props) {
  let config = {
    label: status,
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200'
  };

  switch (status as AttendanceStatus) {
    case 'P':
      config = {
        label: 'Present',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200'
      };
      break;
    case 'A':
      config = {
        label: 'Absent',
        bg: 'bg-red-50',
        text: 'text-red-700',
        border: 'border-red-200'
      };
      break;
    case 'NU':
      config = {
        label: 'Not Updated',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200'
      };
      break;
    case 'E':
      config = {
        label: 'Exempt',
        bg: 'bg-indigo-50',
        text: 'text-indigo-700',
        border: 'border-indigo-200'
      };
      break;
    case 'L':
      config = {
        label: 'Late',
        bg: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200'
      };
      break;
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}>
      {config.label}
    </span>
  );
}

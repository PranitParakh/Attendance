import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Loader2,
  Calendar,
  Clock,
  ShieldCheck,
  Settings2,
  Link2,
} from 'lucide-react';
import { getSubjectDetail, getCurrentAttendance } from '../lib/api';
import type { SubjectDetailResponse } from '../lib/types';
import { getAttendanceHealth, TARGET_ATTENDANCE } from '../lib/types';
import {
  getSubjectAbbreviation,
  calculateBunkBuffer,
  getStoredSubjectConfig,
  calculateSubjectLecturesStats,
  isLabOrTutorialRecord,
  getStoredMergeMap,
  getStoredDeletedSubjects,
  applySubjectMergeMap,
  simulateAttendanceWithNuPolicy,
  getStoredNuPolicy,
  getStoredIndividualOverrides,
} from '../lib/subjectUtils';
import AttendanceProgressBar from '../components/AttendanceProgressBar';
import AttendanceStatusBadge from '../components/AttendanceStatusBadge';
import SubjectSettingsModal from '../components/SubjectSettingsModal';

export default function SubjectDetail() {
  const { subjectName } = useParams<{ subjectName: string }>();
  const [data, setData] = useState<SubjectDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [componentFilter, setComponentFilter] = useState<'ALL' | 'THEORY' | 'LAB'>('ALL');
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [configVersion, setConfigVersion] = useState(0);

  useEffect(() => {
    if (subjectName) {
      loadData(subjectName);
    }
  }, [subjectName]);

  const loadData = async (name: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const dataset = await getCurrentAttendance();

      // Apply the same NU simulation pipeline used on the dashboard so
      // subject detail pages show consistent counts.
      const nuPolicy = getStoredNuPolicy();
      const individualOverrides = getStoredIndividualOverrides();
      const { records: simulatedRecords, subjects: simulatedSubjects } =
        simulateAttendanceWithNuPolicy(dataset.records, nuPolicy, individualOverrides);

      const mergeMap = getStoredMergeMap();
      const deletedSubjects = getStoredDeletedSubjects();
      const { mergedRecords, mergedSubjects } = applySubjectMergeMap(
        simulatedRecords,
        simulatedSubjects,
        mergeMap,
        deletedSubjects
      );

      const summary = mergedSubjects.find(
        s => s.course_name.toUpperCase() === name.toUpperCase()
      );

      if (!summary) {
        // Fallback: try direct backend detail
        try {
          const direct = await getSubjectDetail(name);
          setData(direct);
          return;
        } catch {
          setError(`Subject "${name}" not found.`);
          return;
        }
      }

      const subjectRecords = mergedRecords.filter(
        r => r.course_normalized.toUpperCase() === name.toUpperCase()
      );
      subjectRecords.sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return b.start_time.localeCompare(a.start_time);
      });

      setData({
        summary,
        records: subjectRecords,
      });
    } catch (err: any) {
      setError('Failed to load subject details.');
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':');
    const h = parseInt(hours, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedHours = h % 12 || 12;
    return `${formattedHours}:${minutes} ${ampm}`;
  };

  const mergeMap = useMemo(() => getStoredMergeMap(), [configVersion]);
  const linkedChildren = useMemo(() => {
    if (!data) return [];
    return Object.entries(mergeMap)
      .filter(([, parent]) => parent === data.summary.course_name)
      .map(([child]) => child);
  }, [mergeMap, data]);
  const hasLinkedChildren = linkedChildren.length > 0;

  const theoryRecords = useMemo(() => {
    if (!data) return [];
    return data.records.filter(r => !isLabOrTutorialRecord(r));
  }, [data]);

  const labRecords = useMemo(() => {
    if (!data) return [];
    return data.records.filter(isLabOrTutorialRecord);
  }, [data]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    if (!data) return [];
    let list = data.records;
    if (componentFilter === 'THEORY') {
      list = list.filter(r => !isLabOrTutorialRecord(r));
    } else if (componentFilter === 'LAB') {
      list = list.filter(isLabOrTutorialRecord);
    }
    if (filterStatus !== 'ALL') {
      list = list.filter(r => r.status === filterStatus);
    }
    return list;
  }, [data, filterStatus, componentFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error || 'Subject not found.'}</p>
        <Link to="/dashboard" className="btn-secondary">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  const { summary, records } = data;
  const health = getAttendanceHealth(summary.percentage);
  const abbr = getSubjectAbbreviation(summary.course_name);
  // Curriculum & Lecture stats (computed first so we can pass remaining to bunkCalc)
  const config = getStoredSubjectConfig(summary.course_name, records);
  const lectureStats = calculateSubjectLecturesStats(summary.course_name, records, config);

  const bunkCalc = calculateBunkBuffer(summary.present, summary.counted, TARGET_ATTENDANCE, lectureStats.rawTotalRemaining);

  const textColorClass =
    summary.percentage === null
      ? 'text-slate-400'
      : health === 'healthy'
      ? 'text-emerald-600'
      : health === 'warning'
      ? 'text-amber-600'
      : 'text-rose-600';

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Navigation & Action Bar */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors bg-white px-3.5 py-2 rounded-xl border border-slate-200 shadow-2xs hover:shadow-xs"
        >
          <ArrowLeft size={14} />
          Back to Dashboard
        </Link>

        <button
          onClick={() => setIsSettingsModalOpen(true)}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 px-3.5 py-2 rounded-xl transition-all shadow-2xs hover:shadow-xs"
        >
          <Settings2 size={15} />
          Subject Settings
        </button>
      </div>

      {/* Summary Card */}
      <div className="glass-panel p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="font-extrabold text-xs bg-slate-900 text-white px-2.5 py-0.5 rounded-md">
            {abbr}
          </span>
          
          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className={`text-xs font-bold px-2.5 py-0.5 rounded-md border transition-colors ${
              config.hasLabOrTutorial
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
            }`}
            title="Configure course format in settings"
          >
            {config.hasLabOrTutorial ? 'Theory+LAB' : 'Theory/LAB'}
          </button>

          {hasLinkedChildren && (
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
              <Link2 size={12} /> + Practical Linked
            </span>
          )}

          <span
            className={`text-xs font-semibold px-2.5 py-0.5 rounded-md border flex items-center gap-1 ${
              bunkCalc.bunkCount > 0
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : bunkCalc.attendCount > 0
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            <ShieldCheck size={13} />
            {bunkCalc.message}
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">
          {summary.course_name}
        </h1>

        {/* Linked Practical Course Banner */}
        {hasLinkedChildren && (
          <div className="mb-6 p-4 bg-indigo-50/80 border border-indigo-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Link2 size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200/60">
                    Linked Practical Course
                  </span>
                  <span className="text-xs font-bold text-slate-800">
                    {linkedChildren.join(', ')}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Merged into this subject: <strong>{theoryRecords.length} Theory records</strong> ({lectureStats.completedTheory} conducted) + <strong>{labRecords.length} Practical records</strong> ({lectureStats.completedLab} lab sessions conducted).
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsSettingsModalOpen(true)}
              className="text-xs font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-50 border border-indigo-200 px-3.5 py-1.5 rounded-xl transition-all shrink-0 shadow-2xs"
            >
              Configure
            </button>
          </div>
        )}

        <div className="flex flex-col md:flex-row gap-8 items-center md:items-stretch">
          <div className="flex-1 flex flex-col justify-center min-w-[200px] w-full">
            <div className="flex items-baseline gap-2 mb-3">
              <span className={`text-6xl font-black tracking-tight ${textColorClass}`}>
                {summary.percentage !== null ? summary.percentage.toFixed(1) : '--'}
              </span>
              <span className="text-2xl text-slate-400 font-bold">%</span>
            </div>

            <AttendanceProgressBar percentage={summary.percentage} height="md" />
            <div className="flex justify-between text-xs text-slate-400 mt-2 font-medium">
              <span>0%</span>
              <span>Target: {TARGET_ATTENDANCE}%</span>
              <span>100%</span>
            </div>
          </div>

          <div className="hidden md:block w-px bg-slate-200/80" />

          <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3 w-full">
            <StatBox label="Present" value={summary.present} color="text-emerald-600" />
            <StatBox label="Absent" value={summary.absent} color="text-rose-600" />
            <StatBox label="Counted" value={summary.counted} color="text-slate-900" />
            <StatBox label="Not Updated" value={summary.not_updated} color="text-amber-600" />
          </div>
        </div>
      </div>

      {/* LECTURES REMAINING PANEL */}
      <div className="glass-panel p-6 sm:p-7">
        <div className="flex items-center justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Lecture Projections
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Based on {config.totalCredits} credits curriculum across {lectureStats.fixedWeeks} weeks ({config.hasLabOrTutorial ? `${config.theoryWeekly} Theory + ${config.labTutorialWeekly} Lab sessions/wk` : `${config.theoryWeekly || config.labTutorialWeekly || config.totalCredits} sessions/wk`})
            </p>
          </div>

          <button
            onClick={() => setIsSettingsModalOpen(true)}
            className="text-xs font-semibold text-slate-500 hover:text-slate-900 flex items-center gap-1 hover:underline"
          >
            <Settings2 size={13} />
            Adjust
          </button>
        </div>

        {/* Projection Metric Cards */}
        {config.hasLabOrTutorial ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Theory */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
                <span>Theory Sessions</span>
                <span className="text-[11px] bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-bold">
                  {config.theoryWeekly} / wk
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 mb-1">
                {lectureStats.completedTheory} <span className="text-xs font-semibold text-slate-400">/ {lectureStats.plannedTheory}</span>
              </div>
              <span className="text-xs font-bold text-amber-600">
                {lectureStats.remainingTheory} lectures left
              </span>
            </div>

            {/* Lab/Tutorial */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-slate-500 font-semibold mb-1">
                <span>Lab Sessions</span>
                <span className="text-[11px] bg-indigo-50 px-2 py-0.5 rounded text-indigo-700 font-bold">
                  {config.labTutorialWeekly} / wk
                </span>
              </div>
              <div className="text-2xl font-black text-slate-900 mb-1">
                {lectureStats.completedLab} <span className="text-xs font-semibold text-slate-400">/ {lectureStats.plannedLab}</span>
              </div>
              <span className="text-xs font-bold text-amber-600">
                {lectureStats.remainingLab} sessions left
              </span>
            </div>

            {/* Total Remaining */}
            <div className="bg-slate-900 text-white p-4 rounded-xl shadow-xs flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Total Remaining
                </span>
                <div className="text-3xl font-black text-emerald-400">
                  {lectureStats.totalRemaining}
                </div>
              </div>
              <span className="text-xs text-slate-400">
                {lectureStats.totalCompleted} of {lectureStats.totalPlanned} conducted
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500 font-semibold block mb-1">
                  Conducted
                </span>
                <div className="text-3xl font-black text-slate-900">
                  {lectureStats.totalCompleted} <span className="text-xs text-slate-400 font-bold">/ {lectureStats.totalPlanned}</span>
                </div>
              </div>
              <span className="text-xs font-semibold bg-slate-100 text-slate-700 px-3 py-1 rounded-lg">
                {config.totalCredits} credit{config.totalCredits > 1 ? 's' : ''} ({config.theoryWeekly || config.labTutorialWeekly || config.totalCredits} sessions/wk)
              </span>
            </div>

            <div className="bg-slate-900 text-white p-4 rounded-xl shadow-xs flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                  Remaining Lectures
                </span>
                <div className="text-3xl font-black text-emerald-400">
                  {lectureStats.totalRemaining}
                </div>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                15 Weeks Schedule
              </span>
            </div>
          </div>
        )}
      </div>

      {/* History Table */}
      <div className="glass-panel overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900">Session History</h2>
              {hasLinkedChildren && (
                <span className="text-[10px] font-bold bg-indigo-100 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Link2 size={11} /> Linked Practical Included
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Showing {filteredRecords.length} of {records.length} records
              {hasLinkedChildren && ` (${theoryRecords.length} Theory + ${labRecords.length} Practical from ${linkedChildren[0]})`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Component Filter (Theory vs Lab) */}
            {(config.hasLabOrTutorial || hasLinkedChildren || labRecords.length > 0) && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
                <button
                  onClick={() => setComponentFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    componentFilter === 'ALL'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  All ({records.length})
                </button>
                <button
                  onClick={() => setComponentFilter('THEORY')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    componentFilter === 'THEORY'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Theory ({theoryRecords.length})
                </button>
                <button
                  onClick={() => setComponentFilter('LAB')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    componentFilter === 'LAB'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-500 hover:text-indigo-700'
                  }`}
                >
                  Practical ({labRecords.length})
                </button>
              </div>
            )}

            {/* Status Filter Tabs */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-xs font-semibold">
              <button
                onClick={() => setFilterStatus('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterStatus === 'ALL'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Status
              </button>
              <button
                onClick={() => setFilterStatus('P')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterStatus === 'P'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-emerald-700'
                }`}
              >
                P ({summary.present})
              </button>
              <button
                onClick={() => setFilterStatus('A')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterStatus === 'A'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-rose-700'
                }`}
              >
                A ({summary.absent})
              </button>
              {summary.not_updated > 0 && (
                <button
                  onClick={() => setFilterStatus('NU')}
                  className={`px-2.5 py-1 rounded-lg transition-all ${
                    filterStatus === 'NU'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-amber-700'
                  }`}
                >
                  NU ({summary.not_updated})
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200/80">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Date
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Time
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Type / Component
                </th>
                <th scope="col" className="px-5 py-3 font-semibold">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map(record => {
                const isLab = isLabOrTutorialRecord(record);
                const isLinked = !!record.linked_from_course;

                return (
                  <tr
                    key={`${record.date}-${record.start_time}-${record.serial_number}`}
                    className="bg-white hover:bg-slate-50/70 transition-colors"
                  >
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-slate-700 font-medium">
                        <Calendar size={13} className="text-slate-400" />
                        {formatDate(record.date)}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-slate-500 text-xs">
                        <Clock size={13} className="text-slate-400" />
                        <span>{formatTime(record.start_time)} – {formatTime(record.end_time)}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <div className="flex flex-col items-start gap-1">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          isLab
                            ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {isLab ? 'Lab/Practical' : 'Theory'}
                        </span>
                        {isLinked && (
                          <span
                            className="text-[10px] font-semibold text-indigo-600 bg-indigo-50/60 px-1.5 py-0.5 rounded border border-indigo-200/70 truncate max-w-[220px]"
                            title={`Linked from child subject: ${record.linked_from_course}`}
                          >
                            🔗 Linked: {getSubjectAbbreviation(record.linked_from_course!)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 whitespace-nowrap">
                      <AttendanceStatusBadge status={record.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settings Modal */}
      {isSettingsModalOpen && (
        <SubjectSettingsModal
          isOpen={true}
          onClose={() => setIsSettingsModalOpen(false)}
          courseName={summary.course_name}
          records={records}
          onConfigSaved={() => {
            setConfigVersion(v => v + 1);
            if (subjectName) loadData(subjectName);
          }}
        />
      )}
    </div>
  );
}

function StatBox({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 flex flex-col justify-center">
      <span className="text-[11px] font-semibold text-slate-400 mb-0.5">{label}</span>
      <span className={`text-2xl font-black ${color}`}>{value}</span>
    </div>
  );
}

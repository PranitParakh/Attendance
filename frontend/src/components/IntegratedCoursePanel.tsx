import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ChevronRight,
  Search,
  Settings2,
  BookOpen,
  Calendar,
  Link2,
} from 'lucide-react';
import { SubjectSummary, AttendanceRecord, TARGET_ATTENDANCE, getAttendanceHealth } from '../lib/types';
import {
  getSubjectAbbreviation,
  calculateBunkBuffer,
  getStoredSubjectConfig,
  calculateSubjectLecturesStats,
  getStoredMergeMap,
} from '../lib/subjectUtils';
import AttendanceProgressBar from './AttendanceProgressBar';
import SubjectSettingsModal from './SubjectSettingsModal';

interface Props {
  subjects: SubjectSummary[];
  records: AttendanceRecord[];
  onSettingsUpdated: () => void;
}

export default function IntegratedCoursePanel({
  subjects,
  records,
  onSettingsUpdated,
}: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'MET' | 'AT_RISK'>('ALL');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'THEORY' | 'LAB_THEORY'>('ALL');
  const [settingsCourse, setSettingsCourse] = useState<string | null>(null);

  // Compute stats for each subject
  const coursesData = useMemo(() => {
    const mergeMap = getStoredMergeMap();
    return subjects.map(subject => {
      const abbr = getSubjectAbbreviation(subject.course_name);
      const config = getStoredSubjectConfig(subject.course_name, records);
      const lecturesStats = calculateSubjectLecturesStats(subject.course_name, records, config);
      const bunkCalc = calculateBunkBuffer(subject.present, subject.counted, TARGET_ATTENDANCE, lecturesStats.rawTotalRemaining);
      const pct = subject.percentage ?? 0;

      const linkedChildren = Object.entries(mergeMap)
        .filter(([, parent]) => parent === subject.course_name)
        .map(([child]) => child);
      const hasLinkedChildren = linkedChildren.length > 0;

      let status: 'met' | 'warning' | 'critical' = 'met';
      if (pct < 75) {
        status = 'critical';
      } else if (pct < TARGET_ATTENDANCE) {
        status = 'warning';
      }

      return {
        subject,
        abbr,
        config,
        lecturesStats,
        bunkCalc,
        status,
        pct,
        linkedChildren,
        hasLinkedChildren,
      };
    });
  }, [subjects, records]);

  // Overall criteria stats
  const totalCourses = coursesData.length;
  const metCount = coursesData.filter(c => c.status === 'met').length;
  const atRiskCount = totalCourses - metCount;
  const theoryOnlyCount = coursesData.filter(c => !c.config.hasLabOrTutorial).length;
  const labTheoryCount = coursesData.filter(c => c.config.hasLabOrTutorial).length;

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return coursesData.filter(item => {
      if (statusFilter === 'MET' && item.status !== 'met') return false;
      if (statusFilter === 'AT_RISK' && item.status === 'met') return false;

      if (typeFilter === 'THEORY' && item.config.hasLabOrTutorial) return false;
      if (typeFilter === 'LAB_THEORY' && !item.config.hasLabOrTutorial) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = item.subject.course_name.toLowerCase().includes(q);
        const matchesAbbr = item.abbr.toLowerCase().includes(q);
        if (!matchesName && !matchesAbbr) return false;
      }
      return true;
    });
  }, [coursesData, statusFilter, typeFilter, searchQuery]);

  return (
    <div className="glass-panel p-6 sm:p-8 animate-fade-in">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <BookOpen size={20} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Courses
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {metCount} of {totalCourses} courses meeting {TARGET_ATTENDANCE}% target
            </p>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Search bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search course..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:bg-white w-40 sm:w-48 transition-all"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All ({totalCourses})
            </button>
            <button
              onClick={() => setStatusFilter('MET')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                statusFilter === 'MET'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-emerald-700'
              }`}
            >
              Safe ({metCount})
            </button>
            {atRiskCount > 0 && (
              <button
                onClick={() => setStatusFilter('AT_RISK')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  statusFilter === 'AT_RISK'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-500 hover:text-rose-700'
                }`}
              >
                At Risk ({atRiskCount})
              </button>
            )}
          </div>

          {/* Format Tabs: Theory/LAB vs Theory+LAB */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                typeFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter('THEORY')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                typeFilter === 'THEORY'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Theory/LAB ({theoryOnlyCount})
            </button>
            <button
              onClick={() => setTypeFilter('LAB_THEORY')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                typeFilter === 'LAB_THEORY'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-500 hover:text-indigo-700'
              }`}
            >
              Theory+LAB ({labTheoryCount})
            </button>
          </div>
        </div>
      </div>

      {/* Grid of Clean Course Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredCourses.map(item => {
          const { subject, abbr, config, lecturesStats, bunkCalc, hasLinkedChildren, linkedChildren } = item;
          const health = getAttendanceHealth(subject.percentage);

          const textColorClass =
            subject.percentage === null ? 'text-slate-400' :
            health === 'healthy' ? 'text-emerald-600' :
            health === 'warning' ? 'text-amber-600' :
            'text-rose-600';

          return (
            <div
              key={subject.course_name}
              className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Top Row: Abbr + Format Badge + Linked Badge + Settings Icon */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-xs bg-slate-900 text-white px-2.5 py-0.5 rounded-md">
                      {abbr}
                    </span>

                    {/* Format Badge (Opens Settings Modal on click) */}
                    <button
                      type="button"
                      onClick={() => setSettingsCourse(subject.course_name)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border transition-colors ${
                        config.hasLabOrTutorial
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                      title="Click to configure subject format in settings"
                    >
                      {config.hasLabOrTutorial ? 'Theory+LAB' : 'Theory/LAB'}
                    </button>

                    {hasLinkedChildren && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1"
                        title={`Linked practical course: ${linkedChildren.join(', ')}`}
                      >
                        <Link2 size={10} /> + Practical Linked
                      </span>
                    )}
                  </div>

                  {/* Settings Gear Button */}
                  <button
                    type="button"
                    onClick={() => setSettingsCourse(subject.course_name)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                    title="Open subject settings"
                  >
                    <Settings2 size={16} />
                  </button>
                </div>

                {/* Course Name */}
                <Link
                  to={`/subject/${encodeURIComponent(subject.course_name)}`}
                  className="font-bold text-slate-900 hover:text-indigo-600 transition-colors text-sm line-clamp-1 block mb-1"
                  title={subject.course_name}
                >
                  {subject.course_name}
                </Link>

                {/* Linked Component Info Line */}
                {hasLinkedChildren && (
                  <div
                    className="text-[11px] font-semibold text-indigo-600 mb-2.5 truncate flex items-center gap-1 bg-indigo-50/70 px-2 py-0.5 rounded-md border border-indigo-100"
                    title={`Linked course: ${linkedChildren.join(', ')}`}
                  >
                    <Link2 size={11} className="shrink-0" />
                    <span className="truncate">Linked: {linkedChildren.join(', ')}</span>
                  </div>
                )}

                {/* Percentage & Present/Absent badges */}
                <div className="flex items-baseline justify-between mb-2">
                  <div className="flex items-baseline gap-1">
                    <span className={`text-3xl font-black tracking-tight ${textColorClass}`}>
                      {subject.percentage !== null ? subject.percentage.toFixed(1) : '--'}
                    </span>
                    <span className="text-sm font-bold text-slate-400">%</span>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs font-semibold">
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                      {subject.present} P
                    </span>
                    <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-100">
                      {subject.absent} A
                    </span>
                    {subject.not_updated > 0 && (
                      <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100" title="Not Updated">
                        {subject.not_updated} NU
                      </span>
                    )}
                  </div>
                </div>

                {/* Mini Progress Bar */}
                <div className="mb-3.5">
                  <AttendanceProgressBar percentage={subject.percentage} height="sm" />
                </div>

                {/* Session Projection (Clean, Single Line, No Repetition) */}
                <div className="bg-slate-50 rounded-xl px-3 py-2 text-xs text-slate-600 mb-3 flex items-center justify-between border border-slate-100">
                  <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                    <Calendar size={13} className="text-slate-400" />
                    {config.hasLabOrTutorial ? (
                      <span>Theory: <strong>{lecturesStats.completedTheory}/{lecturesStats.plannedTheory}</strong> • Lab: <strong>{lecturesStats.completedLab}/{lecturesStats.plannedLab}</strong></span>
                    ) : (
                      <span>Conducted: <strong>{lecturesStats.totalCompleted} of {lecturesStats.totalPlanned}</strong></span>
                    )}
                  </span>
                  <span className="font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                    {lecturesStats.totalRemaining} left
                  </span>
                </div>
              </div>

              {/* Card Footer: Bunk buffer & Link */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className={`font-semibold px-2.5 py-0.5 rounded-md text-[11px] ${
                  bunkCalc.bunkCount > 0
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : bunkCalc.attendCount > 0
                    ? 'bg-rose-50 text-rose-700 border border-rose-100'
                    : 'bg-amber-50 text-amber-700 border border-amber-100'
                }`}>
                  {bunkCalc.message}
                </span>

                <Link
                  to={`/subject/${encodeURIComponent(subject.course_name)}`}
                  className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 font-semibold px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  History <ChevronRight size={14} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {filteredCourses.length === 0 && (
        <div className="py-12 text-center text-slate-400">
          <BookOpen size={32} className="mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-medium">No courses match your filter or search query.</p>
        </div>
      )}

      {/* Curriculum Settings Modal */}
      {settingsCourse && (
        <SubjectSettingsModal
          isOpen={true}
          onClose={() => setSettingsCourse(null)}
          courseName={settingsCourse}
          records={records}
          onConfigSaved={() => {
            onSettingsUpdated();
          }}
        />
      )}
    </div>
  );
}

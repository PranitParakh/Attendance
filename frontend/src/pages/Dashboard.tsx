import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Trash2, RefreshCw, CheckCircle, Sliders, Calendar, RotateCcw } from 'lucide-react';
import { getCurrentAttendance, deleteCurrentAttendance } from '../lib/api';
import type { AttendanceDataset } from '../lib/types';
import OverallAttendanceCard from '../components/OverallAttendanceCard';
import AttendanceAnalytics from '../components/AttendanceAnalytics';
import IntegratedCoursePanel from '../components/IntegratedCoursePanel';
import SyncModal from '../components/SyncModal';
import NuPolicySelector from '../components/NuPolicySelector';
import NuIndividualModal from '../components/NuIndividualModal';
import {
  NuPolicy,
  simulateAttendanceWithNuPolicy,
  getStoredMergeMap,
  getStoredDeletedSubjects,
  applySubjectMergeMap,
  recalculateOverallSummary,
  clearAllAttendlyStorage,
} from '../lib/subjectUtils';

function formatDisplayDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  // Format DD.MM.YYYY
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) {
    const [d, m, y] = dateStr.split('.');
    const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
    if (!isNaN(dateObj.getTime())) {
      return dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return dateStr;
  }
  // Format YYYY-MM-DD
  const dateObj = new Date(dateStr);
  if (!isNaN(dateObj.getTime())) {
    return dateObj.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  return dateStr;
}

export default function Dashboard() {
  const [data, setData] = useState<AttendanceDataset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [showSyncSuccess, setShowSyncSuccess] = useState(false);
  const [settingsVersion, setSettingsVersion] = useState(0);
  
  // NU Policy and Individual overrides state
  const [nuPolicy, setNuPolicy] = useState<NuPolicy>(() => {
    return (localStorage.getItem('attendly_nu_policy') as NuPolicy) || 'ignored';
  });
  
  const [individualOverrides, setIndividualOverrides] = useState<Record<string, 'P' | 'A' | 'NU'>>(() => {
    try {
      const saved = localStorage.getItem('attendly_nu_overrides');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const [isNuModalOpen, setIsNuModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const dataset = await getCurrentAttendance();
      setData(dataset);
    } catch (err: any) {
      if (err.status === 404) {
        navigate('/');
      } else {
        setError('Failed to load attendance data. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearData = () => {
    setIsResetModalOpen(true);
  };

  const executeCompleteReset = async () => {
    setIsResetting(true);
    try {
      await deleteCurrentAttendance();
    } catch (err) {
      console.warn('Backend delete notification:', err);
    } finally {
      clearAllAttendlyStorage();
      setData(null);
      setIndividualOverrides({});
      setNuPolicy('ignored');
      setIsResetting(false);
      setIsResetModalOpen(false);
      navigate('/');
    }
  };

  const handleSyncSuccess = () => {
    loadData();
    setShowSyncSuccess(true);
    setTimeout(() => setShowSyncSuccess(false), 5000);
  };

  const handleSelectPolicy = (newPolicy: NuPolicy) => {
    setNuPolicy(newPolicy);
    localStorage.setItem('attendly_nu_policy', newPolicy);
  };

  const handleSaveIndividualOverrides = (newOverrides: Record<string, 'P' | 'A' | 'NU'>) => {
    setIndividualOverrides(newOverrides);
    localStorage.setItem('attendly_nu_overrides', JSON.stringify(newOverrides));
    setNuPolicy('individual');
    localStorage.setItem('attendly_nu_policy', 'individual');
  };

  // Extract all NU records from current dataset
  const nuRecords = useMemo(() => {
    if (!data) return [];
    return data.records.filter(r => r.status === 'NU');
  }, [data]);

  // Dynamically calculate attendance under the chosen NU policy
  const simulatedData = useMemo(() => {
    if (!data) return null;
    return simulateAttendanceWithNuPolicy(data.records, nuPolicy, individualOverrides);
  }, [data, nuPolicy, individualOverrides]);

  // Apply subject merge map (combines separate Theory + LAB subjects)
  // and recompute the overall summary so the top-level card always
  // matches the per-subject cards shown below it.
  const mergedSimulatedData = useMemo(() => {
    if (!simulatedData) return null;
    const mergeMap = getStoredMergeMap();
    const deletedSubjects = getStoredDeletedSubjects();
    const { mergedRecords, mergedSubjects } = applySubjectMergeMap(
      simulatedData.records,
      simulatedData.subjects,
      mergeMap,
      deletedSubjects
    );
    return {
      ...simulatedData,
      records: mergedRecords,
      subjects: mergedSubjects,
      overall: recalculateOverallSummary(mergedSubjects),
    };
  }, [simulatedData, settingsVersion]);

  const individualDecidedCount = useMemo(() => {
    return Object.values(individualOverrides).filter(v => v === 'P' || v === 'A').length;
  }, [individualOverrides]);

  const { latestRecordDate, earliestRecordDate } = useMemo(() => {
    if (!data?.records || data.records.length === 0) {
      return {
        latestRecordDate: data?.metadata?.latest_record_date || null,
        earliestRecordDate: data?.metadata?.earliest_record_date || null,
      };
    }
    const validDates = data.records.map(r => r.date).filter(Boolean);
    if (validDates.length === 0) {
      return {
        latestRecordDate: data?.metadata?.latest_record_date || null,
        earliestRecordDate: data?.metadata?.earliest_record_date || null,
      };
    }
    return {
      latestRecordDate: data?.metadata?.latest_record_date || validDates.reduce((a, b) => (b > a ? b : a)),
      earliestRecordDate: data?.metadata?.earliest_record_date || validDates.reduce((a, b) => (b < a ? b : a)),
    };
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="animate-spin text-slate-700" size={36} />
        <p className="text-sm font-medium text-slate-500">Loading attendance data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error}</p>
        <button onClick={loadData} className="btn-secondary">Try Again</button>
      </div>
    );
  }

  if (!data || !simulatedData || !mergedSimulatedData) return null;

  const isPortalImport = data.source_filename === 'portal_fetch.pdf';

  return (
    <div className="space-y-6 sm:space-y-7">
      {/* Toast Notification for successful sync */}
      {showSyncSuccess && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 bg-emerald-900 text-white px-4 py-2.5 rounded-xl shadow-xl border border-emerald-700 animate-fade-in text-xs font-semibold">
          <CheckCircle size={16} className="text-emerald-400" />
          <span>Attendance synced with latest portal records!</span>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in pb-1">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
              isPortalImport
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isPortalImport ? 'bg-emerald-500' : 'bg-blue-500'}`} />
              {isPortalImport ? 'Portal Synced' : 'PDF Report'}
            </span>

            {data.metadata.student_number && (
              <span className="text-[11px] text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                ID: {data.metadata.student_number}
              </span>
            )}

            {latestRecordDate && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Calendar size={12} className="text-indigo-600 shrink-0" />
                Latest: {formatDisplayDate(latestRecordDate)}
              </span>
            )}
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            {data.metadata.student_name}
          </h1>

          <p className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5">
            {data.metadata.semester ? `Semester ${data.metadata.semester}` : 'Current Term'}
            {data.metadata.program && ` • ${data.metadata.program}`}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={() => navigate('/setup')}
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-white text-slate-800 border border-slate-200 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all py-2 px-3.5 rounded-xl"
            title="Configure abbreviations, credits, and course formats"
          >
            <Sliders size={14} className="text-slate-500" />
            Curriculum Setup
          </button>

          <button
            onClick={() => setIsSyncModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-white text-slate-800 border border-slate-200 shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all py-2 px-3.5 rounded-xl"
          >
            <RefreshCw size={14} className="text-slate-500" />
            Sync Portal
          </button>

          <button
            id="reset-dashboard-button"
            onClick={handleClearData}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-500/80 hover:text-rose-600 transition-colors py-2 px-2.5 hover:bg-rose-50 rounded-xl cursor-pointer border border-rose-200/60"
            title="Complete software reset: wipes database, subjects, and mappings"
          >
            <RotateCcw size={14} className="text-rose-500" />
            <span>Reset</span>
          </button>
        </div>
      </div>


      {/* Overall Card (Reflects Active NU Simulation) */}
      <section>
        <OverallAttendanceCard
          summary={mergedSimulatedData.overall}
          latestRecordDate={latestRecordDate ? formatDisplayDate(latestRecordDate) : undefined}
        />
      </section>

      {/* Interactive NU Simulation Option Prompt (4 Options: IGNORED, ALL PRESENT, ALL ABSENT, DECIDED INDIVIDUALLY) */}
      {nuRecords.length > 0 && (
        <section>
          <NuPolicySelector
            policy={nuPolicy}
            onSelectPolicy={handleSelectPolicy}
            nuCount={nuRecords.length}
            onOpenIndividualModal={() => setIsNuModalOpen(true)}
            individualDecidedCount={individualDecidedCount}
            officialPercentage={data.overall.overall_percentage}
            simulatedPercentage={simulatedData.overall.overall_percentage}
          />
        </section>
      )}

      {/* Integrated Course Breakdown & Attendance Criteria Panel */}
      <section>
        <IntegratedCoursePanel
          key={settingsVersion}
          subjects={mergedSimulatedData.subjects}
          records={mergedSimulatedData.records}
          onSettingsUpdated={() => setSettingsVersion(v => v + 1)}
        />
      </section>

      {/* Visual Analytics & Trends (Recharts with Normalized Subject Abbreviations) */}
      <section>
        <AttendanceAnalytics records={mergedSimulatedData.records} subjects={mergedSimulatedData.subjects} />
      </section>

      {/* Portal Re-Sync Modal */}
      <SyncModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        onSuccess={handleSyncSuccess}
      />

      {/* NU Individual Lecture Decision Panel */}
      <NuIndividualModal
        isOpen={isNuModalOpen}
        onClose={() => setIsNuModalOpen(false)}
        nuRecords={nuRecords}
        overrides={individualOverrides}
        onSaveOverrides={handleSaveIndividualOverrides}
      />

      {/* Complete Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-6">
              <div className="flex items-center gap-3.5 mb-4 text-rose-600">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center shrink-0">
                  <RotateCcw className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Complete Software Reset</h3>
                  <p className="text-xs text-slate-500">Wipe all databases, configurations & mappings</p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">
                This will permanently delete <strong>all attendance records</strong> from the database, 
                clear all <strong>subject names, credits, and weekly lecture settings</strong>, and remove all 
                <strong> linked lab mappings</strong>. The software will return to a completely dynamic, clean state.
              </p>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 mb-5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>SQLite database attendance records & datasets deleted</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>Curriculum credits & weekly lecture configs purged</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>Linked lab parent-child merge mappings removed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                  <span>NU individual overrides and policies reset</span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  id="cancel-reset-button"
                  onClick={() => setIsResetModalOpen(false)}
                  disabled={isResetting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="confirm-reset-button"
                  onClick={executeCompleteReset}
                  disabled={isResetting}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  {isResetting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reset Everything
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

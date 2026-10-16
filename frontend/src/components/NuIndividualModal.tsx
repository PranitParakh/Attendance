import { useState, useMemo } from 'react';
import { X, Check, AlertCircle, Sparkles, Filter, CheckCircle2, XCircle, MinusCircle, RefreshCw } from 'lucide-react';
import { AttendanceRecord } from '../lib/types';
import { getRecordKey, getSubjectAbbreviation } from '../lib/subjectUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  nuRecords: AttendanceRecord[];
  overrides: Record<string, 'P' | 'A' | 'NU'>;
  onSaveOverrides: (overrides: Record<string, 'P' | 'A' | 'NU'>) => void;
}

export default function NuIndividualModal({
  isOpen,
  onClose,
  nuRecords,
  overrides,
  onSaveOverrides,
}: Props) {
  // Local state for edits inside the modal before saving
  const [localOverrides, setLocalOverrides] = useState<Record<string, 'P' | 'A' | 'NU'>>(overrides);
  const [selectedSubject, setSelectedSubject] = useState<string>('ALL');
  const [filterDecision, setFilterDecision] = useState<'ALL' | 'DECIDED' | 'UNDECIDED'>('ALL');

  // Keep local state in sync when modal opens
  useState(() => {
    setLocalOverrides(overrides);
  });

  // Extract unique subjects among NU records
  const subjects = useMemo(() => {
    const set = new Set<string>();
    nuRecords.forEach(r => set.add(r.course_normalized));
    return Array.from(set).sort();
  }, [nuRecords]);

  // Filtered NU records
  const filteredRecords = useMemo(() => {
    return nuRecords.filter(r => {
      if (selectedSubject !== 'ALL' && r.course_normalized !== selectedSubject) {
        return false;
      }
      const key = getRecordKey(r);
      const decision = localOverrides[key];
      if (filterDecision === 'DECIDED' && (!decision || decision === 'NU')) {
        return false;
      }
      if (filterDecision === 'UNDECIDED' && (decision === 'P' || decision === 'A')) {
        return false;
      }
      return true;
    });
  }, [nuRecords, selectedSubject, filterDecision, localOverrides]);

  // Stats on local decisions
  const stats = useMemo(() => {
    let presentCount = 0;
    let absentCount = 0;
    let ignoredCount = 0;

    for (const r of nuRecords) {
      const key = getRecordKey(r);
      const dec = localOverrides[key];
      if (dec === 'P') presentCount++;
      else if (dec === 'A') absentCount++;
      else ignoredCount++;
    }

    return { presentCount, absentCount, ignoredCount, total: nuRecords.length };
  }, [nuRecords, localOverrides]);

  if (!isOpen) return null;

  const setDecision = (key: string, value: 'P' | 'A' | 'NU') => {
    setLocalOverrides(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const setBulkFiltered = (value: 'P' | 'A' | 'NU') => {
    setLocalOverrides(prev => {
      const next = { ...prev };
      for (const r of filteredRecords) {
        const key = getRecordKey(r);
        next[key] = value;
      }
      return next;
    });
  };

  const handleResetAll = () => {
    if (confirm('Reset all individual lecture choices back to Ignored?')) {
      setLocalOverrides({});
    }
  };

  const handleSave = () => {
    onSaveOverrides(localOverrides);
    onClose();
  };

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    });
  };

  const formatTime = (timeStr: string) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden animate-slide-up">
        
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Decide NU Lectures Individually
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Mark your actual presence for {nuRecords.length} un-updated lectures to see your true attendance
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-2 rounded-xl hover:bg-slate-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filters and Bulk Action Toolbar */}
        <div className="p-4 sm:px-6 bg-slate-50/80 border-b border-slate-200/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Subject Filter */}
            <div className="flex items-center gap-1.5 bg-white border border-slate-200 px-3 py-1.5 rounded-xl shadow-xs text-xs">
              <Filter size={13} className="text-slate-400" />
              <select
                value={selectedSubject}
                onChange={e => setSelectedSubject(e.target.value)}
                className="bg-transparent font-medium text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">All Subjects ({nuRecords.length})</option>
                {subjects.map(s => (
                  <option key={s} value={s}>
                    {getSubjectAbbreviation(s)} - {s}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-xs text-xs font-medium">
              <button
                onClick={() => setFilterDecision('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterDecision === 'ALL'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All ({nuRecords.length})
              </button>
              <button
                onClick={() => setFilterDecision('DECIDED')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterDecision === 'DECIDED'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Decided ({stats.presentCount + stats.absentCount})
              </button>
              <button
                onClick={() => setFilterDecision('UNDECIDED')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  filterDecision === 'UNDECIDED'
                    ? 'bg-slate-800 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ignored ({stats.ignoredCount})
              </button>
            </div>
          </div>

          {/* Bulk Buttons for current filter */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium mr-1 hidden sm:inline">Set visible to:</span>
            <button
              onClick={() => setBulkFiltered('P')}
              className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/80 rounded-lg font-semibold flex items-center gap-1 transition-colors"
              title="Mark all matching records as Present"
            >
              <CheckCircle2 size={13} />
              All Present
            </button>
            <button
              onClick={() => setBulkFiltered('A')}
              className="px-2.5 py-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/80 rounded-lg font-semibold flex items-center gap-1 transition-colors"
              title="Mark all matching records as Absent"
            >
              <XCircle size={13} />
              All Absent
            </button>
            <button
              onClick={() => setBulkFiltered('NU')}
              className="px-2.5 py-1.5 bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200 rounded-lg font-semibold flex items-center gap-1 transition-colors"
              title="Reset visible to Ignored"
            >
              <MinusCircle size={13} />
              Reset
            </button>
          </div>
        </div>

        {/* Scrollable Records List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 px-4 sm:px-6 py-2">
          {filteredRecords.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <AlertCircle size={32} className="mx-auto mb-2 text-slate-300" />
              <p className="text-sm font-medium">No NU lectures match the selected filters.</p>
            </div>
          ) : (
            filteredRecords.map((r, idx) => {
              const key = getRecordKey(r);
              const decision = localOverrides[key] || 'NU';
              const abbr = getSubjectAbbreviation(r.course_normalized);

              return (
                <div
                  key={key || idx}
                  className="py-3 sm:py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/60 px-2 rounded-xl transition-colors"
                >
                  {/* Left: Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-bold text-xs bg-slate-800 text-white px-2 py-0.5 rounded-md">
                        {abbr}
                      </span>
                      <span className="text-xs text-slate-500 font-medium">
                        {formatDate(r.date)} • {formatTime(r.start_time)} - {formatTime(r.end_time)}
                      </span>
                      <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                        {r.course_raw.split(' ').slice(-2).join(' ')}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-slate-800 truncate" title={r.course_normalized}>
                      {r.course_normalized}
                    </p>
                  </div>

                  {/* Right: Decision Pills */}
                  <div className="flex items-center gap-1.5 self-start sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={() => setDecision(key, 'P')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                        decision === 'P'
                          ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30'
                          : 'bg-emerald-50/70 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'
                      }`}
                    >
                      <CheckCircle2 size={13} />
                      Present
                    </button>

                    <button
                      type="button"
                      onClick={() => setDecision(key, 'A')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                        decision === 'A'
                          ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-500/30'
                          : 'bg-rose-50/70 text-rose-700 hover:bg-rose-100 border border-rose-200/60'
                      }`}
                    >
                      <XCircle size={13} />
                      Absent
                    </button>

                    <button
                      type="button"
                      onClick={() => setDecision(key, 'NU')}
                      className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                        decision === 'NU'
                          ? 'bg-slate-700 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-500 hover:text-slate-800 border border-slate-200/60'
                      }`}
                      title="Keep as Not Updated / Ignored"
                    >
                      Ignored
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Summary Pills */}
          <div className="flex items-center gap-3 text-xs font-semibold">
            <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
              <CheckCircle2 size={13} />
              {stats.presentCount} Marked Present
            </span>
            <span className="flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-lg">
              <XCircle size={13} />
              {stats.absentCount} Marked Absent
            </span>
            <span className="flex items-center gap-1 text-slate-600 bg-slate-200/60 px-2.5 py-1 rounded-lg">
              {stats.ignoredCount} Ignored
            </span>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              onClick={handleResetAll}
              className="text-xs text-slate-500 hover:text-slate-800 px-3 py-2 rounded-xl hover:bg-slate-200/60 transition-colors font-medium flex items-center gap-1"
            >
              <RefreshCw size={13} />
              Reset All
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <Check size={14} />
              Apply Decisions
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

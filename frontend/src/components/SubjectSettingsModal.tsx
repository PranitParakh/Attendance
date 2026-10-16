import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Sliders } from 'lucide-react';
import { AttendanceRecord } from '../lib/types';
import {
  SubjectCurriculumConfig,
  getSubjectAbbreviation,
  getStoredSubjectConfig,
  saveStoredSubjectConfig,
  getDefaultSubjectConfig,
  calculateSubjectLecturesStats,
  getStoredMergeMap,
  saveStoredMergeMap,
  SubjectMergeMap,
} from '../lib/subjectUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  courseName: string;
  records: AttendanceRecord[];
  onConfigSaved: () => void;
}

export default function SubjectSettingsModal({
  isOpen,
  onClose,
  courseName,
  records,
  onConfigSaved,
}: Props) {
  const [config, setConfig] = useState<SubjectCurriculumConfig>(() =>
    getStoredSubjectConfig(courseName, records)
  );
  const [mergeMap, setMergeMap] = useState<SubjectMergeMap>(() => getStoredMergeMap());

  useEffect(() => {
    if (isOpen) {
      setConfig(getStoredSubjectConfig(courseName, records));
      setMergeMap(getStoredMergeMap());
    }
  }, [isOpen, courseName, records]);

  if (!isOpen) return null;

  const abbr = getSubjectAbbreviation(courseName);
  const previewStats = calculateSubjectLecturesStats(courseName, records, config);
  const children = Object.entries(mergeMap)
    .filter(([, parent]) => parent === courseName)
    .map(([child]) => child);

  const handleSave = () => {
    saveStoredSubjectConfig(courseName, config);
    saveStoredMergeMap(mergeMap);
    onConfigSaved();
    onClose();
  };

  const handleUnlinkChild = (childName: string) => {
    setMergeMap(prev => {
      const next = { ...prev };
      delete next[childName];
      return next;
    });
  };

  const handleReset = () => {
    const defaultConfig = getDefaultSubjectConfig(courseName, records);
    setConfig(defaultConfig);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
              <Sliders size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                  {abbr}
                </span>
                <h2 className="text-base font-bold text-slate-900">
                  Subject Settings
                </h2>
              </div>
              <p className="text-xs text-slate-500 truncate max-w-xs sm:max-w-sm" title={courseName}>
                {courseName}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          
          {/* Abbreviation Input */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
              Course Abbreviation
            </label>
            <input
              type="text"
              maxLength={10}
              value={config.abbreviation || ''}
              onChange={e => setConfig(prev => ({ ...prev, abbreviation: e.target.value.toUpperCase() }))}
              placeholder="e.g. DSA"
              className="w-full px-3 py-2 text-xs font-bold uppercase bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
            />
          </div>

          {/* Format Toggle: Theory/LAB vs Theory+LAB */}
          <div>
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
              Course Format
            </label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setConfig(prev => ({
                  ...prev,
                  format: 'theory_or_lab',
                  hasLabOrTutorial: false,
                  theoryWeekly: prev.totalCredits > 1 ? prev.totalCredits : 0,
                  labTutorialWeekly: prev.totalCredits === 1 ? 1 : 0,
                }))}
                className={`py-2 text-xs font-bold rounded-lg transition-all text-center ${
                  !config.hasLabOrTutorial
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Theory/LAB
              </button>
              <button
                type="button"
                onClick={() => setConfig(prev => ({
                  ...prev,
                  format: 'theory_and_lab',
                  hasLabOrTutorial: true,
                  countTwoHoursAsOne: true,
                  theoryWeekly: Math.max(1, prev.totalCredits - 1),
                  labTutorialWeekly: 1,
                }))}
                className={`py-2 text-xs font-bold rounded-lg transition-all text-center ${
                  config.hasLabOrTutorial
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Theory+LAB
              </button>
            </div>
          </div>

          {/* Credits and Weekly Distribution */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Total Credits
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={config.totalCredits}
                onChange={e => {
                  const credits = Math.max(1, parseInt(e.target.value, 10) || 1);
                  setConfig(prev => {
                    const isPureLabCourse = prev.theoryWeekly === 0 && prev.labTutorialWeekly > 0;
                    if (isPureLabCourse) {
                      return {
                        ...prev,
                        totalCredits: credits,
                        theoryWeekly: 0,
                        labTutorialWeekly: credits,
                      };
                    }
                    if (prev.hasLabOrTutorial) {
                      const lw = Math.max(1, prev.labTutorialWeekly || 1);
                      return {
                        ...prev,
                        totalCredits: credits,
                        theoryWeekly: Math.max(1, credits - lw),
                        labTutorialWeekly: lw,
                      };
                    }
                    return {
                      ...prev,
                      totalCredits: credits,
                      theoryWeekly: credits,
                      labTutorialWeekly: 0,
                    };
                  });
                }}
                className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-bold text-slate-900"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                {config.totalCredits * 15} total sessions (15 wks)
              </span>
            </div>

            {config.hasLabOrTutorial ? (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Theory/Wk
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={config.theoryWeekly}
                    onChange={e => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                      setConfig(prev => ({
                        ...prev,
                        theoryWeekly: val,
                        totalCredits: Math.max(1, val + (prev.labTutorialWeekly || 0)),
                      }));
                    }}
                    className="w-full px-2.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Lab/Wk
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="10"
                    value={config.labTutorialWeekly}
                    onChange={e => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                      setConfig(prev => ({
                        ...prev,
                        labTutorialWeekly: val,
                        totalCredits: Math.max(1, (prev.theoryWeekly || 0) + val),
                      }));
                    }}
                    className="w-full px-2.5 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-bold text-slate-900"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  {config.theoryWeekly === 0 && config.labTutorialWeekly > 0 ? 'Lab Sessions/Week' : 'Lectures/Week'}
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={config.theoryWeekly === 0 && config.labTutorialWeekly > 0 ? config.labTutorialWeekly : config.theoryWeekly}
                  onChange={e => {
                    const val = Math.max(1, parseInt(e.target.value, 10) || 1);
                    setConfig(prev => {
                      if (prev.theoryWeekly === 0 && prev.labTutorialWeekly > 0) {
                        return {
                          ...prev,
                          labTutorialWeekly: val,
                          totalCredits: val,
                        };
                      }
                      return {
                        ...prev,
                        theoryWeekly: val,
                        totalCredits: val,
                      };
                    });
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900 focus:bg-white font-bold text-slate-900"
                />
              </div>
            )}
          </div>

          {/* Linked Lab Component (if mapped) */}
          {children.length > 0 && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2">
              <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wider block">
                Linked Lab Components
              </span>
              {children.map(childName => (
                <div key={childName} className="flex items-center justify-between bg-white p-2 rounded-lg border border-indigo-100 text-xs">
                  <span className="font-bold text-slate-800 truncate" title={childName}>
                    {childName}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUnlinkChild(childName)}
                    className="text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2 py-0.5 rounded transition-colors ml-2 shrink-0"
                  >
                    Unlink
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* 2-hour lab toggle */}
          {(config.hasLabOrTutorial || (config.theoryWeekly === 0 && config.labTutorialWeekly > 0) || children.length > 0) && (
            <label className="flex items-center gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100/60 transition-colors">
              <input
                type="checkbox"
                checked={config.countTwoHoursAsOne}
                onChange={e => setConfig(prev => ({ ...prev, countTwoHoursAsOne: e.target.checked }))}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
              <div className="text-xs">
                <span className="font-bold text-slate-900 block">Count 2-hour lab slot as 1 session</span>
                <span className="text-slate-500 text-[11px]">Pairs consecutive same-day lab records</span>
              </div>
            </label>
          )}

          {/* Live Preview Bar */}
          <div className="bg-slate-900 text-white p-3.5 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-bold tracking-wider">Projected Remaining</span>
              <span className="text-base font-extrabold text-emerald-400">{previewStats.totalRemaining} sessions</span>
            </div>
            <div className="text-right text-slate-300 text-[11px]">
              {config.hasLabOrTutorial ? (
                <span>Theory: {previewStats.remainingTheory} left • Lab: {previewStats.remainingLab} left</span>
              ) : (
                <span>{previewStats.totalCompleted} of {previewStats.totalPlanned} conducted</span>
              )}
            </div>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <button
            type="button"
            onClick={handleReset}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
          >
            Reset
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
            >
              <Check size={14} />
              Save
            </button>
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}

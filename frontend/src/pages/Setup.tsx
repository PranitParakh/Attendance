import { useEffect, useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  BookOpen,
  Sparkles,
  CheckCircle2,
  Sliders,
  ArrowRight,
  Loader2,
  Clock,
  Layers,
  Link2,
  Unlink,
  ChevronDown,
  ChevronUp,
  X,
  Trash2,
  FlaskConical,
  Plus,
  RotateCcw,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { getCurrentAttendance } from '../lib/api';
import type { AttendanceDataset, SubjectSummary } from '../lib/types';
import {
  SubjectCurriculumConfig,
  getDefaultSubjectConfig,
  getStoredCurriculumSettings,
  saveAllStoredCurriculumSettings,
  isLabOrTutorialRecord,
  getStoredMergeMap,
  saveStoredMergeMap,
  SubjectMergeMap,
  getStoredDeletedSubjects,
  saveStoredDeletedSubjects,
  getSubjectAbbreviation,
  calculateSubjectLecturesStats,
} from '../lib/subjectUtils';

/**
 * Intelligent helper to find a likely lab counterpart for a theory subject.
 * E.g., for "CONCRETE TECHNOLOGY TH-CE", finds "CONCRETE TECHNOLOGY PR-CE"
 * or for "DATA STRUCTURES & ALGORITHMS", finds "DATA STRUCTURES & ALGORITHMS LAB".
 */
function findSuggestedLab(parentName: string, candidateSubjects: string[]): string | null {
  const pUpper = parentName.toUpperCase();
  // Strip common theory markers to get the base stem
  const pClean = pUpper
    .replace(/\s*(?:TH-CE|TH|THEORY|T\d+|T1:.*|T1-.*).*/g, '')
    .trim();

  if (pClean.length < 3) return null;

  for (const candidate of candidateSubjects) {
    if (candidate === parentName) continue;
    const cUpper = candidate.toUpperCase();

    // Must look like a lab / practical / tutorial
    const looksLikeLab =
      cUpper.includes('PR') ||
      cUpper.includes('LAB') ||
      cUpper.includes('P1') ||
      cUpper.includes('U1') ||
      cUpper.includes('E1');

    if (!looksLikeLab) continue;

    const cClean = cUpper
      .replace(/\s*(?:PR-CE|PR|LAB|PRACTICAL|P\d+|U\d+|P1:.*|P1-.*|E1).*/g, '')
      .trim();

    if (cClean.length >= 3 && (cClean.startsWith(pClean) || pClean.startsWith(cClean))) {
      return candidate;
    }
  }

  return null;
}

export default function Setup() {
  const [data, setData] = useState<AttendanceDataset | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [configs, setConfigs] = useState<Record<string, SubjectCurriculumConfig>>({});
  const [mergeMap, setMergeMap] = useState<SubjectMergeMap>({});
  const [deletedSubjects, setDeletedSubjects] = useState<string[]>([]);
  const [linkDropdownOpen, setLinkDropdownOpen] = useState<string | null>(null);
  const [showExcludedDrawer, setShowExcludedDrawer] = useState(false);
  const [isSavedToast, setIsSavedToast] = useState(false);

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

      // Load stored configs, filling missing subjects with smart defaults
      const stored = getStoredCurriculumSettings();
      const initialConfigs: Record<string, SubjectCurriculumConfig> = {};

      dataset.subjects.forEach(subject => {
        const name = subject.course_name;
        if (stored[name]) {
          initialConfigs[name] = { ...stored[name] };
        } else if (stored[name.toUpperCase()]) {
          initialConfigs[name] = { ...stored[name.toUpperCase()] };
        } else {
          initialConfigs[name] = getDefaultSubjectConfig(name, dataset.records);
        }
      });

      setConfigs(initialConfigs);
      setMergeMap(getStoredMergeMap());
      setDeletedSubjects(getStoredDeletedSubjects());
    } catch (err: any) {
      if (err.status === 404) {
        navigate('/');
      } else {
        setError('Failed to load attendance report for setup.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySmartDefaults = () => {
    if (!data) return;
    const defaults: Record<string, SubjectCurriculumConfig> = {};
    data.subjects.forEach(subject => {
      defaults[subject.course_name] = getDefaultSubjectConfig(subject.course_name, data.records);
    });
    setConfigs(defaults);
  };

  const handleUpdateConfig = (courseName: string, updates: Partial<SubjectCurriculumConfig>) => {
    setConfigs(prev => {
      const current = prev[courseName] || getDefaultSubjectConfig(courseName, data?.records || []);
      const updated = { ...current, ...updates };

      if (updates.format !== undefined) {
        updated.hasLabOrTutorial = updates.format === 'theory_and_lab';
      }

      return {
        ...prev,
        [courseName]: updated,
      };
    });
  };

  // Map a detected child subject as lab into a parent subject
  const handleMergeSubject = (childName: string, parentName: string) => {
    setMergeMap(prev => ({ ...prev, [childName]: parentName }));
    setDeletedSubjects(prev => prev.filter(name => name !== childName));

    const parentConfig = configs[parentName] || getDefaultSubjectConfig(parentName, data?.records || []);
    const parentCredits = parentConfig.totalCredits || 3;
    const labWeekly = Math.max(1, parentConfig.labTutorialWeekly || 1);
    const theoryWeekly = Math.max(1, parentCredits > labWeekly ? parentCredits - labWeekly : 2);

    // Auto-switch parent to Theory+LAB format, ensure lab sessions are planned, and enable 2-hr lab counting
    handleUpdateConfig(parentName, {
      format: 'theory_and_lab',
      hasLabOrTutorial: true,
      countTwoHoursAsOne: true,
      labTutorialWeekly: labWeekly,
      theoryWeekly: theoryWeekly,
      totalCredits: Math.max(parentCredits, theoryWeekly + labWeekly),
    });

    setLinkDropdownOpen(null);
  };

  // Unlink a mapped child subject, returning it to standalone active status
  const handleUnmergeSubject = (childName: string) => {
    setMergeMap(prev => {
      const updated = { ...prev };
      delete updated[childName];
      return updated;
    });
  };

  // Exclude / delete a detected subject
  const handleDeleteSubject = (courseName: string) => {
    // If it was a parent, detach its children first
    const childrenOfThis = Object.entries(mergeMap)
      .filter(([, parent]) => parent === courseName)
      .map(([child]) => child);

    if (childrenOfThis.length > 0) {
      setMergeMap(prev => {
        const next = { ...prev };
        childrenOfThis.forEach(ch => delete next[ch]);
        return next;
      });
    }

    // If it was a child, remove it from mergeMap
    setMergeMap(prev => {
      const next = { ...prev };
      delete next[courseName];
      return next;
    });

    setDeletedSubjects(prev => (prev.includes(courseName) ? prev : [...prev, courseName]));
  };

  // Restore an excluded or unmapped subject
  const handleRestoreSubject = (courseName: string) => {
    setDeletedSubjects(prev => prev.filter(name => name !== courseName));
    setMergeMap(prev => {
      const next = { ...prev };
      delete next[courseName];
      return next;
    });
  };

  const handleSaveAndContinue = () => {
    saveAllStoredCurriculumSettings(configs);
    saveStoredMergeMap(mergeMap);
    saveStoredDeletedSubjects(deletedSubjects);
    setIsSavedToast(true);
    setTimeout(() => {
      navigate('/dashboard');
    }, 400);
  };

  // Sets of child and deleted names for quick checks
  const childNames = useMemo(() => new Set(Object.keys(mergeMap)), [mergeMap]);
  const deletedSet = useMemo(() => new Set(deletedSubjects), [deletedSubjects]);

  // Active detected subjects: standalone courses not mapped under a parent and not deleted
  const activeSubjects = useMemo(() => {
    if (!data) return [];
    return data.subjects.filter(
      s => !childNames.has(s.course_name) && !deletedSet.has(s.course_name)
    );
  }, [data, childNames, deletedSet]);

  // Children mapped into a specific parent
  const getChildrenOfParent = (parentName: string): string[] => {
    return Object.entries(mergeMap)
      .filter(([, parent]) => parent === parentName)
      .map(([child]) => child);
  };

  // Available subjects that can be linked as lab for a given parent
  const getAvailableToLink = (parentName: string): string[] => {
    if (!data) return [];
    return data.subjects
      .map(s => s.course_name)
      .filter(
        name =>
          name !== parentName &&
          !childNames.has(name) && // Not already a child of another course
          !deletedSet.has(name)    // Not deleted
      );
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <Loader2 className="animate-spin text-slate-700" size={36} />
        <p className="text-sm font-medium text-slate-500">Preparing curriculum setup...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12">
        <p className="text-red-500 mb-4">{error || 'No data found'}</p>
        <Link to="/" className="btn-secondary">Upload a Report First</Link>
      </div>
    );
  }

  const mappedOrDeletedCount = Object.keys(mergeMap).length + deletedSubjects.length;

  return (
    <div className="max-w-5xl mx-auto space-y-7 animate-fade-in pb-20">
      {/* Top Banner / Student Identity */}
      <div className="glass-panel p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-5 border border-slate-200">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
              <Layers size={13} />
              Semester Curriculum Setup
            </span>
            {data.metadata.semester && (
              <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full border border-slate-200">
                Semester {data.metadata.semester}
              </span>
            )}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Configure Your Courses
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
            We auto-detected <strong>{data.subjects.length} courses</strong> from your uploaded report. 
            Group theory and lab components together, confirm abbreviations and credits for 100% accurate bunk calculations.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleApplySmartDefaults}
            className="inline-flex items-center gap-1.5 text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 px-3.5 py-2.5 rounded-xl transition-all shadow-2xs hover:shadow-xs"
            title="Auto-detect credits and formats using attendance logs"
          >
            <Sparkles size={14} className="text-indigo-600" />
            Smart Defaults
          </button>

          <button
            type="button"
            onClick={handleSaveAndContinue}
            className="inline-flex items-center gap-2 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 px-5 py-2.5 rounded-xl transition-all shadow-md hover:shadow-lg"
          >
            Save & Continue
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Active Information Notice */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5 text-slate-600">
          <Sliders size={16} className="text-slate-400 shrink-0" />
          <span>
            Showing <strong>{activeSubjects.length} active courses</strong>. 
            When you select <strong>Theory + LAB</strong>, you can link the detected practical/lab component. Once linked, the duplicate lab card is cleanly mapped and hidden.
          </span>
        </div>

        {mappedOrDeletedCount > 0 && (
          <button
            type="button"
            onClick={() => setShowExcludedDrawer(prev => !prev)}
            className="inline-flex items-center gap-1.5 font-bold text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-3 py-1.5 rounded-xl shrink-0 transition-colors"
          >
            <Link2 size={13} />
            <span>{mappedOrDeletedCount} Mapped / Excluded</span>
            {showExcludedDrawer ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {/* Active Course Cards List */}
      <div className="space-y-5">
        {activeSubjects.map((subject, idx) => {
          const config = configs[subject.course_name] || getDefaultSubjectConfig(subject.course_name, data.records);
          const subjectRecords = data.records.filter(r => r.course_normalized === subject.course_name);
          const labCount = subjectRecords.filter(isLabOrTutorialRecord).length;
          const isFormatIntegrated = config.format === 'theory_and_lab' || (config.hasLabOrTutorial && config.theoryWeekly > 0);

          const stats = calculateSubjectLecturesStats(subject.course_name, data.records, config);
          const plannedTheory = stats.plannedTheory;
          const plannedLab = stats.plannedLab;
          const totalPlanned = stats.totalPlanned;

          const children = getChildrenOfParent(subject.course_name);
          const isMergedParent = children.length > 0;
          const availableToLink = getAvailableToLink(subject.course_name);
          const isLinkDropdownOpen = linkDropdownOpen === subject.course_name;
          const suggestedLab = findSuggestedLab(subject.course_name, availableToLink);

          return (
            <div
              key={subject.course_name}
              className={`bg-white rounded-2xl p-6 border shadow-xs hover:border-slate-300 transition-all space-y-5 ${
                isMergedParent ? 'border-indigo-200 ring-1 ring-indigo-100' : 'border-slate-200/90'
              }`}
            >
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center border ${
                      isMergedParent
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-slate-900" title={subject.course_name}>
                      {subject.course_name}
                    </h2>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400 flex-wrap">
                      <span>{subject.present + subject.absent} sessions logged</span>
                      {labCount > 0 && <span>• {labCount} lab records detected</span>}
                      {isMergedParent && (
                        <span className="text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200">
                          Includes {children.length} mapped lab component
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right side: Abbreviation Preview + Delete/Exclude Button */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  <div className="flex items-center gap-1.5 mr-1">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Preview:</span>
                    <span className="font-extrabold text-xs bg-slate-900 text-white px-2.5 py-1 rounded-lg">
                      {config.abbreviation || '---'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteSubject(subject.course_name)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-colors"
                    title="Exclude this course from dashboard"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>

              {/* Form Controls */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Abbreviation Input */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Course Abbreviation
                  </label>
                  <input
                    type="text"
                    value={config.abbreviation || ''}
                    maxLength={10}
                    onChange={e =>
                      handleUpdateConfig(subject.course_name, { abbreviation: e.target.value.toUpperCase() })
                    }
                    placeholder="e.g. DSA"
                    className="w-full px-3 py-2 text-xs font-bold uppercase bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Short badge on cards & charts</p>
                </div>

                {/* 2. Format Toggle */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Course Format
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateConfig(subject.course_name, {
                          format: 'theory_or_lab',
                          hasLabOrTutorial: false,
                          theoryWeekly: config.totalCredits > 1 ? config.totalCredits : 0,
                          labTutorialWeekly: config.totalCredits === 1 ? 1 : 0,
                        })
                      }
                      className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all ${
                        !isFormatIntegrated
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Theory / LAB
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateConfig(subject.course_name, {
                          format: 'theory_and_lab',
                          hasLabOrTutorial: true,
                          theoryWeekly: Math.max(1, config.totalCredits - 1),
                          labTutorialWeekly: 1,
                        })
                      }
                      className={`py-1.5 px-2 text-xs font-bold rounded-lg transition-all ${
                        isFormatIntegrated
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-500 hover:text-indigo-700'
                      }`}
                    >
                      Theory + LAB
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Single format vs Integrated</p>
                </div>

                {/* 3. Total Credits */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Total Credits
                  </label>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                    {[1, 2, 3, 4, 5].map(cr => (
                      <button
                        key={cr}
                        type="button"
                        onClick={() => {
                          const isIntegrated = config.format === 'theory_and_lab';
                          let tw = cr;
                          let lw = 0;
                          if (isIntegrated) {
                            lw = 1;
                            tw = Math.max(1, cr - 1);
                          } else if (cr === 1 || config.theoryWeekly === 0) {
                            tw = 0;
                            lw = cr;
                          }
                          handleUpdateConfig(subject.course_name, {
                            totalCredits: cr,
                            theoryWeekly: tw,
                            labTutorialWeekly: lw,
                          });
                        }}
                        className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all ${
                          config.totalCredits === cr
                            ? 'bg-slate-900 text-white shadow-xs'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {cr}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">15 wks: {config.totalCredits * 15} hrs</p>
                </div>

                {/* 4. Weekly Sessions Distribution */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">
                    Weekly Sessions
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                      <span className="text-[11px] font-bold text-slate-500">Thy:</span>
                      <input
                        type="number"
                        min={0}
                        max={6}
                        value={config.theoryWeekly}
                        onChange={e => {
                          const tw = Math.max(0, parseInt(e.target.value) || 0);
                          const lw = config.labTutorialWeekly || 0;
                          handleUpdateConfig(subject.course_name, {
                            theoryWeekly: tw,
                            totalCredits: Math.max(1, tw + lw),
                          });
                        }}
                        className="w-full text-xs font-black text-slate-800 bg-transparent focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
                      <span className="text-[11px] font-bold text-slate-500">Lab:</span>
                      <input
                        type="number"
                        min={0}
                        max={4}
                        value={config.labTutorialWeekly}
                        onChange={e => {
                          const lw = Math.max(0, parseInt(e.target.value) || 0);
                          const tw = config.theoryWeekly || 0;
                          handleUpdateConfig(subject.course_name, {
                            labTutorialWeekly: lw,
                            totalCredits: Math.max(1, tw + lw),
                          });
                        }}
                        className="w-full text-xs font-black text-slate-800 bg-transparent focus:outline-none"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">Lectures per regular week</p>
                </div>
              </div>

              {/* Dedicated Lab Component Section (When Theory+LAB is selected) */}
              {isFormatIntegrated && (
                <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                      <FlaskConical size={14} className="text-indigo-600" />
                      <span>Lab / Practical Sessions Source</span>
                    </div>
                    <span className="text-[10px] font-semibold text-indigo-600 bg-white px-2 py-0.5 rounded border border-indigo-200">
                      Theory + LAB
                    </span>
                  </div>

                  {/* If lab courses are mapped into this course */}
                  {children.length > 0 ? (
                    <div className="space-y-2">
                      {children.map(childName => {
                        const childRecordsCount = data.records.filter(r => r.course_normalized === childName).length;
                        return (
                          <div
                            key={childName}
                            className="bg-white rounded-lg p-3 border border-indigo-200 shadow-2xs flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-black bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                                  MAPPED LAB
                                </span>
                                <span className="text-xs font-bold text-slate-800 truncate" title={childName}>
                                  {childName}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {childRecordsCount} practical records merged into this course (hidden from main list)
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleUnmergeSubject(childName)}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
                              title="Delete mapping and restore back to detected courses list"
                            >
                              <Unlink size={13} />
                              Unlink Lab
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* No lab component mapped yet: Offer mapping controls */
                    <div className="space-y-2">
                      <p className="text-[11px] text-slate-600">
                        Map the practical sessions from your detected attendance log under this subject:
                      </p>

                      {/* Smart Auto-Suggestion chip if detected */}
                      {suggestedLab && (
                        <div className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-indigo-200 text-xs shadow-2xs">
                          <Sparkles size={14} className="text-amber-500 shrink-0" />
                          <div className="truncate flex-1">
                            <span className="text-slate-500 mr-1">Suggested matching lab:</span>
                            <strong className="text-slate-900">{suggestedLab}</strong>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleMergeSubject(suggestedLab, subject.course_name)}
                            className="text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 rounded-md transition-colors shrink-0"
                          >
                            Link Now
                          </button>
                        </div>
                      )}

                      {/* Manual selector dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setLinkDropdownOpen(isLinkDropdownOpen ? null : subject.course_name)}
                          className="w-full inline-flex items-center justify-between text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 px-3 py-2 rounded-lg transition-all"
                        >
                          <span className="flex items-center gap-1.5">
                            <Plus size={13} />
                            Select detected course to map as Lab...
                          </span>
                          <ChevronDown
                            size={13}
                            className={`transition-transform ${isLinkDropdownOpen ? 'rotate-180' : ''}`}
                          />
                        </button>

                        {isLinkDropdownOpen && (
                          <>
                            <div className="fixed inset-0 z-30" onClick={() => setLinkDropdownOpen(null)} />
                            <div className="absolute left-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-xl shadow-xl max-h-56 overflow-y-auto w-full">
                              <div className="p-1">
                                {availableToLink.length === 0 ? (
                                  <p className="text-xs text-slate-400 p-2 text-center">
                                    No other detected courses available
                                  </p>
                                ) : (
                                  availableToLink.map(targetName => (
                                    <button
                                      key={targetName}
                                      type="button"
                                      onClick={() => handleMergeSubject(targetName, subject.course_name)}
                                      className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-indigo-50 hover:text-indigo-800 rounded-lg transition-colors flex items-center justify-between"
                                    >
                                      <span className="truncate">{targetName}</span>
                                      <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                                        {data.records.filter(r => r.course_normalized === targetName).length} sessions
                                      </span>
                                    </button>
                                  ))
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Bottom Row: 2-Hour Lab Counting Toggle & Projection Pill */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={config.countTwoHoursAsOne}
                    onChange={e => handleUpdateConfig(subject.course_name, { countTwoHoursAsOne: e.target.checked })}
                    className="w-4 h-4 rounded text-slate-900 border-slate-300 focus:ring-slate-900 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Count 2-hour lab slots as 1 session
                  </span>
                  <span className="text-[11px] text-slate-400 hidden md:inline">
                    (NMIMS practical registers typically log two 1-hr rows per lab)
                  </span>
                </label>

                <div className="bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 text-xs text-slate-600 flex items-center gap-2 self-start sm:self-auto">
                  <Clock size={13} className="text-slate-400" />
                  <span>
                    {isFormatIntegrated ? (
                      <>Planned: <strong>{plannedTheory} theory</strong> + <strong>{plannedLab} lab</strong> ={' '}
                      <strong>{totalPlanned} sessions</strong> ({config.totalCredits} credits)</>
                    ) : (
                      <>Planned: <strong>{totalPlanned} sessions</strong> ({config.totalCredits} credit{config.totalCredits > 1 ? 's' : ''})</>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Collapsible Section for Mapped & Excluded Courses */}
      {mappedOrDeletedCount > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <button
            type="button"
            onClick={() => setShowExcludedDrawer(prev => !prev)}
            className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <Link2 size={16} className="text-slate-500" />
              <span className="text-sm font-bold text-slate-800">
                Mapped & Excluded Subjects ({mappedOrDeletedCount})
              </span>
              <span className="text-xs text-slate-400 font-medium">
                — These are hidden from the dashboard cards
              </span>
            </div>
            {showExcludedDrawer ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
          </button>

          {showExcludedDrawer && (
            <div className="p-6 pt-2 border-t border-slate-100 space-y-3 bg-slate-50/50">
              {/* 1. Mapped Child Subjects */}
              {Object.entries(mergeMap).map(([childName, parentName]) => (
                <div
                  key={`mapped-${childName}`}
                  className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-slate-800 block truncate" title={childName}>
                      {childName}
                    </span>
                    <span className="text-indigo-600 font-semibold text-[11px] mt-0.5 block">
                      Merged as Lab into → <strong className="text-indigo-800">{parentName}</strong>
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUnmergeSubject(childName)}
                    className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                  >
                    <RotateCcw size={12} />
                    Restore
                  </button>
                </div>
              ))}

              {/* 2. Explicitly Excluded Subjects */}
              {deletedSubjects.map(deletedName => (
                <div
                  key={`deleted-${deletedName}`}
                  className="bg-white p-3.5 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-slate-800 block truncate" title={deletedName}>
                      {deletedName}
                    </span>
                    <span className="text-red-500 font-semibold text-[11px] mt-0.5 block">
                      Excluded from dashboard
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRestoreSubject(deletedName)}
                    className="inline-flex items-center gap-1 font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                  >
                    <RotateCcw size={12} />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sticky Bottom Bar */}
      <div className="sticky bottom-4 z-40 bg-white/95 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-slate-200 flex items-center justify-between gap-4">
        <div className="text-xs text-slate-500">
          <span>{activeSubjects.length} active subjects configured</span>
          {Object.keys(mergeMap).length > 0 && (
            <span className="text-indigo-600 font-semibold ml-2">
              • {Object.keys(mergeMap).length} lab group{Object.keys(mergeMap).length > 1 ? 's' : ''} mapped
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleSaveAndContinue}
          className="inline-flex items-center gap-2 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 px-6 py-3 rounded-xl transition-all shadow-md hover:shadow-lg shrink-0"
        >
          <CheckCircle2 size={16} className="text-emerald-400" />
          Save & Launch Dashboard
        </button>
      </div>
    </div>
  );
}

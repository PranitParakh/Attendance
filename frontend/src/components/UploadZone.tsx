import { useState, useRef, useEffect } from 'react';
import { UploadCloud, FileType, AlertCircle, Loader2, Globe, CheckCircle2, Lock, Sparkles, ExternalLink } from 'lucide-react';
import { uploadAttendancePDF, fetchAttendancePortal, isBackendConnected } from '../lib/api';
import { areAllSubjectsConfigured } from '../lib/subjectUtils';
import { useNavigate } from 'react-router-dom';

const SYNC_STAGES = [
  { id: 1, label: 'Connecting to SAP Portal', desc: 'Establishing secure session with SVKM servers' },
  { id: 2, label: 'Authenticating Credentials', desc: 'Verifying Student ID and portal session' },
  { id: 3, label: 'Launching Attendance Module', desc: 'Loading isolated WebDynpro student frame' },
  { id: 4, label: 'Generating Report', desc: 'Configuring academic year, semester & detail report' },
  { id: 5, label: 'Extracting & Parsing Data', desc: 'Downloading authentic PDF & compiling records' },
];

export default function UploadZone() {
  const [activeTab, setActiveTab] = useState<'upload' | 'fetch'>('upload');

  // Upload State
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // Fetch State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberId, setRememberId] = useState(true);
  const [showLiveBrowser, setShowLiveBrowser] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);

  // Common State
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Load saved SAP ID on mount and probe backend
  useEffect(() => {
    const savedId = localStorage.getItem('attendly_sap_id');
    if (savedId) {
      setUsername(savedId);
    }
    isBackendConnected().then(available => {
      setBackendAvailable(available);
    });
  }, []);

  // Stepper & timer effect while processing
  useEffect(() => {
    if (!isProcessing) {
      setCurrentStage(1);
      setElapsedSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    // Progressive stage transitions matching the scraper's live milestones
    const stage2 = setTimeout(() => setCurrentStage(2), 4000);
    const stage3 = setTimeout(() => setCurrentStage(3), 10000);
    const stage4 = setTimeout(() => setCurrentStage(4), 18000);
    const stage5 = setTimeout(() => setCurrentStage(5), 26000);

    return () => {
      clearInterval(timer);
      clearTimeout(stage2);
      clearTimeout(stage3);
      clearTimeout(stage4);
      clearTimeout(stage5);
    };
  }, [isProcessing]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const validateAndSetFile = (selectedFile: File) => {
    setError(null);
    if (selectedFile.type !== 'application/pdf' && !selectedFile.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF file.');
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      setError('File is too large. Maximum size is 10MB.');
      return;
    }
    setFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setError(null);

    try {
      const response = await uploadAttendancePDF(file);
      if (response.success) {
        if (response.dataset && areAllSubjectsConfigured(response.dataset.subjects)) {
          navigate('/dashboard');
        } else {
          navigate('/setup');
        }
      } else {
        setError(response.error || response.message || 'Failed to upload attendance report.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFetch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setError('Please enter your SAP Student ID and Portal Password.');
      return;
    }

    if (rememberId) {
      localStorage.setItem('attendly_sap_id', cleanUser);
    } else {
      localStorage.removeItem('attendly_sap_id');
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetchAttendancePortal(cleanUser, cleanPass, !showLiveBrowser);
      if (response.success) {
        if (response.dataset && areAllSubjectsConfigured(response.dataset.subjects)) {
          navigate('/dashboard');
        } else {
          navigate('/setup');
        }
      } else {
        setError(response.error || response.message || 'Failed to fetch attendance report.');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred while communicating with the server.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto animate-fade-in stagger-2">
      {/* Tab Switcher */}
      <div className="flex justify-center mb-6">
        <div className="bg-slate-200/60 p-1 rounded-xl flex gap-1 shadow-inner border border-slate-200/80">
          <button
            onClick={() => {
              if (!isProcessing) {
                setActiveTab('upload');
                setError(null);
              }
            }}
            disabled={isProcessing}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'upload'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Upload PDF
          </button>
          <button
            onClick={() => {
              if (!isProcessing) {
                setActiveTab('fetch');
                setError(null);
              }
            }}
            disabled={isProcessing}
            className={`flex items-center gap-1.5 px-6 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'fetch'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Sparkles size={15} className={activeTab === 'fetch' ? 'text-amber-500' : 'text-slate-400'} />
            Fetch from Portal
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div
        className={`glass-panel p-8 sm:p-12 transition-all duration-300 border-2 ${
          activeTab === 'upload'
            ? isDragging
              ? 'border-dashed border-slate-400 bg-slate-50/80 scale-[1.01]'
              : 'border-dashed border-slate-200 hover:border-slate-300 hover:bg-white/80'
            : 'border-solid border-slate-200 bg-white/90 shadow-xl'
        }`}
        onDragOver={activeTab === 'upload' ? handleDragOver : undefined}
        onDragLeave={activeTab === 'upload' ? handleDragLeave : undefined}
        onDrop={activeTab === 'upload' ? handleDrop : undefined}
      >
        <div className="flex flex-col items-center justify-center text-center gap-6">

          {/* ACTIVE TAB: UPLOAD PDF */}
          {activeTab === 'upload' && (
            <>
              <div
                className={`p-4 rounded-full transition-colors duration-300 ${
                  isDragging ? 'bg-slate-200 text-slate-800' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <UploadCloud size={48} strokeWidth={1.5} />
              </div>

              <div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Upload Attendance Report</h3>
                <p className="text-slate-500 max-w-md mx-auto text-sm">
                  Drag and drop your official SVKM/NMIMS SAP attendance PDF here, or browse files.
                </p>
              </div>

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
              />

              {file ? (
                <div className="flex flex-col items-center w-full gap-4 mt-2">
                  <div className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl w-full max-w-md">
                    <FileType className="text-slate-400 shrink-0" size={24} />
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-semibold text-slate-900 truncate">{file.name}</p>
                      <p className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                    {!isProcessing && (
                      <button
                        onClick={() => setFile(null)}
                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                        aria-label="Remove file"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <button
                    onClick={handleUpload}
                    disabled={isProcessing}
                    className="btn-primary w-full max-w-md mt-2 group"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={18} />
                        Processing Attendance Records...
                      </>
                    ) : (
                      <>
                        Process Attendance Report
                        <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary mt-2 shadow-sm"
                >
                  Browse PDF Files
                </button>
              )}
            </>
          )}

          {/* ACTIVE TAB: FETCH FROM PORTAL */}
          {activeTab === 'fetch' && (
            <>
              {!isProcessing ? (
                <>
                  <div className="p-4 rounded-full bg-slate-100 text-slate-700">
                    <Globe size={44} strokeWidth={1.5} />
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-1.5">Direct SAP Portal Sync</h3>
                    <p className="text-slate-500 max-w-md mx-auto text-xs leading-relaxed mb-3">
                      Automatically logs into the SVKM portal, navigates WebDynpro attendance, and pulls your official report.
                    </p>
                    {backendAvailable === true && (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 rounded-full text-emerald-700 text-xs font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        Cloud Portal Scraper Active
                      </div>
                    )}
                  </div>

                  {backendAvailable === false && (
                    <div className="w-full max-w-md p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-left flex gap-2.5 text-slate-700 text-xs leading-relaxed animate-fade-in">
                      <AlertCircle className="shrink-0 text-amber-500 mt-0.5" size={16} />
                      <div>
                        <p className="font-semibold text-slate-900 mb-0.5">Cloud Scraper Initializing</p>
                        <p className="text-slate-500 text-[11px] leading-relaxed">
                          The cloud scraper takes a few moments to spin up on first request. You can proceed with login, or use the{' '}
                          <button
                            type="button"
                            onClick={() => setActiveTab('upload')}
                            className="underline font-semibold text-slate-700 hover:text-slate-900"
                          >
                            Upload PDF
                          </button>{' '}
                          tab for instant offline analysis.
                        </p>
                      </div>
                    </div>
                  )}

                  <form onSubmit={handleFetch} className="w-full max-w-md flex flex-col gap-4 text-left">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        SAP Student ID
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={e => setUsername(e.target.value)}
                        placeholder="e.g. 70000000000"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:bg-white focus:outline-none text-slate-900 text-sm transition-all"
                        required
                        autoComplete="username"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                        Portal Password
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 focus:bg-white focus:outline-none text-slate-900 text-sm transition-all"
                        required
                        autoComplete="current-password"
                      />
                    </div>

                    <div className="flex flex-col gap-2 pt-0.5">
                      <div className="flex items-center justify-between text-xs text-slate-600 px-0.5">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={rememberId}
                            onChange={e => setRememberId(e.target.checked)}
                            className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4 cursor-pointer"
                          />
                          <span>Remember Student ID</span>
                        </label>
                        <span className="flex items-center gap-1 text-slate-400">
                          <Lock size={12} />
                          Password never saved
                        </span>
                      </div>

                      <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200/80 p-2.5 rounded-xl">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={showLiveBrowser}
                            onChange={e => setShowLiveBrowser(e.target.checked)}
                            className="rounded border-slate-300 text-slate-800 focus:ring-slate-800 w-4 h-4 cursor-pointer shrink-0"
                          />
                          <span className="font-medium text-slate-700 flex items-center gap-1.5">
                            <ExternalLink size={13} className="text-slate-500 shrink-0" />
                            Show automation browser window on desktop
                          </span>
                        </label>
                        <p className="text-[11px] text-slate-500 pl-6 mt-0.5">
                          Runs silently in the background without disturbing your open tabs or windows.
                        </p>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="btn-primary w-full mt-2 group shadow-md"
                    >
                      Fetch Attendance Report
                      <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
                    </button>
                  </form>
                </>
              ) : (
                /* LIVE STEP-BY-STEP PROGRESS TRACKER */
                <div className="w-full max-w-md text-left py-2 animate-fade-in">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
                    <div>
                      <h4 className="font-bold text-slate-900 text-base">Fetching Attendance Report</h4>
                      <p className="text-xs text-slate-500">Live browser automation in progress</p>
                    </div>
                    <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full text-xs font-mono font-medium text-slate-700">
                      <Loader2 className="animate-spin text-slate-500" size={13} />
                      <span>{elapsedSeconds}s</span>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    {SYNC_STAGES.map(stage => {
                      const isCompleted = currentStage > stage.id;
                      const isCurrent = currentStage === stage.id;

                      return (
                        <div
                          key={stage.id}
                          className={`flex items-start gap-3 p-2.5 rounded-xl transition-all duration-300 ${
                            isCurrent
                              ? 'bg-slate-100/90 border border-slate-200 shadow-sm'
                              : isCompleted
                              ? 'text-slate-600'
                              : 'opacity-40'
                          }`}
                        >
                          <div className="mt-0.5 shrink-0">
                            {isCompleted ? (
                              <CheckCircle2 className="text-emerald-500" size={18} />
                            ) : isCurrent ? (
                              <Loader2 className="animate-spin text-slate-900" size={18} />
                            ) : (
                              <div className="w-4 h-4 rounded-full border-2 border-slate-300 mt-0.5 ml-0.5" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${isCurrent ? 'text-slate-900' : 'text-slate-700'}`}>
                              {stage.label}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5">
                              {stage.desc}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <p className="text-[11px] text-slate-400 text-center mt-6">
                    SVKM WebDynpro generation typically takes 15–30 seconds. Please keep this tab open.
                  </p>
                </div>
              )}
            </>
          )}

          {/* Error Banner */}
          {error && (
            <div className="flex items-start gap-2.5 p-4 mt-2 bg-red-50 text-red-700 rounded-xl w-full max-w-md text-left border border-red-200 animate-fade-in">
              <AlertCircle className="shrink-0 mt-0.5 text-red-500" size={18} />
              <div className="text-xs leading-relaxed">
                <p className="font-semibold mb-0.5">Sync Error</p>
                <p>{error}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { X, RefreshCw, Loader2, CheckCircle2, Lock, AlertCircle, Globe, ExternalLink } from 'lucide-react';
import { fetchAttendancePortal, isBackendConnected } from '../lib/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const SYNC_STAGES = [
  { id: 1, label: 'Connecting to SAP Portal', desc: 'Establishing secure session with SVKM servers' },
  { id: 2, label: 'Authenticating Credentials', desc: 'Verifying Student ID and portal session' },
  { id: 3, label: 'Launching Attendance Module', desc: 'Loading isolated WebDynpro student frame' },
  { id: 4, label: 'Generating Report', desc: 'Configuring academic year, semester & detail report' },
  { id: 5, label: 'Extracting & Parsing Data', desc: 'Downloading authentic PDF & compiling records' },
];

export default function SyncModal({ isOpen, onClose, onSuccess }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberCredentials, setRememberCredentials] = useState(true);
  const [showLiveBrowser, setShowLiveBrowser] = useState(false);
  const [backendAvailable, setBackendAvailable] = useState<boolean | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState(1);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const savedId = localStorage.getItem('attendly_sap_id');
      const savedPw = localStorage.getItem('attendly_sap_pw');
      if (savedId) setUsername(savedId);
      if (savedPw) {
        setPassword(savedPw);
        setRememberCredentials(true);
      } else {
        setPassword('');
      }
      setError(null);
      setIsProcessing(false);
      setCurrentStage(1);
      setElapsedSeconds(0);

      isBackendConnected().then(available => {
        setBackendAvailable(available);
      });
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isProcessing) {
      setCurrentStage(1);
      setElapsedSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds(prev => prev + 1);
    }, 1000);

    const s2 = setTimeout(() => setCurrentStage(2), 4000);
    const s3 = setTimeout(() => setCurrentStage(3), 10000);
    const s4 = setTimeout(() => setCurrentStage(4), 18000);
    const s5 = setTimeout(() => setCurrentStage(5), 26000);

    return () => {
      clearInterval(timer);
      clearTimeout(s2);
      clearTimeout(s3);
      clearTimeout(s4);
      clearTimeout(s5);
    };
  }, [isProcessing]);

  if (!isOpen) return null;

  const handleSync = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    const cleanPass = password.trim();

    if (!cleanUser || !cleanPass) {
      setError('Please enter your SAP Student ID and Password.');
      return;
    }

    if (rememberCredentials) {
      localStorage.setItem('attendly_sap_id', cleanUser);
      localStorage.setItem('attendly_sap_pw', cleanPass);
    } else {
      localStorage.removeItem('attendly_sap_id');
      localStorage.removeItem('attendly_sap_pw');
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await fetchAttendancePortal(cleanUser, cleanPass, !showLiveBrowser);
      if (response.success) {
        onSuccess();
        onClose();
      } else {
        setError(response.error || response.message || 'Failed to sync attendance report.');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while connecting to the backend.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 sm:p-8 relative">
        {/* Close Button */}
        {!isProcessing && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        )}

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-2xl bg-slate-900 text-white">
            <RefreshCw size={20} className={isProcessing ? 'animate-spin' : ''} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900 tracking-tight">Sync Latest Attendance</h3>
            <p className="text-xs text-slate-500">Fetches newest lectures directly from the SVKM Portal</p>
          </div>
        </div>

        {!isProcessing ? (
          <>
            {backendAvailable === true && (
              <div className="mb-4 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-emerald-800 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Cloud Scraper is online and ready to fetch your report</span>
              </div>
            )}
            {backendAvailable === false && (
              <div className="mb-4 p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-left flex gap-2.5 text-slate-700 text-xs leading-relaxed animate-fade-in">
                <AlertCircle className="shrink-0 text-amber-500 mt-0.5" size={16} />
                <div>
                  <p className="font-semibold text-slate-900 mb-0.5">Cloud Scraper Initializing</p>
                  <p className="text-slate-500 text-[11px] leading-relaxed">
                    The free cloud server is waking up. You can start sync now (may take ~20-30s), or upload your attendance PDF directly on the homepage.
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSync} className="space-y-4">
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
                autoFocus={!password}
              />
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberCredentials}
                    onChange={e => setRememberCredentials(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 w-4 h-4 cursor-pointer"
                  />
                  <span>Remember credentials</span>
                </label>
                <span className="flex items-center gap-1 text-slate-400">
                  <Lock size={12} />
                  Stored locally
                </span>
              </div>

              <div className="flex flex-col gap-1 text-xs text-slate-600 bg-slate-50 border border-slate-200/80 p-3 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    id="sync-live-browser"
                    checked={showLiveBrowser}
                    onChange={e => setShowLiveBrowser(e.target.checked)}
                    className="rounded border-slate-300 text-slate-800 focus:ring-slate-800 w-4 h-4 cursor-pointer shrink-0"
                  />
                  <label htmlFor="sync-live-browser" className="flex items-center gap-1.5 font-medium text-slate-700 cursor-pointer select-none">
                    <ExternalLink size={13} className="text-slate-500 shrink-0" />
                    Show automation browser window on desktop
                  </label>
                </div>
                <p className="text-[11px] text-slate-500 pl-6 leading-tight">
                  Runs silently in the background without disturbing your open tabs or windows.
                </p>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3.5 bg-red-50 text-red-700 rounded-xl text-xs border border-red-200">
                <AlertCircle className="shrink-0 mt-0.5 text-red-500" size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center gap-3 pt-3">
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1 py-2.5 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary flex-1 py-2.5 text-sm"
              >
                Start Sync
              </button>
            </div>
          </form>
        </>
        ) : (
          <div className="py-2 animate-fade-in">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Globe size={18} className="text-slate-700" />
                <span className="font-bold text-slate-900 text-sm">Automating SVKM WebDynpro</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1 rounded-full text-xs font-mono font-medium text-slate-700">
                <Loader2 className="animate-spin text-slate-500" size={13} />
                <span>{elapsedSeconds}s</span>
              </div>
            </div>

            <div className="space-y-3">
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
                    <div className="flex-1 min-w-0 text-left">
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
              Extracting vector report. This takes about 20 seconds.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

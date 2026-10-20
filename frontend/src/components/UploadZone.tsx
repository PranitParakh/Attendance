import { useState, useRef, useEffect } from 'react';
import { 
  UploadCloud, FileType, AlertCircle, Loader2, Globe, CheckCircle2, 
  Lock, Sparkles, ExternalLink, Copy, Check, Smartphone, Laptop, Zap, Info, ShieldCheck
} from 'lucide-react';
import { uploadAttendancePDF, fetchAttendancePortal, isBackendConnected, importBase64Pdf } from '../lib/api';
import { areAllSubjectsConfigured } from '../lib/subjectUtils';
import { useNavigate } from 'react-router-dom';

const BOOKMARKLET_CODE = `javascript:(async function(){try{let d=document;for(const f of Array.from(document.querySelectorAll('iframe'))){try{if(f.contentDocument&&(f.name==='isolatedWorkArea'||f.src.includes('ZSVKM')||f.contentDocument.querySelector('object,embed,[lsdata*=".pdf"]'))){d=f.contentDocument;break;}}catch(e){}}let u='';const o=d.querySelector('object[type*="pdf"],object.lsPdfObject,embed[type*="pdf"]');if(o)u=o.getAttribute('data')||o.getAttribute('src')||'';if(!u){for(const el of d.querySelectorAll('[lsdata*=".pdf"]')){const l=el.getAttribute('lsdata');if(l){const m=l.match(/["']0["']\\s*:\\s*["']([^"']+\\.pdf[^"']*)["']/);if(m){u=m[1];break;}}}}if(!u){const b=d.querySelector('#WD51,button[title*="Attendance"],input[value*="Attendance"]');if(b){b.click();alert('Attendly: Generating attendance report... Tap this bookmarklet again in 3 seconds once the report appears!');return;}alert('Attendly: Please open Attendance Display and generate your report, then tap this bookmarklet again!');return;}const r=await fetch(new URL(u,window.location.href).href,{credentials:'include'});if(!r.ok)throw new Error('HTTP '+r.status);const blob=await r.blob();const rd=new FileReader();rd.onload=function(){const data=rd.result;let s=false;if(window.opener&&!window.opener.closed){try{window.opener.postMessage({type:'ATTENDLY_SYNC',pdfData:data},'*');s=true;alert('Attendly: Attendance synced successfully! Return to your Attendly tab.');}catch(e){}}if(!s){window.open('https://head.attendance-9co.pages.dev/#sync='+encodeURIComponent(data),'_blank');}};rd.readAsDataURL(blob);}catch(e){alert('Attendly Sync Error: '+e.message);}})();`;

const SYNC_STAGES = [
  { id: 1, label: 'Connecting to SAP Portal', desc: 'Establishing secure session with SVKM servers' },
  { id: 2, label: 'Authenticating Credentials', desc: 'Verifying Student ID and portal session' },
  { id: 3, label: 'Launching Attendance Module', desc: 'Loading isolated WebDynpro student frame' },
  { id: 4, label: 'Generating Report', desc: 'Configuring academic year, semester & detail report' },
  { id: 5, label: 'Extracting & Parsing Data', desc: 'Downloading authentic PDF & compiling records' },
];

export default function UploadZone() {
  const [activeTab, setActiveTab] = useState<'upload' | 'fetch'>('upload');
  const [fetchMode, setFetchMode] = useState<'tap' | 'credentials'>('tap');
  const [copiedBookmarklet, setCopiedBookmarklet] = useState(false);
  const [deviceGuide, setDeviceGuide] = useState<'android' | 'ios' | 'pc'>('android');

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

  // Listen for direct sync messages from the SAP portal popup tab
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (event.data && event.data.type === 'ATTENDLY_SYNC' && event.data.pdfData) {
        try {
          setIsProcessing(true);
          setError(null);
          const response = await importBase64Pdf(event.data.pdfData);
          if (response.success) {
            if (response.dataset && areAllSubjectsConfigured(response.dataset.subjects)) {
              navigate('/dashboard');
            } else {
              navigate('/setup');
            }
          }
        } catch (err: any) {
          setError(err.message || 'Failed to parse synchronized attendance data.');
        } finally {
          setIsProcessing(false);
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [navigate]);

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
                <div className="w-full max-w-lg flex flex-col gap-5">
                  {/* Mode Selector Pill */}
                  <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200/80 gap-1 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setFetchMode('tap')}
                      className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        fetchMode === 'tap'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Zap size={14} className={fetchMode === 'tap' ? 'text-amber-500' : 'text-slate-400'} />
                      1-Tap Quick-Sync (Universal)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFetchMode('credentials')}
                      className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        fetchMode === 'credentials'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <Lock size={13} className={fetchMode === 'credentials' ? 'text-blue-500' : 'text-slate-400'} />
                      Direct Scraper
                    </button>
                  </div>

                  {/* MODE 1: 1-TAP QUICK-SYNC */}
                  {fetchMode === 'tap' && (
                    <div className="flex flex-col gap-5 text-left animate-fade-in">
                      <div className="bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200/80 rounded-2xl p-4 text-xs leading-relaxed text-slate-700">
                        <div className="flex items-center gap-2 font-bold text-slate-900 text-sm mb-1">
                          <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                          Works 100% Free on Any Device (Phone & Laptop)
                        </div>
                        <p className="text-slate-600 text-[11px] leading-relaxed">
                          Your phone or laptop in India connects directly to the SAP Portal without being blocked by university firewalls. Sync in 3 seconds with zero server delay!
                        </p>
                      </div>

                      {/* Action 1: Open SAP Portal */}
                      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">1</span>
                            Open Portal
                          </span>
                          <span className="text-[11px] text-slate-500">Official NMIMS SAP</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            window.open('https://sdc-sppap1.svkm.ac.in:50001/irj/portal', 'sapPortal');
                          }}
                          className="btn-primary w-full text-center flex items-center justify-center gap-2 py-2.5 shadow-sm"
                        >
                          <ExternalLink size={15} />
                          Launch SAP Portal in New Tab
                        </button>
                      </div>

                      {/* Action 2: Copy Bookmarklet */}
                      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px]">2</span>
                            Attendly Quick-Sync Bookmarklet
                          </span>
                          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            Zero-Install
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(BOOKMARKLET_CODE);
                              setCopiedBookmarklet(true);
                              setTimeout(() => setCopiedBookmarklet(false), 2500);
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-all shadow-sm cursor-pointer"
                          >
                            {copiedBookmarklet ? (
                              <>
                                <Check size={15} className="text-emerald-400" />
                                Copied to Clipboard!
                              </>
                            ) : (
                              <>
                                <Copy size={15} />
                                Copy Attendly Sync Bookmarklet
                              </>
                            )}
                          </button>
                        </div>

                        {/* Device switcher guide */}
                        <div className="mt-1">
                          <div className="flex gap-1 border-b border-slate-200 pb-2 mb-2 text-[11px]">
                            <button
                              type="button"
                              onClick={() => setDeviceGuide('android')}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                                deviceGuide === 'android' ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              <Smartphone size={12} /> Android (Chrome)
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeviceGuide('ios')}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                                deviceGuide === 'ios' ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              <Smartphone size={12} /> iPhone (Safari)
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeviceGuide('pc')}
                              className={`flex items-center gap-1 px-2.5 py-1 rounded-md font-medium transition-colors ${
                                deviceGuide === 'pc' ? 'bg-slate-200 text-slate-900' : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              <Laptop size={12} /> PC / Mac
                            </button>
                          </div>

                          <div className="text-[11px] text-slate-600 space-y-1 leading-relaxed bg-white/70 p-2.5 rounded-lg border border-slate-200/60">
                            {deviceGuide === 'android' && (
                              <ol className="list-decimal pl-4 space-y-1">
                                <li>Tap <strong>Copy Attendly Sync Bookmarklet</strong> above.</li>
                                <li>Bookmark any webpage in Chrome, tap <strong>Edit</strong>, and paste the code into the <strong>URL field</strong> (name it <em>Attendly Sync</em>).</li>
                                <li>In the SAP Portal tab, type <em>Attendly</em> in the address bar and tap the bookmark to sync instantly!</li>
                              </ol>
                            )}
                            {deviceGuide === 'ios' && (
                              <ol className="list-decimal pl-4 space-y-1">
                                <li>Tap <strong>Copy Attendly Sync Bookmarklet</strong> above.</li>
                                <li>In Safari, bookmark this page, then go to <strong>Bookmarks → Edit</strong>, select it, and paste into the <strong>URL field</strong>.</li>
                                <li>Open the SAP portal tab, tap your Bookmarks, and select <em>Attendly Sync</em> to transfer attendance!</li>
                              </ol>
                            )}
                            {deviceGuide === 'pc' && (
                              <ol className="list-decimal pl-4 space-y-1">
                                <li>Drag the link below to your browser Bookmarks Bar, or copy the code:</li>
                                <li>
                                  <a
                                    href={BOOKMARKLET_CODE}
                                    onClick={e => e.preventDefault()}
                                    className="inline-block py-1 px-2.5 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded font-bold my-1 text-[11px] cursor-grab border border-amber-300"
                                  >
                                    ⚡ Attendly Sync (Drag to Bookmarks)
                                  </a>
                                </li>
                                <li>Click the bookmark anytime on your SAP attendance tab to sync in 1 click!</li>
                              </ol>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* MODE 2: DIRECT CREDENTIALS SCRAPER */}
                  {fetchMode === 'credentials' && (
                    <div className="flex flex-col gap-4 text-left animate-fade-in">
                      <div className="bg-slate-50 border border-slate-200/80 p-3 rounded-xl text-xs text-slate-600 leading-relaxed flex gap-2">
                        <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold text-slate-800 mb-0.5">Automated Cloud & Local Scraper</p>
                          <p className="text-[11px] text-slate-500">
                            The cloud scraper runs on a free backend. Note: NMIMS blocks foreign datacenters on port 50001; for zero-hassle mobile use, we recommend the <strong>1-Tap Quick-Sync</strong> tab above.
                          </p>
                        </div>
                      </div>

                      <form onSubmit={handleFetch} className="flex flex-col gap-4">
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
                    </div>
                  )}
                </div>
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

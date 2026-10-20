import UploadZone from '../components/UploadZone';
import { getCurrentAttendance, importBase64Pdf } from '../lib/api';
import { areAllSubjectsConfigured } from '../lib/subjectUtils';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const handleSyncFromHashOrStorage = async () => {
      // 1. Check for incoming 1-Tap Sync hash payload (#sync=...)
      const hash = window.location.hash;
      if (hash && hash.includes('sync=')) {
        try {
          const match = hash.match(/sync=([^&]+)/);
          if (match && match[1]) {
            const raw = decodeURIComponent(match[1]);
            const response = await importBase64Pdf(raw);
            window.history.replaceState(null, '', window.location.pathname);
            if (response.dataset && areAllSubjectsConfigured(response.dataset.subjects)) {
              navigate('/dashboard');
            } else {
              navigate('/setup');
            }
            return;
          }
        } catch (err) {
          console.error('Failed to process #sync hash:', err);
          window.history.replaceState(null, '', window.location.pathname);
        }
      }

      // 2. Check if we already have data loaded
      try {
        const dataset = await getCurrentAttendance();
        if (areAllSubjectsConfigured(dataset.subjects)) {
          navigate('/dashboard');
        } else {
          navigate('/setup');
        }
      } catch (e) {
        // Expected if no data exists
        setIsChecking(false);
      }
    };
    
    handleSyncFromHashOrStorage();
  }, [navigate]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] py-12">
      <div className="text-center mb-8 sm:mb-10 animate-fade-in stagger-1">
        <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-slate-900 mb-3">
          Attendance Analytics
        </h1>
        <p className="text-sm sm:text-base text-slate-500 max-w-lg mx-auto leading-relaxed">
          Subject-by-subject analysis, bunk buffers, and lecture projections for NMIMS students.
        </p>
      </div>
      
      <UploadZone />
    </div>
  );
}

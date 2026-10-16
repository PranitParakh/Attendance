import { Outlet, Link, useLocation } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

export default function Layout() {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-slate-200">
      {/* Header */}
      <header className={`sticky top-0 z-50 w-full backdrop-blur-xl transition-all duration-300 ${
        isHome ? 'bg-transparent border-transparent' : 'bg-white/70 border-b border-slate-200/50'
      }`}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="bg-slate-900 p-1.5 rounded-lg text-white transition-transform group-hover:scale-105">
              <BookOpen size={20} />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-900">Attendly</span>
          </Link>
          
          {!isHome && (
            <nav className="flex items-center gap-4">
              <Link 
                to="/dashboard" 
                className={`text-sm font-medium transition-colors hover:text-slate-900 ${
                  location.pathname === '/dashboard' ? 'text-slate-900 font-bold' : 'text-slate-500'
                }`}
              >
                Dashboard
              </Link>
              <Link 
                to="/setup" 
                className={`text-sm font-medium transition-colors hover:text-slate-900 ${
                  location.pathname === '/setup' ? 'text-slate-900 font-bold' : 'text-slate-500'
                }`}
              >
                Curriculum Setup
              </Link>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-xs text-slate-400">
        <p>Attendly • Local & Private Attendance Analytics</p>
      </footer>
    </div>
  );
}

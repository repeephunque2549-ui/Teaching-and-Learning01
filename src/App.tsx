import { useEffect, useState, lazy, Suspense } from 'react';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import type { DatabaseProfile } from './supabaseClient';
import { LogOut, User, ShieldAlert, GraduationCap, Loader, Sun, Moon } from 'lucide-react';
import { AnimatedBackground } from './components/AnimatedBackground';

// Lazy-load heavy components to reduce initial bundle size
const AuthView = lazy(() => import('./components/AuthView').then(m => ({ default: m.AuthView })));
const AdminDashboard = lazy(() => import('./components/AdminDashboard').then(m => ({ default: m.AdminDashboard })));
const PageEditor = lazy(() => import('./components/PageEditor').then(m => ({ default: m.PageEditor })));
const StudentDashboard = lazy(() => import('./components/StudentDashboard').then(m => ({ default: m.StudentDashboard })));
const PageView = lazy(() => import('./components/PageView').then(m => ({ default: m.PageView })));
const ProfileView = lazy(() => import('./components/ProfileView').then(m => ({ default: m.ProfileView })));

// Reusable inline loading fallback for Suspense boundaries
function SuspenseFallback() {
  return (
    <div className="loading-wrapper" style={{ margin: '80px auto' }}>
      <div className="loading-spinner-glow">
        <Loader className="spin-anim" size={40} style={{ color: 'var(--color-brand)', position: 'relative', zIndex: 1 }} />
      </div>
      <div className="loading-text">กำลังโหลดหน้า...</div>
    </div>
  );
}

function App() {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<DatabaseProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'light' || saved === 'dark') ? saved : 'dark';
  });

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // View state routing:
  // 'dashboard' | 'editor' | 'viewer' | 'profile'
  const [currentView, setCurrentView] = useState<'dashboard' | 'editor' | 'viewer' | 'profile'>('dashboard');
  const [activePageId, setActivePageId] = useState<string | null>(null); // For editor
  const [activeSlug, setActiveSlug] = useState<string | null>(null); // For viewer

  // Parse path on initial load and handle browser back/forward buttons
  useEffect(() => {
    const handleUrlRouting = () => {
      const path = window.location.pathname;
      if (path.startsWith('/course/')) {
        const slug = path.replace('/course/', '');
        if (slug) {
          setActiveSlug(slug);
          setCurrentView('viewer');
        } else {
          setCurrentView('dashboard');
          setActiveSlug(null);
        }
      } else if (path === '/profile') {
        setCurrentView('profile');
        setActiveSlug(null);
      } else {
        setCurrentView('dashboard');
        setActiveSlug(null);
      }
    };

    // Run on mount
    handleUrlRouting();

    // Listen to popstate (back/forward browser buttons)
    window.addEventListener('popstate', handleUrlRouting);
    return () => window.removeEventListener('popstate', handleUrlRouting);
  }, []);

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setCurrentView('dashboard');
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (err: any) {
      console.error('Error fetching profile:', err.message);
      // Fallback profile if row is not created yet (sometimes due to latency)
      setProfile({
        id: userId,
        role: 'student',
        full_name: session?.user?.email || 'Student User'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('คุณต้องการออกจากระบบหรือไม่?')) {
      await supabase.auth.signOut();
    }
  };

  const handleAuthSuccess = () => {
    setLoading(true);
  };

  // If Supabase is not configured, show a beautiful user-friendly instruction page
  if (!isSupabaseConfigured) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)',
        padding: '20px'
      }}>
        <div className="card-glass" style={{ width: '100%', maxWidth: '560px', textAlign: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(245, 158, 11, 0.1)',
            color: 'var(--color-warning)',
            marginBottom: '20px'
          }}>
            <ShieldAlert size={36} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '12px' }}>ยังไม่ได้ตั้งค่าการเชื่อมต่อ Supabase</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '0.95rem', lineHeight: '1.6' }}>
            ตรวจพบว่าคุณยังไม่ได้ระบุข้อมูล <strong>VITE_SUPABASE_URL</strong> หรือ <strong>VITE_SUPABASE_ANON_KEY</strong> ในไฟล์ <code>.env</code> ของโปรเจกต์
          </p>
          <div style={{
            textAlign: 'left',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid var(--border-glass)',
            padding: '16px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '24px',
            fontSize: '0.9rem'
          }}>
            <strong style={{ display: 'block', marginBottom: '8px', color: 'var(--text-heading)' }}>วิธีการแก้ไข:</strong>
            <ol style={{ paddingLeft: '20px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>
              <li style={{ marginBottom: '6px' }}>เปิดไฟล์ <code>.env</code> ที่อยู่ในโฟลเดอร์โปรเจกต์นี้</li>
              <li style={{ marginBottom: '6px' }}>คัดลอกลิงก์ URL และ Anon Key จากหน้าเว็บ Supabase ของคุณ</li>
              <li style={{ marginBottom: '6px' }}>นำมาใส่ในไฟล์ <code>.env</code> ตัวอย่างเช่น:
                <pre style={{
                  background: 'var(--bg-secondary)',
                  padding: '10px',
                  borderRadius: '6px',
                  marginTop: '6px',
                  color: '#818cf8',
                  overflowX: 'auto',
                  fontFamily: 'monospace',
                  border: '1px solid var(--border-glass)'
                }}>
{`VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...`}
                </pre>
              </li>
              <li>หลังจากแก้ไขและบันทึกไฟล์ <code>.env</code> เรียบร้อยแล้ว หน้านี้จะอัปเดตและเข้าใช้งานได้ทันที</li>
            </ol>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-primary)'
      }}>
        <AnimatedBackground isDark={theme === 'dark'} />
        <div className="loading-wrapper" style={{ margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div className="loading-spinner-glow">
            <Loader className="spin-anim" size={44} style={{ color: 'var(--color-brand)', position: 'relative', zIndex: 1 }} />
          </div>
          <div className="loading-text">กำลังเชื่อมต่อกับระบบ...</div>
          <div className="loading-subtext">กรุณารอสักครู่เพื่อเข้าสู่ห้องเรียนจำลอง</div>
        </div>
      </div>
    );
  }

  // Render Auth View if not authenticated
  if (!session || !profile) {
    return (
      <>
        <AnimatedBackground isDark={theme === 'dark'} />
        <header className="navbar" style={{ position: 'relative', zIndex: 2 }}>
          <div className="container navbar-container">
            <div className="brand-logo">
              <GraduationCap size={28} />
              <span>EduSphere</span>
            </div>
            <button 
              onClick={toggleTheme} 
              className="btn btn-secondary" 
              style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                padding: 0,
                border: '1px solid var(--border-glass)',
                background: 'var(--bg-tertiary)',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)'
              }}
              title={theme === 'light' ? 'เปลี่ยนเป็นโหมดมืด' : 'เปลี่ยนเป็นโหมดสว่าง'}
            >
              {theme === 'light' ? <Moon size={18} style={{ color: 'var(--text-primary)' }} /> : <Sun size={18} style={{ color: 'var(--text-primary)' }} />}
            </button>
          </div>
        </header>
        <main className="container" style={{ position: 'relative', zIndex: 1 }}>
          <Suspense fallback={<SuspenseFallback />}>
            <AuthView onAuthSuccess={handleAuthSuccess} />
          </Suspense>
        </main>
      </>
    );
  }

  return (
    <>
      <AnimatedBackground isDark={theme === 'dark'} />
      {/* Top Navbar */}
      <header className="navbar" style={{ position: 'relative', zIndex: 2 }}>
        <div className="container navbar-container">
          <div className="brand-logo" style={{ cursor: 'pointer' }} onClick={() => {
            setCurrentView('dashboard');
            window.history.pushState({ view: 'dashboard' }, '', '/');
          }}>
            <GraduationCap size={28} />
            <span>EduSphere</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <button 
              onClick={toggleTheme} 
              className="btn btn-secondary" 
              style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '38px',
                height: '38px',
                borderRadius: '50%',
                padding: 0,
                border: '1px solid var(--border-glass)',
                background: 'var(--bg-tertiary)',
                cursor: 'pointer',
                transition: 'var(--transition-smooth)'
              }}
              title={theme === 'light' ? 'เปลี่ยนเป็นโหมดมืด' : 'เปลี่ยนเป็นโหมดสว่าง'}
            >
              {theme === 'light' ? <Moon size={18} style={{ color: 'var(--text-primary)' }} /> : <Sun size={18} style={{ color: 'var(--text-primary)' }} />}
            </button>

            <div 
              onClick={() => {
                setCurrentView('profile');
                window.history.pushState({ view: 'profile' }, '', '/profile');
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
              title="ดูโปรไฟล์และผลคะแนนของคุณ"
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--bg-tertiary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid var(--border-glass)',
                transition: 'var(--transition-smooth)'
              }}>
                <User size={18} style={{ color: 'var(--text-secondary)' }} />
              </div>
              <div className="nav-user-details">
                <strong style={{ display: 'block', fontSize: '0.875rem', lineHeight: '1.2' }}>{profile.full_name}</strong>
                <span className={`badge ${profile.role === 'admin' ? 'badge-admin' : 'badge-student'}`} style={{ fontSize: '0.7rem', marginTop: '2px' }}>
                  {profile.role === 'admin' ? 'อาจารย์ / ผู้ดูแล' : 'นักเรียน'}
                </span>
              </div>
            </div>

            <button className="btn btn-secondary btn-sm nav-logout-btn" onClick={handleLogout} style={{ padding: '8px 12px' }}>
              <LogOut size={16} />
              <span className="nav-logout-text">ออกจากระบบ</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Areas */}
      <main className="container" style={{ padding: '40px 24px', position: 'relative', zIndex: 1 }}>
        <Suspense fallback={<SuspenseFallback />}>
          {/* Use key to trigger fade-in animation on view change */}
          <div key={currentView + (activeSlug || activePageId || '')} className="view-fade-in">
            {currentView === 'dashboard' && (
              profile.role === 'admin' ? (
                <AdminDashboard
                  onEditPage={(id) => {
                    setActivePageId(id);
                    setCurrentView('editor');
                  }}
                  onViewPage={(slug) => {
                    setActiveSlug(slug);
                    setCurrentView('viewer');
                    window.history.pushState({ view: 'viewer', slug }, '', `/course/${slug}`);
                  }}
                />
              ) : (
                <StudentDashboard
                  userId={profile.id}
                  onViewPage={(slug) => {
                    setActiveSlug(slug);
                    setCurrentView('viewer');
                    window.history.pushState({ view: 'viewer', slug }, '', `/course/${slug}`);
                  }}
                />
              )
            )}

            {currentView === 'editor' && profile.role === 'admin' && (
              <PageEditor
                pageId={activePageId}
                theme={theme}
                onClose={() => {
                  setCurrentView('dashboard');
                  setActivePageId(null);
                  window.history.pushState({ view: 'dashboard' }, '', '/');
                }}
              />
            )}

            {currentView === 'viewer' && activeSlug && (
              <PageView
                slug={activeSlug}
                userId={profile.id}
                userRole={profile.role}
                theme={theme}
                onBack={() => {
                  setCurrentView('dashboard');
                  setActiveSlug(null);
                  window.history.pushState({ view: 'dashboard' }, '', '/');
                }}
              />
            )}
            {currentView === 'profile' && (
              <ProfileView
                userId={profile.id}
                profile={profile}
                onProfileUpdate={(updatedProfile) => setProfile(updatedProfile)}
                onBack={() => {
                  setCurrentView('dashboard');
                  window.history.pushState({ view: 'dashboard' }, '', '/');
                }}
                onViewPage={(slug) => {
                  setActiveSlug(slug);
                  setCurrentView('viewer');
                  window.history.pushState({ view: 'viewer', slug }, '', `/course/${slug}`);
                }}
              />
            )}
          </div>
        </Suspense>
      </main>
    </>
  );
}

export default App;

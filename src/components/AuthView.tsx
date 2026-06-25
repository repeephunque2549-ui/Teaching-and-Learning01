import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Mail, Lock, User, ShieldAlert, BookOpen } from 'lucide-react';

interface AuthViewProps {
  onAuthSuccess: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (isSignUp) {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              role: 'student',
            },
          },
        });

        if (signUpError) throw signUpError;
        
        if (data.user) {
          setSuccessMsg('สมัครสมาชิกสำเร็จแล้ว! สามารถเข้าสู่ระบบได้เลย');
          setIsSignUp(false);
          setPassword('');
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) throw signInError;
        onAuthSuccess();
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 'calc(100vh - 140px)',
      padding: '20px'
    }}>
      <div className="card-glass" style={{ width: '100%', maxWidth: '440px' }}>
        <div className="text-center" style={{ marginBottom: '28px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'var(--color-brand-glow)',
            color: 'var(--color-brand)',
            marginBottom: '16px'
          }}>
            <BookOpen size={32} />
          </div>
          <h2>{isSignUp ? 'สร้างบัญชีผู้ใช้งาน' : 'เข้าสู่ระบบ'}</h2>
          <p style={{ fontSize: '0.9rem', marginTop: '4px' }}>
            {isSignUp ? 'กรอกข้อมูลเพื่อเริ่มต้นการเรียนรู้' : 'ยินดีต้อนรับกลับเข้าสู่แพลตฟอร์มการเรียนรู้'}
          </p>
        </div>

        {error && (
          <div style={{
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#fca5a5',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.9rem',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <ShieldAlert size={18} />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div style={{
            background: 'rgba(16, 185, 129, 0.1)',
            border: '1px solid rgba(16, 185, 129, 0.2)',
            color: '#a7f3d0',
            padding: '12px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.9rem',
            marginBottom: '20px'
          }}>
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isSignUp && (
            <>
              <div className="form-group">
                <label className="form-label">ชื่อ-นามสกุล</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--text-muted)' }}>
                    <User size={18} />
                  </span>
                  <input
                    type="text"
                    required
                    className="form-input"
                    style={{ paddingLeft: '44px' }}
                    placeholder="สมชาย ใจดี"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="form-group">
            <label className="form-label">อีเมล</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--text-muted)' }}>
                <Mail size={18} />
              </span>
              <input
                type="email"
                required
                className="form-input"
                style={{ paddingLeft: '44px' }}
                placeholder="email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '24px' }}>
            <label className="form-label">รหัสผ่าน</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '14px', top: '12px', color: 'var(--text-muted)' }}>
                <Lock size={18} />
              </span>
              <input
                type="password"
                required
                minLength={6}
                className="form-input"
                style={{ paddingLeft: '44px' }}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', marginBottom: '16px' }}
            disabled={loading}
          >
            {loading ? 'กำลังประมวลผล...' : isSignUp ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
          </button>
        </form>

        <div className="text-center" style={{ marginTop: '12px' }}>
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
              setSuccessMsg(null);
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-brand)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.9rem'
            }}
          >
            {isSignUp ? 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบที่นี่' : 'ยังไม่มีบัญชี? สมัครสมาชิกที่นี่'}
          </button>
        </div>
      </div>
    </div>
  );
};

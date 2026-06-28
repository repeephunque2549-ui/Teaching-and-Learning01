import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { DatabaseProfile, QuizSubmission } from '../supabaseClient';
import { User, Award, ArrowLeft, Save, Check, Loader, BookOpen, Calendar, BookOpenCheck } from 'lucide-react';

interface ProfileViewProps {
  userId: string;
  profile: DatabaseProfile;
  onProfileUpdate: (updatedProfile: DatabaseProfile) => void;
  onBack: () => void;
  onViewPage: (slug: string) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  userId,
  profile,
  onProfileUpdate,
  onBack,
  onViewPage
}) => {
  const [fullName, setFullName] = useState(profile.full_name || '');
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchProfileSubmissions();
  }, [userId]);

  const fetchProfileSubmissions = async () => {
    setLoadingSubmissions(true);
    try {
      const { data, error } = await supabase
        .from('quiz_submissions')
        .select(`
          id,
          page_id,
          user_id,
          score,
          total_questions,
          created_at,
          learning_pages (
            title,
            slug
          )
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubmissions((data as any) || []);
    } catch (err: any) {
      console.error('Error fetching submissions for profile:', err.message);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMessage('กรุณากรอกชื่อ-นามสกุล');
      return;
    }

    setSaving(true);
    setErrorMessage('');
    setSaveSuccess(false);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      onProfileUpdate(data);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage('เกิดข้อผิดพลาดในการอัปเดตข้อมูล: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Find unique completed lessons
  const completedLessons = submissions.reduce((acc: any[], current) => {
    const page = current.learning_pages;
    if (page && !acc.some(item => item.page_id === current.page_id)) {
      acc.push({
        page_id: current.page_id,
        title: page.title,
        slug: page.slug,
        score: current.score,
        total_questions: current.total_questions,
        completed_at: current.created_at
      });
    }
    return acc;
  }, []);

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header Navigation */}
      <div style={{ marginBottom: '24px' }}>
        <button
          className="btn btn-secondary btn-sm"
          onClick={onBack}
          style={{ gap: '8px', display: 'flex', alignItems: 'center' }}
        >
          <ArrowLeft size={16} />
          กลับไปยังแดชบอร์ด
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        gap: '24px',
      }}>
        {/* Profile Card & Editing */}
        <div className="card-glass" style={{ padding: '28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'var(--bg-tertiary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '2px solid var(--color-brand)'
            }}>
              <User size={32} style={{ color: 'var(--color-brand)' }} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>โปรไฟล์ของฉัน</h2>
              <span className={`badge ${profile.role === 'admin' ? 'badge-admin' : 'badge-student'}`}>
                {profile.role === 'admin' ? 'อาจารย์ / ผู้ดูแล' : 'นักเรียน'}
              </span>
            </div>
          </div>

          <form onSubmit={handleUpdateName}>
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="fullNameInput" style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                ชื่อ-นามสกุล
              </label>
              <input
                id="fullNameInput"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: '8px',
                  color: '#ffffff',
                  fontSize: '1rem',
                  outline: 'none',
                  transition: 'var(--transition-smooth)'
                }}
              />
            </div>

            {errorMessage && (
              <div style={{ color: 'var(--color-danger)', marginBottom: '16px', fontSize: '0.9rem' }}>
                {errorMessage}
              </div>
            )}

            {saveSuccess && (
              <div style={{
                color: 'var(--color-success)',
                marginBottom: '16px',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}>
                <Check size={16} />
                อัปเดตข้อมูลส่วนตัวเสร็จเรียบร้อย!
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || fullName.trim() === profile.full_name}
              style={{ gap: '8px', display: 'flex', alignItems: 'center' }}
            >
              {saving ? (
                <>
                  <Loader size={18} className="spin-anim" />
                  กำลังบันทึก...
                </>
              ) : (
                <>
                  <Save size={18} />
                  บันทึกการเปลี่ยนแปลง
                </>
              )}
            </button>
          </form>
        </div>

        {/* Stats Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px'
        }}>
          <div className="card-glass" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(99, 102, 241, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-brand)'
            }}>
              <BookOpen size={24} />
            </div>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block' }}>บทเรียนที่เรียนไปแล้ว</span>
              <strong style={{ fontSize: '1.5rem', color: '#ffffff' }}>{completedLessons.length} บทเรียน</strong>
            </div>
          </div>

          <div className="card-glass" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: 'rgba(245, 158, 11, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-warning)'
            }}>
              <Award size={24} />
            </div>
            <div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'block' }}>การทำแบบทดสอบทั้งหมด</span>
              <strong style={{ fontSize: '1.5rem', color: '#ffffff' }}>{submissions.length} ครั้ง</strong>
            </div>
          </div>
        </div>

        {/* Completed Lessons Section */}
        <div className="card-glass" style={{ padding: '28px' }}>
          <h3 style={{ fontSize: '1.25rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpenCheck size={20} style={{ color: 'var(--color-brand)' }} />
            ประวัติการเรียนรู้และผลคะแนน
          </h3>

          {loadingSubmissions ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Loader className="spin-anim" size={32} style={{ color: 'var(--color-brand)' }} />
              <p style={{ marginTop: '12px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>กำลังโหลดข้อมูล...</p>
            </div>
          ) : submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <Award size={40} style={{ marginBottom: '12px' }} />
              <p>คุณยังไม่ได้เริ่มเรียนบทเรียนใด ๆ หรือทำแบบทดสอบ</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {submissions.map((sub) => (
                <div
                  key={sub.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    borderRadius: '10px',
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid var(--border-glass)',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: '1.05rem', marginBottom: '6px', color: '#ffffff' }}>
                      {sub.learning_pages?.title || 'บทเรียนที่ถูกลบไปแล้ว'}
                    </h4>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={12} />
                      ทำเมื่อ: {new Date(sub.created_at).toLocaleString('th-TH')}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span style={{
                      background: sub.score === sub.total_questions ? 'var(--color-success-glow)' : 'rgba(255,255,255,0.05)',
                      color: sub.score === sub.total_questions ? 'var(--color-success)' : '#ffffff',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      fontWeight: 700,
                      fontSize: '0.9rem'
                    }}>
                      คะแนน: {sub.score} / {sub.total_questions}
                    </span>

                    {sub.learning_pages?.slug && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => onViewPage(sub.learning_pages!.slug)}
                      >
                        ทบทวนบทเรียน
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { LearningPage, QuizSubmission } from '../supabaseClient';
import { BookOpen, CheckCircle, PlayCircle, Loader, RefreshCw, Award } from 'lucide-react';

interface StudentDashboardProps {
  onViewPage: (slug: string) => void;
  userId: string;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({ onViewPage, userId }) => {
  const [pages, setPages] = useState<LearningPage[]>([]);
  const [submissions, setSubmissions] = useState<Record<string, QuizSubmission>>({});
  const [loading, setLoading] = useState(false);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      // 1. Fetch all pages
      const { data: pageData, error: pageError } = await supabase
        .from('learning_pages')
        .select('*')
        .order('created_at', { ascending: false });

      if (pageError) throw pageError;
      setPages(pageData || []);

      // 2. Fetch student's own submissions
      const { data: subData, error: subError } = await supabase
        .from('quiz_submissions')
        .select('*')
        .eq('user_id', userId);

      if (subError) throw subError;

      // Map by page_id for quick lookup
      const subMap: Record<string, QuizSubmission> = {};
      if (subData) {
        subData.forEach((sub: QuizSubmission) => {
          subMap[sub.page_id] = sub;
        });
      }
      setSubmissions(subMap);
    } catch (err: any) {
      console.error('Error fetching student dashboard data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [userId]);

  if (loading) {
    return (
      <div className="text-center" style={{ padding: '80px 0' }}>
        <Loader className="spin-anim" size={40} style={{ color: 'var(--color-brand)' }} />
        <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>กำลังโหลดบทเรียนสำหรับคุณ...</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '32px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.8rem' }}>ห้องเรียนของฉัน</h2>
          <p style={{ color: 'var(--text-secondary)' }}>เลือกบทเรียนด้านล่างเพื่อเริ่มเรียนรู้และทำแบบทดสอบได้ทันที</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchStudentData}>
          <RefreshCw size={18} />
          รีเฟรชบทเรียน
        </button>
      </div>

      {pages.length === 0 ? (
        <div className="card-glass text-center" style={{ padding: '60px 20px' }}>
          <BookOpen size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h3>ยังไม่มีบทเรียนเผยแพร่ในขณะนี้</h3>
          <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
            กรุณารอผู้ดูแลระบบหรืออาจารย์สร้างเนื้อหาบทเรียนใหม่เร็ว ๆ นี้
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3">
          {pages.map(page => {
            const userSub = submissions[page.id];
            const isCompleted = !!userSub;

            return (
              <div
                key={page.id}
                className="card-glass"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  border: isCompleted ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid var(--border-glass)',
                  background: isCompleted ? 'linear-gradient(to bottom, rgba(16, 185, 129, 0.03), var(--bg-glass))' : 'var(--bg-glass)',
                  transition: 'var(--transition-smooth)'
                }}
              >
                <div>
                  <div className="flex-between" style={{ marginBottom: '12px' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      background: 'rgba(255,255,255,0.05)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      color: 'var(--text-muted)'
                    }}>
                      บทเรียน
                    </span>

                    {isCompleted ? (
                      <span className="badge" style={{ background: 'var(--color-success-glow)', color: 'var(--color-success)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <CheckCircle size={12} />
                        เรียนแล้ว
                      </span>
                    ) : (
                      <span className="badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--color-brand)', display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <PlayCircle size={12} />
                        ยังไม่ได้เรียน
                      </span>
                    )}
                  </div>

                  <h3 style={{ fontSize: '1.25rem', marginBottom: '10px', lineHeight: 1.3 }}>{page.title}</h3>
                </div>

                <div style={{
                  marginTop: '24px',
                  borderTop: '1px solid var(--border-glass)',
                  paddingTop: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  {isCompleted ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      <Award size={14} style={{ color: 'var(--color-warning)' }} />
                      <span>คะแนนควิซ: <strong>{userSub.score}/{userSub.total_questions}</strong></span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      ใช้เวลาเรียนประมาณ {page.estimated_duration || '10-15 นาที'}
                    </span>
                  )}

                  <button
                    className={`btn btn-sm ${isCompleted ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => onViewPage(page.slug)}
                  >
                    {isCompleted ? 'ทบทวนบทเรียน' : 'เริ่มเรียนเลย'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

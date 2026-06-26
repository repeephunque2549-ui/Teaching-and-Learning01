import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { LearningPage, QuizSubmission } from '../supabaseClient';
import { Plus, Edit2, Trash2, Calendar, BookOpen, Award, FileText, ExternalLink, RefreshCw, Clock } from 'lucide-react';

interface AdminDashboardProps {
  onEditPage: (pageId: string | null) => void; // null for creating a new page
  onViewPage: (slug: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onEditPage, onViewPage }) => {
  const [pages, setPages] = useState<LearningPage[]>([]);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [activeTab, setActiveTab] = useState<'pages' | 'submissions'>('pages');
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch pages
      const { data: pageData, error: pageError } = await supabase
        .from('learning_pages')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (pageError) throw pageError;
      setPages(pageData || []);

      // Fetch quiz submissions with student profile & page titles
      const { data: subData, error: subError } = await supabase
        .from('quiz_submissions')
        .select(`
          id,
          page_id,
          user_id,
          answers,
          score,
          total_questions,
          created_at,
          profiles (
            full_name,
            role
          ),
          learning_pages (
            title
          )
        `)
        .order('created_at', { ascending: false });

      if (subError) throw subError;
      setSubmissions((subData as any) || []);
    } catch (err: any) {
      console.error('Error fetching admin dashboard data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDeletePage = async (id: string) => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการลบบทเรียนนี้? การลบจะไม่สามารถย้อนกลับได้')) return;
    
    try {
      const { error } = await supabase
        .from('learning_pages')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      setPages(pages.filter(p => p.id !== id));
      // Refresh submissions because of cascade delete
      fetchData();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการลบ: ' + err.message);
    }
  };

  return (
    <div>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <div>
          <h2 style={{ fontSize: '1.8rem' }}>แดชบอร์ดผู้ดูแลระบบ</h2>
          <p style={{ color: 'var(--text-secondary)' }}>จัดการหน้าบทเรียนและตรวจสอบผลการเรียนของนักเรียน</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
            <RefreshCw size={18} className={loading ? 'spin-anim' : ''} />
            รีเฟรช
          </button>
          <button className="btn btn-primary" onClick={() => onEditPage(null)}>
            <Plus size={18} />
            สร้างหน้าเรียนใหม่
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border-glass)',
        marginBottom: '24px',
        gap: '8px'
      }}>
        <button
          onClick={() => setActiveTab('pages')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'pages' ? '2px solid var(--color-brand)' : '2px solid transparent',
            color: activeTab === 'pages' ? '#ffffff' : 'var(--text-secondary)',
            padding: '12px 16px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
            transition: 'var(--transition-smooth)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BookOpen size={18} />
            จัดการหน้าเรียน ({pages.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('submissions')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'submissions' ? '2px solid var(--color-brand)' : '2px solid transparent',
            color: activeTab === 'submissions' ? '#ffffff' : 'var(--text-secondary)',
            padding: '12px 16px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
            transition: 'var(--transition-smooth)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Award size={18} />
            ผลคะแนนแบบสอบถาม ({submissions.length})
          </div>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'pages' ? (
        pages.length === 0 ? (
          <div className="card-glass text-center" style={{ padding: '60px 20px' }}>
            <BookOpen size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
            <h3>ยังไม่มีหน้าเรียนถูกสร้างขึ้น</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', marginTop: '4px' }}>
              เริ่มต้นสร้างบทเรียนหน้าแรกของคุณเพื่อให้นักเรียนเข้ามาเรียนรู้
            </p>
            <button className="btn btn-primary" onClick={() => onEditPage(null)}>
              <Plus size={18} />
              สร้างหน้าเรียนแรกเลย
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2">
            {pages.map(page => (
              <div key={page.id} className="card-glass" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div className="flex-between" style={{ marginBottom: '12px' }}>
                    <span style={{
                      fontSize: '0.8rem',
                      background: 'rgba(255,255,255,0.05)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      color: 'var(--text-secondary)'
                    }}>
                      /{page.slug}
                    </span>
                    <span className="badge badge-admin" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                      <FileText size={12} />
                      {page.content ? page.content.length : 0} บล็อก
                    </span>
                  </div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '8px' }}>{page.title}</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <Calendar size={14} />
                      <span>สร้างเมื่อ: {new Date(page.created_at).toLocaleDateString('th-TH')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      <Clock size={14} />
                      <span>เวลาเรียน: {page.estimated_duration || '10-15 นาที'}</span>
                    </div>
                  </div>
                </div>
                
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: '24px',
                  borderTop: '1px solid var(--border-glass)',
                  paddingTop: '16px'
                }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ gap: '4px' }}
                    onClick={() => onViewPage(page.slug)}
                  >
                    <ExternalLink size={14} />
                    ดูหน้าเว็บ
                  </button>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ gap: '4px' }}
                      onClick={() => onEditPage(page.id)}
                    >
                      <Edit2 size={14} />
                      แก้ไข
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      style={{ gap: '4px' }}
                      onClick={() => handleDeletePage(page.id)}
                    >
                      <Trash2 size={14} />
                      ลบ
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        /* Submissions Tab */
        <div className="card-glass" style={{ padding: '0px', overflow: 'hidden' }}>
          {submissions.length === 0 ? (
            <div className="text-center" style={{ padding: '60px 20px' }}>
              <Award size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
              <h3>ยังไม่มีนักเรียนส่งคำตอบ</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                เมื่อนักเรียนทำแบบทดสอบและส่งคำตอบ คะแนนของพวกเขาจะมาแสดงที่นี่
              </p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                textAlign: 'left',
                color: 'var(--text-primary)'
              }}>
                <thead>
                  <tr style={{
                    borderBottom: '1px solid var(--border-glass)',
                    background: 'rgba(255,255,255,0.02)'
                  }}>
                    <th style={{ padding: '16px 24px' }}>ชื่อผู้ส่ง</th>
                    <th style={{ padding: '16px 24px' }}>บทเรียน</th>
                    <th style={{ padding: '16px 24px', textAlign: 'center' }}>คะแนนที่ได้</th>
                    <th style={{ padding: '16px 24px' }}>วันที่ส่ง</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map(sub => (
                    <tr key={sub.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div>
                          <strong style={{ display: 'block' }}>{sub.profiles?.full_name || 'ไม่ระบุชื่อ'}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{sub.profiles?.role || 'student'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        {sub.learning_pages?.title || 'บทเรียนที่ถูกลบไปแล้ว'}
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                        <span style={{
                          background: sub.score === sub.total_questions ? 'var(--color-success-glow)' : 'rgba(255,255,255,0.05)',
                          color: sub.score === sub.total_questions ? 'var(--color-success)' : '#ffffff',
                          padding: '6px 12px',
                          borderRadius: '20px',
                          fontWeight: 700,
                          fontSize: '0.95rem'
                        }}>
                          {sub.score} / {sub.total_questions}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        {new Date(sub.created_at).toLocaleString('th-TH')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Embedded CSS style for spinning refresh icon */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin-anim {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
};

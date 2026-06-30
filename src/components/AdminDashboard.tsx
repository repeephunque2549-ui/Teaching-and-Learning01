import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { LearningPage, QuizSubmission } from '../supabaseClient';
import { Plus, Edit2, Trash2, Calendar, BookOpen, Award, FileText, ExternalLink, RefreshCw, Clock, Search, Image } from 'lucide-react';

interface AdminDashboardProps {
  onEditPage: (pageId: string | null) => void; // null for creating a new page
  onViewPage: (slug: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onEditPage, onViewPage }) => {
  const [pages, setPages] = useState<LearningPage[]>([]);
  const [submissions, setSubmissions] = useState<QuizSubmission[]>([]);
  const [activeTab, setActiveTab] = useState<'pages' | 'submissions'>('pages');
  const [loading, setLoading] = useState(false);

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPageId, setSelectedPageId] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');

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

  const filteredSubmissions = submissions.filter(sub => {
    const name = (sub.profiles?.full_name || '').toLowerCase();
    const pageTitle = (sub.learning_pages?.title || '').toLowerCase();
    const query = searchQuery.toLowerCase();
    const matchesSearch = name.includes(query) || pageTitle.includes(query);
    const matchesPage = selectedPageId === 'all' || sub.page_id === selectedPageId;
    return matchesSearch && matchesPage;
  }).sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    } else if (sortBy === 'oldest') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    } else if (sortBy === 'highest') {
      return b.score - a.score;
    } else if (sortBy === 'lowest') {
      return a.score - b.score;
    }
    return 0;
  });

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
        gap: '8px',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        WebkitOverflowScrolling: 'touch'
      }}>
        <button
          onClick={() => setActiveTab('pages')}
          style={{
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'pages' ? '2px solid var(--color-brand)' : '2px solid transparent',
            color: activeTab === 'pages' ? 'var(--text-heading)' : 'var(--text-secondary)',
            padding: '12px 16px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
            transition: 'var(--transition-smooth)',
            flexShrink: 0
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
            color: activeTab === 'submissions' ? 'var(--text-heading)' : 'var(--text-secondary)',
            padding: '12px 16px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: 600,
            transition: 'var(--transition-smooth)',
            flexShrink: 0
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
                  {/* Cover Image */}
                  {page.cover_image_url ? (
                    <div style={{
                      marginBottom: '14px',
                      borderRadius: '10px',
                      overflow: 'hidden',
                      maxHeight: '140px',
                      boxShadow: '0 2px 12px rgba(0,0,0,0.2)'
                    }}>
                      <img
                        src={page.cover_image_url}
                        alt={page.title}
                        style={{
                          width: '100%',
                          height: '140px',
                          objectFit: 'cover',
                          display: 'block'
                        }}
                      />
                    </div>
                  ) : (
                    <div style={{
                      marginBottom: '14px',
                      borderRadius: '10px',
                      height: '80px',
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(236,72,153,0.08))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Image size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
                    </div>
                  )}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {submissions.length > 0 && (
            <div className="card-glass admin-filters-wrapper" style={{
              display: 'flex',
              gap: '16px',
              padding: '16px 20px',
              flexWrap: 'wrap',
              alignItems: 'center'
            }}>
              {/* Search box */}
              <div className="admin-filter-item" style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
                <Search size={18} style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <input
                  type="text"
                  placeholder="ค้นหาชื่อผู้ส่ง หรือชื่อบทเรียน..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px 8px 38px',
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    transition: 'var(--transition-smooth)'
                  }}
                />
              </div>

              {/* Lesson Filter */}
              <div className="admin-filter-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '200px' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>บทเรียน:</span>
                <select
                  value={selectedPageId}
                  onChange={(e) => setSelectedPageId(e.target.value)}
                  style={{
                    flex: '1',
                    padding: '8px 12px',
                    background: 'var(--select-bg)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="all">ทั้งหมด</option>
                  {pages.map(page => (
                    <option key={page.id} value={page.id}>{page.title}</option>
                  ))}
                </select>
              </div>

              {/* Sort selection */}
              <div className="admin-filter-item" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '180px' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>เรียงลำดับ:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  style={{
                    flex: '1',
                    padding: '8px 12px',
                    background: 'var(--select-bg)',
                    border: '1px solid var(--border-glass)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="newest">ใหม่สุด</option>
                  <option value="oldest">เก่าสุด</option>
                  <option value="highest">คะแนนสูงสุด</option>
                  <option value="lowest">คะแนนต่ำสุด</option>
                </select>
              </div>
            </div>
          )}

          <div className="card-glass" style={{ padding: '0px', overflow: 'hidden' }}>
            {submissions.length === 0 ? (
              <div className="text-center" style={{ padding: '60px 20px' }}>
                <Award size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                <h3>ยังไม่มีนักเรียนส่งคำตอบ</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                  เมื่อนักเรียนทำแบบทดสอบและส่งคำตอบ คะแนนของพวกเขาจะมาแสดงที่นี่
                </p>
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="text-center" style={{ padding: '60px 20px' }}>
                <Search size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
                <h3>ไม่พบผลคะแนนที่ตรงตามเงื่อนไข</h3>
                <p style={{ color: 'var(--text-secondary)', marginTop: '4px', marginBottom: '16px' }}>
                  ลองเปลี่ยนคำค้นหาหรือล้างตัวกรองเพื่อแสดงข้อมูลทั้งหมด
                </p>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  setSearchQuery('');
                  setSelectedPageId('all');
                  setSortBy('newest');
                }}>
                  ล้างตัวกรอง
                </button>
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
                    {filteredSubmissions.map(sub => (
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
                            background: sub.score === sub.total_questions ? 'var(--color-success-glow)' : 'var(--subtle-bg)',
                            color: sub.score === sub.total_questions ? 'var(--color-success)' : 'var(--text-heading)',
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

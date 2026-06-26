import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import type { LearningPage, QuizSubmission } from '../supabaseClient';
import { ArrowLeft, Loader, CheckCircle2, XCircle, Play, FileText, HelpCircle, RefreshCw, ExternalLink } from 'lucide-react';

interface PageViewProps {
  slug: string;
  userId: string;
  userRole: 'admin' | 'student';
  onBack: () => void;
}

export const PageView: React.FC<PageViewProps> = ({ slug, userId, userRole, onBack }) => {
  const [page, setPage] = useState<LearningPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({}); // questionId -> optionIndex
  const [submission, setSubmission] = useState<QuizSubmission | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const isQuizStandalone = new URLSearchParams(window.location.search).get('quiz') === 'true';

  useEffect(() => {
    fetchPageAndSubmission();
  }, [slug, userId]);

  const fetchPageAndSubmission = async () => {
    setLoading(true);
    try {
      // 1. Fetch the page content
      const { data: pageDataArr, error: pageError } = await supabase
        .from('learning_pages')
        .select('*')
        .eq('slug', slug)
        .order('created_at', { ascending: true })
        .limit(1);

      if (pageError) throw pageError;
      const pageData = pageDataArr && pageDataArr.length > 0 ? pageDataArr[0] : null;
      setPage(pageData);

      if (pageData) {
        // 2. Fetch existing submission for this user on this page (latest one if multiple exist)
        const { data: subData, error: subError } = await supabase
          .from('quiz_submissions')
          .select('*')
          .eq('page_id', pageData.id)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(1);

        if (subError) throw subError;
        
        if (subData && subData.length > 0) {
          const latestSubmission = subData[0];
          setSubmission(latestSubmission);
          setUserAnswers(latestSubmission.answers || {});
          setShowResults(true);
        } else {
          setSubmission(null);
          setUserAnswers({});
          setShowResults(false);
        }
      }
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการโหลดบทเรียน: ' + err.message);
      onBack();
    } finally {
      setLoading(false);
    }
  };

  // Extract YouTube ID from various URL formats
  const getYouTubeEmbedUrl = (url: string) => {
    if (!url) return '';
    
    // Regular expression to match YouTube video ID
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    
    const videoId = (match && match[2].length === 11) ? match[2] : url;
    return `https://www.youtube.com/embed/${videoId}`;
  };

  // Option selection
  const handleSelectOption = (questionId: string, optionIndex: number) => {
    if (showResults) return; // Prevent changing answers after submission
    setUserAnswers({
      ...userAnswers,
      [questionId]: optionIndex
    });
  };

  // Submit quiz answers
  const handleSubmitQuiz = async (_quizBlockId: string, questions: any[]) => {
    // Verify all questions have been answered
    const unanswered = questions.filter(q => userAnswers[q.id] === undefined);
    if (unanswered.length > 0) {
      return alert('กรุณาตอบคำถามให้ครบทุกข้อก่อนส่งคำตอบครับ');
    }

    if (userRole === 'admin') {
      return alert('สำหรับผู้แลระบบ (Admin) หน้าทดสอบนี้เป็นการพรีวิวเท่านั้น ไม่สามารถบันทึกคะแนนลงระบบได้');
    }

    setSubmitting(true);
    try {
      // Calculate score
      let calculatedScore = 0;
      questions.forEach(q => {
        if (userAnswers[q.id] === q.correctOptionIndex) {
          calculatedScore++;
        }
      });

      const submissionData = {
        page_id: page!.id,
        user_id: userId,
        answers: userAnswers,
        score: calculatedScore,
        total_questions: questions.length
      };

      const { data: insertedArr, error } = await supabase
        .from('quiz_submissions')
        .insert([submissionData])
        .select();

      if (error) throw error;

      const data = insertedArr && insertedArr.length > 0 ? insertedArr[0] : null;

      setSubmission(data);
      setShowResults(true);
      alert(`คุณทำควิซเสร็จสิ้นแล้ว! คะแนนที่ได้: ${calculatedScore} / ${questions.length}`);
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการส่งคำตอบ: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Retake quiz by deleting the submission
  const handleRetakeQuiz = async () => {
    if (!submission) return;
    if (!window.confirm('คุณต้องการทำแบบทดสอบใหม่อีกครั้งใช่หรือไม่? คะแนนเดิมของคุณจะถูกลบออกจากระบบ')) {
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('quiz_submissions')
        .delete()
        .eq('page_id', page!.id)
        .eq('user_id', userId);

      if (error) throw error;

      setSubmission(null);
      setUserAnswers({});
      setShowResults(false);
      alert('ลบคะแนนเดิมเรียบร้อยแล้ว คุณสามารถทำแบบทดสอบใหม่ได้ทันที');
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการลบคำตอบเดิม: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center" style={{ padding: '80px 0' }}>
        <Loader className="spin-anim" size={40} style={{ color: 'var(--color-brand)' }} />
        <p style={{ marginTop: '16px', color: 'var(--text-secondary)' }}>กำลังโหลดเนื้อหาบทเรียน...</p>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="card-glass text-center" style={{ padding: '40px' }}>
        <h3>ไม่พบเนื้อหาบทเรียนนี้</h3>
        <button onClick={onBack} className="btn btn-secondary mt-4">กลับหน้าหลัก</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '60px' }}>
      <div style={{ marginBottom: '24px' }}>
        <button onClick={onBack} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
          <ArrowLeft size={16} />
          กลับห้องเรียน
        </button>
      </div>

      <div className="text-center" style={{ marginBottom: '40px' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '8px' }}>
          {isQuizStandalone ? `แบบทดสอบ: ${page.title}` : page.title}
        </h1>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          <span>/{page.slug}</span>
          <span>•</span>
          <span>เผยแพร่เมื่อ: {new Date(page.created_at).toLocaleDateString('th-TH')}</span>
        </div>
      </div>

      {/* Render Blocks */}
      <div>
        {page.content && page.content.map((block) => {
          if (isQuizStandalone && block.type !== 'quiz') return null;
          return (
            <div key={block.id} style={{ marginBottom: '32px' }}>
              {block.type === 'text' && (
                <div className="card-glass" style={{ whiteSpace: 'pre-line', fontSize: '1.05rem', lineHeight: '1.7' }}>
                  {block.value}
                </div>
              )}

              {block.type === 'youtube' && (
                <div className="card-glass" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Play size={16} style={{ color: '#ef4444' }} />
                    วิดีโอแนะนำบทเรียน
                  </h3>
                  <div className="video-wrapper">
                    <iframe
                      src={getYouTubeEmbedUrl(block.value)}
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>
                </div>
              )}

              {block.type === 'pdf' && (
                <div className="card-glass" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={16} style={{ color: '#fbbf24' }} />
                    เอกสารประกอบการสอน (PDF)
                  </h3>
                  {block.value ? (
                    <div>
                      <iframe
                        src={`${block.value}#toolbar=0`}
                        className="pdf-viewer"
                        title="PDF document viewer"
                      ></iframe>
                      <div style={{ textAlign: 'right', marginTop: '8px' }}>
                        <a href={block.value} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
                          เปิดในแท็บใหม่
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                      (ยังไม่ได้อัปโหลดหรือระบุลิงก์เอกสาร PDF)
                    </div>
                  )}
                </div>
              )}

              {block.type === 'quiz' && (
                isQuizStandalone ? (
                  <div className="quiz-card" style={{ boxShadow: 'var(--shadow-glow)' }}>
                    <h3 style={{ fontSize: '1.3rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
                      <HelpCircle size={20} style={{ color: 'var(--color-brand)' }} />
                      แบบทดสอบท้ายบทเรียน
                    </h3>

                    {showResults && (
                      <div style={{ marginBottom: '24px' }}>
                        <div style={{
                          background: 'var(--color-success-glow)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          padding: '16px',
                          borderRadius: 'var(--radius-md)',
                          marginBottom: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between'
                        }}>
                          <div>
                            <strong style={{ color: 'var(--color-success)', display: 'block', fontSize: '1.1rem' }}>คุณได้ทำการทดสอบแล้ว</strong>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ส่งเมื่อ {new Date(submission?.created_at || '').toLocaleString('th-TH')}</span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-success)' }}>
                              {submission?.score} / {submission?.total_questions}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)' }}>คะแนนที่ได้</span>
                          </div>
                        </div>
                        {userRole !== 'admin' && submission && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={handleRetakeQuiz}
                              disabled={submitting}
                              style={{ gap: '6px' }}
                            >
                              <RefreshCw size={14} className={submitting ? 'spin-anim' : ''} />
                              ทำแบบทดสอบใหม่
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {block.questions.map((q, qIndex) => {
                      const selectedOpt = userAnswers[q.id];
                      const isCorrect = selectedOpt === q.correctOptionIndex;

                      return (
                        <div key={q.id} className="question-item" style={{ marginBottom: '28px' }}>
                          <p style={{ fontWeight: 600, fontSize: '1.05rem', marginBottom: '8px' }}>
                            ข้อที่ {qIndex + 1}. {q.questionText}
                          </p>
                          
                          {q.options.map((opt, oIndex) => {
                            let labelClass = 'option-label';
                            let icon = null;

                            if (showResults) {
                              if (oIndex === q.correctOptionIndex) {
                                labelClass += ' correct';
                                icon = <CheckCircle2 size={16} style={{ color: 'var(--color-success)', marginLeft: 'auto' }} />;
                              } else if (selectedOpt === oIndex && !isCorrect) {
                                labelClass += ' incorrect';
                                icon = <XCircle size={16} style={{ color: 'var(--color-error)', marginLeft: 'auto' }} />;
                              }
                            } else {
                              if (selectedOpt === oIndex) {
                                labelClass += ' selected';
                              }
                            }

                            return (
                              <div
                                key={oIndex}
                                className={labelClass}
                                onClick={() => handleSelectOption(q.id, oIndex)}
                                style={{ display: 'flex', alignItems: 'center' }}
                              >
                                <span style={{
                                  width: '22px',
                                  height: '22px',
                                  borderRadius: '50%',
                                  background: selectedOpt === oIndex ? 'var(--color-brand)' : 'var(--bg-primary)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '0.8rem',
                                  fontWeight: 700,
                                  border: '1px solid var(--border-glass)'
                                }}>
                                  {String.fromCharCode(65 + oIndex)}
                                </span>
                                <span>{opt}</span>
                                {icon}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}

                    {!showResults && (
                      <div style={{ textAlign: 'center', marginTop: '32px' }}>
                        <button
                          className="btn btn-primary"
                          style={{ padding: '12px 36px', fontSize: '1rem' }}
                          disabled={submitting}
                          onClick={() => handleSubmitQuiz(block.id, block.questions)}
                        >
                          {submitting ? 'กำลังส่ง...' : 'ส่งคำตอบของควิซ'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="quiz-card" style={{ boxShadow: 'var(--shadow-glow)', textAlign: 'center', padding: '36px 20px' }}>
                    <h3 style={{ fontSize: '1.3rem', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <HelpCircle size={22} style={{ color: 'var(--color-brand)' }} />
                      แบบทดสอบท้ายบทเรียน
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', fontSize: '1rem' }}>
                      {showResults 
                        ? `คุณทำแบบทดสอบเสร็จสิ้นแล้ว คะแนนที่ได้: ${submission?.score} / ${submission?.total_questions}`
                        : 'แบบทดสอบสำหรับประเมินความเข้าใจของคุณหลังจากเรียนรู้เนื้อหาเรียบร้อยแล้ว'}
                    </p>
                    <a
                      href={`/course/${slug}?quiz=true`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-primary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', textDecoration: 'none', padding: '12px 28px' }}
                    >
                      <ExternalLink size={16} />
                      {showResults ? 'ดูผลคะแนน / ทำแบบทดสอบใหม่' : 'เริ่มทำแบบทดสอบ (เปิดแท็บใหม่)'}
                    </a>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

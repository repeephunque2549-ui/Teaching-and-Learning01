import React, { useEffect, useState, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { supabase } from '../supabaseClient';
import type { LearningPage, QuizSubmission } from '../supabaseClient';
import { ArrowLeft, Loader, CheckCircle2, XCircle, Play, FileText, HelpCircle, RefreshCw, ClipboardList, Code2, Terminal, RotateCcw, ChevronDown, ChevronUp, Maximize2, Minimize2 } from 'lucide-react';

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
  const [showQuizMode, setShowQuizMode] = useState(false);
  // Code editor state: per block id -> { code, output, running, showOutput }
  const [codeStates, setCodeStates] = useState<Record<string, {
    code: string;
    output: string;
    running: boolean;
    showOutput: boolean;
  }>>({});
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const runIframeRef = useRef<HTMLIFrameElement | null>(null);

  const isQuizStandalone = showQuizMode;

  useEffect(() => {
    fetchPageAndSubmission();
  }, [slug, userId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedBlockId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
        // Initialize code states for code blocks
        const initialCodeStates: Record<string, { code: string; output: string; running: boolean; showOutput: boolean }> = {};
        (pageData.content || []).forEach((block: any) => {
          if (block.type === 'code') {
            initialCodeStates[block.id] = {
              code: block.value || '',
              output: '',
              running: false,
              showOutput: false
            };
          }
        });
        setCodeStates(initialCodeStates);

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

  // --- Code Editor helpers ---
  const updateCodeState = (blockId: string, patch: Partial<{ code: string; output: string; running: boolean; showOutput: boolean }>) => {
    setCodeStates(prev => ({ ...prev, [blockId]: { ...prev[blockId], ...patch } }));
  };

  const runCode = (blockId: string, language: string, _starterCode: string) => {
    const state = codeStates[blockId];
    if (!state) return;
    const code = state.code;

    updateCodeState(blockId, { running: true, showOutput: true, output: '' });

    if (language === 'javascript') {
      // Run JavaScript via srcdoc + postMessage (safe for sandboxed iframes)
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.setAttribute('sandbox', 'allow-scripts');

      const escapedCode = code.replace(/<\/script>/gi, '<\\/script>');
      iframe.srcdoc = `<!DOCTYPE html><html><body><script>
        var __logs = [];
        console.log = function() {
          var args = Array.prototype.slice.call(arguments);
          __logs.push(args.map(function(a) {
            try { return (typeof a === 'object') ? JSON.stringify(a, null, 2) : String(a); }
            catch(e) { return String(a); }
          }).join(' '));
        };
        console.error = function() {
          var args = Array.prototype.slice.call(arguments);
          __logs.push('\u274c ' + args.map(String).join(' '));
        };
        try {
          ${escapedCode}
          parent.postMessage({ type: '__code_result__', logs: __logs, error: null }, '*');
        } catch(e) {
          parent.postMessage({ type: '__code_result__', logs: __logs, error: e.toString() }, '*');
        }
      <\/script></body></html>`;

      const handleMessage = (event: MessageEvent) => {
        if (!event.data || event.data.type !== '__code_result__') return;
        window.removeEventListener('message', handleMessage);
        if (document.body.contains(iframe)) document.body.removeChild(iframe);
        runIframeRef.current = null;

        const outputLines: string[] = event.data.logs || [];
        const errorMsg: string | null = event.data.error || null;

        let finalOutput = outputLines.join('\n');
        if (errorMsg) finalOutput += (finalOutput ? '\n' : '') + '❌ ' + errorMsg;
        if (!finalOutput) finalOutput = '(ไม่มี output — ลองใช้ console.log() เพื่อแสดงผลลัพธ์)';

        updateCodeState(blockId, { running: false, output: finalOutput });
      };

      window.addEventListener('message', handleMessage);
      document.body.appendChild(iframe);
      runIframeRef.current = iframe;

      // Timeout safety
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          window.removeEventListener('message', handleMessage);
          document.body.removeChild(iframe);
          runIframeRef.current = null;
          updateCodeState(blockId, { running: false, output: '⏱️ หมดเวลา: โค้ดใช้เวลานานเกินไป หรืออาจมี infinite loop' });
        }
      }, 5000);
    } else if (language === 'python') {
      // Run Python completely in the browser via Pyodide in a sandboxed iframe
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

      iframe.srcdoc = [
        '<!DOCTYPE html><html><head></head><body><scr' + 'ipt>',
        'function initPyodide() {',
        '  var s = document.createElement("script");',
        '  s.src = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";',
        '  s.onload = function() { parent.postMessage({ type: "__python_ready__" }, "*"); };',
        '  s.onerror = function() { parent.postMessage({ type: "__python_result__", output: null, error: "ไม่สามารถโหลด Pyodide ได้" }, "*"); };',
        '  document.head.appendChild(s);',
        '}',
        'window.addEventListener("message", async function(e) {',
        '  if (e.data && e.data.type === "run_python") {',
        '    try {',
        '      var logs = [];',
        '      var pyodide = await loadPyodide({',
        '        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",',
        '        stdout: function(text) { logs.push(text); },',
        '        stderr: function(text) { logs.push("\\u274c " + text); }',
        '      });',
        '      await pyodide.runPythonAsync(e.data.code);',
        '      var finalOut = logs.join("\\n");',
        '      if (!finalOut) finalOut = "(ไม่มี output — ลองใช้ print() เพื่อแสดงผลลัพธ์)";',
        '      parent.postMessage({ type: "__python_result__", output: finalOut, error: null }, "*");',
        '    } catch (err) {',
        '      parent.postMessage({ type: "__python_result__", output: null, error: err.toString() }, "*");',
        '    }',
        '  }',
        '});',
        'initPyodide();',
        '</scr' + 'ipt></body></html>'
      ].join('\n');


      const handleMessage = (event: MessageEvent) => {
        if (!event.data) return;
        if (event.data.type === '__python_ready__') {
          iframe.contentWindow?.postMessage({ type: 'run_python', code: code }, '*');
        } else if (event.data.type === '__python_result__') {
          window.removeEventListener('message', handleMessage);
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
          runIframeRef.current = null;

          if (event.data.error) {
            updateCodeState(blockId, { running: false, output: '❌ ' + event.data.error });
          } else {
            updateCodeState(blockId, { running: false, output: event.data.output });
          }
        }
      };

      window.addEventListener('message', handleMessage);
      document.body.appendChild(iframe);
      runIframeRef.current = iframe;

      // Timeout safety (give Pyodide 15s to download and run)
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          window.removeEventListener('message', handleMessage);
          document.body.removeChild(iframe);
          runIframeRef.current = null;
          updateCodeState(blockId, { running: false, output: '⏱️ หมดเวลา: การโหลดคอมไพเลอร์ Python ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง' });
        }
      }, 15000);
    } else if (language === 'php') {
      // Run PHP completely in the browser via WebAssembly (php-wasm) in a sandboxed iframe to prevent server command errors
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

      iframe.srcdoc = `<!DOCTYPE html><html><head></head><body><script>
        window.addEventListener('message', async (e) => {
          if (e.data && e.data.type === 'run_php') {
            try {
              let logs = [];
              const { PhpWeb } = await import('https://cdn.jsdelivr.net/npm/php-wasm/PhpWeb.mjs');
              const php = new PhpWeb();
              
              // Capture stdout
              php.addEventListener('output', (event) => {
                logs.push(event.detail);
              });
              
              php.addEventListener('error', (event) => {
                logs.push('❌ ' + event.detail);
              });

              await php.run(e.data.code);
              
              let finalOut = logs.join('');
              if (!finalOut) finalOut = '(ไม่มี output — ลองใช้ echo หรือ print เพื่อแสดงผลลัพธ์)';
              parent.postMessage({ type: '__php_result__', output: finalOut, error: null }, '*');
            } catch (err) {
              parent.postMessage({ type: '__php_result__', output: null, error: err.toString() }, '*');
            }
          }
        });
        // Signal ready immediately
        parent.postMessage({ type: '__php_ready__' }, '*');
      <\/script></body></html>`;

      const handleMessage = (event: MessageEvent) => {
        if (!event.data) return;
        if (event.data.type === '__php_ready__') {
          iframe.contentWindow?.postMessage({ type: 'run_php', code: code }, '*');
        } else if (event.data.type === '__php_result__') {
          window.removeEventListener('message', handleMessage);
          if (document.body.contains(iframe)) document.body.removeChild(iframe);
          runIframeRef.current = null;

          if (event.data.error) {
            updateCodeState(blockId, { running: false, output: '❌ ' + event.data.error });
          } else {
            updateCodeState(blockId, { running: false, output: event.data.output });
          }
        }
      };

      window.addEventListener('message', handleMessage);
      document.body.appendChild(iframe);
      runIframeRef.current = iframe;

      // Timeout safety (give php-wasm 15s to download and run)
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          window.removeEventListener('message', handleMessage);
          document.body.removeChild(iframe);
          runIframeRef.current = null;
          updateCodeState(blockId, { running: false, output: '⏱️ หมดเวลา: การโหลดคอมไพเลอร์ PHP ใช้เวลานานเกินไป กรุณาลองใหม่อีกครั้ง' });
        }
      }, 15000);
    } else if (language === 'html' || language === 'css') {
      updateCodeState(blockId, { running: false, showOutput: true });
    } else {
      // Run C++, Java, Go via Coliru with corsproxy.io proxy wrapper to prevent CORS "Failed to fetch" issues
      let command = 'python3 main.cpp';
      if (language === 'cpp') {
        command = 'g++ -O3 main.cpp && ./a.out';
      } else if (language === 'c') {
        command = 'gcc -O3 main.cpp && ./a.out';
      } else if (language === 'java') {
        command = 'cat <<\'EOF\' > Main.java\n' + code + '\nEOF\njavac Main.java && java Main';
      } else if (language === 'go') {
        command = 'cat <<\'EOF\' > main.go\n' + code + '\nEOF\ngo run main.go';
      }

      // Bypass CORS via corsproxy.io
      const targetUrl = 'https://coliru.stacked-crooked.com/compile';
      const proxyUrl = 'https://corsproxy.io/?' + encodeURIComponent(targetUrl);

      fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cmd: command,
          src: code
        })
      })
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP Error ${res.status}`);
        }
        return res.text();
      })
      .then(output => {
        let out = output;
        if (!out) out = '(โปรแกรมทำงานสำเร็จ แต่ไม่มีข้อมูลแสดงผลออกทางหน้าจอ)';
        updateCodeState(blockId, { running: false, output: out });
      })
      .catch(err => {
        updateCodeState(blockId, {
          running: false,
          output: `❌ เกิดข้อผิดพลาดในการเชื่อมต่อเครื่องเซิร์ฟเวอร์รันโค้ด:\n${err.message}\n\n💡 หมายเหตุ: การเชื่อมต่อผ่าน API ล้มเหลว หรือติดปัญหาเครือข่ายอินเทอร์เน็ต`
        });
      });
    }
  };




  const resetCode = (blockId: string, starterCode: string) => {
    if (!window.confirm('รีเซ็ตโค้ดกลับเป็นตัวอย่างเดิมใช่หรือไม่?')) return;
    updateCodeState(blockId, { code: starterCode, output: '', showOutput: false });
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
        {isQuizStandalone ? (
          <button onClick={() => setShowQuizMode(false)} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
            <ArrowLeft size={16} />
            กลับบทเรียน
          </button>
        ) : (
          <button onClick={onBack} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
            <ArrowLeft size={16} />
            กลับห้องเรียน
          </button>
        )}
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

              {block.type === 'code' && (() => {
                const cs = codeStates[block.id] || { code: block.value, output: '', running: false, showOutput: false };
                const langLabel = block.language?.toUpperCase() || 'CODE';
                const isHtmlOrCss = block.language === 'html' || block.language === 'css';
                const isExpanded = expandedBlockId === block.id;

                const renderBlockContent = (fullWidth = false) => (
                  <div className={`code-editor-block ${fullWidth ? 'expanded-editor-block' : ''}`}>
                    {/* Header */}
                    <div className="code-editor-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Code2 size={18} style={{ color: '#a78bfa' }} />
                        <span className="code-lang-badge">{langLabel}</span>
                        {block.description && (
                          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{block.description}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <button
                          className="btn btn-ghost btn-sm code-reset-btn"
                          onClick={() => resetCode(block.id, block.value)}
                          title="รีเซ็ตโค้ด"
                          style={{ gap: '5px', fontSize: '0.8rem', color: 'var(--text-muted)' }}
                        >
                          <RotateCcw size={13} />
                          รีเซ็ต
                        </button>
                        <button
                          className="btn btn-ghost btn-sm code-reset-btn"
                          onClick={() => setExpandedBlockId(isExpanded ? null : block.id)}
                          title={isExpanded ? 'ย่อหน้าจอ' : 'ขยายหน้าจอ'}
                          style={{ gap: '5px', fontSize: '0.8rem', color: 'var(--text-muted)' }}
                        >
                          {isExpanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                          {isExpanded ? 'ย่อ' : 'ขยาย'}
                        </button>
                      </div>
                    </div>

                    {/* Split View for HTML/CSS */}
                    {isHtmlOrCss ? (
                      <div className="html-live-container" style={{ height: fullWidth ? 'calc(100vh - 46px)' : 'auto' }}>
                        <div className="html-editor-pane">
                          <Editor
                            height={fullWidth ? '100%' : '350px'}
                            language={block.language || 'html'}
                            value={cs.code}
                            theme="vs-dark"
                            onChange={(val) => updateCodeState(block.id, { code: val || '' })}
                            options={{
                              minimap: { enabled: false },
                              fontSize: fullWidth ? 16 : 14,
                              lineNumbers: 'on',
                              scrollBeyondLastLine: false,
                              wordWrap: 'on',
                              padding: { top: 12, bottom: 12 },
                              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                              fontLigatures: true,
                              cursorBlinking: 'smooth',
                              renderLineHighlight: 'line',
                              contextmenu: false,
                            }}
                          />
                        </div>
                        <div className="html-preview-pane" style={{ height: fullWidth ? '100%' : 'auto' }}>
                          <div className="html-preview-header">LIVE PREVIEW</div>
                          <iframe
                            className="html-preview-iframe"
                            title="Live Code Preview"
                            sandbox="allow-scripts allow-same-origin"
                            srcDoc={
                              block.language === 'html' 
                                ? cs.code 
                                : `<!DOCTYPE html><html><head><style>${cs.code}</style></head><body><div style="font-family:sans-serif;padding:20px;color:#333;"><h1>CSS Preview Sandbox</h1><p>แก้ไขโค้ด CSS เพื่อเปลี่ยนหน้าตากล่องข้อความนี้</p><button style="padding:10px 20px;border-radius:6px;border:none;cursor:pointer;">ตัวอย่างปุ่มกด</button></div></body></html>`
                            }
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        {/* Standard code blocks (JS, Python, C++, PHP, etc.) */}
                        <div style={{ position: 'relative', flex: fullWidth ? 1 : 'unset', display: 'flex', flexDirection: 'column' }}>
                          <Editor
                            height={fullWidth ? '450px' : '300px'}
                            language={block.language || 'javascript'}
                            value={cs.code}
                            theme="vs-dark"
                            onChange={(val) => updateCodeState(block.id, { code: val || '' })}
                            options={{
                              minimap: { enabled: false },
                              fontSize: fullWidth ? 16 : 14,
                              lineNumbers: 'on',
                              scrollBeyondLastLine: false,
                              wordWrap: 'on',
                              padding: { top: 12, bottom: 12 },
                              fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
                              fontLigatures: true,
                              cursorBlinking: 'smooth',
                              renderLineHighlight: 'line',
                              contextmenu: false,
                            }}
                          />
                        </div>

                        {/* Toolbar */}
                        <div className="code-editor-toolbar">
                          <button
                            className="btn code-run-btn"
                            disabled={cs.running}
                            onClick={() => runCode(block.id, block.language || 'javascript', block.value)}
                            style={{ gap: '8px' }}
                          >
                            {cs.running ? (
                              <><Loader size={15} className="spin-anim" /> กำลังรัน...</>
                            ) : (
                              <><Play size={15} fill="currentColor" /> รันโค้ด ▶</>
                            )}
                          </button>
                          {cs.showOutput && (
                            <button
                              className="btn btn-ghost btn-sm"
                              onClick={() => updateCodeState(block.id, { showOutput: !cs.showOutput })}
                              style={{ gap: '5px', fontSize: '0.82rem', marginLeft: 'auto', color: 'var(--text-muted)' }}
                            >
                              {cs.showOutput ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                              Output
                            </button>
                          )}
                        </div>

                        {/* Output Panel */}
                        {cs.showOutput && (
                          <div className="code-output-panel" style={{ maxHeight: fullWidth ? '350px' : '300px' }}>
                            <div className="code-output-header">
                              <Terminal size={13} style={{ color: '#34d399' }} />
                              <span>Output</span>
                            </div>
                            <pre className="code-output-content">
                              {cs.output || (
                                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>กำลังรัน...</span>
                              )}
                            </pre>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                );

                return (
                  <>
                    {renderBlockContent(false)}
                    {isExpanded && (
                      <div className="fullscreen-editor-overlay">
                        <div className="fullscreen-editor-modal">
                          {renderBlockContent(true)}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

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
                    <button
                      onClick={() => setShowQuizMode(true)}
                      className="btn btn-primary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', cursor: 'pointer', border: 'none' }}
                    >
                      <ClipboardList size={16} />
                      {showResults ? 'ดูผลคะแนน / ทำแบบทดสอบใหม่' : 'เริ่มทำแบบทดสอบ'}
                    </button>
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

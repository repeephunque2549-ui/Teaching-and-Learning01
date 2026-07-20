import React, { useEffect, useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Editor from '@monaco-editor/react';
import { supabase } from '../supabaseClient';
import type { LearningPage, QuizSubmission } from '../supabaseClient';
import { ArrowLeft, Loader, CheckCircle2, XCircle, Play, FileText, HelpCircle, RefreshCw, ClipboardList, Code2, Terminal, RotateCcw, ChevronDown, ChevronUp, Maximize2, Minimize2, Copy, Check } from 'lucide-react';

interface PageViewProps {
  slug: string;
  userId: string;
  userRole: 'admin' | 'student';
  onBack: () => void;
  theme?: string;
}

export const PageView: React.FC<PageViewProps> = ({ slug, userId, userRole, onBack, theme }) => {
  const [page, setPage] = useState<LearningPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({}); // questionId -> optionIndex
  const [submission, setSubmission] = useState<QuizSubmission | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showQuizMode, setShowQuizMode] = useState(false);
  // Code editor state: per block id -> { code, input, output, running, showOutput }
  const [codeStates, setCodeStates] = useState<Record<string, {
    code: string;
    input: string;
    output: string;
    running: boolean;
    showOutput: boolean;
  }>>({});
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);
  const [expandedImage, setExpandedImage] = useState<string | null>(null);
  const [copiedSnippetId, setCopiedSnippetId] = useState<string | null>(null);
  const [quizAlert, setQuizAlert] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'score' | 'info';
    title?: string;
    message: string;
    score?: number;
    total?: number;
  } | null>(null);
  const runIframeRef = useRef<HTMLIFrameElement | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isQuizStandalone = showQuizMode;

  useEffect(() => {
    fetchPageAndSubmission();
  }, [slug, userId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExpandedBlockId(null);
        setExpandedImage(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Lock body scroll when fullscreen editor is open or image is expanded
  useEffect(() => {
    if (expandedBlockId || expandedImage) {
      document.body.classList.add('fullscreen-editor-open');
    } else {
      document.body.classList.remove('fullscreen-editor-open');
    }
    return () => {
      document.body.classList.remove('fullscreen-editor-open');
    };
  }, [expandedBlockId, expandedImage]);

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
        const initialCodeStates: Record<string, { code: string; input: string; output: string; running: boolean; showOutput: boolean }> = {};
        (pageData.content || []).forEach((block: any) => {
          if (block.type === 'code') {
            initialCodeStates[block.id] = {
              code: block.value || '',
              input: '',
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
  const updateCodeState = useCallback((blockId: string, patch: Partial<{ code: string; input: string; output: string; running: boolean; showOutput: boolean }>) => {
    setCodeStates(prev => ({ ...prev, [blockId]: { ...prev[blockId], ...patch } }));
  }, []);

  const runCode = (blockId: string, language: string, _starterCode: string) => {
    const state = codeStates[blockId];
    if (!state) return;
    const code = state.code;
    const inputVal = state.input || '';
    const inputLines = inputVal.trim() === '' ? [] : inputVal.split('\n');
    const escapedInput = JSON.stringify(inputLines);

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
        
        var _inputs = ${escapedInput};
        var _input_idx = 0;
        window.prompt = function() {
          if (_input_idx < _inputs.length) {
            return _inputs[_input_idx++];
          }
          return null;
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
    } else if (language === 'typescript') {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

      iframe.srcdoc = `<!DOCTYPE html><html><head></head><body><script>
        window.addEventListener('message', async (e) => {
          if (e.data && e.data.type === 'run_ts') {
            try {
              if (typeof ts === 'undefined') {
                await new Promise((resolve, reject) => {
                  const s = document.createElement('script');
                  s.src = "https://cdnjs.cloudflare.com/ajax/libs/typescript/5.0.4/typescript.min.js";
                  s.onload = resolve;
                  s.onerror = reject;
                  document.head.appendChild(s);
                });
              }
              
              const jsCode = window.ts.transpile(e.data.code);
              
              var __logs = [];
              var consoleLog = function() {
                var args = Array.prototype.slice.call(arguments);
                __logs.push(args.map(function(a) {
                  try { return (typeof a === 'object') ? JSON.stringify(a, null, 2) : String(a); }
                  catch(err) { return String(a); }
                }).join(' '));
              };
              var consoleError = function() {
                var args = Array.prototype.slice.call(arguments);
                __logs.push('❌ ' + args.map(String).join(' '));
              };
              
              var _inputs = JSON.parse(e.data.inputsJson || '[]');
              var _input_idx = 0;
              window.prompt = function() {
                if (_input_idx < _inputs.length) {
                  return _inputs[_input_idx++];
                }
                return null;
              };
              
              const runFn = new Function('console', jsCode);
              runFn({ log: consoleLog, error: consoleError });
              
              let finalOut = __logs.join('\\n');
              if (!finalOut) finalOut = '(ไม่มี output — ลองใช้ console.log() เพื่อแสดงผลลัพธ์)';
              parent.postMessage({ type: '__ts_result__', output: finalOut, error: null }, '*');
            } catch (err) {
              parent.postMessage({ type: '__ts_result__', output: null, error: err.toString() }, '*');
            }
          }
        });
        parent.postMessage({ type: '__ts_ready__' }, '*');
      <\/script></body></html>`;

      const handleMessage = (event: MessageEvent) => {
        if (!event.data) return;
        if (event.data.type === '__ts_ready__') {
          iframe.contentWindow?.postMessage({ type: 'run_ts', code: code, inputsJson: escapedInput }, '*');
        } else if (event.data.type === '__ts_result__') {
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

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          window.removeEventListener('message', handleMessage);
          document.body.removeChild(iframe);
          runIframeRef.current = null;
          updateCodeState(blockId, { running: false, output: '⏱️ หมดเวลา: การคอมไพล์ TypeScript ใช้เวลานานเกินไป' });
        }
      }, 15000);
    } else if (language === 'sql') {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');

      iframe.srcdoc = `<!DOCTYPE html><html><head></head><body><script>
        window.addEventListener('message', async (e) => {
          if (e.data && e.data.type === 'run_sql') {
            try {
              if (typeof alasql === 'undefined') {
                await new Promise((resolve, reject) => {
                  const s = document.createElement('script');
                  s.src = "https://cdn.jsdelivr.net/npm/alasql@4";
                  s.onload = resolve;
                  s.onerror = reject;
                  document.head.appendChild(s);
                });
              }
              
              const statements = e.data.code
                .split(';')
                .map(s => s.trim())
                .filter(s => s.length > 0);
              
              let logs = [];
              const dbName = "db_" + Date.now();
              alasql("CREATE DATABASE " + dbName);
              alasql("USE " + dbName);
              
              for (const stmt of statements) {
                const res = alasql(stmt);
                if (stmt.toLowerCase().startsWith('select')) {
                  if (Array.isArray(res) && res.length > 0) {
                    const keys = Object.keys(res[0]);
                    const widths = {};
                    keys.forEach(k => {
                      widths[k] = Math.max(k.length, ...res.map(row => String(row[k] ?? '').length));
                    });
                    
                    const separator = '+' + keys.map(k => '-'.repeat(widths[k] + 2)).join('+') + '+';
                    const header = '|' + keys.map(k => ' ' + k.padEnd(widths[k]) + ' ').join('|') + '|';
                    
                    let tableLines = [separator, header, separator];
                    res.forEach(row => {
                      const line = '|' + keys.map(k => {
                        const val = String(row[k] ?? '');
                        return ' ' + val.padEnd(widths[k]) + ' ';
                      }).join('|') + '|';
                      tableLines.push(line);
                    });
                    tableLines.push(separator);
                    logs.push(tableLines.join('\\n'));
                  } else {
                    logs.push("Empty result set (0 rows)");
                  }
                } else {
                  if (Array.isArray(res)) {
                    logs.push("Query OK, affected rows: " + res.length);
                  } else if (typeof res === 'number') {
                    logs.push("Query OK, affected rows/result: " + res);
                  } else {
                    logs.push("Query OK");
                  }
                }
              }
              
              alasql("DROP DATABASE " + dbName);
              
              let finalOut = logs.join('\\n\\n');
              if (!finalOut) finalOut = 'Query OK (no results)';
              parent.postMessage({ type: '__sql_result__', output: finalOut, error: null }, '*');
            } catch (err) {
              parent.postMessage({ type: '__sql_result__', output: null, error: err.toString() }, '*');
            }
          }
        });
        parent.postMessage({ type: '__sql_ready__' }, '*');
      <\/script></body></html>`;

      const handleMessage = (event: MessageEvent) => {
        if (!event.data) return;
        if (event.data.type === '__sql_ready__') {
          iframe.contentWindow?.postMessage({ type: 'run_sql', code: code }, '*');
        } else if (event.data.type === '__sql_result__') {
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

      setTimeout(() => {
        if (document.body.contains(iframe)) {
          window.removeEventListener('message', handleMessage);
          document.body.removeChild(iframe);
          runIframeRef.current = null;
          updateCodeState(blockId, { running: false, output: '⏱️ หมดเวลา: การโหลดเซิร์ฟเวอร์ SQL ใช้เวลานานเกินไป' });
        }
      }, 15000);
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
        '      var inputsJson = e.data.inputsJson;',
        '      var injectCode = [',
        '        "import sys",',
        '        "import io",',
        '        "import builtins",',
        '        "_inputs = " + inputsJson,',
        '        "_input_idx = 0",',
        '        "def custom_input(prompt=\'\'):",',
        '        "    global _input_idx",',
        '        "    if _input_idx < len(_inputs):",',
        '        "        val = _inputs[_input_idx]",',
        '        "        _input_idx += 1",',
        '        "        return val",',
        '        "    raise EOFError(\'EOF when reading a line\')",',
        '        "builtins.input = custom_input"',
        '      ].join("\\n");',
        '      await pyodide.runPythonAsync(injectCode);',
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
          iframe.contentWindow?.postMessage({ type: 'run_python', code: code, inputsJson: JSON.stringify(inputVal.split('\n')) }, '*');
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
    } else if (language === 'cpp' || language === 'c') {
      // Run C/C++ via Coliru
      const escapedInput = inputVal.replace(/'/g, "'\\''");
      const inputCmd = `cat <<'EOF_INPUT' > input.txt\n${escapedInput}\nEOF_INPUT\n`;
      let command = inputCmd + 'g++ -O3 main.cpp && ./a.out < input.txt';
      if (language === 'c') {
        command = inputCmd + 'gcc -O3 main.cpp && ./a.out < input.txt';
      }

      const proxyUrl = '/api/compile/coliru';

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
    } else if (language === 'java' || language === 'go') {
      // Run Java and Go via Wandbox since Coliru environment doesn't have javac or go binaries
      let wandboxCompiler = 'openjdk-jdk-21+35';
      let processedCode = code;
      if (language === 'java') {
        // Strip public modifier to prevent prog.java filename mismatch error
        processedCode = code.replace(/\bpublic\s+class\b/g, 'class');
      } else if (language === 'go') {
        wandboxCompiler = 'go-1.23.2';
      }

      const proxyUrl = '/api/compile/wandbox';

      fetch(proxyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          compiler: wandboxCompiler,
          code: processedCode,
          stdin: inputVal
        })
      })
      .then(res => {
        if (!res.ok) {
          throw new Error(`HTTP Error ${res.status}`);
        }
        return res.json();
      })
      .then(result => {
        let out = '';
        if (result.compiler_error || result.compiler_message) {
          out += '❌ Error/Warning ตอนคอมไพล์:\n' + (result.compiler_error || result.compiler_message) + '\n';
        }
        if (result.program_output || result.program_message || result.program_error) {
          out += result.program_output || result.program_message || result.program_error;
        }
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



  const resetCode = useCallback((blockId: string, starterCode: string) => {
    if (!window.confirm('รีเซ็ตโค้ดกลับเป็นตัวอย่างเดิมใช่หรือไม่?')) return;
    updateCodeState(blockId, { code: starterCode, output: '', showOutput: false });
  }, [updateCodeState]);
  // --- Copy code snippet to clipboard ---
  const handleCopySnippet = useCallback((snippetId: string, code: string) => {
    navigator.clipboard.writeText(code).then(() => {
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      setCopiedSnippetId(snippetId);
      copiedTimeoutRef.current = setTimeout(() => setCopiedSnippetId(null), 2000);
    }).catch(() => {
      // Fallback for older browsers
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      setCopiedSnippetId(snippetId);
      copiedTimeoutRef.current = setTimeout(() => setCopiedSnippetId(null), 2000);
    });
  }, []);

  // --- Render text content with inline code snippets ---
  // Supports ```language\ncode\n``` and single `code` syntax
  const renderTextWithCodeSnippets = (text: string, blockId: string) => {
    // Split on triple-backtick code fences: ```lang\ncode\n```
    const fenceRegex = /```(\w*)\n([\s\S]*?)```/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let matchIndex = 0;

    let match;
    while ((match = fenceRegex.exec(text)) !== null) {
      // Add text before this code fence
      if (match.index > lastIndex) {
        const textBefore = text.slice(lastIndex, match.index);
        parts.push(
          <span key={`text-${blockId}-${matchIndex}-before`}>
            {renderInlineCode(textBefore)}
          </span>
        );
      }

      const language = match[1] || 'code';
      const code = match[2].replace(/\n$/, ''); // trim trailing newline
      const snippetId = `${blockId}-snippet-${matchIndex}`;
      const isCopied = copiedSnippetId === snippetId;

      parts.push(
        <div key={snippetId} className="inline-code-snippet">
          <div className="code-snippet-header">
            <span className="code-snippet-lang">{language}</span>
            <button
              className={`code-snippet-copy-btn ${isCopied ? 'copied' : ''}`}
              onClick={() => handleCopySnippet(snippetId, code)}
              title="คัดลอกโค้ด"
            >
              {isCopied ? (
                <><Check size={13} /> คัดลอกแล้ว</>
              ) : (
                <><Copy size={13} /> คัดลอก</>
              )}
            </button>
          </div>
          <div className="code-snippet-body">
            <pre>{code}</pre>
          </div>
        </div>
      );

      lastIndex = match.index + match[0].length;
      matchIndex++;
    }

    // Add remaining text after last code fence
    if (lastIndex < text.length) {
      parts.push(
        <span key={`text-${blockId}-tail`}>
          {renderInlineCode(text.slice(lastIndex))}
        </span>
      );
    }

    // If no code fences found, render with inline code support
    if (parts.length === 0) {
      return <>{renderInlineCode(text)}</>;
    }

    return <>{parts}</>;
  };

  // Render markdown-style links [text](url) and inline code `code`
  const renderInlineCode = (text: string): React.ReactNode[] => {
    // Combined regex: match links [text](url) or inline code `code`
    const combinedRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|`([^`]+)`/g;
    const nodes: React.ReactNode[] = [];
    let last = 0;
    let m;
    let i = 0;

    while ((m = combinedRegex.exec(text)) !== null) {
      // Add plain text before this match
      if (m.index > last) {
        nodes.push(text.slice(last, m.index));
      }

      if (m[1] !== undefined && m[2] !== undefined) {
        // This is a link match: [text](url)
        nodes.push(
          <a
            key={`link-${i}`}
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-block-link"
          >
            {m[1]}
          </a>
        );
      } else if (m[3] !== undefined) {
        // This is an inline code match: `code`
        nodes.push(
          <code key={`inline-${i}`} className="inline-code">{m[3]}</code>
        );
      }

      last = m.index + m[0].length;
      i++;
    }

    if (last < text.length) {
      nodes.push(text.slice(last));
    }

    return nodes;
  };


  // Extract YouTube ID from various URL formats
  const getYouTubeEmbedUrl = (url: string) => {
    if (!url) return '';
    
    // Regular expression to match YouTube video ID
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    
    const videoId = (match && match[2].length === 11) ? match[2] : url;
    return `https://www.youtube-nocookie.com/embed/${videoId}`;
  };

  // Option selection
  const handleSelectOption = useCallback((questionId: string, optionIndex: number) => {
    if (showResults) return; // Prevent changing answers after submission
    setUserAnswers(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
  }, [showResults]);

  // Submit quiz answers
  const handleSubmitQuiz = async (_quizBlockId: string, questions: any[]) => {
    // Verify all questions have been answered
    const unanswered = questions.filter(q => userAnswers[q.id] === undefined);
    if (unanswered.length > 0) {
      return setQuizAlert({
        show: true, type: 'error', title: 'แจ้งเตือน', message: 'กรุณาตอบคำถามให้ครบทุกข้อก่อนส่งคำตอบครับ'
      });
    }

    if (userRole === 'admin') {
      return setQuizAlert({
        show: true, type: 'info', title: 'สำหรับผู้ดูแลระบบ', message: 'สำหรับผู้ดูแลระบบ (Admin) หน้าทดสอบนี้เป็นการพรีวิวเท่านั้น ไม่สามารถบันทึกคะแนนลงระบบได้'
      });
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
      setQuizAlert({
        show: true, type: 'score', title: 'ส่งคำตอบสำเร็จ!', message: 'บันทึกคะแนนของคุณลงในระบบเรียบร้อยแล้ว', score: calculatedScore, total: questions.length
      });
    } catch (err: any) {
      setQuizAlert({
        show: true, type: 'error', title: 'เกิดข้อผิดพลาด', message: 'เกิดข้อผิดพลาดในการส่งคำตอบ: ' + err.message
      });
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
      setQuizAlert({
        show: true, type: 'success', title: 'รีเซ็ตสำเร็จ', message: 'ลบคะแนนเดิมเรียบร้อยแล้ว คุณสามารถทำแบบทดสอบใหม่ได้ทันที'
      });
    } catch (err: any) {
      setQuizAlert({
        show: true, type: 'error', title: 'เกิดข้อผิดพลาด', message: 'เกิดข้อผิดพลาดในการลบคำตอบเดิม: ' + err.message
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="loading-spinner-glow">
          <Loader className="spin-anim" size={40} style={{ color: 'var(--color-brand)', position: 'relative', zIndex: 1 }} />
        </div>
        <div className="loading-text">กำลังโหลดเนื้อหาบทเรียน...</div>
        <div className="loading-subtext">ระบบกำลังเตรียมสื่อและคำสั่งจำลองสำหรับคุณ</div>
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
    
      {/* ชื่อบทเรียนด้านในบทเรียน */}
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

      {/* Cover Image */}
      {page.cover_image_url && !isQuizStandalone && (
        <div style={{
          marginBottom: '32px',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          maxHeight: '400px'
        }}>
          <img
            src={page.cover_image_url}
            alt={page.title}
            loading="lazy"
            decoding="async"
            style={{
              width: '100%',
              height: '100%',
              maxHeight: '400px',
              objectFit: 'cover',
              display: 'block'
            }}
          />
        </div>
      )}


      {/* Render Blocks */}
      <div>
        {page.content && page.content.map((block) => {
          if (isQuizStandalone && block.type !== 'quiz') return null;
          return (
            <div key={block.id} style={{ marginBottom: '32px' }}>
              {block.type === 'text' && (
                <div className="card-glass text-block-content">
                  {renderTextWithCodeSnippets(block.value, block.id)}
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
                      <div className="html-live-container" style={{ height: fullWidth ? '100%' : 'auto' }}>
                        <div className="html-editor-pane">
                          <Editor
                            height={fullWidth ? '100%' : '350px'}
                            language={block.language || 'html'}
                            value={cs.code}
                            theme={theme === 'light' ? 'light' : 'vs-dark'}
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
                              automaticLayout: true
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
                        <div style={{ flex: fullWidth ? 1 : 'none', height: fullWidth ? '100%' : '300px', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                          <Editor
                            height="100%"
                            language={block.language || 'javascript'}
                            value={cs.code}
                            theme={theme === 'light' ? 'light' : 'vs-dark'}
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
                              automaticLayout: true
                            }}
                          />
                        </div>

                        {/* Input Panel (For stdin/prompt) */}
                        {!isHtmlOrCss && block.language !== 'sql' && (
                          <div className="code-input-panel" style={{ flexShrink: 0, padding: '12px', background: 'rgba(255,255,255,0.01)', borderTop: '1px solid var(--border-glass)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                              <Terminal size={12} style={{ color: '#a78bfa' }} />
                              <span>Standard Input / prompt (ป้อนค่าสำหรับโปรแกรม - ขึ้นบรรทัดใหม่เมื่อต้องการป้อนหลายค่า)</span>
                            </div>
                            <textarea
                              rows={2}
                              value={cs.input || ''}
                              onChange={(e) => updateCodeState(block.id, { input: e.target.value })}
                              placeholder="เช่น:&#10;สมชาย&#10;25"
                              style={{
                                width: '100%',
                                background: 'rgba(0, 0, 0, 0.2)',
                                border: '1px solid var(--border-glass)',
                                borderRadius: 'var(--radius-sm)',
                                color: 'var(--text-primary)',
                                padding: '8px 12px',
                                fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                                fontSize: '0.85rem',
                                resize: 'vertical'
                              }}
                            />
                          </div>
                        )}

                        {/* Toolbar */}
                        <div className="code-editor-toolbar" style={{ flexShrink: 0 }}>
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
                          <div className="code-output-panel" style={{ flexShrink: 0, maxHeight: fullWidth ? '350px' : '300px', display: 'flex', flexDirection: 'column' }}>
                            <div className="code-output-header" style={{ flexShrink: 0 }}>
                              <Terminal size={13} style={{ color: '#34d399' }} />
                              <span>Output</span>
                            </div>
                            <pre className="code-output-content" style={{ flex: 1, minHeight: 0 }}>
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
                    {!isExpanded && renderBlockContent(false)}
                    {isExpanded && createPortal(
                      <div className="fullscreen-editor-portal" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
                        <div className="fullscreen-editor-overlay" onClick={() => setExpandedBlockId(null)} />
                        {renderBlockContent(true)}
                      </div>,
                      document.body
                    )}
                  </>
                );
              })()}

              {block.type === 'youtube' && (
                <div className="card-glass" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Play size={16} style={{ color: '#ef4444' }} />
                    {block.title || 'วิดีโอแนะนำบทเรียน'}
                  </h3>
                  <div className="video-wrapper">
                    <iframe
                      src={getYouTubeEmbedUrl(block.value)}
                      title="YouTube video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    ></iframe>
                  </div>
                </div>
              )}

              {block.type === 'pdf' && (
                <div className="card-glass" style={{ padding: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={16} style={{ color: '#fbbf24' }} />
                    {block.title || 'เอกสารประกอบการสอน (PDF)'}
                  </h3>
                  {block.value ? (
                    <div>
                      <iframe
                        src={`${block.value}#toolbar=0`}
                        className="pdf-viewer"
                        title="PDF document viewer"
                      ></iframe>
                      
                      <div className="pdf-mobile-download" style={{
                        padding: '24px 16px',
                        textAlign: 'center',
                        background: 'rgba(255,255,255,0.02)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-glass)',
                        marginBottom: '8px'
                      }}>
                        <FileText size={44} style={{ color: '#fbbf24', margin: '0 auto 12px' }} />
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: '1.5' }}>
                          เอกสารประกอบการเรียนถูกซ่อนไว้บนหน้าจอมือถือเพื่อความสะดวกในการเรียนรู้
                        </p>
                        <a href={block.value} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ width: '100%', padding: '10px' }}>
                          ดาวน์โหลด / เปิดอ่านไฟล์ PDF
                        </a>
                      </div>

                      <div className="pdf-desktop-link" style={{ textAlign: 'right', marginTop: '8px' }}>
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

              {block.type === 'image' && (
                <div className="card-glass" style={{ padding: '20px' }}>
                  {block.value ? (
                    <div style={{ textAlign: 'center' }}>
                      <img
                        src={block.value}
                        alt={block.caption || 'รูปภาพประกอบบทเรียน'}
                        onClick={() => setExpandedImage(block.value)}
                        style={{
                          maxWidth: '100%',
                          borderRadius: '12px',
                          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                          display: 'block',
                          margin: '0 auto',
                          cursor: 'zoom-in',
                          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                        }}
                        className="interactive-image"
                      />
                      {block.caption && (
                        <p style={{
                          marginTop: '12px',
                          fontSize: '0.9rem',
                          color: 'var(--text-secondary)',
                          fontStyle: 'italic'
                        }}>
                          {block.caption}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                      (ยังไม่ได้ระบุรูปภาพ)
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
                      <div style={{ marginBottom: '32px' }}>
                        <div style={{
                          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
                          border: '1px solid rgba(16, 185, 129, 0.3)',
                          padding: '32px',
                          borderRadius: '16px',
                          marginBottom: '16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          boxShadow: '0 8px 32px rgba(16, 185, 129, 0.1)',
                          backdropFilter: 'blur(10px)',
                          flexWrap: 'wrap',
                          gap: '20px'
                        }}>
                          <div>
                            <h4 style={{ color: 'var(--color-success)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.4rem', margin: '0 0 8px 0' }}>
                              <CheckCircle2 size={24} /> สรุปผลการทดสอบ
                            </h4>
                            <p style={{ color: 'var(--text-primary)', fontSize: '1.05rem', margin: '0 0 4px 0' }}>
                              ทำแบบทดสอบเสร็จสิ้น
                            </p>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>ส่งเมื่อ {new Date(submission?.created_at || '').toLocaleString('th-TH')}</span>
                          </div>
                          <div style={{ 
                            textAlign: 'center', 
                            background: 'rgba(16, 185, 129, 0.1)', 
                            borderRadius: '50%', 
                            width: '100px', 
                            height: '100px', 
                            display: 'flex', 
                            flexDirection: 'column', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            border: '4px solid rgba(16, 185, 129, 0.4)',
                            boxShadow: '0 0 20px rgba(16, 185, 129, 0.2) inset, 0 0 20px rgba(16, 185, 129, 0.2)'
                          }}>
                            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--color-success)', lineHeight: '1' }}>
                              {submission?.score}
                            </span>
                            <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--color-success)', fontWeight: 600, borderTop: '1px solid rgba(16, 185, 129, 0.2)', paddingTop: '4px', marginTop: '4px', width: '60%' }}>
                              เต็ม {submission?.total_questions}
                            </span>
                          </div>
                        </div>
                        {userRole !== 'admin' && submission && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={handleRetakeQuiz}
                              disabled={submitting}
                              style={{ gap: '8px', padding: '10px 20px', borderRadius: '12px' }}
                            >
                              <RefreshCw size={16} className={submitting ? 'spin-anim' : ''} />
                              ทำแบบทดสอบใหม่อีกครั้ง
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
                  <div className="quiz-card" style={{ 
                    boxShadow: 'var(--shadow-glow)', 
                    textAlign: 'center', 
                    padding: '36px 20px', 
                    borderRadius: '16px', 
                    background: showResults ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.05) 0%, rgba(16, 185, 129, 0.02) 100%)' : 'var(--bg-secondary)', 
                    border: showResults ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid var(--border-glass)' 
                  }}>
                    <h3 style={{ fontSize: '1.4rem', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: showResults ? 'var(--color-success)' : 'var(--text-heading)' }}>
                      {showResults ? <CheckCircle2 size={24} /> : <HelpCircle size={24} style={{ color: 'var(--color-brand)' }} />}
                      แบบทดสอบท้ายบทเรียน
                    </h3>
                    <p style={{ color: showResults ? 'var(--text-primary)' : 'var(--text-secondary)', marginBottom: '24px', fontSize: '1.05rem', lineHeight: '1.6' }}>
                      {showResults 
                        ? <span>คุณทำแบบทดสอบเสร็จสิ้นแล้ว ได้คะแนน <strong style={{ color: 'var(--color-success)', fontSize: '1.2rem', margin: '0 4px' }}>{submission?.score} / {submission?.total_questions}</strong> คะแนน</span>
                        : 'แบบทดสอบสำหรับประเมินความเข้าใจของคุณหลังจากเรียนรู้เนื้อหาเรียบร้อยแล้ว'}
                    </p>
                    <button
                      onClick={() => setShowQuizMode(true)}
                      className={showResults ? "btn btn-secondary" : "btn btn-primary"}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', cursor: 'pointer', borderRadius: '12px' }}
                    >
                      <ClipboardList size={18} />
                      {showResults ? 'ดูรายละเอียด / ทำใหม่' : 'เริ่มทำแบบทดสอบ'}
                    </button>
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>
      {expandedImage && createPortal(
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.85)',
            backdropFilter: 'blur(5px)',
            zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', cursor: 'zoom-out'
          }}
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="Expanded image"
            style={{
              maxWidth: '90vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
            }}
          />
        </div>,
        document.body
      )}
      {quizAlert && quizAlert.show && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px', animation: 'fadeIn 0.2s ease-out'
        }}>
          <div className="card-glass" style={{
            maxWidth: '450px', width: '100%', padding: '32px', textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.4)', borderRadius: '20px',
            transform: 'scale(1)', animation: 'scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}>
            {quizAlert.type === 'score' && (
              <div style={{ marginBottom: '24px' }}>
                <div style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 100%)',
                  borderRadius: '50%', width: '120px', height: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  border: '6px solid rgba(16, 185, 129, 0.4)', margin: '0 auto 20px auto',
                  boxShadow: '0 0 30px rgba(16, 185, 129, 0.3)'
                }}>
                  <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-success)', lineHeight: '1' }}>
                    {quizAlert.score}
                  </span>
                  <span style={{ display: 'block', fontSize: '1rem', color: 'var(--color-success)', fontWeight: 600, borderTop: '2px solid rgba(16, 185, 129, 0.3)', paddingTop: '4px', marginTop: '4px', width: '70%' }}>
                    เต็ม {quizAlert.total}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.5rem', color: 'var(--text-heading)', marginBottom: '8px' }}>{quizAlert.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>{quizAlert.message}</p>
              </div>
            )}
            {quizAlert.type === 'error' && (
              <div style={{ marginBottom: '24px' }}>
                <XCircle size={64} style={{ color: 'var(--color-error)', margin: '0 auto 16px auto' }} />
                <h3 style={{ fontSize: '1.5rem', color: 'var(--color-error)', marginBottom: '8px' }}>{quizAlert.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>{quizAlert.message}</p>
              </div>
            )}
            {quizAlert.type === 'success' && (
              <div style={{ marginBottom: '24px' }}>
                <CheckCircle2 size={64} style={{ color: 'var(--color-success)', margin: '0 auto 16px auto' }} />
                <h3 style={{ fontSize: '1.5rem', color: 'var(--color-success)', marginBottom: '8px' }}>{quizAlert.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>{quizAlert.message}</p>
              </div>
            )}
            {quizAlert.type === 'info' && (
              <div style={{ marginBottom: '24px' }}>
                <HelpCircle size={64} style={{ color: 'var(--color-brand)', margin: '0 auto 16px auto' }} />
                <h3 style={{ fontSize: '1.5rem', color: 'var(--text-heading)', marginBottom: '8px' }}>{quizAlert.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>{quizAlert.message}</p>
              </div>
            )}
            <button
              className="btn btn-primary"
              style={{ width: '100%', padding: '12px', fontSize: '1.1rem', borderRadius: '12px' }}
              onClick={() => setQuizAlert(null)}
            >
              ตกลง
            </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

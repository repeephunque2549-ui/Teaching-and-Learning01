import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { supabase } from '../supabaseClient';
import type { ContentBlock, QuizQuestion } from '../supabaseClient';
import { ArrowLeft, Plus, Trash2, ArrowUp, ArrowDown, Type, Play, FileText, CheckSquare, Save, Upload, Loader, Code2, Copy, ImageIcon } from 'lucide-react';

const CODE_LANGUAGES = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'php', label: 'PHP' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'c', label: 'C' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'go', label: 'Go' },
];

interface PageEditorProps {
  pageId: string | null; // null means create new page
  onClose: () => void;
  theme?: string;
}

export const PageEditor: React.FC<PageEditorProps> = ({ pageId, onClose, theme }) => {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [estimatedDuration, setEstimatedDuration] = useState('10-15 นาที');
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPdfId, setUploadingPdfId] = useState<string | null>(null);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Insert code template at cursor position in a text block's textarea
  const insertCodeTemplate = (blockId: string) => {
    const textarea = textareaRefs.current[blockId];
    const block = blocks.find(b => b.id === blockId);
    if (!block || block.type !== 'text') return;

    const currentValue = block.value;
    const template = '```javascript\n// เขียนโค้ดตรงนี้\nconsole.log("Hello!");\n```';

    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = currentValue.slice(0, start);
      const after = currentValue.slice(end);
      // Add newlines around template if not at boundaries
      const prefix = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
      const suffix = after.length > 0 && !after.startsWith('\n') ? '\n' : '';
      const newValue = before + prefix + template + suffix + after;
      updateBlockValue(blockId, newValue);
      // Restore focus and cursor after insert
      setTimeout(() => {
        textarea.focus();
        const cursorPos = (before + prefix + template).length;
        textarea.setSelectionRange(cursorPos, cursorPos);
      }, 0);
    } else {
      // Fallback: append at end
      const newValue = currentValue + (currentValue.endsWith('\n') || currentValue === '' ? '' : '\n') + template + '\n';
      updateBlockValue(blockId, newValue);
    }
  };

  useEffect(() => {
    if (pageId) {
      fetchPage();
    }
  }, [pageId]);

  const fetchPage = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('learning_pages')
        .select('*')
        .eq('id', pageId)
        .single();
      
      if (error) throw error;
      if (data) {
        setTitle(data.title);
        setSlug(data.slug);
        setBlocks(data.content || []);
        setEstimatedDuration(data.estimated_duration || '10-15 นาที');
        setCoverImageUrl(data.cover_image_url || '');
      }
    } catch (err: any) {
      alert('ไม่สามารถดึงข้อมูลหน้าบทเรียนได้: ' + err.message);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  // Helper to slugify title
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setTitle(val);
    if (!pageId) {
      // Auto-generate slug from title (support Thai characters, replaces spaces with hyphens)
      const generatedSlug = val
        .trim()
        .toLowerCase()
        .replace(/[^a-zA-Z0-9ก-๙\s-]/g, '')
        .replace(/\s+/g, '-');
      setSlug(generatedSlug);
    }
  };

  // Add block helpers
  const addTextBlock = () => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type: 'text',
      value: ''
    };
    setBlocks([...blocks, newBlock]);
  };

  const addYoutubeBlock = () => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type: 'youtube',
      value: ''
    };
    setBlocks([...blocks, newBlock]);
  };

  const addPdfBlock = () => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type: 'pdf',
      value: '',
      file_name: ''
    };
    setBlocks([...blocks, newBlock]);
  };

  const addQuizBlock = () => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type: 'quiz',
      questions: [
        {
          id: crypto.randomUUID(),
          questionText: 'คำถามข้อแรกคืออะไร?',
          options: ['ตัวเลือกที่ 1', 'ตัวเลือกที่ 2', 'ตัวเลือกที่ 3', 'ตัวเลือกที่ 4'],
          correctOptionIndex: 0
        }
      ]
    };
    setBlocks([...blocks, newBlock]);
  };

  const addCodeBlock = () => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type: 'code',
      language: 'javascript',
      value: '// เขียนโค้ดตัวอย่างที่นี่\nconsole.log("Hello, World!");',
      description: 'ลองเขียนโค้ดและแก้ไขตัวอย่างด้านล่างนี้'
    };
    setBlocks([...blocks, newBlock]);
  };

  const addImageBlock = () => {
    const newBlock: ContentBlock = {
      id: crypto.randomUUID(),
      type: 'image',
      value: '',
      caption: ''
    };
    setBlocks([...blocks, newBlock]);
  };

  const updateImageBlockCaption = (id: string, caption: string) => {
    setBlocks(blocks.map(b =>
      b.id === id && b.type === 'image'
        ? { ...b, caption } as ContentBlock
        : b
    ));
  };

  const updateCodeBlockField = (id: string, field: 'language' | 'value' | 'description', val: string) => {
    setBlocks(blocks.map(b =>
      b.id === id && b.type === 'code'
        ? { ...b, [field]: val } as ContentBlock
        : b
    ));
  };

  const updateYoutubeBlockTitle = (id: string, title: string) => {
    setBlocks(blocks.map(b =>
      b.id === id && b.type === 'youtube'
        ? { ...b, title } as ContentBlock
        : b
    ));
  };

  const updatePdfBlockTitle = (id: string, title: string) => {
    setBlocks(blocks.map(b =>
      b.id === id && b.type === 'pdf'
        ? { ...b, title } as ContentBlock
        : b
    ));
  };

  // Block modification
  const updateBlockValue = (id: string, value: string) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, value } as ContentBlock : b));
  };

  const deleteBlock = (id: string) => {
    setBlocks(blocks.filter(b => b.id !== id));
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;
    
    const newBlocks = [...blocks];
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[nextIndex];
    newBlocks[nextIndex] = temp;
    setBlocks(newBlocks);
  };

  // Quiz-specific modifiers
  const addQuestionToQuiz = (blockId: string) => {
    setBlocks(blocks.map(b => {
      if (b.id === blockId && b.type === 'quiz') {
        const newQuestion: QuizQuestion = {
          id: crypto.randomUUID(),
          questionText: 'กรอกคำถามใหม่ที่นี่',
          options: ['ตัวเลือกที่ 1', 'ตัวเลือกที่ 2'],
          correctOptionIndex: 0
        };
        return { ...b, questions: [...b.questions, newQuestion] };
      }
      return b;
    }));
  };

  const deleteQuestionFromQuiz = (blockId: string, questionId: string) => {
    setBlocks(blocks.map(b => {
      if (b.id === blockId && b.type === 'quiz') {
        return { ...b, questions: b.questions.filter(q => q.id !== questionId) };
      }
      return b;
    }));
  };

  const updateQuestionText = (blockId: string, questionId: string, text: string) => {
    setBlocks(blocks.map(b => {
      if (b.id === blockId && b.type === 'quiz') {
        return {
          ...b,
          questions: b.questions.map(q => q.id === questionId ? { ...q, questionText: text } : q)
        };
      }
      return b;
    }));
  };

  const addOptionToQuestion = (blockId: string, questionId: string) => {
    setBlocks(blocks.map(b => {
      if (b.id === blockId && b.type === 'quiz') {
        return {
          ...b,
          questions: b.questions.map(q => {
            if (q.id === questionId) {
              return { ...q, options: [...q.options, `ตัวเลือกที่ ${q.options.length + 1}`] };
            }
            return q;
          })
        };
      }
      return b;
    }));
  };

  const deleteOptionFromQuestion = (blockId: string, questionId: string, optionIndex: number) => {
    setBlocks(blocks.map(b => {
      if (b.id === blockId && b.type === 'quiz') {
        return {
          ...b,
          questions: b.questions.map(q => {
            if (q.id === questionId) {
              const newOptions = q.options.filter((_, idx) => idx !== optionIndex);
              // Ensure correct index is still valid
              let correctIdx = q.correctOptionIndex;
              if (correctIdx >= newOptions.length) {
                correctIdx = Math.max(0, newOptions.length - 1);
              }
              return { ...q, options: newOptions, correctOptionIndex: correctIdx };
            }
            return q;
          })
        };
      }
      return b;
    }));
  };

  const updateOptionText = (blockId: string, questionId: string, optionIndex: number, text: string) => {
    setBlocks(blocks.map(b => {
      if (b.id === blockId && b.type === 'quiz') {
        return {
          ...b,
          questions: b.questions.map(q => {
            if (q.id === questionId) {
              const newOptions = [...q.options];
              newOptions[optionIndex] = text;
              return { ...q, options: newOptions };
            }
            return q;
          })
        };
      }
      return b;
    }));
  };

  const updateCorrectOptionIndex = (blockId: string, questionId: string, optionIndex: number) => {
    setBlocks(blocks.map(b => {
      if (b.id === blockId && b.type === 'quiz') {
        return {
          ...b,
          questions: b.questions.map(q => q.id === questionId ? { ...q, correctOptionIndex: optionIndex } : q)
        };
      }
      return b;
    }));
  };

  // PDF File Upload to Supabase Storage
  const handlePdfUpload = async (blockId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPdfId(blockId);
    try {
      // 1. Create unique path
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `pdfs/${fileName}`;

      // 2. Upload to public 'pdfs' bucket
      const { error: uploadError } = await supabase.storage
        .from('pdfs')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });

      if (uploadError) {
        // Explain bucket creation requirement if it fails
        throw new Error('ไม่สามารถอัปโหลดไฟล์ได้ กรุณาตรวจสอบว่าคุณได้สร้าง Storage Bucket ชื่อ "pdfs" ใน Supabase แล้วและกำหนดสิทธิ์ให้เรียบร้อย หรือใช้วิธีวาง URL ลิงก์ PDF ด้านล่างแทนได้ครับ (' + uploadError.message + ')');
      }

      // 3. Get Public URL
      const { data: { publicUrl } } = supabase.storage.from('pdfs').getPublicUrl(filePath);

      // 4. Update block
      setBlocks(blocks.map(b => {
        if (b.id === blockId && b.type === 'pdf') {
          return { ...b, value: publicUrl, file_name: file.name };
        }
        return b;
      }));
      
      alert('อัปโหลด PDF สำเร็จ!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingPdfId(null);
    }
  };

// Session cache to speed up subsequent uploads by avoiding double-requests when "images" bucket doesn't exist
let usePdfsFallbackGlobal = false;

  // Image Upload to Supabase Storage (for cover image or image blocks)
  const handleImageUploadToStorage = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `images/${fileName}`;

    let bucketName = usePdfsFallbackGlobal ? 'pdfs' : 'images';
    let uploadError = null;

    if (bucketName === 'images') {
      const result = await supabase.storage
        .from('images')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });
      uploadError = result.error;

      // Fallback to pdfs bucket if images bucket is not found
      if (uploadError && (
        uploadError.message?.toLowerCase().includes('bucket not found') || 
        (uploadError as any).error === 'bucket_not_found' ||
        (uploadError as any).statusCode === '404'
      )) {
        usePdfsFallbackGlobal = true; // Cache the fallback flag for this session
        bucketName = 'pdfs';
        const fallbackResult = await supabase.storage
          .from(bucketName)
          .upload(filePath, file, { cacheControl: '3600', upsert: true });
        uploadError = fallbackResult.error;
      }
    } else {
      // Directly upload to fallback bucket 'pdfs'
      const result = await supabase.storage
        .from('pdfs')
        .upload(filePath, file, { cacheControl: '3600', upsert: true });
      uploadError = result.error;
    }

    if (uploadError) {
      throw new Error('ไม่สามารถอัปโหลดรูปภาพได้ กรุณาตรวจสอบว่าคุณได้สร้าง Storage Bucket ชื่อ "images" หรือ "pdfs" ใน Supabase แล้วและกำหนดสิทธิ์แบบ Public ให้เรียบร้อย (' + uploadError.message + ')');
    }

    const { data: { publicUrl } } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return publicUrl;
  };

  // Cover Image Upload
  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingCover(true);
    try {
      const publicUrl = await handleImageUploadToStorage(file);
      setCoverImageUrl(publicUrl);
      alert('อัปโหลดรูปภาพหน้าปกสำเร็จ!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingCover(false);
    }
  };

  // Image Block Upload
  const handleImageBlockUpload = async (blockId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImageId(blockId);
    try {
      const publicUrl = await handleImageUploadToStorage(file);
      updateBlockValue(blockId, publicUrl);
      alert('อัปโหลดรูปภาพสำเร็จ!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUploadingImageId(null);
    }
  };

  // Save changes to Supabase
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return alert('กรุณากรอกหัวข้อหน้าบทเรียน');
    if (!slug.trim()) return alert('กรุณากรอกลิงก์ (Slug)');

    setSaving(true);
    try {
      const pageData = {
        title,
        slug: slug.trim().toLowerCase(),
        content: blocks,
        estimated_duration: estimatedDuration || '10-15 นาที',
        cover_image_url: coverImageUrl || null,
        updated_at: new Date().toISOString()
      };

      let error;
      if (pageId) {
        // Update
        const { error: err } = await supabase
          .from('learning_pages')
          .update(pageData)
          .eq('id', pageId);
        error = err;
      } else {
        // Insert
        const { error: err } = await supabase
          .from('learning_pages')
          .insert([pageData]);
        error = err;
      }

      if (error) throw error;
      alert('บันทึกข้อมูลหน้าเรียนสำเร็จแล้ว!');
      onClose();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาดในการบันทึก: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-wrapper">
        <div className="loading-spinner-glow">
          <Loader className="spin-anim" size={40} style={{ color: 'var(--color-brand)', position: 'relative', zIndex: 1 }} />
        </div>
        <div className="loading-text">กำลังโหลดข้อมูลหน้าเรียน...</div>
        <div className="loading-subtext">ระบบกำลังดึงข้อมูลโครงสร้างบล็อกเรียนล่าสุด</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <button onClick={onClose} className="btn btn-secondary btn-sm" style={{ gap: '6px' }}>
          <ArrowLeft size={16} />
          กลับไปยังแดชบอร์ด
        </button>
      </div>

      <div className="card-glass" style={{ marginBottom: '30px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '20px' }}>
          {pageId ? 'แก้ไขหน้าบทเรียน' : 'สร้างหน้าบทเรียนใหม่'}
        </h2>
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-3">
            <div className="form-group">
              <label className="form-label">หัวข้อบทเรียน (Title) *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="เช่น แนะนำการเขียนโปรแกรมด้วยภาษา Python"
                value={title}
                onChange={handleTitleChange}
              />
            </div>
            <div className="form-group">
              <label className="form-label">ที่อยู่ลิงก์ (Slug) *</label>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginRight: '4px' }}>/</span>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="python-introduction"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">เวลาที่ใช้เรียน *</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="เช่น 10-15 นาที"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
              />
            </div>
          </div>

          {/* Cover Image Section */}
          <div style={{ borderTop: '1px solid var(--border-glass)', padding: '24px 0 12px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ImageIcon size={20} style={{ color: '#f472b6' }} />
              รูปภาพหน้าปกบทเรียน (Cover Image)
            </h3>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-start', marginBottom: '24px' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label className="form-label">URL รูปภาพหน้าปก</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="https://example.com/cover-image.jpg"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                />
              </div>
              <div style={{ width: '220px' }}>
                <label className="form-label">หรือ อัปโหลดจากเครื่อง</label>
                <label className="btn btn-secondary" style={{ width: '100%', cursor: 'pointer', gap: '8px' }}>
                  {uploadingCover ? (
                    <Loader size={16} className="spin-anim" />
                  ) : (
                    <Upload size={16} />
                  )}
                  {uploadingCover ? 'กำลังอัปโหลด...' : 'เลือกรูปภาพ'}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleCoverImageUpload}
                    disabled={uploadingCover}
                  />
                </label>
              </div>
            </div>
            {coverImageUrl && (
              <div style={{
                marginBottom: '24px',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '1px solid var(--border-glass)',
                maxHeight: '250px',
                position: 'relative'
              }}>
                <img
                  src={coverImageUrl}
                  alt="Cover preview"
                  style={{ width: '100%', maxHeight: '250px', objectFit: 'cover', display: 'block' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  style={{ position: 'absolute', top: '8px', right: '8px', padding: '4px 8px' }}
                  onClick={() => setCoverImageUrl('')}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--border-glass)', padding: '24px 0 12px' }}>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>ส่วนเนื้อหาบทเรียน (Content Blocks)</h3>
            
            {/* Render dynamic blocks */}
            {blocks.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                border: '2px dashed var(--border-glass)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-secondary)',
                marginBottom: '24px'
              }}>
                ยังไม่มีเนื้อหาบทเรียน กดปุ่มด้านล่างเพื่อเพิ่มบล็อกข้อมูลต่าง ๆ เช่น วิดีโอ ข้อความ หรือควิซ
              </div>
            ) : (
              <div>
                {blocks.map((block, index) => (
                  <div key={block.id} className="block-item">
                    <div className="flex-between" style={{ marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                      <div className="flex-gap-2">
                        {block.type === 'text' && <Type size={18} style={{ color: '#60a5fa' }} />}
                        {block.type === 'youtube' && <Play size={18} style={{ color: '#f87171' }} />}
                        {block.type === 'pdf' && <FileText size={18} style={{ color: '#fbbf24' }} />}
                        {block.type === 'quiz' && <CheckSquare size={18} style={{ color: '#34d399' }} />}
                        {block.type === 'code' && <Code2 size={18} style={{ color: '#a78bfa' }} />}
                        {block.type === 'image' && <ImageIcon size={18} style={{ color: '#f472b6' }} />}
                        <strong style={{ textTransform: 'uppercase', fontSize: '0.85rem' }}>
                          บล็อกที่ {index + 1}: {block.type}
                        </strong>
                      </div>
                      
                      {/* Move Up, Down, Delete */}
                      <div className="flex-gap-2">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px' }}
                          disabled={index === 0}
                          onClick={() => moveBlock(index, 'up')}
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '4px 8px' }}
                          disabled={index === blocks.length - 1}
                          onClick={() => moveBlock(index, 'down')}
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          style={{ padding: '4px 8px' }}
                          onClick={() => deleteBlock(block.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Block inputs based on type */}
                    {block.type === 'text' && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <label className="form-label" style={{ marginBottom: 0 }}>กรอกข้อความ / เนื้อหาหลัก</label>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => insertCodeTemplate(block.id)}
                            style={{ gap: '6px', fontSize: '0.82rem', borderColor: 'rgba(167,139,250,0.35)', color: '#a78bfa' }}
                          >
                            <Code2 size={14} />
                            แทรกโค้ด
                          </button>
                        </div>
                        <textarea
                          ref={(el) => { textareaRefs.current[block.id] = el; }}
                          className="form-input"
                          style={{ minHeight: '150px', resize: 'vertical', fontFamily: "'Sarabun', monospace" }}
                          placeholder={"พิมพ์เนื้อหาของบทเรียนตรงนี้...\n\nกดปุ่ม 'แทรกโค้ด' ด้านบนเพื่อเพิ่มช่องโค้ดที่ผู้ใช้สามารถกด Copy ได้"}
                          value={block.value}
                          onChange={(e) => updateBlockValue(block.id, e.target.value)}
                        />
                        <div className="text-editor-hint">
                          <Copy size={14} style={{ color: '#a78bfa', flexShrink: 0, marginTop: '2px' }} />
                          <span>
                            โค้ดที่อยู่ใน <code>```ภาษา...```</code> จะแสดงเป็นกล่องโค้ดพร้อม<strong style={{ color: 'var(--text-secondary)' }}>ปุ่ม Copy</strong> ให้ผู้ใช้กดคัดลอกได้ทันที
                          </span>
                        </div>
                      </div>
                    )}

                    {block.type === 'code' && (
                      <div>
                        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
                          <div className="form-group" style={{ flex: 1, minWidth: '180px', marginBottom: 0 }}>
                            <label className="form-label">ภาษาโปรแกรม</label>
                            <select
                              className="form-input"
                              value={block.language}
                              onChange={(e) => updateCodeBlockField(block.id, 'language', e.target.value)}
                            >
                              {CODE_LANGUAGES.map(lang => (
                                <option key={lang.value} value={lang.value}>{lang.label}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group" style={{ flex: 2, minWidth: '240px', marginBottom: 0 }}>
                            <label className="form-label">คำอธิบาย (แสดงด้านบน editor)</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="เช่น ลองแก้โค้ดนี้ให้พิมพ์ชื่อของคุณ"
                              value={block.description || ''}
                              onChange={(e) => updateCodeBlockField(block.id, 'description', e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">โค้ดตัวอย่าง (นักเรียนจะเห็นโค้ดนี้เป็นค่าเริ่มต้น)</label>
                          <div style={{
                            borderRadius: '10px',
                            overflow: 'hidden',
                            border: '1px solid var(--border-glass)',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
                          }}>
                            <Editor
                              height="260px"
                              language={block.language}
                              value={block.value}
                              theme={theme === 'light' ? 'light' : 'vs-dark'}
                              onChange={(val) => updateCodeBlockField(block.id, 'value', val || '')}
                              options={{
                                minimap: { enabled: false },
                                fontSize: 14,
                                lineNumbers: 'on',
                                scrollBeyondLastLine: false,
                                wordWrap: 'on',
                                padding: { top: 12 },
                                automaticLayout: true
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {block.type === 'youtube' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">หัวข้อวิดีโอ (กำหนดเอง)</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="เช่น วิดีโอแนะนำบทเรียน (หรือปล่อยว่างไว้เพื่อใช้ค่าเริ่มต้น)"
                            value={block.title || ''}
                            onChange={(e) => updateYoutubeBlockTitle(block.id, e.target.value)}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label">ลิงก์วิดีโอ YouTube (URL หรือ Video ID)</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="เช่น https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                            value={block.value}
                            onChange={(e) => updateBlockValue(block.id, e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {block.type === 'pdf' && (
                      <div>
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                          <label className="form-label">หัวข้อเอกสาร PDF (กำหนดเอง)</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="เช่น เอกสารประกอบการสอน (PDF) (หรือปล่อยว่างไว้เพื่อใช้ค่าเริ่มต้น)"
                            value={block.title || ''}
                            onChange={(e) => updatePdfBlockTitle(block.id, e.target.value)}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
                          <div style={{ flex: 1, minWidth: '200px' }}>
                            <label className="form-label">ที่อยู่ลิงก์ไฟล์ PDF (URL)</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="https://example.com/document.pdf"
                              value={block.value}
                              onChange={(e) => updateBlockValue(block.id, e.target.value)}
                            />
                          </div>
                          <div style={{ width: '220px' }}>
                            <label className="form-label">หรือ อัปโหลด PDF จากเครื่อง</label>
                            <label className="btn btn-secondary" style={{ width: '100%', cursor: 'pointer', gap: '8px' }}>
                              {uploadingPdfId === block.id ? (
                                <Loader size={16} className="spin-anim" />
                              ) : (
                                <Upload size={16} />
                              )}
                              {uploadingPdfId === block.id ? 'กำลังอัปโหลด...' : 'เลือกไฟล์ PDF'}
                              <input
                                type="file"
                                accept=".pdf"
                                style={{ display: 'none' }}
                                onChange={(e) => handlePdfUpload(block.id, e)}
                                disabled={uploadingPdfId !== null}
                              />
                            </label>
                          </div>
                        </div>
                        {block.file_name && (
                          <div style={{ fontSize: '0.85rem', color: 'var(--color-success)' }}>
                            ไฟล์ที่เลือก: {block.file_name}
                          </div>
                        )}
                      </div>
                    )}

                    {block.type === 'image' && (
                      <div>
                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
                          <div style={{ flex: 1, minWidth: '200px' }}>
                            <label className="form-label">URL รูปภาพ</label>
                            <input
                              type="text"
                              className="form-input"
                              placeholder="https://example.com/image.jpg"
                              value={block.value}
                              onChange={(e) => updateBlockValue(block.id, e.target.value)}
                            />
                          </div>
                          <div style={{ width: '220px' }}>
                            <label className="form-label">หรือ อัปโหลดจากเครื่อง</label>
                            <label className="btn btn-secondary" style={{ width: '100%', cursor: 'pointer', gap: '8px' }}>
                              {uploadingImageId === block.id ? (
                                <Loader size={16} className="spin-anim" />
                              ) : (
                                <Upload size={16} />
                              )}
                              {uploadingImageId === block.id ? 'กำลังอัปโหลด...' : 'เลือกรูปภาพ'}
                              <input
                                type="file"
                                accept="image/*"
                                style={{ display: 'none' }}
                                onChange={(e) => handleImageBlockUpload(block.id, e)}
                                disabled={uploadingImageId !== null}
                              />
                            </label>
                          </div>
                        </div>
                        <div className="form-group" style={{ marginBottom: '12px' }}>
                          <label className="form-label">คำบรรยายรูปภาพ (Caption)</label>
                          <input
                            type="text"
                            className="form-input"
                            placeholder="เช่น แผนภาพแสดงโครงสร้างข้อมูล (หรือปล่อยว่างไว้)"
                            value={block.caption || ''}
                            onChange={(e) => updateImageBlockCaption(block.id, e.target.value)}
                          />
                        </div>
                        {block.value && (
                          <div style={{
                            borderRadius: '10px',
                            overflow: 'hidden',
                            border: '1px solid var(--border-glass)',
                            maxHeight: '300px',
                            textAlign: 'center',
                            background: 'rgba(0,0,0,0.1)'
                          }}>
                            <img
                              src={block.value}
                              alt={block.caption || 'Preview'}
                              style={{ maxWidth: '100%', maxHeight: '300px', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {block.type === 'quiz' && (
                      <div className="quiz-card" style={{ background: 'rgba(255,255,255,0.01)', border: '1px dashed var(--border-glass)', margin: 0 }}>
                        <h4 style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>การจัดการข้อคำถาม</span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => addQuestionToQuiz(block.id)}
                          >
                            <Plus size={14} /> เพิ่มคำถาม
                          </button>
                        </h4>

                        {block.questions.map((q, qIndex) => (
                          <div key={q.id} style={{
                            borderBottom: qIndex === block.questions.length - 1 ? 'none' : '1px solid var(--border-glass)',
                            paddingBottom: '16px',
                            marginBottom: '16px'
                          }}>
                            <div className="flex-between" style={{ marginBottom: '12px' }}>
                              <strong>ข้อที่ {qIndex + 1}</strong>
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                                disabled={block.questions.length === 1}
                                onClick={() => deleteQuestionFromQuiz(block.id, q.id)}
                              >
                                ลบคำถามนี้
                              </button>
                            </div>

                            <div className="form-group">
                              <label className="form-label">โจทย์คำถาม</label>
                              <input
                                type="text"
                                className="form-input"
                                value={q.questionText}
                                onChange={(e) => updateQuestionText(block.id, q.id, e.target.value)}
                              />
                            </div>

                            <div className="form-group" style={{ marginBottom: 0 }}>
                              <div className="flex-between" style={{ marginBottom: '8px' }}>
                                <label className="form-label" style={{ marginBottom: 0 }}>ตัวเลือกคำตอบ (ติ๊กเลือกข้อที่เฉลยถูก)</label>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                                  onClick={() => addOptionToQuestion(block.id, q.id)}
                                >
                                  + เพิ่มตัวเลือก
                                </button>
                              </div>

                              {q.options.map((opt, oIndex) => (
                                <div key={oIndex} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px' }}>
                                  <input
                                    type="radio"
                                    name={`correct-${q.id}`}
                                    checked={q.correctOptionIndex === oIndex}
                                    onChange={() => updateCorrectOptionIndex(block.id, q.id, oIndex)}
                                    style={{ width: '18px', height: '18px', accentColor: 'var(--color-brand)', cursor: 'pointer' }}
                                  />
                                  <input
                                    type="text"
                                    className="form-input"
                                    style={{ flex: 1, padding: '8px 12px' }}
                                    value={opt}
                                    onChange={(e) => updateOptionText(block.id, q.id, oIndex, e.target.value)}
                                  />
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    style={{ padding: '8px' }}
                                    disabled={q.options.length <= 2}
                                    onClick={() => deleteOptionFromQuestion(block.id, q.id, oIndex)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Block creation toolbox */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              flexWrap: 'wrap',
              marginTop: '24px',
              paddingTop: '20px',
              borderTop: '1px solid var(--border-glass)'
            }}>
              <button type="button" className="btn btn-secondary" onClick={addTextBlock}>
                <Type size={16} />
                + เพิ่มข้อความ
              </button>
              <button type="button" className="btn btn-secondary" onClick={addYoutubeBlock}>
                <Play size={16} />
                + เพิ่ม YouTube วิดีโอ
              </button>
              <button type="button" className="btn btn-secondary" onClick={addPdfBlock}>
                <FileText size={16} />
                + เพิ่มไฟล์ PDF
              </button>
              <button type="button" className="btn btn-secondary" onClick={addQuizBlock}>
                <CheckSquare size={16} />
                + เพิ่มแบบสอบถาม/ควิซ
              </button>
              <button type="button" className="btn btn-secondary" onClick={addCodeBlock} style={{ borderColor: 'rgba(167,139,250,0.4)', color: '#a78bfa' }}>
                <Code2 size={16} />
                + เพิ่ม Code Editor
              </button>
              <button type="button" className="btn btn-secondary" onClick={addImageBlock} style={{ borderColor: 'rgba(244,114,182,0.4)', color: '#f472b6' }}>
                <ImageIcon size={16} />
                + เพิ่มรูปภาพ
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '32px', borderTop: '1px solid var(--border-glass)', paddingTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              ยกเลิก
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'กำลังบันทึก...' : (
                <>
                  <Save size={18} />
                  บันทึกบทเรียนทั้งหมด
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

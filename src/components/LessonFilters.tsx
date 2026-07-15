import React, { useState, useEffect, useCallback } from 'react';
import { Search, X } from 'lucide-react';

interface LessonFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: 'newest' | 'oldest' | 'alphabetical';
  setSortBy: (sort: 'newest' | 'oldest' | 'alphabetical') => void;
  statusFilter?: 'all' | 'completed' | 'incomplete';
  setStatusFilter?: (status: 'all' | 'completed' | 'incomplete') => void;
  showStatusFilter?: boolean;
  isAdmin?: boolean;
}

export const LessonFilters: React.FC<LessonFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  sortBy,
  setSortBy,
  statusFilter = 'all',
  setStatusFilter,
  showStatusFilter = true,
  isAdmin = false
}) => {
  // Local state for instant input feedback, debounced to parent
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Sync localSearch if parent resets searchQuery (e.g., clearFilters)
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  // Debounce: propagate to parent only after 300ms of inactivity
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(localSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, setSearchQuery]);

  const handleClear = useCallback(() => {
    setLocalSearch('');
    setSearchQuery('');
  }, [setSearchQuery]);

  return (
    <div className="card-glass" style={{
      padding: '16px 20px',
      marginBottom: '24px',
      display: 'flex',
      gap: '16px',
      flexWrap: 'wrap',
      alignItems: 'center',
      border: '1px solid var(--border-glass)'
    }}>
      {/* Search Input */}
      <div style={{ position: 'relative', flex: '1', minWidth: '240px' }}>
        <Search size={18} style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-muted)'
        }} />
        <input
          type="text"
          placeholder="ค้นหาชื่อบทเรียน..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 38px 10px 38px',
            background: 'var(--input-bg)',
            border: '1px solid var(--border-glass)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '0.95rem',
            outline: 'none',
            transition: 'border-color 0.2s ease'
          }}
        />
        {localSearch && (
          <button 
            onClick={handleClear}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Status Filter */}
      {showStatusFilter && setStatusFilter && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '180px' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>สถานะ:</span>
          <select
            value={statusFilter}
            onChange={(e: any) => setStatusFilter(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px',
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
            <option value="completed">{isAdmin ? 'มีผู้ส่งคำตอบแล้ว' : 'เรียนแล้ว'}</option>
            <option value="incomplete">{isAdmin ? 'ยังไม่มีผู้ส่งคำตอบ' : 'ยังไม่ได้เรียน'}</option>
          </select>
        </div>
      )}

      {/* Sort By */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '180px' }}>
        <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>เรียงลำดับ:</span>
        <select
          value={sortBy}
          onChange={(e: any) => setSortBy(e.target.value)}
          style={{
            width: '100%',
            padding: '10px 12px',
            background: 'var(--select-bg)',
            border: '1px solid var(--border-glass)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '0.9rem',
            outline: 'none',
            cursor: 'pointer'
          }}
        >
          <option value="oldest">เก่าสุด</option>
          <option value="newest">ใหม่สุด</option>
          <option value="alphabetical">ตามตัวอักษร (ก-ฮ)</option>
        </select>
      </div>
    </div>
  );
};

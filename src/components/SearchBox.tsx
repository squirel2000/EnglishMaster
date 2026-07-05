'use client';

import { useState, type FormEvent } from 'react';

interface SearchBoxProps {
  onSearch: (query: string) => void;
}

export function SearchBox({ onSearch }: SearchBoxProps) {
  const [value, setValue] = useState('');
  const [hint, setHint] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const query = value.trim();
    if (query === '') {
      setHint('請輸入要查詢的內容');
      return;
    }
    setHint(null);
    onSearch(query);
  }

  return (
    <form onSubmit={handleSubmit} className="search-form" noValidate>
      <div className="search-row">
        <div className="search-field">
          <svg
            className="search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            focusable="false"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="輸入英文單字、片語或整句"
            aria-label="查詢內容"
            className="search-input"
          />
        </div>
        <button type="submit" className="search-submit">
          查詢
        </button>
      </div>
      {hint && (
        <p role="alert" className="search-hint">
          {hint}
        </p>
      )}
    </form>
  );
}

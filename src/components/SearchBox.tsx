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
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="輸入英文單字、片語或整句"
        aria-label="查詢內容"
      />
      <button type="submit">查詢</button>
      {hint && <p role="alert">{hint}</p>}
    </form>
  );
}

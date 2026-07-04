import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBox } from './SearchBox';

describe('SearchBox', () => {
  it('submits the trimmed query on Enter', async () => {
    const onSearch = vi.fn();
    render(<SearchBox onSearch={onSearch} />);
    await userEvent.type(screen.getByRole('textbox'), '  give up  {enter}');
    expect(onSearch).toHaveBeenCalledWith('give up');
  });

  it('submits via the search button', async () => {
    const onSearch = vi.fn();
    render(<SearchBox onSearch={onSearch} />);
    await userEvent.type(screen.getByRole('textbox'), 'hello');
    await userEvent.click(screen.getByRole('button', { name: '查詢' }));
    expect(onSearch).toHaveBeenCalledWith('hello');
  });

  it('shows a hint and does not submit blank input', async () => {
    const onSearch = vi.fn();
    render(<SearchBox onSearch={onSearch} />);
    await userEvent.type(screen.getByRole('textbox'), '   {enter}');
    expect(onSearch).not.toHaveBeenCalled();
    expect(screen.getByText('請輸入要查詢的內容')).toBeInTheDocument();
  });

  it('clears the hint after a valid submission', async () => {
    const onSearch = vi.fn();
    render(<SearchBox onSearch={onSearch} />);
    await userEvent.type(screen.getByRole('textbox'), '   {enter}');
    await userEvent.type(screen.getByRole('textbox'), 'hello{enter}');
    expect(screen.queryByText('請輸入要查詢的內容')).not.toBeInTheDocument();
  });
});

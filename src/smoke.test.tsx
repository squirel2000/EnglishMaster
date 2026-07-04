import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

describe('test pipeline smoke test', () => {
  it('renders a component in jsdom', () => {
    render(<p>pipeline works</p>);
    expect(screen.getByText('pipeline works')).toBeInTheDocument();
  });
});

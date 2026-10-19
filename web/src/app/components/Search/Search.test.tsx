// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeCache, renderWithI18n } from '../fixtures.test-support';
import { CacheSearch } from '.';

const CACHES = [
  makeCache({ code: 'GCSU1', name: 'Old Oak', type: 'traditional' }),
  makeCache({ code: 'GCSU2', name: 'Mill pond', type: 'mystery' }),
];

beforeEach(() => {
  localStorage.setItem('lang', 'en');
});

describe('CacheSearch', () => {
  it('finds caches by name or code and opens the one picked, clearing the search', () => {
    const onSelect = vi.fn();
    renderWithI18n(<CacheSearch caches={CACHES} onSelect={onSelect} />);
    const input = screen.getByRole('searchbox', { name: 'Find a cache' });
    expect(screen.queryByTestId('search-result')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: 'mill' } });
    const [result] = screen.getAllByTestId('search-result');
    expect(result).toHaveTextContent('Mill pond');
    expect(result).toHaveTextContent('GCSU2 · Mystery');
    fireEvent.click(result);
    expect(onSelect).toHaveBeenCalledWith('GCSU2');
    expect(input).toHaveValue('');
  });

  it('says when nothing matches', () => {
    renderWithI18n(<CacheSearch caches={CACHES} onSelect={() => {}} />);
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'zebra' },
    });
    expect(screen.getByText('No cache matches.')).toBeInTheDocument();
  });
});

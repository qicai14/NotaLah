import { describe, expect, it } from 'vitest';
import {
  activeFilterCount,
  dateRangeError,
  emptySearch,
  parseSearch,
  searchApiPath,
  searchHref,
  toSearchParams,
  withFilters,
} from './searchParams';

const parse = (qs: string) => parseSearch(new URLSearchParams(qs));

describe('search query string', () => {
  it('CLI-TC21: the URL is read into a state and written back without defaults', () => {
    const s = parse('q=normal+forms&tab=notes&lecturer=any&module=7&from=2026-09-01&to=2026-10-01');
    expect(s).toEqual({
      q: 'normal forms',
      tab: 'notes',
      lecturer: 'any',
      term: null,
      from: '2026-09-01',
      to: '2026-10-01',
      module: '7',
    });
    expect(toSearchParams(s).toString()).toBe(
      'q=normal+forms&tab=notes&lecturer=any&from=2026-09-01&to=2026-10-01&module=7',
    );
    expect(searchHref({ q: 'dsa' })).toBe('/search?q=dsa');
    expect(searchHref({})).toBe('/search');
    expect(parse('')).toEqual(emptySearch);
  });

  it('CLI-TC22: values the API would refuse are dropped when the URL is read', () => {
    const s = parse('q=x&tab=videos&lecturer=1e3&term=0&module=%2B5&from=yesterday&to=2026-13-45');
    expect(s.tab).toBe('top');
    expect(s.lecturer).toBeNull();
    expect(s.term).toBeNull();
    expect(s.module).toBeNull();
    expect(s.from).toBeNull();
    expect(s.to).toBeNull();
    expect(parse('lecturer=12&term=3').lecturer).toBe('12');
    expect(parse(`q=${'a'.repeat(150)}`).q).toHaveLength(100);
  });

  it('CLI-TC23: a term and a date range never travel together', () => {
    expect(parse('q=x&term=4&from=2026-09-01&to=2026-10-01')).toMatchObject({ term: '4', from: null, to: null });
    const ranged = parse('q=x&from=2026-09-01');
    expect(withFilters(ranged, { term: '4' })).toMatchObject({ term: '4', from: null, to: null });
    expect(withFilters(parse('q=x&term=4'), { from: '2026-09-01' })).toMatchObject({ term: null, from: '2026-09-01' });
    expect(withFilters(parse('q=x&term=4'), { term: null }).term).toBeNull();
    expect(dateRangeError({ from: '2026-10-02', to: '2026-10-01' })).toMatch(/start date/);
    expect(dateRangeError({ from: '2026-10-01', to: '2026-10-01' })).toBeNull();
    expect(dateRangeError({ from: '2026-10-01', to: null })).toBeNull();
  });

  it('CLI-TC24: the API path trims the query and sends the cursor and asOf from page 1', () => {
    expect(searchApiPath(parse('q=%20%20'))).toBeNull();
    expect(searchApiPath(parse('q=%20sql%20'))).toBe('/search?q=sql&tab=top');
    const s = parse('q=sql&tab=notes&lecturer=5&term=2&module=9');
    expect(searchApiPath(s)).toBe('/search?q=sql&tab=notes&lecturer=5&term=2&module=9');
    expect(searchApiPath(s, { cursor: 'abc', asOf: '2026-10-17T01:00:00.000Z' })).toBe(
      '/search?q=sql&tab=notes&lecturer=5&term=2&module=9&cursor=abc&asOf=2026-10-17T01%3A00%3A00.000Z',
    );
  });

  it('CLI-TC25: people, hashtags and modules requests omit the note filters and count none', () => {
    for (const tab of ['people', 'hashtags', 'modules']) {
      const s = parse(`q=lee&tab=${tab}&lecturer=any&module=3&term=1`);
      expect(searchApiPath(s)).toBe(`/search?q=lee&tab=${tab}`);
      expect(activeFilterCount(s)).toBe(0);
    }
    expect(activeFilterCount(parse('q=x&tab=notes&lecturer=any&module=3&from=2026-09-01&to=2026-09-30'))).toBe(3);
    expect(activeFilterCount(parse('q=x'))).toBe(0);
  });
});

import { useQuery } from '@tanstack/react-query';

export async function api<T>(path: string, method = 'GET', data?: unknown): Promise<T> {
  const response = await fetch('/api' + path, {
    method, credentials: 'same-origin',
    headers: data === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result) throw new Error(result?.error || 'The service is temporarily unavailable.');
  return result.data;
}

export interface Content {
  _id: string;
  slug: string;
  title: string;
  summary: string;
  body: string;
  image?: string;
  link?: string;
  status: string;
  goal?: number;
  raised?: number;
  currency?: string;
  deadline?: string;
  date?: string;
  location?: string;
  organizer?: string;
  cause?: string;
  value?: number;
  unit?: string;
}

export const money = (cents: number, currency = 'usd') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);

export function useContent(path: string) {
  return useQuery({ queryKey: [path], queryFn: () => api<Content[]>(path), retry: false });
}

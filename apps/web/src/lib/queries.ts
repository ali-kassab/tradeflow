import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Category } from './types';

/** Shared read queries used by more than one page. */
export function useCategories() {
  return useQuery({ queryKey: ['categories'], queryFn: async () => (await api.get<Category[]>('/categories')).data });
}

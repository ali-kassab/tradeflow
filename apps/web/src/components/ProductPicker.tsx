import { useQuery } from '@tanstack/react-query';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import { formatNumber } from '@/lib/format';
import type { Paginated, Product } from '@/lib/types';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

interface Props {
  value: Product | null;
  onChange: (product: Product | null) => void;
  id?: string;
  placeholder?: string;
  /** Adds an "any product" entry (for filters). */
  allowClear?: boolean;
  clearLabel?: string;
  invalid?: boolean;
  className?: string;
}

/**
 * Searchable product selector backed by GET /products?search=… (server-side search,
 * so it scales past one page). Shows SKU and current stock to help pick the right item.
 */
export function ProductPicker({ value, onChange, id, placeholder, allowClear, clearLabel, invalid, className }: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 250);

  const results = useQuery({
    queryKey: ['products', 'picker', q],
    queryFn: async () =>
      (await api.get<Paginated<Product>>('/products', { params: { pageSize: 20, status: 'active', ...(q ? { search: q } : {}) } }))
        .data.data,
    enabled: open,
    staleTime: 15_000,
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          // A combobox doesn't take its name from its text: with an id, a <label htmlFor> names it;
          // without one (filters, "add product" buttons), the placeholder does.
          aria-label={id ? undefined : (placeholder ?? t('picker.product'))}
          aria-expanded={open}
          aria-invalid={invalid ? true : undefined}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground', className)}
        >
          <span className="truncate">{value ? `${value.name} · ${value.sku}` : (placeholder ?? t('picker.product'))}</span>
          <ChevronsUpDownIcon className="opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={t('picker.searchProduct')} />
          <CommandList>
            {results.isFetching && !results.data ? (
              <div className="flex justify-center p-4">
                <Spinner />
              </div>
            ) : null}
            <CommandEmpty>{t('status.empty')}</CommandEmpty>
            <CommandGroup>
              {allowClear ? (
                <CommandItem
                  value="__clear"
                  onSelect={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                >
                  {clearLabel ?? t('picker.anyProduct')}
                </CommandItem>
              ) : null}
              {results.data?.map((p) => (
                <CommandItem
                  key={p.id}
                  value={String(p.id)}
                  onSelect={() => {
                    onChange(p);
                    setOpen(false);
                  }}
                >
                  <CheckIcon className={cn(value?.id === p.id ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <span className="text-muted-foreground text-xs" dir="ltr">
                    {p.sku}
                  </span>
                  <span className={cn('tabular w-14 text-end text-xs', p.isLowStock && 'text-warning-foreground font-semibold')}>
                    {formatNumber(p.stockQty, i18n.language)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

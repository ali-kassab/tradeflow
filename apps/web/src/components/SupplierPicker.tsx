import { useQuery } from '@tanstack/react-query';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { api } from '@/lib/api';
import type { Paginated, Supplier } from '@/lib/types';
import { useDebounced } from '@/lib/use-debounced';
import { cn } from '@/lib/utils';

/** The fields a picker needs; a full Supplier from the list endpoint satisfies it. */
export type PickedSupplier = Pick<Supplier, 'id' | 'name' | 'phone'> & Partial<Pick<Supplier, 'balance'>>;

interface Props {
  value: PickedSupplier | null;
  onChange: (supplier: Supplier) => void;
  id?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Searchable supplier selector backed by GET /suppliers?search=… (name, phone or email),
 * built like CustomerPicker. Only active suppliers are offered for new documents.
 */
export function SupplierPicker({ value, onChange, id, invalid, disabled, className }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const q = useDebounced(search.trim(), 250);

  const results = useQuery({
    queryKey: ['suppliers', 'picker', q],
    queryFn: async () =>
      (await api.get<Paginated<Supplier>>('/suppliers', { params: { pageSize: 20, status: 'active', ...(q ? { search: q } : {}) } })).data
        .data,
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
          aria-expanded={open}
          aria-invalid={invalid ? true : undefined}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !value && 'text-muted-foreground', className)}
        >
          <span className="truncate">{value ? value.name : t('picker.supplier')}</span>
          <ChevronsUpDownIcon className="opacity-50" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={search} onValueChange={setSearch} placeholder={t('picker.searchSupplier')} />
          <CommandList>
            {results.isFetching && !results.data ? (
              <div className="flex justify-center p-4">
                <Spinner />
              </div>
            ) : null}
            <CommandEmpty>{t('status.empty')}</CommandEmpty>
            <CommandGroup>
              {results.data?.map((c) => (
                <CommandItem
                  key={c.id}
                  value={String(c.id)}
                  onSelect={() => {
                    onChange(c);
                    setOpen(false);
                  }}
                >
                  <CheckIcon className={cn(value?.id === c.id ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {c.phone ? (
                    <span className="text-muted-foreground tabular text-xs" dir="ltr">
                      {c.phone}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

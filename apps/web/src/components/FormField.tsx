import type { ComponentProps } from 'react';
import { type FieldPath, type FieldValues, type UseFormReturn } from 'react-hook-form';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';

type Props<T extends FieldValues> = {
  form: UseFormReturn<T>;
  name: FieldPath<T>;
  label: string;
} & Omit<ComponentProps<typeof Input>, 'name' | 'form'>;

/** A labelled text input wired to react-hook-form, with an accessible error message. */
export function FormField<T extends FieldValues>({ form, name, label, ...input }: Props<T>) {
  const error = form.formState.errors[name];
  const id = `f-${name}`;
  const errorId = `${id}-error`;
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        {...input}
        {...form.register(name)}
      />
      {error ? <FieldError id={errorId}>{String(error.message ?? '')}</FieldError> : null}
    </Field>
  );
}

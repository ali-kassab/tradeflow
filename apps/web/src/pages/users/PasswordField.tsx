import { WandSparklesIcon } from 'lucide-react';
import type { FieldPath, FieldValues, PathValue, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { generatePassword } from './user-schemas';

/**
 * A temporary password the owner shares with the user directly (TradeFlow sends no email).
 * Shown in plain text on purpose, with a button that fills in a random one.
 */
export function PasswordField<T extends FieldValues>({ form, name, label }: { form: UseFormReturn<T>; name: FieldPath<T>; label: string }) {
  const { t } = useTranslation('users');
  const error = form.formState.errors[name];
  const id = `f-${name}`;
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          dir="ltr"
          className="text-start font-mono"
          autoComplete="off"
          spellCheck={false}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : `${id}-hint`}
          {...form.register(name)}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            onClick={() => form.setValue(name, generatePassword() as PathValue<T, FieldPath<T>>, { shouldValidate: true, shouldDirty: true })}
          >
            <WandSparklesIcon aria-hidden="true" />
            {t('fields.generate')}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
      {error ? (
        <FieldError id={`${id}-error`}>{String(error.message ?? '')}</FieldError>
      ) : (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {t('fields.tempPasswordHint')}
        </p>
      )}
    </Field>
  );
}

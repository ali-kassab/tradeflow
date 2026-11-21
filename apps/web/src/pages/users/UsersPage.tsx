import { useQuery } from '@tanstack/react-query';
import { KeyRoundIcon, PencilIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, useSession } from '@/auth/context';
import { Alert } from '@/components/Alert';
import { PageHeader } from '@/components/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import type { UserAccount } from '@/lib/types';
import { ResetPasswordDialog } from './ResetPasswordDialog';
import { UserFormDialog } from './UserFormDialog';

export default function UsersPage() {
  const { t, i18n } = useTranslation('users');
  const { t: tc } = useTranslation();
  const { user: me } = useSession();
  const { reloadSession } = useAuth();
  const lang = i18n.language;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<UserAccount | null>(null);
  const [resetting, setResetting] = useState<UserAccount | null>(null);

  const users = useQuery({
    queryKey: ['users'],
    queryFn: async () => (await api.get<UserAccount[]>('/users')).data,
  });

  return (
    <div>
      <PageHeader
        title={t('title')}
        description={t('description')}
        actions={
          <Button onClick={() => setAdding(true)}>
            <PlusIcon aria-hidden="true" />
            {t('add')}
          </Button>
        }
      />

      {users.isError ? <Alert>{tc('status.loadError')}</Alert> : null}
      {users.isPending ? <Skeleton className="h-48" /> : null}
      {users.data ? (
        <div className="panel overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('fields.name')}</TableHead>
                <TableHead>{t('fields.email')}</TableHead>
                <TableHead>{t('fields.role')}</TableHead>
                <TableHead>{t('columns.status')}</TableHead>
                <TableHead>{t('columns.lastLogin')}</TableHead>
                <TableHead className="text-end">{tc('actions.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.data.map((u) => {
                const self = u.id === me.id;
                return (
                  <TableRow key={u.id} className={u.isActive ? undefined : 'text-muted-foreground'}>
                    <TableCell className="font-medium whitespace-nowrap">
                      {u.name}
                      {self ? <span className="text-muted-foreground ms-2 text-xs font-normal">{t('you')}</span> : null}
                    </TableCell>
                    <TableCell>
                      <span dir="ltr">{u.email}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{tc(`roles.${u.role}`)}</TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <Badge variant="secondary">{t('status.active')}</Badge>
                      ) : (
                        <Badge variant="outline">{t('status.inactive')}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="tabular whitespace-nowrap">{u.lastLoginAt ? formatDateTime(u.lastLoginAt, lang) : t('never')}</TableCell>
                    <TableCell className="text-end whitespace-nowrap">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(u)} aria-label={t('editLabel', { name: u.name })}>
                        <PencilIcon aria-hidden="true" />
                        {tc('actions.edit')}
                      </Button>
                      {self ? null : (
                        <Button variant="ghost" size="sm" onClick={() => setResetting(u)} aria-label={t('reset.label', { name: u.name })}>
                          <KeyRoundIcon aria-hidden="true" />
                          {t('reset.action')}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}
      <p className="text-muted-foreground mt-2 text-xs">{t('hint')}</p>

      <UserFormDialog open={adding} onOpenChange={setAdding} />
      {/* Mounted only while editing, so a closing edit dialog never falls back to the add form. */}
      {editing ? (
        <UserFormDialog
          open
          onOpenChange={(o) => (o ? undefined : setEditing(null))}
          user={editing}
          isSelf={editing.id === me.id}
          // Your own name appears in the sidebar, which reads it from the session.
          onSaved={(saved) => (saved.id === me.id ? void reloadSession() : undefined)}
        />
      ) : null}
      <ResetPasswordDialog user={resetting} onOpenChange={(o) => (o ? undefined : setResetting(null))} />
    </div>
  );
}

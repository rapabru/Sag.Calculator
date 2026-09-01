import React from 'react';
import type { AuthState } from '../auth/useSession';
import { useTranslation } from '../i18n/useTranslation';

/**
 * Sin credenciales de Supabase configuradas el botón no se dibuja: la app anda
 * igual y el historial vive en el navegador.
 */
export const AccountButton: React.FC<{ auth: AuthState }> = ({ auth }) => {
  const { t } = useTranslation();
  if (!auth.configured) return null;

  if (!auth.session) {
    return (
      <button className="btn no-print" onClick={() => void auth.signIn()} disabled={!auth.ready}>
        {t('auth.signIn')}
      </button>
    );
  }

  return (
    <button
      className="btn no-print"
      title={auth.email ?? undefined}
      onClick={() => void auth.signOut()}
    >
      {t('auth.signOut')}
    </button>
  );
};

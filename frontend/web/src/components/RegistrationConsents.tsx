'use client';

import Link from 'next/link';

export type RegistrationConsentState = {
  privacyConsent: boolean;
  termsConsent: boolean;
  ageConfirmed: boolean;
  marketingConsent: boolean;
};

export function RegistrationConsents({
  value,
  onChange,
}: {
  value: RegistrationConsentState;
  onChange: (value: RegistrationConsentState) => void;
}) {
  function set<K extends keyof RegistrationConsentState>(key: K, checked: RegistrationConsentState[K]) {
    onChange({ ...value, [key]: checked });
  }

  return (
    <div className="grid gap-3">
      <label className="flex items-start gap-3 rounded-3xl border border-aqua/15 bg-aqua/5 p-4">
        <input
          type="checkbox"
          checked={value.privacyConsent}
          onChange={(event) => set('privacyConsent', event.target.checked)}
          required
          className="mt-1 h-5 w-5 rounded border-slate-300 accent-aqua"
        />
        <span className="text-sm leading-6 text-slate-700">
          Autorizo de forma previa, expresa e informada el tratamiento de mis datos para crear y administrar mi cuenta, gestionar reservas, pagos, domicilios, soporte y notificaciones operativas. He leído el{' '}
          <Link href="/legal/privacy-notice" target="_blank" className="font-black text-aqua underline">
            aviso de privacidad
          </Link>{' '}
          y la{' '}
          <Link href="/legal/privacy" target="_blank" className="font-black text-aqua underline">
            política de tratamiento de datos
          </Link>.
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-white p-4">
        <input
          type="checkbox"
          checked={value.termsConsent}
          onChange={(event) => set('termsConsent', event.target.checked)}
          required
          className="mt-1 h-5 w-5 rounded border-slate-300 accent-aqua"
        />
        <span className="text-sm leading-6 text-slate-700">
          Acepto los{' '}
          <Link href="/legal/terms" target="_blank" className="font-black text-aqua underline">
            términos y condiciones
          </Link>{' '}
          del servicio, incluidos reserva, pagos, cancelaciones, uso de máquinas y domicilios.
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-3xl border border-slate-200 bg-white p-4">
        <input
          type="checkbox"
          checked={value.ageConfirmed}
          onChange={(event) => set('ageConfirmed', event.target.checked)}
          required
          className="mt-1 h-5 w-5 rounded border-slate-300 accent-aqua"
        />
        <span className="text-sm leading-6 text-slate-700">
          Declaro que soy mayor de edad y tengo capacidad para aceptar los términos y autorizar el tratamiento de mis datos.
        </span>
      </label>

      <label className="flex items-start gap-3 rounded-3xl border border-yellowBrand/50 bg-yellowBrand/10 p-4">
        <input
          type="checkbox"
          checked={value.marketingConsent}
          onChange={(event) => set('marketingConsent', event.target.checked)}
          className="mt-1 h-5 w-5 rounded border-slate-300 accent-aqua"
        />
        <span className="text-sm leading-6 text-slate-700">
          <strong>Opcional:</strong> autorizo recibir promociones, novedades y comunicaciones comerciales. Puedo retirar esta autorización después sin afectar el servicio.
        </span>
      </label>
    </div>
  );
}

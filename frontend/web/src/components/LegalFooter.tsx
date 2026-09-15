import Link from 'next/link';
import { legalConfig } from '@/lib/legal';

export function LegalFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white px-6 py-8 text-sm text-slate-500">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-black text-slate-800">{legalConfig.tradeName}</p>
          <p className="mt-1 text-xs">Atención: {legalConfig.customerServiceEmail} · Privacidad: {legalConfig.privacyEmail}</p>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-2 text-xs font-black">
          <Link href="/legal/privacy-notice" className="hover:text-aqua">Aviso de privacidad</Link>
          <Link href="/legal/privacy" className="hover:text-aqua">Tratamiento de datos</Link>
          <Link href="/legal/terms" className="hover:text-aqua">Términos y condiciones</Link>
        </nav>
      </div>
    </footer>
  );
}

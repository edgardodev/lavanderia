import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function AdminDashboardLink() {
  return (
    <Link
      href="/admin/dashboard"
      className="inline-flex w-fit items-center gap-2 rounded-full border border-aqua/20 bg-white px-4 py-2 text-sm font-black text-aqua shadow-sm transition hover:bg-aqua/10"
    >
      <ArrowLeft size={16} />
      Volver al dashboard
    </Link>
  );
}

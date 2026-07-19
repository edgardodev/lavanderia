import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-3xl border border-aqua/10 bg-white p-6 shadow-sm ${className}`}>{children}</section>;
}

export function Button(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = '', ...rest } = props;
  return <button className={`focus-ring rounded-2xl bg-aqua px-5 py-3 font-black text-white shadow-sm transition hover:brightness-95 disabled:opacity-60 ${className}`} {...rest} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props;
  return <input className={`focus-ring w-full rounded-2xl border border-slate-200 px-4 py-3 ${className}`} {...rest} />;
}

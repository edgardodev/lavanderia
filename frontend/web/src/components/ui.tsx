import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-[2rem] border border-aqua/15 bg-white/95 p-6 shadow-[0_22px_60px_rgba(0,193,193,0.10)] backdrop-blur', className)}>
      {children}
    </section>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'dark' | 'ghost' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-aqua text-white shadow-aqua/20 hover:-translate-y-0.5 hover:shadow-lg',
  secondary: 'bg-yellowBrand text-slate-950 hover:-translate-y-0.5 hover:shadow-lg',
  outline: 'border border-aqua/30 bg-white text-aqua hover:bg-aqua hover:text-white',
  dark: 'bg-slate-950 text-white hover:-translate-y-0.5 hover:shadow-lg',
  ghost: 'bg-transparent text-slate-700 hover:bg-aqua/10 hover:text-aqua',
  danger: 'bg-rose-600 text-white hover:-translate-y-0.5 hover:shadow-lg',
};

export function Button({ className = '', variant = 'primary', ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        'focus-ring inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60',
        buttonVariants[variant],
        className,
      )}
      {...rest}
    />
  );
}

export function Input({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn('focus-ring w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400', className)} {...rest} />;
}

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn('focus-ring w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800', className)} {...rest}>{children}</select>;
}

export function Textarea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn('focus-ring min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400', className)} {...rest} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-black text-slate-800">{label}</span>
      {children}
      {hint && <span className="text-xs font-semibold leading-relaxed text-slate-500">{hint}</span>}
    </label>
  );
}

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex w-fit items-center rounded-full bg-yellowBrand px-3 py-1 text-xs font-black uppercase tracking-wide text-slate-950', className)}>{children}</span>;
}

export function SectionTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="max-w-3xl">
      {eyebrow && <p className="mb-3 text-xs font-black uppercase tracking-[0.28em] text-aqua">{eyebrow}</p>}
      <h1 className="font-title text-4xl leading-tight text-aqua md:text-6xl">{title}</h1>
      {description && <p className="mt-4 text-base leading-7 text-slate-600 md:text-lg">{description}</p>}
    </div>
  );
}

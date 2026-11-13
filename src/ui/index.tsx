import { useId } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { STATUS_LABEL, type OrderStatus } from '../../shared/order-status.ts';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cx('h-4 w-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" role="status" aria-label="Loading">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

const VARIANT = {
  primary: 'bg-brand-700 text-white hover:bg-brand-800',
  secondary: 'bg-white text-slate-800 border border-slate-300 hover:bg-slate-50',
  ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
  danger: 'bg-red-700 text-white hover:bg-red-800',
};
const SIZE = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2.5 text-sm' };

export function Button({
  variant = 'primary', size = 'md', loading = false, disabled, className, children, ...rest
}: { variant?: keyof typeof VARIANT; size?: keyof typeof SIZE; loading?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-colors',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
        'disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT[variant], SIZE[size], className,
      )}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-card border border-slate-200 bg-white p-5 shadow-card', className)}>{children}</div>;
}

const GROUP = {
  waiting: 'bg-amber-100 text-amber-900',
  working: 'bg-blue-100 text-blue-900',
  done: 'bg-emerald-100 text-emerald-900',
  stopped: 'bg-slate-100 text-slate-700',
  refunded: 'bg-slate-100 text-red-700',
};
const STATUS_GROUP: Record<OrderStatus, keyof typeof GROUP> = {
  pending_payment: 'waiting', payment_verification: 'waiting', revision_requested: 'waiting',
  payment_confirmed: 'working', in_production: 'working', for_review: 'working',
  completed: 'done', delivered: 'done',
  cancelled: 'stopped', refunded: 'refunded',
};

export function StatusPill({ status }: { status: string }) {
  const known = Object.prototype.hasOwnProperty.call(STATUS_GROUP, status);
  const s = status as OrderStatus;
  return (
    <span className={cx('inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold', known ? GROUP[STATUS_GROUP[s]] : GROUP.stopped)}>
      {known ? STATUS_LABEL[s] : status}
    </span>
  );
}

const controlCls = (error?: string) => cx(
  'w-full rounded-control border bg-white px-3 py-2 text-sm text-slate-900 focus:outline-2 focus:outline-brand-600',
  error ? 'border-red-600' : 'border-slate-300',
);

type FieldProps = { label: string; hint?: string; error?: string };

function Wrap({ id, label, hint, error, children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-800">{label}</label>
      {children}
      {hint && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-600">{hint}</p>}
      {error && <p id={`${id}-err`} className="mt-1 text-xs font-medium text-red-700">{error}</p>}
    </div>
  );
}

const aria = (id: string, hint?: string, error?: string) => ({
  'aria-describedby': [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(' ') || undefined,
  'aria-invalid': error ? true : undefined,
});

export function TextField({ label, hint, error, className, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint} error={error}>
      <input {...rest} id={id} {...aria(id, hint, error)} className={cx(controlCls(error), className)} />
    </Wrap>
  );
}

export function TextArea({ label, hint, error, className, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint} error={error}>
      <textarea {...rest} id={id} {...aria(id, hint, error)} className={cx(controlCls(error), className)} />
    </Wrap>
  );
}

export function Select({ label, hint, error, className, children, ...rest }: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Wrap id={id} label={label} hint={hint} error={error}>
      <select {...rest} id={id} {...aria(id, hint, error)} className={cx(controlCls(error), className)}>{children}</select>
    </Wrap>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-slate-300 p-8 text-center">
      <p className="font-display text-base font-semibold text-slate-800">{title}</p>
      {children && <div className="mt-2 text-sm text-slate-600">{children}</div>}
    </div>
  );
}

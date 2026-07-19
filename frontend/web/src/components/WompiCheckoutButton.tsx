'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Checkout = {
  widget: {
    publicKey: string;
    currency: string;
    amountInCents: number;
    reference: string;
    signature: string;
    redirectUrl: string;
  };
};

export function WompiCheckoutButton({ type, id }: { type: 'reservation' | 'order'; id: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function clearWidgetTimeout() {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }

  async function pay() {
    setLoading(true);
    setMessage('');
    clearWidgetTimeout();

    try {
      const checkout = await apiFetch<{ checkout: Checkout }>('/payments/wompi/checkout', {
        method: 'POST',
        body: JSON.stringify({ type, id }),
      });

      if (!widgetRef.current) {
        setMessage('No se pudo montar el boton de Wompi. Recarga la pagina e intenta de nuevo.');
        setLoading(false);
        return;
      }

      widgetRef.current.innerHTML = '';

      const form = document.createElement('form');
      const script = document.createElement('script');
      script.src = 'https://checkout.wompi.co/widget.js';
      script.async = true;
      script.setAttribute('data-render', 'button');
      script.setAttribute('data-public-key', checkout.checkout.widget.publicKey);
      script.setAttribute('data-currency', checkout.checkout.widget.currency);
      script.setAttribute('data-amount-in-cents', String(checkout.checkout.widget.amountInCents));
      script.setAttribute('data-reference', checkout.checkout.widget.reference);
      script.setAttribute('data-signature:integrity', checkout.checkout.widget.signature);
      script.setAttribute('data-redirect-url', checkout.checkout.widget.redirectUrl);

      script.onload = () => {
        clearWidgetTimeout();
        setLoading(false);
      };

      script.onerror = () => {
        clearWidgetTimeout();
        setLoading(false);
        setMessage('No se pudo cargar el widget de Wompi. Revisa tu conexion o las credenciales de Wompi.');
      };

      form.appendChild(script);
      widgetRef.current.appendChild(form);

      const amount = checkout.checkout.widget.amountInCents / 100;
      setMessage(
        `Valor a pagar: ${amount.toLocaleString('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        })}. Usa el boton de Wompi que aparece abajo.`,
      );

      timeoutRef.current = setTimeout(() => {
        setLoading(false);
        setMessage('Wompi tardo demasiado en cargar. Revisa las credenciales de Wompi e intenta nuevamente.');
      }, 12000);
    } catch (err) {
      clearWidgetTimeout();
      setLoading(false);
      setMessage(err instanceof Error ? err.message : 'No se pudo preparar el pago con Wompi.');
    }
  }

  return (
    <div className="grid gap-2">
      <button
        onClick={pay}
        disabled={loading}
        className="rounded-full bg-yellowBrand px-4 py-2 text-sm font-black text-slate-950 disabled:opacity-60">
        {loading ? 'Preparando pago...' : 'Pagar con PSE / Wompi'}
      </button>
      {message && <p className="text-xs font-bold text-slate-500">{message}</p>}
      <div ref={widgetRef} className="grid gap-2" />
    </div>
  );
}

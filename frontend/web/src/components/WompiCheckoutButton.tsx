'use client';

import { useRef, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Checkout = {
  paymentId: string;
  status: 'PENDING';
  widget: {
    publicKey: string;
    currency: string;
    amountInCents: number;
    reference: string;
    expirationTime: string;
    signature: string;
    redirectUrl: string;
    customerData?: {
      email?: string;
      fullName?: string;
      phoneNumber?: string;
    };
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
        setMessage('No se pudo montar el botón de Wompi. Recarga la página e intenta nuevamente.');
        setLoading(false);
        return;
      }

      widgetRef.current.innerHTML = '';

      const form = document.createElement('form');
      const script = document.createElement('script');
      const widget = checkout.checkout.widget;
      script.src = 'https://checkout.wompi.co/widget.js';
      script.async = true;
      script.setAttribute('data-render', 'button');
      script.setAttribute('data-public-key', widget.publicKey);
      script.setAttribute('data-currency', widget.currency);
      script.setAttribute('data-amount-in-cents', String(widget.amountInCents));
      script.setAttribute('data-reference', widget.reference);
      script.setAttribute('data-expiration-time', widget.expirationTime);
      script.setAttribute('data-signature:integrity', widget.signature);
      script.setAttribute('data-redirect-url', widget.redirectUrl);

      if (widget.customerData?.email) script.setAttribute('data-customer-data:email', widget.customerData.email);
      if (widget.customerData?.fullName) script.setAttribute('data-customer-data:full-name', widget.customerData.fullName);
      if (widget.customerData?.phoneNumber) {
        script.setAttribute('data-customer-data:phone-number', widget.customerData.phoneNumber);
        script.setAttribute('data-customer-data:phone-number-prefix', '+57');
      }

      script.onload = () => {
        clearWidgetTimeout();
        setLoading(false);
      };

      script.onerror = () => {
        clearWidgetTimeout();
        setLoading(false);
        setMessage('No se pudo cargar Wompi. Revisa tu conexión o la configuración del comercio.');
      };

      form.appendChild(script);
      widgetRef.current.appendChild(form);

      const amount = widget.amountInCents / 100;
      setMessage(
        `Valor a pagar: ${amount.toLocaleString('es-CO', {
          style: 'currency',
          currency: 'COP',
          maximumFractionDigits: 0,
        })}. Completa el pago con el botón de Wompi que aparece abajo.`,
      );

      timeoutRef.current = setTimeout(() => {
        setLoading(false);
        setMessage('Wompi tardó demasiado en cargar. Intenta nuevamente.');
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
        {loading ? 'Preparando pago...' : 'Pagar con Wompi'}
      </button>
      {message && <p className="text-xs font-bold text-slate-500">{message}</p>}
      <div ref={widgetRef} className="grid gap-2" />
    </div>
  );
}

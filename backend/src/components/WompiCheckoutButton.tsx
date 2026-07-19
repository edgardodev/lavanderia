'use client';

import { useState } from 'react';
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

  async function pay() {
    setLoading(true);
    const checkout = await apiFetch<{ checkout: Checkout }>('/payments/wompi/checkout', {
      method: 'POST',
      body: JSON.stringify({ type, id }),
    });

    const form = document.createElement('form');
    const script = document.createElement('script');
    script.src = 'https://checkout.wompi.co/widget.js';
    script.setAttribute('data-render', 'button');
    script.setAttribute('data-public-key', checkout.checkout.widget.publicKey);
    script.setAttribute('data-currency', checkout.checkout.widget.currency);
    script.setAttribute('data-amount-in-cents', String(checkout.checkout.widget.amountInCents));
    script.setAttribute('data-reference', checkout.checkout.widget.reference);
    script.setAttribute('data-signature:integrity', checkout.checkout.widget.signature);
    script.setAttribute('data-redirect-url', checkout.checkout.widget.redirectUrl);
    form.appendChild(script);
    document.body.appendChild(form);
    setLoading(false);
  }

  return (
    <button onClick={pay} disabled={loading} className="rounded-full bg-yellowBrand px-4 py-2 text-sm font-black text-slate-900 disabled:opacity-60">
      {loading ? 'Preparando pago...' : 'Pagar con Wompi'}
    </button>
  );
}

import Link from 'next/link';
import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui';
import { legalConfig, legalConfigurationPending } from '@/lib/legal';

export default function PrivacyNoticePage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Card>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-aqua">Protección de datos personales</p>
          <h1 className="mt-3 font-title text-5xl text-slate-950">Aviso de privacidad</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">Versión {legalConfig.policyVersion}</p>

          {legalConfigurationPending && (
            <div className="mt-5 rounded-3xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
              Configuración legal pendiente para producción. Deben completarse razón social, NIT, dirección, teléfono y correos oficiales del responsable antes del lanzamiento.
            </div>
          )}

          <div className="mt-8 grid gap-6 text-sm leading-7 text-slate-700">
            <section>
              <h2 className="text-xl font-black text-slate-950">Responsable del tratamiento</h2>
              <p className="mt-2"><strong>{legalConfig.legalName}</strong> · identificación/NIT: {legalConfig.identification}.</p>
              <p>Dirección: {legalConfig.address}. Teléfono: {legalConfig.phone}. Correo para protección de datos: {legalConfig.privacyEmail}.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">Finalidades</h2>
              <p className="mt-2">
                Los datos serán tratados para crear y administrar la cuenta, autenticar al usuario, gestionar reservas y órdenes de lavandería, procesar pagos, coordinar recogidas o domicilios, enviar notificaciones operativas del servicio, atender soporte, prevenir fraude y abusos, mantener registros de seguridad y auditoría, cumplir obligaciones legales y atender consultas o reclamos de los titulares.
              </p>
              <p className="mt-2">
                Las comunicaciones promocionales son opcionales y se realizan únicamente cuando el titular las autoriza de forma separada.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">Derechos del titular</h2>
              <p className="mt-2">
                Puedes conocer, actualizar y rectificar tus datos; solicitar prueba de la autorización; ser informado sobre el uso dado a tus datos; presentar consultas o reclamos; solicitar supresión cuando proceda; y revocar autorizaciones cuando legalmente sea posible.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">Cómo ejercer tus derechos</h2>
              <p className="mt-2">
                Envía tu solicitud a <strong>{legalConfig.privacyEmail}</strong>, indicando tu nombre, medio de contacto, descripción clara de la solicitud y la información necesaria para verificar razonablemente tu identidad. La empresa tramitará consultas y reclamos conforme a los plazos y procedimientos previstos en la normativa colombiana aplicable.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">Política completa</h2>
              <p className="mt-2">
                Consulta la <Link href="/legal/privacy" className="font-black text-aqua underline">Política de Tratamiento de Datos Personales</Link> para conocer categorías de datos, encargados, transferencias/transmisiones, medidas de seguridad, conservación y procedimientos detallados.
              </p>
            </section>
          </div>
        </Card>
      </main>
    </>
  );
}

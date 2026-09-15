import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui';
import { legalConfig, legalConfigurationPending } from '@/lib/legal';

export default function TermsPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Card>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-aqua">Estatuto del Consumidor · Comercio electrónico</p>
          <h1 className="mt-3 font-title text-5xl text-slate-950">Términos y condiciones del servicio</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">Versión {legalConfig.termsVersion}</p>

          {legalConfigurationPending && (
            <div className="mt-5 rounded-3xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
              Antes del lanzamiento deben configurarse los datos reales del proveedor y los canales oficiales de atención.
            </div>
          )}

          <div className="mt-8 grid gap-7 text-sm leading-7 text-slate-700">
            <section>
              <h2 className="text-xl font-black text-slate-950">1. Proveedor</h2>
              <p className="mt-2"><strong>{legalConfig.legalName}</strong>, identificación/NIT {legalConfig.identification}, opera comercialmente como {legalConfig.tradeName}. Dirección: {legalConfig.address}. Teléfono: {legalConfig.phone}. Atención al consumidor: {legalConfig.customerServiceEmail}.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">2. Servicios</h2>
              <p className="mt-2">La plataforma permite reservar máquinas de autoservicio por sede, fecha y franja horaria, y solicitar servicios de lavandería asistida “Lo hacemos por ti”. Las características, precios, sede, horario, modalidad de recogida o domicilio y demás condiciones aplicables se muestran antes de confirmar cada solicitud.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">3. Reservas de autoservicio</h2>
              <p className="mt-2">Una máquina solo puede ser ocupada por una reserva o bloqueo administrativo en una misma franja. La selección mostrada en pantalla se vuelve a validar en el servidor al confirmar la reserva para evitar dobles asignaciones. Las reservas pendientes de pago pueden liberarse automáticamente si el intento de pago vence sin que Wompi haya registrado una transacción.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">4. Precios y pago</h2>
              <p className="mt-2">Los precios se informan en pesos colombianos antes de iniciar el pago. Cuando correspondan cargos adicionales —por ejemplo, domicilio o servicios especiales— deberán mostrarse antes de la aceptación de la transacción. Los pagos electrónicos se procesan mediante Wompi u otro proveedor expresamente informado.</p>
              <p className="mt-2">El navegador no determina por sí solo que un pago fue exitoso. La confirmación se produce cuando el proveedor de pagos notifica y el servidor valida el estado de la transacción.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">5. Confirmación de la operación</h2>
              <p className="mt-2">Antes de pagar, el usuario puede revisar la sede, máquina o tipo de servicio, fecha, horario, modalidad, datos de entrega y valor. La plataforma conservará trazabilidad de la solicitud, referencia de pago y estado de la operación para permitir consulta posterior.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">6. Cancelaciones, retracto y reversión</h2>
              <p className="mt-2">Las cancelaciones y devoluciones se analizarán según el estado del servicio, los costos ya causados y las normas imperativas de protección al consumidor. Los derechos de retracto y reversión del pago se respetarán cuando sean legalmente aplicables. Ninguna cláusula de estos términos limita derechos irrenunciables reconocidos por la legislación colombiana.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">7. Uso responsable de máquinas</h2>
              <p className="mt-2">El usuario debe utilizar las máquinas conforme a instrucciones de seguridad, capacidad, materiales permitidos y horarios de la sede. No podrá manipular componentes técnicos, intentar eludir bloqueos o reservas, ni usar la plataforma para interferir con disponibilidad de terceros.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">8. “Lo hacemos por ti” y evidencia</h2>
              <p className="mt-2">El personal podrá documentar condiciones relevantes de prendas o cargas —por ejemplo, manchas o daños preexistentes— mediante notas y fotografías de evidencia. Estas evidencias se usarán para trazabilidad del servicio y atención de posibles reclamaciones, con controles de acceso y conservación razonable.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">9. Domicilios</h2>
              <p className="mt-2">Cuando exista modalidad de domicilio, el usuario debe suministrar una dirección correcta y un medio razonable de contacto. Los costos, cobertura y condiciones de entrega deben mostrarse antes de confirmar la operación cuando sean aplicables.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">10. Cuenta y seguridad</h2>
              <p className="mt-2">Cada cuenta es personal. El usuario debe proteger sus credenciales y comunicar accesos no reconocidos. Las cuentas administrativas tienen controles reforzados, incluyendo MFA obligatorio. La plataforma puede bloquear temporalmente intentos de acceso que activen controles de seguridad.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">11. Atención, PQR y soporte</h2>
              <p className="mt-2">Las peticiones, quejas o reclamos de consumo pueden enviarse a <strong>{legalConfig.customerServiceEmail}</strong>. Las solicitudes relacionadas con datos personales deben dirigirse a <strong>{legalConfig.privacyEmail}</strong>.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">12. Legislación aplicable</h2>
              <p className="mt-2">Estos términos se interpretan conforme a la legislación colombiana, incluyendo las normas de protección al consumidor, comercio electrónico y protección de datos personales que resulten aplicables.</p>
            </section>
          </div>
        </Card>
      </main>
    </>
  );
}

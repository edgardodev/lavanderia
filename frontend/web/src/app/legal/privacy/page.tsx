import { AppHeader } from '@/components/AppHeader';
import { Card } from '@/components/ui';
import { legalConfig, legalConfigurationPending } from '@/lib/legal';

export default function PrivacyPolicyPage() {
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl px-6 py-12">
        <Card>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-aqua">Ley 1581 de 2012 · Protección de datos</p>
          <h1 className="mt-3 font-title text-5xl text-slate-950">Política de Tratamiento de Datos Personales</h1>
          <p className="mt-2 text-sm font-bold text-slate-500">Versión {legalConfig.policyVersion}</p>

          {legalConfigurationPending && (
            <div className="mt-5 rounded-3xl bg-amber-50 p-4 text-sm font-bold text-amber-800">
              Documento técnicamente preparado, pero faltan datos legales del responsable. Deben configurarse antes de producción.
            </div>
          )}

          <div className="mt-8 grid gap-7 text-sm leading-7 text-slate-700">
            <section>
              <h2 className="text-xl font-black text-slate-950">1. Responsable</h2>
              <p className="mt-2"><strong>{legalConfig.legalName}</strong>, identificación/NIT {legalConfig.identification}, con dirección {legalConfig.address}, teléfono {legalConfig.phone} y correo de protección de datos {legalConfig.privacyEmail}, es responsable del tratamiento de los datos personales recolectados a través de {legalConfig.tradeName}.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">2. Marco y principios</h2>
              <p className="mt-2">El tratamiento se realizará conforme a la Constitución Política, la Ley 1581 de 2012, el Decreto 1074 de 2015 y demás normas colombianas aplicables, observando principios de legalidad, finalidad, libertad, veracidad o calidad, transparencia, acceso y circulación restringida, seguridad y confidencialidad.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">3. Datos tratados</h2>
              <p className="mt-2">Podemos tratar nombre, correo electrónico, teléfono cuando sea suministrado, direcciones de domicilio cuando el usuario solicite entrega o recogida, datos de cuenta y seguridad, información de reservas y órdenes, estado de pagos, tokens de notificaciones, mensajes de soporte, fotografías de evidencia asociadas al servicio y registros técnicos de seguridad y auditoría.</p>
              <p className="mt-2">La plataforma no solicita cédula para crear una cuenta y no busca recolectar datos sensibles. Si una evidencia enviada durante la prestación del servicio contiene incidentalmente información personal, se limitará su tratamiento a la finalidad operativa que la originó.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">4. Finalidades</h2>
              <p className="mt-2">Los datos podrán ser utilizados para: crear y autenticar cuentas; administrar reservas de máquinas; gestionar órdenes de “Lo hacemos por ti”; procesar y conciliar pagos; prevenir doble reserva, fraude y abuso; coordinar domicilios; enviar notificaciones sobre el estado del servicio; conservar evidencia operativa; gestionar soporte, peticiones, consultas y reclamos; mantener trazabilidad y seguridad; cumplir obligaciones contables, contractuales y legales; y defender derechos en caso de controversia.</p>
              <p className="mt-2">El envío de publicidad o promociones es una finalidad separada y opcional. La negativa a recibir marketing no impide usar el servicio.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">5. Autorización y prueba</h2>
              <p className="mt-2">Cuando la autorización sea necesaria, se solicitará de manera previa, expresa e informada. La plataforma conserva evidencia electrónica de la decisión del titular, incluyendo tipo de consentimiento, versión de la política o términos, fecha, fuente de aceptación y huella criptográfica del texto aplicable.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">6. Encargados y proveedores tecnológicos</h2>
              <p className="mt-2">Para operar la plataforma pueden intervenir proveedores de infraestructura, almacenamiento de evidencias, notificaciones, seguridad, hosting y pagos, incluyendo servicios de Firebase/Google y Wompi cuando estén configurados. Estos terceros recibirán únicamente la información necesaria para la función contratada y deberán estar sujetos a condiciones contractuales y medidas de seguridad acordes con la normativa aplicable.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">7. Seguridad</h2>
              <p className="mt-2">Se aplican controles técnicos y organizativos como contraseñas con hash Argon2id, sesiones protegidas, MFA obligatorio para administradores, limitación y bloqueo de intentos de acceso, controles de autorización por rol, protección CSRF/CORS, auditoría de operaciones administrativas, almacenamiento privado de evidencias y copias o respaldos sujetos a controles de acceso. Ninguna medida elimina totalmente el riesgo, por lo que los controles se revisarán periódicamente.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">8. Conservación</h2>
              <p className="mt-2">Los datos se conservarán durante el tiempo necesario para prestar el servicio, resolver obligaciones o controversias, cumplir deberes legales y mantener registros de seguridad razonables. Cuando dejen de ser necesarios y no exista deber legal o contractual de conservarlos, se eliminarán o anonimizarán mediante procedimientos seguros.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">9. Derechos del titular</h2>
              <p className="mt-2">El titular puede conocer, actualizar y rectificar sus datos; solicitar prueba de la autorización; conocer el uso dado a la información; presentar quejas ante la Superintendencia de Industria y Comercio una vez agotado el trámite correspondiente; solicitar supresión cuando proceda; y revocar autorizaciones cuando legalmente sea posible.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">10. Consultas, reclamos y revocatorias</h2>
              <p className="mt-2">Las solicitudes se reciben en <strong>{legalConfig.privacyEmail}</strong>. Deben incluir identificación suficiente del titular, datos de contacto, descripción de los hechos o solicitud y, cuando corresponda, documentos de soporte. Se tramitarán conforme a los plazos previstos por la legislación colombiana aplicable.</p>
              <p className="mt-2">La autorización para marketing puede retirarse sin cancelar la cuenta. La revocatoria o supresión de datos indispensables para ejecutar servicios vigentes podrá hacerse efectiva una vez finalicen las obligaciones legales o contractuales que justifiquen su conservación.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">11. Menores de edad</h2>
              <p className="mt-2">La creación de cuentas está dirigida a personas mayores de edad. La plataforma no está diseñada para recolectar intencionalmente datos personales de niños, niñas o adolescentes mediante el registro de usuarios.</p>
            </section>

            <section>
              <h2 className="text-xl font-black text-slate-950">12. Vigencia y cambios</h2>
              <p className="mt-2">Esta versión entra en vigencia en la fecha indicada por su número de versión. Los cambios sustanciales que afecten finalidades o condiciones relevantes serán informados por medios razonables antes de aplicarse cuando la normativa lo exija.</p>
            </section>
          </div>
        </Card>
      </main>
    </>
  );
}

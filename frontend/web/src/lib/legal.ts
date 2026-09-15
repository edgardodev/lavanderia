export const legalConfig = {
  tradeName: 'La Lavandería & Bakery',
  legalName: process.env.NEXT_PUBLIC_LEGAL_ENTITY_NAME ?? 'PENDIENTE_CONFIGURAR_RAZON_SOCIAL',
  identification: process.env.NEXT_PUBLIC_LEGAL_ENTITY_ID ?? 'PENDIENTE_CONFIGURAR_NIT',
  privacyEmail: process.env.NEXT_PUBLIC_PRIVACY_CONTACT_EMAIL ?? 'PENDIENTE_CONFIGURAR_CORREO_PRIVACIDAD',
  customerServiceEmail: process.env.NEXT_PUBLIC_CUSTOMER_SERVICE_EMAIL ?? 'PENDIENTE_CONFIGURAR_CORREO_SERVICIO',
  address: process.env.NEXT_PUBLIC_LEGAL_ADDRESS ?? 'PENDIENTE_CONFIGURAR_DIRECCION',
  phone: process.env.NEXT_PUBLIC_LEGAL_PHONE ?? 'PENDIENTE_CONFIGURAR_TELEFONO',
  policyVersion: process.env.NEXT_PUBLIC_PRIVACY_POLICY_VERSION ?? '2026-09-15',
  termsVersion: process.env.NEXT_PUBLIC_TERMS_VERSION ?? '2026-09-15',
};

export const legalConfigurationPending = Object.values(legalConfig).some(
  (value) => typeof value === 'string' && value.startsWith('PENDIENTE_CONFIGURAR_'),
);

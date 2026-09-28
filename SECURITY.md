# Security Policy

## Supported code

Security fixes are applied to the production-preparation branch and must pass CI before release. Do not deploy an unreviewed commit directly to production.

## Reporting a vulnerability

Please report suspected vulnerabilities privately using **GitHub Security Advisories** for this repository. Do not open a public issue containing credentials, customer data, payment details, Firebase service-account material, Wompi secrets, JWTs, MFA secrets, recovery codes, database credentials, or exploit details that could put users at risk.

When possible, include:

- the affected route or component;
- the minimal steps needed to reproduce the issue;
- the security impact;
- whether authentication is required;
- a sanitized request/response example without secrets or personal data.

## Secret handling

Secrets must stay outside Git and be supplied through the deployment provider's secret manager or environment configuration. If a secret is exposed, rotate it at the provider immediately and invalidate affected sessions or credentials as appropriate.

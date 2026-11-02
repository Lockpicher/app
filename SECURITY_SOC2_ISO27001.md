# Segundo Cerebro — Matriz de Hardening de Seguridad (SOC 2 & ISO/IEC 27001:2022)

Este documento certifica y describe la implementación técnica del endurecimiento de seguridad (*hardening*) aplicado en **Segundo Cerebro** (`app.kubbonet.com`) siguiendo los estándares **SOC 2 Type II (Trust Services Criteria)** y la norma internacional **ISO/IEC 27001:2022 (Anexo A)**.

---

## 1. Mapeo de Controles Normativos y Evidencias Técnicas

| Control ISO 27001:2022 | Criterio SOC 2 | Dominio de Seguridad | Implementación en Segundo Cerebro | Archivo de Código |
|---|---|---|---|---|
| **A.8.20** Seguridad en redes | **CC6.6** Protección perimetral | Cabeceras HTTP estrictas | Inyección de CSP, HSTS, X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Permissions-Policy | `src/lib/apiGuard.mjs`, `server.mjs` |
| **A.8.15** Registro de eventos | **CC7.2 / CC7.3** Detección y monitoreo | Auditoría inmutable (SIEM) | Registro append-only en `security_audit.log` y tabla `security_audit_logs` en PostgreSQL | `src/lib/auditLogger.mjs`, `server.mjs` |
| **A.5.15** Control de acceso | **CC6.1 / CC6.2** Autenticación y credenciales | Cookies HttpOnly y sesiones | Token de sesión firmado, cookie `sb_session` con `HttpOnly; SameSite=Lax; Secure`, borrado seguro al salir | `server.mjs`, `src/lib/auth.ts` |
| **A.8.24** Criptografía | **CC6.6 / CC6.7** Protección de datos en reposo y tránsito | Hashing y Web Crypto | Hash SHA-256 con salt dinámico, verificación en tiempo constante (`timingSafeEqual`) contra ataques de temporización | `src/lib/security.ts` |
| **A.8.20** Limitación de tráfico | **CC7.1** Prevención de Denegación de Servicio (DoS) | Rate Limiting multi-nivel | Rate limiters por IP en memoria para auth (10/min), IA (30/min), transcripción (10/min) y API general (120/min) | `server.mjs`, `src/lib/apiGuard.mjs` |
| **A.8.28** Codificación segura | **CC6.6 / CC6.8** Prevención de inyecciones | Validación anti-SSRF y límites de carga | Bloqueo estricto de IPs privadas (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 127.0.0.1, AWS 169.254.169.254) y límite de buffer | `src/lib/webScraperServer.ts`, `src/lib/apiGuard.mjs` |
| **A.8.12** Fuga de datos | **CC6.8** Prevención de divulgación | Ocultamiento de cabeceras y errores sanitizados | Eliminación de `X-Powered-By`, supresión de trazas internas en producción (`sendSafeError`), ofuscación de claves en logs | `src/lib/apiGuard.mjs`, `src/lib/auditLogger.mjs` |
| **A.5.15** Cierre por inactividad | **CC6.1** Bloqueo de sesiones inactivas | Idle Session Timeout | Expiración automática y bloqueo de notas protegidas tras 30 minutos sin actividad del usuario | `src/lib/security.ts` |

---

## 2. Detalle de los Pilares de Hardening

### A. Cabeceras de Seguridad HTTP (Defense-in-Depth)
El servidor inyecta en cada respuesta HTTP las siguientes cabeceras:
- **Content-Security-Policy (CSP):** Restringe la ejecución de scripts a orígenes de confianza (`'self'`, blobs locales), aísla recursos tipográficos y bloquea cualquier intento de inclusión en marcos externos (`frame-ancestors 'none'`).
- **Strict-Transport-Security (HSTS):** `max-age=63072000; includeSubDomains; preload` garantiza que los navegadores solo se comuniquen mediante TLS/HTTPS cifrado.
- **X-Frame-Options:** `DENY` previene vulnerabilidades de *Clickjacking*.
- **X-Content-Type-Options:** `nosniff` bloquea ataques basados en interpretación errónea de tipos MIME (MIME-sniffing).
- **Referrer-Policy:** `strict-origin-when-cross-origin` previene el escape de URLs internas hacia terceros.
- **Permissions-Policy:** Desactiva accesos de hardware no requeridos (`camera=(), payment=(), usb=()`) y acota estrictamente el micrófono y geolocalización al propio dominio (`self`).

### B. Auditoría y Trazabilidad de Seguridad (Audit Logging)
Los eventos críticos de seguridad generan una traza estructurada con:
- Marca de tiempo UTC (ISO 8601).
- Identificador de usuario y dirección IP del cliente.
- Tipo de evento (`AUTH_LOGIN_SUCCESS`, `AUTH_LOGIN_FAILED`, `RATE_LIMIT_EXCEEDED`, `SSRF_ATTEMPT_BLOCKED`, `PAYLOAD_TOO_LARGE`).
- Recurso solicitado y resultado.
- **Redacción automática:** Contraseñas, claves de API, tokens de autenticación y cabeceras de autorización son reemplazados automáticamente por `[REDACTED]` antes de almacenarse en `security_audit.log` o la tabla PostgreSQL `security_audit_logs`.

### C. Protección de Contraseñas y Criptografía
- **Salt estático y SHA-256:** En [security.ts](file:///C:/Antigravity/src/lib/security.ts), las contraseñas de notas y cuadernos no se almacenan en texto plano ni con hashes simples. Se aplica un salt robusto antes de la digestión SHA-256.
- **Mitigación de Timing Attacks:** La función `timingSafeEqual()` compara los caracteres utilizando operaciones XOR bit a bit en tiempo constante, impidiendo que un atacante deduzca la longitud o prefijo de una contraseña midiendo el tiempo de respuesta en microsegundos.
- **Idle Timeout:** Se supervisa la inactividad en la pestaña; superados los 30 minutos, las notas protegidas se bloquean de nuevo en la memoria de sesión.

### D. Protección contra Ataques SSRF y DoS
- **Validación anti-SSRF:** La ingesta de páginas web e importación de artículos mediante [webScraperServer.ts](file:///C:/Antigravity/src/lib/webScraperServer.ts) bloquea conexiones dirigidas a `localhost`, bucles invertidos, metadatos de proveedores cloud (`169.254.169.254`) y todos los rangos RFC 1918 de redes internas.
- **Límites de tamaño en buffers:** Peticiones HTTP excesivas se drenan de forma controlada y responden `413 PAYLOAD_TOO_LARGE` sin colapsar el hilo de Node.js.
- **Rate Limiting por IP:** Cada endpoint sensible posee un límite de peticiones por ventana de tiempo configurado con retroalimentación vía cabecera estándar `Retry-After`.

---

## 3. Instrucciones de Despliegue en EasyPanel / Docker

Para mantener el nivel de cumplimiento en producción:
1. Asegurar que EasyPanel o el balanceador Nginx/Traefik tenga activado SSL/TLS.
2. Pasar la cabecera `X-Forwarded-Proto: https` para que el servidor Node active el flag `Secure` en las cookies de sesión.
3. Configurar la base de datos PostgreSQL de InsForge y opcionalmente Redis para caché de alta velocidad.

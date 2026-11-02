const fs = require('fs');
const path = require('path');

const targetFile = path.resolve('src/lib/webScraperServer.ts');
let code = fs.readFileSync(targetFile, 'utf8');

if (!code.includes("import { logSecurityEvent")) {
  code = code.replace(
    "import net from 'net';",
    "import net from 'net';\nimport { logSecurityEvent, AuditEventType, AuditSeverity } from './auditLogger.mjs';"
  );
}

const oldSsrfBlock = `        // 1. Verificación estricta SSRF
        const urlCheck = isAllowedUrl(targetUrl);
        if (!urlCheck.allowed) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: urlCheck.reason || 'URL no permitida por seguridad.' }));
          return;
        }`;

const newSsrfBlock = `        // 1. Verificación estricta SSRF (ISO 27001 A.8.20 / SOC 2 CC6.6)
        const urlCheck = isAllowedUrl(targetUrl);
        if (!urlCheck.allowed) {
          logSecurityEvent({
            eventType: AuditEventType.SSRF_ATTEMPT_BLOCKED,
            severity: AuditSeverity.SECURITY_ALERT,
            resource: targetUrl,
            details: { reason: urlCheck.reason },
            req
          });
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: urlCheck.reason || 'URL no permitida por seguridad.' }));
          return;
        }`;

code = code.replace(oldSsrfBlock, newSsrfBlock);

fs.writeFileSync(targetFile, code, 'utf8');
console.log('src/lib/webScraperServer.ts updated with SSRF audit logging!');

# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Profesionales, creadores de contenido, investigadores y pensadores independientes que necesitan gestionar su conocimiento personal (PKM), organizar lecturas, proyectos, reuniones, lugares y notas en un único espacio interconectado.

## Product Purpose

Proporcionar un "Segundo Cerebro" fluido, confiable y sin fricciones donde capturar ideas, almacenar lecturas con anotaciones, documentar viajes y lugares con mapas interactivos, grabar notas de voz embebidas en el texto y sintetizar información mediante un asistente de IA contextual.

## Positioning

Segundo Cerebro combina la flexibilidad de un editor de notas rico con un modelo de datos relacional de entidades especializadas (Personas, Lugares con mapa Leaflet, Libros con lector/fichas, Reuniones, Ideas), grabaciones de voz nativas en el cuerpo del texto, enlaces bidireccionales y un asistente de IA contextual multi-proveedor (Gemini, OpenRouter, Xiaomi MiMo) respaldado por InsForge PostgreSQL y Cloudflare R2.

## Operating Context

- Aplicación web responsive (escritorio y móvil).
- Contextos de uso: sesiones profundas de lectura y síntesis de notas, captura rápida de notas de voz en movimiento, gestión visual de cuadernos y entidades, geolocalización y mapas de lugares visitados o planificados.

## Capabilities and Constraints

- **Stack técnico**: React 18, Vite, TypeScript, Tailwind CSS 3.4 (bloqueado, no migrar a Tailwind v4), Lucide Icons, Leaflet / OpenStreetMap.
- **Backend**: InsForge BaaS (PostgreSQL con PostgREST), Cloudflare R2 para almacenamiento de archivos y audios.
- **IA**: Asistente contextual flotante con integración a Google Gemini, OpenRouter y Xiaomi MiMo.
- **Entidades soportadas**: Notas, Cuadernos, Páginas, Libros, Personas, Empresas, Reuniones, Recursos, Conceptos, Notas Atómicas, Viajes, Ideas, Lugares (Places).
- **Editor enriquecido**: Tablas dinámicas (inserción y eliminación de filas/columnas arbitrarias), inserción de notas de voz con reproductor inline, pegado avanzado desde Word/Google Docs/Web conservando formato.
- **Relaciones**: Vínculos universales bidireccionales (`links`) entre cualquier entidad del sistema.

## Brand Commitments

- Nombre: Segundo Cerebro (`app.kubbonet.com`).
- Tono: Profesional, enfocado, ordenado, moderno y respetuoso con la privacidad de los datos del usuario.
- Temas: Soporte estricto para modo claro y modo oscuro en toda la interfaz.

## Evidence on Hand

- Código fuente en ejecución en `c:\Antigravity` y servidor de desarrollo activo en `http://localhost:3000`.
- Módulos operativos de Notas, Cuadernos, Entidades (incluyendo Lugares con mapas interactivos), Asistente IA contextual y soporte multimedia.

## Product Principles

1. **Conexión sobre aislamiento**: Cada nota, persona, lugar o libro puede vincularse bidireccionalmente con cualquier otro elemento.
2. **Captura sin fricción**: Permitir grabar audio inline, pegar contenido complejo sin romper formatos y registrar ideas de inmediato.
3. **Claridad y densidad equilibrada**: Interfaz limpia, altamente escaneable y rápida, sin sobrecargar la pantalla de elementos superfluos.
4. **Inteligencia asistiva, no invasiva**: El asistente de IA acompaña y enriquece el contexto del usuario cuando se le solicita, sin entorpecer la lectura o edición.
5. **Estabilidad y preservación de datos**: Ninguna modificación de interfaz o refactorización debe poner en riesgo las notas y relaciones existentes.

## Accessibility & Inclusion

- Contraste legible según pautas WCAG AA en modos claro y oscuro.
- Soporte para navegación accesible por teclado en modales, selectores y editores.
- Etiquetas claras en controles interactivos y alternativas textuales para elementos visuales.

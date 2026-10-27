# Instrucciones para trabajar en este repositorio

Antes de hacer cualquier cosa, leé estos tres archivos de la raíz:

1. `CONTEXTO.md`: qué es el sistema, arquitectura, reglas de negocio y forma de trabajo acordada.
2. `ESTADO.md`: estado actual, versión en producción, datos, punto de restauración y pendientes.
3. `CHANGELOG.md`: historial de cambios.

## Reglas

- **Después de cada cambio publicado** (commit + push + deploy), actualizá en el mismo commit o en uno inmediato:
  - `CHANGELOG.md`: una entrada arriba de todo, con fecha, commit y qué cambió en palabras simples.
  - `ESTADO.md`: versión en producción, lo que funciona, los datos si cambiaron y los pendientes.
  - `CONTEXTO.md`: solo si cambió la arquitectura, una regla de negocio o la forma de trabajo.
- **Restauraciones y backups manuales en producción:** también van al CHANGELOG y al ESTADO.
- **El repositorio es público:** nunca escribas contraseñas, tokens, IP/puertos del servidor ni datos personales en estos archivos ni en el código.
- **Idioma:** el dueño de la tienda escribe en español rioplatense. Respondé y documentá en ese idioma.

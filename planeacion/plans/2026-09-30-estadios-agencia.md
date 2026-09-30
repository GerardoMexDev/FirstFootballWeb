# Nombres de estadios de la agencia — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Mostrar estadio y ciudad como los usa la agencia (Excel de Gerardo) cuando el partido es en la cancha habitual del local (opción a), sin tocar el front.

**Architecture:** Tabla `estadios_equipo` sembrada desde `supabase/datos/estadios-agencia.json` (Excel + equivalencias revisadas a mano: alias de equipo y nombres de fuente de su cancha habitual). Trigger `before insert or update` en `partidos` que reemplaza estadio/ciudad cuando el local tiene fila y la fuente trae un nombre de su cancha habitual (o nada). Corrección única de los partidos cargados.

**Spec:** `planeacion/specs/2026-09-30-copas-espn-y-estadios.md` (Parte 2)

## Global Constraints

- Opción a: si la fuente trae OTRA cancha (Centenario, neutral, mudanza), se respeta la fuente.
- Comparaciones sin distinguir mayúsculas y con espacios recortados; los acentos cuentan (los alias y nombres ya traen las variantes).
- La tabla no la lee el front: sin permisos para anon/authenticated (el trigger es security definer).
- Claude no aplica migraciones (§10b).

## Review Focus

1. Racing (Montevideo) de local contra Peñarol en el Centenario → queda "Estadio Centenario".
2. Partido de Toluca en su cancha con "Estadio Nemesio Diez" (sin acento) → "Estadio Nemesio Díez", ciudad "Toluca".
3. Local sin fila (Al-Qadisiyah, rivales de copa) → sin cambio.
4. Re-sync con el nombre de la fuente después de la corrección → vuelve a quedar el de la agencia (idempotente).
5. Estadio vacío → el de la agencia (respaldo).

### Task 1: Migración `0034` + tests de base

- [ ] Tests `scripts/estadios.test.mjs` (ROLLBACK): los 5 casos del Review Focus + la siembra (102 filas, sin alias repetidos) + anon/authenticated no leen la tabla. Ver que fallan (ENOENT).
- [ ] `supabase/migrations/0034_estadios_agencia.sql` generada desde el JSON (tabla, RLS, siembra, trigger, corrección única). Tests en verde; `test:tickets`, `test:copas-espn` y `test:espn-uruguay` siguen en verde.
- [ ] Commit.

### Task 2: Aplicar + verificar + QA

- [ ] Gerardo aplica 0034. Verificación: próximos de Match Day antes/después (ningún estadio perdido; "Mexico City Stadium" → "Estadio Azteca" para América, etc.).
- [ ] QA en dev: tarjetas, panel y Copiar con los nombres de la agencia. Avances. Revisión final, merge, push, QA en prod.

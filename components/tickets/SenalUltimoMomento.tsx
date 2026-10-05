/**
 * Señal "Último momento" (0040): el partido apareció en la web después de su fecha límite
 * normal (2 días antes), p. ej. un amistoso que la fuente publicó el día antes. Su ticket vence
 * el mismo día del partido. Estilos `.um` en app.css.
 *
 * Football First. Creado 2026-10-05.
 */
export function SenalUltimoMomento() {
  return (
    <span className="um" title="Este partido apareció con poca anticipación: el diseño vence el mismo día del partido.">
      <span aria-hidden="true">⚡</span> Último momento
    </span>
  );
}

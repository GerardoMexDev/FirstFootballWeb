/**
 * Lucecita roja + texto ("Ticket pendiente" / "Para revisar" / "Para publicar") para que
 * cada uno vea dónde tiene algo que hacer (pedido de Gerardo 2026-09-29). La luz late unos
 * segundos al aparecer y queda fija (WCAG 2.2.2: nada parpadea más de 5 s sin poder
 * pararlo); con `prefers-reduced-motion` no se mueve. El texto va siempre: ni el color ni
 * el movimiento son la única señal. Estilos `.tka` en app.css.
 *
 * Football First. Creado 2026-09-29.
 */
export function AlertaTicket({ texto }: { texto: string }) {
  return (
    <span className="tka">
      <span className="tka__luz" aria-hidden="true" />
      {texto}
    </span>
  );
}

/**
 * Cartel de avisos del sistema, arriba de cada vista, solo para el Administrador (el layout no
 * lo pide para otros cargos y la base tampoco se los devuelve): "La fuente de … no se actualiza
 * desde el dd/mm", "Traspaso detectado: …". Usa el `.aviso` de la demo. Sin avisos, no se ve.
 *
 * Football First. Creado 2026-09-30.
 */
import { Ico } from '@/components/comunes/Ico';
import type { AvisoSistema } from '@/lib/sistema/avisos-sistema';

export function AvisosSistema({ avisos }: { avisos: AvisoSistema[] }) {
  if (!avisos.length) return null;
  return (
    <section className="avs" aria-label="Avisos del sistema">
      {avisos.map((a) => (
        <div key={a.clave} className="aviso">
          <Ico nombre="alerta" clase="ico ico--sm" />
          <span>{a.texto}</span>
        </div>
      ))}
    </section>
  );
}

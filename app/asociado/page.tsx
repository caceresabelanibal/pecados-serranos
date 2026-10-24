import type { Metadata } from "next";
import PecadosPage from "../page";

// Acceso al perfil de revendedoras: pecadosserranos.com.ar/asociado
export const metadata: Metadata = {
  title: "Asociados · Pecados Serranos",
  robots: { index: false, follow: false },
};

export default function AsociadoPage() {
  return <PecadosPage />;
}

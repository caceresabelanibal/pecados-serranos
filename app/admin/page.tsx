import type { Metadata } from "next";
import PecadosPage from "../page";

// Acceso al panel de administración: pecadosserranos.com.ar/admin
export const metadata: Metadata = {
  title: "Administración · Pecados Serranos",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return <PecadosPage />;
}

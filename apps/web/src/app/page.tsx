import { redirect } from "next/navigation";

// Herramienta interna: la landing pública queda oculta. La raíz redirige
// directamente al login. El código de la landing se conserva en el historial.
export default function HomePage() {
  redirect("/login");
}

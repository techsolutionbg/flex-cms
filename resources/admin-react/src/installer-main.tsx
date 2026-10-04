import { createRoot } from "react-dom/client"
import { Toaster } from "sonner"
import { InstallerPage } from "@/pages/installer-page"
import "./index.css"

const root = document.getElementById("root")

if (!root) throw new Error("Installer root element is missing.")

createRoot(root).render(
  <>
    <Toaster position="top-center" closeButton richColors theme="light" />
    <InstallerPage />
  </>,
)

import Toastify from "toastify-js"
import "toastify-js/src/toastify.css"

export type ToastVariant = "success" | "error" | "info"

export function showToast(message: string, variant: ToastVariant = "info"): void {
  Toastify({
    text: message,
    duration: 4500,
    close: true,
    gravity: "top",
    position: "right",
    stopOnFocus: true,
    className: `flex-toast flex-toast-${variant}`,
  }).showToast()
}

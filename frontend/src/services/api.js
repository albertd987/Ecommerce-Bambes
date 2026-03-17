import axios from "axios"
import i18n from "@/i18n"

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  xsrfCookieName: "XSRF-TOKEN",
  xsrfHeaderName: "X-XSRF-TOKEN",
})

export const getCsrfToken = async () => {
  await api.get("/../sanctum/csrf-cookie")
}

export const register = async (userData) => {
  await getCsrfToken()
  const { data } = await api.post("/register", userData)
  return data
}

export const login = async (credentials) => {
  await getCsrfToken()
  const { data } = await api.post("/login", credentials)
  return data
}

export const logout = async () => {
  const { data } = await api.post("/logout")
  return data
}

export const getCurrentUser = async () => {
  const { data } = await api.get("/user")
  return data
}

// ✅ checkout (IMPORTANT: rep payload)
export const createPaymentIntent = async (payload) => {
  const { data } = await api.post("/checkout/intent", payload)
  return data
}

export const changePassword = async (payload) => {
  // payload: { current_password, password, password_confirmation }
  const response = await api.put("/user/password", payload)
  return response.data
}

export const resendVerification = async () => {
  await getCsrfToken()
  const { data } = await api.post("/email/verification-notification")
  return data
}

api.interceptors.request.use((config) => {
  const lang = i18n.language || localStorage.getItem("lang") || "ca"
  config.headers["Accept-Language"] = lang
  return config
})

export const downloadInvoice = async (orderId) => {
  try {
    const lang = i18n.language?.startsWith("en") ? "en" : "ca"

    const response = await api.get(`/orders/${orderId}/invoice`, {
      responseType: "blob",
      headers: {
        Accept: "application/pdf",
      },
      params: {
        lang,
      },
    })

    const blob = new Blob([response.data], { type: "application/pdf" })
    const url = window.URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = lang === "en"
      ? `invoice-order-${orderId}.pdf`
      : `factura-comanda-${orderId}.pdf`

    document.body.appendChild(link)
    link.click()
    link.remove()

    window.URL.revokeObjectURL(url)
  } catch (error) {
    if (error?.response?.data instanceof Blob) {
      const text = await error.response.data.text()
      try {
        const json = JSON.parse(text)
        throw new Error(json.error || json.message || "Error descarregant factura")
      } catch {
        throw new Error(text || "Error descarregant factura")
      }
    }

    throw error
  }
}


export default api

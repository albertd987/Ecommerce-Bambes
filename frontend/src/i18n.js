import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import ca from "./locales/ca.json"
import en from "./locales/en.json"

const STORAGE_KEY = "lang"

const saved = localStorage.getItem(STORAGE_KEY)
const defaultLang = saved || "ca" // ✅ per defecte català

i18n.use(initReactI18next).init({
  resources: {
    ca: { translation: ca },
    en: { translation: en },
  },
  lng: defaultLang,
  fallbackLng: "ca",
  interpolation: {
    escapeValue: false,
  },
  returnEmptyString: false,
})

export const setLanguage = (lang) => {
  localStorage.setItem(STORAGE_KEY, lang)
  i18n.changeLanguage(lang)
}

export default i18n
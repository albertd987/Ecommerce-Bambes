import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import "./i18n"
import "leaflet/dist/leaflet.css"

import { CartProvider } from "@/context/cart-context";
import { AuthProvider } from "./context/auth-context.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
    <CartProvider>
      <App />
    </CartProvider>
    </AuthProvider>
  </React.StrictMode>
);

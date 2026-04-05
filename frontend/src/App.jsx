import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Toaster } from "sonner"
import HomePage from "./pages/HomePage"
import CartPage from "./pages/CartPage"
import CheckoutPage from "./pages/CheckoutPage"
import CheckoutSuccessPage from "./pages/CheckoutSuccessPage"
import ProductDetailPage from "@/pages/ProductDetailPage"
import LoginPage from "./pages/LoginPage"
import RegisterPage from "./pages/RegisterPage"
import ProfilePage from "./pages/ProfilePage"
import OrdersPage from "./pages/OrdersPage"
import OrderDetailPage from "./pages/OrderDetailPage"
import ChangePasswordPage from "./pages/ChangePasswordPage"
import VerifyEmailPage from "./pages/VerifyEmailPage"
import AboutPage from "@/pages/AboutPage"
import FavoritesPage from "@/pages/FavoritesPage"
import AddressesPage from "@/pages/AddressesPage"
import ProfileEditPage from "@/pages/ProfileEditPage"
import ChatbotWidget from './components/ChatbotWidget'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
        <Route path="/products/:id" element={<ProductDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/change-password" element={<ChangePasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/addresses" element={<AddressesPage />} />
        <Route path="/profile/edit" element={<ProfileEditPage />} />
      </Routes>
      <Toaster position="bottom-right" richColors theme="light" />
      <ChatbotWidget />
    </BrowserRouter>
  )
}

export default App

import { useState, useEffect } from 'react'
import api from '../services/api'
import ProductCard from '../components/ProductCard'
import Header from '../components/Header'

export default function HomePage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    api.get('/products')
      .then(response => {
        setProducts(response.data.data)
        setLoading(false)
      })
      .catch(err => {
        console.error('Error:', err)
        setError(err.message)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-20">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
            <p className="mt-4 text-muted-foreground">Carregant productes...</p>
          </div>
        </div>
      </>
    )
  }

  if (error) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-20">
          <div className="text-center">
            <p className="text-destructive text-lg">Error: {error}</p>
            <p className="text-muted-foreground mt-2">
              Assegura't que el backend està executant-se
            </p>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Running Shoes Store
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Descobreix les millors sabatilles de running per professionals i aficionats
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </main>
    </>
  )
}
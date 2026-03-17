import { Link } from 'react-router-dom'

export default function ProductCard({ product }) {
  return (
    <Link to={`/products/${product.id}`} className="group block">
      <div className="aspect-square overflow-hidden bg-[#f5f5f5] rounded-lg mb-2">
        <img
          src={product.thumbnail || 'https://via.placeholder.com/400x400/e5e7eb/6b7280?text=No+Image'}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      <div className="space-y-0.5">
        {product.brand && (
          <p className="text-xs text-orange-600 font-medium">{product.brand}</p>
        )}
        <h3 className="font-medium text-[13px] leading-tight text-foreground">
          {product.name}
        </h3>
        {product.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {product.description}
          </p>
        )}
        <p className="text-[13px] font-medium text-foreground mt-0.5">
          {product.price} €
        </p>
      </div>
    </Link>
  )
}

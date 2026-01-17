import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

export default function ProductCard({ product }) {
  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="aspect-square overflow-hidden bg-muted">
        <img 
          src={product.thumbnail || 'https://via.placeholder.com/400x400/e5e7eb/6b7280?text=No+Image'} 
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      
      <CardContent className="p-4">
        <Badge variant="secondary" className="mb-2">
          {product.brand}
        </Badge>
        <h3 className="font-semibold text-lg leading-tight mb-2 line-clamp-2">
          {product.name}
        </h3>
        <p className="text-2xl font-bold">
          {product.price}€
        </p>
      </CardContent>
      
      <CardFooter className="p-4 pt-0">
        <Button className="w-full" size="lg">
          Veure detall
        </Button>
      </CardFooter>
    </Card>
  )
}
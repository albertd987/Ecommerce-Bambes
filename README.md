#  Ecommerce Bambes

Botiga online especialitzada en bambes de running i atletisme.

##  Stack Tecnològic

- **Backend:** Laravel 11 + Lunar + Stripe
- **Frontend:** React 18 + Vite + React Router
- **Base de dades:** MySQL 8

##  Equip

- **Frontend:** Albert Domènech
- **Backend:** David Diaz

##  Instalació

### Backend
```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan serve
```

URL: http://localhost:8000

### Frontend
```bash
cd frontend
npm install
npm run dev
```

URL: http://localhost:5173

##  Documentació

- [Git Workflow](docs/GUIA_GIT_WORKFLOW.md)
- [Contracte d'API](docs/api-contract.md)

##  Estat del projecte

- [x] Setup inicial
- [ ] API de productes
- [ ] Frontend catàlog
- [ ] Sistema d'autenticació
- [ ] Carrito de compra
- [ ] Integració amb Stripe
- [ ] Deploy

---

**Projecte:** Treball final de DAW  
**Període:** Gener - Maig 2026

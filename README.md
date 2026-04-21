# Ecommerce Bambes

Botiga online especialitzada en bambes de running i atletisme.

Aquest projecte és una aplicació web completa desenvolupada com a treball final de DAW, amb arquitectura separada entre frontend i backend.

---

## Stack tecnològic

### Backend
- Laravel 11
- Lunar (gestió e-commerce / backoffice)
- Stripe (pagaments)
- Laravel Mail (emails)
- MySQL 8

### Frontend
- React 18
- Vite
- React Router
- TailwindCSS
- i18next (multidioma)

---

## Equip

-  Albert Domènech Obiol
-  David Diaz Hernández

---

## Arquitectura

L'aplicació segueix una arquitectura client-servidor:

Usuari (browser)  
→ Frontend (React)  
→ API REST (Laravel)  
→ Base de dades (MySQL)  

El frontend no accedeix directament a la base de dades, sinó que es comunica amb el backend mitjançant peticions HTTP.

---

## Instal·lació i execució

### 1. Clonar el projecte

```bash
git clone https://github.com/albertd987/Ecommerce-Bambes.git
cd Ecommerce-Bambes
```

---

### 2. Backend (Laravel)

Entrar a la carpeta:

```bash
cd backend
```

Instal·lar dependències:

```bash
composer install
```

Configurar entorn:

```bash
cp .env.example .env
php artisan key:generate
```

Configurar base de dades al fitxer `.env`:

```env
DB_DATABASE=bambes
DB_USERNAME=root
DB_PASSWORD=
```

Executar migracions i dades inicials:

```bash
php artisan migrate --seed
```

Executar backend:

Si s’utilitza Herd:
- Obrir la carpeta `backend`
- Herd servirà el projecte automàticament

URL habitual:
```
http://ecommerce-bambes.test
```

Alternativa sense Herd:

```bash
php artisan serve
```

---

### 3. Frontend (React)

Entrar a la carpeta:

```bash
cd ../frontend
```

Instal·lar dependències:

```bash
npm install
```

Crear fitxer `.env`:

```env
VITE_API_URL=http://ecommerce-bambes.test/api
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
```

Executar aplicació:

```bash
npm run dev
```

URL:
```
http://localhost:5173
```

---

## Backoffice (Lunar)

El projecte utilitza Lunar com a sistema de gestió e-commerce dins del backend.

Accés al panell:

```
http://ecommerce-bambes.test/admin
```

Funcionalitats:
- Gestió de productes
- Categories
- Variants
- Clients
- Comandes

---

## Funcionalitats principals

### Usuari
- Registre i login
- Verificació de correu
- Recuperació de contrasenya
- Perfil d’usuari


### E-commerce
- Catàleg de productes
- Carret de compra
- Favorits
- Checkout

### Pagament
- Integració amb Stripe
- Confirmació de pagament
- Generació de comanda

### Comandes
- Historial de comandes
- Detall de comanda
- Descàrrega de factura en PDF

### Emails
- Confirmació de compra
- Recuperació de contrasenya
- Verificació d’email

### Multidioma
- Català
- Anglès
- Canvi dinàmic amb i18next

---

## Comunicació frontend-backend

El frontend es comunica amb el backend mitjançant una API REST.

Exemple de petició:

```
POST /api/checkout/intent
```

Flux:
1. El frontend envia dades
2. El backend processa la lògica
3. Retorna resposta en JSON
4. El frontend actualitza la interfície

---

## Sistema de pagament (Stripe)

Flux de compra:

1. L’usuari afegeix productes al carret  
2. El frontend envia dades al backend  
3. El backend crea un PaymentIntent (Stripe)  
4. Stripe retorna un client_secret  
5. El frontend mostra el formulari de pagament  
6. L’usuari realitza el pagament  
7. El backend confirma la comanda  

---

## Configuració de correu

Exemple de configuració al `.env`:

```env
MAIL_MAILER=smtp
MAIL_HOST=smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=xxxx
MAIL_PASSWORD=xxxx
MAIL_ENCRYPTION=null
MAIL_FROM_ADDRESS="noreply@bambes.com"
MAIL_FROM_NAME="Bambes"
```

---

## Documentació

- docs/GUIA_GIT_WORKFLOW.md  
- docs/api-contract.md  

---

## Problemes comuns

No funciona el backend:
- Revisar `.env`
- Comprovar connexió amb la base de dades

No funciona el frontend:
- Revisar `VITE_API_URL`

No s’envien correus:
- Revisar configuració `MAIL_*`

Stripe no funciona:
- Revisar `VITE_STRIPE_PUBLISHABLE_KEY`

---

## Estat del projecte

- Setup inicial complet
- API de productes implementada
- Frontend de catàleg complet
- Sistema d’autenticació funcional
- Carret de compra implementat
- Integració amb Stripe completada
- Sistema de comandes funcional
- Deploy realitzat a un servidor real

---

## Informació del projecte

Projecte final de DAW  
Període: Gener - Maig 2026
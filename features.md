# Features pendents - Ecommerce Bambes

## Prioritat alta

### Checkout i pagaments
- [x] Recollida de dades del client al checkout (nom, email, telèfon)
- [x] Adreces de facturació i enviament
- [x] Càlcul real de costos d'enviament (tarifa plana 4.99€)
- [x] Càlcul real d'impostos (IVA 21%)
- [x] Validació d'stock al checkout + descompte d'stock en confirmar

### Usuari
- [x] Verificació d'email
- [ ] Recuperació de contrasenya (forgot/reset password)
- [ ] Edició de perfil (nom, email, contrasenya)
- [ ] Gestió d'adreces guardades al perfil

---

## Prioritat mitjana

### Catàleg i filtres
- [x] Filtres funcionals a la HomePage (ara la UI existeix però no filtra)
  - [x] Filtre per preu (rang)
  - [x] Filtre per talla
  - [x] Filtre per color
  - [x] Filtre per marca
  - [x] Filtre per col·lecció (Trail, Asfalt, Pista, Mixt)
- [x] Ordenació funcional (preu asc/desc, nom, novetat)
- [x] Cerca de productes (barra de cerca)
- [x] Paginació de productes

### Comandes
- [ ] Estats de comanda reals (pendent, enviat, lliurat, cancel·lat)
- [ ] Emails de confirmació de comanda
- [ ] Cancel·lació de comanda

### Wishlist / Favorits
- [ ] Funcionalitat de favorits (ara el botó és placeholder)
- [ ] Pàgina de favorits de l'usuari

---

## Prioritat baixa

### UX / UI
- [ ] Responsive review complet (mòbil, tablet)
- [ ] Loading skeletons a les pàgines
- [x] Notificacions toast (afegir al carret, errors, etc.)
- [ ] Breadcrumbs dinàmics
- [ ] Traducció català / Anglès i18n

### Cloudinary
- [ ] Eliminar imatges de Cloudinary quan es borra un Media (MediaObserver.deleted)
- [ ] `directoryExists()` al CloudinaryAdapter

### SEO i rendiment
- [ ] Lazy loading d'imatges
- [ ] Cache de productes (backend)

### BackOffice de Lunar
- [x] Possibilitat de reordenar les imatges de media fent servir drag and drop (possible????)
---
> Aquest fitxer s'anirà actualitzant a mesura que s'afegeixin noves funcionalitats o es completin les existents.
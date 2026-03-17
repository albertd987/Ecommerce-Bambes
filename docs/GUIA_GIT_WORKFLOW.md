# Guia de Git Workflow - Ecommerce Bambes

> **Guia per treballar en equip sense trepitjar-se utilitzant Git i GitHub**
> Projecte: Laravel + React en Monorepo
> Equip: 2 desenvolupadors (Frontend + Backend)

---

## Taula de Continguts

1. [Estructura del Projecte](#estructura-del-projecte)
2. [Estratègia de Branches](#estratègia-de-branches)
3. [Setup Inicial](#setup-inicial)
4. [Workflow Diari](#workflow-diari)
5. [Convencions de Commits](#convencions-de-commits)
6. [Pull Requests](#pull-requests)
7. [Resolució de Conflictes](#resolució-de-conflictes)
8. [Comunicació](#comunicació)
9. [Comandes de Referència Ràpida](#comandes-de-referència-ràpida)
10. [Regles d'Or](#regles-dor)

---

## Estructura del Projecte

```
ecommerce-bambes/                  ← 1 repositori GitHub
│
├── backend/                       ← Codi Laravel (Company)
│   ├── app/
│   ├── routes/
│   ├── database/
│   ├── composer.json
│   └── README.md
│
├── frontend/                      ← Codi React (Tu)
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── README.md
│
├── docs/                          ← Documentació compartida
│   └── api-contract.md
│
├── .gitignore
└── README.md                      ← README principal
```

---

## Estratègia de Branches

### **Estructura de Branques:**

```
main (producció - PROTEGIDA)
│
└── develop (integració - on fem merge)
    │
    ├── feature/frontend-productes (Frontend Dev)
    ├── feature/frontend-carret (Frontend Dev)
    ├── feature/frontend-checkout (Frontend Dev)
    │
    ├── feature/backend-api-productes (Backend Dev)
    ├── feature/backend-api-carret (Backend Dev)
    └── feature/backend-stripe (Backend Dev)
```

### **Tipus de Branches:**

| Tipus | Nom | Propòsit | Qui |
|------|--------|-----------|-------|
| `main` | `main` | Codi estable, llest per producció | Ningú fa push directe |
| `develop` | `develop` | Integració de features | Ambdós (via PR) |
| Feature Frontend | `feature/frontend-*` | Nova funcionalitat frontend | Frontend Dev |
| Feature Backend | `feature/backend-*` | Nova funcionalitat backend | Backend Dev |
| Hotfix | `hotfix/*` | Correccions urgents | Qui ho detecti |

---

## Setup Inicial

### **Pas 1: Configuració del Repositori (Una sola vegada)**

```bash
# 1. Crear el projecte localment
mkdir ecommerce-bambes
cd ecommerce-bambes

# 2. Inicialitzar Git
git init
git branch -M main

# 3. Crear estructura de carpetes
mkdir backend frontend docs

# 4. Crear .gitignore
cat > .gitignore << 'EOF'
# Backend (Laravel)
backend/vendor/
backend/.env
backend/node_modules/
backend/storage/*.key
backend/.phpunit.result.cache

# Frontend (React)
frontend/node_modules/
frontend/dist/
frontend/.env
frontend/.env.local

# IDEs
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db
EOF

# 5. Crear README.md principal
cat > README.md << 'EOF'
# Ecommerce de Bambes

Botiga online de bambes de running construïda amb Laravel + React.

## Tecnologies

- **Backend:** Laravel 11 + Lunar + Stripe
- **Frontend:** React 18 + Vite + React Router
- **Base de dades:** MySQL 8

## Equip

- **Frontend:** [El teu nom]
- **Backend:** [Nom company]

## Instal·lació

Veure instruccions a:
- [Backend](backend/README.md)
- [Frontend](frontend/README.md)

## Documentació

- [Git Workflow](docs/GUIA_GIT_WORKFLOW.md)
- [Contracte d'API](docs/api-contract.md)
EOF

# 6. Connectar amb GitHub (crear repo a GitHub primer)
git remote add origin https://github.com/el-teu-usuari/ecommerce-bambes.git

# 7. Primer commit
git add .
git commit -m "chore: initial project structure"
git push -u origin main

# 8. Crear branca develop
git checkout -b develop
git push -u origin develop
```

### **Pas 2: Protegir la Branca Main a GitHub**

1. Ves a: **Settings** → **Branches** → **Add rule**
2. Branch name pattern: `main`
3. Activar:
   - Require a pull request before merging
   - Require approvals (1)
   - Dismiss stale pull request approvals when new commits are pushed
4. **Save changes**

### **Pas 3: Clonar el Projecte (Cada membre de l'equip)**

```bash
# Clonar el repositori
git clone https://github.com/el-teu-usuari/ecommerce-bambes.git
cd ecommerce-bambes

# Veure les branques disponibles
git branch -a

# Canviar a develop
git checkout develop
```

---

## Workflow Diari

### **OPCIÓ A: Workflow Pas a Pas (Recomanat per principiants)**

#### **1. En Començar el Dia:**

```bash
# Veure en quina branca estàs
git branch
# * develop (hauries d'estar aquí)

# Actualitzar develop amb els últims canvis
git checkout develop
git pull origin develop
```

#### **2. Crear la Teva Feature Branch:**

```bash
# FRONTEND:
git checkout -b feature/frontend-pagina-productes

# BACKEND:
git checkout -b feature/backend-api-productes
```

#### **3. Treballar en el Teu Codi:**

```bash
# FRONTEND - Edites arxius a frontend/
cd frontend
# ... crees components, edites pàgines, etc.

# BACKEND - Edites arxius a backend/
cd backend
# ... crees controladors, rutes, etc.
```

#### **4. Veure Què Has Canviat:**

```bash
# Veure arxius modificats
git status

# Veure canvis específics
git diff
```

#### **5. Guardar Canvis (Commit):**

```bash
# Afegir només LA TEVA carpeta
# FRONTEND:
git add frontend/

# BACKEND:
git add backend/

# O afegir arxius específics:
git add frontend/src/pages/ProductosPage.jsx

# Fer commit amb missatge descriptiu
git commit -m "feat(frontend): crear pàgina de llistat de productes"

# Veure l'historial
git log --oneline
```

#### **6. Pujar a GitHub:**

```bash
git push origin feature/frontend-pagina-productes
```

#### **7. Crear Pull Request a GitHub:**

1. Ves a GitHub → El teu repositori
2. Veuràs: **"Compare & pull request"** (botó verd)
3. Configurar:
   - **Base:** `develop`
   - **Compare:** `feature/frontend-pagina-productes`
4. Escriure descripció:
   ```markdown
   ## Descripció
   Implementa la pàgina de llistat de productes amb filtres bàsics.

   ## Canvis
   - `ProductosPage.jsx`: Component principal
   - `ProductCard.jsx`: Targeta de producte
   - `api.js`: Funció getProductos()

   ## Testing
   - Es mostren productes
   - Filtres funcionen
   - Pendent: integració amb API real

   ## Screenshots
   (opcional: afegir captures)
   ```
5. **Assignar revisor** (el teu company)
6. Click **"Create pull request"**

#### **8. Revisar i Fer Merge:**

**Company revisa:**
- Llegeix els canvis
- Prova localment si és necessari
- Aprova o demana canvis

**Fer Merge:**
- Click **"Merge pull request"**
- Click **"Confirm merge"**
- **Esborrar la branca** (botó "Delete branch")

#### **9. Actualitzar el Teu Develop Local:**

```bash
# Tornar a develop
git checkout develop

# Portar els canvis fusionats
git pull origin develop

# Esborrar la teva feature branch local (ja està fusionada)
git branch -d feature/frontend-pagina-productes
```

---

### **OPCIÓ B: Workflow Abreujat (Per quan tinguis pràctica)**

```bash
# Start
git checkout develop && git pull

# Work
git checkout -b feature/la-meva-feature
# ... editar codi ...

# Save
git add carpeta/
git commit -m "feat: missatge"
git push origin feature/la-meva-feature

# PR a GitHub → Merge

# Update
git checkout develop && git pull
git branch -d feature/la-meva-feature
```

---

## Convencions de Commits

### **Format:**

```
<tipus>(<scope>): <descripció curta>

<cos opcional>
```

### **Tipus:**

| Tipus | Ús | Exemple |
|------|-----|---------|
| `feat` | Nova funcionalitat | `feat(frontend): afegir pàgina de productes` |
| `fix` | Correcció de bug | `fix(backend): corregir validació d'estoc` |
| `style` | Canvis d'estil/format | `style(frontend): millorar CSS del header` |
| `refactor` | Refactorització | `refactor(backend): simplificar ProductController` |
| `docs` | Documentació | `docs: actualitzar README amb instruccions` |
| `test` | Tests | `test(backend): afegir tests de ProductAPI` |
| `chore` | Tasques menors | `chore: actualitzar dependències` |
| `perf` | Millores de rendiment | `perf(frontend): optimitzar renderitzat de llista` |

### **Scopes (opcional però recomanat):**

- `frontend` - Canvis a React
- `backend` - Canvis a Laravel
- `docs` - Documentació
- `config` - Configuració

### **Exemples Bons:**

```bash
git commit -m "feat(frontend): crear component ProductCard"
git commit -m "fix(backend): resoldre error 500 a /api/products"
git commit -m "style(frontend): responsive design per mòbils"
git commit -m "docs: afegir secció d'instal·lació al README"
git commit -m "refactor(backend): extreure lògica de pagament a service"
```

### **Exemples Dolents:**

```bash
git commit -m "canvis"
git commit -m "fix"
git commit -m "asdf"
git commit -m "més coses"
```

### **Work In Progress (WIP):**

Si necessites guardar canvis sense acabar:

```bash
git commit -m "wip(frontend): treball en progrés al checkout"
```

---

## Pull Requests

### **Quan Crear un PR:**

- Has acabat una feature completa
- El codi compila/funciona
- Has provat localment
- No esperis a tenir-ho tot perfecte (iteració és millor)

### **Template de PR:**

```markdown
## Descripció
Breu descripció del que fa aquesta feature

## Tipus de Canvi
- [ ] Nova feature
- [ ] Bug fix
- [ ] Refactorització
- [ ] Documentació

## Checklist
- [ ] El codi compila sense errors
- [ ] He provat localment
- [ ] He actualitzat la documentació (si aplica)
- [ ] Els commits segueixen les convencions

## Screenshots (opcional)
Si hi ha canvis visuals, afegir captures

## Relacionat
Issue #123 (si aplica)
```

### **Revisió de PRs:**

**Com a revisor:**
1. Llegeix la descripció
2. Revisa els arxius canviats a GitHub
3. Si tens dubtes, deixa comentaris
4. Si està bé, aprova
5. Si necessita canvis, sol·licita'ls

**No cal ser exhaustiu en aquest projecte**, però:
- Verifica que no trenqui res obvi
- Comprova que segueix les convencions
- Dona feedback constructiu

---

## Resolució de Conflictes

### **Quan Hi Ha Conflictes?**

```
ESCENARI:
1. Tu i el teu company editeu el mateix arxiu (ex: README.md)
2. El teu company fa merge primer
3. Quan intentes fer PR, Git diu: "CONFLICT"
```

### **Tipus de Situacions:**

#### **SENSE CONFLICTE (El més comú):**

```
TU                              COMPANY
│                               │
├─ Edites frontend/...          ├─ Edita backend/...
│                               │
└─ Push                         └─ Push

NO HI HA CONFLICTE (carpetes diferents)
```

#### **AMB CONFLICTE:**

```
TU                                      COMPANY
│                                       │
├─ Edites README.md (línia 10)          ├─ Edita README.md (línia 10)
│                                       │
├─ Push (primer)                        └─ Push (segon) CONFLICT!
```

### **Resoldre Conflictes (Pas a Pas):**

```bash
# 1. Intentes fer merge/pull
git pull origin develop

# 2. Git t'avisa:
# CONFLICT (content): Merge conflict in README.md
# Automatic merge failed; fix conflicts and then commit the result.

# 3. Obrir l'arxiu conflictiu (README.md)
# Veuràs alguna cosa com:

<<<<<<< HEAD
## Instal·lació Frontend
npm install
=======
## Instal·lació Backend
composer install
>>>>>>> origin/develop

# 4. Editar manualment per quedar-te amb ambdós canvis:

## Instal·lació Backend
composer install

## Instal·lació Frontend
npm install

# 5. Guardar l'arxiu

# 6. Marcar com resolt
git add README.md

# 7. Continuar amb el merge
git commit -m "merge: resoldre conflicte a README"

# 8. Pujar
git push
```

### **Consells per Evitar Conflictes:**

1. Feu PRs freqüents (no espereu setmanes)
2. Actualitzeu develop regularment
3. Comuniqueu quins arxius editareu
4. Dividiu bé: frontend/ vs backend/
5. Si ambdós necessiteu editar README, coordineu-vos

---

## Comunicació

### **Grup de WhatsApp/Telegram (CRÍTIC):**

Creeu un grup i aviseu de:

```
Començo a treballar en X
He acabat feature X, revisar PR
He fet merge del meu PR, actualitzeu develop
Editaré README (ull que no l'editis tu també!)
He trobat un bug al teu codi
Com funciona X?
```

### **Exemples de Missatges:**

```
[Frontend Dev] 10:00
Començo feature/frontend-productes
Crearé: ProductosPage.jsx, ProductCard.jsx

[Backend Dev] 10:05
OK! Jo faig feature/backend-api-productes
Editaré: ProductController.php, routes/api.php

[Frontend Dev] 14:30
PR llest! feature/frontend-productes → develop
https://github.com/repo/pull/12
Pots revisar?

[Backend Dev] 14:45
Revisant...

[Backend Dev] 14:50
Approved & merged!
Pots fer git pull origin develop

[Frontend Dev] 15:00
Actualitzat! Ara començo feature/frontend-carret
```

### **Daily Stand-up (Opcional però útil):**

Cada matí, 5 minuts per trucada o missatge:
1. Què vaig fer ahir?
2. Què faré avui?
3. Tinc algun blocador?

---

## Comandes de Referència Ràpida

### **Setup Inicial:**

```bash
git clone <url>                          # Clonar repositori
git checkout develop                     # Anar a develop
```

### **Treballar en Feature:**

```bash
git checkout develop                     # Anar a develop
git pull origin develop                  # Actualitzar develop
git checkout -b feature/la-meva-feature  # Crear branch
git status                               # Veure canvis
git add .                                # Afegir tots els canvis
git add carpeta/                         # Afegir carpeta específica
git commit -m "feat: missatge"           # Commit
git push origin feature/la-meva-feature  # Pujar a GitHub
```

### **Després del Merge:**

```bash
git checkout develop                     # Tornar a develop
git pull origin develop                  # Actualitzar
git branch -d feature/la-meva-feature    # Esborrar branch local
```

### **Veure Estat:**

```bash
git status                               # Estat actual
git log --oneline                        # Historial de commits
git branch                               # Veure branches locals
git branch -a                            # Veure totes les branches
git diff                                 # Veure canvis no guardats
```

### **Desfer Canvis:**

```bash
git restore arxiu.js                     # Descartar canvis d'un arxiu
git restore .                            # Descartar tots els canvis
git reset --soft HEAD~1                  # Desfer últim commit (mantenir canvis)
git reset --hard HEAD~1                  # Desfer últim commit (perdre canvis) PERILL!
```

### **Actualitzar la Teva Branch:**

```bash
git checkout develop                     # Anar a develop
git pull origin develop                  # Actualitzar develop
git checkout feature/la-meva-feature     # Tornar a la teva branch
git merge develop                        # Portar canvis de develop a la teva branch
```

---

## Regles d'Or

### **Les 10 Regles Que MAI Trencar:**

1. **MAI** fer `git push` directe a `main`
2. **SEMPRE** treballar en branches `feature/*`
3. **SEMPRE** fer `git pull origin develop` abans de crear nova branch
4. **SEMPRE** usar missatges descriptius en commits
5. **SEMPRE** fer PR per fusionar a `develop`
6. **AVISAR** al grup quan acabis alguna cosa important
7. **REVISAR** els PRs del company (ràpid, però fes-ho)
8. **FER MERGE** a `develop` freqüentment (no esperar setmanes)
9. **AFEGIR** només els arxius del teu scope (`frontend/` o `backend/`)
10. **COMUNICAR** si editaràs arxius compartits (README, docs)

### **Principis Generals:**

- **Commit freqüentment** (cada hora o dues)
- **Push freqüentment** (al final del dia mínim)
- **PR freqüentment** (quan acabis alguna cosa funcional)
- **Comunica freqüentment** (avisa del que fas)
- **Mantén develop net** (només codi que funciona)

---

## Troubleshooting

### **Problema: "No puc fer push"**

```bash
# Error: Updates were rejected because the tip of your current branch is behind

# Solució:
git pull origin feature/la-meva-branch
# Resoldre conflictes si n'hi ha
git push origin feature/la-meva-branch
```

### **Problema: "Estic a la branch equivocada"**

```bash
# Si NO has fet commit:
git stash                        # Guardar canvis temporalment
git checkout branch-correcta     # Anar a la branch correcta
git stash pop                    # Recuperar canvis

# Si JA has fet commit:
# No passa res, els commits es queden a aquella branch
# Pots fer cherry-pick si necessites moure'ls
```

### **Problema: "He fet commit a main per error"**

```bash
# Si NO has fet push encara:
git reset --soft HEAD~1          # Desfà commit, manté canvis
git checkout develop             # Ves a develop
git checkout -b feature/el-meu-fix   # Crea branch correcta
git add .
git commit -m "feat: el meu canvi"
git push origin feature/el-meu-fix

# Si JA has fet push:
# Contacta l'altre membre de l'equip urgent
```

### **Problema: "Com veig què ha canviat el meu company?"**

```bash
git log develop..origin/develop  # Veure commits nous a GitHub
git fetch origin                 # Portar info sense fusionar
git diff develop origin/develop  # Veure diferències
```

---

## Recursos d'Aprenentatge

### **Git Bàsic:**
- [Git Handbook](https://guides.github.com/introduction/git-handbook/) (15 min)
- [Learn Git Branching](https://learngitbranching.js.org/) (Interactiu, 1 hora)

### **GitHub:**
- [GitHub Flow](https://guides.github.com/introduction/flow/) (5 min)
- [Pull Requests](https://docs.github.com/en/pull-requests) (10 min)

### **Eines Visuals:**
- [GitHub Desktop](https://desktop.github.com/) (GUI per Git)
- [GitKraken](https://www.gitkraken.com/) (GUI avançada)
- VS Code amb extensió GitLens

---

## Contacte i Ajuda

**Si tens dubtes:**
1. Revisa aquesta guia
2. Pregunta al teu company
3. Busca a Google: "git <el-teu-problema>"
4. [Stack Overflow](https://stackoverflow.com/questions/tagged/git)

**Si alguna cosa va malament:**
1. **NO ENTRIS EN PÀNIC**
2. No facis més comandes a l'atzar
3. Copia l'error exacte
4. Pregunta al teu company
5. En últim cas, clona el repo de nou (perdràs treball local)

---

## Conclusió

Git sembla complicat al principi, però amb aquestes 5 comandes bàsiques anireu lluny:

```bash
git pull origin develop           # Actualitzar
git checkout -b feature/...       # Crear branch
git add . && git commit -m "..."  # Guardar
git push origin feature/...       # Pujar
git checkout develop              # Tornar
```

**El secret:** Fer commits petits i freqüents. No esperar a tenir-ho tot perfecte.

---

**Document creat per:** Albert && David
**Data:** 13 Gener 2026
**Versió:** 1.0
**Projecte:** Ecommerce Bambes - Laravel + React

---

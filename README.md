# Concesionaria Backend Starter

Base inicial para un sistema de concesionarias con:

- NestJS
- MongoDB + Mongoose
- Swagger
- JWT access + refresh token
- roles `OWNER`, `ADMIN`, `EDITOR`
- vehículos con datos públicos y privados
- endpoints públicos para landings totalmente personalizadas

## Idea de arquitectura

Este backend **no asume una landing genérica**. La landing de cada concesionaria puede ser completamente distinta.

El backend expone principalmente:

- auth y usuarios para panel/app móvil
- vehículos para administración interna
- endpoints públicos para que cada landing consuma sus autos publicados

## Modelos incluidos

### User
- `name`
- `email`
- `passwordHash`
- `role`
- `businessId`
- `isActive`
- `refreshTokenHash`

### Dealership
- `name`
- `slug`
- `logoUrl`
- `whatsapp`
- `publicEmail`
- `address`
- `primaryColor`
- `secondaryColor`
- `isActive`

### Vehicle
- `name`
- `year`
- `kms`
- `publicPrice`
- `description`
- `coverImageUrl`
- `galleryUrls`
- `status`
- `isPublished`
- `privateFinance.purchasePrice`
- `privateFinance.finalSalePrice`
- `privateFinance.expenses`
- `privateFinance.internalNotes`

## Reglas incluidas

- sin login no podés usar endpoints privados
- `OWNER` puede crear/editar usuarios
- `OWNER` ve datos privados del vehículo
- `ADMIN` y `EDITOR` ven solo la parte pública del vehículo desde el panel
- la landing pública jamás recibe datos privados

## Endpoints principales

### Auth
- `POST /api/auth/register-owner`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `GET /api/auth/me`
- `POST /api/auth/logout`

### Users
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `PATCH /api/users/:id/status`

### businesses
- `GET /api/businesses/me`
- `PATCH /api/businesses/me`

### Vehicles (privados)
- `GET /api/vehicles`
- `POST /api/vehicles`
- `GET /api/vehicles/:id`
- `PATCH /api/vehicles/:id`
- `PATCH /api/vehicles/:id/status`
- `DELETE /api/vehicles/:id`

### Public (para la landing)
- `GET /api/public/:slug/vehicles`
- `GET /api/public/:slug/vehicles/:vehicleId`

## Setup

```bash
npm install
cp .env.example .env
npm run start:dev
```

Swagger:

```bash
http://localhost:3000/docs
```

## Orden recomendado para probar

### 1. Crear owner + concesionaria
Usá:

`POST /api/auth/register-owner`

Ejemplo:

```json
{
  "dealershipName": "Go Cars",
  "businesseslug": "gocars",
  "name": "Lucas Battelini",
  "email": "owner@gocars.com",
  "password": "MyStrongPassword123"
}
```

### 2. Copiar el `accessToken`
En Swagger, hacé click en **Authorize** y pegalo como:

```txt
Bearer TU_TOKEN
```

### 3. Crear vehículos
Probá `POST /api/vehicles`

### 4. Ver la landing pública
Probá:

`GET /api/public/gocars/vehicles`

## Próximos pasos sugeridos

1. integrar Cloudinary
2. separar `VehicleImage` como entidad propia
3. agregar leads/consultas
4. dashboard de métricas
5. mobile app / panel responsive
6. granular mejor los permisos

## Nota importante

Este starter está pensado para empezar rápido y seguir iterando.
No incluye todavía:

- upload real de imágenes
- reset password por email
- rate limiting
- auditoría avanzada
- multi-tenant complejo por dominios propios
- refresh token por dispositivo

Pero sí deja una base limpia para avanzar encima.

# Configuracion recomendada para Firebase

## 1. Activar servicios

- Entra a Firebase Console y abre el proyecto `sariahrivera`.
- Activa `Firestore Database` en modo de produccion.
- Activa `Authentication` con el proveedor `Email/Password`.
- Crea al menos un usuario administrador para entrar a `admin.html`.

## 2. Coleccion usada por el sitio

El formulario guarda las consultas en esta coleccion:

- `consultas`

Campos principales:

- `nombre`
- `telefono`
- `email`
- `servicio`
- `urgencia`
- `canal`
- `mensaje`
- `estado`
- `origen`
- `notas`
- `createdAt`
- `updatedAt`

## 3. Reglas de Firestore

Usa el contenido de `firestore.rules` para que:

- cualquier visitante pueda crear una consulta desde la web
- solo usuarios autenticados puedan leer y administrar el CRM

## 4. Flujo del CRM

1. El cliente llena `contacto.html`.
2. La consulta se guarda en Firestore.
3. El abogado entra a `admin.html`.
4. Inicia sesion con Firebase Auth.
5. Revisa consultas, cambia estado y agrega notas.

## 5. Recomendaciones para Google Business y conversion

- Completa la ficha de Google Business con el mismo numero y nombre del sitio.
- Sube fotos profesionales reales del despacho y del perfil.
- Manten una llamada a la accion consistente: `Agendar consulta` o `Escribir por WhatsApp`.
- Si luego me compartes direccion, horarios y especialidades exactas, te puedo dejar schema, SEO local y textos aun mas fuertes.

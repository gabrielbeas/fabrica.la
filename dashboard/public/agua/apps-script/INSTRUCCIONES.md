# Cómo desplegar el conector en vivo (Apps Script)

Esto conecta tus dos Google Sheets (`LFdC_CONTROL ADMIN 202608` y
`LFdC_OPERACION 202608`) con el panel de fabrica.la, en vivo, sin que
las hojas queden públicas: solo tú controlas el acceso mediante un
token, y solo se expone lo que el script decide devolver.

Son ~5 minutos, todo dentro de tu cuenta de Google.

## Paso 1 — Crear el proyecto de Apps Script

1. Ve a **https://script.google.com**
2. Clic en **"New project"**
3. Borra el contenido de `Code.gs` que aparece por defecto y pega
   completo el contenido del archivo `Code.gs` que te entregué junto
   a estas instrucciones.
4. Arriba, donde dice "Untitled project", ponle un nombre, por
   ejemplo **"LFdC - Conector Panel"**.
5. Guarda (ícono de disco o Ctrl+S).

## Paso 2 — Configurar el token de acceso ✅ (ya lo hiciste)

Esto evita que cualquiera que adivine la URL pueda leer tus datos.

1. Ícono de engranaje (⚙️) → **"Project Settings"**.
2. Sección **"Script properties"** → **"Add script property"**.
3. Property: `ACCESS_TOKEN` / Value: tu token (confirmado que
   termina en `...304dc24875`, correcto).
4. Clic en **"Save script properties"**.

## Paso 3 — Autorizar el acceso a tus Sheets ✅ (ya lo hiciste)

1. Editor de código (ícono `< >`).
2. En el dropdown de funciones (junto al botón ▶️ **"Run"**),
   selecciona `doGet`.
3. Clic en **"Run"**. Si pide autorización: **"Review permissions"**
   → tu cuenta → si sale advertencia de app no verificada, clic en
   "Advanced" / "Go to LFdC - Conector Panel (unsafe)" → **"Allow"**.
4. "Execution log" mostrando "Execution completed" sin errores =
   correcto (ya lo confirmamos).

## Paso 4 — Publicar como aplicación web ⬅️ ESTÁS AQUÍ

1. Arriba a la derecha, botón azul **"Deploy"** → **"New deployment"**.
2. Ícono de engranaje (⚙️) junto a "Select type" → **"Web app"**.
3. Configuración:
   - **Description**: "Conector panel v1"
   - **Execute as**: **Me (gabriel@fabrica.la)**
   - **Who has access**: **Anyone** (necesario para que el sitio lo
     pueda leer desde el navegador; el token del Paso 2 es la
     protección real, no este ajuste)
4. Clic en **"Deploy"**.
5. Puede volver a pedir **"Authorize access"** en este paso — es la
   autorización real para acceder a los Sheets. Mismo flujo:
   "Review permissions" → tu cuenta → "Advanced" → "Go to LFdC -
   Conector Panel (unsafe)" → **"Allow"**.
6. Te dará una **"Web app URL"** (algo como
   `https://script.google.com/macros/s/AKfycb.../exec`). **Cópiala y
   pásamela** junto con confirmación del token que usaste.

## Paso 5 — Probar (opcional, pero recomendado)

Pega esto en tu navegador, cambiando `TU_URL` y `TU_TOKEN`:

```
TU_URL?token=TU_TOKEN&book=admin
```

Deberías ver un JSON largo con los datos de `LFdC_CONTROL ADMIN
202608`. Si ves `{"error":"No autorizado..."}`, revisa que el token
coincida exactamente con el que pusiste en "Script properties".

---

**Nota sobre actualizaciones futuras:** si en algún momento cambio o
mejoro el código del conector, te pasaré el nuevo `Code.gs` y solo
tendrás que repetir el Paso 1 (pegar el código nuevo) y luego
**Deploy → Manage deployments → editar (ícono de lápiz) → Version:
"New version" → Deploy** — no hace falta repetir todo desde cero ni
generar una URL nueva.

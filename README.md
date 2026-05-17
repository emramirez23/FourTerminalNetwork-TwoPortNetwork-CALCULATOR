# FourTerminalNetwork TwoPortNetwork CALCULATOR

Calculadora y simulador de cuadripolos / redes de dos puertos.

Sitio online:

https://fourterminalnetwork-twoportnetwork-calculator.netlify.app/

## Funcionalidades

- Dibujo de netlists en vivo con vista SVG del esquema electrico.
- Resolucion de matrices Z e Y para redes R/Z/Y.
- Derivacion automatica de parametros h, g y ABCD/Gamma.
- Conversion entre familias de matrices Z, Y, h, g y Gamma.
- Asociacion de cuadripolos en cascada, serie-serie, paralelo-paralelo, serie-paralelo y paralelo-serie.
- Soporte visual para resistores, inductores y capacitores.
- Modo claro/oscuro e interfaz en Espanol/Ingles.
- Exportacion de resultados en Markdown, LaTeX, JSON y PDF.

## Estado actual

- La web estatica en `web/` es la interfaz principal para uso local y despliegue en Netlify.
- El backend Python en `backend/` sigue siendo el motor de referencia local para pruebas, validacion y crecimiento simbolico.
- El frontend ahora esta separado en parser, solver, conversiones, reportes y preview para reducir deuda tecnica sin romper compatibilidad.

## Uso local

```powershell
python -m http.server 8888 -d web
```

Luego abrir:

```text
http://127.0.0.1:8888
```

Tambien puede abrirse con doble click usando `Abrir Simulador.bat`.

Tambien hay comandos de trabajo unificados en la raiz:

```powershell
npm start
npm test
```

## Pruebas

Suite completa:

```powershell
npm test
```

Frontend estatico:

```powershell
cd web
npm test
```

Backend Python:

```powershell
.venv\Scripts\python.exe -m pytest -q
```

# Simulador web de cuadripolos

La UI integrada vive en `web/` y esta preparada para publicarse como sitio estatico en Netlify.

## Uso local

```powershell
python -m http.server 8888 -d web
```

Luego abrir:

```text
http://127.0.0.1:8888
```

Tambien puede abrirse con doble click usando `Abrir Simulador.bat` desde la raiz del proyecto. Ese script levanta el servidor local en el puerto `8888` y abre el navegador automaticamente.

## Alcance integrado

- MVP1: ingreso por netlist, preview viva, calculo numerico de parametros Z/Y y derivacion automatica de h, g y Gamma/ABCD para redes R/Z/Y.
- MVP2: conversion numerica entre Z, Y, h, g y gamma/ABCD con validacion de determinantes.
- MVP3: asociacion por cascada, serie-serie, paralelo-paralelo, serie-paralelo y paralelo-serie sobre matrices 2x2.
- MVP4: constructor grafico inicial por ramas tipicas T, pi, serie y derivaciones.
- MVP5: reporte Markdown, LaTeX, JSON y exportacion a PDF mediante impresion del navegador.

El backend Python sigue siendo el motor de referencia local para pruebas y crecimiento simbolico.

## Simbolos de componentes en el preview

La vista SVG dibuja simbolos electricos especificos para:

- `R`: resistor.
- `L`: inductor o bobina.
- `C`: capacitor.

Los componentes `Z` e `Y` se muestran como bloques genericos porque representan impedancias/admitancias arbitrarias.

## Rama inferior con nodos propios

Para dibujar nodos en la rama inferior, defina los bornes inferiores con `.ports` y use esos nodos en la netlist:

```text
.ports 1 0 2 b2
R1 1 n1 30
R2 n1 2 40
R3 0 b1 15
R4 b1 b2 25
R5 n1 b1 50
```

En este ejemplo `b1` y `b2` pertenecen al riel inferior, mientras que `n1` queda en el riel superior.

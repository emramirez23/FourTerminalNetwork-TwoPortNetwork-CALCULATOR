# Plan de integracion UI inspirado en Simulador de Atenuadores

Objetivo: tomar los patrones de producto que funcionan bien en el Simulador de Atenuadores y adaptarlos al Simulador de Cuadripolos sin perder el foco principal: resolver, explicar y estudiar cuadripolos con criterio de Teoria de Circuitos II.

## Etapa 1 - Identidad, enlaces y ecosistema

Estado: implementada.

- Agregar accesos visibles a LinkedIn, GitHub y Gmail del autor en el bloque de identidad.
- Usar los mismos destinos que el Simulador de Atenuadores:
  - LinkedIn: `https://www.linkedin.com/in/elias-ramirez-rolon/`
  - GitHub: `https://github.com/emramirez23`
  - Gmail: `mailto:ramirezelias.marcos@gmail.com`
- Agregar un boton cerca de idioma/tema que lleve al Simulador de Atenuadores online:
  - `https://attenuatorcalculator.netlify.app/`
- Verificar en UI que todos los `href` queden correctos y que abran en una pestana nueva cuando corresponde.

## Etapa 2 - Acciones por panel

- Llevar el patron de Atenuadores a cada modulo principal: `Compartir`, `Exportar LaTeX` y `Exportar PDF`.
- Aplicarlo primero a:
  - Resolver matrices.
  - Conversion de matrices.
  - Asociacion de cuadripolos.
  - Constructor rapido.
- Mantener el exportador global actual como salida completa, pero sumar exportacion parcial por operacion activa.

## Etapa 3 - Panel comun de resolucion didactica

- Separar los pasos de resolucion del panel donde se ejecuta la accion.
- Crear un panel comun `Resolucion didactica` que reciba pasos desde resolver, convertir, asociar, Brune o equivalentes.
- Dar formato uniforme a:
  - Hipotesis y condicion aplicada.
  - Ecuaciones.
  - Resultado parcial.
  - Advertencias.
  - Verificacion final.

## Etapa 4 - Permalinks y recuperacion de estado

- Agregar enlaces compartibles por panel:
  - `?panel=solve&netlist=...`
  - `?panel=convert&source=Z&target=Y&...`
  - `?panel=associate&type=cascade&...`
- Codificar netlists largas de forma segura.
- Restaurar automaticamente el estado al abrir un enlace.

## Etapa 5 - Resumen tecnico en chips

- Crear chips de estado similares a los de Atenuadores, pero orientados a cuadripolos:
  - Reciproco / no reciproco.
  - Simetrico / no simetrico.
  - `det(Z)`, `det(Y)`.
  - Conversiones disponibles.
  - Familia recomendada para la asociacion.
  - Test de Brune valido / no valido.

## Etapa 6 - Asistente comparador de cuadripolos

- Crear un panel que analice un circuito o matriz y sugiera:
  - Familia de parametros mas conveniente.
  - Equivalente T, pi o X si existe.
  - Asociacion recomendable.
  - Riesgos de singularidad o convencion de signos.
- Debe funcionar como una herramienta de estudio, no solo como diagnostico tecnico.

## Etapa 7 - Constructor rapido mas guiado

- Transformar las topologias tipicas en tarjetas con:
  - Mini esquema.
  - Descripcion breve.
  - Formula esperada cuando aplique.
  - Boton `Usar`.
- Priorizar las topologias de los apuntes:
  - T.
  - pi.
  - T simetrico.
  - pi simetrico.
  - L de entrada y L de salida.
  - T puenteado.
  - X / lattice.
  - Escalera.
  - Rama inferior con retorno independiente.
- Evitar botones de casos aislados `Zs` y `Zp`: se conservan como conceptos explicativos, pero no como topologias completas del constructor rapido.

## Etapa 8 - Exportacion profesional

- Separar generadores LaTeX por tipo de operacion.
- Mejorar PDF para que parezca apunte:
  - Titulo.
  - Circuito.
  - Matrices.
  - Desarrollo paso a paso.
  - Verificaciones.
  - Advertencias.
- Mantener exportacion Markdown/JSON para depuracion y reproducibilidad.

## Decision tecnica

No migrar todavia todo Cuadripolos a React/TypeScript. La UI actual ya funciona y una migracion completa agregaria riesgo. Primero conviene incorporar los patrones de Atenuadores en la arquitectura actual; si el producto crece mucho, la migracion puede ser una etapa posterior y controlada.

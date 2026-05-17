# Vista previa viva de netlist

Esta version agrega una pagina local para ver el circuito mientras se escribe el netlist.

## Abrir la herramienta

Con la API levantada:

```powershell
.\\.venv\\Scripts\\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Abrir:

```text
http://127.0.0.1:8000/netlist-preview
```

La pagina tiene:

- Un editor de netlist.
- Un esquema SVG estilo cuadripolo con dos rieles, puertos, corrientes y polaridades.
- Distribucion automatica de ramas en paralelo para evitar solapes.
- Ancho SVG dinamico para redes largas o con muchos componentes en paralelo.
- Un Markdown completo con puertos, componentes y valores.
- Advertencias tolerantes para lineas incompletas mientras se tipea.

## Endpoint usado por la pagina

```text
POST /preview/netlist
```

Body:

```json
{
  "netlist": "R1 1 n1 30\nR2 n1 0 40"
}
```

Respuesta:

- `markdown`: bloque Markdown completo.
- `svg`: esquema electrico principal.
- `mermaid`: diagrama Mermaid.
- `components`: componentes reconocidos.
- `ports`: puertos detectados.
- `warnings`: advertencias de tipeo o formato.

## Ejemplo

```text
R1 1 n1 30
R2 n1 0 40
R3 n1 n2 50
R4 n2 0 20
R5 n2 2 10
```

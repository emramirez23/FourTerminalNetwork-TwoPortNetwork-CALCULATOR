# MVP1 - Resolucion de cuadripolos por netlist

Este MVP implementa el primer tramo del simulador:

- Entrada por netlist pasivo.
- Puertos por defecto `P1=(1,0)` y `P2=(2,0)`, dibujados como bornes `1`, `1'`, `2` y `2'` con retorno comun en `0`.
- Directivas opcionales `.port P1 nodo+ nodo-` y `.port P2 nodo+ nodo-`.
- Calculo de parametros `Z` por puerto abierto.
- Calculo de parametros `Y` por puerto en cortocircuito.
- Derivacion automatica de matrices `h`, `g` y `Gamma`/`ABCD` desde `Z`, con validacion de condiciones de existencia.
- Resolucion simbolica/numerica con SymPy.
- API FastAPI y CLI.
- Pruebas con el ejercicio de ejemplo 1 de los PDFs de cuadripolos.

El MVP2 ya agrega conversiones entre matrices. Ver [README_MVP2.md](README_MVP2.md).
Tambien hay una primera vista previa de netlist. Ver [README_NETLIST_PREVIEW.md](README_NETLIST_PREVIEW.md).

## Instalar

```powershell
.\\.venv\\Scripts\\python.exe -m pip install -r requirements.txt
```

## Ejecutar pruebas

```powershell
.\\.venv\\Scripts\\python.exe -m pytest backend\\tests
```

## Resolver el ejemplo por CLI

```powershell
.\\.venv\\Scripts\\python.exe -m backend.app.cli backend\\app\\fixtures\\ejemplo_1.net
```

## Levantar API

```powershell
.\\.venv\\Scripts\\python.exe -m uvicorn backend.app.main:app --reload
```

Luego abrir:

```text
http://127.0.0.1:8000/docs
```

## Formato netlist MVP1

```text
R1 1 n1 30
R2 n1 0 40
R3 n1 n2 50
R4 n2 0 20
R5 n2 2 10
```

Componentes soportados:

- `R`: resistencia, valor en ohm.
- `Z`: impedancia generica, por ejemplo `j*5`, `s*L`, `1/(s*C)`.
- `L`: inductancia, se modela como `s*L`.
- `C`: capacitancia, se modela como `1/(s*C)`.
- `Y`: admitancia directa.

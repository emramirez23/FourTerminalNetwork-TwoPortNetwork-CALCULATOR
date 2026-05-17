# MVP2 - Conversiones entre matrices de cuadripolos

Este MVP agrega conversiones entre familias de parametros:

- `Z`
- `Y`
- `h`
- `g`
- `Gamma` / `ABCD` / matriz principal

La convencion de matriz principal sigue el apunte:

```text
V1 = A V2 - B I2
I1 = C V2 - D I2
```

## Usar desde la API

Levantar servidor:

```powershell
.\\.venv\\Scripts\\python.exe -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Abrir:

```text
http://127.0.0.1:8000/docs
```

Entrar en `POST /convert` y probar:

```json
{
  "source_family": "Z",
  "matrix": [["610/11", "80/11"], ["80/11", "290/11"]],
  "target_families": ["Y", "h", "g", "Gamma"]
}
```

## Ejemplo de conversion del ejercicio 4

```json
{
  "source_family": "Z",
  "matrix": [["742/11", "168/11"], ["168/11", "422/11"]],
  "target_families": ["Gamma"]
}
```

Resultado decimal esperado aproximado:

```text
Gamma = [[4.41667, 154.167],
         [0.0654762, 2.5119]]
```

## Condiciones de existencia

Cada conversion devuelve condiciones como:

- `DeltaZ != 0` para `Z -> Y`.
- `z21 != 0` para `Z -> Gamma`.
- `z22 != 0` para `Z -> h`.
- `z11 != 0` para `Z -> g`.

Si una conversion no es posible, la respuesta incluye `status: "error"` y una explicacion.

## Ejecutar las 10 pruebas del MVP2

```powershell
.\\.venv\\Scripts\\python.exe -m pytest backend\\tests\\test_mvp2_conversions.py -q
```


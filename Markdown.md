# 24. RANDOMIZACIÓN CONTROLADA DE VENTAS

La aplicación puede utilizar randomización controlada como mecanismo de búsqueda de secuencias válidas.

La randomización NO puede modificar las cantidades originales de las ventas ni de las entradas.

La randomización únicamente puede utilizarse para explorar diferentes secuencias, órdenes o asignaciones de procesamiento que estén permitidas por las reglas existentes.

La randomización es un mecanismo de BÚSQUEDA, NO un mecanismo de modificación de datos.

---

# 25. INMUTABILIDAD DE LAS CANTIDADES

Las cantidades originales de todos los movimientos son DATOS PROTEGIDOS.

Para cada venta:

LITROS_PROCESADOS = LITROS_ORIGINALES

Para cada entrada:

LITROS_PROCESADOS = LITROS_ORIGINALES

Está estrictamente prohibido:

- Reducir una venta.
- Aumentar una venta.
- Dividir artificialmente una venta.
- Fusionar ventas.
- Crear litros inexistentes.
- Eliminar litros.
- Crear entradas inexistentes.
- Eliminar entradas.
- Modificar las cantidades originales.

Ejemplo PROHIBIDO:

Venta original:

5,238 L

Venta procesada:

5,000 L

Esto constituye una modificación de datos y la solución debe ser rechazada.

---

# 26. CONCILIACIÓN EXACTA DE VENTAS

Antes y después del procesamiento debe cumplirse:

TOTAL_VENTAS_ORIGINAL = TOTAL_VENTAS_PROCESADO

La diferencia permitida debe ser 0 L para cantidades enteras.

Para cantidades decimales se aplicará únicamente la tolerancia decimal definida en las reglas de balance existentes.

Si la diferencia supera la tolerancia:

🔴 PROCESAMIENTO INVÁLIDO

La solución debe descartarse.

---

# 27. CONCILIACIÓN EXACTA DE ENTRADAS

Debe cumplirse:

TOTAL_ENTRADAS_ORIGINAL = TOTAL_ENTRADAS_PROCESADO

No se permite:

- Crear entradas ficticias.
- Eliminar entradas.
- Modificar litros de entradas.
- Dividir artificialmente entradas.
- Fusionar entradas.

Las entradas originales deben conservar sus cantidades.

---

# 28. CONSERVACIÓN DE MOVIMIENTOS

Debe cumplirse:

MOVIMIENTOS_ORIGINALES = MOVIMIENTOS_PROCESADOS

Cada movimiento debe conservar un identificador único.

No pueden existir:

- Movimientos eliminados.
- Movimientos duplicados.
- Movimientos inventados.
- Movimientos sin origen.
- Movimientos cuyo origen no pueda ser identificado.

Cada movimiento procesado debe poder relacionarse con su movimiento original.

---

# 29. RANDOMIZACIÓN COMO BÚSQUEDA DE SECUENCIAS

Cuando existan varias operaciones que puedan procesarse en diferentes órdenes, el motor puede generar diferentes candidatos.

Ejemplo:

Secuencia original:

A → B → C

Candidatos posibles:

A → B → C

A → C → B

B → A → C

B → C → A

C → A → B

C → B → A

Cada movimiento conserva exactamente sus datos originales.

La randomización NO puede modificar:

- Litros.
- Producto.
- Sitio.
- Tanque.
- Identificador.
- Entrada.
- Venta.

Solo puede modificar el orden o cualquier otro atributo temporal que las reglas existentes permitan modificar explícitamente.

---

# 30. VALIDACIÓN DE CADA CANDIDATO

Cada secuencia generada debe validarse completamente antes de ser aceptada.

Si una sola validación falla:

CANDIDATO = DESCARTADO

Como mínimo deben comprobarse:

1. Inventario inicial válido.
2. Inventario final válido.
3. Inventario >= 0.
4. Inventario <= capacidad_85.
5. Ninguna venta supera el inventario disponible.
6. Ninguna entrada provoca sobrecapacidad.
7. Todas las cantidades originales permanecen intactas.
8. Todos los movimientos originales existen.
9. No existen movimientos duplicados.
10. No existen movimientos inventados.
11. El balance matemático es correcto.
12. El total de ventas coincide.
13. El total de entradas coincide.
14. El inventario final calculado coincide con el declarado.
15. Las reglas de domingos se cumplen.
16. Las fechas y horas modificadas tienen trazabilidad.

---

# 31. VALIDACIÓN FÍSICA DE CADA MOVIMIENTO

Después de cada movimiento debe comprobarse inmediatamente:

INVENTARIO >= 0

Y:

INVENTARIO <= capacidad_85

No existe ningún concepto de:

"Inventario negativo temporal"

Si un candidato produce inventario negativo en cualquier punto:

CANDIDATO = DESCARTADO

No se permite continuar procesando ese candidato esperando que una entrada posterior corrija el inventario.

---

# 32. SEED DE RANDOMIZACIÓN

Toda ejecución que utilice randomización debe utilizar una SEED_ALEATORIA.

La SEED debe registrarse.

La combinación:

SEED + DATOS_ORIGINALES + REGLAS + CONFIGURACIÓN

debe permitir reproducir la ejecución.

Una ejecución reproducida con los mismos elementos debe generar la misma secuencia de búsqueda.

La SEED forma parte de la información de auditoría.

---

# 33. REGISTRO DE INTENTOS

Cada candidato generado debe tener un número de intento.

Ejemplo:

INTENTO 1

INTENTO 2

INTENTO 3

etc.

El sistema debe registrar:

- Número de intento.
- Secuencia generada.
- Resultado de validación.
- Motivo de descarte, si corresponde.

No es necesario almacenar información innecesaria de candidatos que no pueda contribuir a la auditoría.

---

# 34. LÍMITE DE BÚSQUEDA

El motor puede utilizar un límite configurable de intentos.

Si se alcanza el límite y no se encuentra una solución válida:

NO debe declarar automáticamente que matemáticamente no existe solución.

Debe indicar:

🔴 BÚSQUEDA AGOTADA SIN SOLUCIÓN EN EL LÍMITE CONFIGURADO

Este estado debe diferenciarse de:

🔴 NO RESOLUBLE

"NO RESOLUBLE" únicamente debe utilizarse cuando las restricciones y los datos demuestren que no existe una secuencia válida dentro del espacio de soluciones permitido.

---

# 35. REGLA CONTRA LA ALEATORIZACIÓN FORZADA

Está estrictamente prohibido:

"Generar valores aleatorios hasta conseguir que el inventario final cuadre."

La randomización únicamente puede generar candidatos derivados de los movimientos originales.

Nunca puede modificar cantidades para conseguir:

INVENTARIO_FINAL_CALCULADO = INVENTARIO_FINAL_DECLARADO

Si los datos no permiten una solución válida:

🔴 NO RESOLUBLE

---

# 36. FUNCIÓN OBJETIVO DE LA BÚSQUEDA

Cuando existan varias soluciones válidas, debe preferirse la solución que:

1. No modifique cantidades.
2. Mantenga las fechas originales.
3. Mantenga las horas originales.
4. Mantenga el orden original.
5. Minimice reordenamientos.
6. Minimice modificaciones de fecha.
7. Minimice modificaciones de hora.

La randomización nunca puede seleccionar una solución que viole una restricción superior.

---

# 37. PRIORIDAD DE LAS RESTRICCIONES

El motor debe respetar el siguiente orden de prioridad:

1. Integridad de los datos.
2. Inventario >= 0.
3. Inventario <= capacidad_85.
4. Balance matemático.
5. Conservación de movimientos.
6. Trazabilidad.
7. Fechas originales.
8. Horas originales.
9. Minimización de reordenamientos.
10. Randomización.

Una prioridad inferior nunca puede violar una prioridad superior.

---

# 38. AUDITORÍA DE LA SOLUCIÓN

Toda solución aceptada debe conservar como mínimo:

- ID_MOVIMIENTO
- LITROS_ORIGINALES
- LITROS_PROCESADOS
- FECHA_ORIGINAL
- FECHA_PROCESAMIENTO
- HORA_ORIGINAL
- HORA_PROCESAMIENTO
- SECUENCIA_ORIGINAL
- SECUENCIA_PROCESADA
- INVENTARIO_ANTES
- ENTRADA
- VENTA
- INVENTARIO_DESPUES
- CAPACIDAD_TOTAL
- CAPACIDAD_85
- SEED
- NUMERO_INTENTOS
- ESTADO
- MOTIVO

La información debe permitir reconstruir cómo se obtuvo la solución.

---

# 39. VALIDACIÓN FINAL DE LA SOLUCIÓN

Una solución únicamente puede declararse válida cuando todas las siguientes condiciones se cumplen:

INVENTARIO_INICIAL + TOTAL_ENTRADAS - TOTAL_VENTAS = INVENTARIO_FINAL

Y:

TOTAL_VENTAS_ORIGINAL = TOTAL_VENTAS_PROCESADO

Y:

TOTAL_ENTRADAS_ORIGINAL = TOTAL_ENTRADAS_PROCESADO

Y:

MOVIMIENTOS_ORIGINALES = MOVIMIENTOS_PROCESADOS

Y durante toda la secuencia:

0 <= INVENTARIO <= capacidad_85

Y:

No existen movimientos eliminados.

Y:

No existen movimientos duplicados.

Y:

No existen movimientos inventados.

Y:

No existen cantidades modificadas.

Si una sola condición falla:

🔴 SOLUCIÓN INVÁLIDA

---

# 40. PRINCIPIO DE REPRODUCIBILIDAD

Una solución obtenida mediante randomización debe poder reproducirse utilizando:

- Los mismos datos originales.
- La misma SEED.
- Las mismas reglas.
- La misma configuración del motor.

Si la ejecución reproducida produce un resultado diferente sin que haya cambiado alguno de estos elementos:

🔴 INCONSISTENCIA DE REPRODUCIBILIDAD

La solución no debe considerarse completamente auditable hasta identificar la causa.

---

# 41. ESTADOS DE RANDOMIZACIÓN

El sistema debe distinguir entre:

🟢 CONCILIADO

Existe una secuencia válida sin necesidad de reordenamiento significativo.

🟡 REORDENADO

Existe una secuencia válida mediante un reordenamiento permitido.

🟠 REVISIÓN MANUAL

Existe una situación que requiere una decisión que no puede determinarse automáticamente.

🔴 NO RESOLUBLE

No existe una secuencia válida utilizando exactamente los datos originales y las reglas permitidas.

🔴 BÚSQUEDA AGOTADA

No se encontró una solución dentro del límite de búsqueda configurado, pero no se puede afirmar que matemáticamente no exista una solución.

---

# 42. PRINCIPIO DE CERTEZA AUDITABLE

La aplicación no debe garantizar una solución para todos los conjuntos de datos.

Debe garantizar que cualquier solución declarada como válida cumpla todas las restricciones definidas.

La certeza del resultado debe provenir de las validaciones, no de la modificación de los datos.

La aplicación debe responder:

"¿Existe una secuencia físicamente válida utilizando EXACTAMENTE los datos proporcionados?"

Si la respuesta es sí:

→ generar la secuencia válida.

Si la respuesta es no:

→ reportar la inconsistencia.

Si la búsqueda no es suficiente para determinarlo:

→ reportar BÚSQUEDA AGOTADA.

Nunca fabricar una solución.

---

# 43. PRINCIPIO FINAL DE SEGURIDAD

La randomización es únicamente una herramienta de búsqueda.

NO es una herramienta para modificar datos.

Los datos originales constituyen la fuente de verdad.

Las cantidades originales son inmutables.

Las restricciones físicas son obligatorias.

El balance matemático es obligatorio.

La trazabilidad es obligatoria.

La reproducibilidad mediante SEED es obligatoria.

Una solución que necesite modificar datos protegidos debe ser rechazada.

El sistema debe preferir reportar:

🔴 NO RESOLUBLE

antes que generar una solución artificialmente conciliada.
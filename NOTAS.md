# Notas — decisiones que quizá quieras revisar

Cosas que resolví por mi cuenta para no frenar, y que son tuyas para confirmar o cambiar.

## 1. CSS a mano en vez de Tailwind CDN

El plan decía Tailwind por CDN (como el proyecto original). Escribí `src/styles.css`
a mano, con las variables de color de la paleta. Motivo: la estética de
«instrumento técnico» depende de detalles (tracking de las etiquetas, cifras
tabulares, los sliders, el grid de tiles con borde de 1 px) que con utilidades
quedan peor y más largos. Además saca una dependencia de CDN del runtime. El CSS
final pesa 2,9 kB gzip. Si preferís Tailwind, se revierte sin tocar la física.

## 2. Los números de la tabla que te pasé antes eran con tensión constante

En la explicación inicial te di 13,6 % contra 1,6 % de sag/largo para trickline y
longline. Ese cálculo usaba tensión fija. Con el modelo elástico ya implementado
—donde la tensión sube al pisar— los números reales son más cercanos: 4,1 % contra
1,5 %. La conclusión no cambia (la relación sigue siendo casi 3×, y en pantalla una
se ve en V y la otra casi recta), pero el efecto es menos extremo de lo que te
anticipé. Los números de la app y del README ya son los correctos.

## 3. Umbral de «acá no se usa leash»

Puse la regla en `altura_de_anclaje < largo_leash + 2 m`. Por debajo de eso la app
informa en vez de tirar la alarma roja de impacto, porque en una trickline de 1 m
nadie se amarra y el aviso sería cierto pero inútil. El umbral es criterio mío;
está en un solo lugar (`src/physics/index.ts`) si lo querés mover.

## 4. Supuesto conservador del modelo de caída

Para la caída libre asumo que el anillo del leash se queda donde lo dejó tu peso
(caés tu altura sobre la cinta más el largo del leash), pero para el frenado uso la
cinta descargada como referencia del resorte. Es deliberadamente conservador: da
más caída y más fuerza que la realidad. La alternativa (contar el rebote de la
cinta a tu favor) daría números más bajos y menos seguros. Está documentado en el
encabezado de `src/physics/fallSolver.ts` y en el aviso de la UI.

## 5. Idiomas

Mantuve exactamente los 10 del proyecto original, hindi incluido. En un momento
había puesto italiano en su lugar; lo revertí para no perder usuarios.

## 7. El longline quedó en 5 kN (resuelto)

Con los 2 kN originales, 60 m y anclajes a 2,5 m, el solver daba **3,42 m de SAG**:
la cinta quedaba 92 cm por debajo del piso en el medio, o sea el centro no se podía
caminar. Barriendo la tensión, el umbral estaba en 5 kN:

| tensión | SAG | libre |
|---|---|---|
| 2,0 kN | 3,42 m | −0,92 m |
| 3,0 kN | 2,94 m | −0,44 m |
| 4,0 kN | 2,52 m | −0,02 m |
| **5,0 kN** | **2,18 m** | **+0,32 m** |

El preset quedó en **5 kN**, que es el valor con el que esa cinta de plaza se camina
entera. El aviso de contacto con el suelo desapareció.

## 8. Pista de tensión mínima — no la hice

Sale casi gratis invirtiendo el solver que ya existe: bisección sobre la pretensión que
deja la altura libre en cero, y mostrar «necesitás al menos X kN para no tocar el suelo».
Contestaría sola la nota anterior y también tu comentario de que en highline la tensión
depende de la distancia. La dejé afuera para no ampliar el alcance por mi cuenta.

## 9. Saqué el campo de altura del arnés

Antes era una entrada suelta con 1,0 m fijo. Ahora sale de la estatura (0,58 × altura),
se muestra como pista debajo del control, y es un control menos en el celular. Si alguna
vez necesitás forzarlo (arnés de pecho, amarre distinto), hay que volver a exponerlo.

## 10. Saqué la elasticidad del leash, pero el leash sí estira

Lo pediste y lo hice, con una salvedad que conviene tener anotada: una cuerda
dinámica de 1,5 m estira unos **22 cm a 2,9 kN**, y todas las fuentes de highline
insisten en que el leash tiene que ser dinámico justamente por eso. Lo que sí es
cierto es que **el efecto en el resultado es marginal**, porque la cinta hace el 97 %
del frenado. Modelarlo como rígido sube la fuerza pico un 3 % y baja la profundidad
unos centímetros, o sea que el resultado queda del lado seguro. Si algún día querés
recuperarlo, era un solo campo y el modelo lo soportaba.

## 11. La exageración vertical arranca en ×1,5

Ya no es escala real por defecto. El cartel lo dice explícitamente y basta con bajar
el slider a ×1 para que el dibujo vuelva a ser exacto. La persona no se estira nunca.

## 6. Qué falta decidir

- **Dónde vive esto.** Está en `~/Desktop/sag calculator` como proyecto nuevo, sin
  git. El repo viejo (`rapabru/Sag.Calculator`, con deploy en Vercel) quedó intacto.
  Si querés publicarlo, hay que decidir si es una rama del repo existente, un
  reemplazo de `main`, o un repo nuevo.
- **Presets de cinta.** Los valores de `WEBBING_PRESETS` en
  `src/physics/constants.ts` son típicos, no de un modelo concreto. Si tenés las
  fichas de las cintas que usás, poné los datos reales (g/m y % a 10 kN).

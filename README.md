# SAG Calculator — Slackline

Calculadora de flecha (SAG) para slackline, reescrita desde cero. Además del SAG
estático calcula **dónde terminás si te caés amarrado al leash**, que es el número
que define si te alcanza la altura.

```
npm install
npm run dev      # http://localhost:5173
npm test         # tipos + física + render + idiomas
npm run build
```

## Qué cambió respecto de la versión anterior

**La tensión ya no es un dato fijo.** Antes se usaba `S = W·L / (2·√(4T² − W²))`,
que supone que la tensión no cambia cuando pisás la cinta. En la realidad la cinta
se estira, y estirarse significa más tensión. Ahora la tensión sale de imponer
compatibilidad elástica entre la geometría y la ley de Hooke,
`longitud_de_arco(H) = L₀·(1 + H/EA)`, resuelta por bisección. En el escenario por
defecto la pretensión de 3 kN sube a 4,2 kN al pisar, y el SAG baja de 4,62 m a
3,38 m reales.

Como efecto secundario **desaparece el caso falso de «SAG infinito»** que aparecía
cuando `T < W/2`. Una línea real no tiene sag infinito: se estira hasta encontrar
equilibrio.

**El gráfico ahora representa algo.** Antes dibujaba siempre el ancho completo del
SVG sin importar si la línea medía 15 m o 200 m, con la escala vertical sacada de
la altura del poste: dos escalas distintas y arbitrarias. Ahora hay **una sola
escala en px/metro** para los dos ejes (`src/components/chartGeometry.ts`), y el
perfil es la curva real del modelo muestreada en 160 puntos, no una V de tres
vértices.

Eso hace aparecer solo el efecto que se buscaba: a tensión fija el ángulo de la V
no depende del largo, pero las longlines se riggean mucho más duro, y lo que el ojo
lee como «V» o como «recta» es la proporción sag/largo:

| escenario | SAG | sag/largo | θ |
|---|---|---|---|
| trickline 20 m @ 4 kN | 0,82 m | 4,1 % | 4,7° |
| midline 70 m @ 3 kN | 3,38 m | 4,8 % | 5,7° |
| highline 100 m @ 10 kN | 2,00 m | 2,0 % | 2,4° |
| longline 200 m @ 14 kN | 3,00 m | 1,5 % | 1,8° |

**Caída con leash (función nueva).** De pie, el arnés está sobre la cinta y el leash
flojo; al caerte recorrés en caída libre tu altura sobre la cinta más el largo del
leash, y ahí la cinta y el leash frenan como dos resortes en serie. El punto más
bajo sale de conservación de energía,
`m·g·(caída_libre + z(F) − z(0)) = ∫₀^F F′ dz`. Lo que domina el resultado no es la
caída libre sino cuánto se estira la cinta: en el escenario por defecto la cinta
pasa de 3,4 m a 7,1 m de sag y terminás 12,3 m bajo los anclajes, con una fuerza
pico de unas 4 veces tu peso corporal (el orden que reportan las mediciones reales,
2–6 kN).

Es un modelo cuasi-estático de energía y deliberadamente conservador: ignora
amortiguación, histéresis de la cinta, deslizamiento del anillo, la energía que
absorbe el cuerpo y la elasticidad de los anclajes. Las fuerzas reales suelen quedar
10–30 % por debajo.

## Estructura

```
src/physics/staticSolver.ts   perfil, longitud de arco analítica, solver de tensión
src/physics/fallSolver.ts     balance de energía de la caída y trayectoria animable
src/components/chartGeometry.ts  encuadre y escala 1:1 (separado para poder testearlo)
src/components/SagChart.tsx   dibujo del perfil, cotas y caída
src/i18n/                     10 idiomas, importados estáticamente
scripts/verify.ts             38 comprobaciones de física y geometría
scripts/smoke.tsx             renderiza la app entera en los 10 idiomas
scripts/check-locales.mjs     claves y placeholders consistentes entre idiomas
```

La longitud de arco tiene forma cerrada (la pendiente es lineal por tramos, así que
`∫√(1+y′²)dx` se integra exacto con `Φ(u) = (u√(1+u²) + asinh u)/2`). Por eso el
cálculo completo tarda menos de 1 ms y se puede recalcular en cada movimiento de un
slider, sin botón «calcular» ni debounce.

## Segunda tanda — cuerpo, leash y terminología

**El % del leash ahora dice a qué carga está medido.** Antes decía «% a 5 kN» con
números tomados de otras referencias. Las normas miden a cargas bajísimas: EN 892
mide la cuerda dinámica **con 80 kg** (≤10 %) y EN 1891 la semiestática **entre 50 y
150 kg** (≤5 %). Cada preset lleva ahora su propia carga de referencia, calibrada en
el rango donde de verdad ocurre una caída (2–7 kN):

| leash | elongación | a carga | EA |
|---|---|---|---|
| Cuerda dinámica (EN 892, 9,5–10 mm) | 30 % | 6 kN | 20 kN |
| Leash clásico (dinámica en tubular) | 24 % | 6 kN | 25 kN |
| Cuerda semiestática (EN 1891) | 8 % | 6 kN | 75 kN |
| Dyneema / amsteel | 1,5 % | 6 kN | 400 kN |

La recta resultante queda más rígida que la cuerda real a carga baja, que es la
dirección conservadora para la fuerza pico. El largo por defecto pasó a **3,6 m**,
que es lo que se usa de verdad (12 pies nudo a nudo).

Un resultado del modelo que vale la pena mirar: **la cinta absorbe mucha más energía
que el leash**. En un vano de 70 m la cinta se estira más de un metro mientras el
leash da unos 30 cm, así que el material del leash cambia la fuerza pico bastante
menos de lo que se suele creer. En cintas cortas la proporción se invierte.

**Ahora se pide la estatura, y de ahí sale el cuerpo.** La cintura está a 0,58 de la
altura, y ese único número da las dos distancias que hacían falta: cuánto sobresale
el arnés sobre la cinta estando parado (0,97 m para 1,67 m de estatura, que valida el
1,0 que antes estaba fijo) y cuánto cuelgan las piernas por debajo del arnés. **La
altura libre principal se mide hasta los pies**, no hasta el arnés, porque los pies
son lo que llega al suelo.

**Terminología:** se dice CINTA y se dice SAG, en los diez idiomas. Hay un chequeo
automático que falla si alguna etiqueta de resultado vuelve a la palabra local.

**Exportar:** JPG, PNG y PDF, en versión compacta o ampliada, y compartir directo en
el celular. Sin dependencias nuevas: el SVG se rasteriza en un canvas y el PDF sale
del diálogo de impresión del navegador.

## Créditos

Desarrollado por [Bruno Rapa](https://github.com/rapabru)
([@brunorapavisuales](https://instagram.com/brunorapavisuales)).

Herramienta de estimación. La responsabilidad del rig es siempre de quien lo arma.

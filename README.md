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
| trickline 20 m @ 10 kN | 0,39 m | 1,9 % | 2,2° |
| longline 50 m @ 2,3 kN | 2,68 m | 5,4 % | 6,2° |
| midline 70 m @ 3,5 kN | 3,19 m | 4,6 % | 5,5° |
| highline 100 m @ 4 kN | 4,30 m | 4,3 % | 5,3° |

Los nombres son disciplinas, no una escala de largo. **Trickline y longline se
caminan sueltos**, sin leash ni backup, así que en esos dos la app oculta el cálculo
de caída: no hay nada que colgar. La trickline va tensadísima porque es la modalidad
de saltos —8 a 11 kN en reposo, con picos de 12 a 16 kN sobre los anclajes durante
las caídas, que este cálculo estático no cubre.

Las etiquetas de los escenarios sacan el vano del propio dato en vez de tenerlo
escrito en la traducción, para que no puedan quedar desfasadas cuando cambia un
preset.

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

**El leash se toma como inextensible.** Una cuerda dinámica sí estira —1,5 m a
2,9 kN dan unos 22 cm— pero toda la absorción relevante la hace la cinta: se hunde
varios metros contra esos centímetros, o sea el **97 % del recorrido de frenado**.
Ignorar el estiramiento sube la fuerza pico alrededor de un 3 %, así que el
resultado queda del lado conservador. El campo pide el **largo útil**: del anillo al
arnés y con los nudos ya hechos, 1,5 m por defecto (la cuerda entera mide 3–4 m en
highline, pero los nudos se la comen).

La distinción importa: entre 1,2 m y 2,2 m de largo útil, la altura libre al suelo en
un midline de 70 m pasa de +1,21 m a −0,25 m.

**Ahora se pide la estatura, y de ahí sale el cuerpo.** La cintura está a 0,58 de la
altura, y ese único número da las dos distancias que hacían falta: cuánto sobresale
el arnés sobre la cinta estando parado (0,97 m para 1,67 m de estatura, que valida el
1,0 que antes estaba fijo) y cuánto cuelgan las piernas por debajo del arnés. **La
altura libre principal se mide hasta los pies**, no hasta el arnés, porque los pies
son lo que llega al suelo.

**Terminología:** se dice CINTA y se dice SAG, en los diez idiomas. Hay un chequeo
automático que falla si alguna etiqueta de resultado vuelve a la palabra local.

**Tensión mínima:** debajo del control de pretensión aparece la tensión más baja con
la que la cinta no toca el suelo, calculada invirtiendo el mismo solver por bisección.
Se toca y se aplica. Cuando la configuración actual ya roza el piso, el atajo se
resalta en rojo.

**Presets propios:** se puede guardar la configuración completa y la cinta actual con
un nombre, y volver a ellas con un toque. Viven en `localStorage`; el formato lleva
`id` y `savedAt` para poder sincronizarlos cuando entre el login con cuenta.

**Guía de bienvenida:** un recorrido de cinco pasos que va señalando el gráfico, los
escenarios, el panel de caída y la exportación. Aparece la primera vez, se cierra
tocando afuera, y se vuelve a abrir desde el botón «?» de la barra.

**Exportar:** el botón vive en la barra superior, siempre a la vista. JPG, PNG y PDF,
con o sin los datos completos, con o sin el gráfico, y compartir directo en el celular. Sin dependencias nuevas: el SVG se rasteriza en un
canvas y el PDF sale del diálogo de impresión del navegador.

**El gráfico arranca con el eje vertical exagerado ×1,5**, porque a escala exacta el
sag suele ser tan chico frente al vano que cuesta leerlo. El cartel dice «no es
escala real» hasta que lo bajás a ×1. La figura de la persona nunca se estira con la
exageración: sólo se estiran los ejes.

## Cuenta e historial

Cada vez que cambiás la configuración y el resultado se asienta, queda una entrada en
el **historial**. Sólo se guardan las que cambian algo: mover un slider de ida y
vuelta hasta el mismo valor no deja rastro. Tocando una entrada volvés a esa
configuración.

El historial vive en `localStorage` y funciona sin conexión ni cuenta. Si además
configurás Supabase, aparece un botón de **entrar con Google** y el historial se
sincroniza entre dispositivos.

### Configurar Supabase (opcional, unos minutos)

1. Creá un proyecto en [supabase.com](https://supabase.com).
2. **Authentication → Providers → Google**: activalo y pegá el Client ID y Secret de
   una credencial OAuth de Google Cloud. En Google Cloud, la URI de redirección
   autorizada es la que Supabase te muestra ahí mismo
   (`https://<tu-proyecto>.supabase.co/auth/v1/callback`).
3. **Authentication → URL Configuration**: agregá tu dominio de Vercel y
   `http://localhost:5173` a las Redirect URLs.
4. **SQL Editor**: creá la tabla y sus políticas.

   ```sql
   create table public.sag_history (
     id        text primary key,
     user_id   uuid not null references auth.users (id) on delete cascade,
     saved_at  timestamptz not null default now(),
     input     jsonb not null,
     summary   jsonb not null
   );

   create index sag_history_user_saved on public.sag_history (user_id, saved_at desc);

   alter table public.sag_history enable row level security;

   -- Cada quien ve y escribe solamente sus propias filas.
   create policy "own rows" on public.sag_history
     for all
     using (auth.uid() = user_id)
     with check (auth.uid() = user_id);
   ```

5. Copiá `.env.example` a `.env.local` y completá `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` (Project Settings → API). En Vercel, cargalas como
   variables de entorno del proyecto.

La librería de Supabase se importa de forma dinámica y sólo cuando hay
credenciales, así que quien no usa la cuenta no descarga esos 57 kB.

## Créditos

Desarrollado por [Bruno Rapa](https://github.com/rapabru)
([@brunorapavisuales](https://instagram.com/brunorapavisuales)).

Herramienta de estimación. La responsabilidad del rig es siempre de quien lo arma.

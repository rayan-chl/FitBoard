import type { Exercise, Food, Profile, Recipe, RoutineDay, ShoppingItem } from './types'

// Valores por 100 g/ml. Carbohidratos SIN fibra (convención de etiquetas UE); fibra aparte.
// verified=true: valor contrastado con fuente durante la investigación (Open Food Facts, FatSecret ES,
// USDA FoodData Central, MAPA/Moreiras 2013). verified=false: referencia USDA SR Legacy o etiqueta típica:
// estimación editable, conviene contrastarla con la etiqueta de tu producto.

type SeedFood = Omit<Food, 'updatedAt' | 'custom'>

const f = (
  id: string,
  name: string,
  m: [number, number, number, number, number],
  opts: Partial<SeedFood> & { source: string; verified?: boolean },
): SeedFood => ({
  id,
  name,
  kcal: m[0],
  protein: m[1],
  carbs: m[2],
  fat: m[3],
  fiber: m[4],
  unit: 'g',
  state: 'crudo',
  verified: false,
  ...opts,
})

export const SEED_FOODS: SeedFood[] = [
  f('whey', 'Whey protein isolate', [370, 88, 2, 1, 0], { state: 'listo', unitWeight: 30, unitName: 'cacito', source: 'Rango típico de etiquetas (85-90 g P). Revisa tu marca.' }),
  f('leche-semi', 'Leche semidesnatada', [46, 3.1, 4.7, 1.55, 0], { unit: 'ml', state: 'listo', unitWeight: 250, unitName: 'vaso', source: 'Etiqueta típica España' }),
  f('avena', 'Copos de avena', [379, 13.2, 57.6, 6.5, 10.1], { state: 'seco', source: 'USDA FoodData Central', verified: true }),
  f('platano', 'Plátano', [89, 1.09, 20.24, 0.33, 2.6], { unitWeight: 120, unitName: 'unidad (pulpa)', source: 'USDA SR Legacy' }),
  f('pechuga', 'Pechuga de pollo (cruda, sin piel)', [120, 22.5, 0, 2.62, 0], { source: 'USDA SR Legacy (Foundation: 112 kcal, 1,9 g G)' }),
  f('muslo', 'Muslo de pollo sin piel (crudo)', [121, 19.66, 0, 4.12, 0], { source: 'USDA SR Legacy' }),
  f('pollo-piel', 'Pollo con piel (crudo)', [215, 18.6, 0, 15.06, 0], { source: 'USDA SR Legacy' }),
  f('arroz', 'Arroz blanco (seco)', [370, 7.04, 80.15, 1.03, 0.15], { state: 'seco', source: 'USDA FoodData Central', verified: true }),
  f('pasta', 'Pasta de trigo duro (seca)', [371, 13.04, 71.47, 1.51, 3.2], { state: 'seco', source: 'USDA SR Legacy (etiquetas ES ~350-360 kcal)' }),
  f('cuscus', 'Cuscús (seco)', [376, 12.76, 72.43, 0.64, 5], { state: 'seco', source: 'USDA SR Legacy' }),
  f('patata', 'Patata (cruda)', [77, 2.05, 15.39, 0.09, 2.1], { source: 'USDA SR Legacy' }),
  f('merluza', 'Merluza (cruda)', [89, 15.9, 0, 2.8, 0], { source: 'MAPA / Moreiras 2013', verified: true }),
  f('huevo', 'Huevo entero', [143, 12.56, 0.72, 9.51, 0], { unitWeight: 50, unitName: 'huevo M sin cáscara (L ≈ 57 g)', source: 'USDA SR Legacy' }),
  f('atun', 'Atún claro al natural (escurrido)', [100, 23, 0.7, 0.6, 0], { state: 'escurrido', unitWeight: 56, unitName: 'lata pequeña escurrida', source: 'Hacendado vía FatSecret ES', verified: true }),
  f('tomate', 'Tomate', [18, 0.88, 2.69, 0.2, 1.2], { unitWeight: 120, unitName: 'unidad mediana', source: 'USDA SR Legacy' }),
  f('tomate-triturado', 'Tomate triturado (conserva)', [32, 1.64, 5.39, 0.28, 1.9], { state: 'listo', source: 'USDA (etiquetas ES ~25-30 kcal)' }),
  f('queso-batido-0', 'Queso fresco batido 0%', [46, 8, 3.5, 0.1, 0], { state: 'listo', unitWeight: 250, unitName: 'tarrina', source: 'Hacendado vía Open Food Facts', verified: true }),
  f('pan', 'Pan blanco (barra)', [272, 10.75, 49.68, 2.42, 2.2], { state: 'listo', source: 'USDA (barras ES ~260-280 kcal)' }),
  f('manzana', 'Manzana con piel', [52, 0.26, 11.41, 0.17, 2.4], { unitWeight: 150, unitName: 'unidad', source: 'USDA SR Legacy' }),
  f('menestra', 'Verduras congeladas (menestra)', [45, 2.5, 6, 0.4, 4], { source: 'Estimación de etiquetas ES (muy variable)' }),
  f('zanahoria', 'Zanahoria', [41, 0.93, 6.78, 0.24, 2.8], { unitWeight: 70, unitName: 'unidad', source: 'USDA SR Legacy' }),
  f('aceite', 'Aceite de oliva', [884, 0, 0, 100, 0], { unit: 'ml', state: 'listo', unitWeight: 10, unitName: 'cucharada', source: 'USDA (≈0,92 g/ml; se registra como g≈ml)' }),
  f('lentejas', 'Lentejas (secas)', [351, 23.8, 54, 1.8, 11.7], { state: 'seco', source: 'MAPA / Moreiras 2013', verified: true }),
  f('canela', 'Canela molida', [247, 4, 27.6, 1.2, 53], { state: 'listo', source: 'USDA SR Legacy' }),
]

const r = (
  id: string,
  name: string,
  category: Recipe['category'],
  ingredients: [string, number][],
  notes?: string,
): Omit<Recipe, 'updatedAt'> => ({
  id,
  name,
  category,
  ingredients: ingredients.map(([foodId, grams]) => ({ foodId, grams })),
  servings: 1,
  favorite: false,
  builtin: true,
  notes,
})

// Los macros de las recetas NUNCA se guardan: se calculan siempre a partir de los ingredientes.
export const SEED_RECIPES = [
  r('batido', 'Batido de avena y proteína', 'desayuno', [['whey', 30], ['leche-semi', 250], ['avena', 50], ['platano', 120], ['canela', 2]], 'Desayuno habitual.'),
  r('pollo-arroz', 'Pollo con arroz y verduras', 'comida', [['pechuga', 180], ['arroz', 90], ['menestra', 150], ['aceite', 10]], 'Comida habitual. Arroz pesado en seco (×2,8 aprox. una vez cocido).'),
  r('pasta-pollo', 'Pasta con pollo y tomate', 'comida', [['pasta', 90], ['pechuga', 150], ['tomate-triturado', 150], ['aceite', 5]], 'Pasta pesada en seco.'),
  r('arroz-huevo-atun', 'Arroz con huevo y atún', 'comida', [['arroz', 90], ['huevo', 100], ['atun', 80], ['tomate', 100], ['aceite', 5]]),
  r('pollo-horno', 'Pollo al horno con patatas', 'comida', [['pechuga', 180], ['patata', 300], ['menestra', 100], ['aceite', 10]], 'Con pechuga. Si usas muslo o pollo con piel, cambia el ingrediente: con piel sube a ~750 kcal.'),
  r('cuscus-pollo', 'Cuscús con pollo', 'comida', [['cuscus', 80], ['pechuga', 150], ['menestra', 150], ['aceite', 5]]),
  r('merluza-patatas', 'Merluza con patatas', 'comida', [['merluza', 200], ['patata', 300], ['menestra', 150], ['aceite', 10]]),
  r('cena-habitual', 'Cena habitual: huevos, atún y patatas', 'cena', [['huevo', 100], ['atun', 56], ['patata', 300], ['tomate', 100], ['aceite', 10]], '2 huevos y 1 lata de atún (peso escurrido editable).'),
  r('tortilla-atun', 'Tortilla con atún y patata', 'cena', [['huevo', 100], ['atun', 80], ['patata', 300], ['tomate', 100], ['aceite', 5]]),
  r('pasta-atun', 'Pasta con atún', 'cena', [['pasta', 80], ['atun', 120], ['tomate-triturado', 150], ['aceite', 5]]),
  r('merienda', 'Queso fresco batido con fruta y pan', 'merienda', [['queso-batido-0', 250], ['manzana', 150], ['pan', 40]], 'Con manzana. Si cambias a plátano, sube a ~357 kcal.'),
]

const ex = (
  id: string,
  name: string,
  kind: Exercise['kind'],
  incrementKg: number,
  defaultRestSec: number,
  primary: string[],
  secondary: string[] = [],
  main = false,
): Exercise => ({ id, name, kind, incrementKg, defaultRestSec, primary, secondary, main })

export const SEED_EXERCISES: Exercise[] = [
  ex('press-banca', 'Press banca', 'weight', 2.5, 150, ['Pecho'], ['Tríceps', 'Hombro anterior'], true),
  ex('press-inclinado', 'Press inclinado', 'weight', 2.5, 150, ['Pecho'], ['Hombro anterior', 'Tríceps']),
  ex('press-hombros', 'Press hombros', 'weight', 2.5, 150, ['Hombro anterior'], ['Tríceps', 'Hombro lateral'], true),
  ex('elev-laterales', 'Elevaciones laterales', 'weight', 1, 90, ['Hombro lateral']),
  ex('ext-triceps', 'Extensión tríceps en polea', 'weight', 2.5, 90, ['Tríceps']),
  ex('jalon', 'Jalón al pecho', 'weight', 2.5, 150, ['Espalda'], ['Bíceps'], true),
  ex('remo-sentado', 'Remo sentado', 'weight', 2.5, 150, ['Espalda'], ['Bíceps', 'Hombro posterior'], true),
  ex('remo-apoyado', 'Remo con pecho apoyado', 'weight', 2.5, 120, ['Espalda'], ['Hombro posterior', 'Bíceps']),
  ex('face-pulls', 'Face pulls', 'weight', 2.5, 90, ['Hombro posterior'], ['Espalda']),
  ex('curl-biceps', 'Curl bíceps', 'weight', 1, 90, ['Bíceps']),
  ex('curl-martillo', 'Curl martillo', 'weight', 1, 90, ['Bíceps'], ['Antebrazo']),
  ex('prensa', 'Prensa', 'weight', 5, 150, ['Cuádriceps'], ['Glúteos'], true),
  ex('pm-rumano', 'Peso muerto rumano', 'weight', 5, 150, ['Isquios'], ['Glúteos', 'Lumbar'], true),
  ex('curl-femoral', 'Curl femoral', 'weight', 2.5, 90, ['Isquios']),
  ex('ext-cuadriceps', 'Extensión de cuádriceps', 'weight', 2.5, 90, ['Cuádriceps']),
  ex('gemelos', 'Gemelos', 'weight', 5, 90, ['Gemelos']),
  ex('crunch-polea', 'Crunch en polea', 'weight', 2.5, 90, ['Core']),
  ex('pallof', 'Pallof press', 'weight', 2.5, 60, ['Core']),
  ex('plancha-lateral', 'Plancha lateral', 'time', 0, 60, ['Core']),
  ex('dead-bug', 'Dead bug', 'reps', 0, 60, ['Core']),
]

const p = (exerciseId: string, sets: number, repMin: number, repMax = repMin, note?: string) => ({ exerciseId, sets, repMin, repMax, note })

export const SEED_ROUTINE: RoutineDay[] = [
  { isoDay: 1, name: 'PUSH', type: 'gym', description: 'Pecho, hombros y tríceps', activities: [], exercises: [p('press-banca', 3, 8, 10), p('press-inclinado', 3, 10), p('press-hombros', 3, 10), p('elev-laterales', 3, 15), p('ext-triceps', 3, 12)] },
  { isoDay: 2, name: 'PULL', type: 'gym', description: 'Espalda, bíceps y deltoides posteriores', activities: [], exercises: [p('jalon', 3, 10), p('remo-sentado', 3, 10), p('remo-apoyado', 2, 12), p('face-pulls', 3, 15), p('curl-biceps', 3, 12), p('curl-martillo', 2, 12)] },
  { isoDay: 3, name: 'RECUPERACIÓN', type: 'rest', description: 'Recuperación', activities: ['Caminata', 'Movilidad', 'Descanso muscular'], exercises: [] },
  { isoDay: 4, name: 'LEGS', type: 'gym', description: 'Piernas', activities: [], exercises: [p('prensa', 3, 10), p('pm-rumano', 3, 10), p('curl-femoral', 3, 12), p('ext-cuadriceps', 2, 12), p('gemelos', 3, 15)] },
  { isoDay: 5, name: 'DESCANSO', type: 'rest', description: 'Actividad cotidiana y recuperación', activities: ['Actividad cotidiana', 'Recuperación'], exercises: [] },
  { isoDay: 6, name: 'CORE + ACCESORIOS', type: 'gym', description: 'Core y accesorios', activities: [], exercises: [p('crunch-polea', 3, 15), p('pallof', 3, 12, 12, 'por lado'), p('plancha-lateral', 3, 30, 30, 'segundos por lado'), p('dead-bug', 3, 10, 10, 'por lado'), p('elev-laterales', 3, 15), p('curl-biceps', 2, 12), p('ext-triceps', 2, 12), p('gemelos', 2, 15)] },
  { isoDay: 7, name: 'RECUPERACIÓN ACTIVA', type: 'rest', description: 'Recuperación activa', activities: ['Paseo', 'Descanso', 'Preparación de comidas'], exercises: [] },
]

const s = (name: string, qty: string, category: string, order: number): ShoppingItem => ({ id: `shop-${order}`, name, qty, category, price: null, bought: false, order })

export const SEED_SHOPPING: ShoppingItem[] = [
  s('Pollo (pechuga)', '1,5 kg', 'Proteína', 1),
  s('Huevos', '18 uds', 'Proteína', 2),
  s('Atún al natural', '5-6 latas', 'Proteína', 3),
  s('Queso fresco batido 0%', '1 kg', 'Lácteos', 4),
  s('Leche semidesnatada', '2 L', 'Lácteos', 5),
  s('Copos de avena', '1 paquete', 'Despensa', 6),
  s('Arroz', '1 kg', 'Despensa', 7),
  s('Pasta', '1 paquete', 'Despensa', 8),
  s('Patatas', '1 bolsa', 'Fruta y verdura', 9),
  s('Pan', 'según consumo', 'Despensa', 10),
  s('Verduras congeladas', '2 bolsas', 'Congelados', 11),
  s('Zanahorias', '1 bolsa', 'Fruta y verdura', 12),
  s('Tomates', '1 kg', 'Fruta y verdura', 13),
  s('Tomate triturado', '2 botes', 'Despensa', 14),
  s('Plátanos', '7 uds', 'Fruta y verdura', 15),
  s('Manzanas', '7 uds', 'Fruta y verdura', 16),
  s('Lentejas (opcional, según tolerancia)', '1 bote', 'Despensa', 17),
  s('Aceite de oliva', 'si hace falta', 'Despensa', 18),
]

export const defaultProfile = (today: string): Profile => ({
  id: 'profile',
  heightCm: 175,
  age: 25,
  sex: 'hombre',
  startWeight: 89,
  goalWeight: 82,
  laterGoal: '76-80 kg, según evolución',
  goal: 'Recomposición corporal: perder grasa desarrollando masa muscular',
  activityFactor: 1.55,
  targets: { kcal: 2250, protein: 150, carbs: 250, fat: 70, waterMl: 2500 },
  weeklyBudget: 50,
  startDate: today,
  waistSite: 'Punto medio entre la última costilla y la cresta ilíaca, al final de una espiración normal (OMS)',
  progressTrigger: 'all_sets',
})

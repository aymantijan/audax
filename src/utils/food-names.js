// French names for the food database (chantier 6): the database keeps its
// English names (saved meals refer to them), these let « riz », « poulet » or
// « pain complet » find the right food. Most specific first: the first alias
// contained in what was typed wins.
export const FOOD_NAMES_FR = [
  ['blanc de poulet', 'Chicken breast'], ['escalope de poulet', 'Chicken breast'], ['cuisse de poulet', 'Chicken thigh'], ['poulet', 'Chicken breast'],
  ['saumon', 'Salmon'], ['thon', 'Tuna (canned)'], ['crevette', 'Shrimp'], ['cabillaud', 'Cod'], ['morue', 'Cod'], ['côte de porc', 'Pork chop'],
  ['agneau', 'Lamb'], ['mouton', 'Lamb'], ['lardon', 'Bacon'], ['bacon', 'Bacon'], ['jambon', 'Ham'],
  ['blanc d’œuf', 'Egg whites'], ["blanc d'oeuf", 'Egg whites'], ['blanc d oeuf', 'Egg whites'], ['œuf', 'Eggs'], ['oeuf', 'Eggs'],
  ['yaourt grec', 'Greek yogurt (plain)'], ['yaourt aux fruits', 'Yogurt (flavored)'], ['yaourt sucré', 'Yogurt (flavored)'], ['yaourt', 'Greek yogurt (plain)'],
  ['fromage blanc', 'Cottage cheese'], ['cottage', 'Cottage cheese'], ['viande hachée', 'Beef (ground, 90/10)'], ['steak haché', 'Beef (ground, 90/10)'],
  ['bœuf', 'Beef (lean)'], ['boeuf', 'Beef (lean)'], ['steak', 'Beef (lean)'], ['dinde', 'Turkey breast'], ['whey', 'Whey protein (scoop, 30g)'], ['protéine en poudre', 'Whey protein (scoop, 30g)'],
  ['tofu', 'Tofu'], ['tempeh', 'Tempeh'], ['edamame', 'Edamame'], ['lentille', 'Lentils (cooked)'], ['pois chiche', 'Chickpeas (cooked)'],
  ['haricot noir', 'Black beans (cooked)'], ['haricot rouge', 'Kidney beans (cooked)'], ['haricot vert', 'Green beans'],
  ['riz complet', 'Brown rice (cooked)'], ['riz', 'White rice (cooked)'], ['flocons d’avoine', 'Oats (dry)'], ["flocons d'avoine", 'Oats (dry)'], ['avoine', 'Oats (dry)'],
  ['porridge', 'Oatmeal with fruit'], ['patate douce', 'Sweet potato'], ['pomme de terre', 'Potato'], ['frites', 'French fries'],
  ['pain complet', 'Whole wheat bread'], ['khobz', 'Khobz (Moroccan bread)'], ['pain', 'White bread'], ['pâtes', 'Pasta (cooked)'], ['pates', 'Pasta (cooked)'],
  ['spaghetti', 'Pasta (cooked)'], ['quinoa', 'Quinoa (cooked)'], ['couscous', 'Couscous (cooked)'], ['boulgour', 'Bulgur (cooked)'], ['maïs', 'Corn'], ['mais', 'Corn'],
  ['céréales', 'Cereal (bran flakes)'], ['granola', 'Granola'], ['muesli', 'Granola'], ['galette de blé', 'Tortilla (flour)'], ['tortilla', 'Tortilla (flour)'],
  ['banane', 'Banana'], ['pomme', 'Apple'], ['jus d’orange', 'Orange juice'], ["jus d'orange", 'Orange juice'], ['orange', 'Orange'], ['fruits rouges', 'Berries (mixed)'],
  ['fraise', 'Strawberries'], ['raisin', 'Grapes'], ['mangue', 'Mango'], ['ananas', 'Pineapple'], ['pastèque', 'Watermelon'], ['datte', 'Dates'], ['poire', 'Pear'], ['kiwi', 'Kiwi'],
  ['brocoli', 'Broccoli'], ['épinard', 'Spinach'], ['epinard', 'Spinach'], ['chou kale', 'Kale'], ['salade', 'Mixed salad greens'], ['carotte', 'Carrots'],
  ['tomate', 'Tomato'], ['concombre', 'Cucumber'], ['poivron', 'Bell pepper'], ['oignon', 'Onion'], ['ail', 'Garlic'], ['chou-fleur', 'Cauliflower'], ['chou fleur', 'Cauliflower'],
  ['courgette', 'Zucchini'], ['champignon', 'Mushroom'], ['asperge', 'Asparagus'], ['avocat', 'Avocado'], ['amande', 'Almonds'], ['noix de cajou', 'Cashews'], ['noix', 'Walnuts'],
  ['beurre de cacahuète', 'Peanut butter'], ['beurre de cacahuete', 'Peanut butter'], ["beurre d'amande", 'Almond butter'], ['cacahuète', 'Peanuts'], ['cacahuete', 'Peanuts'],
  ['graines de chia', 'Chia seeds'], ['chia', 'Chia seeds'], ['graines de lin', 'Flaxseed'], ['lin', 'Flaxseed'], ["huile d'olive", 'Olive oil'], ['huile d’olive', 'Olive oil'], ['huile', 'Olive oil'],
  ['beurre', 'Butter'], ['lait écrémé', 'Milk (skim)'], ['lait ecreme', 'Milk (skim)'], ["lait d'amande", 'Almond milk (unsweetened)'], ['lben', 'Lben (Moroccan buttermilk)'], ['lait', 'Milk (whole)'],
  ['cheddar', 'Cheese (cheddar)'], ['mozzarella', 'Mozzarella'], ['parmesan', 'Parmesan'], ['fromage frais', 'Cream cheese'], ['fromage', 'Cheese (cheddar)'],
  ['miel', 'Honey'], ['sirop d’érable', 'Maple syrup'], ["sirop d'érable", 'Maple syrup'], ['ketchup', 'Ketchup'], ['mayonnaise', 'Mayonnaise'], ['houmous', 'Hummus'], ['hummus', 'Hummus'],
  ['sauce salsa', 'Salsa'], ['café', 'Coffee (black)'], ['cafe', 'Coffee (black)'], ['thé', 'Tea (unsweetened)'], ['the', 'Tea (unsweetened)'], ['bière', 'Beer'], ['biere', 'Beer'], ['vin', 'Wine (red)'],
  ['barre protéinée', 'Protein bar'], ['barre de céréales', 'Protein bar'], ['pizza', 'Pizza (slice)'], ['burger', 'Burger (fast food)'], ['hamburger', 'Burger (fast food)'],
  ['soda', 'Soda (regular)'], ['coca', 'Soda (regular)'], ['chocolat', 'Chocolate bar'], ['glace', 'Ice cream'], ['chips', 'Chips / crisps'], ['nouilles', 'Instant noodles'],
  ['beignet', 'Donut'], ['donut', 'Donut'], ['biscuit', 'Cookie'], ['gâteau sec', 'Cookie'], ['croissant', 'Croissant'], ['bonbon', 'Candy (gummy)'], ['sushi', 'Sushi roll'],
  ['sandwich', 'Sandwich (turkey)'], ['wok', 'Stir fry (chicken & veg)'], ['sauté de poulet', 'Stir fry (chicken & veg)'], ['taco', 'Taco'], ['burrito', 'Burrito'], ['sardine', 'Sardines (canned)'],
];

const norm = (s) => String(s || '').trim().toLowerCase().replace(/’/g, "'");

// French (or any alias) → database name, or null.
export function frenchToFood(name) {
  const q = norm(name);
  if (!q) return null;
  const exact = FOOD_NAMES_FR.find(([fr]) => norm(fr) === q);
  if (exact) return exact[1];
  const words = ` ${q.replace(/[^a-zà-ÿœ' -]/g, ' ')} `;
  const inside = FOOD_NAMES_FR.find(([fr]) => words.includes(` ${norm(fr)} `) || words.includes(` ${norm(fr)}s `) || words.includes(` ${norm(fr)}x `));
  return inside ? inside[1] : null;
}

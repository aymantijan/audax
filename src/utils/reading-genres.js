export const GENRE_GROUPS = [
  {
    group: 'Fiction',
    items: [
      'Action & Adventure', 'Crime', 'Dystopian', 'Fantasy', 'Historical Fiction', 'Horror',
      'Humor & Satire', 'Literary Fiction', 'Magical Realism', 'Mystery', 'Romance',
      'Science Fiction', 'Speculative Fiction', 'Thriller & Suspense', "Women's Fiction",
    ],
  },
  {
    group: 'Non-Fiction',
    items: [
      'Art & Architecture', 'Autobiography', 'Biography', 'Business & Economics',
      'Cookbooks & Culinary', 'Essays', 'Health & Fitness', 'History', 'Humor & Entertainment',
      'Memoir', 'Philosophy', 'Politics & Current Events', 'Religion & Spirituality',
      'Science & Nature', 'Self-Help & Personal Development', 'Travel', 'True Crime',
    ],
  },
  {
    group: 'Finance',
    items: ['Trading', 'Finance & Investing', 'Personal Finance'],
  },
];

export const GENRES = GENRE_GROUPS.flatMap((g) => g.items);

// French display names (chantier 6): stored genres stay in English (books and
// the catalog refer to them), only what is shown changes.
export const GENRE_FR = {
  Fiction: 'Fiction', 'Non-Fiction': 'Non-fiction',
  'Action & Adventure': 'Action et aventure', Crime: 'Policier', Dystopian: 'Dystopie', Fantasy: 'Fantasy',
  'Historical Fiction': 'Roman historique', Horror: 'Horreur', 'Humor & Satire': 'Humour et satire',
  'Literary Fiction': 'Littérature', 'Magical Realism': 'Réalisme magique', Mystery: 'Mystère', Romance: 'Romance',
  'Science Fiction': 'Science-fiction', 'Speculative Fiction': 'Fiction spéculative', 'Thriller & Suspense': 'Thriller et suspense',
  "Women's Fiction": 'Roman de femmes', 'Art & Architecture': 'Art et architecture', Autobiography: 'Autobiographie',
  Biography: 'Biographie', 'Business & Economics': 'Économie et entreprise', 'Cookbooks & Culinary': 'Cuisine',
  Essays: 'Essais', 'Health & Fitness': 'Santé et forme', History: 'Histoire', 'Humor & Entertainment': 'Humour et divertissement',
  Memoir: 'Mémoires', Philosophy: 'Philosophie', 'Politics & Current Events': 'Politique et actualité',
  'Religion & Spirituality': 'Religion et spiritualité', 'Science & Nature': 'Sciences et nature',
  'Self-Help & Personal Development': 'Développement personnel', Travel: 'Voyage', 'True Crime': 'Faits divers',
  Finance: 'Finance', Trading: 'Trading', 'Finance & Investing': 'Finance et investissement', 'Personal Finance': 'Éducation financière',
};
export const genreLabel = (g) => GENRE_FR[g] || g || '';

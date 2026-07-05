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
];

export const GENRES = GENRE_GROUPS.flatMap((g) => g.items);

// Extension du catalogue (v3) — fusionnée par readingsStore.seedCatalog(),
// qui déduplique par titre|auteur et respecte les suppressions de l'utilisateur.
// Quatre volets :
//   A. Renforcement des auteurs déjà présents (plus de leurs œuvres)
//   B. Laurent Gounelle (romans de développement personnel)
//   C. Auteurs anti-religion / nouvel athéisme
//   D. Textes religieux & sacrés de toutes les confessions
//   E. Nouveaux auteurs majeurs (littérature mondiale, philosophie…)

export const BOOK_CATALOG_V3 = [
  // ═══════════════ A. RENFORCEMENT DES AUTEURS EXISTANTS ═══════════════

  // ── Stephen King ──
  { title: 'The Gunslinger', author: 'Stephen King', genre: 'Fantasy', year: 1982, pages: 224, popularity: 85, description: 'The Dark Tower begins: a gunslinger chases the man in black across a desert.' },
  { title: 'Under the Dome', author: 'Stephen King', genre: 'Science Fiction', year: 2009, pages: 1074, popularity: 84, description: 'A town is sealed off by a mysterious invisible dome.' },
  { title: 'The Institute', author: 'Stephen King', genre: 'Thriller & Suspense', year: 2019, pages: 561, popularity: 83, description: 'Gifted children are held and experimented on in a secret facility.' },
  { title: 'Christine', author: 'Stephen King', genre: 'Horror', year: 1983, pages: 526, popularity: 80, description: 'A vintage car with a murderous will of its own.' },
  { title: 'Cujo', author: 'Stephen King', genre: 'Horror', year: 1981, pages: 319, popularity: 79, description: 'A rabid St. Bernard traps a mother and son.' },
  { title: 'Needful Things', author: 'Stephen King', genre: 'Horror', year: 1991, pages: 690, popularity: 80, description: "A shop owner sells townspeople their heart's desire — at a terrible price." },
  { title: 'Different Seasons', author: 'Stephen King', genre: 'Literary Fiction', year: 1982, pages: 527, popularity: 85, description: 'Four novellas including the source of Shawshank and Stand By Me.' },

  // ── Agatha Christie ──
  { title: 'The Mysterious Affair at Styles', author: 'Agatha Christie', genre: 'Mystery', year: 1920, pages: 296, popularity: 82, description: "Poirot's very first case: a poisoning at a country estate." },
  { title: 'Evil Under the Sun', author: 'Agatha Christie', genre: 'Mystery', year: 1941, pages: 250, popularity: 83, description: 'A strangling at a sun-soaked island resort.' },
  { title: 'A Murder Is Announced', author: 'Agatha Christie', genre: 'Mystery', year: 1950, pages: 256, popularity: 84, description: 'A newspaper ad invites the village to a murder — Miss Marple investigates.' },
  { title: 'Crooked House', author: 'Agatha Christie', genre: 'Mystery', year: 1949, pages: 224, popularity: 82, description: 'A patriarch is poisoned in a house full of suspects.' },
  { title: 'The Body in the Library', author: 'Agatha Christie', genre: 'Mystery', year: 1942, pages: 224, popularity: 81, description: 'A stranger\'s body appears in a respectable library.' },

  // ── J.R.R. Tolkien ──
  { title: 'Unfinished Tales', author: 'J.R.R. Tolkien', genre: 'Fantasy', year: 1980, pages: 472, popularity: 78, description: 'Deeper lore and untold stories of Middle-earth.' },
  { title: 'The Children of Húrin', author: 'J.R.R. Tolkien', genre: 'Fantasy', year: 2007, pages: 313, popularity: 79, description: 'A tragic epic of the First Age of Middle-earth.' },

  // ── Brandon Sanderson ──
  { title: 'The Well of Ascension', author: 'Brandon Sanderson', genre: 'Fantasy', year: 2007, pages: 590, popularity: 88, description: 'Mistborn book two: holding a kingdom is harder than taking it.' },
  { title: 'The Hero of Ages', author: 'Brandon Sanderson', genre: 'Fantasy', year: 2008, pages: 572, popularity: 89, description: 'The Mistborn trilogy reaches its cataclysmic end.' },
  { title: 'Oathbringer', author: 'Brandon Sanderson', genre: 'Fantasy', year: 2017, pages: 1248, popularity: 89, description: 'The Stormlight Archive book three.' },
  { title: 'Rhythm of War', author: 'Brandon Sanderson', genre: 'Fantasy', year: 2020, pages: 1232, popularity: 88, description: 'The Stormlight Archive book four.' },
  { title: 'Warbreaker', author: 'Brandon Sanderson', genre: 'Fantasy', year: 2009, pages: 592, popularity: 84, description: 'Two princesses, returned gods, and Breath-based magic.' },
  { title: 'Skyward', author: 'Brandon Sanderson', genre: 'Science Fiction', year: 2018, pages: 513, popularity: 84, description: 'A girl dreams of becoming a fighter pilot against alien invaders.' },

  // ── George R.R. Martin ──
  { title: 'Fire & Blood', author: 'George R.R. Martin', genre: 'Fantasy', year: 2018, pages: 736, popularity: 84, description: 'The history of House Targaryen — basis for House of the Dragon.' },

  // ── Terry Pratchett ──
  { title: 'Reaper Man', author: 'Terry Pratchett', genre: 'Humor & Satire', year: 1991, pages: 287, popularity: 84, description: 'Death is made redundant — with chaotic consequences.' },
  { title: 'Night Watch', author: 'Terry Pratchett', genre: 'Humor & Satire', year: 2002, pages: 480, popularity: 87, description: 'Commander Vimes is flung back in time in his own city.' },
  { title: 'Hogfather', author: 'Terry Pratchett', genre: 'Humor & Satire', year: 1996, pages: 354, popularity: 85, description: "Discworld's Santa vanishes and Death fills in." },
  { title: 'Wyrd Sisters', author: 'Terry Pratchett', genre: 'Humor & Satire', year: 1988, pages: 265, popularity: 83, description: 'Three witches, a murdered king, and a nod to Macbeth.' },
  { title: 'Thief of Time', author: 'Terry Pratchett', genre: 'Humor & Satire', year: 2001, pages: 384, popularity: 83, description: 'A perfect clock threatens to stop time itself.' },

  // ── Neil Gaiman ──
  { title: 'The Graveyard Book', author: 'Neil Gaiman', genre: 'Fantasy', year: 2008, pages: 312, popularity: 86, description: 'A boy is raised by the ghosts of a graveyard.' },
  { title: 'Anansi Boys', author: 'Neil Gaiman', genre: 'Fantasy', year: 2005, pages: 336, popularity: 83, description: 'The sons of a trickster god discover each other.' },
  { title: 'Norse Mythology', author: 'Neil Gaiman', genre: 'Fantasy', year: 2017, pages: 304, popularity: 85, description: 'The Norse myths retold from creation to Ragnarök.' },
  { title: 'The Sandman: Preludes & Nocturnes', author: 'Neil Gaiman', genre: 'Fantasy', year: 1989, pages: 240, popularity: 87, description: 'The Lord of Dreams escapes captivity — landmark graphic novel.' },

  // ── Isaac Asimov ──
  { title: 'The Gods Themselves', author: 'Isaac Asimov', genre: 'Science Fiction', year: 1972, pages: 288, popularity: 84, description: 'Parallel universes trade energy — and risk everything.' },
  { title: 'The End of Eternity', author: 'Isaac Asimov', genre: 'Science Fiction', year: 1955, pages: 191, popularity: 83, description: 'Time-travelers engineer history from outside of time.' },
  { title: 'The Naked Sun', author: 'Isaac Asimov', genre: 'Science Fiction', year: 1957, pages: 187, popularity: 80, description: 'Detective Baley and R. Daneel solve a murder on Solaria.' },
  { title: 'Prelude to Foundation', author: 'Isaac Asimov', genre: 'Science Fiction', year: 1988, pages: 403, popularity: 81, description: 'Young Hari Seldon invents psychohistory on the run.' },

  // ── Frank Herbert ──
  { title: 'God Emperor of Dune', author: 'Frank Herbert', genre: 'Science Fiction', year: 1981, pages: 423, popularity: 80, description: 'Leto II rules for millennia as a human-sandworm hybrid.' },

  // ── Ray Bradbury ──
  { title: 'Dandelion Wine', author: 'Ray Bradbury', genre: 'Literary Fiction', year: 1957, pages: 239, popularity: 82, description: 'A lyrical remembrance of one boyhood summer.' },
  { title: 'The Illustrated Man', author: 'Ray Bradbury', genre: 'Science Fiction', year: 1951, pages: 186, popularity: 82, description: 'Eighteen stories told by a man\'s living tattoos.' },

  // ── Ursula K. Le Guin ──
  { title: 'The Tombs of Atuan', author: 'Ursula K. Le Guin', genre: 'Fantasy', year: 1971, pages: 180, popularity: 82, description: 'Earthsea book two: a priestess of the dark powers.' },
  { title: 'The Lathe of Heaven', author: 'Ursula K. Le Guin', genre: 'Science Fiction', year: 1971, pages: 184, popularity: 82, description: 'A man whose dreams rewrite reality.' },

  // ── Cormac McCarthy ──
  { title: 'Suttree', author: 'Cormac McCarthy', genre: 'Literary Fiction', year: 1979, pages: 471, popularity: 80, description: 'A man abandons privilege to live among the outcasts of Knoxville.' },
  { title: 'The Crossing', author: 'Cormac McCarthy', genre: 'Literary Fiction', year: 1994, pages: 426, popularity: 81, description: 'Border Trilogy two: a boy and a she-wolf cross into Mexico.' },
  { title: 'The Passenger', author: 'Cormac McCarthy', genre: 'Literary Fiction', year: 2022, pages: 400, popularity: 78, description: 'A salvage diver, a sunken jet, and a missing passenger.' },

  // ── Kazuo Ishiguro ──
  { title: 'An Artist of the Floating World', author: 'Kazuo Ishiguro', genre: 'Literary Fiction', year: 1986, pages: 206, popularity: 80, description: 'A painter reckons with his role in wartime Japan.' },
  { title: 'The Buried Giant', author: 'Kazuo Ishiguro', genre: 'Fantasy', year: 2015, pages: 317, popularity: 78, description: 'An elderly couple journeys through a mist of forgetting.' },

  // ── Margaret Atwood ──
  { title: 'The Blind Assassin', author: 'Margaret Atwood', genre: 'Literary Fiction', year: 2000, pages: 521, popularity: 84, description: 'A story within a story within a story — Booker Prize winner.' },
  { title: "Cat's Eye", author: 'Margaret Atwood', genre: 'Literary Fiction', year: 1988, pages: 446, popularity: 81, description: 'A painter confronts the cruelties of childhood friendship.' },

  // ── Haruki Murakami ──
  { title: 'Hard-Boiled Wonderland and the End of the World', author: 'Haruki Murakami', genre: 'Magical Realism', year: 1985, pages: 400, popularity: 84, description: 'Two surreal narratives braid toward one mind.' },
  { title: 'Colorless Tsukuru Tazaki and His Years of Pilgrimage', author: 'Haruki Murakami', genre: 'Literary Fiction', year: 2013, pages: 386, popularity: 82, description: 'A man revisits the friends who abruptly cut him off.' },
  { title: 'Sputnik Sweetheart', author: 'Haruki Murakami', genre: 'Magical Realism', year: 1999, pages: 229, popularity: 80, description: 'Love, longing, and a disappearance on a Greek island.' },
  { title: 'Killing Commendatore', author: 'Haruki Murakami', genre: 'Magical Realism', year: 2017, pages: 704, popularity: 80, description: 'A portrait painter, a hidden painting, and a metaphysical rabbit hole.' },

  // ── Gabriel García Márquez ──
  { title: 'The Autumn of the Patriarch', author: 'Gabriel García Márquez', genre: 'Magical Realism', year: 1975, pages: 272, popularity: 80, description: 'The interior life of an eternal Caribbean dictator.' },
  { title: 'No One Writes to the Colonel', author: 'Gabriel García Márquez', genre: 'Literary Fiction', year: 1961, pages: 62, popularity: 79, description: 'An old colonel waits, week after week, for a pension that never comes.' },

  // ── Charles Dickens ──
  { title: 'Bleak House', author: 'Charles Dickens', genre: 'Literary Fiction', year: 1853, pages: 989, popularity: 83, description: 'An endless lawsuit poisons everyone it touches.' },
  { title: 'Hard Times', author: 'Charles Dickens', genre: 'Literary Fiction', year: 1854, pages: 288, popularity: 80, description: 'Fact-worship and industry crush the human spirit.' },
  { title: 'Nicholas Nickleby', author: 'Charles Dickens', genre: 'Literary Fiction', year: 1839, pages: 777, popularity: 79, description: 'A young man battles a villainous uncle and a monstrous school.' },
  { title: 'Little Dorrit', author: 'Charles Dickens', genre: 'Literary Fiction', year: 1857, pages: 902, popularity: 78, description: 'Debt, prison, and quiet devotion in Victorian London.' },

  // ── Jane Austen ──
  { title: 'Northanger Abbey', author: 'Jane Austen', genre: 'Romance', year: 1817, pages: 251, popularity: 80, description: "A gothic-obsessed young woman's coming of age." },

  // ── John Steinbeck ──
  { title: 'Cannery Row', author: 'John Steinbeck', genre: 'Literary Fiction', year: 1945, pages: 208, popularity: 83, description: 'The warm, ramshackle life of a Monterey street.' },
  { title: 'Tortilla Flat', author: 'John Steinbeck', genre: 'Literary Fiction', year: 1935, pages: 207, popularity: 79, description: 'A band of carefree paisanos in Monterey.' },
  { title: 'The Winter of Our Discontent', author: 'John Steinbeck', genre: 'Literary Fiction', year: 1961, pages: 298, popularity: 80, description: 'A good man weighs his soul against ambition.' },

  // ── Ken Follett ──
  { title: 'A Column of Fire', author: 'Ken Follett', genre: 'Historical Fiction', year: 2017, pages: 916, popularity: 82, description: 'Kingsbridge in the age of religious wars and Elizabeth I.' },
  { title: 'The Evening and the Morning', author: 'Ken Follett', genre: 'Historical Fiction', year: 2020, pages: 913, popularity: 82, description: 'The prequel to Pillars of the Earth, at the dawn of England.' },
  { title: 'Winter of the World', author: 'Ken Follett', genre: 'Historical Fiction', year: 2012, pages: 940, popularity: 81, description: 'The Century Trilogy through World War II.' },

  // ── John Grisham ──
  { title: 'The Rainmaker', author: 'John Grisham', genre: 'Thriller & Suspense', year: 1995, pages: 598, popularity: 82, description: 'A rookie lawyer takes on a corrupt insurance giant.' },
  { title: 'The Runaway Jury', author: 'John Grisham', genre: 'Thriller & Suspense', year: 1996, pages: 401, popularity: 81, description: 'A juror and a mystery woman manipulate a tobacco trial.' },
  { title: 'Sycamore Row', author: 'John Grisham', genre: 'Thriller & Suspense', year: 2013, pages: 447, popularity: 80, description: 'Jake Brigance returns for a contested handwritten will.' },

  // ── Dan Brown ──
  { title: 'The Lost Symbol', author: 'Dan Brown', genre: 'Thriller & Suspense', year: 2009, pages: 509, popularity: 79, description: 'Langdon races through the secret history of Washington, D.C.' },
  { title: 'Origin', author: 'Dan Brown', genre: 'Thriller & Suspense', year: 2017, pages: 461, popularity: 78, description: 'A discovery threatens to answer where we came from and where we\'re going.' },

  // ── Fyodor Dostoevsky ──
  { title: 'Demons', author: 'Fyodor Dostoevsky', genre: 'Literary Fiction', year: 1872, pages: 768, popularity: 82, description: 'Revolutionary nihilism tears a Russian town apart.' },
  { title: 'The Gambler', author: 'Fyodor Dostoevsky', genre: 'Literary Fiction', year: 1867, pages: 208, popularity: 81, description: 'Obsession and roulette, written under a brutal deadline.' },
  { title: 'White Nights', author: 'Fyodor Dostoevsky', genre: 'Literary Fiction', year: 1848, pages: 96, popularity: 82, description: 'A dreamer and a lonely woman meet over four St. Petersburg nights.' },

  // ── Leo Tolstoy ──
  { title: 'Resurrection', author: 'Leo Tolstoy', genre: 'Literary Fiction', year: 1899, pages: 576, popularity: 79, description: 'A nobleman seeks redemption for a woman he wronged.' },
  { title: 'Hadji Murat', author: 'Leo Tolstoy', genre: 'Historical Fiction', year: 1912, pages: 144, popularity: 80, description: 'A Chechen commander caught between empire and rebellion.' },

  // ── Ernest Hemingway ──
  { title: 'A Moveable Feast', author: 'Ernest Hemingway', genre: 'Memoir', year: 1964, pages: 240, popularity: 85, description: 'His years as a young writer in 1920s Paris.' },
  { title: 'To Have and Have Not', author: 'Ernest Hemingway', genre: 'Literary Fiction', year: 1937, pages: 262, popularity: 78, description: 'A fishing-boat captain drifts into smuggling in the Depression.' },

  // ── Kurt Vonnegut ──
  { title: 'The Sirens of Titan', author: 'Kurt Vonnegut', genre: 'Science Fiction', year: 1959, pages: 319, popularity: 83, description: 'Free will, fate, and a message spanning the galaxy.' },
  { title: 'Mother Night', author: 'Kurt Vonnegut', genre: 'Literary Fiction', year: 1961, pages: 282, popularity: 82, description: 'An American spy plays a Nazi propagandist too well.' },
  { title: 'God Bless You, Mr. Rosewater', author: 'Kurt Vonnegut', genre: 'Humor & Satire', year: 1965, pages: 288, popularity: 79, description: 'A rich man decides to simply love the poor.' },

  // ── Albert Camus ──
  { title: 'The Fall', author: 'Albert Camus', genre: 'Literary Fiction', year: 1956, pages: 147, popularity: 84, description: 'A confession in an Amsterdam bar about guilt and judgement.' },
  { title: 'The Rebel', author: 'Albert Camus', genre: 'Philosophy', year: 1951, pages: 320, popularity: 79, description: 'On rebellion, revolution, and the limits of both.' },

  // ── Franz Kafka ──
  { title: 'Amerika', author: 'Franz Kafka', genre: 'Literary Fiction', year: 1927, pages: 318, popularity: 76, description: 'A young immigrant adrift in a dreamlike America.' },
  { title: 'The Complete Stories', author: 'Franz Kafka', genre: 'Literary Fiction', year: 1971, pages: 488, popularity: 82, description: 'Every short story, from "The Judgment" to "A Hunger Artist".' },

  // ── Friedrich Nietzsche ──
  { title: 'The Gay Science', author: 'Friedrich Nietzsche', genre: 'Philosophy', year: 1882, pages: 396, popularity: 80, description: '"God is dead" — and the joyful wisdom that must follow.' },
  { title: 'Twilight of the Idols', author: 'Friedrich Nietzsche', genre: 'Philosophy', year: 1889, pages: 144, popularity: 78, description: 'Philosophizing with a hammer.' },
  { title: 'The Antichrist', author: 'Friedrich Nietzsche', genre: 'Philosophy', year: 1895, pages: 128, popularity: 76, description: 'A ferocious polemic against Christianity.' },

  // ── Victor Hugo ──
  { title: 'Ninety-Three', author: 'Victor Hugo', genre: 'Historical Fiction', year: 1874, pages: 400, popularity: 76, description: 'The Revolution\'s bloodiest year, and the humanity within it.' },

  // ── Paulo Coelho ──
  { title: 'Veronika Decides to Die', author: 'Paulo Coelho', genre: 'Literary Fiction', year: 1998, pages: 210, popularity: 82, description: 'A young woman rediscovers life inside an asylum.' },
  { title: 'Eleven Minutes', author: 'Paulo Coelho', genre: 'Literary Fiction', year: 2003, pages: 273, popularity: 80, description: 'A young woman\'s search for love and self through the body.' },
  { title: 'Brida', author: 'Paulo Coelho', genre: 'Literary Fiction', year: 1990, pages: 266, popularity: 76, description: 'An Irish girl seeks knowledge of magic and love.' },
  { title: 'The Zahir', author: 'Paulo Coelho', genre: 'Literary Fiction', year: 2005, pages: 336, popularity: 77, description: 'A man obsessively searches for his vanished wife.' },

  // ── C.S. Lewis (au-delà de Narnia & Mere Christianity) ──
  { title: 'The Great Divorce', author: 'C.S. Lewis', genre: 'Religion & Spirituality', year: 1945, pages: 160, popularity: 84, description: 'A bus ride from hell to the outskirts of heaven.' },
  { title: 'The Problem of Pain', author: 'C.S. Lewis', genre: 'Religion & Spirituality', year: 1940, pages: 176, popularity: 81, description: 'Why a good God permits suffering.' },
  { title: 'A Grief Observed', author: 'C.S. Lewis', genre: 'Memoir', year: 1961, pages: 96, popularity: 83, description: 'Raw journals written after his wife\'s death.' },
  { title: 'The Four Loves', author: 'C.S. Lewis', genre: 'Religion & Spirituality', year: 1960, pages: 192, popularity: 82, description: 'Affection, friendship, eros, and charity.' },
  { title: 'Prince Caspian', author: 'C.S. Lewis', genre: 'Fantasy', year: 1951, pages: 240, popularity: 86, description: 'The Pevensies return to a conquered Narnia.' },
  { title: 'The Voyage of the Dawn Treader', author: 'C.S. Lewis', genre: 'Fantasy', year: 1952, pages: 256, popularity: 86, description: 'A sea voyage to the edge of the Narnian world.' },

  // ── Robert Greene ──
  { title: 'The Art of Seduction', author: 'Robert Greene', genre: 'Self-Help & Personal Development', year: 2001, pages: 512, popularity: 82, description: 'The timeless tactics of charm and persuasion.' },
  { title: 'The 50th Law', author: 'Robert Greene', genre: 'Self-Help & Personal Development', year: 2009, pages: 291, popularity: 80, description: 'Fearlessness, with rapper 50 Cent as the case study.' },

  // ── Ryan Holiday ──
  { title: 'Discipline Is Destiny', author: 'Ryan Holiday', genre: 'Self-Help & Personal Development', year: 2022, pages: 320, popularity: 82, description: 'The power of self-control — the Stoic virtue of temperance.' },
  { title: 'Courage Is Calling', author: 'Ryan Holiday', genre: 'Self-Help & Personal Development', year: 2021, pages: 304, popularity: 80, description: 'Fortune favors the brave — the virtue of courage.' },
  { title: 'Trust Me, I\'m Lying', author: 'Ryan Holiday', genre: 'Business & Economics', year: 2012, pages: 320, popularity: 79, description: 'Confessions of a media manipulator.' },

  // ── Malcolm Gladwell ──
  { title: 'David and Goliath', author: 'Malcolm Gladwell', genre: 'Self-Help & Personal Development', year: 2013, pages: 305, popularity: 82, description: 'Underdogs, misfits, and the art of battling giants.' },
  { title: 'The Bomber Mafia', author: 'Malcolm Gladwell', genre: 'History', year: 2021, pages: 256, popularity: 79, description: 'A dream of precision bombing and the fire that followed.' },

  // ── Cal Newport ──
  { title: 'A World Without Email', author: 'Cal Newport', genre: 'Self-Help & Personal Development', year: 2021, pages: 320, popularity: 79, description: 'Reimagining work in an age of communication overload.' },
  { title: 'Slow Productivity', author: 'Cal Newport', genre: 'Self-Help & Personal Development', year: 2024, pages: 256, popularity: 80, description: 'The lost art of accomplishment without burnout.' },

  // ── Yuval Noah Harari ──
  { title: 'Nexus', author: 'Yuval Noah Harari', genre: 'History', year: 2024, pages: 528, popularity: 84, description: 'A brief history of information networks from the Stone Age to AI.' },

  // ── Walter Isaacson ──
  { title: 'Elon Musk', author: 'Walter Isaacson', genre: 'Biography', year: 2023, pages: 688, popularity: 85, description: 'The authorized biography of the Tesla and SpaceX founder.' },
  { title: 'Kissinger: A Biography', author: 'Walter Isaacson', genre: 'Biography', year: 1992, pages: 896, popularity: 77, description: 'The controversial statesman who shaped the Cold War.' },

  // ── Ron Chernow ──
  { title: 'Grant', author: 'Ron Chernow', genre: 'Biography', year: 2017, pages: 1104, popularity: 82, description: 'The general who won the Civil War and the presidency that followed.' },
  { title: 'The House of Morgan', author: 'Ron Chernow', genre: 'History', year: 1990, pages: 812, popularity: 80, description: 'A dynasty of American finance across a century.' },

  // ── Nassim Nicholas Taleb ──
  { title: 'The Bed of Procrustes', author: 'Nassim Nicholas Taleb', genre: 'Philosophy', year: 2010, pages: 176, popularity: 76, description: 'Philosophical and practical aphorisms.' },

  // ═══════════════ B. LAURENT GOUNELLE ═══════════════
  { title: 'L\'homme qui voulait être heureux', author: 'Laurent Gounelle', genre: 'Self-Help & Personal Development', year: 2008, pages: 175, popularity: 84, description: 'À Bali, un guérisseur bouleverse la vie d\'un professeur en quête de bonheur.' },
  { title: 'Les dieux voyagent toujours incognito', author: 'Laurent Gounelle', genre: 'Self-Help & Personal Development', year: 2010, pages: 380, popularity: 82, description: 'Un homme au bord du suicide accepte un étrange pacte pour transformer sa vie.' },
  { title: 'Le philosophe qui n\'était pas sage', author: 'Laurent Gounelle', genre: 'Self-Help & Personal Development', year: 2012, pages: 384, popularity: 80, description: 'Un homme veut se venger d\'une tribu heureuse — et apprend le vrai sens du bonheur.' },
  { title: 'Le jour où j\'ai appris à vivre', author: 'Laurent Gounelle', genre: 'Self-Help & Personal Development', year: 2014, pages: 300, popularity: 83, description: 'Une voyante annonce à Jonathan qu\'il ne lui reste que peu de temps à vivre.' },
  { title: 'Intuitio', author: 'Laurent Gounelle', genre: 'Thriller & Suspense', year: 2016, pages: 384, popularity: 78, description: 'Un thriller où le FBI recrute un homme doué d\'une intuition extraordinaire.' },
  { title: 'Je te promets la liberté', author: 'Laurent Gounelle', genre: 'Self-Help & Personal Development', year: 2018, pages: 384, popularity: 79, description: 'Une jeune femme découvre qu\'elle peut incarner d\'autres personnalités en elle.' },
  { title: 'Le réveil', author: 'Laurent Gounelle', genre: 'Self-Help & Personal Development', year: 2022, pages: 336, popularity: 78, description: 'Un roman sur la manipulation des masses et l\'éveil des consciences.' },
  { title: 'Une prière oubliée', author: 'Laurent Gounelle', genre: 'Self-Help & Personal Development', year: 2024, pages: 336, popularity: 77, description: 'Un secret enfoui dans un village fait resurgir une sagesse oubliée.' },

  // ═══════════════ C. AUTEURS ANTI-RELIGION / NOUVEL ATHÉISME ═══════════════

  // ── Christopher Hitchens ──
  { title: 'God Is Not Great', author: 'Christopher Hitchens', genre: 'Religion & Spirituality', year: 2007, pages: 307, popularity: 84, description: 'How religion poisons everything — the atheist manifesto.' },
  { title: 'Mortality', author: 'Christopher Hitchens', genre: 'Memoir', year: 2012, pages: 104, popularity: 82, description: 'Facing terminal cancer with unflinching honesty.' },
  { title: 'Hitch-22', author: 'Christopher Hitchens', genre: 'Memoir', year: 2010, pages: 448, popularity: 80, description: 'The memoir of a fearless contrarian.' },
  { title: 'The Portable Atheist', author: 'Christopher Hitchens', genre: 'Religion & Spirituality', year: 2007, pages: 528, popularity: 76, description: 'Essential readings for the nonbeliever, edited and introduced.' },

  // ── Sam Harris ──
  { title: 'The End of Faith', author: 'Sam Harris', genre: 'Religion & Spirituality', year: 2004, pages: 336, popularity: 82, description: 'Religion, terror, and the future of reason.' },
  { title: 'Letter to a Christian Nation', author: 'Sam Harris', genre: 'Religion & Spirituality', year: 2006, pages: 96, popularity: 79, description: 'A concise challenge to the foundations of faith.' },
  { title: 'Waking Up', author: 'Sam Harris', genre: 'Religion & Spirituality', year: 2014, pages: 256, popularity: 81, description: 'Spirituality without religion — a guide to secular contemplation.' },
  { title: 'The Moral Landscape', author: 'Sam Harris', genre: 'Philosophy', year: 2010, pages: 320, popularity: 78, description: 'How science can determine human values.' },
  { title: 'Free Will', author: 'Sam Harris', genre: 'Philosophy', year: 2012, pages: 96, popularity: 80, description: 'A brief, bracing argument that free will is an illusion.' },

  // ── Richard Dawkins (au-delà de The God Delusion) ──
  { title: 'The Blind Watchmaker', author: 'Richard Dawkins', genre: 'Science & Nature', year: 1986, pages: 496, popularity: 83, description: 'Why the evidence of evolution reveals a universe without design.' },
  { title: 'The Greatest Show on Earth', author: 'Richard Dawkins', genre: 'Science & Nature', year: 2009, pages: 470, popularity: 82, description: 'The overwhelming evidence for evolution.' },
  { title: 'Outgrowing God', author: 'Richard Dawkins', genre: 'Religion & Spirituality', year: 2019, pages: 304, popularity: 78, description: 'A beginner\'s guide to thinking beyond belief.' },
  { title: 'The Magic of Reality', author: 'Richard Dawkins', genre: 'Science & Nature', year: 2011, pages: 271, popularity: 80, description: 'How we really know what\'s true.' },

  // ── Daniel Dennett ──
  { title: 'Breaking the Spell', author: 'Daniel Dennett', genre: 'Religion & Spirituality', year: 2006, pages: 464, popularity: 77, description: 'Religion examined as a natural phenomenon.' },
  { title: "Darwin's Dangerous Idea", author: 'Daniel Dennett', genre: 'Science & Nature', year: 1995, pages: 586, popularity: 79, description: 'Evolution as universal acid, dissolving old certainties.' },
  { title: 'Consciousness Explained', author: 'Daniel Dennett', genre: 'Philosophy', year: 1991, pages: 511, popularity: 78, description: 'A bold materialist theory of the mind.' },

  // ── Bertrand Russell ──
  { title: 'Why I Am Not a Christian', author: 'Bertrand Russell', genre: 'Religion & Spirituality', year: 1927, pages: 266, popularity: 80, description: 'The classic essays on religion and free thought.' },
  { title: 'The Conquest of Happiness', author: 'Bertrand Russell', genre: 'Self-Help & Personal Development', year: 1930, pages: 192, popularity: 82, description: 'A philosopher\'s practical prescription for a happy life.' },
  { title: 'A History of Western Philosophy', author: 'Bertrand Russell', genre: 'Philosophy', year: 1945, pages: 895, popularity: 83, description: 'Twenty-five centuries of thought, wittily surveyed.' },
  { title: 'The Problems of Philosophy', author: 'Bertrand Russell', genre: 'Philosophy', year: 1912, pages: 176, popularity: 79, description: 'A lucid introduction to the great philosophical questions.' },

  // ── Autres voix critiques ──
  { title: 'Traité d\'athéologie', author: 'Michel Onfray', genre: 'Religion & Spirituality', year: 2005, pages: 281, popularity: 76, description: 'Une critique frontale des trois monothéismes (Atheist Manifesto).' },
  { title: 'The God Argument', author: 'A.C. Grayling', genre: 'Religion & Spirituality', year: 2013, pages: 269, popularity: 74, description: 'The case against religion and for humanism.' },
  { title: 'Infidel', author: 'Ayaan Hirsi Ali', genre: 'Memoir', year: 2007, pages: 353, popularity: 80, description: 'From a Somali childhood to a fierce critic of religious extremism.' },
  { title: 'The Demon in the Freezer', author: 'Richard Preston', genre: 'Science & Nature', year: 2002, pages: 292, popularity: 74, description: 'Smallpox as a weapon — a science thriller of real events.' },

  // ═══════════════ D. TEXTES RELIGIEUX & SACRÉS (toutes confessions) ═══════════════

  // ── Islam ──
  { title: 'The Holy Qur\'an (Translation)', author: 'Abdullah Yusuf Ali', genre: 'Religion & Spirituality', year: 1934, pages: 1862, popularity: 90, description: 'The most widely read English translation and commentary of the Qur\'an.' },
  { title: 'Sahih al-Bukhari', author: 'Imam al-Bukhari', genre: 'Religion & Spirituality', year: 846, pages: 2000, popularity: 85, description: 'The most authenticated collection of the sayings of the Prophet ﷺ.' },
  { title: 'Riyad as-Salihin', author: 'Imam al-Nawawi', genre: 'Religion & Spirituality', year: 1273, pages: 800, popularity: 84, description: 'The Gardens of the Righteous — a beloved compendium of hadith.' },
  { title: 'The Forty Hadith', author: 'Imam al-Nawawi', genre: 'Religion & Spirituality', year: 1270, pages: 128, popularity: 84, description: 'Forty foundational sayings, memorized across the Muslim world.' },
  { title: 'The Revival of the Religious Sciences (Ihya Ulum al-Din)', author: 'Al-Ghazali', genre: 'Religion & Spirituality', year: 1105, pages: 1600, popularity: 82, description: 'Al-Ghazali\'s masterwork on inner and outer Islamic practice.' },
  { title: 'The Alchemy of Happiness', author: 'Al-Ghazali', genre: 'Religion & Spirituality', year: 1105, pages: 110, popularity: 82, description: 'A condensed guide to knowing oneself, the world, and God.' },
  { title: 'Deliverance from Error', author: 'Al-Ghazali', genre: 'Religion & Spirituality', year: 1108, pages: 100, popularity: 80, description: 'The spiritual autobiography of one of Islam\'s greatest thinkers.' },
  { title: 'Fortress of the Muslim (Hisn al-Muslim)', author: 'Sa\'id ibn Wahf al-Qahtani', genre: 'Religion & Spirituality', year: 1988, pages: 240, popularity: 82, description: 'Invocations and supplications for every occasion.' },

  // ── Christianity ──
  { title: 'The Holy Bible (King James Version)', author: 'Various', genre: 'Religion & Spirituality', year: 1611, pages: 1200, popularity: 90, description: 'The King James Bible — a cornerstone of English literature and faith.' },
  { title: 'The Confessions', author: 'Saint Augustine', genre: 'Religion & Spirituality', year: 400, pages: 416, popularity: 84, description: 'The first great spiritual autobiography of the West.' },
  { title: 'The City of God', author: 'Saint Augustine', genre: 'Religion & Spirituality', year: 426, pages: 1152, popularity: 79, description: 'A vast defense of Christianity against a collapsing Rome.' },
  { title: 'The Imitation of Christ', author: 'Thomas à Kempis', genre: 'Religion & Spirituality', year: 1418, pages: 218, popularity: 82, description: 'The most read Christian devotional after the Bible.' },
  { title: 'The Pilgrim\'s Progress', author: 'John Bunyan', genre: 'Religion & Spirituality', year: 1678, pages: 336, popularity: 81, description: "Christian's allegorical journey from the City of Destruction." },
  { title: 'The Practice of the Presence of God', author: 'Brother Lawrence', genre: 'Religion & Spirituality', year: 1692, pages: 96, popularity: 82, description: 'Finding God in the quiet of everyday work.' },
  { title: 'The Interior Castle', author: 'Teresa of Ávila', genre: 'Religion & Spirituality', year: 1588, pages: 240, popularity: 78, description: 'A mystical map of the soul\'s journey to God.' },
  { title: 'The Cost of Discipleship', author: 'Dietrich Bonhoeffer', genre: 'Religion & Spirituality', year: 1937, pages: 320, popularity: 81, description: 'On "cheap grace" and the true cost of following Christ.' },
  { title: 'Orthodoxy', author: 'G.K. Chesterton', genre: 'Religion & Spirituality', year: 1908, pages: 168, popularity: 81, description: 'A witty, joyful defense of the Christian faith.' },
  { title: 'The Purpose Driven Life', author: 'Rick Warren', genre: 'Religion & Spirituality', year: 2002, pages: 334, popularity: 82, description: 'A 40-day guide to discovering why you exist.' },

  // ── Judaism ──
  { title: 'The Guide for the Perplexed', author: 'Maimonides', genre: 'Religion & Spirituality', year: 1190, pages: 640, popularity: 78, description: 'Reconciling reason and faith — a pillar of Jewish philosophy.' },
  { title: 'When Bad Things Happen to Good People', author: 'Harold S. Kushner', genre: 'Religion & Spirituality', year: 1981, pages: 176, popularity: 82, description: 'A rabbi confronts the problem of suffering.' },
  { title: 'The Sabbath', author: 'Abraham Joshua Heschel', genre: 'Religion & Spirituality', year: 1951, pages: 128, popularity: 79, description: 'A meditation on holiness in time.' },
  { title: 'The Chosen', author: 'Chaim Potok', genre: 'Literary Fiction', year: 1967, pages: 304, popularity: 82, description: 'A friendship between two Jewish boys in 1940s Brooklyn.' },

  // ── Hinduism ──
  { title: 'The Bhagavad Gita', author: 'Vyasa', genre: 'Religion & Spirituality', year: -200, pages: 250, popularity: 87, description: 'Krishna\'s counsel to Arjuna on duty, action, and the soul.' },
  { title: 'The Upanishads', author: 'Various', genre: 'Religion & Spirituality', year: -600, pages: 464, popularity: 80, description: 'The philosophical heart of the Vedas.' },
  { title: 'Autobiography of a Yogi', author: 'Paramahansa Yogananda', genre: 'Religion & Spirituality', year: 1946, pages: 481, popularity: 84, description: 'A yogi\'s journey and encounters with saints and masters.' },
  { title: 'The Ramayana', author: 'Valmiki', genre: 'Religion & Spirituality', year: -400, pages: 900, popularity: 81, description: 'The epic of Rama, Sita, and the triumph of dharma.' },

  // ── Buddhism ──
  { title: 'The Dhammapada', author: 'The Buddha', genre: 'Religion & Spirituality', year: -300, pages: 128, popularity: 84, description: 'The sayings of the Buddha, path of wisdom.' },
  { title: 'What the Buddha Taught', author: 'Walpola Rahula', genre: 'Religion & Spirituality', year: 1959, pages: 151, popularity: 83, description: 'The clearest introduction to core Buddhist teaching.' },
  { title: 'The Tibetan Book of Living and Dying', author: 'Sogyal Rinpoche', genre: 'Religion & Spirituality', year: 1992, pages: 425, popularity: 82, description: 'A spiritual classic on life, death, and rebirth.' },
  { title: 'The Heart of the Buddha\'s Teaching', author: 'Thich Nhat Hanh', genre: 'Religion & Spirituality', year: 1998, pages: 294, popularity: 83, description: 'Transforming suffering into peace, joy, and liberation.' },

  // ── Comparative / Spiritual classics ──
  { title: 'A History of God', author: 'Karen Armstrong', genre: 'Religion & Spirituality', year: 1993, pages: 511, popularity: 82, description: 'Four thousand years of the idea of God in three faiths.' },
  { title: 'The Case for God', author: 'Karen Armstrong', genre: 'Religion & Spirituality', year: 2009, pages: 432, popularity: 78, description: 'What religion really means, beyond the modern debate.' },
  { title: 'The Varieties of Religious Experience', author: 'William James', genre: 'Religion & Spirituality', year: 1902, pages: 534, popularity: 79, description: 'The founding psychological study of religious life.' },
  { title: 'The Power of Myth', author: 'Joseph Campbell', genre: 'Religion & Spirituality', year: 1988, pages: 293, popularity: 84, description: 'Myth, ritual, and meaning across cultures.' },
  { title: 'The Hero with a Thousand Faces', author: 'Joseph Campbell', genre: 'Religion & Spirituality', year: 1949, pages: 432, popularity: 84, description: "The monomyth — the hero's journey behind every legend." },
  { title: 'The Prophet', author: 'Kahlil Gibran', genre: 'Religion & Spirituality', year: 1923, pages: 127, popularity: 86, description: 'Poetic counsel on love, work, joy, and sorrow.' },
  { title: 'The Analects', author: 'Confucius', genre: 'Philosophy', year: -450, pages: 176, popularity: 82, description: 'The sayings that shaped East Asian civilization.' },
  { title: 'I and Thou', author: 'Martin Buber', genre: 'Religion & Spirituality', year: 1923, pages: 185, popularity: 77, description: 'Encounter, relationship, and the sacred between us.' },
  { title: 'The Seven Storey Mountain', author: 'Thomas Merton', genre: 'Memoir', year: 1948, pages: 462, popularity: 79, description: 'A restless young man\'s path to a Trappist monastery.' },

  // ═══════════════ E. NOUVEAUX AUTEURS MAJEURS ═══════════════

  // ── Hermann Hesse ──
  { title: 'Siddhartha', author: 'Hermann Hesse', genre: 'Literary Fiction', year: 1922, pages: 152, popularity: 89, description: 'A seeker\'s journey to enlightenment in ancient India.' },
  { title: 'Steppenwolf', author: 'Hermann Hesse', genre: 'Literary Fiction', year: 1927, pages: 237, popularity: 84, description: 'A man torn between his human and wolfish natures.' },
  { title: 'The Glass Bead Game', author: 'Hermann Hesse', genre: 'Literary Fiction', year: 1943, pages: 558, popularity: 80, description: 'A Nobel-winning vision of an intellectual utopia.' },
  { title: 'Narcissus and Goldmund', author: 'Hermann Hesse', genre: 'Literary Fiction', year: 1930, pages: 320, popularity: 81, description: 'The lives of an ascetic and a wanderer diverge and entwine.' },
  { title: 'Demian', author: 'Hermann Hesse', genre: 'Literary Fiction', year: 1919, pages: 176, popularity: 82, description: 'A boy\'s awakening under a mysterious mentor.' },

  // ── Jean-Paul Sartre & Simone de Beauvoir ──
  { title: 'Nausea', author: 'Jean-Paul Sartre', genre: 'Literary Fiction', year: 1938, pages: 253, popularity: 80, description: 'The novel that gave existentialism a face.' },
  { title: 'No Exit', author: 'Jean-Paul Sartre', genre: 'Literary Fiction', year: 1944, pages: 64, popularity: 81, description: '"Hell is other people" — three souls locked together forever.' },
  { title: 'Existentialism Is a Humanism', author: 'Jean-Paul Sartre', genre: 'Philosophy', year: 1946, pages: 108, popularity: 79, description: 'The accessible lecture that defined a movement.' },
  { title: 'The Second Sex', author: 'Simone de Beauvoir', genre: 'Philosophy', year: 1949, pages: 800, popularity: 82, description: 'The foundational work of modern feminism.' },
  { title: 'The Ethics of Ambiguity', author: 'Simone de Beauvoir', genre: 'Philosophy', year: 1947, pages: 176, popularity: 76, description: 'An existentialist ethics of freedom.' },

  // ── Marcel Proust ──
  { title: 'Swann\'s Way', author: 'Marcel Proust', genre: 'Literary Fiction', year: 1913, pages: 606, popularity: 82, description: 'In Search of Lost Time begins — memory, love, and a madeleine.' },

  // ── Umberto Eco ──
  { title: 'The Name of the Rose', author: 'Umberto Eco', genre: 'Historical Fiction', year: 1980, pages: 536, popularity: 85, description: 'A medieval monastery, a series of deaths, and a labyrinthine library.' },
  { title: 'Foucault\'s Pendulum', author: 'Umberto Eco', genre: 'Mystery', year: 1988, pages: 641, popularity: 80, description: 'Three editors invent a conspiracy that turns terrifyingly real.' },

  // ── Italo Calvino ──
  { title: 'Invisible Cities', author: 'Italo Calvino', genre: 'Literary Fiction', year: 1972, pages: 165, popularity: 84, description: 'Marco Polo describes impossible cities to Kublai Khan.' },
  { title: 'If on a winter\'s night a traveler', author: 'Italo Calvino', genre: 'Literary Fiction', year: 1979, pages: 260, popularity: 82, description: 'A novel about reading the novel you are reading.' },

  // ── Jorge Luis Borges ──
  { title: 'Ficciones', author: 'Jorge Luis Borges', genre: 'Literary Fiction', year: 1944, pages: 174, popularity: 85, description: 'Labyrinths, infinite libraries, and mind-bending fictions.' },
  { title: 'The Aleph', author: 'Jorge Luis Borges', genre: 'Literary Fiction', year: 1949, pages: 208, popularity: 82, description: 'Stories where a single point contains the entire universe.' },

  // ── José Saramago ──
  { title: 'Blindness', author: 'José Saramago', genre: 'Literary Fiction', year: 1995, pages: 352, popularity: 84, description: 'An epidemic of white blindness unravels society.' },
  { title: 'The Gospel According to Jesus Christ', author: 'José Saramago', genre: 'Literary Fiction', year: 1991, pages: 377, popularity: 78, description: 'A humane, controversial reimagining of the life of Jesus.' },

  // ── Milan Kundera ──
  { title: 'The Unbearable Lightness of Being', author: 'Milan Kundera', genre: 'Literary Fiction', year: 1984, pages: 314, popularity: 85, description: 'Love and lightness under the weight of Prague, 1968.' },
  { title: 'The Book of Laughter and Forgetting', author: 'Milan Kundera', genre: 'Literary Fiction', year: 1979, pages: 320, popularity: 79, description: 'Memory, politics, and laughter in seven variations.' },

  // ── Naguib Mahfouz ──
  { title: 'Palace Walk', author: 'Naguib Mahfouz', genre: 'Literary Fiction', year: 1956, pages: 498, popularity: 82, description: 'The Cairo Trilogy opens on a family under British rule.' },
  { title: 'Midaq Alley', author: 'Naguib Mahfouz', genre: 'Literary Fiction', year: 1947, pages: 288, popularity: 80, description: 'Life and longing in a Cairo backstreet.' },

  // ── Orhan Pamuk ──
  { title: 'My Name Is Red', author: 'Orhan Pamuk', genre: 'Historical Fiction', year: 1998, pages: 448, popularity: 82, description: 'Murder among the miniaturists of the Ottoman court.' },
  { title: 'Snow', author: 'Orhan Pamuk', genre: 'Literary Fiction', year: 2002, pages: 426, popularity: 79, description: 'A poet returns to a snowbound Turkish town in political ferment.' },

  // ── Chinua Achebe & littérature africaine ──
  { title: 'Things Fall Apart', author: 'Chinua Achebe', genre: 'Literary Fiction', year: 1958, pages: 209, popularity: 88, description: 'A proud Igbo leader and the coming of the colonizers.' },
  { title: 'Season of Migration to the North', author: 'Tayeb Salih', genre: 'Literary Fiction', year: 1966, pages: 169, popularity: 79, description: 'A Sudanese classic on colonialism, identity, and return.' },
  { title: 'Half of a Yellow Sun', author: 'Chimamanda Ngozi Adichie', genre: 'Historical Fiction', year: 2006, pages: 448, popularity: 85, description: 'Love and survival during the Biafran war.' },
  { title: 'Americanah', author: 'Chimamanda Ngozi Adichie', genre: 'Literary Fiction', year: 2013, pages: 477, popularity: 85, description: 'Race, love, and belonging across Nigeria and America.' },
  { title: 'Homegoing', author: 'Yaa Gyasi', genre: 'Historical Fiction', year: 2016, pages: 305, popularity: 84, description: 'Two half-sisters and the branching legacy of slavery.' },

  // ── Russian classics (au-delà de Tolstoy/Dostoevsky) ──
  { title: 'The Master and Margarita', author: 'Mikhail Bulgakov', genre: 'Magical Realism', year: 1967, pages: 384, popularity: 86, description: 'The devil visits Soviet Moscow — a subversive masterpiece.' },
  { title: 'One Day in the Life of Ivan Denisovich', author: 'Aleksandr Solzhenitsyn', genre: 'Historical Fiction', year: 1962, pages: 182, popularity: 83, description: 'A single day in a Stalinist labor camp.' },
  { title: 'The Gulag Archipelago', author: 'Aleksandr Solzhenitsyn', genre: 'History', year: 1973, pages: 660, popularity: 82, description: 'The definitive account of the Soviet prison system.' },
  { title: 'Doctor Zhivago', author: 'Boris Pasternak', genre: 'Historical Fiction', year: 1957, pages: 592, popularity: 82, description: 'Love and poetry through the Russian Revolution.' },
  { title: 'Dead Souls', author: 'Nikolai Gogol', genre: 'Literary Fiction', year: 1842, pages: 464, popularity: 80, description: 'A conman buys the deeds to dead serfs — comic and profound.' },
  { title: 'Fathers and Sons', author: 'Ivan Turgenev', genre: 'Literary Fiction', year: 1862, pages: 226, popularity: 79, description: 'Generational conflict and Russian nihilism.' },

  // ── Thomas Mann & German letters ──
  { title: 'The Magic Mountain', author: 'Thomas Mann', genre: 'Literary Fiction', year: 1924, pages: 706, popularity: 80, description: 'Time and ideas dilate in an Alpine sanatorium.' },
  { title: 'Death in Venice', author: 'Thomas Mann', genre: 'Literary Fiction', year: 1912, pages: 142, popularity: 80, description: 'An aging writer\'s fatal obsession with beauty.' },
  { title: 'Faust', author: 'Johann Wolfgang von Goethe', genre: 'Literary Fiction', year: 1808, pages: 158, popularity: 80, description: 'The scholar who wagers his soul with the devil.' },

  // ── French classics (au-delà de Hugo/Camus/Balzac/Zola) ──
  { title: 'Candide', author: 'Voltaire', genre: 'Humor & Satire', year: 1759, pages: 144, popularity: 84, description: 'A merciless satire of blind optimism — "all for the best".' },
  { title: 'The Red and the Black', author: 'Stendhal', genre: 'Literary Fiction', year: 1830, pages: 576, popularity: 80, description: 'Ambition and hypocrisy in Restoration France.' },
  { title: 'Bel-Ami', author: 'Guy de Maupassant', genre: 'Literary Fiction', year: 1885, pages: 384, popularity: 79, description: 'A charming opportunist claws his way up Parisian society.' },
  { title: 'Wind, Sand and Stars', author: 'Antoine de Saint-Exupéry', genre: 'Memoir', year: 1939, pages: 229, popularity: 82, description: 'Lyrical reflections from the golden age of aviation.' },

  // ── English & American classics ──
  { title: 'Heart of Darkness', author: 'Joseph Conrad', genre: 'Literary Fiction', year: 1899, pages: 96, popularity: 82, description: 'A journey up the Congo into the darkness of empire and self.' },
  { title: 'Tess of the d\'Urbervilles', author: 'Thomas Hardy', genre: 'Literary Fiction', year: 1891, pages: 592, popularity: 82, description: 'A poor woman crushed by fate and social hypocrisy.' },
  { title: 'Middlemarch', author: 'George Eliot', genre: 'Literary Fiction', year: 1872, pages: 904, popularity: 84, description: 'A panoramic study of provincial English lives.' },
  { title: 'The Portrait of a Lady', author: 'Henry James', genre: 'Literary Fiction', year: 1881, pages: 656, popularity: 79, description: 'A spirited American heiress and the trap of a bad marriage.' },
  { title: 'The Age of Innocence', author: 'Edith Wharton', genre: 'Literary Fiction', year: 1920, pages: 301, popularity: 82, description: 'Desire versus duty in Gilded Age New York.' },
  { title: 'A Passage to India', author: 'E.M. Forster', genre: 'Literary Fiction', year: 1924, pages: 362, popularity: 80, description: 'A misunderstanding exposes the fault lines of the British Raj.' },
  { title: 'Sons and Lovers', author: 'D.H. Lawrence', genre: 'Literary Fiction', year: 1913, pages: 464, popularity: 78, description: 'A young man torn between his mother and his lovers.' },
  { title: 'Invisible Man', author: 'Ralph Ellison', genre: 'Literary Fiction', year: 1952, pages: 581, popularity: 84, description: 'A Black man\'s search for identity in a country that won\'t see him.' },
  { title: 'Their Eyes Were Watching God', author: 'Zora Neale Hurston', genre: 'Literary Fiction', year: 1937, pages: 219, popularity: 83, description: 'A woman\'s quest for love and self in the Black South.' },
  { title: 'The Color Purple', author: 'Alice Walker', genre: 'Literary Fiction', year: 1982, pages: 295, popularity: 85, description: 'Letters trace one woman\'s triumph over cruelty.' },

  // ── Contemporary literary heavyweights ──
  { title: 'The Secret History', author: 'Donna Tartt', genre: 'Literary Fiction', year: 1992, pages: 559, popularity: 87, description: 'A murder among classics students at an elite college.' },
  { title: 'The Goldfinch', author: 'Donna Tartt', genre: 'Literary Fiction', year: 2013, pages: 771, popularity: 85, description: 'A boy, a bombing, and a stolen masterpiece — Pulitzer winner.' },
  { title: 'A Little Life', author: 'Hanya Yanagihara', genre: 'Literary Fiction', year: 2015, pages: 720, popularity: 85, description: 'Four friends, and one man\'s unspeakable past.' },
  { title: 'The Corrections', author: 'Jonathan Franzen', genre: 'Literary Fiction', year: 2001, pages: 568, popularity: 81, description: 'A Midwestern family gathers for one last Christmas.' },
  { title: 'Middlesex', author: 'Jeffrey Eugenides', genre: 'Literary Fiction', year: 2002, pages: 529, popularity: 83, description: 'Three generations and a Greek-American family secret.' },
  { title: 'Atonement', author: 'Ian McEwan', genre: 'Literary Fiction', year: 2001, pages: 351, popularity: 84, description: 'A child\'s lie shatters lives across decades.' },
  { title: 'White Teeth', author: 'Zadie Smith', genre: 'Literary Fiction', year: 2000, pages: 448, popularity: 82, description: 'Multicultural London across two tangled families.' },
  { title: 'American Pastoral', author: 'Philip Roth', genre: 'Literary Fiction', year: 1997, pages: 423, popularity: 82, description: 'The American dream detonates for one family — Pulitzer winner.' },
  { title: 'Herzog', author: 'Saul Bellow', genre: 'Literary Fiction', year: 1964, pages: 371, popularity: 79, description: 'A brilliant man writes letters he never sends.' },
  { title: 'White Noise', author: 'Don DeLillo', genre: 'Literary Fiction', year: 1985, pages: 326, popularity: 80, description: 'Consumerism, media, and the fear of death in suburbia.' },
  { title: 'Gravity\'s Rainbow', author: 'Thomas Pynchon', genre: 'Literary Fiction', year: 1973, pages: 776, popularity: 76, description: 'A paranoid, encyclopedic epic of WWII and the V-2 rocket.' },
  { title: 'Gilead', author: 'Marilynne Robinson', genre: 'Literary Fiction', year: 2004, pages: 247, popularity: 82, description: 'A dying pastor\'s luminous letter to his young son.' },
  { title: 'Infinite Jest', author: 'David Foster Wallace', genre: 'Literary Fiction', year: 1996, pages: 1079, popularity: 80, description: 'Addiction, entertainment, and tennis in a sprawling maximalist epic.' },

  // ── South Asian voices ──
  { title: 'The God of Small Things', author: 'Arundhati Roy', genre: 'Literary Fiction', year: 1997, pages: 340, popularity: 84, description: 'Twins, forbidden love, and caste in Kerala — Booker winner.' },
  { title: 'The Namesake', author: 'Jhumpa Lahiri', genre: 'Literary Fiction', year: 2003, pages: 291, popularity: 83, description: 'A Bengali-American son and the weight of a name.' },
  { title: 'A Fine Balance', author: 'Rohinton Mistry', genre: 'Literary Fiction', year: 1995, pages: 624, popularity: 84, description: 'Four strangers thrown together during India\'s Emergency.' },
  { title: 'The Reluctant Fundamentalist', author: 'Mohsin Hamid', genre: 'Literary Fiction', year: 2007, pages: 184, popularity: 80, description: 'A Pakistani man\'s American dream sours after 9/11.' },
];

// Seed catalog: 5 reference books for every genre in reading-genres.js (32 genres → 160 books).
// Page counts are common print-edition figures; words are estimated by the store (~250/page).
// Merged into the library once via readingsStore.seedCatalog() — user edits/deletions stick afterwards.

export const BOOK_CATALOG = [
  // ── Fiction ──────────────────────────────────────────────────────────────
  // Action & Adventure
  { title: 'The Count of Monte Cristo', author: 'Alexandre Dumas', genre: 'Action & Adventure', year: 1844, pages: 1276, popularity: 92, description: 'Wrongly imprisoned, Edmond Dantès escapes and executes a masterful revenge.' },
  { title: 'Treasure Island', author: 'Robert Louis Stevenson', genre: 'Action & Adventure', year: 1883, pages: 311, popularity: 85, description: 'Young Jim Hawkins hunts buried pirate gold with Long John Silver aboard.' },
  { title: 'The Three Musketeers', author: 'Alexandre Dumas', genre: 'Action & Adventure', year: 1844, pages: 700, popularity: 87, description: "D'Artagnan joins three swashbuckling musketeers in 17th-century France." },
  { title: 'Jurassic Park', author: 'Michael Crichton', genre: 'Action & Adventure', year: 1990, pages: 448, popularity: 90, description: 'A dinosaur theme park spirals into chaos when the safeguards fail.' },
  { title: 'The Call of the Wild', author: 'Jack London', genre: 'Action & Adventure', year: 1903, pages: 232, popularity: 84, description: 'A domesticated dog rediscovers his primal instincts in the Yukon wilderness.' },
  // Crime
  { title: 'The Godfather', author: 'Mario Puzo', genre: 'Crime', year: 1969, pages: 448, popularity: 93, description: 'The Corleone family saga — power, loyalty, and the American Mafia.' },
  { title: 'The Girl with the Dragon Tattoo', author: 'Stieg Larsson', genre: 'Crime', year: 2005, pages: 465, popularity: 89, description: 'A journalist and a brilliant hacker unravel a decades-old disappearance.' },
  { title: 'L.A. Confidential', author: 'James Ellroy', genre: 'Crime', year: 1990, pages: 496, popularity: 80, description: 'Three cops collide in the corrupt underbelly of 1950s Los Angeles.' },
  { title: 'No Country for Old Men', author: 'Cormac McCarthy', genre: 'Crime', year: 2005, pages: 320, popularity: 86, description: 'A drug deal gone wrong sets a relentless killer loose in West Texas.' },
  { title: 'The Big Sleep', author: 'Raymond Chandler', genre: 'Crime', year: 1939, pages: 231, popularity: 82, description: 'Private eye Philip Marlowe wades into blackmail and murder in L.A.' },
  // Dystopian
  { title: '1984', author: 'George Orwell', genre: 'Dystopian', year: 1949, pages: 328, popularity: 97, description: 'Big Brother, thoughtcrime, and one man\'s doomed rebellion against total surveillance.' },
  { title: 'Brave New World', author: 'Aldous Huxley', genre: 'Dystopian', year: 1932, pages: 311, popularity: 91, description: 'A genetically engineered society trades freedom for comfort and control.' },
  { title: 'Fahrenheit 451', author: 'Ray Bradbury', genre: 'Dystopian', year: 1953, pages: 256, popularity: 89, description: 'In a future where books burn, a fireman starts to question everything.' },
  { title: "The Handmaid's Tale", author: 'Margaret Atwood', genre: 'Dystopian', year: 1985, pages: 311, popularity: 90, description: 'A woman navigates survival in the theocratic republic of Gilead.' },
  { title: 'The Road', author: 'Cormac McCarthy', genre: 'Dystopian', year: 2006, pages: 287, popularity: 88, description: 'A father and son walk a burned America, carrying the fire.' },
  // Fantasy
  { title: 'The Hobbit', author: 'J.R.R. Tolkien', genre: 'Fantasy', year: 1937, pages: 310, popularity: 95, description: 'Bilbo Baggins leaves home for dragons, dwarves, and a certain ring.' },
  { title: 'The Fellowship of the Ring', author: 'J.R.R. Tolkien', genre: 'Fantasy', year: 1954, pages: 423, popularity: 96, description: 'The One Ring must be destroyed — the fellowship sets out from Rivendell.' },
  { title: "Harry Potter and the Philosopher's Stone", author: 'J.K. Rowling', genre: 'Fantasy', year: 1997, pages: 223, popularity: 98, description: 'An orphan discovers he is a wizard and enters Hogwarts.' },
  { title: 'A Game of Thrones', author: 'George R.R. Martin', genre: 'Fantasy', year: 1996, pages: 694, popularity: 94, description: 'Noble houses scheme for the Iron Throne while winter comes.' },
  { title: 'The Name of the Wind', author: 'Patrick Rothfuss', genre: 'Fantasy', year: 2007, pages: 662, popularity: 88, description: 'Kvothe recounts how he became the most notorious wizard alive.' },
  // Historical Fiction
  { title: 'All the Light We Cannot See', author: 'Anthony Doerr', genre: 'Historical Fiction', year: 2014, pages: 531, popularity: 90, description: 'A blind French girl and a German boy collide in occupied Saint-Malo.' },
  { title: 'The Book Thief', author: 'Markus Zusak', genre: 'Historical Fiction', year: 2005, pages: 552, popularity: 91, description: 'Death narrates the story of a girl stealing books in Nazi Germany.' },
  { title: 'Wolf Hall', author: 'Hilary Mantel', genre: 'Historical Fiction', year: 2009, pages: 604, popularity: 84, description: 'Thomas Cromwell rises through the treacherous court of Henry VIII.' },
  { title: 'The Pillars of the Earth', author: 'Ken Follett', genre: 'Historical Fiction', year: 1989, pages: 973, popularity: 89, description: 'A cathedral rises over decades of ambition, war, and betrayal.' },
  { title: 'War and Peace', author: 'Leo Tolstoy', genre: 'Historical Fiction', year: 1869, pages: 1225, popularity: 88, description: 'Five aristocratic families live through the Napoleonic invasion of Russia.' },
  // Horror
  { title: 'The Shining', author: 'Stephen King', genre: 'Horror', year: 1977, pages: 447, popularity: 92, description: 'A haunted hotel slowly consumes its winter caretaker.' },
  { title: 'Dracula', author: 'Bram Stoker', genre: 'Horror', year: 1897, pages: 418, popularity: 87, description: 'The vampire count comes to England; a band of hunters answers.' },
  { title: 'It', author: 'Stephen King', genre: 'Horror', year: 1986, pages: 1138, popularity: 90, description: 'Seven friends face an ancient shape-shifting evil beneath Derry.' },
  { title: 'Frankenstein', author: 'Mary Shelley', genre: 'Horror', year: 1818, pages: 280, popularity: 86, description: 'A scientist creates life and is destroyed by his own creation.' },
  { title: 'The Exorcist', author: 'William Peter Blatty', genre: 'Horror', year: 1971, pages: 340, popularity: 83, description: 'Two priests battle for the soul of a possessed twelve-year-old.' },
  // Humor & Satire
  { title: 'Catch-22', author: 'Joseph Heller', genre: 'Humor & Satire', year: 1961, pages: 453, popularity: 89, description: 'A WWII bombardier confronts the absurd logic of military bureaucracy.' },
  { title: "The Hitchhiker's Guide to the Galaxy", author: 'Douglas Adams', genre: 'Humor & Satire', year: 1979, pages: 224, popularity: 93, description: 'Earth is demolished; Arthur Dent hitches a ride across the galaxy.' },
  { title: 'Good Omens', author: 'Terry Pratchett & Neil Gaiman', genre: 'Humor & Satire', year: 1990, pages: 412, popularity: 88, description: 'An angel and a demon team up to stop the apocalypse.' },
  { title: 'A Confederacy of Dunces', author: 'John Kennedy Toole', genre: 'Humor & Satire', year: 1980, pages: 405, popularity: 82, description: 'Ignatius J. Reilly wages war on modernity from New Orleans.' },
  { title: 'Animal Farm', author: 'George Orwell', genre: 'Humor & Satire', year: 1945, pages: 112, popularity: 94, description: 'The farm animals revolt — and some become more equal than others.' },
  // Literary Fiction
  { title: 'To Kill a Mockingbird', author: 'Harper Lee', genre: 'Literary Fiction', year: 1960, pages: 281, popularity: 96, description: 'A child watches her father defend an innocent Black man in Alabama.' },
  { title: 'The Great Gatsby', author: 'F. Scott Fitzgerald', genre: 'Literary Fiction', year: 1925, pages: 180, popularity: 94, description: 'Jay Gatsby chases a green light and the American dream.' },
  { title: 'Beloved', author: 'Toni Morrison', genre: 'Literary Fiction', year: 1987, pages: 324, popularity: 87, description: 'A freed slave is haunted by the daughter she lost.' },
  { title: 'The Kite Runner', author: 'Khaled Hosseini', genre: 'Literary Fiction', year: 2003, pages: 371, popularity: 91, description: 'Betrayal and redemption stretch from Kabul to California.' },
  { title: 'Of Mice and Men', author: 'John Steinbeck', genre: 'Literary Fiction', year: 1937, pages: 107, popularity: 88, description: 'Two drifters chase a small dream through Depression-era California.' },
  // Magical Realism
  { title: 'One Hundred Years of Solitude', author: 'Gabriel García Márquez', genre: 'Magical Realism', year: 1967, pages: 417, popularity: 93, description: 'Seven generations of the Buendía family in the mythical town of Macondo.' },
  { title: 'The House of the Spirits', author: 'Isabel Allende', genre: 'Magical Realism', year: 1982, pages: 433, popularity: 84, description: 'Three generations of women weave the fate of a Chilean family.' },
  { title: "Midnight's Children", author: 'Salman Rushdie', genre: 'Magical Realism', year: 1981, pages: 647, popularity: 83, description: 'Children born at the hour of Indian independence share strange gifts.' },
  { title: 'Kafka on the Shore', author: 'Haruki Murakami', genre: 'Magical Realism', year: 2002, pages: 505, popularity: 87, description: 'A runaway teenager and an old man who talks to cats cross fates.' },
  { title: 'Like Water for Chocolate', author: 'Laura Esquivel', genre: 'Magical Realism', year: 1989, pages: 246, popularity: 80, description: 'Forbidden love simmers into every dish Tita cooks.' },
  // Mystery
  { title: 'And Then There Were None', author: 'Agatha Christie', genre: 'Mystery', year: 1939, pages: 272, popularity: 92, description: 'Ten strangers on an island are murdered one by one.' },
  { title: 'The Hound of the Baskervilles', author: 'Arthur Conan Doyle', genre: 'Mystery', year: 1902, pages: 256, popularity: 88, description: 'Sherlock Holmes investigates a spectral hound on the moors.' },
  { title: 'Gone Girl', author: 'Gillian Flynn', genre: 'Mystery', year: 2012, pages: 419, popularity: 90, description: 'A wife vanishes and a marriage unravels into something far darker.' },
  { title: 'The Da Vinci Code', author: 'Dan Brown', genre: 'Mystery', year: 2003, pages: 454, popularity: 89, description: 'A symbologist races through Europe decoding a religious conspiracy.' },
  { title: 'Big Little Lies', author: 'Liane Moriarty', genre: 'Mystery', year: 2014, pages: 460, popularity: 85, description: 'Three mothers, one school trivia night, one dead body.' },
  // Romance
  { title: 'Pride and Prejudice', author: 'Jane Austen', genre: 'Romance', year: 1813, pages: 279, popularity: 95, description: 'Elizabeth Bennet and Mr. Darcy spar their way into love.' },
  { title: 'Outlander', author: 'Diana Gabaldon', genre: 'Romance', year: 1991, pages: 850, popularity: 87, description: 'A WWII nurse falls through time into 18th-century Scotland.' },
  { title: 'Me Before You', author: 'Jojo Moyes', genre: 'Romance', year: 2012, pages: 369, popularity: 86, description: 'A small-town caregiver changes — and is changed by — a paralyzed man.' },
  { title: 'The Notebook', author: 'Nicholas Sparks', genre: 'Romance', year: 1996, pages: 214, popularity: 84, description: 'A lifelong love story read aloud against the fade of memory.' },
  { title: 'Jane Eyre', author: 'Charlotte Brontë', genre: 'Romance', year: 1847, pages: 500, popularity: 90, description: 'A governess with fierce integrity falls for the brooding Mr. Rochester.' },
  // Science Fiction
  { title: 'Dune', author: 'Frank Herbert', genre: 'Science Fiction', year: 1965, pages: 412, popularity: 95, description: 'Paul Atreides rises on the desert planet that controls the spice.' },
  { title: "Ender's Game", author: 'Orson Scott Card', genre: 'Science Fiction', year: 1985, pages: 324, popularity: 90, description: 'A child genius is trained through war games to save humanity.' },
  { title: 'Foundation', author: 'Isaac Asimov', genre: 'Science Fiction', year: 1951, pages: 244, popularity: 88, description: 'Psychohistory predicts the fall of a galactic empire — and a plan to shorten the dark age.' },
  { title: 'The Martian', author: 'Andy Weir', genre: 'Science Fiction', year: 2011, pages: 369, popularity: 91, description: 'An astronaut stranded on Mars sciences his way to survival.' },
  { title: 'Neuromancer', author: 'William Gibson', genre: 'Science Fiction', year: 1984, pages: 271, popularity: 84, description: 'The cyberpunk classic — a washed-up hacker takes one last job.' },
  // Speculative Fiction
  { title: 'Never Let Me Go', author: 'Kazuo Ishiguro', genre: 'Speculative Fiction', year: 2005, pages: 288, popularity: 87, description: 'Boarding-school friends slowly learn what their lives are for.' },
  { title: 'Station Eleven', author: 'Emily St. John Mandel', genre: 'Speculative Fiction', year: 2014, pages: 333, popularity: 85, description: 'A traveling symphony keeps art alive after civilization collapses.' },
  { title: 'Cloud Atlas', author: 'David Mitchell', genre: 'Speculative Fiction', year: 2004, pages: 509, popularity: 83, description: 'Six nested stories ripple across centuries and souls.' },
  { title: 'The Power', author: 'Naomi Alderman', genre: 'Speculative Fiction', year: 2016, pages: 341, popularity: 80, description: 'Women worldwide develop the power to electrocute — and everything flips.' },
  { title: 'Oryx and Crake', author: 'Margaret Atwood', genre: 'Speculative Fiction', year: 2003, pages: 374, popularity: 82, description: 'Bioengineering, corporate greed, and the last man on earth.' },
  // Thriller & Suspense
  { title: 'The Silence of the Lambs', author: 'Thomas Harris', genre: 'Thriller & Suspense', year: 1988, pages: 352, popularity: 91, description: 'An FBI trainee needs Hannibal Lecter\'s mind to catch a killer.' },
  { title: 'The Bourne Identity', author: 'Robert Ludlum', genre: 'Thriller & Suspense', year: 1980, pages: 523, popularity: 85, description: 'A man with no memory and lethal skills hunts his own identity.' },
  { title: 'The Firm', author: 'John Grisham', genre: 'Thriller & Suspense', year: 1991, pages: 421, popularity: 86, description: 'A young lawyer discovers his dream firm belongs to the mob.' },
  { title: 'I Am Pilgrim', author: 'Terry Hayes', genre: 'Thriller & Suspense', year: 2013, pages: 703, popularity: 84, description: 'A retired intelligence agent chases a terrorist plotting the unthinkable.' },
  { title: 'Shutter Island', author: 'Dennis Lehane', genre: 'Thriller & Suspense', year: 2003, pages: 369, popularity: 85, description: 'Two marshals investigate a disappearance at an asylum for the criminally insane.' },
  // Women's Fiction
  { title: 'Little Fires Everywhere', author: 'Celeste Ng', genre: "Women's Fiction", year: 2017, pages: 338, popularity: 86, description: 'Two families in a picture-perfect suburb burn toward collision.' },
  { title: 'Where the Crawdads Sing', author: 'Delia Owens', genre: "Women's Fiction", year: 2018, pages: 370, popularity: 91, description: 'The Marsh Girl of the Carolina coast stands accused of murder.' },
  { title: 'Eleanor Oliphant Is Completely Fine', author: 'Gail Honeyman', genre: "Women's Fiction", year: 2017, pages: 327, popularity: 85, description: 'A socially awkward loner learns that surviving is not living.' },
  { title: 'The Help', author: 'Kathryn Stockett', genre: "Women's Fiction", year: 2009, pages: 451, popularity: 88, description: 'Black maids in 1960s Mississippi tell their stories at great risk.' },
  { title: 'The Seven Husbands of Evelyn Hugo', author: 'Taylor Jenkins Reid', genre: "Women's Fiction", year: 2017, pages: 389, popularity: 90, description: 'An aging Hollywood icon finally tells the truth about her life.' },

  // ── Non-Fiction ──────────────────────────────────────────────────────────
  // Art & Architecture
  { title: 'The Story of Art', author: 'E.H. Gombrich', genre: 'Art & Architecture', year: 1950, pages: 688, popularity: 85, description: 'The classic single-volume history of Western art.' },
  { title: 'Ways of Seeing', author: 'John Berger', genre: 'Art & Architecture', year: 1972, pages: 176, popularity: 80, description: 'How we look at art — and how images shape what we believe.' },
  { title: 'The Architecture of Happiness', author: 'Alain de Botton', genre: 'Art & Architecture', year: 2006, pages: 288, popularity: 76, description: 'What buildings say to us and why beauty matters.' },
  { title: 'Leonardo da Vinci', author: 'Walter Isaacson', genre: 'Art & Architecture', year: 2017, pages: 624, popularity: 86, description: 'The definitive biography of history\'s most curious mind.' },
  { title: 'Steal Like an Artist', author: 'Austin Kleon', genre: 'Art & Architecture', year: 2012, pages: 160, popularity: 82, description: 'Ten things nobody told you about being creative.' },
  // Autobiography
  { title: 'The Autobiography of Benjamin Franklin', author: 'Benjamin Franklin', genre: 'Autobiography', year: 1791, pages: 320, popularity: 80, description: 'The printer, inventor, and founding father in his own words.' },
  { title: 'Long Walk to Freedom', author: 'Nelson Mandela', genre: 'Autobiography', year: 1994, pages: 656, popularity: 90, description: 'From village boy to prisoner 46664 to president of South Africa.' },
  { title: 'I Know Why the Caged Bird Sings', author: 'Maya Angelou', genre: 'Autobiography', year: 1969, pages: 289, popularity: 87, description: 'A luminous account of growing up Black in the segregated South.' },
  { title: 'The Diary of a Young Girl', author: 'Anne Frank', genre: 'Autobiography', year: 1947, pages: 283, popularity: 93, description: 'Two years in hiding, recorded by an extraordinary teenage voice.' },
  { title: 'The Autobiography of Malcolm X', author: 'Malcolm X & Alex Haley', genre: 'Autobiography', year: 1965, pages: 466, popularity: 88, description: 'One of the most influential American lives of the 20th century.' },
  // Biography
  { title: 'Steve Jobs', author: 'Walter Isaacson', genre: 'Biography', year: 2011, pages: 656, popularity: 91, description: 'The authorized portrait of Apple\'s brilliant, difficult founder.' },
  { title: 'Einstein: His Life and Universe', author: 'Walter Isaacson', genre: 'Biography', year: 2007, pages: 704, popularity: 85, description: 'How a rebellious patent clerk rewrote physics.' },
  { title: 'Alexander Hamilton', author: 'Ron Chernow', genre: 'Biography', year: 2004, pages: 818, popularity: 87, description: 'The immigrant founding father who built American finance.' },
  { title: 'The Snowball: Warren Buffett and the Business of Life', author: 'Alice Schroeder', genre: 'Biography', year: 2008, pages: 976, popularity: 84, description: 'The definitive life of the world\'s greatest investor.' },
  { title: 'Elon Musk', author: 'Ashlee Vance', genre: 'Biography', year: 2015, pages: 400, popularity: 86, description: 'Tesla, SpaceX, and the quest for a fantastic future.' },
  // Business & Economics
  { title: 'The Intelligent Investor', author: 'Benjamin Graham', genre: 'Business & Economics', year: 1949, pages: 640, popularity: 92, description: 'The definitive book on value investing and margin of safety.' },
  { title: 'Rich Dad Poor Dad', author: 'Robert Kiyosaki', genre: 'Business & Economics', year: 1997, pages: 336, popularity: 88, description: 'What the rich teach their kids about money that the poor do not.' },
  { title: 'Zero to One', author: 'Peter Thiel', genre: 'Business & Economics', year: 2014, pages: 224, popularity: 89, description: 'Notes on startups, monopoly, and building the future.' },
  { title: 'The Lean Startup', author: 'Eric Ries', genre: 'Business & Economics', year: 2011, pages: 336, popularity: 85, description: 'Build-measure-learn: continuous innovation under extreme uncertainty.' },
  { title: 'Good to Great', author: 'Jim Collins', genre: 'Business & Economics', year: 2001, pages: 320, popularity: 84, description: 'Why some companies make the leap and others don\'t.' },
  // Cookbooks & Culinary
  { title: 'Salt, Fat, Acid, Heat', author: 'Samin Nosrat', genre: 'Cookbooks & Culinary', year: 2017, pages: 480, popularity: 88, description: 'Master the four elements of good cooking.' },
  { title: 'Kitchen Confidential', author: 'Anthony Bourdain', genre: 'Cookbooks & Culinary', year: 2000, pages: 312, popularity: 89, description: 'Adventures in the culinary underbelly — raw, funny, unforgettable.' },
  { title: 'The Food Lab', author: 'J. Kenji López-Alt', genre: 'Cookbooks & Culinary', year: 2015, pages: 958, popularity: 85, description: 'Better home cooking through science.' },
  { title: 'Mastering the Art of French Cooking', author: 'Julia Child', genre: 'Cookbooks & Culinary', year: 1961, pages: 684, popularity: 84, description: 'The book that taught America to cook French food.' },
  { title: 'On Food and Cooking', author: 'Harold McGee', genre: 'Cookbooks & Culinary', year: 1984, pages: 896, popularity: 80, description: 'The science and lore of the kitchen — the chef\'s bible.' },
  // Essays
  { title: 'Consider the Lobster', author: 'David Foster Wallace', genre: 'Essays', year: 2005, pages: 343, popularity: 80, description: 'Ten dazzling essays, from cruise ships to crustacean ethics.' },
  { title: 'Men Explain Things to Me', author: 'Rebecca Solnit', genre: 'Essays', year: 2014, pages: 130, popularity: 78, description: 'The essay that named mansplaining, and six more.' },
  { title: 'Slouching Towards Bethlehem', author: 'Joan Didion', genre: 'Essays', year: 1968, pages: 238, popularity: 82, description: 'California in the sixties, in prose that redefined the essay.' },
  { title: 'Notes of a Native Son', author: 'James Baldwin', genre: 'Essays', year: 1955, pages: 175, popularity: 84, description: 'Race, family, and America — Baldwin\'s early masterpiece.' },
  { title: 'Essays', author: 'Michel de Montaigne', genre: 'Essays', year: 1580, pages: 1344, popularity: 76, description: 'The invention of the essay: one man honestly examining himself.' },
  // Health & Fitness
  { title: 'Why We Sleep', author: 'Matthew Walker', genre: 'Health & Fitness', year: 2017, pages: 368, popularity: 89, description: 'Unlocking the power of sleep and dreams.' },
  { title: 'The Body Keeps the Score', author: 'Bessel van der Kolk', genre: 'Health & Fitness', year: 2014, pages: 464, popularity: 90, description: 'How trauma reshapes body and brain — and paths to recovery.' },
  { title: 'Outlive', author: 'Peter Attia', genre: 'Health & Fitness', year: 2023, pages: 496, popularity: 87, description: 'The science and art of longevity.' },
  { title: 'Breath', author: 'James Nestor', genre: 'Health & Fitness', year: 2020, pages: 304, popularity: 83, description: 'The new science of a lost art — how we breathe matters.' },
  { title: 'Bigger Leaner Stronger', author: 'Michael Matthews', genre: 'Health & Fitness', year: 2012, pages: 490, popularity: 78, description: 'Evidence-based muscle building and fat loss for men.' },
  // History
  { title: 'Sapiens: A Brief History of Humankind', author: 'Yuval Noah Harari', genre: 'History', year: 2011, pages: 443, popularity: 94, description: 'From forager bands to empires to algorithms — the human story.' },
  { title: 'Guns, Germs, and Steel', author: 'Jared Diamond', genre: 'History', year: 1997, pages: 480, popularity: 86, description: 'Why Eurasia conquered the world: geography, crops, and immunity.' },
  { title: "A People's History of the United States", author: 'Howard Zinn', genre: 'History', year: 1980, pages: 729, popularity: 82, description: 'American history told from below — workers, women, the dispossessed.' },
  { title: 'The Wright Brothers', author: 'David McCullough', genre: 'History', year: 2015, pages: 320, popularity: 81, description: 'Two bicycle mechanics from Dayton who taught the world to fly.' },
  { title: 'SPQR: A History of Ancient Rome', author: 'Mary Beard', genre: 'History', year: 2015, pages: 606, popularity: 83, description: 'A thousand years of Rome, brilliantly retold.' },
  // Humor & Entertainment
  { title: 'Bossypants', author: 'Tina Fey', genre: 'Humor & Entertainment', year: 2011, pages: 277, popularity: 84, description: 'From improv nerd to 30 Rock — sharp, self-deprecating, hilarious.' },
  { title: 'Yes Please', author: 'Amy Poehler', genre: 'Humor & Entertainment', year: 2014, pages: 329, popularity: 80, description: 'Stories, lists, and hard-won wisdom from the SNL alum.' },
  { title: 'Me Talk Pretty One Day', author: 'David Sedaris', genre: 'Humor & Entertainment', year: 2000, pages: 272, popularity: 85, description: 'Essays on family, France, and failing to learn French.' },
  { title: 'Is Everyone Hanging Out Without Me?', author: 'Mindy Kaling', genre: 'Humor & Entertainment', year: 2011, pages: 222, popularity: 78, description: 'And other concerns — comedy, career, and confidence.' },
  { title: 'Born Standing Up', author: 'Steve Martin', genre: 'Humor & Entertainment', year: 2007, pages: 209, popularity: 79, description: 'A comic\'s life — why he walked away at the top.' },
  // Memoir
  { title: 'Educated', author: 'Tara Westover', genre: 'Memoir', year: 2018, pages: 334, popularity: 92, description: 'From a survivalist family with no schooling to a Cambridge PhD.' },
  { title: 'Born a Crime', author: 'Trevor Noah', genre: 'Memoir', year: 2016, pages: 288, popularity: 90, description: 'Stories from a South African childhood under apartheid.' },
  { title: 'When Breath Becomes Air', author: 'Paul Kalanithi', genre: 'Memoir', year: 2016, pages: 208, popularity: 89, description: 'A young neurosurgeon faces terminal cancer and asks what makes life worth living.' },
  { title: 'The Glass Castle', author: 'Jeannette Walls', genre: 'Memoir', year: 2005, pages: 288, popularity: 87, description: 'A resilient childhood with brilliant, deeply dysfunctional parents.' },
  { title: 'Night', author: 'Elie Wiesel', genre: 'Memoir', year: 1956, pages: 115, popularity: 91, description: 'A survivor\'s account of Auschwitz — essential and devastating.' },
  // Philosophy
  { title: 'Meditations', author: 'Marcus Aurelius', genre: 'Philosophy', year: 180, pages: 254, popularity: 91, description: 'The private notebook of a Roman emperor practicing Stoicism.' },
  { title: "Man's Search for Meaning", author: 'Viktor E. Frankl', genre: 'Philosophy', year: 1946, pages: 165, popularity: 93, description: 'A psychiatrist survives the camps and finds meaning in suffering.' },
  { title: 'Letters from a Stoic', author: 'Seneca', genre: 'Philosophy', year: 65, pages: 254, popularity: 84, description: 'Practical wisdom on time, wealth, grief, and living well.' },
  { title: 'Beyond Good and Evil', author: 'Friedrich Nietzsche', genre: 'Philosophy', year: 1886, pages: 240, popularity: 80, description: 'A hammer to the assumptions beneath morality and truth.' },
  { title: 'The Republic', author: 'Plato', genre: 'Philosophy', year: -375, pages: 416, popularity: 82, description: 'Justice, the ideal city, and the allegory of the cave.' },
  // Politics & Current Events
  { title: 'The Prince', author: 'Niccolò Machiavelli', genre: 'Politics & Current Events', year: 1532, pages: 140, popularity: 88, description: 'The unflinching manual on acquiring and keeping power.' },
  { title: 'Why Nations Fail', author: 'Daron Acemoglu & James A. Robinson', genre: 'Politics & Current Events', year: 2012, pages: 529, popularity: 84, description: 'Institutions — not geography or culture — decide prosperity.' },
  { title: 'On Tyranny', author: 'Timothy Snyder', genre: 'Politics & Current Events', year: 2017, pages: 128, popularity: 80, description: 'Twenty lessons from the twentieth century.' },
  { title: 'A Promised Land', author: 'Barack Obama', genre: 'Politics & Current Events', year: 2020, pages: 768, popularity: 87, description: 'The first volume of the presidential memoirs.' },
  { title: 'The Origins of Totalitarianism', author: 'Hannah Arendt', genre: 'Politics & Current Events', year: 1951, pages: 576, popularity: 79, description: 'How terror and ideology take whole societies hostage.' },
  // Religion & Spirituality
  { title: 'The Power of Now', author: 'Eckhart Tolle', genre: 'Religion & Spirituality', year: 1997, pages: 236, popularity: 87, description: 'A guide to spiritual enlightenment through presence.' },
  { title: 'Mere Christianity', author: 'C.S. Lewis', genre: 'Religion & Spirituality', year: 1952, pages: 227, popularity: 84, description: 'The wartime broadcasts that became a classic case for faith.' },
  { title: 'Tao Te Ching', author: 'Laozi', genre: 'Religion & Spirituality', year: -400, pages: 160, popularity: 85, description: 'Eighty-one verses on the way, effortless action, and balance.' },
  { title: 'The Untethered Soul', author: 'Michael A. Singer', genre: 'Religion & Spirituality', year: 2007, pages: 200, popularity: 82, description: 'The journey beyond yourself — who is the voice in your head?' },
  { title: 'When Things Fall Apart', author: 'Pema Chödrön', genre: 'Religion & Spirituality', year: 1996, pages: 240, popularity: 81, description: 'Heart advice for difficult times from a Buddhist nun.' },
  // Science & Nature
  { title: 'A Brief History of Time', author: 'Stephen Hawking', genre: 'Science & Nature', year: 1988, pages: 212, popularity: 90, description: 'From the Big Bang to black holes, for the rest of us.' },
  { title: 'The Selfish Gene', author: 'Richard Dawkins', genre: 'Science & Nature', year: 1976, pages: 360, popularity: 86, description: 'Evolution seen from the gene\'s point of view.' },
  { title: 'Cosmos', author: 'Carl Sagan', genre: 'Science & Nature', year: 1980, pages: 396, popularity: 88, description: 'The universe, and our small brave place in it.' },
  { title: 'The Gene: An Intimate History', author: 'Siddhartha Mukherjee', genre: 'Science & Nature', year: 2016, pages: 592, popularity: 83, description: 'The story of heredity, from Mendel to CRISPR.' },
  { title: 'Entangled Life', author: 'Merlin Sheldrake', genre: 'Science & Nature', year: 2020, pages: 358, popularity: 80, description: 'How fungi make our worlds, change our minds, and shape our futures.' },
  // Self-Help & Personal Development
  { title: 'Atomic Habits', author: 'James Clear', genre: 'Self-Help & Personal Development', year: 2018, pages: 320, popularity: 96, description: 'Tiny changes, remarkable results — the system beats the goal.' },
  { title: 'The 7 Habits of Highly Effective People', author: 'Stephen R. Covey', genre: 'Self-Help & Personal Development', year: 1989, pages: 381, popularity: 89, description: 'Principle-centered effectiveness, from private victory to public.' },
  { title: 'Deep Work', author: 'Cal Newport', genre: 'Self-Help & Personal Development', year: 2016, pages: 296, popularity: 90, description: 'Rules for focused success in a distracted world.' },
  { title: 'How to Win Friends and Influence People', author: 'Dale Carnegie', genre: 'Self-Help & Personal Development', year: 1936, pages: 291, popularity: 91, description: 'The timeless playbook of human relations.' },
  { title: 'Thinking, Fast and Slow', author: 'Daniel Kahneman', genre: 'Self-Help & Personal Development', year: 2011, pages: 499, popularity: 92, description: 'Two systems drive the way we think — and mislead us.' },
  // Travel
  { title: 'Into the Wild', author: 'Jon Krakauer', genre: 'Travel', year: 1996, pages: 224, popularity: 88, description: 'Chris McCandless walks into the Alaskan wilderness alone.' },
  { title: 'A Walk in the Woods', author: 'Bill Bryson', genre: 'Travel', year: 1998, pages: 397, popularity: 84, description: 'Rediscovering America on the Appalachian Trail — hilariously.' },
  { title: 'Eat, Pray, Love', author: 'Elizabeth Gilbert', genre: 'Travel', year: 2006, pages: 352, popularity: 83, description: 'One woman\'s search across Italy, India, and Indonesia.' },
  { title: 'In Patagonia', author: 'Bruce Chatwin', genre: 'Travel', year: 1977, pages: 240, popularity: 77, description: 'The modern classic that reinvented travel writing.' },
  { title: 'The Great Railway Bazaar', author: 'Paul Theroux', genre: 'Travel', year: 1975, pages: 342, popularity: 76, description: 'Four months by train through Asia.' },
  // True Crime
  { title: 'In Cold Blood', author: 'Truman Capote', genre: 'True Crime', year: 1966, pages: 343, popularity: 89, description: 'The murder of a Kansas family, and the birth of the nonfiction novel.' },
  { title: 'The Devil in the White City', author: 'Erik Larson', genre: 'True Crime', year: 2003, pages: 447, popularity: 86, description: 'A serial killer stalks the 1893 Chicago World\'s Fair.' },
  { title: "I'll Be Gone in the Dark", author: 'Michelle McNamara', genre: 'True Crime', year: 2018, pages: 352, popularity: 84, description: 'One writer\'s obsessive hunt for the Golden State Killer.' },
  { title: 'Helter Skelter', author: 'Vincent Bugliosi', genre: 'True Crime', year: 1974, pages: 689, popularity: 82, description: 'The prosecutor\'s inside account of the Manson murders.' },
  { title: 'Mindhunter', author: 'John E. Douglas', genre: 'True Crime', year: 1995, pages: 397, popularity: 81, description: 'Inside the FBI\'s elite serial crime unit.' },
];

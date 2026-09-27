// Order and visibility of the cards on Aujourd'hui, per person.
// layout = { order: [cardId], hidden: [cardId] } stored in the profile.
// Cards added later (not in the saved order) keep their default place after
// the ones the person arranged. Pure: tests/today-layout.test.mjs.

export function arrangeCards(cards, layout) {
  const hidden = new Set(layout?.hidden || []);
  const order = (layout?.order || []).filter((id) => cards.some((c) => c.id === id));
  const rank = new Map(order.map((id, i) => [id, i]));
  return cards
    .map((c, i) => ({ c, i }))
    .sort((a, b) => {
      const ra = rank.has(a.c.id) ? rank.get(a.c.id) : order.length + a.i;
      const rb = rank.has(b.c.id) ? rank.get(b.c.id) : order.length + b.i;
      return ra - rb;
    })
    .map(({ c }) => c)
    .filter((c) => !hidden.has(c.id));
}

// Move one card up (-1) or down (+1) in the full list (hidden ones included).
export function moveCard(allIds, layout, id, dir) {
  const ids = arrangeCards(allIds.map((x) => ({ id: x })), { order: layout?.order }).map((c) => c.id);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= ids.length) return { ...layout, order: ids };
  [ids[i], ids[j]] = [ids[j], ids[i]];
  return { ...layout, order: ids };
}

export function toggleCard(layout, id) {
  const hidden = new Set(layout?.hidden || []);
  if (hidden.has(id)) hidden.delete(id); else hidden.add(id);
  return { ...layout, hidden: [...hidden] };
}

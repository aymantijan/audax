// Course progress = coefficient-weighted average of chapter progress.
// Chapter progress = coefficient-weighted checklist completion.
// Returns 0-100 (rounded to nearest whole percent, per spec).
export function calculateCourseProgress(course) {
  const chapters = course?.chapters || [];
  if (!chapters.length) return Number(course?.progressPercent) || 0; // pre-chapters courses
  const chapterProgresses = chapters.map((ch) => {
    const items = ch.checklistItems || [];
    const totalW = items.reduce((s, it) => s + (Number(it.coefficient) || 1), 0);
    const doneW = items.reduce((s, it) => s + (it.completed ? Number(it.coefficient) || 1 : 0), 0);
    const progress = totalW === 0 ? 0 : (doneW / totalW) * 100;
    return { progress, coefficient: Number(ch.coefficient) || 1 };
  });
  const totalCoeff = chapterProgresses.reduce((s, c) => s + c.coefficient, 0);
  if (!totalCoeff) return 0;
  const weighted = chapterProgresses.reduce((s, c) => s + c.progress * c.coefficient, 0);
  return Math.round(weighted / totalCoeff);
}

// Suggested grade from progress at completion time.
export function gradeForProgress(progress) {
  if (progress >= 90) return 'A';
  if (progress >= 85) return 'B+';
  if (progress >= 75) return 'B';
  if (progress >= 70) return 'C+';
  if (progress >= 60) return 'C';
  if (progress >= 50) return 'D';
  return 'F';
}

// Articles page - category filter
document.querySelectorAll('.filters .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    const cat = chip.dataset.cat;
    const cards = document.querySelectorAll('.blog-card');
    cards.forEach(card => {
      const cardCat = card.querySelector('.blog-cat')?.textContent || '';
      if (cat === 'all' || cardCat === cat) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  });
});

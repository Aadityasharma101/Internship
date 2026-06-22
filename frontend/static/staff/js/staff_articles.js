document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('staff-article-form');
  const statusEl = document.getElementById('staff-form-status');

  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    statusEl.textContent = 'Posting...';

    const payload = {
      title: form.querySelector('[name="title"]').value,
      body: form.querySelector('[name="body"]').value,
      description: form.querySelector('[name="description"]').value,
      category: form.querySelector('[name="category"]').value,
      image: form.querySelector('[name="image"]').value,
      status: form.querySelector('[name="status"]').value,
      featured: !!form.querySelector('[name="featured"]').checked,
      published: !!form.querySelector('[name="published"]').checked,
    };

    try {
      const resp = await axios.post('/staff/add_article/', payload);
      if (resp.status >= 200 && resp.status < 300) {
        statusEl.textContent = 'Article submitted successfully.';
        form.reset();
      } else {
        statusEl.textContent = `Error: ${resp.status}`;
      }
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'Failed to submit article.';
    }
  });
});

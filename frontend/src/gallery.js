// Post a build to the gallery (with the LLM moderation verdict) and browse other people's builds.
// Talks to the Django API under /api/ (serve.js forwards it to the backend in local development).
const $ = (id) => document.getElementById(id);

async function api(path, body) {
  const options = { credentials: 'same-origin', headers: {} };
  if (body) {
    // Django wants a CSRF token on every POST; login rotates it, so fetch a fresh one each time.
    const { csrfToken } = await (await fetch('/api/accounts/csrf/', { credentials: 'same-origin' })).json();
    Object.assign(options, { method: 'POST', body: JSON.stringify(body) });
    options.headers = { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken };
  }
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error([data.error ?? `Server error (${response.status})`].flat().join(' '));
  return data;
}

// Disabled fields skip the form's required checks, so a hidden login box never blocks a post.
const showLogin = (show) => Object.assign($('login-fields'), { hidden: !show, disabled: !show });
const loggedIn = () => api('/api/accounts/profile/').then(() => true, () => false);

function message(text, kind = '') {
  $('post-message').textContent = text;
  $('post-message').className = `message ${kind}`;
}

const VERDICTS = {
  approved: ['Approved! Your build is now in the gallery.', 'ok'],
  rejected: ['Rejected by moderation.', 'bad'],
  pending: ['Saved, but moderation could not decide yet. It stays pending.', 'wait'],
};

export function setupGallery(world, width, height, createPixel) {
  const postDialog = $('post-dialog');
  const galleryDialog = $('gallery-dialog');
  for (const button of document.querySelectorAll('dialog [data-close]')) button.onclick = () => button.closest('dialog').close();

  $('post-build').onclick = async () => {
    message('');
    $('post-form').reset();
    showLogin(!(await loggedIn()));
    postDialog.showModal();
  };

  $('post-form').onsubmit = async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    const submit = $('post-submit');
    submit.disabled = true;
    try {
      if (!$('login-fields').hidden) {
        const account = { username: form.get('username'), password: form.get('password') };
        if (e.submitter?.id === 'register') await api('/api/accounts/register/', { ...account, email: form.get('email') });
        await api('/api/accounts/login/', account);
        showLogin(false);
      }
      message('Posting… the moderator is looking at your build.', 'wait');
      const cells = world.grid.cells.map((pixel) => pixel?.type ?? null);
      const creation = await api('/api/creations/create/', {
        title: form.get('title'),
        description: form.get('description'),
        simulation_data: { version: 1, width, height, cells },
      });
      const [text, kind] = VERDICTS[creation.moderation_status] ?? VERDICTS.pending;
      message(creation.moderation_reason ? `${text} Reason: ${creation.moderation_reason}` : text, kind);
    } catch (error) {
      message(error.message, 'bad');
    } finally {
      submit.disabled = false;
    }
  };

  $('browse-builds').onclick = async () => {
    const list = $('gallery-list');
    list.replaceChildren('Loading…');
    galleryDialog.showModal();
    try {
      const [{ creations }, mine] = await Promise.all([
        api('/api/creations/'),
        api('/api/creations/mine/').catch(() => ({ creations: [] })),
      ]);
      // Your own builds that are not approved (pending or rejected) show too, with their status.
      const builds = [...creations, ...mine.creations.filter((c) => c.moderation_status !== 'approved')];
      list.replaceChildren(...builds.map((creation) => buildCard(creation, world, width, createPixel, galleryDialog)));
      if (!builds.length) list.textContent = 'No builds yet. Be the first to post one!';
    } catch (error) {
      list.textContent = error.message;
    }
  };
}

function buildCard(creation, world, width, createPixel, dialog) {
  const card = document.createElement('li');
  const title = document.createElement('strong');
  title.textContent = creation.title;
  const info = document.createElement('p');
  info.className = 'note';
  info.textContent = [creation.description, new Date(creation.created_at).toLocaleDateString()].filter(Boolean).join(' · ');
  card.append(title, info);
  if (creation.moderation_status !== 'approved') {
    const status = document.createElement('p');
    status.className = `message ${VERDICTS[creation.moderation_status]?.[1] ?? 'wait'}`;
    status.textContent = `Your build: ${creation.moderation_status}${creation.moderation_reason ? ` (${creation.moderation_reason})` : ''}`;
    card.append(status);
  }
  const load = document.createElement('button');
  load.textContent = 'Load';
  load.onclick = () => {
    creation.simulation_data.cells.forEach((type, i) => world.set(i % width, Math.floor(i / width), type && createPixel(type)));
    dialog.close();
  };
  card.append(load);
  return card;
}

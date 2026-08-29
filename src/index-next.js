const REPOSITORY = 'cookiescakes/cookiescakeswebpage';
const GITHUB_API = 'https://api.github.com';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, X-Menu-Publish-Password',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
};

function response(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
}

function isSafeImagePath(path, directory) {
  return new RegExp(`^${directory}/[a-z0-9][a-z0-9._-]*$`, 'i').test(path);
}

function githubErrorMessage(error) {
  const message = String(error.message || '');
  const start = message.indexOf('{');
  if (start === -1) return '';
  try {
    const detail = JSON.parse(message.slice(start));
    return typeof detail.message === 'string' ? detail.message.replace(/[\r\n]/g, ' ').slice(0, 180) : '';
  } catch {
    return '';
  }
}

function publishFailure(error) {
  const message = String(error.message || '');
  if (message.includes('GitHub 401')) return 'GitHub rejected the publishing token. Please update the Worker secret.';
  if (message.includes('GitHub 403')) {
    const detail = githubErrorMessage(error);
    return detail ? `GitHub refused this request: ${detail}` : 'GitHub refused the publishing token.';
  }
  if (message.includes('GitHub 404')) return 'The publishing token cannot access the Cookies Cakes repository.';
  return 'Publishing failed. Check the Worker configuration and try again.';
}

async function github(env, path, init = {}) {
  const result = await fetch(`${GITHUB_API}/repos/${REPOSITORY}${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'cookies-cakes-publisher',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      ...init.headers
    }
  });
  if (!result.ok) {
    const detail = await result.text();
    throw new Error(`GitHub ${result.status}: ${detail.slice(0, 300)}`);
  }
  return result.json();
}

async function createBlob(env, content, encoding = 'base64') {
  const result = await github(env, '/git/blobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, encoding })
  });
  return result.sha;
}

async function publishCollection(env, { data, images, dataPath, imageDirectory, message }) {
  if (typeof data !== 'string' || data.length > 500000) throw new Error('Invalid portfolio data.');
  if (!Array.isArray(images) || images.length > 30) throw new Error('Too many images in one publish.');
  for (const image of images) {
    if (!isSafeImagePath(image.path, imageDirectory) || typeof image.content !== 'string' || image.content.length > 14000000) {
      throw new Error('One of the images is invalid or too large.');
    }
  }
  const head = await github(env, '/git/ref/heads/main');
  const parent = await github(env, `/git/commits/${head.object.sha}`);
  const treeEntries = [
    {
      path: dataPath,
      mode: '100644',
      type: 'blob',
      sha: await createBlob(env, btoa(unescape(encodeURIComponent(data))))
    }
  ];
  for (const image of images) {
    treeEntries.push({
      path: `dist/${image.path}`,
      mode: '100644',
      type: 'blob',
      sha: await createBlob(env, image.content)
    });
  }
  const tree = await github(env, '/git/trees', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base_tree: parent.tree.sha, tree: treeEntries })
  });
  const commit = await github(env, '/git/commits', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, tree: tree.sha, parents: [head.object.sha] })
  });
  await github(env, '/git/refs/heads/main', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sha: commit.sha, force: false })
  });
  return commit.sha;
}

async function menuDataResponse(request, env) {
  const asset = await env.ASSETS.fetch(new Request(new URL('/menu-data.js', request.url)));
  if (!asset.ok) return response({ error: 'The published menu is not available yet.' }, asset.status);
  return new Response(await asset.text(), {
    headers: { 'Content-Type': 'application/javascript; charset=utf-8', ...corsHeaders }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/menu-data') {
      if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
      if (request.method !== 'GET') return response({ error: 'Method not allowed' }, 405);
      return menuDataResponse(request, env);
    }
    const endpoint = url.pathname === '/api/publish-menu' ? 'menu' : url.pathname === '/api/publish-portfolio' ? 'portfolio' : null;
    if (!endpoint) return env.ASSETS.fetch(request);
    if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
    if (request.method !== 'POST') return response({ error: 'Method not allowed' }, 405);
    if (!env.GITHUB_TOKEN || !env.MENU_PUBLISH_PASSWORD) return response({ error: 'Publishing is not configured yet.' }, 503);
    if (request.headers.get('X-Menu-Publish-Password') !== env.MENU_PUBLISH_PASSWORD) return response({ error: 'Incorrect publish password.' }, 401);
    try {
      const payload = await request.json();
      const commit = endpoint === 'menu'
        ? await publishCollection(env, {
            data: payload.menuData,
            images: payload.images,
            dataPath: 'dist/menu-data.js',
            imageDirectory: 'images',
            message: 'Update weekly menu from Cookies Cakes manager'
          })
        : await publishCollection(env, {
            data: payload.portfolioData,
            images: payload.images,
            dataPath: 'dist/portfolio-data.js',
            imageDirectory: 'portfolio-images',
            message: 'Update portfolio from Cookies Cakes manager'
          });
      return response({ ok: true, commit });
    } catch (error) {
      console.error(error);
      const conflict = String(error.message).includes('GitHub 422');
      return response({ error: conflict ? 'The repository changed. Refresh the manager and try again.' : publishFailure(error) }, conflict ? 409 : 500);
    }
  }
};

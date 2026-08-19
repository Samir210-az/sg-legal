// TikTok OAuth callback.
// TikTok redirects here with ?code=... after the user authorizes the app.
// This exchanges the code for an access token and shows a minimal result page.
// Token is not persisted anywhere in this demo — only used to prove the flow works.

module.exports = async (req, res) => {
  const { code, error, error_description } = req.query;

  if (error) {
    res.status(400).send(renderPage('Xəta', `${error}: ${error_description || ''}`));
    return;
  }

  if (!code) {
    res.status(400).send(renderPage('Xəta', 'Kod tapılmadı.'));
    return;
  }

  try {
    const tokenRes = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY,
        client_secret: process.env.TIKTOK_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.TIKTOK_REDIRECT_URI,
      }),
    });

    const data = await tokenRes.json();

    if (data.error) {
      res.status(400).send(renderPage('Token alınmadı', JSON.stringify(data)));
      return;
    }

    // Demo purposes only: store token in an httpOnly cookie so /api/upload can use it.
    res.setHeader('Set-Cookie', `tt_access_token=${data.access_token}; HttpOnly; Path=/; Max-Age=3600`);
    res.status(200).send(renderPage(
      'Hesab qoşuldu',
      `open_id: ${data.open_id}<br>scope: ${data.scope}<br><br><a href="/app.html">Panelə qayıt</a>`
    ));
  } catch (e) {
    res.status(500).send(renderPage('Server xətası', String(e)));
  }
};

function renderPage(title, body) {
  return `<!DOCTYPE html><html lang="az"><head><meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body{background:#0B0F14;color:#E9EDF1;font-family:-apple-system,sans-serif;
    display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;margin:0}
    .box{padding:32px}
    h1{font-size:20px;margin-bottom:12px}
    a{color:#E3B23C}
  </style></head><body><div class="box"><h1>${title}</h1><p>${body}</p></div></body></html>`;
}

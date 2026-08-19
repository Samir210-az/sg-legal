// Uploads a video to TikTok as a draft (inbox), proxying the bytes through this server.
// The browser sends the raw video file; this function inits the TikTok upload session
// and forwards the bytes server-to-server (avoids CORS issues with TikTok's upload_url).

const formidable = require('formidable');
const fs = require('fs');

module.exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const cookies = parseCookies(req.headers.cookie || '');
  const accessToken = cookies.tt_access_token;

  if (!accessToken) {
    res.status(401).json({ error: 'Hesab qoşulmayıb. Əvvəlcə giriş edin.' });
    return;
  }

  try {
    const { file } = await parseUpload(req);
    const videoBuffer = fs.readFileSync(file.filepath);
    const videoSize = videoBuffer.length;

    // Step 1: tell TikTok we're sending one chunk of this size, get an upload_url back.
    const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/inbox/video/init/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        source_info: {
          source: 'FILE_UPLOAD',
          video_size: videoSize,
          chunk_size: videoSize,
          total_chunk_count: 1,
        },
      }),
    });
    const initData = await initRes.json();

    if (initData.error && initData.error.code !== 'ok') {
      res.status(400).json({ error: initData.error });
      return;
    }

    // Step 2: send the actual video bytes to the returned upload_url.
    const uploadRes = await fetch(initData.data.upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Range': `bytes 0-${videoSize - 1}/${videoSize}`,
      },
      body: videoBuffer,
    });

    if (!uploadRes.ok) {
      res.status(400).json({ error: `Upload failed: ${uploadRes.status}` });
      return;
    }

    res.status(200).json({
      success: true,
      publish_id: initData.data.publish_id,
      message: 'Video draft kimi göndərildi. TikTok tətbiqinizin "Inbox" bölməsində yoxlayın.',
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
};

function parseUpload(req) {
  const form = formidable({ maxFileSize: 50 * 1024 * 1024 });
  return new Promise((resolve, reject) => {
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      const file = Array.isArray(files.video) ? files.video[0] : files.video;
      if (!file) return reject(new Error('Video faylı tapılmadı.'));
      resolve({ file });
    });
  });
}

function parseCookies(header) {
  return Object.fromEntries(
    header.split(';').filter(Boolean).map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    })
  );
}

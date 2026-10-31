const express = require('express');
const router = express.Router();
const storage = require('../services/githubStorage');

router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const cleanSlug = slug.toLowerCase().trim();

    // ইন-মেমোরি ক্যাশ চেক
    if (storage.cache.has(cleanSlug)) {
      const cached = storage.cache.get(cleanSlug);
      // ১০ মিনিটের ক্যাশ লাইফ
      if (Date.now() - cached.timestamp < 10 * 60 * 1000) {
        setSecurityHeaders(res);
        return res.send(cached.html);
      }
    }

    const slugIndex = await storage.getIndex('slugs_index');
    const websiteId = slugIndex[cleanSlug];

    if (!websiteId) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html lang="bn">
        <head>
          <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>404 - ওয়েবসাইট পাওয়া যায়নি | Nur Host</title>
          <style>
            body { font-family: system-ui, sans-serif; background: #0b0f19; color: #fff; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .box { text-align: center; background: #151c2e; padding: 40px; border-radius: 12px; border: 1px solid #283454; max-width: 400px; }
            h1 { font-size: 3rem; color: #a855f7; margin: 0 0 10px; }
            p { color: #94a3b8; font-size: 1rem; margin-bottom: 25px; }
            a { color: #38bdf8; text-decoration: none; font-weight: bold; border: 1px solid #38bdf8; padding: 8px 18px; border-radius: 6px; }
          </style>
        </head>
        <body>
          <div class="box">
            <h1>404</h1>
            <p>দুঃখিত! এই লিংকে কোনো ওয়েবসাইট খুঁজে পাওয়া যায়নি অথবা এটি মুছে ফেলা হয়েছে।</p>
            <a href="/">Nur Host হোমে যান</a>
          </div>
        </body>
        </html>
      `);
    }

    const htmlFile = await storage.getFile(`websites/${websiteId}/index.html`);
    if (!htmlFile || !htmlFile.content) {
      return res.status(404).send('ওয়েবসাইট ফাইল অনুপস্থিত।');
    }

    // মেমোরি ক্যাশে সংরক্ষণ
    storage.cache.set(cleanSlug, {
      html: htmlFile.content,
      timestamp: Date.now()
    });

    setSecurityHeaders(res);
    return res.send(htmlFile.content);

  } catch (error) {
    console.error('Public serving error:', error);
    return res.status(500).send('ওয়েবসাইট লোড করার সময় ত্রুটি হয়েছে।');
  }
});

// ইউজার সাইটের জন্য সুরক্ষিত আইসোলেশন হেডার (যাতে Nur Host প্ল্যাটফর্মের ডেটা রিড না করা যায়)
function setSecurityHeaders(res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // Iframe / cookie theft প্রতিরোধক স্যান্ডবক্সিং
  res.setHeader(
    'Content-Security-Policy',
    "sandbox allow-scripts allow-forms allow-popups allow-modals allow-downloads;"
  );
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
}

module.exports = router;

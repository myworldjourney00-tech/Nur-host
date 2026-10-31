const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const storage = require('../services/githubStorage');
const crypto = require('crypto');

// স্লাগ স্যানিটাইজার
function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
    .substring(0, 50);
}

// ইউজারের সব ওয়েবসাইট তালিকা ও ড্যাশবোর্ড পরিসংখ্যান
router.get('/', authMiddleware, async (req, res) => {
  try {
    const slugIndex = await storage.getIndex('slugs_index'); // { slug: websiteId }
    const userWebsites = [];

    // ইউজারের ওন করা ওয়েবসাইট খুঁজে নেওয়া
    for (const [slug, id] of Object.entries(slugIndex)) {
      const metaFile = await storage.getFile(`websites/${id}/metadata.json`);
      if (metaFile) {
        const meta = JSON.parse(metaFile.content);
        if (meta.userId === req.user.id) {
          userWebsites.push(meta);
        }
      }
    }

    userWebsites.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return res.json({
      success: true,
      websites: userWebsites,
      stats: {
        total: userWebsites.length,
        deployed: userWebsites.filter(w => w.status === 'live').length
      }
    });
  } catch (err) {
    console.error('Error fetching websites:', err);
    return res.status(500).json({ success: false, error: 'ওয়েবসাইট ডাটা লোড করা সম্ভব হয়নি।' });
  }
});

// নতুন ওয়েবসাইট তৈরি ও ডেপ্লয় করা
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { name, logoUrl, htmlContent } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'ওয়েবসাইটের নাম দেওয়া আবশ্যক।' });
    }

    if (!htmlContent || !htmlContent.trim()) {
      return res.status(400).json({ success: false, error: 'এইচটিএমএল (HTML) কোড ফাঁকা রাখা যাবে না।' });
    }

    // কোড সাইজ লিমিট (ম্যাক্সিমাম ২ মেগাবাইট)
    if (Buffer.byteLength(htmlContent, 'utf8') > 2 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'HTML ফাইলের সাইজ ২MB এর কম হতে হবে।' });
    }

    const slug = generateSlug(name);
    if (!slug) {
      return res.status(400).json({ success: false, error: 'সঠিক নাম প্রদান করুন।' });
    }

    const slugIndex = await storage.getIndex('slugs_index');
    if (slugIndex[slug]) {
      return res.status(400).json({ success: false, error: 'এই নামের স্লাগ বা ওয়েবসাইট ইতোমধ্যে ব্যবহৃত হয়েছে। অন্য নাম দিন।' });
    }

    const websiteId = 'site_' + crypto.randomUUID();
    const now = new Date().toISOString();

    const metadata = {
      id: websiteId,
      userId: req.user.id,
      name: name.trim(),
      slug: slug,
      logoUrl: logoUrl ? logoUrl.trim() : '',
      status: 'live',
      createdAt: now,
      updatedAt: now
    };

    // গিটহাবে মেটাডাটা ও HTML ফাইল সেভ করা
    await storage.saveFile(`websites/${websiteId}/metadata.json`, JSON.stringify(metadata, null, 2), `Add metadata for ${slug}`);
    await storage.saveFile(`websites/${websiteId}/index.html`, htmlContent, `Deploy HTML for ${slug}`);

    // গ্লোবাল স্লাগ ইনডেক্স আপডেট
    slugIndex[slug] = websiteId;
    await storage.saveIndex('slugs_index', slugIndex);

    const liveUrl = `${req.protocol}://${req.get('host')}/u/${slug}`;

    return res.status(201).json({
      success: true,
      message: 'ওয়েবসাইট সফলভাবে লাইভ ডেপ্লয় হয়েছে!',
      website: metadata,
      liveUrl
    });
  } catch (err) {
    console.error('Deployment error:', err);
    return res.status(500).json({ success: false, error: 'ডেপ্লয়মেন্ট ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।' });
  }
});

// নির্দিষ্ট ওয়েবসাইট এর বিস্তারিত আনা (এডিটের জন্য)
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const metaFile = await storage.getFile(`websites/${id}/metadata.json`);
    if (!metaFile) {
      return res.status(404).json({ success: false, error: 'ওয়েবসাইট পাওয়া যায়নি।' });
    }

    const metadata = JSON.parse(metaFile.content);
    if (metadata.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'আপনার এই ওয়েবসাইটে কোনো প্রবেশাধিকার নেই।' });
    }

    const htmlFile = await storage.getFile(`websites/${id}/index.html`);
    const htmlContent = htmlFile ? htmlFile.content : '';

    return res.json({
      success: true,
      website: metadata,
      htmlContent
    });
  } catch (err) {
    console.error('Error getting website:', err);
    return res.status(500).json({ success: false, error: 'ডাটা রিট্রিভ করা সম্ভব হয়নি।' });
  }
});

// ওয়েবসাইট আপডেট ও রি-ডেপ্লয়
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, logoUrl, htmlContent } = req.body;

    const metaFile = await storage.getFile(`websites/${id}/metadata.json`);
    if (!metaFile) {
      return res.status(404).json({ success: false, error: 'ওয়েবসাইট পাওয়া যায়নি।' });
    }

    const metadata = JSON.parse(metaFile.content);
    if (metadata.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'অননুমোদিত অ্যাকশন।' });
    }

    if (!htmlContent || !htmlContent.trim()) {
      return res.status(400).json({ success: false, error: 'HTML কন্টেন্ট আবশ্যক।' });
    }

    metadata.name = name ? name.trim() : metadata.name;
    metadata.logoUrl = logoUrl !== undefined ? logoUrl.trim() : metadata.logoUrl;
    metadata.updatedAt = new Date().toISOString();

    // গিটহাবে মেটাডাটা ও আপডেট করা HTML রাইট করা
    await storage.saveFile(`websites/${id}/metadata.json`, JSON.stringify(metadata, null, 2), `Update metadata ${metadata.slug}`);
    await storage.saveFile(`websites/${id}/index.html`, htmlContent, `Redeploy HTML ${metadata.slug}`);

    const liveUrl = `${req.protocol}://${req.get('host')}/u/${metadata.slug}`;

    return res.json({
      success: true,
      message: 'ওয়েবসাইট সফলভাবে আপডেট ও রি-ডেপ্লয় হয়েছে!',
      website: metadata,
      liveUrl
    });
  } catch (err) {
    console.error('Update error:', err);
    return res.status(500).json({ success: false, error: 'ওয়েবসাইট আপডেট করা সম্ভব হয়নি।' });
  }
});

// ওয়েবসাইট ডিলিট করা
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const metaFile = await storage.getFile(`websites/${id}/metadata.json`);
    if (!metaFile) {
      return res.status(404).json({ success: false, error: 'ওয়েবসাইট পাওয়া যায়নি।' });
    }

    const metadata = JSON.parse(metaFile.content);
    if (metadata.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'অননুমোদিত চেষ্টা।' });
    }

    // স্লাগ ইনডেক্স থেকে মুছে ফেলা
    const slugIndex = await storage.getIndex('slugs_index');
    delete slugIndex[metadata.slug];
    await storage.saveIndex('slugs_index', slugIndex);

    // গিটহাব থেকে ফাইল ডিলিট
    await storage.deleteFile(`websites/${id}/index.html`, `Remove HTML for ${metadata.slug}`);
    await storage.deleteFile(`websites/${id}/metadata.json`, `Remove metadata for ${metadata.slug}`);

    return res.json({ success: true, message: 'ওয়েবসাইট সফলভাবে ডিলিট করা হয়েছে।' });
  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({ success: false, error: 'ওয়েবসাইট ডিলিট করা যায়নি।' });
  }
});

module.exports = router;
